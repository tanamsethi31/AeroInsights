// src/app/utils/authBackend.ts
//
// Single source of truth for "is there a real Auth0 → Supabase JWT-exchange
// backend wired up?" When this is false (no VITE_API_BASE_URL, or it
// points at localhost), every RLS-gated Supabase query will return 401
// because the supabase client only has the anon JWT — no `org_id` claim
// for RLS to authorize. The 401 is logged by the browser to the console
// as a red network error which JS cannot suppress, so the only way to
// stop the noise is to skip the request entirely.
//
// Hooks that read RLS-protected tables should early-return when this is
// false. The app already falls back to MOCK_* data in demo mode, so the
// UI continues to function normally.

const RAW = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "").trim();

/** True when a non-localhost API base URL is configured. */
export const HAS_AUTH_BACKEND: boolean =
  RAW.length > 0 && !RAW.includes("localhost");
