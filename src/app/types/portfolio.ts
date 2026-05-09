// src/app/types/portfolio.ts

export interface Asset {
  id: string;
  org_id: string;
  upload_id: string | null;
  registration: string;
  msn: string;
  aircraft_type: string;
  manufacturer: string | null;
  vintage: number | null;
  current_operator: string | null;
  created_at: string;
}

export interface Lessee {
  id: string;
  org_id: string;
  name: string;
  iata_code: string | null;
  country: string | null;
  credit_rating: string | null;
  pd_estimate: number | null;
  watchlist_status: "green" | "amber" | "red" | null;
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
  stage: number | null;
  ecl_amount: number | null;
  pd: number | null;
  lgd: number | null;
  ead: number | null;
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
}
