// api/_lib/alertEvaluator.ts
//
// Pure rule evaluator for the alerts cron (T-5.1). Takes a snapshot of
// the input tables + the rule set; returns one AlertFire per
// (rule, entity) pair that currently breaches the threshold. Cooldown
// dedup happens in the caller against alert_sends.

export type AlertKind =
  | "dpd_breach" | "stage_downgrade"
  | "watchlist_red" | "sanctions_hit"
  | "mr_shortfall" | "concentration";

export interface AlertRuleInput {
  id:           string;
  org_id:       string;
  portfolio_id: string | null;
  name:         string;
  kind:         AlertKind;
  threshold:    Record<string, unknown>;
  recipients:   string[];
  enabled:      boolean;
  cooldown_minutes: number;
}

export interface LesseeSnapshot {
  id:                  string;
  name:                string;
  country:             string | null;
  watchlist_status:    string | null;
  dpd_days:            number | null;
  insolvency_filed:    boolean | null;
  // org_id intentionally omitted — caller already filtered by org.
}

export interface StageMigrationSnapshot {
  id:                string;
  lease_external_id: string;
  from_stage:        number;
  to_stage:          number;
  direction:         "up" | "down";
  reason:            string;
  occurred_at:       string;
}

export interface JurisdictionSanctionsSnapshot {
  country: string;        // ISO name as used by lessees.country
  status:  "active" | "watch" | "none";
}

/** Per-lessee MR/EAD aggregates so the new alert kinds have data. */
export interface LesseeAggregateSnapshot {
  lessee_id:       string;
  lessee_name:     string;
  mr_balance_usd:  number;    // sum of maintenance_reserves.balance_usd
  ead_usd:         number;    // sum of provisions.ead through this lessee's leases
}

export interface AlertFire {
  ruleId:       string;
  kind:         AlertKind;
  entityId:     string;          // lessee uuid OR migration id depending on kind
  entityLabel:  string;
  subject:      string;
  body:         string;
  payload:      Record<string, unknown>;
  recipients:   string[];
}

// ── Per-kind evaluators ────────────────────────────────────────────────

function evalDpdBreach(rule: AlertRuleInput, lessees: LesseeSnapshot[]): AlertFire[] {
  const days = Number(rule.threshold.days ?? 30);
  return lessees
    .filter((l) => (l.dpd_days ?? 0) >= days)
    .map((l) => ({
      ruleId:      rule.id,
      kind:        "dpd_breach" as AlertKind,
      entityId:    l.id,
      entityLabel: l.name,
      subject:     `[Aeroinsights] ${l.name} — ${l.dpd_days} days past due`,
      body:        `${l.name} (${l.country ?? "—"}) is ${l.dpd_days} days past due, exceeding the configured threshold of ${days} days.\n\nReview the lessee profile and consider stage migration or restructuring.`,
      payload:     { dpd_days: l.dpd_days, threshold_days: days, country: l.country },
      recipients:  rule.recipients,
    }));
}

function evalStageDowngrade(
  rule:       AlertRuleInput,
  migrations: StageMigrationSnapshot[],
  leaseToLessee: Map<string, { id: string; name: string }>,
): AlertFire[] {
  const fromStage = rule.threshold.from as number | undefined;
  const toStage   = rule.threshold.to   as number | undefined;
  return migrations
    .filter((m) => m.direction === "up")
    .filter((m) => fromStage == null || m.from_stage === fromStage)
    .filter((m) => toStage   == null || m.to_stage   === toStage)
    .map((m) => {
      const lessee = leaseToLessee.get(m.lease_external_id);
      return {
        ruleId:      rule.id,
        kind:        "stage_downgrade" as AlertKind,
        entityId:    m.id,
        entityLabel: lessee?.name ?? m.lease_external_id,
        subject:     `[Aeroinsights] Stage S${m.from_stage}→S${m.to_stage}: ${lessee?.name ?? m.lease_external_id}`,
        body:        `Lease ${m.lease_external_id} migrated from Stage ${m.from_stage} to Stage ${m.to_stage}.\nReason: ${m.reason}\nOccurred: ${m.occurred_at}`,
        payload:     { lease: m.lease_external_id, from: m.from_stage, to: m.to_stage, reason: m.reason, occurred_at: m.occurred_at },
        recipients:  rule.recipients,
      };
    });
}

function evalWatchlistRed(rule: AlertRuleInput, lessees: LesseeSnapshot[]): AlertFire[] {
  return lessees
    .filter((l) => l.watchlist_status === "red")
    .map((l) => ({
      ruleId:      rule.id,
      kind:        "watchlist_red" as AlertKind,
      entityId:    l.id,
      entityLabel: l.name,
      subject:     `[Aeroinsights] ${l.name} on RED watchlist`,
      body:        `${l.name} (${l.country ?? "—"}) is flagged RED on the watchlist. Immediate review recommended.`,
      payload:     { watchlist: "red", country: l.country, dpd_days: l.dpd_days },
      recipients:  rule.recipients,
    }));
}

function evalSanctionsHit(
  rule:    AlertRuleInput,
  lessees: LesseeSnapshot[],
  sanctions: Map<string, "active" | "watch" | "none">,
): AlertFire[] {
  return lessees
    .filter((l) => l.country && sanctions.get(l.country) === "active")
    .map((l) => ({
      ruleId:      rule.id,
      kind:        "sanctions_hit" as AlertKind,
      entityId:    l.id,
      entityLabel: l.name,
      subject:     `[Aeroinsights] SANCTIONS: ${l.name} in ${l.country}`,
      body:        `${l.name} is registered in ${l.country}, which is on the active sanctions list. Halt new lease activity and review exposure.`,
      payload:     { country: l.country, sanctions: "active" },
      recipients:  rule.recipients,
    }));
}

// ── New kinds ──────────────────────────────────────────────────────────

function evalMrShortfall(rule: AlertRuleInput, aggregates: LesseeAggregateSnapshot[]): AlertFire[] {
  const minShortfallUsd = Number(rule.threshold.usd ?? 100_000);
  return aggregates
    .filter((a) => a.mr_balance_usd < 0 && Math.abs(a.mr_balance_usd) >= minShortfallUsd)
    .map((a) => ({
      ruleId:      rule.id,
      kind:        "mr_shortfall" as AlertKind,
      entityId:    a.lessee_id,
      entityLabel: a.lessee_name,
      subject:     `[Aeroinsights] ${a.lessee_name} — MR shortfall $${(Math.abs(a.mr_balance_usd)/1e6).toFixed(2)}M`,
      body:        `Maintenance reserve balance is $${(a.mr_balance_usd/1e6).toFixed(2)}M for ${a.lessee_name}. Threshold: $${(minShortfallUsd/1e6).toFixed(2)}M shortfall.`,
      payload:     { mr_balance_usd: a.mr_balance_usd, threshold_usd: minShortfallUsd },
      recipients:  rule.recipients,
    }));
}

function evalConcentration(rule: AlertRuleInput, aggregates: LesseeAggregateSnapshot[]): AlertFire[] {
  const maxPct = Number(rule.threshold.pct ?? 25);
  const total = aggregates.reduce((s, a) => s + a.ead_usd, 0);
  if (total <= 0) return [];
  return aggregates
    .map((a) => ({ a, share: (a.ead_usd / total) * 100 }))
    .filter(({ share }) => share >= maxPct)
    .map(({ a, share }) => ({
      ruleId:      rule.id,
      kind:        "concentration" as AlertKind,
      entityId:    a.lessee_id,
      entityLabel: a.lessee_name,
      subject:     `[Aeroinsights] Concentration: ${a.lessee_name} = ${share.toFixed(1)}% of portfolio EAD`,
      body:        `${a.lessee_name} is ${share.toFixed(1)}% of total portfolio EAD ($${(a.ead_usd/1e6).toFixed(1)}M of $${(total/1e6).toFixed(1)}M). Threshold: ${maxPct}%.`,
      payload:     { share_pct: share, ead_usd: a.ead_usd, total_ead_usd: total, threshold_pct: maxPct },
      recipients:  rule.recipients,
    }));
}

// ── Main entry ─────────────────────────────────────────────────────────

export interface EvaluatorContext {
  rules:         AlertRuleInput[];
  lessees:       LesseeSnapshot[];
  migrations:    StageMigrationSnapshot[];
  leaseToLessee: Map<string, { id: string; name: string }>;
  sanctions:     Map<string, "active" | "watch" | "none">;
  aggregates?:   LesseeAggregateSnapshot[];
}

export function evaluateRules(ctx: EvaluatorContext): AlertFire[] {
  const out: AlertFire[] = [];
  const aggs = ctx.aggregates ?? [];
  for (const rule of ctx.rules) {
    if (!rule.enabled) continue;
    if (rule.recipients.length === 0) continue;
    switch (rule.kind) {
      case "dpd_breach":       out.push(...evalDpdBreach(rule, ctx.lessees)); break;
      case "stage_downgrade":  out.push(...evalStageDowngrade(rule, ctx.migrations, ctx.leaseToLessee)); break;
      case "watchlist_red":    out.push(...evalWatchlistRed(rule, ctx.lessees)); break;
      case "sanctions_hit":    out.push(...evalSanctionsHit(rule, ctx.lessees, ctx.sanctions)); break;
      case "mr_shortfall":     out.push(...evalMrShortfall(rule, aggs)); break;
      case "concentration":    out.push(...evalConcentration(rule, aggs)); break;
    }
  }
  return out;
}
