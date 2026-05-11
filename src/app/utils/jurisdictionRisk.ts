// src/app/utils/jurisdictionRisk.ts
// Pure-function utilities for CTC tier classification and portfolio jurisdiction mix computation.
// No React dependencies — safe to use in both components and tests.

import { jurisdictions, type Jurisdiction } from "../components/jurisdictions/jurisdictionData";
import type { Lessee, Lease } from "../types/portfolio";

/** Sentinel value for repossP50 when the jurisdiction is not found in jurisdictionData. */
export const UNKNOWN_REPOSS_P50 = 99;

export type CtcTier = "gold" | "moderate" | "nonCtc";

export interface JurisdictionRow {
  lesseeName: string;
  country: string;
  tier: CtcTier;
  ctcScore: number;
  repossP50: number;
  weightPct: number;     // 0–1: share of total fleet rental
  monthlyRental: number; // USD
}

/**
 * Classify a jurisdiction into a CTC tier.
 *   Gold     = ctcParty:true  AND ctcScore ≥ 80
 *   Moderate = ctcParty:true  AND ctcScore < 80  OR  ctcParty:false AND ctcScore ≥ 50
 *   Non-CTC  = ctcParty:false AND ctcScore < 50  (or unknown/absent jurisdiction)
 */
export function ctcTier(j: Jurisdiction | undefined): CtcTier {
  if (!j) return "nonCtc";
  if (j.ctcParty && j.ctcScore >= 80) return "gold";
  if (j.ctcParty && j.ctcScore < 80)  return "moderate";
  if (!j.ctcParty && j.ctcScore >= 50) return "moderate";
  return "nonCtc";
}

/**
 * Compute the rental-weighted CTC tier mix for a given lessee/lease set.
 * - Lessees with no matching lease, or with null/zero monthly_rental, are excluded.
 * - lessee.country is matched case-insensitively against jurisdiction.country.
 * - Countries absent from jurisdictionData default to Non-CTC.
 *
 * Returns:
 *   ctcGoldPct  — 0–1 share of total rental in Gold jurisdictions
 *   nonCtcPct   — 0–1 share of total rental in Non-CTC jurisdictions
 *   rows        — per-lessee breakdown, sorted by weightPct descending
 */
export function computePortfolioJurisdictionMix(
  lessees: Lessee[],
  leases: Lease[],
): { ctcGoldPct: number; nonCtcPct: number; rows: JurisdictionRow[] } {
  if (lessees.length === 0 || leases.length === 0) {
    return { ctcGoldPct: 0, nonCtcPct: 0, rows: [] };
  }

  // Build lessee_id → first matching lease with positive rental
  const leaseByLessee = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByLessee.has(lease.lessee_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByLessee.set(lease.lessee_id, lease);
    }
  }

  // Build country → Jurisdiction lookup (case-insensitive)
  const jurisMap = new Map<string, Jurisdiction>();
  for (const j of jurisdictions) {
    jurisMap.set(j.country.toLowerCase(), j);
  }

  // Build rows
  const rawRows: JurisdictionRow[] = [];
  let totalRental = 0;

  for (const lessee of lessees) {
    const lease = leaseByLessee.get(lessee.id);
    if (!lease || !lease.monthly_rental) continue;

    const country = lessee.country ?? "";
    const jEntry = jurisMap.get(country.toLowerCase());
    const tier = ctcTier(jEntry);

    const rental = lease.monthly_rental; // narrowed to number — null/zero excluded by guard above
    rawRows.push({
      lesseeName: lessee.name,
      country,
      tier,
      ctcScore: jEntry?.ctcScore ?? 0,
      repossP50: jEntry?.repossP50 ?? UNKNOWN_REPOSS_P50,
      weightPct: 0,          // filled in second pass
      monthlyRental: rental,
    });
    totalRental += rental;
  }

  if (totalRental === 0) return { ctcGoldPct: 0, nonCtcPct: 0, rows: [] };

  // Second pass: compute weights and tier aggregates
  let goldRental = 0;
  let nonCtcRental = 0;

  for (const row of rawRows) {
    row.weightPct = row.monthlyRental / totalRental;
    if (row.tier === "gold")   goldRental   += row.monthlyRental;
    if (row.tier === "nonCtc") nonCtcRental += row.monthlyRental;
  }

  rawRows.sort((a, b) => b.weightPct - a.weightPct);

  return {
    ctcGoldPct: goldRental / totalRental,
    nonCtcPct: nonCtcRental / totalRental,
    rows: rawRows,
  };
}
