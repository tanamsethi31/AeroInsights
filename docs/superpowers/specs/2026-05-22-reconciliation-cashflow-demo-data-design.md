# Reconciliation & Cash Flow Demo Data — Implementation Design

**Goal:** Unlock the Bank Statements and Cash Flow sections with pre-loaded sample data so all features are immediately visible and usable without needing to upload a real file or configure Supabase.

**Architecture:** Two static data files in `src/app/data/` provide demo `BankStatement`, `BankTransaction[]`, and `CashEvent[]` fixtures. Both pages inject these as a fallback when live data is empty after loading — the same `liveData ?? staticFallback` pattern used throughout the rest of the app. Hooks are unchanged. Demo mode is indicated by a muted "SAMPLE DATA" chip that disappears once real data exists.

**Tech Stack:** React, TypeScript, inline styles, existing `BankStatement` / `BankTransaction` types from `useBankStatements.ts`, existing `CashEvent` type from `cashFlowForecast.ts`.

---

## Files

| Action | Path |
|--------|------|
| Create | `src/app/data/sampleBankStatement.ts` |
| Create | `src/app/data/sampleCashEvents.ts` |
| Modify | `src/app/hooks/useCashFlow.ts` (1-line: `loading` initial value `false` → `true`) |
| Modify | `src/app/pages/Reconciliation.tsx` |
| Modify | `src/app/pages/CashFlow.tsx` |

---

## Section 1 — Static data files

### `src/app/data/sampleBankStatement.ts`

Exports two constants matching the types from `useBankStatements.ts`:

```typescript
import type { BankStatement, BankTransaction } from "../hooks/useBankStatements";

export const SAMPLE_STATEMENT: BankStatement = {
  id:          "demo-stmt-1",
  orgId:       "demo",
  filename:    "DEMO_STATEMENT_Q1_2026.csv",
  currency:    "USD",
  periodLabel: "Jan – Mar 2026",
  rowCount:    30,
  uploadedAt:  "2026-04-01T09:00:00Z",
};
```

`SAMPLE_TRANSACTIONS: BankTransaction[]` — 30 rows spanning Jan 2 → Mar 28 2026. Mix of:
- Credits (positive amounts): wire rent receipts ($125k–$185k), fee income ($5k–$15k), misc credits ($800–$2k)
- Debits (negative amounts): bank service charges ($200–$500), operating expenses ($2k–$8k), wire fees ($150–$350), insurance premiums ($1.2k–$3k)
- Descriptions generic: `"WIRE CREDIT REF 8821 - RENTAL INCOME"`, `"BANK SERVICE CHARGE JAN"`, `"OPERATING EXPENSE - ADMIN"`, `"OUTWARD WIRE FEE"`, `"INSURANCE PREMIUM Q1"`
- `reference` field populated on ~60% of rows (format `"REF-XXXXXX"`), null on the rest

All 30 rows use `statementId: "demo-stmt-1"`, `orgId: "demo"`, `currency: "USD"`, unique `id` values (`"demo-tx-01"` through `"demo-tx-30"`).

### `src/app/data/sampleCashEvents.ts`

Exports `SAMPLE_CASH_EVENTS: CashEvent[]` — 12 events with `eventDate` values spread across the 4 months prior to May 2026 (Jan–Apr 2026). All use `orgId: "demo"`, `source: "manual"`, `leaseId: null`, `transactionId: null`.

| # | eventType | amount | isForecast | notes |
|---|-----------|--------|------------|-------|
| 1 | rent | +$148,500 | false | "Jan rent receipt" |
| 2 | rent | +$132,000 | false | "Feb rent receipt" |
| 3 | rent | +$155,200 | false | "Mar rent receipt" |
| 4 | rent | +$148,500 | false | "Apr rent receipt" |
| 5 | supplemental_rent | +$9,800 | false | "Suppl. rent Jan" |
| 6 | supplemental_rent | +$11,200 | false | "Suppl. rent Mar" |
| 7 | mr_draw | -$44,750 | false | "MR draw - engine event" |
| 8 | sd_posted | +$82,000 | false | "SD posted on delivery" |
| 9 | other | -$380 | false | "Bank wire fee" |
| 10 | eol_comp | +$24,500 | false | "EOL compensation" |
| 11 | eol_comp | +$27,300 | false | "EOL compensation" |
| 12 | insurance | -$2,150 | false | "Hull insurance premium" |

Event dates distributed: 2 in Jan, 3 in Feb, 4 in Mar, 3 in Apr.
IDs: `"demo-evt-01"` through `"demo-evt-12"`.

---

## Section 2 — `Reconciliation.tsx` changes

### 2a. Demo mode detection

After loading completes (`!loading`), determine demo mode:

```typescript
const isDemoMode = !loading && statements.length === 0;
const displayStatements = isDemoMode ? [SAMPLE_STATEMENT] : statements;
```

### 2b. Pre-selection on demo mode

Initialise `selectedStatementId` to `"demo-stmt-1"` when in demo mode so the statement card is already expanded on first render:

```typescript
const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);

// Auto-select demo statement once demo mode is confirmed
useEffect(() => {
  if (isDemoMode && selectedStatementId === null) {
    setSelectedStatementId("demo-stmt-1");
    setTransactions(SAMPLE_TRANSACTIONS);
  }
}, [isDemoMode]);
```

### 2c. Demo transaction fetch bypass

In `handleSelectStatement`, short-circuit the Supabase fetch for demo statements:

```typescript
const handleSelectStatement = async (id: string) => {
  if (selectedStatementId === id) {
    setSelectedStatementId(null);
    setTransactions([]);
    return;
  }
  setSelectedStatementId(id);
  setActiveTab("transactions");

  // Demo bypass — no network call needed
  if (id === "demo-stmt-1") {
    setTransactions(SAMPLE_TRANSACTIONS);
    return;
  }

  setLoadingTx(true);
  setTransactions([]);
  const txns = await fetchTransactions(id);
  // ... existing logic
};
```

### 2d. Demo badge in StatementCard

When `isDemoMode` is true, render a `"SAMPLE DATA"` chip next to the filename in the `StatementCard` component. Pass an optional `showDemoBadge?: boolean` prop:

```tsx
{showDemoBadge && (
  <span style={{
    background: "#1E293B",
    border: "1px solid #334155",
    color: "#64748B",
    borderRadius: "99px",
    padding: "0.1rem 0.5rem",
    fontSize: "0.7rem",
    fontWeight: 500,
    marginLeft: "0.5rem",
  }}>
    SAMPLE DATA
  </span>
)}
```

### 2e. Empty state removal

Remove the early-return empty state block entirely. The page now always renders the full statements view — either with live data or with the sample statement pre-selected.

The `StatementUploadModal` remains fully functional. When a real statement is uploaded, `statements.length > 0` and `isDemoMode` becomes false, transitioning to live mode.

### 2f. `selectedStatement` derivation

Update to use `displayStatements`:

```typescript
const selectedStatement = displayStatements.find(s => s.id === selectedStatementId) ?? null;
```

---

## Section 3 — `CashFlow.tsx` changes

### 3a. Demo mode detection

```typescript
const isDemoMode = !loading && events.length === 0;
const displayEvents = isDemoMode ? SAMPLE_CASH_EVENTS : events;
```

### 3b. All derived values consume `displayEvents`

Replace all occurrences of `events` in `useMemo` hooks that feed the UI with `displayEvents`:

- `visibleEvents` — filter `displayEvents` (not `events`) for view mode + time range
- `netReceivedMTD` — compute from `displayEvents`
- `netForecast12m` — compute from `displayEvents`
- `largestOutflow90d` — compute from `displayEvents`
- `mrDraws90d` — compute from `displayEvents`
- `chartData` — already derives from `visibleEvents` (no change needed)
- `ledgerRows` — already derives from `visibleEvents` (no change needed)

### 3c. Demo badge

`PageHeader.subtitle` accepts `string` only. Render the "SAMPLE DATA" chip as a standalone `<div>` immediately after `<PageHeader>`, inside the outer container, shown only when `isDemoMode`:

```tsx
{isDemoMode && (
  <div style={{ marginBottom: "0.75rem" }}>
    <span style={{
      background: "#F1F5F9",
      border: "1px solid #E2E8F0",
      color: "#94A3B8",
      borderRadius: "99px",
      padding: "0.2rem 0.625rem",
      fontSize: "0.7rem",
      fontWeight: 500,
    }}>
      SAMPLE DATA
    </span>
  </div>
)}
```

### 3d. Add Event still works

`addEvent`, `editEvent`, `deleteEvent` operate on `events` (Supabase) directly — not on `displayEvents`. Once the first real event is saved successfully, `events.length > 0` and `isDemoMode` becomes false. From that point the real Supabase data is shown.

---

## Edge Cases

- **`isDemoMode` flicker**: `loading` in `useCashFlow` starts `false` (confirmed), meaning on mount there's a single render frame where `loading=false && events.length=0` → `isDemoMode=true` before the Supabase fetch sets `loading=true`. Fix: change `useState(false)` → `useState(true)` for `loading` in `useCashFlow.ts` (one-line change to the hook). This is the correct default since a fetch is always initiated on mount. `useBankStatements` already starts with `loading=true` — this brings `useCashFlow` in line.
- **Demo statement in reconcile tab**: `ReconciliationWorkspace` receives `statementId="demo-stmt-1"` and `transactions={SAMPLE_TRANSACTIONS}`. The workspace calls `useReconciliation(statementId, transactions)` — the hook will try to fetch match results from Supabase. If Supabase has no rows for `"demo-stmt-1"`, it returns empty matches (unmatched). This is acceptable — the reconcile tab will show all 30 transactions as "unmatched", which still demonstrates the reconciliation UI.
- **`CashFlow` actuals/forecast split**: `SAMPLE_CASH_EVENTS` are all `isForecast: false` so "Actuals" view is populated. "Forecast" view shows only rule-based events (if leases exist). "Both" combines them.
- **`visibleEvents` time filter**: `SAMPLE_CASH_EVENTS` dates are Jan–Apr 2026. The default range is 12 months from `now` (May 2026). Since the sample events are all in the past (before May 2026), they won't appear in the forward-looking chart unless the filter is adjusted. Fix: the `visibleEvents` filter uses `e.eventDate >= todayStr` — sample actuals are past-dated and will be filtered out. To show them in the chart, either: (a) use current-month dates for the sample events, or (b) remove the `e.eventDate >= todayStr` lower bound from the `displayEvents` actuals filter so past actuals always appear in the ledger even if outside the chart range. **Recommended fix: (b)** — filter chart data by range but always show all actuals in the ledger table regardless of date.

---

## Testing

No new test files for presentational changes. Existing `bankStatementParser.test.ts` and `cashFlowForecast.test.ts` are unaffected. TypeScript build is the verification gate.
