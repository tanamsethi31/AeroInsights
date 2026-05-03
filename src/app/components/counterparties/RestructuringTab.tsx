// src/app/components/counterparties/RestructuringTab.tsx

import { useMemo, useState } from "react";
import { KpiCard } from "../ui/KpiCard";
import {
  RESTRUCTURING_TEMPLATES,
  RestructuringInputRow,
  RestructuringResult,
  TemplateId,
  computeAllTemplates,
} from "./restructuringEngine";

interface Props {
  rows: RestructuringInputRow[];
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function fmtM1(v: number) { return `$${v.toFixed(1)}M`; }
function fmtM2(v: number) { return `$${v.toFixed(2)}M`; }
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }

// ── Metric definitions ─────────────────────────────────────────────────────────

type MetricKey = keyof Pick<
  RestructuringResult,
  "npvToLessor" | "irr" | "eclRestructured" | "eclRelief" | "p95Downside"
>;

interface MetricDef {
  key: MetricKey;
  label: string;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

const METRIC_DEFS: MetricDef[] = [
  { key: "npvToLessor",     label: "NPV to Lessor ($M)",   format: fmtM1,  higherIsBetter: true  },
  { key: "irr",             label: "IRR (%)",               format: fmtPct, higherIsBetter: true  },
  { key: "eclRestructured", label: "ECL Restructured ($M)", format: fmtM2,  higherIsBetter: false },
  { key: "eclRelief",       label: "ECL Relief ($M)",       format: fmtM2,  higherIsBetter: true  },
  { key: "p95Downside",     label: "P95 Downside ($M)",     format: fmtM2,  higherIsBetter: false },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function RestructuringTab({ rows }: Props) {
  const [expandedId, setExpandedId] = useState<TemplateId | null>(null);

  const results = useMemo(() => computeAllTemplates(rows), [rows]);

  const eclBase = useMemo(
    () => rows.reduce((s, r) => s + r.eclLifetime, 0) / 1e6,
    [rows]
  );

  const bestNPV = results.reduce((best, r) =>
    r.npvToLessor > best.npvToLessor ? r : best, results[0]
  );
  const bestRelief = results.reduce((best, r) =>
    r.eclRelief > best.eclRelief ? r : best, results[0]
  );

  const counterfactualLoss = results[0]?.counterfactualLoss ?? 0;

  // Map templateId → result for O(1) lookup in render
  const resultMap = useMemo(
    () => new Map<TemplateId, RestructuringResult>(results.map((r) => [r.templateId, r])),
    [results]
  );

  // Per-metric best value (among the 7 templates, excluding Default)
  function bestValue(metric: MetricDef): number {
    const vals = results.map((r) => r[metric.key]);
    return metric.higherIsBetter ? Math.max(...vals) : Math.min(...vals);
  }

  function handleHeaderClick(id: TemplateId) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const expandedTemplate = expandedId
    ? RESTRUCTURING_TEMPLATES.find((t) => t.id === expandedId)
    : null;

  const bestNPVName = RESTRUCTURING_TEMPLATES.find((t) => t.id === bestNPV?.templateId)?.name;
  const bestReliefName = RESTRUCTURING_TEMPLATES.find((t) => t.id === bestRelief?.templateId)?.name;

  // Guard: if no results (empty rows), show nothing
  if (results.length === 0) {
    return (
      <div style={{ padding: "2rem", color: "#94A3B8", textAlign: "center", fontSize: "0.875rem" }}>
        No lease data available for restructuring analysis.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI bar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Base ECL LT"
          value={fmtM2(eclBase)}
          staggerIndex={0}
        />
        <KpiCard
          label="Best NPV to Lessor"
          value={fmtM1(bestNPV?.npvToLessor ?? 0)}
          subtitle={bestNPVName}
          staggerIndex={1}
        />
        <KpiCard
          label="Max ECL Relief"
          value={fmtM2(bestRelief?.eclRelief ?? 0)}
          subtitle={bestReliefName}
          deltaType="positive"
          staggerIndex={2}
        />
      </div>

      {/* ── Comparison table ── */}
      <div style={{ overflowX: "auto", borderRadius: "0.5rem", border: "1px solid #E2E8F0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #E2E8F0", background: "#FFFFFF" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "0.625rem 0.75rem",
                  color: "#94A3B8",
                  fontWeight: 600,
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                }}
              >
                Metric
              </th>
              {RESTRUCTURING_TEMPLATES.map((tmpl) => (
                <th
                  key={tmpl.id}
                  onClick={() => handleHeaderClick(tmpl.id)}
                  title="Click to see template details"
                  style={{
                    padding: "0.625rem 0.75rem",
                    textAlign: "right",
                    cursor: "pointer",
                    color: expandedId === tmpl.id ? "#002147" : "#475569",
                    fontWeight: expandedId === tmpl.id ? 700 : 600,
                    fontSize: "0.6875rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    borderBottom: expandedId === tmpl.id ? "2px solid #002147" : "2px solid transparent",
                    transition: "color 120ms ease, border-color 120ms ease",
                  }}
                >
                  {tmpl.name}
                </th>
              ))}
              {/* Default (counterfactual) column header — not clickable */}
              <th
                style={{
                  padding: "0.625rem 0.75rem",
                  textAlign: "right",
                  color: "#94A3B8",
                  fontWeight: 600,
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}
              >
                Default
              </th>
            </tr>
          </thead>
          <tbody>
            {METRIC_DEFS.map((metric, rowIdx) => {
              const best = bestValue(metric);
              return (
                <tr
                  key={metric.key}
                  style={{
                    background: rowIdx % 2 === 0 ? "#F8FAFC" : "#FFFFFF",
                    borderBottom: "1px solid #E2E8F0",
                  }}
                >
                  <td
                    style={{
                      padding: "0.5rem 0.75rem",
                      color: "#0F172A",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {metric.label}
                  </td>

                  {RESTRUCTURING_TEMPLATES.map((tmpl) => {
                    const result = resultMap.get(tmpl.id);
                    const val = result ? result[metric.key] : 0;
                    const isBest = Math.abs(val - best) < 0.0001;
                    const isPositiveRelief = metric.key === "eclRelief" && val > 0;
                    return (
                      <td
                        key={tmpl.id}
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          color: isBest ? "#15803D" : isPositiveRelief ? "#15803D" : "#0F172A",
                          background: isBest ? "rgba(21,128,61,0.06)" : "transparent",
                          fontWeight: isBest ? 600 : 400,
                        }}
                      >
                        {metric.format(val)}
                      </td>
                    );
                  })}

                  {/* Default column */}
                  <td
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: "right",
                      color: "#94A3B8",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {metric.key === "eclRestructured"
                      ? fmtM2(eclBase)
                      : metric.key === "eclRelief"
                      ? "$0.00M"
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Template detail accordion ── */}
      {expandedTemplate && (
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #CBD5E1",
            borderRadius: "0.5rem",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
          }}
        >
          <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#002147" }}>
            {expandedTemplate.name}
          </div>
          <p style={{ fontSize: "0.8125rem", color: "#475569", margin: 0, lineHeight: 1.5 }}>
            {expandedTemplate.description}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginTop: "0.25rem",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#94A3B8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                Implementation
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#0F172A" }}>
                {expandedTemplate.implementationTimeline}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#94A3B8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                Conditions
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#0F172A" }}>
                {expandedTemplate.conditions}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Counterfactual default banner ── */}
      <div
        style={{
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          fontSize: "0.8125rem",
        }}
      >
        <span style={{ fontWeight: 600, color: "#B91C1C", whiteSpace: "nowrap" }}>
          Counterfactual — Immediate Default:
        </span>
        <span style={{ color: "#7F1D1D" }}>
          Expected loss ={" "}
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtM2(counterfactualLoss)}
          </strong>
          {" "}(total EAD × weighted-average LGD)
        </span>
      </div>
    </div>
  );
}
