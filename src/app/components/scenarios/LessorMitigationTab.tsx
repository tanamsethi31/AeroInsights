// src/app/components/scenarios/LessorMitigationTab.tsx
import { usePortfolioData } from "../../hooks/usePortfolioData";
import {
  MITIGATION_TYPES,
  computePortfolioMitigationAnalysis,
} from "../../utils/lessorMitigation";
import { BASE_ECL } from "../../utils/eclCalculator";
import { Card } from "../ui/Card";

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, subvalue, color, bg,
}: {
  label: string; value: string; subvalue?: string; color: string; bg: string;
}) {
  return (
    <div style={{ background: bg, borderRadius: "0.5rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.375rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {subvalue && (
        <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{subvalue}</div>
      )}
    </div>
  );
}

function MitigationCard({
  type, candidateSharePct, hasData,
}: {
  type: "pbh" | "etp" | "lec";
  candidateSharePct: number;
  hasData: boolean;
}) {
  const info = MITIGATION_TYPES[type];
  // Recovery at full candidate adoption: candidateShare × eclFactor × BASE_ECL
  const recoveryM = candidateSharePct * info.eclFactor * BASE_ECL;

  return (
    <div style={{
      border:       "1px solid #E2E8F0",
      borderRadius: "0.5rem",
      padding:      "1rem",
      display:      "flex",
      flexDirection: "column",
      gap:          "0.625rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{
            fontSize:     "0.6875rem",
            fontWeight:   700,
            padding:      "0.125rem 0.5rem",
            borderRadius: "9999px",
            background:   "#EFF6FF",
            color:        "#1D4ED8",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}>
            {info.shortLabel}
          </span>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
            {info.label}
          </span>
        </div>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>
          −{(info.eclFactor * 100).toFixed(0)}% ECL factor
        </span>
      </div>
      <div style={{ fontSize: "0.8125rem", color: "#64748B", lineHeight: 1.5 }}>
        {info.description}
      </div>
      <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "0.625rem", display: "flex", gap: "1.5rem" }}>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Candidate fleet share
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
            {hasData ? `${(candidateSharePct * 100).toFixed(1)}%` : "—"}
          </div>
          <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{info.candidacyCriteria}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Max ECL recovery
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#15803D", fontVariantNumeric: "tabular-nums" }}>
            {hasData ? `$${recoveryM.toFixed(2)}M` : "—"}
          </div>
          <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>if all candidates adopted</div>
        </div>
      </div>
    </div>
  );
}

function CandidacyPill({ active }: { active: boolean }) {
  return (
    <span style={{
      display:      "inline-block",
      width:        "1.25rem",
      height:       "1.25rem",
      lineHeight:   "1.25rem",
      textAlign:    "center",
      borderRadius: "9999px",
      fontSize:     "0.6875rem",
      fontWeight:   700,
      background:   active ? "#DCFCE7" : "#F1F5F9",
      color:        active ? "#15803D" : "#CBD5E1",
    }}>
      {active ? "✓" : "–"}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onUseInCustomBuilder: (
    pbhConversionPct: number,
    etpRate:          number,
    lecRate:          number,
  ) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LessorMitigationTab({ onUseInCustomBuilder }: Props) {
  const { lessees, leases } = usePortfolioData();

  const {
    rows,
    totalRentalM,
    pbhCandidateRentalSharePct,
    etpCandidateRentalSharePct,
    lecCandidateRentalSharePct,
  } = computePortfolioMitigationAnalysis(lessees, leases);

  const hasData = rows.length > 0;

  // Combined recovery at full candidate adoption across all three types
  const combinedRecoveryM = hasData
    ? (pbhCandidateRentalSharePct * MITIGATION_TYPES.pbh.eclFactor +
       etpCandidateRentalSharePct  * MITIGATION_TYPES.etp.eclFactor +
       lecCandidateRentalSharePct  * MITIGATION_TYPES.lec.eclFactor) * BASE_ECL
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Fleet Under Analysis"
          value={hasData ? `$${totalRentalM.toFixed(1)}M/mo` : "—"}
          color="#475569"
          bg="#F8FAFC"
          subvalue={hasData ? `${rows.length} lessees` : undefined}
        />
        <KpiCard
          label="PBH Candidate Share"
          value={hasData ? `${(pbhCandidateRentalSharePct * 100).toFixed(1)}%` : "—"}
          color="#1D4ED8"
          bg="#EFF6FF"
          subvalue={hasData ? `Stage 2–3 or amber/red watchlist` : undefined}
        />
        <KpiCard
          label="Max Combined Recovery"
          value={hasData ? `$${combinedRecoveryM.toFixed(2)}M` : "—"}
          color="#15803D"
          bg="#DCFCE7"
          subvalue={hasData ? "if all candidates adopted" : undefined}
        />
      </div>

      {/* ── Mitigation type cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
        <MitigationCard type="pbh" candidateSharePct={pbhCandidateRentalSharePct} hasData={hasData} />
        <MitigationCard type="etp" candidateSharePct={etpCandidateRentalSharePct} hasData={hasData} />
        <MitigationCard type="lec" candidateSharePct={lecCandidateRentalSharePct} hasData={hasData} />
      </div>

      {/* ── Per-lessee table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Lessee Mitigation Targeting
          </div>

          {!hasData ? (
            <div style={{ color: "#94A3B8", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
              No lessee data available.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    {["Airline", "Stage", "Monthly Rent", "Lease End", "PBH", "ETP", "LEC"].map((h) => (
                      <th key={h} style={{
                        textAlign:     h === "Airline" ? "left" : "center",
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
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "center", color: "#475569" }}>
                        {row.stage}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "center", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        ${(row.monthlyRentalM * 1000).toFixed(0)}k
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "center", color: "#475569", fontVariantNumeric: "tabular-nums", fontSize: "0.75rem" }}>
                        {row.leaseEndDate
                          ? row.daysToEnd > 0
                            ? `${Math.round(row.daysToEnd / 30)}mo`
                            : "Expired"
                          : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "center" }}>
                        <CandidacyPill active={row.isPbhCandidate} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "center" }}>
                        <CandidacyPill active={row.isEtpCandidate} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "center" }}>
                        <CandidacyPill active={row.isLecCandidate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Use in Custom Builder CTA */}
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
              Sets PBH to candidate fleet share · ETP to 15% rate · LEC to 10% rate
            </div>
            <button
              onClick={() => onUseInCustomBuilder(
                pbhCandidateRentalSharePct,
                0.15,
                0.10,
              )}
              disabled={!hasData}
              style={{
                padding:      "0.5rem 1rem",
                fontSize:     "0.8125rem",
                fontWeight:   600,
                background:   !hasData ? "#F1F5F9" : "#002147",
                color:        !hasData ? "#94A3B8" : "#FFFFFF",
                border:       "none",
                borderRadius: "0.375rem",
                cursor:       !hasData ? "not-allowed" : "pointer",
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
