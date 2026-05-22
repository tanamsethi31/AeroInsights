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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

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
