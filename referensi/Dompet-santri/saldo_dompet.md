# Saldo Dompet Santri - Event, Notifikasi, dan Audit

Dokumen ini adalah catatan operasional khusus saldo dan notifikasi Dompet Santri. Spesifikasi utama tetap ada di `referensi/Dompet-santri/dompet_santri.md`.

Status per 2026-05-16: event notifikasi sudah dipondasi di database melalui migration `20260516095108_wallet_notification_event_refinement.sql`, antrean notifikasi memakai `notification_queue`, token Android memakai `user_devices`, dan worker FCM memakai Edge Function `push-notifications`.

## Prinsip

- Saldo tidak boleh diubah langsung dari admin panel, Android, SQL manual, atau AI agent.
- Sumber kebenaran tetap `transaksi_dompet` append-only; `dompet_santri.saldo` hanya cached balance.
- Notifikasi tidak boleh dianggap sebagai bukti transaksi final. Android wajib fetch ulang detail transaksi dari backend.
- Semua event high/critical wajib punya audit trail.
- SMS/email belum diaktifkan. Database hanya memberi flag untuk kebutuhan fitur update, sedangkan admin panel menampilkan event kritis di halaman operasional.

## Event Notifikasi Wajib

| Event | Penerima | Priority | Catatan |
| --- | --- | --- | --- |
| Pembayaran kantin berhasil | Wali dan kantin | normal/high | Wali menerima deep link dispute. Kantin menerima konfirmasi pembayaran. |
| Saldo warning `< Rp30.000` | Wali | high | Push FCM. |
| Saldo kritis `< Rp10.000` | Wali dan admin panel | critical | Push FCM, tampil merah di admin panel, dan `sms_fallback_required = true` untuk fitur update SMS nanti. |
| Transaksi `>= Rp100.000` | Bendahara | high | Monitoring rutin. |
| Transaksi `>= Rp500.000` | Rois | critical | Anomali signifikan. |
| Transaksi `>= Rp1.000.000` atau 3 transaksi besar/jam | Super admin | critical | Menghindari alert fatigue pada super admin. |
| Risk LOW | Log saja | low | Tidak ada push realtime. |
| Risk MEDIUM | Auditor | normal | Wali tidak perlu diganggu. |
| Risk HIGH | Auditor dan wali | high | Wallet dikunci otomatis. |
| Risk CRITICAL | Auditor, wali, super admin | critical | Wallet dikunci, SLA respons 15 menit. |
| Dispute dibuka | Super admin, bendahara, rois | high | SLA respons 48 jam. |
| Dispute lewat SLA | Super admin | critical | Cron `wallet-dispute-sla-hourly`. |
| Dispute selesai valid | Wali | normal | Transaksi dinyatakan valid. |
| Dispute reversed | Wali | normal | Saldo dikembalikan lewat ledger reversal. |
| Login perangkat baru | Wali/kantin pemilik akun | critical | Deep link kunci akun. |
| PIN salah 3x/15 menit | Wali | high | Wallet dikunci sementara. |
| PIN salah >10x/jam | Auditor | critical | Indikasi serangan brute force. |
| Top-up gagal | Wali | high | Penting jika webhook Midtrans timeout/gagal. |
| Weekly digest Minggu | Wali | low | Ringkasan transaksi, total belanja, saldo, dan top pengeluaran. |
| Hash-chain verification sukses | Auditor | low/log admin | Bukti sistem berjalan normal. Email digest ditunda sebagai fitur update. |
| Hash-chain verification gagal | Auditor | critical | Freeze atau investigasi. |
| Freeze/unfreeze dompet | Auditor, wali terkait, kantin | normal/critical | Kantin perlu tahu real-time agar kartu tidak diproses. |
| Maintenance/downtime | Semua role aktif terkait dompet | high | Kantin diminta menyiapkan pencatatan manual sementara. |

## Template Pesan

Pembayaran kantin ke wali:

```text
[Nama anak] beli di Kantin [nama kantin], Rp [nominal], sisa saldo Rp [saldo]. Bukan kamu? Laporkan segera.
```

Pembayaran kantin ke kantin:

```text
Pembayaran diterima Rp [nominal] - [nama santri] - [waktu]
```

Dispute valid:

```text
Transaksi [ID] telah diverifikasi valid. Jika masih bermasalah hubungi pesantren.
```

Dispute reversed:

```text
Transaksi [ID] telah dibalik. Saldo Rp [nominal] telah dikembalikan.
```

Login perangkat baru:

```text
Login baru terdeteksi di akun kamu dari perangkat [nama device]. Bukan kamu? Kunci akun sekarang.
```

PIN salah 3x:

```text
Ada 3 percobaan PIN salah di akun [nama anak]. Akun dikunci sementara 15 menit.
```

Maintenance:

```text
Sistem dompet santri akan dalam pemeliharaan [tanggal] pukul [waktu] selama estimasi [durasi]. Kantin harap siapkan pencatatan manual sementara.
```

## Deep Link Android

- Form dispute transaksi: `alhasanah://wallet/dispute?ledger_id={ledger_id}`.
- Kunci akun karena perangkat baru: `alhasanah://security/lock-account`.
- Detail transaksi: Android harus membuka detail dengan fetch ulang dari backend, bukan membaca nominal dari push sebagai sumber kebenaran.

## Implementasi Database

Objek penting:

- `notification_queue`: antrean notifikasi lintas channel.
- `user_devices`: token FCM Android.
- `wallet_pin_attempts`: audit PIN gagal.
- `wallet_weekly_digest_runs`: audit pembuatan ringkasan mingguan.
- `wallet_disputes.response_due_at`: SLA dispute 48 jam.
- `wallet_risk_events.response_due_at`: SLA risk critical 15 menit.

Function penting:

- `wallet_record_pin_failure(...)`: mencatat PIN gagal, lock setelah 3x/15 menit, eskalasi auditor jika >10x/jam.
- `wallet_escalate_overdue_disputes()`: eskalasi dispute yang lewat 48 jam.
- `wallet_run_weekly_digest()`: membuat digest mingguan wali.
- `wallet_broadcast_maintenance(...)`: broadcast downtime/maintenance.
- `wallet_acknowledge_risk_event(...)`: menandai peringatan keamanan sedang ditangani.
- `wallet_resolve_risk_event(...)`: menyelesaikan peringatan keamanan sebagai valid atau false alarm.
- `wallet_start_dispute_investigation(...)`: menandai laporan wali sedang diperiksa.
- `wallet_review_reconciliation_run(...)`: menyimpan catatan admin untuk hasil cek saldo.
- `wallet_review_integrity_run(...)`: menyimpan catatan admin untuk hasil cek ledger.

Cron aktif:

- `wallet-push-notifications-every-minute`: kirim antrean FCM setiap menit.
- `wallet-dispute-sla-hourly`: cek dispute lewat SLA setiap jam.
- `wallet-weekly-digest-sunday`: buat ringkasan wali setiap Minggu.

## Catatan Integrasi Kotlin

- Daftarkan token FCM wali/kantin ke `user_devices`.
- Untuk event high/critical, tampilkan notifikasi singkat lalu fetch detail dari RPC/view resmi.
- Implementasikan certificate pinning untuk endpoint Supabase dan Midtrans.
- Implementasikan deep link dispute dan lock account.
- Jangan jadikan push notification sebagai otorisasi transaksi.
- SMS/email fallback ditunda. Jika nanti dibuat, worker harus server-side; jangan kirim SMS/email dari client Android.

## Catatan Admin Panel

Halaman operasional admin ada di `/dompet-operasional` dengan nama menu `Operasional Dompet`.

Tab yang tersedia:

- `Peringatan Keamanan`: admin menekan `Tangani`, `Periksa`, `Eskalasi`, dan `Selesaikan` sesuai kondisi.
- `Laporan Wali`: bendahara dapat menekan `Periksa` dan `Putuskan`; jika saldo dikembalikan, sistem membuat ledger refund baru.
- `Cek Saldo`: jalankan cek manual, review hasil rekonsiliasi, dan beri tindak lanjut formal agar selisih tidak diabaikan.
- `Cek Ledger`: jalankan cek manual, review hasil hash-chain verification, dan beri tindak lanjut formal.
- `Notifikasi`: melihat antrean FCM dan error pengiriman. Notifikasi `critical` yang belum selesai tampil merah agar admin segera melihat masalah.
- Pada tab `Notifikasi`, admin berwenang dapat menekan `Review` untuk memberi keputusan `Sudah diperiksa`, `Selesai`, atau `Data uji`. Catatan review wajib diisi agar keputusan masuk audit.
- Audit keamanan hanya menghitung notifikasi kritis yang masih `Belum diperiksa`. Riwayat gagal lama yang sudah direview tidak boleh terus membuat audit terlihat kritis, tetapi tetap tersimpan sebagai bukti.

Istilah UI sengaja memakai bahasa non-teknis supaya bendahara atau pengurus yang bukan programmer tetap bisa memahami tindakan yang harus dilakukan.

## Audit Keamanan Dompet

Halaman audit keamanan admin ada di `/dompet-security-audit` dengan nama menu `Audit Keamanan`.

Fungsi halaman ini:

- menjalankan pemeriksaan keamanan satu klik;
- menjalankan analisis AI dari hasil audit manual yang sudah disanitasi;
- menampilkan skor keamanan 0-100;
- menampilkan status `Aman`, `Perlu perhatian`, `Berisiko`, atau `Kritis`;
- menampilkan ringkasan lapisan Network, App, API, Database, dan Data;
- menampilkan temuan dan rekomendasi dengan bahasa yang mudah dipahami admin non-teknis.

Audit memeriksa rekonsiliasi, hash-chain ledger, freeze switch, risk event, dispute lewat SLA, notifikasi kritis yang masih terbuka, device kantin, percobaan PIN gagal, RLS/grant, QR opaque, Argon2id, dan cron dompet.

Analisis AI memakai Edge Function `wallet-security-ai-auditor` dan menyimpan hasil di `wallet_security_ai_analyses`. AI tidak mengganti audit manual; AI hanya membantu membaca prioritas risiko, gejala awal, risiko Android, risiko database, dan blocker produksi. Master prompt ada di `referensi/Dompet-santri/catatan/master_prompt_ai_security_auditor.md`.

Kebijakan transaksi:

- Transaksi sampai Rp75.000 tidak meminta verifikasi wali setiap kali.
- Transaksi di atas Rp75.000 wajib meminta persetujuan wali.
- Akumulasi belanja harian/bulanan tidak memicu approval wali untuk transaksi kecil; akumulasi dikontrol oleh limit wali.
- Jika limit harian/bulanan tercapai, sistem membuat notifikasi wali; jika transaksi melewati limit, transaksi ditolak.
- Semua transaksi tetap harus server-side, memakai idempotency key, nonce, device kantin aktif, dan otorisasi valid.

FCM token Android:

- Aplikasi wajib memanggil RPC `register_my_fcm_device` setelah login dan saat token berubah.
- Satu token FCM hanya boleh aktif untuk satu user terakhir yang login di perangkat tersebut.
- Worker FCM hanya mengirim ke `user_devices.is_active = true`.
- Ini mencegah push dompet milik wali muncul di perangkat yang saat ini sedang login sebagai alumni/admin karena bekas token login lama.

SMS/email fallback tetap ditunda. Untuk saat ini, peringatan kritis tampil di admin panel lewat halaman `Operasional Dompet` dan `Audit Keamanan`.

Checklist uji produksi internal sebelum Kotlin ada di `referensi/Dompet-santri/production_readiness_admin_database.md`.
