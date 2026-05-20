# Live FH/Cycle Input → Dynamic MR Accrual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to enter actual flight hours and cycles from a servicer report, replacing heuristic utilisation rates in the MR accrual projection engine.

**Architecture:** New `servicer_reports` Supabase table (one row per org+lease, upserted on save) feeds a `useServicerReport` hook; `buildProjections` accepts an optional `UtilOverride` param that substitutes heuristic FH/cycle rates and per-component remaining units; a collapsible inline panel in `MaintenanceForecastTab` provides the input form.

**Tech Stack:** React, TypeScript, Supabase (postgres + RLS), existing portfolio context pattern.

---

## Data Model

### Table: `servicer_reports`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, default gen_random_uuid() |
| `org_id` | UUID | NOT NULL |
| `lease_id` | TEXT | NOT NULL |
| `msn` | TEXT | NOT NULL |
| `report_date` | DATE | NOT NULL |
| `annual_fh` | INTEGER | NOT NULL |
| `annual_cy` | INTEGER | NOT NULL |
| `component_overrides` | JSONB | NOT NULL DEFAULT '{}' |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Unique constraint:** `(org_id, lease_id)` — one active record per lease per org.

**RLS:** `org_id = (auth.jwt() ->> 'org_id')::uuid` on SELECT, INSERT, UPDATE, DELETE.

`component_overrides` shape: `Record<string, number>` mapping component name to remaining units, e.g.:
```json
{ "Engine PR": 4200, "LLPs": 8500, "Airframe HSI": 6200 }
```
Only components the user explicitly overrides appear in the object; missing keys fall back to `comp.remainingUnits` from `LeaseSDMR`.

---

## Files

| Action | Path |
|---|---|
| Create | `supabase/migrations/013_servicer_reports.sql` |
| Create | `src/app/hooks/useServicerReport.ts` |
| Modify | `src/app/components/portfolio/MaintenanceForecastTab.tsx` |

---

## Interfaces

```typescript
// src/app/hooks/useServicerReport.ts

export interface ServicerReport {
  id: string;
  leaseId: string;
  msn: string;
  reportDate: string;                          // "YYYY-MM-DD"
  annualFH: number;
  annualCy: number;
  componentOverrides: Record<string, number>;  // component name → remaining units
}

export interface UseServicerReportReturn {
  report: ServicerReport | null;
  loading: boolean;
  saving: boolean;
  saveReport: (data: Omit<ServicerReport, "id">) => Promise<void>;
  clearReport: () => Promise<void>;
}
```

```typescript
// MaintenanceForecastTab.tsx — added to buildProjections

interface UtilOverride {
  annualFH: number;
  annualCy: number;
  componentRemaining: Record<string, number>;
}
```

---

## Component Behaviour

### `useServicerReport(leaseId: string, msn: string)`

- On mount: `SELECT * FROM servicer_reports WHERE org_id = :orgId AND lease_id = :leaseId LIMIT 1`
- Returns `null` while loading and when no record exists
- `saveReport(data)`: upsert on `(org_id, lease_id)`, sets `updated_at = now()`; optimistic state update before await, rollback on error
- `clearReport()`: DELETE WHERE `org_id = :orgId AND lease_id = :leaseId`; optimistic null before await, rollback on error
- `orgId` sourced from `usePortfolio()` context

### `buildProjections` changes

```typescript
function buildProjections(
  lease: LeaseSDMR,
  aircraftType: string,
  leaseEndDate: Date,
  utilOverride?: UtilOverride,
): ComponentProjection[]
```

Two substitutions inside the `.map()`:
```typescript
const monthlyUtil = comp.rateBasis === "$/FH"
  ? (utilOverride?.annualFH ?? heuristic.utilizationFH) / 12
  : (utilOverride?.annualCy ?? heuristic.utilizationCy) / 12;

const remainingUnits =
  utilOverride?.componentRemaining[comp.component] ?? comp.remainingUnits;
```

All downstream values (`monthlyAccrual`, `monthsToNextEvent`, `nextEventDate`, `projectedBalanceAtEvent`, `projectedBalanceAtEOL`, `eolObligation`, `eolShortfall`, `distressedEOLShortfall`) recalculate automatically.

### Inline panel UI (in `MaintenanceForecastTab`)

**Collapsed — no report saved:**
```
[ Heuristic utilisation · A320neo fleet average ]   [+ Add servicer data ›]
```

**Collapsed — report saved:**
```
[ 📡 Live data · As of 12 Mar 2026 · 3,200 FH/yr · 2,100 cy/yr ]   [Edit ›]
```

Rendered as a slim strip matching the existing lease-context bar style (`#F8FAFC` background, `#E2E8F0` border).

**Expanded form fields:**
1. Report date — `<input type="date">`
2. Annual FH — `<input type="number" min="0" max="8760">`
3. Annual cycles — `<input type="number" min="0" max="8760">`
4. Component remaining units (collapsible sub-section, collapsed by default):
   - One `<input type="number">` per component in `lease.mrComponents`
   - Label includes basis: "Airframe HSI (FH)", "LLPs (cycles)"
   - Placeholder = current `comp.remainingUnits` from `liveRecord`
5. Save button — shows "Saving…" while `saving === true`
6. Reset to heuristic button — calls `clearReport()`
7. Close / collapse chevron

**When live data is active:**
- `[Live]` pill badge next to "Monthly Accrual" column header in the projection table
- Methodology footnote: "Utilisation sourced from servicer report dated DD MMM YYYY · Annual FH: N · Annual cycles: N"
- Heuristic footnote replaced (not appended)

---

## Validation

- `annual_fh`: integer, 1–8760
- `annual_cy`: integer, 1–8760
- `report_date`: required, not in the future
- Component overrides: integer ≥ 0, ≤ `comp.fullIntervalUnits`; empty field = not overridden (key omitted from JSONB)

Client-side only — no server-side validation beyond Postgres type constraints.

---

## Error Handling

- Save failure: rollback optimistic state, show inline error message below the Save button
- Clear failure: rollback optimistic null, show inline error message
- Load failure: log error, treat as no report (fall back to heuristic silently)
