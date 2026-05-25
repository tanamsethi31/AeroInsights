-- ─── Universal audit log (T-3.4) ───────────────────────────────────────────
-- Single canonical append-only log for every state-changing event in the
-- platform: settings edits, scenario runs, period locks, report exports,
-- lease edits, stage migrations. Auditors get one place to reconstruct the
-- entire history.
--
-- Earlier table `assumption_change_log` (migration 005) covers a narrow
-- PD/LGD slice and is retained as-is for back-compat. New code writes here
-- instead. A future cleanup can backfill old rows into audit_log.
--
-- Why JSONB before/after instead of typed columns?
--   Every entity (ifrs9_parameters, sicr_config, leases, scenario_runs,
--   ecl_period_snapshots) has a different shape. Typed columns would either
--   force a per-entity table (defeats the "single log" goal) or a giant
--   sparse schema. JSONB lets us record the full snapshot diff with zero
--   schema drift, and lets a UI render an arbitrary entity later.
--
-- portfolio_id is nullable on purpose — some events (org-wide settings,
-- ingestion attempts that fail before a portfolio is chosen) don't have a
-- portfolio. When set, it's an FK; when null, the event is org-scoped.

create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  portfolio_id  uuid references portfolios(id) on delete cascade,

  entity_type   text not null,   -- 'ifrs9_parameters', 'sicr_config', 'scenario_run',
                                  -- 'ecl_period_snapshot', 'report_export',
                                  -- 'lease', 'stage_migration', 'ingestion', etc.
  entity_id     text,             -- FK uuid or display id (e.g. RUN-2026-0042). Free-form.

  action        text not null
                check (action in (
                  'create', 'update', 'delete',
                  'lock', 'unlock',
                  'run', 'export', 'import', 'override', 'reset'
                )),

  before        jsonb,             -- null for 'create' / 'run' / 'export'
  after         jsonb,             -- null for 'delete'

  actor         text not null default 'unknown',
  occurred_at   timestamptz not null default now(),

  -- Optional free-text note, e.g. user-entered reason for an override.
  note          text
);

create index if not exists audit_log_org_portfolio_occurred_idx
  on audit_log(org_id, portfolio_id, occurred_at desc);

create index if not exists audit_log_org_occurred_idx
  on audit_log(org_id, occurred_at desc);

create index if not exists audit_log_entity_idx
  on audit_log(org_id, entity_type, entity_id);

alter table audit_log enable row level security;
drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log for select to authenticated using (true);
drop policy if exists audit_log_insert on audit_log;
create policy audit_log_insert on audit_log for insert to authenticated with check (true);
-- Append-only: no update/delete policy.

-- DB-layer immutability so rows can never be edited regardless of RLS.
create or replace function audit_log_immutable()
  returns trigger
  language plpgsql
as $$
begin
  raise exception
    'audit_log is append-only: % on row % is not permitted',
    tg_op, old.id
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists audit_log_no_update on audit_log;
create trigger audit_log_no_update
  before update on audit_log
  for each row execute function audit_log_immutable();

drop trigger if exists audit_log_no_delete on audit_log;
create trigger audit_log_no_delete
  before delete on audit_log
  for each row execute function audit_log_immutable();

comment on table audit_log is
  'Universal append-only audit trail. T-3.4. Every state-changing event writes one row.';
