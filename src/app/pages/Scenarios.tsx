import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router";
import { useTabSync } from "../hooks/useTabSync";
import { useViewMode } from "../contexts/ViewModeContext";
import { useAgent } from "../contexts/AgentContext";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { InsolvencyTab } from "../components/scenarios/InsolvencyTab";
import { LeasePricingTab } from "../components/scenarios/LeasePricingTab";
import { JurisdictionRiskTab } from "../components/scenarios/JurisdictionRiskTab";
import { AssetRiskTab } from "../components/scenarios/AssetRiskTab";
import { RatingPDTab } from "../components/scenarios/RatingPDTab";
import { computePortfolioJurisdictionMix } from "../utils/jurisdictionRisk";
import { useJurisdictions } from "../hooks/useJurisdictions";
import { computePortfolioAssetRisk } from "../utils/assetRisk";
import { DEFAULT_RECOVERY_FACTOR } from "../data/lgdCurves";
import { CreditDepositTab } from "../components/scenarios/CreditDepositTab";
import { computePortfolioDepositCoverage } from "../utils/creditDeposit";
import { PaymentBehaviourTab } from "../components/scenarios/PaymentBehaviourTab";
import { computePortfolioPaymentBehaviourMix } from "../utils/paymentBehaviour";
import { exportScenarioRunPDF } from "../utils/scenarioExport";
import { DeferralRiskTab } from "../components/scenarios/DeferralRiskTab";
import { RESTRUCTURING_TYPES } from "../utils/deferralRisk";
import { LessorMitigationTab } from "../components/scenarios/LessorMitigationTab";
import { ConcentrationStressTab } from "../components/scenarios/ConcentrationStressTab";
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
import { ScenarioInsightsPanel } from "../components/scenarios/ScenarioInsightsPanel";
import { generateNarrative } from "../services/narrativeService";
import { runScenario as runScenarioEngine } from "../services/scenarioEngine";
import { SCENARIO_CALIBRATION } from "../data/intelligenceData";
import { useStressScenarios } from "../hooks/useStressScenarios";
import { useScenarioRuns } from "../hooks/useScenarioRuns";
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
import {
  PATH_TAB,
  STAGE3_LESSEES,
  TEMPLATES,
  INITIAL_RUNS,
  type Template,
  type RunMode,
  type CardState,
  seededRand,
  computeMCRange,
  hashFromSeed,
  computeTopLessees,
  computeS3LeaseCount,
  nextRunId,
  buildRun,
  generateDSL,
  parseDSL,
  BTN_PRIMARY,
  BTN_OUTLINE,
  EXEC_SCENARIO_TABS,
  REGIME_DESCRIPTIONS,
  REGIME_SHORT_NAMES,
} from "./scenarios/_shared";
import SliderRow from "./scenarios/SliderRow";
import ModeToggle from "./scenarios/ModeToggle";
import { RunHistoryTab } from "./scenarios/RunHistoryTab";
import { LibraryTab } from "./scenarios/LibraryTab";
import { CustomBuilderTab } from "./scenarios/CustomBuilderTab";


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Scenarios() {
  const { pathname, state: locationState } = useLocation();
  const navigate = useNavigate();
  const { isExecutiveMode } = useViewMode();
  const { pendingInputs, setPendingInputs } = useAgent();
  const [activeTab, setActiveTab] = useState(() => PATH_TAB[pathname] ?? "Library");
  useEffect(() => {
    // Gate: when the user navigates AWAY from /scenarios/* (Layout keeps us
    // mounted but hidden via display:none), don't react to the pathname
    // change. Without this gate, every cross-page navigation triggered a
    // setActiveTab call here which, even when the new value matched the
    // old, ran the entire Scenarios function body again. With React.memo on
    // the heavy sub-tab children that's still cheap on paper, but in
    // browsers running React DevTools or other profiling extensions the
    // wrapper instrumentation makes even a "noop" re-render measurable —
    // exactly the discrepancy between the freeze users report and the
    // clean Chrome instance MCP measures.
    if (!pathname.startsWith("/scenarios")) return;
    setActiveTab(PATH_TAB[pathname] ?? "Library");
  }, [pathname]);
  const handleTabChange = useTabSync(PATH_TAB, setActiveTab);

  // Track which of the three URL-mapped heavy sub-tabs the user has visited
  // during this Scenarios session. Each tab mounts ONCE on first visit and
  // then stays alive (display: none) so sub-tab switching is instant. The
  // crucial property vs. the previous "always-mount-all-three" pattern is
  // that leaving Scenarios only unmounts what the user actually opened —
  // mass-unmounting Library (766 lines) + CustomBuilder (1570 lines) +
  // RunHistory (285 lines) in one tick was choking the next page's mount.
  const [visitedSubTabs, setVisitedSubTabs] = useState<Set<string>>(
    () => new Set([PATH_TAB[pathname] ?? "Library"]),
  );
  useEffect(() => {
    setVisitedSubTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);
  useEffect(() => {
    if (isExecutiveMode && !EXEC_SCENARIO_TABS.includes(activeTab)) {
      setActiveTab("Library");
    }
  }, [isExecutiveMode, activeTab]);
  // ── T-3.1 — runs persist to scenario_runs (Supabase) ─────────────────────
  // Hook owns the list. INITIAL_RUNS only show until the first DB run is
  // persisted (demo continuity for first-load empty state). After that,
  // hasIngested flips and we surface DB rows only — no more mock seed.
  const { runs: dbRuns, insertRun: persistRun, hasIngested: hasPersistedRuns } = useScenarioRuns();

  // Ephemeral, in-memory runs. We push every freshly-computed result here so
  // the result panel can render even when the Supabase insert fails (e.g.
  // on the sample portfolio where portfolio_id="global-sample" is not a
  // valid UUID, or in any case where RLS / network blocks persistence).
  // The dbRuns are still the source of truth for the Run History tab.
  const [ephemeralRuns, setEphemeralRuns] = useState<ScenarioRunResult[]>([]);
  const addEphemeralRun = useCallback((r: ScenarioRunResult) => {
    setEphemeralRuns((prev) => {
      // Dedupe: if a row with the same id already exists (e.g. from a later
      // dbRuns refetch surfacing the same persisted row), drop the ephemeral.
      if (prev.some((p) => p.id === r.id)) return prev;
      return [r, ...prev];
    });
  }, []);

  const runs = useMemo<ScenarioRunResult[]>(
    () => {
      const persisted = hasPersistedRuns ? dbRuns : INITIAL_RUNS;
      // De-dupe ephemeralRuns against persisted by id, then prepend them
      // (newest first).
      const persistedIds = new Set(persisted.map((r) => r.id));
      const eph = ephemeralRuns.filter((r) => !persistedIds.has(r.id));
      return [...eph, ...persisted];
    },
    [hasPersistedRuns, dbRuns, ephemeralRuns]
  );

  // ── T-1.7 consumer wire — merge DB-imported scenarios with hardcoded ────
  // When the tenant uploaded a workbook with stress scenarios, they appear
  // alongside the built-in library. Distress + insolvency categories stay
  // hardcoded (no DB source yet); DB scenarios all live under the "macro"
  // category. Synthesised IDs (DB-{slug}) never collide with TPL-* ids that
  // INITIAL_RUNS references at module scope.
  const { templates: dbTemplates } = useStressScenarios();
  const effectiveTemplates = useMemo<Template[]>(
    () => [...TEMPLATES, ...(dbTemplates as Template[])],
    [dbTemplates],
  );
  // Map for O(1) byId-style lookups during runs that may reference DB ids.
  const templateById = useMemo(() => {
    const m = new Map<string, Template>();
    for (const t of effectiveTemplates) m.set(t.id, t);
    return m;
  }, [effectiveTemplates]);

  // ── Library card state machine ──
  const [cardStates, setCardStates] = useState<Record<string, CardState>>(
    Object.fromEntries(TEMPLATES.map((t) => [t.id, { phase: "idle", mode: "deterministic", paths: 10000 }]))
  );
  // Add card states for any newly-loaded DB scenarios. Idempotent.
  useEffect(() => {
    setCardStates((prev) => {
      const next = { ...prev };
      for (const t of effectiveTemplates) {
        if (!next[t.id]) next[t.id] = { phase: "idle", mode: "deterministic", paths: 10000 };
      }
      return next;
    });
  }, [effectiveTemplates]);

  const setCardPhase = useCallback((id: string, updates: Partial<CardState>) => {
    setCardStates((prev) => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  }, []);

  // ── Live portfolio data (hoisted) ──
  // These declarations must precede `handleTemplateRun` because its
  // useCallback dependency array references liveBaseECL + liveStage3Lessees.
  // React reads the deps array on every render, so a TDZ violation here
  // breaks the whole page in production builds (where minification surfaces
  // the const-before-init error as "Cannot access 'X' before initialization").
  const { assets, lessees, leases, provisions, isDemo } = usePortfolioData();
  const { jurisdictions: ingestedJurisdictions } = useJurisdictions();
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

  const handleTemplateRun = useCallback((tpl: Template) => {
    const cs = cardStates[tpl.id];
    const seed = Math.floor(Math.random() * 9999) + 1;
    setCardPhase(tpl.id, { phase: "running" });

    const duration = cs.mode === "deterministic" ? 1800 : 3200;
    setTimeout(async () => {
      const computedECL = computeECLFromBase(liveBaseECL, tpl.inputs);
      const { p5: _p5, p95: _p95 } = computeMCRange(computedECL, seed);
      void _p5; void _p95; // captured below in the result blob
      const stages = computeStages(computedECL, tpl.inputs);
      const runCode = nextRunId();
      const durationSec = cs.mode === "deterministic"
        ? `${(1.4 + seededRand(seed, 9) * 1.4).toFixed(1)}s`
        : `${Math.round(28 + seededRand(seed, 11) * 20)}s`;
      const resultBlob = {
        durationSec,
        ecl:          computedECL,
        p5:           cs.mode === "montecarlo" ? computedECL * tpl.p5Factor : null,
        p95:          cs.mode === "montecarlo" ? computedECL * tpl.p95Factor : null,
        s1: stages.s1, s2: stages.s2, s3: stages.s3,
        shapley:      tpl.shapley,
        keyFinding:   tpl.keyFinding,
        scenarioHash: hashFromSeed(seed).slice(0, 12),
        topLessees:   computeTopLessees(stages.s3, seed, liveStage3Lessees ?? STAGE3_LESSEES),
        s3LeaseCount: computeS3LeaseCount(stages.s3),
      };
      const inserted = await persistRun({
        runCode,
        scenarioId: tpl.id,
        name:       tpl.name,
        mode:       cs.mode,
        paths:      cs.mode === "montecarlo" ? cs.paths : null,
        seed,
        inputs:     tpl.inputs,
        result:     resultBlob,
        parentRunCode: null,
      });

      // Always materialise the result so the panel can render even when the
      // DB persist failed (sample portfolio, RLS, network). The ephemeral
      // row uses runCode as its id and is dedupe-merged against dbRuns.
      const resultId = inserted?.id ?? runCode;
      if (!inserted) {
        addEphemeralRun({
          id:           resultId,
          templateId:   tpl.id,
          name:         tpl.name,
          mode:         cs.mode,
          paths:        cs.mode === "montecarlo" ? cs.paths : null,
          seed,
          runDate:      new Date().toISOString(),
          durationSec,
          ecl:          resultBlob.ecl,
          p5:           resultBlob.p5,
          p95:          resultBlob.p95,
          s1:           resultBlob.s1,
          s2:           resultBlob.s2,
          s3:           resultBlob.s3,
          shapley:      resultBlob.shapley,
          keyFinding:   resultBlob.keyFinding,
          scenarioHash: resultBlob.scenarioHash,
          topLessees:   resultBlob.topLessees,
          s3LeaseCount: resultBlob.s3LeaseCount,
        });
      }
      setCardPhase(tpl.id, { phase: "done", resultId });
    }, duration);
  }, [cardStates, setCardPhase, persistRun, addEphemeralRun, liveBaseECL, liveStage3Lessees]);

  // ── Custom Builder state ──
  const [prefillSource, setPrefillSource] = useState<string | null>(null);
  const [calBannerDismissed, setCalBannerDismissed] = useState(false);
  const [customName, setCustomName] = useState("My Custom Scenario");
  const [formInputs, setFormInputs] = useState<ScenarioInputs>(() => {
    try {
      const s = localStorage.getItem("aero_custom_inputs");
      if (s) return { ...ZERO_INPUTS, ...JSON.parse(s) } as ScenarioInputs;
    } catch { /* ignore corrupt storage */ }
    return ZERO_INPUTS;
  });
  const formInputsRef = useRef<ScenarioInputs>(ZERO_INPUTS);
  formInputsRef.current = formInputs;

  // ── Persistence: save custom inputs whenever they change ──
  useEffect(() => {
    try { localStorage.setItem("aero_custom_inputs", JSON.stringify(formInputs)); } catch { /* quota */ }
  }, [formInputs]);

  // ── Run history persistence handled by useScenarioRuns hook ─────────────

  const [customMode, setCustomMode] = useState<RunMode>("deterministic");
  const [customPaths, setCustomPaths] = useState(10000);
  const [customSeed] = useState(42);
  const [editorMode, setEditorMode] = useState<"form" | "dsl">("form");
  const [distressOpen, setDistressOpen] = useState(false);
  const [insolvencyOpen, setInsolvencyOpen] = useState(false);
  const [jurisdictionOpen, setJurisdictionOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [payBehaviourOpen, setPayBehaviourOpen] = useState(false);
  const [assetRiskOpen, setAssetRiskOpen] = useState(false);

  const [dslText, setDslText] = useState(() => generateDSL(ZERO_INPUTS, "My Custom Scenario", "deterministic", 10000, 42));
  const [dslErrors, setDslErrors] = useState<string[]>([]);
  const [customRunning, setCustomRunning] = useState(false);
  const [customResultId, setCustomResultId] = useState<string | null>(null);
  const customResultRef = useRef<HTMLDivElement>(null);

  // ── Probability-weighted ECL (IFRS 9 §5.5.17a) ──
  // Only templates with numeric weights contribute. Weight strings like "60%" are parsed to 0.60.
  const weightedECL = React.useMemo(() => {
    let sumW = 0; let sumWE = 0;
    for (const tpl of effectiveTemplates) {
      if (tpl.weight === "—") continue;
      const w = parseFloat(tpl.weight) / 100;
      if (isNaN(w) || w <= 0) continue;
      sumW += w;
      sumWE += w * computeECLFromBase(liveBaseECL, tpl.inputs);
    }
    return sumW > 0 ? sumWE / sumW : null;
  }, [liveBaseECL, effectiveTemplates]);

  // Rental-weighted CTC tier mix — used by JurisdictionRiskTab "Use in Custom Builder"
  // handler and the "From portfolio" button in the Custom Builder Jurisdiction Risk section.
  const portfolioJurisdictionMix = React.useMemo(
    () => computePortfolioJurisdictionMix(lessees, leases, ingestedJurisdictions),
    [lessees, leases, ingestedJurisdictions]
  );

  // Rental-weighted asset risk metrics — used by AssetRiskTab "Use in Custom Builder"
  // handler and the "From portfolio" button in the Custom Builder Asset Risk section.
  const portfolioAssetRisk = React.useMemo(
    () => computePortfolioAssetRisk(assets, leases, DEFAULT_RECOVERY_FACTOR),
    [assets, leases]
  );

  // Deposit coverage from portfolio credit tiers
  const portfolioDepositMix = React.useMemo(
    () => computePortfolioDepositCoverage(lessees, leases),
    [lessees, leases]
  );
  const portfolioDepositCoverage = liveBaseECL > 0 ? portfolioDepositMix.totalDepositM / liveBaseECL : 0;

  // Payment behaviour mix from portfolio lessee countries — used by PaymentBehaviourTab "Use in Custom Builder"
  // and the "From portfolio" button in the Custom Builder Payment Behaviour section.
  const portfolioPayBehaviourMix = React.useMemo(
    () => computePortfolioPaymentBehaviourMix(lessees, leases),
    [lessees, leases]
  );

  // ── Clone / Branch state ──
  const [branchFromId, setBranchFromId] = useState<string | null>(null);
  const [clonePending, setClonePending] = useState<{
    inputs: ScenarioInputs; name: string; mode: RunMode; paths: number;
  } | null>(null);

  // Send a partial-inputs payload to the standalone Custom Builder page at
  // /build. Used by:
  //   - Library / Run History "Clone" callbacks (full payload override)
  //   - The 8 calibration sub-tab "Use in Custom Builder" CTAs (partial
  //     merge with current localStorage form state)
  // sessionStorage acts as the bridge — CustomBuilderPage reads it once on
  // mount and clears it.
  const sendToBuilder = useCallback((partial: Partial<ScenarioInputs>) => {
    let baseInputs: ScenarioInputs = ZERO_INPUTS;
    try {
      const stored = localStorage.getItem("aero_custom_inputs");
      if (stored) baseInputs = { ...ZERO_INPUTS, ...JSON.parse(stored) } as ScenarioInputs;
    } catch { /* corrupt storage — fall back to zero */ }
    const merged = { ...baseInputs, ...partial };
    sessionStorage.setItem(
      "aero_clone_pending",
      JSON.stringify({
        inputs: merged,
        name: "My Custom Scenario",
        mode: "deterministic" as RunMode,
        paths: 10000,
      }),
    );
    navigate("/build");
  }, [navigate]);

  // Full-payload clone (Library template / Run History run → Custom Builder)
  const sendCloneToBuilder = useCallback(
    (p: { inputs: ScenarioInputs; name: string; mode: RunMode; paths: number }) => {
      sessionStorage.setItem("aero_clone_pending", JSON.stringify(p));
      navigate("/build");
    },
    [navigate],
  );

  const updateFormInputs = useCallback((partial: Partial<ScenarioInputs>) => {
    const next = { ...formInputsRef.current, ...partial };
    setFormInputs(next);
    setDslText(generateDSL(next, customName, customMode, customPaths, customSeed));
    setDslErrors([]);
    // Auto-expand distress section if any distress lever is non-zero
    const hasDistress =
      next.deferralMonths !== 0 || next.govtSupportProb !== 0 ||
      next.forgivenessRate !== 0 || next.pbhConversionPct !== 0 ||
      next.etpRate !== 0 || next.lecRate !== 0 || next.restructuringType !== null;
    if (hasDistress) setDistressOpen(true);
    if (next.bankruptcyScenarioType !== null) setInsolvencyOpen(true);
    if (next.ctcGoldPct !== 0 || next.nonCtcPct !== 0 || next.repossWeightedMonths !== 0) setJurisdictionOpen(true);
    if (next.remarketingMonths !== 0 || next.lgdDecayAdjFactor !== 0) setAssetRiskOpen(true);
    if (next.depositCoverage !== 0 || next.maintenanceReserveCoverage !== 0) setDepositOpen(true);
    if (next.payBehaviourCoopPct !== 0 || next.payBehaviourAdvPct !== 0) setPayBehaviourOpen(true);
  }, [customName, customMode, customPaths, customSeed, setDistressOpen, setInsolvencyOpen, setJurisdictionOpen, setDepositOpen, setPayBehaviourOpen]);

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

  const handleCustomRun = async () => {
    const parsed = parseDSL(dslText);
    if (!parsed.ok && parsed.errors.some((e) => e.startsWith("Invalid") || e.includes("must be"))) return;
    setCustomRunning(true);
    setCustomResultId(null);
    // Scroll to result area immediately so the skeleton is visible
    setTimeout(() => customResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    const seed = Math.floor(Math.random() * 9999) + 1;
    const minSkeletonMs = 600; // keep a brief skeleton so very-fast runs don't flicker
    const startedAt = performance.now();

    // Route through the scenario engine. Deterministic stays client-side;
    // Monte Carlo hits /api/scenarios/run for real NumPy-vectorised paths.
    const engineResult = await runScenarioEngine({
      inputs:  formInputs,
      mode:    customMode,
      paths:   customPaths,
      seed,
      baseECL: liveBaseECL,
    });

    // buildRun owns the narrative envelope (shapley, top lessees, key findings).
    // We seed it with the engine's ECL so the entire result is consistent.
    const newRun = buildRun(
      customName || "Custom Scenario",
      formInputs,
      customMode,
      customPaths,
      seed,
      null,
      engineResult.ecl,
      liveStage3Lessees ?? STAGE3_LESSEES,
    );

    // Overwrite the placeholder MC bounds with real server-computed values
    // when we actually got them from python-numpy.
    if (customMode === "montecarlo" && engineResult.p5 != null && engineResult.p95 != null) {
      newRun.p5 = engineResult.p5;
      newRun.p95 = engineResult.p95;
    }
    // Stamp the engine used so the UI can show provenance.
    (newRun as ScenarioRunResult & { engine?: string }).engine = engineResult.engine;

    const elapsed = performance.now() - startedAt;
    const remainingSkeletonMs = Math.max(0, minSkeletonMs - elapsed);
    setTimeout(async () => {
      // T-3.1 — persist Custom Builder run to scenario_runs.
      const inserted = await persistRun({
        runCode:       newRun.id,
        scenarioId:    null,
        name:          newRun.name,
        mode:          newRun.mode,
        paths:         newRun.paths,
        seed:          newRun.seed,
        inputs:        formInputs,
        result: {
          durationSec:  newRun.durationSec,
          ecl:          newRun.ecl,
          p5:           newRun.p5,
          p95:          newRun.p95,
          s1:           newRun.s1,
          s2:           newRun.s2,
          s3:           newRun.s3,
          shapley:      newRun.shapley,
          keyFinding:   newRun.keyFinding,
          scenarioHash: newRun.scenarioHash,
          topLessees:   newRun.topLessees,
          s3LeaseCount: newRun.s3LeaseCount,
          engine:       (newRun as ScenarioRunResult & { engine?: string }).engine,
        },
        parentRunCode: branchFromId,
      });
      const resultId = inserted?.id ?? newRun.id;
      // Always materialise the run locally so the result card renders even
      // when persistence failed (sample portfolio / RLS / network).
      if (!inserted) addEphemeralRun(newRun);
      setCustomResultId(resultId);
      setCustomRunning(false);
      setBranchFromId(null);
    }, remainingSkeletonMs);
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
    if (clonePending.inputs.ctcGoldPct !== 0 || clonePending.inputs.nonCtcPct !== 0 || clonePending.inputs.repossWeightedMonths !== 0) setJurisdictionOpen(true);
    if (clonePending.inputs.remarketingMonths !== 0 || clonePending.inputs.lgdDecayAdjFactor !== 0) setAssetRiskOpen(true);
    if (clonePending.inputs.depositCoverage !== 0 || clonePending.inputs.maintenanceReserveCoverage !== 0) setDepositOpen(true);
    if (clonePending.inputs.payBehaviourCoopPct !== 0 || clonePending.inputs.payBehaviourAdvPct !== 0) setPayBehaviourOpen(true);
    setClonePending(null);
  }, [clonePending, customSeed]);

  // Derive template inputs for a run (custom runs fall back to ZERO_INPUTS)
  // useCallback so the memoised RunHistoryTab's shallow prop check passes
  // on cross-page nav re-renders.
  const getRunInputs = useCallback(
    (run: ScenarioRunResult): ScenarioInputs => {
      if (run.templateId) {
        return templateById.get(run.templateId)?.inputs ?? ZERO_INPUTS;
      }
      return ZERO_INPUTS;
    },
    [templateById],
  );

  // ── Run History state ──
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 2
          ? [prev[1], id]   // replace oldest when already 2 selected
          : [...prev, id]
    );
  }, []);

  // ── Result lookup ──
  // CRITICAL: must be useCallback. LibraryTab and RunHistoryTab are
  // wrapped in React.memo; if findRun is a fresh function ref on every
  // render they re-render too, defeating the memo and producing the
  // freeze the user reports on cross-page nav.
  const findRun = useCallback((id: string) => runs.find((r) => r.id === id), [runs]);

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

  // "Custom Builder" intentionally absent — it's its own top-level page at
  // /build, accessed from the sidebar or the "New Custom Scenario" button
  // above. Keeping it as a Scenarios pill would imply it lives under
  // /scenarios; it doesn't any more.
  const tabs = isExecutiveMode
    ? EXEC_SCENARIO_TABS.filter((t) => t !== "Custom Builder")
    : ["Library", "Run History", "Insolvency Regimes", "Jurisdiction Risk", "Asset Risk", "Rating / PD", "Security Deposits", "Deferral Risk", "Lessor Mitigation", "Payment Behaviour", "Concentration Stress", "Lease Pricing"];

  // ─────────────────────────────────────────────────────────────────────────────

  // useCallback for the same reason as findRun above — passed into the
  // memoised LibraryTab and RunHistoryTab. A function declaration here
  // would produce a fresh reference on every Scenarios render and defeat
  // their React.memo shallow equality check.
  const getNarrative = useCallback(
    (runId: string): string | null | "loading" => {
      if (!narrativeCache.has(runId)) return "loading";
      return narrativeCache.get(runId) as string | null | "loading";
    },
    [narrativeCache],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Scenario Engine"
        subtitle="Run deterministic or Monte Carlo scenarios across your full portfolio"
      >
        {/* Use Link instead of a button + manual navigate so the browser
            treats this exactly like a sidebar click — react-router's Link
            component handles the location update + Outlet swap synchronously
            with React's commit phase. Manually calling navigate() inside an
            onClick handler from a component that is itself a child of the
            persistent ScenariosShell occasionally lost the Outlet swap on
            the user's machine (URL updated, content stayed). */}
        <Link
          to="/build"
          style={{
            ...BTN_PRIMARY,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <Play size={14} /> New Custom Scenario
        </Link>
      </PageHeader>

      {/* ── Tabs ── */}
      <PillTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={handleTabChange}
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

      {/*
        ══ HEAVY TABS — Library / Custom Builder / Run History ══════════════
        These three components are large (Library 766 lines, Custom Builder
        1570 lines, Run History 285 lines). When they were conditionally
        rendered via `activeTab === "X" && <X />`, switching between them
        unmounted one and mounted another on every click. The mount cost
        for Custom Builder in particular blew the main-thread frame budget
        and rapid switching choked. Now they stay permanently mounted once
        Scenarios is open — switches become a CSS visibility flip. Memory
        cost is bounded (three mounts total per Scenarios visit).
      */}
      <div style={{ display: activeTab === "Library" ? "block" : "none" }}>
        {visitedSubTabs.has("Library") && <LibraryTab
          weightedECL={weightedECL}
          effectiveTemplates={effectiveTemplates}
          cardStates={cardStates}
          setCardPhase={setCardPhase}
          setClonePending={sendCloneToBuilder}
          handleTemplateRun={handleTemplateRun}
          findRun={findRun}
          liveBaseECL={liveBaseECL}
          getNarrative={getNarrative}
          onRequestNarrative={handleRequestNarrative}
        />}
      </div>

      {/* Custom Builder is now its OWN route at /scenarios/build. The
          "Custom Builder" entry in the PillTabs above navigates there
          via useTabSync; this file no longer renders the form. */}

      {/* ══ RUN HISTORY TAB ══════════════════════════════════════════════════ */}
      <div style={{ display: activeTab === "Run History" ? "block" : "none" }}>
        {visitedSubTabs.has("Run History") && <RunHistoryTab
          runs={runs}
          compareIds={compareIds}
          toggleCompare={toggleCompare}
          expandedRunId={expandedRunId}
          setExpandedRunId={setExpandedRunId}
          setCompareIds={setCompareIds}
          setClonePending={sendCloneToBuilder}
          setBranchFromId={setBranchFromId}
          getRunInputs={getRunInputs}
          getNarrative={getNarrative}
          onRequestNarrative={handleRequestNarrative}
        />}
      </div>

      {/* ══ INSOLVENCY REGIMES TAB ══════════════════════════════════════ */}
      {activeTab === "Insolvency Regimes" && <InsolvencyTab />}

      {/* ══ JURISDICTION RISK TAB ═══════════════════════════════════════ */}
      {activeTab === "Jurisdiction Risk" && (
        <JurisdictionRiskTab
          onUseInCustomBuilder={(gold, nonCtc, repossMonths) =>
            sendToBuilder({ ctcGoldPct: gold, nonCtcPct: nonCtc, repossWeightedMonths: repossMonths })
          }
        />
      )}

      {/* ══ ASSET RISK TAB ══════════════════════════════════════════════ */}
      {activeTab === "Asset Risk" && (
        <AssetRiskTab
          onUseInCustomBuilder={(months, adj) =>
            sendToBuilder({ remarketingMonths: months, lgdDecayAdjFactor: adj })
          }
        />
      )}

      {/* ══ RATING / PD TAB ════════════════════════════════════════════ */}
      {activeTab === "Rating / PD" && (
        <RatingPDTab
          onUseInCustomBuilder={(s2Multi, s3Multi) =>
            sendToBuilder({ pdS2Multi: s2Multi, pdS3Multi: s3Multi })
          }
        />
      )}

      {/* ══ SECURITY DEPOSITS TAB ═══════════════════════════════════════ */}
      {activeTab === "Security Deposits" && (
        <CreditDepositTab
          onUseInCustomBuilder={(cov) => sendToBuilder({ depositCoverage: cov })}
        />
      )}

      {/* ══ DEFERRAL RISK TAB ════════════════════════════════════════════ */}
      {activeTab === "Deferral Risk" && (
        <DeferralRiskTab
          onUseInCustomBuilder={(type, months, govtProb, forgiveness) =>
            sendToBuilder({
              restructuringType: type,
              deferralMonths:    months,
              govtSupportProb:   govtProb,
              forgivenessRate:   forgiveness,
            })
          }
        />
      )}

      {/* ══ LESSOR MITIGATION TAB ═══════════════════════════════════════ */}
      {activeTab === "Lessor Mitigation" && (
        <LessorMitigationTab
          onUseInCustomBuilder={(pbh, etp, lec) =>
            sendToBuilder({
              pbhConversionPct: pbh,
              etpRate:          etp,
              lecRate:          lec,
            })
          }
        />
      )}

      {/* ══ PAYMENT BEHAVIOUR TAB ═══════════════════════════════════════ */}
      {activeTab === "Payment Behaviour" && (
        <PaymentBehaviourTab
          onUseInCustomBuilder={(coop, adv) => sendToBuilder({ payBehaviourCoopPct: coop, payBehaviourAdvPct: adv })}
        />
      )}

      {/* ══ CONCENTRATION STRESS TAB ════════════════════════════════════ */}
      {activeTab === "Concentration Stress" && (
        <ConcentrationStressTab
          onUseInCustomBuilder={(pdS3Multi) => sendToBuilder({ pdS3Multi })}
        />
      )}

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
