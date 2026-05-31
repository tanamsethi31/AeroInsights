// src/app/utils/authBackend.ts
//
// Tracks whether the Supabase client actually has an authenticated session
// (the Auth0 → Supabase JWT exchange succeeded). Returning the URL-presence
// of VITE_API_BASE_URL turned out to be wrong: production has that env var
// set to a backend that does NOT serve /auth/supabase-token, so the
// exchange silently fails, the supabase client stays on the anon JWT, and
// every RLS-gated query returns 401.
//
// DataContext.exchangeAndSetSession calls setAuthSession(true) on success
// and leaves it false on failure. Hooks read the live value via
// hasAuthSession() and skip queries when it's false.

let _hasSession = false;

/** Read the current session-ready flag synchronously. */
export function hasAuthSession(): boolean {
  return _hasSession;
}

/** Set by DataContext after the JWT exchange completes (or fails). */
export function setAuthSession(v: boolean): void {
  _hasSession = v;
}
