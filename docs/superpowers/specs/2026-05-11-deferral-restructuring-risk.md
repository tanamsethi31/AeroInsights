# Deferral & Restructuring Risk — Design Spec

**Date:** 2026-05-11
**Sprint:** 14

---

## Goal

Add a Deferral & Restructuring Risk tab to the ECL Scenario Builder. Users select a named restructuring scenario type (Standstill / Rent Reduction / Equity-for-Debt / Full Write-off) and see per-lessee deferral exposure weighted by each lessee's credit risk tier. A "Use in Custom Builder" CTA populates the existing deferral sliders and stores the type name in ScenarioInputs for DSL auditability. A quick-preset pill row is added to the top of the existing Distress & Mitigation Custom Builder section.

---

## Architecture

Four additive changes — no new routes, no schema changes:

1. **`deferralRisk.ts`** — new pure utility: `RESTRUCTURING_TYPES`, `DeferralRiskTier`, `deferralRiskTier()`, `computePortfolioDeferralRisk()`
2. **`eclCalculator.ts`** — add `restructuringType: string | null` to `ScenarioInputs`; DSL metadata only — no direct ECL formula effect
3. **`DeferralRiskTab.tsx`** — new Scenarios tab: type picker pills, KPI cards, per-lessee breakdown table
4. **`Scenarios.tsx`** — wire tab, DSL round-trip, preset pills in existing Distress collapsible body

---

## Data Model

### New `ScenarioInputs` field

| Field | Type | Default | Description |
|---|---|---|---|
| `restructuringType` | `string \| null` | `null` | Labels the restructuring scenario starting point. DSL metadata only — ECL driven by `deferralMonths`, `govtSupportProb`, `forgivenessRate`. |

`null` = no type selected (raw slider values). Backward-compatible.

**Important:** `restructuringType` has no direct effect on `computeECLFromBase`. The ECL impact comes entirely from the three existing deferral fields it populates. This mirrors `bankruptcyScenarioType` in spirit but differs: bankruptcy types have their own LGD delta; restructuring types are preset shortcuts for the existing deferral levers.

### Restructuring type presets

```typescript
export interface RestructuringPreset {
  label:           string;
  deferralMonths:  number;
  govtSupportProb: number;
  forgivenessRate: number;
  description:     string;
}

export const RESTRUCTURING_TYPES: Record<string, RestructuringPreset> = {
  standstill: {
    label:          "Standstill Agreement",
    deferralMonths:  6,
    govtSupportProb: 0.10,
    forgivenessRate: 0.00,
    description:    "Temporary payment halt while restructuring is negotiated. Full repayment expected — forgivenessRate=0 → $0 deferral ECL (IFRS 9 excludes TVM modification loss).",
  },
  rent_reduction: {
    label:          "Rent Reduction",
    deferralMonths:  12,
    govtSupportProb: 0.20,
    forgivenessRate: 0.35,
    description:    "Permanent partial rent write-down agreed with lessee. 35% of deferred rent forgiven after 20% govt backstop.",
  },
  equity_debt_swap: {
    label:          "Equity-for-Debt",
    deferralMonths:  18,
    govtSupportProb: 0.30,
    forgivenessRate: 0.60,
    description:    "Deferred rent converted to diluted airline equity stake. Lessor recovers equity value at significant discount; 60% treated as write-off.",
  },
  full_forgiveness: {
    label:          "Full Write-off",
    deferralMonths:  24,
    govtSupportProb: 0.00,
    forgivenessRate: 1.00,
    description:    "Complete loss crystallisation. All deferred rent permanently written off. No govt backstop assumed.",
  },
};
```

### Deferral risk tier

Derived from `lessee.watchlist_status` + `lease.stage`. Worst signal wins.

| Tier | Criteria |
|---|---|
| `high` | `stage === 3` OR `watchlist_status === "red"` |
| `medium` | `stage === 2` OR `watchlist_status === "amber"` |
| `low` | otherwise (stage 1, green or null watchlist) |

```typescript
export type DeferralRiskTier = "high" | "medium" | "low";
```

### Per-lessee row

```typescript
export interface DeferralRiskRow {
  lesseeName:        string;
  stage:             number;              // 1 | 2 | 3 (defaults to 1 if unknown)
  watchlistStatus:   "green" | "amber" | "red" | null;
  riskTier:          DeferralRiskTier;
  monthlyRentalM:    number;             // $M
  deferredExposureM: number;             // monthlyRentalM × deferralMonths
  expectedLossM:     number;             // deferredExposureM × (1 − govtSupportProb) × forgivenessRate
  rentalSharePct:    number;             // 0–1
}
```

### Portfolio computation

```typescript
export function computePortfolioDeferralRisk(
  lessees:         Lessee[],
  leases:          Lease[],
  deferralMonths:  number,
  govtSupportProb: number,
  forgivenessRate: number,
): {
  rows:             DeferralRiskRow[];
  totalDeferredM:   number;
  expectedWriteOffM: number;
  govtBufferM:      number;
}
```

- Lessees with no matching lease or null/zero monthly_rental are excluded.
- `stage` defaults to 1 if lease.stage is null.
- `totalDeferredM = sum(monthlyRentalM × deferralMonths)` across all included lessees.
- `expectedWriteOffM = totalDeferredM × (1 − govtSupportProb) × forgivenessRate`
- `govtBufferM = totalDeferredM × govtSupportProb × forgivenessRate`
- Rows sorted: high risk first → medium → low; within same tier, monthly rental descending.

### DSL new keyword

```json
"restructuring_type": "standstill"
```

Omitted from DSL when null. Parsed with unknown-key fallback to null. Round-trips with the form. Does not affect `coopPct`/`advPct` or any other field.

---

## UI — `DeferralRiskTab.tsx` (new file)

Rendered in the Scenarios page as a new tab "Deferral Risk", positioned between "Security Deposits" and "Payment Behaviour".

### Internal state

- `selectedType: string` — default `"standstill"`. Controls which preset's parameters drive the KPI cards and per-lessee table. Independent of `formInputs`.

### Type picker row

4 pill buttons: Standstill Agreement · Rent Reduction · Equity-for-Debt · Full Write-off

Active pill: dark navy background (`#002147`), white text. Inactive: light grey border, dark text.

### Header KPI row (3 cards)

| KPI | Value | Colour logic |
|---|---|---|
| Total Deferred Exposure | $X.XM | Always neutral (slate) |
| Expected Write-off | $X.XM | Red if >$5M, amber if >$2M, green otherwise |
| Govt Support Buffer | $X.XM | Always green |

When `forgivenessRate === 0` (standstill): Expected Write-off shows "$0.00M" with a grey "No ECL impact" note below.

### Lessee breakdown table

Columns: Airline · Stage · Risk Tier · Monthly Rent · Deferred Exposure · Expected Loss

- Risk Tier shown as colour-coded pill: red (High), amber (Medium), green (Low)
- Sorted: high risk first, then monthly rental descending
- No totals row (KPI cards cover aggregates)

### "Use in Custom Builder" button

Below the table. On click: switches to Custom Builder tab, sets `restructuringType` to `selectedType`, and populates `deferralMonths`, `govtSupportProb`, `forgivenessRate` from the preset.

---

## UI — Custom Builder: "Distress & Mitigation" section — preset pills

No new collapsible. Add a "Quick preset" row at the very top of the existing Distress & Mitigation section body (above the "Deferral & Forgiveness" sub-group label).

### Preset pills row

```
Quick preset:  [Standstill]  [Rent Reduction]  [Equity-for-Debt]  [Full Write-off]  [Clear]
```

- Clicking a preset: calls `updateFormInputs({ restructuringType, deferralMonths, govtSupportProb, forgivenessRate })`
- Active preset highlighted (matches `formInputs.restructuringType`)
- "Clear" button: sets `restructuringType: null`, `deferralMonths: 0`, `govtSupportProb: 0`, `forgivenessRate: 0`
- The 3 existing deferral sliders remain fully editable after selection
- Distress section header badge: when `restructuringType` is non-null AND active levers > 0, shows type label e.g. `"Standstill · 1 lever"` instead of `"1 active levers"`

---

## Out of Scope

- Per-lessee deferral months (fleet-aggregate model only)
- Equity-for-debt valuation (equity value is not modelled — forgivenessRate is the proxy)
- Time-value-of-money modification loss (IFRS 9 §5.5.25 — explicitly excluded, documented in eclCalculator.ts)
- Integration with live airline distress signals / news feeds
- Government support data feed (proprietary — static probability slider only)
