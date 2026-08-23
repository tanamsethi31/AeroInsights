// src/app/pages/Transactions.tsx
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router";
import { motion } from "framer-motion";
import { Landmark, Plus, Play, ChevronRight } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PillTabs } from "../components/ui/PillTabs";
import { DealSetupModal } from "../components/transactions/DealSetupModal";
import { CollectionOverridesTable } from "../components/transactions/CollectionOverridesTable";
import { CoverageTestPanel } from "../components/transactions/CoverageTestPanel";
import { DistributionStatement } from "../components/transactions/DistributionStatement";
import { useAbsDeals } from "../hooks/useAbsDeals";
import { usePortfolioData } from "../hooks/usePortfolioData";
import { useTabSync } from "../hooks/useTabSync";
import {
  runWaterfall,
  computePortfolioAircraftValue,
  type CollectionInput,
  type WaterfallResult,
} from "../utils/absWaterfall";

type TabId = "overview" | "run" | "coverage" | "statement";

const TABS: TabId[] = ["overview", "run", "coverage", "statement"];
const TAB_LABELS: Record<TabId, string> = {
  overview:  "Overview",
  run:       "Run Waterfall",
  coverage:  "Coverage Tests",
  statement: "Distribution Statement",
};

// The sidebar links directly to "Overview" and "Run Waterfall" — keep the
// URL in sync with the active tab so those links land on the right pane
// (see useTabSync for why this matters on repeat clicks).
const PATH_TAB: Record<string, string> = {
  "/transactions":     "overview",
  "/transactions/run": "run",
};

const fmtM = (n: number) => `$${n.toFixed(2)}M`;

function currentQuarterLabel() {
  const now = new Date();
  return `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
}

export default function Transactions() {
  const { deals, loading, createDeal } = useAbsDeals();
  const { assets, leases, lessees }    = usePortfolioData();
  const { pathname } = useLocation();

  const [setupOpen, setSetupOpen]       = useState(false);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState(() => PATH_TAB[pathname] ?? "overview");
  useEffect(() => { setActiveTab(PATH_TAB[pathname] ?? "overview"); }, [pathname]);
  const handleTabChange = useTabSync(PATH_TAB, setActiveTab);
  const [periodLabel, setPeriodLabel]   = useState(currentQuarterLabel);
  const [collections, setCollections]   = useState<CollectionInput[]>([]);
  const [waterfallResult, setWaterfallResult] = useState<WaterfallResult | null>(null);

  const activeDeal = deals.find(d => d.id === activeDealId) ?? deals[0] ?? null;

  // When active deal changes, rebuild collections from lease register
  const defaultCollections = useMemo<CollectionInput[]>(() => {
    if (!activeDeal) return [];
    return activeDeal.aircraftIds.flatMap(assetId => {
      const lease = leases.find(l => l.asset_id === assetId);
      if (!lease) return [];
      const lessee = lessees.find(l => l.id === lease.lessee_id);
      const rentM = (lease.monthly_rental ?? 0) / 1_000_000;
      return [{
        leaseId:         lease.id,
        lessee:          lessee?.name ?? "Unknown",
        expectedRent:    rentM,
        actualCollected: rentM,
      }];
    });
  }, [activeDeal, leases, lessees]);

  const activeCollections = collections.length > 0 ? collections : defaultCollections;

  const portfolioAircraftValueM = useMemo(() => {
    if (!activeDeal) return 0;
    return computePortfolioAircraftValue(activeDeal.aircraftIds, assets);
  }, [activeDeal, assets]);

  function handleRunWaterfall() {
    if (!activeDeal || portfolioAircraftValueM <= 0) return;
    const result = runWaterfall(
      activeCollections,
      activeDeal.noteClasses,
      activeDeal.reserveAccounts,
      activeDeal.coverageTests,
      activeDeal.seniorExpenses,
      portfolioAircraftValueM
    );
    setWaterfallResult(result);
    setActiveTab("coverage");
  }

  // ─── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <PageHeader title="Transactions" subtitle="ABS deal waterfall management" />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: "3rem", borderRadius: "8px", background: "#1E293B" }} />
          ))}
        </div>
      </motion.div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────────
  if (deals.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <PageHeader title="Transactions" subtitle="ABS deal waterfall management" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "4rem 2rem", borderRadius: "12px", border: "1px dashed #334155",
          background: "#0F172A", textAlign: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#1E293B",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
            <Landmark size={24} style={{ color: "#3B82F6" }} />
          </div>
          <h3 style={{ margin: "0 0 0.5rem", color: "#F8FAFC", fontSize: "1.125rem", fontWeight: 600 }}>
            No ABS deals yet
          </h3>
          <p style={{ margin: "0 0 1.5rem", color: "#64748B", fontSize: "0.875rem", maxWidth: "360px" }}>
            Set up your first deal to start running waterfall calculations, evaluating coverage tests, and producing distribution statements.
          </p>
          <button onClick={() => setSetupOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.25rem",
              background: "#3B82F6", border: "none", borderRadius: "8px", color: "#FFF",
              fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
            <Plus size={16} /> Set up your first ABS deal
          </button>
        </div>
        <DealSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} onCreate={createDeal} />
      </motion.div>
    );
  }

  // ─── Active deal view ───────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      <PageHeader title="Transactions" subtitle="ABS deal waterfall management">
        <button onClick={() => setSetupOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem",
            background: "#1E293B", border: "1px solid #334155", borderRadius: "8px",
            color: "#CBD5E1", fontSize: "0.8125rem", cursor: "pointer" }}>
          <Plus size={14} /> New Deal
        </button>
      </PageHeader>

      {/* Deal selector — show if more than 1 deal */}
      {deals.length > 1 && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {deals.map(d => (
            <button key={d.id} onClick={() => { setActiveDealId(d.id); setWaterfallResult(null); setCollections([]); }}
              style={{ padding: "0.5rem 1rem", borderRadius: "8px", cursor: "pointer",
                background: activeDeal?.id === d.id ? "#1E3A5F" : "#1E293B",
                border: `1px solid ${activeDeal?.id === d.id ? "#3B82F6" : "#334155"}`,
                color: activeDeal?.id === d.id ? "#93C5FD" : "#94A3B8", fontSize: "0.8125rem" }}>
              {d.dealName}
            </button>
          ))}
        </div>
      )}

      {activeDeal && (
        <>
          <PillTabs
            tabs={TABS}
            activeTab={activeTab}
            onChange={id => handleTabChange(id as TabId)}
            renderTab={(tab, isActive) => TAB_LABELS[tab as TabId] ?? tab}
          />

          {/* Overview */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
                {[
                  { label: "Deal",             value: activeDeal.dealName },
                  { label: "Closing Date",     value: activeDeal.closingDate },
                  { label: "Currency",         value: activeDeal.currency },
                  { label: "Aircraft in Pool", value: `${activeDeal.aircraftIds.length}` },
                  { label: "Portfolio Value",  value: fmtM(portfolioAircraftValueM) },
                ].map(kpi => (
                  <div key={kpi.label} style={{ padding: "1rem", borderRadius: "8px",
                    background: "#1E293B", border: "1px solid #334155" }}>
                    <p style={{ margin: "0 0 0.25rem", color: "#64748B", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {kpi.label}
                    </p>
                    <p style={{ margin: 0, color: "#F8FAFC", fontSize: "1rem", fontWeight: 600 }}>
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Note class table */}
              <div style={{ borderRadius: "8px", border: "1px solid #334155", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "#0F172A" }}>
                    <tr>
                      {["Class", "Outstanding ($M)", "Coupon", "Sched. Principal ($M)", "Next Interest Due ($M)"].map(h => (
                        <th key={h} style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem",
                          color: "#94A3B8", textAlign: h === "Class" ? "left" : "right",
                          fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDeal.noteClasses.map((n, i) => {
                      const ppy = activeDeal.seniorExpenses.paymentFrequency === "monthly" ? 12 : 4;
                      const interestDue = (n.outstandingBalance * n.couponRate) / ppy;
                      return (
                        <tr key={n.label} style={{ background: i % 2 === 0 ? "#1E293B" : "#162032", borderBottom: "1px solid #1E293B" }}>
                          <td style={{ padding: "0.5rem 0.75rem", color: "#F8FAFC", fontWeight: 600 }}>Class {n.label}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#CBD5E1" }}>{fmtM(n.outstandingBalance)}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#CBD5E1" }}>{(n.couponRate * 100).toFixed(2)}%</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#CBD5E1" }}>{fmtM(n.scheduledPrincipal)}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#93C5FD" }}>{fmtM(interestDue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button onClick={() => setActiveTab("run")}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", alignSelf: "flex-start",
                  padding: "0.625rem 1.25rem", background: "#3B82F6", border: "none",
                  borderRadius: "8px", color: "#FFF", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
                <Play size={15} /> Run Waterfall <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* Run Waterfall */}
          {activeTab === "run" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#94A3B8", marginBottom: "0.25rem", fontWeight: 500 }}>
                  Period Label
                </label>
                <input
                  value={periodLabel}
                  onChange={e => setPeriodLabel(e.target.value)}
                  placeholder="e.g. Q2 2026"
                  style={{ padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #334155",
                    background: "#0F172A", color: "#F8FAFC", fontSize: "0.875rem", outline: "none", minWidth: "180px" }}
                />
              </div>

              {defaultCollections.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#64748B", fontSize: "0.875rem",
                  borderRadius: "8px", border: "1px dashed #334155" }}>
                  No leases found for aircraft in this deal pool. Add aircraft in deal settings.
                </div>
              ) : (
                <CollectionOverridesTable
                  collections={activeCollections}
                  onChange={setCollections}
                />
              )}

              <button
                onClick={handleRunWaterfall}
                disabled={activeCollections.length === 0 || portfolioAircraftValueM <= 0}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", alignSelf: "flex-start",
                  padding: "0.625rem 1.25rem", background: "#16A34A", border: "none",
                  borderRadius: "8px", color: "#FFF", fontSize: "0.875rem", fontWeight: 600,
                  cursor: (activeCollections.length === 0 || portfolioAircraftValueM <= 0) ? "not-allowed" : "pointer",
                  opacity: (activeCollections.length === 0 || portfolioAircraftValueM <= 0) ? 0.5 : 1 }}>
                <Play size={15} /> Run Waterfall
              </button>

              {portfolioAircraftValueM <= 0 && activeDeal.aircraftIds.length > 0 && (
                <p style={{ margin: 0, color: "#FBBF24", fontSize: "0.8125rem" }}>
                  ⚠ Portfolio aircraft value could not be resolved. Ensure aircraft types match known types.
                </p>
              )}
            </div>
          )}

          {/* Coverage Tests */}
          {activeTab === "coverage" && (
            <div>
              {!waterfallResult ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#64748B",
                  borderRadius: "8px", border: "1px dashed #334155" }}>
                  Run the waterfall first to see coverage test results.
                </div>
              ) : (
                <CoverageTestPanel
                  dscrResult={waterfallResult.dscrResult}
                  ltvResult={waterfallResult.ltvResult}
                  result={waterfallResult}
                  noteClasses={activeDeal.noteClasses}
                  portfolioAircraftValueM={portfolioAircraftValueM}
                  seniorExpenses={activeDeal.seniorExpenses}
                />
              )}
            </div>
          )}

          {/* Distribution Statement */}
          {activeTab === "statement" && (
            <div>
              {!waterfallResult ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#64748B",
                  borderRadius: "8px", border: "1px dashed #334155" }}>
                  Run the waterfall first to generate a distribution statement.
                </div>
              ) : (
                <DistributionStatement
                  result={waterfallResult}
                  noteClasses={activeDeal.noteClasses}
                  periodLabel={periodLabel}
                />
              )}
            </div>
          )}
        </>
      )}

      <DealSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} onCreate={createDeal} />
    </motion.div>
  );
}
