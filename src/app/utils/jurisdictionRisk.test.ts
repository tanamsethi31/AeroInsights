import { describe, it, expect } from "vitest";
import { ctcTier, computePortfolioJurisdictionMix, UNKNOWN_REPOSS_P50 } from "./jurisdictionRisk";
import type { Jurisdiction } from "../components/jurisdictions/jurisdictionData";
import type { Lessee, Lease } from "../types/portfolio";

function makeJ(ctcParty: boolean, ctcScore: number): Jurisdiction {
  return {
    code: "XX", country: "Test", flag: "🏳", region: "Test",
    ctcParty, ctcScore, altA: false, idera: false,
    enforceability: 50, ruleOfLaw: 50, sanctions: "None",
    repossP50: 10, repossP90: 20, repossP50Cost: "5%", repossP90Cost: "10%",
    successProb: "70%", precedentCount: 0,
    narrative: "", uncertaintyBand: "high", lastUpdated: "2026-01-01",
  };
}

function makeLessee(id: string, name: string, country: string): Lessee {
  return { id, org_id: "demo", name, iata_code: null, country, credit_rating: null, pd_estimate: null, watchlist_status: null, created_at: "2024-01-01T00:00:00Z" };
}

function makeLease(lesseeId: string, monthlyRental: number): Lease {
  return { id: `ls-${lesseeId}`, org_id: "demo", asset_id: `a-${lesseeId}`, lessee_id: lesseeId, start_date: "2024-01-01", end_date: "2030-01-01", monthly_rental: monthlyRental, currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" };
}

describe("ctcTier", () => {
  it("undefined → nonCtc", () => {
    expect(ctcTier(undefined)).toBe("nonCtc");
  });

  it("ctcParty:true AND ctcScore≥80 → gold", () => {
    expect(ctcTier(makeJ(true, 88))).toBe("gold");
    expect(ctcTier(makeJ(true, 80))).toBe("gold");
  });

  it("ctcParty:true AND ctcScore<80 → moderate", () => {
    expect(ctcTier(makeJ(true, 79))).toBe("moderate");
    expect(ctcTier(makeJ(true, 50))).toBe("moderate");
  });

  it("ctcParty:false AND ctcScore≥50 → moderate", () => {
    expect(ctcTier(makeJ(false, 52))).toBe("moderate");
    expect(ctcTier(makeJ(false, 50))).toBe("moderate");
  });

  it("ctcParty:false AND ctcScore<50 → nonCtc", () => {
    expect(ctcTier(makeJ(false, 49))).toBe("nonCtc");
    expect(ctcTier(makeJ(false, 0))).toBe("nonCtc");
  });
});

describe("computePortfolioJurisdictionMix", () => {
  it("empty lessees → all zero, empty rows", () => {
    const result = computePortfolioJurisdictionMix([], []);
    expect(result.ctcGoldPct).toBe(0);
    expect(result.nonCtcPct).toBe(0);
    expect(result.rows).toHaveLength(0);
  });

  it("single Gold lessee (Ireland) → ctcGoldPct=1, nonCtcPct=0", () => {
    const lessees = [makeLessee("l1", "Ryanair", "Ireland")];
    const leases  = [makeLease("l1", 340000)];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.ctcGoldPct).toBeCloseTo(1.0, 5);
    expect(result.nonCtcPct).toBeCloseTo(0, 5);
  });

  it("single Non-CTC lessee (Sri Lanka) → ctcGoldPct=0, nonCtcPct=1", () => {
    const lessees = [makeLessee("l1", "SriLankan Airlines", "Sri Lanka")];
    const leases  = [makeLease("l1", 480000)];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.ctcGoldPct).toBeCloseTo(0, 5);
    expect(result.nonCtcPct).toBeCloseTo(1.0, 5);
  });

  it("unknown country → treated as Non-CTC with UNKNOWN_REPOSS_P50 sentinel", () => {
    const lessees = [makeLessee("l1", "Mystery Airline", "Neverland")];
    const leases  = [makeLease("l1", 100000)];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.nonCtcPct).toBeCloseTo(1.0, 5);
    expect(result.rows[0].tier).toBe("nonCtc");
    expect(result.rows[0].repossP50).toBe(UNKNOWN_REPOSS_P50);
  });

  it("equal mix: Gold + NonCTC → each 50%", () => {
    const lessees = [
      makeLessee("l1", "Gold Airline", "Ireland"),
      makeLessee("l2", "NonCtc Airline", "Sri Lanka"),
    ];
    const leases = [makeLease("l1", 500000), makeLease("l2", 500000)];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.ctcGoldPct).toBeCloseTo(0.5, 5);
    expect(result.nonCtcPct).toBeCloseTo(0.5, 5);
  });

  it("rows sorted by weightPct descending", () => {
    const lessees = [
      makeLessee("l1", "Small", "Sri Lanka"),
      makeLessee("l2", "Large", "Ireland"),
    ];
    const leases = [makeLease("l1", 100000), makeLease("l2", 900000)];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.rows[0].lesseeName).toBe("Large");
    expect(result.rows[1].lesseeName).toBe("Small");
  });

  it("lessee with no matching lease is excluded", () => {
    const lessees = [
      makeLessee("l1", "With Lease", "Ireland"),
      makeLessee("l2", "No Lease",   "Germany"),
    ];
    const leases = [makeLease("l1", 500000)];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].lesseeName).toBe("With Lease");
  });

  it("lessee with null monthly_rental is excluded", () => {
    const lessees = [makeLessee("l1", "Null Rental", "Ireland")];
    const leases = [{ ...makeLease("l1", 0), monthly_rental: null }];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.rows).toHaveLength(0);
  });
});
