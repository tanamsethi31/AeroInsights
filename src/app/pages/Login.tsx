import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "react-router";

export default function Login() {
  const { loginWithRedirect, isLoading } = useAuth0();
  const location = useLocation();
  // Destination preserved by RequireAuth; fall back to dashboard root.
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #001830 0%, #002147 60%, #003175 100%)",
      }}
    >
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
              width: "52px",
              height: "52px",
              background: "#002147",
              borderRadius: "12px",
              marginBottom: "1rem",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                d="M4 20L14 4L24 20H4Z"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinejoin="round"
                fill="none"
              />
              <path d="M9 20L14 11L19 20" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
            </svg>
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

        <button
          onClick={() => loginWithRedirect({ appState: { returnTo } })}
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
            if (!isLoading)
              (e.currentTarget as HTMLButtonElement).style.background = "#001830";
          }}
          onMouseLeave={(e) => {
            if (!isLoading)
              (e.currentTarget as HTMLButtonElement).style.background = "#002147";
          }}
        >
          {isLoading ? "Loading…" : "Sign in"}
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
