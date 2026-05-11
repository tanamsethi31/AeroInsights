import { describe, it, expect } from "vitest";
import {
  BASE_ECL,
  LGD_DELTAS,
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
    expect(ZERO_INPUTS.ctcGoldPct).toBe(0);
    expect(ZERO_INPUTS.nonCtcPct).toBe(0);
    expect(ZERO_INPUTS.depositCoverage).toBe(0);
    expect(ZERO_INPUTS.payBehaviourCoopPct).toBe(0);
    expect(ZERO_INPUTS.payBehaviourAdvPct).toBe(0);
    expect(ZERO_INPUTS.restructuringType).toBeNull();
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

describe("insolvency regime LGD adjustment", () => {
  it("ZERO_INPUTS has bankruptcyScenarioType as null", () => {
    expect(ZERO_INPUTS.bankruptcyScenarioType).toBeNull();
  });

  it("null bankruptcyScenarioType leaves ECL unchanged", () => {
    expect(computeECLFromBase(47.2, ZERO_INPUTS)).toBeCloseTo(47.2, 5);
  });

  it("chapter11 reduces ECL by 12% of base", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, bankruptcyScenarioType: "chapter11" });
    expect(result).toBeCloseTo(47.2 * (1 - 0.12), 5);
  });

  it("generic_liquidation increases ECL by 18% of base", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, bankruptcyScenarioType: "generic_liquidation" });
    expect(result).toBeCloseTo(47.2 * (1 + 0.18), 5);
  });

  it("unknown regime key leaves ECL unchanged (graceful fallback)", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, bankruptcyScenarioType: "unknown_regime" });
    expect(result).toBeCloseTo(47.2, 5);
  });

  it("chapter11 produces lower ECL than generic_liquidation for same macro inputs", () => {
    const ch11 = computeECLFromBase(47.2, { ...ZERO_INPUTS, pdS3Multi: 2.0, bankruptcyScenarioType: "chapter11" });
    const liq  = computeECLFromBase(47.2, { ...ZERO_INPUTS, pdS3Multi: 2.0, bankruptcyScenarioType: "generic_liquidation" });
    expect(ch11).toBeLessThan(liq);
  });

  it("floor still holds with generic_liquidation + extreme macro stress", () => {
    const extreme = {
      ...ZERO_INPUTS,
      rpkDelta: -0.60, gdpDelta: -0.10, pdS3Multi: 5.0,
      bankruptcyScenarioType: "generic_liquidation",
    };
    expect(computeECLFromBase(47.2, extreme)).toBeGreaterThanOrEqual(47.2 * 0.3 - 0.001);
  });

  it.each(Object.entries(LGD_DELTAS))(
    "regime '%s' adjusts ECL by its calibrated factor",
    (regime, factor) => {
      const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, bankruptcyScenarioType: regime });
      expect(result).toBeCloseTo(47.2 * (1 + factor), 5);
    }
  );
});

describe("jurisdiction LGD adjustment", () => {
  it("ZERO_INPUTS has ctcGoldPct and nonCtcPct as 0", () => {
    expect(ZERO_INPUTS.ctcGoldPct).toBe(0);
    expect(ZERO_INPUTS.nonCtcPct).toBe(0);
  });

  it("both 0 → no uplift, backward-compatible with ZERO_INPUTS", () => {
    expect(computeECLFromBase(47.2, ZERO_INPUTS)).toBeCloseTo(47.2, 5);
  });

  it("both 0 → no uplift even when named explicitly", () => {
    expect(
      computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0, nonCtcPct: 0 })
    ).toBeCloseTo(47.2, 5);
  });

  it("pure non-CTC (nonCtcPct = 1.0) → +15% of baseECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0, nonCtcPct: 1.0 });
    expect(result).toBeCloseTo(47.2 * 1.15, 4);
  });

  it("pure CTC Gold (ctcGoldPct = 1.0) → 0 uplift", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 1.0, nonCtcPct: 0 });
    expect(result).toBeCloseTo(47.2, 5);
  });

  it("ctcGoldPct=0.5, nonCtcPct=0 → Moderate=50%, uplift = 0.5×0.06×baseECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0.5, nonCtcPct: 0 });
    const expectedUplift = 0.5 * 0.06 * 47.2;
    expect(result).toBeCloseTo(47.2 + expectedUplift, 4);
  });

  it("mixed portfolio: 70% Gold, 20% NonCTC → Moderate=10%, uplift correct", () => {
    // ctcModeratePct = max(0, 1 - 0.7 - 0.2) = 0.1
    // jurisdictionLGDDelta = (0.1 × 0.06 + 0.2 × 0.15) × 47.2 = 0.036 × 47.2 = 1.6992
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0.7, nonCtcPct: 0.2 });
    const expectedDelta = (0.1 * 0.06 + 0.2 * 0.15) * 47.2;
    expect(result).toBeCloseTo(47.2 + expectedDelta, 4);
  });

  it("over-specified (gold + nonCtc > 1) clamps moderate to 0", () => {
    // ctcGoldPct=0.7, nonCtcPct=0.5 → ctcModeratePct = max(0, -0.2) = 0
    // jurisdictionLGDDelta = 0.5 × 0.15 × 47.2 = 3.54
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0.7, nonCtcPct: 0.5 });
    const expectedDelta = 0.5 * 0.15 * 47.2;
    expect(result).toBeCloseTo(47.2 + expectedDelta, 4);
  });

  it("floor still holds with max non-CTC (nonCtcPct=1.0)", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0, nonCtcPct: 1.0 });
    expect(result).toBeGreaterThanOrEqual(47.2 * 0.3 - 0.001);
  });

  it("jurisdiction uplift stacks additively with macro stress", () => {
    const noJurisdiction = computeECLFromBase(47.2, { ...ZERO_INPUTS, rpkDelta: -0.25 });
    const withJurisdiction = computeECLFromBase(47.2, {
      ...ZERO_INPUTS, rpkDelta: -0.25, ctcGoldPct: 0, nonCtcPct: 0.5,
    });
    expect(withJurisdiction).toBeGreaterThan(noJurisdiction);
  });
});

describe("security deposit benefit", () => {
  it("ZERO_INPUTS has depositCoverage as 0", () => {
    expect(ZERO_INPUTS.depositCoverage).toBe(0);
  });

  it("depositCoverage = 0 → no benefit, backward-compatible with ZERO_INPUTS", () => {
    expect(computeECLFromBase(47.2, ZERO_INPUTS)).toBeCloseTo(47.2, 5);
  });

  it("depositCoverage = 0.10 → reduces ECL by 5% of baseECL (factor 0.50)", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, depositCoverage: 0.10 });
    expect(result).toBeCloseTo(47.2 * (1 - 0.10 * 0.50), 4);
  });

  it("depositCoverage = 1.0 → reduces ECL by 50% of baseECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, depositCoverage: 1.0 });
    expect(result).toBeCloseTo(47.2 * 0.50, 4);
  });

  it("deposit benefit stacks with macro stress (additive delta)", () => {
    const noDeposit = computeECLFromBase(47.2, { ...ZERO_INPUTS, rpkDelta: -0.25 });
    const withDeposit = computeECLFromBase(47.2, { ...ZERO_INPUTS, rpkDelta: -0.25, depositCoverage: 0.10 });
    expect(withDeposit).toBeLessThan(noDeposit);
    expect(withDeposit).toBeCloseTo(noDeposit - 47.2 * 0.10 * 0.50, 4);
  });

  it("floor still holds under max deposit coverage + no stress", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, depositCoverage: 0.90 });
    expect(result).toBeGreaterThanOrEqual(47.2 * 0.3 - 0.001);
  });
});

describe("restructuringType (DSL metadata)", () => {
  it("ZERO_INPUTS.restructuringType is null (feature inactive by default)", () => {
    expect(ZERO_INPUTS.restructuringType).toBeNull();
  });

  it("restructuringType does not affect ECL — it is DSL metadata only", () => {
    const withType    = computeECLFromBase(BASE_ECL, { ...ZERO_INPUTS, restructuringType: "standstill" });
    const withoutType = computeECLFromBase(BASE_ECL, { ...ZERO_INPUTS, restructuringType: null });
    expect(withType).toBe(withoutType);
  });
});

describe("payment behaviour delta", () => {
  it("ZERO_INPUTS has payBehaviourCoopPct and payBehaviourAdvPct as 0", () => {
    expect(ZERO_INPUTS.payBehaviourCoopPct).toBe(0);
    expect(ZERO_INPUTS.payBehaviourAdvPct).toBe(0);
  });

  it("both 0 → feature inactive, no ECL adjustment (backward-compatible)", () => {
    expect(computeECLFromBase(47.2, ZERO_INPUTS)).toBeCloseTo(47.2, 5);
  });

  it("100% adversarial → ECL increases by 12% of baseECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, payBehaviourAdvPct: 1.0 });
    expect(result).toBeCloseTo(47.2 * (1 + 0.12), 4);
  });

  it("100% cooperative → ECL decreases by 7% of baseECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, payBehaviourCoopPct: 1.0 });
    expect(result).toBeCloseTo(47.2 * (1 - 0.07), 4);
  });

  it("demo fleet mix: 52.2% coop + 19.9% adv → net ~−$0.30M", () => {
    const result = computeECLFromBase(47.2, {
      ...ZERO_INPUTS,
      payBehaviourCoopPct: 0.522,
      payBehaviourAdvPct: 0.199,
    });
    // delta = (0.199 × 0.12 − 0.522 × 0.07) × 47.2 ≈ −0.303M
    expect(result).toBeCloseTo(47.2 + (0.199 * 0.12 - 0.522 * 0.07) * 47.2, 2);
  });

  it("floor still holds under 100% adversarial + heavy macro stress", () => {
    const result = computeECLFromBase(47.2, {
      ...ZERO_INPUTS,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 1.0,
      rpkDelta: -0.80,
    });
    expect(result).toBeGreaterThanOrEqual(47.2 * 0.3 - 0.001);
  });

  it("over-specified inputs (coopPct + advPct > 1) do not crash — formula runs with raw values", () => {
    // parseDSL clamps coopPct + advPct ≤ 1, but a direct API caller could pass invalid inputs.
    // The formula runs without throwing — this documents the behaviour (no implicit clamp).
    expect(() =>
      computeECLFromBase(47.2, { ...ZERO_INPUTS, payBehaviourCoopPct: 0.7, payBehaviourAdvPct: 0.7 })
    ).not.toThrow();
  });
});
