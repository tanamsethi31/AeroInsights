// src/app/lib/portfolioMutations.ts
import { supabase } from "./supabase";

// ── ECL formula ───────────────────────────────────────────────────────────────
//
// IFRS 9 stage-aware calculation:
//   Stage 1 — 12-month ECL:   PD × LGD × EAD
//   Stage 2 — Lifetime ECL:   (1 − (1 − PD)^remainingYears) × LGD × EAD
//   Stage 3 — Credit-impaired: LGD × EAD  (PD assumed = 1)
//
// remainingYears = max(0, (leaseEndDate − today) / 365.25)
// If stage is null, falls back to Stage 1 formula.

export function computeEcl(
  pd: number | null,
  lgd: number | null,
  ead: number | null,
  stage: 1 | 2 | 3 | null = 1,
  leaseEndDate?: string | null,
): number | null {
  if (lgd == null || ead == null) return null;

  if (stage === 3) {
    return lgd * ead;
  }

  if (pd == null) return null;

  if (stage === 2) {
    const today = new Date();
    const end = leaseEndDate ? new Date(leaseEndDate) : null;
    const remainingYears = end
      ? Math.max(0, (end.getTime() - today.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 1;
    const lifetimePd = 1 - Math.pow(1 - pd, remainingYears);
    return lifetimePd * lgd * ead;
  }

  // Stage 1 (default): 12-month ECL
  return pd * lgd * ead;
}

// ── Lessee update ─────────────────────────────────────────────────────────────

export interface LesseeUpdate {
  credit_rating?: string | null;
  pd_estimate?: number | null;
  watchlist_status?: "green" | "amber" | "red" | null;
}

export async function updateLessee(
  lesseeId: string,
  updates: LesseeUpdate,
): Promise<void> {
  const { error } = await supabase
    .from("lessees")
    .update(updates)
    .eq("id", lesseeId);
  if (error) throw new Error("Failed to update lessee: " + error.message);
}

// ── Provision update (single lease) ──────────────────────────────────────────

export interface ProvisionUpdate {
  stage?: 1 | 2 | 3 | null;
  pd?: number | null;
  lgd?: number | null;
  ead?: number | null;
  ecl_amount?: number | null;
  auto_ecl?: boolean;
}

export async function updateProvision(
  provisionId: string,
  updates: ProvisionUpdate,
  leaseEndDate?: string | null,
): Promise<void> {
  const payload = { ...updates };
  if (payload.auto_ecl !== false) {
    const ecl = computeEcl(
      payload.pd ?? null,
      payload.lgd ?? null,
      payload.ead ?? null,
      (payload.stage ?? null) as 1 | 2 | 3 | null,
      leaseEndDate,
    );
    if (ecl != null) payload.ecl_amount = ecl;
  }
  const { error } = await supabase
    .from("provisions")
    .update(payload)
    .eq("id", provisionId);
  if (error) throw new Error("Failed to update provision: " + error.message);
}

// ── Lease update (rental, stage) ─────────────────────────────────────────────

export interface LeaseUpdate {
  stage?: 1 | 2 | 3 | null;
  monthly_rental?: number | null;
}

export async function updateLease(
  leaseId: string,
  updates: LeaseUpdate,
): Promise<void> {
  const { error } = await supabase
    .from("leases")
    .update(updates)
    .eq("id", leaseId);
  if (error) throw new Error("Failed to update lease: " + error.message);
}

// ── Bulk: apply PD to all provisions for a lessee ────────────────────────────

export async function applyPdToAllLesseeProvisions(
  orgId: string,
  lesseeId: string,
  pd: number,
): Promise<void> {
  const { data: leases, error: lErr } = await supabase
    .from("leases")
    .select("id, end_date")
    .eq("org_id", orgId)
    .eq("lessee_id", lesseeId);
  if (lErr) throw new Error(lErr.message);
  if (!leases?.length) return;

  const leaseEndDateById = Object.fromEntries(leases.map((l) => [l.id, l.end_date]));
  const leaseIds = leases.map((l) => l.id);

  const { data: provs, error: pErr } = await supabase
    .from("provisions")
    .select("id, lgd, ead, auto_ecl, stage, lease_id")
    .eq("org_id", orgId)
    .in("lease_id", leaseIds);
  if (pErr) throw new Error(pErr.message);
  if (!provs?.length) return;

  for (const prov of provs) {
    const endDate = leaseEndDateById[prov.lease_id] ?? null;
    const eclPayload: Record<string, unknown> = { pd };
    if (prov.auto_ecl) {
      const ecl = computeEcl(pd, prov.lgd, prov.ead, prov.stage as 1 | 2 | 3 | null, endDate);
      if (ecl != null) eclPayload.ecl_amount = ecl;
    }
    await supabase.from("provisions").update(eclPayload).eq("id", prov.id);
  }
}
