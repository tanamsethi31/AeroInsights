import { describe, it, expect } from "vitest";
import { parseEcbResponse, type EcbSdmxJson } from "./ecb";

const MOCK_ECB_RESPONSE: EcbSdmxJson = {
  dataSets: [{
    series: {
      "0:0:0:0:0:0": {
        observations: {
          "0": [3.75, null, null],
          "1": [3.50, null, null],
        },
      },
    },
  }],
  structure: {
    dimensions: {
      observation: [{
        values: [
          { id: "2026-03-12" },
          { id: "2026-04-10" },
        ],
      }],
    },
  },
};

describe("parseEcbResponse", () => {
  it("returns observations sorted oldest-first", () => {
    const result = parseEcbResponse(MOCK_ECB_RESPONSE);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ value: 3.75, date: "2026-03-12" });
    expect(result[1]).toEqual({ value: 3.50, date: "2026-04-10" });
  });

  it("filters out null observations", () => {
    const data: EcbSdmxJson = {
      dataSets: [{
        series: {
          "0:0:0:0:0:0": {
            observations: { "0": [null, null, null], "1": [2.5, null, null] },
          },
        },
      }],
      structure: {
        dimensions: {
          observation: [{ values: [{ id: "2026-01-01" }, { id: "2026-02-01" }] }],
        },
      },
    };
    const result = parseEcbResponse(data);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(2.5);
  });

  it("returns empty array for malformed response", () => {
    const bad = { dataSets: [], structure: { dimensions: { observation: [] } } } as unknown as EcbSdmxJson;
    expect(parseEcbResponse(bad)).toEqual([]);
  });
});
