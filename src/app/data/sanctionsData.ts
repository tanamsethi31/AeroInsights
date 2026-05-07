/**
 * Centralized sanctions data for P2-F5.
 *
 * In production these records are hydrated by the backend from four free
 * public feeds (OFAC SDN API, EUR-Lex, UKOFSI blob, UN SCSL).  Here we ship
 * static snapshots that the UI renders directly — the same shape the backend
 * will eventually return.
 */

// ─── Feed metadata ────────────────────────────────────────────────────────────

export type FeedStatus = "ok" | "stale" | "error";

export interface SanctionsFeed {
  id: string;
  name: string;
  authority: string;
  sourceUrl: string;
  cadence: string;
  lastSync: string;
  status: FeedStatus;
  records: number;
  description: string;
}

export const SANCTIONS_FEEDS: SanctionsFeed[] = [
  {
    id: "OFAC_SDN",
    name: "OFAC SDN List",
    authority: "US Treasury / OFAC",
    sourceUrl: "https://api.ofac.treas.gov/",
    cadence: "Daily — 06:00 UTC",
    lastSync: "2026-05-07 06:02 UTC",
    status: "ok",
    records: 11_842,
    description:
      "Office of Foreign Assets Control Specially Designated Nationals and Blocked Persons list. Covers individuals, entities, aircraft and vessels prohibited from transacting with US persons.",
  },
  {
    id: "EU_CONSOL",
    name: "EU Consolidated Sanctions",
    authority: "European Commission / EUR-Lex",
    sourceUrl: "https://eur-lex.europa.eu/",
    cadence: "Daily — 07:00 UTC",
    lastSync: "2026-05-07 07:04 UTC",
    status: "ok",
    records: 4_128,
    description:
      "European Union consolidated list of persons, groups and entities subject to EU financial sanctions under multiple Council Regulations (Russia, Iran, Belarus, Venezuela, et al.).",
  },
  {
    id: "UKOFSI",
    name: "UK OFSI Consolidated List",
    authority: "HM Treasury / OFSI",
    sourceUrl:
      "https://ofsistorage.blob.core.windows.net/publishlive/ConList.xlsx",
    cadence: "Weekly — Monday 08:00 UTC",
    lastSync: "2026-05-05 08:01 UTC",
    status: "ok",
    records: 3_741,
    description:
      "UK Office of Financial Sanctions Implementation consolidated list. Post-Brexit autonomous UK sanctions regimes including Russia, Iran, Global Human Rights, and Global Anti-Corruption.",
  },
  {
    id: "UN_SCSL",
    name: "UN Security Council Sanctions",
    authority: "UN OCHA / UNSC",
    sourceUrl: "https://scsanctions.un.org/",
    cadence: "Quarterly — on UNSC resolution",
    lastSync: "2026-04-01 12:00 UTC",
    status: "ok",
    records: 812,
    description:
      "United Nations Security Council consolidated sanctions list across all active UNSC sanction regimes including ISIL/Al-Qaida, Taliban, North Korea, Somalia, Sudan, and others.",
  },
];

// ─── Sanctions status per jurisdiction code ───────────────────────────────────

export type SanctionsSeverity = "full" | "partial" | "secondary" | "none";

export interface JurisdictionSanctionsProfile {
  /** ISO 3166-1 alpha-2 */
  code: string;
  severity: SanctionsSeverity;
  lists: string[];     // Which feeds have entries: "OFAC" | "EU" | "UK" | "UN"
  designation: string; // Short human label for UI
  notes: string;
  lastUpdated: string;
}

export const JURISDICTION_SANCTIONS: Record<string, JurisdictionSanctionsProfile> = {
  RU: {
    code: "RU", severity: "full",
    lists: ["OFAC", "EU", "UK", "UN"],
    designation: "Full OFAC / EU / UK sanctions",
    notes:
      "Comprehensive sanctions in force since 24 Feb 2022. Prohibits any dealings with Russian-registered aircraft, airlines, or beneficial owners. Fleet detention of ~$10B active since 2022. Zero-tolerance enforcement — no licence exceptions.",
    lastUpdated: "2026-04-01",
  },
  IR: {
    code: "IR", severity: "full",
    lists: ["OFAC", "EU", "UK", "UN"],
    designation: "Full OFAC / EU / UK / UN sanctions",
    notes:
      "Comprehensive primary sanctions since 1979 (OFAC), reinforced post-JCPOA withdrawal (2018). Prohibits any aircraft supply, leasing, or parts export to Iran. Any Iranian airspace transit by a US-person-linked aircraft requires OFAC licence.",
    lastUpdated: "2026-04-01",
  },
  VE: {
    code: "VE", severity: "partial",
    lists: ["OFAC"],
    designation: "Partial OFAC sanctions",
    notes:
      "OFAC SDN designations on Conviasa (airline) and PDVSA-linked entities. Not a full country sanction — commercial airlines not auto-prohibited, but SDN-linked operators and government entities are blocked. Secondary sanctions risk for any lessee routing through Venezuela.",
    lastUpdated: "2026-03-15",
  },
  LB: {
    code: "LB", severity: "partial",
    lists: ["OFAC", "EU", "UK"],
    designation: "Partial — Hezbollah designations",
    notes:
      "Hezbollah designated as a terrorist organisation by OFAC, EU, and UK. Not a blanket Lebanon sanction, but aircraft operated for or on behalf of Hezbollah-linked entities are prohibited. MEA (Middle East Airlines) not currently designated.",
    lastUpdated: "2026-02-20",
  },
  CN: {
    code: "CN", severity: "secondary",
    lists: ["OFAC"],
    designation: "Secondary / entity-level OFAC designations",
    notes:
      "No blanket China sanctions, but multiple entity-level OFAC designations (military-industrial complex, Xinjiang-linked entities). Aviation exposure: review any sub-lease chains involving Chinese carriers for SDN entity overlap. Export control (EAR) restrictions apply to advanced avionics.",
    lastUpdated: "2026-02-14",
  },
  KZ: {
    code: "KZ", severity: "secondary",
    lists: [],
    designation: "Secondary sanctions monitoring",
    notes:
      "No direct Kazakhstan sanctions. However, proximity to Russia and use of Kazakhstan as a redomiciliation hub creates secondary sanctions exposure: aircraft registered in Kazakhstan may be operated by Russian-beneficial-owner entities. AWG recommends enhanced due diligence on KZ-registered sub-leases.",
    lastUpdated: "2026-01-22",
  },
  // All other jurisdictions in the dataset
  US: { code: "US", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  CA: { code: "CA", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  IE: { code: "IE", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  DE: { code: "DE", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  FR: { code: "FR", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  NL: { code: "NL", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  ES: { code: "ES", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  IT: { code: "IT", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  GB: { code: "GB", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  AE: { code: "AE", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  SG: { code: "SG", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  AU: { code: "AU", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  JP: { code: "JP", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  KR: { code: "KR", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  TH: { code: "TH", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  ID: { code: "ID", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  IN: { code: "IN", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  MX: { code: "MX", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  BR: { code: "BR", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  CL: { code: "CL", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  CO: { code: "CO", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  AR: { code: "AR", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  ZA: { code: "ZA", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  ET: { code: "ET", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  KE: { code: "KE", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  NG: { code: "NG", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  EG: { code: "EG", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  PK: { code: "PK", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  LK: { code: "LK", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
  PH: { code: "PH", severity: "none", lists: [], designation: "None", notes: "", lastUpdated: "" },
};

// ─── Lessee-level sanctions screening ────────────────────────────────────────

export type LesseeSanctionsStatus = "clear" | "alert" | "monitoring";

export interface LesseeSanctions {
  lesseeId: string;
  status: LesseeSanctionsStatus;
  /** Which sanction lists were queried */
  listsChecked: string[];
  /** SDN / entity match details (null if clear) */
  matchDetail: string | null;
  lastChecked: string;
  notes: string;
}

export const LESSEE_SANCTIONS: Record<string, LesseeSanctions> = {
  INDIGO: {
    lesseeId: "INDIGO",
    status: "monitoring",
    listsChecked: ["OFAC_SDN", "EU_CONSOL", "UKOFSI", "UN_SCSL"],
    matchDetail: null,
    lastChecked: "2026-05-07",
    notes:
      "No direct match on any list. Monitoring flag: IndiGo aircraft regularly transit Iranian and Pakistani airspace on India–Europe sectors. OFAC requires specific authorisation for aircraft with US nexus transiting IR airspace — verify Parts 560/585 licence coverage.",
  },
  AEROMEX: {
    lesseeId: "AEROMEX",
    status: "clear",
    listsChecked: ["OFAC_SDN", "EU_CONSOL", "UKOFSI", "UN_SCSL"],
    matchDetail: null,
    lastChecked: "2026-05-07",
    notes:
      "No match. Aeromexico is not designated on any list. Chapter 11 restructuring (US courts) carries no sanctions implication.",
  },
  SRILNKN: {
    lesseeId: "SRILNKN",
    status: "clear",
    listsChecked: ["OFAC_SDN", "EU_CONSOL", "UKOFSI", "UN_SCSL"],
    matchDetail: null,
    lastChecked: "2026-05-07",
    notes:
      "No match. SriLankan Airlines is government-owned but Sri Lanka is not a sanctions target on any current list.",
  },
  AZUL: {
    lesseeId: "AZUL",
    status: "clear",
    listsChecked: ["OFAC_SDN", "EU_CONSOL", "UKOFSI", "UN_SCSL"],
    matchDetail: null,
    lastChecked: "2026-05-07",
    notes: "No match. Brazil carries no blanket sanctions. Azul is not designated.",
  },
  TRANSATCA: {
    lesseeId: "TRANSATCA",
    status: "clear",
    listsChecked: ["OFAC_SDN", "EU_CONSOL", "UKOFSI", "UN_SCSL"],
    matchDetail: null,
    lastChecked: "2026-05-07",
    notes:
      "No match. Canada is a Five Eyes partner — no sanctions exposure. Air Transat not designated.",
  },
  EMIRATES: {
    lesseeId: "EMIRATES",
    status: "clear",
    listsChecked: ["OFAC_SDN", "EU_CONSOL", "UKOFSI", "UN_SCSL"],
    matchDetail: null,
    lastChecked: "2026-05-07",
    notes:
      "No match. UAE maintains full OFAC compliance. Emirates is not designated and operates under DIFC jurisdiction with strong AML/KYC controls.",
  },
};

// ─── Fleet Tracker: per-aircraft sanctions exposure ───────────────────────────

export type AircraftSanctionsAlert = "clear" | "secondary" | "red";

export interface FleetRecord {
  reg: string;
  type: string;
  msn: string;
  lessee: string;
  lesseeId: string;
  operatingCountry: string;
  operatingCountryCode: string;
  operatingCountrySanctions: SanctionsSeverity;
  routeExposure: {
    countryCode: string;
    country: string;
    exposure: "transit" | "destination" | "sub-lease";
    severity: SanctionsSeverity;
  }[];
  alert: AircraftSanctionsAlert;
  alertDetail: string | null;
  lastChecked: string;
}

export const FLEET_TRACKER: FleetRecord[] = [
  {
    reg: "VT-IYC", type: "A320neo", msn: "9218",
    lessee: "IndiGo Airlines", lesseeId: "INDIGO",
    operatingCountry: "India", operatingCountryCode: "IN",
    operatingCountrySanctions: "none",
    routeExposure: [
      {
        countryCode: "IR", country: "Iran",
        exposure: "transit",
        severity: "full",
      },
    ],
    alert: "secondary",
    alertDetail:
      "Airspace transit through sanctioned Iran (IR) on India–Europe sectors. OFAC Parts 560/585 licence verification required for aircraft with US-manufactured components. No direct dealings with Iranian entities — transit only.",
    lastChecked: "2026-05-07 06:02 UTC",
  },
  {
    reg: "XA-AMX", type: "B737-800", msn: "41234",
    lessee: "Aeromexico", lesseeId: "AEROMEX",
    operatingCountry: "Mexico", operatingCountryCode: "MX",
    operatingCountrySanctions: "none",
    routeExposure: [],
    alert: "clear",
    alertDetail: null,
    lastChecked: "2026-05-07 06:02 UTC",
  },
  {
    reg: "A6-ECE", type: "B777-300ER", msn: "62047",
    lessee: "Emirates", lesseeId: "EMIRATES",
    operatingCountry: "UAE", operatingCountryCode: "AE",
    operatingCountrySanctions: "none",
    routeExposure: [],
    alert: "clear",
    alertDetail: null,
    lastChecked: "2026-05-07 06:02 UTC",
  },
  {
    reg: "4R-ALB", type: "A330-300", msn: "1728",
    lessee: "SriLankan Airlines", lesseeId: "SRILNKN",
    operatingCountry: "Sri Lanka", operatingCountryCode: "LK",
    operatingCountrySanctions: "none",
    routeExposure: [],
    alert: "clear",
    alertDetail: null,
    lastChecked: "2026-05-07 06:02 UTC",
  },
  {
    reg: "EI-HXP", type: "B737 MAX 8", msn: "67892",
    lessee: "Ryanair", lesseeId: "RYANAIR",
    operatingCountry: "Ireland", operatingCountryCode: "IE",
    operatingCountrySanctions: "none",
    routeExposure: [],
    alert: "clear",
    alertDetail: null,
    lastChecked: "2026-05-07 06:02 UTC",
  },
  {
    reg: "F-HTYR", type: "A350-900", msn: "0378",
    lessee: "Air France", lesseeId: "AIRFRANCE",
    operatingCountry: "France", operatingCountryCode: "FR",
    operatingCountrySanctions: "none",
    routeExposure: [],
    alert: "clear",
    alertDetail: null,
    lastChecked: "2026-05-07 06:02 UTC",
  },
];

// ─── Helper functions ─────────────────────────────────────────────────────────

export function sanctionsSeverityLabel(s: SanctionsSeverity): string {
  switch (s) {
    case "full":      return "Full Sanctions";
    case "partial":   return "Partial Sanctions";
    case "secondary": return "Secondary Risk";
    case "none":      return "None";
  }
}

export function sanctionsSeverityColor(s: SanctionsSeverity): string {
  switch (s) {
    case "full":      return "#B91C1C";
    case "partial":   return "#C2410C";
    case "secondary": return "#B45309";
    case "none":      return "#15803D";
  }
}

export function sanctionsSeverityBg(s: SanctionsSeverity): string {
  switch (s) {
    case "full":      return "rgba(185,28,28,0.07)";
    case "partial":   return "rgba(194,65,12,0.07)";
    case "secondary": return "rgba(180,83,9,0.07)";
    case "none":      return "rgba(21,128,61,0.07)";
  }
}

export function lesseeSanctionsColor(s: LesseeSanctionsStatus): string {
  switch (s) {
    case "alert":      return "#B91C1C";
    case "monitoring": return "#B45309";
    case "clear":      return "#15803D";
  }
}

export function lesseeSanctionsBg(s: LesseeSanctionsStatus): string {
  switch (s) {
    case "alert":      return "rgba(185,28,28,0.08)";
    case "monitoring": return "rgba(180,83,9,0.08)";
    case "clear":      return "rgba(21,128,61,0.08)";
  }
}

export function lesseeSanctionsLabel(s: LesseeSanctionsStatus): string {
  switch (s) {
    case "alert":      return "Sanctions Alert";
    case "monitoring": return "Monitoring";
    case "clear":      return "Sanctions Clear";
  }
}

export function alertColor(a: AircraftSanctionsAlert): string {
  switch (a) {
    case "red":       return "#B91C1C";
    case "secondary": return "#B45309";
    case "clear":     return "#15803D";
  }
}
