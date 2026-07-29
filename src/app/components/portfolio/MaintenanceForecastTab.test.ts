// src/app/components/portfolio/MaintenanceForecastTab.test.ts
import { describe, it, expect } from "vitest";
import { buildProjections, computeMRAdequacy, buildAdequacyMap } from "./MaintenanceForecastTab";
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

// ── CostOverride ───────────────────────────────────────────────────────────────

describe("buildProjections — cost overrides", () => {
  it("uses the override cost instead of the heuristic when present", () => {
    // A320neo heuristic Airframe HSI costUSD = 6_800_000 (see maintenanceHeuristics.ts)
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, {
      "Airframe HSI": { id: "1", leaseId: "LSE-TEST-001", component: "Airframe HSI", costUSD: 7_500_000, note: null, createdBy: "test@example.com", updatedAt: "2026-07-28T00:00:00Z" },
    });
    expect(p.heuristicEventCost).toBe(7_500_000);
  });

  it("falls back to the heuristic cost when no override exists for that component", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, {});
    expect(p.heuristicEventCost).toBe(6_800_000);
  });

  it("falls back to the heuristic cost when costOverrides is undefined entirely", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p.heuristicEventCost).toBe(6_800_000);
  });

  it("sets costSource to 'override' when a cost override is present", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, {
      "Airframe HSI": { id: "1", leaseId: "LSE-TEST-001", component: "Airframe HSI", costUSD: 7_500_000, note: null, createdBy: "test@example.com", updatedAt: "2026-07-28T00:00:00Z" },
    });
    expect(p.costSource).toBe("override");
  });

  it("sets costSource to 'heuristic' when no override is present", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p.costSource).toBe("heuristic");
  });

  it("overriding one component's cost does not change downstream shortfall math incorrectly — it recomputes from the new cost", () => {
    const [base] = buildProjections(makeLease(), "A320neo", LEASE_END);
    const [overridden] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, {
      "Airframe HSI": { id: "1", leaseId: "LSE-TEST-001", component: "Airframe HSI", costUSD: 7_500_000, note: null, createdBy: "test@example.com", updatedAt: "2026-07-28T00:00:00Z" },
    });
    // shortfallAtEvent = heuristicEventCost - projectedBalanceAtEvent; projectedBalanceAtEvent
    // is unaffected by a cost override (it depends on utilization, not event cost), so the
    // shortfall should shift by exactly the cost delta.
    const costDelta = overridden.heuristicEventCost - base.heuristicEventCost;
    expect(overridden.shortfallAtEvent - base.shortfallAtEvent).toBeCloseTo(costDelta, 0);
  });

  it("populates costOverrideMeta when overridden, leaves it undefined when not", () => {
    const [overridden] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, {
      "Airframe HSI": { id: "1", leaseId: "LSE-TEST-001", component: "Airframe HSI", costUSD: 7_500_000, note: "Per MRO quote", createdBy: "test@example.com", updatedAt: "2026-07-28T00:00:00Z" },
    });
    expect(overridden.costOverrideMeta).toEqual({ createdBy: "test@example.com", updatedAt: "2026-07-28T00:00:00Z", note: "Per MRO quote" });

    const [base] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(base.costOverrideMeta).toBeUndefined();
  });
});

// ── computeMRAdequacy ─────────────────────────────────────────────────────────

describe("computeMRAdequacy", () => {
  it("returns green with zero shortfall for an empty projection list", () => {
    const result = computeMRAdequacy([]);
    expect(result).toEqual({ flag: "green", eolShortfall: 0, eolShortfallPct: 0, distressedEOLShortfall: 0 });
  });

  it("returns red and sums positive eolShortfall when any component has one", () => {
    const [p] = buildProjections(makeLease(), "A320neo", new Date(2026, 5, 1)); // 1 month to EOL — forces a shortfall
    const result = computeMRAdequacy([p]);
    expect(result.flag).toBe("red");
    expect(result.eolShortfall).toBeCloseTo(Math.max(0, p.eolShortfall), 0);
  });

  it("returns green when eolShortfall and distressedEOLShortfall are both non-positive", () => {
    // Long lease end (2035) → plenty of accrual time → surplus, not shortfall
    const [p] = buildProjections(makeLease(), "A320neo", new Date(2035, 0, 1));
    const result = computeMRAdequacy([p]);
    expect(result.eolShortfall).toBeLessThanOrEqual(0.01); // computeMRAdequacy floors negative shortfalls to 0 via Math.max
    expect(result.flag).not.toBe("red");
  });

  it("computes eolShortfallPct as shortfall / total obligation, 0 when obligation is 0", () => {
    const result = computeMRAdequacy([]);
    expect(result.eolShortfallPct).toBe(0);
  });
});

// ── buildAdequacyMap ──────────────────────────────────────────────────────────

describe("buildAdequacyMap", () => {
  it("keys the returned map by leaseId", () => {
    const lease = makeLease(); // leaseId: "LSE-TEST-001", leaseEnd: "2030-01-01"
    const map = buildAdequacyMap([lease]);
    expect(map.has("LSE-TEST-001")).toBe(true);
  });

  it("falls back to CONTEXT_BY_LEASE_ID for leaseEnd when lease.leaseEnd is absent and leaseId is a known LEASE_CONTEXT key (demo-mode leases)", () => {
    // "LSE-2019-001" is a real LEASE_CONTEXT leaseId (leaseEnd "2028-03-01"); no leaseEnd on the
    // lease itself forces buildAdequacyMap through the CONTEXT_BY_LEASE_ID middle branch rather
    // than the direct lease.leaseEnd path or the last-resort 2028-01-01 fallback.
    const lease = { ...makeLease(), leaseId: "LSE-2019-001", leaseEnd: undefined };
    const map = buildAdequacyMap([lease]);
    const entry = map.get("LSE-2019-001")!;
    expect(entry).toBeDefined();
    expect(Number.isNaN(entry.eolShortfall)).toBe(false);
  });

  it("uses lease.leaseEnd directly when present (live-mode leases)", () => {
    const lease = { ...makeLease(), leaseEnd: "2026-06-01" }; // 1 month out — forces shortfall
    const map = buildAdequacyMap([lease]);
    expect(map.get("LSE-TEST-001")!.flag).toBe("red");
  });

  it("falls back to the 2028-01-01 last resort when leaseEnd is absent and leaseId is unknown", () => {
    // Neither lease.leaseEnd nor a CONTEXT_BY_LEASE_ID match — must not throw and must not NaN.
    const lease = { ...makeLease(), leaseId: "LSE-UNKNOWN-999", leaseEnd: undefined };
    const map = buildAdequacyMap([lease]);
    const entry = map.get("LSE-UNKNOWN-999")!;
    expect(entry).toBeDefined();
    expect(Number.isNaN(entry.eolShortfall)).toBe(false);
  });
});
