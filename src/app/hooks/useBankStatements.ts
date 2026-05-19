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
    id:          r.id           as string,
    orgId:       r.org_id       as string,
    statementId: r.statement_id as string,
    valueDate:   r.value_date   as string,
    description: r.description  as string,
    amount:      Number(r.amount),
    currency:    r.currency     as string,
    reference:   (r.reference as string) ?? null,
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

      // Insert statement row and get back the new id
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

  // One-shot async fetch — called by the page when user selects a statement
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
