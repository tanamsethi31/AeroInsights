import { useState, useEffect, Fragment, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { useViewMode } from "../contexts/ViewModeContext";
import { usePortfolioData } from "../hooks/usePortfolioData";
import {
  toLeaseTableRows,
  toAircraftTableRows,
  toLesseeTableRows,
  toPortfolioKPIs,
  type LeaseTableRow,
  type LesseeTableRow as LesseeRow,
  type AircraftTableRow,
} from "../lib/portfolioAdapters";

const PATH_TAB: Record<string, string> = {
  "/portfolio/register":     "Leases",
  "/portfolio/analytics":    "Concentration",
  "/portfolio/aircraft-mix": "Aircraft",
  "/portfolio/performance":  "Performance vs. Plan",
};
import {
  AircraftValuationPanel,
  valuationData,
  resolvedValue,
  fmtUSD,
  SourceBadge,
  type OverrideKey,
  type OverrideEntry,
  type OverrideMap,
} from "../components/portfolio/AircraftValuationPanel";
import { KpiCard } from "../components/ui/KpiCard";
import { StatusPill } from "../components/ui/StatusPill";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Download, Filter, Search, ChevronDown, Plus, FileSpreadsheet } from "lucide-react";
import { AddAircraftModal } from "../components/portfolios/AddAircraftModal";
import { useSortable, sortIcon, sortIconStyle } from "../components/ui/useSortable";
import { PillTabs } from "../components/ui/PillTabs";
import { SDMRTab, buildLiveSDMRData, type LeaseSDMR } from "../components/portfolio/SDMRTab";
import { ConcentrationTab } from "../components/portfolio/ConcentrationTab";
import { MaintenanceForecastTab } from "../components/portfolio/MaintenanceForecastTab";
import { PerformanceVsPlan } from "../components/portfolio/PerformanceVsPlan";
import { KeyDatesTab } from "../components/portfolio/KeyDatesTab";
import { toKeyDateRows, toKeyDateKPIs } from "../lib/keyDatesAdapters";
import { PaymentsTab } from "../components/portfolio/PaymentsTab";
import { toPaymentSchedule } from "../lib/paymentAdapters";
import { AnimatePresence, motion } from "framer-motion";
import { LeaseEditDrawer } from "../components/portfolio/LeaseEditDrawer";
import { useData } from "../contexts/DataContext";
import { ModelParametersTab } from "../components/portfolio/ModelParametersTab";
import { LgdBenchmarkPanel } from "../components/portfolio/LgdBenchmarkPanel";
import { RecoveryFactorDrawer } from "../components/risk-ecl/RecoveryFactorDrawer";
import { useLgdCurves } from "../hooks/useLgdCurves";
import { computePortfolioAssetRisk } from "../utils/assetRisk";


const tabs = ["Leases", "Aircraft", "Lessees", "Model Parameters", "Concentration", "SD / MR", "Performance vs. Plan", "Payments", "Key Dates"];
const EXEC_TABS = ["Leases", "Aircraft"];

function fmtM(m: number | null | undefined): string {
  if (m == null || isNaN(m)) return "$0M";
  if (m >= 1000) return `$${(m / 1000).toFixed(2)}B`;
  return `$${m.toFixed(0)}M`;
}

/** Format a monthly-rent figure (value in $M) → "$2.9M" or "$285K" */
function fmtRent(m: number | null | undefined): string {
  if (m == null || isNaN(m)) return "$0M";
  if (m >= 1) return `$${m.toFixed(1)}M`;
  return `$${Math.round(m * 1000).toLocaleString("en-US")}K`;
}


export default function Portfolio() {
  const { pathname, state: locationState } = useLocation();
  const navigate = useNavigate();
  const { isExecutiveMode } = useViewMode();
  const [activeTab, setActiveTab] = useState(() => PATH_TAB[pathname] ?? "Leases");
  useEffect(() => { setActiveTab(PATH_TAB[pathname] ?? "Leases"); }, [pathname]);
  useEffect(() => {
    if (isExecutiveMode && !EXEC_TABS.includes(activeTab)) {
      setActiveTab("Leases");
    }
  }, [isExecutiveMode, activeTab]);
  // Deep-link: activate tab from navigation state (e.g. Dashboard → "Key Dates")
  useEffect(() => {
    if (locationState?.tab) {
      setActiveTab(locationState.tab as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only — do not re-run on locationState change
  const { assets, lessees: lesseeData, leases: leaseData, provisions, isLoading, isDemo, refetch } = usePortfolioData();
  const { orgId } = useData();
  const [editingLeaseId, setEditingLeaseId] = useState<string | null>(null);
  const editingLease = editingLeaseId ? leaseData.find(l => l.id === editingLeaseId) ?? null : null;
  const leases = toLeaseTableRows(leaseData, assets, lesseeData);
  const aircraft = toAircraftTableRows(assets, leaseData, lesseeData);
  const lessees = toLesseeTableRows(lesseeData, leaseData, provisions);
  const keyDateRows = toKeyDateRows(leaseData, assets, lesseeData);
  const keyDateKPIs = toKeyDateKPIs(keyDateRows);
  const paymentSchedule = toPaymentSchedule(leaseData, assets, lesseeData);
  const portfolioKPIs = toPortfolioKPIs(assets, leaseData, provisions);

  // Live SDMR data — built once and shared with SDMRTab + MaintenanceForecastTab
  const liveSDMRData = useMemo<LeaseSDMR[] | undefined>(() => {
    if (isDemo || assets.length === 0) return undefined;
    return buildLiveSDMRData(assets, lesseeData, leaseData, provisions);
  }, [isDemo, assets, lesseeData, leaseData, provisions]);

  // Index by MSN for O(1) lookup inside aircraft accordion rows
  const liveSDMRByMsn = useMemo<Map<string, LeaseSDMR>>(() => {
    const map = new Map<string, LeaseSDMR>();
    if (!liveSDMRData) return map;
    for (const record of liveSDMRData) {
      const asset = assets.find((a) => a.id === leaseData.find((l) => l.id === record.leaseId)?.asset_id);
      if (asset) map.set(asset.msn, record);
    }
    return map;
  }, [liveSDMRData, assets, leaseData]);

  const leaseAccessors = {
    lessee:   (l: LeaseTableRow) => l.lessee,
    aircraft: (l: LeaseTableRow) => l.aircraft,
    start:    (l: LeaseTableRow) => l.start,
    end:      (l: LeaseTableRow) => l.end,
    rent:     (l: LeaseTableRow) => parseInt(l.rentUSD.replace(/,/g, "")) || 0,
    stage:    (l: LeaseTableRow) => parseInt(l.stage) || 0,
  };

  const lesseeAccessors = {
    name:          (l: LesseeRow) => l.name,
    country:       (l: LesseeRow) => l.country,
    behaviorScore: (l: LesseeRow) => l.behaviorScore ?? -1,
    stage:         (l: LesseeRow) => parseInt(l.stage),
    leases:        (l: LesseeRow) => l.leases,
    exposure:      (l: LesseeRow) => parseFloat(l.exposure.replace(/[$M]/g, "")) || 0,
    paymentDays:   (l: LesseeRow) => l.paymentDays ?? -1,
  };

  const [stageFilter, setStageFilter] = useState("All");
  const [aircraftExpanded, setAircraftExpanded] = useState<Set<string>>(new Set());
  const [aircraftSubTab, setAircraftSubTab] = useState<Record<string, "Valuation" | "Maintenance" | "LGD">>({});
  const [aircraftOverrides, setAircraftOverrides] = useState<OverrideMap>({});
  const [showAddAircraft, setShowAddAircraft] = useState(false);

  const { recoveryFactor, isOverridden, saveRecoveryOverride, resetToDefault: resetRecovery } = useLgdCurves();
  const [recoveryDrawerOpen, setRecoveryDrawerOpen] = useState(false);

  const { perAssetLgd } = useMemo(
    () => computePortfolioAssetRisk(assets, leaseData, recoveryFactor),
    [assets, leaseData, recoveryFactor]
  );

  function toggleAircraftExpand(msn: string) {
    setAircraftExpanded((prev) => {
      const next = new Set(prev);
      next.has(msn) ? next.delete(msn) : next.add(msn);
      return next;
    });
  }

  function handleOverride(msn: string, key: OverrideKey, entry: OverrideEntry) {
    setAircraftOverrides((prev) => ({
      ...prev,
      [msn]: { ...prev[msn], [key]: entry },
    }));
  }

  function handleRevertOverride(msn: string, key: OverrideKey) {
    setAircraftOverrides((prev) => {
      const msnOverrides = { ...prev[msn] };
      delete msnOverrides[key];
      return { ...prev, [msn]: msnOverrides };
    });
  }

  const aircraftWithValuation = aircraft.map((a) => {
    const v = valuationData.find((d) => d.msn === a.msn);
    return {
      ...a,
      hlbVal: v ? resolvedValue(v, "halfLifeBase", aircraftOverrides).value : 0,
      cmvVal: v ? resolvedValue(v, "currentMV",    aircraftOverrides).value : 0,
      mavVal: v ? resolvedValue(v, "mav",           aircraftOverrides).value : 0,
    };
  });

  type AircraftWithValuation = AircraftTableRow & { hlbVal: number; cmvVal: number; mavVal: number };
  const aircraftAccessors = {
    type:         (a: AircraftWithValuation) => a.type,
    vintage:      (a: AircraftWithValuation) => a.vintage,
    halfLifeBase: (a: AircraftWithValuation) => a.hlbVal,
    currentMV:    (a: AircraftWithValuation) => a.cmvVal,
    mav:          (a: AircraftWithValuation) => a.mavVal,
  };

  const filteredLeases =
    stageFilter === "All" ? leases : leases.filter((l) => l.stage === stageFilter);

  const { sorted: sortedLeases, sortState: leaseSortState, toggleSort: toggleLeaseSort } = useSortable(filteredLeases, leaseAccessors);
  const { sorted: sortedAircraft, sortState: aircraftSortState, toggleSort: toggleAircraftSort } = useSortable(aircraftWithValuation, aircraftAccessors);
  const { sorted: sortedLessees, sortState: lesseeSortState, toggleSort: toggleLesseeSort } = useSortable(lessees, lesseeAccessors);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ height: 48, borderRadius: 8, background: "#E2E8F0", animation: "pulse 1.5s ease-in-out infinite", maxWidth: 400 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ height: 88, borderRadius: 12, background: "#E2E8F0", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
        <div style={{ height: 320, borderRadius: 12, background: "#E2E8F0", animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    );
  }

  return (
    <>
      {showAddAircraft && (
        <AddAircraftModal onClose={() => setShowAddAircraft(false)} />
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
      >
      <PageHeader
        title="Portfolio"
        subtitle="173 leases · 48 lessees · 12 aircraft types"
      >
        {/* Export — secondary ghost button */}
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
            transition: "background 150ms cubic-bezier(0.23,1,0.32,1)",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "#E2E8F0")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "#F4F5F7")
          }
        >
          <Download size={14} /> Export
        </button>

        {/* Add Aircraft — primary filled button */}
        <button
          onClick={() => setShowAddAircraft(true)}
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
            transition:
              "background-color 150ms cubic-bezier(0.23,1,0.32,1), transform 150ms cubic-bezier(0.23,1,0.32,1)",
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
          <Plus size={14} /> Add Aircraft
        </button>
      </PageHeader>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
        <KpiCard
          label="Book Value"
          value={fmtM(portfolioKPIs.bookValueM)}
          subtitle={`${portfolioKPIs.fleetCount} aircraft · Total EAD`}
          staggerIndex={0}
        />
        <KpiCard
          label="Monthly Rent Roll"
          value={fmtRent(portfolioKPIs.monthlyRentRollM)}
          subtitle={`${portfolioKPIs.leasedCount} leases · Contracted / mo`}
          staggerIndex={1}
        />
        <KpiCard
          label="Expected Loss"
          value={fmtM(portfolioKPIs.totalECLM)}
          subtitle={`ECL rate ${(portfolioKPIs.eclRatePct ?? 0).toFixed(2)}%`}
          deltaType="negative"
          staggerIndex={2}
        />
        <KpiCard
          label="Avg Lease Term"
          value={`${(portfolioKPIs.avgRemainingTermYrs ?? 0).toFixed(1)} yrs`}
          subtitle="Remaining weighted avg"
          staggerIndex={3}
        />
        {/* Excel Add-in shortcut — custom image-background card */}
        <div
          onClick={() => navigate("/settings/excel")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate("/settings/excel")}
          style={{
            position: "relative",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            cursor: "pointer",
            minHeight: "110px",
            backgroundImage: "url('/excel-addin-bg.png')",
            backgroundSize: "cover",
            backgroundPosition: "right center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            transition: "box-shadow 160ms cubic-bezier(0.23,1,0.32,1), transform 160ms cubic-bezier(0.23,1,0.32,1)",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.18)";
            el.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
            el.style.transform = "translateY(0)";
          }}
          onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "scale(0.97)"; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
        >
          {/* Semi-transparent dark overlay on left so text is legible */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.08) 60%, transparent 100%)",
          }} />
          <div style={{
            position: "relative", zIndex: 1,
            padding: "1.25rem 1.5rem",
            display: "flex", flexDirection: "column", gap: "0.25rem",
            height: "100%", boxSizing: "border-box",
          }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.75)" }}>
              Excel Add-in
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#FFFFFF", lineHeight: 1.1 }}>
              Available
            </div>
            <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.80)", marginTop: "0.125rem" }}>
              Live portfolio data in Excel →
            </div>
          </div>
        </div>
      </div>
      {/* Excel add-in banner — shown once per session */}
      {!sessionStorage.getItem("excel-banner-dismissed") && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          background: "rgba(0,33,71,0.04)", border: "1px solid rgba(0,33,71,0.12)",
          borderLeft: "3px solid #002147", borderRadius: "0.625rem",
          padding: "0.75rem 1rem", fontSize: "0.8125rem",
        }}>
          <FileSpreadsheet size={16} style={{ color: "#002147", flexShrink: 0 }} />
          <span style={{ flex: 1, color: "#475569" }}>
            <strong style={{ color: "#0F172A" }}>Excel Add-in available</strong> — pull live portfolio data, ECL figures and KPIs directly into Excel.{" "}
            <button onClick={() => navigate("/settings/excel")} style={{ color: "#002147", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              Set up →
            </button>
          </span>
          <button
            onClick={() => { sessionStorage.setItem("excel-banner-dismissed", "1"); document.getElementById("excel-banner")?.remove(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: "2px", fontSize: "1rem", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <PillTabs
        tabs={isExecutiveMode ? EXEC_TABS : tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Leases Tab */}
      {activeTab === "Leases" && (
        <Card
          title="Lease Register"
          headerRight={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Filter size={14} style={{ color: "rgba(255,255,255,0.55)" }} />
                <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.65)" }}>Stage:</span>
                {["All", "1", "2", "3"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStageFilter(s)}
                    style={{
                      padding: "0.25rem 0.625rem",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      border: "1px solid",
                      borderRadius: "1rem",
                      cursor: "pointer",
                      background: stageFilter === s ? "rgba(255,255,255,0.18)" : "transparent",
                      color: stageFilter === s ? "#FFFFFF" : "rgba(255,255,255,0.65)",
                      borderColor: stageFilter === s ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)",
                      transition: "background 140ms ease-out, color 140ms ease-out, border-color 140ms ease-out",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          }
          noPadding
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                  {([
                    { label: "Lease ID", key: null },
                    { label: "Lessee", key: "lessee" },
                    { label: "Aircraft", key: "aircraft" },
                    { label: "MSN", key: null },
                    { label: "Lease Start", key: "start" },
                    { label: "Lease End", key: "end" },
                    { label: "Monthly Rent (USD)", key: "rent" },
                    { label: "Stage", key: "stage" },
                    { label: "Status", key: null },
                  ] as { label: string; key: string | null }[]).map(({ label, key }) => (
                    <th
                      key={label}
                      onClick={key ? () => toggleLeaseSort(key) : undefined}
                      style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", cursor: key ? "pointer" : "default", userSelect: "none" }}
                    >
                      {label}
                      {key && <span style={sortIconStyle(key, leaseSortState)}>{sortIcon(key, leaseSortState)}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedLeases.map((lease, i) => (
                  <tr
                    key={lease.id}
                    onClick={() => { if (!isDemo) setEditingLeaseId(lease.id); }}
                    style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7", cursor: isDemo ? "default" : "pointer" }}
                    title={isDemo ? "Editing is available for uploaded portfolios only" : undefined}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "#FFFFFF" : "#F4F5F7")}
                  >
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>{lease.id}</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{lease.lessee}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{lease.aircraft}</td>
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#475569" }}>{lease.msn}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{lease.start}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{lease.end}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#0F172A", fontWeight: 500 }}>${lease.rentUSD}</td>
                    <td
                      style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
                      onClick={() => navigate("/risk-ecl")}
                      title="View ECL breakdown in Risk & ECL"
                    >
                      <StatusPill stage={lease.stage as "1" | "2" | "3"} label={`Stage ${lease.stage}`} />
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <StatusPill stage="green" label={lease.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Aircraft Tab */}
      {activeTab === "Aircraft" && (
        <Card title="Aircraft Register" noPadding>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                  {([
                    { label: "MSN",          key: null           },
                    { label: "Type",         key: "type"         },
                    { label: "Reg",          key: null           },
                    { label: "Vintage",      key: "vintage"      },
                    { label: "Half-life BV", key: "halfLifeBase" },
                    { label: "Current MV",   key: "currentMV"    },
                    { label: "MAV",          key: "mav"          },
                    { label: "Lease-Enc.",   key: null           },
                    { label: "Part-out",     key: null           },
                    { label: "Lessee",       key: null           },
                    { label: "Expand",       key: null           },
                  ] as { label: string; key: string | null }[]).map(({ label, key }) => (
                    <th
                      key={label}
                      onClick={key ? () => toggleAircraftSort(key) : undefined}
                      style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", cursor: key ? "pointer" : "default", userSelect: "none" }}
                    >
                      {label}
                      {key && <span style={sortIconStyle(key, aircraftSortState)}>{sortIcon(key, aircraftSortState)}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedAircraft.map((a, i) => {
                  const v = valuationData.find((d) => d.msn === a.msn);
                  const isOpen = aircraftExpanded.has(a.msn);
                  const rowBg = i % 2 === 0 ? "#FFFFFF" : "#F4F5F7";
                  return (
                    <Fragment key={a.msn}>
                      <tr
                        style={{ borderBottom: isOpen ? "none" : "1px solid #E2E8F0", background: rowBg, cursor: "pointer" }}
                        onClick={() => toggleAircraftExpand(a.msn)}
                      >
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#475569" }}>{a.msn}</td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{a.type}</td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#475569" }}>{a.reg}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{a.vintage}</td>
                        {(["halfLifeBase", "currentMV", "mav", "leaseEncumbered", "partOut"] as OverrideKey[]).map((key) => {
                          const rv = v ? resolvedValue(v, key, aircraftOverrides) : null;
                          return (
                            <td key={key} style={{ padding: "0.75rem 1rem" }}>
                              {rv ? (
                                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                  <span style={{ fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(rv.value)}</span>
                                  <SourceBadge source={rv.source} />
                                </span>
                              ) : "—"}
                            </td>
                          );
                        })}
                        <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{a.lessee}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#94A3B8", fontSize: "1rem" }}>
                          {isOpen ? "▲" : "▶"}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                          <td colSpan={11} style={{ padding: 0, background: "#FAFAFA" }}>
                            {/* Sub-tab switcher */}
                            <div style={{ display: "flex", gap: "3px", background: "#EAEFF5", borderBottom: "1px solid #E2E8F0", padding: "5px 5px 5px 1rem" }}>
                              {(["Valuation", "Maintenance Forecast", "LGD Benchmark"] as const).map((st) => {
                                const key = st === "Maintenance Forecast" ? "Maintenance" : st === "LGD Benchmark" ? "LGD" : "Valuation";
                                const active = (aircraftSubTab[a.msn] ?? "Valuation") === key;
                                return (
                                  <button
                                    key={st}
                                    onClick={(e) => { e.stopPropagation(); setAircraftSubTab((prev) => ({ ...prev, [a.msn]: key as "Valuation" | "Maintenance" | "LGD" })); }}
                                    style={{
                                      padding: "4px 14px", fontSize: "0.8125rem", fontWeight: active ? 600 : 500,
                                      cursor: "pointer", border: "none", borderRadius: "9999px",
                                      background: active ? "#002147" : "transparent",
                                      color: active ? "#FFFFFF" : "#64748B",
                                      transition: "all 150ms cubic-bezier(0.23,1,0.32,1)",
                                      boxShadow: active ? "0 1px 3px rgba(0,33,71,0.18)" : "none",
                                    }}
                                  >
                                    {st}
                                  </button>
                                );
                              })}
                            </div>
                            {/* Panel */}
                            {(aircraftSubTab[a.msn] ?? "Valuation") === "Valuation" ? (
                              <AircraftValuationPanel
                                msn={a.msn}
                                overrides={aircraftOverrides}
                                onOverride={handleOverride}
                                onRevertOverride={handleRevertOverride}
                              />
                            ) : (aircraftSubTab[a.msn] ?? "Valuation") === "Maintenance" ? (
                              <MaintenanceForecastTab
                                msn={a.msn}
                                aircraftType={a.type}
                                vintage={a.vintage}
                                liveRecord={liveSDMRByMsn.get(a.msn)}
                              />
                            ) : (
                              <LgdBenchmarkPanel
                                assetId={a.msn}
                                aircraftType={a.type}
                                vintage={a.vintage != null ? Number(a.vintage) : null}
                                manualLgd={null}
                                recoveryFactor={recoveryFactor}
                                isOverridden={isOverridden}
                                onOpenRecoveryDrawer={() => setRecoveryDrawerOpen(true)}
                              />
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Lessees Tab */}
      {activeTab === "Lessees" && (
        <Card title="Lessee Register" noPadding>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                  {([
                    { label: "Lessee", key: "name" },
                    { label: "Country", key: "country" },
                    { label: "Credit Rating", key: null },
                    { label: "Behavior Score", key: "behaviorScore" },
                    { label: "IFRS Stage", key: "stage" },
                    { label: "Leases", key: "leases" },
                    { label: "Total Exposure", key: "exposure" },
                    { label: "Avg Payment Days Late", key: "paymentDays" },
                  ] as { label: string; key: string | null }[]).map(({ label, key }) => (
                    <th
                      key={label}
                      onClick={key ? () => toggleLesseeSort(key) : undefined}
                      style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", cursor: key ? "pointer" : "default", userSelect: "none" }}
                    >
                      {label}
                      {key && <span style={sortIconStyle(key, lesseeSortState)}>{sortIcon(key, lesseeSortState)}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedLessees.map((l, i) => (
                  <tr key={l.name} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "#FFFFFF" : "#F4F5F7")}
                  >
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <button
                        onClick={() => navigate(`/counterparties?lessee=${l.id}`)}
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
                        {l.name}
                      </button>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{l.country}</td>
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontWeight: 600, color: l.stage === "3" ? "#B91C1C" : l.stage === "2" ? "#B45309" : "#15803D" }}>{l.rating}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div className="flex items-center gap-2">
                        <div style={{ flex: 1, height: "6px", background: "#E2E8F0", borderRadius: "3px", minWidth: "60px" }}>
                          <div style={{ width: `${l.behaviorScore ?? 0}%`, height: "100%", borderRadius: "3px", background: (l.behaviorScore ?? 0) >= 80 ? "#15803D" : (l.behaviorScore ?? 0) >= 60 ? "#B45309" : "#B91C1C" }} />
                        </div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0F172A" }}>{l.behaviorScore ?? "—"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}><StatusPill stage={l.stage} label={`Stage ${l.stage}`} /></td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{l.leases}</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 500, color: "#0F172A" }}>{l.exposure}</td>
                    <td style={{ padding: "0.75rem 1rem", color: l.paymentDays == null ? "#64748B" : l.paymentDays > 30 ? "#B91C1C" : l.paymentDays > 5 ? "#B45309" : "#15803D", fontWeight: 500 }}>{l.paymentDays != null ? `${l.paymentDays.toFixed(1)} days` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Model Parameters Tab */}
      {activeTab === "Model Parameters" && (
        <ModelParametersTab
          leases={leaseData}
          assets={assets}
          lessees={lesseeData}
          provisions={provisions}
          orgId={orgId ?? ""}
          isDemo={isDemo}
          onSaved={refetch}
        />
      )}

      {/* Concentration Tab */}
      {activeTab === "Concentration" && <ConcentrationTab />}

      {/* SD / MR Tab */}
      {activeTab === "SD / MR" && <SDMRTab data={liveSDMRData} />}

      {/* Performance vs. Plan Tab */}
      {activeTab === "Performance vs. Plan" && <PerformanceVsPlan />}

      {/* Payments Tab */}
      {activeTab === "Payments" && (
        <PaymentsTab schedule={paymentSchedule} />
      )}

      {/* Key Dates Tab */}
      {activeTab === "Key Dates" && (
        <KeyDatesTab rows={keyDateRows} kpis={keyDateKPIs} />
      )}
    </motion.div>

    <AnimatePresence>
      {editingLease && (() => {
        const drawerAsset = assets.find(a => a.id === editingLease.asset_id);
        const drawerLessee = lesseeData.find(l => l.id === editingLease.lessee_id);
        const drawerProvision = provisions.find(p => p.lease_id === editingLease.id) ?? null;
        if (!drawerAsset || !drawerLessee) return null;
        return (
          <LeaseEditDrawer
            key={editingLease.id}
            lease={editingLease}
            asset={drawerAsset}
            lessee={drawerLessee}
            provision={drawerProvision}
            orgId={orgId ?? ""}
            onClose={() => setEditingLeaseId(null)}
            onSaved={refetch}
          />
        );
      })()}
      <RecoveryFactorDrawer
        isOpen={recoveryDrawerOpen}
        currentRecoveryFactor={recoveryFactor}
        isOverridden={isOverridden}
        onSave={saveRecoveryOverride}
        onReset={resetRecovery}
        onClose={() => setRecoveryDrawerOpen(false)}
      />
    </AnimatePresence>
    </>
  );
}