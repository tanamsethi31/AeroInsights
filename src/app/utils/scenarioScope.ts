// src/app/utils/scenarioScope.ts
//
// Single-dimension scope filter for scenario runs. Lets a user run a
// stress scenario against a SUBSET of the portfolio — one airline, one
// fleet of A320s, a single tail — instead of the whole book. The scope
// shape is intentionally small so it round-trips cleanly through the
// scenario_runs.result JSONB column for audit + replay.

import type { Asset, Lessee, Lease, Provision } from "../types/portfolio";

export type ScopeDimension = "all" | "aircraft" | "lessee" | "aircraftType";

export interface ScenarioScope {
  dimension: ScopeDimension;
  /** Asset.id / Lessee.id / aircraft_type string — depending on dimension.
   *  Ignored when dimension === "all". */
  ids: string[];
}

export const SCOPE_ALL: ScenarioScope = { dimension: "all", ids: [] };

/** Human-readable label shown on run cards + history badges. */
export function scopeLabel(
  scope: ScenarioScope,
  assets: Asset[],
  lessees: Lessee[],
): string {
  if (scope.dimension === "all" || scope.ids.length === 0) return "Whole portfolio";
  if (scope.dimension === "aircraft") {
    if (scope.ids.length === 1) {
      const a = assets.find((x) => x.id === scope.ids[0]);
      return a ? `${a.registration ?? "Aircraft"} · ${a.aircraft_type ?? ""}` : "1 aircraft";
    }
    return `${scope.ids.length} aircraft`;
  }
  if (scope.dimension === "lessee") {
    if (scope.ids.length === 1) {
      const l = lessees.find((x) => x.id === scope.ids[0]);
      return l ? l.name : "1 lessee";
    }
    return `${scope.ids.length} lessees`;
  }
  // aircraftType
  if (scope.ids.length === 1) return `${scope.ids[0]} fleet`;
  return `${scope.ids.length} aircraft types`;
}

/** Filter asset / lease / provision arrays down to the scope's subset.
 *  Caller passes filtered arrays into the scenario engine so ECL,
 *  Monte Carlo, and Shapley all compute against the right slice. */
export function applyScope(
  scope: ScenarioScope,
  assets: Asset[],
  leases: Lease[],
  provisions: Provision[],
): { assets: Asset[]; leases: Lease[]; provisions: Provision[] } {
  if (scope.dimension === "all" || scope.ids.length === 0) {
    return { assets, leases, provisions };
  }

  let assetIdSet: Set<string>;
  if (scope.dimension === "aircraft") {
    assetIdSet = new Set(scope.ids);
  } else if (scope.dimension === "lessee") {
    const lesseeSet = new Set(scope.ids);
    assetIdSet = new Set(
      leases
        .filter((l) => lesseeSet.has(l.lessee_id))
        .map((l) => l.asset_id),
    );
  } else { // aircraftType
    const typeSet = new Set(scope.ids);
    assetIdSet = new Set(
      assets.filter((a) => typeSet.has(a.aircraft_type)).map((a) => a.id),
    );
  }

  return {
    assets:     assets.filter((a) => assetIdSet.has(a.id)),
    leases:     leases.filter((l) => assetIdSet.has(l.asset_id)),
    provisions: provisions.filter((p) => assetIdSet.has(p.asset_id)),
  };
}

/** Unique aircraft types present in the portfolio (used by the picker). */
export function distinctAircraftTypes(assets: Asset[]): string[] {
  return Array.from(new Set(assets.map((a) => a.aircraft_type).filter(Boolean))).sort();
}
