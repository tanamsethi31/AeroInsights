-- supabase/migrations/009_bank_statements.sql
-- Bank reconciliation data: statements and transactions

create table if not exists bank_statements (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  filename     text not null,
  currency     text not null default 'USD',
  period_label text not null,
  row_count    int  not null default 0,
  uploaded_at  timestamptz not null default now()
);

create index if not exists bank_statements_org_idx
  on bank_statements(org_id, uploaded_at desc);

create table if not exists bank_transactions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  statement_id uuid not null references bank_statements(id) on delete cascade,
  value_date   date not null,
  description  text not null,
  amount       numeric not null,  -- signed: positive = credit, negative = debit
  currency     text not null default 'USD',
  reference    text,
  created_at   timestamptz not null default now()
);

create index if not exists bank_transactions_org_idx
  on bank_transactions(org_id, value_date desc);
create index if not exists bank_transactions_statement_idx
  on bank_transactions(statement_id);
