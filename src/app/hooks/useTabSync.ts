// src/app/hooks/useTabSync.ts
//
// Keeps a tab page's `activeTab` state AND the browser URL in sync.
//
// The bug this fixes: pill tabs typically only call `setActiveTab(...)`, so
// the URL stays at whatever route the user originally navigated to. The
// useEffect on `pathname` then never fires when the user re-clicks the same
// sidebar item (pathname didn't change), and the page is left showing one
// tab while the URL points at another.
//
// Usage in a page component:
//   const [activeTab, setActiveTab] = useState(() => PATH_TAB[pathname] ?? "Foo");
//   useEffect(() => { setActiveTab(PATH_TAB[pathname] ?? "Foo"); }, [pathname]);
//   const handleTabChange = useTabSync(PATH_TAB, setActiveTab);
//
//   <PillTabs ... onChange={handleTabChange} />
//
// On click: state updates immediately AND the URL is pushed to the matching
// path (when one exists). Browser back/forward + sidebar re-clicks now work
// because the URL is the source of truth.

import { startTransition, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";

export function useTabSync<T extends string>(
  pathToTab: Record<string, T>,
  setActiveTab: (t: T) => void,
): (t: T) => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Reverse map: tab id → path. Memoised so the resulting callback is stable.
  const tabToPath = useMemo<Partial<Record<T, string>>>(() => {
    const out: Partial<Record<T, string>> = {};
    for (const [path, tab] of Object.entries(pathToTab)) {
      // First mapping wins — if multiple paths point to the same tab the
      // canonical one (declared first in PATH_TAB) is preferred.
      if (!(tab in out)) (out as Record<string, string>)[tab as string] = path;
    }
    return out;
  }, [pathToTab]);

  return useCallback(
    (tab: T) => {
      const path = tabToPath[tab];
      if (path) {
        if (path !== pathname) {
          // PERF: optimistically update local activeTab state SYNCHRONOUSLY
          // so the user sees the new tab content immediately. Then push the
          // URL change as a low-priority transition. Without this, every
          // navigate() forced React to synchronously re-render every
          // component subscribed to useLocation (Sidebar items, NavLink
          // active states, useTabSync's own pathname dep) on the main
          // thread before painting anything. Rapid clicks stacked those
          // synchronous re-render waves and produced the observed freeze
          // ("New Custom Scenario" button bypassed it by calling
          // setActiveTab directly without navigate — same symptom proof).
          setActiveTab(tab);
          startTransition(() => {
            navigate(path);
          });
        }
        return;
      }
      // Tab has no canonical URL — direct state update.
      setActiveTab(tab);
    },
    [navigate, pathname, setActiveTab, tabToPath],
  );
}
