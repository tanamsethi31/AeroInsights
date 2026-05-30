// api/signals/news.ts
//
// Live news feed for the Intelligence page. Now aggregates across up to 6
// sources (newsapi.org, webz.io, newsapi.ai, worldnewsapi.com, newsdata.io,
// thenewsapi.com) via newsAggregator.ts. Each source is optional — if its
// env-var key isn't set, the aggregator skips it. The endpoint returns
// 503/not_configured only when ALL sources are unset.

import type { NewsArticleRaw } from "./_lib/newsapi";
import {
  fetchAviationNewsAggregate,
  readSourceKeysFromEnv,
  type NewsSourceName,
} from "./_lib/newsAggregator";

const JX_COUNTRIES = ["India", "Brazil", "UAE", "Sri Lanka", "Ireland", "Singapore"];

export interface LiveNewsData {
  articles:      NewsArticleRaw[];
  jxArticles:    NewsArticleRaw[];
  fetchedAt:     string;
  partial:       boolean;
  sourceCounts:  Record<NewsSourceName, number>;
  sourceErrors:  Partial<Record<NewsSourceName, string>>;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const keys = readSourceKeysFromEnv();
  const anyConfigured = Object.values(keys).some((v) => !!v);
  if (!anyConfigured) {
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await fetchAviationNewsAggregate(keys, 20);

  // Jurisdiction filter is now a substring match on the aggregated set —
  // cheaper than 6 separate API calls, with comparable signal quality.
  const jxNeedles = JX_COUNTRIES.map((c) => c.toLowerCase());
  const jxArticles = result.articles.filter((a) => {
    const text = `${a.title} ${a.content}`.toLowerCase();
    return jxNeedles.some((c) => text.includes(c));
  });

  const data: LiveNewsData = {
    articles:     result.articles,
    jxArticles,
    fetchedAt:    result.fetchedAt,
    partial:      Object.keys(result.sourceErrors).length > 0,
    sourceCounts: result.sourceCounts,
    sourceErrors: result.sourceErrors,
  };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
