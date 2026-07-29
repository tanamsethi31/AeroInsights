# MR Module Redesign: Live Adequacy, Redelivery View, Cost Benchmark Tiering — Design

**Goal:** Make every maintenance-reserve adequacy signal in the app compute from real portfolio data instead of a static demo table, add a portfolio-wide redelivery/return-condition risk view, and add an org-level cost benchmark tier between the global heuristic and the per-lease override shipped in the prior pass.

**Architecture:** Extract one shared adequacy-calculation function and use it everywhere an MR flag/shortfall is shown (killing the `MR_ADEQUACY` static table and its three independent, silently-broken call sites). Wire the standalone Maintenance page to the same `buildLiveSDMRData()` pipeline `Portfolio.tsx` already uses. Add a new `org_cost_benchmarks` table following the exact shape/RLS pattern of `mr_cost_overrides`, and extend the cost-resolution chain in `buildProjections()` to check it as a middle tier.

**Tech Stack:** No new libraries. React, TypeScript, Supabase (Postgres + RLS), existing `buildProjections`/`useCostOverrides` patterns.

---

## 1. Problem — why this exists

Research this session found the MR adequacy signal is broken for real customer data in three places, all rooted in the same static lookup table (`MR_ADEQUACY` in `src/app/data/maintenanceHeuristics.ts`), which only has entries for 6 fictional demo lease IDs (`LSE-2019-001`, etc.):

1. **`portfolioAdapters.ts:227`** (`toLeaseTableRows`) — looks up `MR_ADEQUACY[l.id]` where `l.id` is a real lease UUID. Always `null` for real data. This feeds `toMRHealthSummary()` → `MRRiskBanner.tsx`, which is live on the production Portfolio page. **A real customer's MR risk banner currently always reads "0 at-risk leases," regardless of actual portfolio health.**
2. **`MaintenanceForecastTab.tsx:203`** — `const adeq = ctx ? MR_ADEQUACY[ctx.leaseId] : null`. For a real lease, `adeq` is `null`, so the flag badge defaults to `"green"` (line 251: `adeq?.flag ?? "green"`) and the "Projected MR shortfall... reduces LGD offset in the ECL module" warning banner never renders (line 725: `adeq && adeq.eolShortfall > 0`), even when the lease has a genuine shortfall. Note: the KPI card's shortfall *value* already has a live fallback (`totalEOLShortfall`, computed from `buildProjections()`) — only the flag and the warning banner are silently wrong.
3. **`Maintenance.tsx`** (the whole standalone "Maintenance Reserves" page — Overview / Aircraft Detail / Scenario Modelling) imports `sdmrData` directly from `SDMRTab.tsx` — the same static 6-lease array — instead of `buildLiveSDMRData()`. Every real org sees the same 6 fictional leases (IndiGo, Aeromexico, Emirates...) on this page, regardless of what portfolio they uploaded.

Meanwhile `MRPortfolioGrid.tsx` (used inside `Maintenance.tsx`'s Overview tab) already does this correctly — it computes the flag live per lease via `buildProjections()`, ignoring `MR_ADEQUACY` entirely. That correct logic just isn't shared or reused anywhere else.

Separately, competitor research (Aerlytix, IBA, flydocs, IATA MCX) surfaced two feature gaps worth closing: a portfolio-wide "which leases are off-track to meet return conditions" view (currently only visible lease-by-lease), and cost-provenance data that's more than binary (heuristic vs. one lessor's override) — IBA and Aerlytix both expose a middle tier between "global default" and "this specific asset's verified number."

## 2. Goals

- One shared function computes MR adequacy (flag, `$` shortfall, `%` shortfall) from `ComponentProjection[]`. Every surface that shows an MR flag calls it. `MR_ADEQUACY` is deleted.
- The standalone Maintenance page (`Maintenance.tsx` and everything under it) reflects the real uploaded portfolio, the same way `Portfolio.tsx`'s SD/MR tab already does.
- A new portfolio-wide view answers "which leases are at risk of missing their return condition, by how much, and when" — reusing the calc above, no new data model.
- Cost provenance has three tiers: global heuristic → org benchmark → per-lease override (highest specificity wins), each visibly labeled.

## 3. Non-goals

- No merge of the two MR surfaces (Portfolio→SD/MR tab and the standalone Maintenance page stay separate — different vantage points: one lease's file vs. the whole book — confirmed with user).
- No live Cirium/IBA/market-data feed — no licensing deal exists. The heuristic tier stays a heuristic; it is not relabeled as verified.
- No redelivery *workflow* (inspection sign-off tracking, notice periods, checklists) — out of scope per user's explicit choice. This pass only surfaces the risk signal that already exists in the calc engine, portfolio-wide.
- No change to `SDMRTab.tsx`'s per-lease Supplemental Deposit logic, and no change to the per-lease cost override feature shipped in the prior pass (it becomes the highest-priority tier, unchanged otherwise).

## 4. Architecture

### 4.1 Shared adequacy calculation (foundation — everything else depends on this)

New function in `src/app/data/maintenanceHeuristics.ts` (replacing the `MR_ADEQUACY` export and its associated helpers `mrFlagColor`/`mrFlagBg`/`mrFlagBorder`, which stay since they're pure presentation and still needed):

```typescript
export interface MRAdequacy {
  flag: MRAdeqFlag;
  eolShortfall: number;      // sum of positive component eolShortfall, $ — matches MRPortfolioGrid's existing logic
  eolShortfallPct: number;   // eolShortfall / total eolObligation across components
}

export function computeMRAdequacy(projections: ComponentProjection[]): MRAdequacy {
  const eolShortfall = projections.reduce((s, p) => s + Math.max(0, p.eolShortfall), 0);
  const totalObligation = projections.reduce((s, p) => s + p.eolObligation, 0);
  const flag: MRAdeqFlag =
    projections.some(p => p.eolShortfall > 0) ? "red"
    : projections.some(p => p.distressedEOLShortfall > 0) ? "amber"
    : "green";
  return {
    flag,
    eolShortfall,
    eolShortfallPct: totalObligation > 0 ? (eolShortfall / totalObligation) * 100 : 0,
  };
}
```

This is `MRPortfolioGrid.tsx`'s existing inline logic (lines 55-80), extracted so all three call sites use one implementation instead of three independent (and two currently-broken) ones.

**Call site fixes:**

- **`MaintenanceForecastTab.tsx:203`** — replace `const adeq = ctx ? MR_ADEQUACY[ctx.leaseId] : null` with `const adeq = computeMRAdequacy(projections)`, computed after `projections` exists (requires reordering — `projections` is currently built further down the component; move that computation above line 203, or restructure so `adeq` is derived where `projections` is already in scope). `adeq` becomes always-defined (no more `null` case), so the `?? "green"` and `adeq &&` guards at lines 251/554-557/725 simplify to direct reads. `totalEOLShortfall`'s existing fallback role goes away — `adeq.eolShortfall` is now always the live number.
- **`MRPortfolioGrid.tsx`** — replace the inline `componentFlag`/flag-reduction logic (lines 32-36, 67-79) with a call to `computeMRAdequacy(projections)`.
- **`portfolioAdapters.ts` → `toLeaseTableRows()`** — currently only takes `(leases, assets, lessees)`, no MR component data. Extend its signature to accept a live SDMR adequacy map: `toLeaseTableRows(leases, assets, lessees, adequacyByLeaseId: Map<string, MRAdequacy>)`. The caller (`Portfolio.tsx`) already computes `liveSDMRData` via `buildLiveSDMRData()` for the SD/MR tab (lines 160-168) — build the adequacy map from that same array (`liveSDMRData.map(l => [l.leaseId, computeMRAdequacy(buildProjections(l, l.aircraft, leaseEndDate))])`), no new fetch. In demo mode (`isDemo === true`, `liveSDMRData` is `undefined`), fall back to computing adequacy from the static `sdmrData` demo set the same way, so the demo experience is unchanged.
- Delete `MR_ADEQUACY` from `maintenanceHeuristics.ts` once no references remain (confirm via grep before deleting).

### 4.2 Live-wire the standalone Maintenance page

`Maintenance.tsx` currently imports `sdmrData` (static) directly. Change it to build the same way `Portfolio.tsx` does:

```typescript
const { assets, lessees, leases, provisions, isDemo } = usePortfolioData();
const sdMr = useSdMr();
const liveOrDemoSDMRData = useMemo(
  () => (isDemo || assets.length === 0)
    ? sdmrData  // static demo set — unchanged behavior for demo orgs
    : buildLiveSDMRData(assets, lessees, leases, provisions, sdMr.depositsByLease, sdMr.reservesByLease),
  [isDemo, assets, lessees, leases, provisions, sdMr.depositsByLease, sdMr.reservesByLease],
);
```

Replace every `sdmrData` reference inside `Maintenance.tsx` with `liveOrDemoSDMRData`. `MRPortfolioGrid`, `MRCashflowChart`, `MREventCalendar`, `AircraftDetailTab`, `ScenarioModellingTab` all already accept `adjustedLeases`/lease arrays as props (not the static import directly), so this is a single change at the top of `Maintenance.tsx` — the child components don't need to know their data source changed.

`LEASE_CONTEXT` (the hardcoded MSN→leaseEnd/stage table in `MaintenanceForecastTab.tsx`) stays as the demo-mode fallback (it's already used that way when `liveRecord` is absent) — no change needed there.

### 4.3 Redelivery / return-condition risk view

New tab or section on `Maintenance.tsx` (exact placement — new 4th pill tab "Redelivery Risk" vs. a section within "Overview" — decided during implementation planning, not a data-layer decision). Content: a table, one row per lease, sorted by adequacy flag then shortfall descending:

- Lessee, aircraft type, MSN
- Lease end date, months remaining
- Flag (red/amber/green) + `$` shortfall + `%` shortfall — from `computeMRAdequacy()`
- Which component(s) are driving the shortfall (the components within that lease's `ComponentProjection[]` with the largest positive `eolShortfall`)

Pure UI, reusing `computeMRAdequacy()` and `buildProjections()` — the same data `MRPortfolioGrid` already has, presented as a dedicated, filterable/sortable view instead of an expandable grid row. No new data model, no new hooks.

### 4.4 Org-level cost benchmark tier

New table, mirroring `mr_cost_overrides`' shape and RLS pattern exactly, scoped one level coarser (org + aircraft type, not org + lease):

```sql
create table if not exists org_cost_benchmarks (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references organisations(id) on delete cascade,
  aircraft_type text       not null,   -- matches TYPE_HEURISTICS keys, e.g. "A320neo"
  component    text        not null,   -- "Engine PR", "Airframe HSI", "LLPs", "Landing Gear", "APU"
  cost_usd     numeric     not null,
  note         text,
  created_by   text        not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists org_cost_benchmarks_org_type_component_uidx
  on org_cost_benchmarks(org_id, aircraft_type, component);

alter table org_cost_benchmarks enable row level security;
alter table org_cost_benchmarks force  row level security;
-- Same 4 org-scoped policies (select/insert/update/delete) as mr_cost_overrides,
-- keyed on org_id = ((auth.jwt() ->> 'org_id')::uuid).
```

New hook `useOrgCostBenchmarks(aircraftType: string)` modeled directly on `useCostOverrides.ts` — same shape (`{ benchmarks, loading, saving, saveBenchmarks, clearBenchmarks }`), same actor-resolution (`supabase.auth.getUser()`), same `logAudit()` calls (`entityType: "org_cost_benchmark"`, actions `"override"`/`"reset"` — already valid `AuditAction` values, no new audit infrastructure).

**Cost resolution chain in `buildProjections()`** — extend the existing `costOverrides` parameter handling (currently: per-lease override wins, else heuristic) to a 3-way chain:

```typescript
const costOverride = costOverrides?.[comp.component];              // per-lease — highest priority
const orgBenchmark  = orgBenchmarks?.[comp.component];              // org-level — middle priority
const heuristicEventCost =
  costOverride  ? costOverride.costUSD :
  orgBenchmark  ? orgBenchmark.costUSD :
  (h ? h.costUSD : comp.fullIntervalUnits * comp.rateAmount);
const costSource: "heuristic" | "org-benchmark" | "override" =
  costOverride ? "override" : orgBenchmark ? "org-benchmark" : "heuristic";
```

`buildProjections()` gains a 6th optional parameter (`orgBenchmarks?: Record<string, OrgCostBenchmark>`), mirroring the existing `costOverrides` parameter shape. `ComponentProjection.costSource` gains the third literal value; `costOverrideMeta` gets a sibling `orgBenchmarkMeta` (same `{ createdBy, updatedAt, note }` shape) for the tooltip.

**UI:** the existing badge (`MaintenanceForecastTab.tsx`'s Component Projection Table) gains a third visual state — grey "Heuristic" / blue "Org Benchmark" / navy "Override" — same tooltip pattern as today, sourced from whichever meta object is populated. A new admin surface (Settings page, exact location decided during planning — likely a new section alongside wherever org-level config already lives) lets any org member manage benchmarks per aircraft type, reusing the same collapsible-section + per-component-input pattern already built for per-lease overrides, just scoped to a type picker instead of a lease.

**Permission model:** same as the per-lease override feature — any authenticated org member can set an org benchmark (no separate role gating exists today for the per-lease equivalent, so none is introduced here for consistency).

## 5. Data flow summary

```
Real org:  assets/leases/lessees/provisions/sdMr deposits+reserves (Supabase)
              │
              ▼
         buildLiveSDMRData()  →  LeaseSDMR[]
              │
              ├─► Portfolio.tsx → SDMRTab / MaintenanceForecastTab (existing, unchanged)
              │
              ├─► Maintenance.tsx (NEW: was static sdmrData, now live) → Overview / Aircraft
              │     Detail / Scenario Modelling / Redelivery Risk (NEW tab)
              │
              └─► portfolioAdapters.toLeaseTableRows() (NEW: adequacy map param) → Portfolio
                    page Leases tab + MRRiskBanner

Per lease:  buildProjections(lease, type, leaseEnd, utilOverride?, costOverrides?, orgBenchmarks?)
              → ComponentProjection[] → computeMRAdequacy() → { flag, eolShortfall, eolShortfallPct }
              (ONE function, called from all three surfaces above instead of three separate
              MR_ADEQUACY lookups, two of which were silently broken for real data)

Demo org:  static sdmrData (unchanged) flows through the same computeMRAdequacy() path —
           demo experience is visually identical to today, just computed the same way as real data
           instead of via a separate static MR_ADEQUACY lookup table.
```

## 6. Error handling / edge cases

- **Lease with no `mrComponents`** (shouldn't happen given `buildLiveSDMRData`'s current contract, but defensively): `computeMRAdequacy([])` → `eolShortfall: 0`, `flag: "green"` (no `some()` matches on empty array) — safe default, not a crash.
- **`totalObligation === 0`** (guards against divide-by-zero in `eolShortfallPct`) — already handled in the function above.
- **Org benchmark exists for an aircraft type with no matching component** (e.g. stale data after a schema/component-name change) — `orgBenchmarks?.[comp.component]` is simply `undefined`, falls through to heuristic. No special handling needed.
- **Demo mode** — must not regress. `isDemo` branch in both `Maintenance.tsx` and `toLeaseTableRows()` preserves exactly today's static-data behavior, just routed through the same `computeMRAdequacy()` function instead of a table lookup, so demo numbers should be pixel-identical (worth a visual spot-check during manual verification, not just a data-equality assertion, since the two computations should be mathematically equivalent for the 6 demo leases but this is worth confirming).

## 7. Testing

- Unit tests for `computeMRAdequacy()` — pure function, easy to test directly: red/amber/green cases, empty array, zero-obligation case.
- Existing `buildProjections` tests (`MaintenanceForecastTab.test.ts`) extended with a 3-tier cost-resolution describe block (org benchmark present + no override → uses benchmark; override present → override wins over benchmark; neither present → heuristic), following the exact pattern of the existing override tests from the prior pass.
- No new tests needed for `toLeaseTableRows()`'s signature change beyond confirming it still compiles and existing Portfolio-page tests (if any) still pass — this is UI/adapter wiring, not new logic.

## 8. Migration / rollout notes

- New `org_cost_benchmarks` table needs `apply_migration` against the live Supabase project (same manual step as `mr_cost_overrides` in the prior pass — not automatic).
- Deleting `MR_ADEQUACY` is safe only after confirming (via grep) no remaining references — do this as the last step of the foundation work, not the first.
- This is a genuinely large piece of work (4 sub-areas: shared adequacy calc + 3 call-site fixes, live Maintenance page wiring, a new UI view, and a new data tier + admin UI). The implementation plan should sequence it as: **(1) shared calc + call-site fixes first** (foundation, fixes a real production bug, unlocks everything else) **→ (2) live-wire Maintenance.tsx → (3) redelivery view → (4) org benchmark tier**, each independently testable and mergeable, following the same task-by-task subagent-driven-development process used for the prior MR cost-provenance pass.

## 9. Confirmed decisions (from brainstorming)

- Two MR surfaces stay separate (no merge) — different vantage points sharing one calc engine.
- Redelivery tracking = surface the existing calc portfolio-wide, not a new workflow/checklist.
- Cost tiering = build a real org-level benchmark layer now, not just a relabel.
