import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import App from "./app/App.tsx";
import "./styles/index.css";
import "bootstrap-icons/font/bootstrap-icons.css";
// T-6.3 — initialise Sentry BEFORE the React tree mounts so even the
// first-render error path is captured. Sentry.ErrorBoundary wraps App
// below so React render errors flow through the same pipeline.
import { initSentry, Sentry } from "./app/lib/sentry";
initSentry();

const domain   = import.meta.env.VITE_AUTH0_DOMAIN as string;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string;

// After Auth0 redirects back, navigate to the route that was originally
// requested (stored in appState.returnTo by Login.tsx).
function onRedirectCallback(appState?: { returnTo?: string }) {
  const target = appState?.returnTo ?? window.location.pathname;
  window.history.replaceState({}, document.title, target);
}

createRoot(document.getElementById("root")!).render(
  <Auth0Provider
    domain={domain}
    clientId={clientId}
    authorizationParams={{
      redirect_uri: window.location.origin,
      audience,
      scope: "openid email profile offline_access",
    }}
    cacheLocation="localstorage"
    useRefreshTokens={true}
    onRedirectCallback={onRedirectCallback}
  >
    <Sentry.ErrorBoundary fallback={
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F8FAFC",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "2rem",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0F172A" }}>
          Something went wrong
        </div>
        <div style={{ fontSize: "0.875rem", color: "#475569", maxWidth: "440px" }}>
          The error has been reported. Refresh the page to try again — if the
          issue persists, contact support with the error reference shown in
          the browser console.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "#002147", color: "#FFFFFF",
            border: "none", borderRadius: "9999px",
            padding: "0.625rem 1.5rem", fontSize: "0.875rem",
            fontWeight: 600, cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    }>
      <App />
    </Sentry.ErrorBoundary>
    <SpeedInsights />
    <Analytics />
  </Auth0Provider>
);
