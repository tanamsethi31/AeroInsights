# Icons, Currency & Export — Design Spec

**Date:** 2026-05-07  
**Status:** Approved

---

## Goal

Four parallel improvements to Aeroinsights:
1. Replace all emoji with Lucide icons (already used project-wide)
2. Add a EUR-default currency system with 9-currency dropdown
3. Wire the Reports page Generate buttons to real file downloads
4. Add Word (.docx) as an editable export format alongside PDF and Excel

---

## Design Principles (for this sprint)

- **Static over dynamic** — FX rates hardcoded; no live API calls
- **Additive** — new context/hook; existing pages opt in by calling `fmt()`, not forced migration of every number
- **Reuse existing packages** — jspdf, xlsx are already installed; only add `docx`
- **No new routes** — currency selector in Header; format picker is a small modal on the Reports page

---

## Feature 1: Emoji → Lucide Icons

### Inline JSX replacements

| Location | Emoji | Lucide replacement |
|----------|-------|--------------------|
| AgentMessage.tsx (action card) | `⚡` | `<Zap size={14} />` |
| AgentPanel.tsx (warning message) | `⚠` | `<AlertTriangle size={14} />` |
| Scenarios.tsx (2 places) | `⚡` | `<Zap size={14} />` |
| InsolvencyTab.tsx | `⚠️` | `<AlertTriangle size={14} />` |
| PerformanceVsPlan.tsx (warning) | `⚠` | `<AlertTriangle size={14} />` |
| PerformanceVsPlan.tsx (date) | `📅` | `<Calendar size={14} />` |
| SDMRTab.tsx | `⚠` | `<AlertTriangle size={14} />` |
| LeasePricingTab.tsx (warning text) | `⚠` | `<AlertTriangle size={14} />` |
| ConcentrationTab.tsx (2 places) | `⚠` / `✓` (icon) | `<AlertTriangle size={14} />` / `<Check size={14} />` |
| Settings.tsx (2 places) | `⚠` / `✓` (icon) | `<AlertTriangle size={14} />` / `<Check size={14} />` |
| RackAndStack.tsx | `★ Best NPV` label | `<Star size={11} />` + text |
| MitigationsTab.tsx | `★` rank | `<Star size={11} />` for rank 1 only |
| EmailReportModal.tsx | `✅` | `<CheckCircle2 size={32} />` |
| ImportWizard.tsx step dots | `✓` / `●` / `○` | inline `div` step circles |
| Counterparties.tsx status chars | `✓` / `✕` / `◉` / `✈` | `<Check />` / `<X />` / `<Circle />` / `<Plane />` |

### Data-object icon fields

`Reports.tsx` and `Intelligence.tsx` store emoji strings in data arrays (`icon: "📊"`). Strategy: replace the string with a string key and add a `REPORT_ICONS` / `SIGNAL_ICONS` lookup map that returns the Lucide component. The data array field changes from `icon: string` to `iconKey: string`; the render site reads from the map.

| Key | Lucide |
|-----|--------|
| `search` | `Search` |
| `board` | `ClipboardList` |
| `portfolio` | `BarChart3` |
| `ecl` | `Scale` |
| `watchlist` | `AlertTriangle` |
| `jurisdiction` | `Globe` |
| `fuel` | `Fuel` |
| `gdp` | `Globe` |
| `rates` | `BarChart3` |
| `fx` | `ArrowLeftRight` |
| `aviation` | `Plane` |

### Leave as-is

- Inline text `✓` and `✕` used as semantic characters inside strings (e.g. `"CTC party ✓"`, `"Non-CTC"`) — these are meaningful text, not icons.
- Comment markers in code (`§35H ✓`).

---

## Feature 2: Currency System

### Files

| File | Role |
|------|------|
| `src/app/contexts/CurrencyContext.tsx` | Context, static FX table, `useCurrency()` hook |
| `src/app/components/layout/Header.tsx` | Currency selector dropdown (new element) |
| Key pages (see below) | Replace hardcoded `$` formatting with `fmt()` |

### Context API

```typescript
export type CurrencyCode = "EUR" | "USD" | "GBP" | "AED" | "SGD" | "HKD" | "JPY" | "CAD" | "AUD";

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  // fmt converts from USD base to selected currency, formats with symbol
  fmt: (usd: number, opts?: { compact?: boolean; decimals?: number }) => string;
}
```

### Static FX rates (from USD)

| Currency | Rate | Symbol | Decimals |
|----------|------|--------|----------|
| EUR | 0.920 | € | 2 |
| USD | 1.000 | $ | 2 |
| GBP | 0.790 | £ | 2 |
| AED | 3.670 | AED | 2 |
| SGD | 1.340 | S$ | 2 |
| HKD | 7.820 | HK$ | 2 |
| JPY | 149.50 | ¥ | 0 |
| CAD | 1.360 | CA$ | 2 |
| AUD | 1.520 | A$ | 2 |

### Formatter behaviour

```
fmt(285_000)                      → "€262,200"
fmt(285_000, { compact: true })   → "€262K"
fmt(47_200_000, { compact: true })→ "€43.4M"
fmt(1_200_000_000, { compact: true }) → "€1.10bn"
```

Compact thresholds: ≥1B → bn, ≥1M → M, ≥1K → K.  
JPY: no decimal places ever; compact uses "M" = millions of yen.

### Persistence

`localStorage` key `aeroinsights:currency`. Falls back to `"EUR"`.

### Currency selector in Header

Compact button between `AgentButton` and the bell icon. Shows current code + chevron (e.g. `EUR ▾`). On click, opens a small 9-item dropdown (same card style as the user menu). Selecting an item closes the dropdown and updates context.

### Rollout scope (pages to update)

Apply `fmt()` to the main visible monetary figures only — not every percentage or ratio:

- `ECLDrilldownPanel.tsx` — EAD amounts, ECL amounts
- `StageMigrationTab.tsx` — roll-forward $ figures in comments/display
- `PerformanceVsPlan.tsx` — rent and exposure totals
- `Scenarios.tsx` — ECL output numbers
- `portfolioSummary.ts` — keep USD (agent system prompt, not user-facing)
- `exportService.ts` — pass currency into all generators
- `Reports.tsx` (report sizes are file sizes, not money — leave)
- `AlertRulesConfig.tsx` — the `maxEclUsd` label changes to `maxEcl` + currency code

**Not in scope for this sprint:** every intermediate calculation value, every hardcoded row in mock data arrays (those stay as USD numbers; `fmt()` is called at render time).

---

## Feature 3: Real Export Downloads

### Current state

`exportService.ts` already has `generatePDF()` and `generateXLSX()` used by Dashboard's `ExportSnapshotModal`. They work. The Reports page has six template cards with Generate buttons that fake a 2-second delay and do nothing.

### What changes

**`exportService.ts`** — add six named generators, one per report template, each accepting `currency: CurrencyCode`:

```typescript
export function generateReportPDF(reportId: string, currency: CurrencyCode): void
export function generateReportXLSX(reportId: string, currency: CurrencyCode): void
export function generateReportDOCX(reportId: string, currency: CurrencyCode): Promise<void>
```

Each generator uses the existing mock data already in the file, formats monetary values with the supplied currency, and triggers a browser download via `URL.createObjectURL` + `<a>.click()`.

**`ReportFormatModal.tsx`** (`src/app/components/reports/`) — new small modal shown when Generate is clicked. Three format cards: PDF, Excel (.xlsx), Word (.docx). Shows the current currency. A single "Download" button triggers the right generator. Closes on download or Cancel.

**`Reports.tsx`** — the Generate button now opens `ReportFormatModal` instead of the fake timeout.

### Format capabilities per report

| Report | PDF | XLSX | DOCX |
|--------|-----|------|------|
| Auditor Evidence Pack | Table: ECL rows + inputs | Sheet: full ECL data | Doc: heading + ECL table |
| Board Pack | Summary table + scenario table | Sheet: KPIs + scenarios | Doc: heading + KPIs + scenarios |
| Portfolio Register | Lease register table | Sheet: full lease register | Doc: heading + lease register |
| ECL Disclosure Pack | Stage migration table | Sheet: ECL trend + stage matrix | Doc: heading + stage matrix |
| Watchlist Report | Lessee watchlist table | Sheet: lessee watchlist | Doc: heading + lessee table |
| Jurisdiction Risk | Jurisdiction table | Sheet: jurisdiction data | Doc: heading + jurisdiction table |

### DOCX approach

Install `docx` (MIT, zero runtime dependencies, pure client-side). Use `Packer.toBlob()` → `URL.createObjectURL()` → trigger download. Structure: `Document` → `Section` → `Paragraph` (heading) + `Table`. No images, no complex layout — clean, importable, editable.

### Currency in exports

Each generator receives `currency` and calls an internal `fmtExport(usd, currency)` — same logic as `fmt()` but always returns a plain string with symbol, no React nodes.

---

## Feature 4: Word (.docx) Export

Covered entirely under Feature 3 — DOCX is one of the three format options in `ReportFormatModal`. No separate UI needed.

**Package:** `docx` v8+ (npm install docx). Already confirmed MIT license.

---

## Architecture Summary

```
CurrencyContext (new)
  └─ provides: currency, setCurrency, fmt()
  └─ consumed by: Header (selector), ECLDrilldownPanel,
                  PerformanceVsPlan, Scenarios, exportService

Header (modified)
  └─ CurrencySelector (new inline component)

Reports.tsx (modified)
  └─ ReportFormatModal (new)
       └─ exportService.generateReportPDF / XLSX / DOCX

exportService.ts (extended)
  └─ generateReportPDF(id, currency)
  └─ generateReportXLSX(id, currency)
  └─ generateReportDOCX(id, currency) — requires docx package
```

---

## Out of Scope

- Live FX rates (API integration)
- Google Docs OAuth export
- Applying `fmt()` to every number in every mock data array (render-time conversion is sufficient)
- Report scheduling or email delivery of real files
