// api/excel/[fn].ts
//
// T-5.5 — Single edge dispatcher backing the Excel add-in's 20 custom
// functions. Vercel routes `/api/excel/ecl` to this file with `fn` =
// 'ecl' via the dynamic [fn] segment.
//
// Auth: same Auth0 bearer token the main app uses. We verify it against
// the JWKS, look up the user's org via service-role REST, and scope
// every query by org_id. Lessees/leases/assets identifiers in the
// add-in are TEXT (external_id, lessee_id, MSN) — we resolve to uuids
// on the server.
//
// Every handler returns the exact JSON shape that functions.js reads:
//   { ecl: number }, { stage: number }, { lgd: number }, etc.
//
// Unknown fn → 404. NOT_FOUND for any row miss (the add-in renders
// "#AERINSIGHTS - NOT FOUND").

export const config = { runtime: "edge" };

import { verifyAuth0Token } from "../_lib/auth0";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SRV = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// ── REST helpers ──────────────────────────────────────────────────────

async function sbSelect<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      Accept:        "application/json",
    },
  });
  if (!res.ok) throw new Error(`sbSelect ${path}: ${res.status}`);
  return (await res.json()) as T[];
}

async function resolveOrgId(authSub: string): Promise<string | null> {
  const rows = await sbSelect<{ org_id: string }>(
    `org_members?user_id=eq.${encodeURIComponent(authSub)}&select=org_id&limit=1`,
  );
  return rows[0]?.org_id ?? null;
}

// ── Response helpers ──────────────────────────────────────────────────

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
function notFound(): Response {
  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404, headers: { "content-type": "application/json" },
  });
}
function unauth(msg = "unauthorised"): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401, headers: { "content-type": "application/json" },
  });
}

// ── Function handlers ─────────────────────────────────────────────────

interface ProvisionRow {
  asset_id: string;
  ead: number | null; ecl_12m: number | null; ecl_lifetime: number | null;
  pd_12m: number | null; pd_lifetime: number | null; lgd: number | null;
  stage: number | null;
}

async function leaseProvision(orgId: string, leaseExtId: string): Promise<ProvisionRow | null> {
  const leases = await sbSelect<{ asset_id: string }>(
    `leases?org_id=eq.${orgId}&external_id=eq.${encodeURIComponent(leaseExtId)}&select=asset_id&limit=1`,
  );
  const assetId = leases[0]?.asset_id;
  if (!assetId) return null;
  const provs = await sbSelect<ProvisionRow>(
    `provisions?org_id=eq.${orgId}&asset_id=eq.${assetId}&select=asset_id,ead,ecl_12m,ecl_lifetime,pd_12m,pd_lifetime,lgd,stage&limit=1`,
  );
  return provs[0] ?? null;
}

async function handleEcl(orgId: string, params: URLSearchParams): Promise<Response> {
  const leaseId = params.get("lease_id");
  if (!leaseId) return notFound();
  const p = await leaseProvision(orgId, leaseId);
  if (!p) return notFound();
  // Scenario param is ignored in v1 — we always return the live lifetime
  // ECL. Scenario-specific ECL requires running the scenario engine
  // which is a separate slice.
  const ecl = (p.ecl_lifetime ?? p.ecl_12m ?? 0) / 1e6;
  return ok({ ecl });
}

async function handleStage(orgId: string, params: URLSearchParams): Promise<Response> {
  const leaseId = params.get("lease_id");
  if (!leaseId) return notFound();
  const rows = await sbSelect<{ stage: number | null }>(
    `leases?org_id=eq.${orgId}&external_id=eq.${encodeURIComponent(leaseId)}&select=stage&limit=1`,
  );
  if (rows.length === 0) return notFound();
  return ok({ stage: rows[0].stage ?? 1 });
}

async function handleLgd(orgId: string, params: URLSearchParams): Promise<Response> {
  const leaseId = params.get("lease_id");
  if (!leaseId) return notFound();
  const p = await leaseProvision(orgId, leaseId);
  if (!p) return notFound();
  return ok({ lgd: Number(p.lgd ?? 0) / 100 });
}

async function handlePd(orgId: string, params: URLSearchParams): Promise<Response> {
  const leaseId = params.get("lease_id");
  if (!leaseId) return notFound();
  const horizon = params.get("horizon") ?? "12m";
  const p = await leaseProvision(orgId, leaseId);
  if (!p) return notFound();
  const pdVal = horizon === "lifetime"
    ? (p.pd_lifetime ?? p.pd_12m ?? 0)
    : (p.pd_12m ?? 0);
  return ok({ pd: Number(pdVal) / 100 });
}

async function handleEad(orgId: string, params: URLSearchParams): Promise<Response> {
  const leaseId = params.get("lease_id");
  if (!leaseId) return notFound();
  const p = await leaseProvision(orgId, leaseId);
  if (!p) return notFound();
  return ok({ ead: Number(p.ead ?? 0) / 1e6 });
}

async function handlePortfolioEcl(orgId: string): Promise<Response> {
  const provs = await sbSelect<{ ecl_lifetime: number | null }>(
    `provisions?org_id=eq.${orgId}&select=ecl_lifetime`,
  );
  const total = provs.reduce((s, r) => s + Number(r.ecl_lifetime ?? 0), 0);
  return ok({ ecl: total / 1e6 });
}

async function handleMrBalance(orgId: string, params: URLSearchParams): Promise<Response> {
  const leaseId = params.get("lease_id");
  if (!leaseId) return notFound();
  // Resolve lease external_id → lease uuid.
  const leases = await sbSelect<{ id: string }>(
    `leases?org_id=eq.${orgId}&external_id=eq.${encodeURIComponent(leaseId)}&select=id&limit=1`,
  );
  if (leases.length === 0) return notFound();
  const rows = await sbSelect<{ balance_usd: number | null }>(
    `maintenance_reserves?org_id=eq.${orgId}&lease_id=eq.${leases[0].id}&select=balance_usd`,
  );
  const total = rows.reduce((s, r) => s + Number(r.balance_usd ?? 0), 0);
  return ok({ balance: total / 1e6 });
}

async function handleSd(orgId: string, params: URLSearchParams): Promise<Response> {
  const leaseId = params.get("lease_id");
  if (!leaseId) return notFound();
  const leases = await sbSelect<{ id: string }>(
    `leases?org_id=eq.${orgId}&external_id=eq.${encodeURIComponent(leaseId)}&select=id&limit=1`,
  );
  if (leases.length === 0) return notFound();
  const rows = await sbSelect<{ amount_usd: number | null }>(
    `security_deposits?org_id=eq.${orgId}&lease_id=eq.${leases[0].id}&select=amount_usd&limit=1`,
  );
  if (rows.length === 0) return notFound();
  return ok({ amount: Number(rows[0].amount_usd ?? 0) / 1e6 });
}

async function handleMrShortfall(orgId: string, params: URLSearchParams): Promise<Response> {
  // Without a forward MR forecast model on the server, return 0
  // (no shortfall) when MR balance is positive. Real forecast comes
  // with a follow-up slice.
  const leaseId = params.get("lease_id");
  if (!leaseId) return notFound();
  const leases = await sbSelect<{ id: string }>(
    `leases?org_id=eq.${orgId}&external_id=eq.${encodeURIComponent(leaseId)}&select=id&limit=1`,
  );
  if (leases.length === 0) return notFound();
  const rows = await sbSelect<{ balance_usd: number | null }>(
    `maintenance_reserves?org_id=eq.${orgId}&lease_id=eq.${leases[0].id}&select=balance_usd`,
  );
  const bal = rows.reduce((s, r) => s + Number(r.balance_usd ?? 0), 0);
  return ok({ shortfall: bal > 0 ? 0 : Math.abs(bal) / 1e6 });
}

async function handleRepossession(orgId: string, params: URLSearchParams): Promise<Response> {
  const code = params.get("jurisdiction");
  const pct  = params.get("percentile") ?? "50";
  if (!code) return notFound();
  const rows = await sbSelect<{ p50_reposs_months: number | null; p90_reposs_months: number | null }>(
    `jurisdiction_lgd_overlays?org_id=eq.${orgId}&code=eq.${encodeURIComponent(code)}&select=p50_reposs_months,p90_reposs_months&limit=1`,
  );
  if (rows.length === 0) return notFound();
  const months = pct === "90" ? rows[0].p90_reposs_months : rows[0].p50_reposs_months;
  if (months == null) return notFound();
  return ok({ months });
}

async function handleRepossessionCost(orgId: string, params: URLSearchParams): Promise<Response> {
  const code = params.get("jurisdiction");
  if (!code) return notFound();
  const rows = await sbSelect<{ p50_cost_pct: number | null }>(
    `jurisdiction_lgd_overlays?org_id=eq.${orgId}&code=eq.${encodeURIComponent(code)}&select=p50_cost_pct&limit=1`,
  );
  if (rows.length === 0 || rows[0].p50_cost_pct == null) return notFound();
  return ok({ cost_pct: Number(rows[0].p50_cost_pct) });
}

async function handleCtcScore(orgId: string, params: URLSearchParams): Promise<Response> {
  const code = params.get("jurisdiction");
  if (!code) return notFound();
  const rows = await sbSelect<{ ctc_score: number | null }>(
    `jurisdiction_lgd_overlays?org_id=eq.${orgId}&code=eq.${encodeURIComponent(code)}&select=ctc_score&limit=1`,
  );
  if (rows.length === 0 || rows[0].ctc_score == null) return notFound();
  return ok({ score: Number(rows[0].ctc_score) });
}

async function handleBehaviorScore(orgId: string, params: URLSearchParams): Promise<Response> {
  const lesseeId = params.get("lessee_id");
  if (!lesseeId) return notFound();
  // Accept either uuid or name (case-insensitive). Try uuid first.
  let rows = await sbSelect<{ overall_behaviour_score: number | null }>(
    `lessees?org_id=eq.${orgId}&id=eq.${encodeURIComponent(lesseeId)}&select=overall_behaviour_score&limit=1`,
  );
  if (rows.length === 0) {
    rows = await sbSelect<{ overall_behaviour_score: number | null }>(
      `lessees?org_id=eq.${orgId}&name=ilike.${encodeURIComponent(lesseeId)}&select=overall_behaviour_score&limit=1`,
    );
  }
  if (rows.length === 0 || rows[0].overall_behaviour_score == null) return notFound();
  return ok({ score: Number(rows[0].overall_behaviour_score) });
}

async function handleWatchlist(orgId: string, params: URLSearchParams): Promise<Response> {
  const lesseeId = params.get("lessee_id");
  if (!lesseeId) return notFound();
  let entries = await sbSelect<{ status: string }>(
    `watchlist_entries?org_id=eq.${orgId}&lessee_id=eq.${encodeURIComponent(lesseeId)}&select=status&limit=1`,
  );
  if (entries.length === 0) {
    // Fallback: name lookup → uuid → status.
    const lessees = await sbSelect<{ id: string; watchlist_status: string | null }>(
      `lessees?org_id=eq.${orgId}&name=ilike.${encodeURIComponent(lesseeId)}&select=id,watchlist_status&limit=1`,
    );
    if (lessees.length === 0) return notFound();
    const status = lessees[0].watchlist_status ?? "green";
    return ok({ status: status.toUpperCase() });
  }
  return ok({ status: entries[0].status.toUpperCase() });
}

async function handleLesseeStage(orgId: string, params: URLSearchParams): Promise<Response> {
  const lesseeId = params.get("lessee_id");
  if (!lesseeId) return notFound();
  // Resolve uuid (accept uuid or name).
  let uuid = lesseeId;
  if (!/^[0-9a-f-]{36}$/i.test(lesseeId)) {
    const ls = await sbSelect<{ id: string }>(
      `lessees?org_id=eq.${orgId}&name=ilike.${encodeURIComponent(lesseeId)}&select=id&limit=1`,
    );
    if (ls.length === 0) return notFound();
    uuid = ls[0].id;
  }
  const leases = await sbSelect<{ stage: number | null }>(
    `leases?org_id=eq.${orgId}&lessee_id=eq.${uuid}&select=stage`,
  );
  if (leases.length === 0) return notFound();
  const worst = leases.reduce((mx, r) => Math.max(mx, r.stage ?? 1), 1);
  return ok({ stage: worst });
}

async function handleLesseeEcl(orgId: string, params: URLSearchParams): Promise<Response> {
  const lesseeId = params.get("lessee_id");
  if (!lesseeId) return notFound();
  let uuid = lesseeId;
  if (!/^[0-9a-f-]{36}$/i.test(lesseeId)) {
    const ls = await sbSelect<{ id: string }>(
      `lessees?org_id=eq.${orgId}&name=ilike.${encodeURIComponent(lesseeId)}&select=id&limit=1`,
    );
    if (ls.length === 0) return notFound();
    uuid = ls[0].id;
  }
  const leases = await sbSelect<{ asset_id: string }>(
    `leases?org_id=eq.${orgId}&lessee_id=eq.${uuid}&select=asset_id`,
  );
  const assetIds = leases.map((l) => l.asset_id);
  if (assetIds.length === 0) return notFound();
  const provs = await sbSelect<{ ecl_lifetime: number | null }>(
    `provisions?org_id=eq.${orgId}&asset_id=in.(${assetIds.map(encodeURIComponent).join(",")})&select=ecl_lifetime`,
  );
  const total = provs.reduce((s, r) => s + Number(r.ecl_lifetime ?? 0), 0);
  return ok({ ecl: total / 1e6 });
}

async function handleMarketValue(orgId: string, params: URLSearchParams): Promise<Response> {
  const msn = params.get("msn");
  if (!msn) return notFound();
  const rows = await sbSelect<{ current_mv_usd: number | null }>(
    `assets?org_id=eq.${orgId}&msn=eq.${encodeURIComponent(msn)}&select=current_mv_usd&limit=1`,
  );
  if (rows.length === 0 || rows[0].current_mv_usd == null) return notFound();
  return ok({ value: Number(rows[0].current_mv_usd) / 1e6 });
}

async function handleEncumberedValue(orgId: string, params: URLSearchParams): Promise<Response> {
  // LEV ≈ market value × utilisation factor 0.8 until a proper LEV model
  // lands. The add-in still gets a non-zero number from real DB data.
  const msn = params.get("msn");
  if (!msn) return notFound();
  const rows = await sbSelect<{ current_mv_usd: number | null }>(
    `assets?org_id=eq.${orgId}&msn=eq.${encodeURIComponent(msn)}&select=current_mv_usd&limit=1`,
  );
  if (rows.length === 0 || rows[0].current_mv_usd == null) return notFound();
  return ok({ value: (Number(rows[0].current_mv_usd) * 0.8) / 1e6 });
}

async function handleKpi(orgId: string, params: URLSearchParams): Promise<Response> {
  const metric = params.get("metric");
  if (!metric) return notFound();
  switch (metric) {
    case "portfolio_ecl": {
      const provs = await sbSelect<{ ecl_lifetime: number | null }>(
        `provisions?org_id=eq.${orgId}&select=ecl_lifetime`,
      );
      return ok({ value: provs.reduce((s, r) => s + Number(r.ecl_lifetime ?? 0), 0) / 1e6 });
    }
    case "book_value": {
      const assets = await sbSelect<{ current_mv_usd: number | null }>(
        `assets?org_id=eq.${orgId}&select=current_mv_usd`,
      );
      return ok({ value: assets.reduce((s, r) => s + Number(r.current_mv_usd ?? 0), 0) / 1e6 });
    }
    case "encumbered_value": {
      const assets = await sbSelect<{ current_mv_usd: number | null }>(
        `assets?org_id=eq.${orgId}&select=current_mv_usd`,
      );
      return ok({ value: assets.reduce((s, r) => s + Number(r.current_mv_usd ?? 0) * 0.8, 0) / 1e6 });
    }
    case "watchlist_red_count": {
      const rows = await sbSelect<{ id: string }>(
        `watchlist_entries?org_id=eq.${orgId}&status=eq.red&select=id`,
      );
      return ok({ value: rows.length });
    }
    case "watchlist_amber_count": {
      const rows = await sbSelect<{ id: string }>(
        `watchlist_entries?org_id=eq.${orgId}&status=eq.amber&select=id`,
      );
      return ok({ value: rows.length });
    }
    case "ecl_rate": {
      const provs = await sbSelect<{ ecl_lifetime: number | null }>(`provisions?org_id=eq.${orgId}&select=ecl_lifetime`);
      const assets = await sbSelect<{ current_mv_usd: number | null }>(`assets?org_id=eq.${orgId}&select=current_mv_usd`);
      const ecl = provs.reduce((s, r) => s + Number(r.ecl_lifetime ?? 0), 0);
      const bv  = assets.reduce((s, r) => s + Number(r.current_mv_usd ?? 0), 0);
      return ok({ value: bv > 0 ? ecl / bv : 0 });
    }
    case "avg_lease_term": {
      const leases = await sbSelect<{ start_date: string; end_date: string }>(
        `leases?org_id=eq.${orgId}&select=start_date,end_date`,
      );
      const months = leases
        .map((l) => (new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / (30.44 * 86400000))
        .filter((m) => isFinite(m) && m > 0);
      const avg = months.length ? months.reduce((a, b) => a + b, 0) / months.length : 0;
      return ok({ value: Math.round(avg * 10) / 10 });
    }
    default: return notFound();
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Auth.
  const authHeader = req.headers.get("authorization") ?? "";
  const m = authHeader.match(/^Bearer\s+(.+)$/);
  if (!m) return unauth("missing_token");
  const payload = await verifyAuth0Token(m[1]);
  if (!payload) return unauth("invalid_token");

  // Org resolution.
  let orgId = typeof payload.org_id === "string" ? (payload.org_id as string) : null;
  if (!orgId) orgId = await resolveOrgId(payload.sub);
  if (!orgId) return unauth("no_org");

  // fn lookup — the last path segment after /api/excel/.
  const url = new URL(req.url);
  const fn  = url.pathname.split("/").pop() ?? "";
  const params = url.searchParams;

  try {
    switch (fn) {
      case "ecl":               return await handleEcl(orgId, params);
      case "stage":             return await handleStage(orgId, params);
      case "lgd":               return await handleLgd(orgId, params);
      case "pd":                return await handlePd(orgId, params);
      case "ead":               return await handleEad(orgId, params);
      case "portfolio-ecl":     return await handlePortfolioEcl(orgId);
      case "mr-balance":        return await handleMrBalance(orgId, params);
      case "sd":                return await handleSd(orgId, params);
      case "mr-shortfall":      return await handleMrShortfall(orgId, params);
      case "repossession":      return await handleRepossession(orgId, params);
      case "repossession-cost": return await handleRepossessionCost(orgId, params);
      case "ctc-score":         return await handleCtcScore(orgId, params);
      case "behavior-score":    return await handleBehaviorScore(orgId, params);
      case "watchlist":         return await handleWatchlist(orgId, params);
      case "lessee-stage":      return await handleLesseeStage(orgId, params);
      case "lessee-ecl":        return await handleLesseeEcl(orgId, params);
      case "market-value":      return await handleMarketValue(orgId, params);
      case "encumbered-value":  return await handleEncumberedValue(orgId, params);
      case "kpi":               return await handleKpi(orgId, params);
      default:                  return notFound();
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}
