# P1-F2: LLM Narrative Summaries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After every scenario run, auto-generate a 4–6 sentence AI narrative summary that appears as a "Run Summary" card at the top of each scenario result panel, with skeleton loading while the Azure OpenAI call is in-flight, anchor validation before display, and a copy-to-clipboard button.

**Architecture:** Three units: `narrativeService.ts` owns the Azure OpenAI call, prompt injection, and 3-anchor validation (returns `string | null`); `NarrativeSummaryCard` (internal to `RunResultPanel.tsx`) renders skeleton → success → hidden states; `Scenarios.tsx` manages `narrativeCache: Map<runId, string | null | "loading">` with a `useRef<Set<string>>` dedup guard, generating on first `RunResultPanel` mount via the `onRequestNarrative` callback.

**Tech Stack:** React 18, TypeScript, Vite (VITE_ env vars), Azure OpenAI Chat Completions REST API (`fetch`), `lucide-react` (Copy/Check icons).

---

## File Map

| Action | File | Change |
|---|---|---|
| Modify | `src/app/components/scenarios/RunResultPanel.tsx` | Add `topLessees`/`s3LeaseCount` to interface; add `narrative`/`onRequestNarrative` props; add `NarrativeSummaryCard` internal component |
| Create | `src/app/services/narrativeService.ts` | `generateNarrative(run)` — Azure call, prompt, validation |
| Modify | `src/app/pages/Scenarios.tsx` | Add `STAGE3_LESSEES`/helpers/populate in `buildRun`, `buildTemplateRun`, `handleTemplateRun`, `INITIAL_RUNS`; add `narrativeCache` state + `handleRequestNarrative`; pass narrative props to 3 `RunResultPanel` usages |
| Modify | `.env.local` | Append `VITE_AZURE_OPENAI_ENDPOINT` and `VITE_AZURE_OPENAI_KEY` placeholder lines |

---

## Task 1: Extend Data Model — `topLessees` + `s3LeaseCount`

**Files:**
- Modify: `src/app/components/scenarios/RunResultPanel.tsx:9-27`
- Modify: `src/app/pages/Scenarios.tsx:66-143` (after compute helpers, before `hashFromSeed`)
- Modify: `src/app/pages/Scenarios.tsx:145-192` (`buildRun`)
- Modify: `src/app/pages/Scenarios.tsx:322-339` (`buildTemplateRun`)
- Modify: `src/app/pages/Scenarios.tsx:584-605` (`handleTemplateRun` inline object)
- Modify: `src/app/pages/Scenarios.tsx:350-365` (inline RUN-2024-0841 in `INITIAL_RUNS`)

---

- [ ] **Step 1: Add `topLessees` and `s3LeaseCount` to `ScenarioRunResult`**

In `src/app/components/scenarios/RunResultPanel.tsx`, the `ScenarioRunResult` interface ends at line 27. Add two fields at the end, before the closing `}`:

Old block (lines 9–27):
```typescript
export interface ScenarioRunResult {
  id: string;
  templateId: string | null;
  name: string;
  mode: "deterministic" | "montecarlo";
  paths: number | null;
  seed: number;
  runDate: string;
  durationSec: string;
  ecl: number; // $M, this is P50
  p5: number | null;
  p95: number | null;
  s1: number; // $M
  s2: number; // $M
  s3: number; // $M
  shapley: ShapleyDriver[];
  keyFinding: string;
  scenarioHash: string;
}
```

New block:
```typescript
export interface ScenarioRunResult {
  id: string;
  templateId: string | null;
  name: string;
  mode: "deterministic" | "montecarlo";
  paths: number | null;
  seed: number;
  runDate: string;
  durationSec: string;
  ecl: number; // $M, this is P50
  p5: number | null;
  p95: number | null;
  s1: number; // $M
  s2: number; // $M
  s3: number; // $M
  shapley: ShapleyDriver[];
  keyFinding: string;
  scenarioHash: string;
  topLessees: Array<{ name: string; ecl: number; jurisdiction: string }>;
  s3LeaseCount: number;
}
```

---

- [ ] **Step 2: Add `STAGE3_LESSEES`, `computeTopLessees`, and `computeS3LeaseCount` helpers to `Scenarios.tsx`**

In `src/app/pages/Scenarios.tsx`, insert this block immediately after `hashFromSeed` (currently around line 138) and before the `let runCounter` line:

```typescript
// ─── Narrative Helpers ────────────────────────────────────────────────────────

const STAGE3_LESSEES = [
  { name: "IndiGo Airlines",         jurisdiction: "India (IBC)" },
  { name: "Aeromexico",              jurisdiction: "Mexico (Concurso Mercantil)" },
  { name: "SriLankan Airlines",      jurisdiction: "Sri Lanka (Liquidation)" },
  { name: "Azul Brazilian Airlines", jurisdiction: "Brazil (Recuperação Judicial)" },
  { name: "Air Transat",             jurisdiction: "Canada (CCAA)" },
] as const;

function computeTopLessees(s3: number, seed: number): ScenarioRunResult["topLessees"] {
  const n = STAGE3_LESSEES.length;
  const idx1 = Math.floor(seededRand(seed, 20) * n);
  const idx2 = (idx1 + 1 + Math.floor(seededRand(seed, 21) * (n - 1))) % n;
  return [
    { ...STAGE3_LESSEES[idx1], ecl: parseFloat((s3 * 0.45).toFixed(1)) },
    { ...STAGE3_LESSEES[idx2], ecl: parseFloat((s3 * 0.28).toFixed(1)) },
  ];
}

function computeS3LeaseCount(s3: number): number {
  return Math.max(1, Math.round(s3 / 8.2));
}
```

---

- [ ] **Step 3: Update `buildRun()` return object**

In `buildRun()` (lines 173–192 after Step 2's insertions shift numbering), append two fields to the returned object. Find the `return {` block and add the two new fields right before the closing `};`:

Locate this block (end of the return statement):
```typescript
    shapley,
    keyFinding: keyFindings.join(" "),
    scenarioHash: hashFromSeed(seed).slice(0, 12),
  };
```

Replace with:
```typescript
    shapley,
    keyFinding: keyFindings.join(" "),
    scenarioHash: hashFromSeed(seed).slice(0, 12),
    topLessees: computeTopLessees(stages.s3, seed),
    s3LeaseCount: computeS3LeaseCount(stages.s3),
  };
```

---

- [ ] **Step 4: Update `buildTemplateRun()` return object**

Find the return block inside `buildTemplateRun()`:
```typescript
    shapley: tpl.shapley, keyFinding: tpl.keyFinding,
    scenarioHash: hashFromSeed(seed).slice(0, 12),
  };
```

Replace with:
```typescript
    shapley: tpl.shapley, keyFinding: tpl.keyFinding,
    scenarioHash: hashFromSeed(seed).slice(0, 12),
    topLessees: computeTopLessees(stages.s3, seed),
    s3LeaseCount: computeS3LeaseCount(stages.s3),
  };
```

---

- [ ] **Step 5: Update `handleTemplateRun` inline `newRun` object**

Inside `handleTemplateRun`, find the inline `newRun: ScenarioRunResult` object. Its closing block is:
```typescript
        shapley: tpl.shapley,
        keyFinding: tpl.keyFinding,
        scenarioHash: hashFromSeed(seed).slice(0, 12),
      };
```

Replace with:
```typescript
        shapley: tpl.shapley,
        keyFinding: tpl.keyFinding,
        scenarioHash: hashFromSeed(seed).slice(0, 12),
        topLessees: computeTopLessees(stages.s3, seed),
        s3LeaseCount: computeS3LeaseCount(stages.s3),
      };
```

---

- [ ] **Step 6: Update inline RUN-2024-0841 in `INITIAL_RUNS`**

The inline custom run object (seed: 77, s3: 31.3) needs the two new fields. Find:
```typescript
    keyFinding: "Single-lessee default scenario. ECL elevated by $14.0M vs baseline. P95 tail $112.7M. IndiGo §1110-equivalent cure window 30 days under IBC.",
    scenarioHash: hashFromSeed(77).slice(0, 12),
  },
```

Replace with:
```typescript
    keyFinding: "Single-lessee default scenario. ECL elevated by $14.0M vs baseline. P95 tail $112.7M. IndiGo §1110-equivalent cure window 30 days under IBC.",
    scenarioHash: hashFromSeed(77).slice(0, 12),
    topLessees: computeTopLessees(31.3, 77),
    s3LeaseCount: computeS3LeaseCount(31.3),
  },
```

---

- [ ] **Step 7: Run build to verify**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build
```

Expected: `✓ built in` with no TypeScript errors. The new fields are required on `ScenarioRunResult`, so any missed callsite will surface as a TS error here.

---

- [ ] **Step 8: Commit**

```bash
git add src/app/components/scenarios/RunResultPanel.tsx src/app/pages/Scenarios.tsx
git commit -m "feat(p1-f2): extend ScenarioRunResult with topLessees and s3LeaseCount"
```

---

## Task 2: Create `narrativeService.ts`

**Files:**
- Create: `src/app/services/narrativeService.ts`

---

- [ ] **Step 1: Create the service file**

Create `src/app/services/narrativeService.ts` with this full content:

```typescript
import type { ScenarioRunResult } from "../components/scenarios/RunResultPanel";

const BASE_ECL = 47.2;

export async function generateNarrative(run: ScenarioRunResult): Promise<string | null> {
  const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string | undefined;
  const apiKey   = import.meta.env.VITE_AZURE_OPENAI_KEY    as string | undefined;

  // Skip API call when env vars are absent or placeholder
  if (!endpoint || !apiKey || apiKey === "PLACEHOLDER" || endpoint === "PLACEHOLDER") {
    return null;
  }

  const eclPct      = ((run.ecl / 2840) * 100).toFixed(2);
  const changePct   = (((run.ecl - BASE_ECL) / BASE_ECL) * 100).toFixed(1);
  const changeLabel = run.ecl >= BASE_ECL ? "increase" : "decrease";
  const driver1     = run.shapley[0];
  const driver2     = run.shapley[1] ?? run.shapley[0];

  const prompt = `You are a financial risk analyst writing a factual run summary. Use ONLY the numbers provided below. Do not invent, infer, or round any value differently from what is shown. Output exactly 4-6 sentences. No bullet points. No headings. Plain prose only.

RUN DATA:
- Scenario: ${run.name}
- Portfolio ECL: $${run.ecl}M
- Book value: $2,840M
- ECL as % of book: ${eclPct}%
- Change vs. Baseline ($47.2M): ${changePct}%
- Stage 3 lease count: ${run.s3LeaseCount}
- Stage 3 ECL: $${run.s3}M
- Top lessee 1: ${run.topLessees[0].name}, $${run.topLessees[0].ecl}M, ${run.topLessees[0].jurisdiction}
- Top lessee 2: ${run.topLessees[1].name}, $${run.topLessees[1].ecl}M, ${run.topLessees[1].jurisdiction}
- Shapley driver 1: ${driver1.driver}, +${driver1.contribution.toFixed(0)}pp
- Shapley driver 2: ${driver2.driver}, +${driver2.contribution.toFixed(0)}pp
- Aircraft below carrying value: ${run.s3LeaseCount}

OUTPUT TEMPLATE (follow this structure exactly, substituting bracketed values):
"The [Scenario Name] scenario produces a portfolio ECL of $[ecl]M, representing [ecl%]% of book value and a [change]% ${changeLabel} vs. the Baseline. [s3LeaseCount] leases migrate to Stage 3 under this scenario, led by [lessee1] ($[ecl1]M ECL, [juris1]) and [lessee2] ($[ecl2]M ECL, [juris2]). The primary drivers are [driver1] (+[contribution1]pp contribution) and [driver2] (+[contribution2]pp contribution). [s3LeaseCount] aircraft have recoverable amounts below carrying value under this scenario, triggering potential IAS 36 review."`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 220,
        temperature: 0,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;

    // 3-anchor validation: each anchor must appear verbatim in the response
    const anchor1 = run.ecl.toFixed(1);                          // e.g. "61.2"
    const anchor2 = driver1.contribution.toFixed(0) + "pp";      // e.g. "46pp"
    const anchor3 = run.s3LeaseCount.toString();                  // e.g. "4"

    if (!text.includes(anchor1) || !text.includes(anchor2) || !text.includes(anchor3)) {
      return null;
    }

    return text.trim();
  } catch {
    return null;
  }
}
```

---

- [ ] **Step 2: Run build to verify**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build
```

Expected: `✓ built in` with no errors.

---

- [ ] **Step 3: Commit**

```bash
git add src/app/services/narrativeService.ts
git commit -m "feat(p1-f2): add narrativeService with Azure OpenAI call and 3-anchor validation"
```

---

## Task 3: Add `NarrativeSummaryCard` to `RunResultPanel.tsx`

**Files:**
- Modify: `src/app/components/scenarios/RunResultPanel.tsx`

---

- [ ] **Step 1: Add React hooks + lucide Copy/Check imports**

The current file starts with:
```typescript
import { X, Info } from "lucide-react";
```

Replace with:
```typescript
import { useState, useEffect } from "react";
import { X, Info, Copy, Check } from "lucide-react";
```

---

- [ ] **Step 2: Add `NarrativeSummaryCard` before the `Props` interface**

Insert this entire block between the `ScenarioRunResult` interface and the `interface Props` line:

```typescript
// ─── Shimmer animation (injected once) ───────────────────────────────────────

const SHIMMER_CSS = `
@keyframes narrative-shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
.narrative-shimmer {
  background: linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%);
  background-size: 1200px 100%;
  animation: narrative-shimmer 1.4s linear infinite;
  border-radius: 4px;
}
`;

// ─── NarrativeSummaryCard ─────────────────────────────────────────────────────

interface NarrativeSummaryCardProps {
  narrative: string | null | "loading";
}

function NarrativeSummaryCard({ narrative }: NarrativeSummaryCardProps) {
  const [copied, setCopied] = useState(false);

  // null means validation failed or API error — render nothing
  if (narrative === null) return null;

  const handleCopy = () => {
    if (typeof narrative === "string") {
      navigator.clipboard.writeText(narrative).catch(() => undefined);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div
        style={{
          background: narrative === "loading" ? "#FFFFFF" : "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderLeft: narrative === "loading" ? "1px solid #E2E8F0" : "3px solid #002147",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          marginBottom: "1rem",
        }}
      >
        {narrative === "loading" ? (
          <>
            {/* Header shimmer */}
            <div
              className="narrative-shimmer"
              style={{ width: "40%", height: "12px", marginBottom: "0.875rem" }}
            />
            {/* Body line shimmers */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div className="narrative-shimmer" style={{ width: "95%", height: "10px" }} />
              <div className="narrative-shimmer" style={{ width: "90%", height: "10px" }} />
              <div className="narrative-shimmer" style={{ width: "75%", height: "10px" }} />
            </div>
          </>
        ) : (
          <>
            {/* Header row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.625rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#002147",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                ✦ Run Summary
              </span>
              <button
                onClick={handleCopy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  background: "transparent",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0.375rem",
                  padding: "0.25rem 0.625rem",
                  fontSize: "0.75rem",
                  color: "#64748B",
                  cursor: "pointer",
                }}
              >
                {copied ? <Check size={12} color="#15803D" /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {/* Narrative text */}
            <p style={{ margin: 0, fontSize: "0.9375rem", color: "#334155", lineHeight: 1.7 }}>
              {narrative}
            </p>
          </>
        )}
      </div>
    </>
  );
}
```

---

- [ ] **Step 3: Add `narrative` and `onRequestNarrative` to the `Props` interface**

Current `Props`:
```typescript
interface Props {
  run: ScenarioRunResult;
  onClose?: () => void;
  compact?: boolean;
}
```

Replace with:
```typescript
interface Props {
  run: ScenarioRunResult;
  onClose?: () => void;
  compact?: boolean;
  narrative?: string | null | "loading";
  onRequestNarrative?: (runId: string) => void;
}
```

---

- [ ] **Step 4: Destructure new props + add `useEffect` in `RunResultPanel`**

Current function signature:
```typescript
export function RunResultPanel({ run, onClose, compact = false }: Props) {
  const totalECL = run.s1 + run.s2 + run.s3;
```

Replace with:
```typescript
export function RunResultPanel({ run, onClose, compact = false, narrative, onRequestNarrative }: Props) {
  const totalECL = run.s1 + run.s2 + run.s3;

  // Trigger narrative generation on first mount for this run
  useEffect(() => {
    onRequestNarrative?.(run.id);
  }, [run.id, onRequestNarrative]);
```

---

- [ ] **Step 5: Insert `<NarrativeSummaryCard>` as the first element inside the panel**

Inside the `return (` block, there is a `<div style={{ background: "#FAFAFA", ... }}>` container. The very first child inside it is the `{/* ── Header ── */}` comment block. Insert the card before it:

Find:
```typescript
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
```

Replace with:
```typescript
      {/* ── Narrative Summary Card ────────────────────────────── */}
      {narrative !== undefined && (
        <NarrativeSummaryCard narrative={narrative} />
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
```

---

- [ ] **Step 6: Run build to verify**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build
```

Expected: `✓ built in` with no errors.

---

- [ ] **Step 7: Commit**

```bash
git add src/app/components/scenarios/RunResultPanel.tsx
git commit -m "feat(p1-f2): add NarrativeSummaryCard with skeleton/success/null states to RunResultPanel"
```

---

## Task 4: Wire `narrativeCache` in `Scenarios.tsx`

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

---

- [ ] **Step 1: Add `useRef` to React import + import `generateNarrative`**

Current line 1:
```typescript
import React, { useState, useEffect, useCallback } from "react";
```

Replace with:
```typescript
import React, { useState, useEffect, useCallback, useRef } from "react";
```

After the existing `RunResultPanel` import block (around line 27–28), add:
```typescript
import { generateNarrative } from "../services/narrativeService";
```

---

- [ ] **Step 2: Add `narrativeCache` state, `requestedRunIds` ref, and `handleRequestNarrative` callback**

Inside the `Scenarios` component function, after the existing `const [expandedRunId, setExpandedRunId]` line (currently around line 656), add:

```typescript
  // ── Narrative cache ──
  const [narrativeCache, setNarrativeCache] = useState<Map<string, string | null | "loading">>(
    new Map()
  );
  const requestedRunIds = useRef<Set<string>>(new Set());

  const handleRequestNarrative = useCallback(
    async (runId: string) => {
      if (requestedRunIds.current.has(runId)) return;
      requestedRunIds.current.add(runId);
      const run = runs.find((r) => r.id === runId);
      if (!run) return;
      setNarrativeCache((prev) => new Map(prev).set(runId, "loading"));
      const result = await generateNarrative(run);
      setNarrativeCache((prev) => new Map(prev).set(runId, result));
    },
    [runs]
  );
```

---

- [ ] **Step 3: Add `getNarrative` helper just before the `return (`**

Insert this helper function just before `return (` in the `Scenarios` component. It handles the `null` case correctly — `Map.get()` returning `undefined` (key absent) → show skeleton; returning `null` (API failed) → hide card.

```typescript
  function getNarrative(runId: string): string | null | "loading" {
    if (!narrativeCache.has(runId)) return "loading";
    return narrativeCache.get(runId) as string | null | "loading";
  }
```

---

- [ ] **Step 4: Pass narrative props to the Library `RunResultPanel` (usage 1)**

Find the Library tab result panel (around line 861):
```typescript
                  <RunResultPanel run={result} compact />
```

Replace with:
```typescript
                  <RunResultPanel
                    run={result}
                    compact
                    narrative={getNarrative(result.id)}
                    onRequestNarrative={handleRequestNarrative}
                  />
```

---

- [ ] **Step 5: Pass narrative props to the Custom Builder `RunResultPanel` (usage 2)**

Find the Custom Builder result panel (around lines 994–1001):
```typescript
            {customResultId && findRun(customResultId) && (
              <div>
                <RunResultPanel
                  run={findRun(customResultId)!}
                  onClose={() => setCustomResultId(null)}
                />
              </div>
            )}
```

Replace with:
```typescript
            {customResultId && findRun(customResultId) && (
              <div>
                <RunResultPanel
                  run={findRun(customResultId)!}
                  onClose={() => setCustomResultId(null)}
                  narrative={getNarrative(customResultId)}
                  onRequestNarrative={handleRequestNarrative}
                />
              </div>
            )}
```

---

- [ ] **Step 6: Pass narrative props to the Run History `RunResultPanel` (usage 3)**

Find the Run History expanded row panel (around line 1197):
```typescript
                            <RunResultPanel run={run} />
```

Replace with:
```typescript
                            <RunResultPanel
                              run={run}
                              narrative={getNarrative(run.id)}
                              onRequestNarrative={handleRequestNarrative}
                            />
```

---

- [ ] **Step 7: Run build to verify**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build
```

Expected: `✓ built in` with no TypeScript errors.

---

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/Scenarios.tsx
git commit -m "feat(p1-f2): wire narrativeCache and handleRequestNarrative in Scenarios"
```

---

## Task 5: Add `.env.local` Placeholders + Final Verification

**Files:**
- Modify: `.env.local`

---

- [ ] **Step 1: Append Azure OpenAI env vars to `.env.local`**

The current `.env.local` has 4 lines (Auth0 + API base URL). Append these two lines:

```
VITE_AZURE_OPENAI_ENDPOINT=PLACEHOLDER
VITE_AZURE_OPENAI_KEY=PLACEHOLDER
```

The service checks `apiKey === "PLACEHOLDER"` and returns `null` immediately, so the UI gracefully hides the card when real credentials aren't configured. Replace `PLACEHOLDER` values with real Azure EU West Europe endpoint and key to enable live calls.

---

- [ ] **Step 2: Run final build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build
```

Expected: `✓ built in` with no errors. The feature is complete.

---

- [ ] **Step 3: Commit**

```bash
git add .env.local
git commit -m "feat(p1-f2): add Azure OpenAI env var placeholders to .env.local"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in task |
|---|---|
| `topLessees` + `s3LeaseCount` on `ScenarioRunResult` | Task 1 Steps 1–6 |
| `computeTopLessees` deterministic: idx1=45%, idx2=28% | Task 1 Step 2 |
| `computeS3LeaseCount = max(1, round(s3/8.2))` | Task 1 Step 2 |
| All 4 creation sites updated (buildRun, buildTemplateRun, handleTemplateRun, RUN-2024-0841) | Task 1 Steps 3–6 |
| `generateNarrative` returns `string \| null` | Task 2 |
| VITE env var names: `VITE_AZURE_OPENAI_ENDPOINT`, `VITE_AZURE_OPENAI_KEY` | Task 2, Task 5 |
| Prompt: single user message, all numbers injected, output template | Task 2 Step 1 |
| `max_tokens: 220`, `temperature: 0` | Task 2 Step 1 |
| 3-anchor validation: `ecl.toFixed(1)`, `contribution.toFixed(0)+"pp"`, `s3LeaseCount.toString()` | Task 2 Step 1 |
| All null cases: return null, card not rendered | Task 2 + Task 3 Step 2 |
| Shimmer: `@keyframes`, `#E2E8F0→#F1F5F9→#E2E8F0`, 1.4s linear | Task 3 Step 2 |
| Skeleton: 40% header bar, 95%/90%/75% text bars, 10px height | Task 3 Step 2 |
| Success: `3px solid #002147` left border, `#F8FAFC` bg | Task 3 Step 2 |
| `✦ Run Summary` header label (navy, 600 weight) | Task 3 Step 2 |
| Copy button: lucide-react `Copy`→`Check`, 1500ms revert | Task 3 Steps 1–2 |
| `null` state: card returns `null` | Task 3 Step 2 |
| `NarrativeSummaryCard` rendered as FIRST element | Task 3 Step 5 |
| `narrativeCache: Map<runId, string \| null \| "loading">` | Task 4 Step 2 |
| `useRef<Set<string>>` dedup guard | Task 4 Step 2 |
| Generation triggered on first `RunResultPanel` mount | Task 3 Step 4 |
| All 3 `RunResultPanel` usages wired | Task 4 Steps 4–6 |
| Re-expand uses cached value (no second API call) | Task 4 Step 2 — `requestedRunIds` ref prevents re-fire |
| `.env.local` placeholder entries | Task 5 Step 1 |

**Placeholder scan:** None found.

**Type consistency:** `ScenarioRunResult["topLessees"]` return type in `computeTopLessees` matches the interface exactly. `getNarrative` returns `string | null | "loading"` matching `NarrativeSummaryCardProps.narrative`. `handleRequestNarrative` signature `(runId: string) => void` matches `onRequestNarrative?: (runId: string) => void` prop.
