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
  ParsedLesseeRow,
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

// ─── Orchestrator ───────────────────────────────────────────────────────────
//
// Currently runs only the lessees ingester. Subsequent Phase 1 slices add the
// aircraft, leases, sd/mr, ifrs9, sicr, scenarios, jurisdiction-lgd
// ingesters in dependency order:
//   1. lessees    (parent for leases)
//   2. aircraft   (parent for leases)
//   3. leases     (depends on lessees + aircraft)
//   4. sd/mr      (depends on leases)
//   5. ifrs9 ecl  (org-scoped settings)
//   6. sicr       (org-scoped settings)
//   7. stress scenarios (org-scoped)
//   8. jurisdiction lgd (org-scoped)
//
// Each new sheet plugs into the switch below.

export async function ingestWorkbook(
  workbook: ParsedWorkbook,
  ctx: CommonContext & { onProgress?: (sheet: string) => void },
): Promise<Omit<WorkbookIngestResult, "uploadId" | "portfolioId">> {
  const sheetResults: SheetIngestResult[] = [];

  if (workbook.sheets.lessees) {
    ctx.onProgress?.("Lessee Profiles");
    sheetResults.push(await ingestLessees(workbook.sheets.lessees, ctx));
  }
  // T-1.3 aircraft ingester lands in next slice
  // T-1.4 sd/mr ingester
  // T-1.5 ifrs9 ecl params
  // T-1.6 sicr triggers
  // T-1.7 stress scenarios
  // T-1.8 jurisdiction lgd

  const totalAttempted = sheetResults.reduce((a, b) => a + b.attempted, 0);
  const totalInserted  = sheetResults.reduce((a, b) => a + b.inserted, 0);
  const totalUpdated   = sheetResults.reduce((a, b) => a + b.updated, 0);
  const totalErrors    = sheetResults.reduce((a, b) => a + b.errors.length, 0);

  return { sheetResults, totalAttempted, totalInserted, totalUpdated, totalErrors };
}
