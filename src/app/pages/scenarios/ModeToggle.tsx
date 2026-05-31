// ─────────────────────────────────────────────────────────────────────────────
// scenarios/ModeToggle.tsx
//
// Run-mode picker: deterministic vs Monte Carlo + a path-count field shown
// only when Monte Carlo is active. Used by both the Library card configurator
// and the Custom Builder. Stateless — parent owns mode/paths.
// ─────────────────────────────────────────────────────────────────────────────

import type { RunMode } from "./_shared";

interface ModeToggleProps {
  mode: RunMode;
  paths: number;
  onMode: (m: RunMode) => void;
  onPaths: (p: number) => void;
}

export default function ModeToggle({ mode, paths, onMode, onPaths }: ModeToggleProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>
          Run Mode
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["deterministic", "montecarlo"] as RunMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onMode(m)}
              style={{
                flex: 1, padding: "0.4375rem", fontSize: "0.8125rem", fontWeight: 500,
                borderRadius: "9999px", border: "1px solid",
                cursor: "pointer",
                background: mode === m ? "#002147" : "#FFFFFF",
                color: mode === m ? "#FFFFFF" : "#475569",
                borderColor: mode === m ? "#002147" : "#E2E8F0",
              }}
            >
              {m === "deterministic" ? "Deterministic" : "Monte Carlo"}
            </button>
          ))}
        </div>
      </div>
      {mode === "montecarlo" && (
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>
            Path Count
          </div>
          <input
            type="number" value={paths} min={100} max={100000} step={1000}
            onChange={(e) => onPaths(Math.min(100000, Math.max(100, parseInt(e.target.value) || 10000)))}
            style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.4375rem 0.75rem", fontSize: "0.875rem", color: "#0F172A", fontFamily: "monospace", outline: "none" }}
          />
          <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.25rem" }}>
            Default 10,000 — max 100,000
          </div>
        </div>
      )}
      <div style={{ padding: "0.625rem 0.75rem", background: "#F4F5F7", borderRadius: "0.375rem", fontSize: "0.8125rem", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#475569" }}>Est. runtime</span>
        <span style={{ fontWeight: 600, color: "#0F172A" }}>
          {mode === "deterministic" ? "< 5s" : `~${Math.ceil(paths / 250)}s`}
        </span>
      </div>
    </div>
  );
}
