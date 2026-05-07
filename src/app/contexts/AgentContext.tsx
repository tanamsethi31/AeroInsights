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
