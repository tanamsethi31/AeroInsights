// src/app/data/aircraftFamilyMap.test.ts
import { describe, it, expect } from "vitest";
import { classifyAircraftFamily } from "./aircraftFamilyMap";

describe("classifyAircraftFamily — narrowbody", () => {
  it("A320neo → narrowbody", () => expect(classifyAircraftFamily("A320neo")).toBe("narrowbody"));
  it("A321XLR → narrowbody", () => expect(classifyAircraftFamily("A321XLR")).toBe("narrowbody"));
  it("B737 MAX 8 → narrowbody", () => expect(classifyAircraftFamily("B737 MAX 8")).toBe("narrowbody"));
  it("B737-800 → narrowbody", () => expect(classifyAircraftFamily("B737-800")).toBe("narrowbody"));
  it("A220-300 → narrowbody", () => expect(classifyAircraftFamily("A220-300")).toBe("narrowbody"));
});

describe("classifyAircraftFamily — widebody", () => {
  it("B777-300ER → widebody", () => expect(classifyAircraftFamily("B777-300ER")).toBe("widebody"));
  it("A350-900 → widebody",   () => expect(classifyAircraftFamily("A350-900")).toBe("widebody"));
  it("B787-9 → widebody",     () => expect(classifyAircraftFamily("B787-9")).toBe("widebody"));
  it("A330-300 → widebody",   () => expect(classifyAircraftFamily("A330-300")).toBe("widebody"));
  it("A380 → widebody",       () => expect(classifyAircraftFamily("A380")).toBe("widebody"));
});

describe("classifyAircraftFamily — regional", () => {
  it("ATR 72 → regional",  () => expect(classifyAircraftFamily("ATR 72")).toBe("regional"));
  it("ATR 42 → regional",  () => expect(classifyAircraftFamily("ATR 42")).toBe("regional"));
  it("CRJ-900 → regional", () => expect(classifyAircraftFamily("CRJ-900")).toBe("regional"));
  it("E175 → regional",    () => expect(classifyAircraftFamily("E175")).toBe("regional"));
  it("Q400 → regional",    () => expect(classifyAircraftFamily("Q400")).toBe("regional"));
});

describe("classifyAircraftFamily — fallback and case", () => {
  it("unknown type → narrowbody", () => expect(classifyAircraftFamily("XYZ-999")).toBe("narrowbody"));
  it("case-insensitive: b777-300er → widebody", () => expect(classifyAircraftFamily("b777-300er")).toBe("widebody"));
  it("case-insensitive: a320NEO → narrowbody",  () => expect(classifyAircraftFamily("a320NEO")).toBe("narrowbody"));
});
