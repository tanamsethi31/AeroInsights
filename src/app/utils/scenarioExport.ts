// src/app/utils/scenarioExport.ts
// PDF export for IFRS 9 ECL scenario runs.
// Uses the same jsPDF + jspdf-autotable stack as the rest of the app.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ScenarioRunResult } from "../components/scenarios/RunResultPanel";

const NAVY = [0, 33, 71] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const SLATE = [71, 85, 105] as [number, number, number];
const DARK  = [15, 23, 42] as [number, number, number];
const GREEN = [21, 128, 61] as [number, number, number];
const RED   = [185, 28, 28] as [number, number, number];

/**
 * Generates and immediately downloads a PDF for a single scenario run.
 * One page for deterministic runs; a second page with distribution details for Monte Carlo.
 */
export function exportScenarioRunPDF(run: ScenarioRunResult): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 14; // left margin

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 24, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("ECL SCENARIO RUN REPORT", M, 10);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  const dateLabel = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  doc.text(`Aeroinsights  |  Generated ${dateLabel}  |  IFRS 9 ECL Analysis`, M, 17);
  doc.text(`Hash: ${run.scenarioHash}`, W - M, 17, { align: "right" });

  // ── Scenario title ───────────────────────────────────────────────────────────
  doc.setTextColor(...DARK);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(run.name, M, 33);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);
  const meta = [
    `Run ID: ${run.id}`,
    `Date: ${run.runDate}`,
    `Mode: ${run.mode === "deterministic" ? "Deterministic" : `Monte Carlo (${run.paths?.toLocaleString() ?? "—"} paths)`}`,
    `Seed: ${run.seed}  |  Duration: ${run.durationSec}`,
  ].join("   ·   ");
  doc.text(meta, M, 39);

  // ── ECL Summary box ──────────────────────────────────────────────────────────
  let y = 47;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(M, y, W - 2 * M, run.mode === "montecarlo" ? 28 : 20, 2, 2, "FD");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...SLATE);
  doc.text("PORTFOLIO ECL (P50)", M + 4, y + 7);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(`$${run.ecl.toFixed(1)}M`, M + 4, y + 17);

  if (run.mode === "montecarlo" && run.p5 != null && run.p95 != null) {
    const colW = (W - 2 * M) / 3;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SLATE);
    doc.text("P5 (DOWNSIDE)", M + colW + 4, y + 7);
    doc.text("P95 (SEVERE)", M + colW * 2 + 4, y + 7);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GREEN);
    doc.text(`$${run.p5.toFixed(1)}M`, M + colW + 4, y + 17);
    doc.setTextColor(...RED);
    doc.text(`$${run.p95.toFixed(1)}M`, M + colW * 2 + 4, y + 17);
  }
  y += run.mode === "montecarlo" ? 32 : 24;

  // ── Stage Distribution ────────────────────────────────────────────────────────
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("IFRS 9 Stage Distribution", M, y + 5);
  y += 7;

  autoTable(doc, {
    startY: y,
    head: [["Stage", "ECL ($M)", "% of Total"]],
    body: [
      ["Stage 1 — Performing",     `$${run.s1.toFixed(1)}M`, `${((run.s1 / run.ecl) * 100).toFixed(0)}%`],
      ["Stage 2 — Under-performing", `$${run.s2.toFixed(1)}M`, `${((run.s2 / run.ecl) * 100).toFixed(0)}%`],
      ["Stage 3 — Non-performing",  `$${run.s3.toFixed(1)}M`, `${((run.s3 / run.ecl) * 100).toFixed(0)}%`],
    ],
    styles:      { fontSize: 7.5, cellPadding: 2.5 },
    headStyles:  { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 7 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    margin:       { left: M, right: M },
    tableWidth:   "wrap",
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Shapley Attribution ──────────────────────────────────────────────────────
  if (run.shapley && run.shapley.length > 0) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Key ECL Drivers (Shapley Attribution)", M, y + 5);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [["Driver", "ECL Contribution", "Direction"]],
      body: run.shapley.map((s) => [
        s.driver,
        `${s.contribution > 0 ? "+" : ""}${s.contribution}%`,
        s.direction === "up" ? "↑ Upward (stress)" : "↓ Downward (relief)",
      ]),
      styles:      { fontSize: 7, cellPadding: 2 },
      headStyles:  { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 7 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "center" } },
      margin:       { left: M, right: M },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Top Stage 3 Lessees ──────────────────────────────────────────────────────
  if (run.topLessees && run.topLessees.length > 0) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(`Top Stage 3 Lessees (${run.s3LeaseCount} leases)`, M, y + 5);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [["Lessee", "Jurisdiction", "Estimated ECL ($M)"]],
      body: run.topLessees.map((l) => [l.name, l.jurisdiction, `$${l.ecl.toFixed(1)}M`]),
      styles:      { fontSize: 7, cellPadding: 2 },
      headStyles:  { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 7 },
      columnStyles: { 2: { halign: "right" } },
      margin:       { left: M, right: M },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Key Finding ───────────────────────────────────────────────────────────────
  if (run.keyFinding) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Key Finding", M, y + 5);
    y += 9;
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    const lines = doc.splitTextToSize(run.keyFinding, W - 2 * M - 8) as string[];
    const boxH = lines.length * 4.5 + 8;
    doc.roundedRect(M, y, W - 2 * M, boxH, 2, 2, "FD");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 64, 175);
    doc.text(lines, M + 4, y + 6);
    y += boxH + 4;
  }

  // ── Footer ────────────────────────────────────────────────────────────────────
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SLATE);
    doc.text(
      `Aeroinsights — Confidential  |  IFRS 9 ECL Scenario Analysis  |  Page ${p} of ${pageCount}`,
      W / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" },
    );
  }

  const safeName = run.name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 40);
  doc.save(`ecl-scenario-${safeName}-${run.id}.pdf`);
}
