import { describe, it, expect } from "vitest";
import { computeRollForward, type EclRow } from "./eclRollForward";

function row(id: string, stage: "1" | "2" | "3", eclLT: number): EclRow {
  return { id, lessee: "TestAir", aircraft: "A320", ead: eclLT * 10, pd12m: 1, lgd: 50, ecl12m: eclLT / 2, eclLT, stage };
}

describe("computeRollForward", () => {
  it("allocates new originations entirely to Stage 1 column", () => {
    const prev: EclRow[] = [];
    const curr = [row("L1", "1", 5.0)];
    const lines = computeRollForward(prev, curr);
    const newOrig = lines.find(l => l.label.includes("New originations"))!;
    expect(newOrig.stage1).toBe(5.0);
    expect(newOrig.stage2).toBe(0);
    expect(newOrig.stage3).toBe(0);
    expect(newOrig.total).toBe(5.0);
  });

  it("splits SICR transfer Stage 1 → 2 as negative S1, positive S2", () => {
    const prev = [row("L1", "1", 4.0)];
    const curr = [row("L1", "2", 6.0)];
    const lines = computeRollForward(prev, curr);
    const sicr = lines.find(l => l.label.includes("1 → 2"))!;
    expect(sicr.stage1).toBe(-4.0);
    expect(sicr.stage2).toBe(6.0);
    expect(sicr.stage3).toBe(0);
  });

  it("assigns derecognition as negative in the correct stage column", () => {
    const prev = [row("L1", "2", 3.0)];
    const curr: EclRow[] = [];
    const lines = computeRollForward(prev, curr);
    const derecog = lines.find(l => l.label.includes("Derecognition"))!;
    expect(derecog.stage1).toBe(0);
    expect(derecog.stage2).toBe(-3.0);
    expect(derecog.stage3).toBe(0);
  });

  it("balancing line makes closing = opening + all movements", () => {
    const prev = [row("L1", "1", 10.0), row("L2", "2", 5.0)];
    const curr = [row("L1", "1", 11.0), row("L2", "2", 6.0), row("L3", "1", 2.0)];
    const lines = computeRollForward(prev, curr);
    const opening = lines[0];
    const closing = lines[lines.length - 1];
    const sumMovements = lines.slice(1, -1).reduce(
      (s, l) => ({ s1: s.s1 + l.stage1, s2: s.s2 + l.stage2, s3: s.s3 + l.stage3 }),
      { s1: 0, s2: 0, s3: 0 }
    );
    expect(closing.stage1).toBeCloseTo(opening.stage1 + sumMovements.s1, 10);
    expect(closing.stage2).toBeCloseTo(opening.stage2 + sumMovements.s2, 10);
    expect(closing.stage3).toBeCloseTo(opening.stage3 + sumMovements.s3, 10);
  });
});
