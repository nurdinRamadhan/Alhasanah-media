-- Edge Function wallet-merchant-settlement-request forwards the kantin JWT so
-- wallet_request_merchant_settlement can evaluate auth.uid() and role checks.
-- Keep the internal ledger poster service-only; only expose this guarded wrapper.
grant execute on function public.wallet_request_merchant_settlement(uuid, uuid, bigint, text) to authenticated;
