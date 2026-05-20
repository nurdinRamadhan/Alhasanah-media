drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Public Access Bukti" on storage.objects;
drop policy if exists "Public Access Struktur" on storage.objects;

drop policy if exists "Admin read berita images" on storage.objects;
create policy "Admin read berita images" on storage.objects
for select to authenticated
using (
  bucket_id = 'berita-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.role) = any(array['super_admin','rois','dewan','kesantrian'])
      and coalesce(p.is_active, true)
  )
);

drop policy if exists "Admin read pengeluaran bukti" on storage.objects;
create policy "Admin read pengeluaran bukti" on storage.objects
for select to authenticated
using (
  bucket_id = 'pengeluaran-bukti'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.role) = any(array['super_admin','rois','dewan','bendahara'])
      and coalesce(p.is_active, true)
  )
);

drop policy if exists "Admin read struktur images" on storage.objects;
create policy "Admin read struktur images" on storage.objects
for select to authenticated
using (
  bucket_id = 'struktur-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.role) = any(array['super_admin','rois','dewan','kesantrian'])
      and coalesce(p.is_active, true)
  )
);

revoke execute on function public.st_estimatedextent(text, text) from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text) from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text, boolean) from public, anon, authenticated;
