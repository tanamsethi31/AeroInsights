-- ─── portfolios table (ADR-002 Phase A) ──────────────────────────────────────
-- Establishes the canonical analytical scope. Tenants have many portfolios;
-- every analytical table will eventually carry portfolio_id NOT NULL (Phase B).
-- This migration only creates the table, links uploads, and backfills a
-- "Default Portfolio" per org so existing data stays addressable.
--
-- See docs/ADR-002-multi-portfolio-scoping.md for the full rationale.

create table if not exists portfolios (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  name         text not null,
  -- Distinguishes the customer's live book from sandbox / ABS / JV sub-pools.
  -- 'live'    — the production book (default for first portfolio per org).
  -- 'sandbox' — analyst what-if; not eligible for IFRS-9 disclosure pack.
  -- 'abs'     — securitisation sub-pool (CTC enhancements often differ).
  -- 'jv'      — joint-venture vehicle / SPV with shared ownership.
  kind         text not null default 'live'
               check (kind in ('live', 'sandbox', 'abs', 'jv')),
  created_at   timestamptz not null default now(),
  archived_at  timestamptz,
  -- A user-friendly slug to surface in URLs eventually. Unique per org.
  slug         text not null,
  unique (org_id, slug)
);

create index if not exists portfolios_org_id_idx on portfolios(org_id);

-- ─── extend uploads to carry portfolio_id ────────────────────────────────────
-- New column nullable for now so the backfill block below can populate it
-- before we enforce NOT NULL.

alter table uploads
  add column if not exists portfolio_id uuid references portfolios(id) on delete set null;

-- ─── backfill: one Default Portfolio per org that already has uploads ────────
-- Idempotent — safe to re-run.

insert into portfolios (org_id, name, kind, slug)
select distinct u.org_id, 'Default Portfolio', 'live', 'default'
  from uploads u
 where not exists (
   select 1 from portfolios p
    where p.org_id = u.org_id and p.slug = 'default'
 );

update uploads u
   set portfolio_id = p.id
  from portfolios p
 where p.org_id = u.org_id
   and p.slug = 'default'
   and u.portfolio_id is null;

-- ─── compound index for future Phase C hook rewrites ─────────────────────────
-- Every analytical query will eventually filter (org_id, portfolio_id); this
-- index is the right shape for that pattern on the uploads table.

create index if not exists uploads_org_portfolio_idx
  on uploads(org_id, portfolio_id);

-- ─── RLS — match the convention used elsewhere in this codebase ──────────────
-- Read-allow-any-authenticated for now; full per-row enforcement lands with T-4.1.

alter table portfolios enable row level security;

drop policy if exists portfolios_select on portfolios;
create policy portfolios_select on portfolios
  for select to authenticated using (true);

drop policy if exists portfolios_insert on portfolios;
create policy portfolios_insert on portfolios
  for insert to authenticated with check (true);

drop policy if exists portfolios_update on portfolios;
create policy portfolios_update on portfolios
  for update to authenticated using (true) with check (true);

-- No delete policy — portfolios are archived, not deleted (set archived_at).
