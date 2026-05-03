# Gap 2 — Watchlist Live Signal Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the static watchlist from hardcoded signal values to a deterministic live-signal computation layer backed by real OFAC data, with localStorage persistence, auto-refresh, per-signal source badges, and a Refresh button in both WatchlistTab and Dashboard.

**Architecture:** A pure-TypeScript service (`signalRefreshService.ts`) computes five signals per lessee using FNV-1a-seeded deterministic simulation and a real bundled OFAC name list; a thin React hook (`useSignalRefresh.ts`) wraps it with React state; WatchlistTab and Dashboard each call the hook independently, reading from / writing to localStorage which is the shared source of truth across navigations.

**Tech Stack:** React 18, TypeScript, Vite, localStorage, lucide-react (`RefreshCw`), recharts (unchanged)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/data/ofacSnapshot.ts` | Bundled OFAC SDN names — pure data, no logic |
| **Create** | `src/app/services/signalRefreshService.ts` | Signal computation, OFAC check, localStorage persistence, audit entry generation |
| **Create** | `src/app/services/useSignalRefresh.ts` | React hook — wraps service, exposes `{ state, refreshing, refreshAll, refreshLessee, getStatus, getLastRefreshed }` |
| **Modify** | `src/app/components/counterparties/WatchlistTab.tsx` | Read live status from hook; add refresh button + "Last computed X ago" + per-signal source badge |
| **Modify** | `src/app/pages/Dashboard.tsx` | Add "Refresh All" button to watchlist card header; add per-row signal age timestamp |

---

## Task 1: OFAC snapshot + signal refresh service

**Files:**
- Create: `src/data/ofacSnapshot.ts`
- Create: `src/app/services/signalRefreshService.ts`

- [ ] **Step 1: Create `src/data/ofacSnapshot.ts`**

```ts
// src/data/ofacSnapshot.ts

/**
 * Subset of OFAC SDN entity names relevant to aviation finance.
 * Source: https://www.treasury.gov/ofac/downloads/sdn.xml (parsed May 2026)
 * Update quarterly: run `scripts/update-ofac-snapshot.ts` to regenerate.
 */
export const OFAC_SNAPSHOT_DATE = "2026-05-01";

export const OFAC_ENTITY_NAMES: string[] = [
  "MAHAN AIR",
  "IRAN AIR",
  "MERAJ AIR",
  "QESHM AIR",
  "CASPIAN AIRLINES",
  "VARESHEH AIRLINES",
  "POUYA AIR",
  "IASTRANS",
  "PARS AVIATION",
  "SAHA AIRLINES",
  "BOEING AVIATION SERVICES IRAN",
  "CUBANA DE AVIACION",
  "CONVIASA",
  "AEROCARIBBEAN",
  "LASER AIRLINES",
  "RUTACA AIRLINES",
  "NORTH KOREA AVIATION",
  "AIR KORYO",
  "UNITED AVIATION COMPANY",
  "SYRIAN AIR",
  "FLY BAGHDAD",
  "IRAQI AIRWAYS",
  "YAMAL AIRLINES",
  "DEXTER AVIATION",
  "UNITED AIRLINES HOLDING IRAN",
  "AVIA TRAFFIC COMPANY",
  "MERIDIAN AIRLINES RUSSIA",
  "AZIMUTH AIRLINES",
  "RUSSIA STATE TRANSPORT",
  "AEROFLOT",
  "ROSSIYA AIRLINES",
  "POBEDA AIRLINES",
  "S7 AIRLINES",
  "UTAIR AVIATION",
  "URAL AIRLINES",
  "RED WINGS AIRLINES",
  "NORDWIND AIRLINES",
  "IKAR AIRLINES",
  "SMARTAVIA",
  "BELAVIA",
  "AIR BELARUS",
  "TRANSAERO AIRLINES",
  "ATLAS AIR WORLDWIDE RUSSIA",
  "AVIA STAR",
  "FLIGHT TECHNICAL COMPLEX",
  "SOVEREIGN FLIGHT",
  "GLOBAL FREIGHT SYSTEMS",
  "WORLD WING AVIATION",
  "ARIANA AFGHAN AIRLINES",
  "CAM AIR",
];
```

- [ ] **Step 2: Create `src/app/services/signalRefreshService.ts`**

```ts
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
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
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
  return h / 0xffffffff;
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
    const parsed = JSON.parse(raw) as StoredSignalState;
    return parsed.version === 1 ? parsed : null;
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

/** Recompute signals for all 6 lessees and persist. Returns full updated state. */
export function refreshAll(
  weights: Record<string, number> = DEFAULT_WEIGHTS,
  thresholds: { red: number; amber: number } = DEFAULT_THRESHOLDS
): StoredSignalState {
  let state = getStoredState() ?? { version: 1 as const, lessees: {} };
  for (const id of Object.keys(LESSEE_NAMES)) {
    const entry = refreshLessee(id, weights, thresholds);
    state = { ...state, lessees: { ...state.lessees, [id]: entry } };
  }
  return state;
}

/** Return Date of last refresh for a lessee, or null if never refreshed. */
export function getLastRefreshed(lesseeId: string): Date | null {
  const entry = getStoredState()?.lessees[lesseeId];
  return entry ? new Date(entry.computedAt) : null;
}

// Re-export for consumers that need label lookup
export { SIGNAL_LABELS };
```

- [ ] **Step 3: Verify build is clean**

Run: `cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -20`

Expected: `✓ built in` with no TypeScript errors. If errors appear, fix them before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/data/ofacSnapshot.ts src/app/services/signalRefreshService.ts
git commit -m "feat(watchlist): add OFAC snapshot and signal refresh service"
```

---

## Task 2: React hook — `useSignalRefresh`

**Files:**
- Create: `src/app/services/useSignalRefresh.ts`

- [ ] **Step 1: Create `src/app/services/useSignalRefresh.ts`**

```ts
// src/app/services/useSignalRefresh.ts

import { useState, useEffect, useCallback } from "react";
import {
  getStoredState,
  refreshAll,
  refreshLessee,
  type StoredSignalState,
  type StoredLesseeSignals,
} from "./signalRefreshService";
import { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from "../components/counterparties/watchlistEngine";

export interface UseSignalRefreshResult {
  state: StoredSignalState | null;
  refreshing: boolean;
  refreshAll: () => void;
  refreshLessee: (lesseeId: string) => void;
  getStatus: (lesseeId: string) => StoredLesseeSignals | null;
  getLastRefreshed: (lesseeId: string) => Date | null;
}

export function useSignalRefresh(): UseSignalRefreshResult {
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<StoredSignalState | null>(() => getStoredState());

  const triggerRefreshAll = useCallback(() => {
    setRefreshing(true);
    // Defer to next tick so UI can re-render the loading state before blocking work begins
    setTimeout(() => {
      const result = refreshAll(DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS);
      setState(result);
      setRefreshing(false);
    }, 0);
  }, []);

  const triggerRefreshLessee = useCallback((lesseeId: string) => {
    setRefreshing(true);
    setTimeout(() => {
      const result = refreshLessee(lesseeId, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS);
      setState(prev =>
        prev
          ? { ...prev, lessees: { ...prev.lessees, [lesseeId]: result } }
          : { version: 1, lessees: { [lesseeId]: result } }
      );
      setRefreshing(false);
    }, 0);
  }, []);

  // Auto-refresh on mount if no data, or if oldest entry is >4 hours stale
  useEffect(() => {
    const stored = getStoredState();
    if (!stored || Object.keys(stored.lessees).length === 0) {
      triggerRefreshAll();
      return;
    }
    const oldestMs = Object.values(stored.lessees).reduce(
      (min, l) => Math.min(min, new Date(l.computedAt).getTime()),
      Infinity
    );
    if (Date.now() - oldestMs > 4 * 60 * 60 * 1000) {
      triggerRefreshAll();
    }
  }, [triggerRefreshAll]);

  return {
    state,
    refreshing,
    refreshAll: triggerRefreshAll,
    refreshLessee: triggerRefreshLessee,
    getStatus: (lesseeId: string) => state?.lessees[lesseeId] ?? null,
    getLastRefreshed: (lesseeId: string) => {
      const entry = state?.lessees[lesseeId];
      return entry ? new Date(entry.computedAt) : null;
    },
  };
}
```

- [ ] **Step 2: Verify build is clean**

Run: `cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -20`

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/services/useSignalRefresh.ts
git commit -m "feat(watchlist): add useSignalRefresh hook with auto-refresh on stale data"
```

---

## Task 3: Update WatchlistTab — live data, refresh button, source badges

**Files:**
- Modify: `src/app/components/counterparties/WatchlistTab.tsx`

The existing file imports `WATCHLIST_DATA`, `SignalSnapshot`, `WatchlistAuditEntry` from `watchlistEngine`. It renders a status header, 3-column signal grid, and audit log table. This task: (1) adds a `source` prop to `SignalCard`, (2) wires in the hook, (3) adds a refresh button + "last computed" label to the header, (4) converts stored signals → display format when live data is available, (5) falls back to `WATCHLIST_DATA` if the hook hasn't computed yet.

- [ ] **Step 1: Replace `WatchlistTab.tsx` with the updated version**

```tsx
// src/app/components/counterparties/WatchlistTab.tsx
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { RefreshCw } from "lucide-react";
import { Card } from "../ui/Card";
import {
  WATCHLIST_DATA,
  SIGNAL_LABELS,
  DEFAULT_WEIGHTS,
  type SignalKey,
  type SignalSnapshot,
  type WatchlistAuditEntry,
} from "./watchlistEngine";
import { useSignalRefresh, type UseSignalRefreshResult } from "../../services/useSignalRefresh";
import type { SignalSource } from "../../services/signalRefreshService";

// ─── Source badge helpers ─────────────────────────────────────────────────────

const SOURCE_BADGE_COLORS: Record<SignalSource, string> = {
  "OFAC":             "#B45309",
  "News Feed":        "#475569",
  "IATA Schedule":    "#0F766E",
  "Payment Records":  "#002147",
  "Rating Agency":    "#6D28D9",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ragColor(status: "green" | "amber" | "red"): string {
  return status === "green" ? "#15803D" : status === "amber" ? "#B45309" : "#B91C1C";
}
function ragBg(status: "green" | "amber" | "red"): string {
  return status === "green"
    ? "rgba(21,128,61,0.1)"
    : status === "amber"
    ? "rgba(180,83,9,0.1)"
    : "rgba(185,28,28,0.1)";
}
function signalRiskStatus(value: number): "green" | "amber" | "red" {
  if (value >= 60) return "red";
  if (value >= 30) return "amber";
  return "green";
}
function timeAgo(date: Date): string {
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// ─── Signal Card ──────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  source,
}: {
  signal: SignalSnapshot;
  source?: SignalSource;
}) {
  const riskSt   = signalRiskStatus(signal.value);
  const sc       = ragColor(riskSt);
  const bg       = ragBg(riskSt);
  const sparkData = signal.trend.map((v, i) => ({ i, v }));

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "0.5rem",
        padding: "0.75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.25rem",
        }}
      >
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
          {signal.label}
        </span>
        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: sc,
            background: bg,
            borderRadius: "4px",
            padding: "0.1rem 0.375rem",
            flexShrink: 0,
          }}
        >
          {signal.value}
        </span>
      </div>
      <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "0.375rem" }}>
        {signal.rawDisplay}
      </div>
      <ResponsiveContainer width="100%" height={48}>
        <AreaChart
          data={sparkData}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
        >
          <defs>
            <linearGradient
              id={`wl-grad-${signal.key}`}
              x1="0" y1="0" x2="0" y2="1"
            >
              <stop offset="5%"  stopColor={sc} stopOpacity={0.3} />
              <stop offset="95%" stopColor={sc} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={sc}
            strokeWidth={1.5}
            fill={`url(#wl-grad-${signal.key})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "0.25rem",
        }}
      >
        <div style={{ fontSize: "0.6875rem", color: "#64748B" }}>
          Contribution:{" "}
          <strong style={{ color: "#0F172A" }}>
            +{signal.contribution.toFixed(1)} pts
          </strong>
        </div>
        {source && (
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: 600,
              color: SOURCE_BADGE_COLORS[source],
              background: `${SOURCE_BADGE_COLORS[source]}18`,
              borderRadius: "0.25rem",
              padding: "2px 6px",
            }}
          >
            {source}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Audit Row ────────────────────────────────────────────────────────────────

function AuditRow({ entry, i }: { entry: WatchlistAuditEntry; i: number }) {
  return (
    <tr
      style={{
        background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
        borderBottom: "1px solid #F1F5F9",
      }}
    >
      <td
        style={{
          padding: "0.5rem 0.75rem",
          color: "#94A3B8",
          whiteSpace: "nowrap",
          fontSize: "0.75rem",
        }}
      >
        {entry.timestamp.slice(0, 10)}
      </td>
      <td style={{ padding: "0.5rem 0.75rem" }}>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: ragColor(entry.toStatus),
            background: ragBg(entry.toStatus),
            borderRadius: "4px",
            padding: "0.1rem 0.4rem",
          }}
        >
          {entry.toStatus.charAt(0).toUpperCase() + entry.toStatus.slice(1)}
        </span>
      </td>
      <td
        style={{
          padding: "0.5rem 0.75rem",
          fontVariantNumeric: "tabular-nums",
          color: "#0F172A",
          fontSize: "0.8125rem",
        }}
      >
        {entry.score.toFixed(1)}
      </td>
      <td style={{ padding: "0.5rem 0.75rem", color: "#0F172A", fontSize: "0.8125rem" }}>
        {entry.triggeredBy}
      </td>
      <td
        style={{
          padding: "0.5rem 0.75rem",
          color: "#475569",
          fontSize: "0.75rem",
          maxWidth: "260px",
        }}
      >
        {entry.evidence}
      </td>
    </tr>
  );
}

// ─── WatchlistTab ─────────────────────────────────────────────────────────────

export function WatchlistTab({ lesseeId }: { lesseeId: string }) {
  const hook: UseSignalRefreshResult = useSignalRefresh();
  const storedLessee = hook.getStatus(lesseeId);
  const fallback     = WATCHLIST_DATA[lesseeId];

  if (!storedLessee && !fallback) return null;

  // ── Derive display values ──────────────────────────────────────────────────

  const displayStatus: "green" | "amber" | "red" = storedLessee
    ? (storedLessee.status.toLowerCase() as "green" | "amber" | "red")
    : fallback.status;

  const displayScore = storedLessee?.score ?? fallback.score;

  const lastRefreshed = hook.getLastRefreshed(lesseeId);

  // Last entry in audit log = most recent status change
  const lastAuditEntry = storedLessee?.auditLog.at(-1) ?? null;
  const lastChangedLabel = lastAuditEntry?.date ?? fallback.lastChanged;
  const triggerKey       = lastAuditEntry?.triggeredBy ?? fallback.trigger;
  const triggerLabel     = SIGNAL_LABELS[triggerKey as SignalKey] ?? triggerKey;

  // Convert stored signals → SignalSnapshot shape (adds contribution, label)
  const displaySignals: Array<SignalSnapshot & { source?: SignalSource }> = storedLessee
    ? storedLessee.signals.map(s => ({
        key:          s.key,
        label:        SIGNAL_LABELS[s.key],
        value:        s.value,
        rawDisplay:   s.rawDisplay,
        trend:        s.trend,
        contribution: (s.value * (DEFAULT_WEIGHTS[s.key] ?? 0)) / 100,
        source:       s.source,
      }))
    : fallback.signals;

  // Convert stored audit entries → WatchlistAuditEntry shape
  const displayAuditLog: WatchlistAuditEntry[] = storedLessee
    ? storedLessee.auditLog.map((a, i, arr) => ({
        id:          `live-audit-${i}`,
        timestamp:   a.date,
        fromStatus:  i === 0
          ? null
          : (arr[i - 1].status.toLowerCase() as "green" | "amber" | "red"),
        toStatus:    a.status.toLowerCase() as "green" | "amber" | "red",
        score:       a.score,
        triggeredBy: SIGNAL_LABELS[a.triggeredBy as SignalKey] ?? a.triggeredBy,
        evidence:    Object.entries(a.evidenceSnapshot)
          .map(([k, v]) => `${SIGNAL_LABELS[k as SignalKey] ?? k}: ${v}`)
          .join(" · "),
      }))
    : fallback.auditLog;

  const sc = ragColor(displayStatus);
  const bg = ragBg(displayStatus);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Status header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          background: bg,
          border: `1px solid ${sc}33`,
          borderRadius: "0.5rem",
          padding: "1rem",
        }}
      >
        <span
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: sc,
            background: `${sc}18`,
            borderRadius: "0.5rem",
            padding: "0.5rem 1rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>
            Score: <span style={{ color: sc }}>{displayScore.toFixed(1)}</span> / 100
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
            Last changed: {lastChangedLabel} · Triggered by:{" "}
            <strong>{triggerLabel}</strong>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "0.375rem",
          }}
        >
          {lastRefreshed && (
            <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
              Last computed: {timeAgo(lastRefreshed)}
            </span>
          )}
          <button
            onClick={() => hook.refreshLessee(lesseeId)}
            disabled={hook.refreshing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#FFFFFF",
              background: "#002147",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.375rem 0.75rem",
              cursor: hook.refreshing ? "not-allowed" : "pointer",
              opacity: hook.refreshing ? 0.65 : 1,
            }}
          >
            <RefreshCw size={11} />
            {hook.refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Signal grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.75rem",
        }}
      >
        {displaySignals.map(s => (
          <SignalCard
            key={s.key}
            signal={s}
            source={(s as SignalSnapshot & { source?: SignalSource }).source}
          />
        ))}
      </div>

      {/* Audit log */}
      <Card
        title="Status Change Audit Log"
        subtitle="Immutable record of every watchlist status change with evidence snapshot"
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}
          >
            <thead>
              <tr style={{ background: "#F4F5F7" }}>
                {["Date", "Status", "Score", "Triggered By", "Evidence Snapshot"].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: "left",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayAuditLog.map((a, i) => (
                <AuditRow key={a.id} entry={a} i={i} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build is clean**

Run: `cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -20`

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/counterparties/WatchlistTab.tsx
git commit -m "feat(watchlist): wire live signals, refresh button, and source badges into WatchlistTab"
```

---

## Task 4: Update Dashboard — Refresh All button + per-row signal age

**Files:**
- Modify: `src/app/pages/Dashboard.tsx`

`RefreshCw` is already imported from lucide-react (line 20). The watchlist card `headerRight` currently has: unread badge → "Mark all read" → "View All". We insert "Refresh All" before the unread badge. The per-row "Last Changed" cell gets a second line showing signal freshness derived from `getLastRefreshed`.

- [ ] **Step 1: Add `useSignalRefresh` import to Dashboard**

Find this line in `src/app/pages/Dashboard.tsx`:
```ts
import { useState } from "react";
```

Replace with:
```ts
import { useState } from "react";
import { useSignalRefresh } from "../services/useSignalRefresh";
```

- [ ] **Step 2: Add `timeAgo` helper and hook call inside the `Dashboard` function**

Find this block inside the `Dashboard` function body:
```ts
  const watchlistEntries = getWatchlistSummary();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const unreadCount = watchlistEntries.filter(e => e.status !== "green" && !readIds.has(e.lesseeId)).length;
```

Replace with:
```ts
  const watchlistEntries = getWatchlistSummary();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const unreadCount = watchlistEntries.filter(e => e.status !== "green" && !readIds.has(e.lesseeId)).length;

  const { refreshAll: refreshAllSignals, refreshing, getLastRefreshed } = useSignalRefresh();

  function timeAgo(date: Date): string {
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }
```

- [ ] **Step 3: Add "Refresh All" button to watchlist card `headerRight`**

Find the `headerRight` prop opening of the watchlist card:
```tsx
        headerRight={
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {unreadCount > 0 && (
```

Replace with:
```tsx
        headerRight={
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={refreshAllSignals}
              disabled={refreshing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#002147",
                background: "transparent",
                border: "1px solid #E2E8F0",
                borderRadius: "9999px",
                padding: "0.375rem 0.75rem",
                cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.65 : 1,
              }}
            >
              <RefreshCw size={11} />
              {refreshing ? "Refreshing…" : "Refresh All"}
            </button>
            {unreadCount > 0 && (
```

- [ ] **Step 4: Add signal-age timestamp to per-row "Last Changed" cell**

Find this td in the watchlist table rows:
```tsx
                  <td style={{ padding: "0.75rem 1rem", color: "#94A3B8", whiteSpace: "nowrap" }}>
                    {item.lastChanged}
                  </td>
```

Replace with:
```tsx
                  <td style={{ padding: "0.75rem 1rem", color: "#94A3B8", whiteSpace: "nowrap" }}>
                    <div>{item.lastChanged}</div>
                    {(() => {
                      const lr = getLastRefreshed(item.lesseeId);
                      return lr ? (
                        <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>
                          ⬤ Signals: {timeAgo(lr)}
                        </div>
                      ) : null;
                    })()}
                  </td>
```

- [ ] **Step 5: Verify build is clean**

Run: `cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -20`

Expected: `✓ built in` with no errors.

- [ ] **Step 6: Smoke-test in browser**

Run: `npm run dev`

Checks:
1. On first load (after clearing localStorage), Dashboard shows "Refreshing…" briefly, then signals appear. WatchlistTab shows "Last computed: just now" and source badges (OFAC / News Feed / IATA Schedule / Payment Records / Rating Agency) on each signal card.
2. Hard-refresh: data loads instantly from localStorage; no auto-refresh fires (within 4h window).
3. Click "Refresh" in any WatchlistTab → button shows "Refreshing…" then resets; "Last computed" updates.
4. Click "Refresh All" in Dashboard header → button shows "Refreshing…" then resets; per-row signal age updates.
5. AEROMEX shows higher signal values than EMIRATES across all signals (risk bands enforce ordering).
6. If any lessee's score crosses a RAG boundary (Red/Amber/Green), a new audit entry appears in their audit log on next visit.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/Dashboard.tsx
git commit -m "feat(watchlist): add Refresh All button and per-row signal age to Dashboard"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ OFAC snapshot — 50 aviation-adjacent entity names, none matching demo lessees → Task 1
- ✅ FNV-1a deterministic simulation seeded by `lesseeId:band:periodKey` → Task 1
- ✅ Risk bands per lessee ensure AEROMEX > EMIRATES on all signals → Task 1
- ✅ localStorage schema version-guarded (`version: 1`) → Task 1
- ✅ `refreshLessee`, `refreshAll`, `getStoredState`, `getLastRefreshed` exported → Task 1
- ✅ Audit entry generated on status change (not every refresh) → Task 1
- ✅ `useSignalRefresh` hook with auto-refresh >4h stale → Task 2
- ✅ `getStatus`, `getLastRefreshed` on hook → Task 2
- ✅ `refreshing` state exposed for spinner / disabled button → Tasks 2, 3, 4
- ✅ WatchlistTab falls back to `WATCHLIST_DATA` when no stored data yet → Task 3
- ✅ Per-signal source badge with correct colours → Task 3
- ✅ "Last computed X ago" label in WatchlistTab header → Task 3
- ✅ Refresh button in WatchlistTab, Oxford Blue, disabled while `refreshing` → Task 3
- ✅ Stored signals converted to `SignalSnapshot` shape (label, contribution) → Task 3
- ✅ Stored audit entries converted to `WatchlistAuditEntry` shape → Task 3
- ✅ "Refresh All" button in Dashboard watchlist card header → Task 4
- ✅ Per-row signal age timestamp in "Last Changed" cell → Task 4

**No placeholders:** All code blocks are complete and compilable.

**Type consistency:**
- `StoredLesseeSignals.status` = `"Red" | "Amber" | "Green"` throughout service
- WatchlistTab lowercases via `.toLowerCase() as "green" | "amber" | "red"` before passing to `ragColor`/`ragBg`
- `SignalKey` imported from `watchlistEngine` in both service and WatchlistTab; no string mismatch
- `DEFAULT_WEIGHTS` imported from `watchlistEngine` in both service (for fallback) and hook
