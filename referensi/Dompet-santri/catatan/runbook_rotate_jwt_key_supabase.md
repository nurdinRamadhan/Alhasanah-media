# Runbook Rotate JWT Signing Key Supabase

Dokumen ini dipakai setiap kali Supabase JWT signing key di-rotate agar admin panel, aplikasi Android, Edge Function, RLS, cron, dan trigger tetap konsisten.

## Prinsip Utama

- Jangan menghapus key lama sebelum semua komponen memakai token baru dan lulus smoke test.
- Jangan menaruh JWT `anon`, `service_role`, atau token user di migration, trigger, cron, source code, atau dokumentasi.
- `verify_jwt=true` hanya untuk Edge Function yang selalu dipanggil dengan session user Supabase.
- Webhook, cron, dan worker internal harus `verify_jwt=false`, lalu autentikasi/validasi dilakukan di dalam handler.
- Semua fungsi keuangan wajib tetap memiliki validasi role di handler meskipun `verify_jwt=true`.

## Fungsi Yang Wajib Publik Di Platform Layer

Fungsi berikut tidak boleh bergantung pada JWT user di platform layer:

- `midtrans-payment`: webhook Midtrans.
- `midtrans-snap`: endpoint pembayaran yang dapat dipakai alur pembayaran eksternal.
- `push-notifications`: worker cron internal.
- `telegram-webhook`: webhook Telegram.
- `rag-query-public`: endpoint publik RAG.

Fungsi di atas harus tetap membatasi akses di handler dengan signature webhook, secret, payload validation, atau aturan domain yang sesuai.

## Fungsi Yang Wajib Membawa JWT User

Fungsi selain daftar publik di atas tetap memakai `verify_jwt=true`, terutama modul dompet:

- `wallet-admin`
- `wallet-register`
- `wallet-update-limits`
- `wallet-kantin-authorize`
- `wallet-kantin-confirm`
- `wallet-security-ai-auditor`
- `wallet-kantin-student-confirm`
- `wallet-kantin-register-device`
- `wallet-merchant-settlement-request`
- `wallet-topup-create`
- `wallet-admin-topup-create`
- `wallet-kantin-provision`
- `wallet-kantin-card-lookup`
- `wallet-merchant-settlement-admin`
- `wallet-dispute-create`

Fungsi ini tetap harus membaca token user dan mengecek role di server, bukan percaya pada UI.

## Checklist Setelah Rotate

1. Login ulang di admin panel dan Android.
2. Pastikan refresh token berhasil dan `/auth/v1/user` tidak massal `401`.
3. Jalankan audit secret:
   - Tidak ada `eyJ...` JWT di source code.
   - Tidak ada JWT di `cron.job.command`.
   - Tidak ada JWT atau `service_role` inline di trigger/function database.
4. Cek Edge Function logs 24 jam terakhir.
5. Cek API logs untuk `401`, `403`, dan `500` baru setelah waktu rotate.
6. Cek Postgres logs untuk error trigger/function.
7. Jalankan worker `push-notifications` manual via `pg_net`.
8. Test RPC `register_user_fcm_device` dengan transaksi `ROLLBACK`.
9. Test modul kritis:
   - Login admin.
   - Verifikasi alumni.
   - Top up wali.
   - Top up titipan admin via Midtrans.
   - Pembayaran kantin.
   - Notifikasi FCM.
   - Audit keamanan dompet.
   - Pencairan merchant.
10. Jalankan Supabase security advisors dan catat temuan yang belum ditutup.

## Catatan Hasil Rotate 2026-05-20

- JWT hardcoded di trigger push lama sudah dihapus.
- Cron `wallet-push-notifications-every-minute` sudah tidak memakai Authorization JWT inline.
- Edge Function `push-notifications` sudah diperbaiki dari pola `PATCH + order/limit` menjadi `SELECT id` lalu `UPDATE selected id`.
- RPC `register_user_fcm_device` sudah diperbaiki agar aman dari konflik token FCM saat Android memanggil registrasi device berdekatan.
- `supabase/config.toml` sudah ditambahkan sebagai manifest status `verify_jwt` agar deploy berikutnya tidak mengubah perilaku auth tanpa sengaja.
- Edge Function `register-alumni` disetel `verify_jwt=false` karena endpoint pendaftaran publik; validasi tetap dilakukan di handler.
- RPC `check_rate_limit` sudah dibuat dan diuji. RPC ini hanya boleh dieksekusi oleh `service_role` dari Edge Function, bukan langsung oleh client.
- RPC `register_user_fcm_device` dikunci untuk `service_role` saja. Android wajib memakai `register_my_fcm_device`, karena fungsi itu mengambil `auth.uid()` dari sesi login aktif.
- Role backend Manajemen Alumni sudah diselaraskan dengan admin panel: `super_admin`, `rois`, `kesantrian`, dan `dewan` dapat menjalankan workflow verifikasi sesuai akses UI.
- RLS hardening non-dompet sudah dilakukan untuk tabel aplikasi yang sebelumnya masih terbuka atau belum punya policy.
- Storage listing publik untuk bucket bukti/struktur/berita sudah ditutup dari listing umum dan diganti policy baca berbasis role admin.
- Semua migration hardening pasca-rotate sudah disalin ke folder Supabase project Android agar tidak terjadi drift antar repo.

## Validasi Hasil 2026-05-20

- `register-alumni` smoke test menghasilkan `400 Email tidak valid`, bukan `401 Auth required` atau `404 rpc/check_rate_limit`.
- API log terbaru menunjukkan `/rest/v1/rpc/check_rate_limit` sudah `200`.
- Worker `push-notifications` terbaru membaca `notification_queue` dengan status `200` tiap menit.
- Privilege RPC kritis:
  - `check_rate_limit`: `anon=false`, `authenticated=false`, `service_role=true`.
  - `register_user_fcm_device`: `anon=false`, `authenticated=false`, `service_role=true`.
  - `register_my_fcm_device`: `anon=false`, `authenticated=true`, `service_role=true`.
- RPC helper/legacy yang sudah dikunci dari `authenticated`:
  - `broadcast_notification_v2`
  - `get_choropleth_data`
  - `terima_bayar_manual`
  - `export_emis_pesantren_santri`
- `get_my_role`: `anon=false`, `authenticated=true`, `service_role=true`. Fungsi ini tetap dibuka karena dipakai beberapa policy RLS dan hanya mengembalikan role user aktif dari `auth.uid()`.
- `check_access_scope`: `anon=false`, `authenticated=true`, `service_role=true`. Fungsi ini tetap dibuka karena dipakai policy RLS pada `santri`; banyak policy wali membaca tabel lain melalui relasi ke `santri`.
- Simulasi RLS sebagai wali `wali@alhasanah.com` untuk santri `12345 / Nurdin Aja` berhasil membaca baris miliknya:
  - profil: 1
  - dompet: 1
  - tagihan: 25
  - perizinan: 4
  - kesehatan: 3
  - pelanggaran: 5
  - tahfidz: 2

## Catatan RPC SECURITY DEFINER

Supabase Advisor akan tetap menampilkan warning untuk beberapa RPC `SECURITY DEFINER` yang sengaja callable oleh `authenticated`. Warning ini tidak otomatis berarti celah, tetapi setiap fungsi wajib punya guard role di dalam function.

RPC yang tetap dibuka karena dipakai langsung oleh admin panel, Android, atau Edge Function dengan user JWT:

- `broadcast_notification_v3`: dipakai halaman notifikasi broadcast; guard role `super_admin`, `kesantrian`, `rois`.
- `create_santri_secure`: dipakai Edge Function `create-user-wali`; guard `app_private.is_santri_admin()`.
- `export_santri_emis`: dipakai Edge Function export EMIS dengan user JWT; guard role EMIS.
- `validate_santri_emis`: dipakai Edge Function validasi EMIS dengan user JWT; guard `app_private.is_santri_admin()`.
- `get_santri_admin`, `get_santri_detail_secure`, `update_santri_secure`: dipakai halaman data santri; guard scope santri dan audit akses sensitif.
- `get_wali_santri_detail_secure`, `list_wali_santri_secure`: dipakai Android wali; guard `auth.uid()` dan relasi wali-santri.
- `register_my_fcm_device`: dipakai Android; aman karena mengambil user dari `auth.uid()`, bukan parameter `user_id`.
- `reset_pelanggaran`: dipakai halaman pelanggaran; guard role kesantrian/super_admin/rois.
- `update_alumni_admin_profile`: dipakai Manajemen Alumni; guard admin forum/alumni.

Jangan mencabut execute dari `is_admin_in_roles`, `get_my_role`, atau `check_access_scope` tanpa mengganti policy RLS yang memakainya. Jika dicabut, Android/admin panel bisa mendapat `403` walaupun ada policy lain yang benar.

## Tindakan Produksi Yang Masih Perlu

- Migrasi API key frontend dari legacy anon JWT ke publishable key bila project sudah siap.
- Pastikan semua komponen backend yang memverifikasi JWT sendiri memakai JWKS atau `getClaims()`, bukan legacy JWT secret.
- Buat smoke test otomatis untuk endpoint Edge Function kritis.
- Review ulang RPC `SECURITY DEFINER` yang masih callable oleh role `authenticated`.
- Temuan PostGIS masih perlu keputusan terpisah:
  - `postgis` masih berada di schema `public`.
  - `spatial_ref_sys` adalah tabel bawaan PostGIS dan masih terdeteksi tanpa RLS.
  - `st_estimatedextent` masih terdeteksi callable oleh `anon/authenticated` walaupun revoke sudah dicoba; jangan pindahkan extension PostGIS di jam operasional tanpa uji staging karena dapat memengaruhi query peta/geospasial.
- Aktifkan Leaked Password Protection di Supabase Dashboard Auth sebelum produksi.
