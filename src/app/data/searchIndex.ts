export type SearchResult = {
  id: string;
  label: string;
  sublabel: string;
  category: "Lease" | "Aircraft" | "Lessee" | "Page";
  url: string;
  keywords: string; // lowercase concat for matching
};

const leases: SearchResult[] = [
  { id: "LSE-2019-001", label: "LSE-2019-001", sublabel: "IndiGo Airlines · A320neo · MSN 9218",       category: "Lease",    url: "/portfolio/register", keywords: "lse-2019-001 indigo airlines a320neo 9218" },
  { id: "LSE-2020-014", label: "LSE-2020-014", sublabel: "Aeromexico · B737-800 · MSN 41234",           category: "Lease",    url: "/portfolio/register", keywords: "lse-2020-014 aeromexico b737-800 41234" },
  { id: "LSE-2021-022", label: "LSE-2021-022", sublabel: "Emirates · B777-300ER · MSN 62047",           category: "Lease",    url: "/portfolio/register", keywords: "lse-2021-022 emirates b777-300er 62047" },
  { id: "LSE-2020-031", label: "LSE-2020-031", sublabel: "SriLankan Airlines · A330-300 · MSN 1728",    category: "Lease",    url: "/portfolio/register", keywords: "lse-2020-031 srilankan airlines a330-300 1728" },
  { id: "LSE-2022-009", label: "LSE-2022-009", sublabel: "Ryanair · B737 MAX 8 · MSN 67892",            category: "Lease",    url: "/portfolio/register", keywords: "lse-2022-009 ryanair b737 max 8 67892" },
  { id: "LSE-2018-047", label: "LSE-2018-047", sublabel: "Air France · A350-900 · MSN 0378",            category: "Lease",    url: "/portfolio/register", keywords: "lse-2018-047 air france a350-900 0378" },
  { id: "LSE-2021-055", label: "LSE-2021-055", sublabel: "Azul Brazilian Airlines · A320neo · MSN 10442",category: "Lease",   url: "/portfolio/register", keywords: "lse-2021-055 azul brazilian airlines a320neo 10442" },
  { id: "LSE-2019-063", label: "LSE-2019-063", sublabel: "Air Transat · A321neo · MSN 8841",            category: "Lease",    url: "/portfolio/register", keywords: "lse-2019-063 air transat a321neo 8841" },
  { id: "LSE-2023-002", label: "LSE-2023-002", sublabel: "Singapore Airlines · A350-900 · MSN 0521",    category: "Lease",    url: "/portfolio/register", keywords: "lse-2023-002 singapore airlines a350-900 0521" },
  { id: "LSE-2022-018", label: "LSE-2022-018", sublabel: "Lufthansa · A220-300 · MSN 55124",            category: "Lease",    url: "/portfolio/register", keywords: "lse-2022-018 lufthansa a220-300 55124" },
];

const aircraft: SearchResult[] = [
  { id: "MSN-9218",  label: "MSN 9218",  sublabel: "A320neo · VT-IYC · IndiGo Airlines",        category: "Aircraft", url: "/portfolio/aircraft-mix", keywords: "9218 a320neo vt-iyc indigo" },
  { id: "MSN-41234", label: "MSN 41234", sublabel: "B737-800 · XA-AMX · Aeromexico",             category: "Aircraft", url: "/portfolio/aircraft-mix", keywords: "41234 b737-800 xa-amx aeromexico" },
  { id: "MSN-62047", label: "MSN 62047", sublabel: "B777-300ER · A6-ECE · Emirates",             category: "Aircraft", url: "/portfolio/aircraft-mix", keywords: "62047 b777-300er a6-ece emirates" },
  { id: "MSN-1728",  label: "MSN 1728",  sublabel: "A330-300 · 4R-ALB · SriLankan Airlines",    category: "Aircraft", url: "/portfolio/aircraft-mix", keywords: "1728 a330-300 4r-alb srilankan" },
  { id: "MSN-67892", label: "MSN 67892", sublabel: "B737 MAX 8 · EI-HXP · Ryanair",             category: "Aircraft", url: "/portfolio/aircraft-mix", keywords: "67892 b737 max 8 ei-hxp ryanair" },
  { id: "MSN-0378",  label: "MSN 0378",  sublabel: "A350-900 · F-HTYR · Air France",            category: "Aircraft", url: "/portfolio/aircraft-mix", keywords: "0378 a350-900 f-htyr air france" },
];

const lessees: SearchResult[] = [
  { id: "LS-emirates",   label: "Emirates",              sublabel: "UAE · Rating A- · Stage 1",       category: "Lessee", url: "/counterparties", keywords: "emirates uae a-" },
  { id: "LS-ryanair",    label: "Ryanair",               sublabel: "Ireland · Rating BBB+ · Stage 1", category: "Lessee", url: "/counterparties", keywords: "ryanair ireland bbb+" },
  { id: "LS-singapore",  label: "Singapore Airlines",    sublabel: "Singapore · Rating A · Stage 1",  category: "Lessee", url: "/counterparties", keywords: "singapore airlines a" },
  { id: "LS-airfrance",  label: "Air France",            sublabel: "France · Rating BB+ · Stage 1",   category: "Lessee", url: "/counterparties", keywords: "air france france bb+" },
  { id: "LS-lufthansa",  label: "Lufthansa",             sublabel: "Germany · Rating BBB- · Stage 1", category: "Lessee", url: "/counterparties", keywords: "lufthansa germany bbb-" },
  { id: "LS-azul",       label: "Azul Brazilian Airlines",sublabel: "Brazil · Rating B+ · Stage 2",   category: "Lessee", url: "/counterparties", keywords: "azul brazilian airlines brazil b+" },
  { id: "LS-transat",    label: "Air Transat",           sublabel: "Canada · Rating B · Stage 2",     category: "Lessee", url: "/counterparties", keywords: "air transat canada b" },
  { id: "LS-srilankan",  label: "SriLankan Airlines",   sublabel: "Sri Lanka · Rating B+ · Stage 2", category: "Lessee", url: "/counterparties", keywords: "srilankan airlines sri lanka b+" },
  { id: "LS-indigo",     label: "IndiGo Airlines",      sublabel: "India · Rating BB- · Stage 3",    category: "Lessee", url: "/counterparties", keywords: "indigo airlines india bb-" },
  { id: "LS-aeromexico", label: "Aeromexico",            sublabel: "Mexico · Rating CCC · Stage 3",   category: "Lessee", url: "/counterparties", keywords: "aeromexico mexico ccc" },
];

const pages: SearchResult[] = [
  { id: "pg-dashboard",    label: "Dashboard",        sublabel: "Overview & KPIs",                      category: "Page", url: "/",                       keywords: "dashboard overview kpi" },
  { id: "pg-portfolio",    label: "Portfolio",        sublabel: "Lease Register",                       category: "Page", url: "/portfolio/register",     keywords: "portfolio leases register" },
  { id: "pg-concentration",label: "Concentration",   sublabel: "Portfolio Analytics",                  category: "Page", url: "/portfolio/analytics",    keywords: "concentration analytics portfolio" },
  { id: "pg-aircraft",     label: "Aircraft",         sublabel: "Fleet Overview",                       category: "Page", url: "/portfolio/aircraft-mix", keywords: "aircraft fleet mix" },
  { id: "pg-scenarios",    label: "Scenarios",        sublabel: "ECL Scenario Library",                 category: "Page", url: "/scenarios/library",      keywords: "scenarios ecl library" },
  { id: "pg-runconfig",    label: "Custom Builder",   sublabel: "Build & Run Scenarios",                category: "Page", url: "/scenarios/run",          keywords: "custom builder scenario run config" },
  { id: "pg-runhistory",   label: "Run History",      sublabel: "Immutable Scenario Audit Trail",       category: "Page", url: "/scenarios/history",      keywords: "run history audit trail" },
  { id: "pg-ecloverview",  label: "ECL Overview",     sublabel: "Risk & ECL Summary",                   category: "Page", url: "/risk-ecl/summary",       keywords: "ecl overview risk" },
  { id: "pg-migration",    label: "Stage Migration",  sublabel: "IFRS 9 Migration Matrix",              category: "Page", url: "/risk-ecl/migration",     keywords: "stage migration ifrs9 matrix" },
  { id: "pg-sensitivity",  label: "Sensitivity",      sublabel: "ECL Sensitivity Analysis",             category: "Page", url: "/risk-ecl/waterfall",     keywords: "sensitivity waterfall ecl" },
  { id: "pg-counterparties",label: "Counterparties",  sublabel: "Lessee Intelligence & Watchlist",      category: "Page", url: "/counterparties",         keywords: "counterparties lessee watchlist" },
  { id: "pg-jurisdictions", label: "Jurisdictions",   sublabel: "CTC & Enforcement Index",              category: "Page", url: "/jurisdictions",          keywords: "jurisdictions ctc enforcement" },
  { id: "pg-reports",      label: "Report Templates", sublabel: "Report Generation",                    category: "Page", url: "/reports/templates",      keywords: "reports templates" },
  { id: "pg-scheduled",    label: "Scheduled Reports",sublabel: "Automated Report Delivery",            category: "Page", url: "/reports/scheduled",      keywords: "scheduled reports automated" },
  { id: "pg-exportlog",    label: "Export History",   sublabel: "Download & Export Log",                category: "Page", url: "/reports/export-log",     keywords: "export history log download" },
  { id: "pg-settings",     label: "Tenant Settings",  sublabel: "Firm Configuration",                   category: "Page", url: "/settings/firm",          keywords: "settings tenant firm" },
  { id: "pg-users",        label: "Users & RBAC",     sublabel: "User Management & Access Control",     category: "Page", url: "/settings/users",         keywords: "users rbac access control" },
  { id: "pg-datasources",  label: "Data Sources",     sublabel: "Portfolio Data & API Connections",     category: "Page", url: "/settings/data-sources",  keywords: "data sources api connections" },
  { id: "pg-model",        label: "Model Params",     sublabel: "ECL Model Configuration",              category: "Page", url: "/settings/ecl",           keywords: "model params ecl configuration" },
];

export const ALL_RESULTS: SearchResult[] = [...pages, ...leases, ...aircraft, ...lessees];

export function search(query: string): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return ALL_RESULTS.filter((r) => r.keywords.includes(q) || r.label.toLowerCase().includes(q)).slice(0, 8);
}
