# MR Portfolio Grid — Implementation Design

**Goal:** Replace the buried per-aircraft toggle approach with a portfolio-level MR adequacy grid at the top of the SD / MR tab. Shows all aircraft at a glance with base and distressed EOL shortfalls side by side, expandable to per-component detail. Dashboard `MRHealthCard` links directly to this view.

**Architecture:** New standalone `MRPortfolioGrid.tsx` component placed at top of `SDMRTab` render. Receives `sdmrData: LeaseSDMR[]` as props, calls the already-exported `buildProjections()` for each lease, derives component-level flags inline. `LEASE_CONTEXT` exported from `MaintenanceForecastTab.tsx` to provide `leaseEnd` fallback for static demo data. One-liner change in `Dashboard.tsx` redirects `MRHealthCard` click to `"SD / MR"` tab.

**Tech Stack:** React, TypeScript, inline styles, framer-motion (`motion.div` for expand animation), lucide-react (`ChevronRight`), existing `mrFlagColor` / `mrFlagBg` helpers from `maintenanceHeuristics.ts`.

---

## Files

| Action | Path |
|--------|------|
| Modify | `src/app/components/portfolio/MaintenanceForecastTab.tsx` |
| Create | `src/app/components/portfolio/MRPortfolioGrid.tsx` |
| Modify | `src/app/pages/Portfolio.tsx` |
| Modify | `src/app/pages/Dashboard.tsx` |

No test file additions — `MRPortfolioGrid` is purely presentational (no new pure functions). `buildProjections` already has coverage via the existing tab.

---

## Section 1 — Exports from `MaintenanceForecastTab.tsx`

Add two exports:

**1a. Export `LEASE_CONTEXT`** — change `const` to `export const`:

```typescript
// before
const LEASE_CONTEXT: Record<string, { leaseId: string; leaseEnd: string; stage: string }> = { ... };

// after
export const LEASE_CONTEXT: Record<string, { leaseId: string; leaseEnd: string; stage: string }> = { ... };
```

**1b. Export `ComponentProjection` interface** — add `export` keyword:

```typescript
// before
interface ComponentProjection { ... }

// after
export interface ComponentProjection { ... }
```

`LEASE_CONTEXT` is keyed by MSN. `MRPortfolioGrid` needs lookup by `leaseId`, so it builds a reverse map at module level:

```typescript
// inside MRPortfolioGrid.tsx (top-level, outside component)
const CONTEXT_BY_LEASE_ID: Record<string, { msn: string; leaseEnd: string }> = Object.fromEntries(
  Object.entries(LEASE_CONTEXT).map(([msn, ctx]) => [ctx.leaseId, { msn, leaseEnd: ctx.leaseEnd }])
);
```

---

## Section 2 — `MRPortfolioGrid` component

**File:** `src/app/components/portfolio/MRPortfolioGrid.tsx`

### 2a. Props

```typescript
interface Props {
  sdmrData: LeaseSDMR[];
}
```

### 2b. Per-aircraft data derivation

Define these helpers at module level (top of file, outside the component):

```typescript
// Defined locally — same logic as parseDateLocal in MaintenanceForecastTab.tsx (not imported, not exported from there)
function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function componentFlag(p: ComponentProjection): MRAdeqFlag {
  if (p.eolShortfall > 0)           return "red";
  if (p.distressedEOLShortfall > 0) return "amber";
  return "green";
}
```

Inside component, `useMemo` over `sdmrData`. Each row includes `msn` for display:

```typescript
const rows = useMemo(() => {
  return sdmrData.map((lease) => {
    const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
    const leaseEndDate = lease.leaseEnd
      ? parseDateLocal(lease.leaseEnd)
      : ctx
        ? parseDateLocal(ctx.leaseEnd)
        : new Date(2028, 0, 1); // last-resort fallback

    const projections = buildProjections(lease, lease.aircraft, leaseEndDate);

    const baseEOLShortfall       = projections.reduce((s, p) => s + Math.max(0, p.eolShortfall), 0);
    const distressedEOLShortfall = projections.reduce((s, p) => s + Math.max(0, p.distressedEOLShortfall), 0);
    const overallFlag: MRAdeqFlag =
      projections.some(p => p.eolShortfall > 0)            ? "red"   :
      projections.some(p => p.distressedEOLShortfall > 0)  ? "amber" : "green";
    const msn = ctx?.msn ?? null; // included so summary row template can render it without re-lookup

    return { lease, projections, baseEOLShortfall, distressedEOLShortfall, overallFlag, msn };
  }).sort((a, b) => b.distressedEOLShortfall - a.distressedEOLShortfall);
}, [sdmrData]);
```

Note: `overallFlag` derived from projections ensures consistency with actual computed data; `MR_ADEQUACY` static flag is not used here because `buildProjections()` is the authoritative source in this view.

### 2c. Expand state

```typescript
const [expanded, setExpanded] = useState<Set<string>>(new Set());

function toggle(leaseId: string) {
  setExpanded(prev => {
    const next = new Set(prev);
    next.has(leaseId) ? next.delete(leaseId) : next.add(leaseId);
    return next;
  });
}
```

### 2d. Counts (for header chips)

```typescript
const redCount   = rows.filter(r => r.overallFlag === "red").length;
const amberCount = rows.filter(r => r.overallFlag === "amber").length;
const greenCount = rows.filter(r => r.overallFlag === "green").length;
```

### 2e. Layout

**Header row:**
```tsx
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
  <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
    Portfolio MR Overview
  </span>
  {/* Count chips */}
  <div style={{ display: "flex", gap: "0.75rem" }}>
    {[["red", "#B91C1C", redCount], ["amber", "#B45309", amberCount], ["green", "#15803D", greenCount]].map(([, color, count]) => (
      <div key={color as string} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color as string }} />
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
          {count as number}
        </span>
      </div>
    ))}
  </div>
</div>
```

**All-clear state** (when `redCount === 0 && amberCount === 0`):
```tsx
<div style={{ color: "#15803D", fontSize: "0.8125rem", fontWeight: 500, padding: "0.75rem 0" }}>
  All aircraft MR adequacy on track
</div>
```

**Table** (rendered when at least one row is amber or red, or always — designer choice: always show the table for visibility):

Column structure (header row):
```
[expand icon col] | Aircraft / MSN | Lessee | Flag | Base EOL Shortfall | Distressed EOL Shortfall
```

Column widths: expand icon `2rem` | Aircraft `11rem` | Lessee `9rem` | Flag `4rem` | Base EOL `9rem` | Distressed EOL `11rem`.

Header cell style: `fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em"`.

**Summary row per aircraft:**

```tsx
<tr
  key={row.lease.leaseId}
  onClick={() => toggle(row.lease.leaseId)}
  style={{ cursor: "pointer", borderBottom: "1px solid #F1F5F9" }}
  onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
  onMouseLeave={e => (e.currentTarget.style.background = "")}
>
  {/* Expand chevron */}
  <td style={{ padding: "0.75rem 0.5rem", width: "2rem" }}>
    <ChevronRight
      size={14}
      style={{
        color: "#CBD5E1",
        transform: expanded.has(row.lease.leaseId) ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 160ms ease",
      }}
    />
  </td>
  {/* Aircraft / MSN */}
  <td style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", fontWeight: 500, color: "#0F172A" }}>
    {row.lease.aircraft}
    {row.msn && (
      <span style={{ marginLeft: "0.375rem", fontSize: "0.75rem", color: "#94A3B8", fontFamily: "monospace" }}>
        · {row.msn}
      </span>
    )}
  </td>
  {/* Lessee */}
  <td style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "#475569" }}>
    {row.lease.lessee}
  </td>
  {/* Overall flag */}
  <td style={{ padding: "0.75rem 1rem" }}>
    <div style={{ width: 10, height: 10, borderRadius: "50%", background: mrFlagColor(row.overallFlag) }} />
  </td>
  {/* Base EOL shortfall */}
  <td style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
    {row.baseEOLShortfall <= 0
      ? <span style={{ color: "#15803D", fontWeight: 500 }}>✓</span>
      : <span style={{ color: row.overallFlag === "red" ? "#B91C1C" : "#B45309", fontWeight: 600 }}>
          -{`$${(row.baseEOLShortfall / 1_000_000).toFixed(1)}m`}
        </span>
    }
  </td>
  {/* Distressed EOL shortfall */}
  <td style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
    {row.distressedEOLShortfall <= 0
      ? <span style={{ color: "#15803D", fontWeight: 500 }}>✓</span>
      : <span style={{ color: row.distressedEOLShortfall > row.baseEOLShortfall ? "#B91C1C" : "#B45309", fontWeight: 600 }}>
          -{`$${(row.distressedEOLShortfall / 1_000_000).toFixed(1)}m`}
        </span>
    }
  </td>
</tr>
```

**Expanded component sub-rows** (rendered immediately after summary row when `expanded.has(leaseId)`):

Wrapped in `<AnimatePresence>` + `motion.tr` for smooth height:

```tsx
{expanded.has(row.lease.leaseId) && row.projections.map((p) => {
  const flag = componentFlag(p);
  const flagColor = mrFlagColor(flag);
  const flagBg    = mrFlagBg(flag);
  return (
    <tr key={p.component} style={{ background: flagBg, borderBottom: "1px solid #F1F5F9" }}>
      <td /> {/* expand icon placeholder */}
      <td style={{ padding: "0.5rem 1rem", fontSize: "0.75rem", color: "#475569", paddingLeft: "2.5rem" }}>
        {p.component}
      </td>
      <td style={{ padding: "0.5rem 1rem", fontSize: "0.75rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
        ${(p.currentBalance / 1_000_000).toFixed(2)}m
      </td>
      <td style={{ padding: "0.5rem 1rem" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: flagColor }} />
      </td>
      {/* Base EOL */}
      <td style={{ padding: "0.5rem 1rem", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
        {p.eolShortfall <= 0
          ? <span style={{ color: "#15803D" }}>✓</span>
          : <span style={{ color: "#B91C1C" }}>-${(p.eolShortfall / 1_000_000).toFixed(2)}m</span>
        }
      </td>
      {/* Distressed EOL */}
      <td style={{ padding: "0.5rem 1rem", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
        {p.distressedEOLShortfall <= 0
          ? <span style={{ color: "#15803D" }}>✓</span>
          : <span style={{ color: "#B91C1C" }}>-${(p.distressedEOLShortfall / 1_000_000).toFixed(2)}m</span>
        }
      </td>
    </tr>
  );
})}
```

**Sub-row column headers** (shown above component rows when first aircraft expands — simplest approach: add a sub-header directly in the expanded region):

Add a sub-header row as first child of the expanded block:
```
[indent] Component | Balance | [flag] | Base EOL | Distressed EOL
```
Style: `fontSize: "0.625rem"`, `color: "#94A3B8"`, `textTransform: "uppercase"`, `background: "#F8FAFC"`.

### 2f. Outer card wrapper

Wrap everything in a `<Card>` with `style={{ marginBottom: "1.5rem" }}` and internal `padding: "1.25rem 1.5rem"`.

---

## Section 3 — `Portfolio.tsx` integration

`sdmrData` is already computed in `Portfolio.tsx` (via `buildLiveSDMRData` or static fallback). Import and render `MRPortfolioGrid` at the top of the `"SD / MR"` tab block, before `<SDMRTab>`:

```tsx
import { MRPortfolioGrid } from "../components/portfolio/MRPortfolioGrid";

// Inside activeTab === "SD / MR" render block, before <SDMRTab ...>:
<MRPortfolioGrid sdmrData={sdmrData} />
```

No new data computation needed — `sdmrData` is already in scope.

---

## Section 4 — `Dashboard.tsx` link change

Change the `MRHealthCard` navigation target from `"Leases"` to `"SD / MR"`:

```typescript
// before
onClick={() => navigate("/portfolio", { state: { tab: "Leases" } })}

// after
onClick={() => navigate("/portfolio", { state: { tab: "SD / MR" } })}
```

This uses the existing `locationState?.tab` deep-link mechanism already wired in `Portfolio.tsx`.

---

## Visual Style Summary

Follows existing SD/MR tab conventions:
- Section label: `fontSize: 0.75rem`, `fontWeight: 500`, `color: #94A3B8`, uppercase
- Red: `#B91C1C`, amber: `#B45309`, green: `#15803D`
- `mrFlagColor()` / `mrFlagBg()` / `mrFlagBorder()` helpers from `maintenanceHeuristics.ts` used throughout
- Table row hover: `background: #F8FAFC`
- Component sub-rows: `background: mrFlagBg(componentFlag)` (very light tint)

---

## Edge Cases

- `lease.leaseEnd` absent and `CONTEXT_BY_LEASE_ID[lease.leaseId]` absent → `new Date(2028, 0, 1)` fallback (will show slightly off projections but never crash)
- All projections green → "All aircraft MR adequacy on track" banner; table still shown for completeness
- `sdmrData` empty → render nothing (return `null`)
- Distressed shortfall < base shortfall (shouldn't happen by definition, but if data is inconsistent) → both shown as-is, no special handling needed
- MSN absent from `CONTEXT_BY_LEASE_ID` → Aircraft cell shows type only (no `· MSN` suffix); no crash
