# Scenario Modelling: Editable Component Balances — Design

**Goal:** Let a user hypothetically override a component's starting MR balance within the Scenario Modelling tab, to explore "what if this component's balance were $X" alongside the existing FH/CY utilization sliders.

**Architecture:** Purely client-side, ephemeral state (no persistence, no DB writes, no audit trail — same tier as the existing FH/CY sliders, which already reset on reload). No changes to `buildProjections` or any shared calc-engine file — a shallow-modified copy of the lease's `mrComponents` (with the overridden `cumulativeBalance`) is constructed at the call site and passed into the existing `buildProjections` call exactly as a real lease would be.

**Tech Stack:** React, TypeScript. No new libraries, no new files (all changes confined to `src/app/components/maintenance/ScenarioModellingTab.tsx`).

---

## Scope

- **In scope:** editable starting-balance overrides, per component, per lease, within Scenario Modelling's expanded drilldown panel — affecting the **Scenario** projection only.
- **Out of scope** (explicitly confirmed with the user):
  - The **Base** projection stays computed from real data always — never editable, so there's no ambiguity about which number in the drilldown is real.
  - The read-only "Portfolio MR Overview" grid (`MRPortfolioGrid.tsx`) is not touched — it continues to show only real data, no scenario affordance.
  - No persistence. These overrides are pure UI state, not written to any table, not audited. They reset on page reload, same as `fh`/`cy`.

## UI

Inside the existing expanded-row drilldown (currently renders two `MiniProjectionTable`s side by side — "Base" and "Scenario"), add a new row **above** the two mini-tables:

- Label: "Override starting balances (scenario only)"
- One input per component (the same 5 components already rendered in each mini-table: Airframe HSI, Engine PR, LLPs, Landing Gear, APU) — a numeric input, placeholder text shows the real `cumulativeBalance` (e.g. `$8,967,000` formatted, or the raw number — match whatever numeric-input convention `MaintenanceForecastTab.tsx`'s existing cost-override inputs use for consistency), editable, empty means "use real value."
- A "Reset" link/button next to the row, visible only when at least one override is set for that lease, clearing all of that lease's overrides back to empty (reverting the Scenario table to real starting balances).

This row only renders inside the drilldown for the currently-expanded lease — not shown for collapsed rows, keeping the default view unchanged from today.

## State

New state in `ScenarioModellingTab`:
```typescript
const [balanceOverrides, setBalanceOverrides] = useState<Record<string, Record<string, string>>>({});
// leaseId → component name → draft string value ("" or absent = use real balance)
```

## Data flow

In the `rows` `useMemo`, for each lease:
1. Look up `balanceOverrides[lease.leaseId] ?? {}`.
2. If any component has a non-empty override for this lease, construct a shallow-modified lease object: same lease, `mrComponents` mapped so any component with an override gets `cumulativeBalance` replaced by the parsed override value (invalid/empty parses fall back to the real value — never crash or silently zero out).
3. Pass this modified lease (or the original, when no overrides are set for this lease) as the 1st argument to the **scenario** `buildProjections` call only. The **base** `buildProjections` call always receives the real, unmodified `lease`.
4. Add `balanceOverrides` to the `useMemo`'s dependency array.

This is the only change to the data flow — everything downstream (`scenEOL`, `delta`, the Scenario `MiniProjectionTable`) already recomputes correctly once `scenProj` reflects the overridden balances, since they're pure derivations of `scenProj`.

## Error handling

- Non-numeric or negative input: treat as invalid, fall back to the real balance (don't pass `NaN` into `buildProjections` — this would silently corrupt every downstream calculation for that component). A simple `parseFloat` + `isNaN`/`< 0` guard, matching the validation pattern already used in `MaintenanceForecastTab.tsx`'s existing cost-override input handling.
- No component ever has its input pre-populated with a stale/wrong value — placeholders are recomputed live from the real lease data on every render, so switching between leases (or reloading) always shows accurate real-balance placeholders.

## Testing

No new automated test file — this component has no existing test file today (matches the established convention for this file and its siblings, e.g. `MRPortfolioGrid.tsx`, `RedeliveryRiskTab.tsx`). Verified by typecheck, the full test suite (to confirm no regression to `buildProjections`'s existing consumers), and manual verification in the browser.

## Explicitly not doing

- No changes to `buildProjections`'s signature or any shared calc-engine file.
- No changes to the Base projection, the Portfolio Overview grid, or any other view.
- No persistence layer, no audit logging, no new hooks.
