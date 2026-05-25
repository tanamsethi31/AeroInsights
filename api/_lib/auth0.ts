// api/_lib/auth0.ts
//
// Auth0 JWT verification using Web Crypto + JWKS. Extracted from
// api/ai/chat.ts so both the chat proxy and the Supabase token-exchange
// endpoint share the same code path.
//
// Returns the full verified payload, not just `sub`, so callers can read
// custom claims (email, org_id-from-Auth0-action, etc.).

interface Jwks { keys: JsonWebKey[] }

let _jwksCache: Jwks | null = null;
let _jwksFetchedAt = 0;
const JWKS_TTL_MS = 3_600_000; // 1 hour

async function getJwks(domain: string): Promise<Jwks> {
  const now = Date.now();
  if (_jwksCache && now - _jwksFetchedAt < JWKS_TTL_MS) return _jwksCache;
  const res = await fetch(`https://${domain}/.well-known/jwks.json`);
  if (!res.ok) throw new Error("JWKS fetch failed");
  _jwksCache = (await res.json()) as Jwks;
  _jwksFetchedAt = now;
  return _jwksCache;
}

export function b64urlDecode(b64: string): Uint8Array {
  return Uint8Array.from(
    atob(b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64.length / 4) * 4, "=")),
    (c) => c.charCodeAt(0),
  );
}

export interface VerifiedAuth0Payload {
  sub:    string;            // Auth0 user id (e.g. "auth0|abc123")
  email?: string;
  exp?:   number;
  iat?:   number;
  iss:    string;
  aud:    string | string[];
  [k: string]: unknown;       // custom claims (org_id, name, etc.)
}

/**
 * Verify a bearer token. Returns the payload on success, or null on any
 * failure (expired, bad signature, wrong issuer/audience, malformed).
 *
 * If AUTH0_DOMAIN / AUTH0_AUDIENCE are NOT set, signature verification is
 * skipped and the payload is decoded unverified — only acceptable for
 * local dev where the Auth0 stack isn't reachable.
 */
export async function verifyAuth0Token(token: string): Promise<VerifiedAuth0Payload | null> {
  const domain   = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE;

  if (!domain || !audience) {
    // Local-dev unverified path. NEVER reachable in production because
    // both env vars are required there.
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      return JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))) as VerifiedAuth0Payload;
    } catch {
      return null;
    }
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as VerifiedAuth0Payload;
    const now     = Math.floor(Date.now() / 1000);

    if (typeof payload.exp === "number" && payload.exp < now) return null;
    if (payload.iss !== `https://${domain}/`) return null;
    const aud = payload.aud;
    if (Array.isArray(aud) ? !aud.includes(audience) : aud !== audience) return null;

    const header = JSON.parse(new TextDecoder().decode(b64urlDecode(headerB64))) as Record<string, unknown>;
    const jwks   = await getJwks(domain);
    const jwk    = jwks.keys.find((k) => (k as Record<string, unknown>).kid === header.kid);
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

    return valid ? payload : null;
  } catch {
    return null;
  }
}

/** Convenience wrapper preserving the original chat.ts signature. */
export async function verifyAuth0Sub(token: string): Promise<string | null> {
  const payload = await verifyAuth0Token(token);
  return payload?.sub ?? null;
}
