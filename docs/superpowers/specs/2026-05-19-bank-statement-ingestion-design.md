# Bank Statement Ingestion — Design Spec

**Date:** 2026-05-19
**Feature:** Feature 12 — Bank Statement Ingestion
**Status:** Approved for implementation

---

## Goal

Add a Reconciliation section to Aeroinsights that lets users upload bank statements (CSV or XLSX), auto-map columns, preview parsed transactions, and persist them to Supabase. This is the data-layer foundation for bank reconciliation (Feature 13).

## Architecture

**Approach:** Client-side SheetJS parsing + two new Supabase tables. No edge functions. Follows the same pure client-side computation pattern as the ECL and ABS waterfall engines.

**New files:**
- `supabase/migrations/009_bank_statements.sql` — `bank_statements` + `bank_transactions` tables
- `src/app/utils/bankStatementParser.ts` — SheetJS/CSV parsing + column-detection heuristics
- `src/app/utils/bankStatementParser.test.ts` — unit tests for parser and column detector
- `src/app/hooks/useBankStatements.ts` — Supabase CRUD for statements + transactions
- `src/app/components/reconciliation/StatementUploadModal.tsx` — 3-step upload modal
- `src/app/pages/Reconciliation.tsx` — top-level page

**Modified files:**
- `src/app/routes.tsx` — add `/reconciliation` route
- `src/app/components/layout/Sidebar.tsx` — add Reconciliation nav section

---

## Data Model

### `bank_statements` table

```sql
create table if not exists bank_statements (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  filename     text not null,
  currency     text not null default 'USD',
  period_label text not null,
  row_count    int  not null default 0,
  uploaded_at  timestamptz not null default now()
);

create index if not exists bank_statements_org_idx
  on bank_statements(org_id, uploaded_at desc);
```

### `bank_transactions` table

```sql
create table if not exists bank_transactions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  statement_id uuid not null references bank_statements(id) on delete cascade,
  value_date   date not null,
  description  text not null,
  amount       numeric not null,  -- signed: positive = credit, negative = debit
  currency     text not null default 'USD',
  reference    text,
  created_at   timestamptz not null default now()
);

create index if not exists bank_transactions_org_idx
  on bank_transactions(org_id, value_date desc);
create index if not exists bank_transactions_statement_idx
  on bank_transactions(statement_id);
```

---

## Parser

### File: `src/app/utils/bankStatementParser.ts`

#### Types

```typescript
export type ColumnRole =
  | "date"
  | "description"
  | "debit"
  | "credit"
  | "amount"    // single signed-amount column (positive = credit)
  | "balance"
  | "reference"
  | "ignore";

export interface ColumnMapping {
  index: number;
  header: string;
  role: ColumnRole;
}

export interface ParsedTransaction {
  valueDate:   string;   // ISO date string YYYY-MM-DD
  description: string;
  amount:      number;   // signed: positive = credit, negative = debit
  reference:   string;
}

export interface ParseResult {
  headers:      string[];
  rawRows:      string[][];    // first 5 rows for preview
  mappings:     ColumnMapping[];
  transactions: ParsedTransaction[];
  errors:       string[];
}
```

#### `parseFile(file: File): Promise<ParseResult>`

Reads `.csv` or `.xlsx` using SheetJS (`XLSX.read`). Returns raw rows as `string[][]` with headers in row 0. Calls `detectColumns(headers)` automatically.

CSV: use `XLSX.read(text, { type: "string" })`.
XLSX: use `XLSX.read(buffer, { type: "array" })`. Use the first sheet.

Max rows: 10,000. If the file exceeds this, return an error.

#### `detectColumns(headers: string[]): ColumnMapping[]`

Heuristic matching — case-insensitive, partial match against keyword lists:

| Role | Keywords |
|------|----------|
| `date` | date, value date, posting date, trans date, txn date, transaction date |
| `description` | description, narrative, details, particulars, memo, remarks, transaction |
| `debit` | debit, dr, withdrawal, withdrawals, out, paid out, charge |
| `credit` | credit, cr, deposit, deposits, in, received, paid in |
| `amount` | amount, net amount, net, value |
| `balance` | balance, running balance, closing balance |
| `reference` | reference, ref, cheque, check, voucher, id |

First match wins per column. Unmatched columns get `"ignore"`. Only one of (`debit`+`credit`) OR (`amount`) should be active — if both patterns exist, prefer the `debit`/`credit` pair.

#### `applyMappings(rows: string[][], mappings: ColumnMapping[]): { transactions: ParsedTransaction[]; errors: string[] }`

Converts raw string rows to `ParsedTransaction[]` using the resolved column mapping.

Date parsing: try `new Date(value)` — if invalid, try common formats (DD/MM/YYYY, MM/DD/YYYY, YYYYMMDD). If still unparseable, add to errors and skip the row.

Amount calculation:
- If `debit` + `credit` columns exist: `amount = parseFloat(credit || "0") - parseFloat(debit || "0")`
- If single `amount` column: `amount = parseFloat(value)` (already signed)
- Strip commas and currency symbols before parsing.

Skip rows where amount is NaN or date is invalid. Collect errors but continue processing.

---

## Hook: `useBankStatements`

### File: `src/app/hooks/useBankStatements.ts`

```typescript
interface UseBankStatementsReturn {
  statements:        BankStatement[];
  loading:           boolean;
  importStatement:   (
    payload:      Omit<BankStatement, "id" | "uploadedAt" | "orgId">,
    transactions: ParsedTransaction[]
  ) => Promise<void>;
  fetchTransactions: (statementId: string) => Promise<BankTransaction[]>;
}
```

- Fetches all statements for `orgId` on mount with cancelled-flag pattern (same as `useEclSnapshots`).
- `fetchTransactions(statementId)` is a one-shot async function (not reactive state) — called by the page when the user selects a statement. Returns `BankTransaction[]` directly.
- `importStatement`: inserts `bank_statements` row first (`returning: "representation"` to get the new `id`), then batch-inserts all `bank_transactions` rows in a single `.insert(rows)` call. If the transaction insert fails, throws — the statement row will have `row_count = 0` identifying it as a failed import. After a successful import, refreshes the statements list inline (same inline-refresh pattern as `useAbsDeals.createDeal`).

Types:
```typescript
export interface BankStatement {
  id:          string;
  orgId:       string;
  filename:    string;
  currency:    string;
  periodLabel: string;
  rowCount:    number;
  uploadedAt:  string;
}

export interface BankTransaction {
  id:          string;
  orgId:       string;
  statementId: string;
  valueDate:   string;
  description: string;
  amount:      number;
  currency:    string;
  reference:   string | null;
}
```

---

## UI

### `StatementUploadModal.tsx`

Three-step modal:

**Step 1 — Upload:**
- Drag-drop zone (dashed border, `<input type="file" accept=".csv,.xlsx">`)
- On drop/select: call `parseFile(file)` → show spinner → transition to Step 2
- Show filename, detected row count

**Step 2 — Map Columns:**
- Table of detected columns: Column Header | Detected Role (dropdown) | Sample Value (first non-empty cell)
- Dropdown options: Date / Description / Debit / Credit / Amount / Balance / Reference / Ignore
- Auto-filled from `detectColumns()` — user can override any row
- Validation: must have exactly one `date`, one `description`, and either (`debit` + `credit`) or (`amount`)
- "Re-apply" button re-runs detection from scratch
- Below the table: show first 3 parsed transactions as a live preview (updates as user changes mappings)
- Period label input (free text, e.g. "May 2026") and currency selector (USD / EUR / GBP)

**Step 3 — Preview & Confirm:**
- Summary card: N transactions, date range (earliest → latest), total credits, total debits, net
- First 10 rows in a compact table (date, description, amount)
- Any parse errors shown as amber warnings (skipped rows)
- "Import [N] transactions" button → calls `importStatement` → success → close modal

### `Reconciliation.tsx`

Two render states:

**No statements:** Centred empty state, "Upload your first bank statement" button opens `StatementUploadModal`.

**Has statements:**
- Header with "Upload Statement" button
- Statements list (cards): filename, period label, currency, row count, uploaded date
- Clicking a statement expands a transaction browser table below: date, description, amount (colour-coded: green credit, red debit), reference
- Transaction table has a search/filter input and shows total net for the selected statement

---

## Navigation

### Sidebar

Add a new "Reconciliation" group between Analysis and Intelligence:

```typescript
{
  label: "Reconciliation",
  items: [
    {
      title: "Bank Statements",
      url: "/reconciliation",
      icon: FileText,
      items: [
        { title: "Statements",    url: "/reconciliation",          icon: FileSpreadsheet },
        { title: "Transactions",  url: "/reconciliation",          icon: ArrowLeftRight  },
      ],
    },
  ],
}
```

### Routes

```typescript
{ path: "reconciliation", Component: Reconciliation },
```

Inside the existing `RequireAuth → Layout` block.

---

## Testing

`src/app/utils/bankStatementParser.test.ts` — five tests:

1. **CSV debit/credit format** — parses a 3-row CSV with Date/Description/Debit/Credit columns; verifies amounts are correctly signed
2. **XLSX single-amount format** — parses a buffer with a single Amount column; verifies positive values are credits
3. **Column detection** — `detectColumns(["Value Date","Narrative","DR","CR","Balance"])` returns correct roles
4. **Date format tolerance** — DD/MM/YYYY and MM/DD/YYYY both parse correctly to ISO strings
5. **Skip invalid rows** — a row with an unparseable date is skipped and added to `errors`; valid rows still import

---

## Out of Scope (this sprint)

- Matching transactions against the lease register (Feature 13 — bank reconciliation)
- Duplicate detection across uploads
- Servicer report ingestion (different schema — linked to abs_deal_id, tranche-level)
- Editing or deleting individual transactions after import
- Multi-currency conversion
