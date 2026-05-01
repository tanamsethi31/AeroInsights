# Sprint 6 — F08: Market Value & Tear-down Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Portfolio → Aircraft tab with per-asset valuation columns (half-life BV, current MV, MAV, lease-encumbered, part-out), accordion expand panels showing value hierarchy with source badges + uncertainty bands, a read-only part-out calculator, and a lightweight user override system.

**Architecture:** New `AircraftValuationPanel.tsx` holds all types, synthetic valuation data, computed functions, SourceBadge component, and the three-panel expanded UI. `Portfolio.tsx` is modified to import and render the panel, replace the existing NBV/MV/MVAdj table columns with five valuation columns, and manage accordion + override state.

**Tech Stack:** React 18, TypeScript, Vite, inline `style={{}}` (no CSS modules), existing `useSortable` hook, existing `Card` UI component, `Fragment` from React.

---

### Task 1: Types, dataset, computed functions, and SourceBadge

**Files:**
- Create: `src/app/components/portfolio/AircraftValuationPanel.tsx`

**Context:** This file follows the same isolation pattern as `src/app/components/portfolio/SDMRTab.tsx` — all data, types, logic, and UI in one file. No separate data file. The project has no test runner; verification is `npm run build` from `/Users/tanamsethi/Downloads/Aeroinsights`.

- [ ] **Step 1: Create the file with types, dataset, helpers, SourceBadge, and a stub export**

Create `/Users/tanamsethi/Downloads/Aeroinsights/src/app/components/portfolio/AircraftValuationPanel.tsx` with this exact content:

```tsx
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

// ─── AircraftValuationPanel (stub — UI added in Task 2) ───────────────────────

export function AircraftValuationPanel(_props: {
  msn: string;
  overrides: OverrideMap;
  onOverride: (msn: string, key: OverrideKey, entry: OverrideEntry) => void;
  onRevertOverride: (msn: string, key: OverrideKey) => void;
}) {
  return (
    <div style={{ padding: "1rem", color: "#94A3B8", fontSize: "0.8125rem" }}>
      Valuation panel loading…
    </div>
  );
}

// Suppress unused import warning until Task 2
void useState;
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build`
Expected: `✓ built in ~Xs` — no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/portfolio/AircraftValuationPanel.tsx
git commit -m "feat(sprint6): add AircraftValuationPanel types, dataset, helpers, SourceBadge"
```

---

### Task 2: ExpandedPanel — all three panels + AircraftValuationPanel export

**Files:**
- Modify: `src/app/components/portfolio/AircraftValuationPanel.tsx`

**Context:** Replace the stub `AircraftValuationPanel` and the `void useState` line at the bottom of the file with the full `ExpandedPanel` function and a real `AircraftValuationPanel` export. The three panels are: Left = Value Hierarchy card, Centre = Part-out Calculator table, Right = Override Panel with save + revert.

The `VALUE_KEYS` constant, `ExpandedPanel` function, and updated `AircraftValuationPanel` all go at the bottom of the file, replacing everything from `// ─── AircraftValuationPanel (stub...` to end of file.

- [ ] **Step 1: Replace stub section with full ExpandedPanel + AircraftValuationPanel**

Remove everything from `// ─── AircraftValuationPanel (stub — UI added in Task 2) ───────────────────────` to end of file, and replace with:

```tsx
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
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build`
Expected: `✓ built in ~Xs` — no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/portfolio/AircraftValuationPanel.tsx
git commit -m "feat(sprint6): add ExpandedPanel with value hierarchy, part-out calculator, and override panel"
```

---

### Task 3: Wire AircraftValuationPanel into Portfolio.tsx

**Files:**
- Modify: `src/app/pages/Portfolio.tsx`

**Context:** `Portfolio.tsx` currently has:
- Module-level `aircraft` array with fields: `msn, type, reg, vintage, nbv, mv, mvAdj, lessee, maintenanceReserve`
- Module-level `aircraftAccessors` for `useSortable` (keys: `type`, `vintage`, `nbv`, `mv`)
- Aircraft tab renders a table with columns: MSN, Type, Registration, Vintage, Net Book Value, Market Value, Adj. Market Value, Lessee, MR Balance

This task:
1. Adds imports for `Fragment` and the new panel exports
2. Adds `aircraftExpanded` and `aircraftOverrides` state inside `Portfolio()`
3. Replaces module-level `aircraftAccessors` with an inline computed version inside the component that merges valuation data
4. Replaces the Aircraft tab table columns and row cells with the new valuation layout
5. Adds expand/collapse rows using `Fragment`

- [ ] **Step 1: Add Fragment and AircraftValuationPanel imports**

At the top of `src/app/pages/Portfolio.tsx`, change:

```tsx
import { useState } from "react";
```

to:

```tsx
import { useState, Fragment } from "react";
import {
  AircraftValuationPanel,
  valuationData,
  resolvedValue,
  fmtUSD,
  SourceBadge,
  type OverrideKey,
  type OverrideEntry,
  type OverrideMap,
} from "../components/portfolio/AircraftValuationPanel";
```

- [ ] **Step 2: Remove module-level aircraftAccessors**

Delete the entire `const aircraftAccessors = { ... }` block at module level (lines ~79–84). It will be replaced inside the component in Step 4.

- [ ] **Step 3: Add accordion and override state inside the Portfolio component**

Inside `export default function Portfolio()`, after the existing `const [stageFilter, setStageFilter] = useState("All");` line, add:

```tsx
const [aircraftExpanded, setAircraftExpanded] = useState<Set<string>>(new Set());
const [aircraftOverrides, setAircraftOverrides] = useState<OverrideMap>({});

function toggleAircraftExpand(msn: string) {
  setAircraftExpanded((prev) => {
    const next = new Set(prev);
    next.has(msn) ? next.delete(msn) : next.add(msn);
    return next;
  });
}

function handleOverride(msn: string, key: OverrideKey, entry: OverrideEntry) {
  setAircraftOverrides((prev) => ({
    ...prev,
    [msn]: { ...prev[msn], [key]: entry },
  }));
}

function handleRevertOverride(msn: string, key: OverrideKey) {
  setAircraftOverrides((prev) => {
    const msnOverrides = { ...prev[msn] };
    delete msnOverrides[key];
    return { ...prev, [msn]: msnOverrides };
  });
}
```

- [ ] **Step 4: Replace the module-level aircraftAccessors with a computed version inside the component**

After the state declarations from Step 3, add:

```tsx
const aircraftWithValuation = aircraft.map((a) => {
  const v = valuationData.find((d) => d.msn === a.msn);
  return {
    ...a,
    hlbVal: v ? resolvedValue(v, "halfLifeBase", aircraftOverrides).value : 0,
    cmvVal: v ? resolvedValue(v, "currentMV",    aircraftOverrides).value : 0,
    mavVal: v ? resolvedValue(v, "mav",           aircraftOverrides).value : 0,
  };
});

const aircraftAccessors = {
  type:         (a: typeof aircraftWithValuation[0]) => a.type,
  vintage:      (a: typeof aircraftWithValuation[0]) => a.vintage,
  halfLifeBase: (a: typeof aircraftWithValuation[0]) => a.hlbVal,
  currentMV:    (a: typeof aircraftWithValuation[0]) => a.cmvVal,
  mav:          (a: typeof aircraftWithValuation[0]) => a.mavVal,
};
```

Also change the existing `useSortable` call for aircraft from:

```tsx
const { sorted: sortedAircraft, sortState: aircraftSortState, toggleSort: toggleAircraftSort } = useSortable(aircraft, aircraftAccessors);
```

to:

```tsx
const { sorted: sortedAircraft, sortState: aircraftSortState, toggleSort: toggleAircraftSort } = useSortable(aircraftWithValuation, aircraftAccessors);
```

- [ ] **Step 5: Replace the Aircraft tab table with the new valuation columns and accordion rows**

Find the `{/* Aircraft Tab */}` block (starts at `{activeTab === "Aircraft" && (`). Replace the entire inner `<Card>` content — from the `<Card title="Aircraft Register" noPadding>` open tag to its closing `</Card>` — with:

```tsx
<Card title="Aircraft Register" noPadding>
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
      <thead>
        <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
          {([
            { label: "MSN",          key: null          },
            { label: "Type",         key: "type"        },
            { label: "Reg",          key: null          },
            { label: "Vintage",      key: "vintage"     },
            { label: "Half-life BV", key: "halfLifeBase"},
            { label: "Current MV",   key: "currentMV"   },
            { label: "MAV",          key: "mav"         },
            { label: "Lease-Enc.",   key: null          },
            { label: "Part-out",     key: null          },
            { label: "Lessee",       key: null          },
            { label: "Expand",       key: null          },
          ] as { label: string; key: string | null }[]).map(({ label, key }) => (
            <th
              key={label}
              onClick={key ? () => toggleAircraftSort(key) : undefined}
              style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", cursor: key ? "pointer" : "default", userSelect: "none" }}
            >
              {label}
              {key && <span style={sortIconStyle(key, aircraftSortState)}>{sortIcon(key, aircraftSortState)}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedAircraft.map((a, i) => {
          const v = valuationData.find((d) => d.msn === a.msn);
          const isOpen = aircraftExpanded.has(a.msn);
          const rowBg = i % 2 === 0 ? "#FFFFFF" : "#F4F5F7";
          return (
            <Fragment key={a.msn}>
              <tr
                style={{ borderBottom: isOpen ? "none" : "1px solid #E2E8F0", background: rowBg, cursor: "pointer" }}
                onClick={() => toggleAircraftExpand(a.msn)}
              >
                <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#475569" }}>{a.msn}</td>
                <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{a.type}</td>
                <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#475569" }}>{a.reg}</td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{a.vintage}</td>
                {(["halfLifeBase", "currentMV", "mav", "leaseEncumbered", "partOut"] as OverrideKey[]).map((key) => {
                  const rv = v ? resolvedValue(v, key, aircraftOverrides) : null;
                  return (
                    <td key={key} style={{ padding: "0.75rem 1rem" }}>
                      {rv ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                          <span style={{ fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(rv.value)}</span>
                          <SourceBadge source={rv.source} />
                        </span>
                      ) : "—"}
                    </td>
                  );
                })}
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{a.lessee}</td>
                <td style={{ padding: "0.75rem 1rem", color: "#94A3B8", fontSize: "1rem" }}>
                  {isOpen ? "▲" : "▶"}
                </td>
              </tr>
              {isOpen && (
                <tr key={`${a.msn}-detail`} style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <td colSpan={11} style={{ padding: 0, background: "#FAFAFA" }}>
                    <AircraftValuationPanel
                      msn={a.msn}
                      overrides={aircraftOverrides}
                      onOverride={handleOverride}
                      onRevertOverride={handleRevertOverride}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  </div>
</Card>
```

- [ ] **Step 6: Verify build passes**

Run: `cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build`
Expected: `✓ built in ~Xs` — no TypeScript errors.

If you see "Cannot find name 'sortIcon'" or similar, check that `sortIcon` and `sortIconStyle` are still imported from `"../components/ui/useSortable"` at the top of `Portfolio.tsx` — they should be unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/Portfolio.tsx
git commit -m "feat(sprint6): wire AircraftValuationPanel into Portfolio Aircraft tab with accordion and overrides"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ FR-F08-001: Half-life BV, Current MV, MAV, Lease-Encumbered, Part-out — all shown in table columns and Value Hierarchy card
- ✅ FR-F08-002: Source tag badges (H/D/U) with uncertainty bands — SourceBadge component, bandLow/bandHigh display
- ✅ FR-F08-003: Pluggable provider architecture — `SourceTag` type + `resolvedValue` function; swapping source is a data-layer change only
- ✅ FR-F08-004: Part-out = Σ(componentValue × recoveryFactor) − tearDownCost — `computedPartOut` function
- ✅ User override: lightweight (value + note, save + revert, amber U badge)

**Type consistency:**
- `OverrideKey` used consistently across `resolvedValue`, `handleOverride`, `handleRevertOverride`, `OverrideMap`
- `valuationData` MSNs ("9218", "41234", "62047", "1728", "67892", "0378") match `aircraft[]` MSNs in `Portfolio.tsx`
- `fmtUSD` defined in `AircraftValuationPanel.tsx`, imported in `Portfolio.tsx` — no duplication

**No placeholders:** All code is complete and explicit. ✅
