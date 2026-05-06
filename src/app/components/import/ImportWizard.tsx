// src/app/components/import/ImportWizard.tsx
import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import {
  X,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Eye,
  Pencil,
  Check,
} from "lucide-react";
import { useOnboarding } from "../../contexts/OnboardingContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedRow {
  _rowIndex: number;
  lessee_name: string;
  country_code: string;
  msn: string;
  aircraft_type: string;
  registration: string;
  vintage: string;
  lease_start: string;
  lease_end: string;
  monthly_rent_usd: string;
  credit_rating: string;
  mr_rate: string;
  [key: string]: string | number;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  currentValue: string;
  fixedValue: string; // user-editable
}

export interface ValidationWarning {
  row: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  rows: ParsedRow[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
  lesseeCount: number;
  aircraftTypes: string[];
  dateRange: { from: string; to: string } | null;
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
  transition: "background 150ms ease-out",
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

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Template", "Upload", "Validate", "Preview", "Confirm"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "2rem" }}>
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              flex: i < STEP_LABELS.length - 1 ? 1 : undefined,
            }}
          >
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
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: active ? "#FFFFFF" : "#94A3B8", lineHeight: 1 }}>
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
            {i < STEP_LABELS.length - 1 && (
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

// ─── Template data ────────────────────────────────────────────────────────────

const TEMPLATE_SHEETS: Array<{
  name: string;
  description: string;
  headers: Array<{ col: string; required: boolean; example: string; note: string }>;
  sampleRows: string[][];
}> = [
  {
    name: "Lessees",
    description: "One row per lessee entity",
    headers: [
      { col: "lessee_name",   required: true,  example: "IndiGo Airlines",        note: "Legal entity name" },
      { col: "country_code",  required: true,  example: "IN",                     note: "ISO 3166-1 alpha-2" },
      { col: "credit_rating", required: false, example: "BB-",                    note: "S&P / Moody's" },
      { col: "legal_entity",  required: false, example: "InterGlobe Aviation Ltd", note: "Registered company name" },
      { col: "hq_city",       required: false, example: "Gurugram",               note: "HQ city" },
    ],
    sampleRows: [
      ["IndiGo Airlines", "IN", "BB-", "InterGlobe Aviation Ltd", "Gurugram"],
      ["Emirates", "AE", "A-", "Emirates Airline", "Dubai"],
    ],
  },
  {
    name: "Leases",
    description: "One row per lease (required sheet)",
    headers: [
      { col: "msn",                required: true,  example: "9218",             note: "Manufacturer Serial Number" },
      { col: "lessee_name",        required: true,  example: "IndiGo Airlines",  note: "Must match Lessees sheet" },
      { col: "lease_start",        required: true,  example: "2019-03-01",       note: "YYYY-MM-DD" },
      { col: "lease_end",          required: true,  example: "2028-03-01",       note: "YYYY-MM-DD" },
      { col: "monthly_rent_usd",   required: true,  example: "285000",           note: "USD, no commas" },
      { col: "aircraft_type",      required: true,  example: "A320neo",          note: "ICAO type designator" },
      { col: "registration",       required: false, example: "VT-IYC",           note: "Tail number" },
      { col: "security_deposit_usd", required: false, example: "570000",         note: "2× monthly rent typical" },
    ],
    sampleRows: [
      ["9218", "IndiGo Airlines", "2019-03-01", "2028-03-01", "285000", "A320neo", "VT-IYC", "570000"],
      ["62047", "Emirates", "2021-01-10", "2030-01-10", "1240000", "B777-300ER", "A6-ECE", "2480000"],
    ],
  },
  {
    name: "Aircraft",
    description: "One row per MSN — valuation and spec data",
    headers: [
      { col: "msn",               required: true,  example: "9218",          note: "Must match Leases sheet" },
      { col: "aircraft_type",     required: true,  example: "A320neo",       note: "ICAO type designator" },
      { col: "vintage",           required: true,  example: "2019",          note: "Year of manufacture" },
      { col: "engine_type",       required: false, example: "CFM LEAP-1A26", note: "Engine model" },
      { col: "current_value_usd", required: false, example: "28500000",      note: "Current market value USD" },
    ],
    sampleRows: [
      ["9218", "A320neo", "2019", "CFM LEAP-1A26", "28500000"],
      ["62047", "B777-300ER", "2021", "GE90-115B", "120000000"],
    ],
  },
  {
    name: "Payment_History",
    description: "36 months of payment events per lease",
    headers: [
      { col: "msn",           required: true,  example: "9218",            note: "Lease MSN" },
      { col: "lessee_name",   required: true,  example: "IndiGo Airlines", note: "Lessee" },
      { col: "payment_date",  required: true,  example: "2024-03-01",      note: "YYYY-MM-DD" },
      { col: "amount_usd",    required: true,  example: "285000",          note: "Amount received" },
      { col: "status",        required: true,  example: "on_time",         note: "on_time | late | partial | missed" },
      { col: "days_overdue",  required: false, example: "0",               note: "0 if on_time" },
    ],
    sampleRows: [
      ["9218", "IndiGo Airlines", "2024-03-01", "285000", "on_time", "0"],
      ["9218", "IndiGo Airlines", "2024-04-01", "285000", "late", "12"],
    ],
  },
  {
    name: "MR_Ledger",
    description: "Maintenance Reserve rate and balance per MSN",
    headers: [
      { col: "msn",                   required: true,  example: "9218",    note: "MSN" },
      { col: "period",                required: true,  example: "2024-Q1", note: "YYYY-QN" },
      { col: "mr_rate_usd_per_month", required: true,  example: "18000",   note: "Monthly accrual USD" },
      { col: "mr_balance_usd",        required: true,  example: "216000",  note: "Current balance USD" },
      { col: "last_event_type",       required: false, example: "C-check", note: "Last draw event" },
    ],
    sampleRows: [
      ["9218", "2024-Q1", "18000", "216000", "C-check"],
      ["62047", "2024-Q1", "45000", "540000", "Engine Shop Visit"],
    ],
  },
  {
    name: "SD_Records",
    description: "Security deposit records per lessee/MSN",
    headers: [
      { col: "lessee_name",    required: true,  example: "IndiGo Airlines", note: "Lessee" },
      { col: "msn",            required: true,  example: "9218",            note: "MSN" },
      { col: "sd_amount_usd",  required: true,  example: "570000",          note: "SD amount USD" },
      { col: "collection_date",required: true,  example: "2019-03-01",      note: "YYYY-MM-DD" },
      { col: "expiry_date",    required: false, example: "2028-03-01",      note: "YYYY-MM-DD" },
      { col: "form",           required: false, example: "Cash",            note: "Cash | Letter of Credit" },
    ],
    sampleRows: [
      ["IndiGo Airlines", "9218", "570000", "2019-03-01", "2028-03-01", "Cash"],
      ["Emirates", "62047", "2480000", "2021-01-10", "2030-01-10", "Letter of Credit"],
    ],
  },
];

function generateTemplate(): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of TEMPLATE_SHEETS) {
    const headers = sheet.headers.map((h) => h.col);
    const notes   = sheet.headers.map((h) => `[${h.required ? "REQUIRED" : "optional"}] ${h.note} (e.g. ${h.example})`);
    const data    = [headers, notes, ...sheet.sampleRows];
    const ws      = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"]   = headers.map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, "aeroinsights-import-template.xlsx");
}

// ─── Step 1: Template ─────────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const [downloaded, setDownloaded] = useState(false);

  function handleDownload() {
    generateTemplate();
    setDownloaded(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.375rem" }}>
          Download the import template
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          The template is an XLSX workbook with 6 sheets. Fill in your data, then upload it in the
          next step. Only the <strong>Leases</strong> sheet is required to start — the others enrich
          the analysis.
        </p>
      </div>

      {/* Sheet reference */}
      <div style={{ border: "1px solid #E2E8F0", borderRadius: "0.625rem", overflow: "hidden" }}>
        {TEMPLATE_SHEETS.map((sheet, i) => (
          <div
            key={sheet.name}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "1rem",
              padding: "0.875rem 1.25rem",
              borderBottom: i < TEMPLATE_SHEETS.length - 1 ? "1px solid #F1F5F9" : "none",
              background: i % 2 === 0 ? "#FFFFFF" : "#FAFBFC",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                background: "#EFF6FF",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FileSpreadsheet size={16} style={{ color: "#002147" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>
                {sheet.name}{" "}
                {sheet.name === "Leases" && (
                  <span style={{ fontSize: "0.6875rem", background: "#FEF2F2", color: "#DC2626", padding: "0.125rem 0.375rem", borderRadius: "9999px", fontWeight: 700, marginLeft: "0.25rem" }}>
                    Required
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.125rem" }}>
                {sheet.description} · {sheet.headers.filter((h) => h.required).length} required fields
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", maxWidth: "280px", justifyContent: "flex-end" }}>
              {sheet.headers.slice(0, 4).map((h) => (
                <code
                  key={h.col}
                  style={{
                    fontSize: "0.6875rem",
                    fontFamily: "monospace",
                    color: h.required ? "#002147" : "#64748B",
                    background: h.required ? "#EFF6FF" : "#F8FAFC",
                    padding: "0.1rem 0.35rem",
                    borderRadius: "0.25rem",
                    border: `1px solid ${h.required ? "#BFDBFE" : "#E2E8F0"}`,
                  }}
                >
                  {h.col}
                </code>
              ))}
              {sheet.headers.length > 4 && (
                <span style={{ fontSize: "0.6875rem", color: "#94A3B8", padding: "0.1rem 0.35rem" }}>
                  +{sheet.headers.length - 4} more
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={handleDownload}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 1.25rem",
            background: downloaded ? "#F0FDF4" : "#F8FAFC",
            border: `1px solid ${downloaded ? "#BBF7D0" : "#E2E8F0"}`,
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: downloaded ? "#15803D" : "#0F172A",
            cursor: "pointer",
            transition: "all 150ms ease-out",
          }}
        >
          {downloaded ? <Check size={14} /> : <Download size={14} />}
          {downloaded ? "Downloaded!" : "Download template (.xlsx)"}
        </button>
        <button onClick={onNext} style={primaryBtnStyle}>
          I have my file ready
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Upload ───────────────────────────────────────────────────────────

function Step2({
  file,
  onFile,
  onNext,
  onBack,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function acceptFile(f: File) {
    const valid = /\.(csv|xlsx|xls)$/i.test(f.name);
    if (valid) onFile(f);
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) acceptFile(f);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onFile],
  );

  function fmtBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1_048_576).toFixed(1)} MB`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.375rem" }}>
          Upload your file
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          Drop the completed template here. We accept <strong>.xlsx</strong> and{" "}
          <strong>.csv</strong> files up to 10 MB.
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
          transition: "border-color 150ms ease-out, background 150ms ease-out",
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
            if (f) acceptFile(f);
          }}
        />
        {file ? (
          <>
            <div style={{ width: "52px", height: "52px", background: "#DCFCE7", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileSpreadsheet size={24} style={{ color: "#16A34A" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>{file.name}</div>
              <div style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: "0.25rem" }}>{fmtBytes(file.size)}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              style={{ fontSize: "0.8125rem", color: "#94A3B8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Replace file
            </button>
          </>
        ) : (
          <>
            <div style={{ width: "52px", height: "52px", background: "#F1F5F9", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Upload size={24} style={{ color: "#94A3B8" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>{dragging ? "Drop to upload" : "Drag your file here"}</div>
              <div style={{ fontSize: "0.8125rem", color: "#94A3B8", marginTop: "0.25rem" }}>or click to browse · .csv .xlsx</div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <button onClick={onBack} style={ghostBtnStyle}>
          <ArrowLeft size={14} /> Back
        </button>
        <button
          onClick={onNext}
          disabled={!file}
          style={file ? primaryBtnStyle : disabledBtnStyle}
        >
          Validate file <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Validation logic ─────────────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  "lessee_name", "country_code", "msn", "aircraft_type",
  "vintage", "lease_start", "lease_end", "monthly_rent_usd",
];

const KNOWN_AIRCRAFT_TYPES = new Set([
  "A318", "A319", "A320", "A320neo", "A321", "A321neo", "A321XLR",
  "A330-200", "A330-300", "A330-900neo", "A350-900", "A350-1000", "A380-800",
  "B737-700", "B737-800", "B737-900", "B737 MAX 7", "B737 MAX 8", "B737 MAX 9", "B737 MAX 10",
  "B747-400", "B747-8", "B777-200ER", "B777-300ER", "B777X", "B777-9",
  "B787-8", "B787-9", "B787-10",
  "E170", "E175", "E190", "E195", "E190-E2", "E195-E2",
  "ATR72-500", "ATR72-600", "ATR42-600",
  "Q400", "CRJ-200", "CRJ-700", "CRJ-900", "CRJ-1000",
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function parseAndValidate(file: File): Promise<ValidationResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", dateNF: "yyyy-mm-dd" });

  // Prefer "Leases" sheet; fall back to the first sheet
  const sheetName = wb.SheetNames.includes("Leases") ? "Leases" : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  });

  const rows: ParsedRow[] = raw.map((r, i) => ({
    _rowIndex: i + 2, // 1-indexed data rows (row 1 = header)
    lessee_name:      String(r["lessee_name"] ?? ""),
    country_code:     String(r["country_code"] ?? ""),
    msn:              String(r["msn"] ?? ""),
    aircraft_type:    String(r["aircraft_type"] ?? ""),
    registration:     String(r["registration"] ?? ""),
    vintage:          String(r["vintage"] ?? ""),
    lease_start:      String(r["lease_start"] ?? ""),
    lease_end:        String(r["lease_end"] ?? ""),
    monthly_rent_usd: String(r["monthly_rent_usd"] ?? ""),
    credit_rating:    String(r["credit_rating"] ?? ""),
    mr_rate:          String(r["mr_rate"] ?? ""),
  }));

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  rows.forEach((row) => {
    // Missing required fields
    REQUIRED_FIELDS.forEach((field) => {
      if (!row[field as keyof ParsedRow]) {
        errors.push({
          row: row._rowIndex,
          field,
          message: `${field} is required`,
          currentValue: "",
          fixedValue: "",
        });
      }
    });

    // Date format
    (["lease_start", "lease_end"] as const).forEach((field) => {
      const val = row[field];
      if (val && !DATE_PATTERN.test(val)) {
        errors.push({
          row: row._rowIndex,
          field,
          message: `${field} must be YYYY-MM-DD (got "${val}")`,
          currentValue: val,
          fixedValue: val,
        });
      }
    });

    // Unknown aircraft type
    if (row.aircraft_type && !KNOWN_AIRCRAFT_TYPES.has(row.aircraft_type)) {
      errors.push({
        row: row._rowIndex,
        field: "aircraft_type",
        message: `Unknown aircraft type "${row.aircraft_type}" — check ICAO designator`,
        currentValue: row.aircraft_type,
        fixedValue: row.aircraft_type,
      });
    }

    // Warnings
    if (!row.msn) {
      warnings.push({ row: row._rowIndex, field: "msn", message: "Missing MSN — ECL aircraft-value lookup will be estimated" });
    }
    if (row.mr_rate === "0" || row.mr_rate === "") {
      warnings.push({ row: row._rowIndex, field: "mr_rate", message: "MR rate = 0 — maintenance reserve calculations will be skipped" });
    }
  });

  // Summary stats
  const lessees = new Set(rows.map((r) => r.lessee_name).filter(Boolean));
  const aircraftTypes = [...new Set(rows.map((r) => r.aircraft_type).filter(Boolean))];
  const dates = rows
    .flatMap((r) => [r.lease_start, r.lease_end])
    .filter((d) => DATE_PATTERN.test(d))
    .sort();
  const dateRange =
    dates.length >= 2 ? { from: dates[0], to: dates[dates.length - 1] } : null;

  return { rows, errors, warnings, lesseeCount: lessees.size, aircraftTypes, dateRange };
}

// ─── Step 3: Validate ─────────────────────────────────────────────────────────

type ValidatePhase =
  | { phase: "loading" }
  | { phase: "done"; result: ValidationResult }
  | { phase: "error"; message: string };

function Step3({
  file,
  onNext,
  onBack,
  onReplace,
}: {
  file: File;
  onNext: (result: ValidationResult) => void;
  onBack: () => void;
  onReplace: () => void;
}) {
  const [phase, setPhase] = useState<ValidatePhase>({ phase: "loading" });
  const [fixes, setFixes] = useState<Record<string, string>>({});

  useEffect(() => {
    parseAndValidate(file)
      .then((result) => setPhase({ phase: "done", result }))
      .catch((err: unknown) => setPhase({ phase: "error", message: String(err) }));
  }, [file]);

  function fixKey(err: ValidationError) {
    return `${err.row}:${err.field}`;
  }

  const canProceed = phase.phase === "done" && phase.result.errors.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.375rem" }}>
          Validation results
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          Nothing has been saved yet. Fix any errors below before proceeding.
        </p>
      </div>

      {/* Loading */}
      {phase.phase === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "3rem", background: "#F8FAFC", borderRadius: "0.875rem", border: "1px solid #E2E8F0" }}>
          <Loader2 size={28} style={{ color: "#002147", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: "0.875rem", color: "#64748B" }}>Parsing <strong>{file.name}</strong>…</span>
        </div>
      )}

      {/* Parse error */}
      {phase.phase === "error" && (
        <div style={{ padding: "1rem 1.25rem", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "0.875rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertCircle size={16} style={{ color: "#DC2626" }} />
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#991B1B" }}>File could not be read</span>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "#B91C1C", margin: "0.5rem 0 0" }}>{phase.message}</p>
          <button onClick={onReplace} style={{ marginTop: "0.75rem", ...ghostBtnStyle, borderColor: "#FECACA", color: "#DC2626" }}>
            <Upload size={12} /> Upload different file
          </button>
        </div>
      )}

      {/* Results */}
      {phase.phase === "done" && (
        <>
          {/* Summary row */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {[
              { label: "Rows",     value: phase.result.rows.length,     color: "#002147", bg: "#EFF6FF" },
              { label: "Lessees",  value: phase.result.lesseeCount,     color: "#002147", bg: "#EFF6FF" },
              { label: "Errors",   value: phase.result.errors.length,   color: phase.result.errors.length > 0 ? "#DC2626" : "#15803D", bg: phase.result.errors.length > 0 ? "#FEF2F2" : "#F0FDF4" },
              { label: "Warnings", value: phase.result.warnings.length, color: "#B45309", bg: "#FFFBEB" },
            ].map((s) => (
              <div key={s.label} style={{ padding: "0.625rem 1rem", background: s.bg, borderRadius: "0.625rem", display: "flex", flexDirection: "column", gap: "0.125rem", minWidth: "80px" }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontSize: "0.6875rem", color: "#64748B", fontWeight: 500 }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Errors with inline editor */}
          {phase.result.errors.length > 0 && (
            <div style={{ border: "1px solid #FECACA", borderRadius: "0.75rem", overflow: "hidden" }}>
              <div style={{ padding: "0.75rem 1.25rem", background: "#FEF2F2", borderBottom: "1px solid #FECACA", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertCircle size={14} style={{ color: "#DC2626" }} />
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#991B1B" }}>
                  {phase.result.errors.length} error{phase.result.errors.length > 1 ? "s" : ""} — fix to proceed
                </span>
              </div>
              <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                {phase.result.errors.map((err, i) => {
                  const key = fixKey(err);
                  const currentFix = fixes[key] ?? err.fixedValue;
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 160px", gap: "0.75rem", alignItems: "center", padding: "0.625rem 1.25rem", borderBottom: i < phase.result.errors.length - 1 ? "1px solid #FEF2F2" : "none" }}>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8" }}>Row {err.row}</span>
                      <div>
                        <code style={{ fontSize: "0.75rem", color: "#002147", background: "#EFF6FF", padding: "0.125rem 0.375rem", borderRadius: "0.25rem" }}>{err.field}</code>
                        <span style={{ fontSize: "0.75rem", color: "#475569", marginLeft: "0.5rem" }}>{err.message}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <Pencil size={11} style={{ color: "#94A3B8", flexShrink: 0 }} />
                        <input
                          value={currentFix}
                          placeholder="Fix value"
                          onChange={(e) => setFixes((f) => ({ ...f, [key]: e.target.value }))}
                          style={{ flex: 1, border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem", outline: "none", minWidth: 0 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "0.75rem 1.25rem", background: "#FEF2F2", borderTop: "1px solid #FECACA" }}>
                <span style={{ fontSize: "0.75rem", color: "#B91C1C" }}>
                  Fix values inline above, then re-upload a corrected file — or upload a new file.
                </span>
                <button onClick={onReplace} style={{ marginLeft: "0.75rem", fontSize: "0.75rem", color: "#DC2626", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Upload fixed file
                </button>
              </div>
            </div>
          )}

          {/* Warnings */}
          {phase.result.warnings.length > 0 && (
            <div style={{ border: "1px solid #FDE68A", borderRadius: "0.75rem", overflow: "hidden" }}>
              <div style={{ padding: "0.75rem 1.25rem", background: "#FFFBEB", borderBottom: "1px solid #FDE68A", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertTriangle size={14} style={{ color: "#D97706" }} />
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#92400E" }}>
                  {phase.result.warnings.length} warning{phase.result.warnings.length > 1 ? "s" : ""} — optional to fix
                </span>
              </div>
              <div style={{ maxHeight: "140px", overflowY: "auto" }}>
                {phase.result.warnings.map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.5rem 1.25rem", borderBottom: i < phase.result.warnings.length - 1 ? "1px solid #FFFBEB" : "none" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", marginTop: "2px" }}>Row {w.row}</span>
                    <span style={{ fontSize: "0.75rem", color: "#92400E" }}>{w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All clear */}
          {phase.result.errors.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem 1.25rem", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "0.75rem" }}>
              <CheckCircle2 size={18} style={{ color: "#16A34A" }} />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#15803D" }}>Validation passed — ready to preview</div>
                <div style={{ fontSize: "0.8125rem", color: "#16A34A", marginTop: "0.125rem" }}>{phase.result.rows.length} rows · {phase.result.lesseeCount} lessees · {phase.result.aircraftTypes.length} aircraft types</div>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <button onClick={onBack} style={ghostBtnStyle}><ArrowLeft size={14} /> Back</button>
        <button
          onClick={() => phase.phase === "done" && canProceed && onNext(phase.result)}
          disabled={!canProceed}
          style={canProceed ? primaryBtnStyle : disabledBtnStyle}
        >
          Preview data <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Preview ──────────────────────────────────────────────────────────

function Step4({
  result,
  onNext,
  onBack,
}: {
  result: ValidationResult;
  onNext: () => void;
  onBack: () => void;
}) {
  const sample = result.rows.slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.375rem" }}>
          Preview parsed data
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          Review a sample before committing. Nothing is saved until the next step.
        </p>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
        {[
          { label: "Total Leases",   value: result.rows.length },
          { label: "Lessees",        value: result.lesseeCount },
          { label: "Aircraft Types", value: result.aircraftTypes.length },
          { label: "Date Range",     value: result.dateRange ? `${result.dateRange.from.slice(0, 7)} → ${result.dateRange.to.slice(0, 7)}` : "—" },
        ].map((kpi) => (
          <div key={kpi.label} style={{ padding: "1rem", background: "#F8FAFC", borderRadius: "0.625rem", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.375rem", fontWeight: 500 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Aircraft types detected */}
      <div>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
          Aircraft types detected
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {result.aircraftTypes.map((t) => (
            <code key={t} style={{ fontSize: "0.8125rem", background: "#EFF6FF", color: "#002147", padding: "0.25rem 0.625rem", borderRadius: "0.375rem", border: "1px solid #BFDBFE" }}>
              {t}
            </code>
          ))}
        </div>
      </div>

      {/* Sample table */}
      <div style={{ border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1.25rem", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <Eye size={14} style={{ color: "#94A3B8" }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>First {sample.length} of {result.rows.length} rows</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Lessee", "Country", "MSN", "Type", "Vintage", "Lease Start", "Lease End", "Rent/mo"].map((h) => (
                  <th key={h} style={{ padding: "0.5rem 0.875rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < sample.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                  <td style={{ padding: "0.5rem 0.875rem", fontWeight: 500, color: "#0F172A" }}>{row.lessee_name || "—"}</td>
                  <td style={{ padding: "0.5rem 0.875rem", color: "#64748B" }}>{row.country_code || "—"}</td>
                  <td style={{ padding: "0.5rem 0.875rem", color: "#64748B", fontFamily: "monospace" }}>{row.msn || "—"}</td>
                  <td style={{ padding: "0.5rem 0.875rem", color: "#64748B" }}>{row.aircraft_type || "—"}</td>
                  <td style={{ padding: "0.5rem 0.875rem", color: "#64748B" }}>{row.vintage || "—"}</td>
                  <td style={{ padding: "0.5rem 0.875rem", color: "#64748B", fontVariantNumeric: "tabular-nums" }}>{row.lease_start || "—"}</td>
                  <td style={{ padding: "0.5rem 0.875rem", color: "#64748B", fontVariantNumeric: "tabular-nums" }}>{row.lease_end || "—"}</td>
                  <td style={{ padding: "0.5rem 0.875rem", color: "#64748B", fontVariantNumeric: "tabular-nums" }}>
                    {row.monthly_rent_usd ? `$${Number(row.monthly_rent_usd).toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        <button onClick={onBack} style={ghostBtnStyle}><ArrowLeft size={14} /> Back</button>
        <button onClick={onNext} style={primaryBtnStyle}>Confirm &amp; run ECL <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

// ─── Step 5: Confirm + ECL simulation ────────────────────────────────────────

const ECL_PHASES = [
  "Parsing lease register…",
  "Classifying Stage 1 / 2 / 3 exposures…",
  "Running PD curves (Baseline · Adverse · Severe)…",
  "Applying scenario weights (60 / 25 / 15)…",
  "Computing LGD and EAD adjustments…",
  "Finalising ECL output…",
];

function Step5({
  result,
  onBack,
}: {
  result: ValidationResult;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const { markImportComplete } = useOnboarding();

  type RunPhase = "confirm" | "running" | "done";
  const [phase, setPhase] = useState<RunPhase>("confirm");
  const [eclPhaseIndex, setEclPhaseIndex] = useState(0);
  const [eclValue, setEclValue] = useState<string | null>(null);

  function startECL() {
    setPhase("running");
    setEclPhaseIndex(0);

    let idx = 0;
    const interval = setInterval(() => {
      idx += 1;
      if (idx < ECL_PHASES.length) {
        setEclPhaseIndex(idx);
      } else {
        clearInterval(interval);
        // Deterministic fake ECL: ~1.7% of estimated book value
        const totalRent = result.rows.reduce(
          (sum, r) => sum + (Number(r.monthly_rent_usd) || 0),
          0,
        );
        const estimatedBook = totalRent * 12 * 8; // rough 8yr remaining × annual rent
        const fakeECL = ((estimatedBook * 0.017) / 1_000_000).toFixed(1);
        setEclValue(fakeECL);
        setPhase("done");
        markImportComplete(result.rows.length, result.lesseeCount);
      }
    }, 900);
  }

  const progress =
    phase === "running"
      ? Math.round(((eclPhaseIndex + 1) / ECL_PHASES.length) * 100)
      : phase === "done"
        ? 100
        : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.375rem" }}>
          {phase === "done" ? "Import complete!" : "Confirm & run baseline ECL"}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0, lineHeight: 1.6 }}>
          {phase === "confirm" && `${result.rows.length} leases · ${result.lesseeCount} lessees will be committed. A Baseline ECL run starts immediately.`}
          {phase === "running" && "Importing data and computing initial ECL — this takes about 15 seconds…"}
          {phase === "done" && "Your portfolio is live. Review the initial ECL output below, then complete your onboarding checklist on the Dashboard."}
        </p>
      </div>

      {/* Confirm summary */}
      {phase === "confirm" && (
        <div style={{ padding: "1.25rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.875rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            Import summary
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            {[
              { label: "Leases",        value: result.rows.length },
              { label: "Lessees",       value: result.lesseeCount },
              { label: "Aircraft types",value: result.aircraftTypes.length },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "0.125rem" }}>{item.label}</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Running */}
      {phase === "running" && (
        <div style={{ padding: "1.5rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.875rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Loader2 size={20} style={{ color: "#002147", animation: "spin 1s linear infinite", flexShrink: 0 }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#0F172A" }}>
              {ECL_PHASES[eclPhaseIndex]}
            </span>
          </div>
          <div style={{ background: "#E2E8F0", borderRadius: "9999px", height: "6px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                background: "#002147",
                borderRadius: "9999px",
                width: `${progress}%`,
                transition: "width 800ms cubic-bezier(0.23,1,0.32,1)",
              }}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {ECL_PHASES.map((p, i) => (
              <span
                key={i}
                style={{
                  fontSize: "0.6875rem",
                  padding: "0.125rem 0.5rem",
                  borderRadius: "9999px",
                  background: i < eclPhaseIndex ? "#DCFCE7" : i === eclPhaseIndex ? "#EFF6FF" : "#F1F5F9",
                  color: i < eclPhaseIndex ? "#15803D" : i === eclPhaseIndex ? "#002147" : "#94A3B8",
                  fontWeight: i === eclPhaseIndex ? 600 : 400,
                  transition: "all 300ms ease-out",
                }}
              >
                {i < eclPhaseIndex ? "✓" : i === eclPhaseIndex ? "●" : "○"} Phase {i + 1}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Done */}
      {phase === "done" && eclValue && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ padding: "1.5rem", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "0.875rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <div style={{ animation: "pop 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
              <style>{`@keyframes pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
              <CheckCircle2 size={40} style={{ color: "#16A34A", flexShrink: 0 }} />
            </div>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#15803D" }}>
                Baseline ECL: <strong>${eclValue}M</strong>
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#16A34A", marginTop: "0.25rem" }}>
                {result.rows.length} leases · {result.lesseeCount} lessees · Scenario weights: 60/25/15
              </div>
            </div>
          </div>
          <div style={{ padding: "1rem 1.25rem", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "0.75rem" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#92400E", marginBottom: "0.25rem" }}>Next: Complete your onboarding checklist</div>
            <div style={{ fontSize: "0.8125rem", color: "#B45309" }}>
              Your Dashboard now shows a step-by-step checklist — configure SICR triggers, set scenario weights, and review flagged lessees.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
        {phase === "confirm" && (
          <>
            <button onClick={onBack} style={ghostBtnStyle}><ArrowLeft size={14} /> Back</button>
            <button onClick={startECL} style={primaryBtnStyle}>
              Import &amp; run ECL <ArrowRight size={14} />
            </button>
          </>
        )}
        {phase === "done" && (
          <button onClick={() => navigate("/")} style={{ ...primaryBtnStyle, marginLeft: "auto" }}>
            Go to Dashboard <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Root shell ───────────────────────────────────────────────────────────────

interface ImportWizardProps {
  onClose: () => void;
}

export function ImportWizard({ onClose }: ImportWizardProps) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  return (
    /* Backdrop */
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(6px)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "1.25rem",
          padding: "2rem 2.5rem",
          width: "100%",
          maxWidth: "800px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 32px 80px rgba(0,0,0,0.22)",
          position: "relative",
        }}
      >
        {/* Close button */}
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
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
        >
          <X size={16} />
        </button>

        {/* Title */}
        <div style={{ marginBottom: "1.75rem" }}>
          <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Data Sources
          </p>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.375rem", fontWeight: 700, color: "#0F172A", letterSpacing: "-0.02em" }}>
            Import New Portfolio
          </h1>
        </div>

        <StepIndicator current={step} />

        {step === 0 && (
          <Step1 onNext={() => setStep(1)} />
        )}
        {step === 1 && (
          <Step2
            file={file}
            onFile={setFile}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && file && (
          <Step3
            file={file}
            onNext={(result) => { setValidation(result); setStep(3); }}
            onBack={() => setStep(1)}
            onReplace={() => { setFile(null); setStep(1); }}
          />
        )}
        {step === 3 && validation && (
          <Step4
            result={validation}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && validation && (
          <Step5
            result={validation}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}

