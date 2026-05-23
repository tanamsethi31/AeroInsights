# Maintenance Editability & Event Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the servicer report data loop in the Maintenance section and add a per-aircraft event log that directly adjusts MR balance calculations.

**Architecture:** A pure `applyEvents` / `applyServicerReport` pipeline transforms raw `LeaseSDMR` records before they reach `buildProjections` — no changes to `buildProjections` itself. `Maintenance.tsx` fetches all servicer reports and events in two bulk Supabase queries, computes `adjustedLeases`, and passes them down as props. A new `MaintenanceEventLog` component renders the per-aircraft timeline and inline "Log Event" form.

**Tech Stack:** React, TypeScript, Supabase (via existing `supabase` client), Vitest (tests), existing `LeaseSDMR` / `ServicerReport` / `buildProjections` types already in scope.

---

## File Map

| Action | File |
|--------|------|
| Create | `supabase/migrations/014_maintenance_events.sql` |
| Create | `src/app/utils/maintenanceEvents.ts` |
| Create | `src/app/utils/maintenanceEvents.test.ts` |
| Create | `src/app/hooks/useAllServicerReports.ts` |
| Create | `src/app/hooks/useAllMaintenanceEvents.ts` |
| Create | `src/app/hooks/useMaintenanceEvents.ts` |
| Create | `src/app/components/maintenance/MaintenanceEventLog.tsx` |
| Modify | `src/app/pages/Maintenance.tsx` |
| Modify | `src/app/components/maintenance/MRPortfolioGrid.tsx` |
| Modify | `src/app/components/maintenance/ScenarioModellingTab.tsx` |
| Modify | `src/app/components/maintenance/AircraftDetailTab.tsx` |

---

### Task 1: Database migration — maintenance_events table

**Files:**
- Create: `supabase/migrations/014_maintenance_events.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/014_maintenance_events.sql
-- One row per maintenance event (shop visit, AOG, etc.) per lease.
-- component_impacts JSONB array: [{ "component": "Engine PR", "cost_paid_usd": 5400000, "remaining_units_after": 18000 }]
-- remaining_units_after is null when the event does not reset the maintenance clock.

create table maintenance_events (
  id                uuid        primary key default gen_random_uuid(),
  org_id            uuid        not null references organisations(id) on delete cascade,
  lease_id          text        not null,
  event_date        date        not null,
  event_type        text        not null
                    check (event_type in ('shop_visit','aog','llp_replacement','supplemental_claim','note')),
  notes             text,
  component_impacts jsonb       not null default '[]',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index maintenance_events_org_lease_idx
  on maintenance_events(org_id, lease_id);
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with:
- `name`: `014_maintenance_events`
- `query`: the SQL above

- [ ] **Step 3: Verify the table exists**

Use `mcp__plugin_supabase_supabase__list_tables` and confirm `maintenance_events` appears.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/014_maintenance_events.sql
git commit -m "feat: add maintenance_events table migration"
```

---

### Task 2: Pure functions — applyServicerReport, applyEvents, adjustedLease (TDD)

**Files:**
- Create: `src/app/utils/maintenanceEvents.ts`
- Create: `src/app/utils/maintenanceEvents.test.ts`

**Context:** `ServicerReport` is from `src/app/hooks/useServicerReport.ts`. `LeaseSDMR`, `MRComponent` are from `src/app/components/portfolio/SDMRTab.tsx`. `UtilOverride` is from `src/app/components/portfolio/MaintenanceForecastTab.tsx`.

The key design: `applyServicerReport` returns `{ lease: LeaseSDMR; utilOverride: UtilOverride }`. `applyEvents` returns `LeaseSDMR`. `adjustedLease` composes both and returns `AdjustedLease`.

The `MRPortfolioGrid`, `ScenarioModellingTab`, and `AircraftDetailTab` all destructure `AdjustedLease` when calling `buildProjections`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/utils/maintenanceEvents.test.ts
import { describe, it, expect } from "vitest";
import { applyServicerReport, applyEvents, adjustedLease } from "./maintenanceEvents";
import type { AdjustedLease, MaintenanceEvent } from "./maintenanceEvents";
import type { LeaseSDMR } from "../components/portfolio/SDMRTab";
import type { ServicerReport } from "../hooks/useServicerReport";

// ── Minimal factory ───────────────────────────────────────────────────────────

function makeLease(): LeaseSDMR {
  return {
    leaseId:         "LSE-TEST-001",
    lessee:          "Test Airline",
    aircraft:        "A320neo",
    eadNum:          0,
    baseLGD:         50,
    returnCondition: "half-life",
    leaseEnd:        "2030-01-01",
    stage:           1,
    sd: { type: "Cash", amount: 0, currency: "USD", refundTriggers: [], governingLaw: "English" },
    mrComponents: [
      {
        component: "Engine PR", rateBasis: "$/FH", rateAmount: 310,
        unitsAccumulated: 20_000, cumulativeBalance: 6_000_000, refundable: true,
        capRule: "", evidencedCost: 5_000_000, fullIntervalUnits: 20_000, remainingUnits: 8_000,
      },
      {
        component: "LLPs", rateBasis: "$/cycle", rateAmount: 90,
        unitsAccumulated: 14_000, cumulativeBalance: 1_200_000, refundable: false,
        capRule: "", evidencedCost: 0, fullIntervalUnits: 20_000, remainingUnits: 6_000,
      },
    ],
  };
}

function makeReport(overrides: Partial<ServicerReport> = {}): ServicerReport {
  return {
    id: "r1", leaseId: "LSE-TEST-001", msn: "9999",
    reportDate: "2026-01-01", annualFH: 4000, annualCy: 2800,
    componentOverrides: {},
    ...overrides,
  };
}

// ── applyServicerReport ───────────────────────────────────────────────────────

describe("applyServicerReport", () => {
  it("sets utilOverride.annualFH and annualCy from report", () => {
    const result = applyServicerReport(makeLease(), makeReport({ annualFH: 4000, annualCy: 2800 }));
    expect(result.utilOverride.annualFH).toBe(4000);
    expect(result.utilOverride.annualCy).toBe(2800);
  });

  it("updates remainingUnits for component listed in componentOverrides", () => {
    const result = applyServicerReport(
      makeLease(),
      makeReport({ componentOverrides: { "Engine PR": 18_000 } }),
    );
    const ep = result.lease.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.remainingUnits).toBe(18_000);
  });

  it("does not change remainingUnits for component absent from componentOverrides", () => {
    const result = applyServicerReport(
      makeLease(),
      makeReport({ componentOverrides: { "Engine PR": 18_000 } }),
    );
    const llps = result.lease.mrComponents.find(c => c.component === "LLPs")!;
    expect(llps.remainingUnits).toBe(6_000); // unchanged
  });

  it("does not change cumulativeBalance", () => {
    const result = applyServicerReport(makeLease(), makeReport());
    const ep = result.lease.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.cumulativeBalance).toBe(6_000_000);
  });

  it("componentRemaining on utilOverride is empty (already baked into remainingUnits)", () => {
    const result = applyServicerReport(
      makeLease(),
      makeReport({ componentOverrides: { "Engine PR": 18_000 } }),
    );
    expect(result.utilOverride.componentRemaining).toEqual({});
  });
});

// ── applyEvents ───────────────────────────────────────────────────────────────

describe("applyEvents", () => {
  it("returns lease unchanged when events is empty", () => {
    const lease = makeLease();
    const result = applyEvents(lease, []);
    expect(result.mrComponents[0].cumulativeBalance).toBe(6_000_000);
    expect(result.mrComponents[0].remainingUnits).toBe(8_000);
  });

  it("reduces cumulativeBalance by costPaidUSD", () => {
    const evt: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2026-03-01",
      eventType: "shop_visit", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 5_400_000, remainingUnitsAfter: 18_000 }],
    };
    const result = applyEvents(makeLease(), [evt]);
    const ep = result.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.cumulativeBalance).toBe(6_000_000 - 5_400_000);
  });

  it("sets remainingUnits to remainingUnitsAfter when non-null", () => {
    const evt: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2026-03-01",
      eventType: "shop_visit", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 5_400_000, remainingUnitsAfter: 18_000 }],
    };
    const result = applyEvents(makeLease(), [evt]);
    const ep = result.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.remainingUnits).toBe(18_000);
  });

  it("does not change remainingUnits when remainingUnitsAfter is null", () => {
    const evt: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2026-03-01",
      eventType: "supplemental_claim", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 200_000, remainingUnitsAfter: null }],
    };
    const result = applyEvents(makeLease(), [evt]);
    const ep = result.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.remainingUnits).toBe(8_000); // unchanged
    expect(ep.cumulativeBalance).toBe(6_000_000 - 200_000); // still deducted
  });

  it("accumulates cost from multiple events; latest non-null remainingUnitsAfter wins", () => {
    const evt1: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2025-01-01",
      eventType: "shop_visit", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 3_000_000, remainingUnitsAfter: 18_000 }],
    };
    const evt2: MaintenanceEvent = {
      id: "e2", leaseId: "LSE-TEST-001", eventDate: "2026-06-01",
      eventType: "supplemental_claim", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 500_000, remainingUnitsAfter: 12_000 }],
    };
    const result = applyEvents(makeLease(), [evt2, evt1]); // intentionally out of order
    const ep = result.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.cumulativeBalance).toBe(6_000_000 - 3_000_000 - 500_000);
    expect(ep.remainingUnits).toBe(12_000); // evt2 is later, wins
  });

  it("does not change components not mentioned in events", () => {
    const evt: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2026-03-01",
      eventType: "shop_visit", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 5_400_000, remainingUnitsAfter: 18_000 }],
    };
    const result = applyEvents(makeLease(), [evt]);
    const llps = result.mrComponents.find(c => c.component === "LLPs")!;
    expect(llps.cumulativeBalance).toBe(1_200_000); // unchanged
    expect(llps.remainingUnits).toBe(6_000);         // unchanged
  });
});

// ── adjustedLease ─────────────────────────────────────────────────────────────

describe("adjustedLease", () => {
  it("returns lease unchanged and utilOverride undefined when no report and no events", () => {
    const result = adjustedLease(makeLease(), null, []);
    expect(result.lease.mrComponents[0].cumulativeBalance).toBe(6_000_000);
    expect(result.utilOverride).toBeUndefined();
  });

  it("applies servicer report before events (events can override report remainingUnits)", () => {
    // Report sets Engine PR remaining = 18000
    // Event then resets to 12000 (later event should win)
    const report = makeReport({ componentOverrides: { "Engine PR": 18_000 } });
    const evt: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2026-06-01",
      eventType: "shop_visit", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 500_000, remainingUnitsAfter: 12_000 }],
    };
    const result = adjustedLease(makeLease(), report, [evt]);
    const ep = result.lease.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.remainingUnits).toBe(12_000); // event overrides report
    expect(ep.cumulativeBalance).toBe(6_000_000 - 500_000);
  });

  it("exposes utilOverride from servicer report", () => {
    const report = makeReport({ annualFH: 4000, annualCy: 2800 });
    const result = adjustedLease(makeLease(), report, []);
    expect(result.utilOverride?.annualFH).toBe(4000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run --reporter=verbose src/app/utils/maintenanceEvents.test.ts
```

Expected: FAIL — `Cannot find module './maintenanceEvents'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/utils/maintenanceEvents.ts
import type { LeaseSDMR } from "../components/portfolio/SDMRTab";
import type { ServicerReport } from "../hooks/useServicerReport";
import type { UtilOverride } from "../components/portfolio/MaintenanceForecastTab";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComponentImpact {
  component:           string;
  costPaidUSD:         number;
  remainingUnitsAfter: number | null;
}

export interface MaintenanceEvent {
  id:               string;
  leaseId:          string;
  eventDate:        string;   // "YYYY-MM-DD"
  eventType:        "shop_visit" | "aog" | "llp_replacement" | "supplemental_claim" | "note";
  notes:            string | null;
  componentImpacts: ComponentImpact[];
}

export interface AdjustedLease {
  lease:       LeaseSDMR;
  utilOverride: UtilOverride | undefined;
}

// ── Pure functions ────────────────────────────────────────────────────────────

/**
 * Applies a servicer report to a lease:
 * - Updates mrComponents[].remainingUnits for components in componentOverrides
 * - Returns a UtilOverride carrying annualFH/annualCy (with empty componentRemaining
 *   because remainingUnits are already baked into the returned lease)
 */
export function applyServicerReport(
  lease:  LeaseSDMR,
  report: ServicerReport,
): AdjustedLease {
  const updatedComponents = lease.mrComponents.map(comp => {
    const override = report.componentOverrides[comp.component];
    return override !== undefined ? { ...comp, remainingUnits: override } : comp;
  });

  return {
    lease: { ...lease, mrComponents: updatedComponents },
    utilOverride: {
      annualFH:           report.annualFH,
      annualCy:           report.annualCy,
      componentRemaining: {},  // already baked into remainingUnits above
    },
  };
}

/**
 * Applies maintenance events to a lease:
 * - Subtracts costPaidUSD from cumulativeBalance per component
 * - Sets remainingUnits to the most recent non-null remainingUnitsAfter
 * Events are applied oldest-to-newest regardless of input order.
 */
export function applyEvents(
  lease:  LeaseSDMR,
  events: MaintenanceEvent[],
): LeaseSDMR {
  if (events.length === 0) return lease;

  const sorted = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const updatedComponents = lease.mrComponents.map(comp => {
    let balance   = comp.cumulativeBalance;
    let remaining = comp.remainingUnits;

    for (const evt of sorted) {
      for (const impact of evt.componentImpacts) {
        if (impact.component === comp.component) {
          balance -= impact.costPaidUSD;
          if (impact.remainingUnitsAfter !== null) {
            remaining = impact.remainingUnitsAfter;
          }
        }
      }
    }

    return { ...comp, cumulativeBalance: balance, remainingUnits: remaining };
  });

  return { ...lease, mrComponents: updatedComponents };
}

/**
 * Composes applyServicerReport + applyEvents.
 * Servicer report is applied first (sets baseline utilization + remaining units),
 * then events are applied on top (drawdowns and resets from subsequent events).
 */
export function adjustedLease(
  raw:    LeaseSDMR,
  report: ServicerReport | null,
  events: MaintenanceEvent[],
): AdjustedLease {
  const afterReport: AdjustedLease = report
    ? applyServicerReport(raw, report)
    : { lease: raw, utilOverride: undefined };

  return {
    lease:       applyEvents(afterReport.lease, events),
    utilOverride: afterReport.utilOverride,
  };
}

// ── Row mapper (used by hooks) ────────────────────────────────────────────────

export function mapEventRow(row: Record<string, unknown>): MaintenanceEvent {
  return {
    id:               row.id as string,
    leaseId:          row.lease_id as string,
    eventDate:        row.event_date as string,
    eventType:        row.event_type as MaintenanceEvent["eventType"],
    notes:            (row.notes as string | null) ?? null,
    componentImpacts: (row.component_impacts as ComponentImpact[]) ?? [],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run --reporter=verbose src/app/utils/maintenanceEvents.test.ts
```

Expected: all 12 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/maintenanceEvents.ts src/app/utils/maintenanceEvents.test.ts
git commit -m "feat: add applyEvents, applyServicerReport, adjustedLease pure functions (TDD)"
```

---

### Task 3: Bulk data hooks — useAllServicerReports + useAllMaintenanceEvents

**Files:**
- Create: `src/app/hooks/useAllServicerReports.ts`
- Create: `src/app/hooks/useAllMaintenanceEvents.ts`

**Context:** Both hooks mirror the pattern in `src/app/hooks/useServicerReport.ts`. They return empty Maps when `orgId` is null (demo mode). `ServicerReport` row mapper is already in `useServicerReport.ts` as `mapRow` (private); we need to duplicate it here since it isn't exported.

- [ ] **Step 1: Write useAllServicerReports**

```typescript
// src/app/hooks/useAllServicerReports.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import type { ServicerReport } from "./useServicerReport";

function mapRow(row: Record<string, unknown>): ServicerReport {
  return {
    id:                 row.id as string,
    leaseId:            row.lease_id as string,
    msn:                row.msn as string,
    reportDate:         row.report_date as string,
    annualFH:           Number(row.annual_fh),
    annualCy:           Number(row.annual_cy),
    componentOverrides: (row.component_overrides as Record<string, number>) ?? {},
  };
}

export function useAllServicerReports(): {
  reports: Map<string, ServicerReport>;
  loading: boolean;
} {
  const { orgId } = useData();
  const [reports, setReports] = useState<Map<string, ServicerReport>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) { setReports(new Map()); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("servicer_reports")
        .select("*")
        .eq("org_id", orgId);

      if (cancelled) { setLoading(false); return; }
      if (error) {
        console.error("[useAllServicerReports] load error:", error);
        setLoading(false);
        return;
      }
      const map = new Map<string, ServicerReport>();
      for (const row of data ?? []) {
        const r = mapRow(row as Record<string, unknown>);
        map.set(r.leaseId, r);
      }
      setReports(map);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  return { reports, loading };
}
```

- [ ] **Step 2: Write useAllMaintenanceEvents**

```typescript
// src/app/hooks/useAllMaintenanceEvents.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { mapEventRow } from "../utils/maintenanceEvents";
import type { MaintenanceEvent } from "../utils/maintenanceEvents";

export function useAllMaintenanceEvents(): {
  eventsMap: Map<string, MaintenanceEvent[]>;
  loading:   boolean;
} {
  const { orgId } = useData();
  const [eventsMap, setEventsMap] = useState<Map<string, MaintenanceEvent[]>>(new Map());
  const [loading,   setLoading  ] = useState(false);

  useEffect(() => {
    if (!orgId) { setEventsMap(new Map()); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("maintenance_events")
        .select("*")
        .eq("org_id", orgId)
        .order("event_date", { ascending: true });

      if (cancelled) { setLoading(false); return; }
      if (error) {
        console.error("[useAllMaintenanceEvents] load error:", error);
        setLoading(false);
        return;
      }

      const map = new Map<string, MaintenanceEvent[]>();
      for (const row of data ?? []) {
        const evt = mapEventRow(row as Record<string, unknown>);
        const existing = map.get(evt.leaseId) ?? [];
        map.set(evt.leaseId, [...existing, evt]);
      }
      setEventsMap(map);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  return { eventsMap, loading };
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx vite build 2>&1 | grep -E "error|Error" | head -20
```

Expected: build completes with no errors (or only pre-existing warnings)

- [ ] **Step 4: Commit**

```bash
git add src/app/hooks/useAllServicerReports.ts src/app/hooks/useAllMaintenanceEvents.ts
git commit -m "feat: add useAllServicerReports and useAllMaintenanceEvents bulk hooks"
```

---

### Task 4: Per-lease mutation hook — useMaintenanceEvents

**Files:**
- Create: `src/app/hooks/useMaintenanceEvents.ts`

**Context:** This hook is used in `AircraftDetailTab` for the selected aircraft. It loads events for one lease and provides `logEvent` / `deleteEvent` with optimistic updates. Pattern mirrors `useServicerReport.ts`.

- [ ] **Step 1: Write the hook**

```typescript
// src/app/hooks/useMaintenanceEvents.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { mapEventRow } from "../utils/maintenanceEvents";
import type { MaintenanceEvent } from "../utils/maintenanceEvents";

export function useMaintenanceEvents(leaseId: string | null): {
  events:      MaintenanceEvent[];
  saving:      boolean;
  logEvent:    (data: Omit<MaintenanceEvent, "id">) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
} {
  const { orgId } = useData();
  const [events,  setEvents ] = useState<MaintenanceEvent[]>([]);
  const [saving,  setSaving ] = useState(false);

  useEffect(() => {
    if (!orgId || !leaseId) { setEvents([]); return; }

    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("maintenance_events")
        .select("*")
        .eq("org_id", orgId)
        .eq("lease_id", leaseId)
        .order("event_date", { ascending: true });

      if (cancelled) return;
      if (error) { console.error("[useMaintenanceEvents] load error:", error); return; }
      setEvents((data ?? []).map(r => mapEventRow(r as Record<string, unknown>)));
    };

    load();
    return () => { cancelled = true; };
  }, [orgId, leaseId]);

  const logEvent = useCallback(async (data: Omit<MaintenanceEvent, "id">) => {
    if (!orgId || !leaseId) return;
    setSaving(true);

    // Optimistic add with temp id
    const tempId = `temp-${Date.now()}`;
    setEvents(prev => [...prev, { ...data, id: tempId }]);

    try {
      const { data: row, error } = await supabase
        .from("maintenance_events")
        .insert({
          org_id:            orgId,
          lease_id:          leaseId,
          event_date:        data.eventDate,
          event_type:        data.eventType,
          notes:             data.notes,
          component_impacts: data.componentImpacts,
        })
        .select()
        .single();

      if (error) {
        console.error("[useMaintenanceEvents] logEvent error:", error);
        setEvents(prev => prev.filter(e => e.id !== tempId)); // rollback
        throw error;
      } else if (row) {
        const saved = mapEventRow(row as Record<string, unknown>);
        setEvents(prev => prev.map(e => e.id === tempId ? saved : e));
      }
    } finally {
      setSaving(false);
    }
  }, [orgId, leaseId]);

  const deleteEvent = useCallback(async (id: string) => {
    if (!orgId) return;
    setSaving(true);

    const snapshot = events;
    setEvents(prev => prev.filter(e => e.id !== id));

    try {
      const { error } = await supabase
        .from("maintenance_events")
        .delete()
        .eq("id", id)
        .eq("org_id", orgId);

      if (error) {
        console.error("[useMaintenanceEvents] deleteEvent error:", error);
        setEvents(snapshot); // rollback
        throw error;
      }
    } finally {
      setSaving(false);
    }
  }, [orgId, events]);

  return { events, saving, logEvent, deleteEvent };
}
```

- [ ] **Step 2: Verify build is clean**

```bash
npx vite build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/app/hooks/useMaintenanceEvents.ts
git commit -m "feat: add useMaintenanceEvents per-lease mutation hook"
```

---

### Task 5: MaintenanceEventLog component

**Files:**
- Create: `src/app/components/maintenance/MaintenanceEventLog.tsx`

**Context:** Rendered in `AircraftDetailTab` below the projection table. Receives `events`, `saving`, `logEvent`, `deleteEvent` from the `useMaintenanceEvents` hook (passed as props — no hook call inside this component). The `mrComponents` prop is the list of components for the selected aircraft (used to populate the component selector in the form).

- [ ] **Step 1: Write the component**

```typescript
// src/app/components/maintenance/MaintenanceEventLog.tsx
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { MaintenanceEvent, ComponentImpact } from "../../utils/maintenanceEvents";

const COMPONENT_NAMES = ["Airframe HSI", "Engine PR", "LLPs", "Landing Gear", "APU"] as const;

const EVENT_TYPE_LABELS: Record<MaintenanceEvent["eventType"], string> = {
  shop_visit:          "Shop Visit",
  aog:                 "AOG",
  llp_replacement:     "LLP Replacement",
  supplemental_claim:  "Supplemental Claim",
  note:                "Note",
};

const EVENT_TYPE_COLORS: Record<MaintenanceEvent["eventType"], { bg: string; color: string }> = {
  shop_visit:          { bg: "#DBEAFE", color: "#1D4ED8" },
  aog:                 { bg: "#FEE2E2", color: "#B91C1C" },
  llp_replacement:     { bg: "#FEF3C7", color: "#B45309" },
  supplemental_claim:  { bg: "#FEF3C7", color: "#B45309" },
  note:                { bg: "#F1F5F9", color: "#475569" },
};

interface ImpactDraft {
  component:      string;
  costPaid:       string;   // number as string; empty = invalid
  remainingAfter: string;   // number as string; empty = null (no reset)
}

interface Props {
  events:      MaintenanceEvent[];
  saving:      boolean;
  logEvent:    (data: Omit<MaintenanceEvent, "id">) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  leaseId:     string;
}

function emptyImpact(): ImpactDraft {
  return { component: COMPONENT_NAMES[0], costPaid: "", remainingAfter: "" };
}

export function MaintenanceEventLog({ events, saving, logEvent, deleteEvent, leaseId }: Props) {
  const [formOpen,    setFormOpen   ] = useState(false);
  const [eventDate,   setEventDate  ] = useState("");
  const [eventType,   setEventType  ] = useState<MaintenanceEvent["eventType"]>("shop_visit");
  const [notes,       setNotes      ] = useState("");
  const [impacts,     setImpacts    ] = useState<ImpactDraft[]>([emptyImpact()]);
  const [formError,   setFormError  ] = useState<string | null>(null);
  const [deletingId,  setDeletingId ] = useState<string | null>(null);

  function resetForm() {
    setEventDate(""); setEventType("shop_visit"); setNotes("");
    setImpacts([emptyImpact()]); setFormError(null);
  }

  function addImpactRow() {
    setImpacts(prev => [...prev, emptyImpact()]);
  }

  function removeImpactRow(i: number) {
    setImpacts(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateImpact(i: number, field: keyof ImpactDraft, value: string) {
    setImpacts(prev => prev.map((imp, idx) => idx === i ? { ...imp, [field]: value } : imp));
  }

  async function handleSave() {
    setFormError(null);
    if (!eventDate) { setFormError("Event date is required."); return; }

    const requiresImpacts = eventType !== "note";
    const validImpacts: ComponentImpact[] = [];

    for (const imp of impacts) {
      const cost = parseFloat(imp.costPaid);
      if (isNaN(cost) || cost <= 0) {
        if (requiresImpacts || imp.costPaid !== "") {
          setFormError("Cost paid must be a positive number for each component impact.");
          return;
        }
        continue;
      }
      const remaining = imp.remainingAfter === "" ? null : parseInt(imp.remainingAfter, 10);
      if (imp.remainingAfter !== "" && (isNaN(remaining!) || remaining! < 0)) {
        setFormError("Remaining units after must be a non-negative integer, or leave blank.");
        return;
      }
      validImpacts.push({
        component:           imp.component,
        costPaidUSD:         cost,
        remainingUnitsAfter: remaining,
      });
    }

    if (requiresImpacts && validImpacts.length === 0) {
      setFormError("At least one component impact with a cost is required.");
      return;
    }

    try {
      await logEvent({
        leaseId,
        eventDate,
        eventType,
        notes: notes.trim() || null,
        componentImpacts: validImpacts,
      });
      setFormOpen(false);
      resetForm();
    } catch {
      setFormError("Failed to save event. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this maintenance event? This cannot be undone.")) return;
    setDeletingId(id);
    try { await deleteEvent(id); } finally { setDeletingId(null); }
  }

  const sorted = [...events].sort((a, b) => b.eventDate.localeCompare(a.eventDate)); // newest first

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "1.25rem" }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Maintenance Events
        </span>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: "0.25rem",
              padding: "0.25rem 0.75rem", background: "#002147", color: "#FFFFFF",
              border: "none", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            <Plus size={12} /> Log Event
          </button>
        )}
      </div>

      {/* ── Inline form ──────────────────────────────────────────────── */}
      {formOpen && (
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>

          {/* Row 1: date + type */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
              Event Date *
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                style={{ padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.8rem", background: "#FFFFFF" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
              Event Type
              <select
                value={eventType}
                onChange={e => setEventType(e.target.value as MaintenanceEvent["eventType"])}
                style={{ padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.8rem", background: "#FFFFFF" }}
              >
                {(Object.keys(EVENT_TYPE_LABELS) as MaintenanceEvent["eventType"][]).map(t => (
                  <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Row 2: notes */}
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
            Notes (optional)
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Describe the event..."
              style={{ padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.8rem", background: "#FFFFFF", resize: "vertical" }}
            />
          </label>

          {/* Row 3: component impacts */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.5rem" }}>
              Component Impacts {eventType !== "note" && <span style={{ color: "#94A3B8", fontWeight: 400 }}>(required)</span>}
            </div>
            {impacts.map((imp, i) => (
              <div key={i} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "0.5rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                  Component
                  <select
                    value={imp.component}
                    onChange={e => updateImpact(i, "component", e.target.value)}
                    style={{ padding: "0.3rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.78rem", background: "#FFFFFF" }}
                  >
                    {COMPONENT_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                  Cost Paid ($)
                  <input
                    type="number" min={0} value={imp.costPaid}
                    onChange={e => updateImpact(i, "costPaid", e.target.value)}
                    placeholder="e.g. 5400000"
                    style={{ padding: "0.3rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.78rem", width: "130px", background: "#FFFFFF" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                  Remaining Units After <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span>
                  <input
                    type="number" min={0} value={imp.remainingAfter}
                    onChange={e => updateImpact(i, "remainingAfter", e.target.value)}
                    placeholder="leave blank if no reset"
                    style={{ padding: "0.3rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.78rem", width: "180px", background: "#FFFFFF" }}
                  />
                </label>
                {impacts.length > 1 && (
                  <button
                    onClick={() => removeImpactRow(i)}
                    style={{ padding: "0.3rem 0.5rem", background: "none", border: "1px solid #E2E8F0", borderRadius: "6px", cursor: "pointer", color: "#94A3B8", fontSize: "0.78rem" }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addImpactRow}
              style={{ fontSize: "0.75rem", color: "#002147", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
            >
              + Add component
            </button>
          </div>

          {formError && (
            <div style={{ fontSize: "0.75rem", color: "#B91C1C", background: "#FEE2E2", padding: "0.375rem 0.625rem", borderRadius: "6px" }}>
              {formError}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.625rem" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "0.375rem 1rem", background: "#002147", color: "#FFFFFF",
                border: "none", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : "Save Event"}
            </button>
            <button
              onClick={() => { setFormOpen(false); resetForm(); }}
              style={{ padding: "0.375rem 1rem", background: "none", border: "1px solid #E2E8F0", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer", color: "#475569" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Event timeline ───────────────────────────────────────────── */}
      {sorted.length === 0 && !formOpen ? (
        <div style={{ fontSize: "0.8125rem", color: "#94A3B8", textAlign: "center", padding: "1.5rem 0" }}>
          No events logged for this aircraft.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {sorted.map(evt => {
            const badge = EVENT_TYPE_COLORS[evt.eventType];
            return (
              <div key={evt.id} style={{ border: "1px solid #F1F5F9", borderRadius: "8px", padding: "0.75rem 1rem", background: "#FAFAFA" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: evt.componentImpacts.length > 0 || evt.notes ? "0.5rem" : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>
                      {new Date(evt.eventDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "0.15rem 0.5rem", borderRadius: "999px", background: badge.bg, color: badge.color }}>
                      {EVENT_TYPE_LABELS[evt.eventType]}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(evt.id)}
                    disabled={deletingId === evt.id}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 0 }}
                    title="Delete event"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {evt.componentImpacts.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: evt.notes ? "0.375rem" : 0 }}>
                    {evt.componentImpacts.map((imp, i) => (
                      <span key={i} style={{ fontSize: "0.72rem", background: "#EFF6FF", color: "#1D4ED8", padding: "0.15rem 0.5rem", borderRadius: "999px", fontVariantNumeric: "tabular-nums" }}>
                        {imp.component} −${(imp.costPaidUSD / 1_000_000).toFixed(2)}M
                        {imp.remainingUnitsAfter !== null && ` → ${imp.remainingUnitsAfter.toLocaleString()} units`}
                      </span>
                    ))}
                  </div>
                )}
                {evt.notes && (
                  <div style={{ fontSize: "0.78rem", color: "#475569", fontStyle: "italic" }}>
                    {evt.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build is clean**

```bash
npx vite build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/app/components/maintenance/MaintenanceEventLog.tsx
git commit -m "feat: add MaintenanceEventLog component with timeline and inline form"
```

---

### Task 6: Wire Maintenance.tsx — fetch bulk data, compute adjustedLeases

**Files:**
- Modify: `src/app/pages/Maintenance.tsx`

**Context:** Current `Maintenance.tsx` (30 lines) passes static `sdmrData` directly to tabs. After this task it fetches bulk reports and events, computes `adjustedLeases`, and passes them to all three tabs. Tabs accept `adjustedLeases` prop (Tasks 7–9 update the tabs themselves). For now, add the prop — the tabs will be updated in subsequent tasks.

- [ ] **Step 1: Replace Maintenance.tsx**

```typescript
// src/app/pages/Maintenance.tsx
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { PageHeader } from "../components/ui/PageHeader";
import { PillTabs } from "../components/ui/PillTabs";
import { sdmrData } from "../components/portfolio/SDMRTab";
import { toMRChartData } from "../lib/mrChartAdapters";
import { MRPortfolioGrid } from "../components/maintenance/MRPortfolioGrid";
import { MRCashflowChart } from "../components/maintenance/MRCashflowChart";
import { MREventCalendar } from "../components/maintenance/MREventCalendar";
import { AircraftDetailTab } from "../components/maintenance/AircraftDetailTab";
import { ScenarioModellingTab } from "../components/maintenance/ScenarioModellingTab";
import { useAllServicerReports } from "../hooks/useAllServicerReports";
import { useAllMaintenanceEvents } from "../hooks/useAllMaintenanceEvents";
import { adjustedLease } from "../utils/maintenanceEvents";
import type { AdjustedLease } from "../utils/maintenanceEvents";

const PATH_TAB: Record<string, string> = {
  "/maintenance":           "Overview",
  "/maintenance/aircraft":  "Aircraft Detail",
  "/maintenance/scenarios": "Scenario Modelling",
};

const TABS = ["Overview", "Aircraft Detail", "Scenario Modelling"];

export default function Maintenance() {
  const { pathname } = useLocation();
  const [activeTab, setActiveTab] = useState(() => PATH_TAB[pathname] ?? "Overview");

  useEffect(() => {
    setActiveTab(PATH_TAB[pathname] ?? "Overview");
  }, [pathname]);

  const { reports, loading: reportsLoading } = useAllServicerReports();
  const { eventsMap, loading: eventsLoading } = useAllMaintenanceEvents();

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

  const isLoading = reportsLoading || eventsLoading;

  return (
    <>
      <PageHeader title="Maintenance Reserves" />

      <div style={{ padding: "1.5rem 2rem" }}>
        <PillTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "Overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1.5rem" }}>
            {isLoading ? (
              <div style={{ color: "#94A3B8", fontSize: "0.875rem", padding: "2rem 0" }}>Loading maintenance data…</div>
            ) : (
              <MRPortfolioGrid adjustedLeases={adjustedLeases} />
            )}
            <MRCashflowChart data={chartData.cashflow} />
            <MREventCalendar
              data={chartData.events}
              leaseIds={chartData.leaseIds}
              leaseColors={chartData.leaseColors}
              leaseLessees={leaseLessees}
            />
          </div>
        )}

        {activeTab === "Aircraft Detail" && (
          <AircraftDetailTab adjustedLeases={adjustedLeases} eventsMap={eventsMap} />
        )}

        {activeTab === "Scenario Modelling" && (
          <ScenarioModellingTab adjustedLeases={adjustedLeases} />
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify build (tabs will have type errors until Tasks 7–9 — that's expected)**

```bash
npx vite build 2>&1 | grep -E "error|Error" | head -20
```

Expected: TypeScript errors about missing `adjustedLeases` props in MRPortfolioGrid, AircraftDetailTab, ScenarioModellingTab. These are fixed in Tasks 7–9.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/Maintenance.tsx
git commit -m "feat: wire Maintenance.tsx to fetch bulk servicer reports and maintenance events"
```

---

### Task 7: Update MRPortfolioGrid to accept adjustedLeases prop

**Files:**
- Modify: `src/app/components/maintenance/MRPortfolioGrid.tsx`

**Context:** Currently imports `sdmrData` directly and accesses `lease` objects. After this task it receives `adjustedLeases: AdjustedLease[]` and passes `adj.utilOverride` to `buildProjections`.

- [ ] **Step 1: Update the imports and Props interface**

At the top of `src/app/components/maintenance/MRPortfolioGrid.tsx`, change:

```typescript
// Remove this import:
// import { type LeaseSDMR } from "../portfolio/SDMRTab";

// Add these imports after the existing ones:
import { buildProjections } from "../portfolio/MaintenanceForecastTab";
import type { AdjustedLease } from "../../utils/maintenanceEvents";
```

Change the `Props` interface from:

```typescript
interface Props {
  sdmrData: LeaseSDMR[];
}
```

to:

```typescript
interface Props {
  adjustedLeases: AdjustedLease[];
}
```

- [ ] **Step 2: Update the component signature and rows computation**

Change the function signature from:

```typescript
export function MRPortfolioGrid({ sdmrData }: Props) {
```

to:

```typescript
export function MRPortfolioGrid({ adjustedLeases }: Props) {
```

Change the `rows` useMemo from:

```typescript
const rows = useMemo(() => {
  return sdmrData
    .map((lease) => {
      const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
      const leaseEndDate = lease.leaseEnd
        ? parseDateLocal(lease.leaseEnd)
        : ctx
        ? parseDateLocal(ctx.leaseEnd)
        : new Date(2028, 0, 1);

      const projections = buildProjections(lease, lease.aircraft, leaseEndDate);
```

to:

```typescript
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
```

Also update the guard at line 94 from `if (sdmrData.length === 0) return null;` to `if (adjustedLeases.length === 0) return null;`.

- [ ] **Step 3: Verify build is clean**

```bash
npx vite build 2>&1 | grep -E "error|Error" | head -20
```

Expected: MRPortfolioGrid error gone; AircraftDetailTab and ScenarioModellingTab errors may remain until Tasks 8–9.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/maintenance/MRPortfolioGrid.tsx
git commit -m "feat: MRPortfolioGrid accepts adjustedLeases prop, uses servicer report utilization"
```

---

### Task 8: Update ScenarioModellingTab to accept adjustedLeases prop

**Files:**
- Modify: `src/app/components/maintenance/ScenarioModellingTab.tsx`

**Context:** Currently builds `AIRCRAFT_LIST` from static `sdmrData` at module load. After this change it receives `adjustedLeases: AdjustedLease[]` as a prop and uses those as the baseline, while user-controlled FH/CY sliders still override utilization. Note: the scenario tab uses its own slider values as `utilOverride` for the scenario projection — so the adjusted lease's `utilOverride` becomes the *base case*, not the scenario case.

- [ ] **Step 1: Update imports**

At the top of `src/app/components/maintenance/ScenarioModellingTab.tsx`, add:

```typescript
import type { AdjustedLease } from "../../utils/maintenanceEvents";
```

Remove the direct `import { sdmrData }` line (it's no longer needed since data comes via prop).

- [ ] **Step 2: Update the component to accept a prop**

Change:

```typescript
export function ScenarioModellingTab() {
  const [fh,         setFh       ] = useState(DEFAULT_FH);
  const [cy,         setCy       ] = useState(DEFAULT_CY);
  const [expanded,   setExpanded ] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const rows = useMemo(() => {
    return AIRCRAFT_LIST.map(a => {
      const lease = sdmrData.find(l => l.leaseId === a.leaseId);
      if (!lease) throw new Error(`ScenarioModellingTab: no sdmrData entry for leaseId ${a.leaseId}`);
      const leaseEndDate = parseDateLocal(a.leaseEnd);

      const baseProj = buildProjections(lease, lease.aircraft, leaseEndDate);
      const scenProj = buildProjections(lease, lease.aircraft, leaseEndDate, {
        annualFH:           fh,
        annualCy:           cy,
        componentRemaining: {},
      });
```

to:

```typescript
export function ScenarioModellingTab({ adjustedLeases }: { adjustedLeases: AdjustedLease[] }) {
  const [fh,         setFh       ] = useState(DEFAULT_FH);
  const [cy,         setCy       ] = useState(DEFAULT_CY);
  const [expanded,   setExpanded ] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const rows = useMemo(() => {
    return adjustedLeases.map(({ lease, utilOverride }) => {
      const entry = Object.entries(LEASE_CONTEXT).find(([, ctx]) => ctx.leaseId === lease.leaseId);
      const msn = entry?.[0] ?? "";
      const ctx = msn ? LEASE_CONTEXT[msn] : null;
      const leaseEndStr = ctx?.leaseEnd ?? "2030-01-01";
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
```

Also update the rest of the `.map()` body where `a.leaseId`, `a.lessee`, etc. are referenced — they come from the local `a` object defined above.

Remove the static `AIRCRAFT_LIST` constant from the top of the file (it was derived from `sdmrData` and is no longer needed).

- [ ] **Step 3: Verify build is clean**

```bash
npx vite build 2>&1 | grep -E "error|Error" | head -20
```

Expected: ScenarioModellingTab error gone; AircraftDetailTab error may remain until Task 9.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/maintenance/ScenarioModellingTab.tsx
git commit -m "feat: ScenarioModellingTab accepts adjustedLeases prop, base case uses servicer report data"
```

---

### Task 9: Update AircraftDetailTab — adjusted projections + event log

**Files:**
- Modify: `src/app/components/maintenance/AircraftDetailTab.tsx`

**Context:** Currently builds projections from raw static data. After this task: (1) uses `adjustedLeases` for AircraftBalanceChart projections, (2) renders `MaintenanceEventLog` for the selected aircraft at the bottom.

- [ ] **Step 1: Update imports**

At the top of `src/app/components/maintenance/AircraftDetailTab.tsx`, add:

```typescript
import { useMaintenanceEvents } from "../../hooks/useMaintenanceEvents";
import { MaintenanceEventLog } from "./MaintenanceEventLog";
import type { AdjustedLease, MaintenanceEvent } from "../../utils/maintenanceEvents";
```

Remove:

```typescript
import { sdmrData } from "../portfolio/SDMRTab";
```

- [ ] **Step 2: Update the Props interface and component signature**

Replace:

```typescript
export function AircraftDetailTab() {
  const [selectedLeaseId, setSelectedLeaseId] = useState(
    () => AIRCRAFT_LIST[0]?.leaseId ?? "",
  );

  const selected      = AIRCRAFT_LIST.find(a => a.leaseId === selectedLeaseId) ?? AIRCRAFT_LIST[0];
  const selectedLease = sdmrData.find(l => l.leaseId === selectedLeaseId) ?? sdmrData[0];
```

with:

```typescript
export function AircraftDetailTab({
  adjustedLeases,
  eventsMap,
}: {
  adjustedLeases: AdjustedLease[];
  eventsMap:      Map<string, MaintenanceEvent[]>;
}) {
  // Build aircraft list from adjustedLeases (replaces static AIRCRAFT_LIST derived from sdmrData)
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

  const [selectedLeaseId, setSelectedLeaseId] = useState(
    () => aircraftList[0]?.leaseId ?? "",
  );

  const selected      = aircraftList.find(a => a.leaseId === selectedLeaseId) ?? aircraftList[0];
  const selectedLease = selected?.lease;
```

- [ ] **Step 3: Update the derived computations and AircraftBalanceChart call**

Replace the `derived` useMemo:

```typescript
  const derived = useMemo(() => {
    if (!selected || !selectedLease) return null;
    const end = parseDateLocal(selected.leaseEnd);
    return {
      projections:  buildProjections(selectedLease, selectedLease.aircraft, end),
      leaseEndDate: end,
      monthsToEOL:  Math.max(0, monthsBetween(NOW, end)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaseId]);
```

with:

```typescript
  const derived = useMemo(() => {
    if (!selected || !selectedLease) return null;
    const end = parseDateLocal(selected.leaseEnd);
    return {
      projections:  buildProjections(selectedLease, selectedLease.aircraft, end, selected.utilOverride),
      leaseEndDate: end,
      monthsToEOL:  Math.max(0, monthsBetween(NOW, end)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaseId]);
```

- [ ] **Step 4: Add the event log hook and render MaintenanceEventLog**

After `const { projections, leaseEndDate, monthsToEOL } = derived;`, add:

```typescript
  const { events, saving, logEvent, deleteEvent } = useMaintenanceEvents(selected?.leaseId ?? null);
```

At the bottom of the returned JSX (after the `<MaintenanceForecastTab ... />` element), add:

```tsx
      {/* ── Maintenance Event Log ──────────────────────────────────── */}
      <MaintenanceEventLog
        events={events}
        saving={saving}
        logEvent={logEvent}
        deleteEvent={deleteEvent}
        leaseId={selected.leaseId}
      />
```

Also remove the static `AIRCRAFT_LIST` constant at the top of the file — it's replaced by `aircraftList` computed inside the component from the `adjustedLeases` prop.

- [ ] **Step 5: Update the aircraft selector to use aircraftList instead of AIRCRAFT_LIST**

In the JSX, change every reference to `AIRCRAFT_LIST` to `aircraftList`.

- [ ] **Step 6: Verify full build is clean**

```bash
npx vite build 2>&1 | grep -E "error|Error" | head -20
```

Expected: clean build — no errors

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run --reporter=verbose src/app/utils/maintenanceEvents.test.ts
```

Expected: all 12 tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/components/maintenance/AircraftDetailTab.tsx
git commit -m "feat: AircraftDetailTab uses adjusted projections and adds MaintenanceEventLog"
```

---

### Task 10: Final integration check and push

**Files:** No changes — verification only.

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run 2>&1 | tail -8
```

Expected: all tests pass (486+ tests)

- [ ] **Step 2: Run production build**

```bash
npx vite build 2>&1 | tail -15
```

Expected: `✓ built in XX.XXs` — no errors

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 4: Verify the push succeeded**

```bash
git log --oneline -8
```

Expected: commits from Tasks 1–9 visible at the top
