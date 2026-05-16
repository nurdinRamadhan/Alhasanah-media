-- Banking-grade controls for Dompet Santri.
-- Scope: wallet module only. This migration intentionally avoids touching the
-- pesantren ledger/bookkeeping tables outside wallet references.

create table if not exists public.wallet_system_controls (
  key text primary key,
  is_frozen boolean not null default false,
  freeze_reason text,
  frozen_at timestamptz,
  frozen_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint wallet_system_controls_key_check
    check (key in ('wallet_transactions'))
);

insert into public.wallet_system_controls (key, metadata)
values (
  'wallet_transactions',
  jsonb_build_object(
    'operating_timezone', 'Asia/Jakarta',
    'operating_start_hour', 6,
    'operating_end_hour', 21,
    'santri_velocity_limit_5m', 3,
    'kantin_velocity_limit_10m', 30,
    'large_amount_average_multiplier', 3,
    'offline_max_amount', 15000,
    'offline_expiry_minutes', 10
  )
)
on conflict (key) do nothing;

create table if not exists public.wallet_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  ledger_net bigint not null default 0,
  cached_balance_total bigint not null default 0,
  reserved_bank_balance bigint,
  difference_internal bigint not null default 0,
  difference_bank bigint,
  freeze_triggered boolean not null default false,
  triggered_by uuid references public.profiles(id),
  details jsonb not null default '{}'::jsonb,
  constraint wallet_reconciliation_runs_status_check
    check (status in ('running','success','failed','settlement_mismatch'))
);

create index if not exists idx_wallet_reconciliation_runs_started_at
  on public.wallet_reconciliation_runs (started_at desc);

create table if not exists public.wallet_risk_events (
  id uuid primary key default gen_random_uuid(),
  severity text not null,
  status text not null default 'open',
  santri_nis text references public.santri(nis),
  actor_id uuid references public.profiles(id),
  device_id text,
  merchant_id uuid references public.wallet_merchants(id),
  outlet_id uuid references public.wallet_merchant_outlets(id),
  rule_code text not null,
  score numeric not null default 0,
  action text not null default 'flag',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  constraint wallet_risk_events_severity_check
    check (severity in ('low','medium','high','critical')),
  constraint wallet_risk_events_status_check
    check (status in ('open','acknowledged','resolved','false_positive')),
  constraint wallet_risk_events_action_check
    check (action in ('flag','require_parent_approval','block','freeze_wallet','freeze_system'))
);

create index if not exists idx_wallet_risk_events_open
  on public.wallet_risk_events (status, severity, created_at desc);
create index if not exists idx_wallet_risk_events_santri
  on public.wallet_risk_events (santri_nis, created_at desc);
create index if not exists idx_wallet_risk_events_device
  on public.wallet_risk_events (device_id, created_at desc);

create table if not exists public.kantin_devices (
  id uuid primary key default gen_random_uuid(),
  kantin_user_id uuid not null references public.profiles(id),
  device_id text not null unique,
  device_fingerprint text not null,
  public_key text not null,
  key_algorithm text not null default 'Ed25519',
  status text not null default 'pending',
  registered_by uuid references public.profiles(id),
  registered_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  revoked_by uuid references public.profiles(id),
  revoked_at timestamptz,
  revoke_reason text,
  last_seen_at timestamptz,
  last_transaction_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint kantin_devices_key_algorithm_check
    check (key_algorithm = 'Ed25519'),
  constraint kantin_devices_status_check
    check (status in ('pending','active','suspended','revoked')),
  constraint kantin_devices_user_device_unique
    unique (kantin_user_id, device_id)
);

create index if not exists idx_kantin_devices_kantin_user
  on public.kantin_devices (kantin_user_id, status);
create index if not exists idx_kantin_devices_status
  on public.kantin_devices (status, registered_at desc);

create table if not exists public.wallet_disputes (
  id uuid primary key default gen_random_uuid(),
  ledger_id bigint not null references public.transaksi_dompet(id),
  santri_nis text not null references public.santri(nis),
  reported_by uuid not null references public.profiles(id),
  status text not null default 'open',
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  assigned_to uuid references public.profiles(id),
  resolved_by uuid references public.profiles(id),
  resolution_note text,
  reversal_ledger_id bigint references public.transaksi_dompet(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint wallet_disputes_status_check
    check (status in ('open','investigating','resolved_valid','resolved_reversed','rejected','cancelled'))
);

create index if not exists idx_wallet_disputes_status
  on public.wallet_disputes (status, created_at desc);
create index if not exists idx_wallet_disputes_santri
  on public.wallet_disputes (santri_nis, created_at desc);
create unique index if not exists idx_wallet_disputes_open_ledger
  on public.wallet_disputes (ledger_id)
  where status in ('open','investigating');

create table if not exists public.wallet_ledger_integrity_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  santri_nis text references public.santri(nis),
  checked_from timestamptz,
  checked_until timestamptz,
  checked_entries bigint not null default 0,
  broken_at bigint references public.transaksi_dompet(id),
  details jsonb not null default '{}'::jsonb,
  constraint wallet_ledger_integrity_runs_status_check
    check (status in ('running','success','failed'))
);

create index if not exists idx_wallet_ledger_integrity_runs_started
  on public.wallet_ledger_integrity_runs (started_at desc);
create index if not exists idx_wallet_ledger_integrity_runs_santri
  on public.wallet_ledger_integrity_runs (santri_nis, started_at desc);

create trigger set_wallet_disputes_updated_at
before update on public.wallet_disputes
for each row execute function public.set_wallet_updated_at();

alter table public.wallet_system_controls enable row level security;
alter table public.wallet_reconciliation_runs enable row level security;
alter table public.wallet_risk_events enable row level security;
alter table public.kantin_devices enable row level security;
alter table public.wallet_disputes enable row level security;
alter table public.wallet_ledger_integrity_runs enable row level security;

drop policy if exists "wallet_system_controls_admin_select" on public.wallet_system_controls;
create policy "wallet_system_controls_admin_select"
on public.wallet_system_controls
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

drop policy if exists "wallet_reconciliation_admin_select" on public.wallet_reconciliation_runs;
create policy "wallet_reconciliation_admin_select"
on public.wallet_reconciliation_runs
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

drop policy if exists "wallet_risk_admin_select" on public.wallet_risk_events;
create policy "wallet_risk_admin_select"
on public.wallet_risk_events
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

drop policy if exists "kantin_devices_admin_select" on public.kantin_devices;
create policy "kantin_devices_admin_select"
on public.kantin_devices
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

drop policy if exists "kantin_devices_owner_select" on public.kantin_devices;
create policy "kantin_devices_owner_select"
on public.kantin_devices
for select
to authenticated
using (kantin_user_id = auth.uid());

drop policy if exists "wallet_disputes_admin_select" on public.wallet_disputes;
create policy "wallet_disputes_admin_select"
on public.wallet_disputes
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

drop policy if exists "wallet_disputes_wali_select" on public.wallet_disputes;
create policy "wallet_disputes_wali_select"
on public.wallet_disputes
for select
to authenticated
using (
  exists (
    select 1
    from public.santri s
    where s.nis = wallet_disputes.santri_nis
      and s.wali_id = auth.uid()
  )
);

drop policy if exists "wallet_ledger_integrity_admin_select" on public.wallet_ledger_integrity_runs;
create policy "wallet_ledger_integrity_admin_select"
on public.wallet_ledger_integrity_runs
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

grant select on public.wallet_system_controls to authenticated;
grant select on public.wallet_reconciliation_runs to authenticated;
grant select on public.wallet_risk_events to authenticated;
grant select on public.kantin_devices to authenticated;
grant select on public.wallet_disputes to authenticated;
grant select on public.wallet_ledger_integrity_runs to authenticated;

create or replace function public.wallet_set_system_freeze(
  p_is_frozen boolean,
  p_reason text,
  p_actor_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_control public.wallet_system_controls%rowtype;
begin
  update public.wallet_system_controls
  set is_frozen = p_is_frozen,
      freeze_reason = case when p_is_frozen then p_reason else null end,
      frozen_at = case when p_is_frozen then now() else null end,
      frozen_by = case when p_is_frozen then p_actor_id else null end,
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
  where key = 'wallet_transactions'
  returning * into v_control;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    'system',
    case when p_is_frozen then 'wallet_system_freeze' else 'wallet_system_unfreeze' end,
    'wallet_system_controls',
    'wallet_transactions',
    jsonb_build_object('reason', p_reason, 'is_frozen', p_is_frozen) || coalesce(p_metadata, '{}'::jsonb)
  );

  return to_jsonb(v_control);
end;
$$;

revoke all on function public.wallet_set_system_freeze(boolean, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.wallet_set_system_freeze(boolean, text, uuid, jsonb) to service_role;

create or replace function public.wallet_run_reconciliation(
  p_reserved_bank_balance bigint default null,
  p_triggered_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_credit bigint;
  v_debit bigint;
  v_ledger_net bigint;
  v_cached bigint;
  v_internal_diff bigint;
  v_bank_diff bigint;
  v_status text;
  v_freeze boolean := false;
begin
  insert into public.wallet_reconciliation_runs (triggered_by)
  values (p_triggered_by)
  returning id into v_run_id;

  select
    coalesce(sum(amount) filter (where direction = 'credit' and status = 'posted'), 0),
    coalesce(sum(amount) filter (where direction = 'debit' and status = 'posted'), 0)
  into v_credit, v_debit
  from public.transaksi_dompet;

  v_ledger_net := v_credit - v_debit;

  select coalesce(sum(saldo), 0)
  into v_cached
  from public.dompet_santri
  where status = 'active';

  v_internal_diff := v_ledger_net - v_cached;
  v_bank_diff := case when p_reserved_bank_balance is null then null else v_ledger_net - p_reserved_bank_balance end;

  if v_internal_diff <> 0 then
    v_status := 'failed';
    v_freeze := true;
    perform public.wallet_set_system_freeze(
      true,
      'wallet_reconciliation_internal_mismatch',
      p_triggered_by,
      jsonb_build_object('run_id', v_run_id, 'difference_internal', v_internal_diff)
    );
  elsif v_bank_diff is not null and v_bank_diff <> 0 then
    v_status := 'settlement_mismatch';
  else
    v_status := 'success';
  end if;

  update public.wallet_reconciliation_runs
  set finished_at = now(),
      status = v_status,
      ledger_net = v_ledger_net,
      cached_balance_total = v_cached,
      reserved_bank_balance = p_reserved_bank_balance,
      difference_internal = v_internal_diff,
      difference_bank = v_bank_diff,
      freeze_triggered = v_freeze,
      details = jsonb_build_object('credit', v_credit, 'debit', v_debit)
  where id = v_run_id;

  return jsonb_build_object(
    'run_id', v_run_id,
    'status', v_status,
    'ledger_net', v_ledger_net,
    'cached_balance_total', v_cached,
    'reserved_bank_balance', p_reserved_bank_balance,
    'difference_internal', v_internal_diff,
    'difference_bank', v_bank_diff,
    'freeze_triggered', v_freeze
  );
end;
$$;

revoke all on function public.wallet_run_reconciliation(bigint, uuid) from public, anon, authenticated;
grant execute on function public.wallet_run_reconciliation(bigint, uuid) to service_role;

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
      status = case when public.kantin_devices.status = 'revoked' then 'revoked' else 'pending' end,
      registered_by = excluded.registered_by,
      registered_at = now(),
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

create or replace function public.wallet_set_kantin_device_status(
  p_device_id text,
  p_status text,
  p_actor_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.kantin_devices%rowtype;
begin
  if p_status not in ('active','suspended','revoked') then
    raise exception 'Invalid kantin device status';
  end if;

  update public.kantin_devices
  set status = p_status,
      approved_by = case when p_status = 'active' then p_actor_id else approved_by end,
      approved_at = case when p_status = 'active' then now() else approved_at end,
      revoked_by = case when p_status = 'revoked' then p_actor_id else revoked_by end,
      revoked_at = case when p_status = 'revoked' then now() else revoked_at end,
      revoke_reason = case when p_status = 'revoked' then p_reason else revoke_reason end
  where device_id = p_device_id
  returning * into v_device;

  if not found then
    raise exception 'Kantin device not found';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    'admin',
    'wallet_set_kantin_device_status',
    'kantin_devices',
    v_device.id::text,
    jsonb_build_object('device_id', p_device_id, 'status', p_status, 'reason', p_reason)
  );

  return to_jsonb(v_device);
end;
$$;

revoke all on function public.wallet_set_kantin_device_status(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_set_kantin_device_status(text, text, uuid, text) to service_role;

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
  v_now_local timestamp;
  v_start_hour int;
  v_end_hour int;
  v_santri_velocity int;
  v_kantin_velocity int;
  v_avg_daily numeric;
  v_multiplier numeric;
  v_actions jsonb := '[]'::jsonb;
begin
  select metadata into v_control
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  v_control := coalesce(v_control, '{}'::jsonb);
  v_now_local := now() at time zone coalesce(v_control->>'operating_timezone', 'Asia/Jakarta');
  v_start_hour := coalesce((v_control->>'operating_start_hour')::int, 6);
  v_end_hour := coalesce((v_control->>'operating_end_hour')::int, 21);
  v_multiplier := coalesce((v_control->>'large_amount_average_multiplier')::numeric, 3);

  if extract(hour from v_now_local)::int < v_start_hour
     or extract(hour from v_now_local)::int >= v_end_hour then
    insert into public.wallet_risk_events (
      severity, santri_nis, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'critical', p_santri_nis, p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'TIME_OUTSIDE_OPERATIONAL_HOURS', 100, 'block',
      jsonb_build_object('local_time', v_now_local, 'start_hour', v_start_hour, 'end_hour', v_end_hour)
    );
    raise exception 'Transaction outside operational hours';
  end if;

  select count(*) into v_santri_velocity
  from public.transaksi_dompet
  where santri_nis = p_santri_nis
    and direction = 'debit'
    and status = 'posted'
    and created_at >= now() - interval '5 minutes';

  if v_santri_velocity >= coalesce((v_control->>'santri_velocity_limit_5m')::int, 3) then
    insert into public.wallet_risk_events (
      severity, santri_nis, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'critical', p_santri_nis, p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'SANTRI_VELOCITY_5M', 95, 'freeze_wallet',
      jsonb_build_object('posted_debits_5m', v_santri_velocity)
    );

    update public.dompet_santri
    set status = 'locked'
    where santri_nis = p_santri_nis;

    raise exception 'Wallet locked by velocity risk rule';
  end if;

  select count(*) into v_kantin_velocity
  from public.wallet_authorization_sessions
  where kantin_user_id = p_kantin_user_id
    and created_at >= now() - interval '10 minutes';

  if v_kantin_velocity >= coalesce((v_control->>'kantin_velocity_limit_10m')::int, 30) then
    insert into public.wallet_risk_events (
      severity, santri_nis, actor_id, device_id, merchant_id, outlet_id,
      rule_code, score, action, details
    ) values (
      'high', p_santri_nis, p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'KANTIN_VELOCITY_10M', 80, 'flag',
      jsonb_build_object('sessions_10m', v_kantin_velocity)
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
      'high', p_santri_nis, p_kantin_user_id, p_device_id, p_merchant_id, p_outlet_id,
      'AMOUNT_ABOVE_BASELINE', 85, 'require_parent_approval',
      jsonb_build_object('amount', p_amount, 'avg_daily', v_avg_daily, 'multiplier', v_multiplier)
    );
    v_actions := v_actions || jsonb_build_array('require_parent_approval');
  end if;

  return jsonb_build_object('status', 'ok', 'actions', v_actions);
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
begin
  select is_frozen into v_is_frozen
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
    return jsonb_build_object(
      'status', 'idempotent_replay',
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
    'requires_authorization',
    p_amount,
    p_kantin_user_id,
    'kantin',
    v_expires_at,
    p_idempotency_key,
    p_merchant_id,
    p_outlet_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('risk', v_risk)
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
    'requires_authorization',
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
    jsonb_build_object('amount', p_amount, 'merchant_id', p_merchant_id, 'outlet_id', p_outlet_id, 'kantin_device_id', v_device_id)
  );

  return jsonb_build_object(
    'status', 'requires_authorization',
    'authorization_session_id', v_session_id,
    'payment_intent_id', v_payment_intent_id,
    'santri_nis', v_wallet.santri_nis,
    'challenge', v_challenge,
    'nonce', v_nonce,
    'expires_at', v_expires_at,
    'amount', p_amount,
    'risk', v_risk
  );
end;
$$;

create or replace function public.wallet_post_transaction(
  p_santri_nis text,
  p_direction public.wallet_direction,
  p_category public.tipe_kategori_transaksi,
  p_amount bigint,
  p_actor_id uuid,
  p_actor_role text,
  p_idempotency_key text,
  p_keterangan text default null,
  p_counterparty_id uuid default null,
  p_counterparty_role text default null,
  p_transaksi_keuangan_id uuid default null,
  p_payment_intent_id uuid default null,
  p_nonce text default null,
  p_signature text default null,
  p_signature_public_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, extensions
as $$
declare
  v_account public.dompet_santri%rowtype;
  v_existing public.transaksi_dompet%rowtype;
  v_current_saldo bigint;
  v_before bigint;
  v_after bigint;
  v_prev_hash text;
  v_hash text;
  v_created_at timestamptz := now();
  v_jenis text;
  v_ledger_id bigint;
  v_role text := lower(coalesce(p_actor_role, ''));
  v_is_frozen boolean := false;
  v_recovery_categories text[] := array['correction','refund','account_migration_in','account_migration_out','settlement_to_pesantren_ledger'];
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_santri_nis is null or length(trim(p_santri_nis)) = 0 then
    raise exception 'santri_nis is required';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then
    raise exception 'A strong idempotency key is required';
  end if;

  if v_role not in ('super_admin','bendahara','rois','dewan','wali','kantin','system','midtrans') then
    raise exception 'Invalid wallet actor role: %', p_actor_role;
  end if;

  select * into v_existing
  from public.transaksi_dompet
  where idempotency_key = p_idempotency_key;

  if found then
    select saldo into v_current_saldo
    from public.dompet_santri
    where santri_nis = v_existing.santri_nis;

    return jsonb_build_object(
      'status', 'idempotent_replay',
      'ledger_id', v_existing.id,
      'saldo', v_current_saldo,
      'original_balance_after', v_existing.balance_after,
      'entry_hash', v_existing.entry_hash
    );
  end if;

  select is_frozen into v_is_frozen
  from public.wallet_system_controls
  where key = 'wallet_transactions';

  if coalesce(v_is_frozen, false) and not (p_category::text = any (v_recovery_categories)) then
    raise exception 'Wallet transactions are frozen by system control';
  end if;

  if p_nonce is not null then
    insert into public.wallet_nonce_uses (nonce, santri_nis, purpose, used_by, expires_at, metadata)
    values (p_nonce, p_santri_nis, p_category::text, p_actor_id, now() + interval '15 minutes', jsonb_build_object('idempotency_key', p_idempotency_key));
  end if;

  insert into public.dompet_santri (santri_nis)
  values (p_santri_nis)
  on conflict (santri_nis) do nothing;

  select * into v_account
  from public.dompet_santri
  where santri_nis = p_santri_nis
  for update;

  if not found then
    raise exception 'Wallet account not found';
  end if;

  if v_account.status <> 'active' then
    raise exception 'Wallet account is not active';
  end if;

  if v_account.single_transaction_limit is not null and p_amount > v_account.single_transaction_limit then
    raise exception 'Transaction exceeds single transaction limit';
  end if;

  v_before := v_account.saldo;

  if p_direction = 'credit' then
    v_after := v_before + p_amount;
    v_jenis := 'masuk';
  elsif p_direction = 'debit' then
    if v_before < p_amount then
      raise exception 'Saldo santri tidak mencukupi untuk transaksi ini.';
    end if;
    v_after := v_before - p_amount;
    v_jenis := 'keluar';
  else
    raise exception 'Invalid direction';
  end if;

  select entry_hash into v_prev_hash
  from public.transaksi_dompet
  where santri_nis = p_santri_nis
  order by id desc
  limit 1;

  v_hash := app_private.wallet_ledger_hash(
    p_santri_nis,
    p_direction::text,
    p_category::text,
    p_amount,
    v_before,
    v_after,
    p_idempotency_key,
    v_prev_hash,
    p_nonce,
    p_signature,
    v_created_at
  );

  perform set_config('app.wallet_mutation', 'on', true);

  update public.dompet_santri
  set saldo = v_after
  where santri_nis = p_santri_nis;

  insert into public.transaksi_dompet (
    created_at,
    posted_at,
    santri_nis,
    direction,
    jenis,
    category,
    kategori_transaksi,
    jenis_transaksi,
    amount,
    nominal,
    balance_before,
    balance_after,
    status,
    actor_id,
    actor_role,
    dicatat_oleh_id,
    counterparty_id,
    counterparty_role,
    transaksi_keuangan_id,
    payment_intent_id,
    idempotency_key,
    nonce,
    signature,
    signature_public_key,
    prev_hash,
    entry_hash,
    keterangan,
    metadata
  ) values (
    v_created_at,
    v_created_at,
    p_santri_nis,
    p_direction,
    v_jenis,
    p_category,
    p_category,
    p_category,
    p_amount,
    p_amount,
    v_before,
    v_after,
    'posted',
    p_actor_id,
    v_role,
    p_actor_id,
    p_counterparty_id,
    p_counterparty_role,
    p_transaksi_keuangan_id,
    p_payment_intent_id,
    p_idempotency_key,
    p_nonce,
    p_signature,
    p_signature_public_key,
    v_prev_hash,
    v_hash,
    p_keterangan,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_ledger_id;

  if p_payment_intent_id is not null then
    update public.wallet_payment_intents
    set status = 'posted', posted_ledger_id = v_ledger_id, updated_at = now()
    where id = p_payment_intent_id;
  end if;

  update public.kantin_devices
  set last_transaction_at = now(), last_seen_at = now()
  where device_id = nullif(p_metadata->>'kantin_device_id', '');

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    v_role,
    'wallet_post_transaction',
    'transaksi_dompet',
    p_santri_nis,
    v_ledger_id::text,
    jsonb_build_object('direction', p_direction, 'category', p_category, 'amount', p_amount, 'balance_before', v_before, 'balance_after', v_after)
  );

  return jsonb_build_object(
    'status', 'posted',
    'ledger_id', v_ledger_id,
    'saldo', v_after,
    'balance_before', v_before,
    'balance_after', v_after,
    'entry_hash', v_hash
  );
end;
$$;

revoke all on function public.wallet_post_transaction(text, public.wallet_direction, public.tipe_kategori_transaksi, bigint, uuid, text, text, text, uuid, text, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.wallet_post_transaction(text, public.wallet_direction, public.tipe_kategori_transaksi, bigint, uuid, text, text, text, uuid, text, uuid, uuid, text, text, text, jsonb) to service_role;

create or replace function public.verify_wallet_ledger_integrity(
  p_santri_nis text,
  p_from_date timestamptz default null
)
returns table (is_valid boolean, broken_at bigint, details text)
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_prev_hash text := null;
  v_expected_hash text;
  v_entry record;
begin
  for v_entry in
    select *
    from public.transaksi_dompet
    where santri_nis = p_santri_nis
      and (p_from_date is null or created_at >= p_from_date)
    order by id asc
  loop
    if v_prev_hash is not null and v_entry.prev_hash is distinct from v_prev_hash then
      return query select false, v_entry.id, 'prev_hash does not match previous entry_hash';
      return;
    end if;

    v_expected_hash := app_private.wallet_ledger_hash(
      v_entry.santri_nis,
      v_entry.direction::text,
      v_entry.category::text,
      v_entry.amount,
      v_entry.balance_before,
      v_entry.balance_after,
      v_entry.idempotency_key,
      v_entry.prev_hash,
      v_entry.nonce,
      v_entry.signature,
      v_entry.created_at
    );

    if v_entry.entry_hash is distinct from v_expected_hash then
      return query select false, v_entry.id, 'entry_hash recompute mismatch';
      return;
    end if;

    v_prev_hash := v_entry.entry_hash;
  end loop;

  return query select true, null::bigint, 'Chain valid';
end;
$$;

revoke all on function public.verify_wallet_ledger_integrity(text, timestamptz) from public, anon, authenticated;
grant execute on function public.verify_wallet_ledger_integrity(text, timestamptz) to service_role;

create or replace function public.wallet_run_ledger_integrity_check(
  p_santri_nis text default null,
  p_from_date timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_wallet record;
  v_result record;
  v_checked bigint := 0;
  v_failed boolean := false;
  v_broken_at bigint;
begin
  insert into public.wallet_ledger_integrity_runs (santri_nis, checked_from)
  values (p_santri_nis, p_from_date)
  returning id into v_run_id;

  for v_wallet in
    select santri_nis
    from public.dompet_santri
    where (p_santri_nis is null or santri_nis = p_santri_nis)
  loop
    v_checked := v_checked + (
      select count(*)
      from public.transaksi_dompet td
      where td.santri_nis = v_wallet.santri_nis
        and (p_from_date is null or td.created_at >= p_from_date)
    );

    select * into v_result
    from public.verify_wallet_ledger_integrity(v_wallet.santri_nis, p_from_date)
    limit 1;

    if not coalesce(v_result.is_valid, true) then
      v_failed := true;
      v_broken_at := v_result.broken_at;

      insert into public.wallet_risk_events (
        severity, santri_nis, rule_code, score, action, details
      ) values (
        'critical',
        v_wallet.santri_nis,
        'LEDGER_HASH_CHAIN_BROKEN',
        100,
        'freeze_system',
        jsonb_build_object('run_id', v_run_id, 'broken_at', v_result.broken_at, 'details', v_result.details)
      );

      perform public.wallet_set_system_freeze(
        true,
        'wallet_ledger_integrity_failed',
        null,
        jsonb_build_object('run_id', v_run_id, 'santri_nis', v_wallet.santri_nis, 'broken_at', v_result.broken_at)
      );

      exit;
    end if;
  end loop;

  update public.wallet_ledger_integrity_runs
  set finished_at = now(),
      status = case when v_failed then 'failed' else 'success' end,
      checked_entries = v_checked,
      broken_at = v_broken_at,
      details = jsonb_build_object('scope', coalesce(p_santri_nis, 'all'))
  where id = v_run_id;

  return jsonb_build_object(
    'run_id', v_run_id,
    'status', case when v_failed then 'failed' else 'success' end,
    'checked_entries', v_checked,
    'broken_at', v_broken_at
  );
end;
$$;

revoke all on function public.wallet_run_ledger_integrity_check(text, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_run_ledger_integrity_check(text, timestamptz) to service_role;

create or replace function public.wallet_open_dispute(
  p_ledger_id bigint,
  p_reported_by uuid,
  p_reason text,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger public.transaksi_dompet%rowtype;
  v_dispute public.wallet_disputes%rowtype;
begin
  select * into v_ledger
  from public.transaksi_dompet
  where id = p_ledger_id;

  if not found then
    raise exception 'Ledger entry not found';
  end if;

  if not exists (
    select 1
    from public.santri s
    where s.nis = v_ledger.santri_nis
      and s.wali_id = p_reported_by
  ) then
    raise exception 'Reporter is not wali for this santri';
  end if;

  if coalesce(length(trim(p_reason)), 0) < 10 then
    raise exception 'Dispute reason is too short';
  end if;

  insert into public.wallet_disputes (
    ledger_id,
    santri_nis,
    reported_by,
    reason,
    evidence
  ) values (
    p_ledger_id,
    v_ledger.santri_nis,
    p_reported_by,
    trim(p_reason),
    coalesce(p_evidence, '{}'::jsonb)
  )
  returning * into v_dispute;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_reported_by,
    'wali',
    'wallet_open_dispute',
    'wallet_disputes',
    v_ledger.santri_nis,
    v_dispute.id::text,
    jsonb_build_object('ledger_id', p_ledger_id)
  );

  return to_jsonb(v_dispute);
end;
$$;

revoke all on function public.wallet_open_dispute(bigint, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.wallet_open_dispute(bigint, uuid, text, jsonb) to service_role;

create or replace function public.wallet_resolve_dispute(
  p_dispute_id uuid,
  p_resolved_by uuid,
  p_status text,
  p_resolution_note text,
  p_reversal_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.wallet_disputes%rowtype;
  v_ledger public.transaksi_dompet%rowtype;
  v_reversal jsonb;
  v_reversal_ledger_id bigint;
begin
  if p_status not in ('resolved_valid','resolved_reversed','rejected','cancelled') then
    raise exception 'Invalid dispute resolution status';
  end if;

  select * into v_dispute
  from public.wallet_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  if v_dispute.status in ('resolved_valid','resolved_reversed','rejected','cancelled') then
    raise exception 'Dispute is already closed';
  end if;

  select * into v_ledger
  from public.transaksi_dompet
  where id = v_dispute.ledger_id;

  if p_status = 'resolved_reversed' then
    if p_reversal_idempotency_key is null or length(trim(p_reversal_idempotency_key)) < 12 then
      raise exception 'A strong reversal idempotency key is required';
    end if;

    if v_ledger.direction <> 'debit' then
      raise exception 'Only debit ledger can be reversed by dispute refund';
    end if;

    v_reversal := public.wallet_post_transaction(
      v_ledger.santri_nis,
      'credit'::public.wallet_direction,
      'refund'::public.tipe_kategori_transaksi,
      v_ledger.amount,
      p_resolved_by,
      'bendahara',
      p_reversal_idempotency_key,
      coalesce(p_resolution_note, 'Dispute reversal'),
      v_ledger.actor_id,
      v_ledger.actor_role,
      null,
      null,
      null,
      null,
      null,
      jsonb_build_object('dispute_id', p_dispute_id, 'reversed_ledger_id', v_ledger.id)
    );

    v_reversal_ledger_id := (v_reversal->>'ledger_id')::bigint;
  end if;

  update public.wallet_disputes
  set status = p_status,
      resolved_by = p_resolved_by,
      resolution_note = p_resolution_note,
      reversal_ledger_id = v_reversal_ledger_id,
      resolved_at = now()
  where id = p_dispute_id
  returning * into v_dispute;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_resolved_by,
    'bendahara',
    'wallet_resolve_dispute',
    'wallet_disputes',
    v_dispute.santri_nis,
    v_dispute.id::text,
    jsonb_build_object('status', p_status, 'reversal_ledger_id', v_reversal_ledger_id)
  );

  return to_jsonb(v_dispute);
end;
$$;

revoke all on function public.wallet_resolve_dispute(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.wallet_resolve_dispute(uuid, uuid, text, text, text) to service_role;
