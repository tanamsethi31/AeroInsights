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
  // Auto-matched  = confidence >= 0.8  OR  (confirmed + was review = matchType 'auto'/'manual' + confirmed)
  // Needs Review  = 0.4–0.79 AND unconfirmed
  // Unmatched     = < 0.4 (confirmed ones show tick badge in MatchRow)
  const autoMatches = result?.matches.filter(
    m => m.confidence >= 0.8 || (m.confirmed && m.confidence >= 0.4 && m.matchType !== "unmatched"),
  ) ?? [];
  const reviewMatches = result?.matches.filter(
    m => m.confidence >= 0.4 && m.confidence < 0.8 && !m.confirmed,
  ) ?? [];
  const unmatchedMatches = result?.matches.filter(
    m => m.confidence < 0.4 || m.matchType === "unmatched",
  ) ?? [];

  const reconciledCount = result?.matches.filter(m => m.confirmed).length ?? 0;
  const totalCount      = result?.matches.length ?? 0;
  const unconfirmedAuto = result?.matches.filter(m => m.confidence >= 0.8 && !m.confirmed).length ?? 0;

  if (loading) {
    return (
      <div style={{
        padding: "3rem", display: "flex", justifyContent: "center",
        alignItems: "center", gap: "0.5rem",
        color: "#64748B", fontSize: "0.875rem",
      }}>
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
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
        title="Auto-matched"
        borderColor="#4ADE80"
        matches={autoMatches}
        defaultOpen={true}
        currency={currency}
        onAccept={acceptOne}
        onOverride={overrideMatch}
        onMarkUnmatched={markUnmatched}
      />
      <Section
        title="Needs Review"
        borderColor="#F59E0B"
        matches={reviewMatches}
        defaultOpen={true}
        currency={currency}
        onAccept={acceptOne}
        onOverride={overrideMatch}
        onMarkUnmatched={markUnmatched}
      />
      <Section
        title="Unmatched"
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
