-- Production readiness workflow additions for Dompet Santri admin operations.

alter table public.wallet_risk_events
  drop constraint if exists wallet_risk_events_status_check,
  add constraint wallet_risk_events_status_check
    check (status in ('open','acknowledged','investigating','escalated','resolved','false_positive'));

alter table public.wallet_reconciliation_runs
  add column if not exists resolution_status text not null default 'open',
  add column if not exists resolved_by uuid references public.profiles(id),
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_note text;

alter table public.wallet_reconciliation_runs
  drop constraint if exists wallet_reconciliation_runs_resolution_status_check,
  add constraint wallet_reconciliation_runs_resolution_status_check
    check (resolution_status in ('open','monitoring','resolved','accepted_risk','false_alarm'));

alter table public.wallet_ledger_integrity_runs
  add column if not exists resolution_status text not null default 'open',
  add column if not exists resolved_by uuid references public.profiles(id),
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_note text;

alter table public.wallet_ledger_integrity_runs
  drop constraint if exists wallet_ledger_integrity_runs_resolution_status_check,
  add constraint wallet_ledger_integrity_runs_resolution_status_check
    check (resolution_status in ('open','monitoring','resolved','accepted_risk','false_alarm'));

update public.wallet_system_controls
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'low_balance_warning_threshold', 30000,
  'low_balance_critical_threshold', 10000,
  'large_transaction_bendahara_threshold', 100000,
  'large_transaction_rois_threshold', 500000,
  'large_transaction_super_admin_threshold', 1000000,
  'risk_critical_response_minutes', 15,
  'dispute_response_hours', 48,
  'max_offline_transactions_per_santri', 1,
  'offline_transaction_expiry_minutes', 10,
  'maintenance_manual_record_required', true
)
where key = 'wallet_transactions';

create or replace function public.wallet_investigate_risk_event(
  p_risk_event_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.wallet_risk_events%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menginvestigasi peringatan keamanan dompet';
  end if;

  select * into v_event
  from public.wallet_risk_events
  where id = p_risk_event_id
  for update;

  if not found then
    raise exception 'Peringatan keamanan tidak ditemukan';
  end if;

  if v_event.status in ('resolved','false_positive') then
    raise exception 'Peringatan keamanan sudah selesai';
  end if;

  update public.wallet_risk_events
  set status = 'investigating',
      acknowledged_by = coalesce(acknowledged_by, p_actor_id),
      acknowledged_at = coalesce(acknowledged_at, now()),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'investigation_note', nullif(trim(coalesce(p_note, '')), ''),
        'investigation_started_at', now(),
        'investigation_role', p_actor_role
      )
  where id = p_risk_event_id
  returning * into v_event;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_investigate_risk_event',
    'wallet_risk_events',
    v_event.santri_nis,
    v_event.id::text,
    jsonb_build_object('severity', v_event.severity, 'rule_code', v_event.rule_code, 'note', p_note)
  );

  return to_jsonb(v_event);
end;
$$;

create or replace function public.wallet_escalate_risk_event(
  p_risk_event_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.wallet_risk_events%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh mengeskalasi peringatan keamanan dompet';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan eskalasi minimal 12 karakter';
  end if;

  select * into v_event
  from public.wallet_risk_events
  where id = p_risk_event_id
  for update;

  if not found then
    raise exception 'Peringatan keamanan tidak ditemukan';
  end if;

  if v_event.status in ('resolved','false_positive') then
    raise exception 'Peringatan keamanan sudah selesai';
  end if;

  update public.wallet_risk_events
  set status = 'escalated',
      escalated_at = now(),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'escalation_note', p_note,
        'escalated_by_role', p_actor_role
      )
  where id = p_risk_event_id
  returning * into v_event;

  perform public.wallet_notify_role(
    'super_admin',
    'Peringatan dompet dieskalasi',
    'Peringatan ' || v_event.rule_code || ' untuk NIS ' || coalesce(v_event.santri_nis, '-') || ' dieskalasi. Catatan: ' || p_note,
    'wallet.risk.escalated',
    'wallet_risk_events',
    jsonb_build_object('risk_event_id', v_event.id, 'santri_nis', v_event.santri_nis, 'severity', v_event.severity, 'note', p_note),
    'critical',
    v_event.id::text
  );

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_escalate_risk_event',
    'wallet_risk_events',
    v_event.santri_nis,
    v_event.id::text,
    jsonb_build_object('severity', v_event.severity, 'rule_code', v_event.rule_code, 'note', p_note)
  );

  return to_jsonb(v_event);
end;
$$;

create or replace function public.wallet_resolve_reconciliation_run(
  p_run_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_resolution_status text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.wallet_reconciliation_runs%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menyelesaikan hasil rekonsiliasi';
  end if;

  if p_resolution_status not in ('resolved','accepted_risk','false_alarm','monitoring') then
    raise exception 'Status penyelesaian rekonsiliasi tidak valid';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan penyelesaian minimal 12 karakter';
  end if;

  update public.wallet_reconciliation_runs
  set resolution_status = p_resolution_status,
      resolved_by = p_actor_id,
      resolved_at = case when p_resolution_status = 'monitoring' then null else now() end,
      resolution_note = p_note,
      reviewed_by = coalesce(reviewed_by, p_actor_id),
      reviewed_at = coalesce(reviewed_at, now()),
      review_note = coalesce(review_note, p_note),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'resolution_status', p_resolution_status,
        'resolution_note', p_note,
        'resolution_role', p_actor_role
      )
  where id = p_run_id
  returning * into v_run;

  if not found then
    raise exception 'Hasil rekonsiliasi tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_resolve_reconciliation_run',
    'wallet_reconciliation_runs',
    v_run.id::text,
    jsonb_build_object('status', v_run.status, 'resolution_status', p_resolution_status, 'difference_internal', v_run.difference_internal, 'difference_bank', v_run.difference_bank, 'note', p_note)
  );

  return to_jsonb(v_run);
end;
$$;

create or replace function public.wallet_resolve_integrity_run(
  p_run_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_resolution_status text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.wallet_ledger_integrity_runs%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menyelesaikan hasil pemeriksaan ledger';
  end if;

  if p_resolution_status not in ('resolved','accepted_risk','false_alarm','monitoring') then
    raise exception 'Status penyelesaian pemeriksaan ledger tidak valid';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan penyelesaian minimal 12 karakter';
  end if;

  update public.wallet_ledger_integrity_runs
  set resolution_status = p_resolution_status,
      resolved_by = p_actor_id,
      resolved_at = case when p_resolution_status = 'monitoring' then null else now() end,
      resolution_note = p_note,
      reviewed_by = coalesce(reviewed_by, p_actor_id),
      reviewed_at = coalesce(reviewed_at, now()),
      review_note = coalesce(review_note, p_note),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'resolution_status', p_resolution_status,
        'resolution_note', p_note,
        'resolution_role', p_actor_role
      )
  where id = p_run_id
  returning * into v_run;

  if not found then
    raise exception 'Hasil pemeriksaan ledger tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_resolve_integrity_run',
    'wallet_ledger_integrity_runs',
    v_run.santri_nis,
    v_run.id::text,
    jsonb_build_object('status', v_run.status, 'resolution_status', p_resolution_status, 'broken_at', v_run.broken_at, 'note', p_note)
  );

  return to_jsonb(v_run);
end;
$$;

revoke all on function public.wallet_investigate_risk_event(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.wallet_escalate_risk_event(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.wallet_resolve_reconciliation_run(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.wallet_resolve_integrity_run(uuid, uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.wallet_investigate_risk_event(uuid, uuid, text, text) to service_role;
grant execute on function public.wallet_escalate_risk_event(uuid, uuid, text, text) to service_role;
grant execute on function public.wallet_resolve_reconciliation_run(uuid, uuid, text, text, text) to service_role;
grant execute on function public.wallet_resolve_integrity_run(uuid, uuid, text, text, text) to service_role;
