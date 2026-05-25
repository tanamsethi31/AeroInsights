// src/app/hooks/useSicrConfig.ts
//
// Reads + writes the one sicr_config row per (org_id, portfolio_id).
// Used by RiskECL → SICR Config (was hardcoded; now real-DB-bound).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";

export interface SicrConfig {
  dpd_enabled:               boolean;
  dpd_threshold_days:        number;
  rating_notches_threshold:  number;
  country_watchlist_enabled: boolean;
  insolvency_filing_enabled: boolean;
  upgrade_threshold_notches: number;
}

export const DEFAULT_SICR_CONFIG: SicrConfig = {
  dpd_enabled:               true,
  dpd_threshold_days:        30,
  rating_notches_threshold:  2,
  country_watchlist_enabled: true,
  insolvency_filing_enabled: true,
  upgrade_threshold_notches: 2,
};

export interface UseSicrConfigResult {
  config: SicrConfig;
  loading: boolean;
  isPersisted: boolean;
  error: string | null;
  save: (next: SicrConfig) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSicrConfig(): UseSicrConfigResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();

  const [config, setConfig]       = useState<SicrConfig>(DEFAULT_SICR_CONFIG);
  const [loading, setLoading]     = useState(false);
  const [isPersisted, setPersisted] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId || !activePortfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from("sicr_config")
        .select("*")
        .eq("org_id", orgId)
        .eq("portfolio_id", activePortfolioId)
        .maybeSingle();
      if (e) throw e;
      if (data) {
        setConfig({
          dpd_enabled:               Boolean(data.dpd_enabled),
          dpd_threshold_days:        Number(data.dpd_threshold_days),
          rating_notches_threshold:  Number(data.rating_notches_threshold),
          country_watchlist_enabled: Boolean(data.country_watchlist_enabled),
          insolvency_filing_enabled: Boolean(data.insolvency_filing_enabled),
          upgrade_threshold_notches: Number(data.upgrade_threshold_notches),
        });
        setPersisted(true);
      } else {
        setConfig(DEFAULT_SICR_CONFIG);
        setPersisted(false);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, activePortfolioId]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  const save = useCallback(
    async (next: SicrConfig) => {
      if (!orgId || !activePortfolioId) {
        throw new Error("Active portfolio required to save SICR config.");
      }
      setError(null);
      const { error: e } = await supabase
        .from("sicr_config")
        .upsert(
          {
            org_id:       orgId,
            portfolio_id: activePortfolioId,
            ...next,
            updated_at:   new Date().toISOString(),
          },
          { onConflict: "org_id,portfolio_id", ignoreDuplicates: false },
        );
      if (e) { setError(e.message); throw e; }
      setConfig(next);
      setPersisted(true);
    },
    [orgId, activePortfolioId],
  );

  return { config, loading, isPersisted, error, save, refetch: fetchOnce };
}
