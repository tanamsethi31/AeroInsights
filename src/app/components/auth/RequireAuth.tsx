import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Outlet, useNavigate, useLocation } from "react-router";

// Only the value actually set in env counts — empty/missing means "no
// backend wired up, skip optional fetches". Previously this fell through
// to http://localhost:8000/api/v1 which fired noisy 404s on every page
// load in production.
const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
const API_BASE = RAW_API_BASE.trim();
const HAS_API_BASE = API_BASE.length > 0 && !API_BASE.includes("localhost");

// Comma-separated email allowlist from env var.
// If not set, no app-level restriction is enforced (rely on Auth0 Action).
const ALLOWED_EMAILS: string[] = (import.meta.env.VITE_ALLOWED_EMAILS as string | undefined)
  ? (import.meta.env.VITE_ALLOWED_EMAILS as string).split(",").map((e) => e.trim().toLowerCase())
  : [];

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
  const location = useLocation();
  const synced = useRef(false);

  // Redirect unauthenticated users to /home (landing) or /login.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(location.pathname === "/" ? "/home" : "/login", {
        replace: true,
        state: { returnTo: location.pathname + location.search },
      });
    }
  }, [isLoading, isAuthenticated, navigate, location]);

  // Sync user to backend on first authenticated render.
  // Skipped entirely when no real backend is configured (HAS_API_BASE),
  // because this app runs Auth0 + Supabase direct with no /auth/me endpoint.
  useEffect(() => {
    if (!HAS_API_BASE) return;
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

  // Secondary email allowlist check (primary guard is the Auth0 Action).
  // Only active when VITE_ALLOWED_EMAILS is set.
  if (
    ALLOWED_EMAILS.length > 0 &&
    user?.email &&
    !ALLOWED_EMAILS.includes(user.email.toLowerCase())
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #001830 0%, #002147 60%, #003175 100%)",
          gap: "1rem",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "1rem",
            padding: "2.5rem 2.75rem",
            maxWidth: "400px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>
            <i className="bi bi-shield-lock" style={{ color: "#B91C1C" }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.125rem", color: "#0F172A", marginBottom: "0.5rem" }}>
            Access Restricted
          </div>
          <div style={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.6 }}>
            <strong style={{ color: "#0F172A" }}>{user.email}</strong> is not authorised
            to access this platform. Contact the administrator to request access.
          </div>
          <button
            onClick={() => { window.location.href = "/login"; }}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.5rem",
              background: "#002147",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
