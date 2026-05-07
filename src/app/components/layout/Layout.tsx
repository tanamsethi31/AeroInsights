// src/app/components/layout/Layout.tsx
import * as React from "react";
import { Outlet } from "react-router";
import { SidebarProvider, SidebarInset } from "../ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Header } from "./Header";
import { AgentProvider } from "../../contexts/AgentContext";
import { AgentPanel } from "../agent/AgentPanel";
import { CurrencyProvider } from "../../contexts/CurrencyContext";

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
          } as React.CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <Header />
          <main className="flex flex-1 flex-col overflow-auto bg-[#f8fafc]">
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
        </SidebarInset>

        {/* AgentPanel: position:fixed overlay — does not affect layout flow */}
        <AgentPanel />
      </SidebarProvider>
    </AgentProvider>
    </CurrencyProvider>
  );
}
