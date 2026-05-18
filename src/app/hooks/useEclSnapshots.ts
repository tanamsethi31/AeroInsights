// src/app/hooks/useEclSnapshots.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import type { ScenarioInputs } from "../utils/eclCalculator";
import type { EclRow } from "../utils/eclRollForward";

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
  currency:        string;
}

export type LockPeriodPayload = Omit<EclSnapshot, "id" | "lockedAt" | "lockedBy">;

interface Result {
  snapshots:  EclSnapshot[];
  isLoading:  boolean;
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
    currency:        r.currency        as string,
  };
}

export function useEclSnapshots(): Result {
  const { orgId } = useData();
  const [snapshots, setSnapshots] = useState<EclSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!orgId) { setIsLoading(false); return; }
      setIsLoading(true);
      const { data, error } = await supabase
        .from("ecl_period_snapshots")
        .select("*")
        .eq("org_id", orgId)
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
  }, [orgId]);

  const lockPeriod = useCallback(
    async (payload: LockPeriodPayload) => {
      if (!orgId) return;
      const user = (await supabase.auth.getUser()).data.user;
      const lockedBy = user?.email ?? "unknown";
      const { error } = await supabase.from("ecl_period_snapshots").insert({
        org_id:           orgId,
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
      if (error) throw error;
      // Inline post-insert refresh (same pattern as useLgdCurves.ts)
      const { data } = await supabase
        .from("ecl_period_snapshots")
        .select("*")
        .eq("org_id", orgId)
        .order("locked_at", { ascending: false })
        .limit(20);
      if (data) {
        setSnapshots((data as Record<string, unknown>[]).map(mapRow));
      }
    },
    [orgId]
  );

  return { snapshots, isLoading, lockPeriod };
}
