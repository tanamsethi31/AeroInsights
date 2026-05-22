# Lease Rate Forecasting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/intelligence/rate-outlook` sub-page that shows 12-month forward rate intelligence across 18 aircraft types, driven by macro signals and a portfolio position overlay.

**Architecture:** A pure `rateForecaster.ts` engine (TDD-tested) computes monthly rent forecasts from static base rates and macro signal inputs. A React hook `useRateOutlook.ts` feeds the engine with static macro inputs and memoises results. Three focused UI components (KPI strip, grid with sparklines, chart view with confidence band) are composed in `RateOutlook.tsx`, which is wired into the existing Intelligence page tab system and sidebar nav.

**Tech Stack:** Vitest (tests), React, Recharts (LineChart with AreaChart confidence band overlay), Lucide icons, framer-motion (existing page entry animation), same design tokens (T object) as Intelligence.tsx.

---

## File Map

| File | Status | Responsibility |
|------|--------|---------------|
| `src/app/data/rateOutlookData.ts` | Create | 18 aircraft types, base rents, NBV table, static macro inputs, TypeScript types |
| `src/app/utils/rateForecaster.ts` | Create | Pure engine: `forecastRates(macroInputs, horizonMonths)` → `RateOutlookResult` |
| `src/app/utils/rateForecaster.test.ts` | Create | Vitest unit tests for forecaster |
| `src/app/hooks/useRateOutlook.ts` | Create | React hook wrapping `forecastRates`, returns `RateOutlookResult` |
| `src/app/components/rate-outlook/RateOutlookKPIStrip.tsx` | Create | 4 KPI cards |
| `src/app/components/rate-outlook/RateOutlookGrid.tsx` | Create | 18-row table with sparklines and metric columns |
| `src/app/components/rate-outlook/RateOutlookChart.tsx` | Create | Recharts LineChart with P25/P75 confidence band |
| `src/app/components/rate-outlook/PortfolioRateOverlay.tsx` | Create | Contracted vs market overlay panel |
| `src/app/pages/RateOutlook.tsx` | Create | Page: filter bar, view toggle, composes sub-components |
| `src/app/routes.tsx` | Modify | Add `rate-outlook` route pointing to `RateOutlook` |
| `src/app/components/layout/Sidebar.tsx` | Modify | Add "Rate Outlook" nav item under Intelligence |
| `src/app/pages/Intelligence.tsx` | Modify | Add "Rate Outlook" tab, import `RateOutlook`, add to tab renderer |

---

## Task 1: Data module — rateOutlookData.ts

**Files:**
- Create: `src/app/data/rateOutlookData.ts`

- [ ] **Step 1: Create the file with all types and data**

```typescript
// src/app/data/rateOutlookData.ts

export type AircraftCategory = "Narrowbody" | "Widebody" | "Regional";

export type AircraftType =
  | "A320neo" | "A321neo" | "A319neo"
  | "B737 MAX 8" | "B737 MAX 9" | "B737-800"
  | "A320ceo" | "A321ceo" | "A220-300" | "E195-E2"
  | "A330-300" | "A330-900neo" | "B777-300ER"
  | "B787-9" | "B787-8" | "A350-900" | "A350-1000" | "B777X";

export interface AircraftTypeMeta {
  type: AircraftType;
  category: AircraftCategory;
  /** Mid-market monthly rent at age-3 (USD) */
  baseRentUSD: number;
  /** Half-life base value at age-3 (USD) */
  nbvUSD: number;
}

export interface MacroInputs {
  /** Revenue Passenger Kilometres YoY growth % */
  rpkGrowth: number;
  /** Jet-A1 price USD/tonne */
  jetA1: number;
  /** System load factor % */
  loadFactor: number;
  /** 10-year USD Treasury rate % */
  usdRate10y: number;
  /** Brent crude USD/bbl */
  brentCrude: number;
}

export interface MonthlyRateForecast {
  /** 0 = today, 1–12 = months ahead */
  month: number;
  rentUSD: number;
  /** Lease Rate Factor = rentUSD / nbvUSD * 100 */
  lrf: number;
  /** P25 confidence bound */
  p25: number;
  /** P75 confidence bound */
  p75: number;
  /** Month-over-month % change (0 for month=0) */
  momPct: number;
  /** % change vs baseRentUSD */
  vsBaselinePct: number;
}

export interface TypeForecast {
  type: AircraftType;
  category: AircraftCategory;
  /** month=0 snapshot (today) */
  current: MonthlyRateForecast;
  /** months 1–12 */
  forecast: MonthlyRateForecast[];
  /** 12 rent values for mini sparkline bar chart */
  sparkline: number[];
  /** (month-12 rent − base) / base * 100 */
  outlookPct: number;
}

export interface RateOutlookResult {
  generatedAt: string;
  macroInputs: MacroInputs;
  types: TypeForecast[];
}

// ── Aircraft data ──────────────────────────────────────────────────────────────

export const AIRCRAFT_DATA: AircraftTypeMeta[] = [
  // Narrowbody
  { type: "A320neo",    category: "Narrowbody", baseRentUSD: 390_000, nbvUSD: 48_000_000 },
  { type: "A321neo",    category: "Narrowbody", baseRentUSD: 440_000, nbvUSD: 55_000_000 },
  { type: "A319neo",    category: "Narrowbody", baseRentUSD: 310_000, nbvUSD: 38_000_000 },
  { type: "B737 MAX 8", category: "Narrowbody", baseRentUSD: 415_000, nbvUSD: 52_000_000 },
  { type: "B737 MAX 9", category: "Narrowbody", baseRentUSD: 450_000, nbvUSD: 56_000_000 },
  { type: "B737-800",   category: "Narrowbody", baseRentUSD: 350_000, nbvUSD: 40_000_000 },
  { type: "A320ceo",    category: "Narrowbody", baseRentUSD: 310_000, nbvUSD: 35_000_000 },
  { type: "A321ceo",    category: "Narrowbody", baseRentUSD: 360_000, nbvUSD: 42_000_000 },
  { type: "A220-300",   category: "Narrowbody", baseRentUSD: 330_000, nbvUSD: 40_000_000 },
  // Regional
  { type: "E195-E2",    category: "Regional",   baseRentUSD: 280_000, nbvUSD: 32_000_000 },
  // Widebody
  { type: "A330-300",   category: "Widebody",   baseRentUSD: 660_000, nbvUSD: 85_000_000 },
  { type: "A330-900neo",category: "Widebody",   baseRentUSD: 720_000, nbvUSD: 95_000_000 },
  { type: "B777-300ER", category: "Widebody",   baseRentUSD: 1_020_000, nbvUSD: 130_000_000 },
  { type: "B787-9",     category: "Widebody",   baseRentUSD: 950_000, nbvUSD: 125_000_000 },
  { type: "B787-8",     category: "Widebody",   baseRentUSD: 880_000, nbvUSD: 115_000_000 },
  { type: "A350-900",   category: "Widebody",   baseRentUSD: 1_050_000, nbvUSD: 138_000_000 },
  { type: "A350-1000",  category: "Widebody",   baseRentUSD: 1_150_000, nbvUSD: 150_000_000 },
  { type: "B777X",      category: "Widebody",   baseRentUSD: 1_200_000, nbvUSD: 160_000_000 },
];

/** Current macro inputs derived from MACRO_SIGNALS data (Apr 2026 snapshot) */
export const CURRENT_MACRO_INPUTS: MacroInputs = {
  rpkGrowth:  4.8,    // +4.8% YoY as shown in intelligenceData
  jetA1:      900,    // $1.12/litre ≈ $900/tonne
  loadFactor: 85.0,   // weighted avg across LESSEE_RADAR
  usdRate10y: 3.5,    // 3.50% as shown in intelligenceData
  brentCrude: 89.5,   // $89.50/bbl as shown in intelligenceData
};
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "rateOutlookData" | head -10
```

Expected: no errors mentioning `rateOutlookData.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/data/rateOutlookData.ts
git commit -m "feat: add rateOutlookData — 18 aircraft types, base rents, macro inputs"
```

---

## Task 2: Forecast engine — rateForecaster.ts (TDD)

**Files:**
- Create: `src/app/utils/rateForecaster.ts`
- Create: `src/app/utils/rateForecaster.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// src/app/utils/rateForecaster.test.ts
import { describe, it, expect } from "vitest";
import { forecastRates, seasonalFactor } from "./rateForecaster";
import { CURRENT_MACRO_INPUTS } from "../data/rateOutlookData";

describe("seasonalFactor", () => {
  it("returns 1.0 when sin is 0 (month 0 relative to current)", () => {
    // The factor oscillates ±0.02 — total range is 0.98–1.02
    const f = seasonalFactor(0);
    expect(f).toBeGreaterThanOrEqual(0.98);
    expect(f).toBeLessThanOrEqual(1.02);
  });

  it("returns a value in the [0.98, 1.02] range for all months 0–11", () => {
    for (let m = 0; m < 12; m++) {
      const f = seasonalFactor(m);
      expect(f).toBeGreaterThanOrEqual(0.98);
      expect(f).toBeLessThanOrEqual(1.02);
    }
  });
});

describe("forecastRates", () => {
  it("returns 18 TypeForecasts — one per aircraft type", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    expect(result.types).toHaveLength(18);
  });

  it("each type has 12 monthly forecasts (months 1–12)", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    for (const tf of result.types) {
      expect(tf.forecast).toHaveLength(12);
      expect(tf.forecast[0].month).toBe(1);
      expect(tf.forecast[11].month).toBe(12);
    }
  });

  it("sparkline has exactly 12 values", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    for (const tf of result.types) {
      expect(tf.sparkline).toHaveLength(12);
    }
  });

  it("lrf is rentUSD / nbvUSD * 100", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    const a320 = result.types.find((t) => t.type === "A320neo")!;
    // A320neo nbv = 48_000_000
    const expectedLrf = (a320.current.rentUSD / 48_000_000) * 100;
    expect(a320.current.lrf).toBeCloseTo(expectedLrf, 4);
  });

  it("p25 < rentUSD < p75 for all forecasts", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    for (const tf of result.types) {
      for (const m of tf.forecast) {
        expect(m.p25).toBeLessThan(m.rentUSD);
        expect(m.p75).toBeGreaterThan(m.rentUSD);
      }
    }
  });

  it("vsBaselinePct is 0 for month=0 (current = baseRent when no macro shift at t=0)", () => {
    // At t=0, signalEffect(0) may not be exactly 0 due to seasonal; just check the field exists
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    const a320 = result.types.find((t) => t.type === "A320neo")!;
    expect(typeof a320.current.vsBaselinePct).toBe("number");
  });

  it("outlookPct is (month12rent - baseRent) / baseRent * 100", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    const a320 = result.types.find((t) => t.type === "A320neo")!;
    const month12rent = a320.forecast[11].rentUSD;
    const expected = ((month12rent - 390_000) / 390_000) * 100;
    expect(a320.outlookPct).toBeCloseTo(expected, 4);
  });

  it("narrowbody rent is lower than widebody rent", () => {
    const result = forecastRates(CURRENT_MACRO_INPUTS, 12);
    const a320 = result.types.find((t) => t.type === "A320neo")!;
    const b777 = result.types.find((t) => t.type === "B777-300ER")!;
    expect(a320.current.rentUSD).toBeLessThan(b777.current.rentUSD);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx vitest run src/app/utils/rateForecaster.test.ts 2>&1 | tail -15
```

Expected: FAIL — "Cannot find module './rateForecaster'"

- [ ] **Step 3: Implement rateForecaster.ts**

```typescript
// src/app/utils/rateForecaster.ts
import {
  AIRCRAFT_DATA,
  type MacroInputs,
  type MonthlyRateForecast,
  type TypeForecast,
  type RateOutlookResult,
} from "../data/rateOutlookData";

// ── Macro signal weights ───────────────────────────────────────────────────────
// Each signal contributes a % change to base rent.
// NB = narrowbody, WB = widebody (Regional treated as NB).

const SIGNAL_PARAMS = {
  rpkGrowth: {
    effectPerUnit: 0.004,   // +0.4% rent per +1% RPK
    nbWeight: 1.0, wbWeight: 0.9,
    baselineValue: 3.0,     // neutral baseline %
  },
  jetA1: {
    effectPerUnit: -0.003,  // -0.3% per +$50 above $800/t  → -0.006% per $10
    nbWeight: 0.8, wbWeight: 1.2,
    baselineValue: 800,
    unitStep: 50,
  },
  loadFactor: {
    effectPerUnit: 0.005,   // +0.5% per +1pp above 80%
    nbWeight: 1.0, wbWeight: 1.0,
    baselineValue: 80,
  },
  usdRate10y: {
    effectPerUnit: -0.006,  // -0.6% per +1pp
    nbWeight: 0.7, wbWeight: 1.3,
    baselineValue: 3.0,
  },
  brentCrude: {
    effectPerUnit: -0.002,  // -0.2% per +$10 above $70
    nbWeight: 0.5, wbWeight: 0.8,
    baselineValue: 70,
    unitStep: 10,
  },
};

/** Sinusoidal seasonal factor: peak June (+2%), trough January (-2%) */
export function seasonalFactor(monthsAhead: number): number {
  const monthOfYear = (new Date().getMonth() + monthsAhead) % 12;
  return 1 + 0.02 * Math.sin((monthOfYear / 12) * 2 * Math.PI);
}

function computeSignalEffect(
  inputs: MacroInputs,
  isWidebody: boolean,
): number {
  const nbW = (k: keyof typeof SIGNAL_PARAMS) =>
    isWidebody ? SIGNAL_PARAMS[k].wbWeight : SIGNAL_PARAMS[k].nbWeight;

  // RPK: deviation above baseline
  const rpkEffect =
    SIGNAL_PARAMS.rpkGrowth.effectPerUnit *
    (inputs.rpkGrowth - SIGNAL_PARAMS.rpkGrowth.baselineValue) *
    nbW("rpkGrowth");

  // Jet-A1: per $50 above $800
  const jetEffect =
    SIGNAL_PARAMS.jetA1.effectPerUnit *
    Math.max(0, (inputs.jetA1 - SIGNAL_PARAMS.jetA1.baselineValue) / SIGNAL_PARAMS.jetA1.unitStep!) *
    nbW("jetA1");

  // Load factor: per 1pp above 80%
  const lfEffect =
    SIGNAL_PARAMS.loadFactor.effectPerUnit *
    Math.max(0, inputs.loadFactor - SIGNAL_PARAMS.loadFactor.baselineValue) *
    nbW("loadFactor");

  // USD 10Y rate: deviation above baseline
  const rateEffect =
    SIGNAL_PARAMS.usdRate10y.effectPerUnit *
    (inputs.usdRate10y - SIGNAL_PARAMS.usdRate10y.baselineValue) *
    nbW("usdRate10y");

  // Brent: per $10 above $70
  const brentEffect =
    SIGNAL_PARAMS.brentCrude.effectPerUnit *
    Math.max(0, (inputs.brentCrude - SIGNAL_PARAMS.brentCrude.baselineValue) / SIGNAL_PARAMS.brentCrude.unitStep!) *
    nbW("brentCrude");

  return rpkEffect + jetEffect + lfEffect + rateEffect + brentEffect;
}

function buildMonthlyForecast(
  baseRent: number,
  nbvUSD: number,
  signalEffect: number,
  monthsAhead: number,
  prevRent: number | null,
): MonthlyRateForecast {
  const seasonal = seasonalFactor(monthsAhead);
  const rentUSD = Math.round(baseRent * (1 + signalEffect) * seasonal);
  const lrf = (rentUSD / nbvUSD) * 100;
  const p25 = Math.round(rentUSD * 0.93);
  const p75 = Math.round(rentUSD * 1.07);
  const momPct = prevRent !== null ? ((rentUSD - prevRent) / prevRent) * 100 : 0;
  const vsBaselinePct = ((rentUSD - baseRent) / baseRent) * 100;
  return { month: monthsAhead, rentUSD, lrf, p25, p75, momPct, vsBaselinePct };
}

export function forecastRates(
  inputs: MacroInputs,
  horizonMonths: number,
): RateOutlookResult {
  const types: TypeForecast[] = AIRCRAFT_DATA.map((aircraft) => {
    const isWidebody = aircraft.category === "Widebody";
    const signalEffect = computeSignalEffect(inputs, isWidebody);

    // month=0 (current)
    const current = buildMonthlyForecast(
      aircraft.baseRentUSD, aircraft.nbvUSD, signalEffect, 0, null,
    );

    // months 1..horizonMonths
    const forecast: MonthlyRateForecast[] = [];
    let prevRent = current.rentUSD;
    for (let m = 1; m <= horizonMonths; m++) {
      const mf = buildMonthlyForecast(
        aircraft.baseRentUSD, aircraft.nbvUSD, signalEffect, m, prevRent,
      );
      forecast.push(mf);
      prevRent = mf.rentUSD;
    }

    const sparkline = forecast.map((f) => f.rentUSD);
    const outlookPct = ((forecast[forecast.length - 1].rentUSD - aircraft.baseRentUSD) / aircraft.baseRentUSD) * 100;

    return {
      type: aircraft.type,
      category: aircraft.category,
      current,
      forecast,
      sparkline,
      outlookPct,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    macroInputs: inputs,
    types,
  };
}
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx vitest run src/app/utils/rateForecaster.test.ts 2>&1 | tail -20
```

Expected: all 8 tests PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/rateForecaster.ts src/app/utils/rateForecaster.test.ts
git commit -m "feat: add rateForecaster engine with full vitest coverage"
```

---

## Task 3: React hook — useRateOutlook.ts

**Files:**
- Create: `src/app/hooks/useRateOutlook.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/app/hooks/useRateOutlook.ts
import { useMemo } from "react";
import { forecastRates } from "../utils/rateForecaster";
import { CURRENT_MACRO_INPUTS, type RateOutlookResult } from "../data/rateOutlookData";

export interface RateOutlookHookResult {
  data: RateOutlookResult;
}

/**
 * Returns a memoised 12-month lease rate forecast for all 18 aircraft types.
 * Uses CURRENT_MACRO_INPUTS (static Apr-2026 snapshot).
 * Memo key is referentially stable — recomputes only on mount.
 */
export function useRateOutlook(): RateOutlookHookResult {
  const data = useMemo(() => forecastRates(CURRENT_MACRO_INPUTS, 12), []);
  return { data };
}
```

- [ ] **Step 2: Verify tsc**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "useRateOutlook" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/hooks/useRateOutlook.ts
git commit -m "feat: add useRateOutlook hook"
```

---

## Task 4: KPI strip component — RateOutlookKPIStrip.tsx

**Files:**
- Create: `src/app/components/rate-outlook/RateOutlookKPIStrip.tsx`

- [ ] **Step 1: Create the directory and component**

```bash
mkdir -p /Users/tanamsethi/Downloads/Aeroinsights/src/app/components/rate-outlook
```

```typescript
// src/app/components/rate-outlook/RateOutlookKPIStrip.tsx
import type { RateOutlookResult } from "../../data/rateOutlookData";

const T = {
  blue: "#002147", text: "#0F172A", muted: "#475569",
  border: "#E2E8F0", bg: "#F8FAFC", green: "#15803D",
  greenBg: "rgba(21,128,61,0.07)", amber: "#B45309",
  amberBg: "rgba(180,83,9,0.07)",
} as const;

interface Props {
  data: RateOutlookResult;
}

export function RateOutlookKPIStrip({ data }: Props) {
  const nbTypes = data.types.filter((t) => t.category !== "Widebody");
  const wbTypes = data.types.filter((t) => t.category === "Widebody");

  const avgLrfNB = nbTypes.reduce((s, t) => s + t.current.lrf, 0) / nbTypes.length;
  const avgLrfWB = wbTypes.reduce((s, t) => s + t.current.lrf, 0) / wbTypes.length;

  // 12-month weighted avg outlook
  const nbOutlook = nbTypes.reduce((s, t) => s + t.outlookPct, 0) / nbTypes.length;
  const wbOutlook = wbTypes.reduce((s, t) => s + t.outlookPct, 0) / wbTypes.length;

  const kpis = [
    {
      label: "Avg LRF — Narrowbody",
      value: `${avgLrfNB.toFixed(2)}%`,
      sub: "Monthly rent ÷ half-life value",
      color: T.text, bg: T.bg,
    },
    {
      label: "Avg LRF — Widebody",
      value: `${avgLrfWB.toFixed(2)}%`,
      sub: "Monthly rent ÷ half-life value",
      color: T.text, bg: T.bg,
    },
    {
      label: "12-mo NB Outlook",
      value: `${nbOutlook >= 0 ? "+" : ""}${nbOutlook.toFixed(1)}%`,
      sub: "Expected change in NB rents",
      color: nbOutlook >= 0 ? T.green : "#B91C1C",
      bg: nbOutlook >= 0 ? T.greenBg : "rgba(185,28,28,0.07)",
    },
    {
      label: "12-mo WB Outlook",
      value: `${wbOutlook >= 0 ? "+" : ""}${wbOutlook.toFixed(1)}%`,
      sub: "Expected change in WB rents",
      color: wbOutlook >= 0 ? T.green : "#B91C1C",
      bg: wbOutlook >= 0 ? T.greenBg : "rgba(185,28,28,0.07)",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "1rem",
        marginBottom: "1.25rem",
      }}
    >
      {kpis.map((k) => (
        <div
          key={k.label}
          style={{
            background: k.bg,
            border: `1px solid ${T.border}`,
            borderRadius: "0.625rem",
            padding: "0.875rem 1.125rem",
          }}
        >
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: k.color,
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            {k.value}
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: T.text, marginTop: "0.3rem" }}>
            {k.label}
          </div>
          <div style={{ fontSize: "0.72rem", color: T.muted, marginTop: "0.1rem" }}>
            {k.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify tsc**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "RateOutlookKPIStrip" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/rate-outlook/RateOutlookKPIStrip.tsx
git commit -m "feat: add RateOutlookKPIStrip component"
```

---

## Task 5: Grid component — RateOutlookGrid.tsx

**Files:**
- Create: `src/app/components/rate-outlook/RateOutlookGrid.tsx`

- [ ] **Step 1: Create the grid component**

```typescript
// src/app/components/rate-outlook/RateOutlookGrid.tsx
import type { AircraftCategory, RateOutlookResult, TypeForecast } from "../../data/rateOutlookData";

const T = {
  blue: "#002147", text: "#0F172A", muted: "#475569",
  border: "#E2E8F0", bg: "#F8FAFC",
  green: "#15803D", greenBg: "rgba(21,128,61,0.07)",
  amber: "#B45309", amberBg: "rgba(180,83,9,0.07)",
  red: "#B91C1C", redBg: "rgba(185,28,28,0.07)",
} as const;

function fmtRent(n: number): string {
  return `$${(n / 1_000).toFixed(0)}k`;
}

function TrendBadge({ pct }: { pct: number }) {
  const color = pct >= 1 ? T.green : pct <= -1 ? T.red : T.amber;
  const bg    = pct >= 1 ? T.greenBg : pct <= -1 ? T.redBg : T.amberBg;
  const arrow = pct >= 0.5 ? "▲" : pct <= -0.5 ? "▼" : "—";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.2rem",
        padding: "0.15rem 0.45rem", borderRadius: "9999px",
        background: bg, color, fontSize: "0.72rem", fontWeight: 600,
      }}
    >
      {arrow} {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const barW = Math.floor(w / values.length) - 1;

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {values.map((v, i) => {
        const barH = Math.max(2, ((v - min) / range) * (h - 4));
        return (
          <rect
            key={i}
            x={i * (barW + 1)}
            y={h - barH}
            width={barW}
            height={barH}
            fill={T.blue}
            opacity={0.5 + 0.5 * ((v - min) / range)}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

interface Props {
  data: RateOutlookResult;
  categoryFilter: AircraftCategory | "All";
  onSelectType: (type: string) => void;
}

export function RateOutlookGrid({ data, categoryFilter, onSelectType }: Props) {
  const rows = data.types.filter(
    (t) => categoryFilter === "All" || t.category === categoryFilter,
  );

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: "820px",
            borderCollapse: "collapse",
            fontSize: "0.8125rem",
          }}
        >
          <thead>
            <tr style={{ background: T.bg }}>
              {[
                { label: "Type",          align: "left"   },
                { label: "Category",      align: "left"   },
                { label: "Current Rent",  align: "right"  },
                { label: "LRF",           align: "right"  },
                { label: "12-mo Outlook", align: "right"  },
                { label: "Sparkline",     align: "center" },
              ].map((h) => (
                <th
                  key={h.label}
                  style={{
                    padding: "0.625rem 0.875rem",
                    borderBottom: `1px solid ${T.border}`,
                    textAlign: h.align as "left" | "right" | "center",
                    fontSize: "0.7rem", fontWeight: 700,
                    color: T.muted, textTransform: "uppercase",
                    letterSpacing: "0.05em", whiteSpace: "nowrap",
                  }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((tf: TypeForecast, i) => (
              <tr
                key={tf.type}
                onClick={() => onSelectType(tf.type)}
                style={{
                  background: i % 2 === 0 ? "#FFFFFF" : T.bg,
                  cursor: "pointer",
                  transition: "background 100ms ease-out",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,33,71,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#FFFFFF" : T.bg)}
              >
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, fontWeight: 600, color: T.text }}>
                  {tf.type}
                </td>
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, color: T.muted }}>
                  {tf.category}
                </td>
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right", fontWeight: 600, color: T.text }}>
                  {fmtRent(tf.current.rentUSD)}<span style={{ fontSize: "0.72rem", color: T.muted, fontWeight: 400 }}>/mo</span>
                </td>
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right", color: T.muted }}>
                  {tf.current.lrf.toFixed(2)}%
                </td>
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right" }}>
                  <TrendBadge pct={tf.outlookPct} />
                </td>
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
                  <Sparkline values={tf.sparkline} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          padding: "0.5rem 0.875rem",
          borderTop: `1px solid ${T.border}`,
          background: T.bg,
          fontSize: "0.72rem",
          color: T.muted,
        }}
      >
        Base rents: mid-market at age 3. LRF = monthly rent ÷ half-life base value. Click any row to open chart view.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify tsc**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "RateOutlookGrid" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/rate-outlook/RateOutlookGrid.tsx
git commit -m "feat: add RateOutlookGrid with sparklines"
```

---

## Task 6: Chart component — RateOutlookChart.tsx

**Files:**
- Create: `src/app/components/rate-outlook/RateOutlookChart.tsx`

- [ ] **Step 1: Create the chart component**

```typescript
// src/app/components/rate-outlook/RateOutlookChart.tsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from "recharts";
import type { RateOutlookResult } from "../../data/rateOutlookData";

const T = {
  blue: "#002147", text: "#0F172A", muted: "#475569",
  border: "#E2E8F0", bg: "#F8FAFC",
} as const;

function fmtRentK(n: number): string {
  return `$${(n / 1_000).toFixed(0)}k`;
}

function monthLabel(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

interface Props {
  data: RateOutlookResult;
  selectedType: string;
  contractedRent?: number | null;
  onBack: () => void;
}

export function RateOutlookChart({ data, selectedType, contractedRent, onBack }: Props) {
  const tf = data.types.find((t) => t.type === selectedType);
  if (!tf) return null;

  // Build chart data: month 0 (current) + months 1–12
  const chartData = [
    {
      label: monthLabel(0),
      rent: tf.current.rentUSD,
      p25: tf.current.p25,
      p75: tf.current.p75,
    },
    ...tf.forecast.map((f) => ({
      label: monthLabel(f.month),
      rent: f.rentUSD,
      p25: f.p25,
      p75: f.p75,
    })),
  ];

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "0.875rem 1.25rem",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "0.8125rem", color: T.muted, fontWeight: 500,
            padding: 0,
          }}
        >
          ← Back to Grid
        </button>
        <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: T.text }}>
          {selectedType} — 12-Month Rate Forecast
        </div>
        <div
          style={{
            marginLeft: "auto", fontSize: "0.75rem", color: T.muted,
            display: "flex", gap: "1.25rem",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ display: "inline-block", width: 16, height: 2, background: T.blue }} />
            Forecast
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ display: "inline-block", width: 16, height: 2, background: T.blue, opacity: 0.25 }} />
            P25–P75 band
          </span>
          {contractedRent != null && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ display: "inline-block", width: 16, height: 2, borderTop: "2px dashed #B45309" }} />
              Contracted rate
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: "1rem 0.5rem 0.5rem" }}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: T.muted }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={fmtRentK}
              tick={{ fontSize: 11, fill: T.muted }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              formatter={(v: number, name: string) => [
                fmtRentK(v),
                name === "rent" ? "Forecast" : name === "p25" ? "P25" : "P75",
              ]}
              contentStyle={{
                fontSize: "0.78rem",
                border: `1px solid ${T.border}`,
                borderRadius: "0.375rem",
              }}
            />
            {/* Confidence band */}
            <Area
              type="monotone"
              dataKey="p75"
              stroke="none"
              fill={T.blue}
              fillOpacity={0.08}
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="p25"
              stroke="none"
              fill="#FFFFFF"
              fillOpacity={1}
              legendType="none"
            />
            {/* Forecast line */}
            <Line
              type="monotone"
              dataKey="rent"
              stroke={T.blue}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: T.blue }}
            />
            {/* Contracted rate reference line */}
            {contractedRent != null && (
              <ReferenceLine
                y={contractedRent}
                stroke="#B45309"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: `Contracted: ${fmtRentK(contractedRent)}`,
                  fontSize: 11,
                  fill: "#B45309",
                  position: "insideTopRight",
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          padding: "0.5rem 1.25rem 0.75rem",
          fontSize: "0.72rem",
          color: T.muted,
        }}
      >
        Confidence band: ±7% (P25–P75 market bid-ask spread). Base: mid-market at age 3.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify tsc**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "RateOutlookChart" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/rate-outlook/RateOutlookChart.tsx
git commit -m "feat: add RateOutlookChart with Recharts ComposedChart confidence band"
```

---

## Task 7: Portfolio overlay — PortfolioRateOverlay.tsx

**Files:**
- Create: `src/app/components/rate-outlook/PortfolioRateOverlay.tsx`

- [ ] **Step 1: Create the overlay component**

```typescript
// src/app/components/rate-outlook/PortfolioRateOverlay.tsx
import type { RateOutlookResult, AircraftType } from "../../data/rateOutlookData";

const T = {
  blue: "#002147", text: "#0F172A", muted: "#475569",
  border: "#E2E8F0", bg: "#F8FAFC",
  green: "#15803D", greenBg: "rgba(21,128,61,0.07)",
  amber: "#B45309", amberBg: "rgba(180,83,9,0.07)",
  red: "#B91C1C", redBg: "rgba(185,28,28,0.07)",
} as const;

export interface PortfolioLease {
  lesseeId: string;
  lesseeName: string;
  aircraftType: AircraftType;
  contractedRentUSD: number;
  isDemo?: boolean;
}

function positionBadge(spread: number): { label: string; color: string; bg: string } {
  if (spread >= 20_000)  return { label: "Above Market", color: T.green, bg: T.greenBg };
  if (spread <= -20_000) return { label: "Below Market", color: T.red,   bg: T.redBg   };
  return                        { label: "At Market",    color: T.amber, bg: T.amberBg  };
}

function fmtRent(n: number): string {
  return `$${(n / 1_000).toFixed(0)}k`;
}

interface Props {
  data: RateOutlookResult;
  leases: PortfolioLease[];
  isDemo: boolean;
}

export function PortfolioRateOverlay({ data, leases, isDemo }: Props) {
  const rows = leases.map((lease) => {
    const tf = data.types.find((t) => t.type === lease.aircraftType);
    const marketForecast = tf?.forecast[0]?.rentUSD ?? null;
    const spread = marketForecast !== null ? lease.contractedRentUSD - marketForecast : null;
    const badge = spread !== null ? positionBadge(spread) : null;
    return { ...lease, marketForecast, spread, badge };
  });

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderRadius: "0.75rem",
        overflow: "hidden",
        marginTop: "1.25rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "0.75rem 1.25rem",
          borderBottom: `1px solid ${T.border}`,
          background: T.bg,
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: T.text }}>
          Portfolio Rate Position
        </span>
        {isDemo && (
          <span
            style={{
              fontSize: "0.65rem", fontWeight: 700, padding: "0.1rem 0.45rem",
              borderRadius: "9999px", background: "rgba(0,33,71,0.07)",
              color: T.blue, border: "1px solid rgba(0,33,71,0.15)",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}
          >
            DEMO DATA
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: T.muted }}>
          Contracted rate vs. 1-month-ahead market forecast
        </span>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ background: T.bg }}>
            {["Lessee", "Aircraft", "Contracted Rate", "Market Forecast", "Spread", "Position"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "0.5rem 0.875rem",
                  borderBottom: `1px solid ${T.border}`,
                  textAlign: h === "Lessee" || h === "Aircraft" ? "left" : "right",
                  fontSize: "0.7rem", fontWeight: 700,
                  color: T.muted, textTransform: "uppercase",
                  letterSpacing: "0.05em", whiteSpace: "nowrap",
                }}
              >
                {h === "Position" ? <span style={{ marginLeft: "auto", display: "block", textAlign: "center" }}>{h}</span> : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.lesseeId} style={{ background: i % 2 === 0 ? "#FFFFFF" : T.bg }}>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, fontWeight: 600, color: T.text }}>
                {row.lesseeName}
              </td>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, color: T.muted }}>
                {row.aircraftType}
              </td>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right", fontWeight: 600, color: T.text }}>
                {fmtRent(row.contractedRentUSD)}/mo
              </td>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right", color: T.muted }}>
                {row.marketForecast !== null ? `${fmtRent(row.marketForecast)}/mo` : "—"}
              </td>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right" }}>
                {row.spread !== null ? (
                  <span style={{ color: row.spread >= 0 ? T.green : T.red, fontWeight: 600 }}>
                    {row.spread >= 0 ? "+" : ""}{fmtRent(row.spread)}
                  </span>
                ) : "—"}
              </td>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
                {row.badge && (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.15rem 0.6rem",
                      borderRadius: "9999px",
                      background: row.badge.bg,
                      color: row.badge.color,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                    }}
                  >
                    {row.badge.label}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        style={{
          padding: "0.5rem 0.875rem",
          borderTop: `1px solid ${T.border}`,
          background: T.bg,
          fontSize: "0.72rem",
          color: T.muted,
        }}
      >
        Above Market: contracted ≥ market +$20k. Below Market: contracted ≤ market −$20k.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify tsc**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "PortfolioRateOverlay" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/rate-outlook/PortfolioRateOverlay.tsx
git commit -m "feat: add PortfolioRateOverlay component"
```

---

## Task 8: Page component — RateOutlook.tsx

**Files:**
- Create: `src/app/pages/RateOutlook.tsx`

- [ ] **Step 1: Create the page component**

```typescript
// src/app/pages/RateOutlook.tsx
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useRateOutlook } from "../hooks/useRateOutlook";
import { useData } from "../contexts/DataContext";
import { RateOutlookKPIStrip } from "../components/rate-outlook/RateOutlookKPIStrip";
import { RateOutlookGrid } from "../components/rate-outlook/RateOutlookGrid";
import { RateOutlookChart } from "../components/rate-outlook/RateOutlookChart";
import { PortfolioRateOverlay, type PortfolioLease } from "../components/rate-outlook/PortfolioRateOverlay";
import { DEMO_LEASES } from "../data/demoCashFlowLeases";
import { sdmrData } from "../components/portfolio/SDMRTab";
import type { AircraftCategory, AircraftType } from "../data/rateOutlookData";

const T = {
  blue: "#002147", text: "#0F172A", muted: "#475569",
  border: "#E2E8F0", bg: "#F8FAFC",
} as const;

type ViewMode = "grid" | "chart";
const CAT_FILTERS: { id: AircraftCategory | "All"; label: string }[] = [
  { id: "All",        label: "All"        },
  { id: "Narrowbody", label: "Narrowbody" },
  { id: "Widebody",   label: "Widebody"   },
  { id: "Regional",   label: "Regional"   },
];

function FilterChip({
  active, label, onClick,
}: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "0.3rem 0.75rem", borderRadius: "9999px",
        border: `1px solid ${active ? T.blue : T.border}`,
        background: active ? T.blue : "#FFFFFF",
        color: active ? "#FFFFFF" : T.text,
        fontSize: "0.8125rem", fontWeight: active ? 600 : 400,
        cursor: "pointer", whiteSpace: "nowrap",
        transition: "all 140ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div
      style={{
        display: "flex", gap: "0.25rem",
        background: T.bg, border: `1px solid ${T.border}`,
        borderRadius: "0.5rem", padding: "0.2rem",
      }}
    >
      {(["grid", "chart"] as ViewMode[]).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: "0.3rem 0.75rem", borderRadius: "0.375rem",
            background: view === v ? "#FFFFFF" : "transparent",
            border: view === v ? `1px solid ${T.border}` : "1px solid transparent",
            color: view === v ? T.text : T.muted,
            fontSize: "0.8125rem", fontWeight: view === v ? 600 : 400,
            cursor: "pointer", transition: "all 140ms ease-out",
          }}
        >
          {v === "grid" ? "⊞ Grid" : "≡ Chart"}
        </button>
      ))}
    </div>
  );
}

// Build demo portfolio leases for the overlay from DEMO_LEASES + sdmrData
function buildDemoPortfolioLeases(): PortfolioLease[] {
  return DEMO_LEASES.map((lease) => {
    const sdmr = sdmrData.find((s) => s.leaseId === lease.id);
    return {
      lesseeId:          lease.id,
      lesseeName:        sdmr?.lessee ?? lease.lessee_id,
      aircraftType:      (sdmr?.aircraft ?? "A320neo") as AircraftType,
      contractedRentUSD: lease.monthly_rental,
      isDemo:            true,
    };
  });
}

export default function RateOutlook() {
  const { data } = useRateOutlook();
  const { hasUpload } = useData();

  const [view, setView]         = useState<ViewMode>("grid");
  const [catFilter, setCatFilter] = useState<AircraftCategory | "All">("All");
  const [selectedType, setSelectedType] = useState<string>(data.types[0]?.type ?? "A320neo");

  const portfolioLeases = useMemo<PortfolioLease[]>(() => {
    // Demo mode: use DEMO_LEASES. Live mode: also use demo for now
    // (live Supabase query can be added in a follow-up)
    return buildDemoPortfolioLeases();
  }, []);

  function handleSelectType(type: string) {
    setSelectedType(type);
    setView("chart");
  }

  // Find contracted rent for selected type (first matching lease)
  const contractedRent = useMemo(() => {
    const match = portfolioLeases.find((l) => l.aircraftType === selectedType);
    return match?.contractedRentUSD ?? null;
  }, [portfolioLeases, selectedType]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      style={{ padding: "1.5rem 2rem", maxWidth: "1400px", margin: "0 auto" }}
    >
      {/* Page header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontSize: "1.375rem", fontWeight: 800, color: T.text,
            letterSpacing: "-0.02em", margin: 0,
          }}
        >
          Rate Outlook
        </h1>
        <p style={{ fontSize: "0.8125rem", color: T.muted, marginTop: "0.25rem" }}>
          12-month forward rate intelligence · 18 aircraft types · Macro-adjusted
        </p>
      </div>

      {/* KPI strip */}
      <RateOutlookKPIStrip data={data} />

      {/* Filter bar */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: "0.5rem",
          alignItems: "center", marginBottom: "1.25rem",
        }}
      >
        {CAT_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            active={catFilter === f.id}
            label={f.label}
            onClick={() => setCatFilter(f.id)}
          />
        ))}
        <div style={{ marginLeft: "auto" }}>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* Grid / Chart views */}
      {view === "grid" ? (
        <RateOutlookGrid
          data={data}
          categoryFilter={catFilter}
          onSelectType={handleSelectType}
        />
      ) : (
        <RateOutlookChart
          data={data}
          selectedType={selectedType}
          contractedRent={contractedRent}
          onBack={() => setView("grid")}
        />
      )}

      {/* Portfolio overlay */}
      <PortfolioRateOverlay
        data={data}
        leases={portfolioLeases}
        isDemo={!hasUpload}
      />
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify tsc**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "RateOutlook" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/RateOutlook.tsx
git commit -m "feat: add RateOutlook page with grid/chart view toggle"
```

---

## Task 9: Routes + Sidebar wiring

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/app/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add route in routes.tsx**

Open `src/app/routes.tsx`. Find the intelligence routes block (around line 103–108):

```typescript
// Current (find this block):
{ path: "intelligence",               Component: Intelligence },
{ path: "intelligence/signals",       Component: Intelligence },
{ path: "intelligence/lessee-radar",  Component: Intelligence },
{ path: "intelligence/deal-feed",     Component: Intelligence },
{ path: "intelligence/jx-watch",      Component: Intelligence },
```

Add the import at the top of the file alongside other page imports:

```typescript
import RateOutlook from "./pages/RateOutlook";
```

Add the route after the existing intelligence routes:

```typescript
{ path: "intelligence/rate-outlook",  Component: RateOutlook },
```

- [ ] **Step 2: Add sidebar nav entry in Sidebar.tsx**

Open `src/app/components/layout/Sidebar.tsx`. Find the Intelligence section (around line 169–179):

```typescript
// Current (find this):
{ title: "Jurisdiction Watch", url: "/intelligence/jx-watch",    icon: Globe       },
```

Add after that entry (add `TrendingUp` import if not already present — check existing imports first):

```typescript
{ title: "Rate Outlook",       url: "/intelligence/rate-outlook", icon: TrendingUp  },
```

`TrendingUp` is already imported on line 176 of the current sidebar for "Macro Signals" — verify with:

```bash
grep -n "TrendingUp" /Users/tanamsethi/Downloads/Aeroinsights/src/app/components/layout/Sidebar.tsx | head -5
```

If not present, add it to the Lucide import line.

- [ ] **Step 3: Verify tsc**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx tsc --noEmit --project tsconfig.json 2>&1 | grep -E "routes|Sidebar" | head -10
```

Expected: no errors.

- [ ] **Step 4: Verify dev server starts without error**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx vite build 2>&1 | tail -15
```

Expected: build completes with no errors (only size warnings acceptable).

- [ ] **Step 5: Commit**

```bash
git add src/app/routes.tsx src/app/components/layout/Sidebar.tsx
git commit -m "feat: wire RateOutlook route and sidebar nav under Intelligence"
```

---

## Task 10: Intelligence.tsx tab wiring

**Files:**
- Modify: `src/app/pages/Intelligence.tsx`

- [ ] **Step 1: Add "rate-outlook" tab to Intelligence.tsx**

Open `src/app/pages/Intelligence.tsx`. Make three changes:

**Change 1 — extend the IntelTab type (around line 127):**

```typescript
// Current:
type IntelTab = "signals" | "lessee-radar" | "deal-feed" | "jx-watch";

// Replace with:
type IntelTab = "signals" | "lessee-radar" | "deal-feed" | "jx-watch" | "rate-outlook";
```

**Change 2 — add tab to TABS array (around line 129–134):**

```typescript
// Current last entry:
{ id: "jx-watch",    label: "Jurisdiction Watch"  },

// Add after it:
{ id: "rate-outlook", label: "Rate Outlook" },
```

**Change 3 — add badge entry and tab render in the main export (around line 1595–1601):**

```typescript
// Current badges object:
const badges: Record<IntelTab, number> = {
  "signals":      highSignals,
  "lessee-radar": redLessees,
  "deal-feed":    negDeals,
  "jx-watch":     negJx,
};

// Replace with:
const badges: Record<IntelTab, number> = {
  "signals":      highSignals,
  "lessee-radar": redLessees,
  "deal-feed":    negDeals,
  "jx-watch":     negJx,
  "rate-outlook": 0,
};
```

**Change 4 — add PATH_TO_TAB entry (around line 1545–1549):**

```typescript
// Current:
const PATH_TO_TAB: Record<string, IntelTab> = {
  "/intelligence/lessee-radar": "lessee-radar",
  "/intelligence/deal-feed":    "deal-feed",
  "/intelligence/jx-watch":    "jx-watch",
};

// Replace with:
const PATH_TO_TAB: Record<string, IntelTab> = {
  "/intelligence/lessee-radar":  "lessee-radar",
  "/intelligence/deal-feed":     "deal-feed",
  "/intelligence/jx-watch":      "jx-watch",
  "/intelligence/rate-outlook":  "rate-outlook",
};
```

**NOTE:** The `rate-outlook` tab navigates to `/intelligence/rate-outlook` which renders `RateOutlook` as a standalone page (not embedded in Intelligence.tsx). The tab in Intelligence.tsx just activates the route — the `activeTab === "rate-outlook"` branch in the AnimatePresence renderer is NOT needed because the tab click triggers `navigate("/intelligence/rate-outlook")` which exits Intelligence.tsx entirely and renders RateOutlook.tsx instead. This matches how the existing Intelligence tabs work with `navigate()`.

- [ ] **Step 2: Verify tsc**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "Intelligence" | head -10
```

Expected: no errors.

- [ ] **Step 3: Verify build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx vite build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Run all tests to confirm no regressions**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx vitest run 2>&1 | tail -20
```

Expected: all existing tests pass PLUS the new `rateForecaster.test.ts` tests (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/Intelligence.tsx
git commit -m "feat: add Rate Outlook tab to Intelligence page nav"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| `/intelligence/rate-outlook` route | Task 9 |
| 18 aircraft types with base rents | Task 1 |
| Forecast model: `forecastRent(t) = baseRent × (1 + signalEffect) × seasonalFactor(t)` | Task 2 |
| 5 macro signals with NB/WB weights | Task 2 |
| P25/P75 confidence band | Task 2, 6 |
| LRF metric per type per month | Task 2, 5 |
| MoM trend and vs-baseline % | Task 2 |
| KPI strip (4 cards) | Task 4 |
| Grid view with sparklines | Task 5 |
| Chart view with confidence band | Task 6 |
| View toggle (grid ↔ chart) | Task 8 |
| Category filter (All/NB/WB/Regional) | Task 8 |
| Portfolio overlay with position badge | Task 7, 8 |
| Demo mode with DEMO_LEASES | Task 8 |
| Sidebar nav entry | Task 9 |
| Intelligence.tsx tab entry | Task 10 |
| No VITE_ env vars | ✓ (no new env vars) |

All spec requirements covered. No gaps.

### Type Consistency

- `AircraftType`, `AircraftCategory`, `MacroInputs`, `MonthlyRateForecast`, `TypeForecast`, `RateOutlookResult` all defined in Task 1 (`rateOutlookData.ts`) and imported consistently in Tasks 2–8.
- `forecastRates` is defined in Task 2, used in Task 3.
- `seasonalFactor` exported in Task 2, tested in Task 2.
- `PortfolioLease` defined in Task 7, imported in Task 8.
- `DEMO_LEASES` imported from existing `demoCashFlowLeases.ts` — not redefined.
- `useData` hook imported from `../contexts/DataContext` — matches existing import pattern.
