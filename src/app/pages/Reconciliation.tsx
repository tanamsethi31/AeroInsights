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
        background:     isSelected ? "#1E3A5F" : "#1E293B",
        border:         `1px solid ${isSelected ? "#3B82F6" : "#334155"}`,
        borderRadius:   "10px",
        padding:        "1rem 1.25rem",
        cursor:         "pointer",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            "1rem",
        transition:     "border-color 150ms, background 150ms",
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
      {isSelected
        ? <ChevronUp size={16} style={{ color: "#64748B", flexShrink: 0 }} />
        : <ChevronDown size={16} style={{ color: "#475569", flexShrink: 0 }} />}
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
      exit={{ opacity: 0, y: -4 }}
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
          Net:{" "}
          <span style={{ color: net >= 0 ? "#4ADE80" : "#F87171", fontWeight: 500 }}>
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
  const { statements, loading, importStatement, fetchTransactions } = useBankStatements();
  const [uploadOpen,          setUploadOpen         ] = useState(false);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [transactions,        setTransactions       ] = useState<BankTransaction[]>([]);
  const [loadingTx,           setLoadingTx          ] = useState(false);

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

  // Thin adapter: StatementUploadModal.onImport expects ImportPayload (local type),
  // which is structurally identical to Omit<BankStatement, "id"|"uploadedAt"|"orgId">.
  // We re-spread to avoid a nominal type mismatch if TS complains.
  const handleImport: (
    payload: { filename: string; currency: string; periodLabel: string; rowCount: number },
    transactions: import("../utils/bankStatementParser").ParsedTransaction[]
  ) => Promise<void> = (payload, txns) =>
    importStatement(
      { filename: payload.filename, currency: payload.currency, periodLabel: payload.periodLabel, rowCount: payload.rowCount },
      txns
    );

  const selectedStatement = statements.find(s => s.id === selectedStatementId) ?? null;

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

  return (
    <div style={{ padding: "2rem" }}>
      <PageHeader title="Reconciliation" subtitle="Browse uploaded bank statements and transactions">
        <button
          onClick={() => setUploadOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: "#3B82F6", border: "none", color: "#FFFFFF",
            borderRadius: "8px", padding: "0.5rem 1rem",
            fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
          }}
        >
          <Upload size={15} /> Upload Statement
        </button>
      </PageHeader>

      {loading ? (
        <div style={{ color: "#64748B", fontSize: "0.875rem", padding: "2rem 0" }}>Loading statements…</div>
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
                    key={stmt.id}
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

      <StatementUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onImport={handleImport} />
    </div>
  );
}
