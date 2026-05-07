// src/app/components/alerts/AlertsPanel.tsx
import * as React from "react";
import { X, Settings, CheckCheck } from "lucide-react";
import {
  getAlerts,
  getUnreadCount,
  markRead,
  markAllRead,
  clearAll,
  formatAlertAge,
} from "../../services/alertService";
import type { AlertItem, AlertSeverity } from "../../data/alertsData";

interface AlertsPanelProps {
  onClose: () => void;
  onOpenRules: () => void;
  onUnreadChange: (count: number) => void;
}

const SEV_COLORS: Record<AlertSeverity, { dot: string; bg: string; border: string }> = {
  red:   { dot: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
  amber: { dot: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  green: { dot: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" },
};

const TYPE_LABELS: Record<string, string> = {
  stage_migration:    "Stage Migration",
  watchlist_elevation:"Watchlist",
  ecl_threshold:      "ECL",
  signal_severity:    "Intelligence",
  jurisdiction_risk:  "Jurisdiction",
  fuel_stress:        "Fuel",
  composite_signal:   "Composite",
};

export function AlertsPanel({ onClose, onOpenRules, onUnreadChange }: AlertsPanelProps) {
  const [alerts, setAlerts] = React.useState<AlertItem[]>(getAlerts);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");

  const displayed = filter === "unread" ? alerts.filter((a) => !a.isRead) : alerts;

  function refresh() {
    setAlerts(getAlerts());
    onUnreadChange(getUnreadCount());
  }

  function handleMarkRead(id: string) {
    markRead(id);
    refresh();
  }

  function handleMarkAll() {
    markAllRead();
    refresh();
  }

  function handleClearAll() {
    clearAll();
    refresh();
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: "420px",
        maxHeight: "560px",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "10px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid #E2E8F0",
          gap: "8px",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A", flex: 1 }}>
          Alerts
        </span>
        <span
          style={{
            fontSize: "0.6875rem",
            background: "#F1F5F9",
            color: "#475569",
            borderRadius: "12px",
            padding: "2px 8px",
            fontWeight: 600,
          }}
        >
          {alerts.filter((a) => !a.isRead).length} unread
        </span>
        <button
          onClick={handleMarkAll}
          title="Mark all as read"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px", display: "flex" }}
        >
          <CheckCheck size={16} />
        </button>
        <button
          onClick={onOpenRules}
          title="Alert settings"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px", display: "flex" }}
        >
          <Settings size={16} />
        </button>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px", display: "flex" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0", borderBottom: "1px solid #E2E8F0" }}>
        {(["all", "unread"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              flex: 1,
              padding: "8px 0",
              background: "transparent",
              border: "none",
              borderBottom: filter === tab ? "2px solid #002147" : "2px solid transparent",
              color: filter === tab ? "#002147" : "#64748B",
              fontWeight: filter === tab ? 600 : 400,
              fontSize: "0.8125rem",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {tab === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {displayed.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "#94A3B8",
              fontSize: "0.8125rem",
            }}
          >
            {filter === "unread" ? "No unread alerts" : "No alerts"}
          </div>
        ) : (
          displayed.map((alert) => {
            const sev = SEV_COLORS[alert.severity];
            return (
              <div
                key={alert.id}
                onClick={() => handleMarkRead(alert.id)}
                style={{
                  display: "flex",
                  gap: "10px",
                  padding: "12px 16px",
                  borderBottom: "1px solid #F8FAFC",
                  cursor: "pointer",
                  background: alert.isRead ? "#FFFFFF" : sev.bg,
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => {
                  if (alert.isRead) (e.currentTarget as HTMLDivElement).style.background = "#F8FAFC";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = alert.isRead ? "#FFFFFF" : sev.bg;
                }}
              >
                {/* Severity dot */}
                <div style={{ paddingTop: "3px", flexShrink: 0 }}>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: sev.dot,
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "2px" }}>
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: alert.isRead ? 400 : 600,
                        color: "#0F172A",
                        flex: 1,
                        lineHeight: 1.35,
                      }}
                    >
                      {alert.title}
                    </span>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        color: "#94A3B8",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}
                    >
                      {formatAlertAge(alert.createdAt)}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.75rem",
                      color: "#475569",
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {alert.body}
                  </p>

                  <div style={{ display: "flex", gap: "6px", marginTop: "6px", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        background: sev.bg,
                        border: `1px solid ${sev.border}`,
                        color: sev.dot,
                        borderRadius: "10px",
                        padding: "1px 6px",
                        fontWeight: 600,
                      }}
                    >
                      {TYPE_LABELS[alert.ruleType] ?? alert.ruleType}
                    </span>
                    {!alert.isRead && (
                      <span
                        style={{
                          fontSize: "0.625rem",
                          background: "#002147",
                          color: "#FFFFFF",
                          borderRadius: "10px",
                          padding: "1px 6px",
                          fontWeight: 600,
                        }}
                      >
                        NEW
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {alerts.length > 0 && (
        <div
          style={{
            borderTop: "1px solid #E2E8F0",
            padding: "8px 16px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={handleClearAll}
            style={{
              background: "none",
              border: "none",
              fontSize: "0.75rem",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "2px 0",
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
