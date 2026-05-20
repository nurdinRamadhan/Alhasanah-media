-- Backend enterprise priority 1-6:
-- 1 token hygiene, 2 Midtrans reconciliation queue, 3 alert action center,
-- 4 AI incident context, 5 safe repair job, 6 developer diagnostics RPC.

create table if not exists ops.notification_token_health (
  user_id uuid primary key,
  active_device_count integer not null default 0,
  inactive_device_count integer not null default 0,
  stale_device_count integer not null default 0,
  no_token_failure_count_7d integer not null default 0,
  last_failure_at timestamptz,
  health_status text not null default 'unknown'
    check (health_status in ('healthy', 'missing_token', 'stale', 'inactive', 'unknown')),
  checked_at timestamptz not null default now()
);

create index if not exists idx_notification_token_health_status
  on ops.notification_token_health (health_status, checked_at desc);

alter table ops.notification_token_health enable row level security;

create table if not exists ops.midtrans_reconciliation_queue (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  transaksi_keuangan_id uuid,
  detected_status text,
  amount bigint,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'synced', 'manual_review', 'failed', 'ignored')),
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_midtrans_reconciliation_queue_status_next
  on ops.midtrans_reconciliation_queue (status, next_attempt_at, created_at);

alter table ops.midtrans_reconciliation_queue enable row level security;

alter table ops.cron_health_snapshots enable row level security;
alter table ops.backend_alerts enable row level security;
alter table ops.finance_audit_events enable row level security;

alter table ops.backend_alerts
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid,
  add column if not exists assigned_to uuid,
  add column if not exists snoozed_until timestamptz,
  add column if not exists resolution_note text,
  add column if not exists recommended_action text;

create or replace function ops.run_notification_token_hygiene()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_deactivated_stale integer := 0;
  v_missing_token_users integer := 0;
  v_stale_users integer := 0;
begin
  with stale as (
    update public.user_devices
    set is_active = false
    where is_active = true
      and coalesce(last_seen_at, last_seen, now()) < now() - interval '180 days'
    returning 1
  )
  select count(*) into v_deactivated_stale from stale;

  with base as (
    select
      p.id as user_id,
      count(d.id) filter (where d.is_active = true) as active_device_count,
      count(d.id) filter (where d.is_active = false) as inactive_device_count,
      count(d.id) filter (
        where coalesce(d.last_seen_at, d.last_seen, now()) < now() - interval '90 days'
      ) as stale_device_count,
      count(q.id) filter (
        where q.status = 'failed'
          and q.created_at >= now() - interval '7 days'
          and coalesce(q.error_message, '') ~* 'no registered (fcm )?tokens?'
      ) as no_token_failure_count_7d,
      max(q.created_at) filter (
        where q.status = 'failed'
          and q.created_at >= now() - interval '7 days'
          and coalesce(q.error_message, '') ~* 'no registered (fcm )?tokens?'
      ) as last_failure_at
    from public.profiles p
    left join public.user_devices d on d.user_id = p.id
    left join public.notification_queue q on q.user_id = p.id
    where coalesce(p.is_active, true) = true
    group by p.id
  ),
  upserted as (
    insert into ops.notification_token_health (
      user_id,
      active_device_count,
      inactive_device_count,
      stale_device_count,
      no_token_failure_count_7d,
      last_failure_at,
      health_status,
      checked_at
    )
    select
      user_id,
      active_device_count::integer,
      inactive_device_count::integer,
      stale_device_count::integer,
      no_token_failure_count_7d::integer,
      last_failure_at,
      case
        when active_device_count = 0 and no_token_failure_count_7d > 0 then 'missing_token'
        when active_device_count = 0 then 'inactive'
        when stale_device_count > 0 then 'stale'
        else 'healthy'
      end,
      now()
    from base
    on conflict (user_id) do update
    set
      active_device_count = excluded.active_device_count,
      inactive_device_count = excluded.inactive_device_count,
      stale_device_count = excluded.stale_device_count,
      no_token_failure_count_7d = excluded.no_token_failure_count_7d,
      last_failure_at = excluded.last_failure_at,
      health_status = excluded.health_status,
      checked_at = now()
    returning health_status
  )
  select
    count(*) filter (where health_status = 'missing_token'),
    count(*) filter (where health_status = 'stale')
  into v_missing_token_users, v_stale_users
  from upserted;

  if v_missing_token_users > 0 then
    perform ops.raise_backend_alert(
      'medium',
      'notification',
      'Device Wali/Admin Belum Siap Push',
      v_missing_token_users::text || ' user aktif tidak memiliki FCM token aktif tetapi menerima notifikasi.',
      'notification_missing_fcm_tokens',
      jsonb_build_object('missing_token_users', v_missing_token_users, 'deactivated_stale_devices', v_deactivated_stale),
      array['super_admin', 'rois']
    );
  end if;

  return jsonb_build_object(
    'checked_at', now(),
    'deactivated_stale_devices', v_deactivated_stale,
    'missing_token_users', v_missing_token_users,
    'stale_users', v_stale_users
  );
end;
$$;

create or replace function ops.enqueue_midtrans_pending_reconciliation(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_inserted integer := 0;
  v_existing integer := 0;
begin
  with candidates as (
    select
      t.id,
      t.midtrans_order_id,
      t.status_transaksi,
      t.jumlah,
      t.created_at,
      t.jenis_transaksi,
      t.kategori
    from public.transaksi_keuangan t
    where t.midtrans_order_id is not null
      and t.created_at >= now() - interval '14 days'
      and t.created_at <= now() - interval '2 hours'
      and lower(coalesce(t.status_transaksi, t.status::text, '')) not in (
        'success', 'sukses', 'settlement', 'capture', 'paid', 'lunas', 'berhasil', 'failed', 'expire', 'cancel', 'deny'
      )
    order by t.created_at
    limit greatest(coalesce(p_limit, 100), 1)
  ),
  inserted as (
    insert into ops.midtrans_reconciliation_queue (
      order_id,
      transaksi_keuangan_id,
      detected_status,
      amount,
      metadata
    )
    select
      midtrans_order_id,
      id,
      status_transaksi,
      jumlah,
      jsonb_build_object(
        'created_at', created_at,
        'jenis_transaksi', jenis_transaksi,
        'kategori', kategori,
        'source', 'auto_detect_pending_midtrans'
      )
    from candidates
    on conflict (order_id) do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  select count(*) into v_existing
  from ops.midtrans_reconciliation_queue
  where status in ('queued', 'processing', 'failed')
    and next_attempt_at <= now();

  if v_inserted > 0 then
    perform ops.raise_backend_alert(
      'high',
      'payment',
      'Antrean Rekonsiliasi Midtrans Dibuat',
      v_inserted::text || ' transaksi Midtrans pending lama masuk antrean rekonsiliasi.',
      'midtrans_reconciliation_queue_active',
      jsonb_build_object('new_queue_items', v_inserted, 'ready_queue_items', v_existing)
    );
  end if;

  return jsonb_build_object(
    'queued_new', v_inserted,
    'ready_queue_items', v_existing,
    'checked_at', now()
  );
end;
$$;

create or replace function ops.update_backend_alert_action(
  p_alert_id uuid,
  p_action text,
  p_actor_id uuid default auth.uid(),
  p_assigned_to uuid default null,
  p_snoozed_until timestamptz default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
begin
  perform app_private.assert_current_user_super_admin();

  if p_action = 'acknowledge' then
    update ops.backend_alerts
    set status = 'acknowledged',
        acknowledged_at = now(),
        acknowledged_by = p_actor_id,
        resolution_note = coalesce(p_note, resolution_note)
    where id = p_alert_id and status <> 'resolved';
  elsif p_action = 'assign' then
    update ops.backend_alerts
    set assigned_to = p_assigned_to,
        resolution_note = coalesce(p_note, resolution_note)
    where id = p_alert_id and status <> 'resolved';
  elsif p_action = 'snooze' then
    update ops.backend_alerts
    set snoozed_until = coalesce(p_snoozed_until, now() + interval '1 hour'),
        resolution_note = coalesce(p_note, resolution_note)
    where id = p_alert_id and status <> 'resolved';
  elsif p_action = 'resolve' then
    update ops.backend_alerts
    set status = 'resolved',
        resolved_at = now(),
        resolved_by = p_actor_id,
        resolution_note = coalesce(p_note, resolution_note)
    where id = p_alert_id;
  else
    raise exception 'Unsupported alert action: %', p_action;
  end if;

  return (
    select to_jsonb(a)
    from ops.backend_alerts a
    where a.id = p_alert_id
  );
end;
$$;

create or replace function ops.get_ai_incident_context(p_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path = ops, public, cron, net, pg_temp
as $$
declare
  v_hours integer := least(greatest(coalesce(p_hours, 24), 1), 168);
begin
  perform app_private.assert_current_user_super_admin();

  return jsonb_build_object(
    'generated_at', now(),
    'window_hours', v_hours,
    'incident_policy', jsonb_build_object(
      'llm_may_recommend', true,
      'llm_may_execute_repairs', false,
      'money_status_changes_require_midtrans_verification', true
    ),
    'open_alerts', (
      select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      from (
        select severity, component, title, body, occurrence_count, recommended_action, metadata, last_seen_at
        from ops.backend_alerts
        where status in ('open', 'acknowledged')
          and (snoozed_until is null or snoozed_until <= now())
        order by
          case severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
          last_seen_at desc
        limit 50
      ) a
    ),
    'midtrans_reconciliation_queue', (
      select coalesce(jsonb_object_agg(status, total), '{}'::jsonb)
      from (
        select status, count(*) as total
        from ops.midtrans_reconciliation_queue
        group by status
      ) q
    ),
    'notification_token_health', (
      select coalesce(jsonb_object_agg(health_status, total), '{}'::jsonb)
      from (
        select health_status, count(*) as total
        from ops.notification_token_health
        group by health_status
      ) h
    ),
    'recent_finance_audit_events', (
      select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
      from (
        select table_name, record_id, operation, changed_fields, metadata, occurred_at
        from ops.finance_audit_events
        where occurred_at >= now() - make_interval(hours => v_hours)
        order by occurred_at desc
        limit 25
      ) e
    )
  );
end;
$$;

create or replace function ops.run_safe_backend_repairs()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_retry_count integer := 0;
  v_token_hygiene jsonb;
  v_midtrans_queue jsonb;
  v_resolved_alerts integer := 0;
begin
  select ops.retry_transient_notification_failures(50) into v_retry_count;
  select ops.run_notification_token_hygiene() into v_token_hygiene;
  select ops.enqueue_midtrans_pending_reconciliation(100) into v_midtrans_queue;

  with resolved as (
    update ops.backend_alerts a
    set status = 'resolved',
        resolved_at = now(),
        resolution_note = coalesce(resolution_note, 'Auto-resolved by safe backend repair after condition normalized.')
    where status in ('open', 'acknowledged')
      and dedupe_key = 'notification_pending_stale'
      and not exists (
        select 1
        from public.notification_queue q
        where q.status = 'pending'
          and q.scheduled_at <= now() - interval '10 minutes'
      )
    returning 1
  )
  select count(*) into v_resolved_alerts from resolved;

  return jsonb_build_object(
    'requeued_transient_notifications', v_retry_count,
    'token_hygiene', v_token_hygiene,
    'midtrans_queue', v_midtrans_queue,
    'auto_resolved_alerts', v_resolved_alerts,
    'repaired_at', now()
  );
end;
$$;

create or replace function ops.get_backend_diagnostics()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, cron, net, pg_temp
as $$
begin
  perform app_private.assert_current_user_super_admin();

  return jsonb_build_object(
    'generated_at', now(),
    'cron', jsonb_build_object(
      'active_jobs', (select count(*) from cron.job where active),
      'failed_runs_24h', (
        select count(*) from cron.job_run_details
        where start_time >= now() - interval '24 hours'
          and status is distinct from 'succeeded'
      ),
      'latest_runs', (
        select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
        from (
          select j.jobname, r.status, r.start_time, r.end_time
          from cron.job j
          left join lateral (
            select status, start_time, end_time
            from cron.job_run_details
            where jobid = j.jobid
            order by start_time desc
            limit 1
          ) r on true
          order by j.jobname
        ) r
      )
    ),
    'notifications', jsonb_build_object(
      'queue_by_status', (
        select coalesce(jsonb_object_agg(status, total), '{}'::jsonb)
        from (select status, count(*) as total from public.notification_queue group by status) s
      ),
      'token_health', (
        select coalesce(jsonb_object_agg(health_status, total), '{}'::jsonb)
        from (select health_status, count(*) as total from ops.notification_token_health group by health_status) h
      )
    ),
    'payments', jsonb_build_object(
      'midtrans_queue_by_status', (
        select coalesce(jsonb_object_agg(status, total), '{}'::jsonb)
        from (select status, count(*) as total from ops.midtrans_reconciliation_queue group by status) q
      ),
      'stale_pending_midtrans', (
        select count(*)
        from public.transaksi_keuangan
        where midtrans_order_id is not null
          and created_at >= now() - interval '14 days'
          and created_at <= now() - interval '2 hours'
          and lower(coalesce(status_transaksi, status::text, '')) not in (
            'success', 'sukses', 'settlement', 'capture', 'paid', 'lunas', 'berhasil', 'failed', 'expire', 'cancel', 'deny'
          )
      )
    ),
    'alerts', jsonb_build_object(
      'open_by_severity', (
        select coalesce(jsonb_object_agg(severity, total), '{}'::jsonb)
        from (select severity, count(*) as total from ops.backend_alerts where status <> 'resolved' group by severity) a
      )
    ),
    'pg_net', jsonb_build_object(
      'failures_6h', (
        select count(*)
        from net._http_response
        where created >= now() - interval '6 hours'
          and (status_code >= 400 or timed_out is true or error_msg is not null)
      )
    )
  );
end;
$$;

create or replace function public.update_backend_alert_action(
  p_alert_id uuid,
  p_action text,
  p_assigned_to uuid default null,
  p_snoozed_until timestamptz default null,
  p_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select ops.update_backend_alert_action(p_alert_id, p_action, auth.uid(), p_assigned_to, p_snoozed_until, p_note);
$$;

create or replace function public.get_ai_incident_context(p_hours integer default 24)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select ops.get_ai_incident_context(p_hours);
$$;

create or replace function public.get_backend_diagnostics()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select ops.get_backend_diagnostics();
$$;

revoke all on function ops.run_notification_token_hygiene() from public, anon, authenticated;
revoke all on function ops.enqueue_midtrans_pending_reconciliation(integer) from public, anon, authenticated;
revoke all on function ops.update_backend_alert_action(uuid, text, uuid, uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function ops.get_ai_incident_context(integer) from public, anon, authenticated;
revoke all on function ops.run_safe_backend_repairs() from public, anon, authenticated;
revoke all on function ops.get_backend_diagnostics() from public, anon, authenticated;

grant execute on function ops.run_notification_token_hygiene() to service_role;
grant execute on function ops.enqueue_midtrans_pending_reconciliation(integer) to service_role;
grant execute on function ops.update_backend_alert_action(uuid, text, uuid, uuid, timestamptz, text) to service_role;
grant execute on function ops.get_ai_incident_context(integer) to service_role;
grant execute on function ops.run_safe_backend_repairs() to service_role;
grant execute on function ops.get_backend_diagnostics() to service_role;

revoke all on function public.update_backend_alert_action(uuid, text, uuid, timestamptz, text) from public, anon;
grant execute on function public.update_backend_alert_action(uuid, text, uuid, timestamptz, text) to authenticated, service_role;

revoke all on function public.get_ai_incident_context(integer) from public, anon;
grant execute on function public.get_ai_incident_context(integer) to authenticated, service_role;

revoke all on function public.get_backend_diagnostics() from public, anon;
grant execute on function public.get_backend_diagnostics() to authenticated, service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'backend-token-hygiene-hourly') then
    perform cron.unschedule('backend-token-hygiene-hourly');
  end if;
  if exists (select 1 from cron.job where jobname = 'backend-midtrans-reconcile-queue-every-30-min') then
    perform cron.unschedule('backend-midtrans-reconcile-queue-every-30-min');
  end if;
  if exists (select 1 from cron.job where jobname = 'backend-safe-repairs-every-15-min') then
    perform cron.unschedule('backend-safe-repairs-every-15-min');
  end if;
end $$;

select cron.schedule(
  'backend-token-hygiene-hourly',
  '25 * * * *',
  $$ select ops.run_notification_token_hygiene(); $$
);

select cron.schedule(
  'backend-midtrans-reconcile-queue-every-30-min',
  '5,35 * * * *',
  $$ select ops.enqueue_midtrans_pending_reconciliation(100); $$
);

select cron.schedule(
  'backend-safe-repairs-every-15-min',
  '7,22,37,52 * * * *',
  $$ select ops.run_safe_backend_repairs(); $$
);
