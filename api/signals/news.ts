// api/signals/news.ts
//
// Live news feed for the Intelligence page.
//
// NOTE: This endpoint reverted to single-source (newsapi.org) on
// 2026-05-30 because the multi-source aggregator path (_lib/newsAggregator)
// triggers a Vercel runtime hang we haven't been able to root-cause.
// The aggregator code is intact in _lib/ for local development +
// follow-up debugging in isolation. Switch back to the aggregator by
// replacing fetchAviationNews / fetchJurisdictionNews calls with
// fetchAviationNewsAggregate once the hang is resolved.

// Edge runtime — matches fx-refresh / other working signals routes and
// sidesteps Node ESM strict .js-extension resolution. newsapi.ts uses
// btoa (Web API, edge-compatible).
export const config = { runtime: "edge" };

import { fetchAviationNews, fetchJurisdictionNews, type NewsArticleRaw } from "./_lib/newsapi";
import { verifyAuth0Sub } from "../_lib/auth0";

const JX_COUNTRIES = ["India", "Brazil", "UAE", "Sri Lanka", "Ireland", "Singapore"];

export interface LiveNewsData {
  articles:   NewsArticleRaw[];
  jxArticles: NewsArticleRaw[];
  fetchedAt:  string;
  partial:    boolean;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth gate — endpoint burns paid NewsAPI quota, must be reachable
  // only by authenticated users.
  const auth  = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !(await verifyAuth0Sub(token))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data: LiveNewsData = {
    articles:   [],
    jxArticles: [],
    fetchedAt:  new Date().toISOString(),
    partial:    false,
  };

  const [news, jxNews] = await Promise.allSettled([
    fetchAviationNews(apiKey, 20),
    fetchJurisdictionNews(apiKey, JX_COUNTRIES, 10),
  ]);

  if (news.status === "fulfilled") data.articles = news.value;
  else data.partial = true;

  if (jxNews.status === "fulfilled") data.jxArticles = jxNews.value;
  else data.partial = true;

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
