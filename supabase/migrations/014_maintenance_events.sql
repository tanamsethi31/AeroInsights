-- supabase/migrations/014_maintenance_events.sql
-- One row per maintenance event (shop visit, AOG, etc.) per lease.
-- component_impacts JSONB array: [{ "component": "Engine PR", "cost_paid_usd": 5400000, "remaining_units_after": 18000 }]
-- remaining_units_after is null when the event does not reset the maintenance clock.

create table maintenance_events (
  id                uuid        primary key default gen_random_uuid(),
  org_id            uuid        not null references organisations(id) on delete cascade,
  lease_id          text        not null,
  event_date        date        not null,
  event_type        text        not null
                    check (event_type in ('shop_visit','aog','llp_replacement','supplemental_claim','note')),
  notes             text,
  component_impacts jsonb       not null default '[]',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index maintenance_events_org_lease_idx
  on maintenance_events(org_id, lease_id);
