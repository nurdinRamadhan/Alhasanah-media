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
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZG9ia2JvbHZyYWhsbm93cmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxODkxMDIsImV4cCI6MjA4MDc2NTEwMn0.nOuh8CC8GC9pq-uSIfqAddYb1KIhNgmy0lzgfGUW8nw'
      ),
      body := jsonb_build_object('source', 'pg_cron', 'limit', 25),
      timeout_milliseconds := 10000
    );
  $$
);
