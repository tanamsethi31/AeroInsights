// src/app/services/useSignalRefresh.ts

import { useState, useEffect, useCallback } from "react";
import {
  getStoredState,
  refreshAll,
  refreshLessee,
  type StoredSignalState,
  type StoredLesseeSignals,
} from "./signalRefreshService";
import { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from "../components/counterparties/watchlistEngine";

export interface UseSignalRefreshResult {
  state: StoredSignalState | null;
  refreshing: boolean;
  refreshAll: () => void;
  refreshLessee: (lesseeId: string) => void;
  getStatus: (lesseeId: string) => StoredLesseeSignals | null;
  getLastRefreshed: (lesseeId: string) => Date | null;
}

export function useSignalRefresh(): UseSignalRefreshResult {
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<StoredSignalState | null>(() => getStoredState());

  const triggerRefreshAll = useCallback(() => {
    setRefreshing(true);
    // Defer to next tick so UI can re-render the loading state before blocking work begins
    setTimeout(() => {
      const result = refreshAll(DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS);
      setState(result);
      setRefreshing(false);
    }, 0);
  }, []);

  const triggerRefreshLessee = useCallback((lesseeId: string) => {
    setRefreshing(true);
    setTimeout(() => {
      const result = refreshLessee(lesseeId, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS);
      setState(prev =>
        prev
          ? { ...prev, lessees: { ...prev.lessees, [lesseeId]: result } }
          : { version: 1, lessees: { [lesseeId]: result } }
      );
      setRefreshing(false);
    }, 0);
  }, []);

  // Auto-refresh on mount if no data, or if oldest entry is >4 hours stale
  useEffect(() => {
    const stored = getStoredState();
    if (!stored || Object.keys(stored.lessees).length === 0) {
      triggerRefreshAll();
      return;
    }
    const oldestMs = Object.values(stored.lessees).reduce(
      (min, l) => Math.min(min, new Date(l.computedAt).getTime()),
      Infinity
    );
    if (Date.now() - oldestMs > 4 * 60 * 60 * 1000) {
      triggerRefreshAll();
    }
  }, [triggerRefreshAll]);

  return {
    state,
    refreshing,
    refreshAll: triggerRefreshAll,
    refreshLessee: triggerRefreshLessee,
    getStatus: (lesseeId: string) => state?.lessees[lesseeId] ?? null,
    getLastRefreshed: (lesseeId: string) => {
      const entry = state?.lessees[lesseeId];
      return entry ? new Date(entry.computedAt) : null;
    },
  };
}
