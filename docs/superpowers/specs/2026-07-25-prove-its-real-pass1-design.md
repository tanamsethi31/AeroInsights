# "Prove It's Real" — Pass 1: Live Calibration + Board Pack Narrative

**Goal:** Close the two sharpest credibility gaps surfaced in a live demo to Steven Gaal (COO, SkyWorks Holdings) and Zack — by wiring already-built infrastructure (live macro-signal feeds, AI narrative service) into two UI surfaces that currently fake it.

**Context:** During the demo, the objection wasn't "you have no live data" — the platform genuinely has real ECB/EIA/IMF/NewsAPI feeds and a real scenario-calculation engine. The objection was narrower: two specific places show static/disconnected content while sitting next to real infrastructure that could feed them. This pass fixes those two places. It does not attempt to solve the deeper MR-cost-linkage gap (that needs a data licensing relationship, not just code — tracked separately) or touch the Auditor Pack (already structurally sound).

---

## Feature 1: Live Scenario Calibration

### Problem
`src/app/pages/scenarios/CustomBuilderTab.tsx` shows a "Market Calibration Available" banner with a **"Pre-populate from market data"** button. It reads `SCENARIO_CALIBRATION`, a hand-typed static array in `src/app/data/intelligenceData.ts:799-819` with entries like:

```ts
{
  id: "cal-01",
  label: "Jet-A1 Fuel Price",
  currentMarket: "$1.12/litre (IATA, 28 Apr 2026)",
  scenarioAssumption: "$0.98/litre (Baseline forward curve)",
  divergence: "+14.3% above scenario baseline",
  severity: "high",
  suggestedInputKey: "fuelDelta",
  suggestedValue: 0.143,
}
```

This is frozen at authoring time. Meanwhile, `src/app/services/useMacroSignals.ts` already fetches genuinely live data from `/api/signals/macro` (which itself calls real ECB, EIA Brent crude, and IMF WEO endpoints — `api/signals/macro.ts`). The hook currently only exposes this as pre-formatted **display strings** merged into `MacroSignal` objects (e.g. `currentValue: "$${value.toFixed(2)} / bbl"`), not as raw numbers — so nothing downstream can compute a divergence from it.

### Fix
1. **Expose raw live values from `useMacroSignals`.** Add a new field to `UseMacroSignalsResult`:
   ```ts
   export interface UseMacroSignalsResult {
     signals: MacroSignal[];
     loading: boolean;
     error: string | null;
     lastUpdated: Date | null;
     partial: boolean;
     refresh: () => void;
     raw: LiveMacroData | null;   // NEW — raw numeric values for downstream calculation
   }
   ```
   `LiveMacroData` (already defined in the file, `useMacroSignals.ts:6-13`) has `ecbDepositRate`, `eurUsd`, `brentCrude`, `gdp` — exactly what's needed. Store the fetched `live` object in state and return it as `raw`.

2. **New pure function: `computeLiveCalibration(raw: LiveMacroData): ScenarioCalibrationDivergence[]`** in `src/app/data/intelligenceData.ts` (co-located with the existing static `SCENARIO_CALIBRATION` and its type, since it produces the same shape). The static array today has exactly 3 entries — `cal-01` (Jet-A1 Fuel Price, ← `brentCrude`), `cal-02` (India GDP, ← `gdp` entry where `countryCode === "IND"`), `cal-03` (EUR/USD Rate, ← `eurUsd`) — so all 3 have a live source available; there is no "entry with no live source" case today, but the function still falls through to the matching static entry per-field if that field of `raw` is `null` (partial upstream failure), per the Error Handling section below.

   For each entry, compute `currentMarket` (formatted from the live number + a live-source citation, e.g. `` `$${brentCrude.value.toFixed(2)}/bbl (EIA, ${formatDate(brentCrude.date)})` ``), `divergence` (difference from the existing `scenarioAssumption` baseline — the baseline values themselves stay hardcoded named constants, since they represent the model's calibration reference point/last-run assumption, not something fetched live), and `suggestedValue` (the raw delta, same units as today: `fuelDelta`/`gdpDelta` as decimals, `fxDelta` as a decimal fraction).

   Severity bands, kept per-field since the three fields aren't on a common scale (mirrors the existing hand-assigned values — fuel 14.3%→high, GDP 0.6pp→high, FX 2.0%→medium):
   - **Fuel** (`fuelDelta`, % vs. baseline): `high` if `|divergence| > 10%`, else `medium` if `> 5%`, else `low`.
   - **GDP** (`gdpDelta`, pp vs. baseline): `high` if `|divergence| >= 0.5pp`, else `medium` if `>= 0.2pp`, else `low`.
   - **FX** (`fxDelta`, % vs. baseline): `high` if `|divergence| > 3%`, else `medium` if `> 1%`, else `low`.

3. **Wire it into `CustomBuilderTab.tsx`.** Confirmed: `useMacroSignals()` is not currently called anywhere in `Scenarios.tsx`, `CustomBuilderPage.tsx`, or `CustomBuilderTab.tsx` — this is a fresh call, not a duplicate fetch. Call it directly in `CustomBuilderTab.tsx`:
   ```ts
   const { raw } = useMacroSignals();
   const calibration = raw ? computeLiveCalibration(raw) : SCENARIO_CALIBRATION;
   ```
   (`raw`'s own fields may individually be `null` on a partial upstream failure — `computeLiveCalibration` handles that per-field, so the top-level `partial` flag from the hook isn't needed at this call site.)
   Replace the banner's `SCENARIO_CALIBRATION` reference with `calibration`. Label each entry individually (not one global banner flag — see Error Handling below for why): append `"· Live"` or `"· Reference"` to each entry's `currentMarket` display string depending on whether that specific entry came from `computeLiveCalibration` (live) or fell through to the static default for that field (reference), so a partial-live state (e.g. fuel live, GDP stale) renders honestly rather than as one all-or-nothing badge.

4. **No behavior change to the button itself** — `updateFormInputs(patch)` still applies whatever `calibration` currently holds; the only change is that `calibration` is now computed from live data when available.

### Data flow
```
/api/signals/macro (real ECB/EIA/IMF fetch)
  → useMacroSignals() → raw: LiveMacroData
  → computeLiveCalibration(raw) → ScenarioCalibrationDivergence[]
  → CustomBuilderTab banner + "Pre-populate" button
  → updateFormInputs() (unchanged)
```
Fallback path (fetch fails, still loading, or `partial: true` from a degraded upstream): falls back to `SCENARIO_CALIBRATION` static array, labeled "Reference (static)". The feature never breaks — it degrades to today's behavior, now correctly labeled.

### Error handling
- `useMacroSignals` already has its own try/catch + localStorage cache fallback (`useMacroSignals.ts:98-108`) — no changes needed there.
- `computeLiveCalibration` is a pure function with no I/O — if `raw` has partial fields (e.g. `brentCrude: null` but `gdp` populated), only compute entries with available data; fall back to the matching static entry for any field that's null. This is why point 3 labels each entry individually rather than using one global banner flag — a partial-live state (fuel live, GDP stale) is the realistic case, not the exception.

### Testing
- Unit test `computeLiveCalibration` with a fixture `LiveMacroData` (all fields populated, then each field null individually) — assert correct fallback-per-field behavior and correct divergence math against known inputs.
- Manual check: temporarily force `useMacroSignals` fetch to fail (e.g. throw in the fetch) and confirm the banner still renders with static data and the "Reference (static)" label, not a crash.

---

## Feature 2: Board Pack Executive Summary Narrative

### Problem
`src/app/components/reports/BoardPackModal.tsx` shows a section picker (`SECTIONS` array, `BoardPackModal.tsx:22+`) with entries like:
```ts
{ id: "exec-summary", label: "Executive Summary", desc: "Fleet overview, period highlights, key risks", pages: "1–2", defaultOn: true }
```
This implies the generated PDF will contain a written Executive Summary. But `handleDownload` (`BoardPackModal.tsx:109-116`) calls `generateReportPDF("RPT-002", ...)`, which routes to `exportService.ts`'s `case "RPT-002"` (`exportService.ts:~333-342`) — this renders `addHeader()` plus **one `autoTable()` call** on a 4-row `SCENARIOS` array. None of the section toggles are read; no prose exists anywhere in the output. The UI promises content the generator never produces.

### Fix
Scope: make the `exec-summary` section (already `defaultOn`) real. Leave the other section toggles as-is for this pass — flagged as a known follow-up, not silently fixed by implication.

1. **New prompt-building function** in `src/app/services/narrativeService.ts` (or a new sibling file `boardPackNarrative.ts` if keeping `narrativeService.ts` scenario-run-specific is preferred — see Decision below): `generateBoardPackSummary(data: PortfolioExportData, token?: string): Promise<string>`. Posts to the same `/api/ai/narrative` endpoint (already generic — accepts arbitrary `messages`, not scenario-shaped) with a new prompt built from live portfolio totals (book value, total ECL, stage breakdown, top watchlist names) — same pattern as the existing scenario prompt: explicit anchor values the model must include verbatim, validated post-response, falling back to a deterministic templated paragraph (mirroring `buildFallbackNarrative`'s pattern) if the AI call fails, times out, or fails anchor validation.

   **Decision:** add this as a second exported function in the existing `narrativeService.ts` rather than a new file — the file's job is "call `/api/ai/narrative` with a validated prompt," which is the same job for both scenario runs and board packs; splitting into two files for two prompt templates adds an import without adding clarity. Rename the file's header comment to reflect it now serves both scenario runs and report narratives.

2. **Make `generateReportPDF` async for the `RPT-002` case only.** Current signature is synchronous (`exportService.ts:269`, no `async`, `doc.save()` called directly inline). Change to `async function generateReportPDF(...)`, `await` the narrative fetch inside the `RPT-002` case only (other cases unaffected — no behavior change, no added latency for RPT-003 through RPT-006). Insert the returned text via `doc.splitTextToSize(text, pageWidthMinusMargins)` + `doc.text(lines, x, y)` before the existing `autoTable()` call, advancing `startY` for the table accordingly.

3. **Update the two callers** (`BoardPackModal.tsx:112`, `ReportFormatModal.tsx:59` — RPT-002 can be reached from both, per the earlier hierarchy audit's Reports.tsx routing) to `await generateReportPDF(...)` instead of calling it fire-and-forget. Both callers are already inside `async function handleDownload()` (confirmed: `ReportFormatModal.tsx:56`, `BoardPackModal.tsx:109`) and already show a "Building…" state while any await is in flight — no new UI state needed.

4. **Auth token threading.** `narrativeService.generateNarrative` already accepts an optional bearer `token` (`narrativeService.ts:47-50`). Both modals need access to an Auth0 token the same way `Scenarios.tsx`/`CustomBuilderPage.tsx` already do (check their `getAccessTokenSilently` usage as the reference pattern) and pass it through to `generateBoardPackSummary`.

### Data flow
```
BoardPackModal "Download" click
  → handleDownload() [already async]
  → generateReportPDF("RPT-002", currency, exportData, onBlob)  [now async]
    → generateBoardPackSummary(exportData, token)
      → POST /api/ai/narrative (existing Edge fn — auth, rate limit, provider fallback, all unchanged)
      → anchor-validated response, or deterministic fallback paragraph
    → doc.splitTextToSize + doc.text(...)   [new prose block]
    → autoTable(SCENARIOS)                   [existing table, unchanged]
  → doc.save() / onBlob()                    [existing, unchanged]
```

### Error handling
- Reuses the exact fallback pattern already proven in `narrativeService.ts` — if `/api/ai/narrative` errors, times out, rate-limits (429), or the response fails anchor validation, `generateBoardPackSummary` returns a deterministic templated paragraph built from the same `exportData` fields, so the PDF **always** contains prose, AI-generated or not, and generation never fails outright.
- If the Auth0 token fetch itself fails (user's session edge case), pass `undefined` — `/api/ai/narrative` requires a valid token and will 401, which the existing `generateNarrative`-pattern already treats as a normal fallback trigger (not a thrown error) — same behavior needed in `generateBoardPackSummary`.

### Testing
- Unit test `generateBoardPackSummary`'s fallback path (mock `fetch` to reject / return non-200 / return text failing anchor validation) — assert it returns the deterministic paragraph, not null/throw.
- Manual check: download Board Pack PDF, confirm an Executive Summary paragraph appears above the scenario table with real portfolio numbers matching the on-screen KPIs.
- Manual check: confirm RPT-003 through RPT-006 (untouched cases) still generate synchronously with no added delay — regression check that the `async` conversion didn't change their behavior.

---

## Explicitly out of scope for this pass
- The other Board Pack section toggles (Fleet Overview, Key Risks, etc.) — still cosmetic-only after this change. Follow-up work, not silently implied as fixed.
- Auditor Pack (RPT-001 / `AuditorPackModal.tsx`) — already structurally sound (8 real sections, genuine Methodology Statement), not touched.
- MR component cost linkage — tracked separately in [aeroinsights-product-gaps memory]; requires a data licensing relationship (Cirium/IBA/Ishka), not just code, so it's a different kind of project.
- Excel add-in sample workbook rebuild, sample portfolio depth, news-feed reliability bug — separate sub-projects per the earlier decomposition, not bundled here to keep this pass fast and reviewable.
