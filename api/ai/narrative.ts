/**
 * Vercel Edge Function — narrative generation proxy
 *
 * T-6.4 — Routes through Vercel AI Gateway when AI_GATEWAY_API_KEY is
 * set. Falls back to direct Azure OpenAI when only the Azure vars are
 * configured. Body shape is the standard OpenAI chat/completions
 * payload — unchanged across both paths because both upstreams are
 * OpenAI-compatible.
 *
 * Server-side env vars (Vercel dashboard, NOT prefixed VITE_):
 *   AI_GATEWAY_API_KEY  — preferred. Routes through ai-gateway.vercel.sh
 *   AI_GATEWAY_MODEL    — optional, default "anthropic/claude-3.5-sonnet"
 *   AZURE_OPENAI_URL    — fallback when no gateway key set
 *   AZURE_OPENAI_KEY    — fallback
 */

export const config = { runtime: "edge" };

import { resolveAiUpstream, withModel } from "../_lib/aiGateway";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const upstreamCfg = resolveAiUpstream();
  if (!upstreamCfg) {
    return json({ error: "AI not configured on server." }, 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (upstreamCfg.useGateway) {
    body = withModel(body, upstreamCfg.defaultModel);
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamCfg.url, {
      method:  "POST",
      headers: upstreamCfg.headers,
      body:    JSON.stringify(body),
    });
  } catch (err) {
    return json({ error: `Upstream fetch failed: ${String(err)}` }, 502);
  }

  const text = await upstream.text().catch(() => "");
  return new Response(text, {
    status:  upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
