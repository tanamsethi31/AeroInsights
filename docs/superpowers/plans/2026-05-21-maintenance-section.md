# Maintenance Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate SD/MR from a buried Portfolio tab into a first-class standalone Maintenance section with its own sidebar entry, URL namespace, and landing page showing MRPortfolioGrid + aggregate cashflow chart + event concentration calendar.

**Architecture:** New `Maintenance.tsx` page at `/maintenance*` with three PillTabs. New `src/app/components/maintenance/` folder owns all MR display components. `MRPortfolioGrid` moves from `portfolio/` here. Two new chart components (`MRCashflowChart`, `MREventCalendar`) consume a new pure adapter `toMRChartData()` in `mrChartAdapters.ts`. Portfolio SD/MR tab reverts to SD-only. Dashboard `MRHealthCard` navigates to `/maintenance`.

**Tech Stack:** React, TypeScript, inline styles, recharts (`ComposedChart`, `BarChart`, `ResponsiveContainer`), lucide-react, existing `buildProjections()` + `LEASE_CONTEXT` + `sdmrData`.

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/app/lib/mrChartAdapters.ts` |
| Create | `src/app/lib/mrChartAdapters.test.ts` |
| Move + modify | `src/app/components/portfolio/MRPortfolioGrid.tsx` → `src/app/components/maintenance/MRPortfolioGrid.tsx` |
| Create | `src/app/components/maintenance/MRCashflowChart.tsx` |
| Create | `src/app/components/maintenance/MREventCalendar.tsx` |
| Create | `src/app/pages/Maintenance.tsx` |
| Modify | `src/app/routes.tsx` |
| Modify | `src/app/components/layout/Sidebar.tsx` |
| Modify | `src/app/pages/Portfolio.tsx` |
| Modify | `src/app/pages/Dashboard.tsx` |

---

## Task 1: Data adapter — `mrChartAdapters.ts` (TDD)

**Files:**
- Create: `src/app/lib/mrChartAdapters.ts`
- Create: `src/app/lib/mrChartAdapters.test.ts`

### Step 1: Write failing tests

Create `src/app/lib/mrChartAdapters.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { toMRChartData } from "./mrChartAdapters";
import { sdmrData } from "../components/portfolio/SDMRTab";

describe("toMRChartData", () => {
  it("returns empty structure for empty input", () => {
    const result = toMRChartData([]);
    expect(result.cashflow).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.leaseIds).toEqual([]);
  });

  it("returns a cashflow entry for every quarter from Q2 2026 to max lease end", () => {
    const result = toMRChartData(sdmrData);
    expect(result.cashflow.length).toBeGreaterThan(0);
    expect(result.cashflow[0].quarter).toBe("Q2 2026");
    // furthest lease end in static data is 2032-04-15 → Q2 2032
    const last = result.cashflow[result.cashflow.length - 1];
    expect(last.quarter).toBe("Q2 2032");
  });

  it("all cashflow inflows are non-negative", () => {
    const result = toMRChartData(sdmrData);
    result.cashflow.forEach((q) => {
      expect(q.inflows).toBeGreaterThanOrEqual(0);
    });
  });

  it("all event costs are non-negative", () => {
    const result = toMRChartData(sdmrData);
    result.cashflow.forEach((q) => {
      expect(q.eventCosts).toBeGreaterThanOrEqual(0);
    });
  });

  it("events array has one entry per quarter matching cashflow", () => {
    const result = toMRChartData(sdmrData);
    expect(result.events.length).toBe(result.cashflow.length);
    result.events.forEach((e, i) => {
      expect(e.quarter).toBe(result.cashflow[i].quarter);
    });
  });

  it("leaseIds contains one entry per lease in sdmrData", () => {
    const result = toMRChartData(sdmrData);
    expect(result.leaseIds.length).toBe(sdmrData.length);
  });

  it("leaseColors maps every leaseId to a non-empty colour string", () => {
    const result = toMRChartData(sdmrData);
    result.leaseIds.forEach((id) => {
      expect(typeof result.leaseColors[id]).toBe("string");
      expect(result.leaseColors[id].length).toBeGreaterThan(0);
    });
  });

  it("cumulative net is monotonically consistent (each step = prev + inflows - eventCosts)", () => {
    const result = toMRChartData(sdmrData);
    let running = 0;
    result.cashflow.forEach((q) => {
      running += q.inflows - q.eventCosts;
      expect(Math.round(q.netCumulative)).toBe(Math.round(running));
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/lib/mrChartAdapters.test.ts --reporter=verbose
```

Expected: FAIL — `Cannot find module './mrChartAdapters'`

- [ ] **Step 3: Implement `mrChartAdapters.ts`**

Create `src/app/lib/mrChartAdapters.ts`:

```typescript
import { buildProjections, LEASE_CONTEXT } from "../components/portfolio/MaintenanceForecastTab";
import { type LeaseSDMR } from "../components/portfolio/SDMRTab";
import { mrFlagColor } from "../data/maintenanceHeuristics";

export interface MRCashflowQuarter {
  quarter: string;       // "Q2 2026"
  inflows: number;       // total MR accruals collected this quarter ($)
  eventCosts: number;    // total projected maintenance event costs due this quarter ($)
  netCumulative: number; // running cumulative (inflows − eventCosts) from Q2 2026 ($)
}

export interface MREventQuarter {
  quarter: string;
  // One key per leaseId present in that quarter's events
  [leaseId: string]: number | string; // number = event cost for that lease; string = quarter label
  total: number;         // sum of all event costs this quarter
}

export interface MRChartData {
  cashflow: MRCashflowQuarter[];
  events: MREventQuarter[];
  leaseIds: string[];    // ordered list of leaseIds that appear in events (for chart keys)
  leaseColors: Record<string, string>; // leaseId → flag colour
}

const NOW = new Date(2026, 4, 1); // May 2026 — app reference date

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function quarterLabel(date: Date): string {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `Q${q} ${date.getFullYear()}`;
}

function quartersFrom(start: Date, end: Date): string[] {
  const quarters: string[] = [];
  const cur = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
  while (cur <= end) {
    quarters.push(quarterLabel(cur));
    cur.setMonth(cur.getMonth() + 3);
  }
  return quarters;
}

const CONTEXT_BY_LEASE_ID: Record<string, { msn: string; leaseEnd: string }> =
  Object.fromEntries(
    Object.entries(LEASE_CONTEXT).map(([msn, ctx]) => [
      ctx.leaseId,
      { msn, leaseEnd: ctx.leaseEnd },
    ])
  );

export function toMRChartData(sdmrData: LeaseSDMR[]): MRChartData {
  if (sdmrData.length === 0) {
    return { cashflow: [], events: [], leaseIds: [], leaseColors: {} };
  }

  // Find furthest lease end date across all leases
  const leaseEnds = sdmrData.map((lease) => {
    const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
    return lease.leaseEnd
      ? parseDateLocal(lease.leaseEnd)
      : ctx
      ? parseDateLocal(ctx.leaseEnd)
      : new Date(2028, 0, 1);
  });
  const maxEnd = leaseEnds.reduce((a, b) => (b > a ? b : a), NOW);

  const allQuarters = quartersFrom(NOW, maxEnd);

  type LeaseRow = {
    leaseId: string;
    projections: ReturnType<typeof buildProjections>;
    leaseEndDate: Date;
    overallFlag: "red" | "amber" | "green";
  };

  const leaseRows: LeaseRow[] = sdmrData.map((lease, i) => {
    const leaseEndDate = leaseEnds[i];
    const projections = buildProjections(lease, lease.aircraft, leaseEndDate);
    const overallFlag: "red" | "amber" | "green" = projections.some(
      (p) => p.eolShortfall > 0
    )
      ? "red"
      : projections.some((p) => p.distressedEOLShortfall > 0)
      ? "amber"
      : "green";
    return { leaseId: lease.leaseId, projections, leaseEndDate, overallFlag };
  });

  const leaseColors: Record<string, string> = Object.fromEntries(
    leaseRows.map((r) => [r.leaseId, mrFlagColor(r.overallFlag)])
  );
  const leaseIds = leaseRows.map((r) => r.leaseId);

  // Build quarterly maps
  const inflowMap: Record<string, number> = {};
  const eventMap: Record<string, Record<string, number>> = {}; // quarter → leaseId → cost
  allQuarters.forEach((q) => {
    inflowMap[q] = 0;
    eventMap[q] = {};
  });

  leaseRows.forEach(({ leaseId, projections, leaseEndDate }) => {
    const leaseEndQ = quarterLabel(leaseEndDate);
    projections.forEach((p) => {
      // Inflows: monthly accrual × 3 months per quarter, for every quarter until EOL
      allQuarters.forEach((q) => {
        if (q <= leaseEndQ) {
          inflowMap[q] = (inflowMap[q] ?? 0) + p.monthlyAccrual * 3;
        }
      });

      // Event costs: one event per component at nextEventDate
      if (p.nextEventDate >= NOW) {
        const eventQ = quarterLabel(p.nextEventDate);
        if (eventMap[eventQ]) {
          eventMap[eventQ][leaseId] =
            (eventMap[eventQ][leaseId] ?? 0) + p.heuristicEventCost;
        }
      }
    });
  });

  // Build cashflow array with cumulative net
  let cumulative = 0;
  const cashflow: MRCashflowQuarter[] = allQuarters.map((quarter) => {
    const inflows = inflowMap[quarter] ?? 0;
    const eventCosts = Object.values(eventMap[quarter] ?? {}).reduce(
      (s, v) => s + v,
      0
    );
    cumulative += inflows - eventCosts;
    return { quarter, inflows, eventCosts, netCumulative: cumulative };
  });

  // Build events array
  const events: MREventQuarter[] = allQuarters.map((quarter) => {
    const row: MREventQuarter = { quarter, total: 0 };
    leaseIds.forEach((id) => {
      const cost = eventMap[quarter]?.[id] ?? 0;
      row[id] = cost;
      row.total += cost;
    });
    return row;
  });

  return { cashflow, events, leaseIds, leaseColors };
}
```

- [ ] **Step 4: Run tests to confirm all 8 pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/lib/mrChartAdapters.test.ts --reporter=verbose
```

Expected: 8 tests PASS. If "Q2 2032" assertion fails, check the furthest `leaseEnd` in `sdmrData` static data — the test label must match the actual furthest date. Adjust test to `expect(last.quarter).toBe("Q2 2032")` only if that date is confirmed; otherwise update to match actual.

- [ ] **Step 5: Run full suite to confirm no regressions**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose
```

Expected: all previously passing tests still pass (469 before this sprint + 8 new = 477).

- [ ] **Step 6: Commit**

```bash
git add src/app/lib/mrChartAdapters.ts src/app/lib/mrChartAdapters.test.ts
git commit -m "feat: add toMRChartData adapter with quarterly cashflow and event aggregation"
```

---

## Task 2: Move `MRPortfolioGrid` to `maintenance/` folder

**Files:**
- Create dir: `src/app/components/maintenance/`
- Move + modify: `src/app/components/portfolio/MRPortfolioGrid.tsx` → `src/app/components/maintenance/MRPortfolioGrid.tsx`

- [ ] **Step 1: Create the `maintenance/` folder and move the file**

```bash
mkdir -p /Users/tanamsethi/Downloads/Aeroinsights/src/app/components/maintenance
cp /Users/tanamsethi/Downloads/Aeroinsights/src/app/components/portfolio/MRPortfolioGrid.tsx \
   /Users/tanamsethi/Downloads/Aeroinsights/src/app/components/maintenance/MRPortfolioGrid.tsx
```

- [ ] **Step 2: Update the three import paths inside the moved file**

Open `src/app/components/maintenance/MRPortfolioGrid.tsx` and change:

```typescript
// BEFORE (relative to portfolio/)
import { buildProjections, LEASE_CONTEXT, type ComponentProjection } from "./MaintenanceForecastTab";
import { type LeaseSDMR } from "./SDMRTab";
import { Card } from "../ui/Card";
```

to:

```typescript
// AFTER (relative to maintenance/)
import { buildProjections, LEASE_CONTEXT, type ComponentProjection } from "../portfolio/MaintenanceForecastTab";
import { type LeaseSDMR } from "../portfolio/SDMRTab";
import { Card } from "../ui/Card";
```

The `Card` import path `"../ui/Card"` is unchanged — both `portfolio/` and `maintenance/` are one level deep under `components/`.

- [ ] **Step 3: Delete the old file**

```bash
rm /Users/tanamsethi/Downloads/Aeroinsights/src/app/components/portfolio/MRPortfolioGrid.tsx
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors about `MRPortfolioGrid` imports. If `Portfolio.tsx` still imports from the old path it will fail — that's expected and will be fixed in Task 7.

- [ ] **Step 5: Run tests to confirm no regressions**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose
```

Expected: all tests still pass (the adapter tests from Task 1 don't import `MRPortfolioGrid`).

- [ ] **Step 6: Commit**

```bash
git add src/app/components/maintenance/MRPortfolioGrid.tsx
git rm src/app/components/portfolio/MRPortfolioGrid.tsx
git commit -m "refactor: move MRPortfolioGrid to maintenance/ components folder"
```

---

## Task 3: Create `MRCashflowChart` component

**Files:**
- Create: `src/app/components/maintenance/MRCashflowChart.tsx`

No test file — presentational component. TypeScript build is the verification gate.

- [ ] **Step 1: Create `MRCashflowChart.tsx`**

Create `src/app/components/maintenance/MRCashflowChart.tsx`:

```tsx
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { type MRCashflowQuarter } from "../../lib/mrChartAdapters";

interface Props {
  data: MRCashflowQuarter[];
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const inflows = payload.find((p) => p.dataKey === "inflows")?.value ?? 0;
  const eventCosts = payload.find((p) => p.dataKey === "eventCosts")?.value ?? 0;
  const net = payload.find((p) => p.dataKey === "netCumulative")?.value ?? 0;

  function fmt(v: number) {
    return `$${(v / 1_000_000).toFixed(1)}m`;
  }

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: "0.75rem",
      padding: "0.625rem 0.875rem",
      fontSize: "0.8125rem",
      lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ color: "#475569" }}>
        <div>Inflows: <span style={{ color: "#002147", fontWeight: 600 }}>{fmt(inflows as number)}</span></div>
        <div>Event Costs: <span style={{ color: "#B91C1C", fontWeight: 600 }}>{fmt(eventCosts as number)}</span></div>
        <div>Cumulative Net: <span style={{ color: (net as number) >= 0 ? "#15803D" : "#B91C1C", fontWeight: 600 }}>{fmt(net as number)}</span></div>
      </div>
    </div>
  );
}

export function MRCashflowChart({ data }: Props) {
  if (data.length === 0) return null;

  // Determine final cumulative net to pick line colour
  const finalNet = data[data.length - 1]?.netCumulative ?? 0;
  const lineColor = finalNet >= 0 ? "#15803D" : "#B91C1C";

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: "0.75rem",
      padding: "1rem",
    }}>
      <div style={{
        fontSize: "0.6875rem",
        fontWeight: 600,
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: "0.75rem",
      }}>
        Aggregate MR Cashflow
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="quarter"
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}m`}
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="net"
            orientation="right"
            tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}m`}
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="square" wrapperStyle={{ fontSize: "0.75rem" }} />
          <Bar
            yAxisId="left"
            dataKey="inflows"
            name="MR Inflows"
            fill="#002147"
            fillOpacity={0.85}
            barSize={10}
          />
          <Bar
            yAxisId="left"
            dataKey="eventCosts"
            name="Event Costs"
            fill="#B91C1C"
            fillOpacity={0.8}
            barSize={10}
          />
          <Line
            yAxisId="net"
            dataKey="netCumulative"
            name="Cumulative Net"
            stroke={lineColor}
            dot={false}
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep MRCashflowChart
```

Expected: no output (no errors for this file).

- [ ] **Step 3: Commit**

```bash
git add src/app/components/maintenance/MRCashflowChart.tsx
git commit -m "feat: add MRCashflowChart recharts ComposedChart component"
```

---

## Task 4: Create `MREventCalendar` component

**Files:**
- Create: `src/app/components/maintenance/MREventCalendar.tsx`

- [ ] **Step 1: Create `MREventCalendar.tsx`**

Create `src/app/components/maintenance/MREventCalendar.tsx`:

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { type MREventQuarter } from "../../lib/mrChartAdapters";

interface Props {
  data: MREventQuarter[];
  leaseIds: string[];
  leaseColors: Record<string, string>;
  leaseLessees: Record<string, string>; // leaseId → lessee name for tooltip
}

interface EventTooltipProps extends TooltipProps<number, string> {
  leaseIds: string[];
  leaseColors: Record<string, string>;
  leaseLessees: Record<string, string>;
}

function CustomTooltip({
  active,
  payload,
  label,
  leaseIds,
  leaseColors,
  leaseLessees,
}: EventTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const quarter = label as string;
  const entries = leaseIds
    .map((id) => {
      const cost = payload.find((p) => p.dataKey === id)?.value ?? 0;
      return { id, cost: cost as number };
    })
    .filter((e) => e.cost > 0);

  if (entries.length === 0) return null;

  const total = entries.reduce((s, e) => s + e.cost, 0);

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: "0.75rem",
      padding: "0.625rem 0.875rem",
      fontSize: "0.8125rem",
      lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: "0.25rem" }}>{quarter}</div>
      {entries.map(({ id, cost }) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: leaseColors[id], flexShrink: 0 }} />
          <span style={{ color: "#475569" }}>
            {leaseLessees[id] ?? id}:{" "}
            <span style={{ fontWeight: 600, color: "#0F172A" }}>
              ${(cost / 1_000_000).toFixed(1)}m
            </span>
          </span>
        </div>
      ))}
      <div style={{ borderTop: "1px solid #F1F5F9", marginTop: "0.375rem", paddingTop: "0.375rem", fontWeight: 600, color: "#0F172A" }}>
        Total: ${(total / 1_000_000).toFixed(1)}m
      </div>
    </div>
  );
}

export function MREventCalendar({ data, leaseIds, leaseColors, leaseLessees }: Props) {
  if (data.length === 0) return null;

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: "0.75rem",
      padding: "1rem",
    }}>
      <div style={{
        fontSize: "0.6875rem",
        fontWeight: 600,
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: "0.75rem",
      }}>
        Event Cost Concentration by Quarter
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="quarter"
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}m`}
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={
              <CustomTooltip
                leaseIds={leaseIds}
                leaseColors={leaseColors}
                leaseLessees={leaseLessees}
              />
            }
          />
          {leaseIds.map((id) => (
            <Bar
              key={id}
              dataKey={id}
              stackId="events"
              fill={leaseColors[id]}
              name={leaseLessees[id] ?? id}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep MREventCalendar
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/maintenance/MREventCalendar.tsx
git commit -m "feat: add MREventCalendar stacked bar chart component"
```

---

## Task 5: Create `Maintenance.tsx` page shell

**Files:**
- Create: `src/app/pages/Maintenance.tsx`

- [ ] **Step 1: Create `Maintenance.tsx`**

Create `src/app/pages/Maintenance.tsx`:

```tsx
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { PlaneTakeoff, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PillTabs } from "../components/ui/PillTabs";
import { sdmrData } from "../components/portfolio/SDMRTab";
import { toMRChartData } from "../lib/mrChartAdapters";
import { MRPortfolioGrid } from "../components/maintenance/MRPortfolioGrid";
import { MRCashflowChart } from "../components/maintenance/MRCashflowChart";
import { MREventCalendar } from "../components/maintenance/MREventCalendar";

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

  const chartData = useMemo(() => toMRChartData(sdmrData), []);
  const leaseLessees = useMemo(
    () => Object.fromEntries(sdmrData.map((l) => [l.leaseId, l.lessee])),
    []
  );

  return (
    <>
      <PageHeader title="Maintenance Reserves" />

      <div style={{ padding: "1.5rem 2rem" }}>
        <PillTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === "Overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1.5rem" }}>
            <MRPortfolioGrid sdmrData={sdmrData} />
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
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "4rem 2rem",
            gap: "0.75rem",
            color: "#94A3B8",
            textAlign: "center",
            marginTop: "1.5rem",
          }}>
            <PlaneTakeoff size={32} style={{ color: "#CBD5E1" }} />
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#475569" }}>Aircraft Detail</div>
            <div style={{ fontSize: "0.875rem", maxWidth: "28rem", color: "#94A3B8" }}>
              Per-aircraft MR balance curves — component trajectories from today to lease end,
              with base and distressed scenario overlays. Coming in the next sprint.
            </div>
          </div>
        )}

        {activeTab === "Scenario Modelling" && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "4rem 2rem",
            gap: "0.75rem",
            color: "#94A3B8",
            textAlign: "center",
            marginTop: "1.5rem",
          }}>
            <SlidersHorizontal size={32} style={{ color: "#CBD5E1" }} />
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#475569" }}>Scenario Modelling</div>
            <div style={{ fontSize: "0.875rem", maxWidth: "28rem", color: "#94A3B8" }}>
              Adjust utilisation rates, MR rate assumptions, and lease end dates —
              see the impact on EOL shortfall across the portfolio in real time. Coming in a future sprint.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles (excluding Portfolio.tsx which still has the old import)**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep Maintenance
```

Expected: no errors related to `Maintenance.tsx` itself. Portfolio.tsx errors about `MRPortfolioGrid` are acceptable at this point — they get fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/Maintenance.tsx
git commit -m "feat: add Maintenance page shell with Overview, Aircraft Detail, and Scenario Modelling tabs"
```

---

## Task 6: Routes + Sidebar wiring

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/app/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add `Maintenance` import and routes to `routes.tsx`**

In `src/app/routes.tsx`, add to the import block (after the `Reconciliation` import):

```typescript
import Maintenance from "./pages/Maintenance";
```

Then add the maintenance routes to the Layout children block, after the `risk-ecl` routes and before the `counterparties` routes:

```typescript
// Maintenance
{ path: "maintenance",           Component: Maintenance },
{ path: "maintenance/aircraft",  Component: Maintenance },
{ path: "maintenance/scenarios", Component: Maintenance },
```

The full block in context should look like:

```typescript
          // Risk & ECL
          { path: "risk-ecl",                   Component: RiskECL },
          { path: "risk-ecl/summary",           Component: RiskECL },
          { path: "risk-ecl/migration",         Component: RiskECL },
          { path: "risk-ecl/waterfall",         Component: RiskECL },

          // Maintenance
          { path: "maintenance",           Component: Maintenance },
          { path: "maintenance/aircraft",  Component: Maintenance },
          { path: "maintenance/scenarios", Component: Maintenance },

          // Intelligence
          { path: "counterparties",             Component: Counterparties },
```

- [ ] **Step 2: Add `Wrench` to Sidebar icon imports and add the nav entry**

In `src/app/components/layout/Sidebar.tsx`:

**2a.** Add `Wrench` to the lucide-react import block (after `FolderOpen`):

```typescript
  FolderOpen,
  Wrench,
} from "lucide-react";
```

**2b.** Add the Maintenance nav entry to the Analysis group, between the `Risk & ECL` item and the closing `]` of the Analysis items array. The Analysis section currently ends at the `Risk & ECL` block (lines ~127–135). Insert after the Risk & ECL closing brace:

```typescript
      {
        title: "Maintenance",
        url: "/maintenance",
        icon: Wrench,
        items: [
          { title: "Overview",           url: "/maintenance",           icon: BarChart2         },
          { title: "Aircraft Detail",    url: "/maintenance/aircraft",  icon: PlaneTakeoff      },
          { title: "Scenario Modelling", url: "/maintenance/scenarios", icon: SlidersHorizontal },
        ],
      },
```

This goes after the `Risk & ECL` block and before the closing `],` of the Analysis `items` array (i.e., before line 137's `},`).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep -E "routes|Sidebar|Maintenance" | head -20
```

Expected: no errors from routes.tsx or Sidebar.tsx. The only remaining errors should be from Portfolio.tsx (stale MRPortfolioGrid import) — fixed in Task 7.

- [ ] **Step 4: Run tests**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/routes.tsx src/app/components/layout/Sidebar.tsx
git commit -m "feat: add maintenance routes and sidebar nav entry under Analysis group"
```

---

## Task 7: Portfolio.tsx cleanup + Dashboard.tsx nav update

**Files:**
- Modify: `src/app/pages/Portfolio.tsx`
- Modify: `src/app/pages/Dashboard.tsx`

This task also closes the TypeScript errors left by Task 2 (Portfolio.tsx still imports the deleted `MRPortfolioGrid`).

- [ ] **Step 1: Remove `MRPortfolioGrid` from `Portfolio.tsx`**

In `src/app/pages/Portfolio.tsx`:

**1a.** Remove the import line (currently line 41):

```typescript
import { MRPortfolioGrid } from "../components/portfolio/MRPortfolioGrid";
```

Delete this line entirely.

**1b.** Revert the SD/MR tab block. Find this block (currently around line 759–762):

```tsx
{activeTab === "SD / MR" && (
  <>
    <MRPortfolioGrid sdmrData={liveSDMRData ?? []} />
    <SDMRTab data={liveSDMRData} />
  </>
)}
```

Replace with:

```tsx
{activeTab === "SD / MR" && <SDMRTab data={liveSDMRData} />}
```

- [ ] **Step 2: Update `Dashboard.tsx` MRHealthCard nav target**

In `src/app/pages/Dashboard.tsx`, find the `MRHealthCard` onClick (currently around line 474):

```typescript
onClick={() => navigate("/portfolio", { state: { tab: "SD / MR" } })}
```

Replace with:

```typescript
onClick={() => navigate("/maintenance")}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: **no errors** — this is the first point in the plan where the TypeScript build should be fully clean.

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose
```

Expected: all tests pass (477 tests: 469 original + 8 new adapter tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/Portfolio.tsx src/app/pages/Dashboard.tsx
git commit -m "refactor: revert Portfolio SD/MR tab to SD-only and redirect Dashboard MR card to /maintenance"
```

---

## Self-Review Checklist

Spec coverage:
- [x] Section 1 (routes) → Task 6 Step 1
- [x] Section 2 (sidebar) → Task 6 Step 2
- [x] Section 3 (mrChartAdapters) → Task 1
- [x] Section 4 (MRCashflowChart) → Task 3
- [x] Section 5 (MREventCalendar) → Task 4
- [x] Section 6 (Maintenance.tsx page) → Task 5
- [x] Section 7 (MRPortfolioGrid move) → Task 2
- [x] Section 8 (Portfolio.tsx cleanup) → Task 7 Step 1
- [x] Section 9 (Dashboard.tsx nav) → Task 7 Step 2

Edge cases covered:
- Empty `sdmrData` → `toMRChartData` returns empty, charts return `null`, `MRPortfolioGrid` returns `null` — page shows section labels with empty areas, no crash
- `nextEventDate` before NOW → excluded by `p.nextEventDate >= NOW` guard in `toMRChartData`
- `netCumulative` final value determines line colour — simpler than per-segment colouring

Type consistency:
- `MRCashflowQuarter` and `MREventQuarter` defined and exported in `mrChartAdapters.ts`, imported in chart components
- `MRChartData` exported and consumed in `Maintenance.tsx` via destructuring
- `LeaseSDMR` type flows from `SDMRTab.tsx` through all consumers

No placeholders:
- All steps include complete code
- All commands include expected output
