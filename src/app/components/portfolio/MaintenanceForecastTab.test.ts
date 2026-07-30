// src/app/components/portfolio/MaintenanceForecastTab.test.ts
import { describe, it, expect } from "vitest";
import { buildProjections, computeMRAdequacy, buildAdequacyMap, type ComponentProjection } from "./MaintenanceForecastTab";
import type { LeaseSDMR } from "./SDMRTab";
import type { OrgCostBenchmark } from "../../hooks/useOrgCostBenchmarks";
import type { CostOverride } from "../../hooks/useCostOverrides";

// ── Minimal ComponentProjection factory — lets tests set only the fields they care about ──

function baseProjection(): ComponentProjection {
  return {
    component:                "Airframe HSI",
    currentBalance:            0,
    monthlyAccrual:            0,
    monthsToNextEvent:         0,
    nextEventDate:             new Date(2026, 4, 1),
    projectedBalanceAtEvent:   0,
    heuristicEventCost:        0,
    costSource:                "heuristic",
    shortfallAtEvent:          0,
    projectedBalanceAtEOL:     0,
    eolObligation:             0,
    eolShortfall:              0,
    distressedEOLShortfall:    0,
  };
}

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
    // distressedEOLShortfall depends only on units used *so far* (cumulativeBalance vs.
    // currentObligation), not on leaseEndDate — so a far-future lease end alone (the original
    // version of this test) does NOT make it non-positive: makeLease()'s default component has
    // already used 29,800 of 36,000 FH against only an $8M balance vs. a $12.5M obligation,
    // a real distressed shortfall regardless of when the lease ends. To get a genuinely green
    // scenario we also need low usage-to-date relative to balance: remainingUnits=35_000 of
    // 36_000 (only 1_000 FH used) with a $500k balance comfortably covers both measures.
    const lease: LeaseSDMR = {
      ...makeLease(),
      mrComponents: [{ ...makeLease().mrComponents[0], remainingUnits: 35_000, cumulativeBalance: 500_000 }],
    };
    const [p] = buildProjections(lease, "A320neo", new Date(2035, 0, 1));
    const result = computeMRAdequacy([p]);
    expect(result.eolShortfall).toBeLessThanOrEqual(0);
    expect(result.distressedEOLShortfall).toBeLessThanOrEqual(0);
    expect(result.flag).toBe("green");
  });

  it("computes eolShortfallPct as shortfall / total obligation, 0 when obligation is 0", () => {
    const result = computeMRAdequacy([]);
    expect(result.eolShortfallPct).toBe(0);
  });

  it("computes eolShortfallPct as (sum of positive eolShortfall / total eolObligation) * 100 for a non-trivial obligation", () => {
    const projections: ComponentProjection[] = [
      { ...baseProjection(), eolShortfall: 150_000, eolObligation: 600_000 },
      { ...baseProjection(), eolShortfall: 100_000, eolObligation: 400_000 },
    ];
    const result = computeMRAdequacy(projections);
    expect(result.eolShortfallPct).toBe(25);
  });

  it("floors each component's distressedEOLShortfall before summing — a surplus component cannot offset a shortfall component", () => {
    const projections: ComponentProjection[] = [
      { ...baseProjection(), distressedEOLShortfall: 500_000 },   // shortfall
      { ...baseProjection(), distressedEOLShortfall: -300_000 },  // surplus
    ];
    const result = computeMRAdequacy(projections);
    expect(result.distressedEOLShortfall).toBe(500_000); // NOT 200_000
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

    // Prove the fallback resolved to the CORRECT date (2028-03-01, month is 0-indexed so March = 2),
    // not just "some" date that happened not to NaN — compute independently and deep-equal.
    const expectedProjections = buildProjections(lease, lease.aircraft, new Date(2028, 2, 1));
    const expected = computeMRAdequacy(expectedProjections);
    expect(entry).toEqual(expected);
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

// ── buildProjections — 3-tier cost resolution (org benchmark) ─────────────────

describe("buildProjections — org benchmark cost tier", () => {
  const ORG_BENCHMARK: Record<string, OrgCostBenchmark> = {
    "Airframe HSI": { id: "b1", aircraftType: "A320neo", component: "Airframe HSI", costUSD: 7_000_000, note: null, createdBy: "a@b.com", updatedAt: "2026-07-29T00:00:00Z" },
  };
  const LEASE_OVERRIDE: Record<string, CostOverride> = {
    "Airframe HSI": { id: "o1", leaseId: "LSE-TEST-001", component: "Airframe HSI", costUSD: 7_500_000, note: null, createdBy: "c@d.com", updatedAt: "2026-07-29T00:00:00Z" },
  };

  it("uses the org benchmark when present and no per-lease override exists", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, undefined, ORG_BENCHMARK);
    expect(p.heuristicEventCost).toBe(7_000_000);
    expect(p.costSource).toBe("org-benchmark");
  });

  it("per-lease override wins over the org benchmark when both exist", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, LEASE_OVERRIDE, ORG_BENCHMARK);
    expect(p.heuristicEventCost).toBe(7_500_000);
    expect(p.costSource).toBe("override");
    expect(p.orgBenchmarkMeta).toBeUndefined();
  });

  it("falls back to the global heuristic when neither override nor benchmark exists", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p.costSource).toBe("heuristic");
  });

  it("populates orgBenchmarkMeta only when costSource is org-benchmark", () => {
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, undefined, undefined, ORG_BENCHMARK);
    expect(p.orgBenchmarkMeta).toEqual({ createdBy: "a@b.com", updatedAt: "2026-07-29T00:00:00Z", note: null });

    const [p2] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p2.orgBenchmarkMeta).toBeUndefined();
  });
});
