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

// Module-level so a result survives remounts within the same SPA session
// (e.g. navigating Risk & ECL → Scenarios → back) without refetching. Not
// persisted anywhere — a hard page reload starts fresh, which is what
// "once per session" means here.
const cache = new Map<string, RiskEngineECL>();

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

    const ctrl = new AbortController();
    setResult({ ecl: null, loading: true, error: null });

    (async () => {
      try {
        const res = await fetch("/api/risk-engine/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Org-Id": orgId },
          body: JSON.stringify({ org_id: orgId, persist: false }),
          signal: ctrl.signal,
        });
        const body = await res.json().catch(() => null);
        if (ctrl.signal.aborted) return;
        const parsed = parseRiskEngineResponse(res.status, body);
        const next: RiskEngineECL = { ecl: parsed.ecl, loading: false, error: parsed.error };
        cache.set(orgId, next);
        setResult(next);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const next: RiskEngineECL = {
          ecl: null,
          loading: false,
          error: err instanceof Error ? err.message : "Network error",
        };
        cache.set(orgId, next);
        setResult(next);
      }
    })();

    return () => ctrl.abort();
  }, [orgId, hasUpload]);

  return result;
}
