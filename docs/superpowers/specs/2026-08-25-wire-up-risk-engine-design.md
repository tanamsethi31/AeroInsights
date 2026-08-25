# Wire Up the Real IFRS-9 Risk Engine — Design

## Problem

`api/risk-engine/compute.py` is a deployed, working Vercel Python Function
that computes true per-lease IFRS-9 ECL (`PD × LGD × EAD`) from a tenant's
live Supabase portfolio. Nothing in `src/app` calls it. Every ECL figure
shown in the product today comes from one of two client-side sources
instead:

1. `computeECL()` / `computeECLFromBase(BASE_ECL, ...)` in
   `src/app/utils/eclCalculator.ts` — pure scenario math, scaled off the
   hardcoded constant `BASE_ECL = 47.2`.
2. `toDashboardKPIs(assets, lessees, provisions)` in
   `src/app/lib/portfolioAdapters.ts` — sums whatever `ecl_amount` is
   already sitting on each `provisions` row client-side. Nothing
   (re)computes that field from current PD curves / LGD overlays / SICR
   staging — it's static, upload-time data.

Four call sites already anticipate a real number — each defines a
`liveBaseECL` local exactly the same way:

```ts
const liveBaseECL = useMemo(() => {
  const kpis = toDashboardKPIs(assets, lessees, provisions);
  return kpis.totalECLm > 0 ? kpis.totalECLm : BASE_ECL;
}, [assets, lessees, provisions]);
```

- `src/app/pages/RiskECL.tsx:401`
- `src/app/pages/Scenarios.tsx:242`
- `src/app/pages/CustomBuilderPage.tsx:114`
- `src/app/components/scenarios/ConcentrationStressTab.tsx:55`

This spec wires the real engine in as a better source ahead of that
existing fallback chain, without changing anything downstream of
`liveBaseECL` — every consumer of that variable (scenario tabs, library
templates, export service) keeps working unmodified.

## Decisions

Confirmed with the user before writing this spec:

1. **Demo orgs never call the live engine.** Orgs without an uploaded
   portfolio (`hasUpload === false`, per `DataContext`) are the ones
   showing the sample/demo portfolio (10 aircraft, IndiGo/Emirates/etc. —
   a pure client-side fixture in `mockPortfolioData.ts`, never persisted
   to Supabase). Calling the engine for them would return
   `total_ecl: 0` (zero real leases for their `org_id`), silently
   replacing the polished demo numbers with a blank portfolio. Only
   `hasUpload === true` orgs call the engine.
2. **Fetched once per session, cached client-side.** Not on every page
   visit, not via a manual refresh button.
3. **Loading state, then visible fallback on error.** Never silently
   swap in a stale/wrong number for a real customer without saying so.

## Architecture

### New hook: `src/app/hooks/useRiskEngineECL.ts`

```ts
interface RiskEngineECL {
  ecl: number | null;   // total_ecl in $M, or null if unavailable/not applicable
  loading: boolean;
  error: string | null; // set only when hasUpload && the call actually failed
}

export function useRiskEngineECL(): RiskEngineECL
```

Behaviour:

- Reads `orgId` and `hasUpload` from `useData()` (`DataContext`).
- If `!hasUpload || !orgId` (demo orgs, or org not yet resolved): returns
  `{ ecl: null, loading: false, error: null }` immediately. No network
  call — this is the mechanism that satisfies decision #1.
- If `hasUpload && orgId`: on mount (and when `orgId` changes — e.g. an
  org switch), POSTs to `/api/risk-engine/compute` once, then caches the
  result for the rest of the session (a module-level `Map<orgId,
  RiskEngineECL>` keyed by `orgId`, mirroring how `useTabSync` and other
  hooks in this codebase keep state outside React where it needs to
  survive remounts). A second mount with the same `orgId` (e.g.
  navigating between RiskECL and Scenarios) reads the cached result
  instead of re-fetching — this is what "once per session" means in
  practice, since there is no single shared app-level mount point where
  a true "fetch once at login" call could live without adding one.

Request:

```ts
fetch("/api/risk-engine/compute", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Org-Id": orgId,
  },
  body: JSON.stringify({ org_id: orgId, persist: false }),
});
```

This matches the function's documented interim auth contract exactly
(`X-Org-Id` header + body `org_id` must agree — see `compute.py`'s
docstring). No Auth0 bearer token is sent, because the function does not
currently read or verify one; the function's own README already flags
real JWT verification as future work (`TODO(T-4.1)`). Adding a token
client-side now would be dead code until that lands server-side, so this
spec does not add one.

`persist` is always `false`. The engine's snapshot-locking capability
(`persist: true` + `period_label`) has no current UI trigger anywhere in
the app — wiring that up is a separate feature, out of scope here.

Response handling:

- `200` → `{ ecl: body.total_ecl, loading: false, error: null }`.
- Non-200, network error, or malformed JSON → `{ ecl: null, loading:
  false, error: <message> }`. The hook does not itself decide what the
  UI shows on error — that's each consumer's job (see below), because
  the right fallback differs by call site (some already have a
  `toDashboardKPIs` number to fall back to; none should ever show a bare
  error with no number at all).

### Consumer changes — same precedence at all 4 sites

Each of the 4 existing `liveBaseECL` definitions changes from:

```ts
const liveBaseECL = useMemo(() => {
  const kpis = toDashboardKPIs(assets, lessees, provisions);
  return kpis.totalECLm > 0 ? kpis.totalECLm : BASE_ECL;
}, [assets, lessees, provisions]);
```

to:

```ts
const { ecl: engineECL, loading: engineLoading, error: engineError } = useRiskEngineECL();

const liveBaseECL = useMemo(() => {
  if (isUnscoped && engineECL !== null) return engineECL;
  const kpis = toDashboardKPIs(assets, lessees, provisions);
  return kpis.totalECLm > 0 ? kpis.totalECLm : BASE_ECL;
}, [isUnscoped, engineECL, assets, lessees, provisions]);
```

`isUnscoped` handles the scoping nuance found during design: `RiskECL.tsx`
and `ConcentrationStressTab.tsx` have no scope concept at all (always
`true`). `Scenarios.tsx` and `CustomBuilderPage.tsx` have a `ScenarioScope`
filter (`scope === SCOPE_ALL`) — the engine returns the org's *whole*
portfolio, so it only replaces the client-side number when the user
hasn't filtered down to a subset. A scoped view keeps using the existing
`toDashboardKPIs(scoped...)` derivation exactly as it does today.

### Loading / error UI

Each of the 4 pages already renders its headline ECL figure from
`liveBaseECL` (or something derived from it) near the top of the page.
This spec adds, next to that figure, for `hasUpload === true` orgs only:

- While `engineLoading`: a small inline spinner/skeleton in place of the
  figure (matches existing loading-state patterns elsewhere in these
  pages — e.g. `Reconciliation.tsx`'s "Loading statements…" text).
- On `engineError` (and only then — not while loading, not for demo
  orgs): a small dismissible banner reading "Live ECL unavailable —
  showing estimated figures" above the figure, which is still shown
  (via the `toDashboardKPIs`/`BASE_ECL` fallback chain, unchanged).

## Data flow summary

```
Real org, unscoped view:
  useRiskEngineECL() → POST /api/risk-engine/compute → Supabase (assets,
  lessees, leases, provisions, pd_curve_overrides, lgd_recovery_overrides)
  → engine.py compute_portfolio_ecl() → total_ecl
  → liveBaseECL = total_ecl
  → computeECLFromBase(liveBaseECL, scenarioInputs) [unchanged downstream]

Real org, scoped view / engine call failed / still loading:
  liveBaseECL = toDashboardKPIs(scoped assets/lessees/provisions).totalECLm
                 || BASE_ECL   [unchanged from today]

Demo org (hasUpload === false):
  useRiskEngineECL() never calls the network
  liveBaseECL = toDashboardKPIs(...).totalECLm || BASE_ECL
              = BASE_ECL in practice (demo fixtures have no ecl_amount)
              [identical to today's behaviour]
```

## Testing

- `useRiskEngineECL.test.ts`: demo org → no fetch called, `ecl: null`
  immediately. Real org → fetch called once, cached on second mount with
  same `orgId`, re-fetched on `orgId` change. Non-200 response → `error`
  set, `ecl: null`.
- Existing `eclCalculator.test.ts` and any RiskECL/Scenarios component
  tests are unaffected — `computeECLFromBase` itself doesn't change, only
  what value gets passed in as its first argument.

## Explicitly out of scope

- The engine's `persist` / snapshot-locking flow (no UI trigger exists
  today for creating a locked period snapshot).
- Hardening the engine's interim `X-Org-Id` trust model with real JWT
  verification — already tracked in the engine's own code as
  `TODO(T-4.1)`, not introduced or worsened by this change.
- Changing `toDashboardKPIs` or backfilling `provisions.ecl_amount` —
  the scoped/fallback path keeps behaving exactly as it does today.
