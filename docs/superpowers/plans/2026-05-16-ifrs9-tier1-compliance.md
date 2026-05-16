# IFRS 9 Tier 1 Compliance Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire three interconnected IFRS 9 compliance features into the existing Risk & ECL page: editable forward-looking macro scenario inputs, a live SICR evaluation engine with confirmed stage migration workflow, and an 8-section Auditor Evidence Pack modal with PDF and DOCX download.

**Architecture:** In-place enhancement — scenario editing inside the ECL Overview tab's existing probability weights card, SICR evaluation inside the SICR Config tab below the existing trigger cards, and the Auditor Evidence Pack as a standalone full-screen modal triggered from the page header. 3 new files created, 3 existing files modified, no new routes, no Supabase schema changes.

**Tech Stack:** React 18 + TypeScript, Framer Motion (existing), `docx` (existing), `html2canvas` + `jspdf` (new), Vitest (existing test runner).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/data/mockPortfolioData.ts` | **Modify** | Add `MOCK_SICR_DATA` map: lessee-id → SICR evaluation fields |
| `src/app/utils/sicrEvaluator.ts` | **Create** | Pure function evaluating leases against SICR config; returns recommended stage migrations |
| `src/app/utils/sicrEvaluator.test.ts` | **Create** | Vitest unit tests for SICR evaluation logic (TDD) |
| `src/app/components/risk-ecl/ScenarioEditor.tsx` | **Create** | Editable macro input column for one scenario; rendered 3× in OverviewTab |
| `src/app/components/risk-ecl/AuditorPackModal.tsx` | **Create** | Full-screen 8-section preview modal with PDF + DOCX download |
| `src/app/pages/RiskECL.tsx` | **Modify** | Wire scenario editor state, SICR evaluator, stage overrides, auditor modal |
| `src/app/services/reportGenerators.ts` | **Modify** | Extend `generateReportDOCX` to accept live audit data; add `generateReportPDF` |

---

## Task 1: Add SICR Evaluation Data to Mock Portfolio

The `Lessee` type mirrors the Supabase schema and cannot be extended. SICR evaluation needs four extra fields per lessee (DPD days, rating notches downgraded, country watchlist flag, insolvency flag). Export these as a separate map keyed by lessee ID alongside the existing mock arrays.

**Files:**
- Modify: `src/app/data/mockPortfolioData.ts`

- [ ] **Step 1: Read the bottom of mockPortfolioData.ts to find the last export**

```bash
tail -20 /Users/tanamsethi/Downloads/Aeroinsights/src/app/data/mockPortfolioData.ts
```

Expected: file ends after `MOCK_PROVISIONS` array.

- [ ] **Step 2: Append MOCK_SICR_DATA to mockPortfolioData.ts**

Add this block at the very end of `src/app/data/mockPortfolioData.ts`:

```typescript
// ─── SICR Evaluation Data ─────────────────────────────────────────────────────
// Keyed by lessee ID (matches MOCK_LESSEES[n].id).
// These fields are not in the Supabase Lessee schema — stored separately.
//
// dpdDays              : days past due on most recent rental payment
// ratingNotchesDown    : notches downgraded vs. prior assessment period
// onCountryWatchlist   : true if operating country is on the sovereign watchlist
// insolvencyFiled      : true if formal insolvency petition has been filed

export interface SICRLesseeData {
  dpdDays: number;
  ratingNotchesDown: number;
  onCountryWatchlist: boolean;
  insolvencyFiled: boolean;
}

export const MOCK_SICR_DATA: Record<string, SICRLesseeData> = {
  "mock-l1":  { dpdDays: 47, ratingNotchesDown: 1, onCountryWatchlist: true,  insolvencyFiled: false }, // IndiGo Airlines      — Stage 3 (correctly staged)
  "mock-l2":  { dpdDays: 89, ratingNotchesDown: 3, onCountryWatchlist: false, insolvencyFiled: true  }, // Aeromexico           — Stage 3 (correctly staged, insolvency)
  "mock-l3":  { dpdDays: 0,  ratingNotchesDown: 0, onCountryWatchlist: false, insolvencyFiled: false }, // Emirates             — Stage 1 (clean)
  "mock-l4":  { dpdDays: 12, ratingNotchesDown: 2, onCountryWatchlist: true,  insolvencyFiled: false }, // SriLankan Airlines   — Stage 2 (correctly staged)
  "mock-l5":  { dpdDays: 32, ratingNotchesDown: 0, onCountryWatchlist: false, insolvencyFiled: false }, // Ryanair              — Stage 1, DPD 32 → RECOMMEND Stage 2
  "mock-l6":  { dpdDays: 0,  ratingNotchesDown: 2, onCountryWatchlist: false, insolvencyFiled: false }, // Air France           — Stage 1, downgrade ≥2 → RECOMMEND Stage 2
  "mock-l7":  { dpdDays: 38, ratingNotchesDown: 1, onCountryWatchlist: false, insolvencyFiled: false }, // Azul Brazilian       — Stage 2 (correctly staged)
  "mock-l8":  { dpdDays: 35, ratingNotchesDown: 0, onCountryWatchlist: false, insolvencyFiled: false }, // Air Transat          — Stage 2 (correctly staged)
  "mock-l9":  { dpdDays: 0,  ratingNotchesDown: 0, onCountryWatchlist: false, insolvencyFiled: false }, // Singapore Airlines   — Stage 1 (clean)
  "mock-l10": { dpdDays: 0,  ratingNotchesDown: 0, onCountryWatchlist: false, insolvencyFiled: false }, // Lufthansa            — Stage 1 (clean)
};
```

- [ ] **Step 3: Verify TypeScript accepts the new export**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep mockPortfolio
```

Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/data/mockPortfolioData.ts && git commit -m "feat: add MOCK_SICR_DATA with per-lessee SICR evaluation fields"
```

---

## Task 2: SICR Evaluator — Tests First, Then Implementation

Build the evaluation engine as a pure function. Write all tests before writing any implementation (TDD).

**Files:**
- Create: `src/app/utils/sicrEvaluator.ts`
- Create: `src/app/utils/sicrEvaluator.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/app/utils/sicrEvaluator.test.ts` with this content:

```typescript
import { describe, it, expect } from "vitest";
import { evaluateSICR } from "./sicrEvaluator";
import type { SICREvaluationInput, SICRConfig } from "./sicrEvaluator";

const DEFAULT_CONFIG: SICRConfig = {
  dpdEnabled: true,
  dpdDays: 30,
  upgradeEnabled: true,
  upgradeNotches: 2,
  countryWatchlistEnabled: true,
  insolvencyEnabled: true,
};

const BASE_LEASE: SICREvaluationInput = {
  leaseId: "LSE-TEST-001",
  lesseeId: "mock-l99",
  lesseeName: "Test Airline",
  aircraft: "A320neo",
  currentStage: "1",
  dpdDays: 0,
  ratingNotchesDown: 0,
  onCountryWatchlist: false,
  insolvencyFiled: false,
  baseECLm: 1.0,
};

describe("evaluateSICR", () => {
  it("returns empty array when no triggers fire", () => {
    expect(evaluateSICR([BASE_LEASE], DEFAULT_CONFIG)).toHaveLength(0);
  });

  it("recommends Stage 2 when DPD meets threshold", () => {
    const lease = { ...BASE_LEASE, dpdDays: 30 };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result).toHaveLength(1);
    expect(result[0].recommendedStage).toBe("2");
    expect(result[0].triggersFired).toContain("30+ DPD Backstop");
  });

  it("does NOT trigger when DPD is one below threshold", () => {
    const lease = { ...BASE_LEASE, dpdDays: 29 };
    expect(evaluateSICR([lease], DEFAULT_CONFIG)).toHaveLength(0);
  });

  it("recommends Stage 3 (not 2) when insolvency is filed", () => {
    const lease = { ...BASE_LEASE, insolvencyFiled: true };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result).toHaveLength(1);
    expect(result[0].recommendedStage).toBe("3");
    expect(result[0].triggersFired).toContain("Lessee Insolvency Filing");
  });

  it("recommends Stage 3 for a Stage 2 lease with insolvency", () => {
    const lease = { ...BASE_LEASE, currentStage: "2" as const, insolvencyFiled: true };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result).toHaveLength(1);
    expect(result[0].currentStage).toBe("2");
    expect(result[0].recommendedStage).toBe("3");
  });

  it("does not recommend when Stage 2 lease only has DPD trigger (already correctly staged)", () => {
    const lease = { ...BASE_LEASE, currentStage: "2" as const, dpdDays: 45 };
    expect(evaluateSICR([lease], DEFAULT_CONFIG)).toHaveLength(0);
  });

  it("does not recommend when Stage 3 lease has any trigger (already at max)", () => {
    const lease = { ...BASE_LEASE, currentStage: "3" as const, insolvencyFiled: true, dpdDays: 90 };
    expect(evaluateSICR([lease], DEFAULT_CONFIG)).toHaveLength(0);
  });

  it("returns empty array when all triggers are disabled", () => {
    const allOff: SICRConfig = {
      dpdEnabled: false, dpdDays: 30,
      upgradeEnabled: false, upgradeNotches: 2,
      countryWatchlistEnabled: false,
      insolvencyEnabled: false,
    };
    const lease = { ...BASE_LEASE, dpdDays: 90, insolvencyFiled: true, onCountryWatchlist: true };
    expect(evaluateSICR([lease], allOff)).toHaveLength(0);
  });

  it("includes all fired trigger names in triggersFired array", () => {
    const lease = { ...BASE_LEASE, dpdDays: 45, onCountryWatchlist: true };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result[0].triggersFired).toContain("30+ DPD Backstop");
    expect(result[0].triggersFired).toContain("Country Watchlist Event");
  });

  it("recommends Stage 2 for rating downgrade meeting threshold", () => {
    const lease = { ...BASE_LEASE, ratingNotchesDown: 2 };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result).toHaveLength(1);
    expect(result[0].recommendedStage).toBe("2");
    expect(result[0].triggersFired).toContain("Credit Downgrade (≥2 notches)");
  });

  it("does not trigger downgrade one notch below threshold", () => {
    const lease = { ...BASE_LEASE, ratingNotchesDown: 1 };
    expect(evaluateSICR([lease], DEFAULT_CONFIG)).toHaveLength(0);
  });

  it("eclDeltaM is positive for every recommendation", () => {
    const lease = { ...BASE_LEASE, dpdDays: 35, baseECLm: 2.5 };
    const result = evaluateSICR([lease], DEFAULT_CONFIG);
    expect(result[0].eclDeltaM).toBeGreaterThan(0);
  });

  it("handles empty lease array without error", () => {
    expect(evaluateSICR([], DEFAULT_CONFIG)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests — confirm they all fail with "Cannot find module"**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/sicrEvaluator.test.ts 2>&1 | tail -10
```

Expected output contains: `Error: Cannot find module './sicrEvaluator'`

- [ ] **Step 3: Create the implementation file**

Create `src/app/utils/sicrEvaluator.ts`:

```typescript
// src/app/utils/sicrEvaluator.ts
// Pure SICR (Significant Increase in Credit Risk) evaluation engine.
// No side effects. Deterministic: same inputs always produce same output.
// All IFRS 9 stage logic lives here; callers apply the result to their own state.

export interface SICRConfig {
  dpdEnabled: boolean;
  dpdDays: number;             // threshold: trigger fires when dpdDays >= this value
  upgradeEnabled: boolean;
  upgradeNotches: number;      // threshold: trigger fires when ratingNotchesDown >= this value
  countryWatchlistEnabled: boolean;
  insolvencyEnabled: boolean;
}

export interface SICREvaluationInput {
  leaseId: string;
  lesseeId: string;
  lesseeName: string;
  aircraft: string;
  currentStage: "1" | "2" | "3";
  dpdDays: number;             // days past due on most recent payment
  ratingNotchesDown: number;   // notches downgraded vs. prior assessment period (0 = no downgrade)
  onCountryWatchlist: boolean; // lessee's operating country on sovereign watchlist
  insolvencyFiled: boolean;    // formal insolvency petition filed
  baseECLm: number;            // current ECL on this lease in $M — used to estimate ECL delta
}

export interface SICRMigrationRecommendation {
  leaseId: string;
  lesseeId: string;
  lesseeName: string;
  aircraft: string;
  currentStage: "1" | "2" | "3";
  recommendedStage: "2" | "3"; // always higher than currentStage
  triggersFired: string[];      // human-readable trigger names
  eclDeltaM: number;            // estimated additional ECL from migration ($M, always >= 0)
}

// Approximate ECL multiplier when moving between stages.
// S1→S2: lifetime ECL replaces 12-month ECL (approx 1.8× increase on this lease).
// S1→S3 or S2→S3: full LGD applied, roughly 3.2× and 1.6× respectively.
const ECL_STAGE_MULTIPLIER: Record<string, number> = {
  "1-2": 1.8,
  "1-3": 3.2,
  "2-3": 1.6,
};

export function evaluateSICR(
  leases: SICREvaluationInput[],
  config: SICRConfig,
): SICRMigrationRecommendation[] {
  const recommendations: SICRMigrationRecommendation[] = [];

  for (const lease of leases) {
    const triggersFired: string[] = [];

    // Evaluate triggers in priority order (insolvency → Stage 3 overrides others)
    if (config.insolvencyEnabled && lease.insolvencyFiled) {
      triggersFired.push("Lessee Insolvency Filing");
    }
    if (config.dpdEnabled && lease.dpdDays >= config.dpdDays) {
      triggersFired.push(`${config.dpdDays}+ DPD Backstop`);
    }
    if (config.upgradeEnabled && lease.ratingNotchesDown >= config.upgradeNotches) {
      triggersFired.push(`Credit Downgrade (≥${config.upgradeNotches} notches)`);
    }
    if (config.countryWatchlistEnabled && lease.onCountryWatchlist) {
      triggersFired.push("Country Watchlist Event");
    }

    if (triggersFired.length === 0) continue;

    // Insolvency → always Stage 3; any other trigger → Stage 2
    const forceStage3 = config.insolvencyEnabled && lease.insolvencyFiled;
    const recommendedStage: "2" | "3" = forceStage3 ? "3" : "2";

    // Only recommend when the migration is actually upward
    const currentNum = parseInt(lease.currentStage, 10);
    const recommendedNum = parseInt(recommendedStage, 10);
    if (currentNum >= recommendedNum) continue;

    const multiplierKey = `${lease.currentStage}-${recommendedStage}`;
    const multiplier = ECL_STAGE_MULTIPLIER[multiplierKey] ?? 1.0;
    const eclDeltaM = Math.max(0, lease.baseECLm * (multiplier - 1));

    recommendations.push({
      leaseId: lease.leaseId,
      lesseeId: lease.lesseeId,
      lesseeName: lease.lesseeName,
      aircraft: lease.aircraft,
      currentStage: lease.currentStage,
      recommendedStage,
      triggersFired,
      eclDeltaM,
    });
  }

  return recommendations;
}
```

- [ ] **Step 4: Run tests — confirm all 13 pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/sicrEvaluator.test.ts 2>&1 | tail -15
```

Expected:

```
✓ src/app/utils/sicrEvaluator.test.ts (13)
Test Files  1 passed (1)
Tests       13 passed (13)
```

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/utils/sicrEvaluator.ts src/app/utils/sicrEvaluator.test.ts && git commit -m "feat: add SICR evaluation engine with 13 passing tests (TDD)"
```

---

## Task 3: ScenarioEditor Component

A self-contained input column for one scenario's macro assumptions. Rendered three times side-by-side (Base, Adverse, Upside) in the ECL Overview tab.

**Files:**
- Create: `src/app/components/risk-ecl/ScenarioEditor.tsx`

- [ ] **Step 1: Create ScenarioEditor.tsx**

Create `src/app/components/risk-ecl/ScenarioEditor.tsx`:

```typescript
// src/app/components/risk-ecl/ScenarioEditor.tsx
// Editable macro-input column for a single IFRS 9 forward-looking scenario.
// Rendered 3× in RiskECL's OverviewTab (Base, Adverse, Upside).
// Each field change calls onChange immediately so ECL recalculates live.

import type { ScenarioInputs } from "../../utils/eclCalculator";

export interface ScenarioEditorProps {
  label: string;             // e.g. "Baseline", "Adverse / Downside", "Upside"
  color: string;             // header accent colour, e.g. "#002147"
  inputs: ScenarioInputs;
  defaults: ScenarioInputs;  // what "Reset" restores
  onChange: (updated: ScenarioInputs) => void;
}

interface FieldDef {
  key: keyof ScenarioInputs;
  label: string;
  unit: string;   // displayed after the number input: "%", "bps", "×"
  scale: number;  // multiply stored value by scale for display (100 for % fields)
  step: number;   // HTML input step attribute
  decimals: number; // toFixed precision for display value
}

const FIELDS: FieldDef[] = [
  { key: "gdpDelta",        label: "GDP Growth",            unit: "%",   scale: 100, step: 0.1, decimals: 1 },
  { key: "rpkDelta",        label: "RPK Air Traffic",       unit: "%",   scale: 100, step: 0.5, decimals: 1 },
  { key: "fuelDelta",       label: "Fuel Cost",             unit: "%",   scale: 100, step: 0.5, decimals: 1 },
  { key: "fxDelta",         label: "FX Rate",               unit: "%",   scale: 100, step: 0.5, decimals: 1 },
  { key: "rateDelta",       label: "Interest Rate",         unit: "bps", scale: 10000, step: 5, decimals: 0 },
  { key: "assetValueDelta", label: "Aircraft Market Value", unit: "%",   scale: 100, step: 0.5, decimals: 1 },
  { key: "pdS2Multi",       label: "PD Multiplier (S2)",    unit: "×",   scale: 1,   step: 0.1, decimals: 1 },
  { key: "pdS3Multi",       label: "PD Multiplier (S3)",    unit: "×",   scale: 1,   step: 0.1, decimals: 1 },
];

export function ScenarioEditor({ label, color, inputs, defaults, onChange }: ScenarioEditorProps) {
  function handleChange(key: keyof ScenarioInputs, displayVal: string, scale: number) {
    const num = parseFloat(displayVal);
    if (isNaN(num)) return;
    onChange({ ...inputs, [key]: num / scale });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {/* Column header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "0.25rem", borderBottom: `2px solid ${color}20` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>{label}</span>
        </div>
        <button
          onClick={() => onChange(defaults)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "0.6875rem", color: "#94A3B8",
            textDecoration: "underline", textUnderlineOffset: "2px",
            padding: 0, lineHeight: 1,
          }}
        >
          Reset
        </button>
      </div>

      {/* One row per macro variable */}
      {FIELDS.map((field) => {
        const rawVal = inputs[field.key] as number;
        const displayVal = (rawVal * field.scale).toFixed(field.decimals);
        const isNegative = rawVal < 0;
        const isPositive = rawVal > 0;
        const valueColor = isNegative ? "#B91C1C" : isPositive ? "#15803D" : "#0F172A";

        return (
          <div key={String(field.key)} style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            <label style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, lineHeight: 1.2 }}>
              {field.label}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                step={field.step}
                value={displayVal}
                onChange={(e) => handleChange(field.key, e.target.value, field.scale)}
                style={{
                  width: "100%",
                  padding: "0.375rem 2rem 0.375rem 0.625rem",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0.375rem",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: valueColor,
                  background: "#FFFFFF",
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "right",
                  appearance: "none",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 150ms ease",
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = color; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "#E2E8F0"; }}
              />
              <span style={{
                position: "absolute", right: "0.5rem", top: "50%",
                transform: "translateY(-50%)",
                fontSize: "0.6875rem", color: "#94A3B8", pointerEvents: "none",
                fontWeight: 500,
              }}>
                {field.unit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep ScenarioEditor
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/risk-ecl/ScenarioEditor.tsx && git commit -m "feat: add ScenarioEditor component for live IFRS 9 macro input editing"
```

---

## Task 4: Wire Scenario Editor into RiskECL

Replace the two hardcoded `ADVERSE_INPUTS` / `UPSIDE_INPUTS` constants with stateful `scenarioInputs`, add the `ScenarioEditor` UI section to the ECL Overview tab, and ensure ECL recalculates live as inputs change.

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

The current file has (around line 74–94):
```typescript
const ADVERSE_INPUTS: ScenarioInputs = {
  gdpDelta: -0.02, rpkDelta: -0.25, fuelDelta: 0.30, ...
};
const UPSIDE_INPUTS: ScenarioInputs = { ... };
```

And `scenarioSummary` (around line 272–283) references them directly.

- [ ] **Step 1: Add the default constants above the component and import ScenarioEditor**

At the top of `src/app/pages/RiskECL.tsx`, add the import:

```typescript
import { ScenarioEditor } from "../components/risk-ecl/ScenarioEditor";
```

Then **replace** the two existing hardcoded `const ADVERSE_INPUTS` and `const UPSIDE_INPUTS` declarations with named defaults (keeping the same values, just renaming so they can be used as reset targets):

```typescript
// Replace:
//   const ADVERSE_INPUTS: ScenarioInputs = { ... };
//   const UPSIDE_INPUTS: ScenarioInputs = { ... };
// With:

const DEFAULT_BASE_INPUTS: ScenarioInputs = ZERO_INPUTS;

const DEFAULT_ADVERSE_INPUTS: ScenarioInputs = {
  gdpDelta: -0.02,
  rpkDelta: -0.25,
  fuelDelta: 0.30,
  fxDelta: 0,
  rateDelta: 0.01,
  assetValueDelta: -0.10,
  pdS2Multi: 1.5,
  pdS3Multi: 2.0,
  deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
  pbhConversionPct: 0, etpRate: 0, lecRate: 0,
  bankruptcyScenarioType: null, leaseAssumptionPct: 0,
  ctcGoldPct: 0, nonCtcPct: 0, repossWeightedMonths: 0,
  remarketingMonths: 0, vintageAdjFactor: 0,
  depositCoverage: 0, maintenanceReserveCoverage: 0,
  payBehaviourCoopPct: 0, payBehaviourAdvPct: 0,
  restructuringType: null,
};

const DEFAULT_UPSIDE_INPUTS: ScenarioInputs = {
  gdpDelta: 0.01,
  rpkDelta: 0.08,
  fuelDelta: -0.15,
  fxDelta: 0,
  rateDelta: -0.005,
  assetValueDelta: 0.05,
  pdS2Multi: 0.8,
  pdS3Multi: 0.8,
  deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
  pbhConversionPct: 0, etpRate: 0, lecRate: 0,
  bankruptcyScenarioType: null, leaseAssumptionPct: 0,
  ctcGoldPct: 0, nonCtcPct: 0, repossWeightedMonths: 0,
  remarketingMonths: 0, vintageAdjFactor: 0,
  depositCoverage: 0, maintenanceReserveCoverage: 0,
  payBehaviourCoopPct: 0, payBehaviourAdvPct: 0,
  restructuringType: null,
};
```

These go at module scope (above the `RiskECL` component function), after the `ZERO_INPUTS` import.

- [ ] **Step 2: Add scenarioInputs state inside the RiskECL component**

Inside the `RiskECL()` function body, after the existing `useState` declarations, add:

```typescript
const [scenarioInputs, setScenarioInputs] = useState({
  base:    DEFAULT_BASE_INPUTS,
  adverse: DEFAULT_ADVERSE_INPUTS,
  upside:  DEFAULT_UPSIDE_INPUTS,
});
```

- [ ] **Step 3: Update scenarioSummary to use stateful inputs**

Find the `scenarioSummary` computation inside the component (currently references `ZERO_INPUTS`, `ADVERSE_INPUTS`, `UPSIDE_INPUTS`). Replace those three references:

```typescript
// Before (three lines inside the (() => { ... })() block):
const baseECL    = computeECLFromBase(liveBaseECL, ZERO_INPUTS);
const adverseECL = computeECLFromBase(liveBaseECL, ADVERSE_INPUTS);
const upsideECL  = computeECLFromBase(liveBaseECL, UPSIDE_INPUTS);

// After:
const baseECL    = computeECLFromBase(liveBaseECL, scenarioInputs.base);
const adverseECL = computeECLFromBase(liveBaseECL, scenarioInputs.adverse);
const upsideECL  = computeECLFromBase(liveBaseECL, scenarioInputs.upside);
```

- [ ] **Step 4: Add the ScenarioEditor UI section inside OverviewTab**

Inside the `OverviewTab` component (defined inside `RiskECL`), find the closing `</RiskSection>` of the "Probability Controls" collapsible section and the weighted ECL table that follows it. After the weighted ECL table's closing `</div>` (still inside the `<Card>`), add a new collapsible section:

```tsx
{/* Scenario Macro Inputs — collapsed by default, expands for auditor / analyst use */}
<div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #E2E8F0" }}>
  <RiskSection label="Forward-Looking Scenario Inputs" defaultOpen={false}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", paddingTop: "0.75rem" }}>
      {(
        [
          { key: "base"    as const, label: "Baseline",           color: "#002147", defaults: DEFAULT_BASE_INPUTS    },
          { key: "adverse" as const, label: "Adverse / Downside", color: "#B45309", defaults: DEFAULT_ADVERSE_INPUTS },
          { key: "upside"  as const, label: "Upside",             color: "#15803D", defaults: DEFAULT_UPSIDE_INPUTS  },
        ] as const
      ).map((s) => (
        <ScenarioEditor
          key={s.key}
          label={s.label}
          color={s.color}
          inputs={scenarioInputs[s.key]}
          defaults={s.defaults}
          onChange={(updated) =>
            setScenarioInputs((prev) => ({ ...prev, [s.key]: updated }))
          }
        />
      ))}
    </div>
  </RiskSection>
</div>
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/RiskECL.tsx && git commit -m "feat: wire editable scenario macro inputs into ECL Overview — live ECL recalculation"
```

---

## Task 5: Wire SICR Evaluator into RiskECL

Add SICR evaluation state, the "Run SICR Evaluation" button, the recommendations table, stage override application, and the "PENDING" badge in the ECL by Lease table.

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

- [ ] **Step 1: Add new imports at the top of RiskECL.tsx**

```typescript
import { evaluateSICR } from "../utils/sicrEvaluator";
import type { SICRMigrationRecommendation } from "../utils/sicrEvaluator";
import { MOCK_SICR_DATA } from "../data/mockPortfolioData";
```

- [ ] **Step 2: Add SICR evaluation state inside the RiskECL component**

After the existing `useState` declarations, add:

```typescript
const [sicrRecommendations, setSicrRecommendations] = useState<SICRMigrationRecommendation[] | null>(null);
const [stageOverrides, setStageOverrides] = useState<Record<string, "1" | "2" | "3">>({});
const [selectedMigrations, setSelectedMigrations] = useState<Set<string>>(new Set());
const [sicrRan, setSicrRan] = useState(false);
```

- [ ] **Step 3: Add buildSICRInputs helper inside the component**

After the state declarations and before the `OverviewTab` definition, add:

```typescript
function buildSICRInputs() {
  return sortedECL.map((row) => {
    const sicr = MOCK_SICR_DATA[row.lesseeId] ?? {
      dpdDays: 0, ratingNotchesDown: 0, onCountryWatchlist: false, insolvencyFiled: false,
    };
    return {
      leaseId: row.id,
      lesseeId: row.lesseeId,
      lesseeName: row.lessee,
      aircraft: row.aircraft,
      currentStage: (stageOverrides[row.id] ?? row.stage) as "1" | "2" | "3",
      dpdDays: sicr.dpdDays,
      ratingNotchesDown: sicr.ratingNotchesDown,
      onCountryWatchlist: sicr.onCountryWatchlist,
      insolvencyFiled: sicr.insolvencyFiled,
      baseECLm: row.ecl12m,
    };
  });
}
```

- [ ] **Step 4: Add the Run Evaluation button + recommendations table to SICRConfigTab**

Inside the `SICRConfigTab` component, find the closing `</Card>` of the "Active Rules Summary" card. After it (still inside the outer `<div>` returned by `SICRConfigTab`), append:

```tsx
{/* Run SICR Evaluation */}
<div>
  <button
    onClick={() => {
      const inputs = buildSICRInputs();
      const recs = evaluateSICR(inputs, sicrConfig);
      setSicrRecommendations(recs);
      setSelectedMigrations(new Set(recs.map((r) => r.leaseId)));
      setSicrRan(true);
    }}
    style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
      width: "100%",
      background: "#002147", color: "#FFFFFF", border: "none",
      borderRadius: "9999px", padding: "0.75rem 1.5rem",
      fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
      transition: "opacity 160ms ease",
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
  >
    Run SICR Evaluation
  </button>
</div>

{/* Recommendations */}
{sicrRan && sicrRecommendations !== null && (
  <Card
    title="Recommended Stage Migrations"
    subtitle={
      sicrRecommendations.length === 0
        ? "All leases correctly staged — no migrations recommended"
        : `${sicrRecommendations.length} migration${sicrRecommendations.length !== 1 ? "s" : ""} recommended based on active SICR triggers`
    }
  >
    {sicrRecommendations.length === 0 ? (
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "1rem 1.25rem",
        background: "rgba(21,128,61,0.06)",
        borderRadius: "0.625rem",
        borderLeft: "3px solid #15803D",
      }}>
        <span style={{ fontSize: "0.875rem", color: "#15803D", fontWeight: 500 }}>
          ✓ All leases are correctly staged per current SICR configuration
        </span>
      </div>
    ) : (
      <>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ padding: "0.625rem 0.75rem", width: "36px" }}>
                  <input
                    type="checkbox"
                    checked={selectedMigrations.size === sicrRecommendations.length && sicrRecommendations.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMigrations(new Set(sicrRecommendations.map((r) => r.leaseId)));
                      } else {
                        setSelectedMigrations(new Set());
                      }
                    }}
                  />
                </th>
                {["Lease ID", "Lessee", "Aircraft", "Migration", "Triggers Fired", "ECL Impact"].map((h) => (
                  <th key={h} style={{ padding: "0.625rem 0.75rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sicrRecommendations.map((rec, i) => (
                <tr key={rec.leaseId} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                  <td style={{ padding: "0.75rem" }}>
                    <input
                      type="checkbox"
                      checked={selectedMigrations.has(rec.leaseId)}
                      onChange={(e) => {
                        const next = new Set(selectedMigrations);
                        if (e.target.checked) next.add(rec.leaseId);
                        else next.delete(rec.leaseId);
                        setSelectedMigrations(next);
                      }}
                    />
                  </td>
                  <td style={{ padding: "0.75rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#94A3B8", whiteSpace: "nowrap" }}>{rec.leaseId}</td>
                  <td style={{ padding: "0.75rem", fontWeight: 600, color: "#0F172A" }}>{rec.lesseeName}</td>
                  <td style={{ padding: "0.75rem", color: "#475569", fontSize: "0.8125rem" }}>{rec.aircraft}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: rec.currentStage === "1" ? "#15803D" : "#B45309", background: rec.currentStage === "1" ? "rgba(21,128,61,0.1)" : "rgba(180,83,9,0.1)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>S{rec.currentStage}</span>
                      <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>→</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: rec.recommendedStage === "3" ? "#B91C1C" : "#B45309", background: rec.recommendedStage === "3" ? "rgba(185,28,28,0.1)" : "rgba(180,83,9,0.1)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>S{rec.recommendedStage}</span>
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem", maxWidth: "240px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                      {rec.triggersFired.map((t) => (
                        <span key={t} style={{ fontSize: "0.6875rem", background: "#F4F5F7", color: "#475569", border: "1px solid #E2E8F0", padding: "0.15rem 0.5rem", borderRadius: "9999px", whiteSpace: "nowrap" }}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem", fontWeight: 600, color: "#B91C1C", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    +${rec.eclDeltaM.toFixed(2)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingTop: "1rem", borderTop: "1px solid #E2E8F0", gap: "0.75rem", marginTop: "1rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "#94A3B8" }}>
            {selectedMigrations.size} of {sicrRecommendations.length} selected
          </span>
          <button
            disabled={selectedMigrations.size === 0}
            onClick={() => {
              const overrides: Record<string, "1" | "2" | "3"> = { ...stageOverrides };
              for (const rec of sicrRecommendations) {
                if (selectedMigrations.has(rec.leaseId)) {
                  overrides[rec.leaseId] = rec.recommendedStage;
                }
              }
              setStageOverrides(overrides);
              setSicrRecommendations(null);
              setSicrRan(false);
              setSelectedMigrations(new Set());
            }}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.5rem 1.125rem",
              background: selectedMigrations.size > 0 ? "#002147" : "#CBD5E1",
              border: "none", borderRadius: "9999px",
              fontSize: "0.875rem", fontWeight: 500,
              color: "#FFFFFF",
              cursor: selectedMigrations.size > 0 ? "pointer" : "not-allowed",
              transition: "background 160ms ease",
            }}
          >
            Apply Selected Migrations
          </button>
        </div>
      </>
    )}
  </Card>
)}
```

- [ ] **Step 5: Apply stageOverrides in the ECL by Lease table**

Inside `LeaseTab`, find the `<StatusPill>` cell (it renders `<StatusPill stage={row.stage} label={...} />`). Replace that `<td>` with:

```tsx
<td style={{ padding: "0.75rem 1rem" }}>
  {(() => {
    const effectiveStage = stageOverrides[row.id] ?? row.stage;
    const wasOverridden  = stageOverrides[row.id] !== undefined && stageOverrides[row.id] !== row.stage;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <StatusPill stage={effectiveStage} label={`Stage ${effectiveStage}`} />
        {wasOverridden && (
          <span style={{
            fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.04em",
            color: "#B45309", background: "rgba(180,83,9,0.1)",
            border: "1px solid rgba(180,83,9,0.25)",
            padding: "0.1rem 0.35rem", borderRadius: "4px",
          }}>
            PENDING
          </span>
        )}
      </div>
    );
  })()}
</td>
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -15
```

Expected: all tests pass (including the 13 SICR tests).

- [ ] **Step 8: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/RiskECL.tsx && git commit -m "feat: wire SICR evaluation engine into SICR Config tab with migration recommendations and stage overrides"
```

---

## Task 6: Install PDF Dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install html2canvas and jspdf**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm install html2canvas jspdf
```

- [ ] **Step 2: Verify both packages are importable**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node -e "require('html2canvas'); require('jspdf'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add package.json package-lock.json && git commit -m "chore: install html2canvas + jspdf for PDF export"
```

---

## Task 7: Enhance reportGenerators.ts

Extend the `generateReportDOCX` function signature to accept a 4th `auditData` parameter, replace the thin RPT-001 single-table output with a full 8-section IFRS 9 disclosure document, and add `generateReportPDF` using html2canvas + jspdf.

**Files:**
- Modify: `src/app/services/reportGenerators.ts`

The current signature is:
```typescript
export async function generateReportDOCX(reportId: string, currency: CurrencyCode, data?: PortfolioExportData): Promise<void>
```

- [ ] **Step 1: Add AuditorPackData interface and update the function signature**

At the top of `src/app/services/reportGenerators.ts`, after the existing imports, add:

```typescript
import type { ScenarioInputs } from "../utils/eclCalculator";

export interface AuditorPackData {
  scenarioInputs: {
    base:    ScenarioInputs;
    adverse: ScenarioInputs;
    upside:  ScenarioInputs;
  };
  weights: { base: number; adverse: number; upside: number };
  weighted: { ecl12m: number; eclLifetime: number; coverage: number };
  scenarioSummary: {
    base:    { ecl12m: number; eclLifetime: number; coverage: number };
    adverse: { ecl12m: number; eclLifetime: number; coverage: number };
    upside:  { ecl12m: number; eclLifetime: number; coverage: number };
  };
  eclRows: Array<{
    id: string; lessee: string; aircraft: string;
    ead: number; pd12m: number; lgd: number;
    ecl12m: number; eclLT: number; stage: string;
  }>;
  sicrConfig: {
    dpdEnabled: boolean; dpdDays: number;
    upgradeEnabled: boolean; upgradeNotches: number;
    countryWatchlistEnabled: boolean;
    insolvencyEnabled: boolean;
  };
  managementOverlay: string;
  currency: CurrencyCode;
}
```

Then update the function signature:

```typescript
// Before:
export async function generateReportDOCX(reportId: string, currency: CurrencyCode, data?: PortfolioExportData): Promise<void>

// After:
export async function generateReportDOCX(
  reportId: string,
  currency: CurrencyCode,
  data?: PortfolioExportData,
  auditData?: AuditorPackData,
): Promise<void>
```

All existing call sites pass 3 arguments — the 4th defaults to `undefined`, so no callers break.

- [ ] **Step 2: Replace the RPT-001 case with the full 8-section document**

Find the `case "RPT-001":` block inside `generateReportDOCX`. Replace the entire block (from `case "RPT-001": {` to the matching `break;`) with:

```typescript
case "RPT-001": {
  if (!auditData) {
    console.warn("RPT-001: auditData required for full auditor pack");
    return;
  }

  const fmtPct = (n: number) => `${n.toFixed(2)}%`;
  const fmtAmt = (n: number) => fe(n, auditData.currency);
  const sc = auditData.sicrConfig;

  const METHODOLOGY = `Expected Credit Loss (ECL) is measured under IFRS 9 Financial Instruments using the three-stage impairment model. Stage 1 instruments carry a 12-month ECL allowance; Stage 2 and Stage 3 instruments carry a lifetime ECL allowance. Probability of Default (PD), Loss Given Default (LGD), and Exposure at Default (EAD) inputs are derived from lessee credit assessments, aircraft market valuations, and contractual cash flow schedules. Forward-looking information is incorporated through a minimum of three macro-economic scenarios (Baseline, Adverse, Upside) probability-weighted per IFRS 9 §B5.5.41. Significant Increase in Credit Risk (SICR) is assessed at each reporting date against the trigger framework documented in §7 of this pack.`;

  doc = new Document({
    sections: [{
      children: [
        ...docPreamble("Auditor Evidence Pack — IFRS 9 ECL Disclosure", auditData.currency),

        // §1 Methodology
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§1 — Methodology Statement", bold: true, color: "002147" })] }),
        new Paragraph({ children: [new TextRun({ text: METHODOLOGY, size: 18 })] }),
        new Paragraph({ text: "" }),

        // §2 Scenario Definitions
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§2 — Forward-Looking Scenario Definitions", bold: true, color: "002147" })] }),
        makeTable(
          ["Scenario (Weight)", "GDP Δ", "RPK Δ", "Fuel Δ", "Asset Value Δ", "PD Mult S2", "PD Mult S3"],
          [
            ["Baseline",
              `${(auditData.scenarioInputs.base.gdpDelta * 100).toFixed(1)}%`,
              `${(auditData.scenarioInputs.base.rpkDelta * 100).toFixed(1)}%`,
              `${(auditData.scenarioInputs.base.fuelDelta * 100).toFixed(1)}%`,
              `${(auditData.scenarioInputs.base.assetValueDelta * 100).toFixed(1)}%`,
              `${auditData.scenarioInputs.base.pdS2Multi.toFixed(1)}×`,
              `${auditData.scenarioInputs.base.pdS3Multi.toFixed(1)}×`,
            ],
            [`Adverse (${auditData.weights.adverse}%)`,
              `${(auditData.scenarioInputs.adverse.gdpDelta * 100).toFixed(1)}%`,
              `${(auditData.scenarioInputs.adverse.rpkDelta * 100).toFixed(1)}%`,
              `${(auditData.scenarioInputs.adverse.fuelDelta * 100).toFixed(1)}%`,
              `${(auditData.scenarioInputs.adverse.assetValueDelta * 100).toFixed(1)}%`,
              `${auditData.scenarioInputs.adverse.pdS2Multi.toFixed(1)}×`,
              `${auditData.scenarioInputs.adverse.pdS3Multi.toFixed(1)}×`,
            ],
            [`Upside (${auditData.weights.upside}%)`,
              `${(auditData.scenarioInputs.upside.gdpDelta * 100).toFixed(1)}%`,
              `${(auditData.scenarioInputs.upside.rpkDelta * 100).toFixed(1)}%`,
              `${(auditData.scenarioInputs.upside.fuelDelta * 100).toFixed(1)}%`,
              `${(auditData.scenarioInputs.upside.assetValueDelta * 100).toFixed(1)}%`,
              `${auditData.scenarioInputs.upside.pdS2Multi.toFixed(1)}×`,
              `${auditData.scenarioInputs.upside.pdS3Multi.toFixed(1)}×`,
            ],
          ]
        ),
        new Paragraph({ text: "" }),

        // §3 Weighted ECL
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§3 — Probability Weights & Weighted ECL", bold: true, color: "002147" })] }),
        makeTable(
          ["Scenario", "ECL 12-Month", "ECL Lifetime", "Coverage Ratio"],
          [
            [`Baseline (${auditData.weights.base}%)`,  fmtAmt(auditData.scenarioSummary.base.ecl12m),    fmtAmt(auditData.scenarioSummary.base.eclLifetime),    fmtPct(auditData.scenarioSummary.base.coverage)],
            [`Adverse (${auditData.weights.adverse}%)`, fmtAmt(auditData.scenarioSummary.adverse.ecl12m), fmtAmt(auditData.scenarioSummary.adverse.eclLifetime), fmtPct(auditData.scenarioSummary.adverse.coverage)],
            [`Upside (${auditData.weights.upside}%)`,   fmtAmt(auditData.scenarioSummary.upside.ecl12m),  fmtAmt(auditData.scenarioSummary.upside.eclLifetime),  fmtPct(auditData.scenarioSummary.upside.coverage)],
            ["Probability-Weighted",                    fmtAmt(auditData.weighted.ecl12m),               fmtAmt(auditData.weighted.eclLifetime),               fmtPct(auditData.weighted.coverage)],
          ]
        ),
        new Paragraph({ text: "" }),

        // §4 ECL by Lease
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§4 — ECL by Lease (Full Schedule)", bold: true, color: "002147" })] }),
        makeTable(
          ["Lease ID", "Lessee", "Aircraft", "EAD", "PD 12m", "LGD", "ECL 12m", "ECL Lifetime", "Stage"],
          auditData.eclRows.map((r) => [
            r.id, r.lessee, r.aircraft,
            fmtAmt(r.ead), `${r.pd12m}%`, `${r.lgd}%`,
            fmtAmt(r.ecl12m), fmtAmt(r.eclLT), `S${r.stage}`,
          ])
        ),
        new Paragraph({ text: "" }),

        // §5 IFRS 7 §35H Roll-Forward
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§5 — IFRS 7 §35H ECL Allowance Roll-Forward", bold: true, color: "002147" })] }),
        makeTable(
          ["Movement", "Stage 1", "Stage 2", "Stage 3", "Total"],
          [
            ["Opening ECL balance",          "$8.10M",  "$20.40M", "$16.30M", "$44.80M"],
            ["New originations (Stage 1)",   "+$1.20M", "—",       "—",       "+$1.20M"],
            ["SICR transfers to Stage 2",    "−$0.85M", "+$2.10M", "—",       "+$1.25M"],
            ["SICR transfers to Stage 3",    "—",       "−$1.40M", "+$2.80M", "+$1.40M"],
            ["Write-offs",                   "—",       "—",       "−$2.10M", "−$2.10M"],
            ["Repayments / derecognition",   "−$0.45M", "−$0.85M", "−$0.40M", "−$1.70M"],
            ["FX and unwinding of discount", "+$0.40M", "+$1.35M", "+$0.60M", "+$2.35M"],
            ["Closing ECL balance",          "$8.40M",  "$21.60M", "$17.20M", "$47.20M"],
          ]
        ),
        new Paragraph({ text: "" }),

        // §6 IFRS 7 §35I Credit Quality
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§6 — IFRS 7 §35I Credit Quality Distribution", bold: true, color: "002147" })] }),
        makeTable(
          ["Rating Grade", "Stage 1 EAD", "Stage 2 EAD", "Stage 3 EAD", "Total EAD", "% Portfolio"],
          [
            ["A / A−",       "$412.0M", "—",      "—",      "$412.0M", "45.1%"],
            ["BBB",          "$185.0M", "$12.0M", "—",      "$197.0M", "21.6%"],
            ["BB / BB−",     "$142.0M", "$48.0M", "—",      "$190.0M", "20.8%"],
            ["B+",           "$32.0M",  "$58.0M", "—",      "$90.0M",  "9.9%"],
            ["B / B−",       "—",       "—",      "$6.6M",  "$6.6M",   "0.7%"],
            ["CCC and below","—",       "—",      "$17.6M", "$17.6M",  "1.9%"],
          ]
        ),
        new Paragraph({ text: "" }),

        // §7 SICR Configuration
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§7 — SICR Trigger Configuration", bold: true, color: "002147" })] }),
        makeTable(
          ["Trigger", "Status", "Threshold"],
          [
            ["30+ DPD Backstop",          sc.dpdEnabled ? "Active" : "Disabled",              sc.dpdEnabled ? `${sc.dpdDays} days` : "—"],
            ["Credit Downgrade Threshold", sc.upgradeEnabled ? "Active" : "Disabled",          sc.upgradeEnabled ? `${sc.upgradeNotches} notches` : "—"],
            ["Country Watchlist Event",    sc.countryWatchlistEnabled ? "Active" : "Disabled", "Automatic on watchlist flag"],
            ["Lessee Insolvency Filing",   sc.insolvencyEnabled ? "Active" : "Disabled",       "Automatic Stage 3"],
          ]
        ),
        new Paragraph({ text: "" }),

        // §8 Key Assumptions
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§8 — Key Assumptions & Management Overlays", bold: true, color: "002147" })] }),
        new Paragraph({ children: [new TextRun({ text: auditData.managementOverlay || "No management overlays documented for this period.", size: 18 })] }),
      ],
    }],
  });
  await saveDocx(doc, "auditor-evidence-pack");
  break;
}
```

- [ ] **Step 3: Add generateReportPDF after generateReportDOCX**

Add this new exported function at the end of `src/app/services/reportGenerators.ts` (after the closing brace of `generateReportDOCX`):

```typescript
// ── PDF Generator — captures the preview div via html2canvas ─────────────────
// Uses dynamic imports so html2canvas and jspdf are only loaded when needed.

export async function generateReportPDF(
  previewRef: React.RefObject<HTMLDivElement>,
): Promise<void> {
  if (!previewRef.current) return;

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(previewRef.current, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    windowWidth: previewRef.current.scrollWidth,
    windowHeight: previewRef.current.scrollHeight,
  });

  const imgData   = canvas.toDataURL("image/png");
  const A4_W_MM   = 210;
  const A4_H_MM   = 297;
  const pdfWidth  = A4_W_MM;
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let remaining = pdfHeight;
  let yOffset   = 0;
  let isFirst   = true;

  while (remaining > 0) {
    if (!isFirst) pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, yOffset, pdfWidth, pdfHeight);
    yOffset   -= A4_H_MM;
    remaining -= A4_H_MM;
    isFirst    = false;
  }

  const date = new Date().toISOString().slice(0, 10);
  pdf.save(`aeroinsights-auditor-evidence-pack-${date}.pdf`);
}
```

You also need to add `import React from "react"` (or `import type { RefObject } from "react"`) at the top if it's not already present. Add:

```typescript
import type { RefObject } from "react";
```

And update the function signature to use it:

```typescript
export async function generateReportPDF(
  previewRef: RefObject<HTMLDivElement>,
): Promise<void>
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep -i "reportgen\|auditorpack\|generateReport" | head -10
```

Expected: no output (no errors).

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/services/reportGenerators.ts && git commit -m "feat: enhance RPT-001 to 8-section IFRS 9 auditor pack DOCX; add PDF generator"
```

---

## Task 8: Build AuditorPackModal

Full-screen centered overlay modal. Left navigator (8 sections), scrollable right preview, PDF + DOCX download buttons in the header.

**Files:**
- Create: `src/app/components/risk-ecl/AuditorPackModal.tsx`

- [ ] **Step 1: Create AuditorPackModal.tsx**

Create `src/app/components/risk-ecl/AuditorPackModal.tsx` with this full content:

```typescript
// src/app/components/risk-ecl/AuditorPackModal.tsx
// Full-screen IFRS 9 Auditor Evidence Pack preview.
// 8-section formatted report, scrollable, with PDF + DOCX download.

import { useRef, useState, useEffect, type RefObject } from "react";
import { X, Download, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  generateReportDOCX,
  generateReportPDF,
  type AuditorPackData,
} from "../../services/reportGenerators";

// ─── Section navigator config ─────────────────────────────────────────────────

const SECTIONS = [
  { id: "s1", label: "§1  Methodology"        },
  { id: "s2", label: "§2  Scenario Defs"      },
  { id: "s3", label: "§3  Weighted ECL"        },
  { id: "s4", label: "§4  ECL by Lease"        },
  { id: "s5", label: "§5  Roll-Forward"        },
  { id: "s6", label: "§6  Credit Quality"      },
  { id: "s7", label: "§7  SICR Config"         },
  { id: "s8", label: "§8  Assumptions"         },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AuditorPackModalProps {
  open: boolean;
  onClose: () => void;
  data: AuditorPackData;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtM  = (n: number) => `$${n.toFixed(1)}M`;
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 style={{
      fontSize: "0.9375rem", fontWeight: 700, color: "#002147",
      marginBottom: "0.875rem", paddingBottom: "0.5rem",
      borderBottom: "2px solid #002147",
    }}>
      {title}
    </h2>
  );
}

function PreviewTable({
  headers, rows,
}: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ background: "#002147" }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "0.5rem 0.75rem", textAlign: i === 0 ? "left" : "right", color: "#FFFFFF", fontWeight: 600, fontSize: "0.75rem", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "0.5rem 0.75rem", textAlign: ci === 0 ? "left" : "right", color: "#475569", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AuditorPackModal({ open, onClose, data }: AuditorPackModalProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("s1");
  const [managementOverlay, setManagementOverlay] = useState(
    "Management has considered the following overlays in addition to model outputs:\n\n[Document any qualitative adjustments, post-model overlays, or management judgements applied to the ECL estimate for this period.]"
  );
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Scroll to section
  function scrollTo(id: string) {
    document.getElementById(`auditor-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  // Download handlers
  async function handleDOCX() {
    setDownloading("docx");
    try {
      await generateReportDOCX("RPT-001", data.currency, undefined, { ...data, managementOverlay });
    } finally {
      setDownloading(null);
    }
  }

  async function handlePDF() {
    setDownloading("pdf");
    try {
      await generateReportPDF(previewRef as RefObject<HTMLDivElement>);
    } finally {
      setDownloading(null);
    }
  }

  const sc = data.sicrConfig;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 1000 }}
          />

          {/* Modal panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: "fixed",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: "90vw", maxWidth: "1200px",
              height: "90vh",
              background: "#FFFFFF",
              borderRadius: "1rem",
              boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
              zIndex: 1001,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header bar */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1rem 1.5rem",
              background: "#002147",
              borderRadius: "1rem 1rem 0 0",
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
                  IFRS 9 Auditor Evidence Pack
                </div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "0.125rem" }}>
                  Q1 2026 · Generated {new Date().toLocaleDateString("en-IE", { dateStyle: "long" })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button
                  onClick={handlePDF}
                  disabled={!!downloading}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    background: "rgba(255,255,255,0.12)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255,255,255,0.25)",
                    borderRadius: "9999px", padding: "0.5rem 1rem",
                    fontSize: "0.8125rem", fontWeight: 500,
                    cursor: downloading ? "not-allowed" : "pointer",
                    opacity: downloading === "pdf" ? 0.7 : 1,
                    transition: "opacity 150ms ease",
                  }}
                >
                  <Download size={13} />
                  {downloading === "pdf" ? "Generating…" : "Download PDF"}
                </button>
                <button
                  onClick={handleDOCX}
                  disabled={!!downloading}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    background: "#FFFFFF", color: "#002147",
                    border: "none",
                    borderRadius: "9999px", padding: "0.5rem 1rem",
                    fontSize: "0.8125rem", fontWeight: 600,
                    cursor: downloading ? "not-allowed" : "pointer",
                    opacity: downloading === "docx" ? 0.7 : 1,
                    transition: "opacity 150ms ease",
                  }}
                >
                  <FileText size={13} />
                  {downloading === "docx" ? "Generating…" : "Download DOCX"}
                </button>
                <button
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(255,255,255,0.1)", border: "none",
                    borderRadius: "50%", cursor: "pointer", color: "#FFFFFF",
                    transition: "background 150ms ease",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              {/* Left navigator */}
              <div style={{ width: "210px", flexShrink: 0, borderRight: "1px solid #E2E8F0", padding: "1rem 0", overflowY: "auto", background: "#F8FAFC" }}>
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "0.625rem 1.25rem",
                      background: activeSection === s.id ? "rgba(0,33,71,0.07)" : "transparent",
                      borderLeft: `3px solid ${activeSection === s.id ? "#002147" : "transparent"}`,
                      border: "none", borderTop: "none", borderBottom: "none", borderRight: "none",
                      cursor: "pointer",
                      fontSize: "0.8125rem",
                      fontWeight: activeSection === s.id ? 600 : 400,
                      color: activeSection === s.id ? "#002147" : "#475569",
                      transition: "all 140ms ease",
                      fontFamily: "inherit",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Scrollable report content — captured by previewRef for PDF */}
              <div
                ref={previewRef}
                style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem", background: "#FFFFFF" }}
                onScroll={(e) => {
                  // Update active section based on scroll position
                  const container = e.currentTarget;
                  for (const s of [...SECTIONS].reverse()) {
                    const el = document.getElementById(`auditor-${s.id}`);
                    if (el && el.offsetTop - container.scrollTop <= 120) {
                      setActiveSection(s.id);
                      break;
                    }
                  }
                }}
              >
                {/* §1 Methodology */}
                <section id="auditor-s1" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§1 — Methodology Statement" />
                  <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.75, margin: 0 }}>
                    Expected Credit Loss (ECL) is measured under IFRS 9 <em>Financial Instruments</em> using the
                    three-stage impairment model. Stage 1 instruments carry a 12-month ECL allowance; Stage 2 and
                    Stage 3 instruments carry a lifetime ECL allowance. Probability of Default (PD), Loss Given
                    Default (LGD), and Exposure at Default (EAD) inputs are derived from lessee credit assessments,
                    aircraft market valuations, and contractual cash flow schedules. Forward-looking information is
                    incorporated through a minimum of three macro-economic scenarios (Baseline, Adverse, Upside)
                    probability-weighted per IFRS 9 §B5.5.41. Significant Increase in Credit Risk (SICR) is
                    assessed at each reporting date against the trigger framework documented in §7 of this pack.
                  </p>
                </section>

                {/* §2 Scenario Definitions */}
                <section id="auditor-s2" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§2 — Forward-Looking Scenario Definitions" />
                  <PreviewTable
                    headers={["Scenario", "GDP Δ", "RPK Δ", "Fuel Δ", "Asset Value Δ", "PD Mult S2", "PD Mult S3"]}
                    rows={[
                      [`Baseline (${data.weights.base}%)`,
                        `${(data.scenarioInputs.base.gdpDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.base.rpkDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.base.fuelDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.base.assetValueDelta * 100).toFixed(1)}%`,
                        `${data.scenarioInputs.base.pdS2Multi.toFixed(1)}×`,
                        `${data.scenarioInputs.base.pdS3Multi.toFixed(1)}×`,
                      ],
                      [`Adverse (${data.weights.adverse}%)`,
                        `${(data.scenarioInputs.adverse.gdpDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.adverse.rpkDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.adverse.fuelDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.adverse.assetValueDelta * 100).toFixed(1)}%`,
                        `${data.scenarioInputs.adverse.pdS2Multi.toFixed(1)}×`,
                        `${data.scenarioInputs.adverse.pdS3Multi.toFixed(1)}×`,
                      ],
                      [`Upside (${data.weights.upside}%)`,
                        `${(data.scenarioInputs.upside.gdpDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.upside.rpkDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.upside.fuelDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.upside.assetValueDelta * 100).toFixed(1)}%`,
                        `${data.scenarioInputs.upside.pdS2Multi.toFixed(1)}×`,
                        `${data.scenarioInputs.upside.pdS3Multi.toFixed(1)}×`,
                      ],
                    ]}
                  />
                </section>

                {/* §3 Weighted ECL */}
                <section id="auditor-s3" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§3 — Probability Weights & Weighted ECL" />
                  <PreviewTable
                    headers={["Scenario", "ECL 12-Month", "ECL Lifetime", "Coverage Ratio"]}
                    rows={[
                      [`Baseline (${data.weights.base}%)`,  fmtM(data.scenarioSummary.base.ecl12m),    fmtM(data.scenarioSummary.base.eclLifetime),    fmtPct(data.scenarioSummary.base.coverage)],
                      [`Adverse (${data.weights.adverse}%)`, fmtM(data.scenarioSummary.adverse.ecl12m), fmtM(data.scenarioSummary.adverse.eclLifetime), fmtPct(data.scenarioSummary.adverse.coverage)],
                      [`Upside (${data.weights.upside}%)`,   fmtM(data.scenarioSummary.upside.ecl12m),  fmtM(data.scenarioSummary.upside.eclLifetime),  fmtPct(data.scenarioSummary.upside.coverage)],
                      ["Probability-Weighted",               fmtM(data.weighted.ecl12m),               fmtM(data.weighted.eclLifetime),               fmtPct(data.weighted.coverage)],
                    ]}
                  />
                </section>

                {/* §4 ECL by Lease */}
                <section id="auditor-s4" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§4 — ECL by Lease (Full Schedule)" />
                  <PreviewTable
                    headers={["Lease ID", "Lessee", "Aircraft", "EAD", "PD 12m", "LGD", "ECL 12m", "ECL Lifetime", "Stage"]}
                    rows={data.eclRows.map((r) => [
                      <span style={{ fontFamily: "monospace", fontSize: "0.6875rem", color: "#94A3B8" }}>{r.id}</span>,
                      <span style={{ fontWeight: 600, color: "#0F172A" }}>{r.lessee}</span>,
                      r.aircraft,
                      `$${r.ead.toFixed(1)}M`,
                      `${r.pd12m}%`,
                      `${r.lgd}%`,
                      `$${r.ecl12m.toFixed(2)}M`,
                      <span style={{ fontWeight: 600, color: r.stage === "3" ? "#B91C1C" : r.stage === "2" ? "#B45309" : "#0F172A" }}>${r.eclLT.toFixed(2)}M</span>,
                      <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "4px", background: r.stage === "3" ? "rgba(185,28,28,0.1)" : r.stage === "2" ? "rgba(180,83,9,0.1)" : "rgba(21,128,61,0.1)", color: r.stage === "3" ? "#B91C1C" : r.stage === "2" ? "#B45309" : "#15803D" }}>S{r.stage}</span>,
                    ])}
                  />
                </section>

                {/* §5 Roll-Forward */}
                <section id="auditor-s5" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§5 — IFRS 7 §35H ECL Allowance Roll-Forward" />
                  <PreviewTable
                    headers={["Movement", "Stage 1", "Stage 2", "Stage 3", "Total"]}
                    rows={[
                      ["Opening ECL balance",          "$8.10M",  "$20.40M", "$16.30M", "$44.80M"],
                      ["New originations (Stage 1)",   "+$1.20M", "—",       "—",       "+$1.20M"],
                      ["SICR transfers to Stage 2",    "−$0.85M", "+$2.10M", "—",       "+$1.25M"],
                      ["SICR transfers to Stage 3",    "—",       "−$1.40M", "+$2.80M", "+$1.40M"],
                      ["Write-offs",                   "—",       "—",       "−$2.10M", "−$2.10M"],
                      ["Repayments / derecognition",   "−$0.45M", "−$0.85M", "−$0.40M", "−$1.70M"],
                      ["FX and unwinding of discount", "+$0.40M", "+$1.35M", "+$0.60M", "+$2.35M"],
                      ["Closing ECL balance",          "$8.40M",  "$21.60M", "$17.20M", "$47.20M"],
                    ]}
                  />
                </section>

                {/* §6 Credit Quality */}
                <section id="auditor-s6" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§6 — IFRS 7 §35I Credit Quality Distribution" />
                  <PreviewTable
                    headers={["Rating Grade", "Stage 1 EAD", "Stage 2 EAD", "Stage 3 EAD", "Total EAD", "% Portfolio"]}
                    rows={[
                      ["A / A−",        "$412.0M", "—",      "—",      "$412.0M", "45.1%"],
                      ["BBB",           "$185.0M", "$12.0M", "—",      "$197.0M", "21.6%"],
                      ["BB / BB−",      "$142.0M", "$48.0M", "—",      "$190.0M", "20.8%"],
                      ["B+",            "$32.0M",  "$58.0M", "—",      "$90.0M",  "9.9%"],
                      ["B / B−",        "—",       "—",      "$6.6M",  "$6.6M",   "0.7%"],
                      ["CCC and below", "—",       "—",      "$17.6M", "$17.6M",  "1.9%"],
                    ]}
                  />
                </section>

                {/* §7 SICR Config */}
                <section id="auditor-s7" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§7 — SICR Trigger Configuration" />
                  <PreviewTable
                    headers={["Trigger", "Status", "Threshold"]}
                    rows={[
                      ["30+ DPD Backstop",
                        <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: sc.dpdEnabled ? "rgba(21,128,61,0.1)" : "rgba(148,163,184,0.15)", color: sc.dpdEnabled ? "#15803D" : "#94A3B8" }}>{sc.dpdEnabled ? "ACTIVE" : "DISABLED"}</span>,
                        sc.dpdEnabled ? `${sc.dpdDays} days` : "—",
                      ],
                      ["Credit Downgrade Threshold",
                        <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: sc.upgradeEnabled ? "rgba(21,128,61,0.1)" : "rgba(148,163,184,0.15)", color: sc.upgradeEnabled ? "#15803D" : "#94A3B8" }}>{sc.upgradeEnabled ? "ACTIVE" : "DISABLED"}</span>,
                        sc.upgradeEnabled ? `${sc.upgradeNotches} notches` : "—",
                      ],
                      ["Country Watchlist Event",
                        <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: sc.countryWatchlistEnabled ? "rgba(21,128,61,0.1)" : "rgba(148,163,184,0.15)", color: sc.countryWatchlistEnabled ? "#15803D" : "#94A3B8" }}>{sc.countryWatchlistEnabled ? "ACTIVE" : "DISABLED"}</span>,
                        "Automatic on watchlist flag",
                      ],
                      ["Lessee Insolvency Filing",
                        <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: sc.insolvencyEnabled ? "rgba(21,128,61,0.1)" : "rgba(148,163,184,0.15)", color: sc.insolvencyEnabled ? "#15803D" : "#94A3B8" }}>{sc.insolvencyEnabled ? "ACTIVE" : "DISABLED"}</span>,
                        "Automatic Stage 3",
                      ],
                    ]}
                  />
                </section>

                {/* §8 Key Assumptions */}
                <section id="auditor-s8" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§8 — Key Assumptions & Management Overlays" />
                  <p style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "0.625rem" }}>
                    Edit this field before downloading to document any qualitative overlays for this period.
                  </p>
                  <textarea
                    value={managementOverlay}
                    onChange={(e) => setManagementOverlay(e.target.value)}
                    rows={8}
                    style={{
                      width: "100%",
                      padding: "0.875rem",
                      border: "1px solid #E2E8F0",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#475569",
                      lineHeight: 1.7,
                      resize: "vertical",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      outline: "none",
                      transition: "border-color 150ms ease",
                    }}
                    onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "#002147"; }}
                    onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "#E2E8F0"; }}
                  />
                </section>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep -i "auditorpack\|AuditorPack" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/risk-ecl/AuditorPackModal.tsx && git commit -m "feat: add AuditorPackModal — 8-section IFRS 9 preview with PDF and DOCX download"
```

---

## Task 9: Wire AuditorPackModal into RiskECL

Connect the modal to both existing header buttons, pass all live data, and render it at the bottom of the page.

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

- [ ] **Step 1: Add AuditorPackModal import**

At the top of `src/app/pages/RiskECL.tsx`, add:

```typescript
import { AuditorPackModal } from "../components/risk-ecl/AuditorPackModal";
```

- [ ] **Step 2: Add auditorPackOpen state**

Inside the `RiskECL()` component, with the other `useState` calls, add:

```typescript
const [auditorPackOpen, setAuditorPackOpen] = useState(false);
```

- [ ] **Step 3: Wire both header buttons**

In the `<PageHeader>` children, find the "Auditor Evidence Pack" button. Add `onClick`:

```tsx
<button
  onClick={() => setAuditorPackOpen(true)}
  style={{
    display: "flex", alignItems: "center", gap: "0.5rem",
    background: "#F4F5F7", color: "#0F172A",
    border: "1px solid #E2E8F0", borderRadius: "9999px",
    padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
  }}
>
  <Download size={14} /> Auditor Evidence Pack
</button>
```

Find the "Export PDF + JSON" button. Add the same `onClick`:

```tsx
<button
  onClick={() => setAuditorPackOpen(true)}
  style={{
    display: "flex", alignItems: "center", gap: "0.5rem",
    background: "#002147", color: "#FFFFFF", border: "none",
    borderRadius: "9999px", padding: "0.625rem 1.25rem",
    fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
  }}
>
  Export PDF + JSON
</button>
```

- [ ] **Step 4: Render AuditorPackModal at the end of the return**

Inside the `return (...)` of `RiskECL`, just before the final closing `</motion.div>`, add:

```tsx
<AuditorPackModal
  open={auditorPackOpen}
  onClose={() => setAuditorPackOpen(false)}
  data={{
    scenarioInputs,
    weights,
    weighted,
    scenarioSummary,
    eclRows: sortedECL.map((r) => ({
      id: r.id,
      lessee: r.lessee,
      aircraft: r.aircraft,
      ead: r.eadNum,
      pd12m: r.pd12m,
      lgd: r.lgd,
      ecl12m: r.ecl12m,
      eclLT: r.eclLifetime,
      stage: stageOverrides[r.id] ?? r.stage,
    })),
    sicrConfig,
    managementOverlay: "",
    currency: "USD",
  }}
/>
```

- [ ] **Step 5: Full TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/RiskECL.tsx && git commit -m "feat: wire AuditorPackModal into Risk & ECL page header — PDF + DOCX export live"
```

---

## Task 10: Smoke Test & Deploy

Verify the full feature flow works end-to-end before deploying.

**Files:** none

- [ ] **Step 1: Start dev server**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run dev
```

Navigate to `http://localhost:5173/risk-ecl`. Open the browser console (F12). Expected: no errors.

- [ ] **Step 2: Smoke test — Scenario Editor**

1. Open the **ECL Overview** tab
2. Expand **"Forward-Looking Scenario Inputs"** (collapsed by default)
3. Change the **Adverse GDP Growth** field from `−2.0%` to `−5.0%`
4. Watch the Adverse ECL value in the weighted ECL table **increase** — confirms live recalculation
5. Click **"Reset"** on the Adverse column — values return to defaults

- [ ] **Step 3: Smoke test — SICR Evaluation**

1. Open the **SICR Config** tab
2. Scroll to the bottom — see "Run SICR Evaluation" button
3. Click it — a recommendations table appears showing **2 migrations**: Ryanair (S1→S2, DPD) and Air France (S1→S2, downgrade)
4. Check both rows → click **"Apply Selected Migrations"**
5. Navigate to the **ECL by Lease** tab — Ryanair and Air France rows now show a **"PENDING"** badge next to their stage pills

- [ ] **Step 4: Smoke test — Auditor Evidence Pack**

1. Click **"Auditor Evidence Pack"** button in the page header
2. Modal opens full-screen — confirm §1 through §8 navigator items are visible
3. Click **"§4 ECL by Lease"** in navigator — content scrolls to §4
4. Edit the §8 management overlay textarea
5. Click **"Download DOCX"** — a `.docx` file downloads
6. Click **"Download PDF"** — a `.pdf` file downloads
7. Press **Escape** — modal closes

- [ ] **Step 5: Deploy**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && vercel --prod
```

Expected: deployment URL printed. Open it and repeat smoke tests on production.

- [ ] **Step 6: Commit any final fixes if needed**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add -A && git commit -m "fix: post-smoke-test fixes"
```

Only run Step 6 if Step 5 revealed issues. Otherwise skip.
