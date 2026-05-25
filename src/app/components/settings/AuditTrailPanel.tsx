// src/app/components/settings/AuditTrailPanel.tsx
//
// T-3.4 — Universal audit trail panel. Reads `audit_log` for the active
// portfolio + org-wide events and renders them as a chronological feed.

import { Fragment, useState } from "react";
import { useAuditLog, type AuditLogEntry } from "../../hooks/useAuditLog";
import type { AuditAction } from "../../services/auditLog";

const ACTION_LABEL: Record<AuditAction, string> = {
  create:   "Create",
  update:   "Update",
  delete:   "Delete",
  lock:     "Lock",
  unlock:   "Unlock",
  run:      "Run",
  export:   "Export",
  import:   "Import",
  override: "Override",
  reset:    "Reset",
};

const ACTION_COLOR: Record<AuditAction, { bg: string; fg: string }> = {
  create:   { bg: "#DCFCE7", fg: "#15803D" },
  update:   { bg: "#DBEAFE", fg: "#1D4ED8" },
  delete:   { bg: "#FEE2E2", fg: "#B91C1C" },
  lock:     { bg: "#E0E7FF", fg: "#3730A3" },
  unlock:   { bg: "#FFEDD5", fg: "#9A3412" },
  run:      { bg: "#F0F9FF", fg: "#0369A1" },
  export:   { bg: "#F1F5F9", fg: "#475569" },
  import:   { bg: "#FEF3C7", fg: "#B45309" },
  override: { bg: "#FEF3C7", fg: "#B45309" },
  reset:    { bg: "#F1F5F9", fg: "#475569" },
};

const ENTITY_LABEL: Record<string, string> = {
  scenario_run:        "Scenario Run",
  ecl_period_snapshot: "Period Lock",
  ifrs9_parameters:    "IFRS-9 Params",
  sicr_config:         "SICR Config",
  lease:               "Lease",
  stage_migration:     "Stage Migration",
  report_export:       "Report Export",
  ingestion:           "Ingestion",
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function summarise(entry: AuditLogEntry): string {
  // For settings updates show keys that changed; for runs show ECL etc.
  if (entry.entityType === "scenario_run" && entry.after) {
    const a = entry.after as { name?: string; mode?: string; ecl?: number };
    return `${a.name ?? "Run"} · ${a.mode ?? ""} · ECL $${(a.ecl ?? 0).toFixed(1)}M`;
  }
  if (entry.entityType === "ecl_period_snapshot" && entry.after) {
    const a = entry.after as { periodLabel?: string; totalEcl?: number };
    return `${a.periodLabel ?? ""} · Total ECL $${(a.totalEcl ?? 0).toFixed(1)}M`;
  }
  if (entry.entityType === "ifrs9_parameters" || entry.entityType === "sicr_config") {
    if (!entry.before || !entry.after) return "Saved";
    const before = entry.before as Record<string, unknown>;
    const after  = entry.after as Record<string, unknown>;
    const changed: string[] = [];
    for (const k of Object.keys(after)) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
        changed.push(`${k}: ${String(before[k])} → ${String(after[k])}`);
      }
    }
    return changed.length === 0 ? "No effective change" : changed.join("  ·  ");
  }
  return entry.entityId ?? "";
}

export function AuditTrailPanel() {
  const { entries, loading, error } = useAuditLog(200);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
        Loading audit trail…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "1rem", background: "#FEE2E2", color: "#B91C1C", borderRadius: "0.5rem", fontSize: "0.8125rem" }}>
        Failed to load audit trail: {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
        No audit events yet. Settings saves, scenario runs, and period locks will appear here.
      </div>
    );
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
      <thead>
        <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
          {["When", "Actor", "Entity", "Action", "Detail"].map(h => (
            <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => {
          const isOpen = expanded === entry.id;
          const color = ACTION_COLOR[entry.action] ?? ACTION_COLOR.update;
          return (
            <Fragment key={entry.id}>
              <tr
                onClick={() => setExpanded(isOpen ? null : entry.id)}
                style={{
                  borderBottom: "1px solid #E2E8F0",
                  background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7",
                  cursor: "pointer",
                }}
                title="Click to expand JSON before/after"
              >
                <td style={{ padding: "0.75rem 1rem", color: "#475569", whiteSpace: "nowrap" }}>
                  {fmtDate(entry.occurredAt)}
                </td>
                <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{entry.actor}</td>
                <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>
                  {ENTITY_LABEL[entry.entityType] ?? entry.entityType}
                  {entry.entityId && (
                    <span style={{ color: "#94A3B8", marginLeft: "0.4rem", fontSize: "0.75rem" }}>
                      · {entry.entityId.length > 24 ? entry.entityId.slice(0, 8) + "…" : entry.entityId}
                    </span>
                  )}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <span style={{ background: color.bg, color: color.fg, fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: "9999px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {ACTION_LABEL[entry.action]}
                  </span>
                </td>
                <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#475569", fontFamily: "monospace", maxWidth: "420px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {summarise(entry)}
                </td>
              </tr>
              {isOpen && (
                <tr style={{ background: "#0F172A" }}>
                  <td colSpan={5} style={{ padding: "1rem 1.25rem" }}>
                    <pre style={{ margin: 0, color: "#E2E8F0", fontSize: "0.75rem", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
{JSON.stringify({ before: entry.before, after: entry.after, note: entry.note }, null, 2)}
                    </pre>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
