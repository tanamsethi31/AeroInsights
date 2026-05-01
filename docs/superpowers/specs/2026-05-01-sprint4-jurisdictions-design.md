# Sprint 4 — F04: Repossession & Recovery Model Design

**Date:** 2026-05-01  
**Status:** Approved  
**Scope:** Expand Jurisdictions page to 30 countries with two-panel layout, detail panel, scenario toggle, precedent database, and AWG alerts

---

## 1. Architecture

### File changes

| File | Change |
|------|--------|
| `src/app/pages/Jurisdictions.tsx` | **Refactored** — layout + tab orchestration only (~150 lines) |
| `src/app/components/jurisdictions/jurisdictionData.ts` | **New** — all 30 jurisdiction records + ~90 precedents |
| `src/app/components/jurisdictions/JurisdictionDetail.tsx` | **New** — right-panel detail component |

The existing 8 jurisdictions and 6 precedents are absorbed into the new data file and enriched. No other files change.

---

## 2. Data Model

### Jurisdiction

```ts
interface Jurisdiction {
  code: string;                // ISO 3166-1 alpha-2
  country: string;
  flag: string;                // emoji flag
  region: string;              // "North America" | "Europe" | "Asia-Pacific" | "Middle East" | "Latin America" | "Africa"
  ctcParty: boolean;
  ctcScore: number;            // 0–100
  altA: boolean;
  idera: boolean;
  enforceability: number;      // 0–100
  ruleOfLaw: number;           // 0–100
  sanctions: string;           // "None" | "Full OFAC/EU/UK" | "Partial OFAC" etc.
  repossP50: number;           // months; 999 = effectively unrecoverable
  repossP90: number;
  repossP50Cost: string;       // % of asset value
  repossP90Cost: string;
  successProb: string;         // e.g. "96%" or "<5%"
  precedentCount: number;
  narrative: string;           // 2–4 sentence analyst note
  uncertaintyBand: "low" | "medium" | "high" | "extreme";
  lastUpdated: string;         // "YYYY-MM-DD"
  awgAlert?: string;           // if set, displayed as amber banner in detail panel
}
```

### Precedent

```ts
interface Precedent {
  id: string;                  // e.g. "PREC-001"
  year: number;
  lessor: string;
  airline: string;
  country: string;             // ISO code — used for filtering
  aircraft: number;
  timeline: string;            // e.g. "11 months" or "Ongoing"
  outcome: "Returned" | "Partially Returned" | "Detained" | "Returned via RJ" | "Settled";
  source: string;              // "public" | "AWG" | "internal"
}
```

### 30 Jurisdictions

Existing 8 enriched + 22 new:

| New jurisdictions |
|---|
| Germany (DE), France (FR), Singapore (SG), Australia (AU), Canada (CA) |
| South Africa (ZA), Turkey (TR), Indonesia (ID), Japan (JP), China (CN) |
| South Korea (KR), Thailand (TH), Netherlands (NL), Spain (ES), Italy (IT) |
| Kenya (KE), Nigeria (NG), Ethiopia (ET), Chile (CL), Colombia (CO) |
| Egypt (EG), Kazakhstan (KZ) |

**6 priority jurisdictions** (Russia, Iran, Venezuela, Lebanon, Pakistan, Argentina) get `uncertaintyBand: "extreme"` and extended narratives covering government interference, sanctions exposure, and lessor loss history.

**~90 precedents** — 3–5 per major jurisdiction (US, IE, IN, MX, BR, AE, DE, FR, SG, AU + priority 6). Remaining jurisdictions get 1–2 each.

---

## 3. Layout

### Profiles Tab — Two-panel layout

**Left panel (300px fixed, scrollable)**
- Search input at top: filters country list by name
- Country rows: `[flag] [country name] [CTC badge] [score]`
  - CTC badge: green "CTC Party" | amber "Non-CTC" | red "Sanctioned"
  - Selected row: Oxford Blue left-border accent (same pattern as IAS36Tab)
- 30 rows total

**Right panel (flex 1)**
Rendered by `<JurisdictionDetail jurisdiction={selected} />`:

1. **Header** — flag, country name, region chip, "Last updated: YYYY-MM-DD"
2. **AWG Alert banner** (amber strip, only if `awgAlert` is set) — "⚠ AWG Update: [awgAlert text]"
3. **Score row** — CTC Score / Enforceability / Rule of Law as large coloured numbers (green ≥80, amber ≥50, red <50)
4. **Badge row** — CTC Party, Alt-A, IDERA chips (shown/hidden per flag); Sanctions chip in red if applicable
5. **Uncertainty band badge** — Low (grey) / Medium (amber) / High (orange) / Extreme (red)
6. **Repossession timeline section**:
   - Horizontal range bar: left anchor = P50 months, right anchor = P90 months, rendered as a pill/track with labels
   - "Stress scenario" toggle (checkbox): when on, multiplies P50 × 1.4 and P90 × 1.6, bar re-renders in red tint
   - Cost row below bar: "P50 cost: X% · P90 cost: Y% of asset value"
   - Success probability: large number
   - For `repossP50 === 999`: replace bar with red "Unrecoverable — sanctions/detention active" message
7. **Narrative block** — grey background card with analyst note text
8. **Precedents section** — table filtered to `country === selected.code`:
   - Columns: Year | Lessor | Airline | Aircraft | Timeline | Outcome
   - Max 5 rows shown; "Show all N precedents" toggle if more
   - Empty state: "No public precedents recorded for this jurisdiction"

### Repossession Model Tab

Unchanged layout (bar chart left, cost table right). Data now covers all 30 jurisdictions; chart filters out `repossP50 >= 100`.

### Precedent Database Tab

Same table as before, now ~90 rows. Country filter dropdown added at the top-right: "All countries" default, options = unique country names from precedents array.

---

## 4. Stress Scenario Toggle

The toggle is local state in `JurisdictionDetail.tsx`:

```ts
const [stressMode, setStressMode] = useState(false);
const displayP50 = stressMode ? Math.round(j.repossP50 * 1.4) : j.repossP50;
const displayP90 = stressMode ? Math.round(j.repossP90 * 1.6) : j.repossP90;
```

Range bar fills proportionally: `width = (displayP50 / displayP90) * 100%` for P50 marker. Bar track max is set to `displayP90`. Stress mode colours the bar `#DC2626` instead of `#002147`.

---

## 5. AWG Alert Banner

Simulated — the `awgAlert` field on select jurisdictions carries a pre-written string, e.g.:

- India: `"CTC score revised from 48 → 52 on 2026-03-15 following CTC Act 2025 parliamentary reading"`
- Pakistan: `"AWG watchlist: repossession risk elevated following airline liquidity event — 2026-04-02"`

Banner renders only when `awgAlert` is defined. Amber background `#FEF3C7`, border `#F59E0B`, icon `⚠`.

---

## 6. Styling Conventions

- Follows existing inline `style={{}}` + Tailwind utility class pattern
- Left-panel + right-panel flex layout matches Counterparties.tsx exactly
- `<Card>` component used for narrative block and precedents section
- Colour palette: `#002147` Oxford Blue, `#DC2626` red, `#B45309` amber, `#15803D` green, `#475569` muted

---

## 7. Out of Scope (this sprint)

- Real AWG API integration (alerts are static strings)
- Editing or overriding jurisdiction scores
- Export of jurisdiction data
- Map visualisation of jurisdiction risk
