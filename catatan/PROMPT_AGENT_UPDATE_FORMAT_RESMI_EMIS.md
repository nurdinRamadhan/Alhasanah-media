# PROMPT AGENT: UPDATE FORMAT RESMI EMIS AL-HASANAH

Dokumen ini dipakai jika nanti pemilik project sudah memiliki akses resmi ke sistem EMIS dan mengunduh referensi format terbaru. Tujuannya adalah membantu AI Agent CLI memahami dari mana harus mulai, apa yang harus dicek, dan bagaimana mengubah sistem tanpa merusak keamanan, admin panel, export, Android, RLS, trigger, Edge Function, dan audit log.

Project target:

- Admin Panel: `/home/arch-din1/Admin Panel/alhasanahAdmin`
- Backend: Supabase PostgreSQL, Auth, Storage, Edge Functions, RLS, pgcrypto, Vault
- Referensi lokal saat ini:
  - `catatan/SECURITY_PROTOCOL.md`
  - `catatan/REFERENSI_FORMAT_EMIS_DAPODIK.md`
  - `catatan/EMIS_REFERENSI_TIPE_DATA_LENGKAP.txt`

Instruksi wajib untuk agent:

1. Gunakan skill MCP Supabase untuk membaca struktur database aktual. Jangan mengandalkan asumsi.
2. Jangan menghapus enkripsi yang sudah ada.
3. Jangan menambah kolom sensitif plaintext.
4. Jangan menaruh service role key di frontend atau Android.
5. Jangan mengubah bucket storage lain kecuali diminta eksplisit.
6. Jangan mengubah modul non-EMIS tanpa alasan langsung.
7. Semua perubahan besar harus diverifikasi dengan query, build admin panel, dan minimal satu export test.

## 1. Tujuan Perubahan

Tujuan update format resmi EMIS adalah:

- Menyesuaikan struktur data santri dengan referensi resmi terbaru.
- Menyesuaikan dropdown/kode EMIS agar export tidak ditolak.
- Menjaga agar data sensitif tetap terenkripsi di database.
- Menjaga admin panel tetap mudah dipakai.
- Menjaga aplikasi Android tetap bisa membaca data milik wali yang sah melalui jalur aman.
- Memusatkan mapping dan validasi EMIS di database/Edge Function, bukan tersebar di React/Kotlin.

Prinsip utama: komponen UI boleh membantu input, tetapi sumber kebenaran validasi dan mapping harus berada di Supabase.

## 2. Kondisi Sistem Saat Dokumen Ini Dibuat

Tabel utama: `public.santri`

Kolom plaintext sensitif lama sudah dihapus atau tidak dipakai. Data sensitif disimpan dalam kolom terenkripsi `bytea`, antara lain:

- `nis_enc`
- `nisn_enc`
- `nik_enc`
- `no_kk_enc`
- `nama_enc`
- `tempat_lahir_enc`
- `tanggal_lahir_enc`
- `alamat_lengkap_enc`
- `no_kontak_wali_enc`
- `ayah_enc`
- `ibu_enc`
- `nama_wali_enc`
- `nik_ayah_enc`
- `nik_ibu_enc`
- `nik_wali_enc`
- `no_kip_enc`

Kolom hash untuk lookup:

- `nis_hash`
- `nisn_hash`
- `nik_hash`
- `no_kk_hash`
- `nik_ayah_hash`
- `nik_ibu_hash`
- `nik_wali_hash`
- `no_kip_hash`

Kolom non-sensitif atau operasional yang masih plaintext:

- `nis` sebagai primary key sistem
- `nama` untuk display admin panel
- `kelas`
- `jurusan`
- `jenis_kelamin`
- `status_santri`
- `status_mukim`
- `agama`
- `kewarganegaraan`
- `rt`, `rw`, `desa_kelurahan`, `kecamatan_id`, `kabupaten_kota`, `provinsi`, `kode_pos`
- `latitude`, `longitude`, `geocode_status`, `geocode_provider`, `geocode_confidence`, `geocoded_at`
- `pendidikan_ayah`, `pekerjaan_ayah`, `penghasilan_ayah`, `status_ayah`
- `pendidikan_ibu`, `pekerjaan_ibu`, `penghasilan_ibu`, `status_ibu`
- `pendidikan_wali`, `pekerjaan_wali`, `penghasilan_wali`, `hubungan_wali`
- `emis_extra` untuk JSON tambahan format EMIS

RPC penting yang sudah ada:

- `public.create_santri_secure(p_payload jsonb, p_reason text)`
- `public.update_santri_secure(p_nis text, p_payload jsonb, p_reason text)`
- `public.get_santri_detail_secure(p_nis text, p_reason text)`
- `public.validate_santri_emis(p_nis_list text[], p_status text)`
- `public.export_santri_emis(p_status text, p_tahun_masuk integer)`
- `public.export_emis_pesantren_santri(p_status text, p_tahun_masuk integer)`

Edge Functions penting:

- `create-user-wali`
- `upload-santri-photo`
- `geocode-single`
- `validate-santri-emis`
- `export-santri-emis`

Mapping final saat ini berada di database lewat fungsi `app_private.emis_*` dan sebagian helper frontend/server:

- `KITAB -> 06`
- `TAHFIDZ -> 05`
- `MUKIM -> 4`
- agama Islam -> `01`
- pendidikan orang tua/wali -> `01` sampai `11`
- pekerjaan orang tua/wali -> `01` sampai `12` atau `99`
- penghasilan orang tua/wali -> `1` sampai `6`

## 3. Mulai Dari Mana

Jika ada referensi resmi EMIS baru, lakukan langkah berikut secara berurutan.

### Langkah 1: Baca referensi resmi baru

Identifikasi:

- Kolom baru
- Kolom yang berubah nama
- Kolom yang berubah tipe data
- Dropdown/kode yang berubah
- Field wajib baru
- Field opsional baru
- Aturan validasi baru
- Format export/import resmi

Jangan langsung mengubah database. Buat dulu daftar perbandingan:

- `field_resmi`
- `tipe_resmi`
- `wajib_opsional`
- `kode_resmi`
- `field_db_saat_ini`
- `perlu_migrasi`
- `sensitivitas`
- `lokasi_mapping`

### Langkah 2: Klasifikasikan sensitivitas data

Gunakan aturan:

- NIK, NISN, KK, NIK orang tua/wali, nomor dokumen sensitif: wajib terenkripsi dan hash jika perlu lookup.
- Nama, tempat lahir, tanggal lahir, alamat lengkap, nomor HP, nama orang tua/wali: terenkripsi. Nama santri boleh tetap punya kolom display `nama` karena admin panel membutuhkan navigasi operasional.
- Kode EMIS, kelas, jurusan, status, kategori pendidikan/pekerjaan/penghasilan: boleh plaintext karena berupa kode/kategori, tetap dilindungi RLS.
- Data koordinat: boleh plaintext untuk fitur peta/geocode, tetapi jangan gabungkan dengan identitas sensitif di endpoint publik.

Jika field baru sensitif, buat kolom:

- `field_enc bytea`
- `field_hash text` jika perlu pencarian exact-match

Jangan buat `field text` plaintext untuk data sensitif.

### Langkah 3: Ubah mapping pusat

Mapping harus berada di satu tempat utama:

- Database: fungsi `app_private.emis_*`
- RPC export: `public.export_santri_emis`
- RPC validasi: `public.validate_santri_emis`
- Edge Function hanya memanggil RPC atau helper yang sama.

Jika dropdown resmi berubah, ubah:

- `app_private.emis_education_code`
- `app_private.emis_job_code`
- `app_private.emis_income_code`
- `app_private.emis_program_pesantren_code`
- `app_private.emis_status_mukim_code`
- `app_private.emis_agama_code`
- fungsi mapping baru jika field baru membutuhkan kode baru

Lalu sinkronkan UI options:

- `src/components/santri/emisOptions.ts`
- `src/components/santri/EmisExtraFields.tsx`
- `src/utility/emisMapping.ts`
- `supabase/functions/_shared/emis-mapping.ts`

Catatan: UI boleh berisi options agar admin mudah input, tetapi RPC database tetap harus menjadi validator final.

### Langkah 4: Update create/edit/show/list santri

File utama:

- `src/pages/santri/create.tsx`
- `src/pages/santri/edit.tsx`
- `src/pages/santri/show.tsx`
- `src/pages/santri/list.tsx`
- `src/components/santri/EmisExtraFields.tsx`
- `src/components/santri/IndonesiaLocationFields.tsx`

Aturan:

- Create harus mengirim payload ke `create-user-wali` atau `create_santri_secure`, bukan insert langsung ke `public.santri`.
- Edit harus lewat `update_santri_secure`.
- Show harus lewat `get_santri_detail_secure`, bukan select `*`.
- List boleh menampilkan nama, NIS, kelas, jurusan, status, foto, dan indikator EMIS.
- List tidak boleh mengambil field sensitif langsung dari tabel.
- Export Excel EMIS harus lewat `export-santri-emis` atau `export_santri_emis`.
- Preflight list harus lewat `validate-santri-emis` atau `validate_santri_emis`.

### Langkah 5: Update RPC dan audit log

Setiap RPC yang decrypt data harus:

- `SECURITY DEFINER`
- memiliki `SET search_path TO public, app_private`
- memanggil role-check internal
- mencatat audit log melalui `app_private.audit_sensitive_access`
- tidak mengembalikan kolom `_enc` dan `_hash`
- tidak bisa dieksekusi role `anon`

Cek privilege:

```sql
select
  p.proname,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  p.prosecdef,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_santri_secure',
    'update_santri_secure',
    'get_santri_detail_secure',
    'validate_santri_emis',
    'export_santri_emis',
    'export_emis_pesantren_santri'
  );
```

Expected:

- `anon_can_execute = false`
- `authenticated_can_execute = true`
- `security_definer = true`
- `search_path` eksplisit

### Langkah 6: Update export Excel EMIS

Export tidak boleh memakai value internal mentah.

Contoh yang benar:

- `jurusan = KITAB` harus diexport sebagai `06`
- `jurusan = TAHFIDZ` harus diexport sebagai `05`
- `status_mukim = MUKIM` harus diexport sebagai `4`
- `agama = Islam` harus diexport sebagai `01`
- pendidikan/pekerjaan/penghasilan harus kode resmi

Export Excel di React hanya membentuk workbook. Data export harus sudah final dari RPC/Edge Function.

### Langkah 7: Update test data

Minimal sisakan data test:

- `Nurdin Ramramram`
- `Nurdin Ramadhan`
- `Nurdin Aja`

Pastikan ketiganya tetap:

- `ready_emis = true`
- `sensitive_complete = true`
- `geocode_ok = true`
- export menghasilkan kode final

Query validasi:

```sql
select set_config('request.jwt.claim.sub', '<admin_uuid>', true);
select nis, nama, ready_emis, sensitive_complete, geocode_ok, errors, warnings, mapped
from public.validate_santri_emis(null, null)
order by nama;
```

### Langkah 8: Verifikasi build dan fungsi

Jalankan:

```bash
npm run build
```

Verifikasi Supabase:

- `validate-santri-emis` aktif dan `verify_jwt=true`
- `export-santri-emis` aktif dan `verify_jwt=true`
- `create-user-wali` aktif dan `verify_jwt=true`
- `upload-santri-photo` aktif dan `verify_jwt=true`

Jangan jadikan advisor bucket lain sebagai blocker jika user hanya meminta EMIS/santri. Catat saja sebagai risiko terpisah.

## 4. Tujuan Akhir Yang Harus Dicapai

Perubahan format resmi EMIS dianggap selesai jika:

- Admin bisa create santri dengan semua field wajib baru.
- Admin bisa edit santri tanpa kehilangan data terenkripsi lama.
- Admin bisa show detail santri dengan data decrypted sesuai role.
- List santri menampilkan indikator siap EMIS.
- Export Excel EMIS memakai kode resmi terbaru.
- Wali Android tetap bisa membaca data anaknya melalui RPC khusus wali.
- Data sensitif tidak muncul sebagai plaintext di tabel.
- Audit log mencatat read/export/update/validate data sensitif.
- Build admin panel berhasil.

## 5. Larangan Kritis

Jangan lakukan hal berikut:

- Jangan mengembalikan kolom plaintext `nik`, `tanggal_lahir`, `alamat_lengkap`, `ayah`, `ibu`, `no_kontak_wali` di tabel `public.santri`.
- Jangan menulis query frontend `select("*")` untuk detail santri.
- Jangan decrypt data sensitif di Edge Function lalu log ke console.
- Jangan membuat endpoint publik untuk export EMIS.
- Jangan memberi execute RPC sensitif ke `anon`.
- Jangan menyimpan service role key di Android.
- Jangan mengubah RLS/storage bucket lain tanpa scope yang jelas.

## 6. Catatan Untuk Format Resmi Yang Belum Ada

Jika referensi resmi EMIS nanti memuat domain tambahan, pisahkan fase:

1. Santri
2. Lembaga/Pesantren
3. PTK/Pengajar/Ustadz
4. Rombel/Kelas
5. Kurikulum/Program/Kitab
6. Sarpras

Jangan mencampur semua domain dalam satu migrasi besar kecuali benar-benar diperlukan. Data santri adalah domain paling sensitif dan paling besar, sehingga harus stabil terlebih dahulu.
