-- ─── Currency engine — fx_rates (T-5.4) ───────────────────────────────────
-- Daily FX rates pulled from ECB (or another source) by
-- /api/cron/fx-refresh. The hardcoded `CURRENCIES.rate` table in the
-- frontend remains as a same-day fallback; ingested rows override it.
--
-- Rates are stored as "1 base = rate × quote" — e.g. (USD, EUR, 0.92)
-- means 1 USD = 0.92 EUR on that date. Source captured so we can audit
-- which feed produced which row.

create table if not exists fx_rates (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  base        text not null,
  quote       text not null,
  rate        numeric(20, 10) not null check (rate > 0),
  source      text not null default 'ecb',
  fetched_at  timestamptz not null default now(),
  unique (date, base, quote)
);

create index if not exists fx_rates_date_idx on fx_rates(date desc);
create index if not exists fx_rates_base_quote_idx on fx_rates(base, quote, date desc);

-- FX rates are intrinsically public (not tenant-scoped). Everyone reads
-- the same EUR/USD curve. Writes restricted to service-role via PostgREST
-- (no insert policy granted to public).
alter table fx_rates enable row level security;
drop policy if exists fx_rates_select on fx_rates;
create policy fx_rates_select on fx_rates for select to public using (true);

comment on table fx_rates is
  'Daily FX rates. T-5.4. Maintained by /api/cron/fx-refresh.';
