// src/app/hooks/useAbsDeals.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import type { AbsDeal } from "../utils/absWaterfall";

function mapRow(r: Record<string, unknown>): AbsDeal {
  return {
    id:              r.id as string,
    orgId:           r.org_id as string,
    dealName:        r.deal_name as string,
    closingDate:     r.closing_date as string,
    currency:        r.currency as string,
    noteClasses:     r.note_classes as AbsDeal["noteClasses"],
    reserveAccounts: r.reserve_accounts as AbsDeal["reserveAccounts"],
    coverageTests:   r.coverage_tests as AbsDeal["coverageTests"],
    seniorExpenses:  r.senior_expenses as AbsDeal["seniorExpenses"],
    aircraftIds:     r.aircraft_ids as string[],
    createdAt:       r.created_at as string,
  };
}

interface UseAbsDealsReturn {
  deals:      AbsDeal[];
  loading:    boolean;
  createDeal: (payload: Omit<AbsDeal, "id" | "createdAt" | "orgId">) => Promise<void>;
}

export function useAbsDeals(): UseAbsDealsReturn {
  const { orgId } = useData();
  const [deals, setDeals]     = useState<AbsDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!orgId) { setLoading(false); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from("abs_deals")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (!error && data) {
        setDeals((data as Record<string, unknown>[]).map(mapRow));
      }
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [orgId]);

  const createDeal = useCallback(
    async (payload: Omit<AbsDeal, "id" | "createdAt" | "orgId">) => {
      if (!orgId) return;
      const { error } = await supabase.from("abs_deals").insert({
        org_id:          orgId,
        deal_name:       payload.dealName,
        closing_date:    payload.closingDate,
        currency:        payload.currency,
        note_classes:    payload.noteClasses,
        reserve_accounts: payload.reserveAccounts,
        coverage_tests:  payload.coverageTests,
        senior_expenses: payload.seniorExpenses,
        aircraft_ids:    payload.aircraftIds,
      });
      if (error) throw error;
      // Inline refresh — same pattern as useEclSnapshots.lockPeriod
      const { data } = await supabase
        .from("abs_deals")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (data) setDeals((data as Record<string, unknown>[]).map(mapRow));
    },
    [orgId]
  );

  return { deals, loading, createDeal };
}
