// src/app/hooks/useJurisdictions.ts
//
// Reads jurisdiction_lgd_overlays rows for the active portfolio and merges
// them with the hardcoded `jurisdictions` list. T-2.3 (jurisdiction watch
// real data) consumer wire.
//
// Merge strategy:
//   - Hardcoded entries carry narrative + flag emoji + sanctions text + AWG
//     alert text — fields the DB schema doesn't track yet. They serve as
//     the visual + textual baseline.
//   - DB rows override the NUMERIC fields (ctc_score, enforceability,
//     rule_of_law, P50/P90 repossession months, success prob, precedent
//     count, uncertainty band) for any jurisdiction the tenant has uploaded.
//   - Codes that exist in the DB but not the hardcoded list get synthesised
//     entries — flag falls back to a globe (🌐), narrative defaults to "Sourced
//     from your portfolio upload".
//
// When a tenant uploads their workbook with custom jurisdiction LGD overlays,
// those values flow through to JurisdictionDetail + LeaseGenerator +
// LeasePricingTab + RestructuringTab + reportGenerators without any of
// those consumers needing to know about the DB at all.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";
import {
  jurisdictions as HARDCODED_JURISDICTIONS,
  type Jurisdiction,
} from "../components/jurisdictions/jurisdictionData";

// ─── DB row type (mirror migration 20260524190000) ──────────────────────────

interface JurisdictionLgdRow {
  code:                string;
  name:                string;
  region:              string | null;
  ctc_party:           boolean | null;
  ctc_score:           number | null;
  alt_a:               boolean | null;
  idera:               boolean | null;
  enforceability:      number | null;
  rule_of_law:         number | null;
  p50_reposs_months:   number | null;
  p90_reposs_months:   number | null;
  p50_cost_pct:        number | null;
  success_prob:        number | null;
  lgd_delta_vs_us:     number | null;
  uncertainty_band:    "Low" | "Medium" | "High" | "Extreme" | null;
  precedent_count:     number | null;
  updated_at:          string;
}

// ─── Merger ─────────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

const UNCERTAINTY_MAP: Record<string, Jurisdiction["uncertaintyBand"]> = {
  Low: "low", Medium: "medium", High: "high", Extreme: "extreme",
};

/** Overlay ingested numeric fields onto a hardcoded baseline. */
function overlay(base: Jurisdiction, row: JurisdictionLgdRow): Jurisdiction {
  return {
    ...base,
    // Numeric overrides — only apply when DB has a non-null value, so a
    // tenant who uploaded a partial sheet doesn't blank out richer
    // hardcoded values.
    ctcParty:        row.ctc_party        ?? base.ctcParty,
    ctcScore:        row.ctc_score        ?? base.ctcScore,
    altA:            row.alt_a            ?? base.altA,
    idera:           row.idera            ?? base.idera,
    enforceability:  row.enforceability   ?? base.enforceability,
    ruleOfLaw:       row.rule_of_law      ?? base.ruleOfLaw,
    repossP50:       row.p50_reposs_months ?? base.repossP50,
    repossP90:       row.p90_reposs_months ?? base.repossP90,
    repossP50Cost:   row.p50_cost_pct != null ? fmtPct(row.p50_cost_pct) : base.repossP50Cost,
    successProb:     row.success_prob   != null ? fmtPct(row.success_prob)   : base.successProb,
    precedentCount:  row.precedent_count  ?? base.precedentCount,
    uncertaintyBand: row.uncertainty_band ? UNCERTAINTY_MAP[row.uncertainty_band] : base.uncertaintyBand,
    lastUpdated:     row.updated_at.slice(0, 10),
    region:          row.region ?? base.region,
  };
}

/** Synthesise a Jurisdiction object for a DB-only code (no hardcoded match). */
function synthesise(row: JurisdictionLgdRow): Jurisdiction {
  return {
    code:            row.code,
    country:         row.name,
    flag:            "🌐",
    region:          row.region ?? "—",
    ctcParty:        row.ctc_party ?? false,
    ctcScore:        row.ctc_score ?? 0,
    altA:            row.alt_a ?? false,
    idera:           row.idera ?? false,
    enforceability:  row.enforceability ?? 0,
    ruleOfLaw:       row.rule_of_law ?? 0,
    sanctions:       "—",
    repossP50:       row.p50_reposs_months ?? 0,
    repossP90:       row.p90_reposs_months ?? 0,
    repossP50Cost:   fmtPct(row.p50_cost_pct),
    repossP90Cost:   "—",
    successProb:     fmtPct(row.success_prob),
    precedentCount:  row.precedent_count ?? 0,
    narrative:       "Sourced from your portfolio upload — no narrative yet.",
    uncertaintyBand: row.uncertainty_band ? UNCERTAINTY_MAP[row.uncertainty_band] : "medium",
    lastUpdated:     row.updated_at.slice(0, 10),
  };
}

export function mergeJurisdictions(
  baseline: Jurisdiction[],
  rows: JurisdictionLgdRow[],
): Jurisdiction[] {
  const byCode = new Map<string, JurisdictionLgdRow>();
  for (const r of rows) byCode.set(r.code, r);

  const seenCodes = new Set<string>();
  const merged: Jurisdiction[] = baseline.map((j) => {
    const row = byCode.get(j.code);
    if (!row) return j;
    seenCodes.add(j.code);
    return overlay(j, row);
  });
  // DB-only codes — append synthesised entries.
  for (const r of rows) {
    if (!seenCodes.has(r.code)) {
      merged.push(synthesise(r));
    }
  }
  return merged;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UseJurisdictionsResult {
  /** Hardcoded baseline with any ingested overlay applied. */
  jurisdictions: Jurisdiction[];
  /** Raw DB rows for debugging / future consumers. */
  dbRows: JurisdictionLgdRow[];
  /** True iff any DB row is overlaid (i.e. user uploaded jurisdiction sheet). */
  hasIngested: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useJurisdictions(): UseJurisdictionsResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();
  const [dbRows, setDbRows] = useState<JurisdictionLgdRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId || !activePortfolioId) { setDbRows([]); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase
        .from("jurisdiction_lgd_overlays")
        .select("*")
        .eq("org_id", orgId)
        .eq("portfolio_id", activePortfolioId);
      if (e) throw e;
      setDbRows((data ?? []) as JurisdictionLgdRow[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, activePortfolioId]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  return {
    jurisdictions: mergeJurisdictions(HARDCODED_JURISDICTIONS, dbRows),
    dbRows,
    hasIngested: dbRows.length > 0,
    loading,
    error,
    refetch: fetchOnce,
  };
}
