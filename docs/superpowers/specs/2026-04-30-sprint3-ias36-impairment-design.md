# Sprint 3 — F03: IAS 36 Impairment Tab Design

**Date:** 2026-04-30  
**Status:** Approved  
**Scope:** Add "IAS 36 Impairment" tab to the Risk & ECL page

---

## 1. Architecture

### File changes

| File | Change |
|------|--------|
| `src/app/components/risk-ecl/IAS36Tab.tsx` | **New** — all IAS 36 data, logic, and UI |
| `src/app/pages/RiskECL.tsx` | **Minimal** — add tab string, import, render `<IAS36Tab />` |

All other files unchanged. Follows the existing pattern of `ECLDrilldownPanel.tsx` and `RunResultPanel.tsx` — one feature, one file.

### RiskECL.tsx changes (3 lines total)
1. Add `"IAS 36 Impairment"` to the `tabs` array (after `"SICR Config"`)
2. Import `IAS36Tab` from `../components/risk-ecl/IAS36Tab`
3. Add `{activeTab === "IAS 36 Impairment" && <IAS36Tab />}` in the tab content block

---

## 2. Data Model

All data is static typed constants inside `IAS36Tab.tsx`. No backend, no API.

```ts
interface AircraftIAS36 {
  msn: string;
  type: string;
  lessee: string;
  carryingAmount: number;   // NBV $M — from Portfolio aircraft data
  usefulLifeYears: number;  // remaining economic life
  wacc: number;             // discount rate as decimal (e.g. 0.0575)
  cashflows: number[];      // contractual rent $M per year, length = usefulLifeYears
  residualValue: number;    // expected end-of-life value $M
  fvlcd: number;            // fair value less costs of disposal $M
  priorImpairments: number; // cumulative prior IAS 36 losses $M (reversal ceiling input)
}
```

**6 aircraft pre-seeded** with values consistent with the Portfolio page NBV/MV data:
- MSN 9218 — A320neo (IndiGo, carrying $24.2M)
- MSN 41234 — B737-800 (Aeromexico, carrying $32.1M)
- MSN 62047 — B777-300ER (Emirates, carrying $88.4M)
- MSN 1728 — A330-300 (SriLankan, carrying $34.2M)
- MSN 67892 — B737 MAX 8 (Ryanair, carrying $44.7M)
- MSN 0378 — A350-900 (Air France, carrying $68.3M)

---

## 3. Calculations

All computed inline in the component from editable state. No async, no memoization needed at this scale.

### VIU (Value in Use)
```
VIU = Σ [ cashflow_t / (1 + wacc)^t ]  for t = 1..usefulLifeYears
    + residualValue / (1 + wacc)^usefulLifeYears
```

### Recoverable Amount
```
recoverableAmount = max(fvlcd, viu)
```

### Impairment Loss
```
impairmentLoss = max(0, carryingAmount - recoverableAmount)
```

### Reversal Ceiling (IAS 36.117)
```
originalCostEstimate = carryingAmount + priorImpairments
straightLineDepreciation = originalCostEstimate / (usefulLifeYears + yearsAlreadyElapsed)
depreciatedHistoricCost = originalCostEstimate - (straightLineDepreciation × yearsAlreadyElapsed)
reversalCeiling = depreciatedHistoricCost - carryingAmount
```
Where `yearsAlreadyElapsed` is derived from lease vintage (current year minus vintage year from aircraft data).

### Reversal
```
reversal = max(0, min(recoverableAmount - carryingAmount, reversalCeiling))
```
Only shown when `priorImpairments > 0` and `recoverableAmount > carryingAmount`.

---

## 4. UI Layout

Two-panel layout (flex row, no modal):

### Left panel — Aircraft selector (~280px fixed width)
- One row per aircraft: `[Type badge] [MSN] [Lessee]` + status badge
- Status badge variants:
  - Grey "No Impairment" — `impairmentLoss === 0 && reversal === 0`
  - Red "Impairment $XM" — `impairmentLoss > 0`
  - Green "Reversal $XM" — `reversal > 0`
- Selected row highlighted with Oxford Blue left border accent

### Right panel — Workspace (flex 1)
Three stacked `<Card>` components:

**Card 1 — Inputs**
- Editable fields: Carrying Amount, Useful Life (years), WACC (%), Residual Value, FVLCD
- Cashflow table: one row per year, editable `$M` field per year
- "Reset to defaults" text link — restores to seeded values for selected aircraft

**Card 2 — Results**
- Row: VIU | FVLCD | Recoverable Amount | Impairment Loss / Reversal | Reversal Ceiling
- Large value display with colour coding: red for impairment loss > 0, green for reversal > 0, default for others
- "Show Calculation" collapsible section:
  - DCF table: Year | Cashflow | Discount Factor | Present Value
  - Summary row: Sum of PVs + Residual PV = VIU
  - Then: max(FVLCD, VIU) = Recoverable Amount
  - Then: Carrying − Recoverable = Impairment Loss (or Reversal)

**Card 3 — Export**
- Title: "Auditor Evidence Pack"
- Subtitle: "JSON export of all inputs and computed outputs"
- "Download Evidence Pack (JSON)" button
- On click: serialises `{ aircraft, inputs, outputs, timestamp, hash }` to a `.json` file
- Hash: SHA-256 of the serialised inputs+outputs via `crypto.subtle.digest` (client-side, async)
- File name: `ias36-evidence-[msn]-[YYYY-MM-DD].json`

---

## 5. State Management

All state in `IAS36Tab.tsx` via `useState`. No prop drilling into RiskECL.tsx.

```ts
// selected aircraft index
const [selectedIdx, setSelectedIdx] = useState(0);

// per-aircraft editable inputs — initialised from seeded data
const [inputs, setInputs] = useState<AircraftIAS36[]>(DEFAULT_AIRCRAFT);

// "show calculation" toggle per aircraft
const [showCalc, setShowCalc] = useState(false);
```

Editing any input field calls `setInputs` with an updated copy — results recompute on next render.

---

## 6. Styling Conventions

- Follows existing inline `style={{}}` + Tailwind utility class pattern from RiskECL.tsx
- Uses existing `<Card>`, `<KpiCard>` (for results row), `<PageHeader>` not needed (tab inherits page header)
- Colour palette: `#002147` Oxford Blue, `#DC2626` red impairment, `#16A34A` green reversal, `#475569` muted text
- Editable fields: thin border `#E2E8F0`, `0.375rem` border-radius, focused border `#002147`
- No new dependencies

---

## 7. Out of Scope (this sprint)

- Persistence / saving overrides to any store
- Integration with F02 ECL outputs (Sprint 2 outputs feeding LGD — deferred to Sprint 7 portfolio aggregator)
- Real PDF export (evidence pack is JSON only)
- More than 6 aircraft (expanding to full 173-lease portfolio deferred to Sprint 8 market values work)
