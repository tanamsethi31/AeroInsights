# Scenario Modelling: Editable Component Balances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user override a component's starting MR balance within Scenario Modelling's expanded drilldown, affecting only the Scenario projection, with zero persistence.

**Architecture:** Single-file change to `src/app/components/maintenance/ScenarioModellingTab.tsx`. A shallow-modified copy of the lease's `mrComponents` (with overridden `cumulativeBalance` for whichever components have a draft override) is constructed at the call site and passed into the existing `buildProjections` call — no changes to `buildProjections` or any shared calc-engine file.

**Tech Stack:** React, TypeScript. No new libraries, no new files.

---

## Task 1: Balance-override state, helper, and data-flow wiring

**Files:**
- Modify: `src/app/components/maintenance/ScenarioModellingTab.tsx`

Read the file fully first — confirm current line numbers before editing (it was last touched by an earlier, unrelated pass wiring cost-tier data; the exact lines below match its current state, but verify before assuming).

- [ ] **Step 1: Add the `LeaseSDMR` type import**

Find the existing import block:
```typescript
import type { AdjustedLease } from "../../utils/maintenanceEvents";
import {
  LEASE_CONTEXT,
  buildProjections,
  type ComponentProjection,
} from "../portfolio/MaintenanceForecastTab";
import { useAllCostOverrides } from "../../hooks/useAllCostOverrides";
import { useAllOrgCostBenchmarks } from "../../hooks/useAllOrgCostBenchmarks";
```
Add one more import line:
```typescript
import type { LeaseSDMR } from "../portfolio/SDMRTab";
```

- [ ] **Step 2: Add the `leaseWithBalanceOverrides` helper**

Add near the other helpers (`parseDateLocal`, `fmtUSD`, `eolColor`):
```typescript
/** Returns `lease` unchanged if no override applies, otherwise a shallow copy with the
 *  overridden components' cumulativeBalance replaced. Invalid/empty input for a component
 *  falls back to that component's real balance — never produces NaN or a negative balance. */
function leaseWithBalanceOverrides(lease: LeaseSDMR, overrides: Record<string, string> | undefined): LeaseSDMR {
  if (!overrides || Object.keys(overrides).length === 0) return lease;
  return {
    ...lease,
    mrComponents: lease.mrComponents.map(c => {
      const raw = overrides[c.component];
      if (raw === undefined || raw === "") return c;
      const parsed = parseFloat(raw);
      if (isNaN(parsed) || parsed < 0) return c;
      return { ...c, cumulativeBalance: parsed };
    }),
  };
}
```

- [ ] **Step 3: Add the state**

Find:
```typescript
export function ScenarioModellingTab({ adjustedLeases }: { adjustedLeases: AdjustedLease[] }) {
  const [fh,         setFh       ] = useState(DEFAULT_FH);
  const [cy,         setCy       ] = useState(DEFAULT_CY);
  const [expanded,   setExpanded ] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
```
Add a fourth state line:
```typescript
export function ScenarioModellingTab({ adjustedLeases }: { adjustedLeases: AdjustedLease[] }) {
  const [fh,         setFh       ] = useState(DEFAULT_FH);
  const [cy,         setCy       ] = useState(DEFAULT_CY);
  const [expanded,   setExpanded ] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [balanceOverrides, setBalanceOverrides] = useState<Record<string, Record<string, string>>>({});
```

- [ ] **Step 4: Thread the override into the scenario `buildProjections` call**

Find the `rows` `useMemo` body:
```typescript
  const rows = useMemo(() => {
    return adjustedLeases.map(({ lease, utilOverride }) => {
      const entry = Object.entries(LEASE_CONTEXT).find(([, ctx]) => ctx.leaseId === lease.leaseId);
      const msn = entry?.[0] ?? "—";
      const leaseEndStr = lease.leaseEnd ?? (entry ? LEASE_CONTEXT[entry[0]].leaseEnd : "2028-01-01");
      const leaseEndDate = parseDateLocal(leaseEndStr);
      const a = { leaseId: lease.leaseId, msn, lessee: lease.lessee, aircraft: lease.aircraft, leaseEnd: leaseEndStr };

      const costOverrides = overridesByLeaseId.get(lease.leaseId);
      const orgBenchmarks = benchmarksByAircraftType.get(lease.aircraft);

      // Base projection uses servicer report utilization (if available), otherwise heuristic
      const baseProj = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride, costOverrides, orgBenchmarks);
      // Scenario projection uses user-slider FH/CY values
      const scenProj = buildProjections(lease, lease.aircraft, leaseEndDate, {
        annualFH:           fh,
        annualCy:           cy,
        componentRemaining: {},
      }, costOverrides, orgBenchmarks);

      const baseEOL = baseProj.reduce((s, p) => s + p.eolShortfall, 0);
      const scenEOL = scenProj.reduce((s, p) => s + p.eolShortfall, 0);
      const delta   = scenEOL - baseEOL; // +ve = scenario worsens shortfall

      return { ...a, lease, leaseEndDate, baseProj, scenProj, baseEOL, scenEOL, delta, utilOverride };
    });
  }, [adjustedLeases, fh, cy, overridesByLeaseId, benchmarksByAircraftType]);
```
Change to (only the `scenProj` line and the dependency array change — `baseProj` keeps using the real, unmodified `lease`):
```typescript
  const rows = useMemo(() => {
    return adjustedLeases.map(({ lease, utilOverride }) => {
      const entry = Object.entries(LEASE_CONTEXT).find(([, ctx]) => ctx.leaseId === lease.leaseId);
      const msn = entry?.[0] ?? "—";
      const leaseEndStr = lease.leaseEnd ?? (entry ? LEASE_CONTEXT[entry[0]].leaseEnd : "2028-01-01");
      const leaseEndDate = parseDateLocal(leaseEndStr);
      const a = { leaseId: lease.leaseId, msn, lessee: lease.lessee, aircraft: lease.aircraft, leaseEnd: leaseEndStr };

      const costOverrides = overridesByLeaseId.get(lease.leaseId);
      const orgBenchmarks = benchmarksByAircraftType.get(lease.aircraft);
      const leaseForScenario = leaseWithBalanceOverrides(lease, balanceOverrides[lease.leaseId]);

      // Base projection uses servicer report utilization (if available), otherwise heuristic
      const baseProj = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride, costOverrides, orgBenchmarks);
      // Scenario projection uses user-slider FH/CY values, plus any per-component balance override
      const scenProj = buildProjections(leaseForScenario, lease.aircraft, leaseEndDate, {
        annualFH:           fh,
        annualCy:           cy,
        componentRemaining: {},
      }, costOverrides, orgBenchmarks);

      const baseEOL = baseProj.reduce((s, p) => s + p.eolShortfall, 0);
      const scenEOL = scenProj.reduce((s, p) => s + p.eolShortfall, 0);
      const delta   = scenEOL - baseEOL; // +ve = scenario worsens shortfall

      return { ...a, lease, leaseEndDate, baseProj, scenProj, baseEOL, scenEOL, delta, utilOverride };
    });
  }, [adjustedLeases, fh, cy, overridesByLeaseId, benchmarksByAircraftType, balanceOverrides]);
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit` — expect no errors. (No UI wired to `balanceOverrides`/`setBalanceOverrides` yet in this task — that's Task 2 — so `setBalanceOverrides` will be unused until then. If TypeScript/lint complains about an unused setter, that's expected and resolves once Task 2 lands; don't work around it by removing the state early.)

- [ ] **Step 6: Run tests**

Run: `npm test -- --run` — expect all pass, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/app/components/maintenance/ScenarioModellingTab.tsx
git commit -m "feat: thread optional per-component balance overrides into Scenario projection

Purely additive data-flow change — no UI yet. leaseWithBalanceOverrides
constructs a shallow-modified lease (only mrComponents[].cumulativeBalance
replaced for components with a draft override) and feeds it to the
scenario buildProjections call only; the base projection is untouched.
No changes to buildProjections itself."
```

---

## Task 2: Editable balance inputs in the drilldown panel

**Files:**
- Modify: `src/app/components/maintenance/ScenarioModellingTab.tsx`

- [ ] **Step 1: Restructure the drilldown panel to add the override row above the two mini-tables**

Find the expanded-row drilldown block:
```typescript
              {/* Per-aircraft drilldown */}
              {isExpanded && (
                <div style={{
                  borderBottom: "1px solid #E2E8F0",
                  padding: "1rem",
                  background: "#F8FAFC",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}>
                  <MiniProjectionTable
                    title={row.utilOverride ? "Base (Servicer Report)" : "Base (Heuristic)"}
                    projections={row.baseProj}
                  />
                  <MiniProjectionTable
                    title={`Scenario (${fh.toLocaleString()} FH / ${cy.toLocaleString()} cy)`}
                    projections={row.scenProj}
                    highlight
                  />
                </div>
              )}
```
Change to (the outer `display: grid` becomes `display: flex, flexDirection: column`, wrapping a new override-inputs block above an inner grid that holds just the two tables):
```typescript
              {/* Per-aircraft drilldown */}
              {isExpanded && (
                <div style={{
                  borderBottom: "1px solid #E2E8F0",
                  padding: "1rem",
                  background: "#F8FAFC",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}>
                  {/* Balance override row (scenario only) */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Override starting balances <span style={{ fontWeight: 400, textTransform: "none", color: "#94A3B8" }}>(scenario only)</span>
                      </span>
                      {Object.values(balanceOverrides[row.leaseId] ?? {}).some(v => v !== "") && (
                        <button
                          type="button"
                          onClick={() => setBalanceOverrides(prev => {
                            const next = { ...prev };
                            delete next[row.leaseId];
                            return next;
                          })}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.72rem", color: "#B91C1C", fontWeight: 600 }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      {row.lease.mrComponents.map(comp => (
                        <label key={comp.component} style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem", fontWeight: 600, color: "#475569" }}>
                          {comp.component}
                          <input
                            type="number"
                            min={0}
                            value={balanceOverrides[row.leaseId]?.[comp.component] ?? ""}
                            placeholder={String(comp.cumulativeBalance)}
                            onChange={e => {
                              const val = e.target.value;
                              setBalanceOverrides(prev => ({
                                ...prev,
                                [row.leaseId]: { ...(prev[row.leaseId] ?? {}), [comp.component]: val },
                              }));
                            }}
                            style={{ width: "130px", padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Base vs Scenario mini-tables */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <MiniProjectionTable
                      title={row.utilOverride ? "Base (Servicer Report)" : "Base (Heuristic)"}
                      projections={row.baseProj}
                    />
                    <MiniProjectionTable
                      title={`Scenario (${fh.toLocaleString()} FH / ${cy.toLocaleString()} cy)`}
                      projections={row.scenProj}
                      highlight
                    />
                  </div>
                </div>
              )}
```

Note: the balance-override inputs/button live in a sibling `<div>` BELOW the clickable "Main row" div (which has the `onClick={() => setExpanded(...)}` handler) — not nested inside it — so clicking an input or the Reset button does not trigger the row to collapse. No `stopPropagation()` needed; verify this holds by checking the actual rendered structure matches (the clickable row and the `isExpanded && (...)` block are siblings, not parent/child) before assuming it's safe to skip.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 3: Run tests**

Run: `npm test -- --run` — expect all pass, no regressions.

- [ ] **Step 4: Manual verification in the browser**

This component has no automated tests (matches the established convention for this file). Verify directly:
1. Open Maintenance → Scenario Modelling, expand a lease row.
2. Confirm the new "Override starting balances (scenario only)" row appears above the two mini-tables, with 5 inputs (one per component), each showing the real balance as a placeholder.
3. Type a value into one input — confirm the Scenario mini-table's numbers for that component update live (EOL Balance, EOL Position), while the Base mini-table stays unchanged.
4. Confirm the portfolio-wide "Scenario EOL" and "Δ Delta" columns for that row also update to reflect the override.
5. Confirm the "Reset" link appears once an override is set, and clicking it clears the inputs and reverts the Scenario numbers to real-balance-derived values.
6. Confirm typing a negative number or clearing the input falls back to the real balance (no crash, no NaN displayed anywhere).
7. Collapse and re-expand the row — confirm the override values persist (state is keyed by leaseId, not tied to expand/collapse).
8. Expand a different lease — confirm its balance-override inputs are independent (empty/real-placeholder), not sharing state with the first lease.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/maintenance/ScenarioModellingTab.tsx
git commit -m "feat: add editable per-component balance override inputs to Scenario Modelling drilldown"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers the spec's "Data flow" and "Error handling" sections (the parse/fallback guard lives in `leaseWithBalanceOverrides`). Task 2 covers the "UI" and "State" sections. Both together cover "Scope" (Base untouched, no persistence, single-file change).
- **Type consistency:** `balanceOverrides: Record<string, Record<string, string>>` (leaseId → component → draft string) is used identically in both tasks — Task 1 reads it via `balanceOverrides[lease.leaseId]`, Task 2 writes it via `setBalanceOverrides` with the same key shape. No drift.
- **No new files, no shared-engine changes** — confirmed only `ScenarioModellingTab.tsx` is touched across both tasks, matching the spec's explicit "Explicitly not doing" section.
