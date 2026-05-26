// src/app/services/auditLog.ts
//
// T-3.4 — Universal audit trail writer.
//
// One canonical writer used by every state-changing call site (settings
// saves, scenario runs, period locks, report exports, lease edits, stage
// migrations). Failures are SWALLOWED + logged to console — an audit-log
// outage must not break the user's primary action. Auditors can still
// reconstruct the event from the entity row itself; the audit_log is a
// secondary record.

import { supabase } from "../lib/supabase";
import { Sentry } from "../lib/sentry";

export type AuditAction =
  | "create" | "update" | "delete"
  | "lock"   | "unlock"
  | "run"    | "export" | "import"
  | "override" | "reset";

export interface LogAuditArgs {
  orgId:        string;
  portfolioId?: string | null;
  entityType:   string;
  entityId?:    string | null;
  action:       AuditAction;
  before?:      unknown;
  after?:       unknown;
  note?:        string;
}

/**
 * Write a single audit row. Never throws — returns true on success, false
 * on failure (and console.errors). Call sites should NOT await this if they
 * can avoid it; fire-and-forget is the intended ergonomics.
 */
export async function logAudit(args: LogAuditArgs): Promise<boolean> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    const actor = user?.email ?? "unknown";
    const { error } = await supabase.from("audit_log").insert({
      org_id:       args.orgId,
      portfolio_id: args.portfolioId ?? null,
      entity_type:  args.entityType,
      entity_id:    args.entityId ?? null,
      action:       args.action,
      before:       args.before ?? null,
      after:        args.after  ?? null,
      actor,
      note:         args.note ?? null,
    });
    if (error) {
      console.warn("[auditLog] write failed (non-fatal):", error.message);
      Sentry.captureException(new Error(`auditLog insert failed: ${error.message}`), {
        tags: { surface: "auditLog", entity_type: args.entityType, action: args.action },
      });
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[auditLog] write threw (non-fatal):", err);
    Sentry.captureException(err, {
      tags: { surface: "auditLog", entity_type: args.entityType, action: args.action },
    });
    return false;
  }
}
