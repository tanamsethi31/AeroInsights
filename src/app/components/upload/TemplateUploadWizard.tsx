// src/app/components/upload/TemplateUploadWizard.tsx
//
// Template-driven upload flow. Distinct from the flexible UploadWizard:
// this surface shows the canonical column reference and a downloadable
// template, then accepts a filled spreadsheet and routes directly to the
// review step (column mapping is skipped — the template already uses
// canonical headers, so suggestMapping() will return a complete mapping).
//
// If the user uploads a multi-sheet canonical workbook, we still route
// through MultiSheetReviewStep for that path.

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, Download, X, CheckCircle2, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
import { OUR_FIELDS } from "../../lib/columnMapper";
import { suggestMapping } from "../../lib/columnMapper";
import { detectCanonical } from "../../utils/excelParser";
import { ReviewImportStep } from "./ReviewImportStep";
import { MultiSheetReviewStep } from "./MultiSheetReviewStep";

interface TemplateUploadWizardProps {
  orgId: string;
  portfolioId?: string;
  onClose: () => void;
  onComplete: (uploadId: string, importedCount: number, portfolioId: string) => void;
}

type Step = "intro" | "review";

// ─── Template generation ─────────────────────────────────────────────────────

function downloadTemplate() {
  const headers = OUR_FIELDS.map(f => f.id);
  const exampleRow = OUR_FIELDS.reduce<Record<string, string>>((acc, f) => {
    acc[f.id] = f.example;
    return acc;
  }, {});
  const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Portfolio");
  XLSX.writeFile(wb, "aeroinsights-portfolio-template.xlsx");
}

// ─── File parsing ─────────────────────────────────────────────────────────────

function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { raw: false });
        if (raw.length === 0) { reject(new Error("File is empty.")); return; }
        const headers = Object.keys(raw[0]);
        resolve({ headers, rows: raw });
      } catch {
        reject(new Error("Could not parse file. Please use .csv, .xlsx, or .xls."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read file. Please try again."));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TemplateUploadWizard({ orgId, portfolioId, onClose, onComplete }: TemplateUploadWizardProps) {
  const [step, setStep] = React.useState<Step>("intro");
  const [showOptional, setShowOptional] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isParsing, setIsParsing] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);

  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [filename, setFilename] = React.useState("");
  const [mapping, setMapping] = React.useState<Record<string, string | null>>({});
  const [canonicalFile, setCanonicalFile] = React.useState<File | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);

  const requiredFields = OUR_FIELDS.filter(f => f.required);
  const optionalFields = OUR_FIELDS.filter(f => !f.required);

  async function handleFile(file: File) {
    const allowed = [".csv", ".xlsx", ".xls"];
    const dotIndex = file.name.lastIndexOf(".");
    const ext = dotIndex === -1 ? "" : file.name.slice(dotIndex).toLowerCase();
    if (!allowed.includes(ext)) {
      setError("Please upload a .csv, .xlsx, or .xls file.");
      return;
    }
    setIsParsing(true);
    setError(null);
    try {
      // Detect canonical multi-sheet workbook first; if so, route to that path.
      if (ext === ".xlsx" || ext === ".xls") {
        try {
          const probe = await detectCanonical(file);
          if (probe.canonical) {
            setCanonicalFile(file);
            setFilename(file.name);
            setStep("review");
            return;
          }
        } catch {
          // Fall through to flat parse on probe failure.
        }
      }
      const { headers: h, rows: r } = await parseFile(file);
      setHeaders(h);
      setRows(r);
      setFilename(file.name);
      setMapping(suggestMapping(h));
      setCanonicalFile(null);
      setStep("review");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsParsing(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        style={{
          background: "#FFFFFF", borderRadius: "12px", width: "720px",
          maxHeight: "92vh", overflow: "hidden", display: "flex",
          flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", background: "#002147", display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#FFFFFF" }}>Upload Your Portfolio</div>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "2px" }}>
              {step === "intro" ? "Download template, fill it in, upload" : "Review & Import"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.70)", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "24px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {step === "intro" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* Template download banner */}
                  <div
                    style={{
                      background: "#F0F9FF",
                      border: "1px solid #BAE6FD",
                      borderRadius: "8px",
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <FileSpreadsheet size={20} style={{ color: "#0284C7", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A" }}>
                        Step 1 — Download the template
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                        Fill in your portfolio data using the columns below. Column mapping is skipped.
                      </div>
                    </div>
                    <button
                      onClick={downloadTemplate}
                      style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "7px 14px", background: "#0284C7", color: "#FFFFFF",
                        border: "none", borderRadius: "6px",
                        fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", flexShrink: 0,
                      }}
                    >
                      <Download size={14} />
                      Template
                    </button>
                  </div>

                  {/* Required columns reference */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0F172A" }}>
                        Required columns
                      </div>
                      <span style={{
                        fontSize: "0.6875rem", fontWeight: 600,
                        background: "#FEF3C7", color: "#B45309",
                        padding: "2px 8px", borderRadius: "9999px",
                      }}>
                        {requiredFields.length} required
                      </span>
                    </div>
                    <div style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                        <thead>
                          <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>Column</th>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>Description</th>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>Example</th>
                          </tr>
                        </thead>
                        <tbody>
                          {requiredFields.map((f, i) => (
                            <tr key={f.id} style={{ borderBottom: i < requiredFields.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                              <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: "0.75rem", color: "#0F172A", fontWeight: 600 }}>
                                {f.id}
                              </td>
                              <td style={{ padding: "8px 12px", color: "#475569" }}>{f.description}</td>
                              <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: "0.75rem", color: "#94A3B8" }}>{f.example}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Optional columns expandable */}
                    <button
                      onClick={() => setShowOptional(o => !o)}
                      style={{
                        marginTop: "10px",
                        display: "flex", alignItems: "center", gap: "6px",
                        background: "none", border: "none", padding: 0,
                        color: "#475569", fontSize: "0.8125rem", fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      <ChevronDown
                        size={14}
                        style={{
                          transform: showOptional ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)",
                        }}
                      />
                      {showOptional ? "Hide" : "Show"} {optionalFields.length} optional columns
                    </button>

                    <AnimatePresence initial={false}>
                      {showOptional && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                          style={{ overflow: "hidden" }}
                        >
                          <div style={{
                            marginTop: "10px",
                            border: "1px solid #E2E8F0",
                            borderRadius: "8px",
                            overflow: "hidden",
                          }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                              <tbody>
                                {optionalFields.map((f, i) => (
                                  <tr key={f.id} style={{ borderBottom: i < optionalFields.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                                    <td style={{ padding: "7px 12px", fontFamily: "monospace", fontSize: "0.75rem", color: "#0F172A", fontWeight: 600, width: "30%" }}>
                                      {f.id}
                                    </td>
                                    <td style={{ padding: "7px 12px", color: "#64748B" }}>{f.description}</td>
                                    <td style={{ padding: "7px 12px", fontFamily: "monospace", fontSize: "0.75rem", color: "#94A3B8" }}>{f.example}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Step 2 header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0F172A" }}>
                      Step 2 — Upload your filled file
                    </div>
                  </div>

                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                    style={{
                      border: `2px dashed ${isDragging ? "#002147" : "#CBD5E1"}`,
                      borderRadius: "8px",
                      padding: "40px 20px",
                      textAlign: "center",
                      cursor: "pointer",
                      background: isDragging ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                      transition: "all 150ms",
                    }}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      style={{ display: "none" }}
                      onChange={onInputChange}
                    />
                    <Upload size={32} style={{ color: "#94A3B8", display: "block", margin: "0 auto 12px" }} />
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#0F172A", marginBottom: "4px" }}>
                      {isParsing ? "Parsing file…" : "Drop your filled template here"}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "#64748B" }}>
                      or click to browse — .csv, .xlsx, .xls accepted
                    </div>
                  </div>

                  {error && (
                    <div
                      style={{
                        background: "#FEF2F2",
                        border: "1px solid #FECACA",
                        borderRadius: "6px",
                        padding: "10px 14px",
                        fontSize: "0.8125rem",
                        color: "#B91C1C",
                      }}
                    >
                      {error}
                    </div>
                  )}

                  {/* Trust strip */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    fontSize: "0.75rem", color: "#94A3B8",
                  }}>
                    <CheckCircle2 size={12} style={{ color: "#15803D" }} />
                    Stored securely in your private workspace. Visible only to your organisation.
                  </div>
                </div>
              )}

              {step === "review" && (
                <>
                  {importError && (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "10px 14px", fontSize: "0.8125rem", color: "#B91C1C", marginBottom: "16px" }}>
                      {importError}
                    </div>
                  )}
                  {canonicalFile ? (
                    <MultiSheetReviewStep
                      orgId={orgId}
                      portfolioId={portfolioId}
                      file={canonicalFile}
                      filename={filename}
                      onComplete={onComplete}
                      onError={setImportError}
                    />
                  ) : (
                    <ReviewImportStep
                      orgId={orgId}
                      portfolioId={portfolioId}
                      filename={filename}
                      mapping={mapping}
                      rows={rows}
                      columnMap={mapping}
                      onComplete={onComplete}
                      onError={setImportError}
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav (only on review step, for Back) */}
        {step === "review" && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-start" }}>
            <button
              onClick={() => { setStep("intro"); setImportError(null); }}
              style={{
                padding: "8px 16px", background: "transparent", color: "#475569",
                border: "1px solid #E2E8F0", borderRadius: "8px", fontWeight: 500,
                fontSize: "0.875rem", cursor: "pointer",
              }}
            >
              Back
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
