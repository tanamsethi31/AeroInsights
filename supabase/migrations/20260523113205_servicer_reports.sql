-- supabase/migrations/013_servicer_reports.sql
-- One row per (org_id, lease_id). Upserted from useServicerReport hook.
-- lease_id is TEXT (matches SDMR text identifiers like "LSE-2019-001").
-- component_overrides: {"Engine PR": 4200, "LLPs": 8500} — remaining units per component.

create table if not exists servicer_reports (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null references organisations(id) on delete cascade,
  lease_id            text        not null,
  msn                 text        not null,
  report_date         date        not null,
  annual_fh           integer     not null,
  annual_cy           integer     not null,
  component_overrides jsonb       not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- One active record per lease per org — upsert target
create unique index if not exists servicer_reports_org_lease_uidx
  on servicer_reports(org_id, lease_id);

create index if not exists servicer_reports_org_idx
  on servicer_reports(org_id);
