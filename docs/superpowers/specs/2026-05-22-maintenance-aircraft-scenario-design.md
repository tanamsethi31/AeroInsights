# Maintenance: Aircraft Detail & Scenario Modelling Tabs — Design

**Goal:** Replace the two stub tabs in the Maintenance page with fully functional views: per-aircraft balance curves + projection table (Aircraft Detail) and interactive utilisation scenario analysis across the portfolio (Scenario Modelling).

**Architecture:** Three new components in `src/app/components/maintenance/`. All data and projection logic is reused from existing files — `sdmrData`, `buildProjections`, `LEASE_CONTEXT`, `TYPE_HEURISTICS`. No new data files. No API calls.

**Tech Stack:** React, TypeScript, Recharts (already in use for MRCashflowChart), inline styles (matching existing light-theme palette throughout the app).

---

## Files

| Action | Path |
|--------|------|
| Create | `src/app/components/maintenance/AircraftBalanceChart.tsx` |
| Create | `src/app/components/maintenance/AircraftDetailTab.tsx` |
| Create | `src/app/components/maintenance/ScenarioModellingTab.tsx` |
| Modify | `src/app/pages/Maintenance.tsx` |

---

## Section 1 — `AircraftBalanceChart.tsx`

**Purpose:** Pure presentational Recharts `LineChart` showing how each MR component's balance grows (and drops at maintenance events) from today to lease end.

**Props:**
```typescript
interface Props {
  projections: ComponentProjection[];  // from buildProjections()
  leaseEndDate: Date;                  // for EOL reference line
  monthsToEOL: number;                 // drives X-axis range
}
```

**Data generation (inside the component, no export needed):**

For each component projection `p`, generate monthly data points from month 0 to `monthsToEOL`:
```
balance(t) = p.currentBalance + p.monthlyAccrual * t    // before event
           = balance(monthsToNextEvent) - p.heuristicEventCost + p.monthlyAccrual * (t - monthsToNextEvent)  // after event
```

If `p.monthsToNextEvent > monthsToEOL` the event never fires within the lease — no drop, just the upward slope.

Data shape per month: `{ month: number; [componentName]: number }` — one numeric field per component, all on the same data array so Recharts can draw all 5 lines from a single dataset.

**Chart:**
- `ResponsiveContainer width="100%" height={300}`
- `LineChart` with the monthly data array
- One `<Line>` per component, each with a distinct colour (fixed palette: `["#3B82F6","#F59E0B","#10B981","#8B5CF6","#F87171"]` in component order)
- `XAxis dataKey="month"` — tick formatter converts month index to quarterly label (months 0, 3, 6, … → "Today", "Q3 2026", …)
- `YAxis` tick formatter: `$${(v/1_000_000).toFixed(1)}M`
- `Tooltip` showing all component balances at the hovered month
- `Legend` at bottom
- `ReferenceLine` at `x={monthsToEOL}` with label "EOL" in red
- No `ReferenceLine` per event — the line drop is self-explanatory

**Styling:** White card wrapper (`background: "#FFFFFF"`, `border: "1px solid #E2E8F0"`, `borderRadius: "10px"`, `padding: "1rem"`), title "MR Balance Trajectories" in small uppercase label above the chart.

---

## Section 2 — `AircraftDetailTab.tsx`

**Purpose:** Aircraft selector + balance chart + full `MaintenanceForecastTab` projection view for the selected aircraft.

**Data:**
```typescript
// All aircraft rows: derive from sdmrData + LEASE_CONTEXT
const AIRCRAFT_LIST = sdmrData.map(lease => {
  const msn = Object.entries(LEASE_CONTEXT).find(([, ctx]) => ctx.leaseId === lease.leaseId)?.[0] ?? "";
  const ctx = LEASE_CONTEXT[msn];
  return { leaseId: lease.leaseId, msn, lessee: lease.lessee, aircraft: lease.aircraft, leaseEnd: ctx?.leaseEnd ?? "" };
});
```

**State:** `selectedLeaseId: string` — initialised to `sdmrData[0].leaseId`.

**Layout (top to bottom):**

1. **Aircraft selector row** — horizontal pill buttons, one per aircraft. Label: `"{lessee} — {aircraft} (MSN {msn})"`. Selected pill: `background: "#002147"`, `color: "#FFFFFF"`. Unselected: `background: "#F1F5F9"`, `color: "#475569"`. Wraps on small screens (`flexWrap: "wrap"`).

2. **`AircraftBalanceChart`** — receives `projections`, `leaseEndDate`, `monthsToEOL` derived from the selected aircraft.

3. **`MaintenanceForecastTab`** — receives `msn`, `aircraftType`, `vintage` (from sdmrData) for the selected aircraft. This component already handles servicer report input, adequacy flag, EOL summary, base/distressed toggle, and component projection table.

**Derivation for selected aircraft:**
```typescript
const selectedLease = sdmrData.find(l => l.leaseId === selectedLeaseId)!;
const selectedMsn   = AIRCRAFT_LIST.find(a => a.leaseId === selectedLeaseId)!.msn;
const ctx           = LEASE_CONTEXT[selectedMsn];
const leaseEndDate  = parseDateLocal(ctx.leaseEnd);
const monthsToEOL   = Math.max(0, monthsBetween(NOW, leaseEndDate));
const projections   = buildProjections(selectedLease, selectedLease.aircraft, leaseEndDate);
// NOW = new Date(2026, 4, 1) — matches the reference date in buildProjections
```

---

## Section 3 — `ScenarioModellingTab.tsx`

**Purpose:** Portfolio-level utilisation sliders → impact table, with per-aircraft drilldown comparing base vs. scenario.

### 3a. Scenario controls

Two sliders at the top of the tab:

| Slider | Min | Max | Default | Step | Label |
|--------|-----|-----|---------|------|-------|
| Annual FH | 1,500 | 4,500 | 3,200 | 100 | "Annual Flight Hours" |
| Annual Cycles | 1,000 | 3,500 | 2,100 | 50 | "Annual Cycles" |

Defaults match A320neo heuristic in `TYPE_HEURISTICS`. Live value displayed next to each slider as a pill. "Reset to heuristic defaults" button restores both to defaults.

State:
```typescript
const [fh, setFh] = useState(3200);
const [cy, setCy] = useState(2100);
const [expanded, setExpanded] = useState<string | null>(null); // leaseId
```

### 3b. Portfolio impact table

One row per aircraft. Computed with:
```typescript
const baseProjections = buildProjections(lease, lease.aircraft, leaseEndDate);           // no override
const scenProjections = buildProjections(lease, lease.aircraft, leaseEndDate, { annualFH: fh, annualCy: cy, componentRemaining: {} });
const baseEOL   = baseProjections.reduce((s, p) => s + p.eolShortfall, 0);
const scenEOL   = scenProjections.reduce((s, p) => s + p.eolShortfall, 0);
const delta     = scenEOL - baseEOL;  // +ve = scenario is worse (higher shortfall)
```

Columns:
- **Aircraft** — `"{lessee} — {aircraft}"` + MSN badge
- **Lease End** — formatted date
- **Base EOL** — shortfall (red) or surplus (green), formatted as `fmtUSD`
- **Scenario EOL** — same formatting
- **Δ Delta** — `delta` formatted with sign; red if delta > 0 (worsens), green if delta < 0 (improves), grey if ~0
- **▾** — expand toggle

Table header row: `background: "#F8FAFC"`, `border-bottom: 1px solid #E2E8F0`. Row hover: `background: "#F8FAFC"`. Selected (expanded) row: `background: "#EFF6FF"`.

### 3c. Per-aircraft drilldown

When a row is expanded, render an inline panel below it (inside the same table container, spanning all columns via `colSpan`). The panel shows two narrow projection tables side by side:

- **Left: "Base (Heuristic)"** — component rows with EOL position from `baseProjections`
- **Right: "Scenario ({fh.toLocaleString()} FH / {cy.toLocaleString()} cy)"** — component rows from `scenProjections`

Each mini-table columns: Component · Monthly Accrual · EOL Balance · EOL Obligation · EOL Position

The EOL Position cell is colour-coded (red = shortfall, green = surplus).

---

## Section 4 — `Maintenance.tsx` changes

Replace the two stub `activeTab` blocks:

```tsx
{activeTab === "Aircraft Detail" && (
  <AircraftDetailTab />
)}

{activeTab === "Scenario Modelling" && (
  <ScenarioModellingTab />
)}
```

Add imports for both new components.

---

## Shared helpers (defined locally in each new file, no shared util needed)

```typescript
const NOW = new Date(2026, 4, 1);

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function fmtUSD(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}k`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
}
```

---

## Edge Cases

- **Lease already ended** (MSN 1728, lease end 2026-09-01): `monthsToEOL = 4`. Chart will be very short — this is correct. The balance trajectory and EOL line will still render.
- **Event after EOL** (e.g. LLPs with very long interval): `monthsToNextEvent > monthsToEOL` — no drop in the chart line, just upward slope. This is intentional.
- **Scenario FH < base FH**: Monthly accrual decreases → EOL balance is lower → shortfall worsens. This is the correct behaviour.
- **`componentRemaining: {}`** passed in scenario override: `buildProjections` will use `comp.remainingUnits` from `sdmrData` unchanged — only utilisation rate changes, not the starting point.

---

## Testing

No new test files. `buildProjections` is already tested in `cashFlowForecast.test.ts`. The new components are purely presentational — TypeScript build is the verification gate.
