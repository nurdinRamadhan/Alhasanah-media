-- Refinement of Dompet Santri notification events.

alter table public.dompet_santri
  add column if not exists low_balance_warning_threshold bigint not null default 30000,
  add column if not exists low_balance_critical_threshold bigint not null default 10000;

alter table public.dompet_santri
  drop constraint if exists dompet_santri_low_balance_warning_threshold_check,
  add constraint dompet_santri_low_balance_warning_threshold_check
    check (low_balance_warning_threshold >= 0);

alter table public.dompet_santri
  drop constraint if exists dompet_santri_low_balance_critical_threshold_check,
  add constraint dompet_santri_low_balance_critical_threshold_check
    check (low_balance_critical_threshold >= 0);

alter table public.wallet_risk_events
  add column if not exists response_due_at timestamptz,
  add column if not exists auto_action_at timestamptz,
  add column if not exists escalated_at timestamptz;

alter table public.wallet_disputes
  add column if not exists response_due_at timestamptz not null default (now() + interval '48 hours'),
  add column if not exists escalated_at timestamptz;

create table if not exists public.wallet_pin_attempts (
  id uuid primary key default gen_random_uuid(),
  santri_nis text not null references public.santri(nis),
  actor_id uuid references public.profiles(id),
  actor_role text,
  device_id text,
  attempt_status text not null default 'failed',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint wallet_pin_attempts_status_check
    check (attempt_status in ('failed','success','locked'))
);

create index if not exists idx_wallet_pin_attempts_santri_time
  on public.wallet_pin_attempts (santri_nis, created_at desc);

alter table public.wallet_pin_attempts enable row level security;

drop policy if exists "wallet_pin_attempts_auditor_read" on public.wallet_pin_attempts;
create policy "wallet_pin_attempts_auditor_read"
on public.wallet_pin_attempts
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin','bendahara','rois','dewan')
      and coalesce(p.is_active, true)
  )
);

grant select on public.wallet_pin_attempts to authenticated;

create table if not exists public.wallet_weekly_digest_runs (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  status text not null default 'running',
  generated_count bigint not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  constraint wallet_weekly_digest_runs_status_check
    check (status in ('running','success','failed'))
);

alter table public.wallet_weekly_digest_runs enable row level security;

drop policy if exists "wallet_weekly_digest_runs_auditor_read" on public.wallet_weekly_digest_runs;
create policy "wallet_weekly_digest_runs_auditor_read"
on public.wallet_weekly_digest_runs
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin','bendahara','rois','dewan')
      and coalesce(p.is_active, true)
  )
);

grant select on public.wallet_weekly_digest_runs to authenticated;

create or replace function public.wallet_notify_role(
  p_role text,
  p_title text,
  p_body text,
  p_event_type text,
  p_source text default 'wallet',
  p_data jsonb default '{}'::jsonb,
  p_priority text default 'normal',
  p_reference_id text default null
)
returns bigint
language sql
security definer
set search_path = public
as $$
  select public.wallet_notify_roles(array[p_role], p_title, p_body, p_event_type, p_source, p_data, p_priority, p_reference_id)
$$;

revoke all on function public.wallet_notify_role(text, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.wallet_notify_role(text, text, text, text, text, jsonb, text, text) to service_role;

create or replace function public.tr_wallet_notify_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_santri_name text;
  v_warning_threshold bigint;
  v_critical_threshold bigint;
  v_large_threshold bigint;
  v_kantin_name text;
  v_large_count_1h int;
  v_dispute_deeplink text;
begin
  select s.nama, d.low_balance_warning_threshold, d.low_balance_critical_threshold, d.large_transaction_threshold
  into v_santri_name, v_warning_threshold, v_critical_threshold, v_large_threshold
  from public.dompet_santri d
  left join public.santri s on s.nis = d.santri_nis
  where d.santri_nis = new.santri_nis;

  v_dispute_deeplink := 'alhasanah://wallet/dispute?ledger_id=' || new.id::text;

  if new.category = 'pembayaran_kantin' then
    select full_name into v_kantin_name from public.profiles where id = new.actor_id;

    perform public.wallet_notify_wali(
      new.santri_nis,
      'Transaksi kantin berhasil',
      coalesce(v_santri_name, new.santri_nis) || ' beli di Kantin ' || coalesce(v_kantin_name, '-') || ', Rp ' ||
      to_char(new.amount, 'FM999G999G999') || ', sisa saldo Rp ' || to_char(new.balance_after, 'FM999G999G999') ||
      '. Bukan kamu? Laporkan segera.',
      'wallet.kantin.payment_posted',
      'transaksi_dompet',
      jsonb_build_object(
        'ledger_id', new.id,
        'amount', new.amount,
        'balance_after', new.balance_after,
        'kantin_user_id', new.actor_id,
        'kantin_name', v_kantin_name,
        'dispute_deeplink', v_dispute_deeplink
      ),
      case when v_large_threshold is not null and new.amount >= v_large_threshold then 'high' else 'normal' end,
      new.id::text
    );

    perform public.wallet_enqueue_notification(
      new.actor_id,
      'Pembayaran diterima',
      'Pembayaran diterima Rp ' || to_char(new.amount, 'FM999G999G999') || ' - ' ||
      coalesce(v_santri_name, new.santri_nis) || ' - ' || to_char(new.created_at at time zone 'Asia/Jakarta', 'HH24:MI'),
      'wallet.kantin.payment_posted',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'amount', new.amount, 'created_at', new.created_at),
      'normal',
      new.id::text
    );
  elsif new.category = 'topup' then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Top up dompet berhasil',
      'Saldo ' || coalesce(v_santri_name, new.santri_nis) || ' bertambah Rp ' ||
      to_char(new.amount, 'FM999G999G999') || '. Saldo sekarang Rp ' || to_char(new.balance_after, 'FM999G999G999') || '.',
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
      'Ada koreksi dompet ' || coalesce(v_santri_name, new.santri_nis) || ' sebesar Rp ' ||
      to_char(new.amount, 'FM999G999G999') || '. Saldo sekarang Rp ' || to_char(new.balance_after, 'FM999G999G999') || '.',
      'wallet.adjustment.posted',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'category', new.category, 'direction', new.direction, 'amount', new.amount, 'balance_after', new.balance_after),
      'high',
      new.id::text
    );

    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Koreksi ledger dompet',
      'Koreksi ' || new.category::text || ' untuk NIS ' || new.santri_nis || ' sebesar Rp ' || to_char(new.amount, 'FM999G999G999') || '.',
      'wallet.adjustment.posted',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'category', new.category, 'direction', new.direction),
      'high',
      new.id::text
    );
  end if;

  if new.balance_after <= coalesce(v_critical_threshold, 10000) then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Saldo dompet kritis',
      'Saldo ' || coalesce(v_santri_name, new.santri_nis) || ' tersisa Rp ' || to_char(new.balance_after, 'FM999G999G999') || '.',
      'wallet.balance.critical',
      'dompet_santri',
      jsonb_build_object('ledger_id', new.id, 'balance_after', new.balance_after, 'threshold', coalesce(v_critical_threshold, 10000), 'sms_fallback_required', true),
      'critical',
      new.id::text
    );
  elsif new.balance_after <= coalesce(v_warning_threshold, 30000) then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Saldo dompet rendah',
      'Saldo ' || coalesce(v_santri_name, new.santri_nis) || ' tersisa Rp ' || to_char(new.balance_after, 'FM999G999G999') || '.',
      'wallet.balance.warning',
      'dompet_santri',
      jsonb_build_object('ledger_id', new.id, 'balance_after', new.balance_after, 'threshold', coalesce(v_warning_threshold, 30000)),
      'high',
      new.id::text
    );
  end if;

  if new.amount >= 100000 then
    perform public.wallet_notify_role(
      'bendahara',
      'Transaksi dompet > Rp100.000',
      'Transaksi ' || new.category::text || ' NIS ' || new.santri_nis || ' sebesar Rp ' || to_char(new.amount, 'FM999G999G999') || '.',
      'wallet.transaction.large.bendahara',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'amount', new.amount, 'threshold', 100000),
      'high',
      new.id::text
    );
  end if;

  if new.amount >= 500000 then
    perform public.wallet_notify_role(
      'rois',
      'Transaksi dompet > Rp500.000',
      'Anomali signifikan: transaksi NIS ' || new.santri_nis || ' sebesar Rp ' || to_char(new.amount, 'FM999G999G999') || '.',
      'wallet.transaction.large.rois',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'amount', new.amount, 'threshold', 500000),
      'critical',
      new.id::text
    );
  end if;

  select count(*) into v_large_count_1h
  from public.transaksi_dompet td
  where td.santri_nis = new.santri_nis
    and td.status = 'posted'
    and td.amount >= 100000
    and td.created_at >= new.created_at - interval '1 hour';

  if new.amount >= 1000000 or v_large_count_1h >= 3 then
    perform public.wallet_notify_role(
      'super_admin',
      'Transaksi dompet kritikal',
      'Transaksi kritikal NIS ' || new.santri_nis || ': Rp ' || to_char(new.amount, 'FM999G999G999') ||
      '. Transaksi besar 1 jam terakhir: ' || v_large_count_1h || '.',
      'wallet.transaction.large.super_admin',
      'transaksi_dompet',
      jsonb_build_object('ledger_id', new.id, 'santri_nis', new.santri_nis, 'amount', new.amount, 'threshold', 1000000, 'large_count_1h', v_large_count_1h),
      'critical',
      new.id::text
    );
  end if;

  return new;
end;
$$;

create or replace function public.tr_wallet_notify_risk_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.severity = 'low' then
    return new;
  end if;

  if new.severity = 'medium' then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Risk event dompet: ' || new.rule_code,
      'Severity MEDIUM pada dompet santri ' || coalesce(new.santri_nis, '-') || '.',
      'wallet.risk.medium',
      'wallet_risk_events',
      jsonb_build_object('risk_event_id', new.id, 'santri_nis', new.santri_nis, 'device_id', new.device_id, 'score', new.score, 'action', new.action),
      'normal',
      new.id::text
    );
  elsif new.severity = 'high' then
    update public.dompet_santri
    set status = 'locked',
        locked_reason = 'Risk event high: ' || new.rule_code
    where santri_nis = new.santri_nis
      and status = 'active';

    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Risk event HIGH dompet',
      'Transaksi dompet dibekukan sementara karena ' || new.rule_code || '.',
      'wallet.risk.high',
      'wallet_risk_events',
      jsonb_build_object('risk_event_id', new.id, 'santri_nis', new.santri_nis, 'device_id', new.device_id, 'score', new.score, 'action', new.action),
      'high',
      new.id::text
    );

    if new.santri_nis is not null then
      perform public.wallet_notify_wali(
        new.santri_nis,
        'Dompet santri dikunci sementara',
        'Sistem mendeteksi aktivitas tidak biasa. Dompet dikunci sementara untuk keamanan.',
        'wallet.risk.parent_alert.high',
        'wallet_risk_events',
        jsonb_build_object('risk_event_id', new.id, 'rule_code', new.rule_code, 'severity', new.severity),
        'high',
        new.id::text
      );
    end if;
  elsif new.severity = 'critical' then
    update public.dompet_santri
    set status = 'locked',
        locked_reason = 'Risk event critical: ' || new.rule_code
    where santri_nis = new.santri_nis
      and status = 'active';

    update public.wallet_risk_events
    set response_due_at = coalesce(response_due_at, created_at + interval '15 minutes'),
        auto_action_at = coalesce(auto_action_at, created_at + interval '15 minutes')
    where id = new.id;

    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois','dewan'],
      'Risk event CRITICAL dompet',
      'Wajib respons maksimal 15 menit. Rule: ' || new.rule_code || ', NIS: ' || coalesce(new.santri_nis, '-') || '.',
      'wallet.risk.critical',
      'wallet_risk_events',
      jsonb_build_object('risk_event_id', new.id, 'santri_nis', new.santri_nis, 'device_id', new.device_id, 'score', new.score, 'response_due_minutes', 15),
      'critical',
      new.id::text
    );

    if new.santri_nis is not null then
      perform public.wallet_notify_wali(
        new.santri_nis,
        'Peringatan keamanan dompet',
        'Aktivitas kritikal terdeteksi. Dompet dikunci dan sedang diperiksa pesantren.',
        'wallet.risk.parent_alert.critical',
        'wallet_risk_events',
        jsonb_build_object('risk_event_id', new.id, 'rule_code', new.rule_code, 'severity', new.severity),
        'critical',
        new.id::text
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.tr_wallet_notify_dispute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger public.transaksi_dompet%rowtype;
begin
  if tg_op = 'INSERT' then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Dispute transaksi dompet',
      'Wali membuka dispute untuk NIS ' || new.santri_nis || '. SLA respons 48 jam.',
      'wallet.dispute.opened',
      'wallet_disputes',
      jsonb_build_object('dispute_id', new.id, 'ledger_id', new.ledger_id, 'santri_nis', new.santri_nis, 'response_due_at', new.response_due_at),
      'high',
      new.id::text
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.resolved_at is not null then
    select * into v_ledger from public.transaksi_dompet where id = new.ledger_id;

    if new.status = 'resolved_reversed' then
      perform public.wallet_notify_wali(
        new.santri_nis,
        'Transaksi telah dibalik',
        'Transaksi ' || new.ledger_id || ' telah dibalik. Saldo Rp ' || to_char(coalesce(v_ledger.amount, 0), 'FM999G999G999') || ' telah dikembalikan.',
        'wallet.dispute.resolved_reversed',
        'wallet_disputes',
        jsonb_build_object('dispute_id', new.id, 'status', new.status, 'ledger_id', new.ledger_id, 'reversal_ledger_id', new.reversal_ledger_id),
        'normal',
        new.id::text
      );
    else
      perform public.wallet_notify_wali(
        new.santri_nis,
        'Dispute transaksi selesai',
        'Transaksi ' || new.ledger_id || ' telah diverifikasi valid. Jika masih bermasalah hubungi pesantren.',
        'wallet.dispute.resolved_valid',
        'wallet_disputes',
        jsonb_build_object('dispute_id', new.id, 'status', new.status, 'ledger_id', new.ledger_id),
        'normal',
        new.id::text
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.wallet_escalate_overdue_disputes()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint := 0;
  v_dispute record;
begin
  for v_dispute in
    select *
    from public.wallet_disputes
    where status in ('open','investigating')
      and response_due_at <= now()
      and escalated_at is null
  loop
    update public.wallet_disputes
    set escalated_at = now()
    where id = v_dispute.id;

    perform public.wallet_notify_role(
      'super_admin',
      'SLA dispute dompet terlewati',
      'Dispute ' || v_dispute.id || ' untuk NIS ' || v_dispute.santri_nis || ' belum direspons lebih dari 48 jam.',
      'wallet.dispute.sla_overdue',
      'wallet_disputes',
      jsonb_build_object('dispute_id', v_dispute.id, 'ledger_id', v_dispute.ledger_id, 'santri_nis', v_dispute.santri_nis),
      'critical',
      v_dispute.id::text
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('escalated_count', v_count);
end;
$$;

revoke all on function public.wallet_escalate_overdue_disputes() from public, anon, authenticated;
grant execute on function public.wallet_escalate_overdue_disputes() to service_role;

create or replace function public.tr_wallet_notify_user_device()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_count int;
  v_role text;
  v_device_name text;
begin
  select count(*) into v_existing_count
  from public.user_devices
  where user_id = new.user_id
    and id <> new.id;

  select role into v_role from public.profiles where id = new.user_id;
  v_device_name := coalesce(new.device_type, 'Android');

  if v_existing_count > 0 and v_role in ('wali','kantin') then
    perform public.wallet_enqueue_notification(
      new.user_id,
      'Login dari perangkat baru',
      'Login baru terdeteksi di akun kamu dari perangkat ' || v_device_name || '. Bukan kamu? Kunci akun sekarang.',
      'wallet.security.new_device_login',
      'user_devices',
      jsonb_build_object('device_id', new.id, 'device_type', new.device_type, 'lock_deeplink', 'alhasanah://security/lock-account'),
      'critical',
      new.id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists tr_wallet_notify_user_device on public.user_devices;
create trigger tr_wallet_notify_user_device
after insert on public.user_devices
for each row
execute function public.tr_wallet_notify_user_device();

revoke execute on function public.tr_wallet_notify_user_device() from authenticated, anon, public;

create or replace function public.wallet_record_pin_failure(
  p_santri_nis text,
  p_actor_id uuid default null,
  p_actor_role text default null,
  p_device_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count_15m int;
  v_count_1h int;
  v_santri_name text;
begin
  insert into public.wallet_pin_attempts (santri_nis, actor_id, actor_role, device_id, attempt_status, metadata)
  values (p_santri_nis, p_actor_id, p_actor_role, p_device_id, 'failed', coalesce(p_metadata, '{}'::jsonb));

  select nama into v_santri_name from public.santri where nis = p_santri_nis;

  select count(*) into v_count_15m
  from public.wallet_pin_attempts
  where santri_nis = p_santri_nis
    and attempt_status = 'failed'
    and created_at >= now() - interval '15 minutes';

  select count(*) into v_count_1h
  from public.wallet_pin_attempts
  where santri_nis = p_santri_nis
    and attempt_status = 'failed'
    and created_at >= now() - interval '1 hour';

  if v_count_15m = 3 then
    update public.dompet_santri
    set status = 'locked',
        locked_reason = '3 failed PIN attempts'
    where santri_nis = p_santri_nis
      and status = 'active';

    perform public.wallet_notify_wali(
      p_santri_nis,
      'Percobaan PIN salah berulang',
      'Ada 3 percobaan PIN salah di akun ' || coalesce(v_santri_name, p_santri_nis) || '. Akun dikunci sementara 15 menit.',
      'wallet.pin.failed_3',
      'wallet_pin_attempts',
      jsonb_build_object('santri_nis', p_santri_nis, 'device_id', p_device_id, 'failed_count_15m', v_count_15m),
      'high',
      p_santri_nis
    );
  end if;

  if v_count_1h > 10 then
    perform public.wallet_notify_roles(
      array['super_admin','bendahara','rois'],
      'Percobaan PIN mencurigakan',
      'Lebih dari 10 percobaan PIN salah dalam 1 jam untuk NIS ' || p_santri_nis || '.',
      'wallet.pin.failed_excessive',
      'wallet_pin_attempts',
      jsonb_build_object('santri_nis', p_santri_nis, 'device_id', p_device_id, 'failed_count_1h', v_count_1h),
      'critical',
      p_santri_nis
    );
  end if;

  return jsonb_build_object('failed_count_15m', v_count_15m, 'failed_count_1h', v_count_1h);
end;
$$;

revoke all on function public.wallet_record_pin_failure(text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.wallet_record_pin_failure(text, uuid, text, text, jsonb) to service_role;

create or replace function public.tr_wallet_notify_payment_intent_failure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     and new.status = 'failed'
     and new.type in ('topup','topup_midtrans','midtrans_topup') then
    perform public.wallet_notify_wali(
      new.santri_nis,
      'Top up dompet gagal',
      'Top up sebesar Rp ' || to_char(new.amount, 'FM999G999G999') || ' belum berhasil diproses. Jika saldo rekening sudah terpotong, hubungi pesantren.',
      'wallet.topup.failed',
      'wallet_payment_intents',
      jsonb_build_object('payment_intent_id', new.id, 'amount', new.amount, 'midtrans_order_id', new.midtrans_order_id),
      'high',
      new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_wallet_notify_payment_intent_failure on public.wallet_payment_intents;
create trigger tr_wallet_notify_payment_intent_failure
after update on public.wallet_payment_intents
for each row
execute function public.tr_wallet_notify_payment_intent_failure();

revoke execute on function public.tr_wallet_notify_payment_intent_failure() from authenticated, anon, public;

create or replace function public.wallet_run_weekly_digest()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := (date_trunc('week', now() at time zone 'Asia/Jakarta') - interval '7 days')::date;
  v_week_end date := (date_trunc('week', now() at time zone 'Asia/Jakarta') - interval '1 day')::date;
  v_run_id uuid;
  v_count bigint := 0;
  v_wallet record;
  v_tx_count bigint;
  v_total_spend bigint;
  v_top text;
begin
  insert into public.wallet_weekly_digest_runs (week_start, week_end)
  values (v_week_start, v_week_end)
  returning id into v_run_id;

  for v_wallet in
    select d.santri_nis, d.saldo, s.nama, s.wali_id
    from public.dompet_santri d
    join public.santri s on s.nis = d.santri_nis
    where s.wali_id is not null and d.status in ('active','locked')
  loop
    select count(*), coalesce(sum(amount), 0)
    into v_tx_count, v_total_spend
    from public.transaksi_dompet
    where santri_nis = v_wallet.santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= v_week_start::timestamptz
      and created_at < (v_week_end + 1)::timestamptz;

    select coalesce(p.full_name, td.counterparty_role, 'Kantin')
    into v_top
    from public.transaksi_dompet td
    left join public.profiles p on p.id = td.actor_id
    where td.santri_nis = v_wallet.santri_nis
      and td.direction = 'debit'
      and td.status = 'posted'
      and td.created_at >= v_week_start::timestamptz
      and td.created_at < (v_week_end + 1)::timestamptz
    group by coalesce(p.full_name, td.counterparty_role, 'Kantin')
    order by sum(td.amount) desc
    limit 1;

    perform public.wallet_enqueue_notification(
      v_wallet.wali_id,
      'Rangkuman mingguan dompet',
      'Rangkuman mingguan ' || coalesce(v_wallet.nama, v_wallet.santri_nis) || ': transaksi minggu ini ' ||
      v_tx_count || 'x, total Rp ' || to_char(v_total_spend, 'FM999G999G999') ||
      ', saldo sekarang Rp ' || to_char(v_wallet.saldo, 'FM999G999G999') ||
      ', top pengeluaran: ' || coalesce(v_top, '-') || '.',
      'wallet.weekly_digest',
      'wallet_weekly_digest_runs',
      jsonb_build_object('run_id', v_run_id, 'santri_nis', v_wallet.santri_nis, 'tx_count', v_tx_count, 'total_spend', v_total_spend, 'balance', v_wallet.saldo, 'top_spend', v_top),
      'low',
      v_run_id::text
    );

    v_count := v_count + 1;
  end loop;

  update public.wallet_weekly_digest_runs
  set status = 'success',
      generated_count = v_count,
      finished_at = now()
  where id = v_run_id;

  return jsonb_build_object('run_id', v_run_id, 'generated_count', v_count);
end;
$$;

revoke all on function public.wallet_run_weekly_digest() from public, anon, authenticated;
grant execute on function public.wallet_run_weekly_digest() to service_role;

create or replace function public.wallet_broadcast_maintenance(
  p_title text,
  p_body text,
  p_start_at timestamptz,
  p_duration_minutes int,
  p_actor_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  insert into public.notification_queue (user_id, title, body, source_table, event_type, priority, data, reference_id)
  select
    p.id,
    p_title,
    p_body,
    'wallet_maintenance',
    'wallet.maintenance.scheduled',
    'high',
    jsonb_build_object('start_at', p_start_at, 'duration_minutes', p_duration_minutes, 'actor_id', p_actor_id),
    coalesce(p_start_at::text, now()::text)
  from public.profiles p
  where coalesce(p.is_active, true)
    and p.role in ('wali','kantin','super_admin','bendahara','rois','dewan');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.wallet_broadcast_maintenance(text, text, timestamptz, int, uuid) from public, anon, authenticated;
grant execute on function public.wallet_broadcast_maintenance(text, text, timestamptz, int, uuid) to service_role;

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

    if new.is_frozen then
      perform public.wallet_notify_roles(
        array['kantin'],
        'Sistem dompet sedang dibekukan',
        'Transaksi dompet santri sementara ditolak. Kantin harap menunggu instruksi bendahara.',
        'wallet.system.frozen.kantin_broadcast',
        'wallet_system_controls',
        jsonb_build_object('key', new.key, 'reason', new.freeze_reason),
        'critical',
        new.key
      );
    else
      perform public.wallet_notify_roles(
        array['kantin'],
        'Sistem dompet aktif kembali',
        'Transaksi dompet santri sudah dapat diproses kembali.',
        'wallet.system.unfrozen.kantin_broadcast',
        'wallet_system_controls',
        jsonb_build_object('key', new.key),
        'normal',
        new.key
      );
    end if;
  end if;
  return new;
end;
$$;

-- Keep trigger name from previous migration; function body replaced.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'wallet-dispute-sla-hourly') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'wallet-dispute-sla-hourly';
  end if;
  if exists (select 1 from cron.job where jobname = 'wallet-weekly-digest-sunday') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'wallet-weekly-digest-sunday';
  end if;
end;
$$;

select cron.schedule(
  'wallet-dispute-sla-hourly',
  '20 * * * *',
  $$ select public.wallet_escalate_overdue_disputes(); $$
);

select cron.schedule(
  'wallet-weekly-digest-sunday',
  '0 1 * * 0',
  $$ select public.wallet_run_weekly_digest(); $$
);
