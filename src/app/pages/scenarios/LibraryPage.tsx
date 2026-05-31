// src/app/pages/scenarios/LibraryPage.tsx
//
// /scenarios → Scenario Library page. Thin wrapper around LibraryTab that
// reads all its props from ScenariosContext (mounted in Layout). Page itself
// has no useState — the heavy graph survives navigation in the provider.

import { useNavigate } from "react-router";
import { PageHeader } from "../../components/ui/PageHeader";
import { LibraryTab } from "./LibraryTab";
import { useScenariosContext } from "../../contexts/ScenariosContext";
import { BTN_PRIMARY } from "./_shared";
import { Play } from "lucide-react";

export default function LibraryPage() {
  const navigate = useNavigate();
  const ctx = useScenariosContext();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Scenario Library"
        subtitle="Run pre-built deterministic or Monte Carlo stress scenarios"
      >
        <button style={BTN_PRIMARY} onClick={() => navigate("/scenarios/build")}>
          <Play size={14} /> New Custom Scenario
        </button>
      </PageHeader>

      <LibraryTab
        weightedECL={ctx.weightedECL}
        effectiveTemplates={ctx.effectiveTemplates}
        cardStates={ctx.cardStates}
        setCardPhase={ctx.setCardPhase}
        setClonePending={ctx.setClonePending}
        handleTemplateRun={ctx.handleTemplateRun}
        findRun={ctx.findRun}
        liveBaseECL={ctx.liveBaseECL}
        getNarrative={ctx.getNarrative}
        onRequestNarrative={ctx.onRequestNarrative}
      />
    </div>
  );
}
