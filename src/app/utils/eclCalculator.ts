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
  leaseAssumptionPct: number; // 0–1: fraction of leases debtor elects to assume (keep paying).
  // §1110 election: assumed leases → airline continues paying → lessor takes no loss on those leases.
  // 0 = all leases rejected (worst case). 1 = all leases assumed (full rent recovery).
  // Only active when bankruptcyScenarioType is non-null. Guard: 0 → no benefit.

  // ── Jurisdiction risk ─────────────────────────────────────────────────────
  ctcGoldPct: number;    // 0–1: share of fleet in CTC Gold jurisdictions (ctcScore≥80 AND ctcParty:true)
  nonCtcPct: number;     // 0–1: share of fleet in Non-CTC jurisdictions (ctcParty:false AND ctcScore<50)
  // Derived: ctcModeratePct = max(0, 1 − ctcGoldPct − nonCtcPct). Not stored — computed on use.
  // Both default to 0 (feature inactive = all fleet assumed CTC Gold). Backward-compatible with ZERO_INPUTS.
  repossWeightedMonths: number; // 0 = feature inactive. Rental-weighted P50 repossession timeline (months).
  // Calibrated against US §1110 benchmark (3 months). Each extra month costs ~2.5% of baseECL.

  // ── Asset risk (Sprint 22) ────────────────────────────────────────────────
  /** 0 = feature inactive. Rental-weighted P50 months from repossession to first day of next
   *  lease. Benchmark: 3 months (baked into base LGD). Each extra month costs ~1.5% of baseECL. */
  remarketingMonths: number;
  /** 0 = feature inactive. Rental-weighted LGD adjustment fraction from fleet vintage:
   *  0 = all young (<10yr), 0.04 = mid-aged mix (10–15yr), 0.10 = aged (>15yr).
   *  Computed by computePortfolioAssetRisk; passed directly as fraction of baseECL. */
  vintageAdjFactor: number;

  // ── Security deposits & maintenance reserves ────────────────────────────────
  depositCoverage: number;          // 0–1: cash security deposits as fraction of ECL baseline
  maintenanceReserveCoverage: number; // 0–1: maintenance reserves held by lessor as fraction of ECL baseline
  // MR recovery factor 0.35 (lower than deposits: earmarked for redelivery condition, not rent default)

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
  leaseAssumptionPct: 0,
  ctcGoldPct: 0,
  nonCtcPct: 0,
  repossWeightedMonths: 0,
  remarketingMonths: 0,
  vintageAdjFactor: 0,
  depositCoverage: 0,
  maintenanceReserveCoverage: 0,
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

  // §1110 / lease assumption benefit.
  // When the airline elects to assume leases (keep paying), ECL on those leases approaches zero.
  // Each 1% of fleet assumed → −0.25% of baseECL (empirically: assumed aircraft carry ~full rent;
  // the base LGD_DELTA already reflects the cure window on rejected leases).
  // Guard: inactive when no bankruptcy type selected, or when leaseAssumptionPct = 0.
  const assumptionBenefit =
    inputs.bankruptcyScenarioType !== null && inputs.leaseAssumptionPct > 0
      ? inputs.leaseAssumptionPct * 0.25 * baseECL
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

  // Repossession timeline LGD uplift.
  // Guard: 0 = feature inactive (all fleet on US §1110 3-month benchmark).
  // Per extra month beyond benchmark: 2.5% of baseECL
  //   (≈ 1.5% aircraft depreciation + 1% foregone rent during proceeding).
  // Rental-weighted fleet average P50 timeline is computed by computePortfolioJurisdictionMix
  // and passed in as repossWeightedMonths; benchmarkMonths = 3 (US §1110 gold standard).
  const REPOSS_BENCHMARK_MONTHS = 3;
  const repossLGDDelta = inputs.repossWeightedMonths > 0
    ? Math.max(0, inputs.repossWeightedMonths - REPOSS_BENCHMARK_MONTHS) * 0.025 * baseECL
    : 0;

  // Remarketing timeline LGD uplift (Sprint 22).
  // Guard: 0 = feature inactive. Benchmark: 3 months (baked into base 45% LGD).
  // Each extra month: 1.5% of baseECL (≈ $75k storage + foregone rent per WB-equivalent per month).
  const REMARKETING_BENCHMARK_MONTHS = 3;
  const remarketingLGDDelta = inputs.remarketingMonths > 0
    ? Math.max(0, inputs.remarketingMonths - REMARKETING_BENCHMARK_MONTHS) * 0.015 * baseECL
    : 0;

  // Vintage / aircraft age LGD uplift (Sprint 22).
  // Guard: 0 = feature inactive. vintageAdjFactor is the rental-weighted adjustment fraction
  // from computePortfolioAssetRisk; tiers: young=0, mid(10–15yr)=+4%, aged(>15yr)=+10%.
  const vintageAdjDelta = inputs.vintageAdjFactor > 0
    ? inputs.vintageAdjFactor * baseECL
    : 0;

  // Security deposit benefit — cash collateral reduces LGD on default events.
  // 0.50 factor: deposits drawn at high-PD events; expected recovery ≈ 50 cents per dollar held.
  // depositCoverage = total_deposits / ECL_baseline (not fleet EAD — see creditDeposit.ts).
  const depositBenefit = inputs.depositCoverage * baseECL * 0.50;

  // Maintenance reserve benefit — earmarked pool held by lessor, applied against redelivery
  // condition shortfall on default. 0.35 factor (lower than deposits): MRs are not freely
  // drawable against rent arrears — they offset specific maintenance-event costs only.
  const mrBenefit = inputs.maintenanceReserveCoverage * baseECL * 0.35;

  // Payment behaviour delta — regional payment culture adjustment to effective LGD.
  // Adversarial: +12% of baseECL (contested recoveries, high DPD, govt interference).
  // Cooperative: −7% of baseECL (fast workouts, low DPD, strong payment culture).
  // Guard: both 0 → feature inactive → 0 delta (neutral baseline, not optimistic).
  // Note: callers must ensure coopPct + advPct ≤ 1; parseDSL enforces this at parse time.
  const payBehaviourDelta =
    inputs.payBehaviourCoopPct === 0 && inputs.payBehaviourAdvPct === 0
      ? 0
      : (inputs.payBehaviourAdvPct * 0.12 - inputs.payBehaviourCoopPct * 0.07) * baseECL;

  const delta = macroDelta + deferralPenalty - pbhBenefit - etpBenefit - lecBenefit + lgdDelta - assumptionBenefit + jurisdictionLGDDelta + repossLGDDelta - depositBenefit - mrBenefit + payBehaviourDelta + remarketingLGDDelta + vintageAdjDelta;
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
