// ─── Shared data & finance math for Deals sub-tools ──────────────────────────
import { TYPE_HEURISTICS } from "./maintenanceHeuristics";
export { TYPE_HEURISTICS };

// ─── Market rent heuristics (USD / month, fleet average, May 2026) ───────────
export const MARKET_RENT_USD: Record<string, { low: number; mid: number; high: number }> = {
  "A320":       { low: 248_000, mid: 272_000, high: 295_000 },
  "A320neo":    { low: 278_000, mid: 302_000, high: 328_000 },
  "A321neo":    { low: 292_000, mid: 318_000, high: 345_000 },
  "A330-300":   { low: 415_000, mid: 455_000, high: 495_000 },
  "A350-900":   { low: 875_000, mid: 942_000, high: 1_020_000 },
  "B737-800":   { low: 275_000, mid: 300_000, high: 325_000 },
  "B737 MAX 8": { low: 308_000, mid: 338_000, high: 368_000 },
  "B777-300ER": { low: 1_100_000, mid: 1_195_000, high: 1_300_000 },
  "B787-9":     { low: 910_000,   mid: 975_000,   high: 1_048_000 },
  "A220-300":   { low: 210_000,   mid: 232_000,   high: 255_000 },
  "E190":       { low: 145_000,   mid: 162_000,   high: 180_000 },
  "E195":       { low: 155_000,   mid: 172_000,   high: 192_000 },
  "CRJ900":     { low: 120_000,   mid: 138_000,   high: 155_000 },
  "Q400":       { low: 88_000,    mid: 102_000,   high: 118_000 },
  "ATR 72":     { low: 78_000,    mid:  90_000,   high: 104_000 },
};

// ─── Reference aircraft values (half-life base, USD) ─────────────────────────
export const AIRCRAFT_BASE_VALUE: Record<string, number> = {
  "A320":       25_000_000,  "A320neo":   26_500_000,  "A321neo":   29_000_000,
  "A330-300":   38_000_000,  "A350-900":  75_000_000,  "B737-800":  28_000_000,
  "B737 MAX 8": 48_000_000,  "B777-300ER":90_000_000,  "B787-9":   110_000_000,
  "A220-300":   26_000_000,  "E190":      20_000_000,  "E195":      22_000_000,
  "CRJ900":     14_000_000,  "Q400":      12_000_000,  "ATR 72":    10_000_000,
};

// ─── Monthly holding cost (parked / between leases, USD) ─────────────────────
export const HOLDING_COST: Record<string, number> = {
  "narrowbody":   28_000,  "widebody":     54_000,
  "regional-jet": 16_000,  "turboprop":    11_000,
};

function categoryOf(type: string): string {
  return TYPE_HEURISTICS[type]?.category ?? "narrowbody";
}
export function holdingCostMonthly(type: string): number {
  return HOLDING_COST[categoryOf(type)] ?? 28_000;
}

// ─── Residual value factor ────────────────────────────────────────────────────
// Linear depreciation over 30-year design life.
export function residualFactor(vintageYear: number, termMonths: number): number {
  const ageAtEnd = (2026 - vintageYear) + termMonths / 12;
  return Math.max(0.10, 1 - ageAtEnd / 30);
}

// ─── Monthly MR income (lessee pays to lessor) ────────────────────────────────
export function autoMonthlyMR(aircraftType: string): number {
  const h = TYPE_HEURISTICS[aircraftType];
  if (!h) return 0;
  return Object.values(h.components).reduce((sum, comp) => {
    if (comp.basis === "FH") {
      return sum + (comp.costUSD / comp.intervalFH) * (h.utilizationFH / 12);
    } else {
      return sum + (comp.costUSD / comp.intervalCy) * (h.utilizationCy / 12);
    }
  }, 0);
}

// ─── Portfolio data (mirrors Portfolio.tsx — centralised here for Deals) ──────
export const PORTFOLIO_AIRCRAFT = [
  { msn: "9218",  type: "A320neo",    reg: "VT-IYC", vintage: 2019, nbvM: 24.2, mvM: 26.1, partOutM: 18.2, lessee: "IndiGo Airlines",   leaseId: "LSE-2019-001", stage: "3" },
  { msn: "41234", type: "B737-800",   reg: "XA-AMX", vintage: 2020, nbvM: 32.1, mvM: 28.8, partOutM: 19.6, lessee: "Aeromexico",         leaseId: "LSE-2020-014", stage: "3" },
  { msn: "62047", type: "B777-300ER", reg: "A6-ECE", vintage: 2021, nbvM: 88.4, mvM: 91.2, partOutM: 64.2, lessee: "Emirates",           leaseId: "LSE-2021-022", stage: "1" },
  { msn: "1728",  type: "A330-300",   reg: "4R-ALB", vintage: 2015, nbvM: 34.2, mvM: 29.1, partOutM: 21.4, lessee: "SriLankan Airlines", leaseId: "LSE-2020-031", stage: "2" },
  { msn: "67892", type: "B737 MAX 8", reg: "EI-HXP", vintage: 2022, nbvM: 44.7, mvM: 47.3, partOutM: 31.8, lessee: "Ryanair",            leaseId: "LSE-2022-009", stage: "1" },
  { msn: "0378",  type: "A350-900",   reg: "F-HTYR", vintage: 2018, nbvM: 68.3, mvM: 72.8, partOutM: 52.6, lessee: "Air France",         leaseId: "LSE-2018-047", stage: "1" },
];

export const PORTFOLIO_LEASES = [
  { id: "LSE-2019-001", msn: "9218",  lessee: "IndiGo Airlines",   aircraft: "A320neo",    end: "2028-03-01", rentPerMonth: 285_000,   sdM: 1.71, mrBalanceM: 19.0, nbvM: 24.2, stage: "3" },
  { id: "LSE-2020-014", msn: "41234", lessee: "Aeromexico",         aircraft: "B737-800",   end: "2027-06-15", rentPerMonth: 310_000,   sdM: 1.86, mrBalanceM: 15.6, nbvM: 32.1, stage: "3" },
  { id: "LSE-2021-022", msn: "62047", lessee: "Emirates",           aircraft: "B777-300ER", end: "2030-01-10", rentPerMonth: 1_240_000, sdM: 1.24, mrBalanceM: 40.3, nbvM: 88.4, stage: "1" },
  { id: "LSE-2020-031", msn: "1728",  lessee: "SriLankan Airlines", aircraft: "A330-300",   end: "2026-09-01", rentPerMonth: 480_000,   sdM: 1.44, mrBalanceM: 35.5, nbvM: 34.2, stage: "2" },
  { id: "LSE-2022-009", msn: "67892", lessee: "Ryanair",            aircraft: "B737 MAX 8", end: "2032-04-15", rentPerMonth: 340_000,   sdM: 0.34, mrBalanceM:  8.8, nbvM: 44.7, stage: "1" },
  { id: "LSE-2018-047", msn: "0378",  lessee: "Air France",         aircraft: "A350-900",   end: "2028-07-20", rentPerMonth: 960_000,   sdM: 0.96, mrBalanceM: 55.9, nbvM: 68.3, stage: "1" },
];

// ─── Finance math ─────────────────────────────────────────────────────────────

export function monthlyRate(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

export function annuityFactor(r: number, n: number): number {
  if (Math.abs(r) < 1e-9) return n;
  return (1 - Math.pow(1 + r, -n)) / r;
}

export function npvOfCashflows(cashflows: number[], annualPct: number): number {
  const r = monthlyRate(annualPct);
  return cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
}

export function computeIRR(cashflows: number[]): number | null {
  function npv(annualPct: number): number {
    const r = monthlyRate(annualPct);
    return cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
  }
  const nLow = npv(-99), nHigh = npv(999);
  if (nLow * nHigh >= 0) return null;
  let lo = -99, hi = 999;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (hi - lo < 0.001) return mid;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function fmtM(n: number, dp = 1): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(dp)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function fmtPct(n: number, dp = 1): string {
  return `${n >= 0 ? "" : ""}${n.toFixed(dp)}%`;
}

export function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
}
