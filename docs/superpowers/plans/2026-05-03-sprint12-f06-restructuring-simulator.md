# F06 Restructuring Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Restructuring" tab (9th) to `LesseeProfilePanel` that compares seven restructuring templates side-by-side — showing NPV to lessor, IRR, restructured ECL, ECL relief, and P95 downside — against a counterfactual default benchmark.

**Architecture:** A pure-TypeScript engine (`restructuringEngine.ts`) handles all financial computations (NPV at 8% p.a., IRR via bisection, ECL, P95 stress) for seven fixed aviation-grade templates. A React component (`RestructuringTab.tsx`) renders a KPI bar and a 7-column × 5-row comparison table with a clickable template detail accordion. `LesseeProfilePanel.tsx` gains a 9th tab and passes pre-joined `RestructuringInputRow[]` data to the component.

**Tech Stack:** React 18, TypeScript, inline styles only (no CSS modules), `KpiCard` from `../ui/KpiCard`, no external chart libraries needed for this tab.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/components/counterparties/restructuringEngine.ts` | Types, 7 template constants, NPV/IRR/ECL/P95/counterfactual functions, `computeAllTemplates` |
| Create | `src/app/components/counterparties/RestructuringTab.tsx` | KPI bar, comparison table, accordion detail, counterfactual banner |
| Modify | `src/app/components/counterparties/LesseeProfilePanel.tsx` | Import `RestructuringTab`, add "Restructuring" to TABS, wire render |

---

## Task 1: Create `restructuringEngine.ts`

**Files:**
- Create: `src/app/components/counterparties/restructuringEngine.ts`

### Context

This is a pure TypeScript module — no React, no imports from the rest of the app. It is the only file that should contain financial computation logic for restructuring. All functions are deterministic given the same inputs.

`LesseeLeaseRow` (from `LesseeProfilePanel.tsx`) has these relevant fields:
- `id: string` — matched against `LesseeECLRow.leaseId`
- `monthlyRentUSD: number` — monthly contracted rent in USD
- `leaseEnd: string` — ISO date string, e.g. `"2028-03-01"`

`LesseeECLRow` (from `LesseeProfilePanel.tsx`) has:
- `leaseId: string`
- `aircraft: string`
- `ead: number` — exposure at default in USD
- `pdLifetime: number` — lifetime PD in percentage points (e.g. 24.1 means 24.1%)
- `lgd: number` — LGD in percentage points (e.g. 54 means 54%)
- `eclLifetime: number` — base lifetime ECL in USD
- `stage: "1" | "2" | "3"`

The engine defines its own `RestructuringInputRow` that merges these two — callers build the join.

ECL formula: `(EAD × PD × LGD) / 10_000` — divides by 10000 because both PD and LGD are in percentage points (not decimals).

Discount rate: 8% per annum = `0.08 / 12` per month.

Reference date for remaining lease months: `new Date("2026-05-03")`.

- [ ] **Step 1: Create the file with all types, constants, helper functions, and main export**

```typescript
// src/app/components/counterparties/restructuringEngine.ts

// ── Types ─────────────────────────────────────────────────────────────────────

export type TemplateId =
  | "paymentHoliday"
  | "deferral"
  | "pbhConversion"
  | "termExtension"
  | "forgiveness"
  | "rateReduction"
  | "hybrid";

export interface RestructuringTemplate {
  id: TemplateId;
  name: string;
  description: string;
  /** Months of zero rent at the start of the restructuring period */
  holidayMonths: number;
  /** Multiplier applied to monthly rent after the holiday period (1.0 = unchanged, 0.85 = 15% reduction) */
  rentMultiplier: number;
  /** % reduction applied to EAD for ECL calculation (e.g. 20 = EAD × 0.80) */
  eadReductionPct: number;
  /** Percentage-point reduction applied to pdLifetime before ECL calculation (e.g. 8 = pdLifetime − 8pp) */
  pdReductionPp: number;
  /** Extra months appended to remaining lease term for cash-flow projection */
  termExtMonths: number;
  /** Immediate EAD write-down subtracted from NPV — models debt forgiveness (e.g. 20 = totalEAD × 0.20 written off) */
  eadWriteDownPct: number;
  implementationTimeline: string;
  conditions: string;
}

/** One lease's combined data, built by the caller (LesseeProfilePanel) from LesseeLeaseRow + LesseeECLRow */
export interface RestructuringInputRow {
  leaseId: string;
  aircraft: string;
  monthlyRentUSD: number;
  leaseEnd: string; // ISO date string
  ead: number;
  pdLifetime: number; // percentage points
  lgd: number;       // percentage points
  eclLifetime: number;
  stage: "1" | "2" | "3";
}

export interface RestructuringResult {
  templateId: TemplateId;
  /** PV of restructured future rent cash flows minus any EAD write-down, in $M */
  npvToLessor: number;
  /** Annualised IRR of the restructured deal (initial outflow = totalEAD), in % */
  irr: number;
  /** Sum of restructured ECL across all leases, in $M */
  eclRestructured: number;
  /** Sum of base (unmodified) ECL across all leases, in $M */
  eclBase: number;
  /** eclBase − eclRestructured — positive means improvement, in $M */
  eclRelief: number;
  /** P95 stress ECL (pdLifetime × 1.5 before template cut), in $M */
  p95Downside: number;
  /** Expected loss on immediate default = totalEAD × weighted-avg LGD / 100, in $M */
  counterfactualLoss: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCOUNT_RATE_MONTHLY = 0.08 / 12;
const REF_DATE = new Date("2026-05-03");

export const RESTRUCTURING_TEMPLATES: RestructuringTemplate[] = [
  {
    id: "paymentHoliday",
    name: "Payment Holiday",
    description:
      "Suspend rent for 3 months to provide short-term liquidity relief; normal payments resume immediately after.",
    holidayMonths: 3,
    rentMultiplier: 1.0,
    eadReductionPct: 0,
    pdReductionPp: 2,
    termExtMonths: 0,
    eadWriteDownPct: 0,
    implementationTimeline: "1–2 weeks; simple amendment letter; minimal legal cost.",
    conditions: "Lessee must demonstrate temporary liquidity constraint, not structural insolvency.",
  },
  {
    id: "deferral",
    name: "Rent Deferral",
    description:
      "Defer 6 months of rent obligations; deferred amounts remain due at lease end.",
    holidayMonths: 6,
    rentMultiplier: 1.0,
    eadReductionPct: 0,
    pdReductionPp: 3,
    termExtMonths: 0,
    eadWriteDownPct: 0,
    implementationTimeline: "2–3 weeks; deferral agreement; deferred rent accrues.",
    conditions: "Lessee must provide updated liquidity forecast confirming ability to repay deferred amounts.",
  },
  {
    id: "pbhConversion",
    name: "PBH Conversion",
    description:
      "Convert fixed monthly rent to power-by-the-hour billing at 82% of contracted rate, reducing guaranteed exposure.",
    holidayMonths: 0,
    rentMultiplier: 0.82,
    eadReductionPct: 10,
    pdReductionPp: 5,
    termExtMonths: 0,
    eadWriteDownPct: 0,
    implementationTimeline: "4–6 weeks; lease amendment; flight-hour reporting framework required.",
    conditions: "Lessee must operate aircraft on revenue-generating routes; ACMI sublease not permitted.",
  },
  {
    id: "termExtension",
    name: "Term Extension",
    description:
      "Extend lease term 24 months at current rent, increasing total contracted cash flows and demonstrating lessee commitment.",
    holidayMonths: 0,
    rentMultiplier: 1.0,
    eadReductionPct: 0,
    pdReductionPp: 8,
    termExtMonths: 24,
    eadWriteDownPct: 0,
    implementationTimeline: "3–5 weeks; lease extension agreement; MAV re-appraisal recommended.",
    conditions:
      "Aircraft must remain within acceptable maintenance status; no open airworthiness directives.",
  },
  {
    id: "forgiveness",
    name: "Debt Forgiveness",
    description:
      "Forgive 20% of outstanding obligations in exchange for operational commitments, reducing EAD and PD materially.",
    holidayMonths: 0,
    rentMultiplier: 1.0,
    eadReductionPct: 20,
    pdReductionPp: 10,
    termExtMonths: 0,
    eadWriteDownPct: 20,
    implementationTimeline: "6–10 weeks; deed of release; board approval typically required.",
    conditions:
      "Lessor must receive binding operational commitments (route guarantees or maintenance covenants) in exchange.",
  },
  {
    id: "rateReduction",
    name: "Rate Reduction",
    description:
      "Reduce monthly rent by 15% for remaining lease term, improving lessee cash flow and reducing default probability.",
    holidayMonths: 0,
    rentMultiplier: 0.85,
    eadReductionPct: 0,
    pdReductionPp: 12,
    termExtMonths: 0,
    eadWriteDownPct: 0,
    implementationTimeline: "2–4 weeks; rate amendment letter; simple to execute.",
    conditions:
      "Rate reduction must be supported by current market comparables to avoid adverse IFRS 9 reclassification.",
  },
  {
    id: "hybrid",
    name: "Hybrid Package",
    description:
      "Combined package: 3-month holiday + 10% forgiveness + 10% rate reduction + 12-month extension — maximum distress relief.",
    holidayMonths: 3,
    rentMultiplier: 0.9,
    eadReductionPct: 10,
    pdReductionPp: 15,
    termExtMonths: 12,
    eadWriteDownPct: 10,
    implementationTimeline: "8–12 weeks; full restructuring agreement; legal counsel required.",
    conditions:
      "Reserved for imminent default scenarios where lessor prefers NPV of restructuring over repossession cost.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthsRemaining(leaseEnd: string): number {
  const end = new Date(leaseEnd);
  return Math.max(
    0,
    Math.round(
      (end.getTime() - REF_DATE.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    )
  );
}

function computeNPV(rows: RestructuringInputRow[], tmpl: RestructuringTemplate): number {
  let totalNPV = 0;
  let totalEAD = 0;

  for (const r of rows) {
    const remaining = monthsRemaining(r.leaseEnd);
    const totalMonths = remaining + tmpl.termExtMonths;

    let leasePV = 0;
    for (let t = 1; t <= totalMonths; t++) {
      const cashflow =
        t <= tmpl.holidayMonths ? 0 : r.monthlyRentUSD * tmpl.rentMultiplier;
      leasePV += cashflow / Math.pow(1 + DISCOUNT_RATE_MONTHLY, t);
    }
    totalNPV += leasePV;
    totalEAD += r.ead;
  }

  // Subtract immediate write-down (e.g. 20% debt forgiveness)
  totalNPV -= totalEAD * (tmpl.eadWriteDownPct / 100);
  return totalNPV / 1e6;
}

function computeIRR(rows: RestructuringInputRow[], tmpl: RestructuringTemplate): number {
  const totalEAD = rows.reduce((s, r) => s + r.ead, 0);

  const maxMonths = Math.max(
    ...rows.map((r) => monthsRemaining(r.leaseEnd) + tmpl.termExtMonths)
  );

  // cashflows[0] = initial lessor outflow (EAD invested + write-down); [1..n] = monthly inflows
  const cashflows: number[] = new Array(maxMonths + 1).fill(0);
  cashflows[0] = -(totalEAD + totalEAD * (tmpl.eadWriteDownPct / 100));

  for (const r of rows) {
    const remaining = monthsRemaining(r.leaseEnd);
    const totalMonths = remaining + tmpl.termExtMonths;
    for (let t = 1; t <= totalMonths; t++) {
      cashflows[t] += t <= tmpl.holidayMonths ? 0 : r.monthlyRentUSD * tmpl.rentMultiplier;
    }
  }

  // Bisection: find monthly rate where NPV(cashflows) = 0
  let lo = 0;
  let hi = 0.04; // 4% monthly = ~60% annual upper bound
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const npv = cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + mid, t), 0);
    if (npv > 0) lo = mid;
    else hi = mid;
  }
  const monthlyIRR = (lo + hi) / 2;
  return (Math.pow(1 + monthlyIRR, 12) - 1) * 100; // annualised %
}

function computeECLRestructured(rows: RestructuringInputRow[], tmpl: RestructuringTemplate): number {
  return (
    rows.reduce((sum, r) => {
      const adjEAD = r.ead * (1 - tmpl.eadReductionPct / 100);
      const adjPD = Math.max(0, r.pdLifetime - tmpl.pdReductionPp);
      return sum + (adjEAD * adjPD * r.lgd) / 10_000;
    }, 0) / 1e6
  );
}

function computeP95(rows: RestructuringInputRow[], tmpl: RestructuringTemplate): number {
  return (
    rows.reduce((sum, r) => {
      const adjEAD = r.ead * (1 - tmpl.eadReductionPct / 100);
      const stressedPD = Math.min(100, r.pdLifetime * 1.5);
      const adjPD = Math.max(0, stressedPD - tmpl.pdReductionPp);
      return sum + (adjEAD * adjPD * r.lgd) / 10_000;
    }, 0) / 1e6
  );
}

function computeCounterfactual(rows: RestructuringInputRow[]): number {
  const totalEAD = rows.reduce((s, r) => s + r.ead, 0);
  if (totalEAD === 0) return 0;
  const lgdWA = rows.reduce((s, r) => s + r.lgd * r.ead, 0) / totalEAD;
  return (totalEAD * lgdWA) / 100 / 1e6;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeAllTemplates(rows: RestructuringInputRow[]): RestructuringResult[] {
  const eclBase = rows.reduce((s, r) => s + r.eclLifetime, 0) / 1e6;
  const counterfactualLoss = computeCounterfactual(rows);

  return RESTRUCTURING_TEMPLATES.map((tmpl) => {
    const eclRestructured = computeECLRestructured(rows, tmpl);
    return {
      templateId: tmpl.id,
      npvToLessor: computeNPV(rows, tmpl),
      irr: computeIRR(rows, tmpl),
      eclRestructured,
      eclBase,
      eclRelief: eclBase - eclRestructured,
      p95Downside: computeP95(rows, tmpl),
      counterfactualLoss,
    };
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors. If errors appear, fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/counterparties/restructuringEngine.ts
git commit -m "feat(f06): add restructuringEngine — 7 templates, NPV/IRR/ECL/P95 computation"
```

---

## Task 2: Create `RestructuringTab.tsx`

**Files:**
- Create: `src/app/components/counterparties/RestructuringTab.tsx`
- Read for reference: `src/app/components/counterparties/MitigationsTab.tsx` (pattern for KPI bar + table layout)
- Read for reference: `src/app/components/ui/KpiCard.tsx` (props: `label`, `value`, `subtitle`, `delta`, `deltaType`, `staggerIndex`)

### Context

**KpiCard props** (from `src/app/components/ui/KpiCard.tsx`):
```ts
interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  subtitle?: string;
  staggerIndex?: number;
}
```

**Component props:**
```ts
{ rows: RestructuringInputRow[] }
```

`RestructuringInputRow` and `computeAllTemplates` are imported from `./restructuringEngine`.

**State:** `expandedId: TemplateId | null` — which template's detail accordion is open. `null` = none.

**Metric definitions:** A local `METRIC_DEFS` array drives both rows and the "best value" highlighting logic. Each metric specifies whether higher or lower is better.

**Table layout:**
- Rows = 5 metrics
- Columns = 7 templates (from `RESTRUCTURING_TEMPLATES`) + 1 "Default" column
- Default column: ECL Restructured = `eclBase`, ECL Relief = `$0.00M`, others = `"—"`

**"Best value" rule per metric:**
- NPV to Lessor: highest wins
- IRR: highest wins
- ECL Restructured: lowest wins
- ECL Relief: highest wins
- P95 Downside: lowest wins

**Colour conventions:**
- Best cell: `color: #15803D`, `background: rgba(21,128,61,0.06)`, `fontWeight: 600`
- ECL Relief > 0 (non-best): `color: #15803D`
- Default column: `color: #94A3B8`
- Alternating rows: odd = `#F8FAFC`, even = `#FFFFFF`
- Counterfactual banner: `background: #FEF2F2`, `border: 1px solid #FECACA`

- [ ] **Step 1: Create `RestructuringTab.tsx` with the complete implementation**

```tsx
// src/app/components/counterparties/RestructuringTab.tsx

import { useMemo, useState } from "react";
import { KpiCard } from "../ui/KpiCard";
import {
  RESTRUCTURING_TEMPLATES,
  RestructuringInputRow,
  RestructuringResult,
  TemplateId,
  computeAllTemplates,
} from "./restructuringEngine";

interface Props {
  rows: RestructuringInputRow[];
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function fmtM1(v: number) { return `$${v.toFixed(1)}M`; }
function fmtM2(v: number) { return `$${v.toFixed(2)}M`; }
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }

// ── Metric definitions ─────────────────────────────────────────────────────────

type MetricKey = keyof Pick<
  RestructuringResult,
  "npvToLessor" | "irr" | "eclRestructured" | "eclRelief" | "p95Downside"
>;

interface MetricDef {
  key: MetricKey;
  label: string;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

const METRIC_DEFS: MetricDef[] = [
  { key: "npvToLessor",     label: "NPV to Lessor ($M)",   format: fmtM1,  higherIsBetter: true  },
  { key: "irr",             label: "IRR (%)",               format: fmtPct, higherIsBetter: true  },
  { key: "eclRestructured", label: "ECL Restructured ($M)", format: fmtM2,  higherIsBetter: false },
  { key: "eclRelief",       label: "ECL Relief ($M)",       format: fmtM2,  higherIsBetter: true  },
  { key: "p95Downside",     label: "P95 Downside ($M)",     format: fmtM2,  higherIsBetter: false },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function RestructuringTab({ rows }: Props) {
  const [expandedId, setExpandedId] = useState<TemplateId | null>(null);

  const results = useMemo(() => computeAllTemplates(rows), [rows]);

  const eclBase = useMemo(
    () => rows.reduce((s, r) => s + r.eclLifetime, 0) / 1e6,
    [rows]
  );

  const bestNPV = results.reduce((best, r) =>
    r.npvToLessor > best.npvToLessor ? r : best, results[0]
  );
  const bestRelief = results.reduce((best, r) =>
    r.eclRelief > best.eclRelief ? r : best, results[0]
  );

  const counterfactualLoss = results[0]?.counterfactualLoss ?? 0;

  // Map templateId → result for O(1) lookup in render
  const resultMap = useMemo(
    () => new Map<TemplateId, RestructuringResult>(results.map((r) => [r.templateId, r])),
    [results]
  );

  // Per-metric best value (among the 7 templates, excluding Default)
  function bestValue(metric: MetricDef): number {
    const vals = results.map((r) => r[metric.key]);
    return metric.higherIsBetter ? Math.max(...vals) : Math.min(...vals);
  }

  function handleHeaderClick(id: TemplateId) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const expandedTemplate = expandedId
    ? RESTRUCTURING_TEMPLATES.find((t) => t.id === expandedId)
    : null;

  const bestNPVName = RESTRUCTURING_TEMPLATES.find((t) => t.id === bestNPV?.templateId)?.name;
  const bestReliefName = RESTRUCTURING_TEMPLATES.find((t) => t.id === bestRelief?.templateId)?.name;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI bar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Base ECL LT"
          value={fmtM2(eclBase)}
          staggerIndex={0}
        />
        <KpiCard
          label="Best NPV to Lessor"
          value={fmtM1(bestNPV?.npvToLessor ?? 0)}
          subtitle={bestNPVName}
          staggerIndex={1}
        />
        <KpiCard
          label="Max ECL Relief"
          value={fmtM2(bestRelief?.eclRelief ?? 0)}
          subtitle={bestReliefName}
          deltaType="positive"
          staggerIndex={2}
        />
      </div>

      {/* ── Comparison table ── */}
      <div style={{ overflowX: "auto", borderRadius: "0.5rem", border: "1px solid #E2E8F0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #E2E8F0", background: "#FFFFFF" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "0.625rem 0.75rem",
                  color: "#94A3B8",
                  fontWeight: 600,
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                }}
              >
                Metric
              </th>
              {RESTRUCTURING_TEMPLATES.map((tmpl) => (
                <th
                  key={tmpl.id}
                  onClick={() => handleHeaderClick(tmpl.id)}
                  title="Click to see template details"
                  style={{
                    padding: "0.625rem 0.75rem",
                    textAlign: "right",
                    cursor: "pointer",
                    color: expandedId === tmpl.id ? "#002147" : "#475569",
                    fontWeight: expandedId === tmpl.id ? 700 : 600,
                    fontSize: "0.6875rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    borderBottom: expandedId === tmpl.id ? "2px solid #002147" : "2px solid transparent",
                    transition: "color 120ms ease, border-color 120ms ease",
                  }}
                >
                  {tmpl.name}
                </th>
              ))}
              {/* Default (counterfactual) column header — not clickable */}
              <th
                style={{
                  padding: "0.625rem 0.75rem",
                  textAlign: "right",
                  color: "#94A3B8",
                  fontWeight: 600,
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}
              >
                Default
              </th>
            </tr>
          </thead>
          <tbody>
            {METRIC_DEFS.map((metric, rowIdx) => {
              const best = bestValue(metric);
              return (
                <tr
                  key={metric.key}
                  style={{
                    background: rowIdx % 2 === 0 ? "#F8FAFC" : "#FFFFFF",
                    borderBottom: "1px solid #E2E8F0",
                  }}
                >
                  <td
                    style={{
                      padding: "0.5rem 0.75rem",
                      color: "#0F172A",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {metric.label}
                  </td>

                  {RESTRUCTURING_TEMPLATES.map((tmpl) => {
                    const result = resultMap.get(tmpl.id);
                    const val = result ? result[metric.key] : 0;
                    const isBest = Math.abs(val - best) < 0.0001;
                    const isPositiveRelief = metric.key === "eclRelief" && val > 0;
                    return (
                      <td
                        key={tmpl.id}
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          color: isBest ? "#15803D" : isPositiveRelief ? "#15803D" : "#0F172A",
                          background: isBest ? "rgba(21,128,61,0.06)" : "transparent",
                          fontWeight: isBest ? 600 : 400,
                        }}
                      >
                        {metric.format(val)}
                      </td>
                    );
                  })}

                  {/* Default column */}
                  <td
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: "right",
                      color: "#94A3B8",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {metric.key === "eclRestructured"
                      ? fmtM2(eclBase)
                      : metric.key === "eclRelief"
                      ? "$0.00M"
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Template detail accordion ── */}
      {expandedTemplate && (
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #CBD5E1",
            borderRadius: "0.5rem",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
          }}
        >
          <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#002147" }}>
            {expandedTemplate.name}
          </div>
          <p style={{ fontSize: "0.8125rem", color: "#475569", margin: 0, lineHeight: 1.5 }}>
            {expandedTemplate.description}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginTop: "0.25rem",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#94A3B8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                Implementation
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#0F172A" }}>
                {expandedTemplate.implementationTimeline}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#94A3B8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                Conditions
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#0F172A" }}>
                {expandedTemplate.conditions}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Counterfactual default banner ── */}
      <div
        style={{
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          fontSize: "0.8125rem",
        }}
      >
        <span style={{ fontWeight: 600, color: "#B91C1C", whiteSpace: "nowrap" }}>
          Counterfactual — Immediate Default:
        </span>
        <span style={{ color: "#7F1D1D" }}>
          Expected loss ={" "}
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtM2(counterfactualLoss)}
          </strong>
          {" "}(total EAD × weighted-average LGD)
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles cleanly**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with zero TypeScript errors. If you see errors like "cannot find module" or "type X is not assignable to type Y", fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/counterparties/RestructuringTab.tsx
git commit -m "feat(f06): add RestructuringTab — comparison table, KPI bar, accordion detail"
```

---

## Task 3: Wire `RestructuringTab` into `LesseeProfilePanel`

**Files:**
- Modify: `src/app/components/counterparties/LesseeProfilePanel.tsx`
  - Line 1 — add `RestructuringInputRow` import from engine
  - Lines 9–10 — add `RestructuringTab` import (follow existing import pattern)
  - Line 667 — extend TABS constant
  - Lines 1342–1343 — add render conditional

### Context

`LesseeProfilePanel.tsx` is a large self-contained file (~1350 lines). All edits are additive — nothing existing is removed or restructured.

Current line 1 (imports):
```tsx
import { useState, useEffect } from "react";
```

Current lines 9–10:
```tsx
import { WatchlistTab } from "./WatchlistTab";
import { MitigationsTab } from "./MitigationsTab";
```

Current line 667:
```tsx
const TABS = ["Overview", "Leases", "ECL", "Timeline", "Scenarios", "Behaviour", "Watchlist", "Mitigations"] as const;
```

Current lines 1342–1343 (end of tab render block):
```tsx
        {activeTab === "Watchlist" && <WatchlistTab lesseeId={lesseeId} />}
        {activeTab === "Mitigations" && <MitigationsTab eclRows={eclRows} />}
```

The join from `LesseeLeaseRow[]` + `LesseeECLRow[]` → `RestructuringInputRow[]` is built inline in the render using `leases.find(l => l.id === ecl.leaseId)`. Both `leases` and `eclRows` are already destructured from `PROFILE_DATA[lesseeId]` at line 1292. The join only runs when the "Restructuring" tab is active (lazy conditional rendering), so no `useMemo` is needed.

- [ ] **Step 1: Add the `RestructuringInputRow` import and `RestructuringTab` import**

In `src/app/components/counterparties/LesseeProfilePanel.tsx`:

Change line 10 from:
```tsx
import { MitigationsTab } from "./MitigationsTab";
```
to:
```tsx
import { MitigationsTab } from "./MitigationsTab";
import { RestructuringTab } from "./RestructuringTab";
import type { RestructuringInputRow } from "./restructuringEngine";
```

- [ ] **Step 2: Extend the TABS constant**

Change line 667 from:
```tsx
const TABS = ["Overview", "Leases", "ECL", "Timeline", "Scenarios", "Behaviour", "Watchlist", "Mitigations"] as const;
```
to:
```tsx
const TABS = ["Overview", "Leases", "ECL", "Timeline", "Scenarios", "Behaviour", "Watchlist", "Mitigations", "Restructuring"] as const;
```

- [ ] **Step 3: Add the tab render conditional**

Change lines 1342–1343 from:
```tsx
        {activeTab === "Watchlist" && <WatchlistTab lesseeId={lesseeId} />}
        {activeTab === "Mitigations" && <MitigationsTab eclRows={eclRows} />}
```
to:
```tsx
        {activeTab === "Watchlist"      && <WatchlistTab lesseeId={lesseeId} />}
        {activeTab === "Mitigations"    && <MitigationsTab eclRows={eclRows} />}
        {activeTab === "Restructuring"  && (
          <RestructuringTab
            rows={eclRows.map((ecl): RestructuringInputRow => {
              const lease = leases.find((l) => l.id === ecl.leaseId)!;
              return {
                leaseId:       ecl.leaseId,
                aircraft:      ecl.aircraft,
                monthlyRentUSD: lease.monthlyRentUSD,
                leaseEnd:      lease.leaseEnd,
                ead:           ecl.ead,
                pdLifetime:    ecl.pdLifetime,
                lgd:           ecl.lgd,
                eclLifetime:   ecl.eclLifetime,
                stage:         ecl.stage,
              };
            })}
          />
        )}
```

- [ ] **Step 4: Run final build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npm run build 2>&1 | tail -8
```

Expected output:
```
✓ built in X.XXs
```

Zero TypeScript errors. Zero warnings about missing imports or unresolved types. If the build reports `Type 'string' is not assignable to type '"1" | "2" | "3"'` on the stage field, fix by casting: `stage: ecl.stage as "1" | "2" | "3"`.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/counterparties/LesseeProfilePanel.tsx
git commit -m "feat(f06): wire RestructuringTab as 9th tab in LesseeProfilePanel"
```

---

## Acceptance Verification

After all three tasks are committed and the build passes, manually verify in the browser (if running `npm run dev`):

1. Open any lessee profile (e.g., Aeromexico — highest Stage 3 ECL)
2. Confirm "Restructuring" appears as the 9th tab
3. Click "Restructuring" — KPI bar shows Base ECL LT, Best NPV, Max ECL Relief
4. Comparison table shows 7 template columns + Default column
5. "Term Extension" column shows **higher** NPV than "Payment Holiday" (more cash flows)
6. "Forgiveness" row shows NPV reduction ≈ totalEAD × 0.20 / 1e6 relative to Rate Reduction
7. Best cell per row is green-tinted; Default column is grey
8. Click a template column header → detail accordion expands below table
9. Click same header again → accordion collapses
10. Counterfactual banner is red-tinted at the bottom
11. Switch to Emirates (all Stage 1, low ECL) — ECL Relief values are smaller than Aeromexico's
12. `npm run build` still passes with zero errors
