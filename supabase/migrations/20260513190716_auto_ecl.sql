-- Add auto_ecl flag to provisions.
-- When true (default), ECL is auto-calculated as PD × LGD × EAD (IFRS 9 stage-aware).
-- When false, the analyst has overridden ecl_amount manually.

alter table provisions
  add column if not exists auto_ecl boolean not null default true;
