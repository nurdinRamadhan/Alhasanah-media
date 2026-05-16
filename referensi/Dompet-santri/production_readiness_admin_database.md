# Production Readiness - Admin Panel dan Database Dompet Santri

Status per 2026-05-16: pondasi admin panel dan database sudah siap untuk tahap uji produksi internal. Dokumen ini dipakai sebelum masuk implementasi Kotlin penuh.

## 1. Yang Sudah Siap

Admin panel:

- Grup sidebar `Dompet Santri`.
- Halaman `Akun & Saldo`.
- Halaman `Operasional & Peringatan`.
- Halaman `Manajemen Kantin`.
- Peringatan critical tampil merah di halaman operasional.
- Maintenance broadcast tersedia, tetapi SMS/email masih ditunda.

Database:

- Ledger append-only.
- Cached balance guarded.
- Hash chain.
- Reconciliation hourly.
- Ledger integrity daily.
- Risk events workflow: `open`, `acknowledged`, `investigating`, `escalated`, `resolved`, `false_positive`.
- Dispute workflow: `open`, `investigating`, `resolved_valid`, `resolved_reversed`, `rejected`, `cancelled`.
- Review dan resolve formal untuk rekonsiliasi dan pemeriksaan ledger.
- Config global awal di `wallet_system_controls.metadata`.

Edge Function:

- Semua aksi admin sensitif lewat `wallet-admin`.
- Tidak ada mutation saldo langsung dari browser.
- Semua aksi penting wajib audit log.

## 2. Yang Sengaja Ditunda

- SMS fallback.
- Email digest.
- Worker khusus SMS/email.

Alasan: membutuhkan provider pihak ketiga, biaya, secret, dan konfigurasi reputasi domain. Untuk fase sekarang, event critical tetap tampil merah di admin panel dan dikirim lewat FCM.

## 3. Checklist Uji Produksi Internal

Jalankan di data development/staging, bukan data produksi.

1. Top-up sukses.
   - Buat payment intent top-up.
   - Simulasikan webhook sukses.
   - Pastikan ledger credit masuk.
   - Pastikan saldo cached naik.
   - Pastikan notifikasi wali masuk antrean.

2. Top-up gagal.
   - Ubah payment intent ke `failed`.
   - Pastikan notifikasi `wallet.topup.failed` masuk antrean.

3. Pembayaran kantin.
   - Pakai device kantin aktif.
   - Buat authorization session.
   - Confirm transaksi.
   - Pastikan ledger debit, riwayat kantin, dan notifikasi wali/kantin terbentuk.

4. Saldo warning/kritis.
   - Buat debit sampai saldo di bawah Rp30.000.
   - Buat debit sampai saldo di bawah Rp10.000.
   - Pastikan event critical tampil merah di halaman operasional.

5. Transaksi besar.
   - Simulasikan transaksi di atas Rp100.000, Rp500.000, dan Rp1.000.000.
   - Pastikan notifikasi role sesuai threshold.

6. Dispute dan reversal.
   - Buka dispute dari transaksi debit.
   - Di admin panel klik `Periksa`.
   - Putuskan `Saldo dikembalikan`.
   - Pastikan ledger refund baru dibuat dan ledger lama tidak berubah.

7. PIN salah 3x.
   - Panggil `wallet_record_pin_failure` 3x.
   - Pastikan wallet terkunci dan notifikasi wali terbentuk.

8. Device kantin revoked.
   - Revoke device.
   - Pastikan authorization dari device itu ditolak.

9. Risk critical dan freeze.
   - Simulasikan risk event `critical`.
   - Pastikan wallet terkunci, notifikasi critical muncul, dan bisa ditangani/diinvestigasi/dieskalasi/diselesaikan dari admin panel.

10. Reconciliation mismatch.
   - Jalankan rekonsiliasi dengan angka rekening cadangan yang berbeda.
   - Pastikan hasil mismatch tampil di `Cek Saldo`.
   - Beri catatan dan tindak lanjut formal.

11. Hash-chain check.
   - Jalankan `Jalankan Cek Ledger`.
   - Pastikan hasil tampil di `Cek Ledger`.
   - Beri catatan dan tindak lanjut formal.

12. Notification queue FCM.
   - Pastikan `push-notifications` mengambil antrean.
   - Pastikan status berubah sesuai hasil kirim.
   - Jika critical belum selesai, pastikan halaman admin tetap merah.

## 4. Gate Sebelum Kotlin

Fitur Kotlin boleh dimulai setelah:

- Semua checklist uji internal lulus.
- Tidak ada error RLS untuk role `wali`, `kantin`, `bendahara`, `rois`, `dewan`, dan `super_admin`.
- Device kantin revoked benar-benar ditolak.
- Ledger tidak bisa update/delete dari client.
- Admin panel tidak punya tombol create dompet, edit saldo langsung, atau delete ledger.
- FCM token wali/kantin berhasil masuk `user_devices`.
- Flow dispute dan refund terbukti append-only.
