// src/app/components/maintenance/AircraftBalanceChart.tsx
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { ComponentProjection } from "../portfolio/MaintenanceForecastTab";

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPONENT_COLORS: Record<string, string> = {
  "Airframe HSI": "#3B82F6",
  "Engine PR":    "#F59E0B",
  "LLPs":         "#10B981",
  "Landing Gear": "#8B5CF6",
  "APU":          "#F87171",
};

const NOW = new Date(2026, 4, 1);

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  projections:  ComponentProjection[];
  /** Reserved for future tooltip/display use; chart range is driven by monthsToEOL. */
  leaseEndDate: Date;
  monthsToEOL:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildBalanceSeries(
  projections: ComponentProjection[],
  monthsToEOL: number,
): Record<string, number | string>[] {
  const step = Math.max(1, Math.floor(monthsToEOL / 24));
  const data: Record<string, number | string>[] = [];

  for (let m = 0; m <= monthsToEOL; m += step) {
    const point: Record<string, number | string> = { month: m };
    for (const p of projections) {
      if (m < p.monthsToNextEvent) {
        point[p.component] = p.currentBalance + p.monthlyAccrual * m;
      } else {
        const balAtEvent  = p.currentBalance + p.monthlyAccrual * p.monthsToNextEvent;
        const afterDrop   = Math.max(0, balAtEvent - p.heuristicEventCost);
        const monthsAfter = m - p.monthsToNextEvent;
        point[p.component] = afterDrop + p.monthlyAccrual * monthsAfter;
      }
    }
    data.push(point);
  }
  return data;
}

function monthToLabel(m: number): string {
  if (m === 0) return "Today";
  const d = new Date(NOW);
  d.setMonth(d.getMonth() + m);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function fmtM(v: unknown): string {
  const n = Number(v);
  return isNaN(n) ? "" : `$${(n / 1_000_000).toFixed(1)}M`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AircraftBalanceChart({ projections, monthsToEOL, leaseEndDate: _leaseEndDate }: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(
    () => buildBalanceSeries(projections, monthsToEOL),
    [projections, monthsToEOL],
  );
  // Show ~6 X-axis ticks. Recharts `interval` is 0-based ("every Nth tick"),
  // so subtract 1 from the naive data.length/6 ratio.
  const tickInterval = Math.max(0, Math.floor(data.length / 6) - 1);

  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #E2E8F0",
      borderRadius: "10px", padding: "1.25rem",
    }}>
      <div style={{
        fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8",
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem",
      }}>
        MR Balance Trajectories
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
          <XAxis
            dataKey="month"
            tickFormatter={monthToLabel}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            tickFormatter={fmtM}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            formatter={(value: number, name: string) => [fmtM(value), name]}
            labelFormatter={(m: number) => monthToLabel(m)}
            contentStyle={{
              background: "#FFFFFF", border: "1px solid #E2E8F0",
              borderRadius: "8px", fontSize: "0.8rem",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "0.78rem", paddingTop: "0.5rem" }} />
          <ReferenceLine
            x={monthsToEOL}
            stroke="#F87171"
            strokeDasharray="4 4"
            label={{ value: "EOL", position: "top", fill: "#F87171", fontSize: 11 }}
          />
          {projections.map(p => (
            <Line
              key={p.component}
              type="monotone"
              dataKey={p.component}
              stroke={COMPONENT_COLORS[p.component] ?? "#94A3B8"}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
