// src/app/components/rate-outlook/RateOutlookKPIStrip.tsx
import type { RateOutlookResult } from "../../data/rateOutlookData";

const T = {
  blue: "#002147", text: "#0F172A", muted: "#475569",
  border: "#E2E8F0", bg: "#F8FAFC", green: "#15803D",
  greenBg: "rgba(21,128,61,0.07)", amber: "#B45309",
  amberBg: "rgba(180,83,9,0.07)",
} as const;

interface Props {
  data: RateOutlookResult;
}

export function RateOutlookKPIStrip({ data }: Props) {
  const nbTypes = data.types.filter((t) => t.category !== "Widebody");
  const wbTypes = data.types.filter((t) => t.category === "Widebody");

  const avgLrfNB = nbTypes.reduce((s, t) => s + t.current.lrf, 0) / nbTypes.length;
  const avgLrfWB = wbTypes.reduce((s, t) => s + t.current.lrf, 0) / wbTypes.length;

  const nbOutlook = nbTypes.reduce((s, t) => s + t.outlookPct, 0) / nbTypes.length;
  const wbOutlook = wbTypes.reduce((s, t) => s + t.outlookPct, 0) / wbTypes.length;

  const kpis = [
    {
      label: "Avg LRF — Narrowbody",
      value: `${avgLrfNB.toFixed(2)}%`,
      sub: "Monthly rent ÷ half-life value",
      color: T.text, bg: T.bg,
    },
    {
      label: "Avg LRF — Widebody",
      value: `${avgLrfWB.toFixed(2)}%`,
      sub: "Monthly rent ÷ half-life value",
      color: T.text, bg: T.bg,
    },
    {
      label: "12-mo NB Outlook",
      value: `${nbOutlook >= 0 ? "+" : ""}${nbOutlook.toFixed(1)}%`,
      sub: "Expected change in NB rents",
      color: nbOutlook >= 0 ? T.green : "#B91C1C",
      bg: nbOutlook >= 0 ? T.greenBg : "rgba(185,28,28,0.07)",
    },
    {
      label: "12-mo WB Outlook",
      value: `${wbOutlook >= 0 ? "+" : ""}${wbOutlook.toFixed(1)}%`,
      sub: "Expected change in WB rents",
      color: wbOutlook >= 0 ? T.green : "#B91C1C",
      bg: wbOutlook >= 0 ? T.greenBg : "rgba(185,28,28,0.07)",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "1rem",
        marginBottom: "1.25rem",
      }}
    >
      {kpis.map((k) => (
        <div
          key={k.label}
          style={{
            background: k.bg,
            border: `1px solid ${T.border}`,
            borderRadius: "0.625rem",
            padding: "0.875rem 1.125rem",
          }}
        >
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: k.color,
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            {k.value}
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: T.text, marginTop: "0.3rem" }}>
            {k.label}
          </div>
          <div style={{ fontSize: "0.72rem", color: T.muted, marginTop: "0.1rem" }}>
            {k.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
