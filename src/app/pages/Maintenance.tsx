import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { PageHeader } from "../components/ui/PageHeader";
import { PillTabs } from "../components/ui/PillTabs";
import { sdmrData } from "../components/portfolio/SDMRTab";
import { toMRChartData } from "../lib/mrChartAdapters";
import { MRPortfolioGrid } from "../components/maintenance/MRPortfolioGrid";
import { MRCashflowChart } from "../components/maintenance/MRCashflowChart";
import { MREventCalendar } from "../components/maintenance/MREventCalendar";
import { AircraftDetailTab } from "../components/maintenance/AircraftDetailTab";
import { ScenarioModellingTab } from "../components/maintenance/ScenarioModellingTab";

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

  const chartData = useMemo(() => toMRChartData(sdmrData), []);
  const leaseLessees = useMemo(
    () => Object.fromEntries(sdmrData.map((l) => [l.leaseId, l.lessee])),
    []
  );

  return (
    <>
      <PageHeader title="Maintenance Reserves" />

      <div style={{ padding: "1.5rem 2rem" }}>
        <PillTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "Overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1.5rem" }}>
            <MRPortfolioGrid sdmrData={sdmrData} />
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
          <AircraftDetailTab />
        )}

        {activeTab === "Scenario Modelling" && (
          <ScenarioModellingTab />
        )}
      </div>
    </>
  );
}
