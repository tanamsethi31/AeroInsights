// src/app/utils/deferralRisk.ts
// Pure-function utilities for restructuring scenario presets and deferral risk tier computation.
// No React dependencies — safe to use in both components and tests.

import type { Lessee, Lease } from "../types/portfolio";

// ─── Restructuring presets ─────────────────────────────────────────────────────

export interface RestructuringPreset {
  label:           string;
  deferralMonths:  number;
  govtSupportProb: number;
  forgivenessRate: number;
  description:     string;
}

/**
 * Named restructuring scenario presets. Each preset maps to three existing deferral
 * slider values (deferralMonths, govtSupportProb, forgivenessRate). Selecting a preset
 * populates those sliders — it has no direct ECL formula effect beyond what those
 * sliders already produce.
 *
 * Standstill: forgivenessRate=0 → $0 deferral ECL (IFRS 9 excludes TVM modification loss).
 */
export const RESTRUCTURING_TYPES: Record<string, RestructuringPreset> = {
  standstill: {
    label:           "Standstill Agreement",
    deferralMonths:  6,
    govtSupportProb: 0.10,
    forgivenessRate: 0.00,
    description:     "Temporary payment halt while restructuring is negotiated. Full repayment expected — forgivenessRate=0 → $0 deferral ECL (IFRS 9 excludes TVM modification loss).",
  },
  rent_reduction: {
    label:           "Rent Reduction",
    deferralMonths:  12,
    govtSupportProb: 0.20,
    forgivenessRate: 0.35,
    description:     "Permanent partial rent write-down agreed with lessee. 35% of deferred rent forgiven after 20% govt backstop.",
  },
  equity_debt_swap: {
    label:           "Equity-for-Debt",
    deferralMonths:  18,
    govtSupportProb: 0.30,
    forgivenessRate: 0.60,
    description:     "Deferred rent converted to diluted airline equity stake. Lessor recovers equity value at significant discount; 60% treated as write-off.",
  },
  full_forgiveness: {
    label:           "Full Write-off",
    deferralMonths:  24,
    govtSupportProb: 0.00,
    forgivenessRate: 1.00,
    description:     "Complete loss crystallisation. All deferred rent permanently written off. No govt backstop assumed.",
  },
};

// ─── Deferral risk tier ────────────────────────────────────────────────────────

export type DeferralRiskTier = "high" | "medium" | "low";

export interface DeferralRiskRow {
  lesseeName:        string;
  stage:             number;              // 1 | 2 | 3 (defaults to 1 if null)
  watchlistStatus:   "green" | "amber" | "red" | null;
  riskTier:          DeferralRiskTier;
  monthlyRentalM:    number;             // $M
  deferredExposureM: number;             // monthlyRentalM × deferralMonths
  expectedLossM:     number;             // deferredExposureM × (1 − govtSupportProb) × forgivenessRate
  rentalSharePct:    number;             // 0–1 share of total fleet monthly rent
}

/**
 * Classify a lessee's deferral risk tier from IFRS 9 stage and watchlist status.
 * Worst signal wins:
 *   stage=3 OR red watchlist → high
 *   stage=2 OR amber watchlist → medium
 *   otherwise (stage 1, green or null watchlist) → low
 */
export function deferralRiskTier(
  stage: number,
  watchlistStatus: "green" | "amber" | "red" | null,
): DeferralRiskTier {
  if (stage === 3 || watchlistStatus === "red") return "high";
  if (stage === 2 || watchlistStatus === "amber") return "medium";
  return "low";
}

// ─── Portfolio computation ─────────────────────────────────────────────────────

/**
 * Compute per-lessee deferral exposure for a given set of restructuring parameters.
 *
 * - Lessees with no matching lease or null/zero monthly_rental are excluded.
 * - lease.stage defaults to 1 if null.
 * - totalDeferredM = sum(monthlyRentalM × deferralMonths) across included lessees.
 * - expectedWriteOffM = totalDeferredM × (1 − govtSupportProb) × forgivenessRate
 * - govtBufferM = totalDeferredM × govtSupportProb × forgivenessRate
 * - Rows sorted: high risk first → medium → low; within same tier, monthly rental descending.
 */
export function computePortfolioDeferralRisk(
  lessees:         Lessee[],
  leases:          Lease[],
  deferralMonths:  number,
  govtSupportProb: number,
  forgivenessRate: number,
): {
  rows:              DeferralRiskRow[];
  totalDeferredM:    number;
  expectedWriteOffM: number;
  govtBufferM:       number;
} {
  const empty = { rows: [], totalDeferredM: 0, expectedWriteOffM: 0, govtBufferM: 0 };
  if (lessees.length === 0 || leases.length === 0) return empty;

  // Build lessee_id → first matching lease with positive rental
  const leaseByLessee = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByLessee.has(lease.lessee_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByLessee.set(lease.lessee_id, lease);
    }
  }

  let totalRental = 0;
  const rawRows: DeferralRiskRow[] = [];

  for (const lessee of lessees) {
    const lease = leaseByLessee.get(lessee.id);
    if (!lease || !lease.monthly_rental) continue;

    const stage             = lease.stage ?? 1;
    const watchlistStatus   = lessee.watchlist_status;
    const rental            = lease.monthly_rental;
    const monthlyRentalM    = rental / 1_000_000;
    const deferredExposureM = monthlyRentalM * deferralMonths;
    const expectedLossM     = deferredExposureM * (1 - govtSupportProb) * forgivenessRate;

    rawRows.push({
      lesseeName: lessee.name,
      stage,
      watchlistStatus,
      riskTier:          deferralRiskTier(stage, watchlistStatus),
      monthlyRentalM,
      deferredExposureM,
      expectedLossM,
      rentalSharePct: 0, // filled in second pass
    });
    totalRental += rental;
  }

  if (rawRows.length === 0) return empty;

  // Second pass: rental share weights
  for (const row of rawRows) {
    row.rentalSharePct = (row.monthlyRentalM * 1_000_000) / totalRental;
  }

  // Sort: high → medium → low, then monthly rental descending within tier
  const TIER_ORDER: Record<DeferralRiskTier, number> = { high: 0, medium: 1, low: 2 };
  rawRows.sort(
    (a, b) =>
      TIER_ORDER[a.riskTier] - TIER_ORDER[b.riskTier] ||
      b.monthlyRentalM - a.monthlyRentalM,
  );

  const totalDeferredM    = rawRows.reduce((s, r) => s + r.deferredExposureM, 0);
  const expectedWriteOffM = totalDeferredM * (1 - govtSupportProb) * forgivenessRate;
  const govtBufferM       = totalDeferredM * govtSupportProb * forgivenessRate;

  return { rows: rawRows, totalDeferredM, expectedWriteOffM, govtBufferM };
}
