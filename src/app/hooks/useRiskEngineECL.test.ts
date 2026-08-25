import { describe, it, expect } from "vitest";
import { parseRiskEngineResponse } from "./useRiskEngineECL";

describe("parseRiskEngineResponse", () => {
  it("extracts total_ecl on a 200 with a numeric total_ecl, converting raw USD to $M", () => {
    expect(parseRiskEngineResponse(200, { total_ecl: 58_300_000 })).toEqual({ ecl: 58.3, error: null });
  });

  it("treats a 200 with a non-numeric total_ecl as an error", () => {
    expect(parseRiskEngineResponse(200, { total_ecl: "58.3" })).toEqual({
      ecl: null,
      error: "HTTP 200",
    });
  });

  it("uses the response's error message on a non-200 status", () => {
    expect(parseRiskEngineResponse(500, { error: "Supabase read failed: timeout" })).toEqual({
      ecl: null,
      error: "Supabase read failed: timeout",
    });
  });

  it("falls back to a generic HTTP status message when the body has no error field", () => {
    expect(parseRiskEngineResponse(502, null)).toEqual({ ecl: null, error: "HTTP 502" });
  });

  it("falls back to a generic HTTP status message when the body isn't an object", () => {
    expect(parseRiskEngineResponse(400, "not json")).toEqual({ ecl: null, error: "HTTP 400" });
  });
});
