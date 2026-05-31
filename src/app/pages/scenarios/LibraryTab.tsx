// ─────────────────────────────────────────────────────────────────────────────
// scenarios/LibraryTab.tsx
//
// Library tab content: the IFRS 9 probability-weighted ECL banner plus the
// three categorical sections (Macro / Distress / Insolvency) of template
// scenario cards. Each card cycles through idle → config → running → done
// phases via the shell-owned cardStates map.
//
// All state, callbacks, and persistence live in the Scenarios shell; this
// component is a pure renderer. The clone-into-Custom-Builder handler routes
// back to the shell via setClonePending.
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from "framer-motion";
import { Play, RefreshCw, Download, Clock, X, Layers } from "lucide-react";
import {
  RunResultPanel,
  type ScenarioRunResult,
} from "../../components/scenarios/RunResultPanel";
import { ScenarioInsightsPanel } from "../../components/scenarios/ScenarioInsightsPanel";
import { BASE_ECL, computeECLFromBase, type ScenarioInputs } from "../../utils/eclCalculator";
import ModeToggle from "./ModeToggle";
import {
  BTN_PRIMARY,
  BTN_OUTLINE,
  type CardState,
  type RunMode,
  type Template,
} from "./_shared";

export interface LibraryTabProps {
  weightedECL: number | null;
  effectiveTemplates: Template[];
  cardStates: Record<string, CardState>;
  setCardPhase: (id: string, updates: Partial<CardState>) => void;
  setClonePending: (p: { inputs: ScenarioInputs; name: string; mode: RunMode; paths: number }) => void;
  handleTemplateRun: (tpl: Template) => void;
  findRun: (id: string) => ScenarioRunResult | undefined;
  liveBaseECL: number;
  getNarrative: (runId: string) => string | null | "loading";
  onRequestNarrative: (run: ScenarioRunResult) => Promise<void>;
}

export function LibraryTab({
  weightedECL,
  effectiveTemplates,
  cardStates,
  setCardPhase,
  setClonePending,
  handleTemplateRun,
  findRun,
  liveBaseECL,
  getNarrative,
  onRequestNarrative,
}: LibraryTabProps) {
  return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", alignItems: "start" }}>
          {/* ── IFRS 9 Probability-Weighted ECL banner ── */}
          {weightedECL !== null && (
            <div style={{ gridColumn: "1 / -1", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "0.5rem", padding: "0.875rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <div>
                <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.05em" }}>IFRS 9 Probability-Weighted ECL</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1E40AF", fontVariantNumeric: "tabular-nums", marginTop: "0.125rem" }}>
                  ${weightedECL.toFixed(1)}M
                </div>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#3B82F6", maxWidth: "28rem", lineHeight: 1.5, textAlign: "right" }}>
                Weighted average across 6 probability-weighted macro scenarios (IFRS 9 §5.5.17a). Weights: Baseline 60%, COVID-Mild 15%, COVID-Severe 10%, Fuel Spike 7%, Sovereign Stress 5%, Currency Collapse 3%.
              </div>
            </div>
          )}
          {/* ── Macro Scenarios label ── */}
          <div style={{ gridColumn: "1 / -1", fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "0.25rem", borderBottom: "1px solid #F1F5F9" }}>
            Macro Scenarios
          </div>
          {effectiveTemplates.filter((t) => t.category === "macro").map((tpl, tplIdx) => {
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
                      ECL ${computeECLFromBase(liveBaseECL, tpl.inputs).toFixed(1)}M
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
                          onRequestNarrative={onRequestNarrative}
                        />
                        <ScenarioInsightsPanel run={result} baseECL={BASE_ECL} compact />
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
          {effectiveTemplates.filter((t) => t.category === "distress").map((tpl, tplIdx) => {
            const cs = cardStates[tpl.id];
            const result = cs.resultId ? findRun(cs.resultId) : null;

            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: (tplIdx + effectiveTemplates.filter(t => t.category !== "distress").length) * 0.06, ease: [0.23, 1, 0.32, 1] }}
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
                      ECL ${computeECLFromBase(liveBaseECL, tpl.inputs).toFixed(1)}M
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
                          onRequestNarrative={onRequestNarrative}
                        />
                        <ScenarioInsightsPanel run={result} baseECL={BASE_ECL} compact />
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
          {effectiveTemplates.filter((t) => t.category === "insolvency").map((tpl, tplIdx) => {
            const delayIdx = tplIdx + effectiveTemplates.filter(t => t.category !== "insolvency").length;
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
                      ECL ${computeECLFromBase(liveBaseECL, tpl.inputs).toFixed(1)}M
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
                          onRequestNarrative={onRequestNarrative}
                        />
                        <ScenarioInsightsPanel run={result} baseECL={BASE_ECL} compact />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
  );
}
