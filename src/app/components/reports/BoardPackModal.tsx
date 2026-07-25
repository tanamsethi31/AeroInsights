// src/app/components/reports/BoardPackModal.tsx
import * as React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { X, FileText, Table } from "lucide-react";
import { useCurrency } from "../../contexts/CurrencyContext";
import { generateReportPDF, generateReportXLSX } from "../../services/exportService";
import { usePortfolioData } from "../../hooks/usePortfolioData";
import { toExportData, toDashboardKPIs } from "../../lib/portfolioAdapters";
import { toKeyDateRows } from "../../lib/keyDatesAdapters";
import { useReportExports, type ReportFormat } from "../../hooks/useReportExports";

// ─── Section definitions ──────────────────────────────────────────────────────

interface Section {
  id: string;
  label: string;
  desc: string;
  pages: string;
  defaultOn: boolean;
}

const SECTIONS: Section[] = [
  { id: "exec-summary",  label: "Executive Summary",     desc: "Fleet overview, period highlights, key risks",          pages: "1–2", defaultOn: true },
  { id: "kpi-dashboard", label: "KPI Dashboard",         desc: "Fleet count, total ECL, watchlist, stage distribution",  pages: "1",   defaultOn: true },
  { id: "watchlist",     label: "Watchlist Highlights",  desc: "Red/amber lessees, trigger reasons, recommendations",    pages: "1–2", defaultOn: true },
  { id: "ecl-summary",   label: "ECL Provision Summary", desc: "IFRS 9 stage breakdown, migration, scenario ECL",        pages: "2–3", defaultOn: true },
  { id: "key-dates",     label: "Upcoming Expirations",  desc: "Critical and watch-band lease expiries",                 pages: "1",   defaultOn: true },
  { id: "payment-sched", label: "Payment Schedule",      desc: "12-month forward cashflow forecast by lessee",           pages: "1–2", defaultOn: true },
  { id: "scenario",      label: "Scenario Analysis",     desc: "Adverse / base / upside ECL scenarios",                  pages: "2",   defaultOn: false },
  { id: "jurisdiction",  label: "Jurisdiction Risk",     desc: "CTC compliance, enforceability, sanctions status",       pages: "2–3", defaultOn: false },
];

// Parse a pages string like "1–2" or "1" into its midpoint, rounded
function parsePagesEstimate(pages: string): number {
  if (pages.includes("–")) {
    const parts = pages.split("–").map(Number);
    return Math.round((parts[0] + parts[1]) / 2);
  }
  return Number(pages);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BoardPackModalProps {
  reportId: string;
  reportName: string;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BoardPackModal({ reportId, reportName, onClose }: BoardPackModalProps) {
  const { currency } = useCurrency();
  const { assets, lessees, leases, provisions } = usePortfolioData();
  const { getAccessTokenSilently } = useAuth0();

  // Export data (mirrors ReportFormatModal)
  const exportData = toExportData(assets, lessees, leases, provisions);

  // Live KPI data
  const kpis = toDashboardKPIs(assets, lessees, provisions);
  const keyDateRows = toKeyDateRows(leases, assets, lessees);
  const urgentCount = keyDateRows.filter(
    (r) => r.urgency === "critical" || r.urgency === "watch" || r.urgency === "expired"
  ).length;

  // Step state: 1 = configure, 2 = format
  const [step, setStep] = React.useState<1 | 2>(1);

  // Section selection state
  const [selected, setSelected] = React.useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of SECTIONS) init[s.id] = s.defaultOn;
    return init;
  });

  // Format state
  type Format = "pdf" | "xlsx";
  const [format, setFormat] = React.useState<Format>("pdf");

  // Download state
  const [downloading, setDownloading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  // Estimated page count
  const estPages = SECTIONS.filter((s) => selected[s.id]).reduce(
    (acc, s) => acc + parsePagesEstimate(s.pages),
    0
  );

  const selectedCount = Object.values(selected).filter(Boolean).length;

  function toggleSection(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // T-3.3b — persist board pack exports to Storage + audit_log.
  const { recordExport } = useReportExports();
  function makeOnBlob(fmt: ReportFormat) {
    return async (blob: Blob, filename: string): Promise<void> => {
      await recordExport({
        reportId,
        reportName,
        format: fmt,
        blob, filename,
        params: { currency, sections: Object.keys(selected).filter(k => selected[k]) },
      });
    };
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      if (format === "pdf") {
        let token: string | undefined;
        try { token = await getAccessTokenSilently(); } catch { /* falls back to deterministic summary */ }
        await generateReportPDF(reportId, currency, exportData, makeOnBlob("pdf"), token);
      }
      if (format === "xlsx") await generateReportXLSX(reportId, currency, exportData, makeOnBlob("xlsx"));
      setDone(true);
      setTimeout(onClose, 1200);
    } finally {
      setDownloading(false);
    }
  }

  // ─── Shared styles ──────────────────────────────────────────────────────────

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    zIndex: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const modalStyle: React.CSSProperties = {
    background: "#FFFFFF",
    borderRadius: "12px",
    width: "500px",
    maxHeight: "90vh",
    boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  // ─── Step indicator dots ────────────────────────────────────────────────────

  function StepDot({ n }: { n: 1 | 2 }) {
    const active = step === n;
    return (
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: active ? "#002147" : "transparent",
          border: `2px solid ${active ? "#002147" : "#CBD5E1"}`,
          transition: "all 200ms",
        }}
      />
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E2E8F0", borderLeft: "3px solid #002147" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A" }}>
                {step === 1 ? "Configure Board Pack" : "Choose Format"}
              </div>
              {/* Step dots */}
              <div style={{ display: "flex", gap: "4px", alignItems: "center", marginLeft: "4px" }}>
                <StepDot n={1} />
                <StepDot n={2} />
              </div>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
              {step === 1
                ? reportName
                : `${reportName} · ${selectedCount} section${selectedCount !== 1 ? "s" : ""} selected`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Step 1: Configure ── */}
        {step === 1 && (
          <>
            {/* Live KPI chips */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[
                { label: "Fleet", value: `${kpis.fleetCount} aircraft` },
                { label: "ECL",   value: `$${kpis.totalECLm.toFixed(1)}M` },
                { label: "Watchlist", value: `${kpis.watchlistRedCount} red` },
                { label: "Expirations", value: `${urgentCount} within 180d` },
              ].map((chip) => (
                <div
                  key={chip.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                  }}
                >
                  <span style={{ color: "#94A3B8", fontWeight: 500 }}>{chip.label}:</span>
                  <span style={{ color: "#0F172A", fontWeight: 600 }}>{chip.value}</span>
                </div>
              ))}
            </div>

            {/* Section list header */}
            <div style={{ padding: "12px 20px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>Sections to include</span>
              <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                Est. ~{estPages} page{estPages !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Scrollable section list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 8px" }}>
              {SECTIONS.map((section, i) => {
                const isOn = selected[section.id];
                return (
                  <div
                    key={section.id}
                    onClick={() => toggleSection(section.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: isOn ? "rgba(0,33,71,0.04)" : "transparent",
                      border: isOn ? "1px solid rgba(0,33,71,0.12)" : "1px solid transparent",
                      marginBottom: i < SECTIONS.length - 1 ? "6px" : "0",
                      transition: "all 150ms",
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "4px",
                        border: `2px solid ${isOn ? "#002147" : "#CBD5E1"}`,
                        background: isOn ? "#002147" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: "1px",
                        transition: "all 150ms",
                      }}
                    >
                      {isOn && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Label + desc */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: isOn ? "#002147" : "#0F172A" }}>
                        {section.label}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px", lineHeight: 1.45 }}>
                        {section.desc}
                      </div>
                    </div>

                    {/* Page count badge */}
                    <div style={{ fontSize: "0.6875rem", fontWeight: 500, color: "#94A3B8", whiteSpace: "nowrap", marginTop: "2px" }}>
                      {section.pages} {section.pages === "1" ? "page" : "pages"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                style={{ padding: "8px 16px", background: "transparent", color: "#475569", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "0.875rem", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={selectedCount === 0}
                style={{
                  padding: "8px 20px",
                  background: selectedCount === 0 ? "#94A3B8" : "#002147",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: selectedCount === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                Next: Choose Format
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Format ── */}
        {step === 2 && (
          <>
            {/* Currency notice */}
            <div style={{ padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#475569" }}>
              Figures will be formatted in <strong style={{ color: "#002147" }}>{currency}</strong>. Change currency via the header selector.
            </div>

            {/* Format options */}
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {(
                [
                  { id: "pdf" as Format,  Icon: FileText, label: "PDF",   ext: ".pdf",  desc: "Formatted, print-ready. Opens in any PDF viewer." },
                  { id: "xlsx" as Format, Icon: Table,    label: "Excel", ext: ".xlsx", desc: "Editable spreadsheet. Opens in Excel or Google Sheets." },
                ] as const
              ).map((f) => (
                <div
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    border: format === f.id ? "1.5px solid #002147" : "1px solid #E2E8F0",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: format === f.id ? "rgba(0,33,71,0.04)" : "#FFFFFF",
                    transition: "all 150ms",
                  }}
                >
                  <f.Icon size={20} style={{ color: format === f.id ? "#002147" : "#64748B", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>
                      {f.label} <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "#94A3B8" }}>{f.ext}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "1px" }}>{f.desc}</div>
                  </div>
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      border: `2px solid ${format === f.id ? "#002147" : "#CBD5E1"}`,
                      background: format === f.id ? "#002147" : "transparent",
                      flexShrink: 0,
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  color: "#475569",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M11 7H3M7 3L3 7l4 4" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>
              <button
                onClick={onClose}
                style={{ padding: "8px 16px", background: "transparent", color: "#475569", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "0.875rem", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading || done}
                style={{
                  padding: "8px 20px",
                  background: done ? "#15803D" : downloading ? "#94A3B8" : "#002147",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: downloading || done ? "not-allowed" : "pointer",
                  minWidth: "120px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  justifyContent: "center",
                }}
              >
                {done
                  ? "Downloaded!"
                  : downloading
                  ? "Building…"
                  : (
                    <>
                      Download
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M6.5 1v7M3.5 5.5l3 3 3-3M1.5 10h10" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
