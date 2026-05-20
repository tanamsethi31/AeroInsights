// src/app/utils/cashFlowForecast.ts
import type { Lease } from "../types/portfolio";
import type { LeaseSDMR } from "../components/portfolio/SDMRTab";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CashEventType =
  | "rent" | "mr_draw" | "sd_posted" | "sd_draw" | "sd_refund"
  | "eol_comp" | "remarketing" | "ferry_fee" | "supplemental_rent"
  | "insurance" | "other";

export type CashEventSource = "manual" | "recon" | "rule";

export interface CashEvent {
  id:            string;
  orgId:         string;
  leaseId:       string | null;
  eventType:     CashEventType;
  amount:        number;
  currency:      string;
  eventDate:     string;        // YYYY-MM-DD
  isForecast:    boolean;
  source:        CashEventSource;
  transactionId: string | null; // set when source = 'recon'
  notes:         string | null;
  createdAt:     string;
}

export interface NewCashEvent {
  leaseId:    string | null;
  eventType:  CashEventType;
  amount:     number;
  currency:   string;
  eventDate:  string;
  isForecast: boolean;
  notes:      string | null;
}

// ── Local SDMR helpers (mirrors unexported fns in SDMRTab) ────────────────────

function totalMRBalance(sdmr: LeaseSDMR): number {
  return sdmr.mrComponents.reduce((s, c) => s + c.cumulativeBalance, 0);
}

function sdCashRefundable(sdmr: LeaseSDMR): number {
  if (sdmr.sd.type !== "Cash") return 0;
  return sdmr.sd.amount;
}

function eolCompensation(sdmr: LeaseSDMR): number {
  // Half-life standard: lessee owes compensation if remaining units < half interval
  return sdmr.mrComponents.reduce((sum, comp) => {
    const halfLife = comp.fullIntervalUnits / 2;
    const shortfall = Math.max(0, halfLife - comp.remainingUnits);
    return sum + shortfall * comp.rateAmount;
  }, 0);
}

// ── Forecast engine ───────────────────────────────────────────────────────────

/**
 * Generates rule-based projected cash events for all active leases.
 * Events are never persisted — they carry source: 'rule'.
 *
 * @param leases       Live lease records from usePortfolioData
 * @param sdmrData     SDMR records from buildLiveSDMRData (may be empty for demo)
 * @param horizonMonths How many months ahead to project (typically 24)
 */
export function forecastCashFlows(
  leases:        Lease[],
  sdmrData:      LeaseSDMR[],
  horizonMonths: number,
): CashEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + horizonMonths);

  const sdmrMap = new Map(sdmrData.map(s => [s.leaseId, s]));
  const events: CashEvent[] = [];

  for (const lease of leases) {
    if (!lease.end_date) continue;
    const endDate = new Date(lease.end_date + "T00:00:00Z");
    if (endDate < today) continue; // lease already expired

    const endDateStr = lease.end_date;
    const sdmr = sdmrMap.get(lease.id);

    // ── Rent events (one per calendar month from today → min(endDate, horizon)) ──

    if (lease.monthly_rental && lease.monthly_rental > 0) {
      // Start from first day of next month
      const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
      cursor.setMonth(cursor.getMonth() + 1);

      let count = 0;
      while (count < horizonMonths && cursor <= endDate && cursor <= horizon) {
        const eventDate = cursor.toISOString().slice(0, 10);
        events.push({
          id:            `rule-${lease.id}-rent-${eventDate}`,
          orgId:         "",
          leaseId:       lease.id,
          eventType:     "rent",
          amount:        lease.monthly_rental,
          currency:      lease.currency ?? "USD",
          eventDate,
          isForecast:    true,
          source:        "rule",
          transactionId: null,
          notes:         null,
          createdAt:     "",
        });
        cursor.setMonth(cursor.getMonth() + 1);
        count++;
      }
    }

    // ── Redelivery events — only if end_date is within horizon ───────────────

    if (endDate > horizon) continue;
    if (!sdmr) continue;

    // MR draw (outflow — lessor pays back MR balance to lessee / MRO at return)
    const mrTotal = totalMRBalance(sdmr);
    if (mrTotal > 0) {
      events.push({
        id:            `rule-${lease.id}-mr_draw-${endDateStr}`,
        orgId:         "",
        leaseId:       lease.id,
        eventType:     "mr_draw",
        amount:        -mrTotal,
        currency:      "USD",
        eventDate:     endDateStr,
        isForecast:    true,
        source:        "rule",
        transactionId: null,
        notes:         null,
        createdAt:     "",
      });
    }

    // SD refund (outflow — cash SD returned to lessee at clean redelivery)
    const sdRefund = sdCashRefundable(sdmr);
    if (sdRefund > 0) {
      events.push({
        id:            `rule-${lease.id}-sd_refund-${endDateStr}`,
        orgId:         "",
        leaseId:       lease.id,
        eventType:     "sd_refund",
        amount:        -sdRefund,
        currency:      "USD",
        eventDate:     endDateStr,
        isForecast:    true,
        source:        "rule",
        transactionId: null,
        notes:         null,
        createdAt:     "",
      });
    }

    // EOL compensation (inflow — lessee pays lessor if aircraft returned below half-life)
    const eol = eolCompensation(sdmr);
    if (eol > 0) {
      events.push({
        id:            `rule-${lease.id}-eol_comp-${endDateStr}`,
        orgId:         "",
        leaseId:       lease.id,
        eventType:     "eol_comp",
        amount:        eol,
        currency:      "USD",
        eventDate:     endDateStr,
        isForecast:    true,
        source:        "rule",
        transactionId: null,
        notes:         null,
        createdAt:     "",
      });
    }
  }

  return events;
}

// ── Merge logic ───────────────────────────────────────────────────────────────

/**
 * Merges rule-based forecast events with persisted manual forecast overrides.
 * For each (leaseId, eventType, calendar-month) triple, a persisted manual event
 * suppresses the corresponding rule event.
 *
 * @param ruleEvents      Output of forecastCashFlows
 * @param manualForecast  Persisted cash_events where is_forecast = true (source = 'manual')
 */
export function mergeForecastEvents(
  ruleEvents:     CashEvent[],
  manualForecast: CashEvent[],
): CashEvent[] {
  // Build a set of keys covered by manual overrides: "leaseId|eventType|YYYY-MM"
  const overrideKeys = new Set(
    manualForecast.map(e =>
      `${e.leaseId ?? ""}|${e.eventType}|${e.eventDate.slice(0, 7)}`
    )
  );

  // Keep rule events that don't have a manual override for same lease+type+month
  const filteredRule = ruleEvents.filter(e => {
    const key = `${e.leaseId ?? ""}|${e.eventType}|${e.eventDate.slice(0, 7)}`;
    return !overrideKeys.has(key);
  });

  return [...filteredRule, ...manualForecast];
}
