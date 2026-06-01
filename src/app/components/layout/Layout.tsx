// src/app/components/layout/Layout.tsx
import * as React from "react";
import { Outlet, useLocation } from "react-router";
import { SidebarProvider, SidebarInset, useSidebar } from "../ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Header } from "./Header";
import { AgentProvider, useAgent } from "../../contexts/AgentContext";
import { AgentPanel } from "../agent/AgentPanel";
import { CurrencyProvider } from "../../contexts/CurrencyContext";
import { DemoBanner } from "./DemoBanner";
import { preloadAllPages } from "../../routes";
import Scenarios from "../../pages/Scenarios";

/**
 * Renders the Scenarios page persistently after the user first visits it.
 *
 * Why: Scenarios is the single component in the app whose mount/unmount cost
 * exceeds React's synchronous commit budget. When the user navigated away
 * from Scenarios, the unmount cleanup choked the destination page's mount,
 * producing the freeze the user reported across many sessions.
 *
 * This shell:
 *   - Lazily mounts Scenarios on first /scenarios/* visit
 *   - Keeps it mounted forever after — navigating away just toggles
 *     display:none, no unmount, no cleanup work
 *   - Returning to Scenarios is instant (already mounted, just shown)
 *
 * The /scenarios routes in routes.tsx render a `NoOpRoute` component so the
 * router still matches them (sidebar active-state highlighting works, deep
 * links work, browser back/forward works) while leaving the actual content
 * rendering to this shell.
 *
 * Other heavy pages (Dashboard / Portfolio / Deals) are NOT given the same
 * treatment because their mount cost is already within budget after the
 * memoisation + activeTab-gating fixes from earlier commits. Memory
 * footprint stays bounded.
 */
function ScenariosShell() {
  const location = useLocation();
  const isScenarios =
    location.pathname === "/scenarios" || location.pathname.startsWith("/scenarios/");
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    if (isScenarios && !hasMounted) setHasMounted(true);
  }, [isScenarios, hasMounted]);

  if (!hasMounted) return null;

  return (
    <div style={{ display: isScenarios ? "block" : "none" }}>
      <Scenarios />
    </div>
  );
}

/**
 * Inner layout shell — must live inside both SidebarProvider (to call useSidebar)
 * and AgentProvider (to call useAgent).
 */
function LayoutContent() {
  const { isOpen } = useAgent();
  const { setOpen } = useSidebar();
  const location = useLocation();
  // When on /scenarios/*, ScenariosShell renders the page; we hide the
  // Outlet so the route's NoOpRoute component (which renders nothing)
  // doesn't leave an empty padded block under the Scenarios content.
  const isScenarios =
    location.pathname === "/scenarios" || location.pathname.startsWith("/scenarios/");

  // No routeKey on the Outlet wrapper. Earlier we forced full unmount/remount
  // on every pathname change to defeat a "URL changes but page doesn't"
  // reconciler bug. That root cause has since been fixed by useTabSync
  // (every tab click drives navigate() with the canonical URL) and per-page
  // useEffect([pathname]) syncing internal sub-tab state.
  //
  // Keying on pathname here was actively harmful: every sub-tab click
  // (e.g. /portfolio → /portfolio/aircraft) forced the entire 800-line
  // Portfolio component to unmount and rebuild. Rapid sub-tab clicks piled
  // up synchronous remount work on the main thread and produced the
  // ~1 second freeze visible in the DevTools Performance flame chart.
  //
  // Letting react-router handle Outlet naturally means:
  //   - Cross-page navs (sidebar) → matched component changes → swap.
  //   - Within-page navs (sub-tab) → same component stays mounted →
  //     useEffect([pathname]) updates the internal activeTab.

  // Collapse the sidebar only at the moment the AI panel is opened (false → true).
  // After that the user is free to re-open the sidebar independently.
  const prevIsOpen = React.useRef(isOpen);
  React.useEffect(() => {
    if (isOpen && !prevIsOpen.current) setOpen(false);
    prevIsOpen.current = isOpen;
  }, [isOpen, setOpen]);

  // Warm chunk cache for every lazy page once the layout is mounted. Runs
  // on requestIdleCallback (or microtask fallback) so the initial render
  // isn't impacted. After this completes (~750 ms total, staggered), every
  // top-level tab click resolves instantly from cache with no Suspense
  // fallback — eliminating the "first click cold-loads the chunk, second
  // rapid click queues another mount, freeze" pattern.
  React.useEffect(() => { preloadAllPages(); }, []);

  return (
    <>
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <Header />
        <DemoBanner />

        {/* Below-header split view: [main content] | [AI panel] */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
          <main
            className="flex flex-1 flex-col overflow-auto bg-[#f8fafc]"
            style={{ minWidth: 0 }}
          >
            <div
              style={{
                maxWidth: "1400px",
                width: "100%",
                margin: "0 auto",
                padding: "clamp(1rem, 2vw, 1.75rem)",
              }}
            >
              {/*
                Scenarios is rendered persistently by <ScenariosShell />
                below to avoid the unmount-cost freeze. When the user is on
                a /scenarios/* route, the matched route is `NoOpRoute` which
                renders null — we hide the Outlet entirely in that case so
                react-router's empty render doesn't reserve layout space.
              */}
              <div style={{ display: isScenarios ? "none" : "block" }}>
                <Outlet />
              </div>
              <ScenariosShell />
            </div>
          </main>

          {/* AgentPanel sits in the document flow — no overlay, no z-index issues */}
          <AgentPanel />
        </div>
      </SidebarInset>
    </>
  );
}

export function Layout() {
  return (
    <CurrencyProvider>
      <AgentProvider>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "16rem",
              "--sidebar-width-icon": "3rem",
              "--header-height": "3.5rem",
              // Pin to viewport height so every flex descendant gets a resolved height.
              // Without this, shadcn's min-h-svh leaves heights unconstrained and
              // height:100% on AgentPanel resolves to 'auto' (content-tall).
              height: "100vh",
              overflow: "hidden",
            } as React.CSSProperties
          }
        >
          <LayoutContent />
        </SidebarProvider>
      </AgentProvider>
    </CurrencyProvider>
  );
}
