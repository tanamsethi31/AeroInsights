# MR Module Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `MR_ADEQUACY` static lookup (silently null for every real lease, across 6 call sites in 4 files) with one shared live-computed adequacy function; live-wire the standalone Maintenance page to the real portfolio; add a portfolio-wide redelivery-risk view; add an org-level cost benchmark tier between the global heuristic and the per-lease override.

**Architecture:** One new pure function (`computeMRAdequacy`) and one new aggregation helper (`buildAdequacyMap`), both added to `MaintenanceForecastTab.tsx` (the existing home of `buildProjections`/`ComponentProjection`/`LEASE_CONTEXT` — avoids a circular import between it and `maintenanceHeuristics.ts`). Six call sites across `MaintenanceForecastTab.tsx`, `MRPortfolioGrid.tsx`, `SDMRTab.tsx`, `portfolioAdapters.ts`, `RiskECL.tsx`, and `Dashboard.tsx`/`Portfolio.tsx` switch from the dead `MR_ADEQUACY[id]` lookup to this shared function. Then: live-wire `Maintenance.tsx`, add a new redelivery-risk tab, and add an `org_cost_benchmarks` table mirroring `mr_cost_overrides`' exact shape/RLS pattern.

**Tech Stack:** React, TypeScript, Supabase (Postgres + RLS), Vitest. No new libraries.

**Important — scope correction from the spec:** the design spec (`docs/superpowers/specs/2026-07-29-mr-module-redesign-design.md`) identified 3 broken `MR_ADEQUACY` call sites. Grepping the codebase while writing this plan found **6**, across 2 more files (`SDMRTab.tsx` has 2 separate broken displays; `RiskECL.tsx` was missed entirely — it cross-references MR shortfall against LGD offset, so it was silently broken too). This plan is the ground truth; Phase 1 covers all 6.

---

## Phase 1 — Foundation: shared adequacy calc, kill `MR_ADEQUACY`

### Task 1: `computeMRAdequacy` + `buildAdequacyMap` with tests

**Files:**
- Modify: `src/app/components/portfolio/MaintenanceForecastTab.tsx`
- Test: `src/app/components/portfolio/MaintenanceForecastTab.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `src/app/components/portfolio/MaintenanceForecastTab.test.ts`. First add this import at the top of the file (alongside the existing `buildProjections` import):

```typescript
import { buildProjections, computeMRAdequacy, buildAdequacyMap } from "./MaintenanceForecastTab";
```

Then append:

```typescript
// ── computeMRAdequacy ─────────────────────────────────────────────────────────

describe("computeMRAdequacy", () => {
  it("returns green with zero shortfall for an empty projection list", () => {
    const result = computeMRAdequacy([]);
    expect(result).toEqual({ flag: "green", eolShortfall: 0, eolShortfallPct: 0, distressedEOLShortfall: 0 });
  });

  it("returns red and sums positive eolShortfall when any component has one", () => {
    const [p] = buildProjections(makeLease(), "A320neo", new Date(2026, 5, 1)); // 1 month to EOL — forces a shortfall
    const result = computeMRAdequacy([p]);
    expect(result.flag).toBe("red");
    expect(result.eolShortfall).toBeCloseTo(Math.max(0, p.eolShortfall), 0);
  });

  it("returns green when eolShortfall and distressedEOLShortfall are both non-positive", () => {
    // Long lease end (2035) → plenty of accrual time → surplus, not shortfall
    const [p] = buildProjections(makeLease(), "A320neo", new Date(2035, 0, 1));
    const result = computeMRAdequacy([p]);
    expect(result.eolShortfall).toBeLessThanOrEqual(0.01); // computeMRAdequacy floors negative shortfalls to 0 via Math.max
    expect(result.flag).not.toBe("red");
  });

  it("computes eolShortfallPct as shortfall / total obligation, 0 when obligation is 0", () => {
    const result = computeMRAdequacy([]);
    expect(result.eolShortfallPct).toBe(0);
  });
});

// ── buildAdequacyMap ──────────────────────────────────────────────────────────

describe("buildAdequacyMap", () => {
  it("keys the returned map by leaseId", () => {
    const lease = makeLease(); // leaseId: "LSE-TEST-001", no leaseEnd field
    const map = buildAdequacyMap([lease]);
    expect(map.has("LSE-TEST-001")).toBe(true);
  });

  it("falls back to LEASE_CONTEXT for leaseEnd when lease.leaseEnd is absent (demo-mode leases)", () => {
    // makeLease() has no leaseEnd field — buildAdequacyMap must not throw
    // and must produce a defined MRAdequacy entry (not undefined/NaN).
    const map = buildAdequacyMap([makeLease()]);
    const entry = map.get("LSE-TEST-001")!;
    expect(entry).toBeDefined();
    expect(Number.isNaN(entry.eolShortfall)).toBe(false);
  });

  it("uses lease.leaseEnd directly when present (live-mode leases)", () => {
    const lease = { ...makeLease(), leaseEnd: "2026-06-01" }; // 1 month out — forces shortfall
    const map = buildAdequacyMap([lease]);
    expect(map.get("LSE-TEST-001")!.flag).toBe("red");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/.config/superpowers/worktrees/Aeroinsights/mr-module-redesign && npm test -- --run MaintenanceForecastTab`
Expected: FAIL — `computeMRAdequacy`/`buildAdequacyMap` are not exported from `./MaintenanceForecastTab`

- [ ] **Step 3: Implement `computeMRAdequacy` and `buildAdequacyMap`**

In `src/app/components/portfolio/MaintenanceForecastTab.tsx`, add directly below the existing `export interface ComponentProjection { ... }` block (after line 74, before `export interface UtilOverride`):

```typescript
export interface MRAdequacy {
  flag: MRAdeqFlag;
  eolShortfall: number;            // sum of positive component eolShortfall, $
  eolShortfallPct: number;         // eolShortfall / total eolObligation, 0 if obligation is 0
  distressedEOLShortfall: number;  // sum of Math.max(0, component distressedEOLShortfall) — matches MRPortfolioGrid.tsx's existing production logic
}

/** Single source of truth for MR adequacy — replaces the old MR_ADEQUACY static lookup table. */
export function computeMRAdequacy(projections: ComponentProjection[]): MRAdequacy {
  const eolShortfall = projections.reduce((s, p) => s + Math.max(0, p.eolShortfall), 0);
  const distressedEOLShortfall = projections.reduce((s, p) => s + p.distressedEOLShortfall, 0);
  const totalObligation = projections.reduce((s, p) => s + p.eolObligation, 0);
  const flag: MRAdeqFlag =
    projections.some(p => p.eolShortfall > 0) ? "red"
    : projections.some(p => p.distressedEOLShortfall > 0) ? "amber"
    : "green";
  return {
    flag,
    eolShortfall,
    eolShortfallPct: totalObligation > 0 ? (eolShortfall / totalObligation) * 100 : 0,
    distressedEOLShortfall,
  };
}

// Reverse lookup: leaseId → { msn, leaseEnd } — same table MRPortfolioGrid.tsx builds inline today.
const CONTEXT_BY_LEASE_ID: Record<string, { msn: string; leaseEnd: string }> = Object.fromEntries(
  Object.entries(LEASE_CONTEXT).map(([msn, ctx]) => [ctx.leaseId, { msn, leaseEnd: ctx.leaseEnd }])
);

/** Adequacy for a whole book of leases, keyed by leaseId. Falls back to LEASE_CONTEXT for demo
 *  leases that don't carry their own leaseEnd (buildLiveSDMRData always populates leaseEnd on real records). */
export function buildAdequacyMap(leases: LeaseSDMR[]): Map<string, MRAdequacy> {
  const map = new Map<string, MRAdequacy>();
  for (const lease of leases) {
    const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
    const leaseEndDate = lease.leaseEnd
      ? parseDateLocal(lease.leaseEnd)
      : ctx
      ? parseDateLocal(ctx.leaseEnd)
      : new Date(2028, 0, 1); // last-resort fallback, mirrors MRPortfolioGrid.tsx's existing fallback
    const projections = buildProjections(lease, lease.aircraft, leaseEndDate);
    map.set(lease.leaseId, computeMRAdequacy(projections));
  }
  return map;
}
```

`MRAdeqFlag` is already imported into this file (line 9). No new imports needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run MaintenanceForecastTab`
Expected: PASS, all tests including the new `computeMRAdequacy`/`buildAdequacyMap` blocks

- [ ] **Step 5: Commit**

```bash
git add src/app/components/portfolio/MaintenanceForecastTab.tsx src/app/components/portfolio/MaintenanceForecastTab.test.ts
git commit -m "feat: add computeMRAdequacy + buildAdequacyMap, shared MR adequacy calc"
```

---

### Task 2: Fix `MaintenanceForecastTab.tsx`'s own adequacy derivation

**Files:**
- Modify: `src/app/components/portfolio/MaintenanceForecastTab.tsx:203, 231-254`

- [ ] **Step 1: Replace the `MR_ADEQUACY` lookup with a live computation**

Currently (line 203, inside the component body, before `projections` exists):
```typescript
  const adeq = ctx ? MR_ADEQUACY[ctx.leaseId] : null;
```

Delete that line entirely. `adeq` must be computed AFTER `projections` exists (line 243: `const projections = buildProjections(leaseRecord, aircraftType, leaseEndDate, utilOverride, costOverrides);`). Immediately after that line, add:

```typescript
  const adeq = computeMRAdequacy(projections);
```

- [ ] **Step 2: Simplify the now-always-defined `adeq` usages**

Line 251 currently reads:
```typescript
  const flag: MRAdeqFlag = adeq?.flag ?? "green";
```
Change to:
```typescript
  const flag: MRAdeqFlag = adeq.flag;
```

Around lines 554-557 (KPI card definition), currently:
```typescript
              label: adeq && adeq.eolShortfall > 0 ? "EOL Shortfall" : "EOL Surplus",
              value: fmtUSD(Math.abs(adeq?.eolShortfall ?? totalEOLShortfall)),
              sub:   `${((Math.abs(adeq?.eolShortfall ?? totalEOLShortfall) / Math.max(1, totalEOLObligation)) * 100).toFixed(1)}% of obligation`,
              alert: (adeq?.eolShortfall ?? totalEOLShortfall) > 0,
```
Change to (drop the `?? totalEOLShortfall` fallback — `adeq.eolShortfall` is now always live and correct; `totalEOLShortfall` stays defined elsewhere in the file and is unaffected, just no longer needed as a fallback here):
```typescript
              label: adeq.eolShortfall > 0 ? "EOL Shortfall" : "EOL Surplus",
              value: fmtUSD(Math.abs(adeq.eolShortfall)),
              sub:   `${((Math.abs(adeq.eolShortfall) / Math.max(1, totalEOLObligation)) * 100).toFixed(1)}% of obligation`,
              alert: adeq.eolShortfall > 0,
```

Around line 725, currently:
```typescript
      {adeq && adeq.eolShortfall > 0 && (
```
Change to:
```typescript
      {adeq.eolShortfall > 0 && (
```

- [ ] **Step 3: Remove the now-unused `MR_ADEQUACY` import**

Line 5 of the file imports `MR_ADEQUACY` from `../../data/maintenanceHeuristics`. Remove just that named import (keep `TYPE_HEURISTICS, mrFlagColor, mrFlagBg, mrFlagBorder, type MRAdeqFlag, type ComponentName` — those are all still used).

- [ ] **Step 4: Typecheck and run tests**

Run: `npx tsc --noEmit`
Expected: no errors (confirms no other code in this file still expects `adeq` to be possibly-null)

Run: `npm test -- --run MaintenanceForecastTab`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/portfolio/MaintenanceForecastTab.tsx
git commit -m "fix: MaintenanceForecastTab computes MR adequacy live instead of dead MR_ADEQUACY lookup"
```

---

### Task 3: Fix `MRPortfolioGrid.tsx`

**Files:**
- Modify: `src/app/components/maintenance/MRPortfolioGrid.tsx`

- [ ] **Step 1: Replace the inline flag/shortfall reduction with `computeMRAdequacy`**

Currently (lines 1-36) the file defines its own `CONTEXT_BY_LEASE_ID`, `parseDateLocal`, and `componentFlag` helpers, and (lines 55-91) computes `baseEOLShortfall`/`distressedEOLShortfall`/`overallFlag` inline per lease. Replace the import block:

```typescript
import {
  buildProjections,
  LEASE_CONTEXT,
  computeMRAdequacy,
  type ComponentProjection,
} from "../portfolio/MaintenanceForecastTab";
```

Delete the local `CONTEXT_BY_LEASE_ID` const, `parseDateLocal` function, and `componentFlag` function (lines 16-36) — all now redundant with what `buildAdequacyMap`/`computeMRAdequacy` already do internally. Keep a local `CONTEXT_BY_LEASE_ID` only if this file still needs `msn` lookup separately from adequacy (it does — the `rows` map uses `ctx?.msn`), so keep that specific const but drop `componentFlag`/`parseDateLocal` if nothing else in the file uses them (verify with grep before deleting: `grep -n "parseDateLocal\|componentFlag" src/app/components/maintenance/MRPortfolioGrid.tsx` — if `parseDateLocal` is used elsewhere in the file for date formatting beyond this block, keep it and only delete `componentFlag`).

In the `rows` useMemo (around line 55-80), replace:
```typescript
        const projections = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride);

        const baseEOLShortfall = projections.reduce(
          (s, p) => s + Math.max(0, p.eolShortfall),
          0
        );
        const distressedEOLShortfall = projections.reduce(
          (s, p) => s + p.distressedEOLShortfall,
          0
        );
        const overallFlag: MRAdeqFlag = projections.some((p) => p.eolShortfall > 0)
          ? "red"
          : projections.some((p) => p.distressedEOLShortfall > 0)
          ? "amber"
          : "green";
```
with:
```typescript
        const projections = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride);
        const adequacy = computeMRAdequacy(projections);
        const baseEOLShortfall = adequacy.eolShortfall;
        const distressedEOLShortfall = adequacy.distressedEOLShortfall;
        const overallFlag: MRAdeqFlag = adequacy.flag;
```

The rest of the file (rendering `rows`, expand/collapse, table markup) is unchanged — it already consumes `baseEOLShortfall`/`distressedEOLShortfall`/`overallFlag` from the row object, and those variable names are preserved.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `MRAdeqFlag` import from `maintenanceHeuristics.ts` is now unused because it's only used as a type annotation that's inferred fine without it, keep the import if the `overallFlag: MRAdeqFlag` type annotation is still present (it is, in the code above) — no import changes needed for that type.

- [ ] **Step 3: Manual sanity check — no automated test exists for this file today**

Confirm via `grep -n "MRPortfolioGrid" src/app -r --include="*.test.ts*"` that no test file exists for this component (matches the pre-existing pattern — it's presentational, verified by typecheck + the shared `computeMRAdequacy` tests from Task 1). If a test file does exist, run it and confirm it still passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/maintenance/MRPortfolioGrid.tsx
git commit -m "fix: MRPortfolioGrid uses shared computeMRAdequacy instead of duplicated inline logic"
```

---

### Task 4: Fix `SDMRTab.tsx` (portfolio banner + per-row MR Adequacy column)

**Files:**
- Modify: `src/app/components/portfolio/SDMRTab.tsx`

This file has TWO separate broken displays, both keyed off `MR_ADEQUACY[l.leaseId]` / `MR_ADEQUACY[lease.leaseId]`, both already explicitly commented as broken in live mode (line 612: `// In live mode MR_ADEQUACY keys won't match live leaseIds, so flag is derived directly from projections` — the comment describes intended behavior that was never actually implemented).

- [ ] **Step 1: Add the import**

Add to the existing import from `../portfolio/MaintenanceForecastTab` (check the top of the file for an existing import from that module — if none exists, add a new one; `LEASE_CONTEXT` is likely already imported given this file references lease context elsewhere):

```typescript
import { buildProjections, buildAdequacyMap, LEASE_CONTEXT } from "./MaintenanceForecastTab";
```

(This file already imports `MRComponent`/`LeaseSDMR` types from itself and `MR_ADEQUACY, mrFlagColor, mrFlagBg, mrFlagBorder, TYPE_HEURISTICS` from `../../data/maintenanceHeuristics` — line 6. Remove `MR_ADEQUACY` from that import list; keep the rest.)

- [ ] **Step 2: Build the adequacy map once, near the top of the component (before the portfolio summary block at line ~610)**

Immediately before the `// ── Portfolio MR adequacy summary ──` comment block (around line 610), add:

```typescript
  const adequacyByLeaseId = buildAdequacyMap(displayData);
```

- [ ] **Step 3: Fix the portfolio alert banner (lines 610-618)**

Replace:
```typescript
  // ── Portfolio MR adequacy summary ──────────────────────────────────────────
  // In live mode MR_ADEQUACY keys won't match live leaseIds, so flag is derived directly from projections
  const shortfallLeases = displayData.filter((l) => {
    const a = MR_ADEQUACY[l.leaseId];
    return a && a.eolShortfall > 0;
  });
  const totalShortfall = shortfallLeases.reduce((s, l) => s + (MR_ADEQUACY[l.leaseId]?.eolShortfall ?? 0), 0);
```
with:
```typescript
  // ── Portfolio MR adequacy summary ──────────────────────────────────────────
  const shortfallLeases = displayData.filter((l) => (adequacyByLeaseId.get(l.leaseId)?.eolShortfall ?? 0) > 0);
  const totalShortfall = shortfallLeases.reduce((s, l) => s + (adequacyByLeaseId.get(l.leaseId)?.eolShortfall ?? 0), 0);
```

And further down in the alert banner JSX (around line 635):
```typescript
              {shortfallLeases.map((l) => `${l.lessee} (${fmtUSD(MR_ADEQUACY[l.leaseId]?.eolShortfall ?? 0)} shortfall)`).join(" · ")}
```
becomes:
```typescript
              {shortfallLeases.map((l) => `${l.lessee} (${fmtUSD(adequacyByLeaseId.get(l.leaseId)?.eolShortfall ?? 0)} shortfall)`).join(" · ")}
```

- [ ] **Step 4: Fix the per-row "MR Adequacy" table column (around line 691)**

Replace:
```typescript
                          const adeq = MR_ADEQUACY[lease.leaseId];
                          if (!adeq) return <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>—</span>;
                          const flag = adeq.flag as MRAdeqFlag;
```
with:
```typescript
                          const adeq = adequacyByLeaseId.get(lease.leaseId);
                          if (!adeq) return <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>—</span>;
                          const flag = adeq.flag;
```

(The `!adeq` guard stays as defensive code — `buildAdequacyMap` should always have an entry for every lease in `displayData` since it iterates that exact array, but keeping the guard costs nothing and protects against a future caller passing a mismatched map.) The rest of that render block (badge styling, `mrFlagBg(flag)` etc.) is unchanged since `flag`/`adeq` keep the same shape.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/components/portfolio/SDMRTab.tsx
git commit -m "fix: SDMRTab computes MR adequacy live for both the portfolio banner and per-row column"
```

---

### Task 5: Fix `portfolioAdapters.ts` → `toLeaseTableRows()`, both call sites, existing tests

**Files:**
- Modify: `src/app/lib/portfolioAdapters.ts:221-243`
- Modify: `src/app/pages/Portfolio.tsx`
- Modify: `src/app/pages/Dashboard.tsx`
- Test: `src/app/lib/portfolioAdapters.test.ts`

- [ ] **Step 1: Extend `toLeaseTableRows`'s signature with an optional adequacy map**

In `src/app/lib/portfolioAdapters.ts`, change:
```typescript
export function toLeaseTableRows(leases: Lease[], assets: Asset[], lessees: Lessee[]): LeaseTableRow[] {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);
  return leases.map((l) => {
    const asset = assetMap.get(l.asset_id);
    const lessee = lesseeMap.get(l.lessee_id);
    const mrData = MR_ADEQUACY[l.id] ?? null;
    return {
```
to:
```typescript
export function toLeaseTableRows(
  leases: Lease[],
  assets: Asset[],
  lessees: Lessee[],
  adequacyByLeaseId?: Map<string, MRAdequacy>,
): LeaseTableRow[] {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);
  return leases.map((l) => {
    const asset = assetMap.get(l.asset_id);
    const lessee = lesseeMap.get(l.lessee_id);
    const mrData = adequacyByLeaseId?.get(l.id) ?? null;
    return {
```

The 4th parameter is optional, defaulting to `undefined` (which makes every `mrData` lookup `null`, i.e. today's "no data" fallback) — this keeps every existing 3-arg caller (including the tests in Step 4 below) compiling unchanged; only the two real page call sites (Step 2/3) need to actually pass the map to get live data.

Update the import at the top of the file — remove `MR_ADEQUACY` from the `maintenanceHeuristics` import, add the `MRAdequacy` type from `MaintenanceForecastTab.tsx`:
```typescript
import { type MRAdeqFlag } from "../data/maintenanceHeuristics";
import { type MRAdequacy } from "../components/portfolio/MaintenanceForecastTab";
```
(Check the exact original import line — it was `import { MR_ADEQUACY, type MRAdeqFlag } from "../data/maintenanceHeuristics";` at line 6 — replace it with the two lines above.)

`mrData.flag`/`mrData.eolShortfall`/`mrData.eolShortfallPct` (lines 238-241, reading from `mrData`) are unchanged — `MRAdequacy` has the same field names as the old `MRAdeqResult`.

- [ ] **Step 2: Wire `Portfolio.tsx` to pass the live adequacy map**

`Portfolio.tsx` already computes `liveSDMRData` (lines 160-168). Add, immediately after that `useMemo`:

```typescript
  const liveAdequacyByLeaseId = useMemo(
    () => (liveSDMRData ? buildAdequacyMap(liveSDMRData) : undefined),
    [liveSDMRData],
  );
```

Add `buildAdequacyMap` to the existing import from `../components/portfolio/SDMRTab` — no wait, `buildAdequacyMap` lives in `MaintenanceForecastTab.tsx`, not `SDMRTab.tsx`. Add a new import line:
```typescript
import { buildAdequacyMap } from "../components/portfolio/MaintenanceForecastTab";
```

Then update the existing `toLeaseTableRows` call site (line 120):
```typescript
  const leases          = useMemo(() => toLeaseTableRows(leaseData, assets, lesseeData),    [leaseData, assets, lesseeData]);
```
to:
```typescript
  const leases          = useMemo(() => toLeaseTableRows(leaseData, assets, lesseeData, liveAdequacyByLeaseId),    [leaseData, assets, lesseeData, liveAdequacyByLeaseId]);
```

(In demo mode, `liveSDMRData` is `undefined` per its existing definition — `liveAdequacyByLeaseId` becomes `undefined` too, and `toLeaseTableRows` falls back to `mrData = null` for every row. This changes demo-mode `Portfolio.tsx` Leases-tab behavior slightly: demo leases will show no MR flag on this specific table, where previously they showed the static `MR_ADEQUACY` demo values. Confirm with a manual check in Task 9's verification step whether the demo-mode Leases tab needs a static-data fallback too — if so, extend the `liveAdequacyByLeaseId` fallback to `buildAdequacyMap(sdmrData)` from `SDMRTab.tsx`'s static export when `isDemo` is true, mirroring the pattern already used in `SDMRTab`/`MRPortfolioGrid` for demo fallback.)

- [ ] **Step 3: Wire `Dashboard.tsx` to pass the live adequacy map**

`Dashboard.tsx` does NOT currently compute `liveSDMRData` at all — it only calls `usePortfolioData()` for `assets, lesseeData, leaseData, provisions` (line 271). Add the same live-SDMR wiring `Portfolio.tsx` already has:

```typescript
import { useSdMr } from "../hooks/useSdMr";
import { buildLiveSDMRData } from "../components/portfolio/SDMRTab";
import { buildAdequacyMap } from "../components/portfolio/MaintenanceForecastTab";
```

Replace the existing `usePortfolioData()` destructure (line 271: `const { assets, lessees: lesseeData, leases: leaseData, provisions } = usePortfolioData();`) to also pull `isDemo`, and add the live-SDMR wiring right after it:
```typescript
  const { assets, lessees: lesseeData, leases: leaseData, provisions, isDemo } = usePortfolioData();
  const sdMr = useSdMr();
  const liveAdequacyByLeaseId = useMemo(() => {
    if (isDemo || assets.length === 0) return undefined;
    // @ts-expect-error TODO(safety-net): Asset[] cast to PAAsset[] — same pre-existing cast as Portfolio.tsx
    const liveSDMRData = buildLiveSDMRData(assets, lesseeData, leaseData, provisions, sdMr.depositsByLease, sdMr.reservesByLease);
    return buildAdequacyMap(liveSDMRData);
  }, [isDemo, assets, lesseeData, leaseData, provisions, sdMr.depositsByLease, sdMr.reservesByLease]);
```

Then update line 278:
```typescript
  const leases       = useMemo(() => toLeaseTableRows(leaseData, assets, lesseeData), [leaseData, assets, lesseeData]);
```
to:
```typescript
  const leases       = useMemo(() => toLeaseTableRows(leaseData, assets, lesseeData, liveAdequacyByLeaseId), [leaseData, assets, lesseeData, liveAdequacyByLeaseId]);
```

This mirrors Task 5 Step 2's demo-mode behavior for `Portfolio.tsx` exactly — same `isDemo` guard, same `undefined` fallback.

- [ ] **Step 4: Update existing tests in `portfolioAdapters.test.ts`**

Two existing tests assert the OLD `MR_ADEQUACY`-keyed behavior (lines 241-257) — they now test dead code (the 4-arg map param defaults to `undefined`, so `mrData` is always `null` regardless of lease id). Replace them:

Find and remove:
```typescript
  it("populates mrFlag and eolShortfall when lease id matches MR_ADEQUACY entry", () => {
    // LSE-2019-001 is "amber" in MR_ADEQUACY with eolShortfall 3_130_000, eolShortfallPct 14.1
    ...
  });

  it("sets MR fields to null for lease id not in MR_ADEQUACY", () => {
    // All MOCK_LEASES use "mock-ls*" ids which are not in MR_ADEQUACY
    ...
  });
```

Replace with:
```typescript
  it("populates mrFlag and eolShortfall from the adequacy map when provided", () => {
    const adequacyMap = new Map([
      ["mock-lease-1", { flag: "amber" as const, eolShortfall: 3_130_000, eolShortfallPct: 14.1, distressedEOLShortfall: 3_130_000 }],
    ]);
    const rows = toLeaseTableRows(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES, adequacyMap);
    const row = rows.find(r => r.id === "mock-lease-1")!;
    expect(row.mrFlag).toBe("amber");
    expect(row.eolShortfall).toBe(3_130_000);
    expect(row.eolShortfallPct).toBe(14.1);
  });

  it("sets MR fields to null when no adequacy map is provided", () => {
    const rows = toLeaseTableRows(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);
    expect(rows.every(r => r.mrFlag === null)).toBe(true);
  });

  it("sets MR fields to null when the adequacy map doesn't contain this lease's id", () => {
    const rows = toLeaseTableRows(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES, new Map());
    expect(rows.every(r => r.mrFlag === null)).toBe(true);
  });
```

(Check `MOCK_LEASES`' actual first entry id via `grep -n "MOCK_LEASES" src/app/lib/portfolioAdapters.test.ts` before writing the first new test — use whatever id the existing mock data actually has, substituting for `"mock-lease-1"` above if different.)

The two other call sites in the same test file (lines 48, 256) call `toLeaseTableRows(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES)` with 3 args — leave those unchanged, they're testing unrelated fields and the 4th param being absent is valid.

- [ ] **Step 5: Typecheck and run tests**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npm test -- --run portfolioAdapters`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/lib/portfolioAdapters.ts src/app/lib/portfolioAdapters.test.ts src/app/pages/Portfolio.tsx src/app/pages/Dashboard.tsx
git commit -m "fix: toLeaseTableRows computes MR adequacy from live data instead of dead MR_ADEQUACY lookup"
```

---

### Task 6: Fix `RiskECL.tsx`

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

`RiskECL.tsx` already calls `usePortfolioData()` (line 295) but has no SDMR wiring at all — it does its own inline `MR_ADEQUACY[row.id]` lookup at line 1201, cross-referencing MR shortfall against LGD offset in the ECL table.

- [ ] **Step 1: Add the same live-SDMR wiring pattern as `Dashboard.tsx` (Task 5, Step 3)**

Add imports:
```typescript
import { useSdMr } from "../hooks/useSdMr";
import { buildLiveSDMRData } from "../components/portfolio/SDMRTab";
import { buildAdequacyMap } from "../components/portfolio/MaintenanceForecastTab";
```

Remove `MR_ADEQUACY` from the existing `import { MR_ADEQUACY, mrFlagColor } from "../data/maintenanceHeuristics";` (line 2) — keep `mrFlagColor`.

Near line 295, after the existing `usePortfolioData()` destructure:
```typescript
  const { assets, lessees, leases, provisions, isLoading } = usePortfolioData();
```
add (the `assets.length === 0` guard calls `buildAdequacyMap([])` rather than hand-typing an empty `Map`, so the return type always matches without needing an explicit generic):
```typescript
  const sdMr = useSdMr();
  const adequacyByLeaseId = useMemo(() => {
    if (assets.length === 0) return buildAdequacyMap([]);
    // @ts-expect-error TODO(safety-net): Asset[] cast to PAAsset[] — same pre-existing cast as Portfolio.tsx
    const liveSDMRData = buildLiveSDMRData(assets, lessees, leases, provisions, sdMr.depositsByLease, sdMr.reservesByLease);
    return buildAdequacyMap(liveSDMRData);
  }, [assets, lessees, leases, provisions, sdMr.depositsByLease, sdMr.reservesByLease]);
```

Confirm `useMemo` is already imported in this file (it's a large existing page component — check the top-level React import line; add `useMemo` to it if missing).

- [ ] **Step 2: Fix the render-time lookup (around line 1201)**

Replace:
```typescript
                    const adeq = MR_ADEQUACY[row.id];
```
with:
```typescript
                    const adeq = adequacyByLeaseId.get(row.id);
```

Everything below that line (`if (!adeq || adeq.eolShortfall <= 0) ...`, the tooltip, the badge styling) reads `adeq.eolShortfall`/`adeq.eolShortfallPct`/`adeq.flag` — unchanged field names, no further edits needed in that block.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/RiskECL.tsx
git commit -m "fix: RiskECL computes MR shortfall/LGD-offset badge from live data instead of dead MR_ADEQUACY lookup"
```

---

### Task 7: Delete `MR_ADEQUACY` and `MRAdeqResult`

**Files:**
- Modify: `src/app/data/maintenanceHeuristics.ts`

- [ ] **Step 1: Confirm zero remaining references**

Run: `grep -rn "MR_ADEQUACY\|MRAdeqResult" src/app --include="*.ts" --include="*.tsx"`
Expected: zero matches outside `maintenanceHeuristics.ts` itself. If anything remains, stop and fix that call site first (it means Tasks 2-6 missed something) — do not proceed to Step 2 until this is clean.

- [ ] **Step 2: Delete the dead export**

In `src/app/data/maintenanceHeuristics.ts`, delete the `MRAdeqResult` interface and the `MR_ADEQUACY` const (the whole block from `export interface MRAdeqResult {` through the closing `};` of `MR_ADEQUACY`, roughly lines 216-265 per the file read earlier in this session — re-locate exact line numbers before editing since Tasks 1-6 may have shifted other files but not this one). Keep `MRAdeqFlag`, `mrFlagColor`, `mrFlagBg`, `mrFlagBorder` — all still used everywhere.

- [ ] **Step 3: Typecheck and run full test suite**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npm test -- --run`
Expected: all tests pass (full suite — this is the end of Phase 1, a good checkpoint to confirm nothing else broke)

- [ ] **Step 4: Commit**

```bash
git add src/app/data/maintenanceHeuristics.ts
git commit -m "chore: delete dead MR_ADEQUACY static table and MRAdeqResult type"
```

---

## Phase 2 — Live-wire the standalone Maintenance page

### Task 8: `Maintenance.tsx` uses `buildLiveSDMRData()` instead of static `sdmrData`

**Files:**
- Modify: `src/app/pages/Maintenance.tsx`

- [ ] **Step 1: Add live data wiring**

Add imports:
```typescript
import { usePortfolioData } from "../hooks/usePortfolioData";
import { useSdMr } from "../hooks/useSdMr";
import { buildLiveSDMRData } from "../components/portfolio/SDMRTab";
```

Inside the `Maintenance()` component, after the existing `useTabSync`/`activeTab` state setup and before the existing `const { reports, ... } = useAllServicerReports();` line, add:

```typescript
  const { assets, lessees, leases, provisions, isDemo } = usePortfolioData();
  const sdMr = useSdMr();
  const liveSDMRData = useMemo(() => {
    if (isDemo || assets.length === 0) return undefined;
    // @ts-expect-error TODO(safety-net): Asset[] cast to PAAsset[] — same pre-existing cast as Portfolio.tsx
    return buildLiveSDMRData(assets, lessees, leases, provisions, sdMr.depositsByLease, sdMr.reservesByLease);
  }, [isDemo, assets, lessees, leases, provisions, sdMr.depositsByLease, sdMr.reservesByLease]);
  const effectiveSDMRData = liveSDMRData ?? sdmrData;  // static sdmrData import stays as the demo-mode fallback
```

- [ ] **Step 2: Replace every direct use of the static `sdmrData` with `effectiveSDMRData`**

Currently the component does:
```typescript
  const adjustedLeases: AdjustedLease[] = useMemo(
    () => sdmrData.map(raw =>
      adjustedLease(raw, reports.get(raw.leaseId) ?? null, eventsMap.get(raw.leaseId) ?? [])
    ),
    [reports, eventsMap],
  );

  const chartData = useMemo(() => toMRChartData(sdmrData), []);
  const leaseLessees = useMemo(
    () => Object.fromEntries(sdmrData.map((l) => [l.leaseId, l.lessee])),
    []
  );
```

Change all three `sdmrData` references to `effectiveSDMRData`, and fix the dependency arrays accordingly:
```typescript
  const adjustedLeases: AdjustedLease[] = useMemo(
    () => effectiveSDMRData.map(raw =>
      adjustedLease(raw, reports.get(raw.leaseId) ?? null, eventsMap.get(raw.leaseId) ?? [])
    ),
    [effectiveSDMRData, reports, eventsMap],
  );

  const chartData = useMemo(() => toMRChartData(effectiveSDMRData), [effectiveSDMRData]);
  const leaseLessees = useMemo(
    () => Object.fromEntries(effectiveSDMRData.map((l) => [l.leaseId, l.lessee])),
    [effectiveSDMRData]
  );
```

Confirm `useMemo` is already imported (it is — line 2 of the existing file: `import { useState, useEffect, useMemo } from "react";`).

The `sdmrData` import itself (`import { sdmrData } from "../components/portfolio/SDMRTab";`) stays — it's now only used as the fallback inside `effectiveSDMRData`, not referenced directly elsewhere in the file.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Manual verification (this page has no automated tests today — presentational, same as `MRPortfolioGrid.tsx`)**

This requires a real Supabase session and cannot be done by an agent without one — flag this as a task for the human to verify post-merge (same pattern as prior passes this session): open the Maintenance page with a real uploaded portfolio and confirm Overview/Aircraft Detail/Scenario Modelling all show real leases, not the demo IndiGo/Aeromexico/Emirates set.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/Maintenance.tsx
git commit -m "feat: Maintenance page uses live portfolio data instead of static demo dataset"
```

---

## Phase 3 — Redelivery / return-condition risk view

### Task 9: New "Redelivery Risk" tab on the Maintenance page

**Files:**
- Create: `src/app/components/maintenance/RedeliveryRiskTab.tsx`
- Modify: `src/app/pages/Maintenance.tsx`

- [ ] **Step 1: Build the component**

Reuses `buildProjections`/`computeMRAdequacy` — no new calc logic, this is presentational. Takes the same `adjustedLeases: AdjustedLease[]` shape `MRPortfolioGrid` already consumes.

```typescript
// src/app/components/maintenance/RedeliveryRiskTab.tsx
import { useMemo } from "react";
import { Card } from "../ui/Card";
import { mrFlagColor, mrFlagBg, mrFlagBorder, type MRAdeqFlag } from "../../data/maintenanceHeuristics";
import type { AdjustedLease } from "../../utils/maintenanceEvents";
import { buildProjections, computeMRAdequacy, LEASE_CONTEXT, type ComponentProjection } from "../portfolio/MaintenanceForecastTab";

const CONTEXT_BY_LEASE_ID: Record<string, { msn: string; leaseEnd: string }> = Object.fromEntries(
  Object.entries(LEASE_CONTEXT).map(([msn, ctx]) => [ctx.leaseId, { msn, leaseEnd: ctx.leaseEnd }])
);

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtUSD(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}k`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function worstComponent(projections: ComponentProjection[]): string {
  const worst = [...projections].sort((a, b) => b.eolShortfall - a.eolShortfall)[0];
  return worst && worst.eolShortfall > 0 ? worst.component : "—";
}

interface Props {
  adjustedLeases: AdjustedLease[];
}

export function RedeliveryRiskTab({ adjustedLeases }: Props) {
  const NOW = new Date(2026, 4, 1);

  const rows = useMemo(() => {
    return adjustedLeases
      .map(({ lease, utilOverride }) => {
        const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
        const leaseEndDate = lease.leaseEnd
          ? parseDateLocal(lease.leaseEnd)
          : ctx
          ? parseDateLocal(ctx.leaseEnd)
          : new Date(2028, 0, 1);
        const projections = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride);
        const adequacy = computeMRAdequacy(projections);
        const monthsRemaining = Math.max(0, monthsBetween(NOW, leaseEndDate));
        return {
          leaseId: lease.leaseId,
          lessee: lease.lessee,
          aircraft: lease.aircraft,
          msn: ctx?.msn ?? "—",
          leaseEndDate,
          monthsRemaining,
          adequacy,
          worstComponent: worstComponent(projections),
        };
      })
      .filter(r => r.adequacy.flag !== "green")
      .sort((a, b) => {
        if (a.adequacy.flag !== b.adequacy.flag) return a.adequacy.flag === "red" ? -1 : 1;
        return b.adequacy.eolShortfall - a.adequacy.eolShortfall;
      });
  }, [adjustedLeases]);

  if (rows.length === 0) {
    return (
      <Card noPadding>
        <div style={{ padding: "2rem", textAlign: "center", color: "#15803D", fontSize: "0.875rem", fontWeight: 500 }}>
          All leases on track to meet their return condition.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Redelivery Risk" subtitle="Leases at risk of missing their return condition, ranked by shortfall" noPadding>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #E2E8F0", background: "#F8FAFC" }}>
            {["Lease", "Aircraft / MSN", "Lease End", "Months Left", "Flag", "Shortfall", "% of Obligation", "Driven By"].map(h => (
              <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.leaseId} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
              <td style={{ padding: "0.625rem 1rem", fontWeight: 600, color: "#0F172A" }}>{r.lessee}</td>
              <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{r.aircraft} · {r.msn}</td>
              <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{r.leaseEndDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</td>
              <td style={{ padding: "0.625rem 1rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{r.monthsRemaining}</td>
              <td style={{ padding: "0.625rem 1rem" }}>
                <span style={{
                  fontSize: "0.6875rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "0.375rem",
                  background: mrFlagBg(r.adequacy.flag), color: mrFlagColor(r.adequacy.flag),
                  border: `1px solid ${mrFlagBorder(r.adequacy.flag)}`,
                }}>
                  {r.adequacy.flag.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: "0.625rem 1rem", fontWeight: 600, color: r.adequacy.eolShortfall > 0 ? "#B91C1C" : "#15803D", fontVariantNumeric: "tabular-nums" }}>
                {fmtUSD(r.adequacy.eolShortfall)}
              </td>
              <td style={{ padding: "0.625rem 1rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{r.adequacy.eolShortfallPct.toFixed(1)}%</td>
              <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{r.worstComponent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
```

`MRAdeqFlag` import is unused if not referenced as a type annotation anywhere in this file directly — check after writing; if TypeScript flags it unused, remove it from the import list (the flag values are used as string literals via `r.adequacy.flag`, which is typed via `computeMRAdequacy`'s return type, so an explicit `MRAdeqFlag` import may not be needed at all — omit it unless `tsc` says otherwise).

- [ ] **Step 2: Wire the new tab into `Maintenance.tsx`**

Add to the imports:
```typescript
import { RedeliveryRiskTab } from "../components/maintenance/RedeliveryRiskTab";
```

Update the tab config:
```typescript
const PATH_TAB: Record<string, string> = {
  "/maintenance":            "Overview",
  "/maintenance/aircraft":   "Aircraft Detail",
  "/maintenance/scenarios":  "Scenario Modelling",
  "/maintenance/redelivery": "Redelivery Risk",
};

const TABS = ["Overview", "Aircraft Detail", "Scenario Modelling", "Redelivery Risk"];
```

Add the render branch, alongside the existing `{activeTab === "Scenario Modelling" && (...)}` block:
```typescript
      {activeTab === "Redelivery Risk" && (
        <RedeliveryRiskTab adjustedLeases={adjustedLeases} />
      )}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/components/maintenance/RedeliveryRiskTab.tsx src/app/pages/Maintenance.tsx
git commit -m "feat: add portfolio-wide Redelivery Risk tab to Maintenance page"
```

---

## Phase 4 — Org-level cost benchmark tier

### Task 10: `org_cost_benchmarks` migration

**Files:**
- Create: `supabase/migrations/20260729120000_org_cost_benchmarks.sql`

- [ ] **Step 1: Write the migration**

Exact mirror of `supabase/migrations/20260728120000_mr_cost_overrides.sql`'s shape and RLS pattern, scoped to `(org_id, aircraft_type, component)` instead of `(org_id, lease_id, component)`:

```sql
-- One row per (org_id, aircraft_type, component). The middle tier of the 3-way
-- cost resolution chain: per-lease override (mr_cost_overrides) > org benchmark
-- (this table) > global heuristic (TYPE_HEURISTICS). Lets an org record its own
-- negotiated/observed MRO cost for an aircraft type without needing per-lease
-- evidence — e.g. "every A320neo Engine PR we've actually paid for costs closer
-- to $6.1M than the global heuristic's $5.8M."
--
-- RLS follows the same org-scoped pattern as mr_cost_overrides
-- (20260728120000_mr_cost_overrides.sql), itself following the corrected
-- pattern from 20260528120000_security_audit_rls_lockdown.sql.

create table if not exists org_cost_benchmarks (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null references organisations(id) on delete cascade,
  aircraft_type text        not null,   -- matches TYPE_HEURISTICS keys, e.g. "A320neo"
  component     text        not null,   -- "Engine PR", "Airframe HSI", "LLPs", "Landing Gear", "APU"
  cost_usd      numeric     not null,
  note          text,
  created_by    text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists org_cost_benchmarks_org_type_component_uidx
  on org_cost_benchmarks(org_id, aircraft_type, component);

create index if not exists org_cost_benchmarks_org_idx
  on org_cost_benchmarks(org_id);

alter table org_cost_benchmarks enable row level security;
alter table org_cost_benchmarks force  row level security;

create policy org_cost_benchmarks_select_own_org on org_cost_benchmarks
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy org_cost_benchmarks_insert_own_org on org_cost_benchmarks
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy org_cost_benchmarks_update_own_org on org_cost_benchmarks
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                          with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy org_cost_benchmarks_delete_own_org on org_cost_benchmarks
  for delete to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
```

- [ ] **Step 2: Verify the file is syntactically consistent with the mirrored migration**

Run: `diff <(grep -o '^\(create\|alter\|drop\) [a-z ]*' supabase/migrations/20260728120000_mr_cost_overrides.sql) <(grep -o '^\(create\|alter\|drop\) [a-z ]*' supabase/migrations/20260729120000_org_cost_benchmarks.sql)`
Expected: only the table-name and column-name differences show up (no structural DDL statements missing) — this is a sanity check, not a formal test; read the diff output and confirm it matches (same statement types in the same order: create table, create unique index, create index, enable RLS, force RLS, 4 policies).

Note: this migration is **not** applied to the live Supabase database as part of this task — that's a manual step (same as `mr_cost_overrides` was in the prior pass), done once this branch is merged and the human is available to run `apply_migration` against the live project.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260729120000_org_cost_benchmarks.sql
git commit -m "feat: add org_cost_benchmarks table with org-scoped RLS"
```

---

### Task 11: `useOrgCostBenchmarks` hook

**Files:**
- Create: `src/app/hooks/useOrgCostBenchmarks.ts`

Direct mirror of `src/app/hooks/useCostOverrides.ts`, scoped to `aircraftType` instead of `leaseId`.

- [ ] **Step 1: Write the hook**

```typescript
// src/app/hooks/useOrgCostBenchmarks.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { logAudit } from "../services/auditLog";

export interface OrgCostBenchmark {
  id: string;
  aircraftType: string;
  component: string;
  costUSD: number;
  note: string | null;
  createdBy: string;
  updatedAt: string;
}

export interface UseOrgCostBenchmarksReturn {
  benchmarks: Record<string, OrgCostBenchmark>;  // component name → benchmark
  loading: boolean;
  saving: boolean;
  saveBenchmarks: (changes: Record<string, number>, note: string | null) => Promise<void>;
  clearBenchmarks: () => Promise<void>;
}

function mapRow(row: Record<string, unknown>): OrgCostBenchmark {
  return {
    id:           row.id as string,
    aircraftType: row.aircraft_type as string,
    component:    row.component as string,
    costUSD:      Number(row.cost_usd),
    note:         (row.note as string | null) ?? null,
    createdBy:    row.created_by as string,
    updatedAt:    row.updated_at as string,
  };
}

export function useOrgCostBenchmarks(aircraftType: string | null): UseOrgCostBenchmarksReturn {
  const { orgId } = useData();
  const [benchmarks, setBenchmarks] = useState<Record<string, OrgCostBenchmark>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId || !aircraftType) { setBenchmarks({}); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("org_cost_benchmarks")
        .select("*")
        .eq("org_id", orgId)
        .eq("aircraft_type", aircraftType);

      if (cancelled) { setLoading(false); return; }
      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useOrgCostBenchmarks] load error:", error);
        }
        setLoading(false);
        return;
      }
      const rows = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
      setBenchmarks(Object.fromEntries(rows.map(r => [r.component, r])));
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId, aircraftType]);

  const saveBenchmarks = useCallback(async (changes: Record<string, number>, note: string | null) => {
    if (!orgId || !aircraftType || Object.keys(changes).length === 0) return;
    setSaving(true);
    const actor = (await supabase.auth.getUser()).data.user?.email ?? "unknown";
    const now = new Date().toISOString();
    const snapshot = benchmarks;

    setBenchmarks(prev => {
      const next = { ...prev };
      for (const [component, costUSD] of Object.entries(changes)) {
        next[component] = { id: next[component]?.id ?? "temp", aircraftType, component, costUSD, note, createdBy: actor, updatedAt: now };
      }
      return next;
    });

    try {
      const payload = Object.entries(changes).map(([component, costUSD]) => ({
        org_id: orgId, aircraft_type: aircraftType, component, cost_usd: costUSD, note,
        created_by: actor, updated_at: now,
      }));
      const { data: rows, error } = await supabase
        .from("org_cost_benchmarks")
        .upsert(payload, { onConflict: "org_id,aircraft_type,component" })
        .select();

      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useOrgCostBenchmarks] save error:", error);
        }
        setBenchmarks(snapshot);
        throw error;
      }

      const savedRows = (rows ?? []).map((r) => mapRow(r as Record<string, unknown>));
      setBenchmarks(prev => {
        const next = { ...prev };
        for (const row of savedRows) next[row.component] = row;
        return next;
      });

      for (const [component, costUSD] of Object.entries(changes)) {
        void logAudit({
          orgId,
          entityType: "org_cost_benchmark",
          entityId: `${aircraftType}:${component}`,
          action: "override",
          before: null,
          after: { costUSD, note },
          note,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [orgId, aircraftType, benchmarks]);

  const clearBenchmarks = useCallback(async () => {
    if (!orgId || !aircraftType) return;
    setSaving(true);
    const snapshot = benchmarks;
    setBenchmarks({});

    try {
      const { error } = await supabase
        .from("org_cost_benchmarks")
        .delete()
        .eq("org_id", orgId)
        .eq("aircraft_type", aircraftType);

      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useOrgCostBenchmarks] clear error:", error);
        }
        setBenchmarks(snapshot);
        throw error;
      }

      void logAudit({
        orgId,
        entityType: "org_cost_benchmark",
        entityId: aircraftType,
        action: "reset",
        before: snapshot,
        after: null,
        note: null,
      });
    } finally {
      setSaving(false);
    }
  }, [orgId, aircraftType, benchmarks]);

  return { benchmarks, loading, saving, saveBenchmarks, clearBenchmarks };
}
```

Before writing this file, read `src/app/services/auditLog.ts`'s `logAudit` signature to confirm the exact param names (`orgId, entityType, entityId, action, before, after, note`) match what's used elsewhere in this codebase — `useCostOverrides.ts` already calls it with this exact shape, so copy that call pattern precisely rather than the illustrative version above if there's any drift.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (this hook has no dedicated unit test — same as `useCostOverrides.ts`, which is also untested directly; it's exercised via the component that consumes it in Task 13, and via manual verification)

- [ ] **Step 3: Commit**

```bash
git add src/app/hooks/useOrgCostBenchmarks.ts
git commit -m "feat: add useOrgCostBenchmarks hook for org-level MR cost benchmarks"
```

---

### Task 12: 3-tier cost resolution in `buildProjections()` with tests

**Files:**
- Modify: `src/app/components/portfolio/MaintenanceForecastTab.tsx`
- Test: `src/app/components/portfolio/MaintenanceForecastTab.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `MaintenanceForecastTab.test.ts`:

```typescript
// ── buildProjections — 3-tier cost resolution (org benchmark) ─────────────────

describe("buildProjections — org benchmark cost tier", () => {
  const ORG_BENCHMARK: Record<string, OrgCostBenchmark> = {
    "Airframe HSI": { id: "b1", aircraftType: "A320neo", component: "Airframe HSI", costUSD: 7_000_000, note: null, createdBy: "a@b.com", updatedAt: "2026-07-29T00:00:00Z" },
  };
  const LEASE_OVERRIDE: Record<string, CostOverride> = {
    "Airframe HSI": { id: "o1", leaseId: "LSE-TEST-001", component: "Airframe HSI", costUSD: 7_500_000, note: null, createdBy: "c@d.com", updatedAt: "2026-07-29T00:00:00Z" },
  };

  it("uses the org benchmark when present and no per-lease override exists", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, undefined, ORG_BENCHMARK);
    expect(p.heuristicEventCost).toBe(7_000_000);
    expect(p.costSource).toBe("org-benchmark");
  });

  it("per-lease override wins over the org benchmark when both exist", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, LEASE_OVERRIDE, ORG_BENCHMARK);
    expect(p.heuristicEventCost).toBe(7_500_000);
    expect(p.costSource).toBe("override");
  });

  it("falls back to the global heuristic when neither override nor benchmark exists", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p.costSource).toBe("heuristic");
  });

  it("populates orgBenchmarkMeta only when costSource is org-benchmark", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, undefined, ORG_BENCHMARK);
    expect(p.orgBenchmarkMeta).toEqual({ createdBy: "a@b.com", updatedAt: "2026-07-29T00:00:00Z", note: null });

    const [p2] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p2.orgBenchmarkMeta).toBeUndefined();
  });
});
```

Add the `OrgCostBenchmark` type import at the top of the test file:
```typescript
import type { OrgCostBenchmark } from "../../hooks/useOrgCostBenchmarks";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run MaintenanceForecastTab`
Expected: FAIL — `buildProjections` doesn't accept a 6th argument yet, `costSource` union doesn't include `"org-benchmark"`, `orgBenchmarkMeta` doesn't exist

- [ ] **Step 3: Implement the 3-tier resolution**

In `src/app/components/portfolio/MaintenanceForecastTab.tsx`:

Add the import:
```typescript
import type { OrgCostBenchmark } from "../../hooks/useOrgCostBenchmarks";
```

Update `ComponentProjection` (currently lines 59-74):
```typescript
export interface ComponentProjection {
  component: ComponentName;
  currentBalance: number;
  monthlyAccrual: number;
  monthsToNextEvent: number;
  nextEventDate: Date;
  projectedBalanceAtEvent: number;
  heuristicEventCost: number;
  costSource: "heuristic" | "org-benchmark" | "override";
  costOverrideMeta?: { createdBy: string; updatedAt: string; note: string | null };
  orgBenchmarkMeta?: { createdBy: string; updatedAt: string; note: string | null };
  shortfallAtEvent: number;
  projectedBalanceAtEOL: number;
  eolObligation: number;
  eolShortfall: number;
  distressedEOLShortfall: number;
}
```

Update `buildProjections`'s signature and cost resolution (currently lines 82-108):
```typescript
export function buildProjections(
  lease: LeaseSDMR,
  aircraftType: string,
  leaseEndDate: Date,
  utilOverride?: UtilOverride,
  costOverrides?: Record<string, CostOverride>,
  orgBenchmarks?: Record<string, OrgCostBenchmark>,
): ComponentProjection[] {
  const heuristic = TYPE_HEURISTICS[aircraftType] ?? TYPE_HEURISTICS["A320neo"];
  const now = new Date(2026, 4, 1);
  const monthsToEOL = Math.max(0, monthsBetween(now, leaseEndDate));

  return lease.mrComponents.map((comp: MRComponent): ComponentProjection => {
    const h = heuristic.components[comp.component];
    const monthlyUtil = comp.rateBasis === "$/FH"
      ? (utilOverride?.annualFH ?? heuristic.utilizationFH) / 12
      : (utilOverride?.annualCy ?? heuristic.utilizationCy) / 12;

    const remainingUnits    = utilOverride?.componentRemaining[comp.component] ?? comp.remainingUnits;
    const monthlyAccrual    = comp.rateAmount * monthlyUtil;
    const monthsToNextEvent = remainingUnits / monthlyUtil;
    const nextEventDate     = addMonths(now, monthsToNextEvent);

    const projectedBalanceAtEvent = comp.cumulativeBalance + remainingUnits * comp.rateAmount;
    const costOverride = costOverrides?.[comp.component];
    const orgBenchmark = orgBenchmarks?.[comp.component];
    const heuristicEventCost =
      costOverride ? costOverride.costUSD :
      orgBenchmark ? orgBenchmark.costUSD :
      (h ? h.costUSD : comp.fullIntervalUnits * comp.rateAmount);
    const costSource: "heuristic" | "org-benchmark" | "override" =
      costOverride ? "override" : orgBenchmark ? "org-benchmark" : "heuristic";
    const shortfallAtEvent = heuristicEventCost - projectedBalanceAtEvent;

    const projectedBalanceAtEOL = comp.cumulativeBalance + monthsToEOL * monthlyAccrual;

    const remainingAtEOL = Math.max(0, remainingUnits - monthsToEOL * monthlyUtil);
    const usedInInterval = (h?.intervalFH ?? comp.fullIntervalUnits) - remainingAtEOL;
    const eolObligation  = usedInInterval * comp.rateAmount;

    const distressedBalance     = comp.cumulativeBalance;
    const currentUsed           = comp.fullIntervalUnits - remainingUnits;
    const currentObligation     = currentUsed * comp.rateAmount;
    const distressedEOLShortfall = currentObligation - distressedBalance;

    return {
      component:                comp.component as ComponentName,
      currentBalance:           comp.cumulativeBalance,
      monthlyAccrual,
      monthsToNextEvent,
      nextEventDate,
      projectedBalanceAtEvent,
      heuristicEventCost,
      costSource,
      costOverrideMeta: costOverride
        ? { createdBy: costOverride.createdBy, updatedAt: costOverride.updatedAt, note: costOverride.note }
        : undefined,
      orgBenchmarkMeta: (orgBenchmark && !costOverride)
        ? { createdBy: orgBenchmark.createdBy, updatedAt: orgBenchmark.updatedAt, note: orgBenchmark.note }
        : undefined,
      shortfallAtEvent,
      projectedBalanceAtEOL,
      eolObligation,
      eolShortfall:             eolObligation - projectedBalanceAtEOL,
      distressedEOLShortfall,
    };
  });
}
```

(`orgBenchmarkMeta` is only populated when `costSource === "org-benchmark"` — i.e. an org benchmark exists AND no per-lease override supersedes it. This matches the test in Step 1: when a lease override exists, `costSource` is `"override"` and `orgBenchmarkMeta` stays `undefined` even though an org benchmark also technically exists in the input — only one provenance tag is shown at a time, matching whichever tier actually won.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run MaintenanceForecastTab`
Expected: PASS, all tests including the new 3-tier cost resolution block

- [ ] **Step 5: Run full test suite (this touches a widely-shared function)**

Run: `npm test -- --run`
Expected: all tests pass — `buildProjections`'s existing callers (`MRPortfolioGrid.tsx`, `RedeliveryRiskTab.tsx`, `ScenarioModellingTab.tsx`, `AircraftDetailTab.tsx`) all call it with fewer than 6 args, which is safe since the two new params are optional and appended at the end — but confirm no caller is doing positional-arg-shifting that would be affected (it shouldn't, since nothing was inserted before the existing 5 params, only appended after).

- [ ] **Step 6: Commit**

```bash
git add src/app/components/portfolio/MaintenanceForecastTab.tsx src/app/components/portfolio/MaintenanceForecastTab.test.ts
git commit -m "feat: 3-tier cost resolution in buildProjections — org benchmark between heuristic and per-lease override"
```

---

### Task 13: UI — badge 3rd state + org benchmark admin section

**Files:**
- Modify: `src/app/components/portfolio/MaintenanceForecastTab.tsx` (wire the hook, add the badge state)
- Modify: `src/app/pages/Settings.tsx` (admin section for managing benchmarks per aircraft type)

- [ ] **Step 1: Wire `useOrgCostBenchmarks` into `MaintenanceForecastTab.tsx`**

Add the import:
```typescript
import { useOrgCostBenchmarks } from "../../hooks/useOrgCostBenchmarks";
```

Near the existing hook calls (line 208, alongside `useCostOverrides`):
```typescript
  const { overrides: costOverrides, saving: costSaving, saveOverrides, clearOverrides } = useCostOverrides(leaseId);
  const { benchmarks: orgBenchmarks } = useOrgCostBenchmarks(aircraftType);
```

Update the `buildProjections` call (line 243) to pass the 6th argument:
```typescript
  const projections = buildProjections(leaseRecord, aircraftType, leaseEndDate, utilOverride, costOverrides, orgBenchmarks);
```

- [ ] **Step 2: Add the 3rd badge state to the Component Projection Table**

Find the existing badge rendering logic for `p.costSource` (the navy "Override" pill / grey "Heuristic" label, added in the prior pass — search for `costSource === "override"` in the table row rendering). Add a middle case for `"org-benchmark"`:

```typescript
{p.costSource === "override" ? (
  <span
    title={`Set by ${p.costOverrideMeta?.createdBy} on ${p.costOverrideMeta?.updatedAt ? new Date(p.costOverrideMeta.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}${p.costOverrideMeta?.note ? ` — ${p.costOverrideMeta.note}` : ""}`}
    style={{ background: "#002147", color: "#fff", fontSize: "0.625rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 6px" }}
  >
    Override
  </span>
) : p.costSource === "org-benchmark" ? (
  <span
    title={`Org benchmark set by ${p.orgBenchmarkMeta?.createdBy} on ${p.orgBenchmarkMeta?.updatedAt ? new Date(p.orgBenchmarkMeta.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}${p.orgBenchmarkMeta?.note ? ` — ${p.orgBenchmarkMeta.note}` : ""}`}
    style={{ background: "#0369A1", color: "#fff", fontSize: "0.625rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 6px" }}
  >
    Org Benchmark
  </span>
) : (
  <span style={{ color: "#94A3B8", fontSize: "0.6875rem", fontWeight: 500 }}>Heuristic</span>
)}
```

Locate the exact existing conditional (`p.costSource === "override" ? (...) : (...)` two-way ternary) and convert it to the three-way version above, preserving whatever exact JSX wrapper/cell structure already exists around it (don't restructure the surrounding `<td>`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Add the org benchmark admin section to `Settings.tsx`**

This is a new, standalone settings section — an aircraft-type picker (reuse the same 12-type list as `TYPE_HEURISTICS`' keys) plus a per-component cost input, mirroring the "Component cost overrides" collapsible sub-section already built in `MaintenanceForecastTab.tsx` in the prior pass, but scoped to a type instead of a lease. Add it as a new card within whichever existing Settings tab makes sense structurally (likely alongside "Scenario Weights"/"SICR Triggers" on the same ECL-config tab, since it's a portfolio-wide numeric-assumption setting in the same spirit — confirm placement against the existing `PillTabs`/`activeTab` structure in `Settings.tsx` before adding).

```typescript
function OrgCostBenchmarksSection() {
  const [selectedType, setSelectedType] = useState<string>("A320neo");
  const { benchmarks, saving, saveBenchmarks, clearBenchmarks } = useOrgCostBenchmarks(selectedType);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const componentNames = ["Airframe HSI", "Engine PR", "LLPs", "Landing Gear", "APU"];

  async function handleSave() {
    const changes: Record<string, number> = {};
    for (const [comp, val] of Object.entries(drafts)) {
      if (val === "") continue;
      const n = parseFloat(val);
      if (!isNaN(n) && n >= 0) changes[comp] = n;
    }
    if (Object.keys(changes).length === 0) return;
    await saveBenchmarks(changes, note || null);
    setDrafts({});
    setNote("");
  }

  return (
    <Card title="Org Cost Benchmarks" subtitle="Your org's own observed maintenance costs per aircraft type — sits between the global heuristic and per-lease overrides">
      <select value={selectedType} onChange={e => setSelectedType(e.target.value)} style={{ marginBottom: "1rem", padding: "0.375rem 0.625rem", borderRadius: "0.375rem", border: "1px solid #E2E8F0" }}>
        {Object.keys(TYPE_HEURISTICS).map(type => <option key={type} value={type}>{type}</option>)}
      </select>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {componentNames.map(comp => (
          <div key={comp} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ width: "8rem", fontSize: "0.8125rem", color: "#475569" }}>{comp}</span>
            <input
              type="number"
              placeholder={benchmarks[comp] ? String(benchmarks[comp].costUSD) : "Heuristic default"}
              value={drafts[comp] ?? ""}
              onChange={e => setDrafts(d => ({ ...d, [comp]: e.target.value }))}
              style={{ padding: "0.375rem 0.625rem", borderRadius: "0.375rem", border: "1px solid #E2E8F0", width: "12rem" }}
            />
          </div>
        ))}
        <input
          type="text"
          placeholder="Evidence note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          style={{ padding: "0.375rem 0.625rem", borderRadius: "0.375rem", border: "1px solid #E2E8F0" }}
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" onClick={() => void handleSave()} disabled={saving} style={{ padding: "0.375rem 0.875rem", background: "#002147", color: "#FFFFFF", border: "none", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving…" : "Save"}
          </button>
          {Object.keys(benchmarks).length > 0 && (
            <button type="button" onClick={() => void clearBenchmarks()} disabled={saving} style={{ padding: "0.375rem 0.875rem", background: "transparent", color: "#B91C1C", border: "1px solid #FCA5A5", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
            Reset to heuristic
          </button>
          )}
        </div>
      </div>
    </Card>
  );
}
```

Add the needed imports to `Settings.tsx`: `useOrgCostBenchmarks` from `../hooks/useOrgCostBenchmarks`, `TYPE_HEURISTICS` from `../data/maintenanceHeuristics`. Render `<OrgCostBenchmarksSection />` inside the chosen tab's JSX block, next to the other `<Card title="...">` sections in that tab.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Manual verification (requires a real Supabase session, same as Task 8 Step 4)**

Flag for the human: confirm the 3-tier badge (grey/blue/navy) renders correctly on the Maintenance Forecast tab when an org benchmark is set with no per-lease override, and that setting a per-lease override on top of an existing org benchmark correctly switches the badge to navy "Override" (org benchmark tier still exists underneath, just not the one currently winning).

- [ ] **Step 7: Commit**

```bash
git add src/app/components/portfolio/MaintenanceForecastTab.tsx src/app/pages/Settings.tsx
git commit -m "feat: org cost benchmark admin UI + 3-tier badge in Maintenance Forecast tab"
```

---

## Self-Review Notes (for whoever executes this plan)

- **Spec coverage:** Phase 1 covers spec section 4.1 (and extends it — 6 call sites found, not 3). Phase 2 covers 4.2. Phase 3 covers 4.3. Phase 4 covers 4.4. All four spec sections have a corresponding phase.
- **Known open question carried into Task 5:** whether `Portfolio.tsx`'s Leases-tab demo-mode behavior needs a static-data adequacy fallback (today's `MR_ADEQUACY`-backed demo values vs. no flag at all) — flagged inline in Task 5 Step 2 rather than pre-decided, since it's a small, easily-reversible UI-only choice best made by whoever can see the demo tab render both ways.
- **Type consistency check:** `MRAdequacy` (Task 1) → consumed by `toLeaseTableRows` (Task 5), `SDMRTab.tsx` (Task 4), `RiskECL.tsx` (Task 6) — same field names (`flag`, `eolShortfall`, `eolShortfallPct`) throughout, no renaming across tasks. `costSource`'s three literal values (`"heuristic" | "org-benchmark" | "override"`, Task 12) match exactly what Task 13's badge conditional checks against.
- This plan is large (13 tasks across 4 phases). Recommend executing Phase 1 fully (Tasks 1-7) and getting it reviewed/merged before starting Phase 2 — it's the foundation, fixes a real production bug on its own, and is independently shippable. Phases 2-4 can follow in the same branch or as separate follow-on passes, matching how this session's prior MR work was sequenced (cost provenance was its own complete pass after Board Pack wiring, which was its own pass after live calibration).
