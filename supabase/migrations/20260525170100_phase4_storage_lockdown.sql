-- ─── Phase 4.1 — Storage bucket RLS lockdown ──────────────────────────────
--
-- Report exports live under `reports/{org_id}/{portfolio_id}/{ymd}/{file}`
-- (see useReportExports). The old policies granted any authenticated
-- session blanket read/write on the bucket. Now we require the first path
-- segment to match the caller's `org_id` JWT claim, mirroring the table
-- RLS pattern.
--
-- storage.foldername(name) splits the object name into an array; the
-- first element is the org_id segment. We cast both sides to text so the
-- comparison works without UUID coercion edge cases.

drop policy if exists "reports_authenticated_select" on storage.objects;
drop policy if exists "reports_authenticated_insert" on storage.objects;
drop policy if exists "reports_own_org_select"      on storage.objects;
drop policy if exists "reports_own_org_insert"      on storage.objects;

create policy "reports_own_org_select"
  on storage.objects for select to public
  using (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
  );

create policy "reports_own_org_insert"
  on storage.objects for insert to public
  with check (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
  );
