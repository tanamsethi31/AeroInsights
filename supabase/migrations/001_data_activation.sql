-- ─── organisations ───────────────────────────────────────────────────────────
create table if not exists organisations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  plan         text not null default 'starter', -- starter | growth | enterprise
  base_currency text not null default 'EUR',
  created_at   timestamptz not null default now()
);

-- ─── org_members ─────────────────────────────────────────────────────────────
create table if not exists org_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id) on delete cascade,
  user_id    text not null,          -- Auth0 sub
  role       text not null default 'analyst', -- admin | analyst
  created_at timestamptz not null default now(),
  unique(org_id, user_id)
);
create index if not exists org_members_user_id_idx on org_members(user_id);

-- ─── uploads ─────────────────────────────────────────────────────────────────
create table if not exists uploads (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  filename     text not null,
  status       text not null default 'pending', -- pending | processing | complete | error
  column_map   jsonb,
  row_count    int,
  error_detail text,
  created_at   timestamptz not null default now()
);
create index if not exists uploads_org_id_idx on uploads(org_id);

-- ─── assets ──────────────────────────────────────────────────────────────────
create table if not exists assets (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  upload_id        uuid references uploads(id) on delete set null,
  registration     text not null,
  msn              text not null,
  aircraft_type    text not null,
  manufacturer     text,
  vintage          int,
  current_operator text,
  created_at       timestamptz not null default now()
);
create index if not exists assets_org_id_idx on assets(org_id);

-- ─── lessees ─────────────────────────────────────────────────────────────────
create table if not exists lessees (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  name             text not null,
  iata_code        text,
  country          text,
  credit_rating    text,
  pd_estimate      numeric,
  watchlist_status text, -- green | amber | red
  created_at       timestamptz not null default now()
);
create index if not exists lessees_org_id_idx on lessees(org_id);

-- ─── leases ──────────────────────────────────────────────────────────────────
create table if not exists leases (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id) on delete cascade,
  asset_id       uuid not null references assets(id) on delete cascade,
  lessee_id      uuid not null references lessees(id) on delete cascade,
  start_date     date not null,
  end_date       date not null,
  monthly_rental numeric,
  currency       text not null default 'EUR',
  stage          int,   -- 1 | 2 | 3
  created_at     timestamptz not null default now()
);
create index if not exists leases_org_id_idx on leases(org_id);

-- ─── provisions ──────────────────────────────────────────────────────────────
create table if not exists provisions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  asset_id        uuid not null references assets(id) on delete cascade,
  stage           int,
  ecl_amount      numeric,
  pd              numeric,
  lgd             numeric,
  ead             numeric,
  reporting_date  date,
  created_at      timestamptz not null default now()
);
create index if not exists provisions_org_id_idx on provisions(org_id);

-- ─── Phase 2: market_data (schema defined now, populated later) ───────────────
create table if not exists market_data (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  asset_id         uuid references assets(id) on delete set null,
  source           text not null,  -- cirium | oag | manual
  cmv              numeric,
  half_life_value  numeric,
  utilisation_rate numeric,
  fetched_at       timestamptz not null default now()
);

-- ─── Phase 2: lessee_financials (schema defined now, populated later) ─────────
create table if not exists lessee_financials (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  lessee_id    uuid references lessees(id) on delete set null,
  source       text not null,  -- bloomberg | oag | manual
  revenue      numeric,
  ebitda       numeric,
  debt_equity  numeric,
  load_factor  numeric,
  rpk          numeric,
  period_end   date,
  fetched_at   timestamptz not null default now()
);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
-- NOTE: RLS is disabled for Phase 1 demo. org_id filtering happens in the
-- application layer (DataContext + hook). Enable and tighten these policies
-- before production launch.

alter table organisations    disable row level security;
alter table org_members      disable row level security;
alter table uploads          disable row level security;
alter table assets           disable row level security;
alter table lessees          disable row level security;
alter table leases           disable row level security;
alter table provisions       disable row level security;
alter table market_data      disable row level security;
alter table lessee_financials disable row level security;
