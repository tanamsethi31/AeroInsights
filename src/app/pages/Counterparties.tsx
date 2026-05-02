import { useState, useEffect } from "react";
import { useLocation } from "react-router";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { LesseeProfilePanel, type LesseeId } from "../components/counterparties/LesseeProfilePanel";

const lessees = [
  {
    id: "INDIGO",
    name: "IndiGo Airlines",
    country: "India",
    rating: "BB-",
    stage: "3" as const,
    behaviorScore: 44,
    scores: { punctuality: 28, restructuringCoop: 52, govtInterference: 41, litigationPropensity: 55 },
    exposure: "$184M",
    leases: 6,
    lastPayment: "2026-03-14",
    daysOverdue: 45,
    notes: "Payment 45 days overdue. §1110 cure risk elevated. Seeking deferral.",
  },
  {
    id: "AEROMEX",
    name: "Aeromexico",
    country: "Mexico",
    rating: "CCC",
    stage: "3" as const,
    behaviorScore: 29,
    scores: { punctuality: 18, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
    exposure: "$122M",
    leases: 4,
    lastPayment: "2026-01-31",
    daysOverdue: 88,
    notes: "Chapter 11 filing. §1110 cure window active. AerCap and Air Lease precedent reviewed.",
  },
  {
    id: "SRILNKN",
    name: "SriLankan Airlines",
    country: "Sri Lanka",
    rating: "B+",
    stage: "2" as const,
    behaviorScore: 62,
    scores: { punctuality: 55, restructuringCoop: 70, govtInterference: 48, litigationPropensity: 75 },
    exposure: "$118M",
    leases: 4,
    lastPayment: "2026-04-10",
    daysOverdue: 12,
    notes: "Downgraded by S&P. Government-owned carrier. High litigation propensity.",
  },
  {
    id: "AZUL",
    name: "Azul Brazilian Airlines",
    country: "Brazil",
    rating: "B+",
    stage: "2" as const,
    behaviorScore: 71,
    scores: { punctuality: 68, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
    exposure: "$142M",
    leases: 5,
    lastPayment: "2026-04-20",
    daysOverdue: 6,
    notes: "Schedule reductions. Liquidity tightening. Constructive engagement so far.",
  },
  {
    id: "TRANSATCA",
    name: "Air Transat",
    country: "Canada",
    rating: "B",
    stage: "2" as const,
    behaviorScore: 68,
    scores: { punctuality: 62, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
    exposure: "$96M",
    leases: 3,
    lastPayment: "2026-04-22",
    daysOverdue: 8,
    notes: "Restructuring discussions initiated. Canadian jurisdiction favorable for lessor.",
  },
  {
    id: "EMIRATES",
    name: "Emirates",
    country: "UAE",
    rating: "A-",
    stage: "1" as const,
    behaviorScore: 94,
    scores: { punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
    exposure: "$412M",
    leases: 8,
    lastPayment: "2026-04-28",
    daysOverdue: 0,
    notes: "Exemplary payment history. Strong sovereign backing. Low risk.",
  },
];


export default function Counterparties() {
  const location = useLocation();
  const [selectedLessee, setSelectedLessee] = useState(lessees[0]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("lessee");
    if (id) {
      const found = lessees.find(l => l.id === id);
      if (found) setSelectedLessee(found);
    }
  }, [location.search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Counterparties"
        subtitle="Lessee profiles, behavior scores & restructuring simulator"
      />

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Lessee List */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>Lessees</div>
            <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{lessees.length} counterparties</div>
          </div>
          <div>
            {lessees.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedLessee(l)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  width: "100%",
                  padding: "0.875rem 1.25rem",
                  borderBottom: "1px solid #E2E8F0",
                  background: selectedLessee.id === l.id ? "#F4F5F7" : "#FFFFFF",
                  border: "none",
                  borderLeft: selectedLessee.id === l.id ? "3px solid #002147" : "3px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 150ms ease",
                }}
              >
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: l.stage === "3" ? "rgba(185,28,28,0.1)" : l.stage === "2" ? "rgba(180,83,9,0.1)" : "rgba(21,128,61,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: l.stage === "3" ? "#B91C1C" : l.stage === "2" ? "#B45309" : "#15803D",
                  flexShrink: 0,
                }}>
                  {l.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{l.country} · {l.rating}</div>
                </div>
                <StatusPill stage={l.stage} label={l.stage === "3" ? "S3" : l.stage === "2" ? "S2" : "S1"} />
              </button>
            ))}
          </div>
        </div>

        {/* Lessee Detail */}
        <LesseeProfilePanel lesseeId={selectedLessee.id as LesseeId} />
      </div>
    </div>
  );
}