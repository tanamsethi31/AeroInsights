// src/app/lib/paymentAdapters.ts
// Transforms lease/asset/lessee data into a 12-month forward cashflow schedule.

import type { Lease, Asset, Lessee } from "../types/portfolio";
import { indexById } from "./portfolioAdapters";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CellStatus = "active" | "expiring" | "expired" | "not-started";

export interface PaymentCell {
  status: CellStatus;
  amount: number; // monthly_rental for active/expiring, 0 otherwise
}

export interface PaymentRow {
  leaseId: string;
  lessee: string;
  aircraft: string;
  msn: string;
  stage: string;         // "1" | "2" | "3" | "—"
  watchlistStatus: string; // lessee.watchlist_status
  monthlyRental: number; // raw number for sorting
  currency: string;
  cells: PaymentCell[];  // one per month, same length as schedule.months
  rowTotal: number;      // sum of cell amounts
}

export interface PaymentSchedule {
  months: string[];        // display labels e.g. ["May 26", "Jun 26", ...]
  monthKeys: string[];     // "YYYY-MM" canonical keys
  rows: PaymentRow[];
  monthlyTotals: number[]; // sum per column
  grandTotal: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_ABBREVS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Converts "2026-05" → "May 26" */
export function getMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const abbrev = MONTH_ABBREVS[month - 1];
  const yr = String(year).slice(2);
  return `${abbrev} ${yr}`;
}

/** Generates an array of "YYYY-MM" keys starting from the current month. */
function generateMonthKeys(startYear: number, startMonth: number, count: number): string[] {
  const keys: string[] = [];
  let y = startYear;
  let m = startMonth;
  for (let i = 0; i < count; i++) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return keys;
}

const STAGE_ORDER: Record<string, number> = { "3": 0, "2": 1, "1": 2, "—": 3 };

// ─── Main Adapter ─────────────────────────────────────────────────────────────

export function toPaymentSchedule(
  leases: Lease[],
  assets: Asset[],
  lessees: Lessee[],
  horizonMonths = 12,
): PaymentSchedule {
  const assetMap = indexById(assets);
  const lesseeMap = indexById(lessees);

  const now = new Date();
  const monthKeys = generateMonthKeys(now.getFullYear(), now.getMonth() + 1, horizonMonths);
  const months = monthKeys.map(getMonthLabel);

  const rows: PaymentRow[] = leases.map((l) => {
    const asset = assetMap.get(l.asset_id);
    const lessee = lesseeMap.get(l.lessee_id);

    const startMonth = l.start_date.slice(0, 7); // "YYYY-MM"
    const endMonth = l.end_date.slice(0, 7);       // "YYYY-MM"
    const rental = l.monthly_rental ?? 0;

    const cells: PaymentCell[] = monthKeys.map((mk) => {
      let status: CellStatus;
      if (mk > endMonth) {
        status = "expired";
      } else if (mk < startMonth) {
        status = "not-started";
      } else if (mk === endMonth) {
        status = "expiring";
      } else {
        status = "active";
      }
      const amount = (status === "active" || status === "expiring") ? rental : 0;
      return { status, amount };
    });

    const rowTotal = cells.reduce((sum, c) => sum + c.amount, 0);

    return {
      leaseId: l.id,
      lessee: lessee?.name ?? "—",
      aircraft: asset?.aircraft_type ?? "—",
      msn: asset?.msn ?? "—",
      stage: l.stage != null ? String(l.stage) : "—",
      watchlistStatus: lessee?.watchlist_status ?? "—",
      monthlyRental: rental,
      currency: l.currency,
      cells,
      rowTotal,
    };
  });

  // Sort: stage 3 first, then 2, then 1, then "—"
  rows.sort((a, b) => (STAGE_ORDER[a.stage] ?? 3) - (STAGE_ORDER[b.stage] ?? 3));

  // Compute monthly totals
  const monthlyTotals = monthKeys.map((_, colIdx) =>
    rows.reduce((sum, row) => sum + row.cells[colIdx].amount, 0),
  );

  const grandTotal = rows.reduce((sum, r) => sum + r.rowTotal, 0);

  return { months, monthKeys, rows, monthlyTotals, grandTotal };
}
