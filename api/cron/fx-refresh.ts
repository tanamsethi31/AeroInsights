// api/cron/fx-refresh.ts
//
// T-5.4 — daily FX refresh from ECB SDMX.
// Schedule: 06:00 UTC (see vercel.json). ECB publishes the reference
// rate around 16:00 CET the previous business day; refreshing at 06:00
// UTC the next morning guarantees a fresh row.
//
// For each (EUR, quote) pair we upsert (date, EUR, quote, rate) AND the
// inverse (date, quote, EUR, 1/rate) so any consumer can look the curve
// up in either direction without doing the maths.

export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SRV = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const CRON_SECRET  = process.env.CRON_SECRET ?? "";

// Currencies we surface in the UI. Each is fetched as EXR.D.<ccy>.EUR.SP00.A.
const QUOTES = ["USD", "GBP", "JPY", "CAD", "AUD", "SGD", "HKD"] as const;

// AED is dollar-pegged at ~3.6725 and ECB doesn't publish it. We pin it
// here so consumers always get a same-day rate.
const PEGGED_TO_USD: Record<string, number> = { AED: 3.6725 };

interface EcbObservationOut { date: string; rate: number }

async function fetchEcbRate(ccy: string): Promise<EcbObservationOut | null> {
  const url = `https://data-api.ecb.europa.eu/service/data/EXR.D.${ccy}.EUR.SP00.A?format=jsondata&lastNObservations=1`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      dataSets: Array<{ series: Record<string, { observations: Record<string, [number | null, ...unknown[]]> }> }>;
      structure: { dimensions: { observation: Array<{ values: Array<{ id: string }> }> } };
    };
    const series  = Object.values(data.dataSets[0]?.series ?? {})[0];
    const times   = data.structure.dimensions.observation[0]?.values ?? [];
    if (!series) return null;
    const [idx, obs] = Object.entries(series.observations)[0] ?? [];
    const v = obs?.[0];
    const d = times[parseInt(idx ?? "0")]?.id;
    if (v == null || !d) return null;
    return { date: d, rate: v as number };
  } catch {
    return null;
  }
}

async function sbInsert(rows: Array<Record<string, unknown>>): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/fx_rates?on_conflict=date,base,quote`, {
    method: "POST",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type":"application/json",
      Prefer:        "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) return `${res.status} ${await res.text()}`;
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: "unauthorised" }), {
        status: 401, headers: { "content-type": "application/json" },
      });
    }
  }
  if (!SUPABASE_URL || !SUPABASE_SRV) {
    return new Response(JSON.stringify({ error: "supabase_not_configured" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }

  const rows: Array<Record<string, unknown>> = [];
  const results: Array<Record<string, unknown>> = [];

  for (const ccy of QUOTES) {
    const obs = await fetchEcbRate(ccy);
    if (!obs) { results.push({ ccy, status: "skipped" }); continue; }
    // (EUR base) → 1 EUR = obs.rate <ccy>
    rows.push({ date: obs.date, base: "EUR", quote: ccy, rate: obs.rate, source: "ecb" });
    // Inverse: 1 <ccy> = 1/obs.rate EUR
    rows.push({ date: obs.date, base: ccy, quote: "EUR", rate: 1 / obs.rate, source: "ecb" });
    results.push({ ccy, status: "ok", date: obs.date, rate: obs.rate });
  }

  // USD-pegged AED — use the latest USD-derived date if we have one.
  const usdRow = rows.find((r) => r.base === "EUR" && r.quote === "USD");
  if (usdRow) {
    const today = usdRow.date as string;
    for (const [pegCcy, pegRate] of Object.entries(PEGGED_TO_USD)) {
      // 1 USD = pegRate <pegCcy>. Convert through EUR:
      // 1 EUR = (EUR→USD) USD = (EUR→USD)*pegRate <pegCcy>
      const eurToUsd = Number(usdRow.rate);
      const eurToPeg = eurToUsd * pegRate;
      rows.push({ date: today, base: "EUR", quote: pegCcy, rate: eurToPeg, source: "pegged_usd" });
      rows.push({ date: today, base: pegCcy, quote: "EUR", rate: 1 / eurToPeg, source: "pegged_usd" });
      results.push({ ccy: pegCcy, status: "pegged", date: today, rate: eurToPeg });
    }
  }

  if (rows.length > 0) {
    const err = await sbInsert(rows);
    if (err) {
      return new Response(JSON.stringify({ error: err, results }), {
        status: 500, headers: { "content-type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ rows: rows.length, results }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
