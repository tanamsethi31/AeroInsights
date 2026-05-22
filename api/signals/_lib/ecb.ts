// api/signals/_lib/ecb.ts

export interface EcbObservation {
  value: number;
  date: string;
}

export interface EcbSdmxJson {
  dataSets: Array<{
    series: Record<string, {
      observations: Record<string, [number | null, ...unknown[]]>;
    }>;
  }>;
  structure: {
    dimensions: {
      observation: Array<{
        values: Array<{ id: string }>;
      }>;
    };
  };
}

export function parseEcbResponse(data: EcbSdmxJson): EcbObservation[] {
  const series = Object.values(data.dataSets[0]?.series ?? {})[0];
  if (!series) return [];
  const timeValues = data.structure.dimensions.observation[0]?.values ?? [];
  return Object.entries(series.observations)
    .map(([idx, obs]) => ({
      value: obs[0] as number | null,
      date: timeValues[parseInt(idx)]?.id ?? "",
    }))
    .filter((o): o is EcbObservation => o.value !== null && !isNaN(o.value) && o.date !== "")
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchEcbSeries(seriesKey: string): Promise<EcbObservation[]> {
  const url = `https://data-api.ecb.europa.eu/service/data/${seriesKey}?format=jsondata&lastNObservations=2`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`ECB ${seriesKey}: HTTP ${res.status}`);
  return parseEcbResponse(await res.json() as EcbSdmxJson);
}
