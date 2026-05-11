import { describe, it, expect } from "vitest";
import {
  isPbhCandidate,
  isEtpCandidate,
  isLecCandidate,
  daysUntil,
  computePortfolioMitigationAnalysis,
  MITIGATION_TYPES,
} from "./lessorMitigation";
import type { Lessee, Lease } from "../types/portfolio";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLessee(
  id: string,
  name: string,
  watchlistStatus: "green" | "amber" | "red" | null,
): Lessee {
  return {
    id, name,
    org_id: "test",
    iata_code: null,
    country: "Ireland",
    credit_rating: null,
    pd_estimate: null,
    watchlist_status: watchlistStatus,
    created_at: "2024-01-01T00:00:00Z",
  };
}

function makeLease(
  lesseeId: string,
  monthlyRental: number | null,
  stage: 1 | 2 | 3 | null,
  endDate: string,
): Lease {
  return {
    id: `ls-${lesseeId}`,
    org_id: "test",
    asset_id: `a-${lesseeId}`,
    lessee_id: lesseeId,
    start_date: "2024-01-01",
    end_date: endDate,
    monthly_rental: monthlyRental,
    currency: "USD",
    stage,
    created_at: "2024-01-01T00:00:00Z",
  };
}

// Reference date pinned to avoid flaky time-based tests
const REF = new Date("2026-01-01");

// ─── daysUntil ────────────────────────────────────────────────────────────────

describe("daysUntil", () => {
  it("future date → positive days", () => {
    expect(daysUntil("2026-04-01", REF)).toBeGreaterThan(0);
  });

  it("past date → negative days", () => {
    expect(daysUntil("2025-01-01", REF)).toBeLessThan(0);
  });

  it("same date → 0", () => {
    expect(daysUntil("2026-01-01", REF)).toBe(0);
  });
});

// ─── candidacy predicates ─────────────────────────────────────────────────────

describe("isPbhCandidate", () => {
  it("stage 2 → candidate", () => {
    expect(isPbhCandidate(2, null)).toBe(true);
  });

  it("stage 3 → candidate", () => {
    expect(isPbhCandidate(3, "green")).toBe(true);
  });

  it("amber watchlist, stage 1 → candidate", () => {
    expect(isPbhCandidate(1, "amber")).toBe(true);
  });

  it("red watchlist, stage 1 → candidate", () => {
    expect(isPbhCandidate(1, "red")).toBe(true);
  });

  it("stage 1, null watchlist → not candidate", () => {
    expect(isPbhCandidate(1, null)).toBe(false);
  });

  it("stage 1, green watchlist → not candidate", () => {
    expect(isPbhCandidate(1, "green")).toBe(false);
  });
});

describe("isEtpCandidate", () => {
  it("days to end < 365 → candidate", () => {
    expect(isEtpCandidate(364)).toBe(true);
    expect(isEtpCandidate(0)).toBe(true);
  });

  it("days to end = 365 → not candidate", () => {
    expect(isEtpCandidate(365)).toBe(false);
  });

  it("days to end > 365 → not candidate", () => {
    expect(isEtpCandidate(500)).toBe(false);
  });
});

describe("isLecCandidate", () => {
  it("days to end < 548 (18 months) → candidate", () => {
    expect(isLecCandidate(547)).toBe(true);
    expect(isLecCandidate(0)).toBe(true);
  });

  it("days to end = 548 → not candidate", () => {
    expect(isLecCandidate(548)).toBe(false);
  });

  it("days to end > 548 → not candidate", () => {
    expect(isLecCandidate(700)).toBe(false);
  });
});

// ─── MITIGATION_TYPES ─────────────────────────────────────────────────────────

describe("MITIGATION_TYPES", () => {
  it("has PBH, ETP, LEC entries", () => {
    expect(MITIGATION_TYPES.pbh).toBeDefined();
    expect(MITIGATION_TYPES.etp).toBeDefined();
    expect(MITIGATION_TYPES.lec).toBeDefined();
  });

  it("PBH eclFactor = 0.15", () => {
    expect(MITIGATION_TYPES.pbh.eclFactor).toBe(0.15);
  });

  it("ETP eclFactor = 0.08", () => {
    expect(MITIGATION_TYPES.etp.eclFactor).toBe(0.08);
  });

  it("LEC eclFactor = 0.05", () => {
    expect(MITIGATION_TYPES.lec.eclFactor).toBe(0.05);
  });
});

// ─── computePortfolioMitigationAnalysis ───────────────────────────────────────

describe("computePortfolioMitigationAnalysis", () => {
  it("empty lessees → zero totals, empty rows", () => {
    const result = computePortfolioMitigationAnalysis([], [], REF);
    expect(result.rows).toHaveLength(0);
    expect(result.totalRentalM).toBe(0);
    expect(result.pbhCandidateRentalSharePct).toBe(0);
  });

  it("lessee with null monthly_rental is excluded", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l1", null, 1, "2030-01-01")];
    const result  = computePortfolioMitigationAnalysis(lessees, leases, REF);
    expect(result.rows).toHaveLength(0);
  });

  it("lessee with no matching lease is excluded", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l2", 1_000_000, 1, "2030-01-01")];
    const result  = computePortfolioMitigationAnalysis(lessees, leases, REF);
    expect(result.rows).toHaveLength(0);
  });

  it("stage 2 lessee → isPbhCandidate=true", () => {
    const lessees = [makeLessee("l1", "Distressed Air", null)];
    const leases  = [makeLease("l1", 1_000_000, 2, "2030-01-01")];
    const result  = computePortfolioMitigationAnalysis(lessees, leases, REF);
    expect(result.rows[0].isPbhCandidate).toBe(true);
    expect(result.pbhCandidateRentalSharePct).toBeCloseTo(1.0, 5);
  });

  it("stage 1 green lessee with lease ending in 6 months → ETP + LEC candidate, not PBH", () => {
    // 6 months ≈ 182 days < 365 (ETP) and < 548 (LEC)
    const lessees = [makeLessee("l1", "Short Lease Air", "green")];
    const leases  = [makeLease("l1", 1_000_000, 1, "2026-07-01")]; // ~181 days from REF
    const result  = computePortfolioMitigationAnalysis(lessees, leases, REF);
    expect(result.rows[0].isPbhCandidate).toBe(false);
    expect(result.rows[0].isEtpCandidate).toBe(true);
    expect(result.rows[0].isLecCandidate).toBe(true);
  });

  it("stage 1, green, lease ending in 2 years → no candidacy", () => {
    const lessees = [makeLessee("l1", "Healthy Air", "green")];
    const leases  = [makeLease("l1", 1_000_000, 1, "2028-01-01")]; // > 548 days
    const result  = computePortfolioMitigationAnalysis(lessees, leases, REF);
    expect(result.rows[0].isPbhCandidate).toBe(false);
    expect(result.rows[0].isEtpCandidate).toBe(false);
    expect(result.rows[0].isLecCandidate).toBe(false);
  });

  it("pbhCandidateRentalSharePct is rental-weighted, not count-weighted", () => {
    const lessees = [
      makeLessee("l1", "Big Distressed",  null),  // stage 2, $4M → PBH candidate
      makeLessee("l2", "Small Healthy",   null),  // stage 1, $1M → not PBH
    ];
    const leases = [
      makeLease("l1", 4_000_000, 2, "2030-01-01"),
      makeLease("l2", 1_000_000, 1, "2030-01-01"),
    ];
    const result = computePortfolioMitigationAnalysis(lessees, leases, REF);
    // PBH candidate = $4M of $5M total = 80%
    expect(result.pbhCandidateRentalSharePct).toBeCloseTo(0.80, 5);
    expect(result.totalRentalM).toBeCloseTo(5.0, 5);
  });

  it("rows sorted: candidates first (by candidacy score desc), then monthly rental descending", () => {
    const lessees = [
      makeLessee("l1", "No Candidate",  "green"),
      makeLessee("l2", "PBH Only",      null),    // stage 2 only
      makeLessee("l3", "All Three",     "red"),   // stage 3 + short lease
    ];
    const leases = [
      makeLease("l1", 1_000_000, 1,    "2030-01-01"),
      makeLease("l2", 2_000_000, 2,    "2030-01-01"),
      makeLease("l3", 3_000_000, 3,    "2026-03-01"), // ~59 days → ETP+LEC too
    ];
    const result = computePortfolioMitigationAnalysis(lessees, leases, REF);
    // All Three has 3 candidacies (pbh + etp + lec), PBH Only has 1, No Candidate has 0
    expect(result.rows[0].lesseeName).toBe("All Three");
    expect(result.rows[1].lesseeName).toBe("PBH Only");
    expect(result.rows[2].lesseeName).toBe("No Candidate");
  });
});
