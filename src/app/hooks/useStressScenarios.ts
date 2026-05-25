// src/app/hooks/useStressScenarios.ts
//
// Reads stress_scenarios + restructuring_presets rows for the active
// portfolio and synthesises Template-compatible objects that Scenarios.tsx
// can render alongside its hardcoded library. T-1.7 consumer wire.
//
// The DB row only carries macro inputs (weight, gdp_shock, fuel_delta,
// pd multipliers, deferral). Shapley breakdown, p5/p95 spread factors,
// keyFinding narrative — derived heuristically from the inputs because
// those are POST-RUN data, not config.
//
// Synthesised IDs: `DB-${slug}` so they never collide with hardcoded
// `TPL-001`…`TPL-I03` ids that INITIAL_RUNS references.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";
import { ZERO_INPUTS, BASE_ECL, computeECL, type ScenarioInputs } from "../utils/eclCalculator";

// ─── Row types (mirror migration 20260524180000) ────────────────────────────

export interface StressScenarioRow {
  id:                     string;
  org_id:                 string;
  portfolio_id:           string;
  name:                   string;
  slug:                   string;
  weight:                 number | null;
  gdp_shock_pct:          number | null;
  rpk_growth_pct:         number | null;
  fuel_delta_pct:         number | null;
  em_fx_stress_pct:       number | null;
  rate_rise_bps:          number | null;
  asset_value_shock_pct:  number | null;
  pd_s2_mult:             number | null;
  pd_s3_mult:             number | null;
  deferral_months:        number | null;
  govt_support_prob:      number | null;
  forgiveness_rate:       number | null;
  description:            string | null;
}

// ─── Template-compatible synthesis ──────────────────────────────────────────
//
// Imported here as a string literal because the Template interface is
// defined inside Scenarios.tsx (not exported). The synthesised object
// satisfies its shape. Consumers cast.

export interface SyntheticTemplate {
  id:            string;
  name:          string;
  description:   string;
  weight:        string;
  ecl:           number;
  lastRun:       string;
  color:         string;
  bg:            string;
  inputs:        ScenarioInputs;
  shapley:       { driver: string; contribution: number; direction: "up" | "down" }[];
  p5Factor:      number;
  p95Factor:     number;
  keyFinding:    string;
  tags?:         string[];
  category?:     "macro" | "distress" | "insolvency";
}

const DRIVER_LABELS: Record<keyof ScenarioInputs, string> = {
  gdpDelta:                "GDP Shock",
  rpkDelta:                "RPK Growth Shock",
  fuelDelta:               "Fuel Price Delta",
  fxDelta:                 "FX Basket Stress",
  rateDelta:               "Interest Rate Shift",
  assetValueDelta:         "Aircraft Market Value",
  pdS2Multi:               "PD — Stage 2 Multiplier",
  pdS3Multi:               "PD — Stage 3 Multiplier",
  deferralMonths:          "Rent Deferral Months",
  govtSupportProb:         "Govt Support Probability",
  forgivenessRate:         "Forgiveness Rate",
  pbhConversionPct:        "Power-by-Hour Conversion",
  etpRate:                 "Early-Termination Rate",
  lecRate:                 "Lease Extension Coverage",
  bankruptcyScenarioType:  "Bankruptcy Regime",
  leaseAssumptionPct:      "Lease Assumption %",
  ctcGoldPct:              "CTC Gold-Standard %",
  nonCtcPct:               "Non-CTC %",
  repossWeightedMonths:    "Repossession Timeline",
  remarketingMonths:       "Remarketing Months",
  lgdDecayAdjFactor:       "LGD Decay Adjustment",
  depositCoverage:         "Security Deposit Coverage",
  maintenanceReserveCoverage: "Maintenance Reserve Coverage",
  payBehaviourCoopPct:     "Pay Behaviour — Cooperative",
  payBehaviourAdvPct:      "Pay Behaviour — Adversarial",
  restructuringType:       "Restructuring Preset",
};

function rowToInputs(row: StressScenarioRow): ScenarioInputs {
  // ZERO_INPUTS as base; overlay the macro fields the DB row carries.
  // Fractions stored as fractions (0.40 = +40%), nothing to convert.
  return {
    ...ZERO_INPUTS,
    gdpDelta:        row.gdp_shock_pct          ?? 0,
    rpkDelta:        row.rpk_growth_pct         ?? 0,
    fuelDelta:       row.fuel_delta_pct         ?? 0,
    fxDelta:         row.em_fx_stress_pct       ?? 0,
    rateDelta:       (row.rate_rise_bps ?? 0) / 10_000, // bps → fraction (10000 bps = 100%)
    assetValueDelta: row.asset_value_shock_pct  ?? 0,
    pdS2Multi:       row.pd_s2_mult             ?? 1.0,
    pdS3Multi:       row.pd_s3_mult             ?? 1.0,
    deferralMonths:  row.deferral_months        ?? 0,
    govtSupportProb: row.govt_support_prob      ?? 0,
    forgivenessRate: row.forgiveness_rate       ?? 0,
  };
}

function synthShapley(inputs: ScenarioInputs): SyntheticTemplate["shapley"] {
  // Rank macro inputs by absolute magnitude → take top 5 → renormalise to 100.
  const candidates: Array<{ key: keyof ScenarioInputs; mag: number; dir: "up" | "down" }> = [
    { key: "gdpDelta",        mag: Math.abs(inputs.gdpDelta),        dir: inputs.gdpDelta        < 0 ? "down" : "up" },
    { key: "rpkDelta",        mag: Math.abs(inputs.rpkDelta),        dir: inputs.rpkDelta        < 0 ? "down" : "up" },
    { key: "fuelDelta",       mag: Math.abs(inputs.fuelDelta),       dir: inputs.fuelDelta       > 0 ? "up"   : "down" },
    { key: "fxDelta",         mag: Math.abs(inputs.fxDelta),         dir: inputs.fxDelta         < 0 ? "down" : "up" },
    { key: "assetValueDelta", mag: Math.abs(inputs.assetValueDelta), dir: inputs.assetValueDelta < 0 ? "down" : "up" },
    { key: "pdS2Multi",       mag: Math.abs(inputs.pdS2Multi - 1),   dir: "up" },
    { key: "pdS3Multi",       mag: Math.abs(inputs.pdS3Multi - 1),   dir: "up" },
    { key: "deferralMonths",  mag: inputs.deferralMonths / 24,       dir: "up" },
    { key: "forgivenessRate", mag: inputs.forgivenessRate,           dir: "up" },
  ].filter((c) => c.mag > 0);

  if (candidates.length === 0) {
    return [{ driver: "Baseline — No Stress Applied", contribution: 100, direction: "up" }];
  }
  candidates.sort((a, b) => b.mag - a.mag);
  const top = candidates.slice(0, 5);
  const total = top.reduce((s, x) => s + x.mag, 0);
  return top.map((x) => ({
    driver: DRIVER_LABELS[x.key],
    contribution: Math.round((x.mag / total) * 100),
    direction: x.dir,
  }));
}

function synthKeyFinding(name: string, ecl: number): string {
  const delta = ecl - BASE_ECL;
  const pct = (delta / BASE_ECL) * 100;
  if (Math.abs(pct) < 5) {
    return `${name}: ECL within ±5% of baseline ($${BASE_ECL}M). Portfolio resilient under this scenario.`;
  }
  if (pct > 0) {
    return `${name}: ECL rises to $${ecl.toFixed(1)}M (+${pct.toFixed(0)}% vs baseline). Review Stage 2/3 lessees and reserve adequacy.`;
  }
  return `${name}: ECL eases to $${ecl.toFixed(1)}M (${pct.toFixed(0)}% vs baseline). Suggests reserve release opportunity subject to forward-looking review.`;
}

export function rowToSyntheticTemplate(row: StressScenarioRow): SyntheticTemplate {
  const inputs = rowToInputs(row);
  const ecl    = computeECL(inputs);
  const shapley = synthShapley(inputs);
  const weight = row.weight != null ? `${Math.round(row.weight * 100)}%` : "—";
  return {
    id:          `DB-${row.slug}`,
    name:        row.name,
    description: row.description ?? `Imported from your portfolio workbook on ${new Date(row.id ? Date.now() : Date.now()).toLocaleDateString("en-GB")}.`,
    weight,
    ecl:         Math.round(ecl * 10) / 10,
    lastRun:     "—",
    color:       "#002147",
    bg:          "rgba(0,33,71,0.05)",
    inputs,
    shapley,
    p5Factor:    0.66,
    p95Factor:   1.84,
    keyFinding:  synthKeyFinding(row.name, ecl),
    tags:        ["Imported"],
    category:    "macro",
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UseStressScenariosResult {
  rows: StressScenarioRow[];
  templates: SyntheticTemplate[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStressScenarios(): UseStressScenariosResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();
  const [rows, setRows]       = useState<StressScenarioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId || !activePortfolioId) { setRows([]); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase
        .from("stress_scenarios")
        .select("*")
        .eq("org_id", orgId)
        .eq("portfolio_id", activePortfolioId)
        .order("name", { ascending: true });
      if (e) throw e;
      setRows((data ?? []) as StressScenarioRow[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, activePortfolioId]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  return {
    rows,
    templates: rows.map(rowToSyntheticTemplate),
    loading,
    error,
    refetch: fetchOnce,
  };
}
