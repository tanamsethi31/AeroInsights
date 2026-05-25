-- ─── SICR triggers configuration ingestion (T-1.6) ─────────────────────────
-- One row per (org_id, portfolio_id) carrying the Significant Increase in
-- Credit Risk thresholds. Drives the stage-migration evaluator that lives
-- in src/app/components/scenarios/sicrEvaluator.ts and the RiskECL →
-- SICR Config tab.
--
-- The Excel "SICR Triggers" sheet stores the config as label/value pairs
-- in row 2 (a single config "row" spanning the sheet's columns) — the
-- parser extracts those 6 scalars; everything else on the sheet is OUTPUT
-- (per-lessee SICR evaluation results, recomputable server-side from this
-- config + the ingested lessee columns).

create table if not exists sicr_config (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references organisations(id) on delete cascade,
  portfolio_id                uuid not null references portfolios(id)    on delete cascade,

  -- ── DPD trigger ──────────────────────────────────────────────────────────
  -- When enabled, any lessee with DPD >= dpd_threshold_days triggers SICR.
  dpd_enabled                 boolean not null default true,
  dpd_threshold_days          int     not null default 30
                              check (dpd_threshold_days >= 0),

  -- ── Rating downgrade trigger ─────────────────────────────────────────────
  -- Any lessee with rating_notches_down >= rating_notches_threshold trips.
  -- The Excel writes "≥ 2" — the parser strips the operator and keeps 2.
  rating_notches_threshold    int     not null default 2
                              check (rating_notches_threshold >= 0),

  -- ── Country watchlist trigger ────────────────────────────────────────────
  country_watchlist_enabled   boolean not null default true,

  -- ── Insolvency filing trigger ────────────────────────────────────────────
  insolvency_filing_enabled   boolean not null default true,

  -- ── Stage 3 → Stage 2 upgrade threshold ──────────────────────────────────
  -- A lessee already in Stage 3 can de-escalate to Stage 2 only after their
  -- rating recovers by this many notches.
  upgrade_threshold_notches   int     not null default 2
                              check (upgrade_threshold_notches >= 0),

  source_upload_id            uuid references uploads(id) on delete set null,
  updated_at                  timestamptz not null default now(),

  unique (org_id, portfolio_id)
);

create index if not exists sicr_config_org_portfolio_idx
  on sicr_config(org_id, portfolio_id);

alter table sicr_config enable row level security;

drop policy if exists sicr_config_select on sicr_config;
create policy sicr_config_select on sicr_config
  for select to authenticated using (true);
drop policy if exists sicr_config_insert on sicr_config;
create policy sicr_config_insert on sicr_config
  for insert to authenticated with check (true);
drop policy if exists sicr_config_update on sicr_config;
create policy sicr_config_update on sicr_config
  for update to authenticated using (true) with check (true);
