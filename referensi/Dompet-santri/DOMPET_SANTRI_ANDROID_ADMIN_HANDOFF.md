# Dompet Santri Android/Admin Handoff

Dokumen ini menjelaskan pekerjaan yang sudah dilakukan di sisi Android dan Supabase untuk fitur Dompet Santri, terutama pemisahan kantin sebagai merchant terpisah dari wali santri. Gunakan ini sebagai rujukan saat melanjutkan pekerjaan admin panel.

## Ringkasan Arsitektur

Dompet Santri memakai model closed-loop:

- Wali membuat akun dompet santri dari aplikasi Android.
- Admin panel tidak membuat dompet santri untuk wali.
- Android tidak pernah mengubah saldo langsung.
- Semua mutasi saldo santri melalui Edge Function/RPC resmi dan ledger append-only.
- QR/NFC kartu santri hanya identifier opaque/public ID, bukan otorisasi.
- Kantin adalah akun merchant terpisah dengan role `kantin`, bukan wali/alumni.
- Dana eksternal tetap cukup lewat satu Midtrans/rekening pesantren.
- Pemisahan saldo dilakukan di ledger internal: saldo santri, saldo tagihan/SPP, saldo kantin/merchant, dan pencairan kantin.

## Android Yang Sudah Dibuat

File utama:

- `app/src/main/java/com/alhasanah/alhasanahmedia/data/model/WalletModels.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/WalletRepository.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/WalletDeviceCrypto.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/WalletSecurityGuard.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/wallet/WalletScreens.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/wallet/WalletViewModels.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/MainActivity.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/AuthRepository.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/AuthRepositoryImpl.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/NotificationRepository.kt`
- `app/src/main/res/xml/network_security_config.xml`

Fitur wali:

- Menu `Dompet Santri` muncul untuk wali yang punya santri aktif.
- Jika dompet belum aktif, wali dapat aktivasi dompet dan membuat PIN santri.
- PIN tidak dikirim plaintext. Android membuat verifier Argon2id dan mengirim salt/verifier ke backend.
- Halaman wali menampilkan saldo, limit, riwayat transaksi, dan form limit.
- Notifikasi wallet/deep link mengarah ke halaman terkait dan aplikasi fetch ulang data backend.
- FCM single-owner dipanggil via RPC `register_my_fcm_device`.
- Logout/switch account menonaktifkan token device saat ini.

Fitur kantin:

- Menu `Kantin Merchant` hanya muncul jika `profiles.role = 'kantin'`.
- Akun kantin bukan wali dan bukan alumni.
- Android kantin membaca assignment dari:
  - `wallet_merchant_users`
  - `wallet_merchants`
  - `wallet_merchant_outlets`
- Android kantin bisa mendaftarkan device melalui Edge Function `wallet-kantin-register-device`.
- Device harus disetujui admin sebelum transaksi.
- Transaksi kantin membawa `merchant_id`, `outlet_id`, `device_id`, nonce, dan signature device.
- QR/NFC tetap opaque. Tidak boleh berisi NIS, nama, PIN, saldo, nomor HP, atau data pribadi.
- Halaman kantin menampilkan saldo merchant internal dan form pengajuan pencairan.
- Pengajuan pencairan dikirim melalui Edge Function `wallet-merchant-settlement-request`.

## Keamanan Android

Yang sudah diterapkan:

- Argon2id untuk PIN/verifier.
- PIN disimpan sebagai `CharArray`, lalu dibersihkan setelah dipakai.
- Byte password/verifier dibersihkan setelah KDF/HMAC.
- Android Keystore dipakai untuk key material lokal.
- Device kantin memakai Ed25519 signing key lokal.
- `FLAG_SECURE` aktif di layar wallet sensitif.
- No BODY logging untuk network release.
- No logging PIN/token/challenge/ciphertext sensitif di fitur wallet baru.
- Certificate pinning Supabase dan Midtrans di `network_security_config.xml`.
- Root/emulator guard untuk operasi wallet sensitif pada release build.

## Supabase / Backend Yang Sudah Ada

Edge Function aktif yang dipakai Android:

- `wallet-register`
- `wallet-update-limits`
- `wallet-kantin-authorize`
- `wallet-kantin-confirm`
- `wallet-kantin-student-confirm`
- `wallet-kantin-register-device`
- `wallet-merchant-settlement-request`
- `push-notifications`

RPC penting:

- `register_my_fcm_device`
- `wallet_set_student_pin_verifier` internal service role
- `wallet_confirm_kantin_student_payment` internal service role
- `wallet_record_pin_failure` internal service role
- `wallet_create_kantin_authorization_session` internal service role
- `wallet_register_kantin_device` internal service role
- `wallet_post_merchant_ledger` internal service role
- `wallet_request_merchant_settlement` internal service role via Edge Function
- `wallet_mark_merchant_settlement_paid` internal service role/admin flow

Tabel wallet/merchant penting:

- `dompet_santri`
- `transaksi_dompet`
- `wallet_payment_intents`
- `wallet_authorization_sessions`
- `wallet_devices`
- `wallet_card_qr_versions`
- `wallet_card_tokens`
- `wallet_nonces`
- `wallet_nonce_uses`
- `kantin_devices`
- `wallet_merchants`
- `wallet_merchant_outlets`
- `wallet_merchant_users`
- `wallet_merchant_balances`
- `wallet_merchant_ledger`
- `wallet_merchant_settlement_requests`
- `wallet_disputes`
- `notification_queue`
- `user_devices`
- `wallet_system_controls`
- `wallet_audit_logs`

Migration lokal baru/terkait:

- `supabase/migrations/20260518082454_wallet_student_pin_verifier.sql`
- `supabase/migrations/20260518084516_wallet_set_student_pin_rpc.sql`
- `supabase/migrations/20260518085256_revoke_public_wallet_pin_verifier.sql`
- `supabase/migrations/20260518131000_wallet_merchant_balance_and_settlement.sql`
- `supabase/migrations/20260518132000_harden_wallet_merchant_internal_functions.sql`

## Flow Kantin Merchant

1. Admin panel membuat akun user dengan `profiles.role = 'kantin'`.
2. Admin panel membuat/menyiapkan merchant di `wallet_merchants`.
3. Admin panel membuat outlet di `wallet_merchant_outlets`.
4. Admin panel assign user kantin ke merchant/outlet di `wallet_merchant_users`.
5. Android kantin login dengan akun role `kantin`.
6. Android kantin mendaftarkan device lewat `wallet-kantin-register-device`.
7. Admin panel mengaktifkan device di `kantin_devices`.
8. Android kantin scan QR/NFC opaque.
9. Android kantin membuat authorization via `wallet-kantin-authorize`.
10. Jika nominal <= Rp75.000, santri input PIN di device kantin.
11. Jika nominal > Rp75.000, transaksi masuk flow approval wali untuk transaksi itu saja.
12. Setelah transaksi posted, trigger backend mengkredit `wallet_merchant_balances` dan mencatat `wallet_merchant_ledger`.
13. Kantin owner/manager mengajukan pencairan saldo.
14. Bendahara/super admin admin panel memproses pencairan dari rekening pesantren dan menandai settlement paid.

## Keputusan Midtrans

Untuk model saat ini cukup satu Midtrans/rekening pesantren.

Alasannya:

- Closed-loop wallet berarti uang eksternal masuk ke pesantren sebagai escrow/operasional internal.
- Saldo santri, tagihan, dan kantin dipisahkan lewat ledger internal.
- Kantin tidak perlu Midtrans terpisah kecuali pesantren ingin settlement langsung ke rekening masing-masing kantin.
- Jika nanti ingin settlement otomatis ke rekening kantin, perlu desain payout/split settlement terpisah dan KYC rekening kantin.

Implikasi admin panel:

- Admin/bendahara harus punya halaman rekap saldo merchant.
- Admin/bendahara harus punya halaman pengajuan pencairan.
- Admin/bendahara harus menandai pencairan sebagai paid hanya setelah dana benar-benar dikeluarkan dari rekening pesantren.
- Semua aksi harus masuk audit log.

## Status Sinkronisasi Admin Panel

Status per 2026-05-18: admin panel sudah disesuaikan dengan perubahan Android/database merchant kantin.

Yang sudah ditambahkan di admin panel:

- Tab `Merchant` untuk membuat/mengubah `wallet_merchants`.
- Tab `Outlet` untuk membuat/mengubah `wallet_merchant_outlets`.
- Tombol assign akun kantin ke merchant/outlet lewat `wallet_merchant_users`.
- Aksi aktif/suspend/revoke device kantin dari drawer akun kantin.
- Tab `Saldo Merchant` untuk membaca `wallet_merchant_balances`.
- Tab `Ledger Merchant` untuk audit `wallet_merchant_ledger`.
- Tab `Pencairan` untuk approve/reject/mark paid `wallet_merchant_settlement_requests`.
- Edge Function `wallet-admin` versi 10 dengan action merchant/outlet/assignment/settlement.

Catatan penting: source migration dan Edge Function Android baru belum semuanya ada di repo admin lokal. Jika repo ini dijadikan sumber deploy tunggal, sinkronkan file Android-side berikut ke repo ini:

- `wallet-kantin-student-confirm`
- `wallet-kantin-register-device`
- `wallet-merchant-settlement-request`
- migration merchant balance/settlement yang disebut pada bagian `File Penting`.

## Checklist Admin Panel

Checklist berikut sekarang sudah diwakili oleh halaman `Manajemen Kantin`, kecuali rekonsiliasi total lintas rekening yang tetap menjadi pekerjaan lanjutan:

- CRUD merchant kantin: `wallet_merchants`.
- CRUD outlet kantin: `wallet_merchant_outlets`.
- Assign user kantin ke merchant/outlet: `wallet_merchant_users`.
- Approval/revoke device kantin: `kantin_devices`.
- Dashboard saldo merchant: `wallet_merchant_balances`.
- Ledger merchant: `wallet_merchant_ledger`.
- Workflow pencairan:
  - list `wallet_merchant_settlement_requests`
  - approve/reject
  - mark paid via RPC/Edge Function admin
  - audit bukti transfer/manual payout
- Rekonsiliasi total lanjutan:
  - saldo santri total
  - saldo merchant total
  - pending settlement
  - dana masuk Midtrans/rekening pesantren
  - tagihan/SPP

Jangan dibuat:

- Jangan buat dompet santri dari admin panel.
- Jangan update saldo santri/kantin langsung dari UI admin.
- Jangan memberi service role ke Android.
- Jangan percaya QR/FCM sebagai sumber kebenaran.
- Jangan bypass ledger append-only.

## Risiko Produksi Tersisa

Supabase Advisor masih melaporkan isu non-wallet yang harus dibereskan sebelum seluruh aplikasi diklaim production-clean:

- RLS disabled pada beberapa tabel public seperti `kategori_barang`, `inventaris`, `lokasi_aset`, `struktur_organisasi`, `spatial_ref_sys`, `kecamatan_polygons`.
- Beberapa function legacy `SECURITY DEFINER` masih callable oleh `authenticated`.
- Beberapa public bucket masih allow listing.
- Auth leaked password protection belum aktif.
- Ada beberapa policy yang terlalu permisif di modul non-wallet.

Untuk fitur Dompet/Kantin, state terakhir:

- Build Android lulus: `./gradlew :app:compileDebugKotlin`.
- Unit test lulus: `./gradlew :app:testDebugUnitTest`.
- Edge Function wallet/kantin aktif.
- Tabel saldo merchant dan settlement sudah RLS aktif.
- Fungsi internal merchant sudah direvoke dari `anon/authenticated` dan hanya service role.
