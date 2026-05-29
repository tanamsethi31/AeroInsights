-- Returns the most recently-joined org_id for a given Auth0 user_id.
-- SECURITY DEFINER so it bypasses the org_members RLS SELECT policy (which
-- requires an existing jwt.org_id, impossible during initial resolution).
-- Safe because it ONLY returns the org_id; the caller still cannot read
-- anything else without a proper jwt.org_id claim — all other table RLS
-- policies remain in force.

create or replace function public.get_my_latest_org_id(p_user_id text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select m.org_id
  from org_members m
  join organisations o on o.id = m.org_id
  where m.user_id = p_user_id
  order by o.created_at desc
  limit 1;
$$;

grant execute on function public.get_my_latest_org_id(text) to anon, authenticated;
