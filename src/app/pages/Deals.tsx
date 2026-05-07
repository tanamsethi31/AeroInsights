import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { LeaseGenerator } from "../components/deals/LeaseGenerator";
import { RackAndStack } from "../components/deals/RackAndStack";
import { PortfolioExitNPV } from "../components/deals/PortfolioExitNPV";

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "generator",  label: "Lease Generator",    path: "/deals/generator"  },
  { id: "rack-stack", label: "Rack & Stack",        path: "/deals/rack-stack" },
  { id: "exit-npv",   label: "Portfolio Exit NPV",  path: "/deals/exit-npv"   },
] as const;

type TabId = (typeof TABS)[number]["id"];

function tabFromPath(pathname: string): TabId {
  const t = TABS.find(t => pathname.startsWith(t.path));
  return t ? t.id : "generator";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Deals() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>(tabFromPath(location.pathname));

  // Keep tab in sync when navigating via sidebar
  useEffect(() => {
    setActiveTab(tabFromPath(location.pathname));
  }, [location.pathname]);

  const handleTabClick = (tab: (typeof TABS)[number]) => {
    setActiveTab(tab.id);
    navigate(tab.path);
  };

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#F8FAFC" }}>

      {/* Page header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
          Deals
        </h1>
        <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>
          Lease structuring, option analysis and portfolio exit valuation
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex",
        gap: "4px",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "10px",
        padding: "4px",
        marginBottom: "24px",
        width: "fit-content",
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              style={{
                padding: "7px 18px",
                borderRadius: "7px",
                border: "none",
                background: active ? "#002147" : "transparent",
                color: active ? "#FFFFFF" : "#64748B",
                fontSize: "13px",
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                transition: "all 180ms cubic-bezier(0.23,1,0.32,1)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "generator"  && <LeaseGenerator />}
      {activeTab === "rack-stack" && <RackAndStack />}
      {activeTab === "exit-npv"   && <PortfolioExitNPV />}
    </div>
  );
}
