// src/app/components/risk-ecl/JurisdictionRiskSummaryCard.tsx
import { useNavigate } from "react-router";
import { Card } from "../ui/Card";

interface Props {
  ctcGoldPct:         number;  // 0–1, rental-weighted fleet share in CTC Gold
  nonCtcPct:          number;  // 0–1, rental-weighted fleet share in Non-CTC
  avgRepossP50Months: number;  // rental-weighted P50 repossession months
  liveBaseECL:        number;  // $M — used to compute ECL uplift display
}

export function JurisdictionRiskSummaryCard({
  ctcGoldPct,
  nonCtcPct,
  avgRepossP50Months,
  liveBaseECL,
}: Props) {
  const navigate = useNavigate();

  const ctcModeratePct = Math.max(0, 1 - ctcGoldPct - nonCtcPct);
  const noData = avgRepossP50Months === 0 && ctcGoldPct === 0 && nonCtcPct === 0;

  // Extra months above the 3-month US §1110 benchmark
  const extraMonths = Math.max(0, avgRepossP50Months - 3);

  // ECL uplift: each month above benchmark adds 2.5% of baseECL
  const upliftM = extraMonths * 0.025 * liveBaseECL;

  // Colour for the extra-months badge
  const badgeStyle: React.CSSProperties =
    extraMonths === 0
      ? { background: "#DCFCE7", color: "#15803D" }
      : extraMonths <= 3
      ? { background: "#FEF3C7", color: "#B45309" }
      : { background: "#FEE2E2", color: "#B91C1C" };

  return (
    <Card>
      <div style={{ padding: "1.25rem" }}>

        {/* ── Header row ─────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: "1rem",
        }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
            Fleet Jurisdiction · Repossession Risk
          </span>
          <span style={{
            background: "#EFF6FF", color: "#1D4ED8",
            fontSize: "0.75rem", fontWeight: 600,
            padding: "0.2rem 0.6rem", borderRadius: "9999px",
          }}>
            Applied to scenario ✓
          </span>
        </div>

        {/* ── CTC tier chips ─────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span style={{
            background: "#DCFCE7", color: "#15803D",
            fontSize: "0.8125rem", fontWeight: 600,
            padding: "0.25rem 0.75rem", borderRadius: "9999px",
          }}>
            🟢 Gold: {noData ? "—" : `${(ctcGoldPct * 100).toFixed(1)}%`}
          </span>
          <span style={{
            background: "#FEF3C7", color: "#B45309",
            fontSize: "0.8125rem", fontWeight: 600,
            padding: "0.25rem 0.75rem", borderRadius: "9999px",
          }}>
            🟡 Moderate: {noData ? "—" : `${(ctcModeratePct * 100).toFixed(1)}%`}
          </span>
          <span style={{
            background: "#FEE2E2", color: "#B91C1C",
            fontSize: "0.8125rem", fontWeight: 600,
            padding: "0.25rem 0.75rem", borderRadius: "9999px",
          }}>
            🔴 Non-CTC: {noData ? "—" : `${(nonCtcPct * 100).toFixed(1)}%`}
          </span>
        </div>

        {/* ── Repossession row ───────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "0.875rem",
        }}>
          <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>
            Weighted avg P50
          </span>
          {noData ? (
            <span style={{ fontSize: "0.8125rem", color: "#94A3B8" }}>—</span>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0F172A" }}>
                {avgRepossP50Months.toFixed(1)} mo
              </span>
              <span style={{
                ...badgeStyle,
                fontSize: "0.75rem", fontWeight: 600,
                padding: "0.2rem 0.55rem", borderRadius: "9999px",
              }}>
                {extraMonths === 0
                  ? "+0 mo above benchmark"
                  : `+${extraMonths.toFixed(1)} mo above benchmark`}
              </span>
            </div>
          )}
        </div>

        {/* ── ECL uplift chip ────────────────────────────────────────── */}
        <div style={{ marginBottom: "1rem" }}>
          <span style={{
            background: upliftM > 0 ? "#FEE2E2" : "#DCFCE7",
            color:      upliftM > 0 ? "#B91C1C" : "#15803D",
            fontSize: "0.8125rem", fontWeight: 600,
            padding: "0.3rem 0.75rem", borderRadius: "9999px",
          }}>
            {upliftM > 0
              ? `↑ $${upliftM.toFixed(1)}M repossession uplift`
              : "No uplift vs. benchmark"}
          </span>
        </div>

        {/* ── No-data note ───────────────────────────────────────────── */}
        {noData && (
          <p style={{ fontSize: "0.8125rem", color: "#94A3B8", marginBottom: "0.875rem" }}>
            No jurisdiction data in portfolio.
          </p>
        )}

        {/* ── Footer link ────────────────────────────────────────────── */}
        <button
          onClick={() => navigate("/jurisdictions")}
          aria-label="View full jurisdiction analysis"
          style={{
            background: "none", border: "none", padding: 0,
            fontSize: "0.8125rem", color: "#1D4ED8",
            cursor: "pointer", textDecoration: "underline",
          }}
        >
          View full jurisdiction analysis →
        </button>

      </div>
    </Card>
  );
}
