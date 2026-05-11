import { describe, it, expect } from "vitest";
import {
  deferralRiskTier,
  computePortfolioDeferralRisk,
  RESTRUCTURING_TYPES,
} from "./deferralRisk";
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
): Lease {
  return {
    id: `ls-${lesseeId}`,
    org_id: "test",
    asset_id: `a-${lesseeId}`,
    lessee_id: lesseeId,
    start_date: "2024-01-01",
    end_date: "2030-01-01",
    monthly_rental: monthlyRental,
    currency: "USD",
    stage,
    created_at: "2024-01-01T00:00:00Z",
  };
}

// ─── deferralRiskTier ─────────────────────────────────────────────────────────

describe("deferralRiskTier", () => {
  it("stage 3 → high regardless of watchlist", () => {
    expect(deferralRiskTier(3, null)).toBe("high");
    expect(deferralRiskTier(3, "green")).toBe("high");
  });

  it("red watchlist → high regardless of stage", () => {
    expect(deferralRiskTier(1, "red")).toBe("high");
    expect(deferralRiskTier(2, "red")).toBe("high");
  });

  it("stage 2, non-red watchlist → medium", () => {
    expect(deferralRiskTier(2, null)).toBe("medium");
    expect(deferralRiskTier(2, "green")).toBe("medium");
  });

  it("amber watchlist, stage 1 → medium", () => {
    expect(deferralRiskTier(1, "amber")).toBe("medium");
  });

  it("stage 1, null watchlist → low", () => {
    expect(deferralRiskTier(1, null)).toBe("low");
  });

  it("stage 1, green watchlist → low", () => {
    expect(deferralRiskTier(1, "green")).toBe("low");
  });
});

// ─── RESTRUCTURING_TYPES ──────────────────────────────────────────────────────

describe("RESTRUCTURING_TYPES", () => {
  it("has exactly 4 entries", () => {
    expect(Object.keys(RESTRUCTURING_TYPES)).toHaveLength(4);
  });

  it("standstill has forgivenessRate=0 (IFRS 9: no ECL impact)", () => {
    expect(RESTRUCTURING_TYPES.standstill.forgivenessRate).toBe(0);
    expect(RESTRUCTURING_TYPES.standstill.deferralMonths).toBe(6);
  });

  it("full_forgiveness has forgivenessRate=1 and govtSupportProb=0", () => {
    expect(RESTRUCTURING_TYPES.full_forgiveness.forgivenessRate).toBe(1.00);
    expect(RESTRUCTURING_TYPES.full_forgiveness.govtSupportProb).toBe(0);
    expect(RESTRUCTURING_TYPES.full_forgiveness.deferralMonths).toBe(24);
  });

  it("equity_debt_swap has deferralMonths=18, govtSupportProb=0.30, forgivenessRate=0.60", () => {
    const p = RESTRUCTURING_TYPES.equity_debt_swap;
    expect(p.deferralMonths).toBe(18);
    expect(p.govtSupportProb).toBe(0.30);
    expect(p.forgivenessRate).toBe(0.60);
  });
});

// ─── computePortfolioDeferralRisk ─────────────────────────────────────────────

describe("computePortfolioDeferralRisk", () => {
  it("empty lessees → zero totals, empty rows", () => {
    const result = computePortfolioDeferralRisk([], [], 12, 0.2, 0.35);
    expect(result.rows).toHaveLength(0);
    expect(result.totalDeferredM).toBe(0);
    expect(result.expectedWriteOffM).toBe(0);
    expect(result.govtBufferM).toBe(0);
  });

  it("lessee with null monthly_rental is excluded", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l1", null, 1)];
    const result  = computePortfolioDeferralRisk(lessees, leases, 12, 0.2, 0.35);
    expect(result.rows).toHaveLength(0);
  });

  it("lessee with no matching lease is excluded", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l2", 1_000_000, 1)];
    const result  = computePortfolioDeferralRisk(lessees, leases, 12, 0.2, 0.35);
    expect(result.rows).toHaveLength(0);
  });

  it("null lease.stage defaults to 1 → low risk tier", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l1", 1_000_000, null)];
    const result  = computePortfolioDeferralRisk(lessees, leases, 6, 0, 0);
    expect(result.rows[0].stage).toBe(1);
    expect(result.rows[0].riskTier).toBe("low");
  });

  it("standstill preset (forgivenessRate=0) → expectedWriteOffM=0 and govtBufferM=0", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l1", 1_000_000, 1)];
    const { deferralMonths, govtSupportProb, forgivenessRate } = RESTRUCTURING_TYPES.standstill;
    const result = computePortfolioDeferralRisk(lessees, leases, deferralMonths, govtSupportProb, forgivenessRate);
    expect(result.expectedWriteOffM).toBe(0);
    expect(result.govtBufferM).toBe(0);
    expect(result.totalDeferredM).toBeGreaterThan(0); // exposure still tracked
  });

  it("deferredExposureM = monthlyRentalM × deferralMonths", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l1", 2_000_000, 1)]; // $2M/mo
    const result  = computePortfolioDeferralRisk(lessees, leases, 12, 0, 0.5);
    expect(result.rows[0].monthlyRentalM).toBeCloseTo(2.0, 5);
    expect(result.rows[0].deferredExposureM).toBeCloseTo(24.0, 5);
  });

  it("totalDeferredM and expectedWriteOffM use correct formulas", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l1", 1_000_000, 1)]; // $1M/mo
    // deferralMonths=12 → totalDeferred=$12M; writeOff=12 × (1−0.2) × 0.35=3.36
    const result = computePortfolioDeferralRisk(lessees, leases, 12, 0.2, 0.35);
    expect(result.totalDeferredM).toBeCloseTo(12.0, 5);
    expect(result.expectedWriteOffM).toBeCloseTo(3.36, 4);
    expect(result.govtBufferM).toBeCloseTo(12 * 0.2 * 0.35, 5); // 0.84
  });

  it("rows sorted: high tier first, monthly rental descending within tier", () => {
    const lessees = [
      makeLessee("l1", "Low Air",  null),    // low tier, $1M
      makeLessee("l2", "High Air", "red"),   // high tier, $2M
      makeLessee("l3", "Med Air",  "amber"), // medium tier, $3M
      makeLessee("l4", "High2",   null),     // stage 3 → high, $0.5M
    ];
    const leases = [
      makeLease("l1", 1_000_000, 1),
      makeLease("l2", 2_000_000, 1),
      makeLease("l3", 3_000_000, 1),
      makeLease("l4", 500_000, 3),
    ];
    const result = computePortfolioDeferralRisk(lessees, leases, 12, 0.2, 0.35);
    expect(result.rows[0].riskTier).toBe("high");
    expect(result.rows[0].lesseeName).toBe("High Air"); // $2M > $0.5M within high
    expect(result.rows[1].riskTier).toBe("high");
    expect(result.rows[1].lesseeName).toBe("High2");
    expect(result.rows[2].riskTier).toBe("medium");
    expect(result.rows[3].riskTier).toBe("low");
  });

  it("rentalSharePct sums to 1.0 across all rows", () => {
    const lessees = [
      makeLessee("l1", "A", null),
      makeLessee("l2", "B", null),
    ];
    const leases = [makeLease("l1", 600_000, 1), makeLease("l2", 400_000, 1)];
    const result = computePortfolioDeferralRisk(lessees, leases, 6, 0.1, 0.35);
    const total = result.rows.reduce((s, r) => s + r.rentalSharePct, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});
