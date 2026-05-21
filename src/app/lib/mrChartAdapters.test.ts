import { describe, it, expect } from "vitest";
import { toMRChartData } from "./mrChartAdapters";
import { sdmrData } from "../components/portfolio/SDMRTab";

describe("toMRChartData", () => {
  it("returns empty structure for empty input", () => {
    const result = toMRChartData([]);
    expect(result.cashflow).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.leaseIds).toEqual([]);
  });

  it("returns a cashflow entry for every quarter from Q2 2026 to max lease end", () => {
    const result = toMRChartData(sdmrData);
    expect(result.cashflow.length).toBeGreaterThan(0);
    expect(result.cashflow[0].quarter).toBe("Q2 2026");
    // furthest lease end in static data is 2032-04-15 → Q2 2032
    const last = result.cashflow[result.cashflow.length - 1];
    expect(last.quarter).toBe("Q2 2032");
  });

  it("all cashflow inflows are non-negative", () => {
    const result = toMRChartData(sdmrData);
    result.cashflow.forEach((q) => {
      expect(q.inflows).toBeGreaterThanOrEqual(0);
    });
  });

  it("all event costs are non-negative", () => {
    const result = toMRChartData(sdmrData);
    result.cashflow.forEach((q) => {
      expect(q.eventCosts).toBeGreaterThanOrEqual(0);
    });
  });

  it("events array has one entry per quarter matching cashflow", () => {
    const result = toMRChartData(sdmrData);
    expect(result.events.length).toBe(result.cashflow.length);
    result.events.forEach((e, i) => {
      expect(e.quarter).toBe(result.cashflow[i].quarter);
    });
  });

  it("leaseIds contains one entry per lease in sdmrData", () => {
    const result = toMRChartData(sdmrData);
    expect(result.leaseIds.length).toBe(sdmrData.length);
  });

  it("leaseColors maps every leaseId to a non-empty colour string", () => {
    const result = toMRChartData(sdmrData);
    result.leaseIds.forEach((id) => {
      expect(typeof result.leaseColors[id]).toBe("string");
      expect(result.leaseColors[id].length).toBeGreaterThan(0);
    });
  });

  it("cumulative net is monotonically consistent (each step = prev + inflows - eventCosts)", () => {
    const result = toMRChartData(sdmrData);
    let running = 0;
    result.cashflow.forEach((q) => {
      running += q.inflows - q.eventCosts;
      expect(Math.round(q.netCumulative)).toBe(Math.round(running));
    });
  });
});
