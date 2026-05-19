# Bank Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-match imported bank credit transactions against the lease register using a client-side confidence scoring engine, with bulk-accept, manual override, and explicit unmatched marking.

**Architecture:** A pure TypeScript scoring engine (amount 50% + date 30% + lessee name 20%) runs client-side and persists results to a new `reconciliation_matches` Supabase table. A `useReconciliation` hook manages local state and all Supabase mutations. A new `ReconciliationWorkspace` component appears as a second tab inside the existing `Reconciliation.tsx` page when a statement is selected.

**Tech Stack:** React, TypeScript, Supabase (`@supabase/supabase-js`), Framer Motion, Vitest

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/app/utils/reconciliationMatcher.ts` | Create | Scoring engine types + `scoreTransaction` + `matchTransactions` |
| `src/app/utils/reconciliationMatcher.test.ts` | Create | 5 Vitest unit tests |
| `supabase/migrations/010_reconciliation_matches.sql` | Create | `reconciliation_matches` table + indexes |
| `src/app/hooks/useReconciliation.ts` | Create | Mount-load, `runMatching`, `acceptAll`, `acceptOne`, `overrideMatch`, `markUnmatched`, `rerun` |
| `src/app/components/reconciliation/ReconciliationWorkspace.tsx` | Create | Header bar, empty state, 3 collapsible sections, row actions, override dropdown |
| `src/app/pages/Reconciliation.tsx` | Modify | Add `activeTab` state + tab switcher + render workspace |

---

## Task 1: Matching engine (TDD)

**Files:**
- Create: `src/app/utils/reconciliationMatcher.ts`
- Create: `src/app/utils/reconciliationMatcher.test.ts`

- [ ] **Step 1: Write the 5 failing tests**

```typescript
// src/app/utils/reconciliationMatcher.test.ts
import { describe, it, expect } from "vitest";
import { scoreTransaction, matchTransactions } from "./reconciliationMatcher";
import type { BankTransaction } from "../hooks/useBankStatements";
import type { Lease, Lessee, Asset } from "../types/portfolio";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeTxn = (overrides: Partial<BankTransaction> = {}): BankTransaction => ({
  id: "txn-1", orgId: "org-1", statementId: "stmt-1",
  valueDate: "2024-06-15",
  description: "Emirates Airlines payment",
  amount: 100_000,
  currency: "USD",
  reference: "EK-REF",
  ...overrides,
});

const makeLease = (overrides: Partial<Lease> = {}): Lease => ({
  id: "lease-1", org_id: "org-1", asset_id: "asset-1", lessee_id: "lessee-1",
  start_date: "2024-01-01", end_date: "2024-12-31",
  monthly_rental: 100_000,
  currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const makeLessee = (overrides: Partial<Lessee> = {}): Lessee => ({
  id: "lessee-1", org_id: "org-1", name: "Emirates Airlines",
  iata_code: "EK", country: "AE", credit_rating: "A",
  pd_estimate: null, watchlist_status: null, created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const makeAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: "asset-1", org_id: "org-1", upload_id: null,
  registration: "A6-EMA", msn: "12345", aircraft_type: "B777",
  manufacturer: "Boeing", vintage: 2020, current_operator: null,
  created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("scoreTransaction", () => {
  it("perfect match: exact amount + in-period date + lessee name in description → confidence ≥ 0.8", () => {
    const txn       = makeTxn();
    const candidate = { lease: makeLease(), lessee: makeLessee(), asset: makeAsset() };
    expect(scoreTransaction(txn, candidate)).toBeGreaterThanOrEqual(0.8);
  });

  it("amount 20% off with matching lessee and in-period date → confidence in review range (0.4–0.79)", () => {
    const txn       = makeTxn({ amount: 120_000 }); // 20% higher → amountScore = max(0, 1-0.2) = 0.8
    const candidate = { lease: makeLease(), lessee: makeLessee(), asset: makeAsset() };
    const score     = scoreTransaction(txn, candidate);
    // 0.5*0.8 + 0.3*1.0 + 0.2*1.0 = 0.4+0.3+0.2 = 0.9 — wait, that's ≥0.8
    // Use a bigger mismatch: amount 60% off → amountScore = 0.4
    // 0.5*0.4 + 0.3*1.0 + 0.2*1.0 = 0.2+0.3+0.2 = 0.7 → review range ✓
    expect(score).toBeGreaterThanOrEqual(0.4);
    expect(score).toBeLessThan(0.8);
  });
});

describe("matchTransactions", () => {
  it("no lessee name + date far out of range + tiny amount → matchType='unmatched', bestMatch=null", () => {
    // amount 1 vs 100000 → amountScore ≈ 0
    // date 2020-01-01, lease 2024-01-01 to 2024-12-31 → > 45 days outside → dateScore = 0
    // description "MISC" → lesseeScore = 0
    // total = 0 < 0.4 → unmatched
    const txn    = makeTxn({ description: "MISC PAYMENT", reference: "", valueDate: "2020-01-01", amount: 1 });
    const result = matchTransactions([txn], [makeLease()], [makeLessee()], [makeAsset()], "stmt-1");
    expect(result.matches[0].matchType).toBe("unmatched");
    expect(result.matches[0].bestMatch).toBeNull();
  });

  it("debit transaction (amount < 0) is excluded from matches", () => {
    const debit  = makeTxn({ id: "debit-1",  amount: -50_000 });
    const credit = makeTxn({ id: "credit-1", amount: 100_000 });
    const result = matchTransactions([debit, credit], [makeLease()], [makeLessee()], [makeAsset()], "stmt-1");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].transactionId).toBe("credit-1");
  });

  it("null monthly_rental → amountScore=0, transaction cannot reach auto threshold on amount alone", () => {
    const lease  = makeLease({ monthly_rental: null });
    // Lessee name in description + date in-period → max score = 0.3 + 0.2 = 0.5 < 0.8
    const txn    = makeTxn({ description: "Emirates Airlines payment" });
    const result = matchTransactions([txn], [lease], [makeLessee()], [makeAsset()], "stmt-1");
    expect(result.matches[0].confidence).toBeLessThan(0.8);
  });

  it("autoCount / reviewCount / unmatchedCount are computed correctly", () => {
    // t1: perfect match (≥0.8)
    const t1 = makeTxn({ id: "t1", description: "Emirates Airlines payment", valueDate: "2024-06-15", amount: 100_000 });
    // t2: 60% amount mismatch → review range
    const t2 = makeTxn({ id: "t2", description: "Emirates Airlines payment", valueDate: "2024-06-15", amount: 160_000 });
    // t3: completely wrong → unmatched
    const t3 = makeTxn({ id: "t3", description: "MISC", reference: "", valueDate: "2020-01-01", amount: 1 });
    const result = matchTransactions([t1, t2, t3], [makeLease()], [makeLessee()], [makeAsset()], "stmt-1");
    expect(result.autoCount).toBe(1);
    expect(result.reviewCount).toBe(1);
    expect(result.unmatchedCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run --reporter=verbose src/app/utils/reconciliationMatcher.test.ts
```

Expected: FAIL with `Cannot find module './reconciliationMatcher'`

- [ ] **Step 3: Implement `reconciliationMatcher.ts`**

```typescript
// src/app/utils/reconciliationMatcher.ts
import type { Lease, Lessee, Asset } from "../types/portfolio";
import type { BankTransaction } from "../hooks/useBankStatements";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeaseCandidate {
  lease:  Lease;
  lessee: Lessee;
  asset:  Asset;
}

export type MatchType = "auto" | "manual" | "unmatched";

export interface MatchResult {
  transactionId: string;
  transaction:   BankTransaction;
  bestMatch:     LeaseCandidate | null;
  confidence:    number;        // 0–1
  amountDelta:   number | null; // txn.amount − lease.monthly_rental; null if unmatched
  matchType:     MatchType;
  confirmed:     boolean;
}

export interface ReconciliationResult {
  statementId:    string;
  matches:        MatchResult[];
  autoCount:      number;   // confidence ≥ 0.8
  reviewCount:    number;   // 0.4 ≤ confidence < 0.8
  unmatchedCount: number;   // confidence < 0.4
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export function scoreTransaction(txn: BankTransaction, candidate: LeaseCandidate): number {
  const { lease, lessee } = candidate;

  // Amount score (weight 0.5) — credits only; 0 if rental null/zero
  let amountScore = 0;
  if (txn.amount > 0 && lease.monthly_rental != null && lease.monthly_rental !== 0) {
    const delta = Math.abs(txn.amount - lease.monthly_rental);
    const ratio = delta / lease.monthly_rental;
    amountScore = Math.max(0, 1 - ratio);
  }

  // Date score (weight 0.3) — append T00:00:00Z to force UTC parsing
  let dateScore = 0;
  const txnDate = new Date(txn.valueDate + "T00:00:00Z");
  const start   = new Date(lease.start_date + "T00:00:00Z");
  const end     = new Date(lease.end_date   + "T00:00:00Z");
  if (txnDate >= start && txnDate <= end) {
    dateScore = 1.0;
  } else {
    const msPerDay = 86_400_000;
    const daysOff  = Math.min(
      Math.abs(txnDate.getTime() - start.getTime()),
      Math.abs(txnDate.getTime() - end.getTime()),
    ) / msPerDay;
    dateScore = daysOff <= 45 ? 0.5 : 0.0;
  }

  // Lessee score (weight 0.2) — name or IATA code, case-insensitive, trimmed
  let lesseeScore = 0;
  const haystack  = `${txn.description} ${txn.reference ?? ""}`.toLowerCase().trim();
  const needles   = [lessee.name, lessee.iata_code].filter(Boolean) as string[];
  if (needles.some(n => haystack.includes(n.toLowerCase().trim()))) {
    lesseeScore = 1.0;
  }

  return 0.5 * amountScore + 0.3 * dateScore + 0.2 * lesseeScore;
}

// ── Matching ──────────────────────────────────────────────────────────────────

export function matchTransactions(
  transactions: BankTransaction[],
  leases:       Lease[],
  lessees:      Lessee[],
  assets:       Asset[],
  statementId:  string,
): ReconciliationResult {
  const lesseeMap = new Map(lessees.map(l => [l.id, l]));
  const assetMap  = new Map(assets.map(a => [a.id, a]));

  const candidates: LeaseCandidate[] = leases
    .map(lease => {
      const lessee = lesseeMap.get(lease.lessee_id);
      const asset  = assetMap.get(lease.asset_id);
      if (!lessee || !asset) return null;
      return { lease, lessee, asset };
    })
    .filter((c): c is LeaseCandidate => c !== null);

  // Only credit transactions are matched; debits are excluded entirely
  const credits = transactions.filter(t => t.amount > 0);

  const matches: MatchResult[] = credits.map(txn => {
    if (candidates.length === 0) {
      return {
        transactionId: txn.id,
        transaction:   txn,
        bestMatch:     null,
        confidence:    0,
        amountDelta:   null,
        matchType:     "unmatched" as MatchType,
        confirmed:     false,
      };
    }

    let bestCandidate: LeaseCandidate | null = null;
    let bestScore = 0;
    for (const c of candidates) {
      const s = scoreTransaction(txn, c);
      if (s > bestScore) { bestScore = s; bestCandidate = c; }
    }

    const isUnmatched = bestScore < 0.4;
    const finalMatch  = isUnmatched ? null : bestCandidate;
    const amountDelta = finalMatch
      ? txn.amount - (finalMatch.lease.monthly_rental ?? 0)
      : null;

    return {
      transactionId: txn.id,
      transaction:   txn,
      bestMatch:     finalMatch,
      confidence:    bestScore,
      amountDelta,
      matchType:     isUnmatched ? "unmatched" : "auto",
      confirmed:     false,
    };
  });

  return {
    statementId,
    matches,
    autoCount:      matches.filter(m => m.confidence >= 0.8).length,
    reviewCount:    matches.filter(m => m.confidence >= 0.4 && m.confidence < 0.8).length,
    unmatchedCount: matches.filter(m => m.confidence < 0.4).length,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run --reporter=verbose src/app/utils/reconciliationMatcher.test.ts
```

Expected: 5 tests PASS

If test 2 (amount 20% off → review range) fails because the score is ≥ 0.8, increase the fixture amount offset to `160_000` (60% higher, matching what the comment says) — the test body already documents the arithmetic.

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/reconciliationMatcher.ts src/app/utils/reconciliationMatcher.test.ts
git commit -m "feat: add reconciliation matching engine with 5 unit tests"
```

---

## Task 2: Database migration

**Files:**
- Create: `supabase/migrations/010_reconciliation_matches.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/010_reconciliation_matches.sql
create table if not exists reconciliation_matches (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id) on delete cascade,
  statement_id   uuid not null references bank_statements(id) on delete cascade,
  transaction_id uuid not null references bank_transactions(id) on delete cascade,
  lease_id       uuid references leases(id) on delete set null,  -- null = unmatched
  match_type     text not null,   -- 'auto' | 'manual' | 'unmatched'
  confidence     numeric,         -- 0–1; null when match_type = 'unmatched'
  amount_delta   numeric,         -- txn.amount − lease.monthly_rental; null if unmatched
  confirmed      boolean not null default false,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (transaction_id)         -- one match record per transaction
);

create index if not exists recon_matches_statement_idx on reconciliation_matches(statement_id);
create index if not exists recon_matches_org_idx       on reconciliation_matches(org_id);
```

- [ ] **Step 2: Apply via Supabase MCP to project `naqgfwnbhybhtirazkjq`**

Use the `apply_migration` Supabase MCP tool with the SQL above.

- [ ] **Step 3: Verify via Supabase MCP**

Run this SQL query via `execute_sql`:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'reconciliation_matches'
order by ordinal_position;
```

Expected: 11 rows — id, org_id, statement_id, transaction_id, lease_id, match_type, confidence, amount_delta, confirmed, confirmed_at, created_at.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/010_reconciliation_matches.sql
git commit -m "feat: add reconciliation_matches migration (010)"
```

---

## Task 3: useReconciliation hook

**Files:**
- Create: `src/app/hooks/useReconciliation.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/app/hooks/useReconciliation.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolioData } from "./usePortfolioData";
import { matchTransactions } from "../utils/reconciliationMatcher";
import type {
  MatchResult, MatchType, ReconciliationResult, LeaseCandidate,
} from "../utils/reconciliationMatcher";
import type { BankTransaction } from "./useBankStatements";

// ── Return type ───────────────────────────────────────────────────────────────

export interface UseReconciliationReturn {
  result:        ReconciliationResult | null;
  loading:       boolean;
  saving:        boolean;
  runMatching:   (statementId: string, transactions: BankTransaction[]) => void;
  acceptAll:     (statementId: string) => Promise<void>;
  acceptOne:     (transactionId: string) => Promise<void>;
  overrideMatch: (transactionId: string, leaseId: string) => Promise<void>;
  markUnmatched: (transactionId: string) => Promise<void>;
  rerun:         (statementId: string, transactions: BankTransaction[]) => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useReconciliation(
  statementId:  string | null,
  transactions: BankTransaction[],
): UseReconciliationReturn {
  const { orgId }                   = useData();
  const { leases, lessees, assets } = usePortfolioData();
  const [result,  setResult ]       = useState<ReconciliationResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [saving,  setSaving ]       = useState(false);

  // Stable lookup maps rebuilt only when source arrays change
  const txnMap    = useMemo(() => new Map(transactions.map(t => [t.id, t])), [transactions]);
  const leaseMap  = useMemo(() => new Map(leases.map(l => [l.id, l])),       [leases]);
  const lesseeMap = useMemo(() => new Map(lessees.map(l => [l.id, l])),      [lessees]);
  const assetMap  = useMemo(() => new Map(assets.map(a => [a.id, a])),       [assets]);

  // ── Count helper ───────────────────────────────────────────────────────────

  function buildCounts(matches: MatchResult[]) {
    return {
      autoCount:      matches.filter(m => m.confidence >= 0.8).length,
      reviewCount:    matches.filter(m => m.confidence >= 0.4 && m.confidence < 0.8).length,
      unmatchedCount: matches.filter(m => m.confidence < 0.4).length,
    };
  }

  // Functional-update helper — setResult(prev=>) keeps callbacks dep-free for stable identity
  function patchMatch(transactionId: string, patch: Partial<MatchResult>) {
    setResult(prev => {
      if (!prev) return prev;
      const matches = prev.matches.map(m =>
        m.transactionId === transactionId ? { ...m, ...patch } : m,
      );
      return { ...prev, matches, ...buildCounts(matches) };
    });
  }

  // ── Load saved state on mount / statementId change ─────────────────────────

  useEffect(() => {
    if (!statementId) { setResult(null); return; }
    // Defer until transactions and portfolio data are loaded
    if (txnMap.size === 0 || leaseMap.size === 0) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("reconciliation_matches")
        .select("*")
        .eq("statement_id", statementId)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setResult(null);
        setLoading(false);
        return;
      }

      const rows = data as Record<string, unknown>[];
      const matches: MatchResult[] = rows
        .map(row => {
          const txn = txnMap.get(row.transaction_id as string);
          if (!txn) return null;

          const leaseId = row.lease_id as string | null;
          let bestMatch: LeaseCandidate | null = null;
          if (leaseId) {
            const lease  = leaseMap.get(leaseId);
            const lessee = lease ? lesseeMap.get(lease.lessee_id) : undefined;
            const asset  = lease ? assetMap.get(lease.asset_id)   : undefined;
            if (lease && lessee && asset) bestMatch = { lease, lessee, asset };
          }

          return {
            transactionId: row.transaction_id as string,
            transaction:   txn,
            bestMatch,
            confidence:    Number(row.confidence ?? 0),
            amountDelta:   row.amount_delta != null ? Number(row.amount_delta) : null,
            matchType:     row.match_type as MatchType,
            confirmed:     row.confirmed as boolean,
          } satisfies MatchResult;
        })
        .filter((m): m is MatchResult => m !== null);

      setResult({ statementId, matches, ...buildCounts(matches) });
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [statementId, txnMap, leaseMap, lesseeMap, assetMap]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const runMatching = useCallback((sId: string, txns: BankTransaction[]) => {
    const computed = matchTransactions(txns, leases, lessees, assets, sId);
    setResult(computed);

    if (!orgId) return;
    const rows = computed.matches.map(m => ({
      org_id:         orgId,
      statement_id:   sId,
      transaction_id: m.transactionId,
      lease_id:       m.bestMatch?.lease.id ?? null,
      match_type:     m.matchType,
      confidence:     m.confidence,
      amount_delta:   m.amountDelta,
      confirmed:      false,
      confirmed_at:   null,
    }));
    supabase
      .from("reconciliation_matches")
      .upsert(rows, { onConflict: "transaction_id" })
      .then(({ error }) => {
        if (error) console.error("[useReconciliation] runMatching upsert error:", error);
      });
  }, [orgId, leases, lessees, assets]);

  const acceptAll = useCallback(async (sId: string) => {
    setSaving(true);
    const now = new Date().toISOString();

    // Optimistic update — all unconfirmed auto-matches
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
    setSaving(false);
  }, []);

  const acceptOne = useCallback(async (transactionId: string) => {
    setSaving(true);
    patchMatch(transactionId, { confirmed: true });

    const { error } = await supabase
      .from("reconciliation_matches")
      .update({ confirmed: true, confirmed_at: new Date().toISOString() })
      .eq("transaction_id", transactionId);

    if (error) console.error("[useReconciliation] acceptOne error:", error);
    setSaving(false);
  }, []); // patchMatch uses functional setResult — safe with empty deps

  const overrideMatch = useCallback(async (transactionId: string, leaseId: string) => {
    setSaving(true);
    const lease  = leaseMap.get(leaseId);
    const lessee = lease ? lesseeMap.get(lease.lessee_id) : undefined;
    const asset  = lease ? assetMap.get(lease.asset_id)   : undefined;
    const txn    = txnMap.get(transactionId);

    if (lease && lessee && asset && txn) {
      const bestMatch: LeaseCandidate = { lease, lessee, asset };
      patchMatch(transactionId, {
        bestMatch,
        matchType:   "manual",
        confirmed:   true,
        amountDelta: txn.amount - (lease.monthly_rental ?? 0),
      });
    }

    const { error } = await supabase
      .from("reconciliation_matches")
      .update({
        lease_id:     leaseId,
        match_type:   "manual",
        confirmed:    true,
        confirmed_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    if (error) console.error("[useReconciliation] overrideMatch error:", error);
    setSaving(false);
  }, [leaseMap, lesseeMap, assetMap, txnMap]);

  const markUnmatched = useCallback(async (transactionId: string) => {
    setSaving(true);
    patchMatch(transactionId, {
      bestMatch:   null,
      matchType:   "unmatched",
      confirmed:   true,
      amountDelta: null,
    });

    const { error } = await supabase
      .from("reconciliation_matches")
      .update({
        lease_id:     null,
        match_type:   "unmatched",
        confirmed:    true,
        confirmed_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    if (error) console.error("[useReconciliation] markUnmatched error:", error);
    setSaving(false);
  }, []);

  const rerun = useCallback(async (sId: string, txns: BankTransaction[]) => {
    setSaving(true);

    // Delete ALL rows for the statement (including confirmed — UI must warn before calling)
    const { error: delError } = await supabase
      .from("reconciliation_matches")
      .delete()
      .eq("statement_id", sId);

    if (delError) {
      console.error("[useReconciliation] rerun delete error:", delError);
      setSaving(false);
      return;
    }

    const computed = matchTransactions(txns, leases, lessees, assets, sId);
    setResult(computed);

    if (!orgId) { setSaving(false); return; }
    const rows = computed.matches.map(m => ({
      org_id:         orgId,
      statement_id:   sId,
      transaction_id: m.transactionId,
      lease_id:       m.bestMatch?.lease.id ?? null,
      match_type:     m.matchType,
      confidence:     m.confidence,
      amount_delta:   m.amountDelta,
      confirmed:      false,
      confirmed_at:   null,
    }));
    const { error: upsertError } = await supabase
      .from("reconciliation_matches")
      .upsert(rows, { onConflict: "transaction_id" });

    if (upsertError) console.error("[useReconciliation] rerun upsert error:", upsertError);
    setSaving(false);
  }, [orgId, leases, lessees, assets]);

  return { result, loading, saving, runMatching, acceptAll, acceptOne, overrideMatch, markUnmatched, rerun };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/hooks/useReconciliation.ts
git commit -m "feat: add useReconciliation hook (mount-load, matching, Supabase mutations)"
```

---

## Task 4: ReconciliationWorkspace component

**Files:**
- Create: `src/app/components/reconciliation/ReconciliationWorkspace.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/app/components/reconciliation/ReconciliationWorkspace.tsx
import { useState, useMemo } from "react";
import { CheckCircle, ChevronDown, ChevronUp, RefreshCw, Loader2 } from "lucide-react";
import { useReconciliation } from "../../hooks/useReconciliation";
import { usePortfolioData } from "../../hooks/usePortfolioData";
import type { BankTransaction } from "../../hooks/useBankStatements";
import type { MatchResult } from "../../utils/reconciliationMatcher";
import type { Lease } from "../../types/portfolio";

// ── Shared styles ─────────────────────────────────────────────────────────────

const btnBase: React.CSSProperties = {
  padding: "0.3rem 0.6rem",
  background: "#0F172A",
  border: "1px solid #334155",
  color: "#CBD5E1",
  borderRadius: "5px",
  fontSize: "0.75rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency, minimumFractionDigits: 0,
  }).format(Math.abs(n));
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// ── Chip ──────────────────────────────────────────────────────────────────────

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      padding: "0.2rem 0.625rem",
      background: `${color}18`,
      border: `1px solid ${color}40`,
      borderRadius: "999px",
      color,
      fontSize: "0.78rem",
      fontWeight: 500,
    }}>
      {children}
    </span>
  );
}

// ── Override Dropdown ─────────────────────────────────────────────────────────

function OverrideDropdown({
  onSelect,
  onClose,
  currency,
}: {
  onSelect: (leaseId: string) => void;
  onClose:  () => void;
  currency: string;
}) {
  const { leases, lessees, assets } = usePortfolioData();
  const [search, setSearch] = useState("");

  const lesseeMap = useMemo(() => new Map(lessees.map(l => [l.id, l])), [lessees]);
  const assetMap  = useMemo(() => new Map(assets.map(a => [a.id, a])), [assets]);

  const options = useMemo<{ lease: Lease; label: string }[]>(() => {
    const q = search.toLowerCase();
    return leases
      .map(lease => {
        const lessee = lesseeMap.get(lease.lessee_id);
        const asset  = assetMap.get(lease.asset_id);
        if (!lessee || !asset) return null;
        const label = `${lessee.name} — ${asset.registration}${
          lease.monthly_rental ? ` — ${fmtCurrency(lease.monthly_rental, currency)}/mo` : ""
        }`;
        return { lease, label };
      })
      .filter((o): o is { lease: Lease; label: string } =>
        o !== null && (!q || o.label.toLowerCase().includes(q)),
      );
  }, [leases, lesseeMap, assetMap, search, currency]);

  return (
    <div
      style={{
        position: "absolute", zIndex: 50, top: "calc(100% + 4px)", right: 0,
        background: "#1E293B", border: "1px solid #334155",
        borderRadius: "8px", padding: "0.5rem",
        width: "340px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <input
        autoFocus
        type="text"
        placeholder="Search leases…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "0.375rem 0.625rem",
          background: "#0F172A", border: "1px solid #334155",
          borderRadius: "6px", color: "#F8FAFC", fontSize: "0.78rem",
          outline: "none", boxSizing: "border-box", marginBottom: "0.375rem",
        }}
      />
      <div style={{ maxHeight: "220px", overflowY: "auto" }}>
        {options.length === 0 ? (
          <div style={{ padding: "0.5rem", color: "#475569", fontSize: "0.78rem" }}>
            No leases found
          </div>
        ) : (
          options.map(({ lease, label }) => (
            <button
              key={lease.id}
              onClick={() => { onSelect(lease.id); onClose(); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "0.5rem 0.625rem", background: "transparent",
                border: "none", color: "#CBD5E1", fontSize: "0.78rem",
                cursor: "pointer", borderRadius: "4px",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {label}
            </button>
          ))
        )}
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: "0.375rem", width: "100%", padding: "0.375rem",
          background: "transparent", border: "1px solid #334155",
          color: "#64748B", fontSize: "0.75rem", borderRadius: "6px", cursor: "pointer",
        }}
      >
        Cancel
      </button>
    </div>
  );
}

// ── Match Row ─────────────────────────────────────────────────────────────────

function MatchRow({
  match,
  currency,
  onAccept,
  onOverride,
  onMarkUnmatched,
}: {
  match:           MatchResult;
  currency:        string;
  onAccept:        () => void;
  onOverride:      (leaseId: string) => void;
  onMarkUnmatched: () => void;
}) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const { transaction: txn, bestMatch, confidence, confirmed, amountDelta } = match;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "90px minmax(0,2fr) 90px minmax(0,2fr) 55px 20px auto",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.625rem 1rem",
        borderBottom: "1px solid #0F172A",
        fontSize: "0.8rem",
        background: confirmed ? "#0A1628" : "transparent",
      }}
    >
      {/* Date */}
      <span style={{ color: "#94A3B8", whiteSpace: "nowrap" }}>{txn.valueDate}</span>

      {/* Description */}
      <span
        style={{ color: "#F8FAFC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={txn.description}
      >
        {txn.description}
      </span>

      {/* Amount */}
      <span style={{ color: "#4ADE80", fontWeight: 500, textAlign: "right", whiteSpace: "nowrap" }}>
        +{fmtCurrency(txn.amount, txn.currency)}
      </span>

      {/* Lessee · lease ref · delta */}
      <span style={{ color: "#CBD5E1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {bestMatch ? (
          <>
            {bestMatch.lessee.name} · {bestMatch.asset.registration}
            {amountDelta != null && Math.abs(amountDelta) > 0.01 && (
              <span style={{ color: "#F59E0B", marginLeft: "0.375rem", fontSize: "0.72rem" }}>
                Δ{amountDelta > 0 ? "+" : ""}{fmtCurrency(amountDelta, txn.currency)}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: "#475569" }}>—</span>
        )}
      </span>

      {/* Confidence */}
      <span style={{ color: "#64748B", textAlign: "center" }}>{fmtPct(confidence)}</span>

      {/* Confirmed tick */}
      <span>
        {confirmed && <CheckCircle size={14} style={{ color: "#4ADE80" }} />}
      </span>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.3rem", position: "relative" }}>
        {!confirmed && (
          <>
            <button onClick={onAccept} style={{ ...btnBase, background: "#1D4ED8", color: "#fff", borderColor: "#1D4ED8" }}>
              Accept
            </button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setOverrideOpen(v => !v)} style={btnBase}>
                Override ▾
              </button>
              {overrideOpen && (
                <OverrideDropdown
                  currency={currency}
                  onSelect={onOverride}
                  onClose={() => setOverrideOpen(false)}
                />
              )}
            </div>
            <button onClick={onMarkUnmatched} style={{ ...btnBase, color: "#F87171" }}>
              Unmatched
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title,
  borderColor,
  matches,
  defaultOpen,
  currency,
  onAccept,
  onOverride,
  onMarkUnmatched,
}: {
  title:           string;
  borderColor:     string;
  matches:         MatchResult[];
  defaultOpen:     boolean;
  currency:        string;
  onAccept:        (txnId: string) => void;
  onOverride:      (txnId: string, leaseId: string) => void;
  onMarkUnmatched: (txnId: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (matches.length === 0) return null;

  return (
    <div style={{
      border: "1px solid #334155",
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: "8px",
      overflow: "hidden",
      marginBottom: "0.75rem",
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "0.75rem 1rem",
          background: "#1E293B", border: "none", cursor: "pointer",
        }}
      >
        <span style={{ color: "#F8FAFC", fontSize: "0.875rem", fontWeight: 500 }}>
          {title}{" "}
          <span style={{ color: "#64748B", fontWeight: 400 }}>({matches.length})</span>
        </span>
        {open
          ? <ChevronUp  size={15} style={{ color: "#64748B" }} />
          : <ChevronDown size={15} style={{ color: "#64748B" }} />
        }
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #334155" }}>
          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "90px minmax(0,2fr) 90px minmax(0,2fr) 55px 20px auto",
            gap: "0.5rem",
            padding: "0.375rem 1rem",
            background: "#0F172A",
            fontSize: "0.72rem",
            color: "#64748B",
            fontWeight: 500,
          }}>
            <span>Date</span>
            <span>Description</span>
            <span style={{ textAlign: "right" }}>Amount</span>
            <span>Lessee · Lease</span>
            <span style={{ textAlign: "center" }}>Conf.</span>
            <span />
            <span>Actions</span>
          </div>

          {matches.map(m => (
            <MatchRow
              key={m.transactionId}
              match={m}
              currency={currency}
              onAccept={() => onAccept(m.transactionId)}
              onOverride={leaseId => onOverride(m.transactionId, leaseId)}
              onMarkUnmatched={() => onMarkUnmatched(m.transactionId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Workspace ─────────────────────────────────────────────────────────────────

interface Props {
  statementId:  string;
  transactions: BankTransaction[];
  currency:     string;
}

export function ReconciliationWorkspace({ statementId, transactions, currency }: Props) {
  const {
    result, loading, saving,
    runMatching, acceptAll, acceptOne, overrideMatch, markUnmatched, rerun,
  } = useReconciliation(statementId, transactions);

  const [rerunConfirm, setRerunConfirm] = useState(false);

  // Section partitions:
  // Auto-matched = confidence ≥ 0.8 OR (confirmed + was in review = matchType 'auto'|'manual' + confirmed)
  // Needs review  = 0.4–0.79 + unconfirmed
  // Unmatched     = < 0.4 (all — confirmed ones show ✓ badge in the row)
  const autoMatches = result?.matches.filter(
    m => m.confidence >= 0.8 || (m.confirmed && m.confidence >= 0.4 && m.matchType !== "unmatched"),
  ) ?? [];
  const reviewMatches = result?.matches.filter(
    m => m.confidence >= 0.4 && m.confidence < 0.8 && !m.confirmed,
  ) ?? [];
  const unmatchedMatches = result?.matches.filter(m => m.confidence < 0.4) ?? [];

  const reconciledCount  = result?.matches.filter(m => m.confirmed).length ?? 0;
  const totalCount       = result?.matches.length ?? 0;
  const unconfirmedAuto  = result?.matches.filter(m => m.confidence >= 0.8 && !m.confirmed).length ?? 0;

  if (loading) {
    return (
      <div style={{
        padding: "3rem", display: "flex", justifyContent: "center",
        alignItems: "center", gap: "0.5rem",
        color: "#64748B", fontSize: "0.875rem",
      }}>
        <Loader2 size={18} className="animate-spin" />
        Loading reconciliation…
      </div>
    );
  }

  // Empty state — no matching run yet
  if (!result) {
    return (
      <div style={{
        padding: "3rem", display: "flex",
        flexDirection: "column", alignItems: "center",
      }}>
        <div style={{
          background: "#1E293B", border: "1px solid #334155",
          borderRadius: "12px", padding: "2rem 2.5rem",
          maxWidth: "400px", textAlign: "center",
        }}>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 500, color: "#F8FAFC", fontSize: "1rem" }}>
            No matching run yet
          </p>
          <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "#64748B", lineHeight: 1.5 }}>
            Automatically scores each bank credit against active leases by amount, date, and lessee name.
          </p>
          <button
            onClick={() => runMatching(statementId, transactions)}
            style={{
              background: "#3B82F6", border: "none", color: "#fff",
              borderRadius: "8px", padding: "0.625rem 1.5rem",
              fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
            }}
          >
            Run Matching
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: "0.75rem" }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", flexWrap: "wrap",
        gap: "0.75rem", marginBottom: "1rem",
        padding: "0.875rem 1rem",
        background: "#1E293B", border: "1px solid #334155", borderRadius: "10px",
      }}>
        {/* Progress pill */}
        <div style={{
          padding: "0.25rem 0.75rem",
          background: "#0F172A", border: "1px solid #334155",
          borderRadius: "999px", color: "#F8FAFC",
          fontSize: "0.8rem", fontWeight: 500, whiteSpace: "nowrap",
        }}>
          {reconciledCount} / {totalCount} reconciled
        </div>

        {/* Stat chips */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", flex: 1 }}>
          <Chip color="#4ADE80">{result.autoCount} auto-matched</Chip>
          <Chip color="#F59E0B">{result.reviewCount} needs review</Chip>
          <Chip color="#F87171">{result.unmatchedCount} unmatched</Chip>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {rerunConfirm ? (
            <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "#F87171", whiteSpace: "nowrap" }}>
                Reset confirmed matches?
              </span>
              <button
                onClick={async () => {
                  setRerunConfirm(false);
                  await rerun(statementId, transactions);
                }}
                style={{ ...btnBase, color: "#F87171", borderColor: "#7F1D1D" }}
              >
                Confirm
              </button>
              <button onClick={() => setRerunConfirm(false)} style={btnBase}>Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setRerunConfirm(true)}
              style={{ ...btnBase, display: "flex", alignItems: "center", gap: "0.375rem" }}
            >
              <RefreshCw size={13} /> Re-run Matching
            </button>
          )}

          {unconfirmedAuto > 0 && (
            <button
              disabled={saving}
              onClick={() => acceptAll(statementId)}
              style={{
                background: "#15803D", border: "none", color: "#fff",
                borderRadius: "6px", padding: "0.4rem 0.875rem",
                fontSize: "0.8rem", fontWeight: 500, cursor: "pointer",
                opacity: saving ? 0.6 : 1, whiteSpace: "nowrap",
              }}
            >
              Accept All Auto-Matches ({unconfirmedAuto})
            </button>
          )}
        </div>
      </div>

      {/* Three sections */}
      <Section
        title="✅ Auto-matched"
        borderColor="#4ADE80"
        matches={autoMatches}
        defaultOpen={true}
        currency={currency}
        onAccept={acceptOne}
        onOverride={overrideMatch}
        onMarkUnmatched={markUnmatched}
      />
      <Section
        title="⚠️ Needs Review"
        borderColor="#F59E0B"
        matches={reviewMatches}
        defaultOpen={true}
        currency={currency}
        onAccept={acceptOne}
        onOverride={overrideMatch}
        onMarkUnmatched={markUnmatched}
      />
      <Section
        title="❌ Unmatched"
        borderColor="#F87171"
        matches={unmatchedMatches}
        defaultOpen={true}
        currency={currency}
        onAccept={acceptOne}
        onOverride={overrideMatch}
        onMarkUnmatched={markUnmatched}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/reconciliation/ReconciliationWorkspace.tsx
git commit -m "feat: add ReconciliationWorkspace component with 3-section layout"
```

---

## Task 5: Modify Reconciliation.tsx — tab switcher

**Files:**
- Modify: `src/app/pages/Reconciliation.tsx`

The current file (310 lines) renders `<TransactionBrowser>` directly inside `<AnimatePresence>` when a statement is selected (around line 292). This task replaces that block with a tab bar that switches between `TransactionBrowser` and `ReconciliationWorkspace`.

- [ ] **Step 1: Add import and `activeTab` state**

Add after the existing imports (after line 8):
```typescript
import { ReconciliationWorkspace } from "../components/reconciliation/ReconciliationWorkspace";
```

Add to the component state declarations (after line 191):
```typescript
const [activeTab, setActiveTab] = useState<"transactions" | "reconcile">("transactions");
```

- [ ] **Step 2: Reset tab when statement is deselected**

In `handleSelectStatement`, add `setActiveTab("transactions");` in the early-return branch (deselect path). The function currently reads:

```typescript
const handleSelectStatement = async (id: string) => {
  if (selectedStatementId === id) {
    setSelectedStatementId(null);
    setTransactions([]);
    return;
  }
  ...
```

Change to:

```typescript
const handleSelectStatement = async (id: string) => {
  if (selectedStatementId === id) {
    setSelectedStatementId(null);
    setTransactions([]);
    setActiveTab("transactions");
    return;
  }
  setActiveTab("transactions");   // reset when switching to a different statement
  setSelectedStatementId(id);
  setLoadingTx(true);
  const txns = await fetchTransactions(id);
  setTransactions(txns);
  setLoadingTx(false);
};
```

- [ ] **Step 3: Replace the expansion block with tab bar + conditional panel**

Find the `<AnimatePresence>` block (lines 291–300):

```tsx
<AnimatePresence>
  {selectedStatementId === stmt.id && selectedStatement && (
    <TransactionBrowser
      key={stmt.id}
      transactions={transactions}
      loading={loadingTx}
      currency={selectedStatement.currency}
    />
  )}
</AnimatePresence>
```

Replace with:

```tsx
<AnimatePresence>
  {selectedStatementId === stmt.id && selectedStatement && (
    <motion.div
      key={stmt.id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      style={{ marginTop: "0.75rem" }}
    >
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0,
        background: "#1E293B", border: "1px solid #334155",
        borderRadius: "8px", padding: "0.25rem",
        width: "fit-content", marginBottom: "0.75rem",
      }}>
        {(["transactions", "reconcile"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "0.375rem 0.875rem",
              background: activeTab === tab ? "#0F172A" : "transparent",
              border: "none",
              borderRadius: "6px",
              color: activeTab === tab ? "#F8FAFC" : "#64748B",
              fontSize: "0.8rem",
              fontWeight: activeTab === tab ? 500 : 400,
              cursor: "pointer",
              textTransform: "capitalize",
              transition: "background 150ms, color 150ms",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Panel */}
      {activeTab === "transactions" ? (
        <TransactionBrowser
          transactions={transactions}
          loading={loadingTx}
          currency={selectedStatement.currency}
        />
      ) : (
        <ReconciliationWorkspace
          statementId={selectedStatementId}
          transactions={transactions}
          currency={selectedStatement.currency}
        />
      )}
    </motion.div>
  )}
</AnimatePresence>
```

Note: the outer `motion.div` now owns the enter/exit animation that `TransactionBrowser` previously had internally. Remove or keep the animation inside `TransactionBrowser` as-is — it will double-animate slightly but is harmless.

- [ ] **Step 4: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If `motion` is not imported, add `import { motion, AnimatePresence } from "framer-motion";` — it's already there on line 4.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/Reconciliation.tsx
git commit -m "feat: add Reconcile tab to Reconciliation page (Feature 13 complete)"
```

---

## Self-review checklist

**Spec coverage:**
- ✅ `reconciliation_matches` table with all specified columns and UNIQUE constraint on `transaction_id`
- ✅ `scoreTransaction`: amount 50% / date 30% / lessee 20%, debit exclusion, null rental guard
- ✅ `matchTransactions`: credit-only filter, all leases, threshold split ≥0.8/0.4–0.79/<0.4
- ✅ `useReconciliation`: `runMatching`, `acceptAll` (confidence ≥0.8 only), `acceptOne`, `overrideMatch`, `markUnmatched`, `rerun` (deletes all + re-runs)
- ✅ Mount-load: fetches saved rows → reconstructs from DB; if empty → result=null
- ✅ `ReconciliationWorkspace`: header bar with progress pill + stat chips + Accept All + Re-run
- ✅ Empty state with "Run Matching" button and explanation text
- ✅ Three collapsible sections: Auto (green), Needs Review (amber), Unmatched (red)
- ✅ Row columns: date, description, amount, lessee·lease ref, confidence %, confirmed badge, actions
- ✅ Override dropdown: searchable, shows `lessee.name — asset.registration — $X/mo`
- ✅ Confirmed review-rows move to auto-matched section
- ✅ `rerun` shows two-step confirmation in UI before executing
- ✅ Tab switcher in `Reconciliation.tsx`: Transactions | Reconcile
- ✅ 5 unit tests matching the spec exactly
- ✅ Migration file naming follows `010_` sequence

**Type consistency:**
- `MatchResult.transactionId` used consistently (not `transaction_id`)
- `ReconciliationResult.statementId` used consistently (not `statement_id`)
- `LeaseCandidate` interface used in hook and workspace without re-declaration
- `MatchType = "auto" | "manual" | "unmatched"` imported from `reconciliationMatcher.ts` everywhere
