# Board Pack Section Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Board Pack's 8 section checkboxes actually control what appears in the generated PDF — each checked section renders real, portfolio-derived content; each unchecked section is omitted entirely.

**Architecture:** `generateReportPDF`'s `RPT-002` case becomes a sequence of `if (sectionEnabled(id)) { ...render... }` blocks, each advancing a shared `y` cursor (with a page-break guard, since up to 8 stacked sections will exceed one A4 page). Five sections reuse data already computed or adaptable from existing utilities (`kpis`, `keyDateRows`, `toPaymentSchedule`, `computePortfolioJurisdictionMix`, the existing RPT-005 watchlist filter); two sections (`ecl-summary`, `scenario`) replace fake hardcoded numbers with real computation via the existing `computeECLFromBase` engine.

**Tech Stack:** React 18 + TypeScript, jsPDF + jspdf-autotable, Vitest.

---

## Task 1: Move `DEFAULT_ADVERSE_INPUTS`/`DEFAULT_UPSIDE_INPUTS` to `eclCalculator.ts`

**Files:**
- Modify: `src/app/utils/eclCalculator.ts` (append near end of file)
- Modify: `src/app/pages/RiskECL.tsx:65-137` (imports + remove local copies)

- [ ] **Step 1: Append the two constants to `eclCalculator.ts`**

Add to the end of `src/app/utils/eclCalculator.ts` (after the existing `computeStages` function):

```ts

// Named presets for the two off-baseline forward-looking scenarios. Single
// source of truth — RiskECL.tsx's scenario editor and any report generator
// that needs a standard "Adverse" or "Upside" shock both import these,
// rather than each keeping their own copy that can silently drift apart.
export const DEFAULT_ADVERSE_INPUTS: ScenarioInputs = {
  gdpDelta: -0.02,
  rpkDelta: -0.25,
  fuelDelta: 0.30,
  fxDelta: 0,
  rateDelta: 0.01,
  assetValueDelta: -0.10,
  pdS2Multi: 1.5,
  pdS3Multi: 2.0,
  deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
  pbhConversionPct: 0, etpRate: 0, lecRate: 0,
  bankruptcyScenarioType: null, leaseAssumptionPct: 0,
  ctcGoldPct: 0, nonCtcPct: 0, repossWeightedMonths: 0,
  remarketingMonths: 0, lgdDecayAdjFactor: 0,
  depositCoverage: 0, maintenanceReserveCoverage: 0,
  payBehaviourCoopPct: 0, payBehaviourAdvPct: 0,
  restructuringType: null,
};

export const DEFAULT_UPSIDE_INPUTS: ScenarioInputs = {
  gdpDelta: 0.01,
  rpkDelta: 0.08,
  fuelDelta: -0.15,
  fxDelta: 0,
  rateDelta: -0.005,
  assetValueDelta: 0.05,
  pdS2Multi: 0.8,
  pdS3Multi: 0.8,
  deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
  pbhConversionPct: 0, etpRate: 0, lecRate: 0,
  bankruptcyScenarioType: null, leaseAssumptionPct: 0,
  ctcGoldPct: 0, nonCtcPct: 0, repossWeightedMonths: 0,
  remarketingMonths: 0, lgdDecayAdjFactor: 0,
  depositCoverage: 0, maintenanceReserveCoverage: 0,
  payBehaviourCoopPct: 0, payBehaviourAdvPct: 0,
  restructuringType: null,
};
```

- [ ] **Step 2: Remove the local copies from `RiskECL.tsx` and import from `eclCalculator.ts` instead**

In `src/app/pages/RiskECL.tsx`, change the import block at lines 65-70 from:

```ts
import {
  BASE_ECL,
  ZERO_INPUTS,
  computeECLFromBase,
  type ScenarioInputs,
} from "../utils/eclCalculator";
```

to:

```ts
import {
  BASE_ECL,
  ZERO_INPUTS,
  computeECLFromBase,
  DEFAULT_ADVERSE_INPUTS,
  DEFAULT_UPSIDE_INPUTS,
  type ScenarioInputs,
} from "../utils/eclCalculator";
```

Then delete the local constant definitions at lines 101-137 (the `const DEFAULT_ADVERSE_INPUTS: ScenarioInputs = { ... };` and `const DEFAULT_UPSIDE_INPUTS: ScenarioInputs = { ... };` blocks — everything from `const DEFAULT_ADVERSE_INPUTS` through the `};` that closes `DEFAULT_UPSIDE_INPUTS`). Leave `const DEFAULT_BASE_INPUTS: ScenarioInputs = ZERO_INPUTS;` at line 99 untouched — it's a local alias, not one of the two constants being moved, and nothing else in this task depends on it.

After deletion, lines 98-100 of the file should read exactly:

```ts
// Named defaults for the three forward-looking scenarios (used as initial state and reset targets)
const DEFAULT_BASE_INPUTS: ScenarioInputs = ZERO_INPUTS;

```

immediately followed by whatever comes after (originally line 139's `// Default SICR config` comment).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean — no errors. `RiskECL.tsx`'s three existing usages of `DEFAULT_ADVERSE_INPUTS`/`DEFAULT_UPSIDE_INPUTS` (lines 324-325, 892-893 in the original file — confirm via search rather than trusting these line numbers, they may shift slightly after the deletion) now resolve to the imported values instead of the deleted local ones, with identical content, so behavior is unchanged.

- [ ] **Step 4: Manual regression check**

This is a pure relocation with identical values — no behavior change expected. Confirm via `grep -n "DEFAULT_ADVERSE_INPUTS\|DEFAULT_UPSIDE_INPUTS" src/app/pages/RiskECL.tsx` that all remaining references are usages (not definitions) and the file has no leftover duplicate constant declarations.

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/eclCalculator.ts src/app/pages/RiskECL.tsx
git commit -m "refactor: move DEFAULT_ADVERSE_INPUTS/DEFAULT_UPSIDE_INPUTS to eclCalculator.ts

Single source of truth for the two standard off-baseline scenario
presets — RiskECL.tsx's scenario editor and the Board Pack's Scenario
Analysis section (next task) both need them; keeping two copies risks
silent drift."
```

---

## Task 2: `stageBreakdown()` — real Stage 1/2/3 ECL aggregate, with tests

**Files:**
- Modify: `src/app/services/exportService.ts` (add function near the top, after the `fe()` helper)
- Create: `src/app/services/exportService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/services/exportService.test.ts`:

```ts
// src/app/services/exportService.test.ts
import { describe, it, expect } from "vitest";
import { stageBreakdown } from "./exportService";
import type { PortfolioExportData } from "../lib/portfolioAdapters";

const SAMPLE_DATA: PortfolioExportData = {
  eclRows: [
    { id: "L1", lessee: "IndiGo Airlines", aircraft: "A320neo", ead: 24.2, pd12m: 12.4, lgd: 54, ecl12m: 1.62, eclLT: 2.36, stage: "3" },
    { id: "L2", lessee: "Emirates", aircraft: "B777-300ER", ead: 88.4, pd12m: 0.3, lgd: 28, ecl12m: 0.07, eclLT: 0.27, stage: "1" },
    { id: "L3", lessee: "SriLankan Airlines", aircraft: "A330-300", ead: 34.2, pd12m: 4.2, lgd: 48, ecl12m: 0.69, eclLT: 1.61, stage: "2" },
  ],
  leaseRows: [],
  lesseeRows: [],
  aircraftRows: [],
};

describe("stageBreakdown", () => {
  it("sums ecl12m grouped by stage", () => {
    const result = stageBreakdown(SAMPLE_DATA);
    expect(result.byStage["1"]).toBeCloseTo(0.07, 4);
    expect(result.byStage["2"]).toBeCloseTo(0.69, 4);
    expect(result.byStage["3"]).toBeCloseTo(1.62, 4);
  });

  it("computes total as the sum of all three stages", () => {
    const result = stageBreakdown(SAMPLE_DATA);
    expect(result.total).toBeCloseTo(1.62 + 0.07 + 0.69, 4);
  });

  it("computes coverage as total ECL over total book value (ead)", () => {
    const result = stageBreakdown(SAMPLE_DATA);
    const bookValue = 24.2 + 88.4 + 34.2;
    const expectedPct = ((1.62 + 0.07 + 0.69) / bookValue) * 100;
    expect(result.coveragePct).toBeCloseTo(expectedPct, 4);
  });

  it("returns zero coverage when book value is zero", () => {
    const result = stageBreakdown({ eclRows: [], leaseRows: [], lesseeRows: [], aircraftRows: [] });
    expect(result.coveragePct).toBe(0);
    expect(result.total).toBe(0);
    expect(result.byStage).toEqual({ "1": 0, "2": 0, "3": 0 });
  });

  it("ignores rows with a stage value outside 1/2/3", () => {
    const dataWithUnknownStage: PortfolioExportData = {
      ...SAMPLE_DATA,
      eclRows: [
        ...SAMPLE_DATA.eclRows,
        { id: "L4", lessee: "Unknown Co", aircraft: "A321", ead: 10, pd12m: 1, lgd: 30, ecl12m: 5, eclLT: 8, stage: "unknown" },
      ],
    };
    const result = stageBreakdown(dataWithUnknownStage);
    // The stray "unknown"-stage row's ecl12m (5) must not appear in any bucket or the total.
    expect(result.total).toBeCloseTo(1.62 + 0.07 + 0.69, 4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/services/exportService.test.ts`
Expected: FAIL — `stageBreakdown is not exported` (or similar — the function doesn't exist yet).

- [ ] **Step 3: Implement `stageBreakdown`**

In `src/app/services/exportService.ts`, add this function right after the existing `fe()` helper (the `function fe(usdMillions: number, currency: CurrencyCode): string { ... }` block, near the top of the "Named report generators" section):

```ts
// ─── Board Pack section aggregates ─────────────────────────────────────────────

export function stageBreakdown(data: PortfolioExportData): {
  byStage: Record<"1" | "2" | "3", number>;
  total: number;
  coveragePct: number;
} {
  const byStage: Record<"1" | "2" | "3", number> = { "1": 0, "2": 0, "3": 0 };
  for (const r of data.eclRows) {
    if (r.stage === "1" || r.stage === "2" || r.stage === "3") {
      byStage[r.stage] += r.ecl12m;
    }
  }
  const total = byStage["1"] + byStage["2"] + byStage["3"];
  const bookValue = data.eclRows.reduce((s, r) => s + r.ead, 0);
  const coveragePct = bookValue > 0 ? (total / bookValue) * 100 : 0;
  return { byStage, total, coveragePct };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/services/exportService.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/exportService.ts src/app/services/exportService.test.ts
git commit -m "feat: add stageBreakdown for real ECL Provision Summary data"
```

---

## Task 3: Wire all 8 sections into the `RPT-002` case

**Files:**
- Modify: `src/app/services/exportService.ts` (imports, `generateReportPDF` signature, `RPT-002` case body)

- [ ] **Step 1: Add new imports**

At the top of `src/app/services/exportService.ts`, add these imports (after the existing `import { generateBoardPackSummary } from "./narrativeService";` line):

```ts
import { computeECLFromBase, DEFAULT_ADVERSE_INPUTS, DEFAULT_UPSIDE_INPUTS } from "../utils/eclCalculator";
import type { DashboardKPIs } from "../lib/portfolioAdapters";
import type { KeyDateRow } from "../lib/keyDatesAdapters";
import type { PaymentSchedule } from "../lib/paymentAdapters";
import type { computePortfolioJurisdictionMix } from "../utils/jurisdictionRisk";
```

- [ ] **Step 2: Extend `generateReportPDF`'s signature with a `boardPackData` parameter**

Change the function signature (added `token?: string` in a prior pass — this task adds one more parameter after it) from:

```ts
export async function generateReportPDF(
  reportId: string,
  currency: CurrencyCode,
  data?: PortfolioExportData,
  /** T-3.3 side-channel — fired before the local download with the file blob + filename. */
  onBlob?: (blob: Blob, filename: string) => void | Promise<void>,
  /** Auth0 bearer token — only used by the RPT-002 (Board Pack) narrative call. */
  token?: string,
): Promise<void> {
```

to:

```ts
export async function generateReportPDF(
  reportId: string,
  currency: CurrencyCode,
  data?: PortfolioExportData,
  /** T-3.3 side-channel — fired before the local download with the file blob + filename. */
  onBlob?: (blob: Blob, filename: string) => void | Promise<void>,
  /** Auth0 bearer token — only used by the RPT-002 (Board Pack) narrative call. */
  token?: string,
  /**
   * RPT-002 (Board Pack) only. Which of the 8 SECTIONS checkboxes are on
   * (keyed by the same ids as BoardPackModal.tsx's SECTIONS array) — a
   * missing key defaults to shown, so a caller that omits this argument
   * entirely (e.g. any future non-modal caller) still gets the full report.
   * Also carries the pre-computed, hook-derived data (KPIs, key dates,
   * payment schedule, jurisdiction mix) that this file has no way to fetch
   * itself — BoardPackModal.tsx already has the hooks and raw domain data,
   * so it computes these and passes the results down, the same way it
   * already does for `data`.
   */
  sections?: Record<string, boolean>,
  boardPackData?: {
    kpis: DashboardKPIs;
    keyDateRows: KeyDateRow[];
    paymentSchedule: PaymentSchedule;
    jurisdictionMix: ReturnType<typeof computePortfolioJurisdictionMix>;
  },
): Promise<void> {
```

- [ ] **Step 3: Replace the `RPT-002` case body**

Replace the existing `case "RPT-002":` block:

```ts
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
```

with:

```ts
    case "RPT-002": {
      addHeader("Board Pack — Q1 2026", "Executive Portfolio Summary");

      const summaryData: PortfolioExportData = data ?? {
        eclRows: ECL_ROWS, leaseRows: LEASES, lesseeRows: LESSEES, aircraftRows: AIRCRAFT,
      };
      const on = (id: string) => sections?.[id] !== false;
      const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
      // Note on `on(id) && boardPackData` below: `on()` alone defaults a
      // section to shown when `sections` is omitted, but 4 of the 8
      // sections (kpi-dashboard, key-dates, payment-sched, jurisdiction)
      // have no fallback data source without `boardPackData` — there's
      // nothing in `summaryData` to build a KPI dashboard, payment
      // schedule, or jurisdiction table from. So those 4 sections require
      // both `on(id)` AND `boardPackData` truthy; they're silently omitted
      // if a caller provides `sections` without `boardPackData` (today the
      // only caller, BoardPackModal.tsx, always provides both together).

      let y = 45;

      // Page-break guard — 8 stacked sections realistically exceed one A4
      // page (each section is independently 1-3 pages per the modal's own
      // page estimates). Call before starting a new section's content.
      function ensureSpace(minHeight: number) {
        if (y + minHeight > 280) {
          doc.addPage();
          y = 20;
        }
      }

      function sectionHeading(title: string) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(title, 14, y);
        y += 5;
      }

      // ── Executive Summary ────────────────────────────────────────────────
      if (on("exec-summary")) {
        ensureSpace(20);
        const summary = await generateBoardPackSummary(summaryData, token);
        sectionHeading("Executive Summary");
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        const summaryLines = doc.splitTextToSize(summary, 182) as string[];
        doc.text(summaryLines, 14, y);
        y += summaryLines.length * 4 + 6;
      }

      // ── KPI Dashboard ─────────────────────────────────────────────────────
      if (on("kpi-dashboard") && boardPackData) {
        ensureSpace(30);
        const k = boardPackData.kpis;
        sectionHeading("KPI Dashboard");
        autoTable(doc, {
          startY: y,
          head: [["Fleet", "Total ECL", "Watchlist (Red/Amber)", "Stage 3 Leases"]],
          body: [[
            `${k.fleetCount} aircraft`,
            fe(k.totalECLm, currency),
            `${k.watchlistRedCount} / ${k.watchlistAmberCount}`,
            `${k.stage3Count}`,
          ]],
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [0, 33, 71], textColor: 255 },
        });
        y = lastY() + 6;
      }

      // ── Watchlist Highlights ──────────────────────────────────────────────
      if (on("watchlist")) {
        ensureSpace(30);
        sectionHeading("Watchlist Highlights");
        autoTable(doc, {
          startY: y,
          head: [["Lessee", "Country", "Rating", "Stage", "Score", "Leases", "Exposure", "Avg Days Late"]],
          body: summaryData.lesseeRows.filter(l => l.stage !== "1").map(l => [
            l.name, l.country, l.rating, `S${l.stage}`, l.behavior ?? "—", l.leases, l.exposure, l.daysLate ?? "—",
          ]),
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [185, 28, 28], textColor: 255 },
          alternateRowStyles: { fillColor: [254, 242, 242] },
        });
        y = lastY() + 6;
      }

      // ── ECL Provision Summary (real Stage 1/2/3 breakdown) ────────────────
      if (on("ecl-summary")) {
        ensureSpace(30);
        const { byStage, total, coveragePct } = stageBreakdown(summaryData);
        sectionHeading("ECL Provision Summary");
        autoTable(doc, {
          startY: y,
          head: [["Stage", "12m ECL"]],
          body: [
            ["Stage 1", fe(byStage["1"], currency)],
            ["Stage 2", fe(byStage["2"], currency)],
            ["Stage 3", fe(byStage["3"], currency)],
            ["Total", fe(total, currency)],
          ],
          foot: [["Coverage", `${coveragePct.toFixed(2)}%`]],
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [0, 33, 71], textColor: 255 },
          footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
        });
        y = lastY() + 6;
      }

      // ── Upcoming Expirations ──────────────────────────────────────────────
      if (on("key-dates") && boardPackData) {
        ensureSpace(30);
        const rows = boardPackData.keyDateRows.filter(r => r.urgency !== "long");
        sectionHeading("Upcoming Expirations");
        autoTable(doc, {
          startY: y,
          head: [["Lessee", "Aircraft", "Expiry", "Days", "Urgency"]],
          body: rows.map(r => [r.lessee, r.aircraft, r.expiryDate, `${r.daysRemaining}`, r.urgency]),
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [180, 83, 9], textColor: 255 },
          alternateRowStyles: { fillColor: [255, 251, 235] },
        });
        y = lastY() + 6;
      }

      // ── Payment Schedule (12-month forward rent roll) ─────────────────────
      if (on("payment-sched") && boardPackData) {
        ensureSpace(30);
        const sched = boardPackData.paymentSchedule;
        sectionHeading("Payment Schedule — 12-Month Forward Rent Roll");
        autoTable(doc, {
          startY: y,
          head: [sched.months],
          // monthlyTotals/grandTotal are raw USD (from lease.monthly_rental),
          // NOT millions — use fmtCurrency directly, not fe() (which expects
          // a millions-scaled input, unlike every other table in this file).
          body: [sched.monthlyTotals.map(t => fmtCurrency(t, currency, true))],
          foot: [[`Total: ${fmtCurrency(sched.grandTotal, currency, true)}`, ...Array(sched.months.length - 1).fill("")]],
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: [0, 33, 71], textColor: 255 },
        });
        y = lastY() + 6;
      }

      // ── Scenario Analysis (real Base/Adverse/Upside) ───────────────────────
      if (on("scenario")) {
        ensureSpace(30);
        const baseline = boardPackData?.kpis.totalECLm ?? summaryData.eclRows.reduce((s, r) => s + r.ecl12m, 0);
        const adverse = computeECLFromBase(baseline, DEFAULT_ADVERSE_INPUTS);
        const upside = computeECLFromBase(baseline, DEFAULT_UPSIDE_INPUTS);
        // Standard 60/25/15 weighting — matches what the old static table
        // already showed; not pulled from the tenant's live persisted
        // Settings weights (see spec's Scope Boundary).
        const weighted = baseline * 0.60 + adverse * 0.25 + upside * 0.15;
        sectionHeading("Scenario Analysis");
        autoTable(doc, {
          startY: y,
          head: [["Scenario", "12m ECL"]],
          body: [
            ["Base (60%)", fe(baseline, currency)],
            ["Adverse (25%)", fe(adverse, currency)],
            ["Upside (15%)", fe(upside, currency)],
            ["Weighted", fe(weighted, currency)],
          ],
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [0, 33, 71], textColor: 255 },
        });
        y = lastY() + 6;
      }

      // ── Jurisdiction Risk ─────────────────────────────────────────────────
      if (on("jurisdiction") && boardPackData) {
        ensureSpace(30);
        const rows = boardPackData.jurisdictionMix.rows;
        sectionHeading("Jurisdiction Risk");
        autoTable(doc, {
          startY: y,
          head: [["Lessee", "Country", "CTC Tier", "CTC Score", "Repo P50 (mo)", "Fleet Weight"]],
          body: rows.map(r => [
            r.lesseeName, r.country, r.tier, `${r.ctcScore}`, `${r.repossP50}`, `${(r.weightPct * 100).toFixed(1)}%`,
          ]),
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [0, 33, 71], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        y = lastY() + 6;
      }

      save("board-pack");
      break;
    }
```

Note: `SCENARIOS` (the old hardcoded array) is no longer referenced by this case — leave its definition in the file (it's still unused-but-harmless; removing it is out of scope for this task, since confirming nothing else references it requires a repo-wide check not needed for this feature to work correctly).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors at `BoardPackModal.tsx`'s call to `generateReportPDF` (it doesn't yet pass `sections`/`boardPackData` — fixed in Task 4) — confirm the errors are exactly there and nowhere else in `exportService.ts` itself (that file should be internally consistent).

- [ ] **Step 5: Commit**

```bash
git add src/app/services/exportService.ts
git commit -m "feat: wire all 8 Board Pack sections into RPT-002 generator"
```

(This commit will not typecheck cleanly in isolation — `BoardPackModal.tsx` is fixed in Task 4. Expected, matching the same intermediate-checkpoint pattern used in the prior pass.)

---

## Task 4: Compute and thread `sections`/`boardPackData` from `BoardPackModal.tsx`

**Files:**
- Modify: `src/app/components/reports/BoardPackModal.tsx`

- [ ] **Step 1: Add the new imports**

At the top of `src/app/components/reports/BoardPackModal.tsx`, add these two imports (after the existing `import { toKeyDateRows } from "../../lib/keyDatesAdapters";` line):

```ts
import { toPaymentSchedule } from "../../lib/paymentAdapters";
import { computePortfolioJurisdictionMix } from "../../utils/jurisdictionRisk";
import { useJurisdictions } from "../../hooks/useJurisdictions";
```

- [ ] **Step 2: Compute `paymentSchedule` and `jurisdictionMix`**

Inside the `BoardPackModal` component function, add these two computations right after the existing `keyDateRows`/`urgentCount` block (after line 65's `).length;`):

```ts
  const paymentSchedule = toPaymentSchedule(leases, assets, lessees);
  const { jurisdictions } = useJurisdictions();
  const jurisdictionMix = computePortfolioJurisdictionMix(lessees, leases, jurisdictions);
```

- [ ] **Step 3: Build the `boardPackData` bundle and update `handleDownload`**

Add this right after the `paymentSchedule`/`jurisdictionMix` computations from Step 2:

```ts
  const boardPackData = { kpis, keyDateRows, paymentSchedule, jurisdictionMix };
```

Then update `handleDownload` (currently):

```ts
  async function handleDownload() {
    setDownloading(true);
    try {
      if (format === "pdf") {
        let token: string | undefined;
        try { token = await getAccessTokenSilently(); } catch { /* falls back to deterministic summary */ }
        await generateReportPDF(reportId, currency, exportData, makeOnBlob("pdf"), token);
      }
      if (format === "xlsx") await generateReportXLSX(reportId, currency, exportData, makeOnBlob("xlsx"));
      setDone(true);
      setTimeout(onClose, 1200);
    } finally {
      setDownloading(false);
    }
  }
```

to:

```ts
  async function handleDownload() {
    setDownloading(true);
    try {
      if (format === "pdf") {
        let token: string | undefined;
        try { token = await getAccessTokenSilently(); } catch { /* falls back to deterministic summary */ }
        await generateReportPDF(reportId, currency, exportData, makeOnBlob("pdf"), token, selected, boardPackData);
      }
      if (format === "xlsx") await generateReportXLSX(reportId, currency, exportData, makeOnBlob("xlsx"));
      setDone(true);
      setTimeout(onClose, 1200);
    } finally {
      setDownloading(false);
    }
  }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean — no errors. This resolves Task 3 Step 4's expected intermediate failure.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing tests plus the 5 new tests from Task 2.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/reports/BoardPackModal.tsx
git commit -m "feat: thread section selection and computed data into Board Pack PDF"
```

---

## Task 5: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: All sections checked (default state)**

Download a Board Pack PDF with all 8 checkboxes on (the default). Confirm all 8 sections appear, in the order listed in `SECTIONS`, with no visual overlap between sections (each section's table doesn't run into the next section's heading).

- [ ] **Step 2: Individual section toggling**

Uncheck exactly one section at a time (8 separate downloads, or a representative sample — at minimum `kpi-dashboard`, `payment-sched`, and `jurisdiction`, since those three depend on the new `boardPackData` bundle rather than data already present in `summaryData`). Confirm the unchecked section is completely absent and the following sections shift up to fill the gap (no blank space left behind).

- [ ] **Step 3: All sections unchecked**

Attempt to uncheck all 8 (note: the modal's own "Next: Choose Format" button is disabled when `selectedCount === 0`, so this may not be reachable via the UI — if so, this step is a no-op confirmation that the existing disabled-button guard still works, not a new PDF-generation check).

- [ ] **Step 4: Verify real numbers, not fake ones**

For **ECL Provision Summary**: confirm the Stage 1/2/3 figures shown sum to the same "Total ECL" shown elsewhere in the app for the same portfolio (e.g. the Dashboard KPI strip or Risk & ECL page), not the old static values ($44.1M / $63.4M / $29.8M / $47.2M from the removed `SCENARIOS` array).

For **Scenario Analysis**: confirm the "Base" row matches the real portfolio's current total ECL (same number as ECL Provision Summary's "Total" row), and that Adverse/Upside are different from Base (proving they're computed, not copied).

- [ ] **Step 5: Verify page breaks**

With all 8 sections on, confirm the PDF has multiple pages (given the section count and content volume) and no section's heading or table is visually cut off at a page boundary.

- [ ] **Step 6: Verify other reports unaffected**

Download RPT-001, RPT-003, RPT-004, RPT-005, RPT-006. Confirm no change from their pre-this-plan behavior — this task only touches the `RPT-002` case.

- [ ] **Step 7: Verify `RiskECL.tsx` regression**

Navigate to Risk & ECL → ECL Overview tab. Confirm the "Adverse / Downside" and "Upside" scenario editors still show the same default values as before this plan (the constants were moved, not changed) — e.g. Adverse's GDP Delta should still default to -2%, RPK Delta to -25%, etc.
