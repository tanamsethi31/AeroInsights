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

  it("throws when a required note class is missing", () => {
    const incompleteClasses = NOTE_CLASSES.filter(n => n.label !== "C");
    expect(() =>
      runWaterfall(makeCollections(3.0), incompleteClasses, RESERVES, COVERAGE, EXPENSES, 200)
    ).toThrow("noteClasses must include all three tranches");
  });

  it("throws when portfolioAircraftValueM is zero", () => {
    expect(() =>
      runWaterfall(makeCollections(3.0), NOTE_CLASSES, RESERVES, COVERAGE, EXPENSES, 0)
    ).toThrow("portfolioAircraftValueM must be > 0");
  });
});
