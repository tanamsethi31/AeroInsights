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
import { usePortfolio } from "../../contexts/PortfolioContext";
import Dashboard from "../../pages/Dashboard";
import Portfolio from "../../pages/Portfolio";
import Scenarios from "../../pages/Scenarios";
import Deals from "../../pages/Deals";

/**
 * Persistent-mount shell for heavy pages.
 *
 * The architectural constraint: Dashboard, Portfolio, Scenarios, and Deals
 * each have mount and unmount costs that exceed React's synchronous commit
 * budget (~16 ms). Mounting one fresh while a previous one is being torn
 * down chokes the main thread and produces the freeze the user has been
 * reporting across many sessions.
 *
 * This shell:
 *   - Lazily mounts each page on FIRST visit
 *   - Keeps it mounted forever after — navigating away just toggles
 *     display:none. No unmount, no cleanup, no GC pressure.
 *   - Returning is instant (already mounted, just shown).
 *
 * Memory cost: ~10-15 MB per heavy page retained for the whole session
 * (Dashboard + Portfolio + Scenarios + Deals ≈ 40-60 MB total). Acceptable
 * for a desktop analytics SPA — the alternative is the freeze itself.
 *
 * Each persistent page is paired with a NoOpRoute entry in routes.tsx so
 * react-router still matches the URL (sidebar active state, deep links,
 * browser history all keep working) while the actual rendering lives here.
 */
function PersistentPage({
  isActive,
  children,
}: {
  isActive: boolean;
  children: React.ReactNode;
}) {
  const [hasMounted, setHasMounted] = React.useState(isActive);
  React.useEffect(() => {
    if (isActive && !hasMounted) setHasMounted(true);
  }, [isActive, hasMounted]);
  if (!hasMounted) return null;
  return <div style={{ display: isActive ? "block" : "none" }}>{children}</div>;
}

/**
 * Minimal top bar shown only in Custom Builder full-page workspace mode.
 * Provides a way back to Scenarios (Library) — without it the user would
 * be stranded because the sidebar is hidden in this mode.
 */
function BuilderTopBar() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.25rem",
        borderBottom: "1px solid #e2e8f0",
        background: "#ffffff",
        flexShrink: 0,
      }}
    >
      <a
        href="/scenarios"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          color: "#0f172a",
          fontSize: "0.875rem",
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        ← Back to Scenarios
      </a>
      <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Custom Scenario Builder</span>
    </div>
  );
}

/**
 * Same as PersistentPage but guards the Dashboard's "no portfolio selected"
 * redirect (originally lived in PortfolioIndexGuard inside routes.tsx).
 */
function DashboardShell({ isActive }: { isActive: boolean }) {
  const { activePortfolioId } = usePortfolio();
  if (isActive && !activePortfolioId) {
    // Mirror the legacy redirect — keep the visit history but punt the
    // user to /portfolios. PortfolioHub renders via Outlet (it's not
    // persistent) when this happens, so its mount cost is acceptable.
    return null;
  }
  return (
    <PersistentPage isActive={isActive}>
      <Dashboard />
    </PersistentPage>
  );
}

function LayoutContent() {
  const { isOpen } = useAgent();
  const { setOpen } = useSidebar();
  const location = useLocation();
  const p = location.pathname;

  // Compute "which persistent page is active" once per render. The Outlet
  // is hidden when any persistent page owns the screen so its NoOpRoute
  // render doesn't reserve an empty layout block beneath the persistent
  // page's content.
  const onDashboard = p === "/";
  const onPortfolio = p === "/portfolio" || p.startsWith("/portfolio/");
  const onScenarios = p === "/scenarios" || p.startsWith("/scenarios/");
  const onDeals = p === "/deals" || p.startsWith("/deals/");
  const anyPersistent = onDashboard || onPortfolio || onScenarios || onDeals;

  // Full-page workspace mode: Custom Builder is the heaviest interaction
  // surface in the app (1570 lines of form). When the user is actively
  // building a scenario we hide the entire app shell (sidebar + header)
  // and let Custom Builder own the screen. The persistent ScenariosShell
  // still renders Custom Builder underneath — Scenarios itself detects
  // this path and hides its page header + PillTabs.
  const isBuilderFullPage = p === "/scenarios/build";

  // Collapse the sidebar only at the moment the AI panel is opened (false → true).
  // After that the user is free to re-open the sidebar independently.
  const prevIsOpen = React.useRef(isOpen);
  React.useEffect(() => {
    if (isOpen && !prevIsOpen.current) setOpen(false);
    prevIsOpen.current = isOpen;
  }, [isOpen, setOpen]);

  // preloadAllPages is now a no-op (every page is in the main bundle since
  // we moved away from React.lazy). Left here for any future use.
  React.useEffect(() => { preloadAllPages(); }, []);

  // Full-page Custom Builder workspace: no sidebar, no header, no demo
  // banner. Just a minimal top bar with a "Back to Scenarios" link and the
  // persistent Custom Builder content underneath.
  if (isBuilderFullPage) {
    return (
      <main
        className="flex flex-col overflow-auto bg-[#f8fafc]"
        style={{ minWidth: 0, height: "100vh" }}
      >
        <BuilderTopBar />
        <div
          style={{
            maxWidth: "1400px",
            width: "100%",
            margin: "0 auto",
            padding: "clamp(1rem, 2vw, 1.75rem)",
            flex: 1,
          }}
        >
          {/* The persistent shells. Only Scenarios is active here. */}
          <DashboardShell isActive={false} />
          <PersistentPage isActive={false}><Portfolio /></PersistentPage>
          <PersistentPage isActive={true}><Scenarios /></PersistentPage>
          <PersistentPage isActive={false}><Deals /></PersistentPage>
        </div>
      </main>
    );
  }

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
                Persistent shells. Each mounts on first visit and stays in
                the DOM thereafter, toggled by display:none. Outlet is
                hidden whenever any of them is active so the underlying
                NoOpRoute render doesn't reserve layout space.
              */}
              <div style={{ display: anyPersistent ? "none" : "block" }}>
                <Outlet />
              </div>
              <DashboardShell isActive={onDashboard} />
              <PersistentPage isActive={onPortfolio}><Portfolio /></PersistentPage>
              <PersistentPage isActive={onScenarios}><Scenarios /></PersistentPage>
              <PersistentPage isActive={onDeals}><Deals /></PersistentPage>
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
