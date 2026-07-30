# MR Cost Tier Expansion + Real-Data Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two pre-existing bugs that make Aircraft Detail and Scenario Modelling non-functional for real (non-demo) portfolios, then thread the 3-tier cost resolution (per-lease override → org benchmark → global heuristic) into the 5 remaining `buildProjections` call sites that currently only use the heuristic.

**Architecture:** Phase A (Tasks 1-2) fixes two independent, pre-existing data-wiring bugs discovered while scoping Phase B — neither depends on the other, both predate this session's MR work. Phase B (Tasks 3-9) adds two new bulk-fetch hooks (`useAllCostOverrides`, `useAllOrgCostBenchmarks`), mirroring the exact existing pattern in `useAllServicerReports.ts`, then wires them into every remaining consumer of `buildProjections`.

**Tech Stack:** React, TypeScript, Supabase, Vitest. No new libraries, no schema changes (reads existing `mr_cost_overrides`/`org_cost_benchmarks` tables).

---

## Phase A — Fix real-data bugs in Aircraft Detail and Scenario Modelling

### Task 1: Fix `AircraftDetailTab.tsx` — embedded table shows nothing for real leases

**Files:**
- Modify: `src/app/components/maintenance/AircraftDetailTab.tsx`

**The bug:** `MaintenanceForecastTab` (rendered at line 122-126) is called without its `liveRecord` prop. Inside that component, when `liveRecord` is absent it falls back to `LEASE_CONTEXT[msn]` — a table with only 6 fictional demo MSNs. `AircraftDetailTab`'s own `aircraftList` (line 40-53) resolves `msn` via a `LEASE_CONTEXT` reverse lookup that also only matches demo leases, so for any real lease `msn` is `""`, `LEASE_CONTEXT[""]` is `undefined`, and the whole embedded projection table renders "No maintenance data available for MSN ." — even though the balance chart directly above it (which uses `selectedLease` — the real `LeaseSDMR` object — directly) renders correctly. This predates this session's work.

- [ ] **Step 1: Fix the `aircraftList` msn fallback**

Find (line 40-53):
```typescript
  const aircraftList = useMemo(() => adjustedLeases.map(({ lease, utilOverride }) => {
    const entry = Object.entries(LEASE_CONTEXT).find(([, ctx]) => ctx.leaseId === lease.leaseId);
    const msn = entry?.[0] ?? "";
    const ctx = msn ? LEASE_CONTEXT[msn] : null;
    return {
      leaseId:     lease.leaseId,
      msn,
      lessee:      lease.lessee,
      aircraft:    lease.aircraft,
      leaseEnd:    ctx?.leaseEnd ?? "2030-01-01",
      lease,
      utilOverride,
    };
  }), [adjustedLeases]);
```
Change the `msn` fallback from `""` to the lease's own id — `LeaseSDMR` carries no real MSN field (confirmed: `buildLiveSDMRData` doesn't propagate `asset.msn` onto the `LeaseSDMR` it returns), so there's no real MSN value available here for a live lease. Using `lease.leaseId` as the display fallback avoids an empty/blank label without a deeper type change:
```typescript
  const aircraftList = useMemo(() => adjustedLeases.map(({ lease, utilOverride }) => {
    const entry = Object.entries(LEASE_CONTEXT).find(([, ctx]) => ctx.leaseId === lease.leaseId);
    const msn = entry?.[0] ?? lease.leaseId;
    const ctx = entry ? LEASE_CONTEXT[entry[0]] : null;
    return {
      leaseId:     lease.leaseId,
      msn,
      lessee:      lease.lessee,
      aircraft:    lease.aircraft,
      leaseEnd:    lease.leaseEnd ?? ctx?.leaseEnd ?? "2030-01-01",
      lease,
      utilOverride,
    };
  }), [adjustedLeases]);
```
(Also switched `leaseEnd`'s fallback chain to prefer the live lease's own `leaseEnd` field first — matching the pattern already used everywhere else in this codebase, e.g. `MRPortfolioGrid.tsx`/`RedeliveryRiskTab.tsx` — instead of only ever reading the demo `LEASE_CONTEXT` table.)

- [ ] **Step 2: Pass `liveRecord` to the embedded `MaintenanceForecastTab`**

Find (line 121-126):
```typescript
      {/* ── Full projection table via MaintenanceForecastTab ─────────── */}
      <MaintenanceForecastTab
        msn={selected.msn}
        aircraftType={selectedLease.aircraft}
        vintage={2020}
      />
```
Change to:
```typescript
      {/* ── Full projection table via MaintenanceForecastTab ─────────── */}
      <MaintenanceForecastTab
        msn={selected.msn}
        aircraftType={selectedLease.aircraft}
        vintage={2020}
        liveRecord={selectedLease}
      />
```
This is the actual fix — `MaintenanceForecastTab` resolves its lease record from `liveRecord` directly when present (bypassing the demo-only `LEASE_CONTEXT[msn]` lookup entirely), and derives `leaseId` from `liveRecord.leaseId` for its own `useServicerReport`/`useCostOverrides`/`useOrgCostBenchmarks` hooks — so this one prop fixes the whole embedded table for real leases.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` — expect no errors. `MaintenanceForecastTab`'s `Props` interface already has `liveRecord?: LeaseSDMR` (added in an earlier pass) — `selectedLease` is already typed as `LeaseSDMR` in this file, so this should be a direct type match.

- [ ] **Step 4: Run tests**

Run: `npm test -- --run` — expect all pass, no regressions. `AircraftDetailTab.tsx` has no dedicated test file today (presentational component) — this is a manual-verification item, same as other page-level fixes this session.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/maintenance/AircraftDetailTab.tsx
git commit -m "fix: AircraftDetailTab passes liveRecord to embedded MaintenanceForecastTab

The full projection table under the balance chart was rendering 'No
maintenance data available' for every real lease, because it only
resolved lease data via a demo-only LEASE_CONTEXT[msn] lookup. Passing
liveRecord (the real LeaseSDMR object, already in scope) bypasses that
lookup entirely, matching how every other real-data consumer of
MaintenanceForecastTab already works. Predates this session's MR work."
```

---

### Task 2: Fix `ScenarioModellingTab.tsx` — real leases silently dropped

**Files:**
- Modify: `src/app/components/maintenance/ScenarioModellingTab.tsx`

**The bug:** The `rows` computation (line 122-150) requires every lease to have a `LEASE_CONTEXT` entry (`Object.entries(LEASE_CONTEXT).find(([, ctx]) => ctx.leaseId === lease.leaseId)`) — if not found, it `console.warn`s and `return null`s, filtering that lease out entirely. Since `LEASE_CONTEXT` only has the 6 fictional demo MSNs, **every real lease is silently dropped**, and this tab renders completely empty for any real portfolio. Predates this session's work.

- [ ] **Step 1: Remove the LEASE_CONTEXT-required filter, use the live lease's own data**

Find (line 122-150):
```typescript
  const rows = useMemo(() => {
    return adjustedLeases.map(({ lease, utilOverride }) => {
      const entry = Object.entries(LEASE_CONTEXT).find(([, ctx]) => ctx.leaseId === lease.leaseId);
      if (!entry) {
        console.warn(`[ScenarioModellingTab] No LEASE_CONTEXT entry for leaseId ${lease.leaseId}; skipping row`);
        return null;
      }
      const msn = entry[0];
      const ctx = LEASE_CONTEXT[msn];
      const leaseEndStr = ctx.leaseEnd;
      const leaseEndDate = parseDateLocal(leaseEndStr);
      const a = { leaseId: lease.leaseId, msn, lessee: lease.lessee, aircraft: lease.aircraft, leaseEnd: leaseEndStr };

      // Base projection uses servicer report utilization (if available), otherwise heuristic
      const baseProj = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride);
      // Scenario projection uses user-slider FH/CY values
      const scenProj = buildProjections(lease, lease.aircraft, leaseEndDate, {
        annualFH:           fh,
        annualCy:           cy,
        componentRemaining: {},
      });

      const baseEOL = baseProj.reduce((s, p) => s + p.eolShortfall, 0);
      const scenEOL = scenProj.reduce((s, p) => s + p.eolShortfall, 0);
      const delta   = scenEOL - baseEOL; // +ve = scenario worsens shortfall

      return { ...a, lease, leaseEndDate, baseProj, scenProj, baseEOL, scenEOL, delta, utilOverride };
    }).filter((row): row is NonNullable<typeof row> => row !== null);
  }, [adjustedLeases, fh, cy]);
```
Change to:
```typescript
  const rows = useMemo(() => {
    return adjustedLeases.map(({ lease, utilOverride }) => {
      const entry = Object.entries(LEASE_CONTEXT).find(([, ctx]) => ctx.leaseId === lease.leaseId);
      const msn = entry?.[0] ?? lease.leaseId;
      const leaseEndStr = lease.leaseEnd ?? (entry ? LEASE_CONTEXT[entry[0]].leaseEnd : "2028-01-01");
      const leaseEndDate = parseDateLocal(leaseEndStr);
      const a = { leaseId: lease.leaseId, msn, lessee: lease.lessee, aircraft: lease.aircraft, leaseEnd: leaseEndStr };

      // Base projection uses servicer report utilization (if available), otherwise heuristic
      const baseProj = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride);
      // Scenario projection uses user-slider FH/CY values
      const scenProj = buildProjections(lease, lease.aircraft, leaseEndDate, {
        annualFH:           fh,
        annualCy:           cy,
        componentRemaining: {},
      });

      const baseEOL = baseProj.reduce((s, p) => s + p.eolShortfall, 0);
      const scenEOL = scenProj.reduce((s, p) => s + p.eolShortfall, 0);
      const delta   = scenEOL - baseEOL; // +ve = scenario worsens shortfall

      return { ...a, lease, leaseEndDate, baseProj, scenProj, baseEOL, scenEOL, delta, utilOverride };
    });
  }, [adjustedLeases, fh, cy]);
```
Same fallback pattern as Task 1 and the rest of this codebase: prefer the live lease's own `leaseEnd`, fall back to `LEASE_CONTEXT` only for demo leases that don't carry one, then a last-resort default. The `.filter(row => row !== null)` at the end is removed since every lease now produces a row — no more `null` values in the array, so the type guard is dead code once the filter's only source (`return null`) is gone.

**Do not** remove the `entry`/`LEASE_CONTEXT` lookup entirely — `msn` display still benefits from a real MSN when one exists (demo leases), and this task's job is removing the "requires demo data or gets dropped" behavior, not ripping out demo-mode support.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — expect no errors. If TypeScript complains that `rows`' inferred type still includes `null` somewhere, check whether `NonNullable<typeof row>` or the `filter` type guard is referenced elsewhere in the file (e.g. in the JSX below) and remove/adjust that reference too — it shouldn't be, since `rows` is consumed directly as `rows.map(...)` further down, but verify.

- [ ] **Step 3: Run tests**

Run: `npm test -- --run` — expect all pass. No dedicated test file for this component today (manual-verification item, same as Task 1).

- [ ] **Step 4: Commit**

```bash
git add src/app/components/maintenance/ScenarioModellingTab.tsx
git commit -m "fix: ScenarioModellingTab no longer drops every real lease

Every row required a LEASE_CONTEXT match (6 fictional demo MSNs only)
or was silently filtered out with a console.warn — meaning this tab
rendered completely empty for any real portfolio. Use the live lease's
own leaseEnd field (already present on real LeaseSDMR records) with
the same fallback-chain pattern used everywhere else in this codebase,
instead of requiring a demo-data match. Predates this session's work."
```

---

## Phase B — Thread the 3-tier cost resolution into the remaining 5 call sites

### Task 3: `useAllCostOverrides` bulk hook

**Files:**
- Create: `src/app/hooks/useAllCostOverrides.ts`

Direct mirror of `src/app/hooks/useAllServicerReports.ts` (read it first to confirm the pattern is unchanged), reading from the existing `mr_cost_overrides` table (created in an earlier, unrelated pass — read `src/app/hooks/useCostOverrides.ts` for the exact row shape/column names, already confirmed above) with no `lease_id` filter (fetch every row for the org).

- [ ] **Step 1: Write the hook**

```typescript
// src/app/hooks/useAllCostOverrides.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import type { CostOverride } from "./useCostOverrides";
import { hasAuthSession } from "../utils/authBackend";

function mapRow(row: Record<string, unknown>): CostOverride {
  return {
    id:        row.id as string,
    leaseId:   row.lease_id as string,
    component: row.component as string,
    costUSD:   Number(row.cost_usd),
    note:      (row.note as string | null) ?? null,
    createdBy: row.created_by as string,
    updatedAt: row.updated_at as string,
  };
}

/** Keyed by leaseId → (component name → override). One org-wide fetch, no per-lease filtering
 *  at the DB level — mirrors useAllServicerReports.ts's pattern exactly. */
export function useAllCostOverrides(): {
  overridesByLeaseId: Map<string, Record<string, CostOverride>>;
  loading: boolean;
} {
  const { orgId } = useData();
  const [overridesByLeaseId, setOverridesByLeaseId] = useState<Map<string, Record<string, CostOverride>>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId || !hasAuthSession()) { setOverridesByLeaseId(new Map()); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("mr_cost_overrides")
        .select("*")
        .eq("org_id", orgId);

      if (cancelled) { setLoading(false); return; }
      if (error) {
        const code = (error as { code?: string }).code;
        const msg  = String((error as { message?: string }).message ?? "");
        const isRls = code === "42501" || /permission denied/i.test(msg);
        if (!isRls) console.error("[useAllCostOverrides] load error:", error);
        setLoading(false);
        return;
      }
      const map = new Map<string, Record<string, CostOverride>>();
      for (const row of data ?? []) {
        const mapped = mapRow(row as Record<string, unknown>);
        const byComponent = map.get(mapped.leaseId) ?? {};
        byComponent[mapped.component] = mapped;
        map.set(mapped.leaseId, byComponent);
      }
      setOverridesByLeaseId(map);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  return { overridesByLeaseId, loading };
}
```

Before finalizing, confirm `useAllServicerReports.ts`'s exact RLS-error-handling shape (the `code`/`isRls` pattern above) matches what's actually in that file right now — copy it precisely rather than from this illustrative version if there's any drift.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 3: No dedicated test** (matches `useAllServicerReports.ts`'s own convention — check if that file has a test; if it does, mirror its structure for this hook too, otherwise skip, consistent with the rest of this codebase's bulk-hook pattern)

Run: `npm test -- --run` — expect all pass, no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/app/hooks/useAllCostOverrides.ts
git commit -m "feat: add useAllCostOverrides bulk-fetch hook"
```

---

### Task 4: `useAllOrgCostBenchmarks` bulk hook

**Files:**
- Create: `src/app/hooks/useAllOrgCostBenchmarks.ts`

Same pattern as Task 3, reading `org_cost_benchmarks`, keyed by `aircraftType` instead of `leaseId` (read `src/app/hooks/useOrgCostBenchmarks.ts` first to confirm the exact row shape).

- [ ] **Step 1: Write the hook**

```typescript
// src/app/hooks/useAllOrgCostBenchmarks.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import type { OrgCostBenchmark } from "./useOrgCostBenchmarks";
import { hasAuthSession } from "../utils/authBackend";

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

/** Keyed by aircraftType → (component name → benchmark). One org-wide fetch — mirrors
 *  useAllCostOverrides.ts / useAllServicerReports.ts's pattern exactly. */
export function useAllOrgCostBenchmarks(): {
  benchmarksByAircraftType: Map<string, Record<string, OrgCostBenchmark>>;
  loading: boolean;
} {
  const { orgId } = useData();
  const [benchmarksByAircraftType, setBenchmarksByAircraftType] = useState<Map<string, Record<string, OrgCostBenchmark>>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId || !hasAuthSession()) { setBenchmarksByAircraftType(new Map()); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("org_cost_benchmarks")
        .select("*")
        .eq("org_id", orgId);

      if (cancelled) { setLoading(false); return; }
      if (error) {
        const code = (error as { code?: string }).code;
        const msg  = String((error as { message?: string }).message ?? "");
        const isRls = code === "42501" || /permission denied/i.test(msg);
        if (!isRls) console.error("[useAllOrgCostBenchmarks] load error:", error);
        setLoading(false);
        return;
      }
      const map = new Map<string, Record<string, OrgCostBenchmark>>();
      for (const row of data ?? []) {
        const mapped = mapRow(row as Record<string, unknown>);
        const byComponent = map.get(mapped.aircraftType) ?? {};
        byComponent[mapped.component] = mapped;
        map.set(mapped.aircraftType, byComponent);
      }
      setBenchmarksByAircraftType(map);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  return { benchmarksByAircraftType, loading };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 3: Run tests**

Run: `npm test -- --run` — expect all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/hooks/useAllOrgCostBenchmarks.ts
git commit -m "feat: add useAllOrgCostBenchmarks bulk-fetch hook"
```

---

### Task 5: Wire into `MRPortfolioGrid.tsx`

**Files:**
- Modify: `src/app/components/maintenance/MRPortfolioGrid.tsx`

- [ ] **Step 1: Add the hook calls and thread the lookups into `buildProjections`**

Add imports:
```typescript
import { useAllCostOverrides } from "../../hooks/useAllCostOverrides";
import { useAllOrgCostBenchmarks } from "../../hooks/useAllOrgCostBenchmarks";
```

Inside `MRPortfolioGrid`, add before the `rows` `useMemo` (around line 46):
```typescript
  const { overridesByLeaseId } = useAllCostOverrides();
  const { benchmarksByAircraftType } = useAllOrgCostBenchmarks();
```

Find (line 56-68):
```typescript
  const rows = useMemo(() => {
    return adjustedLeases
      .map(({ lease, utilOverride }) => {
        const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
        const leaseEndDate = lease.leaseEnd
          ? parseDateLocal(lease.leaseEnd)
          : ctx
          ? parseDateLocal(ctx.leaseEnd)
          : new Date(2028, 0, 1); // last-resort fallback

        const projections = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride);
```
Change the last line to pass the two new lookups, and update the `useMemo` dependency array:
```typescript
  const rows = useMemo(() => {
    return adjustedLeases
      .map(({ lease, utilOverride }) => {
        const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
        const leaseEndDate = lease.leaseEnd
          ? parseDateLocal(lease.leaseEnd)
          : ctx
          ? parseDateLocal(ctx.leaseEnd)
          : new Date(2028, 0, 1); // last-resort fallback

        const costOverrides = overridesByLeaseId.get(lease.leaseId);
        const orgBenchmarks = benchmarksByAircraftType.get(lease.aircraft);
        const projections = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride, costOverrides, orgBenchmarks);
```
Update the `useMemo`'s dependency array (currently `[adjustedLeases]`, find it at the end of the `rows` useMemo block) to:
```typescript
  }, [adjustedLeases, overridesByLeaseId, benchmarksByAircraftType]);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 3: Run tests**

Run: `npm test -- --run` — expect all pass, no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/maintenance/MRPortfolioGrid.tsx
git commit -m "feat: MRPortfolioGrid reflects per-lease overrides and org benchmarks"
```

---

### Task 6: Wire into `RedeliveryRiskTab.tsx`

**Files:**
- Modify: `src/app/components/maintenance/RedeliveryRiskTab.tsx`

- [ ] **Step 1: Add the hook calls and thread the lookups**

Add imports:
```typescript
import { useAllCostOverrides } from "../../hooks/useAllCostOverrides";
import { useAllOrgCostBenchmarks } from "../../hooks/useAllOrgCostBenchmarks";
```

Inside `RedeliveryRiskTab`, add before the `rows` `useMemo`:
```typescript
  const { overridesByLeaseId } = useAllCostOverrides();
  const { benchmarksByAircraftType } = useAllOrgCostBenchmarks();
```

Find (line 42-49):
```typescript
      .map(({ lease, utilOverride }) => {
        const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
        const leaseEndDate = lease.leaseEnd
          ? parseDateLocal(lease.leaseEnd)
          : ctx
          ? parseDateLocal(ctx.leaseEnd)
          : new Date(2028, 0, 1);
        const projections = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride);
```
Change to:
```typescript
      .map(({ lease, utilOverride }) => {
        const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
        const leaseEndDate = lease.leaseEnd
          ? parseDateLocal(lease.leaseEnd)
          : ctx
          ? parseDateLocal(ctx.leaseEnd)
          : new Date(2028, 0, 1);
        const costOverrides = overridesByLeaseId.get(lease.leaseId);
        const orgBenchmarks = benchmarksByAircraftType.get(lease.aircraft);
        const projections = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride, costOverrides, orgBenchmarks);
```
Update the `useMemo`'s dependency array (currently `[adjustedLeases]` at the end of this block) to:
```typescript
  }, [adjustedLeases, overridesByLeaseId, benchmarksByAircraftType]);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 3: Run tests**

Run: `npm test -- --run` — expect all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/maintenance/RedeliveryRiskTab.tsx
git commit -m "feat: RedeliveryRiskTab reflects per-lease overrides and org benchmarks"
```

---

### Task 7: Wire into `AircraftDetailTab.tsx`'s balance chart

**Files:**
- Modify: `src/app/components/maintenance/AircraftDetailTab.tsx`

Note: this file was already modified in Task 1 (Phase A) — re-read its current state before editing, don't assume the pre-Task-1 line numbers still apply.

- [ ] **Step 1: Add the hook calls and thread the lookups into the chart's own `buildProjections` call**

Add imports:
```typescript
import { useAllCostOverrides } from "../../hooks/useAllCostOverrides";
import { useAllOrgCostBenchmarks } from "../../hooks/useAllOrgCostBenchmarks";
```

Add inside `AircraftDetailTab`, before the `derived` `useMemo`:
```typescript
  const { overridesByLeaseId } = useAllCostOverrides();
  const { benchmarksByAircraftType } = useAllOrgCostBenchmarks();
```

Find the `derived` `useMemo` (after Task 1's edit, still around line 63-71):
```typescript
  const derived = useMemo(() => {
    if (!selected || !selectedLease) return null;
    const end = parseDateLocal(selected.leaseEnd);
    return {
      projections:  buildProjections(selectedLease, selectedLease.aircraft, end, selected.utilOverride),
      leaseEndDate: end,
      monthsToEOL:  Math.max(0, monthsBetween(NOW, end)),
    };
  }, [selected, selectedLease]);
```
Change to:
```typescript
  const derived = useMemo(() => {
    if (!selected || !selectedLease) return null;
    const end = parseDateLocal(selected.leaseEnd);
    const costOverrides = overridesByLeaseId.get(selectedLease.leaseId);
    const orgBenchmarks = benchmarksByAircraftType.get(selectedLease.aircraft);
    return {
      projections:  buildProjections(selectedLease, selectedLease.aircraft, end, selected.utilOverride, costOverrides, orgBenchmarks),
      leaseEndDate: end,
      monthsToEOL:  Math.max(0, monthsBetween(NOW, end)),
    };
  }, [selected, selectedLease, overridesByLeaseId, benchmarksByAircraftType]);
```

This closes the exact gap a prior review flagged: with Task 1's fix, the embedded `MaintenanceForecastTab` table below this chart already resolves its own cost tier internally (it calls `useCostOverrides`/`useOrgCostBenchmarks` itself, scoped to the single selected lease). This step makes the chart ABOVE it use the same resolved costs, so both halves of this page agree — no more silent disagreement between the chart and the table for the same aircraft.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 3: Run tests**

Run: `npm test -- --run` — expect all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/maintenance/AircraftDetailTab.tsx
git commit -m "feat: AircraftDetailTab's balance chart reflects per-lease overrides and org benchmarks

Closes the gap where this chart and the MaintenanceForecastTab table
rendered directly below it (which already resolves its own cost tier
internally) could silently disagree for the same aircraft."
```

---

### Task 8: Wire into `ScenarioModellingTab.tsx`

**Files:**
- Modify: `src/app/components/maintenance/ScenarioModellingTab.tsx`

Note: this file was already modified in Task 2 (Phase A) — re-read its current state before editing.

- [ ] **Step 1: Add the hook calls and thread the lookups into both `buildProjections` calls**

Add imports:
```typescript
import { useAllCostOverrides } from "../../hooks/useAllCostOverrides";
import { useAllOrgCostBenchmarks } from "../../hooks/useAllOrgCostBenchmarks";
```

Add inside `ScenarioModellingTab`, before the `rows` `useMemo`:
```typescript
  const { overridesByLeaseId } = useAllCostOverrides();
  const { benchmarksByAircraftType } = useAllOrgCostBenchmarks();
```

Find (after Task 2's edit, the `rows` useMemo body):
```typescript
      // Base projection uses servicer report utilization (if available), otherwise heuristic
      const baseProj = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride);
      // Scenario projection uses user-slider FH/CY values
      const scenProj = buildProjections(lease, lease.aircraft, leaseEndDate, {
        annualFH:           fh,
        annualCy:           cy,
        componentRemaining: {},
      });
```
Change to:
```typescript
      const costOverrides = overridesByLeaseId.get(lease.leaseId);
      const orgBenchmarks = benchmarksByAircraftType.get(lease.aircraft);

      // Base projection uses servicer report utilization (if available), otherwise heuristic
      const baseProj = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride, costOverrides, orgBenchmarks);
      // Scenario projection uses user-slider FH/CY values
      const scenProj = buildProjections(lease, lease.aircraft, leaseEndDate, {
        annualFH:           fh,
        annualCy:           cy,
        componentRemaining: {},
      }, costOverrides, orgBenchmarks);
```
**Both** `baseProj` and `scenProj` need the same override/benchmark data — the scenario slider changes utilization assumptions, not cost provenance, so both projections should agree on which cost tier is winning for a given component.

Update the `rows` `useMemo`'s dependency array (currently `[adjustedLeases, fh, cy]`) to:
```typescript
  }, [adjustedLeases, fh, cy, overridesByLeaseId, benchmarksByAircraftType]);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 3: Run tests**

Run: `npm test -- --run` — expect all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/maintenance/ScenarioModellingTab.tsx
git commit -m "feat: ScenarioModellingTab's base and scenario projections reflect per-lease overrides and org benchmarks"
```

---

### Task 9: Wire into `mrChartAdapters.ts`

**Files:**
- Modify: `src/app/lib/mrChartAdapters.ts`
- Modify: `src/app/pages/Maintenance.tsx` (the sole call site of `toMRChartData`)

Unlike Tasks 5-8, `toMRChartData` is a plain function (not a component/hook), called once from `Maintenance.tsx`. It needs its override/benchmark data passed in as parameters by its caller, which already has (or will have) both bulk hooks available.

- [ ] **Step 1: Extend `toMRChartData`'s signature**

Find (line 64):
```typescript
export function toMRChartData(sdmrData: LeaseSDMR[]): MRChartData {
```
Change to accept two more optional params, matching the `Map`-keyed shape the bulk hooks already produce:
```typescript
export function toMRChartData(
  sdmrData: LeaseSDMR[],
  overridesByLeaseId?: Map<string, Record<string, CostOverride>>,
  benchmarksByAircraftType?: Map<string, Record<string, OrgCostBenchmark>>,
): MRChartData {
```
Add the two type imports at the top of the file:
```typescript
import type { CostOverride } from "../hooks/useCostOverrides";
import type { OrgCostBenchmark } from "../hooks/useOrgCostBenchmarks";
```

Find (line 89-94):
```typescript
  const leaseRows: LeaseRow[] = sdmrData.map((lease, i) => {
    const leaseEndDate = leaseEnds[i];
    const projections = buildProjections(lease, lease.aircraft, leaseEndDate);
    const overallFlag = computeMRAdequacy(projections).flag;
    return { leaseId: lease.leaseId, projections, leaseEndDate, overallFlag };
  });
```
Change to:
```typescript
  const leaseRows: LeaseRow[] = sdmrData.map((lease, i) => {
    const leaseEndDate = leaseEnds[i];
    const costOverrides = overridesByLeaseId?.get(lease.leaseId);
    const orgBenchmarks = benchmarksByAircraftType?.get(lease.aircraft);
    const projections = buildProjections(lease, lease.aircraft, leaseEndDate, undefined, costOverrides, orgBenchmarks);
    const overallFlag = computeMRAdequacy(projections).flag;
    return { leaseId: lease.leaseId, projections, leaseEndDate, overallFlag };
  });
```
(`undefined` for the 4th arg — `utilOverride` — since `toMRChartData` never had access to per-lease servicer-report utilization overrides in the first place; this preserves existing behavior for that parameter exactly, only adding the two new ones.)

Both new params are optional so any other caller of `toMRChartData` (if one exists — check via grep) keeps compiling unchanged with heuristic-only behavior.

- [ ] **Step 2: Wire the call site in `Maintenance.tsx`**

Add imports:
```typescript
import { useAllCostOverrides } from "../hooks/useAllCostOverrides";
import { useAllOrgCostBenchmarks } from "../hooks/useAllOrgCostBenchmarks";
```

Add near the other hook calls in the `Maintenance()` component:
```typescript
  const { overridesByLeaseId } = useAllCostOverrides();
  const { benchmarksByAircraftType } = useAllOrgCostBenchmarks();
```

Find the existing `chartData` useMemo (added/modified in the earlier live-wiring pass):
```typescript
  const chartData = useMemo(() => toMRChartData(effectiveSDMRData), [effectiveSDMRData]);
```
Change to:
```typescript
  const chartData = useMemo(
    () => toMRChartData(effectiveSDMRData, overridesByLeaseId, benchmarksByAircraftType),
    [effectiveSDMRData, overridesByLeaseId, benchmarksByAircraftType],
  );
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 4: Run tests**

Run: `npm test -- --run mrChartAdapters` — expect the existing test file (`mrChartAdapters.test.ts`) to still pass unchanged (its calls to `toMRChartData` use only 1 arg, which stays valid since the new params are optional).

Run: `npm test -- --run` — expect all pass, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/mrChartAdapters.ts src/app/pages/Maintenance.tsx
git commit -m "feat: Maintenance page's cashflow chart reflects per-lease overrides and org benchmarks"
```

---

## Self-Review Notes

- **Spec coverage:** Phase A closes 2 pre-existing, out-of-scope-but-user-approved bugs (real leases showing no data / being silently dropped). Phase B closes the previously-documented gap (org benchmarks and per-lease overrides only reaching `MaintenanceForecastTab.tsx`'s own single-lease drill-down) across all 5 remaining `buildProjections` call sites plus the chart adapter — that's every known call site now covered.
- **Ordering matters:** Phase A must land before Phase B for `AircraftDetailTab.tsx`/`ScenarioModellingTab.tsx` specifically, since Phase B's edits to those two files (Tasks 7-8) build on top of Phase A's fixes (Tasks 1-2) to the same files — do not reorder or run Phase B before Phase A for those two files.
- **Type consistency:** `overridesByLeaseId: Map<string, Record<string, CostOverride>>` and `benchmarksByAircraftType: Map<string, Record<string, OrgCostBenchmark>>` are the exact same shapes across Tasks 3-9 — no renaming, no shape drift. `buildProjections`'s 5th/6th params (`costOverrides?: Record<string, CostOverride>`, `orgBenchmarks?: Record<string, OrgCostBenchmark>`) were already established in an earlier pass and are unchanged by this plan — every task in Phase B is purely a caller-side wiring change.
- **No new tables, no new UI.** This plan reads two existing tables (`mr_cost_overrides`, `org_cost_benchmarks`) that already have live-deployed migrations — no database changes needed. No new badges/visual indicators added to the 5 wired views, per the approved design (numbers become correct; the provenance badge stays a `MaintenanceForecastTab`-only affordance).
