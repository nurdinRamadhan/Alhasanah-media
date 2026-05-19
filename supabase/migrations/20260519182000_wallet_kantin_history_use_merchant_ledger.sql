-- Show kantin history from the merchant perspective.
-- The old view read transaksi_dompet, which is correct for wali/santri but
-- shows kantin sales as debit. Kantin UI must read merchant ledger credits.

create or replace view public.view_kantin_transaction_history
with (security_invoker = true)
as
select
  ml.id,
  ml.public_id,
  ml.created_at,
  ml.created_at as posted_at,
  coalesce(td.santri_nis, '') as santri_nis,
  s.nama as santri_nama,
  s.kelas as santri_kelas,
  s.jurusan as santri_jurusan,
  ml.direction::public.wallet_direction as direction,
  case
    when ml.category = 'kantin_sale' then 'pembayaran_kantin'
    else 'pembayaran_kantin'
  end::public.tipe_kategori_transaksi as category,
  ml.amount,
  ml.balance_available_before as balance_before,
  ml.balance_available_after as balance_after,
  'posted'::public.wallet_intent_status as status,
  ml.actor_id as kantin_user_id,
  p.full_name as kantin_name,
  td.counterparty_id,
  coalesce(td.counterparty_role, 'santri') as counterparty_role,
  ml.payment_intent_id,
  ml.idempotency_key,
  null::text as entry_hash,
  ml.keterangan,
  ml.metadata || jsonb_build_object(
    'merchant_id', ml.merchant_id,
    'outlet_id', ml.outlet_id,
    'santri_ledger_id', ml.santri_ledger_id
  ) as metadata,
  ml.merchant_id,
  ml.outlet_id,
  coalesce(ml.metadata->>'kantin_device_id', td.metadata->>'kantin_device_id') as kantin_device_id
from public.wallet_merchant_ledger ml
left join public.transaksi_dompet td on td.id = ml.santri_ledger_id
left join public.santri s on s.nis = td.santri_nis
left join public.profiles p on p.id = ml.actor_id;

grant select on public.view_kantin_transaction_history to authenticated;
