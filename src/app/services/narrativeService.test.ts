import { describe, it, expect, vi, afterEach } from "vitest";
import { generateBoardPackSummary } from "./narrativeService";
import type { PortfolioExportData } from "../lib/portfolioAdapters";

const SAMPLE_DATA: PortfolioExportData = {
  eclRows: [
    { id: "L1", lessee: "IndiGo Airlines", aircraft: "A320neo", ead: 24.2, pd12m: 12.4, lgd: 54, ecl12m: 1.62, eclLT: 2.36, stage: "3" },
    { id: "L2", lessee: "Emirates", aircraft: "B777-300ER", ead: 88.4, pd12m: 0.3, lgd: 28, ecl12m: 0.07, eclLT: 0.27, stage: "1" },
  ],
  leaseRows: [],
  lesseeRows: [
    { name: "IndiGo Airlines", country: "India", rating: "BB-", stage: "3", behavior: 44, leases: 1, exposure: "$24.2M", daysLate: 45 },
    { name: "Emirates", country: "UAE", rating: "A-", stage: "1", behavior: 94, leases: 1, exposure: "$88.4M", daysLate: 0.2 },
  ],
  aircraftRows: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateBoardPackSummary", () => {
  it("returns the AI response when the anchors validate", async () => {
    const totalEcl = "1.7"; // 1.62 + 0.07 = 1.69 -> toFixed(1) = "1.7"
    const eclPct = "1.50";  // 1.69 / 112.6 * 100 = 1.5008... -> toFixed(2) = "1.50"
    const stage3Count = "1"; // IndiGo Airlines is the only stage "3" lease
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: `The portfolio carries a total ECL of $${totalEcl}M, or ${eclPct}% of book value, across 2 leases. ${stage3Count} lease sits in Stage 3.` } }],
      }),
    }));
    const result = await generateBoardPackSummary(SAMPLE_DATA, "tok");
    expect(result).toContain(totalEcl);
    expect(result).toContain(eclPct);
    expect(result).toContain(stage3Count);
  });

  it("falls back to the deterministic summary when the AI response fails anchor validation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "A generic summary with no real numbers." } }] }),
    }));
    const result = await generateBoardPackSummary(SAMPLE_DATA, "tok");
    expect(result).toContain("$1.7M");
    expect(result).toContain("book value");
  });

  it("falls back to the deterministic summary when the fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await generateBoardPackSummary(SAMPLE_DATA, "tok");
    expect(result).toContain("$1.7M");
  });

  it("falls back to the deterministic summary on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" }));
    const result = await generateBoardPackSummary(SAMPLE_DATA, "tok");
    expect(result).toContain("$1.7M");
  });

  it("deterministic fallback names the largest single ECL exposure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const result = await generateBoardPackSummary(SAMPLE_DATA, "tok");
    expect(result).toContain("IndiGo Airlines");
  });

  it("deterministic fallback handles empty portfolio (null topLessee) gracefully", async () => {
    const emptyData: PortfolioExportData = {
      eclRows: [],
      leaseRows: [],
      lesseeRows: [],
      aircraftRows: [],
    };
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const result = await generateBoardPackSummary(emptyData, "tok");
    expect(result).toContain("$0.0M");
    expect(result).not.toContain("carries the largest single ECL exposure");
  });
});
