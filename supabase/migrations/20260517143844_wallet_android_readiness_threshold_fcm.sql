-- Android readiness hardening:
-- 1. Parent approval is required only for a single transaction above Rp75.000.
-- 2. Transactions at or below Rp75.000 use student PIN authorization mode.
-- 3. Wali is notified when daily/monthly limits are reached or blocked.
-- 4. FCM tokens are single-owner to prevent cross-account push delivery.

alter table public.user_devices
  add column if not exists is_active boolean not null default true,
  add column if not exists device_id text,
  add column if not exists platform text,
  add column if not exists app_instance_id text,
  add column if not exists last_seen_at timestamptz;

update public.user_devices
set last_seen_at = coalesce(last_seen_at, last_seen)
where last_seen_at is null;

with ranked as (
  select id,
         row_number() over (partition by fcm_token order by coalesce(last_seen_at, last_seen, now()) desc, id desc) as rn
  from public.user_devices
)
update public.user_devices ud
set is_active = ranked.rn = 1
from ranked
where ranked.id = ud.id;

create unique index if not exists idx_user_devices_active_fcm_token_unique
  on public.user_devices (fcm_token)
  where is_active;

create index if not exists idx_user_devices_active_user
  on public.user_devices (user_id, is_active, coalesce(last_seen_at, last_seen) desc);

create or replace function public.tr_user_devices_single_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_active := coalesce(new.is_active, true);
  new.last_seen_at := coalesce(new.last_seen_at, new.last_seen, now());
  new.last_seen := coalesce(new.last_seen, new.last_seen_at, now());

  if new.is_active then
    update public.user_devices
    set is_active = false
    where fcm_token = new.fcm_token
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  return new;
end;
$$;

drop trigger if exists tr_user_devices_single_owner_insert on public.user_devices;
create trigger tr_user_devices_single_owner_insert
before insert on public.user_devices
for each row execute function public.tr_user_devices_single_owner();

drop trigger if exists tr_user_devices_single_owner_update on public.user_devices;
create trigger tr_user_devices_single_owner_update
before update of fcm_token, user_id, is_active on public.user_devices
for each row execute function public.tr_user_devices_single_owner();

revoke execute on function public.tr_user_devices_single_owner() from public, anon, authenticated;

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
begin
  if p_user_id is null then
    raise exception 'user_id wajib diisi';
  end if;

  if p_fcm_token is null or length(trim(p_fcm_token)) < 20 then
    raise exception 'fcm_token tidak valid';
  end if;

  update public.user_devices
  set is_active = false
  where fcm_token = p_fcm_token
    and user_id <> p_user_id;

  insert into public.user_devices (user_id, fcm_token, device_type, device_id, platform, app_instance_id, is_active, last_seen, last_seen_at)
  values (p_user_id, p_fcm_token, coalesce(p_platform, 'android'), p_device_id, coalesce(p_platform, 'android'), p_app_instance_id, true, now(), now())
  on conflict (user_id, fcm_token) do update
  set is_active = true,
      device_id = coalesce(excluded.device_id, public.user_devices.device_id),
      platform = coalesce(excluded.platform, public.user_devices.platform),
      device_type = coalesce(excluded.device_type, public.user_devices.device_type),
      app_instance_id = coalesce(excluded.app_instance_id, public.user_devices.app_instance_id),
      last_seen = now(),
      last_seen_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'status', 'registered',
    'id', v_row.id,
    'user_id', v_row.user_id,
    'is_active', v_row.is_active
  );
end;
$$;

revoke all on function public.register_user_fcm_device(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_user_fcm_device(uuid, text, text, text, text) to service_role;

create or replace function public.wallet_detect_transaction_risk(
  p_santri_nis text,
  p_amount bigint,
  p_kantin_user_id uuid,
  p_device_id text,
  p_merchant_id uuid default null,
  p_outlet_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_control jsonb;
  v_parent_threshold bigint := 75000;
  v_hour int;
  v_santri_velocity int;
  v_kantin_velocity int;
  v_avg_daily numeric;
  v_multiplier numeric;
  v_actions jsonb := '[]'::jsonb;
begin
  select metadata into v_control
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  v_parent_threshold := coalesce((v_control->>'parent_approval_required_above')::bigint, 75000);
  v_multiplier := coalesce((v_control->>'large_amount_average_multiplier')::numeric, 3);
  v_hour := extract(hour from now() at time zone coalesce(v_control->>'operating_timezone', 'Asia/Jakarta'));

  if v_hour < coalesce((v_control->>'operating_start_hour')::int, 6)
     or v_hour >= coalesce((v_control->>'operating_end_hour')::int, 21) then
    insert into public.wallet_risk_events (
      severity, santri_nis, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'high', p_santri_nis, p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'OUTSIDE_OPERATING_HOURS', 80, 'block',
      jsonb_build_object('hour', v_hour, 'amount', p_amount)
    );
    v_actions := v_actions || jsonb_build_array('block_outside_operating_hours');
  end if;

  select count(*) into v_santri_velocity
  from public.transaksi_dompet
  where santri_nis = p_santri_nis
    and status = 'posted'
    and created_at >= now() - interval '5 minutes';

  if v_santri_velocity >= coalesce((v_control->>'santri_velocity_limit_5m')::int, 3) then
    insert into public.wallet_risk_events (
      severity, santri_nis, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'high', p_santri_nis, p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'SANTRI_VELOCITY_5M', 90, 'freeze_wallet',
      jsonb_build_object('count_5m', v_santri_velocity, 'amount', p_amount)
    );
    v_actions := v_actions || jsonb_build_array('freeze_wallet_velocity');
  end if;

  select count(*) into v_kantin_velocity
  from public.transaksi_dompet
  where actor_id = p_kantin_user_id
    and actor_role = 'kantin'
    and status = 'posted'
    and created_at >= now() - interval '10 minutes';

  if v_kantin_velocity >= coalesce((v_control->>'kantin_velocity_limit_10m')::int, 30) then
    insert into public.wallet_risk_events (
      severity, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'medium', p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'KANTIN_VELOCITY_10M', 70, 'flag',
      jsonb_build_object('count_10m', v_kantin_velocity, 'amount', p_amount)
    );
    v_actions := v_actions || jsonb_build_array('flag_kantin_velocity');
  end if;

  select avg(day_amount) into v_avg_daily
  from (
    select date_trunc('day', created_at at time zone 'Asia/Jakarta') as day, sum(amount)::numeric as day_amount
    from public.transaksi_dompet
    where santri_nis = p_santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= now() - interval '30 days'
    group by 1
  ) x;

  if v_avg_daily is not null and v_avg_daily > 0 and p_amount > (v_avg_daily * v_multiplier) then
    insert into public.wallet_risk_events (
      severity, santri_nis, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      case when p_amount > v_parent_threshold then 'high' else 'medium' end,
      p_santri_nis, p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'AMOUNT_ABOVE_BASELINE', 85,
      case when p_amount > v_parent_threshold then 'require_parent_approval' else 'flag' end,
      jsonb_build_object('amount', p_amount, 'avg_daily', v_avg_daily, 'multiplier', v_multiplier, 'parent_threshold', v_parent_threshold)
    );
    v_actions := v_actions || jsonb_build_array(case when p_amount > v_parent_threshold then 'require_parent_approval' else 'flag_amount_above_baseline' end);
  end if;

  return jsonb_build_object('status', 'ok', 'actions', v_actions, 'parent_threshold', v_parent_threshold);
end;
$$;

revoke all on function public.wallet_detect_transaction_risk(text, bigint, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.wallet_detect_transaction_risk(text, bigint, uuid, text, uuid, uuid) to service_role;

create or replace function public.wallet_create_kantin_authorization_session(
  p_wallet_public_id uuid,
  p_amount bigint,
  p_kantin_user_id uuid,
  p_merchant_id uuid default null,
  p_outlet_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_wallet public.dompet_santri%rowtype;
  v_existing public.wallet_authorization_sessions%rowtype;
  v_existing_mode text;
  v_payment_intent_id uuid;
  v_session_id uuid;
  v_challenge text := encode(gen_random_bytes(32), 'hex');
  v_nonce text := encode(gen_random_bytes(24), 'hex');
  v_expires_at timestamptz := now() + interval '5 minutes';
  v_device_id text := nullif(trim(coalesce(p_metadata->>'kantin_device_id', '')), '');
  v_device_public_key text := nullif(trim(coalesce(p_metadata->>'kantin_device_public_key', '')), '');
  v_device public.kantin_devices%rowtype;
  v_risk jsonb;
  v_is_frozen boolean;
  v_parent_threshold bigint := 75000;
  v_authorization_mode text;
  v_intent_status public.wallet_intent_status;
begin
  select is_frozen, coalesce((metadata->>'parent_approval_required_above')::bigint, 75000)
  into v_is_frozen, v_parent_threshold
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  if coalesce(v_is_frozen, false) then
    raise exception 'Wallet transactions are frozen by system control';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_kantin_user_id is null then
    raise exception 'kantin_user_id is required';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then
    raise exception 'A strong idempotency key is required';
  end if;

  if v_device_id is null then
    raise exception 'kantin_device_id is required';
  end if;

  select * into v_existing
  from public.wallet_authorization_sessions
  where idempotency_key = p_idempotency_key;

  if found then
    select metadata->>'authorization_mode'
    into v_existing_mode
    from public.wallet_payment_intents
    where id = v_existing.payment_intent_id;

    return jsonb_build_object(
      'status', case when v_existing_mode = 'parent_approval' then 'requires_parent_approval' else 'requires_student_pin' end,
      'authorization_mode', coalesce(v_existing_mode, 'student_pin'),
      'authorization_session_id', v_existing.id,
      'payment_intent_id', v_existing.payment_intent_id,
      'challenge', v_existing.challenge,
      'nonce', v_existing.nonce,
      'expires_at', v_existing.expires_at
    );
  end if;

  select * into v_device
  from public.kantin_devices
  where kantin_user_id = p_kantin_user_id
    and device_id = v_device_id
    and status = 'active'
  limit 1;

  if not found then
    insert into public.wallet_risk_events (
      severity, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'critical', p_kantin_user_id, v_device_id, p_merchant_id, p_outlet_id,
      'UNREGISTERED_KANTIN_DEVICE', 100, 'block',
      jsonb_build_object('wallet_public_id', p_wallet_public_id)
    );
    raise exception 'Kantin device is not active';
  end if;

  if v_device_public_key is not null and v_device.public_key <> v_device_public_key then
    insert into public.wallet_risk_events (
      severity, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'critical', p_kantin_user_id, v_device_id, p_merchant_id, p_outlet_id,
      'KANTIN_DEVICE_KEY_MISMATCH', 100, 'block',
      jsonb_build_object('wallet_public_id', p_wallet_public_id)
    );
    raise exception 'Kantin device key mismatch';
  end if;

  select * into v_wallet
  from public.dompet_santri
  where wallet_public_id = p_wallet_public_id
  for update;

  if not found then
    raise exception 'Wallet QR/NFC token not found';
  end if;

  if v_wallet.status <> 'active' then
    raise exception 'Wallet account is not active';
  end if;

  if v_wallet.single_transaction_limit is not null and p_amount > v_wallet.single_transaction_limit then
    raise exception 'Transaction exceeds single transaction limit';
  end if;

  if p_merchant_id is not null then
    if not exists (
      select 1
      from public.wallet_merchant_users wmu
      join public.wallet_merchants wm on wm.id = wmu.merchant_id
      where wmu.profile_id = p_kantin_user_id
        and wmu.merchant_id = p_merchant_id
        and (p_outlet_id is null or wmu.outlet_id is null or wmu.outlet_id = p_outlet_id)
        and wmu.status = 'active'
        and wm.status = 'active'
    ) then
      raise exception 'Kantin user is not assigned to this merchant/outlet';
    end if;
  end if;

  v_authorization_mode := case when p_amount > v_parent_threshold then 'parent_approval' else 'student_pin' end;
  v_intent_status := case when v_authorization_mode = 'parent_approval' then 'requires_authorization'::public.wallet_intent_status else 'pending'::public.wallet_intent_status end;

  v_risk := public.wallet_detect_transaction_risk(
    v_wallet.santri_nis,
    p_amount,
    p_kantin_user_id,
    v_device_id,
    p_merchant_id,
    p_outlet_id
  );

  insert into public.wallet_payment_intents (
    santri_nis,
    type,
    status,
    amount,
    created_by,
    created_by_role,
    expires_at,
    idempotency_key,
    merchant_id,
    outlet_id,
    metadata
  ) values (
    v_wallet.santri_nis,
    'kantin_payment',
    v_intent_status,
    p_amount,
    p_kantin_user_id,
    'kantin',
    v_expires_at,
    p_idempotency_key,
    p_merchant_id,
    p_outlet_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('risk', v_risk, 'authorization_mode', v_authorization_mode, 'parent_threshold', v_parent_threshold)
  ) returning id into v_payment_intent_id;

  insert into public.wallet_authorization_sessions (
    wallet_public_id,
    santri_nis,
    payment_intent_id,
    kantin_user_id,
    amount,
    status,
    challenge,
    nonce,
    expires_at,
    merchant_id,
    outlet_id,
    idempotency_key
  ) values (
    p_wallet_public_id,
    v_wallet.santri_nis,
    v_payment_intent_id,
    p_kantin_user_id,
    p_amount,
    v_intent_status,
    v_challenge,
    v_nonce,
    v_expires_at,
    p_merchant_id,
    p_outlet_id,
    p_idempotency_key
  ) returning id into v_session_id;

  update public.kantin_devices
  set last_seen_at = now()
  where id = v_device.id;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_kantin_user_id,
    'kantin',
    'wallet_create_kantin_authorization_session',
    'wallet_authorization_sessions',
    v_wallet.santri_nis,
    v_session_id::text,
    jsonb_build_object('amount', p_amount, 'merchant_id', p_merchant_id, 'outlet_id', p_outlet_id, 'kantin_device_id', v_device_id, 'authorization_mode', v_authorization_mode)
  );

  return jsonb_build_object(
    'status', case when v_authorization_mode = 'parent_approval' then 'requires_parent_approval' else 'requires_student_pin' end,
    'authorization_mode', v_authorization_mode,
    'authorization_session_id', v_session_id,
    'payment_intent_id', v_payment_intent_id,
    'santri_nis', v_wallet.santri_nis,
    'challenge', v_challenge,
    'nonce', v_nonce,
    'expires_at', v_expires_at,
    'amount', p_amount,
    'parent_threshold', v_parent_threshold,
    'risk', v_risk
  );
end;
$$;

revoke all on function public.wallet_create_kantin_authorization_session(uuid, bigint, uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.wallet_create_kantin_authorization_session(uuid, bigint, uuid, uuid, uuid, text, jsonb) to service_role;

create or replace function public.wallet_notify_limit_event(
  p_santri_nis text,
  p_limit_type text,
  p_limit_amount bigint,
  p_current_amount bigint,
  p_attempt_amount bigint,
  p_blocked boolean,
  p_reference_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_santri_name text;
begin
  select nama into v_santri_name
  from public.santri
  where nis = p_santri_nis;

  return public.wallet_notify_wali(
    p_santri_nis,
    case when p_blocked then 'Limit dompet terlampaui' else 'Limit dompet tercapai' end,
    coalesce(v_santri_name, p_santri_nis) || ' ' ||
    case when p_limit_type = 'daily' then 'mencapai limit harian' else 'mencapai limit bulanan' end ||
    ' Rp ' || to_char(p_limit_amount, 'FM999G999G999') ||
    '. Pemakaian sekarang Rp ' || to_char(p_current_amount, 'FM999G999G999') ||
    case when p_blocked then '. Transaksi Rp ' || to_char(p_attempt_amount, 'FM999G999G999') || ' ditolak.' else '.' end,
    case when p_limit_type = 'daily' then 'wallet.limit.daily' else 'wallet.limit.monthly' end,
    'dompet_santri',
    jsonb_build_object(
      'limit_type', p_limit_type,
      'limit_amount', p_limit_amount,
      'current_amount', p_current_amount,
      'attempt_amount', p_attempt_amount,
      'blocked', p_blocked
    ),
    case when p_blocked then 'high' else 'normal' end,
    p_reference_id
  );
end;
$$;

revoke all on function public.wallet_notify_limit_event(text, text, bigint, bigint, bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.wallet_notify_limit_event(text, text, bigint, bigint, bigint, boolean, text) to service_role;

create or replace function public.wallet_confirm_kantin_payment(
  p_authorization_session_id uuid,
  p_approved_by uuid,
  p_approved_device_id text,
  p_signature text,
  p_signature_public_key text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.wallet_authorization_sessions%rowtype;
  v_wallet public.dompet_santri%rowtype;
  v_device public.wallet_devices%rowtype;
  v_day_spend bigint := 0;
  v_month_spend bigint := 0;
  v_post_result jsonb;
  v_existing_ledger_id bigint;
  v_authorization_mode text;
  v_parent_threshold bigint := 75000;
begin
  if p_authorization_session_id is null then
    raise exception 'authorization_session_id is required';
  end if;

  if p_approved_by is null then
    raise exception 'approved_by is required';
  end if;

  if p_approved_device_id is null or length(trim(p_approved_device_id)) = 0 then
    raise exception 'approved_device_id is required';
  end if;

  if p_signature is null or length(trim(p_signature)) = 0 then
    raise exception 'signature is required';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then
    raise exception 'A strong idempotency key is required';
  end if;

  select coalesce((metadata->>'parent_approval_required_above')::bigint, 75000)
  into v_parent_threshold
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  select * into v_session
  from public.wallet_authorization_sessions
  where id = p_authorization_session_id
  for update;

  if not found then
    raise exception 'Authorization session not found';
  end if;

  select metadata->>'authorization_mode'
  into v_authorization_mode
  from public.wallet_payment_intents
  where id = v_session.payment_intent_id;

  if coalesce(v_authorization_mode, 'student_pin') <> 'parent_approval' or v_session.amount <= v_parent_threshold then
    raise exception 'Parent approval is only valid for a single transaction above %', v_parent_threshold;
  end if;

  if v_session.status = 'posted' then
    select posted_ledger_id into v_existing_ledger_id
    from public.wallet_payment_intents
    where id = v_session.payment_intent_id;

    return jsonb_build_object(
      'status', 'idempotent_replay',
      'authorization_session_id', v_session.id,
      'payment_intent_id', v_session.payment_intent_id,
      'ledger_id', v_existing_ledger_id
    );
  end if;

  if v_session.status not in ('requires_authorization','authorized') then
    raise exception 'Authorization session is not confirmable by wali';
  end if;

  if v_session.expires_at <= now() then
    update public.wallet_authorization_sessions set status = 'expired' where id = v_session.id;
    update public.wallet_payment_intents set status = 'expired', updated_at = now() where id = v_session.payment_intent_id;
    raise exception 'Authorization session expired';
  end if;

  select * into v_wallet
  from public.dompet_santri
  where santri_nis = v_session.santri_nis
  for update;

  if not found then
    raise exception 'Wallet account not found';
  end if;

  if v_wallet.status <> 'active' then
    raise exception 'Wallet account is not active';
  end if;

  select * into v_device
  from public.wallet_devices
  where profile_id = p_approved_by
    and santri_nis = v_session.santri_nis
    and device_id = p_approved_device_id
    and status = 'active'
  limit 1;

  if not found then
    raise exception 'Approving device is not active for this wallet';
  end if;

  if v_device.public_key <> p_signature_public_key then
    raise exception 'Signature public key does not match active device';
  end if;

  if v_wallet.daily_spend_limit is not null then
    select coalesce(sum(amount), 0) into v_day_spend
    from public.transaksi_dompet
    where santri_nis = v_session.santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
      and created_at < (date_trunc('day', now() at time zone 'Asia/Jakarta') + interval '1 day') at time zone 'Asia/Jakarta';

    if v_day_spend + v_session.amount > v_wallet.daily_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'daily', v_wallet.daily_spend_limit, v_day_spend, v_session.amount, true, v_session.id::text);
      raise exception 'Transaction exceeds daily spend limit';
    elsif v_day_spend + v_session.amount >= v_wallet.daily_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'daily', v_wallet.daily_spend_limit, v_day_spend + v_session.amount, v_session.amount, false, v_session.id::text);
    end if;
  end if;

  if v_wallet.monthly_spend_limit is not null then
    select coalesce(sum(amount), 0) into v_month_spend
    from public.transaksi_dompet
    where santri_nis = v_session.santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
      and created_at < (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month') at time zone 'Asia/Jakarta';

    if v_month_spend + v_session.amount > v_wallet.monthly_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'monthly', v_wallet.monthly_spend_limit, v_month_spend, v_session.amount, true, v_session.id::text);
      raise exception 'Transaction exceeds monthly spend limit';
    elsif v_month_spend + v_session.amount >= v_wallet.monthly_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'monthly', v_wallet.monthly_spend_limit, v_month_spend + v_session.amount, v_session.amount, false, v_session.id::text);
    end if;
  end if;

  update public.wallet_authorization_sessions
  set status = 'authorized', approved_by = p_approved_by, approved_device_id = p_approved_device_id, approved_at = now()
  where id = v_session.id;

  update public.wallet_payment_intents
  set status = 'authorized',
      approved_at = now(),
      updated_at = now(),
      provider_payload = coalesce(provider_payload, '{}'::jsonb) || jsonb_build_object(
        'approved_device_id', p_approved_device_id,
        'signature_public_key', p_signature_public_key,
        'authorization_session_id', v_session.id,
        'authorization_mode', 'parent_approval'
      )
  where id = v_session.payment_intent_id;

  v_post_result := public.wallet_post_transaction(
    v_session.santri_nis,
    'debit'::public.wallet_direction,
    'pembayaran_kantin'::public.tipe_kategori_transaksi,
    v_session.amount,
    v_session.kantin_user_id,
    'kantin',
    p_idempotency_key,
    'Pembayaran kantin',
    v_session.kantin_user_id,
    'kantin',
    null,
    v_session.payment_intent_id,
    v_session.nonce,
    p_signature,
    p_signature_public_key,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'authorization_session_id', v_session.id,
      'authorization_mode', 'parent_approval',
      'approved_by', p_approved_by,
      'approved_device_id', p_approved_device_id,
      'merchant_id', v_session.merchant_id,
      'outlet_id', v_session.outlet_id
    )
  );

  update public.wallet_authorization_sessions set status = 'posted' where id = v_session.id;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_approved_by,
    'wali',
    'wallet_confirm_kantin_payment',
    'wallet_authorization_sessions',
    v_session.santri_nis,
    v_session.id::text,
    jsonb_build_object('payment_intent_id', v_session.payment_intent_id, 'amount', v_session.amount, 'device_id', p_approved_device_id, 'ledger_id', v_post_result->>'ledger_id', 'authorization_mode', 'parent_approval')
  );

  return jsonb_build_object('status', 'posted', 'authorization_session_id', v_session.id, 'payment_intent_id', v_session.payment_intent_id, 'ledger', v_post_result);
end;
$$;

revoke all on function public.wallet_confirm_kantin_payment(uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.wallet_confirm_kantin_payment(uuid, uuid, text, text, text, text, jsonb) to service_role;

create or replace function public.wallet_confirm_kantin_student_payment(
  p_authorization_session_id uuid,
  p_student_proof_reference text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.wallet_authorization_sessions%rowtype;
  v_wallet public.dompet_santri%rowtype;
  v_day_spend bigint := 0;
  v_month_spend bigint := 0;
  v_post_result jsonb;
  v_existing_ledger_id bigint;
  v_authorization_mode text;
  v_parent_threshold bigint := 75000;
begin
  if p_authorization_session_id is null then
    raise exception 'authorization_session_id is required';
  end if;

  if p_student_proof_reference is null or length(trim(p_student_proof_reference)) < 12 then
    raise exception 'student proof reference is required';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then
    raise exception 'A strong idempotency key is required';
  end if;

  select coalesce((metadata->>'parent_approval_required_above')::bigint, 75000)
  into v_parent_threshold
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  select * into v_session
  from public.wallet_authorization_sessions
  where id = p_authorization_session_id
  for update;

  if not found then
    raise exception 'Authorization session not found';
  end if;

  select metadata->>'authorization_mode'
  into v_authorization_mode
  from public.wallet_payment_intents
  where id = v_session.payment_intent_id;

  if coalesce(v_authorization_mode, 'student_pin') <> 'student_pin' or v_session.amount > v_parent_threshold then
    raise exception 'Student PIN flow is only valid for a single transaction up to %', v_parent_threshold;
  end if;

  if v_session.status = 'posted' then
    select posted_ledger_id into v_existing_ledger_id from public.wallet_payment_intents where id = v_session.payment_intent_id;
    return jsonb_build_object('status', 'idempotent_replay', 'authorization_session_id', v_session.id, 'payment_intent_id', v_session.payment_intent_id, 'ledger_id', v_existing_ledger_id);
  end if;

  if v_session.status not in ('pending','authorized') then
    raise exception 'Authorization session is not confirmable by student PIN';
  end if;

  if v_session.expires_at <= now() then
    update public.wallet_authorization_sessions set status = 'expired' where id = v_session.id;
    update public.wallet_payment_intents set status = 'expired', updated_at = now() where id = v_session.payment_intent_id;
    raise exception 'Authorization session expired';
  end if;

  select * into v_wallet
  from public.dompet_santri
  where santri_nis = v_session.santri_nis
  for update;

  if not found then
    raise exception 'Wallet account not found';
  end if;

  if v_wallet.status <> 'active' then
    raise exception 'Wallet account is not active';
  end if;

  if v_wallet.daily_spend_limit is not null then
    select coalesce(sum(amount), 0) into v_day_spend
    from public.transaksi_dompet
    where santri_nis = v_session.santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
      and created_at < (date_trunc('day', now() at time zone 'Asia/Jakarta') + interval '1 day') at time zone 'Asia/Jakarta';

    if v_day_spend + v_session.amount > v_wallet.daily_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'daily', v_wallet.daily_spend_limit, v_day_spend, v_session.amount, true, v_session.id::text);
      raise exception 'Transaction exceeds daily spend limit';
    elsif v_day_spend + v_session.amount >= v_wallet.daily_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'daily', v_wallet.daily_spend_limit, v_day_spend + v_session.amount, v_session.amount, false, v_session.id::text);
    end if;
  end if;

  if v_wallet.monthly_spend_limit is not null then
    select coalesce(sum(amount), 0) into v_month_spend
    from public.transaksi_dompet
    where santri_nis = v_session.santri_nis
      and direction = 'debit'
      and status = 'posted'
      and created_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
      and created_at < (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month') at time zone 'Asia/Jakarta';

    if v_month_spend + v_session.amount > v_wallet.monthly_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'monthly', v_wallet.monthly_spend_limit, v_month_spend, v_session.amount, true, v_session.id::text);
      raise exception 'Transaction exceeds monthly spend limit';
    elsif v_month_spend + v_session.amount >= v_wallet.monthly_spend_limit then
      perform public.wallet_notify_limit_event(v_session.santri_nis, 'monthly', v_wallet.monthly_spend_limit, v_month_spend + v_session.amount, v_session.amount, false, v_session.id::text);
    end if;
  end if;

  update public.wallet_authorization_sessions
  set status = 'authorized',
      approved_device_id = nullif(p_metadata->>'kantin_device_id', ''),
      approved_at = now()
  where id = v_session.id;

  update public.wallet_payment_intents
  set status = 'authorized',
      approved_at = now(),
      updated_at = now(),
      provider_payload = coalesce(provider_payload, '{}'::jsonb) || jsonb_build_object(
        'authorization_session_id', v_session.id,
        'authorization_mode', 'student_pin',
        'student_proof_reference', p_student_proof_reference
      )
  where id = v_session.payment_intent_id;

  v_post_result := public.wallet_post_transaction(
    v_session.santri_nis,
    'debit'::public.wallet_direction,
    'pembayaran_kantin'::public.tipe_kategori_transaksi,
    v_session.amount,
    v_session.kantin_user_id,
    'kantin',
    p_idempotency_key,
    'Pembayaran kantin',
    v_session.kantin_user_id,
    'kantin',
    null,
    v_session.payment_intent_id,
    v_session.nonce,
    p_student_proof_reference,
    null,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'authorization_session_id', v_session.id,
      'authorization_mode', 'student_pin',
      'student_proof_reference', p_student_proof_reference,
      'merchant_id', v_session.merchant_id,
      'outlet_id', v_session.outlet_id
    )
  );

  update public.wallet_authorization_sessions set status = 'posted' where id = v_session.id;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    v_session.kantin_user_id,
    'kantin',
    'wallet_confirm_kantin_student_payment',
    'wallet_authorization_sessions',
    v_session.santri_nis,
    v_session.id::text,
    jsonb_build_object('payment_intent_id', v_session.payment_intent_id, 'amount', v_session.amount, 'ledger_id', v_post_result->>'ledger_id', 'authorization_mode', 'student_pin')
  );

  return jsonb_build_object('status', 'posted', 'authorization_session_id', v_session.id, 'payment_intent_id', v_session.payment_intent_id, 'ledger', v_post_result);
end;
$$;

revoke all on function public.wallet_confirm_kantin_student_payment(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.wallet_confirm_kantin_student_payment(uuid, text, text, jsonb) to service_role;
