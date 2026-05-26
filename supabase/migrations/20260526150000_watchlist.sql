-- ─── Watchlist rule engine (T-5.3) ────────────────────────────────────────
-- Replaces the static WATCHLIST_DATA constant in the frontend. A Vercel
-- cron (/api/cron/watchlist) re-evaluates per-lessee scores every 30 min
-- and writes the current classification to watchlist_entries. Status
-- transitions are audited via audit_log (no separate history table — we
-- already have a universal one).
--
-- Tables:
--   watchlist_config   — per (org, portfolio) signal weights + thresholds
--   watchlist_entries  — current state, one row per (org, portfolio, lessee)
--
-- Both fully RLS-scoped via org_id JWT claim (Phase 4.1 pattern).

-- ── watchlist_config ─────────────────────────────────────────────────────

create table if not exists watchlist_config (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  portfolio_id      uuid references portfolios(id) on delete cascade,

  weights           jsonb not null default '{
    "paymentLateness": 35,
    "scheduleQoQ":     20,
    "ratingChange":    20,
    "ctcWatchlist":    15,
    "newsKeywordHits": 10
  }'::jsonb,
  thresholds        jsonb not null default '{"red": 60, "amber": 30}'::jsonb,

  updated_at        timestamptz not null default now(),
  unique (org_id, portfolio_id)
);

alter table watchlist_config enable row level security;
drop policy if exists watchlist_config_select on watchlist_config;
drop policy if exists watchlist_config_insert on watchlist_config;
drop policy if exists watchlist_config_update on watchlist_config;
create policy watchlist_config_select on watchlist_config
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy watchlist_config_insert on watchlist_config
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy watchlist_config_update on watchlist_config
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- ── watchlist_entries ────────────────────────────────────────────────────

create table if not exists watchlist_entries (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  portfolio_id    uuid not null references portfolios(id)    on delete cascade,
  lessee_id       uuid not null references lessees(id)       on delete cascade,

  status          text not null check (status in ('green', 'amber', 'red')),
  score           numeric(6, 2) not null check (score >= 0 and score <= 100),

  signals         jsonb not null default '{}'::jsonb,    -- per-signal breakdown
  triggered_by    text,                                  -- "Payment Lateness", etc.
  reason          text,

  evaluated_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (org_id, portfolio_id, lessee_id)
);

create index if not exists watchlist_entries_org_portfolio_idx
  on watchlist_entries(org_id, portfolio_id, status);
create index if not exists watchlist_entries_lessee_idx
  on watchlist_entries(lessee_id);

alter table watchlist_entries enable row level security;
drop policy if exists watchlist_entries_select on watchlist_entries;
drop policy if exists watchlist_entries_insert on watchlist_entries;
drop policy if exists watchlist_entries_update on watchlist_entries;
create policy watchlist_entries_select on watchlist_entries
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy watchlist_entries_insert on watchlist_entries
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy watchlist_entries_update on watchlist_entries
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

comment on table watchlist_config  is
  'Per-org watchlist weights + thresholds. T-5.3.';
comment on table watchlist_entries is
  'Current per-lessee watchlist state. Maintained by /api/cron/watchlist.';
