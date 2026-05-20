-- Avoid leaking FCM tokens into REST query-string logs during logout/switch
-- account. Android must call this RPC instead of PATCH user_devices with
-- fcm_token in the URL.

create or replace function public.deactivate_my_fcm_device(
  p_fcm_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Login wajib aktif untuk menonaktifkan FCM token';
  end if;

  if p_fcm_token is null or length(trim(p_fcm_token)) < 20 then
    return jsonb_build_object('status', 'ignored', 'updated', 0);
  end if;

  update public.user_devices
  set is_active = false,
      last_seen = now(),
      last_seen_at = now()
  where user_id = v_user_id
    and fcm_token = p_fcm_token
    and is_active = true;

  get diagnostics v_count = row_count;

  return jsonb_build_object('status', 'deactivated', 'updated', v_count);
end;
$$;

revoke all on function public.deactivate_my_fcm_device(text) from public, anon;
grant execute on function public.deactivate_my_fcm_device(text) to authenticated, service_role;
