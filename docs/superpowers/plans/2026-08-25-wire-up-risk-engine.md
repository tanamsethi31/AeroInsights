# Wire Up the Real Risk Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the real IFRS-9 risk engine (`api/risk-engine/compute.py`) the authoritative `baseECL` source for orgs with a real uploaded portfolio, replacing the client-side `toDashboardKPIs` fallback wherever it's currently the only source — with zero change to demo-mode behaviour.

**Architecture:** A new hook (`useRiskEngineECL`) fetches `total_ecl` from the engine once per `orgId` (cached in a module-level `Map`, so navigating between pages within the same session doesn't refetch), only for orgs with `hasUpload === true`. A new pure function (`resolveBaseECL`) centralizes the precedence rule — engine result wins for unscoped views when available, otherwise fall back to the existing `toDashboardKPIs`/`BASE_ECL` chain unchanged — and replaces four copies of that same ternary currently duplicated across the app. A small presentational component shows a loading/error indicator near each page's header.

**Tech Stack:** React, TypeScript, Vitest. No new dependencies.

Spec: `docs/superpowers/specs/2026-08-25-wire-up-risk-engine-design.md`

---

### Task 1: `resolveBaseECL` — the shared precedence rule

**Files:**
- Modify: `src/app/utils/eclCalculator.ts` (add function, end of file)
- Modify: `src/app/utils/eclCalculator.test.ts` (add tests, end of file)

- [x] **Step 1: Write the failing tests**

Append to `src/app/utils/eclCalculator.test.ts`:

```ts
describe("resolveBaseECL", () => {
  it("uses the engine value when unscoped and available", () => {
    expect(resolveBaseECL({ isUnscoped: true, engineECL: 62.5, kpisTotalECLm: 10 })).toBe(62.5);
  });

  it("ignores the engine value when scoped, even if available", () => {
    expect(resolveBaseECL({ isUnscoped: false, engineECL: 62.5, kpisTotalECLm: 10 })).toBe(10);
  });

  it("falls back to kpisTotalECLm when the engine value is null", () => {
    expect(resolveBaseECL({ isUnscoped: true, engineECL: null, kpisTotalECLm: 10 })).toBe(10);
  });

  it("falls back to BASE_ECL when kpisTotalECLm is zero and no engine value", () => {
    expect(resolveBaseECL({ isUnscoped: true, engineECL: null, kpisTotalECLm: 0 })).toBe(BASE_ECL);
  });

  it("falls back to BASE_ECL when scoped and kpisTotalECLm is zero", () => {
    expect(resolveBaseECL({ isUnscoped: false, engineECL: 62.5, kpisTotalECLm: 0 })).toBe(BASE_ECL);
  });
});
```

Add `resolveBaseECL` to the existing `import { ... } from "./eclCalculator"` block at the top of the same test file (it currently imports `BASE_ECL, LGD_DELTAS, ZERO_INPUTS, computeECL, computeECLFromBase, computeStages` — add `resolveBaseECL` to that list).

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/utils/eclCalculator.test.ts -t resolveBaseECL`
Expected: FAIL with "resolveBaseECL is not a function" (or similar — it doesn't exist yet)

- [x] **Step 3: Implement `resolveBaseECL`**

Append to `src/app/utils/eclCalculator.ts` (after the existing exports, end of file):

```ts
// ─── Live-engine precedence ─────────────────────────────────────────────────
//
// The 4 call sites that need a "current portfolio baseline" (RiskECL,
// Scenarios, CustomBuilderPage, ConcentrationStressTab) each used to
// duplicate the same ternary: use the client-side toDashboardKPIs sum if
// it's non-zero, otherwise BASE_ECL. This centralizes that rule and adds
// one more tier ahead of it: the real risk-engine's computed total, when
// the view isn't scoped down to a subset the engine can't represent
// (see docs/superpowers/specs/2026-08-25-wire-up-risk-engine-design.md).
export function resolveBaseECL(params: {
  isUnscoped: boolean;
  engineECL: number | null;
  kpisTotalECLm: number;
}): number {
  const { isUnscoped, engineECL, kpisTotalECLm } = params;
  if (isUnscoped && engineECL !== null) return engineECL;
  return kpisTotalECLm > 0 ? kpisTotalECLm : BASE_ECL;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/utils/eclCalculator.test.ts -t resolveBaseECL`
Expected: PASS (5 tests)

- [x] **Step 5: Commit**

```bash
git add src/app/utils/eclCalculator.ts src/app/utils/eclCalculator.test.ts
git commit -m "feat: add resolveBaseECL precedence rule for the live risk engine"
```

---

### Task 2: `useRiskEngineECL` hook

**Files:**
- Create: `src/app/hooks/useRiskEngineECL.ts`
- Create: `src/app/hooks/useRiskEngineECL.test.ts`

The hook itself is not unit-tested (this codebase has no `renderHook`/`@testing-library/react` convention — every existing hook test, e.g. `useMrEvidenceUpload.test.ts`, tests only the pure helper function(s) a hook exports, not the hook via a render harness). `parseRiskEngineResponse` is the pure, testable piece.

- [x] **Step 1: Write the failing tests**

Create `src/app/hooks/useRiskEngineECL.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseRiskEngineResponse } from "./useRiskEngineECL";

describe("parseRiskEngineResponse", () => {
  it("extracts total_ecl on a 200 with a numeric total_ecl", () => {
    expect(parseRiskEngineResponse(200, { total_ecl: 58.3 })).toEqual({ ecl: 58.3, error: null });
  });

  it("treats a 200 with a non-numeric total_ecl as an error", () => {
    expect(parseRiskEngineResponse(200, { total_ecl: "58.3" })).toEqual({
      ecl: null,
      error: "HTTP 200",
    });
  });

  it("uses the response's error message on a non-200 status", () => {
    expect(parseRiskEngineResponse(500, { error: "Supabase read failed: timeout" })).toEqual({
      ecl: null,
      error: "Supabase read failed: timeout",
    });
  });

  it("falls back to a generic HTTP status message when the body has no error field", () => {
    expect(parseRiskEngineResponse(502, null)).toEqual({ ecl: null, error: "HTTP 502" });
  });

  it("falls back to a generic HTTP status message when the body isn't an object", () => {
    expect(parseRiskEngineResponse(400, "not json")).toEqual({ ecl: null, error: "HTTP 400" });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/hooks/useRiskEngineECL.test.ts`
Expected: FAIL — `./useRiskEngineECL` doesn't exist yet

- [x] **Step 3: Implement the hook**

Create `src/app/hooks/useRiskEngineECL.ts`:

```ts
// src/app/hooks/useRiskEngineECL.ts
//
// Fetches the real per-lease IFRS-9 ECL total from api/risk-engine/compute.py
// for orgs with a real uploaded portfolio. Demo orgs (hasUpload === false)
// never call it — see docs/superpowers/specs/2026-08-25-wire-up-risk-engine-design.md
// for why (the sample portfolio has no backing Supabase rows, so the engine
// would correctly return $0).
import { useState, useEffect } from "react";
import { useData } from "../contexts/DataContext";

export interface RiskEngineECL {
  /** total_ecl in $M from the engine, or null while loading / unavailable / not applicable. */
  ecl: number | null;
  loading: boolean;
  error: string | null;
}

const IDLE: RiskEngineECL = { ecl: null, loading: false, error: null };

export function parseRiskEngineResponse(
  status: number,
  body: unknown,
): { ecl: number | null; error: string | null } {
  if (
    status === 200 &&
    body !== null &&
    typeof body === "object" &&
    typeof (body as { total_ecl?: unknown }).total_ecl === "number"
  ) {
    return { ecl: (body as { total_ecl: number }).total_ecl, error: null };
  }
  const message =
    body !== null && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : `HTTP ${status}`;
  return { ecl: null, error: message };
}

// Module-level so a result survives remounts within the same SPA session
// (e.g. navigating Risk & ECL → Scenarios → back) without refetching. Not
// persisted anywhere — a hard page reload starts fresh, which is what
// "once per session" means here.
const cache = new Map<string, RiskEngineECL>();

export function useRiskEngineECL(): RiskEngineECL {
  const { orgId, hasUpload } = useData();
  const [result, setResult] = useState<RiskEngineECL>(IDLE);

  useEffect(() => {
    if (!hasUpload || !orgId) {
      setResult(IDLE);
      return;
    }
    const cached = cache.get(orgId);
    if (cached) {
      setResult(cached);
      return;
    }

    const ctrl = new AbortController();
    setResult({ ecl: null, loading: true, error: null });

    (async () => {
      try {
        const res = await fetch("/api/risk-engine/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Org-Id": orgId },
          body: JSON.stringify({ org_id: orgId, persist: false }),
          signal: ctrl.signal,
        });
        const body = await res.json().catch(() => null);
        if (ctrl.signal.aborted) return;
        const parsed = parseRiskEngineResponse(res.status, body);
        const next: RiskEngineECL = { ecl: parsed.ecl, loading: false, error: parsed.error };
        cache.set(orgId, next);
        setResult(next);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const next: RiskEngineECL = {
          ecl: null,
          loading: false,
          error: err instanceof Error ? err.message : "Network error",
        };
        cache.set(orgId, next);
        setResult(next);
      }
    })();

    return () => ctrl.abort();
  }, [orgId, hasUpload]);

  return result;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/hooks/useRiskEngineECL.test.ts`
Expected: PASS (5 tests)

- [x] **Step 5: Commit**

```bash
git add src/app/hooks/useRiskEngineECL.ts src/app/hooks/useRiskEngineECL.test.ts
git commit -m "feat: add useRiskEngineECL hook"
```

---

### Task 3: `RiskEngineStatusBanner` component

**Files:**
- Create: `src/app/components/ui/RiskEngineStatusBanner.tsx`

No test — this is a trivial presentational component with no logic branches worth unit-testing (matches the convention already followed by sibling components like `KpiCard`/`StatusPill`, which also have no test files).

- [x] **Step 1: Implement the component**

Create `src/app/components/ui/RiskEngineStatusBanner.tsx`:

```tsx
// src/app/components/ui/RiskEngineStatusBanner.tsx
//
// Shown near the top of pages that consume useRiskEngineECL, for orgs with
// a real uploaded portfolio only (demo orgs never see this — loading and
// error are both always false/null for them, so this renders nothing).
interface Props {
  loading: boolean;
  error: string | null;
}

export function RiskEngineStatusBanner({ loading, error }: Props) {
  if (loading) {
    return (
      <div style={{ fontSize: "0.8125rem", color: "#64748B", marginBottom: "0.75rem" }}>
        Computing live portfolio ECL…
      </div>
    );
  }
  if (error) {
    return (
      <div
        style={{
          fontSize: "0.8125rem",
          color: "#92400E",
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: "0.5rem",
          padding: "0.5rem 0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        Live ECL unavailable — showing estimated figures.
      </div>
    );
  }
  return null;
}
```

- [x] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors mentioning `RiskEngineStatusBanner.tsx`

- [x] **Step 3: Commit**

```bash
git add src/app/components/ui/RiskEngineStatusBanner.tsx
git commit -m "feat: add RiskEngineStatusBanner component"
```

---

### Task 4: Wire into RiskECL.tsx

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

- [x] **Step 1: Add imports**

In `src/app/pages/RiskECL.tsx`, find (around line 60-61):

```ts
import { usePortfolioData } from "../hooks/usePortfolioData";
import { toEclTableRows, toDashboardKPIs, toPortfolioKPIs } from "../lib/portfolioAdapters";
```

Replace with:

```ts
import { usePortfolioData } from "../hooks/usePortfolioData";
import { toEclTableRows, toDashboardKPIs, toPortfolioKPIs } from "../lib/portfolioAdapters";
import { useRiskEngineECL } from "../hooks/useRiskEngineECL";
import { RiskEngineStatusBanner } from "../components/ui/RiskEngineStatusBanner";
```

Find the `BASE_ECL` import block (around line 70-77):

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

Add `resolveBaseECL` to it:

```ts
import {
  BASE_ECL,
  ZERO_INPUTS,
  computeECLFromBase,
  DEFAULT_ADVERSE_INPUTS,
  DEFAULT_UPSIDE_INPUTS,
  resolveBaseECL,
  type ScenarioInputs,
} from "../utils/eclCalculator";
```

- [x] **Step 2: Call the hook and replace the `liveBaseECL` definition**

Find (around line 401-404):

```ts
  // Compute live base ECL and coverage
  const liveBaseECL = (() => {
    const kpis = toDashboardKPIs(assets, lessees, provisions);
    return kpis.totalECLm > 0 ? kpis.totalECLm : BASE_ECL;
  })();
```

Replace with:

```ts
  // Compute live base ECL and coverage. RiskECL has no scope concept — it
  // always shows the whole portfolio — so the engine result is used
  // whenever it's available (real org, call succeeded).
  const { ecl: engineECL, loading: engineLoading, error: engineError } = useRiskEngineECL();
  const liveBaseECL = (() => {
    const kpis = toDashboardKPIs(assets, lessees, provisions);
    return resolveBaseECL({ isUnscoped: true, engineECL, kpisTotalECLm: kpis.totalECLm });
  })();
```

- [x] **Step 3: Render the banner**

Find (the `</PageHeader>` closing tag, around line 2147):

```tsx
        >
          Export PDF + JSON
        </button>
      </PageHeader>

      {/* Period History + Stage Migrations side-by-side audit panels */}
```

Replace with:

```tsx
        >
          Export PDF + JSON
        </button>
      </PageHeader>

      <RiskEngineStatusBanner loading={engineLoading} error={engineError} />

      {/* Period History + Stage Migrations side-by-side audit panels */}
```

- [x] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors mentioning `RiskECL.tsx`

- [x] **Step 5: Commit**

```bash
git add src/app/pages/RiskECL.tsx
git commit -m "feat: wire RiskECL.tsx to the live risk engine"
```

---

### Task 5: Wire into Scenarios.tsx

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

- [x] **Step 1: Add imports**

Find (around line 63):

```ts
import { usePortfolioData } from "../hooks/usePortfolioData";
```

Replace with:

```ts
import { usePortfolioData } from "../hooks/usePortfolioData";
import { useRiskEngineECL } from "../hooks/useRiskEngineECL";
import { RiskEngineStatusBanner } from "../components/ui/RiskEngineStatusBanner";
```

Find the `eclCalculator` import block (around line 54-62):

```ts
import {
  ScenarioInputs,
  BASE_ECL,
  LGD_DELTAS, // used in Insolvency Regime section (Task 5)
  ZERO_INPUTS,
  computeECL,
  computeECLFromBase,
  computeStages,
} from "../utils/eclCalculator";
```

Replace with:

```ts
import {
  ScenarioInputs,
  BASE_ECL,
  LGD_DELTAS, // used in Insolvency Regime section (Task 5)
  ZERO_INPUTS,
  computeECL,
  computeECLFromBase,
  computeStages,
  resolveBaseECL,
} from "../utils/eclCalculator";
```

- [x] **Step 2: Call the hook and replace the `liveBaseECL` definition**

Find (around line 242-248):

```ts
  const liveBaseECL = React.useMemo(
    () => {
      const kpis = toDashboardKPIs(scoped.assets, lessees, scoped.provisions);
      return kpis.totalECLm > 0 ? kpis.totalECLm : BASE_ECL;
    },
    [scoped, lessees]
  );
```

Replace with:

```ts
  // Scenarios can be scoped to a subset of the portfolio (ScenarioScope) —
  // the engine only returns the org's whole portfolio, so it's only used
  // when the view is unscoped.
  const { ecl: engineECL, loading: engineLoading, error: engineError } = useRiskEngineECL();
  const isUnscoped = scope === SCOPE_ALL;
  const liveBaseECL = React.useMemo(
    () => {
      const kpis = toDashboardKPIs(scoped.assets, lessees, scoped.provisions);
      return resolveBaseECL({ isUnscoped, engineECL, kpisTotalECLm: kpis.totalECLm });
    },
    [isUnscoped, engineECL, scoped, lessees]
  );
```

- [x] **Step 3: Render the banner**

Find (around line 721):

```tsx
          <Play size={14} /> New Custom Scenario
        </Link>
      </PageHeader>

      {/* ── Tabs ── */}
```

Replace with:

```tsx
          <Play size={14} /> New Custom Scenario
        </Link>
      </PageHeader>

      <RiskEngineStatusBanner loading={engineLoading} error={engineError} />

      {/* ── Tabs ── */}
```

- [x] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors mentioning `Scenarios.tsx`

- [x] **Step 5: Commit**

```bash
git add src/app/pages/Scenarios.tsx
git commit -m "feat: wire Scenarios.tsx to the live risk engine"
```

---

### Task 6: Wire into CustomBuilderPage.tsx

**Files:**
- Modify: `src/app/pages/CustomBuilderPage.tsx`

- [x] **Step 1: Add imports**

Find (around line 34):

```ts
import { usePortfolioData } from "../hooks/usePortfolioData";
```

Replace with:

```ts
import { usePortfolioData } from "../hooks/usePortfolioData";
import { useRiskEngineECL } from "../hooks/useRiskEngineECL";
import { RiskEngineStatusBanner } from "../components/ui/RiskEngineStatusBanner";
```

Find the `eclCalculator` import block (around line 50-53):

```ts
import {
  BASE_ECL,
  ZERO_INPUTS,
  type ScenarioInputs,
} from "../utils/eclCalculator";
```

Replace with:

```ts
import {
  BASE_ECL,
  ZERO_INPUTS,
  resolveBaseECL,
  type ScenarioInputs,
} from "../utils/eclCalculator";
```

- [x] **Step 2: Call the hook and replace the `liveBaseECL` definition**

Find (around line 114-117):

```ts
  const liveBaseECL = useMemo(() => {
    const kpis = toDashboardKPIs(scoped.assets, lessees, scoped.provisions);
    return kpis.totalECLm > 0 ? kpis.totalECLm : BASE_ECL;
  }, [scoped, lessees]);
```

Replace with:

```ts
  // Same scoping rule as Scenarios.tsx: the engine only returns the org's
  // whole portfolio, so it's only used when scope is SCOPE_ALL.
  const { ecl: engineECL, loading: engineLoading, error: engineError } = useRiskEngineECL();
  const isUnscoped = scope === SCOPE_ALL;
  const liveBaseECL = useMemo(() => {
    const kpis = toDashboardKPIs(scoped.assets, lessees, scoped.provisions);
    return resolveBaseECL({ isUnscoped, engineECL, kpisTotalECLm: kpis.totalECLm });
  }, [isUnscoped, engineECL, scoped, lessees]);
```

- [x] **Step 3: Render the banner**

Find (around line 356):

```tsx
          <ArrowLeft size={14} /> Back to Scenarios
        </button>
      </PageHeader>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <ScopePicker scope={scope} onChange={setScope} assets={assets} lessees={lessees} />
      </div>
```

Replace with:

```tsx
          <ArrowLeft size={14} /> Back to Scenarios
        </button>
      </PageHeader>

      <RiskEngineStatusBanner loading={engineLoading} error={engineError} />

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <ScopePicker scope={scope} onChange={setScope} assets={assets} lessees={lessees} />
      </div>
```

- [x] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors mentioning `CustomBuilderPage.tsx`

- [x] **Step 5: Commit**

```bash
git add src/app/pages/CustomBuilderPage.tsx
git commit -m "feat: wire CustomBuilderPage.tsx to the live risk engine"
```

---

### Task 7: Wire into ConcentrationStressTab.tsx

**Files:**
- Modify: `src/app/components/scenarios/ConcentrationStressTab.tsx`

This is a sub-tab rendered inside Scenarios.tsx / CustomBuilderPage.tsx, not a standalone page — no `PageHeader`, no banner needed here (the parent page's banner already covers it). It has no scope concept, so it's always unscoped.

- [x] **Step 1: Add imports**

Find (around line 12-14):

```ts
import { usePortfolioData } from "../../hooks/usePortfolioData";
import { toDashboardKPIs } from "../../lib/portfolioAdapters";
import { BASE_ECL } from "../../utils/eclCalculator";
```

Replace with:

```ts
import { usePortfolioData } from "../../hooks/usePortfolioData";
import { toDashboardKPIs } from "../../lib/portfolioAdapters";
import { BASE_ECL, resolveBaseECL } from "../../utils/eclCalculator";
import { useRiskEngineECL } from "../../hooks/useRiskEngineECL";
```

- [x] **Step 2: Call the hook and replace the `liveBaseECL` definition**

Find (around line 55-58):

```ts
  const liveBaseECL = useMemo(() => {
    const kpis = toDashboardKPIs(assets, lessees, provisions);
    return kpis.totalECLm > 0 ? kpis.totalECLm : BASE_ECL;
  }, [assets, lessees, provisions]);
```

Replace with:

```ts
  const { ecl: engineECL } = useRiskEngineECL();
  const liveBaseECL = useMemo(() => {
    const kpis = toDashboardKPIs(assets, lessees, provisions);
    return resolveBaseECL({ isUnscoped: true, engineECL, kpisTotalECLm: kpis.totalECLm });
  }, [engineECL, assets, lessees, provisions]);
```

- [x] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors mentioning `ConcentrationStressTab.tsx`

- [x] **Step 4: Commit**

```bash
git add src/app/components/scenarios/ConcentrationStressTab.tsx
git commit -m "feat: wire ConcentrationStressTab.tsx to the live risk engine"
```

---

### Task 8: Full-suite check + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run check`
Expected: PASS — typecheck, lint, and all vitest suites green (including the new `resolveBaseECL` and `parseRiskEngineResponse` tests, and unchanged `eclCalculator.test.ts`/other existing tests since `computeECLFromBase` itself was never touched)

- [ ] **Step 2: Manual verification (requires an authenticated session — cannot be automated by an agent without login credentials)**

This needs a human (or a session already logged in) to check against the running dev server, since Risk & ECL / Scenarios / Custom Builder all sit behind Auth0:

1. **Demo org (no uploaded portfolio):** open Risk & ECL, Scenarios, and Custom Builder. Confirm the ECL figures are unchanged from before this change (still the sample-portfolio numbers), and no loading/error banner ever appears (network tab: no request to `/api/risk-engine/compute` at all).
2. **Real org with an uploaded portfolio:** open Risk & ECL. Confirm a brief "Computing live portfolio ECL…" indicator appears, then the headline figures update. Check the Network tab for a `POST /api/risk-engine/compute` call and confirm its `total_ecl` matches what's now shown.
3. Navigate from Risk & ECL to Scenarios (same real org). Confirm no second network call fires (cached) and the same live number is used there when scope is "All".
4. In Scenarios or Custom Builder, change the scope filter to a subset. Confirm the figure changes to the scoped client-side number (not the org-wide engine number) — this is the scoping fallback working as designed.
5. Simulate a failure (e.g. temporarily block `/api/risk-engine/compute` in devtools network conditions, or stop the local dev server's Python function if running one) for a real org. Confirm the "Live ECL unavailable — showing estimated figures" banner appears and the page still shows a usable (fallback) number rather than breaking.

- [ ] **Step 3: Report results**

If all 5 manual checks pass, this plan is complete. If any fail, note which one and stop — do not proceed to merge until fixed.
