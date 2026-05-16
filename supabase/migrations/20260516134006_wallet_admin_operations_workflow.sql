-- Admin-facing workflow controls for Dompet Santri production operations.

alter table public.wallet_reconciliation_runs
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

alter table public.wallet_ledger_integrity_runs
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

create or replace function public.wallet_acknowledge_risk_event(
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
    raise exception 'Role tidak boleh menangani peringatan keamanan dompet';
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
  set status = 'acknowledged',
      acknowledged_by = p_actor_id,
      acknowledged_at = now(),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'acknowledge_note', nullif(trim(coalesce(p_note, '')), ''),
        'acknowledge_role', p_actor_role
      )
  where id = p_risk_event_id
  returning * into v_event;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_acknowledge_risk_event',
    'wallet_risk_events',
    v_event.santri_nis,
    v_event.id::text,
    jsonb_build_object('severity', v_event.severity, 'rule_code', v_event.rule_code, 'note', p_note)
  );

  return to_jsonb(v_event);
end;
$$;

create or replace function public.wallet_resolve_risk_event(
  p_risk_event_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_status text,
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
    raise exception 'Role tidak boleh menyelesaikan peringatan keamanan dompet';
  end if;

  if p_status not in ('resolved','false_positive') then
    raise exception 'Status penyelesaian peringatan tidak valid';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan penyelesaian minimal 12 karakter';
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
  set status = p_status,
      resolved_by = p_actor_id,
      resolved_at = now(),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'resolution_note', p_note,
        'resolution_role', p_actor_role
      )
  where id = p_risk_event_id
  returning * into v_event;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_resolve_risk_event',
    'wallet_risk_events',
    v_event.santri_nis,
    v_event.id::text,
    jsonb_build_object('severity', v_event.severity, 'rule_code', v_event.rule_code, 'status', p_status, 'note', p_note)
  );

  return to_jsonb(v_event);
end;
$$;

create or replace function public.wallet_start_dispute_investigation(
  p_dispute_id uuid,
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
  v_dispute public.wallet_disputes%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menangani dispute dompet';
  end if;

  select * into v_dispute
  from public.wallet_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute tidak ditemukan';
  end if;

  if v_dispute.status not in ('open','investigating') then
    raise exception 'Dispute sudah selesai atau tidak bisa diproses';
  end if;

  update public.wallet_disputes
  set status = 'investigating',
      assigned_to = p_actor_id,
      evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object(
        'investigation_note', nullif(trim(coalesce(p_note, '')), ''),
        'investigation_started_at', now(),
        'investigation_role', p_actor_role
      )
  where id = p_dispute_id
  returning * into v_dispute;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_start_dispute_investigation',
    'wallet_disputes',
    v_dispute.santri_nis,
    v_dispute.id::text,
    jsonb_build_object('ledger_id', v_dispute.ledger_id, 'note', p_note)
  );

  return to_jsonb(v_dispute);
end;
$$;

create or replace function public.wallet_review_reconciliation_run(
  p_run_id uuid,
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
  v_run public.wallet_reconciliation_runs%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menandai rekonsiliasi';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan rekonsiliasi minimal 12 karakter';
  end if;

  update public.wallet_reconciliation_runs
  set reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_note = p_note,
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object('review_note', p_note, 'review_role', p_actor_role)
  where id = p_run_id
  returning * into v_run;

  if not found then
    raise exception 'Hasil rekonsiliasi tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_review_reconciliation_run',
    'wallet_reconciliation_runs',
    v_run.id::text,
    jsonb_build_object('status', v_run.status, 'difference_internal', v_run.difference_internal, 'difference_bank', v_run.difference_bank, 'note', p_note)
  );

  return to_jsonb(v_run);
end;
$$;

create or replace function public.wallet_review_integrity_run(
  p_run_id uuid,
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
  v_run public.wallet_ledger_integrity_runs%rowtype;
begin
  if p_actor_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh menandai pemeriksaan ledger';
  end if;

  if length(trim(coalesce(p_note, ''))) < 12 then
    raise exception 'Catatan pemeriksaan minimal 12 karakter';
  end if;

  update public.wallet_ledger_integrity_runs
  set reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_note = p_note,
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object('review_note', p_note, 'review_role', p_actor_role)
  where id = p_run_id
  returning * into v_run;

  if not found then
    raise exception 'Hasil pemeriksaan ledger tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, santri_nis, record_id, metadata)
  values (
    p_actor_id,
    p_actor_role,
    'wallet_review_integrity_run',
    'wallet_ledger_integrity_runs',
    v_run.santri_nis,
    v_run.id::text,
    jsonb_build_object('status', v_run.status, 'broken_at', v_run.broken_at, 'note', p_note)
  );

  return to_jsonb(v_run);
end;
$$;

revoke all on function public.wallet_acknowledge_risk_event(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.wallet_resolve_risk_event(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.wallet_start_dispute_investigation(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.wallet_review_reconciliation_run(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.wallet_review_integrity_run(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.wallet_acknowledge_risk_event(uuid, uuid, text, text) to service_role;
grant execute on function public.wallet_resolve_risk_event(uuid, uuid, text, text, text) to service_role;
grant execute on function public.wallet_start_dispute_investigation(uuid, uuid, text, text) to service_role;
grant execute on function public.wallet_review_reconciliation_run(uuid, uuid, text, text) to service_role;
grant execute on function public.wallet_review_integrity_run(uuid, uuid, text, text) to service_role;
