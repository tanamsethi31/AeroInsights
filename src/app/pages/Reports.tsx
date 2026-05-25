import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "../components/ui/Card";

const PATH_TAB: Record<string, string> = {
  "/reports/templates":  "Report Templates",
  "/reports/scheduled":  "Scheduled Reports",
  "/reports/export-log": "Export History",
};
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { Download, FileText, Table, FileJson, File, Mail, Clock, Calendar, Search, ClipboardList, BarChart3, Scale, AlertTriangle, Globe, Trash2, Pause, Play, Pencil, Check, X } from "lucide-react";
import { ReportFormatModal } from "../components/reports/ReportFormatModal";
import { ExportHistoryPanel } from "../components/reports/ExportHistoryPanel";
import { BoardPackModal } from "../components/reports/BoardPackModal";
import { useEclSnapshots } from "../hooks/useEclSnapshots";
import { AuditorPackModal } from "../components/risk-ecl/AuditorPackModal";
import { computeRollForward } from "../utils/eclRollForward";
import { computeCreditQualityMatrix } from "../utils/creditQualityMatrix";
import { PillTabs } from "../components/ui/PillTabs";

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

interface ScheduledReport {
  id: string;
  name: string;
  frequency: string;
  day: string;
  time: string;
  recipients: string[];
  status: "active" | "paused";
  nextRun: string;
}

const INITIAL_SCHEDULES: ScheduledReport[] = [
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
  const [boardPackModal, setBoardPackModal] = React.useState<{ id: string; name: string } | null>(null);
  const { snapshots } = useEclSnapshots();
  const [auditorPackOpen, setAuditorPackOpen] = useState(false);

  const reportsAuditorData = useMemo(() => {
    if (snapshots.length === 0) return null;
    const latest = snapshots[0];
    const prev   = snapshots[1] ?? null;
    return {
      scenarioInputs:    latest.scenarioInputs,
      weights:           latest.weights,
      weighted:          latest.weighted,
      scenarioSummary:   latest.scenarioSummary,
      eclRows:           latest.eclRows,
      sicrConfig:        latest.sicrConfig,
      managementOverlay: "",
      currency:          latest.currency,
      rollForwardLines:  prev ? computeRollForward(prev.eclRows, latest.eclRows) : null,
      creditQualityRows: computeCreditQualityMatrix(latest.eclRows, []),
      periodLabel:       latest.periodLabel,
    };
  }, [snapshots]);

  // Scheduled reports state + actions
  const [schedules, setSchedules] = useState<ScheduledReport[]>(INITIAL_SCHEDULES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ScheduledReport>>({});
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDraft, setNewDraft] = useState<Partial<ScheduledReport>>({
    name: "", frequency: "Weekly", day: "Monday", time: "08:00", recipients: [], status: "active", nextRun: "TBD",
  });

  function toggleStatus(id: string) {
    setSchedules((prev) =>
      prev.map((s) => s.id === id
        ? { ...s, status: s.status === "active" ? "paused" : "active", nextRun: s.status === "active" ? "Paused" : "TBD" }
        : s
      )
    );
  }

  function deleteSchedule(id: string) {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  function startEdit(s: ScheduledReport) {
    setEditingId(s.id);
    setEditDraft({ name: s.name, recipients: [...s.recipients] });
  }

  function commitEdit(id: string) {
    setSchedules((prev) =>
      prev.map((s) => s.id === id ? { ...s, ...editDraft } : s)
    );
    setEditingId(null);
    setEditDraft({});
  }

  function addSchedule() {
    const id = `SCHED-${String(schedules.length + 1).padStart(3, "0")}`;
    setSchedules((prev) => [...prev, { ...newDraft, id } as ScheduledReport]);
    setNewDraft({ name: "", frequency: "Weekly", day: "Monday", time: "08:00", recipients: [], status: "active", nextRun: "TBD" });
    setShowNewForm(false);
  }

  const categories = ["All", "Audit", "Board", "Portfolio", "Risk", "Jurisdiction"];
  const filtered = categoryFilter === "All" ? reportTemplates : reportTemplates.filter(r => r.category === categoryFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Reports"
        subtitle="Exports, auditor packs, board-pack templates, scheduled delivery"
      />

      {/* Tabs */}
      <PillTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: "-1.5rem" }}
      />

      {/* Tab content */}
      <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      >

      {/* Templates */}
      {activeTab === "Report Templates" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500, border: "1px solid", borderRadius: "9999px", cursor: "pointer", background: categoryFilter === cat ? "#002147" : "transparent", color: categoryFilter === cat ? "#FFFFFF" : "#475569", borderColor: categoryFilter === cat ? "#002147" : "#E2E8F0" }}>
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
            {filtered.map((report, ri) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: ri * 0.06, ease: [0.23, 1, 0.32, 1] }}
                style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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

                {report.id === "RPT-001" && snapshots.length === 0 && (
                  <p style={{ fontSize: "0.75rem", color: "#B45309", background: "#FEF3C7", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", margin: "0 0 0.5rem" }}>
                    No periods locked. Close a period from Risk ECL to generate this report.
                  </p>
                )}

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
                    onClick={() => {
                      if (report.id === "RPT-001") {
                        if (snapshots.length > 0) setAuditorPackOpen(true);
                      } else if (report.id === "RPT-002") {
                        setBoardPackModal({ id: report.id, name: report.name });
                      } else {
                        setFormatModal({ id: report.id, name: report.name });
                      }
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.375rem",
                      background: "#002147", color: "#FFFFFF", border: "none",
                      borderRadius: "9999px", padding: "0.5rem 0.875rem",
                      fontSize: "0.8125rem", fontWeight: 500,
                      opacity: report.id === "RPT-001" && snapshots.length === 0 ? 0.5 : 1,
                      cursor: report.id === "RPT-001" && snapshots.length === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    <Download size={13} /> Generate
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Reports */}
      {activeTab === "Scheduled Reports" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowNewForm((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#002147", color: "#FFFFFF", border: "none", borderRadius: "9999px", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", transition: "background 140ms ease-out" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#003068"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#002147"; }}
            >
              <Calendar size={14} /> {showNewForm ? "Cancel" : "New Schedule"}
            </button>
          </div>

          {/* New Schedule inline form */}
          <AnimatePresence>
            {showNewForm && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                style={{ background: "#FFFFFF", border: "1px solid #002147", borderRadius: "1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
              >
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>New Scheduled Report</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "#64748B", display: "block", marginBottom: "0.25rem" }}>Name</label>
                    <input
                      value={newDraft.name ?? ""}
                      onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Monthly Risk Digest"
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "#64748B", display: "block", marginBottom: "0.25rem" }}>Frequency</label>
                    <select
                      value={newDraft.frequency}
                      onChange={(e) => setNewDraft((d) => ({ ...d, frequency: e.target.value }))}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                    >
                      {["Daily", "Weekly", "Monthly", "Quarterly"].map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "#64748B", display: "block", marginBottom: "0.25rem" }}>Time (UTC)</label>
                    <input
                      type="time"
                      value={newDraft.time ?? "08:00"}
                      onChange={(e) => setNewDraft((d) => ({ ...d, time: e.target.value }))}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "#64748B", display: "block", marginBottom: "0.25rem" }}>Recipients (comma-separated)</label>
                    <input
                      value={(newDraft.recipients ?? []).join(", ")}
                      onChange={(e) => setNewDraft((d) => ({ ...d, recipients: e.target.value.split(",").map((r) => r.trim()).filter(Boolean) }))}
                      placeholder="email@firm.com, other@firm.com"
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                  <button onClick={() => setShowNewForm(false)} style={{ padding: "0.5rem 1rem", borderRadius: "9999px", border: "1px solid #E2E8F0", background: "transparent", color: "#475569", fontSize: "0.8125rem", cursor: "pointer" }}>Cancel</button>
                  <button
                    onClick={addSchedule}
                    disabled={!newDraft.name}
                    style={{ padding: "0.5rem 1.25rem", borderRadius: "9999px", border: "none", background: newDraft.name ? "#002147" : "#CBD5E1", color: "#FFFFFF", fontSize: "0.8125rem", fontWeight: 500, cursor: newDraft.name ? "pointer" : "not-allowed" }}
                  >
                    Create Schedule
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <AnimatePresence initial={false}>
            {schedules.map((sched, si) => (
              <motion.div
                key={sched.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.28, delay: si * 0.04, ease: [0.23, 1, 0.32, 1] }}
                style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>

                {/* Main row */}
                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                  <div style={{ width: "48px", height: "48px", background: sched.status === "active" ? "rgba(21,128,61,0.08)" : "#F4F5F7", borderRadius: "1rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 200ms ease-out" }}>
                    <Mail size={20} style={{ color: sched.status === "active" ? "#15803D" : "#94A3B8", transition: "color 200ms ease-out" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    {editingId === sched.id ? (
                      <input
                        value={editDraft.name ?? sched.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A", border: "1px solid #CBD5E1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", width: "100%", boxSizing: "border-box", marginBottom: "0.25rem" }}
                        autoFocus
                      />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>{sched.name}</span>
                        <StatusPill stage={sched.status === "active" ? "green" : "neutral"} label={sched.status === "active" ? "Active" : "Paused"} />
                      </div>
                    )}
                    {editingId === sched.id ? (
                      <input
                        value={(editDraft.recipients ?? sched.recipients).join(", ")}
                        onChange={(e) => setEditDraft((d) => ({ ...d, recipients: e.target.value.split(",").map((r) => r.trim()).filter(Boolean) }))}
                        placeholder="Recipients (comma-separated)"
                        style={{ fontSize: "0.8125rem", color: "#475569", border: "1px solid #CBD5E1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", width: "100%", boxSizing: "border-box" }}
                      />
                    ) : (
                      <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
                        {sched.frequency} · {sched.day} at {sched.time} · {sched.recipients.join(", ")}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>Next run</div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>{sched.nextRun}</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0, alignItems: "center" }}>
                    {editingId === sched.id ? (
                      <>
                        <button onClick={() => commitEdit(sched.id)} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, color: "#15803D", background: "rgba(21,128,61,0.08)", border: "1px solid rgba(21,128,61,0.25)", borderRadius: "9999px", padding: "0.375rem 0.75rem", cursor: "pointer" }}>
                          <Check size={13} /> Save
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", color: "#94A3B8", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.375rem 0.625rem", cursor: "pointer" }}>
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(sched)}
                          title="Edit"
                          style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.375rem 0.75rem", cursor: "pointer" }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => toggleStatus(sched.id)}
                          title={sched.status === "active" ? "Pause" : "Resume"}
                          style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, color: sched.status === "active" ? "#B45309" : "#15803D", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.375rem 0.75rem", cursor: "pointer" }}
                        >
                          {sched.status === "active" ? <Pause size={12} /> : <Play size={12} />}
                          {sched.status === "active" ? "Pause" : "Resume"}
                        </button>
                        <button
                          onClick={() => deleteSchedule(sched.id)}
                          title="Delete schedule"
                          style={{ display: "flex", alignItems: "center", padding: "0.375rem", color: "#94A3B8", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", cursor: "pointer", transition: "color 120ms ease-out, border-color 120ms ease-out" }}
                          onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "#B91C1C"; b.style.borderColor = "rgba(185,28,28,0.3)"; }}
                          onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "#94A3B8"; b.style.borderColor = "#E2E8F0"; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Export History */}
      {activeTab === "Export History" && (
        <Card title="Recent Exports" subtitle="Persisted to Supabase Storage — click Download to re-fetch any past export. All events audit-logged." noPadding>
          <ExportHistoryPanel />
        </Card>
      )}

      </motion.div>
      </AnimatePresence>

      {formatModal && (
        <ReportFormatModal
          reportId={formatModal.id}
          reportName={formatModal.name}
          onClose={() => setFormatModal(null)}
        />
      )}
      {boardPackModal && (
        <BoardPackModal
          reportId={boardPackModal.id}
          reportName={boardPackModal.name}
          onClose={() => setBoardPackModal(null)}
        />
      )}
      {reportsAuditorData && (
        <AuditorPackModal
          open={auditorPackOpen}
          onClose={() => setAuditorPackOpen(false)}
          data={reportsAuditorData}
        />
      )}
    </div>
  );
}