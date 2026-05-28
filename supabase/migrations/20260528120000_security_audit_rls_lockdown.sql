-- Security audit remediation (2026-05-28)
--
-- Findings closed:
--  1. CRITICAL — pd_curve_overrides + lgd_recovery_overrides shipped in
--     20260523113150/152, BEFORE the Phase-4 lockdown (20260525170000), so
--     they never got RLS. Both carry org_id and anon+authenticated held full
--     CRUD => any holder of the public anon key could read/write every
--     tenant's PD curves and LGD recovery factors via PostgREST. Tables are
--     currently empty (no leak yet). Enable + FORCE RLS, add org-scoped CRUD
--     policies matching the established pattern.
--  2. MEDIUM — org_deletion_log SELECT was `using (true)`, letting any
--     authenticated user read every org's deletion audit (actor email, row
--     counts, timestamps). Scope to own org. Operators keep service-role read.
--  3. WARN — five append-only trigger functions had a mutable search_path.
--     Pin it.

-- ── 1. PD / LGD override tables ──────────────────────────────────────────────
alter table pd_curve_overrides     enable row level security;
alter table pd_curve_overrides     force  row level security;
alter table lgd_recovery_overrides enable row level security;
alter table lgd_recovery_overrides force  row level security;

-- pd_curve_overrides
create policy pd_curve_overrides_select_own_org on pd_curve_overrides
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy pd_curve_overrides_insert_own_org on pd_curve_overrides
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy pd_curve_overrides_update_own_org on pd_curve_overrides
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                          with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy pd_curve_overrides_delete_own_org on pd_curve_overrides
  for delete to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- lgd_recovery_overrides
create policy lgd_recovery_overrides_select_own_org on lgd_recovery_overrides
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy lgd_recovery_overrides_insert_own_org on lgd_recovery_overrides
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy lgd_recovery_overrides_update_own_org on lgd_recovery_overrides
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                          with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy lgd_recovery_overrides_delete_own_org on lgd_recovery_overrides
  for delete to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- ── 2. org_deletion_log — scope read to own org ──────────────────────────────
drop policy if exists org_deletion_log_select on org_deletion_log;
create policy org_deletion_log_select_own_org on org_deletion_log
  for select to authenticated
  using (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- ── 3. Pin search_path on append-only trigger functions ──────────────────────
alter function public.org_deletion_log_immutable()    set search_path = public, pg_temp;
alter function public.ecl_period_snapshots_immutable() set search_path = public, pg_temp;
alter function public.audit_log_immutable()            set search_path = public, pg_temp;
alter function public.stage_migrations_immutable()     set search_path = public, pg_temp;
alter function public.alert_sends_immutable()          set search_path = public, pg_temp;
