// src/app/components/scenarios/AssetRiskTab.tsx
import { usePortfolioData } from "../../hooks/usePortfolioData";
import {
  computePortfolioAssetRisk,
  type VintageAgeTier,
  WB_REMARKETING_MONTHS,
} from "../../utils/assetRisk";
import { BASE_ECL } from "../../utils/eclCalculator";
import { DEFAULT_RECOVERY_FACTOR } from "../../data/lgdCurves";
import { Card } from "../ui/Card";
import { ScenarioKpiCard as KpiCard } from "../ui/KpiCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<VintageAgeTier, string> = {
  young: "Young (<10yr)",
  mid:   "Mid (10–15yr)",
  aged:  "Aged (>15yr)",
};

const TIER_PILL_BG: Record<VintageAgeTier, string> = {
  young: "#DCFCE7",
  mid:   "#FEF3C7",
  aged:  "#FEE2E2",
};

const TIER_PILL_COLOR: Record<VintageAgeTier, string> = {
  young: "#15803D",
  mid:   "#B45309",
  aged:  "#B91C1C",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierPill({ tier }: { tier: VintageAgeTier }) {
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
  onUseInCustomBuilder: (remarketingMonths: number, lgdDecayAdjFactor: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AssetRiskTab({ onUseInCustomBuilder }: Props) {
  const { assets, leases } = usePortfolioData();
  const {
    suggestedRemarketingMonths, lgdDecayAdjFactor,
    avgFleetAgeYears, pctMidAged, pctAged, rows,
  } = computePortfolioAssetRisk(assets, leases, DEFAULT_RECOVERY_FACTOR);

  const vintageUpliftM = rows.length > 0 ? lgdDecayAdjFactor * BASE_ECL : 0;

  // Color helpers
  const ageColor = avgFleetAgeYears > 12 ? "#B91C1C" : avgFleetAgeYears > 8 ? "#B45309" : "#15803D";
  const ageBg    = avgFleetAgeYears > 12 ? "#FEE2E2" : avgFleetAgeYears > 8 ? "#FEF3C7" : "#DCFCE7";
  const midColor = pctMidAged > 0.15 ? "#B91C1C" : pctMidAged > 0 ? "#B45309" : "#15803D";
  const midBg    = pctMidAged > 0.15 ? "#FEE2E2" : pctMidAged > 0 ? "#FEF3C7" : "#DCFCE7";
  const agedColor = pctAged > 0.10 ? "#B91C1C" : pctAged > 0 ? "#B45309" : "#15803D";
  const agedBg    = pctAged > 0.10 ? "#FEE2E2" : pctAged > 0 ? "#FEF3C7" : "#DCFCE7";
  const remColor = suggestedRemarketingMonths > WB_REMARKETING_MONTHS
    ? "#B91C1C"
    : suggestedRemarketingMonths > 4 ? "#B45309" : "#15803D";
  const remBg = suggestedRemarketingMonths > WB_REMARKETING_MONTHS
    ? "#FEE2E2"
    : suggestedRemarketingMonths > 4 ? "#FEF3C7" : "#DCFCE7";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Fleet Avg Age"
          value={rows.length > 0 ? `${avgFleetAgeYears.toFixed(1)} yr` : "—"}
          color={ageColor} bg={ageBg}
          note="rental-weighted"
        />
        <KpiCard
          label="Mid-Aged (10–15yr)"
          value={`${(pctMidAged * 100).toFixed(1)}%`}
          color={midColor} bg={midBg}
          note="+4% LGD adj"
        />
        <KpiCard
          label="Aged (>15yr)"
          value={`${(pctAged * 100).toFixed(1)}%`}
          color={agedColor} bg={agedBg}
          note="+10% LGD adj"
        />
        <KpiCard
          label="Vintage LGD Uplift"
          value={vintageUpliftM > 0 ? `+$${vintageUpliftM.toFixed(1)}M` : "$0"}
          color={vintageUpliftM > 0 ? "#B91C1C" : "#15803D"}
          bg={vintageUpliftM > 0 ? "#FEE2E2" : "#DCFCE7"}
          note="vs young-fleet baseline"
        />
        <KpiCard
          label="Suggested Remarketing"
          value={rows.length > 0 ? `${suggestedRemarketingMonths} mo` : "—"}
          color={remColor} bg={remBg}
          note="NB/WB rental-weighted"
        />
      </div>

      {/* ── Asset breakdown table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Asset Age &amp; Remarketing Breakdown
          </div>

          {rows.length === 0 ? (
            <div style={{ color: "#94A3B8", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
              No asset data available.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    {["Registration", "Type", "Vintage", "Age", "Tier", "Remarket", "Weight %"].map((h) => (
                      <th key={h} style={{
                        textAlign: h === "Registration" || h === "Type" ? "left" : "right",
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
                      key={row.registration}
                      style={{
                        borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none",
                        background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                      }}
                    >
                      <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>
                        {row.registration}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>
                        {row.aircraftType}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.vintage}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.ageYears} yr
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <TierPill tier={row.ageTier} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.isWidebody ? "9 mo (WB)" : "4 mo (NB)"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                        {(row.weightPct * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                    <td colSpan={3} style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#475569", fontSize: "0.75rem" }}>
                      PORTFOLIO WEIGHTED
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
                      {avgFleetAgeYears.toFixed(1)} yr
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                        {(pctMidAged * 100).toFixed(0)}% Mid · {(pctAged * 100).toFixed(0)}% Aged
                      </span>
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontSize: "0.75rem", color: "#64748B", fontVariantNumeric: "tabular-nums" }}>
                      {suggestedRemarketingMonths} mo
                    </td>
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
          onClick={() => onUseInCustomBuilder(suggestedRemarketingMonths, lgdDecayAdjFactor)}
          disabled={rows.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            background: "#002147", color: "#FFFFFF",
            border: "none", borderRadius: "9999px",
            padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500,
            cursor: rows.length === 0 ? "not-allowed" : "pointer",
            opacity: rows.length === 0 ? 0.5 : 1,
          }}
          title="Computed from your portfolio's aircraft type mix (NB/WB) and vintage year, weighted by monthly rental."
        >
          Use in Custom Builder →
        </button>
      </div>

    </div>
  );
}
