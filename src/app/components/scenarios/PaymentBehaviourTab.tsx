// src/app/components/scenarios/PaymentBehaviourTab.tsx
import { usePortfolioData } from "../../hooks/usePortfolioData";
import { computePortfolioPaymentBehaviourMix, type PayBehaviourTier } from "../../utils/paymentBehaviour";
import { BASE_ECL } from "../../utils/eclCalculator";
import { Card } from "../ui/Card";
import { ScenarioKpiCard as KpiCard } from "../ui/KpiCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<PayBehaviourTier, string> = {
  cooperative: "Cooperative",
  neutral:     "Neutral",
  adversarial: "Adversarial",
};

const TIER_PILL_BG: Record<PayBehaviourTier, string> = {
  cooperative: "#DCFCE7",
  neutral:     "#F1F5F9",
  adversarial: "#FEE2E2",
};

const TIER_PILL_COLOR: Record<PayBehaviourTier, string> = {
  cooperative: "#15803D",
  neutral:     "#475569",
  adversarial: "#B91C1C",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierPill({ tier }: { tier: PayBehaviourTier }) {
  return (
    <span style={{
      background:  TIER_PILL_BG[tier],
      color:       TIER_PILL_COLOR[tier],
      fontWeight:  600,
      fontSize:    "0.75rem",
      padding:     "0.15rem 0.5rem",
      borderRadius: "9999px",
      whiteSpace:  "nowrap",
    }}>
      {TIER_LABEL[tier]}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onUseInCustomBuilder: (coopPct: number, advPct: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PaymentBehaviourTab({ onUseInCustomBuilder }: Props) {
  const { lessees, leases } = usePortfolioData();
  const { coopPct, advPct, rows } = computePortfolioPaymentBehaviourMix(lessees, leases);

  // Net ECL impact: (advPct × 0.12 − coopPct × 0.07) × BASE_ECL
  const netImpactM = rows.length === 0
    ? 0
    : (advPct * 0.12 - coopPct * 0.07) * BASE_ECL;

  // Adversarial KPI colour logic: red >30%, amber >15%, green otherwise
  const advColor = advPct > 0.30 ? "#B91C1C" : advPct > 0.15 ? "#B45309" : "#15803D";
  const advBg    = advPct > 0.30 ? "#FEE2E2" : advPct > 0.15 ? "#FEF3C7" : "#DCFCE7";

  // Net impact card colour
  const impactColor = netImpactM < -0.01 ? "#15803D" : netImpactM > 0.01 ? "#B91C1C" : "#64748B";
  const impactBg    = netImpactM < -0.01 ? "#DCFCE7" : netImpactM > 0.01 ? "#FEE2E2" : "#F8FAFC";
  const impactValue = rows.length === 0
    ? "—"
    : netImpactM >= 0
      ? `+$${netImpactM.toFixed(2)}M`
      : `−$${Math.abs(netImpactM).toFixed(2)}M`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Cooperative"
          value={rows.length === 0 ? "—" : `${(coopPct * 100).toFixed(1)}%`}
          color="#15803D"
          bg="#DCFCE7"
        />
        <KpiCard
          label="Adversarial"
          value={rows.length === 0 ? "—" : `${(advPct * 100).toFixed(1)}%`}
          color={advColor}
          bg={advBg}
        />
        <KpiCard
          label="Net ECL Impact"
          value={impactValue}
          color={impactColor}
          bg={impactBg}
        />
      </div>

      {/* ── Lessee breakdown table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Lessee Payment Behaviour
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
                    {["Airline", "Country", "Score", "Behaviour Tier", "Monthly Rent", "Weight %"].map((h) => (
                      <th key={h} style={{
                        textAlign:      h === "Airline" ? "left" : "right",
                        padding:        "0.5rem 0.75rem",
                        fontWeight:     600,
                        color:          "#64748B",
                        fontSize:       "0.75rem",
                        textTransform:  "uppercase",
                        letterSpacing:  "0.04em",
                        whiteSpace:     "nowrap",
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
                        {row.country}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.score}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <TierPill tier={row.tier} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        ${(row.monthlyRentalM * 1000).toFixed(0)}k
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {(row.rentalSharePct * 100).toFixed(1)}%
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
              onClick={() => onUseInCustomBuilder(coopPct, advPct)}
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
