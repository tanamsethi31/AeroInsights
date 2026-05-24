import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Fixed ID the backend knows as the global sample dataset (10-aircraft fleet).
// Per ADR-002, the sample is the one portfolio that does NOT live in the
// `portfolios` table — it's a magic, read-only demo dataset addressable by
// every tenant. All real portfolios have a UUID coming from Supabase.
export const SAMPLE_PORTFOLIO_ID = "global-sample";

const STORAGE_KEY = "aeroinsights_active_portfolio_v1";

export interface Portfolio {
  id: string;
  name: string;
  aircraft_count: number;
  created_at: string;
}

interface PortfolioContextType {
  activePortfolioId: string | null;
  activePortfolio: Portfolio | null;
  setActivePortfolio: (portfolio: Portfolio | null) => void;
}

const PortfolioContext = createContext<PortfolioContextType>({
  activePortfolioId: null,
  activePortfolio: null,
  setActivePortfolio: () => {},
});

export function PortfolioProvider({ children }: { children: ReactNode }) {
  // Hydrate from localStorage so refresh survives the active selection
  // (ADR-002 Phase A). Pure client persistence — canonical record stays
  // the `portfolios` row in Supabase.
  const [activePortfolio, setActivePortfolio] = useState<Portfolio | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Portfolio) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (activePortfolio === null) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activePortfolio));
      }
    } catch {
      // Storage may be full / disabled; silently ignore.
    }
  }, [activePortfolio]);

  return (
    <PortfolioContext.Provider
      value={{
        activePortfolioId: activePortfolio?.id ?? null,
        activePortfolio,
        setActivePortfolio,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  return useContext(PortfolioContext);
}

// The virtual "sample" portfolio object — not persisted, never hits the backend.
export const SAMPLE_PORTFOLIO: Portfolio = {
  id: SAMPLE_PORTFOLIO_ID,
  name: "Sample Portfolio",
  aircraft_count: 10,
  created_at: new Date().toISOString(),
};
