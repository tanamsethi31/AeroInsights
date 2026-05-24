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

// T-1.4–T-1.8 — handlers come in subsequent commits. Types here are deliberate
// stubs so the ParsedWorkbook shape is stable across the Phase 1 slices.
export type ParsedSdMrRow            = Record<string, unknown> & { _rowIndex: number; _errors: string[] };
export type ParsedIfrs9EclRow        = Record<string, unknown> & { _rowIndex: number; _errors: string[] };
export type ParsedSicrTriggerRow     = Record<string, unknown> & { _rowIndex: number; _errors: string[] };
export type ParsedStressScenarioRow  = Record<string, unknown> & { _rowIndex: number; _errors: string[] };
export type ParsedJurisdictionLgdRow = Record<string, unknown> & { _rowIndex: number; _errors: string[] };

export interface ParsedWorkbook {
  /** Sheets we actually found and parsed. Missing sheets are absent from this object. */
  sheets: {
    lessees?:         ParsedLesseeRow[];
    aircraft?:        ParsedAircraftRow[];
    leases?:          ParsedLeaseRow[];
    sdMr?:            ParsedSdMrRow[];
    ifrs9Ecl?:        ParsedIfrs9EclRow[];
    sicrTriggers?:    ParsedSicrTriggerRow[];
    stressScenarios?: ParsedStressScenarioRow[];
    jurisdictionLgd?: ParsedJurisdictionLgdRow[];
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
  // SD/MR, IFRS-9 ECL, SICR, Stress Scenarios, Jurisdiction LGD: stubs land
  // in the next Phase 1 slice. We deliberately omit them from `sheets` rather
  // than emit empty arrays so callers can distinguish "not parsed yet" from
  // "parsed but empty".

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
