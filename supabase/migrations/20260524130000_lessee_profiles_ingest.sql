-- ─── Lessee Profiles ingestion (T-1.2) + ADR-002 Phase B begins ──────────────
-- Extends `lessees` to carry every column from the sample portfolio Excel's
-- "Lessee Profiles" sheet, plus a portfolio_id scope (ADR-002 Phase B — every
-- analytical table inherits portfolio_id starting here).
--
-- The Phase 1 multi-sheet parser (src/app/utils/excelParser.ts) writes to
-- these columns; the Counterparties → Lessee Profile panel reads from them.
-- This is the migration that begins the death of the hardcoded LESSEE_PROFILE
-- fixture in src/app/data/intelligenceData.ts (T-2.4 in the roadmap).

-- ── 1. portfolio_id with backfill (ADR-002 Phase B) ──────────────────────────

alter table lessees
  add column if not exists portfolio_id uuid references portfolios(id) on delete cascade;

-- Backfill every existing lessee row to its org's Default Portfolio.
-- The portfolios table migration (20260524120000) already created a Default
-- Portfolio per org that had uploads. For orgs that have lessees but no
-- uploads yet (e.g. seeded test data) we create the Default Portfolio here.

insert into portfolios (org_id, name, kind, slug)
select distinct l.org_id, 'Default Portfolio', 'live', 'default'
  from lessees l
 where not exists (
   select 1 from portfolios p
    where p.org_id = l.org_id and p.slug = 'default'
 );

update lessees l
   set portfolio_id = p.id
  from portfolios p
 where p.org_id = l.org_id
   and p.slug = 'default'
   and l.portfolio_id is null;

-- Enforce NOT NULL going forward — every new lessee row must specify a portfolio.
alter table lessees alter column portfolio_id set not null;

-- ── 2. Lessee Profiles columns (T-1.2) ───────────────────────────────────────

alter table lessees
  -- External identifier from the source Excel (e.g. "LE-001"). Used by
  -- T-1.10 re-import / merge to reconcile updates with prior data without
  -- relying on name fuzzy matching.
  add column if not exists external_id text,

  -- Region (e.g. "South Asia", "Europe", "MENA"). Used by the Counterparties
  -- profile panel and concentration analytics. Free-text — no enum yet.
  add column if not exists region text,

  -- IFRS-9 stage at the lessee level (a lessee may have leases in multiple
  -- stages; this is the "worst" or "primary" stage used in the counterparty
  -- snapshot). Same 1/2/3 convention as leases.stage.
  add column if not exists stage int
    check (stage is null or stage in (1, 2, 3)),

  -- Days past due — drives the SICR DPD trigger (PRD §8.4).
  add column if not exists dpd_days int
    check (dpd_days is null or dpd_days >= 0),

  -- Rating notches down vs lease inception. ≥ 2 trips SICR rating trigger.
  add column if not exists rating_notches_down int
    check (rating_notches_down is null or rating_notches_down >= 0),

  -- Boolean SICR triggers (sample Excel encodes Yes/No; we store as bool).
  add column if not exists country_watchlist boolean,
  add column if not exists insolvency_filed boolean,

  -- Behaviour scoring (0–100 each). Drives the Counterparties radar chart.
  add column if not exists score_punctuality          int
    check (score_punctuality is null or score_punctuality between 0 and 100),
  add column if not exists score_restructuring_coop   int
    check (score_restructuring_coop is null or score_restructuring_coop between 0 and 100),
  add column if not exists score_govt_interference    int
    check (score_govt_interference is null or score_govt_interference between 0 and 100),
  add column if not exists score_litigation           int
    check (score_litigation is null or score_litigation between 0 and 100),
  add column if not exists overall_behaviour_score    int
    check (overall_behaviour_score is null or overall_behaviour_score between 0 and 100),

  -- Pay-behaviour tier classification (Cooperative / Neutral / Adversarial,
  -- per the existing scenarios engine. Free-text to allow future tier
  -- additions without a migration).
  add column if not exists pay_behaviour_tier text;

-- ── 3. Indexes for the new access patterns ───────────────────────────────────

-- Compound (org_id, portfolio_id) for every analytical query under ADR-002.
create index if not exists lessees_org_portfolio_idx
  on lessees(org_id, portfolio_id);

-- Allows T-1.10 reconciliation to find prior rows by external_id quickly.
create index if not exists lessees_org_portfolio_external_idx
  on lessees(org_id, portfolio_id, external_id)
  where external_id is not null;

-- ── 4. Uniqueness for re-import reconciliation ───────────────────────────────
-- A given external_id can only appear once per (org_id, portfolio_id).
-- Allows T-1.10's upsert pattern: ON CONFLICT (org_id, portfolio_id, external_id)
-- DO UPDATE SET ...

create unique index if not exists lessees_org_portfolio_external_unique
  on lessees(org_id, portfolio_id, external_id)
  where external_id is not null;
