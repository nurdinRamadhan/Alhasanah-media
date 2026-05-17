-- Wallet-specific indexes reported by Supabase performance advisor.

create index if not exists idx_dompet_santri_limits_updated_by
  on public.dompet_santri (limits_updated_by)
  where limits_updated_by is not null;

create index if not exists idx_kantin_devices_registered_by
  on public.kantin_devices (registered_by)
  where registered_by is not null;

create index if not exists idx_kantin_devices_approved_by
  on public.kantin_devices (approved_by)
  where approved_by is not null;

create index if not exists idx_kantin_devices_revoked_by
  on public.kantin_devices (revoked_by)
  where revoked_by is not null;

create index if not exists idx_wallet_security_audit_runs_triggered_by
  on public.wallet_security_audit_runs (triggered_by, started_at desc)
  where triggered_by is not null;
