// src/app/data/lgdCurves.test.ts
import { describe, it, expect } from "vitest";
import {
  computeResidualValuePct,
  computeLgdBenchmark,
  computeFleetLgdAdjustment,
  DEFAULT_RESIDUAL_CURVES,
  DEFAULT_RECOVERY_FACTOR,
  DEFAULT_BASELINE_LGD,
} from "./lgdCurves";
import type { Asset, Provision } from "../types/portfolio";

function makeAsset(id: string, aircraftType: string, vintage: number): Asset {
  return {
    id, org_id: "demo", upload_id: null,
    registration: id, msn: id, aircraft_type: aircraftType,
    manufacturer: null, vintage,
    current_operator: null, created_at: "2024-01-01T00:00:00Z",
  };
}

function makeProvision(assetId: string, ead: number | null): Provision {
  return {
    id: `prov-${assetId}`, org_id: "demo",
    asset_id: assetId, lease_id: null,
    stage: 1, ecl_amount: null, pd: null, lgd: null,
    ead, auto_ecl: false, reporting_date: null, created_at: "2024-01-01T00:00:00Z",
  };
}

const REF_YEAR = 2026;

// ─── computeResidualValuePct — exact key ages ────────────────────────────────
describe("computeResidualValuePct — exact key ages", () => {
  it("NB age 0 → 1.000", () => expect(computeResidualValuePct("narrowbody", 0)).toBeCloseTo(1.000, 5));
  it("NB age 5 → 0.780", () => expect(computeResidualValuePct("narrowbody", 5)).toBeCloseTo(0.780, 5));
  it("NB age 10 → 0.580", () => expect(computeResidualValuePct("narrowbody", 10)).toBeCloseTo(0.580, 5));
  it("WB age 10 → 0.650", () => expect(computeResidualValuePct("widebody", 10)).toBeCloseTo(0.650, 5));
  it("Regional age 15 → 0.220", () => expect(computeResidualValuePct("regional", 15)).toBeCloseTo(0.220, 5));
  it("NB age 25 → 0.120", () => expect(computeResidualValuePct("narrowbody", 25)).toBeCloseTo(0.120, 5));
});

describe("computeResidualValuePct — interpolation", () => {
  // NB age 7: between age5=0.780 and age10=0.580, t=(7-5)/5=0.4 → 0.780+0.4*(0.580-0.780)=0.700
  it("NB age 7 interpolates correctly", () =>
    expect(computeResidualValuePct("narrowbody", 7)).toBeCloseTo(0.700, 5));
  // WB age 12: between age10=0.650 and age15=0.470, t=2/5=0.4 → 0.650+0.4*(0.470-0.650)=0.578
  it("WB age 12 interpolates correctly", () =>
    expect(computeResidualValuePct("widebody", 12)).toBeCloseTo(0.578, 5));
});

describe("computeResidualValuePct — boundary clamping", () => {
  it("age beyond 25yr clamps to age-25 floor", () =>
    expect(computeResidualValuePct("narrowbody", 30)).toBeCloseTo(0.120, 5));
  it("negative age (data anomaly) returns 1.0", () =>
    expect(computeResidualValuePct("narrowbody", -1)).toBeCloseTo(1.000, 5));
});

// ─── computeLgdBenchmark ─────────────────────────────────────────────────────
describe("computeLgdBenchmark", () => {
  // NB age 0: 1.0 * 0.72 = 0.72; LGD = 1 - 0.72 = 0.28
  it("new NB → LGD = 0.28 (baseline)", () =>
    expect(computeLgdBenchmark("narrowbody", 0, 0.72)).toBeCloseTo(0.28, 5));
  // NB age 10: residual=0.580; LGD = max(0.05, 1-0.580*0.72) = max(0.05,0.5824) = 0.5824
  it("NB age 10 → LGD ≈ 0.5824", () =>
    expect(computeLgdBenchmark("narrowbody", 10, 0.72)).toBeCloseTo(0.5824, 4));
  // Regional age 30, residual clamps to 0.050; LGD = max(0.05, 1-0.050*0.72) = max(0.05, 0.964) = 0.964
  it("floor of 0.05 not triggered for aged aircraft (LGD already high)", () =>
    expect(computeLgdBenchmark("regional", 30, 0.72)).toBeCloseTo(0.964, 4));
  // Floor test: very high recovery factor, new aircraft: 1 - 1.0 * 0.99 = 0.01 → clamp to 0.05
  it("floor of 0.05 holds when residualPct × recoveryFactor approaches 1", () =>
    expect(computeLgdBenchmark("narrowbody", 0, 0.99)).toBeCloseTo(0.05, 5));
});

// ─── computeFleetLgdAdjustment ────────────────────────────────────────────────
describe("computeFleetLgdAdjustment", () => {
  it("empty asset list returns lgdDecayAdjFactor=0 and empty map", () => {
    const { lgdDecayAdjFactor, perAssetLgd } =
      computeFleetLgdAdjustment([], [], DEFAULT_RECOVERY_FACTOR, REF_YEAR);
    expect(lgdDecayAdjFactor).toBe(0);
    expect(perAssetLgd.size).toBe(0);
  });

  it("single new NB aircraft (age 0) → lgdDecayAdjFactor = 0 (baseline LGD)", () => {
    // NB age 0: LGD=0.28 = DEFAULT_BASELINE_LGD → adj=0
    const assets = [makeAsset("a1", "A320neo", REF_YEAR)];
    const { lgdDecayAdjFactor } =
      computeFleetLgdAdjustment(assets, [], DEFAULT_RECOVERY_FACTOR, REF_YEAR);
    expect(lgdDecayAdjFactor).toBeCloseTo(0, 5);
  });

  it("mixed fleet returns positive adjustment", () => {
    // NB age 6 (vintage 2020): LGD≈0.4672 > baseline → positive adj
    const assets = [makeAsset("a1", "A320neo", 2020)];
    const { lgdDecayAdjFactor } =
      computeFleetLgdAdjustment(assets, [], DEFAULT_RECOVERY_FACTOR, REF_YEAR);
    expect(lgdDecayAdjFactor).toBeGreaterThan(0);
  });

  it("EAD-weighting: high-EAD aged asset dominates over new low-EAD asset", () => {
    // a1: NB age 6, LGD≈0.4672; a2: WB age 18, LGD≈0.744
    const assets = [
      makeAsset("a1", "A320neo",    2020), // age 6, LGD≈0.467
      makeAsset("a2", "B777-300ER", 2008), // age 18, LGD≈0.744
    ];
    // Equal-weighted average ≈ (0.467+0.744)/2 ≈ 0.606 → adj ≈ 0.326
    const eqResult = computeFleetLgdAdjustment(assets, [], DEFAULT_RECOVERY_FACTOR, REF_YEAR);
    // EAD-weighted: a1 EAD=10, a2 EAD=1000000 → a2 dominates → adj closer to 0.464
    const eadResult = computeFleetLgdAdjustment(
      assets,
      [makeProvision("a1", 10), makeProvision("a2", 1_000_000)],
      DEFAULT_RECOVERY_FACTOR,
      REF_YEAR
    );
    expect(eadResult.lgdDecayAdjFactor).toBeGreaterThan(eqResult.lgdDecayAdjFactor);
  });

  it("result clamped to [0, 0.50]", () => {
    const assets = Array.from({ length: 5 }, (_, i) =>
      makeAsset(`a${i}`, "ATR 72", 1990)
    );
    const { lgdDecayAdjFactor } =
      computeFleetLgdAdjustment(assets, [], DEFAULT_RECOVERY_FACTOR, REF_YEAR);
    expect(lgdDecayAdjFactor).toBeLessThanOrEqual(0.50);
    expect(lgdDecayAdjFactor).toBeGreaterThanOrEqual(0);
  });

  it("perAssetLgd map contains entry per qualifying asset", () => {
    const assets = [makeAsset("a1", "A320neo", 2020), makeAsset("a2", "B777-300ER", 2010)];
    const { perAssetLgd } =
      computeFleetLgdAdjustment(assets, [], DEFAULT_RECOVERY_FACTOR, REF_YEAR);
    expect(perAssetLgd.has("a1")).toBe(true);
    expect(perAssetLgd.has("a2")).toBe(true);
  });
});

// ─── Bounds and monotonicity ──────────────────────────────────────────────────
describe("DEFAULT_RESIDUAL_CURVES bounds", () => {
  const families = ["narrowbody", "widebody", "regional"] as const;
  const keys = ["age0", "age5", "age10", "age15", "age20", "age25"] as const;
  for (const family of families) {
    for (const key of keys) {
      it(`${family}.${key} is in (0, 1]`, () => {
        const v = DEFAULT_RESIDUAL_CURVES[family][key];
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    }
  }
});

describe("DEFAULT_RESIDUAL_CURVES monotonicity", () => {
  const families = ["narrowbody", "widebody", "regional"] as const;
  for (const family of families) {
    it(`${family} curve is non-increasing across ages`, () => {
      const s = DEFAULT_RESIDUAL_CURVES[family];
      const vals = [s.age0, s.age5, s.age10, s.age15, s.age20, s.age25];
      for (let i = 1; i < vals.length; i++) {
        expect(vals[i]).toBeLessThanOrEqual(vals[i - 1]);
      }
    });
  }
});
