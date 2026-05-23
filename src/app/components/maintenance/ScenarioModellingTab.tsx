// src/app/components/maintenance/ScenarioModellingTab.tsx
import { useState, useMemo } from "react";
import type { AdjustedLease } from "../../utils/maintenanceEvents";
import {
  LEASE_CONTEXT,
  buildProjections,
  type ComponentProjection,
} from "../portfolio/MaintenanceForecastTab";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_FH = 3200;
const DEFAULT_CY = 2100;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function eolColor(shortfall: number): string {
  return shortfall > 0 ? "#B91C1C" : "#15803D";
}

// ── MiniProjectionTable ────────────────────────────────────────────────────────

function MiniProjectionTable({
  title,
  projections,
  highlight = false,
}: {
  title:       string;
  projections: ComponentProjection[];
  highlight?:  boolean;
}) {
  return (
    <div style={{
      background: "#FFFFFF",
      border: `1px solid ${highlight ? "#BFDBFE" : "#E2E8F0"}`,
      borderRadius: "8px",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "0.5rem 0.875rem",
        borderBottom: "1px solid #E2E8F0",
        fontSize: "0.72rem",
        fontWeight: 600,
        color: highlight ? "#1D4ED8" : "#475569",
        background: highlight ? "#EFF6FF" : "#F8FAFC",
      }}>
        {title}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
        <thead>
          <tr>
            {["Component", "Monthly Accrual", "EOL Balance", "EOL Obligation", "EOL Position"].map(h => (
              <th key={h} style={{
                padding: "0.375rem 0.625rem",
                textAlign: "left",
                color: "#64748B",
                fontWeight: 500,
                borderBottom: "1px solid #E2E8F0",
                whiteSpace: "nowrap",
                background: "#F8FAFC",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projections.map(p => (
            <tr key={p.component} style={{ borderBottom: "1px solid #F1F5F9" }}>
              <td style={{ padding: "0.375rem 0.625rem", fontWeight: 500, color: "#0F172A", whiteSpace: "nowrap" }}>
                {p.component}
              </td>
              <td style={{ padding: "0.375rem 0.625rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                {fmtUSD(p.monthlyAccrual)}
              </td>
              <td style={{ padding: "0.375rem 0.625rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                {fmtUSD(p.projectedBalanceAtEOL)}
              </td>
              <td style={{ padding: "0.375rem 0.625rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                {fmtUSD(p.eolObligation)}
              </td>
              <td style={{
                padding: "0.375rem 0.625rem",
                fontWeight: 700,
                color: eolColor(p.eolShortfall),
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}>
                {fmtUSD(Math.abs(p.eolShortfall))}
                <span style={{ fontWeight: 400, fontSize: "0.68rem", marginLeft: "0.25rem", color: "#94A3B8" }}>
                  {p.eolShortfall > 0 ? "short" : "surplus"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── ScenarioModellingTab ───────────────────────────────────────────────────────

export function ScenarioModellingTab({ adjustedLeases }: { adjustedLeases: AdjustedLease[] }) {
  const [fh,         setFh       ] = useState(DEFAULT_FH);
  const [cy,         setCy       ] = useState(DEFAULT_CY);
  const [expanded,   setExpanded ] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const rows = useMemo(() => {
    return adjustedLeases.map(({ lease, utilOverride }) => {
      const entry = Object.entries(LEASE_CONTEXT).find(([, ctx]) => ctx.leaseId === lease.leaseId);
      if (!entry) {
        console.warn(`[ScenarioModellingTab] No LEASE_CONTEXT entry for leaseId ${lease.leaseId}; skipping row`);
        return null;
      }
      const msn = entry[0];
      const ctx = LEASE_CONTEXT[msn];
      const leaseEndStr = ctx.leaseEnd;
      const leaseEndDate = parseDateLocal(leaseEndStr);
      const a = { leaseId: lease.leaseId, msn, lessee: lease.lessee, aircraft: lease.aircraft, leaseEnd: leaseEndStr };

      // Base projection uses servicer report utilization (if available), otherwise heuristic
      const baseProj = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride);
      // Scenario projection uses user-slider FH/CY values
      const scenProj = buildProjections(lease, lease.aircraft, leaseEndDate, {
        annualFH:           fh,
        annualCy:           cy,
        componentRemaining: {},
      });

      const baseEOL = baseProj.reduce((s, p) => s + p.eolShortfall, 0);
      const scenEOL = scenProj.reduce((s, p) => s + p.eolShortfall, 0);
      const delta   = scenEOL - baseEOL; // +ve = scenario worsens shortfall

      return { ...a, lease, leaseEndDate, baseProj, scenProj, baseEOL, scenEOL, delta, utilOverride };
    }).filter((row): row is NonNullable<typeof row> => row !== null);
  }, [adjustedLeases, fh, cy]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1.5rem" }}>

      {/* ── Scenario controls ─────────────────────────────────────────── */}
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0",
        borderRadius: "10px", padding: "1.25rem 1.5rem",
        display: "flex", flexWrap: "wrap", gap: "2rem", alignItems: "flex-end",
      }}>
        {/* FH slider */}
        <div>
          <div style={{
            fontSize: "0.6875rem", fontWeight: 600, color: "#64748B",
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem",
          }}>
            Annual Flight Hours
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <input
              type="range" min={1500} max={4500} step={100}
              value={fh}
              onChange={e => setFh(Number(e.target.value))}
              style={{ width: "180px" }}
            />
            <span style={{
              padding: "0.2rem 0.625rem",
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600, color: "#1D4ED8",
              whiteSpace: "nowrap",
            }}>
              {fh.toLocaleString()} FH
            </span>
          </div>
        </div>

        {/* Cycles slider */}
        <div>
          <div style={{
            fontSize: "0.6875rem", fontWeight: 600, color: "#64748B",
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem",
          }}>
            Annual Cycles
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <input
              type="range" min={1000} max={3500} step={50}
              value={cy}
              onChange={e => setCy(Number(e.target.value))}
              style={{ width: "180px" }}
            />
            <span style={{
              padding: "0.2rem 0.625rem",
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600, color: "#1D4ED8",
              whiteSpace: "nowrap",
            }}>
              {cy.toLocaleString()} cy
            </span>
          </div>
        </div>

        {/* Reset button */}
        <button
          onClick={() => { setFh(DEFAULT_FH); setCy(DEFAULT_CY); setExpanded(null); }}
          style={{
            padding: "0.375rem 0.875rem",
            background: "transparent", border: "1px solid #E2E8F0",
            borderRadius: "6px", fontSize: "0.78rem", color: "#64748B",
            cursor: "pointer",
          }}
        >
          Reset to heuristic defaults
        </button>
      </div>

      {/* ── Portfolio impact table ────────────────────────────────────── */}
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0",
        borderRadius: "10px", overflow: "hidden",
      }}>
        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,2fr) 100px 130px 130px 130px 32px",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          background: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
          fontSize: "0.7rem",
          fontWeight: 600,
          color: "#64748B",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}>
          <span>Aircraft / Lessee</span>
          <span>Lease End</span>
          <span style={{ textAlign: "right" }}>Base EOL</span>
          <span style={{ textAlign: "right" }}>Scenario EOL</span>
          <span style={{ textAlign: "right" }}>Δ Delta</span>
          <span />
        </div>

        {/* Rows */}
        {rows.map(row => {
          const isExpanded = expanded === row.leaseId;
          const deltaColor = Math.abs(row.delta) < 5_000
            ? "#94A3B8"
            : row.delta > 0 ? "#B91C1C" : "#15803D";
          const deltaSign = row.delta > 0 ? "+" : "";

          return (
            <div key={row.leaseId}>
              {/* Main row */}
              <div
                onClick={() => setExpanded(isExpanded ? null : row.leaseId)}
                onMouseEnter={() => setHoveredRow(row.leaseId)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,2fr) 100px 130px 130px 130px 32px",
                  gap: "0.5rem",
                  padding: "0.75rem 1rem",
                  borderBottom: "1px solid #F1F5F9",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  background: isExpanded ? "#EFF6FF" : hoveredRow === row.leaseId ? "#F8FAFC" : "transparent",
                  alignItems: "center",
                  transition: "background 100ms",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#0F172A" }}>{row.lessee}</div>
                  <div style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                    {row.aircraft} · MSN {row.msn}
                  </div>
                </div>

                <span style={{ color: "#475569", fontSize: "0.78rem" }}>
                  {parseDateLocal(row.leaseEnd).toLocaleDateString("en-GB", {
                    month: "short", year: "numeric",
                  })}
                </span>

                <span style={{
                  textAlign: "right", fontWeight: 600,
                  color: eolColor(row.baseEOL), fontVariantNumeric: "tabular-nums",
                }}>
                  {fmtUSD(Math.abs(row.baseEOL))}
                  <span style={{ fontWeight: 400, fontSize: "0.68rem", marginLeft: "0.25rem", color: "#94A3B8" }}>
                    {row.baseEOL > 0 ? "short" : "surplus"}
                  </span>
                </span>

                <span style={{
                  textAlign: "right", fontWeight: 600,
                  color: eolColor(row.scenEOL), fontVariantNumeric: "tabular-nums",
                }}>
                  {fmtUSD(Math.abs(row.scenEOL))}
                  <span style={{ fontWeight: 400, fontSize: "0.68rem", marginLeft: "0.25rem", color: "#94A3B8" }}>
                    {row.scenEOL > 0 ? "short" : "surplus"}
                  </span>
                </span>

                <span style={{
                  textAlign: "right", fontWeight: 700,
                  color: deltaColor, fontVariantNumeric: "tabular-nums",
                }}>
                  {deltaSign}{fmtUSD(Math.abs(row.delta))}
                </span>

                <span style={{ textAlign: "center", color: "#94A3B8", fontSize: "0.9rem" }}>
                  {isExpanded ? "▴" : "▾"}
                </span>
              </div>

              {/* Per-aircraft drilldown */}
              {isExpanded && (
                <div style={{
                  borderBottom: "1px solid #E2E8F0",
                  padding: "1rem",
                  background: "#F8FAFC",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}>
                  <MiniProjectionTable
                    title={row.utilOverride ? "Base (Servicer Report)" : "Base (Heuristic)"}
                    projections={row.baseProj}
                  />
                  <MiniProjectionTable
                    title={`Scenario (${fh.toLocaleString()} FH / ${cy.toLocaleString()} cy)`}
                    projections={row.scenProj}
                    highlight
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
