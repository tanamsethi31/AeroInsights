// src/app/components/maintenance/AircraftDetailTab.tsx
import { useState, useMemo } from "react";
import { sdmrData } from "../portfolio/SDMRTab";
import {
  LEASE_CONTEXT,
  buildProjections,
  MaintenanceForecastTab,
} from "../portfolio/MaintenanceForecastTab";
import { AircraftBalanceChart } from "./AircraftBalanceChart";

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

// ── Static aircraft list (derived once at module load) ────────────────────────

interface AircraftEntry {
  leaseId:  string;
  msn:      string;
  lessee:   string;
  aircraft: string;
  leaseEnd: string;
}

const AIRCRAFT_LIST: AircraftEntry[] = sdmrData.map(lease => {
  const entry = Object.entries(LEASE_CONTEXT).find(
    ([, ctx]) => ctx.leaseId === lease.leaseId,
  );
  const msn = entry?.[0] ?? "";
  const ctx = msn ? LEASE_CONTEXT[msn] : null;
  return {
    leaseId:  lease.leaseId,
    msn,
    lessee:   lease.lessee,
    aircraft: lease.aircraft,
    leaseEnd: ctx?.leaseEnd ?? "2030-01-01",
  };
});

// ── Component ─────────────────────────────────────────────────────────────────

export function AircraftDetailTab() {
  const [selectedLeaseId, setSelectedLeaseId] = useState(AIRCRAFT_LIST[0].leaseId);

  const selected      = AIRCRAFT_LIST.find(a => a.leaseId === selectedLeaseId)!;
  const selectedLease = sdmrData.find(l => l.leaseId === selectedLeaseId)!;
  const leaseEndDate  = parseDateLocal(selected.leaseEnd);
  const monthsToEOL   = Math.max(0, monthsBetween(NOW, leaseEndDate));

  const projections = useMemo(
    () => buildProjections(selectedLease, selectedLease.aircraft, leaseEndDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedLeaseId],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1.5rem" }}>

      {/* ── Aircraft selector ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {AIRCRAFT_LIST.map(a => {
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
      />
    </div>
  );
}
