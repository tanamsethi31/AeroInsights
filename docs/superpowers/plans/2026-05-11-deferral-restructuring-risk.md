# Deferral & Restructuring Risk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Deferral & Restructuring Risk tab to the ECL Scenario Builder — per-lessee deferral exposure weighted by credit risk tier, named restructuring scenario presets, DSL-auditable `restructuringType` field, and preset pills in the existing Distress collapsible.

**Architecture:** Four additive changes — no new routes, no schema changes. `deferralRisk.ts` is a pure utility (mirrors `paymentBehaviour.ts`). `DeferralRiskTab.tsx` mirrors `PaymentBehaviourTab.tsx` in structure. `restructuringType` in `ScenarioInputs` is DSL metadata only — it populates the three existing deferral sliders, has no direct ECL formula effect.

**Tech Stack:** TypeScript, React 18, Vitest, inline styles only (no Tailwind/CSS modules), Framer Motion already wired in Scenarios.tsx.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/app/utils/eclCalculator.ts` | Add `restructuringType: string \| null` to ScenarioInputs + ZERO_INPUTS |
| Modify | `src/app/utils/eclCalculator.test.ts` | Test new field in ZERO_INPUTS |
| Create | `src/app/utils/deferralRisk.ts` | RESTRUCTURING_TYPES presets, DeferralRiskTier, deferralRiskTier(), computePortfolioDeferralRisk() |
| Create | `src/app/utils/deferralRisk.test.ts` | Unit tests for deferralRiskTier and computePortfolioDeferralRisk |
| Create | `src/app/components/scenarios/DeferralRiskTab.tsx` | New Scenarios tab: type picker pills, KPI cards, per-lessee table |
| Modify | `src/app/pages/Scenarios.tsx` | Wire tab, DSL, preset pills, imports, badge |

---

## Task 1: Add `restructuringType` to ScenarioInputs

**Files:**
- Modify: `src/app/utils/eclCalculator.ts`
- Modify: `src/app/utils/eclCalculator.test.ts`

- [ ] **Step 1: Add the field to ScenarioInputs and ZERO_INPUTS**

In `src/app/utils/eclCalculator.ts`, find the Payment behaviour block (currently ends at line ~41):

```typescript
  // ── Payment behaviour ─────────────────────────────────────────────────────────
  payBehaviourCoopPct: number; // 0–1: share of fleet in Cooperative tier (score ≥ 70)
  payBehaviourAdvPct: number; // 0–1: share of fleet in Adversarial tier (score < 40)
  // Derived: neutralPct = max(0, 1 − coopPct − advPct). Not stored.
  // Both default to 0 (feature inactive = neutral baseline, 0 ECL adjustment). Backward-compatible.
}
```

Replace with:

```typescript
  // ── Payment behaviour ─────────────────────────────────────────────────────────
  payBehaviourCoopPct: number; // 0–1: share of fleet in Cooperative tier (score ≥ 70)
  payBehaviourAdvPct: number; // 0–1: share of fleet in Adversarial tier (score < 40)
  // Derived: neutralPct = max(0, 1 − coopPct − advPct). Not stored.
  // Both default to 0 (feature inactive = neutral baseline, 0 ECL adjustment). Backward-compatible.

  // ── Restructuring type ────────────────────────────────────────────────────────
  restructuringType: string | null; // null = no preset selected (raw slider values).
  // DSL metadata only — ECL driven by deferralMonths, govtSupportProb, forgivenessRate.
  // Does NOT affect computeECLFromBase directly. Backward-compatible: null = pre-Sprint 14 behaviour.
}
```

In `ZERO_INPUTS`, find the end of the object (currently `payBehaviourAdvPct: 0,` is last):

```typescript
  payBehaviourCoopPct: 0,
  payBehaviourAdvPct: 0,
};
```

Replace with:

```typescript
  payBehaviourCoopPct: 0,
  payBehaviourAdvPct: 0,
  restructuringType: null,
};
```

- [ ] **Step 2: Add test for the new field**

In `src/app/utils/eclCalculator.test.ts`, find the ZERO_INPUTS describe block. It already tests `payBehaviourCoopPct` and `payBehaviourAdvPct`. Add after those:

```typescript
    it("ZERO_INPUTS.restructuringType is null (feature inactive by default)", () => {
      expect(ZERO_INPUTS.restructuringType).toBeNull();
    });
```

Also add a test that `computeECLFromBase` is unaffected by restructuringType (confirms it's metadata only). Add inside the existing `computeECLFromBase` describe block:

```typescript
    it("restructuringType does not affect ECL — it is DSL metadata only", () => {
      const withType  = computeECLFromBase(BASE_ECL, { ...ZERO_INPUTS, restructuringType: "standstill" });
      const withoutType = computeECLFromBase(BASE_ECL, { ...ZERO_INPUTS, restructuringType: null });
      expect(withType).toBe(withoutType);
    });
```

- [ ] **Step 3: Run tests to verify**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/eclCalculator.test.ts
```

Expected: all tests pass (currently ~52 tests + 2 new = ~54).

- [ ] **Step 4: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/utils/eclCalculator.ts src/app/utils/eclCalculator.test.ts && git commit -m "$(cat <<'EOF'
feat(sprint-14): add restructuringType to ScenarioInputs — DSL metadata field

null default keeps full backward-compat. No ECL formula effect.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `deferralRisk.ts` utility + tests

**Files:**
- Create: `src/app/utils/deferralRisk.ts`
- Create: `src/app/utils/deferralRisk.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/app/utils/deferralRisk.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  deferralRiskTier,
  computePortfolioDeferralRisk,
  RESTRUCTURING_TYPES,
} from "./deferralRisk";
import type { Lessee, Lease } from "../types/portfolio";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLessee(
  id: string,
  name: string,
  watchlistStatus: "green" | "amber" | "red" | null,
): Lessee {
  return {
    id, name,
    org_id: "test",
    iata_code: null,
    country: "Ireland",
    credit_rating: null,
    pd_estimate: null,
    watchlist_status: watchlistStatus,
    created_at: "2024-01-01T00:00:00Z",
  };
}

function makeLease(
  lesseeId: string,
  monthlyRental: number | null,
  stage: 1 | 2 | 3 | null,
): Lease {
  return {
    id: `ls-${lesseeId}`,
    org_id: "test",
    asset_id: `a-${lesseeId}`,
    lessee_id: lesseeId,
    start_date: "2024-01-01",
    end_date: "2030-01-01",
    monthly_rental: monthlyRental,
    currency: "USD",
    stage,
    created_at: "2024-01-01T00:00:00Z",
  };
}

// ─── deferralRiskTier ─────────────────────────────────────────────────────────

describe("deferralRiskTier", () => {
  it("stage 3 → high regardless of watchlist", () => {
    expect(deferralRiskTier(3, null)).toBe("high");
    expect(deferralRiskTier(3, "green")).toBe("high");
  });

  it("red watchlist → high regardless of stage", () => {
    expect(deferralRiskTier(1, "red")).toBe("high");
    expect(deferralRiskTier(2, "red")).toBe("high");
  });

  it("stage 2, non-red watchlist → medium", () => {
    expect(deferralRiskTier(2, null)).toBe("medium");
    expect(deferralRiskTier(2, "green")).toBe("medium");
  });

  it("amber watchlist, stage 1 → medium", () => {
    expect(deferralRiskTier(1, "amber")).toBe("medium");
  });

  it("stage 1, null watchlist → low", () => {
    expect(deferralRiskTier(1, null)).toBe("low");
  });

  it("stage 1, green watchlist → low", () => {
    expect(deferralRiskTier(1, "green")).toBe("low");
  });
});

// ─── RESTRUCTURING_TYPES ──────────────────────────────────────────────────────

describe("RESTRUCTURING_TYPES", () => {
  it("has exactly 4 entries", () => {
    expect(Object.keys(RESTRUCTURING_TYPES)).toHaveLength(4);
  });

  it("standstill has forgivenessRate=0 (IFRS 9: no ECL impact)", () => {
    expect(RESTRUCTURING_TYPES.standstill.forgivenessRate).toBe(0);
    expect(RESTRUCTURING_TYPES.standstill.deferralMonths).toBe(6);
  });

  it("full_forgiveness has forgivenessRate=1 and govtSupportProb=0", () => {
    expect(RESTRUCTURING_TYPES.full_forgiveness.forgivenessRate).toBe(1.00);
    expect(RESTRUCTURING_TYPES.full_forgiveness.govtSupportProb).toBe(0);
    expect(RESTRUCTURING_TYPES.full_forgiveness.deferralMonths).toBe(24);
  });

  it("equity_debt_swap has deferralMonths=18, govtSupportProb=0.30, forgivenessRate=0.60", () => {
    const p = RESTRUCTURING_TYPES.equity_debt_swap;
    expect(p.deferralMonths).toBe(18);
    expect(p.govtSupportProb).toBe(0.30);
    expect(p.forgivenessRate).toBe(0.60);
  });
});

// ─── computePortfolioDeferralRisk ─────────────────────────────────────────────

describe("computePortfolioDeferralRisk", () => {
  it("empty lessees → zero totals, empty rows", () => {
    const result = computePortfolioDeferralRisk([], [], 12, 0.2, 0.35);
    expect(result.rows).toHaveLength(0);
    expect(result.totalDeferredM).toBe(0);
    expect(result.expectedWriteOffM).toBe(0);
    expect(result.govtBufferM).toBe(0);
  });

  it("lessee with null monthly_rental is excluded", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l1", null, 1)];
    const result  = computePortfolioDeferralRisk(lessees, leases, 12, 0.2, 0.35);
    expect(result.rows).toHaveLength(0);
  });

  it("lessee with no matching lease is excluded", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l2", 1_000_000, 1)];
    const result  = computePortfolioDeferralRisk(lessees, leases, 12, 0.2, 0.35);
    expect(result.rows).toHaveLength(0);
  });

  it("null lease.stage defaults to 1 → low risk tier", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l1", 1_000_000, null)];
    const result  = computePortfolioDeferralRisk(lessees, leases, 6, 0, 0);
    expect(result.rows[0].stage).toBe(1);
    expect(result.rows[0].riskTier).toBe("low");
  });

  it("standstill preset (forgivenessRate=0) → expectedWriteOffM=0 and govtBufferM=0", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l1", 1_000_000, 1)];
    const { deferralMonths, govtSupportProb, forgivenessRate } = RESTRUCTURING_TYPES.standstill;
    const result = computePortfolioDeferralRisk(lessees, leases, deferralMonths, govtSupportProb, forgivenessRate);
    expect(result.expectedWriteOffM).toBe(0);
    expect(result.govtBufferM).toBe(0);
    expect(result.totalDeferredM).toBeGreaterThan(0); // exposure still tracked
  });

  it("deferredExposureM = monthlyRentalM × deferralMonths", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l1", 2_000_000, 1)]; // $2M/mo
    const result  = computePortfolioDeferralRisk(lessees, leases, 12, 0, 0.5);
    expect(result.rows[0].monthlyRentalM).toBeCloseTo(2.0, 5);
    expect(result.rows[0].deferredExposureM).toBeCloseTo(24.0, 5);
  });

  it("totalDeferredM and expectedWriteOffM use correct formulas", () => {
    const lessees = [makeLessee("l1", "Air X", null)];
    const leases  = [makeLease("l1", 1_000_000, 1)]; // $1M/mo
    // deferralMonths=12 → totalDeferred=$12M; writeOff=12 × (1−0.2) × 0.35=3.36
    const result = computePortfolioDeferralRisk(lessees, leases, 12, 0.2, 0.35);
    expect(result.totalDeferredM).toBeCloseTo(12.0, 5);
    expect(result.expectedWriteOffM).toBeCloseTo(3.36, 4);
    expect(result.govtBufferM).toBeCloseTo(12 * 0.2 * 0.35, 5); // 0.84
  });

  it("rows sorted: high tier first, monthly rental descending within tier", () => {
    const lessees = [
      makeLessee("l1", "Low Air",  null),    // low tier, $1M
      makeLessee("l2", "High Air", "red"),   // high tier, $2M
      makeLessee("l3", "Med Air",  "amber"), // medium tier, $3M
      makeLessee("l4", "High2",   null),     // stage 3 → high, $0.5M
    ];
    const leases = [
      makeLease("l1", 1_000_000, 1),
      makeLease("l2", 2_000_000, 1),
      makeLease("l3", 3_000_000, 1),
      makeLease("l4", 500_000, 3),
    ];
    const result = computePortfolioDeferralRisk(lessees, leases, 12, 0.2, 0.35);
    expect(result.rows[0].riskTier).toBe("high");
    expect(result.rows[0].lesseeName).toBe("High Air"); // $2M > $0.5M
    expect(result.rows[1].riskTier).toBe("high");
    expect(result.rows[1].lesseeName).toBe("High2");
    expect(result.rows[2].riskTier).toBe("medium");
    expect(result.rows[3].riskTier).toBe("low");
  });

  it("rentalSharePct sums to 1.0 across all rows", () => {
    const lessees = [
      makeLessee("l1", "A", null),
      makeLessee("l2", "B", null),
    ];
    const leases = [makeLease("l1", 600_000, 1), makeLease("l2", 400_000, 1)];
    const result = computePortfolioDeferralRisk(lessees, leases, 6, 0.1, 0.35);
    const total = result.rows.reduce((s, r) => s + r.rentalSharePct, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (module not found)**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/deferralRisk.test.ts 2>&1 | head -20
```

Expected: FAIL with "Cannot find module './deferralRisk'".

- [ ] **Step 3: Create `src/app/utils/deferralRisk.ts`**

```typescript
// src/app/utils/deferralRisk.ts
// Pure-function utilities for restructuring scenario presets and deferral risk tier computation.
// No React dependencies — safe to use in both components and tests.

import type { Lessee, Lease } from "../types/portfolio";

// ─── Restructuring presets ─────────────────────────────────────────────────────

export interface RestructuringPreset {
  label:           string;
  deferralMonths:  number;
  govtSupportProb: number;
  forgivenessRate: number;
  description:     string;
}

/**
 * Named restructuring scenario presets. Each preset maps to three existing deferral
 * slider values. Selecting a preset populates those sliders — it has no direct ECL
 * formula effect beyond what those sliders already produce.
 *
 * Standstill: forgivenessRate=0 → $0 deferral ECL (IFRS 9 excludes TVM modification loss).
 */
export const RESTRUCTURING_TYPES: Record<string, RestructuringPreset> = {
  standstill: {
    label:           "Standstill Agreement",
    deferralMonths:  6,
    govtSupportProb: 0.10,
    forgivenessRate: 0.00,
    description:     "Temporary payment halt while restructuring is negotiated. Full repayment expected — forgivenessRate=0 → $0 deferral ECL (IFRS 9 excludes TVM modification loss).",
  },
  rent_reduction: {
    label:           "Rent Reduction",
    deferralMonths:  12,
    govtSupportProb: 0.20,
    forgivenessRate: 0.35,
    description:     "Permanent partial rent write-down agreed with lessee. 35% of deferred rent forgiven after 20% govt backstop.",
  },
  equity_debt_swap: {
    label:           "Equity-for-Debt",
    deferralMonths:  18,
    govtSupportProb: 0.30,
    forgivenessRate: 0.60,
    description:     "Deferred rent converted to diluted airline equity stake. Lessor recovers equity value at significant discount; 60% treated as write-off.",
  },
  full_forgiveness: {
    label:           "Full Write-off",
    deferralMonths:  24,
    govtSupportProb: 0.00,
    forgivenessRate: 1.00,
    description:     "Complete loss crystallisation. All deferred rent permanently written off. No govt backstop assumed.",
  },
};

// ─── Deferral risk tier ────────────────────────────────────────────────────────

export type DeferralRiskTier = "high" | "medium" | "low";

export interface DeferralRiskRow {
  lesseeName:        string;
  stage:             number;              // 1 | 2 | 3 (defaults to 1 if null)
  watchlistStatus:   "green" | "amber" | "red" | null;
  riskTier:          DeferralRiskTier;
  monthlyRentalM:    number;             // $M
  deferredExposureM: number;             // monthlyRentalM × deferralMonths
  expectedLossM:     number;             // deferredExposureM × (1 − govtSupportProb) × forgivenessRate
  rentalSharePct:    number;             // 0–1 share of total fleet monthly rent
}

/**
 * Classify a lessee's deferral risk tier from IFRS 9 stage and watchlist status.
 * Worst signal wins:
 *   stage=3 OR red watchlist → high
 *   stage=2 OR amber watchlist → medium
 *   otherwise (stage 1, green or null watchlist) → low
 */
export function deferralRiskTier(
  stage: number,
  watchlistStatus: "green" | "amber" | "red" | null,
): DeferralRiskTier {
  if (stage === 3 || watchlistStatus === "red") return "high";
  if (stage === 2 || watchlistStatus === "amber") return "medium";
  return "low";
}

// ─── Portfolio computation ────────────────────────────────────────────────────

/**
 * Compute per-lessee deferral exposure for a given set of restructuring parameters.
 *
 * - Lessees with no matching lease or null/zero monthly_rental are excluded.
 * - lease.stage defaults to 1 if null.
 * - totalDeferredM = sum(monthlyRentalM × deferralMonths) across included lessees.
 * - expectedWriteOffM = totalDeferredM × (1 − govtSupportProb) × forgivenessRate
 * - govtBufferM = totalDeferredM × govtSupportProb × forgivenessRate
 * - Rows sorted: high risk first → medium → low; within same tier, monthly rental descending.
 */
export function computePortfolioDeferralRisk(
  lessees:         Lessee[],
  leases:          Lease[],
  deferralMonths:  number,
  govtSupportProb: number,
  forgivenessRate: number,
): {
  rows:              DeferralRiskRow[];
  totalDeferredM:    number;
  expectedWriteOffM: number;
  govtBufferM:       number;
} {
  const empty = { rows: [], totalDeferredM: 0, expectedWriteOffM: 0, govtBufferM: 0 };
  if (lessees.length === 0 || leases.length === 0) return empty;

  // Build lessee_id → first matching lease with positive rental
  const leaseByLessee = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByLessee.has(lease.lessee_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByLessee.set(lease.lessee_id, lease);
    }
  }

  let totalRental = 0;
  const rawRows: DeferralRiskRow[] = [];

  for (const lessee of lessees) {
    const lease = leaseByLessee.get(lessee.id);
    if (!lease || !lease.monthly_rental) continue;

    const stage             = lease.stage ?? 1;
    const watchlistStatus   = lessee.watchlist_status;
    const rental            = lease.monthly_rental;
    const monthlyRentalM    = rental / 1_000_000;
    const deferredExposureM = monthlyRentalM * deferralMonths;
    const expectedLossM     = deferredExposureM * (1 - govtSupportProb) * forgivenessRate;

    rawRows.push({
      lesseeName: lessee.name,
      stage,
      watchlistStatus,
      riskTier:          deferralRiskTier(stage, watchlistStatus),
      monthlyRentalM,
      deferredExposureM,
      expectedLossM,
      rentalSharePct: 0, // filled in second pass
    });
    totalRental += rental;
  }

  if (rawRows.length === 0) return empty;

  // Second pass: rental share weights
  for (const row of rawRows) {
    row.rentalSharePct = (row.monthlyRentalM * 1_000_000) / totalRental;
  }

  // Sort: high → medium → low, then monthly rental descending within tier
  const TIER_ORDER: Record<DeferralRiskTier, number> = { high: 0, medium: 1, low: 2 };
  rawRows.sort(
    (a, b) =>
      TIER_ORDER[a.riskTier] - TIER_ORDER[b.riskTier] ||
      b.monthlyRentalM - a.monthlyRentalM,
  );

  const totalDeferredM    = rawRows.reduce((s, r) => s + r.deferredExposureM, 0);
  const expectedWriteOffM = totalDeferredM * (1 - govtSupportProb) * forgivenessRate;
  const govtBufferM       = totalDeferredM * govtSupportProb * forgivenessRate;

  return { rows: rawRows, totalDeferredM, expectedWriteOffM, govtBufferM };
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/deferralRisk.test.ts
```

Expected: 20 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/utils/deferralRisk.ts src/app/utils/deferralRisk.test.ts && git commit -m "$(cat <<'EOF'
feat(sprint-14): add deferralRisk utility — RESTRUCTURING_TYPES, deferralRiskTier, computePortfolioDeferralRisk

20 tests. Mirrors paymentBehaviour.ts pattern.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `DeferralRiskTab.tsx`

**Files:**
- Create: `src/app/components/scenarios/DeferralRiskTab.tsx`

No separate test file — mirrors PaymentBehaviourTab.tsx convention (UI component tested via integration).

- [ ] **Step 1: Create `src/app/components/scenarios/DeferralRiskTab.tsx`**

```typescript
// src/app/components/scenarios/DeferralRiskTab.tsx
import { useState } from "react";
import { usePortfolioData } from "../../hooks/usePortfolioData";
import {
  RESTRUCTURING_TYPES,
  computePortfolioDeferralRisk,
  type DeferralRiskTier,
} from "../../utils/deferralRisk";
import { Card } from "../ui/Card";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<DeferralRiskTier, string> = {
  high:   "High",
  medium: "Medium",
  low:    "Low",
};

const TIER_PILL_BG: Record<DeferralRiskTier, string> = {
  high:   "#FEE2E2",
  medium: "#FEF3C7",
  low:    "#DCFCE7",
};

const TIER_PILL_COLOR: Record<DeferralRiskTier, string> = {
  high:   "#B91C1C",
  medium: "#B45309",
  low:    "#15803D",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, color, bg, note,
}: {
  label: string; value: string; color: string; bg: string; note?: string;
}) {
  return (
    <div style={{ background: bg, borderRadius: "0.5rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.375rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {note && (
        <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{note}</div>
      )}
    </div>
  );
}

function RiskTierPill({ tier }: { tier: DeferralRiskTier }) {
  return (
    <span style={{
      background:   TIER_PILL_BG[tier],
      color:        TIER_PILL_COLOR[tier],
      fontWeight:   600,
      fontSize:     "0.75rem",
      padding:      "0.15rem 0.5rem",
      borderRadius: "9999px",
      whiteSpace:   "nowrap",
    }}>
      {TIER_LABEL[tier]}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onUseInCustomBuilder: (
    restructuringType: string,
    deferralMonths:    number,
    govtSupportProb:   number,
    forgivenessRate:   number,
  ) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DeferralRiskTab({ onUseInCustomBuilder }: Props) {
  const { lessees, leases } = usePortfolioData();
  const [selectedType, setSelectedType] = useState<string>("standstill");

  const preset = RESTRUCTURING_TYPES[selectedType];
  const { rows, totalDeferredM, expectedWriteOffM, govtBufferM } =
    computePortfolioDeferralRisk(
      lessees, leases,
      preset.deferralMonths, preset.govtSupportProb, preset.forgivenessRate,
    );

  const isStandstill = preset.forgivenessRate === 0;

  // Expected write-off colour: red >$5M, amber >$2M, green otherwise
  const writeOffColor = expectedWriteOffM > 5 ? "#B91C1C" : expectedWriteOffM > 2 ? "#B45309" : "#15803D";
  const writeOffBg    = expectedWriteOffM > 5 ? "#FEE2E2" : expectedWriteOffM > 2 ? "#FEF3C7" : "#DCFCE7";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Type picker pills ── */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {Object.entries(RESTRUCTURING_TYPES).map(([key, p]) => (
          <button
            key={key}
            onClick={() => setSelectedType(key)}
            style={{
              padding:      "0.375rem 0.875rem",
              fontSize:     "0.8125rem",
              fontWeight:   600,
              borderRadius: "9999px",
              border:       selectedType === key ? "none" : "1px solid #E2E8F0",
              background:   selectedType === key ? "#002147" : "#FFFFFF",
              color:        selectedType === key ? "#FFFFFF" : "#475569",
              cursor:       "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Scenario description ── */}
      <div style={{
        fontSize: "0.8125rem", color: "#64748B",
        padding: "0.75rem", background: "#F8FAFC",
        borderRadius: "0.5rem", border: "1px solid #F1F5F9",
      }}>
        {preset.description}
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Total Deferred Exposure"
          value={rows.length === 0 ? "—" : `$${totalDeferredM.toFixed(1)}M`}
          color="#475569"
          bg="#F8FAFC"
        />
        <KpiCard
          label="Expected Write-off"
          value={rows.length === 0 ? "—" : `$${expectedWriteOffM.toFixed(2)}M`}
          color={isStandstill ? "#64748B" : writeOffColor}
          bg={isStandstill ? "#F8FAFC" : writeOffBg}
          note={isStandstill ? "No ECL impact" : undefined}
        />
        <KpiCard
          label="Govt Support Buffer"
          value={rows.length === 0 ? "—" : `$${govtBufferM.toFixed(2)}M`}
          color="#15803D"
          bg="#DCFCE7"
        />
      </div>

      {/* ── Per-lessee breakdown table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Per-Lessee Deferral Exposure
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
                    {["Airline", "Stage", "Risk Tier", "Monthly Rent", "Deferred Exposure", "Expected Loss"].map((h) => (
                      <th key={h} style={{
                        textAlign:      h === "Airline" ? "left" : "right",
                        padding:        "0.5rem 0.75rem",
                        fontWeight:     600,
                        color:          "#64748B",
                        fontSize:       "0.75rem",
                        textTransform:  "uppercase",
                        letterSpacing:  "0.04em",
                        whiteSpace:     "nowrap",
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
                        background:   i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                      }}
                    >
                      <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>
                        {row.lesseeName}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569" }}>
                        {row.stage}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <RiskTierPill tier={row.riskTier} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        ${(row.monthlyRentalM * 1000).toFixed(0)}k
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        ${row.deferredExposureM.toFixed(2)}M
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        ${row.expectedLossM.toFixed(2)}M
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Use in Custom Builder CTA */}
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => onUseInCustomBuilder(
                selectedType,
                preset.deferralMonths,
                preset.govtSupportProb,
                preset.forgivenessRate,
              )}
              disabled={rows.length === 0}
              style={{
                padding:      "0.5rem 1rem",
                fontSize:     "0.8125rem",
                fontWeight:   600,
                background:   rows.length === 0 ? "#F1F5F9" : "#002147",
                color:        rows.length === 0 ? "#94A3B8" : "#FFFFFF",
                border:       "none",
                borderRadius: "0.375rem",
                cursor:       rows.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Use in Custom Builder
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep "DeferralRisk"
```

Expected: no output (no errors in that file).

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/scenarios/DeferralRiskTab.tsx && git commit -m "$(cat <<'EOF'
feat(sprint-14): add DeferralRiskTab — type picker, KPI cards, per-lessee table

Type picker pills / description / KPI cards (total deferred, write-off, govt buffer)
/ per-lessee breakdown sorted by risk tier / Use in Custom Builder CTA.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire `Scenarios.tsx`

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

This is the largest task. Eight distinct edits — apply in order, top to bottom by line number, so earlier edits don't shift line numbers for later ones. Exception: Step 8 (tab render) is at the bottom of the file and is independent.

- [ ] **Step 1: Add imports (top of file, after existing imports)**

After line 15 (`import { computePortfolioPaymentBehaviourMix } from "../utils/paymentBehaviour";`), add:

```typescript
import { DeferralRiskTab } from "../components/scenarios/DeferralRiskTab";
import { RESTRUCTURING_TYPES } from "../utils/deferralRisk";
```

- [ ] **Step 2: Update 6 single-line templates**

Six scenario templates end with `payBehaviourAdvPct: 0 }` (lines 253, 268, 283, 298, 313, 328). Each is one long line. Change the ending on each:

Old: `, payBehaviourAdvPct: 0 },`
New: `, payBehaviourAdvPct: 0, restructuringType: null },`

Do this for all 6 occurrences. Use replace_all=true with exact string:

Old string: `, payBehaviourAdvPct: 0 },`
New string: `, payBehaviourAdvPct: 0, restructuringType: null },`

- [ ] **Step 3: Update 9 multi-line templates**

Nine templates have `payBehaviourAdvPct: 0,` as their last field before the closing `},`. Add `restructuringType: null,` after each one.

Old pattern (appears 9 times):
```typescript
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
    },
```

New pattern:
```typescript
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
      restructuringType: null,
    },
```

Use replace_all=true to update all 9 at once.

- [ ] **Step 4: Update tab list (line ~1153)**

Old:
```typescript
    : ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Security Deposits", "Payment Behaviour", "Lease Pricing"];
```

New:
```typescript
    : ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Security Deposits", "Deferral Risk", "Payment Behaviour", "Lease Pricing"];
```

- [ ] **Step 5: Update `hasDistress` auto-expand logic (line ~1039)**

Old:
```typescript
    const hasDistress =
      next.deferralMonths !== 0 || next.govtSupportProb !== 0 ||
      next.forgivenessRate !== 0 || next.pbhConversionPct !== 0 ||
      next.etpRate !== 0 || next.lecRate !== 0;
```

New:
```typescript
    const hasDistress =
      next.deferralMonths !== 0 || next.govtSupportProb !== 0 ||
      next.forgivenessRate !== 0 || next.pbhConversionPct !== 0 ||
      next.etpRate !== 0 || next.lecRate !== 0 || next.restructuringType !== null;
```

- [ ] **Step 6: Update `generateDSL` — add `restructuring_type` to DSL output**

After the closing brace of the `payment behaviour` spread block (currently line ~673), and before `},` that closes the shocks object — actually `restructuring_type` goes at the ROOT level like `bankruptcy_scenario_type`. Find the line:

```typescript
      bankruptcy_scenario_type: inputs.bankruptcyScenarioType,
```

Replace with:

```typescript
      bankruptcy_scenario_type: inputs.bankruptcyScenarioType,
      // Restructuring type — omitted from DSL when null (no preset selected)
      ...(inputs.restructuringType !== null
        ? { restructuring_type: inputs.restructuringType }
        : {}),
```

- [ ] **Step 7: Update `parseDSL` — parse `restructuring_type`**

After the closing of `payBehaviourAdvPct` parsing (currently ends at `})(),`), before the closing `},` of the inputs object, add:

Find:
```typescript
        payBehaviourAdvPct: (() => {
          const coop = typeof s.pay_behaviour_coop_pct === "number" ? Math.min(1, Math.max(0, s.pay_behaviour_coop_pct)) : 0;
          const raw  = typeof s.pay_behaviour_adv_pct  === "number" ? Math.min(1, Math.max(0, s.pay_behaviour_adv_pct))  : 0;
          return Math.min(raw, Math.max(0, 1 - coop));
        })(),
      },
```

Replace with:
```typescript
        payBehaviourAdvPct: (() => {
          const coop = typeof s.pay_behaviour_coop_pct === "number" ? Math.min(1, Math.max(0, s.pay_behaviour_coop_pct)) : 0;
          const raw  = typeof s.pay_behaviour_adv_pct  === "number" ? Math.min(1, Math.max(0, s.pay_behaviour_adv_pct))  : 0;
          return Math.min(raw, Math.max(0, 1 - coop));
        })(),
        restructuringType: typeof parsed.restructuring_type === "string" && parsed.restructuring_type in RESTRUCTURING_TYPES
          ? parsed.restructuring_type
          : null,
      },
```

- [ ] **Step 8: Add preset pills to Distress body (before "Deferral & Forgiveness" sub-group label)**

Find the sub-group label at line ~2200:

```typescript
                              <div style={{ padding: "0.875rem" }}>
                                {/* Sub-group: Deferral & Forgiveness */}
                                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                                  Deferral &amp; Forgiveness
                                </div>
```

Replace with:

```typescript
                              <div style={{ padding: "0.875rem" }}>
                                {/* Quick preset pills */}
                                <div style={{ marginBottom: "0.875rem" }}>
                                  <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                                    Quick preset
                                  </div>
                                  <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                                    {Object.entries(RESTRUCTURING_TYPES).map(([key, preset]) => (
                                      <button
                                        key={key}
                                        onClick={() => updateFormInputs({
                                          restructuringType: key,
                                          deferralMonths:    preset.deferralMonths,
                                          govtSupportProb:   preset.govtSupportProb,
                                          forgivenessRate:   preset.forgivenessRate,
                                        })}
                                        style={{
                                          padding:      "0.25rem 0.625rem",
                                          fontSize:     "0.75rem",
                                          fontWeight:   600,
                                          borderRadius: "9999px",
                                          border:       formInputs.restructuringType === key ? "none" : "1px solid #E2E8F0",
                                          background:   formInputs.restructuringType === key ? "#002147" : "#FFFFFF",
                                          color:        formInputs.restructuringType === key ? "#FFFFFF" : "#475569",
                                          cursor:       "pointer",
                                        }}
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                    <button
                                      onClick={() => updateFormInputs({ restructuringType: null, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0 })}
                                      style={{
                                        padding:      "0.25rem 0.625rem",
                                        fontSize:     "0.75rem",
                                        fontWeight:   500,
                                        borderRadius: "9999px",
                                        border:       "1px solid #E2E8F0",
                                        background:   "#FFFFFF",
                                        color:        "#94A3B8",
                                        cursor:       "pointer",
                                      }}
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>

                                {/* Sub-group: Deferral & Forgiveness */}
                                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                                  Deferral &amp; Forgiveness
                                </div>
```

- [ ] **Step 9: Update Distress badge to show restructuringType label**

Find the active levers badge (line ~2171):

```typescript
                            {activeLevers > 0 && (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                {activeLevers} active levers
                              </span>
                            )}
```

Replace with:

```typescript
                            {activeLevers > 0 && (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                {formInputs.restructuringType !== null
                                  ? `${RESTRUCTURING_TYPES[formInputs.restructuringType].label} · ${activeLevers} lever${activeLevers !== 1 ? "s" : ""}`
                                  : `${activeLevers} active levers`}
                              </span>
                            )}
```

- [ ] **Step 10: Add Deferral Risk tab render block**

Find the Payment Behaviour tab render (line ~3193):

```typescript
      {/* ══ PAYMENT BEHAVIOUR TAB ═══════════════════════════════════════ */}
      {activeTab === "Payment Behaviour" && (
```

Insert above it:

```typescript
      {/* ══ DEFERRAL RISK TAB ════════════════════════════════════════════ */}
      {activeTab === "Deferral Risk" && (
        <DeferralRiskTab
          onUseInCustomBuilder={(type, months, govtProb, forgiveness) => {
            setActiveTab("Custom Builder");
            updateFormInputs({
              restructuringType: type,
              deferralMonths:    months,
              govtSupportProb:   govtProb,
              forgivenessRate:   forgiveness,
            });
          }}
        />
      )}

```

- [ ] **Step 11: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 12: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Scenarios.tsx && git commit -m "$(cat <<'EOF'
feat(sprint-14): wire DeferralRiskTab — templates, DSL, tab, preset pills, badge

- 15 templates + ZERO_INPUTS get restructuringType: null
- generateDSL emits restructuring_type when non-null
- parseDSL validates against RESTRUCTURING_TYPES keys
- "Deferral Risk" tab inserted between Security Deposits and Payment Behaviour
- Quick preset pill row in Distress & Mitigation body
- Distress badge shows preset label when restructuringType is set

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Full test run + deploy

**Files:**
- No file changes — verify and push.

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -20
```

Expected: all tests pass. Previous count was 163 tests; with Task 1 (+2) and Task 2 (+20) the total should be ~185.

If any test fails, read the error output carefully and fix before proceeding.

- [ ] **Step 2: Push to origin/main**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git push origin main
```

Expected: successful push. Verify commits for Tasks 1–4 appear in `git log --oneline -5`.

- [ ] **Step 3: Confirm deploy**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git log --oneline -5
```

Report the 4 new commit SHAs to confirm all changes landed.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| `restructuringType: string \| null` in ScenarioInputs | Task 1 |
| `restructuringType: null` in ZERO_INPUTS | Task 1 |
| `RESTRUCTURING_TYPES` with 4 presets (standstill/rent_reduction/equity_debt_swap/full_forgiveness) | Task 2 |
| `DeferralRiskTier = "high" \| "medium" \| "low"` | Task 2 |
| `deferralRiskTier()` — worst signal wins (stage vs watchlist) | Task 2 |
| `computePortfolioDeferralRisk()` — returns rows, totalDeferredM, expectedWriteOffM, govtBufferM | Task 2 |
| Per-lessee deferred exposure = monthlyRental × deferralMonths | Task 2 |
| Per-lessee expectedLoss = deferred × (1−govtSupportProb) × forgivenessRate | Task 2 |
| Sort: high → medium → low, then rental descending | Task 2 |
| "Deferral Risk" tab positioned between Security Deposits and Payment Behaviour | Task 4, Step 4 |
| Type picker pills (4 types, dark navy active) | Task 3 |
| Scenario description below pill row | Task 3 |
| KPI cards: Total Deferred / Expected Write-off / Govt Support Buffer | Task 3 |
| Standstill: Expected Write-off shows $0.00M with "No ECL impact" note | Task 3 |
| Per-lessee table: Airline / Stage / Risk Tier / Monthly Rent / Deferred Exposure / Expected Loss | Task 3 |
| Risk Tier as colour-coded pill (red/amber/green) | Task 3 |
| "Use in Custom Builder" CTA — switches tab, sets restructuringType + 3 deferral fields | Task 3 + Task 4, Step 10 |
| DSL: `restructuring_type` key emitted when non-null, omitted when null | Task 4, Step 6 |
| parseDSL: `restructuring_type` validated against RESTRUCTURING_TYPES keys, fallback to null | Task 4, Step 7 |
| Quick preset pill row in Distress & Mitigation body (above Deferral & Forgiveness label) | Task 4, Step 8 |
| Clear button: restructuringType=null + all 3 deferral fields → 0 | Task 4, Step 8 |
| Active preset highlighted in preset pills | Task 4, Step 8 |
| Distress badge: when restructuringType non-null AND levers>0, show `{label} · {n} levers` | Task 4, Step 9 |
| Auto-expand Distress section when restructuringType is non-null | Task 4, Step 5 |
| 15 explicit templates + ZERO_INPUTS get restructuringType: null | Task 4, Steps 2–3 |

**Placeholder scan:** No TBDs, no "implement later", no vague steps. Every step has complete code.

**Type consistency:** `DeferralRiskRow.riskTier` is `DeferralRiskTier` throughout. `RESTRUCTURING_TYPES` keys used consistently as `string` in `restructuringType`. `onUseInCustomBuilder` signature in `DeferralRiskTab.tsx` Props matches usage in Task 4, Step 10.
