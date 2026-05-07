// src/app/components/agent/agentTools.ts
import {
  LESSEE_RADAR,
  MACRO_SIGNALS,
  DEAL_FEED,
  JURISDICTION_EVENTS,
} from "../../data/intelligenceData";
import { WATCHLIST_DATA } from "../counterparties/watchlistEngine";
import {
  computeECL,
  computeStages,
  type ScenarioInputs,
} from "../../utils/eclCalculator";

// ─── Mock Leases ────────────────────────────────────────────────────────────────

interface MockLease {
  leaseId: string;
  lesseeId: string;
  lesseeName: string;
  aircraft: string;
  msn: string;
  expiryDate: string;   // "YYYY-MM-DD"
  stage: "1" | "2" | "3";
  jurisdiction: string;
  monthlyRentUSD: number;
}

const MOCK_LEASES: MockLease[] = [
  { leaseId: "LS-001", lesseeId: "INDIGO",    lesseeName: "IndiGo Airlines",         aircraft: "A320neo",    msn: "8741", expiryDate: "2027-03-15", stage: "3", jurisdiction: "India",     monthlyRentUSD: 340_000 },
  { leaseId: "LS-002", lesseeId: "INDIGO",    lesseeName: "IndiGo Airlines",         aircraft: "A320neo",    msn: "9102", expiryDate: "2028-06-30", stage: "3", jurisdiction: "India",     monthlyRentUSD: 355_000 },
  { leaseId: "LS-003", lesseeId: "INDIGO",    lesseeName: "IndiGo Airlines",         aircraft: "A321neo",    msn: "9445", expiryDate: "2029-11-01", stage: "3", jurisdiction: "India",     monthlyRentUSD: 440_000 },
  { leaseId: "LS-004", lesseeId: "AEROMEX",   lesseeName: "Aeromexico",              aircraft: "B737 MAX 8", msn: "7521", expiryDate: "2026-09-30", stage: "3", jurisdiction: "Mexico",    monthlyRentUSD: 370_000 },
  { leaseId: "LS-005", lesseeId: "AEROMEX",   lesseeName: "Aeromexico",              aircraft: "B737 MAX 8", msn: "7688", expiryDate: "2027-12-31", stage: "3", jurisdiction: "Mexico",    monthlyRentUSD: 375_000 },
  { leaseId: "LS-006", lesseeId: "AZUL",      lesseeName: "Azul Brazilian Airlines", aircraft: "A320neo",    msn: "9312", expiryDate: "2028-04-15", stage: "2", jurisdiction: "Brazil",    monthlyRentUSD: 345_000 },
  { leaseId: "LS-007", lesseeId: "AZUL",      lesseeName: "Azul Brazilian Airlines", aircraft: "A321neo",    msn: "9567", expiryDate: "2029-08-01", stage: "2", jurisdiction: "Brazil",    monthlyRentUSD: 430_000 },
  { leaseId: "LS-008", lesseeId: "SRILNKN",   lesseeName: "SriLankan Airlines",      aircraft: "A320ceo",    msn: "6234", expiryDate: "2026-07-31", stage: "2", jurisdiction: "Sri Lanka", monthlyRentUSD: 290_000 },
  { leaseId: "LS-009", lesseeId: "TRANSATCA", lesseeName: "Air Transat",             aircraft: "A321LR",     msn: "9801", expiryDate: "2030-02-28", stage: "2", jurisdiction: "Canada",    monthlyRentUSD: 470_000 },
  { leaseId: "LS-010", lesseeId: "AF",        lesseeName: "Air France",              aircraft: "A350-900",   msn: "0412", expiryDate: "2031-05-01", stage: "1", jurisdiction: "France",    monthlyRentUSD: 1_180_000 },
  { leaseId: "LS-011", lesseeId: "AF",        lesseeName: "Air France",              aircraft: "A350-900",   msn: "0588", expiryDate: "2032-09-30", stage: "1", jurisdiction: "France",    monthlyRentUSD: 1_210_000 },
  { leaseId: "LS-012", lesseeId: "EMIRATES",  lesseeName: "Emirates",                aircraft: "A350-900",   msn: "0219", expiryDate: "2033-03-31", stage: "1", jurisdiction: "UAE",       monthlyRentUSD: 1_240_000 },
  { leaseId: "LS-013", lesseeId: "EMIRATES",  lesseeName: "Emirates",                aircraft: "A350-900",   msn: "0345", expiryDate: "2034-01-15", stage: "1", jurisdiction: "UAE",       monthlyRentUSD: 1_260_000 },
  { leaseId: "LS-014", lesseeId: "LUFTHANSA", lesseeName: "Lufthansa",               aircraft: "A320neo",    msn: "9011", expiryDate: "2029-06-30", stage: "1", jurisdiction: "Germany",   monthlyRentUSD: 360_000 },
  { leaseId: "LS-015", lesseeId: "SQ",        lesseeName: "Singapore Airlines",      aircraft: "A350-900",   msn: "0671", expiryDate: "2032-12-31", stage: "1", jurisdiction: "Singapore", monthlyRentUSD: 1_220_000 },
];

// ─── Mock Scenario Runs ─────────────────────────────────────────────────────────

interface MockScenarioRun {
  name: string;
  runDate: string;
  inputs: ScenarioInputs;
}

const MOCK_SCENARIO_RUNS: MockScenarioRun[] = [
  {
    name: "Baseline 2026 Q1",
    runDate: "2026-04-02",
    inputs: { gdpDelta: 0, rpkDelta: 0.02, fuelDelta: 0.27, fxDelta: -0.02, rateDelta: 0, assetValueDelta: -0.03, pdS2Multi: 1.1, pdS3Multi: 1.05 },
  },
  {
    name: "Fuel Spike",
    runDate: "2026-04-15",
    inputs: { gdpDelta: -0.01, rpkDelta: -0.05, fuelDelta: 0.55, fxDelta: -0.03, rateDelta: 0.005, assetValueDelta: -0.05, pdS2Multi: 1.3, pdS3Multi: 1.2 },
  },
  {
    name: "COVID-Severe",
    runDate: "2026-03-20",
    inputs: { gdpDelta: -0.06, rpkDelta: -0.65, fuelDelta: -0.10, fxDelta: -0.12, rateDelta: -0.01, assetValueDelta: -0.35, pdS2Multi: 2.8, pdS3Multi: 3.5 },
  },
  {
    name: "Rate Rise",
    runDate: "2026-03-01",
    inputs: { gdpDelta: -0.02, rpkDelta: -0.03, fuelDelta: 0.10, fxDelta: -0.01, rateDelta: 0.02, assetValueDelta: -0.08, pdS2Multi: 1.15, pdS3Multi: 1.1 },
  },
];

// ─── OpenAI Tool Definitions (JSON Schema) ──────────────────────────────────────

export const AGENT_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_lessee_detail",
      description:
        "Returns detailed information about a specific lessee: composite signal, composite score, all four radar signals (load factor, schedule stability, fuel cost stress, revenue-lease ratio) with values/thresholds/status/trend, watchlist audit log (last 3 entries), and relevant deal feed items.",
      parameters: {
        type: "object",
        properties: {
          lesseeName: {
            type: "string",
            description:
              "The lessee name as it appears in the portfolio (e.g. 'IndiGo Airlines', 'Aeromexico'). Case-insensitive partial match is supported.",
          },
        },
        required: ["lesseeName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_leases_by_filter",
      description:
        "Returns leases matching the given filters. At least one filter must be provided. Returns: leaseId, lessee, aircraft type, MSN, expiry date, IFRS 9 stage, jurisdiction, monthly rent USD.",
      parameters: {
        type: "object",
        properties: {
          stage: {
            type: "string",
            enum: ["1", "2", "3"],
            description: "IFRS 9 stage to filter by.",
          },
          jurisdiction: {
            type: "string",
            description: "Country name (e.g. 'India', 'Brazil'). Case-insensitive partial match.",
          },
          expiryBefore: {
            type: "string",
            description: "ISO date string YYYY-MM-DD. Returns leases expiring before this date.",
          },
          lesseeId: {
            type: "string",
            description: "Lessee ID (e.g. 'INDIGO', 'AZUL', 'AEROMEX').",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_market_signals",
      description:
        "Returns market signals from the Aero Intelligence module, filtered by category. Returns: signal name, category, severity, current/previous value, ECL impact, affected lessees with exposure and stage.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["fuel", "gdp", "rates", "fx", "aviation", "all"],
            description: "Signal category to filter by. Use 'all' to return all categories.",
          },
        },
        required: ["category"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_scenario_result",
      description:
        "Returns the ECL result and stage distribution for a named historical scenario run. Known runs: 'Baseline 2026 Q1', 'Fuel Spike', 'COVID-Severe', 'Rate Rise'. Returns ECL in $m, stage breakdown, and the inputs used.",
      parameters: {
        type: "object",
        properties: {
          scenarioName: {
            type: "string",
            description:
              "Name of a saved scenario run. Case-insensitive partial match supported.",
          },
        },
        required: ["scenarioName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "navigate_and_prepopulate",
      description:
        "Generates a navigation action to open a platform page, optionally pre-populating a form with parameter values. Always requires explicit user confirmation before executing — the UI shows a confirmation card. Use this when the user asks to open a page or run a scenario with specific parameters.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Platform path to navigate to (e.g. '/scenarios/run', '/risk-ecl/summary', '/counterparties').",
          },
          params: {
            type: "object",
            description:
              "Optional key-value pairs to pre-populate the destination form. For /scenarios/run, valid keys: gdpDelta, rpkDelta, fuelDelta, fxDelta, rateDelta, assetValueDelta, pdS2Multi, pdS3Multi. Values are numeric (e.g. fuelDelta: 0.27 = +27%).",
            additionalProperties: { type: "number" },
          },
        },
        required: ["path"],
      },
    },
  },
];

// ─── Executor Functions ─────────────────────────────────────────────────────────

type ToolResult = Record<string, unknown>;

export function executeTool(name: string, args: Record<string, unknown>): ToolResult {
  switch (name) {
    case "get_lessee_detail":
      return execGetLesseeDetail(args.lesseeName as string);
    case "get_leases_by_filter":
      return execGetLeasesByFilter(
        args as { stage?: string; jurisdiction?: string; expiryBefore?: string; lesseeId?: string }
      );
    case "get_market_signals":
      return execGetMarketSignals(args.category as string);
    case "get_scenario_result":
      return execGetScenarioResult(args.scenarioName as string);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function execGetLesseeDetail(name: string): ToolResult {
  const radar = LESSEE_RADAR.find(
    (e) =>
      e.lesseeName.toLowerCase().includes(name.toLowerCase()) ||
      e.lesseeId.toLowerCase() === name.toLowerCase()
  );
  if (!radar) return { error: `No lessee found matching "${name}"` };

  const watchlist = WATCHLIST_DATA[radar.lesseeId];
  const deals = DEAL_FEED.filter((d) =>
    d.affectedLesseeNames.some((n) =>
      n.toLowerCase().includes(radar.lesseeName.toLowerCase().split(" ")[0])
    )
  );

  return {
    lesseeId: radar.lesseeId,
    lesseeName: radar.lesseeName,
    country: radar.country,
    stage: radar.stage,
    exposureUSD: radar.exposureUSD,
    compositeSignal: radar.compositeSignal,
    compositeScore: radar.compositeScore,
    signals: {
      loadFactor: radar.loadFactor,
      scheduleStability: radar.scheduleStability,
      fuelCostStress: radar.fuelCostStress,
      revLeaseRatio: radar.revLeaseRatio,
    },
    watchlist: watchlist
      ? {
          status: watchlist.status,
          score: watchlist.score,
          trigger: watchlist.trigger,
          reason: watchlist.reason,
          recentAudit: watchlist.auditLog.slice(-3),
        }
      : null,
    recentDeals: deals.slice(0, 3).map((d) => ({
      headline: d.headline,
      sentiment: d.sentiment,
      hoursAgo: d.hoursAgo,
    })),
  };
}

function execGetLeasesByFilter(filters: {
  stage?: string;
  jurisdiction?: string;
  expiryBefore?: string;
  lesseeId?: string;
}): ToolResult {
  let leases = [...MOCK_LEASES];
  if (filters.stage) leases = leases.filter((l) => l.stage === filters.stage);
  if (filters.jurisdiction)
    leases = leases.filter((l) =>
      l.jurisdiction.toLowerCase().includes(filters.jurisdiction!.toLowerCase())
    );
  if (filters.expiryBefore)
    leases = leases.filter((l) => l.expiryDate < filters.expiryBefore!);
  if (filters.lesseeId)
    leases = leases.filter(
      (l) => l.lesseeId.toLowerCase() === filters.lesseeId!.toLowerCase()
    );

  return {
    count: leases.length,
    leases: leases.map((l) => ({
      leaseId: l.leaseId,
      lesseeName: l.lesseeName,
      aircraft: l.aircraft,
      msn: l.msn,
      expiryDate: l.expiryDate,
      stage: l.stage,
      jurisdiction: l.jurisdiction,
      monthlyRentUSD: l.monthlyRentUSD,
    })),
  };
}

function execGetMarketSignals(category: string): ToolResult {
  const signals =
    category === "all"
      ? MACRO_SIGNALS
      : MACRO_SIGNALS.filter((s) => s.category === category);

  const jxEvents =
    category === "all"
      ? JURISDICTION_EVENTS.slice(0, 4).map((e) => ({
          jurisdiction: e.jurisdiction,
          eventType: e.eventType,
          headline: e.headline,
          sentiment: e.sentiment,
          portfolioExposureUSD: e.portfolioExposureUSD,
        }))
      : [];

  return {
    signals: signals.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      severity: s.severity,
      currentValue: s.currentValue,
      changeLabel: s.changeLabel,
      eclImpactUSD: s.eclImpactUSD,
      eclImpactDir: s.eclImpactDir,
      affectedLessees: s.affectedLessees.map((a) => ({
        name: a.name,
        stage: a.stage,
        exposureUSD: a.exposureUSD,
      })),
      portfolioNarrative: s.portfolioNarrative,
    })),
    jurisdictionEvents: jxEvents,
  };
}

function execGetScenarioResult(scenarioName: string): ToolResult {
  const run = MOCK_SCENARIO_RUNS.find((r) =>
    r.name.toLowerCase().includes(scenarioName.toLowerCase())
  );

  if (!run) {
    return {
      error: `No scenario found matching "${scenarioName}". Known scenarios: ${MOCK_SCENARIO_RUNS.map((r) => r.name).join(", ")}.`,
    };
  }

  const ecl = computeECL(run.inputs);
  const stages = computeStages(ecl, run.inputs);

  return {
    name: run.name,
    runDate: run.runDate,
    eclUSD_m: Math.round(ecl * 10) / 10,
    stages: {
      s1_USD_m: Math.round(stages.s1 * 10) / 10,
      s2_USD_m: Math.round(stages.s2 * 10) / 10,
      s3_USD_m: Math.round(stages.s3 * 10) / 10,
    },
    inputs: run.inputs,
  };
}
