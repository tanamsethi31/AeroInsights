import { describe, it, expect } from "vitest";
import { computeLiveCalibration, SCENARIO_CALIBRATION } from "./intelligenceData";

const FULL_RAW = {
  ecbDepositRate: { value: 2.5, date: "2026-04-29T00:00:00Z" },
  eurUsd: { value: 1.05, date: "2026-04-29T00:00:00Z" },
  brentCrude: { value: 82.4, date: "2026-04-28T00:00:00Z" },
  gdp: [{ countryCode: "IND", year: "2026", value: 5.8 }],
  fetchedAt: "2026-04-29T12:00:00Z",
  partial: false,
};

describe("computeLiveCalibration", () => {
  it("computes a live GDP divergence from the IMF feed", () => {
    const result = computeLiveCalibration(FULL_RAW);
    const gdp = result.find(d => d.suggestedInputKey === "gdpDelta")!;
    expect(gdp.currentMarket).toContain("5.8%");
    expect(gdp.currentMarket).toContain("Live");
    // Baseline is 6.4% (static scenarioAssumption) — live 5.8% is -0.6pp.
    expect(gdp.suggestedValue).toBeCloseTo(-0.006, 4);
    expect(gdp.severity).toBe("high"); // |−0.6pp| >= 0.5pp
  });

  it("computes a live FX divergence from the ECB feed", () => {
    const result = computeLiveCalibration(FULL_RAW);
    const fx = result.find(d => d.suggestedInputKey === "fxDelta")!;
    expect(fx.currentMarket).toContain("1.05");
    expect(fx.currentMarket).toContain("Live");
    // Baseline is 1.1012 (static scenarioAssumption) — live 1.05 is about -4.65%.
    expect(fx.suggestedValue).toBeCloseTo((1.05 - 1.1012) / 1.1012, 4);
    expect(fx.severity).toBe("high"); // |−4.65%| > 3%
  });

  it("always passes fuel through unchanged from the static array — no live jet-fuel feed exists", () => {
    const result = computeLiveCalibration(FULL_RAW);
    const fuel = result.find(d => d.suggestedInputKey === "fuelDelta")!;
    const staticFuel = SCENARIO_CALIBRATION.find(d => d.suggestedInputKey === "fuelDelta")!;
    expect(fuel).toEqual(staticFuel);
  });

  it("falls back to the static GDP entry when gdp data is missing from the live feed", () => {
    const partialRaw = { ...FULL_RAW, gdp: [] };
    const result = computeLiveCalibration(partialRaw);
    const gdp = result.find(d => d.suggestedInputKey === "gdpDelta")!;
    const staticGdp = SCENARIO_CALIBRATION.find(d => d.suggestedInputKey === "gdpDelta")!;
    expect(gdp.currentMarket).toBe(`${staticGdp.currentMarket} · Reference`);
    expect(gdp.suggestedValue).toBe(staticGdp.suggestedValue);
  });

  it("falls back to the static FX entry when eurUsd is null in the live feed", () => {
    const partialRaw = { ...FULL_RAW, eurUsd: null };
    const result = computeLiveCalibration(partialRaw);
    const fx = result.find(d => d.suggestedInputKey === "fxDelta")!;
    const staticFx = SCENARIO_CALIBRATION.find(d => d.suggestedInputKey === "fxDelta")!;
    expect(fx.currentMarket).toBe(`${staticFx.currentMarket} · Reference`);
    expect(fx.suggestedValue).toBe(staticFx.suggestedValue);
  });

  it("returns exactly 3 entries in the same order as the static array", () => {
    const result = computeLiveCalibration(FULL_RAW);
    expect(result.map(d => d.id)).toEqual(SCENARIO_CALIBRATION.map(d => d.id));
  });
});
