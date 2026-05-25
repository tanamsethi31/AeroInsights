# Aeroinsights Roadmap — Phases 0–6

**Goal:** Turn this codebase from a half-finished React app with mocked data into a complete, end-to-end SaaS platform that ingests a tenant's Excel portfolio, performs real IFRS-9 ECL analysis, persists scenario runs, generates audit-ready reports, and operates with proper RBAC and observability.

**Format:** Each task has a stable ID (e.g. `T-0.2`), a phase, current status, files affected, dependencies, and a "why" link to PRD section or ADR.

**Status values:** `DONE` · `IN_PROGRESS` · `TODO` · `BLOCKED`

**See also:** [PROGRESS.md](./PROGRESS.md) for daily tracker · [ADR-001](./ADR-001-backend-architecture.md) for backend decision · [PRD.md](./PRD.md) for product requirements.

---

## Phase 0 — Architectural Decisions

Establishes the foundations every subsequent phase inherits. Must be completed first.

### T-0.1 — Decide and execute backend architecture
- **Status:** DONE (2026-05-24)
- **Files affected:** `backend/` (deleted, 3,639 LOC), `src/app/services/api.ts` (deleted), `packages/excel-addin/README.md`, `docs/ADR-001-backend-architecture.md`
- **Depends on:** none
- **Why:** Two parallel data layers (Supabase + unused FastAPI) caused "is this real or fake?" confusion. ADR-001 standardised on Supabase + Vercel Functions.
- **Outcome:** −4,145 lines net, single source of truth, ADR captured.

### T-0.2 — Consolidate import flows
- **Status:** DONE (2026-05-24)
- **Files affected:** `src/app/components/import/ImportWizard.tsx` (deleted, 1226 LOC), `src/app/components/portfolios/UploadWizard.tsx` (deleted, 1134 LOC), `src/app/pages/Settings.tsx`, `src/app/pages/PortfolioHub.tsx`
- **Depends on:** T-0.1
- **Why:** Survey found **three** wizards, not two: `import/ImportWizard.tsx` (used by Settings, no Supabase write — façade); `upload/UploadWizard.tsx` (real, 3-step drop → map → review, writes via `ReviewImportStep.tsx`); and `portfolios/UploadWizard.tsx` (broken since T-0.1 — still posting to `localhost:8000/api/v1` against the deleted FastAPI). Settings's "Import" button silently did nothing; PortfolioHub's "Upload Your Portfolio" card was hitting a dead endpoint.
- **Outcome:** Both dead wizards deleted (−2360 LOC). `upload/UploadWizard` is now the single canonical wizard; Settings and PortfolioHub both invoke it with `orgId` from `DataContext`. Production bundle dropped from 1521 kB → 1471 kB (−50 kB).

### T-0.4 — Python scenarios engine (preemptive reversal-condition build)
- **Status:** DONE (2026-05-24)
- **Files affected:** `api/scenarios/run.py`, `api/scenarios/requirements.txt`, `api/scenarios/test_parity.py`, `src/app/services/scenarioEngine.ts`, `src/app/pages/Scenarios.tsx`, `docs/ADR-001-backend-architecture.md`
- **Depends on:** T-0.1
- **Why:** ADR-001 listed `/api/scenarios/run.py` as a future reversal condition once Monte Carlo client-side compute exceeded ~2 s. Discovered during the build that the existing client-side MC was theatrical (no actual path simulation — just multiplying ECL by fixed factors). Building the Python function now turns Monte Carlo from a cosmetic feature into a real one AND establishes the precedent for any future Python compute. Still a single function, not a service — does not reverse the broader ADR.
- **Outcome:** Vectorised NumPy MC, 8/8 parity tests pass, 50k paths in <1 s, deterministic stays client-side, graceful fallback when server unreachable.

### T-0.5 — Per-lease IFRS-9 ECL engine on Supabase (preemptive reversal-condition build)
- **Status:** DONE (2026-05-24)
- **Files affected:** `api/risk-engine/engine.py`, `api/risk-engine/compute.py`, `api/risk-engine/supabase_client.py`, `api/risk-engine/test_engine.py`, `api/risk-engine/requirements.txt`, `api/risk-engine/README.md`
- **Depends on:** T-0.1
- **Why:** ADR-001 listed "rebuild fresh against the actual Supabase schema, not the stale Alembic one" as the second reversal condition. Built preemptively (no Python team to hire — agent built it directly) so the per-lease compute primitive exists when Phase 3 persistence tasks need it. Sibling to T-0.4 (macro scenarios engine on scalar baseline); this one builds the baseline by reading the live Supabase portfolio and running per-lease PD × LGD × EAD.
- **Outcome:** Vercel Python Function at `/api/risk-engine/compute`. Pure compute in `engine.py` (no I/O, importable, testable). 5/5 unit tests pass without network. Reads 6 Supabase tables (`assets`, `lessees`, `leases`, `provisions`, `pd_curve_overrides`, `lgd_recovery_overrides`), aggregates per-stage totals + book value + coverage %, optionally writes to `ecl_period_snapshots`. Auth via interim `X-Org-Id` header with explicit `TODO(T-4.1)` markers. Does **not** reverse ADR-001 — still single functions, not a service.
- **Known gaps mapped to follow-up tasks:** T-1.5 (IFRS-9 param ingestion · linear vs survival PD), T-1.6 (SICR triggers · naive stage assignment), T-3.1/T-3.2 (per-lease writeback), T-3.4 (audit-log emission on snapshot writes), T-4.1 (JWT-based auth), T-5.4 (currency conversion · assumes USD). See `api/risk-engine/README.md` § Known gaps.

### T-0.3 — Canonicalize Portfolio vs Org scoping
- **Status:** DONE (2026-05-24, Phase A only — Phase B/C continue inside Phase 1)
- **Files affected:** `docs/ADR-002-multi-portfolio-scoping.md`, `supabase/migrations/20260524120000_portfolios_table.sql`, `src/app/contexts/PortfolioContext.tsx`, `src/app/pages/PortfolioHub.tsx`, `src/app/pages/Settings.tsx`, `src/app/components/upload/UploadWizard.tsx`, `src/app/components/upload/ReviewImportStep.tsx`
- **Depends on:** T-0.1
- **Why:** Investigation revealed (a) NO `portfolios` table existed — my earlier claim was wrong; (b) `PortfolioContext` was pure in-memory state; (c) `PortfolioHub.tsx` was the THIRD hidden FastAPI-removal bug, hitting `${API_BASE}/portfolios` on `localhost:8000/api/v1`. PRD demands multi-portfolio per tenant (balance-sheet / ABS / JV / sandbox); real customers need analytical scope tighter than org. ADR-002 captures the decision and a 3-phase roll-out so the schema gets `portfolio_id` for free during the Phase 1 ingestion migrations instead of expensive retrofits.
- **Outcome (Phase A):** `portfolios` table live in Supabase (with backfill of a "Default Portfolio" per org). `uploads.portfolio_id` column added + indexed. `PortfolioContext` persists active selection to localStorage so refresh survives. `PortfolioHub` reads from Supabase instead of dead FastAPI. `UploadWizard` creates a new portfolio at first import (named after the file) and reports the new id via `onComplete` so PortfolioHub can set it active. ADR-002 documents Phase B (per-table column additions during Phase 1 ingestion migrations) and Phase C (~129 hook query rewrites at Phase 1 close).

---

## Phase 1 — Full Excel Ingestion

The sample portfolio Excel (`AeroInsights_SamplePortfolio_2026.xlsx`) has 14 sheets and 70+ data points. Today the importer reads only the Lease Register sheet (11 columns). Every other sheet — Aircraft Register, Lessee Profiles, SD+MR balances, IFRS-9 ECL parameters, SICR triggers, Stress Scenarios, Jurisdiction LGD overlays — is left on the floor.

### T-1.1 — Multi-sheet Excel parser
- **Status:** DONE (2026-05-24)
- **Files affected:** `src/app/utils/excelParser.ts` (new, 380 LOC), `src/app/components/upload/MultiSheetReviewStep.tsx` (new, 250 LOC), `src/app/components/upload/UploadWizard.tsx`
- **Depends on:** T-0.2
- **Why:** Sample portfolio Excel has 14 sheets; today we ingest 1. The parser detects canonical sheet names (Aircraft Register, Lessee Profiles, Lease Register, Security Deposits+MR, IFRS 9 ECL, SICR Triggers, Stress Scenarios, Jurisdiction LGD), tolerates banner rows (header detection picks the first short-distinct-text row), and dispatches each to a typed handler.
- **Outcome:** `parseWorkbook(file)` returns `ParsedWorkbook { sheets, sheetNames, recognisedSheets, unknownSheets }`. `detectCanonical(file)` is a header-only probe used by the UploadWizard to skip the column-mapping step for canonical workbooks. Three sheet handlers shipped (Lessee Profiles full live; Aircraft Register + Lease Register parsed for preview, ingest in next slice). T-1.4–T-1.8 handlers stub in place with stable shapes so future slices land without touching the parser entry.

### T-1.2 — Ingest Lessee Profiles sheet
- **Status:** DONE (2026-05-24)
- **Files affected:** `supabase/migrations/20260524130000_lessee_profiles_ingest.sql`, `src/app/services/portfolioIngest.ts` (new, 180 LOC), `src/app/utils/excelParser.ts`, `src/app/components/upload/MultiSheetReviewStep.tsx`
- **Depends on:** T-1.1
- **Why:** Lessee Profiles sheet carries country, region, credit rating, PD estimate, watchlist, IFRS-9 stage, DPD days, rating notches down, country watchlist, insolvency flag, behaviour scores (punctuality / restructuring coop / govt interference / litigation), overall behaviour score, pay-behaviour tier. Today hardcoded in `intelligenceData.ts` for fictitious lessees; this migration + ingest path replaces it with live data.
- **Outcome:** Migration applied live via Supabase MCP. `lessees` table extended with 14 new columns (external_id, region, stage, dpd_days, rating_notches_down, country_watchlist, insolvency_filed, 5 behaviour scores, pay_behaviour_tier) PLUS the first analytical-table `portfolio_id NOT NULL` (ADR-002 Phase B begins). Unique index `(org_id, portfolio_id, external_id)` enables T-1.10 re-import upsert. Ingester `ingestLessees()` upserts by `external_id` (`onConflict`), straight-inserts rows without `external_id`. UploadWizard's MultiSheetReviewStep wires the full path end-to-end with per-sheet UI counts.
- **Unlocks:** T-2.4 (real counterparty profiles)

### T-1.2 — Ingest Lessee Profiles sheet
- **Status:** TODO
- **Files affected:** `supabase/migrations/` (new migration for `lessee_profiles` table), `src/app/hooks/usePortfolioData.ts`, `src/app/components/counterparties/`
- **Depends on:** T-1.1
- **Why:** Lessee Profiles sheet contains: country, credit rating, PD estimate, watchlist status, DPD days, rating notches down, country watchlist, insolvency filed, behaviour scores (punctuality / restructuring cooperation / government interference / litigation propensity), overall behaviour score, pay behaviour tier. Today these are hardcoded in `intelligenceData.ts` for fictitious lessees.
- **Estimated effort:** 2 days
- **Unlocks:** T-2.4 (real counterparty profiles)

### T-1.3 — Ingest Aircraft Register sheet fully
- **Status:** DONE (2026-05-24) — assets table; leases ingest pending next slice
- **Files affected:** `supabase/migrations/20260524140000_aircraft_register_ingest.sql`, `src/app/services/portfolioIngest.ts`, `src/app/utils/excelParser.ts` (handler already shipped in T-1.1), `src/app/components/upload/MultiSheetReviewStep.tsx`, `src/app/types/portfolio.ts`, `src/app/data/mockPortfolioData.ts`
- **Depends on:** T-1.1
- **Why:** Aircraft Register sheet carries registration, MSN, type, manufacturer, vintage, family, operator, country, current MV, EAD, monthly rent, lease term remaining, part-out value. Previously we ingested ~5 of 16 cols. Fleet tab + valuation panel + IAS-36 impairment recoverable-amount logic need the full picture.
- **Outcome:** Migration applied live via Supabase MCP. `assets` table extended with 7 new columns (external_id, family, country, stage, current_mv_usd, part_out_usd) + ADR-002 Phase B `portfolio_id NOT NULL` with backfill. Two partial unique indexes: `(org_id, portfolio_id, external_id)` for rows with AC ID, `(org_id, portfolio_id, msn)` for rows without. `ingestAircraft()` upserts on the appropriate key. `MultiSheetReviewStep` flips Aircraft Register from "ready" to "live". Demo MOCK_ASSETS seeded with realistic family/country/stage/current MV/part-out so the Fleet tab works on mock data too. EAD / monthly rent / lease term remaining are lease-level facts (next slice).

### T-1.4 — Ingest Security Deposits and Maintenance Reserves (also closes Lease Register ingest)
- **Status:** DONE (2026-05-24)
- **Files affected:** `supabase/migrations/20260524150000_sd_mr_ingest.sql`, `src/app/utils/excelParser.ts`, `src/app/services/portfolioIngest.ts`, `src/app/types/portfolio.ts`, `src/app/data/mockPortfolioData.ts`, `src/app/components/upload/MultiSheetReviewStep.tsx`
- **Depends on:** T-1.1, T-1.2, T-1.3
- **Why:** The Excel "Security Deposits+MR" sheet has TWO sections (A. SECURITY DEPOSITS with one row per lease; B. MAINTENANCE RESERVES with one row per (lease, component) pair). The Portfolio → SD/MR tab today estimates these via `maintenanceHeuristics.ts`. Live data eliminates estimates. Slice also closes the Lease Register ingest pending from T-1.3 since SD/MR FKs to lease_id.
- **Outcome:** Migration applied live via Supabase MCP. `leases` extended: `portfolio_id NOT NULL` (ADR-002 Phase B continued), `external_id`, `jurisdiction`, `status`. Two new tables: `security_deposits` (unique per `(org_id, portfolio_id, lease_id)`) and `maintenance_reserves` (unique per `(org_id, portfolio_id, lease_id, component)`). Both have RLS + indexes. Parser handler `parseSdMrSheet()` walks raw rows, splits at "B. MAINTENANCE RESERVES" banner, and runs two header-aware passes. Three new ingesters (`ingestLeases`, `ingestSecurityDeposits`, `ingestMaintenanceReserves`) chained into the dependency-ordered orchestrator after lessees + aircraft. MOCK_LEASES seeded with `external_id` / `jurisdiction` matching the sample workbook. MultiSheetReviewStep now flips Lease Register + Security Deposits + Maintenance Reserves all to "live" — five of eight canonical sheets are now end-to-end live.

### T-1.5 — Ingest IFRS 9 ECL parameters
- **Status:** DONE (ingest, 2026-05-24) — Settings UI rewire to read/write this row deferred to next slice
- **Files affected:** `supabase/migrations/20260524160000_ifrs9_parameters.sql`, `src/app/utils/excelParser.ts`, `src/app/services/portfolioIngest.ts`, `src/app/components/upload/MultiSheetReviewStep.tsx`
- **Depends on:** T-1.1
- **Why:** The Excel "IFRS 9 ECL" sheet is laid out as a calculation worksheet, not a parameter table — the INPUT values are scattered (discount rate at top, flat LGD in stage summary, scenario weights + lifetime-PD multipliers in a prose footer). Today Settings → Model Parameters is decorative. This slice creates the persistence and ingestion path; the Settings UI rewire to read/write the new row happens next.
- **Outcome:** Migration applied live via Supabase MCP. New `ifrs9_parameters` table with one row per `(org_id, portfolio_id)` carrying discount_rate, lgd_flat, pd_lifetime_multiplier_s2, pd_lifetime_s3_floor, and three scenario weights (baseline / adverse / upside), all with sensible defaults + CHECK bounds. Parser `parseIfrs9Sheet()` extracts discount_rate from the explicit row + median LGD from the stage summary section; defaults to documented values for weights/multipliers (still footer-encoded in v2026 of the template) and surfaces a soft warning in `_errors` when defaults are used. New `ingestIfrs9Params()` upserts the one row per (org, portfolio). MultiSheetReviewStep shows IFRS 9 ECL parameters as a single-row "live" sheet — total 6 of 8 canonical sheets now end-to-end.

### T-1.6 — Ingest SICR triggers configuration
- **Status:** DONE (ingest, 2026-05-24) — RiskECL → SICR Config tab rewire to read/write this row deferred to next slice
- **Files affected:** `supabase/migrations/20260524170000_sicr_config.sql`, `src/app/utils/excelParser.ts`, `src/app/services/portfolioIngest.ts`, `src/app/components/upload/MultiSheetReviewStep.tsx`
- **Depends on:** T-1.1
- **Why:** The Excel "SICR Triggers" sheet encodes the config as 6 label/value pairs spread across row 2; the rest of the sheet is OUTPUT (per-lessee SICR evaluation), which is recomputable server-side from this config + already-ingested lessee columns. Today the SICR Config tab is read-only with hardcoded values.
- **Outcome:** Migration applied live via Supabase MCP. New `sicr_config` table with one row per `(org_id, portfolio_id)` carrying dpd_enabled, dpd_threshold_days, rating_notches_threshold, country_watchlist_enabled, insolvency_filing_enabled, upgrade_threshold_notches — all with documented defaults + CHECK bounds. Parser `parseSicrSheet()` walks the row 2 label/value pairs and pulls integers from "30 days" / "≥ 2" / "2 notches" via a small regex helper. Ingester `ingestSicrConfig()` upserts one row per (org, portfolio). Status flipped to live in MultiSheetReviewStep. **7 of 8 canonical sheets** now end-to-end.

### T-1.7 — Ingest Stress Scenarios sheet
- **Status:** DONE (ingest, 2026-05-24) — Scenarios.tsx swap from hardcoded `SCENARIO_LIBRARY` to DB queries deferred to a follow-up
- **Files affected:** `supabase/migrations/20260524180000_stress_scenarios.sql`, `src/app/utils/excelParser.ts`, `src/app/services/portfolioIngest.ts`, `src/app/components/upload/MultiSheetReviewStep.tsx`
- **Depends on:** T-1.1
- **Why:** The Excel "Stress Scenarios" sheet has three sections: A. Macro Scenario Inputs (TRANSPOSED — cols=scenarios, rows=parameters), B. Restructuring Presets (standard table), C. ECL Outputs (computed, skipped). Today the hardcoded `SCENARIO_LIBRARY` array in `intelligenceData.ts` drives the scenarios engine. This slice gives tenants per-portfolio scenario seeding from Excel + DB persistence.
- **Outcome:** Migration applied live via Supabase MCP. Two new tables — `stress_scenarios` (one row per scenario with 12 macro/PD/deferral columns + weight + slug) and `restructuring_presets` (one row per preset with deferral/govt/forgiveness columns) — both `(org_id, portfolio_id)` scoped with unique-on-slug, RLS, indexes. Parser `parseStressScenariosSheet()` pivots the transposed macro section back to one-row-per-scenario, parses both B and C section boundaries by detecting "A.", "B.", "C." banner prefixes, strips "×" suffix from PD multipliers via `stripMultiplier()`. Two new ingesters upsert on (org, portfolio, slug). Both flipped to "live" in MultiSheetReviewStep.

### T-1.8 — Ingest Jurisdiction LGD overlays
- **Status:** DONE (ingest, 2026-05-24) — Jurisdictions tab rewire from hardcoded `jurisdictionData.ts` deferred to follow-up
- **Files affected:** `supabase/migrations/20260524190000_jurisdiction_lgd_overlays.sql`, `src/app/utils/excelParser.ts`, `src/app/services/portfolioIngest.ts`, `src/app/components/upload/MultiSheetReviewStep.tsx`
- **Depends on:** T-1.1
- **Why:** The Excel "Jurisdiction LGD" sheet carries CTC score, Alt-A, IDERA, enforceability, rule of law, P50/P90 repossession months, P50 cost %, success probability, LGD delta vs US §1110, uncertainty band, precedent count per jurisdiction. Today `jurisdictionData.ts` has these hardcoded for ~24 countries.
- **Outcome:** Migration applied live via Supabase MCP. New table `jurisdiction_lgd_overlays` with 16 columns per row, scoped `(org_id, portfolio_id)`, unique on code, RLS + index. Parser `parseJurisdictionLgdSheet()` stops at the "KEY PRECEDENTS" banner (precedent case history gets its own table in a follow-up — different shape, nested narrative). Ingester upserts on `(org, portfolio, code)`. Status flipped to "live" in MultiSheetReviewStep. **All 8 of 8 canonical sheets are now end-to-end ingested.**

### T-1.9 — Validation and dry-run flow
- **Status:** DONE (2026-05-24)
- **Files affected:** `src/app/services/portfolioIngest.ts` (new `previewIngest`), `src/app/components/upload/MultiSheetReviewStep.tsx`
- **Depends on:** T-1.1
- **Why:** Pre-commit row-by-row check, errors surfaced in UI with row-level detail.
- **Outcome:** Per-sheet preview table now has expandable error rows — click any sheet with parser errors to see row index + error message detail for up to 50 rows. Invalid rows clearly flagged as "will be skipped on commit". Soft warnings from the IFRS-9 / SICR scalar parsers also surface (e.g. "DPD threshold missing — defaulting to 30 days"). User can fix in Excel and re-upload before committing.

### T-1.10 — Re-import and merge with prior data
- **Status:** DONE (first cut, 2026-05-24) — universal audit-log entry deferred to T-3.4
- **Files affected:** `src/app/services/portfolioIngest.ts` (new `previewIngest`), `src/app/components/upload/MultiSheetReviewStep.tsx`
- **Depends on:** T-1.1
- **Why:** Tenant uploads a new monthly file → system computes diff against prior data and presents changes BEFORE commit. The "monthly close" workflow described in PRD §3.3 Persona 1.
- **Outcome:** `previewIngest()` runs after parse when `portfolioId` is set (re-import path), queries existing rows by each ingester's unique key (`external_id` / `slug` / `code`) and returns per-sheet `{ new, update, invalid }` counts. New "New" + "Update" columns in the preview table show what will change; summary line totals it. Fresh-portfolio imports skip diff and show "Fresh import — new portfolio will be created". Per-field deep diff + audit-log persistence wait for T-3.4 (universal audit log).

---

## Phase 2 — Replace Hardcoded Intelligence with Portfolio-Driven Data

Today the Intelligence tab shows IndiGo, Aeromexico, SriLankan etc. regardless of who is logged in. Replace with tenant's actual uploaded portfolio.

### T-2.1 — Lessee Radar driven by real lessees
- **Status:** TODO
- **Files affected:** `src/app/data/intelligenceData.ts` (deprecate `LESSEE_RADAR`), `src/app/pages/Intelligence.tsx`, `src/app/services/lesseeRadarService.ts` (new)
- **Depends on:** T-1.2
- **Why:** Today `LESSEE_RADAR` is a hardcoded array of fictitious lessees with fake load factors and schedule stability. Replace with: for each lessee in tenant's portfolio, derive operational metrics from ingested behaviour scores OR external feeds (CAPA/OAG when licensed).
- **Estimated effort:** 3 days

### T-2.2 — Deal Feed personalisation
- **Status:** TODO
- **Files affected:** `src/app/services/useNewsFeed.ts` (`PORTFOLIO_LESSEES` hardcoded array), `api/signals/news.ts`
- **Depends on:** T-1.2
- **Why:** `useNewsFeed.ts` line 32 has `PORTFOLIO_LESSEES = ["IndiGo", "Aeromexico", ...]` hardcoded. Replace with the live list of lessees from tenant's portfolio so news matching is real.
- **Estimated effort:** 1 day

### T-2.3 — Jurisdiction Watch driven by portfolio
- **Status:** DONE (Jurisdictions tab data wire, 2026-05-24) — news-feed jurisdiction events tab still uses hardcoded JURISDICTION_EVENTS; that piece moves into Phase 2 closeout when news enrichment lands.
- **Files affected:** `src/app/hooks/useJurisdictions.ts` (new), `src/app/pages/Jurisdictions.tsx`
- **Depends on:** T-1.8
- **Why:** Jurisdictions tab read 24 hardcoded country profiles from `jurisdictionData.ts`. Now overlays ingested `jurisdiction_lgd_overlays` rows on top of the hardcoded baseline.
- **Outcome:** `useJurisdictions()` hook fetches DB rows for the active portfolio and `mergeJurisdictions()` overlays them on the hardcoded baseline (numeric fields like CTC score, enforceability, repossession months, success prob, precedent count all come from DB when present; narrative + flag + sanctions text stay from baseline because the DB schema doesn't track them yet). DB-only country codes get synthesised entries with a 🌐 flag. Subtitle indicates "overlaid with your portfolio data" when DB has rows. Jurisdictions page rebuild auto-reflects re-imports. Other consumers (LeaseGenerator, LeasePricingTab, RestructuringTab, exportService) still read the raw `jurisdictions` const directly — they'll migrate to the hook in a follow-up pass.

### T-2.4 — Real counterparty profile generation
- **Status:** DONE (first cut, 2026-05-24) — full deletion of hardcoded `LESSEE_PROFILE` deferred until T-1.3 / T-1.4 / scenario history per lessee land
- **Files affected:** `src/app/types/portfolio.ts`, `src/app/data/mockPortfolioData.ts`, `src/app/pages/Counterparties.tsx`, `src/app/components/counterparties/SimpleLesseePanel.tsx`
- **Depends on:** T-1.2
- **Why:** Today 6 hardcoded `LESSEE_PROFILE` objects exist (IndiGo, Aeromexico, Aer Lingus, etc.) with rich timelines, behaviour scores, restructuring history. Any other uploaded lessee got the degraded `SimpleLesseePanel`. With T-1.2 schema live, the panel now reads real ingested columns instead of zeros.
- **Outcome:** `SimpleLesseePanel` upgraded — renders Behaviour Scores card (4 bars + overall), SICR Signals card (DPD chip, rating drift, country watchlist, insolvency filed), pay-behaviour tier pill, region annotation, intelligence-source footer. Placeholder ("not yet ingested") only shows when no T-1.2 data is present. `Counterparties.tsx` reverses the panel-selection priority: lessees WITH ingested behaviour scores get `SimpleLesseePanel`; only lessees WITHOUT data fall back to the hardcoded `LesseeProfilePanel`. Demo `MOCK_LESSEES` seeded with realistic behaviour values so the demo experience matches the upload experience.
- **Remaining (next cuts):** Restructuring history timeline (T-1.3 needs to ingest lease event data), per-lessee scenario history (T-3.1 dependent), drop the hardcoded LESSEE_PROFILE fixture entirely.

### T-2.5 — Real sanctions screening
- **Status:** TODO
- **Files affected:** `src/app/data/sanctionsData.ts` (deprecate), `api/sanctions/screen.ts` (new), `supabase/migrations/` (new `sanctions_hits` table), `src/app/pages/Counterparties.tsx`
- **Depends on:** T-1.2
- **Why:** Today `sanctionsData.ts` is fully hardcoded with fake OFAC entries. Build a Vercel function that fetches OFAC SDN XML daily, computes fuzzy matches against tenant lessees, persists to `sanctions_hits`. Wire to Fleet Sanctions Tracker.
- **Estimated effort:** 4 days

### T-2.6 — Real aircraft valuation source
- **Status:** TODO
- **Files affected:** `src/app/components/portfolio/AircraftValuationPanel.tsx` (`valuationData` is hardcoded), `supabase/migrations/` (new `aircraft_valuations` table)
- **Depends on:** T-1.3
- **Why:** `valuationData` in `AircraftValuationPanel.tsx` is fully hardcoded. Options: (a) accept user-uploaded valuation columns from Excel, (b) integrate AVAC/IBA API (paid), (c) make manual-input workflow with full audit trail. Recommend (a) + (c) initially.
- **Estimated effort:** 3 days

---

## Phase 3 — Persistence and Immutable Audit Trail

This is what makes the IFRS-9 audit claim real. Today scenario runs vanish on refresh; ECL snapshots are calculated but never stored; report exports leave no trace.

### T-3.1 — Persist scenario runs
- **Status:** TODO
- **Files affected:** `supabase/migrations/` (new `scenario_runs` table), `src/app/pages/Scenarios.tsx` (Custom Builder + Run History)
- **Depends on:** T-0.3
- **Why:** Today scenario runs computed client-side, never persisted. Run History tab shows in-memory array — survives nothing. Build `scenario_runs(id, org_id, portfolio_id, scenario_id, mode, inputs JSONB, result JSONB, parent_run_id, run_at, run_by)`. Write on every run. Run History reads from here. Survives refresh.
- **Estimated effort:** 2 days

### T-3.2 — Persist ECL period snapshots
- **Status:** TODO
- **Files affected:** `src/app/pages/RiskECL.tsx`, `src/app/utils/eclCalculator.ts`
- **Depends on:** T-3.1, T-1.5
- **Why:** The `ecl_period_snapshots` table exists with an immutability trigger but is never written to. Wire a "Close Period" action that snapshots the entire ECL state.
- **Estimated effort:** 1 day

### T-3.3 — Persist report exports
- **Status:** TODO
- **Files affected:** `supabase/migrations/` (new `report_exports` table), `src/app/services/exportService.ts`, `src/app/pages/Reports.tsx` (Export History tab)
- **Depends on:** T-0.3
- **Why:** Today reports generate XLSX/PDF in browser. No record exists. "Export History" tab is mocked. Build `report_exports(id, org_id, report_id, format, params JSONB, file_url, generated_at, generated_by)`. Upload generated files to Supabase Storage. Export History reads from here.
- **Estimated effort:** 2 days

### T-3.4 — Universal audit log
- **Status:** TODO
- **Files affected:** `supabase/migrations/` (new `audit_log` table or extend `assumption_change_log`), `src/app/pages/Settings.tsx` (Audit Log tab)
- **Depends on:** T-0.3
- **Why:** `assumption_change_log` only logs assumption edits. Extend or add new universal log: settings changes, scenario runs, report exports, lease edits, stage migrations — all write to single `audit_log(id, org_id, actor_user_id, action, entity_type, entity_id, before JSONB, after JSONB, timestamp)`.
- **Estimated effort:** 3 days

### T-3.5 — Stage migration log
- **Status:** TODO
- **Files affected:** `supabase/migrations/` (new `stage_migrations` table), `src/app/pages/RiskECL.tsx` (Stage Migration tab)
- **Depends on:** T-3.4
- **Why:** When ingestion or a scenario run changes a lease's IFRS-9 stage 1→2 or 2→3, write a row to `stage_migrations(lease_id, from_stage, to_stage, reason, signal_id, scenario_run_id, timestamp)`. PRD §8.4 requires this for the Stage Migration tab.
- **Estimated effort:** 2 days

---

## Phase 4 — Multi-tenancy and RBAC Hardening

PRD §10 defines four roles: Admin, Risk Analyst, Accounting, Read-Only. Today none are enforced in the UI.

### T-4.1 — Row-level security audit and lockdown
- **Status:** TODO
- **Files affected:** All `supabase/migrations/*.sql`
- **Depends on:** T-0.3
- **Why:** Every table must have RLS policy: `org_id = (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())`. Some tables may be wide-open today. Audit and lock down.
- **Estimated effort:** 2 days
- **Priority:** HIGH — security gap

### T-4.2 — Role enforcement in UI
- **Status:** TODO
- **Files affected:** `src/app/hooks/useRole.ts` (new), every page component, `src/app/contexts/PortfolioContext.tsx`
- **Depends on:** T-4.1
- **Why:** Roles exist in `org_memberships` table but UI doesn't gate any actions. Add `useRole()` hook and gate destructive/admin actions per PRD §10 role matrix.
- **Estimated effort:** 3 days

### T-4.3 — Per-tenant API key configuration
- **Status:** TODO
- **Files affected:** `supabase/migrations/` (new `tenant_integrations` table), `src/app/pages/Settings.tsx` (Data Sources tab), `api/signals/`
- **Depends on:** T-4.1
- **Why:** Today NewsAPI, OFAC, etc. keys are env-wide. Make per-tenant configurable so each customer brings their own keys (or uses the platform shared pool).
- **Estimated effort:** 2 days

### T-4.4 — Portfolio switching cache invalidation
- **Status:** TODO
- **Files affected:** `src/app/contexts/PortfolioContext.tsx`, all hooks under `src/app/hooks/`
- **Depends on:** T-0.3
- **Why:** When `setActivePortfolio()` changes, all hooks must re-fetch. Today some hooks may retain stale data across portfolio switches.
- **Estimated effort:** 1 day

---

## Phase 5 — Operational Layer

Alerts, scheduled reports, watchlist rules. Today all are decorative UI in Settings.

### T-5.1 — Real email alert system
- **Status:** TODO
- **Files affected:** `api/cron/alerts.ts` (new), `src/app/services/alertService.ts`, `supabase/migrations/` (new `alert_rules` table)
- **Depends on:** T-3.4, T-4.2
- **Why:** Settings UI has alert configuration but no email send. Pick provider (Resend / SendGrid / SES). Build Vercel cron `/api/cron/alerts` that runs every 30 min: re-evaluates watchlist rules, sends emails to configured recipients. Persists alert deliveries to `alert_deliveries`.
- **Estimated effort:** 4 days

### T-5.2 — Scheduled reports
- **Status:** TODO
- **Files affected:** `api/cron/scheduled-reports.ts` (new), `src/app/pages/Reports.tsx` (Scheduled tab), `supabase/migrations/` (new `scheduled_reports` table)
- **Depends on:** T-3.3, T-5.1
- **Why:** Settings UI has schedule config but no cron. Build Vercel cron that on each due date generates report, uploads to Supabase Storage, emails recipients.
- **Estimated effort:** 3 days

### T-5.3 — Watchlist rule engine
- **Status:** TODO
- **Files affected:** `src/app/services/watchlistEngine.ts` (rewrite), `supabase/migrations/` (new `watchlist_entries` table), `api/cron/watchlist-eval.ts` (new)
- **Depends on:** T-1.2, T-2.1, T-3.4
- **Why:** Today `WATCHLIST_DATA` is a static array. Build a service that evaluates each lessee against configured thresholds (DPD, rating change, news sentiment, country event) and updates `watchlist_entries` continuously. Drives alert system and dashboard badges.
- **Estimated effort:** 5 days

### T-5.4 — Live currency engine
- **Status:** TODO
- **Files affected:** `src/app/contexts/CurrencyContext.tsx`, `api/fx/rates.ts` (new), `supabase/migrations/` (new `fx_rates` table)
- **Depends on:** none
- **Why:** Today FX rates hardcoded. Pull live ECB daily FX into `fx_rates` table; all monetary computations convert through it. Daily cron job.
- **Estimated effort:** 2 days

### T-5.5 — Excel Add-in working bridge
- **Status:** TODO
- **Files affected:** `packages/excel-addin/src/`, `api/excel/*.ts` (new Vercel Functions)
- **Depends on:** T-3.1, T-3.2, T-4.1
- **Why:** Today documentation only. Build the actual `api/excel/ecl.ts`, `api/excel/stage.ts`, etc. functions so `=AERO.ECL(leaseId)` works in Excel against real tenant data. ADR-001 specifies Vercel Functions, not FastAPI.
- **Estimated effort:** 5 days

---

## Phase 6 — Quality, Observability, Compliance

### T-6.1 — Frontend service test coverage
- **Status:** TODO
- **Files affected:** `src/app/services/*.ts` test files, `src/app/utils/*.ts` test files
- **Depends on:** none
- **Why:** Extend Vitest coverage on `src/app/services/` and `src/app/utils/` to 60%+. ECL calculator, narrative service, export service are critical paths with no tests.
- **Estimated effort:** 5 days

### T-6.2 — End-to-end Playwright tests
- **Status:** TODO
- **Files affected:** `e2e/` (new directory), `playwright.config.ts` (new)
- **Depends on:** T-0.2, T-1.1
- **Why:** One critical-path test: sign-up → upload portfolio → see ECL → run scenario → export report → see in history. One test = full demo script. Run in CI.
- **Estimated effort:** 3 days

### T-6.3 — Error tracking (Sentry)
- **Status:** TODO
- **Files affected:** `src/main.tsx`, `api/**/*.ts`, `vercel.ts` (env vars)
- **Depends on:** none
- **Why:** Today exceptions are `console.error` — they vanish in production. Add Sentry to both React app and Vercel Functions.
- **Estimated effort:** 1 day

### T-6.4 — AI observability via Vercel AI Gateway
- **Status:** TODO
- **Files affected:** `src/app/services/narrativeService.ts`, `api/ai/narrative.ts`, `api/ai/chat.ts`
- **Depends on:** none
- **Why:** `/api/ai/narrative` is silent on usage/cost. Route through Vercel AI Gateway for observability, fallbacks, zero-data-retention. Per system context: prefer plain `"provider/model"` strings via Gateway by default.
- **Estimated effort:** 1 day

### T-6.5 — Data retention and tenant deletion
- **Status:** TODO
- **Files affected:** `api/tenant/delete.ts` (new), `src/app/pages/Settings.tsx`, `supabase/migrations/` (cascade rules)
- **Depends on:** T-4.1
- **Why:** Tenant offboarding flow: delete all `org_id`-scoped rows, purge Storage, audit-log the deletion. GDPR + contractual requirement for B2B SaaS.
- **Estimated effort:** 2 days

### T-6.6 — Security baseline (SOC-2 prep)
- **Status:** TODO
- **Files affected:** `.github/workflows/security.yml` (new), `docs/RUNBOOK.md` (new)
- **Depends on:** T-6.3
- **Why:** Dependency vulnerability scanning (`npm audit` flagged 3 vulns last build), incident response runbook, backup verification, secret rotation policy.
- **Estimated effort:** 3 days

---

## Total Effort Estimate

- Phase 0: ~4 days (1 done)
- Phase 1: ~20 days
- Phase 2: ~17 days
- Phase 3: ~10 days
- Phase 4: ~8 days
- Phase 5: ~19 days
- Phase 6: ~15 days

**Total: ~93 engineer-days (~19 weeks for one engineer, ~10 weeks for two).**

## Critical Path

T-0.1 → T-0.2 → T-1.1 → T-1.2 → T-2.4 (real lessee profiles — biggest demo unlock) → T-3.1 (persist scenarios — biggest audit unlock) → T-4.2 (RBAC — biggest security unlock) → T-5.1 (alerts — biggest operational unlock)
