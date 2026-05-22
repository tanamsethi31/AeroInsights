# Maintenance: Aircraft Detail & Scenario Modelling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two stub tabs in the Maintenance page with a per-aircraft balance-curves view (Aircraft Detail) and an interactive portfolio-wide utilisation scenario tool (Scenario Modelling).

**Architecture:** Three new components in `src/app/components/maintenance/` plus a small update to `Maintenance.tsx`. All projection logic reuses the existing `buildProjections` function from `MaintenanceForecastTab.tsx` — no new data files or API calls needed.

**Tech Stack:** React 18, TypeScript, Recharts (LineChart/ReferenceLine — already in use for MRCashflowChart), inline styles matching the app's light theme (`#FFFFFF` cards, `#E2E8F0` borders, `#0F172A` primary text).

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/components/maintenance/AircraftBalanceChart.tsx` | Pure chart: MR balance curves per component from today to lease end |
| Create | `src/app/components/maintenance/AircraftDetailTab.tsx` | Aircraft selector + balance chart + full MaintenanceForecastTab |
| Create | `src/app/components/maintenance/ScenarioModellingTab.tsx` | FH/cy sliders + portfolio impact table + per-aircraft drilldown |
| Modify | `src/app/pages/Maintenance.tsx` | Wire in the two new tab components |

---

## Context for all tasks

**Key imports available:**
- `buildProjections`, `LEASE_CONTEXT`, `MaintenanceForecastTab` from `../../components/portfolio/MaintenanceForecastTab`
- `sdmrData` from `../../components/portfolio/SDMRTab` (6 leases: IndiGo A320neo, Aeromexico B737-800, Emirates B777-300ER, SriLankan A330-300, Ryanair B737 MAX 8, Air France A350-900)
- `ComponentProjection` type from `MaintenanceForecastTab`
- Recharts: `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `ResponsiveContainer`, `ReferenceLine`

**Reference date used throughout the app:** `new Date(2026, 4, 1)` (May 2026).

**`buildProjections` signature:**
```typescript
buildProjections(
  lease: LeaseSDMR,
  aircraftType: string,
  leaseEndDate: Date,
  utilOverride?: UtilOverride,  // { annualFH: number; annualCy: number; componentRemaining: Record<string,number> }
): ComponentProjection[]
```

**`LEASE_CONTEXT` maps MSN string → `{ leaseId, leaseEnd, stage }`:**
```
"9218"  → LSE-2019-001 / 2028-03-01
"41234" → LSE-2020-014 / 2027-06-15
"62047" → LSE-2021-022 / 2030-01-10
"1728"  → LSE-2020-031 / 2026-09-01
"67892" → LSE-2022-009 / 2032-04-15
"0378"  → LSE-2018-047 / 2028-07-20
```

**`MaintenanceForecastTab` props:**
```typescript
{ msn: string; aircraftType: string; vintage: number; liveRecord?: LeaseSDMR }
// Note: vintage is unused internally (parameter is _), pass 2020 as safe default
```

---

## Task 1: AircraftBalanceChart component

**Files:**
- Create: `src/app/components/maintenance/AircraftBalanceChart.tsx`

No unit tests — presentational chart component. Verification: TypeScript build passes.

- [ ] **Step 1: Create the file**

```typescript
// src/app/components/maintenance/AircraftBalanceChart.tsx
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { ComponentProjection } from "../portfolio/MaintenanceForecastTab";

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPONENT_COLORS: Record<string, string> = {
  "Airframe HSI": "#3B82F6",
  "Engine PR":    "#F59E0B",
  "LLPs":         "#10B981",
  "Landing Gear": "#8B5CF6",
  "APU":          "#F87171",
};

const NOW = new Date(2026, 4, 1);

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  projections:  ComponentProjection[];
  leaseEndDate: Date;   // used only for the EOL reference line label (unused beyond display)
  monthsToEOL:  number; // drives X-axis range
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build monthly balance series for all components.
 * For performance we sample at every `step` months (roughly 24 points across the range).
 */
function buildBalanceSeries(
  projections: ComponentProjection[],
  monthsToEOL: number,
): Record<string, number | string>[] {
  const step = Math.max(1, Math.floor(monthsToEOL / 24));
  const data: Record<string, number | string>[] = [];

  for (let m = 0; m <= monthsToEOL; m += step) {
    const point: Record<string, number | string> = { month: m };
    for (const p of projections) {
      if (m < p.monthsToNextEvent) {
        // Event hasn't fired yet — linear accrual
        point[p.component] = p.currentBalance + p.monthlyAccrual * m;
      } else {
        // Event fired at monthsToNextEvent — balance drops then resumes accrual
        const balAtEvent  = p.currentBalance + p.monthlyAccrual * p.monthsToNextEvent;
        const afterDrop   = balAtEvent - p.heuristicEventCost;
        const monthsAfter = m - p.monthsToNextEvent;
        point[p.component] = Math.max(0, afterDrop + p.monthlyAccrual * monthsAfter);
      }
    }
    data.push(point);
  }
  return data;
}

/** Convert a month index (0 = May 2026) to a quarterly label. */
function monthToLabel(m: number): string {
  if (m === 0) return "Today";
  const d = new Date(NOW);
  d.setMonth(d.getMonth() + m);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function fmtM(v: unknown): string {
  const n = Number(v);
  return isNaN(n) ? "" : `$${(n / 1_000_000).toFixed(1)}M`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AircraftBalanceChart({ projections, monthsToEOL }: Props) {
  const data = buildBalanceSeries(projections, monthsToEOL);
  // Show ~6 X-axis ticks regardless of total range
  const tickInterval = Math.max(0, Math.floor(data.length / 6) - 1);

  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #E2E8F0",
      borderRadius: "10px", padding: "1.25rem",
    }}>
      <div style={{
        fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8",
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem",
      }}>
        MR Balance Trajectories
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
          <XAxis
            dataKey="month"
            tickFormatter={monthToLabel}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            tickFormatter={fmtM}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            formatter={(value: number, name: string) => [fmtM(value), name]}
            labelFormatter={(m: number) => monthToLabel(m)}
            contentStyle={{
              background: "#FFFFFF", border: "1px solid #E2E8F0",
              borderRadius: "8px", fontSize: "0.8rem",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "0.78rem", paddingTop: "0.5rem" }} />
          <ReferenceLine
            x={monthsToEOL}
            stroke="#F87171"
            strokeDasharray="4 4"
            label={{ value: "EOL", position: "top", fill: "#F87171", fontSize: 11 }}
          />
          {projections.map(p => (
            <Line
              key={p.component}
              type="monotone"
              dataKey={p.component}
              stroke={COMPONENT_COLORS[p.component] ?? "#94A3B8"}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in` with no TypeScript errors. If errors appear, fix them before proceeding.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
git add src/app/components/maintenance/AircraftBalanceChart.tsx
git commit -m "feat: add AircraftBalanceChart component for MR balance trajectories"
```

---

## Task 2: AircraftDetailTab component

**Files:**
- Create: `src/app/components/maintenance/AircraftDetailTab.tsx`

- [ ] **Step 1: Create the file**

```typescript
// src/app/components/maintenance/AircraftDetailTab.tsx
import { useState, useMemo } from "react";
import { sdmrData } from "../portfolio/SDMRTab";
import {
  LEASE_CONTEXT,
  buildProjections,
  MaintenanceForecastTab,
} from "../portfolio/MaintenanceForecastTab";
import { AircraftBalanceChart } from "./AircraftBalanceChart";

// ── Constants ─────────────────────────────────────────────────────────────────

const NOW = new Date(2026, 4, 1);

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthsBetween(a: Date, b: Date): number {
  return (
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
}

// ── Static aircraft list (derived once at module load) ────────────────────────

interface AircraftEntry {
  leaseId:  string;
  msn:      string;
  lessee:   string;
  aircraft: string;
  leaseEnd: string;
}

const AIRCRAFT_LIST: AircraftEntry[] = sdmrData.map(lease => {
  const entry = Object.entries(LEASE_CONTEXT).find(
    ([, ctx]) => ctx.leaseId === lease.leaseId,
  );
  const msn = entry?.[0] ?? "";
  const ctx = msn ? LEASE_CONTEXT[msn] : null;
  return {
    leaseId:  lease.leaseId,
    msn,
    lessee:   lease.lessee,
    aircraft: lease.aircraft,
    leaseEnd: ctx?.leaseEnd ?? "2030-01-01",
  };
});

// ── Component ─────────────────────────────────────────────────────────────────

export function AircraftDetailTab() {
  const [selectedLeaseId, setSelectedLeaseId] = useState(AIRCRAFT_LIST[0].leaseId);

  const selected      = AIRCRAFT_LIST.find(a => a.leaseId === selectedLeaseId)!;
  const selectedLease = sdmrData.find(l => l.leaseId === selectedLeaseId)!;
  const leaseEndDate  = parseDateLocal(selected.leaseEnd);
  const monthsToEOL   = Math.max(0, monthsBetween(NOW, leaseEndDate));

  const projections = useMemo(
    () => buildProjections(selectedLease, selectedLease.aircraft, leaseEndDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedLeaseId],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1.5rem" }}>

      {/* ── Aircraft selector ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {AIRCRAFT_LIST.map(a => {
          const isActive = a.leaseId === selectedLeaseId;
          return (
            <button
              key={a.leaseId}
              onClick={() => setSelectedLeaseId(a.leaseId)}
              style={{
                padding:      "0.375rem 0.875rem",
                background:   isActive ? "#002147" : "#F1F5F9",
                color:        isActive ? "#FFFFFF"  : "#475569",
                border:       `1px solid ${isActive ? "#002147" : "#E2E8F0"}`,
                borderRadius: "999px",
                fontSize:     "0.8rem",
                fontWeight:   isActive ? 600 : 400,
                cursor:       "pointer",
                whiteSpace:   "nowrap",
              }}
            >
              {a.lessee} — {a.aircraft}
              <span style={{ marginLeft: "0.375rem", fontSize: "0.7rem", opacity: 0.7 }}>
                MSN {a.msn}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Balance curves chart ──────────────────────────────────────── */}
      <AircraftBalanceChart
        projections={projections}
        leaseEndDate={leaseEndDate}
        monthsToEOL={monthsToEOL}
      />

      {/* ── Full projection table via MaintenanceForecastTab ─────────── */}
      <MaintenanceForecastTab
        msn={selected.msn}
        aircraftType={selectedLease.aircraft}
        vintage={2020}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/maintenance/AircraftDetailTab.tsx
git commit -m "feat: add AircraftDetailTab with aircraft selector and balance chart"
```

---

## Task 3: ScenarioModellingTab component

**Files:**
- Create: `src/app/components/maintenance/ScenarioModellingTab.tsx`

- [ ] **Step 1: Create the file**

```typescript
// src/app/components/maintenance/ScenarioModellingTab.tsx
import { useState, useMemo } from "react";
import { sdmrData } from "../portfolio/SDMRTab";
import {
  LEASE_CONTEXT,
  buildProjections,
  type ComponentProjection,
} from "../portfolio/MaintenanceForecastTab";

// ── Constants ─────────────────────────────────────────────────────────────────

const NOW = new Date(2026, 4, 1);
const DEFAULT_FH = 3200;
const DEFAULT_CY = 2100;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function eolColor(shortfall: number): string {
  return shortfall > 0 ? "#B91C1C" : "#15803D";
}

// ── Static aircraft list ───────────────────────────────────────────────────────

interface AircraftEntry {
  leaseId:  string;
  msn:      string;
  lessee:   string;
  aircraft: string;
  leaseEnd: string;
}

const AIRCRAFT_LIST: AircraftEntry[] = sdmrData.map(lease => {
  const entry = Object.entries(LEASE_CONTEXT).find(
    ([, ctx]) => ctx.leaseId === lease.leaseId,
  );
  const msn = entry?.[0] ?? "";
  const ctx = msn ? LEASE_CONTEXT[msn] : null;
  return {
    leaseId:  lease.leaseId,
    msn,
    lessee:   lease.lessee,
    aircraft: lease.aircraft,
    leaseEnd: ctx?.leaseEnd ?? "2030-01-01",
  };
});

// ── MiniProjectionTable ────────────────────────────────────────────────────────

function MiniProjectionTable({
  title,
  projections,
  highlight = false,
}: {
  title:       string;
  projections: ComponentProjection[];
  highlight?:  boolean;
}) {
  return (
    <div style={{
      background: "#FFFFFF",
      border: `1px solid ${highlight ? "#BFDBFE" : "#E2E8F0"}`,
      borderRadius: "8px",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "0.5rem 0.875rem",
        borderBottom: "1px solid #E2E8F0",
        fontSize: "0.72rem",
        fontWeight: 600,
        color: highlight ? "#1D4ED8" : "#475569",
        background: highlight ? "#EFF6FF" : "#F8FAFC",
      }}>
        {title}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
        <thead>
          <tr>
            {["Component", "/mo Accrual", "EOL Balance", "EOL Oblig.", "EOL Position"].map(h => (
              <th key={h} style={{
                padding: "0.375rem 0.625rem",
                textAlign: "left",
                color: "#64748B",
                fontWeight: 500,
                borderBottom: "1px solid #E2E8F0",
                whiteSpace: "nowrap",
                background: "#F8FAFC",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projections.map(p => (
            <tr key={p.component} style={{ borderBottom: "1px solid #F1F5F9" }}>
              <td style={{ padding: "0.375rem 0.625rem", fontWeight: 500, color: "#0F172A", whiteSpace: "nowrap" }}>
                {p.component}
              </td>
              <td style={{ padding: "0.375rem 0.625rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                {fmtUSD(p.monthlyAccrual)}
              </td>
              <td style={{ padding: "0.375rem 0.625rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                {fmtUSD(p.projectedBalanceAtEOL)}
              </td>
              <td style={{ padding: "0.375rem 0.625rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                {fmtUSD(p.eolObligation)}
              </td>
              <td style={{
                padding: "0.375rem 0.625rem",
                fontWeight: 700,
                color: eolColor(p.eolShortfall),
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}>
                {fmtUSD(Math.abs(p.eolShortfall))}
                <span style={{ fontWeight: 400, fontSize: "0.68rem", marginLeft: "0.25rem", color: "#94A3B8" }}>
                  {p.eolShortfall > 0 ? "short" : "surplus"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── ScenarioModellingTab ───────────────────────────────────────────────────────

export function ScenarioModellingTab() {
  const [fh,       setFh      ] = useState(DEFAULT_FH);
  const [cy,       setCy      ] = useState(DEFAULT_CY);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    return AIRCRAFT_LIST.map(a => {
      const lease        = sdmrData.find(l => l.leaseId === a.leaseId)!;
      const leaseEndDate = parseDateLocal(a.leaseEnd);

      const baseProj = buildProjections(lease, lease.aircraft, leaseEndDate);
      const scenProj = buildProjections(lease, lease.aircraft, leaseEndDate, {
        annualFH:           fh,
        annualCy:           cy,
        componentRemaining: {},
      });

      const baseEOL = baseProj.reduce((s, p) => s + p.eolShortfall, 0);
      const scenEOL = scenProj.reduce((s, p) => s + p.eolShortfall, 0);
      const delta   = scenEOL - baseEOL; // +ve = scenario worsens shortfall

      return { ...a, lease, leaseEndDate, baseProj, scenProj, baseEOL, scenEOL, delta };
    });
  }, [fh, cy]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1.5rem" }}>

      {/* ── Scenario controls ─────────────────────────────────────────── */}
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0",
        borderRadius: "10px", padding: "1.25rem 1.5rem",
        display: "flex", flexWrap: "wrap", gap: "2rem", alignItems: "flex-end",
      }}>
        {/* FH slider */}
        <div>
          <div style={{
            fontSize: "0.6875rem", fontWeight: 600, color: "#64748B",
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem",
          }}>
            Annual Flight Hours
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <input
              type="range" min={1500} max={4500} step={100}
              value={fh}
              onChange={e => setFh(Number(e.target.value))}
              style={{ width: "180px" }}
            />
            <span style={{
              padding: "0.2rem 0.625rem",
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600, color: "#1D4ED8",
              whiteSpace: "nowrap",
            }}>
              {fh.toLocaleString()} FH
            </span>
          </div>
        </div>

        {/* Cycles slider */}
        <div>
          <div style={{
            fontSize: "0.6875rem", fontWeight: 600, color: "#64748B",
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem",
          }}>
            Annual Cycles
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <input
              type="range" min={1000} max={3500} step={50}
              value={cy}
              onChange={e => setCy(Number(e.target.value))}
              style={{ width: "180px" }}
            />
            <span style={{
              padding: "0.2rem 0.625rem",
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600, color: "#1D4ED8",
              whiteSpace: "nowrap",
            }}>
              {cy.toLocaleString()} cy
            </span>
          </div>
        </div>

        {/* Reset button */}
        <button
          onClick={() => { setFh(DEFAULT_FH); setCy(DEFAULT_CY); setExpanded(null); }}
          style={{
            padding: "0.375rem 0.875rem",
            background: "transparent", border: "1px solid #E2E8F0",
            borderRadius: "6px", fontSize: "0.78rem", color: "#64748B",
            cursor: "pointer",
          }}
        >
          Reset to defaults
        </button>
      </div>

      {/* ── Portfolio impact table ────────────────────────────────────── */}
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0",
        borderRadius: "10px", overflow: "hidden",
      }}>
        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,2fr) 100px 130px 130px 130px 32px",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          background: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
          fontSize: "0.7rem",
          fontWeight: 600,
          color: "#64748B",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}>
          <span>Aircraft / Lessee</span>
          <span>Lease End</span>
          <span style={{ textAlign: "right" }}>Base EOL</span>
          <span style={{ textAlign: "right" }}>Scenario EOL</span>
          <span style={{ textAlign: "right" }}>Δ Delta</span>
          <span />
        </div>

        {/* Rows */}
        {rows.map(row => {
          const isExpanded = expanded === row.leaseId;
          const deltaColor = Math.abs(row.delta) < 5_000
            ? "#94A3B8"
            : row.delta > 0 ? "#B91C1C" : "#15803D";
          const deltaSign = row.delta > 0 ? "+" : row.delta < 0 ? "" : "";

          return (
            <div key={row.leaseId}>
              {/* Main row */}
              <div
                onClick={() => setExpanded(isExpanded ? null : row.leaseId)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,2fr) 100px 130px 130px 130px 32px",
                  gap: "0.5rem",
                  padding: "0.75rem 1rem",
                  borderBottom: "1px solid #F1F5F9",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  background: isExpanded ? "#EFF6FF" : "transparent",
                  alignItems: "center",
                  transition: "background 100ms",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#0F172A" }}>{row.lessee}</div>
                  <div style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                    {row.aircraft} · MSN {row.msn}
                  </div>
                </div>

                <span style={{ color: "#475569", fontSize: "0.78rem" }}>
                  {parseDateLocal(row.leaseEnd).toLocaleDateString("en-GB", {
                    month: "short", year: "numeric",
                  })}
                </span>

                <span style={{
                  textAlign: "right", fontWeight: 600,
                  color: eolColor(row.baseEOL), fontVariantNumeric: "tabular-nums",
                }}>
                  {fmtUSD(Math.abs(row.baseEOL))}
                  <span style={{ fontWeight: 400, fontSize: "0.68rem", marginLeft: "0.25rem", color: "#94A3B8" }}>
                    {row.baseEOL > 0 ? "short" : "surplus"}
                  </span>
                </span>

                <span style={{
                  textAlign: "right", fontWeight: 600,
                  color: eolColor(row.scenEOL), fontVariantNumeric: "tabular-nums",
                }}>
                  {fmtUSD(Math.abs(row.scenEOL))}
                  <span style={{ fontWeight: 400, fontSize: "0.68rem", marginLeft: "0.25rem", color: "#94A3B8" }}>
                    {row.scenEOL > 0 ? "short" : "surplus"}
                  </span>
                </span>

                <span style={{
                  textAlign: "right", fontWeight: 700,
                  color: deltaColor, fontVariantNumeric: "tabular-nums",
                }}>
                  {deltaSign}{fmtUSD(Math.abs(row.delta))}
                </span>

                <span style={{ textAlign: "center", color: "#94A3B8", fontSize: "0.9rem" }}>
                  {isExpanded ? "▴" : "▾"}
                </span>
              </div>

              {/* Per-aircraft drilldown */}
              {isExpanded && (
                <div style={{
                  borderBottom: "1px solid #E2E8F0",
                  padding: "1rem",
                  background: "#F8FAFC",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}>
                  <MiniProjectionTable
                    title="Base (Heuristic)"
                    projections={row.baseProj}
                  />
                  <MiniProjectionTable
                    title={`Scenario · ${fh.toLocaleString()} FH / ${cy.toLocaleString()} cy`}
                    projections={row.scenProj}
                    highlight
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/maintenance/ScenarioModellingTab.tsx
git commit -m "feat: add ScenarioModellingTab with portfolio impact table and drilldown"
```

---

## Task 4: Wire tabs into Maintenance.tsx

**Files:**
- Modify: `src/app/pages/Maintenance.tsx`

- [ ] **Step 1: Add the two new imports**

Open `src/app/pages/Maintenance.tsx`. The current imports block (lines 1–11) looks like:

```typescript
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
```

Add these two imports after the last maintenance import:

```typescript
import { AircraftDetailTab } from "../components/maintenance/AircraftDetailTab";
import { ScenarioModellingTab } from "../components/maintenance/ScenarioModellingTab";
```

Also remove the now-unused `PlaneTakeoff` and `SlidersHorizontal` lucide imports (they were only used in the stubs):

```typescript
// Remove this line:
import { PlaneTakeoff, SlidersHorizontal } from "lucide-react";
```

- [ ] **Step 2: Replace the Aircraft Detail stub (lines 58–77)**

Find this block:

```tsx
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
```

Replace with:

```tsx
        {activeTab === "Aircraft Detail" && (
          <AircraftDetailTab />
        )}
```

- [ ] **Step 3: Replace the Scenario Modelling stub (lines 79–98)**

Find this block:

```tsx
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
```

Replace with:

```tsx
        {activeTab === "Scenario Modelling" && (
          <ScenarioModellingTab />
        )}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in` with no TypeScript errors.

- [ ] **Step 5: Commit and push**

```bash
git add src/app/pages/Maintenance.tsx
git commit -m "feat: wire Aircraft Detail and Scenario Modelling tabs into Maintenance page"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ `AircraftBalanceChart` — balance curves per component, EOL reference line, quarterly X-axis, $M Y-axis
- ✅ `AircraftDetailTab` — aircraft selector pills + chart + `MaintenanceForecastTab` below
- ✅ `ScenarioModellingTab` — FH/cy sliders, reset button, portfolio impact table, per-aircraft drilldown
- ✅ Drilldown: base vs. scenario mini-tables side-by-side
- ✅ Delta column: colour-coded (red = worsens, green = improves, grey = ~0)
- ✅ `Maintenance.tsx` wired — stubs replaced

**Placeholder scan:** None found.

**Type consistency:**
- `ComponentProjection` imported from `MaintenanceForecastTab` in both Task 1 and Task 3 ✅
- `buildProjections` called with `(lease, lease.aircraft, leaseEndDate, utilOverride?)` throughout ✅
- `AIRCRAFT_LIST` defined identically in Task 2 and Task 3 (duplicated intentionally — each file is self-contained) ✅
