-- Phase 2 backend operations: private alerting/control tower.
-- This is detection-only and additive. It does not mutate payment, wallet, or admin panel workflows.

create table if not exists ops.backend_alerts (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('info', 'medium', 'high', 'critical')),
  component text not null,
  title text not null,
  body text not null,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

create unique index if not exists idx_backend_alerts_open_dedupe
  on ops.backend_alerts (dedupe_key)
  where status = 'open';

create index if not exists idx_backend_alerts_status_severity_last_seen
  on ops.backend_alerts (status, severity, last_seen_at desc);

create index if not exists idx_notification_queue_pending_ready
  on public.notification_queue (scheduled_at, priority, created_at)
  where status = 'pending';

create index if not exists idx_profiles_active_role
  on public.profiles (role, is_active)
  where coalesce(is_active, true) = true;

create or replace function ops.raise_backend_alert(
  p_severity text,
  p_component text,
  p_title text,
  p_body text,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_notify_roles text[] default array['super_admin', 'bendahara', 'rois']
)
returns uuid
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_alert_id uuid;
begin
  if p_severity not in ('info', 'medium', 'high', 'critical') then
    raise exception 'Invalid alert severity: %', p_severity;
  end if;

  update ops.backend_alerts
  set
    severity = p_severity,
    component = p_component,
    title = p_title,
    body = p_body,
    metadata = coalesce(p_metadata, '{}'::jsonb),
    occurrence_count = occurrence_count + 1,
    last_seen_at = now()
  where dedupe_key = p_dedupe_key
    and status = 'open'
  returning id into v_alert_id;

  if v_alert_id is null then
    insert into ops.backend_alerts (
      severity,
      component,
      title,
      body,
      dedupe_key,
      metadata
    )
    values (
      p_severity,
      p_component,
      p_title,
      p_body,
      p_dedupe_key,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_alert_id;
  end if;

  if p_severity in ('high', 'critical') then
    insert into public.notification_queue (
      user_id,
      title,
      body,
      data,
      source_table,
      event_type,
      priority,
      channel,
      reference_id,
      scheduled_at
    )
    select
      p.id,
      p_title,
      p_body,
      jsonb_build_object(
        'type', 'backend_alert',
        'alert_id', v_alert_id,
        'severity', p_severity,
        'component', p_component,
        'dedupe_key', p_dedupe_key,
        'automatic', true
      ),
      'ops.backend_alerts',
      'ops.backend_alert',
      case when p_severity = 'critical' then 'critical' else 'high' end,
      'push',
      v_alert_id::text,
      now()
    from public.profiles p
    where p.role = any(p_notify_roles)
      and coalesce(p.is_active, true) = true
      and not exists (
        select 1
        from public.notification_queue q
        where q.user_id = p.id
          and q.event_type = 'ops.backend_alert'
          and q.reference_id = v_alert_id::text
      );
  end if;

  return v_alert_id;
end;
$$;

create or replace function ops.run_backend_alert_checks()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, cron, net, pg_temp
as $$
declare
  v_cron_failed integer := 0;
  v_cron_slow integer := 0;
  v_pg_net_failed integer := 0;
  v_stale_pending_notifications integer := 0;
  v_failed_notifications_24h integer := 0;
  v_stale_midtrans_pending integer := 0;
  v_success_webhook_without_tx integer := 0;
begin
  select count(*) into v_cron_failed
  from cron.job_run_details
  where start_time >= now() - interval '1 hour'
    and status is distinct from 'succeeded';

  select count(*) into v_cron_slow
  from cron.job_run_details
  where start_time >= now() - interval '1 hour'
    and end_time is not null
    and end_time - start_time > interval '2 minutes';

  select count(*) into v_pg_net_failed
  from net._http_response
  where created >= now() - interval '1 hour'
    and (status_code >= 400 or timed_out is true or error_msg is not null);

  select count(*) into v_stale_pending_notifications
  from public.notification_queue
  where status = 'pending'
    and scheduled_at <= now() - interval '10 minutes';

  select count(*) into v_failed_notifications_24h
  from public.notification_queue
  where status = 'failed'
    and created_at >= now() - interval '24 hours';

  select count(*) into v_stale_midtrans_pending
  from public.transaksi_keuangan
  where midtrans_order_id is not null
    and created_at >= now() - interval '7 days'
    and created_at <= now() - interval '2 hours'
    and lower(coalesce(status_transaksi, status::text, '')) not in (
      'success', 'sukses', 'settlement', 'capture', 'paid', 'lunas', 'berhasil'
    );

  select count(*) into v_success_webhook_without_tx
  from public.midtrans_webhook_logs l
  where l.created_at >= now() - interval '24 hours'
    and lower(coalesce(l.transaction_status, '')) in ('settlement', 'capture')
    and not exists (
      select 1
      from public.transaksi_keuangan t
      where t.midtrans_order_id = l.order_id
    );

  if v_cron_failed > 0 then
    perform ops.raise_backend_alert(
      'critical',
      'cron',
      'Cron Job Gagal',
      v_cron_failed::text || ' cron run gagal dalam 1 jam terakhir.',
      'cron_failed_1h',
      jsonb_build_object('failed_runs_1h', v_cron_failed)
    );
  end if;

  if v_cron_slow > 0 then
    perform ops.raise_backend_alert(
      'high',
      'cron',
      'Cron Job Melambat',
      v_cron_slow::text || ' cron run berjalan lebih dari 2 menit dalam 1 jam terakhir.',
      'cron_slow_1h',
      jsonb_build_object('slow_runs_1h', v_cron_slow)
    );
  end if;

  if v_pg_net_failed > 0 then
    perform ops.raise_backend_alert(
      'high',
      'pg_net',
      'HTTP Worker Backend Gagal',
      v_pg_net_failed::text || ' request pg_net gagal dalam 1 jam terakhir.',
      'pg_net_failed_1h',
      jsonb_build_object('pg_net_failures_1h', v_pg_net_failed)
    );
  end if;

  if v_stale_pending_notifications > 0 then
    perform ops.raise_backend_alert(
      'high',
      'notification',
      'Antrian Notifikasi Tertahan',
      v_stale_pending_notifications::text || ' notifikasi pending belum terkirim lebih dari 10 menit.',
      'notification_pending_stale',
      jsonb_build_object('stale_pending_notifications', v_stale_pending_notifications)
    );
  end if;

  if v_failed_notifications_24h >= 25 then
    perform ops.raise_backend_alert(
      'medium',
      'notification',
      'Failure Notifikasi Meningkat',
      v_failed_notifications_24h::text || ' notifikasi gagal dalam 24 jam terakhir. Umumnya ini karena device belum memiliki FCM token.',
      'notification_failed_24h_threshold',
      jsonb_build_object('failed_notifications_24h', v_failed_notifications_24h),
      array['super_admin', 'bendahara', 'rois']
    );
  end if;

  if v_stale_midtrans_pending > 0 then
    perform ops.raise_backend_alert(
      'high',
      'payment',
      'Transaksi Midtrans Pending Terlalu Lama',
      v_stale_midtrans_pending::text || ' transaksi Midtrans masih pending lebih dari 2 jam.',
      'midtrans_stale_pending',
      jsonb_build_object('stale_midtrans_pending', v_stale_midtrans_pending)
    );
  end if;

  if v_success_webhook_without_tx > 0 then
    perform ops.raise_backend_alert(
      'critical',
      'payment',
      'Webhook Sukses Tanpa Transaksi Lokal',
      v_success_webhook_without_tx::text || ' webhook Midtrans sukses tidak memiliki transaksi_keuangan yang cocok.',
      'midtrans_success_webhook_without_transaction',
      jsonb_build_object('success_webhook_without_transaction', v_success_webhook_without_tx)
    );
  end if;

  return jsonb_build_object(
    'checked_at', now(),
    'cron_failed_1h', v_cron_failed,
    'cron_slow_1h', v_cron_slow,
    'pg_net_failed_1h', v_pg_net_failed,
    'stale_pending_notifications', v_stale_pending_notifications,
    'failed_notifications_24h', v_failed_notifications_24h,
    'stale_midtrans_pending', v_stale_midtrans_pending,
    'success_webhook_without_transaction_24h', v_success_webhook_without_tx
  );
end;
$$;

create or replace function ops.resolve_backend_alert(
  p_alert_id uuid,
  p_actor_id uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_id
      and coalesce(p.is_active, true) = true
      and p.role in ('super_admin', 'bendahara', 'rois')
  ) then
    raise exception 'Tidak berwenang menyelesaikan backend alert';
  end if;

  update ops.backend_alerts
  set
    status = 'resolved',
    resolved_at = now(),
    resolved_by = p_actor_id
  where id = p_alert_id
    and status <> 'resolved';
end;
$$;

revoke all on function ops.raise_backend_alert(text, text, text, text, text, jsonb, text[]) from public, anon, authenticated;
grant execute on function ops.raise_backend_alert(text, text, text, text, text, jsonb, text[]) to service_role;

revoke all on function ops.run_backend_alert_checks() from public, anon, authenticated;
grant execute on function ops.run_backend_alert_checks() to service_role;

revoke all on function ops.resolve_backend_alert(uuid, uuid) from public, anon;
grant execute on function ops.resolve_backend_alert(uuid, uuid) to authenticated, service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'backend-alert-checks-every-5-min') then
    perform cron.unschedule('backend-alert-checks-every-5-min');
  end if;
end $$;

select cron.schedule(
  'backend-alert-checks-every-5-min',
  '*/5 * * * *',
  $$ select ops.run_backend_alert_checks(); $$
);
