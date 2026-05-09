import { describe, it, expect } from "vitest";
import {
  indexById,
  toLeaseTableRows,
  toAircraftTableRows,
  toLesseeTableRows,
  toDashboardKPIs,
  toEclTableRows,
} from "./portfolioAdapters";
import { MOCK_ASSETS, MOCK_LESSEES, MOCK_LEASES, MOCK_PROVISIONS } from "../data/mockPortfolioData";

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
