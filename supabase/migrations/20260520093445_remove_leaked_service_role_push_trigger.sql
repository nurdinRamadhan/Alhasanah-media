-- Remove legacy direct push trigger that embedded a service_role JWT in the
-- trigger definition. Notification delivery must use the scheduled worker
-- wallet-push-notifications-every-minute and Edge Function secrets instead.

drop trigger if exists send_push_notification on public.notification_queue;
