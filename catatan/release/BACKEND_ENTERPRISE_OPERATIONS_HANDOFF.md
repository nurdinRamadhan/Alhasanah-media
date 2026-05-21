# Backend Enterprise Operations Handoff

Dokumen ini adalah panduan sinkronisasi untuk Codex CLI di Admin Panel Al-Hasanah. Tujuannya agar admin panel menyesuaikan perubahan backend tanpa membuat kontrak baru yang inkonsisten.

## Ringkasan Perubahan

Backend sekarang memiliki lapisan operasional private di schema `ops` dan API terbatas untuk halaman audit private.

Perubahan utama:

- Reminder jatuh tempo tagihan otomatis H-5 sampai hari H.
- Cron push notification dibuat adaptive agar tidak memanggil Edge Function saat tidak ada queue.
- Health snapshot cron dan backend.
- Retry otomatis untuk failure notifikasi yang transient.
- Cleanup histori cron dan `pg_net`.
- Control tower alert backend.
- Audit trail finansial immutable.
- RPC private audit log untuk admin panel, hanya `super_admin`.
- Enam tahap backend enterprise lanjutan:
  - token hygiene otomatis;
  - antrean rekonsiliasi Midtrans pending;
  - alert action center;
  - konteks incident untuk AI;
  - safe repair job otomatis;
  - developer diagnostics RPC.
- Fase self-healing lanjutan:
  - incident playbook engine;
  - auto-repair dengan guardrail;
  - incident timeline;
  - backend health score;
  - self-healing center untuk AI/read-only analysis;
  - weekly maintenance digest.

## Migration Terkait

- `20260520163000_tagihan_due_reminders_daily.sql`
- `20260520174000_optimize_cron_operations_phase1.sql`
- `20260520175500_backend_enterprise_control_tower.sql`
- `20260520181000_finance_immutable_audit_trail.sql`
- `20260520182500_private_audit_log_admin_rpc.sql`
- `20260520183500_harden_finance_audit_source_default.sql`
- `20260520184500_backend_enterprise_priority_1_to_6.sql`
- `20260520191000_backend_self_healing_playbooks.sql`

Catatan remote Supabase: fase self-healing juga tercatat di migration history remote sebagai:

- `backend_self_healing_playbooks`
- `backend_self_healing_runtime_functions`
- `backend_self_healing_cycle_rpc_cron`
- `backend_self_healing_score_and_index_fix`

## Cron Jobs Baru/Diubah

Gunakan daftar ini sebagai sumber kebenaran untuk UI monitoring admin:

- `tagihan-due-reminders-daily`
  - Jadwal: `0 23 * * *` UTC, setara sekitar `06:00 WIB`.
  - Fungsi: membuat reminder tagihan H-5 sampai H-0.

- `wallet-push-notifications-every-minute`
  - Jadwal: `* * * * *`.
  - Diubah menjadi adaptive: hanya memanggil Edge Function `push-notifications` jika ada `notification_queue` pending yang sudah waktunya dikirim.

- `backend-cron-health-hourly`
  - Jadwal: `10 * * * *`.
  - Fungsi: menyimpan snapshot kesehatan backend ke `ops.cron_health_snapshots`.

- `backend-notification-retry-every-15-min`
  - Jadwal: `*/15 * * * *`.
  - Fungsi: retry failure notifikasi transient, maksimal 3 kali.
  - Error permanen seperti `No registered FCM tokens` tidak di-retry.

- `backend-operational-cleanup-daily`
  - Jadwal: `30 18 * * *`, setara sekitar `01:30 WIB`.
  - Fungsi: membersihkan histori operasional lama.

- `backend-alert-checks-every-5-min`
  - Jadwal: `*/5 * * * *`.
  - Fungsi: mendeteksi failure cron, pending notification, Midtrans pending lama, dan webhook sukses tanpa transaksi lokal.

- `backend-token-hygiene-hourly`
  - Jadwal: `25 * * * *`.
  - Fungsi: menyegarkan status health token FCM, menandai device lama sebagai inactive, dan membuat alert jika user aktif tidak punya token push yang sehat.

- `backend-midtrans-reconcile-queue-every-30-min`
  - Jadwal: `5,35 * * * *`.
  - Fungsi: memasukkan transaksi Midtrans pending lebih dari 2 jam ke antrean rekonsiliasi.
  - Catatan: job ini tidak mengubah status uang. Status pembayaran hanya boleh berubah setelah diverifikasi ke Midtrans atau melalui webhook valid.

- `backend-safe-repairs-every-15-min`
  - Jadwal: `7,22,37,52 * * * *`.
  - Fungsi: retry notifikasi transient, menjalankan token hygiene, enqueue rekonsiliasi Midtrans pending, dan auto-resolve alert pending notification jika kondisi sudah normal.

- `backend-self-healing-cycle-every-10-min`
  - Jadwal: `3,13,23,33,43,53 * * * *`.
  - Fungsi: menjalankan alert checks, sinkronisasi incident, auto-repair aman, resolve incident yang normal, eskalasi incident yang gagal diperbaiki, dan capture health score.

- `backend-health-score-hourly`
  - Jadwal: `17 * * * *`.
  - Fungsi: menghitung skor kesehatan backend 0-100 dan membuat rekomendasi operasional.

- `backend-weekly-maintenance-digest`
  - Jadwal: `45 23 * * 0` UTC.
  - Fungsi: membuat digest maintenance mingguan untuk super_admin/developer.

## Schema Private Ops

Jangan baca schema `ops` langsung dari admin panel kecuali memakai service role server-side yang benar-benar private. Untuk UI admin panel berbasis user session, gunakan RPC public wrapper.

Tabel penting:

- `ops.cron_health_snapshots`
  - Snapshot ringkas status backend.
  - Retensi otomatis 30 hari.

- `ops.backend_alerts`
  - Alert dedupe untuk backend.
  - Severity: `info`, `medium`, `high`, `critical`.
  - Status: `open`, `acknowledged`, `resolved`.
  - Kolom action center:
    - `acknowledged_at`
    - `acknowledged_by`
    - `assigned_to`
    - `snoozed_until`
    - `resolution_note`
    - `recommended_action`

- `ops.finance_audit_events`
  - Audit perubahan finansial sensitif.
  - Saat ini mencatat update pada:
    - `public.transaksi_keuangan`
    - `public.tagihan_santri`

- `ops.notification_token_health`
  - Ringkasan kesehatan token FCM per user.
  - Status:
    - `healthy`
    - `missing_token`
    - `stale`
    - `inactive`
    - `unknown`
  - Dipakai admin panel untuk melihat user yang tidak akan menerima push notification meskipun data notifikasi ada di database.

- `ops.midtrans_reconciliation_queue`
  - Antrean transaksi Midtrans yang perlu diverifikasi ulang.
  - Status:
    - `queued`
    - `processing`
    - `synced`
    - `manual_review`
    - `failed`
    - `ignored`
  - Jangan mengubah transaksi keuangan langsung dari tabel ini. Worker/admin harus melakukan verifikasi status ke Midtrans terlebih dahulu.

Semua tabel `ops` yang dibuat/diubah sudah RLS enabled. Tidak ada policy direct table karena akses normal harus lewat RPC atau service-role backend.

Tabel self-healing:

- `ops.incident_playbooks`
  - Daftar playbook operasional.
  - Menentukan komponen, severity, dedupe alert, apakah auto-repair boleh jalan, action repair, dan threshold eskalasi.

- `ops.incidents`
  - Incident aktif/riwayat incident dari alert backend.
  - Status:
    - `open`
    - `repairing`
    - `monitoring`
    - `resolved`
    - `escalated`

- `ops.incident_events`
  - Timeline incident.
  - Event:
    - `detected`
    - `auto_repair_attempt`
    - `auto_repair_success`
    - `auto_repair_failed`
    - `escalated`
    - `resolved`
    - `note`

- `ops.backend_health_snapshots`
  - Snapshot health score 0-100.
  - Status:
    - `healthy`
    - `attention`
    - `degraded`
    - `critical`

- `ops.weekly_maintenance_digests`
  - Ringkasan mingguan alert, incident, token health, queue Midtrans, cron failures, dan rekomendasi.

## Kontrak Notifikasi Backend Alert

Alert `high` dan `critical` akan masuk ke `public.notification_queue`.

Field penting:

- `event_type = 'ops.backend_alert'`
- `source_table = 'ops.backend_alerts'`
- `data.type = 'backend_alert'`
- `data.alert_id`
- `data.severity`
- `data.component`
- `data.dedupe_key`

Admin panel boleh menampilkan item ini sebagai alert operasional. Android wali santri tidak perlu memperlakukan notifikasi ini sebagai navigasi wali.

## RPC Untuk Halaman Audit Log Private

Halaman audit log private di admin panel harus memakai RPC berikut:

### `public.get_private_audit_log_page`

Hanya boleh diakses user dengan role `super_admin`. Fungsi akan melempar error jika user bukan super admin.

Parameter:

- `p_component text default null`
- `p_severity text default null`
- `p_status text default null`
- `p_table_name text default null`
- `p_search text default null`
- `p_limit integer default 50`
- `p_offset integer default 0`

Return: `jsonb`

Struktur return:

```json
{
  "alerts": [],
  "finance_audit_events": [],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total_alerts": 0,
    "total_finance_audit_events": 0
  }
}
```

### `public.get_private_audit_ai_context`

Hanya untuk super admin. Dipakai sebagai konteks ringkas untuk LLM.

Parameter:

- `p_hours integer default 24`

Return berisi:

- `open_alerts_by_severity`
- `recent_alerts`
- `finance_changes_by_table`
- `recent_finance_changes`
- `window_hours`
- `generated_at`

Catatan LLM:

- Jangan kirim seluruh audit table ke LLM.
- Pakai `get_private_audit_ai_context` sebagai ringkasan awal.
- Jika perlu detail, ambil halaman tertentu via `get_private_audit_log_page`.
- LLM hanya boleh memberi analisis dan rekomendasi, bukan menjalankan aksi write otomatis.

## RPC Backend Enterprise Lanjutan

RPC berikut ada di schema `public` agar admin panel bisa memanggil lewat session user. Semua wrapper tetap melakukan validasi internal `super_admin`.

### `public.get_backend_diagnostics`

Hanya `super_admin`.

Parameter: tidak ada.

Return: `jsonb`

Isi utama:

- `cron.active_jobs`
- `cron.failed_runs_24h`
- `cron.latest_runs`
- `notifications.queue_by_status`
- `notifications.token_health`
- `payments.midtrans_queue_by_status`
- `payments.stale_pending_midtrans`
- `alerts.open_by_severity`
- `pg_net.failures_6h`

Gunakan ini untuk halaman developer diagnostics atau health center.

### `public.get_ai_incident_context`

Hanya `super_admin`.

Parameter:

- `p_hours integer default 24`

Return berisi ringkasan alert, queue Midtrans, token health, dan audit finance terbaru. Ini adalah input yang aman untuk AI/LLM karena tidak perlu membaca seluruh tabel private.

Policy AI:

- LLM boleh memberi rekomendasi.
- LLM tidak boleh melakukan write langsung.
- Perubahan status uang wajib berdasarkan verifikasi Midtrans.

### `public.update_backend_alert_action`

Hanya `super_admin`.

Parameter:

- `p_alert_id uuid`
- `p_action text`
- `p_assigned_to uuid default null`
- `p_snoozed_until timestamptz default null`
- `p_note text default null`

Action yang didukung:

- `acknowledge`
- `assign`
- `snooze`
- `resolve`

Gunakan RPC ini untuk action center. Jangan update `ops.backend_alerts` langsung dari client.

## RPC Self-Healing Untuk Super Admin

RPC berikut untuk halaman admin panel khusus `super_admin`. Semua wrapper tetap melakukan validasi internal `super_admin`.

### `public.get_self_healing_center`

Parameter: tidak ada.

Return berisi:

- `latest_health`
- `open_incidents`
- `playbooks`
- `latest_weekly_digest`

Gunakan ini sebagai sumber utama halaman `Self-Healing Center` atau `Backend Command Center`.

### `public.get_incident_timeline`

Parameter:

- `p_incident_id uuid`

Return berisi:

- detail incident;
- timeline event incident dari awal terdeteksi sampai repair/escalation/resolved.

### `public.run_super_admin_safe_repair`

Parameter: tidak ada.

Fungsi:

- menjalankan satu cycle self-healing manual dari admin panel;
- hanya untuk `super_admin`;
- tetap hanya menjalankan repair yang sudah dikategorikan aman.

Catatan guardrail:

- Repair aman boleh retry notifikasi transient, refresh token health, enqueue rekonsiliasi Midtrans, capture cron health, dan cleanup history operasional.
- Repair tidak boleh mengubah status pembayaran/saldo tanpa verifikasi provider.
- AI hanya boleh menjelaskan dan merekomendasikan, bukan menjalankan write otomatis.

## Rekonsiliasi Midtrans

Alur yang benar:

1. Cron `backend-midtrans-reconcile-queue-every-30-min` mendeteksi transaksi Midtrans pending lama dari `public.transaksi_keuangan`.
2. Data dimasukkan ke `ops.midtrans_reconciliation_queue`.
3. Admin panel boleh menampilkan queue ini melalui diagnostics/AI context, bukan direct table dari browser.
4. Worker atau Edge Function berikutnya harus memanggil Midtrans Status API untuk `order_id`.
5. Jika provider menyatakan sukses/gagal/expired, update status harus melewati logic pembayaran yang sama dengan webhook Midtrans.

Jangan pernah mengubah `tagihan_santri.status`, `transaksi_keuangan.status`, atau saldo wallet hanya berdasarkan queue.

## UI Admin Panel Yang Disarankan

Halaman baru: `Private Audit Log` atau `Backend Control Tower`.

Akses:

- Hanya `super_admin`.
- Sembunyikan route/menu untuk role lain.
- Tetap validasi via RPC karena UI hiding bukan security.

Panel yang disarankan:

- Open backend alerts by severity.
- Recent backend alerts.
- Finance audit events.
- Notification token health summary.
- Midtrans reconciliation queue summary.
- Developer diagnostics summary dari `get_backend_diagnostics`.
- Self-healing health score dari `get_self_healing_center.latest_health`.
- Open incidents dari `get_self_healing_center.open_incidents`.
- Incident timeline modal dari `get_incident_timeline`.
- Tombol `Run Safe Repair` yang memanggil `run_super_admin_safe_repair`, hanya untuk `super_admin`.
- Weekly maintenance digest dari `get_self_healing_center.latest_weekly_digest`.
- Filter:
  - component
  - severity
  - status
  - table name
  - search
- AI summary panel:
  - sumber data dari `get_private_audit_ai_context`.
  - tombol "Analisa 24 jam", "Analisa 7 hari".

## Hal Yang Tidak Boleh Dilakukan Admin Panel

- Jangan update langsung tabel `ops.backend_alerts` dari client.
- Jangan expose schema `ops` ke browser.
- Jangan memakai service role di frontend.
- Jangan membuat status pembayaran berubah dari halaman audit.
- Jangan retry/cancel transaksi otomatis dari hasil LLM tanpa flow approval manual.
- Jangan membaca tabel `ops` langsung dari browser.
- Jangan membuat worker rekonsiliasi Midtrans yang update status tanpa memanggil Midtrans Status API.
- Jangan memberi AI akses write langsung.
- Jangan membuat tombol repair untuk role selain `super_admin`.
- Jangan menjalankan repair pembayaran yang mengubah uang dari halaman self-healing tanpa verifikasi Midtrans.

## Kondisi Nyata Saat Verifikasi

Saat checker dijalankan pertama kali, backend menemukan:

- `5` transaksi Midtrans pending lebih dari 2 jam.
- `62` notifikasi gagal dalam 24 jam, mayoritas karena device belum punya FCM token.

Ini sudah tercatat sebagai alert di `ops.backend_alerts`.

Setelah migration `20260520184500_backend_enterprise_priority_1_to_6.sql` dijalankan:

- `ops.run_notification_token_hygiene()` berhasil.
- Hasil token health saat verifikasi:
  - `healthy`: `3`
  - `inactive`: `6`
  - `missing_token`: `21`
- `ops.enqueue_midtrans_pending_reconciliation(100)` berhasil dan memasukkan `5` transaksi ke queue.
- `ops.run_safe_backend_repairs()` berhasil.
- Cron baru aktif:
  - `backend-token-hygiene-hourly`
  - `backend-midtrans-reconcile-queue-every-30-min`
  - `backend-safe-repairs-every-15-min`

Setelah fase self-healing dijalankan:

- `ops.seed_incident_playbooks()` berhasil dan menghasilkan `7` playbook.
- `ops.sync_incidents_from_alerts()` berhasil dan menyinkronkan `5` incident awal.
- `ops.run_self_healing_cycle()` berhasil.
- Cycle manual menjalankan `2` repair aman dan mencatat timeline:
  - `auto_repair_attempt`: `2`
  - `auto_repair_success`: `2`
  - `detected`: `6`
- Cron self-healing aktif:
  - `backend-self-healing-cycle-every-10-min`
  - `backend-health-score-hourly`
  - `backend-weekly-maintenance-digest`
- Weekly digest berhasil dibuat untuk minggu `2026-05-18` sampai `2026-05-24`.
- Health score saat verifikasi masih `critical` karena masalah riil masih ada:
  - queue Midtrans ready: `5`
  - missing token failures 7 hari: `247`
  - open high alerts: `2`
  - open critical alerts: `1`

Ini bukan error migration. Ini berarti self-healing sudah berjalan dan menandai masalah operasional yang harus dibereskan bertahap:

- verifikasi queue Midtrans melalui Status API;
- dorong wali/admin yang missing token untuk login ulang/register FCM;
- review alert critical cron lama.

## Advisor Supabase Yang Masih Perlu Phase Lanjutan

Masih ada temuan lama yang belum disentuh karena perlu hardening terpisah:

- `public.spatial_ref_sys` RLS disabled.
- Extension `postgis` berada di schema `public`.
- Beberapa foreign key belum punya index.
- Beberapa policy permissive ganda.
- Duplicate index pada `public.transaksi_keuangan.midtrans_order_id`.
- Advisor `RLS enabled no policy` pada tabel `ops` adalah kondisi yang disengaja untuk private schema, karena akses normal dilakukan melalui RPC guarded atau service role backend.
- Advisor public security definer untuk RPC admin/diagnostics akan tetap muncul karena wrapper berada di `public`, tetapi fungsi internal melakukan validasi role `super_admin`.
- Advisor `RLS enabled no policy` pada tabel self-healing `ops` juga disengaja.

Jangan bereskan semuanya sekaligus dari admin panel. Buat migration backend terpisah, uji, lalu deploy bertahap.
