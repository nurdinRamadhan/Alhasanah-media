-- Cover ledger foreign keys used by wallet audit, admin history, and kantin
-- transaction history. These indexes keep delete/update checks and joins stable
-- as transaksi_dompet grows.

create index if not exists idx_transaksi_dompet_counterparty_id
  on public.transaksi_dompet (counterparty_id)
  where counterparty_id is not null;

create index if not exists idx_transaksi_dompet_dicatat_oleh_id
  on public.transaksi_dompet (dicatat_oleh_id)
  where dicatat_oleh_id is not null;
