// src/app/components/scenarios/ScopePicker.tsx
//
// Inline pill that lets the user scope a scenario run to a subset of
// the portfolio — single-dimension: All / Aircraft / Lessee / Type.
// Compact UI: pill shows the current scope label, click opens a small
// dropdown panel with dimension tabs + multi-select chips.

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import type { Asset, Lessee } from "../../types/portfolio";
import {
  type ScenarioScope,
  type ScopeDimension,
  SCOPE_ALL,
  scopeLabel,
  distinctAircraftTypes,
} from "../../utils/scenarioScope";

export interface ScopePickerProps {
  scope:    ScenarioScope;
  onChange: (next: ScenarioScope) => void;
  assets:   Asset[];
  lessees:  Lessee[];
}

const DIMS: { id: ScopeDimension; label: string }[] = [
  { id: "all",          label: "All"           },
  { id: "aircraft",     label: "By aircraft"   },
  { id: "lessee",       label: "By lessee"     },
  { id: "aircraftType", label: "By type"       },
];

export function ScopePicker({ scope, onChange, assets, lessees }: ScopePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [dim,  setDim ] = React.useState<ScopeDimension>(scope.dimension);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const types = React.useMemo(() => distinctAircraftTypes(assets), [assets]);

  function pickDim(next: ScopeDimension) {
    setDim(next);
    if (next === "all") {
      onChange(SCOPE_ALL);
    } else if (next !== scope.dimension) {
      // Switching dimension — reset ids to empty (user picks fresh).
      onChange({ dimension: next, ids: [] });
    }
  }

  function toggleId(id: string) {
    const exists = scope.ids.includes(id);
    onChange({
      dimension: dim,
      ids: exists ? scope.ids.filter((x) => x !== id) : [...scope.ids, id],
    });
  }

  const label = scopeLabel(scope, assets, lessees);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display:      "inline-flex",
          alignItems:   "center",
          gap:          "0.4rem",
          padding:      "0.4rem 0.85rem",
          height:       "32px",
          borderRadius: "9999px",
          background:   open ? "#F1F5F9" : "#FFFFFF",
          border:       `1px solid ${open ? "rgba(0,33,71,0.32)" : "#CBD5E1"}`,
          color:        "#0F172A",
          fontSize:     "0.8125rem",
          fontWeight:   600,
          cursor:       "pointer",
          fontFamily:   "inherit",
          transition:   "background 90ms ease-out, border-color 90ms ease-out",
        }}
      >
        <span style={{ color: "#64748B", fontWeight: 500 }}>Scope:</span>
        <span>{label}</span>
        <ChevronDown size={14} style={{ color: "#64748B" }} />
      </button>

      {open && (
        <div
          style={{
            position:     "absolute",
            top:          "calc(100% + 6px)",
            left:         0,
            zIndex:       50,
            minWidth:     "320px",
            maxWidth:     "420px",
            background:   "#FFFFFF",
            border:       "1px solid #E2E8F0",
            borderRadius: "10px",
            boxShadow:    "0 16px 36px rgba(0,33,71,0.18), 0 4px 12px rgba(0,33,71,0.10)",
            padding:      "0.75rem",
          }}
        >
          {/* Dimension tabs */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            {DIMS.map((d) => {
              const active = d.id === dim;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => pickDim(d.id)}
                  style={{
                    padding:      "0.35rem 0.7rem",
                    borderRadius: "9999px",
                    border:       `1px solid ${active ? "#002147" : "#E2E8F0"}`,
                    background:   active ? "#002147" : "#FFFFFF",
                    color:        active ? "#FFFFFF" : "#475569",
                    fontSize:     "0.75rem",
                    fontWeight:   600,
                    cursor:       "pointer",
                    fontFamily:   "inherit",
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* Multi-select body */}
          {dim === "all" ? (
            <div style={{ fontSize: "0.8125rem", color: "#64748B", padding: "0.5rem 0.25rem" }}>
              Scenario will run against the entire portfolio.
            </div>
          ) : (
            <div style={{ maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
              {dim === "aircraft" && assets.map((a) => (
                <ScopeRow
                  key={a.id}
                  selected={scope.ids.includes(a.id)}
                  onClick={() => toggleId(a.id)}
                  primary={a.registration ?? a.msn ?? a.id}
                  secondary={a.aircraft_type ?? ""}
                />
              ))}
              {dim === "lessee" && lessees.map((l) => (
                <ScopeRow
                  key={l.id}
                  selected={scope.ids.includes(l.id)}
                  onClick={() => toggleId(l.id)}
                  primary={l.name}
                  secondary={l.country ?? ""}
                />
              ))}
              {dim === "aircraftType" && types.map((t) => (
                <ScopeRow
                  key={t}
                  selected={scope.ids.includes(t)}
                  onClick={() => toggleId(t)}
                  primary={t}
                  secondary={`${assets.filter((a) => a.aircraft_type === t).length} aircraft`}
                />
              ))}
              {dim !== "aircraftType" && (dim === "aircraft" ? assets : lessees).length === 0 && (
                <div style={{ fontSize: "0.8125rem", color: "#64748B", padding: "0.5rem 0.25rem" }}>
                  None in this portfolio.
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid #F1F5F9" }}>
            <button
              type="button"
              onClick={() => { onChange(SCOPE_ALL); setDim("all"); }}
              style={{ background: "transparent", border: "none", color: "#64748B", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: "#002147", border: "none", color: "#FFFFFF", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", padding: "0.4rem 0.85rem", borderRadius: "6px", fontFamily: "inherit" }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScopeRow({
  selected, onClick, primary, secondary,
}: {
  selected: boolean; onClick: () => void; primary: string; secondary: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          "0.5rem",
        padding:      "0.45rem 0.5rem",
        background:   selected ? "rgba(0,33,71,0.06)" : "transparent",
        border:       "none",
        borderRadius: "6px",
        cursor:       "pointer",
        textAlign:    "left",
        width:        "100%",
        fontFamily:   "inherit",
      }}
    >
      <div style={{
        width: "16px", height: "16px", borderRadius: "4px",
        border: `1.5px solid ${selected ? "#002147" : "#CBD5E1"}`,
        background: selected ? "#002147" : "#FFFFFF",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {selected && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "0.8125rem", color: "#0F172A", fontWeight: 500, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {primary}
        </div>
        {secondary && (
          <div style={{ fontSize: "0.6875rem", color: "#64748B", lineHeight: 1.3 }}>
            {secondary}
          </div>
        )}
      </div>
    </button>
  );
}
