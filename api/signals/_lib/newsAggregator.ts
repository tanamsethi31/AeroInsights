// api/signals/_lib/newsAggregator.ts
//
// Fan out to all configured news sources in parallel, dedupe results, and
// return a single sorted-by-date list. Sources that fail (rate-limited,
// 5xx, network) are dropped — the aggregate still ships from the survivors.
//
// Dedupe strategy:
//   1. Exact URL match (most reliable)
//   2. Normalised-title match (lowercased, alphanumeric-only) — catches
//      cross-source duplicates where the same wire story landed on
//      different sites under slightly different URLs.
//
// We tag each article with `_source` (the lib name) so the UI can surface
// per-source counts and the cron can weight signals by source confidence.

import type { NewsArticleRaw } from "./newsapi";
import { fetchAviationNews }            from "./newsapi";
import { fetchAviationNewsWebz }         from "./webz";
import { fetchAviationNewsNewsApiAi }    from "./newsapiAi";
import { fetchAviationNewsWorldNews }    from "./worldnews";
import { fetchAviationNewsNewsdata }     from "./newsdata";
import { fetchAviationNewsTheNewsApi }   from "./thenewsapi";

export type NewsSourceName =
  | "newsapi"
  | "webz"
  | "newsapi_ai"
  | "worldnews"
  | "newsdata"
  | "thenewsapi";

export interface NewsArticleAggregated extends NewsArticleRaw {
  _source: NewsSourceName;
}

export interface NewsAggregateResult {
  articles:       NewsArticleAggregated[];
  sourceCounts:   Record<NewsSourceName, number>;
  sourceErrors:   Partial<Record<NewsSourceName, string>>;
  totalBeforeDedupe: number;
  totalAfterDedupe:  number;
  fetchedAt:      string;
}

export interface NewsSourceKeys {
  newsapi?:     string;
  webz?:        string;
  newsapi_ai?:  string;
  worldnews?:   string;
  newsdata?:    string;
  thenewsapi?:  string;
}

// ─── Normalisers ─────────────────────────────────────────────────────────────

export function normaliseTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function normaliseUrl(url: string): string {
  // Drop query strings and trailing slashes — most wire-syndication adds
  // tracking params that differ between syndication paths for the same story.
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// ─── Aggregator core ─────────────────────────────────────────────────────────

export function dedupeArticles(articles: NewsArticleAggregated[]): NewsArticleAggregated[] {
  const seenUrls    = new Set<string>();
  const seenTitles  = new Set<string>();
  const out: NewsArticleAggregated[] = [];
  for (const a of articles) {
    const url   = normaliseUrl(a.url);
    const title = normaliseTitle(a.title);
    if (seenUrls.has(url) || (title.length > 12 && seenTitles.has(title))) continue;
    seenUrls.add(url);
    seenTitles.add(title);
    out.push(a);
  }
  return out;
}

export async function fetchAviationNewsAggregate(
  keys: NewsSourceKeys,
  countPerSource = 20,
): Promise<NewsAggregateResult> {
  const fetchers: Array<[NewsSourceName, Promise<NewsArticleRaw[]>]> = [
    ["newsapi",     keys.newsapi     ? fetchAviationNews(keys.newsapi, countPerSource)              : Promise.resolve([])],
    ["webz",        keys.webz        ? fetchAviationNewsWebz(keys.webz, countPerSource)             : Promise.resolve([])],
    ["newsapi_ai",  keys.newsapi_ai  ? fetchAviationNewsNewsApiAi(keys.newsapi_ai, countPerSource)  : Promise.resolve([])],
    ["worldnews",   keys.worldnews   ? fetchAviationNewsWorldNews(keys.worldnews, countPerSource)   : Promise.resolve([])],
    ["newsdata",    keys.newsdata    ? fetchAviationNewsNewsdata(keys.newsdata, countPerSource)     : Promise.resolve([])],
    ["thenewsapi",  keys.thenewsapi  ? fetchAviationNewsTheNewsApi(keys.thenewsapi, countPerSource) : Promise.resolve([])],
  ];

  const settled = await Promise.allSettled(fetchers.map(([, p]) => p));

  const sourceCounts = {
    newsapi: 0, webz: 0, newsapi_ai: 0, worldnews: 0, newsdata: 0, thenewsapi: 0,
  } satisfies Record<NewsSourceName, number>;
  const sourceErrors: Partial<Record<NewsSourceName, string>> = {};
  const combined: NewsArticleAggregated[] = [];

  settled.forEach((result, i) => {
    const [name] = fetchers[i];
    if (result.status === "fulfilled") {
      const tagged = result.value.map<NewsArticleAggregated>((a) => ({ ...a, _source: name }));
      combined.push(...tagged);
      sourceCounts[name] = tagged.length;
    } else {
      sourceErrors[name] = result.reason instanceof Error ? result.reason.message : String(result.reason);
    }
  });

  // Sort newest-first BEFORE dedupe so the first (kept) copy of any duplicate
  // is the freshest.
  combined.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const deduped = dedupeArticles(combined);

  return {
    articles:          deduped,
    sourceCounts,
    sourceErrors,
    totalBeforeDedupe: combined.length,
    totalAfterDedupe:  deduped.length,
    fetchedAt:         new Date().toISOString(),
  };
}

// ─── Env-var helper ─────────────────────────────────────────────────────────

export function readSourceKeysFromEnv(): NewsSourceKeys {
  return {
    newsapi:    process.env.NEWSAPI_KEY,
    webz:       process.env.WEBZ_API_KEY,
    newsapi_ai: process.env.NEWSAPI_AI_KEY,
    worldnews:  process.env.WORLDNEWS_API_KEY,
    newsdata:   process.env.NEWSDATA_API_KEY,
    thenewsapi: process.env.THENEWSAPI_KEY,
  };
}
