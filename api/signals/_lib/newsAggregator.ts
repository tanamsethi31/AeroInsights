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

import type { NewsArticleRaw } from "./newsapi.js";
import { fetchAviationNews }            from "./newsapi.js";
import { fetchAviationNewsWebz }         from "./webz.js";
import { fetchAviationNewsNewsApiAi }    from "./newsapiAi.js";
import { fetchAviationNewsWorldNews }    from "./worldnews.js";
import { fetchAviationNewsNewsdata }     from "./newsdata.js";
import { fetchAviationNewsTheNewsApi }   from "./thenewsapi.js";

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

/** Wraps a fetcher in a hard outer timeout. If the inner AbortSignal.timeout
 *  doesn't fire (some servers stream slowly without closing), this guarantees
 *  the aggregator never blocks longer than `ms`. */
function withDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms),
    ),
  ]);
}

export async function fetchAviationNewsAggregate(
  keys: NewsSourceKeys,
  countPerSource = 20,
  perSourceTimeoutMs = 8000,
): Promise<NewsAggregateResult> {
  const fetchers: Array<[NewsSourceName, Promise<NewsArticleRaw[]>]> = [
    ["newsapi",     keys.newsapi     ? withDeadline(fetchAviationNews(keys.newsapi, countPerSource),              perSourceTimeoutMs, "newsapi")     : Promise.resolve([])],
    ["webz",        keys.webz        ? withDeadline(fetchAviationNewsWebz(keys.webz, countPerSource),             perSourceTimeoutMs, "webz")        : Promise.resolve([])],
    ["newsapi_ai",  keys.newsapi_ai  ? withDeadline(fetchAviationNewsNewsApiAi(keys.newsapi_ai, countPerSource),  perSourceTimeoutMs, "newsapi_ai")  : Promise.resolve([])],
    ["worldnews",   keys.worldnews   ? withDeadline(fetchAviationNewsWorldNews(keys.worldnews, countPerSource),   perSourceTimeoutMs, "worldnews")   : Promise.resolve([])],
    ["newsdata",    keys.newsdata    ? withDeadline(fetchAviationNewsNewsdata(keys.newsdata, countPerSource),     perSourceTimeoutMs, "newsdata")    : Promise.resolve([])],
    ["thenewsapi",  keys.thenewsapi  ? withDeadline(fetchAviationNewsTheNewsApi(keys.thenewsapi, countPerSource), perSourceTimeoutMs, "thenewsapi")  : Promise.resolve([])],
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
