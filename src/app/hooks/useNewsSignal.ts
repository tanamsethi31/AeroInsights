// src/app/hooks/useNewsSignal.ts
// Reads the per-lessee news_signals row produced by /api/cron/news-signals.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";

export interface NewsArticleEvidence {
  title:       string;
  source:      string;
  url:         string;
  publishedAt: string;
  weight:      number;
}

export interface NewsSignal {
  score:        number;
  keywordHits:  number;
  articles:     NewsArticleEvidence[];
  evaluatedAt:  string;
}

interface Row {
  score:         number;
  keyword_hits:  number;
  articles:      NewsArticleEvidence[];
  evaluated_at:  string;
}

export interface UseNewsSignalResult {
  signal:  NewsSignal | null;
  loading: boolean;
  error:   string | null;
  refetch: () => Promise<void>;
}

export function useNewsSignal(lesseeUuid: string | null | undefined): UseNewsSignalResult {
  const { orgId } = useData();
  const [signal,  setSignal]  = useState<NewsSignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId || !lesseeUuid) { setSignal(null); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase
        .from("news_signals")
        .select("score, keyword_hits, articles, evaluated_at")
        .eq("org_id", orgId)
        .eq("lessee_id", lesseeUuid)
        .maybeSingle();
      if (e) throw e;
      if (data) {
        const r = data as Row;
        setSignal({
          score:        Number(r.score),
          keywordHits:  r.keyword_hits,
          articles:     r.articles ?? [],
          evaluatedAt:  r.evaluated_at,
        });
      } else {
        setSignal(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, lesseeUuid]);

  useEffect(() => { void fetchOnce(); }, [fetchOnce]);

  return { signal, loading, error, refetch: fetchOnce };
}
