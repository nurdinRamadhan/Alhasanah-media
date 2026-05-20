# Panduan Super Admin: Backend Command Center

Dokumen ini menjelaskan fitur **Backend Command Center** pada Admin Panel Al-Hasanah. Tujuannya agar `super_admin` memahami arti setiap panel, istilah, tombol, status, dan informasi yang tampil sebelum mengambil keputusan operasional.

Fitur ini dibuat untuk membaca kondisi backend, incident, audit private, dan rekomendasi AI secara aman. Halaman ini **bukan** alat untuk mengubah saldo, status pembayaran, tagihan, transaksi, atau ledger keuangan.

---

## 1. Prinsip Utama Fitur

### 1.1 Hanya Untuk Super Admin

Menu dan halaman Backend Command Center hanya tersedia untuk role:

- `super_admin`

Jika user bukan `super_admin`, menu tidak ditampilkan dan halaman akan diblokir.

### 1.2 Data Dibaca Lewat RPC Aman

Halaman ini tidak membaca tabel private `ops` langsung dari browser. Semua data backend operations dibaca melalui RPC public wrapper yang sudah divalidasi backend.

RPC yang dipakai:

- `public.get_self_healing_center()`
- `public.get_incident_timeline(p_incident_id uuid)`
- `public.run_super_admin_safe_repair()`
- `public.get_backend_diagnostics()`
- `public.get_ai_incident_context(p_hours)`
- `public.get_private_audit_log_page(...)`
- `public.get_private_audit_ai_context(p_hours)`
- `public.update_backend_alert_action(...)`

### 1.3 AI Bersifat Read-Only

AI Operations Analyst hanya membaca konteks ringkas dari backend dan memberi analisis atau rekomendasi. AI tidak bisa menjalankan action otomatis.

Hal yang tidak boleh dilakukan AI:

- mengubah status pembayaran;
- mengubah saldo;
- mengubah tagihan;
- mengubah transaksi;
- mengeksekusi repair otomatis;
- menyelesaikan alert tanpa klik manual super admin;
- menyatakan transaksi Midtrans sukses hanya dari antrean rekonsiliasi.

---

## 2. Struktur Menu

Menu sidebar baru:

```text
Backend Command Center
├── Self-Healing Center
├── Backend Diagnostics
└── Private Audit Log
```

### 2.1 Self-Healing Center

Halaman untuk melihat kesehatan backend secara umum, incident aktif, playbook self-healing, weekly digest, dan menjalankan safe repair manual.

### 2.2 Backend Diagnostics

Halaman teknis untuk melihat status cron, antrean notifikasi, token FCM, antrean Midtrans, alert, dan kegagalan `pg_net`.

### 2.3 Private Audit Log

Halaman audit private untuk melihat backend alerts, finance audit events, filter audit, pagination, AI context, dan action center untuk alert.

---

## 3. Self-Healing Center

Sumber utama data:

- `public.get_self_healing_center()`
- `public.get_incident_timeline(p_incident_id)`
- `public.run_super_admin_safe_repair()`
- `public.get_ai_incident_context(p_hours)`

### 3.1 Backend Health Score

Health score adalah nilai kesehatan backend dari `0` sampai `100`.

Arti umum nilai:

- `90-100`: sistem sehat;
- `70-89`: perlu perhatian ringan;
- `40-69`: ada degradasi atau beberapa masalah aktif;
- `0-39`: kondisi kritis dan perlu prioritas super admin.

Nilai ini tidak berdiri sendiri. Super admin tetap perlu melihat status, breakdown, incident, dan rekomendasi.

### 3.2 Status Health

Status health menjelaskan tingkat kondisi backend.

Kemungkinan status:

- `healthy`: backend berjalan normal;
- `attention`: ada gejala yang perlu dipantau;
- `degraded`: sebagian fungsi backend bermasalah;
- `critical`: ada masalah serius yang perlu ditangani.

Status `critical` bukan berarti sistem pasti mati total. Artinya backend menemukan indikator operasional yang perlu prioritas tinggi.

### 3.3 Breakdown

Panel Breakdown menampilkan komponen penyusun health score.

Contoh informasi yang bisa muncul:

- jumlah alert terbuka;
- antrean Midtrans yang perlu rekonsiliasi;
- token FCM bermasalah;
- cron gagal;
- notifikasi gagal;
- incident aktif.

Gunakan panel ini untuk memahami alasan health score turun.

### 3.4 Recommendations

Panel Recommendations berisi saran dari backend berdasarkan data operasional.

Contoh:

- review alert critical;
- cek cron lama yang gagal;
- dorong user untuk login ulang jika token FCM hilang;
- verifikasi transaksi Midtrans pending melalui flow backend.

Recommendations adalah panduan awal, bukan eksekusi otomatis.

### 3.5 Open Incidents

Open Incidents menampilkan incident yang masih aktif.

Kolom penting:

- **Incident**: nama, komponen, atau dedupe key incident;
- **Severity**: tingkat keparahan;
- **Status**: posisi incident saat ini;
- **Dibuka**: waktu incident mulai tercatat;
- **Timeline**: tombol untuk melihat riwayat detail incident.

### 3.6 Severity

Severity menunjukkan tingkat keparahan alert atau incident.

Makna severity:

- `info`: informasi atau sinyal rendah;
- `medium`: masalah perlu dipantau;
- `high`: masalah penting, perlu ditindaklanjuti;
- `critical`: masalah prioritas tinggi.

Warna badge dibuat konsisten:

- biru untuk info;
- kuning untuk medium;
- oranye untuk high;
- merah untuk critical.

### 3.7 Incident Status

Status incident menjelaskan posisi penanganan.

Makna status:

- `open`: incident masih terbuka;
- `repairing`: backend sedang atau sudah mencoba repair;
- `monitoring`: incident sedang dipantau setelah repair;
- `resolved`: incident selesai;
- `escalated`: incident meningkat dan perlu review manusia.

### 3.8 Incident Timeline

Incident Timeline dibuka dari tombol **Timeline** pada Open Incidents.

Timeline menampilkan:

- detail incident;
- event berurutan;
- event type;
- waktu event;
- message;
- data JSON ringkas.

Event type yang mungkin muncul:

- `detected`: incident terdeteksi;
- `auto_repair_attempt`: backend mencoba repair aman;
- `auto_repair_success`: repair aman berhasil;
- `auto_repair_failed`: repair aman gagal;
- `escalated`: incident dinaikkan prioritasnya;
- `resolved`: incident selesai;
- `note`: catatan tambahan.

Gunakan timeline untuk menjawab pertanyaan: “apa yang terjadi, kapan terjadi, dan apa yang sudah dicoba backend?”

### 3.9 Playbooks

Playbooks adalah daftar aturan operasional backend untuk mengenali dan menangani incident.

Kolom penting:

- **Playbook**: nama playbook;
- **Component**: area backend yang dipantau;
- **Severity**: tingkat keparahan default;
- **Auto Repair**: apakah playbook boleh menjalankan repair aman;
- **Action**: jenis repair atau tindakan yang disarankan.

Playbook membantu backend self-healing bekerja konsisten. Super admin tidak perlu menjalankan playbook langsung dari UI.

### 3.10 Latest Weekly Digest

Latest Weekly Digest adalah ringkasan maintenance mingguan.

Biasanya berisi:

- rangkuman alert;
- rangkuman incident;
- status token;
- status queue Midtrans;
- cron failures;
- rekomendasi maintenance.

Gunakan digest untuk review mingguan, bukan hanya firefighting harian.

### 3.11 Tombol Refresh

Tombol **Refresh** memuat ulang data terbaru dari backend.

Refresh aman dilakukan kapan saja karena hanya membaca data.

### 3.12 Tombol Run Safe Repair

Tombol **Run Safe Repair** menjalankan repair aman manual melalui:

- `public.run_super_admin_safe_repair()`

Tombol ini tidak otomatis berjalan saat halaman dibuka. Harus diklik manual oleh super admin.

Repair aman dapat mencakup:

- retry notifikasi transient;
- refresh token health;
- enqueue rekonsiliasi Midtrans pending;
- capture cron health;
- cleanup history operasional;
- auto-resolve alert tertentu jika kondisi sudah normal.

Repair aman **tidak boleh**:

- mengubah status pembayaran tanpa verifikasi provider;
- mengubah saldo;
- mengubah tagihan;
- mengubah ledger;
- menyatakan Midtrans sukses tanpa Midtrans Status API.

Setelah repair sukses, halaman akan refresh data.

---

## 4. Backend Diagnostics

Sumber data:

- `public.get_backend_diagnostics()`

Halaman ini fokus pada kondisi teknis backend.

### 4.1 Active Cron Jobs

Menampilkan cron job yang aktif.

Cron job adalah proses otomatis terjadwal, misalnya:

- kirim reminder tagihan;
- retry notifikasi;
- health check backend;
- enqueue rekonsiliasi Midtrans;
- self-healing cycle.

Jika job penting tidak muncul, berarti ada risiko proses otomatis tidak berjalan.

### 4.2 Failed Runs 24h

Menampilkan cron run yang gagal dalam 24 jam terakhir.

Gunakan panel ini untuk melihat:

- job mana yang gagal;
- kapan gagal;
- pola kegagalan berulang.

Failure satu kali belum tentu kritis. Failure berulang perlu diperiksa.

### 4.3 Latest Cron Runs

Menampilkan run cron terbaru.

Panel ini berguna untuk memastikan:

- cron masih berjalan;
- job terakhir sukses atau gagal;
- interval cron sesuai ekspektasi.

### 4.4 Notification Queue By Status

Menampilkan jumlah antrean notifikasi berdasarkan status.

Status yang mungkin:

- `pending`: menunggu dikirim;
- `sent`: sudah terkirim;
- `failed`: gagal;
- status lain sesuai backend.

Pending tinggi bisa berarti antrean belum diproses. Failed tinggi bisa berarti FCM token, device, atau provider notification bermasalah.

### 4.5 Token Health

Token Health menampilkan kondisi token FCM user.

Status token:

- `healthy`: token aktif dan sehat;
- `missing_token`: user tidak punya token push aktif;
- `stale`: token lama dan perlu refresh;
- `inactive`: device/user dianggap tidak aktif;
- `unknown`: kondisi belum bisa dipastikan.

Jika banyak `missing_token`, push notification mungkin gagal walaupun data notification queue dibuat dengan benar.

### 4.6 Midtrans Queue By Status

Menampilkan antrean rekonsiliasi Midtrans berdasarkan status.

Status yang mungkin:

- `queued`: menunggu diproses;
- `processing`: sedang diproses worker;
- `synced`: sudah sinkron;
- `manual_review`: perlu review manual;
- `failed`: proses gagal;
- `ignored`: diabaikan sesuai aturan backend.

Penting: queue Midtrans bukan bukti pembayaran sukses. Queue hanya berarti transaksi perlu diverifikasi ulang.

### 4.7 Stale Pending Midtrans

Menampilkan transaksi Midtrans pending yang sudah terlalu lama.

Arti informasi ini:

- ada transaksi lokal yang statusnya belum final;
- transaksi perlu diverifikasi ke Midtrans Status API;
- perubahan status uang wajib lewat worker/backend flow, bukan UI ini.

### 4.8 Open Alerts By Severity

Menampilkan jumlah alert terbuka berdasarkan severity.

Gunakan panel ini untuk memutuskan prioritas:

1. critical;
2. high;
3. medium;
4. info.

### 4.9 Pg Net Failures

`pg_net` adalah mekanisme Postgres untuk melakukan request HTTP dari database, misalnya memanggil Edge Function tertentu.

Pg Net Failures berarti ada panggilan HTTP dari database yang gagal.

Kemungkinan penyebab:

- endpoint tidak merespons;
- network timeout;
- error auth;
- payload invalid;
- service eksternal sedang bermasalah.

---

## 5. Private Audit Log

Sumber data:

- `public.get_private_audit_log_page(...)`
- `public.get_private_audit_ai_context(p_hours)`
- `public.update_backend_alert_action(...)`

Halaman ini menggabungkan audit backend alert dan finance audit events.

### 5.1 Filter

Filter yang tersedia:

- **Component**: area backend, misalnya `cron`, `notification`, `midtrans`, atau komponen lain;
- **Severity**: tingkat keparahan alert;
- **Status**: status alert;
- **Table Name**: nama tabel audit finance;
- **Search**: pencarian teks.

Filter membantu super admin mempersempit data audit tanpa membuka seluruh tabel mentah.

### 5.2 Backend Alerts

Tab Backend Alerts menampilkan alert backend private.

Kolom penting:

- **Alert**: ringkasan alert;
- **Component**: komponen yang bermasalah;
- **Severity**: tingkat keparahan;
- **Status**: posisi penanganan;
- **Waktu**: waktu alert tercatat;
- **Rekomendasi**: recommended action dari backend;
- **Action Center**: tombol tindakan manual.

### 5.3 Finance Audit Events

Tab Finance Audit Events menampilkan audit perubahan data finansial sensitif.

Kolom penting:

- **Waktu**: waktu event;
- **Table**: tabel yang berubah;
- **Action**: jenis operasi;
- **Actor**: pelaku perubahan jika tersedia;
- **Record**: identitas record;
- **Changes**: ringkasan perubahan.

Finance audit bersifat immutable/audit trail. Gunakan untuk investigasi, bukan untuk mengedit data.

### 5.4 Pagination

Tombol pagination:

- **Sebelumnya**: kembali ke halaman data sebelumnya;
- **Berikutnya**: memuat halaman data berikutnya.

Pagination menjaga UI tetap ringan dan tidak mengambil seluruh audit table sekaligus.

### 5.5 Backend Alerts Action Center

Action Center memakai:

- `public.update_backend_alert_action(...)`

Action yang tersedia:

- `acknowledge`;
- `assign`;
- `snooze`;
- `resolve`.

Semua action membutuhkan konfirmasi sebelum dikirim.

Setelah action sukses, data akan refresh.

### 5.6 Acknowledge

`acknowledge` berarti super admin sudah melihat alert dan mengakui bahwa alert sedang/akan ditangani.

Gunakan jika:

- alert valid;
- belum selesai;
- sedang masuk proses review.

Acknowledge tidak menyelesaikan alert.

### 5.7 Assign

`assign` berarti alert ditugaskan kepada user tertentu.

Input yang diminta:

- UUID user assignee.

Gunakan jika:

- alert perlu ditangani orang tertentu;
- butuh pembagian tanggung jawab.

### 5.8 Snooze

`snooze` berarti alert ditunda sampai waktu tertentu.

Gunakan jika:

- alert sudah diketahui;
- sedang menunggu kondisi eksternal;
- belum perlu tampil sebagai prioritas sampai waktu tertentu.

Snooze tidak menyelesaikan masalah. Snooze hanya menunda perhatian.

### 5.9 Resolve

`resolve` berarti alert dianggap selesai.

Gunakan hanya jika:

- kondisi sudah normal;
- penyebab sudah ditangani;
- data terbaru mendukung bahwa alert tidak aktif lagi;
- tidak ada risiko finansial yang belum diverifikasi.

Resolve tidak boleh digunakan untuk “menyembunyikan” masalah yang belum jelas.

---

## 6. AI Operations Analyst

AI Operations Analyst tersedia di setiap halaman Backend Command Center.

Sumber AI:

- Edge Function `backend-ops-ai-analyst`

Function ini:

- wajib JWT valid;
- hanya menerima `super_admin`;
- mengambil data lewat RPC public wrapper;
- menyaring data sensitif sebelum dikirim ke model;
- memakai AI hanya untuk analisis read-only.

### 6.1 Tombol Analisa 24 Jam

Menganalisis konteks operasional dalam window 24 jam.

Gunakan untuk:

- kondisi harian;
- incident baru;
- alert terbaru;
- perubahan yang baru terjadi.

### 6.2 Tombol Analisa 7 Hari

Menganalisis konteks operasional dalam window 7 hari.

Gunakan untuk:

- pola berulang;
- tren failure;
- review mingguan;
- masalah yang tidak selesai dalam satu hari.

### 6.3 Input Pertanyaan

Super admin bisa menulis pertanyaan spesifik.

Contoh:

- "Kenapa health score critical?"
- "Apa prioritas yang harus ditangani hari ini?"
- "Apakah ada risiko Midtrans?"
- "Apa yang harus saya cek sebelum resolve alert?"

AI akan menjawab berdasarkan konteks yang tersedia, bukan berdasarkan akses bebas ke database.

### 6.4 Ringkasan Eksekutif

Ringkasan eksekutif adalah kesimpulan singkat AI.

Gunakan bagian ini untuk memahami keadaan umum sebelum membaca detail.

### 6.5 Fakta Terbaca

Fakta Terbaca adalah data yang AI lihat dari konteks RPC.

Contoh:

- ada alert critical;
- ada stale pending Midtrans;
- ada token missing;
- ada cron failed.

Fakta harus berasal dari data, bukan asumsi.

### 6.6 Temuan Kritis

Temuan Kritis adalah masalah yang menurut AI perlu prioritas tinggi.

Gunakan bagian ini sebagai daftar awal hal yang perlu dicek.

Jika AI menulis “belum cukup bukti”, berarti data belum cukup untuk mengambil kesimpulan final.

### 6.7 Saran Eksekusi

Saran Eksekusi adalah urutan tindakan manual yang disarankan AI.

Contoh:

- review incident critical;
- cek timeline incident;
- verifikasi queue Midtrans melalui flow backend;
- minta user login ulang untuk refresh FCM;
- jalankan Run Safe Repair jika sesuai.

Saran ini tidak otomatis menjalankan action.

### 6.8 Perlu Review Manual

Bagian ini menunjukkan hal yang tidak boleh diputuskan otomatis.

Contoh:

- transaksi pending yang perlu verifikasi provider;
- alert critical yang butuh investigasi;
- failure cron berulang;
- audit finance sensitif.

### 6.9 Catatan Midtrans

Catatan Midtrans khusus untuk risiko rekonsiliasi pembayaran.

Prinsip utama:

- antrean Midtrans bukan bukti pembayaran sukses;
- status uang hanya boleh berubah setelah verifikasi Midtrans Status API;
- UI ini hanya menampilkan status, antrean, dan rekomendasi.

### 6.10 Guardrail

Guardrail adalah batasan yang wajib dipatuhi.

Contoh guardrail:

- jangan update saldo langsung;
- jangan ubah status transaksi dari UI;
- jangan resolve alert jika data belum normal;
- jangan percaya queue Midtrans sebagai hasil final;
- AI tidak boleh melakukan write otomatis.

### 6.11 Confidence

Confidence menunjukkan tingkat keyakinan AI.

Makna:

- `high`: data cukup jelas dan konsisten;
- `medium`: data cukup membantu tetapi masih perlu review;
- `low`: data terbatas atau belum cukup untuk kesimpulan kuat.

Confidence bukan jaminan kebenaran. Super admin tetap perlu memeriksa data sumber.

### 6.12 Next Refresh Minutes

AI memberi saran kapan sebaiknya data diperiksa lagi.

Contoh:

- `15 menit`: cocok untuk incident aktif;
- `60 menit`: cocok untuk pemantauan berkala;
- `120 menit`: cocok untuk kondisi relatif stabil.

---

## 7. Istilah Penting

### 7.1 Backend Operations

Bagian sistem yang menjalankan proses otomatis, monitoring, audit, queue, cron, notification, dan self-healing.

### 7.2 Self-Healing

Kemampuan backend untuk mendeteksi masalah dan menjalankan repair aman berdasarkan guardrail.

Self-healing bukan berarti backend bebas error. Artinya backend punya mekanisme deteksi, repair, monitoring, dan eskalasi.

### 7.3 Safe Repair

Repair yang dikategorikan aman dan tidak mengubah status uang tanpa verifikasi provider.

Contoh safe repair:

- retry notifikasi transient;
- refresh token health;
- enqueue rekonsiliasi;
- cleanup history;
- capture health snapshot.

### 7.4 Incident

Masalah operasional yang terdeteksi dan dilacak sebagai kejadian.

Incident punya status, severity, timeline, dan kemungkinan playbook.

### 7.5 Alert

Sinyal masalah dari backend.

Alert bisa menjadi incident jika memenuhi aturan tertentu.

### 7.6 Playbook

Aturan backend untuk menangani jenis incident tertentu.

Playbook menentukan:

- component;
- severity;
- dedupe key;
- apakah auto repair boleh;
- action repair;
- threshold eskalasi.

### 7.7 Dedupe Key

Kunci untuk mencegah alert duplikat berlebihan.

Jika masalah yang sama terjadi berkali-kali, backend bisa menggabungkannya sebagai satu alert/incident yang sama.

### 7.8 Cron

Job otomatis yang berjalan sesuai jadwal.

Contoh:

- setiap menit;
- setiap 15 menit;
- setiap jam;
- setiap hari;
- setiap minggu.

### 7.9 Notification Queue

Antrean notifikasi yang akan dikirim ke user.

Queue bukan bukti notifikasi sudah sampai. Queue hanya menunjukkan status proses pengiriman.

### 7.10 Token FCM

Token device untuk mengirim push notification.

Jika token hilang atau stale, notifikasi bisa gagal walaupun backend sudah membuat queue.

### 7.11 Midtrans Reconciliation Queue

Antrean transaksi Midtrans yang perlu diverifikasi ulang.

Queue ini tidak boleh dijadikan dasar langsung untuk mengubah status pembayaran.

### 7.12 Pg Net

Fitur database untuk melakukan request HTTP dari Postgres.

Failure pada `pg_net` perlu dicek karena bisa berdampak pada pemanggilan Edge Function atau integrasi backend.

### 7.13 Finance Audit Events

Catatan audit perubahan data finansial sensitif.

Audit ini dipakai untuk investigasi, pelacakan, dan akuntabilitas.

---

## 8. Workflow Harian Super Admin

Urutan kerja yang disarankan:

1. Buka **Self-Healing Center**.
2. Lihat **Health Score** dan **Status**.
3. Jika status `degraded` atau `critical`, cek **Breakdown**.
4. Buka **Open Incidents** dan lihat **Incident Timeline**.
5. Jalankan **AI Operations Analyst 24 jam**.
6. Jika AI menyebut Midtrans, buka **Backend Diagnostics** dan cek queue/status.
7. Jika ada alert operasional, buka **Private Audit Log**.
8. Gunakan Action Center:
   - `acknowledge` jika sedang ditangani;
   - `assign` jika perlu orang tertentu;
   - `snooze` jika menunggu waktu/kondisi;
   - `resolve` jika benar-benar sudah selesai.
9. Jalankan **Run Safe Repair** hanya jika sesuai kondisi.
10. Refresh dan pastikan data berubah sesuai ekspektasi.

---

## 9. Workflow Saat Ada Midtrans Pending

Jika AI atau diagnostics menunjukkan Midtrans pending/stale:

1. Jangan ubah status pembayaran dari UI ini.
2. Jangan anggap `queued` sebagai sukses.
3. Cek status antrean Midtrans.
4. Pastikan worker/backend flow memanggil Midtrans Status API.
5. Perubahan status uang hanya boleh terjadi lewat flow pembayaran backend yang valid.
6. Jika perlu, tandai alert sebagai `acknowledge` atau `assign`, bukan `resolve` sebelum bukti final tersedia.

---

## 10. Workflow Saat Banyak Notifikasi Gagal

Jika diagnostics menunjukkan banyak notification failed:

1. Cek **Notification Queue By Status**.
2. Cek **Token Health**.
3. Jika banyak `missing_token`, arahkan user untuk login ulang/register FCM.
4. Jika failure transient, pertimbangkan **Run Safe Repair**.
5. Jika gagal berulang, cek alert dan pg_net failures.

---

## 11. Workflow Saat Cron Gagal

Jika ada failed cron runs:

1. Cek **Failed Runs 24h**.
2. Cek **Latest Cron Runs** untuk pola terbaru.
3. Cek apakah failure hanya satu kali atau berulang.
4. Jika failure berulang dan critical, buka Private Audit Log.
5. Gunakan AI Operations Analyst untuk ringkasan prioritas.
6. Assign alert ke penanggung jawab teknis jika perlu.

---

## 12. Batasan Fitur

Fitur ini tidak menggantikan investigasi teknis penuh.

Batasan:

- AI membaca konteks ringkas, bukan seluruh tabel mentah;
- AI bisa salah jika data sumber tidak lengkap;
- UI tidak menjalankan worker rekonsiliasi pembayaran;
- UI tidak mengubah status uang;
- UI tidak menyelesaikan akar masalah eksternal seperti provider down;
- resolve alert tetap keputusan manusia.

---

## 13. Checklist Sebelum Resolve Alert

Sebelum klik `Resolve`, pastikan:

- data terbaru sudah direfresh;
- incident timeline tidak menunjukkan failure aktif;
- health/breakdown sudah membaik;
- tidak ada Midtrans pending yang belum diverifikasi;
- tidak ada finance audit event mencurigakan;
- jika AI confidence rendah, lakukan review manual;
- jika masalah terkait uang, pastikan flow backend/provider sudah valid.

---

## 14. Ringkasan Keamanan

Backend Command Center dirancang dengan prinsip:

- hanya `super_admin`;
- tidak expose schema `ops` ke browser;
- tidak memakai service role di frontend;
- AI read-only;
- action write terbatas ke alert action center;
- semua RPC tetap divalidasi backend;
- Midtrans dan uang wajib lewat flow backend yang memverifikasi provider.

Dokumen ini harus dibaca bersama handoff backend:

- `catatan/BACKEND_ENTERPRISE_OPERATIONS_HANDOFF.md`

