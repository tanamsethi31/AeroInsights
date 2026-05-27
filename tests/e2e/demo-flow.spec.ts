// tests/e2e/demo-flow.spec.ts
//
// T-6.2 — full demo-script E2E. Covers:
//   sign-in → upload sample portfolio → see ECL → run scenario →
//   export report → verify in Export History.
//
// Skipped by default because it requires:
//   1. A captured Auth0 session at tests/e2e/.auth/demo.json.
//   2. AeroInsights_SamplePortfolio_2026.xlsx in the repo root (already
//      present in main).
//   3. PLAYWRIGHT_TARGET set to a deploy that has the demo tenant
//      seeded.
//
// To run locally:
//   AEROINSIGHTS_RUN_DEMO_FLOW=1 npx playwright test demo-flow
// See docs/E2E.md for setup.

import { test, expect } from "@playwright/test";
import path from "node:path";

const SHOULD_RUN = process.env.AEROINSIGHTS_RUN_DEMO_FLOW === "1";

test.describe("demo flow", () => {
  test.skip(!SHOULD_RUN, "set AEROINSIGHTS_RUN_DEMO_FLOW=1 to enable (see docs/E2E.md)");
  test.use({ storageState: "tests/e2e/.auth/demo.json" });

  test("sign in → upload → ECL → scenario → export → history", async ({ page }) => {
    // 1. Land on portfolios after auth.
    await page.goto("/portfolios");
    await expect(page).toHaveURL(/portfolios/);

    // 2. Upload portfolio.
    await page.getByRole("button", { name: /upload|import/i }).first().click();
    const file = path.resolve(process.cwd(), "AeroInsights_SamplePortfolio_2026.xlsx");
    await page.setInputFiles('input[type="file"]', file);
    await expect(page.getByText(/Review|ready|preview/i).first()).toBeVisible({ timeout: 30_000 });
    // Commit the import.
    await page.getByRole("button", { name: /commit|import|confirm/i }).first().click();

    // 3. Navigate to Risk & ECL — verify the live KPIs render.
    await page.goto("/risk-ecl");
    await expect(page.getByText(/Total ECL|Lifetime ECL|Weighted ECL/i).first()).toBeVisible();

    // 4. Run a scenario from the library.
    await page.goto("/scenarios/library");
    await page.getByRole("button", { name: /run/i }).first().click();
    await expect(page.getByText(/result|finding|attribution|completed/i).first()).toBeVisible({ timeout: 15_000 });

    // 5. Export a report.
    await page.goto("/reports");
    await page.getByRole("button", { name: /export|download|generate/i }).first().click();
    await page.getByRole("button", { name: /csv|pdf|download/i }).first().click();

    // 6. Verify entry in Export History.
    await page.goto("/reports/history");
    await expect(page.getByText(/Recent Exports|Export History/i).first()).toBeVisible();
    // The most recent export row should show up (id-agnostic — match on
    // today's date display).
    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
    await expect(page.getByText(today, { exact: false }).first()).toBeVisible();
  });
});
