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
  assets: Pick<Asset, "id" | "aircraft_type" | "vintage">[],
  referenceYear: number = new Date().getFullYear()
): number {
  return aircraftIds.reduce((sum, id) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return sum;
    const base = (AIRCRAFT_BASE_VALUE[asset.aircraft_type] ?? 25_000_000);
    const ageYears = referenceYear - (asset.vintage ?? 2010);
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

  if (portfolioAircraftValueM <= 0) {
    throw new Error("runWaterfall: portfolioAircraftValueM must be > 0");
  }

  // Step 1: Senior expenses
  const seniorExpensesDue =
    seniorExpenses.servicerFeePct * totalCollections +
    seniorExpenses.trusteeFee +
    seniorExpenses.adminFee;
  const seniorResult = pay(totalCollections, seniorExpensesDue);
  const seniorExpensesTotal = seniorResult.paid;
  let remaining = totalCollections - seniorResult.paid;

  // Step 2: Liquidity reserve top-up
  const lrNeeded = Math.max(
    0,
    reserveAccounts.liquidityReserve.target - reserveAccounts.liquidityReserve.balance
  );
  const lrResult = pay(remaining, lrNeeded);
  remaining -= lrResult.paid;
  const liquidityReserveTopUp = lrResult.paid;

  const classA = noteClasses.find(n => n.label === "A");
  const classB = noteClasses.find(n => n.label === "B");
  const classC = noteClasses.find(n => n.label === "C");
  if (!classA || !classB || !classC) {
    throw new Error("runWaterfall: noteClasses must include all three tranches (A, B, C)");
  }

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
    // @ts-expect-error TODO(safety-net): noteClass string narrowed to 'A'|'B'|'C' — add a guard
    noteDistributions: [
      {
        noteClass: "A",
        interestPaid: classAInt.paid,
        principalPaid: classAPrin.paid,
        shortfall: classAInt.shortfall + classAPrin.shortfall,
      },
      { noteClass: "B", interestPaid: classBIntPaid, principalPaid: classBPrinPaid, shortfall: classBShortfall },
      { noteClass: "C", interestPaid: classCIntPaid, principalPaid: classCPrinPaid, shortfall: classCShortfall },
    ].sort((a, b) => a.noteClass.localeCompare(b.noteClass)),
    dscrResult: { value: dscr, trigger: coverageTests.dscrTrigger, passed: dscrPassed, cashTrapped: dscrCashTrapped },
    ltvResult:  { value: ltv,  trigger: coverageTests.ltvTrigger,  passed: ltvPassed,  cashTrapped: ltvCashTrapped  },
    cashTrapTotal: dscrCashTrapped + ltvCashTrapped,
    residualToEquity: remaining,
  };
}
