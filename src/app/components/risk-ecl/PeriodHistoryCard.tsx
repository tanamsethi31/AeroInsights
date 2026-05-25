// src/app/components/risk-ecl/PeriodHistoryCard.tsx
//
// T-3.2 — surface the persisted ecl_period_snapshots for the active
// portfolio. Confirms to auditors that locked periods are immutable + on
// disk. Empty state hints the user to use Close Period.

import { History, Lock } from "lucide-react";
import { useEclSnapshots } from "../../hooks/useEclSnapshots";

function fmtUSDm(n: number): string {
  return `$${n.toFixed(1)}M`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day:    "2-digit",
      month:  "short",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    }).replace(",", "");
  } catch {
    return iso;
  }
}

export function PeriodHistoryCard() {
  const { snapshots, isLoading } = useEclSnapshots();

  if (isLoading) return null;

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
        <History size={14} style={{ color: "#475569" }} />
        <span style={{ fontSize: "0.75rem", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
          Period History
        </span>
        <span style={{ fontSize: "0.75rem", color: "#475569" }}>
          ({snapshots.length} locked)
        </span>
      </div>

      {snapshots.length === 0 ? (
        <div style={{ fontSize: "0.8125rem", color: "#64748B", padding: "0.25rem 0" }}>
          No periods locked yet. Use <strong>Close Period</strong> to snapshot the current ECL state.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {snapshots.slice(0, 6).map((s) => (
            <div
              key={s.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto auto",
                gap: "0.75rem",
                alignItems: "center",
                padding: "0.5rem 0",
                borderBottom: "1px solid #F1F5F9",
                fontSize: "0.8125rem",
              }}
            >
              <Lock size={12} style={{ color: "#15803D" }} />
              <span style={{ fontWeight: 600, color: "#0F172A" }}>{s.periodLabel}</span>
              <span style={{ color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                {fmtUSDm(s.totalEcl)}
              </span>
              <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>
                {fmtDate(s.lockedAt)}
              </span>
              <span style={{ color: "#94A3B8", fontSize: "0.75rem" }} title={s.lockedBy}>
                {s.lockedBy.split("@")[0]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
