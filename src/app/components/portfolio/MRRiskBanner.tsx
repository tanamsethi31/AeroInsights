import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { MRHealthSummary } from "../../lib/portfolioAdapters";

interface Props {
  summary: MRHealthSummary;
}

export function MRRiskBanner({ summary }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const { redCount, amberCount, worstOffenders } = summary;
  const atRiskCount = redCount + amberCount;

  if (atRiskCount === 0 || dismissed) return null;

  const hasRed = redCount > 0;
  const borderColour  = hasRed ? "#B91C1C" : "#B45309";
  const bgColour      = hasRed ? "rgba(185,28,28,0.04)" : "rgba(180,83,9,0.04)";
  const iconColour    = hasRed ? "#B91C1C" : "#B45309";
  const headline = `${atRiskCount} lease${atRiskCount !== 1 ? "s" : ""} have material maintenance reserve shortfall${atRiskCount !== 1 ? "s" : ""}`;

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "0.75rem",
      padding: "0.875rem 1rem",
      borderRadius: "0.5rem",
      border: `1px solid ${borderColour}`,
      background: bgColour,
      marginBottom: "1rem",
    }}>
      <AlertTriangle size={16} style={{ color: iconColour, flexShrink: 0, marginTop: "0.125rem" }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Headline */}
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginBottom: "0.375rem" }}>
          {headline}
        </div>

        {/* Offender chips */}
        {worstOffenders.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {worstOffenders.map((o) => {
              const chipColour = o.flag === "red" ? "#B91C1C" : "#B45309";
              const chipBg     = o.flag === "red" ? "rgba(185,28,28,0.08)" : "rgba(180,83,9,0.08)";
              const shortfallM = (o.eolShortfall / 1_000_000).toFixed(1);
              return (
                <span key={o.leaseId} style={{
                  background: chipBg,
                  color: chipColour,
                  borderRadius: "0.25rem",
                  padding: "0.125rem 0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                }}>
                  {o.lessee} · {o.msn} · -{`$${shortfallM}m`}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "none",
          border: "none",
          color: "#94A3B8",
          cursor: "pointer",
          padding: "0.125rem",
          lineHeight: 1,
          flexShrink: 0,
          fontSize: "1rem",
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
