// src/app/components/counterparties/watchlistEngine.ts

export type SignalKey =
  | "paymentLateness"
  | "scheduleQoQ"
  | "ratingChange"
  | "ctcWatchlist"
  | "newsKeywordHits";

export interface SignalSnapshot {
  key: SignalKey;
  label: string;
  value: number;       // 0–100, higher = more risk
  rawDisplay: string;
  trend: number[];     // 12-month history (May '25 → Apr '26)
  contribution: number; // value × weight / 100
}

export interface WatchlistAuditEntry {
  id: string;
  timestamp: string;
  fromStatus: "green" | "amber" | "red" | null;
  toStatus: "green" | "amber" | "red";
  score: number;
  triggeredBy: string;
  evidence: string;
}

export interface WatchlistStatusEntry {
  lesseeId: string;
  lesseeName: string;
  country: string;
  status: "green" | "amber" | "red";
  score: number;
  signals: SignalSnapshot[];
  lastChanged: string;
  trigger: string;
  reason: string;
  auditLog: WatchlistAuditEntry[];
}

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  paymentLateness:  "Payment Lateness",
  scheduleQoQ:      "Schedule Cancellations (QoQ)",
  ratingChange:     "Rating Change",
  ctcWatchlist:     "AWG CTC Watchlist",
  newsKeywordHits:  "News Keyword Hits",
};

export const DEFAULT_WEIGHTS: Record<SignalKey, number> = {
  paymentLateness:  35,
  scheduleQoQ:      20,
  ratingChange:     20,
  ctcWatchlist:     15,
  newsKeywordHits:  10,
};

export const DEFAULT_THRESHOLDS = { red: 60, amber: 30 };

export function computeScore(
  signals: SignalSnapshot[],
  weights: Record<SignalKey, number>
): number {
  return signals.reduce((sum, s) => sum + (s.value * weights[s.key]) / 100, 0);
}

export function computeStatus(
  score: number,
  thresholds: { red: number; amber: number }
): "green" | "amber" | "red" {
  if (score >= thresholds.red) return "red";
  if (score >= thresholds.amber) return "amber";
  return "green";
}

// ─── Raw signal data ─────────────────────────────────────────────────────────

function buildSignals(
  rows: Array<{ key: SignalKey; value: number; rawDisplay: string; trend: number[] }>
): SignalSnapshot[] {
  return rows.map(r => ({
    ...r,
    label: SIGNAL_LABELS[r.key],
    contribution: (r.value * DEFAULT_WEIGHTS[r.key]) / 100,
  }));
}

const INDIGO_SIGNALS = buildSignals([
  // score = (100×35 + 60×20 + 55×20 + 100×15 + 75×10)/100 = 80.5
  { key: "paymentLateness",  value: 100, rawDisplay: "45 DPD",      trend: [0,0,5,10,20,35,55,70,80,90,95,100] },
  { key: "scheduleQoQ",      value:  60, rawDisplay: "−12% QoQ",    trend: [5,5,5,10,15,20,30,35,45,52,57,60] },
  { key: "ratingChange",     value:  55, rawDisplay: "BBB− → BB−",  trend: [0,0,0,0,0,0,0,30,30,55,55,55] },
  { key: "ctcWatchlist",     value: 100, rawDisplay: "On watchlist", trend: [0,0,0,0,0,0,0,100,100,100,100,100] },
  { key: "newsKeywordHits",  value:  75, rawDisplay: "3 keyword hits", trend: [0,25,25,25,25,50,50,50,75,75,75,75] },
]);

const AEROMEX_SIGNALS = buildSignals([
  // score = (100×35 + 100×20 + 55×20 + 100×15 + 100×10)/100 = 91
  { key: "paymentLateness",  value: 100, rawDisplay: "88 DPD",         trend: [0,5,15,25,40,60,70,80,85,90,95,100] },
  { key: "scheduleQoQ",      value: 100, rawDisplay: "−30% QoQ",       trend: [10,15,20,30,45,60,70,80,90,95,100,100] },
  { key: "ratingChange",     value:  55, rawDisplay: "B− → CCC",       trend: [0,0,0,30,30,30,30,55,55,55,55,55] },
  { key: "ctcWatchlist",     value: 100, rawDisplay: "On watchlist",    trend: [0,0,0,0,100,100,100,100,100,100,100,100] },
  { key: "newsKeywordHits",  value: 100, rawDisplay: "4+ keyword hits", trend: [25,25,50,50,50,75,75,75,100,100,100,100] },
]);

const SRILNKN_SIGNALS = buildSignals([
  // score = (30×35 + 20×20 + 30×20 + 100×15 + 50×10)/100 = 40.5
  { key: "paymentLateness",  value:  30, rawDisplay: "12 DPD",        trend: [0,5,8,5,10,12,8,10,12,12,10,30] },
  { key: "scheduleQoQ",      value:  20, rawDisplay: "−5% QoQ",       trend: [0,0,0,5,5,10,10,15,18,20,20,20] },
  { key: "ratingChange",     value:  30, rawDisplay: "BB− → B+",      trend: [0,0,0,0,0,0,0,0,0,30,30,30] },
  { key: "ctcWatchlist",     value: 100, rawDisplay: "On watchlist",   trend: [0,0,0,0,0,0,100,100,100,100,100,100] },
  { key: "newsKeywordHits",  value:  50, rawDisplay: "2 keyword hits", trend: [0,0,25,25,25,50,50,50,50,50,50,50] },
]);

const AZUL_SIGNALS = buildSignals([
  // score = (30×35 + 70×20 + 30×20 + 0×15 + 50×10)/100 = 35.5
  { key: "paymentLateness",  value:  30, rawDisplay: "6 DPD",          trend: [0,0,5,8,5,10,8,10,8,10,10,30] },
  { key: "scheduleQoQ",      value:  70, rawDisplay: "−18% QoQ",       trend: [0,5,5,10,15,25,35,50,58,63,67,70] },
  { key: "ratingChange",     value:  30, rawDisplay: "B+ watch",        trend: [0,0,0,0,0,0,0,0,0,30,30,30] },
  { key: "ctcWatchlist",     value:   0, rawDisplay: "Not listed",      trend: [0,0,0,0,0,0,0,0,0,0,0,0] },
  { key: "newsKeywordHits",  value:  50, rawDisplay: "2 keyword hits",  trend: [0,0,0,0,25,25,25,25,25,25,50,50] },
]);

const TRANSATCA_SIGNALS = buildSignals([
  // score = (45×35 + 40×20 + 30×20 + 0×15 + 25×10)/100 = 32.25
  { key: "paymentLateness",  value:  45, rawDisplay: "8 DPD (pattern)", trend: [0,5,8,10,8,10,8,12,12,12,12,45] },
  { key: "scheduleQoQ",      value:  40, rawDisplay: "−8% QoQ",         trend: [0,0,5,5,10,15,20,25,30,35,38,40] },
  { key: "ratingChange",     value:  30, rawDisplay: "BB → B",           trend: [0,0,0,0,0,0,0,0,30,30,30,30] },
  { key: "ctcWatchlist",     value:   0, rawDisplay: "Not listed",        trend: [0,0,0,0,0,0,0,0,0,0,0,0] },
  { key: "newsKeywordHits",  value:  25, rawDisplay: "1 keyword hit",     trend: [0,0,0,0,0,25,25,25,25,25,25,25] },
]);

const EMIRATES_SIGNALS = buildSignals([
  // score = (0×35 + 0×20 + 0×20 + 0×15 + 40×10)/100 = 4
  { key: "paymentLateness",  value:  0, rawDisplay: "0 DPD",             trend: [0,0,0,0,0,0,0,0,0,0,0,0] },
  { key: "scheduleQoQ",      value:  0, rawDisplay: "+2% QoQ",           trend: [0,0,0,0,0,0,0,0,0,0,0,0] },
  { key: "ratingChange",     value:  0, rawDisplay: "Stable A−",         trend: [0,0,0,0,0,0,0,0,0,0,0,0] },
  { key: "ctcWatchlist",     value:  0, rawDisplay: "Not listed",        trend: [0,0,0,0,0,0,0,0,0,0,0,0] },
  { key: "newsKeywordHits",  value: 40, rawDisplay: "1 keyword hit (fiscal)", trend: [0,0,0,0,0,0,0,0,0,0,0,40] },
]);

// ─── Audit logs ──────────────────────────────────────────────────────────────

const INDIGO_AUDIT: WatchlistAuditEntry[] = [
  { id: "AWL-IND-001", timestamp: "2025-10-01T09:00:00Z", fromStatus: null,    toStatus: "green", score:  8.5, triggeredBy: "Initial classification", evidence: "paymentLateness: 0 | scheduleQoQ: 5 | ratingChange: 0 | ctcWatchlist: 0 | newsKeywordHits: 25" },
  { id: "AWL-IND-002", timestamp: "2026-01-15T14:30:00Z", fromStatus: "green", toStatus: "amber", score: 42.0, triggeredBy: "AWG CTC Watchlist",       evidence: "paymentLateness: 35 | scheduleQoQ: 30 | ratingChange: 30 | ctcWatchlist: 100 | newsKeywordHits: 50" },
  { id: "AWL-IND-003", timestamp: "2026-02-01T08:00:00Z", fromStatus: "amber", toStatus: "red",   score: 80.5, triggeredBy: "Payment Lateness",         evidence: "paymentLateness: 100 | scheduleQoQ: 60 | ratingChange: 55 | ctcWatchlist: 100 | newsKeywordHits: 75" },
];

const AEROMEX_AUDIT: WatchlistAuditEntry[] = [
  { id: "AWL-AMX-001", timestamp: "2025-09-01T09:00:00Z", fromStatus: null,    toStatus: "green", score: 10.0, triggeredBy: "Initial classification", evidence: "paymentLateness: 0 | scheduleQoQ: 10 | ratingChange: 0 | ctcWatchlist: 0 | newsKeywordHits: 25" },
  { id: "AWL-AMX-002", timestamp: "2025-10-15T11:00:00Z", fromStatus: "green", toStatus: "amber", score: 38.5, triggeredBy: "Schedule Cancellations (QoQ)", evidence: "paymentLateness: 25 | scheduleQoQ: 45 | ratingChange: 30 | ctcWatchlist: 100 | newsKeywordHits: 50" },
  { id: "AWL-AMX-003", timestamp: "2026-01-20T08:00:00Z", fromStatus: "amber", toStatus: "red",   score: 91.0, triggeredBy: "Payment Lateness",          evidence: "paymentLateness: 100 | scheduleQoQ: 100 | ratingChange: 55 | ctcWatchlist: 100 | newsKeywordHits: 100" },
];

const SRILNKN_AUDIT: WatchlistAuditEntry[] = [
  { id: "AWL-SRL-001", timestamp: "2025-10-01T09:00:00Z", fromStatus: null,    toStatus: "green", score: 12.0, triggeredBy: "Initial classification",  evidence: "paymentLateness: 5 | scheduleQoQ: 5 | ratingChange: 0 | ctcWatchlist: 0 | newsKeywordHits: 25" },
  { id: "AWL-SRL-002", timestamp: "2025-11-15T10:00:00Z", fromStatus: "green", toStatus: "amber", score: 40.5, triggeredBy: "AWG CTC Watchlist",        evidence: "paymentLateness: 10 | scheduleQoQ: 10 | ratingChange: 0 | ctcWatchlist: 100 | newsKeywordHits: 50" },
];

const AZUL_AUDIT: WatchlistAuditEntry[] = [
  { id: "AWL-AZL-001", timestamp: "2025-10-01T09:00:00Z", fromStatus: null,    toStatus: "green", score: 14.0, triggeredBy: "Initial classification",        evidence: "paymentLateness: 0 | scheduleQoQ: 15 | ratingChange: 0 | ctcWatchlist: 0 | newsKeywordHits: 25" },
  { id: "AWL-AZL-002", timestamp: "2026-02-18T10:30:00Z", fromStatus: "green", toStatus: "amber", score: 35.5, triggeredBy: "Schedule Cancellations (QoQ)", evidence: "paymentLateness: 30 | scheduleQoQ: 70 | ratingChange: 30 | ctcWatchlist: 0 | newsKeywordHits: 50" },
];

const TRANSATCA_AUDIT: WatchlistAuditEntry[] = [
  { id: "AWL-TCA-001", timestamp: "2025-10-01T09:00:00Z", fromStatus: null,    toStatus: "green", score:  6.0, triggeredBy: "Initial classification", evidence: "paymentLateness: 0 | scheduleQoQ: 5 | ratingChange: 0 | ctcWatchlist: 0 | newsKeywordHits: 0" },
  { id: "AWL-TCA-002", timestamp: "2026-01-15T09:00:00Z", fromStatus: "green", toStatus: "amber", score: 32.25, triggeredBy: "Rating Change",          evidence: "paymentLateness: 12 | scheduleQoQ: 20 | ratingChange: 30 | ctcWatchlist: 0 | newsKeywordHits: 25" },
];

const EMIRATES_AUDIT: WatchlistAuditEntry[] = [
  { id: "AWL-EMR-001", timestamp: "2025-10-01T09:00:00Z", fromStatus: null, toStatus: "green", score: 0.0, triggeredBy: "Initial classification", evidence: "paymentLateness: 0 | scheduleQoQ: 0 | ratingChange: 0 | ctcWatchlist: 0 | newsKeywordHits: 0" },
];

// ─── Assembled watchlist data ─────────────────────────────────────────────────

export const WATCHLIST_DATA: Record<string, WatchlistStatusEntry> = {
  INDIGO: {
    lesseeId: "INDIGO", lesseeName: "IndiGo Airlines", country: "India",
    status: "red", score: 80.5,
    signals: INDIGO_SIGNALS,
    lastChanged: "2026-02-01", trigger: "Payment Lateness",
    reason: "Payment 45 days overdue; AWG CTC watchlist active; rating downgraded BBB− → BB−",
    auditLog: INDIGO_AUDIT,
  },
  AEROMEX: {
    lesseeId: "AEROMEX", lesseeName: "Aeromexico", country: "Mexico",
    status: "red", score: 91.0,
    signals: AEROMEX_SIGNALS,
    lastChanged: "2026-01-20", trigger: "Payment Lateness",
    reason: "Chapter 11 filing; 88 DPD; −30% schedule reduction; CTC watchlist",
    auditLog: AEROMEX_AUDIT,
  },
  SRILNKN: {
    lesseeId: "SRILNKN", lesseeName: "SriLankan Airlines", country: "Sri Lanka",
    status: "amber", score: 40.5,
    signals: SRILNKN_SIGNALS,
    lastChanged: "2025-11-15", trigger: "AWG CTC Watchlist",
    reason: "S&P downgrade BB− → B+; AWG CTC watchlist; sovereign risk elevated",
    auditLog: SRILNKN_AUDIT,
  },
  AZUL: {
    lesseeId: "AZUL", lesseeName: "Azul Brazilian Airlines", country: "Brazil",
    status: "amber", score: 35.5,
    signals: AZUL_SIGNALS,
    lastChanged: "2026-02-18", trigger: "Schedule Cancellations (QoQ)",
    reason: "Schedule reduction −18% QoQ; liquidity tightening; BRL/USD pressure",
    auditLog: AZUL_AUDIT,
  },
  TRANSATCA: {
    lesseeId: "TRANSATCA", lesseeName: "Air Transat", country: "Canada",
    status: "amber", score: 32.25,
    signals: TRANSATCA_SIGNALS,
    lastChanged: "2026-01-15", trigger: "Rating Change",
    reason: "Restructuring negotiations initiated; deferral request received; rating BB → B",
    auditLog: TRANSATCA_AUDIT,
  },
  EMIRATES: {
    lesseeId: "EMIRATES", lesseeName: "Emirates", country: "UAE",
    status: "green", score: 4.0,
    signals: EMIRATES_SIGNALS,
    lastChanged: "2025-10-01", trigger: "Initial classification",
    reason: "Exemplary payment history. Strong sovereign backing. Low risk.",
    auditLog: EMIRATES_AUDIT,
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────

const STATUS_ORDER = { red: 0, amber: 1, green: 2 };

export function getWatchlistSummary(): WatchlistStatusEntry[] {
  return Object.values(WATCHLIST_DATA).sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );
}
