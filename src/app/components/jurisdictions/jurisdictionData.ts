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
  source: string;
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
];

export const precedents: Precedent[] = [
  // US
  { id: "PREC-001", year: 2020, lessor: "AerCap", airline: "LATAM Airlines", country: "US", aircraft: 12, timeline: "3 months", outcome: "Returned", source: "public" },
  { id: "PREC-002", year: 2020, lessor: "Air Lease Corp", airline: "Avianca Holdings", country: "US", aircraft: 8, timeline: "4 months", outcome: "Returned", source: "public" },
  { id: "PREC-003", year: 2020, lessor: "BBAM", airline: "Virgin America", country: "US", aircraft: 5, timeline: "2 months", outcome: "Returned", source: "public" },
  { id: "PREC-004", year: 2023, lessor: "SMBC Aviation", airline: "Regional Express", country: "US", aircraft: 3, timeline: "3 months", outcome: "Returned", source: "public" },
  // Ireland
  { id: "PREC-005", year: 2021, lessor: "Avolon", airline: "Flybe", country: "IE", aircraft: 6, timeline: "5 months", outcome: "Returned", source: "public" },
  { id: "PREC-006", year: 2019, lessor: "AerCap", airline: "Thomas Cook", country: "IE", aircraft: 11, timeline: "4 months", outcome: "Returned", source: "public" },
  { id: "PREC-007", year: 2022, lessor: "Air Lease Corp", airline: "Norse Atlantic", country: "IE", aircraft: 4, timeline: "6 months", outcome: "Settled", source: "public" },
  // Germany
  { id: "PREC-008", year: 2017, lessor: "GECAS", airline: "Air Berlin", country: "DE", aircraft: 18, timeline: "7 months", outcome: "Returned", source: "public" },
  { id: "PREC-009", year: 2020, lessor: "Lufthansa Technik", airline: "Condor", country: "DE", aircraft: 4, timeline: "5 months", outcome: "Returned", source: "public" },
  // France
  { id: "PREC-010", year: 2021, lessor: "AerCap", airline: "Aigle Azur", country: "FR", aircraft: 5, timeline: "9 months", outcome: "Returned", source: "public" },
  { id: "PREC-011", year: 2022, lessor: "BOC Aviation", airline: "XL Airways", country: "FR", aircraft: 3, timeline: "11 months", outcome: "Partially Returned", source: "public" },
  // UAE
  { id: "PREC-012", year: 2020, lessor: "Dubai Aerospace", airline: "flydubai", country: "AE", aircraft: 2, timeline: "4 months", outcome: "Returned", source: "public" },
  { id: "PREC-013", year: 2021, lessor: "AerCap", airline: "Air Arabia Abu Dhabi", country: "AE", aircraft: 3, timeline: "3 months", outcome: "Returned", source: "public" },
  // Singapore
  { id: "PREC-014", year: 2020, lessor: "BOC Aviation", airline: "SilkAir", country: "SG", aircraft: 6, timeline: "3 months", outcome: "Returned", source: "public" },
  { id: "PREC-015", year: 2021, lessor: "SMBC Aviation", airline: "Scoot", country: "SG", aircraft: 4, timeline: "4 months", outcome: "Returned", source: "public" },
  // Australia
  { id: "PREC-016", year: 2020, lessor: "AerCap", airline: "Virgin Australia", country: "AU", aircraft: 14, timeline: "6 months", outcome: "Returned", source: "public" },
  { id: "PREC-017", year: 2020, lessor: "Air Lease Corp", airline: "Virgin Australia", country: "AU", aircraft: 8, timeline: "7 months", outcome: "Returned", source: "public" },
  // Japan
  { id: "PREC-018", year: 2010, lessor: "ILFC", airline: "Japan Airlines", country: "JP", aircraft: 22, timeline: "8 months", outcome: "Returned", source: "public" },
  { id: "PREC-019", year: 2021, lessor: "AerCap", airline: "Skymark Airlines", country: "JP", aircraft: 3, timeline: "6 months", outcome: "Returned", source: "public" },
  // Thailand
  { id: "PREC-020", year: 2020, lessor: "AerCap", airline: "Thai Airways", country: "TH", aircraft: 10, timeline: "22 months", outcome: "Returned", source: "public" },
  { id: "PREC-021", year: 2020, lessor: "SMBC Aviation", airline: "Thai Airways", country: "TH", aircraft: 8, timeline: "6 months", outcome: "Returned", source: "public" },
  // India
  { id: "PREC-022", year: 2019, lessor: "BOC Aviation", airline: "Jet Airways", country: "IN", aircraft: 6, timeline: "18 months", outcome: "Returned", source: "public" },
  { id: "PREC-023", year: 2022, lessor: "AerCap", airline: "Go First", country: "IN", aircraft: 4, timeline: "14 months", outcome: "Partially Returned", source: "public" },
  { id: "PREC-024", year: 2023, lessor: "Avolon", airline: "SpiceJet", country: "IN", aircraft: 3, timeline: "12 months", outcome: "Returned", source: "public" },
  // Mexico
  { id: "PREC-025", year: 2023, lessor: "AerCap", airline: "Aeromexico", country: "MX", aircraft: 4, timeline: "11 months", outcome: "Returned", source: "public" },
  { id: "PREC-026", year: 2022, lessor: "Air Lease Corp", airline: "Mexicana", country: "MX", aircraft: 6, timeline: "16 months", outcome: "Partially Returned", source: "public" },
  { id: "PREC-027", year: 2021, lessor: "BBAM", airline: "Interjet", country: "MX", aircraft: 8, timeline: "20 months", outcome: "Partially Returned", source: "public" },
  // Brazil
  { id: "PREC-028", year: 2022, lessor: "Air Lease Corp", airline: "SriLankan Airlines", country: "LK", aircraft: 2, timeline: "28 months", outcome: "Partially Returned", source: "public" },
  { id: "PREC-029", year: 2021, lessor: "Avolon", airline: "LATAM Airlines", country: "BR", aircraft: 3, timeline: "24 months", outcome: "Returned via RJ", source: "public" },
  { id: "PREC-030", year: 2020, lessor: "AerCap", airline: "Avianca Brazil", country: "BR", aircraft: 5, timeline: "30 months", outcome: "Returned via RJ", source: "public" },
  // Russia
  { id: "PREC-031", year: 2022, lessor: "Multiple", airline: "Various Russian", country: "RU", aircraft: 420, timeline: "Ongoing", outcome: "Detained", source: "AWG" },
  { id: "PREC-032", year: 2022, lessor: "AerCap", airline: "Aeroflot", country: "RU", aircraft: 152, timeline: "Ongoing", outcome: "Detained", source: "AWG" },
  { id: "PREC-033", year: 2022, lessor: "Air Lease Corp", airline: "S7 Airlines", country: "RU", aircraft: 21, timeline: "Ongoing", outcome: "Detained", source: "AWG" },
  // Sri Lanka
  { id: "PREC-034", year: 2022, lessor: "SMBC Aviation", airline: "SriLankan Airlines", country: "LK", aircraft: 3, timeline: "32 months", outcome: "Partially Returned", source: "public" },
  { id: "PREC-035", year: 2023, lessor: "BOC Aviation", airline: "SriLankan Airlines", country: "LK", aircraft: 2, timeline: "18 months", outcome: "Returned", source: "public" },
  // South Africa
  { id: "PREC-036", year: 2020, lessor: "AerCap", airline: "South African Airways", country: "ZA", aircraft: 6, timeline: "18 months", outcome: "Returned", source: "public" },
  { id: "PREC-037", year: 2021, lessor: "GECAS", airline: "Mango Airlines", country: "ZA", aircraft: 4, timeline: "14 months", outcome: "Partially Returned", source: "public" },
  // Argentina
  { id: "PREC-038", year: 2015, lessor: "AerCap", airline: "Aerolíneas Argentinas", country: "AR", aircraft: 3, timeline: "36 months", outcome: "Settled", source: "public" },
  { id: "PREC-039", year: 2019, lessor: "Air Lease Corp", airline: "LADE", country: "AR", aircraft: 2, timeline: "48 months", outcome: "Partially Returned", source: "public" },
  // Pakistan
  { id: "PREC-040", year: 2020, lessor: "AerCap", airline: "Pakistan International Airlines", country: "PK", aircraft: 5, timeline: "Ongoing", outcome: "Detained", source: "AWG" },
  { id: "PREC-041", year: 2022, lessor: "Air Lease Corp", airline: "Pakistan International Airlines", country: "PK", aircraft: 2, timeline: "Ongoing", outcome: "Detained", source: "AWG" },
  // China
  { id: "PREC-042", year: 2021, lessor: "BOC Aviation", airline: "HNA Group", country: "CN", aircraft: 8, timeline: "28 months", outcome: "Partially Returned", source: "public" },
  { id: "PREC-043", year: 2022, lessor: "AerCap", airline: "Evergrande Aviation", country: "CN", aircraft: 4, timeline: "Ongoing", outcome: "Detained", source: "AWG" },
  // Indonesia
  { id: "PREC-044", year: 2021, lessor: "Air Lease Corp", airline: "Garuda Indonesia", country: "ID", aircraft: 7, timeline: "26 months", outcome: "Returned via RJ", source: "public" },
  { id: "PREC-045", year: 2021, lessor: "SMBC Aviation", airline: "Garuda Indonesia", country: "ID", aircraft: 4, timeline: "24 months", outcome: "Returned via RJ", source: "public" },
  // Colombia
  { id: "PREC-046", year: 2020, lessor: "AerCap", airline: "Avianca Holdings", country: "CO", aircraft: 6, timeline: "30 months", outcome: "Returned via RJ", source: "public" },
  // Chile
  { id: "PREC-047", year: 2020, lessor: "Air Lease Corp", airline: "LATAM Airlines", country: "CL", aircraft: 9, timeline: "18 months", outcome: "Returned", source: "public" },
  { id: "PREC-048", year: 2021, lessor: "BOC Aviation", airline: "LATAM Airlines", country: "CL", aircraft: 5, timeline: "16 months", outcome: "Returned", source: "public" },
  // Nigeria
  { id: "PREC-049", year: 2017, lessor: "GECAS", airline: "Arik Air", country: "NG", aircraft: 4, timeline: "42 months", outcome: "Partially Returned", source: "public" },
  { id: "PREC-050", year: 2021, lessor: "AerCap", airline: "Air Peace", country: "NG", aircraft: 2, timeline: "Ongoing", outcome: "Detained", source: "AWG" },
  // Venezuela
  { id: "PREC-051", year: 2015, lessor: "AerCap", airline: "Conviasa", country: "VE", aircraft: 4, timeline: "Ongoing", outcome: "Detained", source: "AWG" },
  // Lebanon
  { id: "PREC-052", year: 2021, lessor: "Multiple", airline: "Middle East Airlines", country: "LB", aircraft: 2, timeline: "Ongoing", outcome: "Detained", source: "AWG" },
  // Iran
  { id: "PREC-053", year: 2018, lessor: "Various European", airline: "Iran Air", country: "IR", aircraft: 12, timeline: "Ongoing", outcome: "Detained", source: "AWG" },
  // Kazakhstan
  { id: "PREC-054", year: 2022, lessor: "Air Lease Corp", airline: "Air Astana", country: "KZ", aircraft: 2, timeline: "14 months", outcome: "Returned", source: "public" },
  // Ethiopia
  { id: "PREC-055", year: 2022, lessor: "AerCap", airline: "Ethiopian Airlines", country: "ET", aircraft: 3, timeline: "20 months", outcome: "Partially Returned", source: "public" },
  // Kenya
  { id: "PREC-056", year: 2020, lessor: "BOC Aviation", airline: "Kenya Airways", country: "KE", aircraft: 3, timeline: "22 months", outcome: "Returned", source: "public" },
  { id: "PREC-057", year: 2022, lessor: "SMBC Aviation", airline: "Jambojet", country: "KE", aircraft: 2, timeline: "18 months", outcome: "Settled", source: "public" },
  // Egypt
  { id: "PREC-058", year: 2016, lessor: "GECAS", airline: "EgyptAir", country: "EG", aircraft: 2, timeline: "24 months", outcome: "Settled", source: "public" },
  // South Korea
  { id: "PREC-059", year: 2020, lessor: "AerCap", airline: "Asiana Airlines", country: "KR", aircraft: 5, timeline: "14 months", outcome: "Returned", source: "public" },
  { id: "PREC-060", year: 2021, lessor: "Air Lease Corp", airline: "Asiana Airlines", country: "KR", aircraft: 3, timeline: "12 months", outcome: "Returned", source: "public" },
  // Netherlands
  { id: "PREC-061", year: 2020, lessor: "AerCap", airline: "KLM", country: "NL", aircraft: 4, timeline: "6 months", outcome: "Returned", source: "public" },
  // Spain
  { id: "PREC-062", year: 2020, lessor: "Avolon", airline: "Plus Ultra", country: "ES", aircraft: 3, timeline: "12 months", outcome: "Returned", source: "public" },
  // Italy
  { id: "PREC-063", year: 2017, lessor: "AerCap", airline: "Alitalia", country: "IT", aircraft: 10, timeline: "18 months", outcome: "Returned", source: "public" },
  { id: "PREC-064", year: 2021, lessor: "Air Lease Corp", airline: "Alitalia", country: "IT", aircraft: 6, timeline: "14 months", outcome: "Returned", source: "public" },
  // Canada
  { id: "PREC-065", year: 2020, lessor: "AerCap", airline: "Air Canada", country: "CA", aircraft: 8, timeline: "5 months", outcome: "Returned", source: "public" },
];
