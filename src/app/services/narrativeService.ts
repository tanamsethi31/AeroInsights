/**
 * narrativeService — Azure OpenAI narrative generation for scenario runs.
 *
 * Builds a fully-injected prompt from ScenarioRunResult data, POSTs to the
 * Azure OpenAI Chat Completions endpoint, and validates three numeric anchors
 * in the response before returning. Returns null on any error, missing env
 * vars, or validation failure — the caller (Scenarios.tsx) hides the summary
 * card when null is received.
 */
import type { ScenarioRunResult } from "../components/scenarios/RunResultPanel";
import { BASE_ECL } from "../utils/eclCalculator";

function buildFallbackNarrative(run: ScenarioRunResult): string {
  const eclPct     = ((run.ecl / 2840) * 100).toFixed(2);
  const changePct  = (((run.ecl - BASE_ECL) / BASE_ECL) * 100);
  const changeSign = changePct >= 0 ? "+" : "";
  const direction  = changePct >= 0 ? "increase" : "decrease";
  const driver1    = run.shapley[0];
  const driver2    = run.shapley[1] ?? run.shapley[0];
  const lessee1    = run.topLessees[0];
  const lessee2    = run.topLessees[1];
  const modeStr    = run.mode === "montecarlo"
    ? `Monte Carlo simulation (${run.paths?.toLocaleString() ?? "10,000"} paths)`
    : "deterministic model";

  return (
    `The ${run.name} scenario produces a portfolio ECL of $${run.ecl.toFixed(1)}M, ` +
    `representing ${eclPct}% of book value and a ${changeSign}${changePct.toFixed(1)}% ${direction} vs. the Baseline ($${BASE_ECL}M). ` +
    `${run.s3LeaseCount} lease${run.s3LeaseCount !== 1 ? "s" : ""} migrate to Stage 3 under this scenario, ` +
    `led by ${lessee1.name} ($${lessee1.ecl.toFixed(1)}M ECL, ${lessee1.jurisdiction}) ` +
    `and ${lessee2.name} ($${lessee2.ecl.toFixed(1)}M ECL, ${lessee2.jurisdiction}). ` +
    `The primary drivers are ${driver1.driver} (${driver1.contribution}% Shapley attribution) ` +
    `and ${driver2.driver} (${driver2.contribution}% attribution). ` +
    `Run via ${modeStr}, ${run.s3LeaseCount} aircraft have recoverable amounts below carrying value, ` +
    `triggering potential IAS 36 impairment review.`
  );
}

export async function generateNarrative(run: ScenarioRunResult): Promise<string | null> {
  const baseEndpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string | undefined;
  const apiKey       = import.meta.env.VITE_AZURE_OPENAI_KEY      as string | undefined;
  const deployment   = import.meta.env.VITE_AZURE_OPENAI_AGENT_DEPLOYMENT as string | undefined;

  // Skip API call when env vars are absent — use rich deterministic fallback
  if (!baseEndpoint || !apiKey || !deployment || apiKey === "PLACEHOLDER" || baseEndpoint === "PLACEHOLDER") {
    return buildFallbackNarrative(run);
  }

  // Construct full Azure OpenAI chat completions URL from base resource URL + deployment name
  const endpoint = `${baseEndpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

  // Guard against malformed run data — fall back to deterministic summary
  if (!run.shapley.length || run.topLessees.length < 2) return buildFallbackNarrative(run);

  const eclPct      = ((run.ecl / 2840) * 100).toFixed(2);
  const changePct   = (((run.ecl - BASE_ECL) / BASE_ECL) * 100).toFixed(1);
  const changeLabel = run.ecl >= BASE_ECL ? "increase" : "decrease";
  const driver1     = run.shapley[0];
  const driver2     = run.shapley[1] ?? run.shapley[0];

  const prompt = `You are a financial risk analyst writing a factual run summary. Use ONLY the numbers provided below. Do not invent, infer, or round any value differently from what is shown. Output exactly 4-6 sentences. No bullet points. No headings. Plain prose only. Always write counts and quantities as digits, never as words (write "2", not "Two"; write "4", not "Four").

RUN DATA:
- Scenario: ${run.name}
- Portfolio ECL: $${run.ecl}M
- Book value: $2,840M
- ECL as % of book: ${eclPct}%
- Change vs. Baseline ($47.2M): ${changePct}%
- Stage 3 lease count: ${run.s3LeaseCount}
- Stage 3 ECL: $${run.s3}M
- Top lessee 1: ${run.topLessees[0].name}, $${run.topLessees[0].ecl}M, ${run.topLessees[0].jurisdiction}
- Top lessee 2: ${run.topLessees[1].name}, $${run.topLessees[1].ecl}M, ${run.topLessees[1].jurisdiction}
- Shapley driver 1: ${driver1.driver}, +${driver1.contribution.toFixed(0)}pp
- Shapley driver 2: ${driver2.driver}, +${driver2.contribution.toFixed(0)}pp
- Aircraft below carrying value: ${run.s3LeaseCount}

OUTPUT TEMPLATE (follow this structure exactly, substituting bracketed values):
"The [Scenario Name] scenario produces a portfolio ECL of $[ecl]M, representing [ecl%]% of book value and a [change]% ${changeLabel} vs. the Baseline. [s3LeaseCount] leases migrate to Stage 3 under this scenario, led by [lessee1] ($[ecl1]M ECL, [juris1]) and [lessee2] ($[ecl2]M ECL, [juris2]). The primary drivers are [driver1] (+[contribution1]pp contribution) and [driver2] (+[contribution2]pp contribution). [s3LeaseCount] aircraft have recoverable amounts below carrying value under this scenario, triggering potential IAS 36 review."`;

  try {
    console.log("[narrative] fetching for run", run.id);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 220,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.warn("[narrative] non-200 response:", response.status, await response.text().catch(() => ""));
      return null;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content;
    if (!text) { console.warn("[narrative] no text in response", data); return null; }

    // 3-anchor validation: each anchor must appear verbatim in the response
    const anchor1 = run.ecl.toFixed(1);                          // e.g. "61.2"
    const anchor2 = driver1.contribution.toFixed(0) + "pp";      // e.g. "46pp"
    const anchor3 = ` ${run.s3LeaseCount} `;                      // e.g. " 4 " — prevents trivial substring match

    if (!text.includes(anchor1) || !text.includes(anchor2) || !text.includes(anchor3)) {
      console.warn("[narrative] anchor validation failed", { anchor1, anchor2, anchor3, text });
      return null;
    }

    console.log("[narrative] success for run", run.id);
    return text.trim();
  } catch (err) {
    console.error("[narrative] fetch error:", err);
    return null;
  }
}
