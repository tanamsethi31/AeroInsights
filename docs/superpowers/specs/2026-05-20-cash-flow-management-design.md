# Cash Flow Management — Design Spec

**Date:** 2026-05-20
**Feature:** Feature 14 — Cash Flow Management
**Status:** Approved for implementation

---

## Goal

Add a portfolio-wide cash flow ledger that records actual cash events (rent receipts, MR draws, SD movements, redelivery proceeds, and other non-rent flows) and projects expected future events from lease data. Confirmed bank reconciliation matches auto-populate rent receipts. Users can add manual actuals and override or supplement the rule-based forecast.

## Architecture

**Approach:** One new Supabase table (`cash_events`) + client-side forecast engine (TypeScript) + one new page. Consistent with the ECL, ABS waterfall, and bank reconciliation patterns — pure-function engines, Supabase for persistence of user-authored data only.

Rule-based forecast events are computed client-side on every render and never persisted. Manual overrides and recon-sourced actuals are persisted. The hook merges all three layers into a unified event list.

**New files:**
- `supabase/migrations/011_cash_events.sql`
- `src/app/utils/cashFlowForecast.ts` — rule-based projection engine + types
- `src/app/utils/cashFlowForecast.test.ts` — unit tests
- `src/app/hooks/useCashFlow.ts` — fetch, merge, mutate
- `src/app/pages/CashFlow.tsx` — portfolio-wide page

**Modified files:**
- `src/app/hooks/useReconciliation.ts` — insert `cash_events` row on match confirmation
- `src/app/components/layout/Sidebar.tsx` — add Cash Flow nav entry
- `src/app/routes.tsx` — add `/cash-flow` route

---

## Data Model

### `cash_events` table

```sql
create table if not exists cash_events (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  lease_id        uuid references leases(id) on delete set null,
  event_type      text not null,
  amount          numeric not null,
  currency        text not null default 'USD',
  event_date      date not null,
  is_forecast     boolean not null default false,
  source          text not null,  -- 'manual' | 'recon'
  transaction_id  uuid references bank_transactions(id) on delete set null,  -- set when source = 'recon'
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists cash_events_org_idx   on cash_events(org_id);
create index if not exists cash_events_lease_idx on cash_events(lease_id);
create index if not exists cash_events_date_idx  on cash_events(event_date);
```

`source = 'rule'` events are never stored — they are computed client-side and merged at render time.

### Event types

| `event_type` | Sign | Description |
|---|---|---|
| `'rent'` | + | Rent receipt (from lessee or via recon) |
| `'mr_draw'` | − | Maintenance reserve payment to lessee / MRO |
| `'sd_posted'` | + | Security deposit received from lessee |
| `'sd_draw'` | + | Security deposit drawn by lessor |
| `'sd_refund'` | − | Security deposit refunded to lessee |
| `'eol_comp'` | + | EOL compensation received from lessee |
| `'remarketing'` | + | Remarketing / lease transition proceeds |
| `'ferry_fee'` | + | Ferry fee received |
| `'supplemental_rent'` | + | Supplemental rent receipt |
| `'insurance'` | + | Insurance proceeds |
| `'other'` | ±  | Any other cash event |

**Sign convention:** positive = inflow to lessor, negative = outflow from lessor. Net cash is always meaningful without sign-flipping.

### Event lifecycle

| `is_forecast` | `source` | Meaning |
|---|---|---|
| `false` | `'manual'` | Actual event entered by user |
| `false` | `'recon'` | Actual rent receipt from confirmed recon match |
| `true` | `'manual'` | User-authored forecast override / addition |
| `true` | `'rule'` | Client-computed projection (never persisted) |

---

## Forecast Engine

### File: `src/app/utils/cashFlowForecast.ts`

#### Types

```typescript
export type CashEventType =
  | 'rent' | 'mr_draw' | 'sd_posted' | 'sd_draw' | 'sd_refund'
  | 'eol_comp' | 'remarketing' | 'ferry_fee' | 'supplemental_rent'
  | 'insurance' | 'other';

export type CashEventSource = 'manual' | 'recon' | 'rule';

export interface CashEvent {
  id:             string;
  orgId:          string;
  leaseId:        string | null;
  eventType:      CashEventType;
  amount:         number;
  currency:       string;
  eventDate:      string;       // ISO date string YYYY-MM-DD
  isForecast:     boolean;
  source:         CashEventSource;
  transactionId:  string | null;   // set when source = 'recon'
  notes:          string | null;
  createdAt:      string;
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
```

#### `forecastCashFlows(leases, lessees, assets, sdmrData, horizonMonths): CashEvent[]`

Generates rule-based projected events for each active lease (where `lease.end_date >= today`).

For each active lease:

1. **Rent** — one event per remaining calendar month from today through `lease.end_date`, amount = `lease.monthly_rental`. Skipped if `monthly_rental` is null or zero.

2. **MR draw** — single outflow at `lease.end_date`, amount = `−totalMRBalance(sdmrRecord)` (sum of `component.cumulativeBalance` across all MR components). Skipped if total ≤ 0.

3. **SD refund** — single outflow at `lease.end_date`, amount = `−refundableMRCapped(sdmrRecord)` applied to the SD cash amount (skipped if `sdmrRecord.sd.type === 'LC'` or refundable amount is 0).

4. **EOL compensation** — single inflow at `lease.end_date`, amount = `eolCompensation(sdmrRecord, 'half-life')`. Skipped if result ≤ 0.

All generated events have `isForecast: true`, `source: 'rule'`, `id: 'rule-{leaseId}-{eventType}-{eventDate}'` (deterministic, never stored).

Events with `eventDate` beyond `today + horizonMonths` months are excluded.

#### Merge logic (in hook)

When building the unified event list:
- Start with rule events.
- For each (leaseId, eventType, calendar month), if a persisted `is_forecast = true` manual event exists for that combination, suppress the rule event for that month and use the manual one instead.
- Actuals (`is_forecast = false`) are always included and are never suppressed.

---

## Hook: `useCashFlow`

### File: `src/app/hooks/useCashFlow.ts`

```typescript
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
```

- On mount: fetches all `cash_events` rows for the org (source `'manual'` and `'recon'`) ordered by `event_date`.
- Computes rule-based forecast via `forecastCashFlows` using `usePortfolioData()` with a 24-month horizon.
- Merges actuals + persisted forecast overrides + rule projections applying the deduplication logic above.
- `actuals`: events where `is_forecast = false`.
- `forecast`: rule events (after deduplication) + persisted `is_forecast = true` events.
- `events`: union of actuals + forecast, sorted by `event_date`.
- All mutations do optimistic updates then Supabase upsert/delete. `deleteEvent` only deletes `source = 'manual' | 'recon'` rows (rule events have no DB row to delete).

---

## Recon Integration

**Modified file:** `src/app/hooks/useReconciliation.ts`

In `acceptOne` and `acceptAll`, after updating `reconciliation_matches`, fire-and-forget insert into `cash_events`:

```typescript
// acceptOne addition
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
}).then(({ error }) => {
  if (error) console.error("[useReconciliation] cash_events insert error:", error);
});
```

`acceptAll` loops over the same subset (confidence ≥ 0.8, not confirmed) and bulk-inserts.

No new UI surface needed for this integration.

---

## UI

### `CashFlow.tsx`

**Header KPI strip (4 tiles):**
- **Net received MTD** — sum of actuals in current calendar month
- **Net forecast 12m** — sum of all forecast events in next 12 months
- **Largest upcoming outflow** — most negative single forecast event within 90 days (amount + date label)
- **MR draws due 90d** — count and total of `event_type = 'mr_draw'` forecast events within 90 days

**Controls bar:**
- View toggle: `Actuals | Forecast | Both` (default: Both)
- Time range: `3m · 6m · 12m · 24m` (default: 12m)
- Lease filter: multi-select dropdown of lessees (all selected by default)
- **+ Add Event** button → `AddCashEventModal`

**Chart:** Grouped bar chart (Recharts) — one bar group per month. Inflow bar (green, above zero) stacked by event type. Outflow bar (red, below zero) stacked by event type. Actuals rendered solid; forecast events rendered at 50% opacity. Clicking a month bar filters the ledger table to that month.

**Ledger table columns:**

| Column | Notes |
|---|---|
| Date | ISO date, sortable |
| Type | Pill with event-type label and colour |
| Lessee | Lessee name from lease lookup (or "—" if no lease) |
| Amount | Signed, formatted with currency symbol |
| Source | Badge: `Manual` (grey) · `Recon` (blue) · `Rule` (outline) |
| Notes | Truncated, tooltip on hover |
| Actions | Edit / Delete icons — hidden for `source = 'rule'` |

**Event type pill colours:**
- Green: `rent`, `eol_comp`, `remarketing`, `ferry_fee`, `supplemental_rent`, `insurance`, `sd_posted`, `sd_draw`
- Amber: `mr_draw`
- Red: `sd_refund`, `other` (when negative)

### `AddCashEventModal`

Fields: Event Type (select), Lease (searchable select, optional), Amount, Currency, Date, Is Forecast (toggle, default off), Notes (textarea). Save disabled until type + amount + date are filled.

### Sidebar

Add "Cash Flow" entry in the Reconciliation nav group, below "Bank Statements":
```
Reconciliation
  Bank Statements
    Statements
    Transactions
  Cash Flow          ← new
```

---

## Testing

`src/app/utils/cashFlowForecast.test.ts` — five tests:

1. **Active lease with rent** — lease running 3 more months → 3 rent events generated, amounts match `monthly_rental`
2. **MR draw at redelivery** — lease ending next month with MR balance $50k → single `mr_draw` outflow of −$50k on end date
3. **SD refund suppressed for LC** — lease with LC-only SD → no `sd_refund` event generated
4. **Horizon cutoff** — lease ending in 30 months, horizon = 24 → events stop at month 24
5. **Manual override suppresses rule** — persisted manual forecast for same lease/type/month → rule event for that month removed from merged output

---

## Out of Scope (this sprint)

- Multi-currency aggregation with FX conversion
- Export to PDF/CSV
- Variance analysis (actuals vs. original forecast)
- Automated MR draw scheduling from servicer reports
- Linking cash events to bank statement line items beyond rent
