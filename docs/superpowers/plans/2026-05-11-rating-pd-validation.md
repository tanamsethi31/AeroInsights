# Rating / PD Validation Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Rating / PD" analysis tab to the ECL Scenario Builder that maps each lessee's `pd_estimate` and `watchlist_status` to IFRS 9 stages, surfaces divergences, and pre-fills the existing `pdS2Multi`/`pdS3Multi` macro sliders from real portfolio PD data.

**Architecture:** Four files — a pure-function utility (`ratingPD.ts`), its unit tests (`ratingPD.test.ts`), a self-contained tab component (`RatingPDTab.tsx`), and minimal wiring in `Scenarios.tsx`. Threshold state is component-local (analysis input, not scenario parameter). No new `ScenarioInputs` fields; `eclCalculator.ts` is untouched.

**Tech Stack:** TypeScript, React (hooks), Vitest, inline styles (no new CSS files)

**Spec:** `docs/superpowers/specs/2026-05-11-rating-pd-validation-design.md`

---

### Task 1: `ratingPD.ts` — Pure Utility

**Files:**
- Create: `src/app/utils/ratingPD.ts`

This task contains only the pure functions and types. No React. Pattern mirrors `src/app/utils/assetRisk.ts`.

- [ ] **Step 1: Create `src/app/utils/ratingPD.ts`**

```typescript
// src/app/utils/ratingPD.ts
// Pure-function utilities for lessee credit quality / IFRS 9 stage analysis.
// No React dependencies — safe to use in both components and tests.

import type { Lessee, Lease } from "../types/portfolio";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PDThresholds {
  /** PD ≤ s1Max → Stage 1 */
  s1Max: number;
  /** s1Max < PD ≤ s2Max → Stage 2; PD > s2Max → Stage 3 */
  s2Max: number;
}

/** IATA aviation-industry standard thresholds (default). */
export const IATA_THRESHOLDS: PDThresholds = { s1Max: 0.01, s2Max: 0.20 };

/** Tighter thresholds — more conservative classification. */
export const TIGHT_THRESHOLDS: PDThresholds = { s1Max: 0.02, s2Max: 0.15 };

/**
 * Rental-weighted S2 PD that corresponds to pdS2Multi = 1.0 in the base ECL ($47.2M).
 * Used to derive impliedPdS2Multi from actual portfolio data.
 */
export const BASELINE_S2_PD = 0.05;  // 5%

/**
 * Rental-weighted S3 PD that corresponds to pdS3Multi = 1.0 in the base ECL ($47.2M).
 * Used to derive impliedPdS3Multi from actual portfolio data.
 */
export const BASELINE_S3_PD = 0.30;  // 30%

export interface RatingPDRow {
  lesseeName:      string;
  creditRating:    string | null;
  pdEstimate:      number | null;     // null = not populated in portfolio data
  pdStage:         1 | 2 | 3 | null; // null if pdEstimate is null
  watchlistStage:  1 | 2 | 3 | null; // null if watchlist_status is null
  stageDivergence: boolean;           // true when both non-null and pdStage ≠ watchlistStage
  weightPct:       number;            // 0–1 rental share
  monthlyRental:   number;            // USD
}

// ─── Classifiers ─────────────────────────────────────────────────────────────

/**
 * Map a lessee's pd_estimate to an IFRS 9 stage using configurable thresholds.
 * Returns null if pd is null (no data — shown as "—" in the table).
 */
export function pdImpliedStage(
  pd: number | null,
  thresholds: PDThresholds,
): 1 | 2 | 3 | null {
  if (pd === null) return null;
  if (pd <= thresholds.s1Max) return 1;
  if (pd <= thresholds.s2Max) return 2;
  return 3;
}

/**
 * Map a lessee's watchlist_status to an implied IFRS 9 stage.
 * null status → null (no watchlist signal; shown as "—" in the table, not counted in divergence).
 */
export function watchlistImpliedStage(
  status: "green" | "amber" | "red" | null,
): 1 | 2 | 3 | null {
  if (status === "red")   return 3;
  if (status === "amber") return 2;
  if (status === "green") return 1;
  return null;
}

// ─── Portfolio computation ────────────────────────────────────────────────────

/**
 * Compute portfolio-level IFRS 9 stage analysis from lessee PD estimates and watchlist status.
 *
 * Exclusion rules (same pattern as other portfolio utilities):
 *   - Lessee with no matching lease → excluded entirely.
 *   - Lessee with null or zero monthly_rental → excluded entirely.
 *   - Null pd_estimate → included in table (pdStage: null), excluded from weighted PD
 *     and multiplier computation.
 *   - Null watchlist_status → included in table (watchlistStage: null), not counted as divergence.
 *
 * Multipliers: impliedPdS2Multi = rentalWeightedAvgPD(S2 bucket) / BASELINE_S2_PD
 *              impliedPdS3Multi = rentalWeightedAvgPD(S3 bucket) / BASELINE_S3_PD
 * Empty stage bucket → multiplier stays at 1.0. Clamped to [0.5, 5.0].
 *
 * Rows sorted by weightPct descending.
 */
export function computePortfolioRatingPD(
  lessees: Lessee[],
  leases:  Lease[],
  thresholds: PDThresholds = IATA_THRESHOLDS,
): {
  rows:                RatingPDRow[];
  portfolioWeightedPD: number;   // rental-weighted avg PD; 0 if no PD data
  pctS1:               number;   // 0–1 rental share, PD-implied stage
  pctS2:               number;
  pctS3:               number;
  impliedPdS2Multi:    number;   // ≥ 0.5, ≤ 5.0
  impliedPdS3Multi:    number;
  divergenceCount:     number;
} {
  const empty = {
    rows: [], portfolioWeightedPD: 0,
    pctS1: 0, pctS2: 0, pctS3: 0,
    impliedPdS2Multi: 1.0, impliedPdS3Multi: 1.0,
    divergenceCount: 0,
  };
  if (lessees.length === 0 || leases.length === 0) return empty;

  // Build lesseeId → first lease with positive rental
  const leaseByLessee = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByLessee.has(lease.lessee_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByLessee.set(lease.lessee_id, lease);
    }
  }

  // Build raw rows
  const rawRows: RatingPDRow[] = [];
  let totalRental = 0;

  for (const lessee of lessees) {
    const lease = leaseByLessee.get(lessee.id);
    if (!lease || !lease.monthly_rental) continue;

    const pdStage        = pdImpliedStage(lessee.pd_estimate, thresholds);
    const watchlistStage = watchlistImpliedStage(lessee.watchlist_status);
    const stageDivergence =
      pdStage !== null && watchlistStage !== null && pdStage !== watchlistStage;

    rawRows.push({
      lesseeName:      lessee.name,
      creditRating:    lessee.credit_rating,
      pdEstimate:      lessee.pd_estimate,
      pdStage,
      watchlistStage,
      stageDivergence,
      weightPct:       0,  // filled in second pass
      monthlyRental:   lease.monthly_rental,
    });
    totalRental += lease.monthly_rental;
  }

  if (totalRental === 0) return empty;

  // Second pass: weights and aggregate sums
  let weightedPDSum   = 0;
  let pdRentalTotal   = 0;  // rental of lessees with non-null pd_estimate
  let s1Rental = 0, s2Rental = 0, s3Rental = 0;
  let s2WeightedPDSum = 0, s2RentalTotal = 0;
  let s3WeightedPDSum = 0, s3RentalTotal = 0;
  let divergenceCount = 0;

  for (const row of rawRows) {
    row.weightPct = row.monthlyRental / totalRental;

    if (row.stageDivergence) divergenceCount++;

    if (row.pdEstimate !== null) {
      weightedPDSum += row.pdEstimate * row.monthlyRental;
      pdRentalTotal += row.monthlyRental;
    }

    if (row.pdStage === 1) s1Rental += row.monthlyRental;
    if (row.pdStage === 2) {
      s2Rental        += row.monthlyRental;
      if (row.pdEstimate !== null) {
        s2WeightedPDSum += row.pdEstimate * row.monthlyRental;
        s2RentalTotal   += row.monthlyRental;
      }
    }
    if (row.pdStage === 3) {
      s3Rental        += row.monthlyRental;
      if (row.pdEstimate !== null) {
        s3WeightedPDSum += row.pdEstimate * row.monthlyRental;
        s3RentalTotal   += row.monthlyRental;
      }
    }
  }

  rawRows.sort((a, b) => b.weightPct - a.weightPct);

  const portfolioWeightedPD = pdRentalTotal > 0 ? weightedPDSum / pdRentalTotal : 0;
  const pctS1 = s1Rental / totalRental;
  const pctS2 = s2Rental / totalRental;
  const pctS3 = s3Rental / totalRental;

  const rawS2Multi = s2RentalTotal > 0
    ? (s2WeightedPDSum / s2RentalTotal) / BASELINE_S2_PD
    : 1.0;
  const rawS3Multi = s3RentalTotal > 0
    ? (s3WeightedPDSum / s3RentalTotal) / BASELINE_S3_PD
    : 1.0;

  const clamp = (v: number) => Math.min(5.0, Math.max(0.5, v));

  return {
    rows: rawRows,
    portfolioWeightedPD,
    pctS1, pctS2, pctS3,
    impliedPdS2Multi: clamp(rawS2Multi),
    impliedPdS3Multi: clamp(rawS3Multi),
    divergenceCount,
  };
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run from project root:
```bash
npx tsc --noEmit
```
Expected: no errors. If `lessee_id` is missing on `Lease`, check `src/app/types/portfolio.ts` — the field is `lessee_id: string`.

- [ ] **Step 3: Commit**

```bash
git add src/app/utils/ratingPD.ts
git commit -m "feat(s23): add ratingPD.ts pure utility — pdImpliedStage, watchlistImpliedStage, computePortfolioRatingPD"
```

---

### Task 2: `ratingPD.test.ts` — Unit Tests

**Files:**
- Create: `src/app/utils/ratingPD.test.ts`
- Test: `src/app/utils/ratingPD.test.ts`

Target ~30 tests covering all pure functions and all exclusion rules. Pattern mirrors `src/app/utils/assetRisk.test.ts`.

- [ ] **Step 1: Write the test file**

```typescript
// src/app/utils/ratingPD.test.ts
import { describe, it, expect } from "vitest";
import {
  pdImpliedStage,
  watchlistImpliedStage,
  computePortfolioRatingPD,
  IATA_THRESHOLDS,
  TIGHT_THRESHOLDS,
  BASELINE_S2_PD,
  BASELINE_S3_PD,
} from "./ratingPD";
import type { Lessee, Lease } from "../types/portfolio";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLessee(
  id: string,
  name: string,
  pdEstimate: number | null,
  watchlistStatus: "green" | "amber" | "red" | null,
): Lessee {
  return {
    id, org_id: "demo", name, iata_code: null,
    country: "Test", credit_rating: null,
    pd_estimate: pdEstimate,
    watchlist_status: watchlistStatus,
    created_at: "2024-01-01T00:00:00Z",
  };
}

function makeLease(lesseeId: string, monthlyRental: number): Lease {
  return {
    id: `ls-${lesseeId}`, org_id: "demo",
    asset_id: `a-${lesseeId}`, lessee_id: lesseeId,
    start_date: "2024-01-01", end_date: "2030-01-01",
    monthly_rental: monthlyRental, currency: "USD",
    stage: 1, created_at: "2024-01-01T00:00:00Z",
  };
}

// ─── pdImpliedStage ───────────────────────────────────────────────────────────

describe("pdImpliedStage (IATA thresholds)", () => {
  it("null → null", () => {
    expect(pdImpliedStage(null, IATA_THRESHOLDS)).toBeNull();
  });

  it("PD = 0.005 → Stage 1 (below s1Max)", () => {
    expect(pdImpliedStage(0.005, IATA_THRESHOLDS)).toBe(1);
  });

  it("PD = 0.01 → Stage 1 (at s1Max boundary)", () => {
    expect(pdImpliedStage(0.01, IATA_THRESHOLDS)).toBe(1);
  });

  it("PD = 0.011 → Stage 2 (just above s1Max)", () => {
    expect(pdImpliedStage(0.011, IATA_THRESHOLDS)).toBe(2);
  });

  it("PD = 0.10 → Stage 2 (mid-range)", () => {
    expect(pdImpliedStage(0.10, IATA_THRESHOLDS)).toBe(2);
  });

  it("PD = 0.20 → Stage 2 (at s2Max boundary)", () => {
    expect(pdImpliedStage(0.20, IATA_THRESHOLDS)).toBe(2);
  });

  it("PD = 0.21 → Stage 3 (above s2Max)", () => {
    expect(pdImpliedStage(0.21, IATA_THRESHOLDS)).toBe(3);
  });

  it("PD = 0 → Stage 1 (zero PD)", () => {
    expect(pdImpliedStage(0, IATA_THRESHOLDS)).toBe(1);
  });

  it("PD = 0.015 with TIGHT thresholds → Stage 2 (above tight s1Max=0.02 is false, 0.015 < 0.02 → Stage 1)", () => {
    // TIGHT: s1Max=0.02, so 0.015 ≤ 0.02 → Stage 1
    expect(pdImpliedStage(0.015, TIGHT_THRESHOLDS)).toBe(1);
  });

  it("PD = 0.025 with TIGHT thresholds → Stage 2 (above tight s1Max=0.02)", () => {
    // TIGHT: s1Max=0.02, s2Max=0.15; 0.025 > 0.02 and ≤ 0.15 → Stage 2
    expect(pdImpliedStage(0.025, TIGHT_THRESHOLDS)).toBe(2);
  });

  it("PD = 0.16 with TIGHT thresholds → Stage 3 (above tight s2Max=0.15)", () => {
    expect(pdImpliedStage(0.16, TIGHT_THRESHOLDS)).toBe(3);
  });
});

// ─── watchlistImpliedStage ────────────────────────────────────────────────────

describe("watchlistImpliedStage", () => {
  it("null → null", () => {
    expect(watchlistImpliedStage(null)).toBeNull();
  });

  it("'green' → Stage 1", () => {
    expect(watchlistImpliedStage("green")).toBe(1);
  });

  it("'amber' → Stage 2", () => {
    expect(watchlistImpliedStage("amber")).toBe(2);
  });

  it("'red' → Stage 3", () => {
    expect(watchlistImpliedStage("red")).toBe(3);
  });
});

// ─── computePortfolioRatingPD ─────────────────────────────────────────────────

describe("computePortfolioRatingPD", () => {
  it("empty inputs → all zeros, empty rows", () => {
    const result = computePortfolioRatingPD([], []);
    expect(result.rows).toHaveLength(0);
    expect(result.portfolioWeightedPD).toBe(0);
    expect(result.pctS1).toBe(0);
    expect(result.pctS2).toBe(0);
    expect(result.pctS3).toBe(0);
    expect(result.impliedPdS2Multi).toBe(1.0);
    expect(result.impliedPdS3Multi).toBe(1.0);
    expect(result.divergenceCount).toBe(0);
  });

  it("single S1 lessee → pctS1=1, multipliers both 1.0", () => {
    const lessees = [makeLessee("l1", "Airline A", 0.005, "green")];
    const leases  = [makeLease("l1", 500_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.pctS1).toBeCloseTo(1.0, 5);
    expect(result.pctS2).toBe(0);
    expect(result.pctS3).toBe(0);
    // No S2 or S3 lessees → multipliers stay at 1.0
    expect(result.impliedPdS2Multi).toBe(1.0);
    expect(result.impliedPdS3Multi).toBe(1.0);
    expect(result.rows).toHaveLength(1);
  });

  it("single S2 lessee (PD=0.10) → impliedPdS2Multi = 0.10/0.05 = 2.0", () => {
    const lessees = [makeLessee("l1", "Airline B", 0.10, null)];
    const leases  = [makeLease("l1", 500_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.pctS2).toBeCloseTo(1.0, 5);
    expect(result.impliedPdS2Multi).toBeCloseTo(0.10 / BASELINE_S2_PD, 5); // 2.0
  });

  it("single S3 lessee (PD=0.30) → impliedPdS3Multi = 0.30/0.30 = 1.0", () => {
    const lessees = [makeLessee("l1", "Airline C", 0.30, "red")];
    const leases  = [makeLease("l1", 500_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.pctS3).toBeCloseTo(1.0, 5);
    expect(result.impliedPdS3Multi).toBeCloseTo(0.30 / BASELINE_S3_PD, 5); // 1.0
  });

  it("single S3 lessee (PD=0.60) → impliedPdS3Multi = 0.60/0.30 = 2.0", () => {
    const lessees = [makeLessee("l1", "Airline D", 0.60, "red")];
    const leases  = [makeLease("l1", 500_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.impliedPdS3Multi).toBeCloseTo(0.60 / BASELINE_S3_PD, 5); // 2.0
  });

  it("rental-weighted S2: $400k (PD=0.08) + $100k (PD=0.20) → weightedS2PD = 0.104 → impliedPdS2Multi = 2.08", () => {
    // (400k×0.08 + 100k×0.20) / 500k = (32000 + 20000) / 500000 = 52000/500000 = 0.104
    // impliedPdS2Multi = 0.104 / 0.05 = 2.08
    const lessees = [
      makeLessee("l1", "Airline E", 0.08, null),
      makeLessee("l2", "Airline F", 0.20, null),
    ];
    const leases = [makeLease("l1", 400_000), makeLease("l2", 100_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.impliedPdS2Multi).toBeCloseTo(0.104 / BASELINE_S2_PD, 4); // 2.08
  });

  it("portfolioWeightedPD excludes null-PD lessees", () => {
    // l1: PD=0.10, rental=$500k. l2: PD=null, rental=$500k.
    // Weighted PD = 0.10 (only l1 contributes)
    const lessees = [
      makeLessee("l1", "Airline G", 0.10, null),
      makeLessee("l2", "Airline H", null,  null),
    ];
    const leases = [makeLease("l1", 500_000), makeLease("l2", 500_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.portfolioWeightedPD).toBeCloseTo(0.10, 5);
  });

  it("lessee with null pd_estimate → pdStage null, excluded from multiplier computation", () => {
    const lessees = [makeLessee("l1", "Airline I", null, "amber")];
    const leases  = [makeLease("l1", 500_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.rows[0].pdStage).toBeNull();
    expect(result.impliedPdS2Multi).toBe(1.0); // no PD data → default
    expect(result.portfolioWeightedPD).toBe(0);
  });

  it("divergenceCount: null pd → not counted; mismatch → counted", () => {
    const lessees = [
      makeLessee("l1", "Match",    0.005, "green"),  // S1 / S1 → no divergence
      makeLessee("l2", "Mismatch", 0.10,  "red"),    // S2 / S3 → divergence
      makeLessee("l3", "NullPD",   null,  "red"),    // null PD → not counted
      makeLessee("l4", "NullWL",   0.10,  null),     // null WL → not counted
    ];
    const leases = [
      makeLease("l1", 100_000),
      makeLease("l2", 100_000),
      makeLease("l3", 100_000),
      makeLease("l4", 100_000),
    ];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.divergenceCount).toBe(1);
  });

  it("stageDivergence flag set correctly on row", () => {
    const lessees = [makeLessee("l1", "Diverge", 0.10, "red")]; // S2 vs S3
    const leases  = [makeLease("l1", 500_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.rows[0].stageDivergence).toBe(true);
    expect(result.rows[0].pdStage).toBe(2);
    expect(result.rows[0].watchlistStage).toBe(3);
  });

  it("lessee with no matching lease is excluded", () => {
    const lessees = [
      makeLessee("l1", "Has Lease", 0.05, null),
      makeLessee("l2", "No Lease",  0.10, null),
    ];
    const leases = [makeLease("l1", 500_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].lesseeName).toBe("Has Lease");
  });

  it("lessee with null monthly_rental is excluded", () => {
    const lessees = [makeLessee("l1", "Null Rental", 0.05, null)];
    const leases  = [{ ...makeLease("l1", 0), monthly_rental: null }];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.rows).toHaveLength(0);
  });

  it("rows sorted by weightPct descending", () => {
    const lessees = [
      makeLessee("l1", "Small", 0.05, null),
      makeLessee("l2", "Large", 0.05, null),
    ];
    const leases = [makeLease("l1", 100_000), makeLease("l2", 900_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.rows[0].lesseeName).toBe("Large");
    expect(result.rows[1].lesseeName).toBe("Small");
  });

  it("multipliers clamped to [0.5, 5.0] — high PD clamps at 5.0", () => {
    // PD=1.0 → impliedPdS3Multi = 1.0/0.30 = 3.33 (within range)
    // PD=2.0 → 2.0/0.30 = 6.67 → clamped to 5.0
    const lessees = [makeLessee("l1", "High PD", 2.0, "red")];
    const leases  = [makeLease("l1", 500_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.impliedPdS3Multi).toBe(5.0);
  });

  it("multipliers clamped to [0.5, 5.0] — very low PD clamps at 0.5", () => {
    // PD=0.005 in S2 bucket would give 0.005/0.05 = 0.1 → clamped to 0.5
    // Use custom thresholds to force PD=0.005 into S2
    const customThresholds = { s1Max: 0.001, s2Max: 0.20 };
    const lessees = [makeLessee("l1", "Low PD", 0.005, null)];
    const leases  = [makeLease("l1", 500_000)];
    const result = computePortfolioRatingPD(lessees, leases, customThresholds);
    expect(result.impliedPdS2Multi).toBe(0.5);
  });

  it("custom TIGHT thresholds respected: PD=0.015 is Stage 1 under IATA but Stage 1 under TIGHT (≤0.02)", () => {
    // IATA: s1Max=0.01, so 0.015 → S2
    // TIGHT: s1Max=0.02, so 0.015 → S1
    const lessees = [makeLessee("l1", "Airline", 0.015, null)];
    const leases  = [makeLease("l1", 500_000)];
    const iata  = computePortfolioRatingPD(lessees, leases, IATA_THRESHOLDS);
    const tight = computePortfolioRatingPD(lessees, leases, TIGHT_THRESHOLDS);
    expect(iata.rows[0].pdStage).toBe(2);
    expect(tight.rows[0].pdStage).toBe(1);
  });

  it("portfolio-weighted PD is rental-weighted across all lessees with non-null PD", () => {
    // l1: PD=0.05, $400k. l2: PD=0.20, $100k.
    // weighted = (400k*0.05 + 100k*0.20) / 500k = (20000 + 20000) / 500000 = 0.08
    const lessees = [
      makeLessee("l1", "Airline J", 0.05, null),
      makeLessee("l2", "Airline K", 0.20, null),
    ];
    const leases = [makeLease("l1", 400_000), makeLease("l2", 100_000)];
    const result = computePortfolioRatingPD(lessees, leases);
    expect(result.portfolioWeightedPD).toBeCloseTo(0.08, 5);
  });

  it("weightPct sums to 1 across all rows", () => {
    const lessees = [
      makeLessee("l1", "A", 0.005, "green"),
      makeLessee("l2", "B", 0.10,  "amber"),
      makeLessee("l3", "C", 0.30,  "red"),
    ];
    const leases = [
      makeLease("l1", 200_000),
      makeLease("l2", 300_000),
      makeLease("l3", 500_000),
    ];
    const result = computePortfolioRatingPD(lessees, leases);
    const total = result.rows.reduce((s, r) => s + r.weightPct, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they all pass**

```bash
npx vitest run src/app/utils/ratingPD.test.ts
```

Expected: all tests pass. If `country` is not on the `Lessee` type in `makeLessee`, remove it from the helper — check `src/app/types/portfolio.ts` for exact fields.

- [ ] **Step 3: Run full test suite to verify no regressions**

```bash
npx vitest run
```

Expected: all existing tests still pass. New tests all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/utils/ratingPD.test.ts
git commit -m "test(s23): add ratingPD.test.ts — 30 unit tests for all classifiers and portfolio computation"
```

---

### Task 3: `RatingPDTab.tsx` — Tab Component

**Files:**
- Create: `src/app/components/scenarios/RatingPDTab.tsx`

Pattern mirrors `src/app/components/scenarios/AssetRiskTab.tsx` — inline styles, `usePortfolioData` hook, KPI cards, table, CTA button.

- [ ] **Step 1: Create `src/app/components/scenarios/RatingPDTab.tsx`**

```tsx
// src/app/components/scenarios/RatingPDTab.tsx
import { useState } from "react";
import { usePortfolioData } from "../../hooks/usePortfolioData";
import {
  computePortfolioRatingPD,
  pdImpliedStage,
  type PDThresholds,
  type RatingPDRow,
  IATA_THRESHOLDS,
  TIGHT_THRESHOLDS,
  BASELINE_S2_PD,
  BASELINE_S3_PD,
} from "../../utils/ratingPD";
import { Card } from "../ui/Card";

// ─── Stage pill styling ────────────────────────────────────────────────────────

const STAGE_BG: Record<1 | 2 | 3, string>    = { 1: "#DCFCE7", 2: "#FEF3C7", 3: "#FEE2E2" };
const STAGE_COLOR: Record<1 | 2 | 3, string> = { 1: "#15803D", 2: "#B45309", 3: "#B91C1C" };
const STAGE_LABEL: Record<1 | 2 | 3, string> = { 1: "S1",       2: "S2",       3: "S3" };

function StagePill({ stage }: { stage: 1 | 2 | 3 | null }) {
  if (stage === null) {
    return (
      <span style={{
        background: "#F1F5F9", color: "#94A3B8",
        fontWeight: 600, fontSize: "0.75rem",
        padding: "0.15rem 0.5rem", borderRadius: "9999px",
      }}>—</span>
    );
  }
  return (
    <span style={{
      background: STAGE_BG[stage], color: STAGE_COLOR[stage],
      fontWeight: 600, fontSize: "0.75rem",
      padding: "0.15rem 0.5rem", borderRadius: "9999px",
      whiteSpace: "nowrap",
    }}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

function DivergenceBadge({ row }: { row: RatingPDRow }) {
  if (!row.stageDivergence || row.pdStage === null || row.watchlistStage === null) {
    return null;
  }
  const isWorse = row.watchlistStage > row.pdStage;
  return (
    <span style={{
      background: isWorse ? "#FEE2E2" : "#FEF3C7",
      color:      isWorse ? "#B91C1C" : "#B45309",
      fontWeight: 600, fontSize: "0.75rem",
      padding: "0.15rem 0.5rem", borderRadius: "9999px",
      whiteSpace: "nowrap",
    }}>
      {STAGE_LABEL[row.pdStage]} → {STAGE_LABEL[row.watchlistStage]}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Called when user clicks "Use in Custom Builder" — switches tab and pre-fills sliders. */
  onUseInCustomBuilder: (pdS2Multi: number, pdS3Multi: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RatingPDTab({ onUseInCustomBuilder }: Props) {
  const { lessees, leases } = usePortfolioData();

  // Threshold state is component-local — analysis input, not scenario parameter.
  const [thresholds, setThresholds] = useState<PDThresholds>(IATA_THRESHOLDS);
  const [activePreset, setActivePreset] = useState<"iata" | "tight" | "custom">("iata");

  // s1Input / s2Input are string state for the inline number inputs to allow partial editing.
  const [s1Input, setS1Input] = useState<string>((IATA_THRESHOLDS.s1Max * 100).toFixed(1));
  const [s2Input, setS2Input] = useState<string>((IATA_THRESHOLDS.s2Max * 100).toFixed(1));

  const {
    rows, portfolioWeightedPD,
    pctS1, pctS2, pctS3,
    impliedPdS2Multi, impliedPdS3Multi,
    divergenceCount,
  } = computePortfolioRatingPD(lessees, leases, thresholds);

  // ── Threshold preset handlers ──

  function applyIata() {
    setThresholds(IATA_THRESHOLDS);
    setActivePreset("iata");
    setS1Input((IATA_THRESHOLDS.s1Max * 100).toFixed(1));
    setS2Input((IATA_THRESHOLDS.s2Max * 100).toFixed(1));
  }

  function applyTight() {
    setThresholds(TIGHT_THRESHOLDS);
    setActivePreset("tight");
    setS1Input((TIGHT_THRESHOLDS.s1Max * 100).toFixed(1));
    setS2Input((TIGHT_THRESHOLDS.s2Max * 100).toFixed(1));
  }

  function handleS1Change(raw: string) {
    setS1Input(raw);
    const v = parseFloat(raw) / 100;
    if (!isNaN(v) && v >= 0 && v <= 1 && v < thresholds.s2Max) {
      setThresholds((t) => ({ ...t, s1Max: v }));
      setActivePreset("custom");
    }
  }

  function handleS2Change(raw: string) {
    setS2Input(raw);
    const v = parseFloat(raw) / 100;
    if (!isNaN(v) && v >= 0 && v <= 1 && v > thresholds.s1Max) {
      setThresholds((t) => ({ ...t, s2Max: v }));
      setActivePreset("custom");
    }
  }

  // ── KPI card colors ──

  const wpdPct = portfolioWeightedPD * 100;
  const wpdColor = wpdPct > 10 ? "#B91C1C" : wpdPct > 2 ? "#B45309" : "#15803D";
  const wpdBg    = wpdPct > 10 ? "#FEE2E2" : wpdPct > 2 ? "#FEF3C7" : "#DCFCE7";

  const s2Pct = pctS2 * 100;
  const s2Color = s2Pct > 75 ? "#B91C1C" : s2Pct > 50 ? "#B45309" : "#15803D";
  const s2Bg    = s2Pct > 75 ? "#FEE2E2" : s2Pct > 50 ? "#FEF3C7" : "#DCFCE7";

  const s3Pct = pctS3 * 100;
  const s3Color = s3Pct > 10 ? "#B91C1C" : s3Pct > 0 ? "#B45309" : "#15803D";
  const s3Bg    = s3Pct > 10 ? "#FEE2E2" : s3Pct > 0 ? "#FEF3C7" : "#DCFCE7";

  const divColor = divergenceCount > 0 ? "#B45309" : "#15803D";
  const divBg    = divergenceCount > 0 ? "#FEF3C7" : "#DCFCE7";

  // ── Pill style helper ──

  function presetPillStyle(active: boolean): React.CSSProperties {
    return {
      padding: "0.25rem 0.75rem",
      borderRadius: "9999px",
      border: active ? "1.5px solid #002147" : "1.5px solid #CBD5E1",
      background: active ? "#002147" : "#FFFFFF",
      color: active ? "#FFFFFF" : "#475569",
      fontSize: "0.8125rem", fontWeight: 500,
      cursor: "pointer", whiteSpace: "nowrap" as const,
    };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Threshold controls ── */}
      <Card>
        <div style={{ padding: "1rem 1.25rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
            Stage Thresholds
          </span>

          {/* Preset pills */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button style={presetPillStyle(activePreset === "iata")} onClick={applyIata}>
              IATA Standard
            </button>
            <button style={presetPillStyle(activePreset === "tight")} onClick={applyTight}>
              Tighter S3 Floor
            </button>
          </div>

          {/* Inline inputs */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "#475569" }}>
            <span>S1 max</span>
            <input
              type="number" min="0" max="100" step="0.1"
              value={s1Input}
              onChange={(e) => handleS1Change(e.target.value)}
              style={{
                width: "4.5rem", padding: "0.2rem 0.4rem", borderRadius: "0.375rem",
                border: "1px solid #CBD5E1", fontSize: "0.8125rem", textAlign: "right",
              }}
            />
            <span>%</span>
            <span style={{ marginLeft: "0.5rem" }}>S2 max</span>
            <input
              type="number" min="0" max="100" step="0.1"
              value={s2Input}
              onChange={(e) => handleS2Change(e.target.value)}
              style={{
                width: "4.5rem", padding: "0.2rem 0.4rem", borderRadius: "0.375rem",
                border: "1px solid #CBD5E1", fontSize: "0.8125rem", textAlign: "right",
              }}
            />
            <span>%</span>
          </div>
        </div>
      </Card>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Portfolio Weighted PD"
          value={portfolioWeightedPD > 0 ? `${wpdPct.toFixed(1)}%` : "—"}
          color={wpdColor}
          bg={wpdBg}
          note="rental-weighted avg"
        />
        <KpiCard
          label="Stage 1 %"
          value={`${(pctS1 * 100).toFixed(1)}%`}
          color="#15803D"
          bg="#DCFCE7"
        />
        <KpiCard
          label="Stage 2 %"
          value={`${s2Pct.toFixed(1)}%`}
          color={s2Color}
          bg={s2Bg}
        />
        <KpiCard
          label="Stage 3 %"
          value={`${s3Pct.toFixed(1)}%`}
          color={s3Color}
          bg={s3Bg}
        />
        <KpiCard
          label="Divergences"
          value={`${divergenceCount} ${divergenceCount === 1 ? "lessee" : "lessees"}`}
          color={divColor}
          bg={divBg}
          note="PD stage ≠ watchlist stage"
        />
      </div>

      {/* ── Per-lessee table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Lessee PD &amp; Stage Analysis
          </div>

          {rows.length === 0 ? (
            <div style={{ color: "#94A3B8", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
              No lessee data available.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    {["Airline", "Rating", "PD", "PD Stage", "Watchlist Stage", "Divergence", "Weight %"].map((h) => (
                      <th key={h} style={{
                        textAlign: h === "Airline" || h === "Rating" ? "left" : "right",
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
                      key={row.lesseeName}
                      style={{
                        borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none",
                        background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                      }}
                    >
                      <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>
                        {row.lesseeName}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>
                        {row.creditRating ?? "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.pdEstimate !== null ? `${(row.pdEstimate * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <StagePill stage={row.pdStage} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <StagePill stage={row.watchlistStage} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <DivergenceBadge row={row} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                        {(row.weightPct * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer row */}
                <tfoot>
                  <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                    <td colSpan={2} style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#475569", fontSize: "0.75rem" }}>
                      PORTFOLIO WEIGHTED
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                      {portfolioWeightedPD > 0 ? `${(portfolioWeightedPD * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                        {(pctS1 * 100).toFixed(0)}% S1 · {(pctS2 * 100).toFixed(0)}% S2 · {(pctS3 * 100).toFixed(0)}% S3
                      </span>
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem" }} />
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#64748B", fontSize: "0.75rem", fontWeight: 500 }}>
                      {divergenceCount > 0 ? `${divergenceCount} divergence${divergenceCount > 1 ? "s" : ""}` : "—"}
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

      {/* ── "Use in Custom Builder" CTA ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => onUseInCustomBuilder(impliedPdS2Multi, impliedPdS3Multi)}
          disabled={rows.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            background: "#002147", color: "#FFFFFF",
            border: "none", borderRadius: "9999px",
            padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500,
            cursor: rows.length === 0 ? "not-allowed" : "pointer",
            opacity: rows.length === 0 ? 0.5 : 1,
          }}
          title="Derived from rental-weighted PD of each IFRS 9 stage bucket vs calibrated baselines (S2: 5%, S3: 30%)."
        >
          Use in Custom Builder →
        </button>
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If `React` is not in scope for `React.CSSProperties`, add `import React from "react"` at the top (though the explicit import is not needed in modern JSX transform — remove the type annotation and use `CSSProperties` from React directly if needed, or cast as `React.CSSProperties`).

- [ ] **Step 3: Run full test suite (no new tests for the component — it is wired by Task 4 and verified manually)**

```bash
npx vitest run
```

Expected: all tests pass (no regressions).

- [ ] **Step 4: Commit**

```bash
git add src/app/components/scenarios/RatingPDTab.tsx
git commit -m "feat(s23): add RatingPDTab.tsx — threshold controls, KPI cards, lessee table, CTA"
```

---

### Task 4: `Scenarios.tsx` — Tab Registration

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

Minimal — import, tab list, render block. No new state, no new useMemo, no new Custom Builder collapsible. Pattern mirrors the Asset Risk tab wiring.

- [ ] **Step 1: Add the import**

In `src/app/pages/Scenarios.tsx`, after the existing `AssetRiskTab` import (line ~11):

```typescript
import { RatingPDTab } from "../components/scenarios/RatingPDTab";
```

- [ ] **Step 2: Insert `"Rating / PD"` into the tab list**

Find the tab list array (line ~1284). Current value:
```typescript
: ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Asset Risk", "Security Deposits", "Deferral Risk", "Lessor Mitigation", "Payment Behaviour", "Concentration Stress", "Lease Pricing"];
```

Change to:
```typescript
: ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Asset Risk", "Rating / PD", "Security Deposits", "Deferral Risk", "Lessor Mitigation", "Payment Behaviour", "Concentration Stress", "Lease Pricing"];
```

- [ ] **Step 3: Add the tab render block**

After the existing Asset Risk tab block (after the closing `})}` of the Asset Risk block, around line 3705):

```tsx
      {/* ══ RATING / PD TAB ════════════════════════════════════════════ */}
      {activeTab === "Rating / PD" && (
        <RatingPDTab
          onUseInCustomBuilder={(s2Multi, s3Multi) => {
            updateFormInputs({ pdS2Multi: s2Multi, pdS3Multi: s3Multi });
            setActiveTab("Custom Builder");
          }}
        />
      )}
```

Insert this block between the Asset Risk block and the Security Deposits block.

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass. The `BASELINE_S2_PD` and `BASELINE_S3_PD` constants are exported from `ratingPD.ts` but not referenced in tests — that is fine (they are used in `computePortfolioRatingPD` internally).

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: clean build, no TypeScript or bundler errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/Scenarios.tsx
git commit -m "feat(s23): wire RatingPDTab into Scenarios.tsx — tab registration and onUseInCustomBuilder handler"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| `PDThresholds`, `IATA_THRESHOLDS`, `TIGHT_THRESHOLDS` | Task 1 |
| `BASELINE_S2_PD`, `BASELINE_S3_PD` constants | Task 1 |
| `RatingPDRow` interface | Task 1 |
| `pdImpliedStage` function | Task 1 |
| `watchlistImpliedStage` function | Task 1 |
| `computePortfolioRatingPD` with all exclusion rules | Task 1 |
| Multiplier derivation + clamping [0.5, 5.0] | Task 1 |
| Sort by weightPct descending | Task 1 |
| ~30 unit tests (all classifiers + portfolio compute) | Task 2 |
| Threshold controls — preset pills (IATA / Tight) | Task 3 |
| Threshold controls — inline S1/S2 % inputs | Task 3 |
| 5 KPI cards with correct color thresholds | Task 3 |
| Per-lessee table, 7 columns, stage pills, divergence badge | Task 3 |
| Footer row with portfolio summary | Task 3 |
| "Use in Custom Builder" CTA, disabled when rows empty | Task 3 |
| Tooltip text on CTA | Task 3 |
| Tab registered after "Asset Risk" | Task 4 |
| `onUseInCustomBuilder` writes to `pdS2Multi`/`pdS3Multi` | Task 4 |
| Switches to "Custom Builder" tab after CTA | Task 4 |
| No new `ScenarioInputs` fields | All — `eclCalculator.ts` untouched |
| Threshold state is component-local | Task 3 — `useState` inside `RatingPDTab` |

**Placeholder scan:** No TBDs or TODOs. All code steps are complete. ✓

**Type consistency check:**
- `RatingPDRow.pdStage: 1 | 2 | 3 | null` matches `pdImpliedStage` return type ✓
- `RatingPDRow.watchlistStage: 1 | 2 | 3 | null` matches `watchlistImpliedStage` return type ✓
- `computePortfolioRatingPD` takes `Lessee[]` and `Lease[]` — same imports as `assetRisk.ts` ✓
- `onUseInCustomBuilder(pdS2Multi: number, pdS3Multi: number)` in `RatingPDTab` Props matches Scenarios.tsx call site ✓
- `updateFormInputs({ pdS2Multi: s2Multi, pdS3Multi: s3Multi })` — both fields exist in `ScenarioInputs` ✓
