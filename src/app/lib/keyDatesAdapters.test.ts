import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { toKeyDateRows, toKeyDateKPIs, urgencyOf } from "./keyDatesAdapters";
import type { Lease, Asset, Lessee } from "../types/portfolio";

// Pin "today" to a known date so expiry math is deterministic
const TODAY = new Date("2026-05-09");
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(TODAY); });
afterAll(() => { vi.useRealTimers(); });

const baseAsset: Asset = {
  id: "a1", org_id: "o", upload_id: null, registration: "VT-IYC", msn: "9218",
  aircraft_type: "A320neo", manufacturer: "Airbus", vintage: 2019,
  current_operator: "IndiGo", created_at: "2024-01-01T00:00:00Z",
};

const baseLessee: Lessee = {
  id: "l1", org_id: "o", name: "IndiGo Airlines", iata_code: "6E",
  country: "India", credit_rating: "BB-", pd_estimate: 0.12,
  watchlist_status: "red", created_at: "2024-01-01T00:00:00Z",
};

const makeLease = (overrides: Partial<Lease>): Lease => ({
  id: "ls1", org_id: "o", asset_id: "a1", lessee_id: "l1",
  start_date: "2019-03-01", end_date: "2028-03-01", monthly_rental: 285000,
  currency: "USD", stage: 3, created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("urgencyOf", () => {
  it("returns 'expired' for negative days", () => {
    expect(urgencyOf(-1)).toBe("expired");
  });
  it("returns 'critical' for 0–89 days", () => {
    expect(urgencyOf(0)).toBe("critical");
    expect(urgencyOf(89)).toBe("critical");
  });
  it("returns 'watch' for 90–179 days", () => {
    expect(urgencyOf(90)).toBe("watch");
    expect(urgencyOf(179)).toBe("watch");
  });
  it("returns 'upcoming' for 180–364 days", () => {
    expect(urgencyOf(180)).toBe("upcoming");
    expect(urgencyOf(364)).toBe("upcoming");
  });
  it("returns 'long' for 365+ days", () => {
    expect(urgencyOf(365)).toBe("long");
  });
});

describe("toKeyDateRows", () => {
  it("returns one row per lease", () => {
    const rows = toKeyDateRows(
      [makeLease({ end_date: "2026-07-01" })],
      [baseAsset],
      [baseLessee],
    );
    expect(rows).toHaveLength(1);
  });

  it("sets lessee and aircraft from joins", () => {
    const rows = toKeyDateRows(
      [makeLease({ end_date: "2026-07-01" })],
      [baseAsset],
      [baseLessee],
    );
    expect(rows[0].lessee).toBe("IndiGo Airlines");
    expect(rows[0].aircraft).toBe("A320neo");
    expect(rows[0].msn).toBe("9218");
  });

  it("computes daysRemaining correctly (today=2026-05-09, expiry=2026-07-01 → 53 days)", () => {
    const rows = toKeyDateRows(
      [makeLease({ end_date: "2026-07-01" })],
      [baseAsset],
      [baseLessee],
    );
    expect(rows[0].daysRemaining).toBe(53);
  });

  it("sets urgency=critical when < 90 days", () => {
    const rows = toKeyDateRows(
      [makeLease({ end_date: "2026-07-01" })],
      [baseAsset],
      [baseLessee],
    );
    expect(rows[0].urgency).toBe("critical");
  });

  it("sets urgency=expired for past end_date", () => {
    const rows = toKeyDateRows(
      [makeLease({ end_date: "2025-01-01" })],
      [baseAsset],
      [baseLessee],
    );
    expect(rows[0].urgency).toBe("expired");
  });

  it("sorts rows by daysRemaining ascending", () => {
    const rows = toKeyDateRows(
      [
        makeLease({ id: "ls2", end_date: "2030-01-01" }),
        makeLease({ id: "ls1", end_date: "2026-07-01" }),
      ],
      [baseAsset],
      [baseLessee],
    );
    expect(rows[0].leaseId).toBe("ls1");
  });
});

describe("toKeyDateKPIs", () => {
  it("counts by urgency band", () => {
    const rows = toKeyDateRows(
      [
        makeLease({ id: "ls1", end_date: "2025-01-01" }),
        makeLease({ id: "ls2", end_date: "2026-07-01" }),
        makeLease({ id: "ls3", end_date: "2026-10-15" }),
        makeLease({ id: "ls4", end_date: "2027-02-01" }),
        makeLease({ id: "ls5", end_date: "2028-01-01" }),
      ],
      [baseAsset],
      [baseLessee],
    );
    const kpis = toKeyDateKPIs(rows);
    expect(kpis.expired).toBe(1);
    expect(kpis.critical).toBe(1);
    expect(kpis.watch).toBe(1);
    expect(kpis.upcoming).toBe(1);
    expect(kpis.long).toBe(1);
  });
});
