# IFRS 9 Tier 1 Compliance Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire three interconnected IFRS 9 compliance features into the existing Risk & ECL page: editable forward-looking scenario inputs, a live SICR evaluation engine with stage migration recommendations, and a full 8-section Auditor Evidence Pack modal with PDF and DOCX download.

**Architecture:** Option A (in-place enhancement). Each feature lives in its natural tab — scenario editing inside the existing ECL Overview tab's probability weights card, SICR evaluation inside the SICR Config tab, and the Auditor Evidence Pack as a standalone full-screen modal triggered from the page header. 3 new files, 2 modified files, no new routes, no database changes.

**Tech Stack:** React + TypeScript, Framer Motion (existing), `docx` (existing), `html2canvas` + `jspdf` (new — PDF generation), Supabase mock data (frontend only).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/utils/sicrEvaluator.ts` | **Create** | Pure function: evaluates lease data against SICR config, returns recommended stage migrations |
| `src/app/utils/sicrEvaluator.test.ts` | **Create** | Unit tests for SICR evaluation logic |
| `src/app/components/risk-ecl/ScenarioEditor.tsx` | **Create** | Editable macro inputs for one scenario — rendered 3× in OverviewTab |
| `src/app/components/risk-ecl/AuditorPackModal.tsx` | **Create** | Full-screen 8-section preview modal with PDF + DOCX download |
| `src/app/pages/RiskECL.tsx` | **Modify** | Wire scenario editor, SICR evaluator, auditor modal into page |
| `src/app/services/reportGenerators.ts` | **Modify** | Enhance RPT-001 DOCX to include all 8 sections; add PDF generator |
| `src/app/data/mockPortfolioData.ts` | **Modify** | Add `ratingNotchesDowngraded`, `onCountryWatchlist`, `insolvencyFiled` to lessee mock data |

---

## Task 1: Extend Mock Lessee Data

Add the four fields the SICR evaluator needs. These fields do not exist in `mockPortfolioData.ts` today.

**Files:**
- Modify: `src/app/data/mockPortfolioData.ts`

- [ ] **Step 1: Read the current lessee shape in mockPortfolioData.ts**

```bash
grep -n "lessee\|Lessee\|lessees" /Users/tanamsethi/Downloads/Aeroinsights/src/app/data/mockPortfolioData.ts | head -40
```

- [ ] **Step 2: Add SICR evaluation fields to each lessee object**

Find the lessees array in `mockPortfolioData.ts`. Add these four fields to each lessee entry. Values based on existing `daysLate` and `rating` data already in the file:

```typescript
// Add to each lessee object:
ratingNotchesDowngraded: number;   // 0 = no downgrade, 1+ = notches downgraded vs prior period
onCountryWatchlist: boolean;        // true if lessee's country is on the sovereign watchlist
insolvencyFiled: boolean;           // true if formal insolvency petition filed
// dpdDays is already available as `daysLate` — reuse directly, no new field needed
```

Values per lessee (cross-reference with existing names):

| Lessee | ratingNotchesDowngraded | onCountryWatchlist | insolvencyFiled |
|---|---|---|---|
| Emirates | 0 | false | false |
| Ryanair | 0 | false | false |
| Singapore Airlines | 0 | false | false |
| Air France | 0 | false | false |
| Lufthansa | 0 | false | false |
| Azul Brazilian Airlines | 1 | false | false |
| Air Transat | 0 | false | false |
| SriLankan Airlines | 2 | true | false |
| IndiGo Airlines | 1 | true | false |
| Aeromexico | 3 | false | true |

- [ ] **Step 3: Export a TypeScript type for the extended lessee shape**

If `mockPortfolioData.ts` exports a type for lessees, extend it. If not, add:

```typescript
export interface MockLessee {
  id: string;
  name: string;
  country: string;
  rating: string;
  daysLate: number;
  ratingNotchesDowngraded: number;
  onCountryWatchlist: boolean;
  insolvencyFiled: boolean;
  // ... any existing fields
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/data/mockPortfolioData.ts
git commit -m "feat: extend lessee mock data with SICR evaluation fields"
```

---

## Task 2: SICR Evaluator (Pure Function + Tests)

Build the evaluation engine as a pure function with no side effects. Tests first.

**Files:**
- Create: `src/app/utils/sicrEvaluator.ts`
- Create: `src/app/utils/sicrEvaluator.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/app/utils/sicrEvaluator.test.ts`:

```typescript
import { evaluateSICR, type SICREvaluationInput, type SICRConfig } from "./sicrEvaluator";

const defaultConfig: SICRConfig = {
  dpdEnabled: true,
  dpdDays: 30,
  upgradeEnabled: true,
  upgradeNotches: 2,
  countryWatchlistEnabled: true,
  insolvencyEnabled: true,
};

const baseLease: SICREvaluationInput = {
  leaseId: "LSE-TEST-001",
  lesseeName: "Test Airline",
  aircraft: "A320neo",
  currentStage: "1",
  dpdDays: 0,
  ratingNotchesDowngraded: 0,
  onCountryWatchlist: false,
  insolvencyFiled: false,
  baseECLm: 1.0,
};

describe("evaluateSICR", () => {
  it("returns empty array when no triggers fire", () => {
    const result = evaluateSICR([baseLease], defaultConfig);
    expect(result).toHaveLength(0);
  });

  it("recommends Stage 2 when DPD exceeds threshold", () => {
    const lease = { ...baseLease, dpdDays: 45 };
    const result = evaluateSICR([lease], defaultConfig);
    expect(result).toHaveLength(1);
    expect(result[0].recommendedStage).toBe("2");
    expect(result[0].triggersFired).toContain("30+ DPD Backstop");
  });

  it("does NOT trigger when DPD is below threshold", () => {
    const lease = { ...baseLease, dpdDays: 25 };
    const result = evaluateSICR([lease], defaultConfig);
    expect(result).toHaveLength(0);
  });

  it("recommends Stage 3 when insolvency is filed, regardless of DPD", () => {
    const lease = { ...baseLease, insolvencyFiled: true, dpdDays: 0 };
    const result = evaluateSICR([lease], defaultConfig);
    expect(result).toHaveLength(1);
    expect(result[0].recommendedStage).toBe("3");
    expect(result[0].triggersFired).toContain("Lessee Insolvency Filing");
  });

  it("does not recommend when lease is already at recommended stage", () => {
    const lease = { ...baseLease, currentStage: "2" as const, insolvencyFiled: false, dpdDays: 45 };
    const result = evaluateSICR([lease], defaultConfig);
    // DPD triggers S2, already at S2 — no recommendation
    expect(result).toHaveLength(0);
  });

  it("recommends Stage 3 for Stage 2 lease when insolvency filed", () => {
    const lease = { ...baseLease, currentStage: "2" as const, insolvencyFiled: true };
    const result = evaluateSICR([lease], defaultConfig);
    expect(result).toHaveLength(1);
    expect(result[0].recommendedStage).toBe("3");
  });

  it("does not recommend anything when all triggers disabled", () => {
    const allDisabled: SICRConfig = {
      dpdEnabled: false,
      dpdDays: 30,
      upgradeEnabled: false,
      upgradeNotches: 2,
      countryWatchlistEnabled: false,
      insolvencyEnabled: false,
    };
    const lease = { ...baseLease, dpdDays: 90, insolvencyFiled: true, onCountryWatchlist: true };
    const result = evaluateSICR([lease], allDisabled);
    expect(result).toHaveLength(0);
  });

  it("includes all fired trigger names in triggersFired", () => {
    const lease = { ...baseLease, dpdDays: 45, onCountryWatchlist: true };
    const result = evaluateSICR([lease], defaultConfig);
    expect(result[0].triggersFired).toContain("30+ DPD Backstop");
    expect(result[0].triggersFired).toContain("Country Watchlist Event");
  });

  it("recommends Stage 2 for rating downgrade meeting threshold", () => {
    const lease = { ...baseLease, ratingNotchesDowngraded: 2 };
    const result = evaluateSICR([lease], defaultConfig);
    expect(result).toHaveLength(1);
    expect(result[0].recommendedStage).toBe("2");
    expect(result[0].triggersFired).toContain("Credit Downgrade (≥2 notches)");
  });

  it("does not trigger downgrade below threshold", () => {
    const lease = { ...baseLease, ratingNotchesDowngraded: 1 };
    const result = evaluateSICR([lease], defaultConfig);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests — confirm they all fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/sicrEvaluator.test.ts 2>&1 | tail -20
```

Expected: all tests fail with "Cannot find module './sicrEvaluator'"

- [ ] **Step 3: Implement `sicrEvaluator.ts`**

Create `src/app/utils/sicrEvaluator.ts`:

```typescript
// src/app/utils/sicrEvaluator.ts
// Pure SICR (Significant Increase in Credit Risk) evaluation engine.
// No side effects — deterministic given the same inputs.

export interface SICRConfig {
  dpdEnabled: boolean;
  dpdDays: number;
  upgradeEnabled: boolean;
  upgradeNotches: number;
  countryWatchlistEnabled: boolean;
  insolvencyEnabled: boolean;
}

export interface SICREvaluationInput {
  leaseId: string;
  lesseeName: string;
  aircraft: string;
  currentStage: "1" | "2" | "3";
  dpdDays: number;                  // days past due on most recent payment
  ratingNotchesDowngraded: number;  // notches downgraded vs prior assessment period
  onCountryWatchlist: boolean;      // lessee's operating country on sovereign watchlist
  insolvencyFiled: boolean;         // formal insolvency petition filed
  baseECLm: number;                 // current ECL on this lease ($M) — used to estimate delta
}

export interface SICRMigrationRecommendation {
  leaseId: string;
  lesseeName: string;
  aircraft: string;
  currentStage: "1" | "2" | "3";
  recommendedStage: "2" | "3";
  triggersFired: string[];
  eclDeltaM: number;  // estimated additional ECL from stage migration ($M)
}

// ECL multiplier when migrating stage — approximate:
// S1→S2: lifetime ECL applies instead of 12-month, roughly 2× increase
// S1→S3 or S2→S3: full LGD applied immediately
const STAGE_ECL_MULTIPLIERS: Record<string, number> = {
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

    if (config.insolvencyEnabled && lease.insolvencyFiled) {
      triggersFired.push("Lessee Insolvency Filing");
    }
    if (config.dpdEnabled && lease.dpdDays >= config.dpdDays) {
      triggersFired.push(`${config.dpdDays}+ DPD Backstop`);
    }
    if (config.upgradeEnabled && lease.ratingNotchesDowngraded >= config.upgradeNotches) {
      triggersFired.push(`Credit Downgrade (≥${config.upgradeNotches} notches)`);
    }
    if (config.countryWatchlistEnabled && lease.onCountryWatchlist) {
      triggersFired.push("Country Watchlist Event");
    }

    if (triggersFired.length === 0) continue;

    // Determine recommended stage
    const forceStage3 = config.insolvencyEnabled && lease.insolvencyFiled;
    const recommendedStage: "2" | "3" = forceStage3 ? "3" : "2";

    // Skip if already at or beyond recommended stage
    const currentNum = parseInt(lease.currentStage);
    const recommendedNum = parseInt(recommendedStage);
    if (currentNum >= recommendedNum) continue;

    const multiplierKey = `${lease.currentStage}-${recommendedStage}`;
    const multiplier = STAGE_ECL_MULTIPLIERS[multiplierKey] ?? 1.0;
    const eclDeltaM = lease.baseECLm * (multiplier - 1);

    recommendations.push({
      leaseId: lease.leaseId,
      lesseeName: lease.lesseeName,
      aircraft: lease.aircraft,
      currentStage: lease.currentStage,
      recommendedStage,
      triggersFired,
      eclDeltaM: Math.max(0, eclDeltaM),
    });
  }

  return recommendations;
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/sicrEvaluator.test.ts 2>&1 | tail -20
```

Expected: all 10 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/sicrEvaluator.ts src/app/utils/sicrEvaluator.test.ts
git commit -m "feat: add SICR evaluation engine with full test coverage"
```

---

## Task 3: ScenarioEditor Component

A single-scenario macro input editor. Rendered 3× in RiskECL — once per scenario.

**Files:**
- Create: `src/app/components/risk-ecl/ScenarioEditor.tsx`

- [ ] **Step 1: Create `ScenarioEditor.tsx`**

```typescript
// src/app/components/risk-ecl/ScenarioEditor.tsx
import type { ScenarioInputs } from "../../utils/eclCalculator";

interface ScenarioEditorProps {
  label: string;
  color: string;          // e.g. "#002147", "#B45309", "#15803D"
  inputs: ScenarioInputs;
  defaults: ScenarioInputs;
  onChange: (inputs: ScenarioInputs) => void;
}

interface FieldDef {
  key: keyof ScenarioInputs;
  label: string;
  unit: string;
  scale: number;          // multiply stored value by scale for display (e.g. 100 for % fields)
  min: number;
  max: number;
  step: number;
}

const FIELDS: FieldDef[] = [
  { key: "gdpDelta",         label: "GDP Growth",            unit: "%",   scale: 100, min: -20,  max: 20,   step: 0.1  },
  { key: "rpkDelta",         label: "RPK Air Traffic",       unit: "%",   scale: 100, min: -60,  max: 30,   step: 0.5  },
  { key: "fuelDelta",        label: "Fuel Cost",             unit: "%",   scale: 100, min: -50,  max: 100,  step: 0.5  },
  { key: "fxDelta",          label: "FX Rate",               unit: "%",   scale: 100, min: -40,  max: 40,   step: 0.5  },
  { key: "rateDelta",        label: "Interest Rate",         unit: "bps", scale: 100, min: -200, max: 500,  step: 5    },
  { key: "assetValueDelta",  label: "Aircraft Market Value", unit: "%",   scale: 100, min: -50,  max: 30,   step: 0.5  },
  { key: "pdS2Multi",        label: "PD Multiplier (S2)",    unit: "×",   scale: 1,   min: 0.1,  max: 5,    step: 0.1  },
  { key: "pdS3Multi",        label: "PD Multiplier (S3)",    unit: "×",   scale: 1,   min: 0.1,  max: 5,    step: 0.1  },
];

export function ScenarioEditor({ label, color, inputs, defaults, onChange }: ScenarioEditorProps) {
  function handleChange(key: keyof ScenarioInputs, displayVal: string, scale: number) {
    const num = parseFloat(displayVal);
    if (isNaN(num)) return;
    onChange({ ...inputs, [key]: num / scale });
  }

  function resetToDefaults() {
    onChange(defaults);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {/* Column header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>{label}</span>
        </div>
        <button
          onClick={resetToDefaults}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "0.6875rem", color: "#94A3B8",
            textDecoration: "underline", textUnderlineOffset: "2px", padding: 0,
          }}
        >
          Reset
        </button>
      </div>

      {/* Input fields */}
      {FIELDS.map((field) => {
        const rawVal = inputs[field.key] as number;
        const displayVal = (rawVal * field.scale).toFixed(field.step < 1 ? 1 : 0);
        return (
          <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <label style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500 }}>
              {field.label}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={displayVal}
                onChange={(e) => handleChange(field.key, e.target.value, field.scale)}
                style={{
                  width: "100%",
                  padding: "0.375rem 1.875rem 0.375rem 0.625rem",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0.375rem",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: rawVal < 0 ? "#B91C1C" : rawVal > 0 ? "#15803D" : "#0F172A",
                  background: "#FFFFFF",
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "right",
                  appearance: "none",
                  boxSizing: "border-box",
                }}
              />
              <span style={{
                position: "absolute", right: "0.5rem", top: "50%",
                transform: "translateY(-50%)",
                fontSize: "0.6875rem", color: "#94A3B8", pointerEvents: "none",
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

- [ ] **Step 2: Verify the component renders without TypeScript errors**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep -i scenarioeditor
```

Expected: no errors mentioning ScenarioEditor

- [ ] **Step 3: Commit**

```bash
git add src/app/components/risk-ecl/ScenarioEditor.tsx
git commit -m "feat: add ScenarioEditor component for editable IFRS 9 macro inputs"
```

---

## Task 4: Wire Scenario Editor into RiskECL

Replace hardcoded `ADVERSE_INPUTS` / `UPSIDE_INPUTS` with stateful scenario inputs. Add the editor UI into the ECL Overview tab.

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

- [ ] **Step 1: Add `scenarioInputs` state**

In `RiskECL.tsx`, replace the two hardcoded const declarations:

```typescript
// REMOVE these two consts:
const ADVERSE_INPUTS: ScenarioInputs = { ... };
const UPSIDE_INPUTS: ScenarioInputs = { ... };
```

Add instead (above the component, keep the values as defaults):

```typescript
const DEFAULT_ADVERSE_INPUTS: ScenarioInputs = {
  gdpDelta: -0.02,
  rpkDelta: -0.25,
  fuelDelta: 0.30,
  fxDelta: 0,
  rateDelta: 0.01,
  assetValueDelta: -0.10,
  pdS2Multi: 1.5,
  pdS3Multi: 2.0,
  // all other ScenarioInputs fields set to 0/null (same as ZERO_INPUTS for the rest)
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

Inside the component, add state:

```typescript
const [scenarioInputs, setScenarioInputs] = useState({
  base:    ZERO_INPUTS,
  adverse: DEFAULT_ADVERSE_INPUTS,
  upside:  DEFAULT_UPSIDE_INPUTS,
});
```

- [ ] **Step 2: Update `scenarioSummary` to use stateful inputs**

Find the `scenarioSummary` computation in the component. Replace `ZERO_INPUTS`, `ADVERSE_INPUTS`, `UPSIDE_INPUTS` with `scenarioInputs.base`, `scenarioInputs.adverse`, `scenarioInputs.upside`:

```typescript
const scenarioSummary: ScenarioSummaryData = (() => {
  const LIFETIME_RATIO = 80.4 / 44.1;
  const baseECL     = computeECLFromBase(liveBaseECL, scenarioInputs.base);
  const adverseECL  = computeECLFromBase(liveBaseECL, scenarioInputs.adverse);
  const upsideECL   = computeECLFromBase(liveBaseECL, scenarioInputs.upside);
  const cov = (ecl: number) => totalEADm > 0 ? (ecl / totalEADm) * 100 : 0;
  return {
    base:    { ecl12m: baseECL,    eclLifetime: baseECL    * LIFETIME_RATIO, coverage: cov(baseECL)    },
    adverse: { ecl12m: adverseECL, eclLifetime: adverseECL * LIFETIME_RATIO, coverage: cov(adverseECL) },
    upside:  { ecl12m: upsideECL,  eclLifetime: upsideECL  * LIFETIME_RATIO, coverage: cov(upsideECL)  },
  };
})();
```

- [ ] **Step 3: Add ScenarioEditor to the OverviewTab**

Import `ScenarioEditor` at the top of `RiskECL.tsx`:

```typescript
import { ScenarioEditor } from "../components/risk-ecl/ScenarioEditor";
```

Inside `OverviewTab`, after the closing `</RiskSection>` of "Probability Controls" and after the weighted ECL table, add a new collapsible section:

```tsx
<RiskSection label="Scenario Macro Inputs" defaultOpen={false}>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", paddingTop: "0.75rem" }}>
    {([
      { key: "base" as const,    label: "Baseline",          color: "#002147", defaults: ZERO_INPUTS              },
      { key: "adverse" as const, label: "Adverse / Downside", color: "#B45309", defaults: DEFAULT_ADVERSE_INPUTS   },
      { key: "upside" as const,  label: "Upside",            color: "#15803D", defaults: DEFAULT_UPSIDE_INPUTS    },
    ]).map((s) => (
      <ScenarioEditor
        key={s.key}
        label={s.label}
        color={s.color}
        inputs={scenarioInputs[s.key]}
        defaults={s.defaults}
        onChange={(updated) => setScenarioInputs((prev) => ({ ...prev, [s.key]: updated }))}
      />
    ))}
  </div>
</RiskSection>
```

- [ ] **Step 4: Verify TypeScript compiles and dev server runs**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/RiskECL.tsx
git commit -m "feat: wire editable scenario macro inputs into ECL Overview tab"
```

---

## Task 5: Wire SICR Evaluator into RiskECL

Add SICR evaluation state, run button, and migration recommendations table into the SICR Config tab.

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

- [ ] **Step 1: Add SICR evaluation state**

Add these state variables inside the `RiskECL` component:

```typescript
import { evaluateSICR, type SICRMigrationRecommendation, type SICREvaluationInput } from "../utils/sicrEvaluator";

// State
const [sicrRecommendations, setSicrRecommendations] = useState<SICRMigrationRecommendation[] | null>(null);
const [stageOverrides, setStageOverrides] = useState<Record<string, "1" | "2" | "3">>({});
const [selectedMigrations, setSelectedMigrations] = useState<Set<string>>(new Set());
const [sicrRan, setSicrRan] = useState(false);
```

- [ ] **Step 2: Build SICR evaluation inputs from existing data**

Add a function inside the component that maps existing ECL table rows to `SICREvaluationInput[]`. This uses `sortedECL` (already computed) and the extended lessee mock data:

```typescript
import { mockLessees } from "../data/mockPortfolioData"; // adjust import path to match actual export

function buildSICRInputs(): SICREvaluationInput[] {
  return sortedECL.map((row) => {
    const lessee = mockLessees.find((l) => l.id === row.lesseeId || l.name === row.lessee);
    return {
      leaseId: row.id,
      lesseeName: row.lessee,
      aircraft: row.aircraft,
      currentStage: (stageOverrides[row.id] ?? row.stage) as "1" | "2" | "3",
      dpdDays: lessee?.daysLate ?? 0,
      ratingNotchesDowngraded: lessee?.ratingNotchesDowngraded ?? 0,
      onCountryWatchlist: lessee?.onCountryWatchlist ?? false,
      insolvencyFiled: lessee?.insolvencyFiled ?? false,
      baseECLm: row.ecl12m,
    };
  });
}
```

- [ ] **Step 3: Add Run SICR Evaluation button and recommendations table to SICRConfigTab**

At the bottom of `SICRConfigTab`, after the "Active Rules Summary" card's save/reset row, add:

```tsx
{/* Run Evaluation */}
<div style={{ display: "flex", justifyContent: "center", paddingTop: "0.5rem" }}>
  <button
    onClick={() => {
      const inputs = buildSICRInputs();
      const recs = evaluateSICR(inputs, sicrConfig);
      setSicrRecommendations(recs);
      setSelectedMigrations(new Set(recs.map((r) => r.leaseId)));
      setSicrRan(true);
    }}
    style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      background: "#002147", color: "#FFFFFF", border: "none",
      borderRadius: "9999px", padding: "0.625rem 1.5rem",
      fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
      width: "100%", justifyContent: "center",
    }}
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
        padding: "1rem", background: "rgba(21,128,61,0.06)",
        borderRadius: "0.625rem", borderLeft: "3px solid #15803D",
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
                <th style={{ padding: "0.625rem 0.75rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>
                  <input
                    type="checkbox"
                    checked={selectedMigrations.size === sicrRecommendations.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedMigrations(new Set(sicrRecommendations.map(r => r.leaseId)));
                      else setSelectedMigrations(new Set());
                    }}
                  />
                </th>
                {["Lease ID", "Lessee", "Aircraft", "Migration", "Triggers Fired", "ECL Impact"].map((h) => (
                  <th key={h} style={{ padding: "0.625rem 0.75rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
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
                        e.target.checked ? next.add(rec.leaseId) : next.delete(rec.leaseId);
                        setSelectedMigrations(next);
                      }}
                    />
                  </td>
                  <td style={{ padding: "0.75rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>{rec.leaseId}</td>
                  <td style={{ padding: "0.75rem", fontWeight: 600, color: "#0F172A" }}>{rec.lesseeName}</td>
                  <td style={{ padding: "0.75rem", color: "#475569" }}>{rec.aircraft}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: rec.currentStage === "1" ? "#15803D" : "#B45309", background: rec.currentStage === "1" ? "rgba(21,128,61,0.1)" : "rgba(180,83,9,0.1)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>S{rec.currentStage}</span>
                      <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>→</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: rec.recommendedStage === "3" ? "#B91C1C" : "#B45309", background: rec.recommendedStage === "3" ? "rgba(185,28,28,0.1)" : "rgba(180,83,9,0.1)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>S{rec.recommendedStage}</span>
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem", maxWidth: "220px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                      {rec.triggersFired.map((t) => (
                        <span key={t} style={{ fontSize: "0.6875rem", background: "#F4F5F7", color: "#475569", padding: "0.15rem 0.5rem", borderRadius: "9999px", whiteSpace: "nowrap" }}>{t}</span>
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

        {/* Apply button */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "1rem", borderTop: "1px solid #E2E8F0", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "#94A3B8", alignSelf: "center" }}>
            {selectedMigrations.size} of {sicrRecommendations.length} selected
          </span>
          <button
            disabled={selectedMigrations.size === 0}
            onClick={() => {
              const newOverrides = { ...stageOverrides };
              for (const rec of sicrRecommendations) {
                if (selectedMigrations.has(rec.leaseId)) {
                  newOverrides[rec.leaseId] = rec.recommendedStage;
                }
              }
              setStageOverrides(newOverrides);
              setSicrRecommendations(null);
              setSicrRan(false);
            }}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.5rem 1.125rem",
              background: selectedMigrations.size > 0 ? "#002147" : "#CBD5E1",
              border: "none", borderRadius: "9999px",
              fontSize: "0.875rem", fontWeight: 500,
              color: "#FFFFFF",
              cursor: selectedMigrations.size > 0 ? "pointer" : "not-allowed",
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

- [ ] **Step 4: Apply `stageOverrides` in ECL by Lease table**

In the `LeaseTab` `<tbody>`, when rendering the Stage column, use the override if present:

```tsx
// Replace the StatusPill cell:
<td style={{ padding: "0.75rem 1rem" }}>
  {(() => {
    const effectiveStage = stageOverrides[row.id] ?? row.stage;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <StatusPill stage={effectiveStage} label={`Stage ${effectiveStage}`} />
        {stageOverrides[row.id] && stageOverrides[row.id] !== row.stage && (
          <span style={{ fontSize: "0.625rem", color: "#B45309", fontWeight: 600, background: "rgba(180,83,9,0.1)", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
            PENDING
          </span>
        )}
      </div>
    );
  })()}
</td>
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/RiskECL.tsx
git commit -m "feat: wire SICR evaluation engine into SICR Config tab with migration recommendations"
```

---

## Task 6: Install PDF Dependencies

**Files:**
- `package.json`

- [ ] **Step 1: Install html2canvas and jspdf**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm install html2canvas jspdf
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node -e "require('html2canvas'); require('jspdf'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add html2canvas and jspdf for PDF export"
```

---

## Task 7: Enhance reportGenerators.ts

Update `generateReportDOCX` for RPT-001 to accept live data and render all 8 sections. Add a `generateReportPDF` function.

**Files:**
- Modify: `src/app/services/reportGenerators.ts`

- [ ] **Step 1: Update the `generateReportDOCX` function signature**

The existing function has 3 parameters. Add a 4th optional `auditData` parameter:

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

All existing call sites pass only 3 arguments — the 4th defaults to `undefined`, so no existing callers break.

- [ ] **Step 2: Add the live data interface**

At the top of `reportGenerators.ts`, before the function, add the extended input type:

```typescript
import type { ScenarioInputs } from "../utils/eclCalculator";

export interface AuditorPackData {
  // Scenario definitions
  scenarioInputs: {
    base: ScenarioInputs;
    adverse: ScenarioInputs;
    upside: ScenarioInputs;
  };
  // Probability weights
  weights: { base: number; adverse: number; upside: number };
  // Weighted ECL summary
  weighted: { ecl12m: number; eclLifetime: number; coverage: number };
  // Scenario ECL per scenario
  scenarioSummary: {
    base:    { ecl12m: number; eclLifetime: number; coverage: number };
    adverse: { ecl12m: number; eclLifetime: number; coverage: number };
    upside:  { ecl12m: number; eclLifetime: number; coverage: number };
  };
  // Per-lease ECL table (matches existing LeaseRow shape)
  eclRows: Array<{
    id: string; lessee: string; aircraft: string;
    ead: number; pd12m: number; lgd: number;
    ecl12m: number; eclLT: number; stage: string;
  }>;
  // SICR configuration
  sicrConfig: {
    dpdEnabled: boolean; dpdDays: number;
    upgradeEnabled: boolean; upgradeNotches: number;
    countryWatchlistEnabled: boolean;
    insolvencyEnabled: boolean;
  };
  // Free text overlay from §8
  managementOverlay: string;
  // Currency
  currency: CurrencyCode;
}
```

- [ ] **Step 3: Replace the RPT-001 case in `generateReportDOCX`**

Replace the existing `case "RPT-001"` block with a full 8-section document:

```typescript
case "RPT-001": {
  if (!auditData) { console.warn("RPT-001 requires auditData"); return; }

  const fmtPct = (n: number) => `${n.toFixed(2)}%`;
  const fmtM2  = (n: number) => fe(n, auditData.currency);

  // §1 Methodology paragraph
  const methodologyText = `Expected Credit Loss (ECL) is measured under IFRS 9 Financial Instruments using the three-stage impairment model. Stage 1 instruments carry a 12-month ECL allowance; Stage 2 and Stage 3 instruments carry a lifetime ECL allowance. Probability of Default (PD), Loss Given Default (LGD), and Exposure at Default (EAD) inputs are derived from lessee credit assessments, aircraft market valuations, and contractual cash flow schedules. Forward-looking information is incorporated through a minimum of three macro-economic scenarios (Baseline, Adverse, Upside) probability-weighted per IFRS 9 §B5.5.41. Significant Increase in Credit Risk (SICR) is assessed at each reporting date against the trigger framework documented in §7 of this pack.`;

  // §2 Scenario definitions table rows
  const scenarioDefRows = (
    [
      ["Base",    auditData.scenarioInputs.base,    auditData.weights.base],
      ["Adverse", auditData.scenarioInputs.adverse, auditData.weights.adverse],
      ["Upside",  auditData.scenarioInputs.upside,  auditData.weights.upside],
    ] as const
  ).map(([name, inp, wt]) => [
    `${name} (${wt}%)`,
    `${(inp.gdpDelta * 100).toFixed(1)}%`,
    `${(inp.rpkDelta * 100).toFixed(1)}%`,
    `${(inp.fuelDelta * 100).toFixed(1)}%`,
    `${(inp.assetValueDelta * 100).toFixed(1)}%`,
    `${(inp.pdS2Multi).toFixed(1)}×`,
    `${(inp.pdS3Multi).toFixed(1)}×`,
  ]);

  // §3 Weighted ECL summary rows
  const weightedRows = [
    ["Baseline",  fmtM2(auditData.scenarioSummary.base.ecl12m),    fmtM2(auditData.scenarioSummary.base.eclLifetime),    fmtPct(auditData.scenarioSummary.base.coverage)],
    ["Adverse",   fmtM2(auditData.scenarioSummary.adverse.ecl12m), fmtM2(auditData.scenarioSummary.adverse.eclLifetime), fmtPct(auditData.scenarioSummary.adverse.coverage)],
    ["Upside",    fmtM2(auditData.scenarioSummary.upside.ecl12m),  fmtM2(auditData.scenarioSummary.upside.eclLifetime),  fmtPct(auditData.scenarioSummary.upside.coverage)],
    ["Weighted",  fmtM2(auditData.weighted.ecl12m),                fmtM2(auditData.weighted.eclLifetime),               fmtPct(auditData.weighted.coverage)],
  ];

  // §7 SICR config rows
  const sc = auditData.sicrConfig;
  const sicrRows = [
    ["30+ DPD Backstop",          sc.dpdEnabled ? "Active" : "Disabled", sc.dpdEnabled ? `${sc.dpdDays} days` : "—"],
    ["Credit Downgrade Threshold", sc.upgradeEnabled ? "Active" : "Disabled", sc.upgradeEnabled ? `${sc.upgradeNotches} notches` : "—"],
    ["Country Watchlist Event",    sc.countryWatchlistEnabled ? "Active" : "Disabled", "Automatic on flag"],
    ["Lessee Insolvency Filing",   sc.insolvencyEnabled ? "Active" : "Disabled", "Automatic Stage 3"],
  ];

  doc = new Document({
    sections: [{
      children: [
        ...docPreamble("Auditor Evidence Pack — IFRS 9 ECL Disclosure", auditData.currency),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§1 — Methodology Statement", bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: methodologyText, size: 17 })] }),
        new Paragraph({ text: "" }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§2 — Forward-Looking Scenario Definitions", bold: true })] }),
        makeTable(["Scenario (Weight)", "GDP Δ", "RPK Δ", "Fuel Δ", "Asset Value Δ", "PD Mult S2", "PD Mult S3"], scenarioDefRows),
        new Paragraph({ text: "" }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§3 — Probability Weights & Weighted ECL", bold: true })] }),
        makeTable(["Scenario", "ECL 12-Month", "ECL Lifetime", "Coverage Ratio"], weightedRows),
        new Paragraph({ text: "" }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§4 — ECL by Lease (Full Schedule)", bold: true })] }),
        makeTable(
          ["Lease ID", "Lessee", "Aircraft", "EAD", "PD 12m", "LGD", "ECL 12m", "ECL Lifetime", "Stage"],
          auditData.eclRows.map((r) => [
            r.id, r.lessee, r.aircraft,
            fmtM2(r.ead), `${r.pd12m}%`, `${r.lgd}%`,
            fmtM2(r.ecl12m), fmtM2(r.eclLT), `S${r.stage}`,
          ])
        ),
        new Paragraph({ text: "" }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§5 — IFRS 7 §35H ECL Allowance Roll-Forward", bold: true })] }),
        makeTable(
          ["Movement", "Stage 1", "Stage 2", "Stage 3", "Total"],
          [
            ["Opening ECL balance", "$8.10M", "$20.40M", "$16.30M", "$44.80M"],
            ["New originations (Stage 1)", "+$1.20M", "—", "—", "+$1.20M"],
            ["SICR transfers to Stage 2", "−$0.85M", "+$2.10M", "—", "+$1.25M"],
            ["SICR transfers to Stage 3", "—", "−$1.40M", "+$2.80M", "+$1.40M"],
            ["Write-offs", "—", "—", "−$2.10M", "−$2.10M"],
            ["Repayments / derecognition", "−$0.45M", "−$0.85M", "−$0.40M", "−$1.70M"],
            ["FX and unwinding of discount", "+$0.40M", "+$1.35M", "+$0.60M", "+$2.35M"],
            ["Closing ECL balance", "$8.40M", "$21.60M", "$17.20M", "$47.20M"],
          ]
        ),
        new Paragraph({ text: "" }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§6 — IFRS 7 §35I Credit Quality Distribution", bold: true })] }),
        makeTable(
          ["Rating Grade", "Stage 1 EAD", "Stage 2 EAD", "Stage 3 EAD", "Total EAD", "% Portfolio"],
          [
            ["A / A−",       "$412.0M", "—",       "—",       "$412.0M", "45.1%"],
            ["BBB",          "$185.0M", "$12.0M",  "—",       "$197.0M", "21.6%"],
            ["BB / BB−",     "$142.0M", "$48.0M",  "—",       "$190.0M", "20.8%"],
            ["B+",           "$32.0M",  "$58.0M",  "—",       "$90.0M",  "9.9%"],
            ["B / B−",       "—",       "—",       "$6.6M",   "$6.6M",   "0.7%"],
            ["CCC and below","—",       "—",       "$17.6M",  "$17.6M",  "1.9%"],
          ]
        ),
        new Paragraph({ text: "" }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§7 — SICR Trigger Configuration", bold: true })] }),
        makeTable(["Trigger", "Status", "Threshold"], sicrRows),
        new Paragraph({ text: "" }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§8 — Key Assumptions & Management Overlays", bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: auditData.managementOverlay || "No management overlays documented for this period.", size: 17 })] }),
      ],
    }],
  });
  await saveDocx(doc, "auditor-evidence-pack");
  break;
}
```

- [ ] **Step 4: Add `generateReportPDF` function**

Add after the existing `generateReportDOCX` export:

```typescript
export async function generateReportPDF(previewRef: React.RefObject<HTMLDivElement>): Promise<void> {
  if (!previewRef.current) return;

  const { default: html2canvas } = await import("html2canvas");
  const { default: jsPDF } = await import("jspdf");

  const canvas = await html2canvas(previewRef.current, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: previewRef.current.scrollWidth,
    windowHeight: previewRef.current.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdfWidth = 210;  // A4 width in mm
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let heightLeft = pdfHeight;
  let position = 0;
  const pageHeight = 297; // A4 height in mm

  pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - pdfHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;
  }

  const date = new Date().toISOString().slice(0, 10);
  pdf.save(`aeroinsights-auditor-evidence-pack-${date}.pdf`);
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep -i reportgenerator
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/services/reportGenerators.ts
git commit -m "feat: enhance RPT-001 DOCX to 8-section auditor pack; add PDF generator"
```

---

## Task 8: Build AuditorPackModal

Full-screen centered preview modal with 8 sections, section navigator, and PDF + DOCX download buttons.

**Files:**
- Create: `src/app/components/risk-ecl/AuditorPackModal.tsx`

- [ ] **Step 1: Create `AuditorPackModal.tsx`**

```typescript
// src/app/components/risk-ecl/AuditorPackModal.tsx
import { useRef, useState, useEffect } from "react";
import { X, Download, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { generateReportDOCX, generateReportPDF, type AuditorPackData } from "../../services/reportGenerators";

const SECTIONS = [
  { id: "s1", label: "§1 Methodology" },
  { id: "s2", label: "§2 Scenario Definitions" },
  { id: "s3", label: "§3 Weighted ECL" },
  { id: "s4", label: "§4 ECL by Lease" },
  { id: "s5", label: "§5 Roll-Forward" },
  { id: "s6", label: "§6 Credit Quality" },
  { id: "s7", label: "§7 SICR Config" },
  { id: "s8", label: "§8 Assumptions" },
];

interface AuditorPackModalProps {
  open: boolean;
  onClose: () => void;
  data: AuditorPackData;
}

export function AuditorPackModal({ open, onClose, data }: AuditorPackModalProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("s1");
  const [managementOverlay, setManagementOverlay] = useState(
    "Management has considered the following overlays in addition to model outputs:\n\n[Document any qualitative adjustments, post-model overlays, or management judgements applied to the ECL estimate for this period.]"
  );
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`auditor-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  };

  const handleDownloadDOCX = async () => {
    setDownloading("docx");
    await generateReportDOCX("RPT-001", data.currency, undefined, { ...data, managementOverlay });
    setDownloading(null);
  };

  const handleDownloadPDF = async () => {
    setDownloading("pdf");
    await generateReportPDF(previewRef);
    setDownloading(null);
  };

  const fmtM = (n: number) => `$${n.toFixed(1)}M`;
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;

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
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)",
              zIndex: 1000,
            }}
          />

          {/* Modal */}
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
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1rem 1.5rem",
              borderBottom: "1px solid #E2E8F0",
              background: "#002147",
              borderRadius: "1rem 1rem 0 0",
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF" }}>
                  IFRS 9 Auditor Evidence Pack
                </div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginTop: "0.125rem" }}>
                  Q1 2026 · Generated {new Date().toLocaleDateString("en-IE", { dateStyle: "long" })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloading === "pdf"}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    background: "rgba(255,255,255,0.15)", color: "#FFFFFF",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: "9999px", padding: "0.5rem 1rem",
                    fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
                  }}
                >
                  <Download size={13} />
                  {downloading === "pdf" ? "Generating..." : "Download PDF"}
                </button>
                <button
                  onClick={handleDownloadDOCX}
                  disabled={downloading === "docx"}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    background: "#FFFFFF", color: "#002147",
                    border: "none",
                    borderRadius: "9999px", padding: "0.5rem 1rem",
                    fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                  }}
                >
                  <FileText size={13} />
                  {downloading === "docx" ? "Generating..." : "Download DOCX"}
                </button>
                <button
                  onClick={onClose}
                  style={{
                    background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer",
                    color: "#FFFFFF", borderRadius: "50%",
                    width: "32px", height: "32px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body: navigator + content */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              {/* Left navigator */}
              <div style={{
                width: "220px", flexShrink: 0,
                borderRight: "1px solid #E2E8F0",
                padding: "1rem 0",
                overflowY: "auto",
                background: "#F8FAFC",
              }}>
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(s.id)}
                    style={{
                      display: "block", width: "100%",
                      textAlign: "left",
                      padding: "0.625rem 1.25rem",
                      background: activeSection === s.id ? "rgba(0,33,71,0.08)" : "transparent",
                      borderLeft: `3px solid ${activeSection === s.id ? "#002147" : "transparent"}`,
                      border: "none", cursor: "pointer",
                      fontSize: "0.8125rem",
                      fontWeight: activeSection === s.id ? 600 : 400,
                      color: activeSection === s.id ? "#002147" : "#475569",
                      transition: "all 160ms ease",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Preview content */}
              <div ref={previewRef} style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
                {/* §1 Methodology */}
                <section id="auditor-s1" style={{ marginBottom: "2.5rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#002147", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "2px solid #002147" }}>
                    §1 — Methodology Statement
                  </h2>
                  <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.7 }}>
                    Expected Credit Loss (ECL) is measured under IFRS 9 <em>Financial Instruments</em> using the three-stage impairment model. Stage 1 instruments carry a 12-month ECL allowance; Stage 2 and Stage 3 instruments carry a lifetime ECL allowance. Probability of Default (PD), Loss Given Default (LGD), and Exposure at Default (EAD) inputs are derived from lessee credit assessments, aircraft market valuations, and contractual cash flow schedules. Forward-looking information is incorporated through a minimum of three macro-economic scenarios (Baseline, Adverse, Upside) probability-weighted per IFRS 9 §B5.5.41. Significant Increase in Credit Risk (SICR) is assessed at each reporting date against the trigger framework documented in §7 of this pack.
                  </p>
                </section>

                {/* §2 Scenario Definitions */}
                <section id="auditor-s2" style={{ marginBottom: "2.5rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#002147", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "2px solid #002147" }}>
                    §2 — Forward-Looking Scenario Definitions
                  </h2>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                    <thead>
                      <tr style={{ background: "#002147" }}>
                        {["Scenario", "GDP Δ", "RPK Δ", "Fuel Δ", "Asset Value Δ", "PD Mult S2", "PD Mult S3"].map((h) => (
                          <th key={h} style={{ padding: "0.625rem 0.75rem", textAlign: "left", color: "#FFFFFF", fontWeight: 600, fontSize: "0.75rem" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: `Baseline (${data.weights.base}%)`,  inp: data.scenarioInputs.base,    color: "#002147" },
                        { name: `Adverse (${data.weights.adverse}%)`, inp: data.scenarioInputs.adverse, color: "#B45309" },
                        { name: `Upside (${data.weights.upside}%)`,   inp: data.scenarioInputs.upside,  color: "#15803D" },
                      ].map((row, i) => (
                        <tr key={row.name} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                          <td style={{ padding: "0.625rem 0.75rem", fontWeight: 600, color: row.color }}>{row.name}</td>
                          <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{(row.inp.gdpDelta * 100).toFixed(1)}%</td>
                          <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{(row.inp.rpkDelta * 100).toFixed(1)}%</td>
                          <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{(row.inp.fuelDelta * 100).toFixed(1)}%</td>
                          <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{(row.inp.assetValueDelta * 100).toFixed(1)}%</td>
                          <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{row.inp.pdS2Multi.toFixed(1)}×</td>
                          <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{row.inp.pdS3Multi.toFixed(1)}×</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* §3 Weighted ECL */}
                <section id="auditor-s3" style={{ marginBottom: "2.5rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#002147", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "2px solid #002147" }}>
                    §3 — Probability Weights & Weighted ECL
                  </h2>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                    <thead>
                      <tr style={{ background: "#002147" }}>
                        {["Scenario", "ECL 12-Month", "ECL Lifetime", "Coverage Ratio"].map((h) => (
                          <th key={h} style={{ padding: "0.625rem 0.75rem", textAlign: h === "Scenario" ? "left" : "right", color: "#FFFFFF", fontWeight: 600, fontSize: "0.75rem" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: `Baseline (${data.weights.base}%)`,  d: data.scenarioSummary.base,    color: "#002147", bold: false },
                        { label: `Adverse (${data.weights.adverse}%)`, d: data.scenarioSummary.adverse, color: "#B45309", bold: false },
                        { label: `Upside (${data.weights.upside}%)`,   d: data.scenarioSummary.upside,  color: "#15803D", bold: false },
                        { label: "Probability-Weighted",               d: data.weighted,                color: "#002147", bold: true  },
                      ].map((row, i) => (
                        <tr key={row.label} style={{ background: row.bold ? "rgba(0,33,71,0.06)" : i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                          <td style={{ padding: "0.625rem 0.75rem", fontWeight: row.bold ? 700 : 500, color: row.color }}>{row.label}</td>
                          <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: row.bold ? 700 : 400, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtM(row.d.ecl12m)}</td>
                          <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: row.bold ? 700 : 400, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtM(row.d.eclLifetime)}</td>
                          <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: row.bold ? 700 : 400, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtPct(row.d.coverage)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* §4 ECL by Lease */}
                <section id="auditor-s4" style={{ marginBottom: "2.5rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#002147", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "2px solid #002147" }}>
                    §4 — ECL by Lease (Full Schedule)
                  </h2>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                    <thead>
                      <tr style={{ background: "#002147" }}>
                        {["Lease ID", "Lessee", "Aircraft", "EAD", "PD 12m", "LGD", "ECL 12m", "ECL Lifetime", "Stage"].map((h) => (
                          <th key={h} style={{ padding: "0.5rem 0.625rem", textAlign: h === "Lease ID" || h === "Lessee" || h === "Aircraft" ? "left" : "right", color: "#FFFFFF", fontWeight: 600, fontSize: "0.6875rem", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.eclRows.map((row, i) => (
                        <tr key={row.id} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                          <td style={{ padding: "0.5rem 0.625rem", fontFamily: "monospace", fontSize: "0.6875rem", color: "#94A3B8" }}>{row.id}</td>
                          <td style={{ padding: "0.5rem 0.625rem", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem" }}>{row.lessee}</td>
                          <td style={{ padding: "0.5rem 0.625rem", color: "#475569", fontSize: "0.75rem" }}>{row.aircraft}</td>
                          <td style={{ padding: "0.5rem 0.625rem", textAlign: "right", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>${row.ead.toFixed(1)}M</td>
                          <td style={{ padding: "0.5rem 0.625rem", textAlign: "right", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{row.pd12m}%</td>
                          <td style={{ padding: "0.5rem 0.625rem", textAlign: "right", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{row.lgd}%</td>
                          <td style={{ padding: "0.5rem 0.625rem", textAlign: "right", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>${row.ecl12m.toFixed(2)}M</td>
                          <td style={{ padding: "0.5rem 0.625rem", textAlign: "right", fontWeight: 600, color: row.stage === "3" ? "#B91C1C" : row.stage === "2" ? "#B45309" : "#0F172A", fontVariantNumeric: "tabular-nums" }}>${row.eclLT.toFixed(2)}M</td>
                          <td style={{ padding: "0.5rem 0.625rem", textAlign: "right" }}>
                            <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: row.stage === "3" ? "#B91C1C" : row.stage === "2" ? "#B45309" : "#15803D", background: row.stage === "3" ? "rgba(185,28,28,0.1)" : row.stage === "2" ? "rgba(180,83,9,0.1)" : "rgba(21,128,61,0.1)", padding: "0.2rem 0.4rem", borderRadius: "4px" }}>S{row.stage}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* §5 Roll-Forward — reuse static data (matches StageMigrationTab) */}
                <section id="auditor-s5" style={{ marginBottom: "2.5rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#002147", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "2px solid #002147" }}>
                    §5 — IFRS 7 §35H ECL Allowance Roll-Forward
                  </h2>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
                    <thead>
                      <tr style={{ background: "#002147" }}>
                        {["Movement", "Stage 1", "Stage 2", "Stage 3", "Total"].map((h, i) => (
                          <th key={h} style={{ padding: "0.625rem 0.75rem", textAlign: i === 0 ? "left" : "right", color: "#FFFFFF", fontWeight: 600, fontSize: "0.75rem" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Opening ECL balance",          s1: "$8.10M",  s2: "$20.40M", s3: "$16.30M", total: "$44.80M", bold: true  },
                        { label: "New originations (Stage 1)",   s1: "+$1.20M", s2: "—",       s3: "—",       total: "+$1.20M", bold: false },
                        { label: "SICR transfers to Stage 2",    s1: "−$0.85M", s2: "+$2.10M", s3: "—",       total: "+$1.25M", bold: false },
                        { label: "SICR transfers to Stage 3",    s1: "—",       s2: "−$1.40M", s3: "+$2.80M", total: "+$1.40M", bold: false },
                        { label: "Write-offs",                   s1: "—",       s2: "—",       s3: "−$2.10M", total: "−$2.10M", bold: false },
                        { label: "Repayments / derecognition",   s1: "−$0.45M", s2: "−$0.85M", s3: "−$0.40M", total: "−$1.70M", bold: false },
                        { label: "FX and unwinding of discount", s1: "+$0.40M", s2: "+$1.35M", s3: "+$0.60M", total: "+$2.35M", bold: false },
                        { label: "Closing ECL balance",          s1: "$8.40M",  s2: "$21.60M", s3: "$17.20M", total: "$47.20M", bold: true  },
                      ].map((row, i) => (
                        <tr key={i} style={{ background: row.bold ? "#EFF6FF" : i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                          <td style={{ padding: "0.625rem 0.75rem", fontWeight: row.bold ? 700 : 400, color: "#0F172A" }}>{row.label}</td>
                          {[row.s1, row.s2, row.s3, row.total].map((v, ci) => (
                            <td key={ci} style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: row.bold ? 700 : 400, color: v.startsWith("+") ? "#15803D" : v.startsWith("−") ? "#B91C1C" : "#0F172A" }}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* §6 Credit Quality */}
                <section id="auditor-s6" style={{ marginBottom: "2.5rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#002147", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "2px solid #002147" }}>
                    §6 — IFRS 7 §35I Credit Quality Distribution
                  </h2>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
                    <thead>
                      <tr style={{ background: "#002147" }}>
                        {["Rating Grade", "Stage 1 EAD", "Stage 2 EAD", "Stage 3 EAD", "Total EAD", "% Portfolio"].map((h, i) => (
                          <th key={h} style={{ padding: "0.625rem 0.75rem", textAlign: i === 0 ? "left" : "right", color: "#FFFFFF", fontWeight: 600, fontSize: "0.75rem" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { grade: "A / A−",        zone: "low",    s1: "$412.0M", s2: "—",      s3: "—",       total: "$412.0M", pct: "45.1%" },
                        { grade: "BBB",            zone: "low",    s1: "$185.0M", s2: "$12.0M", s3: "—",       total: "$197.0M", pct: "21.6%" },
                        { grade: "BB / BB−",       zone: "watch",  s1: "$142.0M", s2: "$48.0M", s3: "—",       total: "$190.0M", pct: "20.8%" },
                        { grade: "B+",             zone: "watch",  s1: "$32.0M",  s2: "$58.0M", s3: "—",       total: "$90.0M",  pct: "9.9%"  },
                        { grade: "B / B−",         zone: "danger", s1: "—",       s2: "—",      s3: "$6.6M",   total: "$6.6M",   pct: "0.7%"  },
                        { grade: "CCC and below",  zone: "danger", s1: "—",       s2: "—",      s3: "$17.6M",  total: "$17.6M",  pct: "1.9%"  },
                      ].map((row, i) => (
                        <tr key={row.grade} style={{ background: row.zone === "danger" ? "rgba(185,28,28,0.04)" : row.zone === "watch" ? "rgba(180,83,9,0.04)" : i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                          <td style={{ padding: "0.625rem 0.75rem", fontWeight: 600, color: "#0F172A" }}>{row.grade}</td>
                          <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569" }}>{row.s1}</td>
                          <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569" }}>{row.s2}</td>
                          <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569" }}>{row.s3}</td>
                          <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#0F172A" }}>{row.total}</td>
                          <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569" }}>{row.pct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* §7 SICR Configuration */}
                <section id="auditor-s7" style={{ marginBottom: "2.5rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#002147", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "2px solid #002147" }}>
                    §7 — SICR Trigger Configuration
                  </h2>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                    <thead>
                      <tr style={{ background: "#002147" }}>
                        {["Trigger", "Status", "Threshold"].map((h) => (
                          <th key={h} style={{ padding: "0.625rem 0.75rem", textAlign: "left", color: "#FFFFFF", fontWeight: 600, fontSize: "0.75rem" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { trigger: "30+ DPD Backstop",           enabled: data.sicrConfig.dpdEnabled,              threshold: data.sicrConfig.dpdEnabled ? `${data.sicrConfig.dpdDays} days` : "—" },
                        { trigger: "Credit Downgrade Threshold",  enabled: data.sicrConfig.upgradeEnabled,          threshold: data.sicrConfig.upgradeEnabled ? `${data.sicrConfig.upgradeNotches} notches` : "—" },
                        { trigger: "Country Watchlist Event",     enabled: data.sicrConfig.countryWatchlistEnabled, threshold: "Automatic on watchlist flag" },
                        { trigger: "Lessee Insolvency Filing",    enabled: data.sicrConfig.insolvencyEnabled,       threshold: "Automatic Stage 3" },
                      ].map((row, i) => (
                        <tr key={row.trigger} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                          <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>{row.trigger}</td>
                          <td style={{ padding: "0.625rem 0.75rem" }}>
                            <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: row.enabled ? "rgba(21,128,61,0.1)" : "rgba(148,163,184,0.15)", color: row.enabled ? "#15803D" : "#94A3B8" }}>
                              {row.enabled ? "ACTIVE" : "DISABLED"}
                            </span>
                          </td>
                          <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{row.threshold}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* §8 Key Assumptions */}
                <section id="auditor-s8" style={{ marginBottom: "2.5rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#002147", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "2px solid #002147" }}>
                    §8 — Key Assumptions & Management Overlays
                  </h2>
                  <p style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "0.5rem" }}>
                    Edit this field to document any qualitative overlays before downloading.
                  </p>
                  <textarea
                    value={managementOverlay}
                    onChange={(e) => setManagementOverlay(e.target.value)}
                    rows={8}
                    style={{
                      width: "100%", padding: "0.875rem",
                      border: "1px solid #E2E8F0", borderRadius: "0.5rem",
                      fontSize: "0.875rem", color: "#475569", lineHeight: 1.7,
                      resize: "vertical", boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
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
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep -i auditor
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/components/risk-ecl/AuditorPackModal.tsx
git commit -m "feat: add AuditorPackModal with 8-section preview and PDF/DOCX download"
```

---

## Task 9: Wire AuditorPackModal into RiskECL

Connect the modal to the "Auditor Evidence Pack" header button and pass all required data.

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

- [ ] **Step 1: Import AuditorPackModal**

```typescript
import { AuditorPackModal } from "../components/risk-ecl/AuditorPackModal";
```

- [ ] **Step 2: Add `auditorPackOpen` state**

```typescript
const [auditorPackOpen, setAuditorPackOpen] = useState(false);
```

- [ ] **Step 3: Wire the header button**

Find the existing "Auditor Evidence Pack" button in the `<PageHeader>` children. Add an `onClick` handler:

```tsx
<button
  onClick={() => setAuditorPackOpen(true)}
  style={{ /* existing styles */ }}
>
  <Download size={14} /> Auditor Evidence Pack
</button>
```

- [ ] **Step 4: Build the `AuditorPackData` object and render the modal**

At the bottom of the return statement, just before the closing `</motion.div>`, add:

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

- [ ] **Step 5: Wire "Export PDF + JSON" button** (the second header button)

This button should also open the modal (same data, user can then choose PDF or DOCX from inside):

```tsx
<button
  onClick={() => setAuditorPackOpen(true)}
  style={{ /* existing styles */ }}
>
  Export PDF + JSON
</button>
```

- [ ] **Step 6: Full TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | tail -15
```

Expected: no errors

- [ ] **Step 7: Run all tests**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -20
```

Expected: all existing tests pass + 10 new SICR tests pass

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/RiskECL.tsx
git commit -m "feat: wire AuditorPackModal into Risk & ECL page header"
```

---

## Task 10: Integration Smoke Test + Deploy

Verify the full feature flow end-to-end before deploying.

**Files:** none

- [ ] **Step 1: Start dev server and verify no console errors**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run dev
```

Navigate to `/risk-ecl`. Check browser console for errors.

- [ ] **Step 2: Smoke test — Scenario Editor**

1. Go to Risk & ECL → ECL Overview tab
2. Expand "Scenario Macro Inputs"
3. Change Adverse GDP delta to −5%
4. Confirm the "Adverse" ECL value in the weighted ECL table increases
5. Click "Reset" on Adverse column — confirm values return to defaults

- [ ] **Step 3: Smoke test — SICR Evaluation**

1. Go to Risk & ECL → SICR Config tab
2. Click "Run SICR Evaluation"
3. Confirm a table of recommendations appears (IndiGo, Aeromexico, SriLankan expected based on mock data)
4. Select all recommendations → click "Apply Selected Migrations"
5. Navigate to "ECL by Lease" tab — confirm IndiGo/Aeromexico/SriLankan show updated stages with "PENDING" badge

- [ ] **Step 4: Smoke test — Auditor Evidence Pack**

1. Click "Auditor Evidence Pack" button in page header
2. Confirm modal opens full-screen
3. Click each section in left navigator — confirm scroll works
4. Edit §8 management overlay text
5. Click "Download DOCX" — confirm file downloads
6. Click "Download PDF" — confirm PDF downloads
7. Press Escape — confirm modal closes

- [ ] **Step 5: Deploy**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && vercel --prod
```

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes from smoke test"
```
