import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { type MRCashflowQuarter } from "../../lib/mrChartAdapters";

interface Props {
  data: MRCashflowQuarter[];
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const inflows = payload.find((p) => p.dataKey === "inflows")?.value ?? 0;
  const eventCosts = payload.find((p) => p.dataKey === "eventCosts")?.value ?? 0;
  const net = payload.find((p) => p.dataKey === "netCumulative")?.value ?? 0;

  function fmt(v: number) {
    return `$${(v / 1_000_000).toFixed(1)}m`;
  }

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: "0.75rem",
      padding: "0.625rem 0.875rem",
      fontSize: "0.8125rem",
      lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ color: "#475569" }}>
        <div>Inflows: <span style={{ color: "#002147", fontWeight: 600 }}>{fmt(inflows as number)}</span></div>
        <div>Event Costs: <span style={{ color: "#B91C1C", fontWeight: 600 }}>{fmt(eventCosts as number)}</span></div>
        <div>Cumulative Net: <span style={{ color: (net as number) >= 0 ? "#15803D" : "#B91C1C", fontWeight: 600 }}>{fmt(net as number)}</span></div>
      </div>
    </div>
  );
}

export function MRCashflowChart({ data }: Props) {
  if (data.length === 0) return null;

  // Determine final cumulative net to pick line colour
  const finalNet = data[data.length - 1]?.netCumulative ?? 0;
  const lineColor = finalNet >= 0 ? "#15803D" : "#B91C1C";

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: "0.75rem",
      padding: "1rem",
    }}>
      <div style={{
        fontSize: "0.6875rem",
        fontWeight: 600,
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: "0.75rem",
      }}>
        Aggregate MR Cashflow
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="quarter"
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}m`}
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="net"
            orientation="right"
            tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}m`}
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="square" wrapperStyle={{ fontSize: "0.75rem" }} />
          <Bar
            yAxisId="left"
            dataKey="inflows"
            name="MR Inflows"
            fill="#002147"
            fillOpacity={0.85}
            barSize={10}
          />
          <Bar
            yAxisId="left"
            dataKey="eventCosts"
            name="Event Costs"
            fill="#B91C1C"
            fillOpacity={0.8}
            barSize={10}
          />
          <Line
            yAxisId="net"
            dataKey="netCumulative"
            name="Cumulative Net"
            stroke={lineColor}
            dot={false}
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
