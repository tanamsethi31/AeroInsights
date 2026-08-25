// src/app/hooks/useRiskEngineECL.ts
//
// Fetches the real per-lease IFRS-9 ECL total from api/risk-engine/compute.py
// for orgs with a real uploaded portfolio. Demo orgs (hasUpload === false)
// never call it — see docs/superpowers/specs/2026-08-25-wire-up-risk-engine-design.md
// for why (the sample portfolio has no backing Supabase rows, so the engine
// would correctly return $0).
import { useState, useEffect } from "react";
import { useData } from "../contexts/DataContext";

export interface RiskEngineECL {
  /** total_ecl in $M from the engine, or null while loading / unavailable / not applicable. */
  ecl: number | null;
  loading: boolean;
  error: string | null;
}

const IDLE: RiskEngineECL = { ecl: null, loading: false, error: null };

export function parseRiskEngineResponse(
  status: number,
  body: unknown,
): { ecl: number | null; error: string | null } {
  if (
    status === 200 &&
    body !== null &&
    typeof body === "object" &&
    typeof (body as { total_ecl?: unknown }).total_ecl === "number"
  ) {
    return { ecl: (body as { total_ecl: number }).total_ecl, error: null };
  }
  const message =
    body !== null && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : `HTTP ${status}`;
  return { ecl: null, error: message };
}

// Module-level (not React state) so a result survives remounts within the
// same SPA session (e.g. navigating Risk & ECL → Scenarios → back) without
// refetching, and so two components mounting in the same commit (e.g.
// Scenarios.tsx and its child ConcentrationStressTab) converge on a single
// in-flight request instead of both firing a POST. This is a new pattern in
// this codebase, not one borrowed from an existing hook. Not persisted
// anywhere — a hard page reload starts fresh, which is what "once per
// session" means here. Only successes are cached (see below): a failure is
// left out so the next mount gets a fresh attempt instead of replaying a
// stale error for the rest of the session.
const cache = new Map<string, RiskEngineECL | Promise<RiskEngineECL>>();

async function fetchRiskEngineECL(orgId: string): Promise<RiskEngineECL> {
  try {
    const res = await fetch("/api/risk-engine/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Org-Id": orgId },
      body: JSON.stringify({ org_id: orgId, persist: false }),
    });
    const body = await res.json().catch(() => null);
    const parsed = parseRiskEngineResponse(res.status, body);
    return { ecl: parsed.ecl, loading: false, error: parsed.error };
  } catch (err) {
    return {
      ecl: null,
      loading: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function useRiskEngineECL(): RiskEngineECL {
  const { orgId, hasUpload } = useData();
  const [result, setResult] = useState<RiskEngineECL>(IDLE);

  useEffect(() => {
    if (!hasUpload || !orgId) {
      setResult(IDLE);
      return;
    }

    const cached = cache.get(orgId);
    if (cached && !(cached instanceof Promise)) {
      setResult(cached);
      return;
    }

    let cancelled = false;
    setResult({ ecl: null, loading: true, error: null });

    // Reuse an in-flight request from a concurrently-mounted caller if one
    // exists; otherwise start one and publish it to the cache immediately
    // (synchronously, before awaiting) so any sibling mounting in the same
    // commit finds it instead of firing its own POST.
    const inFlight = cached instanceof Promise ? cached : fetchRiskEngineECL(orgId);
    if (!(cached instanceof Promise)) {
      cache.set(orgId, inFlight);
    }

    inFlight.then((next) => {
      if (next.error === null) {
        cache.set(orgId, next);
      } else if (cache.get(orgId) === inFlight) {
        // Don't memoize a failure — leave the cache empty so the next
        // mount (e.g. next page navigation) retries instead of replaying
        // a transient error for the rest of the session.
        cache.delete(orgId);
      }
      if (!cancelled) setResult(next);
    });

    return () => {
      cancelled = true;
    };
  }, [orgId, hasUpload]);

  return result;
}
