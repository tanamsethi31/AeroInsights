// src/app/components/scenarios/JurisdictionRiskTab.tsx
import { usePortfolioData } from "../../hooks/usePortfolioData";
import { useJurisdictions } from "../../hooks/useJurisdictions";
import { computePortfolioJurisdictionMix, type CtcTier, UNKNOWN_REPOSS_P50 } from "../../utils/jurisdictionRisk";
import { BASE_ECL } from "../../utils/eclCalculator";
import { Card } from "../ui/Card";
import { ScenarioKpiCard as KpiCard } from "../ui/KpiCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<CtcTier, string> = {
  gold:     "CTC Gold",
  moderate: "CTC Moderate",
  nonCtc:   "Non-CTC",
};

const TIER_PILL_BG: Record<CtcTier, string> = {
  gold:     "#DCFCE7",
  moderate: "#FEF3C7",
  nonCtc:   "#FEE2E2",
};

const TIER_PILL_COLOR: Record<CtcTier, string> = {
  gold:     "#15803D",
  moderate: "#B45309",
  nonCtc:   "#B91C1C",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierPill({ tier }: { tier: CtcTier }) {
  return (
    <span style={{
      background: TIER_PILL_BG[tier],
      color: TIER_PILL_COLOR[tier],
      fontWeight: 600, fontSize: "0.75rem",
      padding: "0.15rem 0.5rem", borderRadius: "9999px",
      whiteSpace: "nowrap",
    }}>
      {TIER_LABEL[tier]}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Called when user clicks "Use in Custom Builder" — switches tab and pre-fills sliders. */
  onUseInCustomBuilder: (ctcGoldPct: number, nonCtcPct: number, repossWeightedMonths: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function JurisdictionRiskTab({ onUseInCustomBuilder }: Props) {
  const { lessees, leases } = usePortfolioData();
  const { jurisdictions } = useJurisdictions();
  const { ctcGoldPct, nonCtcPct, avgRepossP50Months, rows } = computePortfolioJurisdictionMix(lessees, leases, jurisdictions);
  const ctcModeratePct = Math.max(0, 1 - ctcGoldPct - nonCtcPct);

  // LGD uplift using BASE_ECL (47.2) — consistent with spec calibration.
  const uplift = rows.length === 0
    ? 0
    : (ctcModeratePct * 0.06 + nonCtcPct * 0.15) * BASE_ECL;

  // Non-CTC card thresholds: red >20%, amber >10%, green otherwise
  const nonCtcColor = nonCtcPct > 0.2 ? "#B91C1C" : nonCtcPct > 0.1 ? "#B45309" : "#15803D";
  const nonCtcBg    = nonCtcPct > 0.2 ? "#FEE2E2" : nonCtcPct > 0.1 ? "#FEF3C7" : "#DCFCE7";

  // Uplift card color: red if > 0, green if 0
  const upliftColor = uplift > 0 ? "#B91C1C" : "#15803D";
  const upliftBg    = uplift > 0 ? "#FEE2E2" : "#DCFCE7";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="CTC Gold"
          value={`${(ctcGoldPct * 100).toFixed(1)}%`}
          color="#15803D"
          bg="#DCFCE7"
        />
        <KpiCard
          label="CTC Moderate"
          value={`${(ctcModeratePct * 100).toFixed(1)}%`}
          color="#B45309"
          bg="#FEF3C7"
        />
        <KpiCard
          label="Non-CTC"
          value={`${(nonCtcPct * 100).toFixed(1)}%`}
          color={nonCtcColor}
          bg={nonCtcBg}
        />
        <KpiCard
          label="Jurisdiction LGD Uplift"
          value={uplift > 0 ? `+$${uplift.toFixed(1)}M` : "$0"}
          color={upliftColor}
          bg={upliftBg}
        />
        <KpiCard
          label="Avg Reposs P50"
          value={avgRepossP50Months > 0 ? `${avgRepossP50Months.toFixed(1)} mo` : "—"}
          color={avgRepossP50Months > 8 ? "#B91C1C" : avgRepossP50Months > 4 ? "#B45309" : "#15803D"}
          bg={avgRepossP50Months > 8 ? "#FEE2E2" : avgRepossP50Months > 4 ? "#FEF3C7" : "#DCFCE7"}
          note="rental-weighted fleet timeline"
        />
      </div>

      {/* ── Lessee breakdown table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Lessee Jurisdiction Breakdown
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
                    {["Airline", "Country", "CTC Tier", "CTC Score", "Reposs P50", "Weight %"].map((h) => (
                      <th key={h} style={{
                        textAlign: h === "Airline" || h === "Country" ? "left" : "right",
                        padding: "0.5rem 0.75rem",
                        fontWeight: 600, color: "#64748B",
                        fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
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
                        background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                      }}
                    >
                      <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>
                        {row.lesseeName}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>
                        {row.country || "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <TierPill tier={row.tier} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.ctcScore > 0 ? row.ctcScore : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.repossP50 < UNKNOWN_REPOSS_P50 ? `${row.repossP50} mo` : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                        {(row.weightPct * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Weighted summary row */}
                <tfoot>
                  <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                    <td colSpan={2} style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#475569", fontSize: "0.75rem" }}>
                      PORTFOLIO WEIGHTED
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                        {(ctcGoldPct * 100).toFixed(0)}% Gold · {(ctcModeratePct * 100).toFixed(0)}% Mod · {(nonCtcPct * 100).toFixed(0)}% Non-CTC
                      </span>
                    </td>
                    <td colSpan={2} style={{ padding: "0.625rem 0.75rem" }} />
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#0F172A" }}>
                      100.0%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* ── "Use in Custom Builder" button ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => onUseInCustomBuilder(ctcGoldPct, nonCtcPct, avgRepossP50Months)}
          disabled={rows.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            background: "#002147", color: "#FFFFFF",
            border: "none", borderRadius: "9999px",
            padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500,
            cursor: rows.length === 0 ? "not-allowed" : "pointer",
            opacity: rows.length === 0 ? 0.5 : 1,
          }}
          title="Computed from your portfolio's lessee country mix, weighted by monthly rental."
        >
          Use in Custom Builder →
        </button>
      </div>

    </div>
  );
}
