import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { getMonthLabel, toPaymentSchedule } from "./paymentAdapters";
import { MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES } from "../data/mockPortfolioData";

// Pin "today" to a known date so cashflow math is deterministic
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-05-09")); });
afterAll(() => { vi.useRealTimers(); });

describe("getMonthLabel", () => {
  it('converts "2026-05" → "May 26"', () => {
    expect(getMonthLabel("2026-05")).toBe("May 26");
  });

  it('converts "2027-01" → "Jan 27"', () => {
    expect(getMonthLabel("2027-01")).toBe("Jan 27");
  });
});

describe("toPaymentSchedule", () => {
  it("produces 12 months starting with 2026-05", () => {
    const schedule = toPaymentSchedule(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);
    expect(schedule.monthKeys).toHaveLength(12);
    expect(schedule.monthKeys[0]).toBe("2026-05");
  });

  it("last month key is 2027-04", () => {
    const schedule = toPaymentSchedule(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);
    expect(schedule.monthKeys[11]).toBe("2027-04");
  });

  it("mock-ls4 (SriLankan, end 2026-09-01): May 26 is active, Sep 26 is expiring, Oct 26 is expired", () => {
    const schedule = toPaymentSchedule(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);
    const ls4Row = schedule.rows.find((r) => r.leaseId === "mock-ls4");
    expect(ls4Row).toBeDefined();
    // May 2026 → index 0
    expect(ls4Row!.cells[0].status).toBe("active");
    // Sep 2026 → index 4
    expect(ls4Row!.cells[4].status).toBe("expiring");
    // Oct 2026 → index 5
    expect(ls4Row!.cells[5].status).toBe("expired");
  });

  it("mock-ls1 (IndiGo, end 2028-03-01): all 12 cells are active", () => {
    const schedule = toPaymentSchedule(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);
    const ls1Row = schedule.rows.find((r) => r.leaseId === "mock-ls1");
    expect(ls1Row).toBeDefined();
    for (const cell of ls1Row!.cells) {
      expect(cell.status).toBe("active");
    }
  });

  it("monthlyTotals[0] equals sum of monthly_rental for all leases active/expiring in May 2026", () => {
    const schedule = toPaymentSchedule(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);
    // All 10 leases started before May 2026 and none expired before May 2026
    const expectedTotal = MOCK_LEASES.reduce((sum, l) => sum + (l.monthly_rental ?? 0), 0);
    expect(schedule.monthlyTotals[0]).toBe(expectedTotal);
  });

  it("grandTotal equals sum of all row totals", () => {
    const schedule = toPaymentSchedule(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);
    const sumOfRowTotals = schedule.rows.reduce((sum, r) => sum + r.rowTotal, 0);
    expect(schedule.grandTotal).toBe(sumOfRowTotals);
  });

  it("rows sorted: stage 3 rows appear before stage 2 rows", () => {
    const schedule = toPaymentSchedule(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);
    const stages = schedule.rows.map((r) => r.stage);
    const firstStage2Index = stages.findIndex((s) => s === "2");
    const lastStage3Index = stages.lastIndexOf("3");
    // All stage 3 rows must appear before any stage 2 rows
    expect(lastStage3Index).toBeLessThan(firstStage2Index);
  });
});
