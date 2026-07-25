// ─────────────────────────────────────────────────────────────────────────────
// scenarios/CustomBuilderTab.tsx
//
// Custom Builder tab content: free-form scenario builder with the editor on
// the left (form ↔ DSL toggle) and the result panel on the right. Includes
// all sub-sections (distress levers, insolvency regime, jurisdiction risk,
// security deposits, payment behaviour, asset risk) and their portfolio
// pre-fill handlers.
//
// All state and callbacks live in the Scenarios shell — this is the biggest
// tab by far because it reads/writes the most state, but it owns none of it.
// The collapsible-section booleans are also in the shell so they survive tab
// switches.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RefreshCw, X, CheckCircle, AlertTriangle, Zap } from "lucide-react";
import { Card } from "../../components/ui/Card";
import {
  RunResultPanel,
  type ScenarioRunResult,
} from "../../components/scenarios/RunResultPanel";
import { ScenarioInsightsPanel } from "../../components/scenarios/ScenarioInsightsPanel";
import type { ScenarioCalibrationDivergence } from "../../data/intelligenceData";
import { RESTRUCTURING_TYPES } from "../../utils/deferralRisk";
import {
  ScenarioInputs,
  ZERO_INPUTS,
  BASE_ECL,
  LGD_DELTAS,
  computeECLFromBase,
} from "../../utils/eclCalculator";
import type { computePortfolioJurisdictionMix } from "../../utils/jurisdictionRisk";
import type { computePortfolioAssetRisk } from "../../utils/assetRisk";
import type { computePortfolioDepositCoverage } from "../../utils/creditDeposit";
import type { computePortfolioPaymentBehaviourMix } from "../../utils/paymentBehaviour";
type PortfolioJurisdictionMix = ReturnType<typeof computePortfolioJurisdictionMix>;
type PortfolioAssetRisk = ReturnType<typeof computePortfolioAssetRisk>;
type PortfolioDepositCoverage = ReturnType<typeof computePortfolioDepositCoverage>;
type PortfolioPaymentBehaviourMix = ReturnType<typeof computePortfolioPaymentBehaviourMix>;
import SliderRow from "./SliderRow";
import ModeToggle from "./ModeToggle";
import {
  BTN_PRIMARY,
  BTN_OUTLINE,
  REGIME_DESCRIPTIONS,
  REGIME_SHORT_NAMES,
  generateDSL,
  type RunMode,
} from "./_shared";

export interface CustomBuilderTabProps {
  // Pre-fill banner (Intelligence deep-link)
  prefillSource: string | null;
  setPrefillSource: (v: string | null) => void;
  // Calibration banner
  calBannerDismissed: boolean;
  setCalBannerDismissed: (v: boolean) => void;
  // Custom-scenario form state
  customName: string;
  setCustomName: (v: string) => void;
  formInputs: ScenarioInputs;
  setFormInputs: (v: ScenarioInputs) => void;
  updateFormInputs: (partial: Partial<ScenarioInputs>) => void;
  customMode: RunMode;
  setCustomMode: (m: RunMode) => void;
  customPaths: number;
  setCustomPaths: (n: number) => void;
  customSeed: number;
  editorMode: "form" | "dsl";
  setEditorMode: (m: "form" | "dsl") => void;
  // Collapsible sections — use SetStateAction so callsites can use
  // functional updaters like `setX((o) => !o)`.
  distressOpen: boolean;
  setDistressOpen: React.Dispatch<React.SetStateAction<boolean>>;
  insolvencyOpen: boolean;
  setInsolvencyOpen: React.Dispatch<React.SetStateAction<boolean>>;
  jurisdictionOpen: boolean;
  setJurisdictionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  depositOpen: boolean;
  setDepositOpen: React.Dispatch<React.SetStateAction<boolean>>;
  payBehaviourOpen: boolean;
  setPayBehaviourOpen: React.Dispatch<React.SetStateAction<boolean>>;
  assetRiskOpen: boolean;
  setAssetRiskOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // DSL editor
  dslText: string;
  setDslText: (v: string) => void;
  dslErrors: string[];
  handleDslChange: (text: string) => void;
  // Run execution
  customRunning: boolean;
  setCustomRunning: (v: boolean) => void;
  customResultId: string | null;
  setCustomResultId: (v: string | null) => void;
  customResultRef: React.RefObject<HTMLDivElement | null>;
  handleCustomRun: () => Promise<void>;
  // Portfolio-derived data
  liveBaseECL: number;
  calibration: ScenarioCalibrationDivergence[];
  portfolioJurisdictionMix: PortfolioJurisdictionMix;
  portfolioAssetRisk: PortfolioAssetRisk;
  portfolioDepositMix: PortfolioDepositCoverage;
  portfolioDepositCoverage: number;
  portfolioPayBehaviourMix: PortfolioPaymentBehaviourMix;
  // Result lookup + narrative
  findRun: (id: string) => ScenarioRunResult | undefined;
  getNarrative: (runId: string) => string | null | "loading";
  onRequestNarrative: (run: ScenarioRunResult) => Promise<void>;
}

// Internal implementation. Wrapped in React.memo at the bottom — without
// it, a pathname-driven re-render of the parent Scenarios component would
// cascade through this 1570-line tree on every navigation, producing the
// "leaving Scenarios freezes next tab" symptom. Every prop reference is
// memoised in Scenarios so shallow equality skips the subtree's render
// entirely on cross-page nav.
function CustomBuilderTabImpl({
  prefillSource,
  setPrefillSource,
  calBannerDismissed,
  setCalBannerDismissed,
  customName,
  setCustomName,
  formInputs,
  setFormInputs,
  updateFormInputs,
  customMode,
  setCustomMode,
  customPaths,
  setCustomPaths,
  customSeed,
  editorMode,
  setEditorMode,
  distressOpen,
  setDistressOpen,
  insolvencyOpen,
  setInsolvencyOpen,
  jurisdictionOpen,
  setJurisdictionOpen,
  depositOpen,
  setDepositOpen,
  payBehaviourOpen,
  setPayBehaviourOpen,
  assetRiskOpen,
  setAssetRiskOpen,
  dslText,
  setDslText,
  dslErrors,
  handleDslChange,
  customRunning,
  setCustomRunning,
  customResultId,
  setCustomResultId,
  customResultRef,
  handleCustomRun,
  liveBaseECL,
  calibration,
  portfolioJurisdictionMix,
  portfolioAssetRisk,
  portfolioDepositMix,
  portfolioDepositCoverage,
  portfolioPayBehaviourMix,
  findRun,
  getNarrative,
  onRequestNarrative,
}: CustomBuilderTabProps) {
  return (
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
                      {calibration.length} signals diverged from last-run assumptions
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
                  {calibration.map((div) => (
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
                    for (const d of calibration) {
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
                <div data-tour="build-coefficients">
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
                                {formInputs.restructuringType !== null
                                  ? `${RESTRUCTURING_TYPES[formInputs.restructuringType].label} · ${activeLevers} lever${activeLevers !== 1 ? "s" : ""}`
                                  : `${activeLevers} active levers`}
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
                                {/* Quick preset pills */}
                                <div style={{ marginBottom: "0.875rem" }}>
                                  <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                                    Quick preset
                                  </div>
                                  <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                                    {Object.entries(RESTRUCTURING_TYPES).map(([key, preset]) => (
                                      <button
                                        key={key}
                                        onClick={() => updateFormInputs({
                                          restructuringType: key,
                                          deferralMonths:    preset.deferralMonths,
                                          govtSupportProb:   preset.govtSupportProb,
                                          forgivenessRate:   preset.forgivenessRate,
                                        })}
                                        style={{
                                          padding:      "0.25rem 0.625rem",
                                          fontSize:     "0.75rem",
                                          fontWeight:   600,
                                          borderRadius: "9999px",
                                          border:       formInputs.restructuringType === key ? "none" : "1px solid #E2E8F0",
                                          background:   formInputs.restructuringType === key ? "#002147" : "#FFFFFF",
                                          color:        formInputs.restructuringType === key ? "#FFFFFF" : "#475569",
                                          cursor:       "pointer",
                                        }}
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                    <button
                                      onClick={() => updateFormInputs({ restructuringType: null, deferralMonths: 0, govtSupportProb: 0, forgivenessRate: 0 })}
                                      style={{
                                        padding:      "0.25rem 0.625rem",
                                        fontSize:     "0.75rem",
                                        fontWeight:   500,
                                        borderRadius: "9999px",
                                        border:       "1px solid #E2E8F0",
                                        background:   "#FFFFFF",
                                        color:        "#94A3B8",
                                        cursor:       "pointer",
                                      }}
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>

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

                                {/* §1110 Lease Assumption slider — only when regime is selected */}
                                {selectedRegime !== null && (
                                  <div style={{ marginTop: "0.875rem" }}>
                                    <SliderRow
                                      label="Lease Assumption %"
                                      min={0} max={1} step={0.05}
                                      value={formInputs.leaseAssumptionPct}
                                      onChange={(v) => updateFormInputs({ leaseAssumptionPct: v })}
                                      fmt={(v) => v === 0 ? "0% (all rejected)" : `${(v * 100).toFixed(0)}% assumed`}
                                    />
                                    <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginBottom: "0.75rem", marginTop: "-0.25rem" }}>
                                      Share of leases the debtor elects to keep (§1110). Each 1% assumed → −0.25% of base ECL.
                                    </div>
                                  </div>
                                )}

                                {/* LGD impact line — only when a regime is selected and portfolio ECL is loaded */}
                                {selectedRegime !== null && liveBaseECL > 0 && (() => {
                                  const assumptionBenefit = formInputs.leaseAssumptionPct > 0
                                    ? formInputs.leaseAssumptionPct * 0.25 * liveBaseECL
                                    : 0;
                                  return (
                                    <div style={{ marginTop: "0.75rem", padding: "0.625rem 0.75rem", background: "#F8FAFC", borderRadius: "0.375rem", border: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#475569", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                      <span>
                                        LGD adjustment{" "}
                                        <span style={{ fontWeight: 700, color: isLgdPositive ? "#B91C1C" : "#15803D", fontVariantNumeric: "tabular-nums" }}>
                                          {isLgdPositive ? "+" : "−"}${Math.abs(lgdImpact).toFixed(1)}M
                                        </span>
                                      </span>
                                      {assumptionBenefit > 0 && (
                                        <>
                                          <span style={{ color: "#CBD5E1" }}>·</span>
                                          <span>
                                            Assumption benefit{" "}
                                            <span style={{ fontWeight: 700, color: "#15803D", fontVariantNumeric: "tabular-nums" }}>
                                              −${assumptionBenefit.toFixed(1)}M
                                            </span>
                                          </span>
                                        </>
                                      )}
                                      <span style={{ color: "#CBD5E1" }}>·</span>
                                      <span style={{ color: "#64748B" }}>
                                        {isLgdPositive ? "LGD deterioration" : "Recovery premium"}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}

                  {/* ── Jurisdiction Risk — collapsible ── */}
                  {(() => {
                    const goldPct      = formInputs.ctcGoldPct;
                    const nonCtcP      = formInputs.nonCtcPct;
                    const repossMonths = formInputs.repossWeightedMonths;
                    const modPct       = Math.max(0, 1 - goldPct - nonCtcP);
                    const isActive     = goldPct !== 0 || nonCtcP !== 0 || repossMonths !== 0;

                    // Impact values relative to liveBaseECL
                    const modImpact    = modPct   * 0.06 * liveBaseECL;
                    const nonCtcImpact = nonCtcP  * 0.15 * liveBaseECL;
                    const repossImpact = Math.max(0, repossMonths - 3) * 0.025 * liveBaseECL;
                    const totalUplift  = modImpact + nonCtcImpact + repossImpact;

                    return (
                      <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                        {/* Section header */}
                        <button
                          onClick={() => setJurisdictionOpen((o) => !o)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.875rem",
                            background: jurisdictionOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                            border: "none", cursor: "pointer",
                            borderBottom: jurisdictionOpen ? "1px solid #E2E8F0" : "none",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Jurisdiction Risk
                            </span>
                            {isActive ? (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                Moderate {(modPct * 100).toFixed(0)}%
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>None (CTC Gold baseline)</span>
                            )}
                          </div>
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: jurisdictionOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
                          >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {/* Collapsible body */}
                        <AnimatePresence initial={false}>
                          {jurisdictionOpen && (
                            <motion.div
                              key="jurisdiction-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0.875rem" }}>
                                {/* CTC Gold slider — clamped so gold + nonCtc ≤ 1 */}
                                <SliderRow
                                  label="CTC Gold"
                                  min={0} max={1} step={0.05}
                                  value={goldPct}
                                  onChange={(v) => updateFormInputs({ ctcGoldPct: Math.min(v, Math.max(0, 1 - nonCtcP)) })}
                                  fmt={(v) => `${(v * 100).toFixed(0)}%`}
                                />

                                {/* Non-CTC slider — clamped so gold + nonCtc ≤ 1 */}
                                <SliderRow
                                  label="Non-CTC"
                                  min={0} max={1} step={0.05}
                                  value={nonCtcP}
                                  onChange={(v) =>
                                    updateFormInputs({
                                      nonCtcPct: Math.min(v, Math.max(0, 1 - goldPct)),
                                    })
                                  }
                                  fmt={(v) => `${(v * 100).toFixed(0)}%`}
                                />

                                {/* Derived CTC Moderate read-only label */}
                                <div style={{ fontSize: "0.8125rem", color: "#B45309", fontWeight: 500, marginBottom: "0.75rem" }}>
                                  CTC Moderate: {(modPct * 100).toFixed(0)}%
                                </div>

                                {/* Repossession Timeline slider */}
                                <SliderRow
                                  label="Reposs P50 (months)"
                                  min={0} max={24} step={1}
                                  value={repossMonths}
                                  onChange={(v) => updateFormInputs({ repossWeightedMonths: v })}
                                  fmt={(v) => v === 0 ? "Off (US §1110 baseline)" : `${v} mo`}
                                />
                                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginBottom: "0.75rem", marginTop: "-0.25rem" }}>
                                  Rental-weighted P50 repossession timeline. Benchmark: 3 mo (US §1110). Each extra month +2.5% of base ECL.
                                </div>

                                {/* "From portfolio" button */}
                                <button
                                  onClick={() =>
                                    updateFormInputs({
                                      ctcGoldPct:           portfolioJurisdictionMix.ctcGoldPct,
                                      nonCtcPct:            portfolioJurisdictionMix.nonCtcPct,
                                      repossWeightedMonths: Math.round(portfolioJurisdictionMix.avgRepossP50Months),
                                    })
                                  }
                                  title="Computed from your portfolio's lessee country mix, weighted by monthly rental."
                                  style={{
                                    display: "flex", alignItems: "center", gap: "0.375rem",
                                    background: "transparent", color: "#475569",
                                    border: "1px solid #E2E8F0", borderRadius: "9999px",
                                    padding: "0.375rem 0.75rem", fontSize: "0.8125rem",
                                    fontWeight: 500, cursor: "pointer", marginBottom: "0.75rem",
                                  }}
                                >
                                  From portfolio
                                </button>

                                {/* Net impact line — only when active and portfolio ECL loaded */}
                                {isActive && liveBaseECL > 0 && (
                                  <div style={{
                                    padding: "0.625rem 0.75rem",
                                    background: "#F8FAFC", borderRadius: "0.375rem",
                                    border: "1px solid #E2E8F0",
                                    fontSize: "0.75rem", color: "#475569",
                                    display: "flex", gap: "0.75rem", flexWrap: "wrap",
                                  }}>
                                    <span>
                                      CTC Moderate{" "}
                                      <span style={{ fontWeight: 700, color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                                        +${modImpact.toFixed(1)}M
                                      </span>
                                    </span>
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span>
                                      Non-CTC{" "}
                                      <span style={{ fontWeight: 700, color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                                        +${nonCtcImpact.toFixed(1)}M
                                      </span>
                                    </span>
                                    {repossImpact > 0 && (
                                      <>
                                        <span style={{ color: "#CBD5E1" }}>·</span>
                                        <span>
                                          Reposs timeline{" "}
                                          <span style={{ fontWeight: 700, color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                                            +${repossImpact.toFixed(1)}M
                                          </span>
                                        </span>
                                      </>
                                    )}
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span>
                                      Total uplift{" "}
                                      <span style={{ fontWeight: 700, color: totalUplift > 0 ? "#B91C1C" : "#94A3B8", fontVariantNumeric: "tabular-nums" }}>
                                        +${totalUplift.toFixed(1)}M
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

                  {/* ── Asset Risk — collapsible ── */}
                  {(() => {
                    const remMonths = formInputs.remarketingMonths;
                    const decayAdj  = formInputs.lgdDecayAdjFactor;
                    const isActive  = remMonths !== 0 || decayAdj !== 0;

                    const remImpact  = remMonths > 0
                      ? Math.max(0, remMonths - 3) * 0.015 * liveBaseECL
                      : 0;
                    const vintImpact = decayAdj > 0 ? decayAdj * liveBaseECL : 0;
                    const totalUplift = remImpact + vintImpact;

                    return (
                      <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                        <button
                          onClick={() => setAssetRiskOpen((o) => !o)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.875rem",
                            background: assetRiskOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                            border: "none", cursor: "pointer",
                            borderBottom: assetRiskOpen ? "1px solid #E2E8F0" : "none",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Asset Risk
                            </span>
                            {isActive ? (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                +${totalUplift.toFixed(1)}M uplift
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>None (young fleet, liquid market)</span>
                            )}
                          </div>
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: assetRiskOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
                          >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        <AnimatePresence initial={false}>
                          {assetRiskOpen && (
                            <motion.div
                              key="asset-risk-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0.875rem" }}>
                                {/* Remarketing Timeline slider */}
                                <SliderRow
                                  label="Remarketing Timeline"
                                  min={0} max={24} step={1}
                                  value={remMonths}
                                  onChange={(v) => updateFormInputs({ remarketingMonths: v })}
                                  fmt={(v) => v === 0 ? "Off (inactive)" : `${v} mo`}
                                />
                                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginBottom: "0.875rem", marginTop: "-0.25rem" }}>
                                  Post-repossession months to first new lease. Benchmark: 3 mo (baked in). Each extra month +1.5% of base ECL. NB typical: 4 mo · WB typical: 9 mo.
                                </div>

                                {/* Vintage LGD Adjustment slider */}
                                <SliderRow
                                  label="Vintage LGD Adj"
                                  min={0} max={0.15} step={0.005}
                                  value={decayAdj}
                                  onChange={(v) => updateFormInputs({ lgdDecayAdjFactor: v })}
                                  fmt={(v) => v === 0 ? "Off (inactive)" : `${(v * 100).toFixed(1)}% of ECL`}
                                />
                                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginBottom: "0.875rem", marginTop: "-0.25rem" }}>
                                  Fleet age LGD uplift. Mid-aged (10–15yr): 4% · Aged (&gt;15yr): 10%. Computed from actual fleet vintage by "From portfolio".
                                </div>

                                {/* "From portfolio" button */}
                                <button
                                  onClick={() =>
                                    updateFormInputs({
                                      remarketingMonths: portfolioAssetRisk.suggestedRemarketingMonths,
                                      lgdDecayAdjFactor:  portfolioAssetRisk.lgdDecayAdjFactor,
                                    })
                                  }
                                  title="Computed from your portfolio's aircraft type (NB/WB) and vintage year, weighted by monthly rental."
                                  style={{
                                    display: "flex", alignItems: "center", gap: "0.375rem",
                                    background: "transparent", color: "#475569",
                                    border: "1px solid #E2E8F0", borderRadius: "9999px",
                                    padding: "0.375rem 0.75rem", fontSize: "0.8125rem",
                                    fontWeight: 500, cursor: "pointer", marginBottom: "0.75rem",
                                  }}
                                >
                                  From portfolio
                                </button>

                                {/* Net impact line */}
                                {isActive && liveBaseECL > 0 && (
                                  <div style={{
                                    padding: "0.625rem 0.75rem",
                                    background: "#F8FAFC", borderRadius: "0.375rem",
                                    border: "1px solid #E2E8F0",
                                    fontSize: "0.75rem", color: "#475569",
                                    display: "flex", gap: "0.75rem", flexWrap: "wrap",
                                  }}>
                                    {remImpact > 0 && (
                                      <span>
                                        Remarketing{" "}
                                        <span style={{ fontWeight: 700, color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                                          +${remImpact.toFixed(1)}M
                                        </span>
                                      </span>
                                    )}
                                    {remImpact > 0 && vintImpact > 0 && <span style={{ color: "#CBD5E1" }}>·</span>}
                                    {vintImpact > 0 && (
                                      <span>
                                        Vintage{" "}
                                        <span style={{ fontWeight: 700, color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                                          +${vintImpact.toFixed(1)}M
                                        </span>
                                      </span>
                                    )}
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span>
                                      Total uplift{" "}
                                      <span style={{ fontWeight: 700, color: totalUplift > 0 ? "#B91C1C" : "#94A3B8", fontVariantNumeric: "tabular-nums" }}>
                                        +${totalUplift.toFixed(1)}M
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

                  {/* ── Security Deposits & Maintenance Reserves — collapsible ── */}
                  {(() => {
                    const covPct   = formInputs.depositCoverage;
                    const mrPct    = formInputs.maintenanceReserveCoverage;
                    const isActive = covPct !== 0 || mrPct !== 0;
                    const depositBenefit = covPct * 0.50 * liveBaseECL;
                    const mrBenefit      = mrPct  * 0.35 * liveBaseECL;
                    const totalBenefit   = depositBenefit + mrBenefit;

                    return (
                      <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                        {/* Section header */}
                        <button
                          onClick={() => setDepositOpen((o) => !o)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.875rem",
                            background: depositOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                            border: "none", cursor: "pointer",
                            borderBottom: depositOpen ? "1px solid #E2E8F0" : "none",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Security Deposits &amp; Maint. Reserves
                            </span>
                            {isActive ? (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                −${totalBenefit.toFixed(1)}M benefit
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>None (no mitigation benefit)</span>
                            )}
                          </div>
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: depositOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
                          >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {/* Collapsible body */}
                        <AnimatePresence initial={false}>
                          {depositOpen && (
                            <motion.div
                              key="deposit-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0.875rem" }}>
                                {/* Deposit Coverage slider */}
                                <SliderRow
                                  label="Deposit Coverage"
                                  min={0} max={0.30} step={0.005}
                                  value={covPct}
                                  onChange={(v) => updateFormInputs({ depositCoverage: v })}
                                  fmt={(v) => `${(v * 100).toFixed(1)}% of ECL`}
                                />

                                {/* Maintenance Reserve slider */}
                                <SliderRow
                                  label="Maint. Reserve Coverage"
                                  min={0} max={0.30} step={0.005}
                                  value={mrPct}
                                  onChange={(v) => updateFormInputs({ maintenanceReserveCoverage: v })}
                                  fmt={(v) => `${(v * 100).toFixed(1)}% of ECL`}
                                />
                                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginBottom: "0.75rem", marginTop: "-0.25rem" }}>
                                  Earmarked for redelivery condition. 0.35× recovery factor (vs 0.50× for cash deposits).
                                </div>

                                {/* "From portfolio" button */}
                                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <button
                                    onClick={() => updateFormInputs({ depositCoverage: portfolioDepositCoverage })}
                                    style={{
                                      fontSize: "0.75rem", fontWeight: 600,
                                      padding: "0.25rem 0.625rem",
                                      background: "rgba(0,33,71,0.06)", color: "#002147",
                                      border: "1px solid rgba(0,33,71,0.15)", borderRadius: "0.25rem",
                                      cursor: "pointer",
                                    }}
                                    title="Computed from your portfolio's lessee credit tier mix, weighted by monthly rental and ECL baseline."
                                  >
                                    From portfolio
                                  </button>
                                  <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
                                    {(portfolioDepositCoverage * 100).toFixed(1)}% ({portfolioDepositMix.totalDepositM > 0 ? `$${portfolioDepositMix.totalDepositM.toFixed(2)}M deposits` : "no deposits"})
                                  </span>
                                </div>

                                {/* Net impact */}
                                {isActive && liveBaseECL > 0 && (
                                  <div style={{
                                    marginTop: "0.875rem", padding: "0.625rem 0.75rem",
                                    background: "#F0FDF4", borderRadius: "0.375rem",
                                    border: "1px solid #BBF7D0",
                                    fontSize: "0.75rem", color: "#475569",
                                    display: "flex", gap: "0.75rem", flexWrap: "wrap",
                                  }}>
                                    {covPct > 0 && (
                                      <span>
                                        Deposits{" "}
                                        <span style={{ fontWeight: 700, color: "#15803D", fontVariantNumeric: "tabular-nums" }}>
                                          −${depositBenefit.toFixed(1)}M
                                        </span>
                                      </span>
                                    )}
                                    {covPct > 0 && mrPct > 0 && <span style={{ color: "#CBD5E1" }}>·</span>}
                                    {mrPct > 0 && (
                                      <span>
                                        Maint. Reserves{" "}
                                        <span style={{ fontWeight: 700, color: "#15803D", fontVariantNumeric: "tabular-nums" }}>
                                          −${mrBenefit.toFixed(1)}M
                                        </span>
                                      </span>
                                    )}
                                    <span style={{ color: "#CBD5E1" }}>·</span>
                                    <span>
                                      Total{" "}
                                      <span style={{ fontWeight: 700, color: "#15803D", fontVariantNumeric: "tabular-nums" }}>
                                        −${totalBenefit.toFixed(1)}M
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

                  {/* ── Payment Behaviour — collapsible ── */}
                  {(() => {
                    const coopPct   = formInputs.payBehaviourCoopPct;
                    const advPct    = formInputs.payBehaviourAdvPct;
                    const isActive  = coopPct !== 0 || advPct !== 0;
                    const netDeltaM = (advPct * 0.12 - coopPct * 0.07) * liveBaseECL;

                    return (
                      <div style={{ margin: "1rem 0", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                        {/* Section header */}
                        <button
                          onClick={() => setPayBehaviourOpen((o) => !o)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.625rem 0.875rem",
                            background: payBehaviourOpen ? "rgba(0,33,71,0.03)" : "#FAFAFA",
                            border: "none", cursor: "pointer",
                            borderBottom: payBehaviourOpen ? "1px solid #E2E8F0" : "none",
                            transition: "background 150ms",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Payment Behaviour
                            </span>
                            {isActive ? (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "#002147", color: "#FFFFFF" }}>
                                {(coopPct * 100).toFixed(0)}% Coop / {(advPct * 100).toFixed(0)}% Adv
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.6875rem", color: "#CBD5E1" }}>None (neutral baseline)</span>
                            )}
                          </div>
                          <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: payBehaviourOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)", color: "#94A3B8" }}
                          >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {/* Collapsible body */}
                        <AnimatePresence initial={false}>
                          {payBehaviourOpen && (
                            <motion.div
                              key="paybehaviour-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "0.875rem" }}>
                                {/* Cooperative slider */}
                                <SliderRow
                                  label="Cooperative %"
                                  min={0} max={1} step={0.01}
                                  value={coopPct}
                                  onChange={(v) => updateFormInputs({ payBehaviourCoopPct: Math.min(v, Math.max(0, 1 - advPct)) })}
                                  fmt={(v) => `${(v * 100).toFixed(0)}% of fleet`}
                                />

                                {/* Adversarial slider */}
                                <div style={{ marginTop: "0.5rem" }}>
                                  <SliderRow
                                    label="Adversarial %"
                                    min={0} max={1} step={0.01}
                                    value={advPct}
                                    onChange={(v) => updateFormInputs({ payBehaviourAdvPct: Math.min(v, Math.max(0, 1 - coopPct)) })}
                                    fmt={(v) => `${(v * 100).toFixed(0)}% of fleet`}
                                  />
                                </div>

                                {/* "From portfolio" button */}
                                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <button
                                    onClick={() => updateFormInputs({
                                      payBehaviourCoopPct: portfolioPayBehaviourMix.coopPct,
                                      payBehaviourAdvPct:  portfolioPayBehaviourMix.advPct,
                                    })}
                                    style={{
                                      fontSize: "0.75rem", fontWeight: 600,
                                      padding: "0.25rem 0.625rem",
                                      background: "rgba(0,33,71,0.06)", color: "#002147",
                                      border: "1px solid rgba(0,33,71,0.15)", borderRadius: "0.25rem",
                                      cursor: "pointer",
                                    }}
                                    title="Computed from your portfolio's lessee countries, weighted by monthly rental."
                                  >
                                    From portfolio
                                  </button>
                                  <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
                                    {(portfolioPayBehaviourMix.coopPct * 100).toFixed(0)}% Coop / {(portfolioPayBehaviourMix.advPct * 100).toFixed(0)}% Adv
                                  </span>
                                </div>

                                {/* Net impact */}
                                <div style={{
                                  marginTop: "0.875rem", fontSize: "0.8125rem",
                                  color: !isActive ? "#94A3B8" : netDeltaM < 0 ? "#15803D" : "#B91C1C",
                                  fontVariantNumeric: "tabular-nums",
                                }}>
                                  Behaviour Adjustment{" "}
                                  <span style={{ fontWeight: 700 }}>
                                    {!isActive
                                      ? "$0"
                                      : netDeltaM >= 0
                                        ? `+$${netDeltaM.toFixed(1)}M`
                                        : `−$${Math.abs(netDeltaM).toFixed(1)}M`}
                                  </span>
                                  {isActive && (
                                    <>
                                      <span style={{ color: "#CBD5E1", margin: "0 0.5rem" }}>·</span>
                                      <span style={{ color: "#64748B" }}>
                                        {(coopPct * 100).toFixed(0)}% Coop / {(advPct * 100).toFixed(0)}% Adv
                                      </span>
                                    </>
                                  )}
                                </div>
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
                    {computeECLFromBase(liveBaseECL, formInputs) <= liveBaseECL * 0.3 + 0.001 && (
                      <div style={{ marginTop: "0.375rem", fontSize: "0.6875rem", color: "#B45309", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <span>⚠</span>
                        <span>30% IFRS 9 ECL floor active — scenario inputs imply greater reduction than model permits</span>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => {
                        setFormInputs(ZERO_INPUTS);
                        setDslText(generateDSL(ZERO_INPUTS, customName, customMode, customPaths, customSeed));
                        setDistressOpen(false);
                        setInsolvencyOpen(false);
                        setJurisdictionOpen(false);
                        setDepositOpen(false);
                        setPayBehaviourOpen(false);
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
                    <>
                      <RunResultPanel
                        run={findRun(customResultId)!}
                        onClose={() => setCustomResultId(null)}
                        narrative={getNarrative(customResultId)}
                        onRequestNarrative={onRequestNarrative}
                      />
                      <ScenarioInsightsPanel run={findRun(customResultId)!} baseECL={BASE_ECL} />
                    </>
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
  );
}

// Public memoised export — see comment above CustomBuilderTabImpl.
export const CustomBuilderTab = React.memo(CustomBuilderTabImpl);
