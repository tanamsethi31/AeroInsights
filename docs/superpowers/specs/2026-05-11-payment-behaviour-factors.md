# Payment Behaviour Factors — Design Spec

**Date:** 2026-05-11
**Sprint:** 13

---

## Goal

Add a regional payment behaviour factor to the ECL Scenario Builder. Each lessee's country maps to a payment behaviour score (0–100) which classifies them as Cooperative / Neutral / Adversarial. The portfolio's rental-weighted tier mix auto-computes an ECL adjustment. Users can override it in the Custom Builder for scenario stress-testing.

---

## Architecture

Four additive changes — no new routes, no schema changes:

1. **`paymentBehaviour.ts`** — new pure utility: `PAYMENT_BEHAVIOUR_SCORES`, `payBehaviourTier()`, `computePortfolioPaymentBehaviourMix()`
2. **`eclCalculator.ts`** — add `payBehaviourCoopPct` + `payBehaviourAdvPct` to `ScenarioInputs`; add `payBehaviourDelta` term to `computeECLFromBase`
3. **`PaymentBehaviourTab.tsx`** — new Scenarios tab: KPI cards, per-lessee breakdown, "Use in Custom Builder" CTA
4. **`Scenarios.tsx`** — wire new tab, DSL round-trip, Custom Builder collapsible section

---

## Data Model

### New `ScenarioInputs` fields

| Field | Type | Range | Default | Description |
|---|---|---|---|---|
| `payBehaviourCoopPct` | number | 0–1 | 0 | Fleet share (rental-weighted) in Cooperative tier |
| `payBehaviourAdvPct` | number | 0–1 | 0 | Fleet share (rental-weighted) in Adversarial tier |

Both default to `0` in `ZERO_INPUTS`. Feature inactive when both are 0 (neutral baseline — no ECL adjustment). Backward-compatible.

Derived: `neutralPct = max(0, 1 − coopPct − advPct)`. Not stored.

### Tier classification

| Tier | Score | Criterion | ECL effect |
|---|---|---|---|
| `cooperative` | ≥ 70 | Fast workout agreements, low DPD, strong payment culture | −7% of baseECL per 100% |
| `neutral` | 40–69 | Mixed history; no material directional signal | 0% |
| `adversarial` | < 40 | Contested recoveries, high DPD, government interference risk | +12% of baseECL per 100% |

### ECL formula extension

```
payBehaviourDelta = (adversarialPct × 0.12 − cooperativePct × 0.07) × baseECL
delta += payBehaviourDelta
```

**Calibration:** The +12% adversarial factor reflects historically 12–15% higher credit losses from delayed/contested payment workouts. The −7% cooperative factor reflects 5–8% lower losses from swift negotiated resolution. Net effect on the demo fleet ≈ −$0.30M (net cooperative fleet). Floor (`max(baseECL × 0.3, baseECL + delta)`) unchanged.

**IFRS 9 rationale:** Payment behaviour is a forward-looking indicator under IFRS 9 §B5.5.17. Adversarial behaviour (high DPD, government-directed restructuring, contested repossession) increases effective LGD. Cooperative behaviour (proactive payment, quick restructuring cooperation) reduces effective LGD. The adjustment captures behavioural LGD variance not already covered by CTC jurisdiction scores (which measure legal enforceability, not payment willingness).

**Guard:** When `coopPct === 0 && advPct === 0`, feature is inactive → `payBehaviourDelta = 0`. All-neutral fleet = 0 adjustment. This is the correct backward-compatible default (neutral, not optimistic).

### Country payment behaviour scores

Scores are stored in `PAYMENT_BEHAVIOUR_SCORES: Record<string, number>` keyed by country name (case-insensitive match against `lessee.country`). Countries absent from the map default to `neutral` tier (score 50).

| Country | Score | Tier | Rationale |
|---|---|---|---|
| United States | 85 | Cooperative | §1110 cure culture, fast workouts, low DPD |
| Canada | 68 | Neutral | Generally cooperative; Air Transat COVID support delayed |
| Ireland | 85 | Cooperative | Strong legal system, Ryanair payment discipline |
| Germany | 78 | Cooperative | Lufthansa bailout but prompt payment history |
| France | 55 | Neutral | Air France state support; moderate DPD history |
| Netherlands | 80 | Cooperative | KLM, strong legal framework |
| Spain | 52 | Neutral | Iberia/Vueling mixed; post-COVID support |
| Italy | 48 | Neutral | ITA Airways restructuring; moderate adversarial risk |
| UAE | 82 | Cooperative | Emirates never missed payment; strong payment culture |
| Singapore | 90 | Cooperative | SIA; government-backed, impeccable payment record |
| Australia | 80 | Cooperative | Qantas; strong legal enforcement, low DPD |
| Japan | 88 | Cooperative | JAL/ANA; cultural obligation to honour obligations |
| South Korea | 75 | Cooperative | Korean Air; restructured cleanly |
| India | 42 | Neutral | IndiGo strong payer; government interference risk in sector |
| Sri Lanka | 28 | Adversarial | SriLankan Airlines; chronic losses, government-directed restructuring |
| Indonesia | 30 | Adversarial | Garuda Indonesia; PKPU history, government interference |
| Mexico | 32 | Adversarial | Aeromexico Ch11 2020; contested lessor recoveries |
| Brazil | 38 | Adversarial | Azul/Gol/LATAM restructuring history; RJ complications |
| Colombia | 35 | Adversarial | Avianca Ch11; complex cross-border restructuring |
| Argentina | 20 | Adversarial | Currency controls, sovereign risk, Aerolíneas nationalisation |
| South Africa | 38 | Adversarial | SAA multiple bailouts; long restructuring timelines |
| Kenya | 35 | Adversarial | Kenya Airways government-directed; unpredictable payment |
| Ethiopia | 45 | Neutral | Ethiopian Airlines; strong government-backed payer |
| Nigeria | 25 | Adversarial | FX restrictions; lessor repatriation difficulties |
| Pakistan | 22 | Adversarial | PIA; chronic losses, government interference, FX controls |
| Russia | 15 | Adversarial | Sanctions; asset stranding; treaty non-compliance |
| Turkey | 42 | Neutral | Turkish Airlines; improving payment record post-2022 |
| Qatar | 88 | Cooperative | Qatar Airways; government-backed, impeccable record |
| Saudi Arabia | 75 | Cooperative | Saudia/Riyadh Air; government support, strong FX |
| China | 45 | Neutral | Mixed; government support can cut both ways |
| Thailand | 40 | Neutral | Thai Airways restructuring completed; cautious neutral |
| Malaysia | 42 | Neutral | MAS restructuring completed; borderline |
| Philippines | 35 | Adversarial | Philippine Airlines Ch11; contested repossessions |

### Demo fleet calibration

| Lessee | Country | Score | Tier | Monthly Rent |
|---|---|---|---|---|
| Emirates | UAE | 82 | Cooperative | $1,240k |
| Singapore Airlines | Singapore | 90 | Cooperative | $1,050k |
| Air France | France | 55 | Neutral | $960k |
| SriLankan Airlines | Sri Lanka | 28 | Adversarial | $480k |
| Ryanair | Ireland | 85 | Cooperative | $340k |
| Aeromexico | Mexico | 32 | Adversarial | $310k |
| Azul | Brazil | 38 | Adversarial | $295k |
| IndiGo | India | 42 | Neutral | $285k |
| Air Transat | Canada | 68 | Neutral | $275k |
| Lufthansa | Germany | 78 | Cooperative | $220k |

Total fleet rental: $5,455k/mo

- Cooperative: Emirates + Singapore + Ryanair + Lufthansa = $2,850k → **52.2%**
- Neutral: Air France + IndiGo + Air Transat = $1,520k → **27.9%**  
- Adversarial: SriLankan + Aeromexico + Azul = $1,085k → **19.9%**

ECL impact: `(0.199 × 0.12 − 0.522 × 0.07) × $47.2M ≈ −$0.30M`

### DSL new keywords

```json
"pay_behaviour_coop_pct": 0.522,
"pay_behaviour_adv_pct": 0.199
```

Both omitted from generated DSL when zero. Round-trip with the form. `advPct` clamped in parseDSL so `coopPct + advPct ≤ 1`.

---

## UI — `PaymentBehaviourTab.tsx` (new file)

Rendered in the Scenarios page as a new tab "Payment Behaviour", positioned after "Security Deposits".

### Header KPI row (3 cards)

| KPI | Value | Colour logic |
|---|---|---|
| Cooperative | X% of fleet by rental | Always green |
| Adversarial | X% of fleet by rental | Red if >30%, amber if >15%, green otherwise |
| Net ECL Impact | ±$X.XM | Green if negative (net benefit), red if positive (net penalty), grey if zero |

### Lessee breakdown table

Columns: Airline · Country · Score · Behaviour Tier · Monthly Rent · Weight %

- Tier shown as colour-coded pill: green (Cooperative), amber (Neutral), red (Adversarial)
- Sorted by score ascending (worst first), then by monthly rent descending
- No totals row (weight % already sums to 100%)

### "Use in Custom Builder" button

Below the table. On click: switches to Custom Builder tab and pre-fills both `coopPct` and `advPct` from portfolio values.

---

## UI — Custom Builder: "Payment Behaviour" section

Collapsible section below "Security Deposits". Same visual pattern.

### Header

- Label: **"Payment Behaviour"**
- Badge: shows `X% Coop / X% Adv` when non-zero; `"None (neutral baseline)"` when both zero
- Collapsed by default; auto-expands when either field is non-zero

### Body

Two sliders, each 0–100%, step 1%:

| Control | Range | Step | Unit |
|---|---|---|---|
| Cooperative % | 0–1 | 0.01 | % of fleet by rental |
| Adversarial % | 0–1 | 0.01 | % of fleet by rental |

Coop slider clamped: `coopPct ≤ max(0, 1 − advPct)`
Adv slider clamped: `advPct ≤ max(0, 1 − coopPct)`

- **"From portfolio" button**: auto-fills both from computed portfolio mix. Tooltip: "Computed from your portfolio's lessee countries, weighted by monthly rental."

### Net impact line

```
Behaviour Adjustment  +/−$X.XM  ·  X% Coop / X% Adv
```

Green when net negative (cooperative fleet), red when net positive (adversarial fleet), grey when zero.

---

## Out of Scope

- Per-lessee DPD time series (captured in Lessee Behaviour Scorer, Sprint 9)
- Manual score override per lessee
- Per-country score sourced from live data feed (static table only)
- Decomposed sub-scores (DPD propensity / restructuring cooperation / govt bailout separately)
- Integration with watchlist early warning triggers
