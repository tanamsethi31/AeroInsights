# Jurisdiction ECL Wiring — Design Spec

**Date:** 2026-05-18
**Status:** Approved

---

## Goal

Wire the existing `computePortfolioJurisdictionMix()` output into the Risk & ECL page so that the adverse scenario's `ctcGoldPct`, `nonCtcPct`, and `repossWeightedMonths` are automatically pre-populated from portfolio data — and surface a compact summary card on the ECL Overview tab so analysts can see the jurisdiction risk contribution at a glance.

---

## Background

`computePortfolioJurisdictionMix(lessees, leases)` already exists in `src/app/utils/jurisdictionRisk.ts` and is fully tested. It computes:

- `ctcGoldPct` — rental-weighted share of fleet in CTC Gold jurisdictions
- `nonCtcPct` — rental-weighted share of fleet in Non-CTC jurisdictions
- `avgRepossP50Months` — rental-weighted P50 repossession timeline across the fleet

The ECL engine in `eclCalculator.ts` already consumes all three fields:
- `repossWeightedMonths > 0`: each month above the 3-month US §1110 benchmark adds 2.5% of baseECL
- `ctcGoldPct / nonCtcPct`: drives the jurisdiction LGD delta (CTC Moderate +6%, Non-CTC +15% of baseECL)

The gap: `RiskECL.tsx` never calls `computePortfolioJurisdictionMix`, so the adverse scenario always starts with all three fields at 0 (feature inactive). Analysts on the Scenarios page can manually populate them via `JurisdictionRiskTab`, but the Risk & ECL page has no equivalent.

The `Scenarios.tsx` page already follows the correct pattern and requires no changes.

---

## Architecture

Two units, one page modification:

| File | Action |
|------|--------|
| `src/app/components/risk-ecl/JurisdictionRiskSummaryCard.tsx` | **Create** |
| `src/app/pages/RiskECL.tsx` | **Modify** (4 additions) |

---

## Unit 1: JurisdictionRiskSummaryCard

**File:** `src/app/components/risk-ecl/JurisdictionRiskSummaryCard.tsx`

### Props

```typescript
interface Props {
  ctcGoldPct:         number;  // 0–1, rental-weighted fleet share in CTC Gold
  nonCtcPct:          number;  // 0–1, rental-weighted fleet share in Non-CTC
  avgRepossP50Months: number;  // rental-weighted P50 repossession months
  liveBaseECL:        number;  // $M — used to compute ECL uplift display
}
```

`ctcModeratePct` is derived inside the component: `Math.max(0, 1 - ctcGoldPct - nonCtcPct)`.

### Layout (top to bottom inside `<Card>`)

**Header row:**
- Left: "Fleet Jurisdiction · Repossession Risk" (fontWeight 600, #0F172A)
- Right: "Applied to scenario ✓" chip (background #EFF6FF, color #1D4ED8)

**CTC tier row:**
Three inline chips showing the rental-weighted fleet breakdown:
- 🟢 Gold: `(ctcGoldPct * 100).toFixed(1)%` — background #DCFCE7, color #15803D
- 🟡 Moderate: `(ctcModeratePct * 100).toFixed(1)%` — background #FEF3C7, color #B45309
- 🔴 Non-CTC: `(nonCtcPct * 100).toFixed(1)%` — background #FEE2E2, color #B91C1C

**Repossession row:**
`display: flex, justifyContent: space-between`
- Left label: "Weighted avg P50" (#64748B, 0.8125rem)
- Right: bold months value + extra-months badge
  - Badge text: `+N mo above benchmark` where N = `Math.max(0, avgRepossP50Months - 3)`
  - Badge colour: N === 0 → green (#DCFCE7/#15803D), N ≤ 3 → amber (#FEF3C7/#B45309), N > 3 → red (#FEE2E2/#B91C1C)
  - If `avgRepossP50Months === 0`: show "—" for both values (feature inactive / no data)

**ECL uplift chip:**
`upliftM = Math.max(0, avgRepossP50Months - 3) * 0.025 * liveBaseECL`
- Text: `↑ $X.XM repossession uplift` (1 decimal place)
- If upliftM === 0: show "No uplift vs. benchmark" in green
- Background: upliftM > 0 ? #FEE2E2 : #DCFCE7; color accordingly

**Footer link:**
```tsx
<button onClick={() => navigate("/jurisdictions")} style={...}>
  View full jurisdiction analysis →
</button>
```
Uses `useNavigate` from `react-router`.

### Behaviour

- If `avgRepossP50Months === 0` and `ctcGoldPct === 0` and `nonCtcPct === 0`: render the card with all values showing "—" and a muted note "No jurisdiction data in portfolio."
- No loading state — data arrives synchronously from the memoized computation.
- No Supabase calls — pure display component.

---

## Unit 2: RiskECL.tsx modifications

**File:** `src/app/pages/RiskECL.tsx`

Four additions, no structural changes:

### Addition 1 — Imports

```typescript
import { computePortfolioJurisdictionMix } from "../utils/jurisdictionRisk";
import { JurisdictionRiskSummaryCard } from "../components/risk-ecl/JurisdictionRiskSummaryCard";
```

### Addition 2 — Memoized computation (after `portfolioLgdRisk` memo)

```typescript
const portfolioJurisdictionMix = useMemo(
  () => computePortfolioJurisdictionMix(lessees, leases),
  [lessees, leases]
);
```

`lessees` and `leases` are already destructured from `usePortfolioData()`.

### Addition 3 — Auto-population useEffect (after existing `lgdDecayAdjFactor` effect)

```typescript
useEffect(() => {
  if (portfolioJurisdictionMix.ctcGoldPct > 0 || portfolioJurisdictionMix.nonCtcPct > 0) {
    setScenarioInputs((prev) => ({
      ...prev,
      adverse: {
        ...prev.adverse,
        ctcGoldPct:           portfolioJurisdictionMix.ctcGoldPct,
        nonCtcPct:            portfolioJurisdictionMix.nonCtcPct,
        repossWeightedMonths: portfolioJurisdictionMix.avgRepossP50Months,
      },
    }));
  }
}, [
  portfolioJurisdictionMix.ctcGoldPct,
  portfolioJurisdictionMix.nonCtcPct,
  portfolioJurisdictionMix.avgRepossP50Months,
]);
```

**Guard:** only fires when `ctcGoldPct > 0 || nonCtcPct > 0`. When portfolio has no jurisdiction data (demo mode or empty lessees), all three fields stay at 0 (ECL formula guard: feature inactive). This preserves backward compatibility.

**Dependency array:** three primitive numbers — no object reference instability, no infinite loop risk. Same pattern as `lgdDecayAdjFactor` effect.

### Addition 4 — JSX in OverviewTab

In the `OverviewTab` inner function, after `LgdDecaySummaryCard` and before the Scenario Probability Weights `<Card>`:

```tsx
{assets.length > 0 && (
  <JurisdictionRiskSummaryCard
    ctcGoldPct={portfolioJurisdictionMix.ctcGoldPct}
    nonCtcPct={portfolioJurisdictionMix.nonCtcPct}
    avgRepossP50Months={portfolioJurisdictionMix.avgRepossP50Months}
    liveBaseECL={liveBaseECL}
  />
)}
```

`liveBaseECL` is already computed in `RiskECL.tsx` (from `toDashboardKPIs`).

---

## Data Flow

```
usePortfolioData() → lessees, leases
        ↓
computePortfolioJurisdictionMix(lessees, leases)   [useMemo]
        ↓
portfolioJurisdictionMix: { ctcGoldPct, nonCtcPct, avgRepossP50Months }
        ↓
useEffect → setScenarioInputs(adverse.ctcGoldPct, .nonCtcPct, .repossWeightedMonths)
        ↓
computeECLFromBase(liveBaseECL, adverseInputs) → ECL with repossession uplift applied

Also:
portfolioJurisdictionMix → JurisdictionRiskSummaryCard (display only)
```

---

## Testing

No new unit tests required:
- `computePortfolioJurisdictionMix` is already tested in `jurisdictionRisk.test.ts`
- `JurisdictionRiskSummaryCard` is a pure display component with no logic beyond arithmetic
- The `useEffect` pattern is identical to the tested `lgdDecayAdjFactor` pattern

Existing 412 tests must remain green.

---

## What is NOT in scope

- Changes to `Scenarios.tsx` — already correct
- Changes to `eclCalculator.ts` — no formula changes
- Changes to `jurisdictionRisk.ts` — already complete
- Manual override UI for `repossWeightedMonths` on the Risk & ECL page (users can do this in Scenarios)
- Persisting the jurisdiction mix to Supabase
- Updating hardcoded jurisdiction data in `jurisdictionData.ts`
