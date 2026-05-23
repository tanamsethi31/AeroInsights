// src/app/utils/maintenanceEvents.test.ts
import { describe, it, expect } from "vitest";
import { applyServicerReport, applyEvents, adjustedLease } from "./maintenanceEvents";
import type { AdjustedLease, MaintenanceEvent } from "./maintenanceEvents";
import type { LeaseSDMR } from "../components/portfolio/SDMRTab";
import type { ServicerReport } from "../hooks/useServicerReport";

// ── Minimal factory ───────────────────────────────────────────────────────────

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
    sd: { type: "Cash", amount: 0, currency: "USD", refundTriggers: [], governingLaw: "English" },
    mrComponents: [
      {
        component: "Engine PR", rateBasis: "$/FH", rateAmount: 310,
        unitsAccumulated: 20_000, cumulativeBalance: 6_000_000, refundable: true,
        capRule: "", evidencedCost: 5_000_000, fullIntervalUnits: 20_000, remainingUnits: 8_000,
      },
      {
        component: "LLPs", rateBasis: "$/cycle", rateAmount: 90,
        unitsAccumulated: 14_000, cumulativeBalance: 1_200_000, refundable: false,
        capRule: "", evidencedCost: 0, fullIntervalUnits: 20_000, remainingUnits: 6_000,
      },
    ],
  };
}

function makeReport(overrides: Partial<ServicerReport> = {}): ServicerReport {
  return {
    id: "r1", leaseId: "LSE-TEST-001", msn: "9999",
    reportDate: "2026-01-01", annualFH: 4000, annualCy: 2800,
    componentOverrides: {},
    ...overrides,
  };
}

// ── applyServicerReport ───────────────────────────────────────────────────────

describe("applyServicerReport", () => {
  it("sets utilOverride.annualFH and annualCy from report", () => {
    const result = applyServicerReport(makeLease(), makeReport({ annualFH: 4000, annualCy: 2800 }));
    expect(result.utilOverride.annualFH).toBe(4000);
    expect(result.utilOverride.annualCy).toBe(2800);
  });

  it("updates remainingUnits for component listed in componentOverrides", () => {
    const result = applyServicerReport(
      makeLease(),
      makeReport({ componentOverrides: { "Engine PR": 18_000 } }),
    );
    const ep = result.lease.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.remainingUnits).toBe(18_000);
  });

  it("does not change remainingUnits for component absent from componentOverrides", () => {
    const result = applyServicerReport(
      makeLease(),
      makeReport({ componentOverrides: { "Engine PR": 18_000 } }),
    );
    const llps = result.lease.mrComponents.find(c => c.component === "LLPs")!;
    expect(llps.remainingUnits).toBe(6_000); // unchanged
  });

  it("does not change cumulativeBalance", () => {
    const result = applyServicerReport(makeLease(), makeReport());
    const ep = result.lease.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.cumulativeBalance).toBe(6_000_000);
  });

  it("componentRemaining on utilOverride is empty (already baked into remainingUnits)", () => {
    const result = applyServicerReport(
      makeLease(),
      makeReport({ componentOverrides: { "Engine PR": 18_000 } }),
    );
    expect(result.utilOverride.componentRemaining).toEqual({});
  });
});

// ── applyEvents ───────────────────────────────────────────────────────────────

describe("applyEvents", () => {
  it("returns lease unchanged when events is empty", () => {
    const lease = makeLease();
    const result = applyEvents(lease, []);
    expect(result.mrComponents[0].cumulativeBalance).toBe(6_000_000);
    expect(result.mrComponents[0].remainingUnits).toBe(8_000);
  });

  it("reduces cumulativeBalance by costPaidUSD", () => {
    const evt: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2026-03-01",
      eventType: "shop_visit", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 5_400_000, remainingUnitsAfter: 18_000 }],
    };
    const result = applyEvents(makeLease(), [evt]);
    const ep = result.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.cumulativeBalance).toBe(6_000_000 - 5_400_000);
  });

  it("sets remainingUnits to remainingUnitsAfter when non-null", () => {
    const evt: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2026-03-01",
      eventType: "shop_visit", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 5_400_000, remainingUnitsAfter: 18_000 }],
    };
    const result = applyEvents(makeLease(), [evt]);
    const ep = result.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.remainingUnits).toBe(18_000);
  });

  it("does not change remainingUnits when remainingUnitsAfter is null", () => {
    const evt: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2026-03-01",
      eventType: "supplemental_claim", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 200_000, remainingUnitsAfter: null }],
    };
    const result = applyEvents(makeLease(), [evt]);
    const ep = result.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.remainingUnits).toBe(8_000); // unchanged
    expect(ep.cumulativeBalance).toBe(6_000_000 - 200_000); // still deducted
  });

  it("accumulates cost from multiple events; latest non-null remainingUnitsAfter wins", () => {
    const evt1: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2025-01-01",
      eventType: "shop_visit", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 3_000_000, remainingUnitsAfter: 18_000 }],
    };
    const evt2: MaintenanceEvent = {
      id: "e2", leaseId: "LSE-TEST-001", eventDate: "2026-06-01",
      eventType: "supplemental_claim", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 500_000, remainingUnitsAfter: 12_000 }],
    };
    const result = applyEvents(makeLease(), [evt2, evt1]); // intentionally out of order
    const ep = result.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.cumulativeBalance).toBe(6_000_000 - 3_000_000 - 500_000);
    expect(ep.remainingUnits).toBe(12_000); // evt2 is later, wins
  });

  it("does not change components not mentioned in events", () => {
    const evt: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2026-03-01",
      eventType: "shop_visit", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 5_400_000, remainingUnitsAfter: 18_000 }],
    };
    const result = applyEvents(makeLease(), [evt]);
    const llps = result.mrComponents.find(c => c.component === "LLPs")!;
    expect(llps.cumulativeBalance).toBe(1_200_000); // unchanged
    expect(llps.remainingUnits).toBe(6_000);         // unchanged
  });
});

// ── adjustedLease ─────────────────────────────────────────────────────────────

describe("adjustedLease", () => {
  it("returns lease unchanged and utilOverride undefined when no report and no events", () => {
    const result = adjustedLease(makeLease(), null, []);
    expect(result.lease.mrComponents[0].cumulativeBalance).toBe(6_000_000);
    expect(result.utilOverride).toBeUndefined();
  });

  it("applies servicer report before events (events can override report remainingUnits)", () => {
    const report = makeReport({ componentOverrides: { "Engine PR": 18_000 } });
    const evt: MaintenanceEvent = {
      id: "e1", leaseId: "LSE-TEST-001", eventDate: "2026-06-01",
      eventType: "shop_visit", notes: null,
      componentImpacts: [{ component: "Engine PR", costPaidUSD: 500_000, remainingUnitsAfter: 12_000 }],
    };
    const result = adjustedLease(makeLease(), report, [evt]);
    const ep = result.lease.mrComponents.find(c => c.component === "Engine PR")!;
    expect(ep.remainingUnits).toBe(12_000); // event overrides report
    expect(ep.cumulativeBalance).toBe(6_000_000 - 500_000);
  });

  it("exposes utilOverride from servicer report", () => {
    const report = makeReport({ annualFH: 4000, annualCy: 2800 });
    const result = adjustedLease(makeLease(), report, []);
    expect(result.utilOverride?.annualFH).toBe(4000);
  });
});
