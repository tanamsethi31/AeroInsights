// src/app/data/demoCashFlowLeases.ts
//
// Synthetic Lease[] records built from the demo SDMR portfolio.
// Used by useCashFlow when orgId is null (demo mode) so forecastCashFlows
// can generate rule-based events from the platform's own analytics data
// instead of the old hardcoded SAMPLE_CASH_EVENTS list.
//
// `id` intentionally equals `sdmr.leaseId` so sdmrMap.get(lease.id) resolves
// correctly inside forecastCashFlows.

import { sdmrData } from "../components/portfolio/SDMRTab";
import { LEASE_CONTEXT } from "../components/portfolio/MaintenanceForecastTab";
import type { Lease } from "../types/portfolio";

const MONTHLY_RENTAL: Record<string, number> = {
  "A320neo":    390_000,
  "B737-800":   350_000,
  "B777-300ER": 1_020_000,
  "A330-300":   660_000,
  "B737 MAX 8": 415_000,
  "A350-900":   1_050_000,
};

export const DEMO_LEASES: Lease[] = sdmrData.map((sdmr): Lease => {
  const ctx       = Object.values(LEASE_CONTEXT).find(c => c.leaseId === sdmr.leaseId);
  const stageNum  = ctx ? (Number(ctx.stage) as 1 | 2 | 3) : 1;
  return {
    id:             sdmr.leaseId,
    org_id:         "demo",
    asset_id:       sdmr.leaseId,
    lessee_id:      sdmr.leaseId,
    start_date:     "2019-01-01",
    end_date:       ctx?.leaseEnd ?? "2030-01-01",
    monthly_rental: MONTHLY_RENTAL[sdmr.aircraft] ?? 400_000,
    currency:       "USD",
    stage:          stageNum,
    created_at:     "2019-01-01T00:00:00Z",
  };
});
