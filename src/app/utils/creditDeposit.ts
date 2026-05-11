// src/app/utils/creditDeposit.ts
// Pure-function utilities for credit-linked security deposit sizing.
// No React dependencies — safe to use in both components and tests.

import type { Lessee, Lease } from "../types/portfolio";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Credit tier derived from lessee watchlist status.
 *   investmentGrade    = watchlist "green"        → deposit waived
 *   subInvestmentGrade = watchlist "amber" or null → 1 month rent
 *   distressed         = watchlist "red"           → 3 months rent
 */
export type CreditDepositTier = "investmentGrade" | "subInvestmentGrade" | "distressed";

export interface DepositRow {
  lesseeName: string;
  watchlistStatus: "green" | "amber" | "red" | null;
  tier: CreditDepositTier;
  depositMonths: 0 | 1 | 3;
  monthlyRentalM: number;       // in $M
  recommendedDepositM: number;  // in $M
  rentalSharePct: number;       // 0–1: share of total fleet rental
}

// ─── Classification ───────────────────────────────────────────────────────────

/**
 * Classify a lessee into a credit deposit tier based on watchlist_status.
 * null → Sub-Investment Grade (conservative default).
 */
export function creditDepositTier(lessee: Lessee): CreditDepositTier {
  if (lessee.watchlist_status === "green") return "investmentGrade";
  if (lessee.watchlist_status === "red")   return "distressed";
  return "subInvestmentGrade"; // amber or null
}

/**
 * Recommended deposit in months of monthly rent.
 *   investmentGrade    → 0 (waived)
 *   subInvestmentGrade → 1
 *   distressed         → 3
 */
export function recommendedDepositMonths(tier: CreditDepositTier): 0 | 1 | 3 {
  if (tier === "investmentGrade") return 0;
  if (tier === "distressed")      return 3;
  return 1; // subInvestmentGrade
}

// ─── Portfolio computation ────────────────────────────────────────────────────

/**
 * Compute recommended deposit amounts across the portfolio.
 *
 * - Lessees with no matching lease or null/zero monthly_rental are excluded.
 * - Returns totalDepositM (in $M) and a per-lessee breakdown sorted by
 *   recommendedDepositM descending.
 *
 * depositCoverage = totalDepositM / liveBaseECL is computed by the caller
 * to avoid coupling this utility to the ECL baseline.
 */
export function computePortfolioDepositCoverage(
  lessees: Lessee[],
  leases: Lease[],
): { totalDepositM: number; rows: DepositRow[] } {
  if (lessees.length === 0 || leases.length === 0) {
    return { totalDepositM: 0, rows: [] };
  }

  // Build lessee_id → first matching lease with positive rental
  const leaseByLessee = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByLessee.has(lease.lessee_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByLessee.set(lease.lessee_id, lease);
    }
  }

  const rawRows: DepositRow[] = [];
  let totalRental = 0;

  for (const lessee of lessees) {
    const lease = leaseByLessee.get(lessee.id);
    if (!lease || !lease.monthly_rental) continue;

    const rental   = lease.monthly_rental; // narrowed: null/zero excluded above
    const tier     = creditDepositTier(lessee);
    const months   = recommendedDepositMonths(tier);
    const depositM = (months * rental) / 1_000_000;
    const rentalM  = rental / 1_000_000;

    rawRows.push({
      lesseeName:          lessee.name,
      watchlistStatus:     lessee.watchlist_status,
      tier,
      depositMonths:       months,
      monthlyRentalM:      rentalM,
      recommendedDepositM: depositM,
      rentalSharePct:      0, // filled in second pass
    });
    totalRental += rental;
  }

  if (rawRows.length === 0) return { totalDepositM: 0, rows: [] };

  // Second pass: compute rentalSharePct and total deposits
  let totalDepositM = 0;
  for (const row of rawRows) {
    row.rentalSharePct = totalRental > 0 ? (row.monthlyRentalM * 1_000_000) / totalRental : 0;
    totalDepositM += row.recommendedDepositM;
  }

  rawRows.sort((a, b) =>
    b.recommendedDepositM - a.recommendedDepositM ||
    b.monthlyRentalM - a.monthlyRentalM
  );

  return { totalDepositM, rows: rawRows };
}
