# Sprint 9 F15 — Stage Migration Matrix Enrichment Design

## Goal

Extract the inline `MigrationTab` from `RiskECL.tsx` into a self-contained `StageMigrationTab.tsx` component and enrich it with two statutory IFRS 7 disclosure tables (§35H ECL Roll-Forward Reconciliation and §35I Credit Quality Distribution by Grade) required for audit sign-off.

---

## Background

The Risk & ECL page (`RiskECL.tsx`) currently contains six tabs rendered entirely inline. The IAS 36 tab was already extracted to `src/app/components/risk-ecl/IAS36Tab.tsx` in a prior sprint. The Stage Migration tab (~275 lines inline, including data) needs the same treatment plus two new statutory tables that are currently absent from the application.

**Target audience:** Aviation finance analysts and portfolio managers who need to evidence IFRS 9 ECL staging decisions to auditors and regulators. The §35H and §35I disclosures are non-optional under IFRS 7 — their absence is an audit finding.

---

## Architecture

### Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/components/risk-ecl/StageMigrationTab.tsx` | Self-contained component: all types, data, helpers, and five sub-sections |
| Modify | `src/app/pages/RiskECL.tsx` | Remove ~275-line inline `MigrationTab` block + data constants; add import + `<StageMigrationTab />` |

No other files touched. Pattern mirrors `IAS36Tab.tsx` (721 lines, zero props, named export).

---

## Component Design: `StageMigrationTab.tsx`

### Section order (top to bottom)

1. **Migration Matrix** — 5×5 heat-map grid (migrated verbatim from `RiskECL.tsx`)
2. **§35H ECL Roll-Forward Reconciliation** — NEW statutory table
3. **§35I Credit Quality Distribution** — NEW statutory table
4. **Stage Deterioration Events** — scrollable event log (migrated verbatim)
5. **Stage Cure Events** — scrollable event log (migrated verbatim)

The two new tables sit between the matrix and the event logs because they answer the natural follow-up question after seeing migrations: "How did ECL balances change as a result?"

---

### Section 1 — Migration Matrix (migrated)

Verbatim copy of the existing inline block:
- `migrationMatrix` data (4 rows × 4 columns + row totals)
- 3 summary tiles: Net Migrations +5, Total Migrations 14, Average PD Drift +1.8%
- 5×5 heat-map grid with diagonal cells styled grey, off-diagonal tinted by magnitude

No changes to data or styling.

---

### Section 2 — §35H ECL Roll-Forward Reconciliation (NEW)

**Purpose:** Discloses how the ECL allowance moved during the period, broken down by IFRS 9 stage. Required by IFRS 7 §35H(b).

**Types:**
```ts
type RollForwardRow = {
  label: string;
  s1: number | null;   // $M
  s2: number | null;
  s3: number | null;
  total: number | null;
  isBold?: boolean;    // opening / closing rows
  isBlue?: boolean;    // opening / closing rows get blue-tinted bg
};
```

**Data (cross-checked to KPI card totals — closing balance = $47.2M ✓):**

| Label | S1 | S2 | S3 | Total |
|-------|----|----|----|----|
| Opening ECL balance | 8.10 | 20.40 | 16.30 | 44.80 |
| New originations (Stage 1) | +1.20 | — | — | +1.20 |
| SICR transfers to Stage 2 | −0.85 | +2.10 | — | +1.25 |
| SICR transfers to Stage 3 | — | −1.40 | +2.80 | +1.40 |
| Write-offs | — | — | −2.10 | −2.10 |
| Repayments / derecognition | −0.45 | −0.85 | −0.40 | −1.70 |
| FX and unwinding | +0.40 | +1.35 | +0.60 | +2.35 |
| Closing ECL balance | 8.40 | 21.60 | 17.20 | 47.20 |

**Rendering:**
- Opening and closing rows: bold font, `#EFF6FF` blue-tinted background
- Positive movement values: rendered with `+` prefix in green `#15803D`
- Negative movement values: rendered in red `#B91C1C`
- `null` cells rendered as `—`
- Column headers: S1 | S2 | S3 | Total with stage-colour coded dot indicators

---

### Section 3 — §35I Credit Quality Distribution (NEW)

**Purpose:** Discloses gross carrying amount (EAD) by credit risk rating grade cross-tabulated against IFRS 9 stage. Required by IFRS 7 §35I.

**Types:**
```ts
type CreditGradeRow = {
  grade: string;         // e.g. "A / A-"
  riskZone: "low" | "watch" | "danger";
  s1Ead: number;         // $M
  s2Ead: number;
  s3Ead: number;
  totalEad: number;
  portfolioPct: number;  // percentage of grand total EAD
};
```

**Data (cross-checked: S1 total $771.0M, S2 $118.0M, S3 $24.2M, Portfolio $913.2M ✓):**

| Grade | Zone | S1 | S2 | S3 | Total | % |
|-------|------|----|----|-----|-------|---|
| A / A- | low | 412.0 | 0.0 | 0.0 | 412.0 | 45.1% |
| BBB | low | 185.0 | 12.0 | 0.0 | 197.0 | 21.6% |
| BB / BB- | watch | 142.0 | 48.0 | 0.0 | 190.0 | 20.8% |
| B+ | watch | 32.0 | 58.0 | 0.0 | 90.0 | 9.9% |
| B / B- | danger | 0.0 | 0.0 | 6.6 | 6.6 | 0.7% |
| CCC and below | danger | 0.0 | 0.0 | 17.6 | 17.6 | 1.9% |
| **Total** | — | **771.0** | **118.0** | **24.2** | **913.2** | **100%** |

**Rendering:**
- `low` zone rows: white background
- `watch` zone rows: `rgba(180,83,9,0.06)` amber-tinted background
- `danger` zone rows: `rgba(185,28,28,0.06)` red-tinted background
- Total row: bold, `#F8FAFC` grey background
- Column headers include stage labels with colour-coded dots
- Percentage column shows a thin progress bar within the cell

---

### Sections 4 & 5 — Stage Deterioration / Cure Events (migrated)

Verbatim copy of the existing inline blocks:
- `migrationEvents` data (6 deterioration events)
- `migrationCures` data (4 cure events)
- `MigrationEventRow` sub-component
- Side-by-side layout with section labels

No changes to data or styling.

---

## Data Integrity Constraints

All synthetic numbers are cross-checked against the existing KPI cards in `RiskECL.tsx`:

- **§35H closing balance:** S1 $8.40M + S2 $21.60M + S3 $17.20M = **$47.20M** ✓ (matches "Total ECL" KPI)
- **§35I S1 EAD total:** $412.0M + $185.0M + $142.0M + $32.0M = **$771.0M** ✓ (matches S1 coverage calc)
- **§35I S2 EAD total:** $12.0M + $48.0M + $58.0M = **$118.0M** ✓ (matches S2 coverage calc)
- **§35I S3 EAD total:** $6.6M + $17.6M = **$24.2M** ✓ (matches S3 coverage calc)
- **§35I portfolio EAD:** $913.2M ✓

---

## Styling Conventions

Follows project-wide conventions (same as `IAS36Tab.tsx`, `ConcentrationTab.tsx`):
- Inline `style={{}}` only — no CSS modules, no Tailwind
- Oxford Blue `#002147` section headers
- `#E2E8F0` table borders, `#F8FAFC` alternating rows
- `fontSize: "0.8125rem"` table body, `fontSize: "0.75rem"` secondary text
- Card containers: `background: "#FFFFFF"`, `border: "1px solid #E2E8F0"`, `borderRadius: "0.5rem"`
- Risk colours: Green `#15803D`, Amber `#B45309`, Red `#B91C1C`

---

## Out of Scope

- No chart visualisations for §35H or §35I (tables only — data density > chart value here)
- No filter controls on the migration matrix (existing behaviour preserved)
- No other RiskECL tabs modified

---

## Success Criteria

1. `npm run build` completes with zero TypeScript errors
2. Stage Migration tab renders identically to before for existing content
3. §35H table shows 8 rows with correct opening/closing bolding and +/− colour coding
4. §35I table shows 7 rows (6 grades + total) with amber/red zone tinting
5. §35I portfolio total reconciles to exactly $913.2M
6. §35H closing balance reconciles to exactly $47.20M
7. `RiskECL.tsx` shrinks by ~275 lines
