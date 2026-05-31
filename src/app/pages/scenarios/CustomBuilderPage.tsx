// src/app/pages/scenarios/CustomBuilderPage.tsx
//
// /scenarios/build → Custom Scenario Builder page. Thin wrapper around the
// CustomBuilderTab consuming state from ScenariosContext.

import { useEffect } from "react";
import { useLocation } from "react-router";
import { PageHeader } from "../../components/ui/PageHeader";
import { CustomBuilderTab } from "./CustomBuilderTab";
import { useScenariosContext } from "../../contexts/ScenariosContext";
import { ZERO_INPUTS, type ScenarioInputs } from "../../utils/eclCalculator";

export default function CustomBuilderPage() {
  const ctx = useScenariosContext();
  const { state: locationState } = useLocation();

  // Deep-link prefill from Intelligence page or other deep-link sources.
  // Runs only on mount when a state.prefill payload is present.
  useEffect(() => {
    const s = locationState as { prefill?: Partial<ScenarioInputs>; prefillSource?: string } | null;
    if (!s?.prefill) return;
    const merged: ScenarioInputs = { ...ZERO_INPUTS, ...s.prefill } as ScenarioInputs;
    ctx.setFormInputs(merged);
    if (s.prefillSource) ctx.setPrefillSource(s.prefillSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Custom Scenario Builder"
        subtitle="Build a custom stress scenario with sliders or DSL"
      />

      <CustomBuilderTab
        prefillSource={ctx.prefillSource}
        setPrefillSource={ctx.setPrefillSource}
        calBannerDismissed={ctx.calBannerDismissed}
        setCalBannerDismissed={ctx.setCalBannerDismissed}
        customName={ctx.customName}
        setCustomName={ctx.setCustomName}
        formInputs={ctx.formInputs}
        setFormInputs={ctx.setFormInputs}
        updateFormInputs={ctx.updateFormInputs}
        customMode={ctx.customMode}
        setCustomMode={ctx.setCustomMode}
        customPaths={ctx.customPaths}
        setCustomPaths={ctx.setCustomPaths}
        customSeed={ctx.customSeed}
        editorMode={ctx.editorMode}
        setEditorMode={ctx.setEditorMode}
        distressOpen={ctx.distressOpen}
        setDistressOpen={ctx.setDistressOpen}
        insolvencyOpen={ctx.insolvencyOpen}
        setInsolvencyOpen={ctx.setInsolvencyOpen}
        jurisdictionOpen={ctx.jurisdictionOpen}
        setJurisdictionOpen={ctx.setJurisdictionOpen}
        depositOpen={ctx.depositOpen}
        setDepositOpen={ctx.setDepositOpen}
        payBehaviourOpen={ctx.payBehaviourOpen}
        setPayBehaviourOpen={ctx.setPayBehaviourOpen}
        assetRiskOpen={ctx.assetRiskOpen}
        setAssetRiskOpen={ctx.setAssetRiskOpen}
        dslText={ctx.dslText}
        setDslText={ctx.setDslText}
        dslErrors={ctx.dslErrors}
        handleDslChange={ctx.handleDslChange}
        customRunning={ctx.customRunning}
        setCustomRunning={ctx.setCustomRunning}
        customResultId={ctx.customResultId}
        setCustomResultId={ctx.setCustomResultId}
        customResultRef={ctx.customResultRef}
        handleCustomRun={ctx.handleCustomRun}
        liveBaseECL={ctx.liveBaseECL}
        portfolioJurisdictionMix={ctx.portfolioJurisdictionMix}
        portfolioAssetRisk={ctx.portfolioAssetRisk}
        portfolioDepositMix={ctx.portfolioDepositMix}
        portfolioDepositCoverage={ctx.portfolioDepositCoverage}
        portfolioPayBehaviourMix={ctx.portfolioPayBehaviourMix}
        findRun={ctx.findRun}
        getNarrative={ctx.getNarrative}
        onRequestNarrative={ctx.onRequestNarrative}
      />
    </div>
  );
}
