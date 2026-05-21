import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { type MREventQuarter } from "../../lib/mrChartAdapters";

interface Props {
  data: MREventQuarter[];
  leaseIds: string[];
  leaseColors: Record<string, string>;
  leaseLessees: Record<string, string>; // leaseId → lessee name for tooltip
}

interface EventTooltipProps extends TooltipProps<number, string> {
  leaseIds: string[];
  leaseColors: Record<string, string>;
  leaseLessees: Record<string, string>;
}

function CustomTooltip({
  active,
  payload,
  label,
  leaseIds,
  leaseColors,
  leaseLessees,
}: EventTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const quarter = label as string;
  const entries = leaseIds
    .map((id) => {
      const cost = payload.find((p) => p.dataKey === id)?.value ?? 0;
      return { id, cost: cost as number };
    })
    .filter((e) => e.cost > 0);

  if (entries.length === 0) return null;

  const total = entries.reduce((s, e) => s + e.cost, 0);

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: "0.75rem",
      padding: "0.625rem 0.875rem",
      fontSize: "0.8125rem",
      lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: "0.25rem" }}>{quarter}</div>
      {entries.map(({ id, cost }) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: leaseColors[id], flexShrink: 0 }} />
          <span style={{ color: "#475569" }}>
            {leaseLessees[id] ?? id}:{" "}
            <span style={{ fontWeight: 600, color: "#0F172A" }}>
              ${(cost / 1_000_000).toFixed(1)}m
            </span>
          </span>
        </div>
      ))}
      <div style={{ borderTop: "1px solid #F1F5F9", marginTop: "0.375rem", paddingTop: "0.375rem", fontWeight: 600, color: "#0F172A" }}>
        Total: ${(total / 1_000_000).toFixed(1)}m
      </div>
    </div>
  );
}

export function MREventCalendar({ data, leaseIds, leaseColors, leaseLessees }: Props) {
  if (data.length === 0) return null;

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
        Event Cost Concentration by Quarter
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="quarter"
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}m`}
            tick={{ fontSize: 10, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={
              <CustomTooltip
                leaseIds={leaseIds}
                leaseColors={leaseColors}
                leaseLessees={leaseLessees}
              />
            }
          />
          {leaseIds.map((id) => (
            <Bar
              key={id}
              dataKey={id}
              stackId="events"
              fill={leaseColors[id]}
              name={leaseLessees[id] ?? id}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
