# ECL Scenario Insights Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `ScenarioInsightsPanel` — a new component that renders below `RunResultPanel` in all 5 scenario result locations, answering provision adequacy, lessee action, and board reporting needs.

**Architecture:** Single new presentational component with two exported pure functions (for testability) and one `useState` hook for the collapsible detail block. Wired into `Scenarios.tsx` at 5 existing `RunResultPanel` render sites. No new data fetching — all inputs come from the existing `ScenarioRunResult` shape and the `BASE_ECL` constant.

**Tech Stack:** React, TypeScript, lucide-react (already installed), vitest (existing test runner), inline styles following `RunResultPanel` conventions.

---

## Files

| Action | Path |
|--------|------|
| Create | `src/app/components/scenarios/ScenarioInsightsPanel.tsx` |
| Create | `src/app/components/scenarios/ScenarioInsightsPanel.test.ts` |
| Modify | `src/app/pages/Scenarios.tsx` |

---

### Task 1: Pure functions + tests

**Files:**
- Create: `src/app/components/scenarios/ScenarioInsightsPanel.test.ts`
- Create: `src/app/components/scenarios/ScenarioInsightsPanel.tsx` (exports only — no component yet)

- [ ] **Step 1: Create the test file**

```typescript
// src/app/components/scenarios/ScenarioInsightsPanel.test.ts
import { describe, it, expect } from "vitest";
import { deriveProvisionData, deriveRemainingS3 } from "./ScenarioInsightsPanel";
import type { ScenarioRunResult } from "./RunResultPanel";

// ── Minimal ScenarioRunResult factory ─────────────────────────────────────────
function makeRun(overrides: Partial<ScenarioRunResult> = {}): ScenarioRunResult {
  return {
    id: "run-001",
    templateId: null,
    name: "Baseline",
    mode: "deterministic",
    paths: null,
    seed: 42,
    runDate: "2026-05-20",
    durationSec: "0.4s",
    ecl: 61.2,
    p5: null,
    p95: null,
    s1: 18.4,
    s2: 11.5,
    s3: 31.3,
    shapley: [{ driver: "PD stress", contribution: 46, direction: "up" }],
    keyFinding: "ECL elevated.",
    scenarioHash: "abc123",
    topLessees: [
      { name: "Air Arabia", ecl: 14.1, jurisdiction: "UAE" },
      { name: "FlyDubai",   ecl: 8.8,  jurisdiction: "UAE" },
    ],
    s3LeaseCount: 2,
    ...overrides,
  };
}

// ── deriveProvisionData ────────────────────────────────────────────────────────

describe("deriveProvisionData", () => {
  it("flags under-provisioned when gap > 5% of baseECL", () => {
    const result = deriveProvisionData(61.2, 47.2);
    expect(result.adequacy).toBe("under");
    expect(result.gap).toBeCloseTo(14.0, 1);
    expect(result.gapPct).toBeCloseTo(29.66, 1);
  });

  it("flags over-provisioned when surplus > 5% of baseECL", () => {
    const result = deriveProvisionData(40.0, 47.2);
    expect(result.adequacy).toBe("over");
    expect(result.gap).toBeCloseTo(-7.2, 1);
  });

  it("flags adequate when gap is within ±5% of baseECL", () => {
    const result = deriveProvisionData(48.0, 47.2);
    expect(result.adequacy).toBe("adequate");
  });

  it("caps fillPct at 100 when ecl < baseECL", () => {
    const result = deriveProvisionData(30.0, 47.2);
    expect(result.fillPct).toBe(100);
  });

  it("computes fillPct correctly when ecl > baseECL", () => {
    const result = deriveProvisionData(61.2, 47.2);
    expect(result.fillPct).toBeCloseTo((47.2 / 61.2) * 100, 1);
  });
});

// ── deriveRemainingS3 ─────────────────────────────────────────────────────────

describe("deriveRemainingS3", () => {
  it("returns s3 minus top lessee sum", () => {
    const run = makeRun({ s3: 31.3, topLessees: [{ name: "A", ecl: 14.1, jurisdiction: "UAE" }, { name: "B", ecl: 8.8, jurisdiction: "UAE" }] });
    expect(deriveRemainingS3(run)).toBeCloseTo(8.4, 1);
  });

  it("returns 0 when top lessees account for all of s3", () => {
    const run = makeRun({ s3: 22.9, topLessees: [{ name: "A", ecl: 14.1, jurisdiction: "UAE" }, { name: "B", ecl: 8.8, jurisdiction: "UAE" }] });
    expect(deriveRemainingS3(run)).toBe(0);
  });

  it("never returns negative (guards rounding)", () => {
    const run = makeRun({ s3: 22.0, topLessees: [{ name: "A", ecl: 14.1, jurisdiction: "UAE" }, { name: "B", ecl: 8.8, jurisdiction: "UAE" }] });
    expect(deriveRemainingS3(run)).toBe(0);
  });

  it("returns s3 when topLessees is empty", () => {
    const run = makeRun({ s3: 31.3, topLessees: [] });
    expect(deriveRemainingS3(run)).toBeCloseTo(31.3, 1);
  });
});
```

- [ ] **Step 2: Run the tests — verify they fail**

```bash
npx vitest run src/app/components/scenarios/ScenarioInsightsPanel.test.ts
```

Expected: FAIL — `Cannot find module './ScenarioInsightsPanel'`

- [ ] **Step 3: Create ScenarioInsightsPanel.tsx with pure functions only**

```typescript
// src/app/components/scenarios/ScenarioInsightsPanel.tsx
import type { ScenarioRunResult } from "./RunResultPanel";

// ── Pure functions (exported for testing) ─────────────────────────────────────

export function deriveProvisionData(ecl: number, baseECL: number): {
  gap: number;
  gapPct: number;
  fillPct: number;
  adequacy: "under" | "over" | "adequate";
} {
  const gap = ecl - baseECL;
  const gapPct = (gap / baseECL) * 100;
  const fillPct = Math.min(100, (baseECL / ecl) * 100);
  const adequacy: "under" | "over" | "adequate" =
    gap > baseECL * 0.05  ? "under"
    : gap < -(baseECL * 0.05) ? "over"
    : "adequate";
  return { gap, gapPct, fillPct, adequacy };
}

export function deriveRemainingS3(run: ScenarioRunResult): number {
  const topSum = run.topLessees.reduce((s, l) => s + l.ecl, 0);
  return Math.max(0, run.s3 - topSum);
}

// Component will be added in Task 2
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/app/components/scenarios/ScenarioInsightsPanel.test.ts
```

Expected: PASS — 9 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add src/app/components/scenarios/ScenarioInsightsPanel.tsx src/app/components/scenarios/ScenarioInsightsPanel.test.ts
git commit -m "feat: add ScenarioInsightsPanel pure functions with tests"
```

---

### Task 2: Build the full component

**Files:**
- Modify: `src/app/components/scenarios/ScenarioInsightsPanel.tsx` (add component below the pure functions)

- [ ] **Step 1: Replace the file content with the complete component**

```tsx
// src/app/components/scenarios/ScenarioInsightsPanel.tsx
import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import type { ScenarioRunResult } from "./RunResultPanel";

// ── Pure functions (exported for testing) ─────────────────────────────────────

export function deriveProvisionData(ecl: number, baseECL: number): {
  gap: number;
  gapPct: number;
  fillPct: number;
  adequacy: "under" | "over" | "adequate";
} {
  const gap = ecl - baseECL;
  const gapPct = (gap / baseECL) * 100;
  const fillPct = Math.min(100, (baseECL / ecl) * 100);
  const adequacy: "under" | "over" | "adequate" =
    gap > baseECL * 0.05  ? "under"
    : gap < -(baseECL * 0.05) ? "over"
    : "adequate";
  return { gap, gapPct, fillPct, adequacy };
}

export function deriveRemainingS3(run: ScenarioRunResult): number {
  const topSum = run.topLessees.reduce((s, l) => s + l.ecl, 0);
  return Math.max(0, run.s3 - topSum);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  run: ScenarioRunResult;
  baseECL: number;
  compact?: boolean;
}

// ── Shared style constants ────────────────────────────────────────────────────

const SECTION_HDR: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "#94A3B8",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "0.75rem",
  display: "block",
};

const DIVIDER: React.CSSProperties = {
  borderTop: "1px solid #E2E8F0",
  paddingTop: "1rem",
  marginTop: "1rem",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ScenarioInsightsPanel({ run, baseECL, compact = false }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);

  if (baseECL === 0) return null;

  const { gap, gapPct, fillPct, adequacy } = deriveProvisionData(run.ecl, baseECL);
  const remainingS3 = deriveRemainingS3(run);

  const ADEQUACY_META = {
    under:    { label: "Under-provisioned", color: "#B91C1C", bg: "rgba(185,28,28,0.04)", border: "rgba(185,28,28,0.15)" },
    over:     { label: "Over-provisioned",  color: "#15803D", bg: "rgba(21,128,61,0.04)",  border: "rgba(21,128,61,0.15)"  },
    adequate: { label: "Adequate",          color: "#B45309", bg: "rgba(180,83,9,0.04)",   border: "rgba(180,83,9,0.15)"   },
  } as const;

  const am = ADEQUACY_META[adequacy];

  return (
    <div
      style={
        compact
          ? { padding: "12px 0 0" }
          : {
              background: "#FAFAFA",
              border: "1px solid #E2E8F0",
              borderRadius: "0.5rem",
              padding: "1.25rem",
              marginTop: "0.75rem",
            }
      }
    >

      {/* ── Section 1: Provision Gap ──────────────────────────────────────── */}
      <span style={SECTION_HDR}>Provision Adequacy</span>

      {/* Three stat boxes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.625rem",
          marginBottom: "0.875rem",
        }}
      >
        {(
          [
            { label: "Current Provision", value: `$${baseECL.toFixed(1)}M`, sub: "Baseline ECL",   color: "#0F172A" },
            { label: "This Scenario",     value: `$${run.ecl.toFixed(1)}M`, sub: "Portfolio ECL",  color: "#0F172A" },
            {
              label: gap >= 0 ? "Gap" : "Surplus",
              value: `${gap >= 0 ? "+" : ""}$${Math.abs(gap).toFixed(1)}M`,
              sub:   am.label,
              color: am.color,
            },
          ] as { label: string; value: string; sub: string; color: string }[]
        ).map(({ label, value, sub, color }) => (
          <div
            key={label}
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "0.375rem",
              padding: "0.625rem 0.75rem",
            }}
          >
            <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginBottom: "0.25rem" }}>
              {label}
            </div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Fill bar */}
      <div style={{ marginBottom: "0.5rem" }}>
        <div
          style={{
            height: "6px",
            background: "#E2E8F0",
            borderRadius: "3px",
            overflow: "hidden",
            marginBottom: "0.375rem",
          }}
        >
          <div
            style={{
              width: `${fillPct}%`,
              height: "100%",
              background: "#002147",
              borderRadius: "3px",
            }}
          />
        </div>
        <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
          ${baseECL.toFixed(1)}M of ${run.ecl.toFixed(1)}M covered ({fillPct.toFixed(1)}%)
        </div>
      </div>

      {/* IFRS 9 line — only when under-provisioned */}
      {adequacy === "under" && (
        <div
          style={{
            background: am.bg,
            border: `1px solid ${am.border}`,
            borderRadius: "0.375rem",
            padding: "0.625rem 0.75rem",
            fontSize: "0.8125rem",
            color: "#334155",
            lineHeight: 1.5,
            marginTop: "0.625rem",
          }}
        >
          Under IFRS 9 §63, a significant increase in credit risk requires lifetime ECL
          recognition. Consider a provision top-up of{" "}
          <strong>${gap.toFixed(1)}M</strong> before next reporting period.
        </div>
      )}

      {/* ── Section 2: Stage 3 Exposures ──────────────────────────────────── */}
      <div style={DIVIDER}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.75rem",
          }}
        >
          <span style={{ ...SECTION_HDR, marginBottom: 0 }}>Stage 3 Exposures</span>
          <span
            title="Stage 3 assets are credit-impaired. Full lifetime ECL is recognised and individual lessee assessment is required under IFRS 9."
            style={{ display: "flex", alignItems: "center" }}
          >
            <Info size={11} color="#94A3B8" />
          </span>
          {run.s3LeaseCount > 0 && (
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                background: "rgba(185,28,28,0.08)",
                color: "#B91C1C",
                border: "1px solid rgba(185,28,28,0.2)",
                borderRadius: "9999px",
                padding: "0.1rem 0.5rem",
              }}
            >
              {run.s3LeaseCount} lessee{run.s3LeaseCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {run.s3 === 0 || run.topLessees.length === 0 ? (
          <div style={{ fontSize: "0.8125rem", color: "#94A3B8", fontStyle: "italic" }}>
            No Stage 3 exposures in this scenario — portfolio performing within expected
            parameters.
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {(["Lessee", "Jurisdiction", "ECL", "% of S3", "Action"] as const).map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === "Action" ? "center" : "left",
                          padding: "0.375rem 0.5rem",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          color: "#94A3B8",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {run.topLessees.map((l) => (
                  <tr key={l.name} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 500, color: "#0F172A" }}>
                      {l.name}
                    </td>
                    <td style={{ padding: "0.5rem", color: "#475569" }}>{l.jurisdiction}</td>
                    <td
                      style={{
                        padding: "0.5rem",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                        color: "#B91C1C",
                      }}
                    >
                      ${l.ecl.toFixed(1)}M
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        color: "#475569",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {run.s3 > 0 ? ((l.ecl / run.s3) * 100).toFixed(0) : "0"}%
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          background: "rgba(180,83,9,0.08)",
                          color: "#B45309",
                          border: "1px solid rgba(180,83,9,0.2)",
                          borderRadius: "0.25rem",
                          padding: "0.125rem 0.5rem",
                        }}
                      >
                        Review
                      </span>
                    </td>
                  </tr>
                ))}

                {remainingS3 > 0 && (
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td
                      colSpan={2}
                      style={{ padding: "0.5rem", color: "#94A3B8", fontStyle: "italic" }}
                    >
                      Remaining S3
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        fontVariantNumeric: "tabular-nums",
                        color: "#94A3B8",
                      }}
                    >
                      ${remainingS3.toFixed(1)}M
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        color: "#94A3B8",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {run.s3 > 0 ? ((remainingS3 / run.s3) * 100).toFixed(0) : "0"}%
                    </td>
                    <td />
                  </tr>
                )}

                <tr style={{ borderTop: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                  <td
                    colSpan={2}
                    style={{ padding: "0.5rem", fontWeight: 600, color: "#0F172A" }}
                  >
                    Total Stage 3
                  </td>
                  <td
                    style={{
                      padding: "0.5rem",
                      fontWeight: 700,
                      color: "#B91C1C",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${run.s3.toFixed(1)}M
                  </td>
                  <td style={{ padding: "0.5rem", fontWeight: 600, color: "#0F172A" }}>
                    100%
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>

            {/* Stage footnotes */}
            <div
              style={{ marginTop: "0.625rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}
            >
              {run.s1 > 0 && (
                <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                  <span style={{ fontWeight: 600, color: "#15803D" }}>Stage 1</span>{" "}
                  ${run.s1.toFixed(1)}M · Performing — 12-month ECL
                </div>
              )}
              {run.s2 > 0 && (
                <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                  <span style={{ fontWeight: 600, color: "#B45309" }}>Stage 2</span>{" "}
                  ${run.s2.toFixed(1)}M · Credit deteriorated — lifetime ECL
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Section 3: Recommended Actions ────────────────────────────────── */}
      <div style={DIVIDER}>
        <span style={SECTION_HDR}>Recommended Actions</span>

        <ol
          style={{
            margin: "0 0 0.875rem",
            padding: "0 0 0 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {gap > 0 && (
            <li style={{ fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.5 }}>
              Top up provisions by <strong>${gap.toFixed(1)}M</strong> before next reporting
              period
            </li>
          )}
          {run.s3LeaseCount > 0 && (
            <li style={{ fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.5 }}>
              Conduct individual assessment on{" "}
              <strong>
                {run.s3LeaseCount} Stage 3 lessee
                {run.s3LeaseCount !== 1 ? "s" : ""}
              </strong>
            </li>
          )}
          <li style={{ fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.5 }}>
            Present scenario delta (
            <strong>
              {gapPct >= 0 ? "+" : ""}
              {gapPct.toFixed(1)}%
            </strong>{" "}
            vs baseline) to credit committee with Shapley attribution
          </li>
        </ol>

        {/* Collapsible detail */}
        <button
          onClick={() => setDetailOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.375rem",
            background: "transparent",
            border: "1px solid #E2E8F0",
            borderRadius: "0.375rem",
            padding: "0.375rem 0.75rem",
            fontSize: "0.75rem",
            color: "#64748B",
            cursor: "pointer",
            width: "100%",
          }}
        >
          <span>Detail for audit / board pack</span>
          {detailOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {detailOpen && (
          <div
            style={{
              marginTop: "0.625rem",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "0.375rem",
              padding: "0.875rem",
            }}
          >
            {(
              [
                { label: "Current provision (baseline ECL)", value: `$${baseECL.toFixed(1)}M` },
                {
                  label: `This scenario ECL${run.mode === "montecarlo" ? " (P50)" : ""}`,
                  value: `$${run.ecl.toFixed(1)}M`,
                },
                ...(gap > 0
                  ? [{ label: "Required top-up", value: `$${gap.toFixed(1)}M` }]
                  : []),
                { label: "Stage 3 lease count", value: String(run.s3LeaseCount) },
                ...(run.shapley.length > 0
                  ? [
                      {
                        label: "Primary driver",
                        value: `${run.shapley[0].driver} +${run.shapley[0].contribution.toFixed(0)}pp`,
                      },
                    ]
                  : []),
                { label: "IFRS 9 reference", value: "§63, §B5.5.15–17" },
                { label: "Run ID",        value: run.id },
                { label: "Scenario hash", value: run.scenarioHash },
              ] as { label: string; value: string }[]
            ).map(({ label, value }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "0.375rem 0",
                  borderBottom: "1px solid #F1F5F9",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "#64748B" }}>{label}</span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    fontFamily:
                      label.includes("ID") || label.includes("hash")
                        ? "monospace"
                        : "inherit",
                    textAlign: "right",
                    maxWidth: "60%",
                    wordBreak: "break-all",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run existing tests — verify nothing broke**

```bash
npx vitest run src/app/components/scenarios/ScenarioInsightsPanel.test.ts
```

Expected: PASS — 9 tests

- [ ] **Step 3: Commit**

```bash
git add src/app/components/scenarios/ScenarioInsightsPanel.tsx
git commit -m "feat: build ScenarioInsightsPanel with provision gap, lessee table, actions"
```

---

### Task 3: Wire into Scenarios.tsx

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

There are 5 locations where `<RunResultPanel ... />` is rendered. Find each by searching for `<RunResultPanel` and add `<ScenarioInsightsPanel>` immediately after.

- [ ] **Step 1: Add the import at the top of Scenarios.tsx**

Find the existing import line:
```typescript
import {
  RunResultPanel,
  type ScenarioRunResult,
  type ShapleyDriver,
} from "../components/scenarios/RunResultPanel";
```

Replace it with:
```typescript
import {
  RunResultPanel,
  type ScenarioRunResult,
  type ShapleyDriver,
} from "../components/scenarios/RunResultPanel";
import { ScenarioInsightsPanel } from "../components/scenarios/ScenarioInsightsPanel";
```

- [ ] **Step 2: Wire location 1 — Library standard scenario cards (around line 1567)**

Find:
```tsx
<RunResultPanel
  run={result}
  compact
  narrative={getNarrative(result.id)}
  onRequestNarrative={handleRequestNarrative}
/>
```
(Inside `cs.phase === "done"` block under Library standard scenarios)

Replace with:
```tsx
<RunResultPanel
  run={result}
  compact
  narrative={getNarrative(result.id)}
  onRequestNarrative={handleRequestNarrative}
/>
<ScenarioInsightsPanel run={result} baseECL={BASE_ECL} compact />
```

- [ ] **Step 3: Wire location 2 — Library distress scenario cards (around line 1796)**

Find the second:
```tsx
<RunResultPanel
  run={result}
  compact
  narrative={getNarrative(result.id)}
  onRequestNarrative={handleRequestNarrative}
/>
```
(Inside the distress scenario `.map()` block)

Replace with:
```tsx
<RunResultPanel
  run={result}
  compact
  narrative={getNarrative(result.id)}
  onRequestNarrative={handleRequestNarrative}
/>
<ScenarioInsightsPanel run={result} baseECL={BASE_ECL} compact />
```

- [ ] **Step 4: Wire location 3 — Custom Builder result (around line 2027)**

Find the third:
```tsx
<RunResultPanel
  run={result}
  compact
  narrative={getNarrative(result.id)}
  onRequestNarrative={handleRequestNarrative}
/>
```
(Inside Custom Builder tab result block)

Replace with:
```tsx
<RunResultPanel
  run={result}
  compact
  narrative={getNarrative(result.id)}
  onRequestNarrative={handleRequestNarrative}
/>
<ScenarioInsightsPanel run={result} baseECL={BASE_ECL} compact />
```

- [ ] **Step 5: Wire location 4 — Run History expanded rows (around line 3342)**

Find:
```tsx
<RunResultPanel
  run={run}
  compact
  narrative={getNarrative(run.id)}
  onRequestNarrative={handleRequestNarrative}
/>
```
(Inside Run History tab expanded row)

Replace with:
```tsx
<RunResultPanel
  run={run}
  compact
  narrative={getNarrative(run.id)}
  onRequestNarrative={handleRequestNarrative}
/>
<ScenarioInsightsPanel run={run} baseECL={BASE_ECL} compact />
```

- [ ] **Step 6: Wire location 5 — Run History panel (around line 3605)**

Find the fifth `<RunResultPanel`:
```tsx
<RunResultPanel
  run={run}
  narrative={getNarrative(run.id)}
  onRequestNarrative={handleRequestNarrative}
/>
```
(Without `compact` — the full-width panel variant)

Replace with:
```tsx
<RunResultPanel
  run={run}
  narrative={getNarrative(run.id)}
  onRequestNarrative={handleRequestNarrative}
/>
<ScenarioInsightsPanel run={run} baseECL={BASE_ECL} />
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: All existing tests pass. No TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/Scenarios.tsx
git commit -m "feat: wire ScenarioInsightsPanel into all 5 scenario result locations"
```

- [ ] **Step 9: Push to Vercel**

```bash
git push origin main
```
