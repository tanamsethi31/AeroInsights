// src/app/components/rate-outlook/RateOutlookGrid.tsx
import type { AircraftCategory, RateOutlookResult, TypeForecast } from "../../data/rateOutlookData";

const T = {
  blue: "#002147", text: "#0F172A", muted: "#475569",
  border: "#E2E8F0", bg: "#F8FAFC",
  green: "#15803D", greenBg: "rgba(21,128,61,0.07)",
  amber: "#B45309", amberBg: "rgba(180,83,9,0.07)",
  red: "#B91C1C", redBg: "rgba(185,28,28,0.07)",
} as const;

function fmtRent(n: number): string {
  return `$${(n / 1_000).toFixed(0)}k`;
}

function TrendBadge({ pct }: { pct: number }) {
  const color = pct >= 1 ? T.green : pct <= -1 ? T.red : T.amber;
  const bg    = pct >= 1 ? T.greenBg : pct <= -1 ? T.redBg : T.amberBg;
  const arrow = pct >= 0.5 ? "▲" : pct <= -0.5 ? "▼" : "—";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.2rem",
        padding: "0.15rem 0.45rem", borderRadius: "9999px",
        background: bg, color, fontSize: "0.72rem", fontWeight: 600,
      }}
    >
      {arrow} {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const barW = Math.floor(w / values.length) - 1;

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {values.map((v, i) => {
        const barH = Math.max(2, ((v - min) / range) * (h - 4));
        return (
          <rect
            key={i}
            x={i * (barW + 1)}
            y={h - barH}
            width={barW}
            height={barH}
            fill={T.blue}
            opacity={0.5 + 0.5 * ((v - min) / range)}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

interface Props {
  data: RateOutlookResult;
  categoryFilter: AircraftCategory | "All";
  onSelectType: (type: string) => void;
}

export function RateOutlookGrid({ data, categoryFilter, onSelectType }: Props) {
  const rows = data.types.filter(
    (t) => categoryFilter === "All" || t.category === categoryFilter,
  );

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: "820px",
            borderCollapse: "collapse",
            fontSize: "0.8125rem",
          }}
        >
          <thead>
            <tr style={{ background: T.bg }}>
              {[
                { label: "Type",          align: "left"   },
                { label: "Category",      align: "left"   },
                { label: "Current Rent",  align: "right"  },
                { label: "LRF",           align: "right"  },
                { label: "12-mo Outlook", align: "right"  },
                { label: "Sparkline",     align: "center" },
              ].map((h) => (
                <th
                  key={h.label}
                  style={{
                    padding: "0.625rem 0.875rem",
                    borderBottom: `1px solid ${T.border}`,
                    textAlign: h.align as "left" | "right" | "center",
                    fontSize: "0.7rem", fontWeight: 700,
                    color: T.muted, textTransform: "uppercase",
                    letterSpacing: "0.05em", whiteSpace: "nowrap",
                  }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((tf: TypeForecast, i) => (
              <tr
                key={tf.type}
                onClick={() => onSelectType(tf.type)}
                style={{
                  background: i % 2 === 0 ? "#FFFFFF" : T.bg,
                  cursor: "pointer",
                  transition: "background 100ms ease-out",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,33,71,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#FFFFFF" : T.bg)}
              >
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, fontWeight: 600, color: T.text }}>
                  {tf.type}
                </td>
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, color: T.muted }}>
                  {tf.category}
                </td>
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right", fontWeight: 600, color: T.text }}>
                  {fmtRent(tf.current.rentUSD)}<span style={{ fontSize: "0.72rem", color: T.muted, fontWeight: 400 }}>/mo</span>
                </td>
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right", color: T.muted }}>
                  {tf.current.lrf.toFixed(2)}%
                </td>
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "right" }}>
                  <TrendBadge pct={tf.outlookPct} />
                </td>
                <td style={{ padding: "0.625rem 0.875rem", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
                  <Sparkline values={tf.sparkline} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          padding: "0.5rem 0.875rem",
          borderTop: `1px solid ${T.border}`,
          background: T.bg,
          fontSize: "0.72rem",
          color: T.muted,
        }}
      >
        Base rents: mid-market at age 3. LRF = monthly rent ÷ half-life base value. Click any row to open chart view.
      </div>
    </div>
  );
}
