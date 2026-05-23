-- supabase/migrations/006_ecl_period_snapshots.sql
-- ECL period snapshots: append-only log of locked reporting periods

create table if not exists ecl_period_snapshots (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  period_label     text not null,
  locked_at        timestamptz not null default now(),
  locked_by        text not null default 'unknown',
  -- aggregates for log display
  stage1_ecl       numeric not null,
  stage2_ecl       numeric not null,
  stage3_ecl       numeric not null,
  total_ecl        numeric not null,
  ecl_12m          numeric not null,
  coverage_pct     numeric not null,
  -- full state for re-download and roll-forward diff
  scenario_inputs  jsonb not null,
  weights          jsonb not null,
  scenario_summary jsonb not null,
  weighted         jsonb not null,
  sicr_config      jsonb not null,
  ecl_rows         jsonb not null,
  currency         text not null default 'USD'
);

create index if not exists ecl_period_snapshots_org_idx
  on ecl_period_snapshots(org_id, locked_at desc);
