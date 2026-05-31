// @vitest-environment happy-dom
// src/app/__tests__/routes-smoke.test.tsx
//
// "Every route module loads and exports a renderable default" smoke test.
//
// What this catches:
//   • Missing imports at module scope (the useMemo-not-imported class)
//   • Module-level TDZ violations (top-level let/const used before init)
//   • Wrong/missing default exports (e.g. forgetting `export default`)
//   • Top-level syntax errors that escape vite-build because vite-build
//     transpiles without full validation
//
// What it does NOT catch:
//   • Errors that only surface inside a component body once mounted with
//     real props + context. Full rendering would require mocking Auth0,
//     Supabase, all React contexts, and react-router state — too heavy
//     for a smoke test. We rely on TypeScript + ESLint hooks rules for
//     those (which would have caught the Scenarios TDZ).
//
// This test is intentionally minimal. The win is catching the lethal
// "your module won't even load in the browser" class of error before
// deploy.

import { describe, it, expect } from "vitest";

const PAGES = [
  ["Landing",        () => import("../pages/Landing")],
  ["Login",          () => import("../pages/Login")],
  ["Dashboard",      () => import("../pages/Dashboard")],
  ["Portfolio",      () => import("../pages/Portfolio")],
  ["PortfolioHub",   () => import("../pages/PortfolioHub")],
  ["LibraryPage",         () => import("../pages/scenarios/LibraryPage")],
  ["CustomBuilderPage",   () => import("../pages/scenarios/CustomBuilderPage")],
  ["RunHistoryPage",      () => import("../pages/scenarios/RunHistoryPage")],
  ["CalibrationToolsPage",() => import("../pages/scenarios/CalibrationToolsPage")],
  ["RiskECL",        () => import("../pages/RiskECL")],
  ["Counterparties", () => import("../pages/Counterparties")],
  ["Jurisdictions",  () => import("../pages/Jurisdictions")],
  ["Reports",        () => import("../pages/Reports")],
  ["Settings",       () => import("../pages/Settings")],
  ["Deals",          () => import("../pages/Deals")],
  ["Intelligence",   () => import("../pages/Intelligence")],
  ["Transactions",   () => import("../pages/Transactions")],
  ["Reconciliation", () => import("../pages/Reconciliation")],
  ["CashFlow",       () => import("../pages/CashFlow")],
  ["Maintenance",    () => import("../pages/Maintenance")],
  ["RateOutlook",    () => import("../pages/RateOutlook")],
  ["ExcelAddinDocs", () => import("../pages/ExcelAddinDocs")],
] as const;

describe("routes smoke", () => {
  it.each(PAGES)("page module %s loads and has a default export", async (_name, loader) => {
    const mod = await loader();
    // Default export must be a React component (function / class with capital
    // first letter). We just assert it's a function and is named — anything
    // else (undefined, object) would mean we'd 404 at runtime.
    expect(mod.default).toBeTypeOf("function");
    expect((mod.default as { name: string }).name.length).toBeGreaterThan(0);
  });

  it("router config loads without throwing", async () => {
    const mod = await import("../routes");
    expect(mod.router).toBeDefined();
    // createBrowserRouter returns an object with a `routes` array
    expect((mod.router as { routes: unknown[] }).routes.length).toBeGreaterThan(0);
  });
});
