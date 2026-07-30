import { buildProjections, LEASE_CONTEXT, computeMRAdequacy } from "../components/portfolio/MaintenanceForecastTab";
import { type LeaseSDMR } from "../components/portfolio/SDMRTab";
import { mrFlagColor } from "../data/maintenanceHeuristics";
import type { CostOverride } from "../hooks/useCostOverrides";
import type { OrgCostBenchmark } from "../hooks/useOrgCostBenchmarks";

export interface MRCashflowQuarter {
  quarter: string;       // "Q2 2026"
  inflows: number;       // total MR accruals collected this quarter ($)
  eventCosts: number;    // total projected maintenance event costs due this quarter ($)
  netCumulative: number; // running cumulative (inflows − eventCosts) from Q2 2026 ($)
}

export interface MREventQuarter {
  quarter: string;
  // One key per leaseId present in that quarter's events
  [leaseId: string]: number | string; // number = event cost for that lease; string = quarter label
  total: number;         // sum of all event costs this quarter
}

export interface MRChartData {
  cashflow: MRCashflowQuarter[];
  events: MREventQuarter[];
  leaseIds: string[];    // ordered list of leaseIds (for chart keys)
  leaseColors: Record<string, string>; // leaseId → flag colour
}

const NOW = new Date(2026, 4, 1); // May 2026 — app reference date

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function quarterLabel(date: Date): string {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `Q${q} ${date.getFullYear()}`;
}

function quarterOrdinal(q: string): number {
  // "Q2 2026" → 2026 * 4 + 1  (0-indexed quarter within the full timeline)
  const [qPart, yearStr] = q.split(" ");
  const quarter = parseInt(qPart.slice(1), 10); // 1–4
  const year = parseInt(yearStr, 10);
  return year * 4 + (quarter - 1);
}

function quartersFrom(start: Date, end: Date): string[] {
  const quarters: string[] = [];
  const cur = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
  while (cur <= end) {
    quarters.push(quarterLabel(cur));
    cur.setMonth(cur.getMonth() + 3);
  }
  return quarters;
}

const CONTEXT_BY_LEASE_ID: Record<string, { msn: string; leaseEnd: string }> =
  Object.fromEntries(
    Object.entries(LEASE_CONTEXT).map(([msn, ctx]) => [
      ctx.leaseId,
      { msn, leaseEnd: ctx.leaseEnd },
    ])
  );

export function toMRChartData(
  sdmrData: LeaseSDMR[],
  overridesByLeaseId?: Map<string, Record<string, CostOverride>>,
  benchmarksByAircraftType?: Map<string, Record<string, OrgCostBenchmark>>,
): MRChartData {
  if (sdmrData.length === 0) {
    return { cashflow: [], events: [], leaseIds: [], leaseColors: {} };
  }

  // Find furthest lease end date across all leases
  const leaseEnds = sdmrData.map((lease) => {
    const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
    return lease.leaseEnd
      ? parseDateLocal(lease.leaseEnd)
      : ctx
      ? parseDateLocal(ctx.leaseEnd)
      : new Date(2028, 0, 1);
  });
  const maxEnd = leaseEnds.reduce((a, b) => (b > a ? b : a), NOW);

  const allQuarters = quartersFrom(NOW, maxEnd);

  type LeaseRow = {
    leaseId: string;
    projections: ReturnType<typeof buildProjections>;
    leaseEndDate: Date;
    overallFlag: "red" | "amber" | "green";
  };

  const leaseRows: LeaseRow[] = sdmrData.map((lease, i) => {
    const leaseEndDate = leaseEnds[i];
    const costOverrides = overridesByLeaseId?.get(lease.leaseId);
    const orgBenchmarks = benchmarksByAircraftType?.get(lease.aircraft);
    const projections = buildProjections(lease, lease.aircraft, leaseEndDate, undefined, costOverrides, orgBenchmarks);
    const overallFlag = computeMRAdequacy(projections).flag;
    return { leaseId: lease.leaseId, projections, leaseEndDate, overallFlag };
  });

  const leaseColors: Record<string, string> = Object.fromEntries(
    leaseRows.map((r) => [r.leaseId, mrFlagColor(r.overallFlag)])
  );
  const leaseIds = leaseRows.map((r) => r.leaseId);

  // Build quarterly maps
  const inflowMap: Record<string, number> = {};
  const eventMap: Record<string, Record<string, number>> = {};
  allQuarters.forEach((q) => {
    inflowMap[q] = 0;
    eventMap[q] = {};
  });

  leaseRows.forEach(({ leaseId, projections, leaseEndDate }) => {
    const leaseEndQ = quarterLabel(leaseEndDate);
    projections.forEach((p) => {
      // Inflows: monthly accrual × 3 months per quarter, for every quarter until EOL
      allQuarters.forEach((q) => {
        if (quarterOrdinal(q) <= quarterOrdinal(leaseEndQ)) {
          inflowMap[q] = (inflowMap[q] ?? 0) + p.monthlyAccrual * 3;
        }
      });

      // Event costs: one event per component at nextEventDate
      if (p.nextEventDate >= NOW) {
        const eventQ = quarterLabel(p.nextEventDate);
        if (eventMap[eventQ]) {
          eventMap[eventQ][leaseId] =
            (eventMap[eventQ][leaseId] ?? 0) + p.heuristicEventCost;
        }
      }
    });
  });

  // Build cashflow array with cumulative net
  let cumulative = 0;
  const cashflow: MRCashflowQuarter[] = allQuarters.map((quarter) => {
    const inflows = inflowMap[quarter] ?? 0;
    const eventCosts = Object.values(eventMap[quarter] ?? {}).reduce(
      (s, v) => s + v,
      0
    );
    cumulative += inflows - eventCosts;
    return { quarter, inflows, eventCosts, netCumulative: cumulative };
  });

  // Build events array
  const events: MREventQuarter[] = allQuarters.map((quarter) => {
    const row: MREventQuarter = { quarter, total: 0 };
    leaseIds.forEach((id) => {
      const cost = eventMap[quarter]?.[id] ?? 0;
      row[id] = cost;
      row.total += cost;
    });
    return row;
  });

  return { cashflow, events, leaseIds, leaseColors };
}
