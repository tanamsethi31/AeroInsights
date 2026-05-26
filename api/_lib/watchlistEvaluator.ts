// api/_lib/watchlistEvaluator.ts
// T-5.3 — pure watchlist scorer. Takes ingested lessee columns, returns
// per-lessee status + score + signal breakdown. No DB, no DOM.

export type SignalKey =
  | "paymentLateness"
  | "scheduleQoQ"
  | "ratingChange"
  | "ctcWatchlist"
  | "newsKeywordHits";

export interface WatchlistLesseeInput {
  id:                       string;
  name:                     string;
  country:                  string | null;
  dpd_days:                 number | null;
  rating_notches_down:      number | null;
  country_watchlist:        boolean | null;
  insolvency_filed:         boolean | null;
  overall_behaviour_score:  number | null;
}

export interface WatchlistWeights extends Record<SignalKey, number> {}
export interface WatchlistThresholds { red: number; amber: number }

export interface WatchlistSignalValue {
  value:      number;            // 0–100
  rawDisplay: string;
}

export interface WatchlistResult {
  lessee_id:     string;
  lessee_name:   string;
  status:        "green" | "amber" | "red";
  score:         number;
  signals:       Record<SignalKey, WatchlistSignalValue>;
  triggered_by:  string;
  reason:        string;
}

// ── Signal computation from ingested columns ─────────────────────────

function paymentLateness(dpd: number | null): WatchlistSignalValue {
  const d = dpd ?? 0;
  // 0 → 0, 5 → 30, 30 → 70, 60+ → 100.
  const v = Math.min(100, Math.max(0, d <= 5 ? d * 6 : d <= 30 ? 30 + (d - 5) * 1.6 : 70 + Math.min(30, (d - 30) * 1.0)));
  return { value: Math.round(v), rawDisplay: `${d} DPD` };
}

function ratingChange(notches: number | null): WatchlistSignalValue {
  const n = notches ?? 0;
  // 0 notches = 0, 1 = 25, 2 = 55, 3+ = 85.
  const v = n <= 0 ? 0 : n === 1 ? 25 : n === 2 ? 55 : Math.min(100, 70 + n * 5);
  return { value: v, rawDisplay: n > 0 ? `${n} notch${n === 1 ? "" : "es"} down` : "Stable" };
}

function ctcWatchlist(flag: boolean | null): WatchlistSignalValue {
  return { value: flag ? 100 : 0, rawDisplay: flag ? "On watchlist" : "Not listed" };
}

function newsKeywordHits(insolvency: boolean | null): WatchlistSignalValue {
  // Until we wire NewsAPI keyword counts per lessee, use insolvency flag
  // as the dominant proxy. Real news scoring lands in a follow-up slice.
  return { value: insolvency ? 100 : 0, rawDisplay: insolvency ? "Insolvency filing" : "—" };
}

function scheduleQoQ(_: WatchlistLesseeInput): WatchlistSignalValue {
  // No QoQ schedule cancellation data ingested yet. Returns 0 so this
  // signal stays inert until that data source lands.
  return { value: 0, rawDisplay: "n/a" };
}

const SIGNAL_LABELS: Record<SignalKey, string> = {
  paymentLateness:  "Payment Lateness",
  scheduleQoQ:      "Schedule Cancellations (QoQ)",
  ratingChange:     "Rating Change",
  ctcWatchlist:     "AWG CTC Watchlist",
  newsKeywordHits:  "News Keyword Hits",
};

// ── Main entry ───────────────────────────────────────────────────────

export function evaluateLessee(
  l: WatchlistLesseeInput,
  weights: WatchlistWeights,
  thresholds: WatchlistThresholds,
): WatchlistResult {
  const signals: Record<SignalKey, WatchlistSignalValue> = {
    paymentLateness: paymentLateness(l.dpd_days),
    scheduleQoQ:     scheduleQoQ(l),
    ratingChange:    ratingChange(l.rating_notches_down),
    ctcWatchlist:    ctcWatchlist(l.country_watchlist),
    newsKeywordHits: newsKeywordHits(l.insolvency_filed),
  };

  // Weighted score. Weights sum to ~100, so the result is already 0–100.
  let score = 0;
  for (const k of Object.keys(signals) as SignalKey[]) {
    score += (signals[k].value * (weights[k] ?? 0)) / 100;
  }
  score = Math.round(score * 100) / 100;

  const status: "green" | "amber" | "red" =
    score >= thresholds.red   ? "red" :
    score >= thresholds.amber ? "amber" : "green";

  // Pick the highest-contribution signal as the "triggered_by" label.
  let topKey: SignalKey = "paymentLateness";
  let topContribution = -1;
  for (const k of Object.keys(signals) as SignalKey[]) {
    const c = (signals[k].value * (weights[k] ?? 0)) / 100;
    if (c > topContribution) { topContribution = c; topKey = k; }
  }

  const reasonBits: string[] = [];
  if (signals.paymentLateness.value >= 50) reasonBits.push(signals.paymentLateness.rawDisplay);
  if (signals.ratingChange.value    >= 50) reasonBits.push(signals.ratingChange.rawDisplay);
  if (signals.ctcWatchlist.value    >= 50) reasonBits.push("CTC watchlist");
  if (signals.newsKeywordHits.value >= 50) reasonBits.push(signals.newsKeywordHits.rawDisplay);
  const reason = reasonBits.length > 0
    ? reasonBits.join("; ")
    : "All signals within tolerance";

  return {
    lessee_id:    l.id,
    lessee_name:  l.name,
    status,
    score,
    signals,
    triggered_by: SIGNAL_LABELS[topKey],
    reason,
  };
}

export function evaluateLessees(
  lessees: WatchlistLesseeInput[],
  weights: WatchlistWeights,
  thresholds: WatchlistThresholds,
): WatchlistResult[] {
  return lessees.map((l) => evaluateLessee(l, weights, thresholds));
}

export const DEFAULT_WATCHLIST_WEIGHTS: WatchlistWeights = {
  paymentLateness: 35,
  scheduleQoQ:     20,
  ratingChange:    20,
  ctcWatchlist:    15,
  newsKeywordHits: 10,
};

export const DEFAULT_WATCHLIST_THRESHOLDS: WatchlistThresholds = { red: 60, amber: 30 };
