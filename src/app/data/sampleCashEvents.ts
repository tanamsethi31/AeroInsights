// src/app/data/sampleCashEvents.ts
import type { CashEvent } from "../utils/cashFlowForecast";

// Dates are spread around today (May 2026) so the Cash Flow chart and KPIs
// are all populated in demo mode:
//  • Apr actuals  → appear in the ledger (past actuals, no lower-bound filter)
//  • May actuals  → appear in the chart May bar + Net Received MTD
//  • Jun–Oct forecasts → appear in chart future bars, Net Forecast 12m,
//                        Largest Outflow 90d, MR Draws Due 90d

export const SAMPLE_CASH_EVENTS: CashEvent[] = [
  // April — 2 past actuals (visible in ledger)
  {
    id: "demo-evt-01", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 148500, currency: "USD",
    eventDate: "2026-04-10", isForecast: false,
    source: "manual", transactionId: null, notes: "Apr rent receipt",
    createdAt: "2026-04-10T10:00:00Z",
  },
  {
    id: "demo-evt-02", orgId: "demo", leaseId: null,
    eventType: "sd_posted", amount: 82000, currency: "USD",
    eventDate: "2026-04-20", isForecast: false,
    source: "manual", transactionId: null, notes: "SD posted on delivery",
    createdAt: "2026-04-20T10:00:00Z",
  },
  // May — 3 current-month actuals (visible in chart + Net Received MTD)
  {
    id: "demo-evt-03", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 155200, currency: "USD",
    eventDate: "2026-05-08", isForecast: false,
    source: "manual", transactionId: null, notes: "May rent receipt",
    createdAt: "2026-05-08T10:00:00Z",
  },
  {
    id: "demo-evt-04", orgId: "demo", leaseId: null,
    eventType: "supplemental_rent", amount: 9800, currency: "USD",
    eventDate: "2026-05-12", isForecast: false,
    source: "manual", transactionId: null, notes: "Suppl. rent May",
    createdAt: "2026-05-12T10:00:00Z",
  },
  {
    id: "demo-evt-05", orgId: "demo", leaseId: null,
    eventType: "insurance", amount: -2150, currency: "USD",
    eventDate: "2026-05-18", isForecast: false,
    source: "manual", transactionId: null, notes: "Hull insurance premium",
    createdAt: "2026-05-18T10:00:00Z",
  },
  // June — 2 forecasts
  {
    id: "demo-evt-06", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 148500, currency: "USD",
    eventDate: "2026-06-10", isForecast: true,
    source: "manual", transactionId: null, notes: "Jun rent forecast",
    createdAt: "2026-05-01T10:00:00Z",
  },
  {
    id: "demo-evt-07", orgId: "demo", leaseId: null,
    eventType: "supplemental_rent", amount: 11200, currency: "USD",
    eventDate: "2026-06-15", isForecast: true,
    source: "manual", transactionId: null, notes: "Suppl. rent Jun forecast",
    createdAt: "2026-05-01T10:00:00Z",
  },
  // July — MR draw forecast (within 90 days → populates MR Draws KPI)
  {
    id: "demo-evt-08", orgId: "demo", leaseId: null,
    eventType: "mr_draw", amount: -44750, currency: "USD",
    eventDate: "2026-07-20", isForecast: true,
    source: "manual", transactionId: null, notes: "MR draw - engine event forecast",
    createdAt: "2026-05-01T10:00:00Z",
  },
  // August
  {
    id: "demo-evt-09", orgId: "demo", leaseId: null,
    eventType: "eol_comp", amount: 24500, currency: "USD",
    eventDate: "2026-08-18", isForecast: true,
    source: "manual", transactionId: null, notes: "EOL compensation forecast",
    createdAt: "2026-05-01T10:00:00Z",
  },
  // September
  {
    id: "demo-evt-10", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 132000, currency: "USD",
    eventDate: "2026-09-10", isForecast: true,
    source: "manual", transactionId: null, notes: "Sep rent forecast",
    createdAt: "2026-05-01T10:00:00Z",
  },
  {
    id: "demo-evt-11", orgId: "demo", leaseId: null,
    eventType: "eol_comp", amount: 27300, currency: "USD",
    eventDate: "2026-09-25", isForecast: true,
    source: "manual", transactionId: null, notes: "EOL compensation forecast",
    createdAt: "2026-05-01T10:00:00Z",
  },
  // October
  {
    id: "demo-evt-12", orgId: "demo", leaseId: null,
    eventType: "insurance", amount: -2150, currency: "USD",
    eventDate: "2026-10-15", isForecast: true,
    source: "manual", transactionId: null, notes: "Hull insurance premium forecast",
    createdAt: "2026-05-01T10:00:00Z",
  },
];
