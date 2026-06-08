create or replace function public.tr_notify_tagihan_payment_posted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tagihan public.tagihan_santri%rowtype;
  v_santri_name text;
  v_wali_id uuid;
  v_total_paid bigint;
  v_remaining bigint;
  v_title text;
  v_body text;
  v_event_type text;
  v_priority text;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'posted' or new.status <> 'posted' then
      return new;
    end if;
  elsif new.status <> 'posted' then
    return new;
  end if;

  select *
    into v_tagihan
  from public.tagihan_santri
  where id = new.tagihan_id;

  if not found then
    return new;
  end if;

  select s.nama, s.wali_id
    into v_santri_name, v_wali_id
  from public.santri s
  where s.nis = new.santri_nis;

  if v_wali_id is null then
    return new;
  end if;

  select coalesce(sum(p.amount), 0)
    into v_total_paid
  from public.pembayaran_tagihan p
  where p.tagihan_id = new.tagihan_id
    and p.status = 'posted';

  v_remaining := greatest(coalesce(v_tagihan.nominal_tagihan, 0) - v_total_paid, 0);

  if v_remaining > 0 then
    v_event_type := 'tagihan.payment_installment';
    v_priority := 'normal';
    v_title := 'Cicilan Pembayaran Berhasil';
    v_body :=
      'Pembayaran cicilan ' || coalesce(v_tagihan.deskripsi_tagihan, 'tagihan santri') ||
      ' untuk ' || coalesce(v_santri_name, new.santri_nis) ||
      ' sebesar Rp ' || public.format_rupiah(new.amount) ||
      ' berhasil dicatat. Total sudah dibayar Rp ' || public.format_rupiah(v_total_paid) ||
      ', sisa tagihan Rp ' || public.format_rupiah(v_remaining) || '.';
  else
    v_event_type := 'tagihan.payment_success';
    v_priority := 'high';
    v_title := 'Pembayaran Tagihan Lunas';
    v_body :=
      'Pembayaran ' || coalesce(v_tagihan.deskripsi_tagihan, 'tagihan santri') ||
      ' untuk ' || coalesce(v_santri_name, new.santri_nis) ||
      ' sebesar Rp ' || public.format_rupiah(new.amount) ||
      ' berhasil diterima. Tagihan sudah lunas.';
  end if;

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
    v_wali_id,
    v_title,
    left(v_body, 500),
    jsonb_build_object(
      'type', v_event_type,
      'tagihan_id', new.tagihan_id,
      'payment_id', new.id,
      'transaksi_id', new.transaksi_id,
      'santri_nis', new.santri_nis,
      'amount_paid', new.amount,
      'total_paid', v_total_paid,
      'remaining_amount', v_remaining,
      'nominal_tagihan', coalesce(v_tagihan.nominal_tagihan, 0),
      'status', case when v_remaining > 0 then 'CICILAN' else 'LUNAS' end,
      'source', new.source,
      'metode_pembayaran', new.metode_pembayaran,
      'paid_at', new.paid_at
    ),
    'pembayaran_tagihan',
    v_event_type,
    v_priority,
    'push',
    new.id::text,
    now()
  where not exists (
    select 1
    from public.notification_queue q
    where q.event_type = v_event_type
      and q.reference_id = new.id::text
      and q.user_id = v_wali_id
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_tagihan_payment_posted on public.pembayaran_tagihan;
create trigger trg_notify_tagihan_payment_posted
after insert or update of status on public.pembayaran_tagihan
for each row execute function public.tr_notify_tagihan_payment_posted();

revoke all on function public.tr_notify_tagihan_payment_posted() from public, anon, authenticated;
grant execute on function public.tr_notify_tagihan_payment_posted() to service_role;

create index if not exists idx_notification_queue_tagihan_payment_reference
  on public.notification_queue (event_type, reference_id, user_id)
  where event_type in ('tagihan.payment_success', 'tagihan.payment_installment');

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
      coalesce(t.nominal_tagihan, 0) as nominal_tagihan,
      coalesce(t.status, 'BELUM') as payment_status,
      t.tanggal_jatuh_tempo,
      (t.tanggal_jatuh_tempo - p_run_date) as days_remaining,
      greatest(0, p_run_date - t.tanggal_jatuh_tempo) as days_overdue,
      s.nama as santri_nama,
      s.wali_id
    from public.tagihan_santri t
    join public.santri s on s.nis = t.santri_nis
    where t.tanggal_jatuh_tempo is not null
      and coalesce(t.status, 'BELUM') <> 'LUNAS'
      and coalesce(t.sisa_tagihan, t.nominal_tagihan, 0) > 0
      and s.wali_id is not null
      and (
        t.tanggal_jatuh_tempo between p_run_date and (p_run_date + 7)
        or t.tanggal_jatuh_tempo < p_run_date
      )
  ),
  prepared as (
    select
      b.*,
      case
        when b.days_remaining < 0 then 'tagihan.overdue_reminder'
        else 'tagihan.due_reminder'
      end as event_type,
      case
        when b.days_remaining < 0 then 'Tagihan Melewati Jatuh Tempo'
        when b.days_remaining = 0 then 'Tagihan Jatuh Tempo Hari Ini'
        else 'Pengingat Tagihan H-' || b.days_remaining::text
      end as title,
      case
        when b.days_remaining < 0 then
          'Tagihan ' || b.deskripsi_tagihan || ' untuk ' || coalesce(b.santri_nama, b.santri_nis) ||
          ' sudah melewati jatuh tempo ' || b.days_overdue::text ||
          ' hari. Sisa yang perlu dibayar Rp ' || public.format_rupiah(b.amount_due) ||
          case when b.payment_status = 'CICILAN'
            then '. Pembayaran masih berstatus cicilan, mohon dilanjutkan sampai lunas.'
            else '. Mohon segera melakukan pembayaran.'
          end
        when b.days_remaining = 0 then
          'Tagihan ' || b.deskripsi_tagihan || ' untuk ' || coalesce(b.santri_nama, b.santri_nis) ||
          ' jatuh tempo hari ini. Sisa pembayaran Rp ' || public.format_rupiah(b.amount_due) ||
          case when b.payment_status = 'CICILAN'
            then '. Tagihan sudah dicicil, mohon selesaikan sisa pembayaran hari ini.'
            else '.'
          end
        else
          'Tagihan ' || b.deskripsi_tagihan || ' untuk ' || coalesce(b.santri_nama, b.santri_nis) ||
          ' akan jatuh tempo dalam ' || b.days_remaining::text ||
          ' hari. Sisa pembayaran Rp ' || public.format_rupiah(b.amount_due) ||
          case when b.payment_status = 'CICILAN'
            then '. Tagihan masih dalam cicilan, mohon lanjutkan pembayaran sebelum jatuh tempo.'
            else '.'
          end
      end as body,
      case
        when b.days_remaining < 0 then 'critical'
        when b.days_remaining <= 1 then 'high'
        else 'normal'
      end as priority
    from due_bills b
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
      p.wali_id,
      p.title,
      left(p.body, 500),
      jsonb_build_object(
        'type', p.event_type,
        'nis', p.santri_nis,
        'id', p.id,
        'tagihan_id', p.id,
        'due_date', p.tanggal_jatuh_tempo,
        'days_remaining', p.days_remaining,
        'days_overdue', p.days_overdue,
        'reminder_date', p_run_date,
        'amount_due', p.amount_due,
        'nominal_tagihan', p.nominal_tagihan,
        'status', p.payment_status,
        'automatic', true
      ),
      'tagihan_santri',
      p.event_type,
      p.priority,
      'push',
      p.id::text,
      now()
    from prepared p
    where not exists (
      select 1
      from public.notification_queue q
      where q.user_id = p.wali_id
        and q.reference_id = p.id::text
        and q.event_type = p.event_type
        and q.data->>'reminder_date' = p_run_date::text
    )
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

revoke all on function public.enqueue_tagihan_due_reminders(date) from public, anon, authenticated;
grant execute on function public.enqueue_tagihan_due_reminders(date) to service_role;

create index if not exists idx_notification_queue_tagihan_due_overdue_daily
  on public.notification_queue (event_type, reference_id, user_id, ((data->>'reminder_date')))
  where event_type in ('tagihan.due_reminder', 'tagihan.overdue_reminder');
