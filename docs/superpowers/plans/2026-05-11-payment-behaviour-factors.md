# Payment Behaviour Factors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a regional payment behaviour factor to the ECL Scenario Builder — each lessee's country maps to a Cooperative / Neutral / Adversarial tier that drives a rental-weighted ECL adjustment, overridable in the Custom Builder.

**Architecture:** Four additive changes mirroring Sprint 11 (Jurisdiction Risk) and Sprint 12 (Security Deposits) exactly: pure utility → ECL wiring → tab component → Scenarios.tsx wiring. No new routes, schema changes, or npm packages.

**Tech Stack:** React 18, TypeScript, Vitest, Framer Motion (AnimatePresence + motion.div), inline styles only.

---

## Key design decisions (read before implementing)

### ECL formula
```
payBehaviourDelta = (payBehaviourAdvPct × 0.12 − payBehaviourCoopPct × 0.07) × baseECL
delta += payBehaviourDelta
```
Guard: when `payBehaviourCoopPct === 0 && payBehaviourAdvPct === 0`, feature inactive → delta = 0. Neutral baseline, not optimistic.

### Country scores
`PAYMENT_BEHAVIOUR_SCORES: Record<string, number>` keyed by country name (lowercase-normalised). Missing countries default to `neutral` tier (score 50). Scores ≥ 70 = cooperative, 40–69 = neutral, < 40 = adversarial.

### Demo fleet calibration (pre-computed, verify in tests)
- Cooperative: Emirates (UAE 82, $1,240k) + Singapore Airlines (SG 90, $1,050k) + Ryanair (IE 85, $340k) + Lufthansa (DE 78, $220k) = $2,850k → **52.2%**
- Neutral: Air France (FR 55, $960k) + IndiGo (IN 42, $285k) + Air Transat (CA 68, $275k) = $1,520k → **27.9%**
- Adversarial: SriLankan (LK 28, $480k) + Aeromexico (MX 32, $310k) + Azul (BR 38, $295k) = $1,085k → **19.9%**
- Net ECL impact: `(0.199 × 0.12 − 0.522 × 0.07) × 47.2 ≈ −$0.30M`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/app/utils/paymentBehaviour.ts` | Create | Score table, tier classification, portfolio mix computation |
| `src/app/utils/paymentBehaviour.test.ts` | Create | Tests for the utility (13 tests) |
| `src/app/utils/eclCalculator.ts` | Modify | Add `payBehaviourCoopPct` + `payBehaviourAdvPct` to `ScenarioInputs`; add `payBehaviourDelta` |
| `src/app/utils/eclCalculator.test.ts` | Modify | Add payment behaviour test suite (6 tests) |
| `src/app/components/scenarios/PaymentBehaviourTab.tsx` | Create | New Scenarios tab: KPI cards, lessee breakdown, CTA |
| `src/app/pages/Scenarios.tsx` | Modify | Wire tab, DSL, Custom Builder section, state |

---

## Task 1: ECL calculator — add `payBehaviourCoopPct`, `payBehaviourAdvPct`, and `payBehaviourDelta`

**Files:**
- Modify: `src/app/utils/eclCalculator.ts`
- Modify: `src/app/utils/eclCalculator.test.ts`

### Context

Current `ScenarioInputs` ends with (lines 33–34):
```typescript
  // ── Security deposits ─────────────────────────────────────────────────────────
  depositCoverage: number; // 0–1: recommended deposits as fraction of ECL baseline (0 = no deposits)
```

`ZERO_INPUTS` ends with (line 80):
```typescript
  depositCoverage: 0,
```

`computeECLFromBase` delta line (line 134):
```typescript
  const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit + lgdDelta + jurisdictionLGDDelta - depositBenefit;
```

The "ZERO_INPUTS still has all new fields at 0" test block is at lines 74–84 of `eclCalculator.test.ts`. The `"security deposit benefit"` describe block ends at line 267 (last line of file).

---

- [ ] **Step 1: Write the failing tests**

Add to the end of `src/app/utils/eclCalculator.test.ts`:

```typescript
describe("payment behaviour delta", () => {
  it("ZERO_INPUTS has payBehaviourCoopPct and payBehaviourAdvPct as 0", () => {
    expect(ZERO_INPUTS.payBehaviourCoopPct).toBe(0);
    expect(ZERO_INPUTS.payBehaviourAdvPct).toBe(0);
  });

  it("both 0 → feature inactive, no ECL adjustment (backward-compatible)", () => {
    expect(computeECLFromBase(47.2, ZERO_INPUTS)).toBeCloseTo(47.2, 5);
  });

  it("100% adversarial → ECL increases by 12% of baseECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, payBehaviourAdvPct: 1.0 });
    expect(result).toBeCloseTo(47.2 * (1 + 0.12), 4);
  });

  it("100% cooperative → ECL decreases by 7% of baseECL", () => {
    const result = computeECLFromBase(47.2, { ...ZERO_INPUTS, payBehaviourCoopPct: 1.0 });
    expect(result).toBeCloseTo(47.2 * (1 - 0.07), 4);
  });

  it("demo fleet mix: 52.2% coop + 19.9% adv → net ~−$0.30M", () => {
    const result = computeECLFromBase(47.2, {
      ...ZERO_INPUTS,
      payBehaviourCoopPct: 0.522,
      payBehaviourAdvPct: 0.199,
    });
    // delta = (0.199 × 0.12 − 0.522 × 0.07) × 47.2 ≈ −0.303M
    expect(result).toBeCloseTo(47.2 + (0.199 * 0.12 - 0.522 * 0.07) * 47.2, 2);
  });

  it("floor still holds under 100% adversarial + heavy macro stress", () => {
    const result = computeECLFromBase(47.2, {
      ...ZERO_INPUTS,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 1.0,
      rpkDelta: -0.80,
    });
    expect(result).toBeGreaterThanOrEqual(47.2 * 0.3 - 0.001);
  });
});
```

Also add these two lines to the existing `"ZERO_INPUTS still has all new fields at 0"` test block (lines 74–84), after `expect(ZERO_INPUTS.depositCoverage).toBe(0);`:

```typescript
    expect(ZERO_INPUTS.payBehaviourCoopPct).toBe(0);
    expect(ZERO_INPUTS.payBehaviourAdvPct).toBe(0);
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/eclCalculator.test.ts 2>&1 | tail -15
```

Expected: failures — `payBehaviourCoopPct` does not exist on `ScenarioInputs`.

- [ ] **Step 3: Implement in `eclCalculator.ts`**

**3a.** Add to `ScenarioInputs` after the `// ── Security deposits` section:

```typescript
  // ── Payment behaviour ─────────────────────────────────────────────────────────
  payBehaviourCoopPct: number; // 0–1: share of fleet in Cooperative tier (score ≥ 70)
  payBehaviourAdvPct:  number; // 0–1: share of fleet in Adversarial tier (score < 40)
  // Derived: neutralPct = max(0, 1 − coopPct − advPct). Not stored.
  // Both default to 0 (feature inactive = neutral baseline, 0 ECL adjustment). Backward-compatible.
```

**3b.** Add to `ZERO_INPUTS` after `depositCoverage: 0,`:

```typescript
  payBehaviourCoopPct: 0,
  payBehaviourAdvPct:  0,
```

**3c.** Add to `computeECLFromBase`, after the `depositBenefit` line and before the `delta` line:

```typescript
  // Payment behaviour delta — regional payment culture adjustment to effective LGD.
  // Adversarial: +12% of baseECL (contested recoveries, high DPD, govt interference).
  // Cooperative: −7% of baseECL (fast workouts, low DPD, strong payment culture).
  // Guard: both 0 → feature inactive → 0 delta (neutral baseline, not optimistic).
  const payBehaviourDelta =
    inputs.payBehaviourCoopPct === 0 && inputs.payBehaviourAdvPct === 0
      ? 0
      : (inputs.payBehaviourAdvPct * 0.12 - inputs.payBehaviourCoopPct * 0.07) * baseECL;
```

**3d.** Update the `delta` line to include `payBehaviourDelta`:

```typescript
  const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit + lgdDelta + jurisdictionLGDDelta - depositBenefit + payBehaviourDelta;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/eclCalculator.test.ts 2>&1 | tail -10
```

Expected: all tests pass, including the 6 new ones.

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/utils/eclCalculator.ts src/app/utils/eclCalculator.test.ts && git commit -m "feat(ecl): add payBehaviourCoopPct/AdvPct fields and payBehaviourDelta to ECL calculator"
```

---

## Task 2: `paymentBehaviour.ts` utility + tests

**Files:**
- Create: `src/app/utils/paymentBehaviour.ts`
- Create: `src/app/utils/paymentBehaviour.test.ts`

### Context

Pattern: mirrors `src/app/utils/creditDeposit.ts` and `src/app/utils/jurisdictionRisk.ts` exactly. `Lessee` type has `country: string | null` and `id: string`. `Lease` type has `lessee_id: string` and `monthly_rental: number | null`.

---

- [ ] **Step 1: Write the failing tests**

Create `src/app/utils/paymentBehaviour.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  payBehaviourTier,
  computePortfolioPaymentBehaviourMix,
  PAYMENT_BEHAVIOUR_SCORES,
} from "./paymentBehaviour";
import type { Lessee, Lease } from "../types/portfolio";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLessee(id: string, name: string, country: string | null): Lessee {
  return {
    id, name,
    org_id: "test",
    iata_code: null,
    country,
    credit_rating: null,
    pd_estimate: null,
    watchlist_status: null,
    created_at: "2024-01-01T00:00:00Z",
  };
}

function makeLease(lesseeId: string, monthlyRental: number | null): Lease {
  return {
    id: `ls-${lesseeId}`,
    org_id: "test",
    asset_id: `a-${lesseeId}`,
    lessee_id: lesseeId,
    start_date: "2024-01-01",
    end_date: "2030-01-01",
    monthly_rental: monthlyRental,
    currency: "USD",
    stage: 1,
    created_at: "2024-01-01T00:00:00Z",
  };
}

// ─── payBehaviourTier ─────────────────────────────────────────────────────────

describe("payBehaviourTier", () => {
  it("score ≥ 70 → cooperative", () => {
    expect(payBehaviourTier(70)).toBe("cooperative");
    expect(payBehaviourTier(90)).toBe("cooperative");
  });

  it("score 40–69 → neutral", () => {
    expect(payBehaviourTier(40)).toBe("neutral");
    expect(payBehaviourTier(55)).toBe("neutral");
    expect(payBehaviourTier(69)).toBe("neutral");
  });

  it("score < 40 → adversarial", () => {
    expect(payBehaviourTier(39)).toBe("adversarial");
    expect(payBehaviourTier(0)).toBe("adversarial");
  });

  it("PAYMENT_BEHAVIOUR_SCORES has UAE=82, Singapore=90, Sri Lanka=28, India=42", () => {
    expect(PAYMENT_BEHAVIOUR_SCORES["united arab emirates"]).toBe(82);
    expect(PAYMENT_BEHAVIOUR_SCORES["singapore"]).toBe(90);
    expect(PAYMENT_BEHAVIOUR_SCORES["sri lanka"]).toBe(28);
    expect(PAYMENT_BEHAVIOUR_SCORES["india"]).toBe(42);
  });
});

// ─── computePortfolioPaymentBehaviourMix ─────────────────────────────────────

describe("computePortfolioPaymentBehaviourMix", () => {
  it("empty lessees → coopPct=0, advPct=0, empty rows", () => {
    const result = computePortfolioPaymentBehaviourMix([], []);
    expect(result.coopPct).toBe(0);
    expect(result.advPct).toBe(0);
    expect(result.rows).toHaveLength(0);
  });

  it("cooperative lessee (UAE) → coopPct=1, advPct=0", () => {
    const lessees = [makeLessee("l1", "Emirates", "UAE")];
    const leases  = [makeLease("l1", 1_000_000)];
    const result = computePortfolioPaymentBehaviourMix(lessees, leases);
    expect(result.coopPct).toBeCloseTo(1.0, 5);
    expect(result.advPct).toBeCloseTo(0, 5);
    expect(result.rows[0].tier).toBe("cooperative");
  });

  it("adversarial lessee (Sri Lanka) → coopPct=0, advPct=1", () => {
    const lessees = [makeLessee("l1", "SriLankan", "Sri Lanka")];
    const leases  = [makeLease("l1", 500_000)];
    const result = computePortfolioPaymentBehaviourMix(lessees, leases);
    expect(result.coopPct).toBeCloseTo(0, 5);
    expect(result.advPct).toBeCloseTo(1.0, 5);
    expect(result.rows[0].tier).toBe("adversarial");
  });

  it("unknown country → neutral tier (score 50 default)", () => {
    const lessees = [makeLessee("l1", "Mystery Air", "Neverland")];
    const leases  = [makeLease("l1", 300_000)];
    const result = computePortfolioPaymentBehaviourMix(lessees, leases);
    expect(result.rows[0].tier).toBe("neutral");
    expect(result.rows[0].score).toBe(50);
  });

  it("null country → neutral tier", () => {
    const lessees = [makeLessee("l1", "No Country Air", null)];
    const leases  = [makeLease("l1", 300_000)];
    const result = computePortfolioPaymentBehaviourMix(lessees, leases);
    expect(result.rows[0].tier).toBe("neutral");
  });

  it("lessee with null monthly_rental is excluded", () => {
    const lessees = [makeLessee("l1", "Excluded", "Sri Lanka")];
    const leases  = [makeLease("l1", null)];
    const result = computePortfolioPaymentBehaviourMix(lessees, leases);
    expect(result.rows).toHaveLength(0);
  });

  it("lessee with no matching lease is excluded", () => {
    const lessees = [makeLessee("l1", "No Lease", "UAE")];
    const leases  = [makeLease("l2", 500_000)];
    const result = computePortfolioPaymentBehaviourMix(lessees, leases);
    expect(result.rows).toHaveLength(0);
  });

  it("rows sorted by score ascending (worst first), then by monthly rental descending", () => {
    const lessees = [
      makeLessee("l1", "Coop",  "UAE"),       // score 82
      makeLessee("l2", "Adv",   "Sri Lanka"), // score 28
      makeLessee("l3", "Neutral","France"),    // score 55
    ];
    const leases = [makeLease("l1", 500_000), makeLease("l2", 400_000), makeLease("l3", 300_000)];
    const result = computePortfolioPaymentBehaviourMix(lessees, leases);
    expect(result.rows[0].lesseeName).toBe("Adv");    // score 28
    expect(result.rows[1].lesseeName).toBe("Neutral"); // score 55
    expect(result.rows[2].lesseeName).toBe("Coop");   // score 82
  });

  it("rentalSharePct sums to 1.0 across all rows", () => {
    const lessees = [
      makeLessee("l1", "A", "UAE"),
      makeLessee("l2", "B", "Sri Lanka"),
      makeLessee("l3", "C", "France"),
    ];
    const leases = [makeLease("l1", 600_000), makeLease("l2", 300_000), makeLease("l3", 100_000)];
    const result = computePortfolioPaymentBehaviourMix(lessees, leases);
    const total = result.rows.reduce((s, r) => s + r.rentalSharePct, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/paymentBehaviour.test.ts 2>&1 | tail -8
```

Expected: FAIL — cannot find module `./paymentBehaviour`.

- [ ] **Step 3: Implement `paymentBehaviour.ts`**

Create `src/app/utils/paymentBehaviour.ts`:

```typescript
// src/app/utils/paymentBehaviour.ts
// Pure-function utilities for regional payment behaviour scoring and ECL mix computation.
// No React dependencies — safe to use in both components and tests.

import type { Lessee, Lease } from "../types/portfolio";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Payment behaviour tier derived from country score.
 *   cooperative  = score ≥ 70 → −7% ECL adjustment
 *   neutral      = score 40–69 → 0% adjustment
 *   adversarial  = score < 40  → +12% ECL adjustment
 */
export type PayBehaviourTier = "cooperative" | "neutral" | "adversarial";

export interface PayBehaviourRow {
  lesseeName:     string;
  country:        string;
  score:          number;       // 0–100; 50 for unknown countries
  tier:           PayBehaviourTier;
  monthlyRentalM: number;       // $M
  rentalSharePct: number;       // 0–1
}

// ─── Score table ──────────────────────────────────────────────────────────────

/**
 * Payment behaviour scores by country (0–100).
 * Keys are lowercase country names (matched case-insensitively against lessee.country).
 * Countries absent from this map default to score 50 (neutral tier).
 *
 * Calibration basis: IATA DPD data, lessor workout precedents, government intervention history.
 */
export const PAYMENT_BEHAVIOUR_SCORES: Record<string, number> = {
  "united states":    85,
  "canada":           68,
  "ireland":          85,
  "germany":          78,
  "france":           55,
  "netherlands":      80,
  "spain":            52,
  "italy":            48,
  "united arab emirates": 82,
  "uae":              82,   // alias
  "singapore":        90,
  "australia":        80,
  "japan":            88,
  "south korea":      75,
  "india":            42,
  "sri lanka":        28,
  "indonesia":        30,
  "mexico":           32,
  "brazil":           38,
  "colombia":         35,
  "argentina":        20,
  "south africa":     38,
  "kenya":            35,
  "ethiopia":         45,
  "nigeria":          25,
  "pakistan":         22,
  "russia":           15,
  "turkey":           42,
  "qatar":            88,
  "saudi arabia":     75,
  "china":            45,
  "thailand":         40,
  "malaysia":         42,
  "philippines":      35,
};

/** Default score for countries not in the table — neutral tier. */
const DEFAULT_SCORE = 50;

// ─── Classification ───────────────────────────────────────────────────────────

/**
 * Classify a numeric score (0–100) into a payment behaviour tier.
 *   ≥ 70 → cooperative
 *   40–69 → neutral
 *   < 40  → adversarial
 */
export function payBehaviourTier(score: number): PayBehaviourTier {
  if (score >= 70) return "cooperative";
  if (score >= 40) return "neutral";
  return "adversarial";
}

// ─── Portfolio computation ────────────────────────────────────────────────────

/**
 * Compute the rental-weighted payment behaviour tier mix for a lessee/lease set.
 *
 * - Lessees with no matching lease or null/zero monthly_rental are excluded.
 * - lessee.country is matched case-insensitively against PAYMENT_BEHAVIOUR_SCORES.
 * - Countries absent from the table default to neutral (score 50).
 * - null country → neutral (score 50).
 *
 * Returns:
 *   coopPct — 0–1 share of fleet rental in Cooperative tier
 *   advPct  — 0–1 share of fleet rental in Adversarial tier
 *   rows    — per-lessee breakdown, sorted by score ascending then monthlyRentalM descending
 */
export function computePortfolioPaymentBehaviourMix(
  lessees: Lessee[],
  leases:  Lease[],
): { coopPct: number; advPct: number; rows: PayBehaviourRow[] } {
  if (lessees.length === 0 || leases.length === 0) {
    return { coopPct: 0, advPct: 0, rows: [] };
  }

  // Build lessee_id → first matching lease with positive rental
  const leaseByLessee = new Map<string, Lease>();
  for (const lease of leases) {
    if (!leaseByLessee.has(lease.lessee_id) && (lease.monthly_rental ?? 0) > 0) {
      leaseByLessee.set(lease.lessee_id, lease);
    }
  }

  const rawRows: PayBehaviourRow[] = [];
  let totalRental = 0;

  for (const lessee of lessees) {
    const lease = leaseByLessee.get(lessee.id);
    if (!lease || !lease.monthly_rental) continue;

    const country = (lessee.country ?? "").toLowerCase();
    const score   = PAYMENT_BEHAVIOUR_SCORES[country] ?? DEFAULT_SCORE;
    const tier    = payBehaviourTier(score);
    const rental  = lease.monthly_rental;

    rawRows.push({
      lesseeName:     lessee.name,
      country:        lessee.country ?? "Unknown",
      score,
      tier,
      monthlyRentalM: rental / 1_000_000,
      rentalSharePct: 0, // filled in second pass
    });
    totalRental += rental;
  }

  if (rawRows.length === 0) return { coopPct: 0, advPct: 0, rows: [] };

  // Second pass: compute weights and tier aggregates
  let coopRental = 0;
  let advRental  = 0;

  for (const row of rawRows) {
    row.rentalSharePct = row.monthlyRentalM * 1_000_000 / totalRental;
    if (row.tier === "cooperative") coopRental += row.monthlyRentalM * 1_000_000;
    if (row.tier === "adversarial") advRental  += row.monthlyRentalM * 1_000_000;
  }

  rawRows.sort((a, b) =>
    a.score - b.score ||                        // score ascending (worst first)
    b.monthlyRentalM - a.monthlyRentalM         // then rental descending
  );

  return {
    coopPct: coopRental / totalRental,
    advPct:  advRental  / totalRental,
    rows:    rawRows,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/paymentBehaviour.test.ts 2>&1 | tail -8
```

Expected: 13/13 pass.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -5
```

Expected: all tests pass (prior 143 + 13 new = 156 total).

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/utils/paymentBehaviour.ts src/app/utils/paymentBehaviour.test.ts && git commit -m "feat(utils): add paymentBehaviour utility with country scores and portfolio mix computation"
```

---

## Task 3: `PaymentBehaviourTab.tsx` — new Scenarios tab

**Files:**
- Create: `src/app/components/scenarios/PaymentBehaviourTab.tsx`

### Context

Follow `src/app/components/scenarios/CreditDepositTab.tsx` and `src/app/components/scenarios/JurisdictionRiskTab.tsx` exactly for structure. Key differences:
- Imports `computePortfolioPaymentBehaviourMix` and `PayBehaviourTier` from `../../utils/paymentBehaviour`
- Imports `BASE_ECL` from `../../utils/eclCalculator`
- Props: `onUseInCustomBuilder: (coopPct: number, advPct: number) => void`
- 3 KPI cards: Cooperative %, Adversarial %, Net ECL Impact
- Table columns: Airline · Country · Score · Behaviour Tier · Monthly Rent · Weight %
- Sorted: score ascending (worst first)
- Net ECL impact card: green when negative (net benefit), red when positive (net penalty), grey when zero

---

- [ ] **Step 1: Create `PaymentBehaviourTab.tsx`**

```typescript
// src/app/components/scenarios/PaymentBehaviourTab.tsx
import { usePortfolioData } from "../../hooks/usePortfolioData";
import { computePortfolioPaymentBehaviourMix, type PayBehaviourTier } from "../../utils/paymentBehaviour";
import { BASE_ECL } from "../../utils/eclCalculator";
import { Card } from "../ui/Card";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<PayBehaviourTier, string> = {
  cooperative:  "Cooperative",
  neutral:      "Neutral",
  adversarial:  "Adversarial",
};

const TIER_PILL_BG: Record<PayBehaviourTier, string> = {
  cooperative: "#DCFCE7",
  neutral:     "#F1F5F9",
  adversarial: "#FEE2E2",
};

const TIER_PILL_COLOR: Record<PayBehaviourTier, string> = {
  cooperative: "#15803D",
  neutral:     "#475569",
  adversarial: "#B91C1C",
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

function TierPill({ tier }: { tier: PayBehaviourTier }) {
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
  onUseInCustomBuilder: (coopPct: number, advPct: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PaymentBehaviourTab({ onUseInCustomBuilder }: Props) {
  const { lessees, leases } = usePortfolioData();
  const { coopPct, advPct, rows } = computePortfolioPaymentBehaviourMix(lessees, leases);

  // Net ECL impact: (advPct × 0.12 − coopPct × 0.07) × BASE_ECL
  const netImpactM = rows.length === 0
    ? 0
    : (advPct * 0.12 - coopPct * 0.07) * BASE_ECL;

  // Adversarial KPI colour logic
  const advColor = advPct > 0.30 ? "#B91C1C" : advPct > 0.15 ? "#B45309" : "#15803D";
  const advBg    = advPct > 0.30 ? "#FEE2E2" : advPct > 0.15 ? "#FEF3C7" : "#DCFCE7";

  // Net impact card colour
  const impactColor = netImpactM < -0.01 ? "#15803D" : netImpactM > 0.01 ? "#B91C1C" : "#64748B";
  const impactBg    = netImpactM < -0.01 ? "#DCFCE7" : netImpactM > 0.01 ? "#FEE2E2" : "#F8FAFC";
  const impactValue = rows.length === 0
    ? "—"
    : netImpactM >= 0
      ? `+$${netImpactM.toFixed(2)}M`
      : `−$${Math.abs(netImpactM).toFixed(2)}M`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Cooperative"
          value={rows.length === 0 ? "—" : `${(coopPct * 100).toFixed(1)}%`}
          color="#15803D"
          bg="#DCFCE7"
        />
        <KpiCard
          label="Adversarial"
          value={rows.length === 0 ? "—" : `${(advPct * 100).toFixed(1)}%`}
          color={advColor}
          bg={advBg}
        />
        <KpiCard
          label="Net ECL Impact"
          value={impactValue}
          color={impactColor}
          bg={impactBg}
        />
      </div>

      {/* ── Lessee breakdown table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Lessee Payment Behaviour
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
                    {["Airline", "Country", "Score", "Behaviour Tier", "Monthly Rent", "Weight %"].map((h) => (
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
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569" }}>
                        {row.country}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.score}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <TierPill tier={row.tier} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        ${(row.monthlyRentalM * 1000).toFixed(0)}k
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {(row.rentalSharePct * 100).toFixed(1)}%
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
              onClick={() => onUseInCustomBuilder(coopPct, advPct)}
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
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep -i "paymentBehaviour\|PaymentBehaviour" | head -10
```

Expected: no errors.

- [ ] **Step 3: Run full tests**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/scenarios/PaymentBehaviourTab.tsx && git commit -m "feat(ui): add PaymentBehaviourTab with KPI cards and lessee breakdown"
```

---

## Task 4: `Scenarios.tsx` — full wiring

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

### Context

Mirror the Jurisdiction Risk (Sprint 11) and Security Deposits (Sprint 12) pattern exactly. Key line numbers found by grepping:

- Imports: line 10–13 (JurisdictionRiskTab, CreditDepositTab)
- TEMPLATES: lines 251–552 — six single-line objects (end with `depositCoverage: 0 }`) + nine multi-line objects (end with `depositCoverage: 0,`)
- `generateDSL`: lines 646–649 (deposit conditional spread — add payment behaviour after it)
- `parseDSL`: lines 706–709 (depositCoverage parsing — add payment behaviour after it)
- State: lines 931–932 (jurisdictionOpen, depositOpen)
- useMemo: lines 975–985 (portfolioJurisdictionMix, portfolioDepositMix)
- `updateFormInputs` auto-expand: lines 1003–1006
- Clone effect auto-expand: lines 1072–1074
- Tab list: line 1111
- Custom Builder security deposits section: lines 2497–2618 (ends with `})()}`)
- Tab renders: lines 3002–3023

---

- [ ] **Step 1: Add imports**

After line 13 (`import { CreditDepositTab } from "../components/scenarios/CreditDepositTab";`), add:

```typescript
import { PaymentBehaviourTab } from "../components/scenarios/PaymentBehaviourTab";
import { computePortfolioPaymentBehaviourMix } from "../utils/paymentBehaviour";
```

- [ ] **Step 2: Add `payBehaviourCoopPct: 0, payBehaviourAdvPct: 0` to all TEMPLATES**

Search for `depositCoverage: 0` in Scenarios.tsx — it appears 15 times (15 templates). After every occurrence, add:

```typescript
payBehaviourCoopPct: 0, payBehaviourAdvPct: 0,
```

For single-line templates (6 entries ending with `depositCoverage: 0 }`), the object closes immediately after, so insert before the `}`:

```typescript
depositCoverage: 0, payBehaviourCoopPct: 0, payBehaviourAdvPct: 0 }
```

For multi-line templates (9 entries with `depositCoverage: 0,` on its own line), add the new line after:

```typescript
      depositCoverage: 0,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
```

Verify count:
```bash
grep -c "payBehaviourCoopPct: 0" /Users/tanamsethi/Downloads/Aeroinsights/src/app/pages/Scenarios.tsx
```
Expected: 15.

- [ ] **Step 3: Add `pay_behaviour_coop_pct` / `pay_behaviour_adv_pct` to `generateDSL`**

After the deposit conditional spread (around line 648–649):

```typescript
        // Payment behaviour — omitted when both are 0 (feature inactive = neutral baseline)
        ...(inputs.payBehaviourCoopPct !== 0 || inputs.payBehaviourAdvPct !== 0
          ? { pay_behaviour_coop_pct: inputs.payBehaviourCoopPct, pay_behaviour_adv_pct: inputs.payBehaviourAdvPct }
          : {}),
```

- [ ] **Step 4: Add `payBehaviourCoopPct` / `payBehaviourAdvPct` to `parseDSL`**

After the `depositCoverage` parsing block (around line 709), add:

```typescript
        payBehaviourCoopPct: typeof s.pay_behaviour_coop_pct === "number"
          ? Math.min(1, Math.max(0, s.pay_behaviour_coop_pct))
          : 0,
        payBehaviourAdvPct: (() => {
          const coop = typeof s.pay_behaviour_coop_pct === "number" ? Math.min(1, Math.max(0, s.pay_behaviour_coop_pct)) : 0;
          const raw  = typeof s.pay_behaviour_adv_pct  === "number" ? Math.min(1, Math.max(0, s.pay_behaviour_adv_pct))  : 0;
          return Math.min(raw, Math.max(0, 1 - coop));
        })(),
```

- [ ] **Step 5: Add `payBehaviourOpen` state**

After `const [depositOpen, setDepositOpen] = useState(false);` (line 932), add:

```typescript
  const [payBehaviourOpen, setPayBehaviourOpen] = useState(false);
```

- [ ] **Step 6: Add portfolio payment behaviour useMemo**

After the `portfolioDepositCoverage` line (line 985), add:

```typescript
  // Payment behaviour mix from portfolio lessee countries — used by PaymentBehaviourTab "Use in Custom Builder"
  // and the "From portfolio" button in the Custom Builder Payment Behaviour section.
  const portfolioPayBehaviourMix = React.useMemo(
    () => computePortfolioPaymentBehaviourMix(lessees, leases),
    [lessees, leases]
  );
```

- [ ] **Step 7: Add auto-expand in `updateFormInputs`**

After `if (next.depositCoverage !== 0) setDepositOpen(true);` (line 1006), add:

```typescript
    if (next.payBehaviourCoopPct !== 0 || next.payBehaviourAdvPct !== 0) setPayBehaviourOpen(true);
```

Also add `setPayBehaviourOpen` to the `useCallback` dependency array on line 1007.

- [ ] **Step 8: Add auto-expand in clone effect**

After `if (clonePending.inputs.depositCoverage !== 0) setDepositOpen(true);` (line 1074), add:

```typescript
    if (clonePending.inputs.payBehaviourCoopPct !== 0 || clonePending.inputs.payBehaviourAdvPct !== 0) setPayBehaviourOpen(true);
```

- [ ] **Step 9: Add "Payment Behaviour" to the tab list**

Change line 1111 from:

```typescript
    : ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Security Deposits", "Lease Pricing"];
```

to:

```typescript
    : ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Security Deposits", "Payment Behaviour", "Lease Pricing"];
```

- [ ] **Step 10: Add "Payment Behaviour" Custom Builder collapsible section**

Immediately after the closing `})()}` of the Security Deposits section (around line 2618) and before the `{/* Live ECL preview */}` block, add:

```tsx
                  {/* ── Payment Behaviour — collapsible ── */}
                  {(() => {
                    const coopPct   = formInputs.payBehaviourCoopPct;
                    const advPct    = formInputs.payBehaviourAdvPct;
                    const isActive  = coopPct !== 0 || advPct !== 0;
                    const netDeltaM = (advPct * 0.12 - coopPct * 0.07) * liveBaseECL;

                    return (
                      <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                        {/* Section header */}
                        <button
                          onClick={() => setPayBehaviourOpen((o) => !o)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.875rem",
                            background: payBehaviourOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                            border: "none", cursor: "pointer",
                            borderBottom: payBehaviourOpen ? "1px solid #E2E8F0" : "none",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Payment Behaviour
                            </span>
                            {isActive ? (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                {(coopPct * 100).toFixed(0)}% Coop / {(advPct * 100).toFixed(0)}% Adv
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>None (neutral baseline)</span>
                            )}
                          </div>
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: payBehaviourOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
                          >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {/* Collapsible body */}
                        <AnimatePresence initial={false}>
                          {payBehaviourOpen && (
                            <motion.div
                              key="paybehaviour-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0.875rem" }}>
                                {/* Cooperative slider */}
                                <SliderRow
                                  label="Cooperative %"
                                  min={0} max={1} step={0.01}
                                  value={coopPct}
                                  onChange={(v) => updateFormInputs({ payBehaviourCoopPct: Math.min(v, Math.max(0, 1 - advPct)) })}
                                  fmt={(v) => `${(v * 100).toFixed(0)}% of fleet`}
                                />

                                {/* Adversarial slider */}
                                <div style={{ marginTop: "0.5rem" }}>
                                  <SliderRow
                                    label="Adversarial %"
                                    min={0} max={1} step={0.01}
                                    value={advPct}
                                    onChange={(v) => updateFormInputs({ payBehaviourAdvPct: Math.min(v, Math.max(0, 1 - coopPct)) })}
                                    fmt={(v) => `${(v * 100).toFixed(0)}% of fleet`}
                                  />
                                </div>

                                {/* "From portfolio" button */}
                                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <button
                                    onClick={() => updateFormInputs({
                                      payBehaviourCoopPct: portfolioPayBehaviourMix.coopPct,
                                      payBehaviourAdvPct:  portfolioPayBehaviourMix.advPct,
                                    })}
                                    style={{
                                      fontSize: "0.75rem", fontWeight: 600,
                                      padding: "0.25rem 0.625rem",
                                      background: "rgba(0,33,71,0.06)", color: "#002147",
                                      border: "1px solid rgba(0,33,71,0.15)", borderRadius: "0.25rem",
                                      cursor: "pointer",
                                    }}
                                    title="Computed from your portfolio's lessee countries, weighted by monthly rental."
                                  >
                                    From portfolio
                                  </button>
                                  <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
                                    {(portfolioPayBehaviourMix.coopPct * 100).toFixed(0)}% Coop / {(portfolioPayBehaviourMix.advPct * 100).toFixed(0)}% Adv
                                  </span>
                                </div>

                                {/* Net impact */}
                                <div style={{
                                  marginTop: "0.875rem", fontSize: "0.8125rem",
                                  color: !isActive ? "#94A3B8" : netDeltaM < 0 ? "#15803D" : "#B91C1C",
                                  fontVariantNumeric: "tabular-nums",
                                }}>
                                  Behaviour Adjustment{" "}
                                  <span style={{ fontWeight: 700 }}>
                                    {!isActive
                                      ? "$0"
                                      : netDeltaM >= 0
                                        ? `+$${netDeltaM.toFixed(1)}M`
                                        : `−$${Math.abs(netDeltaM).toFixed(1)}M`}
                                  </span>
                                  {isActive && (
                                    <>
                                      <span style={{ color: "#CBD5E1", margin: "0 0.5rem" }}>·</span>
                                      <span style={{ color: "#64748B" }}>
                                        {(coopPct * 100).toFixed(0)}% Coop / {(advPct * 100).toFixed(0)}% Adv
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

- [ ] **Step 11: Add `PaymentBehaviourTab` render**

After the Security Deposits tab render block (around line 3022, after the `CreditDepositTab` block), add:

```tsx
      {/* ══ PAYMENT BEHAVIOUR TAB ═══════════════════════════════════════ */}
      {activeTab === "Payment Behaviour" && (
        <PaymentBehaviourTab
          onUseInCustomBuilder={(coop, adv) => {
            setActiveTab("Custom Builder");
            updateFormInputs({ payBehaviourCoopPct: coop, payBehaviourAdvPct: adv });
          }}
        />
      )}
```

- [ ] **Step 12: Add `setPayBehaviourOpen(false)` to reset**

Find where `setDepositOpen(false)` is called in the reset handler (line 2642). Add immediately after:

```typescript
                        setPayBehaviourOpen(false);
```

- [ ] **Step 13: Run full tests**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -5
```

Expected: all 156 tests pass (no regressions).

- [ ] **Step 14: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 15: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Scenarios.tsx && git commit -m "feat(scenarios): wire Payment Behaviour tab and Custom Builder section"
```

---

## Task 5: Deploy

- [ ] **Step 1: Run full tests one final time**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 2: Push to origin/main**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git push origin main
```

Expected: remote accepts push.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in plan |
|---|---|
| `payBehaviourTier(score)` classification | Task 2 |
| `PAYMENT_BEHAVIOUR_SCORES` table (32 countries) | Task 2 |
| `computePortfolioPaymentBehaviourMix()` returns coopPct, advPct, rows | Task 2 |
| Unknown country → neutral (score 50) | Task 2 (DEFAULT_SCORE) |
| `payBehaviourCoopPct` + `payBehaviourAdvPct` in ScenarioInputs | Task 1 |
| `payBehaviourDelta = (adv×0.12 − coop×0.07) × baseECL` | Task 1 |
| Guard: both 0 → 0 delta | Task 1 |
| `PaymentBehaviourTab` 3 KPI cards | Task 3 |
| Table: Airline · Country · Score · Tier · Rent · Weight % | Task 3 |
| Sorted by score ascending | Task 3 (sort in utility) |
| "Use in Custom Builder" CTA passes both coopPct + advPct | Task 3 |
| "Payment Behaviour" tab in Scenarios | Task 4 step 9, 11 |
| Custom Builder collapsible with 2 sliders | Task 4 step 10 |
| Coop slider clamped to max(0, 1−advPct) | Task 4 step 10 |
| Adv slider clamped to max(0, 1−coopPct) | Task 4 step 10 |
| "From portfolio" button fills both values | Task 4 step 10 |
| Net impact line (±$X.XM · X% Coop / X% Adv) | Task 4 step 10 |
| DSL `pay_behaviour_coop_pct` + `pay_behaviour_adv_pct` | Task 4 steps 3–4 |
| parseDSL cross-field clamp (advPct ≤ max(0,1−coopPct)) | Task 4 step 4 |
| Auto-expand on active field | Task 4 steps 7–8 |
| Reset collapses section | Task 4 step 12 |
| All 15 templates updated | Task 4 step 2 |

**Type consistency check:** `PayBehaviourTier`, `PayBehaviourRow`, `computePortfolioPaymentBehaviourMix` defined in Task 2 and consumed in Tasks 3 and 4. `payBehaviourCoopPct` / `payBehaviourAdvPct` defined in Task 1 and referenced in Task 4 — consistent naming throughout.

**Placeholder scan:** No TBD, no vague steps. Every step has exact code.
