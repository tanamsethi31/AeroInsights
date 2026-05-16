// src/app/utils/sicrEvaluator.ts
// Pure SICR (Significant Increase in Credit Risk) evaluation engine.
// No side effects. Deterministic: same inputs always produce same output.
// All IFRS 9 stage logic lives here; callers apply the result to their own state.

export interface SICRConfig {
  dpdEnabled: boolean;
  dpdDays: number;             // threshold: trigger fires when dpdDays >= this value
  upgradeEnabled: boolean;
  upgradeNotches: number;      // threshold: trigger fires when ratingNotchesDown >= this value
  countryWatchlistEnabled: boolean;
  insolvencyEnabled: boolean;
}

export interface SICREvaluationInput {
  leaseId: string;
  lesseeId: string;
  lesseeName: string;
  aircraft: string;
  currentStage: "1" | "2" | "3";
  dpdDays: number;             // days past due on most recent payment
  ratingNotchesDown: number;   // notches downgraded vs. prior assessment period (0 = no downgrade)
  onCountryWatchlist: boolean; // lessee's operating country on sovereign watchlist
  insolvencyFiled: boolean;    // formal insolvency petition filed
  baseECLm: number;            // current ECL on this lease in $M — used to estimate ECL delta
}

export interface SICRMigrationRecommendation {
  leaseId: string;
  lesseeId: string;
  lesseeName: string;
  aircraft: string;
  currentStage: "1" | "2" | "3";
  recommendedStage: "2" | "3"; // always higher than currentStage
  triggersFired: string[];      // human-readable trigger names
  eclDeltaM: number;            // estimated additional ECL from migration ($M, always >= 0)
}

// Approximate ECL multiplier when moving between stages.
// S1→S2: lifetime ECL replaces 12-month ECL (approx 1.8× increase on this lease).
// S1→S3 or S2→S3: full LGD applied, roughly 3.2× and 1.6× respectively.
const ECL_STAGE_MULTIPLIER: Record<string, number> = {
  "1-2": 1.8,
  "1-3": 3.2,
  "2-3": 1.6,
};

export function evaluateSICR(
  leases: SICREvaluationInput[],
  config: SICRConfig,
): SICRMigrationRecommendation[] {
  const recommendations: SICRMigrationRecommendation[] = [];

  for (const lease of leases) {
    const triggersFired: string[] = [];

    // Evaluate triggers in priority order (insolvency → Stage 3 overrides others)
    if (config.insolvencyEnabled && lease.insolvencyFiled) {
      triggersFired.push("Lessee Insolvency Filing");
    }
    if (config.dpdEnabled && lease.dpdDays >= config.dpdDays) {
      triggersFired.push(`${config.dpdDays}+ DPD Backstop`);
    }
    if (config.upgradeEnabled && lease.ratingNotchesDown >= config.upgradeNotches) {
      triggersFired.push(`Credit Downgrade (≥${config.upgradeNotches} notches)`);
    }
    if (config.countryWatchlistEnabled && lease.onCountryWatchlist) {
      triggersFired.push("Country Watchlist Event");
    }

    if (triggersFired.length === 0) continue;

    // Insolvency → always Stage 3; any other trigger → Stage 2
    const forceStage3 = config.insolvencyEnabled && lease.insolvencyFiled;
    const recommendedStage: "2" | "3" = forceStage3 ? "3" : "2";

    // Only recommend when the migration is actually upward
    const currentNum = parseInt(lease.currentStage, 10);
    const recommendedNum = parseInt(recommendedStage, 10);
    if (currentNum >= recommendedNum) continue;

    const multiplierKey = `${lease.currentStage}-${recommendedStage}`;
    const multiplier = ECL_STAGE_MULTIPLIER[multiplierKey] ?? 1.0;
    const eclDeltaM = Math.max(0, lease.baseECLm * (multiplier - 1));

    recommendations.push({
      leaseId: lease.leaseId,
      lesseeId: lease.lesseeId,
      lesseeName: lease.lesseeName,
      aircraft: lease.aircraft,
      currentStage: lease.currentStage,
      recommendedStage,
      triggersFired,
      eclDeltaM,
    });
  }

  return recommendations;
}
