// src/app/hooks/useEclSnapshots.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";
import { logAudit } from "../services/auditLog";
import type { CurrencyCode } from "../contexts/CurrencyContext";
import type { ScenarioInputs } from "../utils/eclCalculator";
import type { EclRow } from "../utils/eclRollForward";
import { dbPortfolioId } from "../utils/portfolioId";

export interface SicrConfig {
  dpdEnabled:              boolean;
  dpdDays:                 number;
  upgradeEnabled:          boolean;
  upgradeNotches:          number;
  countryWatchlistEnabled: boolean;
  insolvencyEnabled:       boolean;
}

export interface ScenarioSummaryEntry {
  ecl12m:      number;
  eclLifetime: number;
  coverage:    number;
}

export interface EclSnapshot {
  id:              string;
  periodLabel:     string;
  lockedAt:        string;
  lockedBy:        string;
  stage1Ecl:       number;
  stage2Ecl:       number;
  stage3Ecl:       number;
  totalEcl:        number;
  ecl12m:          number;
  coveragePct:     number;
  scenarioInputs:  { base: ScenarioInputs; adverse: ScenarioInputs; upside: ScenarioInputs };
  weights:         { base: number; adverse: number; upside: number };
  scenarioSummary: { base: ScenarioSummaryEntry; adverse: ScenarioSummaryEntry; upside: ScenarioSummaryEntry };
  weighted:        { ecl12m: number; eclLifetime: number; coverage: number };
  sicrConfig:      SicrConfig;
  eclRows:         EclRow[];
  currency:        CurrencyCode;
}

export type LockPeriodPayload = Omit<EclSnapshot, "id" | "lockedAt" | "lockedBy">;

interface Result {
  snapshots:  EclSnapshot[];
  isLoading:  boolean;
  /**
   * Persist a locked period for the active portfolio. Resolves with the
   * inserted snapshot id, or throws when the period label is already taken
   * (duplicate-period guard at the DB layer).
   */
  lockPeriod: (payload: LockPeriodPayload) => Promise<void>;
}

function mapRow(r: Record<string, unknown>): EclSnapshot {
  return {
    id:              r.id as string,
    periodLabel:     r.period_label as string,
    lockedAt:        r.locked_at as string,
    lockedBy:        r.locked_by as string,
    stage1Ecl:       Number(r.stage1_ecl),
    stage2Ecl:       Number(r.stage2_ecl),
    stage3Ecl:       Number(r.stage3_ecl),
    totalEcl:        Number(r.total_ecl),
    ecl12m:          Number(r.ecl_12m),
    coveragePct:     Number(r.coverage_pct),
    scenarioInputs:  r.scenario_inputs as EclSnapshot["scenarioInputs"],
    weights:         r.weights         as EclSnapshot["weights"],
    scenarioSummary: r.scenario_summary as EclSnapshot["scenarioSummary"],
    weighted:        r.weighted        as EclSnapshot["weighted"],
    sicrConfig:      r.sicr_config     as SicrConfig,
    eclRows:         r.ecl_rows        as EclRow[],
    // @ts-expect-error TODO(safety-net): string narrowed to CurrencyCode — add a runtime validator
    currency:        r.currency        as string,
  };
}

export function useEclSnapshots(): Result {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();
  const [snapshots, setSnapshots] = useState<EclSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const dbId = dbPortfolioId(activePortfolioId);
      if (!orgId || !dbId) {
        setSnapshots([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const { data, error } = await supabase
        .from("ecl_period_snapshots")
        .select("*")
        .eq("org_id", orgId)
        .eq("portfolio_id", dbId)
        .order("locked_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (!error && data) {
        setSnapshots((data as Record<string, unknown>[]).map(mapRow));
      }
      setIsLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [orgId, activePortfolioId]);

  const lockPeriod = useCallback(
    async (payload: LockPeriodPayload) => {
      const dbId = dbPortfolioId(activePortfolioId);
      if (!orgId || !dbId) {
        throw new Error("No active portfolio — cannot lock a period.");
      }
      const user = (await supabase.auth.getUser()).data.user;
      const lockedBy = user?.email ?? "unknown";
      const { error } = await supabase.from("ecl_period_snapshots").insert({
        org_id:           orgId,
        portfolio_id:     dbId,
        period_label:     payload.periodLabel,
        locked_by:        lockedBy,
        stage1_ecl:       payload.stage1Ecl,
        stage2_ecl:       payload.stage2Ecl,
        stage3_ecl:       payload.stage3Ecl,
        total_ecl:        payload.totalEcl,
        ecl_12m:          payload.ecl12m,
        coverage_pct:     payload.coveragePct,
        scenario_inputs:  payload.scenarioInputs,
        weights:          payload.weights,
        scenario_summary: payload.scenarioSummary,
        weighted:         payload.weighted,
        sicr_config:      payload.sicrConfig,
        ecl_rows:         payload.eclRows,
        currency:         payload.currency,
      });
      if (error) {
        // Surface the duplicate-period constraint as a friendly message —
        // the modal will catch + display it.
        if (error.code === "23505" || /unique/i.test(error.message)) {
          throw new Error(
            `Period "${payload.periodLabel}" is already locked for this portfolio.`
          );
        }
        throw error;
      }
      // Inline post-insert refresh (same pattern as useLgdCurves.ts)
      const { data } = await supabase
        .from("ecl_period_snapshots")
        .select("*")
        .eq("org_id", orgId)
        .eq("portfolio_id", dbId)
        .order("locked_at", { ascending: false })
        .limit(20);
      if (data) {
        setSnapshots((data as Record<string, unknown>[]).map(mapRow));
      }
      // T-3.4 — Period lock is the highest-value audit event we record.
      void logAudit({
        orgId,
        portfolioId: activePortfolioId,
        entityType:  "ecl_period_snapshot",
        entityId:    payload.periodLabel,
        action:      "lock",
        after: {
          periodLabel: payload.periodLabel,
          totalEcl:    payload.totalEcl,
          stage1Ecl:   payload.stage1Ecl,
          stage2Ecl:   payload.stage2Ecl,
          stage3Ecl:   payload.stage3Ecl,
          ecl12m:      payload.ecl12m,
          coveragePct: payload.coveragePct,
          weights:     payload.weights,
          currency:    payload.currency,
        },
      });
    },
    [orgId, activePortfolioId]
  );

  return { snapshots, isLoading, lockPeriod };
}
