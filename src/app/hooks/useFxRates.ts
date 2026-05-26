// src/app/hooks/useFxRates.ts
//
// T-5.4 — Reads fx_rates for the most recent date and returns a
// "USD → ccy" rate map (matching the legacy CURRENCIES.rate shape so
// drop-in overlay is a one-liner).
//
// Strategy: fetch all (base, quote) rows from the latest available
// date. Derive USD→ccy = (EUR→ccy) / (EUR→USD). EUR→EUR = 1.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { CurrencyCode } from "../contexts/CurrencyContext";

interface FxRow {
  date:  string;
  base:  string;
  quote: string;
  rate:  number;
}

export interface UseFxRatesResult {
  /** USD-based map, ready to overlay onto CURRENCIES[ccy].rate. */
  rates:   Partial<Record<CurrencyCode, number>>;
  /** Date of the rows used. null when no DB row is available. */
  date:    string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const CCYS: CurrencyCode[] = ["EUR", "USD", "GBP", "AED", "SGD", "HKD", "JPY", "CAD", "AUD"];

export function useFxRates(): UseFxRatesResult {
  const [rates,   setRates]   = useState<Partial<Record<CurrencyCode, number>>>({});
  const [date,    setDate]    = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    try {
      // Step 1: most recent date with EUR-base rows.
      const { data: dateRow } = await supabase
        .from("fx_rates")
        .select("date")
        .eq("base", "EUR")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!dateRow?.date) { setRates({}); setDate(null); return; }

      const latest = dateRow.date as string;

      // Step 2: all EUR→ccy rows on that date.
      const { data: rows } = await supabase
        .from("fx_rates")
        .select("date, base, quote, rate")
        .eq("base", "EUR")
        .eq("date", latest);
      if (!rows || rows.length === 0) { setRates({}); setDate(null); return; }

      const eurTo: Record<string, number> = { EUR: 1 };
      for (const r of rows as FxRow[]) eurTo[r.quote] = Number(r.rate);

      const eurUsd = eurTo.USD;
      if (!eurUsd || eurUsd <= 0) { setRates({}); setDate(latest); return; }

      // Step 3: USD-based map. usdToCcy = eurToCcy / eurToUsd.
      const usdMap: Partial<Record<CurrencyCode, number>> = {};
      for (const ccy of CCYS) {
        const eurRate = eurTo[ccy];
        if (eurRate == null) continue;
        usdMap[ccy] = eurRate / eurUsd;
      }
      setRates(usdMap);
      setDate(latest);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchOnce(); }, [fetchOnce]);

  return { rates, date, loading, refetch: fetchOnce };
}
