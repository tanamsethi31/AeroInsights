# End-to-end tests (T-6.2)

## Quick start

```bash
# One-time browser binary download
npx playwright install chromium

# Build the SPA so `vite preview` has something to serve
npm run build

# Run the public smoke suite (no auth)
npx playwright test
```

The smoke suite (`tests/e2e/home.spec.ts`) verifies the public route
stack: `/home`, `/login`, `/`, `/docs/excel-addin`. It's safe to run
on every PR — no Supabase / Auth0 / Resend / NewsAPI credentials
required.

## Target environments

```bash
# Default — local preview build on port 4173
npx playwright test

# Run against a Vercel preview deploy
PLAYWRIGHT_TARGET=production \
PLAYWRIGHT_BASE_URL=https://aeroinsights-pr-42.vercel.app \
  npx playwright test
```

When `PLAYWRIGHT_TARGET=production` is set, the runner skips the
`vite preview` web server and hits the URL directly.

## Demo flow (full sign-in → upload → ECL → scenario → export → history)

The full demo script lives in `tests/e2e/demo-flow.spec.ts` and is
skipped by default because it needs:

1. **A captured Auth0 session** at
   `tests/e2e/.auth/demo.json`. Generate it once:

   ```bash
   npx playwright open https://aeroinsights.io --save-storage tests/e2e/.auth/demo.json
   ```

   Sign in interactively in the launched browser; the storage state
   (cookies + localStorage) is dumped on close.

2. **The sample workbook** —
   `AeroInsights_SamplePortfolio_2026.xlsx` in the repo root. Already
   committed in `main`.

3. **A deploy with the demo tenant seeded** (any production / preview
   that has `org_members` rows for the captured Auth0 user).

To run:

```bash
AEROINSIGHTS_RUN_DEMO_FLOW=1 \
PLAYWRIGHT_TARGET=production \
PLAYWRIGHT_BASE_URL=https://aeroinsights.io \
  npx playwright test demo-flow
```

The spec walks:

1. Authenticated load of `/portfolios`.
2. File-upload widget consumes the sample workbook.
3. `/risk-ecl` shows the computed ECL KPIs.
4. `/scenarios/library` runs a template scenario.
5. `/reports` triggers a CSV export.
6. `/reports/history` confirms the export landed in
   `report_exports` and emits a signed-URL download row.

## CI integration

Add to GitHub Actions:

```yaml
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: npm run build
- run: npx playwright test
  env:
    CI: 1
```

Set `AEROINSIGHTS_RUN_DEMO_FLOW=1` only on a scheduled (nightly) job,
not on every PR — the demo flow consumes the live demo tenant.
