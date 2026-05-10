// src/app/utils/eclCalculator.ts

export interface ScenarioInputs {
  // ── Macro shocks ──────────────────────────────────────────────────────────
  gdpDelta: number;          // e.g. −0.02 = −2%
  rpkDelta: number;          // e.g. −0.25 = −25%
  fuelDelta: number;         // e.g. 0.40 = +40%
  fxDelta: number;           // e.g. −0.15 = −15%
  rateDelta: number;         // e.g. 0.0075 = +75 bps
  assetValueDelta: number;   // e.g. −0.10 = −10%
  pdS2Multi: number;         // e.g. 1.4
  pdS3Multi: number;         // e.g. 1.2

  // ── Deferral & forgiveness ────────────────────────────────────────────────
  deferralMonths: number;    // 0–24: months of rent deferred across the fleet
  govtSupportProb: number;   // 0–1: probability government backstops deferred rent
  forgivenessRate: number;   // 0–1: share of deferred rent permanently written off

  // ── Lessor mitigation ────────────────────────────────────────────────────
  pbhConversionPct: number;  // 0–1: share of fleet switching to Power-by-Hour
  etpRate: number;           // 0–1: early termination penalty as % of remaining lease value
  lecRate: number;           // 0–1: lease end compensation as % of half-life value

  // ── Insolvency regime ─────────────────────────────────────────────────────
  bankruptcyScenarioType: string | null; // null = no regime selected (zero ECL impact)
}

export interface StageDistribution {
  s1: number;
  s2: number;
  s3: number;
}

export const BASE_ECL = 47.2;

// Monthly rent proxy for deferral penalty ($M). Matches demo fleet total monthly rent.
const MONTHLY_RENT_M = 2.85;

// LGD adjustment factors by insolvency regime (fraction of baseECL).
// Calibrated from P50 haircut data in InsolvencyTab.tsx.
// Positive = ECL increases (worse LGD), Negative = ECL decreases (better recovery).
// null bankruptcyScenarioType = 0 adjustment (no regime selected).
// Unknown keys fall back to 0 via the ?? operator in computeECLFromBase.
export const LGD_DELTAS: Record<string, number> = {
  chapter11:           -0.12,  // §1110 cure window; gold standard for lessor recovery
  india_ibc:           -0.05,  // CTC Act 2025 improvement; slower than US
  mexico_concurso:      0.02,  // CTC in force; roughly neutral
  brazil_rj:            0.04,  // AerCap LATAM precedent; up to 380-day stay
  indonesia_pkpu:       0.09,  // Not CTC-compliant; government pressure
  generic_liquidation:  0.18,  // Full loss floor; lessor ranks pari passu
};

export const ZERO_INPUTS: ScenarioInputs = {
  gdpDelta: 0,
  rpkDelta: 0,
  fuelDelta: 0,
  fxDelta: 0,
  rateDelta: 0,
  assetValueDelta: 0,
  pdS2Multi: 1.0,
  pdS3Multi: 1.0,
  deferralMonths: 0,
  govtSupportProb: 0,
  forgivenessRate: 0,
  pbhConversionPct: 0,
  etpRate: 0,
  lecRate: 0,
  bankruptcyScenarioType: null,
};

export function computeECLFromBase(baseECL: number, inputs: ScenarioInputs): number {
  // Macro + credit delta (unchanged)
  const macroDelta =
    Math.min(0, inputs.gdpDelta) * -250 +
    Math.min(0, inputs.rpkDelta) * -48 +
    Math.max(0, inputs.fuelDelta) * 28 +
    Math.min(0, inputs.fxDelta) * -32 +
    Math.max(0, inputs.rateDelta) * 14 +
    Math.min(0, inputs.assetValueDelta) * -52 +
    (inputs.pdS2Multi - 1.0) * 8.5 +
    (inputs.pdS3Multi - 1.0) * 18.2;

  // Deferral penalty: months × (1 − govt support) × forgiveness × monthly rent.
  // Intentional simplification: when forgivenessRate = 0 (full repayment expected),
  // penalty is zero — this model captures ECL from permanent write-offs only, not
  // from time-value-of-money modification loss (IFRS 9 §5.5.25). Acceptable for
  // scenario stress-testing; not for individual lease modification accounting.
  const deferralPenalty =
    inputs.deferralMonths *
    (1 - inputs.govtSupportProb) *
    inputs.forgivenessRate *
    MONTHLY_RENT_M;

  // Lessor mitigation benefits (reduce ECL)
  const pbhBenefit = inputs.pbhConversionPct * baseECL * 0.15;
  const etpBenefit = inputs.etpRate          * baseECL * 0.08;
  const lecBenefit = inputs.lecRate          * baseECL * 0.05;

  // LGD regime adjustment — null = no adjustment; unknown key = 0 (graceful fallback)
  const lgdDelta = inputs.bankruptcyScenarioType !== null
    ? (LGD_DELTAS[inputs.bankruptcyScenarioType] ?? 0) * baseECL
    : 0;

  const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit + lgdDelta;
  return Math.max(baseECL * 0.3, baseECL + delta);
}

export function computeECL(inputs: ScenarioInputs): number {
  return computeECLFromBase(BASE_ECL, inputs);
}

export function computeStages(ecl: number, inputs: ScenarioInputs): StageDistribution {
  const stress = Math.max(
    0,
    Math.min(0, inputs.rpkDelta) * -2 +
      (inputs.pdS3Multi - 1) * 1.5 +
      Math.min(0, inputs.assetValueDelta) * -1.5
  ) / 3;
  const s1Share = Math.max(0.05, 0.178 - stress * 0.13);
  const s3Share = Math.min(0.70, 0.365 + stress * 0.25);
  const s2Share = Math.max(0.05, 1 - s1Share - s3Share);
  return { s1: ecl * s1Share, s2: ecl * s2Share, s3: ecl * s3Share };
}
