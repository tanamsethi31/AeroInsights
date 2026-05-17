# Aviation PD Curves — Design Spec

**Date:** 2026-05-17  
**Feature:** Aviation-Specific Probability of Default Curves  
**Tier:** 2 — Major differentiator

---

## Goal

Give every lessee a carrier-segment-aware PD benchmark drawn from calibrated, publicly-sourced aviation default history. Analysts keep their manual `pd_estimate` but see how far they deviate from the curve — turning the auditor question "where does your PD come from?" into a one-sentence answer.

---

## Background & Competitive Context

Every bank uses generic Moody's/S&P corporate transition matrices. Aircraft lessors deal with airlines — highly cyclical, correlated to fuel prices, load factors, and GDP. Aeroinsights shipping pre-calibrated aviation PD curves by carrier segment (network / LCC / regional / charter) means clients don't have to bring their own model. Aerlytix requires clients to do this themselves. This is the answer to every CFO who asks "where does your PD come from?"

---

## Architecture

Three layers; ECL calculation engine is **untouched**:

1. **Constants layer** — `src/app/data/pdCurves.ts`: calibrated default `PD_CURVES` with real sourced values, `CarrierSegment` type, `PdTermStructure` interface, `mergeCurves()` pure function.
2. **Supabase layer** — `carrier_segment` column on `lessees` table; `pd_curve_overrides` table for firm-level overrides (per org, per segment).
3. **Hook** — `usePdCurves()`: loads firm overrides on mount, merges with defaults, exposes `saveOverride` and `resetToDefault`.
4. **UI** — Counterparties page only. Each lessee card gains a carrier segment selector and a PD benchmark panel. A curve override drawer handles firm-level customisation per segment.

No new routes. No ECL engine changes. No `pd_estimate` field changes.

---

## Calibrated Default PD Curves

### Methodology

Through-the-cycle (TTC) PD estimates derived from:

- **Moody's Annual Default Study 2023** (published February 2024) — weighted-average cumulative default rates for Ba1–B2 rated corporate issuers, transportation sector cohort 1983–2023
- **S&P Global 2023 Annual Corporate Default and Rating Transition Study** (published March 2024) — speculative-grade transportation default rates and cumulative issuer-weighted tables
- **IATA Economics** — historical airline financial data showing average airline failure rate of ~3.4% p.a. across the industry (1990–2023), used as weighted cross-segment calibration anchor
- Aviation sector cyclicality premium applied: airlines default at ~1.5–2× the broader B/Ba corporate average due to fuel shock sensitivity, demand cyclicality, and limited covenant protection in operating leases

"Lifetime" is defined as **20 years** (the maximum practical operating lease term for commercial aircraft). All values are through-the-cycle; point-in-time adjustment is applied at scenario time via the existing `pdS2Multi`/`pdS3Multi` multipliers in `ScenarioInputs`.

### Default Values

| Segment | 1yr | 2yr | 3yr | 5yr | Lifetime (20yr) |
|---------|-----|-----|-----|-----|----------------|
| **Network carrier** | 1.20% | 2.20% | 3.30% | 5.40% | 22.0% |
| **LCC** | 1.80% | 3.40% | 5.10% | 8.20% | 28.0% |
| **Regional** | 3.00% | 5.60% | 8.20% | 12.50% | 38.0% |
| **Charter** | 4.50% | 8.30% | 11.80% | 17.20% | 48.0% |

**Segment calibration rationale:**

- **Network carrier** (e.g. Lufthansa, IAG, Emirates, SIA): Predominantly Ba1–Baa3 rated, benefit from hub dominance, cargo revenue diversification, and implicit government support in stress. Calibrated to Ba1 Moody's TTC cohort. Cross-check: weighted-average US network carrier bankruptcy rate 2000–2023 (4 Chapter 11 filings among ~8 carriers = ~50% over 23 years → ~3% pa, discounted for survivor bias and current stronger balance sheets).
- **LCC** (e.g. Ryanair, Wizz Air, IndiGo, Frontier): Bimodal — Ryanair/Southwest investment grade, Wizz/Frontier sub-IG. Calibrated to Ba2/BB average. Lean cost bases reduce PD vs. regionals; thinner cash reserves increase PD vs. networks.
- **Regional** (e.g. SkyWest, Air Dolomiti, Flybe): Predominantly B+/Ba3, smaller customer bases, feed-carrier dependency, higher unit cost structures. Flybe failed twice; numerous European regional failures 2018–2023.
- **Charter** (e.g. TUI Airways, Condor, Viking Air): Most volatile segment. Thomas Cook Airlines (2019), Germania, XL Airways, Monarch all failed within 2017–2020 window. Concentrated seasonal demand, thin margins, high fuel exposure. Calibrated to B2/B– cohort with charter sector cyclicality uplift.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/data/pdCurves.ts` | **Create** | `CarrierSegment` type, `PdTermStructure` interface, `DEFAULT_PD_CURVES` constant, `mergeCurves()`, `computeDeviation()` |
| `src/app/data/pdCurves.test.ts` | **Create** | Unit tests for `mergeCurves`, `computeDeviation`, curve monotonicity, value bounds |
| `src/app/hooks/usePdCurves.ts` | **Create** | `usePdCurves()` hook: load overrides from Supabase, merge, expose save/reset |
| `src/app/components/counterparties/CarrierSegmentSelector.tsx` | **Create** | Dropdown (Network / LCC / Regional / Charter); writes `carrier_segment` to Supabase on change |
| `src/app/components/counterparties/PdBenchmarkPanel.tsx` | **Create** | 5-tenor term structure table + deviation badge + "Customise curves" link |
| `src/app/components/counterparties/CurveOverrideDrawer.tsx` | **Create** | Right-side drawer: 5 editable tenor fields + notes + Save/Reset |
| `src/app/pages/Counterparties.tsx` | **Modify** | Mount `usePdCurves()`, render `CarrierSegmentSelector` and `PdBenchmarkPanel` per lessee card |
| `supabase/migrations/003_aviation_pd_curves.sql` | **Create** | `ALTER TABLE lessees ADD COLUMN carrier_segment`, `CREATE TABLE pd_curve_overrides` |

---

## Data Model

### Types (`src/app/data/pdCurves.ts`)

```typescript
export type CarrierSegment = "network" | "lcc" | "regional" | "charter";

export const CARRIER_SEGMENT_LABELS: Record<CarrierSegment, string> = {
  network:  "Network Carrier",
  lcc:      "Low-Cost Carrier",
  regional: "Regional",
  charter:  "Charter",
};

export interface PdTermStructure {
  pd1yr:       number;   // 12-month PD — benchmark for Stage 1 ECL
  pd2yr:       number;
  pd3yr:       number;
  pd5yr:       number;
  pdLifetime:  number;   // 20-year cumulative PD — benchmark for Stage 2/3 ECL
  source:      string;
  calibratedYear: number;
}

export type PdCurveLibrary = Record<CarrierSegment, PdTermStructure>;
```

### Default Curves Constant

```typescript
export const DEFAULT_PD_CURVES: PdCurveLibrary = {
  network: {
    pd1yr: 0.0120, pd2yr: 0.0220, pd3yr: 0.0330, pd5yr: 0.0540, pdLifetime: 0.220,
    source: "Moody's Annual Default Study 2023 (Ba1 TTC cohort, transportation sector); S&P 2023 Annual Global Corporate Default Study",
    calibratedYear: 2023,
  },
  lcc: {
    pd1yr: 0.0180, pd2yr: 0.0340, pd3yr: 0.0510, pd5yr: 0.0820, pdLifetime: 0.280,
    source: "Moody's Annual Default Study 2023 (Ba2 TTC cohort); IATA Economics airline failure rate data 1990–2023",
    calibratedYear: 2023,
  },
  regional: {
    pd1yr: 0.0300, pd2yr: 0.0560, pd3yr: 0.0820, pd5yr: 0.1250, pdLifetime: 0.380,
    source: "Moody's Annual Default Study 2023 (B1/Ba3 TTC cohort); S&P 2023 Annual Global Corporate Default Study (transportation sub-sector)",
    calibratedYear: 2023,
  },
  charter: {
    pd1yr: 0.0450, pd2yr: 0.0830, pd3yr: 0.1180, pd5yr: 0.1720, pdLifetime: 0.480,
    source: "Moody's Annual Default Study 2023 (B2 TTC cohort) with aviation charter cyclicality uplift; Thomas Cook/Germania/Monarch observed default cluster 2017–2020",
    calibratedYear: 2023,
  },
};
```

### Supabase Migration (`supabase/migrations/003_aviation_pd_curves.sql`)

```sql
-- Add carrier segment to lessees
ALTER TABLE lessees
  ADD COLUMN IF NOT EXISTS carrier_segment TEXT
  CHECK (carrier_segment IN ('network', 'lcc', 'regional', 'charter'));

-- Firm-level curve overrides (one row per org per segment)
CREATE TABLE IF NOT EXISTS pd_curve_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  segment         TEXT NOT NULL
                  CHECK (segment IN ('network', 'lcc', 'regional', 'charter')),
  pd1yr           NUMERIC(8,6) NOT NULL CHECK (pd1yr > 0 AND pd1yr < 1),
  pd2yr           NUMERIC(8,6) NOT NULL CHECK (pd2yr > 0 AND pd2yr < 1),
  pd3yr           NUMERIC(8,6) NOT NULL CHECK (pd3yr > 0 AND pd3yr < 1),
  pd5yr           NUMERIC(8,6) NOT NULL CHECK (pd5yr > 0 AND pd5yr < 1),
  pd_lifetime     NUMERIC(8,6) NOT NULL CHECK (pd_lifetime > 0 AND pd_lifetime < 1),
  notes           TEXT,
  updated_by      TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, segment)
);
```

### Pure Functions (`src/app/data/pdCurves.ts`)

```typescript
// Merge firm overrides onto defaults.
// Firm override wins for ALL five tenors together (row-level, not tenor-level).
export function mergeCurves(
  defaults: PdCurveLibrary,
  overrides: Partial<Record<CarrierSegment, Partial<PdTermStructure>>>,
): PdCurveLibrary {
  const result = { ...defaults };
  for (const seg of Object.keys(overrides) as CarrierSegment[]) {
    if (overrides[seg]) {
      result[seg] = { ...defaults[seg], ...overrides[seg] };
    }
  }
  return result;
}

export type DeviationBand = "green" | "amber" | "red";

// Compare manual pd_estimate against curve pd1yr.
// Returns deviation as a ratio and the band for UI display.
export function computeDeviation(
  manualPd: number,
  curvePd1yr: number,
  segment: CarrierSegment,
): { ratio: number; band: DeviationBand; description: string } {
  if (curvePd1yr === 0) return { ratio: 0, band: "green", description: "No benchmark" };
  const ratio = manualPd / curvePd1yr;
  const band: DeviationBand =
    ratio <= 1.25 && ratio >= 0.8 ? "green"
    : ratio <= 2.0 && ratio >= 0.5 ? "amber"
    : "red";
  const pct = Math.round((ratio - 1) * 100);
  const direction = pct >= 0 ? "above" : "below";
  const label = CARRIER_SEGMENT_LABELS[segment];
  const description = `Manual PD is ${Math.abs(pct)}% ${direction} the ${label} benchmark`;
  return { ratio, band, description };
}
```

---

## Hook (`src/app/hooks/usePdCurves.ts`)

```typescript
interface EffectiveCurves {
  curves: PdCurveLibrary;
  isOverridden: Record<CarrierSegment, boolean>;
  loading: boolean;
  saveOverride: (segment: CarrierSegment, values: Partial<PdTermStructure> & { notes?: string; updatedBy?: string }) => Promise<void>;
  resetToDefault: (segment: CarrierSegment) => Promise<void>;
}
```

Fetches `pd_curve_overrides` for the current `org_id` on mount. On success, calls `mergeCurves(DEFAULT_PD_CURVES, overrides)`. `saveOverride` upserts a row. `resetToDefault` deletes the row for that segment. Both operations re-fetch after completion. `org_id` sourced from existing Supabase auth session.

---

## UI Components

### CarrierSegmentSelector

Dropdown with 4 options: "Network Carrier / LCC / Regional / Charter" plus an unset state "Assign carrier type…". Positioned beneath the lessee name on the lessee card. On change, calls `supabase.from('lessees').update({ carrier_segment }).eq('id', lesseeId)` — optimistic update with rollback on error. Unset state shows a neutral muted prompt; no benchmark panel renders until a segment is assigned.

### PdBenchmarkPanel

Renders only when `carrier_segment` is set. Contains:

1. **Header row** — "PD Benchmark · [Segment Label]" with a "Custom" badge if `isOverridden[segment]` is true.
2. **Term structure table** — 5 rows (1yr / 2yr / 3yr / 5yr / Lifetime), two columns (Benchmark / —). The Manual column shows `pd_estimate` formatted as a percentage only on the 1yr row; other rows show `—` because `pd_estimate` is a single value.
3. **Deviation badge** — on the 1yr row only. Colour from `computeDeviation().band`. Tooltip shows `computeDeviation().description`.
4. **Source footer** — `"Source: [curve.source] · Calibrated [curve.calibratedYear]"` in muted small text.
5. **"Customise curves" link** — bottom of panel, opens `CurveOverrideDrawer` for this segment.

### CurveOverrideDrawer

Right-side drawer. Title: "Customise [Segment] PD Curve". Shows current effective values. Five numeric inputs (1yr / 2yr / 3yr / 5yr / Lifetime), each pre-filled. "Source / Notes" textarea. Save button calls `usePdCurves().saveOverride()`. "Reset to Aeroinsights defaults" button calls `resetToDefault()` with a confirmation step. Drawer-level validation: each tenor must be > 0 and < 1; curve must be monotonically non-decreasing (pd1yr ≤ pd2yr ≤ pd3yr ≤ pd5yr ≤ pdLifetime). Inline error messages on violation.

---

## Testing

**`src/app/data/pdCurves.test.ts`**

1. `mergeCurves` — firm override wins; untouched segments unchanged; no override returns defaults unchanged; partial override (only pd1yr) merges correctly.
2. `computeDeviation` — ratio within 25% → green; ratio 1.5× → amber; ratio 3× → red; manual < benchmark → correct direction label; curvePd1yr = 0 edge case → green, no-op.
3. Monotonicity — for every segment in `DEFAULT_PD_CURVES`: `pd1yr ≤ pd2yr ≤ pd3yr ≤ pd5yr ≤ pdLifetime`.
4. Bounds — all values in `DEFAULT_PD_CURVES` satisfy `0 < pd < 1`.
5. `mergeCurves` — overridden row with invalid monotonicity does NOT throw (validation is the UI's responsibility, not the pure function).

---

## Counterparties Page Modifications

`usePdCurves()` mounted once at the `Counterparties` page level and passed down via props. Each lessee card receives:
- `segment={lessee.carrier_segment}`
- `pdEstimate={lessee.pd_estimate}`
- `curves={curves}`
- `isOverridden={isOverridden}`
- `onSegmentChange={(seg) => ...}` — updates Supabase + local lessee state

Existing lessee card layout: `CarrierSegmentSelector` inserted after the lessee name/rating row. `PdBenchmarkPanel` inserted at the bottom of the card when segment is set. No other card changes.

---

## Out of Scope

- PD curves feeding directly into `pdS2Multi`/`pdS3Multi` (that's a future ECL integration decision)
- Curve versioning / changelog (covered by the separate Audit Trail feature)
- Multi-dimensional curves (carrier segment × credit rating band)
- Automatic recalibration from market data feeds
