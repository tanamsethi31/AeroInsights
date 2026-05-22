# Lease Rate Forecasting — Design Spec

**Date:** 2026-05-22
**Feature:** 12-month forward rate intelligence across 18 aircraft types

---

## 1. Overview

A dedicated Lease Rate Forecasting module within the Aero Intelligence section that gives lessors a 12-month forward view of market rental rates across 18 common narrowbody and widebody aircraft types. Forecasts are driven by live macro signals (RPK, Jet-A1, load factor, interest rates, Brent crude). An integrated portfolio overlay shows each lessor's contracted position vs the forecast market rate, colouring leases green/amber/red by how far they sit from market.

---

## 2. Navigation & Location

- **Route:** `/intelligence/rate-outlook`
- **Nav entry:** "Rate Outlook" sub-item under "Aero Intelligence" in the left sidebar
- The Intelligence section already exists at `/intelligence`; this is a new sub-page alongside existing tabs (Macro Signals, Lessee Radar, Deal Feed, Jurisdiction Watch)

---

## 3. Aircraft Type Coverage (18 types)

| # | Type | Category |
|---|------|----------|
| 1 | A320neo | Narrowbody |
| 2 | A321neo | Narrowbody |
| 3 | A319neo | Narrowbody |
| 4 | B737 MAX 8 | Narrowbody |
| 5 | B737 MAX 9 | Narrowbody |
| 6 | B737-800 | Narrowbody |
| 7 | A320ceo | Narrowbody |
| 8 | A321ceo | Narrowbody |
| 9 | A220-300 | Narrowbody |
| 10 | E195-E2 | Regional jet |
| 11 | A330-300 | Widebody |
| 12 | A330-900neo | Widebody |
| 13 | B777-300ER | Widebody |
| 14 | B787-9 | Widebody |
| 15 | B787-8 | Widebody |
| 16 | A350-900 | Widebody |
| 17 | A350-1000 | Widebody |
| 18 | B777X | Widebody |

---

## 4. Forecast Model

### 4.1 Formula

```
forecastRent(t) = baseRent × (1 + Σ signalEffect_i(t)) × seasonalFactor(t)
```

Where `t` = months from today (1–12).

### 4.2 Base Rates

Static lookup table keyed by aircraft type — the mid-market monthly rent at current vintage/age (approximately 2–5 years old aircraft):

```typescript
const BASE_MONTHLY_RENT_USD: Record<AircraftType, number> = {
  "A320neo":    390_000,
  "A321neo":    440_000,
  "A319neo":    310_000,
  "B737 MAX 8": 415_000,
  "B737 MAX 9": 450_000,
  "B737-800":   350_000,
  "A320ceo":    310_000,
  "A321ceo":    360_000,
  "A220-300":   330_000,
  "E195-E2":    280_000,
  "A330-300":   660_000,
  "A330-900neo":720_000,
  "B777-300ER": 1_020_000,
  "B787-9":     950_000,
  "B787-8":     880_000,
  "A350-900":   1_050_000,
  "A350-1000":  1_150_000,
  "B777X":      1_200_000,
};
```

### 4.3 Macro Signals

Five signals, each computed once and applied across all types with type-category weights:

| Signal | Source Key | Effect per unit | NB weight | WB weight |
|--------|-----------|----------------|-----------|-----------|
| RPK growth (YoY %) | `macro.rpkGrowth` | +0.4% rent per +1% RPK | 1.0× | 0.9× |
| Jet-A1 price (USD/tonne) | `macro.jetA1` | −0.3% per +$50 above $800 | 0.8× | 1.2× |
| Load factor (%) | `macro.loadFactor` | +0.5% per +1pp above 80% | 1.0× | 1.0× |
| 10Y USD rate (%) | `macro.usdRate10y` | −0.6% per +1pp | 0.7× | 1.3× |
| Brent crude (USD/bbl) | `macro.brentCrude` | −0.2% per +$10 above $70 | 0.5× | 0.8× |

### 4.4 Seasonal Factor

Sinusoidal curve peaking in June (+2%) and troughing in January (−2%):

```typescript
seasonalFactor(t: number): number {
  const month = (new Date().getMonth() + t) % 12;
  return 1 + 0.02 * Math.sin((month / 12) * 2 * Math.PI);
}
```

### 4.5 Confidence Band

P25 = forecast × 0.93, P75 = forecast × 1.07 (±7% band representing market bid-ask spread).

### 4.6 Derived Metrics per Type per Month

- **Monthly rent (USD):** raw forecast value
- **LRF (%):** `forecastRent / aircraftNBV × 100` — NBV from static half-life table (age 3 assumed)
- **MoM trend (%):** `(forecastRent(t) − forecastRent(t−1)) / forecastRent(t−1) × 100`
- **vs Baseline (%):** `(forecastRent(t) − baseRent) / baseRent × 100`

---

## 5. Data Sources

### 5.1 Live Macro Data

The platform already fetches macro signals in the Intelligence section. The forecasting engine reads from the same `macro` store already used by `Macro Signals` and `Scenario Builder`. No new API calls needed.

### 5.2 Static Aircraft Data

Base rents and NBV references are compile-time constants in a new file `src/app/data/rateOutlookData.ts`. No external API required for demo/default state.

### 5.3 Demo Mode

When `!hasUpload`, the portfolio overlay shows 6 demo aircraft from `LEASE_CONTEXT` (the existing demo portfolio). When `hasUpload`, it reads from live lease data in Supabase.

---

## 6. New Files

| File | Responsibility |
|------|---------------|
| `src/app/data/rateOutlookData.ts` | Base rents, NBV table, aircraft type definitions, 18-type list |
| `src/app/utils/rateForecaster.ts` | `forecastRates(macroSignals, horizonMonths)` — pure computation engine |
| `src/app/hooks/useRateOutlook.ts` | React hook: reads macro signals, runs engine, returns typed results |
| `src/app/components/rate-outlook/RateOutlookGrid.tsx` | 18-row grid with inline sparklines and metric columns |
| `src/app/components/rate-outlook/RateOutlookChart.tsx` | Recharts LineChart with confidence band for a selected aircraft type |
| `src/app/components/rate-outlook/PortfolioRateOverlay.tsx` | Contracted vs market overlay panel |
| `src/app/components/rate-outlook/RateOutlookKPIStrip.tsx` | 4 summary KPI cards above the grid |
| `src/app/pages/intelligence/RateOutlook.tsx` | Page component: filter bar, view toggle, composes all sub-components |

---

## 7. User Interface

### 7.1 Page Layout (top → bottom)

1. **Page header:** "Rate Outlook" + subtitle "12-month forward rate intelligence · 18 aircraft types"
2. **KPI Strip** (4 cards):
   - Avg LRF (NB): current portfolio average LRF for narrowbodies
   - Avg LRF (WB): widebodies
   - 12-mo NB outlook: expected % change in NB rents
   - 12-mo WB outlook: expected % change in WB rents
3. **Filter bar:** Category filter (All / Narrowbody / Widebody / Regional), metric toggle (Rent | LRF | vs Baseline | Trend), view toggle (Grid ⊞ | Chart ≡)
4. **Grid view** (default): 18 rows, columns: Type · Current Rent · LRF · 3-mo trend · 12-mo outlook · Sparkline (12 bars) · Portfolio Position badge
5. **Chart view**: Dropdown to select aircraft type, Recharts LineChart showing 12 months, lines: Forecast (solid), P25 (dashed), P75 (dashed), Contracted Rate (horizontal dotted, only when portfolio data present)
6. **Portfolio Overlay panel** (bottom, collapsible): table of lessor's leases of the selected type, columns: Lessee · Contracted Rate · Market Forecast · Spread · Position (badge)

### 7.2 View Toggle Behaviour

- Grid and Chart are mutually exclusive, toggled by the ⊞/≡ buttons
- Clicking a row in Grid view switches to Chart view for that type
- Chart view has a "Back to Grid" link

### 7.3 Portfolio Position Badge Logic

```
spread = contractedRate - marketForecast(t=1)  // 1-month-ahead forecast
if spread ≥ +$20k: badge = "Above Market" (green)
if spread ≤ −$20k: badge = "Below Market" (red)
else: badge = "At Market" (amber)
```

### 7.4 Demo Mode Behaviour

- When `!hasUpload`: Portfolio Overlay panel shows 6 demo leases with a "DEMO DATA" badge
- The grid and chart forecasts are identical regardless — they are macro-driven, not upload-dependent

---

## 8. TypeScript Types

```typescript
// src/app/data/rateOutlookData.ts

export type AircraftType =
  | "A320neo" | "A321neo" | "A319neo"
  | "B737 MAX 8" | "B737 MAX 9" | "B737-800"
  | "A320ceo" | "A321ceo" | "A220-300" | "E195-E2"
  | "A330-300" | "A330-900neo" | "B777-300ER"
  | "B787-9" | "B787-8" | "A350-900" | "A350-1000" | "B777X";

export type AircraftCategory = "Narrowbody" | "Widebody" | "Regional";

export interface AircraftTypeMeta {
  type: AircraftType;
  category: AircraftCategory;
  baseRentUSD: number;
  nbvUSD: number; // half-life base value, age-3 assumed
}

// src/app/utils/rateForecaster.ts

export interface MacroInputs {
  rpkGrowth: number;   // YoY %
  jetA1: number;       // USD/tonne
  loadFactor: number;  // %
  usdRate10y: number;  // %
  brentCrude: number;  // USD/bbl
}

export interface MonthlyRateForecast {
  month: number;       // 1–12
  rentUSD: number;
  lrf: number;         // %
  p25: number;
  p75: number;
  momPct: number;
  vsBaselinePct: number;
}

export interface TypeForecast {
  type: AircraftType;
  category: AircraftCategory;
  current: MonthlyRateForecast;  // month=0 (today)
  forecast: MonthlyRateForecast[]; // months 1–12
  sparkline: number[];            // 12 rent values for the miniature bar
  outlookPct: number;             // (month12rent - baseRent) / baseRent × 100
}

export interface RateOutlookResult {
  generatedAt: string; // ISO timestamp
  macroInputs: MacroInputs;
  types: TypeForecast[];
}
```

---

## 9. Hook API

```typescript
// useRateOutlook.ts
export interface RateOutlookHookResult {
  data: RateOutlookResult | null;
  loading: boolean;
  error: string | null;
}

export function useRateOutlook(): RateOutlookHookResult
```

The hook:
1. Reads macro signals from the existing macro data store (same source as Macro Signals tab)
2. Calls `forecastRates(macroInputs, 12)`
3. Returns typed `RateOutlookResult`
4. Memoises on macro inputs (shallow compare)

---

## 10. Navigation Wiring

The existing Intelligence page at `/intelligence` uses tab-based navigation. Rate Outlook is added as a new tab:

- **Tab label:** "Rate Outlook"
- **Tab icon:** `TrendingUp` (Lucide)
- Route: `/intelligence/rate-outlook` (or tab-based state — match existing Intelligence nav pattern)

Check `src/app/pages/intelligence/` and the Intelligence layout component to determine whether it uses URL params or local state for tab selection, and follow the existing pattern exactly.

---

## 11. Portfolio Overlay Data

### 11.1 When `hasUpload = true`

Query live leases from Supabase filtered by aircraft type (join via `assets` table). Show contracted monthly rent from the lease register.

### 11.2 When `hasUpload = false` (demo mode)

Use `LEASE_CONTEXT` + `DEMO_LEASES` (the 6 demo aircraft already defined in `src/app/data/demoCashFlowLeases.ts`). Map each to its aircraft type to look up the market forecast.

### 11.3 Overlay Columns

| Column | Source |
|--------|--------|
| Lessee | `lessee_id` (or demo lessee name) |
| Aircraft | `assets.aircraft_type` (or demo type) |
| Contracted rent (USD/mo) | `leases.monthly_rental` |
| Market forecast (USD/mo) | `TypeForecast.forecast[0].rentUSD` for this type |
| Spread | contracted − market |
| Position | Above Market / At Market / Below Market badge |

---

## 12. Error & Loading States

- **Loading:** Skeleton rows in grid (same pattern as existing Lease Register skeleton)
- **No macro data:** "Macro signals unavailable — forecast requires live data" info card
- **Missing aircraft type:** Row shows "—" for all metrics, no sparkline
- All error states use the platform's existing `<EmptyState>` component pattern

---

## 13. Out of Scope

- Actual external API calls for live rate data (base rents are static compile-time constants)
- Historical rate time series (no database table for historical rates)
- Per-vintage age adjustments (all forecasts assume age-3 base)
- PDF/CSV export of forecasts (can be added in a later sprint)
- Alerts or threshold notifications

---

## 14. Success Criteria

1. `/intelligence/rate-outlook` renders without errors
2. Grid shows all 18 aircraft types with 12-month outlook % and sparkline bars
3. Chart view shows Recharts LineChart with confidence band for any selected type
4. View toggle switches between Grid and Chart without page reload
5. Portfolio Overlay shows demo leases with correct spread and position badge in demo mode
6. KPI Strip shows non-zero LRF values derived from the forecast model
7. Category filter correctly hides/shows rows
8. No `VITE_` env vars added for this feature (no secrets on frontend)
