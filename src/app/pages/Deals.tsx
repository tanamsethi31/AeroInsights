import { useState, useEffect } from "react";
import { useLocation} from "react-router";
import { useTransitionNavigate as useNavigate } from "../hooks/useTransitionNavigate";
import { motion, AnimatePresence } from "framer-motion";
import { LeaseGenerator } from "../components/deals/LeaseGenerator";
import { RackAndStack } from "../components/deals/RackAndStack";
import { PortfolioExitNPV } from "../components/deals/PortfolioExitNPV";
import { PageHeader } from "../components/ui/PageHeader";
import { PillTabs } from "../components/ui/PillTabs";

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

  const handleTabClick = (id: string) => {
    const tab = TABS.find(t => t.id === id);
    if (!tab) return;
    setActiveTab(id as TabId);
    navigate(tab.path);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
    >

      <PageHeader
        title="Deals"
        subtitle="Lease structuring, option analysis and portfolio exit valuation"
      />

      <PillTabs
        tabs={TABS.map(t => t.id)}
        activeTab={activeTab}
        onChange={handleTabClick}
        renderTab={(id) => TABS.find(t => t.id === id)?.label ?? id}
        style={{ marginTop: "-1.5rem" }}
      />

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
    </motion.div>
  );
}
