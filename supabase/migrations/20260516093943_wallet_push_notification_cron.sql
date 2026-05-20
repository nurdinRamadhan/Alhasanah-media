-- Cron worker for notification_queue -> FCM Edge Function.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'wallet-push-notifications-every-minute') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'wallet-push-notifications-every-minute';
  end if;
end;
$$;

select cron.schedule(
  'wallet-push-notifications-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://sldobkbolvrahlnowrga.supabase.co/functions/v1/push-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'pg_cron', 'limit', 25),
      timeout_milliseconds := 10000
    );
  $$
);
