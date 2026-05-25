// src/app/hooks/useAuditLog.ts
//
// T-3.4 — Reader hook for the universal audit_log.
//
// Returns the most-recent N events for the active portfolio + org-wide
// events (portfolio_id IS NULL). Lets the Settings → Audit Trail panel
// surface a single chronological feed.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";
import type { AuditAction } from "../services/auditLog";

export interface AuditLogEntry {
  id:          string;
  portfolioId: string | null;
  entityType:  string;
  entityId:    string | null;
  action:      AuditAction;
  before:      unknown;
  after:       unknown;
  actor:       string;
  occurredAt:  string;
  note:        string | null;
}

interface AuditLogRow {
  id:           string;
  org_id:       string;
  portfolio_id: string | null;
  entity_type:  string;
  entity_id:    string | null;
  action:       AuditAction;
  before:       unknown;
  after:        unknown;
  actor:        string;
  occurred_at:  string;
  note:         string | null;
}

function mapRow(r: AuditLogRow): AuditLogEntry {
  return {
    id:          r.id,
    portfolioId: r.portfolio_id,
    entityType:  r.entity_type,
    entityId:    r.entity_id,
    action:      r.action,
    before:      r.before,
    after:       r.after,
    actor:       r.actor,
    occurredAt:  r.occurred_at,
    note:        r.note,
  };
}

export interface UseAuditLogResult {
  entries: AuditLogEntry[];
  loading: boolean;
  error:   string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetch the last `limit` audit_log rows for the active portfolio OR
 * org-wide events (portfolio_id IS NULL). Default 100.
 */
export function useAuditLog(limit: number = 100): UseAuditLogResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId) { setEntries([]); return; }
    setLoading(true); setError(null);
    try {
      let q = supabase
        .from("audit_log")
        .select("*")
        .eq("org_id", orgId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (activePortfolioId) {
        // org-wide events (portfolio_id null) OR events for the active portfolio
        q = q.or(`portfolio_id.is.null,portfolio_id.eq.${activePortfolioId}`);
      }
      const { data, error: e } = await q;
      if (e) throw e;
      setEntries((data ?? []).map((r) => mapRow(r as AuditLogRow)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, activePortfolioId, limit]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  return { entries, loading, error, refetch: fetchOnce };
}
