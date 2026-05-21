-- Supports admin tahfidz leaderboard aggregation and the existing FK.
create index if not exists idx_hafalan_tahfidz_santri_nis
  on public.hafalan_tahfidz (santri_nis);

