// src/app/hooks/useMaintenanceEvents.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { mapEventRow } from "../utils/maintenanceEvents";
import type { MaintenanceEvent } from "../utils/maintenanceEvents";
import { HAS_AUTH_BACKEND } from "../utils/authBackend";

export function useMaintenanceEvents(leaseId: string | null): {
  events:      MaintenanceEvent[];
  saving:      boolean;
  logEvent:    (data: Omit<MaintenanceEvent, "id">) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
} {
  const { orgId } = useData();
  const [events,  setEvents ] = useState<MaintenanceEvent[]>([]);
  const [saving,  setSaving ] = useState(false);

  useEffect(() => {
    if (!orgId || !leaseId) { setEvents([]); return; }

    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("maintenance_events")
        .select("*")
        .eq("org_id", orgId)
        .eq("lease_id", leaseId)
        .order("event_date", { ascending: true });

      if (cancelled) return;
      if (error) { console.error("[useMaintenanceEvents] load error:", error); return; }
      setEvents((data ?? []).map(r => mapEventRow(r as Record<string, unknown>)));
    };

    load();
    return () => { cancelled = true; };
  }, [orgId, leaseId]);

  const logEvent = useCallback(async (data: Omit<MaintenanceEvent, "id">) => {
    if (!orgId || !leaseId) return;
    setSaving(true);

    // Optimistic add with temp id
    const tempId = `temp-${Date.now()}`;
    setEvents(prev => [...prev, { ...data, id: tempId }]);

    try {
      const { data: row, error } = await supabase
        .from("maintenance_events")
        .insert({
          org_id:            orgId,
          lease_id:          leaseId,
          event_date:        data.eventDate,
          event_type:        data.eventType,
          notes:             data.notes,
          component_impacts: data.componentImpacts,
        })
        .select()
        .single();

      if (error) {
        {

          const _e = error as { code?: string; message?: string };

          const _msg = String(_e?.message ?? "");

          if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {

            console.error("[useMaintenanceEvents] logEvent error:", error);

          }

        }
        setEvents(prev => prev.filter(e => e.id !== tempId)); // rollback
        throw error;
      } else if (row) {
        const saved = mapEventRow(row as Record<string, unknown>);
        setEvents(prev => prev.map(e => e.id === tempId ? saved : e));
      }
    } finally {
      setSaving(false);
    }
  }, [orgId, leaseId]);

  const deleteEvent = useCallback(async (id: string) => {
    if (!orgId || !HAS_AUTH_BACKEND) return;
    setSaving(true);

    const snapshot = events;
    setEvents(prev => prev.filter(e => e.id !== id));

    try {
      const { error } = await supabase
        .from("maintenance_events")
        .delete()
        .eq("id", id)
        .eq("org_id", orgId);

      if (error) {
        {

          const _e = error as { code?: string; message?: string };

          const _msg = String(_e?.message ?? "");

          if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {

            console.error("[useMaintenanceEvents] deleteEvent error:", error);

          }

        }
        setEvents(snapshot); // rollback
        throw error;
      }
    } finally {
      setSaving(false);
    }
  }, [orgId, events]);

  return { events, saving, logEvent, deleteEvent };
}
