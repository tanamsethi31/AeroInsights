import { describe, it, expect } from "vitest";
import {
  DEFAULT_PD_CURVES,
  mergeCurves,
  computeDeviation,
  CARRIER_SEGMENT_LABELS,
  type CarrierSegment,
  type PdTermStructure,
  type PdCurveLibrary,
} from "./pdCurves";

describe("DEFAULT_PD_CURVES bounds", () => {
  const segments: CarrierSegment[] = ["network", "lcc", "regional", "charter"];

  it("all PD values are between 0 and 1 (exclusive)", () => {
    for (const seg of segments) {
      const curve = DEFAULT_PD_CURVES[seg];
      for (const key of ["pd1yr", "pd2yr", "pd3yr", "pd5yr", "pdLifetime"] as const) {
        expect(curve[key]).toBeGreaterThan(0);
        expect(curve[key]).toBeLessThan(1);
      }
    }
  });

  it("curves are monotonically non-decreasing across tenors", () => {
    for (const seg of segments) {
      const { pd1yr, pd2yr, pd3yr, pd5yr, pdLifetime } = DEFAULT_PD_CURVES[seg];
      expect(pd1yr).toBeLessThanOrEqual(pd2yr);
      expect(pd2yr).toBeLessThanOrEqual(pd3yr);
      expect(pd3yr).toBeLessThanOrEqual(pd5yr);
      expect(pd5yr).toBeLessThanOrEqual(pdLifetime);
    }
  });
});

describe("mergeCurves", () => {
  it("returns defaults unchanged when no overrides", () => {
    const result = mergeCurves(DEFAULT_PD_CURVES, {});
    expect(result).toEqual(DEFAULT_PD_CURVES);
  });

  it("firm override wins for the overridden segment", () => {
    const override = { pd1yr: 0.05, pd2yr: 0.09, pd3yr: 0.13, pd5yr: 0.18, pdLifetime: 0.40, source: "custom", calibratedYear: 2024 };
    const result = mergeCurves(DEFAULT_PD_CURVES, { network: override });
    expect(result.network.pd1yr).toBe(0.05);
    expect(result.network.source).toBe("custom");
  });

  it("untouched segments remain at defaults", () => {
    const override = { pd1yr: 0.05, pd2yr: 0.09, pd3yr: 0.13, pd5yr: 0.18, pdLifetime: 0.40, source: "custom", calibratedYear: 2024 };
    const result = mergeCurves(DEFAULT_PD_CURVES, { network: override });
    expect(result.lcc).toEqual(DEFAULT_PD_CURVES.lcc);
    expect(result.regional).toEqual(DEFAULT_PD_CURVES.regional);
    expect(result.charter).toEqual(DEFAULT_PD_CURVES.charter);
  });

  it("partial override merges correctly (only pd1yr overridden)", () => {
    const result = mergeCurves(DEFAULT_PD_CURVES, { lcc: { pd1yr: 0.025 } });
    expect(result.lcc.pd1yr).toBe(0.025);
    expect(result.lcc.pd2yr).toBe(DEFAULT_PD_CURVES.lcc.pd2yr);
    expect(result.lcc.pdLifetime).toBe(DEFAULT_PD_CURVES.lcc.pdLifetime);
  });

  it("overridden row with invalid monotonicity does NOT throw (validation is UI responsibility)", () => {
    expect(() =>
      mergeCurves(DEFAULT_PD_CURVES, { charter: { pd1yr: 0.9, pd2yr: 0.1 } })
    ).not.toThrow();
  });

  it("does not mutate the defaults argument", () => {
    const snapshot = { ...DEFAULT_PD_CURVES.network };
    mergeCurves(DEFAULT_PD_CURVES, { network: { pd1yr: 0.05 } });
    expect(DEFAULT_PD_CURVES.network).toEqual(snapshot);
  });
});

describe("computeDeviation", () => {
  it("returns green band when ratio is within 25% above benchmark", () => {
    const { band } = computeDeviation(0.015, 0.012, "network");
    expect(band).toBe("green");
  });

  it("returns green band when ratio is within 20% below benchmark", () => {
    const { band } = computeDeviation(0.010, 0.012, "network");
    expect(band).toBe("green");
  });

  it("returns amber band when ratio is 1.5×", () => {
    const { band } = computeDeviation(0.018, 0.012, "network");
    expect(band).toBe("amber");
  });

  it("returns red band when ratio is 3×", () => {
    const { band } = computeDeviation(0.036, 0.012, "network");
    expect(band).toBe("red");
  });

  it("returns correct direction label when manual < benchmark", () => {
    const { description } = computeDeviation(0.006, 0.012, "network");
    expect(description).toContain("below");
    expect(description).toContain("Network Carrier");
  });

  it("returns correct direction label when manual > benchmark", () => {
    const { description } = computeDeviation(0.024, 0.012, "network");
    expect(description).toContain("above");
  });

  it("returns green band and no-op description when curvePd1yr is 0", () => {
    const result = computeDeviation(0.02, 0, "lcc");
    expect(result.band).toBe("green");
    expect(result.description).toBe("No benchmark");
    expect(result.ratio).toBe(0);
  });

  it("returns green at exact upper boundary (ratio = 1.25)", () => {
    // 0.0150 / 0.0120 = 1.25 exactly
    const { band } = computeDeviation(0.0150, 0.0120, "network");
    expect(band).toBe("green");
  });

  it("returns amber at ratio just above upper green boundary (ratio = 1.26)", () => {
    // 0.0126 / 0.01 = 1.26
    const { band } = computeDeviation(0.0126, 0.01, "network");
    expect(band).toBe("amber");
  });
});
