// src/app/components/risk-ecl/ScenarioEditor.tsx
// Editable macro-input column for a single IFRS 9 forward-looking scenario.
// Rendered 3× in RiskECL's OverviewTab (Base, Adverse, Upside).
// Each field change calls onChange immediately so ECL recalculates live.

import type { ScenarioInputs } from "../../utils/eclCalculator";

export interface ScenarioEditorProps {
  label: string;             // e.g. "Baseline", "Adverse / Downside", "Upside"
  color: string;             // header accent colour, e.g. "#002147"
  inputs: ScenarioInputs;
  defaults: ScenarioInputs;  // what "Reset" restores
  onChange: (updated: ScenarioInputs) => void;
}

interface FieldDef {
  key: keyof ScenarioInputs;
  label: string;
  unit: string;   // displayed after the number input: "%", "bps", "×"
  scale: number;  // multiply stored value by scale for display (100 for % fields)
  step: number;   // HTML input step attribute
  decimals: number; // toFixed precision for display value
}

const FIELDS: FieldDef[] = [
  { key: "gdpDelta",        label: "GDP Growth",            unit: "%",   scale: 100,   step: 0.1, decimals: 1 },
  { key: "rpkDelta",        label: "RPK Air Traffic",       unit: "%",   scale: 100,   step: 0.5, decimals: 1 },
  { key: "fuelDelta",       label: "Fuel Cost",             unit: "%",   scale: 100,   step: 0.5, decimals: 1 },
  { key: "fxDelta",         label: "FX Rate",               unit: "%",   scale: 100,   step: 0.5, decimals: 1 },
  { key: "rateDelta",       label: "Interest Rate",         unit: "bps", scale: 10000, step: 5,   decimals: 0 },
  { key: "assetValueDelta", label: "Aircraft Market Value", unit: "%",   scale: 100,   step: 0.5, decimals: 1 },
  { key: "pdS2Multi",       label: "PD Multiplier (S2)",    unit: "×",   scale: 1,     step: 0.1, decimals: 1 },
  { key: "pdS3Multi",       label: "PD Multiplier (S3)",    unit: "×",   scale: 1,     step: 0.1, decimals: 1 },
];

export function ScenarioEditor({ label, color, inputs, defaults, onChange }: ScenarioEditorProps) {
  function handleChange(key: keyof ScenarioInputs, displayVal: string, scale: number) {
    const num = parseFloat(displayVal);
    if (isNaN(num)) return;
    onChange({ ...inputs, [key]: num / scale });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {/* Column header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "0.25rem", borderBottom: `2px solid ${color}20` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>{label}</span>
        </div>
        <button
          onClick={() => onChange(defaults)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "0.6875rem", color: "#94A3B8",
            textDecoration: "underline", textUnderlineOffset: "2px",
            padding: 0, lineHeight: 1,
          }}
        >
          Reset
        </button>
      </div>

      {/* One row per macro variable */}
      {FIELDS.map((field) => {
        const rawVal = inputs[field.key] as number;
        const displayVal = (rawVal * field.scale).toFixed(field.decimals);
        const isNegative = rawVal < 0;
        const isPositive = rawVal > 0;
        const valueColor = isNegative ? "#B91C1C" : isPositive ? "#15803D" : "#0F172A";

        return (
          <div key={String(field.key)} style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            <label style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, lineHeight: 1.2 }}>
              {field.label}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                step={field.step}
                value={displayVal}
                onChange={(e) => handleChange(field.key, e.target.value, field.scale)}
                style={{
                  width: "100%",
                  padding: "0.375rem 2rem 0.375rem 0.625rem",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0.375rem",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: valueColor,
                  background: "#FFFFFF",
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "right",
                  appearance: "none",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 150ms ease",
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = color; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "#E2E8F0"; }}
              />
              <span style={{
                position: "absolute", right: "0.5rem", top: "50%",
                transform: "translateY(-50%)",
                fontSize: "0.6875rem", color: "#94A3B8", pointerEvents: "none",
                fontWeight: 500,
              }}>
                {field.unit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
