create or replace function public.wallet_register_kantin_device(
  p_kantin_user_id uuid,
  p_device_id text,
  p_device_fingerprint text,
  p_public_key text,
  p_registered_by uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.kantin_devices%rowtype;
begin
  if p_kantin_user_id is null then
    raise exception 'kantin_user_id is required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_kantin_user_id and role = 'kantin' and coalesce(is_active, true)
  ) then
    raise exception 'Target user is not an active kantin profile';
  end if;

  if coalesce(length(trim(p_device_id)), 0) < 8 then
    raise exception 'device_id is too short';
  end if;

  if coalesce(length(trim(p_public_key)), 0) < 32 then
    raise exception 'public_key is invalid';
  end if;

  insert into public.kantin_devices (
    kantin_user_id,
    device_id,
    device_fingerprint,
    public_key,
    registered_by,
    metadata
  ) values (
    p_kantin_user_id,
    trim(p_device_id),
    trim(p_device_fingerprint),
    trim(p_public_key),
    p_registered_by,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (device_id) do update
  set device_fingerprint = excluded.device_fingerprint,
      public_key = excluded.public_key,
      status = case
        when public.kantin_devices.status in ('active', 'suspended', 'revoked') then public.kantin_devices.status
        else 'pending'
      end,
      registered_by = excluded.registered_by,
      registered_at = case
        when public.kantin_devices.status = 'active' then public.kantin_devices.registered_at
        else now()
      end,
      metadata = public.kantin_devices.metadata || excluded.metadata
  returning * into v_device;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_registered_by,
    'kantin',
    'wallet_register_kantin_device',
    'kantin_devices',
    v_device.id::text,
    jsonb_build_object('kantin_user_id', p_kantin_user_id, 'device_id', p_device_id, 'status', v_device.status)
  );

  return to_jsonb(v_device);
end;
$$;

revoke all on function public.wallet_register_kantin_device(uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.wallet_register_kantin_device(uuid, text, text, text, uuid, jsonb) to service_role;
