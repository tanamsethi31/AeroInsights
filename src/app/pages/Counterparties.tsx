import { useState } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { KpiCard } from "../components/ui/KpiCard";

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

const restructuringOptions = [
  { name: "Payment Holiday", npv: "$82.1M", irr: "7.2%", ecl: "$12.4M", p95: "$24.1M", recovery: "14 mo" },
  { name: "Deferral w/ Catch-up", npv: "$86.4M", irr: "7.8%", ecl: "$10.8M", p95: "$19.7M", recovery: "18 mo" },
  { name: "Forgiveness (30%)", npv: "$72.3M", irr: "5.9%", ecl: "$8.2M", p95: "$14.2M", recovery: "24 mo" },
  { name: "PBH Conversion", npv: "$79.8M", irr: "7.1%", ecl: "$11.2M", p95: "$21.8M", recovery: "20 mo" },
  { name: "Term Extension", npv: "$88.2M", irr: "8.1%", ecl: "$9.4M", p95: "$17.6M", recovery: "16 mo" },
  { name: "Rate Reduction (−15%)", npv: "$77.9M", irr: "6.8%", ecl: "$10.1M", p95: "$18.4M", recovery: "22 mo" },
  { name: "Termination (baseline)", npv: "$61.2M", irr: "4.2%", ecl: "$18.7M", p95: "$38.9M", recovery: "36 mo" },
];

export default function Counterparties() {
  const [selectedLessee, setSelectedLessee] = useState(lessees[0]);
  const [showRestructuring, setShowRestructuring] = useState(false);

  const radarData = [
    { subject: "Punctuality", score: selectedLessee.scores.punctuality },
    { subject: "Restr. Coop.", score: selectedLessee.scores.restructuringCoop },
    { subject: "Govt. Independence", score: selectedLessee.scores.govtInterference },
    { subject: "Low Litigation", score: 100 - selectedLessee.scores.litigationPropensity },
  ];

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
                onClick={() => { setSelectedLessee(l); setShowRestructuring(false); }}
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
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Profile Header */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "1rem", padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0F172A", margin: "0 0 0.25rem" }}>{selectedLessee.name}</h2>
                <div style={{ fontSize: "0.875rem", color: "#475569" }}>{selectedLessee.country} · Credit Rating: <strong style={{ color: "#0F172A" }}>{selectedLessee.rating}</strong> · {selectedLessee.leases} leases · {selectedLessee.exposure} exposure</div>
              </div>
              <StatusPill stage={selectedLessee.stage} label={`Stage ${selectedLessee.stage}`} />
            </div>
            <div style={{ padding: "0.75rem", background: selectedLessee.stage === "3" ? "rgba(185,28,28,0.05)" : selectedLessee.stage === "2" ? "rgba(180,83,9,0.05)" : "rgba(21,128,61,0.05)", borderRadius: "0.75rem", borderLeft: `3px solid ${selectedLessee.stage === "3" ? "#B91C1C" : selectedLessee.stage === "2" ? "#B45309" : "#15803D"}` }}>
              <div style={{ fontSize: "0.8125rem", color: "#475569" }}><strong style={{ color: "#0F172A" }}>Analyst Note:</strong> {selectedLessee.notes}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <KpiCard label="Behavior Score" value={selectedLessee.behaviorScore.toString()} subtitle="0 = worst · 100 = best" delta={selectedLessee.behaviorScore >= 80 ? "Low risk" : selectedLessee.behaviorScore >= 60 ? "Medium risk" : "High risk"} deltaType={selectedLessee.behaviorScore >= 80 ? "positive" : selectedLessee.behaviorScore >= 60 ? "neutral" : "negative"} />
            <KpiCard label="Days Overdue" value={selectedLessee.daysOverdue.toString()} subtitle={`Last payment: ${selectedLessee.lastPayment}`} deltaType={selectedLessee.daysOverdue > 30 ? "negative" : selectedLessee.daysOverdue > 0 ? "neutral" : "positive"} delta={selectedLessee.daysOverdue === 0 ? "Current" : `${selectedLessee.daysOverdue} days late`} />
          </div>

          {/* Behavior Radar */}
          <Card title="Behavior Score Breakdown" subtitle="Observed contractual-performance indicator under stress">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "center" }}>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid key="radar-grid" stroke="#E2E8F0" />
                  <PolarAngleAxis key="radar-angle-axis" dataKey="subject" tick={{ fontSize: 11, fill: "#475569" }} />
                  <Radar key="radar-score" name="Score" dataKey="score" stroke="#002147" fill="#002147" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[
                  { label: "Payment Punctuality", score: selectedLessee.scores.punctuality },
                  { label: "Restructuring Cooperation", score: selectedLessee.scores.restructuringCoop },
                  { label: "Govt. Interference Risk", score: 100 - selectedLessee.scores.govtInterference, inverted: true },
                  { label: "Litigation Propensity", score: 100 - selectedLessee.scores.litigationPropensity, inverted: true },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.8125rem", color: "#475569" }}>{item.label}</span>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: item.score >= 70 ? "#15803D" : item.score >= 50 ? "#B45309" : "#B91C1C" }}>{item.score}</span>
                    </div>
                    <div style={{ height: "5px", background: "#E2E8F0", borderRadius: "3px" }}>
                      <div style={{ width: `${item.score}%`, height: "100%", background: item.score >= 70 ? "#15803D" : item.score >= 50 ? "#B45309" : "#B91C1C", borderRadius: "3px" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Restructuring Simulator */}
          <Card
            title="Restructuring Simulator"
            subtitle="Side-by-side comparison of 7 restructuring options"
            headerRight={
              <button
                onClick={() => setShowRestructuring(!showRestructuring)}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#002147", color: "#FFFFFF", border: "none", borderRadius: "9999px", padding: "0.5rem 1rem", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}
              >
                {showRestructuring ? "Hide" : "Show"} Comparison
              </button>
            }
          >
            {showRestructuring ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
                  <thead>
                    <tr style={{ background: "#F4F5F7" }}>
                      {["Option", "NPV to Lessor", "IRR", "ECL", "P95 Downside", "Time-to-Recovery", ""].map((h) => (
                        <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {restructuringOptions.map((opt, i) => {
                      const isTermination = opt.name.includes("Termination");
                      const isBest = opt.name === "Term Extension";
                      return (
                        <tr key={opt.name} style={{ borderBottom: "1px solid #E2E8F0", background: isBest ? "rgba(21,128,61,0.04)" : isTermination ? "rgba(185,28,28,0.04)" : i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
                          <td style={{ padding: "0.75rem 1rem", fontWeight: isBest ? 600 : 400, color: "#0F172A" }}>
                            {isBest && <span style={{ fontSize: "0.625rem", color: "#15803D", fontWeight: 600, marginRight: "0.375rem", background: "rgba(21,128,61,0.1)", padding: "0.125rem 0.375rem", borderRadius: "0.5rem" }}>BEST</span>}
                            {opt.name}
                          </td>
                          <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{opt.npv}</td>
                          <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>{opt.irr}</td>
                          <td style={{ padding: "0.75rem 1rem", color: isTermination ? "#B91C1C" : "#0F172A" }}>{opt.ecl}</td>
                          <td style={{ padding: "0.75rem 1rem", color: isTermination ? "#B91C1C" : "#0F172A" }}>{opt.p95}</td>
                          <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{opt.recovery}</td>
                          <td style={{ padding: "0.75rem 1rem" }}>
                            {!isTermination && (
                              <button style={{ fontSize: "0.75rem", fontWeight: 500, color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.25rem 0.625rem", cursor: "pointer" }}>
                                Draft Term Sheet
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: "1rem", background: "#F4F5F7", borderRadius: "0.75rem", fontSize: "0.8125rem", color: "#475569" }}>
                Click "Show Comparison" to run the restructuring simulator and compare NPV, IRR, ECL, and downside across 7 options for {selectedLessee.name}.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}