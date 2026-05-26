// src/app/hooks/useAlertRules.ts
//
// T-5.1 — CRUD for alert_rules + read-only access to alert_sends.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";

export type AlertKind = "dpd_breach" | "stage_downgrade" | "watchlist_red" | "sanctions_hit";

export interface AlertRule {
  id:               string;
  portfolioId:      string | null;
  name:             string;
  kind:             AlertKind;
  threshold:        Record<string, unknown>;
  recipients:       string[];
  enabled:          boolean;
  cooldownMinutes:  number;
  createdAt:        string;
}

export interface AlertSend {
  id:           string;
  ruleId:       string;
  entityId:     string | null;
  entityLabel:  string | null;
  recipient:    string;
  status:       "sent" | "failed" | "skipped_cooldown";
  errorDetail:  string | null;
  sentAt:       string;
}

interface AlertRuleRow {
  id:                string;
  portfolio_id:      string | null;
  name:              string;
  kind:              AlertKind;
  threshold:         Record<string, unknown>;
  recipients:        string[];
  enabled:           boolean;
  cooldown_minutes:  number;
  created_at:        string;
}

interface AlertSendRow {
  id:            string;
  rule_id:       string;
  entity_id:     string | null;
  entity_label:  string | null;
  recipient:     string;
  status:        "sent" | "failed" | "skipped_cooldown";
  error_detail:  string | null;
  sent_at:       string;
}

function mapRule(r: AlertRuleRow): AlertRule {
  return {
    id:              r.id,
    portfolioId:     r.portfolio_id,
    name:            r.name,
    kind:            r.kind,
    threshold:       r.threshold,
    recipients:      r.recipients,
    enabled:         r.enabled,
    cooldownMinutes: r.cooldown_minutes,
    createdAt:       r.created_at,
  };
}

function mapSend(r: AlertSendRow): AlertSend {
  return {
    id:          r.id,
    ruleId:      r.rule_id,
    entityId:    r.entity_id,
    entityLabel: r.entity_label,
    recipient:   r.recipient,
    status:      r.status,
    errorDetail: r.error_detail,
    sentAt:      r.sent_at,
  };
}

export interface CreateRuleArgs {
  name:             string;
  kind:             AlertKind;
  threshold:        Record<string, unknown>;
  recipients:       string[];
  enabled?:         boolean;
  cooldownMinutes?: number;
  portfolioId?:     string | null;
}

export interface UseAlertRulesResult {
  rules:    AlertRule[];
  sends:    AlertSend[];
  loading:  boolean;
  error:    string | null;
  createRule: (args: CreateRuleArgs) => Promise<AlertRule | null>;
  updateRule: (id: string, patch: Partial<CreateRuleArgs>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  refetch:    () => Promise<void>;
}

export function useAlertRules(): UseAlertRulesResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [sends, setSends] = useState<AlertSend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId) return;
    setLoading(true); setError(null);
    try {
      const [{ data: r, error: rErr }, { data: s, error: sErr }] = await Promise.all([
        supabase.from("alert_rules").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
        supabase.from("alert_sends").select("*").eq("org_id", orgId).order("sent_at", { ascending: false }).limit(50),
      ]);
      if (rErr) throw rErr;
      if (sErr) throw sErr;
      setRules(((r ?? []) as AlertRuleRow[]).map(mapRule));
      setSends(((s ?? []) as AlertSendRow[]).map(mapSend));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void fetchOnce(); }, [fetchOnce]);

  const createRule = useCallback(async (args: CreateRuleArgs): Promise<AlertRule | null> => {
    if (!orgId) return null;
    const { data, error: e } = await supabase
      .from("alert_rules")
      .insert({
        org_id:           orgId,
        portfolio_id:     args.portfolioId ?? activePortfolioId,
        name:             args.name,
        kind:             args.kind,
        threshold:        args.threshold,
        recipients:       args.recipients,
        enabled:          args.enabled ?? true,
        cooldown_minutes: args.cooldownMinutes ?? 1440,
      })
      .select("*")
      .single();
    if (e) { setError(e.message); return null; }
    const inserted = mapRule(data as AlertRuleRow);
    setRules((prev) => [inserted, ...prev]);
    return inserted;
  }, [orgId, activePortfolioId]);

  const updateRule = useCallback(async (id: string, patch: Partial<CreateRuleArgs>): Promise<void> => {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name             !== undefined) update.name             = patch.name;
    if (patch.kind             !== undefined) update.kind             = patch.kind;
    if (patch.threshold        !== undefined) update.threshold        = patch.threshold;
    if (patch.recipients       !== undefined) update.recipients       = patch.recipients;
    if (patch.enabled          !== undefined) update.enabled          = patch.enabled;
    if (patch.cooldownMinutes  !== undefined) update.cooldown_minutes = patch.cooldownMinutes;
    const { error: e } = await supabase.from("alert_rules").update(update).eq("id", id);
    if (e) { setError(e.message); return; }
    await fetchOnce();
  }, [fetchOnce]);

  const deleteRule = useCallback(async (id: string): Promise<void> => {
    const { error: e } = await supabase.from("alert_rules").delete().eq("id", id);
    if (e) { setError(e.message); return; }
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { rules, sends, loading, error, createRule, updateRule, deleteRule, refetch: fetchOnce };
}
