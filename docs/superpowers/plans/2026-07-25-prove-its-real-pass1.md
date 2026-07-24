# "Prove It's Real" Pass 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire two already-live pieces of infrastructure (the macro-signals feed and the AI narrative service) into two UI surfaces that currently show static or disconnected content: the Custom Builder's market-calibration banner, and the Board Pack's Executive Summary.

**Architecture:** Feature 1 adds a `raw` field to `useMacroSignals`'s return value, a pure `computeLiveCalibration()` function in `intelligenceData.ts`, and wires both into `CustomBuilderTab.tsx`'s existing banner. Feature 2 adds a `generateBoardPackSummary()` export to `narrativeService.ts` (same `/api/ai/narrative` endpoint the scenario narrative already uses, new prompt), makes `generateReportPDF`'s `RPT-002` case async to await it, and threads an Auth0 token through the two modals that call it.

**Tech Stack:** React 18 + TypeScript, Vitest, jsPDF/jspdf-autotable, Auth0 React SDK, existing `/api/signals/macro` and `/api/ai/narrative` Vercel Edge functions (both already live, untouched by this plan).

---

## Task 1: Expose raw live macro data from `useMacroSignals`

**Files:**
- Modify: `src/app/services/useMacroSignals.ts:66-121`

- [ ] **Step 1: Add `raw` to the result interface and add a `rawData` state slot**

In `src/app/services/useMacroSignals.ts`, replace lines 66-121 (the `UseMacroSignalsResult` interface through the end of `useMacroSignals`) with:

```ts
export interface UseMacroSignalsResult {
  signals: MacroSignal[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  partial: boolean;
  refresh: () => void;
  /** Raw numeric values from the live feed — null until the first successful fetch or cache hit. */
  raw: LiveMacroData | null;
}

export function useMacroSignals(): UseMacroSignalsResult {
  const [signals, setSignals] = useState<MacroSignal[]>(MACRO_SIGNALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [partial, setPartial] = useState(false);
  const [rawData, setRawData] = useState<LiveMacroData | null>(null);

  const { getAccessTokenSilently } = useAuth0();
  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let token: string | undefined;
      try { token = await getAccessTokenSilently(); } catch { /* anon */ }
      const res = await fetch("/api/signals/macro", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const live = await res.json() as LiveMacroData;
      setSignals(mergeLiveData(MACRO_SIGNALS, live));
      setLastUpdated(new Date(live.fetchedAt));
      setPartial(live.partial);
      setRawData(live);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ live, cachedAt: Date.now() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
      // Fallback: try localStorage cache
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const { live } = JSON.parse(cached) as { live: LiveMacroData };
          setSignals(mergeLiveData(MACRO_SIGNALS, live));
          setLastUpdated(new Date(live.fetchedAt));
          setRawData(live);
        }
      } catch { /* keep static defaults */ }
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    fetchSignals();
    const id = setInterval(fetchSignals, POLL_MS);
    return () => clearInterval(id);
  }, [fetchSignals]);

  return { signals, loading, error, lastUpdated, partial, refresh: fetchSignals, raw: rawData };
}
```

Note the local variable inside the catch block's cache-fallback path was renamed from `raw` to `cached` — the original name would now shadow the new `raw` field on the returned object's type and is confusing to read next to it.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `useMacroSignals.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/services/useMacroSignals.ts
git commit -m "feat: expose raw live macro values from useMacroSignals"
```

---

## Task 2: `computeLiveCalibration` — live GDP/FX divergence, with tests

**Files:**
- Modify: `src/app/data/intelligenceData.ts` (append after line 830, the closing `];` of `SCENARIO_CALIBRATION`)
- Create: `src/app/data/intelligenceData.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/data/intelligenceData.test.ts`:

```ts
// src/app/data/intelligenceData.test.ts
import { describe, it, expect } from "vitest";
import { computeLiveCalibration, SCENARIO_CALIBRATION } from "./intelligenceData";

const FULL_RAW = {
  ecbDepositRate: { value: 2.5, date: "2026-04-29T00:00:00Z" },
  eurUsd: { value: 1.05, date: "2026-04-29T00:00:00Z" },
  brentCrude: { value: 82.4, date: "2026-04-28T00:00:00Z" },
  gdp: [{ countryCode: "IND", year: "2026", value: 5.8 }],
  fetchedAt: "2026-04-29T12:00:00Z",
  partial: false,
};

describe("computeLiveCalibration", () => {
  it("computes a live GDP divergence from the IMF feed", () => {
    const result = computeLiveCalibration(FULL_RAW);
    const gdp = result.find(d => d.suggestedInputKey === "gdpDelta")!;
    expect(gdp.currentMarket).toContain("5.8%");
    expect(gdp.currentMarket).toContain("Live");
    // Baseline is 6.4% (static scenarioAssumption) — live 5.8% is -0.6pp.
    expect(gdp.suggestedValue).toBeCloseTo(-0.006, 4);
    expect(gdp.severity).toBe("high"); // |−0.6pp| >= 0.5pp
  });

  it("computes a live FX divergence from the ECB feed", () => {
    const result = computeLiveCalibration(FULL_RAW);
    const fx = result.find(d => d.suggestedInputKey === "fxDelta")!;
    expect(fx.currentMarket).toContain("1.05");
    expect(fx.currentMarket).toContain("Live");
    // Baseline is 1.1012 (static scenarioAssumption) — live 1.05 is about -4.65%.
    expect(fx.suggestedValue).toBeCloseTo((1.05 - 1.1012) / 1.1012, 4);
    expect(fx.severity).toBe("high"); // |−4.65%| > 3%
  });

  it("always passes fuel through unchanged from the static array — no live jet-fuel feed exists", () => {
    const result = computeLiveCalibration(FULL_RAW);
    const fuel = result.find(d => d.suggestedInputKey === "fuelDelta")!;
    const staticFuel = SCENARIO_CALIBRATION.find(d => d.suggestedInputKey === "fuelDelta")!;
    expect(fuel).toEqual(staticFuel);
  });

  it("falls back to the static GDP entry when gdp data is missing from the live feed", () => {
    const partialRaw = { ...FULL_RAW, gdp: [] };
    const result = computeLiveCalibration(partialRaw);
    const gdp = result.find(d => d.suggestedInputKey === "gdpDelta")!;
    const staticGdp = SCENARIO_CALIBRATION.find(d => d.suggestedInputKey === "gdpDelta")!;
    expect(gdp.currentMarket).toBe(`${staticGdp.currentMarket} · Reference`);
    expect(gdp.suggestedValue).toBe(staticGdp.suggestedValue);
  });

  it("falls back to the static FX entry when eurUsd is null in the live feed", () => {
    const partialRaw = { ...FULL_RAW, eurUsd: null };
    const result = computeLiveCalibration(partialRaw);
    const fx = result.find(d => d.suggestedInputKey === "fxDelta")!;
    const staticFx = SCENARIO_CALIBRATION.find(d => d.suggestedInputKey === "fxDelta")!;
    expect(fx.currentMarket).toBe(`${staticFx.currentMarket} · Reference`);
    expect(fx.suggestedValue).toBe(staticFx.suggestedValue);
  });

  it("returns exactly 3 entries in the same order as the static array", () => {
    const result = computeLiveCalibration(FULL_RAW);
    expect(result.map(d => d.id)).toEqual(SCENARIO_CALIBRATION.map(d => d.id));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/data/intelligenceData.test.ts`
Expected: FAIL — `computeLiveCalibration is not exported` (or similar — the function doesn't exist yet).

- [ ] **Step 3: Implement `computeLiveCalibration`**

Append to `src/app/data/intelligenceData.ts`, immediately after the closing `];` of `SCENARIO_CALIBRATION` (line 830):

```ts

// ─── Live Calibration ──────────────────────────────────────────────────────────
// Computes the same shape as SCENARIO_CALIBRATION above, but from the live
// macro feed (useMacroSignals' `raw` field) instead of the frozen snapshot.
//
// Fuel is deliberately NOT live-computed: the only live fuel-adjacent feed is
// Brent crude ($/barrel), a different commodity from Jet-A1 fuel ($/litre).
// Converting one to the other needs a crack-spread constant this codebase
// doesn't have — inventing one would fabricate a number to make the banner
// *look* live, which is the exact problem this pass exists to fix. Fuel
// stays static/reference until a genuine jet-fuel price feed is wired.

interface LiveMacroDataForCalibration {
  eurUsd: { value: number; date: string } | null;
  gdp: Array<{ countryCode: string; year: string; value: number }>;
}

function formatCalDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function gdpSeverity(ppDivergence: number): SignalSeverity {
  const abs = Math.abs(ppDivergence);
  if (abs >= 0.5) return "high";
  if (abs >= 0.2) return "medium";
  return "low";
}

function fxSeverity(pctDivergence: number): SignalSeverity {
  const abs = Math.abs(pctDivergence);
  if (abs > 3) return "high";
  if (abs > 1) return "medium";
  return "low";
}

// Baseline scenario assumptions the static entries were authored against —
// kept as named constants so the live divergence math has something fixed
// to diff against. These represent the model's last-run assumption, not
// something fetched live.
const GDP_BASELINE_PCT = 6.4;   // India GDP growth, WEO Oct 2025 assumption
const FX_BASELINE_RATE = 1.1012; // EUR/USD, 30 Jan 2026 baseline

export function computeLiveCalibration(raw: LiveMacroDataForCalibration): ScenarioCalibrationDivergence[] {
  const staticById = new Map(SCENARIO_CALIBRATION.map(d => [d.id, d]));

  const fuelStatic = staticById.get("cal-01")!;
  const gdpStatic = staticById.get("cal-02")!;
  const fxStatic = staticById.get("cal-03")!;

  // Fuel — always static/reference, see file header comment above.
  const fuel: ScenarioCalibrationDivergence = fuelStatic;

  // GDP — live if the IMF feed has an India entry, else fall back to static.
  const indiaGdp = raw.gdp.find(g => g.countryCode === "IND");
  const gdp: ScenarioCalibrationDivergence = indiaGdp
    ? (() => {
        const divergencePp = indiaGdp.value - GDP_BASELINE_PCT;
        return {
          id: "cal-02",
          label: "India GDP",
          currentMarket: `${indiaGdp.value.toFixed(1)}% growth (IMF WEO, FY${indiaGdp.year}) · Live`,
          scenarioAssumption: gdpStatic.scenarioAssumption,
          divergence: `${divergencePp >= 0 ? "+" : ""}${divergencePp.toFixed(1)}pp vs scenario baseline`,
          severity: gdpSeverity(divergencePp),
          suggestedInputKey: "gdpDelta",
          suggestedValue: Number((divergencePp / 100).toFixed(4)),
        };
      })()
    : { ...gdpStatic, currentMarket: `${gdpStatic.currentMarket} · Reference` };

  // FX — live if the ECB feed has a EUR/USD value, else fall back to static.
  const fx: ScenarioCalibrationDivergence = raw.eurUsd
    ? (() => {
        const { value, date } = raw.eurUsd!;
        const divergencePct = ((value - FX_BASELINE_RATE) / FX_BASELINE_RATE) * 100;
        return {
          id: "cal-03",
          label: "EUR/USD Rate",
          currentMarket: `${value.toFixed(4)} (ECB, ${formatCalDate(date)}) · Live`,
          scenarioAssumption: fxStatic.scenarioAssumption,
          divergence: `EUR ${divergencePct >= 0 ? "+" : ""}${divergencePct.toFixed(1)}% vs scenario FX baseline`,
          severity: fxSeverity(divergencePct),
          suggestedInputKey: "fxDelta",
          suggestedValue: Number((divergencePct / 100).toFixed(4)),
        };
      })()
    : { ...fxStatic, currentMarket: `${fxStatic.currentMarket} · Reference` };

  return [fuel, gdp, fx];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/data/intelligenceData.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/data/intelligenceData.ts src/app/data/intelligenceData.test.ts
git commit -m "feat: compute live GDP/FX scenario calibration from macro feed"
```

---

## Task 3: Wire live calibration into Custom Builder

**Important architectural note:** `CustomBuilderTabImpl` (the component in `CustomBuilderTab.tsx`) takes **zero hooks internally** — it's a pure props-in component, wrapped in `React.memo` specifically so a pathname-driven re-render of the parent doesn't cascade through its 1570-line tree (see the comment directly above `function CustomBuilderTabImpl` in that file). Calling `useMacroSignals()` inside it would defeat that memoization — the hook's own polling/fetch-driven state updates would force a re-render of this component on a timer, independent of props, reproducing the exact freeze-bug class this codebase has already been fixed for elsewhere. Every derived value this component needs (`liveBaseECL`, `portfolioJurisdictionMix`, etc.) is instead computed in the parent, `CustomBuilderPage.tsx`, via `useMemo`, and passed down as a prop. `calibration` follows the same pattern.

**Files:**
- Modify: `src/app/pages/CustomBuilderPage.tsx` (imports near line 47, derived-values block near line 112, JSX prop-passing near line 393)
- Modify: `src/app/pages/scenarios/CustomBuilderTab.tsx:25, ~58-95 (props interface), ~199-333 (banner JSX)`

- [ ] **Step 1: Compute `calibration` in `CustomBuilderPage.tsx`**

Add these two imports after line 47 (`import { DEFAULT_RECOVERY_FACTOR } from "../data/lgdCurves";`):

```ts
import { SCENARIO_CALIBRATION, computeLiveCalibration, type ScenarioCalibrationDivergence } from "../data/intelligenceData";
import { useMacroSignals } from "../services/useMacroSignals";
```

Add the hook call and derived value directly after the `liveBaseECL` block (after line 115, the closing `}, [scoped, lessees]);` of the `liveBaseECL` `useMemo`):

```ts
  const { raw: liveMacroRaw } = useMacroSignals();
  const calibration = useMemo<ScenarioCalibrationDivergence[]>(
    () => (liveMacroRaw ? computeLiveCalibration(liveMacroRaw) : SCENARIO_CALIBRATION),
    [liveMacroRaw],
  );
```

- [ ] **Step 2: Pass `calibration` down to `CustomBuilderTab`**

In the same file, add a new prop to the `<CustomBuilderTab ... />` call (after line 393's `liveBaseECL={liveBaseECL}`):

```tsx
        calibration={calibration}
```

- [ ] **Step 3: Typecheck to confirm the prop is now required-but-missing on the child**

Run: `npx tsc --noEmit`
Expected: FAIL — `Property 'calibration' does not exist on type 'IntrinsicAttributes & CustomBuilderTabProps'` (or similar), since Steps 4-5 haven't updated `CustomBuilderTab.tsx` yet. This confirms the prop wiring on the parent side is actually connected to something the child will need to declare.

- [ ] **Step 4: Add `calibration` to `CustomBuilderTabProps` and destructure it**

In `src/app/pages/scenarios/CustomBuilderTab.tsx`, change line 25 from:

```ts
import { SCENARIO_CALIBRATION } from "../../data/intelligenceData";
```

to:

```ts
import type { ScenarioCalibrationDivergence } from "../../data/intelligenceData";
```

(The component no longer imports `SCENARIO_CALIBRATION` as a value — it receives the already-computed array via props. Only the type is needed here.)

Add `calibration: ScenarioCalibrationDivergence[];` to the `CustomBuilderTabProps` interface, next to the other portfolio-derived props (after `liveBaseECL: number;`, in the "Portfolio-derived data" group):

```ts
  // Portfolio-derived data
  liveBaseECL: number;
  calibration: ScenarioCalibrationDivergence[];
  portfolioJurisdictionMix: PortfolioJurisdictionMix;
```

Add `calibration,` to the destructured props list in `CustomBuilderTabImpl`, next to `liveBaseECL,`:

```ts
  liveBaseECL,
  calibration,
  portfolioJurisdictionMix,
```

- [ ] **Step 5: Replace the three `SCENARIO_CALIBRATION` usages in the banner JSX with the `calibration` prop**

In the same file, replace each of the three remaining `SCENARIO_CALIBRATION` references with `calibration`:

Line ~233 — badge count:
```tsx
{calibration.length} signals diverged from last-run assumptions
```

Line ~255 — divergence rows:
```tsx
{calibration.map((div) => (
```

Lines ~291-294 — pre-populate button:
```tsx
onClick={() => {
  const patch: Record<string, number> = {};
  for (const d of calibration) {
    patch[d.suggestedInputKey] = d.suggestedValue;
  }
  updateFormInputs(patch as Parameters<typeof updateFormInputs>[0]);
  setCalBannerDismissed(true);
}}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean — no errors. This confirms Step 3's expected failure is now resolved.

- [ ] **Step 7: Manual verification**

Start the dev server, navigate to `/build`, and confirm the "Market Calibration Available" banner renders. Each row's "Market:" text should end in `· Live` for GDP and FX (assuming `/api/signals/macro` responds successfully) and the fuel row should read exactly as before (no `· Live`/`· Reference` suffix, since it's the unmodified static entry). If the network call fails or is unauthenticated, GDP and FX should show `· Reference` appended instead, not crash.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/CustomBuilderPage.tsx src/app/pages/scenarios/CustomBuilderTab.tsx
git commit -m "feat: wire live calibration into Custom Builder banner

Computed in CustomBuilderPage.tsx (the parent) and passed down as a
prop, not called as a hook inside CustomBuilderTabImpl — that
component is deliberately hook-free and wrapped in React.memo to
avoid the cross-page-nav freeze bug class."
```

---

## Task 4: `generateBoardPackSummary` — AI narrative for the Board Pack, with tests

**Files:**
- Modify: `src/app/services/narrativeService.ts`
- Create: `src/app/services/narrativeService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/services/narrativeService.test.ts`:

```ts
// src/app/services/narrativeService.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { generateBoardPackSummary } from "./narrativeService";
import type { PortfolioExportData } from "../lib/portfolioAdapters";

const SAMPLE_DATA: PortfolioExportData = {
  eclRows: [
    { id: "L1", lessee: "IndiGo Airlines", aircraft: "A320neo", ead: 24.2, pd12m: 12.4, lgd: 54, ecl12m: 1.62, eclLT: 2.36, stage: "3" },
    { id: "L2", lessee: "Emirates", aircraft: "B777-300ER", ead: 88.4, pd12m: 0.3, lgd: 28, ecl12m: 0.07, eclLT: 0.27, stage: "1" },
  ],
  leaseRows: [],
  lesseeRows: [
    { name: "IndiGo Airlines", country: "India", rating: "BB-", stage: "3", behavior: 44, leases: 1, exposure: "$24.2M", daysLate: 45 },
    { name: "Emirates", country: "UAE", rating: "A-", stage: "1", behavior: 94, leases: 1, exposure: "$88.4M", daysLate: 0.2 },
  ],
  aircraftRows: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateBoardPackSummary", () => {
  it("returns the AI response when the anchors validate", async () => {
    const totalEcl = "1.7"; // 1.62 + 0.07 = 1.69 -> toFixed(1) = "1.7"
    const eclPct = "1.50";  // 1.69 / 112.6 * 100 = 1.5008... -> toFixed(2) = "1.50"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: `The portfolio carries a total ECL of $${totalEcl}M, or ${eclPct}% of book value, across 2 leases.` } }],
      }),
    }));
    const result = await generateBoardPackSummary(SAMPLE_DATA, "tok");
    expect(result).toContain(totalEcl);
    expect(result).toContain(eclPct);
  });

  it("falls back to the deterministic summary when the AI response fails anchor validation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "A generic summary with no real numbers." } }] }),
    }));
    const result = await generateBoardPackSummary(SAMPLE_DATA, "tok");
    expect(result).toContain("$1.7M");
    expect(result).toContain("book value");
  });

  it("falls back to the deterministic summary when the fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await generateBoardPackSummary(SAMPLE_DATA, "tok");
    expect(result).toContain("$1.7M");
  });

  it("falls back to the deterministic summary on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" }));
    const result = await generateBoardPackSummary(SAMPLE_DATA, "tok");
    expect(result).toContain("$1.7M");
  });

  it("deterministic fallback names the largest single ECL exposure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const result = await generateBoardPackSummary(SAMPLE_DATA, "tok");
    expect(result).toContain("IndiGo Airlines");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/services/narrativeService.test.ts`
Expected: FAIL — `generateBoardPackSummary is not exported`.

- [ ] **Step 3: Implement `generateBoardPackSummary`**

Append to `src/app/services/narrativeService.ts` (after the existing `generateNarrative` function). First add the new import at the top of the file, alongside the existing imports (after line 11):

```ts
import type { PortfolioExportData } from "../lib/portfolioAdapters";
```

Then append at the end of the file:

```ts

// ── Board Pack executive summary ────────────────────────────────────────────
//
// Same /api/ai/narrative endpoint as generateNarrative above, but built from
// portfolio-wide export data (PortfolioExportData) rather than a single
// ScenarioRunResult — the Board Pack isn't a scenario run, it's a
// point-in-time portfolio snapshot.

function boardPackAggregates(data: PortfolioExportData) {
  const bookValueM = data.eclRows.reduce((s, r) => s + r.ead, 0);
  const totalEclM = data.eclRows.reduce((s, r) => s + r.ecl12m, 0);
  const eclPct = bookValueM > 0 ? ((totalEclM / bookValueM) * 100).toFixed(2) : "0.00";
  const stage3Count = data.eclRows.filter(r => r.stage === "3").length;
  const watchlistCount = data.lesseeRows.filter(l => l.stage !== "1").length;

  const eclByLessee = new Map<string, number>();
  for (const row of data.eclRows) {
    eclByLessee.set(row.lessee, (eclByLessee.get(row.lessee) ?? 0) + row.ecl12m);
  }
  let topLessee: string | null = null;
  let topLesseeEcl = 0;
  for (const [name, ecl] of eclByLessee) {
    if (ecl > topLesseeEcl) { topLessee = name; topLesseeEcl = ecl; }
  }

  return { bookValueM, totalEclM, eclPct, stage3Count, watchlistCount, topLessee, topLesseeEcl };
}

function buildBoardPackFallback(data: PortfolioExportData): string {
  const { bookValueM, totalEclM, eclPct, stage3Count, watchlistCount, topLessee, topLesseeEcl } = boardPackAggregates(data);

  return (
    `The portfolio holds a book value of $${bookValueM.toFixed(1)}M across ${data.eclRows.length} lease${data.eclRows.length !== 1 ? "s" : ""}, ` +
    `carrying a total 12-month ECL of $${totalEclM.toFixed(1)}M (${eclPct}% of book value). ` +
    `${stage3Count} lease${stage3Count !== 1 ? "s" : ""} sit in Stage 3, and ${watchlistCount} lessee${watchlistCount !== 1 ? "s are" : " is"} on the watchlist (Stage 2 or 3). ` +
    `${topLessee ? `${topLessee} carries the largest single ECL exposure at $${topLesseeEcl.toFixed(1)}M. ` : ""}` +
    `Coverage ratios and scenario-weighted ECL are detailed in the table below.`
  );
}

export async function generateBoardPackSummary(
  data: PortfolioExportData,
  /** Auth0 bearer token — forwarded to the proxy for verification. */
  token?: string,
): Promise<string> {
  const { bookValueM, totalEclM, eclPct, stage3Count, watchlistCount } = boardPackAggregates(data);

  const prompt = `You are a financial risk analyst writing a board-level executive summary. Use ONLY the numbers provided below. Do not invent, infer, or round any value differently from what is shown. Output exactly 3-5 sentences. No bullet points. No headings. Plain prose only. Always write counts and quantities as digits, never as words.

PORTFOLIO DATA:
- Book value: $${bookValueM.toFixed(1)}M
- Total leases: ${data.eclRows.length}
- Total 12-month ECL: $${totalEclM.toFixed(1)}M
- ECL as % of book: ${eclPct}%
- Stage 3 lease count: ${stage3Count}
- Watchlist lessee count (Stage 2 or 3): ${watchlistCount}`;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch("/api/ai/narrative", {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 220,
        temperature: 0,
      }),
    });

    if (!response.ok) return buildBoardPackFallback(data);

    const responseData = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = responseData?.choices?.[0]?.message?.content;
    if (!text) return buildBoardPackFallback(data);

    // 2-anchor validation — the two hardest numbers to hallucinate must appear verbatim.
    const anchor1 = totalEclM.toFixed(1);
    const anchor2 = eclPct;
    if (!text.includes(anchor1) || !text.includes(anchor2)) {
      return buildBoardPackFallback(data);
    }

    return text.trim();
  } catch {
    return buildBoardPackFallback(data);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/services/narrativeService.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/narrativeService.ts src/app/services/narrativeService.test.ts
git commit -m "feat: add generateBoardPackSummary narrative for Board Pack"
```

---

## Task 5: Insert the narrative into the Board Pack PDF

**Files:**
- Modify: `src/app/services/exportService.ts:1-9, 269-278, ~333-342, 409`

- [ ] **Step 1: Add the import**

In `src/app/services/exportService.ts`, add to the imports at the top of the file (after line 9's `PortfolioExportData` import):

```ts
import { generateBoardPackSummary } from "./narrativeService";
```

- [ ] **Step 2: Make `generateReportPDF` async and add a `token` parameter**

Change the function signature (currently at line 269) from:

```ts
export function generateReportPDF(
  reportId: string,
  currency: CurrencyCode,
  data?: PortfolioExportData,
  /** T-3.3 side-channel — fired before the local download with the file blob + filename. */
  onBlob?: (blob: Blob, filename: string) => void | Promise<void>,
): void {
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
): Promise<void> {
```

- [ ] **Step 3: Insert the narrative into the `RPT-002` case**

Replace the existing `case "RPT-002":` block (currently):

```ts
    case "RPT-002": {
      addHeader("Board Pack — Q1 2026", "Executive Portfolio Summary");
      autoTable(doc, {
        startY: 45,
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

No other `case` blocks change — they remain synchronous internally (calling `save()` directly), which is fine inside an `async function`; they simply don't `await` anything, so their behavior and timing are unchanged.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors at every call site of `generateReportPDF` that doesn't `await` it (the two modals — fixed in Task 6) or match the new `Promise<void>` return type. Confirm the errors are exactly `BoardPackModal.tsx` and `ReportFormatModal.tsx` and no others.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/exportService.ts
git commit -m "feat: insert AI-generated Executive Summary into Board Pack PDF"
```

(This commit will not typecheck cleanly in isolation — the two callers are fixed in Task 6. That's expected for this intermediate commit; the working tree as a whole is fixed by the end of Task 6.)

---

## Task 6: Thread the Auth0 token and `await` into both report modals

**Files:**
- Modify: `src/app/components/reports/BoardPackModal.tsx:1-9, 109-119`
- Modify: `src/app/components/reports/ReportFormatModal.tsx:1-9, 56-67`

- [ ] **Step 1: Update `BoardPackModal.tsx`**

Add the `useAuth0` import (after line 2's `import * as React from "react";`):

```ts
import { useAuth0 } from "@auth0/auth0-react";
```

Inside the component function body, add the hook call alongside the existing hooks (near line 52-53, where `useCurrency` and `usePortfolioData` are called):

```ts
const { getAccessTokenSilently } = useAuth0();
```

Replace `handleDownload` (currently lines 109-119):

```ts
  async function handleDownload() {
    setDownloading(true);
    try {
      if (format === "pdf")  generateReportPDF(reportId, currency, exportData, makeOnBlob("pdf"));
      if (format === "xlsx") await generateReportXLSX(reportId, currency, exportData, makeOnBlob("xlsx"));
      setDone(true);
      setTimeout(onClose, 1200);
    } finally {
      setDownloading(false);
    }
  }
```

with:

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

- [ ] **Step 2: Update `ReportFormatModal.tsx`**

Add the `useAuth0` import (after line 2's `import * as React from "react";`):

```ts
import { useAuth0 } from "@auth0/auth0-react";
```

Inside the component function body, add the hook call alongside the existing hooks (near line 32-33):

```ts
const { getAccessTokenSilently } = useAuth0();
```

Replace `handleDownload` (currently lines 56-67):

```ts
  async function handleDownload() {
    setDownloading(true);
    try {
      if (selected === "pdf")  generateReportPDF(reportId, currency, exportData, makeOnBlob("pdf"));
      if (selected === "xlsx") await generateReportXLSX(reportId, currency, exportData, makeOnBlob("xlsx"));
      if (selected === "docx") await generateReportDOCX(reportId, currency, exportData, undefined, makeOnBlob("docx"));
      setDone(true);
      setTimeout(onClose, 1200);
    } finally {
      setDownloading(false);
    }
  }
```

with:

```ts
  async function handleDownload() {
    setDownloading(true);
    try {
      if (selected === "pdf") {
        let token: string | undefined;
        try { token = await getAccessTokenSilently(); } catch { /* falls back to deterministic summary */ }
        await generateReportPDF(reportId, currency, exportData, makeOnBlob("pdf"), token);
      }
      if (selected === "xlsx") await generateReportXLSX(reportId, currency, exportData, makeOnBlob("xlsx"));
      if (selected === "docx") await generateReportDOCX(reportId, currency, exportData, undefined, makeOnBlob("docx"));
      setDone(true);
      setTimeout(onClose, 1200);
    } finally {
      setDownloading(false);
    }
  }
```

Note: `getAccessTokenSilently` is only needed for the `pdf` branch in both modals — it's used purely to authenticate the Board Pack narrative call, and only `RPT-002` reaches that code path inside `generateReportPDF`. For every other `reportId`, `generateReportPDF` ignores the `token` argument entirely (no other `case` reads it), so passing it unconditionally on every PDF download is harmless and keeps the call site simple.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean — no errors anywhere in the project. This confirms Task 5's intermediate typecheck failures are now resolved.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing tests plus the two new test files from Tasks 2 and 4.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/reports/BoardPackModal.tsx src/app/components/reports/ReportFormatModal.tsx
git commit -m "feat: thread Auth0 token through Board Pack PDF download"
```

---

## Task 7: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Verify Board Pack narrative**

Start the dev server (`vercel dev`, not `npm run dev` — the Edge Function needs server-side env vars per `api/ai/narrative.ts`'s own header comment). Log in, navigate to `/reports`, click "Generate" on the Board Pack card (RPT-002), select PDF, click Download. Open the downloaded PDF and confirm:
- An "Executive Summary" heading appears above the scenario table.
- The paragraph beneath it contains real numbers (book value, ECL, ECL%) that match what's shown elsewhere in the app for the same portfolio.
- The scenario table below it is unchanged from before this plan.

- [ ] **Step 2: Verify Board Pack narrative fails gracefully**

Temporarily block network requests to `/api/ai/narrative` (e.g. via browser devtools' request blocking) and repeat Step 1. Confirm the PDF still downloads successfully with a fallback Executive Summary paragraph (the deterministic template from `buildBoardPackFallback`) rather than an error or a stuck "Building…" button.

- [ ] **Step 3: Verify other reports are unaffected**

Download each of RPT-001, RPT-003, RPT-004, RPT-005, RPT-006 (via `/reports`) and confirm they generate as quickly as before — no added narrative, no added delay, no visual change from pre-plan behavior.

- [ ] **Step 4: Verify live calibration in Custom Builder**

Navigate to `/build`. Confirm the "Market Calibration Available" banner shows GDP and FX rows ending in `· Live` (assuming `/api/signals/macro` is reachable and authenticated) and the fuel row unchanged (no suffix). Click "Pre-populate from market data" and confirm the GDP/FX/fuel sliders update to the values shown in the banner.

- [ ] **Step 5: Verify calibration fallback**

Block `/api/signals/macro` in devtools, reload `/build`, and confirm the banner still renders — GDP and FX rows should now read `· Reference` instead of `· Live`, values matching the original static `SCENARIO_CALIBRATION` array. No crash, no blank banner.
