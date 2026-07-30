// src/app/hooks/useOrgCostBenchmarks.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { hasAuthSession } from "../utils/authBackend";
import { logAudit } from "../services/auditLog";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrgCostBenchmark {
  id:           string;
  aircraftType: string;
  component:    string;
  costUSD:      number;
  note:         string | null;
  createdBy:    string;
  updatedAt:    string;
}

export interface UseOrgCostBenchmarksReturn {
  /** Keyed by component name for O(1) lookup. */
  benchmarks:      Record<string, OrgCostBenchmark>;
  loading:         boolean;
  saving:          boolean;
  /** Batched — mirrors the panel's single Save button covering every changed component at once. */
  saveBenchmarks:  (changes: Record<string, number>, note: string | null) => Promise<void>;
  /** Clears every cost benchmark for this aircraft type. */
  clearBenchmarks: () => Promise<void>;
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): OrgCostBenchmark {
  return {
    id:           row.id as string,
    aircraftType: row.aircraft_type as string,
    component:    row.component as string,
    costUSD:      Number(row.cost_usd),
    note:         (row.note as string | null) ?? null,
    createdBy:    row.created_by as string,
    updatedAt:    row.updated_at as string,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOrgCostBenchmarks(aircraftType: string | null): UseOrgCostBenchmarksReturn {
  const { orgId } = useData();
  const [benchmarks, setBenchmarks] = useState<Record<string, OrgCostBenchmark>>({});
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);

  // ── Load on mount / aircraftType change ───────────────────────────────────

  useEffect(() => {
    if (!orgId || !aircraftType || !hasAuthSession()) { setBenchmarks({}); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("org_cost_benchmarks")
        .select("*")
        .eq("org_id", orgId)
        .eq("aircraft_type", aircraftType);

      if (cancelled) { setLoading(false); return; }
      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useOrgCostBenchmarks] load error:", error);
        }
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as Record<string, unknown>[];
      const byComponent: Record<string, OrgCostBenchmark> = {};
      for (const row of rows) {
        const mapped = mapRow(row);
        byComponent[mapped.component] = mapped;
      }
      setBenchmarks(byComponent);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId, aircraftType]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveBenchmarks = useCallback(async (changes: Record<string, number>, note: string | null) => {
    if (!orgId || !aircraftType || Object.keys(changes).length === 0) return;
    setSaving(true);

    const actor = (await supabase.auth.getUser()).data.user?.email ?? "unknown";
    const now = new Date().toISOString();
    const snapshot = benchmarks;

    // Optimistic update
    setBenchmarks(prev => {
      const next = { ...prev };
      for (const [component, costUSD] of Object.entries(changes)) {
        next[component] = {
          id:           prev[component]?.id ?? "temp",
          aircraftType,
          component,
          costUSD,
          note,
          createdBy: actor,
          updatedAt: now,
        };
      }
      return next;
    });

    try {
      const payload = Object.entries(changes).map(([component, costUSD]) => ({
        org_id:        orgId,
        aircraft_type: aircraftType,
        component,
        cost_usd:      costUSD,
        note,
        created_by:    actor,
        updated_at:    now,
      }));

      const { data: rows, error } = await supabase
        .from("org_cost_benchmarks")
        .upsert(payload, { onConflict: "org_id,aircraft_type,component" })
        .select();

      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useOrgCostBenchmarks] saveBenchmarks error:", error);
        }
        setBenchmarks(snapshot); // rollback
        throw error;
      }

      // Reconcile local state with the real rows (real id/created_by from DB)
      const saved = (rows ?? []) as Record<string, unknown>[];
      setBenchmarks(prev => {
        const next = { ...prev };
        for (const row of saved) {
          const mapped = mapRow(row);
          next[mapped.component] = mapped;
        }
        return next;
      });

      // One audit row per changed component — matches the table's own
      // one-row-per-component grain, so each component stays independently
      // traceable regardless of what else was saved alongside it.
      for (const [component, costUSD] of Object.entries(changes)) {
        void logAudit({
          orgId,
          entityType: "org_cost_benchmark",
          entityId:   `${aircraftType}:${component}`,
          action:     "override",
          before:     snapshot[component] ? { costUSD: snapshot[component].costUSD } : null,
          after:      { costUSD, note },
          note:       note ?? undefined,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [orgId, aircraftType, benchmarks]);

  const clearBenchmarks = useCallback(async () => {
    if (!orgId || !aircraftType) return;
    setSaving(true);

    const snapshot = benchmarks;
    setBenchmarks({});

    try {
      const { error } = await supabase
        .from("org_cost_benchmarks")
        .delete()
        .eq("org_id", orgId)
        .eq("aircraft_type", aircraftType);

      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useOrgCostBenchmarks] clearBenchmarks error:", error);
        }
        setBenchmarks(snapshot); // rollback
        throw error;
      }

      for (const component of Object.keys(snapshot)) {
        void logAudit({
          orgId,
          entityType: "org_cost_benchmark",
          entityId:   `${aircraftType}:${component}`,
          action:     "reset",
          before:     { costUSD: snapshot[component].costUSD },
          after:      null,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [orgId, aircraftType, benchmarks]);

  return { benchmarks, loading, saving, saveBenchmarks, clearBenchmarks };
}
