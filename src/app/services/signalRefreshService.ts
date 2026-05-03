// src/app/services/signalRefreshService.ts

import { OFAC_ENTITY_NAMES } from "../../data/ofacSnapshot";
import {
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  SIGNAL_LABELS,
  type SignalKey,
} from "../components/counterparties/watchlistEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignalSource =
  | "OFAC"
  | "News Feed"
  | "IATA Schedule"
  | "Payment Records"
  | "Rating Agency";

export interface StoredSignal {
  key: SignalKey;
  value: number;       // 0–100
  rawDisplay: string;
  trend: number[];     // 12 monthly values
  source: SignalSource;
}

export interface StoredAuditEntry {
  date: string;                          // "YYYY-MM-DD"
  status: "Red" | "Amber" | "Green";
  score: number;
  triggeredBy: string;                   // SignalKey of the dominant signal
  evidenceSnapshot: Record<string, number>; // { [SignalKey]: value }
}

export interface StoredLesseeSignals {
  computedAt: string;   // ISO timestamp
  score: number;
  status: "Red" | "Amber" | "Green";
  signals: StoredSignal[];
  auditLog: StoredAuditEntry[];
}

export interface StoredSignalState {
  version: 1;
  lessees: Record<string, StoredLesseeSignals>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const LESSEE_NAMES: Record<string, string> = {
  INDIGO:    "IndiGo",
  AEROMEX:   "Aeromexico",
  SRILNKN:   "SriLankan Airlines",
  AZUL:      "Azul Airlines",
  TRANSATCA: "TransAT CA",
  EMIRATES:  "Emirates",
};

const STORAGE_KEY = "aeroinsights_watchlist_signals_v1";

/** Risk bands ensure stage-appropriate signal values across all lessees. */
const LESSEE_RISK_BANDS: Record<
  string,
  { news: [number, number]; schedule: [number, number]; payment: [number, number]; rating: [number, number] }
> = {
  INDIGO:    { news: [55, 90],  schedule: [55, 85],  payment: [60, 90],  rating: [40, 70] },
  AEROMEX:   { news: [70, 100], schedule: [65, 95],  payment: [70, 100], rating: [50, 80] },
  SRILNKN:   { news: [25, 65],  schedule: [25, 60],  payment: [30, 65],  rating: [20, 50] },
  AZUL:      { news: [20, 60],  schedule: [20, 55],  payment: [25, 60],  rating: [20, 45] },
  TRANSATCA: { news: [15, 55],  schedule: [15, 50],  payment: [20, 55],  rating: [15, 40] },
  EMIRATES:  { news: [0, 25],   schedule: [0, 20],   payment: [0, 15],   rating: [0, 20]  },
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getISOWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function getISOMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getISOQuarter(d: Date): string {
  return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
}
function getISOWeekOffset(base: Date, offsetWeeks: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetWeeks * 7);
  return getISOWeek(d);
}
function getISOMonthOffset(base: Date, offsetMonths: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + offsetMonths);
  return getISOMonth(d);
}
function getISOQuarterOffset(base: Date, offsetQuarters: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + offsetQuarters * 3);
  return getISOQuarter(d);
}

// ─── Hash / deterministic sim ─────────────────────────────────────────────────

/** FNV-1a 32-bit hash — returns 0–1 float. Same seed always produces same value. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h / 0x100000000;
}

function deterministicValue(
  lesseeId: string,
  band: "news" | "schedule" | "payment" | "rating",
  periodKey: string
): number {
  const [min, max] = LESSEE_RISK_BANDS[lesseeId]?.[band] ?? [0, 100];
  const t = hashSeed(`${lesseeId}:${band}:${periodKey}`);
  return Math.round(min + t * (max - min));
}

// ─── OFAC check ───────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function checkOFAC(lesseeName: string): boolean {
  const name = lesseeName.toUpperCase().trim();
  if (name.length === 0) return false;
  return OFAC_ENTITY_NAMES.some(entity => {
    if (entity.includes(name) || name.includes(entity)) return true;
    return levenshtein(name, entity) <= 2;
  });
}

// ─── Signal computation ───────────────────────────────────────────────────────

function computeSignals(lesseeId: string, lesseeName: string): StoredSignal[] {
  const now = new Date();
  const isoWeek    = getISOWeek(now);
  const isoMonth   = getISOMonth(now);
  const isoQuarter = getISOQuarter(now);

  const ofacHit       = checkOFAC(lesseeName);
  const paymentValue  = deterministicValue(lesseeId, "payment",  isoMonth);
  const scheduleValue = deterministicValue(lesseeId, "schedule", isoMonth);
  const ratingValue   = deterministicValue(lesseeId, "rating",   isoQuarter);
  const newsValue     = deterministicValue(lesseeId, "news",     isoWeek);
  const ctcValue      = ofacHit ? 100 : 0;

  return [
    {
      key: "paymentLateness",
      value: paymentValue,
      rawDisplay:
        paymentValue > 60
          ? `${Math.round(paymentValue * 0.3)}+ days avg`
          : paymentValue > 30
          ? "Occasional delays"
          : "On time",
      trend: Array.from({ length: 12 }, (_, i) =>
        deterministicValue(lesseeId, "payment", getISOMonthOffset(now, i - 11))
      ),
      source: "Payment Records",
    },
    {
      key: "scheduleQoQ",
      value: scheduleValue,
      rawDisplay:
        scheduleValue > 60
          ? `−${Math.round(scheduleValue * 0.15)}% schedule QoQ`
          : scheduleValue > 30
          ? "Minor reductions"
          : "Stable",
      trend: Array.from({ length: 12 }, (_, i) =>
        deterministicValue(lesseeId, "schedule", getISOMonthOffset(now, i - 11))
      ),
      source: "IATA Schedule",
    },
    {
      key: "ratingChange",
      value: ratingValue,
      rawDisplay:
        ratingValue > 60
          ? "Multi-notch downgrade"
          : ratingValue > 30
          ? "One-notch downgrade"
          : "Stable outlook",
      trend: Array.from({ length: 12 }, (_, i) =>
        deterministicValue(lesseeId, "rating", getISOQuarterOffset(now, i - 11))
      ),
      source: "Rating Agency",
    },
    {
      key: "ctcWatchlist",
      value: ctcValue,
      rawDisplay: ofacHit ? "OFAC match detected" : "Clear",
      trend: Array<number>(12).fill(ctcValue),
      source: "OFAC",
    },
    {
      key: "newsKeywordHits",
      value: newsValue,
      rawDisplay:
        newsValue > 60
          ? "4+ keyword hits this week"
          : newsValue > 30
          ? "2–3 keyword hits"
          : newsValue > 0
          ? "1 keyword hit"
          : "No hits",
      trend: Array.from({ length: 12 }, (_, i) =>
        deterministicValue(lesseeId, "news", getISOWeekOffset(now, i - 11))
      ),
      source: "News Feed",
    },
  ];
}

// ─── Audit entry generation ───────────────────────────────────────────────────

function maybeGenerateAuditEntry(
  previousStatus: "Red" | "Amber" | "Green" | null,
  newScore: number,
  newStatus: "Red" | "Amber" | "Green",
  signals: StoredSignal[],
  weights: Record<string, number>
): StoredAuditEntry | null {
  if (previousStatus !== null && previousStatus === newStatus) return null;
  if (signals.length === 0) return null;
  const topSignal = signals.reduce((best, s) =>
    s.value * (weights[s.key] ?? 0) > best.value * (weights[best.key] ?? 0) ? s : best
  );
  return {
    date: new Date().toISOString().split("T")[0],
    status: newStatus,
    score: Math.round(newScore),
    triggeredBy: topSignal.key,
    evidenceSnapshot: Object.fromEntries(signals.map(s => [s.key, s.value])),
  };
}

// ─── Exported API ─────────────────────────────────────────────────────────────

/** Read full stored state from localStorage. Returns null if nothing stored or schema version mismatch. */
export function getStoredState(): StoredSignalState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || typeof parsed.lessees !== "object" || parsed.lessees === null) {
      return null;
    }
    return parsed as StoredSignalState;
  } catch {
    return null;
  }
}

/** Recompute signals for one lessee, persist to localStorage, return updated entry. */
export function refreshLessee(
  lesseeId: string,
  weights: Record<string, number> = DEFAULT_WEIGHTS,
  thresholds: { red: number; amber: number } = DEFAULT_THRESHOLDS
): StoredLesseeSignals {
  const stored   = getStoredState();
  const previous = stored?.lessees[lesseeId] ?? null;
  const signals  = computeSignals(lesseeId, LESSEE_NAMES[lesseeId] ?? lesseeId);
  const scoreRaw = signals.reduce(
    (sum, s) => sum + (s.value * (weights[s.key] ?? 0)) / 100,
    0
  );
  const score  = Math.round(scoreRaw);
  const status: "Red" | "Amber" | "Green" =
    score >= thresholds.red ? "Red" : score >= thresholds.amber ? "Amber" : "Green";
  const auditEntry = maybeGenerateAuditEntry(
    previous?.status ?? null,
    score,
    status,
    signals,
    weights
  );
  const auditLog = [
    ...(previous?.auditLog ?? []),
    ...(auditEntry ? [auditEntry] : []),
  ];
  const entry: StoredLesseeSignals = {
    computedAt: new Date().toISOString(),
    score,
    status,
    signals,
    auditLog,
  };
  const next: StoredSignalState = {
    version: 1,
    lessees: { ...(stored?.lessees ?? {}), [lesseeId]: entry },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return entry;
}

/** Recompute signals for all 6 lessees and persist in a single localStorage write. Returns full updated state. */
export function refreshAll(
  weights: Record<string, number> = DEFAULT_WEIGHTS,
  thresholds: { red: number; amber: number } = DEFAULT_THRESHOLDS
): StoredSignalState {
  const stored  = getStoredState() ?? { version: 1 as const, lessees: {} };
  const lessees = { ...stored.lessees };
  for (const id of Object.keys(LESSEE_NAMES)) {
    const previous = stored.lessees[id] ?? null;
    const signals  = computeSignals(id, LESSEE_NAMES[id] ?? id);
    const scoreRaw = signals.reduce(
      (sum, s) => sum + (s.value * (weights[s.key] ?? 0)) / 100,
      0
    );
    const score  = Math.round(scoreRaw);
    const status: "Red" | "Amber" | "Green" =
      score >= thresholds.red ? "Red" : score >= thresholds.amber ? "Amber" : "Green";
    const auditEntry = maybeGenerateAuditEntry(
      previous?.status ?? null,
      score,
      status,
      signals,
      weights
    );
    lessees[id] = {
      computedAt: new Date().toISOString(),
      score,
      status,
      signals,
      auditLog: [
        ...(previous?.auditLog ?? []),
        ...(auditEntry ? [auditEntry] : []),
      ],
    };
  }
  const next: StoredSignalState = { version: 1, lessees };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Return Date of last refresh for a lessee, or null if never refreshed. */
export function getLastRefreshed(lesseeId: string): Date | null {
  const entry = getStoredState()?.lessees[lesseeId];
  return entry ? new Date(entry.computedAt) : null;
}

// Re-export for consumers that need label lookup
export { SIGNAL_LABELS };
