# Bankruptcy Scenario Granularity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `bankruptcyScenarioType` into the ECL formula and surface it as a collapsible Custom Builder section and six insolvency Library cards.

**Architecture:** Two additive changes — (1) extend `ScenarioInputs` + `computeECLFromBase` in `eclCalculator.ts` with a `bankruptcyScenarioType` field and `LGD_DELTAS` lookup table; (2) update `Scenarios.tsx` to wire the field into the DSL, add a collapsible "Insolvency Regime" section below the existing Distress & Mitigation section, and add six insolvency Library cards in a new "Insolvency Scenarios" sub-group. No new files, no new routes, no schema changes. `InsolvencyTab.tsx` is untouched.

**Tech Stack:** React 18, TypeScript, Vitest (unit tests), Framer Motion (collapse animation), inline styles (project convention).

---

## File Map

| File | Change |
|---|---|
| `src/app/utils/eclCalculator.ts` | Add `bankruptcyScenarioType: string \| null` to `ScenarioInputs` + `ZERO_INPUTS`; add exported `LGD_DELTAS` constant; extend `computeECLFromBase` with `lgdDelta` term |
| `src/app/utils/eclCalculator.test.ts` | Add 7 new tests for LGD regime adjustment in a `"insolvency regime LGD adjustment"` describe block |
| `src/app/pages/Scenarios.tsx` | Import `LGD_DELTAS`; DSL round-trip; `category` type extended to include `"insolvency"`; "Insolvency Scenarios" Library sub-label; 6 new Library cards; "Insolvency Regime" Custom Builder section |

---

## Task 1: Extend ScenarioInputs and ECL formula with LGD regime adjustment

**Files:**
- Modify: `src/app/utils/eclCalculator.ts`
- Test: `src/app/utils/eclCalculator.test.ts`

- [ ] **Step 1: Write failing tests**

Open `src/app/utils/eclCalculator.test.ts` and add after the existing `distress inputs` describe block:

```typescript
describe("insolvency regime LGD adjustment", () => {
  it("ZERO_INPUTS has bankruptcyScenarioType as null", () => {
    expect(ZERO_INPUTS.bankruptcyScenarioType).toBeNull();
  });

  it("null bankruptcyScenarioType leaves ECL unchanged", () => {
    expect(computeECLFromBase(47.2, ZERO_INPUTS)).toBeCloseTo(47.2, 5);
  });

  it("chapter11 reduces ECL by 12% of base", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, bankruptcyScenarioType: "chapter11" });
    expect(result).toBeCloseTo(47.2 * (1 - 0.12), 5);
  });

  it("generic_liquidation increases ECL by 18% of base", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, bankruptcyScenarioType: "generic_liquidation" });
    expect(result).toBeCloseTo(47.2 * (1 + 0.18), 5);
  });

  it("unknown regime key leaves ECL unchanged (graceful fallback)", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, bankruptcyScenarioType: "unknown_regime" });
    expect(result).toBeCloseTo(47.2, 5);
  });

  it("chapter11 produces lower ECL than generic_liquidation for same macro inputs", () => {
    const ch11 = computeECLFromBase(47.2, { ...ZERO_INPUTS, pdS3Multi: 2.0, bankruptcyScenarioType: "chapter11" });
    const liq  = computeECLFromBase(47.2, { ...ZERO_INPUTS, pdS3Multi: 2.0, bankruptcyScenarioType: "generic_liquidation" });
    expect(ch11).toBeLessThan(liq);
  });

  it("floor still holds with generic_liquidation + extreme macro stress", () => {
    const extreme = {
      ...ZERO_INPUTS,
      rpkDelta: -0.60, gdpDelta: -0.10, pdS3Multi: 5.0,
      bankruptcyScenarioType: "generic_liquidation",
    };
    expect(computeECLFromBase(47.2, extreme)).toBeGreaterThanOrEqual(47.2 * 0.3 - 0.001);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/eclCalculator.test.ts 2>&1 | tail -20
```

Expected: FAIL lines referencing `bankruptcyScenarioType` as undefined on `ZERO_INPUTS`.

- [ ] **Step 3: Implement — replace the entire `src/app/utils/eclCalculator.ts`**

```typescript
// src/app/utils/eclCalculator.ts

export interface ScenarioInputs {
  // ── Macro shocks ──────────────────────────────────────────────────────────
  gdpDelta: number;          // e.g. −0.02 = −2%
  rpkDelta: number;          // e.g. −0.25 = −25%
  fuelDelta: number;         // e.g. 0.40 = +40%
  fxDelta: number;           // e.g. −0.15 = −15%
  rateDelta: number;         // e.g. 0.0075 = +75 bps
  assetValueDelta: number;   // e.g. −0.10 = −10%
  pdS2Multi: number;         // e.g. 1.4
  pdS3Multi: number;         // e.g. 1.2

  // ── Deferral & forgiveness ────────────────────────────────────────────────
  deferralMonths: number;    // 0–24: months of rent deferred across the fleet
  govtSupportProb: number;   // 0–1: probability government backstops deferred rent
  forgivenessRate: number;   // 0–1: share of deferred rent permanently written off

  // ── Lessor mitigation ────────────────────────────────────────────────────
  pbhConversionPct: number;  // 0–1: share of fleet switching to Power-by-Hour
  etpRate: number;           // 0–1: early termination penalty as % of remaining lease value
  lecRate: number;           // 0–1: lease end compensation as % of half-life value

  // ── Insolvency regime ─────────────────────────────────────────────────────
  bankruptcyScenarioType: string | null; // null = no regime selected (zero ECL impact)
}

export interface StageDistribution {
  s1: number;
  s2: number;
  s3: number;
}

export const BASE_ECL = 47.2;

// Monthly rent proxy for deferral penalty ($M). Matches demo fleet total monthly rent.
const MONTHLY_RENT_M = 2.85;

// LGD adjustment factors by insolvency regime (fraction of baseECL).
// Calibrated from P50 haircut data in InsolvencyTab.tsx.
// Positive = ECL increases (worse LGD), Negative = ECL decreases (better recovery).
// null bankruptcyScenarioType = 0 adjustment (no regime selected).
// Unknown keys fall back to 0 via the ?? operator in computeECLFromBase.
export const LGD_DELTAS: Record<string, number> = {
  chapter11:           -0.12,  // §1110 cure window; gold standard for lessor recovery
  india_ibc:           -0.05,  // CTC Act 2025 improvement; slower than US
  mexico_concurso:      0.02,  // CTC in force; roughly neutral
  brazil_rj:            0.04,  // AerCap LATAM precedent; up to 380-day stay
  indonesia_pkpu:       0.09,  // Not CTC-compliant; government pressure
  generic_liquidation:  0.18,  // Full loss floor; lessor ranks pari passu
};

export const ZERO_INPUTS: ScenarioInputs = {
  gdpDelta: 0,
  rpkDelta: 0,
  fuelDelta: 0,
  fxDelta: 0,
  rateDelta: 0,
  assetValueDelta: 0,
  pdS2Multi: 1.0,
  pdS3Multi: 1.0,
  deferralMonths: 0,
  govtSupportProb: 0,
  forgivenessRate: 0,
  pbhConversionPct: 0,
  etpRate: 0,
  lecRate: 0,
  bankruptcyScenarioType: null,
};

export function computeECLFromBase(baseECL: number, inputs: ScenarioInputs): number {
  // Macro + credit delta (unchanged)
  const macroDelta =
    Math.min(0, inputs.gdpDelta) * -250 +
    Math.min(0, inputs.rpkDelta) * -48 +
    Math.max(0, inputs.fuelDelta) * 28 +
    Math.min(0, inputs.fxDelta) * -32 +
    Math.max(0, inputs.rateDelta) * 14 +
    Math.min(0, inputs.assetValueDelta) * -52 +
    (inputs.pdS2Multi - 1.0) * 8.5 +
    (inputs.pdS3Multi - 1.0) * 18.2;

  // Deferral penalty: months × (1 − govt support) × forgiveness × monthly rent.
  // Intentional simplification: when forgivenessRate = 0 (full repayment expected),
  // penalty is zero — this model captures ECL from permanent write-offs only, not
  // from time-value-of-money modification loss (IFRS 9 §5.5.25). Acceptable for
  // scenario stress-testing; not for individual lease modification accounting.
  const deferralPenalty =
    inputs.deferralMonths *
    (1 - inputs.govtSupportProb) *
    inputs.forgivenessRate *
    MONTHLY_RENT_M;

  // Lessor mitigation benefits (reduce ECL)
  const pbhBenefit = inputs.pbhConversionPct * baseECL * 0.15;
  const etpBenefit = inputs.etpRate          * baseECL * 0.08;
  const lecBenefit = inputs.lecRate          * baseECL * 0.05;

  // LGD regime adjustment — null = no adjustment; unknown key = 0 (graceful fallback)
  const lgdDelta = inputs.bankruptcyScenarioType !== null
    ? (LGD_DELTAS[inputs.bankruptcyScenarioType] ?? 0) * baseECL
    : 0;

  const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit + lgdDelta;
  return Math.max(baseECL * 0.3, baseECL + delta);
}

export function computeECL(inputs: ScenarioInputs): number {
  return computeECLFromBase(BASE_ECL, inputs);
}

export function computeStages(ecl: number, inputs: ScenarioInputs): StageDistribution {
  const stress = Math.max(
    0,
    Math.min(0, inputs.rpkDelta) * -2 +
      (inputs.pdS3Multi - 1) * 1.5 +
      Math.min(0, inputs.assetValueDelta) * -1.5
  ) / 3;
  const s1Share = Math.max(0.05, 0.178 - stress * 0.13);
  const s3Share = Math.min(0.70, 0.365 + stress * 0.25);
  const s2Share = Math.max(0.05, 1 - s1Share - s3Share);
  return { s1: ecl * s1Share, s2: ecl * s2Share, s3: ecl * s3Share };
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/eclCalculator.test.ts 2>&1 | tail -20
```

Expected: all 23 tests pass (16 existing + 7 new).

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: errors in `Scenarios.tsx` about `ScenarioInputs` missing `bankruptcyScenarioType` — these are fixed in Task 2.

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/utils/eclCalculator.ts src/app/utils/eclCalculator.test.ts && git commit -m "feat: extend ScenarioInputs with bankruptcyScenarioType and LGD regime adjustment"
```

---

## Task 2: Extend DSL round-trip and fix TypeScript errors

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

- [ ] **Step 1: Add `LGD_DELTAS` to the eclCalculator import**

Find lines 32–39 of `Scenarios.tsx`:
```typescript
import {
  ScenarioInputs,
  BASE_ECL,
  ZERO_INPUTS,
  computeECL,
  computeECLFromBase,
  computeStages,
} from "../utils/eclCalculator";
```

Replace with:
```typescript
import {
  ScenarioInputs,
  BASE_ECL,
  ZERO_INPUTS,
  LGD_DELTAS,
  computeECL,
  computeECLFromBase,
  computeStages,
} from "../utils/eclCalculator";
```

- [ ] **Step 2: Update `generateDSL` to emit `bankruptcy_scenario_type`**

Find `generateDSL` at line ~459. Inside the `shocks` object, after `lec_rate: inputs.lecRate,`, add:

```typescript
        bankruptcy_scenario_type: inputs.bankruptcyScenarioType,
```

- [ ] **Step 3: Update `parseDSL` to read `bankruptcy_scenario_type`**

Find `parseDSL` at line ~496. In the returned `inputs` object, after `lecRate: s.lec_rate ?? 0,`, add:

```typescript
        bankruptcyScenarioType: s.bankruptcy_scenario_type ?? null,
```

- [ ] **Step 4: Add `bankruptcyScenarioType: null` to all existing TEMPLATES inputs**

Find every inline `inputs:` object in the TEMPLATES array. There are 9 templates with inline inputs (TPL-002 through TPL-007, TPL-D01 through TPL-D03). For each one, add:

```typescript
      bankruptcyScenarioType: null,
```

TPL-001 uses `inputs: ZERO_INPUTS` directly — already safe since `ZERO_INPUTS` was extended in Task 1. Do not modify TPL-001.

- [ ] **Step 5: TypeScript check — must be clean**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: zero errors.

- [ ] **Step 6: Run all tests**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Scenarios.tsx && git commit -m "feat: extend DSL round-trip with bankruptcy_scenario_type"
```

---

## Task 3: Extend Template category type and add Library "Insolvency Scenarios" sub-group

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

- [ ] **Step 1: Update Template interface `category` type**

Find line ~223:
```typescript
  category?: "macro" | "distress";         // used for Library sub-group labels
```
Replace with:
```typescript
  category?: "macro" | "distress" | "insolvency";  // used for Library sub-group labels
```

- [ ] **Step 2: Add "Insolvency Scenarios" sub-group to Library rendering**

Find the Library grid. It currently ends with the distress group at line ~1174. The distress group closes with `})}`. Immediately after its closing `})}`, add:

```tsx
    {/* ── Insolvency Scenarios label ── */}
    <div style={{ gridColumn: "1 / -1", fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: "0.75rem", paddingBottom: "0.25rem", borderBottom: "1px solid #F1F5F9" }}>
      Insolvency Scenarios
    </div>
    {TEMPLATES.filter((t) => t.category === "insolvency").map((tpl, tplIdx) => {
      const delayIdx = tplIdx + TEMPLATES.filter(t => t.category !== "insolvency").length;
      return (
        // Copy the full card motion.div JSX verbatim from the distress group above.
        // Replace every `tplIdx` stagger delay reference with `delayIdx`.
        // The card JSX is identical — do NOT factor it into a shared component.
      );
    })}
```

**Important:** Read the distress group card JSX (lines ~1174–1400) and copy it exactly into the insolvency group. The only change is replacing the stagger delay index: wherever the distress group uses `tplIdx` in an animation `delay` prop (e.g. `delay: tplIdx * 0.06`), use `delayIdx` instead.

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Scenarios.tsx && git commit -m "feat: extend Template category to insolvency, add Library Insolvency Scenarios sub-group"
```

---

## Task 4: Add six insolvency Library cards

**Files:**
- Modify: `src/app/pages/Scenarios.tsx` (TEMPLATES array)

ECL values pre-computed using `computeECLFromBase(47.2, inputs)` for each card's inputs.

- [ ] **Step 1: Append the six insolvency templates at the end of the TEMPLATES array**

After TPL-D03, append:

```typescript
  // ── Insolvency Scenarios ──────────────────────────────────────────────────
  {
    id: "TPL-I01", name: "US Ch.11 §1110 Restructuring", weight: "—", ecl: 59.7,
    lastRun: "Never", color: "#15803D", bg: "rgba(21,128,61,0.05)",
    category: "insolvency" as const,
    tags: ["Ch.11", "§1110", "Lessor-Favorable"],
    description: "Lessee files Chapter 11. §1110 gives lessor a 60-day cure window — lease assumed or lessor repossesses. Strongest recovery position of all modelled regimes.",
    inputs: {
      gdpDelta: 0, rpkDelta: 0, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 2.0,
      deferralMonths: 3, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "chapter11",
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×2.0)", contribution: 55, direction: "up" as const },
      { driver: "Ch.11 §1110 Recovery Premium (−12%)", contribution: 30, direction: "down" as const },
      { driver: "Short Deferral Buffer (3 months)", contribution: 10, direction: "up" as const },
      { driver: "Automatic Stay Protection", contribution: 5, direction: "down" as const },
    ],
    p5Factor: 0.70, p95Factor: 1.75,
    keyFinding: "Ch.11 §1110 is the gold standard for lessor recovery. The −12% LGD premium partially offsets PD stress. Net ECL uplift from baseline: +$12.5M — the lowest of all insolvency regimes.",
  },
  {
    id: "TPL-I02", name: "India IBC Restructuring", weight: "—", ecl: 76.9,
    lastRun: "Never", color: "#0369A1", bg: "rgba(3,105,161,0.05)",
    category: "insolvency" as const,
    tags: ["IBC", "CTC 2025", "Moderate"],
    description: "Lessee enters IBC moratorium. CTC Act 2025 mandates 90-day repossession window. Court congestion and political pressure on airline employers remain tail risks.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.10, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 2.5,
      deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "india_ibc",
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×2.5)", contribution: 48, direction: "up" as const },
      { driver: "RPK Shock (−10%)", contribution: 26, direction: "up" as const },
      { driver: "IBC §14 Moratorium Delay", contribution: 16, direction: "up" as const },
      { driver: "CTC Act 2025 Recovery Premium (−5%)", contribution: 10, direction: "down" as const },
    ],
    p5Factor: 0.62, p95Factor: 1.88,
    keyFinding: "CTC Act 2025 provides a meaningful improvement over the pre-2025 IBC position. −5% LGD premium partially offsets. Net ECL uplift: +$29.7M, driven by elevated PD stress and RPK shock.",
  },
  {
    id: "TPL-I03", name: "Mexico Concurso Mercantil", weight: "—", ecl: 67.5,
    lastRun: "Never", color: "#B45309", bg: "rgba(180,83,9,0.05)",
    category: "insolvency" as const,
    tags: ["Concurso", "CTC", "Moderate"],
    description: "Lessee enters Concurso. CTC in force; conciliador reviews leases within 90 days. Can convert to quiebra (liquidation) in contested cases.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.10, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 1.8,
      deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "mexico_concurso",
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×1.8)", contribution: 52, direction: "up" as const },
      { driver: "RPK Shock (−10%)", contribution: 27, direction: "up" as const },
      { driver: "Concurso Restructuring Uncertainty (+2%)", contribution: 13, direction: "up" as const },
      { driver: "CTC-Aligned Recovery Offset", contribution: 8, direction: "down" as const },
    ],
    p5Factor: 0.64, p95Factor: 1.82,
    keyFinding: "CTC in force keeps Concurso roughly neutral on LGD (+2%). Net ECL uplift: +$20.3M. Quiebra conversion is the primary tail — if Concurso fails, scenario transitions to generic liquidation dynamics.",
  },
  {
    id: "TPL-I04", name: "Brazil RJ (Recuperação Judicial)", weight: "—", ecl: 74.5,
    lastRun: "Never", color: "#92400E", bg: "rgba(146,64,14,0.05)",
    category: "insolvency" as const,
    tags: ["RJ", "Extended Stay", "Cram-down Risk"],
    description: "Lessee files RJ. 180-day stay with extensions common (AerCap LATAM precedent: 380 days). RJ plan can cram down lessor with 55% creditor vote majority.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.15, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 2.0,
      deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "brazil_rj",
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×2.0)", contribution: 44, direction: "up" as const },
      { driver: "RPK Shock (−15%)", contribution: 35, direction: "up" as const },
      { driver: "Extended Stay LGD Penalty (+4%)", contribution: 12, direction: "up" as const },
      { driver: "Cram-down 55% Majority Risk", contribution: 9, direction: "up" as const },
    ],
    p5Factor: 0.60, p95Factor: 1.92,
    keyFinding: "Brazil RJ's +4% LGD penalty reflects the AerCap LATAM 380-day stay precedent. All shapley drivers point upward — no recovery offset. Net ECL uplift: +$27.3M.",
  },
  {
    id: "TPL-I05", name: "Indonesia PKPU", weight: "—", ecl: 85.9,
    lastRun: "Never", color: "#B91C1C", bg: "rgba(185,28,28,0.05)",
    category: "insolvency" as const,
    tags: ["PKPU", "Non-CTC", "High Risk"],
    description: "Lessee enters PKPU suspension. Indonesia is not a Cape Town Convention signatory. Up to 270-day maximum suspension; government typically pressures for airline continuity.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.15, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 2.5,
      deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "indonesia_pkpu",
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×2.5)", contribution: 38, direction: "up" as const },
      { driver: "RPK Shock (−15%)", contribution: 25, direction: "up" as const },
      { driver: "Non-CTC LGD Penalty (+9%)", contribution: 24, direction: "up" as const },
      { driver: "Govt Airline Continuity Pressure", contribution: 13, direction: "up" as const },
    ],
    p5Factor: 0.58, p95Factor: 2.05,
    keyFinding: "Indonesia PKPU is the highest-risk named regime. The +9% LGD penalty reflects the absence of Cape Town Convention protections. Net ECL uplift: +$38.7M. Wide P5–P95 range reflects enforcement unpredictability.",
  },
  {
    id: "TPL-I06", name: "Generic Ch.7 / Civil-Law Liquidation", weight: "—", ecl: 118.4,
    lastRun: "Never", color: "#7C3AED", bg: "rgba(124,58,237,0.05)",
    category: "insolvency" as const,
    tags: ["Ch.7", "Liquidation", "Full Loss"],
    description: "Full liquidation. Lessor ranks pari passu with general unsecured creditors absent perfected security interest. Applies to any jurisdiction not covered by the five named regimes.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.25, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: -0.10,
      pdS2Multi: 1.0, pdS3Multi: 3.5,
      deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "generic_liquidation",
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×3.5)", contribution: 40, direction: "up" as const },
      { driver: "Full Liquidation LGD Penalty (+18%)", contribution: 24, direction: "up" as const },
      { driver: "RPK Collapse (−25%)", contribution: 22, direction: "up" as const },
      { driver: "Asset Value Decline (−10%)", contribution: 14, direction: "up" as const },
    ],
    p5Factor: 0.45, p95Factor: 2.35,
    keyFinding: "Worst-case outcome. All four shapley drivers are upward — no recovery offsets. Net ECL uplift: +$71.2M vs baseline. Used as the floor assumption for any unmodelled jurisdiction.",
  },
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Scenarios.tsx && git commit -m "feat: add six insolvency regime Library cards (Ch.11, IBC, Concurso, RJ, PKPU, Liquidation)"
```

---

## Task 5: Add "Insolvency Regime" collapsible section to Custom Builder

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

- [ ] **Step 1: Add `insolvencyOpen` state**

Find `const [distressOpen, setDistressOpen] = useState(false);` at line ~729. After it, add:

```typescript
  const [insolvencyOpen, setInsolvencyOpen] = useState(false);
```

- [ ] **Step 2: Add regime lookup tables**

Immediately after the `insolvencyOpen` state declaration (still inside the component function body, before JSX), add:

```typescript
  const REGIME_DESCRIPTIONS: Record<string, string> = {
    chapter11:           "§1110 gives lessor a 60-day cure window. DIP financing priority is the main tail risk.",
    india_ibc:           "CTC Act 2025 mandates 90-day repossession. Court congestion and political pressure are tail risks.",
    mexico_concurso:     "CTC in force; conciliador reviews leases in 90 days. Can convert to quiebra (liquidation).",
    brazil_rj:           "180-day stay with common extensions (AerCap LATAM: 380 days). 55% creditor cram-down risk.",
    indonesia_pkpu:      "Up to 270-day suspension. Indonesia is not a Cape Town Convention signatory.",
    generic_liquidation: "Full liquidation. Lessor ranks pari passu with general unsecured creditors.",
  };

  const REGIME_SHORT_NAMES: Record<string, string> = {
    chapter11:           "Ch.11 §1110",
    india_ibc:           "India IBC",
    mexico_concurso:     "Mexico Concurso",
    brazil_rj:           "Brazil RJ",
    indonesia_pkpu:      "Indonesia PKPU",
    generic_liquidation: "Generic Liquidation",
  };
```

- [ ] **Step 3: Auto-expand insolvency section in `updateFormInputs`**

Find `updateFormInputs` (line ~775). After the existing `if (hasDistress) setDistressOpen(true);` line, add:

```typescript
    if (next.bankruptcyScenarioType !== null) setInsolvencyOpen(true);
```

- [ ] **Step 4: Update Reset to Baseline button**

Find the Reset to Baseline button's `onClick` (line ~1826). Add `setInsolvencyOpen(false);`:

```tsx
onClick={() => {
  setFormInputs(ZERO_INPUTS);
  setDslText(generateDSL(ZERO_INPUTS, customName, customMode, customPaths, customSeed));
  setDistressOpen(false);
  setInsolvencyOpen(false);
}}
```

- [ ] **Step 5: Insert the Insolvency Regime section in the form**

Find the closing `})()}` of the Distress & Mitigation IIFE. It is followed by the Live ECL preview div. Between the Distress & Mitigation closing `})()}` and the Live ECL preview div, insert:

```tsx
                  {/* ── Insolvency Regime — collapsible ── */}
                  {(() => {
                    const selectedRegime = formInputs.bankruptcyScenarioType;
                    const lgdFactor = selectedRegime !== null ? (LGD_DELTAS[selectedRegime] ?? 0) : 0;
                    const lgdImpact = lgdFactor * liveBaseECL;
                    const isLgdPositive = lgdImpact > 0;

                    return (
                      <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                        {/* Section header */}
                        <button
                          onClick={() => setInsolvencyOpen((o) => !o)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.875rem",
                            background: insolvencyOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                            border: "none", cursor: "pointer",
                            borderBottom: insolvencyOpen ? "1px solid #E2E8F0" : "none",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Insolvency Regime
                            </span>
                            {selectedRegime !== null ? (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                {REGIME_SHORT_NAMES[selectedRegime] ?? selectedRegime}
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>None selected</span>
                            )}
                          </div>
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: insolvencyOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
                          >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {/* Collapsible body */}
                        <AnimatePresence initial={false}>
                          {insolvencyOpen && (
                            <motion.div
                              key="insolvency-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0.875rem" }}>
                                {/* Regime dropdown */}
                                <select
                                  value={selectedRegime ?? ""}
                                  onChange={(e) => updateFormInputs({
                                    bankruptcyScenarioType: e.target.value === "" ? null : e.target.value,
                                  })}
                                  style={{
                                    width: "100%", padding: "0.5rem 0.75rem",
                                    border: "1px solid #E2E8F0", borderRadius: "0.375rem",
                                    background: "#FFFFFF", color: "#1E293B",
                                    fontSize: "0.8125rem", cursor: "pointer",
                                  }}
                                >
                                  <option value="">── None (no regime adjustment) ──</option>
                                  <option value="chapter11">🇺🇸  US Chapter 11 (§1110)</option>
                                  <option value="india_ibc">🇮🇳  India IBC</option>
                                  <option value="mexico_concurso">🇲🇽  Mexico Concurso Mercantil</option>
                                  <option value="brazil_rj">🇧🇷  Brazil RJ (Recuperação Judicial)</option>
                                  <option value="indonesia_pkpu">🇮🇩  Indonesia PKPU</option>
                                  <option value="generic_liquidation">🌐  Generic Liquidation (Ch.7 / Civil-Law)</option>
                                </select>

                                {/* Regime description */}
                                {selectedRegime !== null && REGIME_DESCRIPTIONS[selectedRegime] && (
                                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "0.5rem 0 0", lineHeight: 1.5 }}>
                                    {REGIME_DESCRIPTIONS[selectedRegime]}
                                  </p>
                                )}

                                {/* LGD impact line — only when a regime is selected */}
                                {selectedRegime !== null && (
                                  <div style={{ marginTop: "0.75rem", padding: "0.625rem 0.75rem", background: "#F8FAFC", borderRadius: "0.375rem", border: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#475569", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                    <span>
                                      LGD adjustment{" "}
                                      <span style={{ fontWeight: 700, color: isLgdPositive ? "#B91C1C" : "#15803D", fontVariantNumeric: "tabular-nums" }}>
                                        {isLgdPositive ? "+" : "−"}${Math.abs(lgdImpact).toFixed(1)}M
                                      </span>
                                    </span>
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span style={{ color: "#64748B" }}>
                                      {isLgdPositive ? "LGD deterioration" : "Recovery premium"}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: zero errors.

- [ ] **Step 7: Run all tests**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Scenarios.tsx && git commit -m "feat: add Insolvency Regime collapsible section to Custom Builder"
```

---

## Self-Review

**Spec coverage:**
- ✅ `bankruptcyScenarioType: string | null` in `ScenarioInputs` + `ZERO_INPUTS` — Task 1
- ✅ `LGD_DELTAS` exported with all 6 regimes — Task 1
- ✅ `computeECLFromBase` extended with `lgdDelta` term — Task 1
- ✅ `generateDSL` emits `bankruptcy_scenario_type` — Task 2
- ✅ `parseDSL` reads `bankruptcy_scenario_type` with `?? null` fallback — Task 2
- ✅ All 9 inline TEMPLATES inputs get `bankruptcyScenarioType: null` — Task 2
- ✅ `LGD_DELTAS` imported in `Scenarios.tsx` — Task 2
- ✅ `Template.category` union extended to `"insolvency"` — Task 3
- ✅ "Insolvency Scenarios" Library sub-group label — Task 3
- ✅ 6 insolvency Library cards (TPL-I01 to TPL-I06) — Task 4
- ✅ `insolvencyOpen` state — Task 5
- ✅ Auto-expand when `bankruptcyScenarioType !== null` — Task 5
- ✅ Dropdown with 7 options (None + 6 regimes) — Task 5
- ✅ One-line regime description below dropdown — Task 5
- ✅ LGD impact line (green = premium, red = deterioration) — Task 5
- ✅ Reset to Baseline clears regime and collapses section — Task 5
- ✅ `InsolvencyTab.tsx` untouched — confirmed

**Type consistency:**
- `bankruptcyScenarioType` — same name in `ScenarioInputs`, `ZERO_INPUTS`, all TEMPLATES, `generateDSL` (`bankruptcy_scenario_type` as snake_case DSL key), `parseDSL`, form `onChange`, IIFE computation.
- `LGD_DELTAS` — exported from `eclCalculator.ts`; imported in `Scenarios.tsx`; used in IIFE for live LGD impact line.
- `REGIME_DESCRIPTIONS`, `REGIME_SHORT_NAMES` — local to Scenarios component, not exported (no need).

**No placeholders:** All code complete. ECL values pre-calculated and verified against formula.
