/**
 * auth-dialog.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs inside the Office dialog opened by Office.context.ui.displayDialogAsync.
 * Handles the full Auth0 PKCE flow:
 *
 *   1. First load (no ?code param)  → redirect browser to Auth0 Universal Login
 *   2. Auth0 callback (has ?code=…) → exchange code for access token
 *                                   → send token back to task pane via messageParent
 *                                   → dialog closes itself
 *
 * The dialog page is opened at:
 *   https://addin.aerinsights.com/auth-dialog.html
 *
 * Auth0 redirect_uri must be set to the same URL in your Auth0 application's
 * "Allowed Callback URLs" list.
 *
 * Environment variables (injected by Vite at build time):
 *   VITE_AUTH0_DOMAIN    e.g. "your-tenant.eu.auth0.com"
 *   VITE_AUTH0_CLIENT_ID e.g. "abc123..."
 *   VITE_AUTH0_AUDIENCE  e.g. "https://api.aeroinsights.io"
 */

const AUTH0_DOMAIN    = import.meta.env.VITE_AUTH0_DOMAIN    as string;
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID as string;
const AUTH0_AUDIENCE  = import.meta.env.VITE_AUTH0_AUDIENCE  as string;

const REDIRECT_URI = `${window.location.origin}/auth-dialog.html`;

/* ── PKCE helpers ────────────────────────────────────────────────────────── */

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/* ── DOM helpers ─────────────────────────────────────────────────────────── */

function setStatus(msg: string) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function setError(msg: string) {
  const el = document.getElementById("error");
  if (el) el.textContent = msg;
}

/* ── Main flow ───────────────────────────────────────────────────────────── */

Office.onReady(async () => {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get("code");
  const error  = params.get("error");

  if (error) {
    setStatus("Sign-in failed.");
    setError(`Auth0 error: ${params.get("error_description") ?? error}`);
    Office.context.ui.messageParent(JSON.stringify({ error }));
    return;
  }

  if (code) {
    /* ── Step 2: exchange auth code for access token ── */
    setStatus("Exchanging code for token…");

    const verifier = sessionStorage.getItem("pkce_verifier");
    if (!verifier) {
      setError("PKCE verifier missing — please try again.");
      Office.context.ui.messageParent(JSON.stringify({ error: "verifier_missing" }));
      return;
    }

    try {
      const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type:    "authorization_code",
          client_id:     AUTH0_CLIENT_ID,
          code,
          code_verifier: verifier,
          redirect_uri:  REDIRECT_URI,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.access_token) {
        throw new Error(data.error_description ?? data.error ?? "Token exchange failed");
      }

      setStatus("Signed in successfully. Closing…");
      sessionStorage.removeItem("pkce_verifier");

      // Send the token back to the task pane
      Office.context.ui.messageParent(
        JSON.stringify({ access_token: data.access_token })
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      Office.context.ui.messageParent(JSON.stringify({ error: msg }));
    }

  } else {
    /* ── Step 1: start PKCE flow → redirect to Auth0 ── */
    setStatus("Redirecting to sign-in…");

    const verifier   = generateCodeVerifier();
    const challenge  = await generateCodeChallenge(verifier);
    const state      = crypto.randomUUID();

    sessionStorage.setItem("pkce_verifier", verifier);
    sessionStorage.setItem("pkce_state",    state);

    const authParams = new URLSearchParams({
      response_type:         "code",
      client_id:             AUTH0_CLIENT_ID,
      redirect_uri:          REDIRECT_URI,
      scope:                 "openid profile email",
      audience:              AUTH0_AUDIENCE,
      code_challenge:        challenge,
      code_challenge_method: "S256",
      state,
    });

    window.location.href = `https://${AUTH0_DOMAIN}/authorize?${authParams}`;
  }
});
