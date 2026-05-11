// src/app/utils/assetRisk.ts
// Pure-function utilities for fleet asset risk analysis (remarketing timeline + vintage LGD).
// No React dependencies — safe to use in both components and tests.

import type { Asset, Lease } from "../types/portfolio";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Base LGD (45%) already prices in 3 months of post-repossession idle time.
 *  Each month beyond this = ~1.5% of baseECL (storage + foregone rent). */
export const REMARKETING_BENCHMARK_MONTHS = 3;

/** Rental-weighted P50 remarketing timeline for narrowbody types (A320/737 family).
 *  Deep global demand — typically placed within a single maintenance cycle. */
export const NB_REMARKETING_MONTHS = 4;

/** Rental-weighted P50 remarketing timeline for widebody types (A330/A350/B777).
 *  Shallower placement pool; longer due-diligence and negotiation timelines. */
export const WB_REMARKETING_MONTHS = 9;

/** Vintage LGD adjustment schedule — additional fraction of baseECL per age tier.
 *  Mid-aged (10–15yr): narrowing buyer pool, mid-life heavy check costs (+4%).
 *  Aged (>15yr): near end-of-economic-life, part-out risk, illiquid secondary market (+10%). */
export const VINTAGE_LGD_TIERS = {
  young: 0,     // < 10 years
  mid:   0.04,  // 10–15 years
  aged:  0.10,  // > 15 years
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type VintageAgeTier = "young" | "mid" | "aged";

export interface AssetRiskRow {
  registration:  string;
  aircraftType:  string;
  vintage:       number;
  ageYears:      number;
  ageTier:       VintageAgeTier;
  lgdAdj:        number;      // 0, 0.04, or 0.10
  isWidebody:    boolean;
  monthlyRental: number;      // USD
  weightPct:     number;      // 0–1 share of total fleet rental
}

// ─── Classifiers ─────────────────────────────────────────────────────────────

/**
 * Returns true for twin-aisle aircraft types.
 * Narrowbody types (A220, A320 family, A321, B737 family, E-jets) return false.
 */
export function isWidebody(aircraftType: string): boolean {
  const wbPrefixes = ["A330", "A340", "A350", "A380", "B767", "B777", "B787", "767", "777", "787"];
  const upper = aircraftType.toUpperCase();
  return wbPrefixes.some((p) => upper.includes(p.toUpperCase()));
}

/**
 * Maps aircraft age in years to a vintage LGD tier.
 *   young: age < 10   — liquid, easily re-leased
 *   mid:   10 ≤ age ≤ 15 — narrowing buyer pool
 *   aged:  age > 15   — near end-of-economic-life
 */
export function vintageAgeTier(ageYears: number): VintageAgeTier {
  if (ageYears > 15) return "aged";
  if (ageYears >= 10) return "mid";
  return "young";
}

/**
 * LGD adjustment fraction for the given aircraft age.
 * Returns a value to be multiplied against baseECL: 0 | 0.04 | 0.10.
 */
export function vintageLGDAdj(ageYears: number): number {
  return VINTAGE_LGD_TIERS[vintageAgeTier(ageYears)];
}

// ─── Portfolio computation ────────────────────────────────────────────────────

/**
 * Compute fleet asset risk metrics from real asset and lease data.
 *
 * Exclusion rules (same pattern as other portfolio utilities):
 *   - Assets with no matching lease are excluded.
 *   - Assets with null or zero monthly_rental are excluded.
 *   - Assets with null vintage are excluded (age cannot be computed).
 *
 * Returns:
 *   suggestedRemarketingMonths — rental-weighted average by NB/WB type, rounded to integer.
 *     0 if no qualifying assets.
 *   vintageAdjFactor — rental-weighted LGD adjustment fraction (0–0.10+).
 *     Pass directly to ScenarioInputs.vintageAdjFactor.
 *   avgFleetAgeYears — rental-weighted average fleet age.
 *   pctMidAged — 0–1 rental share of 10–15yr aircraft.
 *   pctAged    — 0–1 rental share of >15yr aircraft.
 *   rows       — per-asset breakdown, sorted by weightPct descending.
 */
export function computePortfolioAssetRisk(
  assets: Asset[],
  leases: Lease[],
  referenceYear: number = new Date().getFullYear(),
): {
  suggestedRemarketingMonths: number;
  vintageAdjFactor:           number;
  avgFleetAgeYears:           number;
  pctMidAged:                 number;
  pctAged:                    number;
  rows:                       AssetRiskRow[];
} {
  const empty = {
    suggestedRemarketingMonths: 0, vintageAdjFactor: 0,
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

    const ageYears = referenceYear - asset.vintage;
    if (ageYears < 0) continue; // future-vintage aircraft (pre-delivery or data error)
    const tier     = vintageAgeTier(ageYears);
    const lgdAdj   = vintageLGDAdj(ageYears);
    const wb       = isWidebody(asset.aircraft_type);
    const rental   = lease.monthly_rental;

    rawRows.push({
      registration:  asset.registration,
      aircraftType:  asset.aircraft_type,
      vintage:       asset.vintage,
      ageYears,
      ageTier:       tier,
      lgdAdj,
      isWidebody:    wb,
      monthlyRental: rental,
      weightPct:     0,  // filled in second pass
    });
    totalRental += rental;
  }

  if (totalRental === 0) return empty;

  // Second pass: weights and aggregate sums
  let weightedAgeSum        = 0;
  let weightedVintageAdjSum = 0;
  let weightedRemarketSum   = 0;
  let midRental             = 0;
  let agedRental            = 0;

  for (const row of rawRows) {
    row.weightPct = row.monthlyRental / totalRental;
    weightedAgeSum        += row.ageYears * row.monthlyRental;
    weightedVintageAdjSum += row.lgdAdj   * row.monthlyRental;
    weightedRemarketSum   += (row.isWidebody ? WB_REMARKETING_MONTHS : NB_REMARKETING_MONTHS)
                             * row.monthlyRental;
    if (row.ageTier === "mid")  midRental  += row.monthlyRental;
    if (row.ageTier === "aged") agedRental += row.monthlyRental;
  }

  rawRows.sort((a, b) => b.weightPct - a.weightPct);

  return {
    suggestedRemarketingMonths: Math.round(weightedRemarketSum / totalRental),
    vintageAdjFactor:           weightedVintageAdjSum / totalRental,
    avgFleetAgeYears:           weightedAgeSum / totalRental,
    pctMidAged:                 midRental  / totalRental,
    pctAged:                    agedRental / totalRental,
    rows:                       rawRows,
  };
}
