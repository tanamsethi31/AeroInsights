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

  // Stable lookup maps — rebuilt only when source arrays change
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

  // Functional-update patch — setResult(prev =>) never captures stale state
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
          } as MatchResult;
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

    // Delete ALL rows for the statement (including confirmed — UI warns before calling this)
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
