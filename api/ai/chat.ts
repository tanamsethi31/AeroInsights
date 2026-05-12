/**
 * Vercel Edge Function — AI chat proxy
 *
 * Enforces:
 *  1. Auth0 bearer token required.
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
 *   UPSTASH_REDIS_REST_URL    e.g. https://xxxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN  Upstash REST token
 *   AI_USER_DAILY_LIMIT       Per-user cap  (default 5)
 *   AI_GLOBAL_DAILY_LIMIT     Global cap    (default 50)
 */

export const config = { runtime: "edge" };

const USER_DAILY_LIMIT   = parseInt(process.env.AI_USER_DAILY_LIMIT   ?? "5",  10);
const GLOBAL_DAILY_LIMIT = parseInt(process.env.AI_GLOBAL_DAILY_LIMIT ?? "50", 10);

// ── JWT helpers (decode only — used for rate-limit keying, not auth) ──────────

function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims  = JSON.parse(decoded) as Record<string, unknown>;
    return (claims.sub as string) ?? null;
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

  // First read current values before incrementing so we can check limits.
  const readPipeline = [
    ["GET", userKey],
    ["GET", globalKey],
  ];

  try {
    const readRes = await fetch(`${upstashUrl}/pipeline`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${upstashToken}`, "Content-Type": "application/json" },
      body:    JSON.stringify(readPipeline),
    });

    if (readRes.ok) {
      const readData = await readRes.json() as Array<{ result: string | null }>;
      const currentUser   = parseInt(readData[0]?.result ?? "0", 10);
      const currentGlobal = parseInt(readData[1]?.result ?? "0", 10);

      if (currentUser >= USER_DAILY_LIMIT) {
        return {
          allowed: false,
          reason: `You have used all ${USER_DAILY_LIMIT} AI queries for today. Resets at midnight UTC.`,
        };
      }
      if (currentGlobal >= GLOBAL_DAILY_LIMIT) {
        return {
          allowed: false,
          reason: "The platform's daily AI capacity has been reached. Please try again tomorrow.",
        };
      }
    }

    // Atomically increment both counters and set TTL.
    const incrPipeline = [
      ["INCR", userKey],
      ["EXPIRE", userKey, ttl],
      ["INCR", globalKey],
      ["EXPIRE", globalKey, ttl],
    ];

    const incrRes = await fetch(`${upstashUrl}/pipeline`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${upstashToken}`, "Content-Type": "application/json" },
      body:    JSON.stringify(incrPipeline),
    });

    if (!incrRes.ok) return { allowed: true, userCount: 0, globalCount: 0 };

    const incrData  = await incrRes.json() as Array<{ result: number }>;
    const userCount   = incrData[0]?.result ?? 0;
    const globalCount = incrData[2]?.result ?? 0;

    // Double-check after increment in case of race condition.
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

  // Auth guard.
  const auth  = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Extract user ID from JWT sub claim for rate-limit keying.
  const userId = decodeJwtSub(token) ?? `anon:${token.slice(-16)}`;

  // Rate limit check.
  const limit = await checkAndIncrementLimits(userId);
  if (limit.allowed === false) {
    return json({ error: limit.reason, code: "RATE_LIMITED" }, 429);
  }

  // Azure config.
  const azureUrl = process.env.AZURE_OPENAI_URL;
  const apiKey   = process.env.AZURE_OPENAI_KEY;
  if (!azureUrl || !apiKey) {
    return json({ error: "AI not configured on server. Contact your administrator." }, 503);
  }

  // Parse request body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Proxy to Azure OpenAI.
  let upstream: Response;
  try {
    upstream = await fetch(azureUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body:   JSON.stringify(body),
    });
  } catch (err) {
    return json({ error: `Upstream fetch failed: ${String(err)}` }, 502);
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return json({ error: `Azure error ${upstream.status}: ${text}` }, upstream.status);
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
