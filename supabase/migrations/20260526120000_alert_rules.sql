-- ─── Email alerts (T-5.1) ───────────────────────────────────────────────────
-- Configurable per-org alert rules + an immutable log of every send.
-- A Vercel cron (/api/cron/alerts) re-evaluates the rules every 30 min,
-- de-duplicates within the rule's cooldown window, and writes alert_sends.
--
-- rule.kind taxonomy:
--   • 'dpd_breach'       — any lessee with dpd_days >= threshold.days
--   • 'stage_downgrade'  — any new stage_migrations row with direction='up'
--   • 'watchlist_red'    — any lessee with watchlist_status='red'
--   • 'sanctions_hit'    — any lessee in a sanctioned jurisdiction
--
-- threshold is JSONB so each kind can carry its own shape without schema
-- drift; e.g. dpd_breach uses { "days": 30 }, stage_downgrade uses
-- { "from": 1, "to": 2 } (optional — null means "any upward").

create table if not exists alert_rules (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  portfolio_id      uuid references portfolios(id) on delete cascade,

  name              text not null,
  kind              text not null
                    check (kind in ('dpd_breach', 'stage_downgrade',
                                    'watchlist_red', 'sanctions_hit')),

  threshold         jsonb not null default '{}'::jsonb,
  recipients        text[] not null default array[]::text[],
  enabled           boolean not null default true,

  -- Minimum minutes between two sends for the same rule + entity. Stops
  -- the 30-min cron from spamming when a condition persists.
  cooldown_minutes  int not null default 1440  -- 24 h
                    check (cooldown_minutes >= 0),

  created_at        timestamptz not null default now(),
  created_by        text not null default 'unknown',
  updated_at        timestamptz not null default now()
);

create index if not exists alert_rules_org_idx
  on alert_rules(org_id, enabled, kind);

alter table alert_rules enable row level security;
drop policy if exists alert_rules_select on alert_rules;
drop policy if exists alert_rules_insert on alert_rules;
drop policy if exists alert_rules_update on alert_rules;
drop policy if exists alert_rules_delete on alert_rules;
create policy alert_rules_select on alert_rules
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy alert_rules_insert on alert_rules
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy alert_rules_update on alert_rules
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                       with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy alert_rules_delete on alert_rules
  for delete to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));

-- ── alert_sends — immutable log ──────────────────────────────────────────

create table if not exists alert_sends (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  rule_id       uuid not null references alert_rules(id) on delete cascade,

  -- Which entity tripped the rule (lessee uuid, lease external_id, …).
  -- Free-form text so different rule kinds can attach different ids.
  entity_id     text,
  entity_label  text,   -- display name for the email body

  recipient     text not null,
  status        text not null check (status in ('sent', 'failed', 'skipped_cooldown')),

  payload       jsonb,                          -- evaluator output, for audit
  error_detail  text,
  sent_at       timestamptz not null default now()
);

create index if not exists alert_sends_org_idx
  on alert_sends(org_id, sent_at desc);
create index if not exists alert_sends_rule_idx
  on alert_sends(rule_id, entity_id, sent_at desc);

alter table alert_sends enable row level security;
drop policy if exists alert_sends_select on alert_sends;
drop policy if exists alert_sends_insert on alert_sends;
create policy alert_sends_select on alert_sends
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy alert_sends_insert on alert_sends
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));

create or replace function alert_sends_immutable()
  returns trigger
  language plpgsql
as $$
begin
  raise exception 'alert_sends is append-only: % on row % not permitted',
    tg_op, old.id using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists alert_sends_no_update on alert_sends;
create trigger alert_sends_no_update before update on alert_sends
  for each row execute function alert_sends_immutable();
drop trigger if exists alert_sends_no_delete on alert_sends;
create trigger alert_sends_no_delete before delete on alert_sends
  for each row execute function alert_sends_immutable();

comment on table alert_rules is
  'Per-org alert rule config. Evaluated every 30 min by /api/cron/alerts.';
comment on table alert_sends is
  'Append-only log of every alert email dispatched. T-5.1.';
