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

        {/* Tertiary: passwordless email OTP */}
        <button
          onClick={() => redirect({ connection: "email" })}
          disabled={isLoading}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: "0.8125rem",
            color: "#475569",
            cursor: isLoading ? "not-allowed" : "pointer",
            textDecoration: "underline",
            textDecorationColor: "#CBD5E1",
            textUnderlineOffset: "3px",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.color = "#002147";
          }}
          onMouseLeave={(e) => {
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.color = "#475569";
          }}
        >
          Sign in with email code instead
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
