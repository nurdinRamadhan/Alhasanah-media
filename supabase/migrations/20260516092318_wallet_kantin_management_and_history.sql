-- Kantin management and transaction history foundation.

create or replace view public.view_kantin_transaction_history
with (security_invoker = true)
as
select
  td.id,
  td.public_id,
  td.created_at,
  td.posted_at,
  td.santri_nis,
  s.nama as santri_nama,
  s.kelas as santri_kelas,
  s.jurusan as santri_jurusan,
  td.direction,
  td.category,
  td.amount,
  td.balance_before,
  td.balance_after,
  td.status,
  td.actor_id as kantin_user_id,
  p.full_name as kantin_name,
  td.counterparty_id,
  td.counterparty_role,
  td.payment_intent_id,
  td.idempotency_key,
  td.entry_hash,
  td.keterangan,
  td.metadata,
  nullif(td.metadata->>'merchant_id', '')::uuid as merchant_id,
  nullif(td.metadata->>'outlet_id', '')::uuid as outlet_id,
  td.metadata->>'kantin_device_id' as kantin_device_id
from public.transaksi_dompet td
left join public.santri s on s.nis = td.santri_nis
left join public.profiles p on p.id = td.actor_id
where td.category = 'pembayaran_kantin';

grant select on public.view_kantin_transaction_history to authenticated;

create or replace function public.wallet_set_kantin_account_status(
  p_kantin_user_id uuid,
  p_is_active boolean,
  p_actor_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if p_kantin_user_id is null then
    raise exception 'kantin_user_id is required';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_kantin_user_id
  for update;

  if not found then
    raise exception 'Kantin account not found';
  end if;

  if v_profile.role <> 'kantin' then
    raise exception 'Target account is not role kantin';
  end if;

  update public.profiles
  set is_active = p_is_active
  where id = p_kantin_user_id
  returning * into v_profile;

  if not p_is_active then
    update public.kantin_devices
    set status = 'revoked',
        revoked_by = p_actor_id,
        revoked_at = now(),
        revoke_reason = coalesce(p_reason, 'Kantin account disabled')
    where kantin_user_id = p_kantin_user_id
      and status <> 'revoked';

    update public.wallet_merchant_users
    set status = 'revoked'
    where profile_id = p_kantin_user_id
      and status <> 'revoked';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    'admin',
    case when p_is_active then 'wallet_enable_kantin_account' else 'wallet_disable_kantin_account' end,
    'profiles',
    p_kantin_user_id::text,
    jsonb_build_object('reason', p_reason, 'is_active', p_is_active)
  );

  return jsonb_build_object(
    'id', v_profile.id,
    'role', v_profile.role,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'is_active', v_profile.is_active
  );
end;
$$;

revoke all on function public.wallet_set_kantin_account_status(uuid, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_set_kantin_account_status(uuid, boolean, uuid, text) to service_role;

create or replace function public.wallet_assign_kantin_merchant(
  p_kantin_user_id uuid,
  p_merchant_id uuid,
  p_outlet_id uuid default null,
  p_merchant_role text default 'cashier',
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.wallet_merchant_users%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_kantin_user_id and role = 'kantin' and coalesce(is_active, true)
  ) then
    raise exception 'Target user is not an active kantin profile';
  end if;

  if not exists (
    select 1 from public.wallet_merchants
    where id = p_merchant_id and status = 'active'
  ) then
    raise exception 'Merchant is not active';
  end if;

  if p_outlet_id is not null and not exists (
    select 1 from public.wallet_merchant_outlets
    where id = p_outlet_id and merchant_id = p_merchant_id and status = 'active'
  ) then
    raise exception 'Outlet is not active for this merchant';
  end if;

  if p_merchant_role not in ('owner','manager','cashier','auditor') then
    raise exception 'Invalid merchant role';
  end if;

  insert into public.wallet_merchant_users (
    merchant_id,
    profile_id,
    outlet_id,
    merchant_role,
    status
  ) values (
    p_merchant_id,
    p_kantin_user_id,
    p_outlet_id,
    p_merchant_role,
    'active'
  )
  on conflict do nothing;

  select * into v_assignment
  from public.wallet_merchant_users
  where merchant_id = p_merchant_id
    and profile_id = p_kantin_user_id
    and (outlet_id is not distinct from p_outlet_id)
  order by created_at desc
  limit 1;

  update public.wallet_merchant_users
  set status = 'active',
      merchant_role = p_merchant_role
  where id = v_assignment.id
  returning * into v_assignment;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    'admin',
    'wallet_assign_kantin_merchant',
    'wallet_merchant_users',
    v_assignment.id::text,
    jsonb_build_object(
      'kantin_user_id', p_kantin_user_id,
      'merchant_id', p_merchant_id,
      'outlet_id', p_outlet_id,
      'merchant_role', p_merchant_role
    )
  );

  return to_jsonb(v_assignment);
end;
$$;

revoke all on function public.wallet_assign_kantin_merchant(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.wallet_assign_kantin_merchant(uuid, uuid, uuid, text, uuid) to service_role;
