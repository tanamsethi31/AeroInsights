import { useState, Fragment } from "react";
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
import { Download, Filter, Search, ChevronDown } from "lucide-react";
import { useSortable, sortIcon, sortIconStyle } from "../components/ui/useSortable";
import { SDMRTab } from "../components/portfolio/SDMRTab";
import { ConcentrationTab } from "../components/portfolio/ConcentrationTab";

const leases = [
  { id: "LSE-2019-001", lessee: "IndiGo Airlines", aircraft: "A320neo", msn: "9218", start: "2019-03-01", end: "2028-03-01", rentUSD: "285,000", stage: "3", status: "Active" },
  { id: "LSE-2020-014", lessee: "Aeromexico", aircraft: "B737-800", msn: "41234", start: "2020-06-15", end: "2027-06-15", rentUSD: "310,000", stage: "3", status: "Active" },
  { id: "LSE-2021-022", lessee: "Emirates", aircraft: "B777-300ER", msn: "62047", start: "2021-01-10", end: "2030-01-10", rentUSD: "1,240,000", stage: "1", status: "Active" },
  { id: "LSE-2020-031", lessee: "SriLankan Airlines", aircraft: "A330-300", msn: "1728", start: "2020-09-01", end: "2026-09-01", rentUSD: "480,000", stage: "2", status: "Active" },
  { id: "LSE-2022-009", lessee: "Ryanair", aircraft: "B737 MAX 8", msn: "67892", start: "2022-04-15", end: "2032-04-15", rentUSD: "340,000", stage: "1", status: "Active" },
  { id: "LSE-2018-047", lessee: "Air France", aircraft: "A350-900", msn: "0378", start: "2018-07-20", end: "2028-07-20", rentUSD: "960,000", stage: "1", status: "Active" },
  { id: "LSE-2021-055", lessee: "Azul Brazilian Airlines", aircraft: "A320neo", msn: "10442", start: "2021-11-01", end: "2029-11-01", rentUSD: "295,000", stage: "2", status: "Active" },
  { id: "LSE-2019-063", lessee: "Air Transat", aircraft: "A321neo", msn: "8841", start: "2019-05-01", end: "2027-05-01", rentUSD: "275,000", stage: "2", status: "Active" },
  { id: "LSE-2023-002", lessee: "Singapore Airlines", aircraft: "A350-900", msn: "0521", start: "2023-02-01", end: "2033-02-01", rentUSD: "1,050,000", stage: "1", status: "Active" },
  { id: "LSE-2022-018", lessee: "Lufthansa", aircraft: "A220-300", msn: "55124", start: "2022-08-01", end: "2032-08-01", rentUSD: "220,000", stage: "1", status: "Active" },
];

const aircraft = [
  { msn: "9218", type: "A320neo", reg: "VT-IYC", vintage: 2019, nbv: "$24.2M", mv: "$26.1M", mvAdj: "$25.4M", lessee: "IndiGo Airlines", maintenanceReserve: "$1.82M" },
  { msn: "41234", type: "B737-800", reg: "XA-AMX", vintage: 2020, nbv: "$32.1M", mv: "$28.8M", mvAdj: "$28.0M", lessee: "Aeromexico", maintenanceReserve: "$3.14M" },
  { msn: "62047", type: "B777-300ER", reg: "A6-ECE", vintage: 2021, nbv: "$88.4M", mv: "$91.2M", mvAdj: "$90.5M", lessee: "Emirates", maintenanceReserve: "$6.40M" },
  { msn: "1728", type: "A330-300", reg: "4R-ALB", vintage: 2015, nbv: "$34.2M", mv: "$29.1M", mvAdj: "$28.3M", lessee: "SriLankan Airlines", maintenanceReserve: "$2.97M" },
  { msn: "67892", type: "B737 MAX 8", reg: "EI-HXP", vintage: 2022, nbv: "$44.7M", mv: "$47.3M", mvAdj: "$46.8M", lessee: "Ryanair", maintenanceReserve: "$0.92M" },
  { msn: "0378", type: "A350-900", reg: "F-HTYR", vintage: 2018, nbv: "$68.3M", mv: "$72.8M", mvAdj: "$71.4M", lessee: "Air France", maintenanceReserve: "$5.21M" },
];

const lessees = [
  { name: "Emirates", country: "UAE", rating: "A-", stage: "1" as const, behaviorScore: 94, leases: 8, exposure: "$412M", paymentDays: 0.2 },
  { name: "Ryanair", country: "Ireland", rating: "BBB+", stage: "1" as const, behaviorScore: 91, leases: 14, exposure: "$386M", paymentDays: 0.5 },
  { name: "Singapore Airlines", country: "Singapore", rating: "A", stage: "1" as const, behaviorScore: 97, leases: 6, exposure: "$290M", paymentDays: 0.1 },
  { name: "Air France", country: "France", rating: "BB+", stage: "1" as const, behaviorScore: 86, leases: 9, exposure: "$278M", paymentDays: 1.2 },
  { name: "Lufthansa", country: "Germany", rating: "BBB-", stage: "1" as const, behaviorScore: 88, leases: 7, exposure: "$194M", paymentDays: 0.8 },
  { name: "Azul Brazilian Airlines", country: "Brazil", rating: "B+", stage: "2" as const, behaviorScore: 71, leases: 5, exposure: "$142M", paymentDays: 6.4 },
  { name: "Air Transat", country: "Canada", rating: "B", stage: "2" as const, behaviorScore: 68, leases: 3, exposure: "$96M", paymentDays: 8.1 },
  { name: "SriLankan Airlines", country: "Sri Lanka", rating: "B+", stage: "2" as const, behaviorScore: 62, leases: 4, exposure: "$118M", paymentDays: 12.3 },
  { name: "IndiGo Airlines", country: "India", rating: "BB-", stage: "3" as const, behaviorScore: 44, leases: 6, exposure: "$184M", paymentDays: 45.0 },
  { name: "Aeromexico", country: "Mexico", rating: "CCC", stage: "3" as const, behaviorScore: 29, leases: 4, exposure: "$122M", paymentDays: 89.0 },
];


const tabs = ["Leases", "Aircraft", "Lessees", "Concentration", "SD / MR"];

const leaseAccessors = {
  lessee: (l: typeof leases[0]) => l.lessee,
  aircraft: (l: typeof leases[0]) => l.aircraft,
  start: (l: typeof leases[0]) => l.start,
  end: (l: typeof leases[0]) => l.end,
  rent: (l: typeof leases[0]) => parseInt(l.rentUSD.replace(/,/g, "")),
  stage: (l: typeof leases[0]) => parseInt(l.stage),
};


const lesseeAccessors = {
  name: (l: typeof lessees[0]) => l.name,
  country: (l: typeof lessees[0]) => l.country,
  behaviorScore: (l: typeof lessees[0]) => l.behaviorScore,
  stage: (l: typeof lessees[0]) => parseInt(l.stage),
  leases: (l: typeof lessees[0]) => l.leases,
  exposure: (l: typeof lessees[0]) => parseFloat(l.exposure.replace(/[$M]/g, "")),
  paymentDays: (l: typeof lessees[0]) => l.paymentDays,
};

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState("Leases");
  const [stageFilter, setStageFilter] = useState("All");
  const [aircraftExpanded, setAircraftExpanded] = useState<Set<string>>(new Set());
  const [aircraftOverrides, setAircraftOverrides] = useState<OverrideMap>({});

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

  const aircraftAccessors = {
    type:         (a: typeof aircraftWithValuation[0]) => a.type,
    vintage:      (a: typeof aircraftWithValuation[0]) => a.vintage,
    halfLifeBase: (a: typeof aircraftWithValuation[0]) => a.hlbVal,
    currentMV:    (a: typeof aircraftWithValuation[0]) => a.cmvVal,
    mav:          (a: typeof aircraftWithValuation[0]) => a.mavVal,
  };

  const filteredLeases =
    stageFilter === "All" ? leases : leases.filter((l) => l.stage === stageFilter);

  const { sorted: sortedLeases, sortState: leaseSortState, toggleSort: toggleLeaseSort } = useSortable(filteredLeases, leaseAccessors);
  const { sorted: sortedAircraft, sortState: aircraftSortState, toggleSort: toggleAircraftSort } = useSortable(aircraftWithValuation, aircraftAccessors);
  const { sorted: sortedLessees, sortState: lesseeSortState, toggleSort: toggleLesseeSort } = useSortable(lessees, lesseeAccessors);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Portfolio"
        subtitle="173 leases · 48 lessees · 12 aircraft types"
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
          <Download size={14} /> Export
        </button>
      </PageHeader>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
        <KpiCard label="Book Value" value="$2.84B" delta="+1.5% QoQ" deltaType="positive" />
        <KpiCard label="Encumbered Value" value="$2.61B" subtitle="91.9% of book" />
        <KpiCard label="Expected Loss" value="$47.2M" delta="+5.4% vs Q4" deltaType="negative" />
        <KpiCard label="Avg Lease Term" value="5.8 yrs" delta="-0.3yr vs prior" deltaType="negative" />
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #E2E8F0", display: "flex", gap: "0" }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "0.75rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #002147" : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab ? "#002147" : "#475569",
              cursor: "pointer",
              transition: "all 200ms ease",
              marginBottom: "-1px",
            }}
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
                    <td style={{ padding: "0.75rem 1rem" }}>
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
                            <AircraftValuationPanel
                              msn={a.msn}
                              overrides={aircraftOverrides}
                              onOverride={handleOverride}
                              onRevertOverride={handleRevertOverride}
                            />
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
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{l.name}</td>
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
    </div>
  );
}