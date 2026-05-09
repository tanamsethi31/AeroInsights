// src/app/hooks/usePortfolioData.ts
import { useState, useEffect } from "react";
import { useData } from "../contexts/DataContext";
import { supabase } from "../lib/supabase";
import { MOCK_ASSETS, MOCK_LESSEES, MOCK_LEASES, MOCK_PROVISIONS } from "../data/mockPortfolioData";
import type { Asset, Lessee, Lease, Provision, PortfolioData } from "../types/portfolio";

export function usePortfolioData(): PortfolioData {
  const { orgId, hasUpload } = useData();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [lessees, setLessees] = useState<Lessee[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!hasUpload || !orgId) return;

    setIsLoading(true);
    Promise.all([
      supabase.from("assets").select("*").eq("org_id", orgId),
      supabase.from("lessees").select("*").eq("org_id", orgId),
      supabase.from("leases").select("*").eq("org_id", orgId),
      supabase.from("provisions").select("*").eq("org_id", orgId),
    ])
      .then(([a, l, ls, p]) => {
        setAssets((a.data as Asset[]) ?? []);
        setLessees((l.data as Lessee[]) ?? []);
        setLeases((ls.data as Lease[]) ?? []);
        setProvisions((p.data as Provision[]) ?? []);
      })
      .finally(() => setIsLoading(false));
  }, [orgId, hasUpload]);

  if (!hasUpload) {
    return {
      assets: MOCK_ASSETS,
      lessees: MOCK_LESSEES,
      leases: MOCK_LEASES,
      provisions: MOCK_PROVISIONS,
      isLoading: false,
      isDemo: true,
    };
  }

  return { assets, lessees, leases, provisions, isLoading, isDemo: false };
}
