import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { PlaneTakeoff, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PillTabs } from "../components/ui/PillTabs";
import { sdmrData } from "../components/portfolio/SDMRTab";
import { toMRChartData } from "../lib/mrChartAdapters";
import { MRPortfolioGrid } from "../components/maintenance/MRPortfolioGrid";
import { MRCashflowChart } from "../components/maintenance/MRCashflowChart";
import { MREventCalendar } from "../components/maintenance/MREventCalendar";

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
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "4rem 2rem",
            gap: "0.75rem",
            color: "#94A3B8",
            textAlign: "center",
            marginTop: "1.5rem",
          }}>
            <PlaneTakeoff size={32} style={{ color: "#CBD5E1" }} />
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#475569" }}>Aircraft Detail</div>
            <div style={{ fontSize: "0.875rem", maxWidth: "28rem", color: "#94A3B8" }}>
              Per-aircraft MR balance curves — component trajectories from today to lease end,
              with base and distressed scenario overlays. Coming in the next sprint.
            </div>
          </div>
        )}

        {activeTab === "Scenario Modelling" && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "4rem 2rem",
            gap: "0.75rem",
            color: "#94A3B8",
            textAlign: "center",
            marginTop: "1.5rem",
          }}>
            <SlidersHorizontal size={32} style={{ color: "#CBD5E1" }} />
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#475569" }}>Scenario Modelling</div>
            <div style={{ fontSize: "0.875rem", maxWidth: "28rem", color: "#94A3B8" }}>
              Adjust utilisation rates, MR rate assumptions, and lease end dates —
              see the impact on EOL shortfall across the portfolio in real time. Coming in a future sprint.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
