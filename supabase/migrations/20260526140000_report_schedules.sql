-- ─── Scheduled reports (T-5.2) ────────────────────────────────────────────
-- Persistent schedules that the Vercel cron (/api/cron/scheduled-reports)
-- evaluates hourly. When `next_run_at <= now()` and `enabled` is true the
-- cron:
--   1. Generates the report (CSV portfolio snapshot for v1).
--   2. Uploads to Supabase Storage `reports` bucket.
--   3. Emails recipients with a signed download URL via Resend.
--   4. Inserts a row in report_exports + audit_log "export" event.
--   5. Advances next_run_at by `frequency` and sets last_run_at = now().
--
-- frequency taxonomy: 'daily' | 'weekly' | 'monthly'. The cron computes
-- the next_run_at increment client-side rather than via Postgres so the
-- math stays in one place.

create table if not exists report_schedules (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  portfolio_id    uuid references portfolios(id) on delete cascade,

  report_id       text not null,                 -- 'portfolio-snapshot' for v1
  name            text not null,
  format          text not null
                  check (format in ('csv', 'pdf', 'docx', 'xlsx')),
  frequency       text not null
                  check (frequency in ('daily', 'weekly', 'monthly')),

  recipients      text[] not null default array[]::text[],

  enabled         boolean not null default true,
  next_run_at     timestamptz not null,
  last_run_at     timestamptz,
  last_status     text,                          -- 'sent' | 'failed' | null
  last_error      text,

  created_at      timestamptz not null default now(),
  created_by      text not null default 'unknown',
  updated_at      timestamptz not null default now()
);

create index if not exists report_schedules_due_idx
  on report_schedules(enabled, next_run_at)
  where enabled = true;

create index if not exists report_schedules_org_idx
  on report_schedules(org_id, enabled);

alter table report_schedules enable row level security;
drop policy if exists report_schedules_select on report_schedules;
drop policy if exists report_schedules_insert on report_schedules;
drop policy if exists report_schedules_update on report_schedules;
drop policy if exists report_schedules_delete on report_schedules;
create policy report_schedules_select on report_schedules
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy report_schedules_insert on report_schedules
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy report_schedules_update on report_schedules
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy report_schedules_delete on report_schedules
  for delete to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));

comment on table report_schedules is
  'Recurring report schedules. Evaluated hourly by /api/cron/scheduled-reports.';
