# Sprint 12 F06 — Restructuring Simulator Design

## Goal

Add a "Restructuring" tab (9th tab) to `LesseeProfilePanel` that lets portfolio managers compare seven contractual restructuring templates side-by-side — showing NPV to lessor, IRR, restructured ECL, ECL relief, and P95 downside — against a counterfactual default benchmark, without leaving the lessee profile context.

---

## Background

Portfolio managers monitoring Stage 2/3 lessees must decide which restructuring action to offer — or whether to let the lessee default — before committing legal and operational resources. Today there is no in-app tool to quantify the financial trade-offs: NPV cost of a payment holiday vs. forgiveness vs. step-in. The simulator makes these trade-offs concrete in under 10 minutes.

**Target audience:** Portfolio managers selecting restructuring terms; risk analysts preparing workout memos; senior management reviewing ECL sensitivity before board sign-off.

---

## Architecture

### File changes

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/app/components/counterparties/restructuringEngine.ts` | Pure TS — 7 template definitions, NPV/IRR/ECL/P95 computations, counterfactual |
| **Create** | `src/app/components/counterparties/RestructuringTab.tsx` | React UI — KPI bar, side-by-side comparison table, template detail accordion |
| **Modify** | `src/app/components/counterparties/LesseeProfilePanel.tsx` | Add "Restructuring" as 9th tab; pass `eclRows` + `leases` to `RestructuringTab` |

---

## Signal Engine (`restructuringEngine.ts`)

### Types

```ts
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
  holidayMonths: number;      // months of zero rent at start of restructuring
  rentMultiplier: number;     // multiplier on monthly rent after holiday period (e.g. 0.85)
  eadReductionPct: number;    // % reduction applied to EAD for ECL calculation (e.g. 20)
  pdReductionPp: number;      // percentage-point reduction applied to pdLifetime (e.g. 8)
  termExtMonths: number;      // months added to remaining lease term
  eadWriteDownPct: number;    // immediate EAD write-down deducted from NPV (e.g. 20 for forgiveness)
  implementationTimeline: string;
  conditions: string;
}

export interface RestructuringInputRow {
  leaseId: string;
  aircraft: string;
  monthlyRentUSD: number;     // from LesseeLeaseRow
  leaseEnd: string;           // ISO date string
  ead: number;
  pdLifetime: number;
  lgd: number;
  eclLifetime: number;
  stage: "1" | "2" | "3";
}

export interface RestructuringResult {
  templateId: TemplateId;
  npvToLessor: number;        // $M — PV of restructured future cash flows minus write-downs
  irr: number;                // % annual — rate at which PV of rents = total EAD
  eclRestructured: number;    // $M — ECL under restructuring
  eclBase: number;            // $M — base ECL (no restructuring)
  eclRelief: number;          // $M — eclBase − eclRestructured (positive = improvement)
  p95Downside: number;        // $M — ECL under PD × 1.5 stress after template adjustments
  counterfactualLoss: number; // $M — expected loss on immediate default (totalEAD × lgdWA / 100)
}
```

### Seven templates

```ts
export const RESTRUCTURING_TEMPLATES: RestructuringTemplate[] = [
  {
    id: "paymentHoliday",
    name: "Payment Holiday",
    description: "Suspend rent for 3 months to provide short-term liquidity relief; normal payments resume immediately after.",
    holidayMonths: 3,
    rentMultiplier: 1.00,
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
    description: "Defer 6 months of rent obligations; deferred amounts remain due at lease end.",
    holidayMonths: 6,
    rentMultiplier: 1.00,
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
    description: "Convert fixed monthly rent to power-by-the-hour billing at 82% of contracted rate, reducing guaranteed exposure.",
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
    description: "Extend lease term 24 months at current rent, increasing total contracted cash flows and demonstrating lessee commitment.",
    holidayMonths: 0,
    rentMultiplier: 1.00,
    eadReductionPct: 0,
    pdReductionPp: 8,
    termExtMonths: 24,
    eadWriteDownPct: 0,
    implementationTimeline: "3–5 weeks; lease extension agreement; MAV re-appraisal recommended.",
    conditions: "Aircraft must remain within acceptable maintenance status; no open airworthiness directives.",
  },
  {
    id: "forgiveness",
    name: "Debt Forgiveness",
    description: "Forgive 20% of outstanding obligations in exchange for operational commitments, reducing EAD and PD materially.",
    holidayMonths: 0,
    rentMultiplier: 1.00,
    eadReductionPct: 20,
    pdReductionPp: 10,
    termExtMonths: 0,
    eadWriteDownPct: 20,
    implementationTimeline: "6–10 weeks; deed of release; board approval typically required.",
    conditions: "Lessor must receive binding operational commitments (route guarantees or maintenance covenants) in exchange.",
  },
  {
    id: "rateReduction",
    name: "Rate Reduction",
    description: "Reduce monthly rent by 15% for remaining lease term, improving lessee cash flow and reducing default probability.",
    holidayMonths: 0,
    rentMultiplier: 0.85,
    eadReductionPct: 0,
    pdReductionPp: 12,
    termExtMonths: 0,
    eadWriteDownPct: 0,
    implementationTimeline: "2–4 weeks; rate amendment letter; simple to execute.",
    conditions: "Rate reduction must be supported by current market comparables to avoid adverse IFRS 9 reclassification.",
  },
  {
    id: "hybrid",
    name: "Hybrid Package",
    description: "Combined package: 3-month holiday + 10% forgiveness + 15% rate reduction + 12-month extension — maximum distress relief.",
    holidayMonths: 3,
    rentMultiplier: 0.90,
    eadReductionPct: 10,
    pdReductionPp: 15,
    termExtMonths: 12,
    eadWriteDownPct: 10,
    implementationTimeline: "8–12 weeks; full restructuring agreement; legal counsel required.",
    conditions: "Reserved for imminent default scenarios where lessor prefers NPV of restructuring over repossession cost.",
  },
];
```

### Computation

**NPV per lease (monthly discounting at 8% p.a. = 0.6667%/month):**

```ts
const DISCOUNT_RATE_MONTHLY = 0.08 / 12;
const REF_DATE = new Date("2026-05-03");

function computeNPV(
  rows: RestructuringInputRow[],
  tmpl: RestructuringTemplate
): number {
  let totalNPV = 0;
  let totalEAD = 0;

  for (const r of rows) {
    const leaseEndDate = new Date(r.leaseEnd);
    const remainingMonths = Math.max(
      0,
      Math.round((leaseEndDate.getTime() - REF_DATE.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    );
    const totalMonths = remainingMonths + tmpl.termExtMonths;

    let leasePV = 0;
    for (let t = 1; t <= totalMonths; t++) {
      const cashflow =
        t <= tmpl.holidayMonths ? 0 : r.monthlyRentUSD * tmpl.rentMultiplier;
      leasePV += cashflow / Math.pow(1 + DISCOUNT_RATE_MONTHLY, t);
    }
    totalNPV += leasePV;
    totalEAD += r.ead;
  }

  // Subtract immediate EAD write-down (e.g. forgiveness)
  totalNPV -= totalEAD * (tmpl.eadWriteDownPct / 100);
  return totalNPV / 1e6; // return in $M
}
```

**IRR (annualised, bisection method):**

```ts
function computeIRR(rows: RestructuringInputRow[], tmpl: RestructuringTemplate): number {
  const totalEAD = rows.reduce((s, r) => s + r.ead, 0);

  // Build monthly cash flow array: [0] = −totalEAD, [1..n] = sum of monthly rents
  const maxMonths = Math.max(
    ...rows.map(r => {
      const leaseEndDate = new Date(r.leaseEnd);
      return Math.max(
        0,
        Math.round((leaseEndDate.getTime() - REF_DATE.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      ) + tmpl.termExtMonths;
    })
  );

  const cashflows: number[] = new Array(maxMonths + 1).fill(0);
  cashflows[0] = -totalEAD;

  for (const r of rows) {
    const leaseEndDate = new Date(r.leaseEnd);
    const remainingMonths = Math.max(
      0,
      Math.round((leaseEndDate.getTime() - REF_DATE.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    );
    const totalMonths = remainingMonths + tmpl.termExtMonths;
    for (let t = 1; t <= totalMonths; t++) {
      cashflows[t] += t <= tmpl.holidayMonths ? 0 : r.monthlyRentUSD * tmpl.rentMultiplier;
    }
  }

  // Subtract write-down from month 0
  cashflows[0] -= totalEAD * (tmpl.eadWriteDownPct / 100);

  // Bisection: find monthly rate r where NPV = 0
  let lo = 0, hi = 0.04;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const npv = cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + mid, t), 0);
    if (npv > 0) lo = mid; else hi = mid;
  }
  const monthlyIRR = (lo + hi) / 2;
  return (Math.pow(1 + monthlyIRR, 12) - 1) * 100; // annualised %
}
```

**ECL restructured (sum across all leases):**

```ts
function computeECLRestructured(rows: RestructuringInputRow[], tmpl: RestructuringTemplate): number {
  return rows.reduce((sum, r) => {
    const adjEAD = r.ead * (1 - tmpl.eadReductionPct / 100);
    const adjPD  = Math.max(0, r.pdLifetime - tmpl.pdReductionPp);
    return sum + (adjEAD * adjPD * r.lgd) / 10000;
  }, 0) / 1e6;
}
```

**P95 downside (PD stressed ×1.5 before template cut):**

```ts
function computeP95(rows: RestructuringInputRow[], tmpl: RestructuringTemplate): number {
  return rows.reduce((sum, r) => {
    const adjEAD   = r.ead * (1 - tmpl.eadReductionPct / 100);
    const stressedPD = Math.min(100, r.pdLifetime * 1.5);
    const adjPD    = Math.max(0, stressedPD - tmpl.pdReductionPp);
    return sum + (adjEAD * adjPD * r.lgd) / 10000;
  }, 0) / 1e6;
}
```

**Counterfactual (immediate default):**

```ts
function computeCounterfactual(rows: RestructuringInputRow[]): number {
  const totalEAD = rows.reduce((s, r) => s + r.ead, 0);
  const lgdWA = rows.reduce((s, r) => s + r.lgd * r.ead, 0) / totalEAD;
  return (totalEAD * lgdWA) / 100 / 1e6;
}
```

**Main export:**

```ts
export function computeAllTemplates(rows: RestructuringInputRow[]): RestructuringResult[] {
  const eclBase = rows.reduce((s, r) => s + r.eclLifetime, 0) / 1e6;
  const counterfactualLoss = computeCounterfactual(rows);

  return RESTRUCTURING_TEMPLATES.map(tmpl => ({
    templateId: tmpl.id,
    npvToLessor: computeNPV(rows, tmpl),
    irr: computeIRR(rows, tmpl),
    eclRestructured: computeECLRestructured(rows, tmpl),
    eclBase,
    eclRelief: eclBase - computeECLRestructured(rows, tmpl),
    p95Downside: computeP95(rows, tmpl),
    counterfactualLoss,
  }));
}
```

Exports: `RESTRUCTURING_TEMPLATES`, `RestructuringTemplate`, `TemplateId`, `RestructuringInputRow`, `RestructuringResult`, `computeAllTemplates`.

---

## RestructuringTab Component

**File:** `src/app/components/counterparties/RestructuringTab.tsx`

**Props:** `{ eclRows: LesseeECLRow[], leases: LesseeLeaseRow[] }`

Internal: build `RestructuringInputRow[]` by joining `leases` (for `monthlyRentUSD`, `leaseEnd`) with `eclRows` (for `ead`, `pdLifetime`, `lgd`, `eclLifetime`) on `leaseId`/`id`. Compute via `useMemo`.

### Layout (top → bottom)

**1. KPI bar (3 tiles)**
- Base ECL LT: sum of `eclLifetime` across all leases ($M)
- Best NPV: `max(results, r => r.npvToLessor)` — value + template name subtitle
- Max ECL Relief: `max(results, r => r.eclRelief)` — value in green + template name subtitle

**2. Comparison table (full width)**

Header row: `Metric | PayHol | Deferral | PBH | TermExt | Forgive | RateRed | Hybrid | Default`

Five data rows:
| Metric | Display |
|---|---|
| NPV to Lessor ($M) | `$X.XM` |
| IRR (%) | `X.X%` |
| ECL Restructured ($M) | `$X.XM` |
| ECL Relief ($M) | `$X.XM` in green when > 0 |
| P95 Downside ($M) | `$X.XM` |

- Best value per row (excluding Default column): `color: #15803D`, `background: rgba(21,128,61,0.06)`. "Best" defined per metric:
  - NPV to Lessor: **highest** (more cash to lessor is better)
  - IRR: **highest** (higher return is better)
  - ECL Restructured: **lowest** (less expected loss is better)
  - ECL Relief: **highest** (more relief is better)
  - P95 Downside: **lowest** (less stress loss is better)
- Default column: grey text `#94A3B8`; ECL Restructured = base ECL; ECL Relief = `$0.0M`; NPV/IRR/P95 = `—`; header is **not** clickable (no template detail to show)
- Template column headers (7 only) are clickable to expand template detail (see below)

**3. Template detail accordion (below table)**

Clicking a column header shows a detail strip beneath the table:
- Template name + category badge
- Description (full text)
- Implementation timeline
- Conditions
- One template visible at a time; click same header again to collapse

### Styling conventions

- Inline `style={{}}` — no CSS modules
- Oxford Blue `#002147` primary
- Selected column header: `color: #002147; fontWeight: 700; cursor: pointer`
- Default column header: `color: #94A3B8`
- Table cell padding: `0.5rem 0.75rem`
- Row alternating: odd rows `#F8FAFC`, even rows `#FFFFFF`

---

## LesseeProfilePanel Changes

**TABS constant:** Add `"Restructuring"` as 9th entry after `"Mitigations"`.

**Import:** `import { RestructuringTab } from "./RestructuringTab";`

**Render:** `{activeTab === "Restructuring" && <RestructuringTab eclRows={eclRows} leases={leases} />}`

No changes to PROFILE_DATA — all computation is in the engine.

---

## Success Criteria

1. `npm run build` zero errors
2. "Restructuring" tab visible for all 6 lessees
3. All 7 templates always show computed NPV, IRR, ECL, Relief, P95 in the table
4. Best value per row is highlighted green
5. Counterfactual default column always visible and grey
6. Term Extension shows *higher* NPV than base (more contracted cash flows)
7. Forgiveness shows NPV reduction equal to `totalEAD × 0.20 / 1e6`
8. Clicking column header expands/collapses template detail
9. Aeromexico (Stage 3, high ECL) shows larger absolute ECL relief than Emirates (Stage 1)
10. `useMemo` used to prevent re-running engine on every render

---

## Out of Scope

- User-adjustable template parameters
- Persisting selected template to localStorage or backend
- Applying restructured ECL back to portfolio totals or ECL tab
- PDF term-sheet stub
- More than 7 templates
- Approval workflow or audit trail for restructuring decisions
