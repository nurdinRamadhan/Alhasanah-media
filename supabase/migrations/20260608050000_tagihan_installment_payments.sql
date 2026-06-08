-- Production-ready installment ledger for tagihan payments.
-- This keeps tagihan_santri as the invoice table and records every partial
-- payment in pembayaran_tagihan.

alter table public.detail_transaksi
  alter column transaksi_id drop default,
  alter column tagihan_id drop default;

create table if not exists public.pembayaran_tagihan (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tagihan_id uuid not null references public.tagihan_santri(id) on update cascade on delete cascade,
  transaksi_id uuid references public.transaksi_keuangan(id) on update cascade on delete set null,
  santri_nis text not null references public.santri(nis) on update cascade on delete cascade,
  wali_id uuid references public.profiles(id) on delete set null,
  recorded_by uuid references public.profiles(id) on delete set null,
  amount bigint not null check (amount > 0),
  metode_pembayaran text not null default 'cash',
  source text not null default 'admin_panel' check (source in ('admin_panel', 'midtrans', 'system')),
  status text not null default 'posted' check (status in ('pending', 'posted', 'failed', 'cancelled')),
  paid_at timestamptz,
  provider_order_id text,
  provider_payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  keterangan text,
  constraint pembayaran_tagihan_paid_at_required check (status <> 'posted' or paid_at is not null)
);

create unique index if not exists pembayaran_tagihan_provider_order_id_key
  on public.pembayaran_tagihan (provider_order_id)
  where provider_order_id is not null;

create unique index if not exists pembayaran_tagihan_idempotency_key_key
  on public.pembayaran_tagihan (idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_pembayaran_tagihan_tagihan_status
  on public.pembayaran_tagihan (tagihan_id, status, paid_at desc);

create index if not exists idx_pembayaran_tagihan_santri_paid_at
  on public.pembayaran_tagihan (santri_nis, paid_at desc);

create index if not exists idx_pembayaran_tagihan_transaksi_id
  on public.pembayaran_tagihan (transaksi_id)
  where transaksi_id is not null;

create or replace function public.set_pembayaran_tagihan_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pembayaran_tagihan_updated_at on public.pembayaran_tagihan;
create trigger trg_pembayaran_tagihan_updated_at
before update on public.pembayaran_tagihan
for each row execute function public.set_pembayaran_tagihan_updated_at();

create or replace function public.sync_tagihan_payment_status(p_tagihan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nominal bigint;
  v_paid bigint;
  v_sisa bigint;
  v_status text;
begin
  select coalesce(nominal_tagihan, 0)
    into v_nominal
  from public.tagihan_santri
  where id = p_tagihan_id
  for update;

  if not found then
    return;
  end if;

  select coalesce(sum(amount), 0)
    into v_paid
  from public.pembayaran_tagihan
  where tagihan_id = p_tagihan_id
    and status = 'posted';

  v_sisa := greatest(v_nominal - v_paid, 0);
  v_status := case
    when v_sisa = 0 and v_nominal > 0 then 'LUNAS'
    when v_paid > 0 then 'CICILAN'
    else 'BELUM'
  end;

  update public.tagihan_santri
  set sisa_tagihan = v_sisa,
      status = v_status,
      updated_at = now()
  where id = p_tagihan_id;
end;
$$;

create or replace function public.tr_sync_tagihan_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_tagihan_payment_status(coalesce(new.tagihan_id, old.tagihan_id));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_pembayaran_tagihan_status on public.pembayaran_tagihan;
create trigger trg_sync_pembayaran_tagihan_status
after insert or update or delete on public.pembayaran_tagihan
for each row execute function public.tr_sync_tagihan_payment_status();

create or replace function public.record_tagihan_payment(
  p_tagihan_id uuid,
  p_amount bigint,
  p_metode_pembayaran text default 'cash',
  p_source text default 'admin_panel',
  p_provider_order_id text default null,
  p_transaksi_id uuid default null,
  p_keterangan text default null,
  p_idempotency_key text default null,
  p_provider_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
  v_profile_role text;
  v_tagihan public.tagihan_santri%rowtype;
  v_wali_id uuid;
  v_remaining bigint;
  v_payment_id uuid;
  v_transaksi_id uuid := p_transaksi_id;
  v_existing public.pembayaran_tagihan%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal pembayaran harus lebih dari 0.';
  end if;

  if p_source not in ('admin_panel', 'midtrans', 'system') then
    raise exception 'Sumber pembayaran tidak valid.';
  end if;

  select role
    into v_profile_role
  from public.profiles
  where id = v_actor;

  if p_source = 'admin_panel' then
    if v_profile_role not in ('super_admin', 'bendahara') then
      raise exception 'Anda tidak berwenang mencatat pembayaran tagihan.';
    end if;
  elsif p_source in ('midtrans', 'system') then
    if v_auth_role <> 'service_role' and v_profile_role not in ('super_admin', 'bendahara') then
      raise exception 'Sumber pembayaran sistem hanya boleh diproses backend.';
    end if;
  end if;

  if p_idempotency_key is not null then
    select *
      into v_existing
    from public.pembayaran_tagihan
    where idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return jsonb_build_object(
        'payment_id', v_existing.id,
        'transaksi_id', v_existing.transaksi_id,
        'idempotent', true
      );
    end if;
  end if;

  if p_provider_order_id is not null then
    select *
      into v_existing
    from public.pembayaran_tagihan
    where provider_order_id = p_provider_order_id
    limit 1;

    if found then
      return jsonb_build_object(
        'payment_id', v_existing.id,
        'transaksi_id', v_existing.transaksi_id,
        'idempotent', true
      );
    end if;
  end if;

  select *
    into v_tagihan
  from public.tagihan_santri
  where id = p_tagihan_id
  for update;

  if not found then
    raise exception 'Tagihan tidak ditemukan.';
  end if;

  select wali_id
    into v_wali_id
  from public.santri
  where nis = v_tagihan.santri_nis;

  select greatest(coalesce(v_tagihan.nominal_tagihan, 0) - coalesce(sum(amount), 0), 0)
    into v_remaining
  from public.pembayaran_tagihan
  where tagihan_id = p_tagihan_id
    and status = 'posted';

  if v_remaining <= 0 then
    raise exception 'Tagihan sudah lunas.';
  end if;

  if p_amount > v_remaining then
    raise exception 'Nominal pembayaran melebihi sisa tagihan.';
  end if;

  if v_transaksi_id is null then
    insert into public.transaksi_keuangan (
      wali_id,
      admin_pencatat_id,
      santri_nis,
      jumlah,
      tanggal_transaksi,
      waktu_bayar_sukses,
      status_transaksi,
      status,
      metode_pembayaran,
      jenis_transaksi,
      kategori,
      midtrans_order_id,
      keterangan
    ) values (
      case when p_source = 'midtrans' then v_wali_id else null end,
      case when p_source = 'admin_panel' then v_actor else null end,
      v_tagihan.santri_nis,
      p_amount,
      now(),
      now(),
      case when p_source = 'midtrans' then 'settlement' else 'success' end,
      'success',
      p_metode_pembayaran,
      'masuk',
      'tagihan',
      p_provider_order_id,
      coalesce(p_keterangan, '[TAGIHAN] Pembayaran ' || v_tagihan.deskripsi_tagihan)
    )
    returning id into v_transaksi_id;
  else
    update public.transaksi_keuangan
    set status_transaksi = case when p_source = 'midtrans' then 'settlement' else 'success' end,
        status = 'success',
        metode_pembayaran = p_metode_pembayaran,
        waktu_bayar_sukses = coalesce(waktu_bayar_sukses, now()),
        kategori = coalesce(kategori, 'tagihan'),
        keterangan = coalesce(keterangan, p_keterangan)
    where id = v_transaksi_id;
  end if;

  insert into public.detail_transaksi (
    transaksi_id,
    tagihan_id,
    nominal_dialokasikan
  ) values (
    v_transaksi_id,
    p_tagihan_id,
    p_amount
  );

  insert into public.pembayaran_tagihan (
    tagihan_id,
    transaksi_id,
    santri_nis,
    wali_id,
    recorded_by,
    amount,
    metode_pembayaran,
    source,
    status,
    paid_at,
    provider_order_id,
    provider_payload,
    idempotency_key,
    keterangan
  ) values (
    p_tagihan_id,
    v_transaksi_id,
    v_tagihan.santri_nis,
    v_wali_id,
    case when p_source = 'admin_panel' then v_actor else null end,
    p_amount,
    p_metode_pembayaran,
    p_source,
    'posted',
    now(),
    p_provider_order_id,
    coalesce(p_provider_payload, '{}'::jsonb),
    p_idempotency_key,
    p_keterangan
  )
  returning id into v_payment_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'transaksi_id', v_transaksi_id,
    'idempotent', false
  );
end;
$$;

-- The old status-change trigger creates a full cash transaction when a bill
-- becomes LUNAS. Installment payments now create transaction rows explicitly.
drop trigger if exists trg_sync_tagihan on public.tagihan_santri;

alter table public.pembayaran_tagihan enable row level security;

drop policy if exists "Finance admins read installment payments" on public.pembayaran_tagihan;
create policy "Finance admins read installment payments"
on public.pembayaran_tagihan
for select
to authenticated
using (public.is_admin_in_roles(array['super_admin', 'bendahara']));

drop policy if exists "Finance admins manage installment payments" on public.pembayaran_tagihan;
create policy "Finance admins manage installment payments"
on public.pembayaran_tagihan
for all
to authenticated
using (public.is_admin_in_roles(array['super_admin', 'bendahara']))
with check (public.is_admin_in_roles(array['super_admin', 'bendahara']));

drop policy if exists "Wali can view own installment payments" on public.pembayaran_tagihan;
create policy "Wali can view own installment payments"
on public.pembayaran_tagihan
for select
to authenticated
using (
  exists (
    select 1
    from public.santri s
    where s.nis = pembayaran_tagihan.santri_nis
      and s.wali_id = auth.uid()
  )
);

grant select, insert, update, delete on table public.pembayaran_tagihan to authenticated;
grant select, insert, update, delete on table public.pembayaran_tagihan to service_role;
revoke execute on function public.record_tagihan_payment(uuid, bigint, text, text, text, uuid, text, text, jsonb) from public, anon;
grant execute on function public.record_tagihan_payment(uuid, bigint, text, text, text, uuid, text, text, jsonb) to authenticated, service_role;

revoke execute on function public.sync_tagihan_payment_status(uuid) from public, anon;
grant execute on function public.sync_tagihan_payment_status(uuid) to service_role;
