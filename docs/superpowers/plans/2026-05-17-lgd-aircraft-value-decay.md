# LGD with Aircraft Value Decay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crude 3-tier `vintageAdjFactor` in the ECL engine with calibrated aircraft value decay curves (narrowbody / widebody / regional), and surface per-aircraft LGD benchmarks on Portfolio and Risk & ECL pages.

**Architecture:** Six layers — constants/pure-functions (`lgdCurves.ts`), family classifier (`aircraftFamilyMap.ts`), Supabase migration + hook (`useLgdCurves.ts`), upgraded ECL engine (`assetRisk.ts` + `eclCalculator.ts`), and three new UI components wired into Portfolio and RiskECL pages.

**Tech Stack:** TypeScript, React, Vitest, Supabase JS v2, inline styles (project convention)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/data/lgdCurves.ts` | **Create** | `AircraftFamily` type, `DEFAULT_RESIDUAL_CURVES`, `DEFAULT_RECOVERY_FACTOR`, `DEFAULT_BASELINE_LGD`, `computeResidualValuePct`, `computeLgdBenchmark`, `computeFleetLgdAdjustment` |
| `src/app/data/lgdCurves.test.ts` | **Create** | 12 unit tests: interpolation, LGD formula, fleet adjustment, bounds/monotonicity |
| `src/app/data/aircraftFamilyMap.ts` | **Create** | `classifyAircraftFamily(aircraftType): AircraftFamily`; NB/WB/Regional mappings; unknown → narrowbody |
| `src/app/data/aircraftFamilyMap.test.ts` | **Create** | 5 tests: known NB/WB/Regional, unknown fallback, case-insensitive |
| `supabase/migrations/004_lgd_curves.sql` | **Create** | `lgd_recovery_overrides` table (one row per org) |
| `src/app/hooks/useLgdCurves.ts` | **Create** | Load/save firm recovery factor override; stale-closure guard |
| `src/app/utils/assetRisk.ts` | **Modify** | New `computePortfolioAssetRisk` signature; add `assetId` to `AssetRiskRow`; return `lgdDecayAdjFactor` + `perAssetLgd`; remove `vintageAdjFactor` |
| `src/app/utils/assetRisk.test.ts` | **Modify** | Update existing tests to new signature; add 3 new tests |
| `src/app/utils/eclCalculator.ts` | **Modify** | Rename `vintageAdjFactor` → `lgdDecayAdjFactor` in `ScenarioInputs`, `ZERO_INPUTS`, formula line |
| `src/app/components/scenarios/AssetRiskTab.tsx` | **Modify** | Pass `recoveryFactor` to `computePortfolioAssetRisk`; destructure `lgdDecayAdjFactor` |
| `src/app/pages/Scenarios.tsx` | **Modify** | Pass `recoveryFactor` to `computePortfolioAssetRisk`; rename all `vintageAdjFactor` references |
| `src/app/pages/RiskECL.tsx` | **Modify** | Rename `vintageAdjFactor` → `lgdDecayAdjFactor` in both presets |
| `src/app/components/portfolio/LgdBenchmarkPanel.tsx` | **Create** | Per-asset LGD panel for Portfolio Aircraft sub-tab |
| `src/app/components/risk-ecl/LgdDecaySummaryCard.tsx` | **Create** | Fleet LGD table + summary for Risk & ECL page |
| `src/app/components/risk-ecl/RecoveryFactorDrawer.tsx` | **Create** | Firm-level recovery factor override drawer |
| `src/app/pages/Portfolio.tsx` | **Modify** | Mount `useLgdCurves`; add "LGD" sub-tab; render `LgdBenchmarkPanel` |
| `src/app/pages/RiskECL.tsx` | **Modify** | Mount `useLgdCurves`; add `LgdDecaySummaryCard`; wire `lgdDecayAdjFactor` pre-population; add `RecoveryFactorDrawer` |

---

## Task 1: lgdCurves.ts — constants and pure functions (TDD)

**Files:**
- Create: `src/app/data/lgdCurves.ts`
- Create: `src/app/data/lgdCurves.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
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

// ─── computeResidualValuePct ─────────────────────────────────────────────────

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
  // Floor: regional age 30, residual clamps to 0.050; LGD = max(0.05, 1-0.050*0.72) = max(0.05, 0.964) = 0.964
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
    // EAD-weighted: a1 EAD=10, a2 EAD=1000 → a2 dominates → adj closer to 0.464
    const eadResult = computeFleetLgdAdjustment(
      assets,
      [makeProvision("a1", 10), makeProvision("a2", 1_000_000)],
      DEFAULT_RECOVERY_FACTOR,
      REF_YEAR
    );
    expect(eadResult.lgdDecayAdjFactor).toBeGreaterThan(eqResult.lgdDecayAdjFactor);
  });

  it("result clamped to [0, 0.50]", () => {
    // Very aged regional fleet should not exceed 0.50
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/data/lgdCurves.test.ts 2>&1 | tail -10
```
Expected: FAIL with "Cannot find module './lgdCurves'"

- [ ] **Step 3: Implement lgdCurves.ts**

```typescript
// src/app/data/lgdCurves.ts
// Pure-function utilities for LGD benchmarks derived from aircraft value decay curves.
// No React dependencies.

import type { Asset, Provision } from "../types/portfolio";
import { classifyAircraftFamily } from "./aircraftFamilyMap";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AircraftFamily = "narrowbody" | "widebody" | "regional";

export const AIRCRAFT_FAMILY_LABELS: Record<AircraftFamily, string> = {
  narrowbody: "Narrowbody",
  widebody:   "Widebody",
  regional:   "Regional Jet",
};

export interface ResidualValueSchedule {
  age0:  number;
  age5:  number;
  age10: number;
  age15: number;
  age20: number;
  age25: number;
  source:         string;
  calibratedYear: number;
}

export type ResidualValueLibrary = Record<AircraftFamily, ResidualValueSchedule>;

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_RECOVERY_FACTOR = 0.72;
export const DEFAULT_BASELINE_LGD    = 0.28; // LGD at age 0 with default recovery factor

export const DEFAULT_RESIDUAL_CURVES: ResidualValueLibrary = {
  narrowbody: {
    age0: 1.000, age5: 0.780, age10: 0.580, age15: 0.380, age20: 0.220, age25: 0.120,
    source: "AVAC Aircraft Value Reference 2023 (NB cohort 1990–2023); Cirium Fleets Analyzer 2023",
    calibratedYear: 2023,
  },
  widebody: {
    age0: 1.000, age5: 0.820, age10: 0.650, age15: 0.470, age20: 0.280, age25: 0.140,
    source: "AVAC Aircraft Value Reference 2023 (WB cohort 1995–2023); Boeing/Airbus residual value studies",
    calibratedYear: 2023,
  },
  regional: {
    age0: 1.000, age5: 0.680, age10: 0.420, age15: 0.220, age20: 0.110, age25: 0.050,
    source: "AVAC Aircraft Value Reference 2023 (Regional cohort); thin secondary market premium applied",
    calibratedYear: 2023,
  },
};

// ─── Pure functions ───────────────────────────────────────────────────────────

const KEY_AGES   = [0, 5, 10, 15, 20, 25];
const KEY_FIELDS = ["age0", "age5", "age10", "age15", "age20", "age25"] as const;

/**
 * Linearly interpolate residual value % at a given age.
 * Clamps to age-25 floor for aircraft older than 25yr.
 * Returns 1.0 for negative ages (data anomaly / pre-delivery).
 */
export function computeResidualValuePct(
  family: AircraftFamily,
  ageYears: number,
): number {
  if (ageYears < 0) return 1.0;
  const schedule = DEFAULT_RESIDUAL_CURVES[family];
  if (ageYears >= 25) return schedule.age25;

  for (let i = 0; i < KEY_AGES.length - 1; i++) {
    if (ageYears >= KEY_AGES[i] && ageYears < KEY_AGES[i + 1]) {
      const t   = (ageYears - KEY_AGES[i]) / (KEY_AGES[i + 1] - KEY_AGES[i]);
      const lo  = schedule[KEY_FIELDS[i]];
      const hi  = schedule[KEY_FIELDS[i + 1]];
      return lo + t * (hi - lo);
    }
  }
  return schedule.age25;
}

/**
 * Derive LGD benchmark from residual value % and recovery factor.
 * LGD = max(0.05, 1 − residualValuePct × recoveryFactor)
 */
export function computeLgdBenchmark(
  family: AircraftFamily,
  ageYears: number,
  recoveryFactor: number,
): number {
  const residualPct = computeResidualValuePct(family, ageYears);
  return Math.max(0.05, 1 - residualPct * recoveryFactor);
}

/**
 * Compute fleet-weighted LGD adjustment for the ECL engine.
 *
 * Weighting:
 *   - When provisions provided and at least one has non-null EAD: EAD-weighted.
 *   - When provisions provided but all EAD are null: equal-weighted across qualifying assets.
 *   - When provisions empty: equal-weighted across qualifying assets.
 *
 * Returns:
 *   lgdDecayAdjFactor = clamp(fleetWeightedLgd − DEFAULT_BASELINE_LGD, 0, 0.50)
 *   perAssetLgd = map of asset.id → LGD benchmark
 */
export function computeFleetLgdAdjustment(
  assets: Asset[],
  provisions: Provision[],
  recoveryFactor: number,
  reportingYear: number = new Date().getFullYear(),
): { lgdDecayAdjFactor: number; perAssetLgd: Map<string, number> } {
  const perAssetLgd = new Map<string, number>();
  if (assets.length === 0) return { lgdDecayAdjFactor: 0, perAssetLgd };

  // Build asset_id → total EAD from provisions
  const eadByAsset = new Map<string, number>();
  for (const p of provisions) {
    if (p.ead != null && p.ead > 0) {
      eadByAsset.set(p.asset_id, (eadByAsset.get(p.asset_id) ?? 0) + p.ead);
    }
  }

  // Compute per-asset LGD for qualifying assets (known vintage)
  for (const asset of assets) {
    if (asset.vintage == null) continue;
    const ageYears = reportingYear - asset.vintage;
    if (ageYears < 0) continue;
    const family = classifyAircraftFamily(asset.aircraft_type);
    const lgd    = computeLgdBenchmark(family, ageYears, recoveryFactor);
    perAssetLgd.set(asset.id, lgd);
  }

  if (perAssetLgd.size === 0) return { lgdDecayAdjFactor: 0, perAssetLgd };

  // Compute weighted average LGD
  let weightedLgdSum = 0;
  let totalWeight    = 0;
  for (const [assetId, lgd] of perAssetLgd) {
    const weight = eadByAsset.get(assetId) ?? 1; // equal weight when no EAD
    weightedLgdSum += lgd * weight;
    totalWeight    += weight;
  }

  const fleetWeightedLgd = weightedLgdSum / totalWeight;
  const lgdDecayAdjFactor = Math.min(0.50, Math.max(0, fleetWeightedLgd - DEFAULT_BASELINE_LGD));

  return { lgdDecayAdjFactor, perAssetLgd };
}
```

Note: `lgdCurves.ts` imports `classifyAircraftFamily` from `./aircraftFamilyMap`. Task 2 must be implemented before tests can pass. The test file imports only from `lgdCurves.ts`, so write both files before running tests.

- [ ] **Step 4: Run tests — expect failures only on aircraftFamilyMap import**

```bash
npx vitest run src/app/data/lgdCurves.test.ts 2>&1 | tail -10
```
Expected: FAIL with "Cannot find module './aircraftFamilyMap'"

---

## Task 2: aircraftFamilyMap.ts — family classifier (TDD)

**Files:**
- Create: `src/app/data/aircraftFamilyMap.ts`
- Create: `src/app/data/aircraftFamilyMap.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/data/aircraftFamilyMap.test.ts
import { describe, it, expect } from "vitest";
import { classifyAircraftFamily } from "./aircraftFamilyMap";

describe("classifyAircraftFamily — narrowbody", () => {
  it("A320neo → narrowbody", () => expect(classifyAircraftFamily("A320neo")).toBe("narrowbody"));
  it("A321XLR → narrowbody", () => expect(classifyAircraftFamily("A321XLR")).toBe("narrowbody"));
  it("B737 MAX 8 → narrowbody", () => expect(classifyAircraftFamily("B737 MAX 8")).toBe("narrowbody"));
  it("B737-800 → narrowbody", () => expect(classifyAircraftFamily("B737-800")).toBe("narrowbody"));
  it("A220-300 → narrowbody", () => expect(classifyAircraftFamily("A220-300")).toBe("narrowbody"));
});

describe("classifyAircraftFamily — widebody", () => {
  it("B777-300ER → widebody", () => expect(classifyAircraftFamily("B777-300ER")).toBe("widebody"));
  it("A350-900 → widebody",   () => expect(classifyAircraftFamily("A350-900")).toBe("widebody"));
  it("B787-9 → widebody",     () => expect(classifyAircraftFamily("B787-9")).toBe("widebody"));
  it("A330-300 → widebody",   () => expect(classifyAircraftFamily("A330-300")).toBe("widebody"));
  it("A380 → widebody",       () => expect(classifyAircraftFamily("A380")).toBe("widebody"));
});

describe("classifyAircraftFamily — regional", () => {
  it("ATR 72 → regional",  () => expect(classifyAircraftFamily("ATR 72")).toBe("regional"));
  it("ATR 42 → regional",  () => expect(classifyAircraftFamily("ATR 42")).toBe("regional"));
  it("CRJ-900 → regional", () => expect(classifyAircraftFamily("CRJ-900")).toBe("regional"));
  it("E175 → regional",    () => expect(classifyAircraftFamily("E175")).toBe("regional"));
  it("Q400 → regional",    () => expect(classifyAircraftFamily("Q400")).toBe("regional"));
});

describe("classifyAircraftFamily — fallback and case", () => {
  it("unknown type → narrowbody", () => expect(classifyAircraftFamily("XYZ-999")).toBe("narrowbody"));
  it("case-insensitive: b777-300er → widebody", () => expect(classifyAircraftFamily("b777-300er")).toBe("widebody"));
  it("case-insensitive: a320NEO → narrowbody",  () => expect(classifyAircraftFamily("a320NEO")).toBe("narrowbody"));
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/app/data/aircraftFamilyMap.test.ts 2>&1 | tail -5
```
Expected: FAIL with "Cannot find module './aircraftFamilyMap'"

- [ ] **Step 3: Implement aircraftFamilyMap.ts**

```typescript
// src/app/data/aircraftFamilyMap.ts
// Maps aircraft_type strings to AircraftFamily for LGD decay curve selection.
// Unknown types default to "narrowbody" with a console warning.

import type { AircraftFamily } from "./lgdCurves";

// Widebody prefixes checked first (before NB) to avoid A330 matching "A3" NB prefix.
const WB_SUBSTRINGS = [
  "A330", "A340", "A350", "A380",
  "B767", "B777", "B787",
  "767", "777", "787",
];

// Regional prefixes / substrings
const REGIONAL_SUBSTRINGS = [
  "ATR", "CRJ", "Q400", "DASH 8", "DASH8",
  "E170", "E175", "E190", "E195",
];

// Narrowbody prefixes
const NB_SUBSTRINGS = [
  "A220", "A318", "A319", "A320", "A321",
  "B737", "737",
  "E190-E2", "E195-E2",
];

/**
 * Classify an aircraft type string into a value decay family.
 * Matching is case-insensitive substring/prefix.
 * Precedence: widebody > regional > narrowbody > fallback narrowbody.
 */
export function classifyAircraftFamily(aircraftType: string): AircraftFamily {
  const upper = aircraftType.toUpperCase().trim();

  if (WB_SUBSTRINGS.some((s) => upper.includes(s.toUpperCase()))) return "widebody";
  if (REGIONAL_SUBSTRINGS.some((s) => upper.includes(s.toUpperCase()))) return "regional";
  if (NB_SUBSTRINGS.some((s) => upper.includes(s.toUpperCase()))) return "narrowbody";

  console.warn(`[classifyAircraftFamily] Unknown aircraft type "${aircraftType}" — defaulting to narrowbody`);
  return "narrowbody";
}
```

- [ ] **Step 4: Run all lgdCurves + aircraftFamilyMap tests**

```bash
npx vitest run src/app/data/lgdCurves.test.ts src/app/data/aircraftFamilyMap.test.ts 2>&1 | tail -15
```
Expected: All tests PASS. Count should be 12 (lgdCurves bounds/monotonicity tests are generated loops — ~30 total assertions) + 18 (aircraftFamilyMap) = ~48 assertions.

- [ ] **Step 5: Commit**

```bash
git add src/app/data/lgdCurves.ts src/app/data/lgdCurves.test.ts src/app/data/aircraftFamilyMap.ts src/app/data/aircraftFamilyMap.test.ts
git commit -m "feat: add LGD decay curve constants, pure functions, and family classifier"
```

---

## Task 3: Supabase migration + useLgdCurves hook

**Files:**
- Create: `supabase/migrations/004_lgd_curves.sql`
- Create: `src/app/hooks/useLgdCurves.ts`

- [ ] **Step 1: Create migration**

```sql
-- supabase/migrations/004_lgd_curves.sql
-- lgd decay curves: firm-level recovery factor overrides (one row per org)

create table if not exists lgd_recovery_overrides (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  recovery_factor numeric(5,4) not null check (recovery_factor > 0.10 and recovery_factor < 0.95),
  notes           text,
  updated_by      text,
  updated_at      timestamptz not null default now(),
  unique (org_id)
);

create index if not exists lgd_recovery_overrides_org_id_idx
  on lgd_recovery_overrides(org_id);
```

- [ ] **Step 2: Implement useLgdCurves.ts**

```typescript
// src/app/hooks/useLgdCurves.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { DEFAULT_RECOVERY_FACTOR } from "../data/lgdCurves";

export interface LgdCurvesState {
  recoveryFactor:       number;
  isOverridden:         boolean;
  loading:              boolean;
  saveRecoveryOverride: (factor: number, notes?: string, updatedBy?: string) => Promise<void>;
  resetToDefault:       () => Promise<void>;
}

export function useLgdCurves(): LgdCurvesState {
  const { orgId } = useData();
  const [recoveryFactor, setRecoveryFactor] = useState(DEFAULT_RECOVERY_FACTOR);
  const [isOverridden, setIsOverridden]     = useState(false);
  const [loading, setLoading]               = useState(false);

  const fetchOverride = useCallback(async () => {
    if (!orgId) return;
    const { data, error } = await supabase
      .from("lgd_recovery_overrides")
      .select("recovery_factor")
      .eq("org_id", orgId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!orgId) {
        if (!cancelled) {
          setRecoveryFactor(DEFAULT_RECOVERY_FACTOR);
          setIsOverridden(false);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("lgd_recovery_overrides")
          .select("recovery_factor")
          .eq("org_id", orgId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) {
          if (data) {
            setRecoveryFactor(Number(data.recovery_factor));
            setIsOverridden(true);
          } else {
            setRecoveryFactor(DEFAULT_RECOVERY_FACTOR);
            setIsOverridden(false);
          }
        }
      } catch (err) {
        console.error("[useLgdCurves] fetch error:", err);
        if (!cancelled) {
          setRecoveryFactor(DEFAULT_RECOVERY_FACTOR);
          setIsOverridden(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [orgId]);

  const saveRecoveryOverride = useCallback(
    async (factor: number, notes?: string, updatedBy?: string) => {
      if (!orgId) return;
      const { error } = await supabase.from("lgd_recovery_overrides").upsert(
        {
          org_id: orgId,
          recovery_factor: factor,
          notes: notes ?? null,
          updated_by: updatedBy ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id" }
      );
      if (error) throw error;
      const data = await fetchOverride();
      if (data) {
        setRecoveryFactor(Number(data.recovery_factor));
        setIsOverridden(true);
      }
    },
    [orgId, fetchOverride]
  );

  const resetToDefault = useCallback(async () => {
    if (!orgId) return;
    const { error } = await supabase
      .from("lgd_recovery_overrides")
      .delete()
      .eq("org_id", orgId);
    if (error) throw error;
    setRecoveryFactor(DEFAULT_RECOVERY_FACTOR);
    setIsOverridden(false);
  }, [orgId]);

  return { recoveryFactor, isOverridden, loading, saveRecoveryOverride, resetToDefault };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "lgdCurves|aircraftFamily|useLgdCurves|004_lgd" | head -10
```
Expected: No errors for new files.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_lgd_curves.sql src/app/hooks/useLgdCurves.ts
git commit -m "feat: add lgd_recovery_overrides migration and useLgdCurves hook"
```

---

## Task 4: Upgrade assetRisk.ts + assetRisk.test.ts

**Files:**
- Modify: `src/app/utils/assetRisk.ts`
- Modify: `src/app/utils/assetRisk.test.ts`

The existing `computePortfolioAssetRisk(assets, leases, referenceYear?)` returns `vintageAdjFactor`. The new signature is `(assets, leases, recoveryFactor, referenceYear?, provisions?)` and returns `lgdDecayAdjFactor` + `perAssetLgd` instead.

**Computed expected values for updated tests (REF_YEAR=2026, recoveryFactor=0.72):**
- NB age 6 (A320neo vintage 2020): residual=0.740 → LGD=0.4672 → adj=0.1872
- WB age 11 (A330-300 vintage 2015): residual=0.614 → LGD=0.5579 → adj=0.2779
- WB age 18 (B777-300ER vintage 2008): residual=0.356 → LGD=0.7437 → adj=0.4637
- NB age 6 ($400k) + WB age 11 ($100k): rental-weighted LGD=0.4853 → adj=0.2053

- [ ] **Step 1: Update assetRisk.test.ts with new signature and expected values**

```typescript
// src/app/utils/assetRisk.test.ts
import { describe, it, expect } from "vitest";
import {
  isWidebody,
  vintageAgeTier,
  vintageLGDAdj,
  computePortfolioAssetRisk,
  NB_REMARKETING_MONTHS,
  WB_REMARKETING_MONTHS,
  REMARKETING_BENCHMARK_MONTHS,
} from "./assetRisk";
import { DEFAULT_RECOVERY_FACTOR } from "../data/lgdCurves";
import type { Asset, Lease, Provision } from "../types/portfolio";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAsset(id: string, aircraftType: string, vintage: number): Asset {
  return {
    id, org_id: "demo", upload_id: null,
    registration: id, msn: id, aircraft_type: aircraftType,
    manufacturer: null, vintage,
    current_operator: null, created_at: "2024-01-01T00:00:00Z",
  };
}

function makeLease(assetId: string, monthlyRental: number): Lease {
  return {
    id: `ls-${assetId}`, org_id: "demo",
    asset_id: assetId, lessee_id: `lessee-${assetId}`,
    start_date: "2024-01-01", end_date: "2030-01-01",
    monthly_rental: monthlyRental, currency: "USD",
    stage: 1, created_at: "2024-01-01T00:00:00Z",
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

const RF  = DEFAULT_RECOVERY_FACTOR; // 0.72
const REF = 2026;

// ─── isWidebody / vintageAgeTier / vintageLGDAdj (unchanged) ─────────────────

describe("isWidebody", () => {
  it("B777-300ER → widebody", () => expect(isWidebody("B777-300ER")).toBe(true));
  it("A350-900 → widebody",   () => expect(isWidebody("A350-900")).toBe(true));
  it("A330-300 → widebody",   () => expect(isWidebody("A330-300")).toBe(true));
  it("B787-9 → widebody",     () => expect(isWidebody("B787-9")).toBe(true));
  it("A320neo → narrowbody",  () => expect(isWidebody("A320neo")).toBe(false));
  it("B737 MAX 8 → narrowbody", () => expect(isWidebody("B737 MAX 8")).toBe(false));
  it("A220-300 → narrowbody", () => expect(isWidebody("A220-300")).toBe(false));
  it("A321neo → narrowbody",  () => expect(isWidebody("A321neo")).toBe(false));
  it("case-insensitive: b777-300er → widebody", () => expect(isWidebody("b777-300er")).toBe(true));
});

describe("vintageAgeTier", () => {
  it("age 9 → young",  () => expect(vintageAgeTier(9)).toBe("young"));
  it("age 10 → mid",   () => expect(vintageAgeTier(10)).toBe("mid"));
  it("age 15 → mid",   () => expect(vintageAgeTier(15)).toBe("mid"));
  it("age 16 → aged",  () => expect(vintageAgeTier(16)).toBe("aged"));
  it("age 20 → aged",  () => expect(vintageAgeTier(20)).toBe("aged"));
  it("age 0 → young",  () => expect(vintageAgeTier(0)).toBe("young"));
});

describe("vintageLGDAdj", () => {
  it("age 9 → 0",     () => expect(vintageLGDAdj(9)).toBe(0));
  it("age 10 → 0.04", () => expect(vintageLGDAdj(10)).toBe(0.04));
  it("age 15 → 0.04", () => expect(vintageLGDAdj(15)).toBe(0.04));
  it("age 16 → 0.10", () => expect(vintageLGDAdj(16)).toBe(0.10));
});

describe("constants", () => {
  it("NB_REMARKETING_MONTHS = 4", () => expect(NB_REMARKETING_MONTHS).toBe(4));
  it("WB_REMARKETING_MONTHS = 9", () => expect(WB_REMARKETING_MONTHS).toBe(9));
  it("REMARKETING_BENCHMARK_MONTHS = 3", () => expect(REMARKETING_BENCHMARK_MONTHS).toBe(3));
});

// ─── computePortfolioAssetRisk ────────────────────────────────────────────────

describe("computePortfolioAssetRisk", () => {
  it("empty inputs → all zeros, empty rows", () => {
    const result = computePortfolioAssetRisk([], [], RF, REF);
    expect(result.rows).toHaveLength(0);
    expect(result.suggestedRemarketingMonths).toBe(0);
    expect(result.lgdDecayAdjFactor).toBe(0);
    expect(result.avgFleetAgeYears).toBe(0);
    expect(result.pctMidAged).toBe(0);
    expect(result.pctAged).toBe(0);
    expect(result.perAssetLgd.size).toBe(0);
  });

  it("single NB age-6 asset: suggestedRemarketing = NB benchmark, lgdDecayAdjFactor > 0", () => {
    // A320neo vintage 2020, age=6 → narrowbody → residual=0.740, LGD=0.4672, adj=0.1872
    const assets = [makeAsset("a1", "A320neo", 2020)];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, RF, REF);
    expect(result.suggestedRemarketingMonths).toBe(NB_REMARKETING_MONTHS);
    expect(result.lgdDecayAdjFactor).toBeCloseTo(0.1872, 3);
    expect(result.avgFleetAgeYears).toBeCloseTo(6, 5);
    expect(result.pctMidAged).toBe(0);
    expect(result.pctAged).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].ageTier).toBe("young");
    expect(result.rows[0].assetId).toBe("a1");
    expect(result.perAssetLgd.get("a1")).toBeCloseTo(0.4672, 3);
  });

  it("single WB age-11 asset: suggestedRemarketing = WB benchmark, lgdDecayAdjFactor ≈ 0.278", () => {
    // A330-300 vintage 2015, age=11 → widebody → residual=0.614, LGD=0.5579, adj=0.2779
    const assets = [makeAsset("a1", "A330-300", 2015)];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, RF, REF);
    expect(result.suggestedRemarketingMonths).toBe(WB_REMARKETING_MONTHS);
    expect(result.lgdDecayAdjFactor).toBeCloseTo(0.2779, 3);
    expect(result.pctMidAged).toBeCloseTo(1.0, 5);
    expect(result.rows[0].ageTier).toBe("mid");
  });

  it("single aged WB asset: lgdDecayAdjFactor ≈ 0.464", () => {
    // B777-300ER vintage 2008, age=18 → widebody → residual=0.356, LGD=0.7437, adj=0.4637
    const assets = [makeAsset("a1", "B777-300ER", 2008)];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, RF, REF);
    expect(result.lgdDecayAdjFactor).toBeCloseTo(0.4637, 3);
    expect(result.pctAged).toBeCloseTo(1.0, 5);
    expect(result.rows[0].ageTier).toBe("aged");
  });

  it("lgdDecayAdjFactor is rental-weighted", () => {
    // NB $400k (age 6, LGD=0.4672) + WB $100k (age 11, LGD=0.5579)
    // weighted = (400k*0.4672 + 100k*0.5579) / 500k = 0.4853
    // adj = clamp(0.4853 - 0.28, 0, 0.50) = 0.2053
    const assets = [
      makeAsset("a1", "A320neo",  2020),
      makeAsset("a2", "A330-300", 2015),
    ];
    const leases = [makeLease("a1", 400_000), makeLease("a2", 100_000)];
    const result = computePortfolioAssetRisk(assets, leases, RF, REF);
    expect(result.lgdDecayAdjFactor).toBeCloseTo(0.2053, 3);
  });

  it("suggestedRemarketingMonths is rental-weighted by NB/WB", () => {
    const assets = [
      makeAsset("a1", "A320neo",    2020),
      makeAsset("a2", "B777-300ER", 2020),
    ];
    const leases = [makeLease("a1", 750_000), makeLease("a2", 250_000)];
    const result = computePortfolioAssetRisk(assets, leases, RF, REF);
    expect(result.suggestedRemarketingMonths).toBe(5);
  });

  it("asset with no matching lease is excluded", () => {
    const assets = [makeAsset("a1", "A320neo", 2020), makeAsset("a2", "A330-300", 2018)];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, RF, REF);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].registration).toBe("a1");
  });

  it("asset with null monthly_rental is excluded", () => {
    const assets = [makeAsset("a1", "A320neo", 2020)];
    const leases = [{ ...makeLease("a1", 0), monthly_rental: null }];
    const result = computePortfolioAssetRisk(assets, leases, RF, REF);
    expect(result.rows).toHaveLength(0);
  });

  it("asset with null vintage is excluded", () => {
    const assets = [{ ...makeAsset("a1", "A320neo", 2020), vintage: null }];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, RF, REF);
    expect(result.rows).toHaveLength(0);
  });

  it("rows sorted by weightPct descending", () => {
    const assets = [
      makeAsset("a1", "A320neo", 2020),
      makeAsset("a2", "A330-300", 2018),
    ];
    const leases = [makeLease("a1", 100_000), makeLease("a2", 900_000)];
    const result = computePortfolioAssetRisk(assets, leases, RF, REF);
    expect(result.rows[0].registration).toBe("a2");
    expect(result.rows[1].registration).toBe("a1");
  });

  it("avgFleetAgeYears is rental-weighted", () => {
    const assets = [makeAsset("a1", "A320neo", 2021), makeAsset("a2", "A330-300", 2011)];
    const leases = [makeLease("a1", 1_000_000), makeLease("a2", 1_000_000)];
    const result = computePortfolioAssetRisk(assets, leases, RF, REF);
    expect(result.avgFleetAgeYears).toBeCloseTo(10, 1);
  });

  // ── New tests (Tasks 18–20 from spec) ──

  it("higher recoveryFactor → lower lgdDecayAdjFactor", () => {
    // NB age 6: RF=0.72 → adj≈0.187; RF=0.90 → LGD=max(0.05,1-0.740*0.90)=0.334 → adj=0.054
    const assets = [makeAsset("a1", "A320neo", 2020)];
    const leases = [makeLease("a1", 500_000)];
    const low  = computePortfolioAssetRisk(assets, leases, 0.72, REF).lgdDecayAdjFactor;
    const high = computePortfolioAssetRisk(assets, leases, 0.90, REF).lgdDecayAdjFactor;
    expect(high).toBeLessThan(low);
  });

  it("provisions with null EAD fall back to equal weighting", () => {
    // a1: NB age 6, LGD≈0.467; a2: WB age 18, LGD≈0.744
    // rental: a1=$900k, a2=$100k → rental-weighted avg ≈ 0.495, adj≈0.215
    // provisions all EAD=null → equal-weighted avg ≈ 0.606, adj≈0.326 (different)
    const assets = [
      makeAsset("a1", "A320neo",    2020),
      makeAsset("a2", "B777-300ER", 2008),
    ];
    const leases = [makeLease("a1", 900_000), makeLease("a2", 100_000)];
    const withoutProvisions = computePortfolioAssetRisk(assets, leases, RF, REF);
    const nullEadProvisions = [makeProvision("a1", null), makeProvision("a2", null)];
    const withNullProvisions = computePortfolioAssetRisk(assets, leases, RF, REF, nullEadProvisions);
    // Equal-weighted gives higher adj when aged asset has less rental weight
    expect(withNullProvisions.lgdDecayAdjFactor).toBeGreaterThan(withoutProvisions.lgdDecayAdjFactor);
  });
});
```

- [ ] **Step 2: Run to verify failures**

```bash
npx vitest run src/app/utils/assetRisk.test.ts 2>&1 | tail -10
```
Expected: Many FAIL — wrong signature, `vintageAdjFactor` still returned.

- [ ] **Step 3: Update assetRisk.ts**

Replace the entire file content:

```typescript
// src/app/utils/assetRisk.ts
// Pure-function utilities for fleet asset risk analysis (remarketing timeline + LGD decay).
// No React dependencies — safe to use in both components and tests.

import type { Asset, Lease, Provision } from "../types/portfolio";
import { classifyAircraftFamily } from "../data/aircraftFamilyMap";
import { computeLgdBenchmark, DEFAULT_BASELINE_LGD } from "../data/lgdCurves";

// ─── Constants ────────────────────────────────────────────────────────────────

export const REMARKETING_BENCHMARK_MONTHS = 3;
export const NB_REMARKETING_MONTHS = 4;
export const WB_REMARKETING_MONTHS = 9;

export const VINTAGE_LGD_TIERS = {
  young: 0,
  mid:   0.04,
  aged:  0.10,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type VintageAgeTier = "young" | "mid" | "aged";

export interface AssetRiskRow {
  assetId:       string;
  registration:  string;
  aircraftType:  string;
  vintage:       number;
  ageYears:      number;
  ageTier:       VintageAgeTier;
  lgdAdj:        number;      // legacy 3-tier adj (0, 0.04, 0.10) — retained for AssetRiskTab display
  lgdBenchmark:  number;      // decay-curve LGD benchmark for this asset
  isWidebody:    boolean;
  monthlyRental: number;
  weightPct:     number;
}

// ─── Classifiers (kept for backward compatibility and AssetRiskTab display) ──

export function isWidebody(aircraftType: string): boolean {
  const wbPrefixes = ["A330", "A340", "A350", "A380", "B767", "B777", "B787", "767", "777", "787"];
  const upper = aircraftType.toUpperCase();
  return wbPrefixes.some((p) => upper.includes(p.toUpperCase()));
}

export function vintageAgeTier(ageYears: number): VintageAgeTier {
  if (ageYears > 15) return "aged";
  if (ageYears >= 10) return "mid";
  return "young";
}

export function vintageLGDAdj(ageYears: number): number {
  return VINTAGE_LGD_TIERS[vintageAgeTier(ageYears)];
}

// ─── Portfolio computation ────────────────────────────────────────────────────

/**
 * Compute fleet asset risk metrics.
 *
 * Returns:
 *   lgdDecayAdjFactor — rental-weighted (or EAD-weighted if provisions provided) LGD
 *     adjustment vs DEFAULT_BASELINE_LGD, clamped to [0, 0.50].
 *   perAssetLgd — map of asset_id → decay-curve LGD benchmark.
 *   suggestedRemarketingMonths, avgFleetAgeYears, pctMidAged, pctAged, rows — retained for AssetRiskTab.
 *
 * Weighting for lgdDecayAdjFactor:
 *   - provisions provided + at least one non-null EAD: EAD-weighted
 *   - provisions provided but all EAD null: equal-weighted
 *   - no provisions: rental-weighted (fallback)
 */
export function computePortfolioAssetRisk(
  assets: Asset[],
  leases: Lease[],
  recoveryFactor: number,
  referenceYear: number = new Date().getFullYear(),
  provisions?: Provision[],
): {
  lgdDecayAdjFactor:          number;
  perAssetLgd:                Map<string, number>;
  suggestedRemarketingMonths: number;
  avgFleetAgeYears:           number;
  pctMidAged:                 number;
  pctAged:                    number;
  rows:                       AssetRiskRow[];
} {
  const empty = {
    lgdDecayAdjFactor: 0, perAssetLgd: new Map<string, number>(),
    suggestedRemarketingMonths: 0,
    avgFleetAgeYears: 0, pctMidAged: 0, pctAged: 0, rows: [],
  };
  if (assets.length === 0 || leases.length === 0) return empty;

  // Build assetId → first lease with positive rental
  const leaseByAsset = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByAsset.has(lease.asset_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByAsset.set(lease.asset_id, lease);
    }
  }

  // Build raw rows
  const rawRows: AssetRiskRow[] = [];
  let totalRental = 0;

  for (const asset of assets) {
    const lease = leaseByAsset.get(asset.id);
    if (!lease || !lease.monthly_rental) continue;
    if (asset.vintage == null) continue;

    const ageYears   = referenceYear - asset.vintage;
    if (ageYears < 0) continue;
    const tier       = vintageAgeTier(ageYears);
    const lgdAdj     = vintageLGDAdj(ageYears);
    const wb         = isWidebody(asset.aircraft_type);
    const family     = classifyAircraftFamily(asset.aircraft_type);
    const lgdBenchmark = computeLgdBenchmark(family, ageYears, recoveryFactor);
    const rental     = lease.monthly_rental;

    rawRows.push({
      assetId:       asset.id,
      registration:  asset.registration,
      aircraftType:  asset.aircraft_type,
      vintage:       asset.vintage,
      ageYears,
      ageTier:       tier,
      lgdAdj,
      lgdBenchmark,
      isWidebody:    wb,
      monthlyRental: rental,
      weightPct:     0,
    });
    totalRental += rental;
  }

  if (totalRental === 0) return empty;

  // Second pass: rental weights and aggregate sums (remarketing + age)
  let weightedAgeSum      = 0;
  let weightedRemarketSum = 0;
  let midRental           = 0;
  let agedRental          = 0;

  for (const row of rawRows) {
    row.weightPct = row.monthlyRental / totalRental;
    weightedAgeSum      += row.ageYears * row.monthlyRental;
    weightedRemarketSum += (row.isWidebody ? WB_REMARKETING_MONTHS : NB_REMARKETING_MONTHS) * row.monthlyRental;
    if (row.ageTier === "mid")  midRental  += row.monthlyRental;
    if (row.ageTier === "aged") agedRental += row.monthlyRental;
  }

  rawRows.sort((a, b) => b.weightPct - a.weightPct);

  // Build perAssetLgd map
  const perAssetLgd = new Map<string, number>();
  for (const row of rawRows) {
    perAssetLgd.set(row.assetId, row.lgdBenchmark);
  }

  // Compute fleet-weighted LGD (EAD → equal → rental fallback)
  const eadByAsset = new Map<string, number>();
  const hasProvisions = provisions != null && provisions.length > 0;
  if (hasProvisions) {
    for (const p of provisions!) {
      if (p.ead != null && p.ead > 0) {
        eadByAsset.set(p.asset_id, (eadByAsset.get(p.asset_id) ?? 0) + p.ead);
      }
    }
  }

  let weightedLgdSum = 0;
  let totalLgdWeight = 0;
  for (const row of rawRows) {
    let weight: number;
    if (hasProvisions) {
      weight = eadByAsset.get(row.assetId) ?? 1; // equal weight when EAD null
    } else {
      weight = row.monthlyRental; // rental-weighted fallback
    }
    weightedLgdSum += row.lgdBenchmark * weight;
    totalLgdWeight += weight;
  }

  const fleetWeightedLgd = totalLgdWeight > 0 ? weightedLgdSum / totalLgdWeight : DEFAULT_BASELINE_LGD;
  const lgdDecayAdjFactor = Math.min(0.50, Math.max(0, fleetWeightedLgd - DEFAULT_BASELINE_LGD));

  return {
    lgdDecayAdjFactor,
    perAssetLgd,
    suggestedRemarketingMonths: Math.round(weightedRemarketSum / totalRental),
    avgFleetAgeYears:           weightedAgeSum / totalRental,
    pctMidAged:                 midRental  / totalRental,
    pctAged:                    agedRental / totalRental,
    rows:                       rawRows,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/app/utils/assetRisk.test.ts 2>&1 | tail -15
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/assetRisk.ts src/app/utils/assetRisk.test.ts
git commit -m "feat: upgrade computePortfolioAssetRisk to decay-curve LGD (rename vintageAdjFactor → lgdDecayAdjFactor)"
```

---

## Task 5: Rename vintageAdjFactor across ECL engine and callers

**Files:**
- Modify: `src/app/utils/eclCalculator.ts`
- Modify: `src/app/components/scenarios/AssetRiskTab.tsx`
- Modify: `src/app/pages/RiskECL.tsx`
- Modify: `src/app/pages/Scenarios.tsx`

- [ ] **Step 1: Update eclCalculator.ts**

In `ScenarioInputs` (line 46), rename the field and update its JSDoc:

```
Old:
  vintageAdjFactor: number;

New:
  /** 0 = feature inactive. Rental-weighted LGD adjustment fraction from fleet age × decay curves.
   *  Computed by computePortfolioAssetRisk; clamp(fleetWeightedLgd − 0.28, 0, 0.50). */
  lgdDecayAdjFactor: number;
```

In `ZERO_INPUTS` (line 111):
```
Old: vintageAdjFactor: 0,
New: lgdDecayAdjFactor: 0,
```

In `computeECLFromBase` formula (~line 203):
```
Old:
  const vintageAdjDelta = inputs.vintageAdjFactor > 0
    ? inputs.vintageAdjFactor * baseECL
    : 0;

New:
  // LGD decay adjustment (replaces vintageAdjFactor — now driven by calibrated decay curves).
  // Guard: 0 = feature inactive. lgdDecayAdjFactor = clamp(fleetWeightedLgd − 0.28, 0, 0.50).
  const lgdDecayDelta = inputs.lgdDecayAdjFactor > 0
    ? inputs.lgdDecayAdjFactor * baseECL
    : 0;
```

In the delta sum (~line 227), replace `vintageAdjDelta` with `lgdDecayDelta`:
```
Old: ... + remarketingLGDDelta + vintageAdjDelta;
New: ... + remarketingLGDDelta + lgdDecayDelta;
```

- [ ] **Step 2: Update AssetRiskTab.tsx**

Line 62 — update destructuring and add `DEFAULT_RECOVERY_FACTOR` import:

```typescript
// Add to imports at top:
import { DEFAULT_RECOVERY_FACTOR } from "../../data/lgdCurves";

// Line 62 — change:
Old:
  const {
    suggestedRemarketingMonths, vintageAdjFactor,
    avgFleetAgeYears, pctMidAged, pctAged, rows,
  } = computePortfolioAssetRisk(assets, leases);

New:
  const {
    suggestedRemarketingMonths, lgdDecayAdjFactor,
    avgFleetAgeYears, pctMidAged, pctAged, rows,
  } = computePortfolioAssetRisk(assets, leases, DEFAULT_RECOVERY_FACTOR);
```

Line 64 — rename variable:
```
Old: const vintageUpliftM = rows.length > 0 ? vintageAdjFactor * BASE_ECL : 0;
New: const vintageUpliftM = rows.length > 0 ? lgdDecayAdjFactor * BASE_ECL : 0;
```

Line 210 — update the "Use in Custom Builder" callback:
```
Old: onClick={() => onUseInCustomBuilder(suggestedRemarketingMonths, vintageAdjFactor)}
New: onClick={() => onUseInCustomBuilder(suggestedRemarketingMonths, lgdDecayAdjFactor)}
```

- [ ] **Step 3: Update RiskECL.tsx**

Lines 94 and 113 — rename the field in both `DEFAULT_ADVERSE_INPUTS` and `DEFAULT_UPSIDE_INPUTS`:
```
Old: remarketingMonths: 0, vintageAdjFactor: 0,
New: remarketingMonths: 0, lgdDecayAdjFactor: 0,
```

- [ ] **Step 4: Update Scenarios.tsx — all vintageAdjFactor occurrences**

There are many occurrences. Apply all changes:

**Scenario presets (lines ~261, 276, 291, 306, 321, 336, 368, 399, 430, 462, 491, 520, 549, 578, 607):**
Each has `vintageAdjFactor: 0` — rename to `lgdDecayAdjFactor: 0`.

**DSL serialization (~line 719):**
```
Old:
  ...(inputs.remarketingMonths > 0 || inputs.vintageAdjFactor > 0
    ? { remarketing_months: inputs.remarketingMonths, vintage_adj_factor: inputs.vintageAdjFactor }
    : {}),

New:
  ...(inputs.remarketingMonths > 0 || inputs.lgdDecayAdjFactor > 0
    ? { remarketing_months: inputs.remarketingMonths, lgd_decay_adj_factor: inputs.lgdDecayAdjFactor }
    : {}),
```

**DSL deserialization (~line 809):**
```
Old:
  vintageAdjFactor: typeof s.vintage_adj_factor === "number"
    ? Math.min(0.5, Math.max(0, s.vintage_adj_factor))
    : 0,

New:
  lgdDecayAdjFactor: typeof s.lgd_decay_adj_factor === "number"
    ? Math.min(0.5, Math.max(0, s.lgd_decay_adj_factor))
    : 0,
```

**computePortfolioAssetRisk call (~line 1129):**
```
Old: () => computePortfolioAssetRisk(assets, leases),
New: () => computePortfolioAssetRisk(assets, leases, portfolioRecoveryFactor),
```

This requires `portfolioRecoveryFactor` to be in scope. Add it as a constant `DEFAULT_RECOVERY_FACTOR` for now (the full hook wiring happens in Task 9); add the import:
```typescript
import { DEFAULT_RECOVERY_FACTOR } from "../data/lgdCurves";
```
And use it at the call site:
```
New: () => computePortfolioAssetRisk(assets, leases, DEFAULT_RECOVERY_FACTOR),
```

**AssetRisk open guard (~lines 1166 and 1236):**
```
Old: if (next.remarketingMonths !== 0 || next.vintageAdjFactor !== 0) setAssetRiskOpen(true);
New: if (next.remarketingMonths !== 0 || next.lgdDecayAdjFactor !== 0) setAssetRiskOpen(true);
```
(There are two occurrences — update both.)

**onUseInCustomBuilder handler in Scenarios.tsx:**
The `AssetRiskTab` calls `onUseInCustomBuilder(remarketingMonths, vintageAdjFactor)`. Find the handler that consumes this (it assigns to scenario inputs) and update the field name:
```
Old: setInputs((prev) => ({ ...prev, remarketingMonths: ..., vintageAdjFactor: adj }))
New: setInputs((prev) => ({ ...prev, remarketingMonths: ..., lgdDecayAdjFactor: adj }))
```

- [ ] **Step 5: Verify TypeScript compiles with zero errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run 2>&1 | tail -5
```
Expected: All existing tests PASS (351 + new tests).

- [ ] **Step 7: Commit**

```bash
git add src/app/utils/eclCalculator.ts src/app/components/scenarios/AssetRiskTab.tsx src/app/pages/RiskECL.tsx src/app/pages/Scenarios.tsx
git commit -m "feat: rename vintageAdjFactor → lgdDecayAdjFactor across ECL engine and callers"
```

---

## Task 6: LgdBenchmarkPanel component

**Files:**
- Create: `src/app/components/portfolio/LgdBenchmarkPanel.tsx`

- [ ] **Step 1: Implement LgdBenchmarkPanel.tsx**

```typescript
// src/app/components/portfolio/LgdBenchmarkPanel.tsx
import {
  computeResidualValuePct,
  computeLgdBenchmark,
  AIRCRAFT_FAMILY_LABELS,
  DEFAULT_RECOVERY_FACTOR,
  DEFAULT_RESIDUAL_CURVES,
} from "../../data/lgdCurves";
import { classifyAircraftFamily } from "../../data/aircraftFamilyMap";

interface Props {
  assetId:             string;
  aircraftType:        string;
  vintage:             number | null;
  manualLgd:           number | null; // Provision.lgd for this asset
  recoveryFactor:      number;
  isOverridden:        boolean;
  onOpenRecoveryDrawer: () => void;
}

function deviationBadge(benchmarkLgd: number, manualLgd: number | null) {
  if (manualLgd == null) return null;
  const ratio = manualLgd / benchmarkLgd;
  let bg = "#DCFCE7", color = "#15803D", label = "";
  if (ratio > 1.50 || ratio < 0.50) { bg = "#FEE2E2"; color = "#B91C1C"; }
  else if (ratio > 1.25 || ratio < 0.75) { bg = "#FEF3C7"; color = "#B45309"; }
  const pctDiff = ((manualLgd - benchmarkLgd) / benchmarkLgd * 100).toFixed(1);
  label = (manualLgd >= benchmarkLgd ? "+" : "") + pctDiff + "% vs benchmark";
  return (
    <span style={{
      background: bg, color, fontWeight: 600, fontSize: "0.75rem",
      padding: "0.15rem 0.5rem", borderRadius: "9999px",
    }}>
      {label}
    </span>
  );
}

export function LgdBenchmarkPanel({
  aircraftType, vintage, manualLgd,
  recoveryFactor, isOverridden, onOpenRecoveryDrawer,
}: Props) {
  const currentYear = new Date().getFullYear();
  const ageYears    = vintage != null ? currentYear - vintage : null;
  const family      = classifyAircraftFamily(aircraftType);
  const familyLabel = AIRCRAFT_FAMILY_LABELS[family];
  const residualPct = ageYears != null ? computeResidualValuePct(family, ageYears) : null;
  const lgdBenchmark = ageYears != null ? computeLgdBenchmark(family, ageYears, recoveryFactor) : null;
  const source = DEFAULT_RESIDUAL_CURVES[family].source;

  const row = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid #F1F5F9" }}>
      <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ padding: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
          LGD Benchmark · {familyLabel}
        </span>
        {isOverridden && (
          <span style={{ background: "#EDE9FE", color: "#5B21B6", fontWeight: 600, fontSize: "0.75rem", padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>
            Custom RF
          </span>
        )}
      </div>

      {/* Value rows */}
      {row("Aircraft family",  familyLabel)}
      {row("Aircraft age",     ageYears != null ? `${ageYears} yr (vintage ${vintage})` : "—")}
      {row("Residual value %", residualPct != null ? `${(residualPct * 100).toFixed(1)}%` : "—")}

      {/* LGD benchmark + deviation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid #F1F5F9" }}>
        <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>LGD benchmark</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>
            {lgdBenchmark != null ? `${(lgdBenchmark * 100).toFixed(1)}%` : "—"}
          </span>
          {lgdBenchmark != null && deviationBadge(lgdBenchmark, manualLgd)}
        </div>
      </div>

      {row("Recovery factor", `${(recoveryFactor * 100).toFixed(1)}% ${isOverridden ? "(custom)" : "(default)"}`)}

      {/* Source footer */}
      <p style={{ fontSize: "0.7rem", color: "#94A3B8", marginTop: "0.75rem", lineHeight: 1.4 }}>
        Source: {source}
      </p>

      {/* Drawer link */}
      <button
        onClick={onOpenRecoveryDrawer}
        style={{ marginTop: "0.5rem", background: "none", border: "none", color: "#002147", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", padding: 0 }}
      >
        Adjust recovery factor →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep LgdBenchmarkPanel | head -5
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/portfolio/LgdBenchmarkPanel.tsx
git commit -m "feat: add LgdBenchmarkPanel per-asset LGD component"
```

---

## Task 7: LgdDecaySummaryCard + RecoveryFactorDrawer

**Files:**
- Create: `src/app/components/risk-ecl/LgdDecaySummaryCard.tsx`
- Create: `src/app/components/risk-ecl/RecoveryFactorDrawer.tsx`

- [ ] **Step 1: Create src/app/components/risk-ecl/ directory (if missing)**

```bash
mkdir -p /Users/tanamsethi/Downloads/Aeroinsights/src/app/components/risk-ecl
```

- [ ] **Step 2: Implement LgdDecaySummaryCard.tsx**

```typescript
// src/app/components/risk-ecl/LgdDecaySummaryCard.tsx
import { Card } from "../ui/Card";
import {
  computeFleetLgdAdjustment,
  computeResidualValuePct,
  computeLgdBenchmark,
  AIRCRAFT_FAMILY_LABELS,
  DEFAULT_BASELINE_LGD,
} from "../../data/lgdCurves";
import { classifyAircraftFamily } from "../../data/aircraftFamilyMap";
import type { Asset, Provision } from "../../types/portfolio";

interface Props {
  assets:               Asset[];
  provisions:           Provision[];
  recoveryFactor:       number;
  isOverridden:         boolean;
  lgdDecayAdjFactor:    number;
  onOpenRecoveryDrawer: () => void;
}

export function LgdDecaySummaryCard({
  assets, provisions, recoveryFactor, isOverridden, lgdDecayAdjFactor, onOpenRecoveryDrawer,
}: Props) {
  const currentYear = new Date().getFullYear();

  // Build per-asset rows sorted by LGD descending
  const rows = assets
    .filter((a) => a.vintage != null)
    .map((a) => {
      const age    = currentYear - a.vintage!;
      const family = classifyAircraftFamily(a.aircraft_type);
      const resid  = computeResidualValuePct(family, age);
      const lgd    = computeLgdBenchmark(family, age, recoveryFactor);
      return { registration: a.registration, aircraftType: a.aircraft_type, family, age, resid, lgd };
    })
    .sort((a, b) => b.lgd - a.lgd);

  // EAD-weighted fleet avg LGD (mirrors what ECL engine sees)
  const { lgdDecayAdjFactor: computedAdj } = computeFleetLgdAdjustment(
    assets, provisions, recoveryFactor, currentYear
  );
  const fleetAvgLgd = computedAdj + DEFAULT_BASELINE_LGD;
  const upliftPp    = (lgdDecayAdjFactor * 100).toFixed(1);

  const th = (label: string, align: "left" | "right" = "right") => (
    <th key={label} style={{
      padding: "0.5rem 0.75rem", textAlign: align, fontWeight: 600,
      color: "#64748B", fontSize: "0.75rem", textTransform: "uppercase",
      letterSpacing: "0.04em", whiteSpace: "nowrap",
    }}>
      {label}
    </th>
  );

  return (
    <Card>
      <div style={{ padding: "1.25rem" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
              Fleet LGD · Decay Curve Benchmarks
            </span>
            {isOverridden && (
              <span style={{ background: "#EDE9FE", color: "#5B21B6", fontWeight: 600, fontSize: "0.75rem", padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>
                Custom RF
              </span>
            )}
          </div>
          <button
            onClick={onOpenRecoveryDrawer}
            style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.3rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500, color: "#475569", cursor: "pointer" }}
          >
            Adjust recovery factor →
          </button>
        </div>

        {rows.length === 0 ? (
          <div style={{ color: "#94A3B8", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
            No asset data with known vintage available.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {th("Registration", "left")}
                  {th("Type", "left")}
                  {th("Family")}
                  {th("Age")}
                  {th("Residual Value %")}
                  {th("LGD Benchmark")}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.registration} style={{
                    borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none",
                    background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                  }}>
                    <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>{row.registration}</td>
                    <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{row.aircraftType}</td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569" }}>{AIRCRAFT_FAMILY_LABELS[row.family]}</td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{row.age} yr</td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{(row.resid * 100).toFixed(1)}%</td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: row.lgd > 0.6 ? "#B91C1C" : row.lgd > 0.45 ? "#B45309" : "#15803D", fontVariantNumeric: "tabular-nums" }}>
                      {(row.lgd * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                  <td colSpan={4} style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#475569", fontSize: "0.75rem" }}>
                    FLEET WEIGHTED AVG
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem" }} />
                  <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                    {(fleetAvgLgd * 100).toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Summary chips */}
        {rows.length > 0 && (
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
            <div style={{ background: lgdDecayAdjFactor > 0.1 ? "#FEE2E2" : "#DCFCE7", borderRadius: "9999px", padding: "0.3rem 0.75rem", fontSize: "0.8125rem", fontWeight: 600, color: lgdDecayAdjFactor > 0.1 ? "#B91C1C" : "#15803D" }}>
              ↑ {upliftPp} pp vs. new-fleet baseline
            </div>
            <div style={{ background: "#EFF6FF", borderRadius: "9999px", padding: "0.3rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500, color: "#1D4ED8" }}>
              Applied to scenario ✓
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Implement RecoveryFactorDrawer.tsx**

```typescript
// src/app/components/risk-ecl/RecoveryFactorDrawer.tsx
import { useState, useEffect } from "react";
import {
  computeLgdBenchmark,
  DEFAULT_RECOVERY_FACTOR,
} from "../../data/lgdCurves";
import { classifyAircraftFamily } from "../../data/aircraftFamilyMap";

interface Props {
  isOpen:               boolean;
  currentRecoveryFactor: number;
  isOverridden:         boolean;
  /** Optional: preview impact on a representative asset */
  previewAircraftType?: string;
  previewAgeYears?:     number;
  onSave:               (factor: number, notes?: string) => Promise<void>;
  onReset:              () => Promise<void>;
  onClose:              () => void;
}

export function RecoveryFactorDrawer({
  isOpen, currentRecoveryFactor, isOverridden,
  previewAircraftType, previewAgeYears,
  onSave, onReset, onClose,
}: Props) {
  const [inputPct, setInputPct]     = useState("");
  const [notes, setNotes]           = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputPct((currentRecoveryFactor * 100).toFixed(1));
      setNotes("");
      setError(null);
      setSaving(false);
      setConfirmReset(false);
    }
  }, [isOpen, currentRecoveryFactor]);

  if (!isOpen) return null;

  const parsedFactor = parseFloat(inputPct) / 100;
  const isValid = !isNaN(parsedFactor) && parsedFactor > 0.10 && parsedFactor < 0.95;

  // Impact preview
  let previewFrom: string | null = null;
  let previewTo:   string | null = null;
  if (isValid && previewAircraftType != null && previewAgeYears != null) {
    const family = classifyAircraftFamily(previewAircraftType);
    previewFrom = `${(computeLgdBenchmark(family, previewAgeYears, currentRecoveryFactor) * 100).toFixed(1)}%`;
    previewTo   = `${(computeLgdBenchmark(family, previewAgeYears, parsedFactor) * 100).toFixed(1)}%`;
  }

  async function handleSave() {
    if (!isValid) { setError("Recovery factor must be between 10% and 95%."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(parsedFactor, notes || undefined);
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setError(null);
    try {
      await onReset();
      onClose();
    } catch {
      setError("Failed to reset. Please try again.");
    } finally {
      setSaving(false);
      setConfirmReset(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 49 }}
      />
      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 380,
        background: "#FFFFFF", zIndex: 50, boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid #E2E8F0" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0F172A" }}>Adjust Recovery Factor</div>
            <div style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: "0.125rem" }}>Firm-level LGD assumption</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.25rem", color: "#64748B", cursor: "pointer" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.375rem" }}>
            Recovery factor (%)
          </label>
          <input
            type="number"
            min={10.1}
            max={94.9}
            step={0.1}
            value={inputPct}
            onChange={(e) => { setInputPct(e.target.value); setError(null); }}
            style={{
              width: "100%", padding: "0.625rem 0.75rem", border: "1px solid #CBD5E1",
              borderRadius: "0.5rem", fontSize: "0.875rem", color: "#0F172A",
              boxSizing: "border-box",
            }}
          />
          <p style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.375rem" }}>
            Default: {(DEFAULT_RECOVERY_FACTOR * 100).toFixed(1)}% (AVAC through-the-cycle, 2023). Valid range: 10.1% – 94.9%.
          </p>

          {/* Impact preview */}
          {previewFrom && previewTo && (
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: "0.25rem" }}>
                IMPACT PREVIEW · {previewAircraftType} ({previewAgeYears} yr)
              </div>
              <div style={{ fontSize: "0.875rem", color: "#0F172A" }}>
                LGD benchmark: <b>{previewFrom}</b> → <b>{previewTo}</b>
              </div>
            </div>
          )}

          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.375rem", marginTop: "1.25rem" }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for override..."
            rows={3}
            style={{
              width: "100%", padding: "0.625rem 0.75rem", border: "1px solid #CBD5E1",
              borderRadius: "0.5rem", fontSize: "0.875rem", color: "#0F172A",
              resize: "vertical", boxSizing: "border-box",
            }}
          />

          {error && (
            <p style={{ color: "#B91C1C", fontSize: "0.8125rem", marginTop: "0.5rem" }}>{error}</p>
          )}

          {/* Reset section */}
          {isOverridden && (
            <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #F1F5F9" }}>
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  style={{ background: "none", border: "1px solid #FCA5A5", borderRadius: "9999px", padding: "0.375rem 0.875rem", fontSize: "0.8125rem", color: "#B91C1C", cursor: "pointer" }}
                >
                  Reset to default
                </button>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>Remove firm override?</span>
                  <button onClick={handleReset} disabled={saving} style={{ background: "#B91C1C", border: "none", borderRadius: "9999px", padding: "0.3rem 0.75rem", fontSize: "0.8125rem", color: "#FFFFFF", cursor: "pointer" }}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirmReset(false)} style={{ background: "none", border: "none", fontSize: "0.8125rem", color: "#64748B", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.5rem 1.25rem", fontSize: "0.875rem", color: "#475569", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            style={{ background: "#002147", border: "none", borderRadius: "9999px", padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, color: "#FFFFFF", cursor: isValid && !saving ? "pointer" : "not-allowed", opacity: isValid && !saving ? 1 : 0.5 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "LgdDecay|RecoveryFactor" | head -10
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/risk-ecl/LgdDecaySummaryCard.tsx src/app/components/risk-ecl/RecoveryFactorDrawer.tsx
git commit -m "feat: add LgdDecaySummaryCard and RecoveryFactorDrawer components"
```

---

## Task 8: Wire Portfolio.tsx — new LGD sub-tab

**Files:**
- Modify: `src/app/pages/Portfolio.tsx`

The aircraft accordion at line 560 currently renders two sub-tabs: `"Valuation"` and `"Maintenance Forecast"`. Add `"LGD"` as a third.

- [ ] **Step 1: Add imports to Portfolio.tsx**

```typescript
// Add near other component imports:
import { LgdBenchmarkPanel } from "../components/portfolio/LgdBenchmarkPanel";
import { RecoveryFactorDrawer } from "../components/risk-ecl/RecoveryFactorDrawer";
import { useLgdCurves } from "../hooks/useLgdCurves";
import { computePortfolioAssetRisk } from "../utils/assetRisk";
```

- [ ] **Step 2: Update state type for aircraftSubTab**

```
Old:  const [aircraftSubTab, setAircraftSubTab] = useState<Record<string, "Valuation" | "Maintenance">>({});
New:  const [aircraftSubTab, setAircraftSubTab] = useState<Record<string, "Valuation" | "Maintenance" | "LGD">>({});
```

- [ ] **Step 3: Mount useLgdCurves and compute perAssetLgd**

After the existing `const [showAddAircraft, setShowAddAircraft] = useState(false);` line, add:

```typescript
  const { recoveryFactor, isOverridden, saveRecoveryOverride, resetToDefault: resetRecovery } = useLgdCurves();
  const [recoveryDrawerOpen, setRecoveryDrawerOpen] = useState(false);

  const { perAssetLgd } = React.useMemo(
    () => computePortfolioAssetRisk(assets, leases, recoveryFactor),
    [assets, leases, recoveryFactor]
  );
```

Note: `assets` and `leases` come from `usePortfolioData()` which is already called at the top of `Portfolio`. Verify the variable names match the existing destructuring.

- [ ] **Step 4: Add LGD sub-tab button in the aircraft accordion**

Find the sub-tab switcher section (~line 560):
```tsx
{(["Valuation", "Maintenance Forecast"] as const).map((st) => {
  const key = st === "Maintenance Forecast" ? "Maintenance" : "Valuation";
```

Replace with:
```tsx
{(["Valuation", "Maintenance Forecast", "LGD Benchmark"] as const).map((st) => {
  const key = st === "Maintenance Forecast" ? "Maintenance" : st === "LGD Benchmark" ? "LGD" : "Valuation";
  const active = (aircraftSubTab[a.msn] ?? "Valuation") === key;
  return (
    <button
      key={st}
      onClick={(e) => { e.stopPropagation(); setAircraftSubTab((prev) => ({ ...prev, [a.msn]: key as "Valuation" | "Maintenance" | "LGD" })); }}
      style={{
        padding: "4px 14px", fontSize: "0.8125rem", fontWeight: active ? 600 : 500,
        cursor: "pointer", border: "none", borderRadius: "9999px",
        background: active ? "#002147" : "transparent",
        color: active ? "#FFFFFF" : "#64748B",
        transition: "all 150ms cubic-bezier(0.23,1,0.32,1)",
        boxShadow: active ? "0 1px 3px rgba(0,33,71,0.18)" : "none",
      }}
    >
      {st}
    </button>
  );
})}
```

- [ ] **Step 5: Add LGD panel rendering**

Find the panel section (~line 582):
```tsx
{(aircraftSubTab[a.msn] ?? "Valuation") === "Valuation" ? (
  <AircraftValuationPanel ... />
) : (
  <MaintenanceForecastTab ... />
)}
```

Replace with:
```tsx
{(aircraftSubTab[a.msn] ?? "Valuation") === "Valuation" ? (
  <AircraftValuationPanel
    msn={a.msn}
    overrides={aircraftOverrides}
    onOverride={handleOverride}
    onRevertOverride={handleRevertOverride}
  />
) : (aircraftSubTab[a.msn] ?? "Valuation") === "Maintenance" ? (
  <MaintenanceForecastTab
    msn={a.msn}
    aircraftType={a.type}
    vintage={a.vintage}
    liveRecord={liveSDMRByMsn.get(a.msn)}
  />
) : (
  <LgdBenchmarkPanel
    assetId={a.msn}
    aircraftType={a.type}
    vintage={a.vintage != null ? parseInt(String(a.vintage)) : null}
    manualLgd={null}
    recoveryFactor={recoveryFactor}
    isOverridden={isOverridden}
    onOpenRecoveryDrawer={() => setRecoveryDrawerOpen(true)}
  />
)}
```

- [ ] **Step 6: Add RecoveryFactorDrawer at JSX root**

Before the final closing `</>` or `</div>` of the Portfolio component return, add:

```tsx
<RecoveryFactorDrawer
  isOpen={recoveryDrawerOpen}
  currentRecoveryFactor={recoveryFactor}
  isOverridden={isOverridden}
  onSave={saveRecoveryOverride}
  onReset={resetRecovery}
  onClose={() => setRecoveryDrawerOpen(false)}
/>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep Portfolio | head -10
```
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/Portfolio.tsx
git commit -m "feat: add LGD Benchmark sub-tab to Portfolio aircraft accordion"
```

---

## Task 9: Wire RiskECL.tsx — LgdDecaySummaryCard + lgdDecayAdjFactor pre-population

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { LgdDecaySummaryCard } from "../components/risk-ecl/LgdDecaySummaryCard";
import { RecoveryFactorDrawer } from "../components/risk-ecl/RecoveryFactorDrawer";
import { useLgdCurves } from "../hooks/useLgdCurves";
import { computePortfolioAssetRisk } from "../utils/assetRisk";
```

- [ ] **Step 2: Mount useLgdCurves and add drawer state**

In the component body, after existing hooks:

```typescript
const { recoveryFactor, isOverridden, saveRecoveryOverride, resetToDefault: resetRecovery } = useLgdCurves();
const [recoveryDrawerOpen, setRecoveryDrawerOpen] = useState(false);
```

- [ ] **Step 3: Compute lgdDecayAdjFactor from portfolio data**

Find where `usePortfolioData()` is called and where `assets`, `leases`, `provisions` are destructured. Then add (after those destructures):

```typescript
const portfolioLgdRisk = React.useMemo(
  () => computePortfolioAssetRisk(assets, leases, recoveryFactor, undefined, provisions),
  [assets, leases, recoveryFactor, provisions]
);
```

- [ ] **Step 4: Update DEFAULT_ADVERSE_INPUTS and DEFAULT_UPSIDE_INPUTS**

These are constants defined at module level (lines 94, 113) and were already updated in Task 5 to use `lgdDecayAdjFactor: 0`. No further change needed here.

- [ ] **Step 5: Pre-populate lgdDecayAdjFactor in the active scenario inputs when portfolio data loads**

Find the `useEffect` or initialization logic where scenario inputs are seeded from portfolio data (similar pattern to how `remarketingMonths` is pre-populated). If no such effect exists, add one:

```typescript
// Pre-populate lgdDecayAdjFactor from portfolio when it first loads
useEffect(() => {
  if (portfolioLgdRisk.lgdDecayAdjFactor > 0) {
    setAdverseInputs((prev) => ({ ...prev, lgdDecayAdjFactor: portfolioLgdRisk.lgdDecayAdjFactor }));
  }
}, [portfolioLgdRisk.lgdDecayAdjFactor]);
```

Note: Only update if the computed value is positive (inactive when fleet data unavailable). Inspect the existing pattern in `RiskECL.tsx` for how `remarketingMonths` is pre-seeded and follow the same approach.

- [ ] **Step 6: Insert LgdDecaySummaryCard above the Scenario Editor**

Find the JSX where the Scenario Editor section begins (look for a `<Card>` or section heading "Scenario"). Insert before it:

```tsx
{assets.length > 0 && (
  <LgdDecaySummaryCard
    assets={assets}
    provisions={provisions}
    recoveryFactor={recoveryFactor}
    isOverridden={isOverridden}
    lgdDecayAdjFactor={portfolioLgdRisk.lgdDecayAdjFactor}
    onOpenRecoveryDrawer={() => setRecoveryDrawerOpen(true)}
  />
)}
```

- [ ] **Step 7: Add RecoveryFactorDrawer at JSX root**

Before the final closing tag of the RiskECL component return:

```tsx
<RecoveryFactorDrawer
  isOpen={recoveryDrawerOpen}
  currentRecoveryFactor={recoveryFactor}
  isOverridden={isOverridden}
  onSave={saveRecoveryOverride}
  onReset={resetRecovery}
  onClose={() => setRecoveryDrawerOpen(false)}
/>
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep RiskECL | head -10
```
Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/RiskECL.tsx
git commit -m "feat: wire LgdDecaySummaryCard and RecoveryFactorDrawer into RiskECL page"
```

---

## Task 10: Build verification and deploy

**Files:** No new files.

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```
Expected: All tests PASS. New count should exceed 351 (original).

- [ ] **Step 2: TypeScript clean build**

```bash
npx tsc --noEmit 2>&1
```
Expected: Zero errors.

- [ ] **Step 3: Production build**

```bash
npm run build 2>&1 | tail -20
```
Expected: Build completes with no errors.

- [ ] **Step 4: Deploy**

```bash
npx vercel --prod 2>&1 | tail -5
```
Expected: Deployment URL printed, no errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: LGD with aircraft value decay curves — full feature complete"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task(s) |
|---|---|
| AircraftFamily type + DEFAULT_RESIDUAL_CURVES (NB/WB/Regional) | Task 1 |
| computeResidualValuePct (linear interpolation, clamping) | Task 1 |
| computeLgdBenchmark (formula, 5% floor) | Task 1 |
| computeFleetLgdAdjustment (EAD/equal-weighted) | Task 1 |
| classifyAircraftFamily (case-insensitive, unknown→NB) | Task 2 |
| lgd_recovery_overrides Supabase table | Task 3 |
| useLgdCurves hook (load/save/reset, stale guard) | Task 3 |
| computePortfolioAssetRisk new signature + lgdDecayAdjFactor | Task 4 |
| perAssetLgd map in computePortfolioAssetRisk | Task 4 |
| vintageAdjFactor → lgdDecayAdjFactor rename everywhere | Task 5 |
| DSL serialization uses lgd_decay_adj_factor key | Task 5 |
| LgdBenchmarkPanel (family, age, residual %, LGD, deviation badge) | Task 6 |
| LgdDecaySummaryCard (fleet table, summary chip, "applied" badge) | Task 7 |
| RecoveryFactorDrawer (validation 10–95%, impact preview, reset) | Task 7 |
| Portfolio LGD sub-tab + RecoveryFactorDrawer | Task 8 |
| RiskECL LgdDecaySummaryCard + lgdDecayAdjFactor pre-population | Task 9 |
| All 20 test cases from spec | Tasks 1, 2, 4 |

### Type consistency check

- `AssetRiskRow.assetId: string` — added in Task 4, used by `perAssetLgd.set(row.assetId, lgd)` ✓
- `LgdCurvesState.recoveryFactor` — returned by `useLgdCurves`, consumed by `computePortfolioAssetRisk` 3rd arg ✓
- `computeFleetLgdAdjustment` imports `classifyAircraftFamily` from `./aircraftFamilyMap` — Task 2 must precede Task 1 tests passing ✓
- `ScenarioInputs.lgdDecayAdjFactor` renamed in Task 5; all preset objects updated same task ✓
