# PROMPT AGENT ANDROID: IMPLEMENTASI KEAMANAN DAN DATA SANTRI EMIS

Dokumen ini adalah prompt teknis untuk AI Agent CLI yang akan mengerjakan project Android Al-Hasanah. Agent wajib memakai MCP Supabase untuk membaca struktur database aktual sebelum implementasi.

Project Android:

- Path sumber Android: `/home/arch-din1/Project Android/Alhasanah/alhasanahMedia/app/src/main/java/com/alhasanah/alhasanahmedia/`
- Backend: Supabase project yang sama dengan admin panel
- Admin panel acuan: `/home/arch-din1/Admin Panel/alhasanahAdmin`

Tujuan utama:

- Aplikasi Android wali santri bisa membaca semua data santri, termasuk data sensitif, hanya untuk santri yang memang terhubung ke wali tersebut.
- Data sensitif tetap terenkripsi di database.
- Android tidak boleh membaca kolom `_enc` atau `_hash` langsung.
- Android tidak boleh memakai service role key.
- Semua akses data sensitif harus melalui RPC/Edge Function yang melakukan auth, scope check, decrypt, dan audit log.

## 1. Konteks Perubahan Besar Yang Sudah Terjadi

Sistem santri sudah dipindahkan ke model aman:

- Field sensitif tidak lagi disimpan sebagai plaintext.
- Data sensitif disimpan di kolom `bytea` terenkripsi dengan pgcrypto dan key dari Supabase Vault/private function.
- Admin panel create/edit/show/export menggunakan RPC aman.
- Export EMIS memakai mapping kode final, bukan value internal mentah.
- List santri admin punya indikator preflight EMIS.
- Upload foto santri wajib lewat Edge Function `upload-santri-photo`.

Tabel utama:

- `public.santri`

Kolom terenkripsi penting:

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

Kolom hash:

- `nis_hash`
- `nisn_hash`
- `nik_hash`
- `no_kk_hash`
- `nik_ayah_hash`
- `nik_ibu_hash`
- `nik_wali_hash`
- `no_kip_hash`

Kolom display/operasional plaintext yang boleh dipakai untuk list:

- `nis`
- `nama`
- `foto_url`
- `kelas`
- `jurusan`
- `jenis_kelamin`
- `status_santri`
- `status_mukim`
- `tahun_masuk`
- `geocode_status`

RPC admin yang sudah ada:

- `public.create_santri_secure`
- `public.update_santri_secure`
- `public.get_santri_detail_secure`
- `public.validate_santri_emis`
- `public.export_santri_emis`

Penting: RPC admin tidak boleh dipakai oleh wali jika role-check-nya memang admin-only. Untuk Android wali, buat atau gunakan RPC khusus wali.

## 2. Target Arsitektur Android Wali

Android harus memakai alur berikut:

1. User login melalui Supabase Auth.
2. Android menyimpan session Supabase secara aman.
3. Android mengambil daftar santri milik wali melalui RPC aman.
4. Android membuka detail santri melalui RPC aman.
5. RPC memastikan `auth.uid()` sama dengan `santri.wali_id`.
6. RPC decrypt field sensitif di server database.
7. RPC mencatat audit log.
8. RPC mengembalikan JSON bersih tanpa kolom `_enc` dan `_hash`.
9. Android menampilkan data.
10. Android tidak menyimpan data sensitif secara permanen kecuali terenkripsi lokal dan benar-benar perlu.

Prinsip akses:

- Wali boleh membaca data lengkap anak/santri yang terhubung ke `wali_id = auth.uid()`.
- Wali tidak boleh membaca data santri lain.
- Admin tidak otomatis memakai endpoint wali. Admin memakai endpoint admin.
- Android tidak boleh query `public.santri.select("*")`.

## 3. RPC Yang Perlu Dipastikan Ada

Agent harus cek di Supabase melalui MCP:

```sql
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'list_wali_santri_secure',
    'get_wali_santri_detail_secure'
  );
```

Jika belum ada, buat RPC berikut.

### 3.1 `public.list_wali_santri_secure`

Tujuan:

- Mengembalikan daftar ringkas santri milik wali login.
- Tidak perlu decrypt semua data sensitif.
- Dipakai untuk halaman daftar anak di Android.

Contoh kontrak output:

```json
[
  {
    "nis": "001010100010",
    "nama": "Nurdin Ramramram",
    "foto_url": "...",
    "kelas": "1",
    "jurusan": "KITAB",
    "jenis_kelamin": "L",
    "status_santri": "AKTIF",
    "status_mukim": "MUKIM",
    "tahun_masuk": 2024
  }
]
```

Aturan RPC:

- `SECURITY DEFINER`
- `SET search_path TO public, app_private`
- hanya `authenticated`, bukan `anon`
- filter wajib: `s.wali_id = auth.uid()`
- tidak mengembalikan field `_enc` atau `_hash`
- boleh mencatat audit `LIST_WALI_SANTRI`

### 3.2 `public.get_wali_santri_detail_secure`

Tujuan:

- Mengembalikan detail lengkap santri untuk wali yang sah.
- Termasuk data sensitif yang sudah didekripsi server-side.
- Dipakai halaman detail santri Android.

Input:

```sql
p_nis text,
p_reason text default 'wali_android_detail'
```

Security rule:

```sql
where s.nis = p_nis
  and s.wali_id = auth.uid()
```

Jika tidak cocok, return error:

```text
Santri not found or not linked to current wali
```

Output JSON yang disarankan:

```json
{
  "nis": "001010100010",
  "nama": "Nurdin Ramramram",
  "nisn": "0101100001",
  "nik": "3278010101100001",
  "no_kk": "3278010101100009",
  "tempat_lahir": "Tasikmalaya",
  "tanggal_lahir": "2010-01-01",
  "jenis_kelamin": "L",
  "kelas": "1",
  "jurusan": "KITAB",
  "status_santri": "AKTIF",
  "status_mukim": "MUKIM",
  "agama": "01",
  "kewarganegaraan": "WNI",
  "alamat_lengkap": "...",
  "rt": "001",
  "rw": "001",
  "desa_kelurahan": "...",
  "kecamatan_id": "3278010",
  "kabupaten_kota": "KOTA TASIKMALAYA",
  "provinsi": "JAWA BARAT",
  "kode_pos": "46182",
  "latitude": -7.382122,
  "longitude": 108.217512,
  "ayah": "Rahmat Hidayat",
  "nik_ayah": "3278010101700001",
  "status_ayah": "HIDUP",
  "pendidikan_ayah": "03",
  "pekerjaan_ayah": "03",
  "penghasilan_ayah": "4",
  "ibu": "Siti Aminah",
  "nik_ibu": "3278014101750002",
  "status_ibu": "HIDUP",
  "pendidikan_ibu": "03",
  "pekerjaan_ibu": "01",
  "penghasilan_ibu": "1",
  "nama_wali": "Rahmat Hidayat",
  "nik_wali": "3278010101700001",
  "hubungan_wali": "Ayah Kandung",
  "no_kontak_wali": "081234567890",
  "emis_extra": {},
  "foto_url": "..."
}
```

Audit wajib:

```sql
perform app_private.audit_sensitive_access(
  'READ_SENSITIVE_WALI',
  'santri',
  p_nis,
  jsonb_build_object('reason', coalesce(p_reason, 'wali_android_detail'))
);
```

Jangan return:

- `nik_enc`
- `nisn_enc`
- `no_kk_enc`
- `nama_enc`
- `alamat_lengkap_enc`
- semua kolom `_enc`
- semua kolom `_hash`

## 4. Contoh SQL RPC Wali

Agent boleh memakai contoh ini sebagai basis, tetapi wajib menyesuaikan dengan struktur aktual database dari MCP.

```sql
create or replace function public.list_wali_santri_secure()
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'nis', s.nis,
    'nama', coalesce(s.nama, app_private.decrypt_text(s.nama_enc)),
    'foto_url', s.foto_url,
    'kelas', s.kelas::text,
    'jurusan', s.jurusan::text,
    'jenis_kelamin', s.jenis_kelamin::text,
    'status_santri', s.status_santri::text,
    'status_mukim', s.status_mukim,
    'tahun_masuk', s.tahun_masuk
  ) order by s.nama), '[]'::jsonb)
  into result
  from public.santri s
  where s.wali_id = auth.uid();

  perform app_private.audit_sensitive_access(
    'LIST_WALI_SANTRI',
    'santri',
    'self',
    '{}'::jsonb
  );

  return result;
end;
$$;

revoke all on function public.list_wali_santri_secure() from public, anon;
grant execute on function public.list_wali_santri_secure() to authenticated;
```

Untuk detail, pola utamanya:

```sql
select * into s
from public.santri s
where s.nis = p_nis
  and s.wali_id = auth.uid()
limit 1;
```

Lalu return JSON hasil decrypt seperti `get_santri_detail_secure`, tetapi scope-nya wali.

## 5. Kontrak Android/Kotlin

Android harus memanggil RPC, bukan tabel langsung.

Contoh konsep repository:

```kotlin
interface SantriRepository {
    suspend fun getMySantriList(): List<WaliSantriSummary>
    suspend fun getMySantriDetail(nis: String): WaliSantriDetail
}
```

RPC call:

```kotlin
supabase.postgrest.rpc("list_wali_santri_secure")
```

Detail:

```kotlin
supabase.postgrest.rpc(
    "get_wali_santri_detail_secure",
    mapOf(
        "p_nis" to nis,
        "p_reason" to "android_wali_detail"
    )
)
```

Agent harus menyesuaikan dengan library Supabase Kotlin yang dipakai di project. Jangan menebak package API jika berbeda; baca source Android terlebih dahulu.

## 6. Protokol Keamanan Android

Wajib:

- Gunakan Supabase Auth session user.
- Jangan menyimpan service role key.
- Jangan hardcode anon key selain konfigurasi publishable/anon yang memang aman untuk client.
- Jangan log response detail santri.
- Jangan print NIK, KK, alamat, nama orang tua, nomor HP ke Logcat.
- Jangan simpan detail santri sensitif di SharedPreferences plaintext.
- Jika perlu cache lokal, gunakan EncryptedSharedPreferences atau SQLCipher/Encrypted DataStore.
- Bersihkan state sensitif saat logout.
- Screenshot blocking boleh dipertimbangkan untuk halaman yang menampilkan NIK/KK, tetapi jangan mengorbankan usability jika belum diminta.
- Error UI tidak boleh menampilkan SQL error mentah.

Disarankan:

- Buat DTO terpisah untuk summary dan detail.
- Summary tidak memuat NIK/KK/alamat.
- Detail baru dimuat saat wali membuka halaman detail.
- Tambahkan loading/error state yang jelas.
- Tambahkan pull-to-refresh atau refresh manual.
- Tambahkan masking opsional di UI untuk NIK/KK dengan tombol lihat/sembunyikan jika dibutuhkan.

## 7. Validasi Scope Wali

Test wajib:

1. Login sebagai wali A.
2. Panggil `list_wali_santri_secure`.
3. Pastikan hanya santri dengan `wali_id = auth.uid()` yang muncul.
4. Panggil `get_wali_santri_detail_secure` untuk NIS milik wali A: harus berhasil.
5. Panggil `get_wali_santri_detail_secure` untuk NIS milik wali B: harus gagal.
6. Logout.
7. Panggil RPC tanpa session: harus gagal.
8. Cek audit log muncul untuk akses detail.

Query audit:

```sql
select action, resource, record_id, user_id, user_role, details, created_at
from public.audit_logs
where meta_info = 'sensitive-santri-access'
  and action in ('LIST_WALI_SANTRI', 'READ_SENSITIVE_WALI')
order by created_at desc
limit 20;
```

## 8. Integrasi Dengan Format EMIS

Android tidak wajib melakukan export EMIS. Namun Android detail harus memahami bahwa beberapa value berupa kode:

- `agama = 01` berarti Islam
- `status_mukim = MUKIM` adalah value internal; export EMIS memetakan ke `4`
- `pendidikan_ayah = 03` berarti SD / Sederajat
- `pekerjaan_ayah = 03` berarti Petani
- `penghasilan_ayah = 4` berarti kategori resmi penghasilan

Untuk tampilan Android:

- Boleh tampilkan label manusiawi.
- Simpan value kode dari server apa adanya.
- Jangan mengubah kode sebelum dikirim balik ke server.

Jika Android nanti punya fitur edit data wali/santri, jangan update tabel langsung. Buat RPC khusus:

- `update_wali_santri_contact_secure`
- `request_santri_data_correction`

Lebih aman jika wali hanya mengajukan koreksi, lalu admin menyetujui.

## 9. Hal Yang Tidak Boleh Dilakukan

Jangan:

- `from("santri").select("*")` untuk detail Android.
- Query kolom `_enc` dari Android.
- Query kolom `_hash` dari Android.
- Membuat Edge Function yang memakai service role lalu menerima `nis` tanpa cek `wali_id`.
- Menampilkan data santri lain karena hanya filter di client.
- Menyimpan detail sensitif dalam cache plaintext.
- Mengirim data sensitif ke AI API.
- Memasukkan data sensitif ke crash report/log analytics.

## 10. Checklist Selesai

Implementasi Android dianggap selesai jika:

- Wali login bisa melihat daftar santri miliknya.
- Wali bisa membuka detail lengkap anaknya termasuk field sensitif.
- Wali tidak bisa membuka santri yang bukan miliknya.
- RPC wali ada dan `anon` tidak bisa execute.
- Audit log mencatat akses wali.
- Android tidak memakai service role.
- Android tidak query tabel `santri` langsung untuk detail sensitif.
- Tidak ada NIK/KK/alamat/no HP di Logcat.
- Logout membersihkan data sensitif dari memory/cache.
- Build Android berhasil.

## 11. Instruksi Untuk AI Agent CLI

Mulai pekerjaan dengan urutan ini:

1. Baca dokumen ini.
2. Baca `catatan/SECURITY_PROTOCOL.md`.
3. Baca source Android terkait auth, repository, dan halaman detail santri.
4. Pakai MCP Supabase untuk cek tabel `santri`, `profiles`, RPC, RLS, dan audit log.
5. Jika RPC wali belum ada, buat via Supabase MCP.
6. Verifikasi RPC dengan user wali test.
7. Implementasikan repository Android.
8. Implementasikan UI detail santri dengan state aman.
9. Jalankan build Kotlin.
10. Laporkan file yang diubah, RPC yang dibuat, hasil test, dan risiko tersisa.

Prioritas: keamanan server-side lebih penting daripada kenyamanan query client. Client hanya boleh menerima data setelah server membuktikan bahwa wali tersebut berhak.
