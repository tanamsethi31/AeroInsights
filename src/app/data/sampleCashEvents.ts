// src/app/data/sampleCashEvents.ts
import type { CashEvent } from "../utils/cashFlowForecast";

export const SAMPLE_CASH_EVENTS: CashEvent[] = [
  // January (2 events)
  {
    id: "demo-evt-01", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 148500, currency: "USD",
    eventDate: "2026-01-15", isForecast: false,
    source: "manual", transactionId: null, notes: "Jan rent receipt",
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "demo-evt-02", orgId: "demo", leaseId: null,
    eventType: "sd_posted", amount: 82000, currency: "USD",
    eventDate: "2026-01-20", isForecast: false,
    source: "manual", transactionId: null, notes: "SD posted on delivery",
    createdAt: "2026-01-20T10:00:00Z",
  },
  // February (3 events)
  {
    id: "demo-evt-03", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 132000, currency: "USD",
    eventDate: "2026-02-10", isForecast: false,
    source: "manual", transactionId: null, notes: "Feb rent receipt",
    createdAt: "2026-02-10T10:00:00Z",
  },
  {
    id: "demo-evt-04", orgId: "demo", leaseId: null,
    eventType: "supplemental_rent", amount: 9800, currency: "USD",
    eventDate: "2026-02-15", isForecast: false,
    source: "manual", transactionId: null, notes: "Suppl. rent Jan",
    createdAt: "2026-02-15T10:00:00Z",
  },
  {
    id: "demo-evt-05", orgId: "demo", leaseId: null,
    eventType: "insurance", amount: -2150, currency: "USD",
    eventDate: "2026-02-20", isForecast: false,
    source: "manual", transactionId: null, notes: "Hull insurance premium",
    createdAt: "2026-02-20T10:00:00Z",
  },
  // March (4 events)
  {
    id: "demo-evt-06", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 155200, currency: "USD",
    eventDate: "2026-03-10", isForecast: false,
    source: "manual", transactionId: null, notes: "Mar rent receipt",
    createdAt: "2026-03-10T10:00:00Z",
  },
  {
    id: "demo-evt-07", orgId: "demo", leaseId: null,
    eventType: "supplemental_rent", amount: 11200, currency: "USD",
    eventDate: "2026-03-15", isForecast: false,
    source: "manual", transactionId: null, notes: "Suppl. rent Mar",
    createdAt: "2026-03-15T10:00:00Z",
  },
  {
    id: "demo-evt-08", orgId: "demo", leaseId: null,
    eventType: "mr_draw", amount: -44750, currency: "USD",
    eventDate: "2026-03-20", isForecast: false,
    source: "manual", transactionId: null, notes: "MR draw - engine event",
    createdAt: "2026-03-20T10:00:00Z",
  },
  {
    id: "demo-evt-09", orgId: "demo", leaseId: null,
    eventType: "other", amount: -380, currency: "USD",
    eventDate: "2026-03-28", isForecast: false,
    source: "manual", transactionId: null, notes: "Bank wire fee",
    createdAt: "2026-03-28T10:00:00Z",
  },
  // April (3 events)
  {
    id: "demo-evt-10", orgId: "demo", leaseId: null,
    eventType: "rent", amount: 148500, currency: "USD",
    eventDate: "2026-04-10", isForecast: false,
    source: "manual", transactionId: null, notes: "Apr rent receipt",
    createdAt: "2026-04-10T10:00:00Z",
  },
  {
    id: "demo-evt-11", orgId: "demo", leaseId: null,
    eventType: "eol_comp", amount: 24500, currency: "USD",
    eventDate: "2026-04-18", isForecast: false,
    source: "manual", transactionId: null, notes: "EOL compensation",
    createdAt: "2026-04-18T10:00:00Z",
  },
  {
    id: "demo-evt-12", orgId: "demo", leaseId: null,
    eventType: "eol_comp", amount: 27300, currency: "USD",
    eventDate: "2026-04-25", isForecast: false,
    source: "manual", transactionId: null, notes: "EOL compensation",
    createdAt: "2026-04-25T10:00:00Z",
  },
];
