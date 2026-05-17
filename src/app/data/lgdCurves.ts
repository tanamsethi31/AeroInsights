// src/app/data/lgdCurves.ts
// Pure-function utilities for LGD benchmarks derived from aircraft value decay curves.
// No React dependencies.

import type { Asset, Provision } from "../types/portfolio";
import { classifyAircraftFamily } from "./aircraftFamilyMap";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AircraftFamily = "narrowbody" | "widebody" | "regional";

export const AIRCRAFT_FAMILY_LABELS: Record<AircraftFamily, string> = {
  narrowbody: "Narrowbody",
  widebody:   "Widebody",
  regional:   "Regional Jet",
};

export interface ResidualValueSchedule {
  age0:  number;
  age5:  number;
  age10: number;
  age15: number;
  age20: number;
  age25: number;
  source:         string;
  calibratedYear: number;
}

export type ResidualValueLibrary = Record<AircraftFamily, ResidualValueSchedule>;

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_RECOVERY_FACTOR = 0.72;
export const DEFAULT_BASELINE_LGD    = 0.28; // LGD at age 0 with default recovery factor

export const DEFAULT_RESIDUAL_CURVES: ResidualValueLibrary = {
  narrowbody: {
    age0: 1.000, age5: 0.780, age10: 0.580, age15: 0.380, age20: 0.220, age25: 0.120,
    source: "AVAC Aircraft Value Reference 2023 (NB cohort 1990–2023); Cirium Fleets Analyzer 2023",
    calibratedYear: 2023,
  },
  widebody: {
    age0: 1.000, age5: 0.820, age10: 0.650, age15: 0.470, age20: 0.280, age25: 0.140,
    source: "AVAC Aircraft Value Reference 2023 (WB cohort 1995–2023); Boeing/Airbus residual value studies",
    calibratedYear: 2023,
  },
  regional: {
    age0: 1.000, age5: 0.680, age10: 0.420, age15: 0.220, age20: 0.110, age25: 0.050,
    source: "AVAC Aircraft Value Reference 2023 (Regional cohort); thin secondary market premium applied",
    calibratedYear: 2023,
  },
};

// ─── Pure functions ───────────────────────────────────────────────────────────

const KEY_AGES   = [0, 5, 10, 15, 20, 25];
const KEY_FIELDS = ["age0", "age5", "age10", "age15", "age20", "age25"] as const;

/**
 * Linearly interpolate residual value % at a given age.
 * Clamps to age-25 floor for aircraft older than 25yr.
 * Returns 1.0 for negative ages (data anomaly / pre-delivery).
 */
export function computeResidualValuePct(
  family: AircraftFamily,
  ageYears: number,
): number {
  if (ageYears < 0) return 1.0;
  const schedule = DEFAULT_RESIDUAL_CURVES[family];
  if (ageYears >= 25) return schedule.age25;

  for (let i = 0; i < KEY_AGES.length - 1; i++) {
    if (ageYears >= KEY_AGES[i] && ageYears < KEY_AGES[i + 1]) {
      const t   = (ageYears - KEY_AGES[i]) / (KEY_AGES[i + 1] - KEY_AGES[i]);
      const lo  = schedule[KEY_FIELDS[i]];
      const hi  = schedule[KEY_FIELDS[i + 1]];
      return lo + t * (hi - lo);
    }
  }
  return schedule.age25;
}

/**
 * Derive LGD benchmark from residual value % and recovery factor.
 * LGD = max(0.05, 1 − residualValuePct × recoveryFactor)
 */
export function computeLgdBenchmark(
  family: AircraftFamily,
  ageYears: number,
  recoveryFactor: number,
): number {
  const residualPct = computeResidualValuePct(family, ageYears);
  return Math.max(0.05, 1 - residualPct * recoveryFactor);
}

/**
 * Compute fleet-weighted LGD adjustment for the ECL engine.
 *
 * Weighting:
 *   - When provisions provided and at least one has non-null EAD: EAD-weighted.
 *   - When provisions provided but all EAD are null: equal-weighted across qualifying assets.
 *   - When provisions empty: equal-weighted across qualifying assets.
 *
 * Returns:
 *   lgdDecayAdjFactor = clamp(fleetWeightedLgd − DEFAULT_BASELINE_LGD, 0, 0.50)
 *   perAssetLgd = map of asset.id → LGD benchmark
 */
export function computeFleetLgdAdjustment(
  assets: Asset[],
  provisions: Provision[],
  recoveryFactor: number,
  reportingYear: number = new Date().getFullYear(),
): { lgdDecayAdjFactor: number; perAssetLgd: Map<string, number> } {
  const perAssetLgd = new Map<string, number>();
  if (assets.length === 0) return { lgdDecayAdjFactor: 0, perAssetLgd };

  // Build asset_id → total EAD from provisions
  const eadByAsset = new Map<string, number>();
  for (const p of provisions) {
    if (p.ead != null && p.ead > 0) {
      eadByAsset.set(p.asset_id, (eadByAsset.get(p.asset_id) ?? 0) + p.ead);
    }
  }

  // Compute per-asset LGD for qualifying assets (known vintage)
  for (const asset of assets) {
    if (asset.vintage == null) continue;
    const ageYears = reportingYear - asset.vintage;
    if (ageYears < 0) continue;
    const family = classifyAircraftFamily(asset.aircraft_type);
    const lgd    = computeLgdBenchmark(family, ageYears, recoveryFactor);
    perAssetLgd.set(asset.id, lgd);
  }

  if (perAssetLgd.size === 0) return { lgdDecayAdjFactor: 0, perAssetLgd };

  // Compute weighted average LGD
  let weightedLgdSum = 0;
  let totalWeight    = 0;
  for (const [assetId, lgd] of perAssetLgd) {
    const weight = eadByAsset.get(assetId) ?? 1; // equal weight when no EAD
    weightedLgdSum += lgd * weight;
    totalWeight    += weight;
  }

  const fleetWeightedLgd = weightedLgdSum / totalWeight;
  const lgdDecayAdjFactor = Math.min(0.50, Math.max(0, fleetWeightedLgd - DEFAULT_BASELINE_LGD));

  return { lgdDecayAdjFactor, perAssetLgd };
}
