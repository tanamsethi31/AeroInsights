# Sprint 11 F11 — Watchlist & Early Warning System Design

## Goal

Replace the static watchlist on Dashboard with a computed Green/Amber/Red signal engine. Add a "Watchlist" tab to `LesseeProfilePanel` showing per-signal breakdown + audit log. Add an "Alerts" tab to Settings with configurable weights, thresholds, and a simulated notification panel.

---

## Background

The Dashboard currently shows a hardcoded `watchlistItems` array. The Counterparties page shows behaviour scores but no computed early-warning status derived from those signals. Portfolio managers need a rule-based system that surfaces distress signals before they become stage migrations — and they need to be able to show auditors which signals fired and when.

**Target audience:** Portfolio managers monitoring distress; compliance officers reviewing signal-triggered status changes; risk analysts configuring thresholds.

---

## Architecture

### File changes

| Action | Path | Change |
|--------|------|--------|
| **Create** | `src/app/components/counterparties/watchlistEngine.ts` | Signal data, computation logic, audit log — pure TS, no React |
| **Create** | `src/app/components/counterparties/WatchlistTab.tsx` | Signal breakdown UI — zero props, reads from engine |
| **Modify** | `src/app/components/counterparties/LesseeProfilePanel.tsx` | Wire "Watchlist" as 7th tab; pass `lesseeId` to `WatchlistTab` |
| **Modify** | `src/app/pages/Dashboard.tsx` | Replace static `watchlistItems` with `getWatchlistSummary()` from engine; add click-through nav to Counterparties; add unread badge |
| **Modify** | `src/app/pages/Settings.tsx` | Add "Alerts" tab with weight sliders, threshold inputs, notification panel |

---

## Signal Engine (`watchlistEngine.ts`)

### Signal types

```ts
type SignalKey = "paymentLateness" | "scheduleQoQ" | "ratingChange" | "ctcWatchlist" | "newsKeywordHits";

interface SignalSnapshot {
  key: SignalKey;
  label: string;
  value: number;          // normalised 0–100 (higher = more risk)
  rawDisplay: string;     // human-readable raw value, e.g. "45 DPD" or "−18% QoQ"
  trend: number[];        // 12-point monthly history for sparkline
  contribution: number;   // value × weight / 100 (score points attributed to this signal)
}

interface WatchlistStatusEntry {
  lesseeId: string;
  lesseeName: string;
  country: string;
  status: "green" | "amber" | "red";
  score: number;          // 0–100 (higher = more risk)
  signals: SignalSnapshot[];
  lastChanged: string;    // ISO date of last status change
  trigger: string;        // primary signal that caused last change
  reason: string;         // human-readable reason string
  auditLog: WatchlistAuditEntry[];
  unread: boolean;
}

interface WatchlistAuditEntry {
  id: string;
  timestamp: string;
  fromStatus: "green" | "amber" | "red" | null;
  toStatus: "green" | "amber" | "red";
  score: number;
  triggeredBy: string;
  evidence: string;       // snapshot of signal values at time of change
}
```

### Default weights

```ts
const DEFAULT_WEIGHTS: Record<SignalKey, number> = {
  paymentLateness:  35,
  scheduleQoQ:      20,
  ratingChange:     20,
  ctcWatchlist:     15,
  newsKeywordHits:  10,
};
```

Weights sum to 100. Settings validates this and warns if not.

### Thresholds

```ts
const DEFAULT_THRESHOLDS = { red: 60, amber: 30 };
// score >= red → Red; score >= amber → Amber; else → Green
```

Note: score = Σ(signalValue × weight / 100), where signalValue is 0–100 risk. Higher score = more risk.

### Computation

```ts
function computeScore(signals: SignalSnapshot[], weights: Record<SignalKey, number>): number {
  return signals.reduce((sum, s) => sum + (s.value * weights[s.key]) / 100, 0);
}

function computeStatus(score: number, thresholds: { red: number; amber: number }): "green" | "amber" | "red" {
  if (score >= thresholds.red) return "red";
  if (score >= thresholds.amber) return "amber";
  return "green";
}
```

### Per-lessee signal data

All 6 lessees. Signal normalisation rules:

| Signal | Raw → 0–100 risk |
|--------|-----------------|
| `paymentLateness` | 0 DPD = 0; 1–14 DPD = 30; 15–29 DPD = 55; 30–59 DPD = 75; 60+ DPD = 100 |
| `scheduleQoQ` | 0% change = 0; −5% = 20; −10% = 40; −20% = 70; −30%+ = 100 |
| `ratingChange` | No change = 0; 1 notch down = 30; 2 notches = 55; 3+ notches = 80; default/CCC = 100 |
| `ctcWatchlist` | Not on watchlist = 0; on watchlist = 100 |
| `newsKeywordHits` | 0 hits = 0; 1 = 25; 2 = 50; 3 = 75; 4+ = 100 |

**INDIGO** (score ~82 → Red):
- paymentLateness: 45 DPD → 75. Trend: [0,0,5,10,20,35,45,55,65,70,72,75]
- scheduleQoQ: −12% QoQ → 45. Trend: [5,5,5,10,15,20,30,35,40,42,44,45]
- ratingChange: BBB- → BB- (2 notches) → 55. Trend: [0,0,0,0,0,0,0,30,30,55,55,55]
- ctcWatchlist: on watchlist → 100. Trend: [0,0,0,0,0,0,0,100,100,100,100,100]
- newsKeywordHits: 3 hits → 75. Trend: [0,25,25,25,25,50,50,50,75,75,75,75]
- Audit log: 3 entries (Green→Amber Jan '26, Amber→Red Feb '26, Red confirmed Apr '26)

**AEROMEX** (score ~94 → Red):
- paymentLateness: 88 DPD → 100. Trend: [0,5,15,25,35,55,65,75,80,90,95,100]
- scheduleQoQ: −30% QoQ → 100. Trend: [10,15,20,30,40,60,70,80,90,95,100,100]
- ratingChange: B- → CCC (2 notches) → 55. Trend: [0,0,0,30,30,30,30,55,55,55,55,55]
- ctcWatchlist: on watchlist → 100. Trend: [0,0,0,0,100,100,100,100,100,100,100,100]
- newsKeywordHits: 4+ hits → 100. Trend: [25,25,50,50,50,75,75,75,100,100,100,100]
- Audit log: 3 entries (Green→Amber Sep '25, Amber→Red Oct '25, Red deepened Jan '26)

**SRILNKN** (score ~52 → Amber):
- paymentLateness: 12 DPD → 30. Trend: [0,5,8,5,10,12,8,10,12,12,10,30]
- scheduleQoQ: −5% QoQ → 20. Trend: [0,0,0,5,5,10,10,15,18,20,20,20]
- ratingChange: BB- → B+ (1 notch) → 30. Trend: [0,0,0,0,0,0,0,0,0,30,30,30]
- ctcWatchlist: on watchlist → 100. Trend: [0,0,0,0,0,0,100,100,100,100,100,100]
- newsKeywordHits: 2 hits → 50. Trend: [0,0,25,25,25,50,50,50,50,50,50,50]
- Audit log: 2 entries (Green→Amber Nov '25, Amber confirmed Apr '26)

**AZUL** (score ~38 → Amber):
- paymentLateness: 6 DPD → 30. Trend: [0,0,5,8,5,10,8,10,8,10,10,30]
- scheduleQoQ: −18% QoQ → 65. Trend: [0,5,5,10,15,20,30,45,55,60,63,65]
- ratingChange: no notch change → 0. Trend: [0,0,0,0,0,0,0,0,0,0,0,0]
- ctcWatchlist: not on watchlist → 0. Trend: [0,0,0,0,0,0,0,0,0,0,0,0]
- newsKeywordHits: 1 hit → 25. Trend: [0,0,0,0,25,25,25,25,25,25,25,25]
- Audit log: 2 entries (Green→Amber Feb '26, Amber confirmed Apr '26)

**TRANSATCA** (score ~35 → Amber):
- paymentLateness: 8 DPD → 30. Trend: [0,5,8,10,8,10,8,12,12,12,12,30]
- scheduleQoQ: −8% QoQ → 30. Trend: [0,0,5,5,10,15,20,25,28,30,30,30]
- ratingChange: 1 notch down → 30. Trend: [0,0,0,0,0,0,0,0,30,30,30,30]
- ctcWatchlist: not on watchlist → 0. Trend: [0,0,0,0,0,0,0,0,0,0,0,0]
- newsKeywordHits: 1 hit → 25. Trend: [0,0,0,0,0,25,25,25,25,25,25,25]
- Audit log: 2 entries (Green→Amber Jan '26, Amber confirmed Apr '26)

**EMIRATES** (score ~4 → Green):
- paymentLateness: 0 DPD → 0. Trend: [0,0,0,0,0,0,0,0,0,0,0,0]
- scheduleQoQ: +2% QoQ → 0. Trend: [0,0,0,0,0,0,0,0,0,0,0,0]
- ratingChange: no change → 0. Trend: [0,0,0,0,0,0,0,0,0,0,0,0]
- ctcWatchlist: not on watchlist → 0. Trend: [0,0,0,0,0,0,0,0,0,0,0,0]
- newsKeywordHits: 0 hits → 0. Trend: [0,0,0,0,0,0,0,0,0,0,0,0]
- Audit log: 1 entry (initial Green classification)

### Exports

```ts
export const WATCHLIST_DATA: Record<string, WatchlistStatusEntry>
export function getWatchlistSummary(): WatchlistStatusEntry[]   // sorted Red→Amber→Green
export function getUnreadCount(): number
export function markAllRead(): void                             // mutates unread flags
```

`DEFAULT_WEIGHTS` and `DEFAULT_THRESHOLDS` also exported (Settings reads them as initial state).

---

## WatchlistTab Component

**File:** `src/app/components/counterparties/WatchlistTab.tsx`

Props: `{ lesseeId: string }`

### Layout (top → bottom)

**1. Status header**
- Large RAG badge (Red/Amber/Green) + score (e.g. "82 / 100") + "Last changed: Feb '26"
- Sub-line: primary trigger signal name

**2. Signal grid (5 cards, 2–3 column responsive)**
Each card:
- Signal label (e.g. "Payment Lateness")
- Raw value display (e.g. "45 DPD")
- 12-month sparkline (AreaChart 56px height, no axes) — colour matches signal risk level
- Contribution bar: `signal × weight / 100` shown as labelled number (e.g. "+26.3 pts")

**3. Audit log table**
Columns: `Timestamp | Status (RAG badge) | Score | Triggered by | Evidence`
- Evidence column: inline list of signal values at time of change
- Pre-populated from engine data

---

## Dashboard Changes

**Replace:** `const watchlistItems = [...]` hardcoded array

**With:** `import { getWatchlistSummary, getUnreadCount, markAllRead } from "../components/counterparties/watchlistEngine"`

**Click-through:** Each watchlist row gets `onClick` → `navigate("/counterparties")`. Since Counterparties page manages selected lessee via local state, we navigate with a URL query param `?lessee=INDIGO` and Counterparties reads it on mount to pre-select.

**Unread badge:** Watchlist card header shows red dot + count when `getUnreadCount() > 0`. "Mark all read" button clears it.

---

## Settings → "Alerts" Tab

New tab added to the existing left-nav tabs array: `{ id: "alerts", label: "Alerts", icon: Bell }`.

### Layout

**Signal Weight Configuration card:**
- 5 sliders, one per signal, each 0–100
- Live sum display: "Total weight: 100 / 100" — amber warning if ≠ 100
- "Reset to defaults" button

**Threshold Configuration card:**
- Two number inputs: Red threshold (default 60), Amber threshold (default 30)
- Preview: shows what current portfolio statuses would be at these thresholds

**Notification Panel card** (`"Alert Inbox"`)
- Lists all current Red/Amber status entries as alert rows
- Each row: RAG dot · lessee name · trigger · date · "Mark read" button
- Unread rows: `#FFFBEB` background; read: `#FFFFFF`
- "Mark all read" button in card header
- Simulated — state lives in React `useState`, not persisted

---

## Styling Conventions

- Inline `style={{}}` throughout — no CSS modules
- Oxford Blue `#002147` primary
- RAG colours: Red `#B91C1C`, Amber `#B45309`, Green `#15803D`
- RAG backgrounds: Red `rgba(185,28,28,0.1)`, Amber `rgba(180,83,9,0.1)`, Green `rgba(21,128,61,0.1)`
- Sparklines: stroke colour matches RAG of that signal's current value (≥60 risk = red, ≥30 = amber, else green)
- Unread alert row background: `#FFFBEB`

---

## Success Criteria

1. `npm run build` zero errors
2. Dashboard watchlist renders from computed engine data (no static array)
3. Clicking a Dashboard watchlist row navigates to `/counterparties?lessee=<ID>` and pre-selects lessee
4. Unread badge shows count; "Mark all read" clears it
5. All 6 lessees have "Watchlist" as 7th tab; signal cards + sparklines render correctly
6. Audit log shows pre-populated history with correct RAG transitions
7. Settings "Alerts" tab: weight sliders update, sum warning fires if ≠ 100, threshold preview updates
8. Notification panel lists Red/Amber lessees; "Mark read" works per-row and globally
9. Emirates shows all-green signals; Aeromexico shows all-red

---

## Out of Scope

- Persisting weight/threshold config to localStorage or backend
- Real-time signal refresh / websocket
- Email dispatch (notification panel is in-app only)
- More than 6 lessees
- URL routing for lessee pre-selection beyond `?lessee=` query param read on mount
