# Sprint 6 — F08: Market Value & Tear-down Engine Design

**Date:** 2026-05-01
**Status:** Approved
**Scope:** Expand Portfolio → Aircraft tab with per-asset valuation columns, accordion detail panels, part-out calculator, source tag badges, uncertainty bands, and lightweight user override system.

---

## 1. Architecture

### File changes

| File | Change |
|------|--------|
| `src/app/components/portfolio/AircraftValuationPanel.tsx` | **New** — types, valuation dataset, computed part-out function, expanded panel UI (~350 lines) |
| `src/app/pages/Portfolio.tsx` | **Modify** — replace `mv`/`mvAdj` rendered columns with 4 valuation columns (the `aircraft[]` data array fields are left in place), add accordion state, add override state, import and render `<AircraftValuationPanel />` |

No separate data file. All synthetic valuation data lives inside `AircraftValuationPanel.tsx`. Follows the same isolation pattern as `SDMRTab.tsx` and `IAS36Tab.tsx`.

---

## 2. Data Model

```ts
type SourceTag = "heuristic" | "desk-keyed" | "user-overridden";

interface ValueWithMeta {
  value: number;       // USD
  source: SourceTag;
  bandLow: number;     // uncertainty low bound, USD
  bandHigh: number;    // uncertainty high bound, USD
}

interface PartOutComponent {
  name: "Airframe" | "Engine #1" | "Engine #2" | "Landing Gear" | "APU" | "Avionics";
  componentValue: number;    // USD
  recoveryFactor: number;    // 0–1 (e.g. 0.72 = 72% recovery)
}

interface AircraftValuation {
  msn: string;
  halfLifeBase: ValueWithMeta;     // half-life appraised base value
  currentMV: ValueWithMeta;        // current market value
  mav: ValueWithMeta;              // maintenance-adjusted value
  leaseEncumbered: ValueWithMeta;  // MV adjusted for lease premium/discount vs. vacant possession
  partOut: ValueWithMeta;          // Σ(componentValue × recoveryFactor) − tearDownCost
  tearDownCost: number;            // USD
  partOutComponents: PartOutComponent[];
}
```

### Dataset — 6 aircraft (matching Aircraft Register MSNs)

| MSN | Type | Half-life BV | Current MV | MAV | Lease-Enc. | Part-out | Tear-down |
|-----|------|-------------|------------|-----|------------|----------|-----------|
| 9218 | A320neo | $23.8M | $26.1M | $25.4M | $23.8M | $18.2M | $0.85M |
| 41234 | B737-800 | $27.4M | $28.8M | $28.0M | $26.5M | $19.6M | $0.80M |
| 62047 | B777-300ER | $86.0M | $91.2M | $90.5M | $88.4M | $64.2M | $1.60M |
| 1728 | A330-300 | $26.5M | $29.1M | $28.3M | $27.0M | $20.1M | $1.10M |
| 67892 | B737 MAX 8 | $43.2M | $47.3M | $46.8M | $44.7M | $33.4M | $0.90M |
| 0378 | A350-900 | $65.8M | $72.8M | $71.4M | $69.5M | $51.3M | $1.40M |

All values use `source: "heuristic"` at load. Uncertainty bands are ±4–8% of value (wider for older/less-liquid aircraft types). Lease-encumbered value reflects a lease discount of 2–5% vs. current MV for Stage 2/3 lessees and a small premium for Stage 1 investment-grade lessees.

Each aircraft has 6 part-out components: Airframe, Engine #1, Engine #2, Landing Gear, APU, Avionics. Recovery factors range 0.60–0.85 depending on component type and aircraft age.

### User override state (in Portfolio.tsx)

```ts
type OverrideKey = "halfLifeBase" | "currentMV" | "mav" | "leaseEncumbered" | "partOut";
type OverrideMap = Record<string, Partial<Record<OverrideKey, { value: number; note: string }>>>;
// keyed by MSN — initialised as {}
```

When an override exists for a field, the override value and `source: "user-overridden"` are used in place of the dataset value. Reverting (✕) removes the entry from the map.

---

## 3. Computed Functions

```ts
// Part-out value from components (pure, no state)
computedPartOut(valuation: AircraftValuation): number
  → valuation.partOutComponents.reduce((s, c) => s + c.componentValue * c.recoveryFactor, 0)
     − valuation.tearDownCost

// Resolve a value field applying any user override
resolvedValue(
  valuation: AircraftValuation,
  key: OverrideKey,
  overrides: OverrideMap
): { value: number; source: SourceTag; bandLow: number; bandHigh: number }
  → if override exists: { value: override.value, source: "user-overridden", bandLow: override.value, bandHigh: override.value }
  → else: valuation[key] (ValueWithMeta)

// Format USD for display
fmtUSD(n: number): string
  → same helper as SDMRTab ("$X.XXM" / "$Xk")
```

---

## 4. UI Layout

### Enhanced summary table columns

Replaces the existing `mv` and `mvAdj` columns. New column set:

| MSN | Type | Reg | Vintage | Half-life BV | Current MV | MAV | Lease-Enc. | Part-out | Lessee | ▶ |
|-----|------|-----|---------|-------------|------------|-----|------------|----------|--------|---|

- Each value cell: number + small source badge (`H` grey = heuristic, `D` blue = desk-keyed, `U` amber = user-overridden)
- Sortable columns: Type, Vintage, Half-life BV, Current MV, MAV (via existing `useSortable` hook — update `aircraftAccessors` in `Portfolio.tsx`)
- Chevron column (▶/▲) triggers accordion expand/collapse

### Expanded panel (full-width below row, 3-column grid)

**Left — Value Hierarchy card:**

Five rows, one per value:
```
Label             Value     Source badge    Uncertainty band
Half-life Base    $23.8M    [H]             ± $1.0M – $1.2M
Current MV        $26.1M    [H]             ± $1.1M – $1.4M
MAV               $25.4M    [H]             ± $1.0M – $1.3M
Lease-Encumbered  $23.8M    [H]             ± $0.9M – $1.1M
Part-out          $18.2M    [H]             ± $1.2M – $1.6M
```

Source badge colours:
- `heuristic` → `#64748B` (grey), label `H`
- `desk-keyed` → `#0369A1` (blue), label `D`
- `user-overridden` → `#B45309` (amber), label `U`

**Centre — Part-out Calculator:**

Read-only component breakdown table:

| Component | Value | Recovery % | Recovered |
|-----------|-------|-----------|-----------|
| Airframe | $X.XM | XX% | $X.XM |
| Engine #1 | $X.XM | XX% | $X.XM |
| Engine #2 | $X.XM | XX% | $X.XM |
| Landing Gear | $X.XM | XX% | $X.XM |
| APU | $X.XM | XX% | $X.XM |
| Avionics | $X.XM | XX% | $X.XM |
| **Gross** | | | **$X.XM** |
| Tear-down cost | | | −$X.XM |
| **Net part-out** | | | **$X.XM** |

**Right — Override Panel:**

```
Override a value
[dropdown: select value to override ▼]
New value (USD M):  [____________]
Note:              [________________________]
                   [  Save override  ]

Active overrides:
• Current MV → $27.5M  "Avitas BlueBook Q1 2026"  [✕]
```

- On save: updates `OverrideMap` for this MSN + key; source badge in left card updates to `U`
- Revert (✕): removes override entry; source badge reverts to `H`
- If no overrides active: right panel shows "No overrides — all values from heuristic model"

### Accordion state

```ts
const [aircraftExpanded, setAircraftExpanded] = useState<Set<string>>(new Set());
// keyed by MSN — in Portfolio.tsx
```

Same `Set<string>` toggle pattern as `SDMRTab.tsx`.

---

## 5. Styling Conventions

- Inline `style={{}}` throughout — no CSS modules
- Colour palette: `#002147` Oxford Blue, `#64748B` grey (heuristic), `#0369A1` blue (desk-keyed), `#B45309` amber (user-overridden), `#15803D` green, `#B91C1C` red
- Source badge: small pill `{ fontSize: "0.6875rem", fontWeight: 700, padding: "0.15rem 0.4rem", borderRadius: "0.25rem" }`
- Expanded panel: `display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 1.25rem`
- `<Card>` for left and right panels; plain bordered div for centre table

---

## 6. Out of Scope (this sprint)

- Cirium / IBA / Avitas real data adapter (FR-F08-003 pluggable architecture satisfied by source tag system; live adapter is Phase 2)
- Interactive recovery factor sliders in part-out calculator (read-only at MVP)
- Full audit trail / change history per override (Sprint 12 model governance pass)
- Multi-currency display
- PDF/export of valuation summary
