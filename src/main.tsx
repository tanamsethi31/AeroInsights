import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import App from "./app/App.tsx";
import "./styles/index.css";
import "bootstrap-icons/font/bootstrap-icons.css";

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
    <App />
    <SpeedInsights />
    <Analytics />
  </Auth0Provider>
);
