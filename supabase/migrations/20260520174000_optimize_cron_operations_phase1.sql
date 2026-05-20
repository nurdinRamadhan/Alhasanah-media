-- Phase 1 backend operations hardening:
-- - avoid empty push-notification Edge Function calls
-- - add lightweight cron health snapshots
-- - retry only transient notification failures
-- - prune operational cron/http histories

create schema if not exists ops;

revoke all on schema ops from public;
revoke all on schema ops from anon;
revoke all on schema ops from authenticated;
grant usage on schema ops to service_role;

create table if not exists ops.cron_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  snapshot jsonb not null
);

create index if not exists idx_cron_health_snapshots_captured_at
  on ops.cron_health_snapshots (captured_at desc);

create or replace function ops.capture_cron_health()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, cron, net, pg_temp
as $$
declare
  v_snapshot jsonb;
begin
  select jsonb_build_object(
    'captured_at', now(),
    'active_jobs', (select count(*) from cron.job where active),
    'inactive_jobs', (select count(*) from cron.job where not active),
    'failed_runs_24h', (
      select count(*)
      from cron.job_run_details
      where start_time >= now() - interval '24 hours'
        and status is distinct from 'succeeded'
    ),
    'slow_runs_24h', (
      select count(*)
      from cron.job_run_details
      where start_time >= now() - interval '24 hours'
        and end_time is not null
        and end_time - start_time > interval '2 minutes'
    ),
    'pending_notifications', (
      select count(*)
      from public.notification_queue
      where status = 'pending'
        and scheduled_at <= now()
    ),
    'failed_notifications_24h', (
      select count(*)
      from public.notification_queue
      where status = 'failed'
        and created_at >= now() - interval '24 hours'
    ),
    'pg_net_failures_6h', (
      select count(*)
      from net._http_response
      where created >= now() - interval '6 hours'
        and (status_code >= 400 or timed_out is true or error_msg is not null)
    )
  )
  into v_snapshot;

  insert into ops.cron_health_snapshots (snapshot)
  values (v_snapshot);

  delete from ops.cron_health_snapshots
  where captured_at < now() - interval '30 days';

  return v_snapshot;
end;
$$;

create or replace function ops.retry_transient_notification_failures(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = ops, public, pg_temp
as $$
declare
  v_updated integer := 0;
begin
  with retryable as (
    select
      id,
      coalesce((data->>'retry_count')::integer, 0) as retry_count
    from public.notification_queue
    where status = 'failed'
      and created_at >= now() - interval '7 days'
      and coalesce((data->>'retry_count')::integer, 0) < 3
      and coalesce(error_message, '') !~* 'no registered (fcm )?tokens?'
      and coalesce(error_message, '') ~* '(timeout|timed out|temporar|network|internal|token\\(s\\) failed)'
    order by created_at
    limit greatest(p_limit, 0)
  ),
  updated as (
    update public.notification_queue q
    set
      status = 'pending',
      scheduled_at = now(),
      error_message = null,
      data = jsonb_set(
        coalesce(q.data, '{}'::jsonb),
        '{retry_count}',
        to_jsonb(retryable.retry_count + 1),
        true
      )
    from retryable
    where q.id = retryable.id
    returning 1
  )
  select count(*) into v_updated from updated;

  return v_updated;
end;
$$;

create or replace function ops.cleanup_cron_operational_history()
returns jsonb
language plpgsql
security definer
set search_path = ops, public, cron, net, pg_temp
as $$
declare
  v_cron_deleted integer := 0;
  v_net_deleted integer := 0;
begin
  with deleted as (
    delete from cron.job_run_details
    where end_time < now() - interval '30 days'
    returning 1
  )
  select count(*) into v_cron_deleted from deleted;

  with deleted as (
    delete from net._http_response
    where created < now() - interval '12 hours'
    returning 1
  )
  select count(*) into v_net_deleted from deleted;

  return jsonb_build_object(
    'cron_job_run_details_deleted', v_cron_deleted,
    'pg_net_http_responses_deleted', v_net_deleted,
    'cleaned_at', now()
  );
end;
$$;

revoke all on function ops.capture_cron_health() from public;
revoke all on function ops.capture_cron_health() from anon;
revoke all on function ops.capture_cron_health() from authenticated;
grant execute on function ops.capture_cron_health() to service_role;

revoke all on function ops.retry_transient_notification_failures(integer) from public;
revoke all on function ops.retry_transient_notification_failures(integer) from anon;
revoke all on function ops.retry_transient_notification_failures(integer) from authenticated;
grant execute on function ops.retry_transient_notification_failures(integer) to service_role;

revoke all on function ops.cleanup_cron_operational_history() from public;
revoke all on function ops.cleanup_cron_operational_history() from anon;
revoke all on function ops.cleanup_cron_operational_history() from authenticated;
grant execute on function ops.cleanup_cron_operational_history() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'wallet-push-notifications-every-minute') then
    perform cron.alter_job(
      job_id := (select jobid from cron.job where jobname = 'wallet-push-notifications-every-minute'),
      command := $cmd$
        do $push$
        begin
          if exists (
            select 1
            from public.notification_queue
            where status = 'pending'
              and scheduled_at <= now()
          ) then
            perform net.http_post(
              url := 'https://sldobkbolvrahlnowrga.supabase.co/functions/v1/push-notifications',
              headers := jsonb_build_object('Content-Type', 'application/json'),
              body := jsonb_build_object('source', 'pg_cron', 'limit', 25),
              timeout_milliseconds := 10000
            );
          end if;
        end
        $push$;
      $cmd$
    );
  end if;

  if exists (select 1 from cron.job where jobname = 'backend-cron-health-hourly') then
    perform cron.unschedule('backend-cron-health-hourly');
  end if;

  if exists (select 1 from cron.job where jobname = 'backend-notification-retry-every-15-min') then
    perform cron.unschedule('backend-notification-retry-every-15-min');
  end if;

  if exists (select 1 from cron.job where jobname = 'backend-operational-cleanup-daily') then
    perform cron.unschedule('backend-operational-cleanup-daily');
  end if;
end $$;

select cron.schedule(
  'backend-cron-health-hourly',
  '10 * * * *',
  $$ select ops.capture_cron_health(); $$
);

select cron.schedule(
  'backend-notification-retry-every-15-min',
  '*/15 * * * *',
  $$ select ops.retry_transient_notification_failures(50); $$
);

-- 18:30 UTC = 01:30 WIB, outside normal parent/admin usage hours.
select cron.schedule(
  'backend-operational-cleanup-daily',
  '30 18 * * *',
  $$ select ops.cleanup_cron_operational_history(); $$
);
