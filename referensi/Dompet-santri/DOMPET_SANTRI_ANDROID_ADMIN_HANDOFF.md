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
- Halaman wali menampilkan saldo, top up Midtrans, limit, riwayat transaksi, dan form limit.
- Top up saldo dibuat dari Android wali melalui Edge Function `wallet-topup-create`.
- Android hanya membuka Snap token Midtrans; saldo santri baru bertambah setelah webhook `midtrans-payment` memanggil `wallet_post_transaction` kategori `topup`.
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
- `wallet-topup-create`
- `midtrans-payment` untuk webhook Midtrans top up/SPP/donasi
- `push-notifications`

RPC penting:

- `register_my_fcm_device`
- `wallet_post_transaction` internal service role untuk posting top up/kantin/refund ke ledger append-only
- `wallet_set_student_pin_verifier` internal service role
- `wallet_confirm_kantin_student_payment` internal service role
- `wallet_record_pin_failure` internal service role
- `wallet_create_kantin_authorization_session` internal service role
- `wallet_register_kantin_device` internal service role
- `wallet_post_merchant_ledger` internal service role
- `wallet_request_merchant_settlement` internal service role via Edge Function
- `wallet_mark_merchant_settlement_paid` internal service role/admin flow
- `wallet_reject_merchant_settlement` internal service role/admin flow
- `wallet_attach_merchant_settlement_proof` internal service role/admin flow
- `wallet_set_merchant_status` internal service role/admin flow

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
- `supabase/migrations/20260518143000_wallet_reconciliation_and_merchant_payout_proofs.sql`

Edge Function admin yang sudah diperbarui:

- `wallet-admin` versi remote 12
- Action baru: `mark_merchant_settlement_paid`
- Action baru: `reject_merchant_settlement`
- Action baru: `attach_merchant_settlement_proof`
- Action baru: `set_merchant_status`
- Action baru: `quarantine_merchant`

Edge Function wallet top up:

- `wallet-topup-create` versi remote 1
- `wallet-admin-topup-create` untuk top up titipan admin via Midtrans
- `midtrans-payment` versi remote 35
- Order ID top up memakai format `WALLET-TOPUP-{wallet_payment_intents.id}`.
- Order ID top up titipan admin memakai format pendek `WAT-{wallet_payment_intents.id}` agar tidak melewati batas panjang order ID Midtrans.
- Intent top up disimpan di `wallet_payment_intents` dengan `type = 'midtrans_topup'`.
- Top up titipan admin memakai metadata `channel = admin_panel`, `depositor_name`, `depositor_relation`, dan catatan audit.
- Webhook settlement/capture Midtrans:
  - verifikasi signature jika `MIDTRANS_SERVER_KEY` tersedia
  - cocokkan intent berdasarkan `midtrans_order_id`
  - validasi nominal
  - upsert `transaksi_keuangan` kategori `wallet_topup`
  - panggil `wallet_post_transaction` dengan `direction = credit`, `category = topup`
  - idempotency key ledger: `wallet-topup-post:{order_id}`
  - top up Android dicatat sebagai `wali_id`, sedangkan top up titipan admin dicatat sebagai `admin_pencatat_id`

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
- Admin/bendahara harus mengunggah atau mengarsipkan bukti transfer manual payout di bucket private `wallet-merchant-settlement-proofs`.
- Semua aksi harus masuk audit log.

## Yang Perlu Dilanjutkan Di Admin Panel

Prioritas tinggi:

- CRUD merchant kantin: `wallet_merchants`.
- CRUD outlet kantin: `wallet_merchant_outlets`.
- Assign user kantin ke merchant/outlet: `wallet_merchant_users`.
- Approval/revoke device kantin: `kantin_devices`.
- Dashboard saldo merchant: `wallet_merchant_balances`.
- Ledger merchant: `wallet_merchant_ledger`.
- Workflow pencairan:
  - list `wallet_merchant_settlement_requests`
  - approve/reject/request review
  - mark paid via Edge Function `wallet-admin`
  - upload bukti transfer ke bucket private `wallet-merchant-settlement-proofs`
  - attach bukti lewat action `attach_merchant_settlement_proof`
- Rekonsiliasi total:
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

## Status Checklist Lanjutan

Status per 2026-05-18:

1. Sinkron source Android-side ke repo admin

   Status di repo Android ini: sudah ada.

   File lokal yang tersedia:

   - `supabase/functions/wallet-kantin-student-confirm/index.ts`
   - `supabase/functions/wallet-kantin-register-device/index.ts`
   - `supabase/functions/wallet-merchant-settlement-request/index.ts`
   - `supabase/functions/wallet-topup-create/index.ts`
   - `supabase/functions/wallet-admin-topup-create/index.ts`

   Catatan: source `wallet-topup-create` sudah disinkronkan dari Edge Function remote versi 1 ke repo admin. Migration `20260518143000_wallet_reconciliation_and_merchant_payout_proofs.sql` masih perlu disinkronkan dari repo Android jika repo admin menjadi sumber migration tunggal.

2. Rekonsiliasi total lintas saldo

   Status: backend siap, UI admin repo ini sudah menambahkan tampilan dasar di `Pusat Operasional Dompet -> Cek Saldo`.

   Yang sudah ada:

   - saldo santri via `dompet_santri`
   - saldo merchant/kantin via `wallet_merchant_balances`
   - pending settlement via `wallet_merchant_balances.saldo_pending_settlement`
   - ledger merchant via `wallet_merchant_ledger`
   - dana masuk wallet Midtrans via `wallet_payment_intents`
   - tagihan/SPP via `tagihan_santri`
   - transaksi keuangan sukses via `transaksi_keuangan`
   - kolom hasil rekonsiliasi lintas saldo di `wallet_reconciliation_runs`
   - RPC `wallet_run_reconciliation` sudah mengisi `santri_balance_total`, `merchant_liability_total`, `merchant_pending_request_total`, `wallet_topup_midtrans_total`, `spp_paid_total`, `spp_outstanding_total`, dan `difference_liability_vs_bank`

   Yang sudah ditampilkan di admin panel UI:

   - dashboard rekonsiliasi total saldo santri
   - total saldo merchant/kantin
   - total pending settlement
   - dana masuk Midtrans/rekening pesantren
   - tagihan/SPP dan transaksi keuangan
   - selisih/variance lintas ledger

   Catatan: tampilan saat ini berupa tabel operasional untuk bendahara. Jika data sudah besar, tahap berikutnya bisa menambah kartu ringkasan dan grafik tren tanpa mengubah sumber data.

3. Audit dan pembuatan top up Midtrans

   Status: UI admin repo ini sudah menambahkan tab `Top Up Midtrans` di `Pusat Operasional Dompet`.

   Yang ditampilkan:

   - waktu intent
   - sumber top up: aplikasi wali atau titipan admin
   - santri/NIS
   - nominal
   - status pembayaran
   - order ID Midtrans
   - nama penyetor untuk titipan admin
   - ledger yang sudah terposting
   - waktu kedaluwarsa
   - role pembuat

   Yang bisa dibuat admin:

   - bendahara/super admin dapat menekan `Top Up Titipan`;
   - admin memilih santri, nominal, nama penyetor, hubungan penyetor, nomor HP opsional, dan catatan audit;
   - sistem hanya membuat sesi Midtrans;
   - saldo tidak bertambah sampai webhook Midtrans settlement/capture sukses;
   - tidak ada jalur input saldo manual.

   Yang sengaja tidak ditampilkan:

   - Snap token Midtrans
   - provider payload mentah
   - secret/webhook signature

   Aturan: admin panel boleh membuat top up titipan hanya lewat Midtrans. Admin panel tetap tidak boleh menambah saldo manual.

4. Bukti pencairan merchant

   Status: backend siap, UI admin perlu upload/preview.

   Yang sudah ada:

   - bucket private `wallet-merchant-settlement-proofs`
   - policy storage untuk admin `super_admin`, `bendahara`, dan read `rois`
   - kolom `proof_storage_path`, `proof_uploaded_by`, `proof_uploaded_at`, `proof_metadata`
   - RPC `wallet_attach_merchant_settlement_proof`
   - action `wallet-admin.attach_merchant_settlement_proof`
   - action `wallet-admin.mark_merchant_settlement_paid`
   - action `wallet-admin.reject_merchant_settlement`

   Admin panel perlu menambahkan komponen upload file dan preview/download bukti sesuai role.

5. Review notifikasi kritis

   Status: belum selesai.

   Notifikasi operasional masih perlu dibersihkan dari halaman admin `Operasional Dompet -> Notifikasi`. Tandai sebagai `Selesai`, `Sudah diperiksa`, atau `Data uji` sesuai hasil review.

6. Production cleanup non-wallet

   Status: belum selesai.

   Supabase Advisor masih menemukan isu non-wallet, termasuk:

   - RLS disabled: `kategori_barang`, `inventaris`, `lokasi_aset`, `struktur_organisasi`, `spatial_ref_sys`, `kecamatan_polygons`
   - RLS enabled tanpa policy: `detail_transaksi`, `geocode_cache`, `geocode_jobs`, `prestasi_santri`
   - PostGIS masih di schema public
   - public bucket listing: `berita-images`, `pengeluaran-bukti`, `struktur-images`
   - beberapa function legacy `SECURITY DEFINER` masih callable oleh `anon/authenticated`
   - leaked password protection belum aktif

7. Uji E2E setelah perubahan admin terbaru

   Status: belum dilakukan penuh di perangkat/admin panel.

   Yang sudah dilakukan:

   - `./gradlew :app:compileDebugKotlin` berhasil
   - `./gradlew :app:testDebugUnitTest` berhasil
   - Edge Function dan schema dicek via Supabase MCP
   - `wallet-admin` redeploy versi 12
   - bucket proof, policy storage, RPC settlement reject/proof/status merchant diverifikasi via Supabase MCP

   Yang masih harus disimulasikan di perangkat/admin panel:

   - daftar device kantin dari Android
   - approve device dari admin
   - transaksi <= Rp75.000
   - transaksi > Rp75.000 approval wali
   - saldo merchant bertambah
   - pengajuan settlement
   - approve, reject, mark paid
   - revoke device
   - karantina merchant
   - audit keamanan setelah semua simulasi
