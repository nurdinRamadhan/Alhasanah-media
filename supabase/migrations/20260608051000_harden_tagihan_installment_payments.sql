create index if not exists idx_pembayaran_tagihan_wali_id
  on public.pembayaran_tagihan (wali_id)
  where wali_id is not null;

create index if not exists idx_pembayaran_tagihan_recorded_by
  on public.pembayaran_tagihan (recorded_by)
  where recorded_by is not null;

drop function if exists public.record_tagihan_payment(uuid, bigint, text, text, text, uuid, text, text, jsonb);

create or replace function public.record_tagihan_payment(
  p_tagihan_id uuid,
  p_amount bigint,
  p_metode_pembayaran text default 'cash',
  p_source text default 'admin_panel',
  p_provider_order_id text default null,
  p_transaksi_id uuid default null,
  p_keterangan text default null,
  p_idempotency_key text default null,
  p_provider_payload jsonb default '{}'::jsonb,
  p_recorded_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_recorded_by);
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

revoke execute on function public.record_tagihan_payment(uuid, bigint, text, text, text, uuid, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.record_tagihan_payment(uuid, bigint, text, text, text, uuid, text, text, jsonb, uuid) to service_role;

revoke execute on function public.set_pembayaran_tagihan_updated_at() from public, anon, authenticated;
revoke execute on function public.tr_sync_tagihan_payment_status() from public, anon, authenticated;
revoke execute on function public.sync_tagihan_payment_status(uuid) from public, anon, authenticated;
grant execute on function public.sync_tagihan_payment_status(uuid) to service_role;
