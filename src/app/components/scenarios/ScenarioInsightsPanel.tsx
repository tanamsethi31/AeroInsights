import type { ScenarioRunResult } from "./RunResultPanel";

// ── Pure functions (exported for testing) ─────────────────────────────────────

export function deriveProvisionData(ecl: number, baseECL: number): {
  gap: number;
  gapPct: number;
  fillPct: number;
  adequacy: "under" | "over" | "adequate";
} {
  if (baseECL === 0) return { gap: 0, gapPct: 0, fillPct: 100, adequacy: "adequate" as const };

  const gap = ecl - baseECL;
  const gapPct = (gap / baseECL) * 100;
  const fillPct = Math.min(100, (baseECL / ecl) * 100);
  const adequacy: "under" | "over" | "adequate" =
    gap > baseECL * 0.05  ? "under"
    : gap < -(baseECL * 0.05) ? "over"
    : "adequate";
  return { gap, gapPct, fillPct, adequacy };
}

export function deriveRemainingS3(run: ScenarioRunResult): number {
  const topSum = run.topLessees.reduce((s, l) => s + l.ecl, 0);
  return Math.max(0, run.s3 - topSum);
}

// Component will be added in Task 2
