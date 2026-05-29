-- Atomically creates a new organisation + the first org_members row for
-- the caller. SECURITY DEFINER so it bypasses the RLS policies on both
-- tables (which require an existing jwt.org_id — impossible during
-- first-time onboarding).
--
-- Safety: the function never attaches a user to an existing org. It
-- creates a brand new organisation each call. Anyone calling it gets a
-- private workspace; they cannot read or join any other org because the
-- RLS policies on every other table still gate by `auth.jwt() ->> 'org_id'`.

create or replace function public.create_organisation_with_member(
  p_name          text,
  p_base_currency text,
  p_user_id       text,
  p_role          text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'organisation name is required';
  end if;
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    raise exception 'user_id is required';
  end if;
  if p_role not in ('admin','analyst') then
    raise exception 'role must be admin or analyst';
  end if;

  insert into organisations (name, plan, base_currency)
    values (trim(p_name), 'starter', coalesce(nullif(trim(p_base_currency), ''), 'EUR'))
    returning id into v_org_id;

  insert into org_members (org_id, user_id, role)
    values (v_org_id, trim(p_user_id), p_role);

  return v_org_id;
end;
$$;

grant execute on function public.create_organisation_with_member(text, text, text, text)
  to anon, authenticated;
