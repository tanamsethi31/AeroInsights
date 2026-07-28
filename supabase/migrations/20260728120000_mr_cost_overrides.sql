-- One row per (org_id, lease_id, component). Upserted from useCostOverrides hook.
-- Overrides a single component's event cost on one specific lease's aircraft —
-- the heuristic in maintenanceHeuristics.ts remains the fleet-wide default;
-- this table only ever affects the one lease/component pair it targets.
--
-- RLS follows the corrected org-scoped pattern from
-- 20260528120000_security_audit_rls_lockdown.sql (auth.jwt() ->> 'org_id'),
-- not the older `to authenticated using (true)` shape used by earlier
-- override-style tables before that remediation — this is a new table, so
-- it starts on the current, correct pattern rather than needing a follow-up
-- lockdown migration of its own.

create table if not exists mr_cost_overrides (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references organisations(id) on delete cascade,
  lease_id     text        not null,
  component    text        not null,   -- "Engine PR", "Airframe HSI", "LLPs", "Landing Gear", "APU"
  cost_usd     numeric     not null,
  note         text,                   -- optional free-text evidence, e.g. "Per MRO quote dated 2026-06-15"
  created_by   text        not null,   -- actor email, mirrors audit_log.actor
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists mr_cost_overrides_org_lease_component_uidx
  on mr_cost_overrides(org_id, lease_id, component);

create index if not exists mr_cost_overrides_org_idx
  on mr_cost_overrides(org_id);

alter table mr_cost_overrides enable row level security;
alter table mr_cost_overrides force  row level security;

create policy mr_cost_overrides_select_own_org on mr_cost_overrides
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy mr_cost_overrides_insert_own_org on mr_cost_overrides
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy mr_cost_overrides_update_own_org on mr_cost_overrides
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                          with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy mr_cost_overrides_delete_own_org on mr_cost_overrides
  for delete to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
