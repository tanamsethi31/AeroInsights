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

import { startTransition, useCallback } from "react";
import { useNavigate, type NavigateOptions, type To } from "react-router";

export function useTransitionNavigate(): {
  (to: To, options?: NavigateOptions): void;
  (delta: number): void;
} {
  const raw = useNavigate();

  return useCallback(
    (toOrDelta: To | number, options?: NavigateOptions) => {
      startTransition(() => {
        if (typeof toOrDelta === "number") {
          raw(toOrDelta);
        } else {
          raw(toOrDelta, options);
        }
      });
    },
    [raw],
  ) as {
    (to: To, options?: NavigateOptions): void;
    (delta: number): void;
  };
}
