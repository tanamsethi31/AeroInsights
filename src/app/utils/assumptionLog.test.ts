// src/app/utils/assumptionLog.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logAssumptionChange } from "./assumptionLog";
import type { AssumptionChangePayload } from "./assumptionLog";

const mockInsert = vi.fn();
const mockFrom   = vi.fn(() => ({ insert: mockInsert }));
const mockSupabase = { from: mockFrom } as any;

const basePayload: AssumptionChangePayload = {
  orgId:          "org-123",
  assumptionType: "pd_curve",
  segment:        "lcc",
  action:         "override",
  previousValue:  null,
  newValue:       { pd1yr: 0.05, pd2yr: 0.09, pd3yr: 0.13, pd5yr: 0.18, pd_lifetime: 0.35 },
  notes:          "test override",
  changedBy:      "analyst@example.com",
};

describe("logAssumptionChange", () => {
  beforeEach(() => {
    mockInsert.mockReset();
    mockFrom.mockReset();
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts the correct fields into assumption_change_log", async () => {
    mockInsert.mockResolvedValue({ error: null });

    await logAssumptionChange(mockSupabase, basePayload);

    expect(mockFrom).toHaveBeenCalledWith("assumption_change_log");
    expect(mockInsert).toHaveBeenCalledWith({
      org_id:          "org-123",
      assumption_type: "pd_curve",
      segment:         "lcc",
      action:          "override",
      previous_value:  null,
      new_value:       { pd1yr: 0.05, pd2yr: 0.09, pd3yr: 0.13, pd5yr: 0.18, pd_lifetime: 0.35 },
      notes:           "test override",
      changed_by:      "analyst@example.com",
    });
  });

  it("does not throw when the insert fails — logs a console warning instead", async () => {
    mockInsert.mockResolvedValue({ error: { message: "DB unavailable" } });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(logAssumptionChange(mockSupabase, basePayload)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[assumptionLog]"),
      expect.stringContaining("DB unavailable"),
    );
  });
});
