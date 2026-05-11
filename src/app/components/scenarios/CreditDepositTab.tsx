// src/app/components/scenarios/CreditDepositTab.tsx
import { usePortfolioData } from "../../hooks/usePortfolioData";
import { computePortfolioDepositCoverage, type CreditDepositTier } from "../../utils/creditDeposit";
import { BASE_ECL } from "../../utils/eclCalculator";
import { Card } from "../ui/Card";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPOSIT_TIER_LABEL: Record<CreditDepositTier, string> = {
  investmentGrade:    "Investment Grade",
  subInvestmentGrade: "Sub-Investment Grade",
  distressed:         "Distressed",
};

const DEPOSIT_TIER_PILL_BG: Record<CreditDepositTier, string> = {
  investmentGrade:    "#DCFCE7",
  subInvestmentGrade: "#FEF3C7",
  distressed:         "#FEE2E2",
};

const DEPOSIT_TIER_PILL_COLOR: Record<CreditDepositTier, string> = {
  investmentGrade:    "#15803D",
  subInvestmentGrade: "#B45309",
  distressed:         "#B91C1C",
};

const WATCHLIST_DOT: Record<"green" | "amber" | "red", string> = {
  green: "#22C55E",
  amber: "#F59E0B",
  red:   "#EF4444",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: "0.5rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.375rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

function TierPill({ tier }: { tier: CreditDepositTier }) {
  return (
    <span style={{
      background: DEPOSIT_TIER_PILL_BG[tier],
      color: DEPOSIT_TIER_PILL_COLOR[tier],
      fontWeight: 600, fontSize: "0.75rem",
      padding: "0.15rem 0.5rem", borderRadius: "9999px",
      whiteSpace: "nowrap",
    }}>
      {DEPOSIT_TIER_LABEL[tier]}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Called when user clicks "Use in Custom Builder" — switches tab and pre-fills slider. */
  onUseInCustomBuilder: (depositCoverage: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CreditDepositTab({ onUseInCustomBuilder }: Props) {
  const { lessees, leases } = usePortfolioData();
  const { totalDepositM, rows } = computePortfolioDepositCoverage(lessees, leases);

  // depositCoverage = total deposits / ECL baseline (not fleet EAD)
  const depositCoverage = BASE_ECL > 0 ? totalDepositM / BASE_ECL : 0;

  // KPI breakdown by rental share
  const igRentalPct = rows
    .filter((r) => r.tier === "investmentGrade")
    .reduce((s, r) => s + r.rentalSharePct, 0);
  const distressedRentalPct = rows
    .filter((r) => r.tier === "distressed")
    .reduce((s, r) => s + r.rentalSharePct, 0);

  // Color logic
  const distressedColor = distressedRentalPct > 0.30 ? "#B91C1C" : distressedRentalPct > 0.15 ? "#B45309" : "#15803D";
  const distressedBg    = distressedRentalPct > 0.30 ? "#FEE2E2" : distressedRentalPct > 0.15 ? "#FEF3C7" : "#DCFCE7";
  const coverageColor   = depositCoverage > 0.05 ? "#B91C1C" : depositCoverage > 0.02 ? "#B45309" : "#15803D";
  const coverageBg      = depositCoverage > 0.05 ? "#FEE2E2" : depositCoverage > 0.02 ? "#FEF3C7" : "#DCFCE7";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Investment Grade"
          value={`${(igRentalPct * 100).toFixed(1)}%`}
          color="#15803D"
          bg="#DCFCE7"
        />
        <KpiCard
          label="Distressed"
          value={`${(distressedRentalPct * 100).toFixed(1)}%`}
          color={distressedColor}
          bg={distressedBg}
        />
        <KpiCard
          label="Deposit Coverage"
          value={rows.length === 0 ? "0.0%" : `${(depositCoverage * 100).toFixed(1)}% of ECL`}
          color={coverageColor}
          bg={coverageBg}
        />
      </div>

      {/* ── Lessee breakdown table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Lessee Deposit Sizing
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
                    {["Airline", "Watchlist", "Credit Tier", "Deposit Months", "Monthly Rent", "Rec. Deposit"].map((h) => (
                      <th key={h} style={{
                        textAlign: h === "Airline" ? "left" : "right",
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
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        {row.watchlistStatus ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "0.375rem",
                            fontSize: "0.75rem", fontWeight: 600,
                            color: WATCHLIST_DOT[row.watchlistStatus],
                          }}>
                            <span style={{
                              width: "0.5rem", height: "0.5rem", borderRadius: "9999px",
                              background: WATCHLIST_DOT[row.watchlistStatus],
                              display: "inline-block",
                            }} />
                            {row.watchlistStatus.charAt(0).toUpperCase() + row.watchlistStatus.slice(1)}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <TierPill tier={row.tier} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.depositMonths === 0 ? <span style={{ color: "#94A3B8" }}>Waived</span> : `${row.depositMonths} mo`}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        ${(row.monthlyRentalM * 1000).toFixed(0)}k
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: row.recommendedDepositM > 0 ? "#0F172A" : "#94A3B8", fontVariantNumeric: "tabular-nums" }}>
                        {row.recommendedDepositM > 0 ? `$${row.recommendedDepositM.toFixed(2)}M` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                    <td colSpan={5} style={{ padding: "0.625rem 0.75rem", fontWeight: 600, color: "#475569", fontSize: "0.75rem" }}>
                      Total recommended deposits
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                      ${totalDepositM.toFixed(2)}M
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Use in Custom Builder CTA */}
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => onUseInCustomBuilder(depositCoverage)}
              disabled={rows.length === 0}
              style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                background: rows.length === 0 ? "#F1F5F9" : "#002147",
                color: rows.length === 0 ? "#94A3B8" : "#FFFFFF",
                border: "none", borderRadius: "9999px",
                padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500,
                cursor: rows.length === 0 ? "not-allowed" : "pointer",
                opacity: rows.length === 0 ? 0.5 : 1,
              }}
              title="Computed from your portfolio's lessee credit tiers, weighted by monthly rental."
            >
              Use in Custom Builder →
            </button>
          </div>
        </div>
      </Card>

    </div>
  );
}
