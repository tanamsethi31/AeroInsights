// src/app/utils/portfolioId.ts
//
// Helpers for distinguishing real DB portfolio IDs from the sample-portfolio
// sentinel ("global-sample"). All Supabase queries that filter on
// `portfolio_id` MUST use `dbPortfolioId()` to gate, otherwise the
// uuid-typed column rejects "global-sample" with HTTP 400 and the failed
// promise poisons React's render cycle (manifests as "URL updates but
// content doesn't" after a few tab switches).

import { SAMPLE_PORTFOLIO_ID } from "../contexts/PortfolioContext";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the portfolio id when it's a real DB UUID — null when it's the
 * sample sentinel ("global-sample") or any other non-UUID value. Use this
 * to gate Supabase queries:
 *
 *   const dbId = dbPortfolioId(activePortfolioId);
 *   if (!orgId || !dbId) { setRows([]); return; }
 *   await supabase.from("...").eq("portfolio_id", dbId)...
 */
export function dbPortfolioId(id: string | null | undefined): string | null {
  return id && UUID_RE.test(id) ? id : null;
}

export function isSamplePortfolioId(id: string | null | undefined): boolean {
  return id === SAMPLE_PORTFOLIO_ID;
}
