import { useState, Fragment } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "../ui/Card";
import { KpiCard } from "../ui/KpiCard";
import { StatusPill } from "../ui/StatusPill";
import { MR_ADEQUACY, mrFlagColor, mrFlagBg, mrFlagBorder, TYPE_HEURISTICS, type MRAdeqFlag, type ComponentName } from "../../data/maintenanceHeuristics";
import { type CreditDepositTier } from "../../utils/creditDeposit";
import { mrNetRefund, totalMRBalance, refundableMRCapped, eolCompensation } from "../../utils/sdmrHelpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SDRecord {
  type: "Cash" | "LC";
  amount: number;
  currency: string;
  refundTriggers: string[];
  governingLaw: string;
}

export interface MRComponent {
  component: "Airframe HSI" | "Engine PR" | "LLPs" | "Landing Gear" | "APU";
  rateBasis: "$/FH" | "$/cycle";
  rateAmount: number;
  unitsAccumulated: number;
  cumulativeBalance: number;
  refundable: boolean;
  capRule: string;
  evidencedCost: number;
  fullIntervalUnits: number;
  remainingUnits: number;
}

export interface LeaseSDMR {
  leaseId: string;
  lessee: string;
  aircraft: string;
  eadNum: number;
  baseLGD: number;
  sd: SDRecord;
  mrComponents: MRComponent[];
  returnCondition: "half-life" | "full-life";
  /** Populated by buildLiveSDMRData — absent in the static demo dataset */
  leaseEnd?: string;
  stage?: number;
  /** Credit tier derived from lessee watchlist_status */
  creditTier?: CreditDepositTier;
}

// ─── Minimal structural types for live portfolio data ─────────────────────────

type PAAsset = { id: string; msn: string; type: string; vintage?: number };
type PALessee = { id: string; name: string; country?: string; watchlist_status?: "green" | "amber" | "red" | null };
type PALease  = { id: string; asset_id: string; lessee_id: string; start_date?: string | null; end_date?: string | null; monthly_rental?: number | null };
type PAProvision = { asset_id: string; ead?: number | null; lgd_rate?: number | null; stage?: number | null };

// ─── Synthetic Dataset ────────────────────────────────────────────────────────

export const sdmrData: LeaseSDMR[] = [
  {
    leaseId: "LSE-2019-001",
    lessee: "IndiGo Airlines",
    aircraft: "A320neo",
    eadNum: 24.2,
    baseLGD: 54,
    sd: {
      type: "Cash",
      amount: 1_710_000,
      currency: "USD",
      refundTriggers: [
        "No payment default in preceding 12 months",
        "Aircraft returned per agreed maintenance return conditions",
        "All outstanding maintenance claims settled at return",
      ],
      governingLaw: "Ireland — Cape Town Convention",
    },
    mrComponents: [
      { component: "Airframe HSI", rateBasis: "$/FH", rateAmount: 420, unitsAccumulated: 21_350, cumulativeBalance: 8_967_000, refundable: true, capRule: "Max 18 months' contributions", evidencedCost: 7_200_000, fullIntervalUnits: 36_000, remainingUnits: 6_200 },
      { component: "Engine PR", rateBasis: "$/FH", rateAmount: 310, unitsAccumulated: 21_350, cumulativeBalance: 6_618_500, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 5_400_000, fullIntervalUnits: 20_000, remainingUnits: 3_100 },
      { component: "LLPs", rateBasis: "$/cycle", rateAmount: 90, unitsAccumulated: 14_200, cumulativeBalance: 1_278_000, refundable: false, capRule: "Non-refundable — lessor retains", evidencedCost: 0, fullIntervalUnits: 20_000, remainingUnits: 5_800 },
      { component: "Landing Gear", rateBasis: "$/FH", rateAmount: 62, unitsAccumulated: 21_350, cumulativeBalance: 1_323_700, refundable: true, capRule: "Max 24 months' contributions", evidencedCost: 1_200_000, fullIntervalUnits: 60_000, remainingUnits: 22_400 },
      { component: "APU", rateBasis: "$/FH", rateAmount: 38, unitsAccumulated: 21_350, cumulativeBalance: 811_300, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 650_000, fullIntervalUnits: 25_000, remainingUnits: 4_900 },
    ],
    returnCondition: "half-life",
  },
  {
    leaseId: "LSE-2020-014",
    lessee: "Aeromexico",
    aircraft: "B737-800",
    eadNum: 32.1,
    baseLGD: 58,
    sd: {
      type: "LC",
      amount: 1_860_000,
      currency: "USD",
      refundTriggers: [
        "No Chapter 11 or insolvency filing in preceding 24 months",
        "Aircraft returned in agreed maintenance condition",
        "Letter of Credit not drawn upon during lease term",
      ],
      governingLaw: "New York — US UCC Article 2A",
    },
    mrComponents: [
      { component: "Airframe HSI", rateBasis: "$/FH", rateAmount: 360, unitsAccumulated: 20_300, cumulativeBalance: 7_308_000, refundable: true, capRule: "Max 18 months' contributions", evidencedCost: 5_900_000, fullIntervalUnits: 32_000, remainingUnits: 4_800 },
      { component: "Engine PR", rateBasis: "$/FH", rateAmount: 260, unitsAccumulated: 20_300, cumulativeBalance: 5_278_000, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 4_100_000, fullIntervalUnits: 18_000, remainingUnits: 2_600 },
      { component: "LLPs", rateBasis: "$/cycle", rateAmount: 78, unitsAccumulated: 16_000, cumulativeBalance: 1_248_000, refundable: false, capRule: "Non-refundable — lessor retains", evidencedCost: 0, fullIntervalUnits: 20_000, remainingUnits: 4_000 },
      { component: "Landing Gear", rateBasis: "$/FH", rateAmount: 56, unitsAccumulated: 20_300, cumulativeBalance: 1_136_800, refundable: true, capRule: "Max 24 months' contributions", evidencedCost: 900_000, fullIntervalUnits: 55_000, remainingUnits: 18_600 },
      { component: "APU", rateBasis: "$/FH", rateAmount: 32, unitsAccumulated: 20_300, cumulativeBalance: 649_600, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 520_000, fullIntervalUnits: 23_000, remainingUnits: 4_200 },
    ],
    returnCondition: "half-life",
  },
  {
    leaseId: "LSE-2021-022",
    lessee: "Emirates",
    aircraft: "B777-300ER",
    eadNum: 88.4,
    baseLGD: 28,
    sd: {
      type: "Cash",
      amount: 1_240_000,
      currency: "USD",
      refundTriggers: [
        "Lease expires without payment default",
        "Aircraft redelivered in full-life condition",
      ],
      governingLaw: "England & Wales — Cape Town Convention",
    },
    mrComponents: [
      { component: "Airframe HSI", rateBasis: "$/FH", rateAmount: 610, unitsAccumulated: 26_500, cumulativeBalance: 16_165_000, refundable: true, capRule: "Max 18 months' contributions", evidencedCost: 14_800_000, fullIntervalUnits: 48_000, remainingUnits: 21_500 },
      { component: "Engine PR", rateBasis: "$/FH", rateAmount: 680, unitsAccumulated: 26_500, cumulativeBalance: 18_020_000, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 16_200_000, fullIntervalUnits: 22_000, remainingUnits: 9_800 },
      { component: "LLPs", rateBasis: "$/cycle", rateAmount: 165, unitsAccumulated: 7_400, cumulativeBalance: 1_221_000, refundable: false, capRule: "Non-refundable — lessor retains", evidencedCost: 0, fullIntervalUnits: 15_000, remainingUnits: 7_600 },
      { component: "Landing Gear", rateBasis: "$/FH", rateAmount: 125, unitsAccumulated: 26_500, cumulativeBalance: 3_312_500, refundable: true, capRule: "Max 24 months' contributions", evidencedCost: 3_100_000, fullIntervalUnits: 70_000, remainingUnits: 43_500 },
      { component: "APU", rateBasis: "$/FH", rateAmount: 58, unitsAccumulated: 26_500, cumulativeBalance: 1_537_000, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 1_400_000, fullIntervalUnits: 28_000, remainingUnits: 14_200 },
    ],
    returnCondition: "full-life",
  },
  {
    leaseId: "LSE-2020-031",
    lessee: "SriLankan Airlines",
    aircraft: "A330-300",
    eadNum: 34.2,
    baseLGD: 52,
    sd: {
      type: "Cash",
      amount: 1_440_000,
      currency: "USD",
      refundTriggers: [
        "No payment default in preceding 12 months",
        "Aircraft returned with maintenance reserves current",
        "No outstanding lessor indemnity claims",
      ],
      governingLaw: "Ireland — Cape Town Convention",
    },
    mrComponents: [
      { component: "Airframe HSI", rateBasis: "$/FH", rateAmount: 530, unitsAccumulated: 28_000, cumulativeBalance: 14_840_000, refundable: true, capRule: "Max 18 months' contributions", evidencedCost: 11_200_000, fullIntervalUnits: 40_000, remainingUnits: 7_400 },
      { component: "Engine PR", rateBasis: "$/FH", rateAmount: 540, unitsAccumulated: 28_000, cumulativeBalance: 15_120_000, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 12_000_000, fullIntervalUnits: 20_000, remainingUnits: 4_600 },
      { component: "LLPs", rateBasis: "$/cycle", rateAmount: 128, unitsAccumulated: 9_000, cumulativeBalance: 1_152_000, refundable: false, capRule: "Non-refundable — lessor retains", evidencedCost: 0, fullIntervalUnits: 18_000, remainingUnits: 9_000 },
      { component: "Landing Gear", rateBasis: "$/FH", rateAmount: 105, unitsAccumulated: 28_000, cumulativeBalance: 2_940_000, refundable: true, capRule: "Max 24 months' contributions", evidencedCost: 2_600_000, fullIntervalUnits: 60_000, remainingUnits: 32_000 },
      { component: "APU", rateBasis: "$/FH", rateAmount: 52, unitsAccumulated: 28_000, cumulativeBalance: 1_456_000, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 1_200_000, fullIntervalUnits: 25_000, remainingUnits: 9_800 },
    ],
    returnCondition: "half-life",
  },
  {
    leaseId: "LSE-2022-009",
    lessee: "Ryanair",
    aircraft: "B737 MAX 8",
    eadNum: 44.7,
    baseLGD: 18,
    sd: {
      type: "LC",
      amount: 340_000,
      currency: "USD",
      refundTriggers: [
        "Lease expires at scheduled end date",
        "No draw events during lease term",
      ],
      governingLaw: "Ireland — Cape Town Convention",
    },
    mrComponents: [
      { component: "Airframe HSI", rateBasis: "$/FH", rateAmount: 385, unitsAccumulated: 10_500, cumulativeBalance: 4_042_500, refundable: true, capRule: "Max 18 months' contributions", evidencedCost: 3_800_000, fullIntervalUnits: 36_000, remainingUnits: 25_500 },
      { component: "Engine PR", rateBasis: "$/FH", rateAmount: 300, unitsAccumulated: 10_500, cumulativeBalance: 3_150_000, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 2_900_000, fullIntervalUnits: 20_000, remainingUnits: 14_200 },
      { component: "LLPs", rateBasis: "$/cycle", rateAmount: 80, unitsAccumulated: 8_400, cumulativeBalance: 672_000, refundable: false, capRule: "Non-refundable — lessor retains", evidencedCost: 0, fullIntervalUnits: 20_000, remainingUnits: 11_600 },
      { component: "Landing Gear", rateBasis: "$/FH", rateAmount: 59, unitsAccumulated: 10_500, cumulativeBalance: 619_500, refundable: true, capRule: "Max 24 months' contributions", evidencedCost: 580_000, fullIntervalUnits: 55_000, remainingUnits: 44_500 },
      { component: "APU", rateBasis: "$/FH", rateAmount: 33, unitsAccumulated: 10_500, cumulativeBalance: 346_500, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 310_000, fullIntervalUnits: 23_000, remainingUnits: 16_800 },
    ],
    returnCondition: "full-life",
  },
  {
    leaseId: "LSE-2018-047",
    lessee: "Air France",
    aircraft: "A350-900",
    eadNum: 68.3,
    baseLGD: 22,
    sd: {
      type: "Cash",
      amount: 960_000,
      currency: "USD",
      refundTriggers: [
        "Lease expires at scheduled end date without default",
        "Aircraft redelivered in agreed condition",
      ],
      governingLaw: "France — Cape Town Convention (Alt A declared)",
    },
    mrComponents: [
      { component: "Airframe HSI", rateBasis: "$/FH", rateAmount: 590, unitsAccumulated: 39_000, cumulativeBalance: 23_010_000, refundable: true, capRule: "Max 18 months' contributions", evidencedCost: 21_000_000, fullIntervalUnits: 48_000, remainingUnits: 16_200 },
      { component: "Engine PR", rateBasis: "$/FH", rateAmount: 640, unitsAccumulated: 39_000, cumulativeBalance: 24_960_000, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 22_500_000, fullIntervalUnits: 25_000, remainingUnits: 11_400 },
      { component: "LLPs", rateBasis: "$/cycle", rateAmount: 145, unitsAccumulated: 10_400, cumulativeBalance: 1_508_000, refundable: false, capRule: "Non-refundable — lessor retains", evidencedCost: 0, fullIntervalUnits: 18_000, remainingUnits: 7_600 },
      { component: "Landing Gear", rateBasis: "$/FH", rateAmount: 112, unitsAccumulated: 39_000, cumulativeBalance: 4_368_000, refundable: true, capRule: "Max 24 months' contributions", evidencedCost: 4_100_000, fullIntervalUnits: 70_000, remainingUnits: 38_400 },
      { component: "APU", rateBasis: "$/FH", rateAmount: 54, unitsAccumulated: 39_000, cumulativeBalance: 2_106_000, refundable: true, capRule: "Max 12 months' contributions", evidencedCost: 1_900_000, fullIntervalUnits: 28_000, remainingUnits: 13_600 },
    ],
    returnCondition: "full-life",
  },
];

// ─── Credit Tier Pill Constants ──────────────────────────────────────────────

const SDMR_TIER_LABEL: Record<CreditDepositTier, string> = {
  investmentGrade:    "IG",
  subInvestmentGrade: "Sub-IG",
  distressed:         "Distressed",
};

const SDMR_TIER_BG: Record<CreditDepositTier, string> = {
  investmentGrade:    "#DCFCE7",
  subInvestmentGrade: "#FEF3C7",
  distressed:         "#FEE2E2",
};

const SDMR_TIER_COLOR: Record<CreditDepositTier, string> = {
  investmentGrade:    "#15803D",
  subInvestmentGrade: "#B45309",
  distressed:         "#B91C1C",
};

// ─── Static Credit Tier Mapping ───────────────────────────────────────────────

const STATIC_CREDIT_TIER: Record<string, CreditDepositTier> = {
  "IndiGo Airlines":    "subInvestmentGrade",
  "Aeromexico":         "subInvestmentGrade",
  "Emirates":           "investmentGrade",
  "SriLankan Airlines": "distressed",
  "Ryanair":            "investmentGrade",
  "Air France":         "investmentGrade",
};
// Apply credit tiers to static data after definition
sdmrData.forEach((r) => { r.creditTier = STATIC_CREDIT_TIER[r.lessee] ?? "subInvestmentGrade"; });

// ─── Live data adapter ────────────────────────────────────────────────────────

const _COMPONENT_NAMES: ComponentName[] = ["Airframe HSI", "Engine PR", "LLPs", "Landing Gear", "APU"];
const _NOW = new Date(2026, 4, 1);
const _FALLBACK_TYPE = "A320neo";

function _monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function _tierFromWatchlist(w: "green" | "amber" | "red" | null | undefined): CreditDepositTier {
  if (w === "green") return "investmentGrade";
  if (w === "red")   return "distressed";
  return "subInvestmentGrade";
}

/** Build heuristic-estimated LeaseSDMR records from live portfolio data.
 *  MR rates come from TYPE_HEURISTICS; SD amount estimated at 1× monthly rent.
 *  Values are labelled as heuristic in the UI disclaimer. */
// ── T-1.4 consumer wire — optional ingested SD/MR overrides ───────────────
// When the tenant has uploaded the canonical workbook, real per-lease deposit
// and per-component reserve rows live in supabase. Pass them through here
// keyed by lease_id and we'll override the heuristic-derived values.

interface RealSdRow {
  deposit_amount_usd?: number | null;
  deposit_months?: number | null;
  type?: string | null;
  credit_tier?: string | null;
}
interface RealMrRow {
  component: string;
  rate_basis?: string | null;
  rate_usd?: number | null;
  est_annual_units?: number | null;
  annual_accrual_usd?: number | null;
  cumulative_balance_usd?: number | null;
  refundable?: boolean | null;
}

export function buildLiveSDMRData(
  assets: PAAsset[],
  lessees: PALessee[],
  leases: PALease[],
  provisions: PAProvision[],
  realDeposits?: Map<string, RealSdRow>,
  realReserves?: Map<string, RealMrRow[]>,
): LeaseSDMR[] {
  const lesseeById = new Map(lessees.map((l) => [l.id, l]));
  const assetById  = new Map(assets.map((a) => [a.id, a]));

  const eadByAsset   = new Map<string, number>();
  const lgdByAsset   = new Map<string, number>();
  const stageByAsset = new Map<string, number>();
  for (const p of provisions) {
    eadByAsset.set(p.asset_id, (eadByAsset.get(p.asset_id) ?? 0) + (p.ead ?? 0));
    if (p.lgd_rate != null) lgdByAsset.set(p.asset_id, p.lgd_rate);
    if (p.stage    != null) stageByAsset.set(p.asset_id, p.stage);
  }

  return leases
    .filter((l) => assetById.has(l.asset_id) && lesseeById.has(l.lessee_id))
    .map((lease): LeaseSDMR => {
      const asset   = assetById.get(lease.asset_id)!;
      const lessee  = lesseeById.get(lease.lessee_id)!;
      const ead     = (eadByAsset.get(lease.asset_id) ?? 0) / 1_000_000;
      const lgdRate = lgdByAsset.get(lease.asset_id) ?? 0.45;
      const stage   = stageByAsset.get(lease.asset_id) ?? 1;

      const startDate    = lease.start_date ? new Date(lease.start_date) : new Date(_NOW.getFullYear() - 4, 0, 1);
      const elapsedMonths = Math.max(0, _monthsBetween(startDate, _NOW));

      const heuristic = TYPE_HEURISTICS[asset.type] ?? TYPE_HEURISTICS[_FALLBACK_TYPE];
      const monthlyFH = heuristic.utilizationFH / 12;
      const monthlyCy = heuristic.utilizationCy / 12;
      const totalFH   = elapsedMonths * monthlyFH;
      const totalCy   = elapsedMonths * monthlyCy;

      // Pull ingested overrides for this lease, if present.
      const realSd = realDeposits?.get(lease.id);
      const realMr = realReserves?.get(lease.id);
      const realMrByComponent = new Map<string, RealMrRow>();
      for (const r of realMr ?? []) realMrByComponent.set(r.component, r);

      const mrComponents: MRComponent[] = _COMPONENT_NAMES.map((name): MRComponent => {
        const h           = heuristic.components[name];
        const isCycle     = h.basis === "cycle";
        const interval    = isCycle ? h.intervalCy : h.intervalFH;
        const rateAmount  = Math.round(h.costUSD / interval);
        const accumulated = Math.round(isCycle ? totalCy : totalFH);
        const posInInterval = accumulated % interval;
        const remaining   = interval - posInInterval;
        const balance     = rateAmount * accumulated;

        const capRule = isCycle
          ? "Non-refundable — lessor retains"
          : name === "Landing Gear"
          ? "Max 24 months' contributions"
          : name === "Airframe HSI"
          ? "Max 18 months' contributions"
          : "Max 12 months' contributions";

        // Real-ingested values take precedence over heuristic. When the
        // tenant uploaded a workbook with real MR rows, use them; otherwise
        // fall back to the heuristic-derived numbers.
        const realComp = realMrByComponent.get(name);
        const finalRateAmount  = realComp?.rate_usd                ?? rateAmount;
        const finalUnits       = realComp?.est_annual_units        ?? accumulated;
        const finalBalance     = realComp?.cumulative_balance_usd  ?? balance;
        const finalRefundable  = realComp?.refundable              ?? !isCycle;

        return {
          component:         name,
          rateBasis:         isCycle ? "$/cycle" : "$/FH",
          rateAmount:        finalRateAmount,
          unitsAccumulated:  finalUnits,
          cumulativeBalance: finalBalance,
          refundable:        finalRefundable,
          capRule,
          evidencedCost:     !isCycle ? Math.round(h.costUSD * 0.88) : 0,
          fullIntervalUnits: interval,
          remainingUnits:    remaining,
        };
      });

      return {
        leaseId:         lease.id,
        lessee:          lessee.name,
        aircraft:        asset.type,
        eadNum:          Math.max(ead, 0),
        baseLGD:         Math.round(lgdRate * 100),
        sd: {
          // Real-ingested security deposit wins over heuristic when present.
          type:           (realSd?.type === "LC" ? "LC" : "Cash") as "Cash" | "LC",
          amount:         realSd?.deposit_amount_usd
                          ?? Math.round((lease.monthly_rental ?? 0) * 1),
          currency:       "USD",
          refundTriggers: [
            "No payment default in preceding 12 months",
            "Aircraft returned per agreed maintenance return conditions",
            "All outstanding maintenance claims settled at return",
          ],
          governingLaw:   lessee.country
            ? `${lessee.country} — Cape Town Convention`
            : "Ireland — Cape Town Convention",
        },
        mrComponents,
        returnCondition: "half-life",
        leaseEnd:        lease.end_date ?? undefined,
        stage,
        creditTier:      _tierFromWatchlist(lessee.watchlist_status),
      };
    });
}

// ─── Computed Functions ───────────────────────────────────────────────────────

function nonRefundableMR(lease: LeaseSDMR): number {
  return lease.mrComponents
    .filter((c) => !c.refundable)
    .reduce((s, c) => s + c.cumulativeBalance, 0);
}

function conservativeOffset(lease: LeaseSDMR): number {
  return (lease.sd.amount + nonRefundableMR(lease)) / (lease.eadNum * 1_000_000);
}

function optimisticOffset(lease: LeaseSDMR): number {
  return (lease.sd.amount + nonRefundableMR(lease) + refundableMRCapped(lease)) / (lease.eadNum * 1_000_000);
}

function adjustedLGD(lease: LeaseSDMR): number {
  return Math.max(0, lease.baseLGD - conservativeOffset(lease) * 100);
}

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtUnits(n: number, basis: "$/FH" | "$/cycle"): string {
  return basis === "$/FH" ? `${(n / 1000).toFixed(1)}k FH` : `${(n / 1000).toFixed(1)}k cy`;
}

// ─── Expanded Panel ───────────────────────────────────────────────────────────

function ExpandedPanel({ lease, condition }: { lease: LeaseSDMR; condition: "half-life" | "full-life" }) {
  const conservOff = conservativeOffset(lease);
  const optOff = optimisticOffset(lease);
  const adjLGD = adjustedLGD(lease);

  return (
    <div style={{ padding: "1.25rem", display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "1.25rem", alignItems: "start" }}>

      {/* Left: Security Deposit card */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>Security Deposit</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
          <span style={{
            fontSize: "0.8125rem", fontWeight: 700, padding: "0.25rem 0.75rem", borderRadius: "9999px",
            background: lease.sd.type === "Cash" ? "rgba(3,105,161,0.08)" : "rgba(124,58,237,0.08)",
            color: lease.sd.type === "Cash" ? "#0369A1" : "#7C3AED",
            border: `1px solid ${lease.sd.type === "Cash" ? "rgba(3,105,161,0.2)" : "rgba(124,58,237,0.2)"}`,
          }}>
            {lease.sd.type === "LC" ? "Letter of Credit" : "Cash"}
          </span>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>{fmtUSD(lease.sd.amount)}</span>
          <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{lease.sd.currency}</span>
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.375rem" }}>Refund Triggers</div>
          <ul style={{ margin: 0, paddingLeft: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {lease.sd.refundTriggers.map((t, i) => (
              <li key={i} style={{ fontSize: "0.8125rem", color: "#334155", lineHeight: 1.5 }}>{t}</li>
            ))}
          </ul>
        </div>

        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.25rem" }}>Governing Law</div>
          <div style={{ fontSize: "0.8125rem", color: "#475569" }}>{lease.sd.governingLaw}</div>
        </div>
      </div>

      {/* Centre: MR Ledger */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E2E8F0", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          MR Ledger by Component
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              {["Component", "Rate", "Basis", "Accumulated", "Balance", "Refund Cap Test", "Refundable"].map((h) => (
                <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lease.mrComponents.map((comp, i) => {
              const netRefund = mrNetRefund(comp);
              return (
                <tr key={comp.component} style={{ borderTop: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>{comp.component}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0F172A" }}>${comp.rateAmount.toLocaleString()}</td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontSize: "0.75rem" }}>{comp.rateBasis}</td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{fmtUnits(comp.unitsAccumulated, comp.rateBasis)}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(comp.cumulativeBalance)}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums" }}>
                    {comp.refundable ? (
                      <span style={{ color: netRefund < comp.cumulativeBalance ? "#B45309" : "#15803D", fontWeight: 500 }}>
                        {fmtUSD(netRefund)}
                        {netRefund < comp.cumulativeBalance && (
                          <span style={{ fontSize: "0.6875rem", color: "#94A3B8", marginLeft: "0.25rem" }}>(capped)</span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>N/A</span>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    <StatusPill stage={comp.refundable ? "green" : "neutral"} label={comp.refundable ? "Yes" : "No"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F4F5F7" }}>
              <td colSpan={4} style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem" }}>Total</td>
              <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: "#002147", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(totalMRBalance(lease))}</td>
              <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: "#15803D", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(refundableMRCapped(lease))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <div style={{ padding: "0.5rem 0.75rem", borderTop: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#94A3B8" }}>
          Cap rule: refund = min(MR paid net of refunds, evidenced maintenance cost)
        </div>
      </div>

      {/* Right: LGD Offset Breakdown */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>LGD Offset Breakdown</div>
        {[
          { label: "Security Deposit", value: fmtUSD(lease.sd.amount), note: "Full recovery assumed", color: "#0369A1" },
          { label: "Non-refundable MR", value: fmtUSD(nonRefundableMR(lease)), note: "Lessor retains in default", color: "#002147" },
          { label: "Refundable MR (capped)", value: fmtUSD(refundableMRCapped(lease)), note: "Conditional on evidence", color: "#B45309" },
        ].map(({ label, value, note, color }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.625rem", paddingBottom: "0.625rem", borderBottom: "1px solid #F1F5F9" }}>
            <div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color }}>{label}</div>
              <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{note}</div>
            </div>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
          {[
            { label: "Base LGD", value: `${lease.baseLGD}%`, sub: "ECL dataset", dim: true },
            { label: "Adj. LGD", value: `${adjLGD.toFixed(1)}%`, sub: "Conservative", dim: false },
            { label: "Conservative offset", value: `${(conservOff * 100).toFixed(1)} pp`, sub: "SD + non-ref MR", dim: false },
            { label: "Optimistic offset", value: `${(optOff * 100).toFixed(1)} pp`, sub: "SD + all MR", dim: false },
          ].map(({ label, value, sub, dim }) => (
            <div key={label} style={{ background: dim ? "#F8FAFC" : "rgba(0,33,71,0.04)", borderRadius: "0.5rem", padding: "0.5rem 0.625rem" }}>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: dim ? "#94A3B8" : "#002147", fontVariantNumeric: "tabular-nums" }}>{value}</div>
              <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{sub}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "0.875rem", paddingTop: "0.75rem", borderTop: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.375rem" }}>
            EOL Compensation ({condition === "half-life" ? "½ Life" : "Full Life"} return)
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: eolCompensation(lease, condition) > 0 ? "#B91C1C" : "#15803D", fontVariantNumeric: "tabular-nums" }}>
            {eolCompensation(lease, condition) > 0 ? `+${fmtUSD(eolCompensation(lease, condition))}` : "—"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
            {eolCompensation(lease, condition) > 0 ? "Lessee owes lessor at redelivery" : "No compensation required"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SDMRTab({ data }: { data?: LeaseSDMR[] }) {
  const displayData = data ?? sdmrData;
  const isLive = Boolean(data);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Conditions keyed by leaseId; live leases fall back to lease.returnCondition on first render
  const [conditions, setConditions] = useState<Record<string, "half-life" | "full-life">>(
    Object.fromEntries(sdmrData.map((l) => [l.leaseId, l.returnCondition]))
  );

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCondition(id: string, current: "half-life" | "full-life") {
    setConditions((prev) => ({
      ...prev,
      [id]: current === "half-life" ? "full-life" : "half-life",
    }));
  }

  const totalSD = displayData.reduce((s, l) => s + l.sd.amount, 0);
  const totalMR = displayData.reduce((s, l) => s + totalMRBalance(l), 0);
  const totalEAD = displayData.reduce((a, x) => a + x.eadNum, 0);
  const wtdLGDReduction = displayData.reduce((s, l) => {
    const w = l.eadNum / totalEAD;
    return s + (l.baseLGD - adjustedLGD(l)) * w;
  }, 0);

  // ── Portfolio MR adequacy summary ──────────────────────────────────────────
  // In live mode MR_ADEQUACY keys won't match live leaseIds, so flag is derived directly from projections
  const shortfallLeases = displayData.filter((l) => {
    const a = MR_ADEQUACY[l.leaseId];
    return a && a.eolShortfall > 0;
  });
  const totalShortfall = shortfallLeases.reduce((s, l) => s + (MR_ADEQUACY[l.leaseId]?.eolShortfall ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* MR Adequacy Portfolio Alert */}
      {shortfallLeases.length > 0 && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "0.875rem",
          background: "rgba(180,83,9,0.06)", border: "1px solid rgba(180,83,9,0.2)",
          borderLeft: "3px solid #B45309", borderRadius: "0.625rem", padding: "0.875rem 1.25rem",
        }}>
          <AlertTriangle size={16} style={{ color: "#92400E", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#92400E", marginBottom: "0.125rem" }}>
              {shortfallLeases.length} lease{shortfallLeases.length > 1 ? "s have" : " has"} projected MR shortfall at EOL — Total exposure: {fmtUSD(totalShortfall)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#B45309" }}>
              {shortfallLeases.map((l) => `${l.lessee} (${fmtUSD(MR_ADEQUACY[l.leaseId]?.eolShortfall ?? 0)} shortfall)`).join(" · ")}
            </div>
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard label="Total SD Posted" value={fmtUSD(totalSD)} subtitle={`Across ${displayData.length} active lease${displayData.length !== 1 ? "s" : ""}`} />
        <KpiCard label="Total MR Reserves" value={fmtUSD(totalMR)} subtitle="Cumulative balances held" />
        <KpiCard label="Wtd Avg LGD Reduction" value={`${wtdLGDReduction.toFixed(1)} pp`} subtitle="Conservative offset applied" deltaType="positive" />
      </div>

      {/* Accordion Table */}
      <Card title="Security Deposit & Maintenance Reserve Register" noPadding>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                {["Lease ID", "Lessee", "Aircraft", "SD Type", "SD Amount", "MR Balance", "MR Adequacy", "Return Condition", "EOL Compensation", "LGD Offset", "Credit Tier", "Expand"].map((h) => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((lease, i) => {
                const cond = conditions[lease.leaseId] ?? lease.returnCondition;
                const isOpen = expanded.has(lease.leaseId);
                const eol = eolCompensation(lease, cond);
                const lgdOff = conservativeOffset(lease) * 100;
                const optOff = optimisticOffset(lease) * 100;
                return (
                  <Fragment key={lease.leaseId}>
                    <tr
                      style={{ borderBottom: isOpen ? "none" : "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7", cursor: "pointer" }}
                      onClick={() => toggleExpand(lease.leaseId)}
                    >
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>{lease.leaseId}</td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{lease.lessee}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{lease.aircraft}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{
                          fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "0.5rem",
                          background: lease.sd.type === "Cash" ? "rgba(3,105,161,0.08)" : "rgba(124,58,237,0.08)",
                          color: lease.sd.type === "Cash" ? "#0369A1" : "#7C3AED",
                          border: `1px solid ${lease.sd.type === "Cash" ? "rgba(3,105,161,0.2)" : "rgba(124,58,237,0.2)"}`,
                        }}>
                          {lease.sd.type}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 500, color: "#0F172A" }}>{fmtUSD(lease.sd.amount)}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>{fmtUSD(totalMRBalance(lease))}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        {(() => {
                          const adeq = MR_ADEQUACY[lease.leaseId];
                          if (!adeq) return <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>—</span>;
                          const flag = adeq.flag as MRAdeqFlag;
                          return (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: "0.25rem",
                              fontSize: "0.6875rem", fontWeight: 700,
                              background: mrFlagBg(flag), color: mrFlagColor(flag),
                              border: `1px solid ${mrFlagBorder(flag)}`,
                              borderRadius: "0.375rem", padding: "0.2rem 0.5rem",
                            }}>
                              {flag === "green"
                                ? <i className="bi bi-circle-fill" style={{ color: "#15803D", fontSize: "0.6rem", marginRight: "4px" }} />
                                : flag === "amber"
                                  ? <i className="bi bi-diamond-fill" style={{ color: "#B45309", fontSize: "0.6rem", marginRight: "4px" }} />
                                  : <i className="bi bi-triangle-fill" style={{ color: "#B91C1C", fontSize: "0.6rem", marginRight: "4px" }} />
                              }{adeq.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }} onClick={(e) => { e.stopPropagation(); toggleCondition(lease.leaseId, cond); }}>
                        <button style={{
                          display: "inline-flex", alignItems: "center", gap: "0.25rem",
                          fontSize: "0.75rem", fontWeight: 600, border: "1px solid #E2E8F0",
                          borderRadius: "9999px", padding: "0.25rem 0.625rem", cursor: "pointer",
                          background: cond === "full-life" ? "#002147" : "#F4F5F7",
                          color: cond === "full-life" ? "#FFFFFF" : "#475569",
                        }}>
                          {cond === "half-life" ? "½ Life" : "Full Life"}
                        </button>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 500, color: eol > 0 ? "#0F172A" : "#15803D" }}>
                        {eol > 0 ? `+${fmtUSD(eol)}` : "—"}
                        <span style={{ fontSize: "0.6875rem", color: "#94A3B8", marginLeft: "0.25rem" }}>{eol > 0 ? "lessee owes" : "no comp"}</span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{ fontWeight: 600, color: "#002147" }}>{lgdOff.toFixed(1)} pp</span>
                        <span style={{ fontSize: "0.6875rem", color: "#94A3B8", display: "block" }}>up to {optOff.toFixed(1)} pp</span>
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        {lease.creditTier ? (
                          <span style={{
                            background: SDMR_TIER_BG[lease.creditTier],
                            color: SDMR_TIER_COLOR[lease.creditTier],
                            fontWeight: 600, fontSize: "0.6875rem",
                            padding: "0.125rem 0.45rem", borderRadius: "9999px",
                            whiteSpace: "nowrap",
                          }}>
                            {SDMR_TIER_LABEL[lease.creditTier]}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#94A3B8", fontSize: "1rem" }}>
                        {isOpen ? "▲" : "▶"}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${lease.leaseId}-detail`} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td colSpan={12} style={{ padding: "0", background: "#FAFAFA" }}>
                          <ExpandedPanel lease={lease} condition={cond} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ECL Feedback Table */}
      <Card
        title="SD / MR → ECL LGD Feedback"
        subtitle="How SD and MR reserves reduce LGD per lease — conservative floor and optimistic ceiling"
        noPadding
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                {["Lease ID", "Lessee", "EAD", "Base LGD", "Conservative Adj. LGD", "Optimistic Adj. LGD", "ECL Δ (conservative)"].map((h) => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((lease, i) => {
                const adjLGD = adjustedLGD(lease);
                const optLGD = Math.max(0, lease.baseLGD - optimisticOffset(lease) * 100);
                const eclBase = lease.eadNum * (lease.baseLGD / 100);
                const eclAdj = lease.eadNum * (adjLGD / 100);
                const eclDelta = eclAdj - eclBase;
                return (
                  <tr key={lease.leaseId} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>{lease.leaseId}</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{lease.lessee}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>${lease.eadNum.toFixed(1)}M</td>
                    <td style={{ padding: "0.75rem 1rem", color: lease.baseLGD >= 50 ? "#B91C1C" : lease.baseLGD >= 30 ? "#B45309" : "#475569", fontWeight: 600 }}>{lease.baseLGD}%</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#002147" }}>{adjLGD.toFixed(1)}%</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#15803D", fontWeight: 500 }}>{optLGD.toFixed(1)}%</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#15803D", fontVariantNumeric: "tabular-nums" }}>
                      {Math.abs(eclDelta) < 0.005 ? "—" : `${eclDelta >= 0 ? "+" : ""}$${Math.abs(eclDelta).toFixed(2)}M`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isLive && (
          <div style={{ padding: "0.625rem 1rem", borderTop: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#B45309", background: "rgba(180,83,9,0.04)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <AlertTriangle size={12} style={{ flexShrink: 0 }} />
            MR rates estimated from type-level heuristics — actual maintenance ledger data not yet in portfolio schema.
          </div>
        )}
        <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#94A3B8", background: "#F8FAFC" }}>
          SD/MR LGD adjustments shown for reference. Full integration into probability-weighted ECL computation delivered in Sprint 12 (F09 — Risk Mitigation Action Simulator).
        </div>
      </Card>
    </div>
  );
}
