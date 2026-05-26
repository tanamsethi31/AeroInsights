/**
 * Vercel Edge Function — AI chat proxy
 *
 * Enforces:
 *  1. Auth0 bearer token required and signature-verified.
 *  2. Per-user daily limit  — USER_DAILY_LIMIT  queries/day (default 5).
 *  3. Global daily cap      — GLOBAL_DAILY_LIMIT queries/day (default 50).
 *
 * Rate limits use Upstash Redis REST API (atomic INCR + EXPIRE via pipeline).
 * If UPSTASH_REDIS_REST_URL / _TOKEN are not set the function fails open so
 * local dev and staging continue to work without Redis configured.
 *
 * Server-side env vars (Vercel dashboard, NOT prefixed VITE_):
 *   AZURE_OPENAI_URL          Full Target URI from Azure AI Foundry
 *   AZURE_OPENAI_KEY          Azure OpenAI API key
 *   AUTH0_DOMAIN              e.g. dev-xxx.eu.auth0.com
 *   AUTH0_AUDIENCE            e.g. https://api.aeroinsights.io
 *   UPSTASH_REDIS_REST_URL    e.g. https://xxxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN  Upstash REST token
 *   AI_USER_DAILY_LIMIT       Per-user cap  (default 5)
 *   AI_GLOBAL_DAILY_LIMIT     Global cap    (default 50)
 */

export const config = { runtime: "edge" };

import { resolveAiUpstream, withModel } from "../_lib/aiGateway";

const USER_DAILY_LIMIT   = parseInt(process.env.AI_USER_DAILY_LIMIT   ?? "5",  10);
const GLOBAL_DAILY_LIMIT = parseInt(process.env.AI_GLOBAL_DAILY_LIMIT ?? "50", 10);

// ── JWT verification using Web Crypto + Auth0 JWKS ───────────────────────────

let _jwksCache: { keys: JsonWebKey[] } | null = null;
let _jwksFetchedAt = 0;
const JWKS_TTL_MS = 3_600_000; // 1 hour

async function getJwks(domain: string): Promise<{ keys: JsonWebKey[] }> {
  const now = Date.now();
  if (_jwksCache && now - _jwksFetchedAt < JWKS_TTL_MS) return _jwksCache;
  const res = await fetch(`https://${domain}/.well-known/jwks.json`);
  if (!res.ok) throw new Error("JWKS fetch failed");
  _jwksCache = await res.json() as { keys: JsonWebKey[] };
  _jwksFetchedAt = now;
  return _jwksCache;
}

function b64urlDecode(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

async function verifyJwtSub(token: string): Promise<string | null> {
  const domain   = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE;
  // If env vars not configured, skip verification (local dev without Auth0).
  if (!domain || !audience) {
    try {
      const raw = JSON.parse(new TextDecoder().decode(b64urlDecode(token.split(".")[1] ?? "")));
      return (raw.sub as string) ?? null;
    } catch { return null; }
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as Record<string, unknown>;
    const now     = Math.floor(Date.now() / 1000);

    if (typeof payload.exp === "number" && payload.exp < now) return null;
    if (payload.iss !== `https://${domain}/`) return null;
    const aud = payload.aud;
    if (Array.isArray(aud) ? !aud.includes(audience) : aud !== audience) return null;

    const header = JSON.parse(new TextDecoder().decode(b64urlDecode(headerB64))) as Record<string, unknown>;
    const jwks   = await getJwks(domain);
    const jwk    = jwks.keys.find((k: JsonWebKey) => (k as Record<string, unknown>).kid === header.kid);
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signed    = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = b64urlDecode(sigB64);
    const valid     = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, signed);

    return valid ? (payload.sub as string) : null;
  } catch {
    return null;
  }
}

// ── Upstash Redis rate limiting ───────────────────────────────────────────────

function utcDateKey(): string {
  return new Date().toISOString().slice(0, 10); // "2026-05-08"
}

type RateLimitResult =
  | { allowed: true;  userCount: number; globalCount: number }
  | { allowed: false; reason: string };

async function checkAndIncrementLimits(userId: string): Promise<RateLimitResult> {
  const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Fail open: if Redis not configured, allow the request.
  if (!upstashUrl || !upstashToken) {
    return { allowed: true, userCount: 0, globalCount: 0 };
  }

  const date      = utcDateKey();
  const userKey   = `ai:${date}:u:${userId}`;
  const globalKey = `ai:${date}:global`;
  const ttl       = 90000; // 25 hours — safely covers a full UTC day

  // Increment-first: a single pipeline eliminates the GET→INCR race condition.
  // The INCR result IS the post-increment count; reject if it exceeds the cap.
  const pipeline = [
    ["INCR", userKey],
    ["EXPIRE", userKey, ttl],
    ["INCR", globalKey],
    ["EXPIRE", globalKey, ttl],
  ];

  try {
    const res = await fetch(`${upstashUrl}/pipeline`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${upstashToken}`, "Content-Type": "application/json" },
      body:    JSON.stringify(pipeline),
    });

    if (!res.ok) return { allowed: true, userCount: 0, globalCount: 0 };

    const data        = await res.json() as Array<{ result: number }>;
    const userCount   = data[0]?.result ?? 0;
    const globalCount = data[2]?.result ?? 0;

    if (userCount > USER_DAILY_LIMIT) {
      return {
        allowed: false,
        reason: `You have used all ${USER_DAILY_LIMIT} AI queries for today. Resets at midnight UTC.`,
      };
    }
    if (globalCount > GLOBAL_DAILY_LIMIT) {
      return {
        allowed: false,
        reason: "The platform's daily AI capacity has been reached. Please try again tomorrow.",
      };
    }

    return { allowed: true, userCount, globalCount };
  } catch {
    // Redis unavailable — fail open.
    return { allowed: true, userCount: 0, globalCount: 0 };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Auth guard — verify JWT signature before trusting any claims.
  const auth  = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userId = await verifyJwtSub(token);
  if (!userId) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Rate limit check.
  const limit = await checkAndIncrementLimits(userId);
  if (limit.allowed === false) {
    return json({ error: limit.reason, code: "RATE_LIMITED" }, 429);
  }

  // T-6.4 — Prefer Vercel AI Gateway when AI_GATEWAY_API_KEY is set.
  // Falls back to Azure OpenAI if only the Azure vars are present.
  const upstreamCfg = resolveAiUpstream();
  if (!upstreamCfg) {
    return json({ error: "AI not configured on server. Contact your administrator." }, 503);
  }

  // Parse request body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (upstreamCfg.useGateway) {
    body = withModel(body, upstreamCfg.defaultModel);
  }

  // Proxy to upstream (Gateway or Azure).
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

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return json({ error: `Upstream error ${upstream.status}: ${text}` }, upstream.status);
  }

  // Stream SSE back to browser, exposing remaining quota in headers.
  const headers: Record<string, string> = {
    "Content-Type":      "text/event-stream",
    "Cache-Control":     "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
  if (limit.allowed) {
    headers["X-RateLimit-User-Remaining"]   = String(Math.max(0, USER_DAILY_LIMIT   - limit.userCount));
    headers["X-RateLimit-Global-Remaining"] = String(Math.max(0, GLOBAL_DAILY_LIMIT - limit.globalCount));
  }

  return new Response(upstream.body, { status: 200, headers });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
