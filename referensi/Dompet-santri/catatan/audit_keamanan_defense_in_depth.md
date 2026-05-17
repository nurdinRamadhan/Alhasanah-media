# Audit Keamanan Dompet Santri dan Defense in Depth

Dokumen ini menjadi catatan implementasi keamanan tambahan untuk Dompet Santri sebelum masuk tahap Kotlin/Android.

## Prinsip Utama

Sistem dompet memakai doktrin Defense in Depth. Satu lapisan keamanan tidak boleh dianggap cukup. Jika satu lapisan gagal, lapisan berikutnya tetap harus menahan dampak.

Lapisan yang diaudit:

- Network: Cloud Armor, proteksi DDoS, WAF, dan TLS. Lapisan ini tetap perlu review manual di provider hosting karena berada di luar database.
- App: rate limiting, idempotency, certificate pinning Android, anti-debug, anti-tamper, dan notifikasi kritis.
- API: autentikasi, role ketat, device kantin terdaftar, request signature, dan Edge Function server-side.
- Database: RLS, grant minimal, pessimistic locking, rekonsiliasi, freeze switch, dan audit log.
- Data: AES-256/pgcrypto, hash-chain ledger, QR opaque, Argon2id untuk verifier PIN, nonce, dan Ed25519 signature.

## Audit Keamanan Satu Klik

Admin panel memiliki halaman:

```text
Dompet Santri -> Audit Keamanan
Route: /dompet-security-audit
```

Tombol `Jalankan Audit Keamanan` memanggil Edge Function `wallet-admin` dengan action:

```json
{ "action": "run_security_audit" }
```

Edge Function menjalankan RPC:

```sql
public.wallet_run_security_audit(p_triggered_by uuid, p_triggered_by_role text)
```

Hasil audit disimpan di:

```sql
public.wallet_security_audit_runs
```

Data yang disimpan:

- skor keamanan 0-100;
- status: `success`, `warning`, `critical`, atau `failed`;
- severity: `aman`, `perlu_perhatian`, `berisiko`, atau `kritis`;
- ringkasan per lapisan;
- daftar pemeriksaan;
- temuan;
- rekomendasi;
- ringkasan siap-AI.

Audit ini deterministic dan AI-ready. Audit manual tetap menjadi sumber kebenaran karena hasilnya berasal dari database dan rule pemeriksaan yang eksplisit.

## Analisis AI Auditor

Halaman audit juga memiliki tombol `Analisis AI`. Fitur ini tidak mengganti audit manual. AI hanya membaca hasil audit manual yang sudah disanitasi, lalu membuat penjelasan risiko dan urutan tindakan.

Alur:

```text
Jalankan Audit Keamanan
  -> hasil tersimpan di wallet_security_audit_runs
  -> klik Analisis AI
  -> Edge Function wallet-security-ai-auditor mengambil audit run tersebut
  -> payload disanitasi
  -> Gemini menganalisis dengan master prompt security auditor
  -> hasil tersimpan di wallet_security_ai_analyses
```

AI tidak menerima PIN, password, private key, token, ciphertext mentah, FCM token, NIS/NIK, nomor HP, alamat, atau data identitas lengkap.

Master prompt operasional disimpan di:

```text
referensi/Dompet-santri/catatan/master_prompt_ai_security_auditor.md
```

Konsistensi wajib:

- audit manual adalah sumber kebenaran;
- AI tidak boleh mengubah skor manual;
- AI tidak boleh menyatakan temuan yang bertentangan dengan audit manual;
- AI boleh memberi prioritas, gejala awal, risiko Android, risiko database, blocker produksi, dan rekomendasi tindak lanjut.

## Pemeriksaan Yang Dilakukan

Audit satu klik memeriksa:

- freeze switch global dompet;
- rekonsiliasi saldo vs ledger;
- hash-chain ledger;
- risk event tinggi/kritis yang belum selesai;
- dispute yang melewati SLA;
- notifikasi kritis yang gagal/tertahan;
- status device kantin;
- percobaan PIN gagal;
- RLS dan grant publik pada tabel wallet;
- kebijakan QR opaque;
- kewajiban Argon2id untuk verifier PIN;
- cron utama dompet.

## Batas Persetujuan Wali

Kebijakan yang dikunci:

```text
parent_approval_required_above = 75000
```

Artinya:

- transaksi kantin sampai Rp75.000 tidak boleh memaksa verifikasi wali setiap kali;
- transaksi di atas Rp75.000 wajib meminta persetujuan wali;
- transaksi kecil tetap harus memakai PIN/signature santri, device kantin aktif, idempotency key, nonce, dan validasi saldo server-side.
- akumulasi belanja harian yang melebihi Rp75.000 tidak mengubah transaksi kecil berikutnya menjadi approval wali; akumulasi ditangani oleh limit harian/bulanan wali.
- jika limit harian/bulanan tercapai, wali mendapat notifikasi; jika limit terlampaui, transaksi ditolak oleh database.

## FCM Single-Owner

Masalah yang pernah ditemukan: satu FCM token Android aktif di beberapa akun karena perangkat yang sama pernah login ke wali, alumni, dan akun lain. Dampaknya, push bisa muncul di device fisik walaupun halaman notifikasi akun yang sedang login tidak menampilkan event tersebut, karena `notification_queue.user_id` sebenarnya milik akun lama.

Kebijakan baru:

- kolom `user_devices.is_active` menentukan token yang boleh dikirim push;
- satu `fcm_token` hanya boleh punya satu pemilik aktif;
- RPC `register_my_fcm_device` harus dipanggil setelah login dan saat token berubah;
- trigger database menonaktifkan pemilik lama ketika token yang sama didaftarkan oleh user baru;
- Edge Function `push-notifications` hanya membaca device aktif.

## QR Code Kartu Santri

QR tidak boleh berisi:

- NIS mentah;
- nama santri;
- saldo;
- PIN/password;
- private key;
- token login;
- data yang mudah ditebak.

QR hanya boleh berisi opaque public id atau payload versi yang isinya tetap menunjuk ke public id acak. QR adalah identifier, bukan bukti otorisasi. Otorisasi tetap berasal dari device kantin terdaftar, challenge, nonce, PIN/signature, dan server-side validation.

## Argon2id

Argon2id dipakai untuk verifier PIN/password lokal atau recovery secret, bukan untuk mengganti Ed25519.

Rekomendasi Android:

- target waktu hash: sekitar 200-350 ms pada device normal;
- mode low-end: sekitar 19 MB memory;
- mode normal: sekitar 64 MB memory;
- iterations disesuaikan hasil benchmark device;
- jalankan di background dispatcher, bukan main thread;
- jangan menyimpan PIN plaintext di memori lebih lama dari kebutuhan validasi;
- gunakan Android Keystore/StrongBox untuk key privat.

Argon2id dapat memperberat aplikasi jika parameter memory/time terlalu tinggi. Itu memang tujuan desainnya: memperlambat brute-force. Agar UX tetap baik, lakukan kalibrasi saat onboarding atau saat device pertama didaftarkan, lalu simpan parameter yang aman untuk kelas device tersebut.

## Mitigasi Memory Scraping Android

Tidak ada aplikasi client yang bisa menjamin rahasia mustahil terlihat di memori. Target yang realistis adalah membuat rahasia:

- sangat singkat berada di memori;
- tidak pernah dilog;
- tidak pernah dikirim sebagai plaintext;
- tidak reusable;
- tidak cukup untuk transaksi tanpa nonce, signature, device aktif, dan validasi server.

Langkah Android:

- gunakan `BiometricPrompt` untuk membuka key;
- simpan private key di Android Keystore/StrongBox;
- aktifkan `FLAG_SECURE` di layar sensitif;
- tolak overlay/tapjacking di input PIN;
- jangan simpan PIN di SharedPreferences, Room, logcat, crash report, clipboard, atau intent extra;
- bersihkan buffer setelah dipakai sejauh yang bisa dilakukan di Kotlin/JVM;
- gunakan Play Integrity API, root/debug/emulator detection, dan certificate pinning.

## Catatan Produksi

Audit satu klik bukan pengganti monitoring otomatis. Audit ini alat admin untuk mengetahui gejala awal. Cron rekonsiliasi, hash-chain check, notifikasi kritis, dan risk event tetap wajib aktif.

SMS/email fallback belum diaktifkan karena membutuhkan pihak ketiga berbayar/eksternal. Untuk saat ini, masalah kritis ditampilkan jelas di admin panel lewat halaman operasional dan audit keamanan.
