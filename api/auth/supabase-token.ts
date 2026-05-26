// api/auth/supabase-token.ts
//
// T-4.2 — Auth0 → Supabase JWT exchange.
//
// Flow:
//   1. Client calls this endpoint with `Authorization: Bearer <auth0_token>`.
//   2. We verify the Auth0 token against the Auth0 JWKS.
//   3. We resolve the user's org membership using the SERVICE-ROLE Supabase
//      client (bypasses RLS).
//   4. We mint a new HS256 JWT signed with SUPABASE_JWT_SECRET, embedding
//      `org_id`, `sub`, `email`, and `role: authenticated`. The Supabase
//      gateway accepts this token and every downstream RLS policy reads
//      `auth.jwt() ->> 'org_id'` to scope rows.
//   5. We return { access_token, expires_in } so the browser can call
//      `supabase.auth.setSession()` and have all subsequent queries land
//      with the correct claim.
//
// Server-side env vars required in production:
//   AUTH0_DOMAIN
//   AUTH0_AUDIENCE
//   SUPABASE_URL                 (https://<ref>.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY    (NEVER ship to browser)
//   SUPABASE_JWT_SECRET          (Project Settings → API → JWT Secret)

export const config = { runtime: "edge" };

import { verifyAuth0Token } from "../_lib/auth0";

// ── HS256 signing using Web Crypto ───────────────────────────────────────

function b64urlEncode(bytes: Uint8Array | string): string {
  const buf = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signSupabaseJwt(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const header  = { alg: "HS256", typ: "JWT" };
  const headerB  = b64urlEncode(JSON.stringify(header));
  const payloadB = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerB}.${payloadB}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  const sigB   = b64urlEncode(new Uint8Array(sigBuf));
  return `${signingInput}.${sigB}`;
}

// ── Org resolution via service-role REST call ────────────────────────────
// We avoid pulling in @supabase/supabase-js in the edge runtime — a single
// fetch against the PostgREST endpoint with the service-role key is enough
// and keeps the cold-start fast.

async function resolveOrgId(authSub: string): Promise<string | null> {
  const url     = process.env.SUPABASE_URL;
  const srvKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srvKey) return null;

  const res = await fetch(
    `${url}/rest/v1/org_members?user_id=eq.${encodeURIComponent(authSub)}&select=org_id&limit=1`,
    {
      headers: {
        apikey:        srvKey,
        Authorization: `Bearer ${srvKey}`,
        Accept:        "application/json",
      },
    },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ org_id: string }>;
  return rows[0]?.org_id ?? null;
}

// ── Handler ──────────────────────────────────────────────────────────────

async function _handler(req: Request): Promise<Response> {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const m = authHeader.match(/^Bearer\s+(.+)$/);
  if (!m) {
    return new Response(JSON.stringify({ error: "missing_token" }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }
  const auth0Token = m[1];
  const verified   = await verifyAuth0Token(auth0Token);
  if (!verified) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }

  const supaSecret = process.env.SUPABASE_JWT_SECRET;
  if (!supaSecret) {
    return new Response(JSON.stringify({ error: "server_misconfigured", detail: "SUPABASE_JWT_SECRET not set" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }

  // Resolve org membership. A user without a row in org_members gets a
  // token with no `org_id` claim — RLS policies will return zero rows on
  // every tenant table. The browser sees an empty workspace, not an error.
  const orgId = await resolveOrgId(verified.sub);

  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = 60 * 60; // 1 hour — matches Supabase default

  const payload: Record<string, unknown> = {
    sub:   verified.sub,
    email: typeof verified.email === "string" ? verified.email : undefined,
    role:  "authenticated",
    iss:   "supabase",
    iat:   now,
    exp:   now + ttlSeconds,
    aud:   "authenticated",
  };
  if (orgId) payload.org_id = orgId;

  const token = await signSupabaseJwt(payload, supaSecret);
  return new Response(
    JSON.stringify({ access_token: token, expires_in: ttlSeconds, org_id: orgId }),
    { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}

import { withSentry as _ws_auth } from "../_lib/sentry";
export default _ws_auth(_handler, "auth:supabase-token");
