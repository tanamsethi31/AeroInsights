# Progress Tracker

**Last updated:** 2026-05-24

## Snapshot

| Phase | Total Tasks | Done | In Progress | Todo | % Complete |
|---|---|---|---|---|---|
| 0 | 5 | 5 | 0 | 0 | 100% |
| 1 | 10 | 0 | 0 | 10 | 0% |
| 2 | 6 | 0 | 0 | 6 | 0% |
| 3 | 5 | 0 | 0 | 5 | 0% |
| 4 | 4 | 0 | 0 | 4 | 0% |
| 5 | 5 | 0 | 0 | 5 | 0% |
| 6 | 6 | 0 | 0 | 6 | 0% |
| **Total** | **41** | **5** | **0** | **36** | **12.2%** |

## Completed Tasks

### T-0.3 — Canonicalize Portfolio vs Org scoping (Phase A, 2026-05-24)
- **Discovery during survey:** zero `portfolios` table existed (my prior claim was wrong); `PortfolioContext` was pure in-memory; `PortfolioHub.tsx` still pointed at `${API_BASE}/portfolios` on dead FastAPI — **third hidden FastAPI bug closed**.
- ADR-002 written documenting "many portfolios per tenant" decision with a 3-phase rollout (A: schema + minimal wiring now; B: per-table `portfolio_id` columns during Phase 1 ingestion migrations; C: ~129 hook query rewrites at Phase 1 close).
- Migration `20260524120000_portfolios_table.sql` applied to live Supabase via MCP: created `portfolios` table (id, org_id, name, kind in (live/sandbox/abs/jv), slug, archived_at) with RLS, added `uploads.portfolio_id` with FK + backfilled existing rows to a per-org "Default Portfolio", added compound `(org_id, portfolio_id)` index on `uploads`.
- `PortfolioContext` now persists `activePortfolioId` to localStorage so refresh survives.
- `PortfolioHub.tsx` reads `portfolios` table from Supabase (not dead FastAPI).
- `UploadWizard` + `ReviewImportStep` extended with optional `portfolioId` prop. When absent (first-time onboarding), they create a new portfolio named after the file and report the new id via `onComplete(uploadId, count, portfolioId)`. PortfolioHub uses that to set the new portfolio active before redirecting to dashboard.

### T-0.5 — Per-lease IFRS-9 ECL engine on Supabase (2026-05-24)
- Sibling to T-0.4. Delegated to a `general-purpose` subagent with a self-contained prompt; agent honoured every constraint (no edits outside `api/risk-engine/`, no commit, no deploy, lazy-import `supabase` so tests run on minimal env).
- 6 files created in `api/risk-engine/` (~1231 LOC total): `engine.py` (pure compute, 345 LOC), `compute.py` (handler + orchestration, 230 LOC), `supabase_client.py` (read/write wrapper, 170 LOC), `test_engine.py` (5 tests, 275 LOC, no pytest required), `requirements.txt` (numpy + supabase), `README.md` (209 LOC).
- 5/5 unit tests pass when I re-ran them via the uv-managed Python: `default_pd_for_segment_monotonic`, `compute_lease_ecl_arithmetic`, `compute_lease_ecl_falls_back_to_default_pd`, `compute_portfolio_ecl_aggregates_three_leases`, `stage_totals_sum_to_total_ecl`.
- Verified `carrier_segment` column exists in `lessees` (added by migration `20260523113150_aviation_pd_curves.sql`); `current_operator` on `assets` and `reporting_date` on `provisions` also confirmed. No invented schema.
- Health probe never 500s on missing env vars — returns `{"ok": false, "reason": "..."}` cleanly so a Vercel deploy without `SUPABASE_*` env vars still passes the readiness check.
- Known gaps explicitly mapped to roadmap tasks in `api/risk-engine/README.md` — does not leave silent debt.

### T-0.2 — Consolidate import flows (2026-05-24)
- Survey revealed THREE wizards, not two — discovered `portfolios/UploadWizard.tsx` was a hidden third wizard still pointing to dead FastAPI (`localhost:8000/api/v1`). PortfolioHub's "Upload Your Portfolio" card had been broken since T-0.1.
- Deleted `src/app/components/import/ImportWizard.tsx` (1226 LOC, no Supabase write — façade)
- Deleted `src/app/components/portfolios/UploadWizard.tsx` (1134 LOC, broken FastAPI client)
- `Settings.tsx` and `PortfolioHub.tsx` both now invoke `components/upload/UploadWizard.tsx` with `orgId` from `DataContext`
- Net: −2360 LOC, bundle 1521 → 1471 kB

### T-0.4 — Python scenarios engine (2026-05-24)
- `api/scenarios/run.py` written — Vercel Python Function, vectorised NumPy MC, exact parity port of `computeECLFromBase`
- `api/scenarios/requirements.txt` (numpy)
- `api/scenarios/test_parity.py` — 8 tests, all pass; covers TS parity, stage sums, MC seed reproducibility, 50k-paths-under-1s perf, validation
- `src/app/services/scenarioEngine.ts` written — routes deterministic to client (instant), MC to Python Function, graceful fallback on server error
- `src/app/pages/Scenarios.tsx` Custom Builder now uses the real engine instead of `setTimeout`-faked "computation"
- ADR-001 updated to mark reversal-condition-1 as preemptively built (does NOT reverse the broader ADR — still a single function, not a service)

### T-0.1 — Decide and execute backend architecture (2026-05-24)
- ADR-001 written and committed
- `backend/` deleted (3,639 LOC FastAPI service, never deployed, schema-drifted)
- `src/app/services/api.ts` deleted (45 LOC, 0 importers)
- `packages/excel-addin/README.md` updated to reference Vercel Functions instead of FastAPI
- Net change: −4,145 lines
- Commit: `9980cd2 chore(arch): remove unused FastAPI backend (ADR-001)`

## Next Up

1. **T-0.2** — Consolidate import flows (delete duplicate `ImportWizard.tsx`)
2. **T-1.1** — Multi-sheet Excel parser (unlocks all of Phase 1)
3. **T-1.2** — Ingest Lessee Profiles (unlocks T-2.4, the biggest demo improvement)

## Recently Demoable Changes

These are the user-visible improvements from the last few sessions (not roadmap tasks, just polish):

- Sidebar sub-menu slide animations (CSS keyframes on Radix CollapsibleContent)
- Intelligence tab section expand animations (AnimatePresence + motion.div)
- Deal Feed publication date badges
- Rate Outlook back button + data source attribution footer
- Portfolio card backgrounds (sample portfolio + upload portfolio with centred images)
- Onboarding card layered shadow for legibility
- Portfolio Export button wired to download live lease register XLSX
- Scenario AI Summary always renders (deterministic fallback)
- Single-column Macro Signals layout

## Dependencies — what's blocking what

- **T-0.2** blocks T-1.1, which blocks ALL of Phase 1
- **T-0.3** blocks T-3.1, T-3.3, T-3.4, T-4.1
- **T-1.2** blocks T-2.1, T-2.2, T-2.4, T-2.5, T-5.3 — single biggest unblocker
- **T-1.1** blocks every other T-1.x
- **T-3.4** (universal audit log) blocks T-5.1 (email alerts)
- **T-4.1** (RLS) blocks T-4.2, T-4.3, T-5.5, T-6.5

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Sample portfolio Excel has 14 sheets but only 1 ingested | Customer cannot use real data — blocks every demo | T-1.1 + T-1.2 + T-1.3 + T-1.4 |
| Two parallel import wizards | Confusing for future engineers; possible drift | T-0.2 (quick) |
| Scenario runs not persisted | "Audit-ready" claim is currently false | T-3.1 |
| No RBAC enforcement | Read-only users can edit anything today | T-4.2 |
| No alert/notification engine | Persona 3 (Portfolio Manager) cannot get early warnings | T-5.1 + T-5.3 |
| Hardcoded lessee data (IndiGo, Aeromexico, etc.) | Demos with real customer Excel look broken | T-2.4 |
