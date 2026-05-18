// src/app/utils/assetRisk.ts
// Pure-function utilities for fleet asset risk analysis (remarketing timeline + LGD decay).
// No React dependencies — safe to use in both components and tests.

import type { Asset, Lease, Provision } from "../types/portfolio";
import { classifyAircraftFamily } from "../data/aircraftFamilyMap";
import { computeLgdBenchmark, DEFAULT_BASELINE_LGD } from "../data/lgdCurves";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Base LGD (45%) already prices in 3 months of post-repossession idle time.
 *  Each month beyond this = ~1.5% of baseECL (storage + foregone rent). */
export const REMARKETING_BENCHMARK_MONTHS = 3;

/** Rental-weighted P50 remarketing timeline for narrowbody types (A320/737 family). */
export const NB_REMARKETING_MONTHS = 4;

/** Rental-weighted P50 remarketing timeline for widebody types (A330/A350/B777). */
export const WB_REMARKETING_MONTHS = 9;

/** Vintage LGD adjustment schedule — retained for display in AssetRiskTab.
 *  The ECL engine now uses decay curves (lgdDecayAdjFactor) instead. */
export const VINTAGE_LGD_TIERS = {
  young: 0,
  mid:   0.04,
  aged:  0.10,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type VintageAgeTier = "young" | "mid" | "aged";

export interface AssetRiskRow {
  assetId:       string;      // asset.id — used to key perAssetLgd map
  registration:  string;
  aircraftType:  string;
  vintage:       number;
  ageYears:      number;
  ageTier:       VintageAgeTier;
  lgdAdj:        number;      // legacy 3-tier adj (0, 0.04, 0.10) — retained for AssetRiskTab display
  lgdBenchmark:  number;      // decay-curve LGD benchmark for this asset
  isWidebody:    boolean;
  monthlyRental: number;
  weightPct:     number;
}

// ─── Classifiers (kept for backward compatibility and AssetRiskTab display) ──

/**
 * Returns true for twin-aisle aircraft types.
 * Used for remarketing timeline selection (NB vs WB months).
 */
export function isWidebody(aircraftType: string): boolean {
  const wbPrefixes = ["A330", "A340", "A350", "A380", "B767", "B777", "B787", "767", "777", "787"];
  const upper = aircraftType.toUpperCase();
  return wbPrefixes.some((p) => upper.includes(p.toUpperCase()));
}

/**
 * Maps aircraft age in years to a vintage LGD tier (for display only — ECL uses decay curves).
 */
export function vintageAgeTier(ageYears: number): VintageAgeTier {
  if (ageYears > 15) return "aged";
  if (ageYears >= 10) return "mid";
  return "young";
}

/**
 * Legacy 3-tier LGD adjustment fraction (for display only — ECL uses decay curves).
 */
export function vintageLGDAdj(ageYears: number): number {
  return VINTAGE_LGD_TIERS[vintageAgeTier(ageYears)];
}

// ─── Portfolio computation ────────────────────────────────────────────────────

/**
 * Compute fleet asset risk metrics from real asset and lease data.
 *
 * New in this version (replaces vintageAdjFactor):
 *   lgdDecayAdjFactor — fleet-weighted LGD uplift from decay curves.
 *     = clamp(fleetWeightedLgd − DEFAULT_BASELINE_LGD, 0, 0.50)
 *     Weighted by EAD (if provisions provided) or monthly rental (fallback).
 *   perAssetLgd — Map<asset_id, LGD benchmark> for per-asset display.
 *
 * Retained:
 *   suggestedRemarketingMonths, avgFleetAgeYears, pctMidAged, pctAged, rows
 *
 * Exclusion rules:
 *   - Assets with no matching lease, null/zero rental, or null vintage are excluded.
 *   - Assets with negative computed age (future-vintage / data error) are excluded.
 *
 * Weighting for lgdDecayAdjFactor:
 *   - provisions provided + any non-null EAD: EAD-weighted (null EAD → weight = 1)
 *   - no provisions: rental-weighted (monthly_rental)
 */
export function computePortfolioAssetRisk(
  assets: Asset[],
  leases: Lease[],
  recoveryFactor: number,
  referenceYear: number = new Date().getFullYear(),
  provisions?: Provision[],
): {
  lgdDecayAdjFactor:          number;
  perAssetLgd:                Map<string, number>;
  suggestedRemarketingMonths: number;
  avgFleetAgeYears:           number;
  pctMidAged:                 number;
  pctAged:                    number;
  rows:                       AssetRiskRow[];
} {
  const empty = {
    lgdDecayAdjFactor: 0, perAssetLgd: new Map<string, number>(),
    suggestedRemarketingMonths: 0,
    avgFleetAgeYears: 0, pctMidAged: 0, pctAged: 0, rows: [],
  };
  if (assets.length === 0 || leases.length === 0) return empty;

  // Build assetId → first lease with positive rental
  const leaseByAsset = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByAsset.has(lease.asset_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByAsset.set(lease.asset_id, lease);
    }
  }

  // Build raw rows
  const rawRows: AssetRiskRow[] = [];
  let totalRental = 0;

  for (const asset of assets) {
    const lease = leaseByAsset.get(asset.id);
    if (!lease || !lease.monthly_rental) continue;
    if (asset.vintage == null) continue;

    const ageYears    = referenceYear - asset.vintage;
    if (ageYears < 0) continue;
    const tier        = vintageAgeTier(ageYears);
    const lgdAdj      = vintageLGDAdj(ageYears);
    const wb          = isWidebody(asset.aircraft_type);
    const family      = classifyAircraftFamily(asset.aircraft_type);
    const lgdBenchmark = computeLgdBenchmark(family, ageYears, recoveryFactor);
    const rental      = lease.monthly_rental;

    rawRows.push({
      assetId:       asset.id,
      registration:  asset.registration,
      aircraftType:  asset.aircraft_type,
      vintage:       asset.vintage,
      ageYears,
      ageTier:       tier,
      lgdAdj,
      lgdBenchmark,
      isWidebody:    wb,
      monthlyRental: rental,
      weightPct:     0,
    });
    totalRental += rental;
  }

  if (totalRental === 0) return empty;

  // Second pass: rental weights and aggregate sums (remarketing + age metrics)
  let weightedAgeSum      = 0;
  let weightedRemarketSum = 0;
  let midRental           = 0;
  let agedRental          = 0;

  for (const row of rawRows) {
    row.weightPct = row.monthlyRental / totalRental;
    weightedAgeSum      += row.ageYears * row.monthlyRental;
    weightedRemarketSum += (row.isWidebody ? WB_REMARKETING_MONTHS : NB_REMARKETING_MONTHS) * row.monthlyRental;
    if (row.ageTier === "mid")  midRental  += row.monthlyRental;
    if (row.ageTier === "aged") agedRental += row.monthlyRental;
  }

  rawRows.sort((a, b) => b.weightPct - a.weightPct);

  // Build perAssetLgd map (keyed by asset.id)
  const perAssetLgd = new Map<string, number>();
  for (const row of rawRows) {
    perAssetLgd.set(row.assetId, row.lgdBenchmark);
  }

  // Compute fleet-weighted LGD for lgdDecayAdjFactor
  // Strategy: EAD-weighted when provisions provided; rental-weighted otherwise.
  // When provisions provided but EAD is null for an asset, weight = 1 (equal weight fallback).
  const hasProvisions = provisions != null && provisions.length > 0;
  const eadByAsset    = new Map<string, number>();
  if (hasProvisions) {
    for (const p of provisions!) {
      if (p.ead != null && p.ead > 0) {
        eadByAsset.set(p.asset_id, (eadByAsset.get(p.asset_id) ?? 0) + p.ead);
      }
    }
  }

  let weightedLgdSum = 0;
  let totalLgdWeight = 0;
  for (const row of rawRows) {
    const weight = hasProvisions
      ? (eadByAsset.get(row.assetId) ?? 1)  // equal weight when EAD null
      : row.monthlyRental;                    // rental-weighted fallback
    weightedLgdSum += row.lgdBenchmark * weight;
    totalLgdWeight += weight;
  }

  const fleetWeightedLgd = totalLgdWeight > 0 ? weightedLgdSum / totalLgdWeight : DEFAULT_BASELINE_LGD;
  const lgdDecayAdjFactor = Math.min(0.50, Math.max(0, fleetWeightedLgd - DEFAULT_BASELINE_LGD));

  return {
    lgdDecayAdjFactor,
    perAssetLgd,
    suggestedRemarketingMonths: Math.round(weightedRemarketSum / totalRental),
    avgFleetAgeYears:           weightedAgeSum / totalRental,
    pctMidAged:                 midRental  / totalRental,
    pctAged:                    agedRental / totalRental,
    rows:                       rawRows,
  };
}
