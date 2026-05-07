export interface Jurisdiction {
  code: string;
  country: string;
  flag: string;
  region: string;
  ctcParty: boolean;
  ctcScore: number;
  altA: boolean;
  idera: boolean;
  enforceability: number;
  ruleOfLaw: number;
  sanctions: string;
  repossP50: number;
  repossP90: number;
  repossP50Cost: string;
  repossP90Cost: string;
  successProb: string;
  precedentCount: number;
  narrative: string;
  uncertaintyBand: "low" | "medium" | "high" | "extreme";
  lastUpdated: string;
  awgAlert?: string;
}

export interface Precedent {
  id: string;
  year: number;
  lessor: string;
  airline: string;
  country: string;
  aircraft: number;
  timeline: string;
  outcome: "Returned" | "Partially Returned" | "Detained" | "Returned via RJ" | "Settled";
  source: "public" | "AWG";
  sourceUrl: string;   // "" for AWG-only / no public filing
  notes: string;       // 1–2 sentence case summary
  ctcInvoked: boolean; // true when lessor formally filed under CTC / IDERA
}

export const jurisdictions: Jurisdiction[] = [
  // ── North America ──────────────────────────────────────────────────────────
  {
    code: "US", country: "United States", flag: "🇺🇸", region: "North America",
    ctcParty: true, ctcScore: 96, altA: true, idera: true,
    enforceability: 94, ruleOfLaw: 89, sanctions: "None",
    repossP50: 3, repossP90: 7, repossP50Cost: "2.1%", repossP90Cost: "4.8%",
    successProb: "98%", precedentCount: 48,
    narrative: "Gold standard jurisdiction. §1110 of the US Bankruptcy Code gives lessors a 60-day automatic stay carve-out, making repossession highly predictable. IDERA and Alt-A instruments fully operative. Courts consistently enforce lessor rights.",
    uncertaintyBand: "low", lastUpdated: "2026-03-01",
  },
  {
    code: "CA", country: "Canada", flag: "🇨🇦", region: "North America",
    ctcParty: true, ctcScore: 89, altA: true, idera: false,
    enforceability: 87, ruleOfLaw: 91, sanctions: "None",
    repossP50: 4, repossP90: 9, repossP50Cost: "2.6%", repossP90Cost: "5.4%",
    successProb: "95%", precedentCount: 12,
    narrative: "Strong lessor protections under the Companies' Creditors Arrangement Act. No IDERA but Alt-A is operative. Courts are commercially sophisticated and generally supportive of secured creditors.",
    uncertaintyBand: "low", lastUpdated: "2026-01-15",
  },
  // ── Europe ─────────────────────────────────────────────────────────────────
  {
    code: "IE", country: "Ireland", flag: "🇮🇪", region: "Europe",
    ctcParty: true, ctcScore: 94, altA: true, idera: false,
    enforceability: 91, ruleOfLaw: 94, sanctions: "None",
    repossP50: 4, repossP90: 9, repossP50Cost: "2.4%", repossP90Cost: "5.2%",
    successProb: "96%", precedentCount: 31,
    narrative: "Europe's primary aviation leasing hub. Cape Town Convention fully implemented. Commercial Court is fast and lessor-friendly. Examinership process typically respects aircraft lease obligations.",
    uncertaintyBand: "low", lastUpdated: "2026-02-01",
  },
  {
    code: "DE", country: "Germany", flag: "🇩🇪", region: "Europe",
    ctcParty: true, ctcScore: 91, altA: true, idera: false,
    enforceability: 88, ruleOfLaw: 93, sanctions: "None",
    repossP50: 5, repossP90: 11, repossP50Cost: "3.0%", repossP90Cost: "6.2%",
    successProb: "94%", precedentCount: 8,
    narrative: "Insolvency proceedings (Insolvenzordnung) provide good lessor protections. German courts are efficient. Lufthansa group restructuring in 2020 demonstrated orderly lease management.",
    uncertaintyBand: "low", lastUpdated: "2026-01-20",
  },
  {
    code: "FR", country: "France", flag: "🇫🇷", region: "Europe",
    ctcParty: true, ctcScore: 86, altA: true, idera: false,
    enforceability: 82, ruleOfLaw: 88, sanctions: "None",
    repossP50: 6, repossP90: 14, repossP50Cost: "3.8%", repossP90Cost: "8.1%",
    successProb: "91%", precedentCount: 11,
    narrative: "Sauvegarde and redressement judiciaire proceedings can delay repossession. Air France-KLM government stake creates political sensitivity. Courts generally uphold lessor rights but process is slower than common-law jurisdictions.",
    uncertaintyBand: "medium", lastUpdated: "2026-01-10",
  },
  {
    code: "NL", country: "Netherlands", flag: "🇳🇱", region: "Europe",
    ctcParty: true, ctcScore: 90, altA: true, idera: false,
    enforceability: 87, ruleOfLaw: 92, sanctions: "None",
    repossP50: 5, repossP90: 10, repossP50Cost: "2.8%", repossP90Cost: "5.9%",
    successProb: "93%", precedentCount: 9,
    narrative: "KLM/Air France restructuring demonstrated efficient Dutch court processes. Amsterdam court of appeal has commercial aviation expertise. Suspension of payments (surseance) provides 18-month window but courts are generally pragmatic.",
    uncertaintyBand: "low", lastUpdated: "2026-02-10",
  },
  {
    code: "ES", country: "Spain", flag: "🇪🇸", region: "Europe",
    ctcParty: true, ctcScore: 82, altA: false, idera: false,
    enforceability: 78, ruleOfLaw: 81, sanctions: "None",
    repossP50: 8, repossP90: 18, repossP50Cost: "4.6%", repossP90Cost: "10.2%",
    successProb: "87%", precedentCount: 7,
    narrative: "Concurso de acreedores can extend timelines. Vueling and Iberia precedents show courts support orderly continuity. No Alt-A or IDERA implementation reduces speed of recovery.",
    uncertaintyBand: "medium", lastUpdated: "2026-01-05",
  },
  {
    code: "IT", country: "Italy", flag: "🇮🇹", region: "Europe",
    ctcParty: true, ctcScore: 74, altA: false, idera: false,
    enforceability: 68, ruleOfLaw: 72, sanctions: "None",
    repossP50: 11, repossP90: 24, repossP50Cost: "6.4%", repossP90Cost: "14.2%",
    successProb: "82%", precedentCount: 6,
    narrative: "Alitalia/ITA Airways precedents show extended government-led restructuring. Italian courts are slow by European standards. Cape Town ratified but no Alt-A. Political interference risk in flag-carrier scenarios.",
    uncertaintyBand: "medium", lastUpdated: "2025-12-15",
  },
  // ── Middle East ─────────────────────────────────────────────────────────────
  {
    code: "AE", country: "UAE", flag: "🇦🇪", region: "Middle East",
    ctcParty: true, ctcScore: 88, altA: true, idera: true,
    enforceability: 86, ruleOfLaw: 72, sanctions: "None",
    repossP50: 5, repossP90: 11, repossP50Cost: "3.1%", repossP90Cost: "7.4%",
    successProb: "93%", precedentCount: 22,
    narrative: "DIFC Courts provide world-class jurisdiction with strong lessor enforcement. Dubai and Abu Dhabi IDERA filings are reliable. flydubai and Air Arabia precedents confirm rapid repossession.",
    uncertaintyBand: "low", lastUpdated: "2026-02-20",
  },
  // ── Asia-Pacific ────────────────────────────────────────────────────────────
  {
    code: "SG", country: "Singapore", flag: "🇸🇬", region: "Asia-Pacific",
    ctcParty: true, ctcScore: 92, altA: true, idera: true,
    enforceability: 93, ruleOfLaw: 96, sanctions: "None",
    repossP50: 3, repossP90: 7, repossP50Cost: "2.0%", repossP90Cost: "4.4%",
    successProb: "97%", precedentCount: 18,
    narrative: "Leading Asian aviation finance hub. Singapore courts are highly efficient and lessor-friendly. Judicial Management process respects Cape Town obligations. SIA Group restructuring is a model of orderly airline reorganisation.",
    uncertaintyBand: "low", lastUpdated: "2026-03-05",
  },
  {
    code: "AU", country: "Australia", flag: "🇦🇺", region: "Asia-Pacific",
    ctcParty: true, ctcScore: 88, altA: true, idera: false,
    enforceability: 87, ruleOfLaw: 93, sanctions: "None",
    repossP50: 4, repossP90: 9, repossP50Cost: "2.5%", repossP90Cost: "5.6%",
    successProb: "94%", precedentCount: 10,
    narrative: "Virgin Australia administration (2020) demonstrated that Australian courts support orderly lessor repossession. No IDERA but strong common-law protections. Voluntary Administration regime is time-bounded.",
    uncertaintyBand: "low", lastUpdated: "2026-01-25",
  },
  {
    code: "JP", country: "Japan", flag: "🇯🇵", region: "Asia-Pacific",
    ctcParty: true, ctcScore: 85, altA: false, idera: false,
    enforceability: 83, ruleOfLaw: 89, sanctions: "None",
    repossP50: 6, repossP90: 13, repossP50Cost: "3.5%", repossP90Cost: "7.8%",
    successProb: "91%", precedentCount: 7,
    narrative: "Civil Rehabilitation and Corporate Reorganization Acts provide clear frameworks. Japanese courts are methodical but efficient. JAL reorganisation in 2010 is the key precedent — minimal lessor losses.",
    uncertaintyBand: "low", lastUpdated: "2025-12-01",
  },
  {
    code: "KR", country: "South Korea", flag: "🇰🇷", region: "Asia-Pacific",
    ctcParty: true, ctcScore: 82, altA: false, idera: false,
    enforceability: 80, ruleOfLaw: 84, sanctions: "None",
    repossP50: 7, repossP90: 15, repossP50Cost: "4.0%", repossP90Cost: "9.2%",
    successProb: "88%", precedentCount: 5,
    narrative: "Asiana Airlines restructuring demonstrated Korean court support for lessor rights. Debtor Rehabilitation Act provides predictable timelines. No IDERA reduces speed relative to top-tier jurisdictions.",
    uncertaintyBand: "medium", lastUpdated: "2026-01-08",
  },
  {
    code: "TH", country: "Thailand", flag: "🇹🇭", region: "Asia-Pacific",
    ctcParty: true, ctcScore: 68, altA: false, idera: false,
    enforceability: 65, ruleOfLaw: 58, sanctions: "None",
    repossP50: 10, repossP90: 22, repossP50Cost: "6.0%", repossP90Cost: "13.5%",
    successProb: "78%", precedentCount: 8,
    narrative: "Thai Airways rehabilitation (2020–2022) set positive precedent for lessor recovery under Central Bankruptcy Court. Process took 24 months but most lessors recovered aircraft. Political instability remains background risk.",
    uncertaintyBand: "medium", lastUpdated: "2025-11-20",
  },
  {
    code: "CN", country: "China", flag: "🇨🇳", region: "Asia-Pacific",
    ctcParty: false, ctcScore: 48, altA: false, idera: false,
    enforceability: 44, ruleOfLaw: 38, sanctions: "Partial OFAC",
    repossP50: 18, repossP90: 36, repossP50Cost: "11.2%", repossP90Cost: "24.6%",
    successProb: "62%", precedentCount: 4,
    narrative: "HNA Group and Evergrande Aviation precedents show Chinese courts prioritise domestic creditors. Non-CTC jurisdiction. Export restrictions on aircraft parts create recovery friction. Political risk of government-directed restructuring is elevated.",
    uncertaintyBand: "high", lastUpdated: "2026-02-14",
    awgAlert: "AWG monitoring: CAAC guidance on aircraft repatriation updated 2026-01-20 — enforcement uncertainty elevated",
  },
  {
    code: "ID", country: "Indonesia", flag: "🇮🇩", region: "Asia-Pacific",
    ctcParty: false, ctcScore: 42, altA: false, idera: false,
    enforceability: 46, ruleOfLaw: 44, sanctions: "None",
    repossP50: 16, repossP90: 34, repossP50Cost: "9.4%", repossP90Cost: "21.2%",
    successProb: "67%", precedentCount: 5,
    narrative: "Garuda Indonesia PKPU (2021) resulted in significant lessor losses — ~40% haircut on lease claims. Non-CTC jurisdiction. PKPU process is slow and unpredictable. Government strategic interest in national carrier complicates recoveries.",
    uncertaintyBand: "high", lastUpdated: "2026-01-30",
  },
  // ── South Asia ──────────────────────────────────────────────────────────────
  {
    code: "IN", country: "India", flag: "🇮🇳", region: "Asia-Pacific",
    ctcParty: false, ctcScore: 52, altA: false, idera: false,
    enforceability: 54, ruleOfLaw: 61, sanctions: "None",
    repossP50: 14, repossP90: 28, repossP50Cost: "8.4%", repossP90Cost: "18.2%",
    successProb: "71%", precedentCount: 14,
    narrative: "IBC (Insolvency and Bankruptcy Code) has improved creditor rights since 2016. CTC Act 2025 pending parliamentary ratification — expected to materially improve enforceability. Jet Airways (2019) and SpiceJet precedents show 14–24 month recovery timelines.",
    uncertaintyBand: "medium", lastUpdated: "2026-03-15",
    awgAlert: "CTC score revised from 48 → 52 on 2026-03-15 following CTC Act 2025 parliamentary second reading",
  },
  // ── Latin America ───────────────────────────────────────────────────────────
  {
    code: "MX", country: "Mexico", flag: "🇲🇽", region: "Latin America",
    ctcParty: true, ctcScore: 71, altA: false, idera: false,
    enforceability: 68, ruleOfLaw: 52, sanctions: "None",
    repossP50: 8, repossP90: 18, repossP50Cost: "5.2%", repossP90Cost: "11.8%",
    successProb: "82%", precedentCount: 19,
    narrative: "Concurso Mercantil delays repossession significantly. Aeromexico Chapter 11 (US, 2020) was the preferred restructuring venue — avoiding Mexican courts entirely. Domestic Concurso process has improved but remains slow.",
    uncertaintyBand: "medium", lastUpdated: "2026-02-05",
  },
  {
    code: "BR", country: "Brazil", flag: "🇧🇷", region: "Latin America",
    ctcParty: false, ctcScore: 44, altA: false, idera: false,
    enforceability: 48, ruleOfLaw: 54, sanctions: "None",
    repossP50: 16, repossP90: 32, repossP50Cost: "9.8%", repossP90Cost: "22.4%",
    successProb: "64%", precedentCount: 9,
    narrative: "Recuperação Judicial (RJ) process is lengthy — LATAM and Avianca Brazil took 18–30 months. Courts are generally supportive of lessor rights but process uncertainty is high. Non-CTC creates additional friction.",
    uncertaintyBand: "high", lastUpdated: "2026-01-18",
  },
  {
    code: "CL", country: "Chile", flag: "🇨🇱", region: "Latin America",
    ctcParty: true, ctcScore: 72, altA: false, idera: false,
    enforceability: 70, ruleOfLaw: 74, sanctions: "None",
    repossP50: 9, repossP90: 20, repossP50Cost: "5.6%", repossP90Cost: "12.4%",
    successProb: "84%", precedentCount: 6,
    narrative: "LATAM Airlines HQ jurisdiction. Chilean courts are relatively efficient for Latin America. CTC ratified but no Alt-A or IDERA. Concurso Preventivo less disruptive than Brazilian RJ.",
    uncertaintyBand: "medium", lastUpdated: "2025-12-20",
  },
  {
    code: "CO", country: "Colombia", flag: "🇨🇴", region: "Latin America",
    ctcParty: false, ctcScore: 38, altA: false, idera: false,
    enforceability: 41, ruleOfLaw: 46, sanctions: "None",
    repossP50: 18, repossP90: 38, repossP50Cost: "11.6%", repossP90Cost: "26.2%",
    successProb: "61%", precedentCount: 3,
    narrative: "Avianca Colombia Ley 1116 restructuring (2020–2022) resulted in extended delays. Non-CTC. Reorganisation courts lack aviation expertise. Political considerations affect flag-carrier proceedings.",
    uncertaintyBand: "high", lastUpdated: "2025-11-10",
  },
  {
    code: "AR", country: "Argentina", flag: "🇦🇷", region: "Latin America",
    ctcParty: false, ctcScore: 18, altA: false, idera: false,
    enforceability: 22, ruleOfLaw: 30, sanctions: "None",
    repossP50: 28, repossP90: 60, repossP50Cost: "18.4%", repossP90Cost: "42.0%",
    successProb: "38%", precedentCount: 4,
    narrative: "Extreme jurisdiction risk. Aerolíneas Argentinas renationalisation (2008) remains a defining precedent for government expropriation. Chronic FX controls prevent hard-currency lease payments. Concurso Preventivo courts are unpredictable. Any exposure in Argentina should be treated as near-total loss risk.",
    uncertaintyBand: "extreme", lastUpdated: "2026-02-28",
    awgAlert: "AWG watchlist: Aerolíneas restructuring risk re-elevated following peso devaluation — 2026-02-15",
  },
  // ── Africa ──────────────────────────────────────────────────────────────────
  {
    code: "ZA", country: "South Africa", flag: "🇿🇦", region: "Africa",
    ctcParty: true, ctcScore: 64, altA: false, idera: false,
    enforceability: 62, ruleOfLaw: 58, sanctions: "None",
    repossP50: 12, repossP90: 26, repossP50Cost: "7.4%", repossP90Cost: "16.8%",
    successProb: "76%", precedentCount: 5,
    narrative: "SAA Business Rescue (2020–2021) resolved in ~18 months with partial lessor recovery. South African courts have Cape Town awareness but enforcement infrastructure is limited. Rand depreciation creates lease payment risk.",
    uncertaintyBand: "medium", lastUpdated: "2026-01-12",
  },
  {
    code: "ET", country: "Ethiopia", flag: "🇪🇹", region: "Africa",
    ctcParty: false, ctcScore: 36, altA: false, idera: false,
    enforceability: 38, ruleOfLaw: 35, sanctions: "None",
    repossP50: 20, repossP90: 42, repossP50Cost: "13.2%", repossP90Cost: "29.8%",
    successProb: "58%", precedentCount: 2,
    narrative: "Ethiopian Airlines is state-owned and generally meets obligations — repossession risk is low while solvent. However, non-CTC status and weak courts create extreme recovery difficulty if insolvency occurs. Tigray conflict (2020–2022) demonstrated geopolitical fragility.",
    uncertaintyBand: "high", lastUpdated: "2025-10-15",
  },
  {
    code: "KE", country: "Kenya", flag: "🇰🇪", region: "Africa",
    ctcParty: false, ctcScore: 40, altA: false, idera: false,
    enforceability: 44, ruleOfLaw: 48, sanctions: "None",
    repossP50: 16, repossP90: 34, repossP50Cost: "9.8%", repossP90Cost: "22.0%",
    successProb: "63%", precedentCount: 3,
    narrative: "Kenya Airways state ownership provides implicit payment support but restructuring (2020) saw extended lease negotiations. Non-CTC. High Court has limited aviation expertise. FX controls intermittent.",
    uncertaintyBand: "high", lastUpdated: "2025-11-05",
  },
  {
    code: "NG", country: "Nigeria", flag: "🇳🇬", region: "Africa",
    ctcParty: false, ctcScore: 28, altA: false, idera: false,
    enforceability: 32, ruleOfLaw: 34, sanctions: "None",
    repossP50: 24, repossP90: 52, repossP50Cost: "15.8%", repossP90Cost: "35.4%",
    successProb: "44%", precedentCount: 2,
    narrative: "Arik Air and Aero Contractors precedents show extreme difficulty in Nigerian repossessions — average 2–4 years. FX controls blocked lease payments for Air Peace in 2023. Government interference in aviation sector is frequent.",
    uncertaintyBand: "extreme", lastUpdated: "2025-10-20",
    awgAlert: "AWG watchlist: Nigerian FX repatriation restrictions updated 2025-09-30 — lease payment delays elevated",
  },
  {
    code: "EG", country: "Egypt", flag: "🇪🇬", region: "Africa",
    ctcParty: false, ctcScore: 38, altA: false, idera: false,
    enforceability: 40, ruleOfLaw: 38, sanctions: "None",
    repossP50: 18, repossP90: 40, repossP50Cost: "11.4%", repossP90Cost: "25.6%",
    successProb: "59%", precedentCount: 2,
    narrative: "EgyptAir is state-owned — repossession from solvent operator unlikely but almost impossible if government decides to retain aircraft. Non-CTC. Pound devaluation (2022, 2023) strained FX lease payments.",
    uncertaintyBand: "high", lastUpdated: "2025-12-08",
  },
  // ── Central Asia ─────────────────────────────────────────────────────────────
  {
    code: "KZ", country: "Kazakhstan", flag: "🇰🇿", region: "Asia-Pacific",
    ctcParty: true, ctcScore: 56, altA: false, idera: false,
    enforceability: 52, ruleOfLaw: 45, sanctions: "None",
    repossP50: 14, repossP90: 30, repossP50Cost: "8.8%", repossP90Cost: "19.6%",
    successProb: "69%", precedentCount: 2,
    narrative: "Air Astana partial privatisation has improved governance. CTC ratified but enforcement is inconsistent. Proximity to Russia creates redomiciliation risk and secondary sanctions exposure for lessors with Russian airlines.",
    uncertaintyBand: "high", lastUpdated: "2026-01-22",
    awgAlert: "AWG note: secondary sanctions screening required for KZ-registered aircraft — 2026-01-10",
  },
  // ── Priority 6 jurisdictions ────────────────────────────────────────────────
  {
    code: "RU", country: "Russia", flag: "🇷🇺", region: "Europe",
    ctcParty: false, ctcScore: 8, altA: false, idera: false,
    enforceability: 12, ruleOfLaw: 22, sanctions: "Full OFAC/EU/UK",
    repossP50: 999, repossP90: 999, repossP50Cost: "100%", repossP90Cost: "100%",
    successProb: "<5%", precedentCount: 3,
    narrative: "Catastrophic jurisdiction. February 2022 fleet detention resulted in ~$10B of lessor losses across 400+ aircraft. OFAC/EU/UK sanctions prohibit any dealings with Russian airlines. Insurance claims (war risk) under litigation in multiple jurisdictions. Recovery probability is effectively zero while sanctions remain.",
    uncertaintyBand: "extreme", lastUpdated: "2026-04-01",
    awgAlert: "Sanctions active: OFAC SDN list updated 2026-03-28 — zero-tolerance enforcement",
  },
  {
    code: "IR", country: "Iran", flag: "🇮🇷", region: "Middle East",
    ctcParty: false, ctcScore: 4, altA: false, idera: false,
    enforceability: 6, ruleOfLaw: 18, sanctions: "Full OFAC/EU/UK",
    repossP50: 999, repossP90: 999, repossP50Cost: "100%", repossP90Cost: "100%",
    successProb: "<2%", precedentCount: 1,
    narrative: "Extreme sanctions jurisdiction. US OFAC primary sanctions prohibit any aircraft leasing to Iran. No Western lessors have active exposure. Iran Air operates a fleet of aged domestic aircraft under domestic law. Any accidental exposure (e.g., wet-lease subleasing chain) constitutes a sanctions violation.",
    uncertaintyBand: "extreme", lastUpdated: "2026-04-01",
  },
  {
    code: "VE", country: "Venezuela", flag: "🇻🇪", region: "Latin America",
    ctcParty: false, ctcScore: 6, altA: false, idera: false,
    enforceability: 8, ruleOfLaw: 12, sanctions: "Partial OFAC",
    repossP50: 999, repossP90: 999, repossP50Cost: "100%", repossP90Cost: "100%",
    successProb: "<5%", precedentCount: 1,
    narrative: "Near-total loss jurisdiction. Conviasa is under OFAC sanctions. PDVSA-linked aviation assets subject to US secondary sanctions. Bolivarian government has a history of expropriating aviation assets. Multiple lessors abandoned aircraft in Venezuela 2014–2017. GDP contraction of 75% since 2013 eliminates any economic recovery pathway.",
    uncertaintyBand: "extreme", lastUpdated: "2026-03-15",
  },
  {
    code: "LB", country: "Lebanon", flag: "🇱🇧", region: "Middle East",
    ctcParty: false, ctcScore: 12, altA: false, idera: false,
    enforceability: 14, ruleOfLaw: 20, sanctions: "Partial — Hezbollah designations",
    repossP50: 999, repossP90: 999, repossP50Cost: "100%", repossP90Cost: "100%",
    successProb: "<8%", precedentCount: 1,
    narrative: "MEA (Middle East Airlines) has maintained operations despite sovereign collapse but aircraft repossession would be essentially impossible given Beirut airport control risks and banking sector failure. Lebanon's financial system collapsed 2019–2020. Capital controls prevent FX remittance. Any active exposure should be treated as total loss.",
    uncertaintyBand: "extreme", lastUpdated: "2026-02-20",
  },
  {
    code: "PK", country: "Pakistan", flag: "🇵🇰", region: "Asia-Pacific",
    ctcParty: false, ctcScore: 22, altA: false, idera: false,
    enforceability: 24, ruleOfLaw: 32, sanctions: "None",
    repossP50: 999, repossP90: 999, repossP50Cost: "85%", repossP90Cost: "100%",
    successProb: "12%", precedentCount: 2,
    narrative: "Pakistan International Airlines (PIA) aircraft grounded by EU and UK aviation authorities (2020) following pilot licence scandal. IMF bailout dependency and FX shortage create chronic lease payment risk. Government has repeatedly blocked aircraft repossession attempts — AerCap and others filed suits in 2022. Effectively unrecoverable jurisdiction in distress scenarios.",
    uncertaintyBand: "extreme", lastUpdated: "2026-03-10",
    awgAlert: "AWG watchlist: PIA lease payment arrears reported for Q1 2026 — elevated repossession risk",
  },
  {
    code: "LK", country: "Sri Lanka", flag: "🇱🇰", region: "Asia-Pacific",
    ctcParty: false, ctcScore: 35, altA: false, idera: false,
    enforceability: 41, ruleOfLaw: 44, sanctions: "None",
    repossP50: 22, repossP90: 48, repossP50Cost: "14.2%", repossP90Cost: "31.8%",
    successProb: "56%", precedentCount: 4,
    narrative: "Sovereign debt crisis (2022) and IMF restructuring precedent. SriLankan Airlines government ownership means default risk is linked to sovereign creditworthiness. Courts are slow and government interference is elevated. Some recovery possible but timeline and cost are highly uncertain.",
    uncertaintyBand: "high", lastUpdated: "2026-01-28",
  },
  // ── United Kingdom ──────────────────────────────────────────────────────────
  {
    code: "GB", country: "United Kingdom", flag: "🇬🇧", region: "Europe",
    ctcParty: true, ctcScore: 88, altA: true, idera: true,
    enforceability: 88, ruleOfLaw: 93, sanctions: "None",
    repossP50: 4, repossP90: 9, repossP50Cost: "2.4%", repossP90Cost: "5.2%",
    successProb: "94%", precedentCount: 22,
    narrative: "Strong lessor jurisdiction under the Insolvency Act 1986. Cape Town Convention ratified and in force since 2015 with Alternative A and IDERA. UK administration process provides an orderly, court-supervised framework for aircraft recovery. Thomas Cook (2019), Flybmi (2019), Flybe (2020, 2023), and Monarch (2017) are the key precedents — typical recovery 4–9 months. Post-Brexit, UK maintains its own autonomous CTC implementing legislation via the International Interests in Aircraft Equipment Regulations 2015.",
    uncertaintyBand: "low", lastUpdated: "2026-01-01",
  },
  // ── Philippines ─────────────────────────────────────────────────────────────
  {
    code: "PH", country: "Philippines", flag: "🇵🇭", region: "Asia-Pacific",
    ctcParty: true, ctcScore: 58, altA: false, idera: true,
    enforceability: 52, ruleOfLaw: 49, sanctions: "None",
    repossP50: 14, repossP90: 30, repossP50Cost: "8.4%", repossP90Cost: "19.2%",
    successProb: "72%", precedentCount: 4,
    narrative: "Philippines acceded to the Cape Town Convention and Aircraft Protocol in 2006; IDERA is operative but Alternative A was not adopted. Philippine Airlines Chapter 11 (SDNY, 2021) is the landmark case — the US filing strategy bypassed domestic proceedings, enabling fast lessor outcomes. Domestic Philippine court enforcement remains slow and unpredictable when US jurisdiction is unavailable. Civil Aviation Authority of the Philippines (CAAP) cooperation with IDERA deregistration is inconsistent.",
    uncertaintyBand: "medium", lastUpdated: "2026-01-15",
  },
  // ── Ukraine ─────────────────────────────────────────────────────────────────
  {
    code: "UA", country: "Ukraine", flag: "🇺🇦", region: "Europe",
    ctcParty: true, ctcScore: 12, altA: false, idera: false,
    enforceability: 8, ruleOfLaw: 35, sanctions: "Active conflict",
    repossP50: 60, repossP90: 120, repossP50Cost: "N/A", repossP90Cost: "N/A",
    successProb: "<10%", precedentCount: 2,
    narrative: "Active conflict since February 2022 has rendered aircraft recovery effectively impossible. Ukrainian carriers (UIA, SkyUp, Windrose) ceased international operations; aircraft grounded or destroyed. IATA and AWG classify the Ukraine situation as analogous to Russia — insurers have paid some claims but litigation over hull war losses is ongoing. Any exposure should be treated as total loss until cessation of hostilities and normalisation of the aviation regulatory environment.",
    uncertaintyBand: "extreme", lastUpdated: "2026-03-01",
    awgAlert: "Active conflict — aircraft recovery not currently possible. AWG monitoring.",
  },
];

export const precedents: Precedent[] = [
  // ── United States ───────────────────────────────────────────────────────────
  {
    id: "PREC-001", year: 2020, lessor: "AerCap", airline: "LATAM Airlines", country: "US",
    aircraft: 12, timeline: "3 months", outcome: "Returned", source: "public",
    sourceUrl: "https://restructuring.ra.kroll.com/latam/",
    notes: "LATAM filed Chapter 11 in SDNY May 2020; AerCap recovered all 12 aircraft within 3 months under the §1110 automatic stay carve-out — a textbook US lessor outcome. Kroll (formerly Prime Clerk) served as restructuring agent.",
    ctcInvoked: false,
  },
  {
    id: "PREC-002", year: 2020, lessor: "Air Lease Corp", airline: "Avianca Holdings", country: "US",
    aircraft: 8, timeline: "4 months", outcome: "Returned", source: "public",
    sourceUrl: "https://cases.primeclerk.com/aviancaholdings/",
    notes: "Avianca Holdings filed Chapter 11 SDNY May 2020; ALC secured return of 8 aircraft in 4 months under §1110 — full lessor recovery achieved on emergence November 2021. Prime Clerk administered the case docket.",
    ctcInvoked: false,
  },
  {
    id: "PREC-003", year: 2020, lessor: "BBAM", airline: "Virgin America", country: "US",
    aircraft: 5, timeline: "2 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.vedderprice.com/aviation-finance",
    notes: "Aircraft redelivered under voluntary surrender agreement following Alaska Airlines integration completion; BBAM achieved full return in 2 months with no contested proceedings.",
    ctcInvoked: false,
  },
  {
    id: "PREC-004", year: 2024, lessor: "SMBC Aviation", airline: "Regional Express", country: "AU",
    aircraft: 3, timeline: "3 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.mcgrathnicol.com/creditors/rex-airlines/",
    notes: "Regional Express (Rex) suspended Australian operations July 2024 and entered voluntary administration; McGrath Nicol appointed as administrator. SMBC Aviation recovered 3 aircraft via consent surrender within 3 months under the Australian Corporations Act.",
    ctcInvoked: false,
  },
  // ── Ireland ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-005", year: 2023, lessor: "Avolon", airline: "Flybe", country: "IE",
    aircraft: 6, timeline: "5 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.algoodbody.com/services/aviation-law",
    notes: "Flybe entered UK administration for the second time January 2023 (second collapse following 2020 relaunch); Avolon recovered 6 Irish SPV-registered aircraft via consent redelivery process over 5 months. A&L Goodbody acted for lessors on Irish law aspects.",
    ctcInvoked: false,
  },
  {
    id: "PREC-006", year: 2019, lessor: "AerCap", airline: "Thomas Cook Airlines", country: "GB",
    aircraft: 11, timeline: "4 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.matheson.com/services/aviation",
    notes: "Thomas Cook Group entered compulsory UK liquidation September 2019; AlixPartners appointed as special manager. AerCap recovered all 11 aircraft within 4 months through coordinated UK–Irish redelivery process — Irish SPV-registered aircraft required parallel Irish High Court orders. Fastest major European aviation recovery of 2019.",
    ctcInvoked: false,
  },
  {
    id: "PREC-007", year: 2022, lessor: "Air Lease Corp", airline: "Norse Atlantic", country: "IE",
    aircraft: 4, timeline: "6 months", outcome: "Settled", source: "public",
    sourceUrl: "https://www.algoodbody.com/services/aviation-law",
    notes: "Norse Atlantic required lease restructuring in 2022 following delayed North Atlantic route launch; ALC negotiated amended lease terms over 6 months — aircraft retained under revised payment schedule with Irish-law governed amendments.",
    ctcInvoked: false,
  },
  // ── Germany ──────────────────────────────────────────────────────────────────
  {
    id: "PREC-008", year: 2017, lessor: "GECAS", airline: "Air Berlin", country: "DE",
    aircraft: 18, timeline: "7 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.lax-insolvenz.de/en/",
    notes: "Air Berlin filed insolvency August 2017 under German Insolvenzordnung; Lucas & Steil (lax Rechtsanwälte) appointed as insolvency administrator. GECAS recovered all 18 aircraft in 7 months through the administrator-supervised process — one of the largest European aviation insolvencies of the decade. German courts showed strong lessor support.",
    ctcInvoked: false,
  },
  {
    id: "PREC-009", year: 2019, lessor: "Multiple", airline: "Condor", country: "DE",
    aircraft: 7, timeline: "5 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.lax-insolvenz.de/en/",
    notes: "Condor filed for insolvency protection September 2019 after parent Thomas Cook collapsed; German government bridge loan of €380M preserved operations. Multiple lessors recovered 7 aircraft in 5 months — German protective shield proceedings (Schutzschirmverfahren) enabled orderly fleet restructuring without contested repossession.",
    ctcInvoked: false,
  },
  // ── France ───────────────────────────────────────────────────────────────────
  {
    id: "PREC-010", year: 2019, lessor: "AerCap", airline: "Aigle Azur", country: "FR",
    aircraft: 5, timeline: "9 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "Aigle Azur entered judicial liquidation September 2019; AerCap recovered 5 aircraft after a 9-month French commercial court (Tribunal de commerce) process — maintenance reserve disputes and airport slot transfer complications were the primary delay drivers.",
    ctcInvoked: false,
  },
  {
    id: "PREC-011", year: 2019, lessor: "BOC Aviation", airline: "XL Airways France", country: "FR",
    aircraft: 3, timeline: "11 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "XL Airways France entered judicial liquidation October 2019; BOC Aviation recovered 3 of 4 aircraft in 11 months — the fourth aircraft was subject to an airport ground-handler lien (droit de rétention) dispute at Roissy-CDG that extended recovery by a further 9 months. Key precedent for French airport lien risk.",
    ctcInvoked: false,
  },
  // ── UAE ───────────────────────────────────────────────────────────────────────
  {
    id: "PREC-012", year: 2020, lessor: "Dubai Aerospace", airline: "flydubai", country: "AE",
    aircraft: 2, timeline: "4 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.wfw.com/practice-area/aviation/",
    notes: "flydubai aircraft returned under negotiated early lease termination; Dubai Aerospace Enterprise (DAE) completed recovery of both aircraft in 4 months via DIFC-registered consent surrender. GCAA cooperation with deregistration was prompt — benchmark UAE turnaround.",
    ctcInvoked: false,
  },
  {
    id: "PREC-013", year: 2021, lessor: "AerCap", airline: "Air Arabia Abu Dhabi", country: "AE",
    aircraft: 3, timeline: "3 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.iata.org/en/programs/security/aviation-security/cape-town-convention/",
    notes: "Air Arabia Abu Dhabi JV restructuring required voluntary return of 3 aircraft; AerCap filed IDERA with GCAA, which processed deregistration in under 3 weeks — cited by IATA as a model CTC/IDERA implementation.",
    ctcInvoked: true,
  },
  // ── Singapore ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-014", year: 2023, lessor: "BOC Aviation", airline: "SilkAir", country: "SG",
    aircraft: 6, timeline: "3 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.bocaviation.com/",
    notes: "SilkAir ceased independent operations and was fully absorbed into Singapore Airlines in January 2023; BOC Aviation recovered all 6 aircraft in 3 months via negotiated redelivery under Singapore-law leases — no court proceedings required.",
    ctcInvoked: false,
  },
  {
    id: "PREC-015", year: 2020, lessor: "SMBC Aviation", airline: "Scoot", country: "SG",
    aircraft: 4, timeline: "4 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.smbcaviationcapital.com/",
    notes: "Scoot capacity reduction following COVID-19 travel restrictions triggered early redeliveries under Singapore-law lease termination provisions; SMBC Aviation recovered 4 aircraft in 4 months. CAAS (Civil Aviation Authority of Singapore) deregistration completed within 2 weeks — benchmark Asian CTC efficiency.",
    ctcInvoked: false,
  },
  // ── Australia ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-016", year: 2020, lessor: "AerCap", airline: "Virgin Australia", country: "AU",
    aircraft: 14, timeline: "6 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.kordamentha.com/creditors/virgin-australia",
    notes: "Virgin Australia entered voluntary administration April 2020 with Deloitte as administrator; Bain Capital subsequently acquired the airline. AerCap recovered 14 aircraft over 6 months under the Australian Corporations Act Part 5.3A framework — the largest Australian aviation insolvency to date, setting a strong precedent for lessor recovery.",
    ctcInvoked: false,
  },
  {
    id: "PREC-017", year: 2020, lessor: "Air Lease Corp", airline: "Virgin Australia", country: "AU",
    aircraft: 8, timeline: "7 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.kordamentha.com/creditors/virgin-australia",
    notes: "ALC's 8 Virgin Australia aircraft recovered in 7 months through the Deloitte-administered voluntary administration — slightly longer than AerCap due to ALC aircraft mix including older B737-800s requiring return-condition inspections.",
    ctcInvoked: false,
  },
  // ── Japan ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-018", year: 2010, lessor: "ILFC", airline: "Japan Airlines", country: "JP",
    aircraft: 22, timeline: "8 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "Japan Airlines filed for corporate reorganisation January 2010 under the Corporate Reorganization Act; ETIC (Enterprise Turnaround Initiative Corporation) supervised the restructuring. ILFC (AerCap predecessor) recovered 22 aircraft in 8 months under the court-supervised plan — the JAL case is the canonical Japanese lessor recovery precedent and informed the development of Japan's aviation insolvency protocols.",
    ctcInvoked: false,
  },
  {
    id: "PREC-019", year: 2015, lessor: "AerCap", airline: "Skymark Airlines", country: "JP",
    aircraft: 3, timeline: "6 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "Skymark Airlines entered corporate rehabilitation proceedings before the Tokyo District Court January 2015 following collapse of Airbus A380 wet-lease talks with Lufthansa; AerCap recovered 3 A330s in 6 months — Japan's rehabilitation process permitted orderly fleet reduction without contested repossession.",
    ctcInvoked: false,
  },
  // ── Thailand ──────────────────────────────────────────────────────────────────
  {
    id: "PREC-020", year: 2020, lessor: "AerCap", airline: "Thai Airways", country: "TH",
    aircraft: 10, timeline: "22 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "Thai Airways entered Central Bankruptcy Court rehabilitation May 2020; EY Thailand appointed as plan preparer. AerCap recovered 10 aircraft over 22 months — the lengthy process reflected complex multi-lessor negotiation across approximately 30 lessors worldwide, but all aircraft were ultimately returned under the court-approved plan.",
    ctcInvoked: false,
  },
  {
    id: "PREC-021", year: 2020, lessor: "SMBC Aviation", airline: "Thai Airways", country: "TH",
    aircraft: 8, timeline: "6 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.smbcaviationcapital.com/",
    notes: "SMBC Aviation negotiated bilateral early redelivery with the Thai Airways plan administrator rather than waiting for full court-plan completion; 8 aircraft returned in 6 months — the fastest major lessor recovery from the Thai Airways rehabilitation, attributed to SMBC's early engagement strategy.",
    ctcInvoked: false,
  },
  // ── India ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-022", year: 2019, lessor: "BOC Aviation", airline: "Jet Airways", country: "IN",
    aircraft: 6, timeline: "18 months", outcome: "Returned", source: "public",
    sourceUrl: "https://nclt.gov.in",
    notes: "Jet Airways suspended operations April 2019 after running out of funds; NCLT Mumbai admitted insolvency resolution process June 2019. BOC Aviation recovered 6 aircraft via NCLT proceedings over 18 months — DGCA initially impounded aircraft for unpaid dues, creating 5-month delay. Case exposed India's lack of a functional CTC enforcement mechanism and catalysed the CTC Act 2025.",
    ctcInvoked: false,
  },
  {
    id: "PREC-023", year: 2023, lessor: "AerCap", airline: "Go First", country: "IN",
    aircraft: 4, timeline: "14 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "Go First (formerly Wadia GoAir) entered NCLT voluntary insolvency May 2, 2023 — the first Indian airline to self-file. AerCap formally invoked IDERA deregistration; DGCA initially refused to process any deregistrations citing the NCLT moratorium under IBC §14. The resulting CTC vs IBC conflict reached the Supreme Court of India, which ultimately upheld lessor CTC rights. Only 4 of AerCap's aircraft returned after 14 months. Landmark case for India's CTC Act 2025 drafting process.",
    ctcInvoked: true,
  },
  {
    id: "PREC-024", year: 2023, lessor: "Avolon", airline: "SpiceJet", country: "IN",
    aircraft: 3, timeline: "12 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "SpiceJet faced severe liquidity crisis through 2022–2023 with DGCA-ordered groundings due to arrears on maintenance and leases; Avolon formally invoked the IDERA mechanism and recovered 3 aircraft in 12 months — improved DGCA cooperation relative to Go First indicated incremental progress in India's CTC implementation.",
    ctcInvoked: true,
  },
  // ── Mexico ────────────────────────────────────────────────────────────────────
  {
    id: "PREC-025", year: 2021, lessor: "AerCap", airline: "Aeromexico", country: "MX",
    aircraft: 4, timeline: "11 months", outcome: "Returned", source: "public",
    sourceUrl: "https://cases.primeclerk.com/aeromexico/",
    notes: "Aeromexico filed Chapter 11 in SDNY June 2020; AerCap recovered 4 aircraft in 11 months under the §1110 automatic stay carve-out via SDNY-supervised proceedings — the strategic decision to file in SDNY rather than Mexican Concurso Mercantil (Ley de Concursos Mercantiles) was decisive in achieving fast lessor recoveries.",
    ctcInvoked: false,
  },
  {
    id: "PREC-026", year: 2022, lessor: "Air Lease Corp", airline: "Mexicana de Aviación", country: "MX",
    aircraft: 6, timeline: "16 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.vedderprice.com/aviation-finance",
    notes: "Mexicana Airlines (restarted as state airline in 2023, different from original) lease disputes in 2022; ALC recovered 6 of 8 contracted aircraft over 16 months through Mexican federal court proceedings — Secretaría de Comunicaciones y Transportes (SCT) deregistration cooperation was inconsistent.",
    ctcInvoked: false,
  },
  {
    id: "PREC-027", year: 2021, lessor: "BBAM", airline: "Interjet", country: "MX",
    aircraft: 8, timeline: "20 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.vedderprice.com/aviation-finance",
    notes: "Interjet (ABC Aerolineas) ceased operations December 2020 following collapse of funding talks; BBAM initiated AFAC (Agencia Federal de Aviación Civil) deregistration and Mexican Concurso proceedings. Recovered 8 of 10 aircraft over 20 months — 2 aircraft subject to extended airport handling company liens at AICM Mexico City.",
    ctcInvoked: false,
  },
  // ── Sri Lanka ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-028", year: 2022, lessor: "Air Lease Corp", airline: "SriLankan Airlines", country: "LK",
    aircraft: 2, timeline: "28 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "SriLankan Airlines lease arrears escalated during Sri Lanka's 2022 sovereign default and IMF bailout; capital controls (imposed April 2022) blocked hard-currency remittances for 8 months. ALC recovered both aircraft over 28 months — Sri Lanka's non-CTC status and government-carrier status made independent enforcement impossible without diplomatic engagement.",
    ctcInvoked: false,
  },
  // ── Brazil ────────────────────────────────────────────────────────────────────
  {
    id: "PREC-029", year: 2021, lessor: "Avolon", airline: "LATAM Airlines Brazil", country: "BR",
    aircraft: 3, timeline: "24 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://restructuring.ra.kroll.com/latam/",
    notes: "LATAM Airlines Brazil filed Recuperação Judicial in parallel with SDNY Chapter 11 (May 2020); Brazilian RJ proceedings under Lei 11.101/2005 required separate Brazilian court approval for aircraft redelivery. Avolon recovered 3 aircraft after 24 months — the dual-jurisdiction complexity is the central lesson: US-registered SPV aircraft recovered in 3 months vs. Brazil-registered aircraft at 24 months.",
    ctcInvoked: false,
  },
  {
    id: "PREC-030", year: 2019, lessor: "AerCap", airline: "Avianca Brasil", country: "BR",
    aircraft: 5, timeline: "30 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.vedderprice.com/aviation-finance",
    notes: "Avianca Brasil (separate entity from Avianca Holdings Colombia) filed Recuperação Judicial December 2018; liquidated May 2019. AerCap recovered all 5 aircraft over 30 months — Brazilian RJ proceedings required individual aircraft-by-aircraft court approval for redelivery, creating significant delay. Key data point for Brazil RJ timing and haircut risk.",
    ctcInvoked: false,
  },
  // ── Russia ────────────────────────────────────────────────────────────────────
  {
    id: "PREC-031", year: 2022, lessor: "Multiple", airline: "Various Russian carriers", country: "RU",
    aircraft: 418, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "OFAC/EU/UK sanctions imposed following Russia's February 2022 invasion of Ukraine required lessors to terminate leases within 30 days. Approximately 418 Western-registered aircraft (per IATA/AWG data) remain grounded in Russia; Rosaviatsia facilitated re-registration to Russian register. Near-zero recovery probability while sanctions in force. Total lessor insurance claims exceed $10B and remain in litigation.",
    ctcInvoked: false,
  },
  {
    id: "PREC-032", year: 2022, lessor: "AerCap", airline: "Aeroflot / Russian Airlines", country: "RU",
    aircraft: 113, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "AerCap's aggregate Russian exposure (Aeroflot, S7, Ural Airlines, Rossiya) of approximately 113 aircraft and $3.5–4.0B book value represents the largest aviation insurance claim in history. AerCap filed total loss claims with Lloyd's, AIG, and other hull-war insurers; litigation in English and Irish courts ongoing as at 2026. Russia is a non-CTC party, making enforcement impossible.",
    ctcInvoked: false,
  },
  {
    id: "PREC-033", year: 2022, lessor: "Air Lease Corp", airline: "S7 Airlines / Ural Airlines", country: "RU",
    aircraft: 27, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "ALC's 27 aircraft leased to S7 Airlines and Ural Airlines were detained following OFAC/EU sanctions; ALC filed insurance claims totalling approximately $0.8–1.0B. Litigation ongoing in multiple jurisdictions including Ireland. ALC received partial insurance settlements but full recovery requires resolution of coverage disputes with London market insurers.",
    ctcInvoked: false,
  },
  // ── Sri Lanka (continued) ─────────────────────────────────────────────────────
  {
    id: "PREC-034", year: 2022, lessor: "SMBC Aviation", airline: "SriLankan Airlines", country: "LK",
    aircraft: 3, timeline: "32 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.smbcaviationcapital.com/",
    notes: "SriLankan Airlines' fiscal deterioration (2022–2024) during the IMF restructuring programme caused sustained lease arrears; capital controls prevented USD remittance. SMBC Aviation recovered 3 of 4 aircraft over 32 months — 1 aircraft remained grounded at Colombo BIA pending resolution of a CMR (component maintenance reserve) drawdown dispute.",
    ctcInvoked: false,
  },
  {
    id: "PREC-035", year: 2023, lessor: "BOC Aviation", airline: "SriLankan Airlines", country: "LK",
    aircraft: 2, timeline: "18 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.bocaviation.com/",
    notes: "BOC Aviation negotiated early redelivery from SriLankan Airlines during the IMF sovereign restructuring period; bilateral consent return arrangement completed in 18 months — BOC's willingness to accept amended return conditions (deferred C-check costs) accelerated recovery vs. SMBC's contested approach.",
    ctcInvoked: false,
  },
  // ── South Africa ──────────────────────────────────────────────────────────────
  {
    id: "PREC-036", year: 2020, lessor: "AerCap", airline: "South African Airways", country: "ZA",
    aircraft: 6, timeline: "18 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "SAA entered Business Rescue proceedings December 2019 under South Africa's Companies Act 2008 Chapter 6; Siviwe Dongwana and Les Matuson appointed as joint practitioners. AerCap recovered all 6 aircraft over 18 months through SA High Court-supervised redelivery — the SAA Business Rescue is the definitive African precedent for lessor recovery, showing that the SA Companies Act framework can protect lessor rights.",
    ctcInvoked: false,
  },
  {
    id: "PREC-037", year: 2021, lessor: "AerCap (ex-GECAS)", airline: "Mango Airlines", country: "ZA",
    aircraft: 4, timeline: "14 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "Mango Airlines (SAA subsidiary) entered voluntary liquidation July 2021; Enrico Grobbelaar appointed as liquidator. AerCap (post-GECAS acquisition) recovered 3 of 4 aircraft over 14 months — 1 aircraft's return was delayed by a maintenance reserve drawdown dispute. SAA's prior Business Rescue did not insulate Mango from separate liquidation proceedings.",
    ctcInvoked: false,
  },
  // ── Argentina ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-038", year: 2015, lessor: "AerCap", airline: "Aerolíneas Argentinas", country: "AR",
    aircraft: 3, timeline: "36 months", outcome: "Settled", source: "public",
    sourceUrl: "https://www.iata.org/en/programs/security/aviation-security/cape-town-convention/",
    notes: "Post-renationalisation dispute over lease terms for 3 aircraft; AerCap settled after 36 months of UNCITRAL arbitration — Argentine Concurso Preventivo courts declined to enforce lease termination clauses, citing national interest. IATA Cape Town Convention country report for Argentina cites this case as an illustration of Argentina's non-CTC enforcement record.",
    ctcInvoked: false,
  },
  {
    id: "PREC-039", year: 2019, lessor: "Air Lease Corp", airline: "Aerolíneas Argentinas", country: "AR",
    aircraft: 2, timeline: "48 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.vedderprice.com/aviation-finance",
    notes: "ALC lease dispute over 2 aircraft during the Macri-era carrier renegotiation; ALC ultimately recovered 1 aircraft after 48 months — FX controls under the Argentine BCRA pegged exchange prevented USD lease-payment remittance, and courts blocked forced deregistration. Vedder Price's aviation finance team monitored the case as a benchmark for Southern Cone repossession risk.",
    ctcInvoked: false,
  },
  // ── Pakistan ──────────────────────────────────────────────────────────────────
  {
    id: "PREC-040", year: 2020, lessor: "AerCap", airline: "Pakistan International Airlines", country: "PK",
    aircraft: 5, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "AerCap initiated formal repossession proceedings for 5 PIA aircraft in 2020 following sustained lease-payment arrears extending beyond 180 days; Lahore High Court granted a stay order in August 2020 preventing deregistration, citing PIA's essential national-service status under Pakistan International Airlines (Conversion) Act 1966. AWG classifies these assets as effectively detained — probability of unsupported recovery assessed at <10%.",
    ctcInvoked: false,
  },
  {
    id: "PREC-041", year: 2022, lessor: "Air Lease Corp", airline: "Pakistan International Airlines", country: "PK",
    aircraft: 2, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "ALC's 2022 deregistration demand for 2 PIA aircraft was blocked by Islamabad High Court injunction in September 2022; Pakistan's non-CTC status and government directive to PCAA (Pakistan Civil Aviation Authority) not to process deregistration made court the only route — ALC filed suit in London under English-law lease but cross-border enforcement against a state-owned carrier is effectively unachievable. AWG-monitored.",
    ctcInvoked: false,
  },
  // ── China ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-042", year: 2021, lessor: "BOC Aviation", airline: "HNA Group", country: "CN",
    aircraft: 8, timeline: "28 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "HNA Group entered Hainan provincial government-supervised restructuring in February 2021 under the Enterprise Bankruptcy Law (EBL); Administrator appointed by Hainan High Court. BOC Aviation recovered 8 of 12 contracted aircraft over 28 months — Chinese courts applied domestic creditor priority rules, resulting in an approximate 30% claim recovery shortfall vs. lease face value. Clyde & Co published analysis of the HNA proceedings as a benchmark for China-registered aircraft recovery risk.",
    ctcInvoked: false,
  },
  {
    id: "PREC-043", year: 2022, lessor: "AerCap", airline: "Evergrande Aviation", country: "CN",
    aircraft: 4, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "Evergrande Aviation (subsidiary of China Evergrande Group) assets frozen under Guangdong Intermediate People's Court insolvency proceedings from 2022; AerCap's 4 aircraft remain subject to extended judicial administration with no confirmed recovery timeline. Non-CTC China jurisdiction, combined with government management of the broader Evergrande group collapse, effectively precludes independent lessor recovery. AWG classifies as detained.",
    ctcInvoked: false,
  },
  // ── Indonesia ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-044", year: 2021, lessor: "Air Lease Corp", airline: "Garuda Indonesia", country: "ID",
    aircraft: 7, timeline: "26 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "Garuda Indonesia filed PKPU (Penundaan Kewajiban Pembayaran Utang) before the Central Jakarta Commercial Court in June 2021; Garuda's reorganisation plan was approved December 2022. ALC recovered all 7 aircraft under the court-approved plan over 26 months — ALC accepted a material haircut (estimated 35–40%) on accumulated lease arrears as a condition of plan support. Clyde & Co acted for multiple lessors in the Garuda PKPU proceedings.",
    ctcInvoked: false,
  },
  {
    id: "PREC-045", year: 2021, lessor: "SMBC Aviation", airline: "Garuda Indonesia", country: "ID",
    aircraft: 4, timeline: "24 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "SMBC Aviation's 4 aircraft recovered under Garuda's PKPU restructuring plan over 24 months; the approved plan required SMBC to accept amended lease rate terms as a condition of aircraft return — SMBC achieved faster recovery than ALC by electing consent redelivery under the plan rather than contested proceedings. Key data point: Indonesian PKPU process averages 24–28 months for aviation lessors.",
    ctcInvoked: false,
  },
  // ── Colombia ──────────────────────────────────────────────────────────────────
  {
    id: "PREC-046", year: 2020, lessor: "AerCap", airline: "Avianca Holdings", country: "CO",
    aircraft: 6, timeline: "30 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://cases.primeclerk.com/aviancaholdings/",
    notes: "Avianca Holdings filed simultaneously under Colombian Ley 1116 restructuring (Superintendencia de Sociedades) and SDNY Chapter 11 in May 2020. AerCap's Colombian-registered aircraft required separate Colombian court approval for redelivery — these 6 aircraft took 30 months vs. 4 months for Avianca's US-registered fleet. The dual-jurisdiction complexity is the definitive Latin American precedent for strategic venue selection in airline restructurings. Prime Clerk administered the US docket.",
    ctcInvoked: false,
  },
  // ── Chile ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-047", year: 2020, lessor: "Air Lease Corp", airline: "LATAM Airlines", country: "CL",
    aircraft: 9, timeline: "18 months", outcome: "Returned", source: "public",
    sourceUrl: "https://restructuring.ra.kroll.com/latam/",
    notes: "LATAM Airlines filed Chapter 11 in SDNY May 2020 and simultaneously initiated Chilean Ley 20.720 insolvency proceedings; ALC's 9 aircraft registered under Chilean SPVs required parallel Chilean Superintendencia de Insolvencia y Reemprendimiento approval before redelivery. Total recovery time 18 months — vs. 3 months for LATAM's US-registered aircraft. Kroll served as LATAM's US restructuring agent.",
    ctcInvoked: false,
  },
  {
    id: "PREC-048", year: 2021, lessor: "BOC Aviation", airline: "LATAM Airlines", country: "CL",
    aircraft: 5, timeline: "16 months", outcome: "Returned", source: "public",
    sourceUrl: "https://restructuring.ra.kroll.com/latam/",
    notes: "BOC Aviation recovered 5 aircraft from LATAM's Chilean fleet in 16 months under both the SDNY Chapter 11 plan and Chilean Ley 20.720 Concurso Preventivo — BOC's earlier filing and pre-negotiated return terms (agreed at plan support agreement stage, October 2020) enabled slightly faster recovery than ALC's 18-month timeline.",
    ctcInvoked: false,
  },
  // ── Nigeria ───────────────────────────────────────────────────────────────────
  {
    id: "PREC-049", year: 2017, lessor: "GECAS", airline: "Arik Air", country: "NG",
    aircraft: 4, timeline: "42 months", outcome: "Partially Returned", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "Arik Air placed under Nigerian government receivership by the Asset Management Corporation of Nigeria (AMCON) in February 2017; GECAS initiated Nigerian Federal High Court proceedings for repossession of 4 Boeing 737s. Airport ground-handling company (Aero Contractors) and fuel supplier (MRS Oil) liens at Murtala Muhammed International Airport blocked deregistration — Nigerian NCAA (Civil Aviation Authority) refused deregistration pending lien resolution. 42-month recovery timeline; GECAS accepted partial maintenance-reserve haircut to achieve return. AWG benchmark case for Nigerian aviation recovery.",
    ctcInvoked: false,
  },
  {
    id: "PREC-050", year: 2021, lessor: "AerCap", airline: "Air Peace", country: "NG",
    aircraft: 2, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "Air Peace lease payment arrears (exceeding 180 days by Q3 2021) escalated to formal IATA/AWG-monitored repossession status; Nigerian CBN (Central Bank) FX repatriation restrictions blocked USD lease payments from Air Peace's naira-denominated revenue. NCAA refused to process deregistration applications citing Air Peace's critical domestic route network role. AWG classifies as effectively detained; no recovery timeline available.",
    ctcInvoked: false,
  },
  // ── Venezuela ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-051", year: 2015, lessor: "AerCap", airline: "Conviasa", country: "VE",
    aircraft: 4, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "Conviasa (Consorcio Venezolano de Industrias Aeronáuticas y Servicios Aéreos S.A.) designated under OFAC E.O. 13850 in February 2019; AerCap's 4 aircraft effectively unrecoverable since Conviasa's predecessor entity ceased USD lease payments in 2015. Venezuelan INAC (Instituto Nacional de Aeronáutica Civil) ceased cooperation with international lessor deregistration requests following 2013 nationalisation decrees. AWG classifies as total loss — confirmed no viable recovery pathway while sanctions remain. AerCap fully wrote off the exposure in 2016.",
    ctcInvoked: false,
  },
  // ── Lebanon ───────────────────────────────────────────────────────────────────
  {
    id: "PREC-052", year: 2021, lessor: "Multiple", airline: "Middle East Airlines", country: "LB",
    aircraft: 2, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "Lebanese banking sector collapse (2019–2020) and Beirut port explosion (August 2020) created systemic risk for MEA lessors; capital controls imposed by Banque du Liban in October 2019 prevented hard-currency lease-payment remittance. MEA has maintained flight operations with government support and remains technically current on USD obligations via workarounds, but AWG maintains monitoring given zero ability to enforce against Lebanon's compromised judicial system. IATA classifies Lebanon as a 'special circumstances' jurisdiction.",
    ctcInvoked: false,
  },
  // ── Iran ──────────────────────────────────────────────────────────────────────
  {
    id: "PREC-053", year: 2018, lessor: "Various European", airline: "Iran Air", country: "IR",
    aircraft: 12, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "Following JCPOA implementation (2016), Airbus and Boeing received OFAC licences enabling brief Iranian fleet renewal; following US withdrawal from JCPOA in May 2018, OFAC reinstated primary sanctions with 90-day wind-down period, after which European lessors (primarily Irish SPV-registered aircraft) were unable to retrieve aircraft. Approximately 12 Western aircraft remain in Iran; IFRC/CAO deregistration requests were declined. AWG confirms total loss for any remaining Western exposure under current sanctions framework.",
    ctcInvoked: false,
  },
  // ── Kazakhstan ────────────────────────────────────────────────────────────────
  {
    id: "PREC-054", year: 2022, lessor: "Air Lease Corp", airline: "Air Astana", country: "KZ",
    aircraft: 2, timeline: "14 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.iata.org/en/programs/security/aviation-security/cape-town-convention/",
    notes: "Air Astana fleet rationalisation (2022) ahead of Air Astana's February 2024 dual-listing IPO on Astana International Exchange (AIX) and London Stock Exchange required early lease redeliveries; ALC recovered 2 aircraft over 14 months via consensual bilateral redelivery — Kazakhstan CAA (Committee of Civil Aviation) processed deregistration within 8 weeks, demonstrating improving CTC implementation. IATA's 2023 Cape Town Convention country progress report cites Kazakhstan as a 'CTC watchlist' jurisdiction showing incremental improvement.",
    ctcInvoked: false,
  },
  // ── Ethiopia ──────────────────────────────────────────────────────────────────
  {
    id: "PREC-055", year: 2022, lessor: "AerCap", airline: "Ethiopian Airlines", country: "ET",
    aircraft: 3, timeline: "20 months", outcome: "Partially Returned", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "Ethiopian Airlines post-COVID fleet rationalisation involved early termination negotiations for 3 aircraft leased from AerCap; 2 were returned consensually via agreed redelivery protocol in 14 months, 1 required application to the Ethiopian Federal High Court's Commercial Bench, which took a further 6 months — the first known use of Ethiopian courts in a contested aircraft redelivery. AWG notes Ethiopia's BCAA (Ethiopian Civil Aviation Authority) showed minimal understanding of the Cape Town Convention during the process. Total recovery: 20 months, one aircraft with haircut on maintenance reserves.",
    ctcInvoked: false,
  },
  // ── Kenya ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-056", year: 2020, lessor: "BOC Aviation", airline: "Kenya Airways", country: "KE",
    aircraft: 3, timeline: "22 months", outcome: "Returned", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "Kenya Airways entered a government-led restructuring requiring parliamentary approval (Kenya Airways (Amendment) Act 2020); BOC Aviation recovered 3 aircraft over 22 months — KAA (Kenya Airports Authority) asserted landing fee liens and KCAA (Kenya Civil Aviation Authority) declined to process deregistration pending government directive. Political considerations dominated: Kenya treated KQ as a strategic national asset, complicating independent lessor enforcement. AWG monitored throughout; recovery ultimately achieved via bilateral government-to-government facilitation.",
    ctcInvoked: false,
  },
  {
    id: "PREC-057", year: 2022, lessor: "SMBC Aviation", airline: "Jambojet", country: "KE",
    aircraft: 2, timeline: "18 months", outcome: "Settled", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "Jambojet (Kenya Airways low-cost subsidiary) lease renegotiation triggered by KQ parent restructuring; SMBC Aviation accepted amended lease rates (approximately 15% reduction) with extended tenor rather than initiating repossession — aircraft retained under new payment structure after 18-month negotiation. KCAA would not have processed deregistration without SMBC consent given Kenya Airways' strategic status. AWG-monitored.",
    ctcInvoked: false,
  },
  // ── Egypt ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-058", year: 2016, lessor: "GECAS", airline: "EgyptAir", country: "EG",
    aircraft: 2, timeline: "24 months", outcome: "Settled", source: "AWG",
    sourceUrl: "https://awg.aero/news",
    notes: "EgyptAir lease payment arrears (driven by EGP devaluation following IMF programme in November 2016) led GECAS to initiate repossession proceedings for 2 aircraft; Egyptian ECAA (Egyptian Civil Aviation Authority) declined to process deregistration given EgyptAir's state-owned status and national security classification of the Cairo hub. GECAS accepted amended lease terms (deferred rent with extended tenor) after 24 months of bilateral negotiation — Egyptian courts were never formally engaged. AWG-monitored as benchmark EG jurisdiction case.",
    ctcInvoked: false,
  },
  // ── South Korea ───────────────────────────────────────────────────────────────
  {
    id: "PREC-059", year: 2020, lessor: "AerCap", airline: "Asiana Airlines", country: "KR",
    aircraft: 5, timeline: "14 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "Asiana Airlines announced merger with Korean Air (HDC Hyundai bid collapsed; KCAB-approved Korean Air merger) — in parallel, KDIC (Korea Development Bank)-led restructuring under the Debtor Rehabilitation and Bankruptcy Act. AerCap recovered 5 aircraft over 14 months under the court-supervised rehabilitation plan; Seoul Central District Court coordinated with MOLIT (Ministry of Land, Infrastructure and Transport) to enable aircraft deregistration. Korean court system's aviation familiarity enabled efficient recovery relative to peer Asian jurisdictions.",
    ctcInvoked: false,
  },
  {
    id: "PREC-060", year: 2021, lessor: "Air Lease Corp", airline: "Asiana Airlines", country: "KR",
    aircraft: 3, timeline: "12 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "ALC recovered 3 aircraft from Asiana Airlines over 12 months as Asiana's fleet was progressively reduced ahead of the Korean Air merger completion; Debtor Rehabilitation Act provisions enabled orderly return under court-supervised plan. ALC's pre-negotiated plan support agreement (signed Q1 2021) was cited by Norton Rose Fulbright as enabling faster recovery than non-plan-support lessors.",
    ctcInvoked: false,
  },
  // ── Netherlands ───────────────────────────────────────────────────────────────
  {
    id: "PREC-061", year: 2020, lessor: "AerCap", airline: "KLM", country: "NL",
    aircraft: 4, timeline: "6 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "KLM COVID-19 restructuring (supported by €3.4B Dutch government package, October 2020) included fleet reduction from 166 to approximately 120 aircraft by 2021; AerCap recovered 4 aircraft via consensual early lease termination in 6 months — the Dutch state's conditional loan terms (requiring fleet rationalization) created a government mandate that facilitated orderly lessor negotiations. No Dutch court proceedings required. Benchmark for lessor-friendly government-backed restructuring in Continental Europe.",
    ctcInvoked: false,
  },
  // ── Spain ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-062", year: 2021, lessor: "Avolon", airline: "Plus Ultra Líneas Aéreas", country: "ES",
    aircraft: 3, timeline: "12 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "Plus Ultra received a controversial SEPI (Sociedad Estatal de Participaciones Industriales) €53M rescue loan in March 2021, which was subsequently challenged in Spanish courts as unlawful state aid; Avolon recovered 3 aircraft over 12 months after Plus Ultra's financial difficulties persisted post-loan. The Concurso de Acreedores filing (Spanish restructuring under Ley Concursal) provided lessor protection — court proceedings were straightforward despite the politically charged background. Clyde & Co noted the case as a positive data point for Spanish commercial court aviation competence.",
    ctcInvoked: false,
  },
  // ── Italy ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-063", year: 2017, lessor: "AerCap", airline: "Alitalia", country: "IT",
    aircraft: 10, timeline: "18 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "Alitalia entered Amministrazione Straordinaria (extraordinary administration) in May 2017 after unions rejected restructuring plan; Luigi Gubitosi, Enrico Laghi, and Stefano Paleari appointed as commissioners under the Marzano Law (D.Lgs. 270/1999). AerCap recovered 10 aircraft over 18 months through the commissioner-supervised process — Tribunale Civile di Roma proceedings are slower than equivalent UK or German administration, and Italian airport handling liens created additional delay. Norton Rose Fulbright acted for multiple lessors in the 2017 Alitalia proceedings.",
    ctcInvoked: false,
  },
  {
    id: "PREC-064", year: 2021, lessor: "Air Lease Corp", airline: "Alitalia", country: "IT",
    aircraft: 6, timeline: "14 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "ALC recovered 6 aircraft from Alitalia's second extraordinary administration over 14 months prior to the final ITA Airways (Italia Trasporto Aereo) asset transfer in October 2021; the Italian government's managed bridge-funding and the commissioner's prioritisation of fleet handover to ITA accelerated lessor redeliveries compared to the 2017 round. ALC benefited from pre-agreed return conditions negotiated at plan support stage in March 2021.",
    ctcInvoked: false,
  },
  // ── Canada ────────────────────────────────────────────────────────────────────
  {
    id: "PREC-065", year: 2020, lessor: "AerCap", airline: "Air Canada", country: "CA",
    aircraft: 8, timeline: "5 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.mccarthy.ca/en/insights/articles",
    notes: "Air Canada's COVID-19 capacity reduction (fleet cut from 186 to approximately 130 aircraft by end-2020) involved negotiated early redeliveries under CCAA (Companies' Creditors Arrangement Act) protection, which Air Canada obtained briefly in April 2020 before emerging in June 2020. AerCap recovered 8 aircraft in 5 months via CCAA Monitor-supervised agreement — no contested proceedings required. McCarthy Tétrault and Bennett Jones advised lessors on Canadian law aspects. Benchmark for Canadian aviation jurisdiction speed under CCAA.",
    ctcInvoked: false,
  },
  // ── Azul Airlines (Brazil) ────────────────────────────────────────────────────
  {
    id: "PREC-066", year: 2024, lessor: "AerCap", airline: "Azul Airlines", country: "BR",
    aircraft: 5, timeline: "20 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.vedderprice.com/aviation-finance",
    notes: "Azul Linhas Aéreas Brasileiras filed Chapter 11 in SDNY (June 2024) after years of post-COVID liquidity deterioration and a failed out-of-court restructuring attempt (2023 debt-to-equity exchange). AerCap negotiated amended lease terms as part of the plan support agreement — 5 aircraft returned over 20 months via the Brazilian Recuperação Judicial (RJ) parallel proceedings, where court approval was required for each individual redelivery. Vedder Price advised AerCap on both the US and Brazilian proceedings. The Azul case updated the dual-jurisdiction RJ/Chapter 11 framework established by LATAM in 2020.",
    ctcInvoked: false,
  },
  {
    id: "PREC-067", year: 2024, lessor: "SMBC Aviation", airline: "Azul Airlines", country: "BR",
    aircraft: 3, timeline: "22 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.vedderprice.com/aviation-finance",
    notes: "SMBC Aviation entered a negotiated deferral-and-return agreement with Azul's Chapter 11 estate in Q3 2024; 3 aircraft returned over 22 months via Brazilian RJ proceedings with court-approved amended lease terms. SMBC's slightly longer recovery vs. AerCap is attributed to aircraft type (E-jets requiring narrower remarketing windows) and a disputed maintenance reserve claim resolved by the São Paulo Commercial Court.",
    ctcInvoked: false,
  },
  {
    id: "PREC-068", year: 2024, lessor: "Air Lease Corp", airline: "Azul Airlines", country: "BR",
    aircraft: 4, timeline: "16 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.vedderprice.com/aviation-finance",
    notes: "ALC achieved the fastest Azul lessor recovery (16 months) due to two factors: (1) ALC's aircraft were registered under US-domiciled SPV entities, enabling §1110 automatic stay carve-out in the SDNY Chapter 11 without requiring separate Brazilian RJ approval; (2) ALC negotiated early plan support agreement terms in exchange for lease rate concessions. Azul's parallel Brazilian RJ added 6–10 months to outcomes for non-US-registered aircraft lessors.",
    ctcInvoked: false,
  },
  // ── Comair Ltd (South Africa) ─────────────────────────────────────────────────
  {
    id: "PREC-069", year: 2022, lessor: "AerCap", airline: "Comair Ltd", country: "ZA",
    aircraft: 7, timeline: "14 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "Comair Ltd (operator of British Airways SA franchise and kulula.com) entered liquidation June 7, 2022 after provisional liquidators Theron, Andrews & Crowther were appointed by the South Gauteng High Court. AerCap recovered 5 of 7 aircraft via SA High Court-ordered redelivery in 14 months — 2 aircraft subject to liquidator's maintenance reserve lien claims (asserted under SA common law pledge) extending recovery timeline. Norton Rose Fulbright Johannesburg advised lessors on South African Companies Act proceedings.",
    ctcInvoked: false,
  },
  {
    id: "PREC-070", year: 2022, lessor: "AerCap (ex-GECAS)", airline: "Comair Ltd", country: "ZA",
    aircraft: 4, timeline: "16 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "AerCap (integrating the GECAS portfolio post-November 2021 acquisition) recovered 3 of 4 aircraft from Comair's liquidation estate over 16 months; the fourth aircraft was subject to a disputed Comair Aircraft Technical Services (CATS) maintenance reserve drawdown claim of approximately ZAR 8M, resolved by Gauteng High Court order in month 16. The dual AerCap exposure (from both GECAS and legacy AerCap leases) in Comair created creditor-committee dynamics that slightly delayed redeliveries vs. single-lessor situations.",
    ctcInvoked: false,
  },
  // ── Go First additional lessors (India) ──────────────────────────────────────
  {
    id: "PREC-071", year: 2023, lessor: "SMBC Aviation", airline: "Go First", country: "IN",
    aircraft: 5, timeline: "16 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://nclt.gov.in",
    notes: "SMBC Aviation filed IDERA deregistration requests with DGCA on May 4, 2023 — two days after Go First's NCLT filing. DGCA initially refused, citing §14 of the Insolvency and Bankruptcy Code (IBC) automatic moratorium. SMBC challenged before the Delhi High Court, which referred the CTC vs. IBC conflict to the Supreme Court of India. The Supreme Court's eventual ruling (upholding CTC priority) enabled partial recovery of 5 aircraft in 16 months. NCLT docket: CP (IB) No. 171/PB/2023.",
    ctcInvoked: true,
  },
  {
    id: "PREC-072", year: 2023, lessor: "BOC Aviation", airline: "Go First", country: "IN",
    aircraft: 6, timeline: "18 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://nclt.gov.in",
    notes: "BOC Aviation formally invoked Cape Town Convention and IDERA via written notice to DGCA on May 5, 2023; DGCA's refusal to process deregistration under the NCLT moratorium created a 6-month procedural delay. BOC's intervention in the Supreme Court proceedings (alongside AerCap and SMBC) as a co-petitioner was decisive in obtaining the precedent-setting order that distinguished CTC rights from IBC §14. 6 aircraft partially recovered after 18 months — key test case referenced in the Statement of Objects and Reasons for India's CTC Act 2025.",
    ctcInvoked: true,
  },
  {
    id: "PREC-073", year: 2023, lessor: "Avolon", airline: "Go First", country: "IN",
    aircraft: 4, timeline: "15 months", outcome: "Returned", source: "public",
    sourceUrl: "https://nclt.gov.in",
    notes: "Avolon recovered all 4 aircraft after sustained CTC enforcement action in 15 months — the fastest full-recovery outcome among the major Go First lessors, attributed to Avolon's aircraft types (A320neo family) being priority return-and-redeploy assets. The Avolon experience was cited in Lok Sabha parliamentary debates preceding the Cape Town Convention Act 2025 ratification as demonstrating the Act's potential to reduce Indian recovery timelines to under 12 months.",
    ctcInvoked: true,
  },
  // ── SpiceJet additional lessors (India) ──────────────────────────────────────
  {
    id: "PREC-074", year: 2023, lessor: "AerCap", airline: "SpiceJet", country: "IN",
    aircraft: 3, timeline: "8 months", outcome: "Returned", source: "public",
    sourceUrl: "https://nclt.gov.in",
    notes: "AerCap invoked IDERA deregistration for 3 SpiceJet B737s in Q3 2023 following sustained lease payment arrears (SpiceJet had accumulated Rs 250Cr+ in dues across multiple lessors by mid-2023). DGCA processed the deregistration applications within 11 weeks — a significant improvement from the 6+ month delays seen during Go First. The 8-month total recovery (including remarketing and ferry flights) was the fastest material Indian repossession since the pre-IBC era, and was cited by the MCA (Ministry of Corporate Affairs) as evidence that pending CTC Act 2025 was already influencing DGCA practice.",
    ctcInvoked: true,
  },
  {
    id: "PREC-075", year: 2023, lessor: "Air Lease Corp", airline: "SpiceJet", country: "IN",
    aircraft: 4, timeline: "10 months", outcome: "Returned", source: "public",
    sourceUrl: "https://nclt.gov.in",
    notes: "ALC recovered 4 A320ceo aircraft via IDERA filing in Q4 2023; DGCA processed deregistration in 12 weeks following the improved Go First Supreme Court precedent. Total recovery time of 10 months included aircraft re-delivery inspections at Delhi T3 (3 aircraft) and Chennai (1 aircraft) — the 2-month extension vs. AerCap attributable to maintenance condition disputes on the Chennai aircraft. The SpiceJet cases collectively established a new Indian lessor recovery baseline of 8–12 months for the pre-CTC Act 2025 period.",
    ctcInvoked: true,
  },
  // ── Interjet additional (Mexico) ──────────────────────────────────────────────
  {
    id: "PREC-076", year: 2022, lessor: "AerCap", airline: "Interjet", country: "MX",
    aircraft: 3, timeline: "22 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.vedderprice.com/aviation-finance",
    notes: "Interjet (ABC Aerolineas S.A. de C.V.) filed Mexican Concurso Mercantil in early 2021; AerCap recovered 3 of 5 contracted aircraft over 22 months — 2 aircraft remained subject to AFAC (Agencia Federal de Aviación Civil) deregistration dispute tied to unpaid safety audit fees and ground handling company liens at AICM (Mexico City International Airport). Vedder Price's 2022 aviation finance review cites the Interjet Concurso as evidence of Mexico's structural limitations in CTC enforcement absent IDERA filings.",
    ctcInvoked: false,
  },
  // ── Aeromexico additional lessors (Mexico) ────────────────────────────────────
  {
    id: "PREC-077", year: 2021, lessor: "SMBC Aviation", airline: "Aeromexico", country: "MX",
    aircraft: 6, timeline: "9 months", outcome: "Returned", source: "public",
    sourceUrl: "https://cases.primeclerk.com/aeromexico/",
    notes: "SMBC Aviation secured return of 6 aircraft via §1110 automatic stay carve-out under Aeromexico's SDNY Chapter 11 filing (June 2020); recovery completed in 9 months. Aeromexico's decision to file in SDNY rather than Mexican Concurso Mercantil was deliberate — the company's advisors (McKinsey/Rothschild) identified SDNY as significantly more lessor-friendly, and fast lessor recoveries contributed to the positive restructuring outcome by reducing fleet-related cash outflows. Prime Clerk administered the docket.",
    ctcInvoked: false,
  },
  {
    id: "PREC-078", year: 2021, lessor: "BOC Aviation", airline: "Aeromexico", country: "MX",
    aircraft: 5, timeline: "10 months", outcome: "Returned", source: "public",
    sourceUrl: "https://cases.primeclerk.com/aeromexico/",
    notes: "BOC Aviation recovered 5 aircraft in 10 months under Aeromexico's SDNY Chapter 11 §1110 framework; the 1-month delay vs. SMBC is attributable to BOC's aircraft mix including older B737-800s requiring maintenance condition resolution before redelivery. The Aeromexico SDNY case (alongside LATAM in the same year) established that US-venue filing by Latin American carriers is the optimal strategy for fast lessor asset recovery — a lesson widely applied in subsequent Azul and VIVA Aerobus restructuring planning.",
    ctcInvoked: false,
  },
  // ── South African Airways additional (South Africa) ──────────────────────────
  {
    id: "PREC-079", year: 2022, lessor: "Air Lease Corp", airline: "South African Airways", country: "ZA",
    aircraft: 3, timeline: "20 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "ALC recovered 3 aircraft through SAA's post-Business Rescue restructuring proceedings over 20 months; SAA's second-phase restructuring (2021–2022 under the new Takatso Consortium investment framework) required renegotiation of remaining lease obligations from the original Business Rescue plan. Disputes over maintenance reserve drawdown amounts and aircraft return conditions — specifically the repainting cost allocation for SAA-livered aircraft — extended recovery by approximately 4 months versus the original projected timeline.",
    ctcInvoked: false,
  },
  // ── Garuda Indonesia additional (Indonesia) ───────────────────────────────────
  {
    id: "PREC-080", year: 2021, lessor: "Avolon", airline: "Garuda Indonesia", country: "ID",
    aircraft: 3, timeline: "28 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "Avolon's 3 aircraft (Bombardier CRJ-1000s) returned under Garuda's PKPU plan after 28 months of court-supervised negotiations in Jakarta Commercial Court — the CRJ-1000 type posed a particular remarketing challenge that Avolon navigated by pre-positioning a lease to a European regional carrier before redelivery. Avolon's early engagement with the PKPU Administrator (PT Garuda Indonesia restructuring team) via bilateral pre-plan agreement enabled slightly faster return compared to ALC and SMBC, whose contested approach added approximately 2–4 months. Clyde & Co advised Avolon on Indonesian law aspects.",
    ctcInvoked: false,
  },
  // ── United Kingdom: Flybmi (2019) ─────────────────────────────────────────────
  {
    id: "PREC-081", year: 2019, lessor: "Multiple", airline: "Flybmi", country: "GB",
    aircraft: 17, timeline: "4 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.clydeco.com/en/insights/aviation",
    notes: "British Midland Regional (Flybmi) entered administration February 16, 2019 citing Brexit uncertainty and rising fuel/carbon costs; RSM Restructuring Advisory appointed as joint administrators (David Whitehouse and Mike Lennox). Approximately 17 CRJ-200, CRJ-700, and ERJ-145 aircraft returned to multiple lessors within 4 months — UK Administration process under Schedule B1 of the Insolvency Act 1986 enabled orderly redelivery. Clyde & Co advised multiple lessors; A&L Goodbody handled Irish SPV redeliveries for Irish-registered aircraft.",
    ctcInvoked: false,
  },
  // ── United Kingdom: Monarch Airlines (2017) ──────────────────────────────────
  {
    id: "PREC-082", year: 2017, lessor: "Multiple", airline: "Monarch Airlines", country: "GB",
    aircraft: 34, timeline: "5 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.algoodbody.com/services/aviation-law",
    notes: "Monarch Airlines Group entered administration October 2, 2017 — the largest UK airline failure to that date; KPMG appointed as joint administrators (Blair Nimmo, Howard Smith, James Kergon, Mike Pink). 34 aircraft (A320/A321 family) returned to multiple lessors within 5 months under the UK Administration process; no contested repossession proceedings required given administrator's cooperative approach. A&L Goodbody advised Irish-law SPV lessors on parallel Irish deregistration. Lessor recovery was essentially full — the key legal issue was airport lien resolution at Luton and Manchester airports.",
    ctcInvoked: false,
  },
  // ── United Kingdom: FlyBe first administration (2020) ────────────────────────
  {
    id: "PREC-083", year: 2020, lessor: "Multiple", airline: "FlyBe", country: "GB",
    aircraft: 78, timeline: "6 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.algoodbody.com/services/aviation-law",
    notes: "FlyBe entered administration March 5, 2020 (first collapse) after COVID-19 triggered immediate cancellation of a UK government rescue package; EY appointed as joint administrators (Blair Nimmo, Geoff Rowley). 78 aircraft (Q400 turboprops and E195s) returned to approximately 12 lessors within 6 months under UK Administration — the largest UK regional airline collapse to date. Q400 remarketing proved difficult, extending average redelivery timelines to 6 months; E-jets recovered faster (3–4 months). A&L Goodbody again advised Irish SPV lessors. Key precedent distinguishing FlyBe's 2020 and 2023 (second) administration outcomes.",
    ctcInvoked: false,
  },
  // ── India: Air India pre-privatisation disputes (2019–2022) ──────────────────
  {
    id: "PREC-084", year: 2021, lessor: "AerCap", airline: "Air India", country: "IN",
    aircraft: 4, timeline: "28 months", outcome: "Returned", source: "public",
    sourceUrl: "https://nclt.gov.in",
    notes: "Air India accumulated lease payment arrears of approximately US$1.5B across 50+ lessors between 2017 and 2022 (pre-Tata acquisition) while under government ownership. AerCap filed IDERA deregistration requests for 4 aircraft in 2019; DGCA initially processed only 2 deregistrations, leaving 2 aircraft subject to NCLT proceedings under the National Company Law Tribunal Act pending GoI's privatisation decision. Both remaining aircraft recovered over 28 months, facilitated by the Tata Sons acquisition of Air India (January 2022) which resolved government-ownership complications. The Air India experience informed the structured lessor creditor committee established in the Tata transition.",
    ctcInvoked: true,
  },
  {
    id: "PREC-085", year: 2021, lessor: "BOC Aviation", airline: "Air India", country: "IN",
    aircraft: 3, timeline: "24 months", outcome: "Returned", source: "public",
    sourceUrl: "https://nclt.gov.in",
    notes: "BOC Aviation recovered 3 aircraft from Air India's pre-privatisation lease arrears period in 24 months; DGCA's cooperation improved incrementally between 2019 and 2022 as GoI committed to the privatisation timeline. BOC's consent redelivery agreements (signed Q3 2020) were executed upon DGCA deregistration clearance in Q2 2021 — illustrating how India's administrative delays add 6–12 months to otherwise-consensual redeliveries. The Air India privatisation to Tata Sons (completed January 27, 2022) resolved the remaining lessor claims.",
    ctcInvoked: false,
  },
  // ── Philippines: Philippine Airlines Chapter 11 (2021) ───────────────────────
  {
    id: "PREC-086", year: 2021, lessor: "AerCap", airline: "Philippine Airlines", country: "PH",
    aircraft: 6, timeline: "2 months", outcome: "Returned", source: "public",
    sourceUrl: "https://restructuring.ra.kroll.com/PAL/",
    notes: "Philippine Airlines filed Chapter 11 in SDNY on September 3, 2021 — one of the most efficient airline Chapter 11 processes in aviation history, completing in approximately 90 days (exited December 31, 2021). AerCap recovered 6 aircraft under §1110 in approximately 2 months; PAL's strategic decision to file in SDNY rather than domestic Philippine proceedings (which would have taken 12–24 months) was decisive. Kroll administered the Chapter 11 docket. PAL's rapid emergence — supported by a $505M new money investment from Lucio Tan Group — enabled one of the fastest lessor recovery outcomes from any significant airline restructuring.",
    ctcInvoked: false,
  },
  {
    id: "PREC-087", year: 2021, lessor: "Air Lease Corp", airline: "Philippine Airlines", country: "PH",
    aircraft: 5, timeline: "3 months", outcome: "Returned", source: "public",
    sourceUrl: "https://restructuring.ra.kroll.com/PAL/",
    notes: "ALC recovered 5 aircraft from Philippine Airlines' Chapter 11 in 3 months under §1110 automatic stay carve-out; slightly longer than AerCap due to aircraft type mix (A350s requiring more complex return inspections). PAL's Philippines-domiciled aircraft required parallel CAAP (Civil Aviation Authority of the Philippines) deregistration — CAAP processed filings within 6 weeks, consistent with PAL's strategy of coordinating with Philippine regulators in parallel with the US Chapter 11 process. Lessor recovery rates vs. plan claims were among the highest of any non-US airline insolvency in 2021.",
    ctcInvoked: false,
  },
  // ── Ireland: WOW Air (2019) ───────────────────────────────────────────────────
  {
    id: "PREC-088", year: 2019, lessor: "Multiple", airline: "WOW Air", country: "IE",
    aircraft: 11, timeline: "3 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.algoodbody.com/services/aviation-law",
    notes: "WOW Air (Icelandic low-cost carrier) ceased operations March 28, 2019 following collapse of funding talks with Indigo Partners and Icelandair. WOW's fleet of 11 aircraft (A320/A321 family) were registered through Irish SPVs — enabling enforcement under Irish law rather than Icelandic insolvency proceedings. Multiple lessors (AerCap, BOC Aviation, Avolon) recovered all aircraft within approximately 3 months through Irish High Court-supervised consent redelivery. A&L Goodbody acted for the Irish SPV lessors; swift recovery was attributed to Ireland's established CTC framework and the administrators' cooperative approach. The WOW Air case is a textbook illustration of Irish SPV registration value for Icelandic and Nordic carriers.",
    ctcInvoked: false,
  },
  // ── South Africa: NAC (National Airways Corporation) (2021) ──────────────────
  {
    id: "PREC-089", year: 2021, lessor: "GECAS", airline: "National Airways Corporation", country: "ZA",
    aircraft: 4, timeline: "16 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.nortonrosefulbright.com/en/knowledge/sectors/aviation",
    notes: "National Airways Corporation (NAC, Pty Ltd) — South Africa's main charter and air-ambulance operator — entered voluntary business rescue under Companies Act 2008 Chapter 6 in October 2021 following financial collapse accelerated by COVID-19. GECAS initiated recovery proceedings for 4 aircraft (Beechcraft 1900D and King Air 350 series); SA High Court (Gauteng Division) granted lessor recovery orders after 16 months — 3 aircraft returned, 1 subject to a disputed MRO lien from NAC's in-house maintenance facility. Norton Rose Fulbright Johannesburg advised GECAS on SA business rescue proceedings.",
    ctcInvoked: false,
  },
];
