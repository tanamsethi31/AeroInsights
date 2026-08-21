import { useAuth0 } from "@auth0/auth0-react";
import { Link, useLocation } from "react-router";

export default function Login() {
  const { loginWithRedirect, isLoading } = useAuth0();
  const location = useLocation();
  // Destination preserved by RequireAuth; fall back to dashboard root.
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/portfolios";

  const redirect = (extra: Record<string, string> = {}) =>
    loginWithRedirect({
      appState: { returnTo },
      authorizationParams: { prompt: "login", ...extra },
    });

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #001830 0%, #002147 60%, #003175 100%)",
      }}
    >
      {/* Back to home — top-left, sits over the navy gradient */}
      <Link
        to="/home"
        style={{
          position: "absolute",
          top: "1.25rem",
          left: "1.5rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 0.85rem",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "0.5rem",
          color: "#E2E8F0",
          fontSize: "0.8125rem",
          fontWeight: 500,
          textDecoration: "none",
          letterSpacing: "0.01em",
          transition: "background 0.15s, border-color 0.15s",
          backdropFilter: "blur(6px)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.16)";
          (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.32)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.18)";
        }}
      >
        <i className="bi bi-arrow-left" style={{ fontSize: "0.75rem" }} />
        Back to home
      </Link>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "1rem",
          padding: "2.5rem 2.75rem",
          width: "100%",
          maxWidth: "400px",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        }}
      >
        {/* Logo mark */}
        <div style={{ marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "64px",
              height: "64px",
              background: "#002147",
              borderRadius: "16px",
              marginBottom: "1rem",
              padding: "12px",
            }}
          >
            <img
              src="/logo.png"
              alt="Aeroinsights"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>

          <div
            style={{
              fontSize: "1.375rem",
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Aeroinsights
          </div>
          <div
            style={{
              fontSize: "0.8125rem",
              color: "#64748B",
              marginTop: "0.25rem",
              letterSpacing: "0.02em",
            }}
          >
            Aviation Lessor Decision Platform
          </div>
        </div>

        {/* Primary: sign in */}
        <button
          onClick={() => redirect()}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "0.75rem 1.5rem",
            background: isLoading ? "#64748B" : "#002147",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "0.5rem",
            fontSize: "0.9375rem",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            letterSpacing: "0.01em",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#001830";
          }}
          onMouseLeave={(e) => {
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#002147";
          }}
        >
          {isLoading ? "Loading…" : "Sign in"}
        </button>

        {/* Google sign-in — no email delivery required */}
        <button
          onClick={() => redirect({ connection: "google-oauth2" })}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "0.6875rem 1.5rem",
            marginTop: "0.75rem",
            background: "#FFFFFF",
            color: "#1F2937",
            border: "1.5px solid #CBD5E1",
            borderRadius: "0.5rem",
            fontSize: "0.9375rem",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            letterSpacing: "0.01em",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.625rem",
            transition: "border-color 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#94A3B8";
              (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#CBD5E1";
              (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF";
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.94v2.33A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.96 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.94a9 9 0 0 0 0 8.08l3.02-2.33Z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.96l3.02 2.33C4.67 5.16 6.66 3.58 9 3.58Z" />
          </svg>
          {isLoading ? "Loading…" : "Continue with Google"}
        </button>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            margin: "1.25rem 0",
          }}
        >
          <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
          <span style={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: 500 }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
        </div>

        {/* Secondary: create account */}
        <button
          onClick={() => redirect({ screen_hint: "signup" })}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "0.75rem 1.5rem",
            background: "transparent",
            color: "#002147",
            border: "1.5px solid #CBD5E1",
            borderRadius: "0.5rem",
            fontSize: "0.9375rem",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            letterSpacing: "0.01em",
            transition: "border-color 0.15s, background 0.15s",
            marginBottom: "1rem",
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#002147";
              (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#CBD5E1";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }
          }}
        >
          Create account
        </button>

        <p
          style={{
            fontSize: "0.75rem",
            color: "#94A3B8",
            marginTop: "1.5rem",
            lineHeight: 1.5,
          }}
        >
          Access restricted to authorised users only.
        </p>
      </div>
    </div>
  );
}
