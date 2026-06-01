// ─────────────────────────────────────────────────────────────────────────────
// scenarios/RunHistoryTab.tsx
//
// Run History tab content: the immutable audit table of every scenario run
// plus the side-by-side comparison panel when two runs are selected.
//
// All state, callbacks, and persistence live in the Scenarios shell; this
// component is a pure renderer over the props it receives. Tiny local UI
// state (expand toggle, compare selection) stays in the shell so re-runs and
// route changes don't blow it away.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { ChevronDown, ChevronUp, Download, Copy, GitBranch } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { StatusPill } from "../../components/ui/StatusPill";
import {
  RunResultPanel,
  type ScenarioRunResult,
} from "../../components/scenarios/RunResultPanel";
import { ScenarioInsightsPanel } from "../../components/scenarios/ScenarioInsightsPanel";
import { exportScenarioRunPDF } from "../../utils/scenarioExport";
import { BASE_ECL, type ScenarioInputs } from "../../utils/eclCalculator";
import { BTN_OUTLINE, type RunMode } from "./_shared";

export interface RunHistoryTabProps {
  runs: ScenarioRunResult[];
  compareIds: string[];
  toggleCompare: (id: string) => void;
  expandedRunId: string | null;
  setExpandedRunId: (id: string | null) => void;
  setCompareIds: (ids: string[]) => void;
  setClonePending: (p: { inputs: ScenarioInputs; name: string; mode: RunMode; paths: number }) => void;
  setBranchFromId: (id: string | null) => void;
  getRunInputs: (run: ScenarioRunResult) => ScenarioInputs;
  getNarrative: (runId: string) => string | null | "loading";
  onRequestNarrative: (run: ScenarioRunResult) => Promise<void>;
}

// Internal impl. Wrapped in React.memo at the bottom — see siblings.
function RunHistoryTabImpl({
  runs,
  compareIds,
  toggleCompare,
  expandedRunId,
  setExpandedRunId,
  setCompareIds,
  setClonePending,
  setBranchFromId,
  getRunInputs,
  getNarrative,
  onRequestNarrative,
}: RunHistoryTabProps) {
  return (
    <>
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
                {["expand", "Compare", "Run ID", "Scenario", "Mode", "Paths", "Run Date", "Portfolio ECL", "Duration", "Status", "actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600,
                      color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase",
                      letterSpacing: "0.05em", whiteSpace: "nowrap",
                    }}
                  >
                    {h === "expand" || h === "actions" || h === "Compare" ? (h === "Compare" ? (
                      <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
                        Compare{compareIds.length > 0 ? ` (${compareIds.length}/2)` : ""}
                      </span>
                    ) : "") : h}
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
                      {/* Compare checkbox */}
                      <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={compareIds.includes(run.id)}
                          onChange={() => toggleCompare(run.id)}
                          style={{ cursor: "pointer", accentColor: "#002147" }}
                          title="Select for comparison"
                        />
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
                          <button
                            title="Export run as PDF"
                            onClick={() => exportScenarioRunPDF(run)}
                            style={{ ...BTN_OUTLINE, fontSize: "0.75rem", padding: "0.25rem 0.4rem" }}
                          >
                            <Download size={10} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded result row */}
                    {isExpanded && (
                      <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td />
                        <td colSpan={10} style={{ padding: "0 1rem 1rem" }}>
                          <RunResultPanel
                            run={run}
                            narrative={getNarrative(run.id)}
                            onRequestNarrative={onRequestNarrative}
                          />
                          <ScenarioInsightsPanel run={run} baseECL={BASE_ECL} />
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

      {/* ── Run Comparison Panel ── */}
      {compareIds.length === 2 && (() => {
        const [runA, runB] = compareIds.map((id) => runs.find((r) => r.id === id)!).filter(Boolean);
        if (!runA || !runB) return null;
        const rows: Array<{ label: string; a: string; b: string; highlight?: "a" | "b" | "neither" }> = [
          { label: "Scenario", a: runA.name, b: runB.name },
          { label: "Run Date", a: runA.runDate, b: runB.runDate },
          { label: "Mode", a: runA.mode === "deterministic" ? "Deterministic" : "Monte Carlo", b: runB.mode === "deterministic" ? "Deterministic" : "Monte Carlo" },
          { label: "Portfolio ECL", a: `$${runA.ecl.toFixed(1)}M`, b: `$${runB.ecl.toFixed(1)}M`, highlight: runA.ecl < runB.ecl ? "a" : runA.ecl > runB.ecl ? "b" : "neither" },
          { label: "ECL Delta A→B", a: "", b: `${runB.ecl >= runA.ecl ? "+" : ""}$${(runB.ecl - runA.ecl).toFixed(1)}M (${runB.ecl >= runA.ecl ? "+" : ""}${(((runB.ecl - runA.ecl) / runA.ecl) * 100).toFixed(0)}%)` },
          { label: "P5 (MC only)", a: runA.p5 != null ? `$${runA.p5.toFixed(1)}M` : "—", b: runB.p5 != null ? `$${runB.p5.toFixed(1)}M` : "—" },
          { label: "P95 (MC only)", a: runA.p95 != null ? `$${runA.p95.toFixed(1)}M` : "—", b: runB.p95 != null ? `$${runB.p95.toFixed(1)}M` : "—" },
          { label: "Stage 1 ($M)", a: `$${runA.s1.toFixed(1)}M`, b: `$${runB.s1.toFixed(1)}M` },
          { label: "Stage 2 ($M)", a: `$${runA.s2.toFixed(1)}M`, b: `$${runB.s2.toFixed(1)}M` },
          { label: "Stage 3 ($M)", a: `$${runA.s3.toFixed(1)}M`, b: `$${runB.s3.toFixed(1)}M`, highlight: runA.s3 < runB.s3 ? "a" : runA.s3 > runB.s3 ? "b" : "neither" },
          { label: "Seed", a: String(runA.seed), b: String(runB.seed) },
        ];
        return (
          <Card title="Run Comparison" subtitle="Side-by-side diff of two selected runs">
            <div style={{ padding: "0 1.25rem 1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ background: "#EFF6FF", borderRadius: "0.375rem", padding: "0.625rem 0.875rem" }}>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Run A</div>
                  <div style={{ fontWeight: 600, color: "#0F172A" }}>{runA.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B", fontFamily: "monospace" }}>{runA.id}</div>
                </div>
                <div style={{ background: "#F5F3FF", borderRadius: "0.375rem", padding: "0.625rem 0.875rem" }}>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.04em" }}>Run B</div>
                  <div style={{ fontWeight: 600, color: "#0F172A" }}>{runB.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B", fontFamily: "monospace" }}>{runB.id}</div>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
                    <th style={{ textAlign: "left", padding: "0.4rem 0.75rem", color: "#64748B", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Field</th>
                    <th style={{ textAlign: "left", padding: "0.4rem 0.75rem", color: "#1D4ED8", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Run A</th>
                    <th style={{ textAlign: "left", padding: "0.4rem 0.75rem", color: "#7C3AED", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Run B</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.label} style={{ borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none", background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#64748B", fontWeight: 500 }}>{r.label}</td>
                      <td style={{ padding: "0.5rem 0.75rem", fontWeight: r.highlight === "a" ? 700 : 400, color: r.highlight === "a" ? "#15803D" : "#0F172A", fontVariantNumeric: "tabular-nums" }}>{r.a}</td>
                      <td style={{ padding: "0.5rem 0.75rem", fontWeight: r.highlight === "b" ? 700 : 400, color: r.highlight === "b" ? "#B91C1C" : "#0F172A", fontVariantNumeric: "tabular-nums" }}>{r.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: "0.875rem", textAlign: "right" }}>
                <button onClick={() => setCompareIds([])} style={{ ...BTN_OUTLINE, fontSize: "0.75rem" }}>
                  Clear Comparison
                </button>
              </div>
            </div>
          </Card>
        );
      })()}
    </>
  );
}

// Public memoised export — see comment above RunHistoryTabImpl.
export const RunHistoryTab = React.memo(RunHistoryTabImpl);
