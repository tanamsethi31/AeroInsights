// api/signals/news.ts
//
// Live news feed for the Intelligence page. Now aggregates across up to 6
// sources (newsapi.org, webz.io, newsapi.ai, worldnewsapi.com, newsdata.io,
// thenewsapi.com) via newsAggregator.ts. Each source is optional — if its
// env-var key isn't set, the aggregator skips it. The endpoint returns
// 503/not_configured only when ALL sources are unset.

import type { NewsArticleRaw } from "./_lib/newsapi.js";
import {
  fetchAviationNewsAggregate,
  readSourceKeysFromEnv,
  type NewsSourceName,
} from "./_lib/newsAggregator.js";

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

  // DEBUG short-circuit — return key presence without calling any provider.
  // Confirms the function executes; rules out cold-start / module-load issues.
  // Remove once we've localised the hang.
  const url = new URL(req.url);
  if (url.searchParams.get("probe") === "1") {
    return new Response(JSON.stringify({
      probe: "ok",
      keysConfigured: Object.fromEntries(
        Object.entries(keys).map(([k, v]) => [k, !!v]),
      ),
      fetchedAt: new Date().toISOString(),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  let result;
  try {
    result = await fetchAviationNewsAggregate(keys, 20);
  } catch (err) {
    // Surface aggregation errors as a 500 with the message instead of letting
    // them escape as FUNCTION_INVOCATION_FAILED — debug visibility for the
    // 6-source rollout.
    return new Response(JSON.stringify({
      error:   "aggregator_failed",
      message: err instanceof Error ? err.message : String(err),
      stack:   err instanceof Error ? err.stack : null,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

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
