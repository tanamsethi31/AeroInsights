# Jurisdiction ECL Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `computePortfolioJurisdictionMix()` into `RiskECL.tsx` so the adverse scenario's jurisdiction fields auto-populate from portfolio data, and surface a compact `JurisdictionRiskSummaryCard` on the ECL Overview tab.

**Architecture:** Two units — a new pure-display `JurisdictionRiskSummaryCard` component (no Supabase, no loading state), and four targeted additions to `RiskECL.tsx` (import, useMemo, useEffect, JSX). The `computePortfolioJurisdictionMix` utility and the ECL engine are untouched.

**Tech Stack:** React 18, TypeScript, react-router v6 (`useNavigate`), inline styles (project convention), Vitest.

---

## File Map

| File | Action |
|------|--------|
| `src/app/components/risk-ecl/JurisdictionRiskSummaryCard.tsx` | **Create** — compact display card |
| `src/app/pages/RiskECL.tsx` | **Modify** — 4 targeted additions |

---

### Task 1: Create JurisdictionRiskSummaryCard

**Files:**
- Create: `src/app/components/risk-ecl/JurisdictionRiskSummaryCard.tsx`

> **Background for implementer:**
> This is a pure display component — no Supabase, no loading state, no local state. It receives four props and renders a `<Card>` with a header, three CTC tier chips, a repossession row with a colour-coded badge, an ECL uplift chip, and a footer navigation button. All styling uses inline styles (project convention — no CSS modules, no Tailwind). Import `Card` from `../ui/Card` and `useNavigate` from `react-router`.
>
> `computePortfolioJurisdictionMix` already exists in `src/app/utils/jurisdictionRisk.ts` and returns `{ ctcGoldPct, nonCtcPct, avgRepossP50Months }` (all `number`, 0–1 for percentages). **Do not import or call it here** — values arrive as props.

- [ ] **Step 1: Verify the existing test suite is green before starting**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass (412 tests). If any fail, stop and report — do not proceed.

- [ ] **Step 2: Create the component file**

Create `src/app/components/risk-ecl/JurisdictionRiskSummaryCard.tsx` with this exact content:

```tsx
// src/app/components/risk-ecl/JurisdictionRiskSummaryCard.tsx
import { useNavigate } from "react-router";
import { Card } from "../ui/Card";

interface Props {
  ctcGoldPct:         number;  // 0–1, rental-weighted fleet share in CTC Gold
  nonCtcPct:          number;  // 0–1, rental-weighted fleet share in Non-CTC
  avgRepossP50Months: number;  // rental-weighted P50 repossession months
  liveBaseECL:        number;  // $M — used to compute ECL uplift display
}

export function JurisdictionRiskSummaryCard({
  ctcGoldPct,
  nonCtcPct,
  avgRepossP50Months,
  liveBaseECL,
}: Props) {
  const navigate = useNavigate();

  const ctcModeratePct = Math.max(0, 1 - ctcGoldPct - nonCtcPct);
  const noData = avgRepossP50Months === 0 && ctcGoldPct === 0 && nonCtcPct === 0;

  // Extra months above the 3-month US §1110 benchmark
  const extraMonths = Math.max(0, avgRepossP50Months - 3);

  // ECL uplift: each month above benchmark adds 2.5% of baseECL
  const upliftM = extraMonths * 0.025 * liveBaseECL;

  // Colour for the extra-months badge
  const badgeStyle: React.CSSProperties =
    extraMonths === 0
      ? { background: "#DCFCE7", color: "#15803D" }
      : extraMonths <= 3
      ? { background: "#FEF3C7", color: "#B45309" }
      : { background: "#FEE2E2", color: "#B91C1C" };

  return (
    <Card>
      <div style={{ padding: "1.25rem" }}>

        {/* ── Header row ─────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: "1rem",
        }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
            Fleet Jurisdiction · Repossession Risk
          </span>
          <span style={{
            background: "#EFF6FF", color: "#1D4ED8",
            fontSize: "0.75rem", fontWeight: 600,
            padding: "0.2rem 0.6rem", borderRadius: "9999px",
          }}>
            Applied to scenario ✓
          </span>
        </div>

        {/* ── CTC tier chips ─────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span style={{
            background: "#DCFCE7", color: "#15803D",
            fontSize: "0.8125rem", fontWeight: 600,
            padding: "0.25rem 0.75rem", borderRadius: "9999px",
          }}>
            🟢 Gold: {noData ? "—" : `${(ctcGoldPct * 100).toFixed(1)}%`}
          </span>
          <span style={{
            background: "#FEF3C7", color: "#B45309",
            fontSize: "0.8125rem", fontWeight: 600,
            padding: "0.25rem 0.75rem", borderRadius: "9999px",
          }}>
            🟡 Moderate: {noData ? "—" : `${(ctcModeratePct * 100).toFixed(1)}%`}
          </span>
          <span style={{
            background: "#FEE2E2", color: "#B91C1C",
            fontSize: "0.8125rem", fontWeight: 600,
            padding: "0.25rem 0.75rem", borderRadius: "9999px",
          }}>
            🔴 Non-CTC: {noData ? "—" : `${(nonCtcPct * 100).toFixed(1)}%`}
          </span>
        </div>

        {/* ── Repossession row ───────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "0.875rem",
        }}>
          <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>
            Weighted avg P50
          </span>
          {noData ? (
            <span style={{ fontSize: "0.8125rem", color: "#94A3B8" }}>—</span>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0F172A" }}>
                {avgRepossP50Months.toFixed(1)} mo
              </span>
              <span style={{
                ...badgeStyle,
                fontSize: "0.75rem", fontWeight: 600,
                padding: "0.2rem 0.55rem", borderRadius: "9999px",
              }}>
                {extraMonths === 0
                  ? "+0 mo above benchmark"
                  : `+${extraMonths.toFixed(1)} mo above benchmark`}
              </span>
            </div>
          )}
        </div>

        {/* ── ECL uplift chip ────────────────────────────────────────── */}
        <div style={{ marginBottom: "1rem" }}>
          <span style={{
            background: upliftM > 0 ? "#FEE2E2" : "#DCFCE7",
            color:      upliftM > 0 ? "#B91C1C" : "#15803D",
            fontSize: "0.8125rem", fontWeight: 600,
            padding: "0.3rem 0.75rem", borderRadius: "9999px",
          }}>
            {upliftM > 0
              ? `↑ $${upliftM.toFixed(1)}M repossession uplift`
              : "No uplift vs. benchmark"}
          </span>
        </div>

        {/* ── No-data note ───────────────────────────────────────────── */}
        {noData && (
          <p style={{ fontSize: "0.8125rem", color: "#94A3B8", marginBottom: "0.875rem" }}>
            No jurisdiction data in portfolio.
          </p>
        )}

        {/* ── Footer link ────────────────────────────────────────────── */}
        <button
          onClick={() => navigate("/jurisdictions")}
          style={{
            background: "none", border: "none", padding: 0,
            fontSize: "0.8125rem", color: "#1D4ED8",
            cursor: "pointer", textDecoration: "underline",
          }}
        >
          View full jurisdiction analysis →
        </button>

      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Run the test suite — verify still green**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: same pass count as Step 1 (412 tests). This component has no logic to unit-test beyond arithmetic that mirrors the ECL engine, which is already tested.

- [ ] **Step 4: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/risk-ecl/JurisdictionRiskSummaryCard.tsx && git commit -m "feat: add JurisdictionRiskSummaryCard display component"
```

---

### Task 2: Wire JurisdictionRiskSummaryCard into RiskECL.tsx

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

> **Background for implementer:**
> `RiskECL.tsx` is a large page file. You are making 4 targeted additions — nothing structural changes. Read each insertion point carefully.
>
> Key facts about the file:
> - Line 1: `import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";` — `useMemo` is **already imported**, no change needed.
> - Lines 48–51: existing risk-ecl imports (`LgdDecaySummaryCard`, `RecoveryFactorDrawer`, `useLgdCurves`, `computePortfolioAssetRisk`)
> - Line 291: `const { assets, lessees, leases, provisions, isLoading } = usePortfolioData();` — `lessees` and `leases` are already available
> - Lines 293–295: `portfolioLgdRisk` useMemo — **add the new useMemo directly after this block**
> - Lines 298–305: `useEffect` for `lgdDecayAdjFactor` — **add the new useEffect directly after this block**
> - Lines 413–424: `OverviewTab` function — `LgdDecaySummaryCard` is already rendered. **Add `JurisdictionRiskSummaryCard` immediately after it, before the `<Card>` for Scenario Probability Weights**

- [ ] **Step 1: Add the two imports**

In `src/app/pages/RiskECL.tsx`, find the block of risk-ecl imports (lines 48–51):

```typescript
import { LgdDecaySummaryCard } from "../components/risk-ecl/LgdDecaySummaryCard";
import { RecoveryFactorDrawer } from "../components/risk-ecl/RecoveryFactorDrawer";
import { useLgdCurves } from "../hooks/useLgdCurves";
import { computePortfolioAssetRisk } from "../utils/assetRisk";
```

Replace with:

```typescript
import { LgdDecaySummaryCard } from "../components/risk-ecl/LgdDecaySummaryCard";
import { JurisdictionRiskSummaryCard } from "../components/risk-ecl/JurisdictionRiskSummaryCard";
import { RecoveryFactorDrawer } from "../components/risk-ecl/RecoveryFactorDrawer";
import { useLgdCurves } from "../hooks/useLgdCurves";
import { computePortfolioAssetRisk } from "../utils/assetRisk";
import { computePortfolioJurisdictionMix } from "../utils/jurisdictionRisk";
```

- [ ] **Step 2: Add the useMemo**

Find the `portfolioLgdRisk` useMemo block (lines 293–296):

```typescript
  const portfolioLgdRisk = useMemo(
    () => computePortfolioAssetRisk(assets, leases, recoveryFactor, undefined, provisions),
    [assets, leases, recoveryFactor, provisions]
  );
```

Replace with (adds the new memo directly after):

```typescript
  const portfolioLgdRisk = useMemo(
    () => computePortfolioAssetRisk(assets, leases, recoveryFactor, undefined, provisions),
    [assets, leases, recoveryFactor, provisions]
  );

  const portfolioJurisdictionMix = useMemo(
    () => computePortfolioJurisdictionMix(lessees, leases),
    [lessees, leases]
  );
```

- [ ] **Step 3: Add the useEffect**

Find the existing lgdDecayAdjFactor useEffect (lines 298–305):

```typescript
  useEffect(() => {
    if (portfolioLgdRisk.lgdDecayAdjFactor > 0) {
      setScenarioInputs((prev) => ({
        ...prev,
        adverse: { ...prev.adverse, lgdDecayAdjFactor: portfolioLgdRisk.lgdDecayAdjFactor },
      }));
    }
  }, [portfolioLgdRisk.lgdDecayAdjFactor]);
```

Replace with (adds new useEffect directly after):

```typescript
  useEffect(() => {
    if (portfolioLgdRisk.lgdDecayAdjFactor > 0) {
      setScenarioInputs((prev) => ({
        ...prev,
        adverse: { ...prev.adverse, lgdDecayAdjFactor: portfolioLgdRisk.lgdDecayAdjFactor },
      }));
    }
  }, [portfolioLgdRisk.lgdDecayAdjFactor]);

  useEffect(() => {
    if (portfolioJurisdictionMix.ctcGoldPct > 0 || portfolioJurisdictionMix.nonCtcPct > 0) {
      setScenarioInputs((prev) => ({
        ...prev,
        adverse: {
          ...prev.adverse,
          ctcGoldPct:           portfolioJurisdictionMix.ctcGoldPct,
          nonCtcPct:            portfolioJurisdictionMix.nonCtcPct,
          repossWeightedMonths: portfolioJurisdictionMix.avgRepossP50Months,
        },
      }));
    }
  }, [
    portfolioJurisdictionMix.ctcGoldPct,
    portfolioJurisdictionMix.nonCtcPct,
    portfolioJurisdictionMix.avgRepossP50Months,
  ]);
```

**Guard explanation:** The `if` guard means when portfolio has no jurisdiction data (demo mode or empty lessees), the three adverse fields stay at 0 — ECL engine treats 0 as "feature inactive". This preserves backward compatibility with existing demo/staging data.

- [ ] **Step 4: Add the JSX in OverviewTab**

Find the OverviewTab inner function. It currently looks like:

```tsx
  const OverviewTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {assets.length > 0 && (
        <LgdDecaySummaryCard
          assets={assets}
          provisions={provisions}
          recoveryFactor={recoveryFactor}
          isOverridden={isOverridden}
          lgdDecayAdjFactor={portfolioLgdRisk.lgdDecayAdjFactor}
          onOpenRecoveryDrawer={() => setRecoveryDrawerOpen(true)}
        />
      )}
      {/* Scenario Weight Controller — title simplified in Executive Mode */}
      <Card
```

Replace with (adds `JurisdictionRiskSummaryCard` between the two existing elements):

```tsx
  const OverviewTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {assets.length > 0 && (
        <LgdDecaySummaryCard
          assets={assets}
          provisions={provisions}
          recoveryFactor={recoveryFactor}
          isOverridden={isOverridden}
          lgdDecayAdjFactor={portfolioLgdRisk.lgdDecayAdjFactor}
          onOpenRecoveryDrawer={() => setRecoveryDrawerOpen(true)}
        />
      )}
      {assets.length > 0 && (
        <JurisdictionRiskSummaryCard
          ctcGoldPct={portfolioJurisdictionMix.ctcGoldPct}
          nonCtcPct={portfolioJurisdictionMix.nonCtcPct}
          avgRepossP50Months={portfolioJurisdictionMix.avgRepossP50Months}
          liveBaseECL={liveBaseECL}
        />
      )}
      {/* Scenario Weight Controller — title simplified in Executive Mode */}
      <Card
```

- [ ] **Step 5: Run the test suite — verify still green**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: same pass count as Task 1 Step 1. No test failures.

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/RiskECL.tsx && git commit -m "feat: wire jurisdiction ECL into RiskECL adverse scenario + summary card"
```

---

## Self-Review Checklist (already run)

- ✅ **Spec coverage:** All 4 RiskECL.tsx additions covered (import, useMemo, useEffect, JSX). Component layout fully spec'd — header, tier chips, repossession row, uplift chip, footer link, zero-data state.
- ✅ **No placeholders:** All code blocks complete.
- ✅ **Type consistency:** `ctcGoldPct`, `nonCtcPct`, `avgRepossP50Months` match `computePortfolioJurisdictionMix` return type and `JurisdictionRiskSummaryCard` Props throughout.
- ✅ **Scope:** Two tasks, both independently committable, no structural changes to existing logic.
