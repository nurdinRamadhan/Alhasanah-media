drop policy if exists "Admin full access config" on public.config_diklat;
drop policy if exists "Config diklat admin write" on public.config_diklat;
create policy "Config diklat admin write" on public.config_diklat
for all to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','kesantrian']))
with check (public.is_admin_in_roles(array['super_admin','rois','kesantrian']));

drop policy if exists "Admin full access master_kitab" on public.master_kitab;
drop policy if exists "Master kitab admin write" on public.master_kitab;
create policy "Master kitab admin write" on public.master_kitab
for all to authenticated
using (public.is_admin_in_roles(array['super_admin','rois','kesantrian']))
with check (public.is_admin_in_roles(array['super_admin','rois','kesantrian']));

drop policy if exists "Izinkan pendaftaran publik" on public.peserta_diklat;
create policy "Izinkan pendaftaran publik" on public.peserta_diklat
for insert to anon
with check (
  nama_lengkap is not null
  and length(trim(nama_lengkap)) >= 3
  and tahun_diklat between 1400 and 1600
  and jenis_diklat is not null
);

revoke execute on function public.st_estimatedextent(text, text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text, boolean) from anon, authenticated;
