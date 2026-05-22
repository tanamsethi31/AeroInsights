// src/app/components/rate-outlook/PortfolioRateOverlay.tsx
import type { RateOutlookResult, AircraftType } from "../../data/rateOutlookData";

const T = {
  blue: "#002147", text: "#0F172A", muted: "#475569",
  border: "#E2E8F0", bg: "#F8FAFC",
  green: "#15803D", greenBg: "rgba(21,128,61,0.07)",
  amber: "#B45309", amberBg: "rgba(180,83,9,0.07)",
  red: "#B91C1C", redBg: "rgba(185,28,28,0.07)",
} as const;

export interface PortfolioLease {
  lesseeId: string;
  lesseeName: string;
  aircraftType: AircraftType;
  contractedRentUSD: number;
  isDemo?: boolean;
}

function positionBadge(spread: number): { label: string; color: string; bg: string } {
  if (spread >= 20_000)  return { label: "Above Market", color: T.green, bg: T.greenBg };
  if (spread <= -20_000) return { label: "Below Market", color: T.red,   bg: T.redBg   };
  return                        { label: "At Market",    color: T.amber, bg: T.amberBg  };
}

function fmtRent(n: number): string {
  return `$${(n / 1_000).toFixed(0)}k`;
}

interface Props {
  data: RateOutlookResult;
  leases: PortfolioLease[];
  isDemo: boolean;
}

export function PortfolioRateOverlay({ data, leases, isDemo }: Props) {
  const rows = leases.map((lease) => {
    const tf = data.types.find((t) => t.type === lease.aircraftType);
    const marketForecast = tf?.forecast[0]?.rentUSD ?? null;
    const spread = marketForecast !== null ? lease.contractedRentUSD - marketForecast : null;
    const badge = spread !== null ? positionBadge(spread) : null;
    return { ...lease, marketForecast, spread, badge };
  });

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderRadius: "0.75rem",
        overflow: "hidden",
        marginTop: "1.25rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "0.75rem 1.25rem",
          borderBottom: `1px solid ${T.border}`,
          background: T.bg,
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: T.text }}>
          Portfolio Rate Position
        </span>
        {isDemo && (
          <span
            style={{
              fontSize: "0.65rem", fontWeight: 700, padding: "0.1rem 0.45rem",
              borderRadius: "9999px", background: "rgba(0,33,71,0.07)",
              color: T.blue, border: "1px solid rgba(0,33,71,0.15)",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}
          >
            DEMO DATA
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: T.muted }}>
          Contracted rate vs. 1-month-ahead market forecast
        </span>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ background: T.bg }}>
            {["Lessee", "Aircraft", "Contracted Rate", "Market Forecast", "Spread", "Position"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "0.5rem 0.875rem",
                  borderBottom: `1px solid ${T.border}`,
                  textAlign: (h === "Lessee" || h === "Aircraft") ? "left" : "right",
                  fontSize: "0.7rem", fontWeight: 700,
                  color: T.muted, textTransform: "uppercase",
                  letterSpacing: "0.05em", whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.lesseeId} style={{ background: i % 2 === 0 ? "#FFFFFF" : T.bg }}>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, fontWeight: 600, color: T.text }}>
                {row.lesseeName}
              </td>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, color: T.muted }}>
                {row.aircraftType}
              </td>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right", fontWeight: 600, color: T.text }}>
                {fmtRent(row.contractedRentUSD)}/mo
              </td>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right", color: T.muted }}>
                {row.marketForecast !== null ? `${fmtRent(row.marketForecast)}/mo` : "—"}
              </td>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right" }}>
                {row.spread !== null ? (
                  <span style={{ color: row.spread >= 0 ? T.green : T.red, fontWeight: 600 }}>
                    {row.spread >= 0 ? "+" : ""}{fmtRent(row.spread)}
                  </span>
                ) : "—"}
              </td>
              <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right" }}>
                {row.badge && (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.15rem 0.6rem",
                      borderRadius: "9999px",
                      background: row.badge.bg,
                      color: row.badge.color,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                    }}
                  >
                    {row.badge.label}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        style={{
          padding: "0.5rem 0.875rem",
          borderTop: `1px solid ${T.border}`,
          background: T.bg,
          fontSize: "0.72rem",
          color: T.muted,
        }}
      >
        Above Market: contracted ≥ market +$20k. Below Market: contracted ≤ market −$20k.
      </div>
    </div>
  );
}
