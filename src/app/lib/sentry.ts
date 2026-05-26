// src/app/lib/sentry.ts
//
// T-6.3 — Sentry init for the SPA. Behind VITE_SENTRY_DSN_FRONTEND so
// local-dev runs without a DSN stay quiet. tracesSampleRate 0.05 keeps
// cost low; replaysSessionSampleRate 0 disables replays by default —
// flip via env when needed.

import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN_FRONTEND as string | undefined;
const ENV = (import.meta.env.MODE as string | undefined) ?? "production";

let initialised = false;

export function initSentry(): void {
  if (initialised) return;
  if (!DSN) {
    // Quiet local dev; surface in console once so developers know.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info("[sentry] VITE_SENTRY_DSN_FRONTEND not set — disabled");
    }
    initialised = true;
    return;
  }
  Sentry.init({
    dsn:                  DSN,
    environment:          ENV,
    tracesSampleRate:     Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    // Drop noisy Auth0 silent-auth iframe errors that aren't actionable.
    ignoreErrors: [
      "login_required",
      "consent_required",
      "interaction_required",
    ],
  });
  initialised = true;
}

export { Sentry };
