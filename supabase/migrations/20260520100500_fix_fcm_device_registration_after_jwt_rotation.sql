create or replace function public.register_user_fcm_device(
  p_user_id uuid,
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
  v_row public.user_devices%rowtype;
  v_device_type text := coalesce(nullif(trim(p_platform), ''), 'android');
begin
  if p_user_id is null then
    raise exception 'user_id wajib diisi';
  end if;

  if p_fcm_token is null or length(trim(p_fcm_token)) < 20 then
    raise exception 'fcm_token tidak valid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_fcm_token, 0));

  update public.user_devices
  set is_active = false,
      last_seen = now(),
      last_seen_at = now()
  where fcm_token = p_fcm_token
    and user_id <> p_user_id
    and is_active = true;

  select * into v_row
  from public.user_devices
  where user_id = p_user_id
    and fcm_token = p_fcm_token
  order by last_seen_at desc nulls last, last_seen desc nulls last, id desc
  limit 1
  for update;

  if found then
    update public.user_devices
    set is_active = true,
        device_id = coalesce(p_device_id, device_id),
        platform = v_device_type,
        device_type = v_device_type,
        app_instance_id = coalesce(p_app_instance_id, app_instance_id),
        last_seen = now(),
        last_seen_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.user_devices (
      user_id,
      fcm_token,
      device_type,
      device_id,
      platform,
      app_instance_id,
      is_active,
      last_seen,
      last_seen_at
    ) values (
      p_user_id,
      p_fcm_token,
      v_device_type,
      p_device_id,
      v_device_type,
      p_app_instance_id,
      true,
      now(),
      now()
    )
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'status', 'registered',
    'id', v_row.id,
    'user_id', v_row.user_id,
    'is_active', v_row.is_active
  );
end;
$$;

grant execute on function public.register_user_fcm_device(uuid, text, text, text, text) to authenticated;
grant execute on function public.register_my_fcm_device(text, text, text, text) to authenticated;
