-- AI analysis layer for Dompet Santri security audit.
-- Manual audit remains the source of truth in wallet_security_audit_runs.
-- This table stores sanitized LLM analysis that explains and prioritizes a
-- specific manual audit run without exposing wallet secrets or personal data.

create table if not exists public.wallet_security_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null references public.wallet_security_audit_runs(id) on delete cascade,
  status text not null default 'success'
    check (status in ('success','failed')),
  provider text not null default 'gemini',
  model text,
  triggered_by uuid references public.profiles(id),
  triggered_by_role text,
  executive_summary text,
  critical_findings jsonb not null default '[]'::jsonb,
  early_warning_signals jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  production_blockers jsonb not null default '[]'::jsonb,
  android_specific_risks jsonb not null default '[]'::jsonb,
  database_specific_risks jsonb not null default '[]'::jsonb,
  consistency_notes jsonb not null default '[]'::jsonb,
  confidence text not null default 'medium'
    check (confidence in ('low','medium','high')),
  do_not_proceed_reason text,
  sanitized_input jsonb not null default '{}'::jsonb,
  raw_response text,
  error_message text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

alter table public.wallet_security_ai_analyses enable row level security;

drop policy if exists wallet_security_ai_analyses_select_roles
  on public.wallet_security_ai_analyses;

create policy wallet_security_ai_analyses_select_roles
  on public.wallet_security_ai_analyses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active is true
        and lower(coalesce(p.role, '')) in ('super_admin','rois','dewan','bendahara')
    )
  );

revoke all on public.wallet_security_ai_analyses from public, anon;
grant select on public.wallet_security_ai_analyses to authenticated;

create index if not exists idx_wallet_security_ai_analyses_audit_run_id
  on public.wallet_security_ai_analyses (audit_run_id, created_at desc);

create index if not exists idx_wallet_security_ai_analyses_created_at
  on public.wallet_security_ai_analyses (created_at desc);
