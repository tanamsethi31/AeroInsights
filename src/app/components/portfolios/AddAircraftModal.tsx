/**
 * AddAircraftModal
 * Two-path aircraft ingestion: Bulk upload (.xlsx / .csv) or a single
 * manual-entry form.  No backend call yet — submissions log to console
 * and show an inline success state.
 */

import { useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  X,
  Plus,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  PenLine,
  Loader2,
} from "lucide-react";

// ─── Column schema ─────────────────────────────────────────────────────────────

const COLUMNS = [
  { name: "lessee_name",   label: "Lessee Name",        required: true,  example: "IndiGo Airlines",  note: "Airline or lessee entity" },
  { name: "country",       label: "Country",             required: true,  example: "India",            note: "Country name or ISO code" },
  { name: "aircraft_type", label: "Aircraft Type",       required: true,  example: "A320neo",          note: "ICAO type designator" },
  { name: "msn",           label: "MSN",                 required: true,  example: "9218",             note: "Manufacturer Serial Number" },
  { name: "ead_usd_m",     label: "EAD ($M)",            required: true,  example: "14.20",            note: "Exposure at Default in $M" },
  { name: "lease_end",     label: "Lease End Date",      required: true,  example: "2028-03-01",       note: "YYYY-MM-DD format" },
  { name: "credit_rating", label: "Credit Rating",       required: false, example: "BB-",              note: "S&P / Moody's — optional" },
  { name: "registration",  label: "Registration",        required: false, example: "VT-IYC",           note: "Tail number — optional" },
  { name: "vintage",       label: "Vintage Year",        required: false, example: "2019",             note: "Year of manufacture" },
  { name: "monthly_rent",  label: "Monthly Rent (USD)",  required: false, example: "285000",           note: "USD, no commas — optional" },
] as const;

function downloadTemplate() {
  const header = COLUMNS.map((c) => c.name).join(",");
  const row    = COLUMNS.map((c) => c.example).join(",");
  const csv    = [header, row].join("\n");
  const blob   = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  a.href       = url;
  a.download   = "aeroinsights-aircraft-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function fmtBytes(b: number) {
  return b < 1024 * 1024
    ? `${(b / 1024).toFixed(1)} KB`
    : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab    = "bulk" | "manual";
type Status = "idle" | "loading" | "success" | "error";

interface AircraftFormData {
  lesseeName:   string;
  country:      string;
  aircraftModel: string;
  msn:          string;
  eadUsdM:      string;
  leaseEndDate: string;
}

// ─── Shared style helpers ──────────────────────────────────────────────────────

const EASE = "cubic-bezier(0.23,1,0.32,1)";

const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.875rem",
  fontSize: "0.875rem",
  border: "1px solid #E2E8F0",
  borderRadius: "0.5rem",
  color: "#0F172A",
  background: "#FFFFFF",
  boxSizing: "border-box",
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function AddAircraftModal({ onClose }: { onClose: () => void }) {
  const [activeTab,    setActiveTab]    = useState<Tab>("bulk");
  const [dragOver,     setDragOver]     = useState(false);
  const [file,         setFile]         = useState<File | null>(null);
  const [bulkStatus,   setBulkStatus]   = useState<Status>("idle");
  const [submitStatus, setSubmitStatus] = useState<Status>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<AircraftFormData>();

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.match(/\.(csv|xlsx)$/i)) {
      setFile(dropped);
      setBulkStatus("idle");
    }
  }, []);

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setBulkStatus("idle"); }
  }

  // ── Submission ─────────────────────────────────────────────────────────────

  function handleBulkUpload() {
    if (!file) return;
    console.log("[AddAircraft] Queuing file:", file.name, fmtBytes(file.size));
    setBulkStatus("success");
  }

  function onManualSubmit(data: AircraftFormData) {
    setSubmitStatus("loading");
    console.log("[AddAircraft] Manual entry:", {
      ...data,
      eadUsdM: parseFloat(data.eadUsdM),
    });
    setTimeout(() => setSubmitStatus("success"), 800);
  }

  function handleAddAnother() {
    resetForm();
    setSubmitStatus("idle");
    setFile(null);
    setBulkStatus("idle");
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const canUpload  = !!file && bulkStatus !== "success";
  const isManualOk = submitStatus === "success";

  return (
    <>
      {/* Input focus + error styles */}
      <style>{`
        .aa-input {
          outline: none;
          transition: border-color 150ms ${EASE}, box-shadow 150ms ${EASE};
        }
        .aa-input:focus {
          border-color: #002147 !important;
          box-shadow: 0 0 0 3px rgba(0,33,71,0.08);
        }
        .aa-input-err {
          border-color: #DC2626 !important;
        }
        .aa-input-err:focus {
          box-shadow: 0 0 0 3px rgba(220,38,38,0.08);
        }
      `}</style>

      {/* Backdrop */}
      <div
        style={{
          position: "fixed", inset: 0,
          background: "rgba(15,23,42,0.5)",
          backdropFilter: "blur(4px)",
          zIndex: 500,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1.5rem",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Modal */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "1rem",
            width: "100%",
            maxWidth: "640px",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)",
          }}
        >
          {/* ── Header ── */}
          <div style={{
            display: "flex", alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "1.75rem 1.75rem 1.25rem",
            borderBottom: "1px solid #F1F5F9",
            flexShrink: 0,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
                <div style={{
                  width: "32px", height: "32px",
                  background: "#EFF6FF",
                  borderRadius: "0.5rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Plus size={15} style={{ color: "#002147" }} />
                </div>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Add Aircraft
                </h2>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: 0 }}>
                Upload a spreadsheet or add a single aircraft manually.
              </p>
            </div>

            <button
              onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#94A3B8", padding: "0.25rem",
                borderRadius: "0.375rem",
                display: "flex", alignItems: "center",
                transition: `background 120ms, color 120ms`,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9";
                (e.currentTarget as HTMLButtonElement).style.color = "#475569";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "none";
                (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8";
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Body ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1.75rem" }}>

            {/* Tab switcher */}
            <div style={{
              display: "flex",
              background: "#F1F5F9",
              borderRadius: "0.625rem",
              padding: "3px",
              gap: "2px",
              marginBottom: "1.5rem",
            }}>
              {([
                { id: "bulk",   Icon: Upload,  label: "Bulk Upload" },
                { id: "manual", Icon: PenLine, label: "Manual Entry" },
              ] as { id: Tab; Icon: typeof Upload; label: string }[]).map(({ id, Icon, label }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    style={{
                      flex: 1,
                      display: "flex", alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      padding: "0.5rem",
                      borderRadius: "0.5rem",
                      border: "none",
                      background: active ? "#FFFFFF" : "transparent",
                      color: active ? "#0F172A" : "#64748B",
                      fontWeight: active ? 600 : 400,
                      fontSize: "0.875rem",
                      cursor: "pointer",
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      transition: `background 150ms ${EASE}, color 150ms ${EASE}, box-shadow 150ms ${EASE}`,
                    }}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── BULK UPLOAD ── */}
            {activeTab === "bulk" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                {/* Required columns reference */}
                <div>
                  <div style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.625rem",
                  }}>
                    <span style={{
                      fontSize: "0.6875rem", fontWeight: 600,
                      color: "#94A3B8", textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}>
                      Required Format
                    </span>
                    <button
                      onClick={downloadTemplate}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.375rem",
                        fontSize: "0.75rem", fontWeight: 600,
                        color: "#002147",
                        background: "none",
                        border: "1px solid #002147",
                        borderRadius: "9999px",
                        padding: "0.3rem 0.75rem",
                        cursor: "pointer",
                        transition: `background ${150}ms ${EASE}`,
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background = "#EFF6FF")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background = "none")
                      }
                    >
                      <Download size={12} />
                      Download Blank Template
                    </button>
                  </div>

                  <div style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "0.625rem",
                    overflow: "hidden",
                  }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                          {["Column", "Required", "Example", "Notes"].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: "0.5rem 0.75rem",
                                textAlign: "left",
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                color: "#475569",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {COLUMNS.map((col, i) => (
                          <tr
                            key={col.name}
                            style={{
                              borderBottom: i < COLUMNS.length - 1 ? "1px solid #F1F5F9" : "none",
                              background: "#FFFFFF",
                            }}
                          >
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <code style={{
                                fontFamily: "monospace",
                                fontSize: "0.75rem",
                                color: "#002147",
                                background: "#EFF6FF",
                                padding: "0.1rem 0.35rem",
                                borderRadius: "0.25rem",
                              }}>
                                {col.name}
                              </code>
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <span style={{
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                padding: "0.15rem 0.4rem",
                                borderRadius: "0.375rem",
                                background: col.required ? "rgba(21,128,61,0.08)" : "#F1F5F9",
                                color: col.required ? "#15803D" : "#64748B",
                              }}>
                                {col.required ? "Required" : "Optional"}
                              </span>
                            </td>
                            <td style={{
                              padding: "0.5rem 0.75rem",
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                              color: "#475569",
                            }}>
                              {col.example}
                            </td>
                            <td style={{
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.75rem",
                              color: "#94A3B8",
                            }}>
                              {col.note}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Drag-and-drop zone */}
                {bulkStatus === "success" ? (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "0.875rem",
                    padding: "1.25rem",
                    background: "rgba(21,128,61,0.06)",
                    border: "1px solid rgba(21,128,61,0.25)",
                    borderRadius: "0.75rem",
                  }}>
                    <CheckCircle2 size={20} style={{ color: "#15803D", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#15803D" }}>
                        File queued successfully
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: "0.125rem" }}>
                        {file?.name} · {file ? fmtBytes(file.size) : ""}
                      </div>
                    </div>
                    <button
                      onClick={handleAddAnother}
                      style={{
                        fontSize: "0.8125rem", color: "#64748B",
                        background: "none", border: "none",
                        cursor: "pointer", textDecoration: "underline",
                        textUnderlineOffset: "2px",
                      }}
                    >
                      Upload another
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx"
                      style={{ display: "none" }}
                      onChange={onFileInput}
                    />
                    <div
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.75rem",
                        padding: "2.5rem 1.5rem",
                        border: `2px dashed ${dragOver ? "#002147" : file ? "#002147" : "#CBD5E1"}`,
                        borderRadius: "0.75rem",
                        background: dragOver ? "#EFF6FF" : file ? "#F8FAFC" : "#FAFAFA",
                        cursor: "pointer",
                        transition: `border-color 150ms ${EASE}, background 150ms ${EASE}`,
                      }}
                    >
                      {file ? (
                        <>
                          <div style={{
                            width: "44px", height: "44px",
                            background: "#EFF6FF",
                            borderRadius: "0.625rem",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <FileSpreadsheet size={22} style={{ color: "#002147" }} />
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
                              {file.name}
                            </div>
                            <div style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: "0.125rem" }}>
                              {fmtBytes(file.size)}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setFile(null); }}
                            style={{
                              fontSize: "0.75rem", color: "#94A3B8",
                              background: "none", border: "none",
                              cursor: "pointer", textDecoration: "underline",
                              textUnderlineOffset: "2px",
                            }}
                          >
                            Replace file
                          </button>
                        </>
                      ) : (
                        <>
                          <div style={{
                            width: "44px", height: "44px",
                            background: "#F1F5F9",
                            borderRadius: "0.625rem",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Upload size={20} style={{ color: "#94A3B8" }} />
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#0F172A" }}>
                              Drag your <code style={{ fontSize: "0.875rem", color: "#002147" }}>.xlsx</code>{" "}
                              or <code style={{ fontSize: "0.875rem", color: "#002147" }}>.csv</code> here
                            </div>
                            <div style={{ fontSize: "0.8125rem", color: "#94A3B8", marginTop: "0.25rem" }}>
                              or click to browse files
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── MANUAL ENTRY ── */}
            {activeTab === "manual" && (
              <>
                {isManualOk ? (
                  <div style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: "1rem",
                    padding: "2.5rem 1.5rem",
                    background: "rgba(21,128,61,0.06)",
                    border: "1px solid rgba(21,128,61,0.20)",
                    borderRadius: "0.875rem",
                    textAlign: "center",
                  }}>
                    <div style={{
                      width: "48px", height: "48px",
                      background: "rgba(21,128,61,0.12)",
                      borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <CheckCircle2 size={22} style={{ color: "#15803D" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#15803D" }}>
                        Aircraft added successfully
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: "0.25rem" }}>
                        The record has been queued for ingestion.
                      </div>
                    </div>
                    <button
                      onClick={handleAddAnother}
                      style={{
                        padding: "0.5rem 1.25rem",
                        background: "none",
                        border: "1px solid #E2E8F0",
                        borderRadius: "9999px",
                        fontSize: "0.875rem", fontWeight: 500,
                        color: "#475569", cursor: "pointer",
                      }}
                    >
                      Add another aircraft
                    </button>
                  </div>
                ) : (
                  <form
                    id="aircraft-manual-form"
                    onSubmit={handleSubmit(onManualSubmit)}
                    noValidate
                  >
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1rem",
                    }}>
                      {/* Lessee Name */}
                      <FieldWrapper
                        label="Lessee Name"
                        required
                        error={errors.lesseeName?.message}
                        colSpan={2}
                      >
                        <input
                          {...register("lesseeName", { required: "Lessee name is required" })}
                          className={`aa-input${errors.lesseeName ? " aa-input-err" : ""}`}
                          placeholder="e.g. IndiGo Airlines"
                          style={inputBase}
                        />
                      </FieldWrapper>

                      {/* Country */}
                      <FieldWrapper label="Country" required error={errors.country?.message}>
                        <input
                          {...register("country", { required: "Country is required" })}
                          className={`aa-input${errors.country ? " aa-input-err" : ""}`}
                          placeholder="e.g. India"
                          style={inputBase}
                        />
                      </FieldWrapper>

                      {/* Aircraft Model */}
                      <FieldWrapper
                        label="Aircraft Model"
                        required
                        error={errors.aircraftModel?.message}
                      >
                        <input
                          {...register("aircraftModel", { required: "Aircraft model is required" })}
                          className={`aa-input${errors.aircraftModel ? " aa-input-err" : ""}`}
                          placeholder="e.g. A320neo"
                          style={inputBase}
                        />
                      </FieldWrapper>

                      {/* MSN */}
                      <FieldWrapper
                        label="MSN (Serial Number)"
                        required
                        error={errors.msn?.message}
                      >
                        <input
                          {...register("msn", { required: "MSN is required" })}
                          className={`aa-input${errors.msn ? " aa-input-err" : ""}`}
                          placeholder="e.g. 9218"
                          style={inputBase}
                        />
                      </FieldWrapper>

                      {/* EAD */}
                      <FieldWrapper
                        label="EAD ($M)"
                        hint="Exposure at Default"
                        required
                        error={errors.eadUsdM?.message}
                      >
                        <div style={{ position: "relative" }}>
                          <span style={{
                            position: "absolute", left: "0.875rem",
                            top: "50%", transform: "translateY(-50%)",
                            fontSize: "0.875rem", color: "#94A3B8",
                            pointerEvents: "none", userSelect: "none",
                          }}>$</span>
                          <input
                            {...register("eadUsdM", {
                              required: "EAD is required",
                              validate: (v) => {
                                const n = parseFloat(v);
                                if (isNaN(n)) return "Must be a number";
                                if (n <= 0) return "Must be greater than zero";
                                return true;
                              },
                            })}
                            type="number"
                            step="0.01"
                            min="0"
                            className={`aa-input${errors.eadUsdM ? " aa-input-err" : ""}`}
                            placeholder="14.20"
                            style={{ ...inputBase, paddingLeft: "1.625rem" }}
                          />
                        </div>
                      </FieldWrapper>

                      {/* Lease End Date */}
                      <FieldWrapper
                        label="Lease End Date"
                        required
                        error={errors.leaseEndDate?.message}
                      >
                        <input
                          {...register("leaseEndDate", {
                            required: "Lease end date is required",
                            validate: (v) => {
                              if (!v) return true;
                              const d = new Date(v);
                              if (isNaN(d.getTime())) return "Invalid date";
                              if (d <= new Date()) return "Must be a future date";
                              return true;
                            },
                          })}
                          type="date"
                          className={`aa-input${errors.leaseEndDate ? " aa-input-err" : ""}`}
                          style={inputBase}
                        />
                      </FieldWrapper>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{
            padding: "1.25rem 1.75rem",
            borderTop: "1px solid #F1F5F9",
            display: "flex", alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.75rem",
            flexShrink: 0,
          }}>
            <button
              onClick={onClose}
              style={{
                padding: "0.625rem 1.25rem",
                background: "none",
                border: "1px solid #E2E8F0",
                borderRadius: "9999px",
                fontSize: "0.875rem", fontWeight: 500,
                color: "#475569", cursor: "pointer",
                transition: `background 150ms ${EASE}`,
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "none")
              }
            >
              {isManualOk || bulkStatus === "success" ? "Close" : "Cancel"}
            </button>

            {/* Context-sensitive primary action */}
            {activeTab === "bulk" && bulkStatus !== "success" && (
              <PrimaryButton
                disabled={!canUpload}
                onClick={handleBulkUpload}
                icon={<Upload size={14} />}
              >
                Upload File
              </PrimaryButton>
            )}

            {activeTab === "manual" && !isManualOk && (
              <PrimaryButton
                type="submit"
                form="aircraft-manual-form"
                disabled={submitStatus === "loading"}
                icon={
                  submitStatus === "loading"
                    ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    : <Plus size={14} />
                }
              >
                {submitStatus === "loading" ? "Adding…" : "Add Aircraft"}
              </PrimaryButton>
            )}
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FieldWrapper({
  label,
  hint,
  required,
  error,
  colSpan,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  colSpan?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ gridColumn: colSpan ? `span ${colSpan}` : undefined }}>
      <label style={{
        display: "flex", alignItems: "baseline", gap: "0.375rem",
        marginBottom: "0.375rem",
      }}>
        <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#374151" }}>
          {label}
        </span>
        {required && (
          <span style={{ fontSize: "0.75rem", color: "#DC2626" }}>*</span>
        )}
        {hint && (
          <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>— {hint}</span>
        )}
      </label>
      {children}
      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.3rem",
          marginTop: "0.375rem",
          fontSize: "0.75rem", color: "#DC2626",
        }}>
          <AlertCircle size={11} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}
    </div>
  );
}

function PrimaryButton({
  children,
  disabled = false,
  onClick,
  type = "button",
  form,
  icon,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  form?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.625rem 1.25rem",
        background: disabled ? "#F1F5F9" : "#002147",
        color: disabled ? "#CBD5E1" : "#FFFFFF",
        border: "none",
        borderRadius: "9999px",
        fontSize: "0.875rem", fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: `background 150ms cubic-bezier(0.23,1,0.32,1), transform 150ms cubic-bezier(0.23,1,0.32,1)`,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background = "#001a35";
      }}
      onMouseLeave={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background = "#002147";
      }}
      onMouseDown={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
    >
      {icon}
      {children}
    </button>
  );
}
