# Credit-linked Security Deposit Sizing — Design Spec

**Date:** 2026-05-11
**Sprint:** 12

---

## Goal

Make security deposit sizing a live, credit-linked input. Each lessee's watchlist status drives a recommended deposit tier (waived / 1 month / 3 months rent). The portfolio's actual deposit coverage auto-computes an ECL benefit. Users can override it in the Custom Builder for scenario stress-testing.

---

## Architecture

Four additive changes — no new routes, no schema changes:

1. **`creditDeposit.ts`** — new pure utility: `creditTier()`, `recommendedDepositMonths()`, `computePortfolioDepositCoverage()`.
2. **`eclCalculator.ts`** — add `depositCoverage` to `ScenarioInputs`; add `depositBenefit` term to `computeECLFromBase`.
3. **`CreditDepositTab.tsx`** — new Scenarios tab: KPI cards, per-lessee breakdown, "Use in Custom Builder" CTA.
4. **`SDMRTab.tsx`** — add Credit Tier pill column to the existing lessee table.
5. **`Scenarios.tsx`** — wire new tab; DSL round-trip; Custom Builder "Security Deposits" collapsible section.

---

## Data Model

### New `ScenarioInputs` field

| Field | Type | Range | Default | Description |
|---|---|---|---|---|
| `depositCoverage` | number | 0–1 | 0 | Total recommended deposits as fraction of fleet EAD |

Default `0` in `ZERO_INPUTS` — zero-benefit baseline (feature inactive). Backward-compatible.

### Credit tier classification

| Tier | Criterion | Deposit | Examples (demo fleet) |
|---|---|---|---|
| Investment Grade | `watchlist_status: "green"` | 0 months (waived) | Emirates, Ryanair, Singapore Airlines, Lufthansa |
| Sub-Investment Grade | `watchlist_status: "amber"` or `null` | 1 month rent | IndiGo, Aeromexico, Air Transat |
| Distressed | `watchlist_status: "red"` | 3 months rent | SriLankan, Azul |

### ECL formula extension

```
depositBenefit = depositCoverage × baseECL × 0.50
delta -= depositBenefit
```

**Calibration:** The 0.50 factor reflects IFRS 9 cash collateral treatment — deposits absorb LGD directly but a haircut is applied for legal/operational costs of recovery. At 4% deposit coverage (typical mixed fleet): ~$0.9M ECL reduction on the demo fleet.

**IFRS 9 rationale:** Security deposits are cash collateral held by the lessor. Under IFRS 9, collateral reduces the net Loss Given Default. The deposit benefit is bounded by the floor: `max(baseECL × 0.3, baseECL + delta)` — unchanged.

### Portfolio computation

```
depositCoverage = sum(recommended_deposits_per_lessee) / fleet_EAD
```

Where:
- `recommended_deposit_per_lessee = recommendedDepositMonths(tier) × monthly_rental`
- `fleet_EAD = sum(provision.ead)` — from provisions data (in $M)
- Lessees with null monthly_rental excluded (no deposit computable)
- Lessees with null watchlist_status → Sub-Investment Grade (1 month)

**Demo fleet result:**
- Green (waived): Emirates, Ryanair, Singapore Airlines, Lufthansa, Air France → 0 months
- Amber (1 month): IndiGo, Aeromexico, Air Transat → 1 × monthly rental
- Red (3 months): SriLankan, Azul → 3 × monthly rental
- `depositCoverage` ≈ 1.2–2.5% depending on month-end data

### DSL new keyword

```json
"deposit_coverage": 0.025
```

Omitted from generated DSL when `depositCoverage === 0`. Round-trips with the form.

---

## UI — `CreditDepositTab.tsx` (new file)

Rendered in the Scenarios page as a new tab "Security Deposits", positioned after "Jurisdiction Risk".

### Header KPI row (3 cards)

| KPI | Value | Colour logic |
|---|---|---|
| Investment Grade | X% of fleet by rental | Always green |
| Distressed | X% of fleet by rental | Red if > 30%, amber if > 15%, green otherwise |
| Deposit Coverage | X.X% of fleet EAD | Red if > 5% (high risk fleet), amber if > 2%, green if ≤ 2% |

### Lessee breakdown table

Columns: Airline · Watchlist · Credit Tier · Deposit Months · Monthly Rent · Recommended Deposit

- Credit Tier shown as colour-coded pill: green (Investment Grade), amber (Sub-IG), red (Distressed)
- Sorted by recommended deposit descending, then by monthly rent descending
- Totals row at bottom: total recommended deposits in $M

### "Use in Custom Builder" button

Below the table. On click: switches to Custom Builder tab and pre-fills `depositCoverage` from portfolio value.

---

## UI — Custom Builder: "Security Deposits" section

Collapsible section below "Jurisdiction Risk". Same visual pattern.

### Header

- Label: **"Security Deposits"**
- Badge: shows deposit coverage % when non-zero; "None (no deposit benefit)" when zero
- Collapsed by default; auto-expands when field is non-zero

### Body

| Control | Range | Step | Unit |
|---|---|---|---|
| Deposit Coverage | 0–20 | 0.5 | % of fleet EAD |

- **"From portfolio" button**: auto-fills from computed portfolio mix. Tooltip: "Computed from your portfolio's credit tier mix, weighted by monthly rental and fleet EAD."

### Net impact line

```
Deposit Benefit  −$X.XM  ·  Coverage  X.X% of EAD
```

Always non-positive (deposits only reduce ECL). Green when non-zero, grey when zero.

---

## UI — `SDMRTab.tsx` additions

Add a **Credit Tier** pill column to the existing lessee rows. The pill uses the same colour scheme as `CreditDepositTab`. No other changes to SDMR layout.

For the static demo dataset (`sdmrData`), hardcode credit tier per lessee:
- IndiGo → amber (Sub-IG)
- Air France → green (IG)
- Emirates → green (IG)
- Air Transat → amber (Sub-IG)
- SriLankan → red (Distressed)
- Aeromexico → amber (Sub-IG)

For live data mode, derive tier from `watchlist_status` passed via props.

---

## Out of Scope

- Actual deposit ledger (per-lease recorded vs recommended comparison)
- Letter of Credit vs Cash deposit type distinction in tier sizing
- Deposit interest/return mechanics
- Integration with maintenance reserves as ECL mitigant (future sprint)
- Per-lessee PD-weighted deposit benefit (simplified to portfolio-level coverage)
