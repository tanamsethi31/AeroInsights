// src/app/pages/scenarios/RunHistoryPage.tsx
//
// /scenarios/history → Run History page. Thin wrapper around RunHistoryTab.

import { PageHeader } from "../../components/ui/PageHeader";
import { RunHistoryTab } from "./RunHistoryTab";
import { useScenariosContext } from "../../contexts/ScenariosContext";

export default function RunHistoryPage() {
  const ctx = useScenariosContext();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Scenario Run History"
        subtitle="Browse, compare and clone past scenario runs"
      />

      <RunHistoryTab
        runs={ctx.runs}
        compareIds={ctx.compareIds}
        toggleCompare={ctx.toggleCompare}
        expandedRunId={ctx.expandedRunId}
        setExpandedRunId={ctx.setExpandedRunId}
        setCompareIds={ctx.setCompareIds}
        setClonePending={ctx.setClonePending}
        setBranchFromId={ctx.setBranchFromId}
        getRunInputs={ctx.getRunInputs}
        getNarrative={ctx.getNarrative}
        onRequestNarrative={ctx.onRequestNarrative}
      />
    </div>
  );
}
