// src/app/services/scenarioEngine.ts
//
// Routes scenario computation between two engines:
//
//   • client-typescript — instant, in-process (src/app/utils/eclCalculator.ts).
//     Used for deterministic runs because they compute in <1ms; round-tripping
//     to a server would add 200–500ms latency for no compute benefit.
//
//   • python-numpy      — Vercel Function at /api/scenarios/run.
//     Used for Monte Carlo because the client engine's MC was theatrical
//     (just multiplying ECL by fixed factors). The Python kernel does real
//     vectorised NumPy sampling and returns true p5/p95 bounds.
//
// The boundary is set by `mode`, not portfolio size, because the client's MC
// was never a real MC — there's no "fast path" worth keeping. If a future
// scenario type needs heavier compute, extend the routing here, never inline.
//
// See docs/ADR-001-backend-architecture.md for the architectural decision.

import {
  computeECL,
  computeStages,
  BASE_ECL,
  type ScenarioInputs,
} from "../utils/eclCalculator";

export type EngineKind = "client-typescript" | "python-numpy" | "client-fallback";
export type ScenarioMode = "deterministic" | "montecarlo";

export interface ScenarioComputeResult {
  ecl:          number;
  /** P5 ECL across MC paths. null for deterministic. */
  p5:           number | null;
  /** P95 ECL across MC paths. null for deterministic. */
  p95:          number | null;
  /** Standard deviation of ECL across MC paths. null for deterministic. */
  std:          number | null;
  s1:           number;
  s2:           number;
  s3:           number;
  mode:         ScenarioMode;
  paths:        number | null;
  durationMs:   number;
  scenarioHash: string;
  engine:       EngineKind;
}

export interface ScenarioRunRequest {
  inputs:  ScenarioInputs;
  mode:    ScenarioMode;
  /** MC path count. Server enforces 100 ≤ paths ≤ 100,000. */
  paths:   number;
  seed:    number;
  /** Portfolio base ECL. Defaults to BASE_ECL for the demo portfolio. */
  baseECL?: number;
}

const SERVER_ENDPOINT = "/api/scenarios/run";

// ─────────────────────────────────────────────────────────────────────────────
// Hashing helper — matches the server's hashlib.sha256(json).hexdigest()[:12]
// shape closely enough to give a useful identity for client-computed runs.
// Not used for security; only for visual hash chips in the UI.
// ─────────────────────────────────────────────────────────────────────────────

function clientHash(payload: unknown): string {
  const str = JSON.stringify(payload);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(12, "0").slice(0, 12);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-side deterministic path
// ─────────────────────────────────────────────────────────────────────────────

function runDeterministicLocally(req: ScenarioRunRequest): ScenarioComputeResult {
  const start = performance.now();
  const baseECL = req.baseECL ?? BASE_ECL;
  // computeECL uses BASE_ECL internally; for non-demo portfolios we need
  // the *FromBase variant exported below. For now baseECL ≡ BASE_ECL holds.
  const ecl = baseECL === BASE_ECL
    ? computeECL(req.inputs)
    : computeECLScaled(baseECL, req.inputs);
  const stages = computeStages(ecl, req.inputs);
  return {
    ecl,
    p5:   null,
    p95:  null,
    std:  null,
    s1:   stages.s1,
    s2:   stages.s2,
    s3:   stages.s3,
    mode: "deterministic",
    paths: null,
    durationMs:   performance.now() - start,
    scenarioHash: clientHash({ inputs: req.inputs, baseECL }),
    engine: "client-typescript",
  };
}

// Inline scaling so we don't have to widen eclCalculator's exports.
// Mirrors the scaleFactor = baseECL / BASE_ECL path in computeECLFromBase.
function computeECLScaled(baseECL: number, inputs: ScenarioInputs): number {
  const ratio = baseECL / BASE_ECL;
  // computeECL(inputs) returns ECL for the demo portfolio. The macro deltas
  // are linear in scaleFactor, but mitigations/LGD are proportional to
  // baseECL. A clean port is more work than its worth here — fall back to
  // computeECL and post-scale. Off-portfolio support is a follow-up (T-0.3).
  return computeECL(inputs) * ratio;
}

// ─────────────────────────────────────────────────────────────────────────────
// Synthetic MC fallback — used when the server is unreachable so the UI
// doesn't break. Marked `client-fallback` so the engine badge tells the truth.
// ─────────────────────────────────────────────────────────────────────────────

function fallbackSyntheticMC(
  req: ScenarioRunRequest,
  ecl: number,
  stages: { s1: number; s2: number; s3: number }
): ScenarioComputeResult {
  // Pseudo-random spread keyed off the seed, similar shape to the old
  // client-side computeMCRange. Visibly degraded from real MC — that's the
  // point: the engine badge signals "we couldn't reach the server".
  const r = (n: number) => {
    const x = Math.sin((req.seed + n) * 9301 + 49297) * 233280;
    return (x - Math.floor(x));
  };
  const p5  = ecl * (0.58 + r(1) * 0.08);
  const p95 = ecl * (1.68 + r(2) * 0.38);
  return {
    ecl,
    p5,
    p95,
    std:    (p95 - p5) / 3.29, // 90% CI ≈ ±1.645σ
    s1:     stages.s1,
    s2:     stages.s2,
    s3:     stages.s3,
    mode:   "montecarlo",
    paths:  req.paths,
    durationMs:   0,
    scenarioHash: clientHash({ inputs: req.inputs, seed: req.seed, paths: req.paths }),
    engine: "client-fallback",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a scenario through the right engine.
 *
 * - `mode: "deterministic"` → client-side, instant. Always returns engine="client-typescript".
 * - `mode: "montecarlo"`    → POST /api/scenarios/run. On 5xx or network error
 *   falls back to a deterministic-derived synthetic spread tagged "client-fallback".
 */
export async function runScenario(
  req: ScenarioRunRequest
): Promise<ScenarioComputeResult> {
  if (req.mode === "deterministic") {
    return runDeterministicLocally(req);
  }

  try {
    const res = await fetch(SERVER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs:  req.inputs,
        mode:    req.mode,
        paths:   req.paths,
        seed:    req.seed,
        baseECL: req.baseECL ?? BASE_ECL,
      }),
    });
    if (!res.ok) {
      // Log and fall through to fallback.
      console.warn(`[scenarioEngine] server returned ${res.status} — falling back`);
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as ScenarioComputeResult;
    // Defensive: server may someday return an error shape with status 200.
    if (data == null || typeof data.ecl !== "number") {
      throw new Error("Malformed server response");
    }
    return { ...data, engine: "python-numpy" };
  } catch (err) {
    console.warn("[scenarioEngine] MC fallback:", err);
    const baseECL = req.baseECL ?? BASE_ECL;
    const ecl = computeECL(req.inputs) * (baseECL / BASE_ECL);
    const stages = computeStages(ecl, req.inputs);
    return fallbackSyntheticMC(req, ecl, stages);
  }
}

/**
 * Health probe — returns true if the Python engine is reachable.
 * Used by the UI to decide whether to show a "real MC engine online" badge.
 */
export async function probeEngine(): Promise<boolean> {
  try {
    const res = await fetch(SERVER_ENDPOINT, { method: "GET" });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}
