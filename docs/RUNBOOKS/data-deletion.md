# Tenant data deletion runbook

Operator wrapper around the T-6.5 deletion endpoint. Use this when
fulfilling a GDPR Article 17 ("right to erasure") request OR an
end-of-contract offboarding.

## Self-service path (preferred)

The tenant's own org admin can complete the deletion themselves:

1. Sign in to https://aeroinsights.io as an admin user of the org.
2. Settings → Tenant → Danger Zone card.
3. Click **Delete organisation** → modal opens.
4. Type the org name exactly. Confirm.
5. The frontend POSTs to `/api/admin/delete-org`. On success the
   user is signed out (the org no longer exists).

The flow:

- **Storage purge:** every object under `reports/{org_id}/` removed.
- **Cascade DELETE** on `organisations` row → wipes every
  org_id-scoped table via FK `ON DELETE CASCADE`.
- **Audit row written** to `org_deletion_log` with row counts +
  storage purge count + actor email + timestamp. This table has no
  FK to organisations, so it survives.

## Operator path (Compliance / Support team)

For requests received via email or where the customer cannot access
the UI (e.g. all admins offboarded):

### Prerequisites

- Vercel function URL: `https://aeroinsights.io/api/admin/delete-org`.
- A valid Auth0 access token belonging to an admin of the target
  org. Generate via the Auth0 dashboard → "Test" tab on the
  Aeroinsights API → "Copy token".
- Supabase service-role access (for verification queries only).

### Steps

1. **Capture the request.** File a Linear ticket
   (label: `gdpr-erasure`). Include:
   - Org name + UUID
   - Requester email
   - Request received timestamp (UTC)
   - SLA deadline (Article 17 → 30 days)

2. **Verify org membership** — confirm the requester has standing
   (admin of the org OR data-protection-officer claim).

3. **Pre-flight check** — count rows that will disappear:
   ```sql
   select 'lessees' as t, count(*) from lessees     where org_id = '<uuid>'
   union all select 'leases',         count(*) from leases     where org_id = '<uuid>'
   union all select 'scenario_runs',  count(*) from scenario_runs where org_id = '<uuid>'
   union all select 'audit_log',      count(*) from audit_log  where org_id = '<uuid>'
   union all select 'report_exports', count(*) from report_exports where org_id = '<uuid>'
   ;
   ```
   Cross-check against the ticket — sanity check before running.

4. **Snapshot the org** (optional, contractual). Take a `pg_dump`
   filtered by `org_id` and store encrypted in the legal hold S3
   bucket. Required only when the contract retains data for N
   years after termination.

5. **Run the deletion**:
   ```bash
   curl -X POST https://aeroinsights.io/api/admin/delete-org \
     -H "Authorization: Bearer $AUTH0_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"org_id":"<uuid>","confirm_name":"<exact org name>"}'
   ```

   Expected 200 response:
   ```json
   {
     "ok": true,
     "org_id": "<uuid>",
     "storage_purge_count": 142,
     "rows_deleted": {
       "organisations": 1, "leases": 173, "lessees": 22, ...
     }
   }
   ```

6. **Verify**:
   ```sql
   -- Should all return 0
   select count(*) from leases where org_id = '<uuid>';
   select count(*) from organisations where id = '<uuid>';

   -- Should return 1
   select id, status, completed_at, rows_deleted
     from org_deletion_log where org_id = '<uuid>'
     order by completed_at desc limit 1;
   ```

7. **Storage spot check** — Supabase dashboard → Storage → `reports`
   bucket. Filter by `{org_id}/` prefix. Should be empty.

8. **Close the ticket.** Reply to the requester with the
   `org_deletion_log.id` as confirmation.

## Common failure modes

| Symptom | Cause | Resolution |
|---|---|---|
| `{"error":"not_admin"}` | Token belongs to non-admin | Get the right token or escalate to an org admin. |
| `{"error":"confirm_name_mismatch"}` | Body name doesn't match `organisations.name` | Query the canonical name from the DB and retry. |
| Storage purge count = 0 unexpectedly | No reports ever generated, OR previous purge already ran | Check `report_exports` count — if also 0 the tenant simply had no exports. |
| Partial failure — `status='failed'` row in `org_deletion_log` | Storage delete OK but DB cascade failed (network blip) | Re-run the curl; the DELETE is idempotent on a now-empty cascade. Compare row counts. |

## Compliance window

| Standard | Deadline |
|---|---|
| GDPR Article 17 | 30 days from receipt |
| CCPA | 45 days |
| Contractual (default) | 30 days |

Always close the ticket with a written confirmation citing the
`org_deletion_log.id` for the audit trail.
