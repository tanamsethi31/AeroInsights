-- ─── Report exports persistence (T-3.3) ───────────────────────────────────
-- Every generated report (PDF/XLSX/DOCX) writes one row + uploads the file
-- to the `reports` Supabase Storage bucket. Export History tab reads from
-- here so users can re-download any past report without re-running it.
--
-- Append-only. The file_url points at the storage object — when a row is
-- inserted but the upload failed, file_url is null and the UI labels it
-- "upload failed".

create table if not exists report_exports (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  portfolio_id    uuid references portfolios(id) on delete cascade,

  report_id       text not null,             -- 'RPT-001', 'auditor-pack', etc.
  report_name     text not null,
  format          text not null check (format in ('pdf', 'docx', 'xlsx')),

  -- Parameters that produced the report (currency, scenario weights snapshot,
  -- period label, etc). Lets us reproduce or compare future runs.
  params          jsonb not null default '{}'::jsonb,

  -- Storage path within the `reports` bucket. Null if upload failed; the
  -- row still lands so the audit trail shows the attempt.
  storage_path    text,
  file_size_bytes int,

  generated_at    timestamptz not null default now(),
  generated_by    text not null default 'unknown'
);

create index if not exists report_exports_org_portfolio_idx
  on report_exports(org_id, portfolio_id, generated_at desc);

create index if not exists report_exports_org_idx
  on report_exports(org_id, generated_at desc);

alter table report_exports enable row level security;
drop policy if exists report_exports_select on report_exports;
create policy report_exports_select on report_exports for select to authenticated using (true);
drop policy if exists report_exports_insert on report_exports;
create policy report_exports_insert on report_exports for insert to authenticated with check (true);
-- Append-only: no update/delete policy.

-- ─── Storage bucket ────────────────────────────────────────────────────────
-- Private bucket. Reads go through signed URLs minted by the client at
-- download time. Existing buckets are left alone (on conflict do nothing).

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- RLS policy on storage.objects so authenticated users can read/write to
-- the reports bucket. (Org-level scoping is enforced by the row in
-- report_exports + signed URL knowledge of the path.)
drop policy if exists "reports_authenticated_select" on storage.objects;
create policy "reports_authenticated_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'reports');

drop policy if exists "reports_authenticated_insert" on storage.objects;
create policy "reports_authenticated_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'reports');

comment on table report_exports is
  'Persistent log of every report export with Storage file. T-3.3.';
