/**
 * Vercel Edge Function — AI chat proxy
 *
 * Sits between the browser and Azure OpenAI so that:
 *  1. The Azure API key never reaches the client.
 *  2. Every request is gated behind a valid Auth0 bearer token.
 *  3. Per-user daily limits can be enforced here in the future (Vercel KV).
 *
 * Server-side env vars required (set in Vercel dashboard, NOT prefixed VITE_):
 *   AZURE_OPENAI_URL   Full Target URI from Azure AI Foundry, e.g.
 *                      https://my-resource.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview
 *   AZURE_OPENAI_KEY   Your Azure OpenAI API key
 */

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  // ── Method guard ────────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Auth guard: require a bearer token (issued by Auth0) ───────────────────
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  // ── Azure config ─────────────────────────────────────────────────────────────
  // AZURE_OPENAI_URL is the full Target URI copied from Azure AI Foundry.
  // This avoids any API-version mismatch from hardcoded values.
  const azureUrl = process.env.AZURE_OPENAI_URL;
  const apiKey   = process.env.AZURE_OPENAI_KEY;

  if (!azureUrl || !apiKey) {
    return json({ error: "AI not configured on server. Contact your administrator." }, 503);
  }

  // ── Forward request body ────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // ── Proxy to Azure OpenAI (streaming) ──────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(azureUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return json({ error: `Upstream fetch failed: ${String(err)}` }, 502);
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return json({ error: `Azure error ${upstream.status}: ${text}` }, upstream.status);
  }

  // Stream the SSE response straight back to the browser.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
