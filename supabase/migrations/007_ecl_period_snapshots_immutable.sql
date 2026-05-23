-- supabase/migrations/007_ecl_period_snapshots_immutable.sql
-- Enforce append-only immutability on ecl_period_snapshots at the database level.
-- UPDATE and DELETE are denied via BEFORE triggers so the constraint holds for
-- every role regardless of RLS state (which is disabled project-wide for Phase 1).

create or replace function ecl_period_snapshots_immutable()
  returns trigger
  language plpgsql
as $$
begin
  raise exception
    'ecl_period_snapshots is append-only: % on row % is not permitted',
    tg_op, old.id
    using errcode = 'restrict_violation';
end;
$$;

create trigger ecl_period_snapshots_no_update
  before update on ecl_period_snapshots
  for each row execute function ecl_period_snapshots_immutable();

create trigger ecl_period_snapshots_no_delete
  before delete on ecl_period_snapshots
  for each row execute function ecl_period_snapshots_immutable();
