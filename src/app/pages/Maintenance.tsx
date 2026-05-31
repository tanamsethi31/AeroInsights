// src/app/pages/Maintenance.tsx
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { useTabSync } from "../hooks/useTabSync";
import { PageHeader } from "../components/ui/PageHeader";
import { PillTabs } from "../components/ui/PillTabs";
import { sdmrData } from "../components/portfolio/SDMRTab";
import { toMRChartData } from "../lib/mrChartAdapters";
import { MRPortfolioGrid } from "../components/maintenance/MRPortfolioGrid";
import { MRCashflowChart } from "../components/maintenance/MRCashflowChart";
import { MREventCalendar } from "../components/maintenance/MREventCalendar";
import { AircraftDetailTab } from "../components/maintenance/AircraftDetailTab";
import { ScenarioModellingTab } from "../components/maintenance/ScenarioModellingTab";
import { useAllServicerReports } from "../hooks/useAllServicerReports";
import { useAllMaintenanceEvents } from "../hooks/useAllMaintenanceEvents";
import { adjustedLease } from "../utils/maintenanceEvents";
import type { AdjustedLease } from "../utils/maintenanceEvents";

const PATH_TAB: Record<string, string> = {
  "/maintenance":           "Overview",
  "/maintenance/aircraft":  "Aircraft Detail",
  "/maintenance/scenarios": "Scenario Modelling",
};

const TABS = ["Overview", "Aircraft Detail", "Scenario Modelling"];

export default function Maintenance() {
  const { pathname } = useLocation();
  const [activeTab, setActiveTab] = useState(() => PATH_TAB[pathname] ?? "Overview");

  useEffect(() => {
    setActiveTab(PATH_TAB[pathname] ?? "Overview");
  }, [pathname]);
  // Wraps setActiveTab to also push the matching URL — keeps state + URL in sync.
  const handleTabChange = useTabSync(PATH_TAB, setActiveTab);

  const { reports, loading: reportsLoading } = useAllServicerReports();
  const { eventsMap, loading: eventsLoading } = useAllMaintenanceEvents();

  const adjustedLeases: AdjustedLease[] = useMemo(
    () => sdmrData.map(raw =>
      adjustedLease(raw, reports.get(raw.leaseId) ?? null, eventsMap.get(raw.leaseId) ?? [])
    ),
    [reports, eventsMap],
  );

  const chartData = useMemo(() => toMRChartData(sdmrData), []);
  const leaseLessees = useMemo(
    () => Object.fromEntries(sdmrData.map((l) => [l.leaseId, l.lessee])),
    []
  );

  const isLoading = reportsLoading || eventsLoading;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Maintenance Reserves"
        subtitle="Track MR balances, forecast cashflows, and model reserve scenarios across your portfolio"
      />

      <PillTabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={handleTabChange}
        style={{ marginTop: "-1.5rem" }}
      />

      {activeTab === "Overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1.5rem" }}>
          {isLoading ? (
            <div style={{ color: "#94A3B8", fontSize: "0.875rem", padding: "2rem 0" }}>Loading maintenance data…</div>
          ) : (
            <MRPortfolioGrid adjustedLeases={adjustedLeases} />
          )}
          <MRCashflowChart data={chartData.cashflow} />
          <MREventCalendar
            data={chartData.events}
            leaseIds={chartData.leaseIds}
            leaseColors={chartData.leaseColors}
            leaseLessees={leaseLessees}
          />
        </div>
      )}

      {activeTab === "Aircraft Detail" && (
        <AircraftDetailTab adjustedLeases={adjustedLeases} eventsMap={eventsMap} />
      )}

      {activeTab === "Scenario Modelling" && (
        <ScenarioModellingTab adjustedLeases={adjustedLeases} />
      )}
    </div>
  );
}
