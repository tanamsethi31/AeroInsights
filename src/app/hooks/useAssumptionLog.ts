// src/app/hooks/useAssumptionLog.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { hasAuthSession } from "../utils/authBackend";

export interface AssumptionLogEntry {
  id:             string;
  assumptionType: "pd_curve" | "lgd_recovery";
  segment:        string | null;
  action:         "override" | "reset";
  previousValue:  Record<string, number> | null;
  newValue:       Record<string, number> | null;
  notes:          string | null;
  changedBy:      string;
  changedAt:      string;  // ISO timestamp string
}

interface Result {
  entries:   AssumptionLogEntry[];
  isLoading: boolean;
}

export function useAssumptionLog(): Result {
  const { orgId } = useData();
  const [entries, setEntries]     = useState<AssumptionLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!orgId || !hasAuthSession()) { setIsLoading(false); return; }
      setIsLoading(true);
      const { data, error } = await supabase
        .from("assumption_change_log")
        .select("*")
        .eq("org_id", orgId)
        .order("changed_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (!error && data) {
        setEntries(
          data.map((r) => ({
            id:             r.id,
            assumptionType: r.assumption_type as "pd_curve" | "lgd_recovery",
            segment:        r.segment,
            action:         r.action as "override" | "reset",
            previousValue:  r.previous_value,
            newValue:       r.new_value,
            notes:          r.notes,
            changedBy:      r.changed_by,
            changedAt:      r.changed_at,
          }))
        );
      }
      setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [orgId]);

  return { entries, isLoading };
}
