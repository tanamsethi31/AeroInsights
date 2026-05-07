# Intelligence 2.0 — Expert Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed a permanently available AI analyst agent into the Aeroinsights platform — portfolio-contextualised, domain-expert, streaming, agentic.

**Architecture:** A fixed overlay panel (AgentPanel) accessible from a circular button in the header (AgentButton), backed by Azure OpenAI streaming with client-side tool execution. Portfolio context is pre-computed at session start and injected into every system prompt. Five tools handle specific queries. Cross-page navigation and form pre-population are mediated through AgentContext state with mandatory user confirmation.

**Tech Stack:** React 18, TypeScript, Azure OpenAI streaming API (SSE), lucide-react (Zap already imported in project), Auth0 (`useAuth0`), react-router (`useLocation`/`useNavigate`), localStorage for usage tracking. Zero new npm dependencies.

---

## File Structure

**New files:**

| File | Responsibility |
|---|---|
| `src/app/utils/eclCalculator.ts` | Shared ECL computation — ScenarioInputs, BASE_ECL, ZERO_INPUTS, computeECL, computeStages |
| `src/app/contexts/AgentContext.tsx` | Panel state, chat history, page context, usage counter, pendingInputs, hasNewSignal |
| `src/app/components/agent/portfolioSummary.ts` | `buildPortfolioSummary()` → ~400-token string for system prompt |
| `src/app/components/agent/agentTools.ts` | 5 OpenAI tool definitions + executor functions + MOCK_LEASES + MOCK_SCENARIO_RUNS |
| `src/app/services/agentService.ts` | `streamAgentResponse()` — SSE parsing, tool-call accumulation, recursive second pass |
| `src/app/components/agent/AgentButton.tsx` | 40px circular trigger with pulse animation and notification dot |
| `src/app/components/agent/AgentMessage.tsx` | Message renderer — text, tables, nav links, tool indicators, action confirmation cards |
| `src/app/components/agent/AgentSuggestions.tsx` | Route-to-chip static map, shown when chat history is empty |
| `src/app/components/agent/AgentPanel.tsx` | Full 420px overlay — header, context strip, suggestions, chat, input, footer |

**Modified files:**

| File | Change |
|---|---|
| `src/app/pages/Scenarios.tsx` | Remove inline ScenarioInputs/computeECL/computeStages; import from eclCalculator.ts; read pendingInputs on Custom Builder mount |
| `src/app/components/layout/Layout.tsx` | Wrap contents with AgentProvider; render AgentPanel as fixed overlay sibling to SidebarInset |
| `src/app/components/layout/Header.tsx` | Add AgentButton between search bar div and right-side controls |

---

### Task 1: Extract ECL Calculator

**Files:**
- Create: `src/app/utils/eclCalculator.ts`
- Modify: `src/app/pages/Scenarios.tsx` lines ~40–100

- [ ] **Step 1: Create `src/app/utils/eclCalculator.ts`**

```typescript
// src/app/utils/eclCalculator.ts

export interface ScenarioInputs {
  gdpDelta: number;        // e.g. −0.02 = −2%
  rpkDelta: number;        // e.g. −0.25 = −25%
  fuelDelta: number;       // e.g. 0.40 = +40%
  fxDelta: number;         // e.g. −0.15 = −15%
  rateDelta: number;       // e.g. 0.0075 = +75 bps
  assetValueDelta: number; // e.g. −0.10 = −10%
  pdS2Multi: number;       // e.g. 1.4
  pdS3Multi: number;       // e.g. 1.2
}

export interface StageDistribution {
  s1: number;
  s2: number;
  s3: number;
}

export const BASE_ECL = 47.2;

export const ZERO_INPUTS: ScenarioInputs = {
  gdpDelta: 0,
  rpkDelta: 0,
  fuelDelta: 0,
  fxDelta: 0,
  rateDelta: 0,
  assetValueDelta: 0,
  pdS2Multi: 1.0,
  pdS3Multi: 1.0,
};

export function computeECL(inputs: ScenarioInputs): number {
  const delta =
    Math.min(0, inputs.gdpDelta) * -250 +
    Math.min(0, inputs.rpkDelta) * -48 +
    Math.max(0, inputs.fuelDelta) * 28 +
    Math.min(0, inputs.fxDelta) * -32 +
    Math.max(0, inputs.rateDelta) * 14 +
    Math.min(0, inputs.assetValueDelta) * -52 +
    (inputs.pdS2Multi - 1.0) * 8.5 +
    (inputs.pdS3Multi - 1.0) * 18.2;
  return Math.max(BASE_ECL * 0.3, BASE_ECL + delta);
}

export function computeStages(ecl: number, inputs: ScenarioInputs): StageDistribution {
  const stress = Math.max(
    0,
    Math.min(0, inputs.rpkDelta) * -2 +
      (inputs.pdS3Multi - 1) * 1.5 +
      Math.min(0, inputs.assetValueDelta) * -1.5
  ) / 3;
  const s1Share = Math.max(0.05, 0.178 - stress * 0.13);
  const s3Share = Math.min(0.70, 0.365 + stress * 0.25);
  const s2Share = Math.max(0.05, 1 - s1Share - s3Share);
  return { s1: ecl * s1Share, s2: ecl * s2Share, s3: ecl * s3Share };
}
```

- [ ] **Step 2: Update `src/app/pages/Scenarios.tsx` — remove inline definitions, add import**

Remove lines ~40–100 (the `ScenarioInputs` interface, `BASE_ECL` constant, `ZERO_INPUTS` constant, `computeECL` function, `computeStages` function) and add the following import directly after `import { SCENARIO_CALIBRATION } from "../data/intelligenceData";`:

```typescript
import {
  ScenarioInputs,
  StageDistribution,
  BASE_ECL,
  ZERO_INPUTS,
  computeECL,
  computeStages,
} from "../utils/eclCalculator";
```

- [ ] **Step 3: Validate**

Run: `node_modules/.bin/vite build`
Expected: exit 0, no TypeScript errors. If `StageDistribution` is referenced in a type annotation in Scenarios.tsx, confirm it is included in the import list.

- [ ] **Step 4: Commit**

```bash
git add src/app/utils/eclCalculator.ts src/app/pages/Scenarios.tsx
git commit -m "refactor: extract computeECL and computeStages into shared eclCalculator utility"
```

---

### Task 2: Agent Context

**Files:**
- Create: `src/app/contexts/AgentContext.tsx`

- [ ] **Step 1: Create `src/app/contexts/AgentContext.tsx`**

```typescript
// src/app/contexts/AgentContext.tsx
import * as React from "react";
import { useLocation } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface AgentUsage {
  date: string;   // "2026-05-07"
  count: number;
  userId: string;
}

interface AgentContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isMinimized: boolean;
  setIsMinimized: (v: boolean) => void;
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  pageContext: string;
  usage: AgentUsage;
  incrementUsage: () => void;
  pendingInputs: Record<string, number> | null;
  setPendingInputs: (inputs: Record<string, number> | null) => void;
  hasNewSignal: boolean;
  setHasNewSignal: (v: boolean) => void;
}

// ─── Page context map ───────────────────────────────────────────────────────────

const PAGE_CONTEXT_MAP: Record<string, string> = {
  "/": "Dashboard — portfolio KPIs, ECL trend, market signals",
  "/portfolio": "Portfolio — overview",
  "/portfolio/register": "Portfolio > Leases — full lease register",
  "/portfolio/analytics": "Portfolio > Concentration — analytics view",
  "/portfolio/aircraft-mix": "Portfolio > Aircraft — fleet mix",
  "/scenarios": "Scenarios — library and history",
  "/scenarios/library": "Scenarios > Library — scenario templates",
  "/scenarios/run": "Scenarios > Custom Builder — scenario parameter form with sliders",
  "/scenarios/history": "Scenarios > Run History — past scenario runs",
  "/deals": "Deals — deal analysis overview",
  "/deals/generator": "Deals > Lease Generator — lease pricing tool",
  "/deals/rack-stack": "Deals > Rack & Stack — deal comparison",
  "/deals/exit-npv": "Deals > Exit NPV — asset exit valuation",
  "/risk-ecl": "Risk & ECL — overview",
  "/risk-ecl/summary": "Risk & ECL > ECL Overview — ECL summary dashboard",
  "/risk-ecl/migration": "Risk & ECL > Stage Migration — migration matrix",
  "/risk-ecl/waterfall": "Risk & ECL > Sensitivity — waterfall analysis",
  "/intelligence": "Aero Intelligence — macro signals, lessee radar, deal feed, jurisdiction watch",
  "/intelligence/signals": "Aero Intelligence > Macro Signals — market signal feed",
  "/intelligence/lessee-radar": "Aero Intelligence > Lessee Radar — per-lessee risk scores",
  "/intelligence/deal-feed": "Aero Intelligence > Deal Feed — recent market deals",
  "/intelligence/jx-watch": "Aero Intelligence > Jurisdiction Watch — jurisdiction events",
  "/counterparties": "Counterparties — lessee watchlist and profiles",
  "/jurisdictions": "Jurisdictions — Cape Town scores, enforcement data",
  "/reports": "Reports — templates and export history",
  "/reports/templates": "Reports > Templates — report template library",
  "/reports/scheduled": "Reports > Scheduled — scheduled report configuration",
  "/reports/export-log": "Reports > Export History — past exports",
  "/settings/ecl": "Settings > Model Params — SICR triggers, concentration policy rules",
  "/settings/firm": "Settings > Tenant — firm configuration",
  "/settings/users": "Settings > Users & RBAC — user and role management",
  "/settings/data-sources": "Settings > Data Sources — data feed configuration",
};

function getPageContext(pathname: string): string {
  if (PAGE_CONTEXT_MAP[pathname]) return PAGE_CONTEXT_MAP[pathname];
  for (const [key, val] of Object.entries(PAGE_CONTEXT_MAP)) {
    if (key !== "/" && pathname.startsWith(key)) return val;
  }
  return "Aeroinsights Platform";
}

// ─── Usage storage ──────────────────────────────────────────────────────────────

const USAGE_KEY = "aeroinsights:agent_usage";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadUsage(userId: string): AgentUsage {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) {
      const parsed: AgentUsage = JSON.parse(raw);
      if (parsed.userId === userId && parsed.date === todayISO()) return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return { date: todayISO(), count: 0, userId };
}

function saveUsage(usage: AgentUsage): void {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore storage errors
  }
}

// ─── Context ────────────────────────────────────────────────────────────────────

const AgentContext = React.createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuth0();
  const userId = user?.sub ?? "anonymous";

  const [isOpen, setIsOpenRaw] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [pendingInputs, setPendingInputs] = React.useState<Record<string, number> | null>(null);
  const [hasNewSignal, setHasNewSignal] = React.useState(true); // true on first load to show notification dot
  const [usage, setUsage] = React.useState<AgentUsage>(() => loadUsage(userId));

  const pageContext = React.useMemo(
    () => getPageContext(location.pathname),
    [location.pathname]
  );

  const setIsOpen = React.useCallback((open: boolean) => {
    setIsOpenRaw(open);
    if (open) setHasNewSignal(false);
  }, []);

  const addMessage = React.useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateLastMessage = React.useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    },
    []
  );

  const clearMessages = React.useCallback(() => setMessages([]), []);

  const incrementUsage = React.useCallback(() => {
    setUsage((prev) => {
      const updated: AgentUsage = { ...prev, count: prev.count + 1 };
      saveUsage(updated);
      return updated;
    });
  }, []);

  return (
    <AgentContext.Provider
      value={{
        isOpen,
        setIsOpen,
        isMinimized,
        setIsMinimized,
        messages,
        addMessage,
        updateLastMessage,
        clearMessages,
        pageContext,
        usage,
        incrementUsage,
        pendingInputs,
        setPendingInputs,
        hasNewSignal,
        setHasNewSignal,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent(): AgentContextValue {
  const ctx = React.useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}
```

- [ ] **Step 2: Validate**

Run: `node_modules/.bin/vite build`
Expected: exit 0. AgentProvider is not yet wired into the app tree, so no runtime errors possible at this stage.

- [ ] **Step 3: Commit**

```bash
git add src/app/contexts/AgentContext.tsx
git commit -m "feat: add AgentContext with panel state, chat history, usage tracking, and pendingInputs"
```

---

### Task 3: Portfolio Summary Builder

**Files:**
- Create: `src/app/components/agent/portfolioSummary.ts`

- [ ] **Step 1: Create `src/app/components/agent/portfolioSummary.ts`**

```typescript
// src/app/components/agent/portfolioSummary.ts
import {
  LESSEE_RADAR,
  MACRO_SIGNALS,
  DEAL_FEED,
} from "../../data/intelligenceData";
import {
  DEFAULT_POLICY_RULES,
  PEAK_CONCENTRATIONS,
} from "../../data/concentrationPolicy";
import { BASE_ECL } from "../../utils/eclCalculator";

const M = 1_000_000;

function fmt(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}bn`;
  return `$${(usd / M).toFixed(0)}m`;
}

export function buildPortfolioSummary(): string {
  // Book stats
  const totalExposure = LESSEE_RADAR.reduce((s, e) => s + e.exposureUSD, 0);
  const lesseeCount = LESSEE_RADAR.length;
  const eclPct = ((BASE_ECL * M) / totalExposure * 100).toFixed(1);

  const s3Lessees = LESSEE_RADAR.filter((e) => e.stage === "3");
  const s2Lessees = LESSEE_RADAR.filter((e) => e.stage === "2");
  const s1Lessees = LESSEE_RADAR.filter((e) => e.stage === "1");

  // Policy breaches
  const breaches = DEFAULT_POLICY_RULES
    .filter((r) => r.enabled)
    .map((r) => {
      const peak = PEAK_CONCENTRATIONS[r.dimension];
      return peak.pct > r.limitPct
        ? `${r.dimension} (${peak.name}: ${peak.pct}% vs ${r.limitPct}% limit)`
        : null;
    })
    .filter(Boolean) as string[];

  // High-severity signals
  const highSignals = MACRO_SIGNALS
    .filter((s) => s.severity === "high")
    .map((s) => `${s.name}: ${s.changeLabel}`);

  // Recent deal feed (top 4)
  const recentDeals = DEAL_FEED.slice(0, 4).map(
    (d) => `${d.headline} (${d.hoursAgo}h ago)`
  );

  const lines: string[] = [
    `PORTFOLIO SUMMARY (as at session start):`,
    `Book: ${fmt(totalExposure)} across ${lesseeCount} lessees. ECL: $${BASE_ECL}m (${eclPct}% of book).`,
    ``,
    `Stage 3 (credit-impaired, ${s3Lessees.length} lessees):`,
    ...s3Lessees.map((e) => `  - ${e.lesseeName} (${e.country}): ${fmt(e.exposureUSD)}`),
    ``,
    `Stage 2 (SICR triggered, ${s2Lessees.length} lessees):`,
    ...s2Lessees.map((e) => `  - ${e.lesseeName} (${e.country}): ${fmt(e.exposureUSD)}`),
    ``,
    `Stage 1 (performing, ${s1Lessees.length} lessees):`,
    ...s1Lessees.map((e) => `  - ${e.lesseeName} (${e.country}): ${fmt(e.exposureUSD)}`),
    ``,
    breaches.length > 0
      ? `Active policy breaches: ${breaches.join("; ")}.`
      : `No active policy breaches.`,
    ``,
    `High-severity market signals:`,
    ...(highSignals.length > 0
      ? highSignals.map((s) => `  - ${s}`)
      : ["  - None currently"]),
    ``,
    `Recent deal feed:`,
    ...recentDeals.map((d) => `  - ${d}`),
  ];

  return lines.join("\n");
}
```

- [ ] **Step 2: Validate**

Run: `node_modules/.bin/vite build`
Expected: exit 0. The function is not yet called anywhere; this validates exports and imports only.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/agent/portfolioSummary.ts
git commit -m "feat: add buildPortfolioSummary for agent system prompt context injection"
```

---

### Task 4: Agent Tools

**Files:**
- Create: `src/app/components/agent/agentTools.ts`

- [ ] **Step 1: Create `src/app/components/agent/agentTools.ts`**

```typescript
// src/app/components/agent/agentTools.ts
import {
  LESSEE_RADAR,
  MACRO_SIGNALS,
  DEAL_FEED,
  JURISDICTION_EVENTS,
} from "../../data/intelligenceData";
import { WATCHLIST_DATA } from "../counterparties/watchlistEngine";
import {
  computeECL,
  computeStages,
  type ScenarioInputs,
} from "../../utils/eclCalculator";

// ─── Mock Leases ────────────────────────────────────────────────────────────────

interface MockLease {
  leaseId: string;
  lesseeId: string;
  lesseeName: string;
  aircraft: string;
  msn: string;
  expiryDate: string;   // "YYYY-MM-DD"
  stage: "1" | "2" | "3";
  jurisdiction: string;
  monthlyRentUSD: number;
}

const MOCK_LEASES: MockLease[] = [
  { leaseId: "LS-001", lesseeId: "INDIGO",    lesseeName: "IndiGo Airlines",         aircraft: "A320neo",    msn: "8741", expiryDate: "2027-03-15", stage: "3", jurisdiction: "India",     monthlyRentUSD: 340_000 },
  { leaseId: "LS-002", lesseeId: "INDIGO",    lesseeName: "IndiGo Airlines",         aircraft: "A320neo",    msn: "9102", expiryDate: "2028-06-30", stage: "3", jurisdiction: "India",     monthlyRentUSD: 355_000 },
  { leaseId: "LS-003", lesseeId: "INDIGO",    lesseeName: "IndiGo Airlines",         aircraft: "A321neo",    msn: "9445", expiryDate: "2029-11-01", stage: "3", jurisdiction: "India",     monthlyRentUSD: 440_000 },
  { leaseId: "LS-004", lesseeId: "AEROMEX",   lesseeName: "Aeromexico",              aircraft: "B737 MAX 8", msn: "7521", expiryDate: "2026-09-30", stage: "3", jurisdiction: "Mexico",    monthlyRentUSD: 370_000 },
  { leaseId: "LS-005", lesseeId: "AEROMEX",   lesseeName: "Aeromexico",              aircraft: "B737 MAX 8", msn: "7688", expiryDate: "2027-12-31", stage: "3", jurisdiction: "Mexico",    monthlyRentUSD: 375_000 },
  { leaseId: "LS-006", lesseeId: "AZUL",      lesseeName: "Azul Brazilian Airlines", aircraft: "A320neo",    msn: "9312", expiryDate: "2028-04-15", stage: "2", jurisdiction: "Brazil",    monthlyRentUSD: 345_000 },
  { leaseId: "LS-007", lesseeId: "AZUL",      lesseeName: "Azul Brazilian Airlines", aircraft: "A321neo",    msn: "9567", expiryDate: "2029-08-01", stage: "2", jurisdiction: "Brazil",    monthlyRentUSD: 430_000 },
  { leaseId: "LS-008", lesseeId: "SRILNKN",   lesseeName: "SriLankan Airlines",      aircraft: "A320ceo",    msn: "6234", expiryDate: "2026-07-31", stage: "2", jurisdiction: "Sri Lanka", monthlyRentUSD: 290_000 },
  { leaseId: "LS-009", lesseeId: "TRANSATCA", lesseeName: "Air Transat",             aircraft: "A321LR",     msn: "9801", expiryDate: "2030-02-28", stage: "2", jurisdiction: "Canada",    monthlyRentUSD: 470_000 },
  { leaseId: "LS-010", lesseeId: "AF",        lesseeName: "Air France",              aircraft: "A350-900",   msn: "0412", expiryDate: "2031-05-01", stage: "1", jurisdiction: "France",    monthlyRentUSD: 1_180_000 },
  { leaseId: "LS-011", lesseeId: "AF",        lesseeName: "Air France",              aircraft: "A350-900",   msn: "0588", expiryDate: "2032-09-30", stage: "1", jurisdiction: "France",    monthlyRentUSD: 1_210_000 },
  { leaseId: "LS-012", lesseeId: "EMIRATES",  lesseeName: "Emirates",                aircraft: "A350-900",   msn: "0219", expiryDate: "2033-03-31", stage: "1", jurisdiction: "UAE",       monthlyRentUSD: 1_240_000 },
  { leaseId: "LS-013", lesseeId: "EMIRATES",  lesseeName: "Emirates",                aircraft: "A350-900",   msn: "0345", expiryDate: "2034-01-15", stage: "1", jurisdiction: "UAE",       monthlyRentUSD: 1_260_000 },
  { leaseId: "LS-014", lesseeId: "LUFTHANSA", lesseeName: "Lufthansa",               aircraft: "A320neo",    msn: "9011", expiryDate: "2029-06-30", stage: "1", jurisdiction: "Germany",   monthlyRentUSD: 360_000 },
  { leaseId: "LS-015", lesseeId: "SQ",        lesseeName: "Singapore Airlines",      aircraft: "A350-900",   msn: "0671", expiryDate: "2032-12-31", stage: "1", jurisdiction: "Singapore", monthlyRentUSD: 1_220_000 },
];

// ─── Mock Scenario Runs ─────────────────────────────────────────────────────────

interface MockScenarioRun {
  name: string;
  runDate: string;
  inputs: ScenarioInputs;
}

const MOCK_SCENARIO_RUNS: MockScenarioRun[] = [
  {
    name: "Baseline 2026 Q1",
    runDate: "2026-04-02",
    inputs: { gdpDelta: 0, rpkDelta: 0.02, fuelDelta: 0.27, fxDelta: -0.02, rateDelta: 0, assetValueDelta: -0.03, pdS2Multi: 1.1, pdS3Multi: 1.05 },
  },
  {
    name: "Fuel Spike",
    runDate: "2026-04-15",
    inputs: { gdpDelta: -0.01, rpkDelta: -0.05, fuelDelta: 0.55, fxDelta: -0.03, rateDelta: 0.005, assetValueDelta: -0.05, pdS2Multi: 1.3, pdS3Multi: 1.2 },
  },
  {
    name: "COVID-Severe",
    runDate: "2026-03-20",
    inputs: { gdpDelta: -0.06, rpkDelta: -0.65, fuelDelta: -0.10, fxDelta: -0.12, rateDelta: -0.01, assetValueDelta: -0.35, pdS2Multi: 2.8, pdS3Multi: 3.5 },
  },
  {
    name: "Rate Rise",
    runDate: "2026-03-01",
    inputs: { gdpDelta: -0.02, rpkDelta: -0.03, fuelDelta: 0.10, fxDelta: -0.01, rateDelta: 0.02, assetValueDelta: -0.08, pdS2Multi: 1.15, pdS3Multi: 1.1 },
  },
];

// ─── OpenAI Tool Definitions (JSON Schema) ──────────────────────────────────────

export const AGENT_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_lessee_detail",
      description:
        "Returns detailed information about a specific lessee: composite signal, composite score, all four radar signals (load factor, schedule stability, fuel cost stress, revenue-lease ratio) with values/thresholds/status/trend, watchlist audit log (last 3 entries), and relevant deal feed items.",
      parameters: {
        type: "object",
        properties: {
          lesseeName: {
            type: "string",
            description:
              "The lessee name as it appears in the portfolio (e.g. 'IndiGo Airlines', 'Aeromexico'). Case-insensitive partial match is supported.",
          },
        },
        required: ["lesseeName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_leases_by_filter",
      description:
        "Returns leases matching the given filters. At least one filter must be provided. Returns: leaseId, lessee, aircraft type, MSN, expiry date, IFRS 9 stage, jurisdiction, monthly rent USD.",
      parameters: {
        type: "object",
        properties: {
          stage: {
            type: "string",
            enum: ["1", "2", "3"],
            description: "IFRS 9 stage to filter by.",
          },
          jurisdiction: {
            type: "string",
            description: "Country name (e.g. 'India', 'Brazil'). Case-insensitive partial match.",
          },
          expiryBefore: {
            type: "string",
            description: "ISO date string YYYY-MM-DD. Returns leases expiring before this date.",
          },
          lesseeId: {
            type: "string",
            description: "Lessee ID (e.g. 'INDIGO', 'AZUL', 'AEROMEX').",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_market_signals",
      description:
        "Returns market signals from the Aero Intelligence module, filtered by category. Returns: signal name, category, severity, current/previous value, ECL impact, affected lessees with exposure and stage.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["fuel", "gdp", "rates", "fx", "aviation", "all"],
            description: "Signal category to filter by. Use 'all' to return all categories.",
          },
        },
        required: ["category"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_scenario_result",
      description:
        "Returns the ECL result and stage distribution for a named historical scenario run. Known runs: 'Baseline 2026 Q1', 'Fuel Spike', 'COVID-Severe', 'Rate Rise'. Returns ECL in $m, stage breakdown, and the inputs used.",
      parameters: {
        type: "object",
        properties: {
          scenarioName: {
            type: "string",
            description:
              "Name of a saved scenario run. Case-insensitive partial match supported.",
          },
        },
        required: ["scenarioName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "navigate_and_prepopulate",
      description:
        "Generates a navigation action to open a platform page, optionally pre-populating a form with parameter values. Always requires explicit user confirmation before executing — the UI shows a confirmation card. Use this when the user asks to open a page or run a scenario with specific parameters.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Platform path to navigate to (e.g. '/scenarios/run', '/risk-ecl/summary', '/counterparties').",
          },
          params: {
            type: "object",
            description:
              "Optional key-value pairs to pre-populate the destination form. For /scenarios/run, valid keys: gdpDelta, rpkDelta, fuelDelta, fxDelta, rateDelta, assetValueDelta, pdS2Multi, pdS3Multi. Values are numeric (e.g. fuelDelta: 0.27 = +27%).",
            additionalProperties: { type: "number" },
          },
        },
        required: ["path"],
      },
    },
  },
];

// ─── Executor Functions ─────────────────────────────────────────────────────────

type ToolResult = Record<string, unknown>;

export function executeTool(name: string, args: Record<string, unknown>): ToolResult {
  switch (name) {
    case "get_lessee_detail":
      return execGetLesseeDetail(args.lesseeName as string);
    case "get_leases_by_filter":
      return execGetLeasesByFilter(
        args as { stage?: string; jurisdiction?: string; expiryBefore?: string; lesseeId?: string }
      );
    case "get_market_signals":
      return execGetMarketSignals(args.category as string);
    case "get_scenario_result":
      return execGetScenarioResult(args.scenarioName as string);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function execGetLesseeDetail(name: string): ToolResult {
  const radar = LESSEE_RADAR.find(
    (e) =>
      e.lesseeName.toLowerCase().includes(name.toLowerCase()) ||
      e.lesseeId.toLowerCase() === name.toLowerCase()
  );
  if (!radar) return { error: `No lessee found matching "${name}"` };

  const watchlist = WATCHLIST_DATA[radar.lesseeId];
  const deals = DEAL_FEED.filter((d) =>
    d.affectedLesseeNames.some((n) =>
      n.toLowerCase().includes(radar.lesseeName.toLowerCase().split(" ")[0])
    )
  );

  return {
    lesseeId: radar.lesseeId,
    lesseeName: radar.lesseeName,
    country: radar.country,
    stage: radar.stage,
    exposureUSD: radar.exposureUSD,
    compositeSignal: radar.compositeSignal,
    compositeScore: radar.compositeScore,
    signals: {
      loadFactor: radar.loadFactor,
      scheduleStability: radar.scheduleStability,
      fuelCostStress: radar.fuelCostStress,
      revLeaseRatio: radar.revLeaseRatio,
    },
    watchlist: watchlist
      ? {
          status: watchlist.status,
          score: watchlist.score,
          trigger: watchlist.trigger,
          reason: watchlist.reason,
          recentAudit: watchlist.auditLog.slice(-3),
        }
      : null,
    recentDeals: deals.slice(0, 3).map((d) => ({
      headline: d.headline,
      sentiment: d.sentiment,
      hoursAgo: d.hoursAgo,
    })),
  };
}

function execGetLeasesByFilter(filters: {
  stage?: string;
  jurisdiction?: string;
  expiryBefore?: string;
  lesseeId?: string;
}): ToolResult {
  let leases = [...MOCK_LEASES];
  if (filters.stage) leases = leases.filter((l) => l.stage === filters.stage);
  if (filters.jurisdiction)
    leases = leases.filter((l) =>
      l.jurisdiction.toLowerCase().includes(filters.jurisdiction!.toLowerCase())
    );
  if (filters.expiryBefore)
    leases = leases.filter((l) => l.expiryDate < filters.expiryBefore!);
  if (filters.lesseeId)
    leases = leases.filter(
      (l) => l.lesseeId.toLowerCase() === filters.lesseeId!.toLowerCase()
    );

  return {
    count: leases.length,
    leases: leases.map((l) => ({
      leaseId: l.leaseId,
      lesseeName: l.lesseeName,
      aircraft: l.aircraft,
      msn: l.msn,
      expiryDate: l.expiryDate,
      stage: l.stage,
      jurisdiction: l.jurisdiction,
      monthlyRentUSD: l.monthlyRentUSD,
    })),
  };
}

function execGetMarketSignals(category: string): ToolResult {
  const signals =
    category === "all"
      ? MACRO_SIGNALS
      : MACRO_SIGNALS.filter((s) => s.category === category);

  const jxEvents =
    category === "all"
      ? JURISDICTION_EVENTS.slice(0, 4).map((e) => ({
          jurisdiction: e.jurisdiction,
          eventType: e.eventType,
          headline: e.headline,
          sentiment: e.sentiment,
          portfolioExposureUSD: e.portfolioExposureUSD,
        }))
      : [];

  return {
    signals: signals.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      severity: s.severity,
      currentValue: s.currentValue,
      changeLabel: s.changeLabel,
      eclImpactUSD: s.eclImpactUSD,
      eclImpactDir: s.eclImpactDir,
      affectedLessees: s.affectedLessees.map((a) => ({
        name: a.name,
        stage: a.stage,
        exposureUSD: a.exposureUSD,
      })),
      portfolioNarrative: s.portfolioNarrative,
    })),
    jurisdictionEvents: jxEvents,
  };
}

function execGetScenarioResult(scenarioName: string): ToolResult {
  const run = MOCK_SCENARIO_RUNS.find((r) =>
    r.name.toLowerCase().includes(scenarioName.toLowerCase())
  );

  if (!run) {
    return {
      error: `No scenario found matching "${scenarioName}". Known scenarios: ${MOCK_SCENARIO_RUNS.map((r) => r.name).join(", ")}.`,
    };
  }

  const ecl = computeECL(run.inputs);
  const stages = computeStages(ecl, run.inputs);

  return {
    name: run.name,
    runDate: run.runDate,
    eclUSD_m: Math.round(ecl * 10) / 10,
    stages: {
      s1_USD_m: Math.round(stages.s1 * 10) / 10,
      s2_USD_m: Math.round(stages.s2 * 10) / 10,
      s3_USD_m: Math.round(stages.s3 * 10) / 10,
    },
    inputs: run.inputs,
  };
}
```

- [ ] **Step 2: Validate**

Run: `node_modules/.bin/vite build`
Expected: exit 0. `JURISDICTION_EVENTS` is exported from `intelligenceData.ts` (confirmed).

- [ ] **Step 3: Commit**

```bash
git add src/app/components/agent/agentTools.ts
git commit -m "feat: add agent tools with 5 tool definitions, MOCK_LEASES, MOCK_SCENARIO_RUNS, and executor functions"
```

---

### Task 5: Agent Service (Streaming)

**Files:**
- Create: `src/app/services/agentService.ts`

- [ ] **Step 1: Create `src/app/services/agentService.ts`**

```typescript
// src/app/services/agentService.ts
import { AGENT_TOOL_DEFINITIONS, executeTool } from "../components/agent/agentTools";
import { buildPortfolioSummary } from "../components/agent/portfolioSummary";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: "token"; text: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_done" }
  | { type: "action"; path: string; params?: Record<string, number> }
  | { type: "done" }
  | { type: "error"; msg: string };

interface ApiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// ─── Static prompt content ──────────────────────────────────────────────────────

const PLATFORM_SITEMAP = `Dashboard (/): portfolio KPIs, ECL trend, market signals strip, recent scenarios.
Portfolio (/portfolio/analytics): concentration analysis, covenant headroom.
Portfolio > Leases (/portfolio/register): full lease register.
Scenarios (/scenarios/run): Custom Builder — scenario parameter form with sliders.
Deals (/deals/generator): lease pricing and deal analysis.
Risk & ECL (/risk-ecl): ECL overview, stage migration, sensitivity.
Aero Intelligence (/intelligence): macro signals, lessee radar, deal feed, jurisdiction watch.
Counterparties (/counterparties): lessee watchlist, behaviour scores, profile panels.
Jurisdictions (/jurisdictions): Cape Town scores, enforcement data.
Settings > Model Params (/settings/ecl): SICR triggers, concentration policy rules.
Reports (/reports): report templates, export history.`;

const KNOWLEDGE_BASE = `IFRS 9: Stage 1 = performing, 12-month ECL, EIR on gross carrying amount. Stage 2 = SICR triggered, lifetime ECL, EIR on gross. Stage 3 = credit-impaired, lifetime ECL, EIR on net (amortised cost). SICR indicators: 30+ DPD rebuttable presumption, significant PD increase vs origination, watchlist elevation, covenant breach. ECL = PD × LGD × EAD, discounted at original EIR.
IAS 36 VIU: discount rate = pre-tax rate reflecting current market assessment of time value of money and asset-specific risks. ECB deposit rate relevant for EUR-denominated lease streams.
Cape Town Convention: IDERA allows lessor to de-register and export aircraft on lessee default without court order, in ratifying states. CTC score reflects ratification quality + enforcement track record. Ireland, Singapore, UAE: strong. India: improved post-2024 IBC amendments. Brazil, Sri Lanka: moderate with caveats.
Maintenance reserves: typically $150–300/FH and $200–500/cycle for narrowbody aircraft, held by lessor, returned on qualifying shop visit. Security deposits: typically 2–3 months rent, applied on default.
Lease rate factor (LRF): monthly rent ÷ aircraft NBV, typically 0.7–1.1% for narrowbody, 0.55–0.85% for widebody. Revenue/lease ratio: annual lease cost ÷ annual revenue, >8.5% signals stress for most carrier cost structures.`;

function buildSystemPrompt(pageContext: string): string {
  const portfolioSummary = buildPortfolioSummary();
  return [
    `You are Aeroinsights Intelligence, a domain-expert AI analyst embedded in an aircraft lessor portfolio management platform. You have deep knowledge of IFRS 9 ECL methodology, IAS 36 VIU, Cape Town Convention repossession practice, and aviation finance. You only discuss topics within this domain. For regulatory or tax questions, always note "consult your auditor/advisor." For investment decisions, present options with trade-offs — never make a direct recommendation. Respond concisely — prefer tables for comparative data, bullets for lists. When uncertain about specific portfolio data, call the appropriate tool rather than guessing.`,
    ``,
    portfolioSummary,
    ``,
    `User is currently viewing: ${pageContext}`,
    ``,
    `PLATFORM SITEMAP:`,
    PLATFORM_SITEMAP,
    ``,
    `KNOWLEDGE BASE:`,
    KNOWLEDGE_BASE,
    ``,
    `HARD CONSTRAINTS:`,
    `- Never discuss topics outside aviation finance, IFRS 9/16/IAS 36, Cape Town Convention, and this platform's functionality.`,
    `- Never make specific investment recommendations.`,
    `- Always caveat regulatory/tax guidance with "consult your auditor/advisor".`,
    `- For navigate_and_prepopulate: always confirm before executing — the UI will show a confirmation card to the user.`,
    `- When uncertain about specific portfolio data, call the appropriate tool rather than guessing.`,
  ].join("\n");
}

// ─── Azure OpenAI config ────────────────────────────────────────────────────────

function getEndpoint(): string | null {
  return (import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string | undefined) ?? null;
}

function getApiKey(): string | null {
  return (import.meta.env.VITE_AZURE_OPENAI_KEY as string | undefined) ?? null;
}

function getDeployment(): string | null {
  return (
    (import.meta.env.VITE_AZURE_OPENAI_AGENT_DEPLOYMENT as string | undefined) ??
    (import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT as string | undefined) ??
    null
  );
}

export function isConfigured(): boolean {
  return !!(getEndpoint() && getApiKey() && getDeployment());
}

// ─── Core streaming fetch ───────────────────────────────────────────────────────

async function* fetchStream(
  messages: ApiMessage[],
  signal?: AbortSignal
): AsyncGenerator<AgentEvent> {
  const endpoint = getEndpoint()!;
  const apiKey = getApiKey()!;
  const deployment = getDeployment()!;
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        messages,
        tools: AGENT_TOOL_DEFINITIONS,
        tool_choice: "auto",
        stream: true,
        max_tokens: 1024,
        temperature: 0.3,
      }),
      signal,
    });
  } catch (e) {
    yield { type: "error", msg: e instanceof Error ? e.message : "Network error" };
    return;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    yield { type: "error", msg: `API error ${res.status}: ${body}` };
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Accumulate tool call fragments across SSE chunks
  const toolCallAcc: Record<number, { id: string; name: string; args: string }> = {};
  let finishReason: string | null = null;

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") break outer;

      let chunk: {
        choices?: Array<{
          delta?: {
            content?: string;
            tool_calls?: Array<{
              index: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          finish_reason?: string | null;
        }>;
      };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      if (choice.finish_reason) finishReason = choice.finish_reason;

      const delta = choice.delta;
      if (!delta) continue;

      // Yield text tokens
      if (delta.content) {
        yield { type: "token", text: delta.content };
      }

      // Accumulate tool call fragments
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallAcc[tc.index]) {
            toolCallAcc[tc.index] = {
              id: tc.id ?? "",
              name: tc.function?.name ?? "",
              args: "",
            };
          }
          if (tc.id) toolCallAcc[tc.index].id = tc.id;
          if (tc.function?.name) toolCallAcc[tc.index].name = tc.function.name;
          if (tc.function?.arguments) toolCallAcc[tc.index].args += tc.function.arguments;
        }
      }
    }
  }

  // Execute accumulated tool calls and make second pass
  if (finishReason === "tool_calls" && Object.keys(toolCallAcc).length > 0) {
    const toolCalls: OpenAIToolCall[] = Object.values(toolCallAcc).map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.name, arguments: tc.args },
    }));

    const assistantMsg: ApiMessage = {
      role: "assistant",
      content: null,
      tool_calls: toolCalls,
    };

    const toolResultMsgs: ApiMessage[] = [];

    for (const tc of toolCalls) {
      const toolName = tc.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      if (toolName === "navigate_and_prepopulate") {
        // Yield action event — panel renders confirmation card
        yield { type: "tool_start", name: toolName };
        const path = args.path as string;
        const params = args.params as Record<string, number> | undefined;
        yield { type: "action", path, params };
        toolResultMsgs.push({
          role: "tool",
          content: JSON.stringify({ status: "pending_user_confirmation", path, params }),
          tool_call_id: tc.id,
          name: toolName,
        });
      } else {
        yield { type: "tool_start", name: toolName };
        const result = executeTool(toolName, args);
        yield { type: "tool_done" };
        toolResultMsgs.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: tc.id,
          name: toolName,
        });
      }
    }

    // Recurse: second fetch with tool results appended
    yield* fetchStream([...messages, assistantMsg, ...toolResultMsgs], signal);
    return;
  }

  yield { type: "done" };
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export async function* streamAgentResponse(
  conversationMessages: Array<{ role: "user" | "assistant"; content: string }>,
  pageContext: string,
  signal?: AbortSignal
): AsyncGenerator<AgentEvent> {
  if (!isConfigured()) {
    yield {
      type: "error",
      msg: "Agent not configured. Set VITE_AZURE_OPENAI_ENDPOINT, VITE_AZURE_OPENAI_KEY, and VITE_AZURE_OPENAI_AGENT_DEPLOYMENT in your .env file.",
    };
    return;
  }

  const systemMsg: ApiMessage = {
    role: "system",
    content: buildSystemPrompt(pageContext),
  };

  const apiMessages: ApiMessage[] = [
    systemMsg,
    ...conversationMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  yield* fetchStream(apiMessages, signal);
}
```

- [ ] **Step 2: Validate**

Run: `node_modules/.bin/vite build`
Expected: exit 0. `import.meta.env.VITE_*` is standard in Vite and is typed via `vite/client`. If TypeScript complains, add `/// <reference types="vite/client" />` at the top of the file.

- [ ] **Step 3: Commit**

```bash
git add src/app/services/agentService.ts
git commit -m "feat: add streaming agent service with SSE parsing, tool-call accumulation, and second-pass execution"
```

---

### Task 6: Agent Button

**Files:**
- Create: `src/app/components/agent/AgentButton.tsx`

- [ ] **Step 1: Create `src/app/components/agent/AgentButton.tsx`**

```tsx
// src/app/components/agent/AgentButton.tsx
import * as React from "react";
import { Zap } from "lucide-react";
import { useAgent } from "../../contexts/AgentContext";
import { isConfigured } from "../../services/agentService";

const PULSE_CSS = `
@keyframes agentPulse {
  0%   { box-shadow: 0 0 0 0px rgba(0, 33, 71, 0.35); }
  70%  { box-shadow: 0 0 0 10px rgba(0, 33, 71, 0); }
  100% { box-shadow: 0 0 0 0px rgba(0, 33, 71, 0); }
}
`;

let styleInjected = false;
function injectPulseStyle() {
  if (styleInjected) return;
  const el = document.createElement("style");
  el.textContent = PULSE_CSS;
  document.head.appendChild(el);
  styleInjected = true;
}

const configured = isConfigured();

export function AgentButton() {
  const { isOpen, setIsOpen, hasNewSignal } = useAgent();
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    injectPulseStyle();
  }, []);

  if (!configured) {
    return (
      <div
        title="Intelligence agent not configured — set VITE_AZURE_OPENAI_AGENT_DEPLOYMENT"
        style={{ position: "relative", display: "inline-flex" }}
      >
        <button
          disabled
          aria-label="Intelligence agent not configured"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "#94A3B8",
            border: "none",
            cursor: "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Zap size={16} color="#FFFFFF" />
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Open Aeroinsights Intelligence"
        aria-expanded={isOpen}
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: "#002147",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "box-shadow 200ms ease-out",
          boxShadow: isOpen
            ? "inset 0 0 0 2px rgba(255,255,255,0.3)"
            : "none",
          animation: hovered && !isOpen ? "agentPulse 2s ease-out infinite" : "none",
        }}
      >
        <Zap size={16} color="#FFFFFF" />
      </button>

      {/* Notification dot — shown when hasNewSignal is true and panel is closed */}
      {hasNewSignal && !isOpen && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "1px",
            right: "1px",
            width: "10px",
            height: "10px",
            background: "#B91C1C",
            borderRadius: "50%",
            border: "2px solid white",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Validate**

Run: `node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/agent/AgentButton.tsx
git commit -m "feat: add AgentButton with Oxford Blue circle, pulse animation, and notification dot"
```

---

### Task 7: Agent Message Renderer

**Files:**
- Create: `src/app/components/agent/AgentMessage.tsx`

- [ ] **Step 1: Create `src/app/components/agent/AgentMessage.tsx`**

```tsx
// src/app/components/agent/AgentMessage.tsx
import * as React from "react";
import { useNavigate } from "react-router";
import { useAgent } from "../../contexts/AgentContext";

export interface ActionCard {
  path: string;
  params?: Record<string, number>;
}

interface AgentMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  actionCard?: ActionCard;
  toolIndicator?: string;
}

// ─── Markdown table detection ───────────────────────────────────────────────────

function isTableLine(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isSeparatorLine(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTable(lines: string[]): { headers: string[]; rows: string[][] } {
  const headers = lines[0]
    .trim()
    .slice(1, -1)
    .split("|")
    .map((h) => h.trim());
  const rows = lines
    .slice(2)
    .filter((l) => isTableLine(l))
    .map((l) =>
      l
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim())
    );
  return { headers, rows };
}

// ─── Navigation link parser ─────────────────────────────────────────────────────
// Syntax: [[Label|/path]]

function parseNavLinks(
  text: string,
  navigate: (path: string) => void
): React.ReactNode[] {
  const parts = text.split(/(\[\[.+?\|.+?\]\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[\[(.+?)\|(.+?)\]\]$/);
    if (match) {
      const [, label, path] = match;
      return (
        <span
          key={i}
          onClick={() => navigate(path)}
          style={{
            color: "#002147",
            textDecoration: "underline",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Content renderer ───────────────────────────────────────────────────────────

function RenderContent({ content }: { content: string }) {
  const navigate = useNavigate();
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Markdown table
    if (isTableLine(line) && i + 1 < lines.length && isSeparatorLine(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableLine(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      const { headers, rows } = parseTable(tableLines);
      nodes.push(
        <div key={`table-${i}`} style={{ overflowX: "auto", margin: "8px 0" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                {headers.map((h, hi) => (
                  <th
                    key={hi}
                    style={{
                      padding: "6px 10px",
                      textAlign: "left",
                      borderBottom: "2px solid #E2E8F0",
                      color: "#475569",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{ padding: "6px 10px", color: "#0F172A", fontSize: "0.8125rem" }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      nodes.push(<div key={`blank-${i}`} style={{ height: "6px" }} />);
      i++;
      continue;
    }

    // Bullet
    if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
      nodes.push(
        <div
          key={`bullet-${i}`}
          style={{ display: "flex", gap: "6px", margin: "2px 0" }}
        >
          <span style={{ color: "#94A3B8", flexShrink: 0, marginTop: "1px" }}>•</span>
          <span>{parseNavLinks(line.replace(/^[-•]\s/, ""), navigate)}</span>
        </div>
      );
      i++;
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={`p-${i}`} style={{ margin: "2px 0", lineHeight: 1.55 }}>
        {parseNavLinks(line, navigate)}
      </p>
    );
    i++;
  }

  return <>{nodes}</>;
}

// ─── Action confirmation card ───────────────────────────────────────────────────

const PATH_LABELS: Record<string, string> = {
  "/scenarios/run": "Custom Builder",
  "/risk-ecl": "Risk & ECL",
  "/risk-ecl/summary": "ECL Overview",
  "/counterparties": "Counterparties",
  "/intelligence": "Aero Intelligence",
  "/portfolio": "Portfolio",
  "/deals/generator": "Lease Generator",
};

const PARAM_LABELS: Record<string, string> = {
  gdpDelta: "GDP Delta",
  rpkDelta: "RPK Delta",
  fuelDelta: "Fuel Delta",
  fxDelta: "FX Delta",
  rateDelta: "Rate Delta",
  assetValueDelta: "Asset Value Delta",
  pdS2Multi: "PD S2 Multiplier",
  pdS3Multi: "PD S3 Multiplier",
};

function ActionConfirmCard({
  card,
  onConfirm,
  onCancel,
}: {
  card: ActionCard;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const pageLabel =
    Object.entries(PATH_LABELS).find(([k]) => card.path.startsWith(k))?.[1] ??
    card.path;

  const isMultiplier = (key: string) => key === "pdS2Multi" || key === "pdS3Multi";

  function formatValue(key: string, val: number): string {
    if (isMultiplier(key)) return `×${val.toFixed(2)}`;
    return val > 0 ? `+${(val * 100).toFixed(1)}%` : `${(val * 100).toFixed(1)}%`;
  }

  return (
    <div
      style={{
        background: "rgba(0,33,71,0.04)",
        border: "1px solid rgba(0,33,71,0.15)",
        borderLeft: "3px solid #002147",
        borderRadius: "8px",
        padding: "12px 14px",
        marginTop: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "10px",
        }}
      >
        <span style={{ fontSize: "0.875rem" }}>⚡</span>
        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>
          Ready to open {pageLabel}
        </span>
      </div>

      {card.params && Object.keys(card.params).length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          {Object.entries(card.params).map(([key, val]) => (
            <div
              key={key}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "8px",
                padding: "4px 0",
                borderBottom: "1px solid rgba(0,33,71,0.07)",
                fontSize: "0.8125rem",
              }}
            >
              <span style={{ color: "#475569" }}>{PARAM_LABELS[key] ?? key}</span>
              <span style={{ fontWeight: 600, color: "#0F172A" }}>
                {formatValue(key, val)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onConfirm}
          style={{
            flex: 1,
            padding: "7px 12px",
            background: "#002147",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Open and pre-fill
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "7px 12px",
            background: "transparent",
            color: "#475569",
            border: "1px solid #E2E8F0",
            borderRadius: "6px",
            fontSize: "0.8125rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function AgentMessage({
  role,
  content,
  isStreaming,
  actionCard,
  toolIndicator,
}: AgentMessageProps) {
  const navigate = useNavigate();
  const { setPendingInputs } = useAgent();
  const [actionDismissed, setActionDismissed] = React.useState(false);

  const isUser = role === "user";

  function handleConfirm(card: ActionCard) {
    if (card.params && Object.keys(card.params).length > 0) {
      setPendingInputs(card.params);
    }
    navigate(card.path);
    setActionDismissed(true);
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: "12px",
        padding: "0 12px",
      }}
    >
      <div
        style={{
          maxWidth: isUser ? "80%" : "92%",
          background: isUser ? "#002147" : "#FFFFFF",
          color: isUser ? "#FFFFFF" : "#0F172A",
          borderRadius: isUser ? "18px 18px 4px 18px" : "0 18px 18px 18px",
          borderLeft: isUser ? undefined : "2px solid #002147",
          padding: "10px 14px",
          fontSize: "0.875rem",
          lineHeight: 1.5,
        }}
      >
        {toolIndicator && (
          <p
            style={{
              fontSize: "0.75rem",
              fontStyle: "italic",
              color: "#94A3B8",
              margin: "0 0 6px 0",
            }}
          >
            {toolIndicator}
          </p>
        )}

        <RenderContent content={content} />

        {isStreaming && (
          <span
            style={{
              display: "inline-block",
              width: "6px",
              height: "14px",
              background: "#002147",
              marginLeft: "2px",
              verticalAlign: "middle",
              animation: "blink 1s step-end infinite",
            }}
          />
        )}

        {actionCard && !actionDismissed && (
          <ActionConfirmCard
            card={actionCard}
            onConfirm={() => handleConfirm(actionCard)}
            onCancel={() => setActionDismissed(true)}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Validate**

Run: `node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/agent/AgentMessage.tsx
git commit -m "feat: add AgentMessage with table rendering, nav links, tool indicators, and action confirmation card"
```

---

### Task 8: Agent Suggestions

**Files:**
- Create: `src/app/components/agent/AgentSuggestions.tsx`

- [ ] **Step 1: Create `src/app/components/agent/AgentSuggestions.tsx`**

```tsx
// src/app/components/agent/AgentSuggestions.tsx
import * as React from "react";

interface AgentSuggestionsProps {
  pathname: string;
  onSelect: (text: string) => void;
}

const ROUTE_CHIPS: Record<string, string[]> = {
  "/": [
    "What needs attention today?",
    "Summarise my ECL position",
    "Any new signals affecting my book?",
    "Which lessees are most exposed to fuel?",
  ],
  "/counterparties": [
    "Which lessees are Red this week?",
    "Compare my Stage 3 lessees",
    "What are my options for IndiGo?",
    "Show worst fuel-cost exposures",
  ],
  "/scenarios/run": [
    "What market inputs should I use today?",
    "Pre-populate from current market data",
    "Explain the drivers of my last run",
    "Which lessees drive the most ECL variance?",
  ],
  "/intelligence": [
    "Which signal has the biggest ECL impact?",
    "Summarise this week's deal feed",
    "What does the India GDP revision mean for me?",
    "Any jurisdiction risks I should act on?",
  ],
  "/risk-ecl": [
    "Why did three leases migrate to Stage 2?",
    "What is driving my ECL increase?",
    "Which lessee has the highest LGD?",
    "Generate an auditor summary of this quarter",
  ],
};

const DEFAULT_CHIPS = [
  "What needs attention today?",
  "Summarise my ECL position",
  "Any new signals affecting my book?",
  "Open Aero Intelligence",
];

function getChips(pathname: string): string[] {
  if (ROUTE_CHIPS[pathname]) return ROUTE_CHIPS[pathname];
  for (const [key, chips] of Object.entries(ROUTE_CHIPS)) {
    if (key !== "/" && pathname.startsWith(key)) return chips;
  }
  return DEFAULT_CHIPS;
}

export function AgentSuggestions({ pathname, onSelect }: AgentSuggestionsProps) {
  const chips = getChips(pathname);

  return (
    <div
      style={{
        padding: "12px 12px 0",
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#002147";
            (e.currentTarget as HTMLButtonElement).style.color = "#002147";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0";
            (e.currentTarget as HTMLButtonElement).style.color = "#475569";
          }}
          style={{
            padding: "6px 12px",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "20px",
            fontSize: "0.8125rem",
            color: "#475569",
            cursor: "pointer",
            lineHeight: 1.4,
            transition: "border-color 150ms ease, color 150ms ease",
          }}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Validate**

Run: `node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/agent/AgentSuggestions.tsx
git commit -m "feat: add AgentSuggestions with 5-route contextual chip map"
```

---

### Task 9: Agent Panel

**Files:**
- Create: `src/app/components/agent/AgentPanel.tsx`

- [ ] **Step 1: Create `src/app/components/agent/AgentPanel.tsx`**

```tsx
// src/app/components/agent/AgentPanel.tsx
import * as React from "react";
import { useLocation } from "react-router";
import { Zap, X, Minus, Send, ChevronDown } from "lucide-react";
import { useAgent } from "../../contexts/AgentContext";
import { streamAgentResponse } from "../../services/agentService";
import { AgentMessage, type ActionCard } from "./AgentMessage";
import { AgentSuggestions } from "./AgentSuggestions";

const USAGE_LIMIT = 200;
const USAGE_WARN = 160;

// ─── Pending action tracker ─────────────────────────────────────────────────────

interface PendingAction {
  messageId: string;
  path: string;
  params?: Record<string, number>;
}

// ─── Actions quick-send menu ────────────────────────────────────────────────────

const ACTION_PRESETS = [
  {
    label: "Run Scenario",
    text: "Pre-populate the Custom Builder with today's market data and open it for me",
  },
  {
    label: "Generate Report",
    text: "Guide me to generate a Board report for this quarter",
  },
  {
    label: "Export Data",
    text: "How do I export my ECL data to Excel?",
  },
];

function ActionsMenu({ onSelect }: { onSelect: (text: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "0 10px",
          height: "34px",
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: "6px",
          fontSize: "0.8125rem",
          color: "#475569",
          cursor: "pointer",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        Actions
        <ChevronDown
          size={12}
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 150ms ease",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            zIndex: 10,
            minWidth: "180px",
            overflow: "hidden",
          }}
        >
          {ACTION_PRESETS.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                onSelect(a.text);
                setOpen(false);
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
              }
              style={{
                display: "block",
                width: "100%",
                padding: "9px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                fontSize: "0.8125rem",
                color: "#0F172A",
                cursor: "pointer",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────────────

export function AgentPanel() {
  const location = useLocation();
  const {
    isOpen,
    setIsOpen,
    isMinimized,
    setIsMinimized,
    messages,
    addMessage,
    updateLastMessage,
    usage,
    incrementUsage,
    pageContext,
  } = useAgent();

  const [input, setInput] = React.useState("");
  const [isThinking, setIsThinking] = React.useState(false);
  const [toolIndicators, setToolIndicators] = React.useState<Record<string, string>>({});
  const [pendingActions, setPendingActions] = React.useState<PendingAction[]>([]);
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Scroll to bottom on new message
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cancel in-flight request on unmount
  React.useEffect(() => () => { abortRef.current?.abort(); }, []);

  const atLimit = usage.count >= USAGE_LIMIT;
  const nearLimit = usage.count >= USAGE_WARN && !atLimit;

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isThinking || atLimit) return;

    setInput("");
    incrementUsage();

    const userMsgId = `u-${Date.now()}-${Math.random()}`;
    const assistantMsgId = `a-${Date.now()}-${Math.random()}`;

    addMessage({ id: userMsgId, role: "user", content, timestamp: new Date() });
    addMessage({
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    });

    setIsThinking(true);
    abortRef.current = new AbortController();
    let accText = "";

    try {
      const history = [...messages, { role: "user" as const, content }].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      for await (const event of streamAgentResponse(
        history,
        pageContext,
        abortRef.current.signal
      )) {
        switch (event.type) {
          case "token":
            accText += event.text;
            updateLastMessage(assistantMsgId, { content: accText });
            break;

          case "tool_start":
            setToolIndicators((prev) => ({
              ...prev,
              [assistantMsgId]: `Looking up ${event.name.replace(/_/g, " ")}…`,
            }));
            break;

          case "tool_done":
            setToolIndicators((prev) => {
              const next = { ...prev };
              delete next[assistantMsgId];
              return next;
            });
            break;

          case "action":
            setPendingActions((prev) => [
              ...prev,
              { messageId: assistantMsgId, path: event.path, params: event.params },
            ]);
            break;

          case "done":
            updateLastMessage(assistantMsgId, { isStreaming: false });
            break;

          case "error":
            updateLastMessage(assistantMsgId, {
              content: `⚠ ${event.msg}`,
              isStreaming: false,
            });
            break;
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        updateLastMessage(assistantMsgId, {
          content: "An unexpected error occurred. Please try again.",
          isStreaming: false,
        });
      }
    } finally {
      setIsThinking(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function getActionCard(msgId: string): ActionCard | undefined {
    const found = pendingActions.find((a) => a.messageId === msgId);
    return found ? { path: found.path, params: found.params } : undefined;
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100vh",
        width: isMinimized ? "48px" : "420px",
        zIndex: 50,
        background: "#FFFFFF",
        borderLeft: "1px solid #E2E8F0",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "agentSlideIn 240ms cubic-bezier(0.32,0.72,0,1)",
      }}
    >
      <style>{`
        @keyframes agentSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>

      {/* Header bar — 56px */}
      <div
        style={{
          height: "56px",
          borderBottom: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <Zap size={16} color="#002147" />
        {!isMinimized && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>
              Aeroinsights Intelligence
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#64748B" }}>
              GPT-4o · EU West · Data stays in region
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: "4px", marginLeft: isMinimized ? "auto" : undefined }}>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            aria-label={isMinimized ? "Expand panel" : "Minimise panel"}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close panel"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Context strip — 36px */}
          <div
            style={{
              height: "36px",
              background: "#F8FAFC",
              borderBottom: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: "#94A3B8",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {pageContext}
            </span>
          </div>

          {/* Chat area */}
          <div style={{ flex: 1, overflowY: "auto", paddingTop: "12px" }}>
            {messages.length === 0 && (
              <AgentSuggestions
                pathname={location.pathname}
                onSelect={(t) => void handleSend(t)}
              />
            )}
            {messages.map((msg) => (
              <AgentMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                isStreaming={msg.isStreaming}
                toolIndicator={toolIndicators[msg.id]}
                actionCard={getActionCard(msg.id)}
              />
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input area — 64px */}
          <div
            style={{
              borderTop: "1px solid #E2E8F0",
              padding: "10px 12px",
              display: "flex",
              gap: "8px",
              alignItems: "flex-end",
              flexShrink: 0,
            }}
          >
            <ActionsMenu onSelect={(t) => void handleSend(t)} />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                atLimit
                  ? "Daily query limit reached. Resets at midnight UTC."
                  : "Ask about your portfolio…"
              }
              disabled={atLimit || isThinking}
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "0.875rem",
                color: "#0F172A",
                fontFamily: "inherit",
                outline: "none",
                lineHeight: 1.5,
                minHeight: "36px",
                maxHeight: "120px",
                overflowY: "auto",
                background: atLimit ? "#F8FAFC" : "#FFFFFF",
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isThinking || atLimit}
              aria-label="Send message"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background:
                  !input.trim() || isThinking || atLimit ? "#E2E8F0" : "#002147",
                border: "none",
                cursor:
                  !input.trim() || isThinking || atLimit ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 150ms ease",
              }}
            >
              <Send
                size={15}
                color={
                  !input.trim() || isThinking || atLimit ? "#94A3B8" : "#FFFFFF"
                }
              />
            </button>
          </div>

          {/* Footer — 28px */}
          <div
            style={{
              height: "28px",
              background: "#F8FAFC",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: nearLimit ? "#B45309" : "#94A3B8",
                fontWeight: nearLimit ? 600 : 400,
              }}
            >
              {usage.count} / {USAGE_LIMIT} queries today
              {nearLimit && " — nearing limit"}
            </span>
            <span
              title="Query limit resets at midnight UTC. Prototype enforcement is client-side only."
              style={{ fontSize: "0.75rem", color: "#CBD5E1", cursor: "help" }}
            >
              ⓘ
            </span>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Validate**

Run: `node_modules/.bin/vite build`
Expected: exit 0. If TypeScript complains about `for await...of` on `AsyncGenerator`, verify `tsconfig.json` has `"lib": ["ES2018", "DOM"]` or higher — this is standard in Vite projects.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/agent/AgentPanel.tsx
git commit -m "feat: add AgentPanel with streaming chat, suggestions, action cards, usage counter, and minimize"
```

---

### Task 10: Wire Up — Layout and Header

**Files:**
- Modify: `src/app/components/layout/Layout.tsx`
- Modify: `src/app/components/layout/Header.tsx`

Note: `AgentProvider` goes in `Layout.tsx` (not `App.tsx`) because it uses `useLocation()` which requires being inside the router context. `Layout` is rendered by `react-router` via the route config, so `useLocation` works there.

- [ ] **Step 1: Replace `src/app/components/layout/Layout.tsx` with the wired version**

```tsx
// src/app/components/layout/Layout.tsx
import * as React from "react";
import { Outlet } from "react-router";
import { SidebarProvider, SidebarInset } from "../ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Header } from "./Header";
import { AgentProvider } from "../../contexts/AgentContext";
import { AgentPanel } from "../agent/AgentPanel";

export function Layout() {
  return (
    <AgentProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "16rem",
            "--sidebar-width-icon": "3rem",
            "--header-height": "3.5rem",
          } as React.CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <Header />
          <main className="flex flex-1 flex-col overflow-auto bg-[#f8fafc]">
            <div
              style={{
                maxWidth: "1400px",
                width: "100%",
                margin: "0 auto",
                padding: "clamp(1rem, 2vw, 1.75rem)",
              }}
            >
              <Outlet />
            </div>
          </main>
        </SidebarInset>

        {/* AgentPanel: position:fixed overlay — does not affect layout flow */}
        <AgentPanel />
      </SidebarProvider>
    </AgentProvider>
  );
}
```

- [ ] **Step 2: Add `AgentButton` import to `src/app/components/layout/Header.tsx`**

Add this import alongside the other imports at the top of `Header.tsx`:

```typescript
import { AgentButton } from "../agent/AgentButton";
```

- [ ] **Step 3: Place `<AgentButton />` in `Header.tsx`**

Find the closing `</div>` of the search bar section (the `ref={searchRef}` div, closes around line 222 in the original file). Insert `<AgentButton />` immediately after it, before the `{/* Right side */}` div:

```tsx
        {/* Search bar */}
        <div ref={searchRef} style={{ position: "relative" }} className="hidden md:block">
          {/* ... existing search bar contents ... */}
        </div>

        {/* Agent button */}
        <AgentButton />

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1">
          {/* ... existing notifications, messages, avatar ... */}
        </div>
```

- [ ] **Step 4: Validate**

Run: `node_modules/.bin/vite build`
Expected: exit 0. Both `AgentProvider` (with `useLocation`) and `AgentPanel` (with `useLocation`) are inside the router because `Layout` is a route component. `AgentButton` calls `useAgent()` inside `AgentProvider` — correct.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/layout/Layout.tsx src/app/components/layout/Header.tsx
git commit -m "feat: wire AgentProvider, AgentPanel overlay, and AgentButton into layout and header"
```

---

### Task 11: Scenarios — Read Pending Inputs on Custom Builder Mount

**Files:**
- Modify: `src/app/pages/Scenarios.tsx`

- [ ] **Step 1: Add `useAgent` import**

In `src/app/pages/Scenarios.tsx`, add after the existing `import { useViewMode } from "../contexts/ViewModeContext";`:

```typescript
import { useAgent } from "../contexts/AgentContext";
```

- [ ] **Step 2: Add hook and effect in the Scenarios component body**

In `Scenarios.tsx`, the active tab is determined by:

```typescript
const activeTab = PATH_TAB[location.pathname] ?? "Library";
```

Add the following immediately after the existing `const { isExecutiveMode } = useViewMode();` line:

```typescript
const { pendingInputs, setPendingInputs } = useAgent();

// Read agent-injected inputs when Custom Builder tab becomes active
useEffect(() => {
  if (activeTab === "Custom Builder" && pendingInputs) {
    updateFormInputs(pendingInputs as Parameters<typeof updateFormInputs>[0]);
    setPendingInputs(null);
  }
}, [activeTab, pendingInputs, setPendingInputs]);
```

Note: `updateFormInputs` must be in scope at this point. If it is defined lower in the function body, move the `useEffect` to just after `updateFormInputs` is declared, keeping all hooks at the top level.

- [ ] **Step 3: Validate**

Run: `node_modules/.bin/vite build`
Expected: exit 0. If TypeScript complains about `Parameters<typeof updateFormInputs>[0]` — this cast aligns the `Record<string, number>` from `pendingInputs` with whatever typed object `updateFormInputs` accepts. If the cast fails, replace with a direct call: `updateFormInputs(pendingInputs as any)` and add a comment noting the type mismatch is acceptable for prototype.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/Scenarios.tsx
git commit -m "feat: read AgentContext.pendingInputs on Custom Builder mount for agent-initiated pre-population"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|---|---|
| `eclCalculator.ts` extracted from `Scenarios.tsx` | Task 1 |
| `AgentContext`: panel state, chat history, usage, pendingInputs, hasNewSignal | Task 2 |
| `buildPortfolioSummary()` injected into every system prompt | Tasks 3 + 5 |
| 5 tool definitions + executors + `MOCK_LEASES` + `MOCK_SCENARIO_RUNS` | Task 4 |
| Azure OpenAI streaming, SSE parsing, tool-call accumulation, second-pass | Task 5 |
| `AgentButton`: 40px circle, pulse animation, notification dot, disabled state | Task 6 |
| `AgentMessage`: text, tables, nav links, tool indicators, action cards | Task 7 |
| `AgentSuggestions`: route-to-chip map, 6 routes | Task 8 |
| `AgentPanel`: header, context strip, suggestions, chat, input, footer, minimize | Task 9 |
| `AgentProvider` in `Layout.tsx` (inside router), `AgentPanel` as fixed overlay, `AgentButton` in `Header.tsx` | Task 10 |
| `Scenarios.tsx` reads `pendingInputs` on Custom Builder mount | Task 11 |
| Usage limit: 200/day, 160 warning, input disabled at limit | Tasks 2 (storage) + 9 (UI) |
| `navigate_and_prepopulate`: action event → confirmation card → navigate + pendingInputs | Tasks 5 (service) + 7 (card UI) + 11 (read) |
| `isConfigured()` → disabled `AgentButton` with tooltip | Task 6 |
| System prompt: persona, portfolio summary, page context, sitemap, knowledge base, constraints | Task 5 |
| `VITE_AZURE_OPENAI_AGENT_DEPLOYMENT` env var, fallback to `VITE_AZURE_OPENAI_DEPLOYMENT` | Task 5 |
| Tool scope boundaries enforced via system prompt hard constraints | Task 5 |

### Placeholder Scan

No `TBD`, `TODO`, `handle edge cases`, or incomplete sections found. All code blocks are complete and self-contained.

### Type Consistency

- `ScenarioInputs` — defined once in `eclCalculator.ts`; imported by `Scenarios.tsx`, `agentTools.ts`. Type import flows: `agentTools.ts` → `agentService.ts` (indirectly, through `executeTool` return type). ✓
- `ChatMessage` — defined and exported from `AgentContext.tsx`; consumed in `AgentPanel.tsx`. ✓
- `AgentEvent` — defined and exported from `agentService.ts`; consumed in `AgentPanel.tsx` via `for await...of`. ✓
- `ActionCard` — defined and exported from `AgentMessage.tsx`; consumed in `AgentPanel.tsx` via `getActionCard()`. ✓
- Tool names in `AGENT_TOOL_DEFINITIONS` match `executeTool` switch cases exactly: `get_lessee_detail`, `get_leases_by_filter`, `get_market_signals`, `get_scenario_result`, `navigate_and_prepopulate`. The last is handled in `agentService.ts` before `executeTool` is called. ✓
- `updateLastMessage(id, patch)` — defined in `AgentContext.tsx`, called in `AgentPanel.tsx` with string ID and `Partial<ChatMessage>`. ✓
