// src/app/components/reports/EmailReportModal.tsx
import * as React from "react";
import { motion } from "framer-motion";
import { X, Send, Plus, Trash2, CheckCircle2 } from "lucide-react";

interface EmailReportModalProps {
  onClose: () => void;
}

type ReportType = {
  id: string;
  label: string;
  description: string;
  subject: string;
};

const REPORT_TYPES: ReportType[] = [
  {
    id: "ecl_summary",
    label: "ECL Summary",
    description: "Portfolio-level ECL breakdown by stage with scenario weighting",
    subject: "Aeroinsights — ECL Summary Report",
  },
  {
    id: "watchlist_report",
    label: "Watchlist Report",
    description: "All lessees on Amber or Red watchlist with contributing signals",
    subject: "Aeroinsights — Watchlist Report",
  },
  {
    id: "portfolio_snapshot",
    label: "Portfolio Snapshot",
    description: "Full portfolio overview: stage distribution, rentals, and concentrations",
    subject: "Aeroinsights — Portfolio Snapshot",
  },
  {
    id: "stage_migrations",
    label: "Stage Migration Log",
    description: "All IFRS 9 stage changes recorded in the current period",
    subject: "Aeroinsights — Stage Migration Log",
  },
  {
    id: "intelligence_digest",
    label: "Intelligence Digest",
    description: "Top signals from Aero Intelligence ranked by severity",
    subject: "Aeroinsights — Intelligence Digest",
  },
];

export function EmailReportModal({ onClose }: EmailReportModalProps) {
  const [selectedReport, setSelectedReport] = React.useState<string>("ecl_summary");
  const [recipients, setRecipients] = React.useState<string[]>([""]);
  const [message, setMessage] = React.useState("");
  const [sent, setSent] = React.useState(false);

  const report = REPORT_TYPES.find((r) => r.id === selectedReport)!;

  function addRecipient() {
    setRecipients((prev) => [...prev, ""]);
  }

  function updateRecipient(index: number, value: string) {
    setRecipients((prev) => prev.map((r, i) => (i === index ? value : r)));
  }

  function removeRecipient(index: number) {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSend() {
    const validRecipients = recipients.filter((r) => r.trim().includes("@"));
    if (validRecipients.length === 0) return;

    const body = encodeURIComponent(
      [
        message.trim() ? message.trim() + "\n\n---" : "",
        `Report: ${report.label}`,
        `Generated: ${new Date().toLocaleDateString("en-IE", { dateStyle: "long" })}`,
        "",
        "This report was distributed via Aeroinsights.",
      ]
        .filter(Boolean)
        .join("\n")
    );

    const mailto = `mailto:${validRecipients.join(",")}?subject=${encodeURIComponent(report.subject)}&body=${body}`;
    window.location.href = mailto;
    setSent(true);
  }

  const validCount = recipients.filter((r) => r.trim().includes("@")).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          width: "520px",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            background: "#002147",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#FFFFFF" }}>
              Distribute Report
            </div>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "2px" }}>
              Send a report via email to your team
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.70)", display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
              gap: "12px",
            }}
          >
            <CheckCircle2 size={40} style={{ color: "#15803D" }} />
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "#0F172A" }}>
              Email client opened
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#64748B", textAlign: "center" }}>
              Your default email client should have opened with the report details pre-filled.
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: "12px",
                padding: "8px 24px",
                background: "#002147",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
            {/* Report type selector */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{ display: "block", fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A", marginBottom: "8px" }}
              >
                Report Type
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {REPORT_TYPES.map((rt) => (
                  <div
                    key={rt.id}
                    onClick={() => setSelectedReport(rt.id)}
                    style={{
                      padding: "10px 14px",
                      border: selectedReport === rt.id ? "1.5px solid #002147" : "1px solid #E2E8F0",
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: selectedReport === rt.id ? "rgba(0,33,71,0.04)" : "#FFFFFF",
                      transition: "all 150ms",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A" }}>
                      {rt.label}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                      {rt.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recipients */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{ display: "block", fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A", marginBottom: "8px" }}
              >
                Recipients
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {recipients.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="email"
                      value={r}
                      placeholder="colleague@airline.com"
                      onChange={(e) => updateRecipient(i, e.target.value)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        border: "1px solid #E2E8F0",
                        borderRadius: "6px",
                        fontSize: "0.8125rem",
                        color: "#0F172A",
                        outline: "none",
                        fontFamily: "'Inter', sans-serif",
                      }}
                    />
                    {recipients.length > 1 && (
                      <button
                        onClick={() => removeRecipient(i)}
                        style={{
                          background: "none",
                          border: "1px solid #E2E8F0",
                          borderRadius: "6px",
                          cursor: "pointer",
                          color: "#94A3B8",
                          padding: "0 8px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addRecipient}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "none",
                    border: "1px dashed #CBD5E1",
                    borderRadius: "6px",
                    padding: "7px 12px",
                    cursor: "pointer",
                    color: "#64748B",
                    fontSize: "0.8125rem",
                    width: "100%",
                  }}
                >
                  <Plus size={14} />
                  Add recipient
                </button>
              </div>
            </div>

            {/* Optional message */}
            <div style={{ marginBottom: "8px" }}>
              <label
                style={{ display: "block", fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A", marginBottom: "8px" }}
              >
                Message (optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Add a note to accompany this report…"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                  color: "#0F172A",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "'Inter', sans-serif",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        {!sent && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
              Opens your default email client
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  color: "#475569",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={validCount === 0}
                style={{
                  padding: "8px 20px",
                  background: validCount === 0 ? "#CBD5E1" : "#002147",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: validCount === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Send size={14} />
                Send Report
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
