// src/app/components/agent/portfolioSummary.ts
import {
  LESSEE_RADAR,
  MACRO_SIGNALS,
  DEAL_FEED,
} from "../../data/intelligenceData";
import {
  DEFAULT_POLICY_RULES,
  PEAK_CONCENTRATIONS,
} from "../../data/concentrationPolicy";
import { BASE_ECL } from "../../utils/eclCalculator";

const M = 1_000_000;

function fmt(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}bn`;
  return `$${(usd / M).toFixed(0)}m`;
}

export function buildPortfolioSummary(): string {
  // Book stats
  const totalExposure = LESSEE_RADAR.reduce((s, e) => s + e.exposureUSD, 0);
  const lesseeCount = LESSEE_RADAR.length;
  const eclPct = ((BASE_ECL * M) / totalExposure * 100).toFixed(1);

  const s3Lessees = LESSEE_RADAR.filter((e) => e.stage === "3");
  const s2Lessees = LESSEE_RADAR.filter((e) => e.stage === "2");
  const s1Lessees = LESSEE_RADAR.filter((e) => e.stage === "1");

  // Policy breaches
  const breaches = DEFAULT_POLICY_RULES
    .filter((r) => r.enabled)
    .map((r) => {
      const peak = PEAK_CONCENTRATIONS[r.dimension];
      return peak.pct > r.limitPct
        ? `${r.dimension} (${peak.name}: ${peak.pct}% vs ${r.limitPct}% limit)`
        : null;
    })
    .filter(Boolean) as string[];

  // High-severity signals
  const highSignals = MACRO_SIGNALS
    .filter((s) => s.severity === "high")
    .map((s) => `${s.name}: ${s.changeLabel}`);

  // Recent deal feed (top 4)
  const recentDeals = DEAL_FEED.slice(0, 4).map(
    (d) => `${d.headline} (${d.hoursAgo}h ago)`
  );

  const lines: string[] = [
    `PORTFOLIO SUMMARY (as at session start):`,
    `Book: ${fmt(totalExposure)} across ${lesseeCount} lessees. ECL: $${BASE_ECL}m (${eclPct}% of book).`,
    ``,
    `Stage 3 (credit-impaired, ${s3Lessees.length} lessees):`,
    ...s3Lessees.map((e) => `  - ${e.lesseeName} (${e.country}): ${fmt(e.exposureUSD)}`),
    ``,
    `Stage 2 (SICR triggered, ${s2Lessees.length} lessees):`,
    ...s2Lessees.map((e) => `  - ${e.lesseeName} (${e.country}): ${fmt(e.exposureUSD)}`),
    ``,
    `Stage 1 (performing, ${s1Lessees.length} lessees):`,
    ...s1Lessees.map((e) => `  - ${e.lesseeName} (${e.country}): ${fmt(e.exposureUSD)}`),
    ``,
    breaches.length > 0
      ? `Active policy breaches: ${breaches.join("; ")}.`
      : `No active policy breaches.`,
    ``,
    `High-severity market signals:`,
    ...(highSignals.length > 0
      ? highSignals.map((s) => `  - ${s}`)
      : ["  - None currently"]),
    ``,
    `Recent deal feed:`,
    ...recentDeals.map((d) => `  - ${d}`),
  ];

  return lines.join("\n");
}
