// src/app/components/transactions/CoverageTestPanel.tsx
import type { CoverageTestResult, WaterfallResult, NoteClass } from "../../utils/absWaterfall";

interface Props {
  dscrResult: CoverageTestResult;
  ltvResult:  CoverageTestResult;
  result:     WaterfallResult;
  noteClasses: NoteClass[];
  portfolioAircraftValueM: number;
}

const fmtM = (n: number) => `$${n.toFixed(2)}M`;

function TestCard({
  title, value, label, trigger, triggerLabel, passed, cashTrapped, breakdown,
}: {
  title: string; value: string; label: string;
  trigger: string; triggerLabel: string; passed: boolean; cashTrapped: number;
  breakdown: { label: string; value: string }[];
}) {
  return (
    <div style={{
      flex: 1, minWidth: "240px", padding: "1.25rem", borderRadius: "8px",
      border: `1px solid ${passed ? "#166534" : "#991B1B"}`,
      background: passed ? "rgba(22,101,52,0.12)" : "rgba(153,27,27,0.12)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <p style={{ margin: 0, color: "#94A3B8", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</p>
        <span style={{
          padding: "0.2rem 0.6rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 700,
          background: passed ? "#166534" : "#991B1B",
          color: passed ? "#DCFCE7" : "#FEE2E2",
        }}>
          {passed ? "PASS" : "BREACH"}
        </span>
      </div>
      <p style={{ margin: "0 0 0.25rem", fontSize: "2rem", fontWeight: 700, color: passed ? "#4ADE80" : "#F87171" }}>
        {value}
      </p>
      <p style={{ margin: "0 0 1rem", color: "#64748B", fontSize: "0.8125rem" }}>
        {label} · Trigger: {trigger} {triggerLabel}
      </p>
      {cashTrapped > 0 && (
        <p style={{ margin: "0 0 0.75rem", color: "#FBBF24", fontSize: "0.8125rem" }}>
          ⚠ {fmtM(cashTrapped)} cash trapped
        </p>
      )}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {breakdown.map(b => (
          <div key={b.label} style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#94A3B8", fontSize: "0.8125rem" }}>{b.label}</span>
            <span style={{ color: "#CBD5E1", fontSize: "0.8125rem", fontWeight: 500 }}>{b.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CoverageTestPanel({ dscrResult, ltvResult, result, noteClasses, portfolioAircraftValueM }: Props) {
  const classA = noteClasses.find(n => n.label === "A");
  const totalOutstanding = noteClasses.reduce((s, n) => s + n.outstandingBalance, 0);

  // Infer paymentsPerYear from the dscrResult context — use 4 (quarterly) as default display
  // The actual computation already happened in runWaterfall; we display derived values
  const classAInterestDisplay = classA
    ? fmtM((classA.outstandingBalance * classA.couponRate) / 4)
    : "—";
  const classAPrincipalDisplay = classA ? fmtM(classA.scheduledPrincipal) : "—";

  return (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      <TestCard
        title="DSCR"
        value={`${dscrResult.value.toFixed(2)}×`}
        label="Debt Service Coverage Ratio"
        trigger={`${dscrResult.trigger.toFixed(2)}×`}
        triggerLabel="minimum"
        passed={dscrResult.passed}
        cashTrapped={dscrResult.cashTrapped}
        breakdown={[
          { label: "Net Cash Available", value: fmtM(result.availableCollections - result.seniorExpensesTotal) },
          { label: "Class A Interest Due", value: classAInterestDisplay },
          { label: "Class A Principal Sched.", value: classAPrincipalDisplay },
          { label: "Senior Expenses", value: fmtM(result.seniorExpensesTotal) },
        ]}
      />
      <TestCard
        title="LTV"
        value={`${(ltvResult.value * 100).toFixed(1)}%`}
        label="Loan-to-Value Ratio"
        trigger={`${(ltvResult.trigger * 100).toFixed(0)}%`}
        triggerLabel="maximum"
        passed={ltvResult.passed}
        cashTrapped={ltvResult.cashTrapped}
        breakdown={[
          { label: "Total Notes Outstanding", value: fmtM(totalOutstanding) },
          { label: "Portfolio Aircraft Value", value: fmtM(portfolioAircraftValueM) },
        ]}
      />
    </div>
  );
}
