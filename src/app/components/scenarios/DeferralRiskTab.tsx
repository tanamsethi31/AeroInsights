// src/app/components/scenarios/DeferralRiskTab.tsx
import { useState } from "react";
import { usePortfolioData } from "../../hooks/usePortfolioData";
import {
  RESTRUCTURING_TYPES,
  computePortfolioDeferralRisk,
  type DeferralRiskTier,
} from "../../utils/deferralRisk";
import { Card } from "../ui/Card";
import { ScenarioKpiCard as KpiCard } from "../ui/KpiCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<DeferralRiskTier, string> = {
  high:   "High",
  medium: "Medium",
  low:    "Low",
};

const TIER_PILL_BG: Record<DeferralRiskTier, string> = {
  high:   "#FEE2E2",
  medium: "#FEF3C7",
  low:    "#DCFCE7",
};

const TIER_PILL_COLOR: Record<DeferralRiskTier, string> = {
  high:   "#B91C1C",
  medium: "#B45309",
  low:    "#15803D",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskTierPill({ tier }: { tier: DeferralRiskTier }) {
  return (
    <span style={{
      background:   TIER_PILL_BG[tier],
      color:        TIER_PILL_COLOR[tier],
      fontWeight:   600,
      fontSize:     "0.75rem",
      padding:      "0.15rem 0.5rem",
      borderRadius: "9999px",
      whiteSpace:   "nowrap",
    }}>
      {TIER_LABEL[tier]}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onUseInCustomBuilder: (
    restructuringType: string,
    deferralMonths:    number,
    govtSupportProb:   number,
    forgivenessRate:   number,
  ) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DeferralRiskTab({ onUseInCustomBuilder }: Props) {
  const { lessees, leases } = usePortfolioData();
  const [selectedType, setSelectedType] = useState<string>("standstill");

  const preset = RESTRUCTURING_TYPES[selectedType];
  const { rows, totalDeferredM, expectedWriteOffM, govtBufferM } =
    computePortfolioDeferralRisk(
      lessees, leases,
      preset.deferralMonths, preset.govtSupportProb, preset.forgivenessRate,
    );

  const isStandstill = preset.forgivenessRate === 0;

  // Expected write-off colour: red >$5M, amber >$2M, green otherwise
  const writeOffColor = expectedWriteOffM > 5 ? "#B91C1C" : expectedWriteOffM > 2 ? "#B45309" : "#15803D";
  const writeOffBg    = expectedWriteOffM > 5 ? "#FEE2E2" : expectedWriteOffM > 2 ? "#FEF3C7" : "#DCFCE7";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Type picker pills ── */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {Object.entries(RESTRUCTURING_TYPES).map(([key, p]) => (
          <button
            key={key}
            onClick={() => setSelectedType(key)}
            style={{
              padding:      "0.375rem 0.875rem",
              fontSize:     "0.8125rem",
              fontWeight:   600,
              borderRadius: "9999px",
              border:       selectedType === key ? "none" : "1px solid #E2E8F0",
              background:   selectedType === key ? "#002147" : "#FFFFFF",
              color:        selectedType === key ? "#FFFFFF" : "#475569",
              cursor:       "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Scenario description ── */}
      <div style={{
        fontSize:     "0.8125rem",
        color:        "#64748B",
        padding:      "0.75rem",
        background:   "#F8FAFC",
        borderRadius: "0.5rem",
        border:       "1px solid #F1F5F9",
      }}>
        {preset.description}
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Total Deferred Exposure"
          value={rows.length === 0 ? "—" : `$${totalDeferredM.toFixed(1)}M`}
          color="#475569"
          bg="#F8FAFC"
        />
        <KpiCard
          label="Expected Write-off"
          value={rows.length === 0 ? "—" : `$${expectedWriteOffM.toFixed(2)}M`}
          color={isStandstill ? "#64748B" : writeOffColor}
          bg={isStandstill ? "#F8FAFC" : writeOffBg}
          note={isStandstill ? "No ECL impact" : undefined}
        />
        <KpiCard
          label="Govt Support Buffer"
          value={rows.length === 0 ? "—" : `$${govtBufferM.toFixed(2)}M`}
          color="#15803D"
          bg="#DCFCE7"
        />
      </div>

      {/* ── Per-lessee breakdown table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Per-Lessee Deferral Exposure
          </div>

          {rows.length === 0 ? (
            <div style={{ color: "#94A3B8", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
              No lessee data available.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    {["Airline", "Stage", "Risk Tier", "Monthly Rent", "Deferred Exposure", "Expected Loss"].map((h) => (
                      <th key={h} style={{
                        textAlign:     h === "Airline" ? "left" : "right",
                        padding:       "0.5rem 0.75rem",
                        fontWeight:    600,
                        color:         "#64748B",
                        fontSize:      "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        whiteSpace:    "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.lesseeName}
                      style={{
                        borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none",
                        background:   i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                      }}
                    >
                      <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>
                        {row.lesseeName}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569" }}>
                        {row.stage}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <RiskTierPill tier={row.riskTier} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        ${(row.monthlyRentalM * 1000).toFixed(0)}k
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        ${row.deferredExposureM.toFixed(2)}M
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        ${row.expectedLossM.toFixed(2)}M
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Use in Custom Builder CTA */}
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => onUseInCustomBuilder(
                selectedType,
                preset.deferralMonths,
                preset.govtSupportProb,
                preset.forgivenessRate,
              )}
              disabled={rows.length === 0}
              style={{
                padding:      "0.5rem 1rem",
                fontSize:     "0.8125rem",
                fontWeight:   600,
                background:   rows.length === 0 ? "#F1F5F9" : "#002147",
                color:        rows.length === 0 ? "#94A3B8" : "#FFFFFF",
                border:       "none",
                borderRadius: "0.375rem",
                cursor:       rows.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Use in Custom Builder
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
