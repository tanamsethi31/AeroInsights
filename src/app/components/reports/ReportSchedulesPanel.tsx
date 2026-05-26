// src/app/components/reports/ReportSchedulesPanel.tsx
// T-5.2 — live report_schedules CRUD.

import { useState } from "react";
import { Clock, Trash2, Calendar, Check, AlertTriangle } from "lucide-react";
import {
  useReportSchedules,
  type ReportFrequency,
  type ReportFormat,
  type ReportSchedule,
} from "../../hooks/useReportSchedules";

const inputStyle: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: "0.375rem",
  padding: "0.4rem 0.625rem", fontSize: "0.8125rem",
  color: "#0F172A", outline: "none",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function ReportSchedulesPanel() {
  const { schedules, loading, error, createSchedule, updateSchedule, deleteSchedule } = useReportSchedules();
  const [draftName,      setDraftName]      = useState("");
  const [draftReportId,  setDraftReportId]  = useState("portfolio-snapshot");
  const [draftFormat,    setDraftFormat]    = useState<ReportFormat>("csv");
  const [draftFreq,      setDraftFreq]      = useState<ReportFrequency>("weekly");
  const [draftRecipients,setDraftRecipients]= useState("");
  const [creating,       setCreating]       = useState(false);

  async function handleCreate() {
    if (!draftName.trim() || !draftRecipients.trim()) return;
    setCreating(true);
    try {
      const recipients = draftRecipients.split(",").map((r) => r.trim()).filter(Boolean);
      await createSchedule({
        name:       draftName.trim(),
        reportId:   draftReportId,
        format:     draftFormat,
        frequency:  draftFreq,
        recipients,
      });
      setDraftName(""); setDraftRecipients("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
        <Clock size={14} />
        <span>
          /api/cron/scheduled-reports runs hourly. Each due schedule
          generates the report (CSV portfolio snapshot for v1), uploads
          to Storage, and emails recipients a signed download link.
        </span>
      </div>

      {loading && <div style={{ color: "#94A3B8", fontSize: "0.875rem" }}>Loading…</div>}
      {error   && <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.8125rem" }}>{error}</div>}

      {schedules.length === 0 ? (
        <div style={{ fontSize: "0.8125rem", color: "#64748B" }}>
          No schedules configured yet. Use the form below to add one.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", border: "1px solid #E2E8F0", borderRadius: "0.5rem" }}>
          <thead>
            <tr style={{ background: "#F4F5F7" }}>
              {["Name", "Format", "Frequency", "Recipients", "Next run", "Last", "Enabled", ""].map(h => (
                <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedules.map((s: ReportSchedule) => {
              const lastIcon = s.lastStatus === "sent" ? Check : s.lastStatus === "failed" ? AlertTriangle : Calendar;
              const lastColor = s.lastStatus === "sent" ? "#15803D" : s.lastStatus === "failed" ? "#B91C1C" : "#94A3B8";
              const LastIcon = lastIcon;
              return (
                <tr key={s.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "0.625rem 0.75rem", fontWeight: 600, color: "#0F172A" }}>{s.name}</td>
                  <td style={{ padding: "0.625rem 0.75rem", color: "#475569", textTransform: "uppercase", fontSize: "0.7rem", fontWeight: 600 }}>{s.format}</td>
                  <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{s.frequency}</td>
                  <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{s.recipients.join(", ")}</td>
                  <td style={{ padding: "0.625rem 0.75rem", color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(s.nextRunAt)}</td>
                  <td style={{ padding: "0.625rem 0.75rem", color: lastColor }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                      <LastIcon size={12} />
                      <span style={{ fontSize: "0.75rem" }}>{s.lastRunAt ? fmtDate(s.lastRunAt) : "—"}</span>
                    </div>
                    {s.lastError && (
                      <div style={{ fontSize: "0.7rem", color: "#B91C1C", marginTop: "0.125rem" }}>
                        {s.lastError}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem" }}>
                    <button
                      onClick={() => updateSchedule(s.id, { enabled: !s.enabled })}
                      style={{
                        background: s.enabled ? "#DCFCE7" : "#F1F5F9",
                        color:      s.enabled ? "#15803D" : "#64748B",
                        border: "none", borderRadius: "9999px",
                        padding: "0.2rem 0.625rem",
                        fontSize: "0.7rem", fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {s.enabled ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem" }}>
                    <button
                      onClick={() => deleteSchedule(s.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
                      title="Delete schedule"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{
        background: "#F8FAFC", border: "1px solid #E2E8F0",
        borderRadius: "0.5rem", padding: "1rem",
        display: "flex", flexDirection: "column", gap: "0.625rem",
      }}>
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>Add schedule</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.625rem" }}>
          <input placeholder="Schedule name" value={draftName} onChange={(e) => setDraftName(e.target.value)} style={inputStyle} />
          <select value={draftReportId} onChange={(e) => setDraftReportId(e.target.value)} style={inputStyle}>
            <option value="portfolio-snapshot">Portfolio Snapshot</option>
          </select>
          <select value={draftFormat} onChange={(e) => setDraftFormat(e.target.value as ReportFormat)} style={inputStyle}>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
            <option value="xlsx">XLSX</option>
          </select>
          <select value={draftFreq} onChange={(e) => setDraftFreq(e.target.value as ReportFrequency)} style={inputStyle}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <input
          placeholder="Recipients (comma separated emails)"
          value={draftRecipients}
          onChange={(e) => setDraftRecipients(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={handleCreate}
          disabled={creating || !draftName.trim() || !draftRecipients.trim()}
          style={{
            alignSelf: "flex-start",
            background: "#002147", color: "#FFFFFF",
            border: "none", borderRadius: "9999px",
            padding: "0.5rem 1.25rem", fontSize: "0.8125rem", fontWeight: 600,
            cursor: creating ? "wait" : "pointer",
            opacity: !draftName.trim() || !draftRecipients.trim() ? 0.5 : 1,
          }}
        >
          {creating ? "Saving…" : "Create schedule"}
        </button>
      </div>
    </div>
  );
}
