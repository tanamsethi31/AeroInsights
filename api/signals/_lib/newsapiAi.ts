// api/signals/_lib/newsapiAi.ts
//
// NewsAPI.ai (EventRegistry) adapter.
// Docs: https://eventregistry.org/documentation
// Auth: POST JSON body, field `apiKey: <key>`

import type { NewsArticleRaw } from "./newsapi";

interface NewsApiAiArticle {
  uri?:        string;
  title:       string;
  body?:       string;
  url:         string;
  date?:       string;       // YYYY-MM-DD
  dateTime?:   string;       // ISO
  source?:     { title?: string; uri?: string };
}

interface NewsApiAiResponse {
  articles?: {
    results?: NewsApiAiArticle[];
    totalResults?: number;
  };
}

function parseNewsApiAi(data: NewsApiAiResponse): NewsArticleRaw[] {
  const results = data.articles?.results ?? [];
  return results
    .filter((a) => a.title && a.url)
    .map((a) => ({
      id:          a.uri ?? btoa(a.url).slice(-24).replace(/[^a-zA-Z0-9]/g, ""),
      title:       a.title,
      source:      a.source?.title ?? a.source?.uri ?? "newsapi.ai",
      url:         a.url,
      publishedAt: a.dateTime ?? (a.date ? `${a.date}T00:00:00Z` : new Date().toISOString()),
      content:     (a.body ?? "").slice(0, 500),
    }));
}

export async function fetchAviationNewsNewsApiAi(apiKey: string, count = 20): Promise<NewsArticleRaw[]> {
  if (!apiKey) return [];
  const body = {
    action:           "getArticles",
    keyword:          "aviation OR airline OR aircraft OR lessor OR leasing",
    keywordOper:      "or",
    articlesPage:     1,
    articlesCount:    count,
    articlesSortBy:   "date",
    articlesSortByAsc: false,
    resultType:       "articles",
    dataType:         ["news"],
    lang:             "eng",
    apiKey,
  };
  const res = await fetch("https://eventregistry.org/api/v1/article/getArticles", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`newsapi.ai: HTTP ${res.status}`);
  return parseNewsApiAi(await res.json() as NewsApiAiResponse);
}

export const __test__ = { parseNewsApiAi };
