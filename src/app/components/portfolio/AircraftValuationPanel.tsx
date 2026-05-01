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

