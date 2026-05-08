// src/app/components/layout/Layout.tsx
import * as React from "react";
import { Outlet } from "react-router";
import { SidebarProvider, SidebarInset, useSidebar } from "../ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Header } from "./Header";
import { AgentProvider, useAgent } from "../../contexts/AgentContext";
import { AgentPanel } from "../agent/AgentPanel";
import { CurrencyProvider } from "../../contexts/CurrencyContext";

/**
 * Inner layout shell — must live inside both SidebarProvider (to call useSidebar)
 * and AgentProvider (to call useAgent).
 */
function LayoutContent() {
  const { isOpen } = useAgent();
  const { setOpen } = useSidebar();

  // Collapse the sidebar automatically whenever the AI panel opens.
  React.useEffect(() => {
    if (isOpen) setOpen(false);
  }, [isOpen, setOpen]);

  return (
    <>
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <Header />

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
