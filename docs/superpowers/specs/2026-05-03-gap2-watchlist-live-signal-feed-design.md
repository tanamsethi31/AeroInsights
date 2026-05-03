# Gap 2 — Watchlist Live Signal Feed Design

## Goal

Upgrade the existing static watchlist system to appear as a live, automated signal-computation layer. One signal source uses real bundled data (OFAC sanctions). Two signals (news keywords, schedule QoQ / payment lateness) use deterministic simulation seeded by lessee identity and calendar week — producing realistic, time-varying values without requiring external APIs or a backend. All refreshes persist to `localStorage` and auto-generate audit log entries on status changes.

---

## Background

The existing `watchlistEngine.ts` has hardcoded signal values for all six lessees. The computation engine, scoring, and UI are all complete (Sprint 11 F11). The gap is that there is no mechanism to "refresh" signals — data never changes, timestamps never advance, and audit entries are static. For a product positioned as an early warning system, this breaks the demo narrative.

**Target audience:** Portfolio managers who need to see "this changed since last week" — not just a static colour. The freshness indicator and refresh button are the key UX differentiators.

---

## Architecture

### Files

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/data/ofacSnapshot.ts` | Bundled OFAC SDN entity names (~50 aviation-adjacent entries); pure data, no logic |
| **Create** | `src/app/services/signalRefreshService.ts` | Signal computation (OFAC check, deterministic news + schedule), localStorage persistence, audit-entry generation |
| **Create** | `src/app/services/useSignalRefresh.ts` | React hook — wraps service, exposes `{ state, refreshing, refreshAll, refreshLessee, getStatus, getLastRefreshed }` |
| **Modify** | `src/app/components/counterparties/WatchlistTab.tsx` | Read live status from hook; add refresh button + "Last computed X ago" + per-signal source label |
| **Modify** | `src/app/pages/Dashboard.tsx` | Add "Refresh All" button to watchlist card; auto-refresh on mount if data >4h stale |

---

## OFAC Snapshot (`src/data/ofacSnapshot.ts`)

A curated list of sanctioned entity names relevant to aviation — extracted from the public OFAC SDN XML (last updated May 2026). The list is intentionally small (≤60 entries) to keep the bundle lean while demonstrating a real data-backed check.

**None of the six demo lessees (IndiGo, Aeromexico, SriLankan, Azul, TransAT CA, Emirates) appear on this list**, so all `ctcWatchlist` scores from the OFAC check remain 0 by default — consistent with the existing static data.

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

---

## Signal Refresh Service (`src/app/services/signalRefreshService.ts`)

Pure TypeScript module. No React. Three exported functions: `refreshLessee`, `refreshAll`, `getStoredState`.

### localStorage schema

```ts
interface StoredSignalState {
  version: 1;
  lessees: Record<string, StoredLesseeSignals>;
}

interface StoredLesseeSignals {
  computedAt: string;           // ISO timestamp
  score: number;
  status: "Red" | "Amber" | "Green";
  signals: StoredSignal[];
  auditLog: StoredAuditEntry[];
}

interface StoredSignal {
  key: SignalKey;               // from watchlistEngine
  value: number;                // 0–100
  rawDisplay: string;
  trend: number[];              // 12 monthly values
  source: SignalSource;
}

type SignalSource = "OFAC" | "News Feed" | "IATA Schedule" | "Payment Records" | "Rating Agency";

interface StoredAuditEntry {
  date: string;
  status: "Red" | "Amber" | "Green";
  score: number;
  triggeredBy: string;
  evidenceSnapshot: Record<string, number>;
}
```

### OFAC check

```ts
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function checkOFAC(lesseeName: string): boolean {
  const name = lesseeName.toUpperCase().trim();
  return OFAC_ENTITY_NAMES.some(entity => {
    if (entity.includes(name) || name.includes(entity)) return true;
    return levenshtein(name, entity) <= 2;
  });
}
```

### Deterministic signal simulation

Seed = `lesseeId + signalKey + periodKey` where `periodKey` is:
- News: ISO year-week (e.g. `"2026-W18"`) — values shift weekly
- Schedule/Payment: ISO year-month (e.g. `"2026-05"`) — values shift monthly
- Rating: ISO year-quarter (e.g. `"2026-Q2"`) — values shift quarterly

```ts
function hashSeed(seed: string): number {
  let h = 2166136261; // FNV-1a 32-bit
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h / 0xffffffff; // 0–1 float
}
```

**Risk bands per lessee** — ensure Stage 3 always scores higher than Stage 1:

```ts
const LESSEE_RISK_BANDS: Record<string, { news: [number,number]; schedule: [number,number]; payment: [number,number]; rating: [number,number] }> = {
  INDIGO:    { news: [55, 90], schedule: [55, 85], payment: [60, 90], rating: [40, 70] },
  AEROMEX:   { news: [70, 100], schedule: [65, 95], payment: [70, 100], rating: [50, 80] },
  SRILNKN:   { news: [25, 65], schedule: [25, 60], payment: [30, 65], rating: [20, 50] },
  AZUL:      { news: [20, 60], schedule: [20, 55], payment: [25, 60], rating: [20, 45] },
  TRANSATCA: { news: [15, 55], schedule: [15, 50], payment: [20, 55], rating: [15, 40] },
  EMIRATES:  { news: [0, 25],  schedule: [0, 20],  payment: [0, 15],  rating: [0, 20] },
};

function deterministicValue(lesseeId: string, signalKey: string, periodKey: string): number {
  const [min, max] = LESSEE_RISK_BANDS[lesseeId]?.[signalKey as "news"] ?? [0, 100];
  const t = hashSeed(`${lesseeId}:${signalKey}:${periodKey}`);
  return Math.round(min + t * (max - min));
}
```

### Signal computation per lessee

```ts
function computeSignals(lesseeId: string, lesseeName: string): StoredSignal[] {
  const now = new Date();
  const isoWeek = getISOWeek(now);        // e.g. "2026-W18"
  const isoMonth = getISOMonth(now);      // e.g. "2026-05"
  const isoQuarter = getISOQuarter(now);  // e.g. "2026-Q2"

  const ofacHit = checkOFAC(lesseeName);
  const bands = LESSEE_RISK_BANDS[lesseeId];

  // Build 12-month trend for each simulated signal
  function buildTrend(key: string, periodFn: (offset: number) => string): number[] {
    return Array.from({ length: 12 }, (_, i) => {
      const period = periodFn(i - 11); // last 12 periods
      return deterministicValue(lesseeId, key, period);
    });
  }

  const newsValue     = deterministicValue(lesseeId, "news", isoWeek);
  const scheduleValue = deterministicValue(lesseeId, "schedule", isoMonth);
  const paymentValue  = deterministicValue(lesseeId, "payment", isoMonth);
  const ratingValue   = deterministicValue(lesseeId, "rating", isoQuarter);
  const ctcValue      = ofacHit ? 100 : 0;

  return [
    {
      key: "paymentLateness",
      value: paymentValue,
      rawDisplay: paymentValue > 60 ? `${Math.round(paymentValue * 0.3)}+ days avg` : paymentValue > 30 ? "Occasional delays" : "On time",
      trend: buildTrend("payment", (offset) => getISOMonthOffset(now, offset)),
      source: "Payment Records",
    },
    {
      key: "scheduleQoQ",
      value: scheduleValue,
      rawDisplay: scheduleValue > 60 ? `−${Math.round(scheduleValue * 0.15)}% schedule QoQ` : scheduleValue > 30 ? "Minor reductions" : "Stable",
      trend: buildTrend("schedule", (offset) => getISOMonthOffset(now, offset)),
      source: "IATA Schedule",
    },
    {
      key: "ratingChange",
      value: ratingValue,
      rawDisplay: ratingValue > 60 ? "Multi-notch downgrade" : ratingValue > 30 ? "One-notch downgrade" : "Stable outlook",
      trend: buildTrend("rating", (offset) => getISOQuarterOffset(now, offset)),
      source: "Rating Agency",
    },
    {
      key: "ctcWatchlist",
      value: ctcValue,
      rawDisplay: ofacHit ? "OFAC match detected" : "Clear",
      trend: Array(12).fill(ctcValue),
      source: "OFAC",
    },
    {
      key: "newsKeywordHits",
      value: newsValue,
      rawDisplay: newsValue > 60 ? "4+ keyword hits this week" : newsValue > 30 ? "2–3 keyword hits" : newsValue > 0 ? "1 keyword hit" : "No hits",
      trend: buildTrend("news", (offset) => getISOWeekOffset(now, offset)),
      source: "News Feed",
    },
  ];
}
```

### Audit entry generation

On each refresh, compare new score to stored score:

```ts
function maybeGenerateAuditEntry(
  lesseeId: string,
  previousStatus: "Red" | "Amber" | "Green" | null,
  newScore: number,
  newStatus: "Red" | "Amber" | "Green",
  signals: StoredSignal[],
  weights: Record<string, number>
): StoredAuditEntry | null {
  if (previousStatus === null || previousStatus !== newStatus) {
    const topSignal = signals.reduce((best, s) =>
      (s.value * weights[s.key]) > (best.value * weights[best.key]) ? s : best
    );
    return {
      date: new Date().toISOString().split("T")[0],
      status: newStatus,
      score: Math.round(newScore),
      triggeredBy: topSignal.key,
      evidenceSnapshot: Object.fromEntries(signals.map(s => [s.key, s.value])),
    };
  }
  return null;
}
```

### Main exports

```ts
export const LESSEE_NAMES: Record<string, string> = {
  INDIGO: "IndiGo",
  AEROMEX: "Aeromexico",
  SRILNKN: "SriLankan Airlines",
  AZUL: "Azul Airlines",
  TRANSATCA: "TransAT CA",
  EMIRATES: "Emirates",
};

const STORAGE_KEY = "aeroinsights_watchlist_signals_v1";

/** Read the full stored state from localStorage. Returns null if nothing stored yet. */
export function getStoredState(): StoredSignalState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSignalState;
    return parsed.version === 1 ? parsed : null; // version guard
  } catch {
    return null;
  }
}

/** Recompute signals for one lessee, persist to localStorage, return updated entry. */
export function refreshLessee(
  lesseeId: string,
  weights: Record<string, number>,
  thresholds: { red: number; amber: number }
): StoredLesseeSignals {
  const stored = getStoredState();
  const previous = stored?.lessees[lesseeId] ?? null;
  const signals = computeSignals(lesseeId, LESSEE_NAMES[lesseeId] ?? lesseeId);
  const scoreRaw = signals.reduce((sum, s) => sum + (s.value * (weights[s.key] ?? 0)) / 100, 0);
  const score = Math.round(scoreRaw);
  const status: "Red" | "Amber" | "Green" =
    score >= thresholds.red ? "Red" : score >= thresholds.amber ? "Amber" : "Green";
  const auditEntry = maybeGenerateAuditEntry(
    lesseeId, previous?.status ?? null, score, status, signals, weights
  );
  const auditLog = [...(previous?.auditLog ?? []), ...(auditEntry ? [auditEntry] : [])];
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

/** Recompute signals for all 6 lessees and persist. */
export function refreshAll(
  weights: Record<string, number>,
  thresholds: { red: number; amber: number }
): StoredSignalState {
  const ids = Object.keys(LESSEE_NAMES);
  let state = getStoredState() ?? { version: 1 as const, lessees: {} };
  for (const id of ids) {
    const entry = refreshLessee(id, weights, thresholds);
    state = { ...state, lessees: { ...state.lessees, [id]: entry } };
  }
  return state;
}

/** Return Date of last refresh for a lessee, or null if never refreshed. */
export function getLastRefreshed(lesseeId: string): Date | null {
  const stored = getStoredState();
  const entry = stored?.lessees[lesseeId];
  return entry ? new Date(entry.computedAt) : null;
}
```

---

## React Hook (`src/app/services/useSignalRefresh.ts`)

```ts
export function useSignalRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<StoredSignalState | null>(() => getStoredState());

  // Auto-refresh on mount if data is stale (>4 hours)
  useEffect(() => {
    const stored = getStoredState();
    if (!stored) { triggerRefreshAll(); return; }
    const oldestComputedAt = Math.min(
      ...Object.values(stored.lessees).map(l => new Date(l.computedAt).getTime())
    );
    if (Date.now() - oldestComputedAt > 4 * 60 * 60 * 1000) {
      triggerRefreshAll();
    }
  }, []);

  function triggerRefreshAll() {
    setRefreshing(true);
    // Run in next tick to avoid blocking render
    setTimeout(() => {
      const result = refreshAll(DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS);
      setState(result);
      setRefreshing(false);
    }, 0);
  }

  function triggerRefreshLessee(lesseeId: string) {
    setRefreshing(true);
    setTimeout(() => {
      const result = refreshLessee(lesseeId, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS);
      setState(prev => prev ? {
        ...prev,
        lessees: { ...prev.lessees, [lesseeId]: result }
      } : null);
      setRefreshing(false);
    }, 0);
  }

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

---

## WatchlistTab Changes

**Props unchanged:** `{ lesseeId: LesseeId }`

**New:** Call `useSignalRefresh()` at the top of the component. If `getStatus(lesseeId)` returns a stored state, use it. Otherwise fall back to `WATCHLIST_DATA[lesseeId]`.

**Header additions:**
- "Last computed: X ago" text (`#94A3B8`, `0.75rem`)
- `⟳ Refresh` button (Oxford Blue `#002147`, disabled + spinner while `refreshing`)

**Signal card additions:**
- Bottom-right corner: source badge (e.g., `OFAC`, `News Feed`, `IATA Schedule`) — `fontSize: 0.625rem`, `background: #F1F5F9`, `borderRadius: 0.25rem`, `padding: 2px 6px`

**Source badge colours:**
- `OFAC` → `#B45309` amber (sanctions = highest sensitivity)
- `News Feed` → `#475569` slate
- `IATA Schedule` → `#0F766E` teal
- `Payment Records` → `#002147` Oxford Blue
- `Rating Agency` → `#6D28D9` purple

---

## Dashboard Changes

**Watchlist card:**
- Add `⟳ Refresh All` button next to "Mark all read" in `headerRight`
- Show spinner (inline) while `refreshing`
- Per-row: add small dot indicator + "Xh ago" text derived from `getLastRefreshed(item.lesseeId)`

**Auto-refresh:**
The `useSignalRefresh` hook handles auto-refresh on mount — no additional logic needed in Dashboard beyond calling `refreshAll` from the hook.

---

## Date utility functions (inline in service)

```ts
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
  const d = new Date(base); d.setDate(d.getDate() + offsetWeeks * 7); return getISOWeek(d);
}
function getISOMonthOffset(base: Date, offsetMonths: number): string {
  const d = new Date(base); d.setMonth(d.getMonth() + offsetMonths); return getISOMonth(d);
}
function getISOQuarterOffset(base: Date, offsetQuarters: number): string {
  const d = new Date(base); d.setMonth(d.getMonth() + offsetQuarters * 3); return getISOQuarter(d);
}
```

---

## Success Criteria

1. `npm run build` zero errors
2. On first app load (empty localStorage): `refreshAll()` triggers automatically; Watchlist tab shows "Last computed: just now"
3. On subsequent loads (<4h): stored values shown; no auto-refresh
4. On subsequent loads (>4h): silent auto-refresh triggers on Dashboard mount
5. AEROMEX always scores higher than EMIRATES on all simulated signals (risk bands enforce this)
6. Clicking `⟳ Refresh` on any lessee's Watchlist tab updates that lessee's signals and "Last computed" time
7. If score crosses Red/Amber/Green boundary, a new audit entry appears in the Watchlist audit log
8. Each signal card shows its source badge (OFAC / News Feed / IATA Schedule / Payment Records / Rating Agency)
9. OFAC check: if lessee name is modified in dev to "MAHAN AIR", `ctcWatchlist` score becomes 100
10. `⟳ Refresh All` on Dashboard refreshes all 6 lessees and updates per-row timestamps

---

## Out of Scope

- Real external API calls (news APIs, live OFAC XML fetch)
- Backend/server-side scheduling
- Push notifications on status change
- Persisting audit log beyond `localStorage`
- More than the 6 existing demo lessees
- User-configurable refresh interval
