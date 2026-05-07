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
  /**
   * Estimated months until cumulative restructured cash flows recover total adjusted EAD.
   * Accounts for holiday period and any EAD write-down; simple payback (undiscounted).
   */
  timeToRecovery: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCOUNT_RATE_MONTHLY = 0.08 / 12;
/** Valuation reference date — uses today's date so remaining-months calculations stay current */
const REF_DATE = new Date();

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
  if (rows.length === 0) return 0;
  const totalEAD = rows.reduce((s, r) => s + r.ead, 0);
  if (totalEAD === 0) return 0;

  const maxMonths = rows.reduce(
    (max, r) => Math.max(max, monthsRemaining(r.leaseEnd) + tmpl.termExtMonths),
    0
  );

  // cashflows[0] = initial lessor outflow (EAD invested + write-down); [1..n] = monthly inflows
  const cashflows: number[] = new Array(maxMonths + 1).fill(0);
  // Initial outflow = EAD invested + immediate write-down (e.g. 20% debt forgiveness adds to cost base)
  // This gives IRR as return on total capital at risk, consistent with NPV deducting the write-down.
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
      // Stress the base PD first (×1.5), then apply template relief on top of the stressed value.
      // Rationale: P95 tests whether restructuring still helps even under adverse conditions.
      const stressedPD = Math.min(100, r.pdLifetime * 1.5);
      const adjPD = Math.max(0, stressedPD - tmpl.pdReductionPp);
      return sum + (adjEAD * adjPD * r.lgd) / 10_000;
    }, 0) / 1e6
  );
}

/**
 * Simple undiscounted payback period:
 * holiday months + (adjusted EAD) / (avg monthly inflow after holiday).
 * Capped at 120 months to prevent ∞ on zero-rent templates.
 */
function computeTimeToRecovery(rows: RestructuringInputRow[], tmpl: RestructuringTemplate): number {
  const adjEAD        = rows.reduce((s, r) => s + r.ead * (1 - tmpl.eadWriteDownPct / 100), 0);
  const monthlyInflow = rows.reduce((s, r) => s + r.monthlyRentUSD * tmpl.rentMultiplier, 0);
  if (monthlyInflow <= 0) return 120;
  return Math.min(120, Math.round(tmpl.holidayMonths + adjEAD / monthlyInflow));
}

function computeCounterfactual(rows: RestructuringInputRow[]): number {
  const totalEAD = rows.reduce((s, r) => s + r.ead, 0);
  if (totalEAD === 0) return 0;
  const lgdWA = rows.reduce((s, r) => s + r.lgd * r.ead, 0) / totalEAD;
  return (totalEAD * lgdWA) / 100 / 1e6;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeAllTemplates(rows: RestructuringInputRow[]): RestructuringResult[] {
  if (rows.length === 0) return [];
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
      timeToRecovery: computeTimeToRecovery(rows, tmpl),
    };
  });
}
