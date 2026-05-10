import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router";
import { useViewMode } from "../contexts/ViewModeContext";
import { useAgent } from "../contexts/AgentContext";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { InsolvencyTab } from "../components/scenarios/InsolvencyTab";
import { LeasePricingTab } from "../components/scenarios/LeasePricingTab";
import { StatusPill } from "../components/ui/StatusPill";
import {
  Play,
  RefreshCw,
  Download,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
  GitBranch,
  Layers,
  Zap,
} from "lucide-react";
import {
  RunResultPanel,
  type ScenarioRunResult,
} from "../components/scenarios/RunResultPanel";
import { generateNarrative } from "../services/narrativeService";
import { SCENARIO_CALIBRATION } from "../data/intelligenceData";
import {
  ScenarioInputs,
  BASE_ECL,
  LGD_DELTAS, // used in Insolvency Regime section (Task 5)
  ZERO_INPUTS,
  computeECL,
  computeECLFromBase,
  computeStages,
} from "../utils/eclCalculator";
import { usePortfolioData } from "../hooks/usePortfolioData";
import { toDashboardKPIs } from "../lib/portfolioAdapters";
import { PillTabs } from "../components/ui/PillTabs";

// ─── Types ────────────────────────────────────────────────────────────────────

const PATH_TAB: Record<string, string> = {
  "/scenarios/library": "Library",
  "/scenarios/run":     "Custom Builder",
  "/scenarios/history": "Run History",
};

type RunMode = "deterministic" | "montecarlo";

type CardPhase = "idle" | "config" | "running" | "done";

interface CardState {
  phase: CardPhase;
  mode: RunMode;
  paths: number;
  resultId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Computation Helpers ──────────────────────────────────────────────────────

function seededRand(seed: number, salt: number): number {
  const x = Math.sin(seed * 9301 + salt * 49297 + 233) * 1_000_000;
  return x - Math.floor(x);
}

function computeShapley(
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

function computeMCRange(ecl: number, seed: number) {
  const p5  = ecl * (0.58 + seededRand(seed, 1) * 0.08);
  const p95 = ecl * (1.68 + seededRand(seed, 2) * 0.38);
  return { p5, p95 };
}

function hashFromSeed(seed: number): string {
  return [...Array(12)]
    .map((_, i) => Math.floor(seededRand(seed, i) * 16).toString(16))
    .join("");
}

// ─── Narrative Helpers ────────────────────────────────────────────────────────

const STAGE3_LESSEES = [
  { name: "IndiGo Airlines",         jurisdiction: "India (IBC)" },
  { name: "Aeromexico",              jurisdiction: "Mexico (Concurso Mercantil)" },
  { name: "SriLankan Airlines",      jurisdiction: "Sri Lanka (Liquidation)" },
  { name: "Azul Brazilian Airlines", jurisdiction: "Brazil (Recuperação Judicial)" },
  { name: "Air Transat",             jurisdiction: "Canada (CCAA)" },
] as const;

function computeTopLessees(
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

function computeS3LeaseCount(s3: number): number {
  return Math.max(1, Math.round(s3 / 8.2));
}

let runCounter = 848;
function nextRunId(): string {
  return `RUN-2024-0${runCounter++}`;
}

function buildRun(
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

interface Template {
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

const TEMPLATES: Template[] = [
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
    inputs: { gdpDelta: -0.015, rpkDelta: -0.25, fuelDelta: 0.15, fxDelta: -0.05, rateDelta: 0, assetValueDelta: -0.08, pdS2Multi: 1.4, pdS3Multi: 1.15, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null },
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
    inputs: { gdpDelta: -0.04, rpkDelta: -0.55, fuelDelta: -0.30, fxDelta: -0.10, rateDelta: -0.005, assetValueDelta: -0.22, pdS2Multi: 2.4, pdS3Multi: 2.1, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null },
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
    inputs: { gdpDelta: -0.005, rpkDelta: -0.08, fuelDelta: 0.40, fxDelta: 0, rateDelta: 0.005, assetValueDelta: -0.06, pdS2Multi: 1.6, pdS3Multi: 1.2, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null },
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
    inputs: { gdpDelta: -0.02, rpkDelta: -0.12, fuelDelta: 0.05, fxDelta: -0.15, rateDelta: 0.025, assetValueDelta: -0.12, pdS2Multi: 1.7, pdS3Multi: 1.5, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null },
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
    inputs: { gdpDelta: -0.025, rpkDelta: -0.18, fuelDelta: 0.08, fxDelta: -0.35, rateDelta: 0.02, assetValueDelta: -0.15, pdS2Multi: 2.0, pdS3Multi: 1.8, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null },
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
    inputs: { gdpDelta: 0, rpkDelta: -0.20, fuelDelta: 0, fxDelta: -0.20, rateDelta: 0, assetValueDelta: -0.40, pdS2Multi: 1.2, pdS3Multi: 4.8, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0, pbhConversionPct: 0, etpRate: 0, lecRate: 0, bankruptcyScenarioType: null },
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

function buildTemplateRun(
  id: string, tpl: Template, mode: RunMode, paths: number | null,
  seed: number, dateStr: string, durStr: string
): ScenarioRunResult {
  const { p5, p95 } = computeMCRange(tpl.ecl, seed);
  const stages = computeStages(tpl.ecl, tpl.inputs);
  return {
    id, templateId: tpl.id, name: tpl.name, mode,
    paths: mode === "montecarlo" ? (paths ?? 10000) : null,
    seed, runDate: dateStr, durationSec: durStr,
    ecl: tpl.ecl,
    p5: mode === "montecarlo" ? tpl.ecl * tpl.p5Factor : null,
    p95: mode === "montecarlo" ? tpl.ecl * tpl.p95Factor : null,
    s1: stages.s1, s2: stages.s2, s3: stages.s3,
    shapley: tpl.shapley, keyFinding: tpl.keyFinding,
    scenarioHash: hashFromSeed(seed).slice(0, 12),
    topLessees: computeTopLessees(stages.s3, seed),
    s3LeaseCount: computeS3LeaseCount(stages.s3),
  };
}

const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;

const INITIAL_RUNS: ScenarioRunResult[] = [
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

function generateDSL(
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
    },
    null, 2
  );
}

function parseDSL(text: string): { ok: boolean; inputs?: ScenarioInputs; name?: string; mode?: RunMode; paths?: number; seed?: number; errors: string[] } {
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
      },
    };
  } catch {
    return { ok: false, errors: ["Invalid JSON — check syntax"] };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
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

const BTN_PRIMARY: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.375rem",
  background: "#002147", color: "#FFFFFF", border: "none",
  borderRadius: "9999px", padding: "0.5rem 1rem",
  fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
};

const BTN_OUTLINE: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.375rem",
  background: "transparent", color: "#475569",
  border: "1px solid #E2E8F0", borderRadius: "9999px",
  padding: "0.5rem 0.875rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
};

const REGIME_DESCRIPTIONS: Record<string, string> = {
  chapter11:           "§1110 gives lessor a 60-day cure window. DIP financing priority is the main tail risk.",
  india_ibc:           "CTC Act 2025 mandates 90-day repossession. Court congestion and political pressure are tail risks.",
  mexico_concurso:     "CTC in force; conciliador reviews leases in 90 days. Can convert to quiebra (liquidation).",
  brazil_rj:           "180-day stay with common extensions (AerCap LATAM: 380 days). 55% creditor cram-down risk.",
  indonesia_pkpu:      "Up to 270-day suspension. Indonesia is not a Cape Town Convention signatory.",
  generic_liquidation: "Full liquidation. Lessor ranks pari passu with general unsecured creditors.",
};

const REGIME_SHORT_NAMES: Record<string, string> = {
  chapter11:           "Ch.11 §1110",
  india_ibc:           "India IBC",
  mexico_concurso:     "Mexico Concurso",
  brazil_rj:           "Brazil RJ",
  indonesia_pkpu:      "Indonesia PKPU",
  generic_liquidation: "Generic Liquidation",
};

// ─── Slider helper ────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  min: number; max: number; step: number;
  value: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
  warn?: boolean;
}

function SliderRow({ label, min, max, step, value, onChange, fmt, warn }: SliderRowProps) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
        <label style={{ fontSize: "0.8125rem", color: "#475569", fontWeight: 500 }}>{label}</label>
        <span
          style={{
            fontFamily: "monospace", fontSize: "0.8125rem", fontWeight: 600,
            color: warn ? "#B45309" : value === 0 || value === 1 ? "#94A3B8" : "#002147",
            minWidth: "64px", textAlign: "right",
          }}
        >
          {fmt(value)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#002147" }}
      />
    </div>
  );
}

// ─── Mode Toggle ──────────────────────────────────────────────────────────────

function ModeToggle({
  mode, paths, onMode, onPaths,
}: { mode: RunMode; paths: number; onMode: (m: RunMode) => void; onPaths: (p: number) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>
          Run Mode
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["deterministic", "montecarlo"] as RunMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onMode(m)}
              style={{
                flex: 1, padding: "0.4375rem", fontSize: "0.8125rem", fontWeight: 500,
                borderRadius: "9999px", border: "1px solid",
                cursor: "pointer",
                background: mode === m ? "#002147" : "#FFFFFF",
                color: mode === m ? "#FFFFFF" : "#475569",
                borderColor: mode === m ? "#002147" : "#E2E8F0",
              }}
            >
              {m === "deterministic" ? "Deterministic" : "Monte Carlo"}
            </button>
          ))}
        </div>
      </div>
      {mode === "montecarlo" && (
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>
            Path Count
          </div>
          <input
            type="number" value={paths} min={100} max={100000} step={1000}
            onChange={(e) => onPaths(Math.min(100000, Math.max(100, parseInt(e.target.value) || 10000)))}
            style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.4375rem 0.75rem", fontSize: "0.875rem", color: "#0F172A", fontFamily: "monospace", outline: "none" }}
          />
          <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.25rem" }}>
            Default 10,000 — max 100,000
          </div>
        </div>
      )}
      <div style={{ padding: "0.625rem 0.75rem", background: "#F4F5F7", borderRadius: "0.375rem", fontSize: "0.8125rem", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#475569" }}>Est. runtime</span>
        <span style={{ fontWeight: 600, color: "#0F172A" }}>
          {mode === "deterministic" ? "< 5s" : `~${Math.ceil(paths / 250)}s`}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const EXEC_SCENARIO_TABS = ["Library"];

export default function Scenarios() {
  const { pathname, state: locationState } = useLocation();
  const { isExecutiveMode } = useViewMode();
  const { pendingInputs, setPendingInputs } = useAgent();
  const [activeTab, setActiveTab] = useState(() => PATH_TAB[pathname] ?? "Library");
  useEffect(() => { setActiveTab(PATH_TAB[pathname] ?? "Library"); }, [pathname]);
  useEffect(() => {
    if (isExecutiveMode && !EXEC_SCENARIO_TABS.includes(activeTab)) {
      setActiveTab("Library");
    }
  }, [isExecutiveMode, activeTab]);
  const [runs, setRuns] = useState<ScenarioRunResult[]>(INITIAL_RUNS);

  // ── Library card state machine ──
  const [cardStates, setCardStates] = useState<Record<string, CardState>>(
    Object.fromEntries(TEMPLATES.map((t) => [t.id, { phase: "idle", mode: "deterministic", paths: 10000 }]))
  );

  const setCardPhase = useCallback((id: string, updates: Partial<CardState>) => {
    setCardStates((prev) => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  }, []);

  const handleTemplateRun = useCallback((tpl: Template) => {
    const cs = cardStates[tpl.id];
    const seed = Math.floor(Math.random() * 9999) + 1;
    setCardPhase(tpl.id, { phase: "running" });

    const duration = cs.mode === "deterministic" ? 1800 : 3200;
    setTimeout(() => {
      const { p5, p95 } = computeMCRange(tpl.ecl, seed);
      const stages = computeStages(tpl.ecl, tpl.inputs);
      const newRun: ScenarioRunResult = {
        id: nextRunId(),
        templateId: tpl.id,
        name: tpl.name,
        mode: cs.mode,
        paths: cs.mode === "montecarlo" ? cs.paths : null,
        seed,
        runDate: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", ""),
        durationSec: cs.mode === "deterministic"
          ? `${(1.4 + seededRand(seed, 9) * 1.4).toFixed(1)}s`
          : `${Math.round(28 + seededRand(seed, 11) * 20)}s`,
        ecl: tpl.ecl,
        p5: cs.mode === "montecarlo" ? tpl.ecl * tpl.p5Factor : null,
        p95: cs.mode === "montecarlo" ? tpl.ecl * tpl.p95Factor : null,
        s1: stages.s1, s2: stages.s2, s3: stages.s3,
        shapley: tpl.shapley,
        keyFinding: tpl.keyFinding,
        scenarioHash: hashFromSeed(seed).slice(0, 12),
        topLessees: computeTopLessees(stages.s3, seed, liveStage3Lessees ?? STAGE3_LESSEES),
        s3LeaseCount: computeS3LeaseCount(stages.s3),
      };
      setRuns((prev) => [newRun, ...prev]);
      setCardPhase(tpl.id, { phase: "done", resultId: newRun.id });
    }, duration);
  }, [cardStates, setCardPhase]);

  // ── Custom Builder state ──
  const [prefillSource, setPrefillSource] = useState<string | null>(null);
  const [calBannerDismissed, setCalBannerDismissed] = useState(false);
  const [customName, setCustomName] = useState("My Custom Scenario");
  const [formInputs, setFormInputs] = useState<ScenarioInputs>(ZERO_INPUTS);
  const [customMode, setCustomMode] = useState<RunMode>("deterministic");
  const [customPaths, setCustomPaths] = useState(10000);
  const [customSeed] = useState(42);
  const [editorMode, setEditorMode] = useState<"form" | "dsl">("form");
  const [distressOpen, setDistressOpen] = useState(false);
  const [insolvencyOpen, setInsolvencyOpen] = useState(false);

  const [dslText, setDslText] = useState(() => generateDSL(ZERO_INPUTS, "My Custom Scenario", "deterministic", 10000, 42));
  const [dslErrors, setDslErrors] = useState<string[]>([]);
  const [customRunning, setCustomRunning] = useState(false);
  const [customResultId, setCustomResultId] = useState<string | null>(null);
  const customResultRef = useRef<HTMLDivElement>(null);

  // ── Live portfolio base ECL ──
  const { assets, lessees, leases, provisions, isDemo } = usePortfolioData();
  const liveBaseECL = React.useMemo(
    () => {
      const kpis = toDashboardKPIs(assets, lessees, provisions);
      return kpis.totalECLm > 0 ? kpis.totalECLm : BASE_ECL;
    },
    [assets, lessees, provisions]
  );

  // Derive live Stage 3 lessees from uploaded portfolio for scenario narrative
  const liveStage3Lessees = React.useMemo(() => {
    if (isDemo || lessees.length === 0 || provisions.length === 0) return null;
    const assetToLesseeId = new Map<string, string>();
    for (const lease of leases) {
      assetToLesseeId.set(lease.asset_id, lease.lessee_id);
    }
    const stage3Ids = new Set<string>();
    for (const p of provisions) {
      if (p.stage === 3) {
        const lid = assetToLesseeId.get(p.asset_id);
        if (lid) stage3Ids.add(lid);
      }
    }
    if (stage3Ids.size === 0) return null;
    return lessees
      .filter((l) => stage3Ids.has(l.id))
      .map((l) => ({
        name: l.name,
        jurisdiction: (l as { country?: string }).country ?? "Unknown",
      }));
  }, [isDemo, lessees, leases, provisions]);

  // ── Clone / Branch state ──
  const [branchFromId, setBranchFromId] = useState<string | null>(null);
  const [clonePending, setClonePending] = useState<{
    inputs: ScenarioInputs; name: string; mode: RunMode; paths: number;
  } | null>(null);

  const updateFormInputs = useCallback((partial: Partial<ScenarioInputs>) => {
    let next: ScenarioInputs;
    setFormInputs((prev) => {
      next = { ...prev, ...partial };
      return next;
    });
    // `next` is assigned synchronously inside the updater before setFormInputs returns
    setDslText(generateDSL(next!, customName, customMode, customPaths, customSeed));
    setDslErrors([]);
    // Auto-expand distress section if any distress lever is non-zero
    const hasDistress =
      next!.deferralMonths !== 0 || next!.govtSupportProb !== 0 ||
      next!.forgivenessRate !== 0 || next!.pbhConversionPct !== 0 ||
      next!.etpRate !== 0 || next!.lecRate !== 0;
    if (hasDistress) setDistressOpen(true);
    if (next!.bankruptcyScenarioType !== null) setInsolvencyOpen(true);
  }, [customName, customMode, customPaths, customSeed, setDistressOpen, setInsolvencyOpen]);

  // Read agent-injected inputs when Custom Builder tab becomes active
  useEffect(() => {
    if (activeTab === "Custom Builder" && pendingInputs) {
      const partial = pendingInputs as Partial<ScenarioInputs>;
      const next = { ...formInputs, ...partial };
      setFormInputs(next);
      setDslText(generateDSL(next, customName, customMode, customPaths, customSeed));
      setDslErrors([]);
      setPendingInputs(null);
    }
  }, [activeTab, pendingInputs, setPendingInputs, formInputs, customName, customMode, customPaths, customSeed]);

  const handleDslChange = (text: string) => {
    setDslText(text);
    const { errors, inputs, name, mode, paths } = parseDSL(text);
    setDslErrors(errors);
    if (inputs) setFormInputs(inputs);
    if (name) setCustomName(name);
    if (mode) setCustomMode(mode);
    if (paths) setCustomPaths(paths);
  };

  const handleCustomRun = () => {
    const parsed = parseDSL(dslText);
    if (!parsed.ok && parsed.errors.some((e) => e.startsWith("Invalid") || e.includes("must be"))) return;
    setCustomRunning(true);
    setCustomResultId(null);
    // Scroll to result area immediately so the skeleton is visible
    setTimeout(() => customResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    const duration = customMode === "deterministic" ? 1800 : 3200;
    setTimeout(() => {
      const seed = Math.floor(Math.random() * 9999) + 1;
      const newRun = buildRun(customName || "Custom Scenario", formInputs, customMode, customPaths, seed, null, computeECLFromBase(liveBaseECL, formInputs), liveStage3Lessees ?? STAGE3_LESSEES);
      if (branchFromId) { (newRun as ScenarioRunResult).parentId = branchFromId; }
      setRuns((prev) => [newRun, ...prev]);
      setCustomResultId(newRun.id);
      setCustomRunning(false);
      setBranchFromId(null);
    }, duration);
  };

  // Apply pre-fill from Intelligence deep-link
  useEffect(() => {
    const state = locationState as { prefill?: Partial<ScenarioInputs>; prefillSource?: string } | null;
    if (!state?.prefill) return;
    const merged: ScenarioInputs = { ...ZERO_INPUTS, ...state.prefill } as ScenarioInputs;
    setFormInputs(merged);
    setActiveTab("Custom Builder");
    if (state.prefillSource) setPrefillSource(state.prefillSource);
  }, []); // intentionally empty — only runs on mount

  // Pre-populate Custom Builder when a clone/duplicate is triggered
  useEffect(() => {
    if (!clonePending) return;
    setCustomName(clonePending.name);
    setFormInputs(clonePending.inputs);
    setCustomMode(clonePending.mode);
    setCustomPaths(clonePending.paths);
    setDslText(generateDSL(clonePending.inputs, clonePending.name, clonePending.mode, clonePending.paths, customSeed));
    setDslErrors([]);
    setCustomResultId(null);
    setActiveTab("Custom Builder");
    // Auto-expand collapsible sections when cloned inputs carry non-default values
    if (clonePending.inputs.bankruptcyScenarioType !== null) setInsolvencyOpen(true);
    setClonePending(null);
  }, [clonePending, customSeed]);

  // Derive template inputs for a run (custom runs fall back to ZERO_INPUTS)
  function getRunInputs(run: ScenarioRunResult): ScenarioInputs {
    if (run.templateId) {
      return TEMPLATES.find((t) => t.id === run.templateId)?.inputs ?? ZERO_INPUTS;
    }
    return ZERO_INPUTS;
  }

  // ── Run History state ──
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  // ── Result lookup ──
  const findRun = (id: string) => runs.find((r) => r.id === id);

  // ── Narrative cache ──
  const [narrativeCache, setNarrativeCache] = useState<Map<string, string | null | "loading">>(
    new Map()
  );
  const requestedRunIds = useRef<Set<string>>(new Set());

  const handleRequestNarrative = useCallback(
    async (run: ScenarioRunResult) => {
      if (requestedRunIds.current.has(run.id)) return;
      requestedRunIds.current.add(run.id);
      setNarrativeCache((prev) => new Map(prev).set(run.id, "loading"));
      const result = await generateNarrative(run);
      setNarrativeCache((prev) => new Map(prev).set(run.id, result));
    },
    [] // run object passed directly — no runs array lookup needed
  );

  const tabs = isExecutiveMode
    ? EXEC_SCENARIO_TABS
    : ["Library", "Custom Builder", "Run History", "Insolvency Regimes", "Lease Pricing"];

  // ─────────────────────────────────────────────────────────────────────────────

  function getNarrative(runId: string): string | null | "loading" {
    if (!narrativeCache.has(runId)) return "loading";
    return narrativeCache.get(runId) as string | null | "loading";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Scenario Engine"
        subtitle="Run deterministic or Monte Carlo scenarios across your full portfolio"
      >
        <button
          style={BTN_PRIMARY}
          onClick={() => setActiveTab("Custom Builder")}
        >
          <Play size={14} /> New Custom Scenario
        </button>
      </PageHeader>

      {/* ── Tabs ── */}
      <PillTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: "-1.5rem" }}
        renderTab={(tab, isActive) => (
          <>
            {tab}
            {tab === "Run History" && (
              <span
                style={{
                  fontSize: "0.6875rem", fontWeight: 600,
                  background: isActive ? "rgba(255,255,255,0.25)" : "#002147",
                  color: "#FFFFFF",
                  borderRadius: "0.75rem", padding: "0.1rem 0.4rem",
                }}
              >
                {runs.length}
              </span>
            )}
          </>
        )}
      />

      {/* ══ LIBRARY TAB ══════════════════════════════════════════════════════ */}
      {activeTab === "Library" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", alignItems: "start" }}>
          {/* ── Macro Scenarios label ── */}
          <div style={{ gridColumn: "1 / -1", fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "0.25rem", borderBottom: "1px solid #F1F5F9" }}>
            Macro Scenarios
          </div>
          {TEMPLATES.filter((t) => t.category === "macro").map((tpl, tplIdx) => {
            const cs = cardStates[tpl.id];
            const result = cs.resultId ? findRun(cs.resultId) : null;

            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: tplIdx * 0.06, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  background: "#FFFFFF", border: "1px solid #E2E8F0",
                  borderRadius: "0.5rem", overflow: "hidden",
                  display: "flex", flexDirection: "column",
                  transition: "border-color 150ms",
                }}
                onMouseEnter={(e) => cs.phase === "idle" && ((e.currentTarget as HTMLDivElement).style.borderColor = "#CBD5E1")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "#E2E8F0")}
              >
                {/* Card body */}
                <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>{tpl.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.125rem" }}>
                        Scenario weight:{" "}
                        <span style={{ fontWeight: 600, color: tpl.color }}>{tpl.weight}</span>
                      </div>
                    </div>
                    <div
                      style={{
                        background: tpl.bg, border: `1px solid ${tpl.color}30`,
                        borderRadius: "0.25rem", padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem", fontWeight: 600, color: tpl.color,
                        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
                      }}
                    >
                      ECL ${tpl.ecl.toFixed(1)}M
                    </div>
                  </div>

                  <p style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>
                    {tpl.description}
                  </p>

                  {tpl.tags && tpl.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                      {tpl.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: "0.6875rem", fontWeight: 600,
                            padding: "0.125rem 0.5rem",
                            borderRadius: "9999px",
                            background: "rgba(0,33,71,0.06)",
                            color: "#475569",
                            border: "1px solid rgba(0,33,71,0.12)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.5rem", borderTop: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#94A3B8", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Clock size={11} /> Last run: {tpl.lastRun}
                    </span>

                    {cs.phase === "idle" && (
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <button
                          onClick={() => setCardPhase(tpl.id, { phase: "config" })}
                          style={{ ...BTN_PRIMARY, padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                        >
                          <Play size={11} /> Configure & Run
                        </button>
                        <button
                          title="Clone this template into the Custom Builder"
                          onClick={() => setClonePending({ inputs: tpl.inputs, name: `${tpl.name} (Custom)`, mode: "deterministic", paths: 10000 })}
                          style={{ ...BTN_OUTLINE, padding: "0.375rem 0.5rem", fontSize: "0.8125rem" }}
                        >
                          <Layers size={11} />
                        </button>
                        <button style={{ ...BTN_OUTLINE, padding: "0.375rem 0.5rem", fontSize: "0.8125rem" }}>
                          <Download size={11} />
                        </button>
                      </div>
                    )}

                    {cs.phase === "config" && (
                      <button
                        onClick={() => setCardPhase(tpl.id, { phase: "idle" })}
                        style={{ ...BTN_OUTLINE, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      >
                        <X size={11} /> Cancel
                      </button>
                    )}

                    {cs.phase === "running" && (
                      <span style={{ fontSize: "0.8125rem", color: "#94A3B8", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <RefreshCw size={12} className="animate-spin" />
                        Running…
                      </span>
                    )}

                    {cs.phase === "done" && (
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <button
                          onClick={() => {
                            setCardPhase(tpl.id, { phase: "config", resultId: undefined });
                          }}
                          style={{ ...BTN_PRIMARY, padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                        >
                          <Play size={11} /> Re-run
                        </button>
                        <button
                          onClick={() => setCardPhase(tpl.id, { phase: "idle", resultId: undefined })}
                          style={{ ...BTN_OUTLINE, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Config / Running / Result — animated */}
                <AnimatePresence initial={false}>
                  {cs.phase === "config" && (
                    <motion.div
                      key="config"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          borderTop: "1px solid #E2E8F0",
                          background: "#FAFAFA",
                          padding: "1rem 1.25rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        <ModeToggle
                          mode={cs.mode}
                          paths={cs.paths}
                          onMode={(m) => setCardPhase(tpl.id, { mode: m })}
                          onPaths={(p) => setCardPhase(tpl.id, { paths: p })}
                        />
                        <button
                          onClick={() => handleTemplateRun(tpl)}
                          style={{ ...BTN_PRIMARY, justifyContent: "center", width: "100%" }}
                        >
                          <Play size={13} /> Execute Run
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {cs.phase === "running" && (
                    <motion.div
                      key="running"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          borderTop: "1px solid #E2E8F0", background: "#FAFAFA",
                          padding: "1rem 1.25rem", textAlign: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "#002147", marginBottom: "0.5rem" }}>
                          <RefreshCw size={14} className="animate-spin" />
                          <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                            {cs.mode === "deterministic" ? "Running deterministic model…" : `Running Monte Carlo (${cs.paths.toLocaleString()} paths)…`}
                          </span>
                        </div>
                        <div style={{ height: "4px", background: "#E2E8F0", borderRadius: "2px", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              background: "#002147",
                              borderRadius: "2px",
                              animation: "progress-fill 3s linear forwards",
                              width: "0%",
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {cs.phase === "done" && result && (
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ borderTop: "1px solid #E2E8F0", padding: "0 1.25rem 1.25rem" }}>
                        <RunResultPanel
                          run={result}
                          compact
                          narrative={getNarrative(result.id)}
                          onRequestNarrative={handleRequestNarrative}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          {/* ── Distress Scenarios label ── */}
          <div style={{ gridColumn: "1 / -1", fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: "0.75rem", paddingBottom: "0.25rem", borderBottom: "1px solid #F1F5F9" }}>
            Distress Scenarios
          </div>
          {TEMPLATES.filter((t) => t.category === "distress").map((tpl, tplIdx) => {
            const cs = cardStates[tpl.id];
            const result = cs.resultId ? findRun(cs.resultId) : null;

            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: (tplIdx + TEMPLATES.filter(t => t.category !== "distress").length) * 0.06, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  background: "#FFFFFF", border: "1px solid #E2E8F0",
                  borderRadius: "0.5rem", overflow: "hidden",
                  display: "flex", flexDirection: "column",
                  transition: "border-color 150ms",
                }}
                onMouseEnter={(e) => cs.phase === "idle" && ((e.currentTarget as HTMLDivElement).style.borderColor = "#CBD5E1")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "#E2E8F0")}
              >
                {/* Card body */}
                <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>{tpl.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.125rem" }}>
                        Scenario weight:{" "}
                        <span style={{ fontWeight: 600, color: tpl.color }}>{tpl.weight}</span>
                      </div>
                    </div>
                    <div
                      style={{
                        background: tpl.bg, border: `1px solid ${tpl.color}30`,
                        borderRadius: "0.25rem", padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem", fontWeight: 600, color: tpl.color,
                        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
                      }}
                    >
                      ECL ${tpl.ecl.toFixed(1)}M
                    </div>
                  </div>

                  <p style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>
                    {tpl.description}
                  </p>

                  {tpl.tags && tpl.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                      {tpl.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: "0.6875rem", fontWeight: 600,
                            padding: "0.125rem 0.5rem",
                            borderRadius: "9999px",
                            background: "rgba(0,33,71,0.06)",
                            color: "#475569",
                            border: "1px solid rgba(0,33,71,0.12)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.5rem", borderTop: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#94A3B8", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Clock size={11} /> Last run: {tpl.lastRun}
                    </span>

                    {cs.phase === "idle" && (
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <button
                          onClick={() => setCardPhase(tpl.id, { phase: "config" })}
                          style={{ ...BTN_PRIMARY, padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                        >
                          <Play size={11} /> Configure & Run
                        </button>
                        <button
                          title="Clone this template into the Custom Builder"
                          onClick={() => setClonePending({ inputs: tpl.inputs, name: `${tpl.name} (Custom)`, mode: "deterministic", paths: 10000 })}
                          style={{ ...BTN_OUTLINE, padding: "0.375rem 0.5rem", fontSize: "0.8125rem" }}
                        >
                          <Layers size={11} />
                        </button>
                        <button style={{ ...BTN_OUTLINE, padding: "0.375rem 0.5rem", fontSize: "0.8125rem" }}>
                          <Download size={11} />
                        </button>
                      </div>
                    )}

                    {cs.phase === "config" && (
                      <button
                        onClick={() => setCardPhase(tpl.id, { phase: "idle" })}
                        style={{ ...BTN_OUTLINE, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      >
                        <X size={11} /> Cancel
                      </button>
                    )}

                    {cs.phase === "running" && (
                      <span style={{ fontSize: "0.8125rem", color: "#94A3B8", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <RefreshCw size={12} className="animate-spin" />
                        Running…
                      </span>
                    )}

                    {cs.phase === "done" && (
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <button
                          onClick={() => {
                            setCardPhase(tpl.id, { phase: "config", resultId: undefined });
                          }}
                          style={{ ...BTN_PRIMARY, padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                        >
                          <Play size={11} /> Re-run
                        </button>
                        <button
                          onClick={() => setCardPhase(tpl.id, { phase: "idle", resultId: undefined })}
                          style={{ ...BTN_OUTLINE, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Config / Running / Result — animated */}
                <AnimatePresence initial={false}>
                  {cs.phase === "config" && (
                    <motion.div
                      key="config"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          borderTop: "1px solid #E2E8F0",
                          background: "#FAFAFA",
                          padding: "1rem 1.25rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        <ModeToggle
                          mode={cs.mode}
                          paths={cs.paths}
                          onMode={(m) => setCardPhase(tpl.id, { mode: m })}
                          onPaths={(p) => setCardPhase(tpl.id, { paths: p })}
                        />
                        <button
                          onClick={() => handleTemplateRun(tpl)}
                          style={{ ...BTN_PRIMARY, justifyContent: "center", width: "100%" }}
                        >
                          <Play size={13} /> Execute Run
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {cs.phase === "running" && (
                    <motion.div
                      key="running"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          borderTop: "1px solid #E2E8F0", background: "#FAFAFA",
                          padding: "1rem 1.25rem", textAlign: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "#002147", marginBottom: "0.5rem" }}>
                          <RefreshCw size={14} className="animate-spin" />
                          <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                            {cs.mode === "deterministic" ? "Running deterministic model…" : `Running Monte Carlo (${cs.paths.toLocaleString()} paths)…`}
                          </span>
                        </div>
                        <div style={{ height: "4px", background: "#E2E8F0", borderRadius: "2px", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              background: "#002147",
                              borderRadius: "2px",
                              animation: "progress-fill 3s linear forwards",
                              width: "0%",
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {cs.phase === "done" && result && (
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ borderTop: "1px solid #E2E8F0", padding: "0 1.25rem 1.25rem" }}>
                        <RunResultPanel
                          run={result}
                          compact
                          narrative={getNarrative(result.id)}
                          onRequestNarrative={handleRequestNarrative}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* ── Insolvency Scenarios label ── */}
          <div style={{ gridColumn: "1 / -1", fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: "0.75rem", paddingBottom: "0.25rem", borderBottom: "1px solid #F1F5F9" }}>
            Insolvency Scenarios
          </div>
          {TEMPLATES.filter((t) => t.category === "insolvency").map((tpl, tplIdx) => {
            const delayIdx = tplIdx + TEMPLATES.filter(t => t.category !== "insolvency").length;
            const cs = cardStates[tpl.id];
            const result = cs.resultId ? findRun(cs.resultId) : null;

            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: delayIdx * 0.06, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  background: "#FFFFFF", border: "1px solid #E2E8F0",
                  borderRadius: "0.5rem", overflow: "hidden",
                  display: "flex", flexDirection: "column",
                  transition: "border-color 150ms",
                }}
                onMouseEnter={(e) => cs.phase === "idle" && ((e.currentTarget as HTMLDivElement).style.borderColor = "#CBD5E1")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "#E2E8F0")}
              >
                {/* Card body */}
                <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>{tpl.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.125rem" }}>
                        Scenario weight:{" "}
                        <span style={{ fontWeight: 600, color: tpl.color }}>{tpl.weight}</span>
                      </div>
                    </div>
                    <div
                      style={{
                        background: tpl.bg, border: `1px solid ${tpl.color}30`,
                        borderRadius: "0.25rem", padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem", fontWeight: 600, color: tpl.color,
                        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
                      }}
                    >
                      ECL ${tpl.ecl.toFixed(1)}M
                    </div>
                  </div>

                  <p style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>
                    {tpl.description}
                  </p>

                  {tpl.tags && tpl.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                      {tpl.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: "0.6875rem", fontWeight: 600,
                            padding: "0.125rem 0.5rem",
                            borderRadius: "9999px",
                            background: "rgba(0,33,71,0.06)",
                            color: "#475569",
                            border: "1px solid rgba(0,33,71,0.12)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.5rem", borderTop: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#94A3B8", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Clock size={11} /> Last run: {tpl.lastRun}
                    </span>

                    {cs.phase === "idle" && (
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <button
                          onClick={() => setCardPhase(tpl.id, { phase: "config" })}
                          style={{ ...BTN_PRIMARY, padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                        >
                          <Play size={11} /> Configure & Run
                        </button>
                        <button
                          title="Clone this template into the Custom Builder"
                          onClick={() => setClonePending({ inputs: tpl.inputs, name: `${tpl.name} (Custom)`, mode: "deterministic", paths: 10000 })}
                          style={{ ...BTN_OUTLINE, padding: "0.375rem 0.5rem", fontSize: "0.8125rem" }}
                        >
                          <Layers size={11} />
                        </button>
                        <button style={{ ...BTN_OUTLINE, padding: "0.375rem 0.5rem", fontSize: "0.8125rem" }}>
                          <Download size={11} />
                        </button>
                      </div>
                    )}

                    {cs.phase === "config" && (
                      <button
                        onClick={() => setCardPhase(tpl.id, { phase: "idle" })}
                        style={{ ...BTN_OUTLINE, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      >
                        <X size={11} /> Cancel
                      </button>
                    )}

                    {cs.phase === "running" && (
                      <span style={{ fontSize: "0.8125rem", color: "#94A3B8", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <RefreshCw size={12} className="animate-spin" />
                        Running…
                      </span>
                    )}

                    {cs.phase === "done" && (
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <button
                          onClick={() => {
                            setCardPhase(tpl.id, { phase: "config", resultId: undefined });
                          }}
                          style={{ ...BTN_PRIMARY, padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                        >
                          <Play size={11} /> Re-run
                        </button>
                        <button
                          onClick={() => setCardPhase(tpl.id, { phase: "idle", resultId: undefined })}
                          style={{ ...BTN_OUTLINE, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Config / Running / Result — animated */}
                <AnimatePresence initial={false}>
                  {cs.phase === "config" && (
                    <motion.div
                      key="config"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          borderTop: "1px solid #E2E8F0",
                          background: "#FAFAFA",
                          padding: "1rem 1.25rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        <ModeToggle
                          mode={cs.mode}
                          paths={cs.paths}
                          onMode={(m) => setCardPhase(tpl.id, { mode: m })}
                          onPaths={(p) => setCardPhase(tpl.id, { paths: p })}
                        />
                        <button
                          onClick={() => handleTemplateRun(tpl)}
                          style={{ ...BTN_PRIMARY, justifyContent: "center", width: "100%" }}
                        >
                          <Play size={13} /> Execute Run
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {cs.phase === "running" && (
                    <motion.div
                      key="running"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          borderTop: "1px solid #E2E8F0", background: "#FAFAFA",
                          padding: "1rem 1.25rem", textAlign: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "#002147", marginBottom: "0.5rem" }}>
                          <RefreshCw size={14} className="animate-spin" />
                          <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                            {cs.mode === "deterministic" ? "Running deterministic model…" : `Running Monte Carlo (${cs.paths.toLocaleString()} paths)…`}
                          </span>
                        </div>
                        <div style={{ height: "4px", background: "#E2E8F0", borderRadius: "2px", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              background: "#002147",
                              borderRadius: "2px",
                              animation: "progress-fill 3s linear forwards",
                              width: "0%",
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {cs.phase === "done" && result && (
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ borderTop: "1px solid #E2E8F0", padding: "0 1.25rem 1.25rem" }}>
                        <RunResultPanel
                          run={result}
                          compact
                          narrative={getNarrative(result.id)}
                          onRequestNarrative={handleRequestNarrative}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ══ CUSTOM BUILDER TAB ═══════════════════════════════════════════════ */}
      {activeTab === "Custom Builder" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem" }}>
          {/* Left: Editor / Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* ── Pre-fill Banner (from Intelligence deep-link) ── */}
            {prefillSource && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                borderRadius: "8px",
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                marginBottom: "0",
                fontSize: "0.8125rem",
                color: "#1E40AF",
              }}>
                <span style={{ flex: 1 }}>
                  <strong>Pre-filled from:</strong> {prefillSource}. Review and adjust inputs below before running.
                </span>
                <button
                  onClick={() => setPrefillSource(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#60A5FA", fontWeight: 700, fontSize: "1rem", padding: 0 }}
                >
                  ×
                </button>
              </div>
            )}

            {/* ── Scenario Calibration Banner ── */}
            {!calBannerDismissed && (
              <div
                style={{
                  background: "rgba(180,83,9,0.06)",
                  border: "1px solid rgba(180,83,9,0.25)",
                  borderLeft: "3px solid #B45309",
                  borderRadius: "0 0.625rem 0.625rem 0",
                  padding: "0.875rem 1rem",
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.625rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Zap size={14} style={{ color: "#B45309", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#B45309" }}>
                      Market Calibration Available
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.1rem 0.45rem",
                        borderRadius: "9999px",
                        background: "rgba(180,83,9,0.12)",
                        color: "#B45309",
                      }}
                    >
                      {SCENARIO_CALIBRATION.length} signals diverged from last-run assumptions
                    </span>
                  </div>
                  <button
                    onClick={() => setCalBannerDismissed(true)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#94A3B8",
                      fontSize: "1rem",
                      lineHeight: 1,
                      padding: "0.1rem",
                    }}
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>

                {/* Divergence rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.75rem" }}>
                  {SCENARIO_CALIBRATION.map((div) => (
                    <div
                      key={div.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "0.5rem",
                        fontSize: "0.78rem",
                        alignItems: "center",
                        padding: "0.3rem 0.5rem",
                        background: "rgba(255,255,255,0.6)",
                        borderRadius: "0.375rem",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#0F172A" }}>{div.label}</span>
                      <span style={{ color: "#475569" }}>
                        <span style={{ fontWeight: 600 }}>Market:</span> {div.currentMarket}
                      </span>
                      <span
                        style={{
                          color:
                            div.severity === "high" ? "#B91C1C" :
                            div.severity === "medium" ? "#B45309" : "#15803D",
                          fontWeight: 700,
                        }}
                      >
                        {div.divergence}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Action button + helper text — allow text to wrap on narrow widths */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                <button
                  onClick={() => {
                    const patch: Record<string, number> = {};
                    for (const d of SCENARIO_CALIBRATION) {
                      patch[d.suggestedInputKey] = d.suggestedValue;
                    }
                    updateFormInputs(patch as Parameters<typeof updateFormInputs>[0]);
                    setCalBannerDismissed(true);
                  }}
                  style={{
                    padding: "0.4rem 1.25rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #B45309",
                    background: "#B45309",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  <Zap size={13} /> Pre-populate from market data
                </button>
                <span
                  style={{
                    marginLeft: "0.75rem",
                    fontSize: "0.75rem",
                    color: "#94A3B8",
                    maxWidth: "340px",
                    lineHeight: 1.5,
                  }}
                >
                  Sets Fuel +14.3%, GDP −0.6pp, EUR/USD −2.0% · You can adjust before running
                </span>
                </div>{/* end flex-wrap row */}
              </div>
            )}

            <Card
              title="Scenario Definition"
              subtitle={editorMode === "form" ? "Visual parameter form — changes sync to DSL" : "JSON DSL editor — validated on change"}
              headerRight={
                <button
                  onClick={() => setEditorMode(editorMode === "form" ? "dsl" : "form")}
                  style={{
                    ...BTN_OUTLINE,
                    padding: "0.3rem 0.75rem", fontSize: "0.8125rem",
                    color: "rgba(255,255,255,0.85)",
                    borderColor: "rgba(255,255,255,0.3)",
                  }}
                >
                  {editorMode === "form" ? "Switch to DSL" : "Switch to Form"}
                </button>
              }
            >
              {/* Scenario name */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.375rem" }}>
                  Scenario Name
                </label>
                <input
                  value={customName}
                  onChange={(e) => {
                    setCustomName(e.target.value);
                    setDslText(generateDSL(formInputs, e.target.value, customMode, customPaths, customSeed));
                  }}
                  style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "#0F172A", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {editorMode === "form" ? (
                /* ── Visual Form ── */
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                    Macro Shocks
                  </div>
                  <SliderRow label="GDP Growth Delta" min={-0.10} max={0.05} step={0.005}
                    value={formInputs.gdpDelta} onChange={(v) => updateFormInputs({ gdpDelta: v })}
                    fmt={(v) => v === 0 ? "Baseline" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`} />
                  <SliderRow label="RPK Growth Delta" min={-0.60} max={0.10} step={0.01}
                    value={formInputs.rpkDelta} onChange={(v) => updateFormInputs({ rpkDelta: v })}
                    fmt={(v) => v === 0 ? "Baseline" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`} />
                  <SliderRow label="Fuel Price Delta" min={-0.20} max={0.80} step={0.01}
                    value={formInputs.fuelDelta} onChange={(v) => updateFormInputs({ fuelDelta: v })}
                    fmt={(v) => v === 0 ? "Baseline" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`} />
                  <SliderRow label="FX Basket Delta (USD)" min={-0.50} max={0.10} step={0.01}
                    value={formInputs.fxDelta} onChange={(v) => updateFormInputs({ fxDelta: v })}
                    fmt={(v) => v === 0 ? "Baseline" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`} />
                  <SliderRow label="Interest Rate Delta" min={-0.01} max={0.03} step={0.0025}
                    value={formInputs.rateDelta} onChange={(v) => updateFormInputs({ rateDelta: v })}
                    fmt={(v) => v === 0 ? "Baseline" : `${v > 0 ? "+" : ""}${Math.round(v * 10000)}bps`} />
                  <SliderRow label="Asset Value Delta" min={-0.40} max={0.10} step={0.01}
                    value={formInputs.assetValueDelta} onChange={(v) => updateFormInputs({ assetValueDelta: v })}
                    fmt={(v) => v === 0 ? "Baseline" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`} />

                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "1rem 0 0.75rem" }}>
                    PD Multipliers
                  </div>
                  <SliderRow label="Stage 2 PD Multiplier" min={0.5} max={4.0} step={0.1}
                    value={formInputs.pdS2Multi} onChange={(v) => updateFormInputs({ pdS2Multi: v })}
                    fmt={(v) => `×${v.toFixed(1)}`}
                    warn={formInputs.pdS2Multi > 2.0} />
                  <SliderRow label="Stage 3 PD Multiplier" min={0.5} max={5.0} step={0.1}
                    value={formInputs.pdS3Multi} onChange={(v) => updateFormInputs({ pdS3Multi: v })}
                    fmt={(v) => `×${v.toFixed(1)}`}
                    warn={formInputs.pdS3Multi > 3.0} />

                  {/* ── Distress & Mitigation — collapsible ── */}
                  {(() => {
                    const activeLevers = [
                      formInputs.deferralMonths !== 0,
                      formInputs.govtSupportProb !== 0,
                      formInputs.forgivenessRate !== 0,
                      formInputs.pbhConversionPct !== 0,
                      formInputs.etpRate !== 0,
                      formInputs.lecRate !== 0,
                    ].filter(Boolean).length;

                    const MONTHLY_RENT_M = 2.85;
                    const deferralPenalty =
                      formInputs.deferralMonths *
                      (1 - formInputs.govtSupportProb) *
                      formInputs.forgivenessRate *
                      MONTHLY_RENT_M;
                    const pbhBenefit  = formInputs.pbhConversionPct * liveBaseECL * 0.15;
                    const etpBenefit  = formInputs.etpRate           * liveBaseECL * 0.08;
                    const lecBenefit  = formInputs.lecRate            * liveBaseECL * 0.05;
                    const netDistress = deferralPenalty - pbhBenefit - etpBenefit - lecBenefit;

                    return (
                      <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                        {/* Section header button */}
                        <button
                          onClick={() => setDistressOpen((o) => !o)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.875rem",
                            background: distressOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                            border: "none", cursor: "pointer",
                            borderBottom: distressOpen ? "1px solid #E2E8F0" : "none",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Distress &amp; Mitigation
                            </span>
                            {activeLevers > 0 && (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                {activeLevers} active levers
                              </span>
                            )}
                            {activeLevers === 0 && (
                              <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>0 active levers</span>
                            )}
                          </div>
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: distressOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
                          >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {/* Collapsible body */}
                        <AnimatePresence initial={false}>
                          {distressOpen && (
                            <motion.div
                              key="distress-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0.875rem" }}>
                                {/* Sub-group: Deferral & Forgiveness */}
                                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                                  Deferral &amp; Forgiveness
                                </div>
                                <SliderRow
                                  label="Deferral Duration"
                                  min={0} max={24} step={1}
                                  value={formInputs.deferralMonths}
                                  onChange={(v) => updateFormInputs({ deferralMonths: v })}
                                  fmt={(v) => v === 0 ? "None" : `${v} mo`}
                                />
                                <SliderRow
                                  label="Govt Support Probability"
                                  min={0} max={1} step={0.05}
                                  value={formInputs.govtSupportProb}
                                  onChange={(v) => updateFormInputs({ govtSupportProb: v })}
                                  fmt={(v) => v === 0 ? "None" : `${Math.round(v * 100)}%`}
                                />
                                <SliderRow
                                  label="Forgiveness Rate"
                                  min={0} max={1} step={0.05}
                                  value={formInputs.forgivenessRate}
                                  onChange={(v) => updateFormInputs({ forgivenessRate: v })}
                                  fmt={(v) => v === 0 ? "None" : `${Math.round(v * 100)}%`}
                                />

                                {/* Divider */}
                                <div style={{ borderTop: "1px solid #F1F5F9", margin: "0.75rem 0" }} />

                                {/* Sub-group: Lessor Mitigation */}
                                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                                  Lessor Mitigation
                                </div>
                                <SliderRow
                                  label="PBH Conversion"
                                  min={0} max={1} step={0.05}
                                  value={formInputs.pbhConversionPct}
                                  onChange={(v) => updateFormInputs({ pbhConversionPct: v })}
                                  fmt={(v) => v === 0 ? "None" : `${Math.round(v * 100)}% of fleet`}
                                />
                                <SliderRow
                                  label="ETP Rate"
                                  min={0} max={0.5} step={0.05}
                                  value={formInputs.etpRate}
                                  onChange={(v) => updateFormInputs({ etpRate: v })}
                                  fmt={(v) => v === 0 ? "None" : `${Math.round(v * 100)}% of lease value`}
                                />
                                <SliderRow
                                  label="LEC Rate"
                                  min={0} max={0.3} step={0.05}
                                  value={formInputs.lecRate}
                                  onChange={(v) => updateFormInputs({ lecRate: v })}
                                  fmt={(v) => v === 0 ? "None" : `${Math.round(v * 100)}% of half-life value`}
                                />

                                {/* Net impact line */}
                                {activeLevers > 0 && (
                                  <div style={{ marginTop: "0.75rem", padding: "0.625rem 0.75rem", background: "#F8FAFC", borderRadius: "0.375rem", border: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#475569", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                    <span>
                                      Deferral penalty{" "}
                                      <span style={{ fontWeight: 700, color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                                        +${deferralPenalty.toFixed(1)}M
                                      </span>
                                    </span>
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span>
                                      Mitigation{" "}
                                      <span style={{ fontWeight: 700, color: "#15803D", fontVariantNumeric: "tabular-nums" }}>
                                        −${(pbhBenefit + etpBenefit + lecBenefit).toFixed(1)}M
                                      </span>
                                    </span>
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span>
                                      Net{" "}
                                      <span style={{ fontWeight: 700, color: netDistress >= 0 ? "#B91C1C" : "#15803D", fontVariantNumeric: "tabular-nums" }}>
                                        {netDistress >= 0 ? "+" : "−"}${Math.abs(netDistress).toFixed(1)}M
                                      </span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}

                  {/* ── Insolvency Regime — collapsible ── */}
                  {(() => {
                    const selectedRegime = formInputs.bankruptcyScenarioType;
                    const lgdFactor = selectedRegime !== null ? (LGD_DELTAS[selectedRegime] ?? 0) : 0;
                    const lgdImpact = lgdFactor * liveBaseECL;
                    const isLgdPositive = lgdImpact > 0;

                    return (
                      <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                        {/* Section header */}
                        <button
                          onClick={() => setInsolvencyOpen((o) => !o)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.875rem",
                            background: insolvencyOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                            border: "none", cursor: "pointer",
                            borderBottom: insolvencyOpen ? "1px solid #E2E8F0" : "none",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Insolvency Regime
                            </span>
                            {selectedRegime !== null ? (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                {REGIME_SHORT_NAMES[selectedRegime] ?? selectedRegime}
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>None selected</span>
                            )}
                          </div>
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: insolvencyOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
                          >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {/* Collapsible body */}
                        <AnimatePresence initial={false}>
                          {insolvencyOpen && (
                            <motion.div
                              key="insolvency-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0.875rem" }}>
                                {/* Regime dropdown */}
                                <select
                                  value={selectedRegime ?? ""}
                                  onChange={(e) => updateFormInputs({
                                    bankruptcyScenarioType: e.target.value === "" ? null : e.target.value,
                                  })}
                                  style={{
                                    width: "100%", padding: "0.5rem 0.75rem",
                                    border: "1px solid #E2E8F0", borderRadius: "0.375rem",
                                    background: "#FFFFFF", color: "#1E293B",
                                    fontSize: "0.8125rem", cursor: "pointer",
                                  }}
                                >
                                  <option value="">── None (no regime adjustment) ──</option>
                                  <option value="chapter11">🇺🇸  US Chapter 11 (§1110)</option>
                                  <option value="india_ibc">🇮🇳  India IBC</option>
                                  <option value="mexico_concurso">🇲🇽  Mexico Concurso Mercantil</option>
                                  <option value="brazil_rj">🇧🇷  Brazil RJ (Recuperação Judicial)</option>
                                  <option value="indonesia_pkpu">🇮🇩  Indonesia PKPU</option>
                                  <option value="generic_liquidation">🌐  Generic Liquidation (Ch.7 / Civil-Law)</option>
                                </select>

                                {/* Regime description */}
                                {selectedRegime !== null && REGIME_DESCRIPTIONS[selectedRegime] && (
                                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "0.5rem 0 0", lineHeight: 1.5 }}>
                                    {REGIME_DESCRIPTIONS[selectedRegime]}
                                  </p>
                                )}

                                {/* LGD impact line — only when a regime is selected and portfolio ECL is loaded */}
                                {selectedRegime !== null && liveBaseECL > 0 && (
                                  <div style={{ marginTop: "0.75rem", padding: "0.625rem 0.75rem", background: "#F8FAFC", borderRadius: "0.375rem", border: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#475569", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                    <span>
                                      LGD adjustment{" "}
                                      <span style={{ fontWeight: 700, color: isLgdPositive ? "#B91C1C" : "#15803D", fontVariantNumeric: "tabular-nums" }}>
                                        {isLgdPositive ? "+" : "−"}${Math.abs(lgdImpact).toFixed(1)}M
                                      </span>
                                    </span>
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span style={{ color: "#64748B" }}>
                                      {isLgdPositive ? "LGD deterioration" : "Recovery premium"}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}

                  {/* Live ECL preview */}
                  <div style={{ marginTop: "1rem", padding: "0.875rem", background: "rgba(0,33,71,0.04)", border: "1px solid rgba(0,33,71,0.1)", borderRadius: "0.375rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Live ECL Preview</div>
                        <div style={{ fontSize: "1.375rem", fontWeight: 700, color: "#002147", fontVariantNumeric: "tabular-nums" }}>
                          ${computeECLFromBase(liveBaseECL, formInputs).toFixed(1)}M
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>vs portfolio ECL</div>
                        <div style={{
                          fontSize: "0.875rem", fontWeight: 600,
                          color: computeECLFromBase(liveBaseECL, formInputs) > liveBaseECL ? "#B91C1C" : "#15803D",
                          fontVariantNumeric: "tabular-nums",
                        }}>
                          {computeECLFromBase(liveBaseECL, formInputs) >= liveBaseECL ? "+" : ""}
                          ${(computeECLFromBase(liveBaseECL, formInputs) - liveBaseECL).toFixed(1)}M
                          {" "}({computeECLFromBase(liveBaseECL, formInputs) >= liveBaseECL ? "+" : ""}
                          {(((computeECLFromBase(liveBaseECL, formInputs) - liveBaseECL) / liveBaseECL) * 100).toFixed(0)}%)
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: "0.5rem", fontSize: "0.6875rem", color: "#94A3B8" }}>
                      Portfolio base ECL: <span style={{ fontWeight: 600, color: "#475569" }}>${liveBaseECL.toFixed(1)}M</span>
                    </div>
                  </div>

                  <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => {
                        setFormInputs(ZERO_INPUTS);
                        setDslText(generateDSL(ZERO_INPUTS, customName, customMode, customPaths, customSeed));
                        setDistressOpen(false);
                        setInsolvencyOpen(false);
                      }}
                      style={{ ...BTN_OUTLINE, fontSize: "0.8125rem" }}
                    >
                      Reset to Baseline
                    </button>
                  </div>
                </div>
              ) : (
                /* ── DSL Editor ── */
                <div>
                  <div style={{ background: "#0F172A", borderRadius: "0.375rem", padding: "1rem", overflow: "auto", maxHeight: "500px" }}>
                    <textarea
                      value={dslText}
                      onChange={(e) => handleDslChange(e.target.value)}
                      spellCheck={false}
                      style={{
                        width: "100%", background: "transparent", border: "none", outline: "none",
                        color: "#E2E8F0", fontFamily: "monospace", fontSize: "0.8125rem",
                        lineHeight: 1.7, resize: "vertical", minHeight: "380px",
                      }}
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Custom Result Panel + Skeleton */}
            {(customRunning || (customResultId && findRun(customResultId))) && (
              <div ref={customResultRef}>
                {customRunning ? (
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: "var(--radius-lg)",
                      padding: "1.5rem",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1.25rem" }}>
                      <RefreshCw size={14} className="animate-spin" style={{ color: "#94A3B8" }} />
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#475569" }}>
                        {customMode === "deterministic" ? "Running deterministic model…" : "Running Monte Carlo paths…"}
                      </span>
                    </div>
                    {/* Skeleton rows */}
                    {[180, 140, 220, 100, 160].map((w, i) => (
                      <div
                        key={i}
                        style={{
                          height: i === 0 ? "2rem" : "0.875rem",
                          width: `${w}px`,
                          maxWidth: "100%",
                          background: "linear-gradient(90deg, #F1F5F9 25%, #E8EFF7 50%, #F1F5F9 75%)",
                          backgroundSize: "400px 100%",
                          borderRadius: "0.375rem",
                          marginBottom: i === 0 ? "1rem" : "0.625rem",
                          animation: "skeletonShimmer 1.4s ease-in-out infinite",
                        }}
                      />
                    ))}
                    <style>{`
                      @keyframes skeletonShimmer {
                        0%   { background-position: -400px 0; }
                        100% { background-position:  400px 0; }
                      }
                    `}</style>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3,1fr)",
                        gap: "0.75rem",
                        marginTop: "1.25rem",
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          style={{
                            height: "5rem",
                            background: "linear-gradient(90deg, #F1F5F9 25%, #E8EFF7 50%, #F1F5F9 75%)",
                            backgroundSize: "400px 100%",
                            borderRadius: "0.625rem",
                            border: "1px solid #E2E8F0",
                            animation: "skeletonShimmer 1.4s ease-in-out infinite",
                            animationDelay: `${i * 0.15}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  customResultId && findRun(customResultId) && (
                    <RunResultPanel
                      run={findRun(customResultId)!}
                      onClose={() => setCustomResultId(null)}
                      narrative={getNarrative(customResultId)}
                      onRequestNarrative={handleRequestNarrative}
                    />
                  )
                )}
              </div>
            )}
          </div>

          {/* Right: Config + Validation */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <Card title="Run Configuration" blueHeader={false}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <ModeToggle
                  mode={customMode} paths={customPaths}
                  onMode={(m) => { setCustomMode(m); setDslText(generateDSL(formInputs, customName, m, customPaths, customSeed)); }}
                  onPaths={(p) => { setCustomPaths(p); setDslText(generateDSL(formInputs, customName, customMode, p, customSeed)); }}
                />
                <button
                  onClick={handleCustomRun}
                  disabled={customRunning}
                  style={{
                    ...BTN_PRIMARY,
                    justifyContent: "center",
                    width: "100%",
                    background: customRunning ? "#94A3B8" : "#002147",
                    cursor: customRunning ? "not-allowed" : "pointer",
                  }}
                >
                  {customRunning ? (
                    <><RefreshCw size={13} className="animate-spin" /> Running…</>
                  ) : (
                    <><Play size={13} /> Execute Run</>
                  )}
                </button>
              </div>
            </Card>

            <Card title="Validation" blueHeader={false}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {dslErrors.length === 0 ? (
                  <>
                    {[
                      "Valid JSON / form structure",
                      "All required fields present",
                      "Seed value set (reproducible)",
                    ].map((msg) => (
                      <div key={msg} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
                        <CheckCircle size={13} style={{ color: "#15803D", flexShrink: 0 }} />
                        <span style={{ color: "#475569" }}>{msg}</span>
                      </div>
                    ))}
                    {formInputs.pdS3Multi > 3.0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
                        <AlertTriangle size={13} style={{ color: "#B45309", flexShrink: 0 }} />
                        <span style={{ color: "#B45309" }}>PD Stage-3 multiplier exceeds default by &gt;2σ</span>
                      </div>
                    )}
                  </>
                ) : (
                  dslErrors.map((err) => (
                    <div key={err} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.8125rem" }}>
                      {err.startsWith("Invalid") || err.includes("must be") ? (
                        <X size={13} style={{ color: "#B91C1C", flexShrink: 0, marginTop: "0.125rem" }} />
                      ) : (
                        <AlertTriangle size={13} style={{ color: "#B45309", flexShrink: 0, marginTop: "0.125rem" }} />
                      )}
                      <span style={{ color: err.startsWith("Invalid") ? "#B91C1C" : "#B45309" }}>{err}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Scenario summary */}
            <Card title="Scenario Summary" blueHeader={false}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8125rem" }}>
                {[
                  ["GDP shock", formInputs.gdpDelta === 0 ? "Baseline" : `${formInputs.gdpDelta > 0 ? "+" : ""}${(formInputs.gdpDelta * 100).toFixed(1)}%`],
                  ["RPK shock", formInputs.rpkDelta === 0 ? "Baseline" : `${formInputs.rpkDelta > 0 ? "+" : ""}${(formInputs.rpkDelta * 100).toFixed(0)}%`],
                  ["Fuel shock", formInputs.fuelDelta === 0 ? "Baseline" : `${formInputs.fuelDelta > 0 ? "+" : ""}${(formInputs.fuelDelta * 100).toFixed(0)}%`],
                  ["FX shock", formInputs.fxDelta === 0 ? "Baseline" : `${formInputs.fxDelta > 0 ? "+" : ""}${(formInputs.fxDelta * 100).toFixed(0)}%`],
                  ["Asset value", formInputs.assetValueDelta === 0 ? "Baseline" : `${formInputs.assetValueDelta > 0 ? "+" : ""}${(formInputs.assetValueDelta * 100).toFixed(0)}%`],
                  ["PD S2 multi", `×${formInputs.pdS2Multi.toFixed(1)}`],
                  ["PD S3 multi", `×${formInputs.pdS3Multi.toFixed(1)}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94A3B8" }}>{k}</span>
                    <span
                      style={{
                        fontWeight: 500,
                        color: v === "Baseline" ? "#94A3B8" : "#0F172A",
                        fontVariantNumeric: "tabular-nums",
                        fontFamily: "monospace",
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ══ RUN HISTORY TAB ══════════════════════════════════════════════════ */}
      {activeTab === "Run History" && (
        <Card
          title="All Scenario Runs"
          subtitle="Immutable audit records — every run reproducible to exact inputs and seed"
          noPadding
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%", borderCollapse: "collapse",
                fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums",
              }}
            >
              <thead>
                <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                  {["expand", "Run ID", "Scenario", "Mode", "Paths", "Run Date", "Portfolio ECL", "Duration", "Status", "actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600,
                        color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase",
                        letterSpacing: "0.05em", whiteSpace: "nowrap",
                      }}
                    >
                      {h === "expand" || h === "actions" ? "" : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Build parent→children map for tree view
                  const childMap = new Map<string, ScenarioRunResult[]>();
                  runs.forEach((r) => {
                    if (r.parentId) {
                      const arr = childMap.get(r.parentId) ?? [];
                      arr.push(r);
                      childMap.set(r.parentId, arr);
                    }
                  });
                  // Roots = runs with no parentId, in existing order
                  const roots = runs.filter((r) => !r.parentId);
                  // Flatten: root then its children, for striping
                  const flat: Array<{ run: ScenarioRunResult; isChild: boolean }> = [];
                  roots.forEach((r) => {
                    flat.push({ run: r, isChild: false });
                    (childMap.get(r.id) ?? []).forEach((c) => flat.push({ run: c, isChild: true }));
                  });
                  return flat.map(({ run, isChild }, i) => {
                  const isExpanded = expandedRunId === run.id;
                  return (
                    <React.Fragment key={run.id}>
                      <tr
                        style={{
                          borderBottom: isExpanded ? "none" : "1px solid #E2E8F0",
                          background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7",
                          transition: "background 120ms",
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "#FFFFFF" : "#F4F5F7")}
                      >
                        {/* Expand toggle */}
                        <td style={{ padding: "0.75rem 0.5rem 0.75rem 1rem" }}>
                          <button
                            onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", alignItems: "center" }}
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569", whiteSpace: "nowrap" }}>
                          {isChild && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginRight: "0.375rem", color: "#CBD5E1" }}>
                              <GitBranch size={10} />
                            </span>
                          )}
                          {run.id}
                        </td>
                        <td style={{ padding: isChild ? "0.75rem 1rem 0.75rem 1.75rem" : "0.75rem 1rem", fontWeight: 600, color: isChild ? "#475569" : "#0F172A" }}>
                          {run.name}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ fontSize: "0.75rem", background: "#F4F5F7", color: "#475569", padding: "0.2rem 0.5rem", borderRadius: "0.5rem", border: "1px solid #E2E8F0" }}>
                            {run.mode === "deterministic" ? "Deterministic" : "Monte Carlo"}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                          {run.paths?.toLocaleString() ?? "—"}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569", whiteSpace: "nowrap" }}>
                          {run.runDate}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>
                          ${run.ecl.toFixed(1)}M
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#94A3B8", fontFamily: "monospace" }}>
                          {run.durationSec}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <StatusPill stage="green" label="Complete" />
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "nowrap" }}>
                            <button
                              onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                              style={{ ...BTN_OUTLINE, fontSize: "0.75rem", padding: "0.25rem 0.5rem", gap: "0.25rem" }}
                            >
                              {isExpanded ? <><ChevronUp size={10} /> Hide</> : <><ChevronDown size={10} /> View Results</>}
                            </button>
                            <button
                              title="Clone this run into the Custom Builder"
                              onClick={() => setClonePending({ inputs: getRunInputs(run), name: `Clone of ${run.name}`, mode: run.mode, paths: run.paths ?? 10000 })}
                              style={{ ...BTN_OUTLINE, fontSize: "0.75rem", padding: "0.25rem 0.5rem", gap: "0.25rem", whiteSpace: "nowrap" }}
                            >
                              <Copy size={10} /> Clone & Edit
                            </button>
                            <button
                              title="Branch a new scenario from this run"
                              onClick={() => { setBranchFromId(run.id); setClonePending({ inputs: getRunInputs(run), name: `Branch of ${run.name}`, mode: run.mode, paths: run.paths ?? 10000 }); }}
                              style={{ ...BTN_OUTLINE, fontSize: "0.75rem", padding: "0.25rem 0.5rem", gap: "0.25rem", whiteSpace: "nowrap" }}
                            >
                              <GitBranch size={10} /> Branch
                            </button>
                            <button style={{ ...BTN_OUTLINE, fontSize: "0.75rem", padding: "0.25rem 0.4rem" }}>
                              <Download size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded result row */}
                      {isExpanded && (
                        <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                          <td />
                          <td colSpan={9} style={{ padding: "0 1rem 1rem" }}>
                            <RunResultPanel
                              run={run}
                              narrative={getNarrative(run.id)}
                              onRequestNarrative={handleRequestNarrative}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ══ INSOLVENCY REGIMES TAB ══════════════════════════════════════ */}
      {activeTab === "Insolvency Regimes" && <InsolvencyTab />}

      {/* ══ LEASE PRICING TAB ═══════════════════════════════════════════ */}
      {activeTab === "Lease Pricing" && <LeasePricingTab />}

      <style>{`
        @keyframes progress-fill {
          from { width: 0%; }
          to { width: 95%; }
        }
      `}</style>
    </div>
  );
}
