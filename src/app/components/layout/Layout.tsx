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

/**
 * Inner layout shell — must live inside both SidebarProvider (to call useSidebar)
 * and AgentProvider (to call useAgent).
 */
function LayoutContent() {
  const { isOpen } = useAgent();
  const { setOpen } = useSidebar();
  const { pathname } = useLocation();

  // Key the Outlet wrapper on the FULL pathname so every navigation forces
  // a clean unmount + remount. The previous top-level-only key reduced the
  // freeze rate but didn't fully eliminate it on Dashboard / Portfolio /
  // Scenarios. Full pathname keying is more expensive (sub-tab clicks now
  // remount the parent page too) but guarantees the reconciler can't get
  // stuck between mounts. Pages that need state to persist across sub-tab
  // navs already use localStorage (Custom Builder form, DSL editor).
  const routeKey = pathname;

  // Collapse the sidebar only at the moment the AI panel is opened (false → true).
  // After that the user is free to re-open the sidebar independently.
  const prevIsOpen = React.useRef(isOpen);
  React.useEffect(() => {
    if (isOpen && !prevIsOpen.current) setOpen(false);
    prevIsOpen.current = isOpen;
  }, [isOpen, setOpen]);

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
              key={routeKey}
              style={{
                maxWidth: "1400px",
                width: "100%",
                margin: "0 auto",
                padding: "clamp(1rem, 2vw, 1.75rem)",
              }}
            >
              <Outlet />
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
