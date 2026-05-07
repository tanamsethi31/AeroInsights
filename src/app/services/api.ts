import { useAuth0 } from "@auth0/auth0-react";
import { useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? "http://localhost:8000/api/v1";

/**
 * Returns an authenticated `apiFetch` function that automatically attaches
 * the current Auth0 access token as a Bearer header on every request.
 *
 * Usage:
 *   const { apiFetch } = useApi();
 *   const lessees = await apiFetch<Lessee[]>("/lessees");
 */
export function useApi() {
  const { getAccessTokenSilently } = useAuth0();

  const apiFetch = useCallback(
    async <T = unknown>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getAccessTokenSilently();

      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init?.headers ?? {}),
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
      }

      // 204 No Content
      if (res.status === 204) return undefined as T;

      return res.json() as Promise<T>;
    },
    [getAccessTokenSilently]
  );

  return { apiFetch, API_BASE };
}
