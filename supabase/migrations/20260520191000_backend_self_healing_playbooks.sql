-- Backend self-healing operations:
-- 1 incident playbook engine, 2 guarded auto-repair, 3 incident timeline,
-- 4 backend health score, 5 AI ops context, 6 weekly maintenance digest.

create table if not exists ops.incident_playbooks (
  playbook_key text primary key,
  component text not null,
  severity text not null check (severity in ('info', 'medium', 'high', 'critical')),
  title text not null,
  description text not null,
  match_dedupe_key text,
  auto_repair_allowed boolean not null default false,
  auto_repair_action text,
  requires_approval boolean not null default false,
  escalation_after_attempts integer not null default 3,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ops.incidents (
  id uuid primary key default gen_random_uuid(),
  playbook_key text references ops.incident_playbooks(playbook_key),
  alert_id uuid,
  dedupe_key text not null,
  component text not null,
  severity text not null check (severity in ('info', 'medium', 'high', 'critical')),
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'repairing', 'monitoring', 'resolved', 'escalated')),
  occurrence_count integer not null default 1,
  repair_attempt_count integer not null default 0,
  health_impact integer not null default 5 check (health_impact between 0 and 100),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_repair_at timestamptz,
  resolved_at timestamptz,
  escalated_at timestamptz,
  last_repair_result jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists idx_incidents_active_dedupe
  on ops.incidents (dedupe_key)
  where status <> 'resolved';

create index if not exists idx_incidents_status_severity_seen
  on ops.incidents (status, severity, last_seen_at desc);

create index if not exists idx_incidents_playbook_key
  on ops.incidents (playbook_key);

create table if not exists ops.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references ops.incidents(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'detected',
      'auto_repair_attempt',
      'auto_repair_success',
      'auto_repair_failed',
      'escalated',
      'resolved',
      'note'
    )
  ),
  actor_type text not null default 'system'
    check (actor_type in ('system', 'super_admin', 'developer', 'ai')),
  actor_id uuid,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_incident_events_incident_created
  on ops.incident_events (incident_id, created_at desc);

create table if not exists ops.backend_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  score integer not null check (score between 0 and 100),
  status text not null check (status in ('healthy', 'attention', 'degraded', 'critical')),
  breakdown jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb
);

create index if not exists idx_backend_health_snapshots_captured
  on ops.backend_health_snapshots (captured_at desc);

create table if not exists ops.weekly_maintenance_digests (
  week_start date primary key,
  week_end date not null,
  generated_at timestamptz not null default now(),
  status text not null default 'generated' check (status in ('generated', 'reviewed')),
  health_score integer not null check (health_score between 0 and 100),
  summary jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid
);

alter table ops.incident_playbooks enable row level security;
alter table ops.incidents enable row level security;
alter table ops.incident_events enable row level security;
alter table ops.backend_health_snapshots enable row level security;
alter table ops.weekly_maintenance_digests enable row level security;

create or replace function ops.seed_incident_playbooks()
returns integer
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  insert into ops.incident_playbooks (
    playbook_key,
    component,
    severity,
    title,
    description,
    match_dedupe_key,
    auto_repair_allowed,
    auto_repair_action,
    requires_approval,
    escalation_after_attempts,
    metadata
  )
  values
    (
      'notification_missing_fcm_tokens',
      'notification',
      'medium',
      'Push token wali/admin tidak sehat',
      'User aktif menerima notifikasi tetapi tidak punya FCM token aktif. Sistem boleh refresh health dan menandai device lama.',
      'notification_missing_fcm_tokens',
      true,
      'run_notification_token_hygiene',
      false,
      5,
      '{"admin_hint":"Tampilkan daftar user missing_token dan arahkan user login ulang jika perlu."}'::jsonb
    ),
    (
      'notification_pending_stale',
      'notification',
      'high',
      'Notification queue tertahan',
      'Queue notifikasi pending terlalu lama. Sistem boleh retry error transient dan resolve alert jika queue normal.',
      'notification_pending_stale',
      true,
      'run_safe_backend_repairs',
      false,
      3,
      '{"admin_hint":"Cek Edge Function push-notifications jika tetap muncul setelah repair otomatis."}'::jsonb
    ),
    (
      'midtrans_reconciliation_queue_active',
      'payment',
      'high',
      'Midtrans pending perlu rekonsiliasi',
      'Transaksi Midtrans pending lama masuk antrean. Sistem hanya enqueue; status uang wajib diverifikasi ke Midtrans.',
      'midtrans_reconciliation_queue_active',
      true,
      'enqueue_midtrans_pending_reconciliation',
      true,
      2,
      '{"money_status_changes_require_provider_verification":true}'::jsonb
    ),
    (
      'cron_failure_detected',
      'cron',
      'high',
      'Cron job gagal',
      'Satu atau lebih cron job gagal. Sistem boleh capture health dan cleanup history, tetapi developer harus cek error berulang.',
      'cron_failure_detected',
      true,
      'capture_cron_health',
      false,
      3,
      '{}'::jsonb
    ),
    (
      'pg_net_failure_detected',
      'network',
      'medium',
      'pg_net request bermasalah',
      'Request async dari database gagal atau timeout. Sistem boleh cleanup history dan mencatat health.',
      'pg_net_failure_detected',
      true,
      'cleanup_cron_operational_history',
      false,
      4,
      '{}'::jsonb
    ),
    (
      'finance_audit_activity',
      'finance',
      'info',
      'Aktivitas audit finansial meningkat',
      'Perubahan finansial sensitif meningkat dan harus diringkas untuk super_admin.',
      null,
      false,
      null,
      true,
      1,
      '{"llm_read_only":true}'::jsonb
    ),
    (
      'unclassified_backend_alert',
      'backend',
      'medium',
      'Backend alert belum punya playbook khusus',
      'Alert backend tetap dibuat incident agar masuk timeline dan health score meski belum punya repair otomatis.',
      null,
      false,
      null,
      true,
      1,
      '{"admin_hint":"Tambahkan playbook khusus jika alert ini sering berulang."}'::jsonb
    )
  on conflict (playbook_key) do update
  set
    component = excluded.component,
    severity = excluded.severity,
    title = excluded.title,
    description = excluded.description,
    match_dedupe_key = excluded.match_dedupe_key,
    auto_repair_allowed = excluded.auto_repair_allowed,
    auto_repair_action = excluded.auto_repair_action,
    requires_approval = excluded.requires_approval,
    escalation_after_attempts = excluded.escalation_after_attempts,
    metadata = excluded.metadata,
    enabled = true,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function ops.ensure_incident(
  p_playbook_key text,
  p_alert_id uuid,
  p_dedupe_key text,
  p_component text,
  p_severity text,
  p_title text,
  p_metadata jsonb default '{}'::jsonb,
  p_health_impact integer default 5
)
returns uuid
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_incident_id uuid;
begin
  update ops.incidents
  set
    alert_id = coalesce(p_alert_id, alert_id),
    playbook_key = coalesce(p_playbook_key, playbook_key),
    component = p_component,
    severity = p_severity,
    title = p_title,
    occurrence_count = occurrence_count + 1,
    last_seen_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
  where dedupe_key = p_dedupe_key
    and status <> 'resolved'
  returning id into v_incident_id;

  if v_incident_id is null then
    insert into ops.incidents (
      playbook_key,
      alert_id,
      dedupe_key,
      component,
      severity,
      title,
      health_impact,
      metadata
    )
    values (
      p_playbook_key,
      p_alert_id,
      p_dedupe_key,
      p_component,
      p_severity,
      p_title,
      least(greatest(coalesce(p_health_impact, 5), 0), 100),
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_incident_id;

    insert into ops.incident_events (incident_id, event_type, message, data)
    values (
      v_incident_id,
      'detected',
      'Incident detected and linked to backend playbook.',
      jsonb_build_object('playbook_key', p_playbook_key, 'alert_id', p_alert_id)
    );
  end if;

  return v_incident_id;
end;
$$;

create or replace function ops.sync_incidents_from_alerts()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_synced integer := 0;
begin
  perform ops.seed_incident_playbooks();

  with source_alerts as (
    select
      a.id as alert_id,
      coalesce(p.playbook_key, 'unclassified_backend_alert') as playbook_key,
      a.dedupe_key,
      a.component,
      a.severity,
      a.title,
      jsonb_build_object(
        'alert_body', a.body,
        'alert_metadata', a.metadata,
        'occurrence_count', a.occurrence_count
      ) as metadata,
      case a.severity
        when 'critical' then 40
        when 'high' then 25
        when 'medium' then 12
        else 4
      end as health_impact
    from ops.backend_alerts a
    left join ops.incident_playbooks p
      on p.enabled = true
     and p.match_dedupe_key = a.dedupe_key
    where a.status in ('open', 'acknowledged')
      and (a.snoozed_until is null or a.snoozed_until <= now())
  ),
  synced as (
    select ops.ensure_incident(
      playbook_key,
      alert_id,
      dedupe_key,
      component,
      severity,
      title,
      metadata,
      health_impact
    ) as incident_id
    from source_alerts
  )
  select count(*) into v_synced from synced;

  return jsonb_build_object('synced_incidents', v_synced, 'synced_at', now());
end;
$$;

create or replace function ops.run_playbook_repairs(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_incident record;
  v_result jsonb;
  v_repaired integer := 0;
  v_failed integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  for v_incident in
    select
      i.id,
      i.playbook_key,
      i.repair_attempt_count,
      p.auto_repair_action
    from ops.incidents i
    join ops.incident_playbooks p on p.playbook_key = i.playbook_key
    where i.status in ('open', 'repairing', 'monitoring')
      and p.enabled = true
      and p.auto_repair_allowed = true
      and coalesce(p.auto_repair_action, '') <> ''
      and (
        i.last_repair_at is null
        or i.last_repair_at <= now() - interval '10 minutes'
      )
    order by
      case i.severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
      i.last_seen_at desc
    limit v_limit
  loop
    begin
      insert into ops.incident_events (incident_id, event_type, message, data)
      values (
        v_incident.id,
        'auto_repair_attempt',
        'Safe auto-repair started.',
        jsonb_build_object('action', v_incident.auto_repair_action)
      );

      if v_incident.auto_repair_action = 'run_notification_token_hygiene' then
        select ops.run_notification_token_hygiene() into v_result;
      elsif v_incident.auto_repair_action = 'enqueue_midtrans_pending_reconciliation' then
        select ops.enqueue_midtrans_pending_reconciliation(100) into v_result;
      elsif v_incident.auto_repair_action = 'run_safe_backend_repairs' then
        select ops.run_safe_backend_repairs() into v_result;
      elsif v_incident.auto_repair_action = 'capture_cron_health' then
        select ops.capture_cron_health() into v_result;
      elsif v_incident.auto_repair_action = 'cleanup_cron_operational_history' then
        select jsonb_build_object('deleted_rows', ops.cleanup_cron_operational_history()) into v_result;
      else
        raise exception 'Unsupported auto repair action: %', v_incident.auto_repair_action;
      end if;

      update ops.incidents
      set
        status = 'monitoring',
        repair_attempt_count = repair_attempt_count + 1,
        last_repair_at = now(),
        last_repair_result = coalesce(v_result, '{}'::jsonb)
      where id = v_incident.id;

      insert into ops.incident_events (incident_id, event_type, message, data)
      values (
        v_incident.id,
        'auto_repair_success',
        'Safe auto-repair completed. Incident remains in monitoring until health checks normalize.',
        coalesce(v_result, '{}'::jsonb)
      );

      v_repaired := v_repaired + 1;
    exception
      when others then
        update ops.incidents
        set
          status = 'repairing',
          repair_attempt_count = repair_attempt_count + 1,
          last_repair_at = now(),
          last_repair_result = jsonb_build_object('error', sqlerrm)
        where id = v_incident.id;

        insert into ops.incident_events (incident_id, event_type, message, data)
        values (
          v_incident.id,
          'auto_repair_failed',
          'Safe auto-repair failed.',
          jsonb_build_object('action', v_incident.auto_repair_action, 'error', sqlerrm)
        );

        v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'repaired', v_repaired,
    'failed', v_failed,
    'processed_at', now()
  );
end;
$$;

create or replace function ops.resolve_normalized_incidents()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_resolved integer := 0;
begin
  with resolved as (
    update ops.incidents i
    set status = 'resolved',
        resolved_at = now()
    where i.status in ('open', 'repairing', 'monitoring')
      and i.alert_id is not null
      and not exists (
        select 1
        from ops.backend_alerts a
        where a.id = i.alert_id
          and a.status in ('open', 'acknowledged')
      )
    returning i.id
  )
  insert into ops.incident_events (incident_id, event_type, message, data)
  select
    id,
    'resolved',
    'Incident auto-resolved because linked backend alert is no longer active.',
    '{}'::jsonb
  from resolved;

  get diagnostics v_resolved = row_count;

  return jsonb_build_object('resolved_incidents', v_resolved, 'resolved_at', now());
end;
$$;

create or replace function ops.evaluate_incident_escalations()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_escalated integer := 0;
begin
  with candidates as (
    select i.id, i.title, i.dedupe_key, i.component, i.severity, i.repair_attempt_count
    from ops.incidents i
    join ops.incident_playbooks p on p.playbook_key = i.playbook_key
    where i.status in ('open', 'repairing', 'monitoring')
      and i.repair_attempt_count >= p.escalation_after_attempts
      and i.escalated_at is null
  ),
  updated as (
    update ops.incidents i
    set status = 'escalated',
        escalated_at = now()
    from candidates c
    where i.id = c.id
    returning i.id, i.title, i.dedupe_key, i.component, i.severity, i.repair_attempt_count
  ),
  events as (
    insert into ops.incident_events (incident_id, event_type, message, data)
    select
      id,
      'escalated',
      'Incident escalated after safe auto-repair attempts reached the playbook threshold.',
      jsonb_build_object('repair_attempt_count', repair_attempt_count)
    from updated
    returning 1
  )
  select count(*) into v_escalated from events;

  insert into ops.backend_alerts (
    severity,
    component,
    title,
    body,
    dedupe_key,
    metadata
  )
  select
    case when severity = 'critical' then 'critical' else 'high' end,
    'self_healing',
    'Incident Membutuhkan Developer/Super Admin',
    title || ' sudah dicoba auto-repair beberapa kali dan perlu review manual.',
    'incident_escalated_' || dedupe_key,
    jsonb_build_object('incident_id', id, 'source_dedupe_key', dedupe_key)
  from ops.incidents
  where status = 'escalated'
    and escalated_at >= now() - interval '1 minute'
  on conflict do nothing;

  return jsonb_build_object('escalated_incidents', v_escalated, 'checked_at', now());
end;
$$;

create or replace function ops.calculate_backend_health_score()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, cron, net, pg_temp
as $$
declare
  v_open_high integer := 0;
  v_open_critical integer := 0;
  v_failed_cron integer := 0;
  v_missing_tokens integer := 0;
  v_midtrans_queue integer := 0;
  v_pg_net_failures integer := 0;
  v_escalated integer := 0;
  v_score integer := 100;
  v_status text;
  v_breakdown jsonb;
  v_recommendations jsonb := '[]'::jsonb;
begin
  select count(*) filter (where severity = 'high'),
         count(*) filter (where severity = 'critical')
  into v_open_high, v_open_critical
  from ops.backend_alerts
  where status in ('open', 'acknowledged')
    and dedupe_key not like 'backend_health_score_%';

  select count(*) into v_failed_cron
  from cron.job_run_details
  where start_time >= now() - interval '24 hours'
    and status is distinct from 'succeeded';

  select coalesce(sum(no_token_failure_count_7d), 0)::integer into v_missing_tokens
  from ops.notification_token_health
  where health_status = 'missing_token';

  select count(*) into v_midtrans_queue
  from ops.midtrans_reconciliation_queue
  where status in ('queued', 'processing', 'failed')
    and next_attempt_at <= now();

  select count(*) into v_pg_net_failures
  from net._http_response
  where created >= now() - interval '6 hours'
    and (status_code >= 400 or timed_out is true or error_msg is not null);

  select count(*) into v_escalated
  from ops.incidents
  where status = 'escalated';

  v_score := greatest(
    0,
    100
      - least(v_open_critical * 35, 70)
      - least(v_open_high * 15, 45)
      - least(v_failed_cron * 6, 24)
      - least(v_midtrans_queue * 5, 25)
      - least(v_pg_net_failures * 3, 18)
      - least(v_escalated * 20, 60)
      - case when v_missing_tokens > 0 then least(10 + v_missing_tokens, 25) else 0 end
  );

  v_status := case
    when v_score >= 90 then 'healthy'
    when v_score >= 75 then 'attention'
    when v_score >= 50 then 'degraded'
    else 'critical'
  end;

  v_breakdown := jsonb_build_object(
    'open_high_alerts', v_open_high,
    'open_critical_alerts', v_open_critical,
    'failed_cron_24h', v_failed_cron,
    'missing_token_failures_7d', v_missing_tokens,
    'midtrans_queue_ready', v_midtrans_queue,
    'pg_net_failures_6h', v_pg_net_failures,
    'escalated_incidents', v_escalated
  );

  if v_midtrans_queue > 0 then
    v_recommendations := v_recommendations || jsonb_build_array('Review Midtrans reconciliation queue. Status uang tetap wajib diverifikasi ke Midtrans.');
  end if;
  if v_missing_tokens > 0 then
    v_recommendations := v_recommendations || jsonb_build_array('Minta wali/admin yang missing token untuk login ulang atau periksa FCM registration.');
  end if;
  if v_failed_cron > 0 then
    v_recommendations := v_recommendations || jsonb_build_array('Cek cron.job_run_details untuk job gagal berulang.');
  end if;
  if v_escalated > 0 then
    v_recommendations := v_recommendations || jsonb_build_array('Ada incident escalated. Developer/super_admin perlu review manual.');
  end if;

  insert into ops.backend_health_snapshots (score, status, breakdown, recommendations)
  values (v_score, v_status, v_breakdown, v_recommendations);

  if v_status in ('degraded', 'critical') then
    perform ops.raise_backend_alert(
      case when v_status = 'critical' then 'critical' else 'high' end,
      'self_healing',
      'Backend Health Score Turun',
      'Health score backend saat ini ' || v_score::text || ' (' || v_status || ').',
      'backend_health_score_' || v_status,
      jsonb_build_object('score', v_score, 'status', v_status, 'breakdown', v_breakdown, 'recommendations', v_recommendations),
      array['super_admin']
    );
  end if;

  return jsonb_build_object(
    'score', v_score,
    'status', v_status,
    'breakdown', v_breakdown,
    'recommendations', v_recommendations,
    'captured_at', now()
  );
end;
$$;

create or replace function ops.run_self_healing_cycle()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, cron, net, pg_temp
as $$
declare
  v_alert_checks jsonb;
  v_sync jsonb;
  v_repairs jsonb;
  v_resolved jsonb;
  v_escalations jsonb;
  v_health jsonb;
begin
  select ops.run_backend_alert_checks() into v_alert_checks;
  select ops.sync_incidents_from_alerts() into v_sync;
  select ops.run_playbook_repairs(20) into v_repairs;
  select ops.resolve_normalized_incidents() into v_resolved;
  select ops.evaluate_incident_escalations() into v_escalations;
  select ops.calculate_backend_health_score() into v_health;

  return jsonb_build_object(
    'alert_checks', v_alert_checks,
    'incident_sync', v_sync,
    'repairs', v_repairs,
    'resolved', v_resolved,
    'escalations', v_escalations,
    'health', v_health,
    'ran_at', now()
  );
end;
$$;

create or replace function ops.generate_weekly_maintenance_digest(
  p_week_start date default date_trunc('week', now())::date
)
returns jsonb
language plpgsql
security definer
set search_path = ops, public, cron, net, pg_temp
as $$
declare
  v_week_start date := coalesce(p_week_start, date_trunc('week', now())::date);
  v_week_end date := coalesce(p_week_start, date_trunc('week', now())::date) + 6;
  v_health jsonb;
  v_score integer;
  v_summary jsonb;
  v_recommendations jsonb;
begin
  select ops.calculate_backend_health_score() into v_health;
  v_score := (v_health ->> 'score')::integer;
  v_recommendations := coalesce(v_health -> 'recommendations', '[]'::jsonb);

  v_summary := jsonb_build_object(
    'generated_at', now(),
    'week_start', v_week_start,
    'week_end', v_week_end,
    'alerts_by_severity', (
      select coalesce(jsonb_object_agg(severity, total), '{}'::jsonb)
      from (
        select severity, count(*) as total
        from ops.backend_alerts
        where last_seen_at::date between v_week_start and v_week_end
        group by severity
      ) s
    ),
    'incidents_by_status', (
      select coalesce(jsonb_object_agg(status, total), '{}'::jsonb)
      from (
        select status, count(*) as total
        from ops.incidents
        where last_seen_at::date between v_week_start and v_week_end
        group by status
      ) s
    ),
    'top_incidents', (
      select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
      from (
        select title, component, severity, status, occurrence_count, repair_attempt_count, last_seen_at
        from ops.incidents
        where last_seen_at::date between v_week_start and v_week_end
        order by occurrence_count desc, last_seen_at desc
        limit 10
      ) i
    ),
    'notification_token_health', (
      select coalesce(jsonb_object_agg(health_status, total), '{}'::jsonb)
      from (
        select health_status, count(*) as total
        from ops.notification_token_health
        group by health_status
      ) s
    ),
    'midtrans_queue_by_status', (
      select coalesce(jsonb_object_agg(status, total), '{}'::jsonb)
      from (
        select status, count(*) as total
        from ops.midtrans_reconciliation_queue
        group by status
      ) s
    ),
    'cron_failures_7d', (
      select count(*)
      from cron.job_run_details
      where start_time >= v_week_start::timestamptz
        and start_time < (v_week_end + 1)::timestamptz
        and status is distinct from 'succeeded'
    )
  );

  insert into ops.weekly_maintenance_digests (
    week_start,
    week_end,
    health_score,
    summary,
    recommendations,
    generated_at
  )
  values (
    v_week_start,
    v_week_end,
    v_score,
    v_summary,
    v_recommendations,
    now()
  )
  on conflict (week_start) do update
  set
    week_end = excluded.week_end,
    health_score = excluded.health_score,
    summary = excluded.summary,
    recommendations = excluded.recommendations,
    generated_at = now();

  return jsonb_build_object(
    'week_start', v_week_start,
    'week_end', v_week_end,
    'health_score', v_score,
    'summary', v_summary,
    'recommendations', v_recommendations
  );
end;
$$;

create or replace function ops.get_self_healing_center()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
begin
  perform app_private.assert_current_user_super_admin();

  return jsonb_build_object(
    'generated_at', now(),
    'latest_health', (
      select coalesce(to_jsonb(h), '{}'::jsonb)
      from (
        select score, status, breakdown, recommendations, captured_at
        from ops.backend_health_snapshots
        order by captured_at desc
        limit 1
      ) h
    ),
    'open_incidents', (
      select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
      from (
        select
          id,
          playbook_key,
          component,
          severity,
          title,
          status,
          occurrence_count,
          repair_attempt_count,
          health_impact,
          last_seen_at,
          last_repair_at,
          escalated_at,
          last_repair_result
        from ops.incidents
        where status <> 'resolved'
        order by
          case severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
          last_seen_at desc
        limit 50
      ) i
    ),
    'playbooks', (
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
      from (
        select playbook_key, component, severity, title, auto_repair_allowed, requires_approval, escalation_after_attempts, enabled
        from ops.incident_playbooks
        order by component, severity, playbook_key
      ) p
    ),
    'latest_weekly_digest', (
      select coalesce(to_jsonb(d), '{}'::jsonb)
      from (
        select week_start, week_end, generated_at, health_score, summary, recommendations
        from ops.weekly_maintenance_digests
        order by week_start desc
        limit 1
      ) d
    )
  );
end;
$$;

create or replace function ops.get_incident_timeline(p_incident_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
begin
  perform app_private.assert_current_user_super_admin();

  return jsonb_build_object(
    'incident', (
      select to_jsonb(i)
      from ops.incidents i
      where i.id = p_incident_id
    ),
    'events', (
      select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at asc), '[]'::jsonb)
      from ops.incident_events e
      where e.incident_id = p_incident_id
    )
  );
end;
$$;

create or replace function public.get_self_healing_center()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select ops.get_self_healing_center();
$$;

create or replace function public.get_incident_timeline(p_incident_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select ops.get_incident_timeline(p_incident_id);
$$;

create or replace function public.run_super_admin_safe_repair()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.assert_current_user_super_admin();
  return ops.run_self_healing_cycle();
end;
$$;

revoke all on function ops.seed_incident_playbooks() from public, anon, authenticated;
revoke all on function ops.ensure_incident(text, uuid, text, text, text, text, jsonb, integer) from public, anon, authenticated;
revoke all on function ops.sync_incidents_from_alerts() from public, anon, authenticated;
revoke all on function ops.run_playbook_repairs(integer) from public, anon, authenticated;
revoke all on function ops.resolve_normalized_incidents() from public, anon, authenticated;
revoke all on function ops.evaluate_incident_escalations() from public, anon, authenticated;
revoke all on function ops.calculate_backend_health_score() from public, anon, authenticated;
revoke all on function ops.run_self_healing_cycle() from public, anon, authenticated;
revoke all on function ops.generate_weekly_maintenance_digest(date) from public, anon, authenticated;
revoke all on function ops.get_self_healing_center() from public, anon, authenticated;
revoke all on function ops.get_incident_timeline(uuid) from public, anon, authenticated;

grant execute on function ops.seed_incident_playbooks() to service_role;
grant execute on function ops.ensure_incident(text, uuid, text, text, text, text, jsonb, integer) to service_role;
grant execute on function ops.sync_incidents_from_alerts() to service_role;
grant execute on function ops.run_playbook_repairs(integer) to service_role;
grant execute on function ops.resolve_normalized_incidents() to service_role;
grant execute on function ops.evaluate_incident_escalations() to service_role;
grant execute on function ops.calculate_backend_health_score() to service_role;
grant execute on function ops.run_self_healing_cycle() to service_role;
grant execute on function ops.generate_weekly_maintenance_digest(date) to service_role;
grant execute on function ops.get_self_healing_center() to service_role;
grant execute on function ops.get_incident_timeline(uuid) to service_role;

revoke all on function public.get_self_healing_center() from public, anon;
grant execute on function public.get_self_healing_center() to authenticated, service_role;

revoke all on function public.get_incident_timeline(uuid) from public, anon;
grant execute on function public.get_incident_timeline(uuid) to authenticated, service_role;

revoke all on function public.run_super_admin_safe_repair() from public, anon;
grant execute on function public.run_super_admin_safe_repair() to authenticated, service_role;

select ops.seed_incident_playbooks();

do $$
begin
  if exists (select 1 from cron.job where jobname = 'backend-self-healing-cycle-every-10-min') then
    perform cron.unschedule('backend-self-healing-cycle-every-10-min');
  end if;
  if exists (select 1 from cron.job where jobname = 'backend-health-score-hourly') then
    perform cron.unschedule('backend-health-score-hourly');
  end if;
  if exists (select 1 from cron.job where jobname = 'backend-weekly-maintenance-digest') then
    perform cron.unschedule('backend-weekly-maintenance-digest');
  end if;
end $$;

select cron.schedule(
  'backend-self-healing-cycle-every-10-min',
  '3,13,23,33,43,53 * * * *',
  $$ select ops.run_self_healing_cycle(); $$
);

select cron.schedule(
  'backend-health-score-hourly',
  '17 * * * *',
  $$ select ops.calculate_backend_health_score(); $$
);

select cron.schedule(
  'backend-weekly-maintenance-digest',
  '45 23 * * 0',
  $$ select ops.generate_weekly_maintenance_digest(); $$
);
