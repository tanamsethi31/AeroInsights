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

## Known gaps

1. The browser still talks to Supabase using the anon key directly.
   Auth0 → Supabase token exchange has not been formalised in a
   dedicated edge function; the current flow relies on the JWT
   custom claim being set during Auth0 sign-in. A misconfigured
   tenant will read/write zero rows, which is the safe failure mode.
2. Service-role key must never ship to the browser bundle. Only
   server-side ingest functions on Vercel should use it.
3. JWT key rotation is documented in Auth0 — Supabase verifies via
   the published JWKS endpoint, so rotation is transparent.
