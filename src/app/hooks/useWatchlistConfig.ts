// src/app/hooks/useWatchlistConfig.ts
// Reads/upserts watchlist_config for active (org, portfolio).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";

export type WatchlistSignalKey =
  | "paymentLateness" | "scheduleQoQ" | "ratingChange"
  | "ctcWatchlist"    | "newsKeywordHits";

export interface WatchlistWeights extends Record<WatchlistSignalKey, number> {}
export interface WatchlistThresholds { red: number; amber: number }

export const DEFAULT_WEIGHTS: WatchlistWeights = {
  paymentLateness: 35, scheduleQoQ: 20, ratingChange: 20,
  ctcWatchlist: 15,    newsKeywordHits: 10,
};
export const DEFAULT_THRESHOLDS: WatchlistThresholds = { red: 60, amber: 30 };

export interface UseWatchlistConfigResult {
  weights:    WatchlistWeights;
  thresholds: WatchlistThresholds;
  isPersisted: boolean;
  loading:    boolean;
  error:      string | null;
  save: (next: { weights: WatchlistWeights; thresholds: WatchlistThresholds }) => Promise<void>;
  refetch:    () => Promise<void>;
}

export function useWatchlistConfig(): UseWatchlistConfigResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();

  const [weights,    setWeights]    = useState<WatchlistWeights>(DEFAULT_WEIGHTS);
  const [thresholds, setThresholds] = useState<WatchlistThresholds>(DEFAULT_THRESHOLDS);
  const [isPersisted, setPersisted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId || !activePortfolioId) return;
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase
        .from("watchlist_config")
        .select("weights, thresholds")
        .eq("org_id", orgId)
        .eq("portfolio_id", activePortfolioId)
        .maybeSingle();
      if (e) throw e;
      if (data) {
        setWeights({ ...DEFAULT_WEIGHTS, ...(data.weights as Partial<WatchlistWeights>) });
        setThresholds({ ...DEFAULT_THRESHOLDS, ...(data.thresholds as Partial<WatchlistThresholds>) });
        setPersisted(true);
      } else {
        setWeights(DEFAULT_WEIGHTS);
        setThresholds(DEFAULT_THRESHOLDS);
        setPersisted(false);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, activePortfolioId]);

  useEffect(() => { void fetchOnce(); }, [fetchOnce]);

  const save = useCallback(
    async (next: { weights: WatchlistWeights; thresholds: WatchlistThresholds }) => {
      if (!orgId || !activePortfolioId) {
        throw new Error("Active portfolio required to save watchlist config.");
      }
      setError(null);
      const { error: e } = await supabase
        .from("watchlist_config")
        .upsert(
          {
            org_id:       orgId,
            portfolio_id: activePortfolioId,
            weights:      next.weights,
            thresholds:   next.thresholds,
            updated_at:   new Date().toISOString(),
          },
          { onConflict: "org_id,portfolio_id", ignoreDuplicates: false },
        );
      if (e) { setError(e.message); throw e; }
      setWeights(next.weights);
      setThresholds(next.thresholds);
      setPersisted(true);
    },
    [orgId, activePortfolioId],
  );

  return { weights, thresholds, isPersisted, loading, error, save, refetch: fetchOnce };
}
