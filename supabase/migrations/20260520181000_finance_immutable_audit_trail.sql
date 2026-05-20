-- Phase 3 finance governance: immutable audit trail for sensitive finance changes.
-- Additive only: records changes, does not change business workflow results.

create table if not exists ops.finance_audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  table_schema text not null default 'public',
  table_name text not null,
  record_id text not null,
  operation text not null,
  actor_id uuid,
  source text not null default current_setting('request.jwt.claim.sub', true),
  changed_fields text[] not null default '{}',
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_finance_audit_events_record
  on ops.finance_audit_events (table_name, record_id, occurred_at desc);

create index if not exists idx_finance_audit_events_occurred_at
  on ops.finance_audit_events (occurred_at desc);

create or replace function ops.audit_transaksi_keuangan_changes()
returns trigger
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_changed text[] := '{}';
  v_actor uuid;
begin
  if old.jumlah is distinct from new.jumlah then
    v_changed := array_append(v_changed, 'jumlah');
  end if;
  if old.status_transaksi is distinct from new.status_transaksi then
    v_changed := array_append(v_changed, 'status_transaksi');
  end if;
  if old.status is distinct from new.status then
    v_changed := array_append(v_changed, 'status');
  end if;
  if old.metode_pembayaran is distinct from new.metode_pembayaran then
    v_changed := array_append(v_changed, 'metode_pembayaran');
  end if;
  if old.midtrans_order_id is distinct from new.midtrans_order_id then
    v_changed := array_append(v_changed, 'midtrans_order_id');
  end if;
  if old.waktu_bayar_sukses is distinct from new.waktu_bayar_sukses then
    v_changed := array_append(v_changed, 'waktu_bayar_sukses');
  end if;
  if old.admin_pencatat_id is distinct from new.admin_pencatat_id then
    v_changed := array_append(v_changed, 'admin_pencatat_id');
  end if;

  if coalesce(array_length(v_changed, 1), 0) = 0 then
    return new;
  end if;

  v_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;

  insert into ops.finance_audit_events (
    table_name,
    record_id,
    operation,
    actor_id,
    changed_fields,
    old_values,
    new_values,
    metadata
  )
  values (
    tg_table_name,
    new.id::text,
    tg_op,
    v_actor,
    v_changed,
    jsonb_build_object(
      'jumlah', old.jumlah,
      'status_transaksi', old.status_transaksi,
      'status', old.status,
      'metode_pembayaran', old.metode_pembayaran,
      'midtrans_order_id', old.midtrans_order_id,
      'waktu_bayar_sukses', old.waktu_bayar_sukses,
      'admin_pencatat_id', old.admin_pencatat_id
    ),
    jsonb_build_object(
      'jumlah', new.jumlah,
      'status_transaksi', new.status_transaksi,
      'status', new.status,
      'metode_pembayaran', new.metode_pembayaran,
      'midtrans_order_id', new.midtrans_order_id,
      'waktu_bayar_sukses', new.waktu_bayar_sukses,
      'admin_pencatat_id', new.admin_pencatat_id
    ),
    jsonb_build_object(
      'jenis_transaksi', new.jenis_transaksi,
      'jenis_pembayaran', new.jenis_pembayaran,
      'santri_nis', new.santri_nis,
      'wali_id', new.wali_id
    )
  );

  return new;
end;
$$;

create or replace function ops.audit_tagihan_santri_changes()
returns trigger
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_changed text[] := '{}';
  v_actor uuid;
begin
  if old.nominal_tagihan is distinct from new.nominal_tagihan then
    v_changed := array_append(v_changed, 'nominal_tagihan');
  end if;
  if old.sisa_tagihan is distinct from new.sisa_tagihan then
    v_changed := array_append(v_changed, 'sisa_tagihan');
  end if;
  if old.status is distinct from new.status then
    v_changed := array_append(v_changed, 'status');
  end if;
  if old.tanggal_jatuh_tempo is distinct from new.tanggal_jatuh_tempo then
    v_changed := array_append(v_changed, 'tanggal_jatuh_tempo');
  end if;
  if old.deskripsi_tagihan is distinct from new.deskripsi_tagihan then
    v_changed := array_append(v_changed, 'deskripsi_tagihan');
  end if;

  if coalesce(array_length(v_changed, 1), 0) = 0 then
    return new;
  end if;

  v_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;

  insert into ops.finance_audit_events (
    table_name,
    record_id,
    operation,
    actor_id,
    changed_fields,
    old_values,
    new_values,
    metadata
  )
  values (
    tg_table_name,
    new.id::text,
    tg_op,
    v_actor,
    v_changed,
    jsonb_build_object(
      'nominal_tagihan', old.nominal_tagihan,
      'sisa_tagihan', old.sisa_tagihan,
      'status', old.status,
      'tanggal_jatuh_tempo', old.tanggal_jatuh_tempo,
      'deskripsi_tagihan', old.deskripsi_tagihan
    ),
    jsonb_build_object(
      'nominal_tagihan', new.nominal_tagihan,
      'sisa_tagihan', new.sisa_tagihan,
      'status', new.status,
      'tanggal_jatuh_tempo', new.tanggal_jatuh_tempo,
      'deskripsi_tagihan', new.deskripsi_tagihan
    ),
    jsonb_build_object(
      'santri_nis', new.santri_nis
    )
  );

  return new;
end;
$$;

drop trigger if exists tr_ops_audit_transaksi_keuangan_changes on public.transaksi_keuangan;
create trigger tr_ops_audit_transaksi_keuangan_changes
  after update on public.transaksi_keuangan
  for each row
  execute function ops.audit_transaksi_keuangan_changes();

drop trigger if exists tr_ops_audit_tagihan_santri_changes on public.tagihan_santri;
create trigger tr_ops_audit_tagihan_santri_changes
  after update on public.tagihan_santri
  for each row
  execute function ops.audit_tagihan_santri_changes();

revoke all on function ops.audit_transaksi_keuangan_changes() from public, anon, authenticated;
revoke all on function ops.audit_tagihan_santri_changes() from public, anon, authenticated;
grant execute on function ops.audit_transaksi_keuangan_changes() to service_role;
grant execute on function ops.audit_tagihan_santri_changes() to service_role;
