/**
 * Vercel Edge Function — narrative generation proxy
 *
 * Same gate as /api/ai/chat — Auth0 bearer token, per-user + global
 * rate limits, server-side output cap. Used by Scenarios / Reports to
 * generate one-shot narrative blurbs (non-streaming, no tools).
 *
 * Server-side env vars (Vercel dashboard, NOT prefixed VITE_):
 *   CEREBRAS_API_KEY / GROQ_API_KEY / GEMINI_API_KEY / AI_GATEWAY_API_KEY
 *   AUTH0_DOMAIN, AUTH0_AUDIENCE
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *   AI_MAX_OUTPUT_TOKENS (default 512)
 */

export const config = { runtime: "edge" };

import { resolveAiUpstreams, withModel } from "../_lib/aiGateway";
import { verifyAuth0Sub } from "../_lib/auth0";
import { checkAndIncrementAiLimits } from "../_lib/rateLimit";

const MAX_OUTPUT_TOKENS = parseInt(process.env.AI_MAX_OUTPUT_TOKENS ?? "512", 10);

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Auth gate ────────────────────────────────────────────────────────
  const auth  = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({ error: "Unauthorized" }, 401);

  const userId = await verifyAuth0Sub(token);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  // ── Rate limit — shares Redis counters with /api/ai/chat ────────────
  const limit = await checkAndIncrementAiLimits(userId);
  if (limit.allowed === false) {
    return json({ error: limit.reason, code: "RATE_LIMITED" }, 429);
  }

  // ── Upstream chain ───────────────────────────────────────────────────
  const upstreamConfigs = resolveAiUpstreams();
  if (upstreamConfigs.length === 0) {
    return json({ error: "AI not configured on server." }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Output cap.
  const clientMax = typeof body.max_tokens === "number" ? body.max_tokens : MAX_OUTPUT_TOKENS;
  body.max_tokens = Math.min(clientMax, MAX_OUTPUT_TOKENS);

  // Strip any client-supplied model — we inject per provider.
  const baseBody = { ...body };
  delete (baseBody as Record<string, unknown>).model;

  let lastUpstream: Response | null = null;
  let lastErrText = "";

  for (const upstreamCfg of upstreamConfigs) {
    const attemptBody = upstreamCfg.useGateway
      ? withModel(baseBody, upstreamCfg.defaultModel)
      : baseBody;
    let upstream: Response;
    try {
      upstream = await fetch(upstreamCfg.url, {
        method:  "POST",
        headers: upstreamCfg.headers,
        body:    JSON.stringify(attemptBody),
      });
    } catch {
      continue;
    }
    if (upstream.ok) {
      lastUpstream = upstream;
      break;
    }
    lastErrText = await upstream.text().catch(() => "");
    lastUpstream = upstream;
  }

  if (!lastUpstream || !lastUpstream.ok) {
    const status = lastUpstream?.status ?? 502;
    return json({ error: `All upstream providers failed. Last error ${status}: ${lastErrText}` }, status);
  }

  const text = await lastUpstream.text().catch(() => "");
  return new Response(text, {
    status:  200,
    headers: { "Content-Type": "application/json" },
  });
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
