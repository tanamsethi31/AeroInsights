// src/app/data/mockPortfolioData.ts
// Canonical mock data matching the existing inline constants in Portfolio.tsx.
// usePortfolioData() returns this when no real upload exists.

import type { Asset, Lessee, Lease, Provision } from "../types/portfolio";

export const MOCK_ASSETS: Asset[] = [
  { id: "mock-a1",  org_id: "demo", upload_id: null, registration: "VT-IYC",  msn: "9218",  aircraft_type: "A320neo",    manufacturer: "Airbus",  vintage: 2019, current_operator: "IndiGo Airlines",      created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a2",  org_id: "demo", upload_id: null, registration: "XA-AMX",  msn: "41234", aircraft_type: "B737-800",   manufacturer: "Boeing",  vintage: 2020, current_operator: "Aeromexico",           created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a3",  org_id: "demo", upload_id: null, registration: "A6-ECE",  msn: "62047", aircraft_type: "B777-300ER", manufacturer: "Boeing",  vintage: 2021, current_operator: "Emirates",             created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a4",  org_id: "demo", upload_id: null, registration: "4R-ALB",  msn: "1728",  aircraft_type: "A330-300",   manufacturer: "Airbus",  vintage: 2015, current_operator: "SriLankan Airlines",   created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a5",  org_id: "demo", upload_id: null, registration: "EI-HXP",  msn: "67892", aircraft_type: "B737 MAX 8", manufacturer: "Boeing",  vintage: 2022, current_operator: "Ryanair",              created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a6",  org_id: "demo", upload_id: null, registration: "F-HTYR",  msn: "0378",  aircraft_type: "A350-900",   manufacturer: "Airbus",  vintage: 2018, current_operator: "Air France",           created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a7",  org_id: "demo", upload_id: null, registration: "PR-YRJ",  msn: "10442", aircraft_type: "A320neo",    manufacturer: "Airbus",  vintage: 2021, current_operator: "Azul Brazilian Airlines", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a8",  org_id: "demo", upload_id: null, registration: "C-GTSA",  msn: "8841",  aircraft_type: "A321neo",    manufacturer: "Airbus",  vintage: 2019, current_operator: "Air Transat",          created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a9",  org_id: "demo", upload_id: null, registration: "9V-SMB",  msn: "0521",  aircraft_type: "A350-900",   manufacturer: "Airbus",  vintage: 2023, current_operator: "Singapore Airlines",   created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a10", org_id: "demo", upload_id: null, registration: "D-AIVM",  msn: "55124", aircraft_type: "A220-300",   manufacturer: "Airbus",  vintage: 2022, current_operator: "Lufthansa",            created_at: "2024-01-01T00:00:00Z" },
];

export const MOCK_LESSEES: Lessee[] = [
  { id: "mock-l1",  org_id: "demo", name: "IndiGo Airlines",      iata_code: "6E", country: "India",       credit_rating: "BB-",  pd_estimate: 0.12, watchlist_status: "red",   created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l2",  org_id: "demo", name: "Aeromexico",           iata_code: "AM", country: "Mexico",      credit_rating: "CCC",  pd_estimate: 0.28, watchlist_status: "red",   created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l3",  org_id: "demo", name: "Emirates",             iata_code: "EK", country: "UAE",         credit_rating: "A-",   pd_estimate: 0.01, watchlist_status: "green", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l4",  org_id: "demo", name: "SriLankan Airlines",   iata_code: "UL", country: "Sri Lanka",   credit_rating: "B+",   pd_estimate: 0.08, watchlist_status: "amber", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l5",  org_id: "demo", name: "Ryanair",              iata_code: "FR", country: "Ireland",     credit_rating: "BBB+", pd_estimate: 0.02, watchlist_status: "green", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l6",  org_id: "demo", name: "Air France",           iata_code: "AF", country: "France",      credit_rating: "BB+",  pd_estimate: 0.04, watchlist_status: "green", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l7",  org_id: "demo", name: "Azul Brazilian Airlines", iata_code: "AD", country: "Brazil",   credit_rating: "B+",   pd_estimate: 0.09, watchlist_status: "amber", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l8",  org_id: "demo", name: "Air Transat",          iata_code: "TS", country: "Canada",      credit_rating: "B",    pd_estimate: 0.11, watchlist_status: "amber", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l9",  org_id: "demo", name: "Singapore Airlines",   iata_code: "SQ", country: "Singapore",   credit_rating: "A",    pd_estimate: 0.01, watchlist_status: "green", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l10", org_id: "demo", name: "Lufthansa",            iata_code: "LH", country: "Germany",     credit_rating: "BBB-", pd_estimate: 0.03, watchlist_status: "green", created_at: "2024-01-01T00:00:00Z" },
];

export const MOCK_LEASES: Lease[] = [
  { id: "mock-ls1",  org_id: "demo", asset_id: "mock-a1",  lessee_id: "mock-l1",  start_date: "2019-03-01", end_date: "2028-03-01", monthly_rental: 285000,  currency: "USD", stage: 3, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls2",  org_id: "demo", asset_id: "mock-a2",  lessee_id: "mock-l2",  start_date: "2020-06-15", end_date: "2027-06-15", monthly_rental: 310000,  currency: "USD", stage: 3, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls3",  org_id: "demo", asset_id: "mock-a3",  lessee_id: "mock-l3",  start_date: "2021-01-10", end_date: "2030-01-10", monthly_rental: 1240000, currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls4",  org_id: "demo", asset_id: "mock-a4",  lessee_id: "mock-l4",  start_date: "2020-09-01", end_date: "2026-09-01", monthly_rental: 480000,  currency: "USD", stage: 2, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls5",  org_id: "demo", asset_id: "mock-a5",  lessee_id: "mock-l5",  start_date: "2022-04-15", end_date: "2032-04-15", monthly_rental: 340000,  currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls6",  org_id: "demo", asset_id: "mock-a6",  lessee_id: "mock-l6",  start_date: "2018-07-20", end_date: "2028-07-20", monthly_rental: 960000,  currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls7",  org_id: "demo", asset_id: "mock-a7",  lessee_id: "mock-l7",  start_date: "2021-11-01", end_date: "2029-11-01", monthly_rental: 295000,  currency: "USD", stage: 2, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls8",  org_id: "demo", asset_id: "mock-a8",  lessee_id: "mock-l8",  start_date: "2019-05-01", end_date: "2027-05-01", monthly_rental: 275000,  currency: "USD", stage: 2, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls9",  org_id: "demo", asset_id: "mock-a9",  lessee_id: "mock-l9",  start_date: "2023-02-01", end_date: "2033-02-01", monthly_rental: 1050000, currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls10", org_id: "demo", asset_id: "mock-a10", lessee_id: "mock-l10", start_date: "2022-08-01", end_date: "2032-08-01", monthly_rental: 220000,  currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" },
];

export const MOCK_PROVISIONS: Provision[] = [
  { id: "mock-p1",  org_id: "demo", asset_id: "mock-a1",  lease_id: null, stage: 3, ecl_amount: 4200000, pd: 0.12, lgd: 0.45, ead: 24200000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p2",  org_id: "demo", asset_id: "mock-a2",  lease_id: null, stage: 3, ecl_amount: 3800000, pd: 0.28, lgd: 0.45, ead: 32100000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p3",  org_id: "demo", asset_id: "mock-a3",  lease_id: null, stage: 1, ecl_amount: 890000,  pd: 0.01, lgd: 0.45, ead: 88400000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p4",  org_id: "demo", asset_id: "mock-a4",  lease_id: null, stage: 2, ecl_amount: 2100000, pd: 0.08, lgd: 0.45, ead: 34200000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p5",  org_id: "demo", asset_id: "mock-a5",  lease_id: null, stage: 1, ecl_amount: 450000,  pd: 0.02, lgd: 0.45, ead: 44700000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p6",  org_id: "demo", asset_id: "mock-a6",  lease_id: null, stage: 1, ecl_amount: 680000,  pd: 0.04, lgd: 0.45, ead: 68300000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p7",  org_id: "demo", asset_id: "mock-a7",  lease_id: null, stage: 2, ecl_amount: 1900000, pd: 0.09, lgd: 0.45, ead: 34200000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p8",  org_id: "demo", asset_id: "mock-a8",  lease_id: null, stage: 2, ecl_amount: 1500000, pd: 0.11, lgd: 0.45, ead: 28900000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p9",  org_id: "demo", asset_id: "mock-a9",  lease_id: null, stage: 1, ecl_amount: 1100000, pd: 0.01, lgd: 0.45, ead: 91200000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p10", org_id: "demo", asset_id: "mock-a10", lease_id: null, stage: 1, ecl_amount: 340000,  pd: 0.03, lgd: 0.45, ead: 44700000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
];
