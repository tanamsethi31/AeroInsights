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

  // ── Jurisdiction risk ─────────────────────────────────────────────────────
  ctcGoldPct: number;    // 0–1: share of fleet in CTC Gold jurisdictions (ctcScore≥80 AND ctcParty:true)
  nonCtcPct: number;     // 0–1: share of fleet in Non-CTC jurisdictions (ctcParty:false AND ctcScore<50)
  // Derived: ctcModeratePct = max(0, 1 − ctcGoldPct − nonCtcPct). Not stored — computed on use.
  // Both default to 0 (feature inactive = all fleet assumed CTC Gold). Backward-compatible with ZERO_INPUTS.

  // ── Security deposits ─────────────────────────────────────────────────────────
  depositCoverage: number; // 0–1: recommended deposits as fraction of ECL baseline (0 = no deposits)

  // ── Payment behaviour ─────────────────────────────────────────────────────────
  payBehaviourCoopPct: number; // 0–1: share of fleet in Cooperative tier (score ≥ 70)
  payBehaviourAdvPct: number; // 0–1: share of fleet in Adversarial tier (score < 40)
  // Derived: neutralPct = max(0, 1 − coopPct − advPct). Not stored.
  // Both default to 0 (feature inactive = neutral baseline, 0 ECL adjustment). Backward-compatible.

  // ── Restructuring type ────────────────────────────────────────────────────────
  restructuringType: string | null; // null = no preset selected (raw slider values).
  // DSL metadata only — ECL driven by deferralMonths, govtSupportProb, forgivenessRate.
  // Does NOT affect computeECLFromBase directly. Backward-compatible: null = pre-Sprint 14 behaviour.
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
  ctcGoldPct: 0,
  nonCtcPct: 0,
  depositCoverage: 0,
  payBehaviourCoopPct: 0,
  payBehaviourAdvPct: 0,
  restructuringType: null,
};

export function computeECLFromBase(baseECL: number, inputs: ScenarioInputs): number {
  // Scale factor: macro coefficients were calibrated against BASE_ECL=$47.2M.
  // For portfolios of different sizes, the absolute dollar impact scales proportionally.
  // When baseECL = BASE_ECL (demo portfolio), scaleFactor = 1.0 — no change in behaviour.
  const scaleFactor = baseECL / BASE_ECL;

  // Macro + credit delta — scaled to actual portfolio size.
  const macroDelta = scaleFactor * (
    Math.min(0, inputs.gdpDelta) * -250 +
    Math.min(0, inputs.rpkDelta) * -48 +
    Math.max(0, inputs.fuelDelta) * 28 +
    Math.min(0, inputs.fxDelta) * -32 +
    Math.max(0, inputs.rateDelta) * 14 +
    Math.min(0, inputs.assetValueDelta) * -52 +
    (inputs.pdS2Multi - 1.0) * 8.5 +
    (inputs.pdS3Multi - 1.0) * 18.2
  );

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

  // LGD regime adjustment — null = no adjustment; unknown key = 0 (graceful fallback).
  // Note: like the mitigation benefits above, lgdDelta scales with baseECL (not absolute).
  // This is intentional: LGD adjustments represent a % of base exposure, not a fixed $ amount.
  // macroDelta also scales with baseECL via scaleFactor above.
  const lgdDelta = inputs.bankruptcyScenarioType !== null
    ? (LGD_DELTAS[inputs.bankruptcyScenarioType] ?? 0) * baseECL
    : 0;

  // Jurisdiction LGD uplift.
  // Guard: when both are 0, feature is inactive (all fleet assumed CTC Gold → 0 uplift).
  // This preserves backward compatibility with ZERO_INPUTS.
  // When active: CTC Moderate = +6% of baseECL, Non-CTC = +15% of baseECL.
  const ctcModeratePct = Math.max(0, 1 - inputs.ctcGoldPct - inputs.nonCtcPct);
  const jurisdictionLGDDelta =
    inputs.ctcGoldPct === 0 && inputs.nonCtcPct === 0
      ? 0
      : (ctcModeratePct * 0.06 + inputs.nonCtcPct * 0.15) * baseECL;

  // Security deposit benefit — cash collateral reduces LGD on default events.
  // 0.50 factor: deposits drawn at high-PD events; expected recovery ≈ 50 cents per dollar held.
  // depositCoverage = total_deposits / ECL_baseline (not fleet EAD — see creditDeposit.ts).
  const depositBenefit = inputs.depositCoverage * baseECL * 0.50;

  // Payment behaviour delta — regional payment culture adjustment to effective LGD.
  // Adversarial: +12% of baseECL (contested recoveries, high DPD, govt interference).
  // Cooperative: −7% of baseECL (fast workouts, low DPD, strong payment culture).
  // Guard: both 0 → feature inactive → 0 delta (neutral baseline, not optimistic).
  // Note: callers must ensure coopPct + advPct ≤ 1; parseDSL enforces this at parse time.
  const payBehaviourDelta =
    inputs.payBehaviourCoopPct === 0 && inputs.payBehaviourAdvPct === 0
      ? 0
      : (inputs.payBehaviourAdvPct * 0.12 - inputs.payBehaviourCoopPct * 0.07) * baseECL;

  const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit + lgdDelta + jurisdictionLGDDelta - depositBenefit + payBehaviourDelta;
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
