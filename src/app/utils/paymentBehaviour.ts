// src/app/utils/paymentBehaviour.ts
// Pure-function utilities for regional payment behaviour scoring and ECL mix computation.
// No React dependencies — safe to use in both components and tests.

import type { Lessee, Lease } from "../types/portfolio";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Payment behaviour tier derived from country score.
 *   cooperative  = score ≥ 70 → −7% ECL adjustment
 *   neutral      = score 40–69 → 0% adjustment
 *   adversarial  = score < 40  → +12% ECL adjustment
 */
export type PayBehaviourTier = "cooperative" | "neutral" | "adversarial";

export interface PayBehaviourRow {
  lesseeName:     string;
  country:        string;
  score:          number;       // 0–100; 50 for unknown countries
  tier:           PayBehaviourTier;
  monthlyRentalM: number;       // $M
  rentalSharePct: number;       // 0–1
}

// ─── Score table ──────────────────────────────────────────────────────────────

/**
 * Payment behaviour scores by country (0–100).
 * Keys are lowercase country names (matched case-insensitively against lessee.country).
 * Countries absent from this map default to score 50 (neutral tier).
 *
 * Calibration basis: IATA DPD data, lessor workout precedents, government intervention history.
 */
export const PAYMENT_BEHAVIOUR_SCORES: Record<string, number> = {
  "united states":        85,
  "canada":               68,
  "ireland":              85,
  "germany":              78,
  "france":               55,
  "netherlands":          80,
  "spain":                52,
  "italy":                48,
  "united arab emirates": 82,
  "uae":                  82,  // alias
  "singapore":            90,
  "australia":            80,
  "japan":                88,
  "south korea":          75,
  "india":                42,
  "sri lanka":            28,
  "indonesia":            30,
  "mexico":               32,
  "brazil":               38,
  "colombia":             35,
  "argentina":            20,
  "south africa":         38,
  "kenya":                35,
  "ethiopia":             45,
  "nigeria":              25,
  "pakistan":             22,
  "russia":               15,
  "turkey":               42,
  "qatar":                88,
  "saudi arabia":         75,
  "china":                45,
  "thailand":             40,
  "malaysia":             42,
  "philippines":          35,
};

/** Default score for countries not in the table — neutral tier. */
const DEFAULT_SCORE = 50;

// ─── Classification ───────────────────────────────────────────────────────────

/**
 * Classify a numeric score (0–100) into a payment behaviour tier.
 *   ≥ 70 → cooperative
 *   40–69 → neutral
 *   < 40  → adversarial
 */
export function payBehaviourTier(score: number): PayBehaviourTier {
  if (score >= 70) return "cooperative";
  if (score >= 40) return "neutral";
  return "adversarial";
}

// ─── Portfolio computation ────────────────────────────────────────────────────

/**
 * Compute the rental-weighted payment behaviour tier mix for a lessee/lease set.
 *
 * - Lessees with no matching lease or null/zero monthly_rental are excluded.
 * - lessee.country is matched case-insensitively against PAYMENT_BEHAVIOUR_SCORES.
 * - Countries absent from the table default to neutral (score 50).
 * - null country → neutral (score 50).
 *
 * Returns:
 *   coopPct — 0–1 share of fleet rental in Cooperative tier
 *   advPct  — 0–1 share of fleet rental in Adversarial tier
 *   rows    — per-lessee breakdown, sorted by score ascending then monthlyRentalM descending
 */
export function computePortfolioPaymentBehaviourMix(
  lessees: Lessee[],
  leases:  Lease[],
): { coopPct: number; advPct: number; rows: PayBehaviourRow[] } {
  if (lessees.length === 0 || leases.length === 0) {
    return { coopPct: 0, advPct: 0, rows: [] };
  }

  // Build lessee_id → first matching lease with positive rental
  const leaseByLessee = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByLessee.has(lease.lessee_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByLessee.set(lease.lessee_id, lease);
    }
  }

  const rawRows: PayBehaviourRow[] = [];
  let totalRental = 0;

  for (const lessee of lessees) {
    const lease = leaseByLessee.get(lessee.id);
    if (!lease || !lease.monthly_rental) continue;

    const country = (lessee.country ?? "").toLowerCase();
    const score   = PAYMENT_BEHAVIOUR_SCORES[country] ?? DEFAULT_SCORE;
    const tier    = payBehaviourTier(score);
    const rental  = lease.monthly_rental;

    rawRows.push({
      lesseeName:     lessee.name,
      country:        lessee.country ?? "Unknown",
      score,
      tier,
      monthlyRentalM: rental / 1_000_000,
      rentalSharePct: 0, // filled in second pass
    });
    totalRental += rental;
  }

  if (rawRows.length === 0) return { coopPct: 0, advPct: 0, rows: [] };

  // Second pass: compute weights and tier aggregates
  let coopRental = 0;
  let advRental  = 0;

  for (const row of rawRows) {
    row.rentalSharePct = (row.monthlyRentalM * 1_000_000) / totalRental;
    if (row.tier === "cooperative") coopRental += row.monthlyRentalM * 1_000_000;
    if (row.tier === "adversarial") advRental  += row.monthlyRentalM * 1_000_000;
  }

  rawRows.sort(
    (a, b) =>
      a.score - b.score ||                  // score ascending (worst first)
      b.monthlyRentalM - a.monthlyRentalM   // then rental descending
  );

  return {
    coopPct: coopRental / totalRental,
    advPct:  advRental  / totalRental,
    rows:    rawRows,
  };
}
