// src/app/components/maintenance/AircraftDetailTab.tsx
import { useState, useMemo } from "react";
import {
  LEASE_CONTEXT,
  buildProjections,
  MaintenanceForecastTab,
} from "../portfolio/MaintenanceForecastTab";
import { AircraftBalanceChart } from "./AircraftBalanceChart";
import { useMaintenanceEvents } from "../../hooks/useMaintenanceEvents";
import { MaintenanceEventLog } from "./MaintenanceEventLog";
import type { AdjustedLease, MaintenanceEvent } from "../../utils/maintenanceEvents";
import { useCostOverrides } from "../../hooks/useCostOverrides";
import { useOrgCostBenchmarks } from "../../hooks/useOrgCostBenchmarks";

// ── Constants ─────────────────────────────────────────────────────────────────

const NOW = new Date(2026, 4, 1);

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthsBetween(a: Date, b: Date): number {
  return (
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AircraftDetailTab({
  adjustedLeases,
  eventsMap,
}: {
  adjustedLeases: AdjustedLease[];
  eventsMap:      Map<string, MaintenanceEvent[]>;
}) {
  // Build aircraft list from adjustedLeases (replaces static AIRCRAFT_LIST derived from sdmrData)
  const aircraftList = useMemo(() => adjustedLeases.map(({ lease, utilOverride }) => {
    const entry = Object.entries(LEASE_CONTEXT).find(([, ctx]) => ctx.leaseId === lease.leaseId);
    const msn = entry?.[0] ?? "—";
    const ctx = entry ? LEASE_CONTEXT[entry[0]] : null;
    return {
      leaseId:     lease.leaseId,
      msn,
      lessee:      lease.lessee,
      aircraft:    lease.aircraft,
      leaseEnd:    lease.leaseEnd ?? ctx?.leaseEnd ?? "2030-01-01",
      lease,
      utilOverride,
    };
  }), [adjustedLeases]);

  const [selectedLeaseId, setSelectedLeaseId] = useState(
    () => aircraftList[0]?.leaseId ?? "",
  );

  const selected      = aircraftList.find(a => a.leaseId === selectedLeaseId) ?? aircraftList[0];
  const selectedLease = selected?.lease;

  const { overrides: costOverrides } = useCostOverrides(selected?.leaseId ?? null);
  const { benchmarks: orgBenchmarks } = useOrgCostBenchmarks(selected?.aircraft ?? null);

  // Hook must be called unconditionally (Rules of Hooks); null-safety checked after.
  const derived = useMemo(() => {
    if (!selected || !selectedLease) return null;
    const end = parseDateLocal(selected.leaseEnd);
    return {
      projections:  buildProjections(selectedLease, selectedLease.aircraft, end, selected.utilOverride, costOverrides, orgBenchmarks),
      leaseEndDate: end,
      monthsToEOL:  Math.max(0, monthsBetween(NOW, end)),
    };
  }, [selected, selectedLease, costOverrides, orgBenchmarks]);

  const { events, saving, logEvent, deleteEvent } = useMaintenanceEvents(selected?.leaseId ?? null);

  if (!selected || !selectedLease || !derived) return null;

  const { projections, leaseEndDate, monthsToEOL } = derived;

  // eventsMap is available for future use (e.g. portfolio-level views)
  void eventsMap;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1.5rem" }}>

      {/* ── Aircraft selector ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {aircraftList.map(a => {
          const isActive = a.leaseId === selectedLeaseId;
          return (
            <button
              key={a.leaseId}
              onClick={() => setSelectedLeaseId(a.leaseId)}
              style={{
                padding:      "0.375rem 0.875rem",
                background:   isActive ? "#002147" : "#F1F5F9",
                color:        isActive ? "#FFFFFF"  : "#475569",
                border:       `1px solid ${isActive ? "#002147" : "#E2E8F0"}`,
                borderRadius: "999px",
                fontSize:     "0.8rem",
                fontWeight:   isActive ? 600 : 400,
                cursor:       "pointer",
                whiteSpace:   "nowrap",
              }}
            >
              {a.lessee} — {a.aircraft}
              <span style={{ marginLeft: "0.375rem", fontSize: "0.7rem", opacity: 0.7 }}>
                MSN {a.msn}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Balance curves chart ──────────────────────────────────────── */}
      <AircraftBalanceChart
        projections={projections}
        leaseEndDate={leaseEndDate}
        monthsToEOL={monthsToEOL}
      />

      {/* ── Full projection table via MaintenanceForecastTab ─────────── */}
      <MaintenanceForecastTab
        msn={selected.msn}
        aircraftType={selectedLease.aircraft}
        vintage={2020}
        liveRecord={selectedLease}
      />

      {/* ── Maintenance Event Log ──────────────────────────────────────────────── */}
      <MaintenanceEventLog
        events={events}
        saving={saving}
        logEvent={logEvent}
        deleteEvent={deleteEvent}
        leaseId={selected.leaseId}
      />
    </div>
  );
}
