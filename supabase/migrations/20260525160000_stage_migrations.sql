-- ─── Stage migrations log (T-3.5) ─────────────────────────────────────────
-- Append-only record of every IFRS-9 stage transition (1→2, 2→3, 2→1, etc.)
-- for any lease. Auditors must trace not just the current stage but the
-- sequence of changes and what triggered each one.
--
-- Trigger sources:
--   • 'ingestion' — Excel re-import flipped the stage column
--   • 'sicr'      — automated SICR rule flagged the lease (DPD, rating,
--                   country watchlist, insolvency)
--   • 'manual'    — analyst override
--   • 'scenario_run' — a what-if engine assigned a different stage
--
-- run_id (text) references either scenario_runs.run_code (UI display id)
-- or audit_log.id (uuid). Free-form text so we can point at any source
-- system without an enforced FK that constrains the writer.

create table if not exists stage_migrations (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organisations(id) on delete cascade,
  portfolio_id       uuid not null references portfolios(id)    on delete cascade,

  -- Identify the lease by its external id (stable across re-imports) AND
  -- the internal uuid when available. external_id is the auditor-facing
  -- handle; lease_uuid is for joining at query time.
  lease_external_id  text not null,
  lease_uuid         uuid references leases(id) on delete set null,

  from_stage         int not null check (from_stage in (1, 2, 3)),
  to_stage           int not null check (to_stage   in (1, 2, 3)),

  -- Direction is derived in queries; we record it explicitly only for index
  -- friendliness: 'up' = worsening (1→2, 2→3, 1→3), 'down' = improving.
  direction          text not null check (direction in ('up', 'down')),

  -- Trigger taxonomy.
  reason             text not null
                     check (reason in ('ingestion', 'sicr', 'manual', 'scenario_run')),

  -- Free-text signal that produced the transition (e.g. "DPD > 30",
  -- "country watchlist: Russia", "rating downgrade BB→B").
  signal             text,

  -- Pointer to whatever produced the change. Optional.
  run_id             text,

  occurred_at        timestamptz not null default now(),
  actor              text not null default 'unknown'
);

create index if not exists stage_migrations_org_portfolio_idx
  on stage_migrations(org_id, portfolio_id, occurred_at desc);

create index if not exists stage_migrations_lease_idx
  on stage_migrations(org_id, portfolio_id, lease_external_id, occurred_at desc);

alter table stage_migrations enable row level security;
drop policy if exists stage_migrations_select on stage_migrations;
create policy stage_migrations_select on stage_migrations for select to authenticated using (true);
drop policy if exists stage_migrations_insert on stage_migrations;
create policy stage_migrations_insert on stage_migrations for insert to authenticated with check (true);

-- DB-layer immutability — append-only regardless of RLS.
create or replace function stage_migrations_immutable()
  returns trigger
  language plpgsql
as $$
begin
  raise exception
    'stage_migrations is append-only: % on row % is not permitted',
    tg_op, old.id
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists stage_migrations_no_update on stage_migrations;
create trigger stage_migrations_no_update
  before update on stage_migrations
  for each row execute function stage_migrations_immutable();
drop trigger if exists stage_migrations_no_delete on stage_migrations;
create trigger stage_migrations_no_delete
  before delete on stage_migrations
  for each row execute function stage_migrations_immutable();

comment on table stage_migrations is
  'IFRS-9 stage transition audit log. T-3.5.';
