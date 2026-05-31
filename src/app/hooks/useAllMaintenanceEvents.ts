// src/app/hooks/useAllMaintenanceEvents.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { mapEventRow } from "../utils/maintenanceEvents";
import type { MaintenanceEvent } from "../utils/maintenanceEvents";
import { hasAuthSession } from "../utils/authBackend";

export function useAllMaintenanceEvents(): {
  eventsMap: Map<string, MaintenanceEvent[]>;
  loading:   boolean;
} {
  const { orgId } = useData();
  const [eventsMap, setEventsMap] = useState<Map<string, MaintenanceEvent[]>>(new Map());
  const [loading,   setLoading  ] = useState(false);

  useEffect(() => {
    if (!orgId || !hasAuthSession()) { setEventsMap(new Map()); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("maintenance_events")
        .select("*")
        .eq("org_id", orgId)
        .order("event_date", { ascending: true });

      if (cancelled) { setLoading(false); return; }
      if (error) {
        {

          const _e = error as { code?: string; message?: string };

          const _msg = String(_e?.message ?? "");

          if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {

            console.error("[useAllMaintenanceEvents] load error:", error);

          }

        }
        setLoading(false);
        return;
      }

      const map = new Map<string, MaintenanceEvent[]>();
      for (const row of data ?? []) {
        const evt = mapEventRow(row as Record<string, unknown>);
        const existing = map.get(evt.leaseId) ?? [];
        map.set(evt.leaseId, [...existing, evt]);
      }
      setEventsMap(map);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  return { eventsMap, loading };
}
