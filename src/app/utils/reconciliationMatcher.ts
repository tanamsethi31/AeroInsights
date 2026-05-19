import type { Lease, Lessee, Asset } from "../types/portfolio";
import type { BankTransaction } from "../hooks/useBankStatements";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeaseCandidate {
  lease:  Lease;
  lessee: Lessee;
  asset:  Asset;
}

// "manual" is never produced by matchTransactions — it is set externally when the user overrides a match via the UI
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

  // Date score (weight 0.3) — force UTC to avoid timezone off-by-one
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
    const amountDelta =
      finalMatch && finalMatch.lease.monthly_rental != null
        ? txn.amount - finalMatch.lease.monthly_rental
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
