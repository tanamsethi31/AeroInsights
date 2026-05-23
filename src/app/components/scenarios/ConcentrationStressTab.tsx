// src/app/components/scenarios/ConcentrationStressTab.tsx
// Single-name concentration stress analysis tab.
// Uses concentrationPolicy.ts rules + live portfolio base ECL to quantify
// ECL uplift if the peak-concentration entity in each dimension defaults.

import { useMemo } from "react";
import {
  DEFAULT_POLICY_RULES,
  PEAK_CONCENTRATIONS,
  type DimKey,
} from "../../data/concentrationPolicy";
import { usePortfolioData } from "../../hooks/usePortfolioData";
import { toDashboardKPIs } from "../../lib/portfolioAdapters";
import { BASE_ECL } from "../../utils/eclCalculator";
import { Card } from "../ui/Card";
import { ScenarioKpiCard as KpiCard } from "../ui/KpiCard";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Assumed LGD on a single-name default event: 65% (aviation recovery ≈ 35¢/$.
 * Used only for concentration stress ECL uplift — not the IFRS 9 portfolio LGD.
 */
const CONCENTRATION_LGD = 0.65;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusChip({ breach }: { breach: boolean }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "0.15rem 0.5rem",
      borderRadius: "9999px",
      fontSize: "0.75rem",
      fontWeight: 700,
      background: breach ? "#FEE2E2" : "#DCFCE7",
      color:      breach ? "#B91C1C" : "#15803D",
      whiteSpace: "nowrap",
    }}>
      {breach ? "⚠ Breach" : "✓ Compliant"}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onUseInCustomBuilder: (pdS3Multi: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ConcentrationStressTab({ onUseInCustomBuilder }: Props) {
  const { assets, lessees, provisions } = usePortfolioData();
  const liveBaseECL = useMemo(() => {
    const kpis = toDashboardKPIs(assets, lessees, provisions);
    return kpis.totalECLm > 0 ? kpis.totalECLm : BASE_ECL;
  }, [assets, lessees, provisions]);

  const enabledRules = DEFAULT_POLICY_RULES.filter((r) => r.enabled);

  interface StressRow {
    dimension: DimKey;
    ruleName:  string;
    limitPct:  number;
    peakName:  string;
    peakPct:   number;
    breach:    boolean;
    excessPct: number;
    stressECL: number; // $M — ECL uplift if peak entity defaults
  }

  const rows: StressRow[] = enabledRules.map((rule) => {
    const peak      = PEAK_CONCENTRATIONS[rule.dimension];
    const breach    = peak.pct > rule.limitPct;
    const excessPct = Math.max(0, peak.pct - rule.limitPct);
    // ECL uplift = (peak share of book) × baseECL × LGD
    const stressECL = (peak.pct / 100) * liveBaseECL * CONCENTRATION_LGD;
    return {
      dimension: rule.dimension,
      ruleName:  rule.label,
      limitPct:  rule.limitPct,
      peakName:  peak.name,
      peakPct:   peak.pct,
      breach,
      excessPct,
      stressECL,
    };
  });

  const breachCount     = rows.filter((r) => r.breach).length;
  const largestBreach   = rows.reduce<StressRow | null>((best, r) => r.breach && (best === null || r.excessPct > best.excessPct) ? r : best, null);
  const worstStressECL  = rows.reduce((m, r) => Math.max(m, r.stressECL), 0);

  // Suggested pdS3Multi for Custom Builder: 2.5x if any breach, 1.5x otherwise
  const suggestedPdS3Multi = breachCount > 0 ? 2.5 : 1.5;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Policy Breaches"
          value={`${breachCount} / ${enabledRules.length}`}
          color={breachCount > 0 ? "#B91C1C" : "#15803D"}
          bg={breachCount > 0 ? "#FEE2E2" : "#DCFCE7"}
          note={breachCount > 0 ? "Enabled policy rules exceeded" : "All enabled limits compliant"}
        />
        <KpiCard
          label="Largest Excess"
          value={largestBreach ? `+${largestBreach.excessPct.toFixed(1)}pp` : "—"}
          color={largestBreach ? "#B45309" : "#15803D"}
          bg={largestBreach ? "#FEF3C7" : "#DCFCE7"}
          note={largestBreach ? `${largestBreach.peakName} (${largestBreach.dimension})` : "No breach"}
        />
        <KpiCard
          label="Worst-Case Stress ECL"
          value={`$${worstStressECL.toFixed(1)}M`}
          color="#475569"
          bg="#F8FAFC"
          note="If highest-concentration entity defaults (65% LGD)"
        />
      </div>

      {/* ── Methodology note ── */}
      <div style={{
        fontSize: "0.8125rem", color: "#64748B",
        padding: "0.75rem", background: "#F8FAFC",
        borderRadius: "0.5rem", border: "1px solid #F1F5F9",
      }}>
        <strong style={{ color: "#475569" }}>Methodology:</strong> Stress ECL uplift = peak entity share × portfolio base ECL × 65% LGD (assumed aviation liquidation recovery ≈ 35%). This is a first-order approximation for scenario planning — not an IFRS 9 individual assessment.
      </div>

      {/* ── Compliance table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Concentration Policy Compliance
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["Dimension", "Rule", "Peak Entity", "Exposure", "Limit", "Excess", "Stress ECL", "Status"].map((h) => (
                    <th key={h} style={{
                      textAlign:     h === "Rule" || h === "Peak Entity" ? "left" : "right",
                      padding:       "0.5rem 0.75rem",
                      fontWeight:    600,
                      color:         "#64748B",
                      fontSize:      "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      whiteSpace:    "nowrap",
                    }}>
                      {h === "Dimension" ? <span style={{ textAlign: "left", display: "block" }}>{h}</span> : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.dimension}
                    style={{
                      borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none",
                      background:   row.breach ? "#FFF7F7" : (i % 2 === 0 ? "#FFFFFF" : "#FAFAFA"),
                    }}
                  >
                    <td style={{ padding: "0.625rem 0.75rem", fontWeight: 600, color: "#0F172A" }}>
                      {row.dimension}
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", color: "#475569", fontSize: "0.75rem", maxWidth: "14rem" }}>
                      {row.ruleName}
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>
                      {row.peakName}
                    </td>
                    <td style={{
                      padding: "0.625rem 0.75rem", textAlign: "right",
                      fontWeight: 600,
                      color: row.breach ? "#B91C1C" : "#475569",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {row.peakPct.toFixed(1)}%
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#64748B", fontVariantNumeric: "tabular-nums" }}>
                      {row.limitPct.toFixed(0)}%
                    </td>
                    <td style={{
                      padding: "0.625rem 0.75rem", textAlign: "right",
                      fontWeight: row.breach ? 700 : 400,
                      color: row.breach ? "#B45309" : "#94A3B8",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {row.breach ? `+${row.excessPct.toFixed(1)}pp` : "—"}
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#0F172A", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      ${row.stressECL.toFixed(1)}M
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                      <StatusChip breach={row.breach} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Use in Custom Builder CTA ── */}
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
              Sets Stage 3 PD multiplier to {suggestedPdS3Multi}× — reflecting{" "}
              {breachCount > 0 ? "concentrated single-name default stress" : "elevated monitoring level"}
            </div>
            <button
              onClick={() => onUseInCustomBuilder(suggestedPdS3Multi)}
              style={{
                padding:      "0.5rem 1rem",
                fontSize:     "0.8125rem",
                fontWeight:   600,
                background:   "#002147",
                color:        "#FFFFFF",
                border:       "none",
                borderRadius: "0.375rem",
                cursor:       "pointer",
              }}
            >
              Stress in Custom Builder
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
