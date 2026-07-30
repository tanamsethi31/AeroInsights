// src/app/components/maintenance/RedeliveryRiskTab.tsx
import { useMemo } from "react";
import { Card } from "../ui/Card";
import { mrFlagColor, mrFlagBg, mrFlagBorder } from "../../data/maintenanceHeuristics";
import type { AdjustedLease } from "../../utils/maintenanceEvents";
import { buildProjections, computeMRAdequacy, LEASE_CONTEXT, type ComponentProjection } from "../portfolio/MaintenanceForecastTab";
import { useAllCostOverrides } from "../../hooks/useAllCostOverrides";
import { useAllOrgCostBenchmarks } from "../../hooks/useAllOrgCostBenchmarks";

const CONTEXT_BY_LEASE_ID: Record<string, { msn: string; leaseEnd: string }> = Object.fromEntries(
  Object.entries(LEASE_CONTEXT).map(([msn, ctx]) => [ctx.leaseId, { msn, leaseEnd: ctx.leaseEnd }])
);

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtUSD(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}k`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function worstComponent(projections: ComponentProjection[]): string {
  const worst = [...projections].sort((a, b) => b.eolShortfall - a.eolShortfall)[0];
  return worst && worst.eolShortfall > 0 ? worst.component : "—";
}

interface Props {
  adjustedLeases: AdjustedLease[];
}

export function RedeliveryRiskTab({ adjustedLeases }: Props) {
  const NOW = new Date(2026, 4, 1);

  const { overridesByLeaseId } = useAllCostOverrides();
  const { benchmarksByAircraftType } = useAllOrgCostBenchmarks();

  const rows = useMemo(() => {
    return adjustedLeases
      .map(({ lease, utilOverride }) => {
        const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
        const leaseEndDate = lease.leaseEnd
          ? parseDateLocal(lease.leaseEnd)
          : ctx
          ? parseDateLocal(ctx.leaseEnd)
          : new Date(2028, 0, 1);
        const costOverrides = overridesByLeaseId.get(lease.leaseId);
        const orgBenchmarks = benchmarksByAircraftType.get(lease.aircraft);
        const projections = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride, costOverrides, orgBenchmarks);
        const adequacy = computeMRAdequacy(projections);
        const monthsRemaining = Math.max(0, monthsBetween(NOW, leaseEndDate));
        return {
          leaseId: lease.leaseId,
          lessee: lease.lessee,
          aircraft: lease.aircraft,
          msn: ctx?.msn ?? "—",
          leaseEndDate,
          monthsRemaining,
          adequacy,
          worstComponent: worstComponent(projections),
        };
      })
      .filter(r => r.adequacy.flag !== "green")
      .sort((a, b) => {
        if (a.adequacy.flag !== b.adequacy.flag) return a.adequacy.flag === "red" ? -1 : 1;
        return b.adequacy.eolShortfall - a.adequacy.eolShortfall;
      });
  }, [adjustedLeases, overridesByLeaseId, benchmarksByAircraftType]);

  if (rows.length === 0) {
    return (
      <Card noPadding>
        <div style={{ padding: "2rem", textAlign: "center", color: "#15803D", fontSize: "0.875rem", fontWeight: 500 }}>
          All leases on track to meet their return condition.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Redelivery Risk" subtitle="Leases at risk of missing their return condition, ranked by shortfall" noPadding>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #E2E8F0", background: "#F8FAFC" }}>
            {["Lease", "Aircraft / MSN", "Lease End", "Months Left", "Flag", "Shortfall", "% of Obligation", "Driven By"].map(h => (
              <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.leaseId} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
              <td style={{ padding: "0.625rem 1rem", fontWeight: 600, color: "#0F172A" }}>{r.lessee}</td>
              <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{r.aircraft} · {r.msn}</td>
              <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{r.leaseEndDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</td>
              <td style={{ padding: "0.625rem 1rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{r.monthsRemaining}</td>
              <td style={{ padding: "0.625rem 1rem" }}>
                <span style={{
                  fontSize: "0.6875rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "0.375rem",
                  background: mrFlagBg(r.adequacy.flag), color: mrFlagColor(r.adequacy.flag),
                  border: `1px solid ${mrFlagBorder(r.adequacy.flag)}`,
                }}>
                  {r.adequacy.flag.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: "0.625rem 1rem", fontWeight: 600, color: r.adequacy.eolShortfall > 0 ? "#B91C1C" : "#15803D", fontVariantNumeric: "tabular-nums" }}>
                {fmtUSD(r.adequacy.eolShortfall)}
              </td>
              <td style={{ padding: "0.625rem 1rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{r.adequacy.eolShortfallPct.toFixed(1)}%</td>
              <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{r.worstComponent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
