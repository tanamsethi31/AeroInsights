-- ─── ECL period snapshots: portfolio scoping + duplicate guard (T-3.2) ─────
-- ADR-002: every analytical table is scoped by (org_id, portfolio_id).
-- Period locking must therefore be unique within a portfolio, not just
-- within an org — different portfolios can lock the same Q2 2026 label
-- without colliding.
--
-- Adds:
--   • portfolio_id NOT NULL FK to portfolios(id), ON DELETE CASCADE
--   • unique (org_id, portfolio_id, period_label) — can't lock the same
--     period twice for one portfolio
--   • index (org_id, portfolio_id, locked_at desc) for the history panel
--
-- We don't backfill existing rows. The table is currently empty in dev;
-- in any environment where rows exist, the migration will fail loudly on
-- the NOT NULL clause and an operator backfill is required.

alter table ecl_period_snapshots
  add column if not exists portfolio_id uuid references portfolios(id) on delete cascade;

-- Promote to NOT NULL. Will fail if any row is missing a portfolio_id.
alter table ecl_period_snapshots
  alter column portfolio_id set not null;

-- Drop the original org-only history index — new compound covers both
-- the per-portfolio history panel and the per-org admin views.
drop index if exists ecl_period_snapshots_org_idx;

create index if not exists ecl_period_snapshots_org_portfolio_idx
  on ecl_period_snapshots(org_id, portfolio_id, locked_at desc);

-- Duplicate-period guard at the DB layer. Modal already shows a friendly
-- error before insert; this is the last-line defence.
alter table ecl_period_snapshots
  drop constraint if exists ecl_period_snapshots_unique_label;
alter table ecl_period_snapshots
  add constraint ecl_period_snapshots_unique_label
  unique (org_id, portfolio_id, period_label);
