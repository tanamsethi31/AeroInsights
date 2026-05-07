import { useState, useEffect } from "react";
import { X, Info, Copy, Check } from "lucide-react";

export interface ShapleyDriver {
  driver: string;
  contribution: number; // % attribution (top-5, absolute values)
  direction: "up" | "down"; // up = increases ECL (adverse), down = reduces ECL (favorable)
}

export interface ScenarioRunResult {
  id: string;
  templateId: string | null;
  name: string;
  mode: "deterministic" | "montecarlo";
  paths: number | null;
  seed: number;
  runDate: string;
  durationSec: string;
  ecl: number; // $M, this is P50
  p5: number | null;
  p95: number | null;
  s1: number; // $M
  s2: number; // $M
  s3: number; // $M
  shapley: ShapleyDriver[];
  keyFinding: string;
  scenarioHash: string;
  topLessees: Array<{ name: string; ecl: number; jurisdiction: string }>;
  s3LeaseCount: number;
  parentId?: string;   // set when this run is branched from another run
}

// ─── Shimmer animation (injected once) ───────────────────────────────────────

const SHIMMER_CSS = `
@keyframes narrative-shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
.narrative-shimmer {
  background: linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%);
  background-size: 1200px 100%;
  animation: narrative-shimmer 1.4s linear infinite;
  border-radius: 4px;
}
`;

// Inject the shimmer animation once per page load
let _shimmerInjected = false;
function injectShimmerCSS() {
  if (_shimmerInjected) return;
  _shimmerInjected = true;
  const el = document.createElement("style");
  el.textContent = SHIMMER_CSS;
  document.head.appendChild(el);
}

// ─── NarrativeSummaryCard ─────────────────────────────────────────────────────

interface NarrativeSummaryCardProps {
  narrative: string | null | "loading";
}

function NarrativeSummaryCard({ narrative }: NarrativeSummaryCardProps) {
  injectShimmerCSS();
  const [copied, setCopied] = useState(false);

  // null means validation failed or API error — render nothing
  if (narrative === null) return null;

  const handleCopy = () => {
    if (narrative !== "loading") {
      navigator.clipboard.writeText(narrative).catch(() => undefined);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <>
      <div
        style={{
          background: narrative === "loading" ? "#FFFFFF" : "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderLeft: narrative === "loading" ? "1px solid #E2E8F0" : "3px solid #002147",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          marginBottom: "1rem",
        }}
      >
        {narrative === "loading" ? (
          <>
            {/* Header shimmer */}
            <div
              className="narrative-shimmer"
              style={{ width: "40%", height: "12px", marginBottom: "0.875rem" }}
            />
            {/* Body line shimmers */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div className="narrative-shimmer" style={{ width: "95%", height: "10px" }} />
              <div className="narrative-shimmer" style={{ width: "90%", height: "10px" }} />
              <div className="narrative-shimmer" style={{ width: "75%", height: "10px" }} />
            </div>
          </>
        ) : (
          <>
            {/* Header row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.625rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#002147",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                ✦ Run Summary
              </span>
              <button
                onClick={handleCopy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  background: "transparent",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0.375rem",
                  padding: "0.25rem 0.625rem",
                  fontSize: "0.75rem",
                  color: "#64748B",
                  cursor: "pointer",
                }}
              >
                {copied ? <Check size={12} color="#15803D" /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {/* Narrative text */}
            <p style={{ margin: 0, fontSize: "0.9375rem", color: "#334155", lineHeight: 1.7 }}>
              {narrative}
            </p>
          </>
        )}
      </div>
    </>
  );
}

interface Props {
  run: ScenarioRunResult;
  onClose?: () => void;
  compact?: boolean;
  narrative?: string | null | "loading";
  onRequestNarrative?: (run: ScenarioRunResult) => void;
}

export function RunResultPanel({ run, onClose, compact = false, narrative, onRequestNarrative }: Props) {
  const totalECL = run.s1 + run.s2 + run.s3;

  // Trigger narrative generation on first mount for this run
  useEffect(() => {
    onRequestNarrative?.(run);
  }, [run.id, onRequestNarrative]);

  const p5 = run.p5;
  const p95 = run.p95;
  const pMin = p5 ?? run.ecl;
  const pMax = p95 ?? run.ecl;
  const p50pct = pMax > pMin ? ((run.ecl - pMin) / (pMax - pMin)) * 100 : 50;

  return (
    <div
      style={{
        background: "#FAFAFA",
        border: "1px solid #E2E8F0",
        borderRadius: "0.5rem",
        padding: compact ? "1rem" : "1.25rem",
      }}
    >
      {/* ── Narrative Summary Card ────────────────────────────── */}
      {narrative !== undefined && (
        <NarrativeSummaryCard narrative={narrative} />
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#15803D",
                background: "rgba(21,128,61,0.08)",
                padding: "0.125rem 0.5rem",
                borderRadius: "0.25rem",
                border: "1px solid rgba(21,128,61,0.2)",
              }}
            >
              Complete
            </span>
            <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#94A3B8" }}>
              {run.id}
            </span>
            <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#CBD5E1" }}>
              · hash: {run.scenarioHash}
            </span>
          </div>
          <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#94A3B8" }}>
            {run.runDate} ·{" "}
            {run.mode === "deterministic"
              ? "Deterministic"
              : `Monte Carlo ${run.paths?.toLocaleString()} paths`}{" "}
            · seed: {run.seed} · {run.durationSec}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              padding: "0.25rem",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── ECL + MC Distribution ──────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: run.mode === "montecarlo" ? "auto 1fr" : "auto",
          gap: "1.5rem",
          marginBottom: "1rem",
          alignItems: "start",
        }}
      >
        {/* ECL big number */}
        <div>
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "#94A3B8",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "0.25rem",
            }}
          >
            Portfolio ECL
          </div>
          <div
            style={{
              fontSize: "1.875rem",
              fontWeight: 700,
              color: "#0F172A",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            ${run.ecl.toFixed(1)}M
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.25rem" }}>
            {((run.ecl / 2840) * 100).toFixed(2)}% of book value
          </div>
        </div>

        {/* MC Range */}
        {run.mode === "montecarlo" && p5 !== null && p95 !== null && (
          <div
            style={{
              background: "#F4F5F7",
              border: "1px solid #E2E8F0",
              borderRadius: "0.375rem",
              padding: "0.75rem",
            }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "0.5rem",
              }}
            >
              Monte Carlo Distribution
            </div>
            <div style={{ display: "flex", gap: "1.5rem", marginBottom: "0.625rem" }}>
              {(
                [
                  ["P5 (Best)", p5, "#15803D"],
                  ["P50 (Median)", run.ecl, "#002147"],
                  ["P95 (Tail)", p95, "#B91C1C"],
                ] as [string, number, string][]
              ).map(([label, val, color]) => (
                <div key={label}>
                  <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{label}</div>
                  <div
                    style={{
                      fontWeight: 600,
                      color,
                      fontVariantNumeric: "tabular-nums",
                      fontSize: "0.875rem",
                    }}
                  >
                    ${val.toFixed(1)}M
                  </div>
                </div>
              ))}
            </div>
            {/* Range bar */}
            <div style={{ position: "relative", height: "6px", background: "#E2E8F0", borderRadius: "3px" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "3px",
                  background:
                    "linear-gradient(to right, rgba(21,128,61,0.35), rgba(0,33,71,0.35) 50%, rgba(185,28,28,0.35))",
                }}
              />
              {/* P50 marker */}
              <div
                style={{
                  position: "absolute",
                  left: `${p50pct}%`,
                  top: "-3px",
                  bottom: "-3px",
                  width: "2px",
                  background: "#002147",
                  borderRadius: "1px",
                  transform: "translateX(-50%)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Stage Breakdown ────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.625rem",
          marginBottom: "1rem",
        }}
      >
        {(
          [
            ["Stage 1", run.s1, "#15803D", "rgba(21,128,61,0.06)", "rgba(21,128,61,0.15)"],
            ["Stage 2", run.s2, "#B45309", "rgba(180,83,9,0.06)", "rgba(180,83,9,0.15)"],
            ["Stage 3", run.s3, "#B91C1C", "rgba(185,28,28,0.06)", "rgba(185,28,28,0.15)"],
          ] as [string, number, string, string, string][]
        ).map(([label, val, color, bg, border]) => (
          <div
            key={label}
            style={{
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: "0.375rem",
              padding: "0.75rem",
            }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.25rem",
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontWeight: 700,
                color: "#0F172A",
                fontVariantNumeric: "tabular-nums",
                fontSize: "1rem",
              }}
            >
              ${val.toFixed(1)}M
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>
              {totalECL > 0 ? ((val / totalECL) * 100).toFixed(1) : "0.0"}% of ECL
            </div>
          </div>
        ))}
      </div>

      {/* ── Shapley Attribution ────────────────────────────────── */}
      <div style={{ marginBottom: "1rem" }}>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "#94A3B8",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "0.625rem",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
          }}
        >
          Top-5 Driver Attribution (Shapley)
          <span title="Shapley values show each input driver's proportional contribution to portfolio ECL in this scenario.">
            <Info size={11} style={{ color: "#94A3B8" }} />
          </span>
        </div>
        {run.shapley.map((d) => {
          const isAdverse = d.direction === "up";
          const barColor = isAdverse
            ? d.contribution > 30
              ? "#B91C1C"
              : "#B45309"
            : "#15803D";
          return (
            <div
              key={d.driver}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                marginBottom: "0.4375rem",
              }}
            >
              <div
                style={{
                  width: "190px",
                  fontSize: "0.8125rem",
                  color: "#475569",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={d.driver}
              >
                {d.driver}
              </div>
              <div
                style={{
                  flex: 1,
                  height: "6px",
                  background: "#E2E8F0",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${d.contribution}%`,
                    height: "100%",
                    background: barColor,
                    borderRadius: "3px",
                  }}
                />
              </div>
              <div
                style={{
                  width: "42px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textAlign: "right",
                  color: barColor,
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                {isAdverse ? "+" : "−"}
                {d.contribution}%
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Key Finding ────────────────────────────────────────── */}
      <div
        style={{
          background: "rgba(0,33,71,0.04)",
          border: "1px solid rgba(0,33,71,0.1)",
          borderRadius: "0.375rem",
          padding: "0.75rem",
          fontSize: "0.8125rem",
          color: "#0F172A",
          lineHeight: 1.5,
        }}
      >
        <span style={{ fontWeight: 600, color: "#002147" }}>Key Finding: </span>
        {run.keyFinding}
      </div>
    </div>
  );
}
