-- Authenticated RPC for Android to bind the current FCM token to the currently
-- logged-in user only. This prevents a device that previously logged in as a
-- wali from continuing to receive wali notifications after switching account.

create or replace function public.register_my_fcm_device(
  p_fcm_token text,
  p_device_id text default null,
  p_platform text default 'android',
  p_app_instance_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Login wajib aktif untuk mendaftarkan FCM token';
  end if;

  return public.register_user_fcm_device(
    v_user_id,
    p_fcm_token,
    p_device_id,
    p_platform,
    p_app_instance_id
  );
end;
$$;

revoke all on function public.register_my_fcm_device(text, text, text, text) from public, anon;
grant execute on function public.register_my_fcm_device(text, text, text, text) to authenticated;
