# Sprint 22 — Asset Risk Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add remarketingMonths and vintageAdjFactor to the ECL model, backed by a new Asset Risk analysis tab that computes both values from the actual fleet data (aircraft type for NB/WB remarketing benchmarks, vintage year for LGD haircuts).

**Architecture:** Follow the exact pattern of Sprint 19 (jurisdictionRisk.ts / JurisdictionRiskTab.tsx). A pure utility `assetRisk.ts` computes all metrics from raw Asset + Lease data. `AssetRiskTab.tsx` is a display-only component. Two new ScenarioInputs fields wire through the ECL formula, the Custom Builder, and the DSL.

**Tech Stack:** TypeScript, React (inline styles, no Tailwind — match existing code), Vitest for tests, Vite for build.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/utils/assetRisk.ts` | **Create** | Pure functions: `isWidebody`, `vintageAgeTier`, `vintageLGDAdj`, `computePortfolioAssetRisk` |
| `src/app/utils/assetRisk.test.ts` | **Create** | Unit tests for all pure functions above |
| `src/app/components/scenarios/AssetRiskTab.tsx` | **Create** | KPI cards + per-asset table + "Use in Custom Builder" CTA |
| `src/app/utils/eclCalculator.ts` | **Modify** | Add `remarketingMonths` + `vintageAdjFactor` to `ScenarioInputs`, `ZERO_INPUTS`, `computeECLFromBase` |
| `src/app/utils/eclCalculator.test.ts` | **Modify** | Add tests for the two new formula terms |
| `src/app/pages/Scenarios.tsx` | **Modify** | Template objects, DSL, `assetRiskOpen` state, useMemo, tab list, Custom Builder section, tab render, `onUseInCustomBuilder` handler |

---

## Task 1: `assetRisk.ts` — Pure Utility (TDD)

**Files:**
- Create: `src/app/utils/assetRisk.ts`
- Create: `src/app/utils/assetRisk.test.ts`

### Domain knowledge for the implementer

- **Remarketing** = time from physical repossession to first day of the next lease. Distinct from `repossWeightedMonths` (time to repossess). Driven by aircraft type liquidity.
  - Narrowbody benchmark: **4 months** (A320/737 family — deep, global demand).
  - Widebody benchmark: **9 months** (A330/A350/B777 — shallower pool, longer negotiation).
  - `REMARKETING_BENCHMARK_MONTHS = 3`: what the base LGD (45%) already bakes in. Each month beyond this = ~1.5% of base ECL.
- **Vintage LGD tiers**: aircraft age in years from manufacture year to reference year.
  - < 10 yr → "young", LGD adj = 0 (liquid, easily re-leased).
  - 10–15 yr → "mid", LGD adj = +4% of base ECL (narrowing buyer pool, mid-life heavy check costs).
  - > 15 yr → "aged", LGD adj = +10% of base ECL (near end-of-economic-life, part-out risk).
- **Join logic**: `lease.asset_id === asset.id`. Use only the first lease with `monthly_rental > 0` per asset. Exclude assets with no matching lease, null/zero rental, or null vintage. Weight all metrics by monthly rental.

- [ ] **Step 1.1: Write the failing tests**

Create `src/app/utils/assetRisk.test.ts` with this exact content:

```typescript
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
import type { Asset, Lease } from "../types/portfolio";

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

const REF_YEAR = 2026; // pin to avoid flaky time-based tests

// ─── isWidebody ───────────────────────────────────────────────────────────────

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

// ─── vintageAgeTier ───────────────────────────────────────────────────────────

describe("vintageAgeTier", () => {
  it("age 9 → young",  () => expect(vintageAgeTier(9)).toBe("young"));
  it("age 10 → mid",   () => expect(vintageAgeTier(10)).toBe("mid"));
  it("age 15 → mid",   () => expect(vintageAgeTier(15)).toBe("mid"));
  it("age 16 → aged",  () => expect(vintageAgeTier(16)).toBe("aged"));
  it("age 20 → aged",  () => expect(vintageAgeTier(20)).toBe("aged"));
  it("age 0 → young",  () => expect(vintageAgeTier(0)).toBe("young"));
});

// ─── vintageLGDAdj ────────────────────────────────────────────────────────────

describe("vintageLGDAdj", () => {
  it("age 9 → 0",     () => expect(vintageLGDAdj(9)).toBe(0));
  it("age 10 → 0.04", () => expect(vintageLGDAdj(10)).toBe(0.04));
  it("age 15 → 0.04", () => expect(vintageLGDAdj(15)).toBe(0.04));
  it("age 16 → 0.10", () => expect(vintageLGDAdj(16)).toBe(0.10));
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("NB_REMARKETING_MONTHS = 4", () => expect(NB_REMARKETING_MONTHS).toBe(4));
  it("WB_REMARKETING_MONTHS = 9", () => expect(WB_REMARKETING_MONTHS).toBe(9));
  it("REMARKETING_BENCHMARK_MONTHS = 3", () => expect(REMARKETING_BENCHMARK_MONTHS).toBe(3));
});

// ─── computePortfolioAssetRisk ────────────────────────────────────────────────

describe("computePortfolioAssetRisk", () => {
  it("empty inputs → all zeros, empty rows", () => {
    const result = computePortfolioAssetRisk([], [], REF_YEAR);
    expect(result.rows).toHaveLength(0);
    expect(result.suggestedRemarketingMonths).toBe(0);
    expect(result.vintageAdjFactor).toBe(0);
    expect(result.avgFleetAgeYears).toBe(0);
    expect(result.pctMidAged).toBe(0);
    expect(result.pctAged).toBe(0);
  });

  it("single NB young asset → suggestedRemarketing = NB benchmark, vintageAdj = 0", () => {
    // A320neo, vintage 2020, age = 6yr in 2026 → young
    const assets = [makeAsset("a1", "A320neo", 2020)];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.suggestedRemarketingMonths).toBe(NB_REMARKETING_MONTHS); // 4
    expect(result.vintageAdjFactor).toBe(0);
    expect(result.avgFleetAgeYears).toBeCloseTo(6, 5);
    expect(result.pctMidAged).toBe(0);
    expect(result.pctAged).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].ageTier).toBe("young");
    expect(result.rows[0].isWidebody).toBe(false);
  });

  it("single WB mid-aged asset → suggestedRemarketing = WB benchmark, vintageAdj = 0.04", () => {
    // A330-300, vintage 2015, age = 11yr in 2026 → mid
    const assets = [makeAsset("a1", "A330-300", 2015)];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.suggestedRemarketingMonths).toBe(WB_REMARKETING_MONTHS); // 9
    expect(result.vintageAdjFactor).toBeCloseTo(0.04, 5);
    expect(result.pctMidAged).toBeCloseTo(1.0, 5);
    expect(result.pctAged).toBe(0);
    expect(result.rows[0].ageTier).toBe("mid");
    expect(result.rows[0].isWidebody).toBe(true);
  });

  it("single aged asset → vintageAdj = 0.10", () => {
    // B777-300ER, vintage 2008, age = 18yr in 2026 → aged
    const assets = [makeAsset("a1", "B777-300ER", 2008)];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.vintageAdjFactor).toBeCloseTo(0.10, 5);
    expect(result.pctAged).toBeCloseTo(1.0, 5);
    expect(result.rows[0].ageTier).toBe("aged");
  });

  it("vintageAdjFactor is rental-weighted (not count-weighted)", () => {
    // NB $400k (young, adj=0) + WB $100k (mid, adj=0.04)
    // weighted = (400k*0 + 100k*0.04) / 500k = 4000/500000 = 0.008
    const assets = [
      makeAsset("a1", "A320neo",  2020), // age 6 → young, adj=0
      makeAsset("a2", "A330-300", 2015), // age 11 → mid, adj=0.04
    ];
    const leases = [makeLease("a1", 400_000), makeLease("a2", 100_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.vintageAdjFactor).toBeCloseTo(0.008, 5);
  });

  it("suggestedRemarketingMonths is rental-weighted by NB/WB", () => {
    // NB $750k (4mo) + WB $250k (9mo) → (750k*4 + 250k*9)/1000k = (3000+2250)/1000 = 5.25 → round to 5
    const assets = [
      makeAsset("a1", "A320neo",    2020),
      makeAsset("a2", "B777-300ER", 2020),
    ];
    const leases = [makeLease("a1", 750_000), makeLease("a2", 250_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.suggestedRemarketingMonths).toBe(5); // Math.round(5.25) = 5
  });

  it("asset with no matching lease is excluded", () => {
    const assets = [makeAsset("a1", "A320neo", 2020), makeAsset("a2", "A330-300", 2018)];
    const leases = [makeLease("a1", 500_000)]; // a2 has no lease
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].registration).toBe("a1");
  });

  it("asset with null monthly_rental is excluded", () => {
    const assets = [makeAsset("a1", "A320neo", 2020)];
    const leases = [{ ...makeLease("a1", 0), monthly_rental: null }];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.rows).toHaveLength(0);
  });

  it("asset with null vintage is excluded", () => {
    const assets = [{ ...makeAsset("a1", "A320neo", 2020), vintage: null }];
    const leases = [makeLease("a1", 500_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.rows).toHaveLength(0);
  });

  it("rows sorted by weightPct descending", () => {
    const assets = [
      makeAsset("a1", "A320neo", 2020), // small rental
      makeAsset("a2", "A330-300", 2018), // large rental
    ];
    const leases = [makeLease("a1", 100_000), makeLease("a2", 900_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.rows[0].registration).toBe("a2");
    expect(result.rows[1].registration).toBe("a1");
  });

  it("avgFleetAgeYears is rental-weighted", () => {
    // a1: age 5, rental $1M. a2: age 15, rental $1M. weighted avg = (5+15)/2 = 10
    const assets = [makeAsset("a1", "A320neo", 2021), makeAsset("a2", "A330-300", 2011)];
    const leases = [makeLease("a1", 1_000_000), makeLease("a2", 1_000_000)];
    const result = computePortfolioAssetRisk(assets, leases, REF_YEAR);
    expect(result.avgFleetAgeYears).toBeCloseTo(10, 1);
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/assetRisk.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module './assetRisk'`

- [ ] **Step 1.3: Implement `assetRisk.ts`**

Create `src/app/utils/assetRisk.ts` with this exact content:

```typescript
// src/app/utils/assetRisk.ts
// Pure-function utilities for fleet asset risk analysis (remarketing timeline + vintage LGD).
// No React dependencies — safe to use in both components and tests.

import type { Asset, Lease } from "../types/portfolio";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Base LGD (45%) already prices in 3 months of post-repossession idle time.
 *  Each month beyond this = ~1.5% of baseECL (storage + foregone rent). */
export const REMARKETING_BENCHMARK_MONTHS = 3;

/** Rental-weighted P50 remarketing timeline for narrowbody types (A320/737 family).
 *  Deep global demand — typically placed within a single maintenance cycle. */
export const NB_REMARKETING_MONTHS = 4;

/** Rental-weighted P50 remarketing timeline for widebody types (A330/A350/B777).
 *  Shallower placement pool; longer due-diligence and negotiation timelines. */
export const WB_REMARKETING_MONTHS = 9;

/** Vintage LGD adjustment schedule — additional fraction of baseECL per age tier.
 *  Mid-aged (10–15yr): narrowing buyer pool, mid-life heavy check costs (+4%).
 *  Aged (>15yr): near end-of-economic-life, part-out risk, illiquid secondary market (+10%). */
export const VINTAGE_LGD_TIERS = {
  young: 0,     // < 10 years
  mid:   0.04,  // 10–15 years
  aged:  0.10,  // > 15 years
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type VintageAgeTier = "young" | "mid" | "aged";

export interface AssetRiskRow {
  registration:  string;
  aircraftType:  string;
  vintage:       number;
  ageYears:      number;
  ageTier:       VintageAgeTier;
  lgdAdj:        number;      // 0, 0.04, or 0.10
  isWidebody:    boolean;
  monthlyRental: number;      // USD
  weightPct:     number;      // 0–1 share of total fleet rental
}

// ─── Classifiers ─────────────────────────────────────────────────────────────

/**
 * Returns true for twin-aisle aircraft types.
 * Narrowbody types (A220, A320 family, A321, B737 family, E-jets) return false.
 */
export function isWidebody(aircraftType: string): boolean {
  const wbPrefixes = ["A330", "A340", "A350", "A380", "B767", "B777", "B787", "767", "777", "787"];
  const upper = aircraftType.toUpperCase();
  return wbPrefixes.some((p) => upper.includes(p.toUpperCase()));
}

/**
 * Maps aircraft age in years to a vintage LGD tier.
 *   young: age < 10   — liquid, easily re-leased
 *   mid:   10 ≤ age ≤ 15 — narrowing buyer pool
 *   aged:  age > 15   — near end-of-economic-life
 */
export function vintageAgeTier(ageYears: number): VintageAgeTier {
  if (ageYears > 15) return "aged";
  if (ageYears >= 10) return "mid";
  return "young";
}

/**
 * LGD adjustment fraction for the given aircraft age.
 * Returns a value to be multiplied against baseECL: 0 | 0.04 | 0.10.
 */
export function vintageLGDAdj(ageYears: number): number {
  return VINTAGE_LGD_TIERS[vintageAgeTier(ageYears)];
}

// ─── Portfolio computation ────────────────────────────────────────────────────

/**
 * Compute fleet asset risk metrics from real asset and lease data.
 *
 * Exclusion rules (same pattern as other portfolio utilities):
 *   - Assets with no matching lease are excluded.
 *   - Assets with null or zero monthly_rental are excluded.
 *   - Assets with null vintage are excluded (age cannot be computed).
 *
 * Returns:
 *   suggestedRemarketingMonths — rental-weighted average by NB/WB type, rounded to integer.
 *     0 if no qualifying assets.
 *   vintageAdjFactor — rental-weighted LGD adjustment fraction (0–0.10+).
 *     Pass directly to ScenarioInputs.vintageAdjFactor.
 *   avgFleetAgeYears — rental-weighted average fleet age.
 *   pctMidAged — 0–1 rental share of 10–15yr aircraft.
 *   pctAged    — 0–1 rental share of >15yr aircraft.
 *   rows       — per-asset breakdown, sorted by weightPct descending.
 */
export function computePortfolioAssetRisk(
  assets: Asset[],
  leases: Lease[],
  referenceYear: number = new Date().getFullYear(),
): {
  suggestedRemarketingMonths: number;
  vintageAdjFactor:           number;
  avgFleetAgeYears:           number;
  pctMidAged:                 number;
  pctAged:                    number;
  rows:                       AssetRiskRow[];
} {
  const empty = {
    suggestedRemarketingMonths: 0, vintageAdjFactor: 0,
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
    if (asset.vintage === null) continue;

    const ageYears = referenceYear - asset.vintage;
    const tier     = vintageAgeTier(ageYears);
    const lgdAdj   = vintageLGDAdj(ageYears);
    const wb       = isWidebody(asset.aircraft_type);
    const rental   = lease.monthly_rental;

    rawRows.push({
      registration:  asset.registration,
      aircraftType:  asset.aircraft_type,
      vintage:       asset.vintage,
      ageYears,
      ageTier:       tier,
      lgdAdj,
      isWidebody:    wb,
      monthlyRental: rental,
      weightPct:     0,  // filled in second pass
    });
    totalRental += rental;
  }

  if (totalRental === 0) return empty;

  // Second pass: weights and aggregate sums
  let weightedAgeSum        = 0;
  let weightedVintageAdjSum = 0;
  let weightedRemarketSum   = 0;
  let midRental             = 0;
  let agedRental            = 0;

  for (const row of rawRows) {
    row.weightPct = row.monthlyRental / totalRental;
    weightedAgeSum        += row.ageYears * row.monthlyRental;
    weightedVintageAdjSum += row.lgdAdj   * row.monthlyRental;
    weightedRemarketSum   += (row.isWidebody ? WB_REMARKETING_MONTHS : NB_REMARKETING_MONTHS)
                             * row.monthlyRental;
    if (row.ageTier === "mid")  midRental  += row.monthlyRental;
    if (row.ageTier === "aged") agedRental += row.monthlyRental;
  }

  rawRows.sort((a, b) => b.weightPct - a.weightPct);

  return {
    suggestedRemarketingMonths: Math.round(weightedRemarketSum / totalRental),
    vintageAdjFactor:           weightedVintageAdjSum / totalRental,
    avgFleetAgeYears:           weightedAgeSum / totalRental,
    pctMidAged:                 midRental  / totalRental,
    pctAged:                    agedRental / totalRental,
    rows:                       rawRows,
  };
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/assetRisk.test.ts 2>&1 | tail -10
```

Expected output:
```
 Tests  26 passed (26)
```

- [ ] **Step 1.5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/utils/assetRisk.ts src/app/utils/assetRisk.test.ts && git commit -m "feat(s22): assetRisk utility — isWidebody, vintageAgeTier, computePortfolioAssetRisk

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: ECL Formula — `remarketingMonths` + `vintageAdjFactor` (TDD)

**Files:**
- Modify: `src/app/utils/eclCalculator.ts`
- Modify: `src/app/utils/eclCalculator.test.ts`

### Domain knowledge

- `remarketingMonths = 0`: feature inactive — no additional LGD beyond what's already in baseECL.
- `remarketingMonths > 0`: each month beyond `REMARKETING_BENCHMARK_MONTHS (3)` costs `0.015 × baseECL`. E.g., 7 months → `(7−3) × 0.015 × 47.2 = $2.832M`.
- `vintageAdjFactor = 0`: feature inactive.
- `vintageAdjFactor > 0`: applied as a direct fraction of baseECL. E.g., 0.04 → `0.04 × 47.2 = $1.888M`.
- Both scale with `baseECL` (not `BASE_ECL`) so they work correctly for non-demo portfolios.
- Both are additive to the existing delta line — they are not inside the 30% floor guard independently.

- [ ] **Step 2.1: Write the failing tests**

Append this block to `src/app/utils/eclCalculator.test.ts` (after the existing `payBehaviourDelta` describe block):

```typescript
// ─── Remarketing timeline LGD uplift (Sprint 22) ─────────────────────────────

describe("remarketing timeline LGD uplift (Sprint 22)", () => {
  it("remarketingMonths = 0 → inactive, ECL unchanged from base", () => {
    const ecl = computeECL({ ...ZERO_INPUTS, remarketingMonths: 0 });
    expect(ecl).toBeCloseTo(47.2, 4);
  });

  it("remarketingMonths = 3 (at benchmark) → no additional cost", () => {
    // max(0, 3 - 3) * 0.015 * 47.2 = 0
    const ecl = computeECL({ ...ZERO_INPUTS, remarketingMonths: 3 });
    expect(ecl).toBeCloseTo(47.2, 4);
  });

  it("remarketingMonths = 7 → 4 extra months × 1.5% × $47.2M = +$2.832M", () => {
    // (7 - 3) * 0.015 * 47.2 = 4 * 0.015 * 47.2 = 2.832
    const ecl = computeECL({ ...ZERO_INPUTS, remarketingMonths: 7 });
    expect(ecl).toBeCloseTo(47.2 + 2.832, 3);
  });

  it("remarketingMonths = 2 (below benchmark) → no cost (max guard)", () => {
    const ecl = computeECL({ ...ZERO_INPUTS, remarketingMonths: 2 });
    expect(ecl).toBeCloseTo(47.2, 4);
  });

  it("remarketingMonths scales with baseECL (double portfolio)", () => {
    // baseECL = 94.4, 7 months → (7-3) * 0.015 * 94.4 = 5.664
    const ecl = computeECLFromBase(94.4, { ...ZERO_INPUTS, remarketingMonths: 7 });
    expect(ecl).toBeCloseTo(94.4 + 5.664, 3);
  });
});

// ─── Vintage / aircraft age LGD uplift (Sprint 22) ───────────────────────────

describe("vintage aircraft age LGD uplift (Sprint 22)", () => {
  it("vintageAdjFactor = 0 → inactive, ECL unchanged from base", () => {
    const ecl = computeECL({ ...ZERO_INPUTS, vintageAdjFactor: 0 });
    expect(ecl).toBeCloseTo(47.2, 4);
  });

  it("vintageAdjFactor = 0.04 (mid-aged fleet) → +4% × $47.2M = +$1.888M", () => {
    const ecl = computeECL({ ...ZERO_INPUTS, vintageAdjFactor: 0.04 });
    expect(ecl).toBeCloseTo(47.2 + 1.888, 3);
  });

  it("vintageAdjFactor = 0.10 (aged fleet) → +10% × $47.2M = +$4.72M", () => {
    const ecl = computeECL({ ...ZERO_INPUTS, vintageAdjFactor: 0.10 });
    expect(ecl).toBeCloseTo(47.2 + 4.72, 3);
  });

  it("vintageAdjFactor stacks additively with remarketingMonths", () => {
    // remarketing uplift: (7-3)*0.015*47.2 = 2.832
    // vintage uplift:     0.04*47.2 = 1.888
    // total delta: 2.832 + 1.888 = 4.72 → ECL = 47.2 + 4.72 = 51.92
    const ecl = computeECL({ ...ZERO_INPUTS, remarketingMonths: 7, vintageAdjFactor: 0.04 });
    expect(ecl).toBeCloseTo(47.2 + 4.72, 3);
  });

  it("vintageAdjFactor scales with baseECL", () => {
    // baseECL = 94.4, vintageAdjFactor = 0.04 → 0.04 * 94.4 = 3.776
    const ecl = computeECLFromBase(94.4, { ...ZERO_INPUTS, vintageAdjFactor: 0.04 });
    expect(ecl).toBeCloseTo(94.4 + 3.776, 3);
  });
});
```

- [ ] **Step 2.2: Run to verify the new tests fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/eclCalculator.test.ts 2>&1 | tail -15
```

Expected: new tests fail with type errors or "not a function" since `remarketingMonths` / `vintageAdjFactor` don't exist yet.

- [ ] **Step 2.3: Update `eclCalculator.ts`**

**2.3a — Add fields to `ScenarioInputs`** (insert after the `repossWeightedMonths` block at line ~37):

```typescript
  // ── Asset risk (Sprint 22) ────────────────────────────────────────────────
  remarketingMonths: number; // 0 = feature inactive. Rental-weighted P50 months from repossession
  // to first day of next lease. Benchmark: 3 months (baked into base LGD).
  // Each extra month costs ~1.5% of baseECL (storage + foregone rent).
  vintageAdjFactor: number; // 0 = feature inactive. Rental-weighted LGD adjustment fraction
  // from fleet vintage: 0 = all young (<10yr), 0.04 = mid-aged mix (10–15yr), 0.10 = aged (>15yr).
  // Computed by computePortfolioAssetRisk; passed directly as fraction of baseECL.
```

**2.3b — Add fields to `ZERO_INPUTS`** (insert after `repossWeightedMonths: 0`):

```typescript
  remarketingMonths: 0,
  vintageAdjFactor: 0,
```

**2.3c — Add formula terms to `computeECLFromBase`** (insert after the `repossLGDDelta` block, before the `depositBenefit` block):

```typescript
  // Remarketing timeline LGD uplift (Sprint 22).
  // Guard: 0 = feature inactive. Benchmark: 3 months (baked into base 45% LGD).
  // Each extra month: 1.5% of baseECL (≈ $75k storage + foregone rent per WB-equivalent per month).
  const REMARKETING_BENCHMARK_MONTHS = 3;
  const remarketingLGDDelta = inputs.remarketingMonths > 0
    ? Math.max(0, inputs.remarketingMonths - REMARKETING_BENCHMARK_MONTHS) * 0.015 * baseECL
    : 0;

  // Vintage / aircraft age LGD uplift (Sprint 22).
  // Guard: 0 = feature inactive. vintageAdjFactor is the rental-weighted adjustment fraction
  // from computePortfolioAssetRisk; tiers: young=0, mid(10–15yr)=+4%, aged(>15yr)=+10%.
  const vintageAdjDelta = inputs.vintageAdjFactor > 0
    ? inputs.vintageAdjFactor * baseECL
    : 0;
```

**2.3d — Add new terms to the `delta` line** (the existing line ends with `+ payBehaviourDelta`):

Find this line in `computeECLFromBase`:
```typescript
  const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit + lgdDelta - assumptionBenefit + jurisdictionLGDDelta + repossLGDDelta - depositBenefit - mrBenefit + payBehaviourDelta;
```

Replace with:
```typescript
  const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit + lgdDelta - assumptionBenefit + jurisdictionLGDDelta + repossLGDDelta - depositBenefit - mrBenefit + payBehaviourDelta + remarketingLGDDelta + vintageAdjDelta;
```

- [ ] **Step 2.4: Run all ECL tests to verify they pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/eclCalculator.test.ts 2>&1 | tail -10
```

Expected:
```
 Tests  N passed (N)
```
(N is the previous count plus 11 new tests)

- [ ] **Step 2.5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/utils/eclCalculator.ts src/app/utils/eclCalculator.test.ts && git commit -m "feat(s22): add remarketingMonths + vintageAdjFactor to ECL formula

remarketingMonths: max(0, months - 3) * 1.5% * baseECL per extra month beyond benchmark.
vintageAdjFactor: direct fraction of baseECL from fleet vintage tier (0/4%/10%).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: `AssetRiskTab.tsx` — Analysis Component

**Files:**
- Create: `src/app/components/scenarios/AssetRiskTab.tsx`

### Design notes

- Follows `JurisdictionRiskTab.tsx` exactly: same KPI card layout, same table pattern, same "Use in Custom Builder" CTA.
- 5 KPI cards: Fleet Avg Age · Mid-Aged % · Aged % · Vintage LGD Uplift · Suggested Remarketing.
- Table: per-asset breakdown (Registration, Type, Vintage, Age, Tier, Remarket, Weight %).
- The "Use in Custom Builder" button passes `suggestedRemarketingMonths` and `vintageAdjFactor` to the parent.
- Import `BASE_ECL` from `eclCalculator` to compute the `$XM` dollar value for the Vintage LGD Uplift card.
- Color thresholds:
  - `avgFleetAgeYears`: green < 8yr, amber 8–12yr, red > 12yr
  - `pctMidAged`: green = 0, amber ≤ 15%, red > 15%
  - `pctAged`: green = 0, amber any > 0, red > 10%
  - Vintage LGD Uplift: green = $0, red > $0
  - Suggested Remarketing: green ≤ 4mo (NB benchmark), amber ≤ 9mo (WB benchmark), red > 9mo

- [ ] **Step 3.1: Create `AssetRiskTab.tsx`**

Create `src/app/components/scenarios/AssetRiskTab.tsx` with this exact content:

```typescript
// src/app/components/scenarios/AssetRiskTab.tsx
import { usePortfolioData } from "../../hooks/usePortfolioData";
import {
  computePortfolioAssetRisk,
  type VintageAgeTier,
  WB_REMARKETING_MONTHS,
} from "../../utils/assetRisk";
import { BASE_ECL } from "../../utils/eclCalculator";
import { Card } from "../ui/Card";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<VintageAgeTier, string> = {
  young: "Young (<10yr)",
  mid:   "Mid (10–15yr)",
  aged:  "Aged (>15yr)",
};

const TIER_PILL_BG: Record<VintageAgeTier, string> = {
  young: "#DCFCE7",
  mid:   "#FEF3C7",
  aged:  "#FEE2E2",
};

const TIER_PILL_COLOR: Record<VintageAgeTier, string> = {
  young: "#15803D",
  mid:   "#B45309",
  aged:  "#B91C1C",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, color, bg, note,
}: { label: string; value: string; color: string; bg: string; note?: string }) {
  return (
    <div style={{
      background: bg, borderRadius: "0.5rem",
      padding: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem",
    }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.375rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {note && <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{note}</div>}
    </div>
  );
}

function TierPill({ tier }: { tier: VintageAgeTier }) {
  return (
    <span style={{
      background: TIER_PILL_BG[tier],
      color: TIER_PILL_COLOR[tier],
      fontWeight: 600, fontSize: "0.75rem",
      padding: "0.15rem 0.5rem", borderRadius: "9999px",
      whiteSpace: "nowrap",
    }}>
      {TIER_LABEL[tier]}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Called when user clicks "Use in Custom Builder" — switches tab and pre-fills sliders. */
  onUseInCustomBuilder: (remarketingMonths: number, vintageAdjFactor: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AssetRiskTab({ onUseInCustomBuilder }: Props) {
  const { assets, leases } = usePortfolioData();
  const {
    suggestedRemarketingMonths, vintageAdjFactor,
    avgFleetAgeYears, pctMidAged, pctAged, rows,
  } = computePortfolioAssetRisk(assets, leases);

  const vintageUpliftM = rows.length > 0 ? vintageAdjFactor * BASE_ECL : 0;

  // Color helpers
  const ageColor = avgFleetAgeYears > 12 ? "#B91C1C" : avgFleetAgeYears > 8 ? "#B45309" : "#15803D";
  const ageBg    = avgFleetAgeYears > 12 ? "#FEE2E2" : avgFleetAgeYears > 8 ? "#FEF3C7" : "#DCFCE7";
  const midColor = pctMidAged > 0.15 ? "#B91C1C" : pctMidAged > 0 ? "#B45309" : "#15803D";
  const midBg    = pctMidAged > 0.15 ? "#FEE2E2" : pctMidAged > 0 ? "#FEF3C7" : "#DCFCE7";
  const agedColor = pctAged > 0.10 ? "#B91C1C" : pctAged > 0 ? "#B45309" : "#15803D";
  const agedBg    = pctAged > 0.10 ? "#FEE2E2" : pctAged > 0 ? "#FEF3C7" : "#DCFCE7";
  const remColor = suggestedRemarketingMonths > WB_REMARKETING_MONTHS
    ? "#B91C1C"
    : suggestedRemarketingMonths > 4 ? "#B45309" : "#15803D";
  const remBg = suggestedRemarketingMonths > WB_REMARKETING_MONTHS
    ? "#FEE2E2"
    : suggestedRemarketingMonths > 4 ? "#FEF3C7" : "#DCFCE7";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Fleet Avg Age"
          value={rows.length > 0 ? `${avgFleetAgeYears.toFixed(1)} yr` : "—"}
          color={ageColor} bg={ageBg}
          note="rental-weighted"
        />
        <KpiCard
          label="Mid-Aged (10–15yr)"
          value={`${(pctMidAged * 100).toFixed(1)}%`}
          color={midColor} bg={midBg}
          note="+4% LGD adj"
        />
        <KpiCard
          label="Aged (>15yr)"
          value={`${(pctAged * 100).toFixed(1)}%`}
          color={agedColor} bg={agedBg}
          note="+10% LGD adj"
        />
        <KpiCard
          label="Vintage LGD Uplift"
          value={vintageUpliftM > 0 ? `+$${vintageUpliftM.toFixed(1)}M` : "$0"}
          color={vintageUpliftM > 0 ? "#B91C1C" : "#15803D"}
          bg={vintageUpliftM > 0 ? "#FEE2E2" : "#DCFCE7"}
          note="vs young-fleet baseline"
        />
        <KpiCard
          label="Suggested Remarketing"
          value={rows.length > 0 ? `${suggestedRemarketingMonths} mo` : "—"}
          color={remColor} bg={remBg}
          note="NB/WB rental-weighted"
        />
      </div>

      {/* ── Asset breakdown table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Asset Age &amp; Remarketing Breakdown
          </div>

          {rows.length === 0 ? (
            <div style={{ color: "#94A3B8", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
              No asset data available.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    {["Registration", "Type", "Vintage", "Age", "Tier", "Remarket", "Weight %"].map((h) => (
                      <th key={h} style={{
                        textAlign: h === "Registration" || h === "Type" ? "left" : "right",
                        padding: "0.5rem 0.75rem",
                        fontWeight: 600, color: "#64748B",
                        fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.registration}
                      style={{
                        borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none",
                        background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                      }}
                    >
                      <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>
                        {row.registration}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>
                        {row.aircraftType}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.vintage}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.ageYears} yr
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <TierPill tier={row.ageTier} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.isWidebody ? "9 mo (WB)" : "4 mo (NB)"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                        {(row.weightPct * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                    <td colSpan={3} style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#475569", fontSize: "0.75rem" }}>
                      PORTFOLIO WEIGHTED
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
                      {avgFleetAgeYears.toFixed(1)} yr
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                        {(pctMidAged * 100).toFixed(0)}% Mid · {(pctAged * 100).toFixed(0)}% Aged
                      </span>
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontSize: "0.75rem", color: "#64748B", fontVariantNumeric: "tabular-nums" }}>
                      {suggestedRemarketingMonths} mo
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#0F172A" }}>
                      100.0%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* ── "Use in Custom Builder" button ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => onUseInCustomBuilder(suggestedRemarketingMonths, vintageAdjFactor)}
          disabled={rows.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            background: "#002147", color: "#FFFFFF",
            border: "none", borderRadius: "9999px",
            padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500,
            cursor: rows.length === 0 ? "not-allowed" : "pointer",
            opacity: rows.length === 0 ? 0.5 : 1,
          }}
          title="Computed from your portfolio's aircraft type mix (NB/WB) and vintage year, weighted by monthly rental."
        >
          Use in Custom Builder →
        </button>
      </div>

    </div>
  );
}
```

- [ ] **Step 3.2: Verify build succeeds**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 3.3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/scenarios/AssetRiskTab.tsx && git commit -m "feat(s22): AssetRiskTab — KPI cards, asset breakdown table, Use in Custom Builder CTA

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: `Scenarios.tsx` — Full Wiring

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

This task has 4 logical sub-steps. Apply them in order; each sub-step is self-contained.

### 4A — Template objects + ZERO_INPUTS + DSL

- [ ] **Step 4A.1: Add new fields to template `inputs` objects**

All explicit `inputs: { ... }` objects in the templates currently end with:
```
leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0 },
```
(single-line templates) or:
```
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
    },
```
(multi-line templates).

Use Edit with `replace_all: true` to extend both patterns.

**Single-line pattern** — find:
```
leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0 },
```
Replace with:
```
leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0, remarketingMonths: 0, vintageAdjFactor: 0 },
```

**Multi-line pattern** — find:
```
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
    },
```
Replace with:
```
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
      remarketingMonths: 0, vintageAdjFactor: 0,
    },
```

- [ ] **Step 4A.2: Update `generateDSL`**

In the `generateDSL` function, after the `lease_assumption_pct` block, add:

```typescript
        // Asset risk — omitted when both are 0 (feature inactive)
        ...(inputs.remarketingMonths > 0 || inputs.vintageAdjFactor > 0
          ? { remarketing_months: inputs.remarketingMonths, vintage_adj_factor: inputs.vintageAdjFactor }
          : {}),
```

- [ ] **Step 4A.3: Update `parseDSL`**

In the `parseDSL` function, after the `maintenanceReserveCoverage` parsing block, add:

```typescript
        remarketingMonths: typeof s.remarketing_months === "number"
          ? Math.max(0, s.remarketing_months)
          : 0,
        vintageAdjFactor: typeof s.vintage_adj_factor === "number"
          ? Math.min(0.5, Math.max(0, s.vintage_adj_factor))
          : 0,
```

### 4B — State, imports, useMemo, tab list

- [ ] **Step 4B.1: Add import for `AssetRiskTab` and `computePortfolioAssetRisk`**

Add at the top of Scenarios.tsx imports section:

```typescript
import { AssetRiskTab } from "../components/scenarios/AssetRiskTab";
import { computePortfolioAssetRisk } from "../utils/assetRisk";
```

- [ ] **Step 4B.2: Add `assetRiskOpen` state**

In the Custom Builder state block (near `const [payBehaviourOpen, setPayBehaviourOpen] = useState(false);`), add:

```typescript
  const [assetRiskOpen, setAssetRiskOpen] = useState(false);
```

- [ ] **Step 4B.3: Add `portfolioAssetRisk` useMemo**

After the `portfolioJurisdictionMix` useMemo (near line 1075), add:

```typescript
  // Rental-weighted asset risk metrics — used by AssetRiskTab "Use in Custom Builder"
  // handler and the "From portfolio" button in the Custom Builder Asset Risk section.
  const portfolioAssetRisk = React.useMemo(
    () => computePortfolioAssetRisk(assets, leases),
    [assets, leases]
  );
```

- [ ] **Step 4B.4: Register the new tab in the tab list**

Find:
```typescript
: ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Security Deposits", "Deferral Risk", "Lessor Mitigation", "Payment Behaviour", "Concentration Stress", "Lease Pricing"];
```

Replace with:
```typescript
: ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Asset Risk", "Security Deposits", "Deferral Risk", "Lessor Mitigation", "Payment Behaviour", "Concentration Stress", "Lease Pricing"];
```

- [ ] **Step 4B.5: Update `updateFormInputs` auto-expand logic**

Find:
```typescript
    if (next.ctcGoldPct !== 0 || next.nonCtcPct !== 0 || next.repossWeightedMonths !== 0) setJurisdictionOpen(true);
```

After this line, add:
```typescript
    if (next.remarketingMonths !== 0 || next.vintageAdjFactor !== 0) setAssetRiskOpen(true);
```

- [ ] **Step 4B.6: Update clone-pending auto-expand**

Find (in the `clonePending` useEffect):
```typescript
    if (clonePending.inputs.ctcGoldPct !== 0 || clonePending.inputs.nonCtcPct !== 0 || clonePending.inputs.repossWeightedMonths !== 0) setJurisdictionOpen(true);
```

After this line, add:
```typescript
    if (clonePending.inputs.remarketingMonths !== 0 || clonePending.inputs.vintageAdjFactor !== 0) setAssetRiskOpen(true);
```

### 4C — Custom Builder: Asset Risk collapsible section

- [ ] **Step 4C.1: Add the Asset Risk collapsible to the Custom Builder form**

Insert the following block immediately after the Jurisdiction Risk collapsible (which ends with `})()}`), before the Security Deposits collapsible. This is after line that currently ends the Jurisdiction section `})()}`.

```tsx
                  {/* ── Asset Risk — collapsible ── */}
                  {(() => {
                    const remMonths = formInputs.remarketingMonths;
                    const vintAdj   = formInputs.vintageAdjFactor;
                    const isActive  = remMonths !== 0 || vintAdj !== 0;

                    const remImpact  = remMonths > 0
                      ? Math.max(0, remMonths - 3) * 0.015 * liveBaseECL
                      : 0;
                    const vintImpact = vintAdj > 0 ? vintAdj * liveBaseECL : 0;
                    const totalUplift = remImpact + vintImpact;

                    return (
                      <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                        <button
                          onClick={() => setAssetRiskOpen((o) => !o)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.875rem",
                            background: assetRiskOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                            border: "none", cursor: "pointer",
                            borderBottom: assetRiskOpen ? "1px solid #E2E8F0" : "none",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Asset Risk
                            </span>
                            {isActive ? (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                +${totalUplift.toFixed(1)}M uplift
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>None (young fleet, liquid market)</span>
                            )}
                          </div>
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: assetRiskOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
                          >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        <AnimatePresence initial={false}>
                          {assetRiskOpen && (
                            <motion.div
                              key="asset-risk-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0.875rem" }}>
                                {/* Remarketing Timeline slider */}
                                <SliderRow
                                  label="Remarketing Timeline"
                                  min={0} max={24} step={1}
                                  value={remMonths}
                                  onChange={(v) => updateFormInputs({ remarketingMonths: v })}
                                  fmt={(v) => v === 0 ? "Off (inactive)" : `${v} mo`}
                                />
                                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginBottom: "0.875rem", marginTop: "-0.25rem" }}>
                                  Post-repossession months to first new lease. Benchmark: 3 mo (baked in). Each extra month +1.5% of base ECL. NB typical: 4 mo · WB typical: 9 mo.
                                </div>

                                {/* Vintage LGD Adjustment slider */}
                                <SliderRow
                                  label="Vintage LGD Adj"
                                  min={0} max={0.15} step={0.005}
                                  value={vintAdj}
                                  onChange={(v) => updateFormInputs({ vintageAdjFactor: v })}
                                  fmt={(v) => v === 0 ? "Off (inactive)" : `${(v * 100).toFixed(1)}% of ECL`}
                                />
                                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginBottom: "0.875rem", marginTop: "-0.25rem" }}>
                                  Fleet age LGD uplift. Mid-aged (10–15yr): 4% · Aged (&gt;15yr): 10%. Computed from actual fleet vintage by "From portfolio".
                                </div>

                                {/* "From portfolio" button */}
                                <button
                                  onClick={() =>
                                    updateFormInputs({
                                      remarketingMonths: portfolioAssetRisk.suggestedRemarketingMonths,
                                      vintageAdjFactor:  portfolioAssetRisk.vintageAdjFactor,
                                    })
                                  }
                                  title="Computed from your portfolio's aircraft type (NB/WB) and vintage year, weighted by monthly rental."
                                  style={{
                                    display: "flex", alignItems: "center", gap: "0.375rem",
                                    background: "transparent", color: "#475569",
                                    border: "1px solid #E2E8F0", borderRadius: "9999px",
                                    padding: "0.375rem 0.75rem", fontSize: "0.8125rem",
                                    fontWeight: 500, cursor: "pointer", marginBottom: "0.75rem",
                                  }}
                                >
                                  From portfolio
                                </button>

                                {/* Net impact line */}
                                {isActive && liveBaseECL > 0 && (
                                  <div style={{
                                    padding: "0.625rem 0.75rem",
                                    background: "#F8FAFC", borderRadius: "0.375rem",
                                    border: "1px solid #E2E8F0",
                                    fontSize: "0.75rem", color: "#475569",
                                    display: "flex", gap: "0.75rem", flexWrap: "wrap",
                                  }}>
                                    {remImpact > 0 && (
                                      <span>
                                        Remarketing{" "}
                                        <span style={{ fontWeight: 700, color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                                          +${remImpact.toFixed(1)}M
                                        </span>
                                      </span>
                                    )}
                                    {remImpact > 0 && vintImpact > 0 && <span style={{ color: "#CBD5E1" }}>·</span>}
                                    {vintImpact > 0 && (
                                      <span>
                                        Vintage{" "}
                                        <span style={{ fontWeight: 700, color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                                          +${vintImpact.toFixed(1)}M
                                        </span>
                                      </span>
                                    )}
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span>
                                      Total uplift{" "}
                                      <span style={{ fontWeight: 700, color: totalUplift > 0 ? "#B91C1C" : "#94A3B8", fontVariantNumeric: "tabular-nums" }}>
                                        +${totalUplift.toFixed(1)}M
                                      </span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}
```

### 4D — Render the AssetRiskTab

- [ ] **Step 4D.1: Add the tab render block**

Find the Jurisdiction Risk tab render block:
```typescript
      {/* ══ JURISDICTION RISK TAB ═══════════════════════════════════════ */}
      {activeTab === "Jurisdiction Risk" && (
        <JurisdictionRiskTab
```

Immediately after the closing `/>` and `)}` of the JurisdictionRiskTab block, add:

```typescript
      {/* ══ ASSET RISK TAB ══════════════════════════════════════════════ */}
      {activeTab === "Asset Risk" && (
        <AssetRiskTab
          onUseInCustomBuilder={(months, adj) => {
            updateFormInputs({ remarketingMonths: months, vintageAdjFactor: adj });
            setAssetRiskOpen(true);
            setActiveTab("Custom Builder");
          }}
        />
      )}
```

- [ ] **Step 4D.2: Verify build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 4D.3: Run the full test suite**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -10
```

Expected:
```
 Test Files  11 passed (11)
      Tests  N passed (N)
```

Where N is the previous test count (232) plus the new assetRisk tests (~26) plus the new ECL tests (~11) = approximately 269. All must pass.

- [ ] **Step 4D.4: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Scenarios.tsx && git commit -m "feat(s22): wire AssetRiskTab — template objects, DSL, Custom Builder collapsible, tab render

- remarketingMonths + vintageAdjFactor in all 15 template inputs objects
- generateDSL/parseDSL: remarketing_months, vintage_adj_factor in shocks
- assetRiskOpen state + portfolioAssetRisk useMemo
- Asset Risk tab registered between Jurisdiction Risk and Security Deposits
- Asset Risk collapsible in Custom Builder with two sliders + From portfolio button
- updateFormInputs and clonePending both auto-expand Asset Risk section
- AssetRiskTab onUseInCustomBuilder handler pre-fills and switches to Custom Builder

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**

| Requirement | Task |
|---|---|
| `remarketingMonths` in ScenarioInputs + formula | Task 2 |
| `vintageAdjFactor` in ScenarioInputs + formula | Task 2 |
| `assetRisk.ts` utility (`isWidebody`, `vintageAgeTier`, `computePortfolioAssetRisk`) | Task 1 |
| `AssetRiskTab.tsx` with KPI cards + table | Task 3 |
| New "Asset Risk" tab registered in tab list | Task 4B.4 |
| Custom Builder: Asset Risk collapsible | Task 4C |
| `onUseInCustomBuilder` handler | Task 4D.1 |
| Template objects updated | Task 4A.1 |
| DSL generation + parsing | Task 4A.2/4A.3 |
| `portfolioAssetRisk` useMemo | Task 4B.3 |
| Auto-expand on updateFormInputs | Task 4B.5 |
| Auto-expand on clone-pending | Task 4B.6 |

All spec requirements covered. ✅

**2. Placeholder scan:** No TBDs, no "implement later", all code blocks complete. ✅

**3. Type consistency:**
- `VintageAgeTier` exported from `assetRisk.ts`, imported in `AssetRiskTab.tsx` ✅
- `AssetRiskRow` used only internally in `assetRisk.ts` ✅
- `computePortfolioAssetRisk` returns `suggestedRemarketingMonths` (number), `vintageAdjFactor` (number) — both used consistently in Scenarios.tsx ✅
- `onUseInCustomBuilder: (remarketingMonths: number, vintageAdjFactor: number) => void` in AssetRiskTab props matches the Scenarios.tsx handler signature `(months, adj) => ...` ✅
- `REMARKETING_BENCHMARK_MONTHS = 3` defined in both `assetRisk.ts` (exported) and `eclCalculator.ts` (local const) — these are independent constants for different purposes ✅
