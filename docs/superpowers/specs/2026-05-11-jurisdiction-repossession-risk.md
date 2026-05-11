# Jurisdiction Repossession Risk — Design Spec

**Date:** 2026-05-11
**Sprint:** 11

---

## Goal

Make CTC status, enforcement tier, and country-specific repossession timelines a live ECL input. The portfolio's actual lessee country mix auto-computes a jurisdiction LGD uplift. Users can override it in the Custom Builder for scenario stress-testing.

---

## Architecture

Three additive changes — no new routes, no schema changes:

1. **`eclCalculator.ts`** — add `ctcGoldPct` and `nonCtcPct` to `ScenarioInputs`; add `jurisdictionLGDDelta` term to `computeECLFromBase`.
2. **`JurisdictionRiskTab.tsx`** — new component (new file) showing portfolio jurisdiction breakdown: KPI cards, lessee-by-lessee table, "Use in Custom Builder" CTA.
3. **`Scenarios.tsx`** — wire new tab; DSL round-trip; Custom Builder "Jurisdiction Risk" collapsible section with two sliders and a "From portfolio" button.

---

## Data Model

### New `ScenarioInputs` fields

| Field | Type | Range | Default | Description |
|---|---|---|---|---|
| `ctcGoldPct` | number | 0–1 | 0 | Share of fleet value in CTC Gold jurisdictions |
| `nonCtcPct` | number | 0–1 | 0 | Share of fleet value in non-CTC jurisdictions |

CTC Moderate is derived: `max(0, 1 − ctcGoldPct − nonCtcPct)`. Not stored — recomputed on use.

Both default to `0` in `ZERO_INPUTS` — zero-adjustment baseline (all fleet assumed CTC Gold, the most optimistic possible position). This preserves backward compatibility.

### Tier classification

| Tier | Criterion | Examples | Calibration |
|---|---|---|---|
| CTC Gold | `ctcParty: true` AND `ctcScore ≥ 80` | US, IE, SG, AE, AU, CA, DE, NL, JP | 0% LGD uplift (baseline) |
| CTC Moderate | `ctcParty: true` AND `ctcScore < 80`, OR `ctcParty: false` AND `ctcScore ≥ 50` | FR, ES, IT, IN, MX, TH, ZA, KR, KZ, CL | +6% of baseECL |
| Non-CTC | `ctcParty: false` AND `ctcScore < 50` | CN, ID, BR, CO, AR, RU, NG, EG, ET, KE, LB, IR, VE | +15% of baseECL |

For lessee countries not present in `jurisdictionData.ts`, default to Non-CTC.

### ECL formula extension

```
ctcModeratePct = max(0, 1 − ctcGoldPct − nonCtcPct)
jurisdictionLGDDelta = (ctcGoldPct × 0.00 + ctcModeratePct × 0.06 + nonCtcPct × 0.15) × baseECL
delta += jurisdictionLGDDelta
```

Calibration anchor: a pure CTC Gold portfolio (US/IE/SG) → 0 uplift. A pure non-CTC portfolio (CN/AR/RU) → +15% of baseECL = +$7.1M on the demo fleet.

The floor at `baseECL × 0.3` is unchanged.

### Portfolio computation (for auto-fill)

Weight lessees by `monthly_rental`. Map lessee `country` string → `jurisdictionData.ts` entry → tier. Countries absent from jurisdictionData default to Non-CTC.

**Demo fleet result** (10 lessees, computed from `mockPortfolioData.ts`):
- CTC Gold: Emirates, Ryanair, Air Transat, Singapore Airlines, Lufthansa → 57.3% by rental
- CTC Moderate: IndiGo, Aeromexico, Air France → 28.5%
- Non-CTC: SriLankan, Azul → 14.2%

Portfolio jurisdiction LGD uplift = (0 × 0.57 + 0.06 × 0.285 + 0.15 × 0.142) × 47.2 = $1.8M

### DSL new keywords

```json
"ctc_gold_pct": 0.57,
"non_ctc_pct": 0.14
```

Round-trip with the form.

---

## UI — `JurisdictionRiskTab.tsx` (new file)

Rendered in the Scenarios page as a new tab "Jurisdiction Risk", positioned after "Insolvency Regimes".

### Header KPI row (4 cards)

| KPI | Value (demo) | Colour logic |
|---|---|---|
| CTC Gold | 57.3% | Always green |
| CTC Moderate | 28.5% | Always amber |
| Non-CTC | 14.2% | Red if > 20%, amber if > 10%, green otherwise |
| Jurisdiction LGD Uplift | +$1.8M | Red if > 0, green if 0 |

### Lessee breakdown table

Columns: Airline · Country · Enforcement Tier · CTC Score · Reposs P50 · Weight %

- Tier shown as a colour-coded pill: green (Gold), amber (Moderate), red (Non-CTC)
- Sorted by weight % descending
- Weighted summary row at bottom

### "Use in Custom Builder" button

Below the table. On click: switches to Custom Builder tab and pre-fills `ctcGoldPct`/`nonCtcPct` from portfolio values.

---

## UI — Custom Builder: "Jurisdiction Risk" section

Collapsible section below "Insolvency Regime". Same visual pattern as Distress & Mitigation and Insolvency Regime sections.

### Header

- Label: **"Jurisdiction Risk"**
- Badge: shows derived CTC Moderate % when non-zero; "None (CTC Gold baseline)" when both sliders are 0
- Collapsed by default; auto-expands when either field is non-zero

### Body

| Control | Range | Step | Unit |
|---|---|---|---|
| CTC Gold | 0–100 | 5 | % of fleet |
| Non-CTC | 0–100 | 5 | % of fleet |

- CTC Moderate is derived and displayed as a read-only label: `CTC Moderate: {max(0, 100 − gold − nonCtc)}%`
- If `ctcGoldPct + nonCtcPct > 1.0`, clamp `nonCtcPct` so the sum does not exceed 100%. (Implementation: when the Non-CTC slider would push the total > 100%, cap it at `1 − ctcGoldPct`.)
- **"From portfolio" button**: auto-fills both sliders from the computed portfolio mix. Shows tooltip: "Computed from your portfolio's lessee country mix, weighted by monthly rental."

### Net impact line

```
CTC Moderate  +$X.XM  ·  Non-CTC  +$Y.YM  ·  Total uplift  +$Z.ZM
```

Always non-negative (jurisdiction risk only increases ECL). Red when non-zero, grey when zero.

---

## Out of Scope

- Per-lease jurisdiction assignment (lessees, not leases, carry the country)
- Jurisdiction Library cards (could be Sprint 12)
- Integration with the Jurisdictions page reference browser (separate page, untouched)
- Downward LGD adjustment for CTC Gold (baseline is already gold-standard; no reward for it)
- Adjustment to `computeStages` (jurisdiction affects LGD, not stage allocation)
