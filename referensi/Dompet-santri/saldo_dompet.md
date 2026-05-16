# Saldo Dompet Santri - Event, Notifikasi, dan Audit

Dokumen ini adalah catatan operasional khusus saldo dan notifikasi Dompet Santri. Spesifikasi utama tetap ada di `referensi/Dompet-santri/dompet_santri.md`.

Status per 2026-05-16: event notifikasi sudah dipondasi di database melalui migration `20260516095108_wallet_notification_event_refinement.sql`, antrean notifikasi memakai `notification_queue`, token Android memakai `user_devices`, dan worker FCM memakai Edge Function `push-notifications`.

## Prinsip

- Saldo tidak boleh diubah langsung dari admin panel, Android, SQL manual, atau AI agent.
- Sumber kebenaran tetap `transaksi_dompet` append-only; `dompet_santri.saldo` hanya cached balance.
- Notifikasi tidak boleh dianggap sebagai bukti transaksi final. Android wajib fetch ulang detail transaksi dari backend.
- Semua event high/critical wajib punya audit trail.
- SMS fallback belum berarti SMS sudah terkirim; database hanya memberi flag agar worker SMS mengirim lewat provider resmi.

## Event Notifikasi Wajib

| Event | Penerima | Priority | Catatan |
| --- | --- | --- | --- |
| Pembayaran kantin berhasil | Wali dan kantin | normal/high | Wali menerima deep link dispute. Kantin menerima konfirmasi pembayaran. |
| Saldo warning `< Rp30.000` | Wali | high | Push FCM. |
| Saldo kritis `< Rp10.000` | Wali | critical | Push FCM dan `sms_fallback_required = true`. |
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
| Hash-chain verification sukses | Auditor | low/email digest | Bukti sistem berjalan normal. |
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
- SMS fallback harus dibuat sebagai worker server-side; jangan kirim SMS dari client Android.
