import { createContext, useContext, useState, type ReactNode } from "react";

// Fixed ID the backend knows as the global sample dataset (10-aircraft fleet).
export const SAMPLE_PORTFOLIO_ID = "global-sample";

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
  const [activePortfolio, setActivePortfolio] = useState<Portfolio | null>(null);

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
