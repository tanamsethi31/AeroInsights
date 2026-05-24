# Progress Tracker

**Last updated:** 2026-05-24

## Snapshot

| Phase | Total Tasks | Done | In Progress | Todo | % Complete |
|---|---|---|---|---|---|
| 0 | 4 | 2 | 0 | 2 | 50% |
| 1 | 10 | 0 | 0 | 10 | 0% |
| 2 | 6 | 0 | 0 | 6 | 0% |
| 3 | 5 | 0 | 0 | 5 | 0% |
| 4 | 4 | 0 | 0 | 4 | 0% |
| 5 | 5 | 0 | 0 | 5 | 0% |
| 6 | 6 | 0 | 0 | 6 | 0% |
| **Total** | **40** | **2** | **0** | **38** | **5%** |

## Completed Tasks

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
