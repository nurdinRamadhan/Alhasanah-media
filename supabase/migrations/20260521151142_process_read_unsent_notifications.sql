-- Keep push delivery independent from in-app read state.
-- Android can mark a row as read before the one-minute worker picks it up.
-- The worker now sends rows that are read but still have no sent_at.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'wallet-push-notifications-every-minute') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'wallet-push-notifications-every-minute';
  end if;
end $$;

select cron.schedule(
  'wallet-push-notifications-every-minute',
  '* * * * *',
  $$
    do $push$
    begin
      if exists (
        select 1
        from public.notification_queue
        where status in ('pending', 'read')
          and sent_at is null
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
  $$
);

create index if not exists idx_notification_queue_unsent_ready
  on public.notification_queue (scheduled_at, priority, created_at)
  where sent_at is null and status in ('pending', 'read');

