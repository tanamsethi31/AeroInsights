// src/app/components/portfolio-builder/types.ts
//
// Shapes for the Manual Portfolio Builder wizard. These are the in-memory
// "draft" rows the user edits across steps; they're transformed into DB
// payloads by saveManualPortfolio.ts when the user clicks Create.

// ─── Reference data ──────────────────────────────────────────────────────────

export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "SGD", "AED", "CNY", "CAD", "AUD"] as const;
export type Currency = typeof CURRENCIES[number];

export const WATCHLIST_STATUSES = ["green", "amber", "red"] as const;
export type WatchlistStatus = typeof WATCHLIST_STATUSES[number];

export const IFRS_STAGES = [1, 2, 3] as const;
export type IfrsStage = typeof IFRS_STAGES[number];

// ─── Draft row types (each row gets a UI-only `_localId` so React keys are stable) ──

export interface DraftAircraft {
  _localId: string;
  registration:     string;       // required
  msn:              string;       // required
  aircraft_type:    string;       // required
  manufacturer:     string;
  vintage:          string;       // user types text, parsed on save
  current_operator: string;
  country:          string;
}

export interface DraftLessee {
  _localId: string;
  name:             string;       // required
  iata_code:        string;
  country:          string;
  region:           string;
  credit_rating:    string;
  pd_estimate:      string;       // 0–1
  watchlist_status: WatchlistStatus | "";
}

export interface DraftLease {
  _localId: string;
  aircraftLocalId:  string;       // FK to DraftAircraft._localId — required
  lesseeLocalId:    string;       // FK to DraftLessee._localId — required
  start_date:       string;       // YYYY-MM-DD — required
  end_date:         string;       // YYYY-MM-DD — required
  monthly_rental:   string;       // number
  currency:         Currency;
  stage:            IfrsStage | null;
}

export interface DraftEcl {
  _localId: string;
  leaseLocalId:     string;       // FK to DraftLease._localId
  stage:            IfrsStage | null;
  pd:               string;       // 0–1
  lgd:              string;       // 0–1
  ead:              string;       // USD
  ecl_amount:       string;       // USD
}

export interface DraftSecurityDeposit {
  _localId: string;
  leaseLocalId:     string;
  deposit_months:   string;       // months of rent
  deposit_amount_usd: string;     // USD lump sum
  type:             string;       // "cash" | "letter_of_credit" | "guarantee" | ...
}

export interface DraftMaintenanceReserve {
  _localId: string;
  leaseLocalId:     string;
  component:        string;       // "Engine PR" | "APU" | "Landing Gear" | "Airframe" | ...
  rate_usd:         string;       // accrual rate
  cumulative_balance_usd: string; // current balance
  refundable:       boolean;
}

// ─── Root wizard state ───────────────────────────────────────────────────────

export interface DraftPortfolio {
  name:         string;
  description:  string;
  base_currency: Currency;
  aircraft: DraftAircraft[];
  lessees:  DraftLessee[];
  leases:   DraftLease[];
  ecl:      DraftEcl[];
  deposits: DraftSecurityDeposit[];
  reserves: DraftMaintenanceReserve[];
  // Whether the user explicitly chose to skip the optional sections.
  skipEcl:  boolean;
  skipSdMr: boolean;
}

export function emptyDraftPortfolio(): DraftPortfolio {
  return {
    name: "",
    description: "",
    base_currency: "USD",
    aircraft: [],
    lessees: [],
    leases: [],
    ecl: [],
    deposits: [],
    reserves: [],
    skipEcl: false,
    skipSdMr: false,
  };
}

// ─── Local-ID helper ─────────────────────────────────────────────────────────

let _idSeq = 0;
export function newLocalId(prefix: string): string {
  _idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_idSeq}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationIssue {
  step: number;
  message: string;
}

export function validateStep(step: number, draft: DraftPortfolio): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (step === 1) {
    if (!draft.name.trim()) issues.push({ step: 1, message: "Portfolio name is required." });
  }
  if (step === 2) {
    if (draft.aircraft.length === 0) {
      issues.push({ step: 2, message: "Add at least one aircraft." });
    }
    draft.aircraft.forEach((a, i) => {
      if (!a.registration.trim()) issues.push({ step: 2, message: `Aircraft #${i + 1}: registration is required.` });
      if (!a.msn.trim())          issues.push({ step: 2, message: `Aircraft #${i + 1}: MSN is required.` });
      if (!a.aircraft_type.trim()) issues.push({ step: 2, message: `Aircraft #${i + 1}: type is required.` });
    });
  }
  if (step === 3) {
    if (draft.lessees.length === 0) {
      issues.push({ step: 3, message: "Add at least one lessee." });
    }
    draft.lessees.forEach((l, i) => {
      if (!l.name.trim()) issues.push({ step: 3, message: `Lessee #${i + 1}: name is required.` });
    });
  }
  if (step === 4) {
    if (draft.leases.length === 0) {
      issues.push({ step: 4, message: "Add at least one lease." });
    }
    draft.leases.forEach((ls, i) => {
      if (!ls.aircraftLocalId) issues.push({ step: 4, message: `Lease #${i + 1}: pick an aircraft.` });
      if (!ls.lesseeLocalId)   issues.push({ step: 4, message: `Lease #${i + 1}: pick a lessee.` });
      if (!ls.start_date)      issues.push({ step: 4, message: `Lease #${i + 1}: start date is required.` });
      if (!ls.end_date)        issues.push({ step: 4, message: `Lease #${i + 1}: end date is required.` });
    });
  }
  return issues;
}

// ─── Feature-gate copy ───────────────────────────────────────────────────────

export const ECL_GATED_FEATURES = [
  "IFRS 9 Risk page — stage migration table and ECL drilldown",
  "Scenario Builder — base ECL for all scenario simulations",
  "Dashboard — Total ECL KPI and stage-3 watchlist count",
];

export const SDMR_GATED_FEATURES = [
  "Maintenance Reserves page — portfolio MR grid and cashflow chart",
  "MR Health Card on the Dashboard",
  "Aircraft Detail tab — per-component MR balance projection",
  "Scenario Modelling tab in Maintenance — what-if FH/cycle adjustments",
];
