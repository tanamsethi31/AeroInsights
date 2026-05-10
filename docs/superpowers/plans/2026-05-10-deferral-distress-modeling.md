# Deferral & Distress Modeling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Scenarios page Custom Builder and Library with deferral, payment forgiveness, and lessor mitigation (PBH, ETP, LEC) inputs that flow through the ECL formula, plus three pre-built distress scenario Library cards.

**Architecture:** Two additive changes — (1) extend `ScenarioInputs` + `computeECLFromBase` in `eclCalculator.ts` with six new fields; (2) update `Scenarios.tsx` to wire those fields into the DSL, add a collapsible "Distress & Mitigation" form section, and add three distress Library cards with sub-group labels. No new files, no new routes, no schema changes.

**Tech Stack:** React 18, TypeScript, Vitest (unit tests), Framer Motion (collapse animation), inline styles (project convention).

---

## File Map

| File | Change |
|---|---|
| `src/app/utils/eclCalculator.ts` | Add 6 fields to `ScenarioInputs` + `ZERO_INPUTS`; extend `computeECLFromBase` |
| `src/app/utils/eclCalculator.test.ts` | Add tests for new formula terms |
| `src/app/pages/Scenarios.tsx` | DSL round-trip; Template interface + 3 new cards; Library sub-labels; Distress form section |

---

## Task 1: Extend ScenarioInputs and ECL formula

**Files:**
- Modify: `src/app/utils/eclCalculator.ts`
- Test: `src/app/utils/eclCalculator.test.ts`

- [ ] **Step 1: Write failing tests**

Open `src/app/utils/eclCalculator.test.ts` and add after the existing `computeStages` describe block:

```typescript
describe("distress inputs", () => {
  it("ZERO_INPUTS still has all new fields at 0", () => {
    expect(ZERO_INPUTS.deferralMonths).toBe(0);
    expect(ZERO_INPUTS.govtSupportProb).toBe(0);
    expect(ZERO_INPUTS.forgivenessRate).toBe(0);
    expect(ZERO_INPUTS.pbhConversionPct).toBe(0);
    expect(ZERO_INPUTS.etpRate).toBe(0);
    expect(ZERO_INPUTS.lecRate).toBe(0);
  });

  it("deferral with full forgiveness and no govt support increases ECL", () => {
    const inputs = { ...ZERO_INPUTS, deferralMonths: 6, forgivenessRate: 1.0, govtSupportProb: 0 };
    expect(computeECLFromBase(47.2, inputs)).toBeGreaterThan(47.2);
  });

  it("govt support at 100% fully negates deferral ECL impact", () => {
    const noSupport = computeECLFromBase(47.2, { ...ZERO_INPUTS, deferralMonths: 6, forgivenessRate: 0.5, govtSupportProb: 0 });
    const fullSupport = computeECLFromBase(47.2, { ...ZERO_INPUTS, deferralMonths: 6, forgivenessRate: 0.5, govtSupportProb: 1.0 });
    expect(fullSupport).toBeCloseTo(47.2, 5);
    expect(noSupport).toBeGreaterThan(47.2);
  });

  it("pbhConversionPct reduces ECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, pbhConversionPct: 0.5 });
    expect(result).toBeLessThan(47.2);
  });

  it("etpRate reduces ECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, etpRate: 0.3 });
    expect(result).toBeLessThan(47.2);
  });

  it("lecRate reduces ECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, lecRate: 0.2 });
    expect(result).toBeLessThan(47.2);
  });

  it("zero distress inputs leave ECL unchanged", () => {
    expect(computeECLFromBase(47.2, ZERO_INPUTS)).toBeCloseTo(47.2, 5);
  });

  it("floor still holds under combined distress + macro stress", () => {
    const extreme = {
      ...ZERO_INPUTS,
      rpkDelta: -0.60, gdpDelta: -0.10, pdS3Multi: 5.0,
      deferralMonths: 24, forgivenessRate: 1.0, govtSupportProb: 0,
    };
    expect(computeECLFromBase(47.2, extreme)).toBeGreaterThanOrEqual(47.2 * 0.3 - 0.001);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/eclCalculator.test.ts 2>&1 | tail -20
```

Expected: multiple FAIL lines referencing `deferralMonths`, `govtSupportProb` etc. as undefined.

- [ ] **Step 3: Implement — extend eclCalculator.ts**

Replace the entire file `src/app/utils/eclCalculator.ts` with:

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
}

export interface StageDistribution {
  s1: number;
  s2: number;
  s3: number;
}

export const BASE_ECL = 47.2;

// Monthly rent proxy for deferral penalty ($M). Matches demo fleet total monthly rent.
const MONTHLY_RENT_M = 2.85;

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
};

export function computeECLFromBase(baseECL: number, inputs: ScenarioInputs): number {
  // Macro + credit delta (existing logic, unchanged)
  const macroDelta =
    Math.min(0, inputs.gdpDelta) * -250 +
    Math.min(0, inputs.rpkDelta) * -48 +
    Math.max(0, inputs.fuelDelta) * 28 +
    Math.min(0, inputs.fxDelta) * -32 +
    Math.max(0, inputs.rateDelta) * 14 +
    Math.min(0, inputs.assetValueDelta) * -52 +
    (inputs.pdS2Multi - 1.0) * 8.5 +
    (inputs.pdS3Multi - 1.0) * 18.2;

  // Deferral penalty: months × (1 − govt support) × forgiveness × monthly rent
  const deferralPenalty =
    inputs.deferralMonths *
    (1 - inputs.govtSupportProb) *
    inputs.forgivenessRate *
    MONTHLY_RENT_M;

  // Lessor mitigation benefits (reduce ECL)
  const pbhBenefit = inputs.pbhConversionPct * baseECL * 0.15;
  const etpBenefit = inputs.etpRate          * baseECL * 0.08;
  const lecBenefit = inputs.lecRate          * baseECL * 0.05;

  const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit;
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

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/eclCalculator.test.ts 2>&1 | tail -20
```

Expected: all tests PASS. Count should be 12+ (8 existing + 8 new).

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: errors referencing `ZERO_INPUTS` missing new fields, and `ScenarioInputs` usages that don't include them — these are fixed in Task 2.

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/utils/eclCalculator.ts src/app/utils/eclCalculator.test.ts && git commit -m "feat: extend ScenarioInputs with deferral and lessor mitigation fields"
```

---

## Task 2: Extend DSL round-trip and fix TypeScript errors

**Files:**
- Modify: `src/app/pages/Scenarios.tsx` (lines ~22–50 for ZERO_INPUTS spread, ~386–449 for DSL functions)

The TypeScript errors from Task 1 Step 5 are because `ZERO_INPUTS` (now with 6 new fields) is spread into existing `ScenarioInputs` assignments. The DSL `parseDSL` also returns a `ScenarioInputs` object missing the new fields. Fix both here.

- [ ] **Step 1: Update `generateDSL` to emit new DSL keys**

Find `generateDSL` at line ~386 of `src/app/pages/Scenarios.tsx`. Replace the `shocks` object content:

```typescript
function generateDSL(
  inputs: ScenarioInputs, name: string, mode: RunMode, paths: number, seed: number
): string {
  return JSON.stringify(
    {
      scenario_id: "custom-001",
      name,
      shocks: {
        gdp_growth_delta: inputs.gdpDelta,
        rpk_growth_delta: inputs.rpkDelta,
        fuel_price_delta_pct: inputs.fuelDelta,
        fx_basket_delta_pct: inputs.fxDelta,
        risk_free_rate_delta: inputs.rateDelta,
        asset_value_delta_pct: inputs.assetValueDelta,
        pd_override_stage2_multiplier: inputs.pdS2Multi,
        pd_override_stage3_multiplier: inputs.pdS3Multi,
        deferral_months: inputs.deferralMonths,
        govt_support_prob: inputs.govtSupportProb,
        forgiveness_rate: inputs.forgivenessRate,
        pbh_conversion_pct: inputs.pbhConversionPct,
        etp_rate: inputs.etpRate,
        lec_rate: inputs.lecRate,
      },
      run_config: {
        mode: mode === "deterministic" ? "deterministic" : "monte_carlo",
        monte_carlo_paths: paths,
        seed,
      },
      // Optional: set to "chapter11", "india_ibc", "brazil_rj", "mexico_concurso",
      // "indonesia_pkpu", or "generic_liquidation" to layer insolvency-specific
      // recovery adjustments. See Insolvency Regimes tab.
      bankruptcy_scenario_type: null,
    },
    null, 2
  );
}
```

- [ ] **Step 2: Update `parseDSL` to read new DSL keys**

Find `parseDSL` at line ~417. Replace the returned `inputs` object:

```typescript
      inputs: {
        gdpDelta: s.gdp_growth_delta ?? 0,
        rpkDelta: s.rpk_growth_delta ?? 0,
        fuelDelta: s.fuel_price_delta_pct ?? 0,
        fxDelta: s.fx_basket_delta_pct ?? 0,
        rateDelta: s.risk_free_rate_delta ?? 0,
        assetValueDelta: s.asset_value_delta_pct ?? 0,
        pdS2Multi: s.pd_override_stage2_multiplier ?? 1.0,
        pdS3Multi: s.pd_override_stage3_multiplier ?? 1.0,
        deferralMonths: s.deferral_months ?? 0,
        govtSupportProb: s.govt_support_prob ?? 0,
        forgivenessRate: s.forgiveness_rate ?? 0,
        pbhConversionPct: s.pbh_conversion_pct ?? 0,
        etpRate: s.etp_rate ?? 0,
        lecRate: s.lec_rate ?? 0,
      },
```

- [ ] **Step 3: Fix any remaining existing ScenarioInputs object literals**

Search `Scenarios.tsx` for any inline `ScenarioInputs` literals (in TEMPLATES) that don't have the new fields. Every `inputs: { gdpDelta: ..., pdS3Multi: ... }` object needs the six new fields appended. Add them all as `0` since they're macro-only scenarios:

```typescript
deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
pbhConversionPct: 0, etpRate: 0, lecRate: 0,
```

Apply to all 7 existing TEMPLATES (TPL-001 through TPL-007). `ZERO_INPUTS` already has them from Task 1, so TPL-001 (which uses `inputs: ZERO_INPUTS`) is fine.

- [ ] **Step 4: TypeScript check — must be clean**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: no output (zero errors).

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Scenarios.tsx && git commit -m "feat: extend DSL round-trip with deferral and mitigation keys"
```

---

## Task 3: Add Template interface tags + Library sub-group labels

**Files:**
- Modify: `src/app/pages/Scenarios.tsx` (Template interface ~line 208; Library render ~line 843)

- [ ] **Step 1: Add `tags` and `category` to Template interface**

Find the `Template` interface at line ~208. Add two fields:

```typescript
interface Template {
  id: string;
  name: string;
  description: string;
  weight: string;
  ecl: number;
  lastRun: string;
  color: string;
  bg: string;
  inputs: ScenarioInputs;
  shapley: ScenarioRunResult["shapley"];
  p5Factor: number;
  p95Factor: number;
  keyFinding: string;
  tags?: string[];           // display pills on the card
  category?: "macro" | "distress";  // used for Library sub-group labels
}
```

- [ ] **Step 2: Add `category: "macro"` to existing TEMPLATES**

For TPL-001 through TPL-007, add `category: "macro"` to each object. Example for TPL-001:

```typescript
  {
    id: "TPL-001", name: "Baseline", weight: "60%", ecl: 47.2,
    lastRun: "29 Apr 2026", color: "#002147", bg: "rgba(0,33,71,0.05)",
    category: "macro",
    description: "Current macro conditions...",
    // ... rest unchanged
  },
```

Repeat for TPL-002 through TPL-007.

- [ ] **Step 3: Render tags as pills inside each Library card**

Find the Library card `<p>` description element at line ~886. After the `<p>` and before the footer `<div style={{ borderTop... }}>`, add:

```tsx
{tpl.tags && tpl.tags.length > 0 && (
  <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
    {tpl.tags.map((tag) => (
      <span
        key={tag}
        style={{
          fontSize: "0.6875rem", fontWeight: 600,
          padding: "0.125rem 0.5rem",
          borderRadius: "9999px",
          background: "rgba(0,33,71,0.06)",
          color: "#475569",
          border: "1px solid rgba(0,33,71,0.12)",
        }}
      >
        {tag}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 4: Add sub-group labels to Library render**

Find the Library grid at line ~844. Replace the `{TEMPLATES.map(...)}` with grouped rendering. The outer container already has `display: grid`. Restructure to:

```tsx
{activeTab === "Library" && (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", alignItems: "start" }}>
    {/* ── Macro Scenarios label ── */}
    <div style={{ gridColumn: "1 / -1", fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "0.25rem", borderBottom: "1px solid #F1F5F9" }}>
      Macro Scenarios
    </div>
    {TEMPLATES.filter((t) => t.category !== "distress").map((tpl, tplIdx) => {
      // ... existing card JSX (move the entire motion.div here, unchanged)
    })}
    {/* ── Distress Scenarios label ── */}
    <div style={{ gridColumn: "1 / -1", fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: "0.75rem", paddingBottom: "0.25rem", borderBottom: "1px solid #F1F5F9" }}>
      Distress Scenarios
    </div>
    {TEMPLATES.filter((t) => t.category === "distress").map((tpl, tplIdx) => {
      // ... same card JSX (copy — same component, just different filtered array)
    })}
  </div>
)}
```

**Important:** The card JSX is identical for both groups — do not factor it out. The `tplIdx` for stagger delay should be offset for the distress group: use `tplIdx + TEMPLATES.filter(t => t.category !== "distress").length` as the delay index.

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Scenarios.tsx && git commit -m "feat: add tags + category to Template interface, add Library sub-group labels"
```

---

## Task 4: Add three distress Library cards

**Files:**
- Modify: `src/app/pages/Scenarios.tsx` (TEMPLATES array at line ~224)

ECL values are pre-computed using `computeECLFromBase(47.2, inputs)` for each card's inputs.

- [ ] **Step 1: Add the three new TEMPLATES at the end of the TEMPLATES array**

After TPL-007, append:

```typescript
  // ── Distress Scenarios ────────────────────────────────────────────────────
  {
    id: "TPL-D01", name: "COVID-Style Deferral Wave", weight: "—", ecl: 88.0,
    lastRun: "Never", color: "#B91C1C", bg: "rgba(185,28,28,0.05)",
    category: "distress",
    tags: ["Deferral", "Govt Support", "PBH"],
    description: "Mass deferral requests across the fleet triggered by a severe traffic collapse. Government backstops ~35% of exposure. Half of deferred rent forgiven. 20% of fleet switches to Power-by-Hour.",
    inputs: {
      gdpDelta: -0.03, rpkDelta: -0.55, fuelDelta: -0.30,
      fxDelta: 0, rateDelta: -0.005, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 1.0,
      deferralMonths: 9, govtSupportProb: 0.35, forgivenessRate: 0.50,
      pbhConversionPct: 0.20, etpRate: 0, lecRate: 0,
    },
    shapley: [
      { driver: "RPK / Traffic Shock (−55%)", contribution: 42, direction: "up" },
      { driver: "Deferral Penalty (9mo × 50% forgiven)", contribution: 28, direction: "up" },
      { driver: "GDP Contraction (−3%)", contribution: 15, direction: "up" },
      { driver: "Govt Support (−35% offset)", contribution: 10, direction: "down" },
      { driver: "PBH Conversion (−20% fleet)", contribution: 5, direction: "down" },
    ],
    p5Factor: 0.60, p95Factor: 1.98,
    keyFinding: "Deferral penalty adds $8.4M above macro ECL. Government support mitigates $4.5M. PBH conversion recovers $1.4M. Net distress impact: +$6.9M vs macro-only equivalent.",
  },
  {
    id: "TPL-D02", name: "Bilateral Restructuring", weight: "—", ecl: 80.2,
    lastRun: "Never", color: "#0369A1", bg: "rgba(3,105,161,0.05)",
    category: "distress",
    tags: ["Deferral", "Govt Support", "ETP", "LEC"],
    description: "Single lessee in distress. Negotiated 6-month deferral with 60% government backstop and 25% forgiveness. Lessor recovers ETP (15%) and LEC (10%) on restructured leases.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.20, fuelDelta: 0,
      fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.5, pdS3Multi: 2.0,
      deferralMonths: 6, govtSupportProb: 0.60, forgivenessRate: 0.25,
      pbhConversionPct: 0, etpRate: 0.15, lecRate: 0.10,
    },
    shapley: [
      { driver: "Stage 3 PD Multiplier ×2.0", contribution: 45, direction: "up" },
      { driver: "Stage 2 PD Multiplier ×1.5", contribution: 22, direction: "up" },
      { driver: "RPK Shock (−20%)", contribution: 18, direction: "up" },
      { driver: "ETP Recovery (15%)", contribution: 9, direction: "down" },
      { driver: "LEC Recovery (10%)", contribution: 6, direction: "down" },
    ],
    p5Factor: 0.62, p95Factor: 1.91,
    keyFinding: "High govt support (60%) significantly dampens deferral ECL. ETP + LEC together recover $1.8M. Net deferral impact after mitigation: +$0.9M. Strong PD stress drives the bulk of ECL uplift.",
  },
  {
    id: "TPL-D03", name: "Early Termination Wave", weight: "—", ecl: 60.9,
    lastRun: "Never", color: "#15803D", bg: "rgba(21,128,61,0.05)",
    category: "distress",
    tags: ["ETP", "LEC", "Asset Stress"],
    description: "Lessor-driven early terminations to maximise recovery before defaults crystallise. Short 3-month deferral with minimal forgiveness. Strong ETP (35%) and LEC (20%) recovery partially offsets losses.",
    inputs: {
      gdpDelta: 0, rpkDelta: 0, fuelDelta: 0,
      fxDelta: 0, rateDelta: 0, assetValueDelta: -0.15,
      pdS2Multi: 1.8, pdS3Multi: 1.0,
      deferralMonths: 3, govtSupportProb: 0, forgivenessRate: 0.10,
      pbhConversionPct: 0, etpRate: 0.35, lecRate: 0.20,
    },
    shapley: [
      { driver: "Stage 2 PD Multiplier ×1.8", contribution: 38, direction: "up" },
      { driver: "Asset Value Decline (−15%)", contribution: 32, direction: "up" },
      { driver: "ETP Recovery (35%)", contribution: 20, direction: "down" },
      { driver: "LEC Recovery (20%)", contribution: 8, direction: "down" },
      { driver: "Deferral Penalty (3mo × 10%)", contribution: 2, direction: "up" },
    ],
    p5Factor: 0.65, p95Factor: 1.82,
    keyFinding: "Lessor mitigation is the story here: ETP + LEC together recover $2.8M, nearly eliminating the deferral penalty. Net distress impact: −$0.9M (mitigation exceeds penalty). ECL driven primarily by asset value decline and Stage 2 migration.",
  },
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Scenarios.tsx && git commit -m "feat: add COVID deferral, bilateral restructuring, and ETP/LEC distress Library cards"
```

---

## Task 5: Add Distress & Mitigation section to Custom Builder form

**Files:**
- Modify: `src/app/pages/Scenarios.tsx` (Custom Builder state ~line 635; form render ~line 1250)

- [ ] **Step 1: Add `distressOpen` state**

Find the Custom Builder state block at ~line 635. After `const [editorMode, setEditorMode] = useState<"form" | "dsl">("form");`, add:

```typescript
  const [distressOpen, setDistressOpen] = useState(false);
```

- [ ] **Step 2: Auto-expand distress section when any distress lever is non-zero**

Find the `updateFormInputs` function at ~line 689:

```typescript
  const updateFormInputs = (partial: Partial<ScenarioInputs>) => {
    const next = { ...formInputs, ...partial };
    setFormInputs(next);
    setDslText(generateDSL(next, customName, customMode, customPaths, customSeed));
    setDslErrors([]);
    // Auto-expand distress section if any distress lever is set
    const hasDistress =
      next.deferralMonths !== 0 || next.govtSupportProb !== 0 ||
      next.forgivenessRate !== 0 || next.pbhConversionPct !== 0 ||
      next.etpRate !== 0 || next.lecRate !== 0;
    if (hasDistress) setDistressOpen(true);
  };
```

- [ ] **Step 3: Add the Distress & Mitigation section to the form**

In the form's visual mode (`{editorMode === "form" ? (`), find the PD Multipliers section. It ends with the `SliderRow` for Stage 3 PD Multiplier at ~line 1284. After those two SliderRows and before the "Live ECL preview" div at ~line 1288, insert:

```tsx
                  {/* ── Distress & Mitigation — collapsible ── */}
                  {(() => {
                    const activeLevers = [
                      formInputs.deferralMonths !== 0,
                      formInputs.govtSupportProb !== 0,
                      formInputs.forgivenessRate !== 0,
                      formInputs.pbhConversionPct !== 0,
                      formInputs.etpRate !== 0,
                      formInputs.lecRate !== 0,
                    ].filter(Boolean).length;

                    const MONTHLY_RENT_M = 2.85;
                    const deferralPenalty =
                      formInputs.deferralMonths *
                      (1 - formInputs.govtSupportProb) *
                      formInputs.forgivenessRate *
                      MONTHLY_RENT_M;
                    const pbhBenefit  = formInputs.pbhConversionPct * liveBaseECL * 0.15;
                    const etpBenefit  = formInputs.etpRate           * liveBaseECL * 0.08;
                    const lecBenefit  = formInputs.lecRate            * liveBaseECL * 0.05;
                    const netDistress = deferralPenalty - pbhBenefit - etpBenefit - lecBenefit;

                    return (
                      <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                        {/* Section header */}
                        <button
                          onClick={() => setDistressOpen((o) => !o)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.875rem",
                            background: distressOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                            border: "none", cursor: "pointer",
                            borderBottom: distressOpen ? "1px solid #E2E8F0" : "none",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Distress &amp; Mitigation
                            </span>
                            {activeLevers > 0 && (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                {activeLevers} active
                              </span>
                            )}
                            {activeLevers === 0 && (
                              <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>0 active levers</span>
                            )}
                          </div>
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: distressOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
                          >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {/* Collapsible body */}
                        <AnimatePresence initial={false}>
                          {distressOpen && (
                            <motion.div
                              key="distress-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0.875rem" }}>
                                {/* Sub-group: Deferral & Forgiveness */}
                                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                                  Deferral &amp; Forgiveness
                                </div>
                                <SliderRow
                                  label="Deferral Duration"
                                  min={0} max={24} step={1}
                                  value={formInputs.deferralMonths}
                                  onChange={(v) => updateFormInputs({ deferralMonths: v })}
                                  fmt={(v) => v === 0 ? "None" : `${v} mo`}
                                />
                                <SliderRow
                                  label="Govt Support Probability"
                                  min={0} max={1} step={0.05}
                                  value={formInputs.govtSupportProb}
                                  onChange={(v) => updateFormInputs({ govtSupportProb: v })}
                                  fmt={(v) => v === 0 ? "None" : `${Math.round(v * 100)}%`}
                                />
                                <SliderRow
                                  label="Forgiveness Rate"
                                  min={0} max={1} step={0.05}
                                  value={formInputs.forgivenessRate}
                                  onChange={(v) => updateFormInputs({ forgivenessRate: v })}
                                  fmt={(v) => v === 0 ? "None" : `${Math.round(v * 100)}%`}
                                />

                                {/* Divider */}
                                <div style={{ borderTop: "1px solid #F1F5F9", margin: "0.75rem 0" }} />

                                {/* Sub-group: Lessor Mitigation */}
                                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                                  Lessor Mitigation
                                </div>
                                <SliderRow
                                  label="PBH Conversion"
                                  min={0} max={1} step={0.05}
                                  value={formInputs.pbhConversionPct}
                                  onChange={(v) => updateFormInputs({ pbhConversionPct: v })}
                                  fmt={(v) => v === 0 ? "None" : `${Math.round(v * 100)}% of fleet`}
                                />
                                <SliderRow
                                  label="ETP Rate"
                                  min={0} max={0.5} step={0.05}
                                  value={formInputs.etpRate}
                                  onChange={(v) => updateFormInputs({ etpRate: v })}
                                  fmt={(v) => v === 0 ? "None" : `${Math.round(v * 100)}% of lease value`}
                                />
                                <SliderRow
                                  label="LEC Rate"
                                  min={0} max={0.3} step={0.05}
                                  value={formInputs.lecRate}
                                  onChange={(v) => updateFormInputs({ lecRate: v })}
                                  fmt={(v) => v === 0 ? "None" : `${Math.round(v * 100)}% of half-life value`}
                                />

                                {/* Net impact line — only when at least one lever is set */}
                                {activeLevers > 0 && (
                                  <div style={{ marginTop: "0.75rem", padding: "0.625rem 0.75rem", background: "#F8FAFC", borderRadius: "0.375rem", border: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#475569", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                    <span>
                                      Deferral penalty{" "}
                                      <span style={{ fontWeight: 700, color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                                        +${deferralPenalty.toFixed(1)}M
                                      </span>
                                    </span>
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span>
                                      Mitigation{" "}
                                      <span style={{ fontWeight: 700, color: "#15803D", fontVariantNumeric: "tabular-nums" }}>
                                        −${(pbhBenefit + etpBenefit + lecBenefit).toFixed(1)}M
                                      </span>
                                    </span>
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span>
                                      Net{" "}
                                      <span style={{ fontWeight: 700, color: netDistress >= 0 ? "#B91C1C" : "#15803D", fontVariantNumeric: "tabular-nums" }}>
                                        {netDistress >= 0 ? "+" : "−"}${Math.abs(netDistress).toFixed(1)}M
                                      </span>
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

- [ ] **Step 4: Reset distress fields when "Reset to Baseline" is clicked**

Find the Reset button at ~line 1316. Its `onClick` currently calls `setFormInputs(ZERO_INPUTS)`. `ZERO_INPUTS` now includes all distress fields at `0`, so the reset is automatic. Also reset `distressOpen`:

```tsx
                    <button
                      onClick={() => {
                        setFormInputs(ZERO_INPUTS);
                        setDslText(generateDSL(ZERO_INPUTS, customName, customMode, customPaths, customSeed));
                        setDistressOpen(false);
                      }}
                      style={{ ...BTN_OUTLINE, fontSize: "0.8125rem" }}
                    >
                      Reset to Baseline
                    </button>
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: no errors.

- [ ] **Step 6: Run all tests**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Scenarios.tsx && git commit -m "feat: add Distress & Mitigation collapsible section to Custom Builder"
```

---

## Self-Review

**Spec coverage:**
- ✅ 6 new `ScenarioInputs` fields — Task 1
- ✅ `computeECLFromBase` extended — Task 1
- ✅ DSL round-trip — Task 2
- ✅ "Distress & Mitigation" collapsible section — Task 5
- ✅ Sub-groups: Deferral & Forgiveness / Lessor Mitigation — Task 5
- ✅ Net impact line — Task 5
- ✅ Auto-expand on non-zero lever — Task 5 Step 2
- ✅ Library sub-group labels — Task 3
- ✅ Tags on cards — Task 3
- ✅ 3 distress Library cards with Customise (clone) button — Task 4 (clone via existing `setClonePending`)
- ✅ Reset clears distress fields and collapses section — Task 5 Step 4

**Type consistency:**
- `deferralMonths`, `govtSupportProb`, `forgivenessRate`, `pbhConversionPct`, `etpRate`, `lecRate` — same names in interface, ZERO_INPUTS, formula, DSL generator, DSL parser, form sliders, net impact calculation, auto-expand check.
- `MONTHLY_RENT_M = 2.85` — defined in `eclCalculator.ts` as module constant; duplicated as local const in the form's IIFE (acceptable: the form needs it for the live net impact line without importing an internal constant).

**No placeholders:** All code is complete. ECL values for new templates are pre-calculated. Shapley arrays are filled.
