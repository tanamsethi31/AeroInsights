/**
 * Vercel Edge Function — AI chat proxy
 *
 * Enforces (in order):
 *  1. Auth0 bearer token required and signature-verified (RSA via JWKS).
 *  2. Per-user per-minute burst limit (default 3/min).
 *  3. Per-user daily limit          (default 10/day).
 *  4. Global daily cap              (default 50/day).
 *  5. Input message length cap      (4,000 chars across all user messages).
 *  6. Output token cap              (max_tokens forced ≤ 1,024 server-side).
 *
 * Rate limits use Upstash Redis REST API (atomic INCR + EXPIRE via pipeline).
 * If UPSTASH_REDIS_REST_URL / _TOKEN are not set the function fails open so
 * local dev and staging continue to work without Redis configured.
 *
 * Server-side env vars (Vercel dashboard, NOT prefixed VITE_):
 *   GEMINI_API_KEY            Google AI Studio key (paid pay-as-you-go)
 *   GROQ_API_KEY              Groq fallback (free tier)
 *   AUTH0_DOMAIN              e.g. dev-xxx.eu.auth0.com
 *   AUTH0_AUDIENCE            e.g. https://api.aeroinsights.io
 *   UPSTASH_REDIS_REST_URL    e.g. https://xxxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN  Upstash REST token
 *   AI_USER_DAILY_LIMIT       Per-user daily cap     (default 10)
 *   AI_USER_MINUTE_LIMIT      Per-user per-minute    (default 3)
 *   AI_GLOBAL_DAILY_LIMIT     Platform-wide cap      (default 50)
 *   AI_MAX_INPUT_CHARS        Reject if user input > N chars  (default 4000)
 *   AI_MAX_OUTPUT_TOKENS      Cap response length             (default 1024)
 */

export const config = { runtime: "edge" };

import { resolveAiUpstream, withModel } from "../_lib/aiGateway";

const USER_DAILY_LIMIT    = parseInt(process.env.AI_USER_DAILY_LIMIT    ?? "10",  10);
const USER_MINUTE_LIMIT   = parseInt(process.env.AI_USER_MINUTE_LIMIT   ?? "3",   10);
const GLOBAL_DAILY_LIMIT  = parseInt(process.env.AI_GLOBAL_DAILY_LIMIT  ?? "50",  10);
const MAX_INPUT_CHARS     = parseInt(process.env.AI_MAX_INPUT_CHARS     ?? "4000", 10);
const MAX_OUTPUT_TOKENS   = parseInt(process.env.AI_MAX_OUTPUT_TOKENS   ?? "1024", 10);

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

  // Permissive fallback used only when server-side AUTH0 env isn't set
  // (i.e. local dev). In production both vars are present so the strict
  // RSA-verify path below is the only one that runs.
  if (!domain || !audience) {
    try {
      const raw = JSON.parse(new TextDecoder().decode(b64urlDecode(token.split(".")[1] ?? "")));
      if (typeof raw.sub === "string" && raw.sub.length > 0) return raw.sub;
    } catch { /* fall through */ }
    return `opaque:${token.slice(0, 32)}`;
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
function utcMinuteKey(): string {
  return new Date().toISOString().slice(0, 16).replace(":", "-"); // "2026-05-08T14-37"
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
  const minute    = utcMinuteKey();
  const userKey   = `ai:${date}:u:${userId}`;
  const minuteKey = `ai:${minute}:um:${userId}`;
  const globalKey = `ai:${date}:global`;
  const dayTtl    = 90000; // 25 hours
  const minTtl    = 120;   // 2 minutes (covers clock skew across edge regions)

  // Single pipeline: 3 counters incremented + their TTLs set in one round trip.
  const pipeline = [
    ["INCR", userKey],
    ["EXPIRE", userKey, dayTtl],
    ["INCR", minuteKey],
    ["EXPIRE", minuteKey, minTtl],
    ["INCR", globalKey],
    ["EXPIRE", globalKey, dayTtl],
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
    const minuteCount = data[2]?.result ?? 0;
    const globalCount = data[4]?.result ?? 0;

    // Burst limit first — most users will hit this before the daily one.
    if (minuteCount > USER_MINUTE_LIMIT) {
      return {
        allowed: false,
        reason: `Too many requests. Please wait a minute before trying again (limit ${USER_MINUTE_LIMIT}/min).`,
      };
    }
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
    return { allowed: true, userCount: 0, globalCount: 0 };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Auth.
  const auth  = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({ error: "Unauthorized" }, 401);

  const userId = await verifyJwtSub(token);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  // Rate limits.
  const limit = await checkAndIncrementLimits(userId);
  if (limit.allowed === false) {
    return json({ error: limit.reason, code: "RATE_LIMITED" }, 429);
  }

  // Upstream.
  const upstreamCfg = resolveAiUpstream();
  if (!upstreamCfg) {
    return json({ error: "AI not configured on server. Contact your administrator." }, 503);
  }

  // Parse + validate body.
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Input length cap — sum content of every user/system message in the
  // request. Protects against a paste-the-whole-spreadsheet attack.
  const messages = Array.isArray(body.messages) ? body.messages : [];
  let totalChars = 0;
  for (const m of messages) {
    const c = (m as { content?: unknown })?.content;
    if (typeof c === "string") totalChars += c.length;
  }
  if (totalChars > MAX_INPUT_CHARS) {
    return json({
      error: `Message too long. Limit is ${MAX_INPUT_CHARS} characters; you sent ${totalChars}.`,
    }, 413);
  }

  // Output token cap — server enforces, ignores any larger value the
  // client tried to set.
  const clientMax = typeof body.max_tokens === "number" ? body.max_tokens : MAX_OUTPUT_TOKENS;
  body.max_tokens = Math.min(clientMax, MAX_OUTPUT_TOKENS);

  if (upstreamCfg.useGateway) {
    body = withModel(body, upstreamCfg.defaultModel);
  }

  // Proxy.
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
