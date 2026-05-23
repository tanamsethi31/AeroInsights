// src/app/hooks/useAllServicerReports.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import type { ServicerReport } from "./useServicerReport";

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

export function useAllServicerReports(): {
  reports: Map<string, ServicerReport>;
  loading: boolean;
} {
  const { orgId } = useData();
  const [reports, setReports] = useState<Map<string, ServicerReport>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) { setReports(new Map()); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("servicer_reports")
        .select("*")
        .eq("org_id", orgId);

      if (cancelled) { setLoading(false); return; }
      if (error) {
        console.error("[useAllServicerReports] load error:", error);
        setLoading(false);
        return;
      }
      const map = new Map<string, ServicerReport>();
      for (const row of data ?? []) {
        const r = mapRow(row as Record<string, unknown>);
        map.set(r.leaseId, r);
      }
      setReports(map);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  return { reports, loading };
}
