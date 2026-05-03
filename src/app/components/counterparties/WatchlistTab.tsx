// src/app/components/counterparties/WatchlistTab.tsx
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { RefreshCw } from "lucide-react";
import { Card } from "../ui/Card";
import {
  WATCHLIST_DATA,
  SIGNAL_LABELS,
  DEFAULT_WEIGHTS,
  type SignalKey,
  type SignalSnapshot,
  type WatchlistAuditEntry,
} from "./watchlistEngine";
import { useSignalRefresh, type UseSignalRefreshResult } from "../../services/useSignalRefresh";
import type { SignalSource } from "../../services/signalRefreshService";

// ─── Source badge helpers ─────────────────────────────────────────────────────

const SOURCE_BADGE_COLORS: Record<SignalSource, string> = {
  "OFAC":             "#B45309",
  "News Feed":        "#475569",
  "IATA Schedule":    "#0F766E",
  "Payment Records":  "#002147",
  "Rating Agency":    "#6D28D9",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ragColor(status: "green" | "amber" | "red"): string {
  return status === "green" ? "#15803D" : status === "amber" ? "#B45309" : "#B91C1C";
}
function ragBg(status: "green" | "amber" | "red"): string {
  return status === "green"
    ? "rgba(21,128,61,0.1)"
    : status === "amber"
    ? "rgba(180,83,9,0.1)"
    : "rgba(185,28,28,0.1)";
}
function signalRiskStatus(value: number): "green" | "amber" | "red" {
  if (value >= 60) return "red";
  if (value >= 30) return "amber";
  return "green";
}
function timeAgo(date: Date): string {
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// ─── Signal Card ──────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  source,
}: {
  signal: SignalSnapshot;
  source?: SignalSource;
}) {
  const riskSt    = signalRiskStatus(signal.value);
  const sc        = ragColor(riskSt);
  const bg        = ragBg(riskSt);
  const sparkData = signal.trend.map((v, i) => ({ i, v }));

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "0.5rem",
        padding: "0.75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.25rem",
        }}
      >
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
          {signal.label}
        </span>
        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: sc,
            background: bg,
            borderRadius: "4px",
            padding: "0.1rem 0.375rem",
            flexShrink: 0,
          }}
        >
          {signal.value}
        </span>
      </div>
      <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "0.375rem" }}>
        {signal.rawDisplay}
      </div>
      <ResponsiveContainer width="100%" height={48}>
        <AreaChart
          data={sparkData}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
        >
          <defs>
            <linearGradient
              id={`wl-grad-${signal.key}`}
              x1="0" y1="0" x2="0" y2="1"
            >
              <stop offset="5%"  stopColor={sc} stopOpacity={0.3} />
              <stop offset="95%" stopColor={sc} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={sc}
            strokeWidth={1.5}
            fill={`url(#wl-grad-${signal.key})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "0.25rem",
        }}
      >
        <div style={{ fontSize: "0.6875rem", color: "#64748B" }}>
          Contribution:{" "}
          <strong style={{ color: "#0F172A" }}>
            +{signal.contribution.toFixed(1)} pts
          </strong>
        </div>
        {source && (
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: 600,
              color: SOURCE_BADGE_COLORS[source],
              background: `${SOURCE_BADGE_COLORS[source]}18`,
              borderRadius: "0.25rem",
              padding: "2px 6px",
            }}
          >
            {source}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Audit Row ────────────────────────────────────────────────────────────────

function AuditRow({ entry, i }: { entry: WatchlistAuditEntry; i: number }) {
  return (
    <tr
      style={{
        background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
        borderBottom: "1px solid #F1F5F9",
      }}
    >
      <td
        style={{
          padding: "0.5rem 0.75rem",
          color: "#94A3B8",
          whiteSpace: "nowrap",
          fontSize: "0.75rem",
        }}
      >
        {entry.timestamp.slice(0, 10)}
      </td>
      <td style={{ padding: "0.5rem 0.75rem" }}>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: ragColor(entry.toStatus),
            background: ragBg(entry.toStatus),
            borderRadius: "4px",
            padding: "0.1rem 0.4rem",
          }}
        >
          {entry.toStatus.charAt(0).toUpperCase() + entry.toStatus.slice(1)}
        </span>
      </td>
      <td
        style={{
          padding: "0.5rem 0.75rem",
          fontVariantNumeric: "tabular-nums",
          color: "#0F172A",
          fontSize: "0.8125rem",
        }}
      >
        {entry.score.toFixed(1)}
      </td>
      <td style={{ padding: "0.5rem 0.75rem", color: "#0F172A", fontSize: "0.8125rem" }}>
        {entry.triggeredBy}
      </td>
      <td
        style={{
          padding: "0.5rem 0.75rem",
          color: "#475569",
          fontSize: "0.75rem",
          maxWidth: "260px",
        }}
      >
        {entry.evidence}
      </td>
    </tr>
  );
}

// ─── WatchlistTab ─────────────────────────────────────────────────────────────

export function WatchlistTab({ lesseeId }: { lesseeId: string }) {
  const hook: UseSignalRefreshResult = useSignalRefresh();
  const storedLessee = hook.getStatus(lesseeId);
  const fallback     = WATCHLIST_DATA[lesseeId];

  if (!storedLessee && !fallback) return null;

  // ── Derive display values ──────────────────────────────────────────────────

  const displayStatus: "green" | "amber" | "red" = storedLessee
    ? (storedLessee.status.toLowerCase() as "green" | "amber" | "red")
    : fallback.status;

  const displayScore = storedLessee?.score ?? fallback.score;

  const lastRefreshed = hook.getLastRefreshed(lesseeId);

  // Last entry in audit log = most recent status change
  const lastAuditEntry = storedLessee?.auditLog.at(-1) ?? null;
  const lastChangedLabel = lastAuditEntry?.date ?? fallback.lastChanged;
  const triggerKey       = lastAuditEntry?.triggeredBy ?? fallback.trigger;
  const triggerLabel     = SIGNAL_LABELS[triggerKey as SignalKey] ?? triggerKey;

  // Convert stored signals → SignalSnapshot shape (adds contribution, label)
  const displaySignals: Array<SignalSnapshot & { source?: SignalSource }> = storedLessee
    ? storedLessee.signals.map(s => ({
        key:          s.key,
        label:        SIGNAL_LABELS[s.key],
        value:        s.value,
        rawDisplay:   s.rawDisplay,
        trend:        s.trend,
        contribution: (s.value * (DEFAULT_WEIGHTS[s.key] ?? 0)) / 100,
        source:       s.source,
      }))
    : fallback.signals;

  // Convert stored audit entries → WatchlistAuditEntry shape
  const displayAuditLog: WatchlistAuditEntry[] = storedLessee
    ? storedLessee.auditLog.map((a, i, arr) => ({
        id:          `live-audit-${i}`,
        timestamp:   a.date,
        fromStatus:  i === 0
          ? null
          : (arr[i - 1].status.toLowerCase() as "green" | "amber" | "red"),
        toStatus:    a.status.toLowerCase() as "green" | "amber" | "red",
        score:       a.score,
        triggeredBy: SIGNAL_LABELS[a.triggeredBy as SignalKey] ?? a.triggeredBy,
        evidence:    Object.entries(a.evidenceSnapshot)
          .map(([k, v]) => `${SIGNAL_LABELS[k as SignalKey] ?? k}: ${v}`)
          .join(" · "),
      }))
    : fallback.auditLog;

  const sc = ragColor(displayStatus);
  const bg = ragBg(displayStatus);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Status header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          background: bg,
          border: `1px solid ${sc}33`,
          borderRadius: "0.5rem",
          padding: "1rem",
        }}
      >
        <span
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: sc,
            background: `${sc}18`,
            borderRadius: "0.5rem",
            padding: "0.5rem 1rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>
            Score: <span style={{ color: sc }}>{displayScore.toFixed(1)}</span> / 100
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
            Last changed: {lastChangedLabel} · Triggered by:{" "}
            <strong>{triggerLabel}</strong>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "0.375rem",
          }}
        >
          {lastRefreshed && (
            <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
              Last computed: {timeAgo(lastRefreshed)}
            </span>
          )}
          <button
            onClick={() => hook.refreshLessee(lesseeId)}
            disabled={hook.refreshing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#FFFFFF",
              background: "#002147",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.375rem 0.75rem",
              cursor: hook.refreshing ? "not-allowed" : "pointer",
              opacity: hook.refreshing ? 0.65 : 1,
            }}
          >
            <RefreshCw size={11} />
            {hook.refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Signal grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.75rem",
        }}
      >
        {displaySignals.map(s => (
          <SignalCard
            key={s.key}
            signal={s}
            source={(s as SignalSnapshot & { source?: SignalSource }).source}
          />
        ))}
      </div>

      {/* Audit log */}
      <Card
        title="Status Change Audit Log"
        subtitle="Immutable record of every watchlist status change with evidence snapshot"
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}
          >
            <thead>
              <tr style={{ background: "#F4F5F7" }}>
                {["Date", "Status", "Score", "Triggered By", "Evidence Snapshot"].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: "left",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayAuditLog.map((a, i) => (
                <AuditRow key={a.id} entry={a} i={i} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
