// src/app/pages/CustomBuilderPage.tsx
//
// Standalone Custom Scenario Builder page. Lives at /scenarios/build and
// renders just like any other top-level route (inside the normal app shell
// via Outlet). Owns ALL of the state that Custom Builder needs locally;
// nothing is lifted to a shared context. The Scenarios page no longer
// renders Custom Builder at all.
//
// State sources:
//   - formInputs persists in localStorage (mirrors the legacy in-Scenarios
//     behaviour so users don't lose work navigating away)
//   - "Clone this template" / "Clone this run" from Library / RunHistory
//     write to sessionStorage("aero_clone_pending") and navigate here. On
//     mount the page consumes that payload, applies it, and clears the
//     bridge so the next visit isn't pre-filled.
//   - Everything else is fresh per visit. This matches what the user asked
//     for: "make custom builder a separate tool, just linking its access
//     through scenarios". One focused mount per session.
//
// Data hooks (usePortfolioData, useJurisdictions, useScenarioRuns,
// useStressScenarios) are called here AND in Scenarios. That's fine — each
// hook is idempotent inside one React tree, and in demo mode they all
// return MOCK data without firing network requests.

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { CustomBuilderTab } from "./scenarios/CustomBuilderTab";
import { PageHeader } from "../components/ui/PageHeader";
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
  generateDSL,
  parseDSL,
  type RunMode,
  type Template,
} from "./scenarios/_shared";

interface ClonePayload {
  inputs: ScenarioInputs;
  name: string;
  mode: RunMode;
  paths: number;
}

const CLONE_BRIDGE_KEY = "aero_clone_pending";

export default function CustomBuilderPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { state: locationState } = useLocation();

  // ── Live portfolio data ──
  const { assets, lessees, leases, provisions, isDemo } = usePortfolioData();
  const { jurisdictions: ingestedJurisdictions } = useJurisdictions();
  const { runs: dbRuns, insertRun: persistRun, hasIngested: hasPersistedRuns } = useScenarioRuns();
  const { templates: dbTemplates } = useStressScenarios();

  // Ephemeral runs — fallback when DB persist fails (sample portfolio etc.)
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
  const findRun = useCallback((id: string) => runs.find((r) => r.id === id), [runs]);

  const effectiveTemplates = useMemo<Template[]>(
    () => [...TEMPLATES, ...(dbTemplates as Template[])],
    [dbTemplates],
  );

  // ── Derived portfolio metrics ──
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

  // ── Custom Builder local state ──
  const [prefillSource, setPrefillSource] = useState<string | null>(null);
  const [calBannerDismissed, setCalBannerDismissed] = useState(false);
  const [customName, setCustomName] = useState("My Custom Scenario");
  const [formInputs, setFormInputs] = useState<ScenarioInputs>(() => {
    try {
      const s = localStorage.getItem("aero_custom_inputs");
      if (s) return { ...ZERO_INPUTS, ...JSON.parse(s) } as ScenarioInputs;
    } catch { /* corrupt storage */ }
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
  const [branchFromId, setBranchFromId] = useState<string | null>(null);

  // ── Clone bridge: Library / RunHistory write a payload to sessionStorage
  //    then navigate here. On mount we apply it once and clear the bridge.
  useEffect(() => {
    const raw = sessionStorage.getItem(CLONE_BRIDGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(CLONE_BRIDGE_KEY);
    try {
      const payload = JSON.parse(raw) as ClonePayload;
      setCustomName(payload.name);
      setFormInputs(payload.inputs);
      setCustomMode(payload.mode);
      setCustomPaths(payload.paths);
      setDslText(generateDSL(payload.inputs, payload.name, payload.mode, payload.paths, customSeed));
      setDslErrors([]);
      setCustomResultId(null);
      if (payload.inputs.bankruptcyScenarioType !== null) setInsolvencyOpen(true);
      if (payload.inputs.ctcGoldPct !== 0 || payload.inputs.nonCtcPct !== 0 || payload.inputs.repossWeightedMonths !== 0) setJurisdictionOpen(true);
      if (payload.inputs.remarketingMonths !== 0 || payload.inputs.lgdDecayAdjFactor !== 0) setAssetRiskOpen(true);
      if (payload.inputs.depositCoverage !== 0 || payload.inputs.maintenanceReserveCoverage !== 0) setDepositOpen(true);
      if (payload.inputs.payBehaviourCoopPct !== 0 || payload.inputs.payBehaviourAdvPct !== 0) setPayBehaviourOpen(true);
    } catch { /* malformed payload — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link prefill from Intelligence page
  useEffect(() => {
    const state = locationState as { prefill?: Partial<ScenarioInputs>; prefillSource?: string } | null;
    if (!state?.prefill) return;
    const merged: ScenarioInputs = { ...ZERO_INPUTS, ...state.prefill } as ScenarioInputs;
    setFormInputs(merged);
    if (state.prefillSource) setPrefillSource(state.prefillSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleDslChange = useCallback((text: string) => {
    setDslText(text);
    const { errors, inputs, name, mode, paths } = parseDSL(text);
    setDslErrors(errors);
    if (inputs) setFormInputs(inputs);
    if (name) setCustomName(name);
    if (mode) setCustomMode(mode);
    if (paths) setCustomPaths(paths);
  }, []);

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

  // ── Narratives ──
  const [narrativeCache, setNarrativeCache] = useState<Map<string, string | null | "loading">>(new Map());
  const { getAccessTokenSilently } = useAuth0();
  const requestedRunIds = useRef<Set<string>>(new Set());
  const onRequestNarrative = useCallback(async (run: ScenarioRunResult) => {
    if (requestedRunIds.current.has(run.id)) return;
    requestedRunIds.current.add(run.id);
    setNarrativeCache((prev) => new Map(prev).set(run.id, "loading"));
    let token: string | undefined;
    try { token = await getAccessTokenSilently(); } catch { /* fall back to fallback narrative */ }
    const result = await generateNarrative(run, token);
    setNarrativeCache((prev) => new Map(prev).set(run.id, result));
  }, [getAccessTokenSilently]);
  const getNarrative = useCallback(
    (runId: string): string | null | "loading" => {
      if (!narrativeCache.has(runId)) return "loading";
      return narrativeCache.get(runId) as string | null | "loading";
    },
    [narrativeCache],
  );

  void effectiveTemplates; // referenced via runs/findRun above but kept for parity

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Custom Scenario Builder"
        subtitle="Build a custom stress scenario with sliders or DSL"
      >
        <button
          onClick={() => navigate("/scenarios")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.8125rem",
            color: "#0f172a",
            background: "transparent",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            padding: "0.4rem 0.75rem",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={14} /> Back to Scenarios
        </button>
      </PageHeader>

      <CustomBuilderTab
        prefillSource={prefillSource}
        setPrefillSource={setPrefillSource}
        calBannerDismissed={calBannerDismissed}
        setCalBannerDismissed={setCalBannerDismissed}
        customName={customName}
        setCustomName={setCustomName}
        formInputs={formInputs}
        setFormInputs={setFormInputs}
        updateFormInputs={updateFormInputs}
        customMode={customMode}
        setCustomMode={setCustomMode}
        customPaths={customPaths}
        setCustomPaths={setCustomPaths}
        customSeed={customSeed}
        editorMode={editorMode}
        setEditorMode={setEditorMode}
        distressOpen={distressOpen}
        setDistressOpen={setDistressOpen}
        insolvencyOpen={insolvencyOpen}
        setInsolvencyOpen={setInsolvencyOpen}
        jurisdictionOpen={jurisdictionOpen}
        setJurisdictionOpen={setJurisdictionOpen}
        depositOpen={depositOpen}
        setDepositOpen={setDepositOpen}
        payBehaviourOpen={payBehaviourOpen}
        setPayBehaviourOpen={setPayBehaviourOpen}
        assetRiskOpen={assetRiskOpen}
        setAssetRiskOpen={setAssetRiskOpen}
        dslText={dslText}
        setDslText={setDslText}
        dslErrors={dslErrors}
        handleDslChange={handleDslChange}
        customRunning={customRunning}
        setCustomRunning={setCustomRunning}
        customResultId={customResultId}
        setCustomResultId={setCustomResultId}
        customResultRef={customResultRef}
        handleCustomRun={handleCustomRun}
        liveBaseECL={liveBaseECL}
        portfolioJurisdictionMix={portfolioJurisdictionMix}
        portfolioAssetRisk={portfolioAssetRisk}
        portfolioDepositMix={portfolioDepositMix}
        portfolioDepositCoverage={portfolioDepositCoverage}
        portfolioPayBehaviourMix={portfolioPayBehaviourMix}
        findRun={findRun}
        getNarrative={getNarrative}
        onRequestNarrative={onRequestNarrative}
      />
    </div>
  );
}
