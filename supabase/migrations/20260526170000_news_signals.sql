-- ─── News signals (polish) ────────────────────────────────────────────────
-- Per-lessee aggregated news risk score, refreshed hourly by
-- /api/cron/news-signals. Replaces the insolvency_filed proxy in the
-- watchlist evaluator. score is 0–100 (higher = more risk).
--
-- articles JSONB stores the matched-article metadata (headline, source,
-- url, sentiment) so the lessee panel can drill down to evidence.

create table if not exists news_signals (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  lessee_id       uuid not null references lessees(id)       on delete cascade,
  score           numeric(6, 2) not null default 0 check (score >= 0 and score <= 100),
  keyword_hits    int not null default 0 check (keyword_hits >= 0),
  articles        jsonb not null default '[]'::jsonb,
  evaluated_at    timestamptz not null default now(),
  unique (org_id, lessee_id)
);

create index if not exists news_signals_org_idx on news_signals(org_id, evaluated_at desc);

alter table news_signals enable row level security;
drop policy if exists news_signals_select on news_signals;
drop policy if exists news_signals_insert on news_signals;
drop policy if exists news_signals_update on news_signals;
create policy news_signals_select on news_signals
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy news_signals_insert on news_signals
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy news_signals_update on news_signals
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

comment on table news_signals is
  'Per-lessee news risk score. Maintained by /api/cron/news-signals.';
