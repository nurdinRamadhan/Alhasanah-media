create or replace function public.wallet_notify_merchant_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merchant_name text;
  v_outlet_name text;
  v_title text;
  v_body text;
  v_event_type text;
  v_priority text := 'high';
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status not in ('requested', 'approved', 'paid', 'rejected') then
    return new;
  end if;

  select name into v_merchant_name
  from public.wallet_merchants
  where id = new.merchant_id;

  select name into v_outlet_name
  from public.wallet_merchant_outlets
  where id = new.outlet_id;

  v_merchant_name := coalesce(v_merchant_name, 'Kantin');
  v_outlet_name := coalesce(v_outlet_name, 'Outlet');

  if new.status = 'requested' then
    v_event_type := 'wallet.merchant_settlement.requested';
    v_title := 'Pengajuan pencairan kantin';
    v_body := v_merchant_name || ' mengajukan pencairan Rp ' || to_char(new.amount, 'FM999G999G999G999') || '.';
  elsif new.status = 'approved' then
    v_event_type := 'wallet.merchant_settlement.approved';
    v_title := 'Pencairan kantin disetujui';
    v_body := 'Pengajuan pencairan ' || v_merchant_name || ' Rp ' || to_char(new.amount, 'FM999G999G999G999') || ' disetujui untuk dibayar.';
  elsif new.status = 'paid' then
    v_event_type := 'wallet.merchant_settlement.paid';
    v_title := 'Pencairan kantin dibayar';
    v_body := 'Pencairan ' || v_merchant_name || ' Rp ' || to_char(new.amount, 'FM999G999G999G999') || ' sudah ditandai dibayar.';
  else
    v_event_type := 'wallet.merchant_settlement.rejected';
    v_title := 'Pencairan kantin ditolak';
    v_body := 'Pengajuan pencairan ' || v_merchant_name || ' Rp ' || to_char(new.amount, 'FM999G999G999G999') || ' ditolak dan saldo pending dikembalikan.';
  end if;

  insert into public.notification_queue (
    user_id, title, body, source_table, event_type, priority, channel, reference_id, data
  )
  select distinct
    recipient.user_id,
    v_title,
    v_body,
    'wallet_merchant_settlement_requests',
    v_event_type,
    v_priority,
    'push',
    new.id::text,
    jsonb_build_object(
      'settlement_request_id', new.id,
      'merchant_id', new.merchant_id,
      'merchant_name', v_merchant_name,
      'outlet_id', new.outlet_id,
      'outlet_name', v_outlet_name,
      'amount', new.amount,
      'status', new.status,
      'deeplink', 'alhasanah://wallet/kantin/settlement/' || new.id::text
    )
  from (
    select new.requested_by as user_id
    union
    select p.id
    from public.profiles p
    where coalesce(p.is_active, true)
      and p.role in ('super_admin', 'bendahara', 'rois')
  ) recipient
  where recipient.user_id is not null;

  return new;
end;
$$;

drop trigger if exists tr_wallet_notify_merchant_settlement on public.wallet_merchant_settlement_requests;
create trigger tr_wallet_notify_merchant_settlement
after insert or update of status
on public.wallet_merchant_settlement_requests
for each row
execute function public.wallet_notify_merchant_settlement();

