# Jurisdiction Repossession Risk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CTC status, enforcement tier, and country-specific repossession risk a live ECL input — auto-computed from the portfolio's lessee country mix, overridable in the Custom Builder for scenario stress-testing.

**Architecture:** Four additive changes — (1) extend `eclCalculator.ts` with two new `ScenarioInputs` fields and a `jurisdictionLGDDelta` ECL term; (2) create `jurisdictionRisk.ts` utility for tier classification and portfolio mix computation; (3) create `JurisdictionRiskTab.tsx` showing the portfolio breakdown with a "Use in Custom Builder" CTA; (4) wire the tab and a new Custom Builder collapsible section into `Scenarios.tsx`.

**Tech Stack:** React 18, TypeScript, Vitest, Framer Motion (AnimatePresence), inline styles. Test runner: `npx vitest run`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/utils/eclCalculator.ts` | Modify | Add `ctcGoldPct`, `nonCtcPct` to `ScenarioInputs`/`ZERO_INPUTS`; add `jurisdictionLGDDelta` term to `computeECLFromBase` |
| `src/app/utils/eclCalculator.test.ts` | Modify | Add jurisdiction LGD tests |
| `src/app/utils/jurisdictionRisk.ts` | **Create** | `ctcTier()` and `computePortfolioJurisdictionMix()` — pure functions, no React |
| `src/app/utils/jurisdictionRisk.test.ts` | **Create** | Tests for the above |
| `src/app/components/scenarios/JurisdictionRiskTab.tsx` | **Create** | KPI cards + lessee table + "Use in Custom Builder" CTA |
| `src/app/pages/Scenarios.tsx` | Modify | Import, TEMPLATES update, DSL round-trip, tab, Custom Builder collapsible section |

---

## Task 1: ECL Calculator — new jurisdiction fields

**Files:**
- Modify: `src/app/utils/eclCalculator.ts`
- Modify: `src/app/utils/eclCalculator.test.ts`

### Background

Two new optional-but-required fields on `ScenarioInputs`:
- `ctcGoldPct: number` (0–1) — share of fleet in CTC Gold jurisdictions
- `nonCtcPct: number` (0–1) — share of fleet in Non-CTC jurisdictions
- `ctcModeratePct` is derived: `max(0, 1 − ctcGoldPct − nonCtcPct)` — not stored

**ECL formula extension:**
```
ctcModeratePct = max(0, 1 − ctcGoldPct − nonCtcPct)
jurisdictionLGDDelta = (ctcModeratePct × 0.06 + nonCtcPct × 0.15) × baseECL
```

**Critical backward-compat rule:** When BOTH `ctcGoldPct === 0` AND `nonCtcPct === 0`, `jurisdictionLGDDelta` must be **0** (feature inactive = all fleet assumed CTC Gold). Without this guard, `ctcModeratePct` would be 1 and `ZERO_INPUTS` would produce a +6% uplift, breaking all existing tests.

- [ ] **Step 1.1 — Write failing tests**

Append to `src/app/utils/eclCalculator.test.ts`:

```typescript
describe("jurisdiction LGD adjustment", () => {
  it("ZERO_INPUTS has ctcGoldPct and nonCtcPct as 0", () => {
    expect(ZERO_INPUTS.ctcGoldPct).toBe(0);
    expect(ZERO_INPUTS.nonCtcPct).toBe(0);
  });

  it("both 0 → no uplift, backward-compatible with ZERO_INPUTS", () => {
    expect(computeECLFromBase(47.2, ZERO_INPUTS)).toBeCloseTo(47.2, 5);
  });

  it("both 0 → no uplift even when named explicitly", () => {
    expect(
      computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0, nonCtcPct: 0 })
    ).toBeCloseTo(47.2, 5);
  });

  it("pure non-CTC (nonCtcPct = 1.0) → +15% of baseECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0, nonCtcPct: 1.0 });
    expect(result).toBeCloseTo(47.2 * 1.15, 4);
  });

  it("pure CTC Gold (ctcGoldPct = 1.0) → 0 uplift", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 1.0, nonCtcPct: 0 });
    expect(result).toBeCloseTo(47.2, 5);
  });

  it("pure CTC Moderate (ctcGoldPct=0, nonCtcPct=0 treated as inactive) → 0 uplift", () => {
    // To get Moderate uplift, at least one of the sliders must be explicitly set nonzero.
    // Setting just ctcGoldPct = 0.5 (Moderate = 50%) → uplift = 0.5 × 0.06 × 47.2
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0.5, nonCtcPct: 0 });
    const expectedUplift = 0.5 * 0.06 * 47.2; // ctcModeratePct = 0.5
    expect(result).toBeCloseTo(47.2 + expectedUplift, 4);
  });

  it("mixed portfolio: 70% Gold, 20% NonCTC → Moderate=10%, uplift correct", () => {
    // ctcModeratePct = max(0, 1 - 0.7 - 0.2) = 0.1
    // jurisdictionLGDDelta = (0.1 × 0.06 + 0.2 × 0.15) × 47.2 = (0.006 + 0.03) × 47.2 = 1.6992
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0.7, nonCtcPct: 0.2 });
    const expectedDelta = (0.1 * 0.06 + 0.2 * 0.15) * 47.2;
    expect(result).toBeCloseTo(47.2 + expectedDelta, 4);
  });

  it("over-specified (gold + nonCtc > 1) clamps moderate to 0", () => {
    // ctcGoldPct=0.7, nonCtcPct=0.5 → ctcModeratePct = max(0, -0.2) = 0
    // jurisdictionLGDDelta = 0.5 × 0.15 × 47.2 = 3.54
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0.7, nonCtcPct: 0.5 });
    const expectedDelta = 0.5 * 0.15 * 47.2;
    expect(result).toBeCloseTo(47.2 + expectedDelta, 4);
  });

  it("floor still holds with max non-CTC (nonCtcPct=1.0)", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, ctcGoldPct: 0, nonCtcPct: 1.0 });
    expect(result).toBeGreaterThanOrEqual(47.2 * 0.3 - 0.001);
  });

  it("jurisdiction uplift stacks additively with macro stress", () => {
    const noJurisdiction = computeECLFromBase(47.2, { ...ZERO_INPUTS, rpkDelta: -0.25 });
    const withJurisdiction = computeECLFromBase(47.2, {
      ...ZERO_INPUTS, rpkDelta: -0.25, ctcGoldPct: 0, nonCtcPct: 0.5,
    });
    expect(withJurisdiction).toBeGreaterThan(noJurisdiction);
  });
});
```

- [ ] **Step 1.2 — Run tests, confirm all new tests fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx vitest run src/app/utils/eclCalculator.test.ts 2>&1 | tail -20
```

Expected: TypeScript errors about missing `ctcGoldPct` / `nonCtcPct` properties.

- [ ] **Step 1.3 — Add fields to `ScenarioInputs`, `ZERO_INPUTS`, and `computeECLFromBase`**

In `src/app/utils/eclCalculator.ts`:

**In `ScenarioInputs` interface**, add after `bankruptcyScenarioType`:
```typescript
  // ── Jurisdiction risk ─────────────────────────────────────────────────────
  ctcGoldPct: number;    // 0–1: share of fleet in CTC Gold jurisdictions (ctcScore≥80 AND ctcParty:true)
  nonCtcPct: number;     // 0–1: share of fleet in Non-CTC jurisdictions (ctcParty:false AND ctcScore<50)
  // Derived: ctcModeratePct = max(0, 1 − ctcGoldPct − nonCtcPct). Not stored — computed on use.
  // Both default to 0 (feature inactive = all fleet assumed CTC Gold). Backward-compatible with ZERO_INPUTS.
```

**In `ZERO_INPUTS`**, add after `bankruptcyScenarioType: null`:
```typescript
  ctcGoldPct: 0,
  nonCtcPct: 0,
```

**In `computeECLFromBase`**, add after the `lgdDelta` computation and before the `delta` line:
```typescript
  // Jurisdiction LGD uplift.
  // Guard: when both are 0, feature is inactive (all fleet assumed CTC Gold → 0 uplift).
  // This preserves backward compatibility with ZERO_INPUTS.
  // When active: CTC Moderate = +6% of baseECL, Non-CTC = +15% of baseECL.
  const ctcModeratePct = Math.max(0, 1 - inputs.ctcGoldPct - inputs.nonCtcPct);
  const jurisdictionLGDDelta =
    inputs.ctcGoldPct === 0 && inputs.nonCtcPct === 0
      ? 0
      : (ctcModeratePct * 0.06 + inputs.nonCtcPct * 0.15) * baseECL;
```

**Update the `delta` line** to include `jurisdictionLGDDelta`:
```typescript
  const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit + lgdDelta + jurisdictionLGDDelta;
```

- [ ] **Step 1.4 — Run tests, confirm all pass**

```bash
npx vitest run src/app/utils/eclCalculator.test.ts 2>&1 | tail -20
```

Expected: All tests pass. Count should be previous count + 10 new tests.

- [ ] **Step 1.5 — Commit**

```bash
git add src/app/utils/eclCalculator.ts src/app/utils/eclCalculator.test.ts
git commit -m "feat(ecl): add ctcGoldPct/nonCtcPct jurisdiction LGD uplift to ECL calculator"
```

---

## Task 2: `jurisdictionRisk.ts` — Portfolio mix utility

**Files:**
- Create: `src/app/utils/jurisdictionRisk.ts`
- Create: `src/app/utils/jurisdictionRisk.test.ts`

### Background

Pure-function utility (no React) used by both `JurisdictionRiskTab.tsx` and the "From portfolio" button in `Scenarios.tsx`. It maps lessee country strings to jurisdiction tiers and computes a rental-weighted portfolio mix.

**Tier rules:**
- `"gold"`: `ctcParty === true` AND `ctcScore >= 80`
- `"moderate"`: (`ctcParty === true` AND `ctcScore < 80`) OR (`ctcParty === false` AND `ctcScore >= 50`)
- `"nonCtc"`: `ctcParty === false` AND `ctcScore < 50`
- Unknown country (not in `jurisdictions` array): default to `"nonCtc"`

Country matching: compare `lessee.country` directly against `jurisdiction.country` (case-insensitive). The demo fleet data uses the same strings as `jurisdictionData.ts` (e.g., "UAE", "India", "France").

**Exported types and functions:**
- `type CtcTier = "gold" | "moderate" | "nonCtc"`
- `interface JurisdictionRow { lesseeName: string; country: string; tier: CtcTier; ctcScore: number; repossP50: number; weightPct: number; monthlyRental: number; }`
- `function ctcTier(j: Jurisdiction | undefined): CtcTier`
- `function computePortfolioJurisdictionMix(lessees: Lessee[], leases: Lease[]): { ctcGoldPct: number; nonCtcPct: number; rows: JurisdictionRow[] }`

- [ ] **Step 2.1 — Write failing tests**

Create `src/app/utils/jurisdictionRisk.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ctcTier, computePortfolioJurisdictionMix } from "./jurisdictionRisk";
import type { Jurisdiction } from "../components/jurisdictions/jurisdictionData";
import type { Lessee, Lease } from "../types/portfolio";

// Helpers — minimal Jurisdiction stubs
function makeJ(ctcParty: boolean, ctcScore: number): Jurisdiction {
  return {
    code: "XX", country: "Test", flag: "🏳", region: "Test",
    ctcParty, ctcScore, altA: false, idera: false,
    enforceability: 50, ruleOfLaw: 50, sanctions: "None",
    repossP50: 10, repossP90: 20, repossP50Cost: "5%", repossP90Cost: "10%",
    successProb: "70%", precedentCount: 0,
    narrative: "", uncertaintyBand: "high", lastUpdated: "2026-01-01",
  };
}

function makeLessee(id: string, name: string, country: string): Lessee {
  return { id, org_id: "demo", name, iata_code: null, country, credit_rating: null, pd_estimate: null, watchlist_status: null, created_at: "2024-01-01T00:00:00Z" };
}

function makeLease(lesseeId: string, monthlyRental: number): Lease {
  return { id: `ls-${lesseeId}`, org_id: "demo", asset_id: `a-${lesseeId}`, lessee_id: lesseeId, start_date: "2024-01-01", end_date: "2030-01-01", monthly_rental: monthlyRental, currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" };
}

describe("ctcTier", () => {
  it("undefined → nonCtc", () => {
    expect(ctcTier(undefined)).toBe("nonCtc");
  });

  it("ctcParty:true AND ctcScore≥80 → gold", () => {
    expect(ctcTier(makeJ(true, 88))).toBe("gold");
    expect(ctcTier(makeJ(true, 80))).toBe("gold");
  });

  it("ctcParty:true AND ctcScore<80 → moderate", () => {
    expect(ctcTier(makeJ(true, 79))).toBe("moderate");
    expect(ctcTier(makeJ(true, 50))).toBe("moderate");
  });

  it("ctcParty:false AND ctcScore≥50 → moderate", () => {
    expect(ctcTier(makeJ(false, 52))).toBe("moderate");
    expect(ctcTier(makeJ(false, 50))).toBe("moderate");
  });

  it("ctcParty:false AND ctcScore<50 → nonCtc", () => {
    expect(ctcTier(makeJ(false, 49))).toBe("nonCtc");
    expect(ctcTier(makeJ(false, 0))).toBe("nonCtc");
  });
});

describe("computePortfolioJurisdictionMix", () => {
  it("empty lessees → all zero, empty rows", () => {
    const result = computePortfolioJurisdictionMix([], []);
    expect(result.ctcGoldPct).toBe(0);
    expect(result.nonCtcPct).toBe(0);
    expect(result.rows).toHaveLength(0);
  });

  it("single Gold lessee → ctcGoldPct=1, nonCtcPct=0", () => {
    // Ireland (ctcParty:true, ctcScore:94) → Gold
    const lessees = [makeLessee("l1", "Ryanair", "Ireland")];
    const leases  = [makeLease("l1", 340000)];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.ctcGoldPct).toBeCloseTo(1.0, 5);
    expect(result.nonCtcPct).toBeCloseTo(0, 5);
  });

  it("single Non-CTC lessee → ctcGoldPct=0, nonCtcPct=1", () => {
    // Sri Lanka (ctcParty:false, ctcScore:35) → Non-CTC
    const lessees = [makeLessee("l1", "SriLankan Airlines", "Sri Lanka")];
    const leases  = [makeLease("l1", 480000)];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.ctcGoldPct).toBeCloseTo(0, 5);
    expect(result.nonCtcPct).toBeCloseTo(1.0, 5);
  });

  it("unknown country → treated as Non-CTC", () => {
    const lessees = [makeLessee("l1", "Mystery Airline", "Neverland")];
    const leases  = [makeLease("l1", 100000)];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.nonCtcPct).toBeCloseTo(1.0, 5);
    expect(result.rows[0].tier).toBe("nonCtc");
  });

  it("equal mix: Gold + NonCTC → each 50%", () => {
    const lessees = [
      makeLessee("l1", "Gold Airline", "Ireland"),    // Gold
      makeLessee("l2", "NonCtc Airline", "Sri Lanka"), // Non-CTC
    ];
    const leases = [
      makeLease("l1", 500000),
      makeLease("l2", 500000),
    ];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.ctcGoldPct).toBeCloseTo(0.5, 5);
    expect(result.nonCtcPct).toBeCloseTo(0.5, 5);
  });

  it("rows sorted by weightPct descending", () => {
    const lessees = [
      makeLessee("l1", "Small", "Sri Lanka"),  // 100k
      makeLessee("l2", "Large", "Ireland"),    // 900k
    ];
    const leases = [
      makeLease("l1", 100000),
      makeLease("l2", 900000),
    ];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.rows[0].lesseeName).toBe("Large");
    expect(result.rows[1].lesseeName).toBe("Small");
  });

  it("lessee with no matching lease is excluded", () => {
    const lessees = [
      makeLessee("l1", "With Lease", "Ireland"),
      makeLessee("l2", "No Lease",   "Germany"),
    ];
    const leases = [makeLease("l1", 500000)];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].lesseeName).toBe("With Lease");
  });

  it("lessee with null monthly_rental is excluded", () => {
    const lessees = [makeLessee("l1", "Null Rental", "Ireland")];
    const leases = [{ ...makeLease("l1", 0), monthly_rental: null }];
    const result = computePortfolioJurisdictionMix(lessees, leases);
    expect(result.rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2.2 — Run tests, confirm they fail**

```bash
npx vitest run src/app/utils/jurisdictionRisk.test.ts 2>&1 | tail -10
```

Expected: Cannot find module `./jurisdictionRisk`.

- [ ] **Step 2.3 — Implement `jurisdictionRisk.ts`**

Create `src/app/utils/jurisdictionRisk.ts`:

```typescript
// src/app/utils/jurisdictionRisk.ts
// Pure-function utilities for CTC tier classification and portfolio jurisdiction mix computation.
// No React dependencies — safe to use in both components and tests.

import { jurisdictions, type Jurisdiction } from "../components/jurisdictions/jurisdictionData";
import type { Lessee, Lease } from "../types/portfolio";

export type CtcTier = "gold" | "moderate" | "nonCtc";

export interface JurisdictionRow {
  lesseeName: string;
  country: string;
  tier: CtcTier;
  ctcScore: number;
  repossP50: number;
  weightPct: number;     // 0–1: share of total fleet rental
  monthlyRental: number; // USD
}

/**
 * Classify a jurisdiction into a CTC tier.
 *   Gold     = ctcParty:true  AND ctcScore ≥ 80
 *   Moderate = ctcParty:true  AND ctcScore < 80  OR  ctcParty:false AND ctcScore ≥ 50
 *   Non-CTC  = ctcParty:false AND ctcScore < 50  (or unknown/absent jurisdiction)
 */
export function ctcTier(j: Jurisdiction | undefined): CtcTier {
  if (!j) return "nonCtc";
  if (j.ctcParty && j.ctcScore >= 80) return "gold";
  if (j.ctcParty && j.ctcScore < 80)  return "moderate";
  if (!j.ctcParty && j.ctcScore >= 50) return "moderate";
  return "nonCtc";
}

/**
 * Compute the rental-weighted CTC tier mix for a given lessee/lease set.
 * - Lessees with no matching lease, or with null monthly_rental, are excluded.
 * - Lessee.country is matched case-insensitively against jurisdiction.country.
 * - Countries absent from jurisdictionData default to Non-CTC.
 *
 * Returns:
 *   ctcGoldPct  — 0–1 share of total rental in Gold jurisdictions
 *   nonCtcPct   — 0–1 share of total rental in Non-CTC jurisdictions
 *   rows        — per-lessee breakdown, sorted by weightPct descending
 */
export function computePortfolioJurisdictionMix(
  lessees: Lessee[],
  leases: Lease[],
): { ctcGoldPct: number; nonCtcPct: number; rows: JurisdictionRow[] } {
  if (lessees.length === 0 || leases.length === 0) {
    return { ctcGoldPct: 0, nonCtcPct: 0, rows: [] };
  }

  // Build lessee_id → first matching lease with positive rental
  const leaseByLessee = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByLessee.has(lease.lessee_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByLessee.set(lease.lessee_id, lease);
    }
  }

  // Build country → Jurisdiction lookup (case-insensitive)
  const jurisMap = new Map<string, Jurisdiction>();
  for (const j of jurisdictions) {
    jurisMap.set(j.country.toLowerCase(), j);
  }

  // Build rows
  const rawRows: JurisdictionRow[] = [];
  let totalRental = 0;

  for (const lessee of lessees) {
    const lease = leaseByLessee.get(lessee.id);
    if (!lease || !lease.monthly_rental) continue;

    const country = lessee.country ?? "";
    const jEntry = jurisMap.get(country.toLowerCase());
    const tier = ctcTier(jEntry);

    rawRows.push({
      lesseeName: lessee.name,
      country,
      tier,
      ctcScore: jEntry?.ctcScore ?? 0,
      repossP50: jEntry?.repossP50 ?? 99,
      weightPct: 0,          // filled in second pass
      monthlyRental: lease.monthly_rental,
    });
    totalRental += lease.monthly_rental;
  }

  if (totalRental === 0) return { ctcGoldPct: 0, nonCtcPct: 0, rows: [] };

  // Second pass: compute weights and tier aggregates
  let goldRental = 0;
  let nonCtcRental = 0;

  for (const row of rawRows) {
    row.weightPct = row.monthlyRental / totalRental;
    if (row.tier === "gold")   goldRental   += row.monthlyRental;
    if (row.tier === "nonCtc") nonCtcRental += row.monthlyRental;
  }

  rawRows.sort((a, b) => b.weightPct - a.weightPct);

  return {
    ctcGoldPct: goldRental / totalRental,
    nonCtcPct: nonCtcRental / totalRental,
    rows: rawRows,
  };
}
```

- [ ] **Step 2.4 — Run tests, confirm all pass**

```bash
npx vitest run src/app/utils/jurisdictionRisk.test.ts 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 2.5 — Commit**

```bash
git add src/app/utils/jurisdictionRisk.ts src/app/utils/jurisdictionRisk.test.ts
git commit -m "feat(utils): add jurisdictionRisk utility for CTC tier classification and portfolio mix"
```

---

## Task 3: `JurisdictionRiskTab.tsx` — portfolio breakdown tab

**Files:**
- Create: `src/app/components/scenarios/JurisdictionRiskTab.tsx`

This component is a read-only portfolio intelligence tab. It calls `usePortfolioData()` internally (like other tabs) and accepts one prop: a callback to pre-fill the Custom Builder.

### Layout
1. **KPI row** — 4 cards side by side: CTC Gold %, CTC Moderate %, Non-CTC %, Jurisdiction LGD Uplift
2. **Lessee breakdown table** — columns: Airline · Country · Enforcement Tier · CTC Score · Reposs P50 · Weight %
3. **"Use in Custom Builder" button** — below the table

### Color logic
- CTC Gold card: always `#15803D` (green)
- CTC Moderate card: always `#B45309` (amber)
- Non-CTC card: red (`#B91C1C`) if > 20%, amber (`#B45309`) if > 10%, green (`#15803D`) otherwise
- Jurisdiction LGD Uplift: red (`#B91C1C`) if > 0, green (`#15803D`) if = 0

### KPI card LGD uplift formula
Uses `BASE_ECL = 47.2` as base (consistent with spec; JurisdictionRiskTab doesn't have access to live provisions ECL):
```
uplift = (ctcModeratePct × 0.06 + nonCtcPct × 0.15) × BASE_ECL
```
(When ctcGoldPct=0 AND nonCtcPct=0, uplift is 0 — same guard as calculator.)

### Tier pill colors
- `"gold"`: background `#DCFCE7`, text `#15803D`
- `"moderate"`: background `#FEF3C7`, text `#B45309`
- `"nonCtc"`: background `#FEE2E2`, text `#B91C1C`

- [ ] **Step 3.1 — Create `JurisdictionRiskTab.tsx`**

```tsx
// src/app/components/scenarios/JurisdictionRiskTab.tsx
import { usePortfolioData } from "../../hooks/usePortfolioData";
import { computePortfolioJurisdictionMix, type CtcTier } from "../../utils/jurisdictionRisk";
import { BASE_ECL } from "../../utils/eclCalculator";
import { Card } from "../ui/Card";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<CtcTier, string> = {
  gold:     "CTC Gold",
  moderate: "CTC Moderate",
  nonCtc:   "Non-CTC",
};

const TIER_PILL_BG: Record<CtcTier, string> = {
  gold:     "#DCFCE7",
  moderate: "#FEF3C7",
  nonCtc:   "#FEE2E2",
};

const TIER_PILL_COLOR: Record<CtcTier, string> = {
  gold:     "#15803D",
  moderate: "#B45309",
  nonCtc:   "#B91C1C",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, color, bg,
}: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{
      background: bg, borderRadius: "0.5rem",
      padding: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem",
    }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.375rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

function TierPill({ tier }: { tier: CtcTier }) {
  return (
    <span style={{
      background: TIER_PILL_BG[tier],
      color: TIER_PILL_COLOR[tier],
      fontWeight: 600, fontSize: "0.75rem",
      padding: "0.15rem 0.5rem", borderRadius: "9999px",
      whiteSpace: "nowrap",
    }}>
      {TIER_LABEL[tier]}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Called when user clicks "Use in Custom Builder" — switches tab and pre-fills sliders. */
  onUseInCustomBuilder: (ctcGoldPct: number, nonCtcPct: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function JurisdictionRiskTab({ onUseInCustomBuilder }: Props) {
  const { lessees, leases } = usePortfolioData();
  const { ctcGoldPct, nonCtcPct, rows } = computePortfolioJurisdictionMix(lessees, leases);
  const ctcModeratePct = Math.max(0, 1 - ctcGoldPct - nonCtcPct);

  // LGD uplift using BASE_ECL (47.2) as proxy — consistent with spec calibration.
  const uplift =
    ctcGoldPct === 0 && nonCtcPct === 0
      ? 0
      : (ctcModeratePct * 0.06 + nonCtcPct * 0.15) * BASE_ECL;

  // Non-CTC card color thresholds: red >20%, amber >10%, green otherwise
  const nonCtcColor = nonCtcPct > 0.2 ? "#B91C1C" : nonCtcPct > 0.1 ? "#B45309" : "#15803D";
  const nonCtcBg    = nonCtcPct > 0.2 ? "#FEE2E2" : nonCtcPct > 0.1 ? "#FEF3C7" : "#DCFCE7";

  // Uplift card color: red if > 0, green if 0
  const upliftColor = uplift > 0 ? "#B91C1C" : "#15803D";
  const upliftBg    = uplift > 0 ? "#FEE2E2" : "#DCFCE7";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="CTC Gold"
          value={`${(ctcGoldPct * 100).toFixed(1)}%`}
          color="#15803D"
          bg="#DCFCE7"
        />
        <KpiCard
          label="CTC Moderate"
          value={`${(ctcModeratePct * 100).toFixed(1)}%`}
          color="#B45309"
          bg="#FEF3C7"
        />
        <KpiCard
          label="Non-CTC"
          value={`${(nonCtcPct * 100).toFixed(1)}%`}
          color={nonCtcColor}
          bg={nonCtcBg}
        />
        <KpiCard
          label="Jurisdiction LGD Uplift"
          value={uplift > 0 ? `+$${uplift.toFixed(1)}M` : "$0"}
          color={upliftColor}
          bg={upliftBg}
        />
      </div>

      {/* ── Lessee breakdown table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Lessee Jurisdiction Breakdown
          </div>

          {rows.length === 0 ? (
            <div style={{ color: "#94A3B8", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
              No lessee data available.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    {["Airline", "Country", "Enforcement Tier", "CTC Score", "Reposs P50", "Weight %"].map((h) => (
                      <th key={h} style={{
                        textAlign: h === "Airline" || h === "Country" ? "left" : "right",
                        padding: "0.5rem 0.75rem",
                        fontWeight: 600, color: "#64748B",
                        fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.lesseeName}
                      style={{
                        borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none",
                        background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                      }}
                    >
                      <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>
                        {row.lesseeName}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>
                        {row.country || "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <TierPill tier={row.tier} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.ctcScore > 0 ? row.ctcScore : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.repossP50 < 99 ? `${row.repossP50} mo` : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                        {(row.weightPct * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Weighted summary row */}
                <tfoot>
                  <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                    <td colSpan={2} style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#475569", fontSize: "0.75rem" }}>
                      PORTFOLIO WEIGHTED
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                        {(ctcGoldPct * 100).toFixed(0)}% Gold · {(ctcModeratePct * 100).toFixed(0)}% Mod · {(nonCtcPct * 100).toFixed(0)}% Non-CTC
                      </span>
                    </td>
                    <td colSpan={2} style={{ padding: "0.625rem 0.75rem" }} />
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#0F172A" }}>
                      100.0%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* ── "Use in Custom Builder" button ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => onUseInCustomBuilder(ctcGoldPct, nonCtcPct)}
          disabled={rows.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            background: "#002147", color: "#FFFFFF",
            border: "none", borderRadius: "9999px",
            padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500,
            cursor: rows.length === 0 ? "not-allowed" : "pointer",
            opacity: rows.length === 0 ? 0.5 : 1,
          }}
          title="Computed from your portfolio's lessee country mix, weighted by monthly rental."
        >
          Use in Custom Builder →
        </button>
      </div>

    </div>
  );
}
```

- [ ] **Step 3.2 — Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx tsc --noEmit 2>&1 | grep "JurisdictionRiskTab"
```

Expected: no output (no errors in this file). If errors appear, fix them before proceeding.

- [ ] **Step 3.3 — Commit**

```bash
git add src/app/components/scenarios/JurisdictionRiskTab.tsx
git commit -m "feat(ui): add JurisdictionRiskTab with KPI cards and lessee breakdown table"
```

---

## Task 4: `Scenarios.tsx` — Wire tab, DSL, and Custom Builder section

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

This task touches several distinct areas of `Scenarios.tsx`. Each step is targeted; run `npx tsc --noEmit` after each group to catch mistakes early.

### Step group A — Imports and TEMPLATES update

- [ ] **Step 4.1 — Add imports**

At the top of `Scenarios.tsx`, after the existing `InsolvencyTab` and `LeasePricingTab` imports:

```typescript
import { JurisdictionRiskTab } from "../components/scenarios/JurisdictionRiskTab";
import { computePortfolioJurisdictionMix } from "../utils/jurisdictionRisk";
```

- [ ] **Step 4.2 — Update TEMPLATES inputs**

After Task 1, `ScenarioInputs` now requires `ctcGoldPct` and `nonCtcPct`. TypeScript will flag every `inputs:` object in the `TEMPLATES` array as an error. Add `ctcGoldPct: 0, nonCtcPct: 0` to every `inputs` object in `TEMPLATES`.

Run the TypeScript checker to find all locations:
```bash
npx tsc --noEmit 2>&1 | grep "Scenarios.tsx"
```

Each error will point to a `ScenarioInputs` literal missing the new fields. For each one, add the two fields. Example — before:
```typescript
inputs: { gdpDelta: -0.015, rpkDelta: -0.25, /* ... */ bankruptcyScenarioType: null },
```
After:
```typescript
inputs: { gdpDelta: -0.015, rpkDelta: -0.25, /* ... */ bankruptcyScenarioType: null, ctcGoldPct: 0, nonCtcPct: 0 },
```

Repeat for every flagged location. When done:
```bash
npx tsc --noEmit 2>&1 | grep "Scenarios.tsx"
```
Expected: no output.

### Step group B — DSL round-trip

- [ ] **Step 4.3 — Extend `generateDSL`**

In `generateDSL` (around line 597), add two fields to the `shocks` object, after `lec_rate`:

```typescript
        lec_rate: inputs.lecRate,
        // Jurisdiction risk — share of fleet in each CTC tier (0–1). Omitted from output
        // when both are 0 (feature inactive = CTC Gold baseline, no LGD uplift applied).
        ...(inputs.ctcGoldPct !== 0 || inputs.nonCtcPct !== 0
          ? { ctc_gold_pct: inputs.ctcGoldPct, non_ctc_pct: inputs.nonCtcPct }
          : {}),
```

- [ ] **Step 4.4 — Extend `parseDSL`**

In `parseDSL` (around line 634), inside the returned `inputs` object, add after `bankruptcyScenarioType`:

```typescript
        bankruptcyScenarioType: parsed.bankruptcy_scenario_type ?? null,
        ctcGoldPct: typeof s.ctc_gold_pct === "number"
          ? Math.min(1, Math.max(0, s.ctc_gold_pct))
          : 0,
        nonCtcPct: typeof s.non_ctc_pct === "number"
          ? Math.min(1, Math.max(0, s.non_ctc_pct))
          : 0,
```

- [ ] **Step 4.5 — Verify DSL compiles**

```bash
npx tsc --noEmit 2>&1 | grep "Scenarios.tsx"
```
Expected: no output.

### Step group C — State and auto-expand logic

- [ ] **Step 4.6 — Add `jurisdictionOpen` state**

After the `insolvencyOpen` state line (around line 887):
```typescript
  const [insolvencyOpen, setInsolvencyOpen] = useState(false);
```

Add:
```typescript
  const [jurisdictionOpen, setJurisdictionOpen] = useState(false);
```

- [ ] **Step 4.7 — Auto-expand in `updateFormInputs`**

In `updateFormInputs` callback (around line 934), after the line `if (next!.bankruptcyScenarioType !== null) setInsolvencyOpen(true);`, add:

```typescript
    if (next!.ctcGoldPct !== 0 || next!.nonCtcPct !== 0) setJurisdictionOpen(true);
```

Update the dependency array of `useCallback` to include `setJurisdictionOpen`:
```typescript
  }, [customName, customMode, customPaths, customSeed, setDistressOpen, setInsolvencyOpen, setJurisdictionOpen]);
```

- [ ] **Step 4.8 — Auto-expand in clone effect**

In the clone `useEffect` (around line 1004), after `if (clonePending.inputs.bankruptcyScenarioType !== null) setInsolvencyOpen(true);`, add:

```typescript
    if (clonePending.inputs.ctcGoldPct !== 0 || clonePending.inputs.nonCtcPct !== 0) setJurisdictionOpen(true);
```

- [ ] **Step 4.9 — Add portfolio mix useMemo**

In `Scenarios.tsx`, after the `liveStage3Lessees` useMemo (around line 906), add:

```typescript
  // Compute rental-weighted jurisdiction mix from portfolio lessees + leases.
  // Used by both the JurisdictionRiskTab "Use in Custom Builder" handler and the
  // "From portfolio" button in the Custom Builder Jurisdiction Risk section.
  const portfolioJurisdictionMix = React.useMemo(
    () => computePortfolioJurisdictionMix(lessees, leases),
    [lessees, leases]
  );
```

### Step group D — Tabs and tab content render

- [ ] **Step 4.10 — Add "Jurisdiction Risk" to tabs array**

Find the tabs array (around line 1052):
```typescript
    : ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Lease Pricing"];
```

Change to:
```typescript
    : ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Lease Pricing"];
```

- [ ] **Step 4.11 — Add tab content render**

Find the existing Insolvency Regimes tab render (around line 2684):
```typescript
      {activeTab === "Insolvency Regimes" && <InsolvencyTab />}
```

After it, add:
```typescript
      {/* ══ JURISDICTION RISK TAB ══════════════════════════════════════ */}
      {activeTab === "Jurisdiction Risk" && (
        <JurisdictionRiskTab
          onUseInCustomBuilder={(gold, nonCtc) => {
            updateFormInputs({ ctcGoldPct: gold, nonCtcPct: nonCtc });
            setJurisdictionOpen(true);
            setActiveTab("Custom Builder");
          }}
        />
      )}
```

### Step group E — Custom Builder collapsible section

The new "Jurisdiction Risk" section is inserted between the Insolvency Regime IIFE block and the "Live ECL preview" block (around line 2292 — after the closing `})()}` of the Insolvency IIFE, before the `{/* Live ECL preview */}` comment).

- [ ] **Step 4.12 — Insert Jurisdiction Risk collapsible section**

After the closing `})()}` of the Insolvency Regime IIFE block (around line 2291), and before `{/* Live ECL preview */}`, insert the following JSX:

```tsx
                  {/* ── Jurisdiction Risk — collapsible ── */}
                  {(() => {
                    const goldPct  = formInputs.ctcGoldPct;
                    const nonCtcP  = formInputs.nonCtcPct;
                    const modPct   = Math.max(0, 1 - goldPct - nonCtcP);
                    const isActive = goldPct !== 0 || nonCtcP !== 0;

                    // Impact line values (relative to liveBaseECL)
                    const modImpact   = modPct   * 0.06 * liveBaseECL;
                    const nonCtcImpact = nonCtcP * 0.15 * liveBaseECL;
                    const totalUplift = modImpact + nonCtcImpact;

                    return (
                      <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                        {/* Section header */}
                        <button
                          onClick={() => setJurisdictionOpen((o) => !o)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.875rem",
                            background: jurisdictionOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                            border: "none", cursor: "pointer",
                            borderBottom: jurisdictionOpen ? "1px solid #E2E8F0" : "none",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Jurisdiction Risk
                            </span>
                            {isActive ? (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                Mod {(modPct * 100).toFixed(0)}%
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>None (CTC Gold baseline)</span>
                            )}
                          </div>
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: jurisdictionOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
                          >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {/* Collapsible body */}
                        <AnimatePresence initial={false}>
                          {jurisdictionOpen && (
                            <motion.div
                              key="jurisdiction-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0.875rem" }}>
                                {/* CTC Gold slider */}
                                <SliderRow
                                  label="CTC Gold"
                                  min={0} max={1} step={0.05}
                                  value={goldPct}
                                  onChange={(v) => updateFormInputs({ ctcGoldPct: v })}
                                  fmt={(v) => `${(v * 100).toFixed(0)}%`}
                                />

                                {/* Non-CTC slider — clamped so gold + nonCtc ≤ 1 */}
                                <SliderRow
                                  label="Non-CTC"
                                  min={0} max={1} step={0.05}
                                  value={nonCtcP}
                                  onChange={(v) =>
                                    updateFormInputs({
                                      nonCtcPct: Math.min(v, Math.max(0, 1 - goldPct)),
                                    })
                                  }
                                  fmt={(v) => `${(v * 100).toFixed(0)}%`}
                                />

                                {/* Derived CTC Moderate read-only label */}
                                <div style={{ fontSize: "0.8125rem", color: "#B45309", fontWeight: 500, marginBottom: "0.75rem" }}>
                                  CTC Moderate: {(modPct * 100).toFixed(0)}%
                                </div>

                                {/* "From portfolio" button */}
                                <button
                                  onClick={() =>
                                    updateFormInputs({
                                      ctcGoldPct: portfolioJurisdictionMix.ctcGoldPct,
                                      nonCtcPct:  portfolioJurisdictionMix.nonCtcPct,
                                    })
                                  }
                                  title="Computed from your portfolio's lessee country mix, weighted by monthly rental."
                                  style={{
                                    display: "flex", alignItems: "center", gap: "0.375rem",
                                    background: "transparent", color: "#475569",
                                    border: "1px solid #E2E8F0", borderRadius: "9999px",
                                    padding: "0.375rem 0.75rem", fontSize: "0.8125rem",
                                    fontWeight: 500, cursor: "pointer", marginBottom: "0.75rem",
                                  }}
                                >
                                  From portfolio
                                </button>

                                {/* Net impact line — only when active and portfolio ECL loaded */}
                                {isActive && liveBaseECL > 0 && (
                                  <div style={{
                                    padding: "0.625rem 0.75rem",
                                    background: "#F8FAFC", borderRadius: "0.375rem",
                                    border: "1px solid #E2E8F0",
                                    fontSize: "0.75rem", color: "#475569",
                                    display: "flex", gap: "0.75rem", flexWrap: "wrap",
                                  }}>
                                    <span>
                                      CTC Moderate{" "}
                                      <span style={{ fontWeight: 700, color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                                        +${modImpact.toFixed(1)}M
                                      </span>
                                    </span>
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span>
                                      Non-CTC{" "}
                                      <span style={{ fontWeight: 700, color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                                        +${nonCtcImpact.toFixed(1)}M
                                      </span>
                                    </span>
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span>
                                      Total uplift{" "}
                                      <span style={{ fontWeight: 700, color: totalUplift > 0 ? "#B91C1C" : "#94A3B8", fontVariantNumeric: "tabular-nums" }}>
                                        +${totalUplift.toFixed(1)}M
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

### Step group F — Reset button

- [ ] **Step 4.13 — Update Reset button**

Find the Reset button handler (around line 2321):
```typescript
                        setFormInputs(ZERO_INPUTS);
                        setDslText(generateDSL(ZERO_INPUTS, customName, customMode, customPaths, customSeed));
                        setDistressOpen(false);
                        setInsolvencyOpen(false);
```

Add after `setInsolvencyOpen(false)`:
```typescript
                        setJurisdictionOpen(false);
```

### Final verification

- [ ] **Step 4.14 — TypeScript clean compile**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

- [ ] **Step 4.15 — Run full test suite**

```bash
npx vitest run 2>&1 | tail -15
```

Expected: all tests pass (prior count + 10 jurisdiction ECL tests + new jurisdictionRisk tests).

- [ ] **Step 4.16 — Start dev server and smoke-test manually**

```bash
npm run dev &
```

Open http://localhost:5173/scenarios. Check:
1. "Jurisdiction Risk" tab appears after "Insolvency Regimes" in the tab bar
2. Clicking "Jurisdiction Risk" shows KPI cards + lessee table + "Use in Custom Builder" button
3. Clicking "Use in Custom Builder" switches to "Custom Builder" tab, expands "Jurisdiction Risk" section, and sliders are pre-filled
4. In Custom Builder, "From portfolio" button fills sliders with portfolio mix
5. CTC Moderate label updates as sliders move
6. Net impact line appears when sliders are non-zero
7. Reset button collapses the Jurisdiction Risk section
8. DSL editor shows `ctc_gold_pct` / `non_ctc_pct` when sliders are non-zero
9. Pasting DSL with `ctc_gold_pct` round-trips correctly

- [ ] **Step 4.17 — Commit**

```bash
git add src/app/pages/Scenarios.tsx
git commit -m "feat(scenarios): wire Jurisdiction Risk tab and Custom Builder collapsible section"
```

---

## Task 5: Deploy

- [ ] **Step 5.1 — Push to origin/main**

```bash
git push origin main
```

Expected: Vercel deployment triggered automatically. Monitor at https://vercel.com.

- [ ] **Step 5.2 — Verify production**

Once deployed, open the production URL. Navigate to Scenarios → Jurisdiction Risk tab. Confirm KPI cards load and "Use in Custom Builder" works end-to-end.
