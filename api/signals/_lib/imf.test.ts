import { describe, it, expect } from "vitest";
import { parseImfResponse, type ImfResponse } from "./imf";

const MOCK_IMF: ImfResponse = {
  values: {
    NGDP_RPCH: {
      IND: { "2025": 6.3, "2026": 5.8 },
      BRA: { "2025": 2.8, "2026": 2.1 },
    },
  },
};

describe("parseImfResponse", () => {
  it("returns the latest year value for each requested country", () => {
    const result = parseImfResponse(MOCK_IMF, ["IND", "BRA"]);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.countryCode === "IND")).toEqual({ countryCode: "IND", year: "2026", value: 5.8 });
    expect(result.find(r => r.countryCode === "BRA")).toEqual({ countryCode: "BRA", year: "2026", value: 2.1 });
  });

  it("skips countries with no data", () => {
    const result = parseImfResponse(MOCK_IMF, ["IND", "ZZZ"]);
    expect(result).toHaveLength(1);
    expect(result[0].countryCode).toBe("IND");
  });

  it("returns empty array for empty response", () => {
    expect(parseImfResponse({ values: {} }, ["IND"])).toEqual([]);
  });
});
