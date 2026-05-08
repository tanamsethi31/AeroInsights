import { useState, useEffect, useRef, type ReactNode } from "react";
import { useSignalRefresh } from "../services/useSignalRefresh";
import { useNavigate } from "react-router";
import { getWatchlistSummary } from "../components/counterparties/watchlistEngine";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { KpiCard } from "../components/ui/KpiCard";
import { StatusPill } from "../components/ui/StatusPill";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { ExportSnapshotModal } from "../components/ui/ExportSnapshotModal";
import { ExpandableCell } from "../components/ui/ExpandableCell";
import { useViewMode } from "../contexts/ViewModeContext";
import { ArrowRight, Play, Download, RefreshCw, AlertCircle, CheckCircle2, Circle, ChevronRight, ChevronDown, X as XIcon } from "lucide-react";

/**
 * A lightweight collapsible wrapper used for dashboard sections (e.g. Charts).
 * `defaultOpen` drives the initial state and resets it whenever it changes
 * (i.e. when the user toggles executive ↔ analyst mode).
 */
function DashboardSection({
  label,
  defaultOpen,
  children,
}: {
  label: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const didMount = useRef(false);

  // Reset when mode toggles, but not on the very first render.
  useEffect(() => {
    if (didMount.current) setOpen(defaultOpen);
    else didMount.current = true;
  }, [defaultOpen]);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "0.25rem 0",
          marginBottom: open ? "0.75rem" : "0",
          color: "#64748B",
          fontSize: "0.8125rem",
          fontWeight: 500,
        }}
      >
        <ChevronDown
          size={14}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        />
        {label}
      </button>
      {open && children}
    </div>
  );
}
import { useOnboarding } from "../contexts/OnboardingContext";
import { DASHBOARD_SIGNAL_TILES, type SignalSeverity } from "../data/intelligenceData";

const eclTrendData = [
  { month: "Oct", ecl: 38.1 },
  { month: "Nov", ecl: 40.5 },
  { month: "Dec", ecl: 42.2 },
  { month: "Jan", ecl: 41.8 },
  { month: "Feb", ecl: 44.7 },
  { month: "Mar", ecl: 47.2 },
];

const stageDistData = [
  { stage: "Stage 1", count: 142, ecl: 8.4 },
  { stage: "Stage 2", count: 23, ecl: 21.6 },
  { stage: "Stage 3", count: 8, ecl: 17.2 },
];


const recentScenarios = [
  {
    id: "RUN-2024-0847",
    name: "Baseline — Q1 2026",
    runDate: "29 Apr 2026, 09:14",
    portfolioECL: "$47.2M",
    keyFinding: "2 stage migrations detected vs prior period",
    status: "complete",
    mode: "Deterministic",
  },
  {
    id: "RUN-2024-0846",
    name: "Fuel Spike (+40%)",
    runDate: "28 Apr 2026, 16:32",
    portfolioECL: "$68.4M",
    keyFinding: "ECL increases 45% under sustained fuel shock",
    status: "complete",
    mode: "Monte Carlo 10k",
  },
  {
    id: "RUN-2024-0845",
    name: "COVID-Severe Replay",
    runDate: "27 Apr 2026, 11:20",
    portfolioECL: "$124.7M",
    keyFinding: "P95 tail risk $189M; 12 Stage 3 migrations",
    status: "complete",
    mode: "Monte Carlo 10k",
  },
  {
    id: "RUN-2024-0844",
    name: "Sovereign Stress — EM",
    runDate: "25 Apr 2026, 14:05",
    portfolioECL: "$89.1M",
    keyFinding: "India, Brazil, Indonesia exposure elevated",
    status: "complete",
    mode: "Deterministic",
  },
  {
    id: "RUN-2024-0843",
    name: "Baseline — Q4 2025",
    runDate: "14 Jan 2026, 09:00",
    portfolioECL: "$44.8M",
    keyFinding: "Portfolio ECL below 1.75% threshold; Stage 2 down 3",
    status: "complete",
    mode: "Deterministic",
  },
];


export default function Dashboard() {
  const navigate = useNavigate();
  const watchlistEntries = getWatchlistSummary();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const unreadCount = watchlistEntries.filter(e => e.status !== "green" && !readIds.has(e.lesseeId)).length;
  const [showExport, setShowExport] = useState(false);
  const { isExecutiveMode } = useViewMode();
  const { isNewTenant, checklist, checklistDismissed, toggleItem, dismissChecklist } = useOnboarding();
  const showChecklist = isNewTenant && !checklistDismissed;
  const completedCount = checklist.filter((i) => i.completed).length;

  const { refreshAll: refreshAllSignals, refreshing, getLastRefreshed } = useSignalRefresh();

  function timeAgo(date: Date): string {
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }

  return (
    <>
      {showExport && (
        <ExportSnapshotModal onClose={() => setShowExport(false)} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Portfolio Dashboard"
        subtitle="As of 29 Apr 2026 — Baseline scenario (60/25/15 weights)"
      >
        {/* Export Snapshot — secondary ghost button */}
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-2"
          style={{
            background: "transparent",
            color: "#002147",
            border: "1.5px solid #002147",
            borderRadius: "9999px",
            padding: "0.563rem 1.125rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
            transition:
              "background-color 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#EFF6FF")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent")
          }
          onMouseDown={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
          }
          onMouseUp={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
          }
        >
          <Download size={14} />
          Export Snapshot
        </button>

        {/* Run New Scenario — primary filled button */}
        <button
          onClick={() => navigate("/scenarios")}
          className="flex items-center gap-2"
          style={{
            background: "#002147",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "9999px",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
            transition:
              "background-color 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#001a35")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#002147")
          }
          onMouseDown={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
          }
          onMouseUp={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
          }
        >
          <Play size={14} />
          Run New Scenario
        </button>
      </PageHeader>

      {/* Onboarding checklist — only shown to new tenants after first import */}
      {showChecklist && (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "0.75rem",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.25rem",
              borderBottom: "1px solid #E2E8F0",
              background: "#F8FAFC",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  background: completedCount === checklist.length ? "#DCFCE7" : "#EFF6FF",
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle2 size={16} style={{ color: completedCount === checklist.length ? "#16A34A" : "#002147" }} />
              </div>
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
                  Getting started — {completedCount} of {checklist.length} done
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                  Complete these steps to get the most from Aeroinsights
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {/* Progress bar */}
              <div style={{ width: "80px", height: "6px", background: "#E2E8F0", borderRadius: "9999px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    background: "#002147",
                    borderRadius: "9999px",
                    width: `${(completedCount / checklist.length) * 100}%`,
                    transition: "width 400ms cubic-bezier(0.23,1,0.32,1)",
                  }}
                />
              </div>
              <button
                onClick={dismissChecklist}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", padding: "0.25rem", borderRadius: "0.375rem" }}
                title="Dismiss checklist"
              >
                <XIcon size={14} />
              </button>
            </div>
          </div>

          {/* Checklist items */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            {checklist.map((item, i) => (
              <button
                key={item.id}
                onClick={() => { toggleItem(item.id); navigate(item.link); }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "1rem 1.25rem",
                  borderBottom: i < checklist.length - 2 ? "1px solid #F1F5F9" : "none",
                  borderRight: i % 2 === 0 ? "1px solid #F1F5F9" : "none",
                  background: item.completed ? "#FAFFFE" : "#FFFFFF",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 150ms ease-out",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = item.completed ? "#FAFFFE" : "#FFFFFF")}
              >
                {item.completed ? (
                  <CheckCircle2 size={18} style={{ color: "#16A34A", flexShrink: 0, marginTop: "1px" }} />
                ) : (
                  <Circle size={18} style={{ color: "#CBD5E1", flexShrink: 0, marginTop: "1px" }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: item.completed ? "#64748B" : "#0F172A", textDecoration: item.completed ? "line-through" : "none" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.125rem", lineHeight: 1.4 }}>
                    {item.description}
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: "#CBD5E1", flexShrink: 0, marginTop: "2px" }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <KpiCard
          label="Portfolio Book Value"
          value="$2.84B"
          delta="+$42M vs prior period"
          deltaType="positive"
          subtitle="173 leases · 48 lessees"
          staggerIndex={0}
        />
        <KpiCard
          label="Expected Credit Loss (ECL)"
          value="$47.2M"
          delta="+$2.4M (5.4%) vs Q4 2025"
          deltaType="negative"
          subtitle="1.66% of book value"
          staggerIndex={1}
        />
        <KpiCard
          label="Watchlist Status"
          value="31"
          subtitle="8 Red · 23 Amber · 142 Green"
          delta="↑2 from last week"
          deltaType="negative"
          staggerIndex={2}
        />
        <KpiCard
          label="Active Scenarios"
          value="12"
          delta="3 run today"
          deltaType="positive"
          subtitle="Last run: 09:14 today"
          staggerIndex={3}
        />
      </div>

      {/* Market Signals strip */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.625rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Market Signals
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                fontSize: "0.7rem",
                color: "#15803D",
                background: "rgba(21,128,61,0.07)",
                borderRadius: "9999px",
                padding: "0.1rem 0.5rem",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#15803D",
                  flexShrink: 0,
                }}
              />
              Live
            </span>
          </div>
          <button
            onClick={() => navigate("/intelligence")}
            style={{
              fontSize: "0.75rem",
              color: "#002147",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.2rem",
            }}
          >
            View all signals →
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "0.75rem",
          }}
        >
          {DASHBOARD_SIGNAL_TILES.map((tile) => {
            const sevColor =
              (tile.severity as SignalSeverity) === "high"   ? "#B91C1C" :
              (tile.severity as SignalSeverity) === "medium" ? "#B45309" : "#15803D";
            const sevBg =
              (tile.severity as SignalSeverity) === "high"   ? "rgba(185,28,28,0.06)" :
              (tile.severity as SignalSeverity) === "medium" ? "rgba(180,83,9,0.06)"  : "rgba(21,128,61,0.06)";
            const dirArrow =
              tile.direction === "up" ? "▲" : tile.direction === "down" ? "▼" : "—";

            return (
              <button
                key={tile.id}
                onClick={() => navigate(tile.href)}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderTop: `3px solid ${sevColor}`,
                  borderRadius: "0.625rem",
                  padding: "0.75rem 0.875rem",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "box-shadow 140ms ease-out, transform 140ms ease-out",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLButtonElement).style.transform = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.35rem" }}>
                  <i className={`bi ${tile.icon}`} style={{ fontSize: "1rem" }} />
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#475569" }}>{tile.label}</span>
                </div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 800,
                    color: sevColor,
                    lineHeight: 1.1,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {dirArrow} {tile.value}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "#475569",
                    marginTop: "0.25rem",
                    lineHeight: 1.4,
                  }}
                >
                  {tile.subtext}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts row — collapsible; collapsed by default in Executive Mode */}
      <DashboardSection label="Charts & Analysis" defaultOpen={!isExecutiveMode}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        <Card title="ECL Trend — Last 6 Months" subtitle="Baseline scenario, portfolio-level">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={eclTrendData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="eclGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#002147" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#002147" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid key="ecl-grid" strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                key="ecl-xaxis"
                dataKey="month"
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                key="ecl-yaxis"
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}M`}
              />
              <Tooltip
                key="ecl-tooltip"
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0.75rem",
                  fontSize: "0.8125rem",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
                }}
                formatter={(v: number) => [`$${v}M`, "ECL"]}
              />
              <Area
                key="ecl-area"
                type="monotone"
                dataKey="ecl"
                stroke="#002147"
                strokeWidth={2}
                fill="url(#eclGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Stage Distribution" subtitle="By lease count and ECL">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stageDistData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid key="stage-grid" strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                key="stage-xaxis"
                dataKey="stage"
                tick={{ fontSize: 11, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis key="stage-yaxis" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
              <Tooltip
                key="stage-tooltip"
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0.75rem",
                  fontSize: "0.8125rem",
                }}
              />
              <Legend key="stage-legend" wrapperStyle={{ fontSize: "0.75rem" }} />
              <Bar key="bar-count" dataKey="count" name="Leases" fill="#002147" radius={[3, 3, 0, 0]} />
              <Bar key="bar-ecl" dataKey="ecl" name="ECL $M" fill="#475569" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      </DashboardSection>

      {/* Watchlist Headlines */}
      <Card
        title="Watchlist Headlines"
        subtitle="Lessees requiring immediate attention"
        headerRight={
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={refreshAllSignals}
              disabled={refreshing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#002147",
                background: "transparent",
                border: "1px solid #E2E8F0",
                borderRadius: "9999px",
                padding: "0.375rem 0.75rem",
                cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.65 : 1,
              }}
            >
              <RefreshCw size={11} />
              {refreshing ? "Refreshing…" : "Refresh All"}
            </button>
            {unreadCount > 0 && (
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "#B91C1C", color: "#FFFFFF", borderRadius: "9999px", padding: "0.1rem 0.5rem", minWidth: "18px", textAlign: "center" }}>
                {unreadCount} new
              </span>
            )}
            {unreadCount > 0 && (
              <button
                onClick={() => setReadIds(new Set(watchlistEntries.filter(e => e.status !== "green").map(e => e.lesseeId)))}
                style={{ fontSize: "0.75rem", color: "#94A3B8", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => navigate("/counterparties")}
              className="flex items-center gap-1"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "#002147",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "opacity 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
              }}
              onMouseDown={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
              }
              onMouseUp={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
              }
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
        }
        noPadding
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
              {["Lessee", "Country", "Status", "Trigger", "Details", "Last Changed", ""].map(label => (
                <th
                  key={label || "_action"}
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#0F172A",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {watchlistEntries.map((item, i) => {
              const isUnread = item.status !== "green" && !readIds.has(item.lesseeId);
              const triggerColor = item.status === "red" ? "#B91C1C" : item.status === "amber" ? "#B45309" : "#15803D";
              const triggerBg = item.status === "red" ? "rgba(185,28,28,0.08)" : item.status === "amber" ? "rgba(180,83,9,0.08)" : "rgba(21,128,61,0.08)";
              return (
                <tr
                  key={item.lesseeId}
                  style={{
                    borderBottom: "1px solid #E2E8F0",
                    background: isUnread ? "#FFFBEB" : i % 2 === 0 ? "#FFFFFF" : "#F4F5F7",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")}
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background =
                      isUnread ? "#FFFBEB" : i % 2 === 0 ? "#FFFFFF" : "#F4F5F7")
                  }
                >
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>
                    {item.lesseeName}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{item.country}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <StatusPill
                      stage={item.status}
                      label={item.status === "red" ? "Red" : item.status === "amber" ? "Amber" : "Green"}
                    />
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.75rem",
                        color: triggerColor,
                        background: triggerBg,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "0.5rem",
                      }}
                    >
                      <AlertCircle size={11} />
                      {item.trigger}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      color: "#475569",
                      maxWidth: "280px",
                    }}
                  >
                    <ExpandableCell text={item.reason} max={55} />
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "#94A3B8", whiteSpace: "nowrap" }}>
                    <div>{item.lastChanged}</div>
                    {(() => {
                      const lr = getLastRefreshed(item.lesseeId);
                      return lr ? (
                        <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>
                          <i className="bi bi-circle-fill" style={{ fontSize: "0.5rem", verticalAlign: "middle", marginRight: "4px" }} /> Signals: {timeAgo(lr)}
                        </div>
                      ) : null;
                    })()}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <button
                      onClick={() => {
                        setReadIds(prev => new Set([...prev, item.lesseeId]));
                        navigate(`/counterparties?lessee=${item.lesseeId}`);
                      }}
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "#002147",
                        background: "transparent",
                        border: "1px solid #E2E8F0",
                        borderRadius: "9999px",
                        padding: "0.375rem 0.75rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition:
                          "border-color 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
                      }}
                      onMouseDown={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
                      }
                      onMouseUp={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Last 5 Scenario Runs — collapsible; collapsed by default in Executive Mode */}
      <Card
        title="Recent Scenario Runs"
        subtitle="Last 5 reproducible runs — click to load exact inputs"
        collapsible
        defaultCollapsed={isExecutiveMode}
        headerRight={
          <button
            onClick={() => navigate("/scenarios")}
            className="flex items-center gap-1"
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#002147",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "opacity 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
            }}
            onMouseDown={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
            }
            onMouseUp={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
            }
          >
            View All Runs <ArrowRight size={14} />
          </button>
        }
        noPadding
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
              {["Run ID", "Scenario", "Mode", "Run Date", "Portfolio ECL", "Key Finding", ""].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "0.75rem 1rem",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#0F172A",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {recentScenarios.map((run, i) => (
              <tr
                key={run.id}
                style={{
                  borderBottom: "1px solid #E2E8F0",
                  background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background =
                    i % 2 === 0 ? "#FFFFFF" : "#F4F5F7")
                }
              >
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    color: "#475569",
                  }}
                >
                  {run.id}
                </td>
                <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>
                  {run.name}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      background: "#F4F5F7",
                      color: "#475569",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "0.25rem",
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    {run.mode}
                  </span>
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{run.runDate}</td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {run.portfolioECL}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                  <ExpandableCell text={run.keyFinding} max={40} />
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate("/scenarios")}
                      className="flex items-center gap-1"
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: "#002147",
                        background: "transparent",
                        border: "1px solid #E2E8F0",
                        borderRadius: "9999px",
                        padding: "0.25rem 0.5rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition:
                          "border-color 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
                      }}
                      onMouseDown={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
                      }
                      onMouseUp={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                    >
                      <RefreshCw size={11} /> Re-run
                    </button>
                    <button
                      className="flex items-center gap-1"
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: "#475569",
                        background: "transparent",
                        border: "1px solid #E2E8F0",
                        borderRadius: "9999px",
                        padding: "0.25rem 0.5rem",
                        cursor: "pointer",
                        transition:
                          "border-color 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
                      }}
                      onMouseDown={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
                      }
                      onMouseUp={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                    >
                      <Download size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
    </>
  );
}