// src/app/types/portfolio.ts

export interface Asset {
  id: string;
  org_id: string;
  /** ADR-002 Phase B: scope every analytical row to a portfolio. */
  portfolio_id: string;
  upload_id: string | null;
  registration: string;
  msn: string;
  aircraft_type: string;
  manufacturer: string | null;
  vintage: number | null;
  current_operator: string | null;
  // ── T-1.3 ingested columns ──────────────────────────────────────────────
  external_id: string | null;
  family: string | null;
  country: string | null;
  stage: 1 | 2 | 3 | null;
  /** Current Market Value in USD (absolute, parser expands Excel "$M"). */
  current_mv_usd: number | null;
  /** Part-out / teardown floor in USD. */
  part_out_usd: number | null;
  created_at: string;
}

export interface Lessee {
  id: string;
  org_id: string;
  /** ADR-002 Phase B: scope every analytical row to a portfolio. */
  portfolio_id: string;
  name: string;
  iata_code: string | null;
  country: string | null;
  credit_rating: string | null;
  pd_estimate: number | null;
  watchlist_status: "green" | "amber" | "red" | null;
  carrier_segment: "network" | "lcc" | "regional" | "charter" | null;
  // ── T-1.2 ingested columns ──────────────────────────────────────────────
  /** External identifier from the source Excel (e.g. "LE-001"). Used by
   *  re-import reconciliation to match prior rows. */
  external_id: string | null;
  region: string | null;
  stage: 1 | 2 | 3 | null;
  dpd_days: number | null;
  rating_notches_down: number | null;
  country_watchlist: boolean | null;
  insolvency_filed: boolean | null;
  score_punctuality: number | null;
  score_restructuring_coop: number | null;
  score_govt_interference: number | null;
  score_litigation: number | null;
  overall_behaviour_score: number | null;
  pay_behaviour_tier: string | null;
  created_at: string;
}

export interface Lease {
  id: string;
  org_id: string;
  asset_id: string;
  lessee_id: string;
  start_date: string;
  end_date: string;
  monthly_rental: number | null;
  currency: string;
  stage: 1 | 2 | 3 | null;
  created_at: string;
}

export interface Provision {
  id: string;
  org_id: string;
  asset_id: string;
  lease_id: string | null;
  stage: 1 | 2 | 3 | null;
  ecl_amount: number | null;
  pd: number | null;
  lgd: number | null;
  ead: number | null;
  auto_ecl: boolean;
  reporting_date: string | null;
  created_at: string;
}

export interface PortfolioData {
  assets: Asset[];
  lessees: Lessee[];
  leases: Lease[];
  provisions: Provision[];
  isLoading: boolean;
  isDemo: boolean;
  refetch: () => Promise<void>;
}
