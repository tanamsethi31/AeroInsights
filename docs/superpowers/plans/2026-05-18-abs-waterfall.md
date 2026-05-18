# ABS Waterfall Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Transactions section with a standard 3-tranche aviation ABS waterfall engine — DSCR/LTV coverage tests, distribution statement, and deal management backed by Supabase.

**Architecture:** Pure TypeScript waterfall engine (client-side, testable in isolation) + one Supabase table (`abs_deals`) for deal config. All four UI components are thin wrappers over the engine. Follows the exact same pattern as the ECL engine + `useEclSnapshots`.

**Tech Stack:** React, TypeScript, Vitest, Supabase JS v2, Framer Motion, lucide-react, inline styles only (no CSS modules).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/007_abs_deals.sql` | Create | DB table for deal config |
| `src/app/utils/absWaterfall.ts` | Create | Types + pure waterfall engine |
| `src/app/utils/absWaterfall.test.ts` | Create | 4 unit tests |
| `src/app/hooks/useAbsDeals.ts` | Create | Supabase CRUD, cancelled-flag pattern |
| `src/app/components/transactions/DealSetupModal.tsx` | Create | 3-step deal creation modal |
| `src/app/components/transactions/CollectionOverridesTable.tsx` | Create | Per-lease collection input |
| `src/app/components/transactions/CoverageTestPanel.tsx` | Create | DSCR/LTV gauges |
| `src/app/components/transactions/DistributionStatement.tsx` | Create | Waterfall output table |
| `src/app/pages/Transactions.tsx` | Create | Top-level page, 4 tabs |
| `src/app/routes.tsx` | Modify | Add `/transactions` routes |
| `src/app/components/layout/Sidebar.tsx` | Modify | Add Transactions nav item |

---

## Task 1: Waterfall engine types, engine, and tests

**Files:**
- Create: `src/app/utils/absWaterfall.ts`
- Create: `src/app/utils/absWaterfall.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/app/utils/absWaterfall.test.ts`:

```typescript
// src/app/utils/absWaterfall.test.ts
import { describe, it, expect } from "vitest";
import { runWaterfall } from "./absWaterfall";
import type { NoteClass, ReserveAccounts, CoverageTestConfig, SeniorExpenses, CollectionInput } from "./absWaterfall";

// Shared fixtures
const NOTE_CLASSES: NoteClass[] = [
  { label: "A", outstandingBalance: 100, couponRate: 0.06, scheduledPrincipal: 1.0 },
  { label: "B", outstandingBalance: 25,  couponRate: 0.08, scheduledPrincipal: 0.3 },
  { label: "C", outstandingBalance: 10,  couponRate: 0.10, scheduledPrincipal: 0.1 },
];
const RESERVES: ReserveAccounts = {
  liquidityReserve: { target: 5, balance: 5 },
  cashTrap: { balance: 0 },
};
const COVERAGE: CoverageTestConfig = { dscrTrigger: 1.15, ltvTrigger: 0.75 };
const EXPENSES: SeniorExpenses = {
  servicerFeePct: 0.005,
  trusteeFee: 0.02,
  adminFee: 0.01,
  paymentFrequency: "monthly",
};
// monthly interest: A=0.5M, B=0.1667M, C=0.0833M

function makeCollections(actual: number): CollectionInput[] {
  return [{ leaseId: "L1", lessee: "AirCo", expectedRent: actual, actualCollected: actual }];
}

describe("runWaterfall", () => {
  it("full pass — DSCR and LTV both pass, all classes paid, residual > 0", () => {
    // collections=3.0M: seniorExpenses=0.005*3+0.03=0.045, remaining=2.955
    // ClassA interest=0.5, principal=1.0 → remaining=1.455
    // DSCR=(3-0.045)/1.5=1.97 ≥ 1.15 → passes
    // ClassB interest=0.1667, principal=0.3 → remaining=0.9883
    // LTV=135/200=0.675 ≤ 0.75 → passes
    // ClassC interest=0.0833, principal=0.1 → remaining=0.805
    const result = runWaterfall(
      makeCollections(3.0), NOTE_CLASSES, RESERVES, COVERAGE, EXPENSES, 200
    );
    expect(result.dscrResult.passed).toBe(true);
    expect(result.ltvResult.passed).toBe(true);
    expect(result.cashTrapTotal).toBe(0);
    expect(result.noteDistributions[0].shortfall).toBe(0); // Class A fully paid
    expect(result.noteDistributions[1].shortfall).toBeCloseTo(0, 2); // Class B fully paid
    expect(result.noteDistributions[2].shortfall).toBeCloseTo(0, 2); // Class C fully paid
    expect(result.residualToEquity).toBeGreaterThan(0);
  });

  it("DSCR breach — Class B and C receive nothing, remaining cash traps", () => {
    // collections=1.6M: seniorExpenses=0.005*1.6+0.03=0.038, remaining=1.562
    // ClassA interest=0.5, principal=1.0 → remaining=0.062
    // DSCR=(1.6-0.038)/1.5=1.041 < 1.15 → BREACH
    // cashTrapped=0.062, remaining=0
    const result = runWaterfall(
      makeCollections(1.6), NOTE_CLASSES, RESERVES, COVERAGE, EXPENSES, 200
    );
    expect(result.dscrResult.passed).toBe(false);
    expect(result.dscrResult.cashTrapped).toBeCloseTo(0.062, 2);
    expect(result.noteDistributions[1].interestPaid).toBe(0); // Class B
    expect(result.noteDistributions[1].principalPaid).toBe(0);
    expect(result.noteDistributions[2].interestPaid).toBe(0); // Class C
    expect(result.residualToEquity).toBe(0);
  });

  it("LTV breach — DSCR passes but LTV > trigger, Class C receives nothing", () => {
    // Same collections=3.0M but portfolioValue=150M → LTV=135/150=0.9 > 0.75 → BREACH
    // After ClassB service remaining≈0.9883, all traps before C
    const result = runWaterfall(
      makeCollections(3.0), NOTE_CLASSES, RESERVES, COVERAGE, EXPENSES, 150
    );
    expect(result.dscrResult.passed).toBe(true);
    expect(result.ltvResult.passed).toBe(false);
    expect(result.ltvResult.cashTrapped).toBeGreaterThan(0);
    expect(result.noteDistributions[2].interestPaid).toBe(0); // Class C
    expect(result.noteDistributions[2].principalPaid).toBe(0);
    expect(result.residualToEquity).toBe(0);
  });

  it("cash shortfall — insufficient for Class A in full, shortfall recorded", () => {
    // collections=0.5M: after expenses≈0.0325, remaining=0.4675
    // ClassA interest due=0.5 → paid=0.4675, shortfall=0.0325
    // ClassA principal due=1.0 → paid=0, shortfall=1.0
    const result = runWaterfall(
      makeCollections(0.5), NOTE_CLASSES, RESERVES, COVERAGE, EXPENSES, 200
    );
    expect(result.noteDistributions[0].shortfall).toBeGreaterThan(0); // Class A shortfall
    expect(result.noteDistributions[1].interestPaid).toBe(0);
    expect(result.noteDistributions[2].interestPaid).toBe(0);
    expect(result.residualToEquity).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/app/utils/absWaterfall.test.ts
```

Expected: FAIL — "Cannot find module './absWaterfall'"

- [ ] **Step 3: Implement the waterfall engine**

Create `src/app/utils/absWaterfall.ts`:

```typescript
// src/app/utils/absWaterfall.ts
import { AIRCRAFT_BASE_VALUE } from "../data/dealsData";
import type { Asset } from "../types/portfolio";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoteClass {
  label: "A" | "B" | "C";
  outstandingBalance: number;   // $M
  couponRate: number;            // annual, e.g. 0.055
  scheduledPrincipal: number;   // $M this period
}

export interface ReserveAccounts {
  liquidityReserve: { target: number; balance: number };
  cashTrap: { balance: number };
}

export interface CoverageTestConfig {
  dscrTrigger: number;  // e.g. 1.15
  ltvTrigger: number;   // e.g. 0.75
}

export interface SeniorExpenses {
  servicerFeePct: number;
  trusteeFee: number;
  adminFee: number;
  paymentFrequency: "monthly" | "quarterly";
}

export interface CollectionInput {
  leaseId: string;
  lessee: string;
  expectedRent: number;    // $M
  actualCollected: number; // $M — user may override
}

export interface NoteDistribution {
  noteClass: "A" | "B" | "C";
  interestPaid: number;
  principalPaid: number;
  shortfall: number;
}

export interface CoverageTestResult {
  value: number;
  trigger: number;
  passed: boolean;
  cashTrapped: number;
}

export interface WaterfallResult {
  availableCollections: number;
  seniorExpensesTotal: number;
  liquidityReserveTopUp: number;
  noteDistributions: NoteDistribution[];
  dscrResult: CoverageTestResult;
  ltvResult: CoverageTestResult;
  cashTrapTotal: number;
  residualToEquity: number;
}

export interface AbsDeal {
  id: string;
  orgId: string;
  dealName: string;
  closingDate: string;
  currency: string;
  noteClasses: NoteClass[];
  reserveAccounts: ReserveAccounts;
  coverageTests: CoverageTestConfig;
  seniorExpenses: SeniorExpenses;
  aircraftIds: string[];
  createdAt: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function pay(available: number, due: number): { paid: number; shortfall: number } {
  const paid = Math.min(available, Math.max(0, due));
  return { paid, shortfall: Math.max(0, due - paid) };
}

// ─── Aircraft value helper ────────────────────────────────────────────────────

export function computePortfolioAircraftValue(
  aircraftIds: string[],
  assets: Pick<Asset, "id" | "aircraft_type" | "vintage">[]
): number {
  return aircraftIds.reduce((sum, id) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return sum;
    const base = (AIRCRAFT_BASE_VALUE[asset.aircraft_type] ?? 25_000_000);
    const ageYears = new Date().getFullYear() - (asset.vintage ?? 2010);
    const haircut = Math.max(0.4, 1 - 0.03 * ageYears);
    return sum + (base * haircut) / 1_000_000; // convert to $M
  }, 0);
}

// ─── Core waterfall engine ────────────────────────────────────────────────────

export function runWaterfall(
  collections: CollectionInput[],
  noteClasses: NoteClass[],
  reserveAccounts: ReserveAccounts,
  coverageTests: CoverageTestConfig,
  seniorExpenses: SeniorExpenses,
  portfolioAircraftValueM: number
): WaterfallResult {
  const paymentsPerYear = seniorExpenses.paymentFrequency === "monthly" ? 12 : 4;
  const totalCollections = collections.reduce((s, c) => s + c.actualCollected, 0);

  // Step 1: Senior expenses
  const seniorExpensesTotal =
    seniorExpenses.servicerFeePct * totalCollections +
    seniorExpenses.trusteeFee +
    seniorExpenses.adminFee;
  let remaining = Math.max(0, totalCollections - seniorExpensesTotal);

  // Step 2: Liquidity reserve top-up
  const lrNeeded = Math.max(
    0,
    reserveAccounts.liquidityReserve.target - reserveAccounts.liquidityReserve.balance
  );
  const lrResult = pay(remaining, lrNeeded);
  remaining -= lrResult.paid;
  const liquidityReserveTopUp = lrResult.paid;

  const classA = noteClasses.find(n => n.label === "A")!;
  const classB = noteClasses.find(n => n.label === "B")!;
  const classC = noteClasses.find(n => n.label === "C")!;

  // Steps 3-4: Class A
  const classAInterestDue = (classA.outstandingBalance * classA.couponRate) / paymentsPerYear;
  const classAInt = pay(remaining, classAInterestDue);
  remaining -= classAInt.paid;
  const classAPrin = pay(remaining, classA.scheduledPrincipal);
  remaining -= classAPrin.paid;

  // Step 5: DSCR test
  const netCash = totalCollections - seniorExpensesTotal;
  const classAService = classAInterestDue + classA.scheduledPrincipal;
  const dscr = classAService > 0 ? netCash / classAService : 999;
  const dscrPassed = dscr >= coverageTests.dscrTrigger;

  let dscrCashTrapped = 0;
  let classBIntPaid = 0, classBPrinPaid = 0, classBShortfall = 0;
  let ltvCashTrapped = 0;
  let classCIntPaid = 0, classCPrinPaid = 0, classCShortfall = 0;

  const classBInterestDue = (classB.outstandingBalance * classB.couponRate) / paymentsPerYear;
  const classCInterestDue = (classC.outstandingBalance * classC.couponRate) / paymentsPerYear;
  const totalOutstanding =
    classA.outstandingBalance + classB.outstandingBalance + classC.outstandingBalance;
  const ltv =
    portfolioAircraftValueM > 0 ? totalOutstanding / portfolioAircraftValueM : 0;
  const ltvPassed = ltv <= coverageTests.ltvTrigger;

  if (!dscrPassed) {
    dscrCashTrapped = remaining;
    remaining = 0;
    classBShortfall = classBInterestDue + classB.scheduledPrincipal;
    classCShortfall = classCInterestDue + classC.scheduledPrincipal;
  } else {
    // Steps 6-7: Class B
    const bInt = pay(remaining, classBInterestDue);
    classBIntPaid = bInt.paid;
    remaining -= bInt.paid;
    const bPrin = pay(remaining, classB.scheduledPrincipal);
    classBPrinPaid = bPrin.paid;
    classBShortfall = bInt.shortfall + bPrin.shortfall;
    remaining -= bPrin.paid;

    // Step 8: LTV test
    if (!ltvPassed) {
      ltvCashTrapped = remaining;
      remaining = 0;
      classCShortfall = classCInterestDue + classC.scheduledPrincipal;
    } else {
      // Steps 9-10: Class C
      const cInt = pay(remaining, classCInterestDue);
      classCIntPaid = cInt.paid;
      remaining -= cInt.paid;
      const cPrin = pay(remaining, classC.scheduledPrincipal);
      classCPrinPaid = cPrin.paid;
      classCShortfall = cInt.shortfall + cPrin.shortfall;
      remaining -= cPrin.paid;
    }
  }

  return {
    availableCollections: totalCollections,
    seniorExpensesTotal,
    liquidityReserveTopUp,
    noteDistributions: [
      {
        noteClass: "A",
        interestPaid: classAInt.paid,
        principalPaid: classAPrin.paid,
        shortfall: classAInt.shortfall + classAPrin.shortfall,
      },
      { noteClass: "B", interestPaid: classBIntPaid, principalPaid: classBPrinPaid, shortfall: classBShortfall },
      { noteClass: "C", interestPaid: classCIntPaid, principalPaid: classCPrinPaid, shortfall: classCShortfall },
    ],
    dscrResult: { value: dscr, trigger: coverageTests.dscrTrigger, passed: dscrPassed, cashTrapped: dscrCashTrapped },
    ltvResult:  { value: ltv,  trigger: coverageTests.ltvTrigger,  passed: ltvPassed,  cashTrapped: ltvCashTrapped  },
    cashTrapTotal: dscrCashTrapped + ltvCashTrapped,
    residualToEquity: remaining,
  };
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx vitest run src/app/utils/absWaterfall.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/absWaterfall.ts src/app/utils/absWaterfall.test.ts
git commit -m "feat: add ABS waterfall engine with DSCR/LTV coverage tests"
```

---

## Task 2: Database migration

**Files:**
- Create: `supabase/migrations/007_abs_deals.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/007_abs_deals.sql`:

```sql
-- supabase/migrations/007_abs_deals.sql
-- ABS deal configuration: one row per deal per org

create table if not exists abs_deals (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  deal_name        text not null,
  closing_date     date not null,
  currency         text not null default 'USD',
  note_classes     jsonb not null,
  reserve_accounts jsonb not null,
  coverage_tests   jsonb not null,
  senior_expenses  jsonb not null,
  aircraft_ids     jsonb not null default '[]',
  created_at       timestamptz not null default now()
);

create index if not exists abs_deals_org_idx
  on abs_deals(org_id, created_at desc);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/007_abs_deals.sql
git commit -m "feat: add abs_deals migration for ABS deal config"
```

---

## Task 3: useAbsDeals hook

**Files:**
- Create: `src/app/hooks/useAbsDeals.ts`

- [ ] **Step 1: Implement the hook**

Create `src/app/hooks/useAbsDeals.ts`:

```typescript
// src/app/hooks/useAbsDeals.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import type { AbsDeal } from "../utils/absWaterfall";

function mapRow(r: Record<string, unknown>): AbsDeal {
  return {
    id:              r.id as string,
    orgId:           r.org_id as string,
    dealName:        r.deal_name as string,
    closingDate:     r.closing_date as string,
    currency:        r.currency as string,
    noteClasses:     r.note_classes as AbsDeal["noteClasses"],
    reserveAccounts: r.reserve_accounts as AbsDeal["reserveAccounts"],
    coverageTests:   r.coverage_tests as AbsDeal["coverageTests"],
    seniorExpenses:  r.senior_expenses as AbsDeal["seniorExpenses"],
    aircraftIds:     r.aircraft_ids as string[],
    createdAt:       r.created_at as string,
  };
}

interface UseAbsDealsReturn {
  deals:      AbsDeal[];
  loading:    boolean;
  createDeal: (payload: Omit<AbsDeal, "id" | "createdAt" | "orgId">) => Promise<void>;
}

export function useAbsDeals(): UseAbsDealsReturn {
  const { orgId } = useData();
  const [deals, setDeals]     = useState<AbsDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!orgId) { setLoading(false); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from("abs_deals")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (!error && data) {
        setDeals((data as Record<string, unknown>[]).map(mapRow));
      }
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [orgId]);

  const createDeal = useCallback(
    async (payload: Omit<AbsDeal, "id" | "createdAt" | "orgId">) => {
      if (!orgId) return;
      const { error } = await supabase.from("abs_deals").insert({
        org_id:          orgId,
        deal_name:       payload.dealName,
        closing_date:    payload.closingDate,
        currency:        payload.currency,
        note_classes:    payload.noteClasses,
        reserve_accounts: payload.reserveAccounts,
        coverage_tests:  payload.coverageTests,
        senior_expenses: payload.seniorExpenses,
        aircraft_ids:    payload.aircraftIds,
      });
      if (error) throw error;
      // Inline refresh — same pattern as useEclSnapshots.lockPeriod
      const { data } = await supabase
        .from("abs_deals")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (data) setDeals((data as Record<string, unknown>[]).map(mapRow));
    },
    [orgId]
  );

  return { deals, loading, createDeal };
}
```

- [ ] **Step 2: Run full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/hooks/useAbsDeals.ts
git commit -m "feat: add useAbsDeals hook for ABS deal Supabase CRUD"
```

---

## Task 4: DealSetupModal

**Files:**
- Create: `src/app/components/transactions/DealSetupModal.tsx`

- [ ] **Step 1: Implement DealSetupModal**

Create `src/app/components/transactions/DealSetupModal.tsx`:

```typescript
// src/app/components/transactions/DealSetupModal.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import type { AbsDeal, NoteClass } from "../../utils/absWaterfall";
import { useData } from "../../contexts/DataContext";

interface Props {
  open:     boolean;
  onClose:  () => void;
  onCreate: (payload: Omit<AbsDeal, "id" | "createdAt" | "orgId">) => Promise<void>;
}

interface FormState {
  dealName:                string;
  closingDate:             string;
  currency:                string;
  paymentFrequency:        "monthly" | "quarterly";
  classABalance:           string;
  classACoupon:            string;
  classAPrincipal:         string;
  classBBalance:           string;
  classBCoupon:            string;
  classBPrincipal:         string;
  classCBalance:           string;
  classCCoupon:            string;
  classCPrincipal:         string;
  lrTarget:                string;
  lrBalance:               string;
  dscrTrigger:             string;
  ltvTrigger:              string;
  servicerFeePct:          string;
  trusteeFee:              string;
  adminFee:                string;
  selectedAircraftIds:     string[];
}

const EMPTY: FormState = {
  dealName: "", closingDate: "", currency: "USD", paymentFrequency: "quarterly",
  classABalance: "", classACoupon: "5.5", classAPrincipal: "",
  classBBalance: "", classBCoupon: "7.5", classBPrincipal: "",
  classCBalance: "", classCCoupon: "9.5", classCPrincipal: "",
  lrTarget: "15", lrBalance: "15",
  dscrTrigger: "1.15", ltvTrigger: "0.75",
  servicerFeePct: "0.5", trusteeFee: "0.05", adminFee: "0.02",
  selectedAircraftIds: [],
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px",
  border: "1px solid #334155", background: "#0F172A", color: "#F8FAFC",
  fontSize: "0.875rem", outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.75rem", color: "#94A3B8",
  marginBottom: "0.25rem", fontWeight: 500,
};

export function DealSetupModal({ open, onClose, onCreate }: Props) {
  const { assets } = useData();
  const [step, setStep]   = useState<1 | 2 | 3>(1);
  const [form, setForm]   = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (open) { setStep(1); setForm(EMPTY); setSaving(false); setError(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const set = (k: keyof FormState, v: string | string[]) =>
    setForm(f => ({ ...f, [k]: v }));

  const canNext1 = form.dealName.trim() && form.closingDate;
  const canNext2 =
    form.classABalance && form.classACoupon && form.classAPrincipal &&
    form.classBBalance && form.classBCoupon && form.classBPrincipal &&
    form.classCBalance && form.classCCoupon && form.classCPrincipal &&
    form.dscrTrigger && form.ltvTrigger && form.servicerFeePct;

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const noteClasses: NoteClass[] = [
        { label: "A", outstandingBalance: parseFloat(form.classABalance), couponRate: parseFloat(form.classACoupon) / 100, scheduledPrincipal: parseFloat(form.classAPrincipal) },
        { label: "B", outstandingBalance: parseFloat(form.classBBalance), couponRate: parseFloat(form.classBCoupon) / 100, scheduledPrincipal: parseFloat(form.classBPrincipal) },
        { label: "C", outstandingBalance: parseFloat(form.classCBalance), couponRate: parseFloat(form.classCCoupon) / 100, scheduledPrincipal: parseFloat(form.classCPrincipal) },
      ];
      await onCreate({
        dealName:     form.dealName.trim(),
        closingDate:  form.closingDate,
        currency:     form.currency,
        noteClasses,
        reserveAccounts: {
          liquidityReserve: { target: parseFloat(form.lrTarget || "0"), balance: parseFloat(form.lrBalance || "0") },
          cashTrap: { balance: 0 },
        },
        coverageTests: {
          dscrTrigger: parseFloat(form.dscrTrigger),
          ltvTrigger:  parseFloat(form.ltvTrigger),
        },
        seniorExpenses: {
          servicerFeePct:   parseFloat(form.servicerFeePct) / 100,
          trusteeFee:        parseFloat(form.trusteeFee || "0"),
          adminFee:          parseFloat(form.adminFee || "0"),
          paymentFrequency: form.paymentFrequency,
        },
        aircraftIds: form.selectedAircraftIds,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create deal");
    } finally {
      setSaving(false);
    }
  }

  // Total current MV of selected aircraft (rough heuristic from dealsData)
  const selectedMV = form.selectedAircraftIds.length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            style={{ background: "#1E293B", borderRadius: "12px", padding: "1.5rem",
              width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto",
              border: "1px solid #334155" }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ margin: 0, color: "#F8FAFC", fontSize: "1.125rem", fontWeight: 600 }}>
                  New ABS Deal
                </h2>
                <p style={{ margin: "0.25rem 0 0", color: "#94A3B8", fontSize: "0.8125rem" }}>
                  Step {step} of 3
                </p>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: "0.25rem" }}>
                <X size={18} />
              </button>
            </div>

            {/* Step 1: Deal Info */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={labelStyle}>Deal Name</label>
                  <input style={inputStyle} value={form.dealName} onChange={e => set("dealName", e.target.value)} placeholder='e.g. "ATLAS 2024-1"' />
                </div>
                <div>
                  <label style={labelStyle}>Closing Date</label>
                  <input style={inputStyle} type="date" value={form.closingDate} onChange={e => set("closingDate", e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={labelStyle}>Currency</label>
                    <select style={inputStyle} value={form.currency} onChange={e => set("currency", e.target.value)}>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Payment Frequency</label>
                    <select style={inputStyle} value={form.paymentFrequency} onChange={e => set("paymentFrequency", e.target.value as "monthly" | "quarterly")}>
                      <option value="quarterly">Quarterly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Note Classes & Reserves */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {(["A", "B", "C"] as const).map((cls, i) => {
                  const balKey = `class${cls}Balance` as keyof FormState;
                  const cpnKey = `class${cls}Coupon` as keyof FormState;
                  const priKey = `class${cls}Principal` as keyof FormState;
                  return (
                    <div key={cls}>
                      <p style={{ margin: "0 0 0.5rem", color: "#CBD5E1", fontSize: "0.875rem", fontWeight: 600 }}>
                        Class {cls} Notes
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                        <div>
                          <label style={labelStyle}>Outstanding ($M)</label>
                          <input style={inputStyle} type="number" min="0" step="0.1"
                            value={form[balKey] as string} onChange={e => set(balKey, e.target.value)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Coupon (%)</label>
                          <input style={inputStyle} type="number" min="0" step="0.1"
                            value={form[cpnKey] as string} onChange={e => set(cpnKey, e.target.value)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Sched. Principal ($M)</label>
                          <input style={inputStyle} type="number" min="0" step="0.1"
                            value={form[priKey] as string} onChange={e => set(priKey, e.target.value)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ borderTop: "1px solid #334155", paddingTop: "1rem" }}>
                  <p style={{ margin: "0 0 0.75rem", color: "#CBD5E1", fontSize: "0.875rem", fontWeight: 600 }}>Coverage Tests & Expenses</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label style={labelStyle}>DSCR Trigger (×)</label>
                      <input style={inputStyle} type="number" step="0.01" value={form.dscrTrigger} onChange={e => set("dscrTrigger", e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>LTV Trigger (%)</label>
                      <input style={inputStyle} type="number" step="0.01" value={String(parseFloat(form.ltvTrigger) * 100)} onChange={e => set("ltvTrigger", String(parseFloat(e.target.value) / 100))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Servicer Fee (%)</label>
                      <input style={inputStyle} type="number" step="0.01" value={form.servicerFeePct} onChange={e => set("servicerFeePct", e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Trustee Fee ($M)</label>
                      <input style={inputStyle} type="number" step="0.01" value={form.trusteeFee} onChange={e => set("trusteeFee", e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Admin Fee ($M)</label>
                      <input style={inputStyle} type="number" step="0.01" value={form.adminFee} onChange={e => set("adminFee", e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>LR Target ($M)</label>
                      <input style={inputStyle} type="number" step="0.1" value={form.lrTarget} onChange={e => set("lrTarget", e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Aircraft Selection */}
            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <p style={{ margin: "0 0 0.5rem", color: "#94A3B8", fontSize: "0.8125rem" }}>
                  Select aircraft in the deal pool. {selectedMV} aircraft selected.
                </p>
                <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {assets.map(a => {
                    const checked = form.selectedAircraftIds.includes(a.id);
                    return (
                      <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: "6px", background: checked ? "#1E3A5F" : "#0F172A", border: `1px solid ${checked ? "#3B82F6" : "#334155"}`, cursor: "pointer" }}>
                        <input type="checkbox" checked={checked}
                          onChange={e => {
                            const ids = form.selectedAircraftIds;
                            set("selectedAircraftIds", e.target.checked ? [...ids, a.id] : ids.filter(x => x !== a.id));
                          }}
                        />
                        <span style={{ color: "#F8FAFC", fontSize: "0.8125rem" }}>
                          {a.msn} — {a.aircraft_type}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p style={{ margin: "0.75rem 0 0", color: "#F87171", fontSize: "0.8125rem" }}>{error}</p>
            )}

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
              {step > 1 ? (
                <button onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
                  style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: "none", border: "1px solid #334155", color: "#CBD5E1", borderRadius: "6px", padding: "0.5rem 1rem", cursor: "pointer", fontSize: "0.875rem" }}>
                  <ChevronLeft size={15} /> Back
                </button>
              ) : <div />}

              {step < 3 ? (
                <button
                  disabled={step === 1 ? !canNext1 : !canNext2}
                  onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)}
                  style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: "#3B82F6", border: "none", color: "#FFF", borderRadius: "6px", padding: "0.5rem 1rem", cursor: (step === 1 ? canNext1 : canNext2) ? "pointer" : "not-allowed", opacity: (step === 1 ? canNext1 : canNext2) ? 1 : 0.5, fontSize: "0.875rem" }}>
                  Next <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  disabled={saving}
                  onClick={handleCreate}
                  style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: "#16A34A", border: "none", color: "#FFF", borderRadius: "6px", padding: "0.5rem 1rem", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontSize: "0.875rem" }}>
                  {saving ? "Creating…" : <><Check size={15} /> Create Deal</>}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/components/transactions/DealSetupModal.tsx
git commit -m "feat: add DealSetupModal 3-step deal creation"
```

---

## Task 5: CollectionOverridesTable

**Files:**
- Create: `src/app/components/transactions/CollectionOverridesTable.tsx`

- [ ] **Step 1: Implement CollectionOverridesTable**

Create `src/app/components/transactions/CollectionOverridesTable.tsx`:

```typescript
// src/app/components/transactions/CollectionOverridesTable.tsx
import type { CollectionInput } from "../../utils/absWaterfall";

interface Props {
  collections: CollectionInput[];
  onChange:    (updated: CollectionInput[]) => void;
}

const fmtM = (n: number) => `$${n.toFixed(3)}M`;

export function CollectionOverridesTable({ collections, onChange }: Props) {
  function updateActual(idx: number, value: string) {
    const updated = collections.map((c, i) =>
      i === idx ? { ...c, actualCollected: parseFloat(value) || 0 } : c
    );
    onChange(updated);
  }

  const totalExpected = collections.reduce((s, c) => s + c.expectedRent, 0);
  const totalActual   = collections.reduce((s, c) => s + c.actualCollected, 0);
  const totalVariance = totalActual - totalExpected;

  const headerStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "#94A3B8",
    textAlign: "left" as const, fontWeight: 600, textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  };
  const cellStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#CBD5E1",
    borderBottom: "1px solid #1E293B",
  };

  return (
    <div style={{ borderRadius: "8px", border: "1px solid #334155", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#0F172A" }}>
          <tr>
            <th style={headerStyle}>MSN / Lease</th>
            <th style={headerStyle}>Lessee</th>
            <th style={{ ...headerStyle, textAlign: "right" }}>Expected ($M)</th>
            <th style={{ ...headerStyle, textAlign: "right" }}>Collected ($M)</th>
            <th style={{ ...headerStyle, textAlign: "right" }}>Variance</th>
          </tr>
        </thead>
        <tbody>
          {collections.map((c, idx) => {
            const variance = c.actualCollected - c.expectedRent;
            return (
              <tr key={c.leaseId} style={{ background: idx % 2 === 0 ? "#1E293B" : "#162032" }}>
                <td style={cellStyle}>{c.leaseId}</td>
                <td style={cellStyle}>{c.lessee}</td>
                <td style={{ ...cellStyle, textAlign: "right" }}>{fmtM(c.expectedRent)}</td>
                <td style={{ ...cellStyle, textAlign: "right", padding: "0.25rem 0.75rem" }}>
                  <input
                    type="number" min="0" step="0.001"
                    value={c.actualCollected}
                    onChange={e => updateActual(idx, e.target.value)}
                    style={{
                      width: "90px", padding: "0.25rem 0.5rem", textAlign: "right",
                      background: "#0F172A", border: "1px solid #334155",
                      borderRadius: "4px", color: "#F8FAFC", fontSize: "0.8125rem", outline: "none",
                    }}
                  />
                </td>
                <td style={{ ...cellStyle, textAlign: "right",
                  color: variance < 0 ? "#F87171" : variance > 0 ? "#4ADE80" : "#94A3B8" }}>
                  {variance >= 0 ? "+" : ""}{fmtM(variance)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot style={{ background: "#0F172A" }}>
          <tr>
            <td colSpan={2} style={{ ...cellStyle, color: "#F8FAFC", fontWeight: 600 }}>Total</td>
            <td style={{ ...cellStyle, textAlign: "right", color: "#F8FAFC", fontWeight: 600 }}>{fmtM(totalExpected)}</td>
            <td style={{ ...cellStyle, textAlign: "right", color: "#F8FAFC", fontWeight: 600 }}>{fmtM(totalActual)}</td>
            <td style={{ ...cellStyle, textAlign: "right", fontWeight: 600,
              color: totalVariance < 0 ? "#F87171" : totalVariance > 0 ? "#4ADE80" : "#94A3B8" }}>
              {totalVariance >= 0 ? "+" : ""}{fmtM(totalVariance)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/transactions/CollectionOverridesTable.tsx
git commit -m "feat: add CollectionOverridesTable for per-lease collection input"
```

---

## Task 6: CoverageTestPanel

**Files:**
- Create: `src/app/components/transactions/CoverageTestPanel.tsx`

- [ ] **Step 1: Implement CoverageTestPanel**

Create `src/app/components/transactions/CoverageTestPanel.tsx`:

```typescript
// src/app/components/transactions/CoverageTestPanel.tsx
import type { CoverageTestResult, WaterfallResult, NoteClass } from "../../utils/absWaterfall";

interface Props {
  dscrResult: CoverageTestResult;
  ltvResult:  CoverageTestResult;
  result:     WaterfallResult;
  noteClasses: NoteClass[];
  portfolioAircraftValueM: number;
}

const fmtM = (n: number) => `$${n.toFixed(2)}M`;

function TestCard({
  title, value, label, trigger, triggerLabel, passed, cashTrapped, breakdown,
}: {
  title: string; value: string; label: string;
  trigger: string; triggerLabel: string; passed: boolean; cashTrapped: number;
  breakdown: { label: string; value: string }[];
}) {
  return (
    <div style={{
      flex: 1, padding: "1.25rem", borderRadius: "8px",
      border: `1px solid ${passed ? "#166534" : "#991B1B"}`,
      background: passed ? "rgba(22,101,52,0.12)" : "rgba(153,27,27,0.12)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <p style={{ margin: 0, color: "#94A3B8", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</p>
        <span style={{
          padding: "0.2rem 0.6rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 700,
          background: passed ? "#166534" : "#991B1B",
          color: passed ? "#DCFCE7" : "#FEE2E2",
        }}>
          {passed ? "PASS" : "BREACH"}
        </span>
      </div>
      <p style={{ margin: "0 0 0.25rem", fontSize: "2rem", fontWeight: 700, color: passed ? "#4ADE80" : "#F87171" }}>
        {value}
      </p>
      <p style={{ margin: "0 0 1rem", color: "#64748B", fontSize: "0.8125rem" }}>
        {label} · Trigger: {trigger} {triggerLabel}
      </p>
      {cashTrapped > 0 && (
        <p style={{ margin: "0 0 0.75rem", color: "#FBBF24", fontSize: "0.8125rem" }}>
          ⚠ {fmtM(cashTrapped)} cash trapped
        </p>
      )}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {breakdown.map(b => (
          <div key={b.label} style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#94A3B8", fontSize: "0.8125rem" }}>{b.label}</span>
            <span style={{ color: "#CBD5E1", fontSize: "0.8125rem", fontWeight: 500 }}>{b.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CoverageTestPanel({ dscrResult, ltvResult, result, noteClasses, portfolioAircraftValueM }: Props) {
  const classA = noteClasses.find(n => n.label === "A")!;
  const totalOutstanding = noteClasses.reduce((s, n) => s + n.outstandingBalance, 0);

  return (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      <TestCard
        title="DSCR"
        value={`${dscrResult.value.toFixed(2)}×`}
        label="Debt Service Coverage Ratio"
        trigger={`${dscrResult.trigger.toFixed(2)}×`}
        triggerLabel="minimum"
        passed={dscrResult.passed}
        cashTrapped={dscrResult.cashTrapped}
        breakdown={[
          { label: "Net Cash Available", value: fmtM(result.availableCollections - result.seniorExpensesTotal) },
          { label: "Class A Interest Due", value: fmtM((classA.outstandingBalance * classA.couponRate) / (result.availableCollections > 0 ? 4 : 4)) },
          { label: "Class A Principal Sched.", value: fmtM(classA.scheduledPrincipal) },
          { label: "Senior Expenses", value: fmtM(result.seniorExpensesTotal) },
        ]}
      />
      <TestCard
        title="LTV"
        value={`${(ltvResult.value * 100).toFixed(1)}%`}
        label="Loan-to-Value Ratio"
        trigger={`${(ltvResult.trigger * 100).toFixed(0)}%`}
        triggerLabel="maximum"
        passed={ltvResult.passed}
        cashTrapped={ltvResult.cashTrapped}
        breakdown={[
          { label: "Total Notes Outstanding", value: fmtM(totalOutstanding) },
          { label: "Portfolio Aircraft Value", value: fmtM(portfolioAircraftValueM) },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/transactions/CoverageTestPanel.tsx
git commit -m "feat: add CoverageTestPanel with DSCR and LTV gauges"
```

---

## Task 7: DistributionStatement

**Files:**
- Create: `src/app/components/transactions/DistributionStatement.tsx`

- [ ] **Step 1: Implement DistributionStatement**

Create `src/app/components/transactions/DistributionStatement.tsx`:

```typescript
// src/app/components/transactions/DistributionStatement.tsx
import { Download } from "lucide-react";
import type { WaterfallResult, NoteClass } from "../../utils/absWaterfall";

interface Props {
  result:      WaterfallResult;
  noteClasses: NoteClass[];
  periodLabel: string;
}

const fmtM = (n: number) => `$${Math.abs(n).toFixed(3)}M`;

type RowVariant = "normal" | "deduct" | "separator" | "trap" | "residual" | "total";

interface Row {
  priority: string;
  description: string;
  amount: number;
  remaining: number;
  variant: RowVariant;
  shortfall?: number;
}

export function DistributionStatement({ result, noteClasses, periodLabel }: Props) {
  const classA = noteClasses.find(n => n.label === "A")!;
  const distA = result.noteDistributions.find(d => d.noteClass === "A")!;
  const distB = result.noteDistributions.find(d => d.noteClass === "B")!;
  const distC = result.noteDistributions.find(d => d.noteClass === "C")!;

  let running = result.availableCollections;

  const rows: Row[] = [
    { priority: "1", description: "Total Collections", amount: result.availableCollections, remaining: running, variant: "total" },
    { priority: "2", description: "Less: Senior Expenses", amount: -result.seniorExpensesTotal, remaining: (running -= result.seniorExpensesTotal), variant: "deduct" },
    { priority: "3", description: "Less: Liquidity Reserve Top-up", amount: -result.liquidityReserveTopUp, remaining: (running -= result.liquidityReserveTopUp), variant: "deduct" },
    { priority: "4", description: "Class A Interest", amount: distA.interestPaid, remaining: (running -= distA.interestPaid), variant: "normal", shortfall: result.noteDistributions[0].shortfall > 0 ? result.noteDistributions[0].shortfall : undefined },
    { priority: "5", description: "Class A Principal", amount: distA.principalPaid, remaining: (running -= distA.principalPaid), variant: "normal" },
    { priority: "—", description: `DSCR Test: ${result.dscrResult.value.toFixed(2)}× vs ${result.dscrResult.trigger}× trigger`, amount: 0, remaining: running, variant: "separator" },
    { priority: "6", description: "Class B Interest", amount: distB.interestPaid, remaining: (running -= distB.interestPaid), variant: "normal", shortfall: distB.shortfall > 0 ? distB.shortfall : undefined },
    { priority: "7", description: "Class B Principal", amount: distB.principalPaid, remaining: (running -= distB.principalPaid), variant: "normal" },
    { priority: "—", description: `LTV Test: ${(result.ltvResult.value * 100).toFixed(1)}% vs ${(result.ltvResult.trigger * 100).toFixed(0)}% trigger`, amount: 0, remaining: running, variant: "separator" },
    { priority: "8", description: "Class C Interest", amount: distC.interestPaid, remaining: (running -= distC.interestPaid), variant: "normal", shortfall: distC.shortfall > 0 ? distC.shortfall : undefined },
    { priority: "9", description: "Class C Principal", amount: distC.principalPaid, remaining: (running -= distC.principalPaid), variant: "normal" },
    ...(result.cashTrapTotal > 0 ? [{
      priority: "10", description: "Cash Trapped (Coverage Breach)",
      amount: -result.cashTrapTotal, remaining: 0, variant: "trap" as RowVariant,
    }] : []),
    { priority: "11", description: "Residual to Equity / Deal Sponsor", amount: result.residualToEquity, remaining: 0, variant: "residual" },
  ];

  const headerStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "#94A3B8",
    fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left",
  };

  function rowBg(v: RowVariant) {
    if (v === "separator") return "#0A1628";
    if (v === "trap") return "rgba(153,27,27,0.15)";
    if (v === "residual") return "rgba(22,101,52,0.15)";
    if (v === "total") return "rgba(30,58,138,0.2)";
    return undefined;
  }
  function amountColor(v: RowVariant, sf?: number) {
    if (sf && sf > 0) return "#F87171";
    if (v === "deduct" || v === "trap") return "#F87171";
    if (v === "residual") return "#4ADE80";
    if (v === "total") return "#93C5FD";
    return "#CBD5E1";
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: "0.9375rem", fontWeight: 600 }}>
            Distribution Statement
          </h3>
          <p style={{ margin: "0.2rem 0 0", color: "#64748B", fontSize: "0.8125rem" }}>
            Period: {periodLabel}
          </p>
        </div>
        <button
          style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 0.875rem",
            background: "#1E293B", border: "1px solid #334155", borderRadius: "6px",
            color: "#CBD5E1", fontSize: "0.8125rem", cursor: "pointer" }}
          onClick={() => {
            const lines = [`Distribution Statement — ${periodLabel}`, ""];
            rows.forEach(r => {
              if (r.variant === "separator") {
                lines.push(`  [${r.description}]`);
              } else if (r.amount !== 0) {
                lines.push(`  ${r.priority}. ${r.description}: ${r.amount >= 0 ? "+" : ""}${fmtM(r.amount)}`);
              }
            });
            const blob = new Blob([lines.join("\n")], { type: "text/plain" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `distribution-statement-${periodLabel.replace(/\s+/g, "-")}.txt`;
            a.click();
          }}
        >
          <Download size={14} /> Export
        </button>
      </div>

      <div style={{ borderRadius: "8px", border: "1px solid #334155", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#0F172A" }}>
            <tr>
              <th style={{ ...headerStyle, width: "2.5rem" }}>#</th>
              <th style={headerStyle}>Description</th>
              <th style={{ ...headerStyle, textAlign: "right" }}>Amount ($M)</th>
              <th style={{ ...headerStyle, textAlign: "right" }}>Remaining ($M)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: rowBg(row.variant), borderBottom: "1px solid #1E293B" }}>
                <td style={{ padding: "0.5rem 0.75rem", color: "#64748B", fontSize: "0.75rem" }}>
                  {row.priority}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem",
                  color: row.variant === "separator" ? "#64748B" : "#CBD5E1",
                  fontStyle: row.variant === "separator" ? "italic" : "normal",
                  fontWeight: (row.variant === "total" || row.variant === "residual") ? 600 : 400 }}>
                  {row.description}
                  {row.shortfall && row.shortfall > 0 && (
                    <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "#F87171" }}>
                      (shortfall: {fmtM(row.shortfall)})
                    </span>
                  )}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: "0.8125rem",
                  fontWeight: 500, color: amountColor(row.variant, row.shortfall) }}>
                  {row.variant === "separator" ? "—" :
                    row.amount === 0 ? "—" :
                    `${row.amount >= 0 ? "+" : ""}${fmtM(row.amount)}`}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: "0.8125rem", color: "#64748B" }}>
                  {row.variant === "separator" ? "—" : fmtM(row.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/transactions/DistributionStatement.tsx
git commit -m "feat: add DistributionStatement waterfall output table"
```

---

## Task 8: Transactions page

**Files:**
- Create: `src/app/pages/Transactions.tsx`

- [ ] **Step 1: Implement Transactions page**

Create `src/app/pages/Transactions.tsx`:

```typescript
// src/app/pages/Transactions.tsx
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Landmark, Plus, Play, ChevronRight } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PillTabs } from "../components/ui/PillTabs";
import { DealSetupModal } from "../components/transactions/DealSetupModal";
import { CollectionOverridesTable } from "../components/transactions/CollectionOverridesTable";
import { CoverageTestPanel } from "../components/transactions/CoverageTestPanel";
import { DistributionStatement } from "../components/transactions/DistributionStatement";
import { useAbsDeals } from "../hooks/useAbsDeals";
import { useData } from "../contexts/DataContext";
import {
  runWaterfall,
  computePortfolioAircraftValue,
  type CollectionInput,
  type WaterfallResult,
} from "../utils/absWaterfall";

type TabId = "overview" | "run" | "coverage" | "statement";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview",  label: "Overview"              },
  { id: "run",       label: "Run Waterfall"          },
  { id: "coverage",  label: "Coverage Tests"         },
  { id: "statement", label: "Distribution Statement" },
];

const fmtM = (n: number) => `$${n.toFixed(2)}M`;

function currentQuarterLabel() {
  const now = new Date();
  return `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
}

export default function Transactions() {
  const { deals, loading, createDeal } = useAbsDeals();
  const { assets, leases, lessees }    = useData();

  const [setupOpen, setSetupOpen]       = useState(false);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<TabId>("overview");
  const [periodLabel, setPeriodLabel]   = useState(currentQuarterLabel);
  const [collections, setCollections]   = useState<CollectionInput[]>([]);
  const [waterfallResult, setWaterfallResult] = useState<WaterfallResult | null>(null);

  const activeDeal = deals.find(d => d.id === activeDealId) ?? deals[0] ?? null;

  // When active deal changes, rebuild collections from lease register
  const defaultCollections = useMemo<CollectionInput[]>(() => {
    if (!activeDeal) return [];
    return activeDeal.aircraftIds.flatMap(assetId => {
      const lease = leases.find(l => l.asset_id === assetId);
      if (!lease) return [];
      const lessee = lessees.find(l => l.id === lease.lessee_id);
      const rentM = (lease.monthly_rental ?? 0) / 1_000_000;
      return [{
        leaseId: lease.id,
        lessee:  lessee?.name ?? "Unknown",
        expectedRent:    rentM,
        actualCollected: rentM,
      }];
    });
  }, [activeDeal, leases, lessees]);

  // Use defaultCollections if collections not yet customised for this deal
  const activeCollections = collections.length > 0 ? collections : defaultCollections;

  const portfolioAircraftValueM = useMemo(() => {
    if (!activeDeal) return 0;
    return computePortfolioAircraftValue(activeDeal.aircraftIds, assets);
  }, [activeDeal, assets]);

  function handleRunWaterfall() {
    if (!activeDeal) return;
    const result = runWaterfall(
      activeCollections,
      activeDeal.noteClasses,
      activeDeal.reserveAccounts,
      activeDeal.coverageTests,
      activeDeal.seniorExpenses,
      portfolioAircraftValueM
    );
    setWaterfallResult(result);
    setActiveTab("coverage");
  }

  // ─── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <PageHeader title="Transactions" subtitle="ABS deal waterfall management" />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: "3rem", borderRadius: "8px", background: "#1E293B",
              animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      </motion.div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────────
  if (deals.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <PageHeader title="Transactions" subtitle="ABS deal waterfall management" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "4rem 2rem", borderRadius: "12px", border: "1px dashed #334155",
          background: "#0F172A", textAlign: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#1E293B",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
            <Landmark size={24} style={{ color: "#3B82F6" }} />
          </div>
          <h3 style={{ margin: "0 0 0.5rem", color: "#F8FAFC", fontSize: "1.125rem", fontWeight: 600 }}>
            No ABS deals yet
          </h3>
          <p style={{ margin: "0 0 1.5rem", color: "#64748B", fontSize: "0.875rem", maxWidth: "360px" }}>
            Set up your first deal to start running waterfall calculations, evaluating coverage tests, and producing distribution statements.
          </p>
          <button onClick={() => setSetupOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.25rem",
              background: "#3B82F6", border: "none", borderRadius: "8px", color: "#FFF",
              fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
            <Plus size={16} /> Set up your first ABS deal
          </button>
        </div>
        <DealSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} onCreate={createDeal} />
      </motion.div>
    );
  }

  // ─── Active deal view ───────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      <PageHeader
        title="Transactions"
        subtitle="ABS deal waterfall management"
        actions={
          <button onClick={() => setSetupOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem",
              background: "#1E293B", border: "1px solid #334155", borderRadius: "8px",
              color: "#CBD5E1", fontSize: "0.8125rem", cursor: "pointer" }}>
            <Plus size={14} /> New Deal
          </button>
        }
      />

      {/* Deal selector — show if more than 1 deal */}
      {deals.length > 1 && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {deals.map(d => (
            <button key={d.id} onClick={() => { setActiveDealId(d.id); setWaterfallResult(null); setCollections([]); }}
              style={{ padding: "0.5rem 1rem", borderRadius: "8px", cursor: "pointer",
                background: activeDeal?.id === d.id ? "#1E3A5F" : "#1E293B",
                border: `1px solid ${activeDeal?.id === d.id ? "#3B82F6" : "#334155"}`,
                color: activeDeal?.id === d.id ? "#93C5FD" : "#94A3B8", fontSize: "0.8125rem" }}>
              {d.dealName}
            </button>
          ))}
        </div>
      )}

      {activeDeal && (
        <>
          <PillTabs
            tabs={TABS.map(t => t.id)}
            labels={TABS.reduce((acc, t) => ({ ...acc, [t.id]: t.label }), {} as Record<string, string>)}
            activeTab={activeTab}
            onChange={id => setActiveTab(id as TabId)}
          />

          {/* Overview */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
                {[
                  { label: "Deal",           value: activeDeal.dealName },
                  { label: "Closing Date",   value: activeDeal.closingDate },
                  { label: "Currency",       value: activeDeal.currency },
                  { label: "Aircraft in Pool", value: `${activeDeal.aircraftIds.length}` },
                  { label: "Portfolio Value",  value: fmtM(portfolioAircraftValueM) },
                ].map(kpi => (
                  <div key={kpi.label} style={{ padding: "1rem", borderRadius: "8px",
                    background: "#1E293B", border: "1px solid #334155" }}>
                    <p style={{ margin: "0 0 0.25rem", color: "#64748B", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {kpi.label}
                    </p>
                    <p style={{ margin: 0, color: "#F8FAFC", fontSize: "1rem", fontWeight: 600 }}>
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Note class table */}
              <div style={{ borderRadius: "8px", border: "1px solid #334155", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "#0F172A" }}>
                    <tr>
                      {["Class", "Outstanding ($M)", "Coupon", "Sched. Principal ($M)", "Next Interest Due ($M)"].map(h => (
                        <th key={h} style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem",
                          color: "#94A3B8", textAlign: h === "Class" ? "left" : "right",
                          fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDeal.noteClasses.map((n, i) => {
                      const ppy = activeDeal.seniorExpenses.paymentFrequency === "monthly" ? 12 : 4;
                      const interestDue = (n.outstandingBalance * n.couponRate) / ppy;
                      return (
                        <tr key={n.label} style={{ background: i % 2 === 0 ? "#1E293B" : "#162032", borderBottom: "1px solid #1E293B" }}>
                          <td style={{ padding: "0.5rem 0.75rem", color: "#F8FAFC", fontWeight: 600 }}>Class {n.label}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#CBD5E1" }}>{fmtM(n.outstandingBalance)}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#CBD5E1" }}>{(n.couponRate * 100).toFixed(2)}%</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#CBD5E1" }}>{fmtM(n.scheduledPrincipal)}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#93C5FD" }}>{fmtM(interestDue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button onClick={() => setActiveTab("run")}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", alignSelf: "flex-start",
                  padding: "0.625rem 1.25rem", background: "#3B82F6", border: "none",
                  borderRadius: "8px", color: "#FFF", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
                <Play size={15} /> Run Waterfall <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* Run Waterfall */}
          {activeTab === "run" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#94A3B8", marginBottom: "0.25rem", fontWeight: 500 }}>
                    Period Label
                  </label>
                  <input
                    value={periodLabel}
                    onChange={e => setPeriodLabel(e.target.value)}
                    placeholder="e.g. Q2 2026"
                    style={{ padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #334155",
                      background: "#0F172A", color: "#F8FAFC", fontSize: "0.875rem", outline: "none", minWidth: "180px" }}
                  />
                </div>
              </div>

              {defaultCollections.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#64748B", fontSize: "0.875rem",
                  borderRadius: "8px", border: "1px dashed #334155" }}>
                  No leases found for aircraft in this deal pool. Add aircraft in deal settings.
                </div>
              ) : (
                <CollectionOverridesTable
                  collections={activeCollections}
                  onChange={setCollections}
                />
              )}

              <button
                onClick={handleRunWaterfall}
                disabled={activeCollections.length === 0}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", alignSelf: "flex-start",
                  padding: "0.625rem 1.25rem", background: "#16A34A", border: "none",
                  borderRadius: "8px", color: "#FFF", fontSize: "0.875rem", fontWeight: 600,
                  cursor: activeCollections.length === 0 ? "not-allowed" : "pointer",
                  opacity: activeCollections.length === 0 ? 0.5 : 1 }}>
                <Play size={15} /> Run Waterfall
              </button>
            </div>
          )}

          {/* Coverage Tests */}
          {activeTab === "coverage" && (
            <div>
              {!waterfallResult ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#64748B",
                  borderRadius: "8px", border: "1px dashed #334155" }}>
                  Run the waterfall first to see coverage test results.
                </div>
              ) : (
                <CoverageTestPanel
                  dscrResult={waterfallResult.dscrResult}
                  ltvResult={waterfallResult.ltvResult}
                  result={waterfallResult}
                  noteClasses={activeDeal.noteClasses}
                  portfolioAircraftValueM={portfolioAircraftValueM}
                />
              )}
            </div>
          )}

          {/* Distribution Statement */}
          {activeTab === "statement" && (
            <div>
              {!waterfallResult ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#64748B",
                  borderRadius: "8px", border: "1px dashed #334155" }}>
                  Run the waterfall first to generate a distribution statement.
                </div>
              ) : (
                <DistributionStatement
                  result={waterfallResult}
                  noteClasses={activeDeal.noteClasses}
                  periodLabel={periodLabel}
                />
              )}
            </div>
          )}
        </>
      )}

      <DealSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} onCreate={createDeal} />
    </motion.div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/Transactions.tsx
git commit -m "feat: add Transactions page with 4-tab ABS deal view"
```

---

## Task 9: Wire routes and sidebar nav

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/app/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Transactions import and routes to `src/app/routes.tsx`**

Add the import after the existing page imports (around line 19):

```typescript
import Transactions from "./pages/Transactions";
```

Add the two routes inside the `Layout` children block, after the Deals routes (after line ~73 `{ path: "deals/exit-npv", Component: Deals },`):

```typescript
          // Transactions
          { path: "transactions",       Component: Transactions },
          { path: "transactions/setup", Component: Transactions },
```

- [ ] **Step 2: Add Transactions to sidebar in `src/app/components/layout/Sidebar.tsx`**

Add `Landmark` to the lucide-react import at the top of the file. The current import ends with `FolderOpen,`. Change it to:

```typescript
  FolderOpen,
  Landmark,
} from "lucide-react";
```

In the `navGroups` array, add a new item in the `"Analysis"` group after the Deals entry (after line ~117 `}`):

```typescript
      {
        title: "Transactions",
        url: "/transactions",
        icon: Landmark,
        items: [
          { title: "Overview",             url: "/transactions",       icon: BarChart2   },
          { title: "Run Waterfall",        url: "/transactions",       icon: Play        },
        ],
      },
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 4: Commit and push**

```bash
git add src/app/routes.tsx src/app/components/layout/Sidebar.tsx
git commit -m "feat: wire Transactions routes and sidebar nav item"
git push origin main
```

---

## Final verification

- [ ] Run full test suite one last time

```bash
npx vitest run
```

Expected: all existing tests pass + 4 new waterfall tests pass
