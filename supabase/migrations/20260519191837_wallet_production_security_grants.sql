-- Production hardening for wallet internal RPC surfaces.
-- These functions are invoked by Edge Functions or triggers only. They must not
-- be callable directly from anon/authenticated REST RPC clients.

revoke all on function public.wallet_ensure_kantin_ready(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.wallet_ensure_kantin_ready(uuid, uuid, text, uuid, uuid) to service_role;

revoke all on function public.wallet_notify_merchant_settlement() from public, anon, authenticated;
grant execute on function public.wallet_notify_merchant_settlement() to service_role;
