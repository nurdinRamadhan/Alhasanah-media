begin;

create schema if not exists keuangan_internal;

-- Keep this schema private. Application access should go through public tables,
-- RLS select policies, and audited service-role functions/triggers.
revoke all on schema keuangan_internal from public, anon, authenticated;
grant usage on schema keuangan_internal to authenticated, service_role;

create or replace function keuangan_internal.current_profile()
returns table (
  id uuid,
  role text,
  akses_gender text,
  akses_jurusan text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    lower(coalesce(p.role, '')) as role,
    upper(coalesce(p.akses_gender, 'ALL')) as akses_gender,
    upper(coalesce(p.akses_jurusan, 'ALL')) as akses_jurusan
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.is_active, true) is true
  limit 1;
$$;

create or replace function keuangan_internal.petugas_keuangan_memiliki_akses(
  p_scope_gender text,
  p_scope_jurusan text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select
      cp.role in ('super_admin', 'bendahara', 'rois', 'dewan')
      and (
        cp.role in ('super_admin', 'rois', 'dewan')
        or (
          (cp.akses_gender = 'ALL' or cp.akses_gender = upper(coalesce(nullif(p_scope_gender, ''), 'ALL')))
          and
          (cp.akses_jurusan = 'ALL' or cp.akses_jurusan = upper(coalesce(nullif(p_scope_jurusan, ''), 'ALL')))
        )
      )
    from keuangan_internal.current_profile() cp
  ), false);
$$;

create or replace function keuangan_internal.petugas_keuangan_boleh_kelola(
  p_scope_gender text,
  p_scope_jurusan text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select
      cp.role in ('super_admin', 'bendahara', 'rois')
      and (
        cp.role in ('super_admin', 'rois')
        or (
          (cp.akses_gender = 'ALL' or cp.akses_gender = upper(coalesce(nullif(p_scope_gender, ''), 'ALL')))
          and
          (cp.akses_jurusan = 'ALL' or cp.akses_jurusan = upper(coalesce(nullif(p_scope_jurusan, ''), 'ALL')))
        )
      )
    from keuangan_internal.current_profile() cp
  ), false);
$$;

create table if not exists public.saldo_dana (
  id bigint generated always as identity primary key,
  jenis_pembayaran_id bigint not null references public.ref_jenis_pembayaran(id) on update cascade on delete restrict,
  scope_gender text not null default 'ALL',
  scope_jurusan text not null default 'ALL',
  saldo_tersedia bigint not null default 0,
  total_masuk bigint not null default 0,
  total_keluar bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saldo_dana_unik unique (jenis_pembayaran_id, scope_gender, scope_jurusan),
  constraint saldo_dana_scope_gender_chk check (scope_gender in ('L', 'P', 'ALL')),
  constraint saldo_dana_scope_jurusan_chk check (scope_jurusan in ('TAHFIDZ', 'KITAB', 'ALL')),
  constraint saldo_dana_nonneg_chk check (saldo_tersedia >= 0 and total_masuk >= 0 and total_keluar >= 0),
  constraint saldo_dana_total_chk check (saldo_tersedia = total_masuk - total_keluar)
);

create table if not exists public.mutasi_dana (
  id bigint generated always as identity primary key,
  saldo_dana_id bigint not null references public.saldo_dana(id) on update cascade on delete restrict,
  tipe_mutasi text not null,
  nominal bigint not null,
  saldo_sebelum bigint not null,
  saldo_sesudah bigint not null,
  pembayaran_tagihan_id uuid null references public.pembayaran_tagihan(id) on update cascade on delete restrict,
  transaksi_keuangan_id uuid null references public.transaksi_keuangan(id) on update cascade on delete restrict,
  pengeluaran_id bigint null references public.pengeluaran(id) on update cascade on delete restrict,
  idempotency_key text not null,
  keterangan text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  constraint mutasi_dana_tipe_chk check (tipe_mutasi in ('MASUK', 'KELUAR', 'KOREKSI_MASUK', 'KOREKSI_KELUAR')),
  constraint mutasi_dana_nominal_chk check (nominal > 0),
  constraint mutasi_dana_saldo_chk check (saldo_sebelum >= 0 and saldo_sesudah >= 0),
  constraint mutasi_dana_arithmetic_chk check (
    (tipe_mutasi in ('MASUK', 'KOREKSI_MASUK') and saldo_sesudah = saldo_sebelum + nominal)
    or
    (tipe_mutasi in ('KELUAR', 'KOREKSI_KELUAR') and saldo_sesudah = saldo_sebelum - nominal)
  ),
  constraint mutasi_dana_one_source_chk check (
    num_nonnulls(pembayaran_tagihan_id, pengeluaran_id) = 1
    or tipe_mutasi in ('KOREKSI_MASUK', 'KOREKSI_KELUAR')
  )
);

alter table public.pengeluaran
  add column if not exists jenis_pembayaran_id bigint null;

alter table public.pengeluaran
  add column if not exists scope_gender text;

alter table public.pengeluaran
  add column if not exists scope_jurusan text;

update public.pengeluaran
set scope_gender = case upper(coalesce(nullif(btrim(scope_gender), ''), 'ALL'))
  when 'L' then 'L'
  when 'P' then 'P'
  else 'ALL'
end;

update public.pengeluaran
set scope_jurusan = case upper(coalesce(nullif(btrim(scope_jurusan), ''), 'ALL'))
  when 'TAHFIDZ' then 'TAHFIDZ'
  when 'KITAB' then 'KITAB'
  else 'ALL'
end;

alter table public.pengeluaran
  alter column scope_gender set default 'ALL',
  alter column scope_gender set not null,
  alter column scope_jurusan set default 'ALL',
  alter column scope_jurusan set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pengeluaran_scope_gender_chk'
      and conrelid = 'public.pengeluaran'::regclass
  ) then
    alter table public.pengeluaran
      add constraint pengeluaran_scope_gender_chk
      check (scope_gender in ('ALL', 'L', 'P'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pengeluaran_scope_jurusan_chk'
      and conrelid = 'public.pengeluaran'::regclass
  ) then
    alter table public.pengeluaran
      add constraint pengeluaran_scope_jurusan_chk
      check (scope_jurusan in ('ALL', 'TAHFIDZ', 'KITAB'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pengeluaran_jenis_pembayaran_id_fkey'
      and conrelid = 'public.pengeluaran'::regclass
  ) then
    alter table public.pengeluaran
      add constraint pengeluaran_jenis_pembayaran_id_fkey
      foreign key (jenis_pembayaran_id)
      references public.ref_jenis_pembayaran(id)
      on update cascade
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists mutasi_dana_idempotency_key_unik
  on public.mutasi_dana (idempotency_key);

create unique index if not exists mutasi_dana_pembayaran_tagihan_unik
  on public.mutasi_dana (pembayaran_tagihan_id)
  where pembayaran_tagihan_id is not null;

create unique index if not exists mutasi_dana_pengeluaran_unik
  on public.mutasi_dana (pengeluaran_id)
  where pengeluaran_id is not null;

create index if not exists mutasi_dana_saldo_dana_created_at_idx
  on public.mutasi_dana (saldo_dana_id, created_at desc);

create index if not exists mutasi_dana_transaksi_keuangan_idx
  on public.mutasi_dana (transaksi_keuangan_id)
  where transaksi_keuangan_id is not null;

create index if not exists saldo_dana_jenis_scope_idx
  on public.saldo_dana (jenis_pembayaran_id, scope_gender, scope_jurusan);

create index if not exists pengeluaran_jenis_pembayaran_scope_idx
  on public.pengeluaran (jenis_pembayaran_id, scope_gender, scope_jurusan)
  where jenis_pembayaran_id is not null;

alter table public.saldo_dana enable row level security;
alter table public.mutasi_dana enable row level security;

drop policy if exists saldo_dana_select_petugas on public.saldo_dana;
create policy saldo_dana_select_petugas
on public.saldo_dana
for select
to authenticated
using (keuangan_internal.petugas_keuangan_memiliki_akses(scope_gender, scope_jurusan));

drop policy if exists mutasi_dana_select_petugas on public.mutasi_dana;
create policy mutasi_dana_select_petugas
on public.mutasi_dana
for select
to authenticated
using (
  exists (
    select 1
    from public.saldo_dana sd
    where sd.id = mutasi_dana.saldo_dana_id
      and keuangan_internal.petugas_keuangan_memiliki_akses(sd.scope_gender, sd.scope_jurusan)
  )
);

revoke all on table public.saldo_dana from public, anon, authenticated;
revoke all on table public.mutasi_dana from public, anon, authenticated;

grant select on table public.saldo_dana to authenticated, service_role;
grant select on table public.mutasi_dana to authenticated, service_role;
grant all on table public.saldo_dana to service_role;
grant all on table public.mutasi_dana to service_role;
grant usage, select on sequence public.saldo_dana_id_seq to service_role;
grant usage, select on sequence public.mutasi_dana_id_seq to service_role;

create or replace function keuangan_internal.normalisasi_scope_gender(p_value text)
returns text
language sql
immutable
set search_path = pg_temp
as $$
  select case upper(coalesce(nullif(trim(p_value), ''), 'ALL'))
    when 'L' then 'L'
    when 'P' then 'P'
    else 'ALL'
  end;
$$;

create or replace function keuangan_internal.normalisasi_scope_jurusan(p_value text)
returns text
language sql
immutable
set search_path = pg_temp
as $$
  select case upper(coalesce(nullif(trim(p_value), ''), 'ALL'))
    when 'TAHFIDZ' then 'TAHFIDZ'
    when 'KITAB' then 'KITAB'
    else 'ALL'
  end;
$$;

create or replace function keuangan_internal.ambil_atau_buat_saldo_dana(
  p_jenis_pembayaran_id bigint,
  p_scope_gender text,
  p_scope_jurusan text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_saldo_dana_id bigint;
begin
  if p_jenis_pembayaran_id is null then
    raise exception 'jenis_pembayaran_id wajib diisi.';
  end if;

  insert into public.saldo_dana (
    jenis_pembayaran_id,
    scope_gender,
    scope_jurusan
  )
  values (
    p_jenis_pembayaran_id,
    keuangan_internal.normalisasi_scope_gender(p_scope_gender),
    keuangan_internal.normalisasi_scope_jurusan(p_scope_jurusan)
  )
  on conflict (jenis_pembayaran_id, scope_gender, scope_jurusan)
  do update set updated_at = public.saldo_dana.updated_at
  returning id into v_saldo_dana_id;

  return v_saldo_dana_id;
end;
$$;

create or replace function keuangan_internal.post_mutasi_dana(
  p_jenis_pembayaran_id bigint,
  p_scope_gender text,
  p_scope_jurusan text,
  p_tipe_mutasi text,
  p_nominal bigint,
  p_pembayaran_tagihan_id uuid,
  p_transaksi_keuangan_id uuid,
  p_pengeluaran_id bigint,
  p_idempotency_key text,
  p_keterangan text,
  p_metadata jsonb,
  p_created_by uuid,
  p_created_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_saldo_dana_id bigint;
  v_saldo_sebelum bigint;
  v_saldo_sesudah bigint;
  v_mutasi_id bigint;
  v_tipe text := upper(coalesce(p_tipe_mutasi, ''));
  v_scope_gender text := keuangan_internal.normalisasi_scope_gender(p_scope_gender);
  v_scope_jurusan text := keuangan_internal.normalisasi_scope_jurusan(p_scope_jurusan);
begin
  if p_nominal is null or p_nominal <= 0 then
    raise exception 'Nominal mutasi dana harus lebih besar dari 0.';
  end if;

  if v_tipe not in ('MASUK', 'KELUAR', 'KOREKSI_MASUK', 'KOREKSI_KELUAR') then
    raise exception 'Tipe mutasi dana tidak valid: %', p_tipe_mutasi;
  end if;

  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'idempotency_key wajib diisi.';
  end if;

  select md.id
    into v_mutasi_id
  from public.mutasi_dana md
  where md.idempotency_key = p_idempotency_key
  limit 1;

  if found then
    return v_mutasi_id;
  end if;

  v_saldo_dana_id := keuangan_internal.ambil_atau_buat_saldo_dana(
    p_jenis_pembayaran_id,
    v_scope_gender,
    v_scope_jurusan
  );

  select sd.saldo_tersedia
    into v_saldo_sebelum
  from public.saldo_dana sd
  where sd.id = v_saldo_dana_id
  for update;

  if v_tipe in ('MASUK', 'KOREKSI_MASUK') then
    v_saldo_sesudah := v_saldo_sebelum + p_nominal;
  else
    if v_saldo_sebelum < p_nominal then
      raise exception 'Saldo dana tidak mencukupi. Saldo=% Nominal=%', v_saldo_sebelum, p_nominal;
    end if;
    v_saldo_sesudah := v_saldo_sebelum - p_nominal;
  end if;

  insert into public.mutasi_dana (
    saldo_dana_id,
    tipe_mutasi,
    nominal,
    saldo_sebelum,
    saldo_sesudah,
    pembayaran_tagihan_id,
    transaksi_keuangan_id,
    pengeluaran_id,
    idempotency_key,
    keterangan,
    metadata,
    created_by,
    created_at
  )
  values (
    v_saldo_dana_id,
    v_tipe,
    p_nominal,
    v_saldo_sebelum,
    v_saldo_sesudah,
    p_pembayaran_tagihan_id,
    p_transaksi_keuangan_id,
    p_pengeluaran_id,
    p_idempotency_key,
    p_keterangan,
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by,
    coalesce(p_created_at, now())
  )
  on conflict (idempotency_key) do nothing
  returning id into v_mutasi_id;

  if v_mutasi_id is null then
    select md.id
      into v_mutasi_id
    from public.mutasi_dana md
    where md.idempotency_key = p_idempotency_key
    limit 1;

    return v_mutasi_id;
  end if;

  perform set_config('app.saldo_dana.allow_balance_update', 'on', true);

  update public.saldo_dana
  set
    saldo_tersedia = v_saldo_sesudah,
    total_masuk = total_masuk + case when v_tipe in ('MASUK', 'KOREKSI_MASUK') then p_nominal else 0 end,
    total_keluar = total_keluar + case when v_tipe in ('KELUAR', 'KOREKSI_KELUAR') then p_nominal else 0 end,
    updated_at = now()
  where id = v_saldo_dana_id;

  perform set_config('app.saldo_dana.allow_balance_update', '', true);

  return v_mutasi_id;
end;
$$;

create or replace function keuangan_internal.tandai_pembayaran_tagihan_ke_saldo_dana()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_jenis_pembayaran_id bigint;
  v_scope_gender text;
  v_scope_jurusan text;
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1
      from public.mutasi_dana md
      where md.pembayaran_tagihan_id = old.id
    ) then
      raise exception 'Pembayaran tagihan sudah diposting ke saldo_dana dan tidak boleh dihapus.';
    end if;
    return old;
  end if;

  if lower(coalesce(new.status, '')) <> 'posted' then
    return new;
  end if;

  if tg_op = 'UPDATE' and exists (
    select 1
    from public.mutasi_dana md
    where md.pembayaran_tagihan_id = new.id
  ) then
    if coalesce(old.amount, 0) <> coalesce(new.amount, 0)
       or coalesce(old.tagihan_id, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(new.tagihan_id, '00000000-0000-0000-0000-000000000000'::uuid)
       or coalesce(old.santri_nis, '') <> coalesce(new.santri_nis, '')
       or coalesce(lower(old.status), '') <> coalesce(lower(new.status), '') then
      raise exception 'Pembayaran tagihan sudah diposting ke saldo_dana. Perubahan langsung tidak diizinkan; gunakan koreksi.';
    end if;
    return new;
  end if;

  select
    t.jenis_pembayaran_id,
    s.jenis_kelamin::text,
    s.jurusan::text
  into
    v_jenis_pembayaran_id,
    v_scope_gender,
    v_scope_jurusan
  from public.tagihan_santri t
  join public.santri s on s.nis = t.santri_nis
  where t.id = new.tagihan_id;

  if v_jenis_pembayaran_id is null then
    raise exception 'Jenis pembayaran tidak ditemukan untuk tagihan_id=%', new.tagihan_id;
  end if;

  perform keuangan_internal.post_mutasi_dana(
    v_jenis_pembayaran_id,
    v_scope_gender,
    v_scope_jurusan,
    'MASUK',
    new.amount,
    new.id,
    new.transaksi_id,
    null,
    'pembayaran_tagihan:' || new.id::text,
    coalesce(new.keterangan, 'Pembayaran tagihan santri'),
    jsonb_build_object(
      'tagihan_id', new.tagihan_id,
      'santri_nis', new.santri_nis,
      'source', new.source,
      'metode_pembayaran', new.metode_pembayaran,
      'provider_order_id', new.provider_order_id
    ),
    new.recorded_by,
    coalesce(new.paid_at, new.created_at, now())
  );

  return new;
end;
$$;

drop trigger if exists tg_pembayaran_tagihan_ke_saldo_dana on public.pembayaran_tagihan;
create trigger tg_pembayaran_tagihan_ke_saldo_dana
after insert or update of status, amount, tagihan_id, transaksi_id, santri_nis, paid_at, keterangan
on public.pembayaran_tagihan
for each row
execute function keuangan_internal.tandai_pembayaran_tagihan_ke_saldo_dana();

drop trigger if exists tg_pembayaran_tagihan_delete_saldo_dana on public.pembayaran_tagihan;
create trigger tg_pembayaran_tagihan_delete_saldo_dana
before delete on public.pembayaran_tagihan
for each row
execute function keuangan_internal.tandai_pembayaran_tagihan_ke_saldo_dana();

create or replace function keuangan_internal.record_pengeluaran_dana(
  p_judul text,
  p_kategori text,
  p_nominal bigint,
  p_tanggal_pengeluaran date,
  p_jenis_pembayaran_id bigint,
  p_scope_gender text default 'ALL',
  p_scope_jurusan text default 'ALL',
  p_keterangan text default null,
  p_bukti_url text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_scope_gender text := keuangan_internal.normalisasi_scope_gender(p_scope_gender);
  v_scope_jurusan text := keuangan_internal.normalisasi_scope_jurusan(p_scope_jurusan);
  v_pengeluaran_id bigint;
  v_mutasi_id bigint;
  v_existing public.pengeluaran%rowtype;
  v_idempotency_key text := coalesce(nullif(trim(p_idempotency_key), ''), null);
begin
  if v_actor is null then
    raise exception 'Sesi login tidak ditemukan.';
  end if;

  if not keuangan_internal.petugas_keuangan_boleh_kelola(v_scope_gender, v_scope_jurusan) then
    raise exception 'Anda tidak berwenang mencatat pengeluaran untuk scope ini.';
  end if;

  if p_jenis_pembayaran_id is null then
    raise exception 'Dana pengeluaran wajib dipilih.';
  end if;

  if p_nominal is null or p_nominal <= 0 then
    raise exception 'Nominal pengeluaran harus lebih besar dari 0.';
  end if;

  if nullif(trim(coalesce(p_judul, '')), '') is null then
    raise exception 'Judul pengeluaran wajib diisi.';
  end if;

  if nullif(trim(coalesce(p_kategori, '')), '') is null then
    raise exception 'Kategori pengeluaran wajib diisi.';
  end if;

  if v_idempotency_key is not null then
    select p.*
      into v_existing
    from public.pengeluaran p
    join public.mutasi_dana md on md.pengeluaran_id = p.id
    where md.idempotency_key = 'pengeluaran:' || v_idempotency_key
    limit 1;

    if found then
      return jsonb_build_object(
        'pengeluaran_id', v_existing.id,
        'idempotent', true
      );
    end if;
  end if;

  perform set_config('app.saldo_dana.skip_pengeluaran_trigger', 'on', true);

  insert into public.pengeluaran (
    judul,
    kategori,
    nominal,
    tanggal_pengeluaran,
    keterangan,
    bukti_url,
    dicatat_oleh_id,
    dicatat_oleh_nama,
    scope_gender,
    scope_jurusan,
    jenis_pembayaran_id
  )
  select
    trim(p_judul),
    upper(trim(p_kategori)),
    p_nominal,
    coalesce(p_tanggal_pengeluaran, current_date),
    p_keterangan,
    p_bukti_url,
    v_actor,
    p.full_name,
    v_scope_gender,
    v_scope_jurusan,
    p_jenis_pembayaran_id
  from public.profiles p
  where p.id = v_actor
  returning id into v_pengeluaran_id;

  perform set_config('app.saldo_dana.skip_pengeluaran_trigger', '', true);

  if v_pengeluaran_id is null then
    raise exception 'Profil pencatat pengeluaran tidak ditemukan.';
  end if;

  v_mutasi_id := keuangan_internal.post_mutasi_dana(
    p_jenis_pembayaran_id,
    v_scope_gender,
    v_scope_jurusan,
    'KELUAR',
    p_nominal,
    null,
    null,
    v_pengeluaran_id,
    'pengeluaran:' || coalesce(v_idempotency_key, v_pengeluaran_id::text),
    coalesce(p_keterangan, trim(p_judul)),
    jsonb_build_object(
      'kategori', upper(trim(p_kategori)),
      'tanggal_pengeluaran', coalesce(p_tanggal_pengeluaran, current_date),
      'bukti_url', p_bukti_url
    ),
    v_actor,
    now()
  );

  return jsonb_build_object(
    'pengeluaran_id', v_pengeluaran_id,
    'mutasi_dana_id', v_mutasi_id,
    'idempotent', false
  );
end;
$$;

create or replace function public.record_pengeluaran_dana(
  p_judul text,
  p_kategori text,
  p_nominal bigint,
  p_tanggal_pengeluaran date,
  p_jenis_pembayaran_id bigint,
  p_scope_gender text default 'ALL',
  p_scope_jurusan text default 'ALL',
  p_keterangan text default null,
  p_bukti_url text default null,
  p_idempotency_key text default null
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select keuangan_internal.record_pengeluaran_dana(
    p_judul,
    p_kategori,
    p_nominal,
    p_tanggal_pengeluaran,
    p_jenis_pembayaran_id,
    p_scope_gender,
    p_scope_jurusan,
    p_keterangan,
    p_bukti_url,
    p_idempotency_key
  );
$$;

create or replace function keuangan_internal.tandai_pengeluaran_ke_saldo_dana()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sudah_diposting boolean;
  v_scope_gender text;
  v_scope_jurusan text;
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1
      from public.mutasi_dana md
      where md.pengeluaran_id = old.id
    ) then
      raise exception 'Pengeluaran sudah diposting ke saldo_dana dan tidak boleh dihapus; gunakan koreksi.';
    end if;
    return old;
  end if;

  select exists (
    select 1
    from public.mutasi_dana md
    where md.pengeluaran_id = new.id
  )
  into v_sudah_diposting;

  if tg_op = 'UPDATE' and v_sudah_diposting then
    if coalesce(old.nominal, 0) <> coalesce(new.nominal, 0)
       or coalesce(old.kategori, '') <> coalesce(new.kategori, '')
       or coalesce(old.jenis_pembayaran_id, 0) <> coalesce(new.jenis_pembayaran_id, 0)
       or coalesce(upper(old.scope_gender), 'ALL') <> coalesce(upper(new.scope_gender), 'ALL')
       or coalesce(upper(old.scope_jurusan), 'ALL') <> coalesce(upper(new.scope_jurusan), 'ALL') then
      raise exception 'Pengeluaran yang sudah diposting tidak boleh diubah langsung; gunakan koreksi.';
    end if;
    return new;
  end if;

  if new.jenis_pembayaran_id is null then
    raise exception 'Dana pengeluaran wajib dipilih melalui jenis_pembayaran_id.';
  end if;

  if current_setting('app.saldo_dana.skip_pengeluaran_trigger', true) = 'on' then
    return new;
  end if;

  v_scope_gender := keuangan_internal.normalisasi_scope_gender(new.scope_gender);
  v_scope_jurusan := keuangan_internal.normalisasi_scope_jurusan(new.scope_jurusan);

  perform keuangan_internal.post_mutasi_dana(
    new.jenis_pembayaran_id,
    v_scope_gender,
    v_scope_jurusan,
    'KELUAR',
    coalesce(new.nominal, 0)::bigint,
    null,
    null,
    new.id,
    'pengeluaran:' || new.id::text,
    coalesce(new.keterangan, new.judul),
    jsonb_build_object(
      'kategori', new.kategori,
      'tanggal_pengeluaran', new.tanggal_pengeluaran,
      'bukti_url', new.bukti_url,
      'direct_table_insert', true
    ),
    new.dicatat_oleh_id,
    coalesce(new.created_at, now())
  );

  return new;
end;
$$;

drop trigger if exists tg_pengeluaran_ke_saldo_dana on public.pengeluaran;
create trigger tg_pengeluaran_ke_saldo_dana
after insert or update of nominal, kategori, jenis_pembayaran_id, scope_gender, scope_jurusan, tanggal_pengeluaran, keterangan, judul
on public.pengeluaran
for each row
execute function keuangan_internal.tandai_pengeluaran_ke_saldo_dana();

drop trigger if exists tg_pengeluaran_delete_saldo_dana on public.pengeluaran;
create trigger tg_pengeluaran_delete_saldo_dana
before delete on public.pengeluaran
for each row
execute function keuangan_internal.tandai_pengeluaran_ke_saldo_dana();

create or replace function keuangan_internal.blokir_update_saldo_dana_langsung()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('app.saldo_dana.allow_balance_update', true) = 'on' then
    return new;
  end if;

  raise exception 'saldo_dana tidak boleh diubah langsung; gunakan fungsi ledger.';
end;
$$;

drop trigger if exists tg_blokir_update_saldo_dana_langsung on public.saldo_dana;
create trigger tg_blokir_update_saldo_dana_langsung
before update of jenis_pembayaran_id, scope_gender, scope_jurusan, saldo_tersedia, total_masuk, total_keluar
on public.saldo_dana
for each row
execute function keuangan_internal.blokir_update_saldo_dana_langsung();

create or replace function keuangan_internal.blokir_mutasi_dana_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'mutasi_dana bersifat immutable; gunakan mutasi koreksi.';
end;
$$;

drop trigger if exists tg_blokir_update_mutasi_dana on public.mutasi_dana;
create trigger tg_blokir_update_mutasi_dana
before update or delete on public.mutasi_dana
for each row
execute function keuangan_internal.blokir_mutasi_dana_immutable();

create or replace view public.v_saldo_dana_rekap
with (security_invoker = true)
as
select
  sd.id,
  sd.jenis_pembayaran_id,
  r.nama_pembayaran,
  r.tipe,
  sd.scope_gender,
  sd.scope_jurusan,
  sd.saldo_tersedia,
  sd.total_masuk,
  sd.total_keluar,
  sd.created_at,
  sd.updated_at
from public.saldo_dana sd
join public.ref_jenis_pembayaran r on r.id = sd.jenis_pembayaran_id;

grant select on public.v_saldo_dana_rekap to authenticated, service_role;

revoke all on function public.record_pengeluaran_dana(text, text, bigint, date, bigint, text, text, text, text, text) from public, anon;
grant execute on function public.record_pengeluaran_dana(text, text, bigint, date, bigint, text, text, text, text, text) to authenticated, service_role;

revoke all on function keuangan_internal.current_profile() from public, anon, authenticated;
revoke all on function keuangan_internal.petugas_keuangan_memiliki_akses(text, text) from public, anon, authenticated;
revoke all on function keuangan_internal.petugas_keuangan_boleh_kelola(text, text) from public, anon, authenticated;
revoke all on function keuangan_internal.record_pengeluaran_dana(text, text, bigint, date, bigint, text, text, text, text, text) from public, anon, authenticated;
revoke all on function keuangan_internal.ambil_atau_buat_saldo_dana(bigint, text, text) from public, anon, authenticated;
revoke all on function keuangan_internal.post_mutasi_dana(bigint, text, text, text, bigint, uuid, uuid, bigint, text, text, jsonb, uuid, timestamptz) from public, anon, authenticated;
revoke all on function keuangan_internal.tandai_pembayaran_tagihan_ke_saldo_dana() from public, anon, authenticated;
revoke all on function keuangan_internal.tandai_pengeluaran_ke_saldo_dana() from public, anon, authenticated;
revoke all on function keuangan_internal.blokir_update_saldo_dana_langsung() from public, anon, authenticated;
revoke all on function keuangan_internal.blokir_mutasi_dana_immutable() from public, anon, authenticated;

grant execute on function keuangan_internal.current_profile() to authenticated, service_role;
grant execute on function keuangan_internal.petugas_keuangan_memiliki_akses(text, text) to authenticated, service_role;
grant execute on function keuangan_internal.petugas_keuangan_boleh_kelola(text, text) to authenticated, service_role;
grant execute on function keuangan_internal.record_pengeluaran_dana(text, text, bigint, date, bigint, text, text, text, text, text) to authenticated, service_role;
grant execute on function keuangan_internal.ambil_atau_buat_saldo_dana(bigint, text, text) to service_role;
grant execute on function keuangan_internal.post_mutasi_dana(bigint, text, text, text, bigint, uuid, uuid, bigint, text, text, jsonb, uuid, timestamptz) to service_role;

comment on table public.saldo_dana is 'Saldo berjalan per jenis pembayaran dan scope gender/jurusan. Nilai ini cache yang hanya boleh berubah melalui mutasi_dana.';
comment on table public.mutasi_dana is 'Ledger immutable mutasi dana untuk audit, rekonsiliasi, dan laporan fund accounting.';
comment on column public.pengeluaran.jenis_pembayaran_id is 'Fund/dana asal pengeluaran. Wajib untuk pengeluaran baru setelah modul saldo_dana aktif.';
comment on function public.record_pengeluaran_dana(text, text, bigint, date, bigint, text, text, text, text, text) is 'Mencatat pengeluaran sekaligus posting mutasi dana keluar secara atomik.';

commit;
