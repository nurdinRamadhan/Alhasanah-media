-- Complete notification foundation for Dompet Santri.

alter table public.notification_queue
  add column if not exists event_type text,
  add column if not exists priority text not null default 'normal',
  add column if not exists channel text not null default 'push',
  add column if not exists reference_id text,
  add column if not exists read_at timestamptz,
  add column if not exists scheduled_at timestamptz not null default now();

alter table public.notification_queue
  drop constraint if exists notification_queue_priority_check,
  add constraint notification_queue_priority_check
    check (priority in ('low','normal','high','critical'));

alter table public.notification_queue
  drop constraint if exists notification_queue_channel_check,
  add constraint notification_queue_channel_check
    check (channel in ('in_app','push','email','sms','telegram'));

create index if not exists idx_notification_queue_user_created
  on public.notification_queue (user_id, created_at desc);
create index if not exists idx_notification_queue_status_scheduled
  on public.notification_queue (status, scheduled_at, created_at);
create index if not exists idx_notification_queue_event_type
  on public.notification_queue (event_type, created_at desc);

create or replace function public.wallet_enqueue_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_event_type text,
  p_source text default 'wallet',
  p_data jsonb default '{}'::jsonb,
  p_priority text default 'normal',
  p_reference_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;

  if coalesce(length(trim(p_title)), 0) = 0 or coalesce(length(trim(p_body)), 0) = 0 then
    raise exception 'Notification title/body is required';
  end if;

  insert into public.notification_queue (
    user_id,
    title,
    body,
    data,
    source_table,
    event_type,
    priority,
    reference_id
  ) values (
    p_user_id,
    left(trim(p_title), 120),
    left(trim(p_body), 500),
    coalesce(p_data, '{}'::jsonb) || jsonb_build_object('event_type', p_event_type),
    p_source,
    p_event_type,
    coalesce(p_priority, 'normal'),
    p_reference_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.wallet_enqueue_notification(uuid, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.wallet_enqueue_notification(uuid, text, text, text, text, jsonb, text, text) to service_role;

create or replace function public.wallet_notify_roles(
  p_roles text[],
  p_title text,
  p_body text,
  p_event_type text,
  p_source text default 'wallet',
  p_data jsonb default '{}'::jsonb,
  p_priority text default 'normal',
  p_reference_id text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint := 0;
begin
  insert into public.notification_queue (
    user_id,
    title,
    body,
    data,
    source_table,
    event_type,
    priority,
    reference_id
  )
  select
    p.id,
    left(trim(p_title), 120),
    left(trim(p_body), 500),
    coalesce(p_data, '{}'::jsonb) || jsonb_build_object('event_type', p_event_type, 'target_role', p.role),
    p_source,
    p_event_type,
    coalesce(p_priority, 'normal'),
    p_reference_id
  from public.profiles p
  where p.role = any(p_roles)
    and coalesce(p.is_active, true);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.wallet_notify_roles(text[], text, text, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.wallet_notify_roles(text[], text, text, text, text, jsonb, text, text) to service_role;

create or replace function public.wallet_notify_wali(
  p_santri_nis text,
  p_title text,
  p_body text,
  p_event_type text,
  p_source text default 'wallet',
  p_data jsonb default '{}'::jsonb,
  p_priority text default 'normal',
  p_reference_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wali_id uuid;
begin
  select wali_id into v_wali_id
  from public.santri
  where nis = p_santri_nis;

  return public.wallet_enqueue_notification(
    v_wali_id,
    p_title,
    p_body,
    p_event_type,
    p_source,
    coalesce(p_data, '{}'::jsonb) || jsonb_build_object('santri_nis', p_santri_nis),
    p_priority,
    p_reference_id
  );
end;
$$;

revoke all on function public.wallet_notify_wali(text, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.wallet_notify_wali(text, text, text, text, text, jsonb, text, text) to service_role;

create or replace function public.tr_wallet_notify_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_santri_name text;
  v_low_threshold bigint;
  v_large_threshold bigint;
  v_kantin_name text;
begin
  select s.nama, d.low_balance_threshold, d.large_transaction_threshold
  into v_santri_name, v_low_threshold, v_large_threshold
  from public.dompet_santri d
  left join public.santri s on s.nis = d.santri_nis
  where d.santri_nis = new.santri_nis;

  if new.category = 'pembayaran_kantin' then
    select full_name into v_kantin_name from public.profiles where id = new.actor_id;

    perform public.wallet_notify_wali(
      new.santri_nis,
      'Transaksi kantin berhasil',
      coalesce(v_santri_name, new.santri_nis) || ' bertransaksi ' || to_char(new.amount, 'FM999G999G999') || ' di kantin.',
      'wallet.kantin.payment_posted',
      'transaksi_dompet',
      jsonb_build_object(
        'ledger_id', new.id,
        'amount', new.amount,
        'balance_after', new.balance_after,
        'kantin_user_id', new.actor_id,
        'kantin_name', v_kantin_name
      ),
      case when v_large_threshold is not null and new.amount >= v_large_threshold then 'high' else 'normal' end,
      new.id::text
    );

    perform public.wallet_enqueue_notification(
      new.actor_id,
      'Pembayaran diterima',
      'Pembayaran ' || to_char(new.amount, 'FM999G999G999') || ' dari ' || coalesce(v_santri_name, new.santri_nis) || ' berhasil.',
      'wallet.kantin.payment_posted',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'amount', new.amount),
      'normal',
      new.id::text
    );
  elsif new.category = 'topup' then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Top up dompet berhasil',
      'Saldo ' || coalesce(v_santri_name, new.santri_nis) || ' bertambah ' || to_char(new.amount, 'FM999G999G999') || '.',
      'wallet.topup.posted',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'amount', new.amount, 'balance_after', new.balance_after),
      'normal',
      new.id::text
    );
  elsif new.category in ('correction','refund','account_migration_in','account_migration_out','settlement_to_pesantren_ledger') then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Koreksi dompet santri',
      'Ada koreksi dompet ' || coalesce(v_santri_name, new.santri_nis) || ' sebesar ' || to_char(new.amount, 'FM999G999G999') || '.',
      'wallet.adjustment.posted',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'category', new.category, 'direction', new.direction, 'amount', new.amount, 'balance_after', new.balance_after),
      'high',
      new.id::text
    );

    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Koreksi ledger dompet',
      'Koreksi ' || new.category::text || ' untuk NIS ' || new.santri_nis || ' sebesar ' || to_char(new.amount, 'FM999G999G999') || '.',
      'wallet.adjustment.posted',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'category', new.category, 'direction', new.direction),
      'high',
      new.id::text
    );
  end if;

  if v_low_threshold is not null and new.balance_after <= v_low_threshold then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Saldo dompet hampir habis',
      'Saldo ' || coalesce(v_santri_name, new.santri_nis) || ' tersisa ' || to_char(new.balance_after, 'FM999G999G999') || '.',
      'wallet.balance.low',
      'dompet_santri',
      jsonb_build_object('ledger_id', new.id, 'balance_after', new.balance_after, 'threshold', v_low_threshold),
      'high',
      new.id::text
    );
  end if;

  if v_large_threshold is not null and new.amount >= v_large_threshold then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Transaksi besar dompet santri',
      'Transaksi ' || new.category::text || ' NIS ' || new.santri_nis || ' sebesar ' || to_char(new.amount, 'FM999G999G999') || '.',
      'wallet.transaction.large',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'amount', new.amount, 'threshold', v_large_threshold),
      'high',
      new.id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists tr_wallet_notify_transaction on public.transaksi_dompet;
create trigger tr_wallet_notify_transaction
after insert on public.transaksi_dompet
for each row
execute function public.tr_wallet_notify_transaction();

revoke execute on function public.tr_wallet_notify_transaction() from authenticated, anon, public;

create or replace function public.tr_wallet_notify_risk_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.severity in ('high','critical') then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Risk event dompet: ' || new.rule_code,
      'Severity ' || new.severity || ' pada dompet santri ' || coalesce(new.santri_nis, '-') || '.',
      'wallet.risk.' || lower(new.rule_code),
      'wallet_risk_events',
      jsonb_build_object('risk_event_id', new.id, 'santri_nis', new.santri_nis, 'device_id', new.device_id, 'score', new.score, 'action', new.action),
      case when new.severity = 'critical' then 'critical' else 'high' end,
      new.id::text
    );

    if new.santri_nis is not null then
      perform public.wallet_notify_wali(
        new.santri_nis,
        'Aktivitas dompet perlu perhatian',
        'Sistem mendeteksi aktivitas tidak biasa pada dompet santri.',
        'wallet.risk.parent_alert',
        'wallet_risk_events',
        jsonb_build_object('risk_event_id', new.id, 'rule_code', new.rule_code, 'severity', new.severity),
        'high',
        new.id::text
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_wallet_notify_risk_event on public.wallet_risk_events;
create trigger tr_wallet_notify_risk_event
after insert on public.wallet_risk_events
for each row
execute function public.tr_wallet_notify_risk_event();

revoke execute on function public.tr_wallet_notify_risk_event() from authenticated, anon, public;

create or replace function public.tr_wallet_notify_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.finished_at is not null
     and (old.finished_at is null or old.status is distinct from new.status)
     and new.status in ('failed','settlement_mismatch') then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      case when new.status = 'failed' then 'Rekonsiliasi dompet gagal' else 'Settlement dompet tidak cocok' end,
      'Ledger net ' || new.ledger_net || ', cached balance ' || new.cached_balance_total || ', selisih internal ' || new.difference_internal || '.',
      'wallet.reconciliation.' || new.status,
      'wallet_reconciliation_runs',
      jsonb_build_object('run_id', new.id, 'status', new.status, 'difference_internal', new.difference_internal, 'difference_bank', new.difference_bank),
      case when new.status = 'failed' then 'critical' else 'high' end,
      new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_wallet_notify_reconciliation on public.wallet_reconciliation_runs;
create trigger tr_wallet_notify_reconciliation
after update on public.wallet_reconciliation_runs
for each row
execute function public.tr_wallet_notify_reconciliation();

revoke execute on function public.tr_wallet_notify_reconciliation() from authenticated, anon, public;

create or replace function public.tr_wallet_notify_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.finished_at is not null
     and (old.finished_at is null or old.status is distinct from new.status)
     and new.status = 'failed' then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Hash-chain ledger dompet rusak',
      'Integrity check gagal pada ledger ' || coalesce(new.broken_at::text, '-') || '. Transaksi dompet harus diinvestigasi.',
      'wallet.integrity.failed',
      'wallet_ledger_integrity_runs',
      jsonb_build_object('run_id', new.id, 'broken_at', new.broken_at, 'santri_nis', new.santri_nis),
      'critical',
      new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_wallet_notify_integrity on public.wallet_ledger_integrity_runs;
create trigger tr_wallet_notify_integrity
after update on public.wallet_ledger_integrity_runs
for each row
execute function public.tr_wallet_notify_integrity();

revoke execute on function public.tr_wallet_notify_integrity() from authenticated, anon, public;

create or replace function public.tr_wallet_notify_dispute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Dispute transaksi dompet',
      'Wali membuka dispute untuk NIS ' || new.santri_nis || '.',
      'wallet.dispute.opened',
      'wallet_disputes',
      jsonb_build_object('dispute_id', new.id, 'ledger_id', new.ledger_id, 'santri_nis', new.santri_nis),
      'high',
      new.id::text
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.resolved_at is not null then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Dispute dompet selesai',
      'Laporan transaksi dompet sudah diproses dengan status ' || new.status || '.',
      'wallet.dispute.resolved',
      'wallet_disputes',
      jsonb_build_object('dispute_id', new.id, 'status', new.status, 'reversal_ledger_id', new.reversal_ledger_id),
      'normal',
      new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_wallet_notify_dispute_insert on public.wallet_disputes;
create trigger tr_wallet_notify_dispute_insert
after insert on public.wallet_disputes
for each row
execute function public.tr_wallet_notify_dispute();

drop trigger if exists tr_wallet_notify_dispute_update on public.wallet_disputes;
create trigger tr_wallet_notify_dispute_update
after update on public.wallet_disputes
for each row
execute function public.tr_wallet_notify_dispute();

revoke execute on function public.tr_wallet_notify_dispute() from authenticated, anon, public;

create or replace function public.tr_wallet_notify_kantin_device()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Device kantin menunggu approval',
      'Device baru untuk akun kantin perlu direview.',
      'wallet.kantin_device.pending',
      'kantin_devices',
      jsonb_build_object('device_record_id', new.id, 'kantin_user_id', new.kantin_user_id, 'device_id', new.device_id),
      'high',
      new.id::text
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform public.wallet_enqueue_notification(
      new.kantin_user_id,
      'Status device kantin berubah',
      'Device kantin ' || new.device_id || ' sekarang ' || new.status || '.',
      'wallet.kantin_device.' || new.status,
      'kantin_devices',
      jsonb_build_object('device_record_id', new.id, 'device_id', new.device_id, 'status', new.status),
      case when new.status in ('revoked','suspended') then 'high' else 'normal' end,
      new.id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists tr_wallet_notify_kantin_device_insert on public.kantin_devices;
create trigger tr_wallet_notify_kantin_device_insert
after insert on public.kantin_devices
for each row
execute function public.tr_wallet_notify_kantin_device();

drop trigger if exists tr_wallet_notify_kantin_device_update on public.kantin_devices;
create trigger tr_wallet_notify_kantin_device_update
after update on public.kantin_devices
for each row
execute function public.tr_wallet_notify_kantin_device();

revoke execute on function public.tr_wallet_notify_kantin_device() from authenticated, anon, public;

create or replace function public.tr_wallet_notify_freeze()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_frozen is distinct from new.is_frozen then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      case when new.is_frozen then 'Transaksi dompet dibekukan' else 'Transaksi dompet dibuka kembali' end,
      coalesce(new.freeze_reason, 'Perubahan freeze switch dompet santri.'),
      case when new.is_frozen then 'wallet.system.frozen' else 'wallet.system.unfrozen' end,
      'wallet_system_controls',
      jsonb_build_object('key', new.key, 'is_frozen', new.is_frozen, 'reason', new.freeze_reason),
      case when new.is_frozen then 'critical' else 'normal' end,
      new.key
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_wallet_notify_freeze on public.wallet_system_controls;
create trigger tr_wallet_notify_freeze
after update on public.wallet_system_controls
for each row
execute function public.tr_wallet_notify_freeze();

revoke execute on function public.tr_wallet_notify_freeze() from authenticated, anon, public;
