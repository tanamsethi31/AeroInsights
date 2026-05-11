import { describe, it, expect } from "vitest";
import {
  isWidebody,
  vintageAgeTier,
  vintageLGDAdj,
  computePortfolioAssetRisk,
  NB_REMARKETING_MONTHS,
  WB_REMARKETING_MONTHS,
  REMARKETING_BENCHMARK_MONTHS,
} from "./assetRisk";
import type { Asset, Lease } from "../types/portfolio";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAsset(id: string, aircraftType: string, vintage: number): Asset {
  return {
    id, org_id: "demo", upload_id: null,
    registration: id, msn: id, aircraft_type: aircraftType,
    manufacturer: null, vintage,
    current_operator: null, created_at: "2024-01-01T00:00:00Z",
  };
}

function makeLease(assetId: string, monthlyRental: number): Lease {
  return {
    id: `ls-${assetId}`, org_id: "demo",
    asset_id: assetId, lessee_id: `lessee-${assetId}`,
    start_date: "2024-01-01", end_date: "2030-01-01",
    monthly_rental: monthlyRental, currency: "USD",
    stage: 1, created_at: "2024-01-01T00:00:00Z",
  };
}

const REF_YEAR = 2026; // pin to avoid flaky time-based tests

// ─── isWidebody ───────────────────────────────────────────────────────────────

describe("isWidebody", () => {
  it("B777-300ER → widebody", () => expect(isWidebody("B777-300ER")).toBe(true));
  it("A350-900 → widebody",   () => expect(isWidebody("A350-900")).toBe(true));
  it("A330-300 → widebody",   () => expect(isWidebody("A330-300")).toBe(true));
  it("B787-9 → widebody",     () => expect(isWidebody("B787-9")).toBe(true));
  it("A320neo → narrowbody",  () => expect(isWidebody("A320neo")).toBe(false));
  it("B737 MAX 8 → narrowbody", () => expect(isWidebody("B737 MAX 8")).toBe(false));
  it("A220-300 → narrowbody", () => expect(isWidebody("A220-300")).toBe(false));
  it("A321neo → narrowbody",  () => expect(isWidebody("A321neo")).toBe(false));
  it("case-insensitive: b777-300er → widebody", () => expect(isWidebody("b777-300er")).toBe(true));
});

// ─── vintageAgeTier ───────────────────────────────────────────────────────────

describe("vintageAgeTier", () => {
  it("age 9 → young",  () => expect(vintageAgeTier(9)).toBe("young"));
  it("age 10 → mid",   () => expect(vintageAgeTier(10)).toBe("mid"));
  it("age 15 → mid",   () => expect(vintageAgeTier(15)).toBe("mid"));
  it("age 16 → aged",  () => expect(vintageAgeTier(16)).toBe("aged"));
  it("age 20 → aged",  () => expect(vintageAgeTier(20)).toBe("aged"));
  it("age 0 → young",  () => expect(vintageAgeTier(0)).toBe("young"));
});

// ─── vintageLGDAdj ────────────────────────────────────────────────────────────

describe("vintageLGDAdj", () => {
  it("age 9 → 0",     () => expect(vintageLGDAdj(9)).toBe(0));
  it("age 10 → 0.04", () => expect(vintageLGDAdj(10)).toBe(0.04));
  it("age 15 → 0.04", () => expect(vintageLGDAdj(15)).toBe(0.04));
  it("age 16 → 0.10", () => expect(vintageLGDAdj(16)).toBe(0.10));
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("NB_REMARKETING_MONTHS = 4", () => expect(NB_REMARKETING_MONTHS).toBe(4));
  it("WB_REMARKETING_MONTHS = 9", () => expect(WB_REMARKETING_MONTHS).toBe(9));
  it("REMARKETING_BENCHMARK_MONTHS = 3", () => expect(REMARKETING_BENCHMARK_MONTHS).toBe(3));
});

// ─── computePortfolioAssetRisk ────────────────────────────────────────────────

describe("computePortfolioAssetRisk", () => {
  it("empty inputs → all zeros, empty rows", () => {
    const result = computePortfolioAssetRisk([], [], REF_YEAR);
    expect(result.rows).toHaveLength(0);
    expect(result.suggestedRemarketingMonths).toBe(0);
    expect(result.vintageAdjFactor).toBe(0);
    expect(result.avgFleetAgeYears).toBe(0);
    expect(result.pctMidAged).toBe(0);
    expect(result.pctAged).toBe(0);
  });

  it("single NB young asset → suggestedRemarketing = NB benchmark, vintageAdj = 0", () => {
    // A320neo, vintage 2020, age = 6yr in 2026 → young
    const assets = [makeAsset("a1", "A320neo", 2020)];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.suggestedRemarketingMonths).toBe(NB_REMARKETING_MONTHS); // 4
    expect(result.vintageAdjFactor).toBe(0);
    expect(result.avgFleetAgeYears).toBeCloseTo(6, 5);
    expect(result.pctMidAged).toBe(0);
    expect(result.pctAged).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].ageTier).toBe("young");
    expect(result.rows[0].isWidebody).toBe(false);
  });

  it("single WB mid-aged asset → suggestedRemarketing = WB benchmark, vintageAdj = 0.04", () => {
    // A330-300, vintage 2015, age = 11yr in 2026 → mid
    const assets = [makeAsset("a1", "A330-300", 2015)];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.suggestedRemarketingMonths).toBe(WB_REMARKETING_MONTHS); // 9
    expect(result.vintageAdjFactor).toBeCloseTo(0.04, 5);
    expect(result.pctMidAged).toBeCloseTo(1.0, 5);
    expect(result.pctAged).toBe(0);
    expect(result.rows[0].ageTier).toBe("mid");
    expect(result.rows[0].isWidebody).toBe(true);
  });

  it("single aged asset → vintageAdj = 0.10", () => {
    // B777-300ER, vintage 2008, age = 18yr in 2026 → aged
    const assets = [makeAsset("a1", "B777-300ER", 2008)];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.vintageAdjFactor).toBeCloseTo(0.10, 5);
    expect(result.pctAged).toBeCloseTo(1.0, 5);
    expect(result.rows[0].ageTier).toBe("aged");
  });

  it("vintageAdjFactor is rental-weighted (not count-weighted)", () => {
    // NB $400k (young, adj=0) + WB $100k (mid, adj=0.04)
    // weighted = (400k*0 + 100k*0.04) / 500k = 4000/500000 = 0.008
    const assets = [
      makeAsset("a1", "A320neo",  2020), // age 6 → young, adj=0
      makeAsset("a2", "A330-300", 2015), // age 11 → mid, adj=0.04
    ];
    const leases = [makeLease("a1", 400_000), makeLease("a2", 100_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.vintageAdjFactor).toBeCloseTo(0.008, 5);
  });

  it("suggestedRemarketingMonths is rental-weighted by NB/WB", () => {
    // NB $750k (4mo) + WB $250k (9mo) → (750k*4 + 250k*9)/1000k = (3000+2250)/1000 = 5.25 → round to 5
    const assets = [
      makeAsset("a1", "A320neo",    2020),
      makeAsset("a2", "B777-300ER", 2020),
    ];
    const leases = [makeLease("a1", 750_000), makeLease("a2", 250_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.suggestedRemarketingMonths).toBe(5); // Math.round(5.25) = 5
  });

  it("asset with no matching lease is excluded", () => {
    const assets = [makeAsset("a1", "A320neo", 2020), makeAsset("a2", "A330-300", 2018)];
    const leases = [makeLease("a1", 500_000)]; // a2 has no lease
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].registration).toBe("a1");
  });

  it("asset with null monthly_rental is excluded", () => {
    const assets = [makeAsset("a1", "A320neo", 2020)];
    const leases = [{ ...makeLease("a1", 0), monthly_rental: null }];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.rows).toHaveLength(0);
  });

  it("asset with null vintage is excluded", () => {
    const assets = [{ ...makeAsset("a1", "A320neo", 2020), vintage: null }];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.rows).toHaveLength(0);
  });

  it("rows sorted by weightPct descending", () => {
    const assets = [
      makeAsset("a1", "A320neo", 2020), // small rental
      makeAsset("a2", "A330-300", 2018), // large rental
    ];
    const leases = [makeLease("a1", 100_000), makeLease("a2", 900_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.rows[0].registration).toBe("a2");
    expect(result.rows[1].registration).toBe("a1");
  });

  it("avgFleetAgeYears is rental-weighted", () => {
    // a1: age 5, rental $1M. a2: age 15, rental $1M. weighted avg = (5+15)/2 = 10
    const assets = [makeAsset("a1", "A320neo", 2021), makeAsset("a2", "A330-300", 2011)];
    const leases = [makeLease("a1", 1_000_000), makeLease("a2", 1_000_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.avgFleetAgeYears).toBeCloseTo(10, 1);
  });
});
