// src/app/hooks/useReportExports.ts
//
// T-3.3 — Reads + writes report_exports.
//
// recordExport() uploads the generated file Blob to the `reports` Storage
// bucket, inserts a row in report_exports, and writes an "export" event to
// audit_log. The local download is the caller's job — this hook is purely
// the persistence side-channel.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";
import { logAudit } from "../services/auditLog";

export type ReportFormat = "pdf" | "docx" | "xlsx";

export interface ReportExport {
  id:            string;
  portfolioId:   string | null;
  reportId:      string;
  reportName:    string;
  format:        ReportFormat;
  params:        Record<string, unknown>;
  storagePath:   string | null;
  fileSizeBytes: number | null;
  generatedAt:   string;
  generatedBy:   string;
}

interface ReportExportRow {
  id:               string;
  org_id:           string;
  portfolio_id:     string | null;
  report_id:        string;
  report_name:      string;
  format:           ReportFormat;
  params:           Record<string, unknown>;
  storage_path:     string | null;
  file_size_bytes:  number | null;
  generated_at:     string;
  generated_by:     string;
}

function mapRow(r: ReportExportRow): ReportExport {
  return {
    id:            r.id,
    portfolioId:   r.portfolio_id,
    reportId:      r.report_id,
    reportName:    r.report_name,
    format:        r.format,
    params:        r.params,
    storagePath:   r.storage_path,
    fileSizeBytes: r.file_size_bytes,
    generatedAt:   r.generated_at,
    generatedBy:   r.generated_by,
  };
}

export interface RecordExportArgs {
  reportId:   string;
  reportName: string;
  format:     ReportFormat;
  blob:       Blob;
  filename:   string;
  params?:    Record<string, unknown>;
}

export interface UseReportExportsResult {
  exports: ReportExport[];
  loading: boolean;
  error:   string | null;
  /** Upload file + insert row + log audit event. Returns the inserted row id on success. */
  recordExport: (args: RecordExportArgs) => Promise<string | null>;
  /** Sign a temporary download URL for a stored object. */
  getDownloadUrl: (storagePath: string) => Promise<string | null>;
  refetch: () => Promise<void>;
}

const SIGNED_URL_TTL_SECONDS = 600; // 10 min — long enough to click + open

export function useReportExports(): UseReportExportsResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();

  const [exports, setExports] = useState<ReportExport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId) { setExports([]); return; }
    setLoading(true); setError(null);
    try {
      let q = supabase
        .from("report_exports")
        .select("*")
        .eq("org_id", orgId)
        .order("generated_at", { ascending: false })
        .limit(100);
      if (activePortfolioId) {
        q = q.or(`portfolio_id.is.null,portfolio_id.eq.${activePortfolioId}`);
      }
      const { data, error: e } = await q;
      if (e) throw e;
      setExports((data ?? []).map((r) => mapRow(r as ReportExportRow)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, activePortfolioId]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  const recordExport = useCallback(
    async (args: RecordExportArgs): Promise<string | null> => {
      if (!orgId) {
        console.warn("[recordExport] no orgId; skipping persistence");
        return null;
      }
      // Build a storage path that scopes by org + portfolio + date so the
      // bucket structure is browseable and never collides.
      const date = new Date();
      const ymd  = date.toISOString().slice(0, 10);
      const portfolioSegment = activePortfolioId ?? "org-wide";
      const storagePath = `${orgId}/${portfolioSegment}/${ymd}/${date.getTime()}-${args.filename}`;

      // 1. Upload. Failures are non-fatal — we still record the row with
      //    storage_path=null so the audit trail captures the attempt.
      let uploadedPath: string | null = null;
      try {
        const { error: upErr } = await supabase.storage
          .from("reports")
          .upload(storagePath, args.blob, {
            contentType: args.blob.type || undefined,
            upsert: false,
          });
        if (upErr) {
          console.warn("[recordExport] storage upload failed:", upErr.message);
        } else {
          uploadedPath = storagePath;
        }
      } catch (err) {
        console.warn("[recordExport] storage upload threw:", err);
      }

      // 2. Insert row.
      const user = (await supabase.auth.getUser()).data.user;
      const generatedBy = user?.email ?? "unknown";
      const { data, error: insErr } = await supabase
        .from("report_exports")
        .insert({
          org_id:           orgId,
          portfolio_id:     activePortfolioId ?? null,
          report_id:        args.reportId,
          report_name:      args.reportName,
          format:           args.format,
          params:           args.params ?? {},
          storage_path:     uploadedPath,
          file_size_bytes:  args.blob.size,
          generated_by:     generatedBy,
        })
        .select("*")
        .single();
      if (insErr) {
        console.warn("[recordExport] insert failed:", insErr.message);
        return null;
      }
      const inserted = data as ReportExportRow;

      // 3. Optimistic local update + audit event.
      setExports((prev) => [mapRow(inserted), ...prev]);
      void logAudit({
        orgId,
        portfolioId: activePortfolioId,
        entityType:  "report_export",
        entityId:    inserted.id,
        action:      "export",
        after: {
          reportId:   args.reportId,
          reportName: args.reportName,
          format:     args.format,
          filename:   args.filename,
          fileSize:   args.blob.size,
          uploaded:   uploadedPath !== null,
        },
      });
      return inserted.id;
    },
    [orgId, activePortfolioId],
  );

  const getDownloadUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    const { data, error: e } = await supabase.storage
      .from("reports")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (e) {
      console.warn("[getDownloadUrl] failed:", e.message);
      return null;
    }
    return data?.signedUrl ?? null;
  }, []);

  return { exports, loading, error, recordExport, getDownloadUrl, refetch: fetchOnce };
}
