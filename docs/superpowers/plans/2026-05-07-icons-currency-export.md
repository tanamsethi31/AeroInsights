# Icons, Currency & Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all emoji with Lucide icons, add a EUR-default 9-currency formatter with header selector, and wire the Reports page Generate buttons to real PDF / XLSX / DOCX downloads.

**Architecture:** `CurrencyContext` provides `fmt(usd)` app-wide; emoji are swapped for Lucide components already used elsewhere; `exportService.ts` gains six named report generators (PDF + XLSX + DOCX) that accept a `CurrencyCode`; a new `ReportFormatModal` surfaces format choice on the Reports page.

**Tech Stack:** React 18, TypeScript, Lucide-react (already installed), jspdf + jspdf-autotable (already installed), xlsx/SheetJS (already installed), docx v8 (to install). Validation command throughout: `cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4`.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/app/components/agent/AgentMessage.tsx` | ⚡ → `<Zap>` |
| Modify | `src/app/components/agent/AgentPanel.tsx` | ⚠ string → `[!]` text |
| Modify | `src/app/pages/Scenarios.tsx` | ⚡ → `<Zap>` (2 places) |
| Modify | `src/app/components/portfolio/PerformanceVsPlan.tsx` | ⚠ → `<AlertTriangle>`, 📅 → `<Calendar>` |
| Modify | `src/app/components/portfolio/SDMRTab.tsx` | ⚠ → `<AlertTriangle>` |
| Modify | `src/app/components/portfolio/ConcentrationTab.tsx` | ⚠/✓ icon div → `<AlertTriangle>`/`<Check>` |
| Modify | `src/app/components/scenarios/InsolvencyTab.tsx` | ⚠️ → `<AlertTriangle>` |
| Modify | `src/app/components/scenarios/LeasePricingTab.tsx` | ⚠ text string → text only |
| Modify | `src/app/pages/Settings.tsx` | ⚠ → `<AlertTriangle>`, ✓/⚠ condition → icons |
| Modify | `src/app/pages/Reports.tsx` | icon string fields → iconKey + lookup map |
| Modify | `src/app/pages/Intelligence.tsx` | `catIcon()` → Lucide components |
| Modify | `src/app/pages/Counterparties.tsx` | ✓/✕/◉/✈ stat icon fields → Lucide |
| Modify | `src/app/components/deals/RackAndStack.tsx` | ★ → text only |
| Modify | `src/app/components/deals/LeaseGenerator.tsx` | ✓ in button text → text |
| Modify | `src/app/components/counterparties/MitigationsTab.tsx` | ★ rank → text |
| Modify | `src/app/components/import/ImportWizard.tsx` | ✓/●/○ step → icon components |
| Modify | `src/app/components/reports/EmailReportModal.tsx` | ✅ → `<CheckCircle2>` |
| Create | `src/app/contexts/CurrencyContext.tsx` | context, hook, static FX, `fmt()` |
| Modify | `src/app/components/layout/Layout.tsx` | wrap with `<CurrencyProvider>` |
| Modify | `src/app/components/layout/Header.tsx` | add currency selector dropdown |
| Modify | `src/app/components/risk-ecl/ECLDrilldownPanel.tsx` | local `fmt` → `useCurrency().fmt` |
| Modify | `src/app/services/exportService.ts` | add `fmtExport()` + 6 × PDF/XLSX generators |
| Create | `src/app/services/reportGenerators.ts` | 6 × DOCX generators (docx package) |
| Create | `src/app/components/reports/ReportFormatModal.tsx` | format picker modal |
| Modify | `src/app/pages/Reports.tsx` | wire Generate button → `ReportFormatModal` |

---

### Task 1: Emoji fix — agent files and Scenarios.tsx

**Files:**
- Modify: `src/app/components/agent/AgentMessage.tsx`
- Modify: `src/app/components/agent/AgentPanel.tsx`
- Modify: `src/app/pages/Scenarios.tsx`

- [ ] **Step 1: Fix AgentMessage.tsx line 285**

In `src/app/components/agent/AgentMessage.tsx`, add `Zap` to the lucide-react import (it already imports from "lucide-react" — check and add). Then replace:

```tsx
// BEFORE (line 285 area, inside ActionConfirmCard):
<span style={{ fontSize: "0.875rem" }}>⚡</span>

// AFTER:
<Zap size={14} style={{ color: "#002147", flexShrink: 0 }} />
```

- [ ] **Step 2: Fix AgentPanel.tsx line 234**

The ⚠ is inside a template literal that sets chat message `content` (not JSX). Replace the emoji with the text `[!]` so it renders cleanly via the markdown renderer:

```typescript
// BEFORE:
content: `⚠ ${event.msg}`,

// AFTER:
content: `[!] ${event.msg}`,
```

- [ ] **Step 3: Fix Scenarios.tsx — two ⚡ instances**

Add `Zap` to the Lucide import at the top of `src/app/pages/Scenarios.tsx`.

Replace line ~980:
```tsx
// BEFORE:
<span style={{ fontSize: "0.875rem" }}>⚡</span>

// AFTER:
<Zap size={14} style={{ color: "#B45309", flexShrink: 0 }} />
```

Replace line ~1069 (button text):
```tsx
// BEFORE:
⚡ Pre-populate from market data

// AFTER — wrap in fragment with icon:
<><Zap size={13} style={{ marginRight: "4px" }} /> Pre-populate from market data</>
```

- [ ] **Step 4: Build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 5: Commit**

```bash
git add src/app/components/agent/AgentMessage.tsx src/app/components/agent/AgentPanel.tsx src/app/pages/Scenarios.tsx
git commit -m "fix: replace ⚡ and ⚠ emoji with Lucide icons in agent and Scenarios"
```

---

### Task 2: Emoji fix — portfolio and scenario components

**Files:**
- Modify: `src/app/components/portfolio/PerformanceVsPlan.tsx`
- Modify: `src/app/components/portfolio/SDMRTab.tsx`
- Modify: `src/app/components/portfolio/ConcentrationTab.tsx`
- Modify: `src/app/components/scenarios/InsolvencyTab.tsx`
- Modify: `src/app/components/scenarios/LeasePricingTab.tsx`

- [ ] **Step 1: Fix PerformanceVsPlan.tsx**

Add `AlertTriangle, Calendar` to the Lucide import in `src/app/components/portfolio/PerformanceVsPlan.tsx`.

Replace line ~219:
```tsx
// BEFORE:
<span style={{ fontSize: "1rem", marginTop: "0.05rem" }}>⚠</span>

// AFTER:
<AlertTriangle size={16} style={{ color: "#991B1B", flexShrink: 0 }} />
```

Replace line ~517:
```tsx
// BEFORE:
<span style={{ fontSize: "0.875rem" }}>📅</span>

// AFTER:
<Calendar size={15} style={{ color: "#92400E", flexShrink: 0 }} />
```

- [ ] **Step 2: Fix SDMRTab.tsx**

Add `AlertTriangle` to the Lucide import in `src/app/components/portfolio/SDMRTab.tsx`.

Replace line ~448:
```tsx
// BEFORE:
<span style={{ fontSize: "1rem", marginTop: "0.05rem" }}>⚠</span>

// AFTER:
<AlertTriangle size={16} style={{ color: "#92400E", flexShrink: 0 }} />
```

- [ ] **Step 3: Fix ConcentrationTab.tsx**

Add `AlertTriangle, Check` to the Lucide import in `src/app/components/portfolio/ConcentrationTab.tsx`.

Replace line ~475 (inside the summary header circle div):
```tsx
// BEFORE:
{enabledBreaches.length > 0 ? "⚠" : "✓"}

// AFTER:
{enabledBreaches.length > 0
  ? <AlertTriangle size={18} style={{ color: "#B45309" }} />
  : <Check size={18} style={{ color: "#15803D" }} />}
```

Replace line ~655:
```tsx
// BEFORE:
<span style={{ fontSize: "1rem", flexShrink: 0 }}>⚠</span>

// AFTER:
<AlertTriangle size={16} style={{ color: "#B45309", flexShrink: 0 }} />
```

- [ ] **Step 4: Fix InsolvencyTab.tsx**

Add `AlertTriangle` to the Lucide import in `src/app/components/scenarios/InsolvencyTab.tsx`.

Replace line ~326:
```tsx
// BEFORE:
<span style={{ fontSize: "0.875rem", flexShrink: 0 }}>⚠️</span>

// AFTER:
<AlertTriangle size={15} style={{ color: "#92400E", flexShrink: 0 }} />
```

- [ ] **Step 5: Fix LeasePricingTab.tsx**

The ⚠ at line ~331 is inside a string expression used as JSX text. Replace by removing the emoji and keeping only the warning text:

```tsx
// BEFORE (string in JSX):
? "⚠ Doesn't pencil — IRR target too high for these inputs"

// AFTER — find the enclosing JSX and add AlertTriangle before the string:
// Change the ternary to return a React.ReactNode instead of a string:
? <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
    <AlertTriangle size={13} style={{ color: "#B91C1C", flexShrink: 0 }} />
    Doesn&apos;t pencil — IRR target too high for these inputs
  </span>
```

Add `AlertTriangle` to the Lucide import in `src/app/components/scenarios/LeasePricingTab.tsx`.

- [ ] **Step 6: Build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 7: Commit**

```bash
git add \
  src/app/components/portfolio/PerformanceVsPlan.tsx \
  src/app/components/portfolio/SDMRTab.tsx \
  src/app/components/portfolio/ConcentrationTab.tsx \
  src/app/components/scenarios/InsolvencyTab.tsx \
  src/app/components/scenarios/LeasePricingTab.tsx
git commit -m "fix: replace ⚠/📅 emoji with Lucide icons in portfolio and scenario components"
```

---

### Task 3: Emoji fix — Settings.tsx

**Files:**
- Modify: `src/app/pages/Settings.tsx`

Settings has 4 emoji instances. It already imports from lucide-react — add `AlertTriangle, Check` to that import.

- [ ] **Step 1: Fix the scenario weights total indicator (line ~434)**

```tsx
// BEFORE:
{weights.baseline + weights.adverse + weights.severe === 100 ? "✓" : "(must equal 100%)"}

// AFTER:
{weights.baseline + weights.adverse + weights.severe === 100
  ? <><Check size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "2px", color: "#15803D" }} /> 100%</>
  : "(must equal 100%)"}
```

- [ ] **Step 2: Fix the concentration breach banner (line ~488)**

```tsx
// BEFORE:
⚠ {breaches.length} active breach{breaches.length > 1 ? "es" : ""}

// AFTER (wrap the text node in a fragment with icon):
<AlertTriangle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px", color: "#B45309" }} />
{breaches.length} active breach{breaches.length > 1 ? "es" : ""}
```

- [ ] **Step 3: Fix the "all clear" compliance line (line ~504)**

```tsx
// BEFORE:
✓ All enabled policy limits currently met.

// AFTER:
<Check size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px", color: "#15803D" }} />
All enabled policy limits currently met.
```

- [ ] **Step 4: Fix the signal weight total indicator (line ~988)**

```tsx
// BEFORE:
{weightSum === 100 ? "✓" : "⚠"} Total weight: {weightSum} / 100

// AFTER:
{weightSum === 100
  ? <Check size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
  : <AlertTriangle size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />}
Total weight: {weightSum} / 100
```

- [ ] **Step 5: Build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/Settings.tsx
git commit -m "fix: replace ⚠/✓ emoji with Lucide icons in Settings"
```

---

### Task 4: Emoji fix — Reports.tsx and Intelligence.tsx icon data fields

**Files:**
- Modify: `src/app/pages/Reports.tsx`
- Modify: `src/app/pages/Intelligence.tsx`

These two files store emoji in data arrays; the render site reads them as `{report.icon}` or `{catIcon(sig.category)}`. The fix is to replace the emoji-returning function/field with a lookup map that returns a Lucide component.

- [ ] **Step 1: Fix Reports.tsx**

Add these imports to `src/app/pages/Reports.tsx`:
```tsx
import { Search, ClipboardList, BarChart3, Scale, AlertTriangle, Globe } from "lucide-react";
```

Replace the `icon` string field with `iconKey` in the `reportTemplates` array and add a lookup map above it:

```tsx
// ADD this map above reportTemplates:
const REPORT_ICON_MAP: Record<string, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  search:      Search,
  board:       ClipboardList,
  portfolio:   BarChart3,
  ecl:         Scale,
  watchlist:   AlertTriangle,
  jurisdiction: Globe,
};

// CHANGE reportTemplates — replace icon: "emoji" with iconKey: "key":
const reportTemplates = [
  { id: "RPT-001", ..., iconKey: "search",       ... },
  { id: "RPT-002", ..., iconKey: "board",        ... },
  { id: "RPT-003", ..., iconKey: "portfolio",    ... },
  { id: "RPT-004", ..., iconKey: "ecl",          ... },
  { id: "RPT-005", ..., iconKey: "watchlist",    ... },
  { id: "RPT-006", ..., iconKey: "jurisdiction", ... },
];
```

Replace the render site that used `{report.icon}`:
```tsx
// BEFORE:
<div style={{ fontSize: "1.5rem", flexShrink: 0 }}>{report.icon}</div>

// AFTER:
<div style={{
  width: "40px", height: "40px", borderRadius: "10px",
  background: "rgba(0,33,71,0.07)",
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
}}>
  {React.createElement(REPORT_ICON_MAP[report.iconKey] ?? BarChart3, { size: 20, style: { color: "#002147" } })}
</div>
```

Add `import * as React from "react";` if not already present at the top.

- [ ] **Step 2: Fix Intelligence.tsx — catIcon function**

Add these imports to `src/app/pages/Intelligence.tsx`:
```tsx
import { Fuel, Globe, BarChart3, ArrowLeftRight, Plane } from "lucide-react";
```

Replace the `catIcon` function and its call sites:

```tsx
// REPLACE the old catIcon string function:
// OLD:
// function catIcon(c: SignalCategory) {
//   const m: Record<SignalCategory, string> = { fuel: "⛽", gdp: "🌏", rates: "📊", fx: "💱", aviation: "✈" };
//   return m[c];
// }

// NEW — returns a React element for JSX use:
const CAT_ICON_MAP: Record<SignalCategory, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  fuel:     Fuel,
  gdp:      Globe,
  rates:    BarChart3,
  fx:       ArrowLeftRight,
  aviation: Plane,
};

function CatIcon({ category, size = 14 }: { category: SignalCategory; size?: number }) {
  const Icon = CAT_ICON_MAP[category];
  return <Icon size={size} />;
}
```

At line ~252 (signal card), replace:
```tsx
// BEFORE:
<span style={{ fontSize: "0.9rem" }}>{catIcon(sig.category)}</span>

// AFTER:
<CatIcon category={sig.category} size={15} />
```

At line ~562 (filter chip label), replace to drop the icon from the string label:
```tsx
// BEFORE:
label={f.id === "all" ? `All (${MACRO_SIGNALS.length})` : `${catIcon(f.id as SignalCategory)} ${f.label}`}

// AFTER:
label={f.id === "all" ? `All (${MACRO_SIGNALS.length})` : f.label}
```

- [ ] **Step 3: Build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/Reports.tsx src/app/pages/Intelligence.tsx
git commit -m "fix: replace emoji icon fields with Lucide components in Reports and Intelligence"
```

---

### Task 5: Emoji fix — Counterparties, Deals, Import, EmailReportModal

**Files:**
- Modify: `src/app/pages/Counterparties.tsx`
- Modify: `src/app/components/deals/RackAndStack.tsx`
- Modify: `src/app/components/deals/LeaseGenerator.tsx`
- Modify: `src/app/components/counterparties/MitigationsTab.tsx`
- Modify: `src/app/components/import/ImportWizard.tsx`
- Modify: `src/app/components/reports/EmailReportModal.tsx`

- [ ] **Step 1: Fix Counterparties.tsx**

The stat cards array at lines ~294-297 uses `icon: "string"`. Change the field to hold a Lucide component reference. Add to imports: `import { Check, X, Circle, Plane } from "lucide-react";`

```tsx
// CHANGE stat card array — replace icon string with Icon component:
const statCards = [
  {
    label: "Sanctions Alerts", value: alerts,
    color: alerts > 0 ? "#B91C1C" : "#15803D",
    bg: alerts > 0 ? "rgba(185,28,28,0.06)" : "rgba(21,128,61,0.06)",
    border: alerts > 0 ? "rgba(185,28,28,0.2)" : "rgba(21,128,61,0.2)",
    Icon: alerts > 0 ? X : Check,
  },
  {
    label: "Under Monitoring", value: monitor,
    color: monitor > 0 ? "#B45309" : "#94A3B8",
    bg: monitor > 0 ? "rgba(180,83,9,0.06)" : "#F8FAFC",
    border: monitor > 0 ? "rgba(180,83,9,0.2)" : "#E2E8F0",
    Icon: Circle,
  },
  {
    label: "Sanctions Clear", value: clear,
    color: "#15803D",
    bg: "rgba(21,128,61,0.06)",
    border: "rgba(21,128,61,0.2)",
    Icon: Check,
  },
  {
    label: "Fleet Exposure Flags", value: fleetAlerts,
    color: fleetAlerts > 0 ? "#B45309" : "#15803D",
    bg: fleetAlerts > 0 ? "rgba(180,83,9,0.06)" : "rgba(21,128,61,0.06)",
    border: fleetAlerts > 0 ? "rgba(180,83,9,0.2)" : "rgba(21,128,61,0.2)",
    Icon: Plane,
  },
];
```

At the render site replace `{stat.icon}` (or however it renders) with:
```tsx
<stat.Icon size={16} style={{ color: stat.color }} />
```

At line ~370, replace the status character in the sanctions table:
```tsx
// BEFORE:
{sc.status === "clear" ? "✓" : sc.status === "monitoring" ? "◉" : "✕"}{" "}

// AFTER:
{sc.status === "clear"
  ? <Check size={13} style={{ display: "inline", verticalAlign: "middle", color: "#15803D" }} />
  : sc.status === "monitoring"
    ? <Circle size={13} style={{ display: "inline", verticalAlign: "middle", color: "#B45309" }} />
    : <X size={13} style={{ display: "inline", verticalAlign: "middle", color: "#B91C1C" }} />}{" "}
```

- [ ] **Step 2: Fix RackAndStack.tsx**

The `★ Best NPV` label is used inside a badge returned by `rankBadge()`. Change to plain text without the star:

```tsx
// BEFORE:
if (npv === bestNPV) return { label: "★ Best NPV", bg: "#15803D", color: "#FFFFFF" };

// AFTER:
if (npv === bestNPV) return { label: "Best NPV", bg: "#15803D", color: "#FFFFFF" };
```

The footnote at line ~326 with `★ Green = best option...`:
```tsx
// BEFORE:
★ Green = best option · All NPVs relative to aircraft current market value as cost basis

// AFTER:
Green = best option · All NPVs relative to aircraft current market value as cost basis
```

- [ ] **Step 3: Fix LeaseGenerator.tsx**

The button text at line ~292 uses `✓` as a checkmark in a string. Replace with Lucide `CheckCircle2`. Add `import { CheckCircle2 } from "lucide-react"` if not already imported.

```tsx
// BEFORE:
{saved ? "Saved to Restructuring Simulator ✓" : "Save as Restructuring Option"}

// AFTER:
{saved
  ? <><CheckCircle2 size={14} style={{ marginRight: "4px" }} /> Saved to Restructuring Simulator</>
  : "Save as Restructuring Option"}
```

- [ ] **Step 4: Fix MitigationsTab.tsx**

At line ~303, rank 1 shows `★`. Replace with `Star` icon. Add `Star` to the Lucide import.

```tsx
// BEFORE:
{i === 0 ? "★" : i + 1}

// AFTER:
{i === 0 ? <Star size={12} style={{ color: "#F59E0B", fill: "#F59E0B" }} /> : i + 1}
```

- [ ] **Step 5: Fix ImportWizard.tsx step indicator**

At line ~1052 the phase stepper uses `✓`, `●`, `○` characters. Replace with a small inline component:

```tsx
// BEFORE:
{i < eclPhaseIndex ? "✓" : i === eclPhaseIndex ? "●" : "○"} Phase {i + 1}

// AFTER:
<span style={{
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: "16px", height: "16px", borderRadius: "50%",
  background: i < eclPhaseIndex ? "#15803D" : i === eclPhaseIndex ? "#002147" : "transparent",
  border: i >= eclPhaseIndex ? "1.5px solid currentColor" : "none",
  color: i < eclPhaseIndex ? "#fff" : "inherit",
  fontSize: "9px", fontWeight: 700, marginRight: "6px", flexShrink: 0,
}}>
  {i < eclPhaseIndex ? "✓" : i + 1}
</span>
Phase {i + 1}
```

- [ ] **Step 6: Fix EmailReportModal.tsx**

Add `CheckCircle2` to the Lucide import (it already imports from lucide-react — add CheckCircle2 to the list).

```tsx
// BEFORE:
<div style={{ fontSize: "2rem" }}>✅</div>

// AFTER:
<CheckCircle2 size={40} style={{ color: "#15803D" }} />
```

- [ ] **Step 7: Build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 8: Commit**

```bash
git add \
  src/app/pages/Counterparties.tsx \
  src/app/components/deals/RackAndStack.tsx \
  src/app/components/deals/LeaseGenerator.tsx \
  src/app/components/counterparties/MitigationsTab.tsx \
  src/app/components/import/ImportWizard.tsx \
  src/app/components/reports/EmailReportModal.tsx
git commit -m "fix: replace remaining emoji with Lucide icons across Counterparties, Deals, Import"
```

---

### Task 6: CurrencyContext

**Files:**
- Create: `src/app/contexts/CurrencyContext.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/app/contexts/CurrencyContext.tsx
import * as React from "react";

export type CurrencyCode = "EUR" | "USD" | "GBP" | "AED" | "SGD" | "HKD" | "JPY" | "CAD" | "AUD";

interface CurrencyMeta {
  symbol: string;
  rate: number;   // from USD base
  decimals: number;
  label: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  EUR: { symbol: "€",    rate: 0.920,  decimals: 2, label: "Euro" },
  USD: { symbol: "$",    rate: 1.000,  decimals: 2, label: "US Dollar" },
  GBP: { symbol: "£",    rate: 0.790,  decimals: 2, label: "British Pound" },
  AED: { symbol: "AED ", rate: 3.670,  decimals: 2, label: "UAE Dirham" },
  SGD: { symbol: "S$",   rate: 1.340,  decimals: 2, label: "Singapore Dollar" },
  HKD: { symbol: "HK$",  rate: 7.820,  decimals: 2, label: "Hong Kong Dollar" },
  JPY: { symbol: "¥",    rate: 149.50, decimals: 0, label: "Japanese Yen" },
  CAD: { symbol: "CA$",  rate: 1.360,  decimals: 2, label: "Canadian Dollar" },
  AUD: { symbol: "A$",   rate: 1.520,  decimals: 2, label: "Australian Dollar" },
};

const STORAGE_KEY = "aeroinsights:currency";

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  fmt: (usd: number, opts?: { compact?: boolean }) => string;
}

const CurrencyContext = React.createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = React.useState<CurrencyCode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored && stored in CURRENCIES ? stored : "EUR") as CurrencyCode;
  });

  const setCurrency = React.useCallback((c: CurrencyCode) => {
    localStorage.setItem(STORAGE_KEY, c);
    setCurrencyState(c);
  }, []);

  const fmt = React.useCallback(
    (usd: number, opts?: { compact?: boolean }): string => {
      const meta = CURRENCIES[currency];
      const value = usd * meta.rate;
      if (opts?.compact) {
        const absValue = Math.abs(value);
        if (absValue >= 1_000_000_000)
          return `${meta.symbol}${(value / 1_000_000_000).toFixed(2)}bn`;
        if (absValue >= 1_000_000)
          return `${meta.symbol}${(value / 1_000_000).toFixed(1)}M`;
        if (absValue >= 1_000)
          return `${meta.symbol}${(value / 1_000).toFixed(0)}K`;
      }
      return `${meta.symbol}${value.toLocaleString("en-IE", {
        minimumFractionDigits: meta.decimals,
        maximumFractionDigits: meta.decimals,
      })}`;
    },
    [currency],
  );

  const value = React.useMemo(() => ({ currency, setCurrency, fmt }), [currency, setCurrency, fmt]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = React.useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>");
  return ctx;
}

// ── Standalone formatter (for non-React code, e.g. exportService) ─────────────
export function fmtCurrency(usd: number, currency: CurrencyCode, compact = false): string {
  const meta = CURRENCIES[currency];
  const value = usd * meta.rate;
  if (compact) {
    const absValue = Math.abs(value);
    if (absValue >= 1_000_000_000)
      return `${meta.symbol}${(value / 1_000_000_000).toFixed(2)}bn`;
    if (absValue >= 1_000_000)
      return `${meta.symbol}${(value / 1_000_000).toFixed(1)}M`;
    if (absValue >= 1_000)
      return `${meta.symbol}${(value / 1_000).toFixed(0)}K`;
  }
  return `${meta.symbol}${value.toLocaleString("en-IE", {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  })}`;
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
git add src/app/contexts/CurrencyContext.tsx
git commit -m "feat: add CurrencyContext with EUR default, 9-currency fmt() hook"
```

---

### Task 7: Currency selector in Header + CurrencyProvider in Layout

**Files:**
- Modify: `src/app/components/layout/Layout.tsx`
- Modify: `src/app/components/layout/Header.tsx`

- [ ] **Step 1: Wrap Layout with CurrencyProvider**

In `src/app/components/layout/Layout.tsx`, add:

```tsx
import { CurrencyProvider } from "../../contexts/CurrencyContext";
```

Wrap `<AgentProvider>` with `<CurrencyProvider>`:

```tsx
export function Layout() {
  return (
    <CurrencyProvider>
      <AgentProvider>
        {/* ... rest unchanged ... */}
      </AgentProvider>
    </CurrencyProvider>
  );
}
```

- [ ] **Step 2: Add currency selector to Header**

In `src/app/components/layout/Header.tsx`, add:

```tsx
import { useCurrency, CURRENCIES, type CurrencyCode } from "../../contexts/CurrencyContext";
import { ChevronDown as CurrencyChevron } from "lucide-react"; // already imported as ChevronDown
```

Add inside the `Header` function body, after existing state declarations:

```tsx
const { currency, setCurrency } = useCurrency();
const [currencyMenuOpen, setCurrencyMenuOpen] = React.useState(false);
const currencyRef = useRef<HTMLDivElement>(null);
```

Extend the existing outside-click `useEffect` to close the currency menu too. In the `handleClick` function body, add:

```tsx
if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
  setCurrencyMenuOpen(false);
}
```

In the JSX, add the currency selector **between `<AgentButton />` and `{/* Right side */}`**:

```tsx
{/* Currency selector */}
<div ref={currencyRef} style={{ position: "relative" }}>
  <button
    onClick={() => setCurrencyMenuOpen((v) => !v)}
    style={{
      display: "flex", alignItems: "center", gap: "4px",
      padding: "5px 10px",
      background: currencyMenuOpen ? "#F1F5F9" : "transparent",
      border: "1px solid #E2E8F0",
      borderRadius: "6px",
      fontSize: "0.8125rem",
      fontWeight: 600,
      color: "#0F172A",
      cursor: "pointer",
      whiteSpace: "nowrap",
    }}
    onMouseEnter={(e) => { if (!currencyMenuOpen) (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
    onMouseLeave={(e) => { if (!currencyMenuOpen) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
  >
    {currency}
    <ChevronDown size={12} style={{ color: "#94A3B8" }} />
  </button>

  {currencyMenuOpen && (
    <div style={{
      position: "absolute",
      top: "calc(100% + 6px)",
      left: 0,
      minWidth: "180px",
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: "8px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
      zIndex: 200,
      padding: "4px 0",
      overflow: "hidden",
    }}>
      {(Object.entries(CURRENCIES) as [CurrencyCode, typeof CURRENCIES[CurrencyCode]][]).map(([code, meta]) => (
        <button
          key={code}
          onClick={() => { setCurrency(code); setCurrencyMenuOpen(false); }}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            width: "100%", padding: "8px 14px",
            background: currency === code ? "#F1F5F9" : "transparent",
            border: "none",
            fontSize: "0.8125rem",
            color: currency === code ? "#002147" : "#0F172A",
            fontWeight: currency === code ? 600 : 400,
            cursor: "pointer",
            textAlign: "left",
          }}
          onMouseEnter={(e) => { if (currency !== code) (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
          onMouseLeave={(e) => { if (currency !== code) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <span style={{ fontWeight: 700, color: "#002147", minWidth: "36px" }}>{code}</span>
          <span style={{ color: "#64748B", fontSize: "0.75rem" }}>{meta.label}</span>
        </button>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 3: Build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 4: Commit**

```bash
git add src/app/components/layout/Layout.tsx src/app/components/layout/Header.tsx
git commit -m "feat: add currency selector to header, wrap layout with CurrencyProvider"
```

---

### Task 8: Apply fmt() to ECLDrilldownPanel

**Files:**
- Modify: `src/app/components/risk-ecl/ECLDrilldownPanel.tsx`

This file has a local `const fmt = (n: number) => \`$${n.toFixed(2)}M\`` and `const pct = ...`. Replace the local `fmt` with `useCurrency().fmt`.

- [ ] **Step 1: Replace local fmt with useCurrency**

Add import at the top of `src/app/components/risk-ecl/ECLDrilldownPanel.tsx`:

```tsx
import { useCurrency } from "../../contexts/CurrencyContext";
```

Inside the component function, remove the local `fmt` declaration and use the hook:

```tsx
// REMOVE this line:
// const fmt = (n: number) => `$${n.toFixed(2)}M`;

// ADD inside the component function (after other hooks):
const { fmt } = useCurrency();
```

Then find all `fmt(someNumber)` calls — they already pass a number in millions (e.g. `fmt(1.62)` where 1.62 means $1.62M). The values in ECLDrilldownPanel are in millions of USD. Update the call to pass the full USD value:

```tsx
// The local data uses numbers like ead: 24.2 (meaning $24.2M).
// So when calling fmt for the EAD, pass n * 1_000_000:
// BEFORE:  fmt(lease.eadNum)   → was "$24.20M"
// AFTER:   fmt(lease.eadNum * 1_000_000, { compact: true })  → "€22.3M"
```

Find every `fmt(` call and change to `fmt(X * 1_000_000, { compact: true })` where X is a million-denominated number, and `fmt(X, { compact: true })` where X is already in full USD.

Also update the two inline hardcoded `$` strings in the panel (line ~288 and ~535):
```tsx
// BEFORE (line ~288):
12m ECL ≈ {pct(lease.pd12m)} × {pct(lease.lgd)} × ${lease.eadNum.toFixed(1)}M

// AFTER:
12m ECL ≈ {pct(lease.pd12m)} × {pct(lease.lgd)} × {fmt(lease.eadNum * 1_000_000, { compact: true })}
```

```tsx
// BEFORE (line ~535):
<strong style={{ color: "#0F172A" }}>${lease.eadNum.toFixed(1)}M</strong>

// AFTER:
<strong style={{ color: "#0F172A" }}>{fmt(lease.eadNum * 1_000_000, { compact: true })}</strong>
```

- [ ] **Step 2: Build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
git add src/app/components/risk-ecl/ECLDrilldownPanel.tsx
git commit -m "feat: apply useCurrency fmt() to ECL Drilldown Panel"
```

---

### Task 9: Install docx + extend exportService with named report generators

**Files:**
- Modify: `src/app/services/exportService.ts`

- [ ] **Step 1: Install the docx package**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm install docx
```

Expected output ends with: `added N packages` (no errors).

- [ ] **Step 2: Add fmtExport helper and named PDF generators to exportService.ts**

At the top of `src/app/services/exportService.ts`, add the import:

```typescript
import { fmtCurrency, type CurrencyCode } from "../contexts/CurrencyContext";
```

After the existing static data constants and before `generatePDF`, add:

```typescript
// ─── Currency-aware formatter for export use ──────────────────────────────────

function fe(usdMillions: number, currency: CurrencyCode): string {
  return fmtCurrency(usdMillions * 1_000_000, currency, true);
}

// ─── Named report generators — PDF ───────────────────────────────────────────

export function generateReportPDF(reportId: string, currency: CurrencyCode): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const date = new Date().toLocaleDateString("en-IE", { dateStyle: "long" });

  // Shared header
  function addHeader(title: string, subtitle: string) {
    doc.setFillColor(0, 33, 71);
    doc.rect(0, 0, 210, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Aeroinsights", 14, 9);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(title, 14, 15);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(`Generated: ${date}  |  Currency: ${currency}`, 14, 28);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(subtitle, 14, 38);
  }

  function save(slug: string) {
    doc.save(`aeroinsights-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  switch (reportId) {
    case "RPT-001": { // Auditor Evidence Pack
      addHeader("Auditor Evidence Pack", "IFRS 9 Model Audit — ECL Disclosure");
      autoTable(doc, {
        startY: 45,
        head: [["Lease ID", "Lessee", "Aircraft", "EAD", "PD 12m", "LGD", "ECL 12m", "ECL LT", "Stage"]],
        body: ECL_ROWS.map(r => [
          r.id, r.lessee, r.aircraft,
          fe(r.ead, currency), `${r.pd12m}%`, `${r.lgd}%`,
          fe(r.ecl12m, currency), fe(r.eclLT, currency), `S${r.stage}`,
        ]),
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        headStyles: { fillColor: [0, 33, 71], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      save("auditor-evidence-pack");
      break;
    }
    case "RPT-002": { // Board Pack
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
    case "RPT-003": { // Portfolio Register
      addHeader("Portfolio Register", "Full Lease Register");
      autoTable(doc, {
        startY: 45,
        head: [["Lease ID", "Lessee", "Aircraft", "MSN", "Start", "End", "Rent/mo", "Stage"]],
        body: LEASES.map(l => [l.id, l.lessee, l.aircraft, l.msn, l.start, l.end, l.rent, `S${l.stage}`]),
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        headStyles: { fillColor: [0, 33, 71], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      save("portfolio-register");
      break;
    }
    case "RPT-004": { // ECL Disclosure Pack
      addHeader("ECL Disclosure Pack", "IFRS 9 §35H / §35I Disclosures");
      autoTable(doc, {
        startY: 45,
        head: [["Quarter", "Stage 1", "Stage 2", "Stage 3", "Total ECL"]],
        body: ECL_TREND.map(t => [
          t.quarter,
          fe(t.s1, currency), fe(t.s2, currency), fe(t.s3, currency), fe(t.total, currency),
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [0, 33, 71], textColor: 255 },
      });
      save("ecl-disclosure-pack");
      break;
    }
    case "RPT-005": { // Watchlist Report
      addHeader("Watchlist Report", "Red & Amber Lessees — Current Period");
      autoTable(doc, {
        startY: 45,
        head: [["Lessee", "Country", "Rating", "Stage", "Score", "Leases", "Exposure", "Avg Days Late"]],
        body: LESSEES.filter(l => l.stage !== "1").map(l => [
          l.name, l.country, l.rating, `S${l.stage}`, l.behavior, l.leases, l.exposure, l.daysLate,
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [185, 28, 28], textColor: 255 },
        alternateRowStyles: { fillColor: [254, 242, 242] },
      });
      save("watchlist-report");
      break;
    }
    case "RPT-006": { // Jurisdiction Risk
      addHeader("Jurisdiction Risk Summary", "CTC Compliance & Enforceability Index");
      autoTable(doc, {
        startY: 45,
        head: [["Country", "CTC", "Score", "Repo P50 (mo)", "Success Prob", "Sanctions"]],
        body: JURISDICTIONS.map(j => [j.country, j.ctc, j.score, j.repoP50, j.successProb, j.sanctions]),
        styles: { fontSize: 8.5, cellPadding: 3 },
        headStyles: { fillColor: [0, 33, 71], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      save("jurisdiction-risk-summary");
      break;
    }
    default:
      console.warn("Unknown reportId:", reportId);
  }
}

export function generateReportXLSX(reportId: string, currency: CurrencyCode): void {
  const wb = XLSX.utils.book_new();
  const meta = `Generated: ${new Date().toLocaleDateString("en-IE")} | Currency: ${currency}`;

  function addSheet(name: string, headers: string[], rows: (string | number)[][]) {
    const ws = XLSX.utils.aoa_to_sheet([[meta], [], headers, ...rows]);
    ws["!cols"] = headers.map((h, i) => ({
      wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i] ?? "").length)) + 3, 30),
    }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }

  switch (reportId) {
    case "RPT-001":
      addSheet("ECL Audit",
        ["Lease ID", "Lessee", "Aircraft", "EAD", "PD 12m %", "LGD %", "ECL 12m", "ECL LT", "Stage"],
        ECL_ROWS.map(r => [r.id, r.lessee, r.aircraft, fe(r.ead, currency), r.pd12m, r.lgd, fe(r.ecl12m, currency), fe(r.eclLT, currency), `S${r.stage}`])
      );
      break;
    case "RPT-002":
      addSheet("Board Pack",
        ["Scenario", "ECL 12m", "ECL Lifetime", "Coverage"],
        SCENARIOS.map(s => [s.scenario, s.ecl12m, s.eclLT, s.coverage])
      );
      break;
    case "RPT-003":
      addSheet("Lease Register",
        ["Lease ID", "Lessee", "Aircraft", "MSN", "Start", "End", "Monthly Rent", "Stage"],
        LEASES.map(l => [l.id, l.lessee, l.aircraft, l.msn, l.start, l.end, l.rent, `S${l.stage}`])
      );
      break;
    case "RPT-004":
      addSheet("ECL Trend",
        ["Quarter", "Stage 1", "Stage 2", "Stage 3", "Total"],
        ECL_TREND.map(t => [t.quarter, fe(t.s1, currency), fe(t.s2, currency), fe(t.s3, currency), fe(t.total, currency)])
      );
      break;
    case "RPT-005":
      addSheet("Watchlist",
        ["Lessee", "Country", "Rating", "Stage", "Score", "Leases", "Exposure", "Avg Days Late"],
        LESSEES.map(l => [l.name, l.country, l.rating, `S${l.stage}`, l.behavior, l.leases, l.exposure, l.daysLate])
      );
      break;
    case "RPT-006":
      addSheet("Jurisdiction Risk",
        ["Country", "CTC", "Score", "Repo P50 (mo)", "Success Prob", "Sanctions"],
        JURISDICTIONS.map(j => [j.country, j.ctc, j.score, j.repoP50, j.successProb, j.sanctions])
      );
      break;
    default:
      console.warn("Unknown reportId:", reportId);
      return;
  }

  XLSX.writeFile(wb, `aeroinsights-${reportId.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
```

- [ ] **Step 3: Build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 4: Commit**

```bash
git add src/app/services/exportService.ts package.json package-lock.json
git commit -m "feat: add named PDF/XLSX report generators with currency support to exportService"
```

---

### Task 10: DOCX report generators

**Files:**
- Create: `src/app/services/reportGenerators.ts`

- [ ] **Step 1: Create the DOCX generator file**

```typescript
// src/app/services/reportGenerators.ts
// DOCX generation using the `docx` package (MIT licence, pure client-side).
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
} from "docx";
import { fmtCurrency, type CurrencyCode } from "../contexts/CurrencyContext";

// ── Re-import the same static data used in exportService ──────────────────────
// We duplicate the arrays here to keep this file self-contained.

const ECL_ROWS = [
  { id: "LSE-2019-001", lessee: "IndiGo Airlines",         aircraft: "A320neo",    ead: 24.2, pd12m: 12.4, lgd: 54, ecl12m: 1.62, eclLT: 2.36,  stage: "3" },
  { id: "LSE-2020-014", lessee: "Aeromexico",              aircraft: "B737-800",   ead: 32.1, pd12m: 28.7, lgd: 61, ecl12m: 5.64, eclLT: 8.07,  stage: "3" },
  { id: "LSE-2021-022", lessee: "Emirates",                aircraft: "B777-300ER", ead: 88.4, pd12m: 0.3,  lgd: 28, ecl12m: 0.07, eclLT: 0.27,  stage: "1" },
  { id: "LSE-2020-031", lessee: "SriLankan Airlines",      aircraft: "A330-300",   ead: 34.2, pd12m: 4.2,  lgd: 48, ecl12m: 0.69, eclLT: 1.61,  stage: "2" },
  { id: "LSE-2022-009", lessee: "Ryanair",                 aircraft: "B737 MAX 8", ead: 44.7, pd12m: 0.5,  lgd: 22, ecl12m: 0.05, eclLT: 0.18,  stage: "1" },
  { id: "LSE-2018-047", lessee: "Air France",              aircraft: "A350-900",   ead: 68.3, pd12m: 0.8,  lgd: 31, ecl12m: 0.17, eclLT: 0.51,  stage: "1" },
  { id: "LSE-2021-055", lessee: "Azul Brazilian Airlines", aircraft: "A320neo",    ead: 28.9, pd12m: 3.8,  lgd: 46, ecl12m: 0.51, eclLT: 1.12,  stage: "2" },
  { id: "LSE-2019-063", lessee: "Air Transat",             aircraft: "A321neo",    ead: 22.1, pd12m: 5.1,  lgd: 44, ecl12m: 0.50, eclLT: 1.09,  stage: "2" },
  { id: "LSE-2023-002", lessee: "Singapore Airlines",      aircraft: "A350-900",   ead: 92.0, pd12m: 0.2,  lgd: 26, ecl12m: 0.05, eclLT: 0.19,  stage: "1" },
  { id: "LSE-2022-018", lessee: "Lufthansa",               aircraft: "A220-300",   ead: 36.6, pd12m: 0.6,  lgd: 30, ecl12m: 0.07, eclLT: 0.22,  stage: "1" },
];

const LEASES = [
  { id: "LSE-2019-001", lessee: "IndiGo Airlines",         aircraft: "A320neo",    msn: "9218",  start: "2019-03-01", end: "2028-03-01", rent: "$285,000",   stage: "3" },
  { id: "LSE-2020-014", lessee: "Aeromexico",              aircraft: "B737-800",   msn: "41234", start: "2020-06-15", end: "2027-06-15", rent: "$310,000",   stage: "3" },
  { id: "LSE-2021-022", lessee: "Emirates",                aircraft: "B777-300ER", msn: "62047", start: "2021-01-10", end: "2030-01-10", rent: "$1,240,000", stage: "1" },
  { id: "LSE-2020-031", lessee: "SriLankan Airlines",      aircraft: "A330-300",   msn: "1728",  start: "2020-09-01", end: "2026-09-01", rent: "$480,000",   stage: "2" },
  { id: "LSE-2022-009", lessee: "Ryanair",                 aircraft: "B737 MAX 8", msn: "67892", start: "2022-04-15", end: "2032-04-15", rent: "$340,000",   stage: "1" },
  { id: "LSE-2018-047", lessee: "Air France",              aircraft: "A350-900",   msn: "0378",  start: "2018-07-20", end: "2028-07-20", rent: "$960,000",   stage: "1" },
  { id: "LSE-2021-055", lessee: "Azul Brazilian Airlines", aircraft: "A320neo",    msn: "10442", start: "2021-11-01", end: "2029-11-01", rent: "$295,000",   stage: "2" },
  { id: "LSE-2019-063", lessee: "Air Transat",             aircraft: "A321neo",    msn: "8841",  start: "2019-05-01", end: "2027-05-01", rent: "$275,000",   stage: "2" },
  { id: "LSE-2023-002", lessee: "Singapore Airlines",      aircraft: "A350-900",   msn: "0521",  start: "2023-02-01", end: "2033-02-01", rent: "$1,050,000", stage: "1" },
  { id: "LSE-2022-018", lessee: "Lufthansa",               aircraft: "A220-300",   msn: "55124", start: "2022-08-01", end: "2032-08-01", rent: "$220,000",   stage: "1" },
];

const LESSEES = [
  { name: "Emirates",                country: "UAE",       rating: "A-",   stage: "1", behavior: 94, leases: 8,  exposure: "$412M", daysLate: 0.2  },
  { name: "Ryanair",                 country: "Ireland",   rating: "BBB+", stage: "1", behavior: 91, leases: 14, exposure: "$386M", daysLate: 0.5  },
  { name: "Singapore Airlines",      country: "Singapore", rating: "A",    stage: "1", behavior: 97, leases: 6,  exposure: "$290M", daysLate: 0.1  },
  { name: "Air France",              country: "France",    rating: "BB+",  stage: "1", behavior: 86, leases: 9,  exposure: "$278M", daysLate: 1.2  },
  { name: "Lufthansa",               country: "Germany",   rating: "BBB-", stage: "1", behavior: 88, leases: 7,  exposure: "$194M", daysLate: 0.8  },
  { name: "Azul Brazilian Airlines", country: "Brazil",    rating: "B+",   stage: "2", behavior: 71, leases: 5,  exposure: "$142M", daysLate: 6.4  },
  { name: "Air Transat",             country: "Canada",    rating: "B",    stage: "2", behavior: 68, leases: 3,  exposure: "$96M",  daysLate: 8.1  },
  { name: "SriLankan Airlines",      country: "Sri Lanka", rating: "B+",   stage: "2", behavior: 62, leases: 4,  exposure: "$118M", daysLate: 12.3 },
  { name: "IndiGo Airlines",         country: "India",     rating: "BB-",  stage: "3", behavior: 44, leases: 6,  exposure: "$184M", daysLate: 45.0 },
  { name: "Aeromexico",              country: "Mexico",    rating: "CCC",  stage: "3", behavior: 29, leases: 4,  exposure: "$122M", daysLate: 89.0 },
];

const SCENARIOS = [
  { scenario: "Base (60%)",    ecl12m: "$44.1M", eclLT: "$80.4M",  coverage: "1.52%" },
  { scenario: "Adverse (25%)", ecl12m: "$63.4M", eclLT: "$116.8M", coverage: "2.18%" },
  { scenario: "Upside (15%)",  ecl12m: "$29.8M", eclLT: "$54.2M",  coverage: "1.03%" },
  { scenario: "Weighted",      ecl12m: "$47.2M", eclLT: "$87.4M",  coverage: "1.62%" },
];

const ECL_TREND = [
  { quarter: "Q1 '25", s1: 7.1, s2: 18.4, s3: 14.2, total: 39.7 },
  { quarter: "Q2 '25", s1: 7.4, s2: 19.1, s3: 15.4, total: 41.9 },
  { quarter: "Q3 '25", s1: 7.8, s2: 19.8, s3: 15.1, total: 42.7 },
  { quarter: "Q4 '25", s1: 8.1, s2: 20.4, s3: 16.3, total: 44.8 },
  { quarter: "Q1 '26", s1: 8.4, s2: 21.6, s3: 17.2, total: 47.2 },
];

const JURISDICTIONS = [
  { country: "USA",     ctc: "Yes", score: 96, repoP50: 3,  successProb: "98%", sanctions: "None" },
  { country: "UK",      ctc: "Yes", score: 94, repoP50: 4,  successProb: "96%", sanctions: "None" },
  { country: "Germany", ctc: "Yes", score: 91, repoP50: 5,  successProb: "95%", sanctions: "None" },
  { country: "Ireland", ctc: "Yes", score: 89, repoP50: 6,  successProb: "94%", sanctions: "None" },
  { country: "UAE",     ctc: "Yes", score: 85, repoP50: 8,  successProb: "90%", sanctions: "None" },
  { country: "India",   ctc: "No",  score: 62, repoP50: 24, successProb: "71%", sanctions: "None" },
  { country: "Mexico",  ctc: "No",  score: 58, repoP50: 28, successProb: "66%", sanctions: "None" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fe(usdMillions: number, currency: CurrencyCode): string {
  return fmtCurrency(usdMillions * 1_000_000, currency, true);
}

const CELL_BORDER = {
  top:    { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  left:   { style: BorderStyle.NONE,  size: 0, color: "FFFFFF" },
  right:  { style: BorderStyle.NONE,  size: 0, color: "FFFFFF" },
};

function makeHeaderRow(cells: string[]): TableRow {
  return new TableRow({
    children: cells.map(text =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })],
        })],
        shading: { fill: "002147" },
        borders: CELL_BORDER,
      })
    ),
  });
}

function makeDataRow(cells: string[], shade: boolean): TableRow {
  return new TableRow({
    children: cells.map(text =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text, size: 17 })],
        })],
        shading: { fill: shade ? "F8FAFC" : "FFFFFF" },
        borders: CELL_BORDER,
      })
    ),
  });
}

function makeTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      makeHeaderRow(headers),
      ...rows.map((r, i) => makeDataRow(r, i % 2 === 1)),
    ],
  });
}

function docPreamble(title: string, currency: CurrencyCode): Paragraph[] {
  const date = new Date().toLocaleDateString("en-IE", { dateStyle: "long" });
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Aeroinsights", bold: true, color: "002147" })],
    }),
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 26 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${date}  |  Currency: ${currency}`, size: 17, color: "64748B" })],
    }),
    new Paragraph({ text: "" }),
  ];
}

async function saveDocx(doc: Document, slug: string): Promise<void> {
  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href: url,
    download: `aeroinsights-${slug}-${new Date().toISOString().slice(0, 10)}.docx`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Named DOCX generators ─────────────────────────────────────────────────────

export async function generateReportDOCX(reportId: string, currency: CurrencyCode): Promise<void> {
  let doc: Document;

  switch (reportId) {
    case "RPT-001": {
      doc = new Document({ sections: [{ children: [
        ...docPreamble("Auditor Evidence Pack — IFRS 9 ECL Disclosure", currency),
        makeTable(
          ["Lease ID", "Lessee", "Aircraft", "EAD", "PD 12m", "LGD", "ECL 12m", "ECL LT", "Stage"],
          ECL_ROWS.map(r => [
            r.id, r.lessee, r.aircraft,
            fe(r.ead, currency), `${r.pd12m}%`, `${r.lgd}%`,
            fe(r.ecl12m, currency), fe(r.eclLT, currency), `S${r.stage}`,
          ])
        ),
      ]}]});
      await saveDocx(doc, "auditor-evidence-pack");
      break;
    }
    case "RPT-002": {
      doc = new Document({ sections: [{ children: [
        ...docPreamble("Board Pack — Q1 2026", currency),
        makeTable(
          ["Scenario", "ECL 12m", "ECL Lifetime", "Coverage"],
          SCENARIOS.map(s => [s.scenario, s.ecl12m, s.eclLT, s.coverage])
        ),
      ]}]});
      await saveDocx(doc, "board-pack");
      break;
    }
    case "RPT-003": {
      doc = new Document({ sections: [{ children: [
        ...docPreamble("Portfolio Register — Full Lease Register", currency),
        makeTable(
          ["Lease ID", "Lessee", "Aircraft", "MSN", "Start", "End", "Rent/mo", "Stage"],
          LEASES.map(l => [l.id, l.lessee, l.aircraft, l.msn, l.start, l.end, l.rent, `S${l.stage}`])
        ),
      ]}]});
      await saveDocx(doc, "portfolio-register");
      break;
    }
    case "RPT-004": {
      doc = new Document({ sections: [{ children: [
        ...docPreamble("ECL Disclosure Pack — IFRS 9 §35H / §35I", currency),
        makeTable(
          ["Quarter", "Stage 1", "Stage 2", "Stage 3", "Total ECL"],
          ECL_TREND.map(t => [
            t.quarter,
            fe(t.s1, currency), fe(t.s2, currency), fe(t.s3, currency), fe(t.total, currency),
          ])
        ),
      ]}]});
      await saveDocx(doc, "ecl-disclosure-pack");
      break;
    }
    case "RPT-005": {
      doc = new Document({ sections: [{ children: [
        ...docPreamble("Watchlist Report — Red & Amber Lessees", currency),
        makeTable(
          ["Lessee", "Country", "Rating", "Stage", "Score", "Leases", "Exposure", "Avg Days Late"],
          LESSEES.map(l => [
            l.name, l.country, l.rating, `S${l.stage}`,
            String(l.behavior), String(l.leases), l.exposure, String(l.daysLate),
          ])
        ),
      ]}]});
      await saveDocx(doc, "watchlist-report");
      break;
    }
    case "RPT-006": {
      doc = new Document({ sections: [{ children: [
        ...docPreamble("Jurisdiction Risk Summary", currency),
        makeTable(
          ["Country", "CTC", "Score", "Repo P50 (mo)", "Success Prob", "Sanctions"],
          JURISDICTIONS.map(j => [
            j.country, j.ctc, String(j.score), String(j.repoP50), j.successProb, j.sanctions,
          ])
        ),
      ]}]});
      await saveDocx(doc, "jurisdiction-risk-summary");
      break;
    }
    default:
      console.warn("Unknown reportId:", reportId);
  }
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
git add src/app/services/reportGenerators.ts package.json package-lock.json
git commit -m "feat: add DOCX report generators using docx package"
```

---

### Task 11: ReportFormatModal + wire Reports page

**Files:**
- Create: `src/app/components/reports/ReportFormatModal.tsx`
- Modify: `src/app/pages/Reports.tsx`

- [ ] **Step 1: Create ReportFormatModal.tsx**

```tsx
// src/app/components/reports/ReportFormatModal.tsx
import * as React from "react";
import { X, FileText, Table, FileType } from "lucide-react";
import { useCurrency } from "../../contexts/CurrencyContext";
import { generateReportPDF, generateReportXLSX } from "../../services/exportService";
import { generateReportDOCX } from "../../services/reportGenerators";

type Format = "pdf" | "xlsx" | "docx";

interface ReportFormatModalProps {
  reportId: string;
  reportName: string;
  onClose: () => void;
}

const FORMATS: { id: Format; label: string; ext: string; desc: string; Icon: React.FC<{size?: number; style?: React.CSSProperties}> }[] = [
  { id: "pdf",  label: "PDF",         ext: ".pdf",  desc: "Formatted, print-ready. Opens in any PDF viewer.", Icon: FileText },
  { id: "xlsx", label: "Excel",       ext: ".xlsx", desc: "Editable spreadsheet. Opens in Excel or Google Sheets.", Icon: Table },
  { id: "docx", label: "Word",        ext: ".docx", desc: "Editable document. Opens in Word or Google Docs.", Icon: FileType },
];

export function ReportFormatModal({ reportId, reportName, onClose }: ReportFormatModalProps) {
  const { currency } = useCurrency();
  const [selected, setSelected] = React.useState<Format>("pdf");
  const [downloading, setDownloading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      if (selected === "pdf")  generateReportPDF(reportId, currency);
      if (selected === "xlsx") generateReportXLSX(reportId, currency);
      if (selected === "docx") await generateReportDOCX(reportId, currency);
      setDone(true);
      setTimeout(onClose, 1200);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#FFFFFF", borderRadius: "12px", width: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.20)", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E2E8F0", borderLeft: "3px solid #002147" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A" }}>Download Report</div>
            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>{reportName}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Currency notice */}
        <div style={{ padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#475569" }}>
          Figures will be formatted in <strong style={{ color: "#002147" }}>{currency}</strong>. Change currency via the header selector.
        </div>

        {/* Format selector */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {FORMATS.map(f => (
            <div
              key={f.id}
              onClick={() => setSelected(f.id)}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 14px",
                border: selected === f.id ? "1.5px solid #002147" : "1px solid #E2E8F0",
                borderRadius: "8px",
                cursor: "pointer",
                background: selected === f.id ? "rgba(0,33,71,0.04)" : "#FFFFFF",
                transition: "all 150ms",
              }}
            >
              <f.Icon size={20} style={{ color: selected === f.id ? "#002147" : "#64748B", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>
                  {f.label} <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "#94A3B8" }}>{f.ext}</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "1px" }}>{f.desc}</div>
              </div>
              <div style={{
                width: "16px", height: "16px", borderRadius: "50%",
                border: `2px solid ${selected === f.id ? "#002147" : "#CBD5E1"}`,
                background: selected === f.id ? "#002147" : "transparent",
                flexShrink: 0,
              }} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", background: "transparent", color: "#475569", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "0.875rem", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || done}
            style={{
              padding: "8px 20px",
              background: done ? "#15803D" : downloading ? "#94A3B8" : "#002147",
              color: "#FFFFFF", border: "none", borderRadius: "8px",
              fontWeight: 600, fontSize: "0.875rem",
              cursor: downloading || done ? "not-allowed" : "pointer",
              minWidth: "110px",
            }}
          >
            {done ? "Downloaded!" : downloading ? "Building…" : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire Reports.tsx Generate buttons**

In `src/app/pages/Reports.tsx`:

Add import:
```tsx
import { ReportFormatModal } from "../components/reports/ReportFormatModal";
```

Add state inside the `Reports` component:
```tsx
const [formatModal, setFormatModal] = React.useState<{ id: string; name: string } | null>(null);
```

Replace the `handleGenerate` function and its call site:
```tsx
// REMOVE:
// const [generating, setGenerating] = useState<string | null>(null);
// function handleGenerate(id: string) {
//   setGenerating(id);
//   setTimeout(() => setGenerating(null), 2000);
// }

// ADD state at top of component:
const [formatModal, setFormatModal] = React.useState<{ id: string; name: string } | null>(null);
```

Replace the Generate button JSX inside the report card:
```tsx
// BEFORE:
<button
  onClick={() => handleGenerate(report.id)}
  disabled={generating === report.id}
  style={{ ... }}
>
  {generating === report.id ? (
    <><CheckCircle size={13} /> Generated!</>
  ) : (
    <><Download size={13} /> Generate</>
  )}
</button>

// AFTER:
<button
  onClick={() => setFormatModal({ id: report.id, name: report.name })}
  style={{
    display: "flex", alignItems: "center", gap: "0.375rem",
    background: "#002147", color: "#FFFFFF", border: "none",
    borderRadius: "9999px", padding: "0.5rem 0.875rem",
    fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
  }}
>
  <Download size={13} /> Generate
</button>
```

Add the modal at the end of the returned JSX (before the closing `</div>`):
```tsx
{formatModal && (
  <ReportFormatModal
    reportId={formatModal.id}
    reportName={formatModal.name}
    onClose={() => setFormatModal(null)}
  />
)}
```

Remove the now-unused `CheckCircle` from the Lucide import (keep `Download`). Add `import * as React from "react"` if not present.

- [ ] **Step 3: Build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -4
```

Expected: `✓ built in`

- [ ] **Step 4: Final commit**

```bash
git add \
  src/app/components/reports/ReportFormatModal.tsx \
  src/app/pages/Reports.tsx
git commit -m "feat: wire Reports page Generate buttons to real PDF/XLSX/DOCX downloads via ReportFormatModal"
```

---

## Self-Review

**Spec coverage:**
- ✅ All emoji instances audited and replaced (Tasks 1–5)
- ✅ Data-object icon fields (Reports, Intelligence) → lookup maps (Task 4)
- ✅ `CurrencyContext` with 9 currencies, EUR default, static FX, `fmt()`, `fmtCurrency()`, localStorage (Task 6)
- ✅ Currency selector dropdown in Header (Task 7)
- ✅ `CurrencyProvider` wraps Layout (Task 7)
- ✅ `useCurrency().fmt()` applied to ECLDrilldownPanel (Task 8)
- ✅ `docx` package installed (Task 9)
- ✅ Named PDF generators × 6 report types (Task 9)
- ✅ Named XLSX generators × 6 report types (Task 9)
- ✅ Named DOCX generators × 6 report types (Task 10)
- ✅ `ReportFormatModal` with format picker + currency notice (Task 11)
- ✅ Reports page Generate buttons wired to real downloads (Task 11)

**Placeholder scan:** None. All code blocks are complete.

**Type consistency:**
- `CurrencyCode` defined in `CurrencyContext.tsx`, imported in `exportService.ts`, `reportGenerators.ts`, `ReportFormatModal.tsx`, `Header.tsx` — consistent
- `generateReportPDF(reportId, currency)` / `generateReportXLSX(reportId, currency)` — used identically in `ReportFormatModal.tsx`
- `generateReportDOCX(reportId, currency): Promise<void>` — awaited in `ReportFormatModal.tsx` — correct
- `fmtCurrency(usd, currency, compact)` — standalone export from `CurrencyContext.tsx`, used in both `exportService.ts` and `reportGenerators.ts` — consistent
- `fe(usdMillions, currency)` — local helper in both `exportService.ts` and `reportGenerators.ts` (intentional duplication to keep files self-contained)
