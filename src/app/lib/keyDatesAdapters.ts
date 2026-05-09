// src/app/lib/keyDatesAdapters.ts
// Compute key dates (lease expiry urgency) from normalized portfolio data.

import type { Lease, Asset, Lessee } from "../types/portfolio";
import { indexById } from "./portfolioAdapters";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Urgency = "expired" | "critical" | "watch" | "upcoming" | "long";

export interface KeyDateRow {
  leaseId: string;
  lessee: string;
  aircraft: string;
  msn: string;
  stage: string;
  expiryDate: string;
  daysRemaining: number;
  urgency: Urgency;
}

export interface KeyDateKPIs {
  expired: number;
  critical: number;
  watch: number;
  upcoming: number;
  long: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function urgencyOf(days: number): Urgency {
  if (days < 0)   return "expired";
  if (days < 90)  return "critical";
  if (days < 180) return "watch";
  if (days < 365) return "upcoming";
  return "long";
}

function daysBetween(from: Date, toStr: string): number {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const [y, m, d] = toStr.split("-").map(Number);
  const toUTC = Date.UTC(y, m - 1, d);
  return Math.round((toUTC - fromUTC) / 86_400_000);
}

// ─── Adapters ─────────────────────────────────────────────────────────────────

export function toKeyDateRows(
  leases: Lease[],
  assets: Asset[],
  lessees: Lessee[],
): KeyDateRow[] {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);
  const today = new Date();

  const rows: KeyDateRow[] = leases.map((l) => {
    const asset = assetMap.get(l.asset_id);
    const lessee = lesseeMap.get(l.lessee_id);
    const daysRemaining = daysBetween(today, l.end_date);
    return {
      leaseId: l.id,
      lessee: lessee?.name ?? "—",
      aircraft: asset?.aircraft_type ?? "—",
      msn: asset?.msn ?? "—",
      stage: l.stage != null ? String(l.stage) : "—",
      expiryDate: l.end_date,
      daysRemaining,
      urgency: urgencyOf(daysRemaining),
    };
  });

  return rows.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function toKeyDateKPIs(rows: KeyDateRow[]): KeyDateKPIs {
  const zero: KeyDateKPIs = { expired: 0, critical: 0, watch: 0, upcoming: 0, long: 0 };
  for (const r of rows) zero[r.urgency]++;
  return zero;
}
