import { Navigate } from "react-router";
import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout/Layout";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RouteErrorBoundary } from "./components/errors/RouteErrorBoundary";
import { usePortfolio } from "./contexts/PortfolioContext";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Portfolio";
import Scenarios from "./pages/Scenarios";
import RiskECL from "./pages/RiskECL";
import Counterparties from "./pages/Counterparties";
import Jurisdictions from "./pages/Jurisdictions";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import PortfolioHub from "./pages/PortfolioHub";
import Deals from "./pages/Deals";
import Intelligence from "./pages/Intelligence";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import ExcelAddinDocs from "./pages/ExcelAddinDocs";
import Transactions from "./pages/Transactions";
import Reconciliation from "./pages/Reconciliation";
import CashFlow from "./pages/CashFlow";
import Maintenance from "./pages/Maintenance";
import RateOutlook from "./pages/RateOutlook";

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

          // Scenarios
          { path: "scenarios",                  Component: Scenarios },
          { path: "scenarios/library",          Component: Scenarios },
          { path: "scenarios/run",              Component: Scenarios },
          { path: "scenarios/history",          Component: Scenarios },

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
