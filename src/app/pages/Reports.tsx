import * as React from "react";
import { useState, useEffect } from "react";
import { useLocation } from "react-router";
import { Card } from "../components/ui/Card";

const PATH_TAB: Record<string, string> = {
  "/reports/templates":  "Report Templates",
  "/reports/scheduled":  "Scheduled Reports",
  "/reports/export-log": "Export History",
};
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { Download, FileText, Table, FileJson, File, Mail, Clock, Calendar, Search, ClipboardList, BarChart3, Scale, AlertTriangle, Globe } from "lucide-react";
import { ReportFormatModal } from "../components/reports/ReportFormatModal";

const REPORT_ICON_MAP: Record<string, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  search:       Search,
  board:        ClipboardList,
  portfolio:    BarChart3,
  ecl:          Scale,
  watchlist:    AlertTriangle,
  jurisdiction: Globe,
};

const reportTemplates = [
  {
    id: "RPT-001",
    name: "Auditor Evidence Pack",
    description: "All model inputs, formulas, source data hashes, assumptions. Required for IFRS 9 audit. Timestamped and scenario-stamped.",
    formats: ["PDF", "JSON"],
    lastGenerated: "29 Apr 2026, 09:20",
    size: "4.2 MB",
    category: "Audit",
    iconKey: "search",
  },
  {
    id: "RPT-002",
    name: "Board Pack — Q1 2026",
    description: "Executive summary, KPI strip, watchlist highlights, scenario analysis results, key recommendations for board-level review.",
    formats: ["PDF", "XLSX"],
    lastGenerated: "29 Apr 2026, 09:25",
    size: "2.8 MB",
    category: "Board",
    iconKey: "board",
  },
  {
    id: "RPT-003",
    name: "Portfolio Register Export",
    description: "Full lease register with all fields: lessee, aircraft, financials, ECL, stage. Sortable and filterable.",
    formats: ["XLSX", "CSV", "JSON"],
    lastGenerated: "28 Apr 2026, 17:00",
    size: "1.1 MB",
    category: "Portfolio",
    iconKey: "portfolio",
  },
  {
    id: "RPT-004",
    name: "ECL Disclosure Pack",
    description: "IFRS 9 paragraph 35H/35I disclosures. Stage migration matrix, sensitivity analysis, scenario weights, judgment disclosures.",
    formats: ["PDF", "XLSX"],
    lastGenerated: "29 Apr 2026, 09:22",
    size: "3.4 MB",
    category: "Audit",
    iconKey: "ecl",
  },
  {
    id: "RPT-005",
    name: "Watchlist Report",
    description: "Current watchlist with all Red/Amber lessees, trigger reasons, evidence, recommended actions, days overdue.",
    formats: ["PDF", "XLSX"],
    lastGenerated: "29 Apr 2026, 09:15",
    size: "0.8 MB",
    category: "Risk",
    iconKey: "watchlist",
  },
  {
    id: "RPT-006",
    name: "Jurisdiction Risk Summary",
    description: "CTC compliance scores, enforceability index, repossession statistics, sanctions status across 80+ jurisdictions.",
    formats: ["PDF", "XLSX"],
    lastGenerated: "25 Apr 2026, 14:00",
    size: "1.6 MB",
    category: "Jurisdiction",
    iconKey: "jurisdiction",
  },
];

const scheduledReports = [
  { id: "SCHED-001", name: "Weekly Watchlist Digest", frequency: "Weekly", day: "Monday", time: "07:00", recipients: ["risk@firm.com", "cfo@firm.com"], status: "active", nextRun: "4 May 2026" },
  { id: "SCHED-002", name: "Monthly ECL Summary", frequency: "Monthly", day: "1st", time: "08:00", recipients: ["accounting@firm.com", "audit@firm.com"], status: "active", nextRun: "1 May 2026" },
  { id: "SCHED-003", name: "Quarterly Board Pack", frequency: "Quarterly", day: "Last Friday", time: "09:00", recipients: ["board@firm.com", "cfo@firm.com", "cro@firm.com"], status: "active", nextRun: "30 Jun 2026" },
  { id: "SCHED-004", name: "Daily Scenario Digest", frequency: "Daily", day: "Weekdays", time: "06:30", recipients: ["risk@firm.com"], status: "paused", nextRun: "Paused" },
];

const recentExports = [
  { id: "EXP-2468", report: "Auditor Evidence Pack", format: "PDF+JSON", date: "29 Apr 2026, 09:20", user: "Alex Johnson", size: "4.2 MB" },
  { id: "EXP-2467", report: "Board Pack — Q1 2026", format: "PDF", date: "29 Apr 2026, 09:25", user: "John Williams", size: "2.8 MB" },
  { id: "EXP-2466", report: "Portfolio Register", format: "XLSX", date: "28 Apr 2026, 17:00", user: "Alex Johnson", size: "1.1 MB" },
  { id: "EXP-2465", report: "ECL Disclosure Pack", format: "PDF", date: "28 Apr 2026, 14:30", user: "Sarah Chen", size: "3.4 MB" },
  { id: "EXP-2464", report: "Watchlist Report", format: "PDF", date: "27 Apr 2026, 16:00", user: "John Williams", size: "0.8 MB" },
];

const formatIcons: Record<string, React.ReactNode> = {
  PDF: <File size={12} />,
  XLSX: <Table size={12} />,
  CSV: <Table size={12} />,
  JSON: <FileJson size={12} />,
};

const tabs = ["Report Templates", "Scheduled Reports", "Export History"];

export default function Reports() {
  const { pathname } = useLocation();
  const [activeTab, setActiveTab] = useState(() => PATH_TAB[pathname] ?? "Report Templates");
  useEffect(() => { setActiveTab(PATH_TAB[pathname] ?? "Report Templates"); }, [pathname]);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [formatModal, setFormatModal] = React.useState<{ id: string; name: string } | null>(null);

  const categories = ["All", "Audit", "Board", "Portfolio", "Risk", "Jurisdiction"];
  const filtered = categoryFilter === "All" ? reportTemplates : reportTemplates.filter(r => r.category === categoryFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Reports"
        subtitle="Exports, auditor packs, board-pack templates, scheduled delivery"
      />

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #E2E8F0", display: "flex" }}>
        {tabs.map((tab) => (
          <button key={tab} className="tab-btn" onClick={() => setActiveTab(tab)} style={{ padding: "0.75rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, border: "none", borderBottom: activeTab === tab ? "2px solid #002147" : "2px solid transparent", background: "transparent", color: activeTab === tab ? "#002147" : "#475569", cursor: "pointer", marginBottom: "-1px" }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Templates */}
      {activeTab === "Report Templates" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500, border: "1px solid", borderRadius: "9999px", cursor: "pointer", background: categoryFilter === cat ? "#002147" : "transparent", color: categoryFilter === cat ? "#FFFFFF" : "#475569", borderColor: categoryFilter === cat ? "#002147" : "#E2E8F0" }}>
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
            {filtered.map(report => (
              <div key={report.id} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div style={{
                  width: "40px", height: "40px", borderRadius: "10px",
                  background: "rgba(0,33,71,0.07)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {React.createElement(REPORT_ICON_MAP[report.iconKey] ?? BarChart3, { size: 20, style: { color: "#002147" } })}
                </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>{report.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.125rem" }}>{report.category} · {report.size}</div>
                  </div>
                  <span style={{ fontSize: "0.625rem", fontWeight: 500, color: "#0369A1", background: "rgba(3,105,161,0.08)", padding: "0.125rem 0.375rem", borderRadius: "0.5rem", border: "1px solid rgba(3,105,161,0.2)", whiteSpace: "nowrap" }}>{report.id}</span>
                </div>

                <p style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>{report.description}</p>

                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                  {report.formats.map(fmt => (
                    <span key={fmt} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 500, color: "#475569", background: "#F4F5F7", padding: "0.25rem 0.5rem", borderRadius: "0.5rem", border: "1px solid #E2E8F0" }}>
                      {formatIcons[fmt]} {fmt}
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.5rem", borderTop: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "0.75rem", color: "#94A3B8", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <Clock size={12} /> {report.lastGenerated}
                  </span>
                  <button
                    onClick={() => setFormatModal({ id: report.id, name: report.name })}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.375rem",
                      background: "#002147", color: "#FFFFFF", border: "none",
                      borderRadius: "9999px", padding: "0.5rem 0.875rem",
                      fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    <Download size={13} /> Generate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Scheduled Reports */}
      {activeTab === "Scheduled Reports" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#002147", color: "#FFFFFF", border: "none", borderRadius: "9999px", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}>
              <Calendar size={14} /> New Schedule
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {scheduledReports.map(sched => (
              <div key={sched.id} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "1rem", padding: "1.25rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
                <div style={{ width: "48px", height: "48px", background: sched.status === "active" ? "rgba(21,128,61,0.08)" : "#F4F5F7", borderRadius: "1rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Mail size={20} style={{ color: sched.status === "active" ? "#15803D" : "#94A3B8" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>{sched.name}</span>
                    <StatusPill stage={sched.status === "active" ? "green" : "neutral"} label={sched.status === "active" ? "Active" : "Paused"} />
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
                    {sched.frequency} · {sched.day} at {sched.time} · Recipients: {sched.recipients.join(", ")}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>Next run</div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>{sched.nextRun}</div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  <button style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.375rem 0.75rem", cursor: "pointer" }}>
                    Edit
                  </button>
                  <button style={{ fontSize: "0.8125rem", fontWeight: 500, color: sched.status === "active" ? "#B45309" : "#15803D", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.375rem 0.75rem", cursor: "pointer" }}>
                    {sched.status === "active" ? "Pause" : "Resume"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Export History */}
      {activeTab === "Export History" && (
        <Card title="Recent Exports" subtitle="Last 30 days — all export events are audit-logged" noPadding>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                {["Export ID", "Report", "Format", "Generated", "By", "Size", ""].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentExports.map((exp, i) => (
                <tr key={exp.id} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
                  <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>{exp.id}</td>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{exp.report}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span style={{ fontSize: "0.75rem", background: "#F4F5F7", color: "#475569", padding: "0.2rem 0.5rem", borderRadius: "0.5rem", border: "1px solid #E2E8F0" }}>{exp.format}</span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{exp.date}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{exp.user}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "#94A3B8" }}>{exp.size}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <button style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 500, color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.25rem 0.625rem", cursor: "pointer" }}>
                      <Download size={11} /> Re-download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {formatModal && (
        <ReportFormatModal
          reportId={formatModal.id}
          reportName={formatModal.name}
          onClose={() => setFormatModal(null)}
        />
      )}
    </div>
  );
}