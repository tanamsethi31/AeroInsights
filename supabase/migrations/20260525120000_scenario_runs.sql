-- ─── Scenario Runs persistence (T-3.1) ─────────────────────────────────────
-- Append-only log of every scenario run (Library cards + Custom Builder).
-- RunHistory tab reads from here so runs survive refresh + are auditable.
--
-- inputs / result are JSONB so we can persist arbitrary scenario inputs and
-- engine output (ECL, P5/P95, stage split, shapley, top lessees, hash, engine
-- provenance) without schema drift every time we add a slider.
--
-- parent_run_id supports clone / branch lineage. Self-reference, nullable.

create table if not exists scenario_runs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  portfolio_id    uuid not null references portfolios(id)    on delete cascade,

  -- Display id used in the UI (e.g. RUN-2026-0042). Stable handle for
  -- cross-referencing with reports + audit logs.
  run_code        text not null,

  -- Source template id (TPL-* hardcoded library OR DB-{slug} for ingested
  -- stress scenarios) — null for pure Custom Builder runs.
  scenario_id     text,

  name            text not null,
  mode            text not null check (mode in ('deterministic', 'montecarlo')),
  paths           int  check (paths is null or paths > 0),
  seed            int  not null,

  inputs          jsonb not null default '{}'::jsonb,
  result          jsonb not null default '{}'::jsonb,

  parent_run_id   uuid references scenario_runs(id) on delete set null,

  run_at          timestamptz not null default now(),
  run_by          text not null default 'unknown',

  unique (org_id, portfolio_id, run_code)
);

create index if not exists scenario_runs_org_portfolio_run_at_idx
  on scenario_runs(org_id, portfolio_id, run_at desc);

create index if not exists scenario_runs_parent_idx
  on scenario_runs(parent_run_id) where parent_run_id is not null;

alter table scenario_runs enable row level security;
drop policy if exists scenario_runs_select on scenario_runs;
create policy scenario_runs_select on scenario_runs for select to authenticated using (true);
drop policy if exists scenario_runs_insert on scenario_runs;
create policy scenario_runs_insert on scenario_runs for insert to authenticated with check (true);
-- Append-only: no update / delete policy. Rows are immutable once written.

comment on table scenario_runs is
  'Append-only audit log of every scenario run. T-3.1 — IFRS-9 audit trail.';
