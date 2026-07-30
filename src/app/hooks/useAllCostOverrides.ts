// src/app/hooks/useAllCostOverrides.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import type { CostOverride } from "./useCostOverrides";
import { hasAuthSession } from "../utils/authBackend";

function mapRow(row: Record<string, unknown>): CostOverride {
  return {
    id:        row.id as string,
    leaseId:   row.lease_id as string,
    component: row.component as string,
    costUSD:   Number(row.cost_usd),
    note:      (row.note as string | null) ?? null,
    createdBy: row.created_by as string,
    updatedAt: row.updated_at as string,
  };
}

export function useAllCostOverrides(): {
  overridesByLeaseId: Map<string, Record<string, CostOverride>>;
  loading: boolean;
} {
  const { orgId } = useData();
  const [overridesByLeaseId, setOverridesByLeaseId] = useState<Map<string, Record<string, CostOverride>>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId || !hasAuthSession()) { setOverridesByLeaseId(new Map()); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("mr_cost_overrides")
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
        if (!isRls) console.error("[useAllCostOverrides] load error:", error);
        setLoading(false);
        return;
      }
      const map = new Map<string, Record<string, CostOverride>>();
      for (const row of data ?? []) {
        const mapped = mapRow(row as Record<string, unknown>);
        const byComponent = map.get(mapped.leaseId) ?? {};
        byComponent[mapped.component] = mapped;
        map.set(mapped.leaseId, byComponent);
      }
      setOverridesByLeaseId(map);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  return { overridesByLeaseId, loading };
}
