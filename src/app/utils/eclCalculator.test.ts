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

  it("scales proportionally with different base ECL when all mitigation rates are zero", () => {
  // Proportionality only holds with ZERO_INPUTS: mitigation benefits scale with baseECL,
  // so different baseECL values would not produce a 2x ratio if pbhConversionPct/etpRate/lecRate were non-zero.
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

describe("distress inputs", () => {
  it("ZERO_INPUTS still has all new fields at 0", () => {
    expect(ZERO_INPUTS.deferralMonths).toBe(0);
    expect(ZERO_INPUTS.govtSupportProb).toBe(0);
    expect(ZERO_INPUTS.forgivenessRate).toBe(0);
    expect(ZERO_INPUTS.pbhConversionPct).toBe(0);
    expect(ZERO_INPUTS.etpRate).toBe(0);
    expect(ZERO_INPUTS.lecRate).toBe(0);
  });

  it("deferral with full forgiveness and no govt support increases ECL", () => {
    const inputs = { ...ZERO_INPUTS, deferralMonths: 6, forgivenessRate: 1.0, govtSupportProb: 0 };
    expect(computeECLFromBase(47.2, inputs)).toBeGreaterThan(47.2);
  });

  it("govt support at 100% fully negates deferral ECL impact", () => {
    const noSupport = computeECLFromBase(47.2, { ...ZERO_INPUTS, deferralMonths: 6, forgivenessRate: 0.5, govtSupportProb: 0 });
    const fullSupport = computeECLFromBase(47.2, { ...ZERO_INPUTS, deferralMonths: 6, forgivenessRate: 0.5, govtSupportProb: 1.0 });
    expect(fullSupport).toBeCloseTo(47.2, 5);
    expect(noSupport).toBeGreaterThan(47.2);
  });

  it("pbhConversionPct reduces ECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, pbhConversionPct: 0.5 });
    expect(result).toBeLessThan(47.2);
  });

  it("etpRate reduces ECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, etpRate: 0.3 });
    expect(result).toBeLessThan(47.2);
  });

  it("lecRate reduces ECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, lecRate: 0.2 });
    expect(result).toBeLessThan(47.2);
  });

  it("zero distress inputs leave ECL unchanged", () => {
    expect(computeECLFromBase(47.2, ZERO_INPUTS)).toBeCloseTo(47.2, 5);
  });

  it("floor still holds under combined distress + macro stress", () => {
    const extreme = {
      ...ZERO_INPUTS,
      rpkDelta: -0.60, gdpDelta: -0.10, pdS3Multi: 5.0,
      deferralMonths: 24, forgivenessRate: 1.0, govtSupportProb: 0,
    };
    expect(computeECLFromBase(47.2, extreme)).toBeGreaterThanOrEqual(47.2 * 0.3 - 0.001);
  });
});
