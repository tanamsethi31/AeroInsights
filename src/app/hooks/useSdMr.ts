// src/app/hooks/useSdMr.ts
//
// Reads the per-lease security_deposits + maintenance_reserves rows for the
// active portfolio. Used by SDMRTab to overlay real ingested values on top
// of the heuristic-derived defaults (T-1.4 consumer wire).
//
// Returned shape: deposits keyed by lease_id (one per lease), reserves keyed
// by lease_id with an array of components. Consumers can ask "do we have a
// real deposit row for lease X?" → use it; otherwise fall back to heuristic.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";
import type {
  MaintenanceReserve,
  SecurityDeposit,
} from "../types/portfolio";
import { dbPortfolioId } from "../utils/portfolioId";

export interface UseSdMrResult {
  /** Deposits keyed by lease_id. */
  depositsByLease: Map<string, SecurityDeposit>;
  /** Maintenance reserve components keyed by lease_id (multiple per lease). */
  reservesByLease: Map<string, MaintenanceReserve[]>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY: UseSdMrResult = {
  depositsByLease: new Map(),
  reservesByLease: new Map(),
  loading: false,
  error: null,
  refetch: async () => {},
};

export function useSdMr(): UseSdMrResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();

  const [state, setState] = useState<UseSdMrResult>(EMPTY);

  const fetchOnce = useCallback(async (signal?: AbortSignal) => {
      const dbId = dbPortfolioId(activePortfolioId);
    if (!orgId || !dbId) {
      setState(EMPTY);
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const depositsQ = supabase.from("security_deposits").select("*").eq("org_id", orgId).eq("portfolio_id", dbId);
      const reservesQ = supabase.from("maintenance_reserves").select("*").eq("org_id", orgId).eq("portfolio_id", dbId);
      const [{ data: deposits, error: dErr }, { data: reserves, error: rErr }] = await Promise.all([
        signal ? depositsQ.abortSignal(signal) : depositsQ,
        signal ? reservesQ.abortSignal(signal) : reservesQ,
      ]);
      if (signal?.aborted) return;
      if (dErr) throw dErr;
      if (rErr) throw rErr;

      const depositsByLease = new Map<string, SecurityDeposit>();
      for (const d of (deposits ?? []) as SecurityDeposit[]) {
        depositsByLease.set(d.lease_id, d);
      }
      const reservesByLease = new Map<string, MaintenanceReserve[]>();
      for (const r of (reserves ?? []) as MaintenanceReserve[]) {
        const arr = reservesByLease.get(r.lease_id) ?? [];
        arr.push(r);
        reservesByLease.set(r.lease_id, arr);
      }
      setState({
        depositsByLease,
        reservesByLease,
        loading: false,
        error: null,
        refetch: fetchOnce,
      });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, [orgId, activePortfolioId]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchOnce(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchOnce]);

  return { ...state, refetch: fetchOnce };
}
