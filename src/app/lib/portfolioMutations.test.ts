// src/app/lib/portfolioMutations.test.ts
import { describe, it, expect } from "vitest";
import { computeEcl } from "./portfolioMutations";

describe("computeEcl", () => {
  it("Stage 1: returns pd × lgd × ead", () => {
    expect(computeEcl(0.05, 0.45, 10_000_000, 1)).toBeCloseTo(225_000);
  });

  it("Stage 3: returns lgd × ead regardless of pd", () => {
    expect(computeEcl(0.05, 0.45, 10_000_000, 3)).toBeCloseTo(4_500_000);
  });

  it("Stage 2: uses compound lifetime PD formula", () => {
    // 2 years remaining, pd=0.05, lgd=0.45, ead=10M
    // lifetimePd = 1 - (1 - 0.05)^2 = 1 - 0.9025 = 0.0975
    // ecl = 0.0975 * 0.45 * 10_000_000 = 438_750
    const twoYearsFromNow = new Date(Date.now() + 2 * 365.25 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const result = computeEcl(0.05, 0.45, 10_000_000, 2, twoYearsFromNow);
    expect(result).toBeCloseTo(438_750, -3);
  });

  it("Stage 2 with past lease end date: remainingYears = 0, ECL = 0", () => {
    expect(computeEcl(0.05, 0.45, 10_000_000, 2, "2020-01-01")).toBeCloseTo(0);
  });

  it("returns null when lgd is null", () => {
    expect(computeEcl(0.05, null, 10_000_000, 1)).toBeNull();
  });

  it("returns null when ead is null", () => {
    expect(computeEcl(0.05, 0.45, null, 1)).toBeNull();
  });

  it("Stage 1: returns null when pd is null", () => {
    expect(computeEcl(null, 0.45, 10_000_000, 1)).toBeNull();
  });

  it("Stage 3: does NOT return null when pd is null (pd unused)", () => {
    expect(computeEcl(null, 0.45, 10_000_000, 3)).toBeCloseTo(4_500_000);
  });

  it("null stage defaults to Stage 1 formula", () => {
    expect(computeEcl(0.05, 0.45, 10_000_000, null)).toBeCloseTo(225_000);
  });
});
