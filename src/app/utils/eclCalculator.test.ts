import { describe, it, expect } from "vitest";
import {
  BASE_ECL,
  ZERO_INPUTS,
  computeECL,
  computeECLFromBase,
  computeStages,
} from "./eclCalculator";

describe("computeECL (backward compat)", () => {
  it("returns BASE_ECL with ZERO_INPUTS", () => {
    expect(computeECL(ZERO_INPUTS)).toBeCloseTo(BASE_ECL, 5);
  });

  it("increases ECL on stress inputs", () => {
    expect(computeECL({ ...ZERO_INPUTS, rpkDelta: -0.25 })).toBeGreaterThan(BASE_ECL);
  });
});

describe("computeECLFromBase", () => {
  it("returns baseECL with ZERO_INPUTS", () => {
    expect(computeECLFromBase(60, ZERO_INPUTS)).toBeCloseTo(60, 5);
  });

  it("matches computeECL when baseECL = BASE_ECL", () => {
    const inputs = { ...ZERO_INPUTS, rpkDelta: -0.20, fuelDelta: 0.30 };
    expect(computeECLFromBase(BASE_ECL, inputs)).toBeCloseTo(computeECL(inputs), 5);
  });

  it("scales proportionally with different base ECL", () => {
    const inputs = ZERO_INPUTS;
    const r1 = computeECLFromBase(47.2, inputs);
    const r2 = computeECLFromBase(94.4, inputs);
    expect(r2).toBeCloseTo(r1 * 2, 5);
  });

  it("applies floor at 30% of baseECL under extreme stress", () => {
    const extremeStress = {
      ...ZERO_INPUTS,
      gdpDelta: -0.10,
      rpkDelta: -0.60,
      fuelDelta: 0.80,
      fxDelta: -0.50,
      rateDelta: 0.03,
      assetValueDelta: -0.40,
      pdS2Multi: 4.0,
      pdS3Multi: 5.0,
    };
    const base = 47.2;
    const result = computeECLFromBase(base, extremeStress);
    expect(result).toBeGreaterThanOrEqual(base * 0.3 - 0.001);
  });

  it("higher baseECL produces proportionally larger absolute ECL", () => {
    const inputs = { ...ZERO_INPUTS, rpkDelta: -0.25 };
    const low = computeECLFromBase(40, inputs);
    const high = computeECLFromBase(80, inputs);
    expect(high).toBeGreaterThan(low);
  });
});

describe("computeStages", () => {
  it("stage shares sum to 1.0 under ZERO_INPUTS", () => {
    const ecl = computeECL(ZERO_INPUTS);
    const { s1, s2, s3 } = computeStages(ecl, ZERO_INPUTS);
    expect((s1 + s2 + s3) / ecl).toBeCloseTo(1.0, 5);
  });
});
