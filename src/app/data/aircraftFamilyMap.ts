// src/app/data/aircraftFamilyMap.ts
// Maps aircraft_type strings to AircraftFamily for LGD decay curve selection.
// Unknown types default to "narrowbody" with a console warning.

import type { AircraftFamily } from "./lgdCurves";

// Widebody prefixes checked first (before NB) to avoid A330 matching "A3" NB prefix.
const WB_SUBSTRINGS = [
  "A330", "A340", "A350", "A380",
  "B767", "B777", "B787",
  "767", "777", "787",
];

// Regional prefixes / substrings
const REGIONAL_SUBSTRINGS = [
  "ATR", "CRJ", "Q400", "DASH 8", "DASH8",
  "E170", "E175", "E190", "E195",
];

// Narrowbody prefixes
const NB_SUBSTRINGS = [
  "A220", "A318", "A319", "A320", "A321",
  "B737", "737",
  "E190-E2", "E195-E2",
];

/**
 * Classify an aircraft type string into a value decay family.
 * Matching is case-insensitive substring/prefix.
 * Precedence: widebody > regional > narrowbody > fallback narrowbody.
 */
export function classifyAircraftFamily(aircraftType: string): AircraftFamily {
  const upper = aircraftType.toUpperCase().trim();

  if (WB_SUBSTRINGS.some((s) => upper.includes(s.toUpperCase()))) return "widebody";
  if (REGIONAL_SUBSTRINGS.some((s) => upper.includes(s.toUpperCase()))) return "regional";
  if (NB_SUBSTRINGS.some((s) => upper.includes(s.toUpperCase()))) return "narrowbody";

  console.warn(`[classifyAircraftFamily] Unknown aircraft type "${aircraftType}" — defaulting to narrowbody`);
  return "narrowbody";
}
