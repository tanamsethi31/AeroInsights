-- aviation pd curves: add carrier segment to lessees and create pd_curve_overrides table
-- migration: 003_aviation_pd_curves

-- add carrier segment to lessees
alter table lessees
  add column if not exists carrier_segment text
  check (carrier_segment in ('network', 'lcc', 'regional', 'charter'));

-- firm-level curve overrides (one row per org per segment)
create table if not exists pd_curve_overrides (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  segment         text not null
                  check (segment in ('network', 'lcc', 'regional', 'charter')),
  pd1yr           numeric(8,6) not null check (pd1yr > 0 and pd1yr < 1),
  pd2yr           numeric(8,6) not null check (pd2yr > 0 and pd2yr < 1),
  pd3yr           numeric(8,6) not null check (pd3yr > 0 and pd3yr < 1),
  pd5yr           numeric(8,6) not null check (pd5yr > 0 and pd5yr < 1),
  pd_lifetime     numeric(8,6) not null check (pd_lifetime > 0 and pd_lifetime < 1),
  notes           text,
  updated_by      text,
  updated_at      timestamptz not null default now(),
  unique (org_id, segment)
);

create index if not exists pd_curve_overrides_org_id_idx
  on pd_curve_overrides(org_id);
