# Maintenance Forecast Visibility — Implementation Design

**Goal:** Surface MR adequacy data at portfolio level so that red/amber shortfalls are visible without drilling into individual aircraft rows.

**Architecture:** Extend the existing `portfolioAdapters.ts` data layer with two additions — MR fields on `LeaseTableRow` and a new `toMRHealthSummary()` aggregator — then build two new standalone presentational components (`MRHealthCard`, `MRRiskBanner`) and add one new column to the leases table in `Portfolio.tsx`. No new data fetching; all inputs come from the existing `MR_ADEQUACY` static dataset in `maintenanceHeuristics.ts`.

**Tech Stack:** React, TypeScript, inline styles, lucide-react, existing `KpiCard` component, existing `MRAdeqFlag` / `MRAdeqResult` types from `maintenanceHeuristics.ts`.

---

## Files

| Action | Path |
|--------|------|
| Modify | `src/app/lib/portfolioAdapters.ts` |
| Modify | `src/app/lib/portfolioAdapters.test.ts` |
| Create | `src/app/components/portfolio/MRHealthCard.tsx` |
| Create | `src/app/components/portfolio/MRRiskBanner.tsx` |
| Modify | `src/app/pages/Dashboard.tsx` |
| Modify | `src/app/pages/Portfolio.tsx` |

---

## Section 1 — Data Layer (`portfolioAdapters.ts`)

### 1a. Extend `LeaseTableRow`

Add three optional fields:

```typescript
export interface LeaseTableRow {
  id: string;
  lessee: string;
  aircraft: string;
  msn: string;
  start: string;
  end: string;
  rentUSD: string;
  stage: string;
  status: string;
  // MR adequacy — null when no MR_ADEQUACY entry exists for this lease id
  mrFlag: MRAdeqFlag | null;
  eolShortfall: number | null;      // in dollars (positive = shortfall)
  eolShortfallPct: number | null;   // shortfall as % of EOL redelivery cost
}
```

Update `toLeaseTableRows()` to populate them by looking up `MR_ADEQUACY[l.id]`:

```typescript
import { MR_ADEQUACY, type MRAdeqFlag } from "../data/maintenanceHeuristics";

// inside the .map():
const mrData = MR_ADEQUACY[l.id] ?? null;
return {
  // ...existing fields...
  mrFlag: mrData ? mrData.flag : null,
  eolShortfall: mrData ? mrData.eolShortfall : null,
  eolShortfallPct: mrData ? mrData.eolShortfallPct : null,
};
```

### 1b. New `MRHealthSummary` interface and `toMRHealthSummary()`

```typescript
export interface MRHealthSummary {
  redCount: number;
  amberCount: number;
  greenCount: number;
  worstOffenders: Array<{
    leaseId: string;
    lessee: string;
    msn: string;
    flag: MRAdeqFlag;
    eolShortfall: number;
    eolShortfallPct: number;
  }>;
}

export function toMRHealthSummary(leases: LeaseTableRow[]): MRHealthSummary {
  let redCount = 0;
  let amberCount = 0;
  let greenCount = 0;

  const atRisk: MRHealthSummary["worstOffenders"] = [];

  for (const l of leases) {
    if (l.mrFlag === "red")        { redCount++;   atRisk.push({ leaseId: l.id, lessee: l.lessee, msn: l.msn, flag: "red",   eolShortfall: l.eolShortfall!, eolShortfallPct: l.eolShortfallPct! }); }
    else if (l.mrFlag === "amber") { amberCount++; atRisk.push({ leaseId: l.id, lessee: l.lessee, msn: l.msn, flag: "amber", eolShortfall: l.eolShortfall!, eolShortfallPct: l.eolShortfallPct! }); }
    else if (l.mrFlag === "green") { greenCount++; }
  }

  // Sort: red before amber, then by eolShortfall descending. Cap at 3.
  atRisk.sort((a, b) => {
    if (a.flag !== b.flag) return a.flag === "red" ? -1 : 1;
    return b.eolShortfall - a.eolShortfall;
  });

  return { redCount, amberCount, greenCount, worstOffenders: atRisk.slice(0, 3) };
}
```

---

## Section 2 — `MRHealthCard` component

**File:** `src/app/components/portfolio/MRHealthCard.tsx`

**Props:**
```typescript
interface Props {
  summary: MRHealthSummary;
  staggerIndex?: number;
  onClick?: () => void;
}
```

**Layout:** Matches `KpiCard` visual conventions — white background, `borderTop: "3px solid #002147"`, `boxShadow: "0 1px 3px rgba(0,0,0,0.08)"`, `borderRadius: "var(--radius-lg)"`, `padding: "1.25rem 1.5rem"`. Uses `motion.div` with same entrance animation (`initial={{ opacity: 0, y: 8 }}`, `ease: [0.23, 1, 0.32, 1]`, `staggerIndex * 0.05` delay).

**Content (top to bottom):**

1. **Label row:** "MR ADEQUACY" in `fontSize: 0.75rem`, `fontWeight: 500`, `color: #94A3B8`, uppercase, `letterSpacing: 0.05em` — matching KpiCard label style. No ⓘ icon (tooltip is omitted for simplicity).

2. **Flag count row:**
   ```
   🔴 {redCount}   🟡 {amberCount}   🟢 {greenCount}
   ```
   Each count as a coloured dot + number in a flex row with `gap: 1rem`. Dot rendered as a `div` with `width: 8px; height: 8px; borderRadius: 50%; background: <colour>`. Colours: red `#B91C1C`, amber `#B45309`, green `#15803D`. Count text: `fontSize: 1.125rem; fontWeight: 600; color: #0F172A; fontVariantNumeric: tabular-nums`.

3. **Worst offenders list** (only when `worstOffenders.length > 0`): Up to 3 rows. Each row:
   - Lessee name (bold, `color: #0F172A`, `fontSize: 0.8125rem`) + `·` separator + MSN (monospace, `color: #475569`) + shortfall amount right-aligned in flag colour (`-$X.Xm`, where `X.X = (eolShortfall / 1_000_000).toFixed(1)`)
   - Row `display: flex; justifyContent: space-between; alignItems: center`

4. **All-clear state** (when `redCount === 0 && amberCount === 0`): Replace flag row and offenders list with: *"All leases on track"* in `color: #15803D; fontSize: 0.8125rem; fontWeight: 500`.

**Interaction:** When `onClick` provided, card lifts on hover (`translateY(-1px)`, shadow increase) and shows `ArrowUpRight` icon — identical to `KpiCard` hover behaviour. When no `onClick`, no hover effects.

---

## Section 3 — `MRRiskBanner` component

**File:** `src/app/components/portfolio/MRRiskBanner.tsx`

**Props:**
```typescript
interface Props {
  summary: MRHealthSummary;
}
```

**Render condition:** Returns `null` when `summary.redCount + summary.amberCount === 0`.

**Layout:**
```
[Icon]  [Headline text]  [Chips row]  [✕ dismiss button]
```

Single `div` row, `display: flex; alignItems: flex-start; gap: 0.75rem; padding: 0.875rem 1rem; borderRadius: 0.5rem; marginBottom: 1rem`.

**Severity colours:**
- Any red lease → `border: 1px solid #B91C1C; background: rgba(185,28,28,0.04)`; icon = `AlertTriangle` size 16 in `#B91C1C`
- Amber-only → `border: 1px solid #B45309; background: rgba(180,83,9,0.04)`; icon = `AlertTriangle` size 16 in `#B45309`

**Headline text:** `"{N} lease{N !== 1 ? 's' : ''} have material maintenance reserve shortfall{N !== 1 ? 's' : ''}"` where N = `redCount + amberCount`. `fontSize: 0.875rem; fontWeight: 600; color: #0F172A`.

**Offender chips** (up to 3, from `summary.worstOffenders`):
```
[Lessee · MSN · -$X.Xm]
```
Each chip: `background: rgba(flag-colour, 0.08); color: flag-colour; borderRadius: 0.25rem; padding: 0.125rem 0.5rem; fontSize: 0.75rem; fontWeight: 500`.

**Dismiss button:** `useState<boolean>(false)` for `dismissed`. When `dismissed === true`, component returns `null`. Button: `✕` in `#94A3B8`, `marginLeft: auto`, no border, pointer cursor.

**Layout of icon + text + chips:**
```
flex-col gap-0.5:
  row: icon + headline
  row: chips (flex-wrap gap-0.5)
```

---

## Section 4 — Leases table EOL Shortfall column (`Portfolio.tsx`)

### 4a. Column header

Insert `{ label: "EOL Shortfall", key: "eolShortfall" }` into the column header array **after** `{ label: "Status", key: null }` (i.e., append as the last column). The `key` is sortable.

### 4b. Sort accessor

Add to the `leaseAccessors` map:
```typescript
eolShortfall: (l: LeaseTableRow) => l.eolShortfall ?? -Infinity,
```

### 4c. Table cell

Append a new `<td>` at the end of each lease row:

```tsx
<td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
  {lease.eolShortfall === null ? (
    <span style={{ color: "#CBD5E1" }}>—</span>
  ) : lease.eolShortfall <= 0 ? (
    <span style={{ color: "#15803D", fontWeight: 500 }}>✓</span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
      <span style={{ color: lease.mrFlag === "red" ? "#B91C1C" : "#B45309", fontWeight: 600 }}>
        -{`$${(lease.eolShortfall / 1_000_000).toFixed(1)}m`}
      </span>
      <span style={{
        background: lease.mrFlag === "red" ? "rgba(185,28,28,0.08)" : "rgba(180,83,9,0.08)",
        color: lease.mrFlag === "red" ? "#B91C1C" : "#B45309",
        borderRadius: "0.25rem",
        padding: "0.125rem 0.375rem",
        fontSize: "0.6875rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}>
        {lease.mrFlag}
      </span>
    </span>
  )}
</td>
```

### 4d. MRRiskBanner placement

Import `MRRiskBanner` and `toMRHealthSummary`. Add `mrSummary` derived value:
```typescript
const mrSummary = toMRHealthSummary(leases);
```

Place `<MRRiskBanner summary={mrSummary} />` immediately above the Leases tab `<Card>` (inside the `activeTab === "Leases"` block, before the card).

---

## Section 5 — Dashboard integration (`Dashboard.tsx`)

Import `MRHealthCard` and `toMRHealthSummary`. The `leases` variable is already computed via `toLeaseTableRows` — use it to compute `mrSummary`:

```typescript
const mrSummary = toMRHealthSummary(leases);
```

Append `<MRHealthCard>` as the 5th card in the KPI strip `<div>`:
```tsx
<MRHealthCard
  summary={mrSummary}
  staggerIndex={4}
  onClick={() => navigate("/portfolio", { state: { tab: "Leases" } })}
/>
```

The `useNavigate` hook is already imported in `Dashboard.tsx`.

---

## Visual Style Summary

Follows existing conventions throughout:
- Section headers / labels: `fontSize: 0.75rem`, `fontWeight: 500`, `color: #94A3B8`, uppercase
- Red: `#B91C1C`, amber: `#B45309`, green: `#15803D`, navy accent: `#002147`
- Card border-top: `3px solid #002147`
- Chip pills: `borderRadius: 0.25rem`, `padding: 0.125rem 0.375rem`, `fontSize: 0.6875rem`

---

## Edge Cases

- `MR_ADEQUACY` has no entry for a lease id → `mrFlag: null`, `eolShortfall: null` → cell shows `—`, lease is ignored by `toMRHealthSummary`
- All leases have `mrFlag: null` (e.g. uploaded portfolio with no heuristic data) → `MRHealthSummary` has all counts 0, `worstOffenders: []` → `MRHealthCard` shows all-clear; `MRRiskBanner` renders nothing
- `eolShortfall <= 0` (surplus) → green ✓ in table; lease counted in `greenCount` not in offenders
- Single red lease → banner shows `1 lease has material maintenance reserve shortfall`, one chip

---

## Testing

No new test file for components (presentational, no hooks). Add tests for new pure functions in `portfolioAdapters.test.ts`:

- `toMRHealthSummary` with mixed flags → correct redCount/amberCount/greenCount
- `worstOffenders` sorted red-before-amber, then by eolShortfall desc
- `worstOffenders` capped at 3 even when 4+ at-risk leases
- `toLeaseTableRows` populates `mrFlag`/`eolShortfall` from `MR_ADEQUACY` when entry exists
- `toLeaseTableRows` sets fields to `null` when no `MR_ADEQUACY` entry
