// src/app/hooks/useCostOverrides.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { hasAuthSession } from "../utils/authBackend";
import { logAudit } from "../services/auditLog";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CostOverride {
  id:        string;
  leaseId:   string;
  component: string;
  costUSD:   number;
  note:      string | null;
  createdBy: string;
  updatedAt: string;
}

export interface UseCostOverridesReturn {
  /** Keyed by component name for O(1) lookup in buildProjections(). */
  overrides:      Record<string, CostOverride>;
  loading:        boolean;
  saving:         boolean;
  /** Batched — mirrors the panel's single Save button covering every changed component at once. */
  saveOverrides:  (changes: Record<string, number>, note: string | null) => Promise<void>;
  /** Clears every cost override for this lease — paired with the panel's existing "Reset to heuristic". */
  clearOverrides: () => Promise<void>;
}

// ── Row mapper ────────────────────────────────────────────────────────────────

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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCostOverrides(leaseId: string | null): UseCostOverridesReturn {
  const { orgId } = useData();
  const [overrides, setOverrides] = useState<Record<string, CostOverride>>({});
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  // ── Load on mount / leaseId change ────────────────────────────────────────

  useEffect(() => {
    if (!orgId || !leaseId || !hasAuthSession()) { setOverrides({}); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("mr_cost_overrides")
        .select("*")
        .eq("org_id", orgId)
        .eq("lease_id", leaseId);

      if (cancelled) { setLoading(false); return; }
      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useCostOverrides] load error:", error);
        }
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as Record<string, unknown>[];
      const byComponent: Record<string, CostOverride> = {};
      for (const row of rows) {
        const mapped = mapRow(row);
        byComponent[mapped.component] = mapped;
      }
      setOverrides(byComponent);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId, leaseId]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveOverrides = useCallback(async (changes: Record<string, number>, note: string | null) => {
    if (!orgId || !leaseId || Object.keys(changes).length === 0) return;
    setSaving(true);

    const actor = (await supabase.auth.getUser()).data.user?.email ?? "unknown";
    const now = new Date().toISOString();
    const snapshot = overrides;

    // Optimistic update
    setOverrides(prev => {
      const next = { ...prev };
      for (const [component, costUSD] of Object.entries(changes)) {
        next[component] = {
          id:        prev[component]?.id ?? "temp",
          leaseId,
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
        org_id:     orgId,
        lease_id:   leaseId,
        component,
        cost_usd:   costUSD,
        note,
        created_by: actor,
        updated_at: now,
      }));

      const { data: rows, error } = await supabase
        .from("mr_cost_overrides")
        .upsert(payload, { onConflict: "org_id,lease_id,component" })
        .select();

      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useCostOverrides] saveOverrides error:", error);
        }
        setOverrides(snapshot); // rollback
        throw error;
      }

      // Reconcile local state with the real rows (real id/created_by from DB)
      const saved = (rows ?? []) as Record<string, unknown>[];
      setOverrides(prev => {
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
          entityType: "mr_cost_override",
          entityId:   `${leaseId}:${component}`,
          action:     "override",
          before:     snapshot[component] ? { costUSD: snapshot[component].costUSD } : null,
          after:      { costUSD, note },
          note:       note ?? undefined,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [orgId, leaseId, overrides]);

  const clearOverrides = useCallback(async () => {
    if (!orgId || !leaseId) return;
    setSaving(true);

    const snapshot = overrides;
    setOverrides({});

    try {
      const { error } = await supabase
        .from("mr_cost_overrides")
        .delete()
        .eq("org_id", orgId)
        .eq("lease_id", leaseId);

      if (error) {
        const _e = error as { code?: string; message?: string };
        const _msg = String(_e?.message ?? "");
        if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {
          console.error("[useCostOverrides] clearOverrides error:", error);
        }
        setOverrides(snapshot); // rollback
        throw error;
      }

      for (const component of Object.keys(snapshot)) {
        void logAudit({
          orgId,
          entityType: "mr_cost_override",
          entityId:   `${leaseId}:${component}`,
          action:     "reset",
          before:     { costUSD: snapshot[component].costUSD },
          after:      null,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [orgId, leaseId, overrides]);

  return { overrides, loading, saving, saveOverrides, clearOverrides };
}
