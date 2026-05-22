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
