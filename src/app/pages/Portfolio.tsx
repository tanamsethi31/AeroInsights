import { useState, useEffect, Fragment } from "react";
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
import { Download, Filter, Search, ChevronDown, Plus } from "lucide-react";
import { AddAircraftModal } from "../components/portfolios/AddAircraftModal";
import { useSortable, sortIcon, sortIconStyle } from "../components/ui/useSortable";
import { SDMRTab } from "../components/portfolio/SDMRTab";
import { ConcentrationTab } from "../components/portfolio/ConcentrationTab";
import { MaintenanceForecastTab } from "../components/portfolio/MaintenanceForecastTab";
import { PerformanceVsPlan } from "../components/portfolio/PerformanceVsPlan";
import { KeyDatesTab } from "../components/portfolio/KeyDatesTab";
import { toKeyDateRows, toKeyDateKPIs } from "../lib/keyDatesAdapters";
import { PaymentsTab } from "../components/portfolio/PaymentsTab";
import { toPaymentSchedule } from "../lib/paymentAdapters";



const tabs = ["Leases", "Aircraft", "Lessees", "Concentration", "SD / MR", "Performance vs. Plan", "Payments", "Key Dates"];
const EXEC_TABS = ["Leases", "Aircraft"];

function fmtM(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(2)}B`;
  return `$${m.toFixed(0)}M`;
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
  const { assets, lessees: lesseeData, leases: leaseData, provisions, isLoading } = usePortfolioData();
  const leases = toLeaseTableRows(leaseData, assets, lesseeData);
  const aircraft = toAircraftTableRows(assets, leaseData, lesseeData);
  const lessees = toLesseeTableRows(lesseeData, leaseData, provisions);
  const keyDateRows = toKeyDateRows(leaseData, assets, lesseeData);
  const keyDateKPIs = toKeyDateKPIs(keyDateRows);
  const paymentSchedule = toPaymentSchedule(leaseData, assets, lesseeData);
  const portfolioKPIs = toPortfolioKPIs(assets, leaseData, provisions);

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
    behaviorScore: (l: LesseeRow) => l.behaviorScore,
    stage:         (l: LesseeRow) => parseInt(l.stage),
    leases:        (l: LesseeRow) => l.leases,
    exposure:      (l: LesseeRow) => parseFloat(l.exposure.replace(/[$M]/g, "")) || 0,
    paymentDays:   (l: LesseeRow) => l.paymentDays,
  };

  const [stageFilter, setStageFilter] = useState("All");
  const [aircraftExpanded, setAircraftExpanded] = useState<Set<string>>(new Set());
  const [aircraftSubTab, setAircraftSubTab] = useState<Record<string, "Valuation" | "Maintenance">>({});
  const [aircraftOverrides, setAircraftOverrides] = useState<OverrideMap>({});
  const [showAddAircraft, setShowAddAircraft] = useState(false);

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

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
        <KpiCard label="Fleet" value={`${portfolioKPIs.fleetCount} aircraft`} />
        <KpiCard label="Book Value (EAD)" value={fmtM(portfolioKPIs.bookValueM)} />
        <KpiCard label="Total ECL" value={fmtM(portfolioKPIs.totalECLM)} deltaType="negative" />
        <KpiCard label="Avg Remaining Term" value={`${portfolioKPIs.avgRemainingTermYrs.toFixed(1)} yrs`} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "4px", width: "fit-content" }}>
        {(isExecutiveMode ? EXEC_TABS : tabs).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "7px 20px", borderRadius: "9999px", border: "none",
              background: activeTab === tab ? "#002147" : "transparent",
              color: activeTab === tab ? "#FFFFFF" : "#64748B",
              fontSize: "13px", fontWeight: activeTab === tab ? 600 : 500,
              cursor: "pointer", transition: "all 180ms cubic-bezier(0.23,1,0.32,1)",
              boxShadow: activeTab === tab ? "0 1px 4px rgba(0,33,71,0.18)" : "none",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { if (activeTab !== tab) (e.currentTarget as HTMLButtonElement).style.color = "#002147"; }}
            onMouseLeave={e => { if (activeTab !== tab) (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Leases Tab */}
      {activeTab === "Leases" && (
        <Card
          title="Lease Register"
          headerRight={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Filter size={14} style={{ color: "#94A3B8" }} />
                <span style={{ fontSize: "0.8125rem", color: "#475569" }}>Stage:</span>
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
                      background: stageFilter === s ? "#002147" : "transparent",
                      color: stageFilter === s ? "#FFFFFF" : "#475569",
                      borderColor: stageFilter === s ? "#002147" : "#E2E8F0",
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
                  <tr key={lease.id} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7", cursor: "pointer" }}
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
                              {(["Valuation", "Maintenance Forecast"] as const).map((st) => {
                                const key = st === "Maintenance Forecast" ? "Maintenance" : "Valuation";
                                const active = (aircraftSubTab[a.msn] ?? "Valuation") === key;
                                return (
                                  <button
                                    key={st}
                                    onClick={(e) => { e.stopPropagation(); setAircraftSubTab((prev) => ({ ...prev, [a.msn]: key as "Valuation" | "Maintenance" })); }}
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
                            ) : (
                              <MaintenanceForecastTab
                                msn={a.msn}
                                aircraftType={a.type}
                                vintage={a.vintage}
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
                          <div style={{ width: `${l.behaviorScore}%`, height: "100%", borderRadius: "3px", background: l.behaviorScore >= 80 ? "#15803D" : l.behaviorScore >= 60 ? "#B45309" : "#B91C1C" }} />
                        </div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0F172A" }}>{l.behaviorScore}</span>
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}><StatusPill stage={l.stage} label={`Stage ${l.stage}`} /></td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{l.leases}</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 500, color: "#0F172A" }}>{l.exposure}</td>
                    <td style={{ padding: "0.75rem 1rem", color: l.paymentDays > 30 ? "#B91C1C" : l.paymentDays > 5 ? "#B45309" : "#15803D", fontWeight: 500 }}>{l.paymentDays.toFixed(1)} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Concentration Tab */}
      {activeTab === "Concentration" && <ConcentrationTab />}

      {/* SD / MR Tab */}
      {activeTab === "SD / MR" && <SDMRTab />}

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
    </div>
    </>
  );
}