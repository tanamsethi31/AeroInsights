import { describe, it, expect } from "vitest";
import { computeCreditQualityMatrix } from "./creditQualityMatrix";
import type { EclRow } from "./eclRollForward";

function row(id: string, stage: "1" | "2" | "3", ead: number, lessee: string): EclRow {
  return { id, lessee, aircraft: "A320", ead, pd12m: 1, lgd: 50, ecl12m: 0.1, eclLT: 0.2, stage };
}

describe("computeCreditQualityMatrix", () => {
  it("buckets BBB- rating into BBB grade", () => {
    const rows = [row("L1", "1", 100, "AirA")];
    const lessees = [{ name: "AirA", credit_rating: "BBB-" }];
    const result = computeCreditQualityMatrix(rows, lessees);
    expect(result).toHaveLength(1);
    expect(result[0].grade).toBe("BBB");
    expect(result[0].s1Ead).toBe(100);
    expect(result[0].s2Ead).toBe(0);
    expect(result[0].s3Ead).toBe(0);
  });

  it("buckets BB+ rating into BB / BB− grade", () => {
    const rows = [row("L1", "2", 50, "AirB")];
    const lessees = [{ name: "AirB", credit_rating: "BB+" }];
    const result = computeCreditQualityMatrix(rows, lessees);
    expect(result[0].grade).toBe("BB / BB−");
    expect(result[0].s2Ead).toBe(50);
    expect(result[0].pctPortfolio).toBe(100);
  });

  it("places null-rated lessee in Unrated row", () => {
    const rows = [row("L1", "3", 30, "AirC")];
    const lessees = [{ name: "AirC", credit_rating: null }];
    const result = computeCreditQualityMatrix(rows, lessees);
    expect(result[0].grade).toBe("Unrated");
    expect(result[0].s3Ead).toBe(30);
  });
});
