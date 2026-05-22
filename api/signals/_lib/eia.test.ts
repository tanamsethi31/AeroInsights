import { describe, it, expect } from "vitest";
import { parseEiaResponse, type EiaResponse } from "./eia";

const MOCK_EIA: EiaResponse = {
  response: {
    data: [
      { period: "2026-04-28", value: "89.50" },
      { period: "2026-04-21", value: "87.20" },
    ],
  },
};

describe("parseEiaResponse", () => {
  it("parses string values as floats, newest first", () => {
    const result = parseEiaResponse(MOCK_EIA);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ period: "2026-04-28", value: 89.5 });
    expect(result[1]).toEqual({ period: "2026-04-21", value: 87.2 });
  });

  it("accepts numeric values", () => {
    const data: EiaResponse = { response: { data: [{ period: "2026-04-28", value: 89.5 }] } };
    expect(parseEiaResponse(data)[0].value).toBe(89.5);
  });

  it("filters out non-numeric values", () => {
    const data: EiaResponse = { response: { data: [{ period: "2026-04-28", value: "N/A" }] } };
    expect(parseEiaResponse(data)).toHaveLength(0);
  });

  it("returns empty array for missing data", () => {
    expect(parseEiaResponse({ response: { data: [] } })).toEqual([]);
  });
});
