// src/app/components/portfolio/MaintenanceForecastTab.test.ts
import { describe, it, expect } from "vitest";
import { buildProjections } from "./MaintenanceForecastTab";
import type { LeaseSDMR } from "./SDMRTab";

// ── Minimal factory — one FH-based component (Airframe HSI) ───────────────────

function makeLease(): LeaseSDMR {
  return {
    leaseId:         "LSE-TEST-001",
    lessee:          "Test Airline",
    aircraft:        "A320neo",
    eadNum:          0,
    baseLGD:         50,
    returnCondition: "half-life",
    leaseEnd:        "2030-01-01",
    stage:           1,
    sd: {
      type:           "Cash",
      amount:         0,
      currency:       "USD",
      refundTriggers: [],
      governingLaw:   "English",
    },
    mrComponents: [
      {
        component:         "Airframe HSI",
        rateBasis:         "$/FH",
        rateAmount:        420,
        unitsAccumulated:  20_000,
        cumulativeBalance: 8_000_000,
        refundable:        true,
        capRule:           "",
        evidencedCost:     6_000_000,
        fullIntervalUnits: 36_000,
        remainingUnits:    6_200,
      },
    ],
  };
}

const LEASE_END = new Date(2030, 0, 1);

// ── Baseline (no override) ────────────────────────────────────────────────────

describe("buildProjections — baseline (no override)", () => {
  it("uses heuristic utilizationFH for Airframe HSI monthly accrual", () => {
    // A320neo heuristic.utilizationFH = 3500
    // monthlyAccrual = 420 * (3500 / 12) ≈ 122_500
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p.monthlyAccrual).toBeCloseTo(420 * (3500 / 12), 0);
  });

  it("uses comp.remainingUnits for monthsToNextEvent", () => {
    // monthsToNextEvent = 6200 / (3500 / 12) ≈ 21.26
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p.monthsToNextEvent).toBeCloseTo(6200 / (3500 / 12), 1);
  });
});

// ── UtilOverride — annualFH ───────────────────────────────────────────────────

describe("buildProjections — UtilOverride.annualFH", () => {
  it("replaces heuristic FH with override value for monthly accrual", () => {
    // override annualFH = 2800 → monthlyAccrual = 420 * (2800 / 12) ≈ 98_000
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, {
      annualFH:           2800,
      annualCy:           2800,
      componentRemaining: {},
    });
    expect(p.monthlyAccrual).toBeCloseTo(420 * (2800 / 12), 0);
  });

  it("monthlyAccrual differs from heuristic when override differs", () => {
    const [base] = buildProjections(makeLease(), "A320neo", LEASE_END);
    const [live] = buildProjections(makeLease(), "A320neo", LEASE_END, {
      annualFH:           2800,
      annualCy:           2800,
      componentRemaining: {},
    });
    expect(live.monthlyAccrual).toBeLessThan(base.monthlyAccrual);
  });
});

// ── UtilOverride — componentRemaining ────────────────────────────────────────

describe("buildProjections — UtilOverride.componentRemaining", () => {
  it("uses override remaining units for monthsToNextEvent", () => {
    // remainingUnits = 3500, monthlyUtil = 3500/12 → monthsToNextEvent = 12
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, {
      annualFH:           3500,
      annualCy:           2800,
      componentRemaining: { "Airframe HSI": 3500 },
    });
    expect(p.monthsToNextEvent).toBeCloseTo(12, 0);
  });

  it("falls back to comp.remainingUnits when component key absent", () => {
    // empty override → uses comp.remainingUnits = 6200
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, {
      annualFH:           3500,
      annualCy:           2800,
      componentRemaining: {},
    });
    expect(p.monthsToNextEvent).toBeCloseTo(6200 / (3500 / 12), 1);
  });
});
