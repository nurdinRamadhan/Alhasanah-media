-- Make finance audit source safe for service-role/cron updates where request JWT is absent.

alter table ops.finance_audit_events
  alter column source drop not null,
  alter column source set default coalesce(current_setting('request.jwt.claim.sub', true), 'system');
