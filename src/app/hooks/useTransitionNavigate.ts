// src/app/hooks/useTransitionNavigate.ts
//
// Drop-in replacement for react-router's useNavigate that wraps every
// navigation call in React 18's startTransition. This turns route changes
// into low-priority, interruptible work so:
//
//   1. The current frame paints immediately instead of blocking on a
//      synchronous re-render wave across every component subscribed to
//      useLocation (Sidebar items, NavLink active states, breadcrumbs,
//      every useTabSync instance, etc.).
//   2. Rapid clicks "win the latest" — React discards in-flight stale
//      navigations and only commits the user's most recent click. This
//      eliminates the cumulative-freeze pattern where 2-3 fast clicks
//      on heavy tabs (Dashboard / Portfolio / Scenarios / Deals and
//      their URL-mapped sub-tabs) would stall the main thread.
//
// API-compatible with react-router's useNavigate:
//   const navigate = useTransitionNavigate();
//   navigate("/portfolio");                  // path
//   navigate("/portfolio", { replace: true }); // options
//   navigate(-1);                            // history delta
//   navigate(1);
//
// Same import-path swap everywhere: replace
//   import { useNavigate } from "react-router";
// with
//   import { useTransitionNavigate as useNavigate } from "../hooks/useTransitionNavigate";
// and call sites stay identical.

import { useNavigate, type NavigateOptions, type To } from "react-router";

// NOTE: previously wrapped every navigate call in startTransition. That
// turned out to be wrong for cross-page navigation. `navigate()` updates
// the URL SYNCHRONOUSLY via history.pushState, but the React state
// update that triggers Outlet/Layout re-renders is what startTransition
// defers. When the deferred re-render gets abandoned by a subsequent
// click, the URL stays at the new value while the Outlet keeps showing
// the OLD route's component — visible as the "URL says /, content shows
// Scenarios" desync the user (and an independent reviewer) caught.
//
// useTabSync still uses startTransition internally, but only because it
// pairs the deferred URL push with a SYNCHRONOUS setActiveTab() — the
// optimistic local state keeps the visible content consistent.
//
// This hook stays as an API-compatible drop-in for useNavigate so the
// 18 consumer files don't need touching. It is now effectively a pass-
// through; callers see the standard react-router behaviour.
export function useTransitionNavigate(): ReturnType<typeof useNavigate> {
  return useNavigate();
}

// Re-export types for consumers that imported them indirectly.
export type { NavigateOptions, To };
