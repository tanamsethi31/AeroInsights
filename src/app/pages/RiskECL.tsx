import { useState, useEffect, useRef, type ReactNode } from "react";
import { MR_ADEQUACY, mrFlagColor } from "../data/maintenanceHeuristics";
import { useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable, sortIcon, sortIconStyle } from "../components/ui/useSortable";
import { useViewMode } from "../contexts/ViewModeContext";

const PATH_TAB: Record<string, string> = {
  "/risk-ecl/summary":   "ECL Overview",
  "/risk-ecl/migration": "Stage Migration",
  "/risk-ecl/waterfall": "Sensitivity",
};
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import { KpiCard } from "../components/ui/KpiCard";
import { StatusPill } from "../components/ui/StatusPill";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import {
  Download,
  Info,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  SlidersHorizontal,
  RotateCcw,
  Save,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  ECLDrilldownPanel,
  type LeaseRow,
} from "../components/risk-ecl/ECLDrilldownPanel";
import { IAS36Tab } from "../components/risk-ecl/IAS36Tab";
import { StageMigrationTab } from "../components/risk-ecl/StageMigrationTab";
import { usePortfolioData } from "../hooks/usePortfolioData";
import { toEclTableRows, toDashboardKPIs, toPortfolioKPIs } from "../lib/portfolioAdapters";
import {
  BASE_ECL,
  ZERO_INPUTS,
  computeECLFromBase,
  type ScenarioInputs,
} from "../utils/eclCalculator";

const tornadoData = [
  { input: "PD Multiplier (Stage 3)", impact: 8.4, dir: "positive" },
  { input: "LGD Rate (Stage 3)", impact: 6.1, dir: "positive" },
  { input: "Aircraft Market Value", impact: -5.2, dir: "negative" },
  { input: "Discount Rate (WACC)", impact: -3.8, dir: "negative" },
  { input: "PD Multiplier (Stage 2)", impact: 3.2, dir: "positive" },
];

const eclTrendByStage = [
  { quarter: "Q1 '25", s1: 7.1, s2: 18.4, s3: 14.2 },
  { quarter: "Q2 '25", s1: 7.4, s2: 19.1, s3: 15.4 },
  { quarter: "Q3 '25", s1: 7.8, s2: 19.8, s3: 15.1 },
  { quarter: "Q4 '25", s1: 8.1, s2: 20.4, s3: 16.3 },
  { quarter: "Q1 '26", s1: 8.4, s2: 21.6, s3: 17.2 },
];

// Predefined scenario stress inputs (replace hardcoded scenarioSummary constants)
const ADVERSE_INPUTS: ScenarioInputs = {
  gdpDelta: -0.02,
  rpkDelta: -0.25,
  fuelDelta: 0.30,
  fxDelta: 0,
  rateDelta: 0.01,
  assetValueDelta: -0.10,
  pdS2Multi: 1.5,
  pdS3Multi: 2.0,
};

const UPSIDE_INPUTS: ScenarioInputs = {
  gdpDelta: 0.01,
  rpkDelta: 0.08,
  fuelDelta: -0.15,
  fxDelta: 0,
  rateDelta: -0.005,
  assetValueDelta: 0.05,
  pdS2Multi: 0.8,
  pdS3Multi: 0.8,
};

// Default SICR config
const defaultSicrConfig = {
  dpdEnabled: true,
  dpdDays: 30,
  upgradeEnabled: true,
  upgradeNotches: 2,
  countryWatchlistEnabled: true,
  insolvencyEnabled: true,
};

const tabs = [
  "ECL Overview",
  "Stage Migration",
  "ECL by Lease",
  "Sensitivity",
  "SICR Config",
  "IAS 36 Impairment",
];

// Tabs surfaced to C-Suite in Executive Mode — keep only the headline views
const EXEC_TABS = ["ECL Overview", "IAS 36 Impairment"];

// ─── IAS 36 summary (mirrors DEFAULT_AIRCRAFT in IAS36Tab, kept in sync) ─────
// 3 aircraft where carrying value exceeds max(FVLCD, VIU)
const IAS36_ALERT = {
  count: 3,
  totalImpairment: 11.7, // $M: A320neo 1.1 + B737-800 4.7 + A330-300 5.9
  aircraft: [
    { msn: "9218",  type: "A320neo",  lessee: "IndiGo Airlines",    impairment: 1.1 },
    { msn: "41234", type: "B737-800", lessee: "Aeromexico",          impairment: 4.7 },
    { msn: "1728",  type: "A330-300", lessee: "SriLankan Airlines",  impairment: 5.9 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${n.toFixed(1)}M`;
const pct = (n: number) => `${n.toFixed(2)}%`;

/** Collapsible section used to replace Fade-hidden analyst blocks. */
function RiskSection({
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
        {/* ChevronDown from lucide-react — imported below */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {label}
      </button>
      {open && children}
    </div>
  );
}

type ScenarioSummaryEntry = { ecl12m: number; eclLifetime: number; coverage: number };
type ScenarioSummaryData = {
  base: ScenarioSummaryEntry;
  adverse: ScenarioSummaryEntry;
  upside: ScenarioSummaryEntry;
};

function computeWeightedECL(
  weights: { base: number; adverse: number; upside: number },
  summary: ScenarioSummaryData,
) {
  const ecl12m =
    (summary.base.ecl12m * weights.base +
      summary.adverse.ecl12m * weights.adverse +
      summary.upside.ecl12m * weights.upside) /
    100;
  const eclLifetime =
    (summary.base.eclLifetime * weights.base +
      summary.adverse.eclLifetime * weights.adverse +
      summary.upside.eclLifetime * weights.upside) /
    100;
  const coverage =
    (summary.base.coverage * weights.base +
      summary.adverse.coverage * weights.adverse +
      summary.upside.coverage * weights.upside) /
    100;
  return { ecl12m, eclLifetime, coverage };
}



// ─── Page Component ───────────────────────────────────────────────────────────

export default function RiskECL() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isExecutiveMode } = useViewMode();
  const [activeTab, setActiveTab] = useState(() => PATH_TAB[pathname] ?? "ECL Overview");
  useEffect(() => { setActiveTab(PATH_TAB[pathname] ?? "ECL Overview"); }, [pathname]);
  // When executive mode turns on, fall back to a tab that's visible in exec mode
  useEffect(() => {
    if (isExecutiveMode && !EXEC_TABS.includes(activeTab)) {
      setActiveTab("ECL Overview");
    }
  }, [isExecutiveMode, activeTab]);
  const [drilldownLease, setDrilldownLease] = useState<LeaseRow | null>(null);
  const [weights, setWeights] = useState({ base: 60, adverse: 25, upside: 15 });
  const [weightEdit, setWeightEdit] = useState({
    base: "60",
    adverse: "25",
    upside: "15",
  });
  const [sicrConfig, setSicrConfig] = useState({ ...defaultSicrConfig });
  const [sicrDirty, setSicrDirty] = useState(false);
  const [sicrSaved, setSicrSaved] = useState(false);

  const { assets, lessees, leases, provisions, isLoading } = usePortfolioData();
  const eclByLease = toEclTableRows(provisions, assets, lessees, leases);

  const s1Rows = eclByLease.filter(r => r.stage === "1");
  const s2Rows = eclByLease.filter(r => r.stage === "2");
  const s3Rows = eclByLease.filter(r => r.stage === "3");

  const s1ECL  = s1Rows.reduce((s, r) => s + r.ecl12m,      0);
  const s2ECL  = s2Rows.reduce((s, r) => s + r.eclLifetime,  0);
  const s3ECL  = s3Rows.reduce((s, r) => s + r.eclLifetime,  0);
  const s1EAD  = s1Rows.reduce((s, r) => s + r.eadNum,       0);
  const s1Coverage = s1EAD > 0 ? (s1ECL / s1EAD) * 100 : 0;

  // Compute live base ECL and coverage
  const liveBaseECL = (() => {
    const kpis = toDashboardKPIs(assets, lessees, provisions);
    return kpis.totalECLm > 0 ? kpis.totalECLm : BASE_ECL;
  })();

  const totalEADm = provisions.reduce((s, p) => s + (p.ead ?? 0), 0) / 1_000_000;

  const scenarioSummary: ScenarioSummaryData = (() => {
    const LIFETIME_RATIO = 80.4 / 44.1; // preserve original ratio (~1.82)
    const baseECL     = computeECLFromBase(liveBaseECL, ZERO_INPUTS);
    const adverseECL  = computeECLFromBase(liveBaseECL, ADVERSE_INPUTS);
    const upsideECL   = computeECLFromBase(liveBaseECL, UPSIDE_INPUTS);
    const cov = (ecl: number) => totalEADm > 0 ? (ecl / totalEADm) * 100 : 0;
    return {
      base:    { ecl12m: baseECL,    eclLifetime: baseECL    * LIFETIME_RATIO, coverage: cov(baseECL)    },
      adverse: { ecl12m: adverseECL, eclLifetime: adverseECL * LIFETIME_RATIO, coverage: cov(adverseECL) },
      upside:  { ecl12m: upsideECL,  eclLifetime: upsideECL  * LIFETIME_RATIO, coverage: cov(upsideECL)  },
    };
  })();

  const weightSum = weights.base + weights.adverse + weights.upside;
  const weightsValid = weightSum === 100;
  const weighted = computeWeightedECL(weights, scenarioSummary);

  const eclAccessors = {
    lessee: (r: LeaseRow) => r.lessee,
    aircraft: (r: LeaseRow) => r.aircraft,
    ead: (r: LeaseRow) => r.eadNum,
    pd12m: (r: LeaseRow) => r.pd12m,
    pdLifetime: (r: LeaseRow) => r.pdLifetime,
    lgd: (r: LeaseRow) => r.lgd,
    ecl12m: (r: LeaseRow) => r.ecl12m,
    eclLifetime: (r: LeaseRow) => r.eclLifetime,
    stage: (r: LeaseRow) => parseInt(r.stage),
  };
  const { sorted: sortedECL, sortState: eclSortState, toggleSort: toggleECLSort } = useSortable(eclByLease, eclAccessors);

  function handleWeightChange(
    key: "base" | "adverse" | "upside",
    rawVal: string
  ) {
    setWeightEdit((prev) => ({ ...prev, [key]: rawVal }));
    const parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      setWeights((prev) => ({ ...prev, [key]: parsed }));
    }
  }

  function handleSicrChange(
    key: keyof typeof sicrConfig,
    value: boolean | number
  ) {
    setSicrConfig((prev) => ({ ...prev, [key]: value }));
    setSicrDirty(true);
    setSicrSaved(false);
  }

  function saveSicrConfig() {
    setSicrDirty(false);
    setSicrSaved(true);
    setTimeout(() => setSicrSaved(false), 2000);
  }

  function resetSicrConfig() {
    setSicrConfig({ ...defaultSicrConfig });
    setSicrDirty(false);
    setSicrSaved(false);
  }

  // ── ECL Overview tab ──────────────────────────────────────────────────────

  const OverviewTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Scenario Weight Controller — title simplified in Executive Mode */}
      <Card
        title={isExecutiveMode ? "ECL Summary" : "Scenario Probability Weights"}
        subtitle={
          isExecutiveMode
            ? "Probability-weighted expected credit loss across scenarios"
            : "IFRS 9 ITG — probability-weighted ECL across ≥3 scenarios. Weights must sum to 100%."
        }
      >
        {/* Weight sliders — collapsible; collapsed by default in Executive Mode */}
        <RiskSection label="Probability Controls" defaultOpen={!isExecutiveMode}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr auto",
            gap: "1rem",
            alignItems: "flex-end",
          }}
        >
          {(
            [
              { key: "base" as const, label: "Baseline", color: "#002147" },
              { key: "adverse" as const, label: "Adverse / Downside", color: "#B45309" },
              { key: "upside" as const, label: "Upside", color: "#15803D" },
            ] as const
          ).map((s) => (
            <div key={s.key}>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  color: "#475569",
                  marginBottom: "0.375rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: s.color,
                  }}
                />
                {s.label}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <button
                  onClick={() =>
                    handleWeightChange(s.key, String(Math.max(0, weights[s.key] - 5)))
                  }
                  style={{
                    width: "28px",
                    height: "28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#F4F5F7",
                    border: "1px solid #E2E8F0",
                    borderRadius: "9999px",
                    cursor: "pointer",
                    color: "#475569",
                    flexShrink: 0,
                  }}
                >
                  <ChevronDown size={13} />
                </button>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weightEdit[s.key]}
                    onChange={(e) => handleWeightChange(s.key, e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 1.75rem 0.5rem 0.75rem",
                      border: `1px solid ${weightsValid ? "#E2E8F0" : "#B91C1C"}`,
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#0F172A",
                      background: "#FFFFFF",
                      fontVariantNumeric: "tabular-nums",
                      textAlign: "right",
                      appearance: "none",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: "0.625rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "0.8125rem",
                      color: "#94A3B8",
                      pointerEvents: "none",
                    }}
                  >
                    %
                  </span>
                </div>
                <button
                  onClick={() =>
                    handleWeightChange(s.key, String(Math.min(100, weights[s.key] + 5))
                    )
                  }
                  style={{
                    width: "28px",
                    height: "28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#F4F5F7",
                    border: "1px solid #E2E8F0",
                    borderRadius: "9999px",
                    cursor: "pointer",
                    color: "#475569",
                    flexShrink: 0,
                  }}
                >
                  <ChevronUp size={13} />
                </button>
              </div>
            </div>
          ))}
          <div style={{ paddingBottom: "0.125rem" }}>
            <div
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                background: weightsValid
                  ? "rgba(21,128,61,0.08)"
                  : "rgba(185,28,28,0.08)",
                border: `1px solid ${weightsValid ? "rgba(21,128,61,0.25)" : "rgba(185,28,28,0.25)"}`,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  color: weightsValid ? "#15803D" : "#B91C1C",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {weightSum}%
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  color: weightsValid ? "#15803D" : "#B91C1C",
                  marginTop: "0.125rem",
                }}
              >
                {weightsValid
                  ? <><i className="bi bi-check" style={{ marginRight: "2px" }} />Valid</>
                  : "Must = 100%"}
              </div>
            </div>
          </div>
        </div>
        </RiskSection>

        {/* Probability-Weighted ECL Summary Table — always visible */}
        {weightsValid && (
          <div style={{ marginTop: "1.25rem" }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.625rem",
              }}
            >
              Probability-Weighted Portfolio ECL
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.8125rem",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <th
                    style={{
                      padding: "0.5rem 0.625rem",
                      textAlign: "left",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#94A3B8",
                      textTransform: "uppercase",
                    }}
                  >
                    Metric
                  </th>
                  {[
                    { label: "Baseline", weight: weights.base, color: "#002147" },
                    { label: "Adverse", weight: weights.adverse, color: "#B45309" },
                    { label: "Upside", weight: weights.upside, color: "#15803D" },
                  ].map((s) => (
                    <th
                      key={s.label}
                      style={{
                        padding: "0.5rem 0.625rem",
                        textAlign: "right",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: s.color,
                        textTransform: "uppercase",
                      }}
                    >
                      {s.label}{" "}
                      <span style={{ color: "#94A3B8", fontWeight: 400 }}>
                        {s.weight}%
                      </span>
                    </th>
                  ))}
                  <th
                    style={{
                      padding: "0.5rem 0.625rem",
                      textAlign: "right",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#0F172A",
                      textTransform: "uppercase",
                      background: "rgba(0,33,71,0.04)",
                    }}
                  >
                    Weighted ECL
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: "ECL 12-month",
                    baseV: scenarioSummary.base.ecl12m,
                    advV: scenarioSummary.adverse.ecl12m,
                    upV: scenarioSummary.upside.ecl12m,
                    wV: weighted.ecl12m,
                    fmt: fmt,
                  },
                  {
                    label: "ECL Lifetime",
                    baseV: scenarioSummary.base.eclLifetime,
                    advV: scenarioSummary.adverse.eclLifetime,
                    upV: scenarioSummary.upside.eclLifetime,
                    wV: weighted.eclLifetime,
                    fmt: fmt,
                  },
                  {
                    label: "Coverage Ratio",
                    baseV: scenarioSummary.base.coverage,
                    advV: scenarioSummary.adverse.coverage,
                    upV: scenarioSummary.upside.coverage,
                    wV: weighted.coverage,
                    fmt: pct,
                  },
                ].map((row, i) => (
                  <tr
                    key={row.label}
                    style={{
                      borderBottom: "1px solid #E2E8F0",
                      background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                    }}
                  >
                    <td
                      style={{
                        padding: "0.625rem 0.625rem",
                        color: "#475569",
                        fontWeight: 500,
                      }}
                    >
                      {row.label}
                    </td>
                    <td
                      style={{
                        padding: "0.625rem 0.625rem",
                        textAlign: "right",
                        color: "#0F172A",
                      }}
                    >
                      {row.fmt(row.baseV)}
                    </td>
                    <td
                      style={{
                        padding: "0.625rem 0.625rem",
                        textAlign: "right",
                        color: "#B45309",
                      }}
                    >
                      {row.fmt(row.advV)}
                    </td>
                    <td
                      style={{
                        padding: "0.625rem 0.625rem",
                        textAlign: "right",
                        color: "#15803D",
                      }}
                    >
                      {row.fmt(row.upV)}
                    </td>
                    <td
                      style={{
                        padding: "0.625rem 0.625rem",
                        textAlign: "right",
                        fontWeight: 600,
                        color: "#002147",
                        background: "rgba(0,33,71,0.04)",
                      }}
                    >
                      {row.fmt(row.wV)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Charts row — collapsible; collapsed by default in Executive Mode */}
      <RiskSection label="Stage Analysis Charts" defaultOpen={!isExecutiveMode}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        <Card
          title="ECL by Stage — Quarterly Trend"
          subtitle="Stage 1 (12-month) · Stage 2/3 (Lifetime)"
        >
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart
              data={eclTrendByStage}
              margin={{ top: 5, right: 10, bottom: 0, left: 0 }}
            >
              <defs>
                {[
                  { id: "ecl-s1-grad", color: "#15803D" },
                  { id: "ecl-s2-grad", color: "#B45309" },
                  { id: "ecl-s3-grad", color: "#B91C1C" },
                ].map((g) => (
                  <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={g.color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={g.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="quarter"
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}M`}
              />
              <Tooltip
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0.75rem",
                  fontSize: "0.8125rem",
                }}
                formatter={(v: number, name: string) => [`$${v}M`, name]}
              />
              <Area
                type="monotone"
                dataKey="s1"
                name="Stage 1"
                stroke="#15803D"
                strokeWidth={2}
                fill="url(#ecl-s1-grad)"
              />
              <Area
                type="monotone"
                dataKey="s2"
                name="Stage 2"
                stroke="#B45309"
                strokeWidth={2}
                fill="url(#ecl-s2-grad)"
              />
              <Area
                type="monotone"
                dataKey="s3"
                name="Stage 3"
                stroke="#B91C1C"
                strokeWidth={2}
                fill="url(#ecl-s3-grad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="ECL Coverage Ratios" subtitle="vs. carrying amount (EAD)">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              { label: "Stage 1 Coverage", value: "1.09%", width: "1.09%", color: "#15803D" },
              { label: "Stage 2 Coverage", value: "18.3%", width: "18.3%", color: "#B45309" },
              { label: "Stage 3 Coverage", value: "71.2%", width: "71.2%", color: "#B91C1C" },
              { label: "Portfolio Coverage", value: pct(weighted.coverage), width: `${weighted.coverage}%`, color: "#002147" },
            ].map((item) => (
              <div key={item.label}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.375rem",
                  }}
                >
                  <span style={{ fontSize: "0.8125rem", color: "#475569" }}>
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: item.color,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {item.value}
                  </span>
                </div>
                <div style={{ height: "6px", background: "#E2E8F0", borderRadius: "3px" }}>
                  <div
                    style={{
                      width: item.width,
                      height: "100%",
                      background: item.color,
                      borderRadius: "3px",
                    }}
                  />
                </div>
              </div>
            ))}

            <div
              style={{
                padding: "0.75rem",
                background: "#F4F5F7",
                borderRadius: "0.75rem",
                fontSize: "0.8125rem",
                color: "#475569",
                marginTop: "0.25rem",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: "#0F172A",
                  marginBottom: "0.25rem",
                }}
              >
                Active Scenario Weights
              </div>
              {[
                { label: "Baseline", w: weights.base },
                { label: "Adverse", w: weights.adverse },
                { label: "Upside", w: weights.upside },
              ].map((r) => (
                <div
                  key={r.label}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>{r.label}</span>
                  <span style={{ fontWeight: 600 }}>{r.w}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
      </RiskSection>
    </div>
  );

  // ── ECL by Lease tab ──────────────────────────────────────────────────────

  const LeaseTab = () => (
    <Card
      title="ECL by Lease"
      subtitle="Individual lease ECL — baseline scenario, Q1 2026 · Click 'Show Calc' for PD term structure, scenario weighting & journal entry"
      noPadding
    >
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.8125rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <thead>
            <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
              {([
                { label: "Lease ID", key: null },
                { label: "Lessee", key: "lessee" },
                { label: "Aircraft", key: "aircraft" },
                { label: "EAD", key: "ead" },
                { label: "PD 12m", key: "pd12m" },
                { label: "PD Lifetime", key: "pdLifetime" },
                { label: "LGD", key: "lgd" },
                { label: "ECL 12m", key: "ecl12m" },
                { label: "ECL Lifetime", key: "eclLifetime" },
                { label: "Stage", key: "stage" },
                { label: "MR Impact", key: null },
                { label: "", key: null },
              ] as { label: string; key: string | null }[]).map(({ label, key }) => (
                <th
                  key={label || "_action"}
                  onClick={key ? () => toggleECLSort(key) : undefined}
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#0F172A",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                    cursor: key ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {label}
                  {key && <span style={sortIconStyle(key, eclSortState)}>{sortIcon(key, eclSortState)}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedECL.map((row, i) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: "1px solid #E2E8F0",
                  background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background =
                    "#FAFAFA")
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
                  {row.id}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <button
                    onClick={() => navigate(`/counterparties?lessee=${row.lesseeId}`)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "0.8125rem",
                      color: "#002147",
                      padding: 0,
                      textDecoration: "underline",
                      textDecorationColor: "rgba(0,33,71,0.3)",
                      textUnderlineOffset: "2px",
                    }}
                  >
                    {row.lessee}
                  </button>
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                  {row.aircraft}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>
                  ${row.eadNum.toFixed(1)}M
                </td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    color: "#0F172A",
                    fontWeight: 500,
                  }}
                >
                  {row.pd12m.toFixed(1)}%
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>
                  {row.pdLifetime.toFixed(1)}%
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>
                  {row.lgd.toFixed(0)}%
                </td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    color: "#0F172A",
                    fontWeight: 500,
                  }}
                >
                  ${row.ecl12m.toFixed(2)}M
                </td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    fontWeight: 600,
                    color:
                      row.stage === "3"
                        ? "#B91C1C"
                        : row.stage === "2"
                        ? "#B45309"
                        : "#0F172A",
                  }}
                >
                  ${row.eclLifetime.toFixed(2)}M
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <StatusPill stage={row.stage} label={`Stage ${row.stage}`} />
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  {(() => {
                    const adeq = MR_ADEQUACY[row.id];
                    if (!adeq || adeq.eolShortfall <= 0) {
                      return <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>—</span>;
                    }
                    const shortfallM = (adeq.eolShortfall / 1_000_000).toFixed(2);
                    return (
                      <span
                        title={`MR shortfall of $${shortfallM}M at EOL reduces LGD offset by ${adeq.eolShortfallPct.toFixed(1)}%. Navigate to Portfolio > Aircraft > Maintenance Forecast for full breakdown.`}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: "0.25rem",
                          fontSize: "0.6875rem", fontWeight: 600,
                          color: mrFlagColor(adeq.flag),
                          background: adeq.flag === "red" ? "rgba(185,28,28,0.07)" : "rgba(180,83,9,0.07)",
                          border: `1px solid ${adeq.flag === "red" ? "rgba(185,28,28,0.2)" : "rgba(180,83,9,0.2)"}`,
                          borderRadius: "0.375rem", padding: "0.2rem 0.5rem",
                          cursor: "help",
                        }}
                      >
                        ▲ −${shortfallM}M LGD
                      </span>
                    );
                  })()}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <button
                    onClick={() => setDrilldownLease(row)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: "0.75rem",
                      color: "#002147",
                      background: "transparent",
                      border: "1px solid #E2E8F0",
                      borderRadius: "9999px",
                      padding: "0.25rem 0.625rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Info size={11} /> Show Calc
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  // ── Sensitivity tab ───────────────────────────────────────────────────────

  const SensitivityTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
      <Card
        title="Tornado Chart — Top 5 ECL Drivers"
        subtitle="±1σ shock to each input, holding others constant (portfolio level)"
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={tornadoData}
            layout="vertical"
            margin={{ left: 40, right: 40, top: 10, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#E2E8F0"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${Math.abs(v)}M`}
            />
            <YAxis
              type="category"
              dataKey="input"
              tick={{ fontSize: 10, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
              width={160}
            />
            <Tooltip
              formatter={(v: number) => [
                `$${Math.abs(v as number).toFixed(1)}M`,
                "ECL Impact",
              ]}
              contentStyle={{
                fontSize: "0.8125rem",
                border: "1px solid #E2E8F0",
                borderRadius: "0.75rem",
              }}
            />
            <Bar dataKey="impact" radius={[0, 3, 3, 0]}>
              {tornadoData.map((entry) => (
                <Cell
                  key={`cell-${entry.input}`}
                  fill={entry.dir === "positive" ? "#B91C1C" : "#15803D"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card
        title="Sensitivity Table"
        subtitle="ECL change per ±10% shock to key inputs (portfolio level)"
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              <th
                style={{
                  padding: "0.5rem",
                  textAlign: "left",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#94A3B8",
                  textTransform: "uppercase",
                }}
              >
                Input
              </th>
              {["+10%", "−10%"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "0.5rem",
                    textAlign: "right",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { input: "PD (all stages)", up: "+$4.7M", down: "−$4.7M", upDir: "neg", downDir: "pos" },
              { input: "LGD Rate", up: "+$3.8M", down: "−$3.8M", upDir: "neg", downDir: "pos" },
              { input: "Aircraft MV", up: "−$2.9M", down: "+$3.1M", upDir: "pos", downDir: "neg" },
              { input: "Discount Rate", up: "−$1.8M", down: "+$1.9M", upDir: "pos", downDir: "neg" },
              { input: "Stage 2 Count", up: "+$2.1M", down: "−$2.1M", upDir: "neg", downDir: "pos" },
              { input: "EAD (book value)", up: "+$4.7M", down: "−$4.7M", upDir: "neg", downDir: "pos" },
            ].map((row, i) => (
              <tr
                key={row.input}
                style={{
                  borderBottom: "1px solid #E2E8F0",
                  background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7",
                }}
              >
                <td style={{ padding: "0.75rem 0.5rem", color: "#475569" }}>
                  {row.input}
                </td>
                <td
                  style={{
                    padding: "0.75rem 0.5rem",
                    textAlign: "right",
                    color: row.upDir === "neg" ? "#B91C1C" : "#15803D",
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.up}
                </td>
                <td
                  style={{
                    padding: "0.75rem 0.5rem",
                    textAlign: "right",
                    color: row.downDir === "neg" ? "#B91C1C" : "#15803D",
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.down}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  // ── SICR Config tab ───────────────────────────────────────────────────────

  const SICRConfigTab = () => {
    const triggerCards = [
      {
        key: "dpd" as const,
        title: "Days Past Due Backstop",
        icon: <TrendingDown size={16} color="#B91C1C" />,
        description:
          "IFRS 9 §B5.5.19 — 30 DPD is a rebuttable presumption for SICR. Trigger applies at lease-payment level.",
        enabledKey: "dpdEnabled" as const,
        valueKey: "dpdDays" as const,
        valueLabel: "days",
        valueMin: 1,
        valueMax: 90,
        triggered: 3,
      },
      {
        key: "upgrade" as const,
        title: "Credit Downgrade Threshold",
        icon: <TrendingDown size={16} color="#B45309" />,
        description:
          "External or internal credit rating downgrade. Applies to agency ratings (Moody's, S&P, Fitch) and internal PD-band migrations.",
        enabledKey: "upgradeEnabled" as const,
        valueKey: "upgradeNotches" as const,
        valueLabel: "notches",
        valueMin: 1,
        valueMax: 5,
        triggered: 1,
      },
      {
        key: "country" as const,
        title: "Country Watchlist Event",
        icon: <AlertTriangle size={16} color="#B45309" />,
        description:
          "AWG CTC score change ≥4 pts, sovereign CDS widening >150bps, or explicit jurisdiction watchlist flag. Auto-sourced from jurisdiction feed.",
        enabledKey: "countryWatchlistEnabled" as const,
        valueKey: null,
        valueLabel: null,
        valueMin: 0,
        valueMax: 0,
        triggered: 2,
      },
      {
        key: "insolvency" as const,
        title: "Lessee Insolvency Filing",
        icon: <AlertTriangle size={16} color="#B91C1C" />,
        description:
          "Chapter 11, IBC, RJ, Concurso, PKPU, or equivalent filing. Applied on the date of formal petition. Automatic Stage 3 classification.",
        enabledKey: "insolvencyEnabled" as const,
        valueKey: null,
        valueLabel: null,
        valueMin: 0,
        valueMax: 0,
        triggered: 1,
      },
    ] as const;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header notice */}
        <div
          style={{
            padding: "0.875rem 1.125rem",
            background: "rgba(0,33,71,0.04)",
            borderRadius: "0.625rem",
            borderLeft: "3px solid #002147",
            fontSize: "0.8125rem",
            color: "#475569",
          }}
        >
          <span style={{ fontWeight: 600, color: "#0F172A" }}>
            FR-F02-001 — Configurable SICR Triggers.&nbsp;
          </span>
          Changes take effect on the next ECL recalculation run. Audit log entry created on save.
          All four IFRS 9 triggers are independent; any single trigger is sufficient for SICR classification.
        </div>

        {/* Trigger Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
          {triggerCards.map((card) => {
            const enabled =
              sicrConfig[card.enabledKey as keyof typeof sicrConfig] as boolean;
            return (
              <div
                key={card.key}
                style={{
                  padding: "1.25rem",
                  border: `1px solid ${enabled ? "#002147" : "#E2E8F0"}`,
                  borderRadius: "0.75rem",
                  background: enabled ? "rgba(0,33,71,0.03)" : "#FFFFFF",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    {card.icon}
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#0F172A",
                      }}
                    >
                      {card.title}
                    </span>
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={() =>
                      handleSicrChange(card.enabledKey, !enabled)
                    }
                    style={{
                      width: "42px",
                      height: "24px",
                      borderRadius: "9999px",
                      background: enabled ? "#002147" : "#E2E8F0",
                      border: "none",
                      cursor: "pointer",
                      position: "relative",
                      flexShrink: 0,
                      transition: "background 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: "3px",
                        left: enabled ? "21px" : "3px",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: "#FFFFFF",
                        transition: "left 0.15s ease",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                      }}
                    />
                  </button>
                </div>

                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "#475569",
                    lineHeight: 1.55,
                    marginBottom: "0.875rem",
                  }}
                >
                  {card.description}
                </p>

                {card.valueKey && enabled && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        color: "#475569",
                        fontWeight: 500,
                      }}
                    >
                      Threshold:
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                      }}
                    >
                      <button
                        onClick={() =>
                          handleSicrChange(
                            card.valueKey!,
                            Math.max(
                              card.valueMin,
                              (sicrConfig[card.valueKey as keyof typeof sicrConfig] as number) - 1
                            )
                          )
                        }
                        style={{
                          width: "26px",
                          height: "26px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#F4F5F7",
                          border: "1px solid #E2E8F0",
                          borderRadius: "9999px",
                          cursor: "pointer",
                          color: "#475569",
                        }}
                      >
                        <ChevronDown size={12} />
                      </button>
                      <input
                        type="number"
                        min={card.valueMin}
                        max={card.valueMax}
                        value={
                          sicrConfig[
                            card.valueKey as keyof typeof sicrConfig
                          ] as number
                        }
                        onChange={(e) =>
                          handleSicrChange(
                            card.valueKey!,
                            parseInt(e.target.value, 10) || card.valueMin
                          )
                        }
                        style={{
                          width: "56px",
                          padding: "0.375rem 0.5rem",
                          border: "1px solid #E2E8F0",
                          borderRadius: "0.375rem",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#0F172A",
                          textAlign: "center",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      />
                      <button
                        onClick={() =>
                          handleSicrChange(
                            card.valueKey!,
                            Math.min(
                              card.valueMax,
                              (sicrConfig[card.valueKey as keyof typeof sicrConfig] as number) + 1
                            )
                          )
                        }
                        style={{
                          width: "26px",
                          height: "26px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#F4F5F7",
                          border: "1px solid #E2E8F0",
                          borderRadius: "9999px",
                          cursor: "pointer",
                          color: "#475569",
                        }}
                      >
                        <ChevronUp size={12} />
                      </button>
                      <span
                        style={{ fontSize: "0.8125rem", color: "#94A3B8" }}
                      >
                        {card.valueLabel}
                      </span>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "0.625rem",
                    borderTop: "1px solid #E2E8F0",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: enabled ? "#475569" : "#94A3B8",
                    }}
                  >
                    Currently triggering{" "}
                    <strong
                      style={{
                        color: enabled
                          ? card.triggered > 0
                            ? "#B91C1C"
                            : "#15803D"
                          : "#94A3B8",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {card.triggered}
                    </strong>{" "}
                    lease{card.triggered !== 1 ? "s" : ""}
                  </span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "9999px",
                      background: enabled
                        ? "rgba(21,128,61,0.1)"
                        : "rgba(148,163,184,0.15)",
                      color: enabled ? "#15803D" : "#94A3B8",
                      fontWeight: 500,
                    }}
                  >
                    {enabled ? "ACTIVE" : "DISABLED"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Rules Summary */}
        <Card title="Active Rules Summary" subtitle="Current SICR classification state — portfolio">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1rem",
              marginBottom: "1.25rem",
            }}
          >
            {[
              {
                label: "Active Triggers",
                value: [
                  sicrConfig.dpdEnabled,
                  sicrConfig.upgradeEnabled,
                  sicrConfig.countryWatchlistEnabled,
                  sicrConfig.insolvencyEnabled,
                ].filter(Boolean).length,
                sub: "of 4 enabled",
                color: "#002147",
              },
              {
                label: "Leases Flagged",
                value: 7,
                sub: "≥1 SICR trigger active",
                color: "#B45309",
              },
              {
                label: "Stage 3 (Lifetime ECL)",
                value: 2,
                sub: "default / impaired",
                color: "#B91C1C",
              },
              {
                label: "Stage 2 (Lifetime ECL)",
                value: 5,
                sub: "SICR identified",
                color: "#B45309",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  padding: "1rem",
                  background: "#F4F5F7",
                  borderRadius: "0.625rem",
                  borderLeft: `3px solid ${stat.color}`,
                }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 600,
                    color: stat.color,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0F172A" }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>
                  {stat.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Save / Reset */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "1rem",
              borderTop: "1px solid #E2E8F0",
            }}
          >
            <div style={{ fontSize: "0.8125rem", color: "#94A3B8" }}>
              {sicrSaved ? (
                <span style={{ color: "#15803D", fontWeight: 500 }}>
                  <i className="bi bi-check-circle-fill" style={{ marginRight: "4px", color: "#15803D" }} />Configuration saved — audit log entry created
                </span>
              ) : sicrDirty ? (
                <span style={{ color: "#B45309" }}>Unsaved changes</span>
              ) : (
                "No pending changes"
              )}
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={resetSicrConfig}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.5rem 1rem",
                  background: "#F4F5F7",
                  border: "1px solid #E2E8F0",
                  borderRadius: "9999px",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={13} /> Reset to Defaults
              </button>
              <button
                onClick={saveSicrConfig}
                disabled={!sicrDirty}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.5rem 1.125rem",
                  background: sicrDirty ? "#002147" : "#CBD5E1",
                  border: "none",
                  borderRadius: "9999px",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#FFFFFF",
                  cursor: sicrDirty ? "pointer" : "not-allowed",
                }}
              >
                <Save size={13} /> Save Configuration
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ height: 48, borderRadius: 8, background: "#E2E8F0", animation: "pulse 1.5s ease-in-out infinite", maxWidth: 400 }} />
        <div style={{ height: 400, borderRadius: 12, background: "#E2E8F0", animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Risk & ECL"
        subtitle="IFRS 9 Expected Credit Loss — F02 Module · Probability-weighted multi-scenario"
      >
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "#F4F5F7",
            color: "#0F172A",
            border: "1px solid #E2E8F0",
            borderRadius: "9999px",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <Download size={14} /> Auditor Evidence Pack
        </button>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "#002147",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "9999px",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Export PDF + JSON
        </button>
      </PageHeader>

      {/* KPI Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        <KpiCard
          label="Total ECL (Weighted)"
          value={`$${weighted.ecl12m.toFixed(1)}M`}
          delta={`+$2.4M vs Q4 2025`}
          deltaType="negative"
          subtitle={`${weights.base}/${weights.adverse}/${weights.upside} weighting`}
        />
        <KpiCard
          label="Stage 1 ECL"
          value={`$${s1ECL.toFixed(1)}M`}
          subtitle={`${s1Rows.length} lease${s1Rows.length !== 1 ? "s" : ""} · 12-month`}
          delta={`${s1Coverage.toFixed(2)}% of Stage 1 EAD`}
          deltaType="neutral"
        />
        <KpiCard
          label="Stage 2 ECL"
          value={`$${s2ECL.toFixed(1)}M`}
          subtitle={`${s2Rows.length} lease${s2Rows.length !== 1 ? "s" : ""} · Lifetime`}
          deltaType="negative"
        />
        <KpiCard
          label="Stage 3 ECL"
          value={`$${s3ECL.toFixed(1)}M`}
          subtitle={`${s3Rows.length} lease${s3Rows.length !== 1 ? "s" : ""} · Lifetime`}
          deltaType="negative"
        />
        <button
          onClick={() => setActiveTab("IAS 36 Impairment")}
          style={{ all: "unset", cursor: "pointer", display: "block" }}
        >
          <KpiCard
            label="IAS 36 Impairment"
            value="3 Aircraft"
            subtitle="Carrying Value > Recoverable"
            delta="Review Required"
            deltaType="negative"
          />
        </button>
      </div>

      {/* IAS 36 Alert Banner */}
      {IAS36_ALERT.count > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "0.875rem 1.25rem",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "0.625rem",
          }}
        >
          <AlertTriangle size={16} style={{ color: "#DC2626", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#991B1B" }}>
              {IAS36_ALERT.count} aircraft require IAS 36 impairment review
            </span>
            <span style={{ fontSize: "0.875rem", color: "#B91C1C" }}>
              {" "}— carrying value exceeds recoverable amount. Total exposure:{" "}
              <strong>${IAS36_ALERT.totalImpairment.toFixed(1)}M</strong> at period close.
            </span>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
              {IAS36_ALERT.aircraft.map((a) => (
                <span
                  key={a.msn}
                  style={{
                    fontSize: "0.75rem",
                    color: "#DC2626",
                    background: "#FEE2E2",
                    padding: "0.125rem 0.5rem",
                    borderRadius: "9999px",
                    fontWeight: 500,
                  }}
                >
                  {a.type} MSN {a.msn} · ${a.impairment.toFixed(1)}M
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setActiveTab("IAS 36 Impairment")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#DC2626",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "9999px",
              padding: "0.5rem 1rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Run Impairment Test
          </button>
        </div>
      )}

      {/* Tabs — filtered in Executive Mode to headline views only */}
      <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "4px", width: "fit-content" }}>
        {(isExecutiveMode ? EXEC_TABS : tabs).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "7px 20px", borderRadius: "9999px", border: "none",
                background: active ? "#002147" : "transparent",
                color: active ? "#FFFFFF" : "#64748B",
                fontSize: "13px", fontWeight: active ? 600 : 500,
                cursor: "pointer", transition: "all 180ms cubic-bezier(0.23,1,0.32,1)",
                boxShadow: active ? "0 1px 4px rgba(0,33,71,0.18)" : "none",
                whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.375rem",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#002147"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}
            >
              {tab === "SICR Config" && <SlidersHorizontal size={13} />}
              {tab}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          {activeTab === "ECL Overview" && <OverviewTab />}
          {activeTab === "Stage Migration" && <StageMigrationTab />}
          {activeTab === "ECL by Lease" && <LeaseTab />}
          {activeTab === "Sensitivity" && <SensitivityTab />}
          {activeTab === "SICR Config" && <SICRConfigTab />}
          {activeTab === "IAS 36 Impairment" && <IAS36Tab />}
        </motion.div>
      </AnimatePresence>

      {/* ECL Drilldown Panel */}
      {drilldownLease && (
        <ECLDrilldownPanel
          lease={drilldownLease}
          weights={weights}
          onClose={() => setDrilldownLease(null)}
        />
      )}
    </div>
  );
}
