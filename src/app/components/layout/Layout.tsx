import { Outlet } from "react-router";
import { SidebarProvider, SidebarInset } from "../ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Header } from "./Header";

export function Layout() {
  return (
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
    </SidebarProvider>
  );
}