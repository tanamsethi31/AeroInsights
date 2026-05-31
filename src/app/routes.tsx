import { lazy, type LazyExoticComponent, type ComponentType } from "react";
import { Navigate } from "react-router";

/**
 * Wraps React.lazy so chunk-load failures auto-recover by reloading the
 * page once. This handles the very common deploy-mid-session edge case:
 *
 *   1. User loads /  → browser caches index.html referencing chunk
 *      `Portfolio-OLDHASH.js`.
 *   2. We deploy. New `index.html` references `Portfolio-NEWHASH.js`.
 *      The OLDHASH file is purged from the CDN.
 *   3. User clicks "Portfolio" — the cached JS tries to import OLDHASH
 *      → 404 → "Failed to fetch dynamically imported module".
 *
 * Without recovery, the page is permanently broken until the user
 * manually hard-refreshes. With this wrapper, we detect the chunk-load
 * error, set a sessionStorage flag to prevent reload loops, and force
 * a full page navigation so the browser picks up the new index.html
 * and the new chunk hashes.
 */
const CHUNK_RELOAD_FLAG = "aeroinsights:chunk-reload-attempted";

function lazyWithRetry<T extends ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await loader();
      // Successful load — clear any stale reload flag from a prior recovery.
      sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
      return mod;
    } catch (err) {
      const msg = String((err as Error)?.message ?? "");
      const isChunkError =
        /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Loading CSS chunk/i.test(msg) ||
        msg.includes("error loading dynamically imported module");

      if (!isChunkError) throw err;

      if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
        // Already tried once this session; don't loop. Surface the error
        // to the route boundary so the user sees something instead of
        // a blank reload cycle.
        throw err;
      }

      sessionStorage.setItem(CHUNK_RELOAD_FLAG, "1");
      window.location.reload();
      // The reload is in flight; return a promise that never resolves so
      // React.lazy doesn't render anything before the page unloads.
      return new Promise<{ default: T }>(() => {});
    }
  });
}
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

// Heavy app pages are code-split via React.lazy so that:
//   1. Initial bundle is smaller — first nav into the app shell loads only the
//      shell + landing/login.
//   2. Each page becomes a separate chunk that resolves asynchronously,
//      letting the <Suspense> boundary in Layout show a fallback the moment
//      the user clicks a nav item.
//
// Loader functions are kept as named consts so we can both:
//   (a) wrap them in React.lazy for the router, AND
//   (b) call them eagerly on idle (see preloadAllPages below) to warm the
//       chunk cache before the user clicks. Without preloading, the FIRST
//       click on each tab paid a network + parse cost — and rapid clicks
//       across multiple cold tabs stacked those costs into the freeze
//       symptom the user has been reporting.
const loadDashboard      = () => import("./pages/Dashboard");
const loadPortfolio      = () => import("./pages/Portfolio");
const loadScenarios      = () => import("./pages/Scenarios");
const loadRiskECL        = () => import("./pages/RiskECL");
const loadCounterparties = () => import("./pages/Counterparties");
const loadJurisdictions  = () => import("./pages/Jurisdictions");
const loadReports        = () => import("./pages/Reports");
const loadSettings       = () => import("./pages/Settings");
const loadDeals          = () => import("./pages/Deals");
const loadIntelligence   = () => import("./pages/Intelligence");
const loadTransactions   = () => import("./pages/Transactions");
const loadReconciliation = () => import("./pages/Reconciliation");
const loadCashFlow       = () => import("./pages/CashFlow");
const loadMaintenance    = () => import("./pages/Maintenance");
const loadRateOutlook    = () => import("./pages/RateOutlook");

const Dashboard       = lazyWithRetry(loadDashboard);
const Portfolio       = lazyWithRetry(loadPortfolio);
const Scenarios       = lazyWithRetry(loadScenarios);
const RiskECL         = lazyWithRetry(loadRiskECL);
const Counterparties  = lazyWithRetry(loadCounterparties);
const Jurisdictions   = lazyWithRetry(loadJurisdictions);
const Reports         = lazyWithRetry(loadReports);
const Settings        = lazyWithRetry(loadSettings);
const Deals           = lazyWithRetry(loadDeals);
const Intelligence    = lazyWithRetry(loadIntelligence);
const Transactions    = lazyWithRetry(loadTransactions);
const Reconciliation  = lazyWithRetry(loadReconciliation);
const CashFlow        = lazyWithRetry(loadCashFlow);
const Maintenance     = lazyWithRetry(loadMaintenance);
const RateOutlook     = lazyWithRetry(loadRateOutlook);

/**
 * Warm the chunk cache for every lazy page. Called from Layout after first
 * paint, scheduled with requestIdleCallback so it doesn't compete with
 * critical work. Each tab's chunk loads ONCE, in the background, while the
 * user is reading the landing dashboard. Subsequent nav becomes a pure
 * in-memory component swap — no network, no parse, no Suspense fallback.
 *
 * This is the fix for the "first click on each tab feels slow → rapid
 * clicks stack into a freeze" pattern. After preload completes the
 * top-level tab swaps cost ~5ms each.
 */
export function preloadAllPages(): void {
  const loaders = [
    loadDashboard, loadPortfolio, loadScenarios, loadRiskECL,
    loadCounterparties, loadJurisdictions, loadReports, loadSettings,
    loadDeals, loadIntelligence, loadTransactions, loadReconciliation,
    loadCashFlow, loadMaintenance, loadRateOutlook,
  ];
  const idle =
    (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
    ?? ((cb: () => void) => window.setTimeout(cb, 1));
  // Stagger by 50ms each so the browser can interleave with user work
  // instead of issuing 15 simultaneous chunk requests.
  loaders.forEach((load, i) => {
    idle(() => window.setTimeout(() => { void load().catch(() => {}); }, i * 50));
  });
}

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
