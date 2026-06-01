// ─────────────────────────────────────────────────────────────────────────────
// scenarios/_shared.ts
//
// Pure module — types, constants, deterministic helpers, DSL codec, and style
// objects shared across the Scenarios shell (Scenarios.tsx) and the per-tab
// view components (LibraryTab, CustomBuilderTab, RunHistoryTab).
//
// IMPORTANT: this file MUST NOT import React. Only `import type` is allowed
// from React so the module stays JSX-free. Anything that needs to render JSX
// or use hooks lives in a sibling .tsx file.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from "react";
import { RESTRUCTURING_TYPES } from "../../utils/deferralRisk";
import {
  ScenarioInputs,
  BASE_ECL,
  ZERO_INPUTS,
  computeECL,
  computeECLFromBase,
  computeStages,
} from "../../utils/eclCalculator";
import type { ScenarioRunResult } from "../../components/scenarios/RunResultPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

// Path → PillTabs activeTab. Custom Builder is intentionally NOT here —
// it's a separate top-level page at /build, not a Scenarios sub-tab any
// more. The PillTabs row inside Scenarios only switches between Library
// and Run History; clicking "Custom Builder" in the sidebar takes the
// user out of /scenarios entirely.
export const PATH_TAB: Record<string, string> = {
  "/scenarios/library": "Library",
  "/scenarios/history": "Run History",
};

export type RunMode = "deterministic" | "montecarlo";

export type CardPhase = "idle" | "config" | "running" | "done";

export interface CardState {
  phase: CardPhase;
  mode: RunMode;
  paths: number;
  resultId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Computation Helpers ──────────────────────────────────────────────────────

export function seededRand(seed: number, salt: number): number {
  const x = Math.sin(seed * 9301 + salt * 49297 + 233) * 1_000_000;
  return x - Math.floor(x);
}

export function computeShapley(
  inputs: ScenarioInputs,
  ecl: number
): ScenarioRunResult["shapley"] {
  const delta = ecl - BASE_ECL;
  if (Math.abs(delta) < 0.5) {
    return [
      { driver: "PD — Stage 3 Multiplier", contribution: 34, direction: "up" },
      { driver: "LGD Rate (Stage 3)", contribution: 26, direction: "up" },
      { driver: "Aircraft Market Value", contribution: 19, direction: "down" },
      { driver: "Discount Rate (WACC)", contribution: 13, direction: "down" },
      { driver: "PD — Stage 2 Multiplier", contribution: 8, direction: "up" },
    ];
  }
  const raw = [
    { driver: "GDP Growth Shock", v: Math.abs(Math.min(0, inputs.gdpDelta) * -250), direction: "up" as const },
    { driver: "RPK / Traffic Shock", v: Math.abs(Math.min(0, inputs.rpkDelta) * -48), direction: "up" as const },
    { driver: "Fuel Price Shock", v: Math.max(0, inputs.fuelDelta * 28), direction: "up" as const },
    { driver: "FX Basket Move", v: Math.abs(Math.min(0, inputs.fxDelta) * -32), direction: "up" as const },
    { driver: "Aircraft Market Value", v: Math.abs(Math.min(0, inputs.assetValueDelta) * -52), direction: inputs.assetValueDelta < 0 ? "up" as const : "down" as const },
    { driver: "PD — Stage 2 Multiplier", v: Math.max(0, (inputs.pdS2Multi - 1.0) * 8.5), direction: "up" as const },
    { driver: "PD — Stage 3 Multiplier", v: Math.max(0, (inputs.pdS3Multi - 1.0) * 18.2), direction: "up" as const },
    { driver: "Discount Rate (WACC)", v: Math.max(0, inputs.rateDelta * 14), direction: "down" as const },
  ].filter((d) => d.v > 0.1);
  const total = raw.reduce((s, d) => s + d.v, 0) || 1;
  return raw
    .map((d) => ({ driver: d.driver, contribution: Math.round((d.v / total) * 100), direction: d.direction }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5);
}

export function computeMCRange(ecl: number, seed: number) {
  const p5  = ecl * (0.58 + seededRand(seed, 1) * 0.08);
  const p95 = ecl * (1.68 + seededRand(seed, 2) * 0.38);
  return { p5, p95 };
}

export function hashFromSeed(seed: number): string {
  return [...Array(12)]
    .map((_, i) => Math.floor(seededRand(seed, i) * 16).toString(16))
    .join("");
}

// ─── Narrative Helpers ────────────────────────────────────────────────────────

export const STAGE3_LESSEES = [
  { name: "IndiGo Airlines",         jurisdiction: "India (IBC)" },
  { name: "Aeromexico",              jurisdiction: "Mexico (Concurso Mercantil)" },
  { name: "SriLankan Airlines",      jurisdiction: "Sri Lanka (Liquidation)" },
  { name: "Azul Brazilian Airlines", jurisdiction: "Brazil (Recuperação Judicial)" },
  { name: "Air Transat",             jurisdiction: "Canada (CCAA)" },
] as const;

export function computeTopLessees(
  s3: number,
  seed: number,
  lesseePool: ReadonlyArray<{ name: string; jurisdiction: string }> = STAGE3_LESSEES,
): ScenarioRunResult["topLessees"] {
  const n = lesseePool.length;
  if (n === 0) return [];
  const idx1 = Math.floor(seededRand(seed, 20) * n);
  if (n === 1) {
    return [{ ...lesseePool[idx1], ecl: parseFloat((s3 * 0.45).toFixed(1)) }];
  }
  // idx2 starts one step past idx1 then adds 0..n-2, so it can never equal idx1
  const idx2 = (idx1 + 1 + Math.floor(seededRand(seed, 21) * (n - 1))) % n;
  return [
    // Top lessee bears 45% of Stage 3 ECL; second lessee bears 28% (per narrative spec)
    { ...lesseePool[idx1], ecl: parseFloat((s3 * 0.45).toFixed(1)) },
    { ...lesseePool[idx2], ecl: parseFloat((s3 * 0.28).toFixed(1)) },
  ];
}

export function computeS3LeaseCount(s3: number): number {
  return Math.max(1, Math.round(s3 / 8.2));
}

let runCounter = 848;
export function nextRunId(): string {
  return `RUN-2024-0${runCounter++}`;
}

export function buildRun(
  name: string,
  inputs: ScenarioInputs,
  mode: RunMode,
  paths: number,
  seed: number,
  templateId: string | null,
  presetECL?: number,
  lesseePool: ReadonlyArray<{ name: string; jurisdiction: string }> = STAGE3_LESSEES,
): ScenarioRunResult {
  const ecl = presetECL ?? computeECL(inputs);
  const stages = computeStages(ecl, inputs);
  const shapley = computeShapley(inputs, ecl);
  const { p5, p95 } = computeMCRange(ecl, seed);
  const durSec =
    mode === "deterministic"
      ? `${(1.4 + seededRand(seed, 9) * 1.4).toFixed(1)}s`
      : `${Math.round(28 + seededRand(seed, 11) * 20)}s`;

  const eclDelta = ecl - BASE_ECL;
  const keyFindings: string[] = [];
  if (eclDelta > 100) keyFindings.push(`ECL ${((eclDelta / BASE_ECL) * 100).toFixed(0)}% above baseline — systemic stress event.`);
  else if (eclDelta > 40) keyFindings.push(`ECL ${((eclDelta / BASE_ECL) * 100).toFixed(0)}% above baseline — elevated stress scenario.`);
  else if (eclDelta > 10) keyFindings.push(`Moderate ECL increase of $${eclDelta.toFixed(1)}M vs baseline.`);
  else keyFindings.push(`ECL within ±5% of baseline. Portfolio resilient under this scenario.`);
  if (inputs.rpkDelta < -0.30) keyFindings.push(`RPK shock of ${(inputs.rpkDelta * 100).toFixed(0)}% driving stage migrations.`);
  if (inputs.pdS3Multi > 1.5) keyFindings.push(`PD multiplier ×${inputs.pdS3Multi.toFixed(1)} on Stage 3 — review 3 highest-exposure lessees.`);
  if (mode === "montecarlo") keyFindings.push(`P95 tail: $${p95.toFixed(1)}M — reserve adequacy check recommended.`);

  return {
    id: nextRunId(),
    templateId,
    name,
    mode,
    paths: mode === "montecarlo" ? paths : null,
    seed,
    runDate: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", ""),
    durationSec: durSec,
    ecl,
    p5: mode === "montecarlo" ? p5 : null,
    p95: mode === "montecarlo" ? p95 : null,
    s1: stages.s1,
    s2: stages.s2,
    s3: stages.s3,
    shapley,
    keyFinding: keyFindings.join(" "),
    scenarioHash: hashFromSeed(seed).slice(0, 12),
    topLessees: computeTopLessees(stages.s3, seed, lesseePool),
    s3LeaseCount: computeS3LeaseCount(stages.s3),
  };
}

// ─── Static Template Data ─────────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  description: string;
  weight: string;
  ecl: number;  // $M — pre-defined output
  lastRun: string;
  color: string;
  bg: string;
  inputs: ScenarioInputs;
  shapley: ScenarioRunResult["shapley"];
  p5Factor: number;
  p95Factor: number;
  keyFinding: string;
  tags?: string[];                         // display pills on the card
  category?: "macro" | "distress" | "insolvency";  // used for Library sub-group labels
}

export const TEMPLATES: Template[] = [
  {
    id: "TPL-001", name: "Baseline", weight: "60%", ecl: 47.2, category: "macro" as const,
    lastRun: "29 Apr 2026", color: "#002147", bg: "rgba(0,33,71,0.05)",
    description: "Current macro conditions. GDP growth as IMF forecast, fuel at forward curve, lessee ratings held.",
    inputs: ZERO_INPUTS,
    shapley: [
      { driver: "PD — Stage 3 Multiplier", contribution: 34, direction: "up" },
      { driver: "LGD Rate (Stage 3)", contribution: 26, direction: "up" },
      { driver: "Aircraft Market Value", contribution: 19, direction: "down" },
      { driver: "Discount Rate (WACC)", contribution: 13, direction: "down" },
      { driver: "PD — Stage 2 Multiplier", contribution: 8, direction: "up" },
    ],
    p5Factor: 0.64, p95Factor: 1.89,
    keyFinding: "2 stage migrations detected vs prior period. Portfolio ECL stable at 1.66% of book value. No new Stage 3 entries this period.",
  },
  {
    id: "TPL-002", name: "COVID-Mild", weight: "15%", ecl: 68.4, category: "macro" as const,
    lastRun: "28 Apr 2026", color: "#B45309", bg: "rgba(180,83,9,0.05)",
    description: "Mild aviation demand shock. RPK −25%, fuel +15%, 3 stage-2 migrations, no bankruptcies.",
    inputs: { gdpDelta: -0.015, rpkDelta: -0.25, fuelDelta: 0.15, fxDelta: -0.05, rateDelta: 0, assetValueDelta: -0.08, pdS2Multi: 1.4, pdS3Multi: 1.15, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null, ctcGoldPct: 0, nonCtcPct: 0, depositCoverage: 0, payBehaviourCoopPct: 0, payBehaviourAdvPct: 0, restructuringType: null, leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0, remarketingMonths: 0, lgdDecayAdjFactor: 0 },
    shapley: [
      { driver: "RPK / Traffic Shock (−25%)", contribution: 38, direction: "up" },
      { driver: "PD — Stage 2 Multiplier ×1.4", contribution: 27, direction: "up" },
      { driver: "Fuel Price Shock (+15%)", contribution: 16, direction: "up" },
      { driver: "Aircraft Market Value", contribution: 12, direction: "up" },
      { driver: "PD — Stage 3 Multiplier", contribution: 7, direction: "up" },
    ],
    p5Factor: 0.61, p95Factor: 1.94,
    keyFinding: "3 Stage 2 migrations. Low-cost carrier exposure is the dominant driver. No Stage 3 events in this scenario. ECL 45% above baseline.",
  },
  {
    id: "TPL-003", name: "COVID-Severe", weight: "10%", ecl: 124.7, category: "macro" as const,
    lastRun: "27 Apr 2026", color: "#B91C1C", bg: "rgba(185,28,28,0.05)",
    description: "Severe demand shock. RPK −55%, fuel −30%, 8+ bankruptcies, mass deferral requests.",
    inputs: { gdpDelta: -0.04, rpkDelta: -0.55, fuelDelta: -0.30, fxDelta: -0.10, rateDelta: -0.005, assetValueDelta: -0.22, pdS2Multi: 2.4, pdS3Multi: 2.1, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null, ctcGoldPct: 0, nonCtcPct: 0, depositCoverage: 0, payBehaviourCoopPct: 0, payBehaviourAdvPct: 0, restructuringType: null, leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0, remarketingMonths: 0, lgdDecayAdjFactor: 0 },
    shapley: [
      { driver: "RPK / Traffic Shock (−55%)", contribution: 41, direction: "up" },
      { driver: "PD — Stage 3 Multiplier ×2.1", contribution: 28, direction: "up" },
      { driver: "Aircraft Market Value (−22%)", contribution: 17, direction: "up" },
      { driver: "PD — Stage 2 Multiplier ×2.4", contribution: 9, direction: "up" },
      { driver: "FX Basket Move", contribution: 5, direction: "up" },
    ],
    p5Factor: 0.59, p95Factor: 2.01,
    keyFinding: "ECL 164% above baseline. P95 tail: $250.9M. 12 projected Stage 3 migrations. 8 lessee insolvency risk events modelled.",
  },
  {
    id: "TPL-004", name: "Fuel Spike (+40%)", weight: "7%", ecl: 71.3, category: "macro" as const,
    lastRun: "25 Apr 2026", color: "#B45309", bg: "rgba(180,83,9,0.05)",
    description: "Sustained fuel price increase of 40% vs baseline. Low-cost carriers most exposed.",
    inputs: { gdpDelta: -0.005, rpkDelta: -0.08, fuelDelta: 0.40, fxDelta: 0, rateDelta: 0.005, assetValueDelta: -0.06, pdS2Multi: 1.6, pdS3Multi: 1.2, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null, ctcGoldPct: 0, nonCtcPct: 0, depositCoverage: 0, payBehaviourCoopPct: 0, payBehaviourAdvPct: 0, restructuringType: null, leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0, remarketingMonths: 0, lgdDecayAdjFactor: 0 },
    shapley: [
      { driver: "Fuel Price Shock (+40%)", contribution: 43, direction: "up" },
      { driver: "PD — Stage 2 Multiplier ×1.6", contribution: 30, direction: "up" },
      { driver: "Aircraft Market Value (−6%)", contribution: 12, direction: "up" },
      { driver: "RPK Impact (reduced pax demand)", contribution: 10, direction: "up" },
      { driver: "Discount Rate (+50bps)", contribution: 5, direction: "up" },
    ],
    p5Factor: 0.62, p95Factor: 1.87,
    keyFinding: "LCC portfolio segment ECL up 68%. Long-haul carriers less affected. Fuel-hedged lessees' Stage 2 exposure contained.",
  },
  {
    id: "TPL-005", name: "Sovereign Stress", weight: "5%", ecl: 89.1, category: "macro" as const,
    lastRun: "25 Apr 2026", color: "#0369A1", bg: "rgba(3,105,161,0.05)",
    description: "EM sovereign stress. India, Brazil, Indonesia CDS widen +250bps. FX pressure −15%.",
    inputs: { gdpDelta: -0.02, rpkDelta: -0.12, fuelDelta: 0.05, fxDelta: -0.15, rateDelta: 0.025, assetValueDelta: -0.12, pdS2Multi: 1.7, pdS3Multi: 1.5, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null, ctcGoldPct: 0, nonCtcPct: 0, depositCoverage: 0, payBehaviourCoopPct: 0, payBehaviourAdvPct: 0, restructuringType: null, leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0, remarketingMonths: 0, lgdDecayAdjFactor: 0 },
    shapley: [
      { driver: "Sovereign CDS Widening (+250bps)", contribution: 36, direction: "up" },
      { driver: "FX Basket Move (−15%)", contribution: 29, direction: "up" },
      { driver: "PD — Country Multiplier (EM)", contribution: 22, direction: "up" },
      { driver: "Aircraft Market Value (EM adj.)", contribution: 8, direction: "up" },
      { driver: "Discount Rate (WACC)", contribution: 5, direction: "down" },
    ],
    p5Factor: 0.60, p95Factor: 1.92,
    keyFinding: "India, Brazil, Indonesia exposure elevated. EM currency basket effect accounts for 29% of incremental ECL. 5 Stage 2 migrations projected.",
  },
  {
    id: "TPL-006", name: "Currency Collapse", weight: "3%", ecl: 103.5, category: "macro" as const,
    lastRun: "22 Apr 2026", color: "#B91C1C", bg: "rgba(185,28,28,0.05)",
    description: "EM currency basket −35% vs USD. Rent-to-revenue ratios spike. 6+ lessee distress events.",
    inputs: { gdpDelta: -0.025, rpkDelta: -0.18, fuelDelta: 0.08, fxDelta: -0.35, rateDelta: 0.02, assetValueDelta: -0.15, pdS2Multi: 2.0, pdS3Multi: 1.8, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null, ctcGoldPct: 0, nonCtcPct: 0, depositCoverage: 0, payBehaviourCoopPct: 0, payBehaviourAdvPct: 0, restructuringType: null, leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0, remarketingMonths: 0, lgdDecayAdjFactor: 0 },
    shapley: [
      { driver: "FX Basket Move (−35%)", contribution: 48, direction: "up" },
      { driver: "Rent-to-Revenue Ratio Spike", contribution: 27, direction: "up" },
      { driver: "PD — Stage 3 Multiplier ×1.8", contribution: 14, direction: "up" },
      { driver: "Aircraft Market Value (USD adj.)", contribution: 8, direction: "up" },
      { driver: "Sovereign Correlation", contribution: 3, direction: "up" },
    ],
    p5Factor: 0.60, p95Factor: 1.97,
    keyFinding: "FX basket decline drives 48% of incremental ECL. USD-denominated rent obligations unsustainable for 6 EM-domiciled lessees.",
  },
  {
    id: "TPL-007", name: "Russia-Style Expropriation", weight: "—", ecl: 242.8, category: "macro" as const,
    lastRun: "14 Jan 2026", color: "#B91C1C", bg: "rgba(185,28,28,0.08)",
    description: "Sudden fleet detention in 2 jurisdictions. Repossession impossible. Full LGD on 12 aircraft.",
    inputs: { gdpDelta: 0, rpkDelta: -0.20, fuelDelta: 0, fxDelta: -0.20, rateDelta: 0, assetValueDelta: -0.40, pdS2Multi: 1.2, pdS3Multi: 4.8, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null, ctcGoldPct: 0, nonCtcPct: 0, depositCoverage: 0, payBehaviourCoopPct: 0, payBehaviourAdvPct: 0, restructuringType: null, leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0, remarketingMonths: 0, lgdDecayAdjFactor: 0 },
    shapley: [
      { driver: "Jurisdiction: Full LGD (100%)", contribution: 52, direction: "up" },
      { driver: "Aircraft Detention (12 assets)", contribution: 29, direction: "up" },
      { driver: "Recovery Probability (0%)", contribution: 12, direction: "up" },
      { driver: "MR / SD Offset (trapped)", contribution: 5, direction: "up" },
      { driver: "Cross-Default Risk", contribution: 2, direction: "up" },
    ],
    p5Factor: 0.72, p95Factor: 1.42,
    keyFinding: "Full asset detention in 2 jurisdictions. 12 aircraft at zero recovery. ECL 415% above baseline. CTC Alt-A not enforceable in scenario jurisdiction.",
  },

  // ── Distress Scenarios ────────────────────────────────────────────────────
  {
    id: "TPL-D01", name: "COVID-Style Deferral Wave", weight: "—", ecl: 88.0,
    lastRun: "Never", color: "#B91C1C", bg: "rgba(185,28,28,0.05)",
    category: "distress" as const,
    tags: ["Deferral", "Govt Support", "PBH"],
    description: "Mass deferral requests across the fleet triggered by a severe traffic collapse. Government backstops ~35% of exposure. Half of deferred rent forgiven. 20% of fleet switches to Power-by-Hour.",
    inputs: {
      gdpDelta: -0.03, rpkDelta: -0.55, fuelDelta: -0.30,
      fxDelta: 0, rateDelta: -0.005, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 1.0,
      deferralMonths: 9, govtSupportProb: 0.35, forgivenessRate: 0.50,
      pbhConversionPct: 0.20, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: null,
      ctcGoldPct: 0, nonCtcPct: 0,
      depositCoverage: 0,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
      restructuringType: null,
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
      remarketingMonths: 0, lgdDecayAdjFactor: 0,
    },
    shapley: [
      { driver: "RPK / Traffic Shock (−55%)", contribution: 42, direction: "up" as const },
      { driver: "Deferral Penalty (9mo × 50% forgiven)", contribution: 28, direction: "up" as const },
      { driver: "GDP Contraction (−3%)", contribution: 15, direction: "up" as const },
      { driver: "Govt Support (−35% offset)", contribution: 10, direction: "down" as const },
      { driver: "PBH Conversion (−20% fleet)", contribution: 5, direction: "down" as const },
    ],
    p5Factor: 0.60, p95Factor: 1.98,
    keyFinding: "Deferral penalty adds $8.4M above macro ECL. Government support mitigates $4.5M. PBH conversion recovers $1.4M. Net distress impact: +$6.9M vs macro-only equivalent.",
  },
  {
    id: "TPL-D02", name: "Bilateral Restructuring", weight: "—", ecl: 80.2,
    lastRun: "Never", color: "#0369A1", bg: "rgba(3,105,161,0.05)",
    category: "distress" as const,
    tags: ["Deferral", "Govt Support", "ETP", "LEC"],
    description: "Single lessee in distress. Negotiated 6-month deferral with 60% government backstop and 25% forgiveness. Lessor recovers ETP (15%) and LEC (10%) on restructured leases.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.20, fuelDelta: 0,
      fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.5, pdS3Multi: 2.0,
      deferralMonths: 6, govtSupportProb: 0.60, forgivenessRate: 0.25,
      pbhConversionPct: 0, etpRate: 0.15, lecRate: 0.10,
      bankruptcyScenarioType: null,
      ctcGoldPct: 0, nonCtcPct: 0,
      depositCoverage: 0,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
      restructuringType: null,
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
      remarketingMonths: 0, lgdDecayAdjFactor: 0,
    },
    shapley: [
      { driver: "Stage 3 PD Multiplier ×2.0", contribution: 45, direction: "up" as const },
      { driver: "Stage 2 PD Multiplier ×1.5", contribution: 22, direction: "up" as const },
      { driver: "RPK Shock (−20%)", contribution: 18, direction: "up" as const },
      { driver: "ETP Recovery (15%)", contribution: 9, direction: "down" as const },
      { driver: "LEC Recovery (10%)", contribution: 6, direction: "down" as const },
    ],
    p5Factor: 0.62, p95Factor: 1.91,
    keyFinding: "High govt support (60%) significantly dampens deferral ECL. ETP + LEC together recover $1.8M. Net deferral impact after mitigation: +$0.9M. Strong PD stress drives the bulk of ECL uplift.",
  },
  {
    id: "TPL-D03", name: "Early Termination Wave", weight: "—", ecl: 60.9,
    lastRun: "Never", color: "#15803D", bg: "rgba(21,128,61,0.05)",
    category: "distress" as const,
    tags: ["ETP", "LEC", "Asset Stress"],
    description: "Lessor-driven early terminations to maximise recovery before defaults crystallise. Short 3-month deferral with minimal forgiveness. Strong ETP (35%) and LEC (20%) recovery partially offsets losses.",
    inputs: {
      gdpDelta: 0, rpkDelta: 0, fuelDelta: 0,
      fxDelta: 0, rateDelta: 0, assetValueDelta: -0.15,
      pdS2Multi: 1.8, pdS3Multi: 1.0,
      deferralMonths: 3, govtSupportProb: 0, forgivenessRate: 0.10,
      pbhConversionPct: 0, etpRate: 0.35, lecRate: 0.20,
      bankruptcyScenarioType: null,
      ctcGoldPct: 0, nonCtcPct: 0,
      depositCoverage: 0,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
      restructuringType: null,
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
      remarketingMonths: 0, lgdDecayAdjFactor: 0,
    },
    shapley: [
      { driver: "Stage 2 PD Multiplier ×1.8", contribution: 38, direction: "up" as const },
      { driver: "Asset Value Decline (−15%)", contribution: 32, direction: "up" as const },
      { driver: "ETP Recovery (35%)", contribution: 20, direction: "down" as const },
      { driver: "LEC Recovery (20%)", contribution: 8, direction: "down" as const },
      { driver: "Deferral Penalty (3mo × 10%)", contribution: 2, direction: "up" as const },
    ],
    p5Factor: 0.65, p95Factor: 1.82,
    keyFinding: "Lessor mitigation is the story here: ETP + LEC together recover $2.8M, nearly eliminating the deferral penalty. Net distress impact: −$0.9M (mitigation exceeds penalty). ECL driven primarily by asset value decline and Stage 2 migration.",
  },

  // ── Insolvency Scenarios ──────────────────────────────────────────────────
  {
    id: "TPL-I01", name: "US Ch.11 §1110 Restructuring", weight: "—", ecl: 59.7,
    lastRun: "Never", color: "#15803D", bg: "rgba(21,128,61,0.05)",
    category: "insolvency" as const,
    tags: ["Ch.11", "§1110", "Lessor-Favorable"],
    description: "Lessee files Chapter 11. §1110 gives lessor a 60-day cure window — lease assumed or lessor repossesses. Strongest recovery position of all modelled regimes.",
    inputs: {
      gdpDelta: 0, rpkDelta: 0, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 2.0,
      deferralMonths: 3, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "chapter11",
      ctcGoldPct: 0, nonCtcPct: 0,
      depositCoverage: 0,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
      restructuringType: null,
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
      remarketingMonths: 0, lgdDecayAdjFactor: 0,
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×2.0)", contribution: 55, direction: "up" as const },
      { driver: "Ch.11 §1110 Recovery Premium (−12%)", contribution: 30, direction: "down" as const },
      { driver: "Short Deferral Buffer (3 months)", contribution: 10, direction: "up" as const },
      { driver: "Automatic Stay Protection", contribution: 5, direction: "down" as const },
    ],
    p5Factor: 0.70, p95Factor: 1.75,
    keyFinding: "Ch.11 §1110 is the gold standard for lessor recovery. The −12% LGD premium partially offsets PD stress. Net ECL uplift from baseline: +$12.5M — the lowest of all insolvency regimes.",
  },
  {
    id: "TPL-I02", name: "India IBC Restructuring", weight: "—", ecl: 76.9,
    lastRun: "Never", color: "#0369A1", bg: "rgba(3,105,161,0.05)",
    category: "insolvency" as const,
    tags: ["IBC", "CTC 2025", "Moderate"],
    description: "Lessee enters IBC moratorium. CTC Act 2025 mandates 90-day repossession window. Court congestion and political pressure on airline employers remain tail risks.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.10, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 2.5,
      deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "india_ibc",
      ctcGoldPct: 0, nonCtcPct: 0,
      depositCoverage: 0,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
      restructuringType: null,
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
      remarketingMonths: 0, lgdDecayAdjFactor: 0,
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×2.5)", contribution: 48, direction: "up" as const },
      { driver: "RPK Shock (−10%)", contribution: 26, direction: "up" as const },
      { driver: "IBC §14 Moratorium Delay", contribution: 16, direction: "up" as const },
      { driver: "CTC Act 2025 Recovery Premium (−5%)", contribution: 10, direction: "down" as const },
    ],
    p5Factor: 0.62, p95Factor: 1.88,
    keyFinding: "CTC Act 2025 provides a meaningful improvement over the pre-2025 IBC position. −5% LGD premium partially offsets. Net ECL uplift: +$29.7M, driven by elevated PD stress and RPK shock.",
  },
  {
    id: "TPL-I03", name: "Mexico Concurso Mercantil", weight: "—", ecl: 67.5,
    lastRun: "Never", color: "#B45309", bg: "rgba(180,83,9,0.05)",
    category: "insolvency" as const,
    tags: ["Concurso", "CTC", "Moderate"],
    description: "Lessee enters Concurso. CTC in force; conciliador reviews leases within 90 days. Can convert to quiebra (liquidation) in contested cases.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.10, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 1.8,
      deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "mexico_concurso",
      ctcGoldPct: 0, nonCtcPct: 0,
      depositCoverage: 0,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
      restructuringType: null,
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
      remarketingMonths: 0, lgdDecayAdjFactor: 0,
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×1.8)", contribution: 52, direction: "up" as const },
      { driver: "RPK Shock (−10%)", contribution: 27, direction: "up" as const },
      { driver: "Concurso Restructuring Uncertainty (+2%)", contribution: 13, direction: "up" as const },
      { driver: "CTC-Aligned Recovery Offset", contribution: 8, direction: "down" as const },
    ],
    p5Factor: 0.64, p95Factor: 1.82,
    keyFinding: "CTC in force keeps Concurso roughly neutral on LGD (+2%). Net ECL uplift: +$20.3M. Quiebra conversion is the primary tail — if Concurso fails, scenario transitions to generic liquidation dynamics.",
  },
  {
    id: "TPL-I04", name: "Brazil RJ (Recuperação Judicial)", weight: "—", ecl: 74.5,
    lastRun: "Never", color: "#92400E", bg: "rgba(146,64,14,0.05)",
    category: "insolvency" as const,
    tags: ["RJ", "Extended Stay", "Cram-down Risk"],
    description: "Lessee files RJ. 180-day stay with extensions common (AerCap LATAM precedent: 380 days). RJ plan can cram down lessor with 55% creditor vote majority.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.15, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 2.0,
      deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "brazil_rj",
      ctcGoldPct: 0, nonCtcPct: 0,
      depositCoverage: 0,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
      restructuringType: null,
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
      remarketingMonths: 0, lgdDecayAdjFactor: 0,
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×2.0)", contribution: 44, direction: "up" as const },
      { driver: "RPK Shock (−15%)", contribution: 35, direction: "up" as const },
      { driver: "Extended Stay LGD Penalty (+4%)", contribution: 12, direction: "up" as const },
      { driver: "Cram-down 55% Majority Risk", contribution: 9, direction: "up" as const },
    ],
    p5Factor: 0.60, p95Factor: 1.92,
    keyFinding: "Brazil RJ's +4% LGD penalty reflects the AerCap LATAM 380-day stay precedent. All shapley drivers point upward — no recovery offset. Net ECL uplift: +$27.3M.",
  },
  {
    id: "TPL-I05", name: "Indonesia PKPU", weight: "—", ecl: 85.9,
    lastRun: "Never", color: "#B91C1C", bg: "rgba(185,28,28,0.05)",
    category: "insolvency" as const,
    tags: ["PKPU", "Non-CTC", "High Risk"],
    description: "Lessee enters PKPU suspension. Indonesia is not a Cape Town Convention signatory. Up to 270-day maximum suspension; government typically pressures for airline continuity.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.15, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: 0,
      pdS2Multi: 1.0, pdS3Multi: 2.5,
      deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "indonesia_pkpu",
      ctcGoldPct: 0, nonCtcPct: 0,
      depositCoverage: 0,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
      restructuringType: null,
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
      remarketingMonths: 0, lgdDecayAdjFactor: 0,
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×2.5)", contribution: 38, direction: "up" as const },
      { driver: "RPK Shock (−15%)", contribution: 25, direction: "up" as const },
      { driver: "Non-CTC LGD Penalty (+9%)", contribution: 24, direction: "up" as const },
      { driver: "Govt Airline Continuity Pressure", contribution: 13, direction: "up" as const },
    ],
    p5Factor: 0.58, p95Factor: 2.05,
    keyFinding: "Indonesia PKPU is the highest-risk named regime. The +9% LGD penalty reflects the absence of Cape Town Convention protections. Net ECL uplift: +$38.7M. Wide P5–P95 range reflects enforcement unpredictability.",
  },
  {
    id: "TPL-I06", name: "Generic Ch.7 / Civil-Law Liquidation", weight: "—", ecl: 118.4,
    lastRun: "Never", color: "#7C3AED", bg: "rgba(124,58,237,0.05)",
    category: "insolvency" as const,
    tags: ["Ch.7", "Liquidation", "Full Loss"],
    description: "Full liquidation. Lessor ranks pari passu with general unsecured creditors absent perfected security interest. Applies to any jurisdiction not covered by the five named regimes.",
    inputs: {
      gdpDelta: 0, rpkDelta: -0.25, fuelDelta: 0, fxDelta: 0, rateDelta: 0, assetValueDelta: -0.10,
      pdS2Multi: 1.0, pdS3Multi: 3.5,
      deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0,
      pbhConversionPct: 0, etpRate: 0, lecRate: 0,
      bankruptcyScenarioType: "generic_liquidation",
      ctcGoldPct: 0, nonCtcPct: 0,
      depositCoverage: 0,
      payBehaviourCoopPct: 0,
      payBehaviourAdvPct: 0,
      restructuringType: null,
      leaseAssumptionPct: 0, repossWeightedMonths: 0, maintenanceReserveCoverage: 0,
      remarketingMonths: 0, lgdDecayAdjFactor: 0,
    },
    shapley: [
      { driver: "Stage 3 PD Stress (×3.5)", contribution: 40, direction: "up" as const },
      { driver: "Full Liquidation LGD Penalty (+18%)", contribution: 24, direction: "up" as const },
      { driver: "RPK Collapse (−25%)", contribution: 22, direction: "up" as const },
      { driver: "Asset Value Decline (−10%)", contribution: 14, direction: "up" as const },
    ],
    p5Factor: 0.45, p95Factor: 2.35,
    keyFinding: "Worst-case outcome. All four shapley drivers are upward — no recovery offsets. Net ECL uplift: +$71.2M vs baseline. Used as the floor assumption for any unmodelled jurisdiction.",
  },
];

// ─── Pre-seeded Run History ───────────────────────────────────────────────────

export function buildTemplateRun(
  id: string, tpl: Template, mode: RunMode, paths: number | null,
  seed: number, dateStr: string, durStr: string,
  baseECL: number = BASE_ECL,
): ScenarioRunResult {
  const computedECL = computeECLFromBase(baseECL, tpl.inputs);
  const { p5, p95 } = computeMCRange(computedECL, seed);
  const stages = computeStages(computedECL, tpl.inputs);
  return {
    id, templateId: tpl.id, name: tpl.name, mode,
    paths: mode === "montecarlo" ? (paths ?? 10000) : null,
    seed, runDate: dateStr, durationSec: durStr,
    ecl: computedECL,
    p5: mode === "montecarlo" ? computedECL * tpl.p5Factor : null,
    p95: mode === "montecarlo" ? computedECL * tpl.p95Factor : null,
    s1: stages.s1, s2: stages.s2, s3: stages.s3,
    shapley: tpl.shapley, keyFinding: tpl.keyFinding,
    scenarioHash: hashFromSeed(seed).slice(0, 12),
    topLessees: computeTopLessees(stages.s3, seed),
    s3LeaseCount: computeS3LeaseCount(stages.s3),
  };
}

export const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;

export const INITIAL_RUNS: ScenarioRunResult[] = [
  buildTemplateRun("RUN-2024-0847", byId("TPL-001"), "deterministic", null, 42, "29 Apr 2026, 09:14", "2.1s"),
  buildTemplateRun("RUN-2024-0846", byId("TPL-004"), "montecarlo", 10000, 137, "28 Apr 2026, 16:32", "41s"),
  buildTemplateRun("RUN-2024-0845", byId("TPL-003"), "montecarlo", 10000, 291, "27 Apr 2026, 11:20", "44s"),
  buildTemplateRun("RUN-2024-0844", byId("TPL-005"), "deterministic", null, 88, "25 Apr 2026, 14:05", "1.8s"),
  buildTemplateRun("RUN-2024-0843", byId("TPL-006"), "montecarlo", 10000, 512, "25 Apr 2026, 09:33", "38s"),
  buildTemplateRun("RUN-2024-0842", byId("TPL-001"), "deterministic", null, 39, "14 Jan 2026, 09:00", "1.9s"),
  {
    id: "RUN-2024-0841", templateId: null, name: "Custom — IndiGo Default",
    mode: "montecarlo", paths: 5000, seed: 77,
    runDate: "10 Jan 2026, 14:22", durationSec: "21s",
    ecl: 61.2, p5: 38.4, p95: 112.7,
    s1: 5.8, s2: 24.1, s3: 31.3,
    shapley: [
      { driver: "PD — Stage 3 Multiplier ×2.5 (IndiGo)", contribution: 46, direction: "up" },
      { driver: "LGD Rate Override (55%)", contribution: 28, direction: "up" },
      { driver: "Aircraft Market Value (India adj.)", contribution: 14, direction: "up" },
      { driver: "IDERA Repossession Timeline", contribution: 8, direction: "up" },
      { driver: "SD / MR Offset", contribution: 4, direction: "down" },
    ],
    keyFinding: "Single-lessee default scenario. ECL elevated by $14.0M vs baseline. P95 tail $112.7M. IndiGo §1110-equivalent cure window 30 days under IBC.",
    scenarioHash: hashFromSeed(77).slice(0, 12),
    topLessees: computeTopLessees(31.3, 77),
    s3LeaseCount: computeS3LeaseCount(31.3),
  },
];

// ─── DSL Generation ───────────────────────────────────────────────────────────

export function generateDSL(
  inputs: ScenarioInputs, name: string, mode: RunMode, paths: number, seed: number
): string {
  return JSON.stringify(
    {
      scenario_id: "custom-001",
      name,
      shocks: {
        gdp_growth_delta: inputs.gdpDelta,
        rpk_growth_delta: inputs.rpkDelta,
        fuel_price_delta_pct: inputs.fuelDelta,
        fx_basket_delta_pct: inputs.fxDelta,
        risk_free_rate_delta: inputs.rateDelta,
        asset_value_delta_pct: inputs.assetValueDelta,
        pd_override_stage2_multiplier: inputs.pdS2Multi,
        pd_override_stage3_multiplier: inputs.pdS3Multi,
        deferral_months: inputs.deferralMonths,
        govt_support_prob: inputs.govtSupportProb,
        forgiveness_rate: inputs.forgivenessRate,
        pbh_conversion_pct: inputs.pbhConversionPct,
        etp_rate: inputs.etpRate,
        lec_rate: inputs.lecRate,
        // Jurisdiction risk — omitted when all are 0 (feature inactive = CTC Gold baseline)
        ...(inputs.ctcGoldPct !== 0 || inputs.nonCtcPct !== 0 || inputs.repossWeightedMonths > 0
          ? { ctc_gold_pct: inputs.ctcGoldPct, non_ctc_pct: inputs.nonCtcPct, reposs_weighted_months: inputs.repossWeightedMonths }
          : {}),
        // Security deposits — omitted when 0 (feature inactive)
        ...(inputs.depositCoverage !== 0
          ? { deposit_coverage: inputs.depositCoverage }
          : {}),
        // Maintenance reserves — omitted when 0 (feature inactive)
        ...(inputs.maintenanceReserveCoverage !== 0
          ? { maintenance_reserve_coverage: inputs.maintenanceReserveCoverage }
          : {}),
        // Lease assumption pct — omitted when 0 or no regime selected
        ...(inputs.bankruptcyScenarioType !== null && inputs.leaseAssumptionPct > 0
          ? { lease_assumption_pct: inputs.leaseAssumptionPct }
          : {}),
        // Payment behaviour — omitted when both are 0 (feature inactive = neutral baseline)
        ...(inputs.payBehaviourCoopPct !== 0 || inputs.payBehaviourAdvPct !== 0
          ? { pay_behaviour_coop_pct: inputs.payBehaviourCoopPct, pay_behaviour_adv_pct: inputs.payBehaviourAdvPct }
          : {}),
        // Asset risk — omitted when both are 0 (feature inactive)
        ...(inputs.remarketingMonths > 0 || inputs.lgdDecayAdjFactor > 0
          ? { remarketing_months: inputs.remarketingMonths, lgd_decay_adj_factor: inputs.lgdDecayAdjFactor }
          : {}),
      },
      run_config: {
        mode: mode === "deterministic" ? "deterministic" : "monte_carlo",
        monte_carlo_paths: paths,
        seed,
      },
      // Optional: set to "chapter11", "india_ibc", "brazil_rj", "mexico_concurso", "indonesia_pkpu",
      // or "generic_liquidation" to layer insolvency-specific recovery adjustments.
      // See Insolvency Regimes tab.
      bankruptcy_scenario_type: inputs.bankruptcyScenarioType,
      // Restructuring type — omitted from DSL when null (no preset selected)
      ...(inputs.restructuringType !== null
        ? { restructuring_type: inputs.restructuringType }
        : {}),
    },
    null, 2
  );
}

export function parseDSL(text: string): { ok: boolean; inputs?: ScenarioInputs; name?: string; mode?: RunMode; paths?: number; seed?: number; errors: string[] } {
  try {
    const parsed = JSON.parse(text);
    const errors: string[] = [];
    const s = parsed.shocks ?? {};
    const rc = parsed.run_config ?? {};
    if (!parsed.name) errors.push("Missing field: name");
    if (typeof s.gdp_growth_delta !== "number") errors.push("shocks.gdp_growth_delta must be a number");
    if (typeof s.pd_override_stage3_multiplier === "number" && s.pd_override_stage3_multiplier > 3)
      errors.push("pd_override_stage3_multiplier exceeds default by >2σ — review before running");
    if (errors.filter((e) => e.startsWith("Missing") || e.includes("must be")).length > 0)
      return { ok: false, errors };
    return {
      ok: true, errors,
      name: parsed.name ?? "Custom Scenario",
      mode: rc.mode === "monte_carlo" ? "montecarlo" : "deterministic",
      paths: rc.monte_carlo_paths ?? 10000,
      seed: rc.seed ?? 42,
      inputs: {
        gdpDelta: s.gdp_growth_delta ?? 0,
        rpkDelta: s.rpk_growth_delta ?? 0,
        fuelDelta: s.fuel_price_delta_pct ?? 0,
        fxDelta: s.fx_basket_delta_pct ?? 0,
        rateDelta: s.risk_free_rate_delta ?? 0,
        assetValueDelta: s.asset_value_delta_pct ?? 0,
        pdS2Multi: s.pd_override_stage2_multiplier ?? 1.0,
        pdS3Multi: s.pd_override_stage3_multiplier ?? 1.0,
        deferralMonths: s.deferral_months ?? 0,
        govtSupportProb: s.govt_support_prob ?? 0,
        forgivenessRate: s.forgiveness_rate ?? 0,
        pbhConversionPct: s.pbh_conversion_pct ?? 0,
        etpRate: s.etp_rate ?? 0,
        lecRate: s.lec_rate ?? 0,
        bankruptcyScenarioType: parsed.bankruptcy_scenario_type ?? null,
        ctcGoldPct: typeof s.ctc_gold_pct === "number"
          ? Math.min(1, Math.max(0, s.ctc_gold_pct))
          : 0,
        nonCtcPct: (() => {
          const gold = typeof s.ctc_gold_pct === "number" ? Math.min(1, Math.max(0, s.ctc_gold_pct)) : 0;
          const raw  = typeof s.non_ctc_pct  === "number" ? Math.min(1, Math.max(0, s.non_ctc_pct))  : 0;
          return Math.min(raw, Math.max(0, 1 - gold));
        })(),
        depositCoverage: typeof s.deposit_coverage === "number"
          ? Math.min(1, Math.max(0, s.deposit_coverage))
          : 0,
        payBehaviourCoopPct: typeof s.pay_behaviour_coop_pct === "number"
          ? Math.min(1, Math.max(0, s.pay_behaviour_coop_pct))
          : 0,
        payBehaviourAdvPct: (() => {
          const coop = typeof s.pay_behaviour_coop_pct === "number" ? Math.min(1, Math.max(0, s.pay_behaviour_coop_pct)) : 0;
          const raw  = typeof s.pay_behaviour_adv_pct  === "number" ? Math.min(1, Math.max(0, s.pay_behaviour_adv_pct))  : 0;
          return Math.min(raw, Math.max(0, 1 - coop));
        })(),
        restructuringType: typeof parsed.restructuring_type === "string" && parsed.restructuring_type in RESTRUCTURING_TYPES
          ? parsed.restructuring_type
          : null,
        repossWeightedMonths: typeof s.reposs_weighted_months === "number"
          ? Math.max(0, s.reposs_weighted_months)
          : 0,
        leaseAssumptionPct: typeof s.lease_assumption_pct === "number"
          ? Math.min(1, Math.max(0, s.lease_assumption_pct))
          : 0,
        maintenanceReserveCoverage: typeof s.maintenance_reserve_coverage === "number"
          ? Math.min(1, Math.max(0, s.maintenance_reserve_coverage))
          : 0,
        remarketingMonths: typeof s.remarketing_months === "number"
          ? Math.max(0, s.remarketing_months)
          : 0,
        lgdDecayAdjFactor: typeof s.lgd_decay_adj_factor === "number"
          ? Math.min(0.5, Math.max(0, s.lgd_decay_adj_factor))
          : 0,
      },
    };
  } catch {
    return { ok: false, errors: ["Invalid JSON — check syntax"] };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export const TAB_STYLE = (active: boolean): CSSProperties => ({
  padding: "7px 20px",
  fontSize: "13px",
  fontWeight: active ? 600 : 500,
  border: "none",
  borderRadius: "9999px",
  background: active ? "#002147" : "transparent",
  color: active ? "#FFFFFF" : "#64748B",
  cursor: "pointer",
  transition: "all 180ms cubic-bezier(0.23,1,0.32,1)",
  boxShadow: active ? "0 1px 4px rgba(0,33,71,0.18)" : "none",
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
});

export const BTN_PRIMARY: CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.375rem",
  background: "#002147", color: "#FFFFFF", border: "none",
  borderRadius: "9999px", padding: "0.5rem 1rem",
  fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
};

export const BTN_OUTLINE: CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.375rem",
  background: "transparent", color: "#475569",
  border: "1px solid #E2E8F0", borderRadius: "9999px",
  padding: "0.5rem 0.875rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
};

export const REGIME_DESCRIPTIONS: Record<string, string> = {
  chapter11:           "§1110 gives lessor a 60-day cure window. DIP financing priority is the main tail risk.",
  india_ibc:           "CTC Act 2025 mandates 90-day repossession. Court congestion and political pressure are tail risks.",
  mexico_concurso:     "CTC in force; conciliador reviews leases in 90 days. Can convert to quiebra (liquidation).",
  brazil_rj:           "180-day stay with common extensions (AerCap LATAM: 380 days). 55% creditor cram-down risk.",
  indonesia_pkpu:      "Up to 270-day suspension. Indonesia is not a Cape Town Convention signatory.",
  generic_liquidation: "Full liquidation. Lessor ranks pari passu with general unsecured creditors.",
};

export const REGIME_SHORT_NAMES: Record<string, string> = {
  chapter11:           "Ch.11 §1110",
  india_ibc:           "India IBC",
  mexico_concurso:     "Mexico Concurso",
  brazil_rj:           "Brazil RJ",
  indonesia_pkpu:      "Indonesia PKPU",
  generic_liquidation: "Generic Liquidation",
};

export const EXEC_SCENARIO_TABS = ["Library"];
