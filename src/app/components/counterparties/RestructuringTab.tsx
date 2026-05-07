// src/app/components/counterparties/RestructuringTab.tsx

import { useMemo, useState } from "react";
import { FileText, Info } from "lucide-react";
import { jsPDF } from "jspdf";
import { KpiCard } from "../ui/KpiCard";
import {
  RESTRUCTURING_TEMPLATES,
  type RestructuringInputRow,
  type RestructuringResult,
  type TemplateId,
  computeAllTemplates,
} from "./restructuringEngine";
import { jurisdictions } from "../jurisdictions/jurisdictionData";

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  rows: RestructuringInputRow[];
  /** ISO country name (e.g. "India") used to pull jurisdiction repossession data */
  country: string;
  /** Lessee display name — used in the term sheet */
  lesseeName: string;
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function fmtM1(v: number) { return `$${v.toFixed(1)}M`; }
function fmtM2(v: number) { return `$${v.toFixed(2)}M`; }
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }
function fmtMo(v: number)  { return v >= 120 ? ">10 yr" : `${v} mo`; }

// ── Metric definitions ─────────────────────────────────────────────────────────

type CoreMetricKey = keyof Pick<
  RestructuringResult,
  "npvToLessor" | "irr" | "eclRestructured" | "eclRelief" | "p95Downside" | "timeToRecovery"
>;

interface MetricDef {
  key: CoreMetricKey | "mrSd";
  label: string;
  format: (v: number) => string;
  higherIsBetter: boolean;
  tooltip?: string;
}

const METRIC_DEFS: MetricDef[] = [
  { key: "npvToLessor",     label: "NPV to Lessor ($M)",    format: fmtM1,  higherIsBetter: true,  tooltip: "PV of restructured cash flows minus any EAD write-down, discounted at 8% p.a." },
  { key: "irr",             label: "IRR (% p.a.)",           format: fmtPct, higherIsBetter: true,  tooltip: "Annualised internal rate of return on total capital at risk." },
  { key: "eclRestructured", label: "ECL Restructured ($M)",  format: fmtM2,  higherIsBetter: false, tooltip: "Lifetime ECL after applying template's PD relief and EAD reduction." },
  { key: "eclRelief",       label: "ECL Relief vs Base ($M)",format: fmtM2,  higherIsBetter: true,  tooltip: "Reduction in lifetime ECL versus the unmodified base case." },
  { key: "p95Downside",     label: "P95 Downside ($M)",      format: fmtM2,  higherIsBetter: false, tooltip: "Stress ECL assuming PD × 1.5 after template relief — tests resilience." },
  { key: "timeToRecovery",  label: "Time-to-Recovery (mo)",  format: fmtMo,  higherIsBetter: false, tooltip: "Estimated months until restructured cash flows recover adjusted EAD (undiscounted payback)." },
  { key: "mrSd",            label: "MR + SD Buffer ($M)",    format: fmtM2,  higherIsBetter: true,  tooltip: "Maintenance reserves + security deposit retained throughout restructuring. Recovered immediately on termination." },
];

// ── Term sheet generator (PDF) ─────────────────────────────────────────────────

function generateTermSheet(
  lesseeName: string,
  country: string,
  template: typeof RESTRUCTURING_TEMPLATES[0],
  result: RestructuringResult,
  rows: RestructuringInputRow[],
  mrSd: number,
): void {
  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W    = doc.internal.pageSize.getWidth();
  const H    = doc.internal.pageSize.getHeight();
  const LM   = 18;
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  // Header
  doc.setFillColor(0, 33, 71);
  doc.rect(0, 0, W, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("Aeroinsights Decision Platform", LM, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Indicative Restructuring Term Sheet — CONFIDENTIAL DRAFT", LM, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(dateStr, W - LM, 20, { align: "right" });

  let y = 36;

  // Cover info block
  const rows2: [string, string][] = [
    ["Lessee",             lesseeName],
    ["Jurisdiction",       country],
    ["Restructuring Type", template.name],
    ["Total EAD",          fmtM1(rows.reduce((s, r) => s + r.ead, 0) / 1e6)],
    ["Leases in Scope",    String(rows.length)],
    ["Document Status",    "INDICATIVE — Subject to Board Approval & Legal Review"],
  ];

  doc.setFontSize(9);
  for (const [label, value] of rows2) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(label, LM, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(value, LM + 55, y);
    y += 7;
  }

  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(LM, y, W - LM, y);
  y += 8;

  // Template description
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 33, 71);
  doc.text("1. Proposed Restructuring Structure", LM, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const descLines = doc.splitTextToSize(template.description, W - LM * 2);
  doc.text(descLines, LM, y);
  y += descLines.length * 5 + 4;

  // Key commercial terms
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 33, 71);
  doc.text("2. Key Commercial Terms", LM, y);
  y += 6;

  const terms: [string, string][] = [
    ["Rent Holiday Period",      template.holidayMonths > 0 ? `${template.holidayMonths} months` : "None"],
    ["Rent Multiplier",          `${(template.rentMultiplier * 100).toFixed(0)}% of contracted rate`],
    ["EAD Write-Down",           template.eadWriteDownPct > 0 ? `${template.eadWriteDownPct}% of outstanding balance` : "None"],
    ["Term Extension",           template.termExtMonths > 0 ? `+${template.termExtMonths} months` : "None"],
    ["Implementation Timeline",  template.implementationTimeline],
  ];
  doc.setFontSize(8.5);
  for (const [label, value] of terms) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`• ${label}:`, LM, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(value, LM + 52, y);
    y += 6;
  }

  y += 2;
  doc.line(LM, y, W - LM, y);
  y += 8;

  // Financial summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 33, 71);
  doc.text("3. Financial Summary", LM, y);
  y += 6;

  const fin: [string, string][] = [
    ["NPV to Lessor",        fmtM1(result.npvToLessor)],
    ["IRR (Annualised)",     fmtPct(result.irr)],
    ["ECL Restructured",     fmtM2(result.eclRestructured)],
    ["ECL Relief vs Base",   fmtM2(result.eclRelief)],
    ["P95 Downside ECL",     fmtM2(result.p95Downside)],
    ["Time-to-Recovery",     fmtMo(result.timeToRecovery)],
    ["MR + SD Buffer",       fmtM2(mrSd)],
    ["Counterfactual Loss",  fmtM2(result.counterfactualLoss)],
  ];
  doc.setFontSize(8.5);
  for (const [label, value] of fin) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`• ${label}:`, LM, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(value, LM + 52, y);
    y += 6;
  }

  y += 2;
  doc.line(LM, y, W - LM, y);
  y += 8;

  // Conditions
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 33, 71);
  doc.text("4. Conditions Precedent", LM, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const condLines = doc.splitTextToSize(template.conditions, W - LM * 2);
  doc.text(condLines, LM, y);
  y += condLines.length * 5 + 6;

  // Disclaimer
  doc.setFillColor(248, 250, 252);
  doc.rect(LM, y, W - LM * 2, 20, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  const disclaimer =
    "This term sheet is indicative only and does not constitute a binding commitment. All terms are subject to final credit committee approval, legal due diligence, and execution of formal documentation. NPV/IRR/ECL figures are model outputs based on current inputs and market assumptions — actual outcomes may differ materially.";
  const discLines = doc.splitTextToSize(disclaimer, W - LM * 2 - 6);
  doc.text(discLines, LM + 3, y + 5);

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.line(LM, H - 12, W - LM, H - 12);
  doc.text("Aeroinsights Decision Platform  ·  Confidential  ·  Not for distribution", LM, H - 7);
  doc.text("Page 1 of 1", W - LM, H - 7, { align: "right" });

  const slug = lesseeName.toLowerCase().replace(/\s+/g, "-");
  const tmplSlug = template.id;
  doc.save(`term-sheet-${slug}-${tmplSlug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Component ──────────────────────────────────────────────────────────────────

export function RestructuringTab({ rows, country, lesseeName }: Props) {
  const [expandedId, setExpandedId]     = useState<TemplateId | null>(null);
  const [selectedId,  setSelectedId]    = useState<TemplateId | null>(null);
  const [showTooltip, setShowTooltip]   = useState<string | null>(null);

  const results = useMemo(() => computeAllTemplates(rows), [rows]);

  const eclBase = useMemo(
    () => rows.reduce((s, r) => s + r.eclLifetime, 0) / 1e6,
    [rows]
  );

  // MR + SD buffer: ~2.5% of EAD + 2 months rent per lease
  const mrSdBuffer = useMemo(
    () => rows.reduce((s, r) => s + r.ead * 0.025 + r.monthlyRentUSD * 2, 0) / 1e6,
    [rows]
  );

  // Jurisdiction data for Termination column
  const jurisdiction = useMemo(
    () => jurisdictions.find(j => j.country.toLowerCase() === country.toLowerCase()) ?? null,
    [country]
  );

  // Parse repossession cost % from "8.4%" string → number
  const repoCostPct = useMemo(() => {
    if (!jurisdiction) return 10;
    return parseFloat(jurisdiction.repossP50Cost.replace("%", ""));
  }, [jurisdiction]);

  const repoSuccessPct = useMemo(() => {
    if (!jurisdiction) return 60;
    return parseFloat(jurisdiction.successProb.replace("%", ""));
  }, [jurisdiction]);

  // Termination scenario metrics (jurisdiction-linked)
  const totalEAD = useMemo(() => rows.reduce((s, r) => s + r.ead, 0) / 1e6, [rows]);
  const avgLGD   = useMemo(() => {
    const t = rows.reduce((s, r) => s + r.ead, 0);
    return t === 0 ? 50 : rows.reduce((s, r) => s + r.lgd * r.ead, 0) / t;
  }, [rows]);

  const terminationMetrics = useMemo(() => {
    const repoCost   = totalEAD * repoCostPct / 100;
    const netRecovery = totalEAD * repoSuccessPct / 100 - repoCost;
    const repoMo     = jurisdiction?.repossP50 ?? 24;
    // IRR: monthly rate where PV(netRecovery at repoMo) = totalEAD
    const monthlyRate = totalEAD > 0 && netRecovery > 0
      ? Math.pow(netRecovery / totalEAD, 1 / repoMo) - 1
      : 0;
    const annualisedIRR = (Math.pow(1 + monthlyRate, 12) - 1) * 100;
    return {
      npv:            netRecovery,
      irr:            Math.max(0, annualisedIRR),
      eclRestructured: totalEAD * (1 - repoSuccessPct / 100) * avgLGD / 100,
      eclRelief:      0,                    // default is the baseline — no relief
      p95Downside:    totalEAD * (1 - repoSuccessPct / 100) * Math.min(100, avgLGD * 1.35) / 100,
      timeToRecovery: jurisdiction?.repossP50 ?? 24,
      mrSd:           mrSdBuffer,           // immediately recovered on repossession
    };
  }, [totalEAD, repoCostPct, repoSuccessPct, jurisdiction, avgLGD, mrSdBuffer]);

  // Map templateId → result for O(1) lookup
  const resultMap = useMemo(
    () => new Map<TemplateId, RestructuringResult>(results.map(r => [r.templateId, r])),
    [results]
  );

  // Best value per metric
  const bestValuesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const metric of METRIC_DEFS) {
      if (metric.key === "mrSd") {
        // mrSd is same for all — no "best"
        map.set(metric.key, mrSdBuffer);
        continue;
      }
      if (results.length === 0) { map.set(metric.key, 0); continue; }
      const vals = results.map(r => (metric.key === "mrSd" ? mrSdBuffer : r[metric.key as CoreMetricKey]));
      map.set(metric.key, metric.higherIsBetter ? Math.max(...vals) : Math.min(...vals));
    }
    return map;
  }, [results, mrSdBuffer]);

  function handleHeaderClick(id: TemplateId) {
    setExpandedId(prev => prev === id ? null : id);
    setSelectedId(id);
  }

  const expandedTemplate = expandedId
    ? RESTRUCTURING_TEMPLATES.find(t => t.id === expandedId)
    : null;

  if (results.length === 0) {
    return (
      <div style={{ padding: "2rem", color: "#94A3B8", textAlign: "center", fontSize: "0.875rem" }}>
        No lease data available for restructuring analysis.
      </div>
    );
  }

  const bestNPV        = results.reduce((b, r) => r.npvToLessor > b.npvToLessor ? r : b, results[0]);
  const bestRelief     = results.reduce((b, r) => r.eclRelief   > b.eclRelief   ? r : b, results[0]);
  const counterfactual = results[0].counterfactualLoss;
  const bestNPVName    = RESTRUCTURING_TEMPLATES.find(t => t.id === bestNPV.templateId)?.name;
  const bestReliefName = RESTRUCTURING_TEMPLATES.find(t => t.id === bestRelief.templateId)?.name;

  function getCellValue(metric: MetricDef, result: RestructuringResult): number {
    if (metric.key === "mrSd") return mrSdBuffer;
    return result[metric.key as CoreMetricKey];
  }

  function getTerminationValue(metric: MetricDef): number {
    switch (metric.key) {
      case "npvToLessor":     return terminationMetrics.npv;
      case "irr":             return terminationMetrics.irr;
      case "eclRestructured": return terminationMetrics.eclRestructured;
      case "eclRelief":       return terminationMetrics.eclRelief;
      case "p95Downside":     return terminationMetrics.p95Downside;
      case "timeToRecovery":  return terminationMetrics.timeToRecovery;
      case "mrSd":            return terminationMetrics.mrSd;
      default:                return 0;
    }
  }

  const selectedTemplate = selectedId ? RESTRUCTURING_TEMPLATES.find(t => t.id === selectedId) : null;
  const selectedResult   = selectedId ? resultMap.get(selectedId)  : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI bar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        <KpiCard label="Base ECL Lifetime"   value={fmtM2(eclBase)}                       staggerIndex={0} />
        <KpiCard label="Best NPV to Lessor"  value={fmtM1(bestNPV.npvToLessor)}           subtitle={bestNPVName}    staggerIndex={1} />
        <KpiCard label="Max ECL Relief"      value={fmtM2(bestRelief.eclRelief)}           subtitle={bestReliefName} deltaType="positive" staggerIndex={2} />
        <KpiCard label="MR + SD Buffer"      value={fmtM2(mrSdBuffer)}                    subtitle="Protected during restructuring" staggerIndex={3} />
      </div>

      {/* ── Jurisdiction banner ── */}
      {jurisdiction && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.625rem 1rem",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
          }}
        >
          <Info size={13} style={{ color: "#64748B", flexShrink: 0 }} />
          <span style={{ color: "#475569" }}>
            <strong style={{ color: "#0F172A" }}>{country} jurisdiction:</strong>
            {" "}P50 repossession {jurisdiction.repossP50} mo · {jurisdiction.successProb} success probability · {jurisdiction.repossP50Cost} of asset value in costs
            {" · "}{jurisdiction.ctcParty ? "CTC party ✓" : "Non-CTC"}
            {jurisdiction.sanctions !== "None" && (
              <strong style={{ color: "#B91C1C" }}> · SANCTIONED</strong>
            )}
          </span>
        </div>
      )}

      {/* ── Comparison table ── */}
      <div style={{ overflowX: "auto", borderRadius: "0.5rem", border: "1px solid #E2E8F0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #E2E8F0", background: "#FFFFFF" }}>
              {/* Metric label column */}
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
                  minWidth: "160px",
                }}
              >
                Metric
              </th>

              {/* Restructuring option columns */}
              {RESTRUCTURING_TEMPLATES.map(tmpl => (
                <th
                  key={tmpl.id}
                  scope="col"
                  tabIndex={0}
                  role="columnheader"
                  aria-pressed={expandedId === tmpl.id}
                  onClick={() => handleHeaderClick(tmpl.id)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleHeaderClick(tmpl.id); }
                  }}
                  title="Click to expand · click again to collapse"
                  style={{
                    padding: "0.625rem 0.75rem",
                    textAlign: "right",
                    cursor: "pointer",
                    color: selectedId === tmpl.id ? "#002147" : "#475569",
                    fontWeight: selectedId === tmpl.id ? 700 : 600,
                    fontSize: "0.6875rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    borderBottom: selectedId === tmpl.id ? "2px solid #002147" : "2px solid transparent",
                    transition: "color 120ms ease, border-color 120ms ease",
                    background: selectedId === tmpl.id ? "#F0F5FF" : "transparent",
                  }}
                >
                  {tmpl.name}
                </th>
              ))}

              {/* Termination column */}
              <th
                style={{
                  padding: "0.625rem 0.75rem",
                  textAlign: "right",
                  color: "#B91C1C",
                  fontWeight: 700,
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                  borderLeft: "2px solid #FEE2E2",
                  background: "#FFF5F5",
                }}
              >
                Termination
              </th>
            </tr>
          </thead>

          <tbody>
            {METRIC_DEFS.map((metric, rowIdx) => {
              const best = bestValuesMap.get(metric.key) ?? 0;
              return (
                <tr
                  key={metric.key}
                  style={{
                    background: rowIdx % 2 === 0 ? "#F8FAFC" : "#FFFFFF",
                    borderBottom: "1px solid #E2E8F0",
                  }}
                >
                  {/* Metric label with optional tooltip */}
                  <td
                    style={{ padding: "0.5rem 0.75rem", color: "#0F172A", fontWeight: 500, whiteSpace: "nowrap" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      {metric.label}
                      {metric.tooltip && (
                        <div style={{ position: "relative", display: "inline-flex" }}>
                          <Info
                            size={11}
                            style={{ color: "#CBD5E1", cursor: "help" }}
                            onMouseEnter={() => setShowTooltip(metric.key)}
                            onMouseLeave={() => setShowTooltip(null)}
                          />
                          {showTooltip === metric.key && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: "calc(100% + 6px)",
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: "#0F172A",
                                color: "#F8FAFC",
                                fontSize: "0.6875rem",
                                padding: "0.4rem 0.625rem",
                                borderRadius: "0.375rem",
                                whiteSpace: "nowrap",
                                maxWidth: "240px",
                                zIndex: 20,
                                lineHeight: 1.4,
                                pointerEvents: "none",
                              }}
                            >
                              {metric.tooltip}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Restructuring option cells */}
                  {RESTRUCTURING_TEMPLATES.map(tmpl => {
                    const result = resultMap.get(tmpl.id);
                    const val    = result ? getCellValue(metric, result) : 0;
                    const isBest = Math.abs(val - best) < 0.001 && results.length > 0;
                    return (
                      <td
                        key={tmpl.id}
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          color: isBest
                            ? (metric.higherIsBetter ? "#15803D" : "#B45309")
                            : "#0F172A",
                          background: selectedId === tmpl.id
                            ? "rgba(0,33,71,0.04)"
                            : isBest
                            ? metric.higherIsBetter
                              ? "rgba(21,128,61,0.05)"
                              : "rgba(180,83,9,0.05)"
                            : "transparent",
                          fontWeight: isBest ? 600 : 400,
                        }}
                      >
                        {metric.format(val)}
                      </td>
                    );
                  })}

                  {/* Termination cell */}
                  <td
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      color: "#B91C1C",
                      fontWeight: 500,
                      borderLeft: "2px solid #FEE2E2",
                      background: rowIdx % 2 === 0 ? "#FFF7F7" : "#FFF5F5",
                    }}
                  >
                    {metric.format(getTerminationValue(metric))}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.25rem" }}>
            <div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                Implementation
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#0F172A" }}>{expandedTemplate.implementationTimeline}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                Conditions
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#0F172A" }}>{expandedTemplate.conditions}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Counterfactual banner ── */}
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
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>{fmtM2(counterfactual)}</strong>
          {" "}(total EAD × weighted-average LGD) · Compare vs. termination NPV of{" "}
          <strong>{fmtM1(terminationMetrics.npv)}</strong>{" "}after {jurisdiction?.repossP50 ?? "?"} mo repossession
        </span>
      </div>

      {/* ── Generate Term Sheet ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.25rem",
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: "0.75rem",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "0.125rem" }}>
            Generate Indicative Term Sheet
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#64748B" }}>
            {selectedTemplate
              ? `Ready — "${selectedTemplate.name}" selected. Click to download PDF.`
              : "Click a column header above to select a restructuring option first."}
          </div>
        </div>
        <button
          onClick={() => {
            if (!selectedTemplate || !selectedResult) return;
            generateTermSheet(lesseeName, country, selectedTemplate, selectedResult, rows, mrSdBuffer);
          }}
          disabled={!selectedTemplate}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 1.25rem",
            background: selectedTemplate ? "#002147" : "#F1F5F9",
            color: selectedTemplate ? "#FFFFFF" : "#CBD5E1",
            border: "none",
            borderRadius: "9999px",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: selectedTemplate ? "pointer" : "not-allowed",
            flexShrink: 0,
            transition: "background 150ms, transform 150ms",
          }}
          onMouseEnter={e => { if (selectedTemplate) (e.currentTarget as HTMLButtonElement).style.background = "#001a35"; }}
          onMouseLeave={e => { if (selectedTemplate) (e.currentTarget as HTMLButtonElement).style.background = "#002147"; }}
          onMouseDown={e => { if (selectedTemplate) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
          onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        >
          <FileText size={14} />
          Generate Term Sheet
        </button>
      </div>

    </div>
  );
}
