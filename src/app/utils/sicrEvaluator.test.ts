import { describe, it, expect } from "vitest";
import { evaluateSICR } from "./sicrEvaluator";
import type { SICREvaluationInput, SICRConfig } from "./sicrEvaluator";

const DEFAULT_CONFIG: SICRConfig = {
  dpdEnabled: true,
  dpdDays: 30,
  upgradeEnabled: true,
  upgradeNotches: 2,
  countryWatchlistEnabled: true,
  insolvencyEnabled: true,
};

const BASE_LEASE: SICREvaluationInput = {
  leaseId: "LSE-TEST-001",
  lesseeId: "mock-l99",
  lesseeName: "Test Airline",
  aircraft: "A320neo",
  currentStage: "1",
  dpdDays: 0,
  ratingNotchesDown: 0,
  onCountryWatchlist: false,
  insolvencyFiled: false,
  baseECLm: 1.0,
};

describe("evaluateSICR", () => {
  it("returns empty array when no triggers fire", () => {
    expect(evaluateSICR([BASE_LEASE], DEFAULT_CONFIG)).toHaveLength(0);
  });

  it("recommends Stage 2 when DPD meets threshold", () => {
    const lease = { ...BASE_LEASE, dpdDays: 30 };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result).toHaveLength(1);
    expect(result[0].recommendedStage).toBe("2");
    expect(result[0].triggersFired).toContain("30+ DPD Backstop");
  });

  it("does NOT trigger when DPD is one below threshold", () => {
    const lease = { ...BASE_LEASE, dpdDays: 29 };
    expect(evaluateSICR([lease], DEFAULT_CONFIG)).toHaveLength(0);
  });

  it("recommends Stage 3 (not 2) when insolvency is filed", () => {
    const lease = { ...BASE_LEASE, insolvencyFiled: true };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result).toHaveLength(1);
    expect(result[0].recommendedStage).toBe("3");
    expect(result[0].triggersFired).toContain("Lessee Insolvency Filing");
  });

  it("recommends Stage 3 for a Stage 2 lease with insolvency", () => {
    const lease = { ...BASE_LEASE, currentStage: "2" as const, insolvencyFiled: true };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result).toHaveLength(1);
    expect(result[0].currentStage).toBe("2");
    expect(result[0].recommendedStage).toBe("3");
  });

  it("does not recommend when Stage 2 lease only has DPD trigger (already correctly staged)", () => {
    const lease = { ...BASE_LEASE, currentStage: "2" as const, dpdDays: 45 };
    expect(evaluateSICR([lease], DEFAULT_CONFIG)).toHaveLength(0);
  });

  it("does not recommend when Stage 3 lease has any trigger (already at max)", () => {
    const lease = { ...BASE_LEASE, currentStage: "3" as const, insolvencyFiled: true, dpdDays: 90 };
    expect(evaluateSICR([lease], DEFAULT_CONFIG)).toHaveLength(0);
  });

  it("returns empty array when all triggers are disabled", () => {
    const allOff: SICRConfig = {
      dpdEnabled: false, dpdDays: 30,
      upgradeEnabled: false, upgradeNotches: 2,
      countryWatchlistEnabled: false,
      insolvencyEnabled: false,
    };
    const lease = { ...BASE_LEASE, dpdDays: 90, insolvencyFiled: true, onCountryWatchlist: true };
    expect(evaluateSICR([lease], allOff)).toHaveLength(0);
  });

  it("includes all fired trigger names in triggersFired array", () => {
    const lease = { ...BASE_LEASE, dpdDays: 45, onCountryWatchlist: true };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result[0].triggersFired).toContain("30+ DPD Backstop");
    expect(result[0].triggersFired).toContain("Country Watchlist Event");
  });

  it("recommends Stage 2 for rating downgrade meeting threshold", () => {
    const lease = { ...BASE_LEASE, ratingNotchesDown: 2 };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result).toHaveLength(1);
    expect(result[0].recommendedStage).toBe("2");
    expect(result[0].triggersFired).toContain("Credit Downgrade (≥2 notches)");
  });

  it("does not trigger downgrade one notch below threshold", () => {
    const lease = { ...BASE_LEASE, ratingNotchesDown: 1 };
    expect(evaluateSICR([lease], DEFAULT_CONFIG)).toHaveLength(0);
  });

  it("eclDeltaM is correct for S1→S2 migration (1.8× multiplier)", () => {
    const lease = { ...BASE_LEASE, dpdDays: 35, baseECLm: 2.5 };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result[0].eclDeltaM).toBeCloseTo(2.5 * 0.8, 5); // 2.5 * (1.8 - 1) = 2.0
  });

  it("eclDeltaM is correct for S1→S3 migration (3.2× multiplier)", () => {
    const lease = { ...BASE_LEASE, insolvencyFiled: true, baseECLm: 1.0 };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result[0].recommendedStage).toBe("3");
    expect(result[0].eclDeltaM).toBeCloseTo(1.0 * 2.2, 5); // 1.0 * (3.2 - 1) = 2.2
  });

  it("eclDeltaM is correct for S2→S3 migration (1.6× multiplier)", () => {
    const lease = { ...BASE_LEASE, currentStage: "2" as const, insolvencyFiled: true, baseECLm: 3.0 };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result[0].recommendedStage).toBe("3");
    expect(result[0].eclDeltaM).toBeCloseTo(3.0 * 0.6, 5); // 3.0 * (1.6 - 1) = 1.8
  });

  it("handles empty lease array without error", () => {
    expect(evaluateSICR([], DEFAULT_CONFIG)).toEqual([]);
  });
});
