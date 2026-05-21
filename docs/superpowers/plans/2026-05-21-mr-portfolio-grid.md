# MR Portfolio Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a portfolio-level MR adequacy grid to the top of the SD/MR tab — one row per aircraft showing base and distressed EOL shortfalls side by side, expandable to per-component detail — and link it from the Dashboard MRHealthCard.

**Architecture:** New `MRPortfolioGrid.tsx` component consumes the already-exported `buildProjections()` from `MaintenanceForecastTab.tsx`. Two small export additions unlock the types it needs. `Portfolio.tsx` renders `<MRPortfolioGrid>` above `<SDMRTab>` using the existing `liveSDMRData` variable. `Dashboard.tsx` navigation target changes from `"Leases"` to `"SD / MR"`.

**Tech Stack:** React 18, TypeScript, framer-motion, lucide-react, inline styles, existing `Card` component, existing `mrFlagColor`/`mrFlagBg` helpers from `maintenanceHeuristics.ts`.

---

## Files

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `src/app/components/portfolio/MaintenanceForecastTab.tsx` | Export `LEASE_CONTEXT` and `ComponentProjection` |
| Create | `src/app/components/portfolio/MRPortfolioGrid.tsx` | Portfolio-level MR grid with expandable rows |
| Modify | `src/app/pages/Portfolio.tsx` | Render `MRPortfolioGrid` above `SDMRTab` |
| Modify | `src/app/pages/Dashboard.tsx` | Update nav target on `MRHealthCard` click |

---

## Task 1: Add exports to `MaintenanceForecastTab.tsx`

**Files:**
- Modify: `src/app/components/portfolio/MaintenanceForecastTab.tsx:17,57`

No new tests — this is an export-only change. Existing `buildProjections` tests (26 passing) remain the coverage.

- [ ] **Step 1: Export `LEASE_CONTEXT`**

In `src/app/components/portfolio/MaintenanceForecastTab.tsx`, change line 17 from:

```typescript
const LEASE_CONTEXT: Record<string, { leaseId: string; leaseEnd: string; stage: string }> = {
```

to:

```typescript
export const LEASE_CONTEXT: Record<string, { leaseId: string; leaseEnd: string; stage: string }> = {
```

- [ ] **Step 2: Export `ComponentProjection` interface**

In `src/app/components/portfolio/MaintenanceForecastTab.tsx`, change line 57 from:

```typescript
interface ComponentProjection {
```

to:

```typescript
export interface ComponentProjection {
```

- [ ] **Step 3: Verify existing tests still pass**

Run:
```bash
npx vitest run --reporter=verbose
```

Expected: `Test Files  26 passed (26)` — same count as before, no failures. The change is additive only.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/portfolio/MaintenanceForecastTab.tsx
git commit -m "feat: export LEASE_CONTEXT and ComponentProjection from MaintenanceForecastTab"
```

---

## Task 2: Create `MRPortfolioGrid.tsx`

**Files:**
- Create: `src/app/components/portfolio/MRPortfolioGrid.tsx`

No unit tests — purely presentational, no new pure functions. TypeScript build is the verification gate.

- [ ] **Step 1: Create the file with full implementation**

Create `src/app/components/portfolio/MRPortfolioGrid.tsx` with the following content:

```tsx
import { useState, useMemo, Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "../ui/Card";
import {
  mrFlagColor,
  mrFlagBg,
  type MRAdeqFlag,
} from "../../data/maintenanceHeuristics";
import { type LeaseSDMR } from "./SDMRTab";
import {
  buildProjections,
  LEASE_CONTEXT,
  type ComponentProjection,
} from "./MaintenanceForecastTab";

// ─── Reverse lookup: leaseId → { msn, leaseEnd } ─────────────────────────────
const CONTEXT_BY_LEASE_ID: Record<string, { msn: string; leaseEnd: string }> =
  Object.fromEntries(
    Object.entries(LEASE_CONTEXT).map(([msn, ctx]) => [
      ctx.leaseId,
      { msn, leaseEnd: ctx.leaseEnd },
    ])
  );

// ─── Helpers (defined locally — same logic as in MaintenanceForecastTab.tsx) ──

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function componentFlag(p: ComponentProjection): MRAdeqFlag {
  if (p.eolShortfall > 0)            return "red";
  if (p.distressedEOLShortfall > 0)  return "amber";
  return "green";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  sdmrData: LeaseSDMR[];
}

export function MRPortfolioGrid({ sdmrData }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(leaseId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(leaseId) ? next.delete(leaseId) : next.add(leaseId);
      return next;
    });
  }

  const rows = useMemo(() => {
    return sdmrData
      .map((lease) => {
        const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
        const leaseEndDate = lease.leaseEnd
          ? parseDateLocal(lease.leaseEnd)
          : ctx
          ? parseDateLocal(ctx.leaseEnd)
          : new Date(2028, 0, 1); // last-resort fallback

        const projections = buildProjections(lease, lease.aircraft, leaseEndDate);

        const baseEOLShortfall = projections.reduce(
          (s, p) => s + Math.max(0, p.eolShortfall),
          0
        );
        const distressedEOLShortfall = projections.reduce(
          (s, p) => s + Math.max(0, p.distressedEOLShortfall),
          0
        );
        const overallFlag: MRAdeqFlag = projections.some((p) => p.eolShortfall > 0)
          ? "red"
          : projections.some((p) => p.distressedEOLShortfall > 0)
          ? "amber"
          : "green";
        const msn = ctx?.msn ?? null;

        return {
          lease,
          projections,
          baseEOLShortfall,
          distressedEOLShortfall,
          overallFlag,
          msn,
        };
      })
      .sort((a, b) => b.distressedEOLShortfall - a.distressedEOLShortfall);
  }, [sdmrData]);

  if (sdmrData.length === 0) return null;

  const redCount   = rows.filter((r) => r.overallFlag === "red").length;
  const amberCount = rows.filter((r) => r.overallFlag === "amber").length;
  const greenCount = rows.filter((r) => r.overallFlag === "green").length;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <Card noPadding>
        <div style={{ padding: "1.25rem 1.5rem" }}>
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Portfolio MR Overview
            </span>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              {(
                [
                  ["red",   "#B91C1C", redCount],
                  ["amber", "#B45309", amberCount],
                  ["green", "#15803D", greenCount],
                ] as const
              ).map(([key, color, count]) => (
                <div
                  key={key}
                  style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: color,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#0F172A",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── All-clear banner ────────────────────────────────────────── */}
          {redCount === 0 && amberCount === 0 && (
            <div
              style={{
                color: "#15803D",
                fontSize: "0.8125rem",
                fontWeight: 500,
                padding: "0.25rem 0 0.75rem",
              }}
            >
              All aircraft MR adequacy on track
            </div>
          )}

          {/* ── Table ───────────────────────────────────────────────────── */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
                <th style={{ width: "2rem", padding: "0.5rem 0.5rem" }} />
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    textAlign: "left",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Aircraft / MSN
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    textAlign: "left",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Lessee
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    textAlign: "left",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Flag
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    textAlign: "right",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Base EOL Shortfall
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    textAlign: "right",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Distressed EOL Shortfall
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.lease.leaseId}>
                  {/* ── Summary row ──────────────────────────────────── */}
                  <tr
                    onClick={() => toggle(row.lease.leaseId)}
                    style={{ cursor: "pointer", borderBottom: "1px solid #F1F5F9" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#F8FAFC")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "")
                    }
                  >
                    <td style={{ padding: "0.75rem 0.5rem", width: "2rem" }}>
                      <ChevronRight
                        size={14}
                        style={{
                          color: "#CBD5E1",
                          transform: expanded.has(row.lease.leaseId)
                            ? "rotate(90deg)"
                            : "rotate(0deg)",
                          transition: "transform 160ms ease",
                          display: "block",
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "#0F172A",
                      }}
                    >
                      {row.lease.aircraft}
                      {row.msn && (
                        <span
                          style={{
                            marginLeft: "0.375rem",
                            fontSize: "0.75rem",
                            color: "#94A3B8",
                            fontFamily: "monospace",
                          }}
                        >
                          · {row.msn}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.8125rem",
                        color: "#475569",
                      }}
                    >
                      {row.lease.lessee}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: mrFlagColor(row.overallFlag),
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.8125rem",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                      }}
                    >
                      {row.baseEOLShortfall <= 0 ? (
                        <span style={{ color: "#15803D", fontWeight: 500 }}>✓</span>
                      ) : (
                        <span
                          style={{
                            color:
                              row.overallFlag === "red" ? "#B91C1C" : "#B45309",
                            fontWeight: 600,
                          }}
                        >
                          -{`$${(row.baseEOLShortfall / 1_000_000).toFixed(1)}m`}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.8125rem",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                      }}
                    >
                      {row.distressedEOLShortfall <= 0 ? (
                        <span style={{ color: "#15803D", fontWeight: 500 }}>✓</span>
                      ) : (
                        <span
                          style={{
                            color:
                              row.distressedEOLShortfall > row.baseEOLShortfall
                                ? "#B91C1C"
                                : "#B45309",
                            fontWeight: 600,
                          }}
                        >
                          -{`$${(row.distressedEOLShortfall / 1_000_000).toFixed(1)}m`}
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* ── Expanded component rows ───────────────────────── */}
                  {expanded.has(row.lease.leaseId) && (
                    <>
                      {/* Sub-header */}
                      <tr
                        style={{
                          background: "#F8FAFC",
                          borderBottom: "1px solid #F1F5F9",
                        }}
                      >
                        <td />
                        <td
                          style={{
                            padding: "0.375rem 1rem 0.375rem 2.5rem",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            color: "#94A3B8",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Component
                        </td>
                        <td
                          style={{
                            padding: "0.375rem 1rem",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            color: "#94A3B8",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Balance
                        </td>
                        <td
                          style={{
                            padding: "0.375rem 1rem",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            color: "#94A3B8",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Flag
                        </td>
                        <td
                          style={{
                            padding: "0.375rem 1rem",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            color: "#94A3B8",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            textAlign: "right",
                          }}
                        >
                          Base EOL
                        </td>
                        <td
                          style={{
                            padding: "0.375rem 1rem",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            color: "#94A3B8",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            textAlign: "right",
                          }}
                        >
                          Distressed EOL
                        </td>
                      </tr>

                      {/* Component data rows */}
                      {row.projections.map((p) => {
                        const flag     = componentFlag(p);
                        const flagColor = mrFlagColor(flag);
                        const flagBg   = mrFlagBg(flag);
                        return (
                          <tr
                            key={p.component}
                            style={{
                              background: flagBg,
                              borderBottom: "1px solid #F1F5F9",
                            }}
                          >
                            <td />
                            <td
                              style={{
                                padding: "0.5rem 1rem 0.5rem 2.5rem",
                                fontSize: "0.75rem",
                                color: "#475569",
                              }}
                            >
                              {p.component}
                            </td>
                            <td
                              style={{
                                padding: "0.5rem 1rem",
                                fontSize: "0.75rem",
                                color: "#475569",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              ${(p.currentBalance / 1_000_000).toFixed(2)}m
                            </td>
                            <td style={{ padding: "0.5rem 1rem" }}>
                              <div
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: flagColor,
                                }}
                              />
                            </td>
                            <td
                              style={{
                                padding: "0.5rem 1rem",
                                fontSize: "0.75rem",
                                fontVariantNumeric: "tabular-nums",
                                textAlign: "right",
                              }}
                            >
                              {p.eolShortfall <= 0 ? (
                                <span style={{ color: "#15803D" }}>✓</span>
                              ) : (
                                <span style={{ color: "#B91C1C" }}>
                                  -${(p.eolShortfall / 1_000_000).toFixed(2)}m
                                </span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "0.5rem 1rem",
                                fontSize: "0.75rem",
                                fontVariantNumeric: "tabular-nums",
                                textAlign: "right",
                              }}
                            >
                              {p.distressedEOLShortfall <= 0 ? (
                                <span style={{ color: "#15803D" }}>✓</span>
                              ) : (
                                <span style={{ color: "#B91C1C" }}>
                                  -${(p.distressedEOLShortfall / 1_000_000).toFixed(2)}m
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run:
```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (zero errors). If errors appear, check import paths — `"./MaintenanceForecastTab"` and `"./SDMRTab"` must match the actual filenames exactly (case-sensitive).

- [ ] **Step 3: Run full test suite to confirm nothing broken**

Run:
```bash
npx vitest run --reporter=verbose
```

Expected: `Test Files  26 passed (26)`, `Tests  469 passed (469)`.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/portfolio/MRPortfolioGrid.tsx
git commit -m "feat: add MRPortfolioGrid component — portfolio-level MR adequacy table with expandable per-component rows"
```

---

## Task 3: Wire `MRPortfolioGrid` into `Portfolio.tsx`

**Files:**
- Modify: `src/app/pages/Portfolio.tsx:40,757`

- [ ] **Step 1: Add the import**

In `src/app/pages/Portfolio.tsx`, the existing import on line 40 is:

```typescript
import { SDMRTab, buildLiveSDMRData, type LeaseSDMR } from "../components/portfolio/SDMRTab";
```

Add a new import line immediately after it:

```typescript
import { MRPortfolioGrid } from "../components/portfolio/MRPortfolioGrid";
```

- [ ] **Step 2: Render `MRPortfolioGrid` above `SDMRTab`**

Find the SD/MR tab block (currently line 757):

```tsx
      {/* SD / MR Tab */}
      {activeTab === "SD / MR" && <SDMRTab data={liveSDMRData} />}
```

Replace it with:

```tsx
      {/* SD / MR Tab */}
      {activeTab === "SD / MR" && (
        <>
          <MRPortfolioGrid sdmrData={liveSDMRData ?? []} />
          <SDMRTab data={liveSDMRData} />
        </>
      )}
```

Note: `liveSDMRData` is `LeaseSDMR[] | undefined`. The `?? []` fallback ensures `MRPortfolioGrid` receives an array (and returns `null` when empty, as per its guard).

- [ ] **Step 3: Verify TypeScript compiles cleanly**

Run:
```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output.

- [ ] **Step 4: Run full test suite**

Run:
```bash
npx vitest run --reporter=verbose
```

Expected: `Test Files  26 passed (26)`, `Tests  469 passed (469)`.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/Portfolio.tsx
git commit -m "feat: render MRPortfolioGrid at top of SD/MR tab in Portfolio"
```

---

## Task 4: Update `Dashboard.tsx` nav target

**Files:**
- Modify: `src/app/pages/Dashboard.tsx:474`

- [ ] **Step 1: Change the navigation target**

In `src/app/pages/Dashboard.tsx`, the current `MRHealthCard` render (around line 471–475) is:

```tsx
        <MRHealthCard
          summary={mrSummary}
          staggerIndex={4}
          onClick={() => navigate("/portfolio", { state: { tab: "Leases" } })}
        />
```

Change the `onClick` prop to navigate to the SD/MR tab:

```tsx
        <MRHealthCard
          summary={mrSummary}
          staggerIndex={4}
          onClick={() => navigate("/portfolio", { state: { tab: "SD / MR" } })}
        />
```

The deep-link mechanism (`locationState?.tab → setActiveTab`) is already wired in `Portfolio.tsx` and handles `"SD / MR"` correctly.

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run:
```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output.

- [ ] **Step 3: Run full test suite**

Run:
```bash
npx vitest run --reporter=verbose
```

Expected: `Test Files  26 passed (26)`, `Tests  469 passed (469)`.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/Dashboard.tsx
git commit -m "feat: MRHealthCard click navigates to SD/MR tab (portfolio MR grid)"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Section 1 — export `LEASE_CONTEXT` and `ComponentProjection` → Task 1
- ✅ Section 2 — full `MRPortfolioGrid` component with all spec layout, helpers, expand state, sub-header, component rows, all-clear state → Task 2
- ✅ Section 3 — `Portfolio.tsx` integration with `<MRPortfolioGrid sdmrData={liveSDMRData ?? []} />` → Task 3
- ✅ Section 4 — Dashboard nav target change → Task 4
- ✅ Edge cases: `sdmrData` empty → `null`; MSN absent → type only; all-green → banner shown; `leaseEnd` fallback chain

**Type consistency:**
- `ComponentProjection` exported in Task 1, imported in Task 2 ✅
- `LEASE_CONTEXT` exported in Task 1, imported in Task 2 ✅
- `buildProjections` was already exported, imported in Task 2 ✅
- `liveSDMRData` is `LeaseSDMR[] | undefined` in Portfolio.tsx — `?? []` fallback added in Task 3 ✅
- `MRPortfolioGrid` props: `{ sdmrData: LeaseSDMR[] }` — matches call site `sdmrData={liveSDMRData ?? []}` ✅
