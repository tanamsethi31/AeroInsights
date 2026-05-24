// src/app/components/upload/MultiSheetReviewStep.tsx
//
// Replaces the column-mapping + flat-review steps when the dropped file is a
// canonical AeroInsights workbook (T-1.1 detection). Parses every recognised
// sheet, shows per-sheet row counts + errors, and on Import:
//   1. Resolves portfolio (uses existing or creates a new one named after the
//      file — same convention as ReviewImportStep).
//   2. Creates an `uploads` row scoped to the portfolio.
//   3. Calls ingestWorkbook() which routes each sheet to its ingester.
//   4. Reports per-sheet results to the user and fires onComplete.
//
// Currently the only live ingester is Lessee Profiles (T-1.2); the other
// sheets are parsed but ignored at write time. Subsequent Phase 1 slices
// add their ingesters without changing this component.

import * as React from "react";
import { CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  parseWorkbook,
  type ParsedWorkbook,
} from "../../utils/excelParser";
import {
  ingestWorkbook,
  type SheetIngestResult,
} from "../../services/portfolioIngest";

interface MultiSheetReviewStepProps {
  orgId: string;
  portfolioId?: string;
  file: File;
  filename: string;
  onComplete: (uploadId: string, importedCount: number, portfolioId: string) => void;
  onError: (message: string) => void;
}

interface SheetPreview {
  name: string;
  rowsTotal: number;
  rowsValid: number;
  rowsInvalid: number;
  status: "ready" | "live" | "stub";
}

export function MultiSheetReviewStep({
  orgId,
  portfolioId,
  file,
  filename,
  onComplete,
  onError,
}: MultiSheetReviewStepProps) {
  const [parsing, setParsing] = React.useState(true);
  const [workbook, setWorkbook] = React.useState<ParsedWorkbook | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResults, setImportResults] = React.useState<SheetIngestResult[] | null>(null);

  // Parse on mount.
  React.useEffect(() => {
    let cancelled = false;
    setParsing(true);
    parseWorkbook(file)
      .then((wb) => { if (!cancelled) { setWorkbook(wb); setParsing(false); } })
      .catch((err) => {
        if (!cancelled) {
          onError(`Could not parse workbook: ${(err as Error).message}`);
          setParsing(false);
        }
      });
    return () => { cancelled = true; };
  }, [file, onError]);

  const previews: SheetPreview[] = React.useMemo(() => {
    if (!workbook) return [];
    const out: SheetPreview[] = [];
    // Helper to summarise a sheet's parsed rows.
    function summarise(name: string, rows: { _errors: string[] }[] | undefined, status: SheetPreview["status"]) {
      if (!rows) return;
      const invalid = rows.filter((r) => r._errors.length > 0).length;
      out.push({
        name,
        rowsTotal: rows.length,
        rowsValid: rows.length - invalid,
        rowsInvalid: invalid,
        status,
      });
    }
    summarise("Lessee Profiles",       workbook.sheets.lessees,             "live");
    summarise("Aircraft Register",     workbook.sheets.aircraft,            "live");
    summarise("Lease Register",        workbook.sheets.leases,              "live");
    summarise("Security Deposits",     workbook.sheets.securityDeposits,    "live");
    summarise("Maintenance Reserves",  workbook.sheets.maintenanceReserves, "live");
    // T-1.5–T-1.8 sheets land in subsequent Phase 1 slices.
    return out;
  }, [workbook]);

  async function handleImport() {
    if (!workbook) return;
    setIsImporting(true);
    try {
      // 1. Resolve portfolio (same convention as ReviewImportStep).
      let effectivePortfolioId: string;
      if (portfolioId) {
        effectivePortfolioId = portfolioId;
      } else {
        const baseName = filename.replace(/\.[^.]+$/, "").trim() || "Imported portfolio";
        const slug = `import-${Date.now().toString(36)}`;
        const { data: newPortfolio, error: pErr } = await supabase
          .from("portfolios")
          .insert({ org_id: orgId, name: baseName, kind: "live", slug })
          .select("id")
          .single();
        if (pErr || !newPortfolio) throw new Error(pErr?.message ?? "Failed to create portfolio");
        effectivePortfolioId = newPortfolio.id;
      }

      // 2. Create upload record.
      const { data: upload, error: uErr } = await supabase
        .from("uploads")
        .insert({
          org_id:       orgId,
          portfolio_id: effectivePortfolioId,
          filename,
          status:       "processing",
          row_count:    previews.reduce((a, b) => a + b.rowsTotal, 0),
        })
        .select("id")
        .single();
      if (uErr || !upload) throw new Error(uErr?.message ?? "Failed to create upload record");
      const uploadId = upload.id;

      // 3. Ingest per sheet.
      const { sheetResults, totalInserted } = await ingestWorkbook(workbook, {
        orgId,
        portfolioId: effectivePortfolioId,
        uploadId,
      });
      setImportResults(sheetResults);

      // 4. Mark upload complete (errors are non-fatal — partial imports are OK).
      await supabase.from("uploads").update({ status: "complete" }).eq("id", uploadId);

      onComplete(uploadId, totalInserted, effectivePortfolioId);
    } catch (err) {
      onError((err as Error).message);
      setIsImporting(false);
    }
  }

  if (parsing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#64748B", padding: "20px 0" }}>
        <Loader2 size={16} className="animate-spin" />
        Parsing workbook…
      </div>
    );
  }

  if (!workbook) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Recognised sheets summary */}
      <div
        style={{
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: "8px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <FileSpreadsheet size={20} style={{ color: "#15803D", flexShrink: 0, marginTop: "2px" }} />
        <div style={{ flex: 1, fontSize: "0.8125rem", color: "#0F172A" }}>
          <div style={{ fontWeight: 600, marginBottom: "2px" }}>
            AeroInsights workbook detected — {workbook.recognisedSheets.length} of 8 canonical sheets present.
          </div>
          <div style={{ color: "#475569" }}>
            Column mapping is automatic. Review per-sheet counts below.
          </div>
        </div>
      </div>

      {/* Per-sheet table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ background: "#F8FAFC", textAlign: "left" }}>
            <th style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0", fontWeight: 600 }}>Sheet</th>
            <th style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0", fontWeight: 600 }}>Rows</th>
            <th style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0", fontWeight: 600 }}>Errors</th>
            <th style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0", fontWeight: 600 }}>Will import?</th>
          </tr>
        </thead>
        <tbody>
          {previews.map((p) => {
            const willImport =
              p.status === "live" ? `${p.rowsValid} rows` :
              p.status === "ready" ? "Parsed (writer pending)" :
              "Skipped";
            const color =
              p.status === "live" ? "#15803D" :
              p.status === "ready" ? "#B45309" : "#94A3B8";
            return (
              <tr key={p.name}>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9" }}>{p.name}</td>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9", fontVariantNumeric: "tabular-nums" }}>
                  {p.rowsTotal}
                </td>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9", color: p.rowsInvalid ? "#B91C1C" : "#94A3B8", fontVariantNumeric: "tabular-nums" }}>
                  {p.rowsInvalid}
                </td>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9", color }}>
                  {willImport}
                </td>
              </tr>
            );
          })}
          {previews.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "16px", textAlign: "center", color: "#94A3B8" }}>
                No recognised sheets found. The workbook may use different sheet names than expected.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Unknown sheets (skipped) */}
      {workbook.unknownSheets.length > 0 && (
        <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
          Skipped sheets (not canonical):{" "}
          {workbook.unknownSheets.join(", ")}
        </div>
      )}

      {/* Import results */}
      {importResults && (
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A" }}>Import results</div>
          {importResults.map((r) => (
            <div key={r.sheet} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8125rem" }}>
              {r.errors.length === 0 ? (
                <CheckCircle2 size={14} style={{ color: "#15803D", flexShrink: 0 }} />
              ) : (
                <AlertCircle size={14} style={{ color: "#B91C1C", flexShrink: 0 }} />
              )}
              <span>
                <strong>{r.sheet}</strong>: {r.inserted} inserted
                {r.skipped > 0 && `, ${r.skipped} skipped`}
                {r.errors.length > 0 && `, ${r.errors.length} errors`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={isImporting || previews.every((p) => p.status !== "live")}
        style={{
          padding: "10px 18px",
          background: isImporting ? "#94A3B8" : "#002147",
          color: "#FFFFFF",
          border: "none",
          borderRadius: "6px",
          fontWeight: 600,
          fontSize: "0.875rem",
          cursor: isImporting ? "not-allowed" : "pointer",
          alignSelf: "flex-start",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {isImporting && <Loader2 size={14} className="animate-spin" />}
        {isImporting ? "Importing…" : "Import to Supabase"}
      </button>
    </div>
  );
}
