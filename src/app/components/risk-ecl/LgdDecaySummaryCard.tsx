// src/app/components/risk-ecl/LgdDecaySummaryCard.tsx
import { Card } from "../ui/Card";
import {
  computeFleetLgdAdjustment,
  computeResidualValuePct,
  computeLgdBenchmark,
  AIRCRAFT_FAMILY_LABELS,
  DEFAULT_BASELINE_LGD,
} from "../../data/lgdCurves";
import { classifyAircraftFamily } from "../../data/aircraftFamilyMap";
import type { Asset, Provision } from "../../types/portfolio";

interface Props {
  assets:               Asset[];
  provisions:           Provision[];
  recoveryFactor:       number;
  isOverridden:         boolean;
  lgdDecayAdjFactor:    number;
  onOpenRecoveryDrawer: () => void;
}

export function LgdDecaySummaryCard({
  assets, provisions, recoveryFactor, isOverridden, lgdDecayAdjFactor, onOpenRecoveryDrawer,
}: Props) {
  const currentYear = new Date().getFullYear();

  // Build per-asset rows sorted by LGD descending
  const rows = assets
    .filter((a) => a.vintage != null)
    .map((a) => {
      const age    = currentYear - a.vintage!;
      const family = classifyAircraftFamily(a.aircraft_type);
      const resid  = computeResidualValuePct(family, age);
      const lgd    = computeLgdBenchmark(family, age, recoveryFactor);
      return { registration: a.registration, aircraftType: a.aircraft_type, family, age, resid, lgd };
    })
    .sort((a, b) => b.lgd - a.lgd);

  // EAD-weighted fleet avg LGD (mirrors what ECL engine sees)
  const { lgdDecayAdjFactor: computedAdj } = computeFleetLgdAdjustment(
    assets, provisions, recoveryFactor, currentYear
  );
  const fleetAvgLgd = computedAdj + DEFAULT_BASELINE_LGD;
  const upliftPp    = (lgdDecayAdjFactor * 100).toFixed(1);

  const th = (label: string, align: "left" | "right" = "right") => (
    <th key={label} style={{
      padding: "0.5rem 0.75rem", textAlign: align, fontWeight: 600,
      color: "#64748B", fontSize: "0.75rem", textTransform: "uppercase",
      letterSpacing: "0.04em", whiteSpace: "nowrap",
    }}>
      {label}
    </th>
  );

  return (
    <Card>
      <div style={{ padding: "1.25rem" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
              Fleet LGD · Decay Curve Benchmarks
            </span>
            {isOverridden && (
              <span style={{ background: "#EDE9FE", color: "#5B21B6", fontWeight: 600, fontSize: "0.75rem", padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>
                Custom RF
              </span>
            )}
          </div>
          <button
            onClick={onOpenRecoveryDrawer}
            style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.3rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500, color: "#475569", cursor: "pointer" }}
          >
            Adjust recovery factor →
          </button>
        </div>

        {rows.length === 0 ? (
          <div style={{ color: "#94A3B8", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
            No asset data with known vintage available.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {th("Registration", "left")}
                  {th("Type", "left")}
                  {th("Family")}
                  {th("Age")}
                  {th("Residual Value %")}
                  {th("LGD Benchmark")}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.registration} style={{
                    borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none",
                    background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                  }}>
                    <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>{row.registration}</td>
                    <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{row.aircraftType}</td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569" }}>{AIRCRAFT_FAMILY_LABELS[row.family]}</td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{row.age} yr</td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{(row.resid * 100).toFixed(1)}%</td>
                    <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600, color: row.lgd > 0.6 ? "#B91C1C" : row.lgd > 0.45 ? "#B45309" : "#15803D", fontVariantNumeric: "tabular-nums" }}>
                      {(row.lgd * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                  <td colSpan={4} style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#475569", fontSize: "0.75rem" }}>
                    FLEET WEIGHTED AVG
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem" }} />
                  <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                    {(fleetAvgLgd * 100).toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Summary chips */}
        {rows.length > 0 && (
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
            <div style={{ background: lgdDecayAdjFactor > 0.1 ? "#FEE2E2" : "#DCFCE7", borderRadius: "9999px", padding: "0.3rem 0.75rem", fontSize: "0.8125rem", fontWeight: 600, color: lgdDecayAdjFactor > 0.1 ? "#B91C1C" : "#15803D" }}>
              ↑ {upliftPp} pp vs. new-fleet baseline
            </div>
            <div style={{ background: "#EFF6FF", borderRadius: "9999px", padding: "0.3rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500, color: "#1D4ED8" }}>
              Applied to scenario ✓
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
