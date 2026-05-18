revoke all on table public.wallet_merchant_balances from anon;
revoke all on table public.wallet_merchant_ledger from anon;
revoke all on table public.wallet_merchant_settlement_requests from anon;

grant select on table public.wallet_merchant_balances to authenticated;
grant select on table public.wallet_merchant_ledger to authenticated;
grant select on table public.wallet_merchant_settlement_requests to authenticated;
