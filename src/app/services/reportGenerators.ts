// src/app/services/reportGenerators.ts
// DOCX generation using the `docx` package (MIT licence, pure client-side).
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, WidthType, BorderStyle, ShadingType,
} from "docx";
import { fmtCurrency, type CurrencyCode } from "../contexts/CurrencyContext";
import type { PortfolioExportData } from "../lib/portfolioAdapters";
import type { RefObject } from "react";
import type { ScenarioInputs } from "../utils/eclCalculator";
import type { RollForwardLine } from "../utils/eclRollForward";
import type { CreditQualityRow } from "../utils/creditQualityMatrix";

export interface AuditorPackData {
  scenarioInputs: {
    base:    ScenarioInputs;
    adverse: ScenarioInputs;
    upside:  ScenarioInputs;
  };
  weights: { base: number; adverse: number; upside: number };
  weighted: { ecl12m: number; eclLifetime: number; coverage: number };
  scenarioSummary: {
    base:    { ecl12m: number; eclLifetime: number; coverage: number };
    adverse: { ecl12m: number; eclLifetime: number; coverage: number };
    upside:  { ecl12m: number; eclLifetime: number; coverage: number };
  };
  eclRows: Array<{
    id: string; lessee: string; aircraft: string;
    ead: number; pd12m: number; lgd: number;
    ecl12m: number; eclLT: number; stage: string;
  }>;
  sicrConfig: {
    dpdEnabled: boolean; dpdDays: number;
    upgradeEnabled: boolean; upgradeNotches: number;
    countryWatchlistEnabled: boolean;
    insolvencyEnabled: boolean;
  };
  managementOverlay: string;
  currency: CurrencyCode;
  rollForwardLines:  RollForwardLine[] | null;
  creditQualityRows: CreditQualityRow[];
  periodLabel:       string;
}

// ── Static data (same as exportService) ──────────────────────────────────────

const ECL_ROWS = [
  { id: "LSE-2019-001", lessee: "IndiGo Airlines",         aircraft: "A320neo",    ead: 24.2, pd12m: 12.4, lgd: 54, ecl12m: 1.62, eclLT: 2.36,  stage: "3" },
  { id: "LSE-2020-014", lessee: "Aeromexico",              aircraft: "B737-800",   ead: 32.1, pd12m: 28.7, lgd: 61, ecl12m: 5.64, eclLT: 8.07,  stage: "3" },
  { id: "LSE-2021-022", lessee: "Emirates",                aircraft: "B777-300ER", ead: 88.4, pd12m: 0.3,  lgd: 28, ecl12m: 0.07, eclLT: 0.27,  stage: "1" },
  { id: "LSE-2020-031", lessee: "SriLankan Airlines",      aircraft: "A330-300",   ead: 34.2, pd12m: 4.2,  lgd: 48, ecl12m: 0.69, eclLT: 1.61,  stage: "2" },
  { id: "LSE-2022-009", lessee: "Ryanair",                 aircraft: "B737 MAX 8", ead: 44.7, pd12m: 0.5,  lgd: 22, ecl12m: 0.05, eclLT: 0.18,  stage: "1" },
  { id: "LSE-2018-047", lessee: "Air France",              aircraft: "A350-900",   ead: 68.3, pd12m: 0.8,  lgd: 31, ecl12m: 0.17, eclLT: 0.51,  stage: "1" },
  { id: "LSE-2021-055", lessee: "Azul Brazilian Airlines", aircraft: "A320neo",    ead: 28.9, pd12m: 3.8,  lgd: 46, ecl12m: 0.51, eclLT: 1.12,  stage: "2" },
  { id: "LSE-2019-063", lessee: "Air Transat",             aircraft: "A321neo",    ead: 22.1, pd12m: 5.1,  lgd: 44, ecl12m: 0.50, eclLT: 1.09,  stage: "2" },
  { id: "LSE-2023-002", lessee: "Singapore Airlines",      aircraft: "A350-900",   ead: 92.0, pd12m: 0.2,  lgd: 26, ecl12m: 0.05, eclLT: 0.19,  stage: "1" },
  { id: "LSE-2022-018", lessee: "Lufthansa",               aircraft: "A220-300",   ead: 36.6, pd12m: 0.6,  lgd: 30, ecl12m: 0.07, eclLT: 0.22,  stage: "1" },
];

const LEASES = [
  { id: "LSE-2019-001", lessee: "IndiGo Airlines",         aircraft: "A320neo",    msn: "9218",  start: "2019-03-01", end: "2028-03-01", rent: "$285,000",   stage: "3" },
  { id: "LSE-2020-014", lessee: "Aeromexico",              aircraft: "B737-800",   msn: "41234", start: "2020-06-15", end: "2027-06-15", rent: "$310,000",   stage: "3" },
  { id: "LSE-2021-022", lessee: "Emirates",                aircraft: "B777-300ER", msn: "62047", start: "2021-01-10", end: "2030-01-10", rent: "$1,240,000", stage: "1" },
  { id: "LSE-2020-031", lessee: "SriLankan Airlines",      aircraft: "A330-300",   msn: "1728",  start: "2020-09-01", end: "2026-09-01", rent: "$480,000",   stage: "2" },
  { id: "LSE-2022-009", lessee: "Ryanair",                 aircraft: "B737 MAX 8", msn: "67892", start: "2022-04-15", end: "2032-04-15", rent: "$340,000",   stage: "1" },
  { id: "LSE-2018-047", lessee: "Air France",              aircraft: "A350-900",   msn: "0378",  start: "2018-07-20", end: "2028-07-20", rent: "$960,000",   stage: "1" },
  { id: "LSE-2021-055", lessee: "Azul Brazilian Airlines", aircraft: "A320neo",    msn: "10442", start: "2021-11-01", end: "2029-11-01", rent: "$295,000",   stage: "2" },
  { id: "LSE-2019-063", lessee: "Air Transat",             aircraft: "A321neo",    msn: "8841",  start: "2019-05-01", end: "2027-05-01", rent: "$275,000",   stage: "2" },
  { id: "LSE-2023-002", lessee: "Singapore Airlines",      aircraft: "A350-900",   msn: "0521",  start: "2023-02-01", end: "2033-02-01", rent: "$1,050,000", stage: "1" },
  { id: "LSE-2022-018", lessee: "Lufthansa",               aircraft: "A220-300",   msn: "55124", start: "2022-08-01", end: "2032-08-01", rent: "$220,000",   stage: "1" },
];

const LESSEES = [
  { name: "Emirates",                country: "UAE",       rating: "A-",   stage: "1", behavior: 94, leases: 8,  exposure: "$412M", daysLate: 0.2  },
  { name: "Ryanair",                 country: "Ireland",   rating: "BBB+", stage: "1", behavior: 91, leases: 14, exposure: "$386M", daysLate: 0.5  },
  { name: "Singapore Airlines",      country: "Singapore", rating: "A",    stage: "1", behavior: 97, leases: 6,  exposure: "$290M", daysLate: 0.1  },
  { name: "Air France",              country: "France",    rating: "BB+",  stage: "1", behavior: 86, leases: 9,  exposure: "$278M", daysLate: 1.2  },
  { name: "Lufthansa",               country: "Germany",   rating: "BBB-", stage: "1", behavior: 88, leases: 7,  exposure: "$194M", daysLate: 0.8  },
  { name: "Azul Brazilian Airlines", country: "Brazil",    rating: "B+",   stage: "2", behavior: 71, leases: 5,  exposure: "$142M", daysLate: 6.4  },
  { name: "Air Transat",             country: "Canada",    rating: "B",    stage: "2", behavior: 68, leases: 3,  exposure: "$96M",  daysLate: 8.1  },
  { name: "SriLankan Airlines",      country: "Sri Lanka", rating: "B+",   stage: "2", behavior: 62, leases: 4,  exposure: "$118M", daysLate: 12.3 },
  { name: "IndiGo Airlines",         country: "India",     rating: "BB-",  stage: "3", behavior: 44, leases: 6,  exposure: "$184M", daysLate: 45.0 },
  { name: "Aeromexico",              country: "Mexico",    rating: "CCC",  stage: "3", behavior: 29, leases: 4,  exposure: "$122M", daysLate: 89.0 },
];

const SCENARIOS = [
  { scenario: "Base (60%)",    ecl12m: "$44.1M", eclLT: "$80.4M",  coverage: "1.52%" },
  { scenario: "Adverse (25%)", ecl12m: "$63.4M", eclLT: "$116.8M", coverage: "2.18%" },
  { scenario: "Upside (15%)",  ecl12m: "$29.8M", eclLT: "$54.2M",  coverage: "1.03%" },
  { scenario: "Weighted",      ecl12m: "$47.2M", eclLT: "$87.4M",  coverage: "1.62%" },
];

const ECL_TREND = [
  { quarter: "Q1 '25", s1: 7.1, s2: 18.4, s3: 14.2, total: 39.7 },
  { quarter: "Q2 '25", s1: 7.4, s2: 19.1, s3: 15.4, total: 41.9 },
  { quarter: "Q3 '25", s1: 7.8, s2: 19.8, s3: 15.1, total: 42.7 },
  { quarter: "Q4 '25", s1: 8.1, s2: 20.4, s3: 16.3, total: 44.8 },
  { quarter: "Q1 '26", s1: 8.4, s2: 21.6, s3: 17.2, total: 47.2 },
];

const JURISDICTIONS = [
  { country: "USA",     ctc: "Yes", score: 96, repoP50: 3,  successProb: "98%", sanctions: "None" },
  { country: "UK",      ctc: "Yes", score: 94, repoP50: 4,  successProb: "96%", sanctions: "None" },
  { country: "Germany", ctc: "Yes", score: 91, repoP50: 5,  successProb: "95%", sanctions: "None" },
  { country: "Ireland", ctc: "Yes", score: 89, repoP50: 6,  successProb: "94%", sanctions: "None" },
  { country: "UAE",     ctc: "Yes", score: 85, repoP50: 8,  successProb: "90%", sanctions: "None" },
  { country: "India",   ctc: "No",  score: 62, repoP50: 24, successProb: "71%", sanctions: "None" },
  { country: "Mexico",  ctc: "No",  score: 58, repoP50: 28, successProb: "66%", sanctions: "None" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fe(usdMillions: number, currency: CurrencyCode): string {
  return fmtCurrency(usdMillions * 1_000_000, currency, true);
}

const CELL_BORDER = {
  top:    { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  left:   { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
  right:  { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
};

function makeHeaderRow(cells: string[]): TableRow {
  return new TableRow({
    children: cells.map(text =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })],
        })],
        shading: { type: ShadingType.CLEAR, fill: "002147" },
        borders: CELL_BORDER,
      })
    ),
  });
}

function makeDataRow(cells: string[], shade: boolean): TableRow {
  return new TableRow({
    children: cells.map(text =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text, size: 17 })],
        })],
        shading: { type: ShadingType.CLEAR, fill: shade ? "F8FAFC" : "FFFFFF" },
        borders: CELL_BORDER,
      })
    ),
  });
}

function makeTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      makeHeaderRow(headers),
      ...rows.map((r, i) => makeDataRow(r, i % 2 === 1)),
    ],
  });
}

function docPreamble(title: string, currency: CurrencyCode): Paragraph[] {
  const date = new Date().toLocaleDateString("en-IE", { dateStyle: "long" });
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Aeroinsights", bold: true, color: "002147" })],
    }),
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 26 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${date}  |  Currency: ${currency}`, size: 17, color: "64748B" })],
    }),
    new Paragraph({ text: "" }),
  ];
}

/**
 * Persist + download a DOCX. `onBlob` is a side-channel for T-3.3 — the
 * caller (a React component with hook context) uploads the blob to
 * Supabase Storage and inserts a report_exports row. The local browser
 * download still always runs.
 */
async function saveDocx(
  doc: Document,
  slug: string,
  onBlob?: (blob: Blob, filename: string) => void | Promise<void>,
): Promise<void> {
  const blob = await Packer.toBlob(doc);
  const filename = `aeroinsights-${slug}-${new Date().toISOString().slice(0, 10)}.docx`;
  // Fire the side-channel BEFORE the local download so persistence can't be
  // cancelled by the user closing the tab mid-click. Failures are swallowed
  // by the caller; we never block the local download.
  if (onBlob) {
    try { await onBlob(blob, filename); }
    catch (err) { console.warn("[saveDocx] onBlob failed:", err); }
  }
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement("a"), {
    href: url, download: filename,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Named DOCX generators ─────────────────────────────────────────────────────

export async function generateReportDOCX(
  reportId: string,
  currency: CurrencyCode,
  data?: PortfolioExportData,
  auditData?: AuditorPackData,
  /** Side-channel that uploads the blob to Storage + records audit. Optional. */
  onBlob?: (blob: Blob, filename: string) => void | Promise<void>,
): Promise<void> {
  const eclRows    = data?.eclRows    ?? ECL_ROWS;
  const lesseeRows = data?.lesseeRows ?? LESSEES;
  const leaseRows  = data?.leaseRows  ?? LEASES;

  let doc: Document;

  switch (reportId) {
    case "RPT-001": {
      if (!auditData) {
        console.warn("RPT-001: auditData required for full auditor pack");
        return;
      }

      const fmtPct = (n: number) => `${n.toFixed(2)}%`;
      const fmtAmt = (n: number) => fe(n, auditData.currency);
      const sc = auditData.sicrConfig;

      const METHODOLOGY = `Expected Credit Loss (ECL) is measured under IFRS 9 Financial Instruments using the three-stage impairment model. Stage 1 instruments carry a 12-month ECL allowance; Stage 2 and Stage 3 instruments carry a lifetime ECL allowance. Probability of Default (PD), Loss Given Default (LGD), and Exposure at Default (EAD) inputs are derived from lessee credit assessments, aircraft market valuations, and contractual cash flow schedules. Forward-looking information is incorporated through a minimum of three macro-economic scenarios (Baseline, Adverse, Upside) probability-weighted per IFRS 9 §B5.5.41. Significant Increase in Credit Risk (SICR) is assessed at each reporting date against the trigger framework documented in §7 of this pack.`;

      doc = new Document({
        sections: [{
          children: [
            ...docPreamble("Auditor Evidence Pack — IFRS 9 ECL Disclosure", auditData.currency),

            // §1 Methodology
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§1 — Methodology Statement", bold: true, color: "002147" })] }),
            new Paragraph({ children: [new TextRun({ text: METHODOLOGY, size: 18 })] }),
            new Paragraph({ text: "" }),

            // §2 Scenario Definitions
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§2 — Forward-Looking Scenario Definitions", bold: true, color: "002147" })] }),
            makeTable(
              ["Scenario (Weight)", "GDP Δ", "RPK Δ", "Fuel Δ", "Asset Value Δ", "PD Mult S2", "PD Mult S3"],
              [
                [`Baseline (${(auditData.weights.base * 100).toFixed(0)}%)`,
                  `${(auditData.scenarioInputs.base.gdpDelta * 100).toFixed(1)}%`,
                  `${(auditData.scenarioInputs.base.rpkDelta * 100).toFixed(1)}%`,
                  `${(auditData.scenarioInputs.base.fuelDelta * 100).toFixed(1)}%`,
                  `${(auditData.scenarioInputs.base.assetValueDelta * 100).toFixed(1)}%`,
                  `${auditData.scenarioInputs.base.pdS2Multi.toFixed(1)}×`,
                  `${auditData.scenarioInputs.base.pdS3Multi.toFixed(1)}×`,
                ],
                [`Adverse (${(auditData.weights.adverse * 100).toFixed(0)}%)`,
                  `${(auditData.scenarioInputs.adverse.gdpDelta * 100).toFixed(1)}%`,
                  `${(auditData.scenarioInputs.adverse.rpkDelta * 100).toFixed(1)}%`,
                  `${(auditData.scenarioInputs.adverse.fuelDelta * 100).toFixed(1)}%`,
                  `${(auditData.scenarioInputs.adverse.assetValueDelta * 100).toFixed(1)}%`,
                  `${auditData.scenarioInputs.adverse.pdS2Multi.toFixed(1)}×`,
                  `${auditData.scenarioInputs.adverse.pdS3Multi.toFixed(1)}×`,
                ],
                [`Upside (${(auditData.weights.upside * 100).toFixed(0)}%)`,
                  `${(auditData.scenarioInputs.upside.gdpDelta * 100).toFixed(1)}%`,
                  `${(auditData.scenarioInputs.upside.rpkDelta * 100).toFixed(1)}%`,
                  `${(auditData.scenarioInputs.upside.fuelDelta * 100).toFixed(1)}%`,
                  `${(auditData.scenarioInputs.upside.assetValueDelta * 100).toFixed(1)}%`,
                  `${auditData.scenarioInputs.upside.pdS2Multi.toFixed(1)}×`,
                  `${auditData.scenarioInputs.upside.pdS3Multi.toFixed(1)}×`,
                ],
              ]
            ),
            new Paragraph({ text: "" }),

            // §3 Weighted ECL
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§3 — Probability Weights & Weighted ECL", bold: true, color: "002147" })] }),
            makeTable(
              ["Scenario", "ECL 12-Month", "ECL Lifetime", "Coverage Ratio"],
              [
                [`Baseline (${(auditData.weights.base * 100).toFixed(0)}%)`,   fmtAmt(auditData.scenarioSummary.base.ecl12m),    fmtAmt(auditData.scenarioSummary.base.eclLifetime),    fmtPct(auditData.scenarioSummary.base.coverage)],
                [`Adverse (${(auditData.weights.adverse * 100).toFixed(0)}%)`, fmtAmt(auditData.scenarioSummary.adverse.ecl12m), fmtAmt(auditData.scenarioSummary.adverse.eclLifetime), fmtPct(auditData.scenarioSummary.adverse.coverage)],
                [`Upside (${(auditData.weights.upside * 100).toFixed(0)}%)`,   fmtAmt(auditData.scenarioSummary.upside.ecl12m),  fmtAmt(auditData.scenarioSummary.upside.eclLifetime),  fmtPct(auditData.scenarioSummary.upside.coverage)],
                ["Probability-Weighted",                    fmtAmt(auditData.weighted.ecl12m),               fmtAmt(auditData.weighted.eclLifetime),               fmtPct(auditData.weighted.coverage)],
              ]
            ),
            new Paragraph({ text: "" }),

            // §4 ECL by Lease
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§4 — ECL by Lease (Full Schedule)", bold: true, color: "002147" })] }),
            makeTable(
              ["Lease ID", "Lessee", "Aircraft", "EAD", "PD 12m", "LGD", "ECL 12m", "ECL Lifetime", "Stage"],
              auditData.eclRows.map((r) => [
                r.id, r.lessee, r.aircraft,
                fmtAmt(r.ead), `${r.pd12m}%`, `${r.lgd}%`,
                fmtAmt(r.ecl12m), fmtAmt(r.eclLT), `S${r.stage}`,
              ])
            ),
            new Paragraph({ text: "" }),

            // §5 IFRS 7 §35H Roll-Forward
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§5 — IFRS 7 §35H ECL Allowance Roll-Forward", bold: true, color: "002147" })] }),
            ...(auditData.rollForwardLines === null
              ? [new Paragraph({ children: [new TextRun({ text: "Opening period — no prior snapshot available.", size: 18, color: "64748B" })] })]
              : [makeTable(
                  ["Movement", "Stage 1", "Stage 2", "Stage 3", "Total"],
                  auditData.rollForwardLines.map(l => [
                    l.label,
                    fmtAmt(l.stage1), fmtAmt(l.stage2), fmtAmt(l.stage3), fmtAmt(l.total),
                  ])
                )]
            ),
            new Paragraph({ text: "" }),

            // §6 IFRS 7 §35I Credit Quality
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§6 — IFRS 7 §35I Credit Quality Distribution", bold: true, color: "002147" })] }),
            makeTable(
              ["Rating Grade", "Stage 1 EAD", "Stage 2 EAD", "Stage 3 EAD", "Total EAD", "% Portfolio"],
              auditData.creditQualityRows.map(r => [
                r.grade,
                fmtAmt(r.s1Ead), fmtAmt(r.s2Ead), fmtAmt(r.s3Ead), fmtAmt(r.totalEad),
                `${r.pctPortfolio.toFixed(1)}%`,
              ])
            ),
            new Paragraph({ text: "" }),

            // §7 SICR Configuration
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§7 — SICR Trigger Configuration", bold: true, color: "002147" })] }),
            makeTable(
              ["Trigger", "Status", "Threshold"],
              [
                ["30+ DPD Backstop",           sc.dpdEnabled ? "Active" : "Disabled",              sc.dpdEnabled ? `${sc.dpdDays} days` : "—"],
                ["Credit Downgrade Threshold", sc.upgradeEnabled ? "Active" : "Disabled",          sc.upgradeEnabled ? `${sc.upgradeNotches} notches` : "—"],
                ["Country Watchlist Event",    sc.countryWatchlistEnabled ? "Active" : "Disabled", "Automatic on watchlist flag"],
                ["Lessee Insolvency Filing",   sc.insolvencyEnabled ? "Active" : "Disabled",       "Automatic Stage 3"],
              ]
            ),
            new Paragraph({ text: "" }),

            // §8 Key Assumptions
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§8 — Key Assumptions & Management Overlays", bold: true, color: "002147" })] }),
            new Paragraph({ children: [new TextRun({ text: auditData.managementOverlay || "No management overlays documented for this period.", size: 18 })] }),
          ],
        }],
      });
      await saveDocx(doc, "auditor-evidence-pack", onBlob);
      break;
    }
    case "RPT-002": {
      doc = new Document({ sections: [{ children: [
        ...docPreamble("Board Pack — Q1 2026", currency),
        makeTable(
          ["Scenario", "ECL 12m", "ECL Lifetime", "Coverage"],
          SCENARIOS.map(s => [s.scenario, s.ecl12m, s.eclLT, s.coverage])
        ),
      ]}]});
      await saveDocx(doc, "board-pack", onBlob);
      break;
    }
    case "RPT-003": {
      doc = new Document({ sections: [{ children: [
        ...docPreamble("Portfolio Register — Full Lease Register", currency),
        makeTable(
          ["Lease ID", "Lessee", "Aircraft", "MSN", "Start", "End", "Rent/mo", "Stage"],
          leaseRows.map(l => [l.id, l.lessee, l.aircraft, l.msn, l.start, l.end, l.rent, `S${l.stage}`])
        ),
      ]}]});
      await saveDocx(doc, "portfolio-register", onBlob);
      break;
    }
    case "RPT-004": {
      doc = new Document({ sections: [{ children: [
        ...docPreamble("ECL Disclosure Pack — IFRS 9 §35H / §35I", currency),
        makeTable(
          ["Quarter", "Stage 1", "Stage 2", "Stage 3", "Total ECL"],
          ECL_TREND.map(t => [
            t.quarter,
            fe(t.s1, currency), fe(t.s2, currency), fe(t.s3, currency), fe(t.total, currency),
          ])
        ),
      ]}]});
      await saveDocx(doc, "ecl-disclosure-pack", onBlob);
      break;
    }
    case "RPT-005": {
      doc = new Document({ sections: [{ children: [
        ...docPreamble("Watchlist Report — Red & Amber Lessees", currency),
        makeTable(
          ["Lessee", "Country", "Rating", "Stage", "Score", "Leases", "Exposure", "Avg Days Late"],
          lesseeRows.map(l => [
            l.name, l.country, l.rating, `S${l.stage}`,
            String(l.behavior), String(l.leases), l.exposure, String(l.daysLate),
          ])
        ),
      ]}]});
      await saveDocx(doc, "watchlist-report", onBlob);
      break;
    }
    case "RPT-006": {
      doc = new Document({ sections: [{ children: [
        ...docPreamble("Jurisdiction Risk Summary", currency),
        makeTable(
          ["Country", "CTC", "Score", "Repo P50 (mo)", "Success Prob", "Sanctions"],
          JURISDICTIONS.map(j => [
            j.country, j.ctc, String(j.score), String(j.repoP50), j.successProb, j.sanctions,
          ])
        ),
      ]}]});
      await saveDocx(doc, "jurisdiction-risk-summary", onBlob);
      break;
    }
    default:
      console.warn("Unknown reportId:", reportId);
  }
}

// ── PDF Generator ─────────────────────────────────────────────────────────────
// Captures the preview div via html2canvas → jsPDF. Dynamic imports so the
// libraries are only loaded when the user actually clicks "Download PDF".

export async function generateReportPDF(
  previewRef: RefObject<HTMLDivElement>,
): Promise<void> {
  if (!previewRef.current) return;

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(previewRef.current, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    windowWidth: previewRef.current.scrollWidth,
    windowHeight: previewRef.current.scrollHeight,
  });

  const imgData  = canvas.toDataURL("image/png");
  const A4_W_MM  = 210;
  const A4_H_MM  = 297;
  const pdfWidth  = A4_W_MM;
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let remaining = pdfHeight;
  let yOffset   = 0;
  let isFirst   = true;

  while (remaining > 0) {
    if (!isFirst) pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, yOffset, pdfWidth, A4_H_MM);
    yOffset   -= A4_H_MM;
    remaining -= A4_H_MM;
    isFirst    = false;
  }

  const date = new Date().toISOString().slice(0, 10);
  pdf.save(`aeroinsights-auditor-evidence-pack-${date}.pdf`);
}
