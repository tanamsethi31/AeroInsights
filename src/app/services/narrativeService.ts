import type { ScenarioRunResult } from "../components/scenarios/RunResultPanel";

const BASE_ECL = 47.2;

export async function generateNarrative(run: ScenarioRunResult): Promise<string | null> {
  const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string | undefined;
  const apiKey   = import.meta.env.VITE_AZURE_OPENAI_KEY    as string | undefined;

  // Skip API call when env vars are absent or placeholder
  if (!endpoint || !apiKey || apiKey === "PLACEHOLDER" || endpoint === "PLACEHOLDER") {
    return null;
  }

  const eclPct      = ((run.ecl / 2840) * 100).toFixed(2);
  const changePct   = (((run.ecl - BASE_ECL) / BASE_ECL) * 100).toFixed(1);
  const changeLabel = run.ecl >= BASE_ECL ? "increase" : "decrease";
  const driver1     = run.shapley[0];
  const driver2     = run.shapley[1] ?? run.shapley[0];

  const prompt = `You are a financial risk analyst writing a factual run summary. Use ONLY the numbers provided below. Do not invent, infer, or round any value differently from what is shown. Output exactly 4-6 sentences. No bullet points. No headings. Plain prose only.

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

    if (!response.ok) return null;

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;

    // 3-anchor validation: each anchor must appear verbatim in the response
    const anchor1 = run.ecl.toFixed(1);                          // e.g. "61.2"
    const anchor2 = driver1.contribution.toFixed(0) + "pp";      // e.g. "46pp"
    const anchor3 = run.s3LeaseCount.toString();                  // e.g. "4"

    if (!text.includes(anchor1) || !text.includes(anchor2) || !text.includes(anchor3)) {
      return null;
    }

    return text.trim();
  } catch {
    return null;
  }
}
