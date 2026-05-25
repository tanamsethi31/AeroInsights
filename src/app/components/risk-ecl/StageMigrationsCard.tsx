// src/app/components/risk-ecl/StageMigrationsCard.tsx
//
// T-3.5 — IFRS-9 stage transition history. Each row records a 1↔2 / 2↔3
// / 1↔3 movement, the source signal, and the actor. Auditors use this to
// reconstruct why a lease moved between stages between reporting periods.

import { ArrowDownRight, ArrowUpRight, GitBranch } from "lucide-react";
import { useStageMigrations, type StageMigrationReason } from "../../hooks/useStageMigrations";

const REASON_LABEL: Record<StageMigrationReason, string> = {
  ingestion:    "Ingestion",
  sicr:         "SICR Trigger",
  manual:       "Manual",
  scenario_run: "Scenario Run",
};

const REASON_COLOR: Record<StageMigrationReason, { bg: string; fg: string }> = {
  ingestion:    { bg: "#FEF3C7", fg: "#B45309" },
  sicr:         { bg: "#FEE2E2", fg: "#B91C1C" },
  manual:       { bg: "#F1F5F9", fg: "#475569" },
  scenario_run: { bg: "#E0E7FF", fg: "#3730A3" },
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

export function StageMigrationsCard() {
  const { migrations, loading } = useStageMigrations(50);
  if (loading) return null;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <GitBranch size={14} style={{ color: "#475569" }} />
        <span style={{ fontSize: "0.75rem", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
          IFRS-9 Stage Transitions
        </span>
        <span style={{ fontSize: "0.75rem", color: "#475569" }}>
          ({migrations.length} recorded)
        </span>
      </div>

      {migrations.length === 0 ? (
        <div style={{ fontSize: "0.8125rem", color: "#64748B", padding: "0.25rem 0" }}>
          No stage transitions recorded yet. Re-imports or SICR triggers that
          flip a lease's stage will appear here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {migrations.slice(0, 8).map((m) => {
            const color = REASON_COLOR[m.reason];
            const ArrowIcon = m.direction === "up" ? ArrowUpRight : ArrowDownRight;
            const arrowColor = m.direction === "up" ? "#B91C1C" : "#15803D";
            return (
              <div
                key={m.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto auto",
                  gap: "0.75rem",
                  alignItems: "center",
                  padding: "0.55rem 0",
                  borderBottom: "1px solid #F1F5F9",
                  fontSize: "0.8125rem",
                }}
              >
                <ArrowIcon size={13} style={{ color: arrowColor }} />
                <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#0F172A", fontWeight: 600 }}>
                  {m.leaseExternalId}
                </span>
                <span style={{ fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                  S{m.fromStage} → S{m.toStage}
                </span>
                <span style={{
                  background: color.bg, color: color.fg,
                  fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.04em", padding: "0.15rem 0.5rem",
                  borderRadius: "9999px", whiteSpace: "nowrap",
                }}>
                  {REASON_LABEL[m.reason]}
                </span>
                <span style={{ color: "#94A3B8", fontSize: "0.7rem", whiteSpace: "nowrap" }}>
                  {fmtDate(m.occurredAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
