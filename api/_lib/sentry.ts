// api/_lib/sentry.ts
//
// T-6.3 — Sentry wrapper for every Vercel edge function. Each handler
// wraps its body with `withSentry(fn)` so unhandled throws + manual
// captures route to the same project.
//
// Behind SENTRY_DSN_EDGE — when unset the helper is a no-op so local
// dev + un-configured deploys stay silent.

import * as Sentry from "@sentry/vercel-edge";

const DSN = process.env.SENTRY_DSN_EDGE;
let initialised = false;

function ensureInit(): void {
  if (initialised) return;
  if (!DSN) { initialised = true; return; }
  Sentry.init({
    dsn:              DSN,
    environment:      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "production",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
    sendDefaultPii:   false,
  });
  initialised = true;
}

/**
 * Wrap a Vercel edge handler in Sentry. Catches throws + reports them,
 * then returns a 500 JSON response so the function never silently 200s.
 */
export function withSentry(
  handler: (req: Request) => Promise<Response>,
  fnName: string,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    ensureInit();
    try {
      return await handler(req);
    } catch (err) {
      if (DSN) Sentry.captureException(err, { tags: { fn: fnName } });
      else console.error(`[${fnName}]`, err);
      return new Response(
        JSON.stringify({ error: (err as Error).message ?? "internal_error" }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }
  };
}

/**
 * One-shot capture for non-fatal errors inside an already-wrapped handler.
 */
export function reportEdgeError(err: unknown, tags?: Record<string, string>): void {
  ensureInit();
  if (DSN) Sentry.captureException(err, { tags });
  else console.warn("[sentry] (no DSN)", err);
}
