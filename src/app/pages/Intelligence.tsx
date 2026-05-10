import * as React from "react";
import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Fuel, Globe, BarChart3, ArrowLeftRight, Plane } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { usePortfolioData } from "../hooks/usePortfolioData";
import {
  MACRO_SIGNALS,
  LESSEE_RADAR,
  DEAL_FEED,
  JURISDICTION_EVENTS,
  type SignalCategory,
  type SignalSeverity,
  type SignalSentiment,
  type SignalDirection,
  type DealCategory,
  type MacroSignal,
  type LesseeRadarEntry,
  type LesseeRadarSignal,
  type DealItem,
  type JurisdictionEvent,
} from "../data/intelligenceData";

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  blue:   "#002147",
  text:   "#0F172A",
  muted:  "#475569",
  border: "#E2E8F0",
  bg:     "#F8FAFC",
  red:    "#B91C1C",
  redBg:  "rgba(185,28,28,0.07)",
  amber:  "#B45309",
  amberBg:"rgba(180,83,9,0.07)",
  green:  "#15803D",
  greenBg:"rgba(21,128,61,0.07)",
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sevColor(s: SignalSeverity) {
  return s === "high" ? T.red : s === "medium" ? T.amber : T.green;
}
function sevBg(s: SignalSeverity) {
  return s === "high" ? T.redBg : s === "medium" ? T.amberBg : T.greenBg;
}
function sevLabel(s: SignalSeverity) {
  return s === "high" ? "HIGH" : s === "medium" ? "MEDIUM" : "LOW";
}

function sentColor(s: SignalSentiment) {
  return s === "negative" ? T.red : s === "positive" ? T.green : T.amber;
}
function sentBg(s: SignalSentiment) {
  return s === "negative" ? T.redBg : s === "positive" ? T.greenBg : T.amberBg;
}
function sentLabel(s: SignalSentiment) {
  return s === "negative" ? "Negative" : s === "positive" ? "Positive" : "Neutral";
}

function ragColor(s: "green" | "amber" | "red") {
  return s === "red" ? T.red : s === "amber" ? T.amber : T.green;
}
function ragBg(s: "green" | "amber" | "red") {
  return s === "red" ? T.redBg : s === "amber" ? T.amberBg : T.greenBg;
}

function dirArrow(d: SignalDirection) {
  return d === "up" ? "▲" : d === "down" ? "▼" : "—";
}
function dirColor(d: SignalDirection, invert = false) {
  // for most signals up = bad; for aviation RPK up = good
  if (invert) return d === "up" ? T.green : d === "down" ? T.red : T.muted;
  return d === "up" ? T.red : d === "down" ? T.green : T.muted;
}

const CAT_ICON_MAP: Record<string, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  fuel:     Fuel,
  gdp:      Globe,
  rates:    BarChart3,
  fx:       ArrowLeftRight,
  aviation: Plane,
};

function CatIcon({ category, size = 14 }: { category: string; size?: number }) {
  const Icon = CAT_ICON_MAP[category];
  if (!Icon) return null;
  return <Icon size={size} />;
}
function catLabel(c: SignalCategory) {
  const m: Record<SignalCategory, string> = {
    fuel: "Fuel", gdp: "GDP", rates: "Rates", fx: "FX", aviation: "Aviation",
  };
  return m[c];
}

function fmtUSD(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function dealCatLabel(c: DealCategory) {
  const m: Record<DealCategory, string> = {
    "financial-distress": "Financial Distress",
    fleet: "Fleet",
    "route-network": "Route Network",
    regulatory: "Regulatory",
    positive: "Positive",
    sanctions: "Sanctions",
  };
  return m[c];
}

function jxTypeLabel(t: string) {
  const m: Record<string, string> = {
    legal: "Legal", credit: "Credit", regulatory: "Regulatory", political: "Political",
  };
  return m[t] ?? t;
}

// ─── Sub-tab nav ─────────────────────────────────────────────────────────────

type IntelTab = "signals" | "lessee-radar" | "deal-feed" | "jx-watch";

const TABS: { id: IntelTab; label: string }[] = [
  { id: "signals",      label: "Macro Signals"     },
  { id: "lessee-radar", label: "Lessee Radar"       },
  { id: "deal-feed",    label: "Deal Feed"           },
  { id: "jx-watch",    label: "Jurisdiction Watch"  },
];

// ─── Chip filter ─────────────────────────────────────────────────────────────

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "0.3rem 0.75rem",
        borderRadius: "9999px",
        border: `1px solid ${active ? T.blue : T.border}`,
        background: active ? T.blue : "#FFFFFF",
        color: active ? "#FFFFFF" : T.text,
        fontSize: "0.8125rem",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        transition: "all 140ms ease-out",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {count !== undefined && (
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            background: active ? "rgba(255,255,255,0.25)" : T.border,
            borderRadius: "9999px",
            padding: "0 0.35rem",
            lineHeight: "1.4",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── ECL pill ────────────────────────────────────────────────────────────────

function EclPill({ usd, dir }: { usd: number | null; dir: SignalSentiment | null }) {
  if (usd === null || dir === null) return null;
  const positive = dir === "positive"; // positive = ECL decreases = good
  const color  = positive ? T.green : T.red;
  const bg     = positive ? T.greenBg : T.redBg;
  const prefix = positive ? "ECL " : "ECL +";
  const sign   = usd < 0 ? "" : "+"; // usd already signed
  const val    = `${sign}$${Math.abs(usd).toFixed(1)}M`;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.2rem",
        padding: "0.15rem 0.5rem",
        borderRadius: "9999px",
        background: bg,
        color,
        fontSize: "0.75rem",
        fontWeight: 600,
      }}
    >
      {prefix}{Math.abs(usd).toFixed(1)}M
    </span>
  );
}

// ─── Macro Signals View ───────────────────────────────────────────────────────

const CAT_FILTERS: { id: SignalCategory | "all"; label: string }[] = [
  { id: "all",      label: "All"      },
  { id: "fuel",     label: "Fuel"     },
  { id: "gdp",      label: "GDP"      },
  { id: "rates",    label: "Rates"    },
  { id: "fx",       label: "FX"       },
  { id: "aviation", label: "Aviation" },
];

function SignalCard({ sig, lesseeIdByName, liveExposure }: {
  sig: MacroSignal;
  lesseeIdByName: Map<string, string>;
  liveExposure: (name: string, fallback: number) => number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const navigate = useNavigate();
  const invert = sig.category === "aviation"; // RPK up = good

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderRadius: "0.75rem",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "0.75rem 1rem",
          borderBottom: `1px solid ${T.border}`,
          background: sevBg(sig.severity),
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              marginBottom: "0.25rem",
            }}
          >
            <CatIcon category={sig.category} size={15} />
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: T.muted,
                textTransform: "uppercase",
              }}
            >
              {catLabel(sig.category)}
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: sevColor(sig.severity),
                background: sevBg(sig.severity),
                border: `1px solid ${sevColor(sig.severity)}`,
                borderRadius: "9999px",
                padding: "0.05rem 0.4rem",
                textTransform: "uppercase",
              }}
            >
              {sevLabel(sig.severity)}
            </span>
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: T.text,
              lineHeight: 1.4,
            }}
          >
            {sig.name}
          </div>
        </div>
        {/* Change badge */}
        <div
          style={{
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: dirColor(sig.direction, invert),
              letterSpacing: "-0.01em",
            }}
          >
            {dirArrow(sig.direction)} {sig.changeLabel}
          </div>
          <div style={{ fontSize: "0.7rem", color: T.muted, marginTop: "0.1rem" }}>
            {sig.updatedAt}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "0.875rem 1rem", flex: 1 }}>
        {/* Current / Previous row */}
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            marginBottom: "0.875rem",
            fontSize: "0.8125rem",
          }}
        >
          <div>
            <div style={{ color: T.muted, fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Current
            </div>
            <div style={{ fontWeight: 700, color: T.text, marginTop: "0.1rem" }}>{sig.currentValue}</div>
          </div>
          <div>
            <div style={{ color: T.muted, fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Previous
            </div>
            <div style={{ color: T.muted, marginTop: "0.1rem" }}>{sig.previousValue}</div>
          </div>
          {sig.eclImpactUSD !== null && (
            <div style={{ marginLeft: "auto" }}>
              <div style={{ color: T.muted, fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                ECL Impact
              </div>
              <div style={{ marginTop: "0.1rem" }}>
                <EclPill usd={sig.eclImpactUSD} dir={sig.eclImpactDir} />
              </div>
            </div>
          )}
        </div>

        {/* Narratives */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {/* Global narrative */}
          <div
            style={{
              fontSize: "0.8125rem",
              color: T.muted,
              lineHeight: 1.6,
            }}
          >
            {sig.globalNarrative}
          </div>

          {/* Portfolio narrative — collapsible */}
          <button
            onClick={() => setPortfolioOpen((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: T.blue,
            }}
          >
            <svg
              width="10" height="10" viewBox="0 0 10 10"
              style={{ transform: portfolioOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms ease", flexShrink: 0 }}
            >
              <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Your portfolio
          </button>
          {portfolioOpen && (
            <div
              style={{
                background: "rgba(0,33,71,0.04)",
                border: `1px solid rgba(0,33,71,0.12)`,
                borderLeft: `3px solid ${T.blue}`,
                borderRadius: "0 0.375rem 0.375rem 0",
                padding: "0.625rem 0.75rem",
                fontSize: "0.8125rem",
                color: T.text,
                lineHeight: 1.6,
              }}
            >
              {sig.portfolioNarrative}
            </div>
          )}

          {/* Action narrative — collapsible */}
          {expanded && (
            <div
              style={{
                background: sevBg(sig.severity),
                border: `1px solid ${sevColor(sig.severity)}22`,
                borderRadius: "0.375rem",
                padding: "0.625rem 0.75rem",
                fontSize: "0.8125rem",
                color: T.text,
                lineHeight: 1.6,
              }}
            >
              <span style={{ fontWeight: 600, color: sevColor(sig.severity) }}>Action: </span>
              {sig.actionNarrative}
            </div>
          )}
        </div>

        {/* Affected lessees strip */}
        {sig.affectedLessees.length > 0 && (
          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.3rem",
            }}
          >
            {sig.affectedLessees.slice(0, 6).map((l) => {
              const id = lesseeIdByName.get(l.name);
              return (
                <button
                  key={l.id}
                  onClick={() => id ? navigate(`/counterparties?lessee=${id}`) : navigate("/counterparties")}
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    padding: "0.1rem 0.45rem",
                    borderRadius: "9999px",
                    background:
                      l.stage === "3" ? T.redBg :
                      l.stage === "2" ? T.amberBg : T.greenBg,
                    color:
                      l.stage === "3" ? T.red :
                      l.stage === "2" ? T.amber : T.green,
                    border: `1px solid ${
                      l.stage === "3" ? T.red + "44" :
                      l.stage === "2" ? T.amber + "44" : T.green + "44"
                    }`,
                    cursor: id ? "pointer" : "default",
                  }}
                >
                  S{l.stage} · {l.name}
                </button>
              );
            })}
            {sig.affectedLessees.length > 6 && (
              <span style={{ fontSize: "0.7rem", color: T.muted, padding: "0.1rem 0.25rem" }}>
                +{sig.affectedLessees.length - 6} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          padding: "0.625rem 1rem",
          borderTop: `1px solid ${T.border}`,
          background: T.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: "0.78rem",
            color: T.muted,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontWeight: 500,
          }}
        >
          {expanded ? "▲ Hide action detail" : "▼ Show action detail"}
        </button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <a
            href={sig.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.78rem",
              color: T.muted,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            {sig.source} ↗
          </a>
          <button
            onClick={() => navigate("/scenarios/run", {
              state: { prefill: sig.actionPrefill, prefillSource: sig.name },
            })}
            style={{
              padding: "0.3rem 0.75rem",
              borderRadius: "0.375rem",
              border: `1px solid ${T.blue}`,
              background: T.blue,
              color: "#FFFFFF",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {sig.actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MacroSignalsView({ lesseeIdByName, liveExposure }: {
  lesseeIdByName: Map<string, string>;
  liveExposure: (name: string, fallback: number) => number;
}) {
  const [catFilter, setCatFilter] = useState<SignalCategory | "all">("all");

  const filtered = useMemo(() => {
    const sigs = catFilter === "all"
      ? MACRO_SIGNALS
      : MACRO_SIGNALS.filter((s) => s.category === catFilter);
    // sort: high first, then medium, then low
    const order: Record<SignalSeverity, number> = { high: 0, medium: 1, low: 2 };
    return [...sigs].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [catFilter]);

  // Count per category
  const counts = useMemo(() => {
    const c: Partial<Record<SignalCategory, number>> = {};
    for (const s of MACRO_SIGNALS) c[s.category] = (c[s.category] ?? 0) + 1;
    return c;
  }, []);

  const highCount  = MACRO_SIGNALS.filter((s) => s.severity === "high").length;
  const medCount   = MACRO_SIGNALS.filter((s) => s.severity === "medium").length;

  return (
    <div>
      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        {[
          { label: "High-Severity Signals", value: highCount,  color: T.red,   bg: T.redBg   },
          { label: "Medium Signals",         value: medCount,   color: T.amber, bg: T.amberBg },
          { label: "Signals Monitored",      value: MACRO_SIGNALS.length, color: T.text, bg: T.bg },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: k.bg,
              border: `1px solid ${T.border}`,
              borderRadius: "0.625rem",
              padding: "0.875rem 1.125rem",
            }}
          >
            <div style={{ fontSize: "1.625rem", fontWeight: 700, color: k.color, lineHeight: 1 }}>
              {k.value}
            </div>
            <div style={{ fontSize: "0.78rem", color: T.muted, marginTop: "0.25rem" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {CAT_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            active={catFilter === f.id}
            label={f.id === "all" ? `All (${MACRO_SIGNALS.length})` : f.label}
            count={f.id !== "all" ? counts[f.id as SignalCategory] : undefined}
            onClick={() => setCatFilter(f.id)}
          />
        ))}
      </div>

      {/* Signal cards — 2-col grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(520px, 1fr))",
          gap: "1rem",
        }}
      >
        {filtered.map((sig) => (
          <SignalCard key={sig.id} sig={sig} lesseeIdByName={lesseeIdByName} liveExposure={liveExposure} />
        ))}
      </div>
    </div>
  );
}

// ─── Lessee Radar View ────────────────────────────────────────────────────────

function RadarCell({ sig }: { sig: LesseeRadarSignal }) {
  const color = ragColor(sig.status);
  const bg    = ragBg(sig.status);
  const arrow = sig.trend === "up" ? "▲" : sig.trend === "down" ? "▼" : "—";
  return (
    <td
      style={{
        padding: "0.625rem 0.75rem",
        borderBottom: `1px solid ${T.border}`,
        textAlign: "right",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          padding: "0.2rem 0.5rem",
          borderRadius: "9999px",
          background: bg,
          color,
          fontSize: "0.78rem",
          fontWeight: 600,
        }}
      >
        {sig.value}{sig.unit.includes("bps") ? "" : ""} {sig.unit.split(" ")[0] === "%" ? "%" : ""}
        <span style={{ opacity: 0.7, fontSize: "0.65rem" }}>{arrow}</span>
      </span>
    </td>
  );
}

function LesseeRadarView({ lesseeIdByName, liveExposure }: {
  lesseeIdByName: Map<string, string>;
  liveExposure: (name: string, fallback: number) => number;
}) {
  const navigate = useNavigate();

  const sorted = useMemo(
    () => [...LESSEE_RADAR].sort((a, b) => b.compositeScore - a.compositeScore),
    []
  );

  const redCount   = sorted.filter((e) => e.compositeSignal === "red").length;
  const amberCount = sorted.filter((e) => e.compositeSignal === "amber").length;
  const greenCount = sorted.filter((e) => e.compositeSignal === "green").length;

  return (
    <div>
      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        {[
          { label: "Red — Critical",  value: redCount,   color: T.red,   bg: T.redBg   },
          { label: "Amber — Watch",   value: amberCount, color: T.amber, bg: T.amberBg },
          { label: "Green — Healthy", value: greenCount, color: T.green, bg: T.greenBg },
          { label: "Lessees Tracked", value: sorted.length, color: T.text, bg: T.bg },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: k.bg,
              border: `1px solid ${T.border}`,
              borderRadius: "0.625rem",
              padding: "0.875rem 1.125rem",
            }}
          >
            <div style={{ fontSize: "1.625rem", fontWeight: 700, color: k.color, lineHeight: 1 }}>
              {k.value}
            </div>
            <div style={{ fontSize: "0.78rem", color: T.muted, marginTop: "0.25rem" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "1.25rem",
          marginBottom: "1rem",
          fontSize: "0.78rem",
          color: T.muted,
        }}
      >
        <span>Thresholds:</span>
        <span>Load factor &lt; 80% = red</span>
        <span>Schedule stability &lt; 85% = red</span>
        <span>Fuel cost stress &gt; 35% opex = red</span>
        <span>Rev/lease &gt; 8.5% = red</span>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#FFFFFF",
          border: `1px solid ${T.border}`,
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: T.bg }}>
              {[
                { label: "#",                align: "center" },
                { label: "Lessee",           align: "left"   },
                { label: "Country",          align: "left"   },
                { label: "Stage",            align: "center" },
                { label: "Exposure",         align: "right"  },
                { label: "Load Factor",      align: "right"  },
                { label: "Sched. Stability", align: "right"  },
                { label: "Fuel Cost Stress", align: "right"  },
                { label: "Rev/Lease",        align: "right"  },
                { label: "Signal",           align: "center" },
                { label: "Action",           align: "center" },
              ].map((h) => (
                <th
                  key={h.label}
                  style={{
                    padding: "0.625rem 0.75rem",
                    borderBottom: `1px solid ${T.border}`,
                    textAlign: h.align as "left" | "right" | "center",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: T.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, i) => {
              const composite = entry.compositeSignal;
              return (
                <tr
                  key={entry.lesseeId}
                  style={{
                    background: i % 2 === 0 ? "#FFFFFF" : T.bg,
                  }}
                >
                  {/* Rank */}
                  <td
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderBottom: `1px solid ${T.border}`,
                      textAlign: "center",
                      color: T.muted,
                      fontSize: "0.75rem",
                    }}
                  >
                    {i + 1}
                  </td>

                  {/* Lessee */}
                  <td
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderBottom: `1px solid ${T.border}`,
                      fontWeight: 600,
                      color: T.text,
                    }}
                  >
                    <button
                      onClick={() => {
                        const id = lesseeIdByName.get(entry.lesseeName);
                        if (id) navigate(`/counterparties?lessee=${id}`);
                        else navigate("/counterparties");
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit", fontWeight: "inherit", fontSize: "inherit", textAlign: "left" }}
                    >
                      {entry.lesseeName}
                    </button>
                  </td>

                  {/* Country */}
                  <td
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderBottom: `1px solid ${T.border}`,
                      color: T.muted,
                    }}
                  >
                    {entry.country}
                  </td>

                  {/* Stage */}
                  <td
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderBottom: `1px solid ${T.border}`,
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background:
                          entry.stage === "3" ? T.redBg :
                          entry.stage === "2" ? T.amberBg : T.greenBg,
                        color:
                          entry.stage === "3" ? T.red :
                          entry.stage === "2" ? T.amber : T.green,
                      }}
                    >
                      S{entry.stage}
                    </span>
                  </td>

                  {/* Exposure */}
                  <td
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderBottom: `1px solid ${T.border}`,
                      textAlign: "right",
                      fontWeight: 600,
                      color: T.text,
                    }}
                  >
                    {fmtUSD(liveExposure(entry.lesseeName, entry.exposureUSD))}
                  </td>

                  {/* Load Factor */}
                  <RadarCell sig={{
                    ...entry.loadFactor,
                    value: entry.loadFactor.value,
                    unit: "%",
                    status: entry.loadFactor.status,
                    trend: entry.loadFactor.trend,
                    threshold: entry.loadFactor.threshold,
                  }} />

                  {/* Schedule Stability */}
                  <RadarCell sig={{
                    ...entry.scheduleStability,
                    value: entry.scheduleStability.value,
                    unit: "%",
                  }} />

                  {/* Fuel Cost Stress */}
                  <RadarCell sig={{
                    ...entry.fuelCostStress,
                    value: entry.fuelCostStress.value,
                    unit: "% opex",
                  }} />

                  {/* Rev/Lease */}
                  <RadarCell sig={{
                    ...entry.revLeaseRatio,
                    value: entry.revLeaseRatio.value,
                    unit: "% rev",
                  }} />

                  {/* Composite Signal */}
                  <td
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderBottom: `1px solid ${T.border}`,
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                        background: ragBg(composite),
                        color: ragColor(composite),
                        fontSize: "0.72rem",
                        fontWeight: 700,
                      }}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: ragColor(composite),
                          flexShrink: 0,
                        }}
                      />
                      {composite.charAt(0).toUpperCase() + composite.slice(1)} · {entry.compositeScore}
                    </span>
                  </td>

                  {/* Stress-test action */}
                  <td
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderBottom: `1px solid ${T.border}`,
                      textAlign: "center",
                    }}
                  >
                    <button
                      onClick={() => {
                        const pdMulti = entry.fuelCostStress.status === "red" ? 2.0
                                      : entry.fuelCostStress.status === "amber" ? 1.5 : 1.2;
                        navigate("/scenarios/run", {
                          state: {
                            prefill: { pdS3Multi: pdMulti, fuelDelta: 20 },
                            prefillSource: `${entry.lesseeId} Lessee Radar`,
                          },
                        });
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: `1.5px solid ${T.blue}`,
                        background: "transparent",
                        color: T.blue,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 150ms ease-out",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#EFF6FF")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      ↗ Stress-test
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div
          style={{
            padding: "0.625rem 1rem",
            borderTop: `1px solid ${T.border}`,
            background: T.bg,
            fontSize: "0.75rem",
            color: T.muted,
          }}
        >
          Data sourced from IATA Financial Monitor, Eurocontrol STATFOR, carrier investor relations filings. Updated weekly. Composite score: 0–100 (higher = more stressed).
        </div>
      </div>
    </div>
  );
}

// ─── Deal Feed View ───────────────────────────────────────────────────────────

const DEAL_CAT_FILTERS: { id: DealCategory | "all"; label: string }[] = [
  { id: "all",               label: "All"               },
  { id: "financial-distress",label: "Financial Distress" },
  { id: "fleet",             label: "Fleet"              },
  { id: "route-network",     label: "Route Network"      },
  { id: "regulatory",        label: "Regulatory"         },
  { id: "positive",          label: "Positive"           },
  { id: "sanctions",         label: "Sanctions"          },
];

function DealCard({ item }: { item: DealItem }) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderLeft: `3px solid ${sentColor(item.sentiment)}`,
        borderRadius: "0 0.625rem 0.625rem 0",
        padding: "0.875rem 1rem",
        display: "flex",
        gap: "0.875rem",
      }}
    >
      {/* Left: content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Tags row */}
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.5rem" }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "0.1rem 0.45rem",
              borderRadius: "9999px",
              background: sentBg(item.sentiment),
              color: sentColor(item.sentiment),
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {sentLabel(item.sentiment)}
          </span>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              padding: "0.1rem 0.45rem",
              borderRadius: "9999px",
              background: T.bg,
              color: T.muted,
              border: `1px solid ${T.border}`,
            }}
          >
            {dealCatLabel(item.category)}
          </span>
          {item.relevance === "high" && (
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                padding: "0.1rem 0.45rem",
                borderRadius: "9999px",
                background: "rgba(0,33,71,0.07)",
                color: T.blue,
                border: `1px solid rgba(0,33,71,0.15)`,
              }}
            >
              High Relevance
            </span>
          )}
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: T.text,
            lineHeight: 1.4,
            marginBottom: "0.375rem",
          }}
        >
          {item.headline}
        </div>

        {/* Source + time */}
        <div style={{ fontSize: "0.75rem", color: T.muted, marginBottom: "0.5rem" }}>
          {item.source} · {item.hoursAgo < 24
            ? `${item.hoursAgo}h ago`
            : `${Math.round(item.hoursAgo / 24)}d ago`} · {item.publishedAt}
        </div>

        {/* Portfolio tag */}
        {item.portfolioTag && (
          <div
            style={{
              fontSize: "0.78rem",
              color: T.blue,
              background: "rgba(0,33,71,0.05)",
              border: `1px solid rgba(0,33,71,0.12)`,
              borderRadius: "0.375rem",
              padding: "0.3rem 0.6rem",
              marginBottom: "0.5rem",
              fontWeight: 500,
            }}
          >
            <i className="bi bi-folder" style={{ marginRight: "4px" }} />{item.portfolioTag}
          </div>
        )}

        {/* Suggested action */}
        {item.suggestedAction && (
          <div
            style={{
              fontSize: "0.78rem",
              color: T.muted,
            }}
          >
            <span style={{ fontWeight: 600, color: T.text }}>Suggested: </span>
            {item.suggestedAction}
          </div>
        )}
      </div>

      {/* Right: action */}
      {item.affectedLesseeNames.length > 0 && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            alignItems: "flex-end",
            justifyContent: "flex-start",
          }}
        >
          <button
            onClick={() => navigate(item.actionHref, {
              state: { prefill: item.actionPrefill, prefillSource: item.headline },
            })}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "0.375rem",
              border: `1px solid ${T.blue}`,
              background: T.blue,
              color: "#FFFFFF",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {item.actionHref === "/scenarios/run" ? "Run Scenario" : "View Counterparty"}
          </button>
        </div>
      )}
    </div>
  );
}

function DealFeedView() {
  const [catFilter, setCatFilter] = useState<DealCategory | "all">("all");

  const filtered = useMemo(() => {
    const items = catFilter === "all"
      ? DEAL_FEED
      : DEAL_FEED.filter((d) => d.category === catFilter);
    // Sort: high relevance first, then by hoursAgo
    const relOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...items].sort((a, b) => {
      const rDiff = relOrder[a.relevance] - relOrder[b.relevance];
      if (rDiff !== 0) return rDiff;
      return a.hoursAgo - b.hoursAgo;
    });
  }, [catFilter]);

  const counts = useMemo(() => {
    const c: Partial<Record<DealCategory, number>> = {};
    for (const d of DEAL_FEED) c[d.category] = (c[d.category] ?? 0) + 1;
    return c;
  }, []);

  const highRel = DEAL_FEED.filter((d) => d.relevance === "high").length;

  return (
    <div>
      {/* Summary strip */}
      <div
        style={{
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: "0.625rem",
          padding: "0.875rem 1.25rem",
          marginBottom: "1.25rem",
          display: "flex",
          gap: "2rem",
          alignItems: "center",
          fontSize: "0.8125rem",
        }}
      >
        <div>
          <span style={{ fontWeight: 700, color: T.text, fontSize: "1.25rem" }}>{DEAL_FEED.length}</span>
          <span style={{ color: T.muted, marginLeft: "0.375rem" }}>total items</span>
        </div>
        <div>
          <span style={{ fontWeight: 700, color: T.blue, fontSize: "1.25rem" }}>{highRel}</span>
          <span style={{ color: T.muted, marginLeft: "0.375rem" }}>high relevance</span>
        </div>
        <div>
          <span style={{ fontWeight: 700, color: T.red, fontSize: "1.25rem" }}>
            {DEAL_FEED.filter((d) => d.sentiment === "negative").length}
          </span>
          <span style={{ color: T.muted, marginLeft: "0.375rem" }}>negative signals</span>
        </div>
        <div>
          <span style={{ fontWeight: 700, color: T.green, fontSize: "1.25rem" }}>
            {DEAL_FEED.filter((d) => d.sentiment === "positive").length}
          </span>
          <span style={{ color: T.muted, marginLeft: "0.375rem" }}>positive signals</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: "0.75rem", color: T.muted }}>
          Last refreshed: 29 Apr 2026
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {DEAL_CAT_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            active={catFilter === f.id}
            label={f.label}
            count={f.id !== "all" ? counts[f.id as DealCategory] : undefined}
            onClick={() => setCatFilter(f.id)}
          />
        ))}
      </div>

      {/* Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {filtered.map((item) => (
          <DealCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ─── Jurisdiction Watch View ──────────────────────────────────────────────────

function JxCard({ event, lesseeIdByName, liveTotalExposure }: {
  event: JurisdictionEvent;
  lesseeIdByName: Map<string, string>;
  liveTotalExposure: (names: string[], fallback: number) => number;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "0.75rem 1rem",
          borderBottom: `1px solid ${T.border}`,
          background: sentBg(event.sentiment),
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
        }}
      >
        {/* Country code badge */}
        <div
          style={{
            flexShrink: 0,
            width: "2.25rem",
            height: "2.25rem",
            borderRadius: "0.375rem",
            background: T.blue,
            color: "#FFFFFF",
            fontSize: "0.7rem",
            fontWeight: 800,
            letterSpacing: "0.04em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {event.code}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              flexWrap: "wrap",
              marginBottom: "0.25rem",
            }}
          >
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: T.text,
              }}
            >
              {event.jurisdiction}
            </span>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                padding: "0.1rem 0.4rem",
                borderRadius: "9999px",
                background: T.bg,
                color: T.muted,
                border: `1px solid ${T.border}`,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {jxTypeLabel(event.eventType)}
            </span>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                padding: "0.1rem 0.4rem",
                borderRadius: "9999px",
                background: sentBg(event.sentiment),
                color: sentColor(event.sentiment),
                border: `1px solid ${sentColor(event.sentiment)}33`,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {sentLabel(event.sentiment)}
            </span>
            <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: T.muted }}>
              {event.date}
            </span>
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: T.text,
              lineHeight: 1.4,
            }}
          >
            {event.headline}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "0.875rem 1rem" }}>
        {/* Detail — collapsible */}
        <div
          style={{
            fontSize: "0.8125rem",
            color: T.muted,
            lineHeight: 1.65,
            display: expanded ? "block" : "-webkit-box",
            WebkitLineClamp: expanded ? undefined : 2,
            WebkitBoxOrient: "vertical",
            overflow: expanded ? "visible" : "hidden",
          }}
        >
          {event.detail}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: "0.75rem",
            color: T.blue,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.25rem 0",
            fontWeight: 600,
          }}
        >
          {expanded ? "Show less" : "Read more"}
        </button>

        {/* Exposure + lessees */}
        <div
          style={{
            marginTop: "0.625rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: "0.78rem",
              color: T.text,
              fontWeight: 600,
              background: "rgba(0,33,71,0.05)",
              border: `1px solid rgba(0,33,71,0.12)`,
              borderRadius: "0.375rem",
              padding: "0.25rem 0.625rem",
            }}
          >
            Portfolio exposure: {fmtUSD(liveTotalExposure(event.lesseesAffected, event.portfolioExposureUSD))}
          </div>
          {event.lesseesAffected.map((name) => {
            const id = lesseeIdByName.get(name);
            return (
              <button
                key={name}
                onClick={() => id ? navigate(`/counterparties?lessee=${id}`) : navigate("/counterparties")}
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  background: T.bg,
                  color: T.muted,
                  border: `1px solid ${T.border}`,
                  cursor: id ? "pointer" : "default",
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "0.5rem 1rem",
          borderTop: `1px solid ${T.border}`,
          background: T.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.75rem",
        }}
      >
        <span style={{ color: T.muted }}>{event.source}</span>
        <button
          onClick={() => {
            const name = event.lesseesAffected[0];
            const id = name ? lesseeIdByName.get(name) : undefined;
            navigate(id && event.lesseesAffected.length === 1 ? `/counterparties?lessee=${id}` : "/counterparties");
          }}
          style={{
            padding: "0.275rem 0.65rem",
            borderRadius: "0.375rem",
            border: `1px solid ${T.blue}`,
            background: T.blue,
            color: "#FFFFFF",
            fontSize: "0.72rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          View Counterparties
        </button>
      </div>
    </div>
  );
}

function JurisdictionWatchView({ lesseeIdByName, liveTotalExposure }: {
  lesseeIdByName: Map<string, string>;
  liveTotalExposure: (names: string[], fallback: number) => number;
}) {
  const events = useMemo(() => {
    const sentOrder: Record<SignalSentiment, number> = { negative: 0, neutral: 1, positive: 2 };
    return [...JURISDICTION_EVENTS].sort(
      (a, b) => sentOrder[a.sentiment] - sentOrder[b.sentiment]
    );
  }, []);

  const negCount  = events.filter((e) => e.sentiment === "negative").length;
  const posCount  = events.filter((e) => e.sentiment === "positive").length;

  return (
    <div>
      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        {[
          { label: "Jurisdictions with Events", value: events.length, color: T.text,  bg: T.bg      },
          { label: "Negative / Watch Events",   value: negCount,      color: T.red,   bg: T.redBg   },
          { label: "Positive / Improving",      value: posCount,      color: T.green, bg: T.greenBg },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: k.bg,
              border: `1px solid ${T.border}`,
              borderRadius: "0.625rem",
              padding: "0.875rem 1.125rem",
            }}
          >
            <div style={{ fontSize: "1.625rem", fontWeight: 700, color: k.color, lineHeight: 1 }}>
              {k.value}
            </div>
            <div style={{ fontSize: "0.78rem", color: T.muted, marginTop: "0.25rem" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Event cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {events.map((ev) => (
          <JxCard key={ev.id} event={ev} lesseeIdByName={lesseeIdByName} liveTotalExposure={liveTotalExposure} />
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PATH_TO_TAB: Record<string, IntelTab> = {
  "/intelligence/lessee-radar": "lessee-radar",
  "/intelligence/deal-feed":    "deal-feed",
  "/intelligence/jx-watch":    "jx-watch",
};

export default function Intelligence() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab: IntelTab = PATH_TO_TAB[location.pathname] ?? "signals";

  // ── Live portfolio exposure maps (single fetch for the whole page) ──────────
  const { lessees, leases, provisions } = usePortfolioData();
  const { lesseeEADByName, lesseeIdByName } = useMemo(() => {
    const assetToLessee = new Map<string, string>();
    for (const l of leases) assetToLessee.set(l.asset_id, l.lessee_id);
    const eadById = new Map<string, number>();
    for (const p of provisions) {
      const lid = assetToLessee.get(p.asset_id);
      if (!lid) continue;
      eadById.set(lid, (eadById.get(lid) ?? 0) + (p.ead ?? 0));
    }
    const byName = new Map<string, number>();
    const idByName = new Map<string, string>();
    for (const l of lessees) {
      const ead = eadById.get(l.id);
      if (ead !== undefined) byName.set(l.name, ead);
      idByName.set(l.name, l.id);
    }
    return { lesseeEADByName: byName, lesseeIdByName: idByName };
  }, [lessees, leases, provisions]);

  function liveExposure(name: string, fallback: number): number {
    return lesseeEADByName.get(name) ?? fallback;
  }
  function liveTotalExposure(names: string[], fallback: number): number {
    let total = 0; let found = false;
    for (const n of names) {
      const ead = lesseeEADByName.get(n);
      if (ead !== undefined) { total += ead; found = true; }
    }
    return found ? total : fallback;
  }

  // Red dot for high-severity signals
  const highSignals  = MACRO_SIGNALS.filter((s) => s.severity === "high").length;
  const redLessees   = LESSEE_RADAR.filter((l) => l.compositeSignal === "red").length;
  const negDeals     = DEAL_FEED.filter((d) => d.sentiment === "negative" && d.relevance === "high").length;
  const negJx        = JURISDICTION_EVENTS.filter((e) => e.sentiment === "negative").length;

  const badges: Record<IntelTab, number> = {
    "signals":      highSignals,
    "lessee-radar": redLessees,
    "deal-feed":    negDeals,
    "jx-watch":     negJx,
  };

  return (
    <div style={{ padding: "1.5rem 2rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Page header */}
      <PageHeader
        title="Aero Intelligence"
        subtitle="Portfolio-contextualised market intelligence · Powered by free public data feeds"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.3rem 0.75rem",
            borderRadius: "9999px",
            background: T.bg,
            border: `1px solid ${T.border}`,
            fontSize: "0.78rem",
            color: T.muted,
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: T.green,
              flexShrink: 0,
            }}
          />
          Live · Updated 29 Apr 2026
        </div>
      </PageHeader>

      {/* Sub-tab nav */}
      <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "4px", marginBottom: "1.5rem", width: "fit-content" }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const badge  = badges[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => navigate(`/intelligence/${tab.id}`)}
              style={{
                padding: "7px 20px", borderRadius: "9999px", border: "none",
                background: active ? "#002147" : "transparent",
                color: active ? "#FFFFFF" : "#64748B",
                fontSize: "13px", fontWeight: active ? 600 : 500,
                cursor: "pointer", transition: "all 180ms cubic-bezier(0.23,1,0.32,1)",
                boxShadow: active ? "0 1px 4px rgba(0,33,71,0.18)" : "none",
                whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.4rem",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#002147"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}
            >
              {tab.label}
              {badge > 0 && (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    minWidth: "18px", height: "18px", borderRadius: "9999px",
                    background: active ? "rgba(255,255,255,0.25)" : T.red,
                    color: "#FFFFFF", fontSize: "0.65rem", fontWeight: 800, padding: "0 0.3rem",
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* View */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          {activeTab === "signals"      && <MacroSignalsView lesseeIdByName={lesseeIdByName} liveExposure={liveExposure} />}
          {activeTab === "lessee-radar" && <LesseeRadarView lesseeIdByName={lesseeIdByName} liveExposure={liveExposure} />}
          {activeTab === "deal-feed"    && <DealFeedView    />}
          {activeTab === "jx-watch"     && <JurisdictionWatchView lesseeIdByName={lesseeIdByName} liveTotalExposure={liveTotalExposure} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
