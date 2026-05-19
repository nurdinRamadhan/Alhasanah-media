-- Force merchant settlement requests through the Edge Function boundary.
-- The Edge Function authenticates the kantin JWT, then calls this service-only
-- function with the resolved actor id. Direct authenticated RPC access is
-- revoked to reduce the exposed SECURITY DEFINER surface.

create or replace function public.wallet_request_merchant_settlement_for_actor(
  p_actor_id uuid,
  p_merchant_id uuid,
  p_outlet_id uuid,
  p_amount bigint,
  p_destination_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.wallet_merchant_settlement_requests%rowtype;
  v_ledger jsonb;
begin
  if p_actor_id is null then raise exception 'Sesi login tidak valid'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal pencairan tidak valid'; end if;

  if not exists (
    select 1
    from public.profiles p
    join public.wallet_merchant_users wmu on wmu.profile_id = p.id
    where p.id = p_actor_id
      and p.role = 'kantin'
      and coalesce(p.is_active, true)
      and wmu.merchant_id = p_merchant_id
      and (wmu.outlet_id is null or wmu.outlet_id is not distinct from p_outlet_id)
      and wmu.status = 'active'
      and wmu.merchant_role in ('owner','manager','cashier')
  ) then
    raise exception 'Akun kantin tidak berwenang mengajukan pencairan';
  end if;

  insert into public.wallet_merchant_settlement_requests (
    merchant_id, outlet_id, requested_by, amount, destination_note
  ) values (
    p_merchant_id, p_outlet_id, p_actor_id, p_amount, nullif(trim(coalesce(p_destination_note, '')), '')
  ) returning * into v_request;

  v_ledger := public.wallet_post_merchant_ledger(
    p_merchant_id,
    p_outlet_id,
    'debit',
    'settlement_request',
    p_amount,
    'merchant-settlement-request:' || v_request.id::text,
    p_actor_id,
    'kantin',
    null,
    null,
    v_request.id,
    'Pengajuan pencairan saldo kantin',
    jsonb_build_object('destination_note_present', p_destination_note is not null)
  );

  update public.wallet_merchant_settlement_requests
  set requested_ledger_id = (v_ledger->>'ledger_id')::bigint,
      updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return to_jsonb(v_request) || jsonb_build_object('ledger', v_ledger);
end;
$$;

revoke all on function public.wallet_request_merchant_settlement_for_actor(uuid, uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.wallet_request_merchant_settlement_for_actor(uuid, uuid, uuid, bigint, text) to service_role;

revoke all on function public.wallet_request_merchant_settlement(uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.wallet_request_merchant_settlement(uuid, uuid, bigint, text) to service_role;
