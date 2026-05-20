-- Remove legacy anon JWT from the notification worker cron command.
-- The push-notifications Edge Function is intentionally deployed with
-- verify_jwt=false and uses SUPABASE_SERVICE_ROLE_KEY from Edge Function
-- secrets internally.

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
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('source', 'pg_cron', 'limit', 25),
      timeout_milliseconds := 10000
    );
  $$
);
