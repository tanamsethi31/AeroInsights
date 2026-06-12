// api/signals/macro.ts
import { fetchEcbSeries } from "./_lib/ecb";
import { fetchBrentCrude } from "./_lib/eia";
import { fetchGdpGrowth } from "./_lib/imf";
import { verifyAuth0Sub } from "../_lib/auth0";

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

  // Auth gate — endpoint burns paid EIA quota, must be reachable only
  // by authenticated users.
  const auth  = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !(await verifyAuth0Sub(token))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Top-level safety net. Each underlying helper is wrapped in
  // Promise.allSettled below so per-source failures already turn into
  // `partial: true` instead of throwing. But a synchronous error in any
  // helper's module init (e.g. a misconfigured env var, a bad upstream
  // schema, a runtime quirk) would otherwise bubble out as a Vercel 500
  // and surface to the user as a red console error on the Intelligence
  // page. Catch it here and return a `partial: true` empty payload so
  // the client renders cleanly with placeholder data.
  try {
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
  } catch (err) {
    console.error("[/api/signals/macro] unexpected failure:", err);
    const fallback: LiveMacroData = {
      ecbDepositRate: null,
      eurUsd: null,
      brentCrude: null,
      gdp: [],
      fetchedAt: new Date().toISOString(),
      partial: true,
    };
    return new Response(JSON.stringify(fallback), {
      // Return 200 with partial:true rather than 500 — the browser's
      // automatic red error log on non-2xx is the actual user complaint;
      // the client gracefully handles partial data.
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
