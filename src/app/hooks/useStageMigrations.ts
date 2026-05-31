// src/app/hooks/useStageMigrations.ts
//
// T-3.5 — Reads stage_migrations for the active portfolio. Used by the
// IFRS-9 stage transition panel on RiskECL so analysts and auditors can
// see every 1→2 / 2→3 / down-stage event in chronological order.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";
import { dbPortfolioId } from "../utils/portfolioId";

export type StageMigrationReason = "ingestion" | "sicr" | "manual" | "scenario_run";
export type StageMigrationDirection = "up" | "down";

export interface StageMigration {
  id:               string;
  leaseExternalId:  string;
  leaseUuid:        string | null;
  fromStage:        number;
  toStage:          number;
  direction:        StageMigrationDirection;
  reason:           StageMigrationReason;
  signal:           string | null;
  runId:            string | null;
  occurredAt:       string;
  actor:            string;
}

interface StageMigrationRow {
  id:                 string;
  lease_external_id:  string;
  lease_uuid:         string | null;
  from_stage:         number;
  to_stage:           number;
  direction:          StageMigrationDirection;
  reason:             StageMigrationReason;
  signal:             string | null;
  run_id:             string | null;
  occurred_at:        string;
  actor:              string;
}

function mapRow(r: StageMigrationRow): StageMigration {
  return {
    id:              r.id,
    leaseExternalId: r.lease_external_id,
    leaseUuid:       r.lease_uuid,
    fromStage:       r.from_stage,
    toStage:         r.to_stage,
    direction:       r.direction,
    reason:          r.reason,
    signal:          r.signal,
    runId:           r.run_id,
    occurredAt:      r.occurred_at,
    actor:           r.actor,
  };
}

export interface UseStageMigrationsResult {
  migrations: StageMigration[];
  loading:    boolean;
  error:      string | null;
  refetch:    () => Promise<void>;
}

export function useStageMigrations(limit: number = 100): UseStageMigrationsResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();
  const [migrations, setMigrations] = useState<StageMigration[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
      const dbId = dbPortfolioId(activePortfolioId);
    if (!orgId || !dbId) { setMigrations([]); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase
        .from("stage_migrations")
        .select("*")
        .eq("org_id", orgId)
        .eq("portfolio_id", dbId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (e) throw e;
      setMigrations(((data ?? []) as StageMigrationRow[]).map(mapRow));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, activePortfolioId, limit]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  return { migrations, loading, error, refetch: fetchOnce };
}
