-- Fix admin alumni verification RPC after private-schema hardening.
-- The public RPC must be callable by authenticated admin users, but the actual
-- authorization check remains inside app_private.update_alumni_admin_profile.

create or replace function public.update_alumni_admin_profile(
  p_alumni_id uuid,
  p_full_name text default null,
  p_is_active boolean default null
)
returns public.profiles
language sql
security definer
set search_path = ''
as $$
  select app_private.update_alumni_admin_profile(p_alumni_id, p_full_name, p_is_active);
$$;

revoke all on function public.update_alumni_admin_profile(uuid, text, boolean) from public, anon;
grant execute on function public.update_alumni_admin_profile(uuid, text, boolean) to authenticated, service_role;
