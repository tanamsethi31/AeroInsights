# Sprint 7 — F12: Portfolio Aggregator & Concentration Monitor Design

**Date:** 2026-05-01
**Status:** Approved
**Scope:** Replace Portfolio → Concentration tab with a richer concentration monitor: aggregate KPI strip, 6 dimension sub-tabs (each with bar chart + ranked table + user-editable threshold), and a lessee × country ECL-density heatmap.

---

## 1. Architecture

### File changes

| File | Change |
|------|--------|
| `src/app/components/portfolio/ConcentrationTab.tsx` | **New** — all types, synthetic data for all 6 dimensions + heatmap matrix, KPI constants, computed helpers, and all UI (~600 lines) |
| `src/app/pages/Portfolio.tsx` | **Modify** — import `ConcentrationTab`, replace the existing Concentration tab block, remove the now-redundant `concentrationByLessee`, `concentrationByCountry`, and `PIE_COLORS` constants |

No separate data file. All synthetic data lives inside `ConcentrationTab.tsx`. Follows the same isolation pattern as `SDMRTab.tsx`, `IAS36Tab.tsx`, and `AircraftValuationPanel.tsx`.

---

## 2. Data Model

```ts
type DimKey = "Lessee" | "Country" | "Region" | "Type" | "Vintage" | "Currency";

interface ConcentrationRow {
  name: string;
  exposure: number;    // USD
  exposurePct: number; // % of total portfolio exposure
  ecl: number;         // USD
  eclPct: number;      // ecl / exposure (loss rate %)
}

interface HeatmapCell {
  lessee: string;
  country: string;
  exposure: number; // USD
  ecl: number;      // USD
}

type ThresholdMap = Record<DimKey, number>; // % limit per dimension
```

### Aggregate KPIs (hardcoded constants derived from synthetic dataset)

| KPI | Value |
|-----|-------|
| Total Book Value | $2.84B |
| Encumbered Value | $2.61B (91.9%) |
| Total ECL | $47.2M |
| ECL Rate | 2.12% |
| WA Lease Term | 5.8 yrs |
| WA Lessee Credit | BB+ |

### Threshold defaults

```ts
const DEFAULT_THRESHOLDS: ThresholdMap = {
  Lessee:   15,
  Country:  20,
  Region:   35,
  Type:     35,
  Vintage:  30,
  Currency: 25,
};
```

### Breach logic (applied to `exposurePct`)

- `exposurePct > threshold × 1.5` → **red** breach
- `exposurePct > threshold` → **amber** breach
- else → no badge

### Concentration datasets

**By Lessee** (10 rows, total exposure $2,222M)

| Name | Exposure $M | Exp % | ECL $M | ECL % |
|------|------------|-------|--------|-------|
| Emirates | 412 | 18.5 | 2.1 | 0.5 |
| Ryanair | 386 | 17.4 | 1.9 | 0.5 |
| Singapore Airlines | 290 | 13.1 | 1.2 | 0.4 |
| Air France | 278 | 12.5 | 2.2 | 0.8 |
| Lufthansa | 194 | 8.7 | 1.2 | 0.6 |
| IndiGo Airlines | 184 | 8.3 | 4.6 | 2.5 |
| Aeromexico | 122 | 5.5 | 2.2 | 1.8 |
| SriLankan Airlines | 118 | 5.3 | 11.8 | 10.0 |
| Azul Brazilian Airlines | 142 | 6.4 | 11.4 | 8.0 |
| Air Transat | 96 | 4.3 | 8.6 | 9.0 |

**By Country** (10 rows)

| Name | Exposure $M | Exp % | ECL $M |
|------|------------|-------|--------|
| UAE | 405 | 18.2 | 2.0 |
| Ireland | 320 | 14.4 | 1.6 |
| Germany | 264 | 11.9 | 1.5 |
| France | 274 | 12.3 | 2.2 |
| Singapore | 265 | 11.9 | 1.1 |
| India | 216 | 9.7 | 4.8 |
| Brazil | 142 | 6.4 | 11.4 |
| Mexico | 122 | 5.5 | 2.2 |
| Sri Lanka | 118 | 5.3 | 11.8 |
| Canada | 96 | 4.3 | 8.6 |

**By Region** (4 rows)

| Name | Exposure $M | Exp % | ECL $M |
|------|------------|-------|--------|
| Europe | 858 | 38.6 | 5.3 |
| APAC | 599 | 27.0 | 17.7 |
| Americas | 360 | 16.2 | 22.2 |
| MEA | 405 | 18.2 | 2.0 |

**By Aircraft Type** (6 rows)

| Name | Exposure $M | Exp % | ECL $M |
|------|------------|-------|--------|
| A350-900 | 568 | 25.6 | 3.4 |
| B737 Family | 508 | 22.9 | 4.1 |
| A320 Family | 422 | 19.0 | 24.6 |
| B777-300ER | 412 | 18.5 | 2.1 |
| A220-300 | 194 | 8.7 | 1.2 |
| A330-300 | 118 | 5.3 | 11.8 |

**By Vintage** (5 rows, 2-year buckets)

| Name | Exposure $M | Exp % | ECL $M |
|------|------------|-------|--------|
| 2021–22 | 1,134 | 51.0 | 16.6 |
| 2019–20 | 402 | 18.1 | 15.4 |
| 2023+ | 290 | 13.1 | 1.2 |
| 2017–18 | 278 | 12.5 | 2.2 |
| 2015–16 | 118 | 5.3 | 11.8 |

**By Currency** (4 rows)

| Name | Exposure $M | Exp % | ECL $M |
|------|------------|-------|--------|
| USD | 1,126 | 50.7 | 21.9 |
| EUR | 858 | 38.6 | 5.3 |
| BRL | 142 | 6.4 | 11.4 |
| CAD | 96 | 4.3 | 8.6 |

### Heatmap matrix (lessee × country, non-zero cells only)

| Lessee | Country | Exposure $M | ECL $M |
|--------|---------|------------|--------|
| Emirates | UAE | 380 | 1.9 |
| Emirates | India | 32 | 0.2 |
| Ryanair | Ireland | 320 | 1.6 |
| Ryanair | Germany | 66 | 0.3 |
| Singapore Airlines | Singapore | 265 | 1.1 |
| Singapore Airlines | UAE | 25 | 0.1 |
| Air France | France | 248 | 2.0 |
| Air France | Germany | 30 | 0.2 |
| Lufthansa | Germany | 168 | 1.0 |
| Lufthansa | France | 26 | 0.2 |
| Azul Brazilian Airlines | Brazil | 142 | 11.4 |
| Air Transat | Canada | 96 | 8.6 |
| SriLankan Airlines | Sri Lanka | 118 | 11.8 |
| IndiGo Airlines | India | 184 | 4.6 |
| Aeromexico | Mexico | 122 | 2.2 |

---

## 3. Computed Helpers

```ts
// Format USD millions for display
fmtM(n: number): string → "$X.XM" or "$XM" (no decimal if round)

// Format percentage
fmtPct(n: number): string → "X.X%"

// Determine breach level for a bar
breachLevel(exposurePct: number, threshold: number): "none" | "amber" | "red"
  → exposurePct > threshold * 1.5 → "red"
  → exposurePct > threshold → "amber"
  → "none"

// Bar fill colour based on breach level
barColour(level: "none" | "amber" | "red"): string
  → "none" → "#002147"
  → "amber" → "#B45309"
  → "red" → "#B91C1C"

// Heatmap cell colour from ECL rate (%)
heatColour(eclPct: number): string
  → 0%     → "#F0FDF4" (near-white green)
  → 0–2%   → "#BBF7D0"
  → 2–5%   → "#FEF3C7" (amber tint)
  → 5–10%  → "#FED7AA"
  → 10%+   → "#FECACA" (red tint)
  → empty  → "#F8FAFC"
```

---

## 4. UI Layout

### Top: KPI strip

Six `KpiCard` components in a responsive grid:
- Book Value · Encumbered Value · Total ECL · ECL Rate · WA Lease Term · WA Credit

### Middle: Sub-tab navigation

Pill-style tabs: `Lessee | Country | Region | Type | Vintage | Currency | Heatmap`

### Concentration sub-tabs (Lessee through Currency)

**Layout:** two-zone row — chart (60%) | threshold panel (40%)

**Left — Horizontal bar chart:**
- `BarChart` with `layout="vertical"`, `dataKey="exposurePct"`, bars coloured by breach level
- `ReferenceLine x={threshold}` shown as a dashed amber vertical line labelled "Policy limit"
- Tooltip: name, exposure $, exposure %, ECL $, ECL %

**Right — Threshold input + ranked table:**
- Small inline field: `Policy limit: [___%]` with a Save button that writes to `ThresholdMap`
- Table columns: Rank · Name · Exposure · % · ECL · ECL % · (breach badge in % column if breaching)

Breach badge style: amber pill "▲ +X.Xpp" showing overage above threshold.

### Heatmap sub-tab

**Layout:** full-width grid, countries as columns, lessees as rows (10 × 10)

- Column headers: country names, right-aligned
- Row headers: lessee names (abbreviated if needed)
- Each cell: background = `heatColour(eclPct)`, text = exposure $M (grey if zero/empty)
- Empty cells (no exposure): `#F8FAFC`, no text
- Legend strip below grid: gradient from green → amber → red with labels 0% / 2% / 5% / 10%+
- No interactivity required at MVP

---

## 5. State

```ts
// Inside ConcentrationTab component
const [activeSubTab, setActiveSubTab] = useState<DimKey | "Heatmap">("Lessee");
const [thresholds, setThresholds] = useState<ThresholdMap>(DEFAULT_THRESHOLDS);
const [draftThreshold, setDraftThreshold] = useState<string>("");

// draftThreshold: local input string for the currently visible tab's threshold
// On "Save": parse float, clamp 1–100, update thresholds[activeSubTab]
// Reset draftThreshold to "" when sub-tab changes
```

---

## 6. Styling Conventions

- Inline `style={{}}` throughout — no CSS modules
- Colour palette: `#002147` Oxford Blue, `#B45309` amber breach, `#B91C1C` red breach, `#15803D` green, `#64748B` grey
- Sub-tab pills: same pattern as existing Portfolio top-level tabs
- KPI strip: `display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`
- Heatmap grid: `display: grid; grid-template-columns: 160px repeat(10, 1fr)`
- Bar chart height scales with row count: `Math.max(200, rows * 40)` px

---

## 7. Out of Scope (this sprint)

- Export to PDF/CSV
- Time-series trend per dimension
- Interactive heatmap drill-down
- Custom dimension groupings
- Live data adapter (all synthetic)
