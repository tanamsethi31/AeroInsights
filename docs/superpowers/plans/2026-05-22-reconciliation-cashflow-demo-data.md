# Reconciliation & Cash Flow Demo Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject static sample data into the Bank Statements (Reconciliation) and Cash Flow pages so all features are immediately visible without uploading a file or configuring Supabase.

**Architecture:** Two static data files in `src/app/data/` export typed fixtures. Both pages detect demo mode (`!loading && liveData.length === 0`) and fall back to the static data — the same `liveData ?? staticFallback` pattern used throughout the codebase. Hooks are untouched except for a one-line loading-init fix in `useCashFlow`. A muted "SAMPLE DATA" chip is shown while demo mode is active.

**Tech Stack:** React, TypeScript, inline styles, existing `BankStatement`/`BankTransaction` types from `useBankStatements.ts`, existing `CashEvent` type from `cashFlowForecast.ts`.

---

## Files

| Action | Path |
|--------|------|
| Create | `src/app/data/sampleBankStatement.ts` |
| Create | `src/app/data/sampleCashEvents.ts` |
| Modify | `src/app/hooks/useCashFlow.ts` (1 line) |
| Modify | `src/app/pages/Reconciliation.tsx` |
| Modify | `src/app/pages/CashFlow.tsx` |

---

## Task 1: Static data — sampleBankStatement.ts

**Files:**
- Create: `src/app/data/sampleBankStatement.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/app/data/sampleBankStatement.ts
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

export const SAMPLE_TRANSACTIONS: BankTransaction[] = [
  // January
  { id: "demo-tx-01", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-02", description: "WIRE CREDIT REF 8821 - RENTAL INCOME",  amount:  125000, currency: "USD", reference: "REF-882101" },
  { id: "demo-tx-02", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-05", description: "BANK SERVICE CHARGE JAN",               amount:    -250, currency: "USD", reference: null },
  { id: "demo-tx-03", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-07", description: "FEE INCOME - MANAGEMENT FEES",          amount:    8500, currency: "USD", reference: "REF-110105" },
  { id: "demo-tx-04", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-09", description: "OUTWARD WIRE FEE",                      amount:    -185, currency: "USD", reference: null },
  { id: "demo-tx-05", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-12", description: "OPERATING EXPENSE - ADMIN",             amount:   -3200, currency: "USD", reference: "REF-201001" },
  { id: "demo-tx-06", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-15", description: "WIRE CREDIT REF 9104 - RENTAL INCOME",  amount:  162000, currency: "USD", reference: "REF-910401" },
  { id: "demo-tx-07", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-18", description: "INSURANCE PREMIUM Q1",                  amount:   -1800, currency: "USD", reference: "REF-INS001" },
  { id: "demo-tx-08", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-22", description: "MISC CREDIT - INTEREST RECEIVED",       amount:    1250, currency: "USD", reference: null },
  { id: "demo-tx-09", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-28", description: "OPERATING EXPENSE - ADMIN",             amount:   -5500, currency: "USD", reference: "REF-201002" },
  { id: "demo-tx-10", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-01-30", description: "OUTWARD WIRE FEE",                      amount:    -220, currency: "USD", reference: null },
  // February
  { id: "demo-tx-11", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-03", description: "WIRE CREDIT REF 8822 - RENTAL INCOME",  amount:  148500, currency: "USD", reference: "REF-882201" },
  { id: "demo-tx-12", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-05", description: "BANK SERVICE CHARGE FEB",               amount:    -300, currency: "USD", reference: null },
  { id: "demo-tx-13", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-07", description: "FEE INCOME - MANAGEMENT FEES",          amount:   12000, currency: "USD", reference: "REF-110202" },
  { id: "demo-tx-14", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-10", description: "OUTWARD WIRE FEE",                      amount:    -195, currency: "USD", reference: null },
  { id: "demo-tx-15", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-12", description: "OPERATING EXPENSE - ADMIN",             amount:   -4100, currency: "USD", reference: "REF-201003" },
  { id: "demo-tx-16", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-18", description: "WIRE CREDIT REF 9105 - RENTAL INCOME",  amount:  175000, currency: "USD", reference: "REF-910501" },
  { id: "demo-tx-17", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-20", description: "MISC CREDIT - INTEREST RECEIVED",       amount:     950, currency: "USD", reference: null },
  { id: "demo-tx-18", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-24", description: "INSURANCE PREMIUM Q1",                  amount:   -2400, currency: "USD", reference: "REF-INS002" },
  { id: "demo-tx-19", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-26", description: "OPERATING EXPENSE - ADMIN",             amount:   -7200, currency: "USD", reference: "REF-201004" },
  { id: "demo-tx-20", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-02-28", description: "OUTWARD WIRE FEE",                      amount:    -310, currency: "USD", reference: null },
  // March
  { id: "demo-tx-21", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-02", description: "WIRE CREDIT REF 8823 - RENTAL INCOME",  amount:  132000, currency: "USD", reference: "REF-882301" },
  { id: "demo-tx-22", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-05", description: "BANK SERVICE CHARGE MAR",               amount:    -450, currency: "USD", reference: null },
  { id: "demo-tx-23", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-07", description: "FEE INCOME - MANAGEMENT FEES",          amount:    6500, currency: "USD", reference: "REF-110303" },
  { id: "demo-tx-24", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-10", description: "OUTWARD WIRE FEE",                      amount:    -280, currency: "USD", reference: null },
  { id: "demo-tx-25", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-12", description: "OPERATING EXPENSE - ADMIN",             amount:   -2800, currency: "USD", reference: "REF-201005" },
  { id: "demo-tx-26", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-15", description: "WIRE CREDIT REF 9106 - RENTAL INCOME",  amount:  185000, currency: "USD", reference: "REF-910601" },
  { id: "demo-tx-27", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-18", description: "INSURANCE PREMIUM Q1",                  amount:   -2900, currency: "USD", reference: "REF-INS003" },
  { id: "demo-tx-28", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-22", description: "MISC CREDIT - INTEREST RECEIVED",       amount:    1750, currency: "USD", reference: null },
  { id: "demo-tx-29", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-25", description: "OPERATING EXPENSE - ADMIN",             amount:   -6400, currency: "USD", reference: "REF-201006" },
  { id: "demo-tx-30", orgId: "demo", statementId: "demo-stmt-1", valueDate: "2026-03-28", description: "OUTWARD WIRE FEE",                      amount:    -340, currency: "USD", reference: null },
];
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
git add src/app/data/sampleBankStatement.ts
git commit -m "feat: add SAMPLE_STATEMENT and SAMPLE_TRANSACTIONS demo fixtures"
```

---

## Task 2: Static data — sampleCashEvents.ts

**Files:**
- Create: `src/app/data/sampleCashEvents.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/app/data/sampleCashEvents.ts
import type { CashEvent } from "../utils/cashFlowForecast";

export const SAMPLE_CASH_EVENTS: CashEvent[] = [
  // January (2 events)
  {
    id: "demo-evt-01", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 148500, currency: "USD",
    eventDate: "2026-01-15", isForecast: false,
    source: "manual", transactionId: null, notes: "Jan rent receipt",
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "demo-evt-02", orgId: "demo", leaseId: null,
    eventType: "sd_posted", amount: 82000, currency: "USD",
    eventDate: "2026-01-20", isForecast: false,
    source: "manual", transactionId: null, notes: "SD posted on delivery",
    createdAt: "2026-01-20T10:00:00Z",
  },
  // February (3 events)
  {
    id: "demo-evt-03", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 132000, currency: "USD",
    eventDate: "2026-02-10", isForecast: false,
    source: "manual", transactionId: null, notes: "Feb rent receipt",
    createdAt: "2026-02-10T10:00:00Z",
  },
  {
    id: "demo-evt-04", orgId: "demo", leaseId: null,
    eventType: "supplemental_rent", amount: 9800, currency: "USD",
    eventDate: "2026-02-15", isForecast: false,
    source: "manual", transactionId: null, notes: "Suppl. rent Jan",
    createdAt: "2026-02-15T10:00:00Z",
  },
  {
    id: "demo-evt-05", orgId: "demo", leaseId: null,
    eventType: "insurance", amount: -2150, currency: "USD",
    eventDate: "2026-02-20", isForecast: false,
    source: "manual", transactionId: null, notes: "Hull insurance premium",
    createdAt: "2026-02-20T10:00:00Z",
  },
  // March (4 events)
  {
    id: "demo-evt-06", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 155200, currency: "USD",
    eventDate: "2026-03-10", isForecast: false,
    source: "manual", transactionId: null, notes: "Mar rent receipt",
    createdAt: "2026-03-10T10:00:00Z",
  },
  {
    id: "demo-evt-07", orgId: "demo", leaseId: null,
    eventType: "supplemental_rent", amount: 11200, currency: "USD",
    eventDate: "2026-03-15", isForecast: false,
    source: "manual", transactionId: null, notes: "Suppl. rent Mar",
    createdAt: "2026-03-15T10:00:00Z",
  },
  {
    id: "demo-evt-08", orgId: "demo", leaseId: null,
    eventType: "mr_draw", amount: -44750, currency: "USD",
    eventDate: "2026-03-20", isForecast: false,
    source: "manual", transactionId: null, notes: "MR draw - engine event",
    createdAt: "2026-03-20T10:00:00Z",
  },
  {
    id: "demo-evt-09", orgId: "demo", leaseId: null,
    eventType: "other", amount: -380, currency: "USD",
    eventDate: "2026-03-28", isForecast: false,
    source: "manual", transactionId: null, notes: "Bank wire fee",
    createdAt: "2026-03-28T10:00:00Z",
  },
  // April (3 events)
  {
    id: "demo-evt-10", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 148500, currency: "USD",
    eventDate: "2026-04-10", isForecast: false,
    source: "manual", transactionId: null, notes: "Apr rent receipt",
    createdAt: "2026-04-10T10:00:00Z",
  },
  {
    id: "demo-evt-11", orgId: "demo", leaseId: null,
    eventType: "eol_comp", amount: 24500, currency: "USD",
    eventDate: "2026-04-18", isForecast: false,
    source: "manual", transactionId: null, notes: "EOL compensation",
    createdAt: "2026-04-18T10:00:00Z",
  },
  {
    id: "demo-evt-12", orgId: "demo", leaseId: null,
    eventType: "eol_comp", amount: 27300, currency: "USD",
    eventDate: "2026-04-25", isForecast: false,
    source: "manual", transactionId: null, notes: "EOL compensation",
    createdAt: "2026-04-25T10:00:00Z",
  },
];
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
git add src/app/data/sampleCashEvents.ts
git commit -m "feat: add SAMPLE_CASH_EVENTS demo fixtures"
```

---

## Task 3: Fix useCashFlow.ts loading initial value

**Files:**
- Modify: `src/app/hooks/useCashFlow.ts` — line 48

`useCashFlow` starts `loading` at `false`. This causes a single render frame where `loading=false && events.length=0` → `isDemoMode=true` in `CashFlow.tsx` before the Supabase fetch sets `loading=true`, causing a visible flicker back to real data when it arrives. `useBankStatements` already starts with `loading=true` — this brings `useCashFlow` in line.

- [ ] **Step 1: Change the loading initial value**

In `src/app/hooks/useCashFlow.ts`, find line 48:
```typescript
  const [loading,   setLoading  ]               = useState(false);
```
Replace with:
```typescript
  const [loading,   setLoading  ]               = useState(true);
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
git add src/app/hooks/useCashFlow.ts
git commit -m "fix: useCashFlow loading initial value false → true to prevent demo mode flicker"
```

---

## Task 4: Reconciliation.tsx — demo mode

**Files:**
- Modify: `src/app/pages/Reconciliation.tsx`

Changes:
1. Add `useEffect` to React imports
2. Import `SAMPLE_STATEMENT`, `SAMPLE_TRANSACTIONS`
3. Add `showDemoBadge?: boolean` prop to `StatementCard`; render "SAMPLE DATA" chip in the filename row
4. Add `isDemoMode` + `displayStatements` derived values in the page component
5. Add `useEffect` to auto-select the demo statement on first render when in demo mode
6. Short-circuit the Supabase fetch in `handleSelectStatement` for `id === "demo-stmt-1"`
7. Remove the empty-state early-return block entirely
8. Update `selectedStatement` to use `displayStatements`
9. Replace `statements.map(...)` with `displayStatements.map(...)` and pass `showDemoBadge`

- [ ] **Step 1: Update React import to include useEffect**

Find:
```typescript
import { useState, useMemo } from "react";
```
Replace with:
```typescript
import { useState, useMemo, useEffect } from "react";
```

- [ ] **Step 2: Add demo data imports after the existing hook import**

Find:
```typescript
import { ReconciliationWorkspace } from "../components/reconciliation/ReconciliationWorkspace";
```
Replace with:
```typescript
import { ReconciliationWorkspace } from "../components/reconciliation/ReconciliationWorkspace";
import { SAMPLE_STATEMENT, SAMPLE_TRANSACTIONS } from "../data/sampleBankStatement";
```

- [ ] **Step 3: Add showDemoBadge prop to StatementCard and render the chip**

Find the `StatementCard` props type:
```typescript
function StatementCard({
  statement,
  isSelected,
  onClick,
}: {
  statement:  BankStatement;
  isSelected: boolean;
  onClick:    () => void;
}) {
```
Replace with:
```typescript
function StatementCard({
  statement,
  isSelected,
  onClick,
  showDemoBadge = false,
}: {
  statement:     BankStatement;
  isSelected:    boolean;
  onClick:       () => void;
  showDemoBadge?: boolean;
}) {
```

Then find the filename paragraph inside `StatementCard`:
```typescript
          <p style={{ margin: 0, fontWeight: 500, color: "#F8FAFC", fontSize: "0.875rem" }}>
            {statement.filename}
          </p>
```
Replace with:
```typescript
          <p style={{ margin: 0, fontWeight: 500, color: "#F8FAFC", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
            {statement.filename}
            {showDemoBadge && (
              <span style={{
                background: "#1E293B",
                border: "1px solid #334155",
                color: "#64748B",
                borderRadius: "99px",
                padding: "0.1rem 0.5rem",
                fontSize: "0.7rem",
                fontWeight: 500,
              }}>
                SAMPLE DATA
              </span>
            )}
          </p>
```

- [ ] **Step 4: Add isDemoMode, displayStatements, and useEffect in the page component**

Find the line where `selectedStatement` is derived:
```typescript
  const selectedStatement = statements.find(s => s.id === selectedStatementId) ?? null;
```
Replace with:
```typescript
  const isDemoMode = !loading && statements.length === 0;
  const displayStatements = isDemoMode ? [SAMPLE_STATEMENT] : statements;

  // Auto-select demo statement and populate transactions when in demo mode
  useEffect(() => {
    if (isDemoMode && selectedStatementId === null) {
      setSelectedStatementId("demo-stmt-1");
      setTransactions(SAMPLE_TRANSACTIONS);
    }
  }, [isDemoMode]);

  const selectedStatement = displayStatements.find(s => s.id === selectedStatementId) ?? null;
```

- [ ] **Step 5: Add demo bypass in handleSelectStatement**

Find inside `handleSelectStatement`:
```typescript
    setActiveTab("transactions");
    setSelectedStatementId(id);
    setLoadingTx(true);
    setTransactions([]);
    const txns = await fetchTransactions(id);
```
Replace with:
```typescript
    setActiveTab("transactions");
    setSelectedStatementId(id);

    // Demo bypass — skip the Supabase fetch for the sample statement
    if (id === "demo-stmt-1") {
      setTransactions(SAMPLE_TRANSACTIONS);
      return;
    }

    setLoadingTx(true);
    setTransactions([]);
    const txns = await fetchTransactions(id);
```

- [ ] **Step 6: Remove the empty-state early-return block entirely**

Find and delete this entire block (lines 234–271 in the original file):
```typescript
  // ── Empty state ────────────────────────────────────────────────────────────

  if (!loading && statements.length === 0) {
    return (
      <div style={{ padding: "2rem", height: "100%", display: "flex", flexDirection: "column" }}>
        <PageHeader title="Reconciliation" subtitle="Upload and browse bank statements" />
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: "1rem", minHeight: "400px",
        }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "12px",
            background: "#1E293B", border: "1px solid #334155",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileSpreadsheet size={24} style={{ color: "#3B82F6" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontWeight: 500, color: "#F8FAFC", fontSize: "1rem" }}>No bank statements yet</p>
            <p style={{ margin: "0.375rem 0 0", fontSize: "0.875rem", color: "#64748B" }}>
              Upload a CSV or XLSX file to get started
            </p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              background: "#3B82F6", border: "none", color: "#FFFFFF",
              borderRadius: "8px", padding: "0.625rem 1.25rem",
              fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
            }}
          >
            <Upload size={16} /> Upload your first bank statement
          </button>
        </div>
        <StatementUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onImport={handleImport} />
      </div>
    );
  }

  // ── Has statements ─────────────────────────────────────────────────────────
```

Replace the entire block above (including the `// ── Has statements` comment) with just:
```typescript
  // ── Render ─────────────────────────────────────────────────────────────────
```

- [ ] **Step 7: Replace statements.map with displayStatements.map and pass showDemoBadge**

Find in the JSX:
```typescript
          {statements.map(stmt => (
            <div key={stmt.id}>
              <StatementCard
                statement={stmt}
                isSelected={selectedStatementId === stmt.id}
                onClick={() => handleSelectStatement(stmt.id)}
              />
```
Replace with:
```typescript
          {displayStatements.map(stmt => (
            <div key={stmt.id}>
              <StatementCard
                statement={stmt}
                isSelected={selectedStatementId === stmt.id}
                onClick={() => handleSelectStatement(stmt.id)}
                showDemoBadge={isDemoMode}
              />
```

- [ ] **Step 8: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built in`

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/Reconciliation.tsx
git commit -m "feat: Reconciliation demo mode — pre-load SAMPLE_STATEMENT and 30 transactions"
```

---

## Task 5: CashFlow.tsx — demo mode

**Files:**
- Modify: `src/app/pages/CashFlow.tsx`

Changes:
1. Import `SAMPLE_CASH_EVENTS`
2. Add `isDemoMode` + `displayEvents` after the hook calls
3. Update `visibleEvents` — use `displayEvents`; split viewMode filter inline; fix lower-bound to keep past actuals
4. Update `netReceivedMTD`, `netForecast12m`, `largestOutflow90d`, `mrDraws90d` to use `displayEvents`
5. Add SAMPLE DATA badge as a `<div>` sibling immediately after `<PageHeader>`

- [ ] **Step 1: Add SAMPLE_CASH_EVENTS import**

Find:
```typescript
import { useCashFlow } from "../hooks/useCashFlow";
```
Replace with:
```typescript
import { useCashFlow } from "../hooks/useCashFlow";
import { SAMPLE_CASH_EVENTS } from "../data/sampleCashEvents";
```

- [ ] **Step 2: Add isDemoMode and displayEvents after the hook destructure**

Find:
```typescript
  const { events, actuals, forecast, loading, saving, addEvent, editEvent, deleteEvent } = useCashFlow();
  const { leases, lessees } = usePortfolioData();
```
Replace with:
```typescript
  const { events, actuals, forecast, loading, saving, addEvent, editEvent, deleteEvent } = useCashFlow();
  const { leases, lessees } = usePortfolioData();

  const isDemoMode = !loading && events.length === 0;
  const displayEvents = isDemoMode ? SAMPLE_CASH_EVENTS : events;
```

- [ ] **Step 3: Replace the visibleEvents useMemo**

Find:
```typescript
  const visibleEvents = useMemo(() => {
    const todayStr = now.toISOString().slice(0, 10);
    const rangeEnd = addMonths(now, rangeMonths);
    const rangeEndStr = rangeEnd.toISOString().slice(0, 10);

    let base: CashEvent[] = [];
    if (viewMode === "actuals")       base = actuals;
    else if (viewMode === "forecast") base = forecast;
    else                              base = events;

    return base.filter(e => {
      if (e.eventDate < todayStr || e.eventDate > rangeEndStr) return false;
      if (selectedLeases !== null && e.leaseId && !selectedLeases.has(e.leaseId)) return false;
      return true;
    });
  }, [events, actuals, forecast, viewMode, rangeMonths, selectedLeases, now]);
```
Replace with:
```typescript
  const visibleEvents = useMemo(() => {
    const todayStr = now.toISOString().slice(0, 10);
    const rangeEnd = addMonths(now, rangeMonths);
    const rangeEndStr = rangeEnd.toISOString().slice(0, 10);

    let base: CashEvent[] = [];
    if (viewMode === "actuals")       base = displayEvents.filter(e => !e.isForecast && e.source !== "rule");
    else if (viewMode === "forecast") base = displayEvents.filter(e => e.isForecast || e.source === "rule");
    else                              base = displayEvents;

    return base.filter(e => {
      // Only filter out past dates for rule/forecast events — past actuals always appear in the ledger
      if ((e.isForecast || e.source === "rule") && e.eventDate < todayStr) return false;
      if (e.eventDate > rangeEndStr) return false;
      if (selectedLeases !== null && e.leaseId && !selectedLeases.has(e.leaseId)) return false;
      return true;
    });
  }, [displayEvents, viewMode, rangeMonths, selectedLeases, now]);
```

- [ ] **Step 4: Update netReceivedMTD to use displayEvents**

Find:
```typescript
  const netReceivedMTD = useMemo(() => {
    return events
      .filter(e => !e.isForecast && e.source !== "rule" && e.eventDate.slice(0, 7) === currentMonth)
      .reduce((s, e) => s + e.amount, 0);
  }, [events, currentMonth]);
```
Replace with:
```typescript
  const netReceivedMTD = useMemo(() => {
    return displayEvents
      .filter(e => !e.isForecast && e.source !== "rule" && e.eventDate.slice(0, 7) === currentMonth)
      .reduce((s, e) => s + e.amount, 0);
  }, [displayEvents, currentMonth]);
```

- [ ] **Step 5: Update netForecast12m to use displayEvents**

Find:
```typescript
  const netForecast12m = useMemo(() => {
    const horizon = addMonths(now, 12);
    return events
      .filter(e => (e.isForecast || e.source === "rule") && new Date(e.eventDate) <= horizon)
      .reduce((s, e) => s + e.amount, 0);
  }, [events, now]);
```
Replace with:
```typescript
  const netForecast12m = useMemo(() => {
    const horizon = addMonths(now, 12);
    return displayEvents
      .filter(e => (e.isForecast || e.source === "rule") && new Date(e.eventDate) <= horizon)
      .reduce((s, e) => s + e.amount, 0);
  }, [displayEvents, now]);
```

- [ ] **Step 6: Update largestOutflow90d to use displayEvents**

Find:
```typescript
  const largestOutflow90d = useMemo(() => {
    const next90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const candidates = events.filter(
      e => (e.isForecast || e.source === "rule") && e.amount < 0 && new Date(e.eventDate) <= next90
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((min, e) => e.amount < min.amount ? e : min);
  }, [events, now]);
```
Replace with:
```typescript
  const largestOutflow90d = useMemo(() => {
    const next90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const candidates = displayEvents.filter(
      e => (e.isForecast || e.source === "rule") && e.amount < 0 && new Date(e.eventDate) <= next90
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((min, e) => e.amount < min.amount ? e : min);
  }, [displayEvents, now]);
```

- [ ] **Step 7: Update mrDraws90d to use displayEvents**

Find:
```typescript
  const mrDraws90d = useMemo(() => {
    const next90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const candidates = events.filter(
      e => e.eventType === "mr_draw" && (e.isForecast || e.source === "rule") && new Date(e.eventDate) <= next90
    );
    return { count: candidates.length, total: candidates.reduce((s, e) => s + e.amount, 0) };
  }, [events, now]);
```
Replace with:
```typescript
  const mrDraws90d = useMemo(() => {
    const next90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const candidates = displayEvents.filter(
      e => e.eventType === "mr_draw" && (e.isForecast || e.source === "rule") && new Date(e.eventDate) <= next90
    );
    return { count: candidates.length, total: candidates.reduce((s, e) => s + e.amount, 0) };
  }, [displayEvents, now]);
```

- [ ] **Step 8: Add SAMPLE DATA badge after PageHeader in the JSX**

Find in the return/render section:
```tsx
      <PageHeader
        title="Cash Flow"
        subtitle="Actuals, forecasts, and redelivery cash events across your portfolio"
      >
        <button
          onClick={handleOpenAdd}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: "#3B82F6", border: "none", color: "#FFFFFF",
            borderRadius: "8px", padding: "0.5rem 1rem",
            fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
          }}
        >
          <Plus size={15} /> Add Event
        </button>
      </PageHeader>

      {/* KPI Strip */}
```
Replace with:
```tsx
      <PageHeader
        title="Cash Flow"
        subtitle="Actuals, forecasts, and redelivery cash events across your portfolio"
      >
        <button
          onClick={handleOpenAdd}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: "#3B82F6", border: "none", color: "#FFFFFF",
            borderRadius: "8px", padding: "0.5rem 1rem",
            fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
          }}
        >
          <Plus size={15} /> Add Event
        </button>
      </PageHeader>

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

      {/* KPI Strip */}
```

- [ ] **Step 9: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built in`

- [ ] **Step 10: Run full test suite**

Run: `npx vitest run 2>&1 | tail -5`
Expected: all 477 tests passing

- [ ] **Step 11: Commit**

```bash
git add src/app/pages/CashFlow.tsx
git commit -m "feat: CashFlow demo mode — display SAMPLE_CASH_EVENTS when no live data"
```
