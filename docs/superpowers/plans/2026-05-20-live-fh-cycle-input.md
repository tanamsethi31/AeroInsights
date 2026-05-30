# Live FH/Cycle Input → Dynamic MR Accrual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible inline form to `MaintenanceForecastTab` where users enter actual FH/cycles from a servicer report; these values persist to Supabase and replace heuristic utilisation rates in the MR projection engine.

**Architecture:** New `servicer_reports` Supabase table (one row per org+lease, upserted on save); `useServicerReport` hook fetches/saves the record; `buildProjections` receives an optional `UtilOverride` param that substitutes both the aircraft-level FH/cycle rates and any per-component remaining units.

**Tech Stack:** TypeScript, React, Supabase JS client, Vitest, existing `useData` / `usePortfolio` context patterns.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `supabase/migrations/013_servicer_reports.sql` | DDL for the new table |
| Create | `src/app/hooks/useServicerReport.ts` | Fetch / upsert / delete one report per lease |
| Modify | `src/app/components/portfolio/MaintenanceForecastTab.tsx` | Export `buildProjections`, add `UtilOverride` param, wire hook + panel UI |
| Create | `src/app/components/portfolio/MaintenanceForecastTab.test.ts` | Unit-test `buildProjections` with and without `UtilOverride` |

---

## Context You Need

**`MaintenanceForecastTab.tsx` structure (read the file before starting):**
- `buildProjections(lease, aircraftType, leaseEndDate)` — pure function, currently file-internal. It uses `heuristic.utilizationFH / 12` and `heuristic.utilizationCy / 12` for monthly utilisation, and `comp.remainingUnits` for each component's remaining interval.
- `Props` interface at line ~121: `{ msn, aircraftType, vintage, liveRecord?: LeaseSDMR }`
- The component derives `leaseId` from `liveRecord?.leaseId` or `LEASE_CONTEXT[msn]?.leaseId`.
- Reference date is hardcoded: `const now = new Date(2026, 4, 1);`

**`TYPE_HEURISTICS` (from `maintenanceHeuristics.ts`):**
- `A320neo`: `utilizationFH: 3500`, `utilizationCy: 2800`

**Hook pattern — copy from `src/app/hooks/useCashFlow.ts`:**
- `orgId` from `useData()` context
- Cancelled-flag pattern in `useEffect`
- Optimistic update + rollback on error

**Existing migration pattern — copy from `supabase/migrations/011_cash_events.sql`:**
- `org_id uuid not null references organisations(id) on delete cascade`

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/013_servicer_reports.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/013_servicer_reports.sql
-- One row per (org_id, lease_id). Upserted from useServicerReport hook.
-- lease_id is TEXT (matches SDMR text identifiers like "LSE-2019-001").
-- component_overrides: {"Engine PR": 4200, "LLPs": 8500} — remaining units per component.

create table if not exists servicer_reports (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null references organisations(id) on delete cascade,
  lease_id            text        not null,
  msn                 text        not null,
  report_date         date        not null,
  annual_fh           integer     not null,
  annual_cy           integer     not null,
  component_overrides jsonb       not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- One active record per lease per org — upsert target
create unique index if not exists servicer_reports_org_lease_uidx
  on servicer_reports(org_id, lease_id);

create index if not exists servicer_reports_org_idx
  on servicer_reports(org_id);
```

- [ ] **Step 2: Apply to Supabase**

Run via Supabase CLI (if available):
```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx supabase db push
```

Or paste the SQL directly into the Supabase dashboard SQL editor at:
`https://supabase.com/dashboard/project/naqgfwnbhybhtirazkjq/sql`

Expected: table `servicer_reports` appears in the Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/013_servicer_reports.sql
git commit -m "feat: add servicer_reports table for live FH/cycle input"
```

---

## Task 2: Export `buildProjections` and write tests

**Files:**
- Modify: `src/app/components/portfolio/MaintenanceForecastTab.tsx` (export one function)
- Create: `src/app/components/portfolio/MaintenanceForecastTab.test.ts`

- [ ] **Step 1: Export `buildProjections` from `MaintenanceForecastTab.tsx`**

Find the line (around line 64):
```typescript
function buildProjections(
```
Change it to:
```typescript
export function buildProjections(
```

Also add the `UtilOverride` interface directly above `buildProjections` (before exporting):
```typescript
export interface UtilOverride {
  annualFH: number;
  annualCy: number;
  componentRemaining: Record<string, number>; // component name → remaining units
}
```

Do NOT change the function signature yet — that happens in Task 3.

- [ ] **Step 2: Write the test file**

```typescript
// src/app/components/portfolio/MaintenanceForecastTab.test.ts
import { describe, it, expect } from "vitest";
import { buildProjections } from "./MaintenanceForecastTab";
import type { LeaseSDMR } from "./SDMRTab";

// ── Minimal factory — one FH-based component (Airframe HSI) ───────────────────

function makeLease(): LeaseSDMR {
  return {
    leaseId:         "LSE-TEST-001",
    lessee:          "Test Airline",
    aircraft:        "A320neo",
    eadNum:          0,
    baseLGD:         50,
    returnCondition: "half-life",
    leaseEnd:        "2030-01-01",
    stage:           1,
    sd: {
      type:           "Cash",
      amount:         0,
      currency:       "USD",
      refundTriggers: [],
      governingLaw:   "English",
    },
    mrComponents: [
      {
        component:         "Airframe HSI",
        rateBasis:         "$/FH",
        rateAmount:        420,
        unitsAccumulated:  20_000,
        cumulativeBalance: 8_000_000,
        refundable:        true,
        capRule:           "",
        evidencedCost:     6_000_000,
        fullIntervalUnits: 36_000,
        remainingUnits:    6_200,
      },
    ],
  };
}

const LEASE_END = new Date(2030, 0, 1);

// ── Baseline (no override) ────────────────────────────────────────────────────

describe("buildProjections — baseline (no override)", () => {
  it("uses heuristic utilFH for Airframe HSI monthly accrual", () => {
    // A320neo heuristic.utilizationFH = 3500
    // monthlyAccrual = 420 * (3500 / 12) ≈ 122_500
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p.monthlyAccrual).toBeCloseTo(420 * (3500 / 12), 0);
  });

  it("uses comp.remainingUnits for monthsToNextEvent", () => {
    // monthsToNextEvent = 6200 / (3500 / 12) ≈ 21.26
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END);
    expect(p.monthsToNextEvent).toBeCloseTo(6200 / (3500 / 12), 1);
  });
});

// ── UtilOverride — annualFH ───────────────────────────────────────────────────

describe("buildProjections — UtilOverride.annualFH", () => {
  it("replaces heuristic FH with override value for monthly accrual", () => {
    // override annualFH = 2800 → monthlyAccrual = 420 * (2800 / 12) ≈ 98_000
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, {
      annualFH:           2800,
      annualCy:           2800,
      componentRemaining: {},
    });
    expect(p.monthlyAccrual).toBeCloseTo(420 * (2800 / 12), 0);
  });

  it("monthlyAccrual differs from heuristic when override differs", () => {
    const [base] = buildProjections(makeLease(), "A320neo", LEASE_END);
    const [live] = buildProjections(makeLease(), "A320neo", LEASE_END, {
      annualFH:           2800,
      annualCy:           2800,
      componentRemaining: {},
    });
    expect(live.monthlyAccrual).toBeLessThan(base.monthlyAccrual);
  });
});

// ── UtilOverride — componentRemaining ────────────────────────────────────────

describe("buildProjections — UtilOverride.componentRemaining", () => {
  it("uses override remaining units for monthsToNextEvent", () => {
    // remainingUnits = 3500, monthlyUtil = 3500/12 → monthsToNextEvent = 12
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, {
      annualFH:           3500,
      annualCy:           2800,
      componentRemaining: { "Airframe HSI": 3500 },
    });
    expect(p.monthsToNextEvent).toBeCloseTo(12, 0);
  });

  it("falls back to comp.remainingUnits when component key absent", () => {
    // empty override → uses comp.remainingUnits = 6200
    const [p] = buildProjections(makeLease(), "A320neo", LEASE_END, {
      annualFH:           3500,
      annualCy:           2800,
      componentRemaining: {},
    });
    expect(p.monthsToNextEvent).toBeCloseTo(6200 / (3500 / 12), 1);
  });
});
```

- [ ] **Step 3: Run tests — expect FAILURES (UtilOverride param not yet accepted)**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx vitest run src/app/components/portfolio/MaintenanceForecastTab.test.ts
```

Expected: baseline tests PASS (2 pass); UtilOverride tests FAIL with TypeScript error or wrong values (4 fail). That is correct — we write the implementation next.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/portfolio/MaintenanceForecastTab.tsx \
        src/app/components/portfolio/MaintenanceForecastTab.test.ts
git commit -m "test: add buildProjections tests for UtilOverride (failing)"
```

---

## Task 3: Implement `UtilOverride` in `buildProjections`

**Files:**
- Modify: `src/app/components/portfolio/MaintenanceForecastTab.tsx`

- [ ] **Step 1: Add `utilOverride` parameter to `buildProjections`**

Find the exported function signature (now reads):
```typescript
export function buildProjections(
  lease: LeaseSDMR,
  aircraftType: string,
  leaseEndDate: Date,
): ComponentProjection[] {
```

Change it to:
```typescript
export function buildProjections(
  lease: LeaseSDMR,
  aircraftType: string,
  leaseEndDate: Date,
  utilOverride?: UtilOverride,
): ComponentProjection[] {
```

- [ ] **Step 2: Replace the two utilisation lines inside `.map()`**

Find these two lines inside the `lease.mrComponents.map(...)` callback (around line 75–80):
```typescript
    const monthlyUtil = comp.rateBasis === "$/FH"
      ? heuristic.utilizationFH / 12
      : heuristic.utilizationCy / 12;

    const monthlyAccrual    = comp.rateAmount * monthlyUtil;
    const monthsToNextEvent = comp.remainingUnits / monthlyUtil;
```

Replace with:
```typescript
    const monthlyUtil = comp.rateBasis === "$/FH"
      ? (utilOverride?.annualFH ?? heuristic.utilizationFH) / 12
      : (utilOverride?.annualCy ?? heuristic.utilizationCy) / 12;

    const remainingUnits    = utilOverride?.componentRemaining[comp.component] ?? comp.remainingUnits;
    const monthlyAccrual    = comp.rateAmount * monthlyUtil;
    const monthsToNextEvent = remainingUnits / monthlyUtil;
```

Also update the lines that reference `comp.remainingUnits` later in the same `.map()` callback. Find:
```typescript
    const projectedBalanceAtEvent = comp.cumulativeBalance + comp.remainingUnits * comp.rateAmount;
```
Change to:
```typescript
    const projectedBalanceAtEvent = comp.cumulativeBalance + remainingUnits * comp.rateAmount;
```

And find:
```typescript
    const remainingAtEOL = Math.max(0, comp.remainingUnits - monthsToEOL * monthlyUtil);
    ...
    const currentUsed           = comp.fullIntervalUnits - comp.remainingUnits;
```
Change to:
```typescript
    const remainingAtEOL = Math.max(0, remainingUnits - monthsToEOL * monthlyUtil);
    ...
    const currentUsed           = comp.fullIntervalUnits - remainingUnits;
```

- [ ] **Step 3: Run tests — expect all PASS**

```bash
npx vitest run src/app/components/portfolio/MaintenanceForecastTab.test.ts
```

Expected output:
```
✓ buildProjections — baseline (no override) > uses heuristic utilFH for Airframe HSI monthly accrual
✓ buildProjections — baseline (no override) > uses comp.remainingUnits for monthsToNextEvent
✓ buildProjections — UtilOverride.annualFH > replaces heuristic FH with override value for monthly accrual
✓ buildProjections — UtilOverride.annualFH > monthlyAccrual differs from heuristic when override differs
✓ buildProjections — UtilOverride.componentRemaining > uses override remaining units for monthsToNextEvent
✓ buildProjections — UtilOverride.componentRemaining > falls back to comp.remainingUnits when component key absent

Test Files  1 passed (1)
Tests       6 passed (6)
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/portfolio/MaintenanceForecastTab.tsx
git commit -m "feat: add UtilOverride param to buildProjections for live FH/cycle input"
```

---

## Task 4: `useServicerReport` hook

**Files:**
- Create: `src/app/hooks/useServicerReport.ts`

- [ ] **Step 1: Create the hook file**

```typescript
// src/app/hooks/useServicerReport.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  report:      ServicerReport | null;
  loading:     boolean;
  saving:      boolean;
  saveReport:  (data: Omit<ServicerReport, "id">) => Promise<void>;
  clearReport: () => Promise<void>;
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): ServicerReport {
  return {
    id:                 row.id as string,
    leaseId:            row.lease_id as string,
    msn:                row.msn as string,
    reportDate:         row.report_date as string,
    annualFH:           Number(row.annual_fh),
    annualCy:           Number(row.annual_cy),
    componentOverrides: (row.component_overrides as Record<string, number>) ?? {},
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useServicerReport(leaseId: string | null): UseServicerReportReturn {
  const { orgId } = useData();
  const [report,  setReport]  = useState<ServicerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);

  // ── Load on mount / leaseId change ────────────────────────────────────────

  useEffect(() => {
    if (!orgId || !leaseId) { setReport(null); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("servicer_reports")
        .select("*")
        .eq("org_id", orgId)
        .eq("lease_id", leaseId)
        .maybeSingle();

      if (cancelled) { setLoading(false); return; }
      if (error) {
        console.error("[useServicerReport] load error:", error);
        setLoading(false);
        return;
      }
      setReport(data ? mapRow(data as Record<string, unknown>) : null);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId, leaseId]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveReport = useCallback(async (data: Omit<ServicerReport, "id">) => {
    if (!orgId || !leaseId) return;
    setSaving(true);

    // Optimistic update
    const snapshot = report;
    setReport({ ...data, id: "temp" });

    const { data: row, error } = await supabase
      .from("servicer_reports")
      .upsert(
        {
          org_id:               orgId,
          lease_id:             leaseId,
          msn:                  data.msn,
          report_date:          data.reportDate,
          annual_fh:            data.annualFH,
          annual_cy:            data.annualCy,
          component_overrides:  data.componentOverrides,
          updated_at:           new Date().toISOString(),
        },
        { onConflict: "org_id,lease_id" },
      )
      .select()
      .single();

    if (error) {
      console.error("[useServicerReport] saveReport error:", error);
      setReport(snapshot); // rollback
    } else if (row) {
      setReport(mapRow(row as Record<string, unknown>));
    }
    setSaving(false);
  }, [orgId, leaseId, report]);

  const clearReport = useCallback(async () => {
    if (!orgId || !leaseId) return;
    setSaving(true);

    const snapshot = report;
    setReport(null); // optimistic

    const { error } = await supabase
      .from("servicer_reports")
      .delete()
      .eq("org_id", orgId)
      .eq("lease_id", leaseId);

    if (error) {
      console.error("[useServicerReport] clearReport error:", error);
      setReport(snapshot); // rollback
    }
    setSaving(false);
  }, [orgId, leaseId, report]);

  return { report, loading, saving, saveReport, clearReport };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx tsc --noEmit 2>&1 | grep useServicerReport
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/hooks/useServicerReport.ts
git commit -m "feat: add useServicerReport hook (fetch/upsert/delete one report per lease)"
```

---

## Task 5: Panel UI in `MaintenanceForecastTab`

**Files:**
- Modify: `src/app/components/portfolio/MaintenanceForecastTab.tsx`

- [ ] **Step 1: Add imports at the top of `MaintenanceForecastTab.tsx`**

Find the existing import block. Add two new imports:

```typescript
import { ChevronDown, ChevronUp, Info } from "lucide-react";
// Note: Info is already imported — keep the existing import, just add ChevronDown, ChevronUp
```

So the lucide import line changes from:
```typescript
import { Info } from "lucide-react";
```
to:
```typescript
import { Info, ChevronDown, ChevronUp } from "lucide-react";
```

Also add the hook import after the existing local imports:
```typescript
import { useServicerReport } from "../../hooks/useServicerReport";
import type { ServicerReport } from "../../hooks/useServicerReport";
```

- [ ] **Step 2: Add draft form state interface above the component**

Add this interface directly above the `Props` interface (around line 121):

```typescript
interface DraftForm {
  reportDate:         string;
  annualFH:           string;
  annualCy:           string;
  showComponents:     boolean;
  componentRemaining: Record<string, string>; // component name → string (empty = not overridden)
}

function emptyDraft(): DraftForm {
  return { reportDate: "", annualFH: "", annualCy: "", showComponents: false, componentRemaining: {} };
}

function draftFromReport(r: ServicerReport): DraftForm {
  return {
    reportDate:         r.reportDate,
    annualFH:           String(r.annualFH),
    annualCy:           String(r.annualCy),
    showComponents:     Object.keys(r.componentOverrides).length > 0,
    componentRemaining: Object.fromEntries(
      Object.entries(r.componentOverrides).map(([k, v]) => [k, String(v)])
    ),
  };
}
```

- [ ] **Step 3: Add hook call and state inside the component function**

Inside `MaintenanceForecastTab` (after the two existing `useState` declarations), add:

```typescript
  // Derive leaseId for the hook (prefer liveRecord, fall back to LEASE_CONTEXT)
  const leaseId = liveRecord?.leaseId ?? ctx?.leaseId ?? null;

  const { report, saving, saveReport, clearReport } = useServicerReport(leaseId);

  const [panelOpen, setPanelOpen] = React.useState(false);
  const [draft,     setDraft    ] = React.useState<DraftForm>(emptyDraft);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Sync saved report → draft whenever report loads/changes
  React.useEffect(() => {
    setDraft(report ? draftFromReport(report) : emptyDraft());
  }, [report]);

  // Build utilOverride from the saved report (not the draft — draft is unsaved edits)
  const utilOverride = report
    ? {
        annualFH:           report.annualFH,
        annualCy:           report.annualCy,
        componentRemaining: report.componentOverrides,
      }
    : undefined;
```

Note: `React` is already available because of `import * as React from "react"` at the top (check the file — if it uses named imports only, use `useState`, `useEffect` directly).

- [ ] **Step 4: Pass `utilOverride` to `buildProjections`**

Find the existing call (around line 153):
```typescript
  const projections = buildProjections(leaseRecord, aircraftType, leaseEndDate);
```
Change to:
```typescript
  const projections = buildProjections(leaseRecord, aircraftType, leaseEndDate, utilOverride);
```

- [ ] **Step 5: Add the `handleSave` function inside the component**

Add this just before the `return` statement:

```typescript
  async function handleSave() {
    if (!leaseId) return;
    setSaveError(null);

    const fh = parseInt(draft.annualFH, 10);
    const cy = parseInt(draft.annualCy, 10);
    if (!draft.reportDate) { setSaveError("Report date is required."); return; }
    if (isNaN(fh) || fh < 1 || fh > 8760) { setSaveError("Annual FH must be between 1 and 8760."); return; }
    if (isNaN(cy) || cy < 1 || cy > 8760) { setSaveError("Annual cycles must be between 1 and 8760."); return; }

    // Build componentOverrides — omit empty fields
    const componentOverrides: Record<string, number> = {};
    for (const [comp, val] of Object.entries(draft.componentRemaining)) {
      if (val === "") continue;
      const n = parseInt(val, 10);
      if (!isNaN(n) && n >= 0) componentOverrides[comp] = n;
    }

    try {
      await saveReport({
        leaseId,
        msn,
        reportDate:         draft.reportDate,
        annualFH:           fh,
        annualCy:           cy,
        componentOverrides,
      });
      setPanelOpen(false);
    } catch {
      setSaveError("Failed to save. Please try again.");
    }
  }
```

- [ ] **Step 6: Insert the collapsible panel into the JSX**

Inside the `return (...)` block, insert the panel as the **first child** of the outer `<div>` (before the `{/* ── Top: Adequacy flag + EOL summary ─────────────────────────── */}` comment):

```tsx
      {/* ── Servicer Report Panel ─────────────────────────────────────── */}
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>

        {/* Collapsed banner — always visible */}
        <div
          onClick={() => { setPanelOpen(o => !o); setSaveError(null); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.875rem", cursor: "pointer", userSelect: "none" }}
        >
          <span style={{ fontSize: "0.75rem", color: "#475569" }}>
            {report
              ? <>
                  <span style={{ background: "#002147", color: "#fff", fontSize: "0.625rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 6px", marginRight: "0.5rem" }}>LIVE</span>
                  Servicer report · {new Date(report.reportDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {report.annualFH.toLocaleString()} FH/yr · {report.annualCy.toLocaleString()} cy/yr
                </>
              : <span style={{ color: "#94A3B8" }}>Heuristic utilisation · {aircraftType} fleet average · <span style={{ color: "#002147", fontWeight: 600 }}>+ Add servicer data</span></span>
            }
          </span>
          {panelOpen ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
        </div>

        {/* Expanded form */}
        {panelOpen && (
          <div style={{ padding: "0.875rem", borderTop: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: "0.875rem" }}>

            {/* Row 1: Report date */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                Report date
                <input
                  type="date"
                  value={draft.reportDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setDraft(d => ({ ...d, reportDate: e.target.value }))}
                  style={{ padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                />
              </label>
            </div>

            {/* Row 2: Annual FH + cycles */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                Annual FH
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={draft.annualFH}
                  placeholder="e.g. 3200"
                  onChange={e => setDraft(d => ({ ...d, annualFH: e.target.value }))}
                  style={{ width: "120px", padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                Annual cycles
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={draft.annualCy}
                  placeholder="e.g. 2100"
                  onChange={e => setDraft(d => ({ ...d, annualCy: e.target.value }))}
                  style={{ width: "120px", padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                />
              </label>
            </div>

            {/* Row 3: Per-component remaining units (optional, collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setDraft(d => ({ ...d, showComponents: !d.showComponents }))}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.75rem", color: "#475569", display: "flex", alignItems: "center", gap: "0.25rem" }}
              >
                {draft.showComponents ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Component remaining units <span style={{ color: "#94A3B8" }}>(optional)</span>
              </button>

              {draft.showComponents && (
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.625rem" }}>
                  {leaseRecord.mrComponents.map(comp => (
                    <label key={comp.component} style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                      {comp.component} <span style={{ fontWeight: 400, color: "#94A3B8" }}>({comp.rateBasis === "$/FH" ? "FH" : "cycles"})</span>
                      <input
                        type="number"
                        min={0}
                        max={comp.fullIntervalUnits}
                        value={draft.componentRemaining[comp.component] ?? ""}
                        placeholder={String(comp.remainingUnits)}
                        onChange={e => setDraft(d => ({
                          ...d,
                          componentRemaining: { ...d.componentRemaining, [comp.component]: e.target.value },
                        }))}
                        style={{ width: "110px", padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Save error */}
            {saveError && (
              <div style={{ fontSize: "0.75rem", color: "#B91C1C" }}>{saveError}</div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                style={{ padding: "0.375rem 0.875rem", background: "#002147", color: "#FFFFFF", border: "none", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {report && (
                <button
                  type="button"
                  onClick={() => { void clearReport(); setPanelOpen(false); }}
                  disabled={saving}
                  style={{ padding: "0.375rem 0.875rem", background: "transparent", color: "#B91C1C", border: "1px solid #FCA5A5", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                >
                  Reset to heuristic
                </button>
              )}
              <button
                type="button"
                onClick={() => { setPanelOpen(false); setSaveError(null); setDraft(report ? draftFromReport(report) : emptyDraft()); }}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "#94A3B8" }}
              >
                ✕ Close
              </button>
            </div>
          </div>
        )}
      </div>
```

- [ ] **Step 7: Update the "Monthly Accrual" column header to show LIVE pill**

Find the table header cell for "Monthly Accrual" (inside the `{["Component", "Current MR Balance", "Monthly Accrual", ...].map(...)}`). Replace the array with per-cell rendering for the "Monthly Accrual" header:

Change:
```typescript
{["Component", "Current MR Balance", "Monthly Accrual", "Next Event", ...].map((h) => (
  <th key={h} style={{ ... }}>{h}</th>
))}
```

To split out the "Monthly Accrual" cell:
```typescript
{["Component", "Current MR Balance", "Next Event", "Proj. Balance @ Event", "Event Cost (Heuristic)", "Shortfall / Surplus @ Event", "Proj. Balance @ EOL", "EOL Obligation", "EOL Position"].map((h) => (
  <th key={h} style={{ padding: "0.5rem 0.875rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
))}
```
And insert the "Monthly Accrual" th in the correct position (second column, between "Current MR Balance" and "Next Event"):

Actually, to keep this simple, just change the text of the "Monthly Accrual" entry in the existing array. The array currently maps strings to `<th>` elements. Instead of refactoring the whole thing, replace:
```typescript
{["Component", "Current MR Balance", "Monthly Accrual", "Next Event", ...].map((h) => (
  <th key={h} style={{ ... }}>{h}</th>
))}
```
with:
```typescript
{(["Component", "Current MR Balance", "Monthly Accrual", "Next Event", "Proj. Balance @ Event", "Event Cost (Heuristic)", "Shortfall / Surplus @ Event", "Proj. Balance @ EOL", "EOL Obligation", "EOL Position"] as const).map((h) => (
  <th key={h} style={{ padding: "0.5rem 0.875rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
    {h === "Monthly Accrual" && report
      ? <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          Monthly Accrual
          <span style={{ background: "#002147", color: "#fff", fontSize: "0.5625rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 5px" }}>LIVE</span>
        </span>
      : h}
  </th>
))}
```

- [ ] **Step 8: Update the methodology footnote**

Find (near the bottom of the component):
```typescript
      <div style={{ fontSize: "0.6875rem", color: "#94A3B8", borderTop: "1px solid #F1F5F9", paddingTop: "0.75rem", lineHeight: 1.7 }}>
        <strong>Assumptions:</strong> Heuristic event costs sourced from IATA MCTF & IAWG published cost ranges.
        Base projection assumes lessee continues MR payments at contracted rate for {monthsToEOL} months until EOL.
        Conservative projection assumes MR payments cease immediately (applicable to Stage 3 / distress review).
        EOL obligation = cost to restore aircraft to full-life condition at redelivery.
        Cirium MRO Forecast API adapter planned for Phase 3 to replace heuristics.
      </div>
```

Replace with:
```typescript
      <div style={{ fontSize: "0.6875rem", color: "#94A3B8", borderTop: "1px solid #F1F5F9", paddingTop: "0.75rem", lineHeight: 1.7 }}>
        <strong>Assumptions:</strong> Heuristic event costs sourced from IATA MCTF & IAWG published cost ranges.
        {report
          ? <> Utilisation sourced from servicer report dated {new Date(report.reportDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · Annual FH: {report.annualFH.toLocaleString()} · Annual cycles: {report.annualCy.toLocaleString()}.</>
          : <> Base utilisation: {aircraftType} fleet average ({TYPE_HEURISTICS[aircraftType]?.utilizationFH?.toLocaleString() ?? "N/A"} FH/yr, {TYPE_HEURISTICS[aircraftType]?.utilizationCy?.toLocaleString() ?? "N/A"} cy/yr).</>
        }
        {" "}Base projection assumes lessee continues MR payments at contracted rate for {monthsToEOL} months until EOL.
        Conservative projection assumes MR payments cease immediately (applicable to Stage 3 / distress review).
        EOL obligation = cost to restore aircraft to full-life condition at redelivery.
      </div>
```

- [ ] **Step 9: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit 2>&1 | grep -i "MaintenanceForecastTab\|useServicerReport"
```

Expected: no output.

- [ ] **Step 10: Run the full test suite**

```bash
npx vitest run
```

Expected: all existing tests pass, plus the 6 new `buildProjections` tests.

- [ ] **Step 11: Commit**

```bash
git add src/app/components/portfolio/MaintenanceForecastTab.tsx
git commit -m "feat: add live FH/cycle servicer report panel to MaintenanceForecastTab"
```

---

## Self-Review

**Spec coverage:**
- ✅ `servicer_reports` table with all columns — Task 1
- ✅ Unique constraint `(org_id, lease_id)` — Task 1
- ✅ `useServicerReport` with `report`, `loading`, `saving`, `saveReport`, `clearReport` — Task 4
- ✅ Optimistic update + rollback in `saveReport` — Task 4
- ✅ Optimistic null + rollback in `clearReport` — Task 4
- ✅ `UtilOverride` added to `buildProjections` — Task 3
- ✅ FH/cycle override — Task 3
- ✅ Per-component remaining units override — Task 3
- ✅ Collapsed banner: heuristic state vs live state — Task 5 Step 6
- ✅ Report date, annual FH, annual cycles fields — Task 5 Step 6
- ✅ Per-component remaining units (optional, collapsible) — Task 5 Step 6
- ✅ Save / Reset to heuristic / Close buttons — Task 5 Step 6
- ✅ LIVE pill on Monthly Accrual column header — Task 5 Step 7
- ✅ Methodology footnote updated — Task 5 Step 8
- ✅ Validation (date required, FH/cy bounds) — Task 5 Step 5
- ✅ Unit tests for `buildProjections` — Tasks 2 & 3

**No placeholders found.**

**Type consistency:**
- `ServicerReport.componentOverrides: Record<string, number>` → mapped to `UtilOverride.componentRemaining` inside the component ✅
- `useServicerReport` returns `ServicerReport | null` → `utilOverride` derived with `report.componentOverrides` ✅
- `DraftForm.componentRemaining: Record<string, string>` (strings for inputs) → converted to `Record<string, number>` in `handleSave` ✅
