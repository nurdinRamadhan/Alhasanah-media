-- Automatic due-date reminders for unpaid santri bills.
-- Runs independently from the "Tagihan Baru" insert trigger.

create or replace function public.enqueue_tagihan_due_reminders(
  p_run_date date default (timezone('Asia/Jakarta', now()))::date
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer := 0;
begin
  with due_bills as (
    select
      t.id,
      t.santri_nis,
      coalesce(t.deskripsi_tagihan, 'Tagihan santri') as deskripsi_tagihan,
      coalesce(t.sisa_tagihan, t.nominal_tagihan, 0) as amount_due,
      t.tanggal_jatuh_tempo,
      greatest(0, t.tanggal_jatuh_tempo - p_run_date) as days_remaining,
      s.nama as santri_nama,
      s.wali_id
    from public.tagihan_santri t
    join public.santri s on s.nis = t.santri_nis
    where t.tanggal_jatuh_tempo is not null
      and t.tanggal_jatuh_tempo between p_run_date and (p_run_date + 5)
      and coalesce(t.status, 'BELUM') <> 'LUNAS'
      and coalesce(t.sisa_tagihan, t.nominal_tagihan, 0) > 0
      and s.wali_id is not null
  ),
  inserted as (
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
      b.wali_id,
      case
        when b.days_remaining = 0 then 'Tagihan Jatuh Tempo Hari Ini'
        else 'Pengingat Tagihan H-' || b.days_remaining::text
      end,
      case
        when b.days_remaining = 0 then
          'Tagihan ' || b.deskripsi_tagihan || ' untuk ' || coalesce(b.santri_nama, b.santri_nis) ||
          ' jatuh tempo hari ini. Sisa pembayaran Rp ' || public.format_rupiah(b.amount_due) || '.'
        else
          'Tagihan ' || b.deskripsi_tagihan || ' untuk ' || coalesce(b.santri_nama, b.santri_nis) ||
          ' akan jatuh tempo dalam ' || b.days_remaining::text || ' hari. Sisa pembayaran Rp ' ||
          public.format_rupiah(b.amount_due) || '.'
      end,
      jsonb_build_object(
        'type', 'tagihan_due_reminder',
        'nis', b.santri_nis,
        'id', b.id,
        'tagihan_id', b.id,
        'due_date', b.tanggal_jatuh_tempo,
        'days_remaining', b.days_remaining,
        'reminder_date', p_run_date,
        'automatic', true
      ),
      'tagihan_santri',
      'tagihan.due_reminder',
      case when b.days_remaining <= 1 then 'high' else 'normal' end,
      'push',
      b.id::text,
      now()
    from due_bills b
    where not exists (
      select 1
      from public.notification_queue q
      where q.user_id = b.wali_id
        and q.reference_id = b.id::text
        and q.event_type = 'tagihan.due_reminder'
        and q.data->>'reminder_date' = p_run_date::text
    )
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

revoke all on function public.enqueue_tagihan_due_reminders(date) from public;
revoke all on function public.enqueue_tagihan_due_reminders(date) from anon;
revoke all on function public.enqueue_tagihan_due_reminders(date) from authenticated;
grant execute on function public.enqueue_tagihan_due_reminders(date) to service_role;

create index if not exists idx_notification_queue_tagihan_due_reminder_daily
  on public.notification_queue (event_type, reference_id, user_id, ((data->>'reminder_date')))
  where event_type = 'tagihan.due_reminder';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'tagihan-due-reminders-daily') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'tagihan-due-reminders-daily';
  end if;
end $$;

-- 23:00 UTC = 06:00 WIB. The function itself calculates the date in Asia/Jakarta.
select cron.schedule(
  'tagihan-due-reminders-daily',
  '0 23 * * *',
  $$
    select public.enqueue_tagihan_due_reminders();
  $$
);
