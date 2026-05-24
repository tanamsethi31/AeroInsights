-- ─── Aircraft Register full ingestion (T-1.3) ──────────────────────────────
-- Extends `assets` to capture every column from the sample portfolio Excel's
-- "Aircraft Register" sheet, plus continues ADR-002 Phase B by adding
-- portfolio_id NOT NULL with a backfill.
--
-- New columns: external_id (Excel "AC ID" for re-import matching), family,
-- country, stage (1/2/3), current_mv_usd, part_out_usd.
--
-- Existing columns (registration, msn, aircraft_type, manufacturer, vintage,
-- current_operator) stay — the multi-sheet parser maps the Excel fields onto
-- both old and new columns in a single insert.

-- ── 1. portfolio_id (ADR-002 Phase B continued) ──────────────────────────────

alter table assets
  add column if not exists portfolio_id uuid references portfolios(id) on delete cascade;

-- Backfill — every existing asset row gets the org's Default Portfolio. The
-- 20260524120000 migration already created Default Portfolios for orgs with
-- uploads; T-1.2 added them for orgs with lessees; for any remaining orgs
-- (assets without uploads or lessees — unusual but possible in test data) we
-- create the Default Portfolio here.

insert into portfolios (org_id, name, kind, slug)
select distinct a.org_id, 'Default Portfolio', 'live', 'default'
  from assets a
 where not exists (
   select 1 from portfolios p
    where p.org_id = a.org_id and p.slug = 'default'
 );

update assets a
   set portfolio_id = p.id
  from portfolios p
 where p.org_id = a.org_id
   and p.slug = 'default'
   and a.portfolio_id is null;

alter table assets alter column portfolio_id set not null;

-- ── 2. Aircraft Register columns (T-1.3) ─────────────────────────────────────

alter table assets
  -- External identifier from the source Excel (e.g. "AC-001"). Drives
  -- T-1.10 re-import / merge.
  add column if not exists external_id text,

  -- Family (Narrowbody / Widebody / Regional). Free-text — no enum yet so a
  -- tenant uploading a different family taxonomy doesn't trip a CHECK.
  add column if not exists family text,

  -- Country of operation (ICAO state). Drives jurisdiction overlays.
  add column if not exists country text,

  -- Asset-level IFRS-9 stage (worst of any lease on this aircraft). Lets
  -- Fleet tab + concentration analytics query stage directly without joining
  -- to provisions.
  add column if not exists stage int
    check (stage is null or stage in (1, 2, 3)),

  -- Current Market Value in USD. Stored in absolute dollars (the parser
  -- expands Excel "$M" units before writing). Drives the Fleet → Valuation
  -- panel + portfolio book value KPI.
  add column if not exists current_mv_usd numeric
    check (current_mv_usd is null or current_mv_usd >= 0),

  -- Part-out (teardown) value in USD. Floor recovery if the aircraft cannot
  -- be re-leased. Drives the IAS-36 impairment recoverable-amount logic.
  add column if not exists part_out_usd numeric
    check (part_out_usd is null or part_out_usd >= 0);

-- ── 3. Indexes for the new access patterns ───────────────────────────────────

create index if not exists assets_org_portfolio_idx
  on assets(org_id, portfolio_id);

-- Reconciliation lookup on re-import (T-1.10) — prefers external_id, falls
-- back to MSN.
create index if not exists assets_org_portfolio_external_idx
  on assets(org_id, portfolio_id, external_id)
  where external_id is not null;

create index if not exists assets_org_portfolio_msn_idx
  on assets(org_id, portfolio_id, msn);

-- ── 4. Uniqueness for re-import reconciliation ───────────────────────────────
-- A given external_id is unique within an (org, portfolio); same for MSN
-- when external_id is null. The two partial unique indexes co-exist because
-- they cover disjoint row sets (external_id NULL vs NOT NULL).

create unique index if not exists assets_org_portfolio_external_unique
  on assets(org_id, portfolio_id, external_id)
  where external_id is not null;

create unique index if not exists assets_org_portfolio_msn_unique
  on assets(org_id, portfolio_id, msn)
  where external_id is null;
