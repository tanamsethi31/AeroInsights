-- assumption audit trail: append-only log of PD and LGD assumption changes
-- migration: 005_assumption_change_log

create table if not exists assumption_change_log (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  assumption_type  text not null
                   check (assumption_type in ('pd_curve', 'lgd_recovery')),
  segment          text
                   check (segment in ('network', 'lcc', 'regional', 'charter')),
  action           text not null
                   check (action in ('override', 'reset')),
  previous_value   jsonb,
  new_value        jsonb,
  notes            text,
  changed_by       text not null default 'unknown',
  changed_at       timestamptz not null default now()
);

create index if not exists assumption_change_log_org_id_idx
  on assumption_change_log(org_id, changed_at desc);
