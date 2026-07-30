import { Navigate } from "react-router";
import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout/Layout";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RouteErrorBoundary } from "./components/errors/RouteErrorBoundary";
import { usePortfolio } from "./contexts/PortfolioContext";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import About from "./pages/About";
import { PrivacyPage, TermsPage, SecurityPage, CookiePage } from "./pages/Legal";
import { DocumentationPage, HelpPage, ApiPage, StatusPage } from "./pages/Resources";
import { BlogPage } from "./pages/Blog";
import PortfolioHub from "./pages/PortfolioHub";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import ExcelAddinDocs from "./pages/ExcelAddinDocs";

// HISTORY: previously every page was wrapped in React.lazy() + lazyWithRetry
// + preloadAllPages(). That gave us a smaller initial bundle and per-page
// chunks, but introduced a React 18 Suspense ↔ lazy interaction that an
// independent reviewer reproduced: rapid clicks across lazy boundaries
// can leave the URL pointing at the new route while the Outlet keeps
// rendering the previous lazy component (Suspense "stale-content"
// throttling + concurrent commit ordering). After many rounds of trying
// to work around this with startTransition, optimistic state, chunk
// preloading, IntersectionObserver-deferred mounts, and aggressive
// memoization, none of them eliminated the desync.
//
// Switching back to STATIC imports. Trade-off: the main bundle grows
// (~370KB → ~1MB gzipped), but the entire Suspense+lazy class of bugs
// disappears — every page component is in memory the moment React-Router
// matches its route, so the Outlet swap is a pure synchronous render. No
// chunk fetches, no Suspense fallback, no commit-ordering races.
// Dashboard, Portfolio, Scenarios, Deals are no longer rendered through the
// router — they live persistently inside Layout's PersistentPage shells.
// Their mount cost is paid once on first visit and never again, eliminating
// the unmount-choking-next-page-mount freeze. The route entries below
// resolve to NoOpRoute so react-router still matches the URL (sidebar
// active state, deep links, browser history all keep working) while the
// actual rendering happens in Layout. See Layout.tsx for the pattern.
import CustomBuilderPage from "./pages/CustomBuilderPage";
import Scenarios       from "./pages/Scenarios";
import RiskECL         from "./pages/RiskECL";
import Counterparties  from "./pages/Counterparties";
import Jurisdictions   from "./pages/Jurisdictions";
import Reports         from "./pages/Reports";
import Settings        from "./pages/Settings";
import Intelligence    from "./pages/Intelligence";
import Transactions    from "./pages/Transactions";
import Reconciliation  from "./pages/Reconciliation";
import CashFlow        from "./pages/CashFlow";
import Maintenance     from "./pages/Maintenance";
import RateOutlook     from "./pages/RateOutlook";

// preloadAllPages no longer needed — every page is in the main bundle.
// Layout's import of this function is now a no-op for back-compat.
export function preloadAllPages(): void { /* no-op */ }

// Placeholder for routes whose actual rendering happens in Layout's
// PersistentPage shells. React-router still matches these URLs (sidebar
// active state, deep links, browser history) but the route itself renders
// nothing; the persistent component lives in Layout.
function NoOpRoute() { return null; }

/**
 * Guards the dashboard index route.
 * If no portfolio has been selected, sends the user to /portfolios. After
 * they pick one, setActivePortfolio navigates them back to / where the
 * Dashboard persistent shell takes over.
 */
function PortfolioIndexGuard() {
  const { activePortfolioId } = usePortfolio();
  if (!activePortfolioId) {
    return <Navigate to="/portfolios" replace />;
  }
  // Dashboard is rendered by Layout's persistent shell. Returning null
  // here lets that shell own the screen.
  return null;
}

export const router = createBrowserRouter([
  // Public
  { path: "/home", Component: Landing, ErrorBoundary: RouteErrorBoundary },
  { path: "/about", Component: About, ErrorBoundary: RouteErrorBoundary },
  { path: "/login", Component: Login, ErrorBoundary: RouteErrorBoundary },
  { path: "/docs/excel-addin", Component: ExcelAddinDocs, ErrorBoundary: RouteErrorBoundary },
  { path: "/privacy",  Component: PrivacyPage,  ErrorBoundary: RouteErrorBoundary },
  { path: "/terms",    Component: TermsPage,    ErrorBoundary: RouteErrorBoundary },
  { path: "/security", Component: SecurityPage, ErrorBoundary: RouteErrorBoundary },
  { path: "/cookies",  Component: CookiePage,   ErrorBoundary: RouteErrorBoundary },
  { path: "/docs",     Component: DocumentationPage, ErrorBoundary: RouteErrorBoundary },
  { path: "/help",     Component: HelpPage,          ErrorBoundary: RouteErrorBoundary },
  { path: "/api",      Component: ApiPage,           ErrorBoundary: RouteErrorBoundary },
  { path: "/status",   Component: StatusPage,        ErrorBoundary: RouteErrorBoundary },
  { path: "/blog",     Component: BlogPage,          ErrorBoundary: RouteErrorBoundary },

  // Root layout — RequireAuth gates the app shell; unauthenticated "/" → /home
  // Top-level ErrorBoundary catches anything that bubbles past the inner
  // boundaries (auth failures, route-load failures, unknown JS errors).
  {
    path: "/",
    Component: RequireAuth,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      // Portfolio hub — full-page, no sidebar/header shell
      { path: "portfolios", Component: PortfolioHub, ErrorBoundary: RouteErrorBoundary },
      // Onboarding wizard — full-page, no sidebar/header shell
      { path: "onboarding", Component: OnboardingWizard, ErrorBoundary: RouteErrorBoundary },

      // App shell — Layout wraps everything below. The inner ErrorBoundary
      // means a single page crashing won't take down the rest of the app
      // shell context (auth, data, portfolio selection).
      {
        Component: Layout,
        ErrorBoundary: RouteErrorBoundary,
        children: [
          // Index: redirect to /portfolios until a portfolio is selected
          { index: true, Component: PortfolioIndexGuard },

          // Portfolio — persistent shell in Layout
          { path: "portfolio",                  Component: NoOpRoute },
          { path: "portfolio/register",         Component: NoOpRoute },
          { path: "portfolio/analytics",        Component: NoOpRoute },
          { path: "portfolio/aircraft-mix",     Component: NoOpRoute },
          { path: "portfolio/performance",      Component: NoOpRoute },

          // Scenarios — normal Outlet-rendered route now (no longer in
          // Layout's persistent shell). With Custom Builder lifted out
          // to its own /build page the surface here is Library + Run
          // History + the analysis sub-tabs — light enough to mount and
          // unmount through the normal react-router path. Persistent
          // mount was forcing a Scenarios re-render on every cross-page
          // nav via its useLocation subscription.
          { path: "scenarios",                  Component: Scenarios },
          { path: "scenarios/library",          Component: Scenarios },
          { path: "scenarios/history",          Component: Scenarios },

          // Custom Builder is its OWN top-level page at /build (same
          // Outlet-rendered style as /intelligence/rate-outlook — fresh
          // mount per visit, clean unmount on leave). NOT a sub-route of
          // /scenarios so leaving Scenarios doesn't drag it through any
          // shared rendering tree. Form state persists via localStorage;
          // clones bridge via sessionStorage.
          { path: "build",                      Component: CustomBuilderPage },
          // Legacy aliases — keep working for bookmarks/deep links.
          { path: "scenarios/build",            Component: CustomBuilderPage },
          { path: "scenarios/run",              Component: CustomBuilderPage },

          // Deals — persistent shell in Layout
          { path: "deals",                      Component: NoOpRoute },
          { path: "deals/generator",            Component: NoOpRoute },
          { path: "deals/rack-stack",           Component: NoOpRoute },
          { path: "deals/exit-npv",             Component: NoOpRoute },

          // Transactions
          { path: "transactions",       Component: Transactions },
          { path: "transactions/setup", Component: Transactions },

          // Reconciliation
          { path: "reconciliation", Component: Reconciliation },
          { path: "cash-flow", Component: CashFlow },

          // Risk & ECL
          { path: "risk-ecl",                   Component: RiskECL },
          { path: "risk-ecl/summary",           Component: RiskECL },
          { path: "risk-ecl/migration",         Component: RiskECL },
          { path: "risk-ecl/waterfall",         Component: RiskECL },
          { path: "risk-ecl/rating-pd",         Component: RiskECL },

          // Maintenance
          { path: "maintenance",            Component: Maintenance },
          { path: "maintenance/aircraft",   Component: Maintenance },
          { path: "maintenance/scenarios",  Component: Maintenance },
          { path: "maintenance/redelivery", Component: Maintenance },

          // Intelligence
          { path: "counterparties",             Component: Counterparties },
          { path: "jurisdictions",              Component: Jurisdictions },

          // Aero Intelligence
          { path: "intelligence",               Component: Intelligence },
          { path: "intelligence/signals",       Component: Intelligence },
          { path: "intelligence/lessee-radar",  Component: Intelligence },
          { path: "intelligence/deal-feed",     Component: Intelligence },
          { path: "intelligence/jx-watch",      Component: Intelligence },
          { path: "intelligence/rate-outlook",  Component: RateOutlook },

          // Reports
          { path: "reports",                    Component: Reports },
          { path: "reports/templates",          Component: Reports },
          { path: "reports/scheduled",          Component: Reports },
          { path: "reports/export-log",         Component: Reports },

          // Settings
          { path: "settings",                   Component: Settings },
          { path: "settings/firm",              Component: Settings },
          { path: "settings/users",             Component: Settings },
          { path: "settings/data-sources",      Component: Settings },
          { path: "settings/ecl",               Component: Settings },
          { path: "settings/excel",             Component: Settings },
        ],
      },
    ],
  },
]);
