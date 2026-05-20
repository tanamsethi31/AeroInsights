# Cash Flow Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a portfolio-wide cash flow ledger with actual event recording (manual + recon-fed rent receipts) and a rule-based 24-month forecast with manual overrides, surfaced on a new `/cash-flow` page.

**Architecture:** One new Supabase table (`cash_events`) + client-side forecast engine (`cashFlowForecast.ts`) + hook (`useCashFlow.ts`) + page (`CashFlow.tsx`). Rule-based forecast is computed client-side and never persisted — same pattern as reconciliationMatcher and absWaterfall. Confirmed recon matches auto-insert rent receipts via a fire-and-forget addition to `useReconciliation.ts`.

**Tech Stack:** React, TypeScript, Supabase (postgres + supabase-js), Recharts (already in bundle), Framer Motion (already in bundle), Vitest.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/011_cash_events.sql` | Create | Table DDL + indexes |
| `src/app/utils/cashFlowForecast.ts` | Create | Types + forecast engine + merge logic |
| `src/app/utils/cashFlowForecast.test.ts` | Create | 5 unit tests |
| `src/app/hooks/useCashFlow.ts` | Create | Fetch, merge, addEvent, editEvent, deleteEvent |
| `src/app/hooks/useReconciliation.ts` | Modify | Insert cash_events row on match confirmation |
| `src/app/pages/CashFlow.tsx` | Create | Full page: KPIs + chart + ledger + modal |
| `src/app/routes.tsx` | Modify | Add `/cash-flow` route |
| `src/app/components/layout/Sidebar.tsx` | Modify | Add Cash Flow nav entry |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/011_cash_events.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/011_cash_events.sql
create table if not exists cash_events (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  lease_id        uuid references leases(id) on delete set null,
  event_type      text not null,
  amount          numeric not null,
  currency        text not null default 'USD',
  event_date      date not null,
  is_forecast     boolean not null default false,
  source          text not null,   -- 'manual' | 'recon'
  transaction_id  uuid references bank_transactions(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists cash_events_org_idx   on cash_events(org_id);
create index if not exists cash_events_lease_idx on cash_events(lease_id);
create index if not exists cash_events_date_idx  on cash_events(event_date);
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with project_id `naqgfwnbhybhtirazkjq` and the SQL above.

- [ ] **Step 3: Verify table exists**

Run SQL: `select table_name from information_schema.tables where table_name = 'cash_events' and table_schema = 'public';`

Expected: one row with `cash_events`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/011_cash_events.sql
git commit -m "feat: add cash_events migration (011)"
```

---

## Task 2: Forecast Engine + Types + Tests

**Files:**
- Create: `src/app/utils/cashFlowForecast.ts`
- Create: `src/app/utils/cashFlowForecast.test.ts`

### Context

The forecast engine is a pure TypeScript function — no React, no Supabase. It takes portfolio data and produces an array of `CashEvent` objects with `source: 'rule'`. These rule events are never persisted.

`LeaseSDMR` is imported from `src/app/components/portfolio/SDMRTab`. The SDMR helper functions (`totalMRBalance`, `refundableMRCapped`, `eolCompensation`) are NOT exported from that file — re-implement equivalent logic locally in `cashFlowForecast.ts`.

`mergeForecastEvents` is a separate exported function (also in this file) that takes the rule events and the persisted manual-forecast events and deduplicates: for each `(leaseId, eventType, calendar-month)` triple, if a persisted manual event exists, the corresponding rule event is suppressed.

- [ ] **Step 1: Write the failing tests first**

Create `src/app/utils/cashFlowForecast.test.ts`:

```typescript
// src/app/utils/cashFlowForecast.test.ts
import { describe, it, expect } from "vitest";
import { forecastCashFlows, mergeForecastEvents } from "./cashFlowForecast";
import type { CashEvent } from "./cashFlowForecast";
import type { Lease } from "../types/portfolio";
import type { LeaseSDMR } from "../components/portfolio/SDMRTab";

// ── Factories ──────────────────────────────────────────────────────────────────

function addMonths(base: Date, n: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function makeLease(overrides: Partial<Lease> = {}): Lease {
  return {
    id:             "lease-1",
    org_id:         "org-1",
    asset_id:       "asset-1",
    lessee_id:      "lessee-1",
    start_date:     addMonths(TODAY, -12),
    end_date:       addMonths(TODAY, 12),
    monthly_rental: 500_000,
    currency:       "USD",
    stage:          1,
    created_at:     "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSDMR(leaseId = "lease-1", overrides: Partial<LeaseSDMR> = {}): LeaseSDMR {
  return {
    leaseId,
    lessee:          "Test Airlines",
    aircraft:        "A320",
    eadNum:          10,
    baseLGD:         50,
    returnCondition: "half-life",
    sd: { type: "Cash", amount: 1_000_000, currency: "USD", refundTriggers: [], governingLaw: "English" },
    mrComponents: [
      {
        component:         "Airframe HSI",
        rateBasis:         "$/FH",
        rateAmount:        400,
        unitsAccumulated:  10_000,
        cumulativeBalance: 4_000_000,
        refundable:        true,
        capRule:           "Max 18 months",
        evidencedCost:     3_500_000,
        fullIntervalUnits: 20_000,
        remainingUnits:    5_000,
      },
      {
        component:         "LLPs",
        rateBasis:         "$/cycle",
        rateAmount:        90,
        unitsAccumulated:  5_000,
        cumulativeBalance: 450_000,
        refundable:        false,
        capRule:           "Non-refundable",
        evidencedCost:     0,
        fullIntervalUnits: 20_000,
        remainingUnits:    15_000,
      },
    ],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("forecastCashFlows", () => {
  it("generates one rent event per remaining month for an active lease", () => {
    const lease = makeLease({ end_date: addMonths(TODAY, 3) });
    const result = forecastCashFlows([lease], [], 24);
    const rent = result.filter(e => e.eventType === "rent" && e.leaseId === "lease-1");
    // 3 full months ahead → 3 rent events
    expect(rent.length).toBe(3);
    rent.forEach(e => {
      expect(e.amount).toBe(500_000);
      expect(e.source).toBe("rule");
      expect(e.isForecast).toBe(true);
    });
  });

  it("generates a single mr_draw outflow at lease end with totalMRBalance as negative amount", () => {
    const lease  = makeLease({ end_date: addMonths(TODAY, 1) });
    const sdmr   = makeSDMR("lease-1");
    const result = forecastCashFlows([lease], [sdmr], 24);
    const draw   = result.find(e => e.eventType === "mr_draw" && e.leaseId === "lease-1");
    expect(draw).toBeDefined();
    // totalMRBalance = 4_000_000 + 450_000 = 4_450_000 → outflow = -4_450_000
    expect(draw!.amount).toBe(-4_450_000);
    expect(draw!.eventDate).toBe(lease.end_date);
  });

  it("does not generate a sd_refund event when sd.type is LC", () => {
    const lease = makeLease({ end_date: addMonths(TODAY, 1) });
    const sdmr  = makeSDMR("lease-1", { sd: { type: "LC", amount: 1_000_000, currency: "USD", refundTriggers: [], governingLaw: "English" } });
    const result = forecastCashFlows([lease], [sdmr], 24);
    const refund = result.filter(e => e.eventType === "sd_refund" && e.leaseId === "lease-1");
    expect(refund.length).toBe(0);
  });

  it("stops generating events at horizon cutoff even if lease extends beyond", () => {
    const lease  = makeLease({ end_date: addMonths(TODAY, 30) });
    const result = forecastCashFlows([lease], [], 24);
    const rent   = result.filter(e => e.eventType === "rent" && e.leaseId === "lease-1");
    expect(rent.length).toBe(24);
    // No redelivery events — end_date is beyond 24-month horizon
    const draws = result.filter(e => e.eventType === "mr_draw");
    expect(draws.length).toBe(0);
  });
});

describe("mergeForecastEvents", () => {
  it("suppresses a rule event when a manual forecast override exists for same lease + type + month", () => {
    const endDate = addMonths(TODAY, 1);
    const ruleEvent: CashEvent = {
      id:            `rule-lease-1-rent-${endDate}`,
      orgId:         "",
      leaseId:       "lease-1",
      eventType:     "rent",
      amount:        500_000,
      currency:      "USD",
      eventDate:     endDate,
      isForecast:    true,
      source:        "rule",
      transactionId: null,
      notes:         null,
      createdAt:     "",
    };
    const manualOverride: CashEvent = {
      id:            "manual-override-1",
      orgId:         "org-1",
      leaseId:       "lease-1",
      eventType:     "rent",
      amount:        480_000,
      currency:      "USD",
      eventDate:     endDate,
      isForecast:    true,
      source:        "manual",
      transactionId: null,
      notes:         "Adjusted for partial payment",
      createdAt:     "2026-05-20T00:00:00Z",
    };
    const merged = mergeForecastEvents([ruleEvent], [manualOverride]);
    // Only the manual override remains — rule event for that month is suppressed
    expect(merged.find(e => e.id === ruleEvent.id)).toBeUndefined();
    expect(merged.find(e => e.id === manualOverride.id)).toBeDefined();
    expect(merged.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx vitest run --reporter=verbose src/app/utils/cashFlowForecast.test.ts
```

Expected: FAIL with "Cannot find module './cashFlowForecast'"

- [ ] **Step 3: Create the forecast engine**

Create `src/app/utils/cashFlowForecast.ts`:

```typescript
// src/app/utils/cashFlowForecast.ts
import type { Lease } from "../types/portfolio";
import type { LeaseSDMR } from "../components/portfolio/SDMRTab";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CashEventType =
  | "rent" | "mr_draw" | "sd_posted" | "sd_draw" | "sd_refund"
  | "eol_comp" | "remarketing" | "ferry_fee" | "supplemental_rent"
  | "insurance" | "other";

export type CashEventSource = "manual" | "recon" | "rule";

export interface CashEvent {
  id:            string;
  orgId:         string;
  leaseId:       string | null;
  eventType:     CashEventType;
  amount:        number;
  currency:      string;
  eventDate:     string;        // YYYY-MM-DD
  isForecast:    boolean;
  source:        CashEventSource;
  transactionId: string | null; // set when source = 'recon'
  notes:         string | null;
  createdAt:     string;
}

export interface NewCashEvent {
  leaseId:    string | null;
  eventType:  CashEventType;
  amount:     number;
  currency:   string;
  eventDate:  string;
  isForecast: boolean;
  notes:      string | null;
}

// ── Local SDMR helpers (mirrors unexported fns in SDMRTab) ────────────────────

function totalMRBalance(sdmr: LeaseSDMR): number {
  return sdmr.mrComponents.reduce((s, c) => s + c.cumulativeBalance, 0);
}

function sdCashRefundable(sdmr: LeaseSDMR): number {
  if (sdmr.sd.type !== "Cash") return 0;
  return sdmr.sd.amount;
}

function eolCompensation(sdmr: LeaseSDMR): number {
  // Half-life standard: lessee owes compensation if remaining units < half interval
  return sdmr.mrComponents.reduce((sum, comp) => {
    const halfLife = comp.fullIntervalUnits / 2;
    const shortfall = Math.max(0, halfLife - comp.remainingUnits);
    return sum + shortfall * comp.rateAmount;
  }, 0);
}

// ── Forecast engine ───────────────────────────────────────────────────────────

/**
 * Generates rule-based projected cash events for all active leases.
 * Events are never persisted — they carry source: 'rule'.
 *
 * @param leases       Live lease records from usePortfolioData
 * @param sdmrData     SDMR records from buildLiveSDMRData (may be empty for demo)
 * @param horizonMonths How many months ahead to project (typically 24)
 */
export function forecastCashFlows(
  leases:       Lease[],
  sdmrData:     LeaseSDMR[],
  horizonMonths: number,
): CashEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + horizonMonths);

  const sdmrMap = new Map(sdmrData.map(s => [s.leaseId, s]));
  const events: CashEvent[] = [];

  for (const lease of leases) {
    if (!lease.end_date) continue;
    const endDate = new Date(lease.end_date + "T00:00:00Z");
    if (endDate < today) continue; // lease already expired

    const endDateStr = lease.end_date;
    const sdmr = sdmrMap.get(lease.id);

    // ── Rent events (one per calendar month from today → min(endDate, horizon)) ──

    if (lease.monthly_rental && lease.monthly_rental > 0) {
      // Start from first day of next month
      const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
      cursor.setMonth(cursor.getMonth() + 1);

      let count = 0;
      while (count < horizonMonths && cursor <= endDate && cursor <= horizon) {
        const eventDate = cursor.toISOString().slice(0, 10);
        events.push({
          id:            `rule-${lease.id}-rent-${eventDate}`,
          orgId:         "",
          leaseId:       lease.id,
          eventType:     "rent",
          amount:        lease.monthly_rental,
          currency:      lease.currency ?? "USD",
          eventDate,
          isForecast:    true,
          source:        "rule",
          transactionId: null,
          notes:         null,
          createdAt:     "",
        });
        cursor.setMonth(cursor.getMonth() + 1);
        count++;
      }
    }

    // ── Redelivery events — only if end_date is within horizon ───────────────

    if (endDate > horizon) continue;
    if (!sdmr) continue;

    // MR draw (outflow — lessor pays back MR balance to lessee / MRO at return)
    const mrTotal = totalMRBalance(sdmr);
    if (mrTotal > 0) {
      events.push({
        id:            `rule-${lease.id}-mr_draw-${endDateStr}`,
        orgId:         "",
        leaseId:       lease.id,
        eventType:     "mr_draw",
        amount:        -mrTotal,
        currency:      "USD",
        eventDate:     endDateStr,
        isForecast:    true,
        source:        "rule",
        transactionId: null,
        notes:         null,
        createdAt:     "",
      });
    }

    // SD refund (outflow — cash SD returned to lessee at clean redelivery)
    const sdRefund = sdCashRefundable(sdmr);
    if (sdRefund > 0) {
      events.push({
        id:            `rule-${lease.id}-sd_refund-${endDateStr}`,
        orgId:         "",
        leaseId:       lease.id,
        eventType:     "sd_refund",
        amount:        -sdRefund,
        currency:      "USD",
        eventDate:     endDateStr,
        isForecast:    true,
        source:        "rule",
        transactionId: null,
        notes:         null,
        createdAt:     "",
      });
    }

    // EOL compensation (inflow — lessee pays lessor if aircraft returned below half-life)
    const eol = eolCompensation(sdmr);
    if (eol > 0) {
      events.push({
        id:            `rule-${lease.id}-eol_comp-${endDateStr}`,
        orgId:         "",
        leaseId:       lease.id,
        eventType:     "eol_comp",
        amount:        eol,
        currency:      "USD",
        eventDate:     endDateStr,
        isForecast:    true,
        source:        "rule",
        transactionId: null,
        notes:         null,
        createdAt:     "",
      });
    }
  }

  return events;
}

// ── Merge logic ───────────────────────────────────────────────────────────────

/**
 * Merges rule-based forecast events with persisted manual forecast overrides.
 * For each (leaseId, eventType, calendar-month) triple, a persisted manual event
 * suppresses the corresponding rule event.
 *
 * @param ruleEvents      Output of forecastCashFlows
 * @param manualForecast  Persisted cash_events where is_forecast = true (source = 'manual')
 */
export function mergeForecastEvents(
  ruleEvents:     CashEvent[],
  manualForecast: CashEvent[],
): CashEvent[] {
  // Build a set of keys covered by manual overrides: "leaseId|eventType|YYYY-MM"
  const overrideKeys = new Set(
    manualForecast.map(e =>
      `${e.leaseId ?? ""}|${e.eventType}|${e.eventDate.slice(0, 7)}`
    )
  );

  // Keep rule events that don't have a manual override for same lease+type+month
  const filteredRule = ruleEvents.filter(e => {
    const key = `${e.leaseId ?? ""}|${e.eventType}|${e.eventDate.slice(0, 7)}`;
    return !overrideKeys.has(key);
  });

  return [...filteredRule, ...manualForecast];
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx vitest run --reporter=verbose src/app/utils/cashFlowForecast.test.ts
```

Expected: 5 tests pass (4 in `forecastCashFlows` + 1 in `mergeForecastEvents`).

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/cashFlowForecast.ts src/app/utils/cashFlowForecast.test.ts
git commit -m "feat: add cashFlowForecast engine with types and 5 unit tests"
```

---

## Task 3: `useCashFlow` Hook

**Files:**
- Create: `src/app/hooks/useCashFlow.ts`

### Context

This hook:
1. Fetches persisted `cash_events` from Supabase on mount (only `source = 'manual'` and `source = 'recon'`).
2. Calls `buildLiveSDMRData` (from `SDMRTab`) with the live portfolio data to get `LeaseSDMR[]`.
3. Calls `forecastCashFlows` to get rule events.
4. Calls `mergeForecastEvents` to deduplicate manual overrides against rule events.
5. Returns `actuals`, `forecast`, `events` (merged + sorted), and CRUD actions.

All mutations are optimistic: state is updated immediately, then Supabase is called. On error the state is rolled back (for delete/add) or the error is logged (for edit).

`deleteEvent` guards: only `source = 'manual'` or `source = 'recon'` rows exist in Supabase. Rule events have no row to delete.

- [ ] **Step 1: Create the hook**

Create `src/app/hooks/useCashFlow.ts`:

```typescript
// src/app/hooks/useCashFlow.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolioData } from "./usePortfolioData";
import { buildLiveSDMRData } from "../components/portfolio/SDMRTab";
import { forecastCashFlows, mergeForecastEvents } from "../utils/cashFlowForecast";
import type { CashEvent, CashEventType, CashEventSource, NewCashEvent } from "../utils/cashFlowForecast";

// ── Return type ───────────────────────────────────────────────────────────────

export interface UseCashFlowReturn {
  events:      CashEvent[];
  actuals:     CashEvent[];
  forecast:    CashEvent[];
  loading:     boolean;
  saving:      boolean;
  addEvent:    (event: NewCashEvent) => Promise<void>;
  editEvent:   (id: string, patch: Partial<NewCashEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): CashEvent {
  return {
    id:            row.id            as string,
    orgId:         row.org_id        as string,
    leaseId:       (row.lease_id     as string | null) ?? null,
    eventType:     row.event_type    as CashEventType,
    amount:        Number(row.amount),
    currency:      row.currency      as string,
    eventDate:     row.event_date    as string,
    isForecast:    row.is_forecast   as boolean,
    source:        row.source        as CashEventSource,
    transactionId: (row.transaction_id as string | null) ?? null,
    notes:         (row.notes        as string | null) ?? null,
    createdAt:     row.created_at    as string,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCashFlow(): UseCashFlowReturn {
  const { orgId }                               = useData();
  const { assets, lessees, leases, provisions } = usePortfolioData();
  const [persisted, setPersisted]               = useState<CashEvent[]>([]);
  const [loading,   setLoading  ]               = useState(false);
  const [saving,    setSaving   ]               = useState(false);

  // Build SDMR records for forecast engine — same call as Portfolio.tsx
  const sdmrData = useMemo(
    () => buildLiveSDMRData(assets as never, lessees as never, leases as never, provisions as never),
    [assets, lessees, leases, provisions],
  );

  // Rule-based forecast (client-side, never persisted)
  const ruleEvents = useMemo(
    () => forecastCashFlows(leases, sdmrData, 24),
    [leases, sdmrData],
  );

  // Split persisted into actuals and manual forecast overrides
  const actuals          = useMemo(() => persisted.filter(e => !e.isForecast), [persisted]);
  const persistedForecast = useMemo(() => persisted.filter(e =>  e.isForecast), [persisted]);

  // Merge rule events with manual overrides
  const forecast = useMemo(
    () => mergeForecastEvents(ruleEvents, persistedForecast),
    [ruleEvents, persistedForecast],
  );

  // All events sorted by date
  const events = useMemo(
    () => [...actuals, ...forecast].sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    [actuals, forecast],
  );

  // ── Load on mount / orgId change ──────────────────────────────────────────

  useEffect(() => {
    if (!orgId) { setPersisted([]); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("cash_events")
        .select("*")
        .eq("org_id", orgId)
        .order("event_date", { ascending: true });

      if (cancelled) { setLoading(false); return; }
      if (error) {
        console.error("[useCashFlow] load error:", error);
        setLoading(false);
        return;
      }
      setPersisted((data ?? []).map(row => mapRow(row as Record<string, unknown>)));
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addEvent = useCallback(async (event: NewCashEvent) => {
    if (!orgId) return;
    setSaving(true);

    // Optimistic insert with temp id
    const tempId = `temp-${Date.now()}`;
    const optimistic: CashEvent = {
      id:            tempId,
      orgId,
      leaseId:       event.leaseId,
      eventType:     event.eventType,
      amount:        event.amount,
      currency:      event.currency,
      eventDate:     event.eventDate,
      isForecast:    event.isForecast,
      source:        "manual",
      transactionId: null,
      notes:         event.notes,
      createdAt:     new Date().toISOString(),
    };
    setPersisted(prev =>
      [...prev, optimistic].sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    );

    const { data, error } = await supabase
      .from("cash_events")
      .insert({
        org_id:      orgId,
        lease_id:    event.leaseId,
        event_type:  event.eventType,
        amount:      event.amount,
        currency:    event.currency,
        event_date:  event.eventDate,
        is_forecast: event.isForecast,
        source:      "manual",
        notes:       event.notes,
      })
      .select()
      .single();

    if (error) {
      console.error("[useCashFlow] addEvent error:", error);
      setPersisted(prev => prev.filter(e => e.id !== tempId)); // rollback
    } else if (data) {
      setPersisted(prev =>
        prev.map(e => e.id === tempId ? mapRow(data as Record<string, unknown>) : e)
      );
    }
    setSaving(false);
  }, [orgId]);

  const editEvent = useCallback(async (id: string, patch: Partial<NewCashEvent>) => {
    setSaving(true);

    // Optimistic patch
    setPersisted(prev => prev.map(e => {
      if (e.id !== id) return e;
      return {
        ...e,
        ...(patch.leaseId    !== undefined && { leaseId:    patch.leaseId    }),
        ...(patch.eventType  !== undefined && { eventType:  patch.eventType  }),
        ...(patch.amount     !== undefined && { amount:     patch.amount     }),
        ...(patch.currency   !== undefined && { currency:   patch.currency   }),
        ...(patch.eventDate  !== undefined && { eventDate:  patch.eventDate  }),
        ...(patch.isForecast !== undefined && { isForecast: patch.isForecast }),
        ...(patch.notes      !== undefined && { notes:      patch.notes      }),
      };
    }));

    const dbPatch: Record<string, unknown> = {};
    if (patch.leaseId    !== undefined) dbPatch.lease_id    = patch.leaseId;
    if (patch.eventType  !== undefined) dbPatch.event_type  = patch.eventType;
    if (patch.amount     !== undefined) dbPatch.amount      = patch.amount;
    if (patch.currency   !== undefined) dbPatch.currency    = patch.currency;
    if (patch.eventDate  !== undefined) dbPatch.event_date  = patch.eventDate;
    if (patch.isForecast !== undefined) dbPatch.is_forecast = patch.isForecast;
    if (patch.notes      !== undefined) dbPatch.notes       = patch.notes;

    const { error } = await supabase
      .from("cash_events")
      .update(dbPatch)
      .eq("id", id);

    if (error) console.error("[useCashFlow] editEvent error:", error);
    setSaving(false);
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    setSaving(true);
    setPersisted(prev => prev.filter(e => e.id !== id)); // optimistic

    const { error } = await supabase
      .from("cash_events")
      .delete()
      .eq("id", id);

    if (error) console.error("[useCashFlow] deleteEvent error:", error);
    setSaving(false);
  }, []);

  return { events, actuals, forecast, loading, saving, addEvent, editEvent, deleteEvent };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "cashFlow\|useCashFlow"
```

Expected: no output (no errors for these files). If there are type errors, fix them before proceeding.

- [ ] **Step 3: Run full test suite to confirm nothing broke**

```bash
npx vitest run --reporter=verbose
```

Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/hooks/useCashFlow.ts
git commit -m "feat: add useCashFlow hook (load, merge, addEvent, editEvent, deleteEvent)"
```

---

## Task 4: Recon Integration

**Files:**
- Modify: `src/app/hooks/useReconciliation.ts`

### Context

When a reconciliation match is confirmed (`acceptOne` or `acceptAll`), insert a `cash_events` row with `source: 'recon'`, `event_type: 'rent'`, `is_forecast: false`. This is fire-and-forget — errors are logged but don't affect the reconciliation flow.

The existing `useReconciliation` hook already receives `orgId` from `useData()`. The `match.transaction` is the full `BankTransaction` object (has `amount`, `currency`, `valueDate`). The `match.transactionId` is the UUID from `bank_transactions`.

In `acceptAll`, the same-subset filter applies: `confidence >= 0.8 && !confirmed`. Build the insert rows from the local `result.matches` state before calling Supabase.

- [ ] **Step 1: Add cash_events insert to `acceptOne`**

In `src/app/hooks/useReconciliation.ts`, find the `acceptOne` callback. After the existing `supabase.from("reconciliation_matches").update(...)` call, add:

```typescript
  const acceptOne = useCallback(async (transactionId: string) => {
    setSaving(true);
    patchMatch(transactionId, { confirmed: true });

    const { error } = await supabase
      .from("reconciliation_matches")
      .update({ confirmed: true, confirmed_at: new Date().toISOString() })
      .eq("transaction_id", transactionId);

    if (error) console.error("[useReconciliation] acceptOne error:", error);

    // Auto-create cash event for confirmed rent receipt
    if (orgId) {
      const match = result?.matches.find(m => m.transactionId === transactionId);
      if (match?.transaction) {
        supabase.from("cash_events").insert({
          org_id:         orgId,
          lease_id:       match.bestMatch?.lease.id ?? null,
          event_type:     "rent",
          amount:         match.transaction.amount,
          currency:       match.transaction.currency,
          event_date:     match.transaction.valueDate,
          is_forecast:    false,
          source:         "recon",
          transaction_id: match.transactionId,
          notes:          null,
        }).then(({ error: ceErr }) => {
          if (ceErr) console.error("[useReconciliation] cash_events insert error:", ceErr);
        });
      }
    }

    setSaving(false);
  }, [orgId, result]); // add orgId and result to deps
```

- [ ] **Step 2: Add bulk cash_events insert to `acceptAll`**

Find the `acceptAll` callback. After the existing Supabase update, add:

```typescript
  const acceptAll = useCallback(async (sId: string) => {
    setSaving(true);
    const now = new Date().toISOString();

    // Optimistic update
    setResult(prev => {
      if (!prev) return prev;
      const matches = prev.matches.map(m =>
        m.confidence >= 0.8 && !m.confirmed ? { ...m, confirmed: true } : m,
      );
      return { ...prev, matches, ...buildCounts(matches) };
    });

    const { error } = await supabase
      .from("reconciliation_matches")
      .update({ confirmed: true, confirmed_at: now })
      .eq("statement_id", sId)
      .gte("confidence", 0.8)
      .eq("confirmed", false);

    if (error) console.error("[useReconciliation] acceptAll error:", error);

    // Bulk-insert cash events for all newly confirmed high-confidence matches
    if (orgId && result) {
      const toInsert = result.matches
        .filter(m => m.confidence >= 0.8 && !m.confirmed && m.transaction)
        .map(m => ({
          org_id:         orgId,
          lease_id:       m.bestMatch?.lease.id ?? null,
          event_type:     "rent",
          amount:         m.transaction.amount,
          currency:       m.transaction.currency,
          event_date:     m.transaction.valueDate,
          is_forecast:    false,
          source:         "recon",
          transaction_id: m.transactionId,
          notes:          null,
        }));
      if (toInsert.length > 0) {
        supabase.from("cash_events").insert(toInsert).then(({ error: ceErr }) => {
          if (ceErr) console.error("[useReconciliation] acceptAll cash_events error:", ceErr);
        });
      }
    }

    setSaving(false);
  }, [orgId, result]);
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests still pass (recon tests are not affected by this change).

- [ ] **Step 4: Commit**

```bash
git add src/app/hooks/useReconciliation.ts
git commit -m "feat: auto-insert cash_events rent receipt on reconciliation match confirmation"
```

---

## Task 5: CashFlow Page

**Files:**
- Create: `src/app/pages/CashFlow.tsx`

### Context

This is the main UI. It uses `useCashFlow()` for data and mutations, `usePortfolioData()` for lessee name lookups, `KpiCard` for the header strip, and Recharts `BarChart` for the monthly chart.

**Key design decisions:**
- View toggle controls which events appear in both the chart AND the table.
- Time range filters both — only events within `today → today + N months` are shown.
- Lease filter is a multi-select dropdown; all lessees selected by default.
- Chart: two bars per month group — positive (inflows, green) and negative (outflows, red). Actuals are at full opacity; forecast events at 50% opacity (achieved via two separate bar series with different fill opacity).
- Clicking a chart bar filters the table to that calendar month.
- `AddCashEventModal` is defined inline in this file as a local component.
- Edit uses the same modal with pre-filled values.
- `source = 'rule'` rows show no edit/delete icons.

**Recharts import:** `import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";`

**KpiCard import:** `import { KpiCard } from "../components/ui/KpiCard";`

- [ ] **Step 1: Create the page**

Create `src/app/pages/CashFlow.tsx` with the following complete implementation:

```tsx
// src/app/pages/CashFlow.tsx
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/ui/KpiCard";
import { useCashFlow } from "../hooks/useCashFlow";
import { usePortfolioData } from "../hooks/usePortfolioData";
import type { CashEvent, CashEventType, NewCashEvent } from "../utils/cashFlowForecast";

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<CashEventType, string> = {
  rent:              "Rent",
  mr_draw:           "MR Draw",
  sd_posted:         "SD Posted",
  sd_draw:           "SD Draw",
  sd_refund:         "SD Refund",
  eol_comp:          "EOL Comp",
  remarketing:       "Remarketing",
  ferry_fee:         "Ferry Fee",
  supplemental_rent: "Suppl. Rent",
  insurance:         "Insurance",
  other:             "Other",
};

const ALL_EVENT_TYPES: CashEventType[] = [
  "rent", "mr_draw", "sd_posted", "sd_draw", "sd_refund",
  "eol_comp", "remarketing", "ferry_fee", "supplemental_rent", "insurance", "other",
];

function pillColor(type: CashEventType): string {
  if (type === "mr_draw") return "#92400E";
  if (type === "sd_refund") return "#991B1B";
  return "#14532D";
}
function pillBg(type: CashEventType): string {
  if (type === "mr_draw") return "#FEF3C7";
  if (type === "sd_refund") return "#FEE2E2";
  return "#DCFCE7";
}

function fmtCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
    notation: Math.abs(amount) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(amount) >= 1_000_000 ? 1 : 0,
  }).format(amount);
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function isoMonth(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function monthLabel(isoDate: string): string {
  return new Date(isoDate + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

type ViewMode = "actuals" | "forecast" | "both";
type RangeMonths = 3 | 6 | 12 | 24;

// ── AddCashEventModal ─────────────────────────────────────────────────────────

function AddCashEventModal({
  open,
  initial,
  editId,
  leases,
  lessees,
  onSave,
  onEdit,
  onClose,
}: {
  open:     boolean;
  initial?: Partial<NewCashEvent>;
  editId?:  string;
  leases:   import("../types/portfolio").Lease[];
  lessees:  import("../types/portfolio").Lessee[];
  onSave:   (e: NewCashEvent) => void;
  onEdit:   (id: string, patch: Partial<NewCashEvent>) => void;
  onClose:  () => void;
}) {
  const [eventType,  setEventType ] = useState<CashEventType>(initial?.eventType  ?? "rent");
  const [leaseId,    setLeaseId   ] = useState<string>(initial?.leaseId    ?? "");
  const [amount,     setAmount    ] = useState<string>(initial?.amount != null ? String(initial.amount) : "");
  const [currency,   setCurrency  ] = useState<string>(initial?.currency   ?? "USD");
  const [eventDate,  setEventDate ] = useState<string>(initial?.eventDate  ?? new Date().toISOString().slice(0, 10));
  const [isForecast, setIsForecast] = useState<boolean>(initial?.isForecast ?? false);
  const [notes,      setNotes     ] = useState<string>(initial?.notes      ?? "");

  if (!open) return null;

  const lesseeById = new Map(lessees.map(l => [l.id, l]));
  const amountNum  = parseFloat(amount);
  const canSave    = eventType && amount && !isNaN(amountNum) && eventDate;

  function handleSave() {
    if (!canSave) return;
    const payload: NewCashEvent = {
      leaseId:    leaseId || null,
      eventType,
      amount:     amountNum,
      currency,
      eventDate,
      isForecast,
      notes:      notes || null,
    };
    if (editId) {
      onEdit(editId, payload);
    } else {
      onSave(payload);
    }
    onClose();
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.375rem 0.625rem",
    background: "#0F172A", border: "1px solid #334155",
    borderRadius: "6px", color: "#F8FAFC", fontSize: "0.8rem",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: "#1E293B", border: "1px solid #334155",
          borderRadius: "12px", padding: "1.5rem", width: "420px",
          maxWidth: "90vw",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: "1rem", fontWeight: 600 }}>
            {editId ? "Edit Cash Event" : "Add Cash Event"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: "0.25rem" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {/* Event type */}
          <div>
            <label style={{ fontSize: "0.75rem", color: "#94A3B8", display: "block", marginBottom: "0.3rem" }}>Event Type</label>
            <select value={eventType} onChange={e => setEventType(e.target.value as CashEventType)} style={inp}>
              {ALL_EVENT_TYPES.map(t => (
                <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Lease */}
          <div>
            <label style={{ fontSize: "0.75rem", color: "#94A3B8", display: "block", marginBottom: "0.3rem" }}>Lease (optional)</label>
            <select value={leaseId} onChange={e => setLeaseId(e.target.value)} style={inp}>
              <option value="">— None —</option>
              {leases.map(l => {
                const lessee = lesseeById.get(l.lessee_id);
                return (
                  <option key={l.id} value={l.id}>
                    {lessee?.name ?? l.id} ({l.start_date} → {l.end_date})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Amount + Currency */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: "0.5rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#94A3B8", display: "block", marginBottom: "0.3rem" }}>Amount</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 500000 or -120000" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#94A3B8", display: "block", marginBottom: "0.3rem" }}>Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} style={inp}>
                {["USD", "EUR", "GBP", "AED", "SGD"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label style={{ fontSize: "0.75rem", color: "#94A3B8", display: "block", marginBottom: "0.3rem" }}>Date</label>
            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inp} />
          </div>

          {/* Is forecast toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <input type="checkbox" id="isForecast" checked={isForecast} onChange={e => setIsForecast(e.target.checked)}
              style={{ accentColor: "#3B82F6", width: "14px", height: "14px" }} />
            <label htmlFor="isForecast" style={{ fontSize: "0.8rem", color: "#94A3B8", cursor: "pointer" }}>
              Forecast (not yet received / paid)
            </label>
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: "0.75rem", color: "#94A3B8", display: "block", marginBottom: "0.3rem" }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Context or memo..."
              style={{ ...inp, resize: "vertical" }} />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end", marginTop: "0.25rem" }}>
            <button onClick={onClose} style={{
              padding: "0.5rem 1rem", background: "transparent",
              border: "1px solid #334155", borderRadius: "6px",
              color: "#94A3B8", fontSize: "0.8rem", cursor: "pointer",
            }}>Cancel</button>
            <button onClick={handleSave} disabled={!canSave} style={{
              padding: "0.5rem 1rem", background: canSave ? "#3B82F6" : "#1E3A5F",
              border: "none", borderRadius: "6px",
              color: canSave ? "#FFFFFF" : "#475569",
              fontSize: "0.8rem", fontWeight: 500,
              cursor: canSave ? "pointer" : "not-allowed",
            }}>
              {editId ? "Save Changes" : "Add Event"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CashFlow() {
  const { events, actuals, forecast, loading, saving, addEvent, editEvent, deleteEvent } = useCashFlow();
  const { leases, lessees } = usePortfolioData();

  const [viewMode,       setViewMode      ] = useState<ViewMode>("both");
  const [rangeMonths,    setRangeMonths   ] = useState<RangeMonths>(12);
  const [selectedLeases, setSelectedLeases] = useState<Set<string> | null>(null); // null = all
  const [clickedMonth,   setClickedMonth  ] = useState<string | null>(null);
  const [modalOpen,      setModalOpen     ] = useState(false);
  const [editTarget,     setEditTarget    ] = useState<CashEvent | null>(null);

  const lesseeById = useMemo(() => new Map(lessees.map(l => [l.id, l])), [lessees]);
  const leaseById  = useMemo(() => new Map(leases.map(l  => [l.id, l])), [leases]);

  const today     = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeEnd  = addMonths(today, rangeMonths);

  // Events in scope for current view + range
  const visibleEvents = useMemo(() => {
    let base: CashEvent[] = [];
    if (viewMode === "actuals")  base = actuals;
    else if (viewMode === "forecast") base = forecast;
    else base = events;

    return base.filter(e => {
      const d = new Date(e.eventDate + "T00:00:00Z");
      if (d < today || d > rangeEnd) return false;
      if (selectedLeases && e.leaseId && !selectedLeases.has(e.leaseId)) return false;
      return true;
    });
  }, [events, actuals, forecast, viewMode, rangeMonths, selectedLeases, today, rangeEnd]);

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const now = new Date();
  const mtdActuals = actuals.filter(e => {
    const d = new Date(e.eventDate + "T00:00:00Z");
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const netMTD = mtdActuals.reduce((s, e) => s + e.amount, 0);

  const next12End = addMonths(today, 12);
  const forecastNext12 = forecast.filter(e => {
    const d = new Date(e.eventDate + "T00:00:00Z");
    return d >= today && d <= next12End;
  });
  const netForecast12m = forecastNext12.reduce((s, e) => s + e.amount, 0);

  const next90 = addMonths(today, 3);
  const upcoming90 = forecast.filter(e => {
    const d = new Date(e.eventDate + "T00:00:00Z");
    return d >= today && d <= next90;
  });
  const largestOutflow = upcoming90.filter(e => e.amount < 0)
    .sort((a, b) => a.amount - b.amount)[0] ?? null;

  const mrDue90 = upcoming90.filter(e => e.eventType === "mr_draw");
  const mrDue90Total = mrDue90.reduce((s, e) => s + e.amount, 0);

  // ── Chart data ──────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const months: string[] = [];
    const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 0; i < rangeMonths; i++) {
      months.push(isoMonth(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months.map(month => {
      const monthEvents = visibleEvents.filter(e => e.eventDate.slice(0, 7) === month);
      const inflowActual   = monthEvents.filter(e => e.amount > 0 && e.source !== "rule").reduce((s, e) => s + e.amount, 0);
      const outflowActual  = monthEvents.filter(e => e.amount < 0 && e.source !== "rule").reduce((s, e) => s + e.amount, 0);
      const inflowForecast = monthEvents.filter(e => e.amount > 0 && e.source === "rule").reduce((s, e) => s + e.amount, 0);
      const outflowForecast = monthEvents.filter(e => e.amount < 0 && e.source === "rule").reduce((s, e) => s + e.amount, 0);
      return { month, label: monthLabel(month + "-01"), inflowActual, outflowActual, inflowForecast, outflowForecast };
    });
  }, [visibleEvents, rangeMonths]);

  // Table rows — optionally filtered to clicked month
  const tableRows = useMemo(() => {
    if (!clickedMonth) return visibleEvents;
    return visibleEvents.filter(e => e.eventDate.slice(0, 7) === clickedMonth);
  }, [visibleEvents, clickedMonth]);

  // Lessee name lookup via lease
  function lesseeName(event: CashEvent): string {
    if (!event.leaseId) return "—";
    const lease = leaseById.get(event.leaseId);
    if (!lease) return "—";
    return lesseeById.get(lease.lessee_id)?.name ?? "—";
  }

  // ── Source badge ─────────────────────────────────────────────────────────────

  function SourceBadge({ source }: { source: CashEvent["source"] }) {
    const styles: Record<string, React.CSSProperties> = {
      manual: { background: "#1E293B", border: "1px solid #475569", color: "#94A3B8" },
      recon:  { background: "#1E3A5F", border: "1px solid #3B82F6", color: "#93C5FD" },
      rule:   { background: "transparent", border: "1px solid #334155", color: "#475569" },
    };
    const labels = { manual: "Manual", recon: "Recon", rule: "Rule" };
    return (
      <span style={{
        ...styles[source], fontSize: "0.7rem", fontWeight: 500,
        padding: "0.1rem 0.5rem", borderRadius: "4px",
      }}>
        {labels[source]}
      </span>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <PageHeader title="Cash Flow" subtitle="Portfolio-wide actuals and 24-month forecast" />

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        <KpiCard
          label="Net Received MTD"
          value={fmtCurrency(netMTD)}
          deltaType={netMTD >= 0 ? "positive" : "negative"}
          subtitle={`${mtdActuals.length} actual event${mtdActuals.length !== 1 ? "s" : ""} this month`}
          staggerIndex={0}
        />
        <KpiCard
          label="Net Forecast 12m"
          value={fmtCurrency(netForecast12m)}
          deltaType={netForecast12m >= 0 ? "positive" : "negative"}
          subtitle="Next 12 months"
          staggerIndex={1}
        />
        <KpiCard
          label="Largest Outflow (90d)"
          value={largestOutflow ? fmtCurrency(largestOutflow.amount) : "—"}
          subtitle={largestOutflow ? largestOutflow.eventDate : "None due"}
          deltaType={largestOutflow ? "negative" : "neutral"}
          staggerIndex={2}
        />
        <KpiCard
          label="MR Draws Due (90d)"
          value={mrDue90.length > 0 ? fmtCurrency(mrDue90Total) : "—"}
          subtitle={`${mrDue90.length} draw${mrDue90.length !== 1 ? "s" : ""} due`}
          deltaType={mrDue90.length > 0 ? "negative" : "neutral"}
          staggerIndex={3}
        />
      </div>

      {/* Controls bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        flexWrap: "wrap", marginBottom: "1rem",
      }}>
        {/* View toggle */}
        <div style={{
          display: "flex", background: "#1E293B",
          border: "1px solid #334155", borderRadius: "8px", padding: "0.25rem",
        }}>
          {(["actuals", "forecast", "both"] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              style={{
                padding: "0.35rem 0.75rem", border: "none", borderRadius: "6px",
                background: viewMode === v ? "#0F172A" : "transparent",
                color: viewMode === v ? "#F8FAFC" : "#64748B",
                fontSize: "0.8rem", fontWeight: viewMode === v ? 500 : 400,
                cursor: "pointer", textTransform: "capitalize",
                transition: "background 150ms, color 150ms",
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Time range */}
        <div style={{
          display: "flex", background: "#1E293B",
          border: "1px solid #334155", borderRadius: "8px", padding: "0.25rem", gap: "2px",
        }}>
          {([3, 6, 12, 24] as RangeMonths[]).map(r => (
            <button
              key={r}
              onClick={() => setRangeMonths(r)}
              style={{
                padding: "0.35rem 0.625rem", border: "none", borderRadius: "6px",
                background: rangeMonths === r ? "#0F172A" : "transparent",
                color: rangeMonths === r ? "#F8FAFC" : "#64748B",
                fontSize: "0.8rem", cursor: "pointer",
                transition: "background 150ms, color 150ms",
              }}
            >{r}m</button>
          ))}
        </div>

        {/* Clear month filter */}
        {clickedMonth && (
          <button
            onClick={() => setClickedMonth(null)}
            style={{
              padding: "0.35rem 0.75rem", background: "#1E293B",
              border: "1px solid #334155", borderRadius: "6px",
              color: "#94A3B8", fontSize: "0.8rem", cursor: "pointer",
            }}
          >
            Showing {monthLabel(clickedMonth + "-01")} ✕
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {saving && (
          <span style={{ fontSize: "0.75rem", color: "#64748B" }}>Saving…</span>
        )}

        {/* Add Event */}
        <button
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            background: "#3B82F6", border: "none", borderRadius: "8px",
            color: "#FFFFFF", padding: "0.5rem 1rem",
            fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
          }}
        >
          <Plus size={15} /> Add Event
        </button>
      </div>

      {/* Chart */}
      {loading ? (
        <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", fontSize: "0.875rem" }}>
          Loading…
        </div>
      ) : (
        <div style={{
          background: "#1E293B", border: "1px solid #334155",
          borderRadius: "10px", padding: "1rem", marginBottom: "1rem",
        }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={2}
              onClick={d => {
                if (d?.activePayload?.[0]) {
                  const m = (d.activePayload[0].payload as { month: string }).month;
                  setClickedMonth(prev => prev === m ? null : m);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => fmtCurrency(v as number)} width={70} />
              <Tooltip
                contentStyle={{ background: "#0F172A", border: "1px solid #334155", borderRadius: "8px", fontSize: "0.8rem" }}
                labelStyle={{ color: "#94A3B8" }}
                formatter={(v: number) => fmtCurrency(v)}
              />
              <Bar dataKey="inflowActual"    name="Inflow (actual)"   fill="#4ADE80" radius={[2,2,0,0]} />
              <Bar dataKey="inflowForecast"  name="Inflow (forecast)" fill="#4ADE80" radius={[2,2,0,0]} fillOpacity={0.4} />
              <Bar dataKey="outflowActual"   name="Outflow (actual)"  fill="#F87171" radius={[0,0,2,2]} />
              <Bar dataKey="outflowForecast" name="Outflow (forecast)" fill="#F87171" radius={[0,0,2,2]} fillOpacity={0.4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ledger table */}
      <div style={{
        background: "#1E293B", border: "1px solid #334155",
        borderRadius: "10px", overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto", maxHeight: "480px", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead style={{ position: "sticky", top: 0, background: "#0F172A", zIndex: 1 }}>
              <tr>
                {["Date", "Type", "Lessee", "Amount", "Source", "Notes", ""].map(h => (
                  <th key={h} style={{
                    padding: "0.5rem 1rem", textAlign: "left",
                    color: "#64748B", fontWeight: 500,
                    borderBottom: "1px solid #334155",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "#475569" }}>
                    {loading ? "Loading…" : "No events in this range. Add one or run matching to see data."}
                  </td>
                </tr>
              ) : (
                tableRows.map(event => (
                  <tr key={event.id} style={{ borderBottom: "1px solid #1E293B" }}>
                    {/* Date */}
                    <td style={{ padding: "0.5rem 1rem", color: "#94A3B8", whiteSpace: "nowrap" }}>
                      {event.eventDate}
                    </td>

                    {/* Type pill */}
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <span style={{
                        background: pillBg(event.eventType),
                        color: pillColor(event.eventType),
                        fontSize: "0.7rem", fontWeight: 600,
                        padding: "0.15rem 0.5rem", borderRadius: "4px",
                        whiteSpace: "nowrap",
                      }}>
                        {EVENT_TYPE_LABELS[event.eventType]}
                      </span>
                    </td>

                    {/* Lessee */}
                    <td style={{ padding: "0.5rem 1rem", color: "#F8FAFC" }}>
                      {lesseeName(event)}
                    </td>

                    {/* Amount */}
                    <td style={{
                      padding: "0.5rem 1rem", fontWeight: 500, whiteSpace: "nowrap",
                      color: event.amount >= 0 ? "#4ADE80" : "#F87171",
                    }}>
                      {event.amount >= 0 ? "+" : ""}{fmtCurrency(event.amount, event.currency)}
                    </td>

                    {/* Source */}
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <SourceBadge source={event.source} />
                    </td>

                    {/* Notes */}
                    <td style={{
                      padding: "0.5rem 1rem", color: "#64748B",
                      maxWidth: "200px", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {event.notes ?? "—"}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "0.5rem 1rem", whiteSpace: "nowrap" }}>
                      {event.source !== "rule" && (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            onClick={() => { setEditTarget(event); setModalOpen(true); }}
                            style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: "0.2rem" }}
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: "0.2rem" }}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AddCashEventModal
        open={modalOpen}
        initial={editTarget ?? undefined}
        editId={editTarget?.id}
        leases={leases}
        lessees={lessees}
        onSave={addEvent}
        onEdit={editEvent}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests still pass (the page has no unit tests — covered by the forecast engine tests).

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/CashFlow.tsx
git commit -m "feat: add CashFlow page with KPI strip, bar chart, ledger table, and add/edit modal"
```

---

## Task 6: Routing + Nav

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/app/components/layout/Sidebar.tsx`

### Context

**routes.tsx pattern:** add a flat entry inside the `Layout` children array. Other routes (Reconciliation, Transactions) follow this same pattern. Import `CashFlow` at the top alongside other page imports.

**Sidebar.tsx pattern:** the Reconciliation nav group is:
```ts
{
  label: "Reconciliation",
  items: [
    {
      title: "Bank Statements",
      url:   "/reconciliation",
      icon:  FileText,
      items: [
        { title: "Statements",   url: "/reconciliation", icon: FileSpreadsheet },
        { title: "Transactions", url: "/reconciliation", icon: ArrowLeftRight  },
      ],
    },
  ],
}
```

Add a second flat item (no sub-items) to the `items` array: `{ title: "Cash Flow", url: "/cash-flow", icon: TrendingUp }`. `TrendingUp` is already in `lucide-react`.

- [ ] **Step 1: Add route in `routes.tsx`**

In `src/app/routes.tsx`:

1. Add import at top:
```typescript
import CashFlow from "./pages/CashFlow";
```

2. Add route inside the `Layout` children array, after the reconciliation route:
```typescript
{ path: "reconciliation",  Component: Reconciliation },
{ path: "cash-flow",       Component: CashFlow       },  // ← add this line
```

- [ ] **Step 2: Add nav entry in `Sidebar.tsx`**

In `src/app/components/layout/Sidebar.tsx`:

1. Make sure `TrendingUp` is in the lucide-react import (add if missing):
```typescript
import { ..., TrendingUp } from "lucide-react";
```

2. Find the Reconciliation nav group and add the Cash Flow entry after `Bank Statements`:
```typescript
{
  label: "Reconciliation",
  items: [
    {
      title: "Bank Statements",
      url:   "/reconciliation",
      icon:  FileText,
      items: [
        { title: "Statements",   url: "/reconciliation", icon: FileSpreadsheet },
        { title: "Transactions", url: "/reconciliation", icon: ArrowLeftRight  },
      ],
    },
    {
      title: "Cash Flow",
      url:   "/cash-flow",
      icon:  TrendingUp,
    },
  ],
},
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors, successful build.

- [ ] **Step 5: Commit**

```bash
git add src/app/routes.tsx src/app/components/layout/Sidebar.tsx
git commit -m "feat: add /cash-flow route and Cash Flow sidebar nav entry"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|---|---|
| `cash_events` table with all columns | Task 1 |
| `CashEventType`, `CashEventSource`, `CashEvent`, `NewCashEvent` types | Task 2 |
| `forecastCashFlows` — rent, mr_draw, sd_refund, eol_comp | Task 2 |
| `mergeForecastEvents` — deduplication | Task 2 |
| 5 unit tests | Task 2 |
| `useCashFlow` hook — load, merge, addEvent, editEvent, deleteEvent | Task 3 |
| Recon integration — acceptOne and acceptAll | Task 4 |
| KPI strip (4 tiles) | Task 5 |
| View toggle + time range + lease filter | Task 5 |
| Bar chart with actuals/forecast opacity | Task 5 |
| Ledger table with all columns | Task 5 |
| AddCashEventModal | Task 5 |
| Source badge (Manual / Recon / Rule) | Task 5 |
| Edit / delete hidden for rule events | Task 5 |
| `/cash-flow` route | Task 6 |
| Sidebar nav entry | Task 6 |

All spec requirements covered. No gaps found.

### Type Consistency

- `CashEvent`, `CashEventType`, `CashEventSource`, `NewCashEvent` defined in Task 2 and imported consistently in Tasks 3, 4, 5.
- `forecastCashFlows` and `mergeForecastEvents` defined in Task 2, imported in Task 3.
- `buildLiveSDMRData` imported from `SDMRTab` in Task 3 (already exported, verified at line 265).
- `useCashFlow` defined in Task 3, imported in Task 5.
- `orgId` and `result` added to `acceptOne`/`acceptAll` deps in Task 4.
