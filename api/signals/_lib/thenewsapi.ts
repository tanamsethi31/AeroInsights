// api/signals/_lib/thenewsapi.ts
//
// thenewsapi.com adapter.
// Docs: https://www.thenewsapi.com/documentation
// Auth: query string `api_token=<key>`
// Endpoint: /v1/news/all?search=<q>&language=en&limit=<n>

import type { NewsArticleRaw } from "./newsapi.js";

interface TheNewsApiArticle {
  uuid:          string;
  title:         string;
  description?:  string | null;
  snippet?:      string | null;
  url:           string;
  published_at:  string;
  source?:       string;
}

interface TheNewsApiResponse {
  data?:         TheNewsApiArticle[];
  meta?:         { found?: number; returned?: number };
}

function parseTheNewsApi(data: TheNewsApiResponse): NewsArticleRaw[] {
  const results = data.data ?? [];
  return results
    .filter((a) => a.title && a.url)
    .map((a) => ({
      id:          a.uuid,
      title:       a.title,
      source:      a.source ?? "thenewsapi.com",
      url:         a.url,
      publishedAt: a.published_at,
      content:     (a.description ?? a.snippet ?? "").slice(0, 500),
    }));
}

export async function fetchAviationNewsTheNewsApi(apiKey: string, count = 20): Promise<NewsArticleRaw[]> {
  if (!apiKey) return [];
  const params = new URLSearchParams({
    api_token: apiKey,
    search:    "aviation | airline | aircraft | lessor | leasing",
    language:  "en",
    limit:     String(Math.min(count, 100)),
    sort:      "published_at",
  });
  const res = await fetch(`https://api.thenewsapi.com/v1/news/all?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`thenewsapi: HTTP ${res.status}`);
  return parseTheNewsApi(await res.json() as TheNewsApiResponse);
}

export const __test__ = { parseTheNewsApi };
