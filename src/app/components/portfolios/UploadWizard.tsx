/**
 * UploadWizard
 * Multi-step guided Excel/CSV import flow.
 *
 * Step 1 – Template download   (explain columns, generate CSV)
 * Step 2 – File upload         (drag-and-drop zone)
 * Step 3 – Validate            (POST /import/validate → show errors or OK)
 * Step 4 – Commit & redirect   (POST /import/portfolio → success animation → dashboard)
 */

import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import {
  X,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { usePortfolio, type Portfolio } from "../../contexts/PortfolioContext";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000/api/v1";

// ─── Template ─────────────────────────────────────────────────────────────────

const TEMPLATE_COLUMNS = [
  { name: "lessee_name",       required: true,  example: "IndiGo Airlines",    note: "Airline or lessee entity name" },
  { name: "country_code",      required: true,  example: "IN",                 note: "ISO 3166-1 alpha-2 country code" },
  { name: "credit_rating",     required: false, example: "BB-",                note: "S&P / Moody's rating (optional)" },
  { name: "msn",               required: true,  example: "9218",               note: "Manufacturer Serial Number" },
  { name: "aircraft_type",     required: true,  example: "A320neo",            note: "ICAO aircraft type designator" },
  { name: "registration",      required: false, example: "VT-IYC",             note: "Tail number (optional)" },
  { name: "vintage",           required: true,  example: "2019",               note: "Year of manufacture (YYYY)" },
  { name: "lease_start",       required: true,  example: "2019-03-01",         note: "Lease commencement (YYYY-MM-DD)" },
  { name: "lease_end",         required: true,  example: "2028-03-01",         note: "Lease expiry (YYYY-MM-DD)" },
  { name: "monthly_rent_usd",  required: true,  example: "285000",             note: "Monthly rent in USD (no commas)" },
];

function downloadTemplate() {
  const header = TEMPLATE_COLUMNS.map((c) => c.name).join(",");
  const row1 = TEMPLATE_COLUMNS.map((c) => c.example).join(",");
  const row2 = [
    "Emirates", "AE", "A-", "62047", "B777-300ER", "A6-ECE",
    "2021", "2021-01-10", "2030-01-10", "1240000",
  ].join(",");
  const csv = [header, row1, row2].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aeroinsights-portfolio-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Shared types ─────────────────────────────────────────────────────────────

interface ImportResult {
  status: "success" | "error";
  lessees_created: number;
  aircraft_created: number;
  leases_created: number;
  errors: string[];
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["Template", "Upload", "Validate", "Import"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "2rem" }}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const upcoming = i > current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : undefined }}>
            {/* Dot + label */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: done ? "#16A34A" : active ? "#002147" : "#E2E8F0",
                  transition: "background 200ms cubic-bezier(0.23,1,0.32,1)",
                  flexShrink: 0,
                }}
              >
                {done ? (
                  <CheckCircle2 size={14} style={{ color: "#FFFFFF" }} />
                ) : (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: active ? "#FFFFFF" : "#94A3B8",
                      lineHeight: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: active ? 600 : 500,
                  color: done ? "#16A34A" : active ? "#002147" : "#94A3B8",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: "2px",
                  marginBottom: "1.25rem",
                  background: done ? "#16A34A" : "#E2E8F0",
                  transition: "background 200ms cubic-bezier(0.23,1,0.32,1)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Template ─────────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.375rem" }}>
          Download the data template
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          Your file must contain the following columns. Download the template,
          fill it in, and upload it in the next step.
        </p>
      </div>

      {/* Column reference table */}
      <div
        style={{
          border: "1px solid #E2E8F0",
          borderRadius: "0.625rem",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Column", "Required", "Example", "Notes"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "0.625rem 1rem",
                    textAlign: "left",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEMPLATE_COLUMNS.map((col, i) => (
              <tr
                key={col.name}
                style={{
                  borderBottom: i < TEMPLATE_COLUMNS.length - 1 ? "1px solid #F1F5F9" : "none",
                }}
              >
                <td style={{ padding: "0.5rem 1rem" }}>
                  <code
                    style={{
                      fontSize: "0.8125rem",
                      fontFamily: "monospace",
                      color: "#002147",
                      background: "#EFF6FF",
                      padding: "0.125rem 0.375rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    {col.name}
                  </code>
                </td>
                <td style={{ padding: "0.5rem 1rem" }}>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: col.required ? "#DC2626" : "#64748B",
                      background: col.required ? "#FEF2F2" : "#F8FAFC",
                      padding: "0.125rem 0.375rem",
                      borderRadius: "9999px",
                    }}
                  >
                    {col.required ? "Required" : "Optional"}
                  </span>
                </td>
                <td style={{ padding: "0.5rem 1rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                  {col.example}
                </td>
                <td style={{ padding: "0.5rem 1rem", color: "#94A3B8" }}>{col.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={downloadTemplate}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 1.25rem",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "#0F172A",
            cursor: "pointer",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC")
          }
        >
          <Download size={14} />
          Download template (.csv)
        </button>

        <button onClick={onNext} style={primaryBtnStyle}>
          I have my file ready
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: File upload ──────────────────────────────────────────────────────

function Step2({
  file,
  onFile,
  onNext,
  onBack,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (f: File) => {
    const ok = f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls");
    if (ok) onFile(f);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) accept(f);
    },
    [onFile],
  );

  const fmtBytes = (b: number) =>
    b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.375rem" }}>
          Upload your file
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          Drop your filled template here. We accept <strong>.csv</strong> and{" "}
          <strong>.xlsx</strong> files.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#002147" : file ? "#16A34A" : "#CBD5E1"}`,
          borderRadius: "0.875rem",
          padding: "2.5rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          cursor: "pointer",
          background: dragging ? "#EFF6FF" : file ? "#F0FDF4" : "#F8FAFC",
          transition: "border-color 150ms, background 150ms",
          minHeight: "200px",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) accept(f);
          }}
        />

        {file ? (
          <>
            <div
              style={{
                width: "52px",
                height: "52px",
                background: "#DCFCE7",
                borderRadius: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileSpreadsheet size={24} style={{ color: "#16A34A" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>{file.name}</div>
              <div style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: "0.25rem" }}>
                {fmtBytes(file.size)}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onFile(null as unknown as File); inputRef.current && (inputRef.current.value = ""); }}
              style={{
                fontSize: "0.8125rem",
                color: "#94A3B8",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Replace file
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                width: "52px",
                height: "52px",
                background: "#F1F5F9",
                borderRadius: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Upload size={24} style={{ color: "#94A3B8" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>
                {dragging ? "Drop to upload" : "Drag your file here"}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#94A3B8", marginTop: "0.25rem" }}>
                or click to browse · .csv, .xlsx
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <button onClick={onBack} style={ghostBtnStyle}>
          <ArrowLeft size={14} />
          Back
        </button>
        <button onClick={onNext} disabled={!file} style={file ? primaryBtnStyle : disabledBtnStyle}>
          Validate file
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Validate ─────────────────────────────────────────────────────────

type ValidateState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success"; result: ImportResult }
  | { phase: "error"; result: ImportResult }
  | { phase: "fatal"; message: string };

function Step3({
  file,
  onNext,
  onBack,
  onReplace,
}: {
  file: File;
  onNext: (result: ImportResult) => void;
  onBack: () => void;
  onReplace: () => void;
}) {
  const { getAccessTokenSilently } = useAuth0();
  const [state, setState] = useState<ValidateState>({ phase: "idle" });

  async function runValidation() {
    setState({ phase: "loading" });
    try {
      const token = await getAccessTokenSilently();
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_BASE}/import/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });

      if (res.status === 400) {
        const data = await res.json();
        setState({ phase: "fatal", message: data.detail ?? "File could not be parsed." });
        return;
      }

      const result: ImportResult = await res.json();

      if (result.status === "success") {
        setState({ phase: "success", result });
      } else {
        setState({ phase: "error", result });
      }
    } catch {
      setState({ phase: "fatal", message: "Network error — is the backend running?" });
    }
  }

  // Auto-run on mount
  if (state.phase === "idle") {
    runValidation();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.375rem" }}>
          Validating your file
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          Checking column names, required fields, and date formats. Nothing is
          saved yet.
        </p>
      </div>

      {/* Loading */}
      {state.phase === "loading" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "3rem",
            background: "#F8FAFC",
            borderRadius: "0.875rem",
            border: "1px solid #E2E8F0",
          }}
        >
          <Loader2 size={28} style={{ color: "#002147", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: "0.875rem", color: "#64748B" }}>
            Validating <strong>{file.name}</strong>…
          </span>
        </div>
      )}

      {/* Fatal parse error */}
      {state.phase === "fatal" && (
        <ErrorBox
          title="File could not be read"
          message={state.message}
          errors={[]}
          onReplace={onReplace}
          onRetry={runValidation}
        />
      )}

      {/* Row-level errors */}
      {state.phase === "error" && (
        <ErrorBox
          title={`${state.result.errors.length} issue${state.result.errors.length > 1 ? "s" : ""} found`}
          message="Fix the errors below in your file and re-upload."
          errors={state.result.errors}
          onReplace={onReplace}
          onRetry={runValidation}
        />
      )}

      {/* Success */}
      {state.phase === "success" && (
        <div
          style={{
            padding: "1.5rem",
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "0.875rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <CheckCircle2 size={22} style={{ color: "#16A34A", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#15803D" }}>
                Validation passed
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#16A34A", marginTop: "0.125rem" }}>
                {state.result.leases_created} lease{state.result.leases_created !== 1 ? "s" : ""} ready to import
              </div>
            </div>
          </div>

          {/* Summary pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {[
              { label: "Rows", value: state.result.leases_created },
            ].map((item) => (
              <span
                key={item.label}
                style={{
                  fontSize: "0.8125rem",
                  color: "#15803D",
                  background: "#DCFCE7",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  fontWeight: 500,
                }}
              >
                {item.value} {item.label.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <button onClick={onBack} style={ghostBtnStyle}>
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          onClick={() =>
            state.phase === "success" ? onNext(state.result) : undefined
          }
          disabled={state.phase !== "success"}
          style={state.phase === "success" ? primaryBtnStyle : disabledBtnStyle}
        >
          Create portfolio
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function ErrorBox({
  title,
  message,
  errors,
  onReplace,
  onRetry,
}: {
  title: string;
  message: string;
  errors: string[];
  onReplace: () => void;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #FECACA",
        borderRadius: "0.875rem",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "1rem 1.25rem",
          background: "#FEF2F2",
          borderBottom: errors.length > 0 ? "1px solid #FECACA" : "none",
        }}
      >
        <AlertCircle size={18} style={{ color: "#DC2626", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#991B1B" }}>{title}</div>
          <div style={{ fontSize: "0.8125rem", color: "#B91C1C", marginTop: "0.125rem" }}>{message}</div>
        </div>
      </div>

      {/* Error list */}
      {errors.length > 0 && (
        <div style={{ maxHeight: "240px", overflowY: "auto", background: "#FFFFFF" }}>
          {errors.map((err, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.625rem",
                padding: "0.625rem 1.25rem",
                borderBottom: i < errors.length - 1 ? "1px solid #FEF2F2" : "none",
              }}
            >
              <span style={{ fontSize: "0.6875rem", color: "#DC2626", fontWeight: 700, marginTop: "2px", flexShrink: 0 }}>
                •
              </span>
              <span style={{ fontSize: "0.8125rem", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                {err}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: "0.625rem",
          padding: "0.875rem 1.25rem",
          background: "#FEF2F2",
          borderTop: errors.length > 0 ? "1px solid #FECACA" : "none",
        }}
      >
        <button
          onClick={onReplace}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 0.875rem",
            background: "#FFFFFF",
            border: "1px solid #FECACA",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "#DC2626",
            cursor: "pointer",
          }}
        >
          <Upload size={12} />
          Upload fixed file
        </button>
        <button
          onClick={onRetry}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 0.875rem",
            background: "none",
            border: "1px solid #FECACA",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "#B91C1C",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Commit ───────────────────────────────────────────────────────────

type CommitState =
  | { phase: "confirm" }
  | { phase: "loading" }
  | { phase: "success"; result: ImportResult }
  | { phase: "partial"; result: ImportResult }
  | { phase: "fatal"; errors: string[] };

function Step4({
  file,
  validationResult,
  onBack,
}: {
  file: File;
  validationResult: ImportResult;
  onBack: () => void;
}) {
  const { getAccessTokenSilently } = useAuth0();
  const { setActivePortfolio } = usePortfolio();
  const navigate = useNavigate();

  const [state, setState] = useState<CommitState>({ phase: "confirm" });

  async function commit() {
    setState({ phase: "loading" });
    try {
      const token = await getAccessTokenSilently();
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_BASE}/import/portfolio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });

      if (res.status === 422) {
        const data = await res.json();
        const errors: string[] =
          typeof data.detail === "object" && data.detail.errors
            ? data.detail.errors
            : [String(data.detail)];
        setState({ phase: "fatal", errors });
        return;
      }

      const result: ImportResult = await res.json();

      if (result.status === "success" && result.errors.length === 0) {
        setState({ phase: "success", result });
        // Redirect after brief success display
        setTimeout(() => {
          const portfolio: Portfolio = {
            id: crypto.randomUUID(),
            name: file.name.replace(/\.(xlsx?|csv)$/i, ""),
            aircraft_count: result.aircraft_created,
            created_at: new Date().toISOString(),
          };
          setActivePortfolio(portfolio);
          navigate("/", { replace: true });
        }, 1800);
      } else if (result.leases_created > 0) {
        setState({ phase: "partial", result });
      } else {
        setState({ phase: "fatal", errors: result.errors });
      }
    } catch {
      setState({ phase: "fatal", errors: ["Network error — is the backend running?"] });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.375rem" }}>
          {state.phase === "success" ? "Portfolio created!" : "Ready to import"}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          {state.phase === "confirm" &&
            `${validationResult.leases_created} lease${validationResult.leases_created !== 1 ? "s" : ""} will be saved to your account. This cannot be undone.`}
          {state.phase === "loading" && "Writing your data — this may take a few seconds…"}
          {state.phase === "success" && "Redirecting you to your dashboard…"}
          {state.phase === "partial" && "Some rows were imported. Review the warnings below."}
          {state.phase === "fatal" && "Import failed. No data was saved."}
        </p>
      </div>

      {/* Confirm summary */}
      {state.phase === "confirm" && (
        <div
          style={{
            padding: "1.25rem",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "0.875rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Import summary
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {[
              { label: "File", value: file.name },
              { label: "Rows to import", value: String(validationResult.leases_created) },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "0.125rem" }}>{item.label}</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {state.phase === "loading" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "3rem",
            background: "#F8FAFC",
            borderRadius: "0.875rem",
            border: "1px solid #E2E8F0",
          }}
        >
          <Loader2 size={28} style={{ color: "#002147", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: "0.875rem", color: "#64748B" }}>Saving your portfolio…</span>
        </div>
      )}

      {/* Success */}
      {state.phase === "success" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "3rem",
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "0.875rem",
          }}
        >
          <div style={{ animation: "pop 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
            <style>{`@keyframes pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
            <CheckCircle2 size={48} style={{ color: "#16A34A" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#15803D" }}>
              {state.result.leases_created} lease{state.result.leases_created !== 1 ? "s" : ""} imported successfully
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#16A34A", marginTop: "0.25rem" }}>
              Taking you to your dashboard…
            </div>
          </div>
        </div>
      )}

      {/* Partial success */}
      {state.phase === "partial" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "1rem 1.25rem",
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: "0.625rem",
            }}
          >
            <AlertCircle size={16} style={{ color: "#D97706", flexShrink: 0 }} />
            <span style={{ fontSize: "0.875rem", color: "#92400E" }}>
              <strong>{state.result.leases_created} rows</strong> imported, but{" "}
              <strong>{state.result.errors.length}</strong> row
              {state.result.errors.length > 1 ? "s" : ""} had errors and were skipped.
            </span>
          </div>
          <div style={{ maxHeight: "180px", overflowY: "auto", background: "#FFFBEB", borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
            {state.result.errors.map((e, i) => (
              <div key={i} style={{ fontSize: "0.8125rem", color: "#92400E", padding: "0.25rem 0" }}>• {e}</div>
            ))}
          </div>
          <button
            onClick={() => {
              const portfolio: Portfolio = {
                id: crypto.randomUUID(),
                name: file.name.replace(/\.(xlsx?|csv)$/i, ""),
                aircraft_count: state.result.aircraft_created,
                created_at: new Date().toISOString(),
              };
              setActivePortfolio(portfolio);
              navigate("/", { replace: true });
            }}
            style={primaryBtnStyle}
          >
            Continue to dashboard anyway
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Fatal */}
      {state.phase === "fatal" && (
        <ErrorBox
          title="Import failed"
          message="No data was saved. Fix the errors and try again."
          errors={state.errors}
          onReplace={onBack}
          onRetry={commit}
        />
      )}

      {/* Footer nav */}
      {(state.phase === "confirm" || state.phase === "fatal") && (
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
          <button onClick={onBack} style={ghostBtnStyle}>
            <ArrowLeft size={14} />
            Back
          </button>
          {state.phase === "confirm" && (
            <button onClick={commit} style={primaryBtnStyle}>
              Create portfolio
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared button styles ─────────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.625rem 1.25rem",
  background: "#002147",
  border: "none",
  borderRadius: "0.5rem",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "#FFFFFF",
  cursor: "pointer",
};

const ghostBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.625rem 1rem",
  background: "none",
  border: "1px solid #E2E8F0",
  borderRadius: "0.5rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#475569",
  cursor: "pointer",
};

const disabledBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: "#E2E8F0",
  color: "#94A3B8",
  cursor: "not-allowed",
};

// ─── Root wizard shell ────────────────────────────────────────────────────────

interface UploadWizardProps {
  onClose: () => void;
}

export function UploadWizard({ onClose }: UploadWizardProps) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ImportResult | null>(null);

  function goTo(s: number) {
    setStep(s);
  }

  return (
    /* Backdrop */
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(6px)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "1.25rem",
          padding: "2rem 2.5rem",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 32px 80px rgba(0,0,0,0.22)",
          position: "relative",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.25rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#94A3B8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.25rem",
            borderRadius: "0.375rem",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "none")
          }
        >
          <X size={16} />
        </button>

        {/* Wizard title */}
        <div style={{ marginBottom: "1.75rem" }}>
          <button
            onClick={onClose}
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              background: "none", border: "none", padding: "0 0 10px",
              fontSize: "0.8125rem", fontWeight: 500, color: "#64748B",
              cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#002147")}
            onMouseLeave={e => (e.currentTarget.style.color = "#64748B")}
          >
            <ArrowLeft size={14} />
            Back to Portfolios
          </button>
          <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            New Portfolio
          </p>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.375rem", fontWeight: 700, color: "#0F172A", letterSpacing: "-0.02em" }}>
            Import from Excel / CSV
          </h1>
        </div>

        <StepIndicator current={step} />

        {step === 0 && <Step1 onNext={() => goTo(1)} />}
        {step === 1 && (
          <Step2
            file={file}
            onFile={setFile}
            onNext={() => goTo(2)}
            onBack={() => goTo(0)}
          />
        )}
        {step === 2 && file && (
          <Step3
            file={file}
            onNext={(result) => { setValidationResult(result); goTo(3); }}
            onBack={() => goTo(1)}
            onReplace={() => { setFile(null); goTo(1); }}
          />
        )}
        {step === 3 && file && validationResult && (
          <Step4
            file={file}
            validationResult={validationResult}
            onBack={() => goTo(2)}
          />
        )}
      </div>
    </div>
  );
}
