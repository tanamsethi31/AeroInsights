# Bankruptcy Scenario Granularity — Design Spec

**Date:** 2026-05-10
**Context:** ELFC exec feedback identified Ch.11 vs Ch.7 granularity as a gap — bankruptcy nuance is currently baked into LGD assumptions rather than being a controllable scenario variable. This spec wires `bankruptcyScenarioType` into the ECL formula and surfaces it in the Custom Builder and Library.

---

## Goal

Add insolvency regime as an explicit, user-visible lever in the Scenarios page Custom Builder. Selecting a regime applies a pre-calibrated LGD adjustment to `computeECLFromBase`. Six Library cards provide pre-built insolvency scenarios. The existing Insolvency Regimes tab (standalone recovery simulator) is untouched.

## Architecture

Two additive changes, no new files:

1. **`eclCalculator.ts`** — add `bankruptcyScenarioType: string | null` to `ScenarioInputs`; add `LGD_DELTAS` constant; extend `computeECLFromBase` with `lgdDelta` term.
2. **`Scenarios.tsx`** — DSL round-trip; 6 new Library cards in "Insolvency Scenarios" sub-group; collapsible "Insolvency Regime" section in Custom Builder.

No new files. No new routes. `InsolvencyTab.tsx` untouched.

---

## Data Model

### New `ScenarioInputs` field

| Field | Type | Default | Description |
|---|---|---|---|
| `bankruptcyScenarioType` | `string \| null` | `null` | Insolvency regime key; null = no adjustment |

Valid values: `"chapter11"`, `"india_ibc"`, `"brazil_rj"`, `"mexico_concurso"`, `"indonesia_pkpu"`, `"generic_liquidation"`.

Default `null` in `ZERO_INPUTS` — zero ECL impact on all existing scenarios.

### LGD calibration table

Anchored to P50 haircut data from `InsolvencyTab.tsx`. Applied as a fraction of `baseECL`.

| Key | P50 Haircut | Delta | Rationale |
|---|---|---|---|
| `chapter11` | 8% | **−0.12** | §1110 cure window; gold standard for lessor recovery |
| `india_ibc` | 15% | **−0.05** | CTC Act 2025 improvement; slower than US |
| `mexico_concurso` | 18% | **+0.02** | CTC in force; roughly neutral |
| `brazil_rj` | 20% | **+0.04** | AerCap LATAM precedent; up to 380-day stay |
| `indonesia_pkpu` | 25% | **+0.09** | Not CTC-compliant; government pressure to continue ops |
| `generic_liquidation` | 35% | **+0.18** | Full loss floor; lessor ranks pari passu |

### ECL formula extension (`computeECLFromBase`)

```
lgdDelta = (LGD_DELTAS[bankruptcyScenarioType] ?? 0) × baseECL
delta += lgdDelta
```

Existing macro, deferral, and mitigation terms unchanged. Floor at `baseECL × 0.3` unchanged.

### DSL new keyword

```json
"bankruptcy_scenario_type": "chapter11"
```

Round-trips with the form. Existing DSL without the field parses with `?? null` fallback — fully backwards compatible. The field was previously a decorative comment; this sprint makes it functional.

---

## UI — Custom Builder: "Insolvency Regime" section

Added below the existing "Distress & Mitigation" section. Visually matches the existing collapsible section pattern.

### Header
- Label: **"Insolvency Regime"**
- Badge: short regime name when selected (e.g. `"Ch.11 §1110"`); `"None selected"` in muted grey when null
- Chevron rotate animation on expand/collapse
- Collapsed by default; auto-expands when any regime is set (e.g. via Library pre-fill or DSL parse)

### Body
- Full-width `<select>` dropdown styled to match form:
  - None (no regime adjustment)
  - 🇺🇸 US Chapter 11 (§1110)
  - 🇮🇳 India IBC
  - 🇲🇽 Mexico Concurso Mercantil
  - 🇧🇷 Brazil RJ (Recuperação Judicial)
  - 🇮🇩 Indonesia PKPU
  - 🌐 Generic Liquidation (Ch.7 / Civil-Law)
- One-line regime description below dropdown (key risk text per regime)
- **LGD impact line** (hidden when null):
  ```
  LGD adjustment  −$5.7M  ·  Ch.11 recovery premium
  ```
  Green if ECL decreases (chapter11, india_ibc), red if ECL increases (others).

### Reset behaviour
Reset to Baseline sets `bankruptcyScenarioType` to `null` and collapses the section.

---

## UI — Library: Insolvency Scenario cards

A "Insolvency Scenarios" sub-label appears below the existing "Distress Scenarios" group. Six new cards with `category: "insolvency"`.

### Card 1 — US Ch.11 §1110 Restructuring
**Tags:** `Ch.11` `§1110` `Lessor-Favorable`
**Inputs:** `pdS3Multi: 2.0, deferralMonths: 3, bankruptcyScenarioType: "chapter11"` (all distress fields 0 except deferralMonths)
**ECL:** $59.7M
**Description:** Lessee files Chapter 11. §1110 gives lessor a 60-day cure window — lease assumed or lessor repossesses. Strong recovery premium relative to other regimes.

### Card 2 — India IBC Restructuring
**Tags:** `IBC` `CTC 2025` `Moderate`
**Inputs:** `pdS3Multi: 2.5, rpkDelta: -0.10, bankruptcyScenarioType: "india_ibc"`
**ECL:** $76.9M
**Description:** Lessee enters IBC moratorium. CTC Act 2025 mandates 90-day repossession window. Court congestion and political pressure on airline employers remain tail risks.

### Card 3 — Mexico Concurso Mercantil
**Tags:** `Concurso` `CTC` `Moderate`
**Inputs:** `pdS3Multi: 1.8, rpkDelta: -0.10, bankruptcyScenarioType: "mexico_concurso"`
**ECL:** $67.5M
**Description:** Lessee enters Concurso. CTC in force; conciliador reviews leases within 90 days. Extended cases can convert to quiebra (liquidation).

### Card 4 — Brazil RJ (Recuperação Judicial)
**Tags:** `RJ` `Extended Stay` `Cram-down Risk`
**Inputs:** `pdS3Multi: 2.0, rpkDelta: -0.15, bankruptcyScenarioType: "brazil_rj"`
**ECL:** $74.5M
**Description:** Lessee files RJ. 180-day initial stay with extensions common (AerCap LATAM precedent: 380 days). RJ plan can cram down lessor with 55% creditor vote majority.

### Card 5 — Indonesia PKPU
**Tags:** `PKPU` `Non-CTC` `High Risk`
**Inputs:** `pdS3Multi: 2.5, rpkDelta: -0.15, bankruptcyScenarioType: "indonesia_pkpu"`
**ECL:** $85.9M
**Description:** Lessee enters PKPU suspension. Indonesia is not a Cape Town Convention signatory. Up to 270-day maximum suspension; government typically pressures for airline continuity.

### Card 6 — Generic Ch.7 / Civil-Law Liquidation
**Tags:** `Ch.7` `Liquidation` `Full Loss`
**Inputs:** `pdS3Multi: 3.5, rpkDelta: -0.25, assetValueDelta: -0.10, bankruptcyScenarioType: "generic_liquidation"`
**ECL:** $118.4M
**Description:** Full liquidation. Lessor ranks pari passu with general unsecured creditors absent perfected security interest. Used as the baseline floor assumption for any jurisdiction not modelled above.

---

## Out of Scope

- Changes to `InsolvencyTab.tsx` (standalone recovery simulator — untouched)
- Per-lessee regime assignment (this is scenario modeling, not actuals tracking)
- More than 6 regimes (Singapore IRDA, UK Administration — future sprint)
- Connecting insolvency ECL to Run History or PDF export
- Probability-weighted simulation inputs in the Custom Builder (already in Insolvency Regimes tab)
