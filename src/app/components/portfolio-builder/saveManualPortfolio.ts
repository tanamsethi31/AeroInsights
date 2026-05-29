// src/app/components/portfolio-builder/saveManualPortfolio.ts
//
// Atomically persists a DraftPortfolio. Insertion order matters because of
// foreign keys: portfolio → assets + lessees → leases → provisions / sd / mr.
// If any step fails we don't roll back the earlier inserts (Supabase JS
// doesn't expose transactions); we report what was saved so the user can
// retry from the broken step.

import { supabase } from "../../lib/supabase";
import type { DraftPortfolio } from "./types";

export interface SaveResult {
  portfolioId: string;
  counts: {
    aircraft: number;
    lessees:  number;
    leases:   number;
    ecl:      number;
    deposits: number;
    reserves: number;
  };
}

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  // Suffix with timestamp so slugs are unique per org without an extra round-trip.
  const suffix = Date.now().toString(36).slice(-5);
  return `${base || "portfolio"}-${suffix}`;
}

function parseNumberOrNull(s: string): number | null {
  if (!s) return null;
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseIntegerOrNull(s: string): number | null {
  const n = parseNumberOrNull(s);
  return n === null ? null : Math.trunc(n);
}

export async function saveManualPortfolio(
  draft: DraftPortfolio,
  orgId: string,
): Promise<SaveResult> {
  // 1. Create the portfolio row.
  const { data: portfolio, error: portfolioErr } = await supabase
    .from("portfolios")
    .insert({
      org_id: orgId,
      name: draft.name.trim(),
      slug: slugify(draft.name),
      kind: "live",
    })
    .select("id")
    .single();
  if (portfolioErr || !portfolio) {
    throw new Error(portfolioErr?.message ?? "Failed to create portfolio.");
  }
  const portfolioId = portfolio.id as string;

  // 2. Insert aircraft. We need a localId → db-id map for the leases step.
  const aircraftIdMap = new Map<string, string>();
  if (draft.aircraft.length > 0) {
    const payload = draft.aircraft.map((a) => ({
      org_id: orgId,
      portfolio_id: portfolioId,
      registration: a.registration.trim(),
      msn: a.msn.trim(),
      aircraft_type: a.aircraft_type.trim(),
      manufacturer: a.manufacturer.trim() || null,
      vintage: parseIntegerOrNull(a.vintage),
      current_operator: a.current_operator.trim() || null,
      country: a.country.trim() || null,
    }));
    const { data, error } = await supabase
      .from("assets")
      .insert(payload)
      .select("id");
    if (error || !data) throw new Error(`Aircraft insert failed: ${error?.message ?? "unknown"}`);
    draft.aircraft.forEach((a, i) => aircraftIdMap.set(a._localId, data[i].id as string));
  }

  // 3. Insert lessees.
  const lesseeIdMap = new Map<string, string>();
  if (draft.lessees.length > 0) {
    const payload = draft.lessees.map((l) => ({
      org_id: orgId,
      portfolio_id: portfolioId,
      name: l.name.trim(),
      iata_code: l.iata_code.trim() || null,
      country: l.country.trim() || null,
      region: l.region.trim() || null,
      credit_rating: l.credit_rating.trim() || null,
      pd_estimate: parseNumberOrNull(l.pd_estimate),
      watchlist_status: l.watchlist_status || null,
    }));
    const { data, error } = await supabase
      .from("lessees")
      .insert(payload)
      .select("id");
    if (error || !data) throw new Error(`Lessee insert failed: ${error?.message ?? "unknown"}`);
    draft.lessees.forEach((l, i) => lesseeIdMap.set(l._localId, data[i].id as string));
  }

  // 4. Insert leases.
  const leaseIdMap = new Map<string, string>();
  if (draft.leases.length > 0) {
    const payload = draft.leases.map((ls) => ({
      org_id: orgId,
      portfolio_id: portfolioId,
      asset_id:  aircraftIdMap.get(ls.aircraftLocalId)!,
      lessee_id: lesseeIdMap.get(ls.lesseeLocalId)!,
      start_date: ls.start_date,
      end_date:   ls.end_date,
      monthly_rental: parseNumberOrNull(ls.monthly_rental),
      currency: ls.currency,
      stage: ls.stage,
    }));
    const { data, error } = await supabase
      .from("leases")
      .insert(payload)
      .select("id");
    if (error || !data) throw new Error(`Lease insert failed: ${error?.message ?? "unknown"}`);
    draft.leases.forEach((ls, i) => leaseIdMap.set(ls._localId, data[i].id as string));
  }

  // 5. Optional: provisions (ECL).
  let eclCount = 0;
  if (!draft.skipEcl && draft.ecl.length > 0) {
    const payload = draft.ecl
      .filter((e) => leaseIdMap.has(e.leaseLocalId))
      .map((e) => {
        const lease = draft.leases.find((l) => l._localId === e.leaseLocalId)!;
        return {
          org_id: orgId,
          asset_id: aircraftIdMap.get(lease.aircraftLocalId)!,
          lease_id: leaseIdMap.get(e.leaseLocalId)!,
          stage: e.stage,
          pd:  parseNumberOrNull(e.pd),
          lgd: parseNumberOrNull(e.lgd),
          ead: parseNumberOrNull(e.ead),
          ecl_amount: parseNumberOrNull(e.ecl_amount),
          auto_ecl: false,
        };
      });
    if (payload.length > 0) {
      const { data, error } = await supabase.from("provisions").insert(payload).select("id");
      if (error) throw new Error(`ECL insert failed: ${error.message}`);
      eclCount = data?.length ?? 0;
    }
  }

  // 6. Optional: security deposits.
  let depositCount = 0;
  if (!draft.skipSdMr && draft.deposits.length > 0) {
    const payload = draft.deposits
      .filter((d) => leaseIdMap.has(d.leaseLocalId))
      .map((d) => ({
        org_id: orgId,
        portfolio_id: portfolioId,
        lease_id: leaseIdMap.get(d.leaseLocalId)!,
        deposit_months: parseNumberOrNull(d.deposit_months),
        deposit_amount_usd: parseNumberOrNull(d.deposit_amount_usd),
        type: d.type.trim() || null,
      }));
    if (payload.length > 0) {
      const { data, error } = await supabase.from("security_deposits").insert(payload).select("id");
      if (error) throw new Error(`Security deposit insert failed: ${error.message}`);
      depositCount = data?.length ?? 0;
    }
  }

  // 7. Optional: maintenance reserves.
  let reserveCount = 0;
  if (!draft.skipSdMr && draft.reserves.length > 0) {
    const payload = draft.reserves
      .filter((r) => leaseIdMap.has(r.leaseLocalId))
      .map((r) => ({
        org_id: orgId,
        portfolio_id: portfolioId,
        lease_id: leaseIdMap.get(r.leaseLocalId)!,
        component: r.component.trim() || "Engine PR",
        rate_usd: parseNumberOrNull(r.rate_usd),
        cumulative_balance_usd: parseNumberOrNull(r.cumulative_balance_usd),
        refundable: r.refundable,
      }));
    if (payload.length > 0) {
      const { data, error } = await supabase.from("maintenance_reserves").insert(payload).select("id");
      if (error) throw new Error(`Maintenance reserve insert failed: ${error.message}`);
      reserveCount = data?.length ?? 0;
    }
  }

  return {
    portfolioId,
    counts: {
      aircraft: draft.aircraft.length,
      lessees:  draft.lessees.length,
      leases:   draft.leases.length,
      ecl:      eclCount,
      deposits: depositCount,
      reserves: reserveCount,
    },
  };
}
