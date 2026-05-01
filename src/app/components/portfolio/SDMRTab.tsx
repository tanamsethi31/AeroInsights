import { useState, Fragment } from "react";
import { Card } from "../ui/Card";
import { KpiCard } from "../ui/KpiCard";
import { StatusPill } from "../ui/StatusPill";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SDRecord {
  type: "Cash" | "LC";
  amount: number;
  currency: string;
  refundTriggers: string[];
  governingLaw: string;
}

interface MRComponent {
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

interface LeaseSDMR {
  leaseId: string;
  lessee: string;
  aircraft: string;
  eadNum: number;
  baseLGD: number;
  sd: SDRecord;
  mrComponents: MRComponent[];
  returnCondition: "half-life" | "full-life";
}

// ─── Synthetic Dataset ────────────────────────────────────────────────────────

const sdmrData: LeaseSDMR[] = [
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

// ─── Computed Functions ───────────────────────────────────────────────────────

function mrNetRefund(comp: MRComponent): number {
  if (!comp.refundable) return 0;
  return Math.min(comp.cumulativeBalance, comp.evidencedCost);
}

function totalMRBalance(lease: LeaseSDMR): number {
  return lease.mrComponents.reduce((s, c) => s + c.cumulativeBalance, 0);
}

function nonRefundableMR(lease: LeaseSDMR): number {
  return lease.mrComponents
    .filter((c) => !c.refundable)
    .reduce((s, c) => s + c.cumulativeBalance, 0);
}

function refundableMRCapped(lease: LeaseSDMR): number {
  return lease.mrComponents
    .filter((c) => c.refundable)
    .reduce((s, c) => s + mrNetRefund(c), 0);
}

function conservativeOffset(lease: LeaseSDMR): number {
  return (lease.sd.amount + nonRefundableMR(lease)) / (lease.eadNum * 1_000_000);
}

function optimisticOffset(lease: LeaseSDMR): number {
  return (lease.sd.amount + nonRefundableMR(lease) + refundableMRCapped(lease)) / (lease.eadNum * 1_000_000);
}

function adjustedLGD(lease: LeaseSDMR): number {
  return Math.max(0, lease.baseLGD * (1 - conservativeOffset(lease)));
}

function eolCompensation(lease: LeaseSDMR, condition: "half-life" | "full-life"): number {
  return lease.mrComponents.reduce((sum, comp) => {
    const target = condition === "half-life"
      ? comp.fullIntervalUnits / 2
      : comp.fullIntervalUnits;
    const shortfall = Math.max(0, target - comp.remainingUnits);
    return sum + shortfall * comp.rateAmount;
  }, 0);
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
                    <StatusPill stage={comp.refundable ? "green" : ("neutral" as any)} label={comp.refundable ? "Yes" : "No"} />
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

export function SDMRTab() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  function toggleCondition(id: string) {
    setConditions((prev) => ({
      ...prev,
      [id]: prev[id] === "half-life" ? "full-life" : "half-life",
    }));
  }

  const totalSD = sdmrData.reduce((s, l) => s + l.sd.amount, 0);
  const totalMR = sdmrData.reduce((s, l) => s + totalMRBalance(l), 0);
  const totalEAD = sdmrData.reduce((a, x) => a + x.eadNum, 0);
  const wtdLGDReduction = sdmrData.reduce((s, l) => {
    const w = l.eadNum / totalEAD;
    return s + (l.baseLGD - adjustedLGD(l)) * w;
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard label="Total SD Posted" value={fmtUSD(totalSD)} subtitle="Across 6 active leases" />
        <KpiCard label="Total MR Reserves" value={fmtUSD(totalMR)} subtitle="Cumulative balances held" />
        <KpiCard label="Wtd Avg LGD Reduction" value={`${wtdLGDReduction.toFixed(1)} pp`} subtitle="Conservative offset applied" deltaType="positive" />
      </div>

      {/* Accordion Table */}
      <Card title="Security Deposit & Maintenance Reserve Register" noPadding>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                {["Lease ID", "Lessee", "Aircraft", "SD Type", "SD Amount", "MR Balance", "Return Condition", "EOL Compensation", "LGD Offset", ""].map((h) => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sdmrData.map((lease, i) => {
                const cond = conditions[lease.leaseId];
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
                      <td style={{ padding: "0.75rem 1rem" }} onClick={(e) => { e.stopPropagation(); toggleCondition(lease.leaseId); }}>
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
                      <td style={{ padding: "0.75rem 1rem", color: "#94A3B8", fontSize: "1rem" }}>
                        {isOpen ? "▲" : "▶"}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${lease.leaseId}-detail`} style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td colSpan={10} style={{ padding: "0", background: "#FAFAFA" }}>
                          <ExpandedPanel lease={lease} condition={conditions[lease.leaseId]} />
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
    </div>
  );
}
