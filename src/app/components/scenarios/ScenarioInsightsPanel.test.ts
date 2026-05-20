import { describe, it, expect } from "vitest";
import { deriveProvisionData, deriveRemainingS3 } from "./ScenarioInsightsPanel";
import type { ScenarioRunResult } from "./RunResultPanel";

function makeRun(overrides: Partial<ScenarioRunResult> = {}): ScenarioRunResult {
  return {
    id: "run-001",
    templateId: null,
    name: "Baseline",
    mode: "deterministic",
    paths: null,
    seed: 42,
    runDate: "2026-05-20",
    durationSec: "0.4s",
    ecl: 61.2,
    p5: null,
    p95: null,
    s1: 18.4,
    s2: 11.5,
    s3: 31.3,
    shapley: [{ driver: "PD stress", contribution: 46, direction: "up" }],
    keyFinding: "ECL elevated.",
    scenarioHash: "abc123",
    topLessees: [
      { name: "Air Arabia", ecl: 14.1, jurisdiction: "UAE" },
      { name: "FlyDubai",   ecl: 8.8,  jurisdiction: "UAE" },
    ],
    s3LeaseCount: 2,
    ...overrides,
  };
}

describe("deriveProvisionData", () => {
  it("flags under-provisioned when gap > 5% of baseECL", () => {
    const result = deriveProvisionData(61.2, 47.2);
    expect(result.adequacy).toBe("under");
    expect(result.gap).toBeCloseTo(14.0, 1);
    expect(result.gapPct).toBeCloseTo(29.66, 1);
  });

  it("flags over-provisioned when surplus > 5% of baseECL", () => {
    const result = deriveProvisionData(40.0, 47.2);
    expect(result.adequacy).toBe("over");
    expect(result.gap).toBeCloseTo(-7.2, 1);
  });

  it("flags adequate when gap is within ±5% of baseECL", () => {
    const result = deriveProvisionData(48.0, 47.2);
    expect(result.adequacy).toBe("adequate");
  });

  it("caps fillPct at 100 when ecl < baseECL", () => {
    const result = deriveProvisionData(30.0, 47.2);
    expect(result.fillPct).toBe(100);
  });

  it("computes fillPct correctly when ecl > baseECL", () => {
    const result = deriveProvisionData(61.2, 47.2);
    expect(result.fillPct).toBeCloseTo((47.2 / 61.2) * 100, 1);
  });
});

describe("deriveRemainingS3", () => {
  it("returns s3 minus top lessee sum", () => {
    const run = makeRun({ s3: 31.3, topLessees: [{ name: "A", ecl: 14.1, jurisdiction: "UAE" }, { name: "B", ecl: 8.8, jurisdiction: "UAE" }] });
    expect(deriveRemainingS3(run)).toBeCloseTo(8.4, 1);
  });

  it("returns 0 when top lessees account for all of s3", () => {
    const run = makeRun({ s3: 22.9, topLessees: [{ name: "A", ecl: 14.1, jurisdiction: "UAE" }, { name: "B", ecl: 8.8, jurisdiction: "UAE" }] });
    expect(deriveRemainingS3(run)).toBe(0);
  });

  it("never returns negative (guards rounding)", () => {
    const run = makeRun({ s3: 22.0, topLessees: [{ name: "A", ecl: 14.1, jurisdiction: "UAE" }, { name: "B", ecl: 8.8, jurisdiction: "UAE" }] });
    expect(deriveRemainingS3(run)).toBe(0);
  });

  it("returns s3 when topLessees is empty", () => {
    const run = makeRun({ s3: 31.3, topLessees: [] });
    expect(deriveRemainingS3(run)).toBeCloseTo(31.3, 1);
  });
});
