-- Notify wali when an admin records a new prestasi, and provide a safer
-- tahfidz leaderboard source for the admin panel.

create or replace function public.notify_wali_on_prestasi_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_santri record;
  v_title text;
  v_body text;
begin
  select
    s.nama,
    s.kelas::text as kelas,
    s.jurusan::text as jurusan,
    s.wali_id
  into v_santri
  from public.santri s
  where s.nis = new.santri_nis;

  if v_santri.wali_id is null then
    return new;
  end if;

  v_title := 'Prestasi Santri';
  v_body := 'Alhamdulillah, ' || coalesce(v_santri.nama, 'santri') ||
    ' mendapatkan prestasi: ' || left(trim(new.judul_prestasi), 140) ||
    '. Semoga menjadi motivasi dan keberkahan.';

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
  values (
    v_santri.wali_id,
    v_title,
    left(v_body, 500),
    jsonb_build_object(
      'type', 'prestasi_created',
      'prestasi_id', new.id,
      'santri_nis', new.santri_nis,
      'santri_nama', v_santri.nama,
      'santri_kelas', v_santri.kelas,
      'santri_jurusan', v_santri.jurusan,
      'kategori', new.kategori,
      'judul_prestasi', new.judul_prestasi,
      'tanggal_prestasi', new.tanggal_prestasi,
      'poin_prestasi', coalesce(new.poin_prestasi, 0),
      'automatic', true
    ),
    'prestasi_santri',
    'prestasi.created',
    'normal',
    'push',
    new.id::text,
    now()
  );

  return new;
end;
$$;

drop trigger if exists prestasi_notify_wali_after_insert on public.prestasi_santri;
create trigger prestasi_notify_wali_after_insert
after insert on public.prestasi_santri
for each row
execute function public.notify_wali_on_prestasi_created();

revoke all on function public.notify_wali_on_prestasi_created() from public, anon, authenticated;
grant execute on function public.notify_wali_on_prestasi_created() to service_role;

create or replace function public.get_admin_top_tahfidz_santri(
  p_limit integer default 10
)
returns table (
  nis text,
  nama text,
  kelas text,
  jurusan text,
  foto_url text,
  total_hafalan numeric,
  last_setoran timestamptz,
  setoran_count bigint
)
language sql
security invoker
set search_path = public, pg_temp
as $$
  with tahfidz_progress as (
    select
      h.santri_nis,
      count(*)::bigint as setoran_count,
      max(h.tanggal) as last_setoran,
      coalesce(max(h.total_hafalan), 0)::numeric as max_total_snapshot,
      count(distinct h.juz) filter (where h.juz is not null)::numeric as distinct_juz_count
    from public.hafalan_tahfidz h
    group by h.santri_nis
  ),
  ranked as (
    select
      s.nis,
      s.nama,
      s.kelas::text as kelas,
      s.jurusan::text as jurusan,
      s.foto_url,
      greatest(
        coalesce(replace(substring(coalesce(s.total_hafalan, '') from '([0-9]+(?:[\.,][0-9]+)?)'), ',', '.')::numeric, 0),
        coalesce(tp.max_total_snapshot, 0),
        coalesce(tp.distinct_juz_count, 0)
      ) as total_hafalan,
      tp.last_setoran,
      coalesce(tp.setoran_count, 0)::bigint as setoran_count
    from public.santri s
    left join tahfidz_progress tp on tp.santri_nis = s.nis
    where s.status_santri = 'AKTIF'
      and coalesce(s.jurusan::text, '') in ('TAHFIDZ', 'KITAB')
  )
  select
    ranked.nis,
    ranked.nama,
    ranked.kelas,
    ranked.jurusan,
    ranked.foto_url,
    ranked.total_hafalan,
    ranked.last_setoran,
    ranked.setoran_count
  from ranked
  order by ranked.total_hafalan desc, ranked.last_setoran desc nulls last, ranked.nama asc
  limit least(greatest(coalesce(p_limit, 10), 1), 100);
$$;

revoke all on function public.get_admin_top_tahfidz_santri(integer) from public, anon;
grant execute on function public.get_admin_top_tahfidz_santri(integer) to authenticated;
