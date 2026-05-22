// src/app/utils/rateForecaster.test.ts
import { describe, it, expect } from "vitest";
import { forecastRates, seasonalFactor } from "./rateForecaster";
import { CURRENT_MACRO_INPUTS } from "../data/rateOutlookData";

describe("seasonalFactor", () => {
  it("returns a value in the [0.98, 1.02] range for all months 0–11", () => {
    for (let m = 0; m < 12; m++) {
      const f = seasonalFactor(m);
      expect(f).toBeGreaterThanOrEqual(0.98);
      expect(f).toBeLessThanOrEqual(1.02);
    }
  });
});

describe("forecastRates", () => {
  it("returns 18 TypeForecasts — one per aircraft type", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    expect(result.types).toHaveLength(18);
  });

  it("each type has 12 monthly forecasts (months 1–12)", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    for (const tf of result.types) {
      expect(tf.forecast).toHaveLength(12);
      expect(tf.forecast[0].month).toBe(1);
      expect(tf.forecast[11].month).toBe(12);
    }
  });

  it("sparkline has exactly 12 values", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    for (const tf of result.types) {
      expect(tf.sparkline).toHaveLength(12);
    }
  });

  it("lrf is rentUSD / nbvUSD * 100", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    const a320 = result.types.find((t) => t.type === "A320neo")!;
    // A320neo nbv = 48_000_000
    const expectedLrf = (a320.current.rentUSD / 48_000_000) * 100;
    expect(a320.current.lrf).toBeCloseTo(expectedLrf, 4);
  });

  it("p25 < rentUSD < p75 for all forecasts", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    for (const tf of result.types) {
      for (const m of tf.forecast) {
        expect(m.p25).toBeLessThan(m.rentUSD);
        expect(m.p75).toBeGreaterThan(m.rentUSD);
      }
    }
  });

  it("vsBaselinePct is a number for month=0", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    const a320 = result.types.find((t) => t.type === "A320neo")!;
    expect(typeof a320.current.vsBaselinePct).toBe("number");
  });

  it("outlookPct is (month12rent - baseRent) / baseRent * 100", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    const a320 = result.types.find((t) => t.type === "A320neo")!;
    const month12rent = a320.forecast[11].rentUSD;
    const expected = ((month12rent - 390_000) / 390_000) * 100;
    expect(a320.outlookPct).toBeCloseTo(expected, 4);
  });

  it("narrowbody rent is lower than widebody rent", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    const a320 = result.types.find((t) => t.type === "A320neo")!;
    const b777 = result.types.find((t) => t.type === "B777-300ER")!;
    expect(a320.current.rentUSD).toBeLessThan(b777.current.rentUSD);
  });
});
