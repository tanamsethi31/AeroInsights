-- ─── Jurisdiction LGD Overlays ingestion (T-1.8) ───────────────────────────
-- One row per jurisdiction code per (org_id, portfolio_id). Mirrors the
-- Excel "Jurisdiction LGD" sheet which encodes per-jurisdiction recovery
-- parameters: CTC adoption, repossession timelines, success probability,
-- LGD delta vs the US §1110 benchmark, precedent count, uncertainty band.
--
-- This replaces the hardcoded `jurisdictionData.ts` in the frontend (T-2.3
-- follow-up: rewire Jurisdictions tab to query this table).
--
-- The Excel sheet also has a "KEY PRECEDENTS" section (rows 13-20 in v2026)
-- carrying case history (LATAM Ch.11, Garuda PKPU, etc.) — that's a more
-- complex nested data model and gets its own table in a follow-up slice.

create table if not exists jurisdiction_lgd_overlays (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references organisations(id) on delete cascade,
  portfolio_id                uuid not null references portfolios(id)    on delete cascade,

  -- ── Identity ─────────────────────────────────────────────────────────────
  code                        text not null,        -- ISO-2 (US, IN, MX, BR, ID, LK, PH, GL=Generic)
  name                        text not null,        -- "United States", "India (IBC)", etc.
  region                      text,                  -- "North America", "Asia-Pac", "Americas", "Global"

  -- ── Cape Town Convention adoption ────────────────────────────────────────
  ctc_party                   boolean,               -- has the state ratified the CTC?
  ctc_score                   int                    -- 0–100 composite of practical CTC efficacy
                              check (ctc_score is null or (ctc_score >= 0 and ctc_score <= 100)),
  alt_a                       boolean,               -- Alternative A insolvency framework adopted
  idera                       boolean,               -- IDERA (Irrevocable Deregistration & Export Request Authorisation)

  -- ── Governance proxies ───────────────────────────────────────────────────
  enforceability              int
                              check (enforceability is null or (enforceability >= 0 and enforceability <= 100)),
  rule_of_law                 int
                              check (rule_of_law is null or (rule_of_law >= 0 and rule_of_law <= 100)),

  -- ── Repossession timeline (months from default to physical recovery) ─────
  p50_reposs_months           numeric(5,2)
                              check (p50_reposs_months is null or p50_reposs_months >= 0),
  p90_reposs_months           numeric(5,2)
                              check (p90_reposs_months is null or p90_reposs_months >= 0),

  -- ── Cost / probability ───────────────────────────────────────────────────
  p50_cost_pct                numeric(6,5)           -- legal + ferry + storage as % of asset value
                              check (p50_cost_pct is null or (p50_cost_pct >= 0 and p50_cost_pct <= 1)),
  success_prob                numeric(5,4)
                              check (success_prob is null or (success_prob >= 0 and success_prob <= 1)),

  -- ── LGD overlay vs US §1110 baseline ─────────────────────────────────────
  -- Signed delta: -0.12 means jurisdiction recovers 12pp BETTER than benchmark.
  lgd_delta_vs_us             numeric(6,5)
                              check (lgd_delta_vs_us is null or (lgd_delta_vs_us >= -1 and lgd_delta_vs_us <= 1)),

  -- ── Confidence ───────────────────────────────────────────────────────────
  uncertainty_band            text                   -- "Low", "Medium", "High", "Extreme"
                              check (uncertainty_band is null
                                     or uncertainty_band in ('Low', 'Medium', 'High', 'Extreme')),
  precedent_count             int
                              check (precedent_count is null or precedent_count >= 0),

  source_upload_id            uuid references uploads(id) on delete set null,
  updated_at                  timestamptz not null default now(),

  unique (org_id, portfolio_id, code)
);

create index if not exists jurisdiction_lgd_org_portfolio_idx
  on jurisdiction_lgd_overlays(org_id, portfolio_id);

alter table jurisdiction_lgd_overlays enable row level security;

drop policy if exists jurisdiction_lgd_select on jurisdiction_lgd_overlays;
create policy jurisdiction_lgd_select on jurisdiction_lgd_overlays
  for select to authenticated using (true);
drop policy if exists jurisdiction_lgd_insert on jurisdiction_lgd_overlays;
create policy jurisdiction_lgd_insert on jurisdiction_lgd_overlays
  for insert to authenticated with check (true);
drop policy if exists jurisdiction_lgd_update on jurisdiction_lgd_overlays;
create policy jurisdiction_lgd_update on jurisdiction_lgd_overlays
  for update to authenticated using (true) with check (true);
