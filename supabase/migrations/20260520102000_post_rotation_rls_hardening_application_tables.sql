alter table public.kategori_barang enable row level security;
alter table public.inventaris enable row level security;
alter table public.lokasi_aset enable row level security;
alter table public.struktur_organisasi enable row level security;
alter table public.kecamatan_polygons enable row level security;

drop policy if exists "Finance detail read" on public.detail_transaksi;
create policy "Finance detail read" on public.detail_transaksi
for select to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','dewan','bendahara']));

drop policy if exists "Finance detail write" on public.detail_transaksi;
create policy "Finance detail write" on public.detail_transaksi
for all to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','bendahara']))
with check (public.is_admin_in_roles(array['super_admin','rois','bendahara']));

drop policy if exists "Geocode cache admin read" on public.geocode_cache;
create policy "Geocode cache admin read" on public.geocode_cache
for select to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','dewan','kesantrian']));

drop policy if exists "Geocode cache admin write" on public.geocode_cache;
create policy "Geocode cache admin write" on public.geocode_cache
for all to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','kesantrian']))
with check (public.is_admin_in_roles(array['super_admin','rois','kesantrian']));

drop policy if exists "Geocode jobs admin read" on public.geocode_jobs;
create policy "Geocode jobs admin read" on public.geocode_jobs
for select to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','dewan','kesantrian']));

drop policy if exists "Geocode jobs admin write" on public.geocode_jobs;
create policy "Geocode jobs admin write" on public.geocode_jobs
for all to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','kesantrian']))
with check (public.is_admin_in_roles(array['super_admin','rois','kesantrian']));

drop policy if exists "Prestasi admin read" on public.prestasi_santri;
create policy "Prestasi admin read" on public.prestasi_santri
for select to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','dewan','kesantrian']));

drop policy if exists "Prestasi admin write" on public.prestasi_santri;
create policy "Prestasi admin write" on public.prestasi_santri
for all to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','kesantrian']))
with check (public.is_admin_in_roles(array['super_admin','rois','kesantrian']));

drop policy if exists "Kategori barang read" on public.kategori_barang;
create policy "Kategori barang read" on public.kategori_barang
for select to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','dewan','bendahara']));

drop policy if exists "Kategori barang write" on public.kategori_barang;
create policy "Kategori barang write" on public.kategori_barang
for all to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','bendahara']))
with check (public.is_admin_in_roles(array['super_admin','rois','bendahara']));

drop policy if exists "Lokasi aset read" on public.lokasi_aset;
create policy "Lokasi aset read" on public.lokasi_aset
for select to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','dewan','bendahara']));

drop policy if exists "Lokasi aset write" on public.lokasi_aset;
create policy "Lokasi aset write" on public.lokasi_aset
for all to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','bendahara']))
with check (public.is_admin_in_roles(array['super_admin','rois','bendahara']));

drop policy if exists "Inventaris read" on public.inventaris;
create policy "Inventaris read" on public.inventaris
for select to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','dewan','bendahara']));

drop policy if exists "Inventaris write" on public.inventaris;
create policy "Inventaris write" on public.inventaris
for all to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','bendahara']))
with check (public.is_admin_in_roles(array['super_admin','rois','bendahara']));

drop policy if exists "Struktur organisasi public read" on public.struktur_organisasi;
create policy "Struktur organisasi public read" on public.struktur_organisasi
for select to anon, authenticated
using (true);

drop policy if exists "Struktur organisasi admin write" on public.struktur_organisasi;
create policy "Struktur organisasi admin write" on public.struktur_organisasi
for all to authenticated
using (public.is_admin_in_roles(array['super_admin','rois']))
with check (public.is_admin_in_roles(array['super_admin','rois']));

drop policy if exists "Kecamatan polygons public read" on public.kecamatan_polygons;
create policy "Kecamatan polygons public read" on public.kecamatan_polygons
for select to anon, authenticated
using (true);

drop policy if exists "Kecamatan polygons admin write" on public.kecamatan_polygons;
create policy "Kecamatan polygons admin write" on public.kecamatan_polygons
for all to authenticated
using (public.is_admin_in_roles(array['super_admin','rois']))
with check (public.is_admin_in_roles(array['super_admin','rois']));
