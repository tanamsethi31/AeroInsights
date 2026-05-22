// src/app/hooks/useRateOutlook.ts
import { useMemo } from "react";
import { forecastRates } from "../utils/rateForecaster";
import { CURRENT_MACRO_INPUTS, type RateOutlookResult } from "../data/rateOutlookData";

export interface RateOutlookHookResult {
  data: RateOutlookResult;
}

/**
 * Returns a memoised 12-month lease rate forecast for all 18 aircraft types.
 * Uses CURRENT_MACRO_INPUTS (static Apr-2026 snapshot).
 * Memo key is referentially stable — recomputes only on mount.
 */
export function useRateOutlook(): RateOutlookHookResult {
  const data = useMemo(() => forecastRates(CURRENT_MACRO_INPUTS, 12), []);
  return { data };
}
