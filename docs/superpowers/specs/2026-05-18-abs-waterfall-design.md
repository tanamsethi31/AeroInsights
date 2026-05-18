# ABS Waterfall Engine — Design Spec

**Date:** 2026-05-18  
**Feature:** Feature 11 — ABS Waterfall Engine  
**Status:** Approved for implementation

---

## Goal

Add a "Transactions" section to Aeroinsights that lets users model real aviation ABS deals — running a standard 3-tranche waterfall each payment period, evaluating DSCR/LTV coverage tests, and producing a distribution statement showing how cash flows to each note class.

## Architecture

**Approach:** Client-side TypeScript waterfall engine + one new Supabase table for deal config. Mirrors the existing ECL engine pattern exactly — pure functions, fully testable, Supabase only for persistence of deal configuration.

**New files:**
- `supabase/migrations/007_abs_deals.sql` — `abs_deals` table
- `src/app/hooks/useAbsDeals.ts` — Supabase CRUD for deals
- `src/app/utils/absWaterfall.ts` — pure waterfall engine
- `src/app/utils/absWaterfall.test.ts` — unit tests
- `src/app/pages/Transactions.tsx` — top-level page
- `src/app/components/transactions/DealSetupModal.tsx` — multi-step deal creation
- `src/app/components/transactions/CollectionOverridesTable.tsx` — per-lease collection input
- `src/app/components/transactions/CoverageTestPanel.tsx` — DSCR/LTV gauges
- `src/app/components/transactions/DistributionStatement.tsx` — waterfall output

**Modified files:**
- `src/app/routes.tsx` — add `/transactions` route
- `src/app/components/layout/Sidebar.tsx` — add Transactions nav item

---

## Data Model

### `abs_deals` table

```sql
create table if not exists abs_deals (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  deal_name        text not null,
  closing_date     date not null,
  currency         text not null default 'USD',
  note_classes     jsonb not null,
  reserve_accounts jsonb not null,
  coverage_tests   jsonb not null,
  senior_expenses  jsonb not null,
  aircraft_ids     jsonb not null default '[]',
  created_at       timestamptz not null default now()
);
```

### JSONB shapes

**`note_classes`** — array, one entry per tranche:
```json
[
  { "label": "A", "outstandingBalance": 450.0, "couponRate": 0.055, "scheduledPrincipal": 12.5 },
  { "label": "B", "outstandingBalance": 120.0, "couponRate": 0.075, "scheduledPrincipal": 4.0 },
  { "label": "C", "outstandingBalance": 60.0,  "couponRate": 0.095, "scheduledPrincipal": 2.0 }
]
```
Payment frequency is stored at the deal level in `senior_expenses` JSONB as `"paymentFrequency": "quarterly"` (or `"monthly"`). All note classes in a deal share the same payment frequency.
All monetary values in $M. `couponRate` is annual; engine divides by payment frequency.

**`reserve_accounts`:**
```json
{
  "liquidityReserve": { "target": 15.0, "balance": 15.0 },
  "cashTrap":         { "balance": 0.0 }
}
```

**`coverage_tests`:**
```json
{ "dscrTrigger": 1.15, "ltvTrigger": 0.75 }
```

**`senior_expenses`:**
```json
{ "servicerFeePct": 0.005, "trusteeFee": 0.05, "adminFee": 0.02 }
```
`servicerFeePct` applied to total collections; `trusteeFee` and `adminFee` are fixed $ per period.

**`aircraft_ids`:** array of UUIDs referencing the `assets` table.

---

## Waterfall Engine

### File: `src/app/utils/absWaterfall.ts`

#### Types

```typescript
export interface NoteClass {
  label: "A" | "B" | "C";
  outstandingBalance: number;  // $M
  couponRate: number;           // annual rate e.g. 0.055
  scheduledPrincipal: number;  // $M this period
}

export interface ReserveAccounts {
  liquidityReserve: { target: number; balance: number };
  cashTrap: { balance: number };
}

export interface CoverageTestConfig {
  dscrTrigger: number;  // e.g. 1.15
  ltvTrigger: number;   // e.g. 0.75
}

export interface SeniorExpenses {
  servicerFeePct: number;
  trusteeFee: number;
  adminFee: number;
}

export interface CollectionInput {
  leaseId: string;
  lessee: string;
  expectedRent: number;   // $M
  actualCollected: number; // $M — pre-filled = expectedRent, user overrides
}

export interface NoteDistribution {
  noteClass: "A" | "B" | "C";
  interestPaid: number;
  principalPaid: number;
  shortfall: number;
}

export interface CoverageTestResult {
  value: number;
  trigger: number;
  passed: boolean;
  cashTrapped: number;
}

export interface WaterfallResult {
  availableCollections: number;
  seniorExpensesTotal: number;
  liquidityReserveTopUp: number;
  noteDistributions: NoteDistribution[];
  dscrResult: CoverageTestResult;
  ltvResult: CoverageTestResult;
  cashTrapTotal: number;
  residualToEquity: number;
}
```

#### Priority waterfall (in order)

1. **Senior expenses** — `servicerFeePct × totalCollections + trusteeFee + adminFee`
2. **Liquidity reserve top-up** — `max(0, target − currentBalance)`
3. **Class A interest** — `outstandingBalance × couponRate / paymentsPerYear`
4. **Class A scheduled principal**
5. **DSCR test** — `(collections − seniorExpenses) / (classAInterest + classAPrincipal)`. If `< dscrTrigger` → trap remaining cash, stop distributing to B/C.
6. **Class B interest**
7. **Class B scheduled principal**
8. **LTV test** — `(classA + classB + classC outstanding) / portfolioAircraftValue`. If `> ltvTrigger` → trap remaining cash, stop distributing to C.
9. **Class C interest**
10. **Class C scheduled principal**
11. **Residual** → equity

At each step: if remaining cash < amount due, pay what's available and record a shortfall. Never go negative.

#### `portfolioAircraftValue`

Resolved from `AIRCRAFT_BASE_VALUE` in `src/app/data/dealsData.ts` using aircraft type from the `assets` table (matched via `aircraft_ids`). Apply age haircut: `baseValue × max(0.4, 1 − 0.03 × ageYears)`.

#### `paymentsPerYear`

Derived from `paymentFrequency` on the note class: `"monthly"` → 12, `"quarterly"` → 4. Default: 4 (quarterly is standard for aviation ABS).

---

## Hook: `useAbsDeals`

**File:** `src/app/hooks/useAbsDeals.ts`

```typescript
interface UseAbsDealsReturn {
  deals: AbsDeal[];
  loading: boolean;
  createDeal: (payload: Omit<AbsDeal, "id" | "createdAt">) => Promise<void>;
}
```

- Fetches all deals for `orgId` on mount with cancelled-flag pattern (matches `useEclSnapshots`)
- `createDeal` inserts then refreshes inline (no separate fetch callback — same pattern as `lockPeriod` in `useEclSnapshots`)

---

## UI

### `Transactions.tsx`

Three render states:
1. **No deals** — centred empty state, "Set up your first ABS deal" button opens `DealSetupModal`
2. **Deal selector** — card grid if multiple deals, each showing deal name, closing date, total note balance
3. **Active deal** — four tabs: Overview · Run Waterfall · Coverage Tests · Distribution Statement

**Overview tab:** Deal name, closing date, currency, total pool aircraft count, note class balances table (Class A/B/C with outstanding balance, coupon rate, next interest due), last waterfall run date (or "Not yet run").

**Run Waterfall tab:** Period label input (e.g. "Q2 2026") + `CollectionOverridesTable` + "Run Waterfall" button. On run: compute result, set `waterfallResult` state, auto-switch to Coverage Tests tab.

**Coverage Tests tab:** Two gauge panels side by side — DSCR (value vs. 1.15x trigger) and LTV (value vs. 75% trigger). Green badge if passed, red if breached. Below: breakdown of the numbers (collections, expenses, note service for DSCR; note balances, aircraft value for LTV).

**Distribution Statement tab:** Vertical priority table — one row per waterfall step. Columns: Priority, Description, Amount ($M), Remaining Cash ($M). Rows highlighted red if shortfall, amber if cash-trapped. Export to PDF button.

### `DealSetupModal.tsx`

Three-step modal:

**Step 1 — Deal Info:** Deal name, closing date, currency, payment frequency (monthly/quarterly). Payment frequency applies to all note classes — standard aviation ABS uses quarterly.

**Step 2 — Note Classes & Reserves:** Three rows (Class A, B, C) each with outstanding balance, coupon rate (%), scheduled principal. Then liquidity reserve target/balance, DSCR trigger, LTV trigger, servicer fee %, trustee fee, admin fee.

**Step 3 — Aircraft Selection:** Checkbox list of assets from the org's portfolio. Selected aircraft form the deal pool. Shows total current MV as selected.

### `CollectionOverridesTable.tsx`

Table with columns: Aircraft (MSN), Lessee, Expected Rent ($M), Actual Collected ($M — editable), Variance.
Pre-filled from the lease register. Editable `actualCollected` cell per row. Total row at bottom.

### `CoverageTestPanel.tsx`

Props: `dscrResult: CoverageTestResult`, `ltvResult: CoverageTestResult`.

DSCR panel: large number showing computed value (e.g. "1.32×"), trigger shown below ("Trigger: 1.15×"), green/red badge. Below: formula breakdown — collections, expenses, class A service.

LTV panel: percentage (e.g. "68.4%"), trigger ("Trigger: 75.0%"), green/red badge. Below: total notes outstanding, portfolio aircraft value.

### `DistributionStatement.tsx`

Props: `result: WaterfallResult`, `noteClasses: NoteClass[]`.

Vertical waterfall table. Rows:
1. Total Collections
2. Less: Senior Expenses
3. Less: Liquidity Reserve Top-up
4. Class A Interest
5. Class A Principal
6. ── DSCR Test ── (pass/fail badge)
7. Class B Interest
8. Class B Principal
9. ── LTV Test ── (pass/fail badge)
10. Class C Interest
11. Class C Principal
12. Cash Trapped (if any)
13. **Residual to Equity**

Export button calls `exportDistributionStatement(result, noteClasses, periodLabel)` — generates a simple DOCX using the existing `docx` library pattern from `reportGenerators.ts`.

---

## Navigation

### Sidebar

Add after Deals, before Reports:
```typescript
{ path: "/transactions", label: "Transactions", icon: Landmark }
```

### Routes

```typescript
{ path: "transactions",        Component: Transactions },
{ path: "transactions/setup",  Component: Transactions },
```

Both inside the existing `RequireAuth → Layout` block.

---

## Testing

`src/app/utils/absWaterfall.test.ts` — four tests:

1. **Full pass** — DSCR and LTV both pass; all three classes paid in full; residual > 0
2. **DSCR breach** — collections low enough that DSCR < 1.15; Class B and C receive nothing; cash traps
3. **LTV breach** — DSCR passes but LTV > 75%; Class C receives nothing; cash traps at Class B level
4. **Cash shortfall** — collections insufficient even for Class A in full; shortfall recorded on Class A; nothing flows to B or C

---

## Out of Scope (this sprint)

- Period result persistence (`abs_period_snapshots` table) — add in follow-up
- File upload ingestion for bank statements / servicer reports — Feature 12
- Step-up coupons, PIK notes, servicer advance mechanics
- Email delivery of distribution statement
