// api/cron/news-signals.ts
//
// Polish — hourly per-lessee news risk scoring. Replaces the
// insolvency_filed proxy used by the watchlist evaluator with a real
// signal derived from NewsAPI headlines + descriptions.
//
// Scoring:
//   For each lessee, count matches in the last N articles where the
//   article text contains the lessee's name OR any token of it
//   (excluding short stop-words). Each match contributes a weight
//   based on sentiment + a fixed multiplier for distress keywords.
//
//   total_weight = Σ (
//     sentiment === "negative" ? 30 :
//     distress keyword present  ? 25 :
//     sentiment === "neutral"   ?  5 :
//     /* positive */              -5
//   )
//
//   score = clamp(total_weight, 0, 100)
//
// We persist score + keyword_hits + an articles JSONB array so a future
// per-lessee panel can show evidence on click.

// nodejs runtime — daily cron, no latency need. Also keeps the chunk
// shared with api/signals/news (also nodejs) consistent: when the cron
// was edge the bundler chunked the 6 news adapters for an edge target
// and the request handler failed with FUNCTION_INVOCATION_FAILED at
// cold start.
export const config = { runtime: "nodejs" };

// Reverted to single-source NewsAPI on 2026-05-30 (see comment in
// ../signals/news.ts). Multi-source aggregator pending Vercel runtime
// debugging.
import { fetchAviationNews, type NewsArticleRaw } from "../signals/_lib/newsapi.js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SRV = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const NEWSAPI_KEY  = process.env.NEWSAPI_KEY ?? "";
const CRON_SECRET  = process.env.CRON_SECRET ?? "";

const DISTRESS_RE = /bankrupt|insolvency|chapter 11|liquidat|distress|default(?:ed)?|debt crisis|receivership|sanction|grounded|chapter\s*15/i;
const POSITIVE_RE = /profit|growth|record|strong|upgrad|expand|surge|award/i;
const NEGATIVE_RE = /loss|downgrad|cut|crisis|warning|concern|struggle|plunge/i;

interface LesseeRow { id: string; org_id: string; name: string }

async function sbSelect<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SRV, Authorization: `Bearer ${SUPABASE_SRV}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`sbSelect ${path}: ${res.status}`);
  return (await res.json()) as T[];
}

async function sbUpsert(rows: Array<Record<string, unknown>>): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_signals?on_conflict=org_id,lessee_id`, {
    method: "POST",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type":"application/json",
      Prefer:        "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`sbUpsert news_signals: ${res.status} ${await res.text()}`);
}

// Drop short generic tokens — "the", "Air", "Group" produce false hits.
const STOP_TOKENS = new Set(["the", "a", "of", "and", "group", "co", "ltd", "plc", "inc", "air", "lines", "airlines"]);

function lesseeMatchTokens(name: string): string[] {
  const toks = name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !STOP_TOKENS.has(t));
  // Always include the full name lowercased as a fallback.
  return Array.from(new Set([name.toLowerCase(), ...toks]));
}

function scoreArticleForLessee(a: NewsArticleRaw, tokens: string[]): { hit: boolean; weight: number } {
  const text = `${a.title} ${a.content}`.toLowerCase();
  const hit  = tokens.some((t) => t && text.includes(t));
  if (!hit) return { hit: false, weight: 0 };
  if (DISTRESS_RE.test(text)) return { hit: true, weight: 30 };
  if (NEGATIVE_RE.test(text)) return { hit: true, weight: 20 };
  if (POSITIVE_RE.test(text)) return { hit: true, weight: -5 };
  return { hit: true, weight: 5 };
}

interface ArticleEvidence {
  title:       string;
  source:      string;
  url:         string;
  publishedAt: string;
  weight:      number;
}

async function processOrg(orgId: string, articles: NewsArticleRaw[]): Promise<{ lessees: number; written: number }> {
  if (articles.length === 0) return { lessees: 0, written: 0 };
  const lessees = await sbSelect<LesseeRow>(
    `lessees?org_id=eq.${orgId}&select=id,org_id,name`,
  );
  if (lessees.length === 0) return { lessees: 0, written: 0 };

  const rows: Array<Record<string, unknown>> = [];
  for (const l of lessees) {
    const tokens = lesseeMatchTokens(l.name);
    let total = 0;
    let hits  = 0;
    const evidence: ArticleEvidence[] = [];
    for (const a of articles) {
      const { hit, weight } = scoreArticleForLessee(a, tokens);
      if (hit) {
        hits++;
        total += weight;
        if (evidence.length < 5) {
          evidence.push({ title: a.title, source: a.source, url: a.url, publishedAt: a.publishedAt, weight });
        }
      }
    }
    const score = Math.max(0, Math.min(100, total));
    rows.push({
      org_id:        orgId,
      lessee_id:     l.id,
      score,
      keyword_hits:  hits,
      articles:      evidence,
      evaluated_at:  new Date().toISOString(),
    });
  }
  await sbUpsert(rows);
  return { lessees: lessees.length, written: rows.length };
}

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
  if (!NEWSAPI_KEY) {
    return new Response(JSON.stringify({ skipped: true, reason: "NEWSAPI_KEY not set" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }

  try {
    const articles = await fetchAviationNews(NEWSAPI_KEY, 100);
    const orgIds = Array.from(new Set(
      (await sbSelect<{ org_id: string }>(`lessees?select=org_id`)).map((r) => r.org_id),
    ));
    const summary: Array<Record<string, unknown>> = [];
    for (const orgId of orgIds) {
      try {
        const r = await processOrg(orgId, articles);
        summary.push({ orgId, ...r });
      } catch (err) {
        summary.push({ orgId, error: (err as Error).message });
      }
    }
    return new Response(JSON.stringify({ articles: articles.length, orgs: orgIds.length, results: summary }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

import { withSentry as _ws_ns } from "../_lib/sentry.js";
export default _ws_ns(_handler, "cron:news-signals");
