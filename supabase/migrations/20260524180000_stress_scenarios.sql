-- ─── Stress Scenarios + Restructuring Presets ingestion (T-1.7) ────────────
-- Two new tables, both scoped to (org_id, portfolio_id):
--
--   stress_scenarios       — one row per macro scenario (Baseline / Adverse /
--                            Severe / custom). Replaces hardcoded
--                            SCENARIO_LIBRARY in src/app/data/intelligenceData.ts.
--   restructuring_presets  — one row per restructuring preset (Standstill /
--                            Rent Reduction / Equity-for-Debt / Full Write-off).
--                            Drives the RiskECL deferral simulator.

-- ── 1. stress_scenarios ──────────────────────────────────────────────────────

create table if not exists stress_scenarios (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references organisations(id) on delete cascade,
  portfolio_id                uuid not null references portfolios(id)    on delete cascade,

  name                        text not null,
  slug                        text not null,         -- unique-within-portfolio handle

  weight                      numeric(5,4)           -- 0–1; weights across active scenarios should sum to 1
                              check (weight is null or (weight >= 0 and weight <= 1)),

  -- ── Macro shocks (signed deltas as fractions: 0.04 = +4%) ────────────────
  gdp_shock_pct               numeric(7,5),
  rpk_growth_pct              numeric(7,5),
  fuel_delta_pct              numeric(7,5),
  em_fx_stress_pct            numeric(7,5),
  rate_rise_bps               int,
  asset_value_shock_pct       numeric(7,5),

  -- ── PD multipliers ────────────────────────────────────────────────────────
  pd_s2_mult                  numeric(6,3)
                              check (pd_s2_mult is null or pd_s2_mult >= 0),
  pd_s3_mult                  numeric(6,3)
                              check (pd_s3_mult is null or pd_s3_mult >= 0),

  -- ── Deferral / forgiveness ────────────────────────────────────────────────
  deferral_months             int
                              check (deferral_months is null or deferral_months >= 0),
  govt_support_prob           numeric(5,4)
                              check (govt_support_prob is null or (govt_support_prob >= 0 and govt_support_prob <= 1)),
  forgiveness_rate            numeric(5,4)
                              check (forgiveness_rate is null or (forgiveness_rate >= 0 and forgiveness_rate <= 1)),

  description                 text,
  source_upload_id            uuid references uploads(id) on delete set null,
  updated_at                  timestamptz not null default now(),

  unique (org_id, portfolio_id, slug)
);

create index if not exists stress_scenarios_org_portfolio_idx
  on stress_scenarios(org_id, portfolio_id);

alter table stress_scenarios enable row level security;
drop policy if exists stress_scenarios_select on stress_scenarios;
create policy stress_scenarios_select on stress_scenarios for select to authenticated using (true);
drop policy if exists stress_scenarios_insert on stress_scenarios;
create policy stress_scenarios_insert on stress_scenarios for insert to authenticated with check (true);
drop policy if exists stress_scenarios_update on stress_scenarios;
create policy stress_scenarios_update on stress_scenarios for update to authenticated using (true) with check (true);

-- ── 2. restructuring_presets ────────────────────────────────────────────────

create table if not exists restructuring_presets (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references organisations(id) on delete cascade,
  portfolio_id                uuid not null references portfolios(id)    on delete cascade,

  name                        text not null,
  slug                        text not null,

  deferral_months             int
                              check (deferral_months is null or deferral_months >= 0),
  govt_support_prob           numeric(5,4)
                              check (govt_support_prob is null or (govt_support_prob >= 0 and govt_support_prob <= 1)),
  forgiveness_rate            numeric(5,4)
                              check (forgiveness_rate is null or (forgiveness_rate >= 0 and forgiveness_rate <= 1)),
  description                 text,

  source_upload_id            uuid references uploads(id) on delete set null,
  updated_at                  timestamptz not null default now(),

  unique (org_id, portfolio_id, slug)
);

create index if not exists restructuring_presets_org_portfolio_idx
  on restructuring_presets(org_id, portfolio_id);

alter table restructuring_presets enable row level security;
drop policy if exists restructuring_presets_select on restructuring_presets;
create policy restructuring_presets_select on restructuring_presets for select to authenticated using (true);
drop policy if exists restructuring_presets_insert on restructuring_presets;
create policy restructuring_presets_insert on restructuring_presets for insert to authenticated with check (true);
drop policy if exists restructuring_presets_update on restructuring_presets;
create policy restructuring_presets_update on restructuring_presets for update to authenticated using (true) with check (true);
