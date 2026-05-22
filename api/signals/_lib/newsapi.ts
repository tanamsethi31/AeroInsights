// api/signals/_lib/newsapi.ts

export interface NewsArticleRaw {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  content: string;
}

export interface NewsApiResponse {
  status: string;
  articles: Array<{
    source: { name: string };
    title: string;
    description: string | null;
    url: string;
    publishedAt: string;
    content: string | null;
  }>;
}

type DealCategory = "financial-distress" | "fleet" | "route-network" | "regulatory" | "positive" | "sanctions";
type Sentiment = "negative" | "positive" | "neutral";
type Relevance = "high" | "medium" | "low";

const PORTFOLIO_LESSEES = ["indigo", "aeromex", "srilankan", "azul", "transatca", "emirates", "ryanair", "lufthansa", "air france"];

export function classifyCategory(title: string, content: string): DealCategory {
  const text = (title + " " + content).toLowerCase();
  if (/sanctions?|ofac|sdn\b|embargo/.test(text)) return "sanctions";
  if (/bankrupt|insolvency|chapter 11|liquidat|distress|default(?:ed)?|debt crisis|receivership/.test(text)) return "financial-distress";
  if (/fleet|aircraft order|delivery|airbus|boeing|narrowbody|widebody|A3[0-9]{2}|B7[0-9]{2}|orders.*aircraft|aircraft.*order/.test(text)) return "fleet";
  if (/route|cancel|suspend|ground|network cut|service halt/.test(text)) return "route-network";
  if (/regulat|authority|rule|ruling|court|law|penalty|fine/.test(text)) return "regulatory";
  return "positive";
}

export function classifySentiment(title: string): Sentiment {
  const t = title.toLowerCase();
  if (/loss|bankrupt|default|distress|downgrad|cut|sanction|crisis|warning|concern|struggle|plunge/.test(t)) return "negative";
  if (/profit|growth|record|strong|upgrad|expand|positive|boom|surge|award/.test(t)) return "positive";
  return "neutral";
}

export function classifyRelevance(title: string, category: DealCategory): Relevance {
  if (category === "financial-distress" || category === "sanctions") return "high";
  const t = title.toLowerCase();
  if (PORTFOLIO_LESSEES.some(l => t.includes(l))) return "high";
  if (/iata|lessor|leasing|aircraft|aviation|airline/.test(t)) return "medium";
  return "low";
}

export function parseNewsApiResponse(data: NewsApiResponse): NewsArticleRaw[] {
  if (data.status !== "ok") return [];
  return data.articles
    .filter(a => a.title && a.url && !a.title.startsWith("[Removed]"))
    .map(a => ({
      id: Buffer.from(a.url).toString("base64").slice(-24).replace(/[^a-zA-Z0-9]/g, ""),
      title: a.title,
      source: a.source.name,
      url: a.url,
      publishedAt: a.publishedAt,
      content: a.description ?? a.content ?? "",
    }));
}

export async function fetchAviationNews(apiKey: string, pageSize = 20): Promise<NewsArticleRaw[]> {
  const params = new URLSearchParams({
    q: "aviation OR airline OR aircraft OR lessor OR leasing",
    language: "en",
    sortBy: "publishedAt",
    pageSize: String(pageSize),
    apiKey,
  });
  const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`NewsAPI: HTTP ${res.status}`);
  return parseNewsApiResponse(await res.json() as NewsApiResponse);
}

export async function fetchJurisdictionNews(
  apiKey: string,
  jurisdictions: string[],
  pageSize = 10,
): Promise<NewsArticleRaw[]> {
  const jxQuery = jurisdictions.join(" OR ");
  const params = new URLSearchParams({
    q: `(aviation OR airline OR aircraft) AND (${jxQuery})`,
    language: "en",
    sortBy: "publishedAt",
    pageSize: String(pageSize),
    apiKey,
  });
  const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`NewsAPI jurisdiction: HTTP ${res.status}`);
  return parseNewsApiResponse(await res.json() as NewsApiResponse);
}
