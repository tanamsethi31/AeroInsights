// src/app/hooks/useAllOrgCostBenchmarks.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { mapRow, type OrgCostBenchmark } from "./useOrgCostBenchmarks";
import { hasAuthSession } from "../utils/authBackend";

export function useAllOrgCostBenchmarks(): {
  benchmarksByAircraftType: Map<string, Record<string, OrgCostBenchmark>>;
  loading: boolean;
} {
  const { orgId } = useData();
  const [benchmarksByAircraftType, setBenchmarksByAircraftType] = useState<Map<string, Record<string, OrgCostBenchmark>>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId || !hasAuthSession()) { setBenchmarksByAircraftType(new Map()); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("org_cost_benchmarks")
        .select("*")
        .eq("org_id", orgId);

      if (cancelled) { setLoading(false); return; }
      if (error) {
        // 42501 / "permission denied" is the expected RLS response when the
        // Supabase session is anon (no org_id claim) — falls back to empty
        // map silently. Real errors still log.
        const code = (error as { code?: string }).code;
        const msg  = String((error as { message?: string }).message ?? "");
        const isRls = code === "42501" || /permission denied/i.test(msg);
        if (!isRls) console.error("[useAllOrgCostBenchmarks] load error:", error);
        setLoading(false);
        return;
      }
      const map = new Map<string, Record<string, OrgCostBenchmark>>();
      for (const row of data ?? []) {
        const mapped = mapRow(row as Record<string, unknown>);
        const byComponent = map.get(mapped.aircraftType) ?? {};
        byComponent[mapped.component] = mapped;
        map.set(mapped.aircraftType, byComponent);
      }
      setBenchmarksByAircraftType(map);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  return { benchmarksByAircraftType, loading };
}
