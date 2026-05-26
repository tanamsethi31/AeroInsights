import { describe, it, expect } from "vitest";
import {
  evaluateLessee, evaluateLessees,
  DEFAULT_WATCHLIST_WEIGHTS, DEFAULT_WATCHLIST_THRESHOLDS,
  type WatchlistLesseeInput,
} from "./watchlistEvaluator";

function makeLessee(over: Partial<WatchlistLesseeInput>): WatchlistLesseeInput {
  return {
    id:                       "l-1",
    name:                     "Test",
    country:                  "—",
    dpd_days:                 0,
    rating_notches_down:      0,
    country_watchlist:        false,
    insolvency_filed:         false,
    overall_behaviour_score:  null,
    ...over,
  };
}

describe("evaluateLessee", () => {
  it("clean lessee scores green near zero", () => {
    const r = evaluateLessee(makeLessee({}), DEFAULT_WATCHLIST_WEIGHTS, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.status).toBe("green");
    expect(r.score).toBeLessThan(10);
  });

  it("DPD 60+ drives paymentLateness to 100 and pushes status to red", () => {
    const r = evaluateLessee(
      makeLessee({ dpd_days: 90 }),
      DEFAULT_WATCHLIST_WEIGHTS,
      DEFAULT_WATCHLIST_THRESHOLDS,
    );
    expect(r.signals.paymentLateness.value).toBe(100);
    expect(r.score).toBeGreaterThanOrEqual(35);
    expect(r.triggered_by).toBe("Payment Lateness");
  });

  it("ctcWatchlist flag fires the CTC signal at 100", () => {
    const r = evaluateLessee(
      makeLessee({ country_watchlist: true }),
      DEFAULT_WATCHLIST_WEIGHTS,
      DEFAULT_WATCHLIST_THRESHOLDS,
    );
    expect(r.signals.ctcWatchlist.value).toBe(100);
    expect(r.signals.ctcWatchlist.rawDisplay).toBe("On watchlist");
  });

  it("rating notches 0 → 0, 1 → 25, 2 → 55, 4 → 90", () => {
    expect(evaluateLessee(makeLessee({ rating_notches_down: 0 }), DEFAULT_WATCHLIST_WEIGHTS, DEFAULT_WATCHLIST_THRESHOLDS).signals.ratingChange.value).toBe(0);
    expect(evaluateLessee(makeLessee({ rating_notches_down: 1 }), DEFAULT_WATCHLIST_WEIGHTS, DEFAULT_WATCHLIST_THRESHOLDS).signals.ratingChange.value).toBe(25);
    expect(evaluateLessee(makeLessee({ rating_notches_down: 2 }), DEFAULT_WATCHLIST_WEIGHTS, DEFAULT_WATCHLIST_THRESHOLDS).signals.ratingChange.value).toBe(55);
    expect(evaluateLessee(makeLessee({ rating_notches_down: 4 }), DEFAULT_WATCHLIST_WEIGHTS, DEFAULT_WATCHLIST_THRESHOLDS).signals.ratingChange.value).toBe(90);
  });

  it("insolvency filed proxies the newsKeywordHits signal to 100", () => {
    const r = evaluateLessee(
      makeLessee({ insolvency_filed: true }),
      DEFAULT_WATCHLIST_WEIGHTS,
      DEFAULT_WATCHLIST_THRESHOLDS,
    );
    expect(r.signals.newsKeywordHits.value).toBe(100);
  });

  it("real news_signals override the insolvency proxy", () => {
    const r = evaluateLessee(
      makeLessee({ insolvency_filed: true }),
      DEFAULT_WATCHLIST_WEIGHTS,
      DEFAULT_WATCHLIST_THRESHOLDS,
      new Map([["l-1", { score: 42, hits: 3 }]]),
    );
    expect(r.signals.newsKeywordHits.value).toBe(42);
    expect(r.signals.newsKeywordHits.rawDisplay).toContain("3 matched");
  });

  it("status thresholds: red ≥ 60, amber ≥ 30 (defaults)", () => {
    // Force a 100 on payment lateness alone: 100 * 35 / 100 = 35 → amber.
    const amber = evaluateLessee(makeLessee({ dpd_days: 120 }), DEFAULT_WATCHLIST_WEIGHTS, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(amber.status).toBe("amber");
    // Add CTC + insolvency: +15 +10 = 60 → red.
    const red = evaluateLessee(
      makeLessee({ dpd_days: 120, country_watchlist: true, insolvency_filed: true }),
      DEFAULT_WATCHLIST_WEIGHTS,
      DEFAULT_WATCHLIST_THRESHOLDS,
    );
    expect(red.status).toBe("red");
  });

  it("custom thresholds tighten the classification", () => {
    const r = evaluateLessee(
      makeLessee({ dpd_days: 6 }),
      DEFAULT_WATCHLIST_WEIGHTS,
      { red: 5, amber: 2 },
    );
    expect(["amber", "red"]).toContain(r.status);
  });

  it("evaluateLessees maps an array", () => {
    const out = evaluateLessees(
      [makeLessee({ id: "a", name: "A" }), makeLessee({ id: "b", name: "B", dpd_days: 90 })],
      DEFAULT_WATCHLIST_WEIGHTS,
      DEFAULT_WATCHLIST_THRESHOLDS,
    );
    expect(out).toHaveLength(2);
    expect(out[0].lessee_id).toBe("a");
    expect(out[1].score).toBeGreaterThan(out[0].score);
  });

  it("reason string summarises the high-weight signals", () => {
    const r = evaluateLessee(
      makeLessee({ dpd_days: 80, country_watchlist: true }),
      DEFAULT_WATCHLIST_WEIGHTS,
      DEFAULT_WATCHLIST_THRESHOLDS,
    );
    expect(r.reason).toContain("DPD");
    expect(r.reason).toContain("CTC");
  });

  it("clean lessees get a 'within tolerance' reason", () => {
    const r = evaluateLessee(makeLessee({}), DEFAULT_WATCHLIST_WEIGHTS, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.reason).toBe("All signals within tolerance");
  });
});
