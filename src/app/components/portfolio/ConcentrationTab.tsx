import { useState, useEffect, Fragment } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { KpiCard } from "../ui/KpiCard";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DimKey = "Lessee" | "Country" | "Region" | "Type" | "Vintage" | "Currency";

interface ConcentrationRow {
  name: string;
  exposure: number;    // USD
  exposurePct: number; // % of total portfolio exposure
  ecl: number;         // USD
  eclPct: number;      // ecl / exposure (loss rate %)
}

interface HeatmapCell {
  lessee: string;
  country: string;
  exposure: number; // USD
  ecl: number;      // USD
}

type ThresholdMap = Record<DimKey, number>;

// ─── Constants ────────────────────────────────────────────────────────────────

const M = 1_000_000;

const KPI = {
  bookValue:       2_840_000_000,
  encumberedValue: 2_610_000_000,
  encumberedPct:   91.9,
  totalECL:           47_200_000,
  eclRate:             2.12,
  waLeaseTerm:         5.8,
  waCredit:           "BB+",
};

const DEFAULT_THRESHOLDS: ThresholdMap = {
  Lessee:   15,
  Country:  20,
  Region:   35,
  Type:     35,
  Vintage:  30,
  Currency: 25,
};

// ─── Dataset ──────────────────────────────────────────────────────────────────

const CONCENTRATION_DATA: Record<DimKey, ConcentrationRow[]> = {
  Lessee: [
    { name: "Emirates",                 exposure: 412*M, exposurePct: 18.5, ecl:  2.1*M, eclPct:  0.5 },
    { name: "Ryanair",                  exposure: 386*M, exposurePct: 17.4, ecl:  1.9*M, eclPct:  0.5 },
    { name: "Singapore Airlines",       exposure: 290*M, exposurePct: 13.1, ecl:  1.2*M, eclPct:  0.4 },
    { name: "Air France",               exposure: 278*M, exposurePct: 12.5, ecl:  2.2*M, eclPct:  0.8 },
    { name: "Lufthansa",                exposure: 194*M, exposurePct:  8.7, ecl:  1.2*M, eclPct:  0.6 },
    { name: "IndiGo Airlines",          exposure: 184*M, exposurePct:  8.3, ecl:  4.6*M, eclPct:  2.5 },
    { name: "Aeromexico",               exposure: 122*M, exposurePct:  5.5, ecl:  2.2*M, eclPct:  1.8 },
    { name: "SriLankan Airlines",       exposure: 118*M, exposurePct:  5.3, ecl: 11.8*M, eclPct: 10.0 },
    { name: "Azul Brazilian Airlines",  exposure: 142*M, exposurePct:  6.4, ecl: 11.4*M, eclPct:  8.0 },
    { name: "Air Transat",              exposure:  96*M, exposurePct:  4.3, ecl:  8.6*M, eclPct:  9.0 },
  ],
  Country: [
    { name: "UAE",       exposure: 405*M, exposurePct: 18.2, ecl:  2.0*M, eclPct:  0.5 },
    { name: "Ireland",   exposure: 320*M, exposurePct: 14.4, ecl:  1.6*M, eclPct:  0.5 },
    { name: "France",    exposure: 274*M, exposurePct: 12.3, ecl:  2.2*M, eclPct:  0.8 },
    { name: "Germany",   exposure: 264*M, exposurePct: 11.9, ecl:  1.5*M, eclPct:  0.6 },
    { name: "Singapore", exposure: 265*M, exposurePct: 11.9, ecl:  1.1*M, eclPct:  0.4 },
    { name: "India",     exposure: 216*M, exposurePct:  9.7, ecl:  4.8*M, eclPct:  2.2 },
    { name: "Brazil",    exposure: 142*M, exposurePct:  6.4, ecl: 11.4*M, eclPct:  8.0 },
    { name: "Mexico",    exposure: 122*M, exposurePct:  5.5, ecl:  2.2*M, eclPct:  1.8 },
    { name: "Sri Lanka", exposure: 118*M, exposurePct:  5.3, ecl: 11.8*M, eclPct: 10.0 },
    { name: "Canada",    exposure:  96*M, exposurePct:  4.3, ecl:  8.6*M, eclPct:  9.0 },
  ],
  Region: [
    { name: "Europe",   exposure: 858*M, exposurePct: 38.6, ecl:  5.3*M, eclPct: 0.6 },
    { name: "APAC",     exposure: 599*M, exposurePct: 27.0, ecl: 17.7*M, eclPct: 3.0 },
    { name: "MEA",      exposure: 405*M, exposurePct: 18.2, ecl:  2.0*M, eclPct: 0.5 },
    { name: "Americas", exposure: 360*M, exposurePct: 16.2, ecl: 22.2*M, eclPct: 6.2 },
  ],
  Type: [
    { name: "A350-900",    exposure: 568*M, exposurePct: 25.6, ecl:  3.4*M, eclPct:  0.6 },
    { name: "B737 Family", exposure: 508*M, exposurePct: 22.9, ecl:  4.1*M, eclPct:  0.8 },
    { name: "A320 Family", exposure: 422*M, exposurePct: 19.0, ecl: 24.6*M, eclPct:  5.8 },
    { name: "B777-300ER",  exposure: 412*M, exposurePct: 18.5, ecl:  2.1*M, eclPct:  0.5 },
    { name: "A220-300",    exposure: 194*M, exposurePct:  8.7, ecl:  1.2*M, eclPct:  0.6 },
    { name: "A330-300",    exposure: 118*M, exposurePct:  5.3, ecl: 11.8*M, eclPct: 10.0 },
  ],
  Vintage: [
    { name: "2021–22", exposure: 1_134*M, exposurePct: 51.0, ecl: 16.6*M, eclPct: 1.5  },
    { name: "2019–20", exposure:   402*M, exposurePct: 18.1, ecl: 15.4*M, eclPct: 3.8  },
    { name: "2023+",   exposure:   290*M, exposurePct: 13.1, ecl:  1.2*M, eclPct: 0.4  },
    { name: "2017–18", exposure:   278*M, exposurePct: 12.5, ecl:  2.2*M, eclPct: 0.8  },
    { name: "2015–16", exposure:   118*M, exposurePct:  5.3, ecl: 11.8*M, eclPct: 10.0 },
  ],
  Currency: [
    { name: "USD", exposure: 1_126*M, exposurePct: 50.7, ecl: 21.9*M, eclPct: 1.9 },
    { name: "EUR", exposure:   858*M, exposurePct: 38.6, ecl:  5.3*M, eclPct: 0.6 },
    { name: "BRL", exposure:   142*M, exposurePct:  6.4, ecl: 11.4*M, eclPct: 8.0 },
    { name: "CAD", exposure:    96*M, exposurePct:  4.3, ecl:  8.6*M, eclPct: 9.0 },
  ],
};

const HEATMAP_CELLS: HeatmapCell[] = [
  { lessee: "Emirates",                country: "UAE",       exposure: 380*M, ecl:  1.9*M },
  { lessee: "Emirates",                country: "India",     exposure:  32*M, ecl:  0.2*M },
  { lessee: "Ryanair",                 country: "Ireland",   exposure: 320*M, ecl:  1.6*M },
  { lessee: "Ryanair",                 country: "Germany",   exposure:  66*M, ecl:  0.3*M },
  { lessee: "Singapore Airlines",      country: "Singapore", exposure: 265*M, ecl:  1.1*M },
  { lessee: "Singapore Airlines",      country: "UAE",       exposure:  25*M, ecl:  0.1*M },
  { lessee: "Air France",              country: "France",    exposure: 248*M, ecl:  2.0*M },
  { lessee: "Air France",              country: "Germany",   exposure:  30*M, ecl:  0.2*M },
  { lessee: "Lufthansa",               country: "Germany",   exposure: 168*M, ecl:  1.0*M },
  { lessee: "Lufthansa",               country: "France",    exposure:  26*M, ecl:  0.2*M },
  { lessee: "Azul Brazilian Airlines", country: "Brazil",    exposure: 142*M, ecl: 11.4*M },
  { lessee: "Air Transat",             country: "Canada",    exposure:  96*M, ecl:  8.6*M },
  { lessee: "SriLankan Airlines",      country: "Sri Lanka", exposure: 118*M, ecl: 11.8*M },
  { lessee: "IndiGo Airlines",         country: "India",     exposure: 184*M, ecl:  4.6*M },
  { lessee: "Aeromexico",              country: "Mexico",    exposure: 122*M, ecl:  2.2*M },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtM(n: number): string {
  const m = n / 1_000_000;
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  if (m % 1 === 0) return `$${m.toFixed(0)}M`;
  return `$${m.toFixed(1)}M`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function breachLevel(exposurePct: number, threshold: number): "none" | "amber" | "red" {
  if (exposurePct > threshold * 1.5) return "red";
  if (exposurePct > threshold) return "amber";
  return "none";
}

function barColour(level: "none" | "amber" | "red"): string {
  if (level === "red") return "#B91C1C";
  if (level === "amber") return "#B45309";
  return "#002147";
}

function heatColour(eclPct: number): string {
  if (eclPct >= 10) return "#FECACA";
  if (eclPct >= 5)  return "#FED7AA";
  if (eclPct >= 2)  return "#FEF3C7";
  if (eclPct > 0)   return "#BBF7D0";
  return "#F0FDF4";
}

// ─── ConcentrationTab (stub — UI added in Task 2) ─────────────────────────────

export function ConcentrationTab() {
  return (
    <div style={{ padding: "1rem", color: "#94A3B8", fontSize: "0.8125rem" }}>
      Concentration tab loading…
    </div>
  );
}

// Suppress unused import warnings until Task 2
void useState; void useEffect; void Fragment;
void BarChart; void Bar; void XAxis; void YAxis; void CartesianGrid;
void Tooltip; void ResponsiveContainer; void ReferenceLine; void Cell;
void KpiCard;
