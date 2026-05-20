// src/app/utils/cashFlowForecast.test.ts
import { describe, it, expect } from "vitest";
import { forecastCashFlows, mergeForecastEvents } from "./cashFlowForecast";
import type { CashEvent } from "./cashFlowForecast";
import type { Lease } from "../types/portfolio";
import type { LeaseSDMR } from "../components/portfolio/SDMRTab";

// ── Factories ──────────────────────────────────────────────────────────────────

function addMonths(base: Date, n: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function makeLease(overrides: Partial<Lease> = {}): Lease {
  return {
    id:             "lease-1",
    org_id:         "org-1",
    asset_id:       "asset-1",
    lessee_id:      "lessee-1",
    start_date:     addMonths(TODAY, -12),
    end_date:       addMonths(TODAY, 12),
    monthly_rental: 500_000,
    currency:       "USD",
    stage:          1,
    created_at:     "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSDMR(leaseId = "lease-1", overrides: Partial<LeaseSDMR> = {}): LeaseSDMR {
  return {
    leaseId,
    lessee:          "Test Airlines",
    aircraft:        "A320",
    eadNum:          10,
    baseLGD:         50,
    returnCondition: "half-life",
    sd: { type: "Cash", amount: 1_000_000, currency: "USD", refundTriggers: [], governingLaw: "English" },
    mrComponents: [
      {
        component:         "Airframe HSI",
        rateBasis:         "$/FH",
        rateAmount:        400,
        unitsAccumulated:  10_000,
        cumulativeBalance: 4_000_000,
        refundable:        true,
        capRule:           "Max 18 months",
        evidencedCost:     3_500_000,
        fullIntervalUnits: 20_000,
        remainingUnits:    5_000,
      },
      {
        component:         "LLPs",
        rateBasis:         "$/cycle",
        rateAmount:        90,
        unitsAccumulated:  5_000,
        cumulativeBalance: 450_000,
        refundable:        false,
        capRule:           "Non-refundable",
        evidencedCost:     0,
        fullIntervalUnits: 20_000,
        remainingUnits:    15_000,
      },
    ],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("forecastCashFlows", () => {
  it("generates one rent event per remaining month for an active lease", () => {
    const lease = makeLease({ end_date: addMonths(TODAY, 3) });
    const result = forecastCashFlows([lease], [], 24);
    const rent = result.filter(e => e.eventType === "rent" && e.leaseId === "lease-1");
    // 3 full months ahead → 3 rent events
    expect(rent.length).toBe(3);
    rent.forEach(e => {
      expect(e.amount).toBe(500_000);
      expect(e.source).toBe("rule");
      expect(e.isForecast).toBe(true);
    });
  });

  it("generates a single mr_draw outflow at lease end with totalMRBalance as negative amount", () => {
    const lease  = makeLease({ end_date: addMonths(TODAY, 1) });
    const sdmr   = makeSDMR("lease-1");
    const result = forecastCashFlows([lease], [sdmr], 24);
    const draw   = result.find(e => e.eventType === "mr_draw" && e.leaseId === "lease-1");
    expect(draw).toBeDefined();
    // totalMRBalance = 4_000_000 + 450_000 = 4_450_000 → outflow = -4_450_000
    expect(draw!.amount).toBe(-4_450_000);
    expect(draw!.eventDate).toBe(lease.end_date);
  });

  it("does not generate a sd_refund event when sd.type is LC", () => {
    const lease = makeLease({ end_date: addMonths(TODAY, 1) });
    const sdmr  = makeSDMR("lease-1", { sd: { type: "LC", amount: 1_000_000, currency: "USD", refundTriggers: [], governingLaw: "English" } });
    const result = forecastCashFlows([lease], [sdmr], 24);
    const refund = result.filter(e => e.eventType === "sd_refund" && e.leaseId === "lease-1");
    expect(refund.length).toBe(0);
  });

  it("stops generating events at horizon cutoff even if lease extends beyond", () => {
    const lease  = makeLease({ end_date: addMonths(TODAY, 30) });
    const result = forecastCashFlows([lease], [], 24);
    const rent   = result.filter(e => e.eventType === "rent" && e.leaseId === "lease-1");
    expect(rent.length).toBe(24);
    // No redelivery events — end_date is beyond 24-month horizon
    const draws = result.filter(e => e.eventType === "mr_draw");
    expect(draws.length).toBe(0);
  });
});

describe("mergeForecastEvents", () => {
  it("suppresses a rule event when a manual forecast override exists for same lease + type + month", () => {
    const endDate = addMonths(TODAY, 1);
    const ruleEvent: CashEvent = {
      id:            `rule-lease-1-rent-${endDate}`,
      orgId:         "",
      leaseId:       "lease-1",
      eventType:     "rent",
      amount:        500_000,
      currency:      "USD",
      eventDate:     endDate,
      isForecast:    true,
      source:        "rule",
      transactionId: null,
      notes:         null,
      createdAt:     "",
    };
    const manualOverride: CashEvent = {
      id:            "manual-override-1",
      orgId:         "org-1",
      leaseId:       "lease-1",
      eventType:     "rent",
      amount:        480_000,
      currency:      "USD",
      eventDate:     endDate,
      isForecast:    true,
      source:        "manual",
      transactionId: null,
      notes:         "Adjusted for partial payment",
      createdAt:     "2026-05-20T00:00:00Z",
    };
    const merged = mergeForecastEvents([ruleEvent], [manualOverride]);
    // Only the manual override remains — rule event for that month is suppressed
    expect(merged.find(e => e.id === ruleEvent.id)).toBeUndefined();
    expect(merged.find(e => e.id === manualOverride.id)).toBeDefined();
    expect(merged.length).toBe(1);
  });
});
