# P1-F2: LLM Narrative Summaries on Scenario Runs — Design Spec

**Goal:** After every scenario run, auto-generate a 4–6 sentence AI-written narrative summary (strictly numerical restatement of run outputs) that appears as a "Run Summary" card at the top of each scenario result panel.

**Date:** 2026-05-06

---

## Architecture

Three units with clear boundaries:

| Unit | File | Responsibility |
|---|---|---|
| Narrative service | `src/app/services/narrativeService.ts` | Azure OpenAI call, prompt, validation, returns `string \| null` |
| Summary card | inside `RunResultPanel.tsx` | Skeleton → success → hidden UI; Copy button |
| State management | `Scenarios.tsx` | `narrativeCache: Map<runId, string \| null \| "loading">`, triggers generation on first expand |

Data model additions are co-located with the existing mock (`Scenarios.tsx`): `topLessees` and `s3LeaseCount` added to `ScenarioRunResult` and populated by `buildRun()`.

---

## Data Model Changes

### `ScenarioRunResult` — two new fields

```typescript
topLessees: Array<{
  name: string;         // e.g. "IndiGo Airlines"
  ecl: number;          // per-lessee ECL contribution $M
  jurisdiction: string; // e.g. "India (IBC)"
}>;
s3LeaseCount: number;   // integer count of Stage 3 leases (for IAS 36 sentence)
```

### `buildRun()` — population logic

- `topLessees`: pick the top 2 Stage-3 counterparties from the existing counterparty list (IndiGo, Aeromexico, SriLankan, Azul, Air Transat). Allocate deterministically: lessee 1 receives 45% of `s3` ECL, lessee 2 receives 28%. Jurisdiction strings sourced from the jurisdiction data already in the codebase.
- `s3LeaseCount`: `Math.max(1, Math.round(result.s3 / 8.2))` — 8.2 is the approximate mean per-lease Stage 3 ECL across the portfolio. Seeded so identical inputs produce identical counts.
- Both fields are added to every run — template runs and custom runs alike.
- `topLessees` always contains exactly 2 entries. If the scenario's S3 ECL is small, the two lowest-exposure Stage-3 lessees are still included (ECL values can be < $1M); the template sentence remains grammatically valid regardless of magnitude.

---

## Narrative Service

**File:** `src/app/services/narrativeService.ts`

```typescript
export async function generateNarrative(run: ScenarioRunResult): Promise<string | null>
```

Returns the narrative string on success, `null` on API error or validation failure.

### Environment Variables (Vite)

```
VITE_AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=2024-02-01
VITE_AZURE_OPENAI_KEY=<key>
```

Region: EU West Europe (per INT-006). Model: `gpt-4o`.

### Prompt

Sent as a single `user` message (no system message). The prompt injects all run numbers explicitly so the model has no need to infer or fabricate:

```
You are a financial risk analyst writing a factual run summary. Use ONLY the numbers provided below. Do not invent, infer, or round any value differently from what is shown. Output exactly 4-6 sentences. No bullet points. No headings. Plain prose only.

RUN DATA:
- Scenario: {run.name}
- Portfolio ECL: ${run.ecl}M
- Book value: $2,840M
- ECL as % of book: {(run.ecl / 2840 * 100).toFixed(2)}%
- Change vs. Baseline ($47.2M): {((run.ecl - 47.2) / 47.2 * 100).toFixed(1)}%
- Stage 3 lease count: {run.s3LeaseCount}
- Stage 3 ECL: ${run.s3}M
- Top lessee 1: {run.topLessees[0].name}, ${run.topLessees[0].ecl}M, {run.topLessees[0].jurisdiction}
- Top lessee 2: {run.topLessees[1].name}, ${run.topLessees[1].ecl}M, {run.topLessees[1].jurisdiction}
- Shapley driver 1: {run.shapley[0].driver}, +{run.shapley[0].contribution.toFixed(0)}pp
- Shapley driver 2: {run.shapley[1].driver}, +{run.shapley[1].contribution.toFixed(0)}pp
- Aircraft below carrying value: {run.s3LeaseCount}

OUTPUT TEMPLATE (follow this structure exactly, substituting bracketed values):
"The [Scenario Name] scenario produces a portfolio ECL of $[ecl]M, representing [ecl%]% of book value and a [change]% [increase/decrease] vs. the Baseline. [s3LeaseCount] leases migrate to Stage 3 under this scenario, led by [lessee1] ($[ecl1]M ECL, [juris1]) and [lessee2] ($[ecl2]M ECL, [juris2]). The primary drivers are [driver1] (+[contribution1]pp contribution) and [driver2] (+[contribution2]pp contribution). [s3LeaseCount] aircraft have recoverable amounts below carrying value under this scenario, triggering potential IAS 36 review."
```

`max_tokens: 220`, `temperature: 0`.

### Validation

After the model responds, extract three anchor values and verify each appears verbatim in the output text:

| Anchor | Check |
|---|---|
| Portfolio ECL | `run.ecl.toFixed(1)` is a substring of the response |
| Top Shapley contribution | `run.shapley[0].contribution.toFixed(0) + "pp"` is a substring |
| Stage 3 lease count | `run.s3LeaseCount.toString()` is a substring |

If any anchor check fails → return `null`. The card is hidden. No error is surfaced to the user.

### Error handling

- Network error / non-200 from Azure → return `null`
- Response missing `choices[0].message.content` → return `null`
- Validation fails → return `null`
- In all null cases: card does not render

---

## UI — `NarrativeSummaryCard`

Lives inside `RunResultPanel.tsx` as an internal component, rendered as the **first element** above the existing metadata/ECL content.

### Props

```typescript
interface NarrativeSummaryCardProps {
  narrative: string | null | "loading";
}
```

### States

**`"loading"` — skeleton:**
- Card container: white background, `1px solid #E2E8F0` border, `0.75rem` border-radius, `1.25rem` padding
- Header row: small shimmer bar (40% width, 12px tall) on the left
- Three text-line shimmer bars below: widths 95%, 90%, 75%; height 10px; `0.5rem` gap
- Shimmer animation: `@keyframes shimmer` — background gradient slides left-to-right over 1.4s, `linear infinite`
- Shimmer colour: `#E2E8F0` → `#F1F5F9` → `#E2E8F0`

**`string` (success):**
- Left border: `3px solid #002147`
- Background: `#F8FAFC`
- Header: `✦ Run Summary` label (small, navy, 600 weight) + `[⎘ Copy]` button flush right
- Body: narrative text, `0.9375rem`, `#334155`, `line-height: 1.7`
- Copy button: `Copy` icon from `lucide-react`; on click → `navigator.clipboard.writeText(narrative)` → icon swaps to `Check` for 1 500ms, then reverts. No toast needed.

**`null` (hidden):**
- Component returns `null` — nothing rendered.

---

## State Management

**In `Scenarios.tsx`:**

```typescript
const [narrativeCache, setNarrativeCache] = useState<Map<string, string | null | "loading">>(new Map());
```

When a run row is **first expanded** (transition from collapsed to open):
1. If `narrativeCache.get(run.id)` is already set → use cached value (no API call)
2. If not set → set `"loading"`, call `generateNarrative(run)`, on resolve store result

```typescript
async function handleExpandRun(run: ScenarioRunResult) {
  if (narrativeCache.has(run.id)) return; // already cached
  setNarrativeCache(prev => new Map(prev).set(run.id, "loading"));
  const result = await generateNarrative(run);
  setNarrativeCache(prev => new Map(prev).set(run.id, result));
}
```

`RunResultPanel` receives `narrative={narrativeCache.get(run.id) ?? "loading"}` as a prop.

Re-expanding the same run shows the cached value immediately — no second API call.

---

## File Map

| Action | File | Change |
|---|---|---|
| Modify | `src/app/pages/Scenarios.tsx` | Add `topLessees`/`s3LeaseCount` to type + `buildRun()`; add `narrativeCache` state; pass narrative prop to `RunResultPanel`; call `generateNarrative` on first expand |
| Modify | `src/app/components/scenarios/RunResultPanel.tsx` | Accept `narrative` prop; add `NarrativeSummaryCard` as first rendered element |
| Create | `src/app/services/narrativeService.ts` | `generateNarrative()` — Azure call, prompt, validation |
| Modify | `.env.local` | Add `VITE_AZURE_OPENAI_ENDPOINT` and `VITE_AZURE_OPENAI_KEY` (placeholder values) |

---

## Out of Scope

- Persisting narratives to the database (runs are client-side mock; persistence is Phase 2)
- Regeneration button (narrative is generated once and cached for the session)
- Server-side proxying of the Azure key (acceptable for pilot; revisit before production)
- Streaming the response (4–6 sentences generate in ~1s; streaming adds complexity for minimal gain)
- Narratives for Monte Carlo runs that haven't yet been expanded (lazy prevents wasted calls)
