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
import { CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  parseWorkbook,
  type ParsedWorkbook,
} from "../../utils/excelParser";
import {
  ingestWorkbook,
  previewIngest,
  type SheetIngestResult,
  type WorkbookDiff,
} from "../../services/portfolioIngest";

// Collects rows that failed parser validation across all sheets, with the
// sheet they came from. Used to drive the expandable error inspector.
function collectSheetErrors(workbook: ParsedWorkbook): Map<string, Array<{ rowIndex: number; messages: string[] }>> {
  const out = new Map<string, Array<{ rowIndex: number; messages: string[] }>>();
  function addErrors(name: string, rows: { _rowIndex?: number; _errors: string[] }[] | undefined) {
    if (!rows) return;
    const errs = rows
      .filter((r) => r._errors.length > 0)
      .map((r) => ({ rowIndex: r._rowIndex ?? 0, messages: r._errors }));
    if (errs.length > 0) out.set(name, errs);
  }
  addErrors("Lessee Profiles",         workbook.sheets.lessees);
  addErrors("Aircraft Register",       workbook.sheets.aircraft);
  addErrors("Lease Register",          workbook.sheets.leases);
  addErrors("Security Deposits",       workbook.sheets.securityDeposits);
  addErrors("Maintenance Reserves",    workbook.sheets.maintenanceReserves);
  addErrors("Stress Scenarios",        workbook.sheets.stressScenarios);
  addErrors("Restructuring Presets",   workbook.sheets.restructuringPresets);
  addErrors("Jurisdiction LGD",        workbook.sheets.jurisdictionLgd);
  // IFRS-9 + SICR are single-row scalar configs — they carry parser
  // warnings in _errors but never row-indexed errors, so they're skipped here.
  return out;
}

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

  // T-1.9 + T-1.10: per-sheet diff preview against existing rows in the
  // target portfolio. Only runs when portfolioId is set (re-import case);
  // for fresh-portfolio imports every row is implicitly "new" so we skip.
  const [diff, setDiff] = React.useState<WorkbookDiff | null>(null);
  const [diffLoading, setDiffLoading] = React.useState(false);
  const [expandedSheet, setExpandedSheet] = React.useState<string | null>(null);

  // Errors per sheet for the inspector accordion.
  const errorsBySheet = React.useMemo(
    () => (workbook ? collectSheetErrors(workbook) : new Map()),
    [workbook],
  );

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

  // Pre-flight diff once we have a parsed workbook AND a target portfolio.
  // Skipped on first-import (no portfolioId) — every row is implicitly new.
  React.useEffect(() => {
    if (!workbook || !portfolioId) { setDiff(null); return; }
    let cancelled = false;
    setDiffLoading(true);
    previewIngest(workbook, { orgId, portfolioId })
      .then((d) => { if (!cancelled) setDiff(d); })
      .catch(() => { /* preview failure non-fatal — UI shows no diff */ })
      .finally(() => { if (!cancelled) setDiffLoading(false); });
    return () => { cancelled = true; };
  }, [workbook, orgId, portfolioId]);

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
    // IFRS-9 params is a single scalar row, not a list. Adapt the shape.
    if (workbook.sheets.ifrs9Params) {
      const p = workbook.sheets.ifrs9Params;
      out.push({
        name: "IFRS 9 ECL parameters",
        rowsTotal: 1,
        rowsValid: 1,
        rowsInvalid: p._errors.length,  // soft warnings, not failures
        status: "live",
      });
    }
    if (workbook.sheets.sicrConfig) {
      const s = workbook.sheets.sicrConfig;
      out.push({
        name: "SICR Triggers",
        rowsTotal: 1,
        rowsValid: 1,
        rowsInvalid: s._errors.length,
        status: "live",
      });
    }
    summarise("Stress Scenarios",      workbook.sheets.stressScenarios,     "live");
    summarise("Restructuring Presets", workbook.sheets.restructuringPresets, "live");
    summarise("Jurisdiction LGD",      workbook.sheets.jurisdictionLgd,     "live");
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

      {/* Per-sheet table — diff columns + expandable error rows */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ background: "#F8FAFC", textAlign: "left" }}>
            <th style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0", fontWeight: 600, width: "24px" }} />
            <th style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0", fontWeight: 600 }}>Sheet</th>
            <th style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0", fontWeight: 600, textAlign: "right" }}>Rows</th>
            <th style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0", fontWeight: 600, textAlign: "right" }}>Errors</th>
            <th style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0", fontWeight: 600, textAlign: "right" }}>New</th>
            <th style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0", fontWeight: 600, textAlign: "right" }}>Update</th>
            <th style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0", fontWeight: 600 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {previews.map((p) => {
            const sheetErrors = errorsBySheet.get(p.name);
            const canExpand = (sheetErrors?.length ?? 0) > 0;
            const isOpen = expandedSheet === p.name;
            const sheetDiff = diff?.perSheet.find((d) => d.sheet === p.name);
            const action =
              p.status === "live" ? `${p.rowsValid} rows` :
              p.status === "ready" ? "Parsed (writer pending)" :
              "Skipped";
            const actionColor =
              p.status === "live" ? "#15803D" :
              p.status === "ready" ? "#B45309" : "#94A3B8";
            return (
              <React.Fragment key={p.name}>
                <tr
                  onClick={() => canExpand && setExpandedSheet(isOpen ? null : p.name)}
                  style={{ cursor: canExpand ? "pointer" : "default" }}
                >
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9", color: "#94A3B8" }}>
                    {canExpand && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9" }}>{p.name}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    {p.rowsTotal}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9", color: p.rowsInvalid ? "#B91C1C" : "#94A3B8", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    {p.rowsInvalid}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9", color: "#15803D", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    {diffLoading ? "…" : sheetDiff ? sheetDiff.newRows : portfolioId ? "—" : p.rowsValid}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9", color: "#B45309", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    {diffLoading ? "…" : sheetDiff ? sheetDiff.updateRows : portfolioId ? "—" : 0}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9", color: actionColor }}>
                    {action}
                  </td>
                </tr>
                {isOpen && sheetErrors && (
                  <tr>
                    <td colSpan={7} style={{ background: "#FEF2F2", padding: "10px 14px", borderBottom: "1px solid #FECACA" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.75rem", color: "#B91C1C", marginBottom: "6px" }}>
                        {sheetErrors.length} invalid row{sheetErrors.length === 1 ? "" : "s"} — will be skipped on commit
                      </div>
                      <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {sheetErrors.slice(0, 50).map((er, idx) => (
                          <div key={idx} style={{ fontSize: "0.75rem", color: "#7F1D1D", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                            <span style={{ fontWeight: 600 }}>Row {er.rowIndex}:</span>{" "}
                            {er.messages.join("; ")}
                          </div>
                        ))}
                        {sheetErrors.length > 50 && (
                          <div style={{ fontSize: "0.7rem", color: "#94A3B8", paddingTop: "4px" }}>
                            … +{sheetErrors.length - 50} more (fix in Excel and re-upload)
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {previews.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: "16px", textAlign: "center", color: "#94A3B8" }}>
                No recognised sheets found. The workbook may use different sheet names than expected.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Diff summary line — only when diff ran (re-import case) */}
      {diff && !diffLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "0.75rem", color: "#475569", paddingTop: "2px" }}>
          <span><strong style={{ color: "#15803D" }}>{diff.totalNew}</strong> new rows</span>
          <span><strong style={{ color: "#B45309" }}>{diff.totalUpdate}</strong> updates (will overwrite existing)</span>
          {diff.totalInvalid > 0 && (
            <span><strong style={{ color: "#B91C1C" }}>{diff.totalInvalid}</strong> invalid (skip)</span>
          )}
        </div>
      )}
      {!diff && !portfolioId && (
        <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
          Fresh import — new portfolio will be created on commit; every valid row is inserted as new.
        </div>
      )}

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
