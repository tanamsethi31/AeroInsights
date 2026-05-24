-- ─── Security Deposits + Maintenance Reserves ingestion (T-1.4) ────────────
-- Also fixes the leases-table portfolio scoping that was pending from T-1.3
-- (the SD/MR tables FK to leases, so leases must be portfolio-scoped first).
--
-- This migration:
--   1. Adds portfolio_id NOT NULL to `leases` (ADR-002 Phase B continued).
--   2. Adds external_id + jurisdiction to `leases` for re-import + analytics.
--   3. Creates `security_deposits` — one row per lease.
--   4. Creates `maintenance_reserves` — one row per (lease, component) pair.
--   5. Indexes everything for the (org_id, portfolio_id) access pattern.

-- ── 1. leases: portfolio_id + external_id + jurisdiction ────────────────────

alter table leases
  add column if not exists portfolio_id uuid references portfolios(id) on delete cascade;

insert into portfolios (org_id, name, kind, slug)
select distinct l.org_id, 'Default Portfolio', 'live', 'default'
  from leases l
 where not exists (
   select 1 from portfolios p
    where p.org_id = l.org_id and p.slug = 'default'
 );

update leases l
   set portfolio_id = p.id
  from portfolios p
 where p.org_id = l.org_id
   and p.slug = 'default'
   and l.portfolio_id is null;

alter table leases alter column portfolio_id set not null;

alter table leases
  -- External identifier from the source Excel (e.g. "LS-01"). Drives T-1.10
  -- re-import and the SD/MR FK lookup below.
  add column if not exists external_id text,
  -- Jurisdiction (text, no enum — Excel uses "India (IBC)" formatting).
  add column if not exists jurisdiction text,
  -- Status text from the Excel ("Active" / "Terminated" / "Default"). Distinct
  -- from stage; a Stage 3 lease may still be Active during workout.
  add column if not exists status text;

create index if not exists leases_org_portfolio_idx
  on leases(org_id, portfolio_id);

create index if not exists leases_org_portfolio_external_idx
  on leases(org_id, portfolio_id, external_id)
  where external_id is not null;

create unique index if not exists leases_org_portfolio_external_unique
  on leases(org_id, portfolio_id, external_id)
  where external_id is not null;

-- ── 2. security_deposits ─────────────────────────────────────────────────────
-- One row per lease. Mirrors the Excel "A. SECURITY DEPOSITS" section.

create table if not exists security_deposits (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  portfolio_id    uuid not null references portfolios(id)    on delete cascade,
  lease_id        uuid not null references leases(id)        on delete cascade,
  -- Months of rent covered by the deposit (often 0, 1, 3, or 6).
  deposit_months  numeric(5,2)
                  check (deposit_months is null or deposit_months >= 0),
  -- Deposit absolute amount in USD. Independent of monthly_rent × deposit_months
  -- because Excel often stores a rounded contractual figure.
  deposit_amount_usd numeric
                  check (deposit_amount_usd is null or deposit_amount_usd >= 0),
  -- Instrument type. Free-text — Excel uses "Cash", "LC", "Standby LC",
  -- "Bank Guarantee", "—" (waived). Constraining with an enum would block
  -- tenants with custom taxonomies.
  type            text,
  -- Credit tier label from Excel (e.g. "Investment Grade", "Sub-IG",
  -- "Distressed"). Drives the Counterparties tier badge.
  credit_tier     text,
  notes           text,
  source_upload_id uuid references uploads(id) on delete set null,
  updated_at      timestamptz not null default now(),
  -- A lease can only have one active SD row per portfolio. Re-imports
  -- overwrite via this unique constraint.
  unique (org_id, portfolio_id, lease_id)
);

create index if not exists security_deposits_org_portfolio_idx
  on security_deposits(org_id, portfolio_id);

alter table security_deposits enable row level security;

drop policy if exists security_deposits_select on security_deposits;
create policy security_deposits_select on security_deposits
  for select to authenticated using (true);
drop policy if exists security_deposits_insert on security_deposits;
create policy security_deposits_insert on security_deposits
  for insert to authenticated with check (true);
drop policy if exists security_deposits_update on security_deposits;
create policy security_deposits_update on security_deposits
  for update to authenticated using (true) with check (true);

-- ── 3. maintenance_reserves ──────────────────────────────────────────────────
-- One row per (lease, maintenance component). Lease can have multiple rows:
-- Airframe HSI / Engine PR / LLPs / APU.

create table if not exists maintenance_reserves (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  portfolio_id    uuid not null references portfolios(id)    on delete cascade,
  lease_id        uuid not null references leases(id)        on delete cascade,
  -- Maintenance component. Free-text — common values: "Airframe HSI",
  -- "Engine PR", "LLPs", "APU", "Landing Gear".
  component       text not null,
  -- Rate basis: "per FH" (flight hour) or "per Cy" (cycle).
  rate_basis      text check (rate_basis is null or rate_basis in ('per FH', 'per Cy', 'per Month')),
  rate_usd        numeric
                  check (rate_usd is null or rate_usd >= 0),
  est_annual_units numeric  -- FH or cycles per year, depending on rate_basis
                  check (est_annual_units is null or est_annual_units >= 0),
  annual_accrual_usd numeric
                  check (annual_accrual_usd is null or annual_accrual_usd >= 0),
  cumulative_balance_usd numeric
                  check (cumulative_balance_usd is null or cumulative_balance_usd >= 0),
  refundable      boolean,
  notes           text,
  source_upload_id uuid references uploads(id) on delete set null,
  updated_at      timestamptz not null default now(),
  -- A lease + component combo is unique within a portfolio.
  unique (org_id, portfolio_id, lease_id, component)
);

create index if not exists maintenance_reserves_org_portfolio_idx
  on maintenance_reserves(org_id, portfolio_id);

create index if not exists maintenance_reserves_lease_idx
  on maintenance_reserves(lease_id);

alter table maintenance_reserves enable row level security;

drop policy if exists maintenance_reserves_select on maintenance_reserves;
create policy maintenance_reserves_select on maintenance_reserves
  for select to authenticated using (true);
drop policy if exists maintenance_reserves_insert on maintenance_reserves;
create policy maintenance_reserves_insert on maintenance_reserves
  for insert to authenticated with check (true);
drop policy if exists maintenance_reserves_update on maintenance_reserves;
create policy maintenance_reserves_update on maintenance_reserves
  for update to authenticated using (true) with check (true);
