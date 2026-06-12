// src/app/services/useNewsFeed.ts
import { useState, useEffect, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  DEAL_FEED,
  JURISDICTION_EVENTS,
  type DealItem,
  type DealCategory,
  type SignalSentiment,
  type JurisdictionEvent,
  type JxEventType,
} from "../data/intelligenceData";

interface NewsArticleRaw {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  content: string;
}

interface LiveNewsData {
  articles: NewsArticleRaw[];
  jxArticles: NewsArticleRaw[];
  fetchedAt: string;
  partial: boolean;
}

const STORAGE_KEY = "aeroinsights_news_v1";
const POLL_MS = 30 * 60 * 1000;

const PORTFOLIO_LESSEES = ["IndiGo", "Aeromexico", "SriLankan", "Azul", "Air Transat", "Emirates", "Ryanair", "Lufthansa", "Air France"];

// ── Country code map for jurisdiction events ──────────────────────────────────
const JX_CODE_MAP: Record<string, string> = {
  India: "IN", Brazil: "BR", UAE: "AE", "Sri Lanka": "LK", Ireland: "IE", Singapore: "SG",
};
const JX_EXPOSURE_MAP: Record<string, number> = {
  India: 184_000_000, Brazil: 142_000_000, UAE: 412_000_000,
  "Sri Lanka": 118_000_000, Ireland: 858_000_000, Singapore: 290_000_000,
};
const JX_LESSEES_MAP: Record<string, string[]> = {
  India: ["IndiGo"], Brazil: ["Azul"], UAE: ["Emirates"],
  "Sri Lanka": ["SriLankan Airlines"], Ireland: ["Ryanair", "Air France", "Lufthansa"],
  Singapore: ["Singapore Airlines"],
};

function classifyCategory(title: string, content: string): DealCategory {
  const text = (title + " " + content).toLowerCase();
  if (/sanctions?|ofac|sdn\b|embargo/.test(text)) return "sanctions";
  if (/bankrupt|insolvency|chapter 11|liquidat|distress|default(?:ed)?|debt crisis/.test(text)) return "financial-distress";
  if (/fleet|aircraft order|delivery|airbus|boeing|A3[0-9]{2}|B7[0-9]{2}|orders.*aircraft/.test(text)) return "fleet";
  if (/route|cancel|suspend|ground|network cut/.test(text)) return "route-network";
  if (/regulat|authority|ruling|court|fine/.test(text)) return "regulatory";
  return "positive";
}

function classifySentiment(title: string): SignalSentiment {
  const t = title.toLowerCase();
  if (/loss|bankrupt|default|distress|downgrad|sanction|crisis|warning|plunge/.test(t)) return "negative";
  if (/profit|growth|record|strong|upgrad|expand|boom|surge/.test(t)) return "positive";
  return "neutral";
}

function classifyRelevance(title: string, category: DealCategory): "high" | "medium" | "low" {
  if (category === "financial-distress" || category === "sanctions") return "high";
  const t = title.toLowerCase();
  if (PORTFOLIO_LESSEES.some(l => t.includes(l.toLowerCase()))) return "high";
  if (/iata|lessor|leasing|aircraft|aviation/.test(t)) return "medium";
  return "low";
}

function articleToDealItem(a: NewsArticleRaw): DealItem {
  const category = classifyCategory(a.title, a.content);
  const sentiment = classifySentiment(a.title);
  const relevance = classifyRelevance(a.title, category);
  const publishedAt = new Date(a.publishedAt);
  const hoursAgo = Math.round((Date.now() - publishedAt.getTime()) / 3_600_000);
  const affectedLesseeNames = PORTFOLIO_LESSEES.filter(l => a.title.toLowerCase().includes(l.toLowerCase()));

  return {
    id: a.id,
    headline: a.title,
    source: a.source,
    publishedAt: a.publishedAt,
    hoursAgo,
    category,
    sentiment,
    relevance,
    affectedLesseeNames,
    portfolioTag: affectedLesseeNames.length > 0 ? `${affectedLesseeNames[0]} exposure` : "Market intelligence",
    suggestedAction: category === "financial-distress" ? "Review lessee stage assignment"
      : category === "sanctions" ? "Run OFAC screen immediately"
      : "Monitor",
    actionHref: category === "financial-distress" ? "/counterparties" : "/intelligence/deal-feed",
  };
}

function articleToJxEvent(a: NewsArticleRaw, jurisdiction: string): JurisdictionEvent {
  const sentiment = classifySentiment(a.title);
  const content = a.content.toLowerCase();
  const eventType: JxEventType = /court|ruling|law/.test(content) ? "legal"
    : /regulat|authority/.test(content) ? "regulatory"
    : /politic|election|government/.test(content) ? "political"
    : "credit";

  return {
    id: a.id,
    jurisdiction,
    code: JX_CODE_MAP[jurisdiction] ?? "??",
    eventType,
    headline: a.title,
    detail: a.content || "See source for full details.",
    source: a.source,
    date: a.publishedAt.slice(0, 10),
    sentiment,
    portfolioExposureUSD: JX_EXPOSURE_MAP[jurisdiction] ?? 0,
    lesseesAffected: JX_LESSEES_MAP[jurisdiction] ?? [],
  };
}

const JX_COUNTRY_PATTERNS: [string, RegExp][] = [
  ["India",       /\bindia\b/i],
  ["Brazil",      /\bbrazil\b/i],
  ["UAE",         /\buae\b|\bubai\b|\babu dhabi\b/i],
  ["Sri Lanka",   /sri lanka/i],
  ["Ireland",     /\bireland\b/i],
  ["Singapore",   /\bsingapore\b/i],
];

function detectJurisdiction(article: NewsArticleRaw): string | null {
  const text = article.title + " " + article.content;
  for (const [country, pattern] of JX_COUNTRY_PATTERNS) {
    if (pattern.test(text)) return country;
  }
  return null;
}

function transformLiveNews(live: LiveNewsData): { dealItems: DealItem[]; jxEvents: JurisdictionEvent[] } {
  const dealItems = live.articles.map(articleToDealItem);
  const jxEvents = live.jxArticles
    .map(a => {
      const jx = detectJurisdiction(a);
      return jx ? articleToJxEvent(a, jx) : null;
    })
    .filter((e): e is JurisdictionEvent => e !== null);
  return { dealItems, jxEvents };
}

export interface UseNewsFeedResult {
  dealItems: DealItem[];
  jxEvents: JurisdictionEvent[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  partial: boolean;
  refresh: () => void;
}

export function useNewsFeed(): UseNewsFeedResult {
  const [dealItems, setDealItems] = useState<DealItem[]>(DEAL_FEED);
  const [jxEvents, setJxEvents] = useState<JurisdictionEvent[]>(JURISDICTION_EVENTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [partial, setPartial] = useState(false);

  const { getAccessTokenSilently } = useAuth0();
  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let token: string | undefined;
      try { token = await getAccessTokenSilently(); } catch { /* anon — endpoint will 401 and we keep defaults */ }
      const res = await fetch("/api/signals/news", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401 || res.status === 503) {
        // NewsAPI not configured — keep static defaults silently
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const live = await res.json() as LiveNewsData;
      const { dealItems: di, jxEvents: je } = transformLiveNews(live);
      if (di.length > 0) setDealItems(di);
      if (je.length > 0) setJxEvents(je);
      setLastUpdated(new Date(live.fetchedAt));
      setPartial(live.partial);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ live, cachedAt: Date.now() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const { live } = JSON.parse(raw) as { live: LiveNewsData };
          const { dealItems: di, jxEvents: je } = transformLiveNews(live);
          if (di.length > 0) setDealItems(di);
          if (je.length > 0) setJxEvents(je);
          setLastUpdated(new Date(live.fetchedAt));
        }
      } catch { /* keep static defaults */ }
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, POLL_MS);
    return () => clearInterval(id);
  }, [fetchNews]);

  return { dealItems, jxEvents, loading, error, lastUpdated, partial, refresh: fetchNews };
}
