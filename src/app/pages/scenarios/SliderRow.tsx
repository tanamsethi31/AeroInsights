// ─────────────────────────────────────────────────────────────────────────────
// scenarios/SliderRow.tsx
//
// Small leaf component: a labelled range input with a formatted live readout
// and an optional warning colour. Used heavily by CustomBuilderTab (and any
// future tab) for shock-knob inputs. Stateless — parent owns the value.
// ─────────────────────────────────────────────────────────────────────────────

export interface SliderRowProps {
  label: string;
  min: number; max: number; step: number;
  value: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
  warn?: boolean;
}

export default function SliderRow({ label, min, max, step, value, onChange, fmt, warn }: SliderRowProps) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
        <label style={{ fontSize: "0.8125rem", color: "#475569", fontWeight: 500 }}>{label}</label>
        <span
          style={{
            fontFamily: "monospace", fontSize: "0.8125rem", fontWeight: 600,
            color: warn ? "#B45309" : value === 0 || value === 1 ? "#94A3B8" : "#002147",
            minWidth: "64px", textAlign: "right",
          }}
        >
          {fmt(value)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#002147" }}
      />
    </div>
  );
}
