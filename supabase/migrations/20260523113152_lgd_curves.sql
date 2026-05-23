-- supabase/migrations/004_lgd_curves.sql
-- lgd decay curves: firm-level recovery factor overrides (one row per org)

create table if not exists lgd_recovery_overrides (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  recovery_factor numeric(5,4) not null check (recovery_factor > 0.10 and recovery_factor < 0.95),
  notes           text,
  updated_by      text,
  updated_at      timestamptz not null default now(),
  unique (org_id)
);

create index if not exists lgd_recovery_overrides_org_id_idx
  on lgd_recovery_overrides(org_id);
