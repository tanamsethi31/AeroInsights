// src/app/data/rateOutlookData.ts

export type AircraftCategory = "Narrowbody" | "Widebody" | "Regional";

export type AircraftType =
  | "A320neo" | "A321neo" | "A319neo"
  | "B737 MAX 8" | "B737 MAX 9" | "B737-800"
  | "A320ceo" | "A321ceo" | "A220-300" | "E195-E2"
  | "A330-300" | "A330-900neo" | "B777-300ER"
  | "B787-9" | "B787-8" | "A350-900" | "A350-1000" | "B777X";

export interface AircraftTypeMeta {
  type: AircraftType;
  category: AircraftCategory;
  /** Mid-market monthly rent at age-3 (USD) */
  baseRentUSD: number;
  /** Half-life base value at age-3 (USD) */
  nbvUSD: number;
}

export interface MacroInputs {
  /** Revenue Passenger Kilometres YoY growth % */
  rpkGrowth: number;
  /** Jet-A1 price USD/tonne */
  jetA1: number;
  /** System load factor % */
  loadFactor: number;
  /** 10-year USD Treasury rate % */
  usdRate10y: number;
  /** Brent crude USD/bbl */
  brentCrude: number;
}

export interface MonthlyRateForecast {
  /** 0 = today, 1–12 = months ahead */
  month: number;
  rentUSD: number;
  /** Lease Rate Factor = rentUSD / nbvUSD * 100 */
  lrf: number;
  /** P25 confidence bound */
  p25: number;
  /** P75 confidence bound */
  p75: number;
  /** Month-over-month % change (0 for month=0) */
  momPct: number;
  /** % change vs baseRentUSD */
  vsBaselinePct: number;
}

export interface TypeForecast {
  type: AircraftType;
  category: AircraftCategory;
  /** month=0 snapshot (today) */
  current: MonthlyRateForecast;
  /** months 1–12 */
  forecast: MonthlyRateForecast[];
  /** 12 rent values for mini sparkline bar chart */
  sparkline: number[];
  /** (month-12 rent − base) / base * 100 */
  outlookPct: number;
}

export interface RateOutlookResult {
  generatedAt: string;
  macroInputs: MacroInputs;
  types: TypeForecast[];
}

// ── Aircraft data ──────────────────────────────────────────────────────────────

export const AIRCRAFT_DATA: AircraftTypeMeta[] = [
  // Narrowbody
  { type: "A320neo",    category: "Narrowbody", baseRentUSD: 390_000, nbvUSD: 48_000_000 },
  { type: "A321neo",    category: "Narrowbody", baseRentUSD: 440_000, nbvUSD: 55_000_000 },
  { type: "A319neo",    category: "Narrowbody", baseRentUSD: 310_000, nbvUSD: 38_000_000 },
  { type: "B737 MAX 8", category: "Narrowbody", baseRentUSD: 415_000, nbvUSD: 52_000_000 },
  { type: "B737 MAX 9", category: "Narrowbody", baseRentUSD: 450_000, nbvUSD: 56_000_000 },
  { type: "B737-800",   category: "Narrowbody", baseRentUSD: 350_000, nbvUSD: 40_000_000 },
  { type: "A320ceo",    category: "Narrowbody", baseRentUSD: 310_000, nbvUSD: 35_000_000 },
  { type: "A321ceo",    category: "Narrowbody", baseRentUSD: 360_000, nbvUSD: 42_000_000 },
  { type: "A220-300",   category: "Narrowbody", baseRentUSD: 330_000, nbvUSD: 40_000_000 },
  // Regional
  { type: "E195-E2",    category: "Regional",   baseRentUSD: 280_000, nbvUSD: 32_000_000 },
  // Widebody
  { type: "A330-300",    category: "Widebody",   baseRentUSD: 660_000,   nbvUSD: 85_000_000  },
  { type: "A330-900neo", category: "Widebody",   baseRentUSD: 720_000,   nbvUSD: 95_000_000  },
  { type: "B777-300ER",  category: "Widebody",   baseRentUSD: 1_020_000, nbvUSD: 130_000_000 },
  { type: "B787-9",      category: "Widebody",   baseRentUSD: 950_000,   nbvUSD: 125_000_000 },
  { type: "B787-8",      category: "Widebody",   baseRentUSD: 880_000,   nbvUSD: 115_000_000 },
  { type: "A350-900",    category: "Widebody",   baseRentUSD: 1_050_000, nbvUSD: 138_000_000 },
  { type: "A350-1000",   category: "Widebody",   baseRentUSD: 1_150_000, nbvUSD: 150_000_000 },
  { type: "B777X",       category: "Widebody",   baseRentUSD: 1_200_000, nbvUSD: 160_000_000 },
];

/** Current macro inputs derived from MACRO_SIGNALS data (Apr 2026 snapshot) */
export const CURRENT_MACRO_INPUTS: MacroInputs = {
  rpkGrowth:  4.8,    // +4.8% YoY as shown in intelligenceData
  jetA1:      900,    // $1.12/litre ≈ $900/tonne
  loadFactor: 85.0,   // weighted avg across LESSEE_RADAR
  usdRate10y: 3.5,    // 3.50% as shown in intelligenceData
  brentCrude: 89.5,   // $89.50/bbl as shown in intelligenceData
};
