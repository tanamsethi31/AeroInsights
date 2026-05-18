// src/app/components/transactions/CollectionOverridesTable.tsx
import type { CollectionInput } from "../../utils/absWaterfall";

interface Props {
  collections: CollectionInput[];
  onChange:    (updated: CollectionInput[]) => void;
}

const fmtM = (n: number) => `$${n.toFixed(3)}M`;

export function CollectionOverridesTable({ collections, onChange }: Props) {
  function updateActual(idx: number, value: string) {
    const updated = collections.map((c, i) =>
      i === idx ? { ...c, actualCollected: parseFloat(value) || 0 } : c
    );
    onChange(updated);
  }

  const totalExpected = collections.reduce((s, c) => s + c.expectedRent, 0);
  const totalActual   = collections.reduce((s, c) => s + c.actualCollected, 0);
  const totalVariance = totalActual - totalExpected;

  const headerStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "#94A3B8",
    textAlign: "left" as const, fontWeight: 600, textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  };
  const cellStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#CBD5E1",
    borderBottom: "1px solid #1E293B",
  };

  return (
    <div style={{ borderRadius: "8px", border: "1px solid #334155", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#0F172A" }}>
          <tr>
            <th style={headerStyle}>MSN / Lease</th>
            <th style={headerStyle}>Lessee</th>
            <th style={{ ...headerStyle, textAlign: "right" }}>Expected ($M)</th>
            <th style={{ ...headerStyle, textAlign: "right" }}>Collected ($M)</th>
            <th style={{ ...headerStyle, textAlign: "right" }}>Variance</th>
          </tr>
        </thead>
        <tbody>
          {collections.map((c, idx) => {
            const variance = c.actualCollected - c.expectedRent;
            return (
              <tr key={c.leaseId} style={{ background: idx % 2 === 0 ? "#1E293B" : "#162032" }}>
                <td style={cellStyle}>{c.leaseId}</td>
                <td style={cellStyle}>{c.lessee}</td>
                <td style={{ ...cellStyle, textAlign: "right" }}>{fmtM(c.expectedRent)}</td>
                <td style={{ ...cellStyle, textAlign: "right", padding: "0.25rem 0.75rem" }}>
                  <input
                    type="number" min="0" step="0.001"
                    value={c.actualCollected}
                    onChange={e => updateActual(idx, e.target.value)}
                    style={{
                      width: "90px", padding: "0.25rem 0.5rem", textAlign: "right",
                      background: "#0F172A", border: "1px solid #334155",
                      borderRadius: "4px", color: "#F8FAFC", fontSize: "0.8125rem", outline: "none",
                    }}
                  />
                </td>
                <td style={{ ...cellStyle, textAlign: "right",
                  color: variance < 0 ? "#F87171" : variance > 0 ? "#4ADE80" : "#94A3B8" }}>
                  {variance >= 0 ? "+" : ""}{fmtM(variance)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot style={{ background: "#0F172A" }}>
          <tr>
            <td colSpan={2} style={{ ...cellStyle, color: "#F8FAFC", fontWeight: 600 }}>Total</td>
            <td style={{ ...cellStyle, textAlign: "right", color: "#F8FAFC", fontWeight: 600 }}>{fmtM(totalExpected)}</td>
            <td style={{ ...cellStyle, textAlign: "right", color: "#F8FAFC", fontWeight: 600 }}>{fmtM(totalActual)}</td>
            <td style={{ ...cellStyle, textAlign: "right", fontWeight: 600,
              color: totalVariance < 0 ? "#F87171" : totalVariance > 0 ? "#4ADE80" : "#94A3B8" }}>
              {totalVariance >= 0 ? "+" : ""}{fmtM(totalVariance)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
