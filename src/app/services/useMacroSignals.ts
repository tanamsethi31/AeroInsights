// src/app/services/useMacroSignals.ts
import { useState, useEffect, useCallback } from "react";
import { MACRO_SIGNALS, type MacroSignal } from "../data/intelligenceData";

interface LiveMacroData {
  ecbDepositRate: { value: number; date: string } | null;
  eurUsd: { value: number; date: string } | null;
  brentCrude: { value: number; date: string } | null;
  gdp: Array<{ countryCode: string; year: string; value: number }>;
  fetchedAt: string;
  partial: boolean;
}

const STORAGE_KEY = "aeroinsights_macro_v1";
const POLL_MS = 30 * 60 * 1000;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function mergeLiveData(signals: MacroSignal[], live: LiveMacroData): MacroSignal[] {
  return signals.map(sig => {
    if (sig.id === "sig-03" && live.ecbDepositRate) {
      const { value, date } = live.ecbDepositRate;
      return {
        ...sig,
        currentValue: `${value.toFixed(2)}%`,
        updatedAt: `${formatDate(date)} · Live (ECB)`,
      };
    }
    if (sig.id === "sig-04" && live.eurUsd) {
      const { value, date } = live.eurUsd;
      return {
        ...sig,
        currentValue: value.toFixed(4),
        updatedAt: `${formatDate(date)} · Live (ECB)`,
      };
    }
    if (sig.id === "sig-06" && live.brentCrude) {
      const { value, date } = live.brentCrude;
      return {
        ...sig,
        currentValue: `$${value.toFixed(2)} / bbl`,
        updatedAt: `${formatDate(date)} · Live (EIA)`,
      };
    }
    if (sig.id === "sig-02") {
      const indiaGdp = live.gdp.find(g => g.countryCode === "IND");
      if (indiaGdp) {
        return {
          ...sig,
          currentValue: `${indiaGdp.value.toFixed(1)}% (FY${indiaGdp.year} forecast)`,
          updatedAt: `${indiaGdp.year} · Live (IMF)`,
        };
      }
    }
    return sig;
  });
}

export interface UseMacroSignalsResult {
  signals: MacroSignal[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  partial: boolean;
  refresh: () => void;
}

export function useMacroSignals(): UseMacroSignalsResult {
  const [signals, setSignals] = useState<MacroSignal[]>(MACRO_SIGNALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [partial, setPartial] = useState(false);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signals/macro");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const live = await res.json() as LiveMacroData;
      setSignals(mergeLiveData(MACRO_SIGNALS, live));
      setLastUpdated(new Date(live.fetchedAt));
      setPartial(live.partial);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ live, cachedAt: Date.now() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
      // Fallback: try localStorage cache
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const { live } = JSON.parse(raw) as { live: LiveMacroData };
          setSignals(mergeLiveData(MACRO_SIGNALS, live));
          setLastUpdated(new Date(live.fetchedAt));
        }
      } catch { /* keep static defaults */ }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const id = setInterval(fetchSignals, POLL_MS);
    return () => clearInterval(id);
  }, [fetchSignals]);

  return { signals, loading, error, lastUpdated, partial, refresh: fetchSignals };
}
