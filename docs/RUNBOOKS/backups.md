# Backups + restore runbook

## Backup strategy

Three layers, all automated:

1. **Supabase Point-in-Time Recovery (PITR)**
   - **What:** Continuous WAL streaming + daily base backups.
   - **Retention:** 7 days (Free), 30 days (Pro+).
   - **Granularity:** Restore to any second within the window.
   - **Where:** Supabase dashboard → Database → Backups.

2. **Daily logical dump (cron, optional)**
   - **What:** A nightly `pg_dump --schema=public` written to a
     Vercel Blob bucket. Adds an off-cloud copy for SEV-1
     ransomware / account-takeover scenarios.
   - **Status:** Not yet implemented. Tracked in `docs/ROADMAP.md`
     under "Operational hardening".

3. **Storage bucket replication**
   - `reports/` bucket holds every generated PDF/DOCX/XLSX since
     T-3.3. Supabase Storage replicates within the region; no
     additional config required.

## Restore drill cadence

| Cadence | Action | Owner |
|---|---|---|
| **Monthly** | Restore the previous-night PITR to a *separate Supabase project* (`aero-restore-drill`). Verify a known fixture row exists. Tear the project down. | Eng lead |
| **Quarterly** | Full DR exercise — restore to drill project, point a Vercel preview at it, run Playwright smoke + demo flow. | Eng lead + on-call |
| **Annually** | Tabletop incident exercise simulating tenant data loss. Document recovery time + identified gaps. | Compliance |

## Restore procedure (SEV-1 — production loss)

Pre-requisites:
- Service-role key for the target Supabase project (kept in
  1Password vault `aeroinsights-prod`).
- A clean Vercel environment to repoint the SPA at if the prod
  project is unrecoverable.

Steps:

1. **Halt writes** — disable all crons in `vercel.json` (or use the
   Vercel dashboard to pause them) and put up a banner on the SPA
   via the dashboard's `MAINTENANCE_MODE` env var.

2. **Create a recovery target** — Supabase dashboard → New project
   in the same region, name `aeroinsights-recovery-<YYYY-MM-DD>`.

3. **PITR restore** — In the original project's Backups tab pick
   the timestamp ≤ the incident start. Supabase produces a
   `.tar.gz` dump.

4. **Apply dump to the recovery target**:
   ```bash
   pg_restore --no-owner --clean --if-exists \
     --dbname "$RECOVERY_DB_URL" \
     ./aeroinsights-pitr-<ts>.tar.gz
   ```

5. **Re-apply migrations** — run `supabase db push` against the
   recovery project so the schema matches HEAD if the PITR pre-dates
   the latest migration.

6. **Swap env vars** — In Vercel:
   - `SUPABASE_URL` → recovery URL
   - `SUPABASE_SERVICE_ROLE_KEY` → recovery service-role key
   - `SUPABASE_JWT_SECRET` → recovery JWT secret
   - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` → recovery values

7. **Verify**:
   ```bash
   npm run test:e2e
   AEROINSIGHTS_RUN_DEMO_FLOW=1 PLAYWRIGHT_TARGET=production \
   PLAYWRIGHT_BASE_URL=https://aeroinsights-recovery.vercel.app \
     npm run test:e2e
   ```

8. **Reopen writes** — uncomment crons, drop the maintenance banner.

9. **Postmortem** — file under `docs/POSTMORTEMS/`.

## Verification fixtures

A row must always exist in the production tenant for restore-drill
sanity checking:

```sql
-- Demo tenant
select id, name, base_currency from organisations
 where name = 'Aer Capital Partners Ltd.';

-- Lease fixture: known external_id
select external_id, stage from leases
 where external_id = 'LSE-2019-001' limit 1;
```

If either query returns zero rows after a restore the procedure has
failed — abort and escalate to Supabase support before promoting.

## Drift detection

Add to the weekly security audit (GitHub Actions workflow
`security-audit.yml`):

```yaml
- name: PITR recency check
  run: |
    LAST_BACKUP=$(curl -s -H "apikey: $SUPABASE_SRV" \
      "$SUPABASE_URL/rest/v1/?select=last_pitr_at" \
      | jq -r '.last_pitr_at')
    AGE=$(( $(date +%s) - $(date -d "$LAST_BACKUP" +%s) ))
    [ "$AGE" -lt 3600 ] || { echo "PITR > 1 h stale"; exit 1; }
```

(Tracked in `docs/ROADMAP.md` — needs a custom Postgres function
exposing the PITR LSN since Supabase doesn't expose it via REST yet.)
