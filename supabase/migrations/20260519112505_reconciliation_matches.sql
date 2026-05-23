-- supabase/migrations/010_reconciliation_matches.sql
create table if not exists reconciliation_matches (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id) on delete cascade,
  statement_id   uuid not null references bank_statements(id) on delete cascade,
  transaction_id uuid not null references bank_transactions(id) on delete cascade,
  lease_id       uuid references leases(id) on delete set null,  -- null = unmatched
  match_type     text not null,   -- 'auto' | 'manual' | 'unmatched'
  confidence     numeric,         -- 0–1; null when match_type = 'unmatched'
  amount_delta   numeric,         -- txn.amount − lease.monthly_rental; null if unmatched or null rental
  confirmed      boolean not null default false,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (transaction_id)         -- one match record per transaction
);

create index if not exists recon_matches_statement_idx on reconciliation_matches(statement_id);
create index if not exists recon_matches_org_idx       on reconciliation_matches(org_id);
