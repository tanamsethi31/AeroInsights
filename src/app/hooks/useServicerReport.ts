// src/app/hooks/useServicerReport.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ServicerReport {
  id: string;
  leaseId: string;
  msn: string;
  reportDate: string;                          // "YYYY-MM-DD"
  annualFH: number;
  annualCy: number;
  componentOverrides: Record<string, number>;  // component name → remaining units
}

export interface UseServicerReportReturn {
  report:      ServicerReport | null;
  loading:     boolean;
  saving:      boolean;
  saveReport:  (data: Omit<ServicerReport, "id">) => Promise<void>;
  clearReport: () => Promise<void>;
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): ServicerReport {
  return {
    id:                 row.id as string,
    leaseId:            row.lease_id as string,
    msn:                row.msn as string,
    reportDate:         row.report_date as string,
    annualFH:           Number(row.annual_fh),
    annualCy:           Number(row.annual_cy),
    componentOverrides: (row.component_overrides as Record<string, number>) ?? {},
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useServicerReport(leaseId: string | null): UseServicerReportReturn {
  const { orgId } = useData();
  const [report,  setReport]  = useState<ServicerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);

  // ── Load on mount / leaseId change ────────────────────────────────────────

  useEffect(() => {
    if (!orgId || !leaseId) { setReport(null); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("servicer_reports")
        .select("*")
        .eq("org_id", orgId)
        .eq("lease_id", leaseId)
        .maybeSingle();

      if (cancelled) { setLoading(false); return; }
      if (error) {
        console.error("[useServicerReport] load error:", error);
        setLoading(false);
        return;
      }
      setReport(data ? mapRow(data as Record<string, unknown>) : null);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId, leaseId]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveReport = useCallback(async (data: Omit<ServicerReport, "id">) => {
    if (!orgId || !leaseId) return;
    setSaving(true);

    // Optimistic update — capture snapshot via functional update
    let snapshot: ServicerReport | null = null;
    setReport(prev => { snapshot = prev; return { ...data, id: "temp" }; });

    const { data: row, error } = await supabase
      .from("servicer_reports")
      .upsert(
        {
          org_id:               orgId,
          lease_id:             leaseId,
          msn:                  data.msn,
          report_date:          data.reportDate,
          annual_fh:            data.annualFH,
          annual_cy:            data.annualCy,
          component_overrides:  data.componentOverrides,
          updated_at:           new Date().toISOString(),
        },
        { onConflict: "org_id,lease_id" },
      )
      .select()
      .single();

    if (error) {
      console.error("[useServicerReport] saveReport error:", error);
      setReport(snapshot as ServicerReport | null); // rollback
      throw error;
    } else if (row) {
      setReport(mapRow(row as Record<string, unknown>));
    }
    setSaving(false);
  }, [orgId, leaseId]);

  const clearReport = useCallback(async () => {
    if (!orgId || !leaseId) return;
    setSaving(true);

    let snapshot: ServicerReport | null = null;
    setReport(prev => { snapshot = prev; return null; });

    const { error } = await supabase
      .from("servicer_reports")
      .delete()
      .eq("org_id", orgId)
      .eq("lease_id", leaseId);

    if (error) {
      console.error("[useServicerReport] clearReport error:", error);
      setReport(snapshot as ServicerReport | null); // rollback
      throw error;
    }
    setSaving(false);
  }, [orgId, leaseId]);

  return { report, loading, saving, saveReport, clearReport };
}
