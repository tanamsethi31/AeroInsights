// src/app/utils/ratingPD.ts
// Pure-function utilities for lessee credit quality / IFRS 9 stage analysis.
// No React dependencies — safe to use in both components and tests.

import type { Lessee, Lease } from "../types/portfolio";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PDThresholds {
  /** PD ≤ s1Max → Stage 1 */
  s1Max: number;
  /** s1Max < PD ≤ s2Max → Stage 2; PD > s2Max → Stage 3 */
  s2Max: number;
}

/** IATA aviation-industry standard thresholds (default). */
export const IATA_THRESHOLDS: PDThresholds = { s1Max: 0.01, s2Max: 0.20 };

/** Tighter thresholds — more conservative classification. */
export const TIGHT_THRESHOLDS: PDThresholds = { s1Max: 0.02, s2Max: 0.15 };

/**
 * Rental-weighted S2 PD that corresponds to pdS2Multi = 1.0 in the base ECL ($47.2M).
 * Used to derive impliedPdS2Multi from actual portfolio data.
 */
export const BASELINE_S2_PD = 0.05;  // 5%

/**
 * Rental-weighted S3 PD that corresponds to pdS3Multi = 1.0 in the base ECL ($47.2M).
 * Used to derive impliedPdS3Multi from actual portfolio data.
 */
export const BASELINE_S3_PD = 0.30;  // 30%

export interface RatingPDRow {
  lesseeId:        string;
  lesseeName:      string;
  creditRating:    string | null;
  pdEstimate:      number | null;     // null = not populated in portfolio data
  pdStage:         1 | 2 | 3 | null; // null if pdEstimate is null
  watchlistStage:  1 | 2 | 3 | null; // null if watchlist_status is null
  stageDivergence: boolean;           // true when both non-null and pdStage ≠ watchlistStage
  weightPct:       number;            // 0–1 rental share
  monthlyRental:   number;            // USD
}

// ─── Classifiers ─────────────────────────────────────────────────────────────

/**
 * Map a lessee's pd_estimate to an IFRS 9 stage using configurable thresholds.
 * Returns null if pd is null (no data — shown as "—" in the table).
 */
export function pdImpliedStage(
  pd: number | null,
  thresholds: PDThresholds,
): 1 | 2 | 3 | null {
  if (pd === null) return null;
  if (pd <= thresholds.s1Max) return 1;
  if (pd <= thresholds.s2Max) return 2;
  return 3;
}

/**
 * Map a lessee's watchlist_status to an implied IFRS 9 stage.
 * null status → null (no watchlist signal; shown as "—" in the table, not counted in divergence).
 */
export function watchlistImpliedStage(
  status: "green" | "amber" | "red" | null,
): 1 | 2 | 3 | null {
  if (status === "red")   return 3;
  if (status === "amber") return 2;
  if (status === "green") return 1;
  return null;
}

// ─── Portfolio computation ────────────────────────────────────────────────────

/**
 * Compute portfolio-level IFRS 9 stage analysis from lessee PD estimates and watchlist status.
 *
 * Exclusion rules (same pattern as other portfolio utilities):
 *   - Lessee with no matching lease → excluded entirely.
 *   - Lessee with null or zero monthly_rental → excluded entirely.
 *   - Null pd_estimate → included in table (pdStage: null), excluded from weighted PD
 *     and multiplier computation.
 *   - Null watchlist_status → included in table (watchlistStage: null), not counted as divergence.
 *
 * Multipliers: impliedPdS2Multi = rentalWeightedAvgPD(S2 bucket) / BASELINE_S2_PD
 *              impliedPdS3Multi = rentalWeightedAvgPD(S3 bucket) / BASELINE_S3_PD
 * Empty stage bucket → multiplier stays at 1.0. Clamped to [0.5, 5.0].
 *
 * Rows sorted by weightPct descending.
 */
export function computePortfolioRatingPD(
  lessees: Lessee[],
  leases:  Lease[],
  thresholds: PDThresholds = IATA_THRESHOLDS,
): {
  rows:                RatingPDRow[];
  portfolioWeightedPD: number;   // rental-weighted avg PD; 0 if no PD data
  pctS1:               number;   // 0–1 rental share, PD-implied stage
  pctS2:               number;
  pctS3:               number;
  impliedPdS2Multi:    number;   // ≥ 0.5, ≤ 5.0
  impliedPdS3Multi:    number;
  divergenceCount:     number;
} {
  const empty = {
    rows: [], portfolioWeightedPD: 0,
    pctS1: 0, pctS2: 0, pctS3: 0,
    impliedPdS2Multi: 1.0, impliedPdS3Multi: 1.0,
    divergenceCount: 0,
  };
  if (lessees.length === 0 || leases.length === 0) return empty;

  // Build lesseeId → first lease with positive rental
  const leaseByLessee = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByLessee.has(lease.lessee_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByLessee.set(lease.lessee_id, lease);
    }
  }

  // Build raw rows
  const rawRows: RatingPDRow[] = [];
  let totalRental = 0;

  for (const lessee of lessees) {
    const lease = leaseByLessee.get(lessee.id);
    if (!lease || !lease.monthly_rental) continue;

    const pdStage        = pdImpliedStage(lessee.pd_estimate, thresholds);
    const watchlistStage = watchlistImpliedStage(lessee.watchlist_status);
    const stageDivergence =
      pdStage !== null && watchlistStage !== null && pdStage !== watchlistStage;

    rawRows.push({
      lesseeId:        lessee.id,
      lesseeName:      lessee.name,
      creditRating:    lessee.credit_rating,
      pdEstimate:      lessee.pd_estimate,
      pdStage,
      watchlistStage,
      stageDivergence,
      weightPct:       0,  // filled in second pass
      monthlyRental:   lease.monthly_rental,
    });
    totalRental += lease.monthly_rental;
  }

  if (totalRental === 0) return empty;

  // Second pass: weights and aggregate sums
  let weightedPDSum   = 0;
  let pdRentalTotal   = 0;  // rental of lessees with non-null pd_estimate
  let s1Rental = 0, s2Rental = 0, s3Rental = 0;
  let s2WeightedPDSum = 0, s2RentalTotal = 0;
  let s3WeightedPDSum = 0, s3RentalTotal = 0;
  let divergenceCount = 0;

  for (const row of rawRows) {
    row.weightPct = row.monthlyRental / totalRental;

    if (row.stageDivergence) divergenceCount++;

    if (row.pdEstimate !== null) {
      weightedPDSum += row.pdEstimate * row.monthlyRental;
      pdRentalTotal += row.monthlyRental;
    }

    if (row.pdStage === 1) s1Rental += row.monthlyRental;
    if (row.pdStage === 2) {
      s2Rental        += row.monthlyRental;
      if (row.pdEstimate !== null) {
        s2WeightedPDSum += row.pdEstimate * row.monthlyRental;
        s2RentalTotal   += row.monthlyRental;
      }
    }
    if (row.pdStage === 3) {
      s3Rental        += row.monthlyRental;
      if (row.pdEstimate !== null) {
        s3WeightedPDSum += row.pdEstimate * row.monthlyRental;
        s3RentalTotal   += row.monthlyRental;
      }
    }
  }

  rawRows.sort((a, b) => b.weightPct - a.weightPct);

  const portfolioWeightedPD = pdRentalTotal > 0 ? weightedPDSum / pdRentalTotal : 0;
  const pctS1 = s1Rental / totalRental;
  const pctS2 = s2Rental / totalRental;
  const pctS3 = s3Rental / totalRental;

  const rawS2Multi = s2RentalTotal > 0
    ? (s2WeightedPDSum / s2RentalTotal) / BASELINE_S2_PD
    : 1.0;
  const rawS3Multi = s3RentalTotal > 0
    ? (s3WeightedPDSum / s3RentalTotal) / BASELINE_S3_PD
    : 1.0;

  const clamp = (v: number) => Math.min(5.0, Math.max(0.5, v));

  return {
    rows: rawRows,
    portfolioWeightedPD,
    pctS1, pctS2, pctS3,
    impliedPdS2Multi: clamp(rawS2Multi),
    impliedPdS3Multi: clamp(rawS3Multi),
    divergenceCount,
  };
}
