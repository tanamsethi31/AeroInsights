// src/app/components/scenarios/RatingPDTab.tsx
import React, { useState } from "react";
import { usePortfolioData } from "../../hooks/usePortfolioData";
import {
  computePortfolioRatingPD,
  type PDThresholds,
  type RatingPDRow,
  IATA_THRESHOLDS,
  TIGHT_THRESHOLDS,
} from "../../utils/ratingPD";
import { Card } from "../ui/Card";

// ─── Stage pill styling ────────────────────────────────────────────────────────

const STAGE_BG: Record<1 | 2 | 3, string>    = { 1: "#DCFCE7", 2: "#FEF3C7", 3: "#FEE2E2" };
const STAGE_COLOR: Record<1 | 2 | 3, string> = { 1: "#15803D", 2: "#B45309", 3: "#B91C1C" };
const STAGE_LABEL: Record<1 | 2 | 3, string> = { 1: "S1",       2: "S2",       3: "S3" };

function StagePill({ stage }: { stage: 1 | 2 | 3 | null }) {
  if (stage === null) {
    return (
      <span style={{
        background: "#F1F5F9", color: "#94A3B8",
        fontWeight: 600, fontSize: "0.75rem",
        padding: "0.15rem 0.5rem", borderRadius: "9999px",
      }}>—</span>
    );
  }
  return (
    <span style={{
      background: STAGE_BG[stage], color: STAGE_COLOR[stage],
      fontWeight: 600, fontSize: "0.75rem",
      padding: "0.15rem 0.5rem", borderRadius: "9999px",
      whiteSpace: "nowrap",
    }}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

function DivergenceBadge({ row }: { row: RatingPDRow }) {
  if (!row.stageDivergence || row.pdStage === null || row.watchlistStage === null) {
    return null;
  }
  const isWorse = row.watchlistStage > row.pdStage;
  return (
    <span style={{
      background: isWorse ? "#FEE2E2" : "#FEF3C7",
      color:      isWorse ? "#B91C1C" : "#B45309",
      fontWeight: 600, fontSize: "0.75rem",
      padding: "0.15rem 0.5rem", borderRadius: "9999px",
      whiteSpace: "nowrap",
    }}>
      {STAGE_LABEL[row.pdStage]} → {STAGE_LABEL[row.watchlistStage]}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, color, bg, note,
}: { label: string; value: string; color: string; bg: string; note?: string }) {
  return (
    <div style={{
      background: bg, borderRadius: "0.5rem",
      padding: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem",
    }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.375rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {note && <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{note}</div>}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Called when user clicks "Use in Custom Builder" — switches tab and pre-fills sliders. */
  onUseInCustomBuilder: (pdS2Multi: number, pdS3Multi: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RatingPDTab({ onUseInCustomBuilder }: Props) {
  const { lessees, leases } = usePortfolioData();

  // Threshold state is component-local — analysis input, not scenario parameter.
  const [thresholds, setThresholds] = useState<PDThresholds>(IATA_THRESHOLDS);
  const [activePreset, setActivePreset] = useState<"iata" | "tight" | "custom">("iata");

  // s1Input / s2Input are string state for the inline number inputs to allow partial editing.
  const [s1Input, setS1Input] = useState<string>((IATA_THRESHOLDS.s1Max * 100).toFixed(1));
  const [s2Input, setS2Input] = useState<string>((IATA_THRESHOLDS.s2Max * 100).toFixed(1));

  const {
    rows, portfolioWeightedPD,
    pctS1, pctS2, pctS3,
    impliedPdS2Multi, impliedPdS3Multi,
    divergenceCount,
  } = computePortfolioRatingPD(lessees, leases, thresholds);

  // ── Threshold preset handlers ──

  function applyIata() {
    setThresholds(IATA_THRESHOLDS);
    setActivePreset("iata");
    setS1Input((IATA_THRESHOLDS.s1Max * 100).toFixed(1));
    setS2Input((IATA_THRESHOLDS.s2Max * 100).toFixed(1));
  }

  function applyTight() {
    setThresholds(TIGHT_THRESHOLDS);
    setActivePreset("tight");
    setS1Input((TIGHT_THRESHOLDS.s1Max * 100).toFixed(1));
    setS2Input((TIGHT_THRESHOLDS.s2Max * 100).toFixed(1));
  }

  function handleS1Change(raw: string) {
    setS1Input(raw);
    const v = parseFloat(raw) / 100;
    if (!isNaN(v) && v >= 0 && v <= 1 && v < thresholds.s2Max) {
      setThresholds((t) => ({ ...t, s1Max: v }));
      setActivePreset("custom");
    }
  }

  function handleS2Change(raw: string) {
    setS2Input(raw);
    const v = parseFloat(raw) / 100;
    if (!isNaN(v) && v >= 0 && v <= 1 && v > thresholds.s1Max) {
      setThresholds((t) => ({ ...t, s2Max: v }));
      setActivePreset("custom");
    }
  }

  // ── KPI card colors ──

  const wpdPct = portfolioWeightedPD * 100;
  const wpdColor = wpdPct > 10 ? "#B91C1C" : wpdPct > 2 ? "#B45309" : "#15803D";
  const wpdBg    = wpdPct > 10 ? "#FEE2E2" : wpdPct > 2 ? "#FEF3C7" : "#DCFCE7";

  const s2Pct = pctS2 * 100;
  const s2Color = s2Pct > 75 ? "#B91C1C" : s2Pct > 50 ? "#B45309" : "#15803D";
  const s2Bg    = s2Pct > 75 ? "#FEE2E2" : s2Pct > 50 ? "#FEF3C7" : "#DCFCE7";

  const s3Pct = pctS3 * 100;
  const s3Color = s3Pct > 10 ? "#B91C1C" : s3Pct > 0 ? "#B45309" : "#15803D";
  const s3Bg    = s3Pct > 10 ? "#FEE2E2" : s3Pct > 0 ? "#FEF3C7" : "#DCFCE7";

  const divColor = divergenceCount > 0 ? "#B45309" : "#15803D";
  const divBg    = divergenceCount > 0 ? "#FEF3C7" : "#DCFCE7";

  // ── Pill style helper ──

  function presetPillStyle(active: boolean): React.CSSProperties {
    return {
      padding: "0.25rem 0.75rem",
      borderRadius: "9999px",
      border: active ? "1.5px solid #002147" : "1.5px solid #CBD5E1",
      background: active ? "#002147" : "#FFFFFF",
      color: active ? "#FFFFFF" : "#475569",
      fontSize: "0.8125rem", fontWeight: 500,
      cursor: "pointer", whiteSpace: "nowrap" as const,
    };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Threshold controls ── */}
      <Card>
        <div style={{ padding: "1rem 1.25rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
            Stage Thresholds
          </span>

          {/* Preset pills */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button style={presetPillStyle(activePreset === "iata")} onClick={applyIata}>
              IATA Standard
            </button>
            <button style={presetPillStyle(activePreset === "tight")} onClick={applyTight}>
              Tighter S3 Floor
            </button>
          </div>

          {/* Inline inputs */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "#475569" }}>
            <span>S1 max</span>
            <input
              type="number" min="0" max="100" step="0.1"
              value={s1Input}
              onChange={(e) => handleS1Change(e.target.value)}
              style={{
                width: "4.5rem", padding: "0.2rem 0.4rem", borderRadius: "0.375rem",
                border: "1px solid #CBD5E1", fontSize: "0.8125rem", textAlign: "right",
              }}
            />
            <span>%</span>
            <span style={{ marginLeft: "0.5rem" }}>S2 max</span>
            <input
              type="number" min="0" max="100" step="0.1"
              value={s2Input}
              onChange={(e) => handleS2Change(e.target.value)}
              style={{
                width: "4.5rem", padding: "0.2rem 0.4rem", borderRadius: "0.375rem",
                border: "1px solid #CBD5E1", fontSize: "0.8125rem", textAlign: "right",
              }}
            />
            <span>%</span>
          </div>
        </div>
      </Card>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Portfolio Weighted PD"
          value={portfolioWeightedPD > 0 ? `${wpdPct.toFixed(1)}%` : "—"}
          color={wpdColor}
          bg={wpdBg}
          note="rental-weighted avg"
        />
        <KpiCard
          label="Stage 1 %"
          value={`${(pctS1 * 100).toFixed(1)}%`}
          color="#15803D"
          bg="#DCFCE7"
        />
        <KpiCard
          label="Stage 2 %"
          value={`${s2Pct.toFixed(1)}%`}
          color={s2Color}
          bg={s2Bg}
        />
        <KpiCard
          label="Stage 3 %"
          value={`${s3Pct.toFixed(1)}%`}
          color={s3Color}
          bg={s3Bg}
        />
        <KpiCard
          label="Divergences"
          value={`${divergenceCount} ${divergenceCount === 1 ? "lessee" : "lessees"}`}
          color={divColor}
          bg={divBg}
          note="PD stage ≠ watchlist stage"
        />
      </div>

      {/* ── Per-lessee table ── */}
      <Card>
        <div style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "1rem" }}>
            Lessee PD &amp; Stage Analysis
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
                    {["Airline", "Rating", "PD", "PD Stage", "Watchlist Stage", "Divergence", "Weight %"].map((h) => (
                      <th key={h} style={{
                        textAlign: h === "Airline" || h === "Rating" ? "left" : "right",
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
                        {row.creditRating ?? "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {row.pdEstimate !== null ? `${(row.pdEstimate * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <StagePill stage={row.pdStage} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <StagePill stage={row.watchlistStage} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                        <DivergenceBadge row={row} />
                      </td>
                      <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                        {(row.weightPct * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer row */}
                <tfoot>
                  <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                    <td colSpan={2} style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#475569", fontSize: "0.75rem" }}>
                      PORTFOLIO WEIGHTED
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                      {portfolioWeightedPD > 0 ? `${(portfolioWeightedPD * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                        {(pctS1 * 100).toFixed(0)}% S1 · {(pctS2 * 100).toFixed(0)}% S2 · {(pctS3 * 100).toFixed(0)}% S3
                      </span>
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem" }} />
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#64748B", fontSize: "0.75rem", fontWeight: 500 }}>
                      {divergenceCount > 0 ? `${divergenceCount} divergence${divergenceCount > 1 ? "s" : ""}` : "—"}
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

      {/* ── "Use in Custom Builder" CTA ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => onUseInCustomBuilder(impliedPdS2Multi, impliedPdS3Multi)}
          disabled={rows.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            background: "#002147", color: "#FFFFFF",
            border: "none", borderRadius: "9999px",
            padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500,
            cursor: rows.length === 0 ? "not-allowed" : "pointer",
            opacity: rows.length === 0 ? 0.5 : 1,
          }}
          title="Derived from rental-weighted PD of each IFRS 9 stage bucket vs calibrated baselines (S2: 5%, S3: 30%)."
        >
          Use in Custom Builder →
        </button>
      </div>

    </div>
  );
}
