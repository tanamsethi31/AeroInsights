# ADR-002 — Multi-portfolio scoping per tenant

**Date:** 2026-05-24
**Status:** Accepted
**Deciders:** Tanam Sethi
**Supersedes:** —
**Related:** ADR-001 (backend), PRD §3.3 personas, PRD §8.1 dashboard

## Context

T-0.3 in the roadmap asked: "does a tenant have one portfolio or many?"

Investigation found three relevant facts:

1. **No `portfolios` table exists in the database.** Every analytical
   table (`assets`, `lessees`, `leases`, `provisions`, `ecl_period_snapshots`,
   `bank_statements`, `cash_events`, `pd_curve_overrides`, etc.) keys on
   `org_id` only. There are ~129 references to `org_id` in
   `src/app/hooks/*` and `src/app/services/*` — no analytical query
   currently filters on a portfolio.

2. **Frontend already has a `PortfolioContext` with an `activePortfolio` slot.**
   It is purely in-memory: no persistence, no Supabase backing, no
   reload survival. `PortfolioHub.tsx` (the empty-state hub at `/portfolios`)
   tries to load from `fetch(\`${API_BASE}/portfolios\`)` — i.e. the FastAPI
   endpoint deleted in T-0.1. It has been broken since `9980cd2`.

3. **Sidebar's "Switch Portfolio" button works**, but only against the
   in-memory `PortfolioContext`. Switching does nothing meaningful because
   no analytical query is portfolio-scoped.

The PRD personas (§3.3) and dashboard spec (§8.1) describe portfolios as
first-class objects — distinct from the tenant org. Real aviation lessors
run separate "books":

- Balance-sheet portfolio (the main fleet)
- ABS / securitisation portfolio (CTC-enhanced sub-pool)
- Joint-venture portfolio (e.g. lessor + sovereign wealth fund SPVs)
- Sandbox / what-if portfolio (analyst stress tests without affecting production ECL)

A one-portfolio-per-tenant model collapses these into one bucket, which
doesn't match how the product is being sold.

## Decision

**Tenants have many portfolios. Adopt `portfolio_id` as the canonical
analytical scope.**

Every analytical query becomes `where org_id = $1 and portfolio_id = $2`.

`org_id` continues to govern access control and billing (org membership,
RBAC, billing plan). `portfolio_id` governs the *analytical scope* of any
given page view.

## Rationale

1. **Matches the customer.** Real lessors don't have one book; the pitch
   targets Tier 2/3 lessors with 20–800 aircraft across multiple legal
   vehicles. One-portfolio-per-tenant tells those customers to merge their
   books into a single mush, which is exactly the manual Excel pain we
   claim to solve.

2. **The frontend is already shaped for it.** Killing `PortfolioContext`,
   `PortfolioHub`, the "Switch Portfolio" sidebar button, and the
   `activePortfolio*` props would delete ~600 LOC of working UX. Activating
   the model preserves it.

3. **Migration cost is amortised.** 22 of 38 remaining roadmap tasks
   already include "new migration on `supabase/migrations/`". Adding
   `portfolio_id` to the new columns in each of those migrations costs
   nothing extra; retrofitting after Phase 1 ships means rewriting the
   same migrations.

4. **Audit-trail purity.** When the platform claims "immutable scenario
   runs", "ECL period snapshots" and "stage migration log", those records
   need to be attributable to a specific portfolio version, not a tenant.
   Otherwise you cannot tell whether the $47M ECL number was for the
   balance-sheet book or the ABS sub-pool — and the IFRS-9 disclosure
   pack becomes nonsense.

5. **RBAC needs a portfolio dimension eventually.** T-4.2 (role
   enforcement) wants to say "Sarah is an Admin on the balance-sheet
   portfolio but Read-Only on the ABS sub-pool". That is impossible with
   org-only scoping.

## Phasing

This decision is irreversible at the data-model level — once analytical
tables carry `portfolio_id`, the column stays. But the *roll-out* phases
to limit risk:

### Phase A (this commit, closes T-0.3)
- New migration: create `portfolios` table.
- Same migration: add `portfolio_id` nullable to `uploads` (with FK).
- Same migration: backfill — for any existing `uploads` row, create one
  "Default Portfolio" per org and link.
- Fix `PortfolioHub.tsx` to read from Supabase, not dead FastAPI.
- Wire `UploadWizard` to (a) create a portfolio at first import, or
  (b) associate with the currently active portfolio.
- `PortfolioContext` persists `activePortfolioId` to `localStorage` so
  refresh survives. Reads from Supabase on mount.

### Phase B (during Phase 1 ingestion tasks)
- Each Phase 1 task that creates or extends an analytical table
  (`assets`, `lessees`, `leases`, `provisions`, `pd_curve_overrides`,
  `lgd_recovery_overrides`, plus the new SD/MR/SICR/jurisdiction-LGD
  tables) adds `portfolio_id NOT NULL` from day one.
- Backfill: any existing row gets the org's "Default Portfolio".
- The Phase 1 multi-sheet parser (T-1.1) sets `portfolio_id` on every
  ingested row.

### Phase C (Phase 1 close)
- Sweep all `src/app/hooks/*` and `src/app/services/*`: every
  `supabase.from(\"table\").eq(\"org_id\", orgId)` becomes
  `.eq(\"org_id\", orgId).eq(\"portfolio_id\", activePortfolioId)`.
- Add a `useScopedSupabase()` helper hook that bundles both filters so
  the pattern is impossible to forget.
- Add a Supabase RLS policy on every analytical table that enforces
  `portfolio_id` membership via the active session (T-4.1 dependency).

## Consequences

### Positive
- Matches PRD persona model and customer reality.
- Preserves ~600 LOC of working frontend UX (`PortfolioContext`,
  `PortfolioHub`, sidebar "Switch Portfolio").
- Closes the dead-FastAPI bug in `PortfolioHub` (3rd such bug found
  during Phase 0).
- Establishes a real audit grain for IFRS-9 disclosure
  ("ECL = $47M on Balance-Sheet Portfolio, version 2026-Q2").
- Future RBAC can carry a portfolio dimension.

### Negative
- Every Phase 1 migration now adds a column. Tiny cost per migration;
  meaningful only in aggregate.
- Phase C sweep across ~129 hook usages is real work. Will produce a
  multi-file diff. Mitigated by a `useScopedSupabase()` helper that
  centralises the filter pattern.
- The Sample Portfolio (`SAMPLE_PORTFOLIO_ID = "global-sample"`) is now
  conceptually outside this model — it's a read-only demo dataset
  scoped to a magic UUID. Acceptable; documented in `PortfolioContext.tsx`.

### When to revisit
- If real customers consistently want only one portfolio each (unlikely
  given the segment), the `portfolios` table becomes essentially a
  per-tenant singleton and the column is dead weight. Easy to drop the
  filter without dropping the column.
- If Supabase RLS performance suffers from the dual filter at scale
  (>10k leases per portfolio), revisit indexing strategy on
  `(org_id, portfolio_id)` compound indexes — already added in the
  Phase A migration as defensive optimisation.

## References

- ADR-001 — backend architecture (this ADR inherits the
  Supabase + Vercel Functions decision)
- PRD §3.3 personas (Sarah, James, Priya, Mark, David — all reference
  multiple portfolios implicitly)
- PRD §8.1 dashboard (KPI strip is portfolio-scoped)
- PRD §10 RBAC matrix (will eventually need portfolio dimension)
- Existing in-memory `src/app/contexts/PortfolioContext.tsx`
- Existing UX surface `src/app/pages/PortfolioHub.tsx`
