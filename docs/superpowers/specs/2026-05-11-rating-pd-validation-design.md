# Rating / PD Validation Tab — Design Spec

**Date:** 2026-05-11
**Sprint:** 23

---

## Goal

Add a "Rating / PD" analysis tab to the ECL Scenario Builder. Each lessee's `pd_estimate` and `watchlist_status` are mapped to an implied IFRS 9 stage. A per-lessee table shows PD-implied stage alongside watchlist-implied stage so divergences are immediately visible. Portfolio-level KPIs surface weighted PD and stage breakdown. A "Use in Custom Builder" CTA derives `pdS2Multi` / `pdS3Multi` from actual rental-weighted PD data and pre-fills the existing macro sliders — closing the gap between real portfolio credit quality and the scenario stress parameters.

---

## Architecture

Four files. No changes to `eclCalculator.ts` — the tab pre-fills the *existing* `pdS2Multi` / `pdS3Multi` fields; no new `ScenarioInputs` fields are needed.

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/utils/ratingPD.ts` | **Create** | Pure functions: `pdImpliedStage`, `watchlistImpliedStage`, `computePortfolioRatingPD` |
| `src/app/utils/ratingPD.test.ts` | **Create** | Unit tests for all pure functions |
| `src/app/components/scenarios/RatingPDTab.tsx` | **Create** | Threshold controls, KPI cards, lessee table, CTA |
| `src/app/pages/Scenarios.tsx` | **Modify** | Tab registration + `onUseInCustomBuilder` handler only |

**Key design decision — threshold state is component-local.** Thresholds are analysis inputs (how to read the data), not scenario parameters (how to stress it). They must not appear in the DSL JSON export or affect `computeECLFromBase`. Local `useState` inside `RatingPDTab` is correct; `computePortfolioRatingPD` re-runs on every threshold change via normal React rendering.

---

## Data Model

### No new `ScenarioInputs` fields

`pdS2Multi` and `pdS3Multi` already exist in `ScenarioInputs` (Sprint baseline). The tab's "Use in Custom Builder" action writes to these existing fields. `eclCalculator.ts` is not touched.

### `PDThresholds`

```typescript
export interface PDThresholds {
  s1Max: number;  // PD ≤ s1Max → Stage 1 (e.g. 0.01)
  s2Max: number;  // s1Max < PD ≤ s2Max → Stage 2; PD > s2Max → Stage 3
}

export const IATA_THRESHOLDS: PDThresholds  = { s1Max: 0.01, s2Max: 0.20 };
export const TIGHT_THRESHOLDS: PDThresholds = { s1Max: 0.02, s2Max: 0.15 };
```

### Baseline PD rates (anchored to base ECL)

```typescript
/** Rental-weighted S2 PD that corresponds to pdS2Multi = 1.0 in the base ECL ($47.2M). */
export const BASELINE_S2_PD = 0.05;  // 5%

/** Rental-weighted S3 PD that corresponds to pdS3Multi = 1.0 in the base ECL ($47.2M). */
export const BASELINE_S3_PD = 0.30;  // 30%
```

Implied multiplier derivation:
- `impliedPdS2Multi = rentalWeightedAvgPD(S2 bucket) / BASELINE_S2_PD`
- `impliedPdS3Multi = rentalWeightedAvgPD(S3 bucket) / BASELINE_S3_PD`
- If a stage bucket is empty: that multiplier stays at `1.0` (no stress above baseline).

### `RatingPDRow`

```typescript
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
```

---

## `ratingPD.ts` — Pure Utility

### Classifiers

```typescript
/**
 * Map a lessee's pd_estimate to an IFRS 9 stage using configurable thresholds.
 * Returns null if pd is null (no data).
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
```

### `computePortfolioRatingPD`

```typescript
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
  impliedPdS2Multi:    number;   // ≥ 1.0 (1.0 = S2 bucket empty or at baseline)
  impliedPdS3Multi:    number;   // ≥ 1.0 (1.0 = S3 bucket empty or at baseline)
  divergenceCount:     number;   // lessees where pdStage ≠ watchlistStage (both non-null)
}
```

**Exclusion rules (same as every other portfolio utility):**
- Lessee with no matching lease → excluded entirely
- Lessee with null or zero `monthly_rental` → excluded entirely
- Null `pd_estimate` → included in table (`pdStage: null`), excluded from `portfolioWeightedPD` and multiplier computation
- Null `watchlist_status` → included in table (`watchlistStage: null`), not counted as divergence

**Multiplier clamping:** `impliedPdS2Multi` and `impliedPdS3Multi` are clamped to `[0.5, 5.0]` to prevent extreme values from null-heavy portfolios propagating to the ECL formula.

**Sort:** rows sorted by `weightPct` descending.

---

## `RatingPDTab.tsx` — Component

### Threshold Controls (top of tab)

Local state: `thresholds: PDThresholds` (default `IATA_THRESHOLDS`), `activePreset: "iata" | "tight" | "custom"` (default `"iata"`).

- **Preset pills:** "IATA Standard" and "Tighter S3 Floor" — clicking a pill sets `thresholds` to the matching constant and `activePreset` to `"iata"` / `"tight"`
- **Inline number inputs:** S1 max % and S2 max % — editing either sets `activePreset` to `"custom"` and updates `thresholds` accordingly
- Validation: S1 max must be < S2 max; inputs outside 0–100% are ignored

### KPI Cards (5)

| Card | Value | Color thresholds |
|------|-------|------------------|
| Portfolio Weighted PD | `X.X%` or `—` | green ≤2%, amber ≤10%, red >10% |
| Stage 1 % | `X.X%` | always green / `#DCFCE7` |
| Stage 2 % | `X.X%` | green ≤50%, amber ≤75%, red >75% |
| Stage 3 % | `X.X%` | green =0%, amber ≤10%, red >10% |
| Divergences | `N lessees` | green =0, amber >0 |

### Per-Lessee Table (7 columns)

`Airline · Rating · PD · PD Stage · Watchlist Stage · Divergence · Weight %`

- **PD Stage / Watchlist Stage:** coloured stage pills — S1 green, S2 amber, S3 red; `"—"` pill (neutral) when null
- **Divergence column:** blank when stages match (or either is null); `"S2 → S3"` style badge (amber/red pill showing the direction of the gap) when they differ
- Footer row: portfolio-weighted PD, stage mix summary, divergence count, `100.0%`

### "Use in Custom Builder" CTA

```typescript
interface Props {
  onUseInCustomBuilder: (pdS2Multi: number, pdS3Multi: number) => void;
}
```

Button disabled when `rows.length === 0`.
Title tooltip: `"Derived from rental-weighted PD of each IFRS 9 stage bucket vs calibrated baselines (S2: 5%, S3: 30%)."`

---

## `Scenarios.tsx` — Changes

Minimal. No new state, no new useMemo, no new Custom Builder collapsible.

### Import
```typescript
import { RatingPDTab } from "../components/scenarios/RatingPDTab";
```

### Tab list
Insert `"Rating / PD"` after `"Asset Risk"`:
```
[..., "Jurisdiction Risk", "Asset Risk", "Rating / PD", "Security Deposits", ...]
```

### Tab render block
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

No auto-expand needed — `pdS2Multi`/`pdS3Multi` are in the top-level macro section of the Custom Builder, which is always visible.

---

## Testing

### `ratingPD.test.ts` — target ~30 tests

**`pdImpliedStage`** (IATA thresholds):
- PD = null → null
- PD = 0.005 → Stage 1 (≤1%)
- PD = 0.01 → Stage 1 (at boundary)
- PD = 0.011 → Stage 2 (just above S1 max)
- PD = 0.20 → Stage 2 (at S2 max)
- PD = 0.21 → Stage 3

**`watchlistImpliedStage`:**
- null → 1; "green" → 1; "amber" → 2; "red" → 3

**`computePortfolioRatingPD`:**
- Empty inputs → all zeros, empty rows
- Single S1 lessee → pctS1=1, impliedPdS2Multi=1.0, impliedPdS3Multi=1.0
- Single S2 lessee (PD=0.10) → impliedPdS2Multi = 0.10/0.05 = 2.0
- Single S3 lessee (PD=0.30) → impliedPdS3Multi = 0.30/0.30 = 1.0
- Single S3 lessee (PD=0.60) → impliedPdS3Multi = 0.60/0.30 = 2.0
- Rental-weighted: S2 $400k (PD=0.08) + S2 $100k (PD=0.20) → weightedS2PD = (400k×0.08+100k×0.20)/500k = 0.104 → impliedPdS2Multi = 0.104/0.05 = 2.08
- portfolioWeightedPD excludes null-PD lessees
- divergenceCount correct: null pd_estimate → not counted; mismatch → counted
- Lessee with null pd_estimate → pdStage null, excluded from weighted PD
- No matching lease → excluded
- Null rental → excluded
- Rows sorted by weightPct descending
- Multipliers clamped to [0.5, 5.0]
- Custom thresholds respected (Tight: s1Max=0.02 → PD=0.015 is Stage 2, not Stage 1)

---

## Non-Goals

- No new `ScenarioInputs` fields
- No DSL changes
- No Custom Builder collapsible for this tab (existing macro sliders handle it)
- No stage migration rate modelling (Sprint 24 candidate)
- No historical stage tracking or trend lines
