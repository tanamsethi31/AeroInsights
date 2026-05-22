// src/app/components/rate-outlook/RateOutlookChart.tsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from "recharts";
import type { RateOutlookResult } from "../../data/rateOutlookData";

const T = {
  blue: "#002147", text: "#0F172A", muted: "#475569",
  border: "#E2E8F0", bg: "#F8FAFC",
} as const;

function fmtRentK(n: number): string {
  return `$${(n / 1_000).toFixed(0)}k`;
}

function monthLabel(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

interface Props {
  data: RateOutlookResult;
  selectedType: string;
  contractedRent?: number | null;
  onBack: () => void;
}

export function RateOutlookChart({ data, selectedType, contractedRent, onBack }: Props) {
  const tf = data.types.find((t) => t.type === selectedType);
  if (!tf) return null;

  // Build chart data: month 0 (current) + months 1–12
  const chartData = [
    {
      label: monthLabel(0),
      rent: tf.current.rentUSD,
      p25: tf.current.p25,
      p75: tf.current.p75,
    },
    ...tf.forecast.map((f) => ({
      label: monthLabel(f.month),
      rent: f.rentUSD,
      p25: f.p25,
      p75: f.p75,
    })),
  ];

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "0.875rem 1.25rem",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "0.8125rem", color: T.muted, fontWeight: 500,
            padding: 0,
          }}
        >
          ← Back to Grid
        </button>
        <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: T.text }}>
          {selectedType} — 12-Month Rate Forecast
        </div>
        <div
          style={{
            marginLeft: "auto", fontSize: "0.75rem", color: T.muted,
            display: "flex", gap: "1.25rem",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ display: "inline-block", width: 16, height: 2, background: T.blue }} />
            Forecast
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ display: "inline-block", width: 16, height: 2, background: T.blue, opacity: 0.25 }} />
            P25–P75 band
          </span>
          {contractedRent != null && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ display: "inline-block", width: 16, height: 2, borderTop: "2px dashed #B45309" }} />
              Contracted rate
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: "1rem 0.5rem 0.5rem" }}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: T.muted }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={fmtRentK}
              tick={{ fontSize: 11, fill: T.muted }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              formatter={(v: number, name: string) => [
                fmtRentK(v),
                name === "rent" ? "Forecast" : name === "p25" ? "P25" : "P75",
              ]}
              contentStyle={{
                fontSize: "0.78rem",
                border: `1px solid ${T.border}`,
                borderRadius: "0.375rem",
              }}
            />
            {/* Confidence band */}
            <Area
              type="monotone"
              dataKey="p75"
              stroke="none"
              fill={T.blue}
              fillOpacity={0.08}
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="p25"
              stroke="none"
              fill="#FFFFFF"
              fillOpacity={1}
              legendType="none"
            />
            {/* Forecast line */}
            <Line
              type="monotone"
              dataKey="rent"
              stroke={T.blue}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: T.blue }}
            />
            {/* Contracted rate reference line */}
            {contractedRent != null && (
              <ReferenceLine
                y={contractedRent}
                stroke="#B45309"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: `Contracted: ${fmtRentK(contractedRent)}`,
                  fontSize: 11,
                  fill: "#B45309",
                  position: "insideTopRight",
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          padding: "0.5rem 1.25rem 0.75rem",
          fontSize: "0.72rem",
          color: T.muted,
        }}
      >
        Confidence band: ±7% (P25–P75 market bid-ask spread). Base: mid-market at age 3.
      </div>
    </div>
  );
}
