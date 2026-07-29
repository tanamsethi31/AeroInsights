// ─── Maintenance Heuristics Reference Table ───────────────────────────────────
// Source: IATA MCTF, IAWG published cost ranges, Cirium MRO forecast 2024.
// Costs are mid-range heuristics in USD. Used for Heuristic mode at MVP;
// Cirium adapter replaces this at Phase 3.

export type ComponentName = "Airframe HSI" | "Engine PR" | "LLPs" | "Landing Gear" | "APU";
export type AircraftCategory = "narrowbody" | "widebody" | "regional-jet" | "turboprop";

export interface ComponentHeuristic {
  intervalFH: number;   // flight hours between overhauls (or full-life interval)
  intervalCy: number;   // cycles (LLPs and Landing Gear use cycles)
  costUSD: number;      // estimated event cost in USD
  basis: "FH" | "cycle";
}

export type TypeHeuristicMap = Record<ComponentName, ComponentHeuristic>;

export interface TypeHeuristic {
  category: AircraftCategory;
  /** Annual flight hours (fleet average) */
  utilizationFH: number;
  /** Annual cycles (fleet average) */
  utilizationCy: number;
  components: TypeHeuristicMap;
}

// ─── Per-type heuristic table ─────────────────────────────────────────────────

export const TYPE_HEURISTICS: Record<string, TypeHeuristic> = {
  "A320": {
    category: "narrowbody",
    utilizationFH: 3_500,
    utilizationCy: 2_800,
    components: {
      "Airframe HSI": { intervalFH: 36_000, intervalCy: 0,      costUSD: 6_000_000,  basis: "FH"    },
      "Engine PR":    { intervalFH: 18_000, intervalCy: 0,      costUSD: 5_200_000,  basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 20_000, costUSD: 1_200_000,  basis: "cycle" },
      "Landing Gear": { intervalFH: 56_000, intervalCy: 0,      costUSD: 1_400_000,  basis: "FH"    },
      "APU":          { intervalFH: 25_000, intervalCy: 0,      costUSD: 800_000,    basis: "FH"    },
    },
  },
  "A320neo": {
    category: "narrowbody",
    utilizationFH: 3_500,
    utilizationCy: 2_800,
    components: {
      "Airframe HSI": { intervalFH: 36_000, intervalCy: 0,      costUSD: 6_800_000,  basis: "FH"    },
      "Engine PR":    { intervalFH: 20_000, intervalCy: 0,      costUSD: 5_800_000,  basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 20_000, costUSD: 1_300_000,  basis: "cycle" },
      "Landing Gear": { intervalFH: 60_000, intervalCy: 0,      costUSD: 1_500_000,  basis: "FH"    },
      "APU":          { intervalFH: 25_000, intervalCy: 0,      costUSD: 900_000,    basis: "FH"    },
    },
  },
  "A321neo": {
    category: "narrowbody",
    utilizationFH: 3_500,
    utilizationCy: 2_600,
    components: {
      "Airframe HSI": { intervalFH: 36_000, intervalCy: 0,      costUSD: 7_200_000,  basis: "FH"    },
      "Engine PR":    { intervalFH: 20_000, intervalCy: 0,      costUSD: 6_200_000,  basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 20_000, costUSD: 1_400_000,  basis: "cycle" },
      "Landing Gear": { intervalFH: 60_000, intervalCy: 0,      costUSD: 1_600_000,  basis: "FH"    },
      "APU":          { intervalFH: 25_000, intervalCy: 0,      costUSD: 900_000,    basis: "FH"    },
    },
  },
  "A330-300": {
    category: "widebody",
    utilizationFH: 4_500,
    utilizationCy: 1_500,
    components: {
      "Airframe HSI": { intervalFH: 40_000, intervalCy: 0,      costUSD: 11_500_000, basis: "FH"    },
      "Engine PR":    { intervalFH: 20_000, intervalCy: 0,      costUSD: 13_500_000, basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 18_000, costUSD: 1_800_000,  basis: "cycle" },
      "Landing Gear": { intervalFH: 60_000, intervalCy: 0,      costUSD: 3_200_000,  basis: "FH"    },
      "APU":          { intervalFH: 25_000, intervalCy: 0,      costUSD: 1_400_000,  basis: "FH"    },
    },
  },
  "A350-900": {
    category: "widebody",
    utilizationFH: 4_500,
    utilizationCy: 1_400,
    components: {
      "Airframe HSI": { intervalFH: 48_000, intervalCy: 0,      costUSD: 23_000_000, basis: "FH"    },
      "Engine PR":    { intervalFH: 25_000, intervalCy: 0,      costUSD: 28_000_000, basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 18_000, costUSD: 2_200_000,  basis: "cycle" },
      "Landing Gear": { intervalFH: 70_000, intervalCy: 0,      costUSD: 5_200_000,  basis: "FH"    },
      "APU":          { intervalFH: 28_000, intervalCy: 0,      costUSD: 2_200_000,  basis: "FH"    },
    },
  },
  "B737-800": {
    category: "narrowbody",
    utilizationFH: 3_500,
    utilizationCy: 2_800,
    components: {
      "Airframe HSI": { intervalFH: 32_000, intervalCy: 0,      costUSD: 5_800_000,  basis: "FH"    },
      "Engine PR":    { intervalFH: 18_000, intervalCy: 0,      costUSD: 4_800_000,  basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 20_000, costUSD: 1_100_000,  basis: "cycle" },
      "Landing Gear": { intervalFH: 55_000, intervalCy: 0,      costUSD: 1_200_000,  basis: "FH"    },
      "APU":          { intervalFH: 23_000, intervalCy: 0,      costUSD: 700_000,    basis: "FH"    },
    },
  },
  "B737 MAX 8": {
    category: "narrowbody",
    utilizationFH: 3_500,
    utilizationCy: 2_600,
    components: {
      "Airframe HSI": { intervalFH: 36_000, intervalCy: 0,      costUSD: 6_500_000,  basis: "FH"    },
      "Engine PR":    { intervalFH: 20_000, intervalCy: 0,      costUSD: 5_500_000,  basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 20_000, costUSD: 1_200_000,  basis: "cycle" },
      "Landing Gear": { intervalFH: 55_000, intervalCy: 0,      costUSD: 1_300_000,  basis: "FH"    },
      "APU":          { intervalFH: 23_000, intervalCy: 0,      costUSD: 800_000,    basis: "FH"    },
    },
  },
  "B777-300ER": {
    category: "widebody",
    utilizationFH: 4_500,
    utilizationCy: 1_300,
    components: {
      "Airframe HSI": { intervalFH: 48_000, intervalCy: 0,      costUSD: 16_000_000, basis: "FH"    },
      "Engine PR":    { intervalFH: 22_000, intervalCy: 0,      costUSD: 18_500_000, basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 15_000, costUSD: 2_000_000,  basis: "cycle" },
      "Landing Gear": { intervalFH: 70_000, intervalCy: 0,      costUSD: 4_200_000,  basis: "FH"    },
      "APU":          { intervalFH: 28_000, intervalCy: 0,      costUSD: 1_800_000,  basis: "FH"    },
    },
  },
  "B787-9": {
    category: "widebody",
    utilizationFH: 4_500,
    utilizationCy: 1_300,
    components: {
      "Airframe HSI": { intervalFH: 48_000, intervalCy: 0,      costUSD: 19_000_000, basis: "FH"    },
      "Engine PR":    { intervalFH: 25_000, intervalCy: 0,      costUSD: 22_000_000, basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 20_000, costUSD: 2_000_000,  basis: "cycle" },
      "Landing Gear": { intervalFH: 70_000, intervalCy: 0,      costUSD: 4_800_000,  basis: "FH"    },
      "APU":          { intervalFH: 28_000, intervalCy: 0,      costUSD: 2_000_000,  basis: "FH"    },
    },
  },
  "Q400": {
    category: "turboprop",
    utilizationFH: 2_000,
    utilizationCy: 2_400,
    components: {
      "Airframe HSI": { intervalFH: 24_000, intervalCy: 0,      costUSD: 3_200_000,  basis: "FH"    },
      "Engine PR":    { intervalFH: 12_000, intervalCy: 0,      costUSD: 2_800_000,  basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 14_000, costUSD: 600_000,    basis: "cycle" },
      "Landing Gear": { intervalFH: 32_000, intervalCy: 0,      costUSD: 800_000,    basis: "FH"    },
      "APU":          { intervalFH: 16_000, intervalCy: 0,      costUSD: 500_000,    basis: "FH"    },
    },
  },
  "ATR 72": {
    category: "turboprop",
    utilizationFH: 2_000,
    utilizationCy: 2_400,
    components: {
      "Airframe HSI": { intervalFH: 20_000, intervalCy: 0,      costUSD: 2_800_000,  basis: "FH"    },
      "Engine PR":    { intervalFH: 10_000, intervalCy: 0,      costUSD: 2_200_000,  basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 12_000, costUSD: 500_000,    basis: "cycle" },
      "Landing Gear": { intervalFH: 28_000, intervalCy: 0,      costUSD: 600_000,    basis: "FH"    },
      "APU":          { intervalFH: 14_000, intervalCy: 0,      costUSD: 400_000,    basis: "FH"    },
    },
  },
  "E190": {
    category: "regional-jet",
    utilizationFH: 2_800,
    utilizationCy: 2_600,
    components: {
      "Airframe HSI": { intervalFH: 28_000, intervalCy: 0,      costUSD: 4_500_000,  basis: "FH"    },
      "Engine PR":    { intervalFH: 14_000, intervalCy: 0,      costUSD: 3_800_000,  basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 16_000, costUSD: 800_000,    basis: "cycle" },
      "Landing Gear": { intervalFH: 40_000, intervalCy: 0,      costUSD: 1_000_000,  basis: "FH"    },
      "APU":          { intervalFH: 18_000, intervalCy: 0,      costUSD: 600_000,    basis: "FH"    },
    },
  },
  "E195": {
    category: "regional-jet",
    utilizationFH: 2_800,
    utilizationCy: 2_600,
    components: {
      "Airframe HSI": { intervalFH: 28_000, intervalCy: 0,      costUSD: 4_800_000,  basis: "FH"    },
      "Engine PR":    { intervalFH: 14_000, intervalCy: 0,      costUSD: 4_000_000,  basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 16_000, costUSD: 800_000,    basis: "cycle" },
      "Landing Gear": { intervalFH: 40_000, intervalCy: 0,      costUSD: 1_000_000,  basis: "FH"    },
      "APU":          { intervalFH: 18_000, intervalCy: 0,      costUSD: 600_000,    basis: "FH"    },
    },
  },
  "CRJ900": {
    category: "regional-jet",
    utilizationFH: 2_800,
    utilizationCy: 2_600,
    components: {
      "Airframe HSI": { intervalFH: 24_000, intervalCy: 0,      costUSD: 3_800_000,  basis: "FH"    },
      "Engine PR":    { intervalFH: 12_000, intervalCy: 0,      costUSD: 3_200_000,  basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 14_000, costUSD: 700_000,    basis: "cycle" },
      "Landing Gear": { intervalFH: 36_000, intervalCy: 0,      costUSD: 900_000,    basis: "FH"    },
      "APU":          { intervalFH: 18_000, intervalCy: 0,      costUSD: 500_000,    basis: "FH"    },
    },
  },
  "A220-300": {
    category: "narrowbody",
    utilizationFH: 3_200,
    utilizationCy: 2_600,
    components: {
      "Airframe HSI": { intervalFH: 32_000, intervalCy: 0,      costUSD: 5_800_000,  basis: "FH"    },
      "Engine PR":    { intervalFH: 18_000, intervalCy: 0,      costUSD: 5_000_000,  basis: "FH"    },
      "LLPs":         { intervalFH: 0,      intervalCy: 18_000, costUSD: 1_100_000,  basis: "cycle" },
      "Landing Gear": { intervalFH: 52_000, intervalCy: 0,      costUSD: 1_300_000,  basis: "FH"    },
      "APU":          { intervalFH: 22_000, intervalCy: 0,      costUSD: 800_000,    basis: "FH"    },
    },
  },
};

// ─── MR Adequacy Types ─────────────────────────────────────────────────────────

export type MRAdeqFlag = "green" | "amber" | "red";

export function mrFlagColor(flag: MRAdeqFlag): string {
  return flag === "green" ? "#15803D" : flag === "amber" ? "#B45309" : "#B91C1C";
}
export function mrFlagBg(flag: MRAdeqFlag): string {
  return flag === "green" ? "rgba(21,128,61,0.08)" : flag === "amber" ? "rgba(180,83,9,0.08)" : "rgba(185,28,28,0.08)";
}
export function mrFlagBorder(flag: MRAdeqFlag): string {
  return flag === "green" ? "rgba(21,128,61,0.2)" : flag === "amber" ? "rgba(180,83,9,0.2)" : "rgba(185,28,28,0.2)";
}
