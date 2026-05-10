# Deferral & Distress Modeling — Design Spec

**Date:** 2026-05-10
**Context:** Feedback from ELFC exec identified deferrals, payment forgiveness, and lessor mitigation as gaps in the platform's scenario modeling capability. This spec closes those gaps by extending the existing Custom Builder and Library in the Scenarios page.

---

## Goal

Allow users to model realistic distress scenarios — deferral arrangements, government support, payment forgiveness, and lessor mitigation actions (PBH, ETP, LEC) — within the existing Custom Builder form, and provide pre-built Library cards for the three most common distress archetypes.

## Architecture

Two changes, both additive:

1. **`eclCalculator.ts`** — extend `ScenarioInputs` with 6 new fields; extend `computeECLFromBase` with deferral penalty and mitigation benefit terms.
2. **`Scenarios.tsx`** — (a) new collapsible "Distress & Mitigation" section in the Custom Builder form; (b) three new Library cards with tags and pre-fill behaviour.

No new files. No new routes. No schema changes.

---

## Data Model

### New `ScenarioInputs` fields

| Field | Type | Range | Default | Description |
|---|---|---|---|---|
| `deferralMonths` | number | 0–24 | 0 | Months of rent deferred across the fleet |
| `govtSupportProb` | number | 0–1 | 0 | Probability government backstops deferred rent (reduces deferral ECL impact) |
| `forgivenessRate` | number | 0–1 | 0 | Share of deferred rent permanently written off |
| `pbhConversionPct` | number | 0–1 | 0 | Share of fleet switching to Power-by-Hour leases |
| `etpRate` | number | 0–1 | 0 | Early termination penalty recovered as % of remaining lease value |
| `lecRate` | number | 0–1 | 0 | Lease End Compensation recovered as % of half-life value |

All default to `0` in `ZERO_INPUTS` — no impact on existing scenario runs.

### ECL formula extension (`computeECLFromBase`)

```
// Deferral penalty — increases ECL
deferralPenalty = deferralMonths × (1 − govtSupportProb) × forgivenessRate × MONTHLY_RENT_M
// MONTHLY_RENT_M = liveBaseECL-derived monthly rent proxy (2.85 for demo fleet)

// Mitigation benefits — reduce ECL
pbhBenefit  = pbhConversionPct  × baseECL × 0.15   // up to −15% of base ECL
etpBenefit  = etpRate           × baseECL × 0.08   // up to −8%
lecBenefit  = lecRate           × baseECL × 0.05   // up to −5%

delta += deferralPenalty − pbhBenefit − etpBenefit − lecBenefit
```

Existing macro and credit terms unchanged. Floor at `baseECL × 0.3` unchanged.

### DSL new keywords

```
deferral_months: 9
govt_support: 0.35
forgiveness_rate: 0.50
pbh_conversion: 0.20
etp_rate: 0.15
lec_rate: 0.10
```

Round-trip with the form (form → DSL and DSL → form, same as existing fields).

---

## UI — Custom Builder: "Distress & Mitigation" section

Added below the existing "Credit Parameters" section. Visually matches the existing collapsible section pattern.

### Header
- Label: **"Distress & Mitigation"**
- Badge: `"0 active levers"` when all fields are zero; `"N active levers"` when any are non-zero
- Collapsed by default; auto-expands when any lever is set (e.g. via Library pre-fill or DSL parse)
- Chevron rotate animation on expand/collapse (matches existing SICR pattern)

### Sub-group 1 — Deferral & Forgiveness

| Control | Slider range | Step | Unit |
|---|---|---|---|
| Deferral duration | 0–24 | 1 | months |
| Govt support probability | 0–100 | 5 | % |
| Forgiveness rate | 0–100 | 5 | % |

- Tooltip on Govt support: "Probability that government guarantees or repays deferred rent — reduces deferral ECL impact proportionally"
- Tooltip on Forgiveness: "Share of deferred rent permanently written off; 0% = full repayment expected, 100% = full loss"

### Sub-group 2 — Lessor Mitigation

| Control | Slider range | Step | Unit |
|---|---|---|---|
| PBH conversion | 0–100 | 5 | % of fleet |
| ETP rate | 0–50 | 5 | % of remaining lease value |
| LEC rate | 0–30 | 5 | % of half-life value |

- Tooltip on PBH: "Power-by-Hour — rent tied to utilisation; reduces fixed-cost exposure but removes rent floor"
- Tooltip on ETP: "Early Termination Penalty — contractual recovery on lessor-initiated termination"
- Tooltip on LEC: "Lease End Compensation — recovery for below-half-life redelivery of engines/airframe"

### Net impact line
Below both sub-groups, before the Run button:
```
Deferral penalty  +$4.2M  ·  Mitigation  −$1.8M  ·  Net  +$2.4M
```
Updates live as sliders move. Red if net positive (ECL increase), green if net negative (ECL decrease).

---

## UI — Library: distress scenario cards

A "Distress Scenarios" sub-label appears above three new cards in the Library grid. Existing cards get a "Macro Scenarios" sub-label for clarity. Visual design matches existing Library cards exactly.

### Card 1 — COVID-Style Deferral Wave

**Tags:** `Deferral` `Govt Support` `PBH` `Stress`

**Inputs:**
```
gdpDelta: -0.03, rpkDelta: -0.55, fuelDelta: -0.30
deferralMonths: 9, govtSupportProb: 0.35, forgivenessRate: 0.50
pbhConversionPct: 0.20
```

**Description:** Mass deferral requests across the fleet. Government support cushions ~35% of exposure. Half of deferred rent ultimately forgiven. 20% of fleet switched to PBH.

### Card 2 — Bilateral Restructuring

**Tags:** `Deferral` `Govt Support` `ETP` `LEC`

**Inputs:**
```
rpkDelta: -0.20, pdS2Multi: 1.5, pdS3Multi: 2.5
deferralMonths: 6, govtSupportProb: 0.60, forgivenessRate: 0.25
etpRate: 0.15, lecRate: 0.10
```

**Description:** Single lessee in distress, negotiated deferral arrangement with government backstop. Lessor recovers ETP and LEC on restructured leases.

### Card 3 — Early Termination Wave

**Tags:** `ETP` `LEC` `Asset Stress`

**Inputs:**
```
assetValueDelta: -0.15, pdS2Multi: 1.8
deferralMonths: 3, forgivenessRate: 0.10
etpRate: 0.35, lecRate: 0.20
```

**Description:** Lessor-driven early terminations to maximise recovery before defaults crystallise. Strong ETP/LEC recovery partially offsets deferral losses.

### Card behaviour
- **"Run"** button — runs immediately, adds to Run History
- **"Customise"** button — pre-fills Custom Builder (including new Distress & Mitigation section), switches to Custom Builder tab

---

## Out of Scope

- Per-lessee deferral tracking (this is scenario modeling, not actuals tracking)
- Government support as a named entity or data feed (modeled as a probability input only)
- Cultural/behavioural payment factors (separate spec)
- Jurisdiction → LGD linkage (separate spec)
- Chapter 7 / Chapter 11 granularity extension (separate spec)
