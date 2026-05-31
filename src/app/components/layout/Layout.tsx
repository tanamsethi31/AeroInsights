// src/app/components/layout/Layout.tsx
import * as React from "react";
import { Outlet } from "react-router";
import { SidebarProvider, SidebarInset, useSidebar } from "../ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Header } from "./Header";
import { AgentProvider, useAgent } from "../../contexts/AgentContext";
import { AgentPanel } from "../agent/AgentPanel";
import { CurrencyProvider } from "../../contexts/CurrencyContext";
import { DemoBanner } from "./DemoBanner";
import { preloadAllPages } from "../../routes";

/**
 * Inner layout shell — must live inside both SidebarProvider (to call useSidebar)
 * and AgentProvider (to call useAgent).
 */
function LayoutContent() {
  const { isOpen } = useAgent();
  const { setOpen } = useSidebar();

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
              <React.Suspense
                fallback={
                  <div style={{ padding: "2rem", color: "#64748B", fontSize: "0.875rem" }}>
                    Loading…
                  </div>
                }
              >
                <Outlet />
              </React.Suspense>
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
