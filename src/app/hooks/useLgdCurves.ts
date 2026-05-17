// src/app/hooks/useLgdCurves.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { DEFAULT_RECOVERY_FACTOR } from "../data/lgdCurves";

export interface LgdCurvesState {
  recoveryFactor:       number;
  isOverridden:         boolean;
  loading:              boolean;
  saveRecoveryOverride: (factor: number, notes?: string, updatedBy?: string) => Promise<void>;
  resetToDefault:       () => Promise<void>;
}

export function useLgdCurves(): LgdCurvesState {
  const { orgId } = useData();
  const [recoveryFactor, setRecoveryFactor] = useState(DEFAULT_RECOVERY_FACTOR);
  const [isOverridden, setIsOverridden]     = useState(false);
  const [loading, setLoading]               = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!orgId) {
        if (!cancelled) {
          setRecoveryFactor(DEFAULT_RECOVERY_FACTOR);
          setIsOverridden(false);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("lgd_recovery_overrides")
          .select("recovery_factor")
          .eq("org_id", orgId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) {
          if (data) {
            setRecoveryFactor(Number(data.recovery_factor));
            setIsOverridden(true);
          } else {
            setRecoveryFactor(DEFAULT_RECOVERY_FACTOR);
            setIsOverridden(false);
          }
        }
      } catch (err) {
        console.error("[useLgdCurves] fetch error:", err);
        if (!cancelled) {
          setRecoveryFactor(DEFAULT_RECOVERY_FACTOR);
          setIsOverridden(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [orgId]);

  const saveRecoveryOverride = useCallback(
    async (factor: number, notes?: string, updatedBy?: string) => {
      if (!orgId) return;
      const { error } = await supabase.from("lgd_recovery_overrides").upsert(
        {
          org_id: orgId,
          recovery_factor: factor,
          notes: notes ?? null,
          updated_by: updatedBy ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id" }
      );
      if (error) throw error;
      // Inline post-save refresh — no fetchOverride callback needed
      const { data } = await supabase
        .from("lgd_recovery_overrides")
        .select("recovery_factor")
        .eq("org_id", orgId)
        .maybeSingle();
      if (data) {
        setRecoveryFactor(Number(data.recovery_factor));
        setIsOverridden(true);
      }
    },
    [orgId]
  );

  const resetToDefault = useCallback(async () => {
    if (!orgId) return;
    const { error } = await supabase
      .from("lgd_recovery_overrides")
      .delete()
      .eq("org_id", orgId);
    if (error) throw error;
    setRecoveryFactor(DEFAULT_RECOVERY_FACTOR);
    setIsOverridden(false);
  }, [orgId]);

  return { recoveryFactor, isOverridden, loading, saveRecoveryOverride, resetToDefault };
}
