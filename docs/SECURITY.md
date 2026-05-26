# Aeroinsights — Security model

## RLS (Phase 4.1)

All tenant-scoped tables enforce row-level security via the JWT claim
`auth.jwt() ->> 'org_id'`. Auth0 is configured to inject this claim
into every Supabase-bound JWT.

### Pattern

For every table that carries an `org_id` column:

```sql
create policy <table>_select_own_org on <table>
  for select to public
  using (org_id = ((auth.jwt() ->> 'org_id')::uuid));

create policy <table>_insert_own_org on <table>
  for insert to public
  with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

create policy <table>_update_own_org on <table>
  for update to public
  using      (org_id = ((auth.jwt() ->> 'org_id')::uuid))
  with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
```

A JWT without an `org_id` claim — including the anonymous Supabase
anon key when used directly from the browser — sees zero rows on
every tenant table.

### Append-only tables

`audit_log`, `scenario_runs`, `stage_migrations`, `report_exports`,
`ecl_period_snapshots` get only `select` + `insert` policies; UPDATE
and DELETE are additionally blocked by `BEFORE` triggers regardless
of RLS state. This is belt-and-braces — the trigger is the last line
of defence so an RLS misconfiguration can never lose audit history.

### Storage (`reports` bucket)

Path convention: `{org_id}/{portfolio_id}/{yyyy-mm-dd}/{ts}-{filename}`.

```sql
create policy "reports_own_org_select" on storage.objects
  for select to public
  using (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
  );
```

`storage.foldername(name)[1]` is the first path segment. Signed URLs
are still required to read; this just stops cross-tenant listing /
overwrite at the storage layer.

## Tables covered

Locked down in `20260525170000_phase4_rls_lockdown.sql`:

- `audit_log`
- `scenario_runs`
- `report_exports`
- `stage_migrations`
- `ifrs9_parameters`
- `sicr_config`
- `stress_scenarios`
- `restructuring_presets`
- `jurisdiction_lgd_overlays`
- `security_deposits`
- `maintenance_reserves`
- `portfolios`

Already locked down by earlier migrations:

- `leases`, `lessees`, `assets`, `uploads`, `provisions`,
  `assumption_change_log`, `ecl_period_snapshots`,
  `lessee_financials`, `market_data`, `org_members`,
  `organisations`, `reconciliation_matches`, `servicer_reports`,
  `bank_statements`, `bank_transactions`, `cash_events`,
  `abs_deals`.

## Verification

```sql
select tablename, count(*) filter (
  where qual = 'true' or with_check = 'true'
) as permissive_policies
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;
```

Every row must have `permissive_policies = 0`.

## Auth flow (Phase 4.2)

```
Browser                Auth0                Vercel /api/auth/supabase-token             Supabase
  |                      |                            |                                    |
  |--- login --------->  |                            |                                    |
  |<-- auth0_token ----  |                            |                                    |
  |                                                                                        |
  |--- POST /api/auth/supabase-token (Bearer auth0_token) ------>                         |
  |                                          verify auth0_token via JWKS                  |
  |                                          look up org_members(user_id)                 |
  |                                            using SUPABASE_SERVICE_ROLE_KEY -------->  |
  |                                          sign HS256 JWT with SUPABASE_JWT_SECRET      |
  |                                            embedding { sub, email, role, org_id }      |
  |<-- { access_token, org_id, expires_in } -                                              |
  |                                                                                        |
  |--- supabase.auth.setSession({ access_token, ... })                                     |
  |--- query (any table)  ----------------------------------------------------------> RLS  |
  |                                              policy: org_id = auth.jwt()->>'org_id'    |
  |<-- rows in user's org only --------------------------------------------------------    |
```

Re-exchange runs on a `setInterval` ~1 min before each token's 1 h
expiry; long-lived sessions keep RLS working without forcing the user
to sign in again.

## Required server-side env vars

| Variable                      | Surface          | Notes |
|-------------------------------|------------------|-------|
| `AUTH0_DOMAIN`                | Vercel function  | JWKS host, e.g. `dev-xxx.eu.auth0.com` |
| `AUTH0_AUDIENCE`              | Vercel function  | Auth0 API audience identifier |
| `SUPABASE_URL`                | Vercel function  | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY`   | Vercel function  | NEVER bundle into browser code |
| `SUPABASE_JWT_SECRET`         | Vercel function  | Project Settings → API → JWT Secret |
| `VITE_API_BASE_URL`           | Browser          | e.g. `https://aeroinsights.io/api/v1`; if unset, exchange is skipped (legacy demo) |
| `RESEND_API_KEY`              | Vercel cron      | Email send key for /api/cron/alerts (Phase 5.1) |
| `RESEND_FROM_EMAIL`           | Vercel cron      | From-address. Default `alerts@aeroinsights.io` |
| `CRON_SECRET`                 | Vercel cron      | Bearer-token gate for /api/cron/* endpoints |
| `SENTRY_DSN_EDGE`             | Vercel function  | T-6.3 — captures unhandled throws + audit failures |
| `SENTRY_TRACES_SAMPLE_RATE`   | Vercel function  | Optional, default 0.05 |
| `VITE_SENTRY_DSN_FRONTEND`    | Browser          | T-6.3 — SPA error capture + ErrorBoundary |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | Browser       | Optional, default 0.05 |

## Known gaps

1. **Service-role isolation** — the only legitimate consumer of
   `SUPABASE_SERVICE_ROLE_KEY` is server-side code on Vercel.
   `api/auth/supabase-token.ts` is the canonical example. New API routes
   that need it MUST go through Vercel functions, NOT `import.meta.env`.
2. **JWT key rotation** — Auth0 RSA keys rotate transparently via JWKS.
   Supabase JWT secret rotation requires updating
   `SUPABASE_JWT_SECRET` in Vercel and invalidates all in-flight
   sessions; users get a 401 + re-exchange on the next polling tick.
3. **No refresh token** — the exchange endpoint returns only an access
   token; we re-mint on a timer rather than via `/token` refresh. Side
   effect: a refresh while the Auth0 session is itself expired produces
   a brief unauthenticated state — handled by the
   `exchangeAndSetSession` fallback path.
