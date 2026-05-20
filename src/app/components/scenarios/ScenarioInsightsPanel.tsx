import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import type { ScenarioRunResult } from "./RunResultPanel";

// ── Pure functions (exported for testing) ─────────────────────────────────────

export function deriveProvisionData(ecl: number, baseECL: number): {
  gap: number;
  gapPct: number;
  fillPct: number;
  adequacy: "under" | "over" | "adequate";
} {
  if (baseECL === 0) return { gap: 0, gapPct: 0, fillPct: 100, adequacy: "adequate" as const };
  if (ecl <= 0) return { gap: -baseECL, gapPct: -100, fillPct: 100, adequacy: "over" as const };
  const gap = ecl - baseECL;
  const gapPct = (gap / baseECL) * 100;
  const fillPct = Math.min(100, (baseECL / ecl) * 100);
  const adequacy: "under" | "over" | "adequate" =
    gap > baseECL * 0.05  ? "under"
    : gap < -(baseECL * 0.05) ? "over"
    : "adequate";
  return { gap, gapPct, fillPct, adequacy };
}

export function deriveRemainingS3(run: ScenarioRunResult): number {
  const topSum = run.topLessees.reduce((s, l) => s + l.ecl, 0);
  return Math.max(0, run.s3 - topSum);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  run: ScenarioRunResult;
  baseECL: number;
  compact?: boolean;
}

// ── Shared style constants ────────────────────────────────────────────────────

const SECTION_HDR: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "#94A3B8",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "0.75rem",
  display: "block",
};

const DIVIDER: React.CSSProperties = {
  borderTop: "1px solid #E2E8F0",
  paddingTop: "1rem",
  marginTop: "1rem",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ScenarioInsightsPanel({ run, baseECL, compact = false }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);

  if (baseECL === 0) return null;

  const { gap, gapPct, fillPct, adequacy } = deriveProvisionData(run.ecl, baseECL);
  const remainingS3 = deriveRemainingS3(run);

  const ADEQUACY_META = {
    under:    { label: "Under-provisioned", color: "#B91C1C", bg: "rgba(185,28,28,0.04)", border: "rgba(185,28,28,0.15)" },
    over:     { label: "Over-provisioned",  color: "#15803D", bg: "rgba(21,128,61,0.04)",  border: "rgba(21,128,61,0.15)"  },
    adequate: { label: "Adequate",          color: "#B45309", bg: "rgba(180,83,9,0.04)",   border: "rgba(180,83,9,0.15)"   },
  } as const;

  const am = ADEQUACY_META[adequacy];

  return (
    <div
      style={
        compact
          ? { padding: "12px 0 0" }
          : {
              background: "#FAFAFA",
              border: "1px solid #E2E8F0",
              borderRadius: "0.5rem",
              padding: "1.25rem",
              marginTop: "0.75rem",
            }
      }
    >
      {/* ── Section 1: Provision Gap ──────────────────────────────────────── */}
      <span style={SECTION_HDR}>Provision Adequacy</span>

      {/* Three stat boxes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.625rem",
          marginBottom: "0.875rem",
        }}
      >
        {(
          [
            { label: "Current Provision", value: `$${baseECL.toFixed(1)}M`, sub: "Baseline ECL",   color: "#0F172A" },
            { label: "This Scenario",     value: `$${run.ecl.toFixed(1)}M`, sub: "Portfolio ECL",  color: "#0F172A" },
            {
              label: gap >= 0 ? "Gap" : "Surplus",
              value: `${gap >= 0 ? "+" : ""}$${Math.abs(gap).toFixed(1)}M`,
              sub:   am.label,
              color: am.color,
            },
          ] as { label: string; value: string; sub: string; color: string }[]
        ).map(({ label, value, sub, color }) => (
          <div
            key={label}
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "0.375rem",
              padding: "0.625rem 0.75rem",
            }}
          >
            <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginBottom: "0.25rem" }}>
              {label}
            </div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Fill bar */}
      <div style={{ marginBottom: "0.5rem" }}>
        <div
          style={{
            height: "6px",
            background: "#E2E8F0",
            borderRadius: "3px",
            overflow: "hidden",
            marginBottom: "0.375rem",
          }}
        >
          <div
            style={{
              width: `${fillPct}%`,
              height: "100%",
              background: "#002147",
              borderRadius: "3px",
            }}
          />
        </div>
        <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
          ${baseECL.toFixed(1)}M of ${run.ecl.toFixed(1)}M covered ({fillPct.toFixed(1)}%)
        </div>
      </div>

      {/* IFRS 9 line — only when under-provisioned */}
      {adequacy === "under" && (
        <div
          style={{
            background: am.bg,
            border: `1px solid ${am.border}`,
            borderRadius: "0.375rem",
            padding: "0.625rem 0.75rem",
            fontSize: "0.8125rem",
            color: "#334155",
            lineHeight: 1.5,
            marginTop: "0.625rem",
          }}
        >
          Under IFRS 9 §63, a significant increase in credit risk requires lifetime ECL
          recognition. Consider a provision top-up of{" "}
          <strong>${gap.toFixed(1)}M</strong> before next reporting period.
        </div>
      )}

      {/* ── Section 2: Stage 3 Exposures ──────────────────────────────────── */}
      <div style={DIVIDER}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.75rem",
          }}
        >
          <span style={{ ...SECTION_HDR, marginBottom: 0 }}>Stage 3 Exposures</span>
          <span
            title="Stage 3 assets are credit-impaired. Full lifetime ECL is recognised and individual lessee assessment is required under IFRS 9."
            style={{ display: "flex", alignItems: "center" }}
          >
            <Info size={11} color="#94A3B8" />
          </span>
          {run.s3LeaseCount > 0 && (
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                background: "rgba(185,28,28,0.08)",
                color: "#B91C1C",
                border: "1px solid rgba(185,28,28,0.2)",
                borderRadius: "9999px",
                padding: "0.1rem 0.5rem",
              }}
            >
              {run.s3LeaseCount} lessee{run.s3LeaseCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {run.s3 === 0 || run.topLessees.length === 0 ? (
          <div style={{ fontSize: "0.8125rem", color: "#94A3B8", fontStyle: "italic" }}>
            No Stage 3 exposures in this scenario — portfolio performing within expected
            parameters.
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {(["Lessee", "Jurisdiction", "ECL", "% of S3", "Action"] as const).map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === "Action" ? "center" : "left",
                          padding: "0.375rem 0.5rem",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          color: "#94A3B8",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {run.topLessees.map((l) => (
                  <tr key={l.name} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 500, color: "#0F172A" }}>
                      {l.name}
                    </td>
                    <td style={{ padding: "0.5rem", color: "#475569" }}>{l.jurisdiction}</td>
                    <td
                      style={{
                        padding: "0.5rem",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                        color: "#B91C1C",
                      }}
                    >
                      ${l.ecl.toFixed(1)}M
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        color: "#475569",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {run.s3 > 0 ? ((l.ecl / run.s3) * 100).toFixed(0) : "0"}%
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          background: "rgba(180,83,9,0.08)",
                          color: "#B45309",
                          border: "1px solid rgba(180,83,9,0.2)",
                          borderRadius: "0.25rem",
                          padding: "0.125rem 0.5rem",
                        }}
                      >
                        Review
                      </span>
                    </td>
                  </tr>
                ))}

                {remainingS3 > 0 && (
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td
                      colSpan={2}
                      style={{ padding: "0.5rem", color: "#94A3B8", fontStyle: "italic" }}
                    >
                      Remaining S3
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        fontVariantNumeric: "tabular-nums",
                        color: "#94A3B8",
                      }}
                    >
                      ${remainingS3.toFixed(1)}M
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        color: "#94A3B8",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {run.s3 > 0 ? ((remainingS3 / run.s3) * 100).toFixed(0) : "0"}%
                    </td>
                    <td />
                  </tr>
                )}

                <tr style={{ borderTop: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                  <td
                    colSpan={2}
                    style={{ padding: "0.5rem", fontWeight: 600, color: "#0F172A" }}
                  >
                    Total Stage 3
                  </td>
                  <td
                    style={{
                      padding: "0.5rem",
                      fontWeight: 700,
                      color: "#B91C1C",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${run.s3.toFixed(1)}M
                  </td>
                  <td style={{ padding: "0.5rem", fontWeight: 600, color: "#0F172A" }}>
                    100%
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>

            {/* Stage footnotes */}
            <div
              style={{ marginTop: "0.625rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}
            >
              {run.s1 > 0 && (
                <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                  <span style={{ fontWeight: 600, color: "#15803D" }}>Stage 1</span>{" "}
                  ${run.s1.toFixed(1)}M · Performing — 12-month ECL
                </div>
              )}
              {run.s2 > 0 && (
                <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                  <span style={{ fontWeight: 600, color: "#B45309" }}>Stage 2</span>{" "}
                  ${run.s2.toFixed(1)}M · Credit deteriorated — lifetime ECL
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Section 3: Recommended Actions ────────────────────────────────── */}
      <div style={DIVIDER}>
        <span style={SECTION_HDR}>Recommended Actions</span>

        <div
          style={{
            margin: "0 0 0.875rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {gap > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.8125rem", color: "#002147", fontWeight: 700, flexShrink: 0 }}>①</span>
              <span style={{ fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.5 }}>
                Top up provisions by <strong>${gap.toFixed(1)}M</strong> before next reporting period
              </span>
            </div>
          )}
          {run.s3LeaseCount > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.8125rem", color: "#002147", fontWeight: 700, flexShrink: 0 }}>②</span>
              <span style={{ fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.5 }}>
                Conduct individual assessment on{" "}
                <strong>
                  {run.s3LeaseCount} Stage 3 lessee
                  {run.s3LeaseCount !== 1 ? "s" : ""}
                </strong>
              </span>
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <span style={{ fontSize: "0.8125rem", color: "#002147", fontWeight: 700, flexShrink: 0 }}>③</span>
            <span style={{ fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.5 }}>
              Present scenario delta (
              <strong>
                {gapPct >= 0 ? "+" : ""}
                {gapPct.toFixed(1)}%
              </strong>{" "}
              vs baseline) to credit committee with Shapley attribution
            </span>
          </div>
        </div>

        {/* Collapsible detail */}
        <button
          onClick={() => setDetailOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.375rem",
            background: "transparent",
            border: "1px solid #E2E8F0",
            borderRadius: "0.375rem",
            padding: "0.375rem 0.75rem",
            fontSize: "0.75rem",
            color: "#64748B",
            cursor: "pointer",
            width: "100%",
          }}
        >
          <span>Detail for audit / board pack</span>
          {detailOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {detailOpen && (
          <div
            style={{
              marginTop: "0.625rem",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "0.375rem",
              padding: "0.875rem",
            }}
          >
            {(
              [
                { label: "Current provision (baseline ECL)", value: `$${baseECL.toFixed(1)}M` },
                {
                  label: `This scenario ECL${run.mode === "montecarlo" ? " (P50)" : ""}`,
                  value: `$${run.ecl.toFixed(1)}M`,
                },
                ...(gap > 0
                  ? [{ label: "Required top-up", value: `$${gap.toFixed(1)}M` }]
                  : []),
                { label: "Stage 3 lease count", value: String(run.s3LeaseCount) },
                ...(run.shapley.length > 0
                  ? [
                      {
                        label: "Primary driver",
                        value: `${run.shapley[0].driver} +${run.shapley[0].contribution.toFixed(0)}pp`,
                      },
                    ]
                  : []),
                { label: "IFRS 9 reference", value: "§63, §B5.5.15–17" },
                { label: "Run ID",        value: run.id },
                { label: "Scenario hash", value: run.scenarioHash },
              ] as { label: string; value: string }[]
            ).map(({ label, value }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "0.375rem 0",
                  borderBottom: "1px solid #F1F5F9",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "#64748B" }}>{label}</span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    fontFamily:
                      label.includes("ID") || label.includes("hash")
                        ? "monospace"
                        : "inherit",
                    textAlign: "right",
                    maxWidth: "60%",
                    wordBreak: "break-all",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
