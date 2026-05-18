// src/app/components/transactions/DistributionStatement.tsx
import { Download } from "lucide-react";
import type { WaterfallResult, NoteClass } from "../../utils/absWaterfall";

interface Props {
  result:      WaterfallResult;
  noteClasses: NoteClass[];
  periodLabel: string;
}

const fmtM = (n: number) => `$${Math.abs(n).toFixed(3)}M`;

type RowVariant = "normal" | "deduct" | "separator" | "trap" | "residual" | "total";

interface Row {
  priority: string;
  description: string;
  amount: number;
  remaining: number;
  variant: RowVariant;
  shortfall?: number;
}

export function DistributionStatement({ result, noteClasses, periodLabel }: Props) {
  const distA = result.noteDistributions.find(d => d.noteClass === "A")!;
  const distB = result.noteDistributions.find(d => d.noteClass === "B")!;
  const distC = result.noteDistributions.find(d => d.noteClass === "C")!;

  let running = result.availableCollections;

  const rows: Row[] = [
    { priority: "1", description: "Total Collections", amount: result.availableCollections, remaining: running, variant: "total" },
    { priority: "2", description: "Less: Senior Expenses", amount: -result.seniorExpensesTotal, remaining: (running -= result.seniorExpensesTotal), variant: "deduct" },
    { priority: "3", description: "Less: Liquidity Reserve Top-up", amount: -result.liquidityReserveTopUp, remaining: (running -= result.liquidityReserveTopUp), variant: "deduct" },
    { priority: "4", description: "Class A Interest", amount: distA.interestPaid, remaining: (running -= distA.interestPaid), variant: "normal", shortfall: distA.shortfall > 0 ? distA.shortfall : undefined },
    { priority: "5", description: "Class A Principal", amount: distA.principalPaid, remaining: (running -= distA.principalPaid), variant: "normal" },
    { priority: "—", description: `DSCR Test: ${result.dscrResult.value.toFixed(2)}× vs ${result.dscrResult.trigger}× trigger`, amount: 0, remaining: running, variant: "separator" },
    { priority: "6", description: "Class B Interest", amount: distB.interestPaid, remaining: (running -= distB.interestPaid), variant: "normal", shortfall: distB.shortfall > 0 ? distB.shortfall : undefined },
    { priority: "7", description: "Class B Principal", amount: distB.principalPaid, remaining: (running -= distB.principalPaid), variant: "normal" },
    { priority: "—", description: `LTV Test: ${(result.ltvResult.value * 100).toFixed(1)}% vs ${(result.ltvResult.trigger * 100).toFixed(0)}% trigger`, amount: 0, remaining: running, variant: "separator" },
    { priority: "8", description: "Class C Interest", amount: distC.interestPaid, remaining: (running -= distC.interestPaid), variant: "normal", shortfall: distC.shortfall > 0 ? distC.shortfall : undefined },
    { priority: "9", description: "Class C Principal", amount: distC.principalPaid, remaining: (running -= distC.principalPaid), variant: "normal" },
    ...(result.cashTrapTotal > 0 ? [{
      priority: "10", description: "Cash Trapped (Coverage Breach)",
      amount: -result.cashTrapTotal, remaining: 0, variant: "trap" as RowVariant,
    }] : []),
    { priority: "11", description: "Residual to Equity / Deal Sponsor", amount: result.residualToEquity, remaining: 0, variant: "residual" },
  ];

  const headerStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "#94A3B8",
    fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left",
  };

  function rowBg(v: RowVariant) {
    if (v === "separator") return "#0A1628";
    if (v === "trap") return "rgba(153,27,27,0.15)";
    if (v === "residual") return "rgba(22,101,52,0.15)";
    if (v === "total") return "rgba(30,58,138,0.2)";
    return undefined;
  }
  function amountColor(v: RowVariant, sf?: number) {
    if (sf && sf > 0) return "#F87171";
    if (v === "deduct" || v === "trap") return "#F87171";
    if (v === "residual") return "#4ADE80";
    if (v === "total") return "#93C5FD";
    return "#CBD5E1";
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h3 style={{ margin: 0, color: "#F8FAFC", fontSize: "0.9375rem", fontWeight: 600 }}>
            Distribution Statement
          </h3>
          <p style={{ margin: "0.2rem 0 0", color: "#64748B", fontSize: "0.8125rem" }}>
            Period: {periodLabel}
          </p>
        </div>
        <button
          style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 0.875rem",
            background: "#1E293B", border: "1px solid #334155", borderRadius: "6px",
            color: "#CBD5E1", fontSize: "0.8125rem", cursor: "pointer" }}
          onClick={() => {
            const lines = [`Distribution Statement — ${periodLabel}`, ""];
            rows.forEach(r => {
              if (r.variant === "separator") {
                lines.push(`  [${r.description}]`);
              } else if (r.amount !== 0) {
                lines.push(`  ${r.priority}. ${r.description}: ${r.amount >= 0 ? "+" : ""}${fmtM(r.amount)}`);
              }
            });
            const blob = new Blob([lines.join("\n")], { type: "text/plain" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `distribution-statement-${periodLabel.replace(/\s+/g, "-")}.txt`;
            a.click();
          }}
        >
          <Download size={14} /> Export
        </button>
      </div>

      <div style={{ borderRadius: "8px", border: "1px solid #334155", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#0F172A" }}>
            <tr>
              <th style={{ ...headerStyle, width: "2.5rem" }}>#</th>
              <th style={headerStyle}>Description</th>
              <th style={{ ...headerStyle, textAlign: "right" }}>Amount ($M)</th>
              <th style={{ ...headerStyle, textAlign: "right" }}>Remaining ($M)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: rowBg(row.variant), borderBottom: "1px solid #1E293B" }}>
                <td style={{ padding: "0.5rem 0.75rem", color: "#64748B", fontSize: "0.75rem" }}>
                  {row.priority}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem",
                  color: row.variant === "separator" ? "#64748B" : "#CBD5E1",
                  fontStyle: row.variant === "separator" ? "italic" : "normal",
                  fontWeight: (row.variant === "total" || row.variant === "residual") ? 600 : 400 }}>
                  {row.description}
                  {row.shortfall && row.shortfall > 0 && (
                    <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "#F87171" }}>
                      (shortfall: {fmtM(row.shortfall)})
                    </span>
                  )}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: "0.8125rem",
                  fontWeight: 500, color: amountColor(row.variant, row.shortfall) }}>
                  {row.variant === "separator" ? "—" :
                    row.amount === 0 ? "—" :
                    `${row.amount >= 0 ? "+" : ""}${fmtM(row.amount)}`}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: "0.8125rem", color: "#64748B" }}>
                  {row.variant === "separator" ? "—" : fmtM(row.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
