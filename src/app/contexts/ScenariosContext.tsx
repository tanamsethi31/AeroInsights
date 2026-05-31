// src/app/contexts/ScenariosContext.tsx
//
// Owns ALL shared state and derived data for the Scenarios feature so that
// the four pages it powers (/scenarios, /scenarios/build, /scenarios/history,
// /scenarios/tools) can be thin wrappers around their respective tab
// components.
//
// CRITICAL: this provider lives in Layout, NOT in any of the Scenarios
// pages. That guarantees the entire Scenarios state graph (~30 useState
// hooks, four data-fetching hooks, several large memoised computations)
// is mounted once at app boot and never unmounts during the user's
// session. The old monolithic Scenarios.tsx tore all of this down every
// time the user navigated to another top-level page, and the resulting
// synchronous GC pressure choked the destination page's mount. With
// state lifted here, leaving Scenarios for Portfolio (or anywhere else)
// only unmounts the light page wrapper — the heavy graph survives.
//
// All cross-tab interactions (Library → Custom Builder template prefill,
// Run History → Custom Builder clone, Agent context injection) work via
// the context, exactly as the old in-component refs did.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAgent } from "./AgentContext";
import { useJurisdictions } from "../hooks/useJurisdictions";
import { useScenarioRuns } from "../hooks/useScenarioRuns";
import { useStressScenarios } from "../hooks/useStressScenarios";
import { usePortfolioData } from "../hooks/usePortfolioData";
import { toDashboardKPIs } from "../lib/portfolioAdapters";
import { computePortfolioAssetRisk } from "../utils/assetRisk";
import { computePortfolioDepositCoverage } from "../utils/creditDeposit";
import { computePortfolioJurisdictionMix } from "../utils/jurisdictionRisk";
import { computePortfolioPaymentBehaviourMix } from "../utils/paymentBehaviour";
import { DEFAULT_RECOVERY_FACTOR } from "../data/lgdCurves";
import {
  BASE_ECL,
  ZERO_INPUTS,
  computeECLFromBase,
  computeStages,
  type ScenarioInputs,
} from "../utils/eclCalculator";
import { runScenario as runScenarioEngine } from "../services/scenarioEngine";
import { generateNarrative } from "../services/narrativeService";
import type { ScenarioRunResult } from "../components/scenarios/RunResultPanel";
import {
  INITIAL_RUNS,
  STAGE3_LESSEES,
  TEMPLATES,
  buildRun,
  computeMCRange,
  computeS3LeaseCount,
  computeTopLessees,
  generateDSL,
  hashFromSeed,
  nextRunId,
  parseDSL,
  seededRand,
  type CardState,
  type RunMode,
  type Template,
} from "../pages/scenarios/_shared";

interface ScenariosContextValue {
  // ── Templates + runs ──
  effectiveTemplates: Template[];
  templateById: Map<string, Template>;
  runs: ScenarioRunResult[];
  findRun: (id: string) => ScenarioRunResult | undefined;
  getRunInputs: (run: ScenarioRunResult) => ScenarioInputs;

  // ── Live portfolio-derived metrics ──
  liveBaseECL: number;
  liveStage3Lessees: Array<{ name: string; jurisdiction: string }> | null;
  weightedECL: number | null;
  portfolioJurisdictionMix: ReturnType<typeof computePortfolioJurisdictionMix>;
  portfolioAssetRisk: ReturnType<typeof computePortfolioAssetRisk>;
  portfolioDepositMix: ReturnType<typeof computePortfolioDepositCoverage>;
  portfolioDepositCoverage: number;
  portfolioPayBehaviourMix: ReturnType<typeof computePortfolioPaymentBehaviourMix>;

  // ── Library card state machine ──
  cardStates: Record<string, CardState>;
  setCardPhase: (id: string, updates: Partial<CardState>) => void;
  handleTemplateRun: (tpl: Template) => void;

  // ── Custom Builder state ──
  prefillSource: string | null;
  setPrefillSource: (v: string | null) => void;
  calBannerDismissed: boolean;
  setCalBannerDismissed: (v: boolean) => void;
  customName: string;
  setCustomName: (v: string) => void;
  formInputs: ScenarioInputs;
  setFormInputs: (v: ScenarioInputs) => void;
  updateFormInputs: (partial: Partial<ScenarioInputs>) => void;
  customMode: RunMode;
  setCustomMode: (v: RunMode) => void;
  customPaths: number;
  setCustomPaths: (v: number) => void;
  customSeed: number;
  editorMode: "form" | "dsl";
  setEditorMode: (v: "form" | "dsl") => void;
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
  dslText: string;
  setDslText: (v: string) => void;
  dslErrors: string[];
  handleDslChange: (text: string) => void;
  customRunning: boolean;
  setCustomRunning: (v: boolean) => void;
  customResultId: string | null;
  setCustomResultId: (v: string | null) => void;
  customResultRef: React.RefObject<HTMLDivElement | null>;
  handleCustomRun: () => Promise<void>;

  // ── Clone / Branch ──
  branchFromId: string | null;
  setBranchFromId: (v: string | null) => void;
  clonePending: { inputs: ScenarioInputs; name: string; mode: RunMode; paths: number } | null;
  setClonePending: (v: ScenariosContextValue["clonePending"]) => void;

  // ── Run History ──
  expandedRunId: string | null;
  setExpandedRunId: (v: string | null) => void;
  compareIds: string[];
  setCompareIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleCompare: (id: string) => void;

  // ── Narratives ──
  getNarrative: (runId: string) => string | null | "loading";
  onRequestNarrative: (run: ScenarioRunResult) => Promise<void>;
}

const ScenariosContext = createContext<ScenariosContextValue | null>(null);

export function useScenariosContext(): ScenariosContextValue {
  const ctx = useContext(ScenariosContext);
  if (!ctx) {
    throw new Error(
      "useScenariosContext must be used inside <ScenariosProvider>. " +
        "Provider lives in Layout — make sure the consuming page is rendered under the app shell.",
    );
  }
  return ctx;
}

export function ScenariosProvider({ children }: { children: ReactNode }) {
  // ── Agent integration ──
  const { pendingInputs, setPendingInputs } = useAgent();

  // ── Live portfolio data ──
  const { assets, lessees, leases, provisions, isDemo } = usePortfolioData();
  const { jurisdictions: ingestedJurisdictions } = useJurisdictions();

  // ── Runs (DB-backed) ──
  const { runs: dbRuns, insertRun: persistRun, hasIngested: hasPersistedRuns } = useScenarioRuns();
  const [ephemeralRuns, setEphemeralRuns] = useState<ScenarioRunResult[]>([]);
  const addEphemeralRun = useCallback((r: ScenarioRunResult) => {
    setEphemeralRuns((prev) => (prev.some((p) => p.id === r.id) ? prev : [r, ...prev]));
  }, []);
  const runs = useMemo<ScenarioRunResult[]>(() => {
    const persisted = hasPersistedRuns ? dbRuns : INITIAL_RUNS;
    const persistedIds = new Set(persisted.map((r) => r.id));
    const eph = ephemeralRuns.filter((r) => !persistedIds.has(r.id));
    return [...eph, ...persisted];
  }, [hasPersistedRuns, dbRuns, ephemeralRuns]);

  // ── Templates ──
  const { templates: dbTemplates } = useStressScenarios();
  const effectiveTemplates = useMemo<Template[]>(
    () => [...TEMPLATES, ...(dbTemplates as Template[])],
    [dbTemplates],
  );
  const templateById = useMemo(() => {
    const m = new Map<string, Template>();
    for (const t of effectiveTemplates) m.set(t.id, t);
    return m;
  }, [effectiveTemplates]);

  // ── Library card state ──
  const [cardStates, setCardStates] = useState<Record<string, CardState>>(() =>
    Object.fromEntries(TEMPLATES.map((t) => [t.id, { phase: "idle", mode: "deterministic", paths: 10000 }])),
  );
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

  // ── Derived live metrics ──
  const liveBaseECL = useMemo(() => {
    const kpis = toDashboardKPIs(assets, lessees, provisions);
    return kpis.totalECLm > 0 ? kpis.totalECLm : BASE_ECL;
  }, [assets, lessees, provisions]);

  const liveStage3Lessees = useMemo(() => {
    if (isDemo || lessees.length === 0 || provisions.length === 0) return null;
    const assetToLesseeId = new Map<string, string>();
    for (const lease of leases) assetToLesseeId.set(lease.asset_id, lease.lessee_id);
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
      .map((l) => ({ name: l.name, jurisdiction: (l as { country?: string }).country ?? "Unknown" }));
  }, [isDemo, lessees, leases, provisions]);

  const weightedECL = useMemo(() => {
    let sumW = 0;
    let sumWE = 0;
    for (const tpl of effectiveTemplates) {
      if (tpl.weight === "—") continue;
      const w = parseFloat(tpl.weight) / 100;
      if (isNaN(w) || w <= 0) continue;
      sumW += w;
      sumWE += w * computeECLFromBase(liveBaseECL, tpl.inputs);
    }
    return sumW > 0 ? sumWE / sumW : null;
  }, [liveBaseECL, effectiveTemplates]);

  const portfolioJurisdictionMix = useMemo(
    () => computePortfolioJurisdictionMix(lessees, leases, ingestedJurisdictions),
    [lessees, leases, ingestedJurisdictions],
  );
  const portfolioAssetRisk = useMemo(
    () => computePortfolioAssetRisk(assets, leases, DEFAULT_RECOVERY_FACTOR),
    [assets, leases],
  );
  const portfolioDepositMix = useMemo(
    () => computePortfolioDepositCoverage(lessees, leases),
    [lessees, leases],
  );
  const portfolioDepositCoverage = liveBaseECL > 0 ? portfolioDepositMix.totalDepositM / liveBaseECL : 0;
  const portfolioPayBehaviourMix = useMemo(
    () => computePortfolioPaymentBehaviourMix(lessees, leases),
    [lessees, leases],
  );

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
  const formInputsRef = useRef<ScenarioInputs>(formInputs);
  formInputsRef.current = formInputs;
  useEffect(() => {
    try { localStorage.setItem("aero_custom_inputs", JSON.stringify(formInputs)); } catch { /* quota */ }
  }, [formInputs]);

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

  const updateFormInputs = useCallback((partial: Partial<ScenarioInputs>) => {
    const next = { ...formInputsRef.current, ...partial };
    setFormInputs(next);
    setDslText(generateDSL(next, customName, customMode, customPaths, customSeed));
    setDslErrors([]);
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
  }, [customName, customMode, customPaths, customSeed]);

  // Agent injection
  useEffect(() => {
    if (pendingInputs) {
      const partial = pendingInputs as Partial<ScenarioInputs>;
      const next = { ...formInputsRef.current, ...partial };
      setFormInputs(next);
      setDslText(generateDSL(next, customName, customMode, customPaths, customSeed));
      setDslErrors([]);
      setPendingInputs(null);
    }
  }, [pendingInputs, setPendingInputs, customName, customMode, customPaths, customSeed]);

  const handleDslChange = useCallback((text: string) => {
    setDslText(text);
    const { errors, inputs, name, mode, paths } = parseDSL(text);
    setDslErrors(errors);
    if (inputs) setFormInputs(inputs);
    if (name) setCustomName(name);
    if (mode) setCustomMode(mode);
    if (paths) setCustomPaths(paths);
  }, []);

  // ── Clone / Branch ──
  const [branchFromId, setBranchFromId] = useState<string | null>(null);
  const [clonePending, setClonePending] = useState<ScenariosContextValue["clonePending"]>(null);
  useEffect(() => {
    if (!clonePending) return;
    setCustomName(clonePending.name);
    setFormInputs(clonePending.inputs);
    setCustomMode(clonePending.mode);
    setCustomPaths(clonePending.paths);
    setDslText(generateDSL(clonePending.inputs, clonePending.name, clonePending.mode, clonePending.paths, customSeed));
    setDslErrors([]);
    setCustomResultId(null);
    if (clonePending.inputs.bankruptcyScenarioType !== null) setInsolvencyOpen(true);
    if (clonePending.inputs.ctcGoldPct !== 0 || clonePending.inputs.nonCtcPct !== 0 || clonePending.inputs.repossWeightedMonths !== 0) setJurisdictionOpen(true);
    if (clonePending.inputs.remarketingMonths !== 0 || clonePending.inputs.lgdDecayAdjFactor !== 0) setAssetRiskOpen(true);
    if (clonePending.inputs.depositCoverage !== 0 || clonePending.inputs.maintenanceReserveCoverage !== 0) setDepositOpen(true);
    if (clonePending.inputs.payBehaviourCoopPct !== 0 || clonePending.inputs.payBehaviourAdvPct !== 0) setPayBehaviourOpen(true);
    setClonePending(null);
  }, [clonePending, customSeed]);

  // ── Run history ──
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 2
          ? [prev[1], id]
          : [...prev, id],
    );
  }, []);

  // ── Narratives ──
  const [narrativeCache, setNarrativeCache] = useState<Map<string, string | null | "loading">>(new Map());
  const requestedRunIds = useRef<Set<string>>(new Set());
  const onRequestNarrative = useCallback(async (run: ScenarioRunResult) => {
    if (requestedRunIds.current.has(run.id)) return;
    requestedRunIds.current.add(run.id);
    setNarrativeCache((prev) => new Map(prev).set(run.id, "loading"));
    const result = await generateNarrative(run);
    setNarrativeCache((prev) => new Map(prev).set(run.id, result));
  }, []);
  const getNarrative = useCallback(
    (runId: string): string | null | "loading" => {
      if (!narrativeCache.has(runId)) return "loading";
      return narrativeCache.get(runId) as string | null | "loading";
    },
    [narrativeCache],
  );

  // ── Result lookup ──
  const findRun = useCallback((id: string) => runs.find((r) => r.id === id), [runs]);
  const getRunInputs = useCallback(
    (run: ScenarioRunResult): ScenarioInputs => {
      if (run.templateId) return templateById.get(run.templateId)?.inputs ?? ZERO_INPUTS;
      return ZERO_INPUTS;
    },
    [templateById],
  );

  // ── Library template run ──
  const handleTemplateRun = useCallback((tpl: Template) => {
    const cs = cardStates[tpl.id];
    const seed = Math.floor(Math.random() * 9999) + 1;
    setCardPhase(tpl.id, { phase: "running" });

    const duration = cs.mode === "deterministic" ? 1800 : 3200;
    setTimeout(async () => {
      const computedECL = computeECLFromBase(liveBaseECL, tpl.inputs);
      const { p5: _p5, p95: _p95 } = computeMCRange(computedECL, seed);
      void _p5; void _p95;
      const stages = computeStages(computedECL, tpl.inputs);
      const runCode = nextRunId();
      const durationSec = cs.mode === "deterministic"
        ? `${(1.4 + seededRand(seed, 9) * 1.4).toFixed(1)}s`
        : `${Math.round(28 + seededRand(seed, 11) * 20)}s`;
      const resultBlob = {
        durationSec,
        ecl: computedECL,
        p5: cs.mode === "montecarlo" ? computedECL * tpl.p5Factor : null,
        p95: cs.mode === "montecarlo" ? computedECL * tpl.p95Factor : null,
        s1: stages.s1, s2: stages.s2, s3: stages.s3,
        shapley: tpl.shapley,
        keyFinding: tpl.keyFinding,
        scenarioHash: hashFromSeed(seed).slice(0, 12),
        topLessees: computeTopLessees(stages.s3, seed, liveStage3Lessees ?? STAGE3_LESSEES),
        s3LeaseCount: computeS3LeaseCount(stages.s3),
      };
      const inserted = await persistRun({
        runCode, scenarioId: tpl.id, name: tpl.name, mode: cs.mode,
        paths: cs.mode === "montecarlo" ? cs.paths : null,
        seed, inputs: tpl.inputs, result: resultBlob, parentRunCode: null,
      });
      const resultId = inserted?.id ?? runCode;
      if (!inserted) {
        addEphemeralRun({
          id: resultId, templateId: tpl.id, name: tpl.name, mode: cs.mode,
          paths: cs.mode === "montecarlo" ? cs.paths : null,
          seed, runDate: new Date().toISOString(),
          durationSec, ecl: resultBlob.ecl, p5: resultBlob.p5, p95: resultBlob.p95,
          s1: resultBlob.s1, s2: resultBlob.s2, s3: resultBlob.s3,
          shapley: resultBlob.shapley, keyFinding: resultBlob.keyFinding,
          scenarioHash: resultBlob.scenarioHash, topLessees: resultBlob.topLessees,
          s3LeaseCount: resultBlob.s3LeaseCount,
        });
      }
      setCardPhase(tpl.id, { phase: "done", resultId });
    }, duration);
  }, [cardStates, setCardPhase, persistRun, addEphemeralRun, liveBaseECL, liveStage3Lessees]);

  // ── Custom Builder run ──
  const handleCustomRun = useCallback(async () => {
    const parsed = parseDSL(dslText);
    if (!parsed.ok && parsed.errors.some((e) => e.startsWith("Invalid") || e.includes("must be"))) return;
    setCustomRunning(true);
    setCustomResultId(null);
    setTimeout(() => customResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    const seed = Math.floor(Math.random() * 9999) + 1;
    const minSkeletonMs = 600;
    const startedAt = performance.now();

    const engineResult = await runScenarioEngine({
      inputs: formInputs, mode: customMode, paths: customPaths, seed, baseECL: liveBaseECL,
    });

    const newRun = buildRun(
      customName || "Custom Scenario",
      formInputs, customMode, customPaths, seed, null, engineResult.ecl,
      liveStage3Lessees ?? STAGE3_LESSEES,
    );
    if (customMode === "montecarlo" && engineResult.p5 != null && engineResult.p95 != null) {
      newRun.p5 = engineResult.p5;
      newRun.p95 = engineResult.p95;
    }
    (newRun as ScenarioRunResult & { engine?: string }).engine = engineResult.engine;

    const elapsed = performance.now() - startedAt;
    const remainingSkeletonMs = Math.max(0, minSkeletonMs - elapsed);
    setTimeout(async () => {
      const inserted = await persistRun({
        runCode: newRun.id, scenarioId: null, name: newRun.name,
        mode: newRun.mode, paths: newRun.paths, seed: newRun.seed,
        inputs: formInputs,
        result: {
          durationSec: newRun.durationSec, ecl: newRun.ecl, p5: newRun.p5, p95: newRun.p95,
          s1: newRun.s1, s2: newRun.s2, s3: newRun.s3,
          shapley: newRun.shapley, keyFinding: newRun.keyFinding,
          scenarioHash: newRun.scenarioHash, topLessees: newRun.topLessees,
          s3LeaseCount: newRun.s3LeaseCount,
          engine: (newRun as ScenarioRunResult & { engine?: string }).engine,
        },
        parentRunCode: branchFromId,
      });
      const resultId = inserted?.id ?? newRun.id;
      if (!inserted) addEphemeralRun(newRun);
      setCustomResultId(resultId);
      setCustomRunning(false);
      setBranchFromId(null);
    }, remainingSkeletonMs);
  }, [dslText, formInputs, customMode, customPaths, customName, branchFromId, liveBaseECL, liveStage3Lessees, persistRun, addEphemeralRun]);

  const value: ScenariosContextValue = {
    effectiveTemplates, templateById, runs, findRun, getRunInputs,
    liveBaseECL, liveStage3Lessees, weightedECL,
    portfolioJurisdictionMix, portfolioAssetRisk, portfolioDepositMix,
    portfolioDepositCoverage, portfolioPayBehaviourMix,
    cardStates, setCardPhase, handleTemplateRun,
    prefillSource, setPrefillSource,
    calBannerDismissed, setCalBannerDismissed,
    customName, setCustomName,
    formInputs, setFormInputs, updateFormInputs,
    customMode, setCustomMode,
    customPaths, setCustomPaths, customSeed,
    editorMode, setEditorMode,
    distressOpen, setDistressOpen,
    insolvencyOpen, setInsolvencyOpen,
    jurisdictionOpen, setJurisdictionOpen,
    depositOpen, setDepositOpen,
    payBehaviourOpen, setPayBehaviourOpen,
    assetRiskOpen, setAssetRiskOpen,
    dslText, setDslText, dslErrors, handleDslChange,
    customRunning, setCustomRunning,
    customResultId, setCustomResultId,
    customResultRef, handleCustomRun,
    branchFromId, setBranchFromId, clonePending, setClonePending,
    expandedRunId, setExpandedRunId,
    compareIds, setCompareIds, toggleCompare,
    getNarrative, onRequestNarrative,
  };

  return <ScenariosContext.Provider value={value}>{children}</ScenariosContext.Provider>;
}
