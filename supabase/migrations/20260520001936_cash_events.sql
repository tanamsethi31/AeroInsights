-- supabase/migrations/011_cash_events.sql
create table if not exists cash_events (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  lease_id        uuid references leases(id) on delete set null,
  event_type      text not null,
  amount          numeric not null,
  currency        text not null default 'USD',
  event_date      date not null,
  is_forecast     boolean not null default false,
  source          text not null,   -- 'manual' | 'recon'
  transaction_id  uuid references bank_transactions(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists cash_events_org_idx   on cash_events(org_id);
create index if not exists cash_events_lease_idx on cash_events(lease_id);
create index if not exists cash_events_date_idx  on cash_events(event_date);
create index if not exists cash_events_txn_idx   on cash_events(transaction_id);
