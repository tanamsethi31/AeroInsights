// src/app/utils/assumptionLog.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AssumptionChangePayload {
  orgId:           string;
  assumptionType:  "pd_curve" | "lgd_recovery";
  segment?:        string | null;
  action:          "override" | "reset";
  previousValue:   Record<string, number> | null;
  newValue:        Record<string, number> | null;
  notes?:          string | null;
  changedBy:       string;
}

/**
 * Appends one row to assumption_change_log.
 * Non-blocking — a failed insert logs a console warning but never throws.
 */
export async function logAssumptionChange(
  supabase: SupabaseClient,
  payload: AssumptionChangePayload,
): Promise<void> {
  const { error } = await supabase.from("assumption_change_log").insert({
    org_id:          payload.orgId,
    assumption_type: payload.assumptionType,
    segment:         payload.segment ?? null,
    action:          payload.action,
    previous_value:  payload.previousValue,
    new_value:       payload.newValue,
    notes:           payload.notes ?? null,
    changed_by:      payload.changedBy,
  });
  if (error) {
    console.warn("[assumptionLog] failed to write audit entry:", error.message);
  }
}
