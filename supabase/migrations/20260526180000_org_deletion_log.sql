-- ─── Tenant offboarding log (T-6.5) ───────────────────────────────────────
-- Records every org deletion that runs through /api/admin/delete-org.
-- Survives the organisations row it documents because it has NO foreign
-- key back to organisations — deletion would otherwise cascade itself
-- away. GDPR / contractual audit trail.
--
-- Reads are restricted to authenticated callers; service-role writes
-- the rows. UPDATE/DELETE blocked by DB trigger regardless of RLS.

create table if not exists org_deletion_log (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null,
  org_name             text not null,
  requested_by         text not null,
  requested_by_email   text,
  storage_purge_count  int not null default 0,
  rows_deleted         jsonb not null default '{}'::jsonb,
  requested_at         timestamptz not null default now(),
  completed_at         timestamptz,
  status               text not null default 'completed'
                       check (status in ('pending', 'completed', 'failed')),
  error_detail         text
);

create index if not exists org_deletion_log_requested_at_idx
  on org_deletion_log(requested_at desc);
create index if not exists org_deletion_log_org_id_idx
  on org_deletion_log(org_id);

alter table org_deletion_log enable row level security;
-- Authenticated callers can read their own (best-effort: the orgs are
-- gone so we just allow read; PII is the org_name + actor email).
drop policy if exists org_deletion_log_select on org_deletion_log;
create policy org_deletion_log_select on org_deletion_log
  for select to authenticated using (true);
-- INSERT only via service-role (no policy granted to public).

create or replace function org_deletion_log_immutable()
  returns trigger
  language plpgsql
as $$
begin
  raise exception 'org_deletion_log is append-only: % on % not permitted',
    tg_op, old.id using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists org_deletion_log_no_update on org_deletion_log;
create trigger org_deletion_log_no_update
  before update on org_deletion_log
  for each row execute function org_deletion_log_immutable();
drop trigger if exists org_deletion_log_no_delete on org_deletion_log;
create trigger org_deletion_log_no_delete
  before delete on org_deletion_log
  for each row execute function org_deletion_log_immutable();

comment on table org_deletion_log is
  'Append-only audit trail of tenant offboarding events. T-6.5.';
