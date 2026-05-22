// src/app/hooks/useCashFlow.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolioData } from "./usePortfolioData";
import { buildLiveSDMRData, sdmrData as staticSdmrData } from "../components/portfolio/SDMRTab";
import { DEMO_LEASES } from "../data/demoCashFlowLeases";
import { forecastCashFlows, mergeForecastEvents } from "../utils/cashFlowForecast";
import type { CashEvent, CashEventType, CashEventSource, NewCashEvent } from "../utils/cashFlowForecast";

// ── Return type ───────────────────────────────────────────────────────────────

export interface UseCashFlowReturn {
  events:      CashEvent[];
  actuals:     CashEvent[];
  forecast:    CashEvent[];
  loading:     boolean;
  saving:      boolean;
  addEvent:    (event: NewCashEvent) => Promise<void>;
  editEvent:   (id: string, patch: Partial<NewCashEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): CashEvent {
  return {
    id:            row.id            as string,
    orgId:         row.org_id        as string,
    leaseId:       (row.lease_id     as string | null) ?? null,
    eventType:     row.event_type    as CashEventType,
    amount:        Number(row.amount),
    currency:      row.currency      as string,
    eventDate:     row.event_date    as string,
    isForecast:    row.is_forecast === true,
    source:        row.source        as CashEventSource,
    transactionId: (row.transaction_id as string | null) ?? null,
    notes:         (row.notes        as string | null) ?? null,
    createdAt:     (row.created_at as string | null) ?? new Date().toISOString(),
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCashFlow(): UseCashFlowReturn {
  const { orgId }                               = useData();
  const { assets, lessees, leases, provisions } = usePortfolioData();
  const [persisted, setPersisted]               = useState<CashEvent[]>([]);
  const [loading,   setLoading  ]               = useState(true);
  const [saving,    setSaving   ]               = useState(false);

  // Build SDMR records for forecast engine — same call as Portfolio.tsx
  const sdmrData = useMemo(
    () => buildLiveSDMRData(assets as never, lessees as never, leases as never, provisions as never),
    [assets, lessees, leases, provisions],
  );

  // Rule-based forecast (client-side, never persisted).
  // In demo mode (no orgId) fall back to the static SDMR demo portfolio so
  // the chart shows real platform analytics instead of hard-coded sample events.
  const ruleEvents = useMemo(
    () => forecastCashFlows(
      orgId ? leases         : DEMO_LEASES,
      orgId ? sdmrData       : staticSdmrData,
      24,
    ),
    [orgId, leases, sdmrData],
  );

  // Split persisted into actuals and manual forecast overrides
  const actuals          = useMemo(() => persisted.filter(e => !e.isForecast), [persisted]);
  const persistedForecast = useMemo(() => persisted.filter(e =>  e.isForecast), [persisted]);

  // Merge rule events with manual overrides
  const forecast = useMemo(
    () => mergeForecastEvents(ruleEvents, persistedForecast),
    [ruleEvents, persistedForecast],
  );

  // All events sorted by date
  const events = useMemo(
    () => [...actuals, ...forecast].sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    [actuals, forecast],
  );

  // ── Load on mount / orgId change ──────────────────────────────────────────

  useEffect(() => {
    if (!orgId) { setPersisted([]); setLoading(false); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("cash_events")
        .select("*")
        .eq("org_id", orgId)
        .order("event_date", { ascending: true });

      if (cancelled) { setLoading(false); return; }
      if (error) {
        console.error("[useCashFlow] load error:", error);
        setLoading(false);
        return;
      }
      setPersisted((data ?? []).map(row => mapRow(row as Record<string, unknown>)));
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addEvent = useCallback(async (event: NewCashEvent) => {
    if (!orgId) return;
    setSaving(true);

    // Optimistic insert with temp id
    const tempId = `temp-${Date.now()}`;
    const optimistic: CashEvent = {
      id:            tempId,
      orgId,
      leaseId:       event.leaseId,
      eventType:     event.eventType,
      amount:        event.amount,
      currency:      event.currency,
      eventDate:     event.eventDate,
      isForecast:    event.isForecast,
      source:        "manual",
      transactionId: null,
      notes:         event.notes,
      createdAt:     new Date().toISOString(),
    };
    setPersisted(prev =>
      [...prev, optimistic].sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    );

    const { data, error } = await supabase
      .from("cash_events")
      .insert({
        org_id:      orgId,
        lease_id:    event.leaseId,
        event_type:  event.eventType,
        amount:      event.amount,
        currency:    event.currency,
        event_date:  event.eventDate,
        is_forecast: event.isForecast,
        source:      "manual",
        notes:       event.notes,
      })
      .select()
      .single();

    if (error) {
      console.error("[useCashFlow] addEvent error:", error);
      setPersisted(prev => prev.filter(e => e.id !== tempId)); // rollback
    } else if (data) {
      setPersisted(prev =>
        prev.map(e => e.id === tempId ? mapRow(data as Record<string, unknown>) : e)
      );
    } else {
      // Supabase returned no error but also no data (RLS suppressed the read)
      setPersisted(prev => prev.filter(e => e.id !== tempId)); // rollback orphan
    }
    setSaving(false);
  }, [orgId]);

  const editEvent = useCallback(async (id: string, patch: Partial<NewCashEvent>) => {
    if (!orgId) return;
    setSaving(true);

    // Snapshot for rollback
    let snapshot: CashEvent | undefined;
    setPersisted(prev => {
      snapshot = prev.find(e => e.id === id);
      return prev.map(e => {
        if (e.id !== id) return e;
        return {
          ...e,
          ...(patch.leaseId    !== undefined && { leaseId:    patch.leaseId    }),
          ...(patch.eventType  !== undefined && { eventType:  patch.eventType  }),
          ...(patch.amount     !== undefined && { amount:     patch.amount     }),
          ...(patch.currency   !== undefined && { currency:   patch.currency   }),
          ...(patch.eventDate  !== undefined && { eventDate:  patch.eventDate  }),
          ...(patch.isForecast !== undefined && { isForecast: patch.isForecast }),
          ...(patch.notes      !== undefined && { notes:      patch.notes      }),
        };
      });
    });

    const dbPatch: Record<string, unknown> = {};
    if (patch.leaseId    !== undefined) dbPatch.lease_id    = patch.leaseId;
    if (patch.eventType  !== undefined) dbPatch.event_type  = patch.eventType;
    if (patch.amount     !== undefined) dbPatch.amount      = patch.amount;
    if (patch.currency   !== undefined) dbPatch.currency    = patch.currency;
    if (patch.eventDate  !== undefined) dbPatch.event_date  = patch.eventDate;
    if (patch.isForecast !== undefined) dbPatch.is_forecast = patch.isForecast;
    if (patch.notes      !== undefined) dbPatch.notes       = patch.notes;

    const { error } = await supabase
      .from("cash_events")
      .update(dbPatch)
      .eq("id", id);

    if (error) {
      console.error("[useCashFlow] editEvent error:", error);
      if (snapshot) setPersisted(prev => prev.map(e => e.id === id ? snapshot! : e)); // rollback
    }
    setSaving(false);
  }, [orgId]);

  const deleteEvent = useCallback(async (id: string) => {
    setSaving(true);

    // Snapshot for rollback
    let deleted: CashEvent | undefined;
    setPersisted(prev => {
      deleted = prev.find(e => e.id === id);
      return prev.filter(e => e.id !== id);
    });

    const { error } = await supabase
      .from("cash_events")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[useCashFlow] deleteEvent error:", error);
      if (deleted) setPersisted(prev => [...prev, deleted!].sort((a, b) => a.eventDate.localeCompare(b.eventDate))); // rollback
    }
    setSaving(false);
  }, []);

  return { events, actuals, forecast, loading, saving, addEvent, editEvent, deleteEvent };
}
