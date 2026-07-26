# Board Pack Section Wiring

**Goal:** Make the Board Pack's 8 section checkboxes (`BoardPackModal.tsx`'s `SECTIONS` array) actually control what appears in the generated PDF, instead of the generator always producing the same fixed content regardless of what's checked.

**Context:** Pass 1 ("Prove It's Real") wired a real AI-generated Executive Summary into the Board Pack PDF, but that was scoped narrowly — the other 7 sections were left as pure UI, disconnected from `generateReportPDF`'s `RPT-002` case, which always renders the same hardcoded 4-row scenario table regardless of selection. The user hit this exact gap during their own manual verification of Pass 1. This spec closes it.

While investigating, found that the scenario table both "ECL Provision Summary" and "Scenario Analysis" point to (`SCENARIOS`, a hardcoded static array in `exportService.ts`) is itself fake — not computed from the real portfolio. Per user direction, this pass also makes those two sections genuinely real and distinct from each other, not just gated.

---

## Mechanism

`BoardPackModal.tsx` already tracks `selected: Record<string, boolean>` (the checkbox state) — it's just never left the component today. `generateReportPDF` gains a new optional 6th parameter, `sections?: Record<string, boolean>`. Inside the `RPT-002` case, each section becomes a sequential `if (sections?.[id] !== false) { ...render... }` block (default-on when `sections` is omitted entirely, so RPT-002 called without a `sections` arg — e.g. from a future automated/scheduled export — still produces the full report), each advancing a running `y` cursor before the next block, exactly mirroring the Executive Summary pattern from Pass 1. Unchecked sections are omitted from the PDF outright, not rendered-then-hidden.

`BoardPackModal.tsx` passes `sections={selected}` into `generateReportPDF(...)`.

Exact section IDs (from `BoardPackModal.tsx`'s `SECTIONS` array — these are the literal keys `sections[id]` is checked against):

| ID | Label (this doc's section #) |
|---|---|
| `exec-summary` | Executive Summary (§1) |
| `kpi-dashboard` | KPI Dashboard (§2) |
| `watchlist` | Watchlist Highlights (§3) |
| `ecl-summary` | ECL Provision Summary (§4) |
| `key-dates` | Upcoming Expirations (§5) |
| `payment-sched` | Payment Schedule (§6) |
| `scenario` | Scenario Analysis (§7) |
| `jurisdiction` | Jurisdiction Risk (§8) |

---

## Per-section data sourcing

### 1. Executive Summary — no change
Already wired in Pass 1 via `generateBoardPackSummary`. Untouched by this pass except becoming conditionally gated like the others (currently unconditional).

### 2. KPI Dashboard
`kpis` (`toDashboardKPIs(assets, lessees, provisions)`) is already computed in `BoardPackModal.tsx:59` — currently used only for the modal's own step-1 preview strip (`Fleet`, `ECL`, `Watchlist`, `Expirations` at lines 204-207), never passed to the PDF. Thread `kpis` through as a new argument.

Render: a compact stat block (label/value pairs, similar visual weight to the Executive Summary heading) — Fleet Count, Total ECL ($M), Watchlist (Red/Amber counts), Stage 3 Count.

### 3. Watchlist Highlights
Identical data + table to the existing standalone `RPT-005` case (`exportService.ts`, `lesseeRows.filter(l => l.stage !== "1")`, same columns: Lessee, Country, Rating, Stage, Score, Leases, Exposure, Avg Days Late, same red header styling `fillColor: [185, 28, 28]`). Reuse the exact `autoTable` config, just with a `startY: y` instead of the hardcoded `45`.

### 4. ECL Provision Summary (real, split from Scenario Analysis per user decision)
New aggregate, computed from `summaryData.eclRows` (the same `PortfolioExportData` already built for the Executive Summary call): sum `ecl12m` grouped by `stage` ("1"/"2"/"3"), plus total and coverage % (`totalEcl / bookValue`, same `bookValueM` computation pattern as `boardPackAggregates` in `narrativeService.ts`).

```ts
function stageBreakdown(data: PortfolioExportData) {
  const byStage = { "1": 0, "2": 0, "3": 0 } as Record<"1" | "2" | "3", number>;
  for (const r of data.eclRows) {
    const s = (r.stage as "1" | "2" | "3");
    if (s in byStage) byStage[s] += r.ecl12m;
  }
  const total = byStage["1"] + byStage["2"] + byStage["3"];
  const bookValue = data.eclRows.reduce((s, r) => s + r.ead, 0);
  const coveragePct = bookValue > 0 ? (total / bookValue) * 100 : 0;
  return { byStage, total, coveragePct };
}
```

Render: a small table (Stage 1 / Stage 2 / Stage 3 / Total ECL rows, with a Coverage % footer line) — new `autoTable` call, navy header styling matching the file's default (`fillColor: [0, 33, 71]`).

### 5. Upcoming Expirations
`keyDateRows` (`toKeyDateRows(leases, assets, lessees)`) is already computed in `BoardPackModal.tsx:60` — currently used only for `urgentCount` in the preview strip. Thread `keyDateRows` through, filter to `r.urgency !== "long"` (matches the existing `urgentCount` filter already in the component).

Render: table — Lessee, Aircraft, Expiry, Days, Urgency — reusing `KeyDateRow`'s existing fields (same shape used by the Dashboard's own Upcoming Expiries panel and `KeyDatesTab`, so no new type needed).

### 6. Payment Schedule
`toPaymentSchedule(leases, assets, lessees)` (`src/app/lib/paymentAdapters.ts`) is an existing, unused-by-this-modal adapter. `leases`/`assets`/`lessees` are already destructured from `usePortfolioData()` in `BoardPackModal.tsx:53`. Call it fresh (not currently computed in this component).

**Scope note:** `PaymentSchedule.rows` is a full per-lessee, per-month grid (`PaymentRow.cells`, one 12-column row per lease) — designed for on-screen heatmap display, not a printed A4 page. For the PDF, summarize to a single "12-Month Forward Rent Roll" table using `schedule.months` (labels) and `schedule.monthlyTotals` (one total per month) plus a grand-total row (`schedule.grandTotal`) — not the full per-lessee breakdown.

### 7. Scenario Analysis (real, split from ECL Provision Summary per user decision)
`DEFAULT_ADVERSE_INPUTS` and `DEFAULT_UPSIDE_INPUTS` are currently private `ScenarioInputs` constants in `RiskECL.tsx` (lines 101-137), used there as the real preset values for the "Adverse / Downside" and "Upside" scenario editors. **Move both to `src/app/utils/eclCalculator.ts`** (already home to `computeECLFromBase` and `BASE_ECL`) as named exports, and have `RiskECL.tsx` import them from there instead of defining local copies — single source of truth, and `RiskECL.tsx`'s own behavior is unchanged (same values, just relocated).

Compute:
```ts
const baseline = kpis.totalECLm; // already computed in BoardPackModal
const adverse  = computeECLFromBase(baseline, DEFAULT_ADVERSE_INPUTS);
const upside   = computeECLFromBase(baseline, DEFAULT_UPSIDE_INPUTS);
const weighted = baseline * 0.60 + adverse * 0.25 + upside * 0.15; // standard weights, see Scope Boundary below
```

Render: a 4-row table (Base 60% / Adverse 25% / Upside 15% / Weighted), same visual shape as the old fake `SCENARIOS` table it replaces, but every number now genuinely derived from the live portfolio's real ECL via the same shock-formula engine used everywhere else in the app (`computeECLFromBase` — the identical function Scenarios/Custom Builder use for every other scenario run).

**Scope boundary:** the 60/25/15 weighting is a documented standard default, not pulled from the tenant's actual persisted `scenario_weight_baseline/adverse/upside` settings (`Settings.tsx`'s "Scenario Weights" panel, saved to a Supabase-backed table). Wiring the live persisted weights into a report-generation utility is a reasonable future increment (needs a new query path in a currently-synchronous, non-Supabase-aware file) — out of scope here because the credibility gap being closed is "are these dollar figures real," which this fully answers; the weighting split itself was already the number shown before this change (60/25/15 exactly matches the old static table's labels), so nothing regresses.

### 8. Jurisdiction Risk
`computePortfolioJurisdictionMix(lessees, leases, jurisdictions)` (`src/app/utils/jurisdictionRisk.ts`) needs a `jurisdictions: Jurisdiction[]` array `BoardPackModal.tsx` doesn't currently fetch. Add `const { jurisdictions } = useJurisdictions();` (existing hook, already used the same way in `CustomBuilderPage.tsx`) and call `computePortfolioJurisdictionMix(lessees, leases, jurisdictions)`, using its `rows: JurisdictionRow[]` output.

Render: table — Lessee, Country, CTC Tier, CTC Score, Repo P50 (months), Fleet Weight % (`weightPct`). This is per-lessee real portfolio composition, not the standalone `RPT-006` report's static per-country reference table (`JURISDICTIONS` const) — a different, more real data source than that unrelated report currently uses. Not fixing `RPT-006` itself in this pass (out of scope, separate report).

---

## Data flow

```
BoardPackModal.tsx
  selected (existing checkbox state)
  kpis, keyDateRows (existing, already computed — currently modal-preview-only)
  + leases (already destructured, unused by PDF today)
  + useJurisdictions() → jurisdictions (new hook call)
  ↓
generateReportPDF(reportId, currency, data, onBlob, token, sections)
  RPT-002 case:
    for each section id where sections[id] !== false:
      compute + render that section's block, advance y
    save("board-pack")
```

## Error handling

- `toPaymentSchedule` and `computePortfolioJurisdictionMix` are pure, synchronous, no I/O — no new failure modes to handle (unlike Pass 1's AI call, nothing here can time out or 429).
- `useJurisdictions()` has its own existing loading/error state (Supabase fetch) — if `jurisdictions` is empty (still loading, or fetch failed), `computePortfolioJurisdictionMix` already returns an empty-safe `{ ctcGoldPct: 0, nonCtcPct: 0, avgRepossP50Months: 0, rows: [] }` per its existing guard clause — the Jurisdiction Risk section renders an empty table rather than crashing. No new guard needed.
- If `sections` is `undefined` (a caller doesn't pass it — e.g. any future non-modal caller of `generateReportPDF("RPT-002", ...)`), every section defaults to shown (`sections?.[id] !== false` is `true` when `sections` is `undefined`), preserving today's "always full report" behavior for anyone not going through the checkbox UI.

## Testing

- Unit test `stageBreakdown()` (new function) with a small fixture `PortfolioExportData` — assert correct per-stage sums and coverage %.
- Manual verification (per-section): toggle each checkbox off individually, download, confirm that section's content is absent and no other section shifted incorrectly (the `y`-cursor advancement is sequential, so removing an early section should pull later ones up, not leave a gap).
- Manual verification: all 8 checked (default state) produces a report with all sections present, in the order listed in `SECTIONS`.
- Manual verification: all 8 unchecked — PDF should still generate (header only, no sections, no crash) rather than erroring.

## Explicitly out of scope for this pass
- Wiring the tenant's live persisted scenario weights (`Settings.tsx`) into Scenario Analysis — standard 60/25/15 default only.
- Fixing `RPT-006` (Jurisdiction Risk Summary)'s own static `JURISDICTIONS` data — unrelated standalone report, not touched.
- Any other report type (`RPT-001`, `RPT-003` through `RPT-006`) — this pass only touches `RPT-002`.
- Payment Schedule's full per-lessee monthly grid — summarized to a monthly-total rent roll for print, per the scope note above.
