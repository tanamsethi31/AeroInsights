/**
 * exportService.ts
 * Generates PDF (jsPDF + autotable) and XLSX (ExcelJS) exports for the
 * ExportSnapshotModal.  All data is self-contained static mock data that
 * mirrors the values shown in the live pages.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { fmtCurrency, type CurrencyCode } from "../contexts/CurrencyContext";
import type { PortfolioExportData } from "../lib/portfolioAdapters";
import { generateBoardPackSummary } from "./narrativeService";

// ─── Static data ───────────────────────────────────────────────────────────────

const ECL_ROWS = [
  { id: "LSE-2019-001", lessee: "IndiGo Airlines",        aircraft: "A320neo",    ead: 24.2, pd12m: 12.4, lgd: 54, ecl12m: 1.62, eclLT: 2.36,  stage: "3" },
  { id: "LSE-2020-014", lessee: "Aeromexico",             aircraft: "B737-800",   ead: 32.1, pd12m: 28.7, lgd: 61, ecl12m: 5.64, eclLT: 8.07,  stage: "3" },
  { id: "LSE-2021-022", lessee: "Emirates",               aircraft: "B777-300ER", ead: 88.4, pd12m: 0.3,  lgd: 28, ecl12m: 0.07, eclLT: 0.27,  stage: "1" },
  { id: "LSE-2020-031", lessee: "SriLankan Airlines",     aircraft: "A330-300",   ead: 34.2, pd12m: 4.2,  lgd: 48, ecl12m: 0.69, eclLT: 1.61,  stage: "2" },
  { id: "LSE-2022-009", lessee: "Ryanair",                aircraft: "B737 MAX 8", ead: 44.7, pd12m: 0.5,  lgd: 22, ecl12m: 0.05, eclLT: 0.18,  stage: "1" },
  { id: "LSE-2018-047", lessee: "Air France",             aircraft: "A350-900",   ead: 68.3, pd12m: 0.8,  lgd: 31, ecl12m: 0.17, eclLT: 0.51,  stage: "1" },
  { id: "LSE-2021-055", lessee: "Azul Brazilian Airlines",aircraft: "A320neo",    ead: 28.9, pd12m: 3.8,  lgd: 46, ecl12m: 0.51, eclLT: 1.12,  stage: "2" },
  { id: "LSE-2019-063", lessee: "Air Transat",            aircraft: "A321neo",    ead: 22.1, pd12m: 5.1,  lgd: 44, ecl12m: 0.50, eclLT: 1.09,  stage: "2" },
  { id: "LSE-2023-002", lessee: "Singapore Airlines",     aircraft: "A350-900",   ead: 92.0, pd12m: 0.2,  lgd: 26, ecl12m: 0.05, eclLT: 0.19,  stage: "1" },
  { id: "LSE-2022-018", lessee: "Lufthansa",              aircraft: "A220-300",   ead: 36.6, pd12m: 0.6,  lgd: 30, ecl12m: 0.07, eclLT: 0.22,  stage: "1" },
];

const LESSEES = [
  { name: "Emirates",               country: "UAE",        rating: "A-",   stage: "1", behavior: 94, leases: 8,  exposure: "$412M", daysLate: 0.2  },
  { name: "Ryanair",                country: "Ireland",    rating: "BBB+", stage: "1", behavior: 91, leases: 14, exposure: "$386M", daysLate: 0.5  },
  { name: "Singapore Airlines",     country: "Singapore",  rating: "A",    stage: "1", behavior: 97, leases: 6,  exposure: "$290M", daysLate: 0.1  },
  { name: "Air France",             country: "France",     rating: "BB+",  stage: "1", behavior: 86, leases: 9,  exposure: "$278M", daysLate: 1.2  },
  { name: "Lufthansa",              country: "Germany",    rating: "BBB-", stage: "1", behavior: 88, leases: 7,  exposure: "$194M", daysLate: 0.8  },
  { name: "Azul Brazilian Airlines",country: "Brazil",     rating: "B+",   stage: "2", behavior: 71, leases: 5,  exposure: "$142M", daysLate: 6.4  },
  { name: "Air Transat",            country: "Canada",     rating: "B",    stage: "2", behavior: 68, leases: 3,  exposure: "$96M",  daysLate: 8.1  },
  { name: "SriLankan Airlines",     country: "Sri Lanka",  rating: "B+",   stage: "2", behavior: 62, leases: 4,  exposure: "$118M", daysLate: 12.3 },
  { name: "IndiGo Airlines",        country: "India",      rating: "BB-",  stage: "3", behavior: 44, leases: 6,  exposure: "$184M", daysLate: 45.0 },
  { name: "Aeromexico",             country: "Mexico",     rating: "CCC",  stage: "3", behavior: 29, leases: 4,  exposure: "$122M", daysLate: 89.0 },
];

const AIRCRAFT = [
  { msn: "9218",  type: "A320neo",    reg: "VT-IYC", vintage: 2019, nbv: "$24.2M", mv: "$26.1M", mvAdj: "$25.4M", lessee: "IndiGo Airlines"     },
  { msn: "41234", type: "B737-800",   reg: "XA-AMX", vintage: 2020, nbv: "$32.1M", mv: "$28.8M", mvAdj: "$28.0M", lessee: "Aeromexico"           },
  { msn: "62047", type: "B777-300ER", reg: "A6-ECE", vintage: 2021, nbv: "$88.4M", mv: "$91.2M", mvAdj: "$90.5M", lessee: "Emirates"             },
  { msn: "1728",  type: "A330-300",   reg: "4R-ALB", vintage: 2015, nbv: "$34.2M", mv: "$29.1M", mvAdj: "$28.3M", lessee: "SriLankan Airlines"   },
  { msn: "67892", type: "B737 MAX 8", reg: "EI-HXP", vintage: 2022, nbv: "$44.7M", mv: "$47.3M", mvAdj: "$46.8M", lessee: "Ryanair"              },
  { msn: "0378",  type: "A350-900",   reg: "F-HTYR", vintage: 2018, nbv: "$68.3M", mv: "$72.8M", mvAdj: "$71.4M", lessee: "Air France"           },
];

const LEASES = [
  { id: "LSE-2019-001", lessee: "IndiGo Airlines",        aircraft: "A320neo",    msn: "9218",  start: "2019-03-01", end: "2028-03-01", rent: "$285,000",   stage: "3" },
  { id: "LSE-2020-014", lessee: "Aeromexico",             aircraft: "B737-800",   msn: "41234", start: "2020-06-15", end: "2027-06-15", rent: "$310,000",   stage: "3" },
  { id: "LSE-2021-022", lessee: "Emirates",               aircraft: "B777-300ER", msn: "62047", start: "2021-01-10", end: "2030-01-10", rent: "$1,240,000", stage: "1" },
  { id: "LSE-2020-031", lessee: "SriLankan Airlines",     aircraft: "A330-300",   msn: "1728",  start: "2020-09-01", end: "2026-09-01", rent: "$480,000",   stage: "2" },
  { id: "LSE-2022-009", lessee: "Ryanair",                aircraft: "B737 MAX 8", msn: "67892", start: "2022-04-15", end: "2032-04-15", rent: "$340,000",   stage: "1" },
  { id: "LSE-2018-047", lessee: "Air France",             aircraft: "A350-900",   msn: "0378",  start: "2018-07-20", end: "2028-07-20", rent: "$960,000",   stage: "1" },
  { id: "LSE-2021-055", lessee: "Azul Brazilian Airlines",aircraft: "A320neo",    msn: "10442", start: "2021-11-01", end: "2029-11-01", rent: "$295,000",   stage: "2" },
  { id: "LSE-2019-063", lessee: "Air Transat",            aircraft: "A321neo",    msn: "8841",  start: "2019-05-01", end: "2027-05-01", rent: "$275,000",   stage: "2" },
  { id: "LSE-2023-002", lessee: "Singapore Airlines",     aircraft: "A350-900",   msn: "0521",  start: "2023-02-01", end: "2033-02-01", rent: "$1,050,000", stage: "1" },
  { id: "LSE-2022-018", lessee: "Lufthansa",              aircraft: "A220-300",   msn: "55124", start: "2022-08-01", end: "2032-08-01", rent: "$220,000",   stage: "1" },
];

const ECL_TREND = [
  { quarter: "Q1 '25", s1: 7.1, s2: 18.4, s3: 14.2, total: 39.7 },
  { quarter: "Q2 '25", s1: 7.4, s2: 19.1, s3: 15.4, total: 41.9 },
  { quarter: "Q3 '25", s1: 7.8, s2: 19.8, s3: 15.1, total: 42.7 },
  { quarter: "Q4 '25", s1: 8.1, s2: 20.4, s3: 16.3, total: 44.8 },
  { quarter: "Q1 '26", s1: 8.4, s2: 21.6, s3: 17.2, total: 47.2 },
];

const SCENARIOS = [
  { scenario: "Base (60%)",    ecl12m: "$44.1M", eclLT: "$80.4M",  coverage: "1.52%" },
  { scenario: "Adverse (25%)", ecl12m: "$63.4M", eclLT: "$116.8M", coverage: "2.18%" },
  { scenario: "Upside (15%)",  ecl12m: "$29.8M", eclLT: "$54.2M",  coverage: "1.03%" },
  { scenario: "Weighted",      ecl12m: "$47.2M", eclLT: "$87.4M",  coverage: "1.62%" },
];

const JURISDICTIONS = [
  { country: "USA",       ctc: "Yes", score: 96, repoP50: 3,   successProb: "98%", sanctions: "None" },
  { country: "UK",        ctc: "Yes", score: 94, repoP50: 4,   successProb: "96%", sanctions: "None" },
  { country: "Germany",   ctc: "Yes", score: 91, repoP50: 5,   successProb: "95%", sanctions: "None" },
  { country: "Singapore", ctc: "Yes", score: 93, repoP50: 3,   successProb: "97%", sanctions: "None" },
  { country: "UAE",       ctc: "Yes", score: 89, repoP50: 5,   successProb: "92%", sanctions: "None" },
  { country: "Ireland",   ctc: "Yes", score: 92, repoP50: 4,   successProb: "94%", sanctions: "None" },
  { country: "France",    ctc: "Yes", score: 88, repoP50: 6,   successProb: "91%", sanctions: "None" },
  { country: "India",     ctc: "No",  score: 58, repoP50: 22,  successProb: "64%", sanctions: "None" },
  { country: "Brazil",    ctc: "No",  score: 52, repoP50: 28,  successProb: "58%", sanctions: "None" },
  { country: "Mexico",    ctc: "No",  score: 61, repoP50: 18,  successProb: "67%", sanctions: "None" },
  { country: "Sri Lanka", ctc: "No",  score: 41, repoP50: 36,  successProb: "44%", sanctions: "None" },
  { country: "Russia",    ctc: "No",  score: 14, repoP50: 999, successProb: "5%",  sanctions: "Full" },
];

// ─── Module data builder ───────────────────────────────────────────────────────

type ModuleRender = {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
};

function $m(n: number) { return `$${n.toFixed(1)}M`; }
function pct(n: number) { return `${n.toFixed(2)}%`; }

type LiveRows = {
  eclRows:    PortfolioExportData["eclRows"];
  lesseeRows: PortfolioExportData["lesseeRows"];
  acRows:     PortfolioExportData["aircraftRows"];
  leaseRows:  PortfolioExportData["leaseRows"];
};

function getModuleData(id: string, rows: LiveRows): ModuleRender | null {
  const { eclRows, lesseeRows, acRows, leaseRows } = rows;
  switch (id) {

    case "ecl_summary":
      return {
        title: "ECL Summary",
        subtitle: "Portfolio-level expected credit loss — reporting date Q1 2026",
        headers: ["Scenario", "12-Month ECL", "Lifetime ECL", "Coverage Ratio"],
        rows: SCENARIOS.map(s => [s.scenario, s.ecl12m, s.eclLT, s.coverage]),
      };

    case "stage_dist": {
      const s1 = eclRows.filter(r => r.stage === "1");
      const s2 = eclRows.filter(r => r.stage === "2");
      const s3 = eclRows.filter(r => r.stage === "3");
      const sum = (arr: typeof ECL_ROWS, k: "ead" | "ecl12m" | "eclLT") =>
        arr.reduce((a, r) => a + r[k], 0);
      const cov = (stage: typeof ECL_ROWS) =>
        pct((sum(stage, "ecl12m") / sum(stage, "ead")) * 100);
      return {
        title: "Stage Distribution",
        subtitle: "Lease count, EAD and ECL by IFRS 9 stage",
        headers: ["Stage", "Leases", "EAD ($M)", "ECL 12m ($M)", "ECL Lifetime ($M)", "Coverage"],
        rows: [
          ["Stage 1", s1.length, $m(sum(s1,"ead")), $m(sum(s1,"ecl12m")), $m(sum(s1,"eclLT")), cov(s1)],
          ["Stage 2", s2.length, $m(sum(s2,"ead")), $m(sum(s2,"ecl12m")), $m(sum(s2,"eclLT")), cov(s2)],
          ["Stage 3", s3.length, $m(sum(s3,"ead")), $m(sum(s3,"ecl12m")), $m(sum(s3,"eclLT")), cov(s3)],
          ["Total",   eclRows.length, $m(sum(eclRows,"ead")), $m(sum(eclRows,"ecl12m")), $m(sum(eclRows,"eclLT")), pct((sum(eclRows,"ecl12m")/sum(eclRows,"ead"))*100)],
        ],
      };
    }

    case "ecl_trend":
      return {
        title: "ECL Trend (6 Months)",
        subtitle: "Quarterly portfolio ECL by IFRS 9 stage ($M)",
        headers: ["Quarter", "Stage 1 ($M)", "Stage 2 ($M)", "Stage 3 ($M)", "Total ($M)"],
        rows: ECL_TREND.map(r => [r.quarter, r.s1, r.s2, r.s3, r.total]),
      };

    case "stage_migration":
      return {
        title: "Stage Migration Table",
        subtitle: "Lease count transitions between prior and current reporting period",
        headers: ["From \\ To", "Stage 1", "Stage 2", "Stage 3", "Total Out"],
        rows: [
          ["Stage 1",  87, 3, 0, 90],
          ["Stage 2",   1, 18, 2, 21],
          ["Stage 3",   0,  0, 9,  9],
          ["New",       4,  0, 0,  4],
          ["Total In", 92, 21, 11, 124],
        ],
      };

    case "book_value":
      return {
        title: "Portfolio Book Value",
        subtitle: "Aircraft net book value vs appraised market value",
        headers: ["MSN", "Type", "Reg", "Vintage", "NBV", "Market Value", "MV Adj", "Lessee"],
        rows: acRows.map(a => [a.msn, a.type, a.reg, a.vintage, a.nbv, a.mv, a.mvAdj, a.lessee]),
      };

    case "aircraft_mix": {
      const counts: Record<string, number> = {};
      acRows.forEach(a => { counts[a.type] = (counts[a.type] ?? 0) + 1; });
      const total = acRows.length;
      return {
        title: "Aircraft Mix",
        subtitle: "Fleet composition by aircraft type",
        headers: ["Aircraft Type", "Count", "% of Fleet"],
        rows: Object.entries(counts).map(([type, n]) => [type, n, pct((n / total) * 100)]),
      };
    }

    case "watchlist_headlines": {
      const at_risk = lesseeRows.filter(l => l.stage === "3");
      return {
        title: "Watchlist Headlines",
        subtitle: "Lessees classified Stage 3 (credit-impaired) — immediate attention required",
        headers: ["Lessee", "Country", "Rating", "Exposure", "Avg Days Late", "Behaviour Score"],
        rows: at_risk.map(l => [l.name, l.country, l.rating, l.exposure, l.daysLate != null ? `${l.daysLate}d` : "—", l.behavior ?? "—"]),
      };
    }

    case "watchlist_full":
      return {
        title: "Watchlist — Full Detail",
        subtitle: "All counterparties ranked by stage and behaviour score",
        headers: ["Lessee", "Country", "Rating", "Stage", "Behaviour", "Leases", "Exposure", "Avg Days Late"],
        rows: [...lesseeRows]
          .sort((a, b) => parseInt(b.stage) - parseInt(a.stage) || a.behavior - b.behavior)
          .map(l => [l.name, l.country, l.rating, `Stage ${l.stage}`, l.behavior ?? "—", l.leases, l.exposure, l.daysLate != null ? `${l.daysLate}d` : "—"]),
      };

    case "jurisdiction":
      return {
        title: "Jurisdiction Exposure",
        subtitle: "CTC treaty status, enforceability score and repossession timeline by country",
        headers: ["Country", "CTC Party", "Score /100", "P50 Repo (mo)", "Success Prob", "Sanctions"],
        rows: JURISDICTIONS.map(j => [
          j.country, j.ctc, j.score,
          j.repoP50 >= 999 ? "N/A" : j.repoP50,
          j.successProb, j.sanctions,
        ]),
      };

    case "insolvency": {
      const s3 = eclRows.filter(r => r.stage === "3");
      return {
        title: "Insolvency Risk Flags",
        subtitle: "Stage 3 leases — SICR trigger events and impairment metrics",
        headers: ["Lease ID", "Lessee", "Aircraft", "EAD ($M)", "PD 12m (%)", "LGD (%)", "ECL 12m ($M)", "ECL LT ($M)"],
        rows: s3.map(r => [r.id, r.lessee, r.aircraft, r.ead, r.pd12m, `${r.lgd}%`, r.ecl12m, r.eclLT]),
      };
    }

    case "scenario_comparison":
      return {
        title: "Scenario Comparison",
        subtitle: "Portfolio ECL under Base, Adverse and Upside macro-economic scenarios",
        headers: ["Scenario", "Weight", "12-Month ECL", "Lifetime ECL", "Coverage Ratio"],
        rows: [
          ["Base",    "60%", "$44.1M", "$80.4M",  "1.52%"],
          ["Adverse", "25%", "$63.4M", "$116.8M", "2.18%"],
          ["Upside",  "15%", "$29.8M", "$54.2M",  "1.03%"],
          ["Weighted","—",   "$47.2M", "$87.4M",  "1.62%"],
        ],
      };

    default:
      return null;
  }
}

// ─── Colour palette (shared between PDF helpers) ───────────────────────────────

const C = {
  navy:      [0,   33,  71 ] as [number, number, number],
  navyLight: [235, 242, 255] as [number, number, number],
  dark:      [15,  23,  42 ] as [number, number, number],
  muted:     [100, 116, 139] as [number, number, number],
  slate50:   [248, 250, 252] as [number, number, number],
  border:    [226, 232, 240] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
  slate400:  [148, 163, 184] as [number, number, number],
};

// ─── Currency-aware formatter for export use ──────────────────────────────────

function fe(usdMillions: number, currency: CurrencyCode): string {
  return fmtCurrency(usdMillions * 1_000_000, currency, true);
}

// ─── Named report generators — PDF ───────────────────────────────────────────

export async function generateReportPDF(
  reportId: string,
  currency: CurrencyCode,
  data?: PortfolioExportData,
  /** T-3.3 side-channel — fired before the local download with the file blob + filename. */
  onBlob?: (blob: Blob, filename: string) => void | Promise<void>,
  /** Auth0 bearer token — only used by the RPT-002 (Board Pack) narrative call. */
  token?: string,
): Promise<void> {
  const eclRows    = data?.eclRows      ?? ECL_ROWS;
  const lesseeRows = data?.lesseeRows   ?? LESSEES;
  const leaseRows  = data?.leaseRows    ?? LEASES;
  const acRows     = data?.aircraftRows ?? AIRCRAFT;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const date = new Date().toLocaleDateString("en-IE", { dateStyle: "long" });

  function addHeader(title: string, subtitle: string) {
    doc.setFillColor(0, 33, 71);
    doc.rect(0, 0, 210, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Aeroinsights", 14, 9);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(title, 14, 15);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(`Generated: ${date}  |  Currency: ${currency}`, 14, 28);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(subtitle, 14, 38);
  }

  function save(slug: string) {
    const filename = `aeroinsights-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
    if (onBlob) {
      try {
        // jsPDF returns a Blob when output("blob") is called; cast for TS.
        const blob = doc.output("blob") as Blob;
        // Fire-and-forget. Storage upload runs in parallel to the local download.
        Promise.resolve(onBlob(blob, filename)).catch(err =>
          console.warn("[generateReportPDF] onBlob failed:", err)
        );
      } catch (err) {
        console.warn("[generateReportPDF] blob extraction failed:", err);
      }
    }
    doc.save(filename);
  }

  switch (reportId) {
    case "RPT-001": {
      addHeader("Auditor Evidence Pack", "IFRS 9 Model Audit — ECL Disclosure");
      autoTable(doc, {
        startY: 45,
        head: [["Lease ID", "Lessee", "Aircraft", "EAD", "PD 12m", "LGD", "ECL 12m", "ECL LT", "Stage"]],
        body: eclRows.map(r => [
          r.id, r.lessee, r.aircraft,
          fe(r.ead, currency), `${r.pd12m}%`, `${r.lgd}%`,
          fe(r.ecl12m, currency), fe(r.eclLT, currency), `S${r.stage}`,
        ]),
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        headStyles: { fillColor: [0, 33, 71], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      save("auditor-evidence-pack");
      break;
    }
    case "RPT-002": {
      addHeader("Board Pack — Q1 2026", "Executive Portfolio Summary");

      const summaryData: PortfolioExportData = data ?? {
        eclRows: ECL_ROWS, leaseRows: LEASES, lesseeRows: LESSEES, aircraftRows: AIRCRAFT,
      };
      const summary = await generateBoardPackSummary(summaryData, token);

      let y = 45;
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Executive Summary", 14, y);
      y += 5;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      const summaryLines = doc.splitTextToSize(summary, 182) as string[];
      doc.text(summaryLines, 14, y);
      y += summaryLines.length * 4 + 6;

      autoTable(doc, {
        startY: y,
        head: [["Scenario", "ECL 12m", "ECL Lifetime", "Coverage"]],
        body: SCENARIOS.map(s => [s.scenario, s.ecl12m, s.eclLT, s.coverage]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [0, 33, 71], textColor: 255 },
      });
      save("board-pack");
      break;
    }
    case "RPT-003": {
      addHeader("Portfolio Register", "Full Lease Register");
      autoTable(doc, {
        startY: 45,
        head: [["Lease ID", "Lessee", "Aircraft", "MSN", "Start", "End", "Rent/mo", "Stage"]],
        body: leaseRows.map(l => [l.id, l.lessee, l.aircraft, l.msn, l.start, l.end, l.rent, `S${l.stage}`]),
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        headStyles: { fillColor: [0, 33, 71], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      save("portfolio-register");
      break;
    }
    case "RPT-004": {
      addHeader("ECL Disclosure Pack", "IFRS 9 §35H / §35I Disclosures");
      autoTable(doc, {
        startY: 45,
        head: [["Quarter", "Stage 1", "Stage 2", "Stage 3", "Total ECL"]],
        body: ECL_TREND.map(t => [
          t.quarter,
          fe(t.s1, currency), fe(t.s2, currency), fe(t.s3, currency), fe(t.total, currency),
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [0, 33, 71], textColor: 255 },
      });
      save("ecl-disclosure-pack");
      break;
    }
    case "RPT-005": {
      addHeader("Watchlist Report", "Red & Amber Lessees — Current Period");
      autoTable(doc, {
        startY: 45,
        head: [["Lessee", "Country", "Rating", "Stage", "Score", "Leases", "Exposure", "Avg Days Late"]],
        body: lesseeRows.filter(l => l.stage !== "1").map(l => [
          l.name, l.country, l.rating, `S${l.stage}`, l.behavior ?? "—", l.leases, l.exposure, l.daysLate ?? "—",
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [185, 28, 28], textColor: 255 },
        alternateRowStyles: { fillColor: [254, 242, 242] },
      });
      save("watchlist-report");
      break;
    }
    case "RPT-006": {
      addHeader("Jurisdiction Risk Summary", "CTC Compliance & Enforceability Index");
      autoTable(doc, {
        startY: 45,
        head: [["Country", "CTC", "Score", "Repo P50 (mo)", "Success Prob", "Sanctions"]],
        body: JURISDICTIONS.map(j => [j.country, j.ctc, j.score, j.repoP50, j.successProb, j.sanctions]),
        styles: { fontSize: 8.5, cellPadding: 3 },
        headStyles: { fillColor: [0, 33, 71], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      save("jurisdiction-risk-summary");
      break;
    }
    default:
      console.warn("Unknown reportId:", reportId);
  }
}

// ─── Named report generators — XLSX ──────────────────────────────────────────

export function generateReportXLSX(
  reportId: string,
  currency: CurrencyCode,
  data?: PortfolioExportData,
  /** T-3.3 side-channel — fired before the local download with the file blob + filename. */
  onBlob?: (blob: Blob, filename: string) => void | Promise<void>,
): void {
  const eclRows    = data?.eclRows      ?? ECL_ROWS;
  const lesseeRows = data?.lesseeRows   ?? LESSEES;
  const leaseRows  = data?.leaseRows    ?? LEASES;

  const wb = XLSX.utils.book_new();
  const meta = `Generated: ${new Date().toLocaleDateString("en-IE")} | Currency: ${currency}`;

  function addSheet(name: string, headers: string[], rows: (string | number)[][]) {
    const ws = XLSX.utils.aoa_to_sheet([[meta], [], headers, ...rows]);
    ws["!cols"] = headers.map((h, i) => ({
      wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i] ?? "").length)) + 3, 30),
    }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }

  switch (reportId) {
    case "RPT-001":
      addSheet("ECL Audit",
        ["Lease ID", "Lessee", "Aircraft", "EAD", "PD 12m %", "LGD %", "ECL 12m", "ECL LT", "Stage"],
        eclRows.map(r => [r.id, r.lessee, r.aircraft, fe(r.ead, currency), r.pd12m, r.lgd, fe(r.ecl12m, currency), fe(r.eclLT, currency), `S${r.stage}`])
      );
      break;
    case "RPT-002":
      addSheet("Board Pack",
        ["Scenario", "ECL 12m", "ECL Lifetime", "Coverage"],
        SCENARIOS.map(s => [s.scenario, s.ecl12m, s.eclLT, s.coverage])
      );
      break;
    case "RPT-003":
      addSheet("Lease Register",
        ["Lease ID", "Lessee", "Aircraft", "MSN", "Start", "End", "Monthly Rent", "Stage"],
        leaseRows.map(l => [l.id, l.lessee, l.aircraft, l.msn, l.start, l.end, l.rent, `S${l.stage}`])
      );
      break;
    case "RPT-004":
      addSheet("ECL Trend",
        ["Quarter", "Stage 1", "Stage 2", "Stage 3", "Total"],
        ECL_TREND.map(t => [t.quarter, fe(t.s1, currency), fe(t.s2, currency), fe(t.s3, currency), fe(t.total, currency)])
      );
      break;
    case "RPT-005":
      addSheet("Watchlist",
        ["Lessee", "Country", "Rating", "Stage", "Score", "Leases", "Exposure", "Avg Days Late"],
        lesseeRows.map(l => [l.name, l.country, l.rating, `S${l.stage}`, l.behavior ?? "—", l.leases, l.exposure, l.daysLate ?? "—"])
      );
      break;
    case "RPT-006":
      addSheet("Jurisdiction Risk",
        ["Country", "CTC", "Score", "Repo P50 (mo)", "Success Prob", "Sanctions"],
        JURISDICTIONS.map(j => [j.country, j.ctc, j.score, j.repoP50, j.successProb, j.sanctions])
      );
      break;
    default:
      console.warn("Unknown reportId:", reportId);
      return;
  }

  const filename = `aeroinsights-${reportId.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  if (onBlob) {
    try {
      const arrBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
      const blob   = new Blob([arrBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      Promise.resolve(onBlob(blob, filename)).catch(err =>
        console.warn("[generateReportXLSX] onBlob failed:", err)
      );
    } catch (err) {
      console.warn("[generateReportXLSX] blob extraction failed:", err);
    }
  }
  XLSX.writeFile(wb, filename);
}

// ─── PDF Export ────────────────────────────────────────────────────────────────

export function generatePDF(moduleIds: string[], presetLabel: string, data?: PortfolioExportData): void {
  const eclRows    = data?.eclRows      ?? ECL_ROWS;
  const lesseeRows = data?.lesseeRows   ?? LESSEES;
  const leaseRows  = data?.leaseRows    ?? LEASES;
  const acRows     = data?.aircraftRows ?? AIRCRAFT;
  const liveRows: LiveRows = { eclRows, lesseeRows, acRows, leaseRows };

  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W    = doc.internal.pageSize.getWidth();
  const H    = doc.internal.pageSize.getHeight();
  const LM   = 14;   // left margin
  const CW   = W - LM * 2; // content width

  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  // ── Page header helper (drawn per-page at the end) ─────────────────────────
  function drawPageBanner(pageNum: number, totalPages: number) {
    // Top navy bar
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, W, 22, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...C.white);
    doc.text("Aeroinsights", LM, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.slate400);
    doc.text("Decision Platform  ·  Export Snapshot", LM, 17);

    doc.setTextColor(...C.white);
    doc.setFontSize(7);
    doc.text(`${presetLabel}  ·  ${dateStr}`, W - LM, 11, { align: "right" });
    doc.text("CONFIDENTIAL", W - LM, 17, { align: "right" });

    // Bottom footer line
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.25);
    doc.line(LM, H - 11, W - LM, H - 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(
      "Aeroinsights Decision Platform  ·  Confidential  ·  Not for distribution",
      LM, H - 7
    );
    doc.text(`${pageNum} / ${totalPages}`, W - LM, H - 7, { align: "right" });
  }

  // ── Content ───────────────────────────────────────────────────────────────
  let y = 28; // start below the banner

  for (const moduleId of moduleIds) {
    const moduleData = getModuleData(moduleId, liveRows);
    if (!moduleData) continue;

    // Section header bar
    if (y > H - 45) { doc.addPage(); y = 28; }

    doc.setFillColor(...C.navyLight);
    doc.rect(LM, y, CW, 7.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.navy);
    doc.text(moduleData.title, LM + 3, y + 5.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(moduleData.subtitle, W - LM - 3, y + 5.2, { align: "right" });
    y += 9.5;

    autoTable(doc, {
      startY: y,
      head: [moduleData.headers],
      body: moduleData.rows as (string | number)[][],
      theme: "plain",
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        textColor: C.dark,
        lineColor: C.border,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: C.navy,
        textColor: C.white,
        fontStyle: "bold",
        fontSize: 7,
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      },
      alternateRowStyles: { fillColor: C.slate50 },
      margin: { left: LM, right: LM, top: 28, bottom: 16 },
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
  }

  // ── Draw banners + footers on every page ──────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawPageBanner(p, total);
  }

  const slug = presetLabel.toLowerCase().replace(/\s+/g, "-");
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`aeroinsights-${slug}-${date}.pdf`);
}

// ─── XLSX Export ───────────────────────────────────────────────────────────────

export function generateXLSX(moduleIds: string[], presetLabel: string, data?: PortfolioExportData): void {
  const eclRows    = data?.eclRows      ?? ECL_ROWS;
  const lesseeRows = data?.lesseeRows   ?? LESSEES;
  const leaseRows  = data?.leaseRows    ?? LEASES;
  const acRows     = data?.aircraftRows ?? AIRCRAFT;
  const liveRows: LiveRows = { eclRows, lesseeRows, acRows, leaseRows };

  const wb = XLSX.utils.book_new();

  // Meta sheet first
  const metaWs = XLSX.utils.aoa_to_sheet([
    ["Aeroinsights Decision Platform — Export Snapshot"],
    ["Preset",  presetLabel],
    ["Generated", new Date().toLocaleString("en-GB")],
    ["Classification", "Confidential"],
    [],
    ["Modules included", moduleIds.join(", ")],
  ]);
  metaWs["!cols"] = [{ wch: 22 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, metaWs, "Info");

  // One sheet per module
  for (const moduleId of moduleIds) {
    const moduleData = getModuleData(moduleId, liveRows);
    if (!moduleData) continue;

    const ws = XLSX.utils.aoa_to_sheet([
      // Subtitle row (row 1)
      [moduleData.subtitle],
      // Blank row
      [],
      // Header row
      moduleData.headers,
      // Data rows
      ...moduleData.rows,
    ]);

    // Set column widths from content
    ws["!cols"] = moduleData.headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...moduleData.rows.map(r => String(r[i] ?? "").length)
      );
      return { wch: Math.min(maxLen + 4, 32) };
    });

    // Sheet name: max 31 chars, no invalid characters
    const sheetName = moduleData.title.replace(/[/\\?*[\]:]/g, "").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const slug = presetLabel.toLowerCase().replace(/\s+/g, "-");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `aeroinsights-${slug}-${date}.xlsx`);
}

// ─── Convenience: generate the lease register as standalone XLSX ───────────────
// (used by the Portfolio page "Download" button if wired up later)
export function generateLeaseRegisterXLSX(): void {
  const wb   = XLSX.utils.book_new();
  const headers = ["Lease ID", "Lessee", "Aircraft", "MSN", "Start", "End", "Monthly Rent", "Stage"];
  const rows    = LEASES.map(l => [l.id, l.lessee, l.aircraft, l.msn, l.start, l.end, l.rent, `Stage ${l.stage}`]);
  const ws      = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"]   = headers.map((h, i) => ({
    wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i]).length)) + 3, 30),
  }));
  XLSX.utils.book_append_sheet(wb, ws, "Lease Register");
  XLSX.writeFile(wb, `aerinsights-lease-register-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
