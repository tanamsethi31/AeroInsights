# Bank Statement Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Reconciliation section where users upload CSV/XLSX bank statements, auto-map columns, preview parsed transactions, and persist them to Supabase.

**Architecture:** Client-side SheetJS parsing (already installed as `xlsx@0.18.5`) + two new Supabase tables (`bank_statements`, `bank_transactions`) + a 3-step upload modal. No edge functions. Follows the same pure client-side computation pattern as the ECL and ABS waterfall engines.

**Tech Stack:** TypeScript, SheetJS (`xlsx`), React, Framer Motion, Supabase JS v2, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/app/utils/bankStatementParser.ts` | Create | SheetJS parsing, column detection, mapping application |
| `src/app/utils/bankStatementParser.test.ts` | Create | 5 Vitest unit tests for parser |
| `supabase/migrations/009_bank_statements.sql` | Create | `bank_statements` + `bank_transactions` tables |
| `src/app/hooks/useBankStatements.ts` | Create | Supabase CRUD hook |
| `src/app/components/reconciliation/StatementUploadModal.tsx` | Create | 3-step upload modal |
| `src/app/pages/Reconciliation.tsx` | Create | Top-level Reconciliation page |
| `src/app/routes.tsx` | Modify | Add `/reconciliation` route |
| `src/app/components/layout/Sidebar.tsx` | Modify | Add Reconciliation nav group |

---

## Task 1: Parser + Tests (TDD)

**Files:**
- Create: `src/app/utils/bankStatementParser.ts`
- Create: `src/app/utils/bankStatementParser.test.ts`

- [ ] **Step 1: Write all 5 failing tests**

Create `src/app/utils/bankStatementParser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { detectColumns, applyMappings } from "./bankStatementParser";
import type { ColumnMapping } from "./bankStatementParser";

// ── Test 1: column detection ──────────────────────────────────────────────────

describe("detectColumns", () => {
  it("detects correct roles for common bank statement headers", () => {
    const mappings = detectColumns(["Value Date", "Narrative", "DR", "CR", "Balance"]);
    expect(mappings[0].role).toBe("date");
    expect(mappings[1].role).toBe("description");
    expect(mappings[2].role).toBe("debit");
    expect(mappings[3].role).toBe("credit");
    expect(mappings[4].role).toBe("balance");
  });

  it("suppresses Amount when both Debit and Credit columns exist", () => {
    const mappings = detectColumns(["Date", "Description", "Debit", "Credit", "Amount"]);
    const amountCol = mappings.find(m => m.header === "Amount");
    expect(amountCol?.role).toBe("ignore");
  });
});

// ── Test 2: CSV debit/credit format ──────────────────────────────────────────

describe("applyMappings — debit/credit columns", () => {
  it("correctly signs amounts: credit positive, debit negative", () => {
    const rows = [
      ["2026-01-01", "Deposit",    "0.00",   "1000.00"],
      ["2026-01-02", "Withdrawal", "200.00", "0.00"  ],
      ["2026-01-03", "Fee",        "50.00",  "0.00"  ],
    ];
    const mappings: ColumnMapping[] = [
      { index: 0, header: "Date",        role: "date"        },
      { index: 1, header: "Description", role: "description" },
      { index: 2, header: "Debit",       role: "debit"       },
      { index: 3, header: "Credit",      role: "credit"      },
    ];
    const { transactions, errors } = applyMappings(rows, mappings);
    expect(errors).toHaveLength(0);
    expect(transactions).toHaveLength(3);
    expect(transactions[0].amount).toBe(1000);
    expect(transactions[1].amount).toBe(-200);
    expect(transactions[2].amount).toBe(-50);
  });
});

// ── Test 3: single-amount column (XLSX or CSV) ───────────────────────────────

describe("applyMappings — single amount column", () => {
  it("treats positive as credit and negative as debit", () => {
    const rows = [
      ["2026-02-01", "Salary",  "5000" ],
      ["2026-02-02", "Rent",    "-1200"],
    ];
    const mappings: ColumnMapping[] = [
      { index: 0, header: "Date",   role: "date"        },
      { index: 1, header: "Memo",   role: "description" },
      { index: 2, header: "Amount", role: "amount"      },
    ];
    const { transactions, errors } = applyMappings(rows, mappings);
    expect(errors).toHaveLength(0);
    expect(transactions[0].amount).toBe(5000);
    expect(transactions[1].amount).toBe(-1200);
  });
});

// ── Test 4: date format tolerance ────────────────────────────────────────────

describe("applyMappings — date format tolerance", () => {
  it("parses DD/MM/YYYY and ISO dates to ISO strings", () => {
    const rows = [
      ["15/03/2026", "Transfer A", "100"],
      ["2026-04-20", "Transfer B", "200"],
    ];
    const mappings: ColumnMapping[] = [
      { index: 0, header: "Date",   role: "date"        },
      { index: 1, header: "Desc",   role: "description" },
      { index: 2, header: "Amount", role: "amount"      },
    ];
    const { transactions, errors } = applyMappings(rows, mappings);
    expect(errors).toHaveLength(0);
    expect(transactions[0].valueDate).toBe("2026-03-15");
    expect(transactions[1].valueDate).toBe("2026-04-20");
  });
});

// ── Test 5: skip invalid rows ─────────────────────────────────────────────────

describe("applyMappings — skip invalid rows", () => {
  it("skips rows with unparseable dates and adds to errors; valid rows still import", () => {
    const rows = [
      ["not-a-date", "Transfer A", "100"],
      ["2026-01-10", "Transfer B", "200"],
    ];
    const mappings: ColumnMapping[] = [
      { index: 0, header: "Date",   role: "date"        },
      { index: 1, header: "Desc",   role: "description" },
      { index: 2, header: "Amount", role: "amount"      },
    ];
    const { transactions, errors } = applyMappings(rows, mappings);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("not-a-date");
    expect(transactions).toHaveLength(1);
    expect(transactions[0].valueDate).toBe("2026-01-10");
  });
});
```

- [ ] **Step 2: Run tests — confirm all 5 fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx vitest run src/app/utils/bankStatementParser.test.ts
```

Expected: 5 failures with "Cannot find module" or similar.

- [ ] **Step 3: Implement the parser**

Create `src/app/utils/bankStatementParser.ts`:

```typescript
import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ColumnRole =
  | "date"
  | "description"
  | "debit"
  | "credit"
  | "amount"    // signed: positive = credit
  | "balance"
  | "reference"
  | "ignore";

export interface ColumnMapping {
  index:  number;
  header: string;
  role:   ColumnRole;
}

export interface ParsedTransaction {
  valueDate:   string;   // ISO date YYYY-MM-DD
  description: string;
  amount:      number;   // signed: positive = credit, negative = debit
  reference:   string;
}

export interface ParseResult {
  headers:      string[];
  rawRows:      string[][];    // first 5 data rows (for column-mapping preview table)
  allDataRows:  string[][];    // all data rows (used when re-applying mappings in modal)
  mappings:     ColumnMapping[];
  transactions: ParsedTransaction[];
  errors:       string[];
}

// ── Column detection ──────────────────────────────────────────────────────────

const ROLE_KEYWORDS: Record<Exclude<ColumnRole, "ignore">, string[]> = {
  date:        ["date", "value date", "posting date", "trans date", "txn date", "transaction date"],
  description: ["description", "narrative", "details", "particulars", "memo", "remarks", "transaction"],
  debit:       ["debit", "dr", "withdrawal", "withdrawals", "out", "paid out", "charge"],
  credit:      ["credit", "cr", "deposit", "deposits", "in", "received", "paid in"],
  amount:      ["amount", "net amount", "net", "value"],
  balance:     ["balance", "running balance", "closing balance"],
  reference:   ["reference", "ref", "cheque", "check", "voucher", "id"],
};

export function detectColumns(headers: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = headers.map((header, index) => {
    const lower = header.toLowerCase().trim();
    for (const [role, keywords] of Object.entries(ROLE_KEYWORDS) as [Exclude<ColumnRole, "ignore">, string[]][]) {
      if (keywords.some(kw => lower.includes(kw))) {
        return { index, header, role };
      }
    }
    return { index, header, role: "ignore" as ColumnRole };
  });

  // If both debit+credit AND amount are present, prefer debit/credit — suppress amount
  const hasDebit  = mappings.some(m => m.role === "debit");
  const hasCredit = mappings.some(m => m.role === "credit");
  if (hasDebit && hasCredit) {
    for (const m of mappings) {
      if (m.role === "amount") m.role = "ignore";
    }
  }

  return mappings;
}

// ── Date parsing ──────────────────────────────────────────────────────────────

function parseDate(value: string): string | null {
  if (!value || !value.trim()) return null;

  // Try native JS parse (handles ISO, RFC 2822, etc.)
  const d1 = new Date(value);
  if (!isNaN(d1.getTime())) return d1.toISOString().slice(0, 10);

  // DD/MM/YYYY
  const m1 = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const d2 = new Date(`${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`);
    if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10);
  }

  // MM/DD/YYYY — only if first didn't parse (ambiguous with DD/MM when day ≤ 12)
  const m2 = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) {
    const d3 = new Date(`${m2[3]}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`);
    if (!isNaN(d3.getTime())) return d3.toISOString().slice(0, 10);
  }

  // YYYYMMDD
  const m3 = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m3) {
    const d4 = new Date(`${m3[1]}-${m3[2]}-${m3[3]}`);
    if (!isNaN(d4.getTime())) return d4.toISOString().slice(0, 10);
  }

  return null;
}

// ── Amount parsing ────────────────────────────────────────────────────────────

function parseAmount(value: string): number {
  return parseFloat(value.replace(/[,$£€\s]/g, "").trim());
}

// ── Apply mappings ─────────────────────────────────────────────────────────────

export function applyMappings(
  rows: string[][],
  mappings: ColumnMapping[]
): { transactions: ParsedTransaction[]; errors: string[] } {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  const dateCol   = mappings.find(m => m.role === "date");
  const descCol   = mappings.find(m => m.role === "description");
  const debitCol  = mappings.find(m => m.role === "debit");
  const creditCol = mappings.find(m => m.role === "credit");
  const amountCol = mappings.find(m => m.role === "amount");
  const refCol    = mappings.find(m => m.role === "reference");

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i];
    const rowNum = i + 2; // +1 for header row, +1 for 1-based display

    // Date
    const rawDate  = dateCol ? (row[dateCol.index] ?? "") : "";
    const valueDate = parseDate(rawDate);
    if (!valueDate) {
      errors.push(`Row ${rowNum}: unparseable date "${rawDate}"`);
      continue;
    }

    // Description
    const description = (descCol ? row[descCol.index] ?? "" : "").trim();

    // Amount
    let amount: number;
    if (debitCol && creditCol) {
      const credit = parseAmount(row[creditCol.index] ?? "0");
      const debit  = parseAmount(row[debitCol.index]  ?? "0");
      amount = (isNaN(credit) ? 0 : credit) - (isNaN(debit) ? 0 : debit);
    } else if (amountCol) {
      amount = parseAmount(row[amountCol.index] ?? "");
    } else {
      errors.push(`Row ${rowNum}: no amount column mapped`);
      continue;
    }

    if (isNaN(amount)) {
      errors.push(`Row ${rowNum}: unparseable amount`);
      continue;
    }

    const reference = (refCol ? row[refCol.index] ?? "" : "").trim();

    transactions.push({ valueDate, description, amount, reference });
  }

  return { transactions, errors };
}

// ── File parsing ──────────────────────────────────────────────────────────────

const MAX_ROWS = 10_000;

export async function parseFile(file: File): Promise<ParseResult> {
  let workbook: XLSX.WorkBook;

  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  } else {
    const text = await file.text();
    workbook = XLSX.read(text, { type: "string" });
  }

  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  const all: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw:    false,
    defval: "",
  }) as string[][];

  if (all.length === 0) {
    return { headers: [], rawRows: [], allDataRows: [], mappings: [], transactions: [], errors: ["File is empty"] };
  }

  const headers      = all[0].map(h => String(h));
  const allDataRows  = all.slice(1);

  if (allDataRows.length > MAX_ROWS) {
    return {
      headers,
      rawRows:     allDataRows.slice(0, 5),
      allDataRows: [],
      mappings:    [],
      transactions: [],
      errors: [`File exceeds ${MAX_ROWS.toLocaleString()} row limit (${allDataRows.length.toLocaleString()} rows found)`],
    };
  }

  const mappings              = detectColumns(headers);
  const { transactions, errors } = applyMappings(allDataRows, mappings);

  return {
    headers,
    rawRows:      allDataRows.slice(0, 5),
    allDataRows,
    mappings,
    transactions,
    errors,
  };
}
```

- [ ] **Step 4: Run tests — confirm all 5 pass**

```bash
npx vitest run src/app/utils/bankStatementParser.test.ts
```

Expected output:
```
✓ src/app/utils/bankStatementParser.test.ts (5)
  ✓ detectColumns > detects correct roles for common bank statement headers
  ✓ detectColumns > suppresses Amount when both Debit and Credit columns exist
  ✓ applyMappings — debit/credit columns > correctly signs amounts
  ✓ applyMappings — single amount column > treats positive as credit and negative as debit
  ✓ applyMappings — date format tolerance > parses DD/MM/YYYY and ISO dates
  ✓ applyMappings — skip invalid rows > skips rows with unparseable dates
Test Files  1 passed (1)
```

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/bankStatementParser.ts src/app/utils/bankStatementParser.test.ts
git commit -m "feat: add bank statement parser with column detection and SheetJS parsing"
```

---

## Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/009_bank_statements.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/009_bank_statements.sql`:

```sql
-- supabase/migrations/009_bank_statements.sql
-- Bank reconciliation data: statements and transactions

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

- [ ] **Step 2: Apply via Supabase MCP (project `naqgfwnbhybhtirazkjq`)**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool:
- `project_id`: `naqgfwnbhybhtirazkjq`
- `name`: `009_bank_statements`
- `query`: (contents of the SQL file above)

- [ ] **Step 3: Verify tables were created**

Use `mcp__plugin_supabase_supabase__list_tables` to confirm `bank_statements` and `bank_transactions` appear.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_bank_statements.sql
git commit -m "feat: add bank_statements and bank_transactions migration"
```

---

## Task 3: useBankStatements Hook

**Files:**
- Create: `src/app/hooks/useBankStatements.ts`

- [ ] **Step 1: Implement the hook**

Create `src/app/hooks/useBankStatements.ts`:

```typescript
// src/app/hooks/useBankStatements.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import type { ParsedTransaction } from "../utils/bankStatementParser";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Row mappers ───────────────────────────────────────────────────────────────

function mapStatementRow(r: Record<string, unknown>): BankStatement {
  return {
    id:          r.id          as string,
    orgId:       r.org_id      as string,
    filename:    r.filename    as string,
    currency:    r.currency    as string,
    periodLabel: r.period_label as string,
    rowCount:    r.row_count   as number,
    uploadedAt:  r.uploaded_at as string,
  };
}

function mapTransactionRow(r: Record<string, unknown>): BankTransaction {
  return {
    id:          r.id          as string,
    orgId:       r.org_id      as string,
    statementId: r.statement_id as string,
    valueDate:   r.value_date  as string,
    description: r.description as string,
    amount:      Number(r.amount),
    currency:    r.currency    as string,
    reference:   (r.reference  as string) ?? null,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseBankStatementsReturn {
  statements:        BankStatement[];
  loading:           boolean;
  importStatement:   (
    payload:      Omit<BankStatement, "id" | "uploadedAt" | "orgId">,
    transactions: ParsedTransaction[]
  ) => Promise<void>;
  fetchTransactions: (statementId: string) => Promise<BankTransaction[]>;
}

export function useBankStatements(): UseBankStatementsReturn {
  const { orgId } = useData();
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [loading, setLoading]       = useState(true);

  // Fetch all statements for org on mount (cancelled-flag pattern)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!orgId) { setLoading(false); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from("bank_statements")
        .select("*")
        .eq("org_id", orgId)
        .order("uploaded_at", { ascending: false });
      if (cancelled) return;
      if (!error && data) {
        setStatements((data as Record<string, unknown>[]).map(mapStatementRow));
      }
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [orgId]);

  const importStatement = useCallback(
    async (
      payload:      Omit<BankStatement, "id" | "uploadedAt" | "orgId">,
      transactions: ParsedTransaction[]
    ) => {
      if (!orgId) return;

      // Insert statement row and get back the new id (returning: "representation" via .select())
      const { data: stmtData, error: stmtError } = await supabase
        .from("bank_statements")
        .insert({
          org_id:       orgId,
          filename:     payload.filename,
          currency:     payload.currency,
          period_label: payload.periodLabel,
          row_count:    payload.rowCount,
        })
        .select()
        .single();

      if (stmtError || !stmtData) throw stmtError ?? new Error("Failed to insert statement");

      const statementId = (stmtData as Record<string, unknown>).id as string;

      // Batch-insert all transactions in a single call
      if (transactions.length > 0) {
        const txRows = transactions.map(t => ({
          org_id:       orgId,
          statement_id: statementId,
          value_date:   t.valueDate,
          description:  t.description,
          amount:       t.amount,
          currency:     payload.currency,
          reference:    t.reference || null,
        }));
        const { error: txError } = await supabase.from("bank_transactions").insert(txRows);
        if (txError) throw txError;
      }

      // Inline refresh — same pattern as useAbsDeals.createDeal
      const { data } = await supabase
        .from("bank_statements")
        .select("*")
        .eq("org_id", orgId)
        .order("uploaded_at", { ascending: false });
      if (data) setStatements((data as Record<string, unknown>[]).map(mapStatementRow));
    },
    [orgId]
  );

  // One-shot async fetch — called by Reconciliation page when user selects a statement
  const fetchTransactions = useCallback(
    async (statementId: string): Promise<BankTransaction[]> => {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("statement_id", statementId)
        .order("value_date", { ascending: true });
      if (error || !data) return [];
      return (data as Record<string, unknown>[]).map(mapTransactionRow);
    },
    []
  );

  return { statements, loading, importStatement, fetchTransactions };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/hooks/useBankStatements.ts
git commit -m "feat: add useBankStatements hook for Supabase CRUD"
```

---

## Task 4: StatementUploadModal

**Files:**
- Create: `src/app/components/reconciliation/StatementUploadModal.tsx`

- [ ] **Step 1: Create the reconciliation directory and implement the modal**

```bash
mkdir -p /Users/tanamsethi/Downloads/Aeroinsights/src/app/components/reconciliation
```

Create `src/app/components/reconciliation/StatementUploadModal.tsx`:

```tsx
// src/app/components/reconciliation/StatementUploadModal.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, ChevronLeft, ChevronRight, Check, AlertTriangle, RotateCcw } from "lucide-react";
import {
  parseFile,
  applyMappings,
  type ParseResult,
  type ColumnMapping,
  type ColumnRole,
  type ParsedTransaction,
} from "../../utils/bankStatementParser";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportPayload {
  filename:    string;
  currency:    string;
  periodLabel: string;
  rowCount:    number;
}

interface Props {
  open:     boolean;
  onClose:  () => void;
  onImport: (payload: ImportPayload, transactions: ParsedTransaction[]) => Promise<void>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: ColumnRole[] = [
  "date", "description", "debit", "credit", "amount", "balance", "reference", "ignore",
];

const ROLE_LABELS: Record<ColumnRole, string> = {
  date:        "Date",
  description: "Description",
  debit:       "Debit",
  credit:      "Credit",
  amount:      "Amount",
  balance:     "Balance",
  reference:   "Reference",
  ignore:      "Ignore",
};

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SGD", "JPY", "AUD", "CAD"];

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px",
  border: "1px solid #334155", background: "#0F172A", color: "#F8FAFC",
  fontSize: "0.875rem", outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.75rem", color: "#94A3B8",
  marginBottom: "0.25rem", fontWeight: 500,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: "pointer", appearance: "none",
};

// ── Validation ────────────────────────────────────────────────────────────────

function validateMappings(mappings: ColumnMapping[]): string | null {
  const roles = mappings.map(m => m.role);
  if (!roles.includes("date"))        return "Must map a Date column";
  if (!roles.includes("description")) return "Must map a Description column";
  const hasDebitCredit = roles.includes("debit") && roles.includes("credit");
  const hasAmount      = roles.includes("amount");
  if (!hasDebitCredit && !hasAmount)  return "Must map either (Debit + Credit) or an Amount column";
  return null;
}

// ── Summary helpers ───────────────────────────────────────────────────────────

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StatementUploadModal({ open, onClose, onImport }: Props) {
  const [step,         setStep        ] = useState<1 | 2 | 3>(1);
  const [parseResult,  setParseResult ] = useState<ParseResult | null>(null);
  const [mappings,     setMappings    ] = useState<ColumnMapping[]>([]);
  const [currency,     setCurrency    ] = useState("USD");
  const [periodLabel,  setPeriodLabel ] = useState("");
  const [importing,    setImporting   ] = useState(false);
  const [error,        setError       ] = useState<string | null>(null);
  const [filename,     setFilename    ] = useState("");
  const [dragOver,     setDragOver    ] = useState(false);
  const [parsing,      setParsing     ] = useState(false);
  // Final transactions computed on Step 2 → 3 transition with user's final mappings
  const [finalTxns,    setFinalTxns   ] = useState<ParsedTransaction[]>([]);
  const [finalErrors,  setFinalErrors ] = useState<string[]>([]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1); setParseResult(null); setMappings([]);
      setCurrency("USD"); setPeriodLabel(""); setImporting(false);
      setError(null); setFilename(""); setParsing(false);
      setFinalTxns([]); setFinalErrors([]);
    }
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Live preview: re-apply current mappings to first 3 rawRows whenever mappings change
  const livePreview = useMemo(() => {
    if (!parseResult || parseResult.rawRows.length === 0) return [];
    const preview3 = parseResult.rawRows.slice(0, 3);
    return applyMappings(preview3, mappings).transactions;
  }, [parseResult, mappings]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFilename(file.name);
    setParsing(true);
    try {
      const result = await parseFile(file);
      // Fatal errors (empty file, row limit exceeded)
      if (result.errors.length > 0 && result.transactions.length === 0) {
        setError(result.errors[0]);
        setParsing(false);
        return;
      }
      setParseResult(result);
      setMappings(result.mappings);
      setStep(2);
    } catch {
      setError("Failed to parse file. Please check the format and try again.");
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ""; // allow re-selecting same file
  }, [handleFile]);

  const setRole = (index: number, role: ColumnRole) =>
    setMappings(prev => prev.map(m => m.index === index ? { ...m, role } : m));

  const reapply = () => {
    if (parseResult) setMappings(parseResult.mappings);
  };

  const goToStep3 = () => {
    if (!parseResult) return;
    const validationError = validateMappings(mappings);
    if (validationError) { setError(validationError); return; }
    setError(null);
    // Re-apply final user mappings to ALL data rows for accurate summary + import
    const { transactions, errors } = applyMappings(parseResult.allDataRows, mappings);
    setFinalTxns(transactions);
    setFinalErrors(errors);
    setStep(3);
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      await onImport(
        { filename, currency, periodLabel: periodLabel || "Unlabelled", rowCount: finalTxns.length },
        finalTxns
      );
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  // Derived values for Step 3 summary
  const totalCredits = finalTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalDebits  = Math.abs(finalTxns.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const netAmount    = totalCredits - totalDebits;
  const dates        = finalTxns.map(t => t.valueDate).sort();
  const dateRange    = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : "—";

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
          }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            style={{
              background: "#1E293B", borderRadius: "12px",
              border: "1px solid #334155",
              width: "100%", maxWidth: step === 2 ? "720px" : "560px",
              maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
            }}
          >
            {/* ── Header ── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1.25rem 1.5rem", borderBottom: "1px solid #334155",
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "#F8FAFC" }}>
                  {step === 1 ? "Upload Bank Statement" : step === 2 ? "Map Columns" : "Preview & Confirm"}
                </h2>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#64748B" }}>
                  Step {step} of 3
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#64748B", padding: "0.25rem", borderRadius: "4px",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Body ── */}
            <div style={{ padding: "1.5rem" }}>

              {/* ── Step 1: Upload ── */}
              {step === 1 && (
                <div>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    style={{
                      border: `2px dashed ${dragOver ? "#3B82F6" : "#334155"}`,
                      borderRadius: "10px",
                      padding: "3rem 2rem",
                      textAlign: "center",
                      background: dragOver ? "rgba(59,130,246,0.06)" : "#0F172A",
                      cursor: "pointer",
                      transition: "border-color 150ms, background 150ms",
                    }}
                    onClick={() => document.getElementById("stmt-file-input")?.click()}
                  >
                    {parsing ? (
                      <p style={{ color: "#94A3B8", margin: 0 }}>Parsing file…</p>
                    ) : (
                      <>
                        <Upload size={32} style={{ color: "#475569", marginBottom: "0.75rem" }} />
                        <p style={{ color: "#F8FAFC", margin: "0 0 0.25rem", fontWeight: 500 }}>
                          Drop your bank statement here
                        </p>
                        <p style={{ color: "#64748B", margin: 0, fontSize: "0.8rem" }}>
                          CSV or XLSX · max 10,000 rows
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    id="stmt-file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={onInputChange}
                  />
                  {error && (
                    <div style={{
                      marginTop: "1rem", padding: "0.75rem", borderRadius: "6px",
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                      color: "#F87171", fontSize: "0.875rem",
                    }}>
                      {error}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 2: Map Columns ── */}
              {step === 2 && parseResult && (
                <div>
                  {/* Column mapping table */}
                  <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #334155" }}>
                          {["Column Header", "Detected Role", "Sample Value"].map(h => (
                            <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#64748B", fontWeight: 500 }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map(m => {
                          const sampleRow = parseResult.rawRows.find(r => (r[m.index] ?? "").trim() !== "");
                          const sample    = sampleRow ? sampleRow[m.index] : "";
                          return (
                            <tr key={m.index} style={{ borderBottom: "1px solid #1E293B" }}>
                              <td style={{ padding: "0.5rem 0.75rem", color: "#F8FAFC" }}>{m.header}</td>
                              <td style={{ padding: "0.5rem 0.75rem" }}>
                                <select
                                  value={m.role}
                                  onChange={e => setRole(m.index, e.target.value as ColumnRole)}
                                  style={{ ...selectStyle, width: "auto", minWidth: "130px" }}
                                >
                                  {ROLE_OPTIONS.map(r => (
                                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ padding: "0.5rem 0.75rem", color: "#94A3B8", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {sample || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Re-apply button */}
                  <button
                    onClick={reapply}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.375rem",
                      background: "none", border: "1px solid #334155",
                      color: "#94A3B8", borderRadius: "6px", padding: "0.375rem 0.75rem",
                      fontSize: "0.8rem", cursor: "pointer", marginBottom: "1.25rem",
                    }}
                  >
                    <RotateCcw size={12} /> Re-apply auto-detection
                  </button>

                  {/* Live preview (first 3 transactions) */}
                  {livePreview.length > 0 && (
                    <div style={{ marginBottom: "1.25rem" }}>
                      <p style={{ ...labelStyle, marginBottom: "0.5rem" }}>Live Preview (first 3 rows)</p>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #334155" }}>
                            {["Date", "Description", "Amount"].map(h => (
                              <th key={h} style={{ padding: "0.375rem 0.75rem", textAlign: "left", color: "#64748B", fontWeight: 500 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {livePreview.map((t, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #1E293B" }}>
                              <td style={{ padding: "0.375rem 0.75rem", color: "#94A3B8" }}>{t.valueDate}</td>
                              <td style={{ padding: "0.375rem 0.75rem", color: "#F8FAFC", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                              <td style={{ padding: "0.375rem 0.75rem", color: t.amount >= 0 ? "#4ADE80" : "#F87171", fontWeight: 500 }}>
                                {t.amount >= 0 ? "+" : ""}{t.amount.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Period + currency */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <label style={labelStyle}>Period Label</label>
                      <input
                        type="text"
                        value={periodLabel}
                        onChange={e => setPeriodLabel(e.target.value)}
                        placeholder="e.g. May 2026"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Currency</label>
                      <select
                        value={currency}
                        onChange={e => setCurrency(e.target.value)}
                        style={selectStyle}
                      >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {error && (
                    <div style={{
                      marginTop: "1rem", padding: "0.75rem", borderRadius: "6px",
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                      color: "#F87171", fontSize: "0.875rem",
                    }}>
                      {error}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 3: Preview & Confirm ── */}
              {step === 3 && (
                <div>
                  {/* Summary card */}
                  <div style={{
                    background: "#0F172A", border: "1px solid #334155",
                    borderRadius: "8px", padding: "1rem", marginBottom: "1.25rem",
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                      {[
                        ["Transactions", finalTxns.length.toLocaleString()],
                        ["Date Range",   dateRange],
                        ["Total Credits",  fmt(totalCredits, currency)],
                        ["Total Debits",   fmt(totalDebits,  currency)],
                        ["Net",            fmt(netAmount,    currency)],
                        ["Period",         periodLabel || "Unlabelled"],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <p style={{ margin: 0, fontSize: "0.7rem", color: "#64748B", fontWeight: 500 }}>{k}</p>
                          <p style={{ margin: "0.125rem 0 0", fontSize: "0.875rem", color: "#F8FAFC", fontWeight: 500 }}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Parse errors (amber warnings) */}
                  {finalErrors.length > 0 && (
                    <div style={{
                      marginBottom: "1.25rem", padding: "0.75rem", borderRadius: "6px",
                      background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
                        <AlertTriangle size={14} style={{ color: "#FBBF24", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.8rem", color: "#FBBF24", fontWeight: 500 }}>
                          {finalErrors.length} row{finalErrors.length !== 1 ? "s" : ""} skipped
                        </span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                        {finalErrors.slice(0, 5).map((e, i) => (
                          <li key={i} style={{ fontSize: "0.775rem", color: "#94A3B8" }}>{e}</li>
                        ))}
                        {finalErrors.length > 5 && (
                          <li style={{ fontSize: "0.775rem", color: "#64748B" }}>…and {finalErrors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* First 10 transactions */}
                  <div style={{ marginBottom: "1.25rem", overflowX: "auto" }}>
                    <p style={{ ...labelStyle, marginBottom: "0.5rem" }}>
                      First {Math.min(10, finalTxns.length)} transactions
                    </p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #334155" }}>
                          {["Date", "Description", "Amount"].map(h => (
                            <th key={h} style={{ padding: "0.375rem 0.75rem", textAlign: "left", color: "#64748B", fontWeight: 500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {finalTxns.slice(0, 10).map((t, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #1E293B" }}>
                            <td style={{ padding: "0.375rem 0.75rem", color: "#94A3B8" }}>{t.valueDate}</td>
                            <td style={{ padding: "0.375rem 0.75rem", color: "#F8FAFC", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                            <td style={{ padding: "0.375rem 0.75rem", color: t.amount >= 0 ? "#4ADE80" : "#F87171", fontWeight: 500 }}>
                              {t.amount >= 0 ? "+" : ""}{fmt(t.amount, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {error && (
                    <div style={{
                      marginBottom: "1rem", padding: "0.75rem", borderRadius: "6px",
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                      color: "#F87171", fontSize: "0.875rem",
                    }}>
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1rem 1.5rem", borderTop: "1px solid #334155",
            }}>
              {/* Back */}
              <div>
                {step > 1 && (
                  <button
                    onClick={() => { setError(null); setStep(step === 3 ? 2 : 1); }}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.375rem",
                      background: "none", border: "1px solid #334155",
                      color: "#94A3B8", borderRadius: "6px", padding: "0.5rem 1rem",
                      fontSize: "0.875rem", cursor: "pointer",
                    }}
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                )}
              </div>

              {/* Next / Import */}
              <div>
                {step === 1 && (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#475569" }}>
                    Select or drop a file to continue
                  </p>
                )}
                {step === 2 && (
                  <button
                    onClick={goToStep3}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.375rem",
                      background: "#3B82F6", border: "none",
                      color: "#FFFFFF", borderRadius: "6px", padding: "0.5rem 1.25rem",
                      fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Preview <ChevronRight size={14} />
                  </button>
                )}
                {step === 3 && (
                  <button
                    onClick={handleImport}
                    disabled={importing || finalTxns.length === 0}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.375rem",
                      background: importing ? "#1E3A5F" : "#3B82F6",
                      border: "none", color: "#FFFFFF", borderRadius: "6px",
                      padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 500,
                      cursor: importing ? "not-allowed" : "pointer",
                      opacity: finalTxns.length === 0 ? 0.5 : 1,
                    }}
                  >
                    {importing ? "Importing…" : (
                      <><Check size={14} /> Import {finalTxns.length.toLocaleString()} transactions</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/reconciliation/StatementUploadModal.tsx
git commit -m "feat: add StatementUploadModal 3-step upload flow"
```

---

## Task 5: Reconciliation Page

**Files:**
- Create: `src/app/pages/Reconciliation.tsx`

- [ ] **Step 1: Implement the page**

Create `src/app/pages/Reconciliation.tsx`:

```tsx
// src/app/pages/Reconciliation.tsx
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, ChevronDown, ChevronUp, Search } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatementUploadModal } from "../components/reconciliation/StatementUploadModal";
import { useBankStatements } from "../hooks/useBankStatements";
import type { BankStatement, BankTransaction } from "../hooks/useBankStatements";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency, minimumFractionDigits: 2,
  }).format(Math.abs(amount));
}

// ── Statement Card ────────────────────────────────────────────────────────────

function StatementCard({
  statement,
  isSelected,
  onClick,
}: {
  statement:  BankStatement;
  isSelected: boolean;
  onClick:    () => void;
}) {
  return (
    <motion.div
      layout
      onClick={onClick}
      style={{
        background:    isSelected ? "#1E3A5F" : "#1E293B",
        border:        `1px solid ${isSelected ? "#3B82F6" : "#334155"}`,
        borderRadius:  "10px",
        padding:       "1rem 1.25rem",
        cursor:        "pointer",
        display:       "flex",
        alignItems:    "center",
        justifyContent:"space-between",
        gap:           "1rem",
        transition:    "border-color 150ms, background 150ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "8px",
          background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <FileSpreadsheet size={18} style={{ color: "#3B82F6" }} />
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 500, color: "#F8FAFC", fontSize: "0.875rem" }}>
            {statement.filename}
          </p>
          <p style={{ margin: "0.125rem 0 0", fontSize: "0.775rem", color: "#64748B" }}>
            {statement.periodLabel} · {statement.currency} · {statement.rowCount.toLocaleString()} txns · Uploaded {fmtDate(statement.uploadedAt)}
          </p>
        </div>
      </div>
      {isSelected ? <ChevronUp size={16} style={{ color: "#64748B", flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: "#475569", flexShrink: 0 }} />}
    </motion.div>
  );
}

// ── Transaction Browser ────────────────────────────────────────────────────────

function TransactionBrowser({
  transactions,
  loading,
  currency,
}: {
  transactions: BankTransaction[];
  loading:      boolean;
  currency:     string;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? transactions.filter(t =>
          t.description.toLowerCase().includes(q) ||
          t.valueDate.includes(q) ||
          (t.reference ?? "").toLowerCase().includes(q)
        )
      : transactions;
  }, [transactions, search]);

  const net = transactions.reduce((s, t) => s + t.amount, 0);

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#64748B", fontSize: "0.875rem" }}>
        Loading transactions…
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      style={{
        background: "#1E293B", border: "1px solid #334155",
        borderRadius: "10px", overflow: "hidden", marginTop: "0.75rem",
      }}
    >
      {/* Toolbar */}
      <div style={{
        padding: "0.75rem 1rem", borderBottom: "1px solid #334155",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
      }}>
        <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
          <Search size={14} style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "0.4rem 0.75rem 0.4rem 2rem",
              background: "#0F172A", border: "1px solid #334155",
              borderRadius: "6px", color: "#F8FAFC", fontSize: "0.8rem",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ fontSize: "0.8rem", color: "#64748B", whiteSpace: "nowrap" }}>
          Net: <span style={{ color: net >= 0 ? "#4ADE80" : "#F87171", fontWeight: 500 }}>
            {net >= 0 ? "+" : ""}{fmtCurrency(net, currency)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", maxHeight: "420px", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead style={{ position: "sticky", top: 0, background: "#0F172A", zIndex: 1 }}>
            <tr>
              {["Date", "Description", "Amount", "Reference"].map(h => (
                <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", color: "#64748B", fontWeight: 500, borderBottom: "1px solid #334155" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "#475569" }}>
                  {search ? "No matching transactions" : "No transactions"}
                </td>
              </tr>
            ) : (
              filtered.map(t => (
                <tr key={t.id} style={{ borderBottom: "1px solid #1E293B" }}>
                  <td style={{ padding: "0.5rem 1rem", color: "#94A3B8", whiteSpace: "nowrap" }}>{t.valueDate}</td>
                  <td style={{ padding: "0.5rem 1rem", color: "#F8FAFC", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                  <td style={{ padding: "0.5rem 1rem", color: t.amount >= 0 ? "#4ADE80" : "#F87171", fontWeight: 500, whiteSpace: "nowrap" }}>
                    {t.amount >= 0 ? "+" : ""}{fmtCurrency(t.amount, t.currency)}
                  </td>
                  <td style={{ padding: "0.5rem 1rem", color: "#64748B" }}>{t.reference ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Reconciliation() {
  const { statements, loading, importStatement } = useBankStatements();
  const [uploadOpen,          setUploadOpen         ] = useState(false);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [transactions,        setTransactions       ] = useState<BankTransaction[]>([]);
  const [loadingTx,           setLoadingTx          ] = useState(false);

  const { fetchTransactions } = useBankStatements();

  const handleSelectStatement = async (id: string) => {
    if (selectedStatementId === id) {
      setSelectedStatementId(null);
      setTransactions([]);
      return;
    }
    setSelectedStatementId(id);
    setLoadingTx(true);
    const txns = await fetchTransactions(id);
    setTransactions(txns);
    setLoadingTx(false);
  };

  const selectedStatement = statements.find(s => s.id === selectedStatementId) ?? null;

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!loading && statements.length === 0) {
    return (
      <div style={{ padding: "2rem", height: "100%", display: "flex", flexDirection: "column" }}>
        <PageHeader
          title="Reconciliation"
          subtitle="Upload and browse bank statements"
        />
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
            <p style={{ margin: 0, fontWeight: 500, color: "#F8FAFC", fontSize: "1rem" }}>
              No bank statements yet
            </p>
            <p style={{ margin: "0.375rem 0 0", fontSize: "0.875rem", color: "#64748B" }}>
              Upload a CSV or XLSX file to get started
            </p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              background: "#3B82F6", border: "none",
              color: "#FFFFFF", borderRadius: "8px", padding: "0.625rem 1.25rem",
              fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
            }}
          >
            <Upload size={16} /> Upload your first bank statement
          </button>
        </div>
        <StatementUploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onImport={importStatement}
        />
      </div>
    );
  }

  // ── Has statements ─────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "2rem" }}>
      <PageHeader
        title="Reconciliation"
        subtitle="Browse uploaded bank statements and transactions"
      >
        <button
          onClick={() => setUploadOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: "#3B82F6", border: "none",
            color: "#FFFFFF", borderRadius: "8px", padding: "0.5rem 1rem",
            fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
          }}
        >
          <Upload size={15} /> Upload Statement
        </button>
      </PageHeader>

      {loading ? (
        <div style={{ color: "#64748B", fontSize: "0.875rem", padding: "2rem 0" }}>
          Loading statements…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {statements.map(stmt => (
            <div key={stmt.id}>
              <StatementCard
                statement={stmt}
                isSelected={selectedStatementId === stmt.id}
                onClick={() => handleSelectStatement(stmt.id)}
              />
              <AnimatePresence>
                {selectedStatementId === stmt.id && selectedStatement && (
                  <TransactionBrowser
                    transactions={transactions}
                    loading={loadingTx}
                    currency={selectedStatement.currency}
                  />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      <StatementUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImport={importStatement}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/pages/Reconciliation.tsx
git commit -m "feat: add Reconciliation page with statement list and transaction browser"
```

---

## Task 6: Wire Routes + Sidebar

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/app/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add route to `routes.tsx`**

In `src/app/routes.tsx`, add the import after the Transactions import:

```typescript
import Reconciliation from "./pages/Reconciliation";
```

Then add the route inside the Layout children block, after the Transactions routes (after line `{ path: "transactions/setup", Component: Transactions },`):

```typescript
// Reconciliation
{ path: "reconciliation", Component: Reconciliation },
```

- [ ] **Step 2: Add Reconciliation nav group to `Sidebar.tsx`**

In `src/app/components/layout/Sidebar.tsx`, the `navGroups` array currently has: Core → Analysis → Intelligence → Reporting.

Add a new Reconciliation group between Analysis and Intelligence. The current array is defined around line 79. After the closing `}` of the Analysis group (after the `Risk & ECL` item), insert:

```typescript
  {
    label: "Reconciliation",
    items: [
      {
        title: "Bank Statements",
        url: "/reconciliation",
        icon: FileText,
        items: [
          { title: "Statements",   url: "/reconciliation", icon: FileSpreadsheet },
          { title: "Transactions", url: "/reconciliation", icon: ArrowLeftRight  },
        ],
      },
    ],
  },
```

Note: `FileText`, `FileSpreadsheet`, and `ArrowLeftRight` are all already imported in Sidebar.tsx. No import changes needed.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights
npx vitest run
```

Expected: all tests pass (including the 5 new bank statement parser tests).

- [ ] **Step 4: Start dev server and smoke-test**

```bash
npm run dev
```

Verify:
- "Reconciliation" group appears in sidebar between Analysis and Intelligence
- Navigating to `/reconciliation` shows the empty state with "Upload your first bank statement" button
- Clicking "Upload Statement" opens the 3-step modal
- Dropping a CSV or XLSX file advances to Step 2 with auto-detected column mappings
- Adjusting dropdowns updates the live preview
- Clicking "Preview" advances to Step 3 summary
- Clicking "Import" closes the modal and the statement appears in the list
- Clicking a statement card shows the transaction browser
- Search box filters transactions

- [ ] **Step 5: Commit**

```bash
git add src/app/routes.tsx src/app/components/layout/Sidebar.tsx
git commit -m "feat: wire /reconciliation route and sidebar nav for bank statements"
```

---

## Post-Implementation: Apply Migration

After all code tasks are done, apply the Supabase migration if not already done in Task 2:

Use `mcp__plugin_supabase_supabase__apply_migration`:
- `project_id`: `naqgfwnbhybhtirazkjq`
- `name`: `009_bank_statements`
- `query`: (SQL from Task 2)

Confirm with `mcp__plugin_supabase_supabase__list_tables` that `bank_statements` and `bank_transactions` are present.
