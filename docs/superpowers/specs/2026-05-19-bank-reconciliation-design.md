# Bank Reconciliation — Design Spec

**Date:** 2026-05-19
**Feature:** Feature 13 — Bank Reconciliation
**Status:** Approved for implementation

---

## Goal

Add auto-matching of bank transactions (from Feature 12) against the lease register. A pure client-side scoring engine assigns a confidence score to each transaction → lease pairing. Users bulk-accept high-confidence matches, then manually resolve disputed and unmatched items. Confirmed matches persist to Supabase.

## Architecture

**Approach:** Client-side matching engine (TypeScript) + one new Supabase table. No edge functions. Consistent with the ECL and ABS waterfall patterns.

The existing `Reconciliation.tsx` page gains a tab switcher when a statement is selected: **Transactions** (existing browser) | **Reconcile** (new workspace).

**New files:**
- `supabase/migrations/010_reconciliation_matches.sql`
- `src/app/utils/reconciliationMatcher.ts` — scoring engine + types
- `src/app/utils/reconciliationMatcher.test.ts` — unit tests
- `src/app/hooks/useReconciliation.ts` — run matching, upsert/fetch saved state
- `src/app/components/reconciliation/ReconciliationWorkspace.tsx` — UI

**Modified files:**
- `src/app/pages/Reconciliation.tsx` — add tab switcher when statement selected

---

## Data Model

### `reconciliation_matches` table

```sql
create table if not exists reconciliation_matches (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id) on delete cascade,
  statement_id   uuid not null references bank_statements(id) on delete cascade,
  transaction_id uuid not null references bank_transactions(id) on delete cascade,
  lease_id       uuid references leases(id) on delete set null,  -- null = unmatched
  match_type     text not null,  -- 'auto' | 'manual' | 'unmatched'
  confidence     numeric,        -- 0–1; null when match_type = 'unmatched'
  amount_delta   numeric,        -- txn.amount − lease.monthly_rental; null if unmatched
  confirmed      boolean not null default false,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (transaction_id)        -- one match record per transaction
);

create index if not exists recon_matches_statement_idx
  on reconciliation_matches(statement_id);
create index if not exists recon_matches_org_idx
  on reconciliation_matches(org_id);
```

### Match lifecycle

| `confirmed` | `match_type` | Meaning |
|-------------|-------------|---------|
| `false` | `'auto'` | Computed, not yet accepted |
| `true` | `'auto'` | Bulk-accepted via "Accept All" |
| `true` | `'manual'` | User overrode the lease assignment |
| `true` | `'unmatched'` | User explicitly marked as no match |

---

## Matching Engine

### File: `src/app/utils/reconciliationMatcher.ts`

#### Types

```typescript
export interface LeaseCandidate {
  lease:      Lease;
  lessee:     Lessee;
  asset:      Asset;
}

export type MatchType = "auto" | "manual" | "unmatched";

export interface MatchResult {
  transactionId: string;
  transaction:   BankTransaction;
  bestMatch:     LeaseCandidate | null;
  confidence:    number;           // 0–1
  amountDelta:   number | null;    // txn.amount − lease.monthly_rental
  matchType:     MatchType;        // 'auto' if confidence ≥ 0.8, 'unmatched' if no candidates
  confirmed:     boolean;
}

export interface ReconciliationResult {
  statementId:  string;
  matches:      MatchResult[];
  autoCount:    number;   // confidence ≥ 0.8
  reviewCount:  number;   // 0.4 ≤ confidence < 0.8
  unmatchedCount: number; // confidence < 0.4
}
```

#### `scoreTransaction(txn, candidate): number`

Returns a confidence score 0–1.

**Amount score (weight 0.5):**
```
delta = |txn.amount − lease.monthly_rental|
ratio = delta / lease.monthly_rental
amountScore = max(0, 1 − ratio)   // zero if delta ≥ 100%
```
Only applies to credit transactions (`txn.amount > 0`). If `lease.monthly_rental` is null or zero, `amountScore = 0`.

**Date score (weight 0.3):**
- 1.0 if `txn.valueDate` is between `lease.start_date` and `lease.end_date` (inclusive)
- 0.5 if within 45 days outside the lease period
- 0.0 otherwise

**Lessee score (weight 0.2):**
- 1.0 if `txn.description` or `txn.reference` contains `lessee.name` or `lessee.iata_code` (case-insensitive, trimmed)
- 0.0 otherwise

**Combined:** `score = 0.5 × amountScore + 0.3 × dateScore + 0.2 × lesseeScore`

#### `matchTransactions(transactions, leases, lessees, assets): ReconciliationResult`

- Filters to credit transactions only (`txn.amount > 0`). Debits are excluded from matching.
- For each credit transaction, scores against **all leases in the register** (no pre-filtering). The date score already penalises leases whose period is far from the transaction date.
- Best match = highest-scoring `LeaseCandidate`.
- If best score ≥ 0.8: `matchType = 'auto'`
- If best score 0.4–0.79: `matchType = 'auto'` (placed in "Needs Review" section but still auto-typed until confirmed)
- If best score < 0.4 or no candidates: `matchType = 'unmatched'`, `bestMatch = null`
- Returns `ReconciliationResult` with counts for header summary.

**Note:** Debit transactions are not included in `matches` — they appear in the Transactions tab only.

---

## Hook: `useReconciliation`

### File: `src/app/hooks/useReconciliation.ts`

```typescript
interface UseReconciliationReturn {
  result:       ReconciliationResult | null;
  loading:      boolean;
  saving:       boolean;
  runMatching:  (statementId: string, transactions: BankTransaction[]) => void;
  acceptAll:    (statementId: string) => Promise<void>;
  acceptOne:    (transactionId: string) => Promise<void>;
  overrideMatch:(transactionId: string, leaseId: string) => Promise<void>;
  markUnmatched:(transactionId: string) => Promise<void>;
  rerun:        (statementId: string, transactions: BankTransaction[]) => void;
}
```

- On mount (given a `statementId`): fetches saved `reconciliation_matches` rows from Supabase. If rows exist, reconstructs `ReconciliationResult` from saved state (no re-computation). If no rows exist, the result is null (user must click "Run Matching").
- `runMatching`: calls `matchTransactions`, upserts all rows to `reconciliation_matches` with `confirmed = false`.
- `acceptAll`: sets `confirmed = true`, `confirmed_at = now()` for all rows where `confidence ≥ 0.8` and `confirmed = false`.
- `acceptOne`: sets `confirmed = true` for a single row.
- `overrideMatch`: updates `lease_id`, sets `match_type = 'manual'`, `confirmed = true`.
- `markUnmatched`: sets `lease_id = null`, `match_type = 'unmatched'`, `confirmed = true`.
- `rerun`: deletes ALL existing rows for the statement (including confirmed ones), re-runs `matchTransactions`, upserts fresh results. The UI must warn the user before calling this.

Uses `usePortfolioData()` internally to access leases, lessees, assets.

---

## UI

### `ReconciliationWorkspace.tsx`

**Header bar:**
- Progress: `42 / 67 reconciled` (progress pill)
- Chips: `38 auto-matched · 12 needs review · 17 unmatched`
- Primary button: **"Accept All Auto-Matches (38)"** — bulk-confirms all `confidence ≥ 0.8` rows
- Secondary: **"Re-run Matching"** — clears and recomputes

**Empty state** (no matching run yet): centred card with "Run Matching" button and explanation: "Automatically scores each bank credit against active leases by amount, date, and lessee name."

**Three collapsible sections:**

| Section | Threshold | Default | Border |
|---------|-----------|---------|--------|
| ✅ Auto-matched | confidence ≥ 0.8 | Collapsed after Accept All | Green |
| ⚠️ Needs Review | 0.4 ≤ confidence < 0.8 | Expanded | Amber |
| ❌ Unmatched | confidence < 0.4 | Expanded | Red |

**Each row columns:** Date · Description · Amount → Lessee name · Lease ref (asset registration) · Confidence % · **[Accept] [Override ▾] [Mark Unmatched]**

- Accepted rows show a ✓ badge; action buttons are hidden.
- **Override dropdown:** searchable list of all active leases, showing `lessee.name — asset.registration — $X/mo`. Selecting saves `match_type: 'manual'`, `confirmed: true`.
- Confirmed rows in "Needs Review" move visually into the "Auto-matched" section after acceptance.

### `Reconciliation.tsx` modification

When a statement is selected, the expansion area shows a tab bar:

```
[ Transactions ]  [ Reconcile ]
```

- "Transactions" tab: existing `TransactionBrowser` (unchanged)
- "Reconcile" tab: `<ReconciliationWorkspace statementId={...} transactions={...} />`

---

## Testing

`src/app/utils/reconciliationMatcher.test.ts` — five tests:

1. **Perfect match** — transaction with exact amount, date in-period, lessee name in description → confidence ≥ 0.8, `matchType = 'auto'`
2. **Amount mismatch only** — amount 20% off, date in-period, lessee name matches → confidence in review range (0.4–0.79)
3. **No lessee name, date out of range** — only partial amount match → `matchType = 'unmatched'` (confidence < 0.4)
4. **Debit transaction excluded** — negative amount transaction → not included in `matches`
5. **Null monthly_rental** — lease with `monthly_rental = null` → `amountScore = 0`, never auto-matched

---

## Out of Scope (this sprint)

- Multi-period reconciliation tracking (reconciling multiple months in sequence)
- Export of reconciliation report to PDF/CSV
- Automated tolerance configuration (hardcoded thresholds for now)
- Reconciling debit transactions against fee invoices
- Duplicate transaction detection across statements
