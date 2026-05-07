import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Outlet, useNavigate } from "react-router";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? "http://localhost:8000/api/v1";

/**
 * Route guard that:
 *  1. Redirects unauthenticated users to /login
 *  2. On first authenticated render, POSTs /auth/me to provision the user
 *     record in the backend (creates it if this is their first login).
 *  3. Renders the nested <Outlet /> once auth + sync are done.
 */
export function RequireAuth() {
  const { isLoading, isAuthenticated, getAccessTokenSilently, user } = useAuth0();
  const navigate = useNavigate();
  const synced = useRef(false);

  // Redirect to /login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Sync user to backend on first authenticated render
  useEffect(() => {
    if (!isAuthenticated || !user || synced.current) return;
    synced.current = true;

    (async () => {
      try {
        const token = await getAccessTokenSilently();
        await fetch(`${API_BASE}/auth/me`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.email ?? "unknown@aeroinsights.io",
            name: user.name ?? user.nickname ?? user.email ?? "User",
          }),
        });
      } catch {
        // Network errors are non-fatal — app still loads, API calls will 401
        // individually if the token is actually invalid.
        console.warn("[RequireAuth] /auth/me sync failed — continuing");
      }
    })();
  }, [isAuthenticated, user, getAccessTokenSilently]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8FAFC",
          fontSize: "0.875rem",
          color: "#64748B",
        }}
      >
        <span>Loading…</span>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <Outlet />;
}
