import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useSignalRefresh } from "../services/useSignalRefresh";
import { useTransitionNavigate as useNavigate } from "../hooks/useTransitionNavigate";
import { getWatchlistSummary } from "../components/counterparties/watchlistEngine";
import type { WatchlistStatusEntry } from "../components/counterparties/watchlistEngine";
import { WatchlistGlobe } from "../components/dashboard/WatchlistGlobe";

/**
 * Defers mounting expensive children until either:
 *   1. The placeholder scrolls into view (IntersectionObserver), or
 *   2. A short timeout elapses (fallback for above-the-fold widgets).
 *
 * Used to keep Dashboard's first paint cheap so rapid tab switches don't
 * stall on the WatchlistGlobe's d3-geo world-topology fetch + RAF render
 * loop + 200-feature country mesh. The globe still appears within a frame
 * or two of mount — the user perceives a fully-loaded Dashboard, but the
 * main thread isn't blocked while another tab is being entered.
 */
function LazyMount({
  fallback,
  rootMargin = "200px",
  delayMs = 120,
  children,
}: {
  fallback: React.ReactNode;
  rootMargin?: string;
  delayMs?: number;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show) return;
    let cancelled = false;
    const timer = window.setTimeout(() => { if (!cancelled) setShow(true); }, delayMs);

    if (!ref.current) return () => { cancelled = true; window.clearTimeout(timer); };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !cancelled) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(ref.current);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, [show, delayMs, rootMargin]);

  return <div ref={ref}>{show ? children : fallback}</div>;
}
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
import { GettingStartedPanel } from "../components/dashboard/GettingStartedPanel";
import { KpiCard } from "../components/ui/KpiCard";
import { MRHealthCard } from "../components/portfolio/MRHealthCard";
import { StatusPill } from "../components/ui/StatusPill";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { ExportSnapshotModal } from "../components/ui/ExportSnapshotModal";
import { ExpandableCell } from "../components/ui/ExpandableCell";
import { CountryFlag } from "../components/ui/CountryFlag";
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
import { usePortfolioData } from "../hooks/usePortfolioData";
import { toDashboardKPIs, toLeaseTableRows, toMRHealthSummary } from "../lib/portfolioAdapters";
import { toKeyDateRows } from "../lib/keyDatesAdapters";
import { CalendarClock } from "lucide-react";

function fmtBookValue(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(2)}B`;
  return `$${m.toFixed(0)}M`;
}

const eclTrendData = [
  { month: "Oct", ecl: 38.1, s1: 18.6, s2: 8.2, s3: 11.3, migrations: 1 },
  { month: "Nov", ecl: 40.5, s1: 19.0, s2: 9.1, s3: 12.4, migrations: 2 },
  { month: "Dec", ecl: 42.2, s1: 19.3, s2: 9.8, s3: 13.1, migrations: 0 },
  { month: "Jan", ecl: 41.8, s1: 18.8, s2: 10.2, s3: 12.8, migrations: 1 },
  { month: "Feb", ecl: 44.7, s1: 19.1, s2: 11.4, s3: 14.2, migrations: 2 },
  { month: "Mar", ecl: 47.2, s1: 18.3, s2: 12.1, s3: 16.8, migrations: 3 },
];

function EclTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const s1 = payload.find(p => p.dataKey === "s1")?.value ?? 0;
  const s2 = payload.find(p => p.dataKey === "s2")?.value ?? 0;
  const s3 = payload.find(p => p.dataKey === "s3")?.value ?? 0;
  const total = Number(s1) + Number(s2) + Number(s3);
  const entry = eclTrendData.find(d => d.month === label);
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "12px 14px", fontSize: "0.8125rem", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", minWidth: "180px" }}>
      <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>{label} 2026</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", paddingBottom: "6px", borderBottom: "1px solid #F1F5F9" }}>
        <span style={{ color: "#94A3B8" }}>Total ECL</span>
        <span style={{ fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>${total.toFixed(1)}M</span>
      </div>
      {[
        { label: "Stage 1", value: s1, color: "#002147" },
        { label: "Stage 2", value: s2, color: "#B45309" },
        { label: "Stage 3", value: s3, color: "#B91C1C" },
      ].map(({ label: l, value, color }) => (
        <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "3px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#475569" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
            {l}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500, color }}>${Number(value).toFixed(1)}M</span>
        </div>
      ))}
      {entry && entry.migrations > 0 && (
        <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid #F1F5F9", fontSize: "0.75rem", color: "#B45309", fontWeight: 600 }}>
          ↑ {entry.migrations} stage migration{entry.migrations > 1 ? "s" : ""} this period
        </div>
      )}
    </div>
  );
}

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
  // Memoize: getWatchlistSummary() walks the entire watchlist engine on every
  // call and returns a fresh array. Without this, every Dashboard re-render
  // (sidebar toggle, agent panel toggle, hover) triggered a full recompute.
  const watchlistEntries = useMemo(() => getWatchlistSummary(), []);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const unreadCount = useMemo(
    () => watchlistEntries.filter((e) => e.status !== "green" && !readIds.has(e.lesseeId)).length,
    [watchlistEntries, readIds],
  );
  const [showExport, setShowExport] = useState(false);
  const { isExecutiveMode } = useViewMode();
  const { isNewTenant, checklist, checklistDismissed, toggleItem, dismissChecklist } = useOnboarding();
  const showChecklist = isNewTenant && !checklistDismissed;
  const completedCount = checklist.filter((i) => i.completed).length;

  const { refreshAll: refreshAllSignals, refreshing, getLastRefreshed } = useSignalRefresh();
  const [globeHovered, setGlobeHovered] = useState<WatchlistStatusEntry | null>(null);

  const { assets, lessees: lesseeData, leases: leaseData, provisions } = usePortfolioData();
  // Memoize every data transform. Previously these ran on every render →
  // every state change in Dashboard or its parent reran the full KPI/lease/
  // keyDate pipeline. Combined with the WatchlistGlobe leak that was
  // already patched, this contributed to the main-thread pressure that
  // produced the multi-second freeze after a few tab switches.
  const kpis         = useMemo(() => toDashboardKPIs(assets, lesseeData, provisions), [assets, lesseeData, provisions]);
  const leases       = useMemo(() => toLeaseTableRows(leaseData, assets, lesseeData), [leaseData, assets, lesseeData]);
  const mrSummary    = useMemo(() => toMRHealthSummary(leases),                       [leases]);
  const keyDateRows  = useMemo(() => toKeyDateRows(leaseData, assets, lesseeData),    [leaseData, assets, lesseeData]);
  const urgentLeases = useMemo(
    () => keyDateRows
      .filter((r) => r.urgency === "critical" || r.urgency === "watch" || r.urgency === "expired")
      .slice(0, 5),
    [keyDateRows],
  );

  const [expandedTiles, setExpandedTiles] = useState<Set<string>>(new Set());
  function toggleTile(id: string) {
    setExpandedTiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

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
        data-tour="dashboard-kpis"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <KpiCard
          label="Portfolio Book Value"
          value={fmtBookValue(kpis.bookValueM)}
          delta="+$42M vs prior period"
          deltaType="positive"
          subtitle={`${leaseData.length} leases · ${lesseeData.length} lessees`}
          staggerIndex={0}
          onClick={() => navigate("/portfolio")}
        />
        <KpiCard
          label="Expected Credit Loss (ECL)"
          value={`$${kpis.totalECLm.toFixed(1)}M`}
          delta="+$2.4M (5.4%) vs Q4 2025"
          deltaType="negative"
          subtitle={kpis.bookValueM > 0 ? `${((kpis.totalECLm / kpis.bookValueM) * 100).toFixed(2)}% of book value` : "—"}
          staggerIndex={1}
          onClick={() => navigate("/risk-ecl")}
        />
        <KpiCard
          label="Watchlist Status"
          value={`${kpis.watchlistRedCount}`}
          subtitle={`${kpis.watchlistRedCount} Red · ${kpis.watchlistAmberCount} Amber · ${kpis.watchlistGreenCount} Green`}
          delta="↑2 from last week"
          deltaType="negative"
          staggerIndex={2}
          onClick={() => navigate("/counterparties")}
        />
        <KpiCard
          label="Active Scenarios"
          value="12"
          delta="3 run today"
          deltaType="positive"
          subtitle="Last run: 09:14 today"
          staggerIndex={3}
          onClick={() => navigate("/scenarios")}
        />
        <MRHealthCard
          summary={mrSummary}
          staggerIndex={4}
          onClick={() => navigate("/maintenance")}
        />
      </div>

      {/* Getting Started panel — shown only to users who just completed onboarding */}
      <GettingStartedPanel />

      {/* Upcoming Expiries panel */}
      {urgentLeases.length > 0 && (
        <div style={{ background: "#FFFFFF", borderRadius: "var(--radius-lg)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #E2E8F0", overflow: "hidden", padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1rem" }}>
            <CalendarClock size={16} style={{ color: "#B45309" }} />
            <span style={{ fontWeight: 600, color: "#0F172A", fontSize: "0.9375rem" }}>Upcoming Expiries</span>
            <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
              {keyDateRows.filter(r => r.urgency !== "long").length} within 12 months
            </span>
            <button
              onClick={() => navigate("/portfolio", { state: { tab: "Key Dates" } })}
              style={{
                marginLeft: "auto",
                background: "none", border: "none", cursor: "pointer",
                color: "#0369A1", fontSize: "0.75rem", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "4px", padding: 0,
              }}
            >
              View all <ArrowRight size={11} />
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Lessee", "Aircraft", "Expiry", "Days", "Stage"].map(h => (
                  <th key={h} style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, fontSize: "0.6875rem", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {urgentLeases.map(r => {
                const color = r.urgency === "expired" || r.urgency === "critical" ? "#B91C1C" : "#B45309";
                return (
                  <tr
                    key={r.leaseId}
                    onClick={() => navigate("/portfolio", { state: { tab: "Key Dates" } })}
                    style={{
                      borderBottom: "1px solid #F1F5F9",
                      cursor: "pointer",
                      transition: "background 120ms ease",
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "#F8FAFC"}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                  >
                    <td style={{ padding: "8px 12px", fontWeight: 500, color: "#0F172A" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        {r.lessee}
                      </div>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#475569" }}>{r.aircraft}</td>
                    <td style={{ padding: "8px 12px", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                      {new Date(r.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>
                      {r.daysRemaining < 0 ? `${Math.abs(r.daysRemaining)}d ago` : `${r.daysRemaining}d`}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{
                        padding: "1px 6px", borderRadius: 4, fontWeight: 600, fontSize: "0.6875rem",
                        background: r.stage === "3" ? "#FEF2F2" : r.stage === "2" ? "#FFFBEB" : "#F0FDF4",
                        color: r.stage === "3" ? "#B91C1C" : r.stage === "2" ? "#B45309" : "#15803D",
                      }}>S{r.stage}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Market Signals strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.32, ease: [0.23, 1, 0.32, 1] }}
      >
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
          {DASHBOARD_SIGNAL_TILES.map((tile, tileIdx) => {
            const sevColor =
              (tile.severity as SignalSeverity) === "high"   ? "#B91C1C" :
              (tile.severity as SignalSeverity) === "medium" ? "#B45309" : "#15803D";
            const sevBg =
              (tile.severity as SignalSeverity) === "high"   ? "rgba(185,28,28,0.07)" :
              (tile.severity as SignalSeverity) === "medium" ? "rgba(180,83,9,0.07)"  : "rgba(21,128,61,0.07)";
            const sevBorder =
              (tile.severity as SignalSeverity) === "high"   ? "rgba(185,28,28,0.20)" :
              (tile.severity as SignalSeverity) === "medium" ? "rgba(180,83,9,0.20)"  : "rgba(21,128,61,0.20)";
            const dirArrow =
              tile.direction === "up" ? "▲" : tile.direction === "down" ? "▼" : "—";
            const tileExpanded = expandedTiles.has(tile.id);

            return (
              <motion.div
                key={tile.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.38 + tileIdx * 0.055, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  background: sevBg,
                  border: `1px solid ${sevBorder}`,
                  borderRadius: "0.625rem",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  // CSS transitions for hover — GPU-accelerated, snappy
                  transition: "transform 130ms cubic-bezier(0.23,1,0.32,1), box-shadow 130ms cubic-bezier(0.23,1,0.32,1)",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = "translateY(-3px)";
                  el.style.boxShadow = "0 6px 16px rgba(0,0,0,0.10)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
                }}
                onMouseDown={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "scale(0.97)";
                }}
                onMouseUp={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                }}
              >
                {/* Clickable metric area → navigate */}
                <button
                  onClick={() => navigate(tile.href)}
                  style={{
                    display: "block",
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    padding: "0.75rem 0.875rem 0.5rem",
                    textAlign: "left",
                    cursor: "pointer",
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
                </button>

                {/* Expand detail toggle */}
                <div style={{ padding: "0 0.875rem 0.625rem", display: "flex", alignItems: "center" }}>
                  <button
                    onClick={() => toggleTile(tile.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "2px",
                      fontSize: "0.68rem", color: "#94A3B8",
                      background: "transparent", border: "none",
                      cursor: "pointer", padding: 0,
                    }}
                  >
                    <ChevronDown
                      size={10}
                      style={{
                        transform: tileExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 150ms ease",
                      }}
                    />
                    {tileExpanded ? "less" : "details"}
                  </button>
                </div>

                {/* Subtext — only shown when expanded */}
                {tileExpanded && (
                  <div
                    style={{
                      padding: "0.5rem 0.875rem 0.75rem",
                      fontSize: "0.7rem",
                      color: "#475569",
                      lineHeight: 1.4,
                      borderTop: "1px solid #F1F5F9",
                    }}
                  >
                    {tile.subtext}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Charts row — collapsible; collapsed by default in Executive Mode */}
      <div data-tour="dashboard-ecl-trend">
      <DashboardSection label="Charts & Analysis" defaultOpen={!isExecutiveMode}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        <Card title="ECL Trend — Last 6 Months" subtitle="Stage 1 / 2 / 3 breakdown · hover for detail" blueHeader>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={eclTrendData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="s1Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#002147" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#002147" stopOpacity={0.06} />
                </linearGradient>
                <linearGradient id="s2Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B45309" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#B45309" stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="s3Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B91C1C" stopOpacity={0.40} />
                  <stop offset="100%" stopColor="#B91C1C" stopOpacity={0.10} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}M`} />
              <Tooltip content={<EclTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "0.7rem", paddingTop: "4px" }}
                formatter={(value) => value === "s1" ? "Stage 1" : value === "s2" ? "Stage 2" : "Stage 3"}
              />
              <Area type="monotone" dataKey="s1" stackId="ecl" name="Stage 1" stroke="#002147" strokeWidth={1.5} fill="url(#s1Grad)" />
              <Area type="monotone" dataKey="s2" stackId="ecl" name="Stage 2" stroke="#B45309" strokeWidth={1.5} fill="url(#s2Grad)" />
              <Area type="monotone" dataKey="s3" stackId="ecl" name="Stage 3" stroke="#B91C1C" strokeWidth={1.5} fill="url(#s3Grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Stage Distribution" subtitle="By lease count and ECL" blueHeader>
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
      </div>

      {/* Lessee Intelligence Map — Globe + Headlines split */}
      <div data-tour="dashboard-globe">
      <Card
        title="Lessee Intelligence Map"
        subtitle="Global risk positions — hover a country to inspect"
        blueHeader
        collapsible
        defaultCollapsed={false}
        headerRight={
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={refreshAllSignals}
              disabled={refreshing}
              style={{
                display: "flex", alignItems: "center", gap: "0.25rem",
                fontSize: "0.75rem", fontWeight: 600,
                color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.22)", borderRadius: "9999px",
                padding: "0.375rem 0.75rem", cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.55 : 1,
              }}
            >
              <RefreshCw size={11} />
              {refreshing ? "Refreshing…" : "Refresh All"}
            </button>
            {unreadCount > 0 && (
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "#FCA5A5", color: "#7F1D1D", borderRadius: "9999px", padding: "0.1rem 0.5rem" }}>
                {unreadCount} new
              </span>
            )}
            {unreadCount > 0 && (
              <button
                onClick={() => setReadIds(new Set(watchlistEntries.filter(e => e.status !== "green").map(e => e.lesseeId)))}
                style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.60)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => navigate("/counterparties")}
              className="flex items-center gap-1"
              style={{ fontSize: "0.8125rem", fontWeight: 500, color: "rgba(255,255,255,0.85)", background: "transparent", border: "none", cursor: "pointer" }}
              onMouseDown={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")}
              onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
        }
        noPadding
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "400px" }}>
          {/* Left — Globe */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", borderRight: "1px solid #E2E8F0" }}>
            <LazyMount
              fallback={
                <div style={{ width: 340, height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: "0.75rem" }}>
                  Loading globe…
                </div>
              }
            >
              <WatchlistGlobe entries={watchlistEntries} onHover={setGlobeHovered} />
            </LazyMount>
          </div>

          {/* Right — Headlines feed */}
          <div className="dark-scrollbar" style={{ overflow: "auto", maxHeight: "520px" }}>
            {/* Section header */}
            <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Watchlist Headlines
              </span>
              <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>
                {watchlistEntries.filter(e => e.status !== "green").length} active alerts
              </span>
            </div>

            {/* Feed items */}
            {watchlistEntries
              .filter(e => e.status !== "green")
              .sort((a, b) => (a.status === "red" && b.status !== "red" ? -1 : b.status === "red" && a.status !== "red" ? 1 : 0))
              .map((item) => {
                const isHighlighted = globeHovered?.lesseeId === item.lesseeId;
                const triggerColor = item.status === "red" ? "#B91C1C" : "#B45309";
                const triggerBg = item.status === "red" ? "rgba(185,28,28,0.07)" : "rgba(180,83,9,0.07)";
                const isUnread = !readIds.has(item.lesseeId);
                return (
                  <div
                    key={item.lesseeId}
                    style={{
                      padding: "10px 16px",
                      borderBottom: "1px solid #F1F5F9",
                      borderLeft: isHighlighted ? `3px solid ${triggerColor}` : "3px solid transparent",
                      background: isHighlighted ? (item.status === "red" ? "rgba(185,28,28,0.04)" : "rgba(180,83,9,0.04)") : isUnread ? "#FFFBEB" : "#FFFFFF",
                      transition: "background 200ms ease, border-left-color 150ms ease",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setReadIds(prev => new Set([...prev, item.lesseeId]));
                      navigate(`/counterparties?lessee=${item.lesseeId}`);
                    }}
                    onMouseEnter={(e) => { if (!isHighlighted) (e.currentTarget as HTMLDivElement).style.background = "#F8FAFC"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = isHighlighted ? (item.status === "red" ? "rgba(185,28,28,0.04)" : "rgba(180,83,9,0.04)") : isUnread ? "#FFFBEB" : "#FFFFFF"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>{item.lesseeName}</span>
                      <span style={{
                        fontSize: "0.6875rem", fontWeight: 700, padding: "1px 7px", borderRadius: "9999px",
                        background: item.status === "red" ? "rgba(185,28,28,0.10)" : "rgba(180,83,9,0.10)",
                        color: triggerColor,
                      }}>
                        {item.status === "red" ? "High Risk" : "Watch"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <CountryFlag country={item.country} />
                      <span style={{ fontSize: "0.75rem", color: "#64748B" }}>{item.country}</span>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: triggerColor, background: triggerBg, padding: "2px 7px", borderRadius: "0.375rem" }}>
                      <AlertCircle size={10} />
                      {item.trigger}
                    </div>
                    {(() => {
                      const lr = getLastRefreshed(item.lesseeId);
                      return lr ? (
                        <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "4px" }}>
                          Signals refreshed {timeAgo(lr)}
                        </div>
                      ) : null;
                    })()}
                  </div>
                );
              })}

            {/* Green lessees — collapsed summary */}
            <div style={{ padding: "10px 16px", background: "#F8FAFC" }}>
              <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                + {watchlistEntries.filter(e => e.status === "green").length} performing lessees monitored
              </span>
            </div>
          </div>
        </div>
      </Card>
      </div>

      {/* Last 5 Scenario Runs — collapsible; collapsed by default in Executive Mode */}
      <Card
        title="Recent Scenario Runs"
        subtitle="Last 5 reproducible runs — click to load exact inputs"
        blueHeader
        collapsible
        defaultCollapsed={isExecutiveMode}
        headerRight={
          <button
            onClick={() => navigate("/scenarios")}
            className="flex items-center gap-1"
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
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
                  <ExpandableCell text={run.keyFinding} />
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