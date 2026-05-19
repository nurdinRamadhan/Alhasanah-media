alter table public.wallet_reconciliation_runs
  add column if not exists santri_balance_total bigint not null default 0,
  add column if not exists merchant_available_total bigint not null default 0,
  add column if not exists merchant_pending_settlement_total bigint not null default 0,
  add column if not exists merchant_liability_total bigint not null default 0,
  add column if not exists merchant_sales_total bigint not null default 0,
  add column if not exists merchant_settled_total bigint not null default 0,
  add column if not exists merchant_pending_request_total bigint not null default 0,
  add column if not exists wallet_topup_midtrans_total bigint not null default 0,
  add column if not exists spp_paid_total bigint not null default 0,
  add column if not exists spp_outstanding_total bigint not null default 0,
  add column if not exists expected_internal_liability bigint not null default 0,
  add column if not exists difference_liability_vs_bank bigint;

alter table public.wallet_merchant_settlement_requests
  add column if not exists proof_storage_path text,
  add column if not exists proof_uploaded_by uuid references public.profiles(id) on delete set null,
  add column if not exists proof_uploaded_at timestamptz,
  add column if not exists proof_metadata jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wallet-merchant-settlement-proofs',
  'wallet-merchant-settlement-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf'];

drop policy if exists wallet_settlement_proofs_admin_read on storage.objects;
create policy wallet_settlement_proofs_admin_read
on storage.objects for select to authenticated
using (
  bucket_id = 'wallet-merchant-settlement-proofs'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'bendahara', 'rois')
      and coalesce(p.is_active, true)
  )
);

drop policy if exists wallet_settlement_proofs_admin_insert on storage.objects;
create policy wallet_settlement_proofs_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'wallet-merchant-settlement-proofs'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'bendahara')
      and coalesce(p.is_active, true)
  )
);

drop policy if exists wallet_settlement_proofs_admin_update on storage.objects;
create policy wallet_settlement_proofs_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'wallet-merchant-settlement-proofs'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'bendahara')
      and coalesce(p.is_active, true)
  )
)
with check (
  bucket_id = 'wallet-merchant-settlement-proofs'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'bendahara')
      and coalesce(p.is_active, true)
  )
);

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
  v_merchant_available bigint;
  v_merchant_pending bigint;
  v_merchant_liability bigint;
  v_merchant_sales bigint;
  v_merchant_settled bigint;
  v_merchant_pending_request bigint;
  v_wallet_midtrans_topup bigint;
  v_spp_paid bigint;
  v_spp_outstanding bigint;
  v_expected_liability bigint;
  v_liability_bank_diff bigint;
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
  where status in ('active', 'locked');

  select
    coalesce(sum(saldo_available), 0),
    coalesce(sum(saldo_pending_settlement), 0),
    coalesce(sum(total_sales), 0),
    coalesce(sum(total_settled), 0)
  into v_merchant_available, v_merchant_pending, v_merchant_sales, v_merchant_settled
  from public.wallet_merchant_balances;

  v_merchant_liability := v_merchant_available + v_merchant_pending;

  select coalesce(sum(amount), 0)
  into v_merchant_pending_request
  from public.wallet_merchant_settlement_requests
  where status in ('requested', 'approved');

  select coalesce(sum(amount), 0)
  into v_wallet_midtrans_topup
  from public.wallet_payment_intents
  where type = 'midtrans_topup' and status = 'posted';

  select coalesce(sum(jumlah), 0)
  into v_spp_paid
  from public.transaksi_keuangan
  where coalesce(status_transaksi, '') in ('settlement', 'capture', 'success')
    and coalesce(status::text, '') in ('success', 'settlement', 'capture', 'pending');

  select coalesce(sum(sisa_tagihan), 0)
  into v_spp_outstanding
  from public.tagihan_santri;

  v_expected_liability := v_cached + v_merchant_liability;
  v_internal_diff := v_ledger_net - v_cached;
  v_bank_diff := case when p_reserved_bank_balance is null then null else v_ledger_net - p_reserved_bank_balance end;
  v_liability_bank_diff := case when p_reserved_bank_balance is null then null else v_expected_liability - p_reserved_bank_balance end;

  if v_internal_diff <> 0 then
    v_status := 'failed';
    v_freeze := true;
    perform public.wallet_set_system_freeze(
      true,
      'wallet_reconciliation_internal_mismatch',
      p_triggered_by,
      jsonb_build_object('run_id', v_run_id, 'difference_internal', v_internal_diff)
    );
  elsif v_liability_bank_diff is not null and v_liability_bank_diff <> 0 then
    v_status := 'settlement_mismatch';
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
      santri_balance_total = v_cached,
      merchant_available_total = v_merchant_available,
      merchant_pending_settlement_total = v_merchant_pending,
      merchant_liability_total = v_merchant_liability,
      merchant_sales_total = v_merchant_sales,
      merchant_settled_total = v_merchant_settled,
      merchant_pending_request_total = v_merchant_pending_request,
      wallet_topup_midtrans_total = v_wallet_midtrans_topup,
      spp_paid_total = v_spp_paid,
      spp_outstanding_total = v_spp_outstanding,
      expected_internal_liability = v_expected_liability,
      difference_liability_vs_bank = v_liability_bank_diff,
      details = jsonb_build_object(
        'wallet_ledger_credit', v_credit,
        'wallet_ledger_debit', v_debit,
        'cached_balance_statuses', jsonb_build_array('active', 'locked'),
        'merchant_available_total', v_merchant_available,
        'merchant_pending_settlement_total', v_merchant_pending,
        'merchant_liability_total', v_merchant_liability,
        'merchant_sales_total', v_merchant_sales,
        'merchant_settled_total', v_merchant_settled,
        'merchant_pending_request_total', v_merchant_pending_request,
        'wallet_topup_midtrans_total', v_wallet_midtrans_topup,
        'spp_paid_total', v_spp_paid,
        'spp_outstanding_total', v_spp_outstanding,
        'expected_internal_liability', v_expected_liability,
        'difference_liability_vs_bank', v_liability_bank_diff
      )
  where id = v_run_id;

  return jsonb_build_object(
    'run_id', v_run_id,
    'status', v_status,
    'ledger_net', v_ledger_net,
    'santri_balance_total', v_cached,
    'merchant_available_total', v_merchant_available,
    'merchant_pending_settlement_total', v_merchant_pending,
    'merchant_liability_total', v_merchant_liability,
    'merchant_pending_request_total', v_merchant_pending_request,
    'wallet_topup_midtrans_total', v_wallet_midtrans_topup,
    'spp_paid_total', v_spp_paid,
    'spp_outstanding_total', v_spp_outstanding,
    'expected_internal_liability', v_expected_liability,
    'reserved_bank_balance', p_reserved_bank_balance,
    'difference_internal', v_internal_diff,
    'difference_bank', v_bank_diff,
    'difference_liability_vs_bank', v_liability_bank_diff,
    'freeze_triggered', v_freeze
  );
end;
$$;

create or replace function public.wallet_attach_merchant_settlement_proof(
  p_settlement_request_id uuid,
  p_actor_id uuid,
  p_storage_path text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_request public.wallet_merchant_settlement_requests%rowtype;
begin
  select role into v_actor_role
  from public.profiles
  where id = p_actor_id and coalesce(is_active, true);

  if v_actor_role not in ('super_admin', 'bendahara') then
    raise exception 'Hanya bendahara/super admin yang bisa mengarsipkan bukti pencairan';
  end if;

  if p_storage_path is null or length(trim(p_storage_path)) < 8 then
    raise exception 'Path bukti transfer tidak valid';
  end if;

  update public.wallet_merchant_settlement_requests
  set proof_storage_path = trim(p_storage_path),
      proof_uploaded_by = p_actor_id,
      proof_uploaded_at = now(),
      proof_metadata = coalesce(proof_metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
  where id = p_settlement_request_id
  returning * into v_request;

  if not found then
    raise exception 'Pengajuan pencairan tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    v_actor_role,
    'wallet_attach_merchant_settlement_proof',
    'wallet_merchant_settlement_requests',
    v_request.id::text,
    jsonb_build_object(
      'merchant_id', v_request.merchant_id,
      'outlet_id', v_request.outlet_id,
      'amount', v_request.amount,
      'proof_storage_path', trim(p_storage_path)
    )
  );

  return to_jsonb(v_request);
end;
$$;

create or replace function public.wallet_reject_merchant_settlement(
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
  if v_actor_role not in ('super_admin', 'bendahara') then
    raise exception 'Hanya bendahara/super admin yang bisa menolak pencairan';
  end if;

  select * into v_request
  from public.wallet_merchant_settlement_requests
  where id = p_settlement_request_id
  for update;

  if not found then raise exception 'Pengajuan pencairan tidak ditemukan'; end if;
  if v_request.status not in ('requested', 'approved') then raise exception 'Status pencairan tidak valid'; end if;

  v_ledger := public.wallet_post_merchant_ledger(
    v_request.merchant_id,
    v_request.outlet_id,
    'credit',
    'settlement_rejected',
    v_request.amount,
    'merchant-settlement-rejected:' || v_request.id::text,
    p_actor_id,
    v_actor_role,
    null,
    null,
    v_request.id,
    'Pengajuan pencairan saldo kantin ditolak',
    jsonb_build_object('note_present', p_note is not null)
  );

  update public.wallet_merchant_settlement_requests
  set status = 'rejected',
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_note = p_note,
      updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return to_jsonb(v_request) || jsonb_build_object('ledger', v_ledger);
end;
$$;

alter table public.wallet_merchants
  drop constraint if exists wallet_merchants_status_check,
  add constraint wallet_merchants_status_check
  check (status in ('active', 'suspended', 'quarantined', 'closed'));

create or replace function public.wallet_set_merchant_status(
  p_merchant_id uuid,
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
  v_actor_role text;
  v_merchant public.wallet_merchants%rowtype;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id and coalesce(is_active, true);
  if v_actor_role not in ('super_admin', 'bendahara', 'rois') then
    raise exception 'Role tidak boleh mengubah status merchant';
  end if;

  if p_status not in ('active', 'suspended', 'quarantined', 'closed') then
    raise exception 'Status merchant tidak valid';
  end if;

  update public.wallet_merchants
  set status = p_status,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_status_reason', nullif(trim(coalesce(p_reason, '')), ''),
        'last_status_changed_by', p_actor_id,
        'last_status_changed_at', now()
      ),
      updated_at = now()
  where id = p_merchant_id
  returning * into v_merchant;

  if not found then raise exception 'Merchant tidak ditemukan'; end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    v_actor_role,
    'wallet_set_merchant_status',
    'wallet_merchants',
    v_merchant.id::text,
    jsonb_build_object('status', p_status, 'reason_present', p_reason is not null)
  );

  return to_jsonb(v_merchant);
end;
$$;

revoke all on function public.wallet_run_reconciliation(bigint, uuid) from public, anon, authenticated;
revoke all on function public.wallet_attach_merchant_settlement_proof(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.wallet_reject_merchant_settlement(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.wallet_set_merchant_status(uuid, text, uuid, text) from public, anon, authenticated;

grant execute on function public.wallet_run_reconciliation(bigint, uuid) to service_role;
grant execute on function public.wallet_attach_merchant_settlement_proof(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.wallet_reject_merchant_settlement(uuid, uuid, text) to service_role;
grant execute on function public.wallet_set_merchant_status(uuid, text, uuid, text) to service_role;
