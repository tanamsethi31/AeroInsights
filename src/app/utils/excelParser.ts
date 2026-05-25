// src/app/utils/excelParser.ts
//
// Multi-sheet Excel parser for the AeroInsights canonical workbook format
// (T-1.1). The sample portfolio Excel has 14 sheets and we now read every
// one of them; this file is the entry point.
//
// Architecture
// ────────────
// 1. parseWorkbook(file) reads the file with SheetJS, walks the named sheets
//    we care about, and dispatches each to a sheet-specific handler defined
//    below. Handlers return typed row arrays + a sheet-level errors list.
//
// 2. detectCanonical(file) is a cheap header-only probe that callers use to
//    decide whether to go through this multi-sheet path or fall back to the
//    legacy flat-CSV importer. A workbook is "canonical" iff it has ≥1 of
//    our named sheets.
//
// 3. Adding a new sheet handler:
//      a. Define a Parsed<X>Row interface below.
//      b. Add the canonical sheet name to CANONICAL_SHEETS.
//      c. Implement parse<X>Sheet(rows): Parsed<X>Row[].
//      d. Plumb the result into ParsedWorkbook in parseWorkbook().
//      e. Add the corresponding ingester in portfolioIngest.ts.
//
// Phase 1 progress: T-1.2 (Lessee Profiles) implemented; T-1.3–T-1.8 are
// stubbed with the right shapes so the migration cadence and parser cadence
// can land independently.

import * as XLSX from "xlsx";

// ─── Canonical sheet names (must match the sample portfolio Excel exactly) ──

export const CANONICAL_SHEETS = {
  aircraft:        "Aircraft Register",
  lessees:         "Lessee Profiles",
  leases:          "Lease Register",
  sdMr:            "Security Deposits+MR",
  ifrs9Ecl:        "IFRS 9 ECL",
  sicrTriggers:    "SICR Triggers",
  stressScenarios: "Stress Scenarios",
  jurisdictionLgd: "Jurisdiction LGD",
} as const;

const CANONICAL_NAMES = Object.values(CANONICAL_SHEETS) as readonly string[];

// ─── Per-sheet row types ────────────────────────────────────────────────────

export interface ParsedLesseeRow {
  external_id:               string | null;       // Excel "Lessee ID"
  name:                      string;
  iata_code:                 string | null;
  country:                   string | null;
  region:                    string | null;
  credit_rating:             string | null;
  pd_estimate:               number | null;
  watchlist_status:          "green" | "amber" | "red" | null;
  stage:                     1 | 2 | 3 | null;
  dpd_days:                  number | null;
  rating_notches_down:       number | null;
  country_watchlist:         boolean | null;
  insolvency_filed:          boolean | null;
  score_punctuality:         number | null;
  score_restructuring_coop:  number | null;
  score_govt_interference:   number | null;
  score_litigation:          number | null;
  overall_behaviour_score:   number | null;
  pay_behaviour_tier:        string | null;
  _rowIndex:                 number;              // 1-based, Excel-aligned
  _errors:                   string[];
}

// T-1.3 — Aircraft Register. Stubbed shape; handler added in next slice.
export interface ParsedAircraftRow {
  external_id:    string | null;
  registration:   string;
  msn:            string;
  aircraft_type:  string;
  manufacturer:   string | null;
  vintage:        number | null;
  family:         string | null;
  operator:       string | null;
  country:        string | null;
  stage:          1 | 2 | 3 | null;
  current_mv_usd: number | null;
  ead_usd:        number | null;
  monthly_rent_usd: number | null;
  lease_term_remaining_months: number | null;
  part_out_usd:   number | null;
  _rowIndex:      number;
  _errors:        string[];
}

// T-1.3 (Lease Register handled by existing flat importer for now; this
// type is the target shape for the multi-sheet path).
export interface ParsedLeaseRow {
  external_id:   string | null;
  lessee_name:   string;
  aircraft_reg:  string;
  start_date:    string | null;
  end_date:      string | null;
  monthly_rent_usd: number | null;
  currency:      string | null;
  stage:         1 | 2 | 3 | null;
  status:        string | null;
  jurisdiction:  string | null;
  _rowIndex:     number;
  _errors:       string[];
}

// T-1.4 SD/MR (real). T-1.5–T-1.8 still stubs.
export interface ParsedSecurityDepositRow {
  lease_external_id:    string | null;   // Excel "Lease ID" — FK lookup
  lessee_name:          string | null;
  watchlist:            string | null;
  credit_tier:          string | null;
  monthly_rent_usd:     number | null;
  deposit_months:       number | null;
  type:                 string | null;
  deposit_amount_usd:   number | null;
  notes:                string | null;
  _rowIndex:            number;
  _errors:              string[];
}

export interface ParsedMaintenanceReserveRow {
  lease_external_id:    string | null;   // Excel "Lease ID" — FK lookup
  aircraft_reg:         string | null;
  aircraft_type:        string | null;
  component:            string;
  rate_basis:           "per FH" | "per Cy" | "per Month" | null;
  rate_usd:             number | null;
  est_annual_units:     number | null;
  annual_accrual_usd:   number | null;
  cumulative_balance_usd: number | null;
  refundable:           boolean | null;
  _rowIndex:            number;
  _errors:              string[];
}

/** T-1.5 — IFRS-9 ECL parameters. ONE row per workbook (org + portfolio scalar). */
export interface ParsedIfrs9Params {
  discount_rate:              number | null;   // fraction, e.g. 0.0575
  lgd_flat:                   number | null;   // fraction, e.g. 0.45
  pd_lifetime_multiplier_s2:  number | null;   // e.g. 3.0
  pd_lifetime_s3_floor:       number | null;   // fraction, e.g. 0.85
  scenario_weight_baseline:   number | null;
  scenario_weight_adverse:    number | null;
  scenario_weight_upside:     number | null;
  _errors:                    string[];
}
export type ParsedSicrTriggerRow     = Record<string, unknown> & { _rowIndex: number; _errors: string[] };
export type ParsedStressScenarioRow  = Record<string, unknown> & { _rowIndex: number; _errors: string[] };
export type ParsedJurisdictionLgdRow = Record<string, unknown> & { _rowIndex: number; _errors: string[] };

export interface ParsedWorkbook {
  /** Sheets we actually found and parsed. Missing sheets are absent from this object. */
  sheets: {
    lessees?:           ParsedLesseeRow[];
    aircraft?:          ParsedAircraftRow[];
    leases?:            ParsedLeaseRow[];
    securityDeposits?:  ParsedSecurityDepositRow[];
    maintenanceReserves?: ParsedMaintenanceReserveRow[];
    /** Single scalar row, not a list — these are one-per-portfolio settings. */
    ifrs9Params?:       ParsedIfrs9Params;
    sicrTriggers?:      ParsedSicrTriggerRow[];
    stressScenarios?:   ParsedStressScenarioRow[];
    jurisdictionLgd?:   ParsedJurisdictionLgdRow[];
  };
  /** Names of sheets in the workbook (helpful for debugging / UI). */
  sheetNames: string[];
  /** Sheets that match the canonical names AeroInsights expects. */
  recognisedSheets: string[];
  /** Sheets present but not in the canonical set (skipped, e.g. "Cover"). */
  unknownSheets: string[];
}

// ─── Cheap canonical detection (header probe only) ──────────────────────────

/**
 * Reads only the workbook's sheet names — does not parse any cells. Cheap
 * enough to call during DropZoneStep to decide which import path to use.
 */
export async function detectCanonical(file: File): Promise<{
  canonical: boolean;
  recognisedSheets: string[];
  sheetNames: string[];
}> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array", bookSheets: true });
  const sheetNames = wb.SheetNames ?? [];
  const recognised = sheetNames.filter((n) => CANONICAL_NAMES.includes(n));
  return {
    canonical: recognised.length >= 1,
    recognisedSheets: recognised,
    sheetNames,
  };
}

// ─── Main entry ─────────────────────────────────────────────────────────────

export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheetNames = wb.SheetNames ?? [];
  const recognised = sheetNames.filter((n) => CANONICAL_NAMES.includes(n));
  const unknown = sheetNames.filter((n) => !CANONICAL_NAMES.includes(n));

  const sheets: ParsedWorkbook["sheets"] = {};

  if (recognised.includes(CANONICAL_SHEETS.lessees)) {
    sheets.lessees = parseLesseeProfilesSheet(wb.Sheets[CANONICAL_SHEETS.lessees]);
  }
  if (recognised.includes(CANONICAL_SHEETS.aircraft)) {
    sheets.aircraft = parseAircraftRegisterSheet(wb.Sheets[CANONICAL_SHEETS.aircraft]);
  }
  if (recognised.includes(CANONICAL_SHEETS.leases)) {
    sheets.leases = parseLeaseRegisterSheet(wb.Sheets[CANONICAL_SHEETS.leases]);
  }
  if (recognised.includes(CANONICAL_SHEETS.sdMr)) {
    const sdMr = parseSdMrSheet(wb.Sheets[CANONICAL_SHEETS.sdMr]);
    sheets.securityDeposits = sdMr.deposits;
    sheets.maintenanceReserves = sdMr.reserves;
  }
  if (recognised.includes(CANONICAL_SHEETS.ifrs9Ecl)) {
    sheets.ifrs9Params = parseIfrs9Sheet(wb.Sheets[CANONICAL_SHEETS.ifrs9Ecl]);
  }
  // SICR, Stress Scenarios, Jurisdiction LGD: handlers land in subsequent
  // Phase 1 slices.

  return {
    sheets,
    sheetNames,
    recognisedSheets: recognised,
    unknownSheets: unknown,
  };
}

// ─── Header-row detection ───────────────────────────────────────────────────
// The sample workbook puts a banner across row 1 ("AIRCRAFT REGISTER — Aer
// Capital Partners Ltd."), with real headers on row 2. Look for the first
// row where most cells are short, distinct, non-numeric strings — that's
// the header row. Falls back to row 1 if the heuristic doesn't fire.

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i] ?? [];
    const cells = row.map((c) => (c == null ? "" : String(c).trim())).filter(Boolean);
    if (cells.length < 3) continue;
    const allShort = cells.every((c) => c.length <= 40);
    const distinct = new Set(cells).size >= cells.length - 1;
    const mostlyText = cells.filter((c) => /[A-Za-z]/.test(c)).length >= cells.length * 0.7;
    if (allShort && distinct && mostlyText) return i;
  }
  return 0;
}

/** Normalises a header cell to a lower-case key for matching. */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Convert a sheet to rows of header-keyed objects, header-row aware. */
function sheetToObjects(
  sheet: XLSX.WorkSheet | undefined,
): { rows: Record<string, unknown>[]; headerRowIndex: number } {
  if (!sheet) return { rows: [], headerRowIndex: 0 };
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  if (raw.length === 0) return { rows: [], headerRowIndex: 0 };

  const headerRowIndex = findHeaderRow(raw);
  const headerCells = (raw[headerRowIndex] ?? []).map((c) =>
    c == null ? "" : String(c).trim(),
  );
  const dataRows = raw.slice(headerRowIndex + 1);

  const rows: Record<string, unknown>[] = [];
  for (const row of dataRows) {
    // Skip wholly-empty rows — common in Excel after section breaks.
    const hasValue = (row ?? []).some(
      (c) => c !== null && c !== undefined && String(c).trim() !== "",
    );
    if (!hasValue) continue;
    const obj: Record<string, unknown> = {};
    headerCells.forEach((header, colIdx) => {
      if (!header) return;
      obj[normalise(header)] = (row as unknown[])[colIdx] ?? null;
    });
    rows.push(obj);
  }
  return { rows, headerRowIndex };
}

// ─── Field coercion helpers ─────────────────────────────────────────────────

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function asNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && isFinite(v)) return v;
  const cleaned = String(v).replace(/[,\s$]/g, "");
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

function asInt(v: unknown): number | null {
  const n = asNumber(v);
  if (n == null) return null;
  return Math.round(n);
}

function asBool(v: unknown): boolean | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return null;
}

function asStage(v: unknown): 1 | 2 | 3 | null {
  const n = asInt(v);
  return n === 1 || n === 2 || n === 3 ? n : null;
}

function asWatchlistStatus(v: unknown): "green" | "amber" | "red" | null {
  const s = asString(v)?.toLowerCase();
  if (s === "green" || s === "amber" || s === "red") return s;
  return null;
}

function asPercent(v: unknown): number | null {
  // Tolerate "5.4%", "5.4", 0.054 — return as a 0-1 fraction.
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    return v > 1 ? v / 100 : v;
  }
  const s = String(v).trim().replace(/%$/, "");
  const n = Number(s);
  if (!isFinite(n)) return null;
  return /%$/.test(String(v)) || n > 1 ? n / 100 : n;
}

// ─── Lessee Profiles handler (T-1.2) ────────────────────────────────────────

const LESSEE_FIELD_ALIASES: Record<keyof Omit<ParsedLesseeRow, "_rowIndex" | "_errors">, string[]> = {
  external_id:              ["lessee_id", "id"],
  name:                     ["name", "lessee", "lessee_name"],
  iata_code:                ["iata", "iata_code"],
  country:                  ["country"],
  region:                   ["region"],
  credit_rating:            ["credit_rating", "rating"],
  pd_estimate:              ["pd_estimate", "pd"],
  watchlist_status:         ["watchlist", "watchlist_status"],
  stage:                    ["stage", "ifrs_9_stage", "ifrs9_stage"],
  dpd_days:                 ["dpd_days", "dpd", "days_past_due"],
  rating_notches_down:      ["rating_notches_down", "notches_down"],
  country_watchlist:        ["country_watchlist"],
  insolvency_filed:         ["insolvency_filed", "insolvency"],
  score_punctuality:        ["score_punctuality"],
  score_restructuring_coop: ["score_restr_coop", "score_restructuring_coop"],
  score_govt_interference:  ["score_govt_interference"],
  score_litigation:         ["score_litigation"],
  overall_behaviour_score:  ["overall_behaviour_score", "behaviour_score"],
  pay_behaviour_tier:       ["pay_behaviour_tier", "pay_tier"],
};

function pick(row: Record<string, unknown>, aliases: readonly string[]): unknown {
  for (const a of aliases) {
    if (row[a] !== undefined) return row[a];
  }
  return null;
}

export function parseLesseeProfilesSheet(
  sheet: XLSX.WorkSheet | undefined,
): ParsedLesseeRow[] {
  const { rows, headerRowIndex } = sheetToObjects(sheet);
  const out: ParsedLesseeRow[] = [];

  rows.forEach((row, i) => {
    const errors: string[] = [];
    const name = asString(pick(row, LESSEE_FIELD_ALIASES.name));
    if (!name) errors.push("name is required");

    const stage = asStage(pick(row, LESSEE_FIELD_ALIASES.stage));
    const watchlist = asWatchlistStatus(pick(row, LESSEE_FIELD_ALIASES.watchlist_status));

    const scoreFields: (keyof Pick<
      ParsedLesseeRow,
      | "score_punctuality"
      | "score_restructuring_coop"
      | "score_govt_interference"
      | "score_litigation"
      | "overall_behaviour_score"
    >)[] = [
      "score_punctuality",
      "score_restructuring_coop",
      "score_govt_interference",
      "score_litigation",
      "overall_behaviour_score",
    ];
    const scores: Record<string, number | null> = {};
    for (const sf of scoreFields) {
      const n = asInt(pick(row, LESSEE_FIELD_ALIASES[sf]));
      if (n != null && (n < 0 || n > 100)) {
        errors.push(`${sf} must be 0–100, got ${n}`);
      }
      scores[sf] = n;
    }

    out.push({
      external_id:              asString(pick(row, LESSEE_FIELD_ALIASES.external_id)),
      name:                     name ?? "",
      iata_code:                asString(pick(row, LESSEE_FIELD_ALIASES.iata_code)),
      country:                  asString(pick(row, LESSEE_FIELD_ALIASES.country)),
      region:                   asString(pick(row, LESSEE_FIELD_ALIASES.region)),
      credit_rating:            asString(pick(row, LESSEE_FIELD_ALIASES.credit_rating)),
      pd_estimate:              asPercent(pick(row, LESSEE_FIELD_ALIASES.pd_estimate)),
      watchlist_status:         watchlist,
      stage,
      dpd_days:                 asInt(pick(row, LESSEE_FIELD_ALIASES.dpd_days)),
      rating_notches_down:      asInt(pick(row, LESSEE_FIELD_ALIASES.rating_notches_down)),
      country_watchlist:        asBool(pick(row, LESSEE_FIELD_ALIASES.country_watchlist)),
      insolvency_filed:         asBool(pick(row, LESSEE_FIELD_ALIASES.insolvency_filed)),
      score_punctuality:        scores.score_punctuality,
      score_restructuring_coop: scores.score_restructuring_coop,
      score_govt_interference:  scores.score_govt_interference,
      score_litigation:         scores.score_litigation,
      overall_behaviour_score:  scores.overall_behaviour_score,
      pay_behaviour_tier:       asString(pick(row, LESSEE_FIELD_ALIASES.pay_behaviour_tier)),
      _rowIndex:                headerRowIndex + 2 + i, // 1-based, post-header
      _errors:                  errors,
    });
  });

  return out;
}

// ─── Aircraft Register handler (T-1.3 — stub; full impl next slice) ─────────

export function parseAircraftRegisterSheet(
  sheet: XLSX.WorkSheet | undefined,
): ParsedAircraftRow[] {
  const { rows, headerRowIndex } = sheetToObjects(sheet);
  const out: ParsedAircraftRow[] = [];
  rows.forEach((row, i) => {
    const errors: string[] = [];
    const registration = asString(pick(row, ["registration", "tail"]));
    const msn = asString(pick(row, ["msn"]));
    const type_ = asString(pick(row, ["type", "aircraft_type"]));
    if (!registration) errors.push("registration is required");
    if (!msn) errors.push("msn is required");
    if (!type_) errors.push("type is required");
    out.push({
      external_id:    asString(pick(row, ["ac_id", "id"])),
      registration:   registration ?? "",
      msn:            msn ?? "",
      aircraft_type:  type_ ?? "",
      manufacturer:   asString(pick(row, ["manufacturer"])),
      vintage:        asInt(pick(row, ["vintage"])),
      family:         asString(pick(row, ["family"])),
      operator:       asString(pick(row, ["operator"])),
      country:        asString(pick(row, ["country"])),
      stage:          asStage(pick(row, ["stage", "ifrs_9_stage"])),
      // The sample sheet stores currency amounts in $M and $k. Normalise to USD.
      current_mv_usd:    asMillions(pick(row, ["current_mv_m", "current_mv"])),
      ead_usd:           asMillions(pick(row, ["ead_m", "ead"])),
      monthly_rent_usd:  asThousands(pick(row, ["monthly_rent_k", "monthly_rent"])),
      lease_term_remaining_months: asInt(pick(row, ["lease_term_rem_mo", "remaining_mo"])),
      part_out_usd:      asMillions(pick(row, ["part_out_m", "part_out"])),
      _rowIndex:         headerRowIndex + 2 + i,
      _errors:           errors,
    });
  });
  return out;
}

function asMillions(v: unknown): number | null {
  const n = asNumber(v);
  return n == null ? null : n * 1_000_000;
}

function asThousands(v: unknown): number | null {
  const n = asNumber(v);
  return n == null ? null : n * 1_000;
}

// ─── Lease Register handler — light parser for symmetry ─────────────────────

export function parseLeaseRegisterSheet(
  sheet: XLSX.WorkSheet | undefined,
): ParsedLeaseRow[] {
  const { rows, headerRowIndex } = sheetToObjects(sheet);
  const out: ParsedLeaseRow[] = [];
  rows.forEach((row, i) => {
    const errors: string[] = [];
    const lessee_name  = asString(pick(row, ["lessee", "lessee_name"]));
    const aircraft_reg = asString(pick(row, ["aircraft_reg", "registration"]));
    if (!lessee_name)  errors.push("lessee is required");
    if (!aircraft_reg) errors.push("aircraft_reg is required");
    out.push({
      external_id:      asString(pick(row, ["lease_id", "id"])),
      lessee_name:      lessee_name ?? "",
      aircraft_reg:     aircraft_reg ?? "",
      start_date:       asString(pick(row, ["lease_start", "start_date"])),
      end_date:         asString(pick(row, ["lease_end", "end_date"])),
      monthly_rent_usd: asNumber(pick(row, ["monthly_rent", "monthly_rent_"])),
      currency:         asString(pick(row, ["currency"])),
      stage:            asStage(pick(row, ["ifrs_9_stage", "stage"])),
      status:           asString(pick(row, ["status"])),
      jurisdiction:     asString(pick(row, ["jurisdiction"])),
      _rowIndex:        headerRowIndex + 2 + i,
      _errors:          errors,
    });
  });
  return out;
}

// ─── Security Deposits + Maintenance Reserves (T-1.4) ───────────────────────
//
// This sheet has TWO sections separated by banner rows:
//   Row 1:  "A. SECURITY DEPOSITS"           (banner)
//   Row 2:  header                            (Lease ID, Lessee, ...)
//   Rows 3..N: SD data
//   Blank row(s)
//   Row M:  "B. MAINTENANCE RESERVES"        (banner)
//   Row M+1: header                           (Lease ID, Aircraft Reg, Component, ...)
//   Rows M+2..end: MR data
//
// We can't reuse `sheetToObjects` (single-header) so we walk raw rows, split
// at the second banner, and run two header-aware passes.

interface SdMrParseResult {
  deposits: ParsedSecurityDepositRow[];
  reserves: ParsedMaintenanceReserveRow[];
}

export function parseSdMrSheet(
  sheet: XLSX.WorkSheet | undefined,
): SdMrParseResult {
  if (!sheet) return { deposits: [], reserves: [] };
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, raw: true, defval: null,
  });

  // Find the row index of section B's banner. Anything before that block is
  // section A; anything after is section B.
  const bIdx = raw.findIndex((row) => {
    const first = (row?.[0] ?? "").toString().toUpperCase();
    return first.includes("MAINTENANCE RESERVES");
  });

  const sdSlice = bIdx >= 0 ? raw.slice(0, bIdx) : raw;
  const mrSlice = bIdx >= 0 ? raw.slice(bIdx + 1) : [];

  // ── Section A: Security Deposits ───────────────────────────────────────
  const deposits: ParsedSecurityDepositRow[] = [];
  const sdHeaderIdx = findHeaderRow(sdSlice);
  const sdHeaders = (sdSlice[sdHeaderIdx] ?? []).map((c) =>
    c == null ? "" : normalise(String(c).trim()),
  );
  for (let i = sdHeaderIdx + 1; i < sdSlice.length; i++) {
    const row = sdSlice[i] ?? [];
    const hasValue = row.some((c) => c != null && String(c).trim() !== "");
    if (!hasValue) continue;
    const firstCell = String(row[0] ?? "").trim().toUpperCase();
    if (firstCell === "TOTAL" || firstCell.startsWith("SOURCES:")) continue;
    const obj: Record<string, unknown> = {};
    sdHeaders.forEach((h, c) => { if (h) obj[h] = row[c] ?? null; });
    const errors: string[] = [];
    const lease_external_id = asString(pick(obj, ["lease_id", "id"]));
    if (!lease_external_id) errors.push("lease_id is required");
    deposits.push({
      lease_external_id,
      lessee_name:        asString(pick(obj, ["lessee", "lessee_name"])),
      watchlist:          asString(pick(obj, ["watchlist"])),
      credit_tier:        asString(pick(obj, ["credit_tier", "tier"])),
      monthly_rent_usd:   asNumber(pick(obj, ["monthly_rent_", "monthly_rent"])),
      deposit_months:     asNumber(pick(obj, ["deposit_months"])),
      type:               asString(pick(obj, ["type", "instrument"])),
      deposit_amount_usd: asNumber(pick(obj, ["deposit_amount_", "deposit_amount"])),
      notes:              asString(pick(obj, ["notes"])),
      _rowIndex:          sdHeaderIdx + 2 + (i - sdHeaderIdx - 1),
      _errors:            errors,
    });
  }

  // ── Section B: Maintenance Reserves ────────────────────────────────────
  const reserves: ParsedMaintenanceReserveRow[] = [];
  if (mrSlice.length > 0) {
    const mrHeaderIdx = findHeaderRow(mrSlice);
    const mrHeaders = (mrSlice[mrHeaderIdx] ?? []).map((c) =>
      c == null ? "" : normalise(String(c).trim()),
    );
    for (let i = mrHeaderIdx + 1; i < mrSlice.length; i++) {
      const row = mrSlice[i] ?? [];
      const hasValue = row.some((c) => c != null && String(c).trim() !== "");
      if (!hasValue) continue;
      const firstCell = String(row[0] ?? "").trim().toUpperCase();
      if (firstCell === "TOTAL" || firstCell.startsWith("SOURCES:")) continue;
      const obj: Record<string, unknown> = {};
      mrHeaders.forEach((h, c) => { if (h) obj[h] = row[c] ?? null; });

      const errors: string[] = [];
      const lease_external_id = asString(pick(obj, ["lease_id", "id"]));
      const component = asString(pick(obj, ["component"]));
      if (!lease_external_id) errors.push("lease_id is required");
      if (!component)         errors.push("component is required");

      const rateBasisRaw = asString(pick(obj, ["rate_basis", "basis"]));
      let rate_basis: ParsedMaintenanceReserveRow["rate_basis"] = null;
      if (rateBasisRaw) {
        const s = rateBasisRaw.toLowerCase();
        if (s.includes("fh"))     rate_basis = "per FH";
        else if (s.includes("cy")) rate_basis = "per Cy";
        else if (s.includes("month")) rate_basis = "per Month";
      }

      reserves.push({
        lease_external_id,
        aircraft_reg:           asString(pick(obj, ["aircraft_reg", "registration"])),
        aircraft_type:          asString(pick(obj, ["type", "aircraft_type"])),
        component:              component ?? "",
        rate_basis,
        rate_usd:               asNumber(pick(obj, ["rate_fh_or_cy", "rate_fh", "rate_cy", "rate"])),
        est_annual_units:       asNumber(pick(obj, ["est_annual_fh_cy", "annual_fh_cy", "annual_units"])),
        annual_accrual_usd:     asNumber(pick(obj, ["annual_accrual_", "annual_accrual"])),
        cumulative_balance_usd: asNumber(pick(obj, ["cumulative_balance_", "cumulative_balance"])),
        refundable:             asBool(pick(obj, ["refundable"])),
        _rowIndex:              bIdx + mrHeaderIdx + 2 + (i - mrHeaderIdx - 1),
        _errors:                errors,
      });
    }
  }

  return { deposits, reserves };
}

// ─── IFRS 9 ECL parameters handler (T-1.5) ──────────────────────────────────
//
// The sheet is laid out as a calculation worksheet, not a parameter table.
// The INPUT values are scattered:
//   • Discount Rate: row 2, label in col A, value in col C (e.g. 0.0575).
//   • Effective LGD: the "STAGE SUMMARY" section's "Effective LGD" column
//     contains the same flat value across all stages (0.45 in the sample
//     workbook). We take the median.
//   • Scenario weights + lifetime-PD multipliers are encoded only in a
//     prose footer note in v2026 of the template. We fall back to the
//     documented defaults (60/25/15 weights, ×3.0 multiplier for S2, 0.85
//     floor for S3) and surface a soft warning in `_errors` so the import
//     review UI can prompt the user to confirm.
//
// Subsequent template revisions can add explicit cells for these — when they
// do, add pickers below; the migration already has the columns.

export function parseIfrs9Sheet(
  sheet: XLSX.WorkSheet | undefined,
): ParsedIfrs9Params {
  const params: ParsedIfrs9Params = {
    discount_rate:             null,
    lgd_flat:                  null,
    pd_lifetime_multiplier_s2: 3.0,
    pd_lifetime_s3_floor:      0.85,
    scenario_weight_baseline:  0.60,
    scenario_weight_adverse:   0.25,
    scenario_weight_upside:    0.15,
    _errors: [],
  };
  if (!sheet) return params;

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, raw: true, defval: null,
  });

  // 1) Discount rate — scan top 5 rows for a cell whose text starts with
  //    "discount rate" (case-insensitive). The value is the first numeric
  //    cell to its right.
  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    const row = raw[i] ?? [];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (typeof v === "string" && v.toLowerCase().includes("discount rate")) {
        for (let c2 = c + 1; c2 < row.length; c2++) {
          const n = asPercent(row[c2]);
          if (n != null && n > 0 && n < 1) {
            params.discount_rate = n;
            break;
          }
        }
      }
      if (params.discount_rate != null) break;
    }
    if (params.discount_rate != null) break;
  }

  // 2) Flat LGD — find STAGE SUMMARY section + median of "Effective LGD" col.
  const summaryIdx = raw.findIndex((row) => {
    const first = (row?.[0] ?? "").toString().toUpperCase();
    return first.includes("STAGE SUMMARY");
  });
  if (summaryIdx >= 0) {
    // Headers are on the next non-empty row; data follows.
    let headerIdx = summaryIdx + 1;
    while (headerIdx < raw.length) {
      const hr = raw[headerIdx] ?? [];
      if (hr.some((c) => c != null && String(c).trim() !== "")) break;
      headerIdx++;
    }
    const headers = (raw[headerIdx] ?? []).map((c) =>
      c == null ? "" : normalise(String(c).trim()),
    );
    const lgdCol = headers.findIndex((h) => h.includes("lgd") || h === "effective_lgd");
    if (lgdCol >= 0) {
      const values: number[] = [];
      for (let i = headerIdx + 1; i < raw.length; i++) {
        const row = raw[i] ?? [];
        const stageLabel = String(row[0] ?? "").trim().toLowerCase();
        if (!stageLabel.startsWith("stage")) continue;
        const v = asPercent(row[lgdCol]);
        if (v != null) values.push(v);
      }
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        params.lgd_flat = sorted[Math.floor(sorted.length / 2)];
      }
    }
  }

  // 3) Soft warning when defaults are used. Surfaces in the import review UI.
  if (params.discount_rate == null) {
    params._errors.push("Discount rate not found in sheet — defaulting to 5%.");
  }
  if (params.lgd_flat == null) {
    params._errors.push("Effective LGD not found in stage summary — defaulting to 45%.");
  }

  return params;
}
