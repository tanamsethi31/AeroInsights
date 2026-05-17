# LGD with Aircraft Value Decay — Design Spec

**Date:** 2026-05-17  
**Feature:** LGD Benchmarks from Aircraft Value Decay Curves  
**Tier:** 2 — Major differentiator

---

## Goal

Replace the crude 3-tier `vintageAdjFactor` in the ECL engine with calibrated aircraft value decay curves by family (narrowbody / widebody / regional), and surface per-aircraft LGD benchmarks across the Portfolio and Risk & ECL pages. Answers the auditor question "where does your LGD come from?" with the same sourced, overridable answer as the PD curves feature.

---

## Background & Competitive Context

The existing `vintageAdjFactor` in `ScenarioInputs` uses three buckets (young/mid/aged → 0%/4%/10% of baseECL) computed by `computePortfolioAssetRisk()` in `assetRisk.ts`. These are heuristics with no published source. Aircraft lessors and IFRS 9 auditors expect LGD to be grounded in residual value curves — the standard industry approach used by AVAC, Cirium, and mba Aviation. This feature upgrades the ECL engine to use calibrated decay curves while surfacing the derived LGD benchmarks per-aircraft, giving clients a defensible end-to-end ECL story.

---

## Architecture

Six layers. ECL formula itself is **untouched** — only the input feeding the vintage/LGD slot is upgraded:

1. **Constants layer** — `src/app/data/lgdCurves.ts`: `AircraftFamily` type, residual value schedules at 6 key ages per family, `DEFAULT_RECOVERY_FACTOR`, pure functions `computeResidualValuePct()`, `computeLgdBenchmark()`, `computeFleetLgdAdjustment()`
2. **Family classifier** — `src/app/data/aircraftFamilyMap.ts`: maps `asset.aircraft_type` strings to `AircraftFamily`; unknown types default to `narrowbody`
3. **Supabase layer** — `supabase/migrations/004_lgd_curves.sql`: `lgd_recovery_overrides` table (one row per org)
4. **Hook** — `src/app/hooks/useLgdCurves.ts`: loads firm recovery factor override, exposes `saveRecoveryOverride` and `resetToDefault`
5. **ECL engine** — `src/app/utils/eclCalculator.ts` + `src/app/utils/assetRisk.ts`: rename `vintageAdjFactor` → `lgdDecayAdjFactor`; rewrite `computePortfolioAssetRisk()` to use decay curves
6. **UI** — `LgdBenchmarkPanel` per asset on Portfolio page; `LgdDecaySummaryCard` on Risk & ECL page; `RecoveryFactorDrawer` firm-level override

No new routes. No changes to `Provision.lgd` field. PD × LGD × EAD formula unchanged.

---

## Calibrated Residual Value Curves

### Methodology

Through-the-cycle residual value estimates as % of original base value, derived from:

- **AVAC Aircraft Value Reference 2023** — published half-life values and value retention curves for NB/WB/Regional cohorts
- **Cirium Fleets Analyzer 2023** — NB value cohort study 1990–2023; WB value cohort 1995–2023
- **Boeing/Airbus residual value studies** — manufacturer published residual value projections for in-production programmes

Half-life is the age at which an aircraft reaches approximately 50% of its original base value — the standard appraisal anchor used by AVAC, mba Aviation, and Collateral Veritas.

Linear interpolation between key ages. Values beyond age 25yr clamp to the age-25 floor. Negative age (data anomaly) returns 100%.

### Default Values

| Age | Narrowbody (half-life ~12yr) | Widebody (half-life ~15yr) | Regional (half-life ~10yr) |
|-----|-----|-----|-----|
| 0yr | 1.000 | 1.000 | 1.000 |
| 5yr | 0.780 | 0.820 | 0.680 |
| 10yr | 0.580 | 0.650 | 0.420 |
| 15yr | 0.380 | 0.470 | 0.220 |
| 20yr | 0.220 | 0.280 | 0.110 |
| 25yr | 0.120 | 0.140 | 0.050 |

**Family calibration rationale:**

- **Narrowbody** (A318/A319/A320/A321 all variants incl. neo/ceo, B737-600/700/800/900/MAX, A220-100/300, E190-E2, E195-E2): Deep secondary market, strong lessor demand, half-life ~12yr. Calibrated to AVAC NB cohort weighted average.
- **Widebody** (A330-200/300/900, A350-900/1000, B777-200/300/300ER, B787-8/9/10, A380): Thinner secondary market than NB, higher absolute values, slower initial depreciation but steeper mid-life cliff. A380 treated as widebody (conservative). Half-life ~15yr.
- **Regional** (E170/E175/E190/E195 V1, CRJ-700/900/1000, ATR 42/72, Q400, Dash 8): Thinnest secondary market, limited operator base, highest depreciation rate. Half-life ~10yr. Calibrated to AVAC regional cohort with thin-market premium applied.

### Recovery Factor

```
DEFAULT_RECOVERY_FACTOR = 0.72
```

Derived from through-the-cycle average of net lessor recovery proceeds as % of aircraft market value:

- Remarketing / brokerage: ~5%
- Storage, maintenance reserve burn, ferry: ~8%
- Legal / enforcement / jurisdiction costs: ~5%
- Insurance / repossession logistics: ~2%
- Uncertainty / cycle buffer (incl. COVID-2020 stressed remarketing): ~8%
- **Total cost load: ~28% → net recovery: 72%**

Source: AVAC through-the-cycle remarketing cost studies; mba Aviation lessor recovery data 2000–2023.

### LGD Formula

```
LGD = max(0.05, 1 − residualValuePct × recoveryFactor)
```

Floor of 5% — even new aircraft carry non-recoverable transaction costs. Example outputs at default recovery factor:

| Aircraft | Age | Residual Value % | LGD Benchmark |
|----------|-----|-----------------|---------------|
| New NB | 0yr | 100% | 28.0% |
| 5yr NB | 5yr | 78% | 43.8% |
| 10yr NB | 10yr | 58% | 58.2% |
| 10yr WB | 10yr | 65% | 53.2% |
| 15yr Regional | 15yr | 22% | 84.2% |
| 20yr NB | 20yr | 22% | 84.2% |

### Fleet LGD Adjustment (replaces `vintageAdjFactor`)

```
lgdDecayAdjFactor = clamp(fleetEadWeightedLgd − DEFAULT_BASELINE_LGD, 0, 0.50)
```

Where `DEFAULT_BASELINE_LGD = 0.28` (LGD at age 0, default recovery factor). EAD-weighted across all assets; provisions with null EAD fall back to equal weighting. Result clamped to `[0, 0.50]`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/data/lgdCurves.ts` | **Create** | `AircraftFamily` type, `ResidualValueSchedule` interface, `DEFAULT_RESIDUAL_CURVES`, `DEFAULT_RECOVERY_FACTOR`, `DEFAULT_BASELINE_LGD`, `computeResidualValuePct()`, `computeLgdBenchmark()`, `computeFleetLgdAdjustment()` |
| `src/app/data/lgdCurves.test.ts` | **Create** | Unit tests: interpolation, LGD formula, fleet adjustment, bounds/monotonicity |
| `src/app/data/aircraftFamilyMap.ts` | **Create** | `classifyAircraftFamily(aircraftType: string): AircraftFamily`; known type mappings; unknown → narrowbody fallback |
| `src/app/data/aircraftFamilyMap.test.ts` | **Create** | Known types map correctly; unknown defaults to narrowbody |
| `supabase/migrations/004_lgd_curves.sql` | **Create** | `lgd_recovery_overrides` table |
| `src/app/hooks/useLgdCurves.ts` | **Create** | Load/save firm recovery factor override |
| `src/app/utils/assetRisk.ts` | **Modify** | Rewrite `computePortfolioAssetRisk()` to use decay curves; add `recoveryFactor` param; return `lgdDecayAdjFactor` + `perAssetLgd` map |
| `src/app/utils/assetRisk.test.ts` | **Modify** | Add cases for new `computePortfolioAssetRisk()` signature |
| `src/app/utils/eclCalculator.ts` | **Modify** | Rename `vintageAdjFactor` → `lgdDecayAdjFactor` in `ScenarioInputs`; update formula line |
| `src/app/components/scenarios/AssetRiskTab.tsx` | **Modify** | Update destructuring from `vintageAdjFactor` → `lgdDecayAdjFactor`; pass `recoveryFactor` to `computePortfolioAssetRisk()` |
| `src/app/pages/Scenarios.tsx` | **Modify** | Update `computePortfolioAssetRisk()` call to pass `recoveryFactor`; update `vintageAdjFactor` → `lgdDecayAdjFactor` reference |
| `src/app/components/portfolio/LgdBenchmarkPanel.tsx` | **Create** | Per-asset LGD benchmark panel |
| `src/app/components/risk-ecl/LgdDecaySummaryCard.tsx` | **Create** | Fleet LGD breakdown table + summary for Risk & ECL page |
| `src/app/components/risk-ecl/RecoveryFactorDrawer.tsx` | **Create** | Firm-level recovery factor override drawer |
| `src/app/pages/Portfolio.tsx` | **Modify** | Mount `useLgdCurves()`, pass `perAssetLgd` to `LgdBenchmarkPanel` per asset |
| `src/app/pages/RiskECL.tsx` | **Modify** | Mount `useLgdCurves()`, add `LgdDecaySummaryCard`, wire `lgdDecayAdjFactor` into scenario inputs |

---

## Data Model

### Types (`src/app/data/lgdCurves.ts`)

```typescript
export type AircraftFamily = "narrowbody" | "widebody" | "regional";

export const AIRCRAFT_FAMILY_LABELS: Record<AircraftFamily, string> = {
  narrowbody: "Narrowbody",
  widebody:   "Widebody",
  regional:   "Regional Jet",
};

export interface ResidualValueSchedule {
  /** Residual value as fraction of original base value at key ages */
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
```

### Pure Functions (`src/app/data/lgdCurves.ts`)

```typescript
/**
 * Linearly interpolate residual value % at a given age.
 * Clamps to age-25 floor for older aircraft; returns 1.0 for age < 0.
 */
export function computeResidualValuePct(
  family: AircraftFamily,
  ageYears: number,
): number

/**
 * Derive LGD benchmark from residual value % and recovery factor.
 * LGD = max(0.05, 1 - residualValuePct * recoveryFactor)
 */
export function computeLgdBenchmark(
  family: AircraftFamily,
  ageYears: number,
  recoveryFactor: number,
): number

/**
 * Compute fleet-weighted LGD adjustment for ECL engine.
 * Returns lgdDecayAdjFactor = clamp(fleetWeightedLgd - DEFAULT_BASELINE_LGD, 0, 0.50)
 * and a per-asset LGD map keyed by asset_id.
 */
export function computeFleetLgdAdjustment(
  assets: Asset[],
  provisions: Provision[],
  recoveryFactor: number,
  reportingYear?: number,
): { lgdDecayAdjFactor: number; perAssetLgd: Map<string, number> }
```

### Supabase Migration (`supabase/migrations/004_lgd_curves.sql`)

```sql
-- lgd decay curves: firm-level recovery factor overrides
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

### Aircraft Family Classifier (`src/app/data/aircraftFamilyMap.ts`)

```typescript
export function classifyAircraftFamily(aircraftType: string): AircraftFamily
```

Matching is case-insensitive prefix/substring. Coverage:

- **Narrowbody:** A318, A319, A320, A321 (all variants), B737-600/700/800/900/MAX (all variants), A220-100/300, E190-E2, E195-E2
- **Widebody:** A330-200/300/900, A350-900/1000, B777-200/300/300ER, B787-8/9/10, A380
- **Regional:** E170, E175, E190, E195 (V1 generation), CRJ-700/900/1000, ATR 42, ATR 72, Q400, Dash 8

Unknown type → `"narrowbody"` with `console.warn`.

---

## Hook (`src/app/hooks/useLgdCurves.ts`)

```typescript
export interface LgdCurvesState {
  recoveryFactor:       number;   // effective (firm override or default)
  isOverridden:         boolean;
  loading:              boolean;
  saveRecoveryOverride: (factor: number, notes?: string, updatedBy?: string) => Promise<void>;
  resetToDefault:       () => Promise<void>;
}
```

Fetches `lgd_recovery_overrides` for current `org_id` on mount. Falls back to `DEFAULT_RECOVERY_FACTOR` when no org (demo mode) or on error. `saveRecoveryOverride` upserts the single row. `resetToDefault` deletes it. Both re-fetch after completion. Includes stale-closure cancellation guard (same pattern as `usePdCurves`).

---

## ECL Engine Changes

### `ScenarioInputs` (`src/app/utils/eclCalculator.ts`)

Rename `vintageAdjFactor` → `lgdDecayAdjFactor`. No other changes to the interface or formula. The formula line:

```typescript
// Before
const vintageLGDDelta = inputs.vintageAdjFactor * baseECL;

// After
const lgdDecayDelta = inputs.lgdDecayAdjFactor * baseECL;
```

Default value in scenario presets: computed by `computeFleetLgdAdjustment()` when asset data is available; `0` otherwise.

### `computePortfolioAssetRisk()` (`src/app/utils/assetRisk.ts`)

New signature:

```typescript
export function computePortfolioAssetRisk(
  assets: Asset[],
  leases: Lease[],
  recoveryFactor: number,
  referenceYear?: number,   // defaults to current year
  provisions?: Provision[], // optional; enables EAD-weighted LGD; falls back to rental-weighted
): {
  lgdDecayAdjFactor:          number;
  perAssetLgd:                Map<string, number>;
  suggestedRemarketingMonths: number;
  avgFleetAgeYears:           number;
  pctMidAged:                 number;
  pctAged:                    number;
  rows:                       AssetRiskRow[];
  // vintageAdjFactor removed; callers (AssetRiskTab, Scenarios) updated to use lgdDecayAdjFactor
}
```

`perAssetLgd` is a map of `asset_id → LGD benchmark %` consumed by the UI panels. `suggestedRemarketingMonths`, `avgFleetAgeYears`, `pctMidAged`, `pctAged`, and `rows` are retained for `AssetRiskTab` backward compatibility.

`remarketingMonths` remains in `ScenarioInputs` (repossession/remarketing timeline risk is separate from value decay LGD).

---

## UI Components

### `LgdBenchmarkPanel` (`src/app/components/portfolio/LgdBenchmarkPanel.tsx`)

Props: `assetId`, `aircraftType`, `vintage`, `manualLgd: number | null`, `recoveryFactor`, `isOverridden`, `onOpenRecoveryDrawer`.

Renders:
1. Header: "LGD Benchmark · [Family Label]" + "Custom" badge if overridden
2. Three-value row: aircraft family, current age, residual value %
3. LGD benchmark figure with deviation badge vs `manualLgd` (green ±25%, amber ±50%, red outside)
4. Recovery factor display row (e.g., "Recovery factor: 72.0% (default)")
5. Source footer
6. "Adjust recovery factor →" link

### `LgdDecaySummaryCard` (`src/app/components/risk-ecl/LgdDecaySummaryCard.tsx`)

Props: `assets`, `provisions`, `recoveryFactor`, `isOverridden`, `lgdDecayAdjFactor`, `onOpenRecoveryDrawer`.

Renders:
1. Fleet table: registration, type, family, age, residual value %, LGD benchmark — sorted by LGD descending
2. Fleet summary row: EAD-weighted avg LGD, effective `lgdDecayAdjFactor`
3. Comparison chip: "↑ X.X pp vs. new-fleet baseline"
4. "Applied to scenario" confirmation indicator

### `RecoveryFactorDrawer` (`src/app/components/risk-ecl/RecoveryFactorDrawer.tsx`)

Right-side drawer. Single numeric input (recovery factor as %, pre-filled with current value). Impact preview: shows how the current asset's (or fleet's) LGD benchmark changes from/to. Notes textarea. Save calls `useLgdCurves().saveRecoveryOverride()`. Reset with confirmation. Validation: must be between 10% and 95%.

**Portfolio page wiring**

`Portfolio.tsx` already has an Aircraft accordion with per-MSN sub-tabs typed as `"Valuation" | "Maintenance"`. The type is extended to `"Valuation" | "Maintenance" | "LGD"`. `useLgdCurves()` is mounted once at the Portfolio page level. `computePortfolioAssetRisk()` is called with assets + leases + recoveryFactor. `perAssetLgd` map is passed to each expanded aircraft row; `LgdBenchmarkPanel` renders when the active sub-tab is `"LGD"`.

**Risk & ECL page wiring**

`useLgdCurves()` mounted at the `RiskECL` page level. `LgdDecaySummaryCard` inserted above the existing Scenario Editor. `lgdDecayAdjFactor` pre-populates the renamed field in `ScenarioInputs`; analyst can still override. `RecoveryFactorDrawer` is rendered at the bottom of the JSX tree, gated on a boolean `drawerOpen` state.

---

## Testing

### `src/app/data/lgdCurves.test.ts`

1. `computeResidualValuePct` — exact values at all key ages for all families
2. `computeResidualValuePct` — linear interpolation between key ages (e.g., age 7 NB)
3. `computeResidualValuePct` — age beyond 25yr clamps to floor; negative age returns 1.0
4. `computeLgdBenchmark` — correct formula output at known inputs
5. `computeLgdBenchmark` — floor of 5% holds when residualPct × recoveryFactor approaches 1
6. `computeFleetLgdAdjustment` — empty asset list returns `{ lgdDecayAdjFactor: 0, perAssetLgd: empty map }`
7. `computeFleetLgdAdjustment` — single new aircraft (age 0) returns `lgdDecayAdjFactor = 0`
8. `computeFleetLgdAdjustment` — mixed fleet returns positive adjustment
9. `computeFleetLgdAdjustment` — EAD-weighting verified (high-EAD aged asset dominates)
10. `computeFleetLgdAdjustment` — result clamped to [0, 0.50]
11. Bounds — all `DEFAULT_RESIDUAL_CURVES` values are between 0 and 1 (exclusive except age0 = 1.0)
12. Monotonicity — all curves are non-increasing across ages

### `src/app/data/aircraftFamilyMap.test.ts`

13. Known NB types map to `narrowbody` (A320neo, B737 MAX, A220)
14. Known WB types map to `widebody` (B777-300ER, A350-900, B787-9)
15. Known regional types map to `regional` (ATR 72, CRJ-900, E175)
16. Unknown type returns `narrowbody`
17. Case-insensitive matching

### `src/app/utils/assetRisk.test.ts` (additions)

18. `computePortfolioAssetRisk` returns `lgdDecayAdjFactor` and `perAssetLgd` map
19. Higher recovery factor produces lower LGD benchmark
20. Provisions with null EAD fall back to equal weighting

---

## Out of Scope

- Per-asset appraised value input (overlaps with unbuilt Sprint 6 valuation panel)
- Per-family curve overrides (recovery factor override is sufficient for firm customisation)
- Live CMV feed integration
- LGD curves feeding into `pd_estimate` or `Provision.lgd` directly (those remain manual)
- Curve versioning / changelog (covered by separate Audit Trail feature)
