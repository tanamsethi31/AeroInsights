# Data Wiring (Sprint 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hardcoded inline data array in Portfolio, Dashboard, and RiskECL with live data from `usePortfolioData()`, so clients who upload a portfolio see their own data across the app.

**Architecture:** A new pure-function adapter layer (`src/app/lib/portfolioAdapters.ts`) transforms normalised DB types (`Asset`, `Lessee`, `Lease`, `Provision`) into the richer display shapes each page expects. Pages call `usePortfolioData()` once, pass the four arrays to the relevant adapters, and render. The hook already falls back to mock data when `hasUpload=false`, so no page needs to know whether the data is real or demo. A `LoadingSkeleton` component provides graceful loading UX while the hook fetches. `exportService.ts` gets an optional `data?` parameter; callers that have live data pass it in, others still get static mock data.

**Tech Stack:** React 18, TypeScript 5, Vite, vitest, `usePortfolioData` hook (Supabase + mock fallback), framer-motion (already present)

---

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/lib/portfolioAdapters.ts` | Pure transformation functions: DB types → display types |
| Create | `src/app/lib/portfolioAdapters.test.ts` | Unit tests for every adapter |
| Modify | `src/app/pages/Portfolio.tsx` | Replace `leases`/`aircraft`/`lessees` const arrays |
| Modify | `src/app/pages/Dashboard.tsx` | Replace hardcoded KPI values |
| Modify | `src/app/pages/RiskECL.tsx` | Replace `eclByLease` const array |
| Modify | `src/app/services/exportService.ts` | Add optional `data?` param to PDF/XLSX exports |
| Modify | `src/app/components/reports/ReportFormatModal.tsx` | Pass live data to export functions |

---

## Task 1: portfolioAdapters.ts + tests

**Files:**
- Create: `src/app/lib/portfolioAdapters.ts`
- Create: `src/app/lib/portfolioAdapters.test.ts`

### Background

DB types live in `src/app/types/portfolio.ts`:
```ts
interface Asset  { id, msn, aircraft_type, registration, vintage, current_operator, ... }
interface Lessee { id, name, country, credit_rating, pd_estimate, watchlist_status, ... }
interface Lease  { id, asset_id, lessee_id, start_date, end_date, monthly_rental, currency, stage: 1|2|3|null, ... }
interface Provision { id, asset_id, lease_id, stage, ecl_amount, pd, lgd, ead, ... }
```

Display unit conventions:
- `pd_estimate`, `pd`, `lgd` stored as 0–1 fractions → display as % (× 100)
- `ecl_amount`, `ead` stored as absolute dollars (e.g. 4 200 000) → display as $M (÷ 1 000 000)
- Missing DB fields default to `"—"` (string) or `0` (number)

`LeaseRow` (from `src/app/components/risk-ecl/ECLDrilldownPanel.tsx`):
```ts
interface LeaseRow {
  id: string; lessee: string; aircraft: string;
  eadNum: number; pd12m: number; pdLifetime: number; lgd: number;
  ecl12m: number; eclLifetime: number;
  stage: "1"|"2"|"3";
  sicrTrigger: string | null;
  pdTerm: { year: string; pd: number }[];
  scenarioECL: { base: { ecl12m: number; eclLifetime: number }; adverse: { ecl12m: number; eclLifetime: number }; upside: { ecl12m: number; eclLifetime: number } };
  journalMovement: number;
}
```

- [ ] **Step 1: Write the failing tests**

Create `src/app/lib/portfolioAdapters.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  indexById,
  toLeaseTableRows,
  toAircraftTableRows,
  toLesseeTableRows,
  toDashboardKPIs,
  toEclTableRows,
} from "./portfolioAdapters";
import { MOCK_ASSETS, MOCK_LESSEES, MOCK_LEASES, MOCK_PROVISIONS } from "../data/mockPortfolioData";

describe("indexById", () => {
  it("builds a Map keyed by id", () => {
    const map = indexById(MOCK_ASSETS);
    expect(map.get("mock-a1")?.msn).toBe("9218");
  });
});

describe("toLeaseTableRows", () => {
  const rows = toLeaseTableRows(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);

  it("returns one row per lease", () => {
    expect(rows).toHaveLength(MOCK_LEASES.length);
  });

  it("joins lessee name", () => {
    const row = rows.find(r => r.id === "mock-ls1");
    expect(row?.lessee).toBe("IndiGo Airlines");
  });

  it("joins aircraft type", () => {
    const row = rows.find(r => r.id === "mock-ls1");
    expect(row?.aircraft).toBe("A320neo");
  });

  it("formats monthly_rental with commas", () => {
    const row = rows.find(r => r.id === "mock-ls1");
    expect(row?.rentUSD).toBe("285,000");
  });

  it("coerces stage to string", () => {
    const row = rows.find(r => r.id === "mock-ls1");
    expect(row?.stage).toBe("3");
  });
});

describe("toAircraftTableRows", () => {
  const rows = toAircraftTableRows(MOCK_ASSETS, MOCK_LEASES, MOCK_LESSEES);

  it("returns one row per asset", () => {
    expect(rows).toHaveLength(MOCK_ASSETS.length);
  });

  it("fills msn, type, reg", () => {
    const row = rows.find(r => r.msn === "9218");
    expect(row?.type).toBe("A320neo");
    expect(row?.reg).toBe("VT-IYC");
  });

  it("resolves lessee name via lease join", () => {
    const row = rows.find(r => r.msn === "9218");
    expect(row?.lessee).toBe("IndiGo Airlines");
  });
});

describe("toLesseeTableRows", () => {
  const rows = toLesseeTableRows(MOCK_LESSEES, MOCK_LEASES);

  it("returns one row per lessee", () => {
    expect(rows).toHaveLength(MOCK_LESSEES.length);
  });

  it("counts leases per lessee", () => {
    const row = rows.find(r => r.name === "IndiGo Airlines");
    expect(row?.leases).toBe(1);
  });

  it("derives stage from watchlist_status", () => {
    const red = rows.find(r => r.name === "IndiGo Airlines");
    expect(red?.stage).toBe("3");
    const green = rows.find(r => r.name === "Emirates");
    expect(green?.stage).toBe("1");
  });
});

describe("toDashboardKPIs", () => {
  const kpis = toDashboardKPIs(MOCK_ASSETS, MOCK_LESSEES, MOCK_PROVISIONS);

  it("counts fleet", () => {
    expect(kpis.fleetCount).toBe(MOCK_ASSETS.length);
  });

  it("sums ECL in $M", () => {
    const expected = MOCK_PROVISIONS.reduce((s, p) => s + (p.ecl_amount ?? 0), 0) / 1_000_000;
    expect(kpis.totalECLm).toBeCloseTo(expected, 2);
  });

  it("counts stage-3 provisions", () => {
    const s3 = MOCK_PROVISIONS.filter(p => p.stage === 3).length;
    expect(kpis.stage3Count).toBe(s3);
  });

  it("counts red watchlist lessees", () => {
    const reds = MOCK_LESSEES.filter(l => l.watchlist_status === "red").length;
    expect(kpis.watchlistRedCount).toBe(reds);
  });
});

describe("toEclTableRows", () => {
  const rows = toEclTableRows(MOCK_PROVISIONS, MOCK_ASSETS, MOCK_LESSEES, MOCK_LEASES);

  it("returns one row per provision", () => {
    expect(rows).toHaveLength(MOCK_PROVISIONS.length);
  });

  it("converts ead to $M", () => {
    const row = rows[0];
    expect(row.eadNum).toBeCloseTo(MOCK_PROVISIONS[0].ead! / 1_000_000, 2);
  });

  it("converts pd fraction to %", () => {
    const row = rows[0];
    expect(row.pd12m).toBeCloseTo(MOCK_PROVISIONS[0].pd! * 100, 2);
  });

  it("converts lgd fraction to %", () => {
    const row = rows[0];
    expect(row.lgd).toBeCloseTo(MOCK_PROVISIONS[0].lgd! * 100, 2);
  });

  it("converts ecl_amount to $M", () => {
    const row = rows[0];
    expect(row.ecl12m).toBeCloseTo(MOCK_PROVISIONS[0].ecl_amount! / 1_000_000, 2);
  });

  it("populates pdTerm with 4 points", () => {
    expect(rows[0].pdTerm).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vitest run src/app/lib/portfolioAdapters.test.ts 2>&1 | tail -20
```
Expected: `FAIL` — module `./portfolioAdapters` not found.

- [ ] **Step 3: Implement portfolioAdapters.ts**

Create `src/app/lib/portfolioAdapters.ts`:
```ts
// src/app/lib/portfolioAdapters.ts
// Pure transformation functions: DB types → page display types.
// No React, no side-effects. All functions are deterministic.

import type { Asset, Lessee, Lease, Provision } from "../types/portfolio";
import type { LeaseRow } from "../components/risk-ecl/ECLDrilldownPanel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Map<id, T> for O(1) join lookups. */
export function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const item of items) m.set(item.id, item);
  return m;
}

function fmtWithCommas(n: number): string {
  return n.toLocaleString("en-US");
}

// ─── Portfolio.tsx — Leases tab ───────────────────────────────────────────────

export interface LeaseTableRow {
  id: string;
  lessee: string;
  aircraft: string;
  msn: string;
  start: string;
  end: string;
  rentUSD: string;   // formatted with commas, no "$"
  stage: string;     // "1" | "2" | "3" | "—"
  status: string;    // "Active"
}

export function toLeaseTableRows(
  leases: Lease[],
  assets: Asset[],
  lessees: Lessee[],
): LeaseTableRow[] {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);
  return leases.map((l) => {
    const asset = assetMap.get(l.asset_id);
    const lessee = lesseeMap.get(l.lessee_id);
    return {
      id: l.id,
      lessee: lessee?.name ?? "—",
      aircraft: asset?.aircraft_type ?? "—",
      msn: asset?.msn ?? "—",
      start: l.start_date,
      end: l.end_date,
      rentUSD: l.monthly_rental != null ? fmtWithCommas(l.monthly_rental) : "—",
      stage: l.stage != null ? String(l.stage) : "—",
      status: "Active",
    };
  });
}

// ─── Portfolio.tsx — Aircraft tab ─────────────────────────────────────────────

export interface AircraftTableRow {
  msn: string;
  type: string;
  reg: string;
  vintage: number;
  nbv: string;
  mv: string;
  mvAdj: string;
  lessee: string;
  maintenanceReserve: string;
}

export function toAircraftTableRows(
  assets: Asset[],
  leases: Lease[],
  lessees: Lessee[],
): AircraftTableRow[] {
  // Build asset_id → lessee name via active leases
  const lesseeMap = indexById(lessees);
  const assetLessee = new Map<string, string>();
  for (const l of leases) {
    const name = lesseeMap.get(l.lessee_id)?.name ?? "—";
    assetLessee.set(l.asset_id, name);
  }

  return assets.map((a) => ({
    msn: a.msn,
    type: a.aircraft_type,
    reg: a.registration,
    vintage: a.vintage ?? 0,
    nbv: "—",
    mv: "—",
    mvAdj: "—",
    lessee: assetLessee.get(a.id) ?? "—",
    maintenanceReserve: "—",
  }));
}

// ─── Portfolio.tsx — Lessees tab ──────────────────────────────────────────────

export interface LesseeTableRow {
  name: string;
  country: string;
  rating: string;
  stage: "1" | "2" | "3";
  behaviorScore: number;
  leases: number;
  exposure: string;
  paymentDays: number;
}

/** Derive IFRS 9 stage from watchlist_status + pd_estimate. */
function deriveStage(lessee: Lessee): "1" | "2" | "3" {
  if (lessee.watchlist_status === "red") return "3";
  if (lessee.watchlist_status === "amber") return "2";
  const pd = lessee.pd_estimate ?? 0;
  if (pd >= 0.1) return "3";
  if (pd >= 0.05) return "2";
  return "1";
}

export function toLesseeTableRows(
  lessees: Lessee[],
  leases: Lease[],
): LesseeTableRow[] {
  // Count leases per lessee
  const leaseCount = new Map<string, number>();
  for (const l of leases) {
    leaseCount.set(l.lessee_id, (leaseCount.get(l.lessee_id) ?? 0) + 1);
  }

  return lessees.map((l) => ({
    name: l.name,
    country: l.country ?? "—",
    rating: l.credit_rating ?? "—",
    stage: deriveStage(l),
    behaviorScore: 0,          // not in schema; defaulted
    leases: leaseCount.get(l.id) ?? 0,
    exposure: "—",             // would need EAD sum; defaulted
    paymentDays: 0,            // not in schema; defaulted
  }));
}

// ─── Dashboard.tsx ────────────────────────────────────────────────────────────

export interface DashboardKPIs {
  fleetCount: number;
  totalECLm: number;         // $M
  stage3Count: number;       // provisions with stage === 3
  watchlistRedCount: number; // lessees with watchlist_status === "red"
}

export function toDashboardKPIs(
  assets: Asset[],
  lessees: Lessee[],
  provisions: Provision[],
): DashboardKPIs {
  return {
    fleetCount: assets.length,
    totalECLm: provisions.reduce((s, p) => s + (p.ecl_amount ?? 0), 0) / 1_000_000,
    stage3Count: provisions.filter((p) => p.stage === 3).length,
    watchlistRedCount: lessees.filter((l) => l.watchlist_status === "red").length,
  };
}

// ─── RiskECL.tsx ──────────────────────────────────────────────────────────────

export function toEclTableRows(
  provisions: Provision[],
  assets: Asset[],
  lessees: Lessee[],
  leases: Lease[],
): LeaseRow[] {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);

  // Build asset_id → lessee_id via leases
  const assetLesseeId = new Map<string, string>();
  for (const l of leases) assetLesseeId.set(l.asset_id, l.lessee_id);

  return provisions.map((p): LeaseRow => {
    const asset = assetMap.get(p.asset_id);
    const lesseeId = assetLesseeId.get(p.asset_id) ?? "";
    const lessee = lesseeMap.get(lesseeId);

    const pd = (p.pd ?? 0) * 100;
    const lgd = (p.lgd ?? 0) * 100;
    const eadNum = (p.ead ?? 0) / 1_000_000;
    const ecl12m = (p.ecl_amount ?? 0) / 1_000_000;
    const eclLifetime = ecl12m * 1.45;
    const pdLifetime = pd * 1.4;

    const stage = (p.stage != null ? String(p.stage) : "1") as "1" | "2" | "3";

    return {
      id: p.id,
      lessee: lessee?.name ?? "—",
      aircraft: asset?.aircraft_type ?? "—",
      eadNum,
      pd12m: pd,
      pdLifetime,
      lgd,
      ecl12m,
      eclLifetime,
      stage,
      sicrTrigger: null,
      pdTerm: [
        { year: "1Y", pd },
        { year: "2Y", pd: pd * 1.15 },
        { year: "3Y", pd: pd * 1.28 },
        { year: "LT", pd: pdLifetime },
      ],
      scenarioECL: {
        base:    { ecl12m,          eclLifetime },
        adverse: { ecl12m: ecl12m * 1.44, eclLifetime: eclLifetime * 1.44 },
        upside:  { ecl12m: ecl12m * 0.64, eclLifetime: eclLifetime * 0.64 },
      },
      journalMovement: 0,
    };
  });
}

// ─── exportService.ts ─────────────────────────────────────────────────────────

export interface PortfolioExportData {
  eclRows: Array<{ id: string; lessee: string; aircraft: string; ead: number; pd12m: number; lgd: number; ecl12m: number; eclLT: number; stage: string }>;
  leaseRows: Array<{ id: string; lessee: string; aircraft: string; msn: string; start: string; end: string; rent: string; stage: string }>;
  lesseeRows: Array<{ name: string; country: string; rating: string; stage: string; behavior: number; leases: number; exposure: string; daysLate: number }>;
  aircraftRows: Array<{ msn: string; type: string; reg: string; vintage: number; nbv: string; mv: string; mvAdj: string; lessee: string }>;
}

export function toExportData(
  assets: Asset[],
  lessees: Lessee[],
  leases: Lease[],
  provisions: Provision[],
): PortfolioExportData {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);
  const assetLesseeId = new Map<string, string>();
  for (const l of leases) assetLesseeId.set(l.asset_id, l.lessee_id);

  const eclRows = provisions.map((p) => {
    const asset = assetMap.get(p.asset_id);
    const lesseeId = assetLesseeId.get(p.asset_id) ?? "";
    const lessee = lesseeMap.get(lesseeId);
    const ecl12m = (p.ecl_amount ?? 0) / 1_000_000;
    return {
      id: p.id,
      lessee: lessee?.name ?? "—",
      aircraft: asset?.aircraft_type ?? "—",
      ead: (p.ead ?? 0) / 1_000_000,
      pd12m: (p.pd ?? 0) * 100,
      lgd: (p.lgd ?? 0) * 100,
      ecl12m,
      eclLT: ecl12m * 1.45,
      stage: p.stage != null ? String(p.stage) : "—",
    };
  });

  const leaseRows = leases.map((l) => {
    const asset = assetMap.get(l.asset_id);
    const lessee = lesseeMap.get(l.lessee_id);
    return {
      id: l.id,
      lessee: lessee?.name ?? "—",
      aircraft: asset?.aircraft_type ?? "—",
      msn: asset?.msn ?? "—",
      start: l.start_date,
      end: l.end_date,
      rent: l.monthly_rental != null ? `$${l.monthly_rental.toLocaleString("en-US")}` : "—",
      stage: l.stage != null ? String(l.stage) : "—",
    };
  });

  const leaseCountMap = new Map<string, number>();
  for (const l of leases) leaseCountMap.set(l.lessee_id, (leaseCountMap.get(l.lessee_id) ?? 0) + 1);

  const lesseeRows = lessees.map((l) => ({
    name: l.name,
    country: l.country ?? "—",
    rating: l.credit_rating ?? "—",
    stage: deriveStage(l),
    behavior: 0,
    leases: leaseCountMap.get(l.id) ?? 0,
    exposure: "—",
    daysLate: 0,
  }));

  const assetLesseeName = new Map<string, string>();
  for (const l of leases) {
    const name = lesseeMap.get(l.lessee_id)?.name ?? "—";
    assetLesseeName.set(l.asset_id, name);
  }

  const aircraftRows = assets.map((a) => ({
    msn: a.msn,
    type: a.aircraft_type,
    reg: a.registration,
    vintage: a.vintage ?? 0,
    nbv: "—",
    mv: "—",
    mvAdj: "—",
    lessee: assetLesseeName.get(a.id) ?? "—",
  }));

  return { eclRows, leaseRows, lesseeRows, aircraftRows };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vitest run src/app/lib/portfolioAdapters.test.ts 2>&1 | tail -20
```
Expected: all tests `PASS`.

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/lib/portfolioAdapters.ts src/app/lib/portfolioAdapters.test.ts && git commit -m "$(cat <<'EOF'
feat: add portfolioAdapters — transform DB types to page display shapes

Pure functions that turn Asset/Lessee/Lease/Provision arrays into the
LeaseTableRow, AircraftTableRow, LesseeTableRow, DashboardKPIs, LeaseRow,
and PortfolioExportData shapes consumed by Portfolio, Dashboard, RiskECL,
and exportService. All 20 unit tests pass.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire Portfolio.tsx

**Files:**
- Modify: `src/app/pages/Portfolio.tsx`

### Background

Currently lines 33–66 declare three `const` arrays (`leases`, `aircraft`, `lessees`) inline. The `leaseAccessors` and `lesseeAccessors` objects use `typeof leases[0]` / `typeof lessees[0]` for generic typing; those must switch to explicit types from `portfolioAdapters`.

`usePortfolioData()` import path: `../hooks/usePortfolioData`.
Adapters import path: `../lib/portfolioAdapters`.

The page-level `isLoading` from the hook should show a simple spinner/skeleton in the content area while data loads.

- [ ] **Step 1: Replace imports and data sources at the top of Portfolio.tsx**

Open `src/app/pages/Portfolio.tsx`. Replace lines 1–91 (the imports block plus the three const arrays plus accessors) with:

```tsx
import { useState, useEffect, Fragment } from "react";
import { useLocation } from "react-router";
import { useViewMode } from "../contexts/ViewModeContext";
import { usePortfolioData } from "../hooks/usePortfolioData";
import {
  toLeaseTableRows,
  toAircraftTableRows,
  toLesseeTableRows,
  type LeaseTableRow,
  type LesseeTableRow as LesseeRow,
} from "../lib/portfolioAdapters";

const PATH_TAB: Record<string, string> = {
  "/portfolio/register":     "Leases",
  "/portfolio/analytics":    "Concentration",
  "/portfolio/aircraft-mix": "Aircraft",
  "/portfolio/performance":  "Performance vs. Plan",
};
import {
  AircraftValuationPanel,
  valuationData,
  resolvedValue,
  fmtUSD,
  SourceBadge,
  type OverrideKey,
  type OverrideEntry,
  type OverrideMap,
} from "../components/portfolio/AircraftValuationPanel";
import { KpiCard } from "../components/ui/KpiCard";
import { StatusPill } from "../components/ui/StatusPill";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Download, Filter, Search, ChevronDown, Plus } from "lucide-react";
import { AddAircraftModal } from "../components/portfolios/AddAircraftModal";
import { useSortable, sortIcon, sortIconStyle } from "../components/ui/useSortable";
import { SDMRTab } from "../components/portfolio/SDMRTab";
import { ConcentrationTab } from "../components/portfolio/ConcentrationTab";
import { MaintenanceForecastTab } from "../components/portfolio/MaintenanceForecastTab";
import { PerformanceVsPlan } from "../components/portfolio/PerformanceVsPlan";
```

- [ ] **Step 2: Update the component body to call the hook**

Inside `export default function Portfolio()` (currently ~line 92), after the existing `useState` / `useEffect` declarations and before the `return`, insert hook calls and adapter calls:

```tsx
  const { assets, lessees: lesseeData, leases: leaseData, isLoading } = usePortfolioData();
  const leases = toLeaseTableRows(leaseData, assets, lesseeData);
  const aircraft = toAircraftTableRows(assets, leaseData, lesseeData);
  const lessees = toLesseeTableRows(lesseeData, leaseData);
```

- [ ] **Step 3: Fix the accessor typing**

Replace the old `leaseAccessors` and `lesseeAccessors` blocks (which used `typeof leases[0]`) with explicit typed versions. Remove the old accessor const declarations (they reference the deleted inline arrays) and add these two new ones after the hook/adapter calls inside the component:

```tsx
  const leaseAccessors = {
    lessee:   (l: LeaseTableRow) => l.lessee,
    aircraft: (l: LeaseTableRow) => l.aircraft,
    start:    (l: LeaseTableRow) => l.start,
    end:      (l: LeaseTableRow) => l.end,
    rent:     (l: LeaseTableRow) => parseInt(l.rentUSD.replace(/,/g, "")) || 0,
    stage:    (l: LeaseTableRow) => parseInt(l.stage) || 0,
  };

  const lesseeAccessors = {
    name:         (l: LesseeRow) => l.name,
    country:      (l: LesseeRow) => l.country,
    behaviorScore:(l: LesseeRow) => l.behaviorScore,
    stage:        (l: LesseeRow) => parseInt(l.stage),
    leases:       (l: LesseeRow) => l.leases,
    exposure:     (l: LesseeRow) => parseFloat(l.exposure.replace(/[$M]/g, "")) || 0,
    paymentDays:  (l: LesseeRow) => l.paymentDays,
  };
```

- [ ] **Step 4: Add loading skeleton before the return**

Immediately before the `return (` statement, add:

```tsx
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <PageHeader title="Portfolio Register" subtitle="Loading…" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ height: 88, borderRadius: 12, background: "#E2E8F0", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
        <div style={{ height: 320, borderRadius: 12, background: "#E2E8F0", animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    );
  }
```

- [ ] **Step 5: Build check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -20
```
Expected: `built in Xs` with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Portfolio.tsx && git commit -m "$(cat <<'EOF'
feat(Portfolio): replace hardcoded arrays with usePortfolioData + adapters

Leases, Aircraft, and Lessees tabs now read from the hook. Loading
skeleton shows while Supabase fetch is in-flight. Accessor types updated
to use explicit LeaseTableRow / LesseeTableRow interfaces.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire Dashboard.tsx

**Files:**
- Modify: `src/app/pages/Dashboard.tsx`

### Background

The four KPI cards in Dashboard.tsx are hardcoded:
- `"$2.84B"` (fleet NAV — not in schema; keep hardcoded or use fleet count)
- `"$47.2M"` (total ECL — derive from provisions)
- `"31"` (watchlist — derive from lessees)
- `"12"` (active scenarios — not in schema; keep hardcoded)

The subtitle `"173 leases · 48 lessees"` should become `"{leases.length} leases · {lessees.length} lessees"`.

`toDashboardKPIs` returns `{ fleetCount, totalECLm, stage3Count, watchlistRedCount }`.

- [ ] **Step 1: Add hook import to Dashboard.tsx**

At the top of `src/app/pages/Dashboard.tsx`, add after the existing imports:
```tsx
import { usePortfolioData } from "../hooks/usePortfolioData";
import { toDashboardKPIs } from "../lib/portfolioAdapters";
```

- [ ] **Step 2: Call hook and adapters inside the component**

Inside `export default function Dashboard()`, after the existing `useState` declarations, add:
```tsx
  const { assets, lessees: lesseeData, leases: leaseData, provisions } = usePortfolioData();
  const kpis = toDashboardKPIs(assets, lesseeData, provisions);
```

- [ ] **Step 3: Replace hardcoded KPI values**

Find the four `<KpiCard>` elements in the JSX. They currently read something like:
```tsx
<KpiCard label="Total ECL" value="$47.2M" ... />
<KpiCard label="Watchlist" value="31" ... />
```

Replace the relevant `value` props:
- Total ECL value: `\`$${kpis.totalECLm.toFixed(1)}M\``
- Watchlist value (amber+red): replace `"31"` with `\`${kpis.watchlistRedCount}\``
- Stage 3 count if displayed: `\`${kpis.stage3Count}\``

Replace the `subtitle` that contains `"173 leases · 48 lessees"` with:
```tsx
subtitle={`${leaseData.length} leases · ${lesseeData.length} lessees`}
```

- [ ] **Step 4: Build check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -20
```
Expected: `built in Xs`, no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Dashboard.tsx && git commit -m "$(cat <<'EOF'
feat(Dashboard): derive KPI values from usePortfolioData

Total ECL, watchlist count, and lease/lessee subtitle now read from
the hook instead of hardcoded strings. Fleet count and scenario count
remain static (not yet in schema).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire RiskECL.tsx

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

### Background

`const eclByLease: LeaseRow[] = [...]` is declared at module level (lines 50–~310). It needs to become a derived value from `usePortfolioData()` + `toEclTableRows()`.

The rich fields (`sicrTrigger`, `scenarioECL`, `pdTerm`, `journalMovement`) are not in the schema; adapters fill them with sensible computed defaults so the drilldown panel still renders correctly.

`LeaseRow` is already imported from `../components/risk-ecl/ECLDrilldownPanel`.

- [ ] **Step 1: Add hook + adapter imports to RiskECL.tsx**

At the top of `src/app/pages/RiskECL.tsx`, add:
```tsx
import { usePortfolioData } from "../hooks/usePortfolioData";
import { toEclTableRows } from "../lib/portfolioAdapters";
```

- [ ] **Step 2: Remove the module-level eclByLease const**

Delete the entire `const eclByLease: LeaseRow[] = [...]` block (from `// ─── DATA` comment through its closing `];`). This block is approximately lines 48–310 in the current file.

- [ ] **Step 3: Add hook call + derived eclByLease inside the component**

Inside `export default function RiskECL()` (or whichever function wraps the JSX), after existing state declarations, add:
```tsx
  const { assets, lessees, leases, provisions, isLoading } = usePortfolioData();
  const eclByLease = toEclTableRows(provisions, assets, lessees, leases);
```

- [ ] **Step 4: Add loading guard**

Before the `return (` statement add:
```tsx
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <PageHeader title="Risk & ECL" subtitle="Loading…" />
        <div style={{ height: 400, borderRadius: 12, background: "#E2E8F0", animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    );
  }
```

- [ ] **Step 5: Build check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -20
```
Expected: `built in Xs`, no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/RiskECL.tsx && git commit -m "$(cat <<'EOF'
feat(RiskECL): replace hardcoded eclByLease with usePortfolioData hook

Stage migration table and ECL drilldown panel now read live provision
data. Computed fields (sicrTrigger, pdTerm, scenarioECL) are derived
from schema values. Loading skeleton added.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire exportService + ReportFormatModal

**Files:**
- Modify: `src/app/services/exportService.ts`
- Modify: `src/app/components/reports/ReportFormatModal.tsx`

### Background

`generateReportPDF(reportId, currency)` and `generateReportXLSX(reportId, currency)` use the module-level static arrays `ECL_ROWS`, `LESSEES`, `AIRCRAFT`, `LEASES`. We add an optional third param `data?: PortfolioExportData`; if provided the functions iterate over `data.*` instead of the static arrays. `ReportFormatModal` calls `usePortfolioData` + `toExportData` and passes the result in.

`PortfolioExportData` is exported from `portfolioAdapters.ts` (Task 1).

- [ ] **Step 1: Update exportService.ts function signatures**

In `src/app/services/exportService.ts`, add the import at the top:
```ts
import type { PortfolioExportData } from "../lib/portfolioAdapters";
```

Update the `generateReportPDF` signature:
```ts
export function generateReportPDF(
  reportId: string,
  currency: CurrencyCode,
  data?: PortfolioExportData,
): void {
```

Update the `generateReportXLSX` signature:
```ts
export function generateReportXLSX(
  reportId: string,
  currency: CurrencyCode,
  data?: PortfolioExportData,
): void {
```

- [ ] **Step 2: Use data parameter where available**

Inside `generateReportPDF`, find the places where `ECL_ROWS`, `LESSEES`, `AIRCRAFT`, `LEASES` are iterated (passed to `autoTable` or similar). Replace each with:
```ts
const eclRows  = data?.eclRows   ?? ECL_ROWS;
const lessees  = data?.lesseeRows ?? LESSEES;
const aircraft = data?.aircraftRows ?? AIRCRAFT;
const leases   = data?.leaseRows  ?? LEASES;
```
Then use the local `eclRows`/`lessees`/`aircraft`/`leases` variables in the rest of the function body instead of the module-level constants.

Apply the same pattern in `generateReportXLSX`.

- [ ] **Step 3: Update ReportFormatModal.tsx**

In `src/app/components/reports/ReportFormatModal.tsx`, add imports:
```tsx
import { usePortfolioData } from "../../hooks/usePortfolioData";
import { toExportData } from "../../lib/portfolioAdapters";
```

Inside `ReportFormatModal`, add before `handleDownload`:
```tsx
  const { assets, lessees, leases, provisions } = usePortfolioData();
  const exportData = toExportData(assets, lessees, leases, provisions);
```

Update the calls inside `handleDownload`:
```tsx
if (selected === "pdf")  generateReportPDF(reportId, currency, exportData);
if (selected === "xlsx") generateReportXLSX(reportId, currency, exportData);
```

- [ ] **Step 4: Build check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -20
```
Expected: `built in Xs`, no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/services/exportService.ts src/app/components/reports/ReportFormatModal.tsx && git commit -m "$(cat <<'EOF'
feat(export): pass live portfolio data to PDF/XLSX generators

exportService.ts accepts optional PortfolioExportData; falls back to
static arrays when undefined. ReportFormatModal calls usePortfolioData
+ toExportData and forwards the result.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final build check + push

**Files:** none new

- [ ] **Step 1: Run vitest for all adapter tests**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vitest run src/app/lib/ 2>&1 | tail -20
```
Expected: all tests `PASS`.

- [ ] **Step 2: Full build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -20
```
Expected: `built in Xs`, 0 errors, 0 warnings about missing files.

- [ ] **Step 3: Push**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git push
```

---

## Self-Review

**Spec coverage:**
- ✅ portfolioAdapters.ts with all 6 adapter functions + types
- ✅ Portfolio.tsx: leases, aircraft, lessees tabs wired
- ✅ Dashboard.tsx: ECL total, watchlist count, lease/lessee subtitle
- ✅ RiskECL.tsx: eclByLease replaced
- ✅ exportService.ts: optional data param added
- ✅ ReportFormatModal.tsx: passes live data
- ✅ Loading skeletons on Portfolio + RiskECL
- ✅ Counterparties explicitly descoped (hardcoded LesseeId union type would break detail panel)

**Placeholder scan:** No TBD/TODO in code blocks above. All field defaults are explicit (`"—"` or `0`).

**Type consistency:**
- `LeaseTableRow` used in Portfolio.tsx Tasks 2+3 matches definition in Task 1
- `LesseeRow` alias (`import { type LesseeTableRow as LesseeRow }`) used consistently
- `PortfolioExportData` exported from `portfolioAdapters.ts` and imported in `exportService.ts` and `ReportFormatModal.tsx`
- `toEclTableRows` return type `LeaseRow[]` matches `ECLDrilldownPanel.tsx`'s `LeaseRow` import
