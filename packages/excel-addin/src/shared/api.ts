/**
 * shared/api.ts — Task pane API client
 * ─────────────────────────────────────────────────────────────────────────────
 * Used ONLY by the task pane React components (TaskPane.tsx).
 * Custom functions (functions.js) have their own inline aerFetch() helper
 * because they are plain JS and cannot import TypeScript modules.
 *
 * The token key must match what functions.js uses so both the task pane and
 * custom functions (shared runtime) read/write the same localStorage entry.
 */

export const TOKEN_KEY = "aerinsights_addin_token";

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? "https://api.aerinsights.com/api/v1";

/**
 * Authenticated fetch against the Aeroinsights API.
 * Throws Error("AUTH") on 401 so callers can distinguish auth failures
 * from other errors cleanly.
 */
export async function addinFetch<T = Record<string, unknown>>(path: string): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("AUTH");

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401) throw new Error("AUTH");
  if (response.status === 404) throw new Error("NOT_FOUND");
  if (!response.ok) throw new Error(`HTTP_${response.status}`);

  return response.json() as Promise<T>;
}
