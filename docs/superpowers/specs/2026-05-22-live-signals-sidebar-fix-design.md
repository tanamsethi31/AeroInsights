# Design: Live Macro Signals + News Feed + Sidebar Scrollbar Fix

**Date:** 2026-05-22  
**Status:** Approved

---

## Overview

Two independent features:

1. **Live Signals** — Replace hardcoded `MACRO_SIGNALS` and `DEAL_FEED` arrays with data fetched from verified public APIs via Vercel serverless routes. News for Deal Feed and Jurisdiction Watch via NewsAPI (free tier). Macro signals via ECB, IMF, World Bank, EIA (all free).
2. **Sidebar Scrollbar Fix** — Prevent content width from jumping when the sidebar scrollbar appears/disappears by adding `scrollbar-gutter: stable`.

---

## Feature 1: Live Macro Signals + News Feed

### Goals
- Macro signals (fuel, FX, rates, GDP) show real values from upstream providers
- Deal Feed and Jurisdiction Watch show real aviation news headlines
- API keys never reach the browser
- Graceful fallback to static defaults when APIs are unavailable
- No change to existing `MacroSignal`, `DealItem`, `JurisdictionEvent` types

### Non-Goals
- Lessee Radar payment/schedule/rating signals — no viable public APIs; stays hash-simulated with a "Simulated" badge
- LLM-generated narratives — templated substitution only, free and deterministic

---

### Architecture

```
Browser ──fetch──► /api/signals/macro  ──► ECB SDMX + IMF + World Bank + EIA
        ──fetch──► /api/signals/news   ──► NewsAPI.org (aviation keywords)
        (unchanged) OFAC snapshot from existing src/data/ofacSnapshot.ts
```

All upstream calls happen in Vercel serverless functions. Keys are server-side env vars only. Cache-Control headers on each route limit upstream calls.

---

### API Sources

| Signal | Provider | Auth | Cache TTL | Notes |
|--------|----------|------|-----------|-------|
| ECB Deposit Facility Rate | ECB SDMX REST API | None | 4h | `FM/B.U2.EUR.4F.KR.DFR.LEV` |
| USD/EUR spot rate | ECB SDMX REST API | None | 4h | `EXR/D.USD.EUR.SP00.A` |
| GBP/USD spot rate | ECB SDMX REST API | None | 4h | `EXR/D.GBP.EUR.SP00.A` + invert |
| Brent crude (WTI proxy for Jet-A1) | EIA API v2 | `EIA_API_KEY` | 4h | PET.RBRTE.W (weekly Brent) |
| India GDP growth | IMF SDMX API | None | 24h | `WEO` dataset, latest observation |
| US GDP growth | World Bank API | None | 24h | `NY.GDP.MKTP.KD.ZG` indicator |
| Aviation news (Deal Feed) | NewsAPI.org | `NEWSAPI_KEY` | 1h | Query: `aviation OR airline OR aircraft` |
| Jurisdiction news | NewsAPI.org | `NEWSAPI_KEY` | 1h | Queries filtered to countries in existing JX_EVENTS (India, Brazil, UAE, Sri Lanka, Ireland, Singapore) |

---

### New Files

#### Vercel API Routes

**`api/signals/macro.ts`**  
Aggregates ECB, EIA, IMF, World Bank into a `MacroSignal[]` JSON response.  
- Fetches all upstream sources in parallel (`Promise.all`)
- Transforms raw responses into `MacroSignal` shape
- Injects templated narratives (see below)
- Returns `Cache-Control: s-maxage=14400, stale-while-revalidate=3600`
- On any upstream failure: returns cached Vercel edge response (stale) or falls back to static defaults

**`api/signals/news.ts`**  
Returns `DealItem[]` + `JurisdictionEvent[]` from NewsAPI.  
- Queries NewsAPI with aviation-specific keywords
- Classifies each article by `DealCategory` based on keyword matching
- Returns `Cache-Control: s-maxage=3600, stale-while-revalidate=600`
- On failure: returns empty array (caller renders "No live feed — try again shortly")

#### Library Functions

**`api/signals/_lib/ecb.ts`** — ECB SDMX fetch + parse  
**`api/signals/_lib/eia.ts`** — EIA v2 fetch + parse  
**`api/signals/_lib/imf.ts`** — IMF SDMX fetch + parse  
**`api/signals/_lib/worldbank.ts`** — World Bank REST fetch + parse  
**`api/signals/_lib/newsapi.ts`** — NewsAPI fetch + article-to-DealItem/JxEvent transform  
**`api/signals/_lib/templates.ts`** — Narrative templates with `{value}`, `{prevValue}`, `{change}`, `{direction}` substitution

Each lib module exports a typed `fetch*()` function and a `parse*()` function, kept separate so they can be unit-tested without HTTP.

#### Frontend Hooks

**`src/app/services/useMacroSignals.ts`**  
```ts
interface UseMacroSignalsResult {
  signals: MacroSignal[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}
```
- Fetches `/api/signals/macro` on mount
- Stores last-good result in `localStorage` keyed `aeroinsights_macro_v1`
- Re-fetches every 30 min while page is open
- Exports `lastUpdated` timestamp for display

**`src/app/services/useNewsFeed.ts`**  
```ts
interface UseNewsFeedResult {
  dealItems: DealItem[];
  jxEvents: JurisdictionEvent[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}
```
- Same pattern: fetch, localStorage cache, 30-min poll

---

### Modified Files

**`src/app/data/intelligenceData.ts`**  
- Static `MACRO_SIGNALS`, `DEAL_FEED`, `JX_EVENTS` arrays become the fallback defaults (renamed with `_DEFAULT_` prefix)
- Existing types (`MacroSignal`, `DealItem`, etc.) stay unchanged

**`src/app/pages/Intelligence.tsx`** (and sub-pages)  
- Import `useMacroSignals()` and `useNewsFeed()` hooks
- Replace static array references with hook data
- Add "Last updated: X min ago · Source" line under each signal card
- Add manual Refresh button in the section header
- Add loading skeleton while first fetch is in-flight
- "Simulated" badge on Lessee Radar signals (small grey pill, non-intrusive)

---

### Narrative Templating

Each signal type has a template string in `templates.ts` with `{variable}` placeholders:

```ts
const FUEL_NARRATIVE = {
  global: "Platts Jet-A1 Rotterdam is {value} as of {date}, {changeDir} {changePct} since {prevDate}.",
  portfolio: "{lesseeCount} lessees in your portfolio are exposed, totalling ${exposureUSD}M ({exposurePct}% of book).",
  action: "At current fuel price, consider updating your Fuel Spike scenario baseline.",
};
```

Substitution runs in the `macro.ts` API route after fetching live values. The static portfolio-specific text (lessee names, exposures) comes from the existing `MACRO_SIGNALS` defaults and does not change dynamically — only the market values update.

---

### Error Handling

| Failure | Behaviour |
|---------|-----------|
| Upstream API timeout | Return `504` with `{ error: "upstream_timeout" }`; client renders stale localStorage data |
| Upstream API rate-limited | Return `429`; client renders stale data with "Refreshed Xh ago" |
| Missing API key | Return `503 { error: "not_configured" }`; client renders static fallback |
| Partial failure (e.g. EIA down) | Return available signals; omit failed signals; include `_partial: true` flag |
| NewsAPI empty | Return empty array; UI shows "No live news — check again shortly" |

---

### Environment Variables

```
EIA_API_KEY=<from eia.gov free registration>
NEWSAPI_KEY=<from newsapi.org free tier>
```

Added to Vercel dashboard (not `VITE_` prefix — server-side only).

---

## Feature 2: Sidebar Scrollbar Fix

### Root Cause

`SidebarContent` in `src/app/components/ui/sidebar.tsx:377` has `overflow-auto`. When the nav content grows tall enough to overflow, the OS scrollbar appears and consumes ~15px of the content area, causing a visible width shift.

### Fix

**`src/app/components/ui/sidebar.tsx` — line 377**  
Add `scrollbar-gutter: stable` to the `SidebarContent` className.

This CSS property (supported in all modern browsers) permanently reserves space for the scrollbar gutter regardless of whether a scrollbar is present, eliminating the layout shift.

**`src/index.css` (or global stylesheet)**  
Add thin custom scrollbar styling for the sidebar:

```css
/* Thin, unobtrusive sidebar scrollbar */
[data-sidebar="content"]::-webkit-scrollbar { width: 4px; }
[data-sidebar="content"]::-webkit-scrollbar-track { background: transparent; }
[data-sidebar="content"]::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
```

This makes the reserved gutter look like an intentional design detail (hairline track) rather than dead space, and matches the dark sidebar theme.

### Files Touched
- `src/app/components/ui/sidebar.tsx` — one class added to `SidebarContent`
- `src/index.css` — 5 lines of custom scrollbar CSS

---

## Implementation Order

1. Sidebar fix (10 min, zero risk, instant polish)
2. `_lib/` fetch modules (ECB, EIA, IMF, World Bank, NewsAPI)
3. `/api/signals/macro.ts` route
4. `/api/signals/news.ts` route
5. `useMacroSignals` and `useNewsFeed` hooks
6. Intelligence page integration (wire hooks, add refresh UI, add Simulated badge)
7. Env var setup instructions

---

## Success Criteria

- Sidebar content width is identical with and without a scrollbar visible
- Macro signals show values that match current ECB/EIA/IMF publications
- Deal Feed shows headlines from the last 24h when online
- All API keys are server-side only — no `VITE_` prefixed key exists in codebase
- When APIs are unavailable, the app renders the last-known-good data without crashing
- Lessee Radar clearly labels simulated signals
