// ─── Types ────────────────────────────────────────────────────────────────────

export type SignalCategory = "rates" | "fx" | "fuel" | "gdp" | "aviation";
export type SignalSeverity  = "low" | "medium" | "high";
export type SignalDirection = "up" | "down" | "flat";
export type SignalSentiment = "negative" | "positive" | "neutral";

export interface AffectedLessee {
  name: string;
  id: string;
  exposureUSD: number;
  stage: "1" | "2" | "3";
}

export interface MacroSignal {
  id: string;
  category: SignalCategory;
  name: string;
  source: string;
  sourceUrl: string;
  currentValue: string;
  previousValue: string;
  changeLabel: string;      // "+27.3% YTD" | "-0.6pp vs Oct WEO"
  direction: SignalDirection;
  severity: SignalSeverity;
  updatedAt: string;
  // Portfolio impact
  affectedLessees: AffectedLessee[];
  totalExposureUSD: number;
  totalExposurePct: number;
  // ECL impact — positive = worse, negative = better
  eclImpactUSD: number | null;
  eclImpactDir: SignalSentiment | null;
  // Narrative
  globalNarrative: string;
  portfolioNarrative: string;
  actionNarrative: string;
  actionLabel: string;
}

export type DealCategory =
  | "financial-distress"
  | "fleet"
  | "route-network"
  | "regulatory"
  | "positive"
  | "sanctions";

export interface DealItem {
  id: string;
  headline: string;
  source: string;
  publishedAt: string;
  hoursAgo: number;
  category: DealCategory;
  sentiment: SignalSentiment;
  relevance: "high" | "medium" | "low";
  affectedLesseeNames: string[];
  portfolioTag: string;
  suggestedAction: string;
  actionHref: string;
}

export type JxEventType = "legal" | "credit" | "regulatory" | "political";

export interface JurisdictionEvent {
  id: string;
  jurisdiction: string;
  code: string;
  eventType: JxEventType;
  headline: string;
  detail: string;
  source: string;
  date: string;
  sentiment: SignalSentiment;
  portfolioExposureUSD: number;
  lesseesAffected: string[];
}

export interface LesseeRadarSignal {
  value: number;
  trend: "up" | "down" | "flat";
  threshold: number;
  unit: string;
  status: "green" | "amber" | "red";
}

export interface LesseeRadarEntry {
  lesseeId: string;
  lesseeName: string;
  country: string;
  stage: "1" | "2" | "3";
  exposureUSD: number;
  compositeSignal: "green" | "amber" | "red";
  compositeScore: number;        // 0-100, higher = more stressed
  loadFactor: LesseeRadarSignal; // %, red < 80
  scheduleStability: LesseeRadarSignal; // %, red < 85
  fuelCostStress: LesseeRadarSignal;    // % opex, red > 35
  revLeaseRatio: LesseeRadarSignal;     // % revenue, red > 8.5
  lastUpdated: string;
}

// ─── Macro Signals ────────────────────────────────────────────────────────────

const M = 1_000_000;

export const MACRO_SIGNALS: MacroSignal[] = [
  {
    id: "sig-01",
    category: "fuel",
    name: "Jet-A1 Rotterdam (IATA Fuel Monitor)",
    source: "IATA Fuel Monitor",
    sourceUrl: "https://www.iata.org/en/publications/economics/fuel-monitor/",
    currentValue: "$1.12 / litre",
    previousValue: "$0.88 / litre (1 Jan 2026)",
    changeLabel: "+27.3% YTD",
    direction: "up",
    severity: "high",
    updatedAt: "29 Apr 2026 · Weekly update",
    affectedLessees: [
      { name: "IndiGo Airlines",          id: "INDIGO",   exposureUSD: 184*M, stage: "3" },
      { name: "Aeromexico",               id: "AEROMEX",  exposureUSD: 122*M, stage: "3" },
      { name: "SriLankan Airlines",       id: "SRILNKN",  exposureUSD: 118*M, stage: "2" },
      { name: "Azul Brazilian Airlines",  id: "AZUL",     exposureUSD: 142*M, stage: "2" },
      { name: "Air Transat",              id: "TRANSATCA",exposureUSD:  96*M, stage: "2" },
      { name: "Ryanair",                  id: "RYANAIR",  exposureUSD: 386*M, stage: "1" },
      { name: "Air France",               id: "AF",       exposureUSD: 278*M, stage: "1" },
      { name: "Lufthansa",                id: "LH",       exposureUSD: 194*M, stage: "1" },
      { name: "Emirates",                 id: "EK",       exposureUSD: 412*M, stage: "1" },
      { name: "Singapore Airlines",       id: "SQ",       exposureUSD: 290*M, stage: "1" },
    ],
    totalExposureUSD: 2_840*M,
    totalExposurePct: 100,
    eclImpactUSD: 4.2,
    eclImpactDir: "negative",
    globalNarrative:
      "Platts Jet-A1 Rotterdam is $1.12/litre as of 28 Apr 2026, up 27.3% since 1 Jan 2026. The current price is 14.8% above the $0.98/litre forward curve embedded in your Fuel Spike (+40%) scenario baseline.",
    portfolioNarrative:
      "All 10 lessees in your portfolio are exposed. Carriers with no fuel hedging disclosure — IndiGo, Aeromexico, SriLankan, Azul, Air Transat ($662M, Stage 2/3) — face greatest marginal stress. Low-cost carrier cost structures amplify the impact.",
    actionNarrative:
      "At current fuel price, the Fuel Cost Stress Index for IndiGo has risen to 38.1% of operating costs — above the 35% historical distress threshold. Estimated ECL impact across the book: +$4.2M. Consider updating your Fuel Spike scenario baseline.",
    actionLabel: "Update Fuel Spike scenario",
  },
  {
    id: "sig-02",
    category: "gdp",
    name: "India GDP Growth — IMF WEO Apr 2026",
    source: "IMF World Economic Outlook",
    sourceUrl: "https://www.imf.org/en/Publications/WEO",
    currentValue: "5.8% (FY2026 forecast)",
    previousValue: "6.4% (WEO Oct 2025)",
    changeLabel: "−0.6pp vs Oct WEO",
    direction: "down",
    severity: "high",
    updatedAt: "16 Apr 2026 · Quarterly",
    affectedLessees: [
      { name: "IndiGo Airlines", id: "INDIGO", exposureUSD: 184*M, stage: "3" },
    ],
    totalExposureUSD: 184*M,
    totalExposurePct: 6.5,
    eclImpactUSD: 2.1,
    eclImpactDir: "negative",
    globalNarrative:
      "IMF revised India's FY2026 GDP growth forecast to 5.8% (from 6.4% in the October 2025 WEO), citing slower-than-expected private consumption and tighter credit conditions in the MSME sector.",
    portfolioNarrative:
      "You have 1 lessee domiciled in India — IndiGo Airlines ($184M, 6.5% of book, Stage 3). IndiGo's revenue is denominated in INR and directly correlated with domestic economic activity and passenger demand.",
    actionNarrative:
      "A 0.6pp GDP downward revision of this magnitude historically correlates with a +0.3pp PD uplift for BB-rated Indian carriers in the IMF's EM aviation stress model. Estimated ECL impact for IndiGo: +$2.1M. Stage 3 assumption unchanged — consider whether lifetime PD curve should steepen.",
    actionLabel: "Run updated IndiGo scenario",
  },
  {
    id: "sig-03",
    category: "rates",
    name: "ECB Deposit Facility Rate",
    source: "European Central Bank",
    sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html",
    currentValue: "3.50%",
    previousValue: "3.75% (Mar 2026)",
    changeLabel: "−25 bps (10 Apr 2026)",
    direction: "down",
    severity: "medium",
    updatedAt: "10 Apr 2026 · Meeting-driven",
    affectedLessees: [
      { name: "Ryanair",    id: "RYANAIR", exposureUSD: 386*M, stage: "1" },
      { name: "Air France", id: "AF",      exposureUSD: 278*M, stage: "1" },
      { name: "Lufthansa",  id: "LH",      exposureUSD: 194*M, stage: "1" },
    ],
    totalExposureUSD: 858*M,
    totalExposurePct: 30.2,
    eclImpactUSD: -1.8,
    eclImpactDir: "positive",
    globalNarrative:
      "The ECB cut its deposit facility rate 25bps to 3.50% on 10 Apr 2026 — the fourth consecutive cut since June 2025. Market pricing implies a further 50bps of easing by year-end 2026.",
    portfolioNarrative:
      "EUR-denominated lease receivables total $858M (30.2% of book) — Ryanair, Air France, Lufthansa. Your IAS 36 VIU calculations and IFRS 9 discount rates for these leases reference the ECB deposit rate. Lower rates reduce the discount applied to future cash flows.",
    actionNarrative:
      "A 25bps rate cut reduces present-value EAD for EUR leases by approximately $1.8M at portfolio level — a modest positive for ECL. If your discount rates were calibrated to 3.75%, update to 3.50% before your next IAS 36 run.",
    actionLabel: "Update IAS 36 discount rates",
  },
  {
    id: "sig-04",
    category: "fx",
    name: "EUR/USD Exchange Rate",
    source: "ECB Free API",
    sourceUrl: "https://data.ecb.europa.eu/",
    currentValue: "1.0789",
    previousValue: "1.1012 (30 Jan 2026)",
    changeLabel: "−2.0% in 90 days",
    direction: "down",
    severity: "medium",
    updatedAt: "29 Apr 2026 · Daily",
    affectedLessees: [
      { name: "Ryanair",    id: "RYANAIR", exposureUSD: 386*M, stage: "1" },
      { name: "Air France", id: "AF",      exposureUSD: 278*M, stage: "1" },
      { name: "Lufthansa",  id: "LH",      exposureUSD: 194*M, stage: "1" },
    ],
    totalExposureUSD: 858*M,
    totalExposurePct: 30.2,
    eclImpactUSD: 1.4,
    eclImpactDir: "negative",
    globalNarrative:
      "EUR/USD has fallen from 1.1012 on 30 Jan 2026 to 1.0789 today — a 2.0% EUR depreciation driven by diverging US-EU rate expectations and stronger-than-expected US Q1 GDP.",
    portfolioNarrative:
      "Ryanair, Air France, and Lufthansa generate significant EUR-denominated revenue. All three have USD-denominated lease obligations to you. A weaker EUR compresses the revenue-to-lease-cost ratio in USD terms.",
    actionNarrative:
      "A 2pp EUR depreciation increases effective USD lease burden for these carriers by approximately 2%. Estimated ECL impact: +$1.4M, primarily via marginal PD uplift for Air France (which has the thinnest EBIT margin of the three). Ryanair's strong hedging policy limits its exposure.",
    actionLabel: "Review EUR carrier assumptions",
  },
  {
    id: "sig-05",
    category: "fx",
    name: "USD/INR Exchange Rate",
    source: "ECB / RBI",
    sourceUrl: "https://data.ecb.europa.eu/",
    currentValue: "₹84.32 / USD",
    previousValue: "₹82.58 / USD (30 Jan 2026)",
    changeLabel: "INR −2.1% vs USD in 90 days",
    direction: "up",
    severity: "high",
    updatedAt: "29 Apr 2026 · Daily",
    affectedLessees: [
      { name: "IndiGo Airlines", id: "INDIGO", exposureUSD: 184*M, stage: "3" },
    ],
    totalExposureUSD: 184*M,
    totalExposurePct: 6.5,
    eclImpactUSD: 0.8,
    eclImpactDir: "negative",
    globalNarrative:
      "The Indian rupee has depreciated 2.1% against the USD over the past 90 days, driven by portfolio outflows and a widening current account deficit. RBI has intervened but at reduced intensity vs. 2023-24.",
    portfolioNarrative:
      "IndiGo generates revenue in INR and pays lease obligations in USD. The lease coverage ratio — estimated INR monthly revenue converted to USD ÷ monthly USD lease obligation — has tightened from an estimated 10.8× to 10.1× over the past 90 days.",
    actionNarrative:
      "IndiGo is already Stage 3. The INR depreciation of 2.1% adds marginal pressure to an already-stressed lessee. Estimated incremental ECL impact: +$0.8M (marginal PD increase on a high-LGD exposure). Primary risk is runway compression if INR weakens below 86.",
    actionLabel: "Review IndiGo ECL",
  },
  {
    id: "sig-06",
    category: "fuel",
    name: "Brent Crude Oil (EIA)",
    source: "US Energy Information Administration",
    sourceUrl: "https://www.eia.gov/petroleum/",
    currentValue: "$89.50 / bbl",
    previousValue: "$79.80 / bbl (30 Jan 2026)",
    changeLabel: "+12.2% in 90 days",
    direction: "up",
    severity: "medium",
    updatedAt: "28 Apr 2026 · Weekly (EIA Free API)",
    affectedLessees: [
      { name: "IndiGo Airlines",         id: "INDIGO",  exposureUSD: 184*M, stage: "3" },
      { name: "Aeromexico",              id: "AEROMEX", exposureUSD: 122*M, stage: "3" },
      { name: "Azul Brazilian Airlines", id: "AZUL",    exposureUSD: 142*M, stage: "2" },
    ],
    totalExposureUSD: 448*M,
    totalExposurePct: 15.8,
    eclImpactUSD: null,
    eclImpactDir: "neutral",
    globalNarrative:
      "Brent crude has risen from $79.80 to $89.50/bbl over 90 days (+12.2%), driven by OPEC+ supply discipline and stronger-than-expected Chinese demand recovery. Jet fuel historically lags crude by 1–3 weeks.",
    portfolioNarrative:
      "Brent is a leading indicator for Jet-A1 pricing. The current move has already passed through into the Jet-A1 price signal above. Stage 2/3 carriers without hedging — IndiGo, Aeromexico, Azul ($448M combined) — face the highest secondary exposure.",
    actionNarrative:
      "Impact already captured in the Jet-A1 signal (sig-01). Monitor for further crude upside — a move above $95/bbl would push Jet-A1 toward $1.20/litre and trigger the Fuel Spike (+40%) scenario threshold.",
    actionLabel: "Monitor fuel trajectory",
  },
  {
    id: "sig-07",
    category: "gdp",
    name: "Brazil Fiscal Balance — IMF Fiscal Monitor",
    source: "IMF Fiscal Monitor",
    sourceUrl: "https://www.imf.org/en/Publications/FM",
    currentValue: "−8.2% of GDP (FY2026 est.)",
    previousValue: "−5.4% of GDP (FY2025)",
    changeLabel: "Deficit widening 2.8pp YoY",
    direction: "down",
    severity: "high",
    updatedAt: "16 Apr 2026 · Semi-annual",
    affectedLessees: [
      { name: "Azul Brazilian Airlines", id: "AZUL", exposureUSD: 142*M, stage: "2" },
    ],
    totalExposureUSD: 142*M,
    totalExposurePct: 5.0,
    eclImpactUSD: 1.1,
    eclImpactDir: "negative",
    globalNarrative:
      "Brazil's general government fiscal deficit has widened to an estimated −8.2% of GDP in FY2026, above the IMF's April 2026 projection of −6.8%. Revenue shortfalls and higher mandatory spending are the primary drivers. Fitch placed Brazil's sovereign rating on Negative Outlook on 22 Apr 2026.",
    portfolioNarrative:
      "Azul Brazilian Airlines ($142M, Stage 2) is the sole Brazilian lessee in your portfolio. Azul is in Recuperação Judicial (Chapter 11 equivalent). Sovereign fiscal deterioration raises BRL depreciation risk and increases the likelihood of further restructuring.",
    actionNarrative:
      "Widening fiscal deficit increases sovereign stress probability for Brazil from ~18% to ~24% over a 12-month horizon (applying IMF EM stress calibration). Estimated incremental ECL impact on Azul: +$1.1M. Azul's recovery ratio in RJ proceedings is already modelled at 35 cents on the dollar — test sensitivity to 20 cents.",
    actionLabel: "Stress-test Azul recovery rate",
  },
  {
    id: "sig-08",
    category: "aviation",
    name: "European Aviation RPK — Eurocontrol",
    source: "Eurocontrol STATFOR",
    sourceUrl: "https://www.eurocontrol.int/Economics/",
    currentValue: "+4.8% YoY (Mar 2026)",
    previousValue: "+3.2% YoY (Feb 2026)",
    changeLabel: "Acceleration +1.6pp MoM",
    direction: "up",
    severity: "low",
    updatedAt: "15 Apr 2026 · Monthly",
    affectedLessees: [
      { name: "Ryanair",    id: "RYANAIR", exposureUSD: 386*M, stage: "1" },
      { name: "Air France", id: "AF",      exposureUSD: 278*M, stage: "1" },
      { name: "Lufthansa",  id: "LH",      exposureUSD: 194*M, stage: "1" },
    ],
    totalExposureUSD: 858*M,
    totalExposurePct: 30.2,
    eclImpactUSD: -0.9,
    eclImpactDir: "positive",
    globalNarrative:
      "Eurocontrol's March 2026 Network Update shows European intra-regional RPK grew 4.8% YoY, ahead of the 3.2% recorded in February. Summer 2026 booking curves are tracking 6% above 2024 equivalent-period actuals.",
    portfolioNarrative:
      "Positive for your $858M European book. Ryanair, Air France, and Lufthansa are all Stage 1 — this signal supports maintaining current stage assignments. Ryanair (your largest European exposure at $386M) is particularly well-positioned: its load factor reached 94% in March.",
    actionNarrative:
      "RPK acceleration reduces PD uplift risk for European carriers. Estimated ECL improvement vs baseline: −$0.9M, driven by marginally lower 12-month PD for Air France (the weakest European credit in the book by margin). No action required — confirms current staging.",
    actionLabel: "View European lessee profiles",
  },
];

// ─── Lessee Radar ─────────────────────────────────────────────────────────────

export const LESSEE_RADAR: LesseeRadarEntry[] = [
  {
    lesseeId: "INDIGO",
    lesseeName: "IndiGo Airlines",
    country: "India",
    stage: "3",
    exposureUSD: 184*M,
    compositeSignal: "red",
    compositeScore: 87,
    loadFactor:       { value: 88.4, trend: "down",  threshold: 80,  unit: "%",     status: "green" },
    scheduleStability:{ value: 81.2, trend: "down",  threshold: 85,  unit: "%",     status: "red"   },
    fuelCostStress:   { value: 38.1, trend: "up",    threshold: 35,  unit: "% opex",status: "red"   },
    revLeaseRatio:    { value: 9.2,  trend: "up",    threshold: 8.5, unit: "% rev", status: "red"   },
    lastUpdated: "29 Apr 2026",
  },
  {
    lesseeId: "AEROMEX",
    lesseeName: "Aeromexico",
    country: "Mexico",
    stage: "3",
    exposureUSD: 122*M,
    compositeSignal: "red",
    compositeScore: 79,
    loadFactor:       { value: 83.7, trend: "down",  threshold: 80,  unit: "%",     status: "green" },
    scheduleStability:{ value: 84.1, trend: "down",  threshold: 85,  unit: "%",     status: "red"   },
    fuelCostStress:   { value: 36.8, trend: "up",    threshold: 35,  unit: "% opex",status: "red"   },
    revLeaseRatio:    { value: 8.8,  trend: "up",    threshold: 8.5, unit: "% rev", status: "red"   },
    lastUpdated: "29 Apr 2026",
  },
  {
    lesseeId: "AZUL",
    lesseeName: "Azul Brazilian Airlines",
    country: "Brazil",
    stage: "2",
    exposureUSD: 142*M,
    compositeSignal: "amber",
    compositeScore: 64,
    loadFactor:       { value: 82.1, trend: "flat",  threshold: 80,  unit: "%",     status: "green" },
    scheduleStability:{ value: 88.4, trend: "down",  threshold: 85,  unit: "%",     status: "green" },
    fuelCostStress:   { value: 37.2, trend: "up",    threshold: 35,  unit: "% opex",status: "red"   },
    revLeaseRatio:    { value: 7.8,  trend: "up",    threshold: 8.5, unit: "% rev", status: "amber" },
    lastUpdated: "28 Apr 2026",
  },
  {
    lesseeId: "SRILNKN",
    lesseeName: "SriLankan Airlines",
    country: "Sri Lanka",
    stage: "2",
    exposureUSD: 118*M,
    compositeSignal: "amber",
    compositeScore: 61,
    loadFactor:       { value: 76.3, trend: "flat",  threshold: 80,  unit: "%",     status: "red"   },
    scheduleStability:{ value: 87.2, trend: "up",    threshold: 85,  unit: "%",     status: "green" },
    fuelCostStress:   { value: 34.2, trend: "flat",  threshold: 35,  unit: "% opex",status: "amber" },
    revLeaseRatio:    { value: 11.4, trend: "down",  threshold: 8.5, unit: "% rev", status: "red"   },
    lastUpdated: "28 Apr 2026",
  },
  {
    lesseeId: "TRANSATCA",
    lesseeName: "Air Transat",
    country: "Canada",
    stage: "2",
    exposureUSD: 96*M,
    compositeSignal: "amber",
    compositeScore: 48,
    loadFactor:       { value: 91.2, trend: "up",    threshold: 80,  unit: "%",     status: "green" },
    scheduleStability:{ value: 92.4, trend: "flat",  threshold: 85,  unit: "%",     status: "green" },
    fuelCostStress:   { value: 33.1, trend: "up",    threshold: 35,  unit: "% opex",status: "amber" },
    revLeaseRatio:    { value: 8.1,  trend: "up",    threshold: 8.5, unit: "% rev", status: "amber" },
    lastUpdated: "27 Apr 2026",
  },
  {
    lesseeId: "AF",
    lesseeName: "Air France",
    country: "France",
    stage: "1",
    exposureUSD: 278*M,
    compositeSignal: "green",
    compositeScore: 22,
    loadFactor:       { value: 93.2, trend: "up",    threshold: 80,  unit: "%",     status: "green" },
    scheduleStability:{ value: 96.4, trend: "up",    threshold: 85,  unit: "%",     status: "green" },
    fuelCostStress:   { value: 28.1, trend: "flat",  threshold: 35,  unit: "% opex",status: "green" },
    revLeaseRatio:    { value: 4.2,  trend: "down",  threshold: 8.5, unit: "% rev", status: "green" },
    lastUpdated: "29 Apr 2026",
  },
  {
    lesseeId: "RYANAIR",
    lesseeName: "Ryanair",
    country: "Ireland",
    stage: "1",
    exposureUSD: 386*M,
    compositeSignal: "green",
    compositeScore: 14,
    loadFactor:       { value: 94.3, trend: "up",    threshold: 80,  unit: "%",     status: "green" },
    scheduleStability:{ value: 98.2, trend: "flat",  threshold: 85,  unit: "%",     status: "green" },
    fuelCostStress:   { value: 26.4, trend: "flat",  threshold: 35,  unit: "% opex",status: "green" },
    revLeaseRatio:    { value: 3.8,  trend: "down",  threshold: 8.5, unit: "% rev", status: "green" },
    lastUpdated: "29 Apr 2026",
  },
  {
    lesseeId: "EK",
    lesseeName: "Emirates",
    country: "UAE",
    stage: "1",
    exposureUSD: 412*M,
    compositeSignal: "green",
    compositeScore: 12,
    loadFactor:       { value: 84.7, trend: "up",    threshold: 80,  unit: "%",     status: "green" },
    scheduleStability:{ value: 97.8, trend: "flat",  threshold: 85,  unit: "%",     status: "green" },
    fuelCostStress:   { value: 25.3, trend: "flat",  threshold: 35,  unit: "% opex",status: "green" },
    revLeaseRatio:    { value: 3.1,  trend: "down",  threshold: 8.5, unit: "% rev", status: "green" },
    lastUpdated: "29 Apr 2026",
  },
  {
    lesseeId: "SQ",
    lesseeName: "Singapore Airlines",
    country: "Singapore",
    stage: "1",
    exposureUSD: 290*M,
    compositeSignal: "green",
    compositeScore: 10,
    loadFactor:       { value: 87.2, trend: "up",    threshold: 80,  unit: "%",     status: "green" },
    scheduleStability:{ value: 98.6, trend: "flat",  threshold: 85,  unit: "%",     status: "green" },
    fuelCostStress:   { value: 23.8, trend: "flat",  threshold: 35,  unit: "% opex",status: "green" },
    revLeaseRatio:    { value: 2.9,  trend: "down",  threshold: 8.5, unit: "% rev", status: "green" },
    lastUpdated: "29 Apr 2026",
  },
  {
    lesseeId: "LH",
    lesseeName: "Lufthansa",
    country: "Germany",
    stage: "1",
    exposureUSD: 194*M,
    compositeSignal: "green",
    compositeScore: 16,
    loadFactor:       { value: 89.1, trend: "flat",  threshold: 80,  unit: "%",     status: "green" },
    scheduleStability:{ value: 97.1, trend: "flat",  threshold: 85,  unit: "%",     status: "green" },
    fuelCostStress:   { value: 27.4, trend: "up",    threshold: 35,  unit: "% opex",status: "green" },
    revLeaseRatio:    { value: 3.4,  trend: "flat",  threshold: 8.5, unit: "% rev", status: "green" },
    lastUpdated: "28 Apr 2026",
  },
];

// ─── Deal Intelligence Feed ───────────────────────────────────────────────────

export const DEAL_FEED: DealItem[] = [
  {
    id: "deal-01",
    headline: "IndiGo to reduce cabin crew by 3% amid fuel cost pressure — management attributes to FX and Jet-A1 spike",
    source: "Economic Times (India)",
    publishedAt: "29 Apr 2026",
    hoursAgo: 6,
    category: "financial-distress",
    sentiment: "negative",
    relevance: "high",
    affectedLesseeNames: ["IndiGo Airlines"],
    portfolioTag: "Affects IndiGo Airlines — $184M exposure, Stage 3",
    suggestedAction: "Review IndiGo ECL and lifetime PD assumptions",
    actionHref: "/counterparties",
  },
  {
    id: "deal-02",
    headline: "IATA Financial Monitor: Only 47% of airlines had meaningful fuel hedges in Q1 2026; IndiGo reported no fuel hedging",
    source: "IATA Airline Financial Monitor",
    publishedAt: "28 Apr 2026",
    hoursAgo: 30,
    category: "financial-distress",
    sentiment: "negative",
    relevance: "high",
    affectedLesseeNames: ["IndiGo Airlines", "Aeromexico", "Azul Brazilian Airlines"],
    portfolioTag: "Affects IndiGo, Aeromexico, Azul — $448M unhedged fuel exposure",
    suggestedAction: "Run Fuel Spike scenario on Stage 2/3 lessees",
    actionHref: "/scenarios/run",
  },
  {
    id: "deal-03",
    headline: "Air France-KLM reports Q1 2026 EBIT of €720M, up 18% YoY; load factor reached 93.2%",
    source: "Air France-KLM Investor Relations",
    publishedAt: "28 Apr 2026",
    hoursAgo: 36,
    category: "positive",
    sentiment: "positive",
    relevance: "high",
    affectedLesseeNames: ["Air France"],
    portfolioTag: "Affects Air France — $278M exposure, Stage 1",
    suggestedAction: "Confirm Stage 1 designation — no action required",
    actionHref: "/counterparties",
  },
  {
    id: "deal-04",
    headline: "Sri Lanka President confirms SriLankan Airlines will not be privatised in 2026; state bank restructuring support pledged",
    source: "Reuters / Colombo Gazette",
    publishedAt: "27 Apr 2026",
    hoursAgo: 52,
    category: "regulatory",
    sentiment: "neutral",
    relevance: "high",
    affectedLesseeNames: ["SriLankan Airlines"],
    portfolioTag: "Affects SriLankan Airlines — $118M exposure, Stage 2",
    suggestedAction: "Update repossession probability — government backstop extends lease",
    actionHref: "/counterparties",
  },
  {
    id: "deal-05",
    headline: "Ryanair places follow-on order for 50 Boeing 737 MAX-10 — €4.5B commitment through 2031",
    source: "Aviation Week",
    publishedAt: "26 Apr 2026",
    hoursAgo: 72,
    category: "fleet",
    sentiment: "positive",
    relevance: "medium",
    affectedLesseeNames: ["Ryanair"],
    portfolioTag: "Affects Ryanair — $386M exposure, Stage 1",
    suggestedAction: "No action — fleet expansion confirms operational health",
    actionHref: "/counterparties",
  },
  {
    id: "deal-06",
    headline: "Brazil ANAC tightens air operator certificate renewal requirements for domestic carriers from July 2026",
    source: "Agência Nacional de Aviação Civil (ANAC)",
    publishedAt: "25 Apr 2026",
    hoursAgo: 96,
    category: "regulatory",
    sentiment: "negative",
    relevance: "medium",
    affectedLesseeNames: ["Azul Brazilian Airlines"],
    portfolioTag: "Affects Azul Brazilian Airlines — $142M exposure, Stage 2",
    suggestedAction: "Confirm Azul AOC renewal status and document in counterparty record",
    actionHref: "/counterparties",
  },
  {
    id: "deal-07",
    headline: "Singapore–UAE bilateral air services expanded: 28 new weekly frequencies from Oct 2026",
    source: "CAAS Singapore / GCAA UAE",
    publishedAt: "24 Apr 2026",
    hoursAgo: 120,
    category: "positive",
    sentiment: "positive",
    relevance: "medium",
    affectedLesseeNames: ["Emirates", "Singapore Airlines"],
    portfolioTag: "Affects Emirates ($412M) and Singapore Airlines ($290M) — combined $702M",
    suggestedAction: "Route expansion positive for both Stage 1 carriers — no action required",
    actionHref: "/counterparties",
  },
  {
    id: "deal-08",
    headline: "Mexican transport ministry extends Aeromexico PSO subsidy for regional routes through 2027",
    source: "Reuters / SCT Mexico",
    publishedAt: "23 Apr 2026",
    hoursAgo: 144,
    category: "positive",
    sentiment: "positive",
    relevance: "medium",
    affectedLesseeNames: ["Aeromexico"],
    portfolioTag: "Affects Aeromexico — $122M exposure, Stage 3",
    suggestedAction: "Government support reduces near-term default probability — note in ECL narrative",
    actionHref: "/counterparties",
  },
  {
    id: "deal-09",
    headline: "OFAC SDN list updated 29 Apr 2026 — 14 new designations, zero aviation entities. No portfolio impact detected.",
    source: "OFAC / US Treasury",
    publishedAt: "29 Apr 2026",
    hoursAgo: 4,
    category: "sanctions",
    sentiment: "neutral",
    relevance: "low",
    affectedLesseeNames: [],
    portfolioTag: "No portfolio impact — all 10 lessees remain Sanctions Clear",
    suggestedAction: "No action required",
    actionHref: "/counterparties",
  },
];

// ─── Jurisdiction Watch Events ─────────────────────────────────────────────────

export const JURISDICTION_EVENTS: JurisdictionEvent[] = [
  {
    id: "jx-01",
    jurisdiction: "India",
    code: "IN",
    eventType: "legal",
    headline: "Delhi HC rules for SMBC Aviation Capital in IndiGo repossession — confirms IDERA enforceability",
    detail:
      "Delhi High Court upheld the International Registry's IDERA (Irrevocable De-Registration and Export Request Authorisation) in a contested repossession by SMBC against 4 IndiGo A320neo aircraft. The ruling cited the Insolvency and Bankruptcy Code 2024 amendments as consistent with Cape Town obligations. First major post-amendment test.",
    source: "Vedder Price Aviation Law Update",
    date: "15 Apr 2026",
    sentiment: "positive",
    portfolioExposureUSD: 184*M,
    lesseesAffected: ["IndiGo Airlines"],
  },
  {
    id: "jx-02",
    jurisdiction: "Brazil",
    code: "BR",
    eventType: "regulatory",
    headline: "Banco Central tightens USD remittance reporting requirements for airlines from 1 Jun 2026",
    detail:
      "Banco Central do Brasil Circular 4,089 (published 22 Apr 2026) requires airlines to obtain prior regulatory approval for USD remittances exceeding $10M per quarter. This adds an administrative step to the USD lease payment process for Brazilian lessees but does not restrict the right to remit.",
    source: "Banco Central do Brasil / Matheson FX Update",
    date: "22 Apr 2026",
    sentiment: "negative",
    portfolioExposureUSD: 142*M,
    lesseesAffected: ["Azul Brazilian Airlines"],
  },
  {
    id: "jx-03",
    jurisdiction: "Sri Lanka",
    code: "LK",
    eventType: "credit",
    headline: "Fitch affirms Sri Lanka 'CCC+' sovereign rating — improvement from 2023-24 selective default",
    detail:
      "Fitch Ratings affirmed Sri Lanka's Long-Term Foreign-Currency IDR at 'CCC+' on 19 Apr 2026, citing improved foreign exchange reserves ($5.2B) and completion of IMF Extended Fund Facility tranche. The CCC+ rating implies the sovereign is still in distress but capable of meeting near-term obligations. Lessor repossession right enforcement remains improved vs. 2022-23.",
    source: "Fitch Ratings Press Release",
    date: "19 Apr 2026",
    sentiment: "positive",
    portfolioExposureUSD: 118*M,
    lesseesAffected: ["SriLankan Airlines"],
  },
  {
    id: "jx-04",
    jurisdiction: "Ireland",
    code: "IE",
    eventType: "legal",
    headline: "IAA publishes updated aircraft release guidance — confirms expedited de-registration for IDERA-backed lessors",
    detail:
      "The Irish Aviation Authority issued Airworthiness Notice AN-01-005 on 28 Apr 2026 updating de-registration procedures. The notice confirms that IDERA-backed repossession requests will be processed within 5 business days — down from the previous 10-day administrative window. Significant for Irish-registered SPVs.",
    source: "IAA Ireland / A&L Goodbody Aviation Update",
    date: "28 Apr 2026",
    sentiment: "positive",
    portfolioExposureUSD: 386*M,
    lesseesAffected: ["Ryanair"],
  },
  {
    id: "jx-05",
    jurisdiction: "Mexico",
    code: "MX",
    eventType: "regulatory",
    headline: "DGAC updates bilateral compliance framework — new AOC validation requirements from Sep 2026",
    detail:
      "Mexico's Dirección General de Aeronáutica Civil (DGAC) published updated bilateral safety oversight framework requirements on 10 Apr 2026. Airlines operating under bilateral agreements will require re-validation of Air Operator Certificates by September 2026. Aeromexico is expected to be compliant but the process creates administrative risk.",
    source: "DGAC Mexico / Aviation Week",
    date: "10 Apr 2026",
    sentiment: "neutral",
    portfolioExposureUSD: 122*M,
    lesseesAffected: ["Aeromexico"],
  },
];

// ─── Dashboard Market Signal Tiles ────────────────────────────────────────────
// Five curated tiles for the Dashboard strip — derived from MACRO_SIGNALS.

export interface DashboardSignalTile {
  id: string;
  icon: string;           // bootstrap icon class
  label: string;
  value: string;
  subtext: string;
  severity: SignalSeverity;
  direction: SignalDirection;
  href: string;
}

export const DASHBOARD_SIGNAL_TILES: DashboardSignalTile[] = [
  {
    id: "dst-01",
    icon: "bi-fuel-pump",
    label: "Jet-A1 Fuel",
    value: "+27.3% YTD",
    subtext: "$1.12/litre · All 10 lessees · ECL +$4.2M",
    severity: "high",
    direction: "up",
    href: "/intelligence",
  },
  {
    id: "dst-02",
    icon: "bi-globe",
    label: "India GDP Revised",
    value: "−0.6pp",
    subtext: "5.8% vs 6.4% IMF Oct · IndiGo $184M · ECL +$2.1M",
    severity: "high",
    direction: "down",
    href: "/intelligence",
  },
  {
    id: "dst-03",
    icon: "bi-currency-exchange",
    label: "INR/USD",
    value: "INR −2.1%",
    subtext: "₹84.32 · IndiGo lease ratio compressed",
    severity: "high",
    direction: "down",
    href: "/intelligence",
  },
  {
    id: "dst-04",
    icon: "bi-airplane",
    label: "EU Aviation RPK",
    value: "+4.8% YoY",
    subtext: "Eurocontrol Mar 2026 · Ryanair, Air France, Lufthansa",
    severity: "low",
    direction: "up",
    href: "/intelligence",
  },
  {
    id: "dst-05",
    icon: "bi-clipboard",
    label: "Deal Feed",
    value: "4 events",
    subtext: "2 negative · 2 positive · IndiGo · Aeromexico · SriLankan",
    severity: "medium",
    direction: "up",
    href: "/intelligence",
  },
];

// ─── Scenario Calibration Divergences ─────────────────────────────────────────
// Flags where current market conditions diverge from last-run scenario assumptions.

export interface ScenarioCalibrationDivergence {
  id: string;
  label: string;
  currentMarket: string;
  scenarioAssumption: string;
  divergence: string;
  severity: SignalSeverity;
  suggestedInputKey: string;   // maps to ScenarioInputs field name
  suggestedValue: number;
}

export const SCENARIO_CALIBRATION: ScenarioCalibrationDivergence[] = [
  {
    id: "cal-01",
    label: "Jet-A1 Fuel Price",
    currentMarket: "$1.12/litre (IATA, 28 Apr 2026)",
    scenarioAssumption: "$0.98/litre (Baseline forward curve)",
    divergence: "+14.3% above scenario baseline",
    severity: "high",
    suggestedInputKey: "fuelDelta",
    suggestedValue: 0.143,
  },
  {
    id: "cal-02",
    label: "India GDP",
    currentMarket: "5.8% growth (IMF WEO Apr 2026)",
    scenarioAssumption: "6.4% growth (WEO Oct 2025 assumption)",
    divergence: "−0.6pp actual shock already delivered",
    severity: "high",
    suggestedInputKey: "gdpDelta",
    suggestedValue: -0.006,
  },
  {
    id: "cal-03",
    label: "EUR/USD Rate",
    currentMarket: "1.0789 (ECB, 29 Apr 2026)",
    scenarioAssumption: "1.1012 (30 Jan 2026 baseline)",
    divergence: "EUR −2.0% vs scenario FX baseline",
    severity: "medium",
    suggestedInputKey: "fxDelta",
    suggestedValue: -0.020,
  },
];
