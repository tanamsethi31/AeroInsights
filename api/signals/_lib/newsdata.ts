// api/signals/_lib/newsdata.ts
//
// newsdata.io adapter.
// Docs: https://newsdata.io/documentation
// Auth: query string `apikey=<key>`
// Endpoint: /api/1/news?q=<q>&language=en

import type { NewsArticleRaw } from "./newsapi";

interface NewsdataResult {
  article_id:   string;
  title:        string;
  link:         string;
  description?: string | null;
  content?:     string | null;
  pubDate:      string;
  source_id?:   string;
  source_name?: string;
}

interface NewsdataResponse {
  status?:      string;
  results?:     NewsdataResult[];
}

function parseNewsdata(data: NewsdataResponse): NewsArticleRaw[] {
  if (data.status && data.status !== "success") return [];
  const results = data.results ?? [];
  return results
    .filter((r) => r.title && r.link)
    .map((r) => ({
      id:          r.article_id,
      title:       r.title,
      source:      r.source_name ?? r.source_id ?? "newsdata.io",
      url:         r.link,
      publishedAt: r.pubDate,
      content:     (r.description ?? r.content ?? "").slice(0, 500),
    }));
}

export async function fetchAviationNewsNewsdata(apiKey: string, _count = 20): Promise<NewsArticleRaw[]> {
  if (!apiKey) return [];
  // newsdata.io free tier returns 10 results per page by default; size param is
  // a paid feature, so we accept whatever the page returns.
  void _count;
  const params = new URLSearchParams({
    apikey:   apiKey,
    q:        "aviation OR airline OR aircraft OR lessor",
    language: "en",
    category: "business",
  });
  const res = await fetch(`https://newsdata.io/api/1/news?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`newsdata.io: HTTP ${res.status}`);
  return parseNewsdata(await res.json() as NewsdataResponse);
}

export const __test__ = { parseNewsdata };
