# Live Signals + Sidebar Scrollbar Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded `MACRO_SIGNALS`/`DEAL_FEED`/`JURISDICTION_EVENTS` arrays with live data from ECB, EIA, IMF, and NewsAPI served through Vercel serverless routes; fix sidebar scrollbar causing content-width shift.

**Architecture:** Vercel API routes (`api/signals/macro.ts`, `api/signals/news.ts`) fetch from upstream providers, apply Cache-Control headers, and return typed JSON. Frontend hooks (`useMacroSignals`, `useNewsFeed`) fetch those routes, merge live values into the existing static `MacroSignal[]`/`DealItem[]`/`JurisdictionEvent[]` arrays, and fall back to `localStorage` cache on error. Intelligence.tsx views are refactored to accept data as props.

**Tech Stack:** TypeScript, Vitest, Vercel serverless, ECB SDMX REST API, EIA API v2, IMF DataMapper API, NewsAPI.org, React hooks, localStorage

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/app/components/ui/sidebar.tsx` | Modify line 377 | Add `scrollbar-gutter: stable` |
| `vitest.config.ts` | Modify | Include `api/**/*.test.ts` |
| `api/signals/_lib/ecb.ts` | Create | Fetch + parse ECB SDMX JSON |
| `api/signals/_lib/ecb.test.ts` | Create | Unit tests for ECB parser |
| `api/signals/_lib/eia.ts` | Create | Fetch + parse EIA v2 JSON |
| `api/signals/_lib/eia.test.ts` | Create | Unit tests for EIA parser |
| `api/signals/_lib/imf.ts` | Create | Fetch + parse IMF DataMapper JSON |
| `api/signals/_lib/imf.test.ts` | Create | Unit tests for IMF parser |
| `api/signals/_lib/newsapi.ts` | Create | Fetch + parse NewsAPI articles, classify into `DealItem`/`JurisdictionEvent` |
| `api/signals/_lib/newsapi.test.ts` | Create | Unit tests for news classifier |
| `api/signals/macro.ts` | Create | Vercel route: aggregate ECB+EIA+IMF → `LiveMacroData` |
| `api/signals/news.ts` | Create | Vercel route: aggregate NewsAPI → `LiveNewsData` |
| `src/app/services/useMacroSignals.ts` | Create | Hook: fetch macro route, merge into `MacroSignal[]`, localStorage fallback |
| `src/app/services/useNewsFeed.ts` | Create | Hook: fetch news route, transform into `DealItem[]`+`JurisdictionEvent[]` |
| `src/app/pages/Intelligence.tsx` | Modify | Wire hooks; refactor views to accept props; add refresh UI + Simulated badge |

---

## Task 1: Sidebar scrollbar-gutter fix

**Files:**
- Modify: `src/app/components/ui/sidebar.tsx:377`

- [ ] **Step 1: Add `scrollbar-gutter: stable` to `SidebarContent`**

Open `src/app/components/ui/sidebar.tsx`. At line 377, the `SidebarContent` className string currently reads:

```
"flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden"
```

Change it to:

```
"flex min-h-0 flex-1 flex-col gap-2 overflow-auto [scrollbar-gutter:stable] group-data-[collapsible=icon]:overflow-hidden"
```

The full function after the change:

```tsx
function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto [scrollbar-gutter:stable] group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Verify `theme.css` already has the custom scrollbar CSS**

Run:
```bash
grep -n "sidebar.*content.*scrollbar\|data-sidebar.*content.*webkit" src/styles/theme.css
```
Expected output: lines 264–286 already exist. No change needed — the custom scrollbar styles are already there.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/ui/sidebar.tsx
git commit -m "fix: sidebar scrollbar-gutter stable — prevent content-width shift on scroll"
```

---

## Task 2: Extend Vitest config to cover API lib tests

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Add `api/**/*.test.ts` to the include pattern**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "api/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Verify the config parses**

```bash
npx vitest --reporter=verbose --run 2>&1 | head -5
```
Expected: existing tests still pass, no config error.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: extend vitest config to include api/**/*.test.ts"
```

---

## Task 3: ECB SDMX fetch + parse library

**Files:**
- Create: `api/signals/_lib/ecb.ts`
- Create: `api/signals/_lib/ecb.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/signals/_lib/ecb.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEcbResponse, type EcbSdmxJson } from "./ecb";

const MOCK_ECB_RESPONSE: EcbSdmxJson = {
  dataSets: [{
    series: {
      "0:0:0:0:0:0": {
        observations: {
          "0": [3.75, null, null],
          "1": [3.50, null, null],
        },
      },
    },
  }],
  structure: {
    dimensions: {
      observation: [{
        values: [
          { id: "2026-03-12" },
          { id: "2026-04-10" },
        ],
      }],
    },
  },
};

describe("parseEcbResponse", () => {
  it("returns observations sorted oldest-first", () => {
    const result = parseEcbResponse(MOCK_ECB_RESPONSE);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ value: 3.75, date: "2026-03-12" });
    expect(result[1]).toEqual({ value: 3.50, date: "2026-04-10" });
  });

  it("filters out null observations", () => {
    const data: EcbSdmxJson = {
      dataSets: [{
        series: {
          "0:0:0:0:0:0": {
            observations: { "0": [null, null, null], "1": [2.5, null, null] },
          },
        },
      }],
      structure: {
        dimensions: {
          observation: [{ values: [{ id: "2026-01-01" }, { id: "2026-02-01" }] }],
        },
      },
    };
    const result = parseEcbResponse(data);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(2.5);
  });

  it("returns empty array for malformed response", () => {
    const bad = { dataSets: [], structure: { dimensions: { observation: [] } } } as unknown as EcbSdmxJson;
    expect(parseEcbResponse(bad)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run api/signals/_lib/ecb.test.ts
```
Expected: `Cannot find module './ecb'`

- [ ] **Step 3: Implement `api/signals/_lib/ecb.ts`**

```ts
// api/signals/_lib/ecb.ts

export interface EcbObservation {
  value: number;
  date: string;
}

export interface EcbSdmxJson {
  dataSets: Array<{
    series: Record<string, {
      observations: Record<string, [number | null, ...unknown[]]>;
    }>;
  }>;
  structure: {
    dimensions: {
      observation: Array<{
        values: Array<{ id: string }>;
      }>;
    };
  };
}

export function parseEcbResponse(data: EcbSdmxJson): EcbObservation[] {
  const series = Object.values(data.dataSets[0]?.series ?? {})[0];
  if (!series) return [];
  const timeValues = data.structure.dimensions.observation[0]?.values ?? [];
  return Object.entries(series.observations)
    .map(([idx, obs]) => ({
      value: obs[0] as number | null,
      date: timeValues[parseInt(idx)]?.id ?? "",
    }))
    .filter((o): o is EcbObservation => o.value !== null && !isNaN(o.value) && o.date !== "")
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchEcbSeries(seriesKey: string): Promise<EcbObservation[]> {
  const url = `https://data-api.ecb.europa.eu/service/data/${seriesKey}?format=jsondata&lastNObservations=2`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`ECB ${seriesKey}: HTTP ${res.status}`);
  return parseEcbResponse(await res.json() as EcbSdmxJson);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run api/signals/_lib/ecb.test.ts
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add api/signals/_lib/ecb.ts api/signals/_lib/ecb.test.ts
git commit -m "feat: ECB SDMX fetch + parse library"
```

---

## Task 4: EIA API v2 fetch + parse library

**Files:**
- Create: `api/signals/_lib/eia.ts`
- Create: `api/signals/_lib/eia.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/signals/_lib/eia.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEiaResponse, type EiaResponse } from "./eia";

const MOCK_EIA: EiaResponse = {
  response: {
    data: [
      { period: "2026-04-28", value: "89.50" },
      { period: "2026-04-21", value: "87.20" },
    ],
  },
};

describe("parseEiaResponse", () => {
  it("parses string values as floats, newest first", () => {
    const result = parseEiaResponse(MOCK_EIA);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ period: "2026-04-28", value: 89.5 });
    expect(result[1]).toEqual({ period: "2026-04-21", value: 87.2 });
  });

  it("accepts numeric values", () => {
    const data: EiaResponse = { response: { data: [{ period: "2026-04-28", value: 89.5 }] } };
    expect(parseEiaResponse(data)[0].value).toBe(89.5);
  });

  it("filters out non-numeric values", () => {
    const data: EiaResponse = { response: { data: [{ period: "2026-04-28", value: "N/A" }] } };
    expect(parseEiaResponse(data)).toHaveLength(0);
  });

  it("returns empty array for missing data", () => {
    expect(parseEiaResponse({ response: { data: [] } })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run api/signals/_lib/eia.test.ts
```
Expected: `Cannot find module './eia'`

- [ ] **Step 3: Implement `api/signals/_lib/eia.ts`**

```ts
// api/signals/_lib/eia.ts

export interface EiaObservation {
  value: number;
  period: string; // "YYYY-MM-DD" (weekly)
}

export interface EiaResponse {
  response: {
    data: Array<{
      period: string;
      value: string | number;
    }>;
  };
}

export function parseEiaResponse(data: EiaResponse): EiaObservation[] {
  return (data.response?.data ?? [])
    .map(d => ({
      period: d.period,
      value: typeof d.value === "string" ? parseFloat(d.value) : d.value,
    }))
    .filter((o): o is EiaObservation => !isNaN(o.value));
}

export async function fetchBrentCrude(apiKey: string): Promise<EiaObservation[]> {
  if (!apiKey) throw new Error("EIA_API_KEY not set");
  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: "weekly",
    "data[0]": "value",
    "facets[product][]": "EPCBRENT",
    "sort[0][column]": "period",
    "sort[0][direction]": "desc",
    length: "2",
  });
  const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`EIA: HTTP ${res.status}`);
  return parseEiaResponse(await res.json() as EiaResponse);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run api/signals/_lib/eia.test.ts
```
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add api/signals/_lib/eia.ts api/signals/_lib/eia.test.ts
git commit -m "feat: EIA Brent crude fetch + parse library"
```

---

## Task 5: IMF DataMapper fetch + parse library

**Files:**
- Create: `api/signals/_lib/imf.ts`
- Create: `api/signals/_lib/imf.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/signals/_lib/imf.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseImfResponse, type ImfResponse } from "./imf";

const MOCK_IMF: ImfResponse = {
  values: {
    NGDP_RPCH: {
      IND: { "2025": 6.3, "2026": 5.8 },
      BRA: { "2025": 2.8, "2026": 2.1 },
    },
  },
};

describe("parseImfResponse", () => {
  it("returns the latest year value for each requested country", () => {
    const result = parseImfResponse(MOCK_IMF, ["IND", "BRA"]);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.countryCode === "IND")).toEqual({ countryCode: "IND", year: "2026", value: 5.8 });
    expect(result.find(r => r.countryCode === "BRA")).toEqual({ countryCode: "BRA", year: "2026", value: 2.1 });
  });

  it("skips countries with no data", () => {
    const result = parseImfResponse(MOCK_IMF, ["IND", "ZZZ"]);
    expect(result).toHaveLength(1);
    expect(result[0].countryCode).toBe("IND");
  });

  it("returns empty array for empty response", () => {
    expect(parseImfResponse({ values: {} }, ["IND"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run api/signals/_lib/imf.test.ts
```
Expected: `Cannot find module './imf'`

- [ ] **Step 3: Implement `api/signals/_lib/imf.ts`**

```ts
// api/signals/_lib/imf.ts

export interface ImfGdpData {
  countryCode: string;
  year: string;
  value: number;
}

export interface ImfResponse {
  values: {
    NGDP_RPCH?: Record<string, Record<string, number>>;
  };
}

export function parseImfResponse(data: ImfResponse, countries: string[]): ImfGdpData[] {
  const series = data.values?.NGDP_RPCH ?? {};
  const result: ImfGdpData[] = [];
  for (const country of countries) {
    const countryData = series[country];
    if (!countryData) continue;
    const latestYear = Object.keys(countryData).sort().at(-1);
    if (!latestYear) continue;
    result.push({ countryCode: country, year: latestYear, value: countryData[latestYear] });
  }
  return result;
}

export async function fetchGdpGrowth(countries: string[]): Promise<ImfGdpData[]> {
  const url = `https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/${countries.join("/")}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`IMF: HTTP ${res.status}`);
  return parseImfResponse(await res.json() as ImfResponse, countries);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run api/signals/_lib/imf.test.ts
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add api/signals/_lib/imf.ts api/signals/_lib/imf.test.ts
git commit -m "feat: IMF DataMapper GDP growth fetch + parse library"
```

---

## Task 6: NewsAPI fetch + classify library

**Files:**
- Create: `api/signals/_lib/newsapi.ts`
- Create: `api/signals/_lib/newsapi.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/signals/_lib/newsapi.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run api/signals/_lib/newsapi.test.ts
```
Expected: `Cannot find module './newsapi'`

- [ ] **Step 3: Implement `api/signals/_lib/newsapi.ts`**

```ts
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
  if (/fleet|aircraft order|delivery|airbus|boeing|narrowbody|widebody/.test(text)) return "fleet";
  if (/route|cancel|suspend|ground|network cut|service halt/.test(text)) return "route-network";
  if (/regulat|authority|rule|ruling|court|law|penalty|fine/.test(text)) return "regulatory";
  return "positive";
}

export function classifySentiment(title: string): Sentiment {
  const t = title.toLowerCase();
  if (/loss|bankrupt|default|distress|downgrad|cut|sanction|crisis|warning|concern|struggle|plunge/.test(t)) return "negative";
  if (/profit|growth|record|strong|upgrad|expand|positive|boom|surge|launch|award/.test(t)) return "positive";
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run api/signals/_lib/newsapi.test.ts
```
Expected: `10 passed`

- [ ] **Step 5: Commit**

```bash
git add api/signals/_lib/newsapi.ts api/signals/_lib/newsapi.test.ts
git commit -m "feat: NewsAPI fetch + category/sentiment/relevance classifier library"
```

---

## Task 7: `/api/signals/macro.ts` Vercel route

**Files:**
- Create: `api/signals/macro.ts`

- [ ] **Step 1: Create the route**

```ts
// api/signals/macro.ts
import { fetchEcbSeries } from "./_lib/ecb";
import { fetchBrentCrude } from "./_lib/eia";
import { fetchGdpGrowth } from "./_lib/imf";

export interface LiveMacroData {
  ecbDepositRate: { value: number; date: string } | null;
  eurUsd: { value: number; date: string } | null;
  brentCrude: { value: number; date: string } | null;
  gdp: Array<{ countryCode: string; year: string; value: number }>;
  fetchedAt: string;
  partial: boolean;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const data: LiveMacroData = {
    ecbDepositRate: null,
    eurUsd: null,
    brentCrude: null,
    gdp: [],
    fetchedAt: new Date().toISOString(),
    partial: false,
  };

  const [ecbRate, eurUsd, brent, gdp] = await Promise.allSettled([
    fetchEcbSeries("FM/B.U2.EUR.4F.KR.DFR.LEV"),
    fetchEcbSeries("EXR/D.USD.EUR.SP00.A"),
    fetchBrentCrude(process.env.EIA_API_KEY ?? ""),
    fetchGdpGrowth(["IND", "BRA"]),
  ]);

  if (ecbRate.status === "fulfilled" && ecbRate.value.length > 0) {
    const obs = ecbRate.value.at(-1)!;
    data.ecbDepositRate = { value: obs.value, date: obs.date };
  } else {
    data.partial = true;
  }

  if (eurUsd.status === "fulfilled" && eurUsd.value.length > 0) {
    const obs = eurUsd.value.at(-1)!;
    data.eurUsd = { value: obs.value, date: obs.date };
  } else {
    data.partial = true;
  }

  if (brent.status === "fulfilled" && brent.value.length > 0) {
    const obs = brent.value[0]; // newest first from EIA
    data.brentCrude = { value: obs.value, date: obs.period };
  } else {
    data.partial = true;
  }

  if (gdp.status === "fulfilled") {
    data.gdp = gdp.value;
  } else {
    data.partial = true;
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "s-maxage=14400, stale-while-revalidate=3600",
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --strict api/signals/macro.ts 2>&1 | head -20
```
Expected: no errors (or only missing `process` — acceptable in edge runtime context).

- [ ] **Step 3: Commit**

```bash
git add api/signals/macro.ts
git commit -m "feat: /api/signals/macro Vercel route — ECB + EIA + IMF aggregation"
```

---

## Task 8: `/api/signals/news.ts` Vercel route

**Files:**
- Create: `api/signals/news.ts`

- [ ] **Step 1: Create the route**

```ts
// api/signals/news.ts
import { fetchAviationNews, fetchJurisdictionNews, type NewsArticleRaw } from "./_lib/newsapi";

const JX_COUNTRIES = ["India", "Brazil", "UAE", "Sri Lanka", "Ireland", "Singapore"];

export interface LiveNewsData {
  articles: NewsArticleRaw[];
  jxArticles: NewsArticleRaw[];
  fetchedAt: string;
  partial: boolean;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data: LiveNewsData = {
    articles: [],
    jxArticles: [],
    fetchedAt: new Date().toISOString(),
    partial: false,
  };

  const [news, jxNews] = await Promise.allSettled([
    fetchAviationNews(apiKey, 20),
    fetchJurisdictionNews(apiKey, JX_COUNTRIES, 10),
  ]);

  if (news.status === "fulfilled") data.articles = news.value;
  else data.partial = true;

  if (jxNews.status === "fulfilled") data.jxArticles = jxNews.value;
  else data.partial = true;

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/signals/news.ts
git commit -m "feat: /api/signals/news Vercel route — NewsAPI aviation + jurisdiction aggregation"
```

---

## Task 9: `useMacroSignals` hook

**Files:**
- Create: `src/app/services/useMacroSignals.ts`

The hook fetches `/api/signals/macro`, merges live numeric values into the static `MACRO_SIGNALS` array (keeping narratives intact), caches in `localStorage`, and polls every 30 minutes.

Signal ID to live-data mapping (from `intelligenceData.ts`):
- `sig-03` = ECB Deposit Rate → `ecbDepositRate`
- `sig-04` = EUR/USD FX → `eurUsd`
- `sig-06` = Brent Crude → `brentCrude`
- `sig-02` = India GDP → `gdp` where `countryCode === "IND"`

- [ ] **Step 1: Create `src/app/services/useMacroSignals.ts`**

```ts
// src/app/services/useMacroSignals.ts
import { useState, useEffect, useCallback } from "react";
import { MACRO_SIGNALS, type MacroSignal } from "../data/intelligenceData";

interface LiveMacroData {
  ecbDepositRate: { value: number; date: string } | null;
  eurUsd: { value: number; date: string } | null;
  brentCrude: { value: number; date: string } | null;
  gdp: Array<{ countryCode: string; year: string; value: number }>;
  fetchedAt: string;
  partial: boolean;
}

const STORAGE_KEY = "aeroinsights_macro_v1";
const POLL_MS = 30 * 60 * 1000;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function mergeLiveData(signals: MacroSignal[], live: LiveMacroData): MacroSignal[] {
  return signals.map(sig => {
    if (sig.id === "sig-03" && live.ecbDepositRate) {
      const { value, date } = live.ecbDepositRate;
      return {
        ...sig,
        currentValue: `${value.toFixed(2)}%`,
        updatedAt: `${formatDate(date)} · Live (ECB)`,
      };
    }
    if (sig.id === "sig-04" && live.eurUsd) {
      const { value, date } = live.eurUsd;
      return {
        ...sig,
        currentValue: value.toFixed(4),
        updatedAt: `${formatDate(date)} · Live (ECB)`,
      };
    }
    if (sig.id === "sig-06" && live.brentCrude) {
      const { value, date } = live.brentCrude;
      return {
        ...sig,
        currentValue: `$${value.toFixed(2)} / bbl`,
        updatedAt: `${formatDate(date)} · Live (EIA)`,
      };
    }
    if (sig.id === "sig-02") {
      const indiaGdp = live.gdp.find(g => g.countryCode === "IND");
      if (indiaGdp) {
        return {
          ...sig,
          currentValue: `${indiaGdp.value.toFixed(1)}% (FY${indiaGdp.year} forecast)`,
          updatedAt: `${indiaGdp.year} · Live (IMF)`,
        };
      }
    }
    return sig;
  });
}

export interface UseMacroSignalsResult {
  signals: MacroSignal[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  partial: boolean;
  refresh: () => void;
}

export function useMacroSignals(): UseMacroSignalsResult {
  const [signals, setSignals] = useState<MacroSignal[]>(MACRO_SIGNALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [partial, setPartial] = useState(false);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signals/macro");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const live = await res.json() as LiveMacroData;
      setSignals(mergeLiveData(MACRO_SIGNALS, live));
      setLastUpdated(new Date(live.fetchedAt));
      setPartial(live.partial);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ live, cachedAt: Date.now() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
      // Fallback: try localStorage cache
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const { live } = JSON.parse(raw) as { live: LiveMacroData };
          setSignals(mergeLiveData(MACRO_SIGNALS, live));
          setLastUpdated(new Date(live.fetchedAt));
        }
      } catch { /* keep static defaults */ }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const id = setInterval(fetchSignals, POLL_MS);
    return () => clearInterval(id);
  }, [fetchSignals]);

  return { signals, loading, error, lastUpdated, partial, refresh: fetchSignals };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/services/useMacroSignals.ts
git commit -m "feat: useMacroSignals hook — live ECB/EIA/IMF values merged into MacroSignal[]"
```

---

## Task 10: `useNewsFeed` hook

**Files:**
- Create: `src/app/services/useNewsFeed.ts`

The hook fetches `/api/signals/news` and transforms `NewsArticleRaw[]` into the existing `DealItem[]` and `JurisdictionEvent[]` shapes the UI expects.

JurisdictionEvent shape (from `intelligenceData.ts`):
```ts
interface JurisdictionEvent {
  id: string; jurisdiction: string; code: string; eventType: JxEventType;
  headline: string; detail: string; source: string; date: string;
  sentiment: SignalSentiment; portfolioExposureUSD: number; lesseesAffected: string[];
}
```

DealItem shape (from `intelligenceData.ts`):
```ts
interface DealItem {
  id: string; headline: string; source: string; publishedAt: string; hoursAgo: number;
  category: DealCategory; sentiment: SignalSentiment; relevance: "high" | "medium" | "low";
  affectedLesseeNames: string[]; portfolioTag: string; suggestedAction: string; actionHref: string;
}
```

- [ ] **Step 1: Create `src/app/services/useNewsFeed.ts`**

```ts
// src/app/services/useNewsFeed.ts
import { useState, useEffect, useCallback } from "react";
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
  if (/fleet|aircraft order|delivery|airbus|boeing/.test(text)) return "fleet";
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [partial, setPartial] = useState(false);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signals/news");
      if (res.status === 503) {
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
  }, []);

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, POLL_MS);
    return () => clearInterval(id);
  }, [fetchNews]);

  return { dealItems, jxEvents, loading, error, lastUpdated, partial, refresh: fetchNews };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/services/useNewsFeed.ts
git commit -m "feat: useNewsFeed hook — live NewsAPI articles transformed into DealItem[] + JurisdictionEvent[]"
```

---

## Task 11: Wire Intelligence.tsx — hook integration + refresh UI + Simulated badge

**Files:**
- Modify: `src/app/pages/Intelligence.tsx`

This task has four changes: (A) refactor views to accept props, (B) wire hooks in main page, (C) add last-updated strip + refresh button, (D) add Simulated badge to Lessee Radar.

### A — Add prop signatures to `MacroSignalsView`, `DealFeedView`, `JurisdictionWatchView`

- [ ] **Step 1: Update `MacroSignalsView` signature and replace `MACRO_SIGNALS` with `signals` prop**

Find:
```tsx
function MacroSignalsView({ lesseeIdByName, liveExposure }: {
  lesseeIdByName: Map<string, string>;
  liveExposure: (name: string, fallback: number) => number;
}) {
  const [catFilter, setCatFilter] = useState<SignalCategory | "all">("all");

  const filtered = useMemo(() => {
    const sigs = catFilter === "all"
      ? MACRO_SIGNALS
      : MACRO_SIGNALS.filter((s) => s.category === catFilter);
```

Replace with:
```tsx
function MacroSignalsView({ signals, loading, lastUpdated, onRefresh, lesseeIdByName, liveExposure }: {
  signals: MacroSignal[];
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  lesseeIdByName: Map<string, string>;
  liveExposure: (name: string, fallback: number) => number;
}) {
  const [catFilter, setCatFilter] = useState<SignalCategory | "all">("all");

  const filtered = useMemo(() => {
    const sigs = catFilter === "all"
      ? signals
      : signals.filter((s) => s.category === catFilter);
```

Then replace every remaining `MACRO_SIGNALS` reference inside `MacroSignalsView` with `signals`:
- Line 567: `for (const s of MACRO_SIGNALS)` → `for (const s of signals)`
- Line 571: `const highCount = MACRO_SIGNALS.filter(...)` → `const highCount = signals.filter(...)`
- Line 572: `const medCount = MACRO_SIGNALS.filter(...)` → `const medCount = signals.filter(...)`
- Line 588: `value: MACRO_SIGNALS.length` → `value: signals.length`
- Line 613: `label={f.id === "all" ? \`All (${MACRO_SIGNALS.length})\`` → `label={f.id === "all" ? \`All (${signals.length})\``

Also add the last-updated + refresh strip just before the KPI grid (after the `return (` and `<div>`):
```tsx
{/* Live status strip */}
<div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", fontSize: "0.78rem", color: T.muted }}>
  {loading ? (
    <span>Refreshing…</span>
  ) : lastUpdated ? (
    <span>Live · Updated {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
  ) : (
    <span>Static data</span>
  )}
  <button
    onClick={onRefresh}
    disabled={loading}
    style={{ fontSize: "0.75rem", color: T.blue, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
  >
    Refresh
  </button>
</div>
```

- [ ] **Step 2: Update `DealFeedView` signature and replace `DEAL_FEED` with `items` prop**

Find:
```tsx
function DealFeedView() {
  const [catFilter, setCatFilter] = useState<DealCategory | "all">("all");

  const filtered = useMemo(() => {
    const items = catFilter === "all"
      ? DEAL_FEED
      : DEAL_FEED.filter((d) => d.category === catFilter);
```

Replace with:
```tsx
function DealFeedView({ items, loading, lastUpdated, onRefresh }: {
  items: DealItem[];
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}) {
  const [catFilter, setCatFilter] = useState<DealCategory | "all">("all");

  const filtered = useMemo(() => {
    const feed = catFilter === "all"
      ? items
      : items.filter((d) => d.category === catFilter);
```

Replace every remaining `DEAL_FEED` inside `DealFeedView` with `items`:
- `for (const d of DEAL_FEED)` → `for (const d of items)`
- `DEAL_FEED.filter((d) => d.sentiment === "negative")` → `items.filter(...)`
- `DEAL_FEED.filter((d) => d.sentiment === "positive")` → `items.filter(...)`
- `DEAL_FEED.filter((d) => d.relevance === "high")` → `items.filter(...)`
- `DEAL_FEED.length` → `items.length`

Add same live-status strip at top of `DealFeedView` return, using the same pattern as Task 11 Step 1.

- [ ] **Step 3: Update `JurisdictionWatchView` to accept `events` prop**

Find:
```tsx
function JurisdictionWatchView({ lesseeIdByName, liveTotalExposure }: {
  ...
}) {
  const events = useMemo(() => {
    const sentOrder: Record<SignalSentiment, number> = { negative: 0, neutral: 1, positive: 2 };
    return [...JURISDICTION_EVENTS].sort(
```

Replace with:
```tsx
function JurisdictionWatchView({ events: rawEvents, loading, lastUpdated, onRefresh, lesseeIdByName, liveTotalExposure }: {
  events: JurisdictionEvent[];
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  lesseeIdByName: Map<string, string>;
  liveTotalExposure: (names: string[], fallback: number) => number;
}) {
  const events = useMemo(() => {
    const sentOrder: Record<SignalSentiment, number> = { negative: 0, neutral: 1, positive: 2 };
    return [...rawEvents].sort(
```

Replace `JURISDICTION_EVENTS` references inside the function (the KPI counts `events.filter(...)` are already using the `events` variable — check they reference the sorted local `events` const, not the import).

Add live-status strip using same pattern.

### B — Add `Simulated` badge to `LesseeRadarView`

- [ ] **Step 4: Add Simulated badge to the Lessee Radar section header**

Inside `LesseeRadarView`, find the outermost `return (` and its opening `<div>`. Add immediately after `<div>`:

```tsx
{/* Simulated data notice */}
<div style={{
  display: "inline-flex", alignItems: "center", gap: "0.375rem",
  background: "#F1F5F9", border: "1px solid #CBD5E1",
  borderRadius: "9999px", padding: "0.2rem 0.625rem",
  fontSize: "0.72rem", color: "#64748B", marginBottom: "1rem",
}}>
  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#94A3B8", flexShrink: 0 }} />
  Simulated — real payment, schedule & rating APIs not publicly available
</div>
```

### C — Wire hooks in main `Intelligence` page component

- [ ] **Step 5: Import hooks + wire data in the main page component**

At the top of `Intelligence.tsx`, add imports:
```tsx
import { useMacroSignals } from "../services/useMacroSignals";
import { useNewsFeed } from "../services/useNewsFeed";
```

Inside the main `Intelligence` page function (the bottom component, around line 1543), add hook calls right after existing hooks/memos:

```tsx
const { signals: liveSignals, loading: macroLoading, lastUpdated: macroUpdated, refresh: refreshMacro } = useMacroSignals();
const { dealItems: liveDealItems, jxEvents: liveJxEvents, loading: newsLoading, lastUpdated: newsUpdated, refresh: refreshNews } = useNewsFeed();
```

Then update the badge counts to use live data:
```tsx
// Replace:
const highSignals  = MACRO_SIGNALS.filter((s) => s.severity === "high").length;
const negDeals     = DEAL_FEED.filter((d) => d.sentiment === "negative" && d.relevance === "high").length;
const negJx        = JURISDICTION_EVENTS.filter((e) => e.sentiment === "negative").length;

// With:
const highSignals  = liveSignals.filter((s) => s.severity === "high").length;
const negDeals     = liveDealItems.filter((d) => d.sentiment === "negative" && d.relevance === "high").length;
const negJx        = liveJxEvents.filter((e) => e.sentiment === "negative").length;
```

Update the live-indicator pill in the page header:
```tsx
// Replace:
Live · Updated 29 Apr 2026

// With:
{macroLoading || newsLoading ? "Refreshing…" : macroUpdated
  ? `Live · Updated ${macroUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
  : "Static data"}
```

Update the render calls to pass props:
```tsx
// Replace:
{activeTab === "signals"   && <MacroSignalsView lesseeIdByName={lesseeIdByName} liveExposure={liveExposure} />}
{activeTab === "deal-feed" && <DealFeedView />}
{activeTab === "jx-watch"  && <JurisdictionWatchView lesseeIdByName={lesseeIdByName} liveTotalExposure={liveTotalExposure} />}

// With:
{activeTab === "signals"   && (
  <MacroSignalsView
    signals={liveSignals}
    loading={macroLoading}
    lastUpdated={macroUpdated}
    onRefresh={refreshMacro}
    lesseeIdByName={lesseeIdByName}
    liveExposure={liveExposure}
  />
)}
{activeTab === "deal-feed" && (
  <DealFeedView
    items={liveDealItems}
    loading={newsLoading}
    lastUpdated={newsUpdated}
    onRefresh={refreshNews}
  />
)}
{activeTab === "jx-watch"  && (
  <JurisdictionWatchView
    events={liveJxEvents}
    loading={newsLoading}
    lastUpdated={newsUpdated}
    onRefresh={refreshNews}
    lesseeIdByName={lesseeIdByName}
    liveTotalExposure={liveTotalExposure}
  />
)}
```

Remove the now-unused `MACRO_SIGNALS`, `DEAL_FEED`, `JURISDICTION_EVENTS` imports from `intelligenceData.ts` at the top of the file (keep types and `LESSEE_RADAR`).

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors related to `Intelligence.tsx` or the new hooks/routes.

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/Intelligence.tsx src/app/services/useMacroSignals.ts src/app/services/useNewsFeed.ts
git commit -m "feat: wire live macro signals + news feed into Intelligence page with refresh UI and Simulated badge"
```

---

## Task 12: Add environment variables to Vercel + document

- [ ] **Step 1: Add env vars to Vercel project**

```bash
vercel env add EIA_API_KEY
# Paste key from https://www.eia.gov/opendata/ (free registration)

vercel env add NEWSAPI_KEY
# Paste key from https://newsapi.org/register (free tier)
```

Set for `production` and `preview` environments.

- [ ] **Step 2: Pull env for local dev**

```bash
vercel env pull .env.local
```

This adds `EIA_API_KEY` and `NEWSAPI_KEY` to `.env.local` for `vercel dev` to use. Note: these must NOT be prefixed with `VITE_` — they are server-side only.

- [ ] **Step 3: Final commit**

```bash
git add .env.local
git commit -m "chore: pull vercel env vars for local dev"
```

---

## Self-Review Notes

- All `MACRO_SIGNALS` references in `MacroSignalsView` replaced with `signals` prop ✓
- All `DEAL_FEED` references in `DealFeedView` replaced with `items` prop ✓
- All `JURISDICTION_EVENTS` references in `JurisdictionWatchView` replaced with `events` (via `rawEvents` sorted into `events`) ✓
- `mergeLiveData` signal IDs (`sig-02`, `sig-03`, `sig-04`, `sig-06`) match `intelligenceData.ts` ✓
- `LiveMacroData` type is inlined in `useMacroSignals.ts` — not imported from `api/` which is a separate bundle ✓
- `classifyCategory`, `classifySentiment`, `classifyRelevance` signatures in `newsapi.ts` match what `newsapi.test.ts` imports ✓
- `LESSEE_RADAR` import and `redLessees` badge count unchanged (stays static) ✓
- No `VITE_` prefix on `EIA_API_KEY` or `NEWSAPI_KEY` ✓
- `Buffer.from` used in `newsapi.ts` (Node.js built-in) — works in Vercel serverless, not in Vercel Edge. Since `chat.ts` uses edge (`export const config = { runtime: "edge" }`), these new routes must NOT include that export. They default to serverless (Node.js). Confirmed: no `export const config` in `macro.ts` or `news.ts` ✓
