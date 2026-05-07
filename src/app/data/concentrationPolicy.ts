// ─── Types ────────────────────────────────────────────────────────────────────

export type DimKey = "Lessee" | "Country" | "Region" | "Type" | "Vintage" | "Currency";

export interface PolicyRule {
  id: string;
  dimension: DimKey;
  label: string;
  limitPct: number;
  enabled: boolean;
  description: string;
}

// ─── Default policy rules ─────────────────────────────────────────────────────
// Matches DEFAULT_THRESHOLDS in ConcentrationTab by design.
// In production: persisted in tenant config and editable by Admin users.

export const DEFAULT_POLICY_RULES: PolicyRule[] = [
  {
    id: "pr-1",
    dimension: "Lessee",
    label: "No single lessee > 15% of book",
    limitPct: 15,
    enabled: true,
    description: "Board-approved maximum single-name concentration",
  },
  {
    id: "pr-2",
    dimension: "Country",
    label: "No single country > 20% of book",
    limitPct: 20,
    enabled: true,
    description: "Geographic concentration cap per credit policy §4.2",
  },
  {
    id: "pr-3",
    dimension: "Region",
    label: "No single region > 35% of book",
    limitPct: 35,
    enabled: true,
    description: "Regional diversification requirement",
  },
  {
    id: "pr-4",
    dimension: "Type",
    label: "No single aircraft type > 35% of book",
    limitPct: 35,
    enabled: true,
    description: "Fleet type concentration — widebody / narrowbody split",
  },
  {
    id: "pr-5",
    dimension: "Vintage",
    label: "No single origination vintage > 30% of book",
    limitPct: 30,
    enabled: false,
    description: "Origination vintage concentration — under review",
  },
  {
    id: "pr-6",
    dimension: "Currency",
    label: "No single currency > 25% of book",
    limitPct: 25,
    enabled: false,
    description: "FX concentration limit — monitoring only",
  },
];

// ─── Peak concentrations per dimension ────────────────────────────────────────
// Highest-exposure entity per dimension across the live portfolio.
// In production: derived dynamically from the portfolio data feed.

export const PEAK_CONCENTRATIONS: Record<DimKey, { name: string; pct: number }> = {
  Lessee:   { name: "Emirates",  pct: 18.5 },
  Country:  { name: "UAE",       pct: 18.2 },
  Region:   { name: "Europe",    pct: 38.6 },
  Type:     { name: "A350-900",  pct: 25.6 },
  Vintage:  { name: "2021–22",   pct: 51.0 },
  Currency: { name: "USD",       pct: 50.7 },
};
