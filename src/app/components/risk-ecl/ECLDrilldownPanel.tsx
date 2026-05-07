import { type ReactNode } from "react";
import { X, TrendingUp, DollarSign, BookOpen, AlertTriangle } from "lucide-react";
import { StatusPill } from "../ui/StatusPill";
import { useCurrency } from "../../contexts/CurrencyContext";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface PDTermPoint {
  year: string;
  pd: number;
}

export interface ScenarioECL {
  base: { ecl12m: number; eclLifetime: number };
  adverse: { ecl12m: number; eclLifetime: number };
  upside: { ecl12m: number; eclLifetime: number };
}

export interface LeaseRow {
  id: string;
  lessee: string;
  aircraft: string;
  eadNum: number;
  pd12m: number;
  pdLifetime: number;
  lgd: number;
  ecl12m: number;
  eclLifetime: number;
  stage: "1" | "2" | "3";
  sicrTrigger: string | null;
  pdTerm: PDTermPoint[];
  scenarioECL: ScenarioECL;
  journalMovement: number; // positive = ECL expense increase
}

interface Props {
  lease: LeaseRow | null;
  weights: { base: number; adverse: number; upside: number };
  onClose: () => void;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const pct = (n: number) => `${n.toFixed(1)}%`;
const stageColor = (s: "1" | "2" | "3") =>
  s === "3" ? "#B91C1C" : s === "2" ? "#B45309" : "#15803D";

// ─── Component ────────────────────────────────────────────────────────────────

export function ECLDrilldownPanel({ lease, weights, onClose }: Props) {
  const { fmt } = useCurrency();

  if (!lease) return null;

  const maxPD = Math.max(...lease.pdTerm.map((p) => p.pd), 0.1);

  // Probability-weighted ECL
  const wEcl12m =
    (lease.scenarioECL.base.ecl12m * weights.base +
      lease.scenarioECL.adverse.ecl12m * weights.adverse +
      lease.scenarioECL.upside.ecl12m * weights.upside) /
    100;
  const wEclLt =
    (lease.scenarioECL.base.eclLifetime * weights.base +
      lease.scenarioECL.adverse.eclLifetime * weights.adverse +
      lease.scenarioECL.upside.eclLifetime * weights.upside) /
    100;

  const isIncrease = lease.journalMovement > 0;
  const absMovement = Math.abs(lease.journalMovement);

  const scenarios = [
    { label: "Baseline", key: "base" as const, color: "#002147" },
    { label: "Adverse", key: "adverse" as const, color: "#B45309" },
    { label: "Upside", key: "upside" as const, color: "#15803D" },
  ];

  const sectionLabel = (icon: ReactNode, text: string, aside?: ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.75rem" }}>
      {icon}
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#0F172A",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {text}
      </span>
      {aside && <span style={{ marginLeft: "auto" }}>{aside}</span>}
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.18)",
          zIndex: 59,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "500px",
          background: "#FFFFFF",
          boxShadow: "-4px 0 32px rgba(0,0,0,0.10)",
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid #E2E8F0",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.3rem",
              }}
            >
              <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#94A3B8" }}>
                {lease.id}
              </span>
              <StatusPill stage={lease.stage} label={`Stage ${lease.stage}`} />
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>
              {lease.lessee}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#475569", marginTop: "0.1rem" }}>
              {lease.aircraft} &nbsp;·&nbsp; EAD {fmt(lease.eadNum * 1_000_000, { compact: true })} &nbsp;·&nbsp; LGD{" "}
              {lease.lgd.toFixed(0)}%
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem",
              color: "#94A3B8",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          {/* SICR Trigger Banner */}
          {lease.sicrTrigger ? (
            <div
              style={{
                padding: "0.75rem 1rem",
                background:
                  lease.stage === "3" ? "rgba(185,28,28,0.06)" : "rgba(180,83,9,0.06)",
                borderRadius: "0.5rem",
                borderLeft: `3px solid ${stageColor(lease.stage)}`,
              }}
            >
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: stageColor(lease.stage),
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <AlertTriangle size={11} /> SICR Trigger — Stage {lease.stage} Classification
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.55 }}>
                {lease.sicrTrigger}
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "0.625rem 0.875rem",
                background: "rgba(21,128,61,0.06)",
                borderRadius: "0.5rem",
                borderLeft: "3px solid #15803D",
                fontSize: "0.8125rem",
                color: "#15803D",
              }}
            >
              No SICR triggers active — Stage 1 (12-month ECL)
            </div>
          )}

          {/* PD Term Structure */}
          <div>
            {sectionLabel(<TrendingUp size={14} color="#002147" />, "PD Term Structure")}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0.625rem",
                marginBottom: "0.625rem",
              }}
            >
              {lease.pdTerm.map((pt) => (
                <div key={pt.year} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      height: "64px",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      marginBottom: "0.375rem",
                    }}
                  >
                    <div
                      style={{
                        width: "30px",
                        background: "#002147",
                        borderRadius: "3px 3px 0 0",
                        height: `${Math.max((pt.pd / maxPD) * 60, 4)}px`,
                        opacity: pt.year === "LT" ? 1 : 0.55 + (lease.pdTerm.indexOf(pt) / lease.pdTerm.length) * 0.45,
                        transition: "height 0.3s ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#0F172A",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {pct(pt.pd)}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>
                    {pt.year}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "#94A3B8",
                display: "flex",
                gap: "1.5rem",
              }}
            >
              <span>
                ECL = PD × LGD × EAD
              </span>
              <span>
                12m ECL ≈ {pct(lease.pd12m)} × {pct(lease.lgd)} × {fmt(lease.eadNum * 1_000_000, { compact: true })}
              </span>
            </div>
          </div>

          {/* Probability-Weighted ECL */}
          <div>
            {sectionLabel(
              <DollarSign size={14} color="#002147" />,
              "Probability-Weighted ECL",
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "#94A3B8",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                Weights: {weights.base}/{weights.adverse}/{weights.upside}
              </span>
            )}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.8125rem",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["Scenario", "Weight", "ECL 12m", "ECL Lifetime"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.4rem 0.375rem",
                        textAlign: h === "Scenario" ? "left" : "right",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        color: "#94A3B8",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={s.key} style={{ borderBottom: "1px solid #F4F5F7" }}>
                    <td style={{ padding: "0.5rem 0.375rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: s.color,
                          flexShrink: 0,
                        }}
                      />
                      {s.label}
                    </td>
                    <td style={{ padding: "0.5rem 0.375rem", textAlign: "right", color: "#475569" }}>
                      {weights[s.key]}%
                    </td>
                    <td style={{ padding: "0.5rem 0.375rem", textAlign: "right", color: "#0F172A" }}>
                      {fmt(lease.scenarioECL[s.key].ecl12m * 1_000_000, { compact: true })}
                    </td>
                    <td style={{ padding: "0.5rem 0.375rem", textAlign: "right", color: "#0F172A" }}>
                      {fmt(lease.scenarioECL[s.key].eclLifetime * 1_000_000, { compact: true })}
                    </td>
                  </tr>
                ))}
                <tr
                  style={{
                    borderTop: "2px solid #E2E8F0",
                    background: "#F4F5F7",
                  }}
                >
                  <td
                    style={{
                      padding: "0.625rem 0.5rem",
                      fontWeight: 600,
                      color: "#0F172A",
                    }}
                  >
                    Weighted ECL
                  </td>
                  <td
                    style={{
                      padding: "0.625rem 0.5rem",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#0F172A",
                    }}
                  >
                    100%
                  </td>
                  <td
                    style={{
                      padding: "0.625rem 0.5rem",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#002147",
                    }}
                  >
                    {fmt(wEcl12m * 1_000_000, { compact: true })}
                  </td>
                  <td
                    style={{
                      padding: "0.625rem 0.5rem",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#002147",
                    }}
                  >
                    {fmt(wEclLt * 1_000_000, { compact: true })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Journal Entry Stub */}
          <div>
            {sectionLabel(
              <BookOpen size={14} color="#002147" />,
              "Journal Entry Stub",
              <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>Q1 2026 movement</span>
            )}
            <div
              style={{
                background: "#F4F5F7",
                borderRadius: "0.5rem",
                padding: "1rem 1.125rem",
                fontFamily: "monospace",
                fontSize: "0.8125rem",
                lineHeight: 1.7,
              }}
            >
              {isIncrease ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#0F172A",
                    }}
                  >
                    <span>Dr&nbsp;&nbsp;ECL Expense</span>
                    <span
                      style={{ color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}
                    >
                      {fmt(absMovement * 1_000_000, { compact: true })}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#475569",
                    }}
                  >
                    <span>&nbsp;&nbsp;&nbsp;&nbsp;Cr&nbsp;&nbsp;ECL Allowance</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {fmt(absMovement * 1_000_000, { compact: true })}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#0F172A",
                    }}
                  >
                    <span>Dr&nbsp;&nbsp;ECL Allowance</span>
                    <span
                      style={{ color: "#15803D", fontVariantNumeric: "tabular-nums" }}
                    >
                      {fmt(absMovement * 1_000_000, { compact: true })}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#475569",
                    }}
                  >
                    <span>&nbsp;&nbsp;&nbsp;&nbsp;Cr&nbsp;&nbsp;ECL Recovery / Write-back</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {fmt(absMovement * 1_000_000, { compact: true })}
                    </span>
                  </div>
                </>
              )}
              <div
                style={{
                  borderTop: "1px solid #E2E8F0",
                  marginTop: "0.625rem",
                  paddingTop: "0.5rem",
                  fontSize: "0.6875rem",
                  color: "#94A3B8",
                  lineHeight: 1.5,
                }}
              >
                Ref: IFRS 9 §5.5.1 — ECL allowance movement, period Q4 2025 → Q1 2026
                <br />
                Scenario weighting applied: {weights.base}% Baseline / {weights.adverse}% Adverse / {weights.upside}% Upside
              </div>
            </div>
          </div>

          {/* Calculation Basis */}
          <div
            style={{
              padding: "0.875rem 1rem",
              background: "rgba(0,33,71,0.04)",
              borderRadius: "0.5rem",
              borderLeft: "3px solid #002147",
            }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "#002147",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.375rem",
              }}
            >
              Calculation Basis — IFRS 9 §5.5
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.65 }}>
              ECL = Σ (PD<sub>t</sub> × LGD<sub>t</sub> × EAD<sub>t</sub> × DF<sub>t</sub>)<br />
              PD 12m: <strong style={{ color: "#0F172A" }}>{pct(lease.pd12m)}</strong>
              &nbsp;·&nbsp;PD Lifetime:{" "}
              <strong style={{ color: "#0F172A" }}>{pct(lease.pdLifetime)}</strong>
              &nbsp;·&nbsp;LGD:{" "}
              <strong style={{ color: "#0F172A" }}>{pct(lease.lgd)}</strong>
              &nbsp;·&nbsp;EAD:{" "}
              <strong style={{ color: "#0F172A" }}>{fmt(lease.eadNum * 1_000_000, { compact: true })}</strong>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "0.875rem 1.5rem",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1.25rem",
              background: "#002147",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "9999px",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}