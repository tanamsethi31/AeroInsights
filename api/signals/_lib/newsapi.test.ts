import { describe, it, expect } from "vitest";
import {
  parseNewsApiResponse,
  classifyCategory,
  classifySentiment,
  classifyRelevance,
  type NewsApiResponse,
} from "./newsapi";

describe("classifyCategory", () => {
  it("classifies bankruptcy headlines as financial-distress", () => {
    expect(classifyCategory("Airline files for bankruptcy protection", "")).toBe("financial-distress");
  });
  it("classifies OFAC headlines as sanctions", () => {
    expect(classifyCategory("OFAC adds airline to SDN list", "")).toBe("sanctions");
  });
  it("classifies fleet order headlines as fleet", () => {
    expect(classifyCategory("Airline orders 50 A320neo aircraft", "")).toBe("fleet");
  });
  it("classifies route suspension as route-network", () => {
    expect(classifyCategory("Carrier suspends route to Colombo", "")).toBe("route-network");
  });
  it("defaults to positive for unmatched content", () => {
    expect(classifyCategory("Airline reports record passenger numbers", "")).toBe("positive");
  });
});

describe("classifySentiment", () => {
  it("returns negative for distress keywords", () => {
    expect(classifySentiment("Airline faces debt crisis")).toBe("negative");
  });
  it("returns positive for growth keywords", () => {
    expect(classifySentiment("Airline reports record profit growth")).toBe("positive");
  });
  it("returns neutral for ambiguous headlines", () => {
    expect(classifySentiment("Airline launches new service")).toBe("neutral");
  });
});

describe("classifyRelevance", () => {
  it("returns high for financial-distress", () => {
    expect(classifyRelevance("IndiGo files for protection", "financial-distress")).toBe("high");
  });
  it("returns high for mentions of portfolio lessees", () => {
    expect(classifyRelevance("Azul signs new deal", "positive")).toBe("high");
  });
  it("returns medium for aviation industry news", () => {
    expect(classifyRelevance("IATA raises traffic forecast", "positive")).toBe("medium");
  });
  it("returns low for unrelated content", () => {
    expect(classifyRelevance("New airport opens", "positive")).toBe("low");
  });
});

describe("parseNewsApiResponse", () => {
  const MOCK: NewsApiResponse = {
    status: "ok",
    articles: [
      {
        source: { name: "Reuters" },
        title: "IndiGo reports fuel cost surge",
        description: "Fuel costs rose 20%",
        url: "https://reuters.com/indigo-fuel",
        publishedAt: "2026-04-30T10:00:00Z",
        content: null,
      },
      {
        source: { name: "Bloomberg" },
        title: "[Removed]",
        description: null,
        url: "https://bloomberg.com/removed",
        publishedAt: "2026-04-30T09:00:00Z",
        content: null,
      },
    ],
  };

  it("parses valid articles and skips [Removed] entries", () => {
    const result = parseNewsApiResponse(MOCK);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("IndiGo reports fuel cost surge");
    expect(result[0].source).toBe("Reuters");
  });

  it("returns empty array when status is not ok", () => {
    expect(parseNewsApiResponse({ status: "error", articles: [] })).toEqual([]);
  });
});
