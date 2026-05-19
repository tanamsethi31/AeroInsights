// src/app/components/reconciliation/StatementUploadModal.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, ChevronLeft, ChevronRight, Check, AlertTriangle, RotateCcw } from "lucide-react";
import {
  parseFile,
  applyMappings,
  type ParseResult,
  type ColumnMapping,
  type ColumnRole,
  type ParsedTransaction,
} from "../../utils/bankStatementParser";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportPayload {
  filename:    string;
  currency:    string;
  periodLabel: string;
  rowCount:    number;
}

interface Props {
  open:     boolean;
  onClose:  () => void;
  onImport: (payload: ImportPayload, transactions: ParsedTransaction[]) => Promise<void>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: ColumnRole[] = [
  "date", "description", "debit", "credit", "amount", "balance", "reference", "ignore",
];

const ROLE_LABELS: Record<ColumnRole, string> = {
  date: "Date", description: "Description", debit: "Debit", credit: "Credit",
  amount: "Amount", balance: "Balance", reference: "Reference", ignore: "Ignore",
};

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SGD", "JPY", "AUD", "CAD"];

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px",
  border: "1px solid #334155", background: "#0F172A", color: "#F8FAFC",
  fontSize: "0.875rem", outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.75rem", color: "#94A3B8",
  marginBottom: "0.25rem", fontWeight: 500,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: "pointer",
};

// ── Validation ────────────────────────────────────────────────────────────────

function validateMappings(mappings: ColumnMapping[]): string | null {
  const roles = mappings.map(m => m.role);
  const dateCount = roles.filter(r => r === "date").length;
  const descCount = roles.filter(r => r === "description").length;
  if (dateCount === 0)        return "Must map a Date column";
  if (dateCount > 1)          return "Only one Date column allowed — set extras to Ignore";
  if (descCount === 0)        return "Must map a Description column";
  if (descCount > 1)          return "Only one Description column allowed — set extras to Ignore";
  const hasDebitCredit = roles.includes("debit") && roles.includes("credit");
  const hasAmount      = roles.includes("amount");
  if (!hasDebitCredit && !hasAmount)  return "Must map either (Debit + Credit) or an Amount column";
  return null;
}

// ── Summary helpers ───────────────────────────────────────────────────────────

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StatementUploadModal({ open, onClose, onImport }: Props) {
  const [step,        setStep       ] = useState<1 | 2 | 3>(1);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mappings,    setMappings   ] = useState<ColumnMapping[]>([]);
  const [currency,    setCurrency   ] = useState("USD");
  const [periodLabel, setPeriodLabel] = useState("");
  const [importing,   setImporting  ] = useState(false);
  const [error,       setError      ] = useState<string | null>(null);
  const [filename,    setFilename   ] = useState("");
  const [dragOver,    setDragOver   ] = useState(false);
  const [parsing,     setParsing    ] = useState(false);
  const [finalTxns,   setFinalTxns  ] = useState<ParsedTransaction[]>([]);
  const [finalErrors, setFinalErrors] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setStep(1); setParseResult(null); setMappings([]);
      setCurrency("USD"); setPeriodLabel(""); setImporting(false);
      setError(null); setFilename(""); setParsing(false);
      setFinalTxns([]); setFinalErrors([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Live preview: re-apply current mappings to first 3 rawRows whenever mappings change
  const livePreview = useMemo(() => {
    if (!parseResult || parseResult.rawRows.length === 0) return [];
    return applyMappings(parseResult.rawRows.slice(0, 3), mappings).transactions;
  }, [parseResult, mappings]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFilename(file.name);
    setParsing(true);
    try {
      const result = await parseFile(file);
      if (result.errors.length > 0 && result.transactions.length === 0) {
        setError(result.errors[0]);
        return;
      }
      setParseResult(result);
      setMappings(result.mappings);
      setStep(2);
    } catch {
      setError("Failed to parse file. Please check the format and try again.");
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  const setRole = (index: number, role: ColumnRole) =>
    setMappings(prev => prev.map(m => m.index === index ? { ...m, role } : m));

  const reapply = () => {
    if (parseResult) setMappings(parseResult.mappings);
  };

  const goToStep3 = () => {
    if (!parseResult) return;
    const validationError = validateMappings(mappings);
    if (validationError) { setError(validationError); return; }
    setError(null);
    const { transactions, errors } = applyMappings(parseResult.allDataRows, mappings);
    setFinalTxns(transactions);
    setFinalErrors(errors);
    setStep(3);
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      await onImport(
        { filename, currency, periodLabel: periodLabel || "Unlabelled", rowCount: finalTxns.length },
        finalTxns
      );
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const totalCredits = finalTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalDebits  = Math.abs(finalTxns.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const netAmount    = totalCredits - totalDebits;
  const dates        = finalTxns.map(t => t.valueDate).sort();
  const dateRange    = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : "—";

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
          }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            style={{
              background: "#1E293B", borderRadius: "12px",
              border: "1px solid #334155",
              width: "100%", maxWidth: step === 2 ? "720px" : "560px",
              maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1.25rem 1.5rem", borderBottom: "1px solid #334155",
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "#F8FAFC" }}>
                  {step === 1 ? "Upload Bank Statement" : step === 2 ? "Map Columns" : "Preview & Confirm"}
                </h2>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#64748B" }}>
                  Step {step} of 3
                </p>
              </div>
              <button
                onClick={onClose}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "0.25rem", borderRadius: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "1.5rem" }}>

              {/* Step 1: Upload */}
              {step === 1 && (
                <div>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    style={{
                      border: `2px dashed ${dragOver ? "#3B82F6" : "#334155"}`,
                      borderRadius: "10px", padding: "3rem 2rem", textAlign: "center",
                      background: dragOver ? "rgba(59,130,246,0.06)" : "#0F172A",
                      cursor: "pointer",
                      transition: "border-color 150ms, background 150ms",
                    }}
                    onClick={() => document.getElementById("stmt-file-input")?.click()}
                  >
                    {parsing ? (
                      <p style={{ color: "#94A3B8", margin: 0 }}>Parsing file…</p>
                    ) : (
                      <>
                        <Upload size={32} style={{ color: "#475569", marginBottom: "0.75rem" }} />
                        <p style={{ color: "#F8FAFC", margin: "0 0 0.25rem", fontWeight: 500 }}>
                          Drop your bank statement here
                        </p>
                        <p style={{ color: "#64748B", margin: 0, fontSize: "0.8rem" }}>
                          CSV or XLSX · max 10,000 rows
                        </p>
                      </>
                    )}
                  </div>
                  <input id="stmt-file-input" type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={onInputChange} />
                  {filename && !error && !parsing && (
                    <div style={{ marginTop: "0.75rem", padding: "0.625rem 0.875rem", borderRadius: "6px", background: "#0F172A", border: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.8rem" }}>
                      <span style={{ color: "#F8FAFC" }}>{filename}</span>
                    </div>
                  )}
                  {error && (
                    <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: "6px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#F87171", fontSize: "0.875rem" }}>
                      {error}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Map Columns */}
              {step === 2 && parseResult && (
                <div>
                  <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #334155" }}>
                          {["Column Header", "Detected Role", "Sample Value"].map(h => (
                            <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#64748B", fontWeight: 500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map(m => {
                          const sampleRow = parseResult.rawRows.find(r => (r[m.index] ?? "").trim() !== "");
                          const sample    = sampleRow ? sampleRow[m.index] : "";
                          return (
                            <tr key={m.index} style={{ borderBottom: "1px solid #1E293B" }}>
                              <td style={{ padding: "0.5rem 0.75rem", color: "#F8FAFC" }}>{m.header}</td>
                              <td style={{ padding: "0.5rem 0.75rem" }}>
                                <select value={m.role} onChange={e => setRole(m.index, e.target.value as ColumnRole)} style={{ ...selectStyle, width: "auto", minWidth: "130px" }}>
                                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                                </select>
                              </td>
                              <td style={{ padding: "0.5rem 0.75rem", color: "#94A3B8", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {sample || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <button onClick={reapply} style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: "none", border: "1px solid #334155", color: "#94A3B8", borderRadius: "6px", padding: "0.375rem 0.75rem", fontSize: "0.8rem", cursor: "pointer", marginBottom: "1.25rem" }}>
                    <RotateCcw size={12} /> Re-apply auto-detection
                  </button>

                  {livePreview.length > 0 && (
                    <div style={{ marginBottom: "1.25rem" }}>
                      <p style={{ ...labelStyle, marginBottom: "0.5rem" }}>Live Preview (first 3 rows)</p>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #334155" }}>
                            {["Date", "Description", "Amount"].map(h => (
                              <th key={h} style={{ padding: "0.375rem 0.75rem", textAlign: "left", color: "#64748B", fontWeight: 500 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {livePreview.map((t, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #1E293B" }}>
                              <td style={{ padding: "0.375rem 0.75rem", color: "#94A3B8" }}>{t.valueDate}</td>
                              <td style={{ padding: "0.375rem 0.75rem", color: "#F8FAFC", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                              <td style={{ padding: "0.375rem 0.75rem", color: t.amount >= 0 ? "#4ADE80" : "#F87171", fontWeight: 500 }}>
                                {t.amount >= 0 ? "+" : ""}{t.amount.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <label style={labelStyle}>Period Label</label>
                      <input type="text" value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} placeholder="e.g. May 2026" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Currency</label>
                      <select value={currency} onChange={e => setCurrency(e.target.value)} style={selectStyle}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {error && (
                    <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: "6px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#F87171", fontSize: "0.875rem" }}>
                      {error}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Preview & Confirm */}
              {step === 3 && (
                <div>
                  <div style={{ background: "#0F172A", border: "1px solid #334155", borderRadius: "8px", padding: "1rem", marginBottom: "1.25rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                      {[
                        ["Transactions", finalTxns.length.toLocaleString()],
                        ["Date Range",   dateRange],
                        ["Total Credits",  fmt(totalCredits, currency)],
                        ["Total Debits",   fmt(totalDebits,  currency)],
                        ["Net",            fmt(netAmount,    currency)],
                        ["Period",         periodLabel || "Unlabelled"],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <p style={{ margin: 0, fontSize: "0.7rem", color: "#64748B", fontWeight: 500 }}>{k}</p>
                          <p style={{ margin: "0.125rem 0 0", fontSize: "0.875rem", color: "#F8FAFC", fontWeight: 500 }}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {finalErrors.length > 0 && (
                    <div style={{ marginBottom: "1.25rem", padding: "0.75rem", borderRadius: "6px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
                        <AlertTriangle size={14} style={{ color: "#FBBF24", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.8rem", color: "#FBBF24", fontWeight: 500 }}>
                          {finalErrors.length} row{finalErrors.length !== 1 ? "s" : ""} skipped
                        </span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                        {finalErrors.slice(0, 5).map((e, i) => (
                          <li key={i} style={{ fontSize: "0.775rem", color: "#94A3B8" }}>{e}</li>
                        ))}
                        {finalErrors.length > 5 && (
                          <li style={{ fontSize: "0.775rem", color: "#64748B" }}>…and {finalErrors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div style={{ marginBottom: "1.25rem", overflowX: "auto" }}>
                    <p style={{ ...labelStyle, marginBottom: "0.5rem" }}>
                      First {Math.min(10, finalTxns.length)} transactions
                    </p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #334155" }}>
                          {["Date", "Description", "Amount"].map(h => (
                            <th key={h} style={{ padding: "0.375rem 0.75rem", textAlign: "left", color: "#64748B", fontWeight: 500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {finalTxns.slice(0, 10).map((t, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #1E293B" }}>
                            <td style={{ padding: "0.375rem 0.75rem", color: "#94A3B8" }}>{t.valueDate}</td>
                            <td style={{ padding: "0.375rem 0.75rem", color: "#F8FAFC", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                            <td style={{ padding: "0.375rem 0.75rem", color: t.amount >= 0 ? "#4ADE80" : "#F87171", fontWeight: 500 }}>
                              {t.amount >= 0 ? "+" : ""}{fmt(t.amount, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {error && (
                    <div style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: "6px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#F87171", fontSize: "0.875rem" }}>
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderTop: "1px solid #334155" }}>
              <div>
                {step > 1 && (
                  <button
                    onClick={() => { setError(null); setStep((step === 3 ? 2 : 1) as 1 | 2 | 3); }}
                    style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: "none", border: "1px solid #334155", color: "#94A3B8", borderRadius: "6px", padding: "0.5rem 1rem", fontSize: "0.875rem", cursor: "pointer" }}
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                )}
              </div>
              <div>
                {step === 1 && (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#475569" }}>Select or drop a file to continue</p>
                )}
                {step === 2 && (
                  <button onClick={goToStep3} style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: "#3B82F6", border: "none", color: "#FFFFFF", borderRadius: "6px", padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}>
                    Preview <ChevronRight size={14} />
                  </button>
                )}
                {step === 3 && (
                  <button
                    onClick={handleImport}
                    disabled={importing || finalTxns.length === 0}
                    style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: importing ? "#1E3A5F" : "#3B82F6", border: "none", color: "#FFFFFF", borderRadius: "6px", padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, cursor: importing ? "not-allowed" : "pointer", opacity: finalTxns.length === 0 ? 0.5 : 1 }}>
                    {importing ? "Importing…" : <><Check size={14} /> Import {finalTxns.length.toLocaleString()} transactions</>}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
