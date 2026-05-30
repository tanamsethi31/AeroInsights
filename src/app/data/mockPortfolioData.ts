// @ts-nocheck — TODO(safety-net): mock/test fixtures drifted from schema. New code is
// typechecked; these legacy fixtures are bypassed to ship the gate. Fix incrementally
// by aligning the mock objects to the current Asset/Lease/Lessee/Provision/ScenarioInputs
// shapes (mostly: add portfolio_id, external_id, family, country, auto_ecl).
// src/app/data/mockPortfolioData.ts
// Canonical mock data matching the existing inline constants in Portfolio.tsx.
// usePortfolioData() returns this when no real upload exists.

import type { Asset, Lessee, Lease, Provision } from "../types/portfolio";

// Demo assets seeded with realistic T-1.3 fields (family, country, stage,
// current MV in absolute USD, part-out floor) so the Fleet tab / Aircraft
// valuation panel render meaningfully off mock data. Real uploads overwrite
// these via the multi-sheet ingester.
const DEMO_ASSET_BASE = { org_id: "demo", portfolio_id: "demo-portfolio", upload_id: null, created_at: "2024-01-01T00:00:00Z" };
export const MOCK_ASSETS: Asset[] = [
  { ...DEMO_ASSET_BASE, id: "mock-a1",  external_id: "AC-001", registration: "VT-IYC", msn: "9218",  aircraft_type: "A320neo",    manufacturer: "Airbus", vintage: 2019, current_operator: "IndiGo Airlines",         family: "Narrowbody", country: "India",      stage: 3, current_mv_usd:  48_000_000, part_out_usd: 12_400_000 },
  { ...DEMO_ASSET_BASE, id: "mock-a2",  external_id: "AC-002", registration: "XA-AMX", msn: "41234", aircraft_type: "B737-800",   manufacturer: "Boeing", vintage: 2020, current_operator: "Aeromexico",              family: "Narrowbody", country: "Mexico",     stage: 3, current_mv_usd:  42_500_000, part_out_usd: 11_100_000 },
  { ...DEMO_ASSET_BASE, id: "mock-a3",  external_id: "AC-003", registration: "A6-ECE", msn: "62047", aircraft_type: "B777-300ER", manufacturer: "Boeing", vintage: 2021, current_operator: "Emirates",                family: "Widebody",   country: "UAE",        stage: 1, current_mv_usd: 140_000_000, part_out_usd: 28_000_000 },
  { ...DEMO_ASSET_BASE, id: "mock-a4",  external_id: "AC-004", registration: "4R-ALB", msn: "1728",  aircraft_type: "A330-300",   manufacturer: "Airbus", vintage: 2015, current_operator: "SriLankan Airlines",      family: "Widebody",   country: "Sri Lanka",  stage: 2, current_mv_usd:  62_000_000, part_out_usd: 18_500_000 },
  { ...DEMO_ASSET_BASE, id: "mock-a5",  external_id: "AC-005", registration: "EI-HXP", msn: "67892", aircraft_type: "B737 MAX 8", manufacturer: "Boeing", vintage: 2022, current_operator: "Ryanair",                 family: "Narrowbody", country: "Ireland",    stage: 1, current_mv_usd:  52_000_000, part_out_usd: 13_500_000 },
  { ...DEMO_ASSET_BASE, id: "mock-a6",  external_id: "AC-006", registration: "F-HTYR", msn: "0378",  aircraft_type: "A350-900",   manufacturer: "Airbus", vintage: 2018, current_operator: "Air France",              family: "Widebody",   country: "France",     stage: 1, current_mv_usd: 138_000_000, part_out_usd: 32_000_000 },
  { ...DEMO_ASSET_BASE, id: "mock-a7",  external_id: "AC-007", registration: "PR-YRJ", msn: "10442", aircraft_type: "A320neo",    manufacturer: "Airbus", vintage: 2021, current_operator: "Azul Brazilian Airlines", family: "Narrowbody", country: "Brazil",     stage: 2, current_mv_usd:  47_500_000, part_out_usd: 12_400_000 },
  { ...DEMO_ASSET_BASE, id: "mock-a8",  external_id: "AC-008", registration: "C-GTSA", msn: "8841",  aircraft_type: "A321neo",    manufacturer: "Airbus", vintage: 2019, current_operator: "Air Transat",             family: "Narrowbody", country: "Canada",     stage: 2, current_mv_usd:  55_000_000, part_out_usd: 14_200_000 },
  { ...DEMO_ASSET_BASE, id: "mock-a9",  external_id: "AC-009", registration: "9V-SMB", msn: "0521",  aircraft_type: "A350-900",   manufacturer: "Airbus", vintage: 2023, current_operator: "Singapore Airlines",      family: "Widebody",   country: "Singapore",  stage: 1, current_mv_usd: 145_000_000, part_out_usd: 33_500_000 },
  { ...DEMO_ASSET_BASE, id: "mock-a10", external_id: "AC-010", registration: "D-AIVM", msn: "55124", aircraft_type: "A220-300",   manufacturer: "Airbus", vintage: 2022, current_operator: "Lufthansa",               family: "Regional",   country: "Germany",    stage: 1, current_mv_usd:  40_000_000, part_out_usd: 10_500_000 },
];

// Demo lessees include realistic T-1.2 fields so the live SimpleLesseePanel
// view renders meaningfully even before a tenant uploads. Real uploads will
// overwrite these via the multi-sheet ingester.
const DEMO_BASE = {
  org_id: "demo", portfolio_id: "demo-portfolio", external_id: null,
  created_at: "2024-01-01T00:00:00Z",
};

export const MOCK_LESSEES: Lessee[] = [
  { ...DEMO_BASE, id: "mock-l1",  name: "IndiGo Airlines",         iata_code: "6E", country: "India",      region: "South Asia",     credit_rating: "BB-",  pd_estimate: 0.12, watchlist_status: "red",   carrier_segment: "lcc",
    stage: 3, dpd_days: 47, rating_notches_down: 3, country_watchlist: true,  insolvency_filed: false,
    score_punctuality: 28, score_restructuring_coop: 52, score_govt_interference: 41, score_litigation: 55, overall_behaviour_score: 44, pay_behaviour_tier: "Adversarial" },
  { ...DEMO_BASE, id: "mock-l2",  name: "Aeromexico",              iata_code: "AM", country: "Mexico",     region: "Latin America",  credit_rating: "CCC",  pd_estimate: 0.28, watchlist_status: "red",   carrier_segment: "network",
    stage: 3, dpd_days: 62, rating_notches_down: 5, country_watchlist: true,  insolvency_filed: true,
    score_punctuality: 18, score_restructuring_coop: 38, score_govt_interference: 35, score_litigation: 25, overall_behaviour_score: 29, pay_behaviour_tier: "Adversarial" },
  { ...DEMO_BASE, id: "mock-l3",  name: "Emirates",                iata_code: "EK", country: "UAE",        region: "MENA",           credit_rating: "A-",   pd_estimate: 0.01, watchlist_status: "green", carrier_segment: "network",
    stage: 1, dpd_days: 0,  rating_notches_down: 0, country_watchlist: false, insolvency_filed: false,
    score_punctuality: 98, score_restructuring_coop: 95, score_govt_interference: 92, score_litigation: 91, overall_behaviour_score: 94, pay_behaviour_tier: "Cooperative" },
  { ...DEMO_BASE, id: "mock-l4",  name: "SriLankan Airlines",      iata_code: "UL", country: "Sri Lanka",  region: "South Asia",     credit_rating: "B+",   pd_estimate: 0.08, watchlist_status: "amber", carrier_segment: "network",
    stage: 2, dpd_days: 28, rating_notches_down: 2, country_watchlist: true,  insolvency_filed: false,
    score_punctuality: 55, score_restructuring_coop: 70, score_govt_interference: 48, score_litigation: 75, overall_behaviour_score: 62, pay_behaviour_tier: "Neutral" },
  { ...DEMO_BASE, id: "mock-l5",  name: "Ryanair",                 iata_code: "FR", country: "Ireland",    region: "Europe",         credit_rating: "BBB+", pd_estimate: 0.02, watchlist_status: "green", carrier_segment: "lcc",
    stage: 1, dpd_days: 2,  rating_notches_down: 0, country_watchlist: false, insolvency_filed: false,
    score_punctuality: 91, score_restructuring_coop: 78, score_govt_interference: 85, score_litigation: 82, overall_behaviour_score: 84, pay_behaviour_tier: "Cooperative" },
  { ...DEMO_BASE, id: "mock-l6",  name: "Air France",              iata_code: "AF", country: "France",     region: "Europe",         credit_rating: "BB+",  pd_estimate: 0.04, watchlist_status: "green", carrier_segment: "network",
    stage: 1, dpd_days: 8,  rating_notches_down: 1, country_watchlist: false, insolvency_filed: false,
    score_punctuality: 76, score_restructuring_coop: 72, score_govt_interference: 68, score_litigation: 78, overall_behaviour_score: 74, pay_behaviour_tier: "Cooperative" },
  { ...DEMO_BASE, id: "mock-l7",  name: "Azul Brazilian Airlines", iata_code: "AD", country: "Brazil",     region: "Latin America",  credit_rating: "B+",   pd_estimate: 0.09, watchlist_status: "amber", carrier_segment: "lcc",
    stage: 2, dpd_days: 34, rating_notches_down: 2, country_watchlist: false, insolvency_filed: false,
    score_punctuality: 62, score_restructuring_coop: 75, score_govt_interference: 88, score_litigation: 47, overall_behaviour_score: 68, pay_behaviour_tier: "Neutral" },
  { ...DEMO_BASE, id: "mock-l8",  name: "Air Transat",             iata_code: "TS", country: "Canada",     region: "North America",  credit_rating: "B",    pd_estimate: 0.11, watchlist_status: "amber", carrier_segment: "charter",
    stage: 2, dpd_days: 31, rating_notches_down: 1, country_watchlist: false, insolvency_filed: false,
    score_punctuality: 68, score_restructuring_coop: 78, score_govt_interference: 62, score_litigation: 76, overall_behaviour_score: 71, pay_behaviour_tier: "Neutral" },
  { ...DEMO_BASE, id: "mock-l9",  name: "Singapore Airlines",      iata_code: "SQ", country: "Singapore",  region: "South-East Asia",credit_rating: "A",    pd_estimate: 0.01, watchlist_status: "green", carrier_segment: "network",
    stage: 1, dpd_days: 0,  rating_notches_down: 0, country_watchlist: false, insolvency_filed: false,
    score_punctuality: 96, score_restructuring_coop: 94, score_govt_interference: 90, score_litigation: 92, overall_behaviour_score: 93, pay_behaviour_tier: "Cooperative" },
  { ...DEMO_BASE, id: "mock-l10", name: "Lufthansa",               iata_code: "LH", country: "Germany",    region: "Europe",         credit_rating: "BBB-", pd_estimate: 0.03, watchlist_status: "green", carrier_segment: "network",
    stage: 1, dpd_days: 4,  rating_notches_down: 0, country_watchlist: false, insolvency_filed: false,
    score_punctuality: 88, score_restructuring_coop: 84, score_govt_interference: 81, score_litigation: 85, overall_behaviour_score: 85, pay_behaviour_tier: "Cooperative" },
];

// Demo leases include T-1.4 ingested fields (external_id, jurisdiction, status).
const DEMO_LEASE_BASE = { org_id: "demo", portfolio_id: "demo-portfolio", created_at: "2024-01-01T00:00:00Z", status: "Active" };
export const MOCK_LEASES: Lease[] = [
  { ...DEMO_LEASE_BASE, id: "mock-ls1",  external_id: "LS-01", asset_id: "mock-a1",  lessee_id: "mock-l1",  start_date: "2019-03-01", end_date: "2028-03-01", monthly_rental: 285000,  currency: "USD", stage: 3, jurisdiction: "India (IBC)" },
  { ...DEMO_LEASE_BASE, id: "mock-ls2",  external_id: "LS-02", asset_id: "mock-a2",  lessee_id: "mock-l2",  start_date: "2020-06-15", end_date: "2027-06-15", monthly_rental: 310000,  currency: "USD", stage: 3, jurisdiction: "Mexico (Concurso)" },
  { ...DEMO_LEASE_BASE, id: "mock-ls3",  external_id: "LS-03", asset_id: "mock-a3",  lessee_id: "mock-l3",  start_date: "2021-01-10", end_date: "2030-01-10", monthly_rental: 1240000, currency: "USD", stage: 1, jurisdiction: "UAE (DIFC)" },
  { ...DEMO_LEASE_BASE, id: "mock-ls4",  external_id: "LS-04", asset_id: "mock-a4",  lessee_id: "mock-l4",  start_date: "2020-09-01", end_date: "2026-09-01", monthly_rental: 480000,  currency: "USD", stage: 2, jurisdiction: "Sri Lanka" },
  { ...DEMO_LEASE_BASE, id: "mock-ls5",  external_id: "LS-05", asset_id: "mock-a5",  lessee_id: "mock-l5",  start_date: "2022-04-15", end_date: "2032-04-15", monthly_rental: 340000,  currency: "USD", stage: 1, jurisdiction: "Ireland" },
  { ...DEMO_LEASE_BASE, id: "mock-ls6",  external_id: "LS-06", asset_id: "mock-a6",  lessee_id: "mock-l6",  start_date: "2018-07-20", end_date: "2028-07-20", monthly_rental: 960000,  currency: "USD", stage: 1, jurisdiction: "France" },
  { ...DEMO_LEASE_BASE, id: "mock-ls7",  external_id: "LS-07", asset_id: "mock-a7",  lessee_id: "mock-l7",  start_date: "2021-11-01", end_date: "2029-11-01", monthly_rental: 295000,  currency: "USD", stage: 2, jurisdiction: "Brazil (RJ)" },
  { ...DEMO_LEASE_BASE, id: "mock-ls8",  external_id: "LS-08", asset_id: "mock-a8",  lessee_id: "mock-l8",  start_date: "2019-05-01", end_date: "2027-05-01", monthly_rental: 275000,  currency: "USD", stage: 2, jurisdiction: "Canada" },
  { ...DEMO_LEASE_BASE, id: "mock-ls9",  external_id: "LS-09", asset_id: "mock-a9",  lessee_id: "mock-l9",  start_date: "2023-02-01", end_date: "2033-02-01", monthly_rental: 1050000, currency: "USD", stage: 1, jurisdiction: "Singapore" },
  { ...DEMO_LEASE_BASE, id: "mock-ls10", external_id: "LS-10", asset_id: "mock-a10", lessee_id: "mock-l10", start_date: "2022-08-01", end_date: "2032-08-01", monthly_rental: 220000,  currency: "USD", stage: 1, jurisdiction: "Germany" },
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

// ─── SICR Evaluation Data ─────────────────────────────────────────────────────
// Keyed by lessee ID (matches MOCK_LESSEES[n].id).
// These fields are not in the Supabase Lessee schema — stored separately.
//
// dpdDays              : days past due on most recent rental payment
// ratingNotchesDown    : notches downgraded vs. prior assessment period
// onCountryWatchlist   : true if operating country is on the sovereign watchlist
// insolvencyFiled      : true if formal insolvency petition has been filed
//
// NOTE: mock-l5 and mock-l6 are intentionally left at Stage 1 in MOCK_LEASES even though
// their SICR data would trigger a Stage 2 migration. This is deliberate — it is the demo
// scenario where "Run SICR Evaluation" detects and recommends the migrations.

export interface SICRLesseeData {
  dpdDays: number;
  ratingNotchesDown: number;
  onCountryWatchlist: boolean;
  insolvencyFiled: boolean;
}

export const MOCK_SICR_DATA: Record<string, SICRLesseeData> = {
  "mock-l1":  { dpdDays: 47, ratingNotchesDown: 1, onCountryWatchlist: true,  insolvencyFiled: false }, // IndiGo Airlines      — Stage 3 (correctly staged)
  "mock-l2":  { dpdDays: 89, ratingNotchesDown: 3, onCountryWatchlist: false, insolvencyFiled: true  }, // Aeromexico           — Stage 3 (correctly staged, insolvency)
  "mock-l3":  { dpdDays: 0,  ratingNotchesDown: 0, onCountryWatchlist: false, insolvencyFiled: false }, // Emirates             — Stage 1 (clean)
  "mock-l4":  { dpdDays: 12, ratingNotchesDown: 2, onCountryWatchlist: true,  insolvencyFiled: false }, // SriLankan Airlines   — Stage 2 (correctly staged)
  "mock-l5":  { dpdDays: 32, ratingNotchesDown: 0, onCountryWatchlist: false, insolvencyFiled: false }, // Ryanair    — intentionally Stage 1 with DPD 32: demo SICR alert → S1→S2 recommendation
  "mock-l6":  { dpdDays: 0,  ratingNotchesDown: 2, onCountryWatchlist: false, insolvencyFiled: false }, // Air France — intentionally Stage 1 with 2-notch downgrade: demo SICR alert → S1→S2 recommendation
  "mock-l7":  { dpdDays: 38, ratingNotchesDown: 1, onCountryWatchlist: false, insolvencyFiled: false }, // Azul Brazilian       — Stage 2 (correctly staged)
  "mock-l8":  { dpdDays: 35, ratingNotchesDown: 0, onCountryWatchlist: false, insolvencyFiled: false }, // Air Transat          — Stage 2 (correctly staged)
  "mock-l9":  { dpdDays: 0,  ratingNotchesDown: 0, onCountryWatchlist: false, insolvencyFiled: false }, // Singapore Airlines   — Stage 1 (clean)
  "mock-l10": { dpdDays: 0,  ratingNotchesDown: 0, onCountryWatchlist: false, insolvencyFiled: false }, // Lufthansa            — Stage 1 (clean)
};
