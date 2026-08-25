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
// session" means here. Only successes are cached: a failure is left out so
// the next mount gets a fresh attempt instead of replaying a stale error
// for the rest of the session.
//
// In-flight requests are tracked separately (`pending`), reference-counted
// by how many mounted consumers are waiting on them, and aborted only when
// the last one leaves — an abandoned fetch would otherwise keep a live
// Supabase read + NumPy ECL computation running server-side for nobody.
interface PendingEntry {
  promise: Promise<RiskEngineECL>;
  controller: AbortController;
  refCount: number;
}

const cache = new Map<string, RiskEngineECL>();
const pending = new Map<string, PendingEntry>();

function fetchRiskEngineECL(orgId: string, signal: AbortSignal): Promise<RiskEngineECL> {
  return (async () => {
    try {
      const res = await fetch("/api/risk-engine/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": orgId },
        body: JSON.stringify({ org_id: orgId, persist: false }),
        signal,
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
  })();
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
    if (cached) {
      setResult(cached);
      return;
    }

    let entry = pending.get(orgId);
    if (!entry) {
      const controller = new AbortController();
      const promise = fetchRiskEngineECL(orgId, controller.signal);
      entry = { promise, controller, refCount: 0 };
      pending.set(orgId, entry);
    }
    const activeEntry = entry;
    activeEntry.refCount++;
    setResult({ ecl: null, loading: true, error: null });

    let cancelled = false;
    activeEntry.promise.then((next) => {
      // Only the entry that's still current for this orgId gets to
      // record the outcome — a superseded/aborted attempt must not
      // clobber a newer one.
      if (pending.get(orgId) === activeEntry) {
        pending.delete(orgId);
        if (next.error === null) cache.set(orgId, next);
      }
      if (!cancelled) setResult(next);
    });

    return () => {
      cancelled = true;
      activeEntry.refCount--;
      // Last interested consumer leaving before the request settles:
      // cancel it so the backend (a Supabase read + NumPy ECL
      // computation) doesn't keep running for nobody.
      if (activeEntry.refCount === 0 && pending.get(orgId) === activeEntry) {
        activeEntry.controller.abort();
        pending.delete(orgId);
      }
    };
  }, [orgId, hasUpload]);

  return result;
}
