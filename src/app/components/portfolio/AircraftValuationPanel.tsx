import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SourceTag = "heuristic" | "desk-keyed" | "user-overridden";
export type OverrideKey = "halfLifeBase" | "currentMV" | "mav" | "leaseEncumbered" | "partOut";
export interface OverrideEntry { value: number; note: string; }
export type OverrideMap = Record<string, Partial<Record<OverrideKey, OverrideEntry>>>;

export interface ValueWithMeta {
  value: number;       // USD
  source: SourceTag;
  bandLow: number;     // uncertainty low, USD
  bandHigh: number;    // uncertainty high, USD
}

export interface PartOutComponent {
  name: "Airframe" | "Engine #1" | "Engine #2" | "Landing Gear" | "APU" | "Avionics";
  componentValue: number;   // USD
  recoveryFactor: number;   // 0–1
}

export interface AircraftValuation {
  msn: string;
  halfLifeBase: ValueWithMeta;
  currentMV: ValueWithMeta;
  mav: ValueWithMeta;
  leaseEncumbered: ValueWithMeta;
  partOut: ValueWithMeta;
  tearDownCost: number;
  partOutComponents: PartOutComponent[];
}

// ─── Dataset — 6 aircraft matching Portfolio.tsx aircraft[] MSNs ──────────────

export const valuationData: AircraftValuation[] = [
  {
    msn: "9218",
    halfLifeBase:    { value: 23_800_000, source: "heuristic", bandLow: 22_600_000, bandHigh: 25_000_000 },
    currentMV:       { value: 26_100_000, source: "heuristic", bandLow: 24_800_000, bandHigh: 27_400_000 },
    mav:             { value: 25_400_000, source: "heuristic", bandLow: 24_100_000, bandHigh: 26_700_000 },
    leaseEncumbered: { value: 23_800_000, source: "heuristic", bandLow: 22_600_000, bandHigh: 25_000_000 },
    partOut:         { value: 18_200_000, source: "heuristic", bandLow: 16_400_000, bandHigh: 20_000_000 },
    tearDownCost: 850_000,
    partOutComponents: [
      { name: "Airframe",     componentValue:  6_200_000, recoveryFactor: 0.72 },
      { name: "Engine #1",    componentValue:  5_800_000, recoveryFactor: 0.75 },
      { name: "Engine #2",    componentValue:  5_800_000, recoveryFactor: 0.75 },
      { name: "Landing Gear", componentValue:  1_400_000, recoveryFactor: 0.68 },
      { name: "APU",          componentValue:    820_000, recoveryFactor: 0.65 },
      { name: "Avionics",     componentValue:    620_000, recoveryFactor: 0.60 },
    ],
  },
  {
    msn: "41234",
    halfLifeBase:    { value: 27_400_000, source: "heuristic", bandLow: 26_000_000, bandHigh: 28_800_000 },
    currentMV:       { value: 28_800_000, source: "heuristic", bandLow: 27_400_000, bandHigh: 30_200_000 },
    mav:             { value: 28_000_000, source: "heuristic", bandLow: 26_600_000, bandHigh: 29_400_000 },
    leaseEncumbered: { value: 26_500_000, source: "heuristic", bandLow: 25_200_000, bandHigh: 27_800_000 },
    partOut:         { value: 19_600_000, source: "heuristic", bandLow: 17_600_000, bandHigh: 21_600_000 },
    tearDownCost: 800_000,
    partOutComponents: [
      { name: "Airframe",     componentValue:  6_800_000, recoveryFactor: 0.70 },
      { name: "Engine #1",    componentValue:  6_200_000, recoveryFactor: 0.74 },
      { name: "Engine #2",    componentValue:  6_200_000, recoveryFactor: 0.74 },
      { name: "Landing Gear", componentValue:  1_500_000, recoveryFactor: 0.67 },
      { name: "APU",          componentValue:    880_000, recoveryFactor: 0.64 },
      { name: "Avionics",     componentValue:    660_000, recoveryFactor: 0.60 },
    ],
  },
  {
    msn: "62047",
    halfLifeBase:    { value: 86_000_000, source: "heuristic", bandLow: 81_700_000, bandHigh: 90_300_000 },
    currentMV:       { value: 91_200_000, source: "heuristic", bandLow: 86_600_000, bandHigh: 95_800_000 },
    mav:             { value: 90_500_000, source: "heuristic", bandLow: 86_000_000, bandHigh: 95_000_000 },
    leaseEncumbered: { value: 88_400_000, source: "heuristic", bandLow: 84_000_000, bandHigh: 92_800_000 },
    partOut:         { value: 64_200_000, source: "heuristic", bandLow: 57_800_000, bandHigh: 70_600_000 },
    tearDownCost: 1_600_000,
    partOutComponents: [
      { name: "Airframe",     componentValue: 18_500_000, recoveryFactor: 0.74 },
      { name: "Engine #1",    componentValue: 22_000_000, recoveryFactor: 0.80 },
      { name: "Engine #2",    componentValue: 22_000_000, recoveryFactor: 0.80 },
      { name: "Landing Gear", componentValue:  4_200_000, recoveryFactor: 0.70 },
      { name: "APU",          componentValue:  2_100_000, recoveryFactor: 0.68 },
      { name: "Avionics",     componentValue:  1_600_000, recoveryFactor: 0.62 },
    ],
  },
  {
    msn: "1728",
    halfLifeBase:    { value: 26_500_000, source: "heuristic", bandLow: 25_200_000, bandHigh: 27_800_000 },
    currentMV:       { value: 29_100_000, source: "heuristic", bandLow: 27_600_000, bandHigh: 30_600_000 },
    mav:             { value: 28_300_000, source: "heuristic", bandLow: 26_900_000, bandHigh: 29_700_000 },
    leaseEncumbered: { value: 27_000_000, source: "heuristic", bandLow: 25_700_000, bandHigh: 28_400_000 },
    partOut:         { value: 20_100_000, source: "heuristic", bandLow: 18_100_000, bandHigh: 22_100_000 },
    tearDownCost: 1_100_000,
    partOutComponents: [
      { name: "Airframe",     componentValue:  7_200_000, recoveryFactor: 0.71 },
      { name: "Engine #1",    componentValue:  7_000_000, recoveryFactor: 0.74 },
      { name: "Engine #2",    componentValue:  7_000_000, recoveryFactor: 0.74 },
      { name: "Landing Gear", componentValue:  1_800_000, recoveryFactor: 0.68 },
      { name: "APU",          componentValue:    980_000, recoveryFactor: 0.65 },
      { name: "Avionics",     componentValue:    740_000, recoveryFactor: 0.60 },
    ],
  },
  {
    msn: "67892",
    halfLifeBase:    { value: 43_200_000, source: "heuristic", bandLow: 41_000_000, bandHigh: 45_400_000 },
    currentMV:       { value: 47_300_000, source: "heuristic", bandLow: 44_900_000, bandHigh: 49_700_000 },
    mav:             { value: 46_800_000, source: "heuristic", bandLow: 44_500_000, bandHigh: 49_100_000 },
    leaseEncumbered: { value: 44_700_000, source: "heuristic", bandLow: 42_500_000, bandHigh: 47_000_000 },
    partOut:         { value: 33_400_000, source: "heuristic", bandLow: 30_100_000, bandHigh: 36_700_000 },
    tearDownCost: 900_000,
    partOutComponents: [
      { name: "Airframe",     componentValue: 10_200_000, recoveryFactor: 0.73 },
      { name: "Engine #1",    componentValue: 10_800_000, recoveryFactor: 0.78 },
      { name: "Engine #2",    componentValue: 10_800_000, recoveryFactor: 0.78 },
      { name: "Landing Gear", componentValue:  2_400_000, recoveryFactor: 0.69 },
      { name: "APU",          componentValue:  1_200_000, recoveryFactor: 0.66 },
      { name: "Avionics",     componentValue:    860_000, recoveryFactor: 0.62 },
    ],
  },
  {
    msn: "0378",
    halfLifeBase:    { value: 65_800_000, source: "heuristic", bandLow: 62_500_000, bandHigh: 69_100_000 },
    currentMV:       { value: 72_800_000, source: "heuristic", bandLow: 69_200_000, bandHigh: 76_400_000 },
    mav:             { value: 71_400_000, source: "heuristic", bandLow: 67_800_000, bandHigh: 75_000_000 },
    leaseEncumbered: { value: 69_500_000, source: "heuristic", bandLow: 66_000_000, bandHigh: 73_000_000 },
    partOut:         { value: 51_300_000, source: "heuristic", bandLow: 46_200_000, bandHigh: 56_400_000 },
    tearDownCost: 1_400_000,
    partOutComponents: [
      { name: "Airframe",     componentValue: 15_200_000, recoveryFactor: 0.74 },
      { name: "Engine #1",    componentValue: 16_400_000, recoveryFactor: 0.80 },
      { name: "Engine #2",    componentValue: 16_400_000, recoveryFactor: 0.80 },
      { name: "Landing Gear", componentValue:  3_600_000, recoveryFactor: 0.70 },
      { name: "APU",          componentValue:  1_800_000, recoveryFactor: 0.68 },
      { name: "Avionics",     componentValue:  1_200_000, recoveryFactor: 0.62 },
    ],
  },
];

// ─── Computed Functions ───────────────────────────────────────────────────────

export function computedPartOut(v: AircraftValuation): number {
  return (
    v.partOutComponents.reduce((s, c) => s + c.componentValue * c.recoveryFactor, 0) -
    v.tearDownCost
  );
}

export function resolvedValue(
  v: AircraftValuation,
  key: OverrideKey,
  overrides: OverrideMap,
): ValueWithMeta {
  const override = overrides[v.msn]?.[key];
  if (override) {
    return { value: override.value, source: "user-overridden", bandLow: override.value, bandHigh: override.value };
  }
  if (key === "partOut") {
    return { ...v.partOut, value: computedPartOut(v) };
  }
  return v[key];
}

export function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

// ─── SourceBadge ─────────────────────────────────────────────────────────────

export function SourceBadge({ source }: { source: SourceTag }) {
  const cfg = {
    heuristic:         { label: "H", bg: "rgba(100,116,139,0.12)", color: "#64748B", border: "rgba(100,116,139,0.2)"  },
    "desk-keyed":      { label: "D", bg: "rgba(3,105,161,0.10)",   color: "#0369A1", border: "rgba(3,105,161,0.2)"    },
    "user-overridden": { label: "U", bg: "rgba(180,83,9,0.10)",    color: "#B45309", border: "rgba(180,83,9,0.2)"     },
  }[source];
  return (
    <span style={{
      fontSize: "0.6875rem", fontWeight: 700, padding: "0.15rem 0.4rem",
      borderRadius: "0.25rem", background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}

// ─── ExpandedPanel ────────────────────────────────────────────────────────────

const VALUE_KEYS: { key: OverrideKey; label: string }[] = [
  { key: "halfLifeBase",    label: "Half-life Base"    },
  { key: "currentMV",       label: "Current MV"        },
  { key: "mav",             label: "MAV"               },
  { key: "leaseEncumbered", label: "Lease-Encumbered"  },
  { key: "partOut",         label: "Part-out"          },
];

function ExpandedPanel({
  valuation,
  overrides,
  onOverride,
  onRevertOverride,
}: {
  valuation: AircraftValuation;
  overrides: OverrideMap;
  onOverride: (msn: string, key: OverrideKey, entry: OverrideEntry) => void;
  onRevertOverride: (msn: string, key: OverrideKey) => void;
}) {
  const [overrideKey, setOverrideKey] = useState<OverrideKey>("currentMV");
  const [overrideValueStr, setOverrideValueStr] = useState("");
  const [overrideNote, setOverrideNote] = useState("");

  const activeOverrides = overrides[valuation.msn] ?? {};

  function handleSave() {
    const num = parseFloat(overrideValueStr) * 1_000_000;
    if (isNaN(num) || !overrideNote.trim()) return;
    onOverride(valuation.msn, overrideKey, { value: num, note: overrideNote.trim() });
    setOverrideValueStr("");
    setOverrideNote("");
  }

  const grossPartOut = valuation.partOutComponents.reduce(
    (s, c) => s + c.componentValue * c.recoveryFactor,
    0,
  );
  const canSave = overrideValueStr.trim() !== "" && overrideNote.trim() !== "";

  return (
    <div style={{ padding: "1.25rem", display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: "1.25rem", alignItems: "start" }}>

      {/* ── Left: Value Hierarchy ── */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          Value Hierarchy
        </div>
        {VALUE_KEYS.map(({ key, label }, idx) => {
          const rv = resolvedValue(valuation, key, overrides);
          return (
            <div
              key={key}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                marginBottom: idx < VALUE_KEYS.length - 1 ? "0.625rem" : 0,
                paddingBottom: idx < VALUE_KEYS.length - 1 ? "0.625rem" : 0,
                borderBottom: idx < VALUE_KEYS.length - 1 ? "1px solid #F1F5F9" : "none",
              }}
            >
              <div>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  {label} <SourceBadge source={rv.source} />
                </div>
                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>
                  {rv.source !== "user-overridden"
                    ? `${fmtUSD(rv.bandLow)} – ${fmtUSD(rv.bandHigh)}`
                    : "user override"}
                </div>
              </div>
              <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#002147", fontVariantNumeric: "tabular-nums" }}>
                {fmtUSD(rv.value)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Centre: Part-out Calculator ── */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E2E8F0", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Part-out Calculator
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              {["Component", "Value", "Recovery %", "Recovered"].map((h) => (
                <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {valuation.partOutComponents.map((comp, i) => (
              <tr key={comp.name} style={{ borderTop: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#0F172A" }}>{comp.name}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(comp.componentValue)}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{(comp.recoveryFactor * 100).toFixed(0)}%</td>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(comp.componentValue * comp.recoveryFactor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "1px solid #E2E8F0", background: "#F8FAFC" }}>
              <td colSpan={3} style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem" }}>Gross recovery</td>
              <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: "#002147", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(grossPartOut)}</td>
            </tr>
            <tr style={{ background: "#F8FAFC" }}>
              <td colSpan={3} style={{ padding: "0.5rem 0.75rem", color: "#94A3B8", fontSize: "0.75rem" }}>Tear-down cost</td>
              <td style={{ padding: "0.5rem 0.75rem", color: "#B91C1C", fontVariantNumeric: "tabular-nums" }}>−{fmtUSD(valuation.tearDownCost)}</td>
            </tr>
            <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F4F5F7" }}>
              <td colSpan={3} style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: "#002147", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Net Part-out</td>
              <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: "#002147", fontSize: "1rem", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(computedPartOut(valuation))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Right: Override Panel ── */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          Override a Value
        </div>

        <div style={{ marginBottom: "0.625rem" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>Value</label>
          <select
            value={overrideKey}
            onChange={(e) => setOverrideKey(e.target.value as OverrideKey)}
            style={{ width: "100%", fontSize: "0.8125rem", border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "0.375rem 0.625rem", background: "#FFFFFF", color: "#0F172A", outline: "none" }}
          >
            {VALUE_KEYS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "0.625rem" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>New value (USD M)</label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g. 27.5"
            value={overrideValueStr}
            onChange={(e) => setOverrideValueStr(e.target.value)}
            style={{ width: "100%", fontSize: "0.8125rem", border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "0.375rem 0.625rem", background: "#FFFFFF", color: "#0F172A", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "0.875rem" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>Note</label>
          <input
            type="text"
            placeholder="e.g. Avitas BlueBook Q1 2026"
            value={overrideNote}
            onChange={(e) => setOverrideNote(e.target.value)}
            style={{ width: "100%", fontSize: "0.8125rem", border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "0.375rem 0.625rem", background: "#FFFFFF", color: "#0F172A", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            width: "100%", padding: "0.5rem", fontSize: "0.8125rem", fontWeight: 600,
            background: canSave ? "#002147" : "#E2E8F0",
            color: canSave ? "#FFFFFF" : "#94A3B8",
            border: "none", borderRadius: "0.5rem",
            cursor: canSave ? "pointer" : "default",
            marginBottom: "1rem",
          }}
        >
          Save override
        </button>

        <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "0.75rem" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.5rem" }}>
            Active overrides
          </div>
          {Object.keys(activeOverrides).length === 0 ? (
            <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
              No overrides — all values from heuristic model
            </div>
          ) : (
            (Object.entries(activeOverrides) as [OverrideKey, OverrideEntry][]).map(([k, entry]) => {
              const label = VALUE_KEYS.find((v) => v.key === k)?.label ?? k;
              return (
                <div
                  key={k}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    marginBottom: "0.5rem", padding: "0.375rem 0.5rem",
                    background: "rgba(180,83,9,0.06)", borderRadius: "0.375rem",
                    border: "1px solid rgba(180,83,9,0.15)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#B45309" }}>
                      {label} → {fmtUSD(entry.value)}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{entry.note}</div>
                  </div>
                  <button
                    onClick={() => onRevertOverride(valuation.msn, k)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "0.875rem", padding: "0 0.25rem", lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AircraftValuationPanel ───────────────────────────────────────────────────

export function AircraftValuationPanel({
  msn,
  overrides,
  onOverride,
  onRevertOverride,
}: {
  msn: string;
  overrides: OverrideMap;
  onOverride: (msn: string, key: OverrideKey, entry: OverrideEntry) => void;
  onRevertOverride: (msn: string, key: OverrideKey) => void;
}) {
  const valuation = valuationData.find((v) => v.msn === msn);
  if (!valuation) return null;
  return (
    <ExpandedPanel
      valuation={valuation}
      overrides={overrides}
      onOverride={onOverride}
      onRevertOverride={onRevertOverride}
    />
  );
}

