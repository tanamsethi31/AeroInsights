# ECL Scenario Insights Panel — Implementation Design

**Goal:** Add a `ScenarioInsightsPanel` component that renders below `RunResultPanel` in all scenario result locations, answering the three questions a portfolio manager needs: "Do I need to top up provisions?", "Which lessees do I act on?", and "What do I tell the board?"

**Architecture:** New standalone component `ScenarioInsightsPanel` receives `run: ScenarioRunResult` and `baseECL: number`. Three always-visible sections render top to bottom: Provision Gap, Stage 3 Exposures, Recommended Actions. No new data fetching — all inputs are derived from the existing `ScenarioRunResult` shape and the `BASE_ECL` constant already imported in `Scenarios.tsx`.

**Tech Stack:** React, TypeScript, existing inline style conventions (no new CSS files), lucide-react icons already installed.

---

## Files

| Action | Path |
|--------|------|
| Create | `src/app/components/scenarios/ScenarioInsightsPanel.tsx` |
| Modify | `src/app/pages/Scenarios.tsx` |

---

## Props Interface

```typescript
// src/app/components/scenarios/ScenarioInsightsPanel.tsx

interface Props {
  run: ScenarioRunResult;  // same run object passed to RunResultPanel
  baseECL: number;         // current provision anchor — pass BASE_ECL from Scenarios.tsx
  compact?: boolean;       // when true, remove outer border/background (matches RunResultPanel compact)
}
```

---

## Section 1 — Provision Gap

Always expanded. No collapse.

**Layout:** Three stat boxes in a row (Current Provision / This Scenario / Gap), then a fill bar, then a conditional IFRS 9 line.

**Derived values:**
```typescript
const gap = run.ecl - baseECL;                        // +ve = under, -ve = over
const gapPct = (gap / baseECL) * 100;
const fillPct = Math.min(100, (baseECL / run.ecl) * 100);  // capped at 100
const adequacy: "under" | "over" | "adequate" =
  gap > baseECL * 0.05  ? "under"    // >5% short
  : gap < -(baseECL * 0.05) ? "over" // >5% surplus
  : "adequate";
```

**Adequacy badge:**
| State | Badge text | Colour |
|-------|-----------|--------|
| under | Under-provisioned | Red `#B91C1C` |
| over | Over-provisioned | Green `#15803D` |
| adequate | Adequate | Amber `#B45309` |

**Fill bar:** `baseECL / run.ecl` width in `#002147`, remainder in `#E2E8F0`. Always shows `$${baseECL.toFixed(1)}M of $${run.ecl.toFixed(1)}M covered`.

**IFRS 9 line:** Only rendered when `adequacy === "under"`:
> *"Under IFRS 9 §63, a significant increase in credit risk requires lifetime ECL recognition. Consider a provision top-up of $[gap.toFixed(1)]M before next reporting period."*

---

## Section 2 — Stage 3 Exposures

Always expanded. No collapse.

**Header:** "STAGE 3 EXPOSURES" label + ⓘ icon + lessee count badge (`run.s3LeaseCount` lessees).

**ⓘ tooltip text:** `"Stage 3 assets are credit-impaired. Full lifetime ECL is recognised and individual lessee assessment is required under IFRS 9."`

**Table columns:** Lessee | Jurisdiction | ECL | % of S3 | Action

**Rows:**
- One row per entry in `run.topLessees`: `ecl` from the array, `pct = (lessee.ecl / run.s3 * 100).toFixed(0) + "%"`, Action = "Review" badge (always, for all S3 lessees)
- "Remaining S3" row: ECL = `Math.max(0, run.s3 - run.topLessees.reduce((s, l) => s + l.ecl, 0))`. Only shown when result > 0. No Action badge.
- "Total Stage 3" footer row: ECL = `run.s3`, bold.

**Stage footnotes** (below table, two lines):
```
Stage 1  $[s1]M · Performing — 12-month ECL
Stage 2  $[s2]M · Credit deteriorated — lifetime ECL
```
Only shown when `run.s1 > 0` or `run.s2 > 0` respectively.

**Empty state:** When `run.s3 === 0`, render: *"No Stage 3 exposures in this scenario — portfolio performing within expected parameters."*

---

## Section 3 — Recommended Actions

**Headline bullets** (always visible): 1–3 items, each conditionally rendered:

| # | Condition | Text |
|---|-----------|------|
| ① | `gap > 0` | `"Top up provisions by $${gap.toFixed(1)}M before next reporting period"` |
| ② | `run.s3LeaseCount > 0` | `"Conduct individual assessment on ${run.s3LeaseCount} Stage 3 lessee${run.s3LeaseCount !== 1 ? 's' : ''}"` |
| ③ | always | `"Present scenario delta (${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(1)}% vs baseline) to credit committee with Shapley attribution"` |

**Collapsible detail block** (collapsed by default, "Detail for audit / board pack" toggle):

| Field | Value |
|-------|-------|
| Current provision (baseline ECL) | `$${baseECL.toFixed(1)}M` |
| This scenario ECL | `$${run.ecl.toFixed(1)}M` + ` (P50)` suffix when `run.mode === "montecarlo"` |
| Required top-up | `$${gap.toFixed(1)}M` — only shown when `gap > 0` |
| Stage 3 lease count | `run.s3LeaseCount` |
| Primary driver | `run.shapley[0].driver` + ` +${run.shapley[0].contribution.toFixed(0)}pp` |
| IFRS 9 reference | `§63, §B5.5.15–17` (static) |
| Run ID | `run.id` |
| Scenario hash | `run.scenarioHash` |

---

## Integration in Scenarios.tsx

In all 5 locations where `<RunResultPanel ... />` is rendered, add `<ScenarioInsightsPanel>` immediately after:

```tsx
<RunResultPanel
  run={result}
  compact
  narrative={getNarrative(result.id)}
  onRequestNarrative={handleRequestNarrative}
/>
<ScenarioInsightsPanel
  run={result}
  baseECL={BASE_ECL}
  compact
/>
```

`BASE_ECL` is already imported in `Scenarios.tsx` from `../utils/eclCalculator`.

The 5 locations are:
1. Library tab — standard scenario cards (`cs.phase === "done"`)
2. Library tab — distress scenario cards (`cs.phase === "done"`)
3. Custom Builder tab — custom run result
4. Run History tab — expanded run rows
5. Executive mode — whichever panels render `RunResultPanel`

---

## Visual Style

Follows existing `RunResultPanel` conventions:
- Outer wrapper: `background: #FAFAFA`, `border: 1px solid #E2E8F0`, `borderRadius: 0.5rem`, `padding: 1.25rem` (omitted when `compact`)
- Section headers: `fontSize: 0.6875rem`, `fontWeight: 600`, `color: #94A3B8`, `textTransform: uppercase`, `letterSpacing: 0.06em`
- Dividers between sections: `borderTop: 1px solid #E2E8F0`, `paddingTop: 1rem`, `marginTop: 1rem`
- Colour palette: red `#B91C1C`, amber `#B45309`, green `#15803D`, navy `#002147`, slate `#475569`

---

## Error / Edge Cases

- `run.s3 === 0`: Section 2 shows empty state; Action ② suppressed; Section 1 still renders (gap may be negative)
- `run.topLessees.length === 1`: Single lessee row + "Remaining S3" row; no crash
- `run.topLessees.length === 0`: Section 2 shows empty state only
- `run.shapley.length === 0`: Primary driver row omitted from detail block
- `baseECL === 0`: Guard — render nothing for Provision Gap section (avoid divide-by-zero)
- MC mode: append `(P50)` to ECL value in detail block; deterministic: no suffix

---

## Testing

No new test file required — `ScenarioInsightsPanel` is pure presentational (no hooks, no async). Verified visually against all 5 render locations in `Scenarios.tsx`.
