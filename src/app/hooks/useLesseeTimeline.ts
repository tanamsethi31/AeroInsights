// src/app/hooks/useLesseeTimeline.ts
//
// T-2.5 — Phase 2 closeout. Derives a per-lessee timeline of real events
// from the Phase 3 audit tables:
//
//   • stage_migrations  — every IFRS-9 1↔2↔3 transition the lessee's
//                         leases have ever taken.
//   • audit_log         — settings-level events that affect the lessee
//                         indirectly (SICR config edits, period locks)
//                         when their lease is implicated. For now we
//                         surface period-lock events org-wide because
//                         they bound the lessee's reporting cadence.
//
// The hook returns events shaped like the legacy `PaymentEvent` so the
// LesseeProfilePanel + SimpleLesseePanel can render them with zero
// transformation.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";
import { dbPortfolioId } from "../utils/portfolioId";

export type LesseeTimelineEventType =
  | "stage-change"
  | "rating-change"
  | "trigger"
  | "period-lock"
  | "ingestion";

export interface LesseeTimelineEvent {
  /** Stable id (DB row uuid + source prefix). */
  id:           string;
  date:         string;          // ISO yyyy-mm-dd
  type:         LesseeTimelineEventType;
  description:  string;
  impact:       string;
  daysOverdue?: number;
  source:       "stage_migrations" | "audit_log";
}

export interface UseLesseeTimelineResult {
  events:  LesseeTimelineEvent[];
  loading: boolean;
  error:   string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetch the timeline for a specific lessee. Caller must pass the
 * lessee's uuid (not external_id). Internally we map: lessee → leases →
 * lease external_ids → stage_migrations rows.
 */
export function useLesseeTimeline(lesseeUuid: string | null | undefined): UseLesseeTimelineResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();

  const [events, setEvents] = useState<LesseeTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    const dbId = dbPortfolioId(activePortfolioId);
    if (!orgId || !dbId || !lesseeUuid) {
      setEvents([]);
      return;
    }
    setLoading(true); setError(null);
    try {
      // ── 1. Resolve the lessee's leases → external_ids ───────────────
      const { data: leaseRows, error: leaseErr } = await supabase
        .from("leases")
        .select("external_id")
        .eq("org_id", orgId)
        .eq("portfolio_id", dbId)
        .eq("lessee_id", lesseeUuid);
      if (leaseErr) throw leaseErr;
      const externalIds = (leaseRows ?? [])
        .map((r) => (r as { external_id: string | null }).external_id)
        .filter((x): x is string => typeof x === "string" && x.length > 0);

      // ── 2. Stage migration events for those leases ──────────────────
      const out: LesseeTimelineEvent[] = [];
      if (externalIds.length > 0) {
        const { data: migRows, error: migErr } = await supabase
          .from("stage_migrations")
          .select("id, lease_external_id, from_stage, to_stage, direction, reason, signal, occurred_at")
          .eq("org_id", orgId)
          .eq("portfolio_id", dbId)
          .in("lease_external_id", externalIds)
          .order("occurred_at", { ascending: false })
          .limit(50);
        if (migErr) throw migErr;
        for (const row of (migRows ?? []) as Array<{
          id: string; lease_external_id: string;
          from_stage: number; to_stage: number;
          direction: "up" | "down";
          reason: string; signal: string | null;
          occurred_at: string;
        }>) {
          const dir = row.direction === "up" ? "↑" : "↓";
          out.push({
            id:          `mig-${row.id}`,
            date:        row.occurred_at.slice(0, 10),
            type:        "stage-change",
            description: `${row.lease_external_id}: S${row.from_stage} ${dir} S${row.to_stage} (${row.reason})`,
            impact:      row.signal ?? (row.direction === "up"
              ? "Lifetime ECL required"
              : "Stage improvement — 12-month ECL window"),
            source:      "stage_migrations",
          });
        }
      }

      // ── 3. Portfolio-wide period-lock events from audit_log ────────
      // These bound the lessee's reporting cadence so showing them on
      // the timeline gives auditors context (e.g. "Q2 2026 locked just
      // after this Stage 2 → 3 transition").
      const { data: auditRows, error: auditErr } = await supabase
        .from("audit_log")
        .select("id, entity_type, entity_id, action, after, occurred_at")
        .eq("org_id", orgId)
        .eq("portfolio_id", dbId)
        .in("action", ["lock"])
        .eq("entity_type", "ecl_period_snapshot")
        .order("occurred_at", { ascending: false })
        .limit(10);
      if (auditErr) throw auditErr;
      for (const row of (auditRows ?? []) as Array<{
        id: string; entity_id: string | null;
        after: { totalEcl?: number } | null;
        occurred_at: string;
      }>) {
        const ecl = row.after?.totalEcl;
        out.push({
          id:          `aud-${row.id}`,
          date:        row.occurred_at.slice(0, 10),
          type:        "period-lock",
          description: `Period locked: ${row.entity_id ?? "—"}`,
          impact:      ecl != null
            ? `Total ECL $${ecl.toFixed(1)}M frozen for IFRS-9 reporting`
            : "Period frozen for IFRS-9 reporting",
          source:      "audit_log",
        });
      }

      // Sort newest-first across both sources.
      out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      setEvents(out);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, activePortfolioId, lesseeUuid]);

  useEffect(() => { void fetchOnce(); }, [fetchOnce]);

  return { events, loading, error, refetch: fetchOnce };
}
