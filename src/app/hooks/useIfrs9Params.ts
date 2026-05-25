// src/app/hooks/useIfrs9Params.ts
//
// Reads + writes the one ifrs9_parameters row per (org_id, portfolio_id).
// Used by Settings → Model Params (was decorative; now real-DB-bound).
// The row is created on first save if it doesn't exist yet.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";
import { logAudit } from "../services/auditLog";

export interface Ifrs9Params {
  discount_rate:              number;
  lgd_flat:                   number;
  pd_lifetime_multiplier_s2:  number;
  pd_lifetime_s3_floor:       number;
  scenario_weight_baseline:   number;
  scenario_weight_adverse:    number;
  scenario_weight_upside:     number;
}

// Documented defaults that mirror the migration's column defaults so the
// form always renders sensible values even before the row exists.
export const DEFAULT_IFRS9_PARAMS: Ifrs9Params = {
  discount_rate:              0.05,
  lgd_flat:                   0.45,
  pd_lifetime_multiplier_s2:  3.0,
  pd_lifetime_s3_floor:       0.85,
  scenario_weight_baseline:   0.60,
  scenario_weight_adverse:    0.25,
  scenario_weight_upside:     0.15,
};

export interface UseIfrs9ParamsResult {
  params: Ifrs9Params;
  loading: boolean;
  isPersisted: boolean;     // false until first save
  error: string | null;
  save: (next: Ifrs9Params) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useIfrs9Params(): UseIfrs9ParamsResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();

  const [params, setParams]       = useState<Ifrs9Params>(DEFAULT_IFRS9_PARAMS);
  const [loading, setLoading]     = useState(false);
  const [isPersisted, setPersisted] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId || !activePortfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from("ifrs9_parameters")
        .select("*")
        .eq("org_id", orgId)
        .eq("portfolio_id", activePortfolioId)
        .maybeSingle();
      if (e) throw e;
      if (data) {
        setParams({
          discount_rate:              Number(data.discount_rate),
          lgd_flat:                   Number(data.lgd_flat),
          pd_lifetime_multiplier_s2:  Number(data.pd_lifetime_multiplier_s2),
          pd_lifetime_s3_floor:       Number(data.pd_lifetime_s3_floor),
          scenario_weight_baseline:   Number(data.scenario_weight_baseline),
          scenario_weight_adverse:    Number(data.scenario_weight_adverse),
          scenario_weight_upside:     Number(data.scenario_weight_upside),
        });
        setPersisted(true);
      } else {
        setParams(DEFAULT_IFRS9_PARAMS);
        setPersisted(false);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, activePortfolioId]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  const save = useCallback(
    async (next: Ifrs9Params) => {
      if (!orgId || !activePortfolioId) {
        throw new Error("Active portfolio required to save IFRS-9 parameters.");
      }
      setError(null);
      const previous = params; // snapshot before write — feeds audit "before"
      const { error: e } = await supabase
        .from("ifrs9_parameters")
        .upsert(
          {
            org_id:       orgId,
            portfolio_id: activePortfolioId,
            ...next,
            updated_at:   new Date().toISOString(),
          },
          { onConflict: "org_id,portfolio_id", ignoreDuplicates: false },
        );
      if (e) {
        setError(e.message);
        throw e;
      }
      setParams(next);
      setPersisted(true);
      // T-3.4 — record assumption change in universal audit log.
      void logAudit({
        orgId,
        portfolioId: activePortfolioId,
        entityType:  "ifrs9_parameters",
        entityId:    activePortfolioId,
        action:      isPersisted ? "update" : "create",
        before:      isPersisted ? previous : null,
        after:       next,
      });
    },
    [orgId, activePortfolioId, params, isPersisted],
  );

  return { params, loading, isPersisted, error, save, refetch: fetchOnce };
}
