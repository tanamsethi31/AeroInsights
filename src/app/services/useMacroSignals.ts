// src/app/services/useMacroSignals.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
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
  /** Raw numeric values from the live feed — null until the first successful fetch or cache hit. */
  raw: LiveMacroData | null;
}

export function useMacroSignals(): UseMacroSignalsResult {
  const [signals, setSignals] = useState<MacroSignal[]>(MACRO_SIGNALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [partial, setPartial] = useState(false);
  const [rawData, setRawData] = useState<LiveMacroData | null>(null);
  // Mirrors rawData for comparison inside fetchSignals without needing rawData
  // in that callback's dependency array (which would defeat the stable
  // poll-interval identity set up in the effect below).
  const rawDataRef = useRef<LiveMacroData | null>(null);

  const { getAccessTokenSilently } = useAuth0();
  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let token: string | undefined;
      try { token = await getAccessTokenSilently(); } catch { /* anon */ }
      const res = await fetch("/api/signals/macro", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const live = await res.json() as LiveMacroData;
      // Skip state updates entirely when the polled payload is unchanged —
      // otherwise every 30-minute poll produces a brand-new `rawData` object
      // reference even when nothing actually changed, which cascades into a
      // fresh `calibration` array in CustomBuilderPage and forces a full
      // re-render of the React.memo-wrapped CustomBuilderTab subtree for no
      // reason. LiveMacroData is small and plain-JSON-serializable (numbers,
      // strings, one small array, no functions/circular refs), so a
      // JSON.stringify comparison is safe and cheap here.
      // Compare everything except `fetchedAt` — that's a server timestamp
      // stamped fresh on every non-cached response, so including it here
      // would report "changed" on almost every poll even when the
      // underlying economic data (ecbDepositRate/eurUsd/brentCrude/gdp)
      // and partial-fetch status are identical to the last poll.
      const comparable = (d: LiveMacroData) => JSON.stringify({
        ecbDepositRate: d.ecbDepositRate,
        eurUsd: d.eurUsd,
        brentCrude: d.brentCrude,
        gdp: d.gdp,
        partial: d.partial,
      });
      const unchanged = rawDataRef.current !== null && comparable(live) === comparable(rawDataRef.current);
      if (!unchanged) {
        setSignals(mergeLiveData(MACRO_SIGNALS, live));
        setLastUpdated(new Date(live.fetchedAt));
        setPartial(live.partial);
        setRawData(live);
        rawDataRef.current = live;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ live, cachedAt: Date.now() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
      // Fallback: try localStorage cache
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const { live } = JSON.parse(cached) as { live: LiveMacroData };
          setSignals(mergeLiveData(MACRO_SIGNALS, live));
          setLastUpdated(new Date(live.fetchedAt));
          setRawData(live);
        }
      } catch { /* keep static defaults */ }
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    fetchSignals();
    const id = setInterval(fetchSignals, POLL_MS);
    return () => clearInterval(id);
  }, [fetchSignals]);

  return { signals, loading, error, lastUpdated, partial, refresh: fetchSignals, raw: rawData };
}
