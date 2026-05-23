// src/app/pages/RateOutlook.tsx
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useRateOutlook } from "../hooks/useRateOutlook";
import { useData } from "../contexts/DataContext";
import { RateOutlookKPIStrip } from "../components/rate-outlook/RateOutlookKPIStrip";
import { RateOutlookGrid } from "../components/rate-outlook/RateOutlookGrid";
import { RateOutlookChart } from "../components/rate-outlook/RateOutlookChart";
import { PortfolioRateOverlay, type PortfolioLease } from "../components/rate-outlook/PortfolioRateOverlay";
import { DEMO_LEASES } from "../data/demoCashFlowLeases";
import { sdmrData } from "../components/portfolio/SDMRTab";
import type { AircraftCategory, AircraftType } from "../data/rateOutlookData";

const T = {
  blue: "#002147", text: "#0F172A", muted: "#475569",
  border: "#E2E8F0", bg: "#F8FAFC",
} as const;

type ViewMode = "grid" | "chart";
const CAT_FILTERS: { id: AircraftCategory | "All"; label: string }[] = [
  { id: "All",        label: "All"        },
  { id: "Narrowbody", label: "Narrowbody" },
  { id: "Widebody",   label: "Widebody"   },
  { id: "Regional",   label: "Regional"   },
];

function FilterChip({
  active, label, onClick,
}: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "0.3rem 0.75rem", borderRadius: "9999px",
        border: `1px solid ${active ? T.blue : T.border}`,
        background: active ? T.blue : "#FFFFFF",
        color: active ? "#FFFFFF" : T.text,
        fontSize: "0.8125rem", fontWeight: active ? 600 : 400,
        cursor: "pointer", whiteSpace: "nowrap",
        transition: "all 140ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div
      style={{
        display: "flex", gap: "0.25rem",
        background: T.bg, border: `1px solid ${T.border}`,
        borderRadius: "0.5rem", padding: "0.2rem",
      }}
    >
      {(["grid", "chart"] as ViewMode[]).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: "0.3rem 0.75rem", borderRadius: "0.375rem",
            background: view === v ? "#FFFFFF" : "transparent",
            border: view === v ? `1px solid ${T.border}` : "1px solid transparent",
            color: view === v ? T.text : T.muted,
            fontSize: "0.8125rem", fontWeight: view === v ? 600 : 400,
            cursor: "pointer", transition: "all 140ms ease-out",
          }}
        >
          {v === "grid" ? "⊞ Grid" : "≡ Chart"}
        </button>
      ))}
    </div>
  );
}

// Build demo portfolio leases for the overlay from DEMO_LEASES + sdmrData
function buildDemoPortfolioLeases(): PortfolioLease[] {
  return DEMO_LEASES.map((lease) => {
    const sdmr = sdmrData.find((s) => s.leaseId === lease.id);
    return {
      lesseeId:          lease.id,
      lesseeName:        sdmr?.lessee ?? lease.lessee_id,
      aircraftType:      (sdmr?.aircraft ?? "A320neo") as AircraftType,
      contractedRentUSD: lease.monthly_rental,
      isDemo:            true,
    };
  });
}

export default function RateOutlook() {
  const navigate = useNavigate();
  const { data } = useRateOutlook();
  const { hasUpload } = useData();

  const [view, setView]           = useState<ViewMode>("grid");
  const [catFilter, setCatFilter] = useState<AircraftCategory | "All">("All");
  const [selectedType, setSelectedType] = useState<string>(data.types[0]?.type ?? "A320neo");

  const portfolioLeases = useMemo<PortfolioLease[]>(() => buildDemoPortfolioLeases(), []);

  function handleSelectType(type: string) {
    setSelectedType(type);
    setView("chart");
  }

  // Find contracted rent for selected type (first matching lease)
  const contractedRent = useMemo(() => {
    const match = portfolioLeases.find((l) => l.aircraftType === selectedType);
    return match?.contractedRentUSD ?? null;
  }, [portfolioLeases, selectedType]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      style={{ padding: "1.5rem 2rem", maxWidth: "1400px", margin: "0 auto" }}
    >
      {/* Page header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "2rem", height: "2rem", borderRadius: "0.5rem",
              border: `1px solid ${T.border}`, background: "#FFFFFF",
              color: T.muted, cursor: "pointer", flexShrink: 0,
              transition: "border-color 140ms ease, color 140ms ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.blue; (e.currentTarget as HTMLButtonElement).style.color = T.blue; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; (e.currentTarget as HTMLButtonElement).style.color = T.muted; }}
            title="Back to Aero Intelligence"
          >
            <ArrowLeft size={15} />
          </button>
          <h1
            style={{
              fontSize: "1.375rem", fontWeight: 800, color: T.text,
              letterSpacing: "-0.02em", margin: 0,
            }}
          >
            Rate Outlook
          </h1>
        </div>
        <p style={{ fontSize: "0.8125rem", color: T.muted, marginTop: "0.1rem", paddingLeft: "2.625rem" }}>
          12-month forward rate intelligence · 18 aircraft types · Macro-adjusted
        </p>
      </div>

      {/* KPI strip */}
      <RateOutlookKPIStrip data={data} />

      {/* Filter bar */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: "0.5rem",
          alignItems: "center", marginBottom: "1.25rem",
        }}
      >
        {CAT_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            active={catFilter === f.id}
            label={f.label}
            onClick={() => setCatFilter(f.id)}
          />
        ))}
        <div style={{ marginLeft: "auto" }}>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* Grid / Chart views */}
      {view === "grid" ? (
        <RateOutlookGrid
          data={data}
          categoryFilter={catFilter}
          onSelectType={handleSelectType}
        />
      ) : (
        <RateOutlookChart
          data={data}
          selectedType={selectedType}
          contractedRent={contractedRent}
          onBack={() => setView("grid")}
        />
      )}

      {/* Portfolio overlay */}
      <PortfolioRateOverlay
        data={data}
        leases={portfolioLeases}
        isDemo={!hasUpload}
      />

      {/* Source attribution */}
      <div
        style={{
          marginTop: "2rem",
          padding: "0.875rem 1.125rem",
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: "0.625rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem",
        }}
      >
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: T.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Data Sources
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.25rem" }}>
          {[
            { label: "Base rents & asset values", src: "AVAC / IBA published market surveys (Apr 2026)" },
            { label: "RPK growth & load factor",  src: "IATA Air Passenger Market Analysis" },
            { label: "Jet-A1 fuel price",         src: "IATA Fuel Monitor / Platts" },
            { label: "Brent crude",               src: "U.S. Energy Information Administration (EIA)" },
            { label: "10Y USD Treasury rate",     src: "U.S. Federal Reserve H.15" },
          ].map(({ label, src }) => (
            <span key={label} style={{ fontSize: "0.75rem", color: T.muted }}>
              <span style={{ fontWeight: 600, color: T.text }}>{label}:</span>{" "}{src}
            </span>
          ))}
        </div>
        <span style={{ fontSize: "0.7rem", color: T.muted, marginTop: "0.15rem" }}>
          Forecasts are model-generated and indicative only. They do not constitute financial advice or a valuation opinion.
        </span>
      </div>
    </motion.div>
  );
}
