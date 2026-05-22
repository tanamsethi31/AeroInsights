/**
 * Vercel Edge Function — narrative generation proxy
 *
 * Forwards scenario narrative requests to Azure OpenAI without exposing
 * the API key to the browser. Uses the same server-side env vars as
 * the chat proxy (api/ai/chat.ts).
 *
 * Server-side env vars (Vercel dashboard, NOT prefixed VITE_):
 *   AZURE_OPENAI_URL   Full Target URI from Azure AI Foundry
 *   AZURE_OPENAI_KEY   Azure OpenAI API key
 */

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const azureUrl = process.env.AZURE_OPENAI_URL;
  const apiKey   = process.env.AZURE_OPENAI_KEY;
  if (!azureUrl || !apiKey) {
    return json({ error: "AI not configured on server." }, 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(azureUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
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
