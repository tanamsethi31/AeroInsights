// src/app/utils/lessorMitigation.ts
// Pure-function utilities for lessor mitigation candidacy analysis (PBH / ETP / LEC).
// No React dependencies — safe to use in both components and tests.

import type { Lessee, Lease } from "../types/portfolio";

// ─── Mitigation type definitions ──────────────────────────────────────────────

export type MitigationType = "pbh" | "etp" | "lec";

export interface MitigationTypeInfo {
  label:             string;  // Full label
  shortLabel:        string;  // Abbreviation used in table headers
  eclFactor:         number;  // Fraction of baseECL recovered per unit of mitigation
  description:       string;
  candidacyCriteria: string;  // Human-readable criteria shown in UI
}

/**
 * Lessor mitigation mechanisms supported by the ECL scenario builder.
 * eclFactor values mirror the coefficients in computeECLFromBase:
 *   PBH: pbhConversionPct × 0.15 × baseECL
 *   ETP: etpRate × 0.08 × baseECL
 *   LEC: lecRate × 0.05 × baseECL
 */
export const MITIGATION_TYPES: Record<MitigationType, MitigationTypeInfo> = {
  pbh: {
    label:             "Power-by-Hour",
    shortLabel:        "PBH",
    eclFactor:         0.15,
    description:       "Variable rent tied to aircraft flight hours. Reduces lessor credit exposure during low-utilisation periods — lessee only pays when flying. Converting distressed fixed-rent leases to PBH avoids contested rent arrears and preserves the relationship.",
    candidacyCriteria: "Stage 2–3 or amber/red watchlist",
  },
  etp: {
    label:             "Early Termination Payment",
    shortLabel:        "ETP",
    eclFactor:         0.08,
    description:       "Contractual lump-sum payable by lessee on early lease exit. Preserves lessor recovery without triggering full CTC repossession proceedings. Most effective when negotiated before default crystallises.",
    candidacyCriteria: "Lease ending within 12 months",
  },
  lec: {
    label:             "Lease End Compensation",
    shortLabel:        "LEC",
    eclFactor:         0.05,
    description:       "Maintenance reserve shortfall payment at aircraft return, covering half-life redelivery condition gap. Highest relevance as leases approach expiry — ensures lessor recovers full redelivery-condition value.",
    candidacyCriteria: "Lease ending within 18 months",
  },
};

// ─── Candidacy predicates ─────────────────────────────────────────────────────

/**
 * PBH candidate: lessee is in financial stress (IFRS 9 stage 2-3 or amber/red watchlist).
 * These lessees benefit most from variable-rate conversion — fixed-rent arrears are their
 * main default trigger.
 */
export function isPbhCandidate(
  stage: number,
  watchlistStatus: "green" | "amber" | "red" | null,
): boolean {
  return stage >= 2 || watchlistStatus === "amber" || watchlistStatus === "red";
}

/**
 * ETP candidate: lease ending within 12 months (< 365 days).
 * Short runway to negotiate exit terms before expiry gives leverage for ETP.
 */
export function isEtpCandidate(daysToEnd: number): boolean {
  return daysToEnd < 365;
}

/**
 * LEC candidate: lease ending within 18 months (< 548 days).
 * Maintenance reserve shortfall gap is highest as aircraft approach return.
 */
export function isLecCandidate(daysToEnd: number): boolean {
  return daysToEnd < 548;
}

// ─── Date utility ─────────────────────────────────────────────────────────────

/** Days from referenceDate until the ISO date string. Negative = already past. */
export function daysUntil(isoDate: string, referenceDate: Date = new Date()): number {
  const end = new Date(isoDate);
  return Math.round((end.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Row type ─────────────────────────────────────────────────────────────────

export interface MitigationRow {
  lesseeName:      string;
  stage:           number;              // 1 | 2 | 3 (defaults to 1 if null)
  watchlistStatus: "green" | "amber" | "red" | null;
  monthlyRentalM:  number;             // $M
  leaseEndDate:    string;             // ISO date string
  daysToEnd:       number;             // relative to analysis date
  isPbhCandidate:  boolean;
  isEtpCandidate:  boolean;
  isLecCandidate:  boolean;
  candidacyScore:  number;             // 0–3: count of candidacies (used for sort)
}

// ─── Portfolio computation ─────────────────────────────────────────────────────

/**
 * Compute per-lessee mitigation candidacy for PBH, ETP, and LEC.
 *
 * - Lessees with no matching lease or null/zero monthly_rental are excluded.
 * - lease.stage defaults to 1 if null.
 * - lease.end_date used for ETP/LEC candidacy; if null, treated as far future (no ETP/LEC candidacy).
 * - Rows sorted: candidacy score descending (most candidates first), then monthly rental descending.
 * - pbhCandidateRentalSharePct: 0–1 share of total fleet rental in PBH-candidate lessees.
 * - etpCandidateRentalSharePct / lecCandidateRentalSharePct: same for ETP / LEC.
 */
export function computePortfolioMitigationAnalysis(
  lessees:       Lessee[],
  leases:        Lease[],
  referenceDate: Date = new Date(),
): {
  rows:                        MitigationRow[];
  totalRentalM:                number;
  pbhCandidateRentalSharePct:  number;
  etpCandidateRentalSharePct:  number;
  lecCandidateRentalSharePct:  number;
} {
  const empty = {
    rows: [], totalRentalM: 0,
    pbhCandidateRentalSharePct: 0,
    etpCandidateRentalSharePct: 0,
    lecCandidateRentalSharePct: 0,
  };
  if (lessees.length === 0 || leases.length === 0) return empty;

  // Build lessee_id → first matching lease with positive rental
  const leaseByLessee = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByLessee.has(lease.lessee_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByLessee.set(lease.lessee_id, lease);
    }
  }

  let totalRental = 0;
  const rawRows: MitigationRow[] = [];

  for (const lessee of lessees) {
    const lease = leaseByLessee.get(lessee.id);
    if (!lease || !lease.monthly_rental) continue;

    const stage           = lease.stage ?? 1;
    const watchlistStatus = lessee.watchlist_status;
    const rental          = lease.monthly_rental;
    const monthlyRentalM  = rental / 1_000_000;
    const leaseEndDate    = lease.end_date ?? "";
    const daysToEnd       = leaseEndDate ? daysUntil(leaseEndDate, referenceDate) : 9999;

    const candidatePbh = isPbhCandidate(stage, watchlistStatus);
    const candidateEtp = isEtpCandidate(daysToEnd);
    const candidateLec = isLecCandidate(daysToEnd);

    rawRows.push({
      lesseeName:     lessee.name,
      stage,
      watchlistStatus,
      monthlyRentalM,
      leaseEndDate,
      daysToEnd,
      isPbhCandidate:  candidatePbh,
      isEtpCandidate:  candidateEtp,
      isLecCandidate:  candidateLec,
      candidacyScore:  (candidatePbh ? 1 : 0) + (candidateEtp ? 1 : 0) + (candidateLec ? 1 : 0),
    });
    totalRental += rental;
  }

  if (rawRows.length === 0) return empty;

  // Sort: highest candidacy score first, then monthly rental descending
  rawRows.sort(
    (a, b) =>
      b.candidacyScore - a.candidacyScore ||
      b.monthlyRentalM - a.monthlyRentalM,
  );

  // Compute rental-weighted candidacy shares
  let pbhRental = 0;
  let etpRental = 0;
  let lecRental = 0;
  for (const row of rawRows) {
    const r = row.monthlyRentalM * 1_000_000;
    if (row.isPbhCandidate) pbhRental += r;
    if (row.isEtpCandidate) etpRental += r;
    if (row.isLecCandidate) lecRental += r;
  }

  return {
    rows:                        rawRows,
    totalRentalM:                totalRental / 1_000_000,
    pbhCandidateRentalSharePct:  pbhRental / totalRental,
    etpCandidateRentalSharePct:  etpRental / totalRental,
    lecCandidateRentalSharePct:  lecRental / totalRental,
  };
}
