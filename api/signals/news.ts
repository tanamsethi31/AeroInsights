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

import { fetchAviationNews, fetchJurisdictionNews, type NewsArticleRaw } from "./_lib/newsapi";

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
