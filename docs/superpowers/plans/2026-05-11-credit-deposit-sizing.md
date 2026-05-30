# Credit-linked Security Deposit Sizing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make security deposit sizing credit-linked — lessee watchlist tier drives recommended deposit months, portfolio deposit total auto-computes an ECL benefit, overridable in the Custom Builder.

**Architecture:** Four additive changes: (1) `creditDeposit.ts` pure utility for tier classification and deposit computation, (2) `eclCalculator.ts` gains `depositCoverage` field + benefit term, (3) new `CreditDepositTab.tsx` Scenarios tab, (4) `SDMRTab.tsx` gets a Credit Tier pill column, (5) `Scenarios.tsx` wired end-to-end. Mirrors the Sprint 11 Jurisdiction Risk pattern exactly.

**Tech Stack:** React 18, TypeScript, Vitest, Framer Motion (AnimatePresence + motion.div), inline styles only, no new npm packages.

---

## Key design decisions (read before implementing)

### depositCoverage definition
`depositCoverage = totalDepositM / liveBaseECL` — deposits as a fraction of the ECL baseline, not fleet EAD.

Why: the slider range 0–30% maps to $0–14M deposits (on a $47.2M ECL base), which is realistic for an aviation portfolio. Using fleet EAD ($491M) would make the range 0–20% map to $0–98M, which is unrealistically large.

### ECL benefit
```
depositBenefit = depositCoverage × baseECL × 0.50
delta -= depositBenefit
```
0.50 factor: deposits are cash collateral drawn on default events (PD ≈ 50% for Stage 3 lessees who trigger draws). Per dollar held, expected ECL recovery ≈ 50 cents. Parallel to `pbhBenefit = pbhConversionPct × baseECL × 0.15`.

### Credit tier → deposit months
| Tier | Criterion | Deposit months |
|---|---|---|
| `investmentGrade` | `watchlist_status: "green"` | 0 (waived) |
| `subInvestmentGrade` | `watchlist_status: "amber"` or `null` | 1 |
| `distressed` | `watchlist_status: "red"` | 3 |

### Demo fleet calibration (pre-computed, verify in tests)
- Red (3 mo): IndiGo ($285k/mo), Aeromexico ($310k/mo) → $1,785k
- Amber (1 mo): SriLankan ($480k/mo), Azul ($295k/mo), Air Transat ($275k/mo) → $1,050k
- Green (0 mo): Emirates, Ryanair, Air France, Singapore Airlines, Lufthansa → $0
- **Total deposits: $2.835M** | **depositCoverage: 2.835/47.2 ≈ 6.0%**
- **depositBenefit: 6.0% × $47.2M × 0.50 ≈ $1.42M**

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/app/utils/creditDeposit.ts` | Create | Tier classification + portfolio deposit computation |
| `src/app/utils/creditDeposit.test.ts` | Create | Tests for the utility (12 tests) |
| `src/app/utils/eclCalculator.ts` | Modify | Add `depositCoverage` to `ScenarioInputs` + `depositBenefit` to formula |
| `src/app/utils/eclCalculator.test.ts` | Modify | Add deposit benefit test suite |
| `src/app/components/scenarios/CreditDepositTab.tsx` | Create | New Scenarios tab: KPI cards, lessee table, CTA |
| `src/app/components/portfolio/SDMRTab.tsx` | Modify | Add `creditTier?` to `LeaseSDMR`, extend `PALessee`, add tier pill column |
| `src/app/pages/Scenarios.tsx` | Modify | Wire tab, DSL, Custom Builder section, state, reset |

---

## Task 1: ECL calculator — add `depositCoverage` field and benefit term

**Files:**
- Modify: `src/app/utils/eclCalculator.ts`
- Modify: `src/app/utils/eclCalculator.test.ts`

### Context

Current `ScenarioInputs` ends with:
```typescript
// ── Jurisdiction risk ─────────────────────────────────────────────────────────
ctcGoldPct: number;
nonCtcPct: number;
```

`ZERO_INPUTS` ends with:
```typescript
ctcGoldPct: 0,
nonCtcPct: 0,
```

`computeECLFromBase` has at the bottom of its body:
```typescript
const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit + lgdDelta + jurisdictionLGDDelta;
return Math.max(baseECL * 0.3, baseECL + delta);
```

---

- [ ] **Step 1: Write the failing tests**

Add a new describe block at the bottom of `src/app/utils/eclCalculator.test.ts`:

```typescript
describe("security deposit benefit", () => {
  it("ZERO_INPUTS has depositCoverage as 0", () => {
    expect(ZERO_INPUTS.depositCoverage).toBe(0);
  });

  it("depositCoverage = 0 → no benefit, backward-compatible with ZERO_INPUTS", () => {
    expect(computeECLFromBase(47.2, ZERO_INPUTS)).toBeCloseTo(47.2, 5);
  });

  it("depositCoverage = 0.10 → reduces ECL by 5% of baseECL (factor 0.50)", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, depositCoverage: 0.10 });
    expect(result).toBeCloseTo(47.2 * (1 - 0.10 * 0.50), 4);
  });

  it("depositCoverage = 1.0 → reduces ECL by 50% of baseECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, depositCoverage: 1.0 });
    expect(result).toBeCloseTo(47.2 * 0.50, 4);
  });

  it("deposit benefit stacks with macro stress (additive delta)", () => {
    const noDeposit = computeECLFromBase(47.2, { ...ZERO_INPUTS, rpkDelta: -0.25 });
    const withDeposit = computeECLFromBase(47.2, { ...ZERO_INPUTS, rpkDelta: -0.25, depositCoverage: 0.10 });
    expect(withDeposit).toBeLessThan(noDeposit);
    expect(withDeposit).toBeCloseTo(noDeposit - 47.2 * 0.10 * 0.50, 4);
  });

  it("floor still holds under max deposit coverage + no stress", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, depositCoverage: 0.90 });
    expect(result).toBeGreaterThanOrEqual(47.2 * 0.3 - 0.001);
  });
});
```

Also add to the existing `"distress inputs"` test `"ZERO_INPUTS still has all new fields at 0"`:
```typescript
expect(ZERO_INPUTS.depositCoverage).toBe(0);
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/utils/eclCalculator.test.ts
```

Expected: several failures referencing `depositCoverage` property does not exist / is undefined.

- [ ] **Step 3: Implement in `eclCalculator.ts`**

Add to `ScenarioInputs` after the jurisdiction risk section:
```typescript
// ── Security deposits ─────────────────────────────────────────────────────────
depositCoverage: number; // 0–1: recommended deposits as fraction of ECL baseline (0 = no deposits)
```

Add to `ZERO_INPUTS`:
```typescript
depositCoverage: 0,
```

Add to `computeECLFromBase`, after the `jurisdictionLGDDelta` block and before the `delta` line:
```typescript
// Security deposit benefit — cash collateral reduces LGD on default events.
// 0.50 factor: deposits are drawn at high-PD events; expected recovery ≈ 50 cents per dollar held.
// depositCoverage = total_deposits / ECL_baseline (not fleet EAD — see creditDeposit.ts).
const depositBenefit = inputs.depositCoverage * baseECL * 0.50;
```

Update the `delta` line to subtract `depositBenefit`:
```typescript
const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit + lgdDelta + jurisdictionLGDDelta - depositBenefit;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/utils/eclCalculator.test.ts
```

Expected: all tests pass. Total test count increases by 6.

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/eclCalculator.ts src/app/utils/eclCalculator.test.ts
git commit -m "feat(ecl): add depositCoverage field and deposit benefit to ECL calculator"
```

---

## Task 2: `creditDeposit.ts` utility + tests

**Files:**
- Create: `src/app/utils/creditDeposit.ts`
- Create: `src/app/utils/creditDeposit.test.ts`

### Context

`Lessee` type (from `src/app/types/portfolio.ts`):
```typescript
interface Lessee {
  id: string;
  name: string;
  country: string | null;
  credit_rating: string | null;
  pd_estimate: number | null;
  watchlist_status: "green" | "amber" | "red" | null;
  // ... other fields
}
```

`Lease` type has `lessee_id: string` and `monthly_rental: number | null`.

Pattern to follow: `src/app/utils/jurisdictionRisk.ts` (same structure).

---

- [ ] **Step 1: Write the failing tests**

Create `src/app/utils/creditDeposit.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  creditDepositTier,
  recommendedDepositMonths,
  computePortfolioDepositCoverage,
} from "./creditDeposit";
import type { Lessee, Lease } from "../types/portfolio";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLessee(
  id: string,
  name: string,
  watchlist: "green" | "amber" | "red" | null,
): Lessee {
  return {
    id, name,
    org_id: "test",
    iata_code: null,
    country: null,
    credit_rating: null,
    pd_estimate: null,
    watchlist_status: watchlist,
    created_at: "2024-01-01T00:00:00Z",
  };
}

function makeLease(lesseeId: string, monthlyRental: number | null): Lease {
  return {
    id: `ls-${lesseeId}`,
    org_id: "test",
    asset_id: `a-${lesseeId}`,
    lessee_id: lesseeId,
    start_date: null,
    end_date: null,
    monthly_rental: monthlyRental,
    currency: "USD",
    stage: 1,
    created_at: "2024-01-01T00:00:00Z",
  };
}

// ─── creditDepositTier ────────────────────────────────────────────────────────

describe("creditDepositTier", () => {
  it("green → investmentGrade", () => {
    expect(creditDepositTier(makeLessee("1", "X", "green"))).toBe("investmentGrade");
  });

  it("amber → subInvestmentGrade", () => {
    expect(creditDepositTier(makeLessee("1", "X", "amber"))).toBe("subInvestmentGrade");
  });

  it("red → distressed", () => {
    expect(creditDepositTier(makeLessee("1", "X", "red"))).toBe("distressed");
  });

  it("null → subInvestmentGrade (conservative default)", () => {
    expect(creditDepositTier(makeLessee("1", "X", null))).toBe("subInvestmentGrade");
  });
});

// ─── recommendedDepositMonths ─────────────────────────────────────────────────

describe("recommendedDepositMonths", () => {
  it("investmentGrade → 0 (waived)", () => {
    expect(recommendedDepositMonths("investmentGrade")).toBe(0);
  });

  it("subInvestmentGrade → 1", () => {
    expect(recommendedDepositMonths("subInvestmentGrade")).toBe(1);
  });

  it("distressed → 3", () => {
    expect(recommendedDepositMonths("distressed")).toBe(3);
  });
});

// ─── computePortfolioDepositCoverage ─────────────────────────────────────────

describe("computePortfolioDepositCoverage", () => {
  it("empty lessees → totalDepositM=0, empty rows", () => {
    const result = computePortfolioDepositCoverage([], []);
    expect(result.totalDepositM).toBe(0);
    expect(result.rows).toHaveLength(0);
  });

  it("green lessee → 0 deposit (waived)", () => {
    const lessees = [makeLessee("l1", "IG Airline", "green")];
    const leases  = [makeLease("l1", 1_000_000)];
    const result = computePortfolioDepositCoverage(lessees, leases);
    expect(result.totalDepositM).toBe(0);
    expect(result.rows[0].depositMonths).toBe(0);
    expect(result.rows[0].recommendedDepositM).toBe(0);
  });

  it("amber lessee → 1 month deposit", () => {
    const lessees = [makeLessee("l1", "Sub-IG Airline", "amber")];
    const leases  = [makeLease("l1", 500_000)];
    const result = computePortfolioDepositCoverage(lessees, leases);
    // 1 month × $500k = $0.5M
    expect(result.totalDepositM).toBeCloseTo(0.5, 5);
    expect(result.rows[0].depositMonths).toBe(1);
    expect(result.rows[0].recommendedDepositM).toBeCloseTo(0.5, 5);
  });

  it("red lessee → 3 months deposit", () => {
    const lessees = [makeLessee("l1", "Distressed Airline", "red")];
    const leases  = [makeLease("l1", 300_000)];
    const result = computePortfolioDepositCoverage(lessees, leases);
    // 3 months × $300k = $0.9M
    expect(result.totalDepositM).toBeCloseTo(0.9, 5);
    expect(result.rows[0].depositMonths).toBe(3);
    expect(result.rows[0].recommendedDepositM).toBeCloseTo(0.9, 5);
  });

  it("lessee with null monthly_rental is excluded", () => {
    const lessees = [makeLessee("l1", "No-Rent Airline", "red")];
    const leases  = [makeLease("l1", null)];
    const result = computePortfolioDepositCoverage(lessees, leases);
    expect(result.rows).toHaveLength(0);
    expect(result.totalDepositM).toBe(0);
  });

  it("lessee with no matching lease is excluded", () => {
    const lessees = [makeLessee("l1", "No-Lease Airline", "red")];
    const leases  = [makeLease("l2", 500_000)]; // different lessee
    const result = computePortfolioDepositCoverage(lessees, leases);
    expect(result.rows).toHaveLength(0);
  });

  it("rows sorted by recommendedDepositM descending", () => {
    const lessees = [
      makeLessee("l1", "Small", "amber"),   // 1 × $100k = $0.1M
      makeLessee("l2", "Large", "red"),     // 3 × $500k = $1.5M
    ];
    const leases = [makeLease("l1", 100_000), makeLease("l2", 500_000)];
    const result = computePortfolioDepositCoverage(lessees, leases);
    expect(result.rows[0].lesseeName).toBe("Large");
    expect(result.rows[1].lesseeName).toBe("Small");
  });

  it("rentalSharePct sums to 1.0 across all rows", () => {
    const lessees = [
      makeLessee("l1", "A", "green"),
      makeLessee("l2", "B", "amber"),
      makeLessee("l3", "C", "red"),
    ];
    const leases = [makeLease("l1", 300_000), makeLease("l2", 200_000), makeLease("l3", 500_000)];
    const result = computePortfolioDepositCoverage(lessees, leases);
    const total = result.rows.reduce((s, r) => s + r.rentalSharePct, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/utils/creditDeposit.test.ts
```

Expected: FAIL — cannot find module `./creditDeposit`.

- [ ] **Step 3: Implement `creditDeposit.ts`**

Create `src/app/utils/creditDeposit.ts`:

```typescript
// src/app/utils/creditDeposit.ts
// Pure-function utilities for credit-linked security deposit sizing.
// No React dependencies — safe to use in both components and tests.

import type { Lessee, Lease } from "../types/portfolio";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Credit tier derived from lessee watchlist status.
 *   investmentGrade    = watchlist "green"        → deposit waived
 *   subInvestmentGrade = watchlist "amber" or null → 1 month rent
 *   distressed         = watchlist "red"           → 3 months rent
 */
export type CreditDepositTier = "investmentGrade" | "subInvestmentGrade" | "distressed";

export interface DepositRow {
  lesseeName: string;
  watchlistStatus: "green" | "amber" | "red" | null;
  tier: CreditDepositTier;
  depositMonths: 0 | 1 | 3;
  monthlyRentalM: number;       // in $M
  recommendedDepositM: number;  // in $M
  rentalSharePct: number;       // 0–1: share of total fleet rental
}

// ─── Classification ───────────────────────────────────────────────────────────

/**
 * Classify a lessee into a credit deposit tier based on watchlist_status.
 * null → Sub-Investment Grade (conservative default).
 */
export function creditDepositTier(lessee: Lessee): CreditDepositTier {
  if (lessee.watchlist_status === "green") return "investmentGrade";
  if (lessee.watchlist_status === "red")   return "distressed";
  return "subInvestmentGrade"; // amber or null
}

/**
 * Recommended deposit in months of monthly rent.
 *   investmentGrade    → 0 (waived)
 *   subInvestmentGrade → 1
 *   distressed         → 3
 */
export function recommendedDepositMonths(tier: CreditDepositTier): 0 | 1 | 3 {
  if (tier === "investmentGrade")    return 0;
  if (tier === "distressed")         return 3;
  return 1; // subInvestmentGrade
}

// ─── Portfolio computation ────────────────────────────────────────────────────

/**
 * Compute recommended deposit amounts across the portfolio.
 *
 * - Lessees with no matching lease or null/zero monthly_rental are excluded.
 * - Returns totalDepositM (in $M) and a per-lessee breakdown sorted by
 *   recommendedDepositM descending.
 *
 * depositCoverage = totalDepositM / liveBaseECL is computed by the caller
 * to avoid coupling this utility to the ECL baseline.
 */
export function computePortfolioDepositCoverage(
  lessees: Lessee[],
  leases: Lease[],
): { totalDepositM: number; rows: DepositRow[] } {
  if (lessees.length === 0 || leases.length === 0) {
    return { totalDepositM: 0, rows: [] };
  }

  // Build lessee_id → first matching lease with positive rental
  const leaseByLessee = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByLessee.has(lease.lessee_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByLessee.set(lease.lessee_id, lease);
    }
  }

  const rawRows: DepositRow[] = [];
  let totalRental = 0;

  for (const lessee of lessees) {
    const lease = leaseByLessee.get(lessee.id);
    if (!lease || !lease.monthly_rental) continue;

    const rental = lease.monthly_rental; // narrowed: null/zero excluded above
    const tier   = creditDepositTier(lessee);
    const months = recommendedDepositMonths(tier);
    const depositM = (months * rental) / 1_000_000;
    const rentalM  = rental / 1_000_000;

    rawRows.push({
      lesseeName:          lessee.name,
      watchlistStatus:     lessee.watchlist_status,
      tier,
      depositMonths:       months,
      monthlyRentalM:      rentalM,
      recommendedDepositM: depositM,
      rentalSharePct:      0, // filled in second pass
    });
    totalRental += rental;
  }

  if (rawRows.length === 0) return { totalDepositM: 0, rows: [] };

  // Second pass: compute rentalSharePct and total deposits
  let totalDepositM = 0;
  for (const row of rawRows) {
    row.rentalSharePct = totalRental > 0 ? row.monthlyRentalM * 1_000_000 / totalRental : 0;
    totalDepositM += row.recommendedDepositM;
  }

  rawRows.sort((a, b) =>
    b.recommendedDepositM - a.recommendedDepositM ||
    b.monthlyRentalM - a.monthlyRentalM
  );

  return { totalDepositM, rows: rawRows };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/utils/creditDeposit.test.ts
```

Expected: all 12 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (prior 122 + 12 new = 134 total).

- [ ] **Step 6: Commit**

```bash
git add src/app/utils/creditDeposit.ts src/app/utils/creditDeposit.test.ts
git commit -m "feat(utils): add creditDeposit utility for tier classification and deposit computation"
```

---

## Task 3: `CreditDepositTab.tsx` — new Scenarios tab

**Files:**
- Create: `src/app/components/scenarios/CreditDepositTab.tsx`

### Context

Follow the pattern in `src/app/components/scenarios/JurisdictionRiskTab.tsx` exactly. Key differences:
- Imports `computePortfolioDepositCoverage` and `CreditDepositTier` from `../../utils/creditDeposit`
- Imports `BASE_ECL` from `../../utils/eclCalculator`
- Props: `onUseInCustomBuilder: (depositCoverage: number) => void`
- KPI cards: 3 cards (Investment Grade %, Distressed %, Deposit Coverage %)
- Table columns: Airline · Watchlist · Credit Tier · Deposit Months · Monthly Rent · Rec. Deposit

Module-scope constants (project convention — must be outside the component):

```typescript
const DEPOSIT_TIER_LABEL: Record<CreditDepositTier, string> = {
  investmentGrade:    "Investment Grade",
  subInvestmentGrade: "Sub-Investment Grade",
  distressed:         "Distressed",
};

const DEPOSIT_TIER_PILL_BG: Record<CreditDepositTier, string> = {
  investmentGrade:    "#DCFCE7",
  subInvestmentGrade: "#FEF3C7",
  distressed:         "#FEE2E2",
};

const DEPOSIT_TIER_PILL_COLOR: Record<CreditDepositTier, string> = {
  investmentGrade:    "#15803D",
  subInvestmentGrade: "#B45309",
  distressed:         "#B91C1C",
};

const WATCHLIST_DOT: Record<"green" | "amber" | "red", string> = {
  green: "#22C55E",
  amber: "#F59E0B",
  red:   "#EF4444",
};
```

---

- [ ] **Step 1: Create the file**

Create `src/app/components/scenarios/CreditDepositTab.tsx`:

```typescript
// src/app/components/scenarios/CreditDepositTab.tsx
import { usePortfolioData } from "../../hooks/usePortfolioData";
import { computePortfolioDepositCoverage, type CreditDepositTier } from "../../utils/creditDeposit";
import { BASE_ECL } from "../../utils/eclCalculator";
import { Card } from "../ui/Card";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPOSIT_TIER_LABEL: Record<CreditDepositTier, string> = {
  investmentGrade:    "Investment Grade",
  subInvestmentGrade: "Sub-Investment Grade",
  distressed:         "Distressed",
};

const DEPOSIT_TIER_PILL_BG: Record<CreditDepositTier, string> = {
  investmentGrade:    "#DCFCE7",
  subInvestmentGrade: "#FEF3C7",
  distressed:         "#FEE2E2",
};

const DEPOSIT_TIER_PILL_COLOR: Record<CreditDepositTier, string> = {
  investmentGrade:    "#15803D",
  subInvestmentGrade: "#B45309",
  distressed:         "#B91C1C",
};

const WATCHLIST_DOT: Record<"green" | "amber" | "red", string> = {
  green: "#22C55E",
  amber: "#F59E0B",
  red:   "#EF4444",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: "0.5rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.375rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

function TierPill({ tier }: { tier: CreditDepositTier }) {
  return (
    <span style={{
      background: DEPOSIT_TIER_PILL_BG[tier],
      color: DEPOSIT_TIER_PILL_COLOR[tier],
      fontWeight: 600, fontSize: "0.75rem",
      padding: "0.15rem 0.5rem", borderRadius: "9999px",
      whiteSpace: "nowrap",
    }}>
      {DEPOSIT_TIER_LABEL[tier]}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Called when user clicks "Use in Custom Builder" — switches tab and pre-fills slider. */
  onUseInCustomBuilder: (depositCoverage: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CreditDepositTab({ onUseInCustomBuilder }: Props) {
  const { lessees, leases } = usePortfolioData();
  const { totalDepositM, rows } = computePortfolioDepositCoverage(lessees, leases);

  // depositCoverage = total deposits / ECL baseline (not fleet EAD)
  const depositCoverage = BASE_ECL > 0 ? totalDepositM / BASE_ECL : 0;

  // KPI breakdown by rental share
  const igRentalPct = rows
    .filter((r) => r.tier === "investmentGrade")
    .reduce((s, r) => s + r.rentalSharePct, 0);
  const distressedRentalPct = rows
    .filter((r) => r.tier === "distressed")
    .reduce((s, r) => s + r.rentalSharePct, 0);

  // Color logic
  const distressedColor = distressedRentalPct > 0.30 ? "#B91C1C" : distressedRentalPct > 0.15 ? "#B45309" : "#15803D";
  const distressedBg    = distressedRentalPct > 0.30 ? "#FEE2E2" : distressedRentalPct > 0.15 ? "#FEF3C7" : "#DCFCE7";
  const coverageColor   = depositCoverage > 0.05 ? "#B91C1C" : depositCoverage > 0.02 ? "#B45309" : "#15803D";
  const coverageBg      = depositCoverage > 0.05 ? "#FEE2E2" : depositCoverage > 0.02 ? "#FEF3C7" : "#DCFCE7";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Investment Grade"
          value={`${(igRentalPct * 100).toFixed(1)}%`}
          color="#15803D"
          bg="#DCFCE7"
        />
        <KpiCard
          label="Distressed"
          value={`${(distressedRentalPct * 100).toFixed(1)}%`}
          color={distressedColor}
          bg={distressedBg}
        />
        <KpiCard
          label="Deposit Coverage"
          value={rows.length === 0 ? "0.0%" : `${(depositCoverage * 100).toFixed(1)}% of ECL`}
          color={coverageColor}
          bg={coverageBg}
        />
      </div>

      {/* ── Lessee breakdown table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Lessee Deposit Sizing
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
                    {["Airline", "Watchlist", "Credit Tier", "Deposit Months", "Monthly Rent", "Rec. Deposit"].map((h) => (
                      <th key={h} style={{
                        textAlign: h === "Airline" ? "left" : "right",
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
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        {row.watchlistStatus ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "0.375rem",
                            fontSize: "0.75rem", fontWeight: 600,
                            color: WATCHLIST_DOT[row.watchlistStatus],
                          }}>
                            <span style={{
                              width: "0.5rem", height: "0.5rem", borderRadius: "9999px",
                              background: WATCHLIST_DOT[row.watchlistStatus],
                              display: "inline-block",
                            }} />
                            {row.watchlistStatus.charAt(0).toUpperCase() + row.watchlistStatus.slice(1)}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <TierPill tier={row.tier} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.depositMonths === 0 ? <span style={{ color: "#94A3B8" }}>Waived</span> : `${row.depositMonths} mo`}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        ${(row.monthlyRentalM * 1000).toFixed(0)}k
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: row.recommendedDepositM > 0 ? "#0F172A" : "#94A3B8", fontVariantNumeric: "tabular-nums" }}>
                        {row.recommendedDepositM > 0 ? `$${row.recommendedDepositM.toFixed(2)}M` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                    <td colSpan={5} style={{ padding: "0.625rem 0.75rem", fontWeight: 600, color: "#475569", fontSize: "0.75rem" }}>
                      Total recommended deposits
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                      ${totalDepositM.toFixed(2)}M
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Use in Custom Builder CTA */}
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => onUseInCustomBuilder(depositCoverage)}
              disabled={rows.length === 0}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.8125rem", fontWeight: 600,
                background: rows.length === 0 ? "#F1F5F9" : "#002147",
                color: rows.length === 0 ? "#94A3B8" : "#FFFFFF",
                border: "none", borderRadius: "0.375rem",
                cursor: rows.length === 0 ? "not-allowed" : "pointer",
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
npx tsc --noEmit 2>&1 | grep -i "creditDeposit\|CreditDepositTab" | head -20
```

Expected: no errors referencing these files.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/scenarios/CreditDepositTab.tsx
git commit -m "feat(ui): add CreditDepositTab with KPI cards and lessee deposit breakdown"
```

---

## Task 4: `SDMRTab.tsx` — add Credit Tier pill column

**Files:**
- Modify: `src/app/components/portfolio/SDMRTab.tsx`

### Context

`LeaseSDMR` interface is at lines 31–43. `PALessee` type is at line 48. `buildLiveSDMRData` is at line 223. Static `sdmrData` starts at line 54. The expanded panel component `ExpandedPanel` is at line 377.

The SDMR table renders one row per lease in the collapsed view (the collapsed summary row showing lessee, aircraft, SD amount, etc.). The Credit Tier pill should appear in that summary row.

The six lessees in `sdmrData` are (in order): IndiGo Airlines, Aeromexico, Emirates, SriLankan Airlines, and two more. Need to read lines 133–215 to confirm.

---

- [ ] **Step 1: Read the rest of the static data and the row render**

Before coding, quickly check what the 5th and 6th SDMR leases are:

```bash
grep -n "lessee:" src/app/components/portfolio/SDMRTab.tsx
```

Expected output (from the existing file):
```
57:    lessee: "IndiGo Airlines",
83:    lessee: "Aeromexico",
109:    lessee: "Emirates",
135:    lessee: "SriLankan Airlines",
161:    lessee: "Aeromexico",   ← or another name
187:    lessee: "...",
```

Use the actual names from the output to fill in the static tier map below.

- [ ] **Step 2: Add `creditTier` field and import to `SDMRTab.tsx`**

At the top of the file, after the existing imports, add:

```typescript
import { creditDepositTier, type CreditDepositTier } from "../../utils/creditDeposit";
```

Add `creditTier?: CreditDepositTier` to `LeaseSDMR`:
```typescript
export interface LeaseSDMR {
  leaseId: string;
  lessee: string;
  aircraft: string;
  eadNum: number;
  baseLGD: number;
  sd: SDRecord;
  mrComponents: MRComponent[];
  returnCondition: "half-life" | "full-life";
  /** Populated by buildLiveSDMRData — absent in the static demo dataset */
  leaseEnd?: string;
  stage?: number;
  /** Credit tier derived from lessee watchlist_status */
  creditTier?: CreditDepositTier;
}
```

Extend `PALessee` to include watchlist:
```typescript
type PALessee = { id: string; name: string; country?: string; watchlist_status?: "green" | "amber" | "red" | null };
```

- [ ] **Step 3: Add hardcoded tier map for static data**

Add a module-scope constant mapping lessee name → tier (for the static dataset). Replace `"SriLankan Airlines"`, `"IndiGo Airlines"`, etc. with the actual names found in Step 1:

```typescript
/** Credit tier for static demo SDMR lessees — derived from known watchlist status. */
const STATIC_CREDIT_TIER: Record<string, CreditDepositTier> = {
  "IndiGo Airlines":    "subInvestmentGrade",
  "Aeromexico":         "subInvestmentGrade",
  "Emirates":           "investmentGrade",
  "SriLankan Airlines": "distressed",
  "Air Transat":        "subInvestmentGrade",
  "Air France":         "investmentGrade",
};
```

Add `creditTier` to each static `sdmrData` record. Because `LeaseSDMR.creditTier` is optional, this is additive — add it to every record using `STATIC_CREDIT_TIER`:

After `sdmrData` is defined (at the closing `];`), add:
```typescript
// Annotate static data with credit tiers
sdmrData.forEach((r) => { r.creditTier = STATIC_CREDIT_TIER[r.lessee]; });
```

- [ ] **Step 4: Populate `creditTier` in `buildLiveSDMRData`**

In `buildLiveSDMRData`, the `lessee` variable is of type `PALessee`. After deriving other fields, add:

```typescript
creditTier: lessee.watchlist_status
  ? creditDepositTier({ watchlist_status: lessee.watchlist_status } as { watchlist_status: "green" | "amber" | "red" | null } & import("../../types/portfolio").Lessee)
  : "subInvestmentGrade",
```

Wait — `creditDepositTier` expects a full `Lessee` object but only uses `watchlist_status`. To avoid the cast, add a helper inline:

```typescript
function _tierFromWatchlist(w: "green" | "amber" | "red" | null | undefined): CreditDepositTier {
  if (w === "green") return "investmentGrade";
  if (w === "red")   return "distressed";
  return "subInvestmentGrade";
}
```

Place this helper just above `buildLiveSDMRData`. Then in the `return { ... }` block of the `.map()`:

```typescript
creditTier: _tierFromWatchlist(lessee.watchlist_status),
```

- [ ] **Step 5: Add tier pill constants and pill to the summary row**

Add module-scope constants for the pill (these go near the top of the file with other constants):

```typescript
const SDMR_TIER_LABEL: Record<CreditDepositTier, string> = {
  investmentGrade:    "IG",
  subInvestmentGrade: "Sub-IG",
  distressed:         "Distressed",
};

const SDMR_TIER_BG: Record<CreditDepositTier, string> = {
  investmentGrade:    "#DCFCE7",
  subInvestmentGrade: "#FEF3C7",
  distressed:         "#FEE2E2",
};

const SDMR_TIER_COLOR: Record<CreditDepositTier, string> = {
  investmentGrade:    "#15803D",
  subInvestmentGrade: "#B45309",
  distressed:         "#B91C1C",
};
```

Find the collapsed summary row in the SDMR table (search for the row that renders `lease.lessee` and `lease.aircraft`). It is likely inside a `<tr>` with a `key={lease.leaseId}` prop. After the aircraft column or the SD amount column, add a new `<td>`:

```tsx
<td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
  {lease.creditTier ? (
    <span style={{
      background: SDMR_TIER_BG[lease.creditTier],
      color: SDMR_TIER_COLOR[lease.creditTier],
      fontWeight: 600, fontSize: "0.6875rem",
      padding: "0.125rem 0.45rem", borderRadius: "9999px",
      whiteSpace: "nowrap",
    }}>
      {SDMR_TIER_LABEL[lease.creditTier]}
    </span>
  ) : "—"}
</td>
```

Also add `<th>Credit Tier</th>` to the corresponding header row with `textAlign: "right"`.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "SDMRTab\|creditTier\|creditDeposit" | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/components/portfolio/SDMRTab.tsx
git commit -m "feat(ui): add Credit Tier pill column to SDMRTab lessee rows"
```

---

## Task 5: `Scenarios.tsx` — wiring

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

### Context

This is the most file-intensive task. Pattern everything after how Jurisdiction Risk was wired in Sprint 11. Key reference points:

- **Imports** (around line 10): `JurisdictionRiskTab` and `computePortfolioJurisdictionMix` are imported here
- **TEMPLATES** (lines ~249–541): every template object has `ctcGoldPct: 0, nonCtcPct: 0` at the end — add `depositCoverage: 0` after them
- **`generateDSL`** (around line 620–646): conditional spread for `ctc_gold_pct`/`non_ctc_pct`
- **`parseDSL`** (around line 683): parses `ctc_gold_pct`/`non_ctc_pct`
- **State** (around line 912): `jurisdictionOpen` / `setJurisdictionOpen`
- **`useMemo` for portfolio mix** (around line 956)
- **`updateFormInputs`** (around line 967): sets `setJurisdictionOpen(true)` when active
- **Clone effect** (around line 1045): same auto-expand
- **Tab list** (line 1083): `["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Lease Pricing"]`
- **Tab render** (around line 2864): renders `JurisdictionRiskTab`
- **Custom Builder section** (around line 2324): Jurisdiction Risk collapsible

---

- [ ] **Step 1: Add imports**

Near line 10, after the `JurisdictionRiskTab` import line:
```typescript
import { CreditDepositTab } from "../components/scenarios/CreditDepositTab";
import { computePortfolioDepositCoverage } from "../utils/creditDeposit";
```

- [ ] **Step 2: Add `depositCoverage: 0` to all TEMPLATES**

Every template object ends with `nonCtcPct: 0`. After each `nonCtcPct: 0`, add:
```typescript
depositCoverage: 0,
```

There are 15 template objects (lines ~249–541). Use search-and-replace: find `nonCtcPct: 0,` and replace with `nonCtcPct: 0, depositCoverage: 0,`. Check that no instance is missed.

- [ ] **Step 3: Add `deposit_coverage` to `generateDSL`**

After the existing jurisdiction conditional spread (around line 631–633):
```typescript
// Security deposits — omitted when 0 (feature inactive)
...(inputs.depositCoverage !== 0
  ? { deposit_coverage: inputs.depositCoverage }
  : {}),
```

- [ ] **Step 4: Add `depositCoverage` to `parseDSL`**

After the `nonCtcPct` parsing block (around line 690):
```typescript
depositCoverage: typeof s.deposit_coverage === "number"
  ? Math.min(1, Math.max(0, s.deposit_coverage))
  : 0,
```

- [ ] **Step 5: Add `depositOpen` state**

After `const [jurisdictionOpen, setJurisdictionOpen] = useState(false);` (line ~913):
```typescript
const [depositOpen, setDepositOpen] = useState(false);
```

- [ ] **Step 6: Add portfolio deposit mix useMemo**

After the `portfolioJurisdictionMix` useMemo (around line 956–959):
```typescript
// Deposit coverage from portfolio credit tiers — used by CreditDepositTab "Use in Custom Builder"
// and the "From portfolio" button in the Custom Builder Security Deposits section.
const portfolioDepositMix = React.useMemo(
  () => computePortfolioDepositCoverage(lessees, leases),
  [lessees, leases]
);
const portfolioDepositCoverage = liveBaseECL > 0 ? portfolioDepositMix.totalDepositM / liveBaseECL : 0;
```

- [ ] **Step 7: Add auto-expand in `updateFormInputs`**

After `if (next.ctcGoldPct !== 0 || next.nonCtcPct !== 0) setJurisdictionOpen(true);` (line ~979):
```typescript
if (next.depositCoverage !== 0) setDepositOpen(true);
```

Also add `setDepositOpen` to the `useCallback` dependency array.

- [ ] **Step 8: Add auto-expand in clone effect**

After `if (clonePending.inputs.ctcGoldPct !== 0 || clonePending.inputs.nonCtcPct !== 0) setJurisdictionOpen(true);` (line ~1046):
```typescript
if (clonePending.inputs.depositCoverage !== 0) setDepositOpen(true);
```

- [ ] **Step 9: Add "Security Deposits" to the tab list**

Line 1083 — change:
```typescript
: ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Lease Pricing"];
```
to:
```typescript
: ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Security Deposits", "Lease Pricing"];
```

- [ ] **Step 10: Add Custom Builder "Security Deposits" collapsible section**

After the Jurisdiction Risk collapsible section (around line 2467, after the closing `})()}`):

```tsx
{/* ── Security Deposits — collapsible ── */}
{(() => {
  const covPct   = formInputs.depositCoverage;
  const isActive = covPct !== 0;
  const benefit  = covPct * 0.50 * liveBaseECL;

  return (
    <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
      {/* Section header */}
      <button
        onClick={() => setDepositOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "0.625rem 0.875rem",
          background: depositOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
          border: "none", cursor: "pointer",
          borderBottom: depositOpen ? "1px solid #E2E8F0" : "none",
          transition: "background 150ms",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Security Deposits
          </span>
          {isActive ? (
            <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
              {(covPct * 100).toFixed(1)}% coverage
            </span>
          ) : (
            <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>None (no deposit benefit)</span>
          )}
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transform: depositOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {depositOpen && (
          <motion.div
            key="deposit-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0.875rem" }}>
              {/* Deposit Coverage slider */}
              <SliderRow
                label="Deposit Coverage"
                min={0} max={0.30} step={0.005}
                value={covPct}
                onChange={(v) => updateFormInputs({ depositCoverage: v })}
                fmt={(v) => `${(v * 100).toFixed(1)}% of ECL`}
              />

              {/* "From portfolio" button */}
              <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  onClick={() => updateFormInputs({ depositCoverage: portfolioDepositCoverage })}
                  style={{
                    fontSize: "0.75rem", fontWeight: 600,
                    padding: "0.25rem 0.625rem",
                    background: "rgba(0,33,71,0.06)", color: "#002147",
                    border: "1px solid rgba(0,33,71,0.15)", borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                  title="Computed from your portfolio's lessee credit tier mix, weighted by monthly rental and ECL baseline."
                >
                  From portfolio
                </button>
                <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
                  {(portfolioDepositCoverage * 100).toFixed(1)}% ({portfolioDepositMix.totalDepositM > 0 ? `$${portfolioDepositMix.totalDepositM.toFixed(2)}M deposits` : "no deposits"})
                </span>
              </div>

              {/* Net impact */}
              <div style={{
                marginTop: "0.875rem", fontSize: "0.8125rem",
                color: isActive ? "#15803D" : "#94A3B8",
                fontVariantNumeric: "tabular-nums",
              }}>
                Deposit Benefit{" "}
                <span style={{ fontWeight: 700 }}>
                  {isActive ? `−$${benefit.toFixed(1)}M` : "$0"}
                </span>
                {isActive && (
                  <>
                    <span style={{ color: "#CBD5E1", margin: "0 0.5rem" }}>·</span>
                    <span style={{ color: "#64748B" }}>
                      Coverage {(covPct * 100).toFixed(1)}% of ECL baseline
                    </span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
})()}
```

- [ ] **Step 11: Add `CreditDepositTab` render**

After the Jurisdiction Risk tab render block (around line 2873), add:

```tsx
{activeTab === "Security Deposits" && (
  <CreditDepositTab
    onUseInCustomBuilder={(cov) => {
      setActiveTab("Custom Builder");
      updateFormInputs({ depositCoverage: cov });
    }}
  />
)}
```

- [ ] **Step 12: Add `setDepositOpen(false)` to reset**

Find where `setJurisdictionOpen(false)` is called in the reset handler and add `setDepositOpen(false)` immediately after it.

- [ ] **Step 13: Run full tests**

```bash
npx vitest run
```

Expected: all 134 tests pass (no regressions).

- [ ] **Step 14: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add src/app/pages/Scenarios.tsx
git commit -m "feat(scenarios): wire Security Deposits tab and Custom Builder section"
```

---

## Task 6: Deploy

- [ ] **Step 1: Run full tests one final time**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Push to origin/main**

```bash
git push origin main
```

Expected: remote accepts push, CI passes.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in plan |
|---|---|
| `creditDepositTier()` from watchlist_status | Task 2 |
| `recommendedDepositMonths()` 0/1/3 | Task 2 |
| `depositCoverage` field in ScenarioInputs | Task 1 |
| `depositBenefit = depositCoverage × baseECL × 0.50` | Task 1 |
| `CreditDepositTab` KPI cards (3) | Task 3 |
| Lessee breakdown table with Tier pill | Task 3 |
| "Use in Custom Builder" CTA | Task 3 |
| SDMRTab Credit Tier column | Task 4 |
| Scenarios tab "Security Deposits" | Task 5 steps 9, 11 |
| Custom Builder collapsible section | Task 5 step 10 |
| "From portfolio" button | Task 5 step 10 |
| Net impact line | Task 5 step 10 |
| DSL `deposit_coverage` round-trip | Task 5 steps 3–4 |
| Auto-expand on active field | Task 5 steps 7–8 |
| Reset collapses section | Task 5 step 12 |

**Type consistency check:** `CreditDepositTier`, `DepositRow`, `computePortfolioDepositCoverage` defined in Task 2 and used consistently in Tasks 3, 4, 5. `depositCoverage: number` defined in Task 1 and referenced in Task 5.

**Placeholder scan:** No "TBD", "TODO", or vague steps found. Task 4 Step 1 requires reading a bash command output to confirm lessee names — this is explicit and actionable.
