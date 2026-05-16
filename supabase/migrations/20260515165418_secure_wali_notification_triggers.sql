alter function public.tr_notify_tagihan()
security definer
set search_path = public, pg_temp;

alter function public.tr_notify_pelanggaran()
security definer
set search_path = public, pg_temp;

alter function public.tr_notify_perizinan()
security definer
set search_path = public, pg_temp;

alter function public.tr_notify_kesehatan()
security definer
set search_path = public, pg_temp;

revoke execute
on function public.create_notification_for_wali(text, text, text, jsonb, text)
from authenticated, anon, public;

revoke execute on function public.tr_notify_tagihan() from authenticated, anon, public;
revoke execute on function public.tr_notify_pelanggaran() from authenticated, anon, public;
revoke execute on function public.tr_notify_perizinan() from authenticated, anon, public;
revoke execute on function public.tr_notify_kesehatan() from authenticated, anon, public;
