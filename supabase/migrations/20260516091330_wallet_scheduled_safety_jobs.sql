-- Scheduled safety jobs for Dompet Santri.
-- These jobs run inside Postgres so they do not depend on Android/admin panel.

create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'wallet-reconciliation-hourly') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'wallet-reconciliation-hourly';
  end if;

  if exists (select 1 from cron.job where jobname = 'wallet-ledger-integrity-daily') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'wallet-ledger-integrity-daily';
  end if;
end;
$$;

select cron.schedule(
  'wallet-reconciliation-hourly',
  '0 * * * *',
  $$ select public.wallet_run_reconciliation(null, null); $$
);

select cron.schedule(
  'wallet-ledger-integrity-daily',
  '15 17 * * *',
  $$ select public.wallet_run_ledger_integrity_check(null, null); $$
);
