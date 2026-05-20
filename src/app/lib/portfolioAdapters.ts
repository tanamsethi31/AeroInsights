// src/app/lib/portfolioAdapters.ts
// Pure transformation functions: DB types → page display types.

import type { Asset, Lessee, Lease, Provision } from "../types/portfolio";
import type { LeaseRow } from "../components/risk-ecl/ECLDrilldownPanel";
import { MR_ADEQUACY, type MRAdeqFlag } from "../data/maintenanceHeuristics";

// ─── Concentration adapter ────────────────────────────────────────────────────

const COUNTRY_TO_REGION: Record<string, string> = {
  "UAE": "MEA", "Saudi Arabia": "MEA", "Qatar": "MEA", "Kuwait": "MEA", "Bahrain": "MEA",
  "Turkey": "MEA", "Egypt": "MEA", "South Africa": "MEA", "Nigeria": "MEA", "Israel": "MEA",
  "India": "APAC", "China": "APAC", "Singapore": "APAC", "Japan": "APAC",
  "Australia": "APAC", "South Korea": "APAC", "Sri Lanka": "APAC", "Malaysia": "APAC",
  "Thailand": "APAC", "Indonesia": "APAC", "Vietnam": "APAC", "Philippines": "APAC",
  "France": "Europe", "Germany": "Europe", "Ireland": "Europe", "UK": "Europe",
  "Netherlands": "Europe", "Spain": "Europe", "Italy": "Europe", "Switzerland": "Europe",
  "Portugal": "Europe", "Belgium": "Europe", "Sweden": "Europe", "Norway": "Europe",
  "USA": "Americas", "Canada": "Americas", "Brazil": "Americas", "Mexico": "Americas",
  "Argentina": "Americas", "Colombia": "Americas", "Chile": "Americas", "Peru": "Americas",
};

function vintageBand(year: number | null): string {
  if (!year) return "Unknown";
  if (year >= 2023) return "2023+";
  if (year >= 2021) return "2021–22";
  if (year >= 2019) return "2019–20";
  if (year >= 2017) return "2017–18";
  if (year >= 2015) return "2015–16";
  return "Before 2015";
}

export type ConcentrationDimKey = "Lessee" | "Country" | "Region" | "Type" | "Vintage" | "Currency";

export interface ConcentrationRow {
  name: string;
  exposure: number;    // EAD in $
  exposurePct: number; // % of total EAD (0–100)
  ecl: number;         // ecl_amount in $
  eclPct: number;      // ecl / exposure × 100 (loss rate %)
}

export interface ConcentrationHeatmapCell {
  lessee: string;
  country: string;
  exposure: number;
  ecl: number;
}

export interface ConcentrationOutput {
  concentrationData: Record<ConcentrationDimKey, ConcentrationRow[]>;
  heatmapCells: ConcentrationHeatmapCell[];
  kpis: {
    bookValue: number;  // total EAD
    totalECL: number;   // total ecl_amount
    eclRate: number;    // totalECL / bookValue × 100
  };
  peakConcentrations: Record<ConcentrationDimKey, { name: string; pct: number }>;
}

export function toConcentrationData(
  assets: Asset[],
  lessees: Lessee[],
  leases: Lease[],
  provisions: Provision[],
): ConcentrationOutput {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);

  // Build asset_id → lessee_id via leases
  const assetToLesseeId = new Map<string, string>();
  const assetToCurrency = new Map<string, string>();
  for (const l of leases) {
    assetToLesseeId.set(l.asset_id, l.lessee_id);
    assetToCurrency.set(l.asset_id, l.currency ?? "USD");
  }

  // Aggregate exposure (EAD) and ECL by dimension key
  type DimAgg = Map<string, { exposure: number; ecl: number }>;

  const byLessee:   DimAgg = new Map();
  const byCountry:  DimAgg = new Map();
  const byRegion:   DimAgg = new Map();
  const byType:     DimAgg = new Map();
  const byVintage:  DimAgg = new Map();
  const byCurrency: DimAgg = new Map();

  let totalEAD = 0;
  let totalECL = 0;

  for (const p of provisions) {
    const ead = p.ead ?? 0;
    const ecl = p.ecl_amount ?? 0;
    totalEAD += ead;
    totalECL += ecl;

    const asset    = assetMap.get(p.asset_id);
    const lesseeId = assetToLesseeId.get(p.asset_id) ?? "";
    const lessee   = lesseeMap.get(lesseeId);

    const lesseeName  = lessee?.name    ?? "Unknown";
    const country     = lessee?.country ?? "Unknown";
    const region      = COUNTRY_TO_REGION[country] ?? "Other";
    const typeKey     = asset?.aircraft_type ?? "Unknown";
    const vintageKey  = vintageBand(asset?.vintage ?? null);
    const currencyKey = assetToCurrency.get(p.asset_id) ?? "USD";

    function add(m: DimAgg, key: string) {
      const prev = m.get(key) ?? { exposure: 0, ecl: 0 };
      m.set(key, { exposure: prev.exposure + ead, ecl: prev.ecl + ecl });
    }

    add(byLessee,   lesseeName);
    add(byCountry,  country);
    add(byRegion,   region);
    add(byType,     typeKey);
    add(byVintage,  vintageKey);
    add(byCurrency, currencyKey);
  }

  function toRows(agg: DimAgg): ConcentrationRow[] {
    const rows: ConcentrationRow[] = [];
    for (const [name, { exposure, ecl }] of agg) {
      rows.push({
        name,
        exposure,
        exposurePct: totalEAD > 0 ? (exposure / totalEAD) * 100 : 0,
        ecl,
        eclPct: exposure > 0 ? (ecl / exposure) * 100 : 0,
      });
    }
    return rows.sort((a, b) => b.exposure - a.exposure);
  }

  const concentrationData: Record<ConcentrationDimKey, ConcentrationRow[]> = {
    Lessee:   toRows(byLessee),
    Country:  toRows(byCountry),
    Region:   toRows(byRegion),
    Type:     toRows(byType),
    Vintage:  toRows(byVintage),
    Currency: toRows(byCurrency),
  };

  // Peak concentrations = top row of each dimension
  function peak(rows: ConcentrationRow[]): { name: string; pct: number } {
    return rows.length > 0
      ? { name: rows[0].name, pct: Math.round(rows[0].exposurePct * 10) / 10 }
      : { name: "—", pct: 0 };
  }

  const peakConcentrations: Record<ConcentrationDimKey, { name: string; pct: number }> = {
    Lessee:   peak(concentrationData.Lessee),
    Country:  peak(concentrationData.Country),
    Region:   peak(concentrationData.Region),
    Type:     peak(concentrationData.Type),
    Vintage:  peak(concentrationData.Vintage),
    Currency: peak(concentrationData.Currency),
  };

  // Heatmap cells — one row per (lessee, country) combination observed in provisions
  const heatmapCells: ConcentrationHeatmapCell[] = [];
  const seen = new Set<string>();
  for (const p of provisions) {
    const lesseeId   = assetToLesseeId.get(p.asset_id) ?? "";
    const lessee     = lesseeMap.get(lesseeId);
    const lesseeName = lessee?.name    ?? "Unknown";
    const country    = lessee?.country ?? "Unknown";
    const key = `${lesseeName}||${country}`;
    if (!seen.has(key)) {
      seen.add(key);
      heatmapCells.push({
        lessee: lesseeName, country,
        exposure: p.ead ?? 0, ecl: p.ecl_amount ?? 0,
      });
    } else {
      const cell = heatmapCells.find(c => `${c.lessee}||${c.country}` === key);
      if (cell) { cell.exposure += p.ead ?? 0; cell.ecl += p.ecl_amount ?? 0; }
    }
  }

  return {
    concentrationData,
    heatmapCells,
    kpis: {
      bookValue: totalEAD,
      totalECL,
      eclRate: totalEAD > 0 ? (totalECL / totalEAD) * 100 : 0,
    },
    peakConcentrations,
  };
}

export function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const item of items) m.set(item.id, item);
  return m;
}

function fmtWithCommas(n: number): string {
  return n.toLocaleString("en-US");
}

// ─── Portfolio.tsx — Leases tab ───────────────────────────────────────────────

export interface LeaseTableRow {
  id: string;
  lessee: string;
  aircraft: string;
  msn: string;
  start: string;
  end: string;
  rentUSD: string;
  stage: string;
  status: string;
  // MR adequacy — null when no MR_ADEQUACY entry exists for this lease id
  mrFlag: MRAdeqFlag | null;
  eolShortfall: number | null;      // positive = shortfall, negative = surplus
  eolShortfallPct: number | null;   // shortfall as % of EOL redelivery cost
}

export function toLeaseTableRows(leases: Lease[], assets: Asset[], lessees: Lessee[]): LeaseTableRow[] {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);
  return leases.map((l) => {
    const asset = assetMap.get(l.asset_id);
    const lessee = lesseeMap.get(l.lessee_id);
    const mrData = MR_ADEQUACY[l.id] ?? null;
    return {
      id: l.id,
      lessee: lessee?.name ?? "—",
      aircraft: asset?.aircraft_type ?? "—",
      msn: asset?.msn ?? "—",
      start: l.start_date,
      end: l.end_date,
      rentUSD: l.monthly_rental != null ? fmtWithCommas(l.monthly_rental) : "—",
      stage: l.stage != null ? String(l.stage) : "—",
      status: "Active",
      mrFlag: mrData ? mrData.flag : null,
      eolShortfall: mrData ? mrData.eolShortfall : null,
      eolShortfallPct: mrData ? mrData.eolShortfallPct : null,
    };
  });
}

// ─── MR Health Summary ────────────────────────────────────────────────────────

export interface MRHealthSummary {
  redCount: number;
  amberCount: number;
  greenCount: number;
  worstOffenders: Array<{
    leaseId: string;
    lessee: string;
    msn: string;
    flag: MRAdeqFlag;
    eolShortfall: number;
    eolShortfallPct: number;
  }>;
}

export function toMRHealthSummary(leases: LeaseTableRow[]): MRHealthSummary {
  let redCount = 0;
  let amberCount = 0;
  let greenCount = 0;
  const atRisk: MRHealthSummary["worstOffenders"] = [];

  for (const l of leases) {
    if (l.mrFlag === "red") {
      redCount++;
      atRisk.push({ leaseId: l.id, lessee: l.lessee, msn: l.msn, flag: "red", eolShortfall: l.eolShortfall ?? 0, eolShortfallPct: l.eolShortfallPct ?? 0 });
    } else if (l.mrFlag === "amber") {
      amberCount++;
      atRisk.push({ leaseId: l.id, lessee: l.lessee, msn: l.msn, flag: "amber", eolShortfall: l.eolShortfall ?? 0, eolShortfallPct: l.eolShortfallPct ?? 0 });
    } else if (l.mrFlag === "green") {
      greenCount++;
    }
  }

  // Sort: red before amber, then by eolShortfall descending. Cap at 3.
  atRisk.sort((a, b) => {
    if (a.flag !== b.flag) return a.flag === "red" ? -1 : 1;
    return b.eolShortfall - a.eolShortfall;
  });

  return { redCount, amberCount, greenCount, worstOffenders: atRisk.slice(0, 3) };
}

// ─── Portfolio.tsx — Aircraft tab ─────────────────────────────────────────────

export interface AircraftTableRow {
  msn: string;
  type: string;
  reg: string;
  vintage: number;
  nbv: string;
  mv: string;
  mvAdj: string;
  lessee: string;
  maintenanceReserve: string;
}

export function toAircraftTableRows(assets: Asset[], leases: Lease[], lessees: Lessee[]): AircraftTableRow[] {
  const lesseeMap = indexById(lessees);
  const assetLessee = new Map<string, string>();
  for (const l of leases) {
    const name = lesseeMap.get(l.lessee_id)?.name ?? "—";
    assetLessee.set(l.asset_id, name);
  }
  return assets.map((a) => ({
    msn: a.msn,
    type: a.aircraft_type,
    reg: a.registration,
    vintage: a.vintage ?? 0,
    nbv: "—",
    mv: "—",
    mvAdj: "—",
    lessee: assetLessee.get(a.id) ?? "—",
    maintenanceReserve: "—",
  }));
}

// ─── Portfolio.tsx — Lessees tab ──────────────────────────────────────────────

export interface LesseeTableRow {
  id: string;
  name: string;
  country: string;
  rating: string;
  stage: "1" | "2" | "3";
  behaviorScore: number | null;
  leases: number;
  exposure: string;
  paymentDays: number | null;
}

function deriveStage(lessee: Lessee): "1" | "2" | "3" {
  if (lessee.watchlist_status === "red") return "3";
  if (lessee.watchlist_status === "amber") return "2";
  const pd = lessee.pd_estimate ?? 0;
  if (pd >= 0.1) return "3";
  if (pd >= 0.05) return "2";
  return "1";
}

export function toLesseeTableRows(
  lessees: Lessee[],
  leases: Lease[],
  provisions?: Provision[],
): LesseeTableRow[] {
  const leaseCount = new Map<string, number>();
  for (const l of leases) leaseCount.set(l.lessee_id, (leaseCount.get(l.lessee_id) ?? 0) + 1);

  // Build exposure per lessee from provisions (optional)
  const exposureByLesseeId = new Map<string, number>();
  if (provisions && provisions.length > 0) {
    const assetToLessee = new Map<string, string>();
    for (const l of leases) assetToLessee.set(l.asset_id, l.lessee_id);
    for (const p of provisions) {
      const lesseeId = assetToLessee.get(p.asset_id);
      if (!lesseeId) continue;
      exposureByLesseeId.set(lesseeId, (exposureByLesseeId.get(lesseeId) ?? 0) + (p.ead ?? 0));
    }
  }

  return lessees.map((l) => {
    const rawEAD = exposureByLesseeId.get(l.id) ?? 0;
    const exposureM = rawEAD / 1_000_000;
    const exposure =
      rawEAD === 0
        ? "—"
        : exposureM >= 1000
        ? `$${(exposureM / 1000).toFixed(2)}B`
        : `$${exposureM.toFixed(0)}M`;
    return {
      id: l.id,
      name: l.name,
      country: l.country ?? "—",
      rating: l.credit_rating ?? "—",
      stage: deriveStage(l),
      behaviorScore: null,
      leases: leaseCount.get(l.id) ?? 0,
      exposure,
      paymentDays: null,
    };
  });
}

// ─── Portfolio.tsx — KPI strip ────────────────────────────────────────────────

export interface PortfolioKPIs {
  fleetCount: number;          // assets.length
  bookValueM: number;          // sum of provision.ead / 1_000_000
  leasedCount: number;         // number of assets with at least one active lease
  monthlyRentRollM: number;    // sum of monthly_rental across all leases / 1_000_000
  totalECLM: number;           // sum of provision.ecl_amount / 1_000_000
  eclRatePct: number;          // totalECLM / bookValueM × 100
  avgRemainingTermYrs: number; // average remaining lease term in years (floored at 0)
}

export function toPortfolioKPIs(
  assets: Asset[],
  leases: Lease[],
  provisions: Provision[],
): PortfolioKPIs {
  const today = Date.now();
  const YEAR_MS = 1000 * 60 * 60 * 24 * 365.25;

  const bookValueM = provisions.reduce((s, p) => s + (p.ead ?? 0), 0) / 1_000_000;
  const totalECLM  = provisions.reduce((s, p) => s + (p.ecl_amount ?? 0), 0) / 1_000_000;

  const leasedCount = new Set(leases.map((l) => l.asset_id)).size;
  const monthlyRentRollM = leases.reduce((s, l) => s + (l.monthly_rental ?? 0), 0) / 1_000_000;

  const avgRemainingTermYrs = leases.length > 0
    ? leases.reduce((s, l) => {
        const end = new Date(l.end_date).getTime();
        return s + Math.max(0, (end - today) / YEAR_MS);
      }, 0) / leases.length
    : 0;

  return {
    fleetCount: assets.length,
    bookValueM,
    leasedCount,
    monthlyRentRollM,
    totalECLM,
    eclRatePct: bookValueM > 0 ? (totalECLM / bookValueM) * 100 : 0,
    avgRemainingTermYrs,
  };
}

// ─── Dashboard.tsx ────────────────────────────────────────────────────────────

export interface DashboardKPIs {
  fleetCount: number;
  totalECLm: number;
  stage3Count: number;
  watchlistRedCount: number;
  watchlistAmberCount: number;
  watchlistGreenCount: number;
  bookValueM: number;
}

export function toDashboardKPIs(assets: Asset[], lessees: Lessee[], provisions: Provision[]): DashboardKPIs {
  return {
    fleetCount: assets.length,
    totalECLm: provisions.reduce((s, p) => s + (p.ecl_amount ?? 0), 0) / 1_000_000,
    stage3Count: provisions.filter((p) => p.stage === 3).length,
    watchlistRedCount: lessees.filter((l) => l.watchlist_status === "red").length,
    watchlistAmberCount: lessees.filter((l) => l.watchlist_status === "amber").length,
    watchlistGreenCount: lessees.filter((l) => l.watchlist_status === "green" || l.watchlist_status == null).length,
    bookValueM: provisions.reduce((s, p) => s + (p.ead ?? 0), 0) / 1_000_000,
  };
}

// ─── RiskECL.tsx ──────────────────────────────────────────────────────────────

export function toEclTableRows(
  provisions: Provision[],
  assets: Asset[],
  lessees: Lessee[],
  leases: Lease[],
): LeaseRow[] {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);
  const assetLesseeId = new Map<string, string>();
  for (const l of leases) assetLesseeId.set(l.asset_id, l.lessee_id);

  return provisions.map((p): LeaseRow => {
    const asset = assetMap.get(p.asset_id);
    const lesseeId = assetLesseeId.get(p.asset_id) ?? "";
    const lessee = lesseeMap.get(lesseeId);

    const pd = (p.pd ?? 0) * 100;
    const lgd = (p.lgd ?? 0) * 100;
    const eadNum = (p.ead ?? 0) / 1_000_000;
    const ecl12m = (p.ecl_amount ?? 0) / 1_000_000;
    const eclLifetime = ecl12m * 1.45;
    const pdLifetime = pd * 1.4;
    const stage = (p.stage != null ? String(p.stage) : "1") as "1" | "2" | "3";

    return {
      id: p.id,
      lesseeId,
      lessee: lessee?.name ?? "—",
      aircraft: asset?.aircraft_type ?? "—",
      eadNum,
      pd12m: pd,
      pdLifetime,
      lgd,
      ecl12m,
      eclLifetime,
      stage,
      sicrTrigger: null,
      pdTerm: [
        { year: "1Y", pd },
        { year: "2Y", pd: pd * 1.15 },
        { year: "3Y", pd: pd * 1.28 },
        { year: "LT", pd: pdLifetime },
      ],
      scenarioECL: {
        base:    { ecl12m,               eclLifetime },
        adverse: { ecl12m: ecl12m * 1.44, eclLifetime: eclLifetime * 1.44 },
        upside:  { ecl12m: ecl12m * 0.64, eclLifetime: eclLifetime * 0.64 },
      },
      journalMovement: 0,
    };
  });
}

// ─── exportService.ts ─────────────────────────────────────────────────────────

export interface PortfolioExportData {
  eclRows: Array<{ id: string; lessee: string; aircraft: string; ead: number; pd12m: number; lgd: number; ecl12m: number; eclLT: number; stage: string }>;
  leaseRows: Array<{ id: string; lessee: string; aircraft: string; msn: string; start: string; end: string; rent: string; stage: string }>;
  lesseeRows: Array<{ name: string; country: string; rating: string; stage: string; behavior: number | null; leases: number; exposure: string; daysLate: number | null }>;
  aircraftRows: Array<{ msn: string; type: string; reg: string; vintage: number; nbv: string; mv: string; mvAdj: string; lessee: string }>;
}

export function toExportData(assets: Asset[], lessees: Lessee[], leases: Lease[], provisions: Provision[]): PortfolioExportData {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);
  const assetLesseeId = new Map<string, string>();
  for (const l of leases) assetLesseeId.set(l.asset_id, l.lessee_id);

  const eclRows = provisions.map((p) => {
    const asset = assetMap.get(p.asset_id);
    const lesseeId = assetLesseeId.get(p.asset_id) ?? "";
    const lessee = lesseeMap.get(lesseeId);
    const ecl12m = (p.ecl_amount ?? 0) / 1_000_000;
    return {
      id: p.id,
      lessee: lessee?.name ?? "—",
      aircraft: asset?.aircraft_type ?? "—",
      ead: (p.ead ?? 0) / 1_000_000,
      pd12m: (p.pd ?? 0) * 100,
      lgd: (p.lgd ?? 0) * 100,
      ecl12m,
      eclLT: ecl12m * 1.45,
      stage: p.stage != null ? String(p.stage) : "—",
    };
  });

  const leaseRows = leases.map((l) => {
    const asset = assetMap.get(l.asset_id);
    const lessee = lesseeMap.get(l.lessee_id);
    return {
      id: l.id,
      lessee: lessee?.name ?? "—",
      aircraft: asset?.aircraft_type ?? "—",
      msn: asset?.msn ?? "—",
      start: l.start_date,
      end: l.end_date,
      rent: l.monthly_rental != null ? `$${l.monthly_rental.toLocaleString("en-US")}` : "—",
      stage: l.stage != null ? String(l.stage) : "—",
    };
  });

  const leaseCountMap = new Map<string, number>();
  for (const l of leases) leaseCountMap.set(l.lessee_id, (leaseCountMap.get(l.lessee_id) ?? 0) + 1);

  const lesseeRows = lessees.map((l) => ({
    name: l.name,
    country: l.country ?? "—",
    rating: l.credit_rating ?? "—",
    stage: deriveStage(l),
    behavior: null,
    leases: leaseCountMap.get(l.id) ?? 0,
    exposure: "—",
    daysLate: null,
  }));

  const assetLesseeName = new Map<string, string>();
  for (const l of leases) {
    const name = lesseeMap.get(l.lessee_id)?.name ?? "—";
    assetLesseeName.set(l.asset_id, name);
  }

  const aircraftRows = assets.map((a) => ({
    msn: a.msn,
    type: a.aircraft_type,
    reg: a.registration,
    vintage: a.vintage ?? 0,
    nbv: "—",
    mv: "—",
    mvAdj: "—",
    lessee: assetLesseeName.get(a.id) ?? "—",
  }));

  return { eclRows, leaseRows, lesseeRows, aircraftRows };
}
