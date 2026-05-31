// src/app/components/errors/RouteErrorBoundary.tsx
//
// errorElement target for our react-router config. Catches any uncaught
// render-time / loader-time error from a child route and shows a calm
// recovery surface with: a one-line "what went wrong", concrete next-step
// buttons, and an expandable details block for stack / status traces.
//
// React-router distinguishes:
//   - isRouteErrorResponse(err) → 4xx / 5xx Response-like errors (status + statusText)
//   - other thrown values → JS Error, anything else (e.g. plain string)
//
// We treat 404 specially (most common) and otherwise show a generic
// "Something went wrong" page.

import * as React from "react";
import {
  useRouteError,
  isRouteErrorResponse,
  Link,
} from "react-router";
import { useTransitionNavigate as useNavigate } from "../../hooks/useTransitionNavigate";
import { AlertTriangle, RotateCcw, Home, ChevronDown, ExternalLink } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ParsedError {
  status: number | null;
  title: string;
  message: string;
  stack: string | null;
  raw: unknown;
}

function parseError(err: unknown): ParsedError {
  if (isRouteErrorResponse(err)) {
    if (err.status === 404) {
      return {
        status: 404,
        title: "Page not found",
        message: "That URL doesn't exist in Aeroinsights. It may have been moved or you followed a stale link.",
        stack: null,
        raw: err,
      };
    }
    if (err.status === 401 || err.status === 403) {
      return {
        status: err.status,
        title: "You don't have access",
        message: "Your session may have expired, or this resource belongs to a different organisation. Sign in again and retry.",
        stack: null,
        raw: err,
      };
    }
    return {
      status: err.status,
      title: `${err.status} ${err.statusText || "Error"}`,
      message: typeof err.data === "string" ? err.data : "The server returned an error while loading this page.",
      stack: null,
      raw: err,
    };
  }
  if (err instanceof Error) {
    return {
      status: null,
      title: "Something went wrong",
      message: err.message || "An unexpected error occurred while rendering this page.",
      stack: err.stack ?? null,
      raw: err,
    };
  }
  return {
    status: null,
    title: "Something went wrong",
    message: typeof err === "string" ? err : "An unexpected error occurred while rendering this page.",
    stack: null,
    raw: err,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = React.useState(false);

  const parsed = React.useMemo(() => parseError(error), [error]);

  // Log to console once for engineers / Sentry / etc. The user-facing UI
  // shows only a redacted summary.
  React.useEffect(() => {
    console.error("[RouteErrorBoundary]", error);
  }, [error]);

  const is404 = parsed.status === 404;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "14px",
          padding: "32px",
          width: "100%",
          maxWidth: "520px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: is404 ? "#EFF6FF" : "#FEF3C7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "20px",
          }}
        >
          <AlertTriangle size={22} style={{ color: is404 ? "#0369A1" : "#B45309" }} />
        </div>

        {/* Status */}
        {parsed.status !== null && (
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#94A3B8",
              letterSpacing: "0.06em",
              marginBottom: "8px",
            }}
          >
            ERROR {parsed.status}
          </div>
        )}

        {/* Title */}
        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: "1.375rem",
            fontWeight: 700,
            color: "#0F172A",
            letterSpacing: "-0.01em",
          }}
        >
          {parsed.title}
        </h1>

        {/* Message */}
        <p
          style={{
            margin: "0 0 24px 0",
            fontSize: "0.9375rem",
            color: "#475569",
            lineHeight: 1.55,
          }}
        >
          {parsed.message}
        </p>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <button
            onClick={() => {
              // Try the cheapest recovery first: a fresh navigation back to
              // the route the user came from. If they landed here directly
              // (no history), fall through to the home button.
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/", { replace: true });
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 16px",
              background: "#002147",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} />
            Go back
          </button>
          <Link
            to="/portfolios"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 16px",
              background: "#FFFFFF",
              color: "#002147",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.875rem",
              textDecoration: "none",
            }}
          >
            <Home size={14} />
            Portfolios
          </Link>
          {!is404 && (
            <button
              onClick={() => window.location.reload()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 16px",
                background: "transparent",
                color: "#475569",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                fontWeight: 500,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          )}
        </div>

        {/* Technical details (collapsible) */}
        {(parsed.stack || parsed.status !== null) && (
          <div
            style={{
              borderTop: "1px solid #F1F5F9",
              paddingTop: "16px",
            }}
          >
            <button
              onClick={() => setShowDetails((s) => !s)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "none",
                border: "none",
                padding: 0,
                color: "#64748B",
                fontSize: "0.75rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <ChevronDown
                size={12}
                style={{
                  transform: showDetails ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)",
                }}
              />
              {showDetails ? "Hide" : "Show"} technical details
            </button>

            {showDetails && (
              <div
                style={{
                  marginTop: "10px",
                  background: "#0F172A",
                  color: "#E2E8F0",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  fontFamily: "monospace",
                  fontSize: "0.6875rem",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "240px",
                  overflowY: "auto",
                }}
              >
                {parsed.stack ?? `Status: ${parsed.status}\nPath: ${window.location.pathname}`}
              </div>
            )}

            <div
              style={{
                marginTop: "12px",
                fontSize: "0.6875rem",
                color: "#94A3B8",
              }}
            >
              If this keeps happening,{" "}
              <a
                href="mailto:support@aeroinsights.app?subject=App error"
                style={{
                  color: "#475569",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                let us know
                <ExternalLink size={10} />
              </a>{" "}
              and include the path: <code style={{ color: "#64748B" }}>{window.location.pathname}</code>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
