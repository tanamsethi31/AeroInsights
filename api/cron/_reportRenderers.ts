// api/_lib/reportRenderers.ts
//
// T-5.2b — Pure server-side renderers for scheduled reports.
// Each takes the snapshot row set, returns { bytes, contentType, ext }.
// No DOM. No Node deps. Edge-runtime safe.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType } from "docx";
import ExcelJS from "exceljs";

export interface SnapshotRow {
  lease_external_id: string | null;
  lessee_name:       string;
  ead:               number | null;
  ecl_12m:           number | null;
  ecl_lifetime:      number | null;
  stage:             number | null;
}

export interface RenderedReport {
  bytes:       Uint8Array;
  contentType: string;
  ext:         "csv" | "pdf" | "docx" | "xlsx";
}

// ── CSV ──────────────────────────────────────────────────────────────

function csvQuote(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function renderSnapshotCsv(rows: SnapshotRow[]): RenderedReport {
  const lines: string[] = [];
  lines.push(["Lease ID", "Lessee", "EAD (USD)", "ECL 12M (USD)", "ECL Lifetime (USD)", "Stage"].join(","));
  for (const r of rows) {
    lines.push([
      csvQuote(r.lease_external_id),
      csvQuote(r.lessee_name),
      csvQuote(r.ead?.toFixed(2) ?? ""),
      csvQuote(r.ecl_12m?.toFixed(2) ?? ""),
      csvQuote(r.ecl_lifetime?.toFixed(2) ?? ""),
      csvQuote(r.stage ?? ""),
    ].join(","));
  }
  return {
    bytes:       new TextEncoder().encode(lines.join("\n")),
    contentType: "text/csv",
    ext:         "csv",
  };
}

// ── PDF (jsPDF + autotable) ──────────────────────────────────────────

export function renderSnapshotPdf(rows: SnapshotRow[], reportName: string): RenderedReport {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  // Header bar.
  doc.setFillColor(0, 33, 71);
  doc.rect(0, 0, 210, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Aeroinsights", 14, 9);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(reportName, 14, 15);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString("en-IE")}`, 14, 28);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Portfolio Snapshot", 14, 38);

  autoTable(doc, {
    startY: 45,
    head: [["Lease ID", "Lessee", "EAD", "ECL 12m", "ECL LT", "Stage"]],
    body: rows.map((r) => [
      r.lease_external_id ?? "",
      r.lessee_name,
      r.ead          != null ? `$${r.ead.toFixed(0)}`          : "",
      r.ecl_12m      != null ? `$${r.ecl_12m.toFixed(0)}`      : "",
      r.ecl_lifetime != null ? `$${r.ecl_lifetime.toFixed(0)}` : "",
      r.stage        != null ? `S${r.stage}`                   : "",
    ]),
    styles:     { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [0, 33, 71], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // jsPDF returns ArrayBuffer when output('arraybuffer').
  const buf = doc.output("arraybuffer") as ArrayBuffer;
  return {
    bytes:       new Uint8Array(buf),
    contentType: "application/pdf",
    ext:         "pdf",
  };
}

// ── DOCX (docx package) ──────────────────────────────────────────────

function makeDocxTable(headers: string[], body: string[][]): Table {
  const headerRow = new TableRow({
    children: headers.map((h) => new TableCell({
      width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
      shading: { fill: "002147" },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18 })] })],
    })),
  });
  const bodyRows = body.map((row, ri) => new TableRow({
    children: row.map((cell) => new TableCell({
      shading: ri % 2 === 0 ? undefined : { fill: "F8FAFC" },
      children: [new Paragraph({ children: [new TextRun({ text: cell, size: 18 })] })],
    })),
  }));
  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

export async function renderSnapshotDocx(rows: SnapshotRow[], reportName: string): Promise<RenderedReport> {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Aeroinsights", bold: true, color: "002147" })] }),
        new Paragraph({ children: [new TextRun({ text: reportName, size: 22, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `Generated: ${new Date().toLocaleString("en-IE")}`, size: 16, color: "64748B" })] }),
        new Paragraph({ text: "" }),
        makeDocxTable(
          ["Lease ID", "Lessee", "EAD", "ECL 12m", "ECL LT", "Stage"],
          rows.map((r) => [
            r.lease_external_id ?? "",
            r.lessee_name,
            r.ead          != null ? `$${r.ead.toFixed(0)}`          : "",
            r.ecl_12m      != null ? `$${r.ecl_12m.toFixed(0)}`      : "",
            r.ecl_lifetime != null ? `$${r.ecl_lifetime.toFixed(0)}` : "",
            r.stage        != null ? `S${r.stage}`                   : "",
          ]),
        ),
      ],
    }],
  });
  // Packer.toBlob and toBuffer both work; toBuffer returns a Buffer in
  // Node, Uint8Array shim in edge. Use Packer.toBlob then arrayBuffer
  // for portability.
  const blob = await Packer.toBlob(doc);
  const buf  = await blob.arrayBuffer();
  return {
    bytes:       new Uint8Array(buf),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext:         "docx",
  };
}

// ── XLSX (ExcelJS) ───────────────────────────────────────────────────

export async function renderSnapshotXlsx(rows: SnapshotRow[]): Promise<RenderedReport> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Portfolio Snapshot");

  ws.columns = [
    { header: "Lease ID",            key: "lease_id",    width: 18 },
    { header: "Lessee",              key: "lessee",      width: 28 },
    { header: "EAD (USD)",           key: "ead",         width: 14 },
    { header: "ECL 12M (USD)",       key: "ecl_12m",     width: 14 },
    { header: "ECL Lifetime (USD)",  key: "ecl_lt",      width: 16 },
    { header: "Stage",               key: "stage",       width: 8  },
  ];

  for (const r of rows) {
    ws.addRow([
      r.lease_external_id ?? "",
      r.lessee_name,
      r.ead          ?? "",
      r.ecl_12m      ?? "",
      r.ecl_lifetime ?? "",
      r.stage != null ? `S${r.stage}` : "",
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return {
    bytes:       new Uint8Array(buf as ArrayBuffer),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext:         "xlsx",
  };
}
