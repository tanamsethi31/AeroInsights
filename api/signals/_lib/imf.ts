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
