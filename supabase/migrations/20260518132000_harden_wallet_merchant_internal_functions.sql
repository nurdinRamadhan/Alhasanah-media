revoke all on function public.wallet_credit_merchant_from_posted_intent() from public, anon, authenticated;
revoke all on function public.wallet_request_merchant_settlement(uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.wallet_request_merchant_settlement(uuid, uuid, bigint, text) to service_role;
grant execute on function public.wallet_credit_merchant_from_posted_intent() to service_role;
