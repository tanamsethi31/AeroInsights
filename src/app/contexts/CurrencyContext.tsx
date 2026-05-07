// src/app/contexts/CurrencyContext.tsx
import * as React from "react";

export type CurrencyCode = "EUR" | "USD" | "GBP" | "AED" | "SGD" | "HKD" | "JPY" | "CAD" | "AUD";

interface CurrencyMeta {
  symbol: string;
  rate: number;   // from USD base
  decimals: number;
  label: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  EUR: { symbol: "€",    rate: 0.920,  decimals: 2, label: "Euro" },
  USD: { symbol: "$",    rate: 1.000,  decimals: 2, label: "US Dollar" },
  GBP: { symbol: "£",    rate: 0.790,  decimals: 2, label: "British Pound" },
  AED: { symbol: "AED ", rate: 3.670,  decimals: 2, label: "UAE Dirham" },
  SGD: { symbol: "S$",   rate: 1.340,  decimals: 2, label: "Singapore Dollar" },
  HKD: { symbol: "HK$",  rate: 7.820,  decimals: 2, label: "Hong Kong Dollar" },
  JPY: { symbol: "¥",    rate: 149.50, decimals: 0, label: "Japanese Yen" },
  CAD: { symbol: "CA$",  rate: 1.360,  decimals: 2, label: "Canadian Dollar" },
  AUD: { symbol: "A$",   rate: 1.520,  decimals: 2, label: "Australian Dollar" },
};

const STORAGE_KEY = "aeroinsights:currency";

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  fmt: (usd: number, opts?: { compact?: boolean }) => string;
}

const CurrencyContext = React.createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = React.useState<CurrencyCode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored && stored in CURRENCIES ? stored : "EUR") as CurrencyCode;
  });

  const setCurrency = React.useCallback((c: CurrencyCode) => {
    localStorage.setItem(STORAGE_KEY, c);
    setCurrencyState(c);
  }, []);

  const fmt = React.useCallback(
    (usd: number, opts?: { compact?: boolean }): string => {
      const meta = CURRENCIES[currency];
      const value = usd * meta.rate;
      if (opts?.compact) {
        const absValue = Math.abs(value);
        if (absValue >= 1_000_000_000)
          return `${meta.symbol}${(value / 1_000_000_000).toFixed(2)}bn`;
        if (absValue >= 1_000_000)
          return `${meta.symbol}${(value / 1_000_000).toFixed(1)}M`;
        if (absValue >= 1_000)
          return `${meta.symbol}${(value / 1_000).toFixed(0)}K`;
      }
      return `${meta.symbol}${value.toLocaleString("en-IE", {
        minimumFractionDigits: meta.decimals,
        maximumFractionDigits: meta.decimals,
      })}`;
    },
    [currency],
  );

  const value = React.useMemo(() => ({ currency, setCurrency, fmt }), [currency, setCurrency, fmt]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = React.useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>");
  return ctx;
}

// ── Standalone formatter (for non-React code, e.g. exportService) ─────────────
export function fmtCurrency(usd: number, currency: CurrencyCode, compact = false): string {
  const meta = CURRENCIES[currency];
  const value = usd * meta.rate;
  if (compact) {
    const absValue = Math.abs(value);
    if (absValue >= 1_000_000_000)
      return `${meta.symbol}${(value / 1_000_000_000).toFixed(2)}bn`;
    if (absValue >= 1_000_000)
      return `${meta.symbol}${(value / 1_000_000).toFixed(1)}M`;
    if (absValue >= 1_000)
      return `${meta.symbol}${(value / 1_000).toFixed(0)}K`;
  }
  return `${meta.symbol}${value.toLocaleString("en-IE", {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  })}`;
}
