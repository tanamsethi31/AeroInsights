// api/cron/watchlist.ts
//
// T-5.3 — Watchlist rule engine cron. Runs every 30 minutes (see
// vercel.json). For every org with at least one portfolio + one lessee:
//
//   1. Load watchlist_config (or fall back to defaults if missing).
//   2. Snapshot lessees ingested columns.
//   3. evaluateLessees() → per-lessee status + score + signals.
//   4. Upsert watchlist_entries (current state).
//   5. When status transitions, write an audit_log row and sync
//      lessees.watchlist_status so existing dashboards stay coherent.
//
// Bypasses RLS with service-role key. All filtering is explicit on org_id.

export const config = { runtime: "edge" };

import {
  evaluateLessees,
  DEFAULT_WATCHLIST_WEIGHTS,
  DEFAULT_WATCHLIST_THRESHOLDS,
  type WatchlistLesseeInput,
  type WatchlistResult,
  type WatchlistWeights,
  type WatchlistThresholds,
} from "../_lib/watchlistEvaluator";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SRV = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const CRON_SECRET  = process.env.CRON_SECRET ?? "";

// ── REST helpers ──────────────────────────────────────────────────────

async function sbSelect<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      Accept:        "application/json",
    },
  });
  if (!res.ok) throw new Error(`sbSelect ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

async function sbUpsert(path: string, rows: Array<Record<string, unknown>>, onConflict: string): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type":"application/json",
      Prefer:        "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`sbUpsert ${path}: ${res.status} ${await res.text()}`);
}

async function sbInsert(path: string, row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type":"application/json",
      Prefer:        "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`sbInsert ${path}: ${res.status} ${await res.text()}`);
}

async function sbPatch(path: string, row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type":"application/json",
      Prefer:        "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`sbPatch ${path}: ${res.status} ${await res.text()}`);
}

// ── Per-org processing ────────────────────────────────────────────────

interface PortfolioRow { id: string; org_id: string }

async function processPortfolio(orgId: string, portfolioId: string): Promise<{
  evaluated: number; transitions: number;
}> {
  // 1. Config — fall back to defaults if no row.
  const cfgRows = await sbSelect<{ weights: WatchlistWeights; thresholds: WatchlistThresholds }>(
    `watchlist_config?org_id=eq.${orgId}&portfolio_id=eq.${portfolioId}&select=weights,thresholds&limit=1`,
  );
  const weights    = cfgRows[0]?.weights    ?? DEFAULT_WATCHLIST_WEIGHTS;
  const thresholds = cfgRows[0]?.thresholds ?? DEFAULT_WATCHLIST_THRESHOLDS;

  // 2. Lessees snapshot. portfolio_id filter scopes to this portfolio.
  const lessees = await sbSelect<WatchlistLesseeInput & { watchlist_status: string | null }>(
    `lessees?org_id=eq.${orgId}&portfolio_id=eq.${portfolioId}` +
      `&select=id,name,country,dpd_days,rating_notches_down,country_watchlist,insolvency_filed,overall_behaviour_score,watchlist_status`,
  );
  if (lessees.length === 0) return { evaluated: 0, transitions: 0 };

  // 3. Existing entries for status-transition detection.
  const existing = await sbSelect<{ lessee_id: string; status: "green"|"amber"|"red"; score: number }>(
    `watchlist_entries?org_id=eq.${orgId}&portfolio_id=eq.${portfolioId}` +
      `&select=lessee_id,status,score`,
  );
  const prevByLessee = new Map(existing.map((e) => [e.lessee_id, e]));

  // 4. News signals (polish) — feed real per-lessee scores into the
  //    newsKeywordHits signal. Missing rows fall back to the proxy.
  const newsRows = await sbSelect<{ lessee_id: string; score: number; keyword_hits: number }>(
    `news_signals?org_id=eq.${orgId}&select=lessee_id,score,keyword_hits`,
  );
  const newsByLessee = new Map(newsRows.map((r) => [r.lessee_id, { score: Number(r.score), hits: r.keyword_hits }]));

  // 5. Evaluate.
  const results = evaluateLessees(lessees, weights, thresholds, newsByLessee);

  // 5. Upsert entries.
  const now = new Date().toISOString();
  const upsertRows = results.map((r) => ({
    org_id:        orgId,
    portfolio_id:  portfolioId,
    lessee_id:     r.lessee_id,
    status:        r.status,
    score:         r.score,
    signals:       r.signals,
    triggered_by:  r.triggered_by,
    reason:        r.reason,
    evaluated_at:  now,
    updated_at:    now,
  }));
  await sbUpsert("watchlist_entries", upsertRows, "org_id,portfolio_id,lessee_id");

  // 6. Per-lessee transitions: audit_log + sync lessees.watchlist_status.
  let transitions = 0;
  for (const r of results) {
    const prev = prevByLessee.get(r.lessee_id);
    if (prev?.status === r.status) continue;
    transitions++;
    await sbInsert("audit_log", {
      org_id:       orgId,
      portfolio_id: portfolioId,
      entity_type:  "watchlist_entry",
      entity_id:    r.lessee_id,
      action:       prev ? "update" : "create",
      before:       prev ? { status: prev.status, score: prev.score } : null,
      after:        { status: r.status, score: r.score, triggered_by: r.triggered_by, reason: r.reason },
      actor:        "cron:watchlist",
    });
    // Keep legacy `lessees.watchlist_status` aligned with the engine
    // output. Existing dashboards + alert_rules.watchlist_red continue
    // to work without code changes.
    await sbPatch(`lessees?id=eq.${r.lessee_id}`, { watchlist_status: r.status });
  }

  return { evaluated: results.length, transitions };
}

// ── Handler ───────────────────────────────────────────────────────────

async function _handler(req: Request): Promise<Response> {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: "unauthorised" }), {
        status: 401, headers: { "content-type": "application/json" },
      });
    }
  }
  if (!SUPABASE_URL || !SUPABASE_SRV) {
    return new Response(JSON.stringify({ error: "supabase_not_configured" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }

  try {
    const portfolios = await sbSelect<PortfolioRow>(
      `portfolios?select=id,org_id&limit=500`,
    );
    const summary: Array<Record<string, unknown>> = [];
    for (const p of portfolios) {
      try {
        const r = await processPortfolio(p.org_id, p.id);
        summary.push({ org_id: p.org_id, portfolio_id: p.id, ...r });
      } catch (err) {
        summary.push({ org_id: p.org_id, portfolio_id: p.id, error: (err as Error).message });
      }
    }
    return new Response(JSON.stringify({ portfolios: portfolios.length, results: summary }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

import { withSentry } from "../_lib/sentry";
export default withSentry(_handler, "cron:watchlist");
