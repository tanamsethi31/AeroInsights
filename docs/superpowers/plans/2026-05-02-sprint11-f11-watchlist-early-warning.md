# Sprint 11 F11 — Watchlist & Early Warning System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Dashboard's static watchlist with a computed signal engine; add a "Watchlist" tab to every lessee profile showing signal sparklines and audit log; add an Alerts tab to Settings with configurable weights, thresholds, and a notification panel.

**Architecture:** Pure-TS `watchlistEngine.ts` owns all signal data and computation (no React). `WatchlistTab.tsx` is a zero-dependency named export that reads from the engine. Dashboard and Settings each maintain their own `readIds` state for the simulated "mark read" behaviour.

**Tech Stack:** React 18, TypeScript, Recharts `AreaChart`/`Area`, Lucide icons, inline styles.

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `src/app/components/counterparties/watchlistEngine.ts` |
| **Create** | `src/app/components/counterparties/WatchlistTab.tsx` |
| **Modify** | `src/app/components/counterparties/LesseeProfilePanel.tsx` |
| **Modify** | `src/app/pages/Counterparties.tsx` |
| **Modify** | `src/app/pages/Dashboard.tsx` |
| **Modify** | `src/app/pages/Settings.tsx` |

---

### Task 1: Create `watchlistEngine.ts` — types, signal data, computation

**Files:**
- Create: `src/app/components/counterparties/watchlistEngine.ts`

Context: Pure TypeScript module — no React imports. All 6 lessees get full signal snapshots. IDs match `LesseeId` in `LesseeProfilePanel.tsx`: `"INDIGO" | "AEROMEX" | "SRILNKN" | "AZUL" | "TRANSATCA" | "EMIRATES"`.

- [ ] **Step 1: Create the file with types and constants**

```ts
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
```

- [ ] **Step 2: Add signal data for INDIGO and AEROMEX**

Append to the file:

```ts
// ─── Raw signal data ─────────────────────────────────────────────────────────
// Contributions computed with DEFAULT_WEIGHTS.

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
```

- [ ] **Step 3: Add signal data for SRILNKN, AZUL, TRANSATCA, EMIRATES**

Append to the file:

```ts
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
```

- [ ] **Step 4: Add audit log data and assemble `WATCHLIST_DATA`**

Append to the file:

```ts
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
```

- [ ] **Step 5: Verify build passes**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`. If TypeScript errors, most likely cause is a typo in a `SignalKey` string literal — check all 5 keys match the `SignalKey` union exactly.

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/counterparties/watchlistEngine.ts && git commit -m "$(cat <<'EOF'
feat(f11): add watchlistEngine — signal data, computation, audit log for all 6 lessees

Adds types, buildSignals helper, per-lessee signal snapshots (paymentLateness,
scheduleQoQ, ratingChange, ctcWatchlist, newsKeywordHits), audit log entries,
WATCHLIST_DATA record, and getWatchlistSummary() export.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create `WatchlistTab.tsx` — signal grid + sparklines + audit log

**Files:**
- Create: `src/app/components/counterparties/WatchlistTab.tsx`

Context: Named export. Takes `{ lesseeId: string }`. Reads `WATCHLIST_DATA[lesseeId]` from the engine. Uses `AreaChart`/`Area`/`ResponsiveContainer` from recharts (already a project dependency). Inline styles only — no CSS modules.

- [ ] **Step 1: Create the component**

```tsx
// src/app/components/counterparties/WatchlistTab.tsx
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Card } from "../ui/Card";
import { WATCHLIST_DATA, type SignalSnapshot, type WatchlistAuditEntry } from "./watchlistEngine";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ragColor(status: "green" | "amber" | "red"): string {
  return status === "green" ? "#15803D" : status === "amber" ? "#B45309" : "#B91C1C";
}
function ragBg(status: "green" | "amber" | "red"): string {
  return status === "green" ? "rgba(21,128,61,0.1)" : status === "amber" ? "rgba(180,83,9,0.1)" : "rgba(185,28,28,0.1)";
}
function signalRiskStatus(value: number): "green" | "amber" | "red" {
  if (value >= 60) return "red";
  if (value >= 30) return "amber";
  return "green";
}

// ─── Signal Card ──────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: SignalSnapshot }) {
  const riskSt = signalRiskStatus(signal.value);
  const sc = ragColor(riskSt);
  const bg = ragBg(riskSt);
  const sparkData = signal.trend.map((v, i) => ({ i, v }));

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>{signal.label}</span>
        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: sc, background: bg, borderRadius: "4px", padding: "0.1rem 0.375rem", flexShrink: 0 }}>
          {signal.value}
        </span>
      </div>
      <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "0.375rem" }}>{signal.rawDisplay}</div>
      <ResponsiveContainer width="100%" height={48}>
        <AreaChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`wl-grad-${signal.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={sc} stopOpacity={0.3} />
              <stop offset="95%" stopColor={sc} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={sc} strokeWidth={1.5} fill={`url(#wl-grad-${signal.key})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ fontSize: "0.6875rem", color: "#64748B", marginTop: "0.25rem" }}>
        Contribution: <strong style={{ color: "#0F172A" }}>+{signal.contribution.toFixed(1)} pts</strong>
      </div>
    </div>
  );
}

// ─── Audit Row ────────────────────────────────────────────────────────────────

function AuditRow({ entry, i }: { entry: WatchlistAuditEntry; i: number }) {
  return (
    <tr style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
      <td style={{ padding: "0.5rem 0.75rem", color: "#94A3B8", whiteSpace: "nowrap", fontSize: "0.75rem" }}>
        {entry.timestamp.slice(0, 10)}
      </td>
      <td style={{ padding: "0.5rem 0.75rem" }}>
        <span style={{
          fontSize: "0.75rem", fontWeight: 600,
          color: ragColor(entry.toStatus),
          background: ragBg(entry.toStatus),
          borderRadius: "4px", padding: "0.1rem 0.4rem",
        }}>
          {entry.toStatus.charAt(0).toUpperCase() + entry.toStatus.slice(1)}
        </span>
      </td>
      <td style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0F172A", fontSize: "0.8125rem" }}>
        {entry.score.toFixed(1)}
      </td>
      <td style={{ padding: "0.5rem 0.75rem", color: "#0F172A", fontSize: "0.8125rem" }}>{entry.triggeredBy}</td>
      <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontSize: "0.75rem", maxWidth: "260px" }}>{entry.evidence}</td>
    </tr>
  );
}

// ─── WatchlistTab ─────────────────────────────────────────────────────────────

export function WatchlistTab({ lesseeId }: { lesseeId: string }) {
  const entry = WATCHLIST_DATA[lesseeId];
  if (!entry) return null;

  const sc = ragColor(entry.status);
  const bg = ragBg(entry.status);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Status header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: bg, border: `1px solid ${sc}33`, borderRadius: "0.5rem", padding: "1rem" }}>
        <span style={{
          fontSize: "1.5rem", fontWeight: 700, color: sc,
          background: `${sc}18`, borderRadius: "0.5rem", padding: "0.5rem 1rem",
          fontVariantNumeric: "tabular-nums",
        }}>
          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
        </span>
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>
            Score: <span style={{ color: sc }}>{entry.score.toFixed(1)}</span> / 100
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
            Last changed: {entry.lastChanged} · Triggered by: <strong>{entry.trigger}</strong>
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#475569", marginTop: "0.125rem" }}>{entry.reason}</div>
        </div>
      </div>

      {/* Signal grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
        {entry.signals.map(s => <SignalCard key={s.key} signal={s} />)}
      </div>

      {/* Audit log */}
      <Card title="Status Change Audit Log" subtitle="Immutable record of every watchlist status change with evidence snapshot">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "#F4F5F7" }}>
                {["Date", "Status", "Score", "Triggered By", "Evidence Snapshot"].map(h => (
                  <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entry.auditLog.map((a, i) => <AuditRow key={a.id} entry={a} i={i} />)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`. WatchlistTab isn't wired yet so the build just checks the TS compiles — any import errors from watchlistEngine will show here.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/counterparties/WatchlistTab.tsx && git commit -m "$(cat <<'EOF'
feat(f11): add WatchlistTab — signal grid, sparklines, audit log

Named export. Reads from watchlistEngine. 5-signal grid with 12-month
AreaChart sparklines, risk-coded colours, contribution points. Audit log
table shows full status-change history with evidence snapshots.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire WatchlistTab into LesseeProfilePanel + query-param pre-selection in Counterparties

**Files:**
- Modify: `src/app/components/counterparties/LesseeProfilePanel.tsx` (lines ~665 and ~1339)
- Modify: `src/app/pages/Counterparties.tsx`

Context: `LesseeProfilePanel.tsx` currently has `TABS` at line 665. The render for the last tab is at line 1339: `{activeTab === "Behaviour" && ...}`. `Counterparties.tsx` uses local `useState` with `lessees[0]` as default; it needs to read `?lessee=AEROMEX` from the URL on mount and pre-select the matching entry.

- [ ] **Step 1: Add import and wire WatchlistTab in LesseeProfilePanel**

Find:
```tsx
import { ChevronUp, ChevronDown } from "lucide-react";
```

Replace with:
```tsx
import { ChevronUp, ChevronDown } from "lucide-react";
import { WatchlistTab } from "./WatchlistTab";
```

- [ ] **Step 2: Add "Watchlist" to TABS constant**

Find:
```tsx
const TABS = ["Overview", "Leases", "ECL", "Timeline", "Scenarios", "Behaviour"] as const;
type TabKey = typeof TABS[number];
```

Replace with:
```tsx
const TABS = ["Overview", "Leases", "ECL", "Timeline", "Scenarios", "Behaviour", "Watchlist"] as const;
type TabKey = typeof TABS[number];
```

- [ ] **Step 3: Wire the Watchlist render**

Find:
```tsx
        {activeTab === "Behaviour" && <BehaviourTab meta={meta} behaviourEvidence={behaviourEvidence} scoreHistory={scoreHistory} />}
```

Replace with:
```tsx
        {activeTab === "Behaviour" && <BehaviourTab meta={meta} behaviourEvidence={behaviourEvidence} scoreHistory={scoreHistory} />}
        {activeTab === "Watchlist" && <WatchlistTab lesseeId={lesseeId} />}
```

- [ ] **Step 4: Add query-param pre-selection to Counterparties.tsx**

Find:
```tsx
import { useState } from "react";
```

Replace with:
```tsx
import { useState, useEffect } from "react";
import { useLocation } from "react-router";
```

Find:
```tsx
export default function Counterparties() {
  const [selectedLessee, setSelectedLessee] = useState(lessees[0]);
```

Replace with:
```tsx
export default function Counterparties() {
  const location = useLocation();
  const [selectedLessee, setSelectedLessee] = useState(lessees[0]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("lessee");
    if (id) {
      const found = lessees.find(l => l.id === id);
      if (found) setSelectedLessee(found);
    }
  }, [location.search]);
```

- [ ] **Step 5: Verify build passes**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`.

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/counterparties/LesseeProfilePanel.tsx src/app/pages/Counterparties.tsx && git commit -m "$(cat <<'EOF'
feat(f11): wire WatchlistTab as 7th tab; add ?lessee= pre-selection in Counterparties

Adds "Watchlist" to TABS, wires render, imports WatchlistTab.
Counterparties reads ?lessee= query param on mount via useEffect + useLocation.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Update `Dashboard.tsx` — engine data, click-through nav, unread badge

**Files:**
- Modify: `src/app/pages/Dashboard.tsx`

Context: Dashboard currently has a static `watchlistItems` array (lines 36–82) and `watchlistAccessors` (lines 132–137). The watchlist card renders at line ~303 using `sortedWatchlist.map(item => ...)`. Each row already calls `navigate("/counterparties")` (no lessee ID). We replace the static data, add `useState` for `readIds`, add `?lessee=` to the nav call, and add an unread badge to the card header.

- [ ] **Step 1: Add engine import and useState**

Find:
```tsx
import { useNavigate } from "react-router";
```

Replace with:
```tsx
import { useNavigate } from "react-router";
import { getWatchlistSummary } from "../components/counterparties/watchlistEngine";
```

- [ ] **Step 2: Remove static data, add computed data + readIds state**

Find and delete the entire block from:
```tsx
const watchlistItems = [
  {
    id: "W001",
```
through the closing:
```tsx
];
```
(the full 6-item array ending around line 82).

Also find and delete:
```tsx
const watchlistAccessors = {
  lessee: (w: typeof watchlistItems[0]) => w.lessee,
  country: (w: typeof watchlistItems[0]) => w.country,
  status: (w: typeof watchlistItems[0]) => w.status === "red" ? 0 : 1,
  trigger: (w: typeof watchlistItems[0]) => w.trigger,
};
```

In the component function, find:
```tsx
  const { sorted: sortedWatchlist, sortState: watchlistSortState, toggleSort: toggleWatchlistSort } = useSortable(watchlistItems, watchlistAccessors);
```

Replace with:
```tsx
  const watchlistEntries = getWatchlistSummary();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const unreadCount = watchlistEntries.filter(e => e.status !== "green" && !readIds.has(e.lesseeId)).length;
```

- [ ] **Step 3: Update watchlist card header to show unread badge**

Find:
```tsx
      <Card
        title="Watchlist Headlines"
        subtitle="Lessees requiring immediate attention"
        headerRight={
          <button
            onClick={() => navigate("/counterparties")}
```

Replace with:
```tsx
      <Card
        title={
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Watchlist Headlines
            {unreadCount > 0 && (
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "#B91C1C", color: "#FFFFFF", borderRadius: "9999px", padding: "0.1rem 0.4rem", minWidth: "18px", textAlign: "center" }}>
                {unreadCount}
              </span>
            )}
          </span>
        }
        subtitle="Lessees requiring immediate attention"
        headerRight={
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {unreadCount > 0 && (
              <button
                onClick={() => setReadIds(new Set(watchlistEntries.filter(e => e.status !== "green").map(e => e.lesseeId)))}
                style={{ fontSize: "0.75rem", color: "#94A3B8", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => navigate("/counterparties")}
```

Close the new `headerRight` div — find the existing closing tag of headerRight's `<button>`:
```tsx
          >
            View All <ArrowRight size={14} />
          </button>
        }
```

Replace with:
```tsx
          >
            View All <ArrowRight size={14} />
          </button>
          </div>
        }
```

- [ ] **Step 4: Update the table body to use engine data**

Find the `<tbody>` rows section that uses `sortedWatchlist.map`. Replace the entire `{sortedWatchlist.map((item, i) => (` block with `{watchlistEntries.map((item, i) => (`:

Find:
```tsx
            {sortedWatchlist.map((item, i) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: "1px solid #E2E8F0",
                  background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7",
```

Replace with:
```tsx
            {watchlistEntries.map((item, i) => {
              const isUnread = item.status !== "green" && !readIds.has(item.lesseeId);
              return (
              <tr
                key={item.lesseeId}
                style={{
                  borderBottom: "1px solid #E2E8F0",
                  background: isUnread ? "#FFFBEB" : i % 2 === 0 ? "#FFFFFF" : "#F4F5F7",
```

- [ ] **Step 5: Update row cells and click-through nav**

The existing row uses `item.lessee`, `item.country`, `item.trigger`, `item.reason`, `item.updatedAt`. The engine uses `item.lesseeName`, `item.country`, `item.trigger`, `item.reason`, `item.lastChanged`. Update each cell:

Find in the row:
```tsx
                <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>
                  {item.lessee}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{item.country}</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <StatusPill
                    stage={item.status}
                    label={item.status === "red" ? "Red" : "Amber"}
                  />
                </td>
```

Replace with:
```tsx
                <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>
                  {item.lesseeName}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{item.country}</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <StatusPill
                    stage={item.status}
                    label={item.status === "red" ? "Red" : item.status === "amber" ? "Amber" : "Green"}
                  />
                </td>
```

Find:
```tsx
                  {item.updatedAt}
```

Replace with:
```tsx
                  {item.lastChanged}
```

Update the "View Profile" button `onClick` to pass `?lessee=`:

Find:
```tsx
                    onClick={() => navigate("/counterparties")}
```
(inside the row's last `<td>`)

Replace with:
```tsx
                    onClick={() => { setReadIds(prev => new Set([...prev, item.lesseeId])); navigate(`/counterparties?lessee=${item.lesseeId}`); }}
```

- [ ] **Step 6: Close the map correctly**

Find the closing of the map (the `))}` that closes `sortedWatchlist.map`):
```tsx
              </tr>
            ))}
```

Replace with:
```tsx
              </tr>
              );
            })}
```

- [ ] **Step 7: Remove unused `useSortable` import for watchlist if no longer needed**

Check: `useSortable` is still used for scenarios table in Dashboard. If it is, leave the import. If not, remove it. Run:

```bash
grep -n "useSortable\|sortedWatchlist\|watchlistSortState\|toggleWatchlistSort" /Users/tanamsethi/Downloads/Aeroinsights/src/app/pages/Dashboard.tsx
```

Remove any remaining references to `sortedWatchlist`, `watchlistSortState`, `toggleWatchlistSort` if they appear (they should all be gone after Step 2).

- [ ] **Step 8: Verify build passes**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`. Common error: `item.lessee` still referenced — search and fix.

- [ ] **Step 9: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Dashboard.tsx && git commit -m "$(cat <<'EOF'
feat(f11): Dashboard watchlist from engine — unread badge, click-through nav

Replaces static watchlistItems with getWatchlistSummary(). Adds unread
badge (red count pill) on card header. Row click navigates to
/counterparties?lessee=<ID> and marks that lessee read. Mark-all-read button
clears unread state.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add "Alerts" tab to `Settings.tsx`

**Files:**
- Modify: `src/app/pages/Settings.tsx`

Context: `Settings.tsx` line 6 has lucide imports; line 8 has the `tabs` array with 5 entries. We add `Bell` to the lucide import, a 6th tab object, and the Alerts tab content with weight sliders, threshold inputs, threshold preview, and a notification panel.

- [ ] **Step 1: Add Bell import and new tab entry**

Find:
```tsx
import { Building2, Users, Database, Sliders, ClipboardList, Save, Plus, Trash2, Eye, EyeOff, Check } from "lucide-react";
```

Replace with:
```tsx
import { Building2, Users, Database, Sliders, ClipboardList, Save, Plus, Trash2, Eye, EyeOff, Check, Bell } from "lucide-react";
import { getWatchlistSummary, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS, computeScore, computeStatus, type SignalKey } from "../components/counterparties/watchlistEngine";
```

Find:
```tsx
const tabs = [
  { id: "tenant", label: "Tenant", icon: Building2 },
  { id: "users", label: "Users & RBAC", icon: Users },
  { id: "datasources", label: "Data Sources", icon: Database },
  { id: "model", label: "Model Params", icon: Sliders },
  { id: "audit", label: "Audit Log", icon: ClipboardList },
];
```

Replace with:
```tsx
const tabs = [
  { id: "tenant", label: "Tenant", icon: Building2 },
  { id: "users", label: "Users & RBAC", icon: Users },
  { id: "datasources", label: "Data Sources", icon: Database },
  { id: "model", label: "Model Params", icon: Sliders },
  { id: "audit", label: "Audit Log", icon: ClipboardList },
  { id: "alerts", label: "Alerts", icon: Bell },
];
```

- [ ] **Step 2: Add Alerts state to the component**

Find:
```tsx
  const [saved, setSaved] = useState(false);
  const [weights, setWeights] = useState({ baseline: 60, adverse: 25, severe: 15 });
```

Replace with:
```tsx
  const [saved, setSaved] = useState(false);
  const [weights, setWeights] = useState({ baseline: 60, adverse: 25, severe: 15 });
  const [signalWeights, setSignalWeights] = useState({ ...DEFAULT_WEIGHTS });
  const [thresholds, setThresholds] = useState({ ...DEFAULT_THRESHOLDS });
  const [alertReadIds, setAlertReadIds] = useState<Set<string>>(new Set());

  const weightSum = Object.values(signalWeights).reduce((a, b) => a + b, 0);
  const watchlistEntries = getWatchlistSummary();
  const alertEntries = watchlistEntries.filter(e => e.status !== "green");
```

- [ ] **Step 3: Add the Alerts tab render block**

Find the last tab render block in the return. Look for a pattern like:
```tsx
        {activeTab === "audit" && (
```
and find its closing `)}`. After that closing `)}`, insert:

```tsx
        {activeTab === "alerts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Signal Weight Configuration */}
            <Card title="Signal Weight Configuration" subtitle="Adjust the relative weight of each early-warning signal (must sum to 100)">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {(Object.keys(signalWeights) as SignalKey[]).map(key => {
                  const labels: Record<SignalKey, string> = {
                    paymentLateness: "Payment Lateness",
                    scheduleQoQ: "Schedule Cancellations (QoQ)",
                    ratingChange: "Rating Change",
                    ctcWatchlist: "AWG CTC Watchlist",
                    newsKeywordHits: "News Keyword Hits",
                  };
                  return (
                    <div key={key}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#475569" }}>{labels[key]}</label>
                        <span style={{ fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#0F172A" }}>{signalWeights[key]}</span>
                      </div>
                      <input
                        type="range" min={0} max={100} step={1} value={signalWeights[key]}
                        onChange={e => setSignalWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={{ width: "100%", accentColor: "#002147" }}
                      />
                    </div>
                  );
                })}
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem",
                  background: weightSum === 100 ? "rgba(21,128,61,0.08)" : "rgba(180,83,9,0.1)",
                  borderRadius: "0.375rem", fontSize: "0.8125rem",
                  color: weightSum === 100 ? "#15803D" : "#B45309", fontWeight: 600,
                }}>
                  {weightSum === 100 ? "✓" : "⚠"} Total weight: {weightSum} / 100
                  {weightSum !== 100 && <span style={{ fontWeight: 400 }}>— adjust sliders to reach exactly 100</span>}
                </div>
                <button
                  onClick={() => setSignalWeights({ ...DEFAULT_WEIGHTS })}
                  style={{ alignSelf: "flex-start", fontSize: "0.8125rem", color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.375rem 0.875rem", cursor: "pointer" }}
                >
                  Reset to defaults
                </button>
              </div>
            </Card>

            {/* Threshold Configuration */}
            <Card title="Threshold Configuration" subtitle="Score thresholds for Red and Amber status">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {[
                    { label: "Red threshold (score ≥)", key: "red" as const, color: "#B91C1C" },
                    { label: "Amber threshold (score ≥)", key: "amber" as const, color: "#B45309" },
                  ].map(({ label, key, color }) => (
                    <div key={key}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>{label}</label>
                      <input
                        type="number" min={0} max={100}
                        value={thresholds[key]}
                        onChange={e => setThresholds(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={{ width: "100%", padding: "0.5rem 0.75rem", border: `1px solid ${color}44`, borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", boxSizing: "border-box" as const, fontVariantNumeric: "tabular-nums" }}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.5rem" }}>Preview with current thresholds</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {watchlistEntries.map(e => {
                      const previewScore = computeScore(e.signals, signalWeights);
                      const previewStatus = computeStatus(previewScore, thresholds);
                      const c = previewStatus === "green" ? "#15803D" : previewStatus === "amber" ? "#B45309" : "#B91C1C";
                      const bg = previewStatus === "green" ? "rgba(21,128,61,0.08)" : previewStatus === "amber" ? "rgba(180,83,9,0.08)" : "rgba(185,28,28,0.08)";
                      return (
                        <div key={e.lesseeId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.375rem 0.5rem", background: bg, borderRadius: "0.25rem" }}>
                          <span style={{ fontSize: "0.8125rem", color: "#0F172A" }}>{e.lesseeName}</span>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: c }}>
                            {previewStatus.charAt(0).toUpperCase() + previewStatus.slice(1)} ({previewScore.toFixed(0)})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>

            {/* Alert Inbox */}
            <Card
              title="Alert Inbox"
              subtitle="Active watchlist alerts requiring review"
              headerRight={
                alertEntries.some(e => !alertReadIds.has(e.lesseeId)) ? (
                  <button
                    onClick={() => setAlertReadIds(new Set(alertEntries.map(e => e.lesseeId)))}
                    style={{ fontSize: "0.75rem", color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.25rem 0.75rem", cursor: "pointer" }}
                  >
                    Mark all read
                  </button>
                ) : undefined
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {alertEntries.length === 0 ? (
                  <div style={{ padding: "1rem", textAlign: "center" as const, color: "#94A3B8", fontSize: "0.8125rem" }}>No active alerts</div>
                ) : alertEntries.map(e => {
                  const isRead = alertReadIds.has(e.lesseeId);
                  const c = e.status === "red" ? "#B91C1C" : "#B45309";
                  const bg = isRead ? "#FFFFFF" : "#FFFBEB";
                  return (
                    <div key={e.lesseeId} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem", background: bg, border: "1px solid #E2E8F0", borderRadius: "0.5rem" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>{e.lesseeName}</div>
                        <div style={{ fontSize: "0.75rem", color: "#475569" }}>{e.trigger} · {e.reason}</div>
                        <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>Last changed: {e.lastChanged}</div>
                      </div>
                      {!isRead && (
                        <button
                          onClick={() => setAlertReadIds(prev => new Set([...prev, e.lesseeId]))}
                          style={{ fontSize: "0.75rem", color: "#64748B", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.25rem 0.625rem", cursor: "pointer", flexShrink: 0 }}
                        >
                          Mark read
                        </button>
                      )}
                      {isRead && (
                        <span style={{ fontSize: "0.75rem", color: "#94A3B8", flexShrink: 0 }}>Read</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
```

- [ ] **Step 4: Verify build passes**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`. Common errors: `computeScore`/`computeStatus` not exported from engine — check `watchlistEngine.ts` exports both. `SignalKey` import needs `type` keyword if isolatedModules is on.

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Settings.tsx && git commit -m "$(cat <<'EOF'
feat(f11): add Alerts tab to Settings — signal weights, thresholds, notification panel

Adds 6th Settings tab with Bell icon. Signal weight sliders (sum validation),
threshold inputs with live preview of portfolio status changes, Alert Inbox
with per-row and mark-all-read controls. Unread rows highlighted #FFFBEB.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Per-lessee RAG status from configurable rule-set: `computeScore` + `computeStatus` in `watchlistEngine.ts`, weights/thresholds configurable in Settings Alerts tab
- ✅ Signal breakdown panel: `WatchlistTab` — 5 signal cards with sparklines, contribution points
- ✅ Audit log with evidence snapshot: `WatchlistAuditEntry.evidence` string on each entry
- ✅ Alert configuration per user: Settings Alerts tab weight sliders + threshold inputs
- ✅ In-app notification panel: Alert Inbox in Settings, per-row + mark-all-read
- ✅ Dashboard widget from computed status: Task 4 replaces static array with `getWatchlistSummary()`
- ✅ Click-through nav: row click → `/counterparties?lessee=<ID>` (Task 4 Step 5)
- ✅ Query-param pre-selection: Counterparties `useEffect` (Task 3 Step 4)
- ✅ Unread badge: red pill in Dashboard card header (Task 4 Step 3)
- ✅ Emirates all-green, Aeromexico all-red: verified in signal data (scores 4 and 91)

**Placeholder scan:** None found. All code blocks complete.

**Type consistency:**
- `SignalKey` defined in Task 1 Step 1, used in `buildSignals` (Task 1 Step 2), `SignalWeights` state in Settings (Task 5 Step 2), and `SIGNAL_LABELS` — all consistent ✓
- `WatchlistStatusEntry.lesseeId` used in Dashboard map key (Task 4 Step 4) and Counterparties nav (Task 4 Step 5) ✓
- `computeScore(signals, weights)` — signature matches usage in Settings preview (Task 5 Step 3) ✓
- `entry.lesseeName` in Dashboard (Task 4 Step 5) matches field on `WatchlistStatusEntry` (Task 1 Step 1) ✓
