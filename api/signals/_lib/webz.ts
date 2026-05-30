// api/signals/_lib/webz.ts
//
// Webz.io News API Lite adapter.
// Docs: https://docs.webz.io/reference/news-api-lite
// Auth: query string `token=<apiKey>`
// Query: ?q=<full-text>&size=<n>&sort=published

import type { NewsArticleRaw } from "./newsapi";

interface WebzPost {
  uuid?:        string;
  title:        string;
  text?:        string;
  url:          string;
  published:    string;
  thread?:      { site_full?: string; site?: string };
}

interface WebzResponse {
  posts?:       WebzPost[];
  totalResults?: number;
}

function parseWebz(data: WebzResponse): NewsArticleRaw[] {
  if (!data.posts) return [];
  return data.posts
    .filter((p) => p.title && p.url)
    .map((p) => ({
      id:          p.uuid ?? btoa(p.url).slice(-24).replace(/[^a-zA-Z0-9]/g, ""),
      title:       p.title,
      source:      p.thread?.site_full ?? p.thread?.site ?? "webz.io",
      url:         p.url,
      publishedAt: p.published,
      content:     (p.text ?? "").slice(0, 500),
    }));
}

export async function fetchAviationNewsWebz(apiKey: string, count = 20): Promise<NewsArticleRaw[]> {
  if (!apiKey) return [];
  const params = new URLSearchParams({
    token: apiKey,
    q: "aviation OR airline OR aircraft OR lessor OR leasing",
    size: String(count),
    sort: "published",
  });
  const res = await fetch(`https://api.webz.io/newsApiLite?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`webz.io: HTTP ${res.status}`);
  return parseWebz(await res.json() as WebzResponse);
}

// Exported for unit tests.
export const __test__ = { parseWebz };
