// src/app/hooks/usePortfolioData.ts
import { useState, useEffect, useCallback } from "react";
import { useData } from "../contexts/DataContext";
import { supabase } from "../lib/supabase";
import { MOCK_ASSETS, MOCK_LESSEES, MOCK_LEASES, MOCK_PROVISIONS } from "../data/mockPortfolioData";
import type { Asset, Lessee, Lease, Provision, PortfolioData } from "../types/portfolio";

export function usePortfolioData(): PortfolioData {
  const { orgId, hasUpload } = useData();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [lessees, setLessees] = useState<Lessee[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAll = useCallback(async (signal?: AbortSignal) => {
    if (!hasUpload || !orgId) {
      setAssets([]);
      setLessees([]);
      setLeases([]);
      setProvisions([]);
      return;
    }
    setIsLoading(true);
    try {
      const withAbort = <T extends { abortSignal: (s: AbortSignal) => T }>(q: T): T =>
        signal ? q.abortSignal(signal) : q;
      const [a, l, ls, p] = await Promise.all([
        withAbort(supabase.from("assets").select("*").eq("org_id", orgId)),
        withAbort(supabase.from("lessees").select("*").eq("org_id", orgId)),
        withAbort(supabase.from("leases").select("*").eq("org_id", orgId)),
        withAbort(supabase.from("provisions").select("*").eq("org_id", orgId)),
      ]);
      // After awaiting Promise.all, the parent useEffect may have re-fired
      // with new deps (e.g. user navigated mid-fetch) and aborted us. Skip
      // setState to avoid the "setState on unmounted component" leak path.
      if (signal?.aborted) return;
      setAssets((a.data as Asset[]) ?? []);
      setLessees((l.data as Lessee[]) ?? []);
      setLeases((ls.data as Lease[]) ?? []);
      setProvisions((p.data as Provision[]) ?? []);
    } catch (err) {
      // Abort is the expected path on tab switches mid-flight, not an error.
      if ((err as { name?: string })?.name === "AbortError") return;
      {
        const _e = err as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[usePortfolioData] fetch error:", err);
        }
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [orgId, hasUpload]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchAll(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchAll]);

  if (!hasUpload) {
    return {
      assets: MOCK_ASSETS,
      lessees: MOCK_LESSEES,
      leases: MOCK_LEASES,
      provisions: MOCK_PROVISIONS,
      isLoading: false,
      isDemo: true,
      refetch: async () => {},
    };
  }

  return { assets, lessees, leases, provisions, isLoading, isDemo: false, refetch: fetchAll };
}
