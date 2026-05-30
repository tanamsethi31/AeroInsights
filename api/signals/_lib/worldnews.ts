// api/signals/_lib/worldnews.ts
//
// worldnewsapi.com adapter.
// Docs: https://worldnewsapi.com/docs/
// Auth: header `x-api-key: <apiKey>`
// Endpoint: /search-news?text=<q>&language=en&number=<n>

import type { NewsArticleRaw } from "./newsapi.js";

interface WorldNewsArticle {
  id:            number;
  title:         string;
  text?:         string;
  summary?:      string;
  url:           string;
  publish_date:  string;
  source_country?: string;
  author?:       string;
}

interface WorldNewsResponse {
  news?:          WorldNewsArticle[];
  available?:     number;
  number?:        number;
}

function parseWorldNews(data: WorldNewsResponse): NewsArticleRaw[] {
  if (!data.news) return [];
  return data.news
    .filter((n) => n.title && n.url)
    .map((n) => ({
      id:          String(n.id),
      title:       n.title,
      source:      n.source_country ? `worldnewsapi (${n.source_country})` : "worldnewsapi.com",
      url:         n.url,
      publishedAt: n.publish_date,
      content:     (n.summary ?? n.text ?? "").slice(0, 500),
    }));
}

export async function fetchAviationNewsWorldNews(apiKey: string, count = 20): Promise<NewsArticleRaw[]> {
  if (!apiKey) return [];
  const params = new URLSearchParams({
    text:     "aviation OR airline OR aircraft OR lessor OR leasing",
    language: "en",
    number:   String(count),
    sort:     "publish-time",
    "sort-direction": "desc",
  });
  const res = await fetch(`https://api.worldnewsapi.com/search-news?${params}`, {
    headers: { "x-api-key": apiKey },
    signal:  AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`worldnewsapi: HTTP ${res.status}`);
  return parseWorldNews(await res.json() as WorldNewsResponse);
}

export const __test__ = { parseWorldNews };
