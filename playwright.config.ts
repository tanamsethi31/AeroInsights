// playwright.config.ts
//
// T-6.2 — E2E test runner. Two target modes:
//
//   PLAYWRIGHT_TARGET=local  (default)
//     • Spins up `npm run dev` (vite preview build) and runs the
//       suite against http://localhost:4173.
//     • Smoke tests in tests/e2e/*.spec.ts run unauthenticated and
//       cover the public marketing/login pages.
//
//   PLAYWRIGHT_TARGET=production
//     • Runs against PLAYWRIGHT_BASE_URL (e.g. the Vercel preview
//       deploy). No webServer start.
//
// Authenticated demo flow requires a stored auth state file at
// tests/e2e/.auth/demo.json (see docs/E2E.md for how to capture).
// Tests that need it set { storageState: ... } per spec.

import { defineConfig, devices } from "@playwright/test";

const isProd = process.env.PLAYWRIGHT_TARGET === "production";
const baseURL = isProd
  ? (process.env.PLAYWRIGHT_BASE_URL ?? "https://aeroinsights.io")
  : "http://localhost:4173";

export default defineConfig({
  testDir:  "tests/e2e",
  timeout:  30_000,
  retries:  process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: isProd ? undefined : {
    command:           "npm run preview",
    url:               "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout:           120_000,
  },
});
