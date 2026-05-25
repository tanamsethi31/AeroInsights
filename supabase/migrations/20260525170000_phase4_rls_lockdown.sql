-- ─── Phase 4.1 — RLS lockdown across all Phase 1 & Phase 3 tables ──────────
--
-- BEFORE: 12 tables had policies of the form
--   `for X to authenticated using (true) with check (true)`
-- meaning any authenticated session could read or write any tenant's data.
--
-- AFTER:  every policy enforces the same org-scoping clause already used
-- by leases / lessees / assets / uploads:
--   `org_id = ((auth.jwt() ->> 'org_id')::uuid)`
-- The auth flow (Auth0 → Supabase JWT) writes a custom `org_id` claim into
-- every issued JWT; this clause ties row visibility to that claim. A token
-- without an `org_id` claim sees zero rows on these tables.
--
-- Storage bucket policies are hardened in a separate migration so an
-- operator can audit the per-table SQL change in isolation.
--
-- The role on every new policy is `public` (matches the leases pattern) so
-- the same clause covers both Auth0-signed and anon roles consistently.

-- ── helper: standardise the per-table swap ────────────────────────────────
--
-- For each target table we drop ALL existing public policies (the
-- permissive ones AND any earlier secured ones to keep the migration
-- idempotent), then re-create the org-scoped triple.

-- audit_log ----------------------------------------------------------------
drop policy if exists audit_log_select on audit_log;
drop policy if exists audit_log_insert on audit_log;
drop policy if exists audit_log_select_own_org on audit_log;
drop policy if exists audit_log_insert_own_org on audit_log;
create policy audit_log_select_own_org on audit_log
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy audit_log_insert_own_org on audit_log
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- scenario_runs ------------------------------------------------------------
drop policy if exists scenario_runs_select on scenario_runs;
drop policy if exists scenario_runs_insert on scenario_runs;
drop policy if exists scenario_runs_select_own_org on scenario_runs;
drop policy if exists scenario_runs_insert_own_org on scenario_runs;
create policy scenario_runs_select_own_org on scenario_runs
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy scenario_runs_insert_own_org on scenario_runs
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- report_exports -----------------------------------------------------------
drop policy if exists report_exports_select on report_exports;
drop policy if exists report_exports_insert on report_exports;
drop policy if exists report_exports_select_own_org on report_exports;
drop policy if exists report_exports_insert_own_org on report_exports;
create policy report_exports_select_own_org on report_exports
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy report_exports_insert_own_org on report_exports
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- stage_migrations ---------------------------------------------------------
drop policy if exists stage_migrations_select on stage_migrations;
drop policy if exists stage_migrations_insert on stage_migrations;
drop policy if exists stage_migrations_select_own_org on stage_migrations;
drop policy if exists stage_migrations_insert_own_org on stage_migrations;
create policy stage_migrations_select_own_org on stage_migrations
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy stage_migrations_insert_own_org on stage_migrations
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- ifrs9_parameters ---------------------------------------------------------
drop policy if exists ifrs9_parameters_select on ifrs9_parameters;
drop policy if exists ifrs9_parameters_insert on ifrs9_parameters;
drop policy if exists ifrs9_parameters_update on ifrs9_parameters;
drop policy if exists ifrs9_parameters_select_own_org on ifrs9_parameters;
drop policy if exists ifrs9_parameters_insert_own_org on ifrs9_parameters;
drop policy if exists ifrs9_parameters_update_own_org on ifrs9_parameters;
create policy ifrs9_parameters_select_own_org on ifrs9_parameters
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy ifrs9_parameters_insert_own_org on ifrs9_parameters
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy ifrs9_parameters_update_own_org on ifrs9_parameters
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- sicr_config --------------------------------------------------------------
drop policy if exists sicr_config_select on sicr_config;
drop policy if exists sicr_config_insert on sicr_config;
drop policy if exists sicr_config_update on sicr_config;
drop policy if exists sicr_config_select_own_org on sicr_config;
drop policy if exists sicr_config_insert_own_org on sicr_config;
drop policy if exists sicr_config_update_own_org on sicr_config;
create policy sicr_config_select_own_org on sicr_config
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy sicr_config_insert_own_org on sicr_config
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy sicr_config_update_own_org on sicr_config
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- stress_scenarios ---------------------------------------------------------
drop policy if exists stress_scenarios_select on stress_scenarios;
drop policy if exists stress_scenarios_insert on stress_scenarios;
drop policy if exists stress_scenarios_update on stress_scenarios;
drop policy if exists stress_scenarios_select_own_org on stress_scenarios;
drop policy if exists stress_scenarios_insert_own_org on stress_scenarios;
drop policy if exists stress_scenarios_update_own_org on stress_scenarios;
create policy stress_scenarios_select_own_org on stress_scenarios
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy stress_scenarios_insert_own_org on stress_scenarios
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy stress_scenarios_update_own_org on stress_scenarios
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- restructuring_presets ----------------------------------------------------
drop policy if exists restructuring_presets_select on restructuring_presets;
drop policy if exists restructuring_presets_insert on restructuring_presets;
drop policy if exists restructuring_presets_update on restructuring_presets;
drop policy if exists restructuring_presets_select_own_org on restructuring_presets;
drop policy if exists restructuring_presets_insert_own_org on restructuring_presets;
drop policy if exists restructuring_presets_update_own_org on restructuring_presets;
create policy restructuring_presets_select_own_org on restructuring_presets
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy restructuring_presets_insert_own_org on restructuring_presets
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy restructuring_presets_update_own_org on restructuring_presets
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- jurisdiction_lgd_overlays ------------------------------------------------
drop policy if exists jurisdiction_lgd_select on jurisdiction_lgd_overlays;
drop policy if exists jurisdiction_lgd_insert on jurisdiction_lgd_overlays;
drop policy if exists jurisdiction_lgd_update on jurisdiction_lgd_overlays;
drop policy if exists jurisdiction_lgd_select_own_org on jurisdiction_lgd_overlays;
drop policy if exists jurisdiction_lgd_insert_own_org on jurisdiction_lgd_overlays;
drop policy if exists jurisdiction_lgd_update_own_org on jurisdiction_lgd_overlays;
create policy jurisdiction_lgd_select_own_org on jurisdiction_lgd_overlays
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy jurisdiction_lgd_insert_own_org on jurisdiction_lgd_overlays
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy jurisdiction_lgd_update_own_org on jurisdiction_lgd_overlays
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- security_deposits --------------------------------------------------------
drop policy if exists security_deposits_select on security_deposits;
drop policy if exists security_deposits_insert on security_deposits;
drop policy if exists security_deposits_update on security_deposits;
drop policy if exists security_deposits_select_own_org on security_deposits;
drop policy if exists security_deposits_insert_own_org on security_deposits;
drop policy if exists security_deposits_update_own_org on security_deposits;
create policy security_deposits_select_own_org on security_deposits
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy security_deposits_insert_own_org on security_deposits
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy security_deposits_update_own_org on security_deposits
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- maintenance_reserves -----------------------------------------------------
drop policy if exists maintenance_reserves_select on maintenance_reserves;
drop policy if exists maintenance_reserves_insert on maintenance_reserves;
drop policy if exists maintenance_reserves_update on maintenance_reserves;
drop policy if exists maintenance_reserves_select_own_org on maintenance_reserves;
drop policy if exists maintenance_reserves_insert_own_org on maintenance_reserves;
drop policy if exists maintenance_reserves_update_own_org on maintenance_reserves;
create policy maintenance_reserves_select_own_org on maintenance_reserves
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy maintenance_reserves_insert_own_org on maintenance_reserves
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy maintenance_reserves_update_own_org on maintenance_reserves
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- portfolios ---------------------------------------------------------------
drop policy if exists portfolios_select on portfolios;
drop policy if exists portfolios_insert on portfolios;
drop policy if exists portfolios_update on portfolios;
drop policy if exists portfolios_select_own_org on portfolios;
drop policy if exists portfolios_insert_own_org on portfolios;
drop policy if exists portfolios_update_own_org on portfolios;
create policy portfolios_select_own_org on portfolios
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy portfolios_insert_own_org on portfolios
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy portfolios_update_own_org on portfolios
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

comment on schema public is
  'Aeroinsights — multi-tenant RLS enforced via auth.jwt() ->> org_id. See docs/SECURITY.md.';
