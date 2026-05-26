// src/app/hooks/useWatchlist.ts
// T-5.3 — Reads watchlist_entries for the active portfolio.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";

export type WatchlistStatus = "green" | "amber" | "red";

export interface WatchlistEntry {
  lesseeId:    string;
  status:      WatchlistStatus;
  score:       number;
  signals:     Record<string, { value: number; rawDisplay: string }>;
  triggeredBy: string | null;
  reason:      string | null;
  evaluatedAt: string;
}

interface Row {
  lessee_id:    string;
  status:       WatchlistStatus;
  score:        number;
  signals:      Record<string, { value: number; rawDisplay: string }>;
  triggered_by: string | null;
  reason:       string | null;
  evaluated_at: string;
}

function map(r: Row): WatchlistEntry {
  return {
    lesseeId:    r.lessee_id,
    status:      r.status,
    score:       Number(r.score),
    signals:     r.signals,
    triggeredBy: r.triggered_by,
    reason:      r.reason,
    evaluatedAt: r.evaluated_at,
  };
}

export interface UseWatchlistResult {
  entries:     WatchlistEntry[];
  byLesseeId:  Map<string, WatchlistEntry>;
  loading:     boolean;
  error:       string | null;
  refetch:     () => Promise<void>;
}

export function useWatchlist(): UseWatchlistResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId || !activePortfolioId) { setEntries([]); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase
        .from("watchlist_entries")
        .select("lessee_id,status,score,signals,triggered_by,reason,evaluated_at")
        .eq("org_id", orgId)
        .eq("portfolio_id", activePortfolioId);
      if (e) throw e;
      setEntries(((data ?? []) as Row[]).map(map));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, activePortfolioId]);

  useEffect(() => { void fetchOnce(); }, [fetchOnce]);

  const byLesseeId = new Map(entries.map((e) => [e.lesseeId, e]));
  return { entries, byLesseeId, loading, error, refetch: fetchOnce };
}
