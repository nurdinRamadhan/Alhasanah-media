-- Compact per-santri murojaah summaries for admin list pages.
create or replace function public.get_admin_murojaah_summaries(
  p_santri_nis text[]
)
returns table (
  santri_nis text,
  total_count bigint,
  week_count bigint,
  month_count bigint,
  last_tanggal timestamptz,
  last_jenis_murojaah text,
  last_juz integer,
  last_surat text,
  last_ayat_awal integer,
  last_ayat_akhir integer,
  last_halaman_awal integer,
  last_halaman_akhir integer,
  last_predikat text
)
language sql
stable
set search_path = public, pg_temp
as $$
  with requested as (
    select distinct unnest(coalesce(p_santri_nis, array[]::text[])) as santri_nis
  ),
  counts as (
    select
      m.santri_nis,
      count(*)::bigint as total_count,
      count(*) filter (
        where m.tanggal >= date_trunc('week', now())
      )::bigint as week_count,
      count(*) filter (
        where m.tanggal >= date_trunc('month', now())
      )::bigint as month_count
    from public.murojaah_tahfidz m
    join requested r on r.santri_nis = m.santri_nis
    group by m.santri_nis
  )
  select
    r.santri_nis,
    coalesce(c.total_count, 0)::bigint as total_count,
    coalesce(c.week_count, 0)::bigint as week_count,
    coalesce(c.month_count, 0)::bigint as month_count,
    latest.tanggal as last_tanggal,
    latest.jenis_murojaah as last_jenis_murojaah,
    latest.juz as last_juz,
    latest.surat as last_surat,
    latest.ayat_awal as last_ayat_awal,
    latest.ayat_akhir as last_ayat_akhir,
    latest.halaman_awal as last_halaman_awal,
    latest.halaman_akhir as last_halaman_akhir,
    latest.predikat as last_predikat
  from requested r
  left join counts c on c.santri_nis = r.santri_nis
  left join lateral (
    select
      m.tanggal,
      m.jenis_murojaah,
      m.juz,
      m.surat,
      m.ayat_awal,
      m.ayat_akhir,
      m.halaman_awal,
      m.halaman_akhir,
      m.predikat
    from public.murojaah_tahfidz m
    where m.santri_nis = r.santri_nis
    order by m.tanggal desc nulls last, m.id desc
    limit 1
  ) latest on true;
$$;

revoke all on function public.get_admin_murojaah_summaries(text[]) from public, anon;
grant execute on function public.get_admin_murojaah_summaries(text[]) to authenticated;
