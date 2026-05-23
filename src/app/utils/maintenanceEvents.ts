// src/app/utils/maintenanceEvents.ts
import type { LeaseSDMR } from "../components/portfolio/SDMRTab";
import type { ServicerReport } from "../hooks/useServicerReport";
import type { UtilOverride } from "../components/portfolio/MaintenanceForecastTab";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComponentImpact {
  component:           string;
  costPaidUSD:         number;
  remainingUnitsAfter: number | null;
}

export interface MaintenanceEvent {
  id:               string;
  leaseId:          string;
  eventDate:        string;   // "YYYY-MM-DD"
  eventType:        "shop_visit" | "aog" | "llp_replacement" | "supplemental_claim" | "note";
  notes:            string | null;
  componentImpacts: ComponentImpact[];
}

export interface AdjustedLease {
  lease:        LeaseSDMR;
  utilOverride: UtilOverride | undefined;
}

// ── Pure functions ────────────────────────────────────────────────────────────

/**
 * Applies a servicer report to a lease:
 * - Updates mrComponents[].remainingUnits for components in componentOverrides
 * - Returns a UtilOverride carrying annualFH/annualCy (with empty componentRemaining
 *   because remainingUnits are already baked into the returned lease)
 */
export function applyServicerReport(
  lease:  LeaseSDMR,
  report: ServicerReport,
): AdjustedLease {
  const updatedComponents = lease.mrComponents.map(comp => {
    const override = report.componentOverrides[comp.component];
    return override !== undefined ? { ...comp, remainingUnits: override } : comp;
  });

  return {
    lease: { ...lease, mrComponents: updatedComponents },
    utilOverride: {
      annualFH:           report.annualFH,
      annualCy:           report.annualCy,
      componentRemaining: {},  // already baked into remainingUnits above
    },
  };
}

/**
 * Applies maintenance events to a lease:
 * - Subtracts costPaidUSD from cumulativeBalance per component
 * - Sets remainingUnits to the most recent non-null remainingUnitsAfter
 * Events are applied oldest-to-newest regardless of input order.
 */
export function applyEvents(
  lease:  LeaseSDMR,
  events: MaintenanceEvent[],
): LeaseSDMR {
  if (events.length === 0) return lease;

  const sorted = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const updatedComponents = lease.mrComponents.map(comp => {
    let balance   = comp.cumulativeBalance;
    let remaining = comp.remainingUnits;

    for (const evt of sorted) {
      for (const impact of evt.componentImpacts) {
        if (impact.component === comp.component) {
          balance -= impact.costPaidUSD;
          if (impact.remainingUnitsAfter !== null) {
            remaining = impact.remainingUnitsAfter;
          }
        }
      }
    }

    return { ...comp, cumulativeBalance: balance, remainingUnits: remaining };
  });

  return { ...lease, mrComponents: updatedComponents };
}

/**
 * Composes applyServicerReport + applyEvents.
 * Servicer report is applied first (sets baseline utilization + remaining units),
 * then events are applied on top (drawdowns and resets from subsequent events).
 */
export function adjustedLease(
  raw:    LeaseSDMR,
  report: ServicerReport | null,
  events: MaintenanceEvent[],
): AdjustedLease {
  const afterReport: AdjustedLease = report
    ? applyServicerReport(raw, report)
    : { lease: raw, utilOverride: undefined };

  return {
    lease:        applyEvents(afterReport.lease, events),
    utilOverride: afterReport.utilOverride,
  };
}

// ── Row mapper (used by hooks) ────────────────────────────────────────────────

export function mapEventRow(row: Record<string, unknown>): MaintenanceEvent {
  return {
    id:               row.id as string,
    leaseId:          row.lease_id as string,
    eventDate:        row.event_date as string,
    eventType:        row.event_type as MaintenanceEvent["eventType"],
    notes:            (row.notes as string | null) ?? null,
    componentImpacts: (row.component_impacts as ComponentImpact[]) ?? [],
  };
}
