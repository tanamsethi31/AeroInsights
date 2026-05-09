import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { LeaseGenerator } from "../components/deals/LeaseGenerator";
import { RackAndStack } from "../components/deals/RackAndStack";
import { PortfolioExitNPV } from "../components/deals/PortfolioExitNPV";
import { PageHeader } from "../components/ui/PageHeader";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      <PageHeader
        title="Deals"
        subtitle="Lease structuring, option analysis and portfolio exit valuation"
      />

      {/* Tab bar */}
      <div style={{
        display: "flex",
        gap: "4px",
        background: "#F1F5F9",
        border: "1px solid #E2E8F0",
        borderRadius: "9999px",
        padding: "4px",
        marginTop: "-1.5rem",
        width: "fit-content",
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              style={{
                padding: "7px 20px",
                borderRadius: "9999px",
                border: "none",
                background: active ? "#002147" : "transparent",
                color: active ? "#FFFFFF" : "#64748B",
                fontSize: "13px",
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                transition: "all 180ms cubic-bezier(0.23,1,0.32,1)",
                boxShadow: active ? "0 1px 4px rgba(0,33,71,0.18)" : "none",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#002147"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}
            >
              {tab.label}
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
          {activeTab === "generator"  && <LeaseGenerator />}
          {activeTab === "rack-stack" && <RackAndStack />}
          {activeTab === "exit-npv"   && <PortfolioExitNPV />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
