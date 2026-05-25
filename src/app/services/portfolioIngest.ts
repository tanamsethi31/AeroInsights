// src/app/services/portfolioIngest.ts
//
// Writes ParsedWorkbook results to Supabase (T-1.2 onwards). Each sheet has
// a dedicated ingester so per-sheet error handling stays explicit. The
// orchestrator at the bottom (`ingestWorkbook`) runs them in dependency order
// and aggregates per-sheet counts for the UI.
//
// Per ADR-002, every analytical write goes through (org_id, portfolio_id).
// The caller resolves portfolio_id once (either passing an existing one or
// creating a new one in ReviewImportStep) and threads it through.
//
// Re-import semantics (T-1.10 prep): when a row carries `external_id`, we
// upsert on the unique (org_id, portfolio_id, external_id) index added in
// migration 20260524130000. When external_id is null we always insert,
// duplicating any prior row — caller must dedupe before passing.

import { supabase } from "../lib/supabase";
import type {
  ParsedAircraftRow,
  ParsedIfrs9Params,
  ParsedLeaseRow,
  ParsedLesseeRow,
  ParsedMaintenanceReserveRow,
  ParsedSecurityDepositRow,
  ParsedWorkbook,
} from "../utils/excelParser";

// ─── Result shapes ──────────────────────────────────────────────────────────

export interface SheetIngestResult {
  sheet: string;
  attempted: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface WorkbookIngestResult {
  uploadId: string;
  portfolioId: string;
  sheetResults: SheetIngestResult[];
  totalAttempted: number;
  totalInserted: number;
  totalUpdated: number;
  totalErrors: number;
}

interface CommonContext {
  orgId: string;
  portfolioId: string;
  uploadId: string | null;
}

// ─── Lessee Profiles ingester (T-1.2) ───────────────────────────────────────

export async function ingestLessees(
  rows: ParsedLesseeRow[],
  ctx: CommonContext,
): Promise<SheetIngestResult> {
  const result: SheetIngestResult = {
    sheet:     "Lessee Profiles",
    attempted: rows.length,
    inserted:  0,
    updated:   0,
    skipped:   0,
    errors:    [],
  };

  const valid = rows.filter((r) => {
    if (r._errors.length > 0) {
      result.errors.push(`Row ${r._rowIndex}: ${r._errors.join("; ")}`);
      result.skipped++;
      return false;
    }
    return true;
  });
  if (valid.length === 0) return result;

  // Split: rows WITH external_id → upsert; rows WITHOUT → plain insert.
  const withExt    = valid.filter((r) => r.external_id);
  const withoutExt = valid.filter((r) => !r.external_id);

  if (withExt.length > 0) {
    const payload = withExt.map((r) => toDbRow(r, ctx));
    const { data, error } = await supabase
      .from("lessees")
      .upsert(payload, {
        onConflict: "org_id,portfolio_id,external_id",
        ignoreDuplicates: false,
      })
      .select("id");
    if (error) {
      result.errors.push(`Upsert (with external_id): ${error.message}`);
    } else if (data) {
      // Supabase doesn't distinguish insert vs update on upsert. Treat all as
      // "inserted" — a later T-1.10 diff pass will surface real update counts
      // by reading existing rows first.
      result.inserted += data.length;
    }
  }

  if (withoutExt.length > 0) {
    const payload = withoutExt.map((r) => toDbRow(r, ctx));
    const { data, error } = await supabase
      .from("lessees")
      .insert(payload)
      .select("id");
    if (error) {
      result.errors.push(`Insert (no external_id): ${error.message}`);
    } else if (data) {
      result.inserted += data.length;
    }
  }

  return result;
}

function toDbRow(r: ParsedLesseeRow, ctx: CommonContext) {
  return {
    org_id:                   ctx.orgId,
    portfolio_id:             ctx.portfolioId,
    external_id:              r.external_id,
    name:                     r.name,
    iata_code:                r.iata_code,
    country:                  r.country,
    region:                   r.region,
    credit_rating:            r.credit_rating,
    pd_estimate:              r.pd_estimate,
    watchlist_status:         r.watchlist_status,
    stage:                    r.stage,
    dpd_days:                 r.dpd_days,
    rating_notches_down:      r.rating_notches_down,
    country_watchlist:        r.country_watchlist,
    insolvency_filed:         r.insolvency_filed,
    score_punctuality:        r.score_punctuality,
    score_restructuring_coop: r.score_restructuring_coop,
    score_govt_interference:  r.score_govt_interference,
    score_litigation:         r.score_litigation,
    overall_behaviour_score:  r.overall_behaviour_score,
    pay_behaviour_tier:       r.pay_behaviour_tier,
  };
}

// ─── Aircraft Register ingester (T-1.3) ─────────────────────────────────────
//
// Excel columns → assets columns:
//   AC ID         → external_id           (upsert key when present)
//   Registration  → registration
//   MSN           → msn                   (upsert key when external_id null)
//   Type          → aircraft_type
//   Manufacturer  → manufacturer
//   Vintage       → vintage
//   Family        → family
//   Operator      → current_operator
//   Country       → country
//   Stage         → stage
//   Current MV    → current_mv_usd        (parser already expanded $M → $)
//   Part-Out      → part_out_usd          (parser already expanded $M → $)
//
// EAD / Monthly Rent / Lease Term Remaining are NOT stored on assets — those
// are lease-level facts written by the leases ingester (T-1.3 follow-up).

export async function ingestAircraft(
  rows: ParsedAircraftRow[],
  ctx: CommonContext,
): Promise<SheetIngestResult> {
  const result: SheetIngestResult = {
    sheet:     "Aircraft Register",
    attempted: rows.length,
    inserted:  0,
    updated:   0,
    skipped:   0,
    errors:    [],
  };

  const valid = rows.filter((r) => {
    if (r._errors.length > 0) {
      result.errors.push(`Row ${r._rowIndex}: ${r._errors.join("; ")}`);
      result.skipped++;
      return false;
    }
    return true;
  });
  if (valid.length === 0) return result;

  // Two upsert keys exist in the schema (migration 20260524140000):
  //   external_id partial unique  → rows WITH external_id
  //   msn partial unique           → rows WITHOUT external_id
  // Split the batch so each side gets the right onConflict.

  const withExt    = valid.filter((r) => r.external_id);
  const withoutExt = valid.filter((r) => !r.external_id);

  if (withExt.length > 0) {
    const payload = withExt.map((r) => toAssetDbRow(r, ctx));
    const { data, error } = await supabase
      .from("assets")
      .upsert(payload, {
        onConflict: "org_id,portfolio_id,external_id",
        ignoreDuplicates: false,
      })
      .select("id");
    if (error) {
      result.errors.push(`Upsert (with external_id): ${error.message}`);
    } else if (data) {
      result.inserted += data.length;
    }
  }

  if (withoutExt.length > 0) {
    const payload = withoutExt.map((r) => toAssetDbRow(r, ctx));
    const { data, error } = await supabase
      .from("assets")
      .upsert(payload, {
        onConflict: "org_id,portfolio_id,msn",
        ignoreDuplicates: false,
      })
      .select("id");
    if (error) {
      result.errors.push(`Upsert (by MSN): ${error.message}`);
    } else if (data) {
      result.inserted += data.length;
    }
  }

  return result;
}

function toAssetDbRow(r: ParsedAircraftRow, ctx: CommonContext) {
  return {
    org_id:           ctx.orgId,
    portfolio_id:     ctx.portfolioId,
    upload_id:        ctx.uploadId,
    external_id:      r.external_id,
    registration:     r.registration,
    msn:              r.msn,
    aircraft_type:    r.aircraft_type,
    manufacturer:     r.manufacturer,
    vintage:          r.vintage,
    family:           r.family,
    current_operator: r.operator,
    country:          r.country,
    stage:            r.stage,
    current_mv_usd:   r.current_mv_usd,
    part_out_usd:     r.part_out_usd,
  };
}

// ─── Lease Register ingester (T-1.4 prep) ───────────────────────────────────
//
// Depends on lessees + assets — looks up lessee_id by name and asset_id by
// registration within the (org_id, portfolio_id) scope. Upserts on
// (org_id, portfolio_id, external_id) when Lease ID is present.

export async function ingestLeases(
  rows: ParsedLeaseRow[],
  ctx: CommonContext,
): Promise<SheetIngestResult> {
  const result: SheetIngestResult = {
    sheet:     "Lease Register",
    attempted: rows.length,
    inserted:  0,
    updated:   0,
    skipped:   0,
    errors:    [],
  };

  const valid = rows.filter((r) => {
    if (r._errors.length > 0) {
      result.errors.push(`Row ${r._rowIndex}: ${r._errors.join("; ")}`);
      result.skipped++;
      return false;
    }
    return true;
  });
  if (valid.length === 0) return result;

  // Fetch lessees + assets in scope so we can map names/regs to UUIDs.
  const [{ data: lessees }, { data: assets }] = await Promise.all([
    supabase.from("lessees").select("id, name")
      .eq("org_id", ctx.orgId).eq("portfolio_id", ctx.portfolioId),
    supabase.from("assets").select("id, registration")
      .eq("org_id", ctx.orgId).eq("portfolio_id", ctx.portfolioId),
  ]);

  const lesseeByName = new Map<string, string>();
  for (const l of lessees ?? []) lesseeByName.set(l.name, l.id);

  const assetByReg = new Map<string, string>();
  for (const a of assets ?? []) assetByReg.set(a.registration, a.id);

  const payload: Array<Record<string, unknown>> = [];
  for (const r of valid) {
    const lessee_id = lesseeByName.get(r.lessee_name);
    const asset_id  = assetByReg.get(r.aircraft_reg);
    if (!lessee_id) {
      result.errors.push(`Row ${r._rowIndex}: lessee "${r.lessee_name}" not found in portfolio`);
      result.skipped++;
      continue;
    }
    if (!asset_id) {
      result.errors.push(`Row ${r._rowIndex}: aircraft reg "${r.aircraft_reg}" not found in portfolio`);
      result.skipped++;
      continue;
    }
    payload.push({
      org_id:         ctx.orgId,
      portfolio_id:   ctx.portfolioId,
      lessee_id,
      asset_id,
      external_id:    r.external_id,
      start_date:     r.start_date,
      end_date:       r.end_date,
      monthly_rental: r.monthly_rent_usd,
      currency:       r.currency ?? "USD",
      stage:          r.stage,
      status:         r.status,
      jurisdiction:   r.jurisdiction,
    });
  }
  if (payload.length === 0) return result;

  const withExt    = payload.filter((p) => p.external_id);
  const withoutExt = payload.filter((p) => !p.external_id);

  if (withExt.length > 0) {
    const { data, error } = await supabase
      .from("leases")
      .upsert(withExt, {
        onConflict: "org_id,portfolio_id,external_id",
        ignoreDuplicates: false,
      })
      .select("id");
    if (error) result.errors.push(`Lease upsert (external_id): ${error.message}`);
    else if (data) result.inserted += data.length;
  }
  if (withoutExt.length > 0) {
    const { data, error } = await supabase.from("leases").insert(withoutExt).select("id");
    if (error) result.errors.push(`Lease insert: ${error.message}`);
    else if (data) result.inserted += data.length;
  }

  return result;
}

// ─── Security Deposits ingester (T-1.4) ─────────────────────────────────────
//
// FK lookup: external Lease ID → lease.id within the (org, portfolio) scope.

async function buildLeaseExternalIdMap(ctx: CommonContext): Promise<Map<string, string>> {
  const { data } = await supabase.from("leases")
    .select("id, external_id")
    .eq("org_id", ctx.orgId)
    .eq("portfolio_id", ctx.portfolioId)
    .not("external_id", "is", null);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.external_id) map.set(row.external_id, row.id);
  }
  return map;
}

export async function ingestSecurityDeposits(
  rows: ParsedSecurityDepositRow[],
  ctx: CommonContext,
): Promise<SheetIngestResult> {
  const result: SheetIngestResult = {
    sheet: "Security Deposits", attempted: rows.length,
    inserted: 0, updated: 0, skipped: 0, errors: [],
  };
  const leaseMap = await buildLeaseExternalIdMap(ctx);
  if (leaseMap.size === 0) {
    result.errors.push("No leases with external_id found in this portfolio — ingest leases first.");
    result.skipped = rows.length;
    return result;
  }

  const payload: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    if (r._errors.length > 0) {
      result.errors.push(`Row ${r._rowIndex}: ${r._errors.join("; ")}`);
      result.skipped++;
      continue;
    }
    const lease_id = r.lease_external_id ? leaseMap.get(r.lease_external_id) : undefined;
    if (!lease_id) {
      result.errors.push(`Row ${r._rowIndex}: lease "${r.lease_external_id ?? ""}" not found`);
      result.skipped++;
      continue;
    }
    payload.push({
      org_id:             ctx.orgId,
      portfolio_id:       ctx.portfolioId,
      lease_id,
      deposit_months:     r.deposit_months,
      deposit_amount_usd: r.deposit_amount_usd,
      type:               r.type,
      credit_tier:        r.credit_tier,
      notes:              r.notes,
      source_upload_id:   ctx.uploadId,
      updated_at:         new Date().toISOString(),
    });
  }
  if (payload.length === 0) return result;

  const { data, error } = await supabase
    .from("security_deposits")
    .upsert(payload, {
      onConflict: "org_id,portfolio_id,lease_id",
      ignoreDuplicates: false,
    })
    .select("id");
  if (error) result.errors.push(`Upsert: ${error.message}`);
  else if (data) result.inserted += data.length;
  return result;
}

// ─── Maintenance Reserves ingester (T-1.4) ──────────────────────────────────
//
// Multiple rows per lease (one per component). Upserts on
// (org_id, portfolio_id, lease_id, component).

export async function ingestMaintenanceReserves(
  rows: ParsedMaintenanceReserveRow[],
  ctx: CommonContext,
): Promise<SheetIngestResult> {
  const result: SheetIngestResult = {
    sheet: "Maintenance Reserves", attempted: rows.length,
    inserted: 0, updated: 0, skipped: 0, errors: [],
  };
  const leaseMap = await buildLeaseExternalIdMap(ctx);
  if (leaseMap.size === 0) {
    result.errors.push("No leases with external_id found in this portfolio — ingest leases first.");
    result.skipped = rows.length;
    return result;
  }

  const payload: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    if (r._errors.length > 0) {
      result.errors.push(`Row ${r._rowIndex}: ${r._errors.join("; ")}`);
      result.skipped++;
      continue;
    }
    const lease_id = r.lease_external_id ? leaseMap.get(r.lease_external_id) : undefined;
    if (!lease_id) {
      result.errors.push(`Row ${r._rowIndex}: lease "${r.lease_external_id ?? ""}" not found`);
      result.skipped++;
      continue;
    }
    payload.push({
      org_id:                  ctx.orgId,
      portfolio_id:            ctx.portfolioId,
      lease_id,
      component:               r.component,
      rate_basis:              r.rate_basis,
      rate_usd:                r.rate_usd,
      est_annual_units:        r.est_annual_units,
      annual_accrual_usd:      r.annual_accrual_usd,
      cumulative_balance_usd:  r.cumulative_balance_usd,
      refundable:              r.refundable,
      source_upload_id:        ctx.uploadId,
      updated_at:              new Date().toISOString(),
    });
  }
  if (payload.length === 0) return result;

  const { data, error } = await supabase
    .from("maintenance_reserves")
    .upsert(payload, {
      onConflict: "org_id,portfolio_id,lease_id,component",
      ignoreDuplicates: false,
    })
    .select("id");
  if (error) result.errors.push(`Upsert: ${error.message}`);
  else if (data) result.inserted += data.length;
  return result;
}

// ─── IFRS-9 ECL parameters ingester (T-1.5) ─────────────────────────────────
//
// One row per (org, portfolio). Upsert via the unique constraint on
// (org_id, portfolio_id). Parser-supplied nulls fall back to documented
// defaults at write time so an incomplete sheet still produces a valid row.

export async function ingestIfrs9Params(
  params: ParsedIfrs9Params,
  ctx: CommonContext,
): Promise<SheetIngestResult> {
  const result: SheetIngestResult = {
    sheet:     "IFRS 9 ECL parameters",
    attempted: 1,
    inserted:  0,
    updated:   0,
    skipped:   0,
    errors:    [...params._errors], // forward parser soft-warnings into the UI
  };

  const payload = {
    org_id:                    ctx.orgId,
    portfolio_id:              ctx.portfolioId,
    discount_rate:             params.discount_rate ?? 0.05,
    lgd_flat:                  params.lgd_flat ?? 0.45,
    pd_lifetime_multiplier_s2: params.pd_lifetime_multiplier_s2 ?? 3.0,
    pd_lifetime_s3_floor:      params.pd_lifetime_s3_floor ?? 0.85,
    scenario_weight_baseline:  params.scenario_weight_baseline ?? 0.60,
    scenario_weight_adverse:   params.scenario_weight_adverse ?? 0.25,
    scenario_weight_upside:    params.scenario_weight_upside ?? 0.15,
    source_upload_id:          ctx.uploadId,
    updated_at:                new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("ifrs9_parameters")
    .upsert(payload, {
      onConflict: "org_id,portfolio_id",
      ignoreDuplicates: false,
    })
    .select("id");
  if (error) {
    result.errors.push(`Upsert: ${error.message}`);
  } else if (data) {
    result.inserted = data.length;
  }
  return result;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────
//
// Dependency order:
//   1. lessees    (no deps)
//   2. aircraft   (no deps)
//   3. leases     (depends on lessees + aircraft FK lookup)
//   4. SD         (depends on leases FK lookup)
//   5. MR         (depends on leases FK lookup)
//   6. ifrs9 params (org-scoped settings, no deps)
//   7+ sicr / stress / jurisdiction-lgd — also org-scoped settings, no deps

export async function ingestWorkbook(
  workbook: ParsedWorkbook,
  ctx: CommonContext & { onProgress?: (sheet: string) => void },
): Promise<Omit<WorkbookIngestResult, "uploadId" | "portfolioId">> {
  const sheetResults: SheetIngestResult[] = [];

  if (workbook.sheets.lessees) {
    ctx.onProgress?.("Lessee Profiles");
    sheetResults.push(await ingestLessees(workbook.sheets.lessees, ctx));
  }
  if (workbook.sheets.aircraft) {
    ctx.onProgress?.("Aircraft Register");
    sheetResults.push(await ingestAircraft(workbook.sheets.aircraft, ctx));
  }
  if (workbook.sheets.leases) {
    ctx.onProgress?.("Lease Register");
    sheetResults.push(await ingestLeases(workbook.sheets.leases, ctx));
  }
  if (workbook.sheets.securityDeposits) {
    ctx.onProgress?.("Security Deposits");
    sheetResults.push(await ingestSecurityDeposits(workbook.sheets.securityDeposits, ctx));
  }
  if (workbook.sheets.maintenanceReserves) {
    ctx.onProgress?.("Maintenance Reserves");
    sheetResults.push(await ingestMaintenanceReserves(workbook.sheets.maintenanceReserves, ctx));
  }
  if (workbook.sheets.ifrs9Params) {
    ctx.onProgress?.("IFRS 9 ECL parameters");
    sheetResults.push(await ingestIfrs9Params(workbook.sheets.ifrs9Params, ctx));
  }
  // T-1.6 sicr triggers
  // T-1.7 stress scenarios
  // T-1.8 jurisdiction lgd

  const totalAttempted = sheetResults.reduce((a, b) => a + b.attempted, 0);
  const totalInserted  = sheetResults.reduce((a, b) => a + b.inserted, 0);
  const totalUpdated   = sheetResults.reduce((a, b) => a + b.updated, 0);
  const totalErrors    = sheetResults.reduce((a, b) => a + b.errors.length, 0);

  return { sheetResults, totalAttempted, totalInserted, totalUpdated, totalErrors };
}
