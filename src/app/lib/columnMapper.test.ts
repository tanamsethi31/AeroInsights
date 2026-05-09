// src/app/lib/columnMapper.test.ts
import { describe, it, expect } from "vitest";
import { suggestMapping, REQUIRED_FIELDS, OUR_FIELDS } from "./columnMapper";

describe("suggestMapping", () => {
  it("matches exact field names", () => {
    const headers = ["registration", "msn", "aircraft_type", "lessee_name", "start_date", "end_date"];
    const result = suggestMapping(headers);
    expect(result["registration"]).toBe("registration");
    expect(result["msn"]).toBe("msn");
    expect(result["lessee_name"]).toBe("lessee_name");
  });

  it("matches common aliases case-insensitively", () => {
    const headers = ["Tail No.", "S/N", "A/C Type", "Airline", "Lease Start", "Lease End"];
    const result = suggestMapping(headers);
    expect(result["registration"]).toBe("Tail No.");
    expect(result["msn"]).toBe("S/N");
    expect(result["aircraft_type"]).toBe("A/C Type");
    expect(result["lessee_name"]).toBe("Airline");
    expect(result["start_date"]).toBe("Lease Start");
    expect(result["end_date"]).toBe("Lease End");
  });

  it("returns null for fields with no matching header", () => {
    const result = suggestMapping(["something_unrelated"]);
    expect(result["registration"]).toBeNull();
    expect(result["msn"]).toBeNull();
  });

  it("REQUIRED_FIELDS contains the 6 mandatory fields", () => {
    expect(REQUIRED_FIELDS).toEqual(
      expect.arrayContaining(["registration", "msn", "aircraft_type", "lessee_name", "start_date", "end_date"])
    );
  });

  it("OUR_FIELDS lists all mappable fields", () => {
    expect(OUR_FIELDS.length).toBeGreaterThanOrEqual(21);
    expect(OUR_FIELDS.some(f => f.id === "registration")).toBe(true);
    expect(OUR_FIELDS.some(f => f.id === "lessee_name")).toBe(true);
  });

  it("does not map the same header to two different fields", () => {
    // Even if an alias appears in multiple fields, each header should only be claimed once
    const headers = ["pd", "pd estimate"];
    const result = suggestMapping(headers);
    const mappedValues = Object.values(result).filter((v): v is string => v !== null);
    const unique = new Set(mappedValues);
    expect(unique.size).toBe(mappedValues.length);
  });
});
