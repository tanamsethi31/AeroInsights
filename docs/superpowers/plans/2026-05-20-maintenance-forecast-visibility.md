# Maintenance Forecast Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface MR adequacy data at portfolio level — a Dashboard KPI card, a Portfolio risk banner, and an EOL Shortfall column in the leases table — so shortfalls are visible without drilling into individual aircraft rows.

**Architecture:** Extend `portfolioAdapters.ts` with MR fields on `LeaseTableRow` and a new `toMRHealthSummary()` aggregator, then build two new presentational components (`MRHealthCard`, `MRRiskBanner`) and wire them into `Dashboard.tsx` and `Portfolio.tsx`. No new data fetching — all data comes from the existing `MR_ADEQUACY` static dataset in `maintenanceHeuristics.ts`.

**Tech Stack:** React, TypeScript, Framer Motion, lucide-react, inline styles (no new CSS files).

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

### Task 1: Extend data layer — MR fields on `LeaseTableRow` and `toMRHealthSummary`

**Files:**
- Modify: `src/app/lib/portfolioAdapters.ts`
- Modify: `src/app/lib/portfolioAdapters.test.ts`

- [ ] **Step 1: Write failing tests for `toLeaseTableRows` MR fields and `toMRHealthSummary`**

Add the following to `src/app/lib/portfolioAdapters.test.ts`.

At the top of the file, add to the existing import from `"./portfolioAdapters"`:
```typescript
import {
  indexById,
  toLeaseTableRows,
  toAircraftTableRows,
  toLesseeTableRows,
  toDashboardKPIs,
  toEclTableRows,
  toConcentrationData,
  toPortfolioKPIs,
  toMRHealthSummary,          // NEW
  type PortfolioKPIs,
  type LeaseTableRow,         // NEW
} from "./portfolioAdapters";
import type { Asset, Lessee, Lease } from "../types/portfolio";
```

Add a helper at module level (after the existing imports, before the first `describe`):
```typescript
function makeLeaseRow(overrides: Partial<LeaseTableRow> = {}): LeaseTableRow {
  return {
    id: "test-001",
    lessee: "Test Lessee",
    aircraft: "A320neo",
    msn: "TEST-001",
    start: "2019-01-01",
    end: "2025-01-01",
    rentUSD: "100,000",
    stage: "1",
    status: "Active",
    mrFlag: null,
    eolShortfall: null,
    eolShortfallPct: null,
    ...overrides,
  };
}
```

Append these two `describe` blocks at the end of the file:
```typescript
describe("toLeaseTableRows — MR adequacy fields", () => {
  const fakeAsset: Asset = {
    id: "a1", org_id: "test", upload_id: null,
    registration: "REG1", msn: "TEST-001", aircraft_type: "A320neo",
    manufacturer: null, vintage: 2019, current_operator: null,
    created_at: "2024-01-01T00:00:00Z",
  };
  const fakeLessee: Lessee = {
    id: "l1", org_id: "test", name: "Test Lessee", iata_code: null,
    country: "UAE", credit_rating: null, pd_estimate: null,
    watchlist_status: null, created_at: "2024-01-01T00:00:00Z",
  };

  it("populates mrFlag and eolShortfall when lease id matches MR_ADEQUACY entry", () => {
    // LSE-2019-001 is "amber" in MR_ADEQUACY with eolShortfall 3_130_000, eolShortfallPct 14.1
    const fakeLease: Lease = {
      id: "LSE-2019-001", org_id: "test", asset_id: "a1", lessee_id: "l1",
      start_date: "2019-01-01", end_date: "2025-01-01", monthly_rental: 100000,
      currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z",
    };
    const rows = toLeaseTableRows([fakeLease], [fakeAsset], [fakeLessee]);
    expect(rows[0].mrFlag).toBe("amber");
    expect(rows[0].eolShortfall).toBe(3_130_000);
    expect(rows[0].eolShortfallPct).toBe(14.1);
  });

  it("sets MR fields to null for lease id not in MR_ADEQUACY", () => {
    // All MOCK_LEASES use "mock-ls*" ids which are not in MR_ADEQUACY
    const rows = toLeaseTableRows(MOCK_LEASES, MOCK_ASSETS, MOCK_LESSEES);
    expect(rows.every(r => r.mrFlag === null)).toBe(true);
    expect(rows.every(r => r.eolShortfall === null)).toBe(true);
  });
});

describe("toMRHealthSummary", () => {
  it("counts red, amber, green flags correctly, ignores null mrFlag", () => {
    const rows = [
      makeLeaseRow({ mrFlag: "red",   eolShortfall: 5_000_000, eolShortfallPct: 30 }),
      makeLeaseRow({ mrFlag: "amber", eolShortfall: 2_000_000, eolShortfallPct: 10 }),
      makeLeaseRow({ mrFlag: "green", eolShortfall: -3_000_000, eolShortfallPct: -15 }),
      makeLeaseRow({ mrFlag: null }),
    ];
    const summary = toMRHealthSummary(rows);
    expect(summary.redCount).toBe(1);
    expect(summary.amberCount).toBe(1);
    expect(summary.greenCount).toBe(1);
    expect(summary.worstOffenders).toHaveLength(2);
  });

  it("sorts worstOffenders: red before amber, then by eolShortfall descending", () => {
    const rows = [
      makeLeaseRow({ id: "A", lessee: "AlphaAir", msn: "A01", mrFlag: "amber", eolShortfall: 3_000_000, eolShortfallPct: 15 }),
      makeLeaseRow({ id: "B", lessee: "BetaAir",  msn: "B01", mrFlag: "red",   eolShortfall: 1_000_000, eolShortfallPct: 5  }),
      makeLeaseRow({ id: "C", lessee: "GammaAir", msn: "C01", mrFlag: "amber", eolShortfall: 2_000_000, eolShortfallPct: 10 }),
    ];
    const summary = toMRHealthSummary(rows);
    expect(summary.worstOffenders[0].leaseId).toBe("B"); // red first
    expect(summary.worstOffenders[1].leaseId).toBe("A"); // amber, higher shortfall
    expect(summary.worstOffenders[2].leaseId).toBe("C"); // amber, lower shortfall
  });

  it("caps worstOffenders at 3 even when 4 at-risk leases exist", () => {
    const rows = [
      makeLeaseRow({ id: "1", mrFlag: "red",   eolShortfall: 5_000_000, eolShortfallPct: 30 }),
      makeLeaseRow({ id: "2", mrFlag: "red",   eolShortfall: 4_000_000, eolShortfallPct: 25 }),
      makeLeaseRow({ id: "3", mrFlag: "amber", eolShortfall: 3_000_000, eolShortfallPct: 15 }),
      makeLeaseRow({ id: "4", mrFlag: "amber", eolShortfall: 2_000_000, eolShortfallPct: 10 }),
    ];
    const summary = toMRHealthSummary(rows);
    expect(summary.worstOffenders).toHaveLength(3);
  });

  it("returns empty worstOffenders when all leases are green or null", () => {
    const rows = [
      makeLeaseRow({ mrFlag: "green", eolShortfall: -1_000_000, eolShortfallPct: -5 }),
      makeLeaseRow({ mrFlag: null }),
    ];
    const summary = toMRHealthSummary(rows);
    expect(summary.worstOffenders).toHaveLength(0);
    expect(summary.redCount).toBe(0);
    expect(summary.amberCount).toBe(0);
    expect(summary.greenCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/lib/portfolioAdapters.test.ts 2>&1 | tail -20
```
Expected: FAIL — `toMRHealthSummary is not a function` / `mrFlag` does not exist on `LeaseTableRow`.

- [ ] **Step 3: Implement data layer changes in `portfolioAdapters.ts`**

Add this import at the top of the file (after the existing imports):
```typescript
import { MR_ADEQUACY, type MRAdeqFlag } from "../data/maintenanceHeuristics";
```

Replace the `LeaseTableRow` interface:
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
  eolShortfall: number | null;      // positive = shortfall, negative = surplus
  eolShortfallPct: number | null;   // shortfall as % of EOL redelivery cost
}
```

Replace the `toLeaseTableRows` function body (the `.map()` return object) to add MR lookups:
```typescript
export function toLeaseTableRows(leases: Lease[], assets: Asset[], lessees: Lessee[]): LeaseTableRow[] {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);
  return leases.map((l) => {
    const asset = assetMap.get(l.asset_id);
    const lessee = lesseeMap.get(l.lessee_id);
    const mrData = MR_ADEQUACY[l.id] ?? null;
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
      mrFlag: mrData ? mrData.flag : null,
      eolShortfall: mrData ? mrData.eolShortfall : null,
      eolShortfallPct: mrData ? mrData.eolShortfallPct : null,
    };
  });
}
```

Add these two exports after `toLeaseTableRows` (before the `// ─── Portfolio.tsx — Aircraft tab` comment):
```typescript
// ─── MR Health Summary ────────────────────────────────────────────────────────

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
    if (l.mrFlag === "red") {
      redCount++;
      atRisk.push({ leaseId: l.id, lessee: l.lessee, msn: l.msn, flag: "red", eolShortfall: l.eolShortfall!, eolShortfallPct: l.eolShortfallPct! });
    } else if (l.mrFlag === "amber") {
      amberCount++;
      atRisk.push({ leaseId: l.id, lessee: l.lessee, msn: l.msn, flag: "amber", eolShortfall: l.eolShortfall!, eolShortfallPct: l.eolShortfallPct! });
    } else if (l.mrFlag === "green") {
      greenCount++;
    }
  }

  // Sort: red before amber, then by eolShortfall descending. Cap at 3.
  atRisk.sort((a, b) => {
    if (a.flag !== b.flag) return a.flag === "red" ? -1 : 1;
    return b.eolShortfall - a.eolShortfall;
  });

  return { redCount, amberCount, greenCount, worstOffenders: atRisk.slice(0, 3) };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/lib/portfolioAdapters.test.ts 2>&1 | tail -20
```
Expected: all tests pass including the new ones. Existing tests should still pass (no regressions).

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/lib/portfolioAdapters.ts src/app/lib/portfolioAdapters.test.ts && git commit -m "feat: extend LeaseTableRow with MR adequacy fields, add toMRHealthSummary"
```

---

### Task 2: `MRHealthCard` component

**Files:**
- Create: `src/app/components/portfolio/MRHealthCard.tsx`

- [ ] **Step 1: Create the file**

Create `src/app/components/portfolio/MRHealthCard.tsx` with this full content:

```typescript
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { MRHealthSummary } from "../../lib/portfolioAdapters";

interface Props {
  summary: MRHealthSummary;
  staggerIndex?: number;
  onClick?: () => void;
}

function FlagDot({ colour }: { colour: string }) {
  return (
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: colour, flexShrink: 0 }} />
  );
}

export function MRHealthCard({ summary, staggerIndex = 0, onClick }: Props) {
  const { redCount, amberCount, greenCount, worstOffenders } = summary;
  const allClear = redCount === 0 && amberCount === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: staggerIndex * 0.05, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      style={{
        background: "#FFFFFF",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem 1.5rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        border: "1px solid #E2E8F0",
        borderTop: "3px solid #002147",
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
        position: onClick ? "relative" : undefined,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 160ms var(--ease-out-strong), border-color 160ms var(--ease-out-strong), transform 160ms var(--ease-out-strong)",
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        el.style.borderColor = "#CBD5E1";
        el.style.borderTopColor = "#002147";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
        el.style.borderColor = "#E2E8F0";
        el.style.borderTopColor = "#002147";
        el.style.transform = "translateY(0)";
      }}
      onMouseDown={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
      }}
    >
      {onClick && (
        <div style={{ position: "absolute", top: "0.875rem", right: "1rem", color: "#CBD5E1" }}>
          <ArrowUpRight size={14} />
        </div>
      )}

      {/* Label */}
      <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        MR Adequacy
      </div>

      {allClear ? (
        <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#15803D" }}>All leases on track</div>
      ) : (
        <>
          {/* Flag counts */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "1.125rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <FlagDot colour="#B91C1C" />
              <span style={{ color: "#B91C1C" }}>{redCount}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <FlagDot colour="#B45309" />
              <span style={{ color: "#B45309" }}>{amberCount}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <FlagDot colour="#15803D" />
              <span style={{ color: "#15803D" }}>{greenCount}</span>
            </div>
          </div>

          {/* Worst offenders */}
          {worstOffenders.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.125rem" }}>
              {worstOffenders.map((o) => {
                const colour = o.flag === "red" ? "#B91C1C" : "#B45309";
                const shortfallM = (o.eolShortfall / 1_000_000).toFixed(1);
                return (
                  <div key={o.leaseId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", minWidth: 0 }}>
                      <span style={{ fontWeight: 600, color: "#0F172A", fontSize: "0.8125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {o.lessee}
                      </span>
                      <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>·</span>
                      <span style={{ fontFamily: "monospace", color: "#475569", fontSize: "0.75rem" }}>{o.msn}</span>
                    </div>
                    <span style={{ color: colour, fontWeight: 600, fontSize: "0.8125rem", flexShrink: 0 }}>
                      -${shortfallM}m
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep MRHealthCard
```
Expected: no output (no errors in `MRHealthCard.tsx`).

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/portfolio/MRHealthCard.tsx && git commit -m "feat: add MRHealthCard component"
```

---

### Task 3: `MRRiskBanner` component

**Files:**
- Create: `src/app/components/portfolio/MRRiskBanner.tsx`

- [ ] **Step 1: Create the file**

Create `src/app/components/portfolio/MRRiskBanner.tsx` with this full content:

```typescript
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { MRHealthSummary } from "../../lib/portfolioAdapters";

interface Props {
  summary: MRHealthSummary;
}

export function MRRiskBanner({ summary }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const { redCount, amberCount, worstOffenders } = summary;
  const atRiskCount = redCount + amberCount;

  if (atRiskCount === 0 || dismissed) return null;

  const hasRed = redCount > 0;
  const borderColour  = hasRed ? "#B91C1C" : "#B45309";
  const bgColour      = hasRed ? "rgba(185,28,28,0.04)" : "rgba(180,83,9,0.04)";
  const iconColour    = hasRed ? "#B91C1C" : "#B45309";
  const headline = `${atRiskCount} lease${atRiskCount !== 1 ? "s" : ""} have material maintenance reserve shortfall${atRiskCount !== 1 ? "s" : ""}`;

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "0.75rem",
      padding: "0.875rem 1rem",
      borderRadius: "0.5rem",
      border: `1px solid ${borderColour}`,
      background: bgColour,
      marginBottom: "1rem",
    }}>
      <AlertTriangle size={16} style={{ color: iconColour, flexShrink: 0, marginTop: "0.125rem" }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Headline */}
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "0.375rem" }}>
          {headline}
        </div>

        {/* Offender chips */}
        {worstOffenders.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {worstOffenders.map((o) => {
              const chipColour = o.flag === "red" ? "#B91C1C" : "#B45309";
              const chipBg     = o.flag === "red" ? "rgba(185,28,28,0.08)" : "rgba(180,83,9,0.08)";
              const shortfallM = (o.eolShortfall / 1_000_000).toFixed(1);
              return (
                <span key={o.leaseId} style={{
                  background: chipBg,
                  color: chipColour,
                  borderRadius: "0.25rem",
                  padding: "0.125rem 0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                }}>
                  {o.lessee} · {o.msn} · -{`$${shortfallM}m`}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "none",
          border: "none",
          color: "#94A3B8",
          cursor: "pointer",
          padding: "0.125rem",
          lineHeight: 1,
          flexShrink: 0,
          fontSize: "1rem",
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | grep MRRiskBanner
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/portfolio/MRRiskBanner.tsx && git commit -m "feat: add MRRiskBanner component"
```

---

### Task 4: Wire into Dashboard.tsx and Portfolio.tsx

**Files:**
- Modify: `src/app/pages/Dashboard.tsx`
- Modify: `src/app/pages/Portfolio.tsx`

- [ ] **Step 1: Update `Dashboard.tsx` imports**

In `Dashboard.tsx`, replace the existing single-line portfolioAdapters import:
```typescript
import { toDashboardKPIs } from "../lib/portfolioAdapters";
```
with:
```typescript
import { toDashboardKPIs, toLeaseTableRows, toMRHealthSummary } from "../lib/portfolioAdapters";
```

Add the MRHealthCard import after the existing component imports (e.g. after the `import { KpiCard }` line):
```typescript
import { MRHealthCard } from "../components/portfolio/MRHealthCard";
```

- [ ] **Step 2: Compute `leases` and `mrSummary` in Dashboard component**

In `Dashboard.tsx`, locate these two lines (around line 212–214):
```typescript
const { assets, lessees: lesseeData, leases: leaseData, provisions } = usePortfolioData();
...
const kpis = toDashboardKPIs(assets, lesseeData, provisions);
```

Add the following immediately after the `kpis` line:
```typescript
const leases      = toLeaseTableRows(leaseData, assets, lesseeData);
const mrSummary   = toMRHealthSummary(leases);
```

- [ ] **Step 3: Add `MRHealthCard` to the KPI strip in Dashboard**

Locate the closing `</div>` of the KPI strip grid (after the 4th `<KpiCard>` for "Active Scenarios", around line 467–468):
```tsx
        <KpiCard
          label="Active Scenarios"
          value="12"
          delta="3 run today"
          deltaType="positive"
          subtitle="Last run: 09:14 today"
          staggerIndex={3}
          onClick={() => navigate("/scenarios")}
        />
      </div>
```

Replace it with:
```tsx
        <KpiCard
          label="Active Scenarios"
          value="12"
          delta="3 run today"
          deltaType="positive"
          subtitle="Last run: 09:14 today"
          staggerIndex={3}
          onClick={() => navigate("/scenarios")}
        />
        <MRHealthCard
          summary={mrSummary}
          staggerIndex={4}
          onClick={() => navigate("/portfolio", { state: { tab: "Leases" } })}
        />
      </div>
```

- [ ] **Step 4: Update `Portfolio.tsx` imports**

In `Portfolio.tsx`, the existing portfolioAdapters import block (lines 5–13):
```typescript
import {
  toLeaseTableRows,
  toAircraftTableRows,
  toLesseeTableRows,
  toPortfolioKPIs,
  type LeaseTableRow,
  type LesseeTableRow as LesseeRow,
  type AircraftTableRow,
} from "../lib/portfolioAdapters";
```

Replace with:
```typescript
import {
  toLeaseTableRows,
  toAircraftTableRows,
  toLesseeTableRows,
  toPortfolioKPIs,
  toMRHealthSummary,
  type LeaseTableRow,
  type LesseeTableRow as LesseeRow,
  type AircraftTableRow,
} from "../lib/portfolioAdapters";
```

Add this import after the existing component imports (e.g. after `import { SDMRTab, ... }`):
```typescript
import { MRRiskBanner } from "../components/portfolio/MRRiskBanner";
```

- [ ] **Step 5: Compute `mrSummary` in Portfolio component**

In `Portfolio.tsx`, after line 96 (`const leases = toLeaseTableRows(leaseData, assets, lesseeData);`), add:
```typescript
const mrSummary = toMRHealthSummary(leases);
```

- [ ] **Step 6: Add `MRRiskBanner` above the Leases tab Card**

In `Portfolio.tsx`, locate the Leases tab block (around line 407–409):
```tsx
      {/* Leases Tab */}
      {activeTab === "Leases" && (
        <Card
```

Replace with:
```tsx
      {/* Leases Tab */}
      {activeTab === "Leases" && (
        <>
          <MRRiskBanner summary={mrSummary} />
          <Card
```

Then find the closing `)}` that ends the Leases tab block (it comes after the `</Card>` that wraps the leases table, around line 499–500):
```tsx
        </Card>
      )}
```

Replace with:
```tsx
        </Card>
        </>
      )}
```

- [ ] **Step 7: Add EOL Shortfall column header**

In `Portfolio.tsx`, locate the column header array inside the Leases tab table (around line 445–455):
```typescript
                  {([
                    { label: "Lease ID", key: null },
                    { label: "Lessee", key: "lessee" },
                    { label: "Aircraft", key: "aircraft" },
                    { label: "MSN", key: null },
                    { label: "Lease Start", key: "start" },
                    { label: "Lease End", key: "end" },
                    { label: "Monthly Rent (USD)", key: "rent" },
                    { label: "Stage", key: "stage" },
                    { label: "Status", key: null },
                  ] as { label: string; key: string | null }[]).map(({ label, key }) => (
```

Replace with:
```typescript
                  {([
                    { label: "Lease ID", key: null },
                    { label: "Lessee", key: "lessee" },
                    { label: "Aircraft", key: "aircraft" },
                    { label: "MSN", key: null },
                    { label: "Lease Start", key: "start" },
                    { label: "Lease End", key: "end" },
                    { label: "Monthly Rent (USD)", key: "rent" },
                    { label: "Stage", key: "stage" },
                    { label: "Status", key: null },
                    { label: "EOL Shortfall", key: "eolShortfall" },
                  ] as { label: string; key: string | null }[]).map(({ label, key }) => (
```

- [ ] **Step 8: Add EOL Shortfall sort accessor**

In `Portfolio.tsx`, locate the `leaseAccessors` object (around line 122–128):
```typescript
  const leaseAccessors = {
    lessee:   (l: LeaseTableRow) => l.lessee,
    aircraft: (l: LeaseTableRow) => l.aircraft,
    start:    (l: LeaseTableRow) => l.start,
    end:      (l: LeaseTableRow) => l.end,
    rent:     (l: LeaseTableRow) => parseInt(l.rentUSD.replace(/,/g, "")) || 0,
    stage:    (l: LeaseTableRow) => parseInt(l.stage) || 0,
  };
```

Replace with:
```typescript
  const leaseAccessors = {
    lessee:       (l: LeaseTableRow) => l.lessee,
    aircraft:     (l: LeaseTableRow) => l.aircraft,
    start:        (l: LeaseTableRow) => l.start,
    end:          (l: LeaseTableRow) => l.end,
    rent:         (l: LeaseTableRow) => parseInt(l.rentUSD.replace(/,/g, "")) || 0,
    stage:        (l: LeaseTableRow) => parseInt(l.stage) || 0,
    eolShortfall: (l: LeaseTableRow) => l.eolShortfall ?? -Infinity,
  };
```

- [ ] **Step 9: Add EOL Shortfall table cell**

In `Portfolio.tsx`, locate the last `<td>` in the lease row (the Status cell, around line 491–493):
```tsx
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <StatusPill stage="green" label={lease.status} />
                    </td>
                  </tr>
```

Replace with:
```tsx
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <StatusPill stage="green" label={lease.status} />
                    </td>
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
                  </tr>
```

- [ ] **Step 10: Verify full TypeScript compile with no errors**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```
Expected: no output (zero errors).

- [ ] **Step 11: Run all tests**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Dashboard.tsx src/app/pages/Portfolio.tsx && git commit -m "feat: wire MRHealthCard and MRRiskBanner into Dashboard and Portfolio, add EOL Shortfall column"
```
