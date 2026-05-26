import { describe, it, expect } from "vitest";
import {
  evaluateRules,
  type AlertRuleInput,
  type LesseeSnapshot,
  type StageMigrationSnapshot,
  type LesseeAggregateSnapshot,
} from "./alertEvaluator";

function rule(over: Partial<AlertRuleInput>): AlertRuleInput {
  return {
    id:               "rule-1",
    org_id:           "org-1",
    portfolio_id:     "p-1",
    name:             "Test rule",
    kind:             "dpd_breach",
    threshold:        {},
    recipients:       ["analyst@aeroinsights.io"],
    enabled:          true,
    cooldown_minutes: 60,
    ...over,
  };
}

function lessee(over: Partial<LesseeSnapshot>): LesseeSnapshot {
  return {
    id:               "l-1",
    name:             "IndiGo",
    country:          "India",
    watchlist_status: "green",
    dpd_days:         0,
    insolvency_filed: false,
    ...over,
  };
}

describe("evaluateRules", () => {
  it("returns empty when no rules enabled", () => {
    expect(evaluateRules({
      rules: [rule({ enabled: false })],
      lessees: [lessee({})],
      migrations: [], leaseToLessee: new Map(), sanctions: new Map(),
    })).toEqual([]);
  });

  it("skips rules with no recipients", () => {
    expect(evaluateRules({
      rules: [rule({ recipients: [] })],
      lessees: [lessee({ dpd_days: 60 })],
      migrations: [], leaseToLessee: new Map(), sanctions: new Map(),
    })).toEqual([]);
  });

  describe("dpd_breach", () => {
    it("fires when dpd_days exceeds threshold", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "dpd_breach", threshold: { days: 30 } })],
        lessees: [lessee({ dpd_days: 45 })],
        migrations: [], leaseToLessee: new Map(), sanctions: new Map(),
      });
      expect(fires).toHaveLength(1);
      expect(fires[0].kind).toBe("dpd_breach");
      expect(fires[0].entityLabel).toBe("IndiGo");
      expect(fires[0].subject).toContain("45 days past due");
    });

    it("does not fire below threshold", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "dpd_breach", threshold: { days: 30 } })],
        lessees: [lessee({ dpd_days: 10 })],
        migrations: [], leaseToLessee: new Map(), sanctions: new Map(),
      });
      expect(fires).toEqual([]);
    });

    it("uses 30 as default threshold", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "dpd_breach", threshold: {} })],
        lessees: [lessee({ dpd_days: 31 })],
        migrations: [], leaseToLessee: new Map(), sanctions: new Map(),
      });
      expect(fires).toHaveLength(1);
    });
  });

  describe("stage_downgrade", () => {
    const mig = (over: Partial<StageMigrationSnapshot>): StageMigrationSnapshot => ({
      id:                "m-1",
      lease_external_id: "LSE-001",
      from_stage:        1,
      to_stage:          2,
      direction:         "up",
      reason:            "ingestion",
      occurred_at:       "2026-05-01T10:00:00Z",
      ...over,
    });

    it("fires on upward migration when no from/to filter", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "stage_downgrade", threshold: {} })],
        lessees: [lessee({})],
        migrations: [mig({})],
        leaseToLessee: new Map([["LSE-001", { id: "l-1", name: "IndiGo" }]]),
        sanctions: new Map(),
      });
      expect(fires).toHaveLength(1);
      expect(fires[0].subject).toContain("S1→S2");
    });

    it("skips downward direction", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "stage_downgrade", threshold: {} })],
        lessees: [lessee({})],
        migrations: [mig({ direction: "down", from_stage: 3, to_stage: 2 })],
        leaseToLessee: new Map(),
        sanctions: new Map(),
      });
      expect(fires).toEqual([]);
    });

    it("filters by from + to when provided", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "stage_downgrade", threshold: { from: 2, to: 3 } })],
        lessees: [lessee({})],
        migrations: [mig({ from_stage: 1, to_stage: 2 })],
        leaseToLessee: new Map(),
        sanctions: new Map(),
      });
      expect(fires).toEqual([]);
    });
  });

  describe("watchlist_red", () => {
    it("fires only on red status", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "watchlist_red" })],
        lessees: [
          lessee({ name: "Green Air", watchlist_status: "green" }),
          lessee({ id: "l-2", name: "Red Air", watchlist_status: "red" }),
          lessee({ id: "l-3", name: "Amber Air", watchlist_status: "amber" }),
        ],
        migrations: [], leaseToLessee: new Map(), sanctions: new Map(),
      });
      expect(fires).toHaveLength(1);
      expect(fires[0].entityLabel).toBe("Red Air");
    });
  });

  describe("sanctions_hit", () => {
    it("fires when lessee country is in active sanctions map", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "sanctions_hit" })],
        lessees: [
          lessee({ country: "Russia" }),
          lessee({ id: "l-2", country: "Germany" }),
        ],
        migrations: [], leaseToLessee: new Map(),
        sanctions: new Map([["Russia", "active"]]),
      });
      expect(fires).toHaveLength(1);
      expect(fires[0].entityLabel).toBe("IndiGo");
      expect(fires[0].payload).toMatchObject({ country: "Russia" });
    });

    it("does not fire on 'watch' status", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "sanctions_hit" })],
        lessees: [lessee({ country: "Argentina" })],
        migrations: [], leaseToLessee: new Map(),
        sanctions: new Map([["Argentina", "watch"]]),
      });
      expect(fires).toEqual([]);
    });
  });

  describe("mr_shortfall", () => {
    const agg = (over: Partial<LesseeAggregateSnapshot>): LesseeAggregateSnapshot => ({
      lessee_id:      "l-1",
      lessee_name:    "IndiGo",
      mr_balance_usd: -500_000,
      ead_usd:        10_000_000,
      ...over,
    });

    it("fires when shortfall exceeds threshold USD", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "mr_shortfall", threshold: { usd: 100_000 } })],
        lessees: [lessee({})], migrations: [], leaseToLessee: new Map(), sanctions: new Map(),
        aggregates: [agg({})],
      });
      expect(fires).toHaveLength(1);
      expect(fires[0].subject).toContain("MR shortfall");
    });

    it("ignores positive balances", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "mr_shortfall", threshold: { usd: 100_000 } })],
        lessees: [lessee({})], migrations: [], leaseToLessee: new Map(), sanctions: new Map(),
        aggregates: [agg({ mr_balance_usd: 200_000 })],
      });
      expect(fires).toEqual([]);
    });

    it("ignores shortfalls smaller than threshold", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "mr_shortfall", threshold: { usd: 1_000_000 } })],
        lessees: [lessee({})], migrations: [], leaseToLessee: new Map(), sanctions: new Map(),
        aggregates: [agg({ mr_balance_usd: -50_000 })],
      });
      expect(fires).toEqual([]);
    });
  });

  describe("concentration", () => {
    it("fires when a lessee's share ≥ threshold %", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "concentration", threshold: { pct: 25 } })],
        lessees: [lessee({})], migrations: [], leaseToLessee: new Map(), sanctions: new Map(),
        aggregates: [
          { lessee_id: "l-1", lessee_name: "Big",   mr_balance_usd: 0, ead_usd: 8_000_000 },
          { lessee_id: "l-2", lessee_name: "Small", mr_balance_usd: 0, ead_usd: 2_000_000 },
        ],
      });
      expect(fires).toHaveLength(1);
      expect(fires[0].entityLabel).toBe("Big");
      expect((fires[0].payload as { share_pct: number }).share_pct).toBeCloseTo(80, 0);
    });

    it("no fire when total EAD is zero", () => {
      const fires = evaluateRules({
        rules: [rule({ kind: "concentration", threshold: { pct: 25 } })],
        lessees: [lessee({})], migrations: [], leaseToLessee: new Map(), sanctions: new Map(),
        aggregates: [{ lessee_id: "l-1", lessee_name: "X", mr_balance_usd: 0, ead_usd: 0 }],
      });
      expect(fires).toEqual([]);
    });
  });
});
