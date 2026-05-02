# Sprint 10 F10 — Bankruptcy Scenario Module Design

## Goal

Add an "Insolvency Regimes" tab to the Scenarios page with a regime library (6 jurisdictions), per-regime detail cards, a branching simulation that computes weighted expected recovery from a lessee + aircraft input, and light integration with the existing Custom Builder tab.

---

## Background

The Scenarios page currently has three tabs: Library (preset macro shocks), Custom Builder (JSON DSL), and Run History. None of these model lessee insolvency at the individual-lease level — the macro scenarios reference bankruptcy events in their descriptions but don't let analysts compute expected recovery under a specific legal regime.

Aviation lessors need jurisdiction-specific insolvency analysis because recovery timelines and haircuts vary dramatically: a US Chapter 11 §1110 cure window (60 days) is fundamentally different from an Indonesian PKPU (up to 270 days) or Indian IBC moratorium (180–270 days). AerCap, Air Lease, and SMBC all publish regime-specific recovery assumptions in their annual reports — this module makes that analysis interactive.

**Target audience:** Portfolio managers assessing a distressed lessee; workout teams computing expected recovery; legal teams preparing enforcement strategies.

---

## Architecture

### File changes

| Action | Path | Change |
|--------|------|--------|
| **Create** | `src/app/components/scenarios/InsolvencyTab.tsx` | All types, regime data, simulation logic, UI — zero props, named export |
| **Modify** | `src/app/pages/Scenarios.tsx` | Import + add "Insolvency Regimes" to `tabs` + one render line + note in Custom Builder JSON template |

Pattern is identical to `IAS36Tab.tsx` (721 lines, zero props, named export).

---

## Regime Library

Six regimes, each with the following fields:

```ts
interface Regime {
  id: string;
  name: string;
  jurisdiction: string;
  flag: string;              // emoji flag
  stayDuration: string;      // e.g. "Automatic stay. 60-day §1110 cure window"
  cureWindow: string;
  executoryContracts: string;
  lessorPriority: "High" | "Moderate-High" | "Moderate" | "Low-Moderate" | "Low";
  priorityNote: string;
  recoveryMonths: { p25: number; p50: number; p75: number; p90: number };
  haircutPct: { p25: number; p50: number; p75: number; p90: number };
  keyRisk: string;
  lesseeExamples: string[];  // portfolio lessees in this jurisdiction
}
```

### Regime Data

**1 — US Chapter 11 (§1110 / §365)**
- Stay: Automatic stay. 60-day §1110 cure window for aircraft leases
- Cure window: 60 days from filing; lessor may repossess if not cured or assumption agreed
- Executory: §365 — trustee may assume or reject; §1110 provides lessor a priority cure mechanism
- Priority: High — §1110 is the gold standard for aviation lessor protection
- Recovery months: P25=6, P50=12, P75=18, P90=36
- Haircut %: P25=0, P50=8, P75=18, P90=35
- Key risk: DIP financing priority may prime some lessor claims in extended cases
- Examples: Aeromexico

**2 — India IBC (CTC Act 2025)**
- Stay: Moratorium under §14 IBC. CTC Act 2025 amends to mandate 90-day cure / repossession window
- Cure window: 90 days (CTC Act 2025). Pre-2025 cases could run 270 days
- Executory: Cape Town Convention applies; CTC Act 2025 requires courts to honour deregistration requests
- Priority: Moderate-High — material improvement from pre-2025 IBC position
- Recovery months: P25=8, P50=18, P75=30, P90=48
- Haircut %: P25=5, P50=15, P75=28, P90=45
- Key risk: Court congestion; political pressure on airline-industry employers
- Examples: IndiGo

**3 — Brazil RJ (Recuperação Judicial)**
- Stay: 180-day initial stay; extensions common (AerCap LATAM precedent: 380 days)
- Cure window: 60 days (CTC in force since 2013 but enforcement mixed)
- Executory: RJ plan must include lease treatment; lessor has retention-of-title claim
- Priority: Moderate — CTC helps but Brazilian courts have historically allowed extensions
- Recovery months: P25=12, P50=24, P75=36, P90=60
- Haircut %: P25=8, P50=20, P75=35, P90=55
- Key risk: RJ plan can cram down lessor with 55% majority creditor vote
- Examples: Azul

**4 — Mexico Concurso Mercantil**
- Stay: Automatic stay on filing; conciliador appointed within 5 days
- Cure window: 90 days from conciliador appointment
- Executory: Contract reviewed by conciliador; CTC in force and Cape Town certificates honoured
- Priority: Moderate — foreign lessor protection strong but concurso can be prolonged
- Recovery months: P25=10, P50=20, P75=36, P90=54
- Haircut %: P25=6, P50=18, P75=32, P90=52
- Key risk: Concurso can convert to quiebra (liquidation) in contested cases
- Examples: Aeromexico (prior 2010 filing precedent)

**5 — Indonesia PKPU (Penundaan Kewajiban Pembayaran Utang)**
- Stay: 45-day initial + up to 270-day maximum suspension of payments
- Cure window: N/A (PKPU is a suspension, not a cure; lessor must negotiate within the plan)
- Executory: PKPU plan requires 50%+ creditor vote by value; not CTC-compliant
- Priority: Low-Moderate — government often pressures for airline continuity; repossession difficult
- Recovery months: P25=12, P50=24, P75=42, P90=72
- Haircut %: P25=10, P50=25, P75=42, P90=65
- Key risk: Indonesia is not a Cape Town Convention signatory for aircraft; no deregistration priority
- Examples: (none in current portfolio — general exposure)

**6 — Generic Civil-Law Liquidation**
- Stay: Immediate stay on appointment of liquidator; no cure mechanism
- Cure window: None — full liquidation process; lessor files as a creditor
- Executory: All executory contracts terminated; lessor ranks with unsecured creditors if no retention-of-title registration
- Priority: Low — pari passu with general unsecured unless perfected security interest
- Recovery months: P25=18, P50=36, P75=60, P90=96
- Haircut %: P25=15, P50=35, P75=55, P90=80
- Key risk: Maximum loss scenario for lessor; used as the baseline floor assumption
- Examples: Applicable to any jurisdiction not covered above

---

## Layout

Two-column grid (`280px | 1fr`):

**Left — Regime Selector**
- Vertical list of 6 regime cards
- Each card: flag + name + jurisdiction + priority badge (colour-coded by priority level)
- Selected: left border `3px solid #002147`, `#F4F5F7` background
- Click to update right panel

**Right — Regime Detail + Simulation**

**Section A: Regime Detail Card**
- Header: flag + name + jurisdiction + priority badge
- 4-column grid:
  - Stay Duration
  - Cure Window
  - Executory Contracts treatment
  - Lessor Priority Note
- Recovery distribution table: P25 | P50 | P75 | P90 in months + haircut %
- Key risk text (amber alert style)
- Examples badge

**Section B: Branching Simulation**
Card title: "Expected Recovery Simulator"

Inputs:
- Lessee selector (dropdown): IndiGo, Aeromexico, SriLankan, Azul, Air Transat, Emirates, or "Custom"
- EAD input ($M) — auto-fills from portfolio data if lessee selected
- Regime auto-fills to lessee's jurisdiction; overrideable
- Slider 1: P(restructure | filing) — 0–100%, default 60%
- Slider 2: P(lease assumed | restructure) — 0–100%, default 45%
- P(rejected | restructure) = 100% − P(assumed|restructure) — derived, shown read-only
- Slider 3: Haircut in rejection scenario (%) — default = selected regime's P50 haircut

Computation:
```
P(full recovery) = P(restructure) × P(assumed|restructure)
P(haircut loss)  = P(restructure) × P(rejected|restructure)
P(liquidation)   = (1 − P(restructure))
Expected recovery % = P(full)*100 + P(haircut)*(100−haircutPct) + P(liq)*(100−regime.haircutPct.p90)
Expected loss $M = EAD × (1 − Expected_recovery%/100)
```

Output panel (3 KPI tiles):
- Expected Recovery % (coloured green/amber/red by threshold)
- Expected Loss $M
- P50 Timeline (months)

Probability tree visual:
- Simple ASCII-style tree rendered in styled divs (no SVG):
  - Filing → Restructure (P%) → Lease Assumed (P%) → Full recovery
  - Filing → Restructure (P%) → Lease Rejected (P%) → Haircut
  - Filing → Liquidation (P%) → P90 haircut

---

## Custom Builder Integration

In `Scenarios.tsx`, the JSON template shown in the Custom Builder tab (the `generateTemplate()` function) gains one additional field:

```json
"bankruptcy_scenario_type": null
```

With an inline comment note added below the template display:
> `// Optional: set to "chapter11", "india_ibc", "brazil_rj", "mexico_concurso", "indonesia_pkpu", or "generic_liquidation" to layer insolvency-specific recovery adjustments. See Insolvency Regimes tab.`

No functional change to `parseDSL` — the field is decorative/informational in this sprint.

---

## Styling Conventions

- Inline `style={{}}` throughout — no CSS modules
- Oxford Blue `#002147` primary
- Priority badge colours:
  - High: `#15803D` green
  - Moderate-High: `#0369A1` blue
  - Moderate: `#B45309` amber
  - Low-Moderate: `#92400E` dark amber
  - Low: `#B91C1C` red
- Recovery table: header row `#F4F5F7`, body alternating `#FFFFFF`/`#F8FAFC`
- Slider track: `#E2E8F0`, thumb `#002147`
- All number inputs: `fontVariantNumeric: "tabular-nums"`

---

## Success Criteria

1. `npm run build` zero errors
2. "Insolvency Regimes" appears as 4th tab in Scenarios
3. All 6 regimes selectable; detail card updates on selection
4. Recovery simulator computes correct weighted output for any combination of sliders
5. Lessee selector auto-fills EAD from portfolio; regime auto-fills to jurisdiction
6. Probability tree visual reflects current slider values
7. Custom Builder JSON template includes the `bankruptcy_scenario_type` note
8. `Scenarios.tsx` line count increases by ≤ 10 lines (all new logic is in `InsolvencyTab.tsx`)

---

## Out of Scope

- Persisting simulation results to Run History
- Connecting insolvency ECL to the main portfolio ECL total
- PDF/export of insolvency analysis
- More than 6 regimes
- Singapore IRDA, UK Administration — can be added in a later sprint
