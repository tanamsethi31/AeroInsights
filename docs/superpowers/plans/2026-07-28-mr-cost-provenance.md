# MR Cost Provenance Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every per-component maintenance cost on the Maintenance Forecast tab a visible source (Heuristic vs. Override) and a per-lease, per-component override path with a "who/when/why" audit trail, closing the credibility gap raised at the SkyWorks demo.

**Architecture:** A new org-scoped Supabase table (`mr_cost_overrides`) holds per-lease, per-component cost corrections. A new hook (`useCostOverrides`) loads and saves them, reusing the existing universal `logAudit()` service for the audit trail — no new audit infrastructure. `buildProjections()` (the pure calculation function already used for every MR figure on the tab) takes the overrides as a new optional argument and prefers them over the hardcoded heuristic. The UI reuses the tab's existing "Servicer Report" panel — a parallel "Component cost overrides" collapsible sub-section sits next to the panel's existing "Component remaining units" section — and the Component Projection Table gains a small source badge per row.

**Tech Stack:** React 18 + TypeScript, Supabase (Postgres + RLS), Vitest.

---

## Task 1: `mr_cost_overrides` migration

**Files:**
- Create: `supabase/migrations/20260728120000_mr_cost_overrides.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260728120000_mr_cost_overrides.sql`:

```sql
-- One row per (org_id, lease_id, component). Upserted from useCostOverrides hook.
-- Overrides a single component's event cost on one specific lease's aircraft —
-- the heuristic in maintenanceHeuristics.ts remains the fleet-wide default;
-- this table only ever affects the one lease/component pair it targets.
--
-- RLS follows the corrected org-scoped pattern from
-- 20260528120000_security_audit_rls_lockdown.sql (auth.jwt() ->> 'org_id'),
-- not the older `to authenticated using (true)` shape used by earlier
-- override-style tables before that remediation — this is a new table, so
-- it starts on the current, correct pattern rather than needing a follow-up
-- lockdown migration of its own.

create table if not exists mr_cost_overrides (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references organisations(id) on delete cascade,
  lease_id     text        not null,
  component    text        not null,   -- "Engine PR", "Airframe HSI", "LLPs", "Landing Gear", "APU"
  cost_usd     numeric     not null,
  note         text,                   -- optional free-text evidence, e.g. "Per MRO quote dated 2026-06-15"
  created_by   text        not null,   -- actor email, mirrors audit_log.actor
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists mr_cost_overrides_org_lease_component_uidx
  on mr_cost_overrides(org_id, lease_id, component);

create index if not exists mr_cost_overrides_org_idx
  on mr_cost_overrides(org_id);

alter table mr_cost_overrides enable row level security;
alter table mr_cost_overrides force  row level security;

create policy mr_cost_overrides_select_own_org on mr_cost_overrides
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy mr_cost_overrides_insert_own_org on mr_cost_overrides
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy mr_cost_overrides_update_own_org on mr_cost_overrides
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                          with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy mr_cost_overrides_delete_own_org on mr_cost_overrides
  for delete to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
```

- [ ] **Step 2: Sanity-check the SQL**

Run: `cat supabase/migrations/20260728120000_mr_cost_overrides.sql | grep -c "create policy"`
Expected: `4` (select, insert, update, delete — one policy per operation, all org-scoped).

This migration is not applied to any live database by this plan — that's a separate deploy step outside this codebase change (matching how `servicer_reports`/`audit_log`'s own migrations were added as files first, applied later). The app code in later tasks assumes the table exists once deployed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260728120000_mr_cost_overrides.sql
git commit -m "feat: add mr_cost_overrides table with org-scoped RLS"
```

---

## Task 2: `useCostOverrides` hook

**Files:**
- Create: `src/app/hooks/useCostOverrides.ts`

- [ ] **Step 1: Write the hook**

Create `src/app/hooks/useCostOverrides.ts`:

```ts
// src/app/hooks/useCostOverrides.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { hasAuthSession } from "../utils/authBackend";
import { logAudit } from "../services/auditLog";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CostOverride {
  id:        string;
  leaseId:   string;
  component: string;
  costUSD:   number;
  note:      string | null;
  createdBy: string;
  updatedAt: string;
}

export interface UseCostOverridesReturn {
  /** Keyed by component name for O(1) lookup in buildProjections(). */
  overrides:      Record<string, CostOverride>;
  loading:        boolean;
  saving:         boolean;
  /** Batched — mirrors the panel's single Save button covering every changed component at once. */
  saveOverrides:  (changes: Record<string, number>, note: string | null) => Promise<void>;
  /** Clears every cost override for this lease — paired with the panel's existing "Reset to heuristic". */
  clearOverrides: () => Promise<void>;
}

// ── Row mapper ────────────────────────────────────────────────────────────────

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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCostOverrides(leaseId: string | null): UseCostOverridesReturn {
  const { orgId } = useData();
  const [overrides, setOverrides] = useState<Record<string, CostOverride>>({});
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  // ── Load on mount / leaseId change ────────────────────────────────────────

  useEffect(() => {
    if (!orgId || !leaseId || !hasAuthSession()) { setOverrides({}); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("mr_cost_overrides")
        .select("*")
        .eq("org_id", orgId)
        .eq("lease_id", leaseId);

      if (cancelled) { setLoading(false); return; }
      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useCostOverrides] load error:", error);
        }
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as Record<string, unknown>[];
      const byComponent: Record<string, CostOverride> = {};
      for (const row of rows) {
        const mapped = mapRow(row);
        byComponent[mapped.component] = mapped;
      }
      setOverrides(byComponent);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId, leaseId]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveOverrides = useCallback(async (changes: Record<string, number>, note: string | null) => {
    if (!orgId || !leaseId || Object.keys(changes).length === 0) return;
    setSaving(true);

    // Resolve the real actor once, upfront — sibling hooks in this repo
    // (useLgdCurves.ts, usePdCurves.ts, useReportExports.ts) all do this the
    // same way. Reading `overrides` directly (rather than round-tripping
    // through a functional setState updater to grab a snapshot) avoids
    // depending on React's eager-state-update optimization, which only
    // fires synchronously when no update is already pending — not a
    // guaranteed part of the public hooks API.
    const actor = (await supabase.auth.getUser()).data.user?.email ?? "unknown";
    const now = new Date().toISOString();
    const snapshot = overrides;

    // Optimistic update
    setOverrides(prev => {
      const next = { ...prev };
      for (const [component, costUSD] of Object.entries(changes)) {
        next[component] = {
          id:        prev[component]?.id ?? "temp",
          leaseId,
          component,
          costUSD,
          note,
          createdBy: actor,
          updatedAt: now,
        };
      }
      return next;
    });

    try {
      const payload = Object.entries(changes).map(([component, costUSD]) => ({
        org_id:     orgId,
        lease_id:   leaseId,
        component,
        cost_usd:   costUSD,
        note,
        created_by: actor,
        updated_at: now,
      }));

      const { data: rows, error } = await supabase
        .from("mr_cost_overrides")
        .upsert(payload, { onConflict: "org_id,lease_id,component" })
        .select();

      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useCostOverrides] saveOverrides error:", error);
        }
        setOverrides(snapshot); // rollback
        throw error;
      }

      // Reconcile local state with the real rows (real id/created_by from DB)
      const saved = (rows ?? []) as Record<string, unknown>[];
      setOverrides(prev => {
        const next = { ...prev };
        for (const row of saved) {
          const mapped = mapRow(row);
          next[mapped.component] = mapped;
        }
        return next;
      });

      // One audit row per changed component — matches the table's own
      // one-row-per-component grain, so each component stays independently
      // traceable regardless of what else was saved alongside it.
      for (const [component, costUSD] of Object.entries(changes)) {
        void logAudit({
          orgId,
          entityType: "mr_cost_override",
          entityId:   `${leaseId}:${component}`,
          action:     "override",
          before:     snapshot[component] ? { costUSD: snapshot[component].costUSD } : null,
          after:      { costUSD, note },
          note:       note ?? undefined,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [orgId, leaseId, overrides]);

  const clearOverrides = useCallback(async () => {
    if (!orgId || !leaseId) return;
    setSaving(true);

    const snapshot = overrides;
    setOverrides({});

    try {
      const { error } = await supabase
        .from("mr_cost_overrides")
        .delete()
        .eq("org_id", orgId)
        .eq("lease_id", leaseId);

      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useCostOverrides] clearOverrides error:", error);
        }
        setOverrides(snapshot); // rollback
        throw error;
      }

      for (const component of Object.keys(snapshot)) {
        void logAudit({
          orgId,
          entityType: "mr_cost_override",
          entityId:   `${leaseId}:${component}`,
          action:     "reset",
          before:     { costUSD: snapshot[component].costUSD },
          after:      null,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [orgId, leaseId, overrides]);

  return { overrides, loading, saving, saveOverrides, clearOverrides };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean — no errors. (This hook has no callers yet, added in Task 4, so it should typecheck standalone.)

- [ ] **Step 3: Commit**

```bash
git add src/app/hooks/useCostOverrides.ts
git commit -m "feat: add useCostOverrides hook for per-lease MR cost overrides"
```

---

## Task 3: Extend `buildProjections()` with cost overrides, with tests

**Files:**
- Modify: `src/app/components/portfolio/MaintenanceForecastTab.tsx:57-133` (types + `buildProjections`)
- Modify: `src/app/components/portfolio/MaintenanceForecastTab.test.ts` (extend existing file)

- [ ] **Step 1: Write the failing tests**

Append to the existing `src/app/components/portfolio/MaintenanceForecastTab.test.ts` (after its last `describe` block, before the file's final closing — the file currently ends after the "UtilOverride — componentRemaining" describe block):

```ts

// ── CostOverride ───────────────────────────────────────────────────────────────

describe("buildProjections — cost overrides", () => {
  it("uses the override cost instead of the heuristic when present", () => {
    // A320neo heuristic Airframe HSI costUSD = 6_800_000 (see maintenanceHeuristics.ts)
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, {
      "Airframe HSI": { id: "1", leaseId: "LSE-TEST-001", component: "Airframe HSI", costUSD: 7_500_000, note: null, createdBy: "test@example.com", updatedAt: "2026-07-28T00:00:00Z" },
    });
    expect(p.heuristicEventCost).toBe(7_500_000);
  });

  it("falls back to the heuristic cost when no override exists for that component", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, {});
    expect(p.heuristicEventCost).toBe(6_800_000);
  });

  it("falls back to the heuristic cost when costOverrides is undefined entirely", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p.heuristicEventCost).toBe(6_800_000);
  });

  it("sets costSource to 'override' when a cost override is present", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, {
      "Airframe HSI": { id: "1", leaseId: "LSE-TEST-001", component: "Airframe HSI", costUSD: 7_500_000, note: null, createdBy: "test@example.com", updatedAt: "2026-07-28T00:00:00Z" },
    });
    expect(p.costSource).toBe("override");
  });

  it("sets costSource to 'heuristic' when no override is present", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p.costSource).toBe("heuristic");
  });

  it("overriding one component's cost does not change downstream shortfall math incorrectly — it recomputes from the new cost", () => {
    const [base] = buildProjections(makeLease(), "A320neo", LEASE_END);
    const [overridden] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, {
      "Airframe HSI": { id: "1", leaseId: "LSE-TEST-001", component: "Airframe HSI", costUSD: 7_500_000, note: null, createdBy: "test@example.com", updatedAt: "2026-07-28T00:00:00Z" },
    });
    // shortfallAtEvent = heuristicEventCost - projectedBalanceAtEvent; projectedBalanceAtEvent
    // is unaffected by a cost override (it depends on utilization, not event cost), so the
    // shortfall should shift by exactly the cost delta.
    const costDelta = overridden.heuristicEventCost - base.heuristicEventCost;
    expect(overridden.shortfallAtEvent - base.shortfallAtEvent).toBeCloseTo(costDelta, 0);
  });

  it("populates costOverrideMeta when overridden, leaves it undefined when not", () => {
    const [overridden] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, {
      "Airframe HSI": { id: "1", leaseId: "LSE-TEST-001", component: "Airframe HSI", costUSD: 7_500_000, note: "Per MRO quote", createdBy: "test@example.com", updatedAt: "2026-07-28T00:00:00Z" },
    });
    expect(overridden.costOverrideMeta).toEqual({ createdBy: "test@example.com", updatedAt: "2026-07-28T00:00:00Z", note: "Per MRO quote" });

    const [base] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(base.costOverrideMeta).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/components/portfolio/MaintenanceForecastTab.test.ts`
Expected: FAIL — `buildProjections` doesn't accept a 5th argument yet, and `costSource`/`costOverrideMeta` don't exist on the returned projections (TypeScript errors and/or `undefined` assertion failures).

- [ ] **Step 3: Implement the change**

In `src/app/components/portfolio/MaintenanceForecastTab.tsx`, add the `CostOverride` type import (after the existing `useServicerReport`/`ServicerReport` imports, i.e. after line 14):

```ts
import type { CostOverride } from "../../hooks/useCostOverrides";
```

Change the `ComponentProjection` interface (currently lines 57-70) from:

```ts
export interface ComponentProjection {
  component: ComponentName;
  currentBalance: number;
  monthlyAccrual: number;         // assumes lessee keeps paying
  monthsToNextEvent: number;
  nextEventDate: Date;
  projectedBalanceAtEvent: number;
  heuristicEventCost: number;
  shortfallAtEvent: number;       // +ve = shortfall, -ve = surplus
  projectedBalanceAtEOL: number;
  eolObligation: number;          // contractual obligation at full-life return
  eolShortfall: number;           // +ve = shortfall, -ve = surplus
  distressedEOLShortfall: number; // conservative: lessee stops paying today
}
```

to:

```ts
export interface ComponentProjection {
  component: ComponentName;
  currentBalance: number;
  monthlyAccrual: number;         // assumes lessee keeps paying
  monthsToNextEvent: number;
  nextEventDate: Date;
  projectedBalanceAtEvent: number;
  heuristicEventCost: number;
  costSource: "heuristic" | "override";
  costOverrideMeta?: { createdBy: string; updatedAt: string; note: string | null };
  shortfallAtEvent: number;       // +ve = shortfall, -ve = surplus
  projectedBalanceAtEOL: number;
  eolObligation: number;          // contractual obligation at full-life return
  eolShortfall: number;           // +ve = shortfall, -ve = surplus
  distressedEOLShortfall: number; // conservative: lessee stops paying today
}
```

Change the `buildProjections` function signature (currently lines 78-83) from:

```ts
export function buildProjections(
  lease: LeaseSDMR,
  aircraftType: string,
  leaseEndDate: Date,
  utilOverride?: UtilOverride,
): ComponentProjection[] {
```

to:

```ts
export function buildProjections(
  lease: LeaseSDMR,
  aircraftType: string,
  leaseEndDate: Date,
  utilOverride?: UtilOverride,
  costOverrides?: Record<string, CostOverride>,
): ComponentProjection[] {
```

Inside the function body, change (currently lines 100-101):

```ts
    const projectedBalanceAtEvent = comp.cumulativeBalance + remainingUnits * comp.rateAmount;
    const heuristicEventCost      = h ? h.costUSD : comp.fullIntervalUnits * comp.rateAmount;
```

to:

```ts
    const projectedBalanceAtEvent = comp.cumulativeBalance + remainingUnits * comp.rateAmount;
    const costOverride            = costOverrides?.[comp.component];
    const heuristicEventCost      = costOverride ? costOverride.costUSD : (h ? h.costUSD : comp.fullIntervalUnits * comp.rateAmount);
    const costSource: "heuristic" | "override" = costOverride ? "override" : "heuristic";
```

And in the returned object (currently lines 118-131), add `costSource` and `costOverrideMeta` right after `heuristicEventCost`:

```ts
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
      shortfallAtEvent,
      projectedBalanceAtEOL,
      eolObligation,
      eolShortfall:             eolObligation - projectedBalanceAtEOL,
      distressedEOLShortfall,
    };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/components/portfolio/MaintenanceForecastTab.test.ts`
Expected: PASS — all tests green (4 pre-existing + 7 new = 11 total).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean — no errors. (The component itself doesn't call `buildProjections` with the new 5th argument yet — that's Task 4 — but since it's optional, the existing call site at line 215 remains valid.)

- [ ] **Step 6: Commit**

```bash
git add src/app/components/portfolio/MaintenanceForecastTab.tsx src/app/components/portfolio/MaintenanceForecastTab.test.ts
git commit -m "feat: thread cost overrides into buildProjections with source tracking"
```

---

## Task 4: Wire the UI — panel sub-section + table badges

**Files:**
- Modify: `src/app/components/portfolio/MaintenanceForecastTab.tsx` (imports, `DraftForm`, component body, JSX)

- [ ] **Step 1: Add the hook import and call**

Add the import (after the `CostOverride` type import added in Task 3):

```ts
import { useCostOverrides } from "../../hooks/useCostOverrides";
```

Inside the `MaintenanceForecastTab` component function, add the hook call right after the existing `useServicerReport` call (currently line 185):

```ts
  const { overrides: costOverrides, saving: costSaving, saveOverrides, clearOverrides } = useCostOverrides(leaseId);
```

- [ ] **Step 2: Extend `DraftForm` and its factory functions**

Change the `DraftForm` interface (currently lines 137-143) from:

```ts
interface DraftForm {
  reportDate:         string;
  annualFH:           string;
  annualCy:           string;
  showComponents:     boolean;
  componentRemaining: Record<string, string>; // component name → string (empty = not overridden)
}
```

to:

```ts
interface DraftForm {
  reportDate:          string;
  annualFH:            string;
  annualCy:             string;
  showComponents:      boolean;
  componentRemaining:  Record<string, string>; // component name → string (empty = not overridden)
  showCostOverrides:   boolean;
  costOverrides:       Record<string, string>; // component name → cost string (empty = not overridden)
  costNote:            string;                  // single shared note for whichever costs are changed
}
```

Change `emptyDraft` (currently line 145-147) from:

```ts
function emptyDraft(): DraftForm {
  return { reportDate: "", annualFH: "", annualCy: "", showComponents: false, componentRemaining: {} };
}
```

to:

```ts
function emptyDraft(): DraftForm {
  return {
    reportDate: "", annualFH: "", annualCy: "", showComponents: false, componentRemaining: {},
    showCostOverrides: false, costOverrides: {}, costNote: "",
  };
}
```

Change `draftFromReport` (currently lines 149-159) — this function only knows about `ServicerReport`, so it keeps producing the utilization-related fields and now takes the cost-override map as a second argument:

```ts
function draftFromReport(r: ServicerReport, costOverrides: Record<string, CostOverride>): DraftForm {
  return {
    reportDate:         r.reportDate,
    annualFH:           String(r.annualFH),
    annualCy:           String(r.annualCy),
    showComponents:     Object.keys(r.componentOverrides).length > 0,
    componentRemaining: Object.fromEntries(
      Object.entries(r.componentOverrides).map(([k, v]) => [k, String(v)])
    ),
    showCostOverrides:  Object.keys(costOverrides).length > 0,
    costOverrides:      Object.fromEntries(
      Object.entries(costOverrides).map(([k, v]) => [k, String(v.costUSD)])
    ),
    costNote:           "",
  };
}
```

- [ ] **Step 3: Update the draft-initialization effect**

Change the existing effect (currently lines 191-193):

```ts
  React.useEffect(() => {
    setDraft(report ? draftFromReport(report) : emptyDraft());
  }, [report]);
```

to:

```ts
  React.useEffect(() => {
    if (report) {
      setDraft(draftFromReport(report, costOverrides));
    } else {
      setDraft(d => ({ ...emptyDraft(), showCostOverrides: Object.keys(costOverrides).length > 0,
        costOverrides: Object.fromEntries(Object.entries(costOverrides).map(([k, v]) => [k, String(v.costUSD)])) }));
    }
  }, [report, costOverrides]);
```

- [ ] **Step 4: Pass `costOverrides` into `buildProjections`**

Change the existing call (currently line 215):

```ts
  const projections = buildProjections(leaseRecord, aircraftType, leaseEndDate, utilOverride);
```

to:

```ts
  const projections = buildProjections(leaseRecord, aircraftType, leaseEndDate, utilOverride, costOverrides);
```

- [ ] **Step 5: Update `handleSave` to also save cost overrides, without forcing servicer-report fields when the user only wants a cost override**

**Design note:** the existing validation unconditionally requires `reportDate`/`annualFH`/`annualCy` before any save succeeds. Left as-is, that would force a user who only wants to correct one component's cost — the exact "just fix this one figure with evidence" workflow this feature exists for — to also fill in servicer utilization data they may not have. The fix: only require the servicer-report fields when the user has actually started filling them in (or already has a saved report); a cost-override-only save skips that validation entirely.

Change `handleSave` (currently lines 234-265) from:

```ts
  async function handleSave() {
    if (!leaseId) return;
    setSaveError(null);

    const fh = parseInt(draft.annualFH, 10);
    const cy = parseInt(draft.annualCy, 10);
    if (!draft.reportDate) { setSaveError("Report date is required."); return; }
    if (isNaN(fh) || fh < 1 || fh > 8760) { setSaveError("Annual FH must be between 1 and 8760."); return; }
    if (isNaN(cy) || cy < 1 || cy > 8760) { setSaveError("Annual cycles must be between 1 and 8760."); return; }

    // Build componentOverrides — omit empty fields
    const componentOverrides: Record<string, number> = {};
    for (const [comp, val] of Object.entries(draft.componentRemaining)) {
      if (val === "") continue;
      const n = parseInt(val, 10);
      if (!isNaN(n) && n >= 0) componentOverrides[comp] = n;
    }

    try {
      await saveReport({
        leaseId,
        msn,
        reportDate:         draft.reportDate,
        annualFH:           fh,
        annualCy:           cy,
        componentOverrides,
      });
      setPanelOpen(false);
    } catch {
      setSaveError("Failed to save. Please try again.");
    }
  }
```

to:

```ts
  async function handleSave() {
    if (!leaseId) return;
    setSaveError(null);

    // Build cost-override changes — omit empty fields
    const costChanges: Record<string, number> = {};
    for (const [comp, val] of Object.entries(draft.costOverrides)) {
      if (val === "") continue;
      const n = parseFloat(val);
      if (!isNaN(n) && n >= 0) costChanges[comp] = n;
    }

    // Servicer-report fields are only required if the user is actually
    // providing servicer data — not just a cost override. Without this
    // check, a user who only wants to correct one component's cost would
    // be forced to also fill in report date/FH/cycles they may not have.
    const wantsServicerReport = draft.reportDate !== "" || draft.annualFH !== "" || draft.annualCy !== "";

    if (wantsServicerReport) {
      const fh = parseInt(draft.annualFH, 10);
      const cy = parseInt(draft.annualCy, 10);
      if (!draft.reportDate) { setSaveError("Report date is required."); return; }
      if (isNaN(fh) || fh < 1 || fh > 8760) { setSaveError("Annual FH must be between 1 and 8760."); return; }
      if (isNaN(cy) || cy < 1 || cy > 8760) { setSaveError("Annual cycles must be between 1 and 8760."); return; }
    }

    if (!wantsServicerReport && Object.keys(costChanges).length === 0) {
      setSaveError("Enter servicer data or a cost override before saving.");
      return;
    }

    // Build componentOverrides — omit empty fields
    const componentOverrides: Record<string, number> = {};
    for (const [comp, val] of Object.entries(draft.componentRemaining)) {
      if (val === "") continue;
      const n = parseInt(val, 10);
      if (!isNaN(n) && n >= 0) componentOverrides[comp] = n;
    }

    try {
      if (wantsServicerReport) {
        const fh = parseInt(draft.annualFH, 10);
        const cy = parseInt(draft.annualCy, 10);
        await saveReport({
          leaseId,
          msn,
          reportDate:         draft.reportDate,
          annualFH:           fh,
          annualCy:           cy,
          componentOverrides,
        });
      }
      if (Object.keys(costChanges).length > 0) {
        await saveOverrides(costChanges, draft.costNote || null);
      }
      setPanelOpen(false);
    } catch {
      setSaveError("Failed to save. Please try again.");
    }
  }
```

- [ ] **Step 6: Update "Reset to heuristic" to also clear cost overrides**

Change the existing button (currently lines 385-394):

```tsx
              {report && (
                <button
                  type="button"
                  onClick={() => { void clearReport(); setPanelOpen(false); }}
                  disabled={saving}
                  style={{ padding: "0.375rem 0.875rem", background: "transparent", color: "#B91C1C", border: "1px solid #FCA5A5", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                >
                  Reset to heuristic
                </button>
              )}
```

to (widen the visibility condition to also show when only cost overrides exist without a servicer report, and clear both):

```tsx
              {(report || Object.keys(costOverrides).length > 0) && (
                <button
                  type="button"
                  onClick={() => { void clearReport(); void clearOverrides(); setPanelOpen(false); }}
                  disabled={saving || costSaving}
                  style={{ padding: "0.375rem 0.875rem", background: "transparent", color: "#B91C1C", border: "1px solid #FCA5A5", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                >
                  Reset to heuristic
                </button>
              )}
```

- [ ] **Step 7: Add the "Component cost overrides" sub-section to the panel**

Add this new block immediately after the existing "Row 3: Per-component remaining units" block (currently lines 336-368, ending with its closing `</div>` before the "Save error" block) — insert between that block's closing `</div>` and the `{/* Save error */}` comment:

```tsx
            {/* Row 4: Per-component cost overrides (optional, collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setDraft(d => ({ ...d, showCostOverrides: !d.showCostOverrides }))}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.75rem", color: "#475569", display: "flex", alignItems: "center", gap: "0.25rem" }}
              >
                {draft.showCostOverrides ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Component cost overrides <span style={{ color: "#94A3B8" }}>(optional)</span>
              </button>

              {draft.showCostOverrides && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginTop: "0.625rem" }}>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {leaseRecord.mrComponents.map(comp => {
                      const heuristic = TYPE_HEURISTICS[aircraftType]?.components[comp.component];
                      const placeholder = heuristic ? String(heuristic.costUSD) : "";
                      return (
                        <label key={comp.component} style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                          {comp.component} <span style={{ fontWeight: 400, color: "#94A3B8" }}>(USD)</span>
                          <input
                            type="number"
                            min={0}
                            value={draft.costOverrides[comp.component] ?? ""}
                            placeholder={placeholder}
                            onChange={e => setDraft(d => ({
                              ...d,
                              costOverrides: { ...d.costOverrides, [comp.component]: e.target.value },
                            }))}
                            style={{ width: "130px", padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                          />
                        </label>
                      );
                    })}
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                    Evidence note <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional — applies to whichever costs above you change)</span>
                    <input
                      type="text"
                      value={draft.costNote}
                      placeholder="e.g. Per MRO quote dated 2026-06-15"
                      onChange={e => setDraft(d => ({ ...d, costNote: e.target.value }))}
                      style={{ width: "100%", maxWidth: "420px", padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                    />
                  </label>
                </div>
              )}
            </div>
```

- [ ] **Step 8: Add source badges to the Component Projection Table**

Change the "Event Cost (Heuristic)" table header (currently part of the header array in the line starting `{(["Component", "Current MR Balance", ...`, around line 495):

```ts
                {(["Component", "Current MR Balance", "Monthly Accrual", "Next Event", "Proj. Balance @ Event", "Event Cost (Heuristic)", "Shortfall / Surplus @ Event", "Proj. Balance @ EOL", "EOL Obligation", "EOL Position"] as const).map((h) => (
```

to:

```ts
                {(["Component", "Current MR Balance", "Monthly Accrual", "Next Event", "Proj. Balance @ Event", "Event Cost", "Shortfall / Surplus @ Event", "Proj. Balance @ EOL", "EOL Obligation", "EOL Position"] as const).map((h) => (
```

Change the Event Cost table cell (currently line 542):

```tsx
                    <td style={{ padding: "0.625rem 0.875rem", fontVariantNumeric: "tabular-nums", color: "#475569" }}>{fmtUSD(p.heuristicEventCost)}</td>
```

to:

```tsx
                    <td style={{ padding: "0.625rem 0.875rem", fontVariantNumeric: "tabular-nums", color: "#475569" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        {fmtUSD(p.heuristicEventCost)}
                        {p.costSource === "override" ? (
                          <span
                            title={p.costOverrideMeta ? `Set by ${p.costOverrideMeta.createdBy} on ${new Date(p.costOverrideMeta.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${p.costOverrideMeta.note ? ` — ${p.costOverrideMeta.note}` : ""}` : undefined}
                            style={{ background: "#002147", color: "#fff", fontSize: "0.5625rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 6px", cursor: "help" }}
                          >
                            Override
                          </span>
                        ) : (
                          <span style={{ color: "#94A3B8", fontSize: "0.5625rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                            Heuristic
                          </span>
                        )}
                      </div>
                    </td>
```

- [ ] **Step 9: Update the table's footer note and the methodology footnote**

Change the table header note (currently line 488):

```tsx
            Source: IATA MCTF / IAWG heuristic · Cirium adapter in Phase 3
```

to:

```tsx
            Source: IATA MCTF / IAWG heuristic · per-component overrides shown above when evidenced · Cirium adapter in Phase 3
```

In the "Methodology footnote" block (currently lines 611-621), add a new sentence right after the existing `<strong>Assumptions:</strong>` line — change:

```tsx
      <div style={{ fontSize: "0.6875rem", color: "#94A3B8", borderTop: "1px solid #F1F5F9", paddingTop: "0.75rem", lineHeight: 1.7 }}>
        <strong>Assumptions:</strong> Heuristic event costs sourced from IATA MCTF & IAWG published cost ranges.
        {report
```

to:

```tsx
      <div style={{ fontSize: "0.6875rem", color: "#94A3B8", borderTop: "1px solid #F1F5F9", paddingTop: "0.75rem", lineHeight: 1.7 }}>
        <strong>Assumptions:</strong> Heuristic event costs sourced from IATA MCTF & IAWG published cost ranges.
        {Object.keys(costOverrides).length > 0 && (
          <> {Object.keys(costOverrides).length} component{Object.keys(costOverrides).length !== 1 ? "s" : ""} overridden from evidence on this lease ({Object.keys(costOverrides).join(", ")}) — see table above for detail.</>
        )}
        {report
```

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean — no errors.

- [ ] **Step 11: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing tests plus the 7 new tests from Task 3.

- [ ] **Step 12: Commit**

```bash
git add src/app/components/portfolio/MaintenanceForecastTab.tsx
git commit -m "feat: add cost-override UI to Maintenance Forecast tab"
```

---

## Task 5: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: View default (no override) state**

Navigate to Maintenance → Aircraft Detail for any aircraft. Confirm the Component Projection Table's "Event Cost" column shows a grey "Heuristic" badge on every row, and the table header note reads "...per-component overrides shown above when evidenced...".

- [ ] **Step 2: Add a cost override (without any servicer data)**

Open the Servicer Report panel, expand "Component cost overrides (optional)", enter a different value for one component (e.g. Engine PR), optionally add an evidence note. Leave the report date / annual FH / annual cycles fields **empty**. Click Save. Confirm:
- The save succeeds — it does NOT demand a report date (this is the cost-override-only path; requiring servicer data here would be the bug Task 4 Step 5's design note describes).
- The panel closes.
- The Component Projection Table's row for that component now shows a navy "Override" badge with the new value.
- Downstream figures for that row (Shortfall/Surplus @ Event, EOL Obligation, EOL Position) and the Portfolio Total row recompute using the new cost.
- Hovering the "Override" badge shows a tooltip with your email, the date, and the note.

- [ ] **Step 2b: Confirm servicer-report validation still works when servicer data IS being entered**

Reopen the panel, type a value into "Annual FH" but leave the report date empty, click Save. Confirm the "Report date is required." error still appears — the validation relaxation from Step 5 must only apply when the user isn't entering servicer data at all, not disable it wholesale.

- [ ] **Step 3: Verify per-lease scoping**

Navigate to a *different* aircraft of the same type (e.g. another A320neo). Confirm its Component Projection Table still shows "Heuristic" for every component — the override from Step 2 did not leak to this lease.

- [ ] **Step 4: Verify Reset to heuristic**

Return to the aircraft from Step 2. Click "Reset to heuristic" in the Servicer Report panel. Confirm the overridden row reverts to a grey "Heuristic" badge with the original heuristic value, and downstream figures revert to match Step 1.

- [ ] **Step 5: Verify audit trail**

Navigate to Settings → Audit Log. Confirm an "override" entry and (after Step 4) a "reset" entry appear for `entity_type: mr_cost_override`, with the correct before/after values and your account as the actor.

- [ ] **Step 6: Verify `RiskECL.tsx` and unrelated Maintenance tabs are unaffected**

Confirm the Overview and Scenario Modelling tabs on the Maintenance page render unchanged (this plan only touches Aircraft Detail / `MaintenanceForecastTab.tsx`), and Risk & ECL's own scenario editors are untouched by this plan (no files this plan modifies are shared with that page).
