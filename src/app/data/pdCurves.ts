// src/app/data/pdCurves.ts

export type CarrierSegment = "network" | "lcc" | "regional" | "charter";

export const CARRIER_SEGMENT_LABELS: Record<CarrierSegment, string> = {
  network:  "Network Carrier",
  lcc:      "Low-Cost Carrier",
  regional: "Regional",
  charter:  "Charter",
};

export interface PdTermStructure {
  pd1yr:          number;
  pd2yr:          number;
  pd3yr:          number;
  pd5yr:          number;
  pdLifetime:     number;
  source:         string;
  calibratedYear: number;
}

export type PdCurveLibrary = Record<CarrierSegment, PdTermStructure>;

export const DEFAULT_PD_CURVES: PdCurveLibrary = {
  network: {
    pd1yr: 0.0120, pd2yr: 0.0220, pd3yr: 0.0330, pd5yr: 0.0540, pdLifetime: 0.220,
    source: "Moody's Annual Default Study 2023 (Ba1 TTC cohort, transportation sector); S&P 2023 Annual Global Corporate Default Study",
    calibratedYear: 2023,
  },
  lcc: {
    pd1yr: 0.0180, pd2yr: 0.0340, pd3yr: 0.0510, pd5yr: 0.0820, pdLifetime: 0.280,
    source: "Moody's Annual Default Study 2023 (Ba2 TTC cohort); IATA Economics airline failure rate data 1990–2023",
    calibratedYear: 2023,
  },
  regional: {
    pd1yr: 0.0300, pd2yr: 0.0560, pd3yr: 0.0820, pd5yr: 0.1250, pdLifetime: 0.380,
    source: "Moody's Annual Default Study 2023 (B1/Ba3 TTC cohort); S&P 2023 Annual Global Corporate Default Study (transportation sub-sector)",
    calibratedYear: 2023,
  },
  charter: {
    pd1yr: 0.0450, pd2yr: 0.0830, pd3yr: 0.1180, pd5yr: 0.1720, pdLifetime: 0.480,
    source: "Moody's Annual Default Study 2023 (B2 TTC cohort) with aviation charter cyclicality uplift; Thomas Cook/Germania/Monarch observed default cluster 2017–2020",
    calibratedYear: 2023,
  },
};

// Merge firm overrides onto defaults.
// Firm override wins for ALL five tenors together (row-level, not tenor-level).
// Partial overrides (e.g. only pd1yr) are merged onto the default row.
export function mergeCurves(
  defaults: PdCurveLibrary,
  overrides: Partial<Record<CarrierSegment, Partial<PdTermStructure>>>,
): PdCurveLibrary {
  const result = {} as PdCurveLibrary;
  for (const seg of Object.keys(defaults) as CarrierSegment[]) {
    result[seg] = overrides[seg]
      ? { ...defaults[seg], ...overrides[seg] }
      : { ...defaults[seg] };
  }
  return result;
}

export type DeviationBand = "green" | "amber" | "red";

// Compare manual pd_estimate against curve pd1yr.
// Returns deviation as a ratio and the band for UI display.
export function computeDeviation(
  manualPd: number,
  curvePd1yr: number,
  segment: CarrierSegment,
): { ratio: number; band: DeviationBand; description: string } {
  if (curvePd1yr === 0) return { ratio: 0, band: "green", description: "No benchmark" };
  const ratio = manualPd / curvePd1yr;
  const band: DeviationBand =
    ratio <= 1.25 && ratio >= 0.8 ? "green"
    : ratio <= 2.0 && ratio >= 0.5 ? "amber"
    : "red";
  const pct = Math.round((ratio - 1) * 100);
  const direction = pct >= 0 ? "above" : "below";
  const label = CARRIER_SEGMENT_LABELS[segment];
  const description = `Manual PD is ${Math.abs(pct)}% ${direction} the ${label} benchmark`;
  return { ratio, band, description };
}
