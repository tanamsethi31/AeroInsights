import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  indexById,
  toLeaseTableRows,
  toAircraftTableRows,
  toLesseeTableRows,
  toDashboardKPIs,
  toEclTableRows,
  toConcentrationData,
  toPortfolioKPIs,
  toMRHealthSummary,
  type PortfolioKPIs,
  type LeaseTableRow,
} from "./portfolioAdapters";
import type { Asset, Lessee, Lease } from "../types/portfolio";
import { MOCK_ASSETS, MOCK_LESSEES, MOCK_LEASES, MOCK_PROVISIONS } from "../data/mockPortfolioData";

function makeLeaseRow(overrides: Partial<LeaseTableRow> = {}): LeaseTableRow {
  return {
    id: "test-001",
    lessee: "Test Lessee",
    aircraft: "A320neo",
    msn: "TEST-001",
    start: "2019-01-01",
    end: "2025-01-01",
    rentUSD: "100,000",
    stage: "1",
    status: "Active",
    mrFlag: null,
    eolShortfall: null,
    eolShortfallPct: null,
    ...overrides,
  };
}

describe("indexById", () => {
  it("builds a Map keyed by id", () => {
    const map = indexById(MOCK_ASSETS);
    expect(map.get("mock-a1")?.msn).toBe("9218");
  });
});

describe("toLeaseTableRows", () => {
  const rows = toLeaseTableRows(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);
  it("returns one row per lease", () => { expect(rows).toHaveLength(MOCK_LEASES.length); });
  it("joins lessee name", () => { expect(rows.find(r => r.id === "mock-ls1")?.lessee).toBe("IndiGo Airlines"); });
  it("joins aircraft type", () => { expect(rows.find(r => r.id === "mock-ls1")?.aircraft).toBe("A320neo"); });
  it("formats monthly_rental with commas", () => { expect(rows.find(r => r.id === "mock-ls1")?.rentUSD).toBe("285,000"); });
  it("coerces stage to string", () => { expect(rows.find(r => r.id === "mock-ls1")?.stage).toBe("3"); });
});

describe("toAircraftTableRows", () => {
  const rows = toAircraftTableRows(MOCK_ASSETS, MOCK_LEASES, MOCK_LESSEES);
  it("returns one row per asset", () => { expect(rows).toHaveLength(MOCK_ASSETS.length); });
  it("fills msn, type, reg", () => {
    const row = rows.find(r => r.msn === "9218");
    expect(row?.type).toBe("A320neo");
    expect(row?.reg).toBe("VT-IYC");
  });
  it("resolves lessee name via lease join", () => { expect(rows.find(r => r.msn === "9218")?.lessee).toBe("IndiGo Airlines"); });
});

describe("toLesseeTableRows", () => {
  const rows = toLesseeTableRows(MOCK_LESSEES, MOCK_LEASES);
  it("returns one row per lessee", () => { expect(rows).toHaveLength(MOCK_LESSEES.length); });
  it("counts leases per lessee", () => { expect(rows.find(r => r.name === "IndiGo Airlines")?.leases).toBe(1); });
  it("stage=3 for red watchlist", () => { expect(rows.find(r => r.name === "IndiGo Airlines")?.stage).toBe("3"); });
  it("stage=1 for green watchlist", () => { expect(rows.find(r => r.name === "Emirates")?.stage).toBe("1"); });
});

describe("toLesseeTableRows — with provisions", () => {
  const rows = toLesseeTableRows(MOCK_LESSEES, MOCK_LEASES, MOCK_PROVISIONS);

  it("shows formatted exposure for IndiGo Airlines (EAD=24.2M)", () => {
    const row = rows.find(r => r.name === "IndiGo Airlines");
    expect(row?.exposure).toBe("$24M");
  });

  it("shows formatted exposure for Emirates (EAD=88.4M)", () => {
    const row = rows.find(r => r.name === "Emirates");
    expect(row?.exposure).toBe("$88M");
  });

  it("still shows — when no provisions passed", () => {
    const rowsNoProvisions = toLesseeTableRows(MOCK_LESSEES, MOCK_LEASES);
    const row = rowsNoProvisions.find(r => r.name === "IndiGo Airlines");
    expect(row?.exposure).toBe("—");
  });
});

describe("toDashboardKPIs", () => {
  const kpis = toDashboardKPIs(MOCK_ASSETS, MOCK_LESSEES, MOCK_PROVISIONS);
  it("counts fleet", () => { expect(kpis.fleetCount).toBe(MOCK_ASSETS.length); });
  it("sums ECL in $M", () => {
    const expected = MOCK_PROVISIONS.reduce((s, p) => s + (p.ecl_amount ?? 0), 0) / 1_000_000;
    expect(kpis.totalECLm).toBeCloseTo(expected, 2);
  });
  it("counts stage-3 provisions", () => {
    expect(kpis.stage3Count).toBe(MOCK_PROVISIONS.filter(p => p.stage === 3).length);
  });
  it("counts red watchlist lessees", () => {
    expect(kpis.watchlistRedCount).toBe(MOCK_LESSEES.filter(l => l.watchlist_status === "red").length);
  });
  it("sums EAD as book value in $M", () => {
    const expected = MOCK_PROVISIONS.reduce((s, p) => s + (p.ead ?? 0), 0) / 1_000_000;
    expect(kpis.bookValueM).toBeCloseTo(expected, 1);
  });
  it("counts amber watchlist lessees", () => {
    const expected = MOCK_LESSEES.filter(l => l.watchlist_status === "amber").length;
    expect(kpis.watchlistAmberCount).toBe(expected);
  });
  it("counts green (or null) watchlist lessees", () => {
    const expected = MOCK_LESSEES.filter(l => l.watchlist_status === "green" || l.watchlist_status == null).length;
    expect(kpis.watchlistGreenCount).toBe(expected);
  });
});

describe("toEclTableRows", () => {
  const rows = toEclTableRows(MOCK_PROVISIONS, MOCK_ASSETS, MOCK_LESSEES, MOCK_LEASES);
  it("returns one row per provision", () => { expect(rows).toHaveLength(MOCK_PROVISIONS.length); });
  it("converts ead to $M", () => { expect(rows[0].eadNum).toBeCloseTo(MOCK_PROVISIONS[0].ead! / 1_000_000, 2); });
  it("converts pd fraction to %", () => { expect(rows[0].pd12m).toBeCloseTo(MOCK_PROVISIONS[0].pd! * 100, 2); });
  it("converts lgd fraction to %", () => { expect(rows[0].lgd).toBeCloseTo(MOCK_PROVISIONS[0].lgd! * 100, 2); });
  it("converts ecl_amount to $M", () => { expect(rows[0].ecl12m).toBeCloseTo(MOCK_PROVISIONS[0].ecl_amount! / 1_000_000, 2); });
  it("populates pdTerm with 4 points", () => { expect(rows[0].pdTerm).toHaveLength(4); });
});

describe("toPortfolioKPIs", () => {
  let kpis: PortfolioKPIs;

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-09T12:00:00Z"));
    kpis = toPortfolioKPIs(MOCK_ASSETS, MOCK_LEASES, MOCK_PROVISIONS);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("counts fleet from assets array", () => {
    expect(kpis.fleetCount).toBe(10);
  });

  it("sums EAD as book value in $M", () => {
    // 24.2+32.1+88.4+34.2+44.7+68.3+34.2+28.9+91.2+44.7 = 490.9
    expect(kpis.bookValueM).toBeCloseTo(490.9, 1);
  });

  it("sums ECL in $M", () => {
    // 4.2+3.8+0.89+2.1+0.45+0.68+1.9+1.5+1.1+0.34 = 16.96
    expect(kpis.totalECLM).toBeCloseTo(16.96, 1);
  });

  it("computes average remaining term > 0 yrs", () => {
    // All leases end after 2026-05-09, so avg should be positive
    expect(kpis.avgRemainingTermYrs).toBeGreaterThan(0);
    expect(kpis.avgRemainingTermYrs).toBeLessThan(15);
  });

  it("returns 0 avgRemainingTermYrs for empty leases", () => {
    const k = toPortfolioKPIs(MOCK_ASSETS, [], MOCK_PROVISIONS);
    expect(k.avgRemainingTermYrs).toBe(0);
  });
});

describe("toConcentrationData", () => {
  const result = toConcentrationData(MOCK_ASSETS, MOCK_LESSEES, MOCK_LEASES, MOCK_PROVISIONS);

  it("returns 6 dimensions", () => {
    const keys = Object.keys(result.concentrationData);
    expect(keys).toContain("Lessee");
    expect(keys).toContain("Country");
    expect(keys).toContain("Region");
    expect(keys).toContain("Type");
    expect(keys).toContain("Vintage");
    expect(keys).toContain("Currency");
  });

  it("Lessee rows sum to ~100% exposure", () => {
    const sum = result.concentrationData.Lessee.reduce((s, r) => s + r.exposurePct, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it("Singapore Airlines is top lessee by EAD (91.2M)", () => {
    const top = result.concentrationData.Lessee[0];
    expect(top.name).toBe("Singapore Airlines");
    expect(top.exposure).toBeCloseTo(91_200_000, -3);
  });

  it("Emirates is top lessee by EAD (88.4M) after Singapore Airlines", () => {
    const second = result.concentrationData.Lessee[1];
    expect(second.name).toBe("Emirates");
  });

  it("India and Singapore and Sri Lanka all map to APAC region", () => {
    const apac = result.concentrationData.Region.find(r => r.name === "APAC");
    expect(apac).toBeDefined();
    // India(24.2) + Singapore(91.2) + Sri Lanka(34.2) = 149.6M
    expect(apac!.exposure).toBeCloseTo(149_600_000, -3);
  });

  it("2021–22 vintage includes Emirates(2021) + Azul(2021) + Ryanair(2022) + Lufthansa(2022)", () => {
    const v = result.concentrationData.Vintage.find(r => r.name === "2021–22");
    expect(v).toBeDefined();
    // 88.4 + 34.2 + 44.7 + 44.7 = 212.0M
    expect(v!.exposure).toBeCloseTo(212_000_000, -3);
  });

  it("All leases are USD, so Currency has one row", () => {
    expect(result.concentrationData.Currency).toHaveLength(1);
    expect(result.concentrationData.Currency[0].name).toBe("USD");
  });

  it("kpis.bookValue equals total EAD (~490.9M)", () => {
    expect(result.kpis.bookValue).toBeCloseTo(490_900_000, -3);
  });

  it("peakConcentrations.Lessee has Singapore Airlines as top name", () => {
    expect(result.peakConcentrations.Lessee.name).toBe("Singapore Airlines");
    expect(result.peakConcentrations.Lessee.pct).toBeCloseTo(18.6, 0);
  });
});

describe("toLeaseTableRows — MR adequacy fields", () => {
  const fakeAsset: Asset = {
    id: "a1", org_id: "test", upload_id: null,
    registration: "REG1", msn: "TEST-001", aircraft_type: "A320neo",
    manufacturer: null, vintage: 2019, current_operator: null,
    created_at: "2024-01-01T00:00:00Z",
  };
  const fakeLessee: Lessee = {
    id: "l1", org_id: "test", name: "Test Lessee", iata_code: null,
    country: "UAE", credit_rating: null, pd_estimate: null,
    watchlist_status: null, created_at: "2024-01-01T00:00:00Z",
  };

  it("populates mrFlag and eolShortfall when lease id matches MR_ADEQUACY entry", () => {
    // LSE-2019-001 is "amber" in MR_ADEQUACY with eolShortfall 3_130_000, eolShortfallPct 14.1
    const fakeLease: Lease = {
      id: "LSE-2019-001", org_id: "test", asset_id: "a1", lessee_id: "l1",
      start_date: "2019-01-01", end_date: "2025-01-01", monthly_rental: 100000,
      currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z",
    };
    const rows = toLeaseTableRows([fakeLease], [fakeAsset], [fakeLessee]);
    expect(rows[0].mrFlag).toBe("amber");
    expect(rows[0].eolShortfall).toBe(3_130_000);
    expect(rows[0].eolShortfallPct).toBe(14.1);
  });

  it("sets MR fields to null for lease id not in MR_ADEQUACY", () => {
    // All MOCK_LEASES use "mock-ls*" ids which are not in MR_ADEQUACY
    const rows = toLeaseTableRows(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);
    expect(rows.every(r => r.mrFlag === null)).toBe(true);
    expect(rows.every(r => r.eolShortfall === null)).toBe(true);
  });
});

describe("toMRHealthSummary", () => {
  it("counts red, amber, green flags correctly, ignores null mrFlag", () => {
    const rows = [
      makeLeaseRow({ mrFlag: "red",   eolShortfall: 5_000_000, eolShortfallPct: 30 }),
      makeLeaseRow({ mrFlag: "amber", eolShortfall: 2_000_000, eolShortfallPct: 10 }),
      makeLeaseRow({ mrFlag: "green", eolShortfall: -3_000_000, eolShortfallPct: -15 }),
      makeLeaseRow({ mrFlag: null }),
    ];
    const summary = toMRHealthSummary(rows);
    expect(summary.redCount).toBe(1);
    expect(summary.amberCount).toBe(1);
    expect(summary.greenCount).toBe(1);
    expect(summary.worstOffenders).toHaveLength(2);
  });

  it("sorts worstOffenders: red before amber, then by eolShortfall descending", () => {
    const rows = [
      makeLeaseRow({ id: "A", lessee: "AlphaAir", msn: "A01", mrFlag: "amber", eolShortfall: 3_000_000, eolShortfallPct: 15 }),
      makeLeaseRow({ id: "B", lessee: "BetaAir",  msn: "B01", mrFlag: "red",   eolShortfall: 1_000_000, eolShortfallPct: 5  }),
      makeLeaseRow({ id: "C", lessee: "GammaAir", msn: "C01", mrFlag: "amber", eolShortfall: 2_000_000, eolShortfallPct: 10 }),
    ];
    const summary = toMRHealthSummary(rows);
    expect(summary.worstOffenders[0].leaseId).toBe("B"); // red first
    expect(summary.worstOffenders[1].leaseId).toBe("A"); // amber, higher shortfall
    expect(summary.worstOffenders[2].leaseId).toBe("C"); // amber, lower shortfall
  });

  it("caps worstOffenders at 3 even when 4 at-risk leases exist", () => {
    const rows = [
      makeLeaseRow({ id: "1", mrFlag: "red",   eolShortfall: 5_000_000, eolShortfallPct: 30 }),
      makeLeaseRow({ id: "2", mrFlag: "red",   eolShortfall: 4_000_000, eolShortfallPct: 25 }),
      makeLeaseRow({ id: "3", mrFlag: "amber", eolShortfall: 3_000_000, eolShortfallPct: 15 }),
      makeLeaseRow({ id: "4", mrFlag: "amber", eolShortfall: 2_000_000, eolShortfallPct: 10 }),
    ];
    const summary = toMRHealthSummary(rows);
    expect(summary.worstOffenders).toHaveLength(3);
  });

  it("returns empty worstOffenders when all leases are green or null", () => {
    const rows = [
      makeLeaseRow({ mrFlag: "green", eolShortfall: -1_000_000, eolShortfallPct: -5 }),
      makeLeaseRow({ mrFlag: null }),
    ];
    const summary = toMRHealthSummary(rows);
    expect(summary.worstOffenders).toHaveLength(0);
    expect(summary.redCount).toBe(0);
    expect(summary.amberCount).toBe(0);
    expect(summary.greenCount).toBe(1);
  });
});
