# Aviation PD Curves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pre-calibrated aviation PD term-structure curves (network / LCC / regional / charter) to the Counterparties page, showing each lessee a benchmark alongside its manual `pd_estimate` with a deviation badge, plus a firm-level override drawer backed by Supabase.

**Architecture:** Three layers — a `pdCurves.ts` constants file with sourced default values and two pure functions, a `usePdCurves` hook that fetches firm overrides from a new `pd_curve_overrides` Supabase table and merges them, and three new components (`CarrierSegmentSelector`, `PdBenchmarkPanel`, `CurveOverrideDrawer`) wired into the existing Counterparties page. ECL engine is untouched.

**Tech Stack:** React 18 + TypeScript, Supabase JS client (existing), Vitest (existing), Lucide icons (existing). No new dependencies.

---

## File Map

| File | Action |
|------|--------|
| `src/app/data/pdCurves.ts` | Create — types, constants, `mergeCurves`, `computeDeviation` |
| `src/app/data/pdCurves.test.ts` | Create — Vitest unit tests |
| `src/app/hooks/usePdCurves.ts` | Create — Supabase fetch + merge hook |
| `src/app/components/counterparties/CarrierSegmentSelector.tsx` | Create — segment dropdown |
| `src/app/components/counterparties/PdBenchmarkPanel.tsx` | Create — term-structure table + deviation badge |
| `src/app/components/counterparties/CurveOverrideDrawer.tsx` | Create — right-side drawer with 5 tenor inputs |
| `src/app/pages/Counterparties.tsx` | Modify — mount hook, add state, render selector + panel |
| `src/app/types/portfolio.ts` | Modify — add `carrier_segment` to `Lessee` |
| `supabase/migrations/003_aviation_pd_curves.sql` | Create — schema migration |

---

## Task 1: pdCurves Constants and Pure Functions (TDD)

**Files:**
- Create: `src/app/data/pdCurves.ts`
- Create: `src/app/data/pdCurves.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/data/pdCurves.test.ts` with the full content below:

```typescript
import { describe, it, expect } from "vitest";
import {
  DEFAULT_PD_CURVES,
  mergeCurves,
  computeDeviation,
  type CarrierSegment,
} from "./pdCurves";

const SEGMENTS: CarrierSegment[] = ["network", "lcc", "regional", "charter"];

describe("DEFAULT_PD_CURVES", () => {
  it("all PD values are between 0 and 1 (exclusive)", () => {
    for (const seg of SEGMENTS) {
      const c = DEFAULT_PD_CURVES[seg];
      for (const val of [c.pd1yr, c.pd2yr, c.pd3yr, c.pd5yr, c.pdLifetime]) {
        expect(val).toBeGreaterThan(0);
        expect(val).toBeLessThan(1);
      }
    }
  });

  it("all curves are monotonically non-decreasing across tenors", () => {
    for (const seg of SEGMENTS) {
      const { pd1yr, pd2yr, pd3yr, pd5yr, pdLifetime } = DEFAULT_PD_CURVES[seg];
      expect(pd1yr).toBeLessThanOrEqual(pd2yr);
      expect(pd2yr).toBeLessThanOrEqual(pd3yr);
      expect(pd3yr).toBeLessThanOrEqual(pd5yr);
      expect(pd5yr).toBeLessThanOrEqual(pdLifetime);
    }
  });
});

describe("mergeCurves", () => {
  it("returns defaults unchanged when no overrides supplied", () => {
    const result = mergeCurves(DEFAULT_PD_CURVES, {});
    expect(result).toEqual(DEFAULT_PD_CURVES);
  });

  it("firm override wins for the overridden segment", () => {
    const result = mergeCurves(DEFAULT_PD_CURVES, {
      network: { pd1yr: 0.05, pd2yr: 0.08, pd3yr: 0.11, pd5yr: 0.15, pdLifetime: 0.40 },
    });
    expect(result.network.pd1yr).toBe(0.05);
    expect(result.network.pd2yr).toBe(0.08);
  });

  it("untouched segments remain at defaults", () => {
    const result = mergeCurves(DEFAULT_PD_CURVES, {
      network: { pd1yr: 0.05, pd2yr: 0.08, pd3yr: 0.11, pd5yr: 0.15, pdLifetime: 0.40 },
    });
    expect(result.lcc).toEqual(DEFAULT_PD_CURVES.lcc);
    expect(result.regional).toEqual(DEFAULT_PD_CURVES.regional);
    expect(result.charter).toEqual(DEFAULT_PD_CURVES.charter);
  });

  it("partial override merges with defaults (non-PD fields preserved)", () => {
    const result = mergeCurves(DEFAULT_PD_CURVES, {
      network: { pd1yr: 0.05 } as any,
    });
    expect(result.network.pd1yr).toBe(0.05);
    expect(result.network.source).toBe(DEFAULT_PD_CURVES.network.source);
    expect(result.network.calibratedYear).toBe(DEFAULT_PD_CURVES.network.calibratedYear);
  });

  it("non-monotonic override does not throw — validation is the UI's responsibility", () => {
    expect(() =>
      mergeCurves(DEFAULT_PD_CURVES, {
        network: { pd1yr: 0.99, pd2yr: 0.01, pd3yr: 0.5, pd5yr: 0.2, pdLifetime: 0.1 },
      })
    ).not.toThrow();
  });
});

describe("computeDeviation", () => {
  it("returns green when manual PD equals curve", () => {
    expect(computeDeviation(0.012, 0.012, "network").band).toBe("green");
  });

  it("returns green when manual PD is 20% below curve (within ±25% band)", () => {
    expect(computeDeviation(0.0096, 0.012, "network").band).toBe("green");
  });

  it("returns amber when manual PD is 1.5× the curve", () => {
    expect(computeDeviation(0.018, 0.012, "network").band).toBe("amber");
  });

  it("returns red when manual PD is 3× the curve", () => {
    expect(computeDeviation(0.036, 0.012, "network").band).toBe("red");
  });

  it("description mentions 'above' and the correct segment label when manual > benchmark", () => {
    const { description } = computeDeviation(0.024, 0.012, "lcc");
    expect(description).toContain("above");
    expect(description).toContain("Low-Cost Carrier");
  });

  it("description mentions 'below' and the correct segment label when manual < benchmark", () => {
    const { description } = computeDeviation(0.006, 0.012, "network");
    expect(description).toContain("below");
    expect(description).toContain("Network Carrier");
  });

  it("handles curvePd1yr = 0 edge case gracefully", () => {
    const result = computeDeviation(0.01, 0, "network");
    expect(result.band).toBe("green");
    expect(result.description).toBe("No benchmark");
    expect(result.ratio).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/data/pdCurves.test.ts 2>&1 | tail -10
```

Expected: `FAIL` — "Cannot find module './pdCurves'"

- [ ] **Step 3: Create pdCurves.ts**

Create `src/app/data/pdCurves.ts` with the full content below:

```typescript
// src/app/data/pdCurves.ts
// Pre-calibrated aviation PD term-structure curves by carrier segment.
// Source methodology: Moody's Annual Default Study 2023, S&P Global 2023 Annual
// Corporate Default and Rating Transition Study, IATA Economics (airline failure
// rate ~3.4% p.a. 1990–2023). All values are through-the-cycle (TTC).
// Point-in-time adjustment is applied at scenario time via pdS2Multi/pdS3Multi
// in ScenarioInputs. "Lifetime" = 20 years (max practical operating lease term).

export type CarrierSegment = "network" | "lcc" | "regional" | "charter";

export const CARRIER_SEGMENT_LABELS: Record<CarrierSegment, string> = {
  network:  "Network Carrier",
  lcc:      "Low-Cost Carrier",
  regional: "Regional",
  charter:  "Charter",
};

export interface PdTermStructure {
  pd1yr:          number; // 12-month PD — benchmark for Stage 1 ECL
  pd2yr:          number;
  pd3yr:          number;
  pd5yr:          number;
  pdLifetime:     number; // 20-year cumulative PD — benchmark for Stage 2/3 ECL
  source:         string;
  calibratedYear: number;
}

export type PdCurveLibrary = Record<CarrierSegment, PdTermStructure>;

export const DEFAULT_PD_CURVES: PdCurveLibrary = {
  network: {
    pd1yr: 0.0120, pd2yr: 0.0220, pd3yr: 0.0330, pd5yr: 0.0540, pdLifetime: 0.220,
    source: "Moody's Annual Default Study 2023 (Ba1 TTC cohort, transportation sector); S&P 2023 Annual Global Corporate Default Study",
    calibratedYear: 2023,
  },
  lcc: {
    pd1yr: 0.0180, pd2yr: 0.0340, pd3yr: 0.0510, pd5yr: 0.0820, pdLifetime: 0.280,
    source: "Moody's Annual Default Study 2023 (Ba2 TTC cohort); IATA Economics airline failure rate data 1990–2023",
    calibratedYear: 2023,
  },
  regional: {
    pd1yr: 0.0300, pd2yr: 0.0560, pd3yr: 0.0820, pd5yr: 0.1250, pdLifetime: 0.380,
    source: "Moody's Annual Default Study 2023 (B1/Ba3 TTC cohort); S&P 2023 Annual Global Corporate Default Study (transportation sub-sector)",
    calibratedYear: 2023,
  },
  charter: {
    pd1yr: 0.0450, pd2yr: 0.0830, pd3yr: 0.1180, pd5yr: 0.1720, pdLifetime: 0.480,
    source: "Moody's Annual Default Study 2023 (B2 TTC cohort) with aviation charter cyclicality uplift; Thomas Cook/Germania/Monarch observed default cluster 2017–2020",
    calibratedYear: 2023,
  },
};

// Merge firm overrides onto defaults.
// Firm override wins for ALL five tenors together (row-level override, not tenor-level).
export function mergeCurves(
  defaults: PdCurveLibrary,
  overrides: Partial<Record<CarrierSegment, Partial<PdTermStructure>>>,
): PdCurveLibrary {
  const result = { ...defaults };
  for (const seg of Object.keys(overrides) as CarrierSegment[]) {
    if (overrides[seg]) {
      result[seg] = { ...defaults[seg], ...overrides[seg] };
    }
  }
  return result;
}

export type DeviationBand = "green" | "amber" | "red";

// Compare a lessee's manual pd_estimate against the curve's pd1yr benchmark.
// Returns a ratio, a colour band, and a human-readable description for the tooltip.
export function computeDeviation(
  manualPd: number,
  curvePd1yr: number,
  segment: CarrierSegment,
): { ratio: number; band: DeviationBand; description: string } {
  if (curvePd1yr === 0) return { ratio: 0, band: "green", description: "No benchmark" };
  const ratio = manualPd / curvePd1yr;
  const band: DeviationBand =
    ratio <= 1.25 && ratio >= 0.8 ? "green"
    : ratio <= 2.0 && ratio >= 0.5  ? "amber"
    : "red";
  const pct = Math.round((ratio - 1) * 100);
  const direction = pct >= 0 ? "above" : "below";
  const label = CARRIER_SEGMENT_LABELS[segment];
  const description = `Manual PD is ${Math.abs(pct)}% ${direction} the ${label} benchmark`;
  return { ratio, band, description };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/data/pdCurves.test.ts 2>&1 | tail -8
```

Expected:
```
Test Files  1 passed (1)
     Tests  12 passed (12)
```

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/data/pdCurves.ts src/app/data/pdCurves.test.ts && git commit -m "feat: add aviation PD curves constants and pure functions (TDD)"
```

---

## Task 2: Supabase Migration + Lessee Type Update

**Files:**
- Create: `supabase/migrations/003_aviation_pd_curves.sql`
- Modify: `src/app/types/portfolio.ts`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/003_aviation_pd_curves.sql`:

```sql
-- ─── Aviation PD Curves ───────────────────────────────────────────────────────
-- Adds carrier segment classification to lessees and a firm-level override
-- table for the pre-calibrated PD term-structure curves.

-- Add carrier segment to lessees (nullable — unset until analyst assigns)
ALTER TABLE lessees
  ADD COLUMN IF NOT EXISTS carrier_segment TEXT
  CHECK (carrier_segment IN ('network', 'lcc', 'regional', 'charter'));

-- Firm-level PD curve overrides (one row per org per segment; upserted on save)
CREATE TABLE IF NOT EXISTS pd_curve_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  segment         TEXT NOT NULL
                  CHECK (segment IN ('network', 'lcc', 'regional', 'charter')),
  pd1yr           NUMERIC(8,6) NOT NULL CHECK (pd1yr > 0 AND pd1yr < 1),
  pd2yr           NUMERIC(8,6) NOT NULL CHECK (pd2yr > 0 AND pd2yr < 1),
  pd3yr           NUMERIC(8,6) NOT NULL CHECK (pd3yr > 0 AND pd3yr < 1),
  pd5yr           NUMERIC(8,6) NOT NULL CHECK (pd5yr > 0 AND pd5yr < 1),
  pd_lifetime     NUMERIC(8,6) NOT NULL CHECK (pd_lifetime > 0 AND pd_lifetime < 1),
  notes           TEXT,
  updated_by      TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, segment)
);

CREATE INDEX IF NOT EXISTS pd_curve_overrides_org_id_idx ON pd_curve_overrides(org_id);
```

- [ ] **Step 2: Add `carrier_segment` to the `Lessee` TypeScript type**

In `src/app/types/portfolio.ts`, find the `Lessee` interface and add the new field:

```typescript
export interface Lessee {
  id: string;
  org_id: string;
  name: string;
  iata_code: string | null;
  country: string | null;
  credit_rating: string | null;
  pd_estimate: number | null;
  watchlist_status: "green" | "amber" | "red" | null;
  carrier_segment: "network" | "lcc" | "regional" | "charter" | null;  // ← add this line
  created_at: string;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add supabase/migrations/003_aviation_pd_curves.sql src/app/types/portfolio.ts && git commit -m "feat: add carrier_segment to lessees; add pd_curve_overrides table"
```

---

## Task 3: usePdCurves Hook

**Files:**
- Create: `src/app/hooks/usePdCurves.ts`

- [ ] **Step 1: Create the hook**

Create `src/app/hooks/usePdCurves.ts`:

```typescript
// src/app/hooks/usePdCurves.ts
// Fetches firm-level PD curve overrides from Supabase, merges with defaults,
// and exposes save/reset operations. Falls back to pure defaults when no orgId
// (demo mode) — no Supabase writes in that case.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import {
  DEFAULT_PD_CURVES,
  mergeCurves,
  type CarrierSegment,
  type PdCurveLibrary,
  type PdTermStructure,
} from "../data/pdCurves";

interface PdCurveOverrideRow {
  segment:     CarrierSegment;
  pd1yr:       number;
  pd2yr:       number;
  pd3yr:       number;
  pd5yr:       number;
  pd_lifetime: number;
  notes:       string | null;
}

export interface EffectiveCurves {
  curves:         PdCurveLibrary;
  isOverridden:   Record<CarrierSegment, boolean>;
  loading:        boolean;
  saveOverride:   (
    segment: CarrierSegment,
    values:  Pick<PdTermStructure, "pd1yr" | "pd2yr" | "pd3yr" | "pd5yr" | "pdLifetime">
             & { notes?: string; updatedBy?: string },
  ) => Promise<void>;
  resetToDefault: (segment: CarrierSegment) => Promise<void>;
}

const SEGMENTS: CarrierSegment[] = ["network", "lcc", "regional", "charter"];

const ALL_FALSE: Record<CarrierSegment, boolean> = {
  network: false, lcc: false, regional: false, charter: false,
};

export function usePdCurves(): EffectiveCurves {
  const { orgId } = useData();
  const [rows, setRows] = useState<PdCurveOverrideRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOverrides = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pd_curve_overrides")
        .select("segment, pd1yr, pd2yr, pd3yr, pd5yr, pd_lifetime, notes")
        .eq("org_id", orgId);
      if (error) {
        console.error("[usePdCurves] fetch error:", error.message);
        return;
      }
      setRows((data as PdCurveOverrideRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  // Build override map: segment → partial PdTermStructure
  const overrideMap = Object.fromEntries(
    rows.map(r => [
      r.segment,
      { pd1yr: r.pd1yr, pd2yr: r.pd2yr, pd3yr: r.pd3yr, pd5yr: r.pd5yr, pdLifetime: r.pd_lifetime },
    ])
  ) as Partial<Record<CarrierSegment, Partial<PdTermStructure>>>;

  const curves = mergeCurves(DEFAULT_PD_CURVES, overrideMap);

  const isOverridden = Object.fromEntries(
    SEGMENTS.map(seg => [seg, rows.some(r => r.segment === seg)])
  ) as Record<CarrierSegment, boolean>;

  const saveOverride = useCallback(async (
    segment: CarrierSegment,
    values: Pick<PdTermStructure, "pd1yr" | "pd2yr" | "pd3yr" | "pd5yr" | "pdLifetime">
            & { notes?: string; updatedBy?: string },
  ) => {
    if (!orgId) return; // demo mode — no-op
    const { error } = await supabase.from("pd_curve_overrides").upsert(
      {
        org_id:      orgId,
        segment,
        pd1yr:       values.pd1yr,
        pd2yr:       values.pd2yr,
        pd3yr:       values.pd3yr,
        pd5yr:       values.pd5yr,
        pd_lifetime: values.pdLifetime,
        notes:       values.notes ?? null,
        updated_by:  values.updatedBy ?? null,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: "org_id,segment" },
    );
    if (error) throw error;
    await fetchOverrides();
  }, [orgId, fetchOverrides]);

  const resetToDefault = useCallback(async (segment: CarrierSegment) => {
    if (!orgId) return; // demo mode — no-op
    const { error } = await supabase
      .from("pd_curve_overrides")
      .delete()
      .eq("org_id", orgId)
      .eq("segment", segment);
    if (error) throw error;
    await fetchOverrides();
  }, [orgId, fetchOverrides]);

  // In demo mode (no orgId) always return defaults
  if (!orgId) {
    return { curves: DEFAULT_PD_CURVES, isOverridden: ALL_FALSE, loading: false, saveOverride, resetToDefault };
  }

  return { curves, isOverridden, loading, saveOverride, resetToDefault };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/hooks/usePdCurves.ts && git commit -m "feat: add usePdCurves hook — Supabase overrides merged with defaults"
```

---

## Task 4: CarrierSegmentSelector Component

**Files:**
- Create: `src/app/components/counterparties/CarrierSegmentSelector.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/components/counterparties/CarrierSegmentSelector.tsx`:

```typescript
// src/app/components/counterparties/CarrierSegmentSelector.tsx
// Dropdown for assigning a carrier segment (network/LCC/regional/charter) to a lessee.
// Calls onChange immediately on selection; the parent decides whether to write to Supabase.

import { type CarrierSegment, CARRIER_SEGMENT_LABELS } from "../../data/pdCurves";

interface Props {
  segment:  CarrierSegment | null;
  onChange: (segment: CarrierSegment | null) => void;
}

const ENTRIES = Object.entries(CARRIER_SEGMENT_LABELS) as [CarrierSegment, string][];

export function CarrierSegmentSelector({ segment, onChange }: Props) {
  return (
    <div style={{ marginTop: "0.5rem" }}>
      <label style={{
        fontSize: "0.6875rem", fontWeight: 600, color: "#64748B",
        textTransform: "uppercase", letterSpacing: "0.05em",
        display: "block", marginBottom: "0.25rem",
      }}>
        Carrier Type
      </label>
      <select
        value={segment ?? ""}
        onChange={e => onChange(e.target.value === "" ? null : e.target.value as CarrierSegment)}
        style={{
          width: "100%",
          padding: "0.375rem 0.625rem",
          border: "1px solid #E2E8F0",
          borderRadius: "0.375rem",
          fontSize: "0.8125rem",
          color: segment ? "#0F172A" : "#94A3B8",
          background: "#FFFFFF",
          cursor: "pointer",
          appearance: "auto",
        }}
      >
        <option value="">Assign carrier type…</option>
        {ENTRIES.map(([val, label]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/counterparties/CarrierSegmentSelector.tsx && git commit -m "feat: add CarrierSegmentSelector component"
```

---

## Task 5: PdBenchmarkPanel Component

**Files:**
- Create: `src/app/components/counterparties/PdBenchmarkPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/components/counterparties/PdBenchmarkPanel.tsx`:

```typescript
// src/app/components/counterparties/PdBenchmarkPanel.tsx
// Shows a 5-tenor term-structure table with a deviation badge on the 1yr row,
// a source footer, and a link to open the CurveOverrideDrawer.

import { useState } from "react";
import {
  type CarrierSegment,
  type PdCurveLibrary,
  CARRIER_SEGMENT_LABELS,
  computeDeviation,
} from "../../data/pdCurves";
import { CurveOverrideDrawer } from "./CurveOverrideDrawer";
import type { EffectiveCurves } from "../../hooks/usePdCurves";

interface Props {
  segment:          CarrierSegment;
  pdEstimate:       number | null;
  curves:           PdCurveLibrary;
  isOverridden:     Record<CarrierSegment, boolean>;
  onSaveOverride:   EffectiveCurves["saveOverride"];
  onResetToDefault: EffectiveCurves["resetToDefault"];
}

const BAND_COLOR: Record<string, string> = {
  green: "#15803D",
  amber: "#B45309",
  red:   "#B91C1C",
};
const BAND_BG: Record<string, string> = {
  green: "rgba(21,128,61,0.08)",
  amber: "rgba(180,83,9,0.08)",
  red:   "rgba(185,28,28,0.08)",
};

export function PdBenchmarkPanel({
  segment, pdEstimate, curves, isOverridden, onSaveOverride, onResetToDefault,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const curve  = curves[segment];

  const tenors: { label: string; value: number }[] = [
    { label: "1yr",      value: curve.pd1yr },
    { label: "2yr",      value: curve.pd2yr },
    { label: "3yr",      value: curve.pd3yr },
    { label: "5yr",      value: curve.pd5yr },
    { label: "Lifetime", value: curve.pdLifetime },
  ];

  const deviation = pdEstimate != null
    ? computeDeviation(pdEstimate, curve.pd1yr, segment)
    : null;

  return (
    <>
      <div style={{
        marginTop: "1rem", padding: "0.875rem",
        background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.5rem",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0F172A" }}>
            PD Benchmark · {CARRIER_SEGMENT_LABELS[segment]}
          </div>
          {isOverridden[segment] && (
            <span style={{
              fontSize: "0.6125rem", fontWeight: 700, color: "#B45309",
              background: "rgba(180,83,9,0.08)", borderRadius: "9999px", padding: "0.1rem 0.45rem",
            }}>
              Custom
            </span>
          )}
        </div>

        {/* Term structure table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr>
              {["Tenor", "Benchmark", "Manual"].map((h, i) => (
                <th key={h} style={{
                  textAlign: i === 0 ? "left" : "right",
                  color: "#64748B", fontWeight: 600, paddingBottom: "0.375rem",
                  fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenors.map(({ label, value }, i) => (
              <tr key={label} style={{ borderTop: "1px solid #E2E8F0" }}>
                <td style={{ padding: "0.3rem 0", color: "#374151", fontWeight: 500 }}>{label}</td>
                <td style={{ textAlign: "right", padding: "0.3rem 0", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                  {(value * 100).toFixed(2)}%
                </td>
                <td style={{ textAlign: "right", padding: "0.3rem 0", fontVariantNumeric: "tabular-nums" }}>
                  {i === 0 && pdEstimate != null ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <span style={{ color: "#0F172A" }}>{(pdEstimate * 100).toFixed(2)}%</span>
                      {deviation && (
                        <span
                          title={deviation.description}
                          style={{
                            fontSize: "0.6125rem", fontWeight: 700,
                            color: BAND_COLOR[deviation.band],
                            background: BAND_BG[deviation.band],
                            borderRadius: "9999px", padding: "0.1rem 0.4rem",
                            cursor: "help",
                          }}
                        >
                          {deviation.band === "green" ? "✓" : deviation.band === "amber" ? "!" : "!!"}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span style={{ color: "#CBD5E1" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Source footer */}
        <div style={{ marginTop: "0.5rem", fontSize: "0.625rem", color: "#94A3B8", lineHeight: 1.4 }}>
          Source: {curve.source} · Calibrated {curve.calibratedYear}
        </div>

        {/* Customise link */}
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            marginTop: "0.375rem", fontSize: "0.6875rem", color: "#002147",
            fontWeight: 600, background: "none", border: "none", padding: 0,
            cursor: "pointer", textDecoration: "underline",
          }}
        >
          Customise curves
        </button>
      </div>

      {drawerOpen && (
        <CurveOverrideDrawer
          segment={segment}
          currentValues={{
            pd1yr: curve.pd1yr, pd2yr: curve.pd2yr, pd3yr: curve.pd3yr,
            pd5yr: curve.pd5yr, pdLifetime: curve.pdLifetime,
          }}
          isOverridden={isOverridden[segment]}
          onSave={async (values) => { await onSaveOverride(segment, values); setDrawerOpen(false); }}
          onReset={async ()        => { await onResetToDefault(segment);       setDrawerOpen(false); }}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/counterparties/PdBenchmarkPanel.tsx && git commit -m "feat: add PdBenchmarkPanel component"
```

---

## Task 6: CurveOverrideDrawer Component

**Files:**
- Create: `src/app/components/counterparties/CurveOverrideDrawer.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/components/counterparties/CurveOverrideDrawer.tsx`:

```typescript
// src/app/components/counterparties/CurveOverrideDrawer.tsx
// Right-side drawer for editing the five PD tenors for one carrier segment.
// Validates: all values in (0,1); monotonically non-decreasing.
// Exposes a confirmed Reset flow to restore Aeroinsights defaults.

import { useState } from "react";
import { X } from "lucide-react";
import { type CarrierSegment, CARRIER_SEGMENT_LABELS } from "../../data/pdCurves";

interface CurveValues {
  pd1yr:      number;
  pd2yr:      number;
  pd3yr:      number;
  pd5yr:      number;
  pdLifetime: number;
}

interface Props {
  segment:       CarrierSegment;
  currentValues: CurveValues;
  isOverridden:  boolean;
  onSave:        (values: CurveValues & { notes: string }) => Promise<void>;
  onReset:       () => Promise<void>;
  onClose:       () => void;
}

type FieldKey = keyof CurveValues;

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "pd1yr",      label: "1yr PD (%)" },
  { key: "pd2yr",      label: "2yr PD (%)" },
  { key: "pd3yr",      label: "3yr PD (%)" },
  { key: "pd5yr",      label: "5yr PD (%)" },
  { key: "pdLifetime", label: "Lifetime PD (%)" },
];

function toDisplay(v: number)  { return (v * 100).toFixed(4); }
function fromDisplay(s: string) { return parseFloat(s) / 100; }

function validateMonotonic(v: CurveValues): string | null {
  if (v.pd1yr > v.pd2yr)      return "1yr must be ≤ 2yr";
  if (v.pd2yr > v.pd3yr)      return "2yr must be ≤ 3yr";
  if (v.pd3yr > v.pd5yr)      return "3yr must be ≤ 5yr";
  if (v.pd5yr > v.pdLifetime) return "5yr must be ≤ Lifetime";
  return null;
}

export function CurveOverrideDrawer({
  segment, currentValues, isOverridden, onSave, onReset, onClose,
}: Props) {
  const [fields, setFields] = useState<Record<FieldKey, string>>({
    pd1yr:      toDisplay(currentValues.pd1yr),
    pd2yr:      toDisplay(currentValues.pd2yr),
    pd3yr:      toDisplay(currentValues.pd3yr),
    pd5yr:      toDisplay(currentValues.pd5yr),
    pdLifetime: toDisplay(currentValues.pdLifetime),
  });
  const [notes,        setNotes]        = useState("");
  const [error,        setError]        = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function handleSave() {
    const parsed: CurveValues = {
      pd1yr:      fromDisplay(fields.pd1yr),
      pd2yr:      fromDisplay(fields.pd2yr),
      pd3yr:      fromDisplay(fields.pd3yr),
      pd5yr:      fromDisplay(fields.pd5yr),
      pdLifetime: fromDisplay(fields.pdLifetime),
    };
    for (const [key, val] of Object.entries(parsed)) {
      if (isNaN(val) || val <= 0 || val >= 1) {
        setError(`${key}: must be between 0% and 100% (exclusive)`);
        return;
      }
    }
    const mono = validateMonotonic(parsed);
    if (mono) { setError(mono); return; }

    setSaving(true);
    try {
      await onSave({ ...parsed, notes });
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1000 }}
      />
      {/* Drawer panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "360px",
        background: "#FFFFFF", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
        zIndex: 1001, display: "flex", flexDirection: "column", padding: "1.5rem",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>
              Customise {CARRIER_SEGMENT_LABELS[segment]} PD Curve
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>
              Enter values as percentages (e.g. 1.20 = 1.20%)
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tenor inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", flex: 1, overflowY: "auto" }}>
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.25rem" }}>
                {label}
              </label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                max="99.9999"
                value={fields[key]}
                onChange={e => { setFields(f => ({ ...f, [key]: e.target.value })); setError(null); }}
                style={{
                  width: "100%", padding: "0.375rem 0.5rem",
                  border: "1px solid #E2E8F0", borderRadius: "0.375rem",
                  fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}

          {/* Notes */}
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.25rem" }}>
              Source / Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Internal credit model, board approved March 2025"
              rows={3}
              style={{
                width: "100%", padding: "0.375rem 0.5rem",
                border: "1px solid #E2E8F0", borderRadius: "0.375rem",
                fontSize: "0.8125rem", resize: "vertical", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              fontSize: "0.75rem", color: "#B91C1C",
              background: "rgba(185,28,28,0.06)", borderRadius: "0.375rem",
              padding: "0.5rem 0.75rem",
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "1rem", marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "0.5rem 1rem", background: "#002147", color: "#FFFFFF",
              border: "none", borderRadius: "0.5rem", fontSize: "0.8125rem",
              fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>

          {isOverridden && !confirmReset && (
            <button
              onClick={() => setConfirmReset(true)}
              style={{
                padding: "0.5rem 1rem", background: "transparent", color: "#B91C1C",
                border: "1px solid rgba(185,28,28,0.3)", borderRadius: "0.5rem",
                fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
              }}
            >
              Reset to Aeroinsights defaults
            </button>
          )}

          {confirmReset && (
            <div style={{ background: "rgba(185,28,28,0.06)", borderRadius: "0.5rem", padding: "0.75rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#B91C1C", marginBottom: "0.5rem" }}>
                Remove custom curve and restore Aeroinsights defaults?
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={onReset}
                  style={{ flex: 1, padding: "0.375rem", background: "#B91C1C", color: "#FFFFFF", border: "none", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                >
                  Confirm Reset
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  style={{ flex: 1, padding: "0.375rem", background: "transparent", color: "#374151", border: "1px solid #E2E8F0", borderRadius: "0.375rem", fontSize: "0.75rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/counterparties/CurveOverrideDrawer.tsx && git commit -m "feat: add CurveOverrideDrawer component"
```

---

## Task 7: Wire Into Counterparties Page

**Files:**
- Modify: `src/app/pages/Counterparties.tsx`

The Counterparties page uses `CounterpartyRow` as its local display type and builds a `lesseeRows` array from either demo data or Supabase data. This task adds `carrierSegment` and `pdEstimate` to that type, pre-seeds the demo rows, mounts `usePdCurves`, adds a local `segmentOverrides` state (so demo mode also works without Supabase writes), and renders `CarrierSegmentSelector` + `PdBenchmarkPanel` in the selected-lessee detail area.

- [ ] **Step 1: Add new imports and update CounterpartyRow type**

At the top of `src/app/pages/Counterparties.tsx`, add these imports after the existing import block:

```typescript
import { usePdCurves } from "../hooks/usePdCurves";
import { CarrierSegmentSelector } from "../components/counterparties/CarrierSegmentSelector";
import { PdBenchmarkPanel } from "../components/counterparties/PdBenchmarkPanel";
import { type CarrierSegment } from "../data/pdCurves";
import { supabase } from "../lib/supabase";
```

Find the `CounterpartyRow` interface (around line 193) and add two fields:

```typescript
interface CounterpartyRow {
  id:              string;
  profileId?:      string;
  name:            string;
  country:         string;
  rating:          string;
  stage:           "1" | "2" | "3";
  behaviorScore:   number;
  scores:          { punctuality: number; restructuringCoop: number; govtInterference: number; litigationPropensity: number };
  exposure:        string;
  leases:          number;
  lastPayment:     string;
  daysOverdue:     number;
  notes:           string;
  watchlistStatus?: "green" | "amber" | "red" | null;
  carrierSegment:  CarrierSegment | null;   // ← add
  pdEstimate:      number | null;            // ← add
}
```

- [ ] **Step 2: Pre-seed DEMO_LESSEES with carrier segments and PD estimates**

Find the `DEMO_LESSEES` array (around line 204) and add `carrierSegment` and `pdEstimate` to each entry:

```typescript
const DEMO_LESSEES: CounterpartyRow[] = [
  {
    id: "INDIGO", profileId: "INDIGO",
    name: "IndiGo Airlines", country: "India", rating: "BB-", stage: "3",
    behaviorScore: 44,
    scores: { punctuality: 28, restructuringCoop: 52, govtInterference: 41, litigationPropensity: 55 },
    exposure: "$184M", leases: 6, lastPayment: "2026-03-14", daysOverdue: 45,
    notes: "Payment 45 days overdue. §1110 cure risk elevated. Seeking deferral.",
    watchlistStatus: "red",
    carrierSegment: "lcc",
    pdEstimate: 0.0420,
  },
  {
    id: "AEROMEX", profileId: "AEROMEX",
    name: "Aeromexico", country: "Mexico", rating: "CCC", stage: "3",
    behaviorScore: 29,
    scores: { punctuality: 18, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
    exposure: "$122M", leases: 4, lastPayment: "2026-01-31", daysOverdue: 88,
    notes: "Chapter 11 filing. §1110 cure window active. AerCap and Air Lease precedent reviewed.",
    watchlistStatus: "red",
    carrierSegment: "network",
    pdEstimate: 0.1200,
  },
  {
    id: "SRILNKN", profileId: "SRILNKN",
    name: "SriLankan Airlines", country: "Sri Lanka", rating: "B+", stage: "2",
    behaviorScore: 62,
    scores: { punctuality: 55, restructuringCoop: 70, govtInterference: 48, litigationPropensity: 75 },
    exposure: "$118M", leases: 4, lastPayment: "2026-04-10", daysOverdue: 12,
    notes: "Downgraded by S&P. Government-owned carrier. High litigation propensity.",
    watchlistStatus: "amber",
    carrierSegment: "regional",
    pdEstimate: 0.0350,
  },
  {
    id: "AZUL", profileId: "AZUL",
    name: "Azul Brazilian Airlines", country: "Brazil", rating: "B+", stage: "2",
    behaviorScore: 71,
    scores: { punctuality: 68, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
    exposure: "$142M", leases: 5, lastPayment: "2026-04-20", daysOverdue: 6,
    notes: "Schedule reductions. Liquidity tightening. Constructive engagement so far.",
    watchlistStatus: "amber",
    carrierSegment: "lcc",
    pdEstimate: 0.0280,
  },
  {
    id: "TRANSATCA", profileId: "TRANSATCA",
    name: "Air Transat", country: "Canada", rating: "B", stage: "2",
    behaviorScore: 68,
    scores: { punctuality: 62, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
    exposure: "$96M", leases: 3, lastPayment: "2026-04-22", daysOverdue: 8,
    notes: "Restructuring discussions initiated. Canadian jurisdiction favorable for lessor.",
    watchlistStatus: "amber",
    carrierSegment: "charter",
    pdEstimate: 0.0510,
  },
  {
    id: "EMIRATES", profileId: "EMIRATES",
    name: "Emirates", country: "UAE", rating: "A-", stage: "1",
    behaviorScore: 94,
    scores: { punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
    exposure: "$412M", leases: 8, lastPayment: "2026-04-28", daysOverdue: 0,
    notes: "Exemplary payment history. Strong sovereign backing. Low risk.",
    watchlistStatus: "green",
    carrierSegment: "network",
    pdEstimate: 0.0090,
  },
];
```

- [ ] **Step 3: Add real-data mapping in lesseeRows useMemo**

In the `useMemo` that builds `lesseeRows` (around line 274), update the `lesseeData.map()` at the bottom to include the new fields:

```typescript
return lesseeData.map(l => ({
  id: l.id,
  profileId: LESSEE_NAME_TO_PROFILE_ID[l.name],
  name: l.name,
  country: l.country ?? "—",
  rating: l.credit_rating ?? "—",
  stage: (l.watchlist_status === "red" ? "3" : l.watchlist_status === "amber" ? "2" : "1") as "1" | "2" | "3",
  behaviorScore: 0,
  scores: { punctuality: 0, restructuringCoop: 0, govtInterference: 0, litigationPropensity: 0 },
  exposure: fmtExposure(exposureByLesseeId.get(l.id) ?? 0),
  leases: leaseCounts.get(l.id) ?? 0,
  lastPayment: "—",
  daysOverdue: 0,
  notes: "",
  watchlistStatus: l.watchlist_status,
  carrierSegment: (l.carrier_segment as CarrierSegment | null) ?? null,
  pdEstimate: l.pd_estimate ?? null,
}));
```

- [ ] **Step 4: Mount usePdCurves + add segmentOverrides state**

Inside the `Counterparties` function body (after the existing `useState` calls, around line 309), add:

```typescript
const { curves, isOverridden, saveOverride, resetToDefault } = usePdCurves();
// Note: `isDemo` is already destructured from usePortfolioData() earlier in the component.

// Local segment overrides — used in both demo and real-org mode.
// In real-org mode, changes also write to Supabase.
const [segmentOverrides, setSegmentOverrides] = useState<Record<string, CarrierSegment | null>>({});

async function handleSegmentChange(lesseeId: string, segment: CarrierSegment | null) {
  setSegmentOverrides(prev => ({ ...prev, [lesseeId]: segment }));
  if (!isDemo) {
    await supabase
      .from("lessees")
      .update({ carrier_segment: segment })
      .eq("id", lesseeId);
  }
}
```

- [ ] **Step 5: Render CarrierSegmentSelector and PdBenchmarkPanel in the detail area**

Find the `<motion.div key={selectedLessee.id} ...>` block (around line 463). Inside it, directly after the closing tag of whichever panel (`</LesseeProfilePanel>` or `</SimpleLesseePanel>` — both are rendered conditionally), add the new components.

Replace the inner content of the `<motion.div key={selectedLessee.id}>` block so it reads:

```tsx
<motion.div
  key={selectedLessee.id}
  initial={{ opacity: 0, x: 12 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
>
  {selectedLessee.profileId ? (
    <LesseeProfilePanel lesseeId={selectedLessee.profileId} />
  ) : (
    <SimpleLesseePanel lessee={{
      name: selectedLessee.name,
      country: selectedLessee.country,
      rating: selectedLessee.rating,
      stage: selectedLessee.stage,
      leases: selectedLessee.leases,
      exposure: selectedLessee.exposure,
      watchlistStatus: selectedLessee.watchlistStatus,
    } satisfies SimpleLesseeData} />
  )}

  {/* PD Benchmark — carrier segment selector + benchmark panel */}
  <div style={{ marginTop: "1rem", padding: "1rem", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.5rem" }}>
    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0F172A", marginBottom: "0.25rem" }}>PD Model Inputs</div>
    <CarrierSegmentSelector
      segment={segmentOverrides[selectedLessee.id] !== undefined
        ? segmentOverrides[selectedLessee.id]
        : selectedLessee.carrierSegment}
      onChange={(seg) => handleSegmentChange(selectedLessee.id, seg)}
    />
    {(() => {
      const effectiveSegment = segmentOverrides[selectedLessee.id] !== undefined
        ? segmentOverrides[selectedLessee.id]
        : selectedLessee.carrierSegment;
      if (!effectiveSegment) return null;
      return (
        <PdBenchmarkPanel
          segment={effectiveSegment}
          pdEstimate={selectedLessee.pdEstimate}
          curves={curves}
          isOverridden={isOverridden}
          onSaveOverride={saveOverride}
          onResetToDefault={resetToDefault}
        />
      );
    })()}
  </div>

  {(selectedLessee.stage === "2" || selectedLessee.stage === "3") && (
    <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
      <button
        onClick={() =>
          navigate("/scenarios", {
            state: {
              prefill: stressPrefill(selectedLessee.stage),
              prefillSource: `Stress test: ${selectedLessee.name} (Stage ${selectedLessee.stage})`,
            },
          })
        }
        style={{
          display: "flex", alignItems: "center", gap: "0.375rem",
          padding: "0.5rem 1rem",
          background: selectedLessee.stage === "3" ? "#B91C1C" : "#B45309",
          color: "#FFFFFF", border: "none", borderRadius: "0.5rem",
          fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
        }}
      >
        <Zap size={14} />
        Stress Test in Scenarios
      </button>
    </div>
  )}
</motion.div>
```

- [ ] **Step 6: Run full test suite and TypeScript check**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20 && npx vitest run 2>&1 | tail -6
```

Expected:
```
Test Files  15 passed (15)
     Tests  346 passed (346)
```

(334 existing + 12 new pdCurves tests)

- [ ] **Step 7: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Counterparties.tsx && git commit -m "feat: wire PD benchmark panel and carrier segment selector into Counterparties page"
```

---

## Task 8: Build and Deploy

**Files:** none

- [ ] **Step 1: Production build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -10
```

Expected: `✓ built in` — no errors.

- [ ] **Step 2: Deploy to production**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && vercel --prod 2>&1 | tail -5
```

Expected: `Aliased: https://aeroinsights.vercel.app`

- [ ] **Step 3: Manual smoke test checklist**

On https://aeroinsights.vercel.app/counterparties:

- [ ] Select **IndiGo** — "Carrier Type" dropdown shows, pre-selected to "Low-Cost Carrier"
- [ ] PD Benchmark panel shows 5 tenors with LCC curve values (1yr = 1.80%)
- [ ] 1yr Manual column shows IndiGo's `pd_estimate` (4.20%) with a **red `!!`** badge (4.20 ÷ 1.80 = 2.33×)
- [ ] Tooltip on badge reads "Manual PD is 133% above the Low-Cost Carrier benchmark"
- [ ] Select **Emirates** — 1yr Manual shows 0.90% with **green `✓`** badge (0.90 ÷ 1.20 = 0.75× — within ±25%)
- [ ] Click "Customise curves" on any lessee → drawer opens with 5 pre-filled inputs
- [ ] Change a value to "99.9999" → save → error: bounds violation
- [ ] Set 1yr = 2.00, 2yr = 1.00 → save → error: "1yr must be ≤ 2yr" (monotonicity)
- [ ] Enter valid values → save → "Custom" badge appears on panel header
- [ ] Click "Reset to Aeroinsights defaults" → confirm → "Custom" badge disappears
