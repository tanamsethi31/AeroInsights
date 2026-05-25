-- ─── IFRS-9 ECL parameters ingestion (T-1.5) ───────────────────────────────
-- One row per (org_id, portfolio_id). Captures the scalar parameters that
-- drive the ECL calculation engine: discount rate, flat LGD, lifetime-PD
-- multipliers, scenario weights.
--
-- These values flow from the Excel "IFRS 9 ECL" sheet:
--   • Discount rate     — row 2, explicit label.
--   • Flat LGD          — stage summary section, "Effective LGD" column
--                         (45% across stages in the sample workbook).
--   • PD multipliers    — encoded only in the footer note in v2026 of the
--   • Scenario weights    template; parser defaults to documented values
--                         until the template adds explicit cells.
--
-- The Settings → Model Params tab (currently decorative) will read/write
-- this row in a follow-up slice; that work doesn't block ingestion.

create table if not exists ifrs9_parameters (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references organisations(id) on delete cascade,
  portfolio_id                uuid not null references portfolios(id)    on delete cascade,

  -- ── Discounting ──────────────────────────────────────────────────────────
  -- Effective interest rate used to discount lifetime ECL cash flows. Stored
  -- as a fraction (0.0575 = 5.75%). Bounds enforce sanity, not policy.
  discount_rate               numeric(6,5) not null default 0.05
                              check (discount_rate >= 0 and discount_rate < 1),

  -- ── LGD ──────────────────────────────────────────────────────────────────
  -- Flat LGD applied when per-lease LGD is not specified. The aviation
  -- industry baseline is 45% (= 0.45). Tenant can override per portfolio.
  lgd_flat                    numeric(6,5) not null default 0.45
                              check (lgd_flat >= 0 and lgd_flat <= 1),

  -- ── Lifetime PD construction ─────────────────────────────────────────────
  -- Stage 2: lifetime PD = 12-month PD × multiplier_s2 (default 3.0).
  pd_lifetime_multiplier_s2   numeric(6,3) not null default 3.0
                              check (pd_lifetime_multiplier_s2 >= 1.0),
  -- Stage 3: lifetime PD is floored at this value (default 0.85). Captures
  -- the empirical observation that Stage 3 leases recover < 15% of value.
  pd_lifetime_s3_floor        numeric(6,5) not null default 0.85
                              check (pd_lifetime_s3_floor >= 0 and pd_lifetime_s3_floor <= 1),

  -- ── Scenario weights ─────────────────────────────────────────────────────
  -- Must sum to 1.0 (enforced at application layer rather than CHECK so
  -- intermediate UI edits don't trip the constraint).
  scenario_weight_baseline    numeric(5,4) not null default 0.60,
  scenario_weight_adverse     numeric(5,4) not null default 0.25,
  scenario_weight_upside      numeric(5,4) not null default 0.15,

  source_upload_id            uuid references uploads(id) on delete set null,
  updated_at                  timestamptz not null default now(),

  unique (org_id, portfolio_id)
);

create index if not exists ifrs9_parameters_org_portfolio_idx
  on ifrs9_parameters(org_id, portfolio_id);

alter table ifrs9_parameters enable row level security;

drop policy if exists ifrs9_parameters_select on ifrs9_parameters;
create policy ifrs9_parameters_select on ifrs9_parameters
  for select to authenticated using (true);
drop policy if exists ifrs9_parameters_insert on ifrs9_parameters;
create policy ifrs9_parameters_insert on ifrs9_parameters
  for insert to authenticated with check (true);
drop policy if exists ifrs9_parameters_update on ifrs9_parameters;
create policy ifrs9_parameters_update on ifrs9_parameters
  for update to authenticated using (true) with check (true);
