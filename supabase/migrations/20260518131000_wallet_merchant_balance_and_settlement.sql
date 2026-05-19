create table if not exists public.wallet_merchant_balances (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.wallet_merchants(id) on delete restrict,
  outlet_id uuid references public.wallet_merchant_outlets(id) on delete restrict,
  saldo_available bigint not null default 0 check (saldo_available >= 0),
  saldo_pending_settlement bigint not null default 0 check (saldo_pending_settlement >= 0),
  total_sales bigint not null default 0 check (total_sales >= 0),
  total_settled bigint not null default 0 check (total_settled >= 0),
  updated_at timestamptz not null default now(),
  unique (merchant_id, outlet_id)
);

create table if not exists public.wallet_merchant_ledger (
  id bigserial primary key,
  public_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  merchant_id uuid not null references public.wallet_merchants(id) on delete restrict,
  outlet_id uuid references public.wallet_merchant_outlets(id) on delete restrict,
  direction text not null check (direction in ('credit','debit')),
  category text not null check (category in ('kantin_sale','settlement_request','settlement_paid','settlement_rejected','adjustment','refund')),
  amount bigint not null check (amount > 0),
  balance_available_before bigint not null,
  balance_available_after bigint not null,
  pending_settlement_before bigint not null,
  pending_settlement_after bigint not null,
  santri_ledger_id bigint references public.transaksi_dompet(id) on delete restrict,
  payment_intent_id uuid references public.wallet_payment_intents(id) on delete restrict,
  settlement_request_id uuid,
  idempotency_key text not null unique,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null,
  keterangan text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.wallet_merchant_settlement_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.wallet_merchants(id) on delete restrict,
  outlet_id uuid references public.wallet_merchant_outlets(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check (amount > 0),
  status text not null default 'requested' check (status in ('requested','approved','paid','rejected','cancelled')),
  payout_method text not null default 'pesantren_manual',
  destination_note text,
  requested_ledger_id bigint references public.wallet_merchant_ledger(id),
  paid_ledger_id bigint references public.wallet_merchant_ledger(id),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.wallet_merchant_ledger
  add constraint wallet_merchant_ledger_settlement_request_fk
  foreign key (settlement_request_id)
  references public.wallet_merchant_settlement_requests(id)
  deferrable initially deferred;

alter table public.wallet_merchant_balances enable row level security;
alter table public.wallet_merchant_ledger enable row level security;
alter table public.wallet_merchant_settlement_requests enable row level security;

create index if not exists idx_wallet_merchant_ledger_merchant_created
  on public.wallet_merchant_ledger (merchant_id, outlet_id, created_at desc);
create index if not exists idx_wallet_merchant_settlement_status
  on public.wallet_merchant_settlement_requests (status, created_at desc);

create policy wallet_merchant_balances_assigned_kantin_read
on public.wallet_merchant_balances for select to authenticated
using (
  exists (
    select 1
    from public.wallet_merchant_users wmu
    join public.profiles p on p.id = auth.uid()
    where wmu.profile_id = auth.uid()
      and wmu.merchant_id = wallet_merchant_balances.merchant_id
      and (wmu.outlet_id is null or wmu.outlet_id is not distinct from wallet_merchant_balances.outlet_id)
      and wmu.status = 'active'
      and p.role = 'kantin'
      and coalesce(p.is_active, true)
  )
);

create policy wallet_merchant_balances_admin_read
on public.wallet_merchant_balances for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin','bendahara','rois','dewan')
      and coalesce(p.is_active, true)
  )
);

create policy wallet_merchant_ledger_assigned_kantin_read
on public.wallet_merchant_ledger for select to authenticated
using (
  exists (
    select 1
    from public.wallet_merchant_users wmu
    join public.profiles p on p.id = auth.uid()
    where wmu.profile_id = auth.uid()
      and wmu.merchant_id = wallet_merchant_ledger.merchant_id
      and (wmu.outlet_id is null or wmu.outlet_id is not distinct from wallet_merchant_ledger.outlet_id)
      and wmu.status = 'active'
      and p.role = 'kantin'
      and coalesce(p.is_active, true)
  )
);

create policy wallet_merchant_ledger_admin_read
on public.wallet_merchant_ledger for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin','bendahara','rois','dewan')
      and coalesce(p.is_active, true)
  )
);

create policy wallet_merchant_settlement_assigned_kantin_read
on public.wallet_merchant_settlement_requests for select to authenticated
using (
  exists (
    select 1
    from public.wallet_merchant_users wmu
    join public.profiles p on p.id = auth.uid()
    where wmu.profile_id = auth.uid()
      and wmu.merchant_id = wallet_merchant_settlement_requests.merchant_id
      and (wmu.outlet_id is null or wmu.outlet_id is not distinct from wallet_merchant_settlement_requests.outlet_id)
      and wmu.status = 'active'
      and p.role = 'kantin'
      and coalesce(p.is_active, true)
  )
);

create policy wallet_merchant_settlement_admin_read
on public.wallet_merchant_settlement_requests for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin','bendahara','rois','dewan')
      and coalesce(p.is_active, true)
  )
);

create or replace function public.wallet_post_merchant_ledger(
  p_merchant_id uuid,
  p_outlet_id uuid,
  p_direction text,
  p_category text,
  p_amount bigint,
  p_idempotency_key text,
  p_actor_id uuid default null,
  p_actor_role text default 'system',
  p_santri_ledger_id bigint default null,
  p_payment_intent_id uuid default null,
  p_settlement_request_id uuid default null,
  p_keterangan text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance public.wallet_merchant_balances%rowtype;
  v_existing public.wallet_merchant_ledger%rowtype;
  v_available_before bigint;
  v_available_after bigint;
  v_pending_before bigint;
  v_pending_after bigint;
  v_ledger_id bigint;
begin
  if p_merchant_id is null then raise exception 'merchant_id wajib diisi'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount wajib lebih dari nol'; end if;
  if p_direction not in ('credit','debit') then raise exception 'direction tidak valid'; end if;
  if p_category not in ('kantin_sale','settlement_request','settlement_paid','settlement_rejected','adjustment','refund') then raise exception 'category tidak valid'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then raise exception 'idempotency_key wajib kuat'; end if;

  select * into v_existing from public.wallet_merchant_ledger where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('status', 'idempotent_replay', 'ledger_id', v_existing.id, 'saldo_available', v_existing.balance_available_after, 'saldo_pending_settlement', v_existing.pending_settlement_after);
  end if;

  insert into public.wallet_merchant_balances (merchant_id, outlet_id) values (p_merchant_id, p_outlet_id)
  on conflict (merchant_id, outlet_id) do nothing;

  select * into v_balance
  from public.wallet_merchant_balances
  where merchant_id = p_merchant_id and outlet_id is not distinct from p_outlet_id
  for update;

  v_available_before := v_balance.saldo_available;
  v_pending_before := v_balance.saldo_pending_settlement;
  v_available_after := v_available_before;
  v_pending_after := v_pending_before;

  if p_category = 'kantin_sale' then
    v_available_after := v_available_before + p_amount;
  elsif p_category = 'settlement_request' then
    if v_available_before < p_amount then raise exception 'Saldo kantin tidak cukup untuk pencairan'; end if;
    v_available_after := v_available_before - p_amount;
    v_pending_after := v_pending_before + p_amount;
  elsif p_category = 'settlement_paid' then
    if v_pending_before < p_amount then raise exception 'Saldo pending pencairan tidak cukup'; end if;
    v_pending_after := v_pending_before - p_amount;
  elsif p_category = 'settlement_rejected' then
    if v_pending_before < p_amount then raise exception 'Saldo pending pencairan tidak cukup'; end if;
    v_available_after := v_available_before + p_amount;
    v_pending_after := v_pending_before - p_amount;
  elsif p_direction = 'credit' then
    v_available_after := v_available_before + p_amount;
  else
    if v_available_before < p_amount then raise exception 'Saldo kantin tidak cukup'; end if;
    v_available_after := v_available_before - p_amount;
  end if;

  update public.wallet_merchant_balances
  set saldo_available = v_available_after,
      saldo_pending_settlement = v_pending_after,
      total_sales = total_sales + case when p_category = 'kantin_sale' then p_amount else 0 end,
      total_settled = total_settled + case when p_category = 'settlement_paid' then p_amount else 0 end,
      updated_at = now()
  where id = v_balance.id;

  insert into public.wallet_merchant_ledger (
    merchant_id, outlet_id, direction, category, amount,
    balance_available_before, balance_available_after,
    pending_settlement_before, pending_settlement_after,
    santri_ledger_id, payment_intent_id, settlement_request_id,
    idempotency_key, actor_id, actor_role, keterangan, metadata
  ) values (
    p_merchant_id, p_outlet_id, p_direction, p_category, p_amount,
    v_available_before, v_available_after,
    v_pending_before, v_pending_after,
    p_santri_ledger_id, p_payment_intent_id, p_settlement_request_id,
    trim(p_idempotency_key), p_actor_id, coalesce(nullif(trim(p_actor_role), ''), 'system'), p_keterangan, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_ledger_id;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (p_actor_id, coalesce(nullif(trim(p_actor_role), ''), 'system'), 'wallet_post_merchant_ledger', 'wallet_merchant_ledger', v_ledger_id::text, jsonb_build_object('merchant_id', p_merchant_id, 'outlet_id', p_outlet_id, 'category', p_category, 'amount', p_amount));

  return jsonb_build_object('status', 'posted', 'ledger_id', v_ledger_id, 'saldo_available', v_available_after, 'saldo_pending_settlement', v_pending_after);
end;
$$;

create or replace function public.wallet_credit_merchant_from_posted_intent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger public.transaksi_dompet%rowtype;
begin
  if new.status::text <> 'posted' or new.posted_ledger_id is null or new.merchant_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status::text = 'posted' and old.posted_ledger_id is not distinct from new.posted_ledger_id then
    return new;
  end if;

  select * into v_ledger from public.transaksi_dompet where id = new.posted_ledger_id;

  perform public.wallet_post_merchant_ledger(
    new.merchant_id, new.outlet_id, 'credit', 'kantin_sale', new.amount,
    'merchant-sale:' || new.id::text, new.created_by, 'kantin',
    new.posted_ledger_id, new.id, null,
    'Penjualan kantin dari Dompet Santri',
    jsonb_build_object('santri_nis', new.santri_nis, 'santri_ledger_id', new.posted_ledger_id, 'wallet_entry_hash', v_ledger.entry_hash)
  );

  return new;
end;
$$;

drop trigger if exists trg_wallet_credit_merchant_from_posted_intent on public.wallet_payment_intents;
create trigger trg_wallet_credit_merchant_from_posted_intent
after insert or update of status, posted_ledger_id
on public.wallet_payment_intents
for each row
execute function public.wallet_credit_merchant_from_posted_intent();

create or replace function public.wallet_request_merchant_settlement(
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
  v_actor uuid := auth.uid();
  v_request public.wallet_merchant_settlement_requests%rowtype;
  v_ledger jsonb;
begin
  if v_actor is null then raise exception 'Sesi login tidak valid'; end if;

  if not exists (
    select 1
    from public.profiles p
    join public.wallet_merchant_users wmu on wmu.profile_id = p.id
    where p.id = v_actor
      and p.role = 'kantin'
      and coalesce(p.is_active, true)
      and wmu.merchant_id = p_merchant_id
      and (wmu.outlet_id is null or wmu.outlet_id is not distinct from p_outlet_id)
      and wmu.status = 'active'
      and wmu.merchant_role in ('owner','manager')
  ) then
    raise exception 'Akun kantin tidak berwenang mengajukan pencairan';
  end if;

  insert into public.wallet_merchant_settlement_requests (merchant_id, outlet_id, requested_by, amount, destination_note)
  values (p_merchant_id, p_outlet_id, v_actor, p_amount, nullif(trim(coalesce(p_destination_note, '')), ''))
  returning * into v_request;

  v_ledger := public.wallet_post_merchant_ledger(
    p_merchant_id, p_outlet_id, 'debit', 'settlement_request', p_amount,
    'merchant-settlement-request:' || v_request.id::text, v_actor, 'kantin',
    null, null, v_request.id, 'Pengajuan pencairan saldo kantin',
    jsonb_build_object('destination_note_present', p_destination_note is not null)
  );

  update public.wallet_merchant_settlement_requests
  set requested_ledger_id = (v_ledger->>'ledger_id')::bigint, updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return to_jsonb(v_request) || jsonb_build_object('ledger', v_ledger);
end;
$$;

create or replace function public.wallet_mark_merchant_settlement_paid(
  p_settlement_request_id uuid,
  p_actor_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_request public.wallet_merchant_settlement_requests%rowtype;
  v_ledger jsonb;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id and coalesce(is_active, true);
  if v_actor_role not in ('super_admin','bendahara') then
    raise exception 'Hanya bendahara/super admin yang bisa menandai pencairan dibayar';
  end if;

  select * into v_request from public.wallet_merchant_settlement_requests where id = p_settlement_request_id for update;
  if not found then raise exception 'Pengajuan pencairan tidak ditemukan'; end if;
  if v_request.status not in ('requested','approved') then raise exception 'Status pencairan tidak valid'; end if;

  v_ledger := public.wallet_post_merchant_ledger(
    v_request.merchant_id, v_request.outlet_id, 'debit', 'settlement_paid', v_request.amount,
    'merchant-settlement-paid:' || v_request.id::text, p_actor_id, v_actor_role,
    null, null, v_request.id, 'Pencairan saldo kantin dibayar dari rekening pesantren',
    jsonb_build_object('note_present', p_note is not null)
  );

  update public.wallet_merchant_settlement_requests
  set status = 'paid',
      paid_ledger_id = (v_ledger->>'ledger_id')::bigint,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_note = p_note,
      updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return to_jsonb(v_request) || jsonb_build_object('ledger', v_ledger);
end;
$$;

revoke all on function public.wallet_post_merchant_ledger(uuid, uuid, text, text, bigint, text, uuid, text, bigint, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.wallet_mark_merchant_settlement_paid(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_post_merchant_ledger(uuid, uuid, text, text, bigint, text, uuid, text, bigint, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.wallet_mark_merchant_settlement_paid(uuid, uuid, text) to service_role;
revoke all on function public.wallet_request_merchant_settlement(uuid, uuid, bigint, text) from public, anon;
grant execute on function public.wallet_request_merchant_settlement(uuid, uuid, bigint, text) to authenticated, service_role;
