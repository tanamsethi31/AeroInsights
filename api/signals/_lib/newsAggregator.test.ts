// api/signals/_lib/newsAggregator.test.ts
import { describe, it, expect } from "vitest";
import {
  dedupeArticles, normaliseTitle, normaliseUrl,
  type NewsArticleAggregated,
} from "./newsAggregator";
import { __test__ as webzT }       from "./webz";
import { __test__ as newsApiAiT }  from "./newsapiAi";
import { __test__ as worldNewsT }  from "./worldnews";
import { __test__ as newsdataT }   from "./newsdata";
import { __test__ as theNewsApiT } from "./thenewsapi";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeArt(over: Partial<NewsArticleAggregated>): NewsArticleAggregated {
  return {
    id: "a", title: "t", source: "s", url: "https://x.com/a",
    publishedAt: "2026-05-30T10:00:00Z", content: "c", _source: "newsapi",
    ...over,
  };
}

// ─── normaliseUrl ────────────────────────────────────────────────────────────

describe("normaliseUrl", () => {
  it("strips query strings", () => {
    expect(normaliseUrl("https://example.com/a?utm=1")).toBe("https://example.com/a");
  });
  it("strips trailing slash", () => {
    expect(normaliseUrl("https://example.com/a/")).toBe("https://example.com/a");
  });
  it("lowercases host but keeps path-case dropped via toLowerCase", () => {
    expect(normaliseUrl("https://EXAMPLE.com/Article")).toBe("https://example.com/article");
  });
  it("returns input on malformed URL", () => {
    expect(normaliseUrl("not-a-url")).toBe("not-a-url");
  });
});

// ─── normaliseTitle ──────────────────────────────────────────────────────────

describe("normaliseTitle", () => {
  it("lowercases and collapses non-alphanumeric runs", () => {
    expect(normaliseTitle("IndiGo — Q1 2026 Results")).toBe("indigo q1 2026 results");
  });
  it("trims edges", () => {
    expect(normaliseTitle("  Boeing 737 MAX  ")).toBe("boeing 737 max");
  });
});

// ─── dedupeArticles ──────────────────────────────────────────────────────────

describe("dedupeArticles", () => {
  it("dedupes by URL exact match", () => {
    const arts: NewsArticleAggregated[] = [
      makeArt({ id: "1", title: "X", url: "https://a.com/1" }),
      makeArt({ id: "2", title: "Y", url: "https://a.com/1?utm=foo" }),
    ];
    expect(dedupeArticles(arts)).toHaveLength(1);
  });

  it("dedupes by normalised title when URLs differ", () => {
    const arts: NewsArticleAggregated[] = [
      makeArt({ id: "1", title: "IndiGo posts record Q1 2026 profit", url: "https://a.com/1" }),
      makeArt({ id: "2", title: "IndiGo posts record Q1 2026 profit", url: "https://b.com/x" }),
    ];
    expect(dedupeArticles(arts)).toHaveLength(1);
  });

  it("keeps articles with short titles even if normalised match (avoid false-positive merges)", () => {
    const arts: NewsArticleAggregated[] = [
      makeArt({ id: "1", title: "Update", url: "https://a.com/1" }),
      makeArt({ id: "2", title: "Update", url: "https://b.com/x" }),
    ];
    // Both kept because title length is <= 12 characters after normalisation.
    expect(dedupeArticles(arts)).toHaveLength(2);
  });

  it("preserves first-seen ordering", () => {
    const arts: NewsArticleAggregated[] = [
      makeArt({ id: "1", title: "Boeing 737 MAX",  url: "https://a.com/1" }),
      makeArt({ id: "2", title: "Boeing 737 MAX",  url: "https://b.com/x" }),
      makeArt({ id: "3", title: "Airbus A320 neo", url: "https://c.com/x" }),
    ];
    const out = dedupeArticles(arts);
    expect(out.map((a) => a.id)).toEqual(["1", "3"]);
  });
});

// ─── Adapter parsers ─────────────────────────────────────────────────────────

describe("webz parser", () => {
  it("maps posts to NewsArticleRaw", () => {
    const result = webzT.parseWebz({
      posts: [{
        uuid: "WEBZ-1", title: "IndiGo Q1", url: "https://news.example/indigo",
        text: "body text", published: "2026-05-30T10:00:00Z",
        thread: { site_full: "news.example" },
      }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "WEBZ-1", title: "IndiGo Q1", source: "news.example",
      url: "https://news.example/indigo",
    });
  });
  it("returns [] on empty payload", () => {
    expect(webzT.parseWebz({})).toEqual([]);
  });
});

describe("newsapi.ai parser", () => {
  it("maps articles.results to NewsArticleRaw", () => {
    const result = newsApiAiT.parseNewsApiAi({
      articles: { results: [{
        uri: "ai-123", title: "Airbus deliveries surge",
        url: "https://t.co/airbus", dateTime: "2026-05-30T10:00:00Z",
        source: { title: "Reuters" }, body: "...",
      }] },
    });
    expect(result[0]).toMatchObject({ id: "ai-123", source: "Reuters" });
  });
});

describe("worldnews parser", () => {
  it("maps news[] to NewsArticleRaw", () => {
    const result = worldNewsT.parseWorldNews({
      news: [{
        id: 99, title: "Lufthansa Q1", url: "https://wn.example/lu",
        publish_date: "2026-05-30 10:00:00", source_country: "DE",
        summary: "summary",
      }],
    });
    expect(result[0]).toMatchObject({ id: "99", source: "worldnewsapi (DE)" });
  });
});

describe("newsdata parser", () => {
  it("maps results[] to NewsArticleRaw", () => {
    const result = newsdataT.parseNewsdata({
      status: "success",
      results: [{
        article_id: "nd-1", title: "Aviation news", link: "https://nd.example/x",
        pubDate: "2026-05-30 10:00:00", source_name: "ND Source",
      }],
    });
    expect(result[0]).toMatchObject({ id: "nd-1", source: "ND Source" });
  });
  it("drops payload when status != success", () => {
    expect(newsdataT.parseNewsdata({ status: "error" })).toEqual([]);
  });
});

describe("thenewsapi parser", () => {
  it("maps data[] to NewsArticleRaw", () => {
    const result = theNewsApiT.parseTheNewsApi({
      data: [{
        uuid: "tn-1", title: "Boeing 787 issues",
        url: "https://tna.example/x",
        published_at: "2026-05-30T10:00:00.000Z",
        source: "Bloomberg",
        description: "d",
      }],
    });
    expect(result[0]).toMatchObject({ id: "tn-1", source: "Bloomberg" });
  });
});
