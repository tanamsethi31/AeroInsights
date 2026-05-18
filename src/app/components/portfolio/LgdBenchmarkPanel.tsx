// src/app/components/portfolio/LgdBenchmarkPanel.tsx
import {
  computeResidualValuePct,
  computeLgdBenchmark,
  AIRCRAFT_FAMILY_LABELS,
  DEFAULT_RECOVERY_FACTOR,
  DEFAULT_RESIDUAL_CURVES,
} from "../../data/lgdCurves";
import { classifyAircraftFamily } from "../../data/aircraftFamilyMap";

interface Props {
  assetId:             string;
  aircraftType:        string;
  vintage:             number | null;
  manualLgd:           number | null; // Provision.lgd for this asset
  recoveryFactor:      number;
  isOverridden:        boolean;
  onOpenRecoveryDrawer: () => void;
}

function deviationBadge(benchmarkLgd: number, manualLgd: number | null) {
  if (manualLgd == null) return null;
  const ratio = manualLgd / benchmarkLgd;
  let bg = "#DCFCE7", color = "#15803D";
  if (ratio > 1.50 || ratio < 0.50) { bg = "#FEE2E2"; color = "#B91C1C"; }
  else if (ratio > 1.25 || ratio < 0.75) { bg = "#FEF3C7"; color = "#B45309"; }
  const pctDiff = ((manualLgd - benchmarkLgd) / benchmarkLgd * 100).toFixed(1);
  const label = (manualLgd >= benchmarkLgd ? "+" : "") + pctDiff + "% vs benchmark";
  return (
    <span style={{
      background: bg, color, fontWeight: 600, fontSize: "0.75rem",
      padding: "0.15rem 0.5rem", borderRadius: "9999px",
    }}>
      {label}
    </span>
  );
}

export function LgdBenchmarkPanel({
  aircraftType, vintage, manualLgd,
  recoveryFactor, isOverridden, onOpenRecoveryDrawer,
}: Props) {
  const currentYear = new Date().getFullYear();
  const ageYears    = vintage != null ? currentYear - vintage : null;
  const family      = classifyAircraftFamily(aircraftType);
  const familyLabel = AIRCRAFT_FAMILY_LABELS[family];
  const residualPct = ageYears != null ? computeResidualValuePct(family, ageYears) : null;
  const lgdBenchmark = ageYears != null ? computeLgdBenchmark(family, ageYears, recoveryFactor) : null;
  const source = DEFAULT_RESIDUAL_CURVES[family].source;

  const row = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid #F1F5F9" }}>
      <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ padding: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
          LGD Benchmark · {familyLabel}
        </span>
        {isOverridden && (
          <span style={{ background: "#EDE9FE", color: "#5B21B6", fontWeight: 600, fontSize: "0.75rem", padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>
            Custom RF
          </span>
        )}
      </div>

      {/* Value rows */}
      {row("Aircraft family",  familyLabel)}
      {row("Aircraft age",     ageYears != null ? `${ageYears} yr (vintage ${vintage})` : "—")}
      {row("Residual value %", residualPct != null ? `${(residualPct * 100).toFixed(1)}%` : "—")}

      {/* LGD benchmark + deviation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid #F1F5F9" }}>
        <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>LGD benchmark</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>
            {lgdBenchmark != null ? `${(lgdBenchmark * 100).toFixed(1)}%` : "—"}
          </span>
          {lgdBenchmark != null && deviationBadge(lgdBenchmark, manualLgd)}
        </div>
      </div>

      {row("Recovery factor", `${(recoveryFactor * 100).toFixed(1)}% ${isOverridden ? "(custom)" : "(default)"}`)}

      {/* Source footer */}
      <p style={{ fontSize: "0.7rem", color: "#94A3B8", marginTop: "0.75rem", lineHeight: 1.4 }}>
        Source: {source}
      </p>

      {/* Drawer link */}
      <button
        onClick={onOpenRecoveryDrawer}
        style={{ marginTop: "0.5rem", background: "none", border: "none", color: "#002147", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", padding: 0 }}
      >
        Adjust recovery factor →
      </button>
    </div>
  );
}
