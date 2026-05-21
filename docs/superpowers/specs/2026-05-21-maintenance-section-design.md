# Maintenance Section — Implementation Design

**Goal:** Elevate SD/MR from a buried Portfolio tab into a first-class standalone Maintenance section — its own sidebar entry, URL namespace, and landing page with portfolio-level MR charts. Serves portfolio managers, credit analysts, and execs from a single balanced view.

**Architecture:** New `Maintenance.tsx` page with three PillTabs (Overview, Aircraft Detail stub, Scenario Modelling stub). New `src/app/components/maintenance/` folder owns all MR display components. `MRPortfolioGrid` moves here from Portfolio. Two new chart components (`MRCashflowChart`, `MREventCalendar`) consume a new pure adapter `toMRChartData()` in `mrChartAdapters.ts`. Portfolio → SD/MR tab reverts to SD-only. Dashboard `MRHealthCard` navigates to `/maintenance`.

**Tech Stack:** React, TypeScript, inline styles, recharts (`ComposedChart`, `BarChart`, `ResponsiveContainer`), lucide-react, existing `buildProjections()` + `LEASE_CONTEXT` from `MaintenanceForecastTab.tsx`, existing `sdmrData` from `SDMRTab.tsx`.

---

## Files

| Action | Path |
|--------|------|
| Modify | `src/app/routes.tsx` |
| Modify | `src/app/components/layout/Sidebar.tsx` |
| Create | `src/app/pages/Maintenance.tsx` |
| Create | `src/app/lib/mrChartAdapters.ts` |
| Create | `src/app/lib/mrChartAdapters.test.ts` |
| Create | `src/app/components/maintenance/MRCashflowChart.tsx` |
| Create | `src/app/components/maintenance/MREventCalendar.tsx` |
| Move   | `src/app/components/portfolio/MRPortfolioGrid.tsx` → `src/app/components/maintenance/MRPortfolioGrid.tsx` |
| Modify | `src/app/pages/Portfolio.tsx` |
| Modify | `src/app/pages/Dashboard.tsx` |

New folder: `src/app/components/maintenance/` — owns all MR display components going forward.

---

## Section 1 — Routing (`routes.tsx`)

Add three routes to the Layout children, grouped after the existing portfolio routes:

```typescript
// Maintenance
{ path: "maintenance",           Component: Maintenance },
{ path: "maintenance/aircraft",  Component: Maintenance },
{ path: "maintenance/scenarios", Component: Maintenance },
```

Import `Maintenance` from `"./pages/Maintenance"`.

---

## Section 2 — Sidebar (`Sidebar.tsx`)

Add `Wrench` to the lucide-react imports.

Add a new nav entry to the `Analysis` group, inserted **after** the existing `Risk & ECL` entry and **before** `Transactions`:

```typescript
{
  title: "Maintenance",
  url: "/maintenance",
  icon: Wrench,
  items: [
    { title: "Overview",            url: "/maintenance",           icon: BarChart2    },
    { title: "Aircraft Detail",     url: "/maintenance/aircraft",  icon: PlaneTakeoff },
    { title: "Scenario Modelling",  url: "/maintenance/scenarios", icon: SlidersHorizontal },
  ],
},
```

`BarChart2`, `PlaneTakeoff`, and `SlidersHorizontal` are already imported.

---

## Section 3 — Data adapter (`mrChartAdapters.ts`)

**File:** `src/app/lib/mrChartAdapters.ts`

### Types

```typescript
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
```

### `toMRChartData()` function

```typescript
import { buildProjections, LEASE_CONTEXT } from "../components/portfolio/MaintenanceForecastTab";
import { type LeaseSDMR } from "../components/portfolio/SDMRTab";
import { mrFlagColor } from "../data/maintenanceHeuristics";

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

  // Per-lease projections
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
    projections.forEach((p) => {
      // Inflows: monthly accrual × 3 months per quarter, for every quarter until EOL
      const leaseEndQ = quarterLabel(leaseEndDate);
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

  // Filter to only quarters with at least some activity (inflow or event)
  // to keep x-axis readable — keep all quarters so the timeline is continuous.
  // (No filtering — full lifetime shown.)

  return { cashflow, events, leaseIds, leaseColors };
}
```

### Tests (`mrChartAdapters.test.ts`)

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

---

## Section 4 — `MRCashflowChart` component

**File:** `src/app/components/maintenance/MRCashflowChart.tsx`

**Props:**
```typescript
interface Props {
  data: MRCashflowQuarter[];
}
```

**Chart:** `ComposedChart` from recharts. `ResponsiveContainer` width `100%`, height `280`.

**Series:**
- `Bar` — `dataKey="inflows"` — fill `#002147` (navy), opacity 0.85, `name="MR Inflows"`, bar size 10
- `Bar` — `dataKey="eventCosts"` — fill `#B91C1C` (red), opacity 0.8, `name="Event Costs"`, bar size 10
- `Line` — `dataKey="netCumulative"` — stroke `#15803D` when latest value ≥ 0, `#B91C1C` when < 0; `dot={false}`, `strokeWidth={2}`, right Y-axis (`yAxisId="net"`)

**Axes:**
- `XAxis` — `dataKey="quarter"`, `tick={{ fontSize: 10, fill: "#475569" }}`, `axisLine={false}`, `tickLine={false}`. Show every 4th tick to avoid crowding: `interval={3}`.
- `YAxis` — `yAxisId="left"`, `orientation="left"`, `tickFormatter={(v) => \`$${(v / 1_000_000).toFixed(0)}m\`}`, `tick={{ fontSize: 10, fill: "#475569" }}`, `axisLine={false}`, `tickLine={false}`
- `YAxis` — `yAxisId="net"`, `orientation="right"`, same formatter

Both `Bar` components use `yAxisId="left"`. The `Line` uses `yAxisId="net"`.

**Tooltip:** Custom content showing quarter label, inflows ($Xm), event costs ($Xm), net cumulative ($Xm) in the standard project card style (white bg, `border: "1px solid #E2E8F0"`, `borderRadius: "0.75rem"`, `padding: "0.625rem 0.875rem"`, `fontSize: "0.8125rem"`).

**Legend:** Inline `<Legend>` with `iconType="square"`, `wrapperStyle={{ fontSize: "0.75rem" }}`.

**Card wrapper:** Same pattern as charts in `LesseeProfilePanel.tsx` — `background: "#FFFFFF"`, `border: "1px solid #E2E8F0"`, `borderRadius: "0.75rem"`, `padding: "1rem"`. Section label: "AGGREGATE MR CASHFLOW" in `fontSize: "0.6875rem"`, `fontWeight: 600`, `color: "#64748B"`, uppercase, `letterSpacing: "0.05em"`, `marginBottom: "0.75rem"`.

---

## Section 5 — `MREventCalendar` component

**File:** `src/app/components/maintenance/MREventCalendar.tsx`

**Props:**
```typescript
interface Props {
  data: MREventQuarter[];
  leaseIds: string[];
  leaseColors: Record<string, string>;
  leaseLessees: Record<string, string>; // leaseId → lessee name for tooltip
}
```

`leaseLessees` is built in `Maintenance.tsx` from `sdmrData`: `Object.fromEntries(sdmrData.map(l => [l.leaseId, l.lessee]))`.

**Chart:** `BarChart` from recharts. `ResponsiveContainer` width `100%`, height `220`. `layout="vertical"` is NOT used — standard vertical bars (time on x-axis, cost on y-axis). `stackOffset="none"`.

**Series:** One `Bar` per `leaseId` in `leaseIds`, each with:
- `dataKey={leaseId}`
- `stackId="events"` (stacked bars)
- `fill={leaseColors[leaseId]}`
- `name={leaseLessees[leaseId]}`

**Axes:**
- `XAxis` — `dataKey="quarter"`, same style as cashflow chart, `interval={3}`
- `YAxis` — `tickFormatter={(v) => \`$${(v / 1_000_000).toFixed(0)}m\`}`, same style

**Tooltip:** Custom content showing: quarter, then for each lease that has `cost > 0` in that quarter: lessee name + `$Xm`. Total at bottom.

**Zero-quarter handling:** Quarters where `total === 0` still appear in the chart (continuous x-axis) with zero-height bars — this is correct recharts behaviour by default.

**Card wrapper:** Same card style. Section label: "EVENT COST CONCENTRATION BY QUARTER".

---

## Section 6 — `Maintenance.tsx` page

**File:** `src/app/pages/Maintenance.tsx`

**Tab routing:** Reads `pathname` to derive active tab (same pattern as `RiskECL.tsx`):
```typescript
const PATH_TAB: Record<string, string> = {
  "/maintenance":           "Overview",
  "/maintenance/aircraft":  "Aircraft Detail",
  "/maintenance/scenarios": "Scenario Modelling",
};
const [activeTab, setActiveTab] = useState(() => PATH_TAB[pathname] ?? "Overview");
useEffect(() => { setActiveTab(PATH_TAB[pathname] ?? "Overview"); }, [pathname]);
```

**Data:** Imports `sdmrData` from `SDMRTab.tsx` (static demo dataset). `toMRChartData` called once in `useMemo`:
```typescript
const chartData = useMemo(() => toMRChartData(sdmrData), []);
const leaseLessees = useMemo(
  () => Object.fromEntries(sdmrData.map((l) => [l.leaseId, l.lessee])),
  []
);
```

**Layout:** `PageHeader` with title "Maintenance Reserves". `PillTabs` with three tabs. Tab content:

### Overview tab

```tsx
<div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
  <MRPortfolioGrid sdmrData={sdmrData} />
  <MRCashflowChart data={chartData.cashflow} />
  <MREventCalendar
    data={chartData.events}
    leaseIds={chartData.leaseIds}
    leaseColors={chartData.leaseColors}
    leaseLessees={leaseLessees}
  />
</div>
```

### Aircraft Detail tab (stub)

```tsx
<div style={{
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", padding: "4rem 2rem", gap: "0.75rem",
  color: "#94A3B8", textAlign: "center",
}}>
  <PlaneTakeoff size={32} style={{ color: "#CBD5E1" }} />
  <div style={{ fontSize: "1rem", fontWeight: 600, color: "#475569" }}>Aircraft Detail</div>
  <div style={{ fontSize: "0.875rem", maxWidth: "28rem" }}>
    Per-aircraft MR balance curves — component trajectories from today to lease end,
    with base and distressed scenario overlays. Coming in the next sprint.
  </div>
</div>
```

### Scenario Modelling tab (stub)

```tsx
<div style={{
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", padding: "4rem 2rem", gap: "0.75rem",
  color: "#94A3B8", textAlign: "center",
}}>
  <SlidersHorizontal size={32} style={{ color: "#CBD5E1" }} />
  <div style={{ fontSize: "1rem", fontWeight: 600, color: "#475569" }}>Scenario Modelling</div>
  <div style={{ fontSize: "0.875rem", maxWidth: "28rem" }}>
    Adjust utilisation rates, MR rate assumptions, and lease end dates —
    see the impact on EOL shortfall across the portfolio in real time. Coming in a future sprint.
  </div>
</div>
```

**Imports needed:** `PlaneTakeoff`, `SlidersHorizontal` from lucide-react; `PageHeader` from `../components/ui/PageHeader`; `PillTabs` from `../components/ui/PillTabs`; `sdmrData` from `../components/portfolio/SDMRTab`; `toMRChartData` from `../lib/mrChartAdapters`; `MRPortfolioGrid`, `MRCashflowChart`, `MREventCalendar` from `../components/maintenance/`.

---

## Section 7 — `MRPortfolioGrid` move

Move `src/app/components/portfolio/MRPortfolioGrid.tsx` → `src/app/components/maintenance/MRPortfolioGrid.tsx`.

Update the import inside the file from:
```typescript
import { buildProjections, LEASE_CONTEXT, type ComponentProjection } from "./MaintenanceForecastTab";
import { type LeaseSDMR } from "./SDMRTab";
import { Card } from "../ui/Card";
```
to:
```typescript
import { buildProjections, LEASE_CONTEXT, type ComponentProjection } from "../portfolio/MaintenanceForecastTab";
import { type LeaseSDMR } from "../portfolio/SDMRTab";
import { Card } from "../ui/Card";
```

---

## Section 8 — `Portfolio.tsx` cleanup

Remove `MRPortfolioGrid` import and revert the SD/MR tab block from:
```tsx
{activeTab === "SD / MR" && (
  <>
    <MRPortfolioGrid sdmrData={liveSDMRData ?? []} />
    <SDMRTab data={liveSDMRData} />
  </>
)}
```
to:
```tsx
{activeTab === "SD / MR" && <SDMRTab data={liveSDMRData} />}
```

---

## Section 9 — `Dashboard.tsx` nav update

Change `MRHealthCard` onClick from:
```typescript
onClick={() => navigate("/portfolio", { state: { tab: "SD / MR" } })}
```
to:
```typescript
onClick={() => navigate("/maintenance")}
```

---

## Visual Style Summary

- Card wrappers: `background: "#FFFFFF"`, `border: "1px solid #E2E8F0"`, `borderRadius: "0.75rem"`, `padding: "1rem"` — matches `LesseeProfilePanel` chart cards
- Section labels: `fontSize: "0.6875rem"`, `fontWeight: 600`, `color: "#64748B"`, uppercase, `letterSpacing: "0.05em"`
- Navy: `#002147`, red: `#B91C1C`, amber: `#B45309`, green: `#15803D`
- Tooltip: white bg, `border: "1px solid #E2E8F0"`, `borderRadius: "0.75rem"`, `padding: "0.625rem 0.875rem"`, `fontSize: "0.8125rem"`

---

## Edge Cases

- `sdmrData` empty → `toMRChartData` returns empty arrays → charts render nothing; `MRPortfolioGrid` returns `null` — page shows the section labels with empty chart areas, no crash
- Lease with no `leaseEnd` and no `CONTEXT_BY_LEASE_ID` entry → `new Date(2028, 0, 1)` fallback (consistent with MRPortfolioGrid behaviour)
- `nextEventDate` before `NOW` → excluded from event calendar (the `if (p.nextEventDate >= NOW)` guard)
- Quarter with no events → `total: 0`, all per-lease values `0` — recharts renders a zero-height bar (continuous axis, no gap)
- `netCumulative` goes negative in some quarter → line colour note in spec (`#B91C1C`); implementation renders the line in a single colour since recharts `Line` does not support per-segment colouring without custom rendering — use `#B91C1C` as a fixed stroke if the final `netCumulative` is negative, `#15803D` if positive. Simpler and sufficient.

---

## Testing

`mrChartAdapters.test.ts` covers all pure function behaviour (8 tests above). No component tests — charts are presentational. TypeScript build is the verification gate for component files.
