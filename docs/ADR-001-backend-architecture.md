# ADR-001 — Backend Architecture

**Date:** 2026-05-24
**Status:** Accepted
**Deciders:** Tanam Sethi
**Supersedes:** —

## Context

The repository contained two parallel server-side data layers:

1. **Supabase** (PostgreSQL + JS client SDK) — actively used by the React frontend through 22 `supabase.from(...)` call sites across 13 files. Tenant isolation via Row-Level Security. 14 migrations evolving the schema.

2. **FastAPI** (`backend/`, 3,639 LOC) — a competently built Python service with SQLAlchemy async models, Alembic migrations, Pydantic schemas, Celery worker scaffolding, and 16 REST endpoints (auth, tenants, users, lessees, leases, aircraft, payments, security_deposits, maintenance_reserves, valuations, imports, audit_log, excel, alerts, health). Per-request tenant scoping in every query.

A `useApi()` hook (`src/app/services/api.ts`) existed to bridge the frontend to FastAPI, but **had zero importers**. The FastAPI service had never been deployed (no host configured, no Dockerfile target wired into CI). The Celery workers (`tasks.py`) were stubs returning `"queued_for_phase2"` — always aspirational.

Critically, the two systems had **drifted to different schemas**:

| FastAPI tables | Supabase tables |
|---|---|
| `tenants`, `aircraft`, `payments`, `valuations`, `scenario_runs`, `ecl_records`, `exports`, `scheduled_reports`, `watchlist_config`, `sicr_config`, `behavior_score_history`, `stage_migrations` | `orgs`, `assets`, `leases`, `lessees`, `uploads`, `provisions`, `ecl_period_snapshots`, `assumption_change_log`, `bank_transactions`, `cash_events`, `abs_deals`, `lgd_recovery_overrides`, `pd_curve_overrides` |

Different naming conventions (`aircraft` vs `assets`, `tenants` vs `orgs`, `audit_log` vs `assumption_change_log`) meant that *activating* FastAPI would have required multi-week schema reconciliation before any feature work could resume.

## Decision

**Remove the FastAPI service. Standardise on Supabase + Vercel Functions as the sole backend layer.**

Specifically:
- Delete `backend/` (3,639 LOC).
- Delete `src/app/services/api.ts` (45 LOC, 0 importers).
- Keep `packages/excel-addin/` scaffold; update its README to reflect the new architecture (Excel functions will call `/api/excel/*` Vercel Functions, not FastAPI).
- Keep `/api/` (Vercel Functions in TypeScript and Python) as the home for any server-side compute (AI narrative, macro signals, news ingestion, future scenario runs).

## Rationale

1. **Zero migration cost.** No frontend consumer to break. `git rm` leaves the system fully functional.
2. **Schema reconciliation alone was multi-week work** that would have blocked all Phase 1 ingestion progress (full Excel ingestion of 14 sheets / 70+ data points).
3. **Supabase RLS already provides tenant isolation** at the DB layer. FastAPI's per-request tenant filtering was duplicating that work.
4. **Vercel + Supabase is the deployment target** the product is already shipping on. A second Python runtime would require a second host, second CI pipeline, second observability surface, and second secret-management story.
5. **Heavy compute remains supported without FastAPI.** Vercel Functions support Python via Fluid Compute. When a scenario run becomes too heavy for the client, a single `/api/scenarios/run.py` Function can be added — no service to stand up.
6. **Cognitive load reduction.** Two services / two schemas / two languages for the same domain was the primary source of confusion when reviewing the codebase ("is this fake or real?").

## Consequences

### Positive
- Repo shrinks by ~3,684 LOC.
- Single source of truth for the data schema: Supabase migrations under `supabase/migrations/`.
- One auth surface (Supabase + Auth0), one DB, one host.
- Removes the need to maintain Alembic migrations in parallel with Supabase migrations.
- Closes the dead-code question definitively before Phase 1 work starts.

### Negative
- Loses ~3,600 lines of well-written-but-unused Python (FastAPI endpoints, SQLAlchemy models, Pydantic schemas, Celery scaffolding). If the project ever needs a Python service, it will be rebuilt fresh against the actual Supabase schema rather than reused from this version.
- Loses the Celery worker scaffold. Future async work will use Vercel Queues (public beta) or Supabase Edge Functions instead.

### When to revisit
- If Monte Carlo scenarios start exceeding ~2 seconds client-side for real (1,000+ lease) portfolios → add a `/api/scenarios/run.py` Vercel Function. Single function, not a service.
  - **Status (2026-05-24): preemptively built.** See `api/scenarios/run.py` (Vercel Python Function, NumPy-vectorised MC, 8/8 parity tests passing). The client-side MC was theatrical (`computeMCRange` multiplied ECL by fixed factors with seeded noise); the Python function replaces it with real path simulation. Frontend routing via `src/app/services/scenarioEngine.ts`: deterministic stays client-side (~1 ms); MC goes to the Function (~50 k paths in <200 ms warm). Falls back to a deterministic-derived synthetic spread tagged `client-fallback` if the server is unreachable. Does **not** reverse the broader ADR — still a single function, not a service.
- If the team hires a dedicated Python risk engineer who owns the ECL model → revisit then, building fresh against the live Supabase schema.
  - **Status (2026-05-24): preemptively built (no team hired).** See `api/risk-engine/` (Vercel Python Function — per-lease PD × LGD × EAD against the live Supabase schema, NOT the Alembic one). 5/5 unit tests pass. Sibling to `api/scenarios/run.py`, not a replacement: `compute.py` builds the baseline by reading `assets / lessees / leases / provisions / pd_curve_overrides / lgd_recovery_overrides` for an `org_id`; `run.py` then applies macro shocks to that baseline. Does **not** reverse the broader ADR — still individual Vercel Functions, not a Python service. Auth model is interim (`X-Org-Id` header trust) with `TODO(T-4.1)` markers throughout for the JWT-forwarding rewrite when RLS lockdown lands.

## References

- Deleted commit: see `git log --diff-filter=D -- backend/`
- Vercel Python runtime: https://vercel.com/docs/functions/runtimes/python
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
