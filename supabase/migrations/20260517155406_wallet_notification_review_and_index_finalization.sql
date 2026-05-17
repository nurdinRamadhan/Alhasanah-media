-- Finalisasi audit notifikasi dompet:
-- - notifikasi kritis yang gagal bisa direview dengan catatan admin
-- - audit keamanan hanya menghitung notifikasi kritis yang masih terbuka
-- - index FK wallet yang terdeteksi Supabase advisor ikut ditutup

alter table public.notification_queue
  add column if not exists wallet_review_status text not null default 'open',
  add column if not exists wallet_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists wallet_reviewed_at timestamptz,
  add column if not exists wallet_review_note text;

alter table public.notification_queue
  drop constraint if exists notification_queue_wallet_review_status_check,
  add constraint notification_queue_wallet_review_status_check
    check (wallet_review_status in ('open','reviewed','resolved','ignored_dummy'));

create index if not exists idx_notification_queue_wallet_review
  on public.notification_queue (wallet_review_status, priority, status, created_at desc)
  where coalesce(source_table, '') like 'wallet%'
     or coalesce(event_type, '') like 'wallet.%'
     or coalesce(event_type, '') like 'dompet.%';

create index if not exists idx_transaksi_dompet_transaksi_keuangan_id
  on public.transaksi_dompet (transaksi_keuangan_id)
  where transaksi_keuangan_id is not null;

create or replace function public.wallet_review_notification(
  p_notification_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_review_status text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_status text := lower(coalesce(p_review_status, ''));
  v_row public.notification_queue%rowtype;
begin
  if v_role not in ('super_admin','bendahara','rois') then
    raise exception 'Role tidak boleh meninjau notifikasi dompet';
  end if;

  if v_status not in ('reviewed','resolved','ignored_dummy') then
    raise exception 'Status review notifikasi tidak valid';
  end if;

  if nullif(trim(coalesce(p_note, '')), '') is null or length(trim(p_note)) < 12 then
    raise exception 'Catatan review wajib diisi minimal 12 karakter';
  end if;

  update public.notification_queue
  set wallet_review_status = v_status,
      wallet_reviewed_by = p_actor_id,
      wallet_reviewed_at = now(),
      wallet_review_note = trim(p_note)
  where id = p_notification_id
    and (
      coalesce(source_table, '') like 'wallet%'
      or coalesce(event_type, '') like 'wallet.%'
      or coalesce(event_type, '') like 'dompet.%'
    )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Notifikasi dompet tidak ditemukan';
  end if;

  insert into public.wallet_audit_logs (actor_id, actor_role, action, resource, record_id, metadata)
  values (
    p_actor_id,
    v_role,
    'wallet_review_notification',
    'notification_queue',
    p_notification_id::text,
    jsonb_build_object(
      'review_status', v_status,
      'notification_status', v_row.status,
      'priority', v_row.priority,
      'event_type', v_row.event_type,
      'note', trim(p_note)
    )
  );

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.wallet_review_notification(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.wallet_review_notification(uuid, uuid, text, text, text) to service_role;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.wallet_run_security_audit(uuid,text)'::regprocedure)
  into v_def;

  if v_def is null then
    raise exception 'wallet_run_security_audit function not found';
  end if;

  v_def := replace(
    v_def,
    $$and coalesce(status, 'pending') <> 'sent'
    and created_at >= now() - interval '7 days';$$,
    $$and coalesce(status, 'pending') <> 'sent'
    and coalesce(wallet_review_status, 'open') = 'open'
    and created_at >= now() - interval '7 days';$$
  );

  execute v_def;
end;
$$;

revoke all on function public.wallet_run_security_audit(uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_run_security_audit(uuid, text) to service_role;
