import { describe, it, expect } from "vitest";
import { parseCsv } from "./csvParser";

describe("parseCsv — basic parsing", () => {
  it("parses a simple 2-column CSV", () => {
    const result = parseCsv("date,amount\n2026-01-01,100\n2026-01-02,200");
    expect(result).toEqual([
      ["date", "amount"],
      ["2026-01-01", "100"],
      ["2026-01-02", "200"],
    ]);
  });

  it("handles CRLF line endings", () => {
    const result = parseCsv("a,b\r\n1,2\r\n3,4");
    expect(result).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  it("handles quoted fields containing commas", () => {
    const result = parseCsv('date,"amount, USD"\n2026-01-01,"1,000.00"');
    expect(result).toEqual([
      ["date", "amount, USD"],
      ["2026-01-01", "1,000.00"],
    ]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    const result = parseCsv('a,b\n"say ""hello""",world');
    expect(result).toEqual([["a", "b"], ['say "hello"', "world"]]);
  });

  it("returns empty cells for missing trailing fields", () => {
    const result = parseCsv("a,b,c\n1,,3");
    expect(result).toEqual([["a", "b", "c"], ["1", "", "3"]]);
  });

  it("skips entirely blank lines", () => {
    const result = parseCsv("a,b\n\n1,2\n\n3,4");
    expect(result).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  it("handles a trailing newline without adding an empty row", () => {
    const result = parseCsv("a,b\n1,2\n");
    expect(result).toEqual([["a", "b"], ["1", "2"]]);
  });
});
