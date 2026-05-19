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

  it("amount 60% off with matching lessee and in-period date → confidence in review range (0.4–0.79)", () => {
    // amount 160000 vs monthly_rental 100000 → delta=60000, ratio=0.6 → amountScore=max(0,1-0.6)=0.4
    // score = 0.5*0.4 + 0.3*1.0 + 0.2*1.0 = 0.2+0.3+0.2 = 0.7 → review range
    const txn       = makeTxn({ amount: 160_000 });
    const candidate = { lease: makeLease(), lessee: makeLessee(), asset: makeAsset() };
    const score     = scoreTransaction(txn, candidate);
    expect(score).toBeGreaterThanOrEqual(0.4);
    expect(score).toBeLessThan(0.8);
  });
});

describe("matchTransactions", () => {
  it("no lessee name + date far out of range + tiny amount → matchType='unmatched', bestMatch=null", () => {
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
    const txn    = makeTxn({ description: "Emirates Airlines payment" });
    const result = matchTransactions([txn], [lease], [makeLessee()], [makeAsset()], "stmt-1");
    // Max possible: 0.3 (date) + 0.2 (lessee) = 0.5 < 0.8
    expect(result.matches[0].confidence).toBeLessThan(0.8);
  });

  it("autoCount / reviewCount / unmatchedCount are computed correctly", () => {
    const t1 = makeTxn({ id: "t1", description: "Emirates Airlines payment", valueDate: "2024-06-15", amount: 100_000 });
    const t2 = makeTxn({ id: "t2", description: "Emirates Airlines payment", valueDate: "2024-06-15", amount: 160_000 });
    const t3 = makeTxn({ id: "t3", description: "MISC", reference: "", valueDate: "2020-01-01", amount: 1 });
    const result = matchTransactions([t1, t2, t3], [makeLease()], [makeLessee()], [makeAsset()], "stmt-1");
    expect(result.autoCount).toBe(1);
    expect(result.reviewCount).toBe(1);
    expect(result.unmatchedCount).toBe(1);
  });
});
