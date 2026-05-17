// src/app/hooks/usePdCurves.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import {
  DEFAULT_PD_CURVES,
  mergeCurves,
  type CarrierSegment,
  type PdCurveLibrary,
  type PdTermStructure,
} from "../data/pdCurves";

export interface EffectiveCurves {
  curves: PdCurveLibrary;
  isOverridden: Record<CarrierSegment, boolean>;
  loading: boolean;
  saveOverride: (
    segment: CarrierSegment,
    values: Pick<PdTermStructure, "pd1yr" | "pd2yr" | "pd3yr" | "pd5yr" | "pdLifetime"> & {
      notes?: string;
      updatedBy?: string;
    }
  ) => Promise<void>;
  resetToDefault: (segment: CarrierSegment) => Promise<void>;
}

const EMPTY_OVERRIDDEN: Record<CarrierSegment, boolean> = {
  network: false,
  lcc: false,
  regional: false,
  charter: false,
};

export function usePdCurves(): EffectiveCurves {
  const { orgId } = useData();
  const [curves, setCurves] = useState<PdCurveLibrary>(DEFAULT_PD_CURVES);
  const [isOverridden, setIsOverridden] =
    useState<Record<CarrierSegment, boolean>>(EMPTY_OVERRIDDEN);
  const [loading, setLoading] = useState(false);

  const fetchOverrides = useCallback(async () => {
    if (!orgId) {
      setCurves(DEFAULT_PD_CURVES);
      setIsOverridden(EMPTY_OVERRIDDEN);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pd_curve_overrides")
        .select("segment, pd1yr, pd2yr, pd3yr, pd5yr, pd_lifetime, notes, updated_by, updated_at")
        .eq("org_id", orgId);

      if (error) throw error;

      if (!data || data.length === 0) {
        setCurves(DEFAULT_PD_CURVES);
        setIsOverridden(EMPTY_OVERRIDDEN);
        return;
      }

      const overrideMap: Partial<Record<CarrierSegment, Partial<PdTermStructure>>> = {};
      const overriddenFlags: Record<CarrierSegment, boolean> = { ...EMPTY_OVERRIDDEN };

      for (const row of data) {
        const seg = row.segment as CarrierSegment;
        overrideMap[seg] = {
          pd1yr: Number(row.pd1yr),
          pd2yr: Number(row.pd2yr),
          pd3yr: Number(row.pd3yr),
          pd5yr: Number(row.pd5yr),
          pdLifetime: Number(row.pd_lifetime),
        };
        overriddenFlags[seg] = true;
      }

      setCurves(mergeCurves(DEFAULT_PD_CURVES, overrideMap));
      setIsOverridden(overriddenFlags);
    } catch (err) {
      console.error("[usePdCurves] fetchOverrides error:", err);
      // Fall back to defaults on error
      setCurves(DEFAULT_PD_CURVES);
      setIsOverridden(EMPTY_OVERRIDDEN);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!orgId) {
        if (!cancelled) {
          setCurves(DEFAULT_PD_CURVES);
          setIsOverridden(EMPTY_OVERRIDDEN);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("pd_curve_overrides")
          .select(
            "segment, pd1yr, pd2yr, pd3yr, pd5yr, pd_lifetime, notes, updated_by, updated_at"
          )
          .eq("org_id", orgId);

        if (error) throw error;

        if (!data || data.length === 0) {
          if (!cancelled) {
            setCurves(DEFAULT_PD_CURVES);
            setIsOverridden(EMPTY_OVERRIDDEN);
          }
          return;
        }

        const overrideMap: Partial<Record<CarrierSegment, Partial<PdTermStructure>>> = {};
        const overriddenFlags: Record<CarrierSegment, boolean> = { ...EMPTY_OVERRIDDEN };

        for (const row of data) {
          const seg = row.segment as CarrierSegment;
          overrideMap[seg] = {
            pd1yr: Number(row.pd1yr),
            pd2yr: Number(row.pd2yr),
            pd3yr: Number(row.pd3yr),
            pd5yr: Number(row.pd5yr),
            pdLifetime: Number(row.pd_lifetime),
          };
          overriddenFlags[seg] = true;
        }

        if (!cancelled) {
          setCurves(mergeCurves(DEFAULT_PD_CURVES, overrideMap));
          setIsOverridden(overriddenFlags);
        }
      } catch (err) {
        console.error("[usePdCurves] fetchOverrides error:", err);
        if (!cancelled) {
          setCurves(DEFAULT_PD_CURVES);
          setIsOverridden(EMPTY_OVERRIDDEN);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const saveOverride = useCallback(
    async (
      segment: CarrierSegment,
      values: Pick<PdTermStructure, "pd1yr" | "pd2yr" | "pd3yr" | "pd5yr" | "pdLifetime"> & {
        notes?: string;
        updatedBy?: string;
      }
    ) => {
      if (!orgId) return;
      const { error } = await supabase.from("pd_curve_overrides").upsert(
        {
          org_id: orgId,
          segment,
          pd1yr: values.pd1yr,
          pd2yr: values.pd2yr,
          pd3yr: values.pd3yr,
          pd5yr: values.pd5yr,
          pd_lifetime: values.pdLifetime,
          notes: values.notes ?? null,
          updated_by: values.updatedBy ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,segment" }
      );
      if (error) throw error;
      await fetchOverrides();
    },
    [orgId, fetchOverrides]
  );

  const resetToDefault = useCallback(
    async (segment: CarrierSegment) => {
      if (!orgId) return;
      const { error } = await supabase
        .from("pd_curve_overrides")
        .delete()
        .eq("org_id", orgId)
        .eq("segment", segment);
      if (error) throw error;
      await fetchOverrides();
    },
    [orgId, fetchOverrides]
  );

  return { curves, isOverridden, loading, saveOverride, resetToDefault };
}
