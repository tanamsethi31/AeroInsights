// src/app/hooks/useReportSchedules.ts
// T-5.2 — CRUD for report_schedules.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";

export type ReportFrequency = "daily" | "weekly" | "monthly";
export type ReportFormat = "csv" | "pdf" | "docx" | "xlsx";

export interface ReportSchedule {
  id:           string;
  portfolioId:  string | null;
  reportId:     string;
  name:         string;
  format:       ReportFormat;
  frequency:    ReportFrequency;
  recipients:   string[];
  enabled:      boolean;
  nextRunAt:    string;
  lastRunAt:    string | null;
  lastStatus:   string | null;
  lastError:    string | null;
}

interface Row {
  id:           string;
  portfolio_id: string | null;
  report_id:    string;
  name:         string;
  format:       ReportFormat;
  frequency:    ReportFrequency;
  recipients:   string[];
  enabled:      boolean;
  next_run_at:  string;
  last_run_at:  string | null;
  last_status:  string | null;
  last_error:   string | null;
}

function map(r: Row): ReportSchedule {
  return {
    id:          r.id,
    portfolioId: r.portfolio_id,
    reportId:    r.report_id,
    name:        r.name,
    format:      r.format,
    frequency:   r.frequency,
    recipients:  r.recipients,
    enabled:     r.enabled,
    nextRunAt:   r.next_run_at,
    lastRunAt:   r.last_run_at,
    lastStatus:  r.last_status,
    lastError:   r.last_error,
  };
}

export interface CreateScheduleArgs {
  name:        string;
  reportId:    string;
  format:      ReportFormat;
  frequency:   ReportFrequency;
  recipients:  string[];
  nextRunAt?:  string;
  enabled?:    boolean;
}

export interface UseReportSchedulesResult {
  schedules: ReportSchedule[];
  loading:   boolean;
  error:     string | null;
  createSchedule: (args: CreateScheduleArgs) => Promise<ReportSchedule | null>;
  updateSchedule: (id: string, patch: Partial<CreateScheduleArgs> & { enabled?: boolean }) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  refetch:        () => Promise<void>;
}

export function useReportSchedules(): UseReportSchedulesResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId) return;
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase
        .from("report_schedules")
        .select("*")
        .eq("org_id", orgId)
        .order("next_run_at", { ascending: true });
      if (e) throw e;
      setSchedules(((data ?? []) as Row[]).map(map));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void fetchOnce(); }, [fetchOnce]);

  const createSchedule = useCallback(async (args: CreateScheduleArgs): Promise<ReportSchedule | null> => {
    if (!orgId) return null;
    // Default next_run_at = top of the next hour so the cron picks it up promptly.
    const next = args.nextRunAt ?? (() => {
      const d = new Date();
      d.setUTCMinutes(0, 0, 0);
      d.setUTCHours(d.getUTCHours() + 1);
      return d.toISOString();
    })();
    const { data, error: e } = await supabase
      .from("report_schedules")
      .insert({
        org_id:       orgId,
        portfolio_id: activePortfolioId,
        report_id:    args.reportId,
        name:         args.name,
        format:       args.format,
        frequency:    args.frequency,
        recipients:   args.recipients,
        enabled:      args.enabled ?? true,
        next_run_at:  next,
      })
      .select("*")
      .single();
    if (e) { setError(e.message); return null; }
    const inserted = map(data as Row);
    setSchedules((prev) => [...prev, inserted].sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt)));
    return inserted;
  }, [orgId, activePortfolioId]);

  const updateSchedule = useCallback(async (id: string, patch: Partial<CreateScheduleArgs> & { enabled?: boolean }): Promise<void> => {
    const up: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name        !== undefined) up.name        = patch.name;
    if (patch.reportId    !== undefined) up.report_id   = patch.reportId;
    if (patch.format      !== undefined) up.format      = patch.format;
    if (patch.frequency   !== undefined) up.frequency   = patch.frequency;
    if (patch.recipients  !== undefined) up.recipients  = patch.recipients;
    if (patch.nextRunAt   !== undefined) up.next_run_at = patch.nextRunAt;
    if (patch.enabled     !== undefined) up.enabled     = patch.enabled;
    const { error: e } = await supabase.from("report_schedules").update(up).eq("id", id);
    if (e) { setError(e.message); return; }
    await fetchOnce();
  }, [fetchOnce]);

  const deleteSchedule = useCallback(async (id: string): Promise<void> => {
    const { error: e } = await supabase.from("report_schedules").delete().eq("id", id);
    if (e) { setError(e.message); return; }
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { schedules, loading, error, createSchedule, updateSchedule, deleteSchedule, refetch: fetchOnce };
}
