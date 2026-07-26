// src/app/services/exportService.test.ts
import { describe, it, expect } from "vitest";
import { stageBreakdown } from "./exportService";
import type { PortfolioExportData } from "../lib/portfolioAdapters";

const SAMPLE_DATA: PortfolioExportData = {
  eclRows: [
    { id: "L1", lessee: "IndiGo Airlines", aircraft: "A320neo", ead: 24.2, pd12m: 12.4, lgd: 54, ecl12m: 1.62, eclLT: 2.36, stage: "3" },
    { id: "L2", lessee: "Emirates", aircraft: "B777-300ER", ead: 88.4, pd12m: 0.3, lgd: 28, ecl12m: 0.07, eclLT: 0.27, stage: "1" },
    { id: "L3", lessee: "SriLankan Airlines", aircraft: "A330-300", ead: 34.2, pd12m: 4.2, lgd: 48, ecl12m: 0.69, eclLT: 1.61, stage: "2" },
  ],
  leaseRows: [],
  lesseeRows: [],
  aircraftRows: [],
};

describe("stageBreakdown", () => {
  it("sums ecl12m grouped by stage", () => {
    const result = stageBreakdown(SAMPLE_DATA);
    expect(result.byStage["1"]).toBeCloseTo(0.07, 4);
    expect(result.byStage["2"]).toBeCloseTo(0.69, 4);
    expect(result.byStage["3"]).toBeCloseTo(1.62, 4);
  });

  it("computes total as the sum of all three stages", () => {
    const result = stageBreakdown(SAMPLE_DATA);
    expect(result.total).toBeCloseTo(1.62 + 0.07 + 0.69, 4);
  });

  it("computes coverage as total ECL over total book value (ead)", () => {
    const result = stageBreakdown(SAMPLE_DATA);
    const bookValue = 24.2 + 88.4 + 34.2;
    const expectedPct = ((1.62 + 0.07 + 0.69) / bookValue) * 100;
    expect(result.coveragePct).toBeCloseTo(expectedPct, 4);
  });

  it("returns zero coverage when book value is zero", () => {
    const result = stageBreakdown({ eclRows: [], leaseRows: [], lesseeRows: [], aircraftRows: [] });
    expect(result.coveragePct).toBe(0);
    expect(result.total).toBe(0);
    expect(result.byStage).toEqual({ "1": 0, "2": 0, "3": 0 });
  });

  it("ignores rows with a stage value outside 1/2/3", () => {
    const dataWithUnknownStage: PortfolioExportData = {
      ...SAMPLE_DATA,
      eclRows: [
        ...SAMPLE_DATA.eclRows,
        { id: "L4", lessee: "Unknown Co", aircraft: "A321", ead: 10, pd12m: 1, lgd: 30, ecl12m: 5, eclLT: 8, stage: "unknown" },
      ],
    };
    const result = stageBreakdown(dataWithUnknownStage);
    // The stray "unknown"-stage row's ecl12m (5) must not appear in any bucket or the total.
    expect(result.total).toBeCloseTo(1.62 + 0.07 + 0.69, 4);
  });
});
