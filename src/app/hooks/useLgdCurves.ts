// src/app/hooks/useLgdCurves.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { DEFAULT_RECOVERY_FACTOR } from "../data/lgdCurves";
import { logAssumptionChange } from "../utils/assumptionLog";
import { hasAuthSession } from "../utils/authBackend";

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
      if (!orgId || !hasAuthSession()) {
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
        {

          const _e = err as { code?: string; message?: string };

          const _msg = String(_e?.message ?? "");

          if (_e?.code !== "42501" && !/permission denied/i.test(_msg)) {

            console.error("[useLgdCurves] fetch error:", err);

          }

        }
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
      const user = (await supabase.auth.getUser()).data.user;
      await logAssumptionChange(supabase, {
        orgId,
        assumptionType:  "lgd_recovery",
        segment:         null,
        action:          "override",
        previousValue:   isOverridden ? { recovery_factor: recoveryFactor } : null,
        newValue:        { recovery_factor: factor },
        notes:           notes ?? null,
        changedBy:       user?.email ?? "unknown",
      });
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
    [orgId, recoveryFactor, isOverridden]
  );

  const resetToDefault = useCallback(async () => {
    if (!orgId) return;
    const { error } = await supabase
      .from("lgd_recovery_overrides")
      .delete()
      .eq("org_id", orgId);
    if (error) throw error;
    const user = (await supabase.auth.getUser()).data.user;
    await logAssumptionChange(supabase, {
      orgId,
      assumptionType:  "lgd_recovery",
      segment:         null,
      action:          "reset",
      previousValue:   { recovery_factor: recoveryFactor },
      newValue:        null,
      notes:           null,
      changedBy:       user?.email ?? "unknown",
    });
    setRecoveryFactor(DEFAULT_RECOVERY_FACTOR);
    setIsOverridden(false);
  }, [orgId, recoveryFactor]);

  return { recoveryFactor, isOverridden, loading, saveRecoveryOverride, resetToDefault };
}
