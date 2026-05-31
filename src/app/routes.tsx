import { Navigate } from "react-router";
import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout/Layout";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RouteErrorBoundary } from "./components/errors/RouteErrorBoundary";
import { usePortfolio } from "./contexts/PortfolioContext";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
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
import Dashboard       from "./pages/Dashboard";
import Portfolio       from "./pages/Portfolio";
import LibraryPage         from "./pages/scenarios/LibraryPage";
import CustomBuilderPage   from "./pages/scenarios/CustomBuilderPage";
import RunHistoryPage      from "./pages/scenarios/RunHistoryPage";
import CalibrationToolsPage from "./pages/scenarios/CalibrationToolsPage";
import RiskECL         from "./pages/RiskECL";
import Counterparties  from "./pages/Counterparties";
import Jurisdictions   from "./pages/Jurisdictions";
import Reports         from "./pages/Reports";
import Settings        from "./pages/Settings";
import Deals           from "./pages/Deals";
import Intelligence    from "./pages/Intelligence";
import Transactions    from "./pages/Transactions";
import Reconciliation  from "./pages/Reconciliation";
import CashFlow        from "./pages/CashFlow";
import Maintenance     from "./pages/Maintenance";
import RateOutlook     from "./pages/RateOutlook";

// preloadAllPages no longer needed — every page is in the main bundle.
// Layout's import of this function is now a no-op for back-compat.
export function preloadAllPages(): void { /* no-op */ }

/**
 * Guards the dashboard index route.
 * If no portfolio has been selected, send the user to /portfolios.
 * After they pick one, setActivePortfolio navigates them back to / and this
 * component renders the Dashboard.
 */
function PortfolioIndexGuard() {
  const { activePortfolioId } = usePortfolio();
  if (!activePortfolioId) {
    return <Navigate to="/portfolios" replace />;
  }
  return <Dashboard />;
}

export const router = createBrowserRouter([
  // Public
  { path: "/home", Component: Landing, ErrorBoundary: RouteErrorBoundary },
  { path: "/login", Component: Login, ErrorBoundary: RouteErrorBoundary },
  { path: "/docs/excel-addin", Component: ExcelAddinDocs, ErrorBoundary: RouteErrorBoundary },

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

          // Portfolio
          { path: "portfolio",                  Component: Portfolio },
          { path: "portfolio/register",         Component: Portfolio },
          { path: "portfolio/analytics",        Component: Portfolio },
          { path: "portfolio/aircraft-mix",     Component: Portfolio },
          { path: "portfolio/performance",      Component: Portfolio },

          // Scenarios — split into 4 independent pages (commit: stop the
          // monolithic Scenarios.tsx from choking the next-page mount when
          // the user leaves Scenarios). Shared state lives in
          // ScenariosProvider mounted in Layout.
          { path: "scenarios",          Component: LibraryPage         },
          { path: "scenarios/library",  Component: LibraryPage         },
          { path: "scenarios/build",    Component: CustomBuilderPage   },
          { path: "scenarios/run",      Component: CustomBuilderPage   }, // legacy alias
          { path: "scenarios/history",  Component: RunHistoryPage      },
          { path: "scenarios/tools",    Component: CalibrationToolsPage },

          // Deals
          { path: "deals",                      Component: Deals },
          { path: "deals/generator",            Component: Deals },
          { path: "deals/rack-stack",           Component: Deals },
          { path: "deals/exit-npv",             Component: Deals },

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
          { path: "maintenance",           Component: Maintenance },
          { path: "maintenance/aircraft",  Component: Maintenance },
          { path: "maintenance/scenarios", Component: Maintenance },

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
