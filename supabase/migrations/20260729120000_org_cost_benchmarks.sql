-- One row per (org_id, aircraft_type, component). The middle tier of the 3-way
-- cost resolution chain: per-lease override (mr_cost_overrides) > org benchmark
-- (this table) > global heuristic (TYPE_HEURISTICS). Lets an org record its own
-- negotiated/observed MRO cost for an aircraft type without needing per-lease
-- evidence — e.g. "every A320neo Engine PR we've actually paid for costs closer
-- to $6.1M than the global heuristic's $5.8M."
--
-- RLS follows the same org-scoped pattern as mr_cost_overrides
-- (20260728120000_mr_cost_overrides.sql), itself following the corrected
-- pattern from 20260528120000_security_audit_rls_lockdown.sql.

create table if not exists org_cost_benchmarks (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null references organisations(id) on delete cascade,
  aircraft_type text        not null,   -- matches TYPE_HEURISTICS keys, e.g. "A320neo"
  component     text        not null,   -- "Engine PR", "Airframe HSI", "LLPs", "Landing Gear", "APU"
  cost_usd      numeric     not null,
  note          text,
  created_by    text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists org_cost_benchmarks_org_type_component_uidx
  on org_cost_benchmarks(org_id, aircraft_type, component);

create index if not exists org_cost_benchmarks_org_idx
  on org_cost_benchmarks(org_id);

alter table org_cost_benchmarks enable row level security;
alter table org_cost_benchmarks force  row level security;

create policy org_cost_benchmarks_select_own_org on org_cost_benchmarks
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy org_cost_benchmarks_insert_own_org on org_cost_benchmarks
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy org_cost_benchmarks_update_own_org on org_cost_benchmarks
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                          with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy org_cost_benchmarks_delete_own_org on org_cost_benchmarks
  for delete to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
