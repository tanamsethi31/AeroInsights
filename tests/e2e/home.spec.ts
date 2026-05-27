// tests/e2e/home.spec.ts
//
// T-6.2 — smoke suite for the public route stack. Runs without auth,
// safe for CI on every PR. Verifies the React tree mounts, the
// Sentry.ErrorBoundary doesn't fire, and the public copy renders.

import { test, expect } from "@playwright/test";

test.describe("public routes", () => {
  test("landing page renders without crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/home");
    // Sentry.ErrorBoundary fallback copy — must NOT appear.
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    // Page-load errors stay empty (Auth0 silent-auth pings are
    // filtered by the Sentry init; everything else fails the test).
    expect(errors.filter((e) => !/Auth0|login_required|consent_required/i.test(e))).toEqual([]);
  });

  test("login page renders the brand mark", async ({ page }) => {
    await page.goto("/login");
    // Brand wordmark from src/app/pages/Login.tsx.
    await expect(page.getByText(/Aeroinsights/i).first()).toBeVisible();
  });

  test("root path redirects somewhere valid", async ({ page }) => {
    const response = await page.goto("/");
    // Either renders directly OR redirects to /home or /login.
    expect(response?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    expect(url).toMatch(/\/(home|login|portfolios|onboarding|$)/);
  });

  test("excel addin docs page renders without auth", async ({ page }) => {
    await page.goto("/docs/excel-addin");
    await expect(page.locator("body")).toBeVisible();
  });
});
