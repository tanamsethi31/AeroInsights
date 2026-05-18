-- supabase/migrations/008_abs_deals.sql
-- ABS deal configuration: one row per deal per org

create table if not exists abs_deals (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  deal_name        text not null,
  closing_date     date not null,
  currency         text not null default 'USD',
  note_classes     jsonb not null,
  reserve_accounts jsonb not null,
  coverage_tests   jsonb not null,
  senior_expenses  jsonb not null,
  aircraft_ids     jsonb not null default '[]',
  created_at       timestamptz not null default now()
);

create index if not exists abs_deals_org_idx
  on abs_deals(org_id, created_at desc);
