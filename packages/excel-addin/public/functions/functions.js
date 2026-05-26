/**
 * Aerinsights Excel Add-in — Custom Functions
 * ─────────────────────────────────────────────
 * Plain ES2020 JavaScript (not TypeScript). Office custom functions require a
 * single self-contained JS file — no ES module imports, no bundler chunks.
 *
 * All 20 functions are registered under the "AER" namespace.
 * In Excel the formulas are: =AER.ECL(...), =AER.PORTFOLIO_ECL(...), etc.
 *
 * Token auth:
 *   The add-in uses a shared runtime (manifest lifetime="long"), so the task pane
 *   and custom functions share the same localStorage. The task pane handles sign-in
 *   via Auth0 PKCE and stores the token under TOKEN_KEY. Functions read it here.
 *
 * API base:
 *   Hardcoded below — not read from Vite env (this file is static, not bundled).
 *   Change API_BASE before a production deployment.
 */

/* ── Config ──────────────────────────────────────────────────────────────── */

// T-5.5 — Defaults to the Aeroinsights Vercel deployment. Override at
// runtime by setting `window.AEROINSIGHTS_API_BASE` before Office.onReady
// (e.g. from a config script in functions.html).
const API_BASE  = (typeof window !== "undefined" && window.AEROINSIGHTS_API_BASE)
  ? window.AEROINSIGHTS_API_BASE
  : "https://aeroinsights.io/api";
const TOKEN_KEY = "aerinsights_addin_token";

/* ── Shared fetch helper ─────────────────────────────────────────────────── */

/**
 * Authenticated fetch against the Aerinsights API.
 * Throws new Error("AUTH") on 401 so every function can return a consistent
 * "#AERINSIGHTS - AUTH REQUIRED" string to the cell.
 * Returns null on 404 so functions can return "#AERINSIGHTS - NOT FOUND".
 */
async function aerFetch(path) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("AUTH");

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401) throw new Error("AUTH");
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return response.json();
}

/* ── Error helpers ───────────────────────────────────────────────────────── */

function handleError(e) {
  if (e && e.message === "AUTH") return "#AERINSIGHTS - AUTH REQUIRED";
  return "#AERINSIGHTS - ERROR";
}

/* ════════════════════════════════════════════════════════════════════════════
   ECL & Risk functions (1–6)
════════════════════════════════════════════════════════════════════════════ */

/**
 * Returns the Expected Credit Loss in $M for a specific lease under a named scenario.
 * @customfunction AER.ECL ECL
 * @param {string} leaseId   The lease identifier e.g. "LSE-2019-001"
 * @param {string} scenario  Scenario name e.g. "Baseline" or "COVID-Severe"
 * @param {string} asOfDate  ISO date string e.g. "2026-04-29"
 * @returns {Promise<number>} ECL in USD millions
 */
async function ECL(leaseId, scenario, asOfDate) {
  try {
    const result = await aerFetch(
      `/excel/ecl?lease_id=${encodeURIComponent(leaseId)}&scenario=${encodeURIComponent(scenario)}&as_of=${encodeURIComponent(asOfDate)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.ecl;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns total portfolio ECL in $M for the named scenario.
 * @customfunction AER.PORTFOLIO_ECL PORTFOLIO_ECL
 * @param {string} scenario  Scenario name e.g. "Baseline"
 * @param {string} asOfDate  ISO date string e.g. "2026-04-29"
 * @returns {Promise<number>} Total portfolio ECL in USD millions
 */
async function PORTFOLIO_ECL(scenario, asOfDate) {
  try {
    const result = await aerFetch(
      `/excel/portfolio-ecl?scenario=${encodeURIComponent(scenario)}&as_of=${encodeURIComponent(asOfDate)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.ecl;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns the IFRS 9 stage (1, 2, or 3) for a lease.
 * @customfunction AER.STAGE STAGE
 * @param {string} leaseId   The lease identifier
 * @param {string} asOfDate  ISO date string
 * @returns {Promise<number>} IFRS 9 stage: 1, 2, or 3
 */
async function STAGE(leaseId, asOfDate) {
  try {
    const result = await aerFetch(
      `/excel/stage?lease_id=${encodeURIComponent(leaseId)}&as_of=${encodeURIComponent(asOfDate)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.stage;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns the Loss Given Default as a decimal for a lease, net of SD and MR offsets.
 * @customfunction AER.LGD LGD
 * @param {string} leaseId The lease identifier
 * @returns {Promise<number>} LGD as a decimal e.g. 0.42
 */
async function LGD(leaseId) {
  try {
    const result = await aerFetch(
      `/excel/lgd?lease_id=${encodeURIComponent(leaseId)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.lgd;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns the Probability of Default for a lease. Horizon: "12m" or "lifetime".
 * @customfunction AER.PD PD
 * @param {string} leaseId  The lease identifier
 * @param {string} horizon  "12m" or "lifetime"
 * @returns {Promise<number>} PD as a decimal e.g. 0.08
 */
async function PD(leaseId, horizon) {
  try {
    const result = await aerFetch(
      `/excel/pd?lease_id=${encodeURIComponent(leaseId)}&horizon=${encodeURIComponent(horizon)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.pd;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns the Exposure at Default in $M for a lease.
 * @customfunction AER.EAD EAD
 * @param {string} leaseId The lease identifier
 * @returns {Promise<number>} EAD in USD millions
 */
async function EAD(leaseId) {
  try {
    const result = await aerFetch(
      `/excel/ead?lease_id=${encodeURIComponent(leaseId)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.ead;
  } catch (e) {
    return handleError(e);
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   Maintenance Reserve & Security Deposit functions (7–9)
════════════════════════════════════════════════════════════════════════════ */

/**
 * Returns the maintenance reserve balance in $M for a lease as of a given date.
 * @customfunction AER.MR_BALANCE MR_BALANCE
 * @param {string} leaseId   The lease identifier
 * @param {string} asOfDate  ISO date string
 * @returns {Promise<number>} MR balance in USD millions
 */
async function MR_BALANCE(leaseId, asOfDate) {
  try {
    const result = await aerFetch(
      `/excel/mr-balance?lease_id=${encodeURIComponent(leaseId)}&as_of=${encodeURIComponent(asOfDate)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.balance;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns the security deposit posted in $M for a lease.
 * @customfunction AER.SD_POSTED SD_POSTED
 * @param {string} leaseId The lease identifier
 * @returns {Promise<number>} Security deposit in USD millions
 */
async function SD_POSTED(leaseId) {
  try {
    const result = await aerFetch(
      `/excel/sd?lease_id=${encodeURIComponent(leaseId)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.amount;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns projected maintenance reserve shortfall at end of lease in $M.
 * Negative = surplus, positive = shortfall.
 * @customfunction AER.MR_SHORTFALL MR_SHORTFALL
 * @param {string} leaseId The lease identifier
 * @returns {Promise<number>} MR shortfall at EOL in $M (positive = shortfall)
 */
async function MR_SHORTFALL(leaseId) {
  try {
    const result = await aerFetch(
      `/excel/mr-shortfall?lease_id=${encodeURIComponent(leaseId)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.shortfall;
  } catch (e) {
    return handleError(e);
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   Jurisdiction & Repossession functions (10–13)
════════════════════════════════════════════════════════════════════════════ */

/**
 * Returns P50 repossession timeline in months for a jurisdiction (ISO country code).
 * @customfunction AER.REPO_P50 REPO_P50
 * @param {string} jurisdictionCode ISO 3166-1 alpha-2 country code e.g. "IN"
 * @returns {Promise<number>} Months to successful repossession at P50
 */
async function REPO_P50(jurisdictionCode) {
  try {
    const result = await aerFetch(
      `/excel/repossession?jurisdiction=${encodeURIComponent(jurisdictionCode)}&percentile=50`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.months;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns P90 repossession timeline in months for a jurisdiction (ISO country code).
 * @customfunction AER.REPO_P90 REPO_P90
 * @param {string} jurisdictionCode ISO 3166-1 alpha-2 country code e.g. "IN"
 * @returns {Promise<number>} Months to successful repossession at P90
 */
async function REPO_P90(jurisdictionCode) {
  try {
    const result = await aerFetch(
      `/excel/repossession?jurisdiction=${encodeURIComponent(jurisdictionCode)}&percentile=90`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.months;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns estimated repossession cost as a % of aircraft value for a jurisdiction.
 * @customfunction AER.REPO_COST REPO_COST
 * @param {string} jurisdictionCode ISO 3166-1 alpha-2 country code
 * @returns {Promise<number>} Repossession cost as decimal e.g. 0.08 = 8%
 */
async function REPO_COST(jurisdictionCode) {
  try {
    const result = await aerFetch(
      `/excel/repossession-cost?jurisdiction=${encodeURIComponent(jurisdictionCode)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.cost_pct;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns the Cape Town Convention compliance score (0–100) for a jurisdiction.
 * @customfunction AER.CTC_SCORE CTC_SCORE
 * @param {string} jurisdictionCode ISO 3166-1 alpha-2 country code
 * @returns {Promise<number>} CTC compliance score 0–100
 */
async function CTC_SCORE(jurisdictionCode) {
  try {
    const result = await aerFetch(
      `/excel/ctc-score?jurisdiction=${encodeURIComponent(jurisdictionCode)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.score;
  } catch (e) {
    return handleError(e);
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   Counterparty & Watchlist functions (14–17)
════════════════════════════════════════════════════════════════════════════ */

/**
 * Returns the Observed Contractual Performance Indicator (OCPI) score for a lessee (0=worst, 100=best).
 * @customfunction AER.BEHAVIOR_SCORE BEHAVIOR_SCORE
 * @param {string} lesseeId The lessee identifier e.g. "indigo-airlines"
 * @returns {Promise<number>} OCPI behavior score 0–100
 */
async function BEHAVIOR_SCORE(lesseeId) {
  try {
    const result = await aerFetch(
      `/excel/behavior-score?lessee_id=${encodeURIComponent(lesseeId)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.score;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns the current watchlist status for a lessee: GREEN, AMBER, or RED.
 * @customfunction AER.WATCHLIST_STATUS WATCHLIST_STATUS
 * @param {string} lesseeId The lessee identifier
 * @returns {Promise<string>} "GREEN", "AMBER", or "RED"
 */
async function WATCHLIST_STATUS(lesseeId) {
  try {
    const result = await aerFetch(
      `/excel/watchlist?lessee_id=${encodeURIComponent(lesseeId)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.status;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns the worst IFRS 9 stage across all leases for a given lessee.
 * @customfunction AER.LESSEE_STAGE LESSEE_STAGE
 * @param {string} lesseeId The lessee identifier
 * @returns {Promise<number>} Worst IFRS 9 stage: 1, 2, or 3
 */
async function LESSEE_STAGE(lesseeId) {
  try {
    const result = await aerFetch(
      `/excel/lessee-stage?lessee_id=${encodeURIComponent(lesseeId)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.stage;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns total ECL in $M across all leases for a lessee under the named scenario.
 * @customfunction AER.LESSEE_ECL LESSEE_ECL
 * @param {string} lesseeId  The lessee identifier
 * @param {string} scenario  Scenario name
 * @returns {Promise<number>} Total ECL in USD millions
 */
async function LESSEE_ECL(lesseeId, scenario) {
  try {
    const result = await aerFetch(
      `/excel/lessee-ecl?lessee_id=${encodeURIComponent(lesseeId)}&scenario=${encodeURIComponent(scenario)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.ecl;
  } catch (e) {
    return handleError(e);
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   Portfolio & Asset functions (18–20)
════════════════════════════════════════════════════════════════════════════ */

/**
 * Returns the half-life market value in $M for an aircraft by MSN.
 * @customfunction AER.MARKET_VALUE MARKET_VALUE
 * @param {string} msn The aircraft manufacturer serial number
 * @returns {Promise<number>} Half-life market value in USD millions
 */
async function MARKET_VALUE(msn) {
  try {
    const result = await aerFetch(
      `/excel/market-value?msn=${encodeURIComponent(msn)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.value;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns the lease-encumbered value (LEV) in $M for an aircraft by MSN.
 * @customfunction AER.ENCUMBERED_VALUE ENCUMBERED_VALUE
 * @param {string} msn The aircraft manufacturer serial number
 * @returns {Promise<number>} Lease-encumbered value in USD millions
 */
async function ENCUMBERED_VALUE(msn) {
  try {
    const result = await aerFetch(
      `/excel/encumbered-value?msn=${encodeURIComponent(msn)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.value;
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Returns a named portfolio KPI.
 * Valid names: portfolio_ecl, book_value, encumbered_value, avg_lease_term,
 *              ecl_rate, watchlist_red_count, watchlist_amber_count
 * @customfunction AER.KPI KPI
 * @param {string} metricName  The KPI name (see valid names above)
 * @param {string} asOfDate    ISO date string
 * @returns {Promise<number>} The numeric value of the named KPI
 */
async function KPI(metricName, asOfDate) {
  try {
    const result = await aerFetch(
      `/excel/kpi?metric=${encodeURIComponent(metricName)}&as_of=${encodeURIComponent(asOfDate)}`
    );
    if (result === null) return "#AERINSIGHTS - NOT FOUND";
    return result.value;
  } catch (e) {
    return handleError(e);
  }
}

/* ── Registration ────────────────────────────────────────────────────────── */
/*
 * CustomFunctions.associate(id, handler) maps the Excel formula name (including
 * the "AER." namespace prefix) to the JavaScript function above.
 *
 * We wrap in Office.onReady to ensure the CustomFunctions object is available
 * before registration. With shared runtime, this fires when the task pane loads.
 */
Office.onReady(() => {
  // ECL & Risk
  CustomFunctions.associate("AER.ECL",            ECL);
  CustomFunctions.associate("AER.PORTFOLIO_ECL",  PORTFOLIO_ECL);
  CustomFunctions.associate("AER.STAGE",          STAGE);
  CustomFunctions.associate("AER.LGD",            LGD);
  CustomFunctions.associate("AER.PD",             PD);
  CustomFunctions.associate("AER.EAD",            EAD);

  // Maintenance Reserve & Security Deposit
  CustomFunctions.associate("AER.MR_BALANCE",     MR_BALANCE);
  CustomFunctions.associate("AER.SD_POSTED",      SD_POSTED);
  CustomFunctions.associate("AER.MR_SHORTFALL",   MR_SHORTFALL);

  // Jurisdictions
  CustomFunctions.associate("AER.REPO_P50",       REPO_P50);
  CustomFunctions.associate("AER.REPO_P90",       REPO_P90);
  CustomFunctions.associate("AER.REPO_COST",      REPO_COST);
  CustomFunctions.associate("AER.CTC_SCORE",      CTC_SCORE);

  // Counterparty & Watchlist
  CustomFunctions.associate("AER.BEHAVIOR_SCORE", BEHAVIOR_SCORE);
  CustomFunctions.associate("AER.WATCHLIST_STATUS", WATCHLIST_STATUS);
  CustomFunctions.associate("AER.LESSEE_STAGE",   LESSEE_STAGE);
  CustomFunctions.associate("AER.LESSEE_ECL",     LESSEE_ECL);

  // Portfolio & Assets
  CustomFunctions.associate("AER.MARKET_VALUE",     MARKET_VALUE);
  CustomFunctions.associate("AER.ENCUMBERED_VALUE", ENCUMBERED_VALUE);
  CustomFunctions.associate("AER.KPI",              KPI);
});
