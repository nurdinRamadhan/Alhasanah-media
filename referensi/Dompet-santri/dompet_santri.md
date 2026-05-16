# Dompet Santri - Spesifikasi Closed-Loop Fintech dan Zero Trust

Dokumen ini adalah panduan desain dan implementasi fitur Dompet Santri untuk Admin Panel Alhasanah, aplikasi Android/Kotlin wali santri, dan aplikasi/halaman Kantin. Fitur ini menyimpan dan memproses uang jajan santri dalam lingkungan pesantren yang bersifat closed-loop: saldo hanya dapat digunakan untuk kebutuhan internal pesantren, terutama transaksi kantin dan fitur terkait yang disetujui.

Status dokumen: rancangan teknis sebelum implementasi schema final.

## 1. Prinsip Utama

Dompet Santri harus diperlakukan sebagai sistem finansial internal, bukan sekadar tabel saldo. Semua perubahan saldo wajib tercatat, dapat diaudit, dan tidak bisa diedit langsung oleh admin, kantin, wali, atau client Android.

Prinsip wajib:

- Closed-loop: saldo hanya berlaku di ekosistem pesantren, tidak ada transfer bebas, tidak ada cash-out publik, dan tidak menjadi e-wallet umum.
- Zero trust: tidak ada client, admin panel, kantin, edge function, atau role yang dipercaya mutlak tanpa validasi ulang.
- Ledger-first: sumber kebenaran adalah ledger transaksi append-only, bukan kolom saldo.
- Server-authorized: mutasi saldo hanya boleh melalui RPC/Edge Function resmi yang memvalidasi role, nonce, signature, idempotency, limit, dan status akun.
- Least privilege: setiap role hanya mendapat akses minimum.
- No direct balance update: tidak boleh ada update langsung ke `dompet_santri.saldo` dari frontend, AI agent, SQL manual, atau fungsi umum.
- Auditable: semua akses penting, bukan hanya transaksi sukses, harus masuk audit log.
- Fail closed: jika validasi tidak lengkap, sistem menolak transaksi.

## 2. Role Resmi

Gunakan role yang sudah dipakai di `src/accessControlProvider.ts` sebagai sumber kebenaran:

- `super_admin`: pengelolaan sistem, audit penuh, konfigurasi, dan tindakan darurat. Tidak boleh mengubah saldo langsung.
- `rois`: pemantauan dan otorisasi tingkat tinggi sesuai kebutuhan pesantren. Tidak boleh mengubah saldo langsung.
- `dewan`: read-only untuk pemantauan dan audit ringkas. Tidak boleh membuat transaksi.
- `bendahara`: operasional finansial seperti review top-up, laporan, koreksi terkontrol, dan audit keuangan dompet.
- `kesantrian`: tidak memiliki akses operasional dompet kecuali ringkasan sangat terbatas jika nanti dibutuhkan.
- `wali`: pemilik akses ke dompet anaknya melalui aplikasi Android.
- `kantin`: role baru untuk aplikasi/halaman kantin. Hanya boleh membuat permintaan pembayaran dan melihat hasil otorisasi transaksi miliknya sendiri.

Role lama yang ditemukan di database seperti `admin_bendahara` dan `pengelola_kantin` harus dimigrasikan atau diganti menjadi `bendahara` dan `kantin`.

## 3. Kondisi Database Saat Ini

Hasil audit MCP Supabase menunjukkan tabel awal sudah ada:

- `dompet_santri`
- `transaksi_dompet`
- `crypto_keystores`
- `wallet_nonces`
- `midtrans_webhook_logs`
- `transaksi_keuangan`
- `vault.secrets`

Extension penting sudah aktif:

- `pgcrypto`
- `supabase_vault`

Masalah yang harus diperbaiki sebelum produksi:

- `dompet_santri.saldo` masih nullable dan belum punya `CHECK (saldo >= 0)`.
- `dompet_santri` tidak memiliki `updated_at`, sementara trigger `update_santri_balance()` mencoba mengupdate kolom itu.
- `update_santri_balance()` belum aman dari race condition.
- `transaksi_dompet` belum memiliki idempotency key, hash chain, signature, status, `balance_before`, dan `balance_after`.
- `anon` masih memiliki table privileges luas pada tabel wallet.
- Policy database masih memakai role lama `admin_bendahara` dan `pengelola_kantin`.
- Policy `Kantin view all balances` terlalu luas dan harus dihapus.
- `view_admin_wallet_status` terdeteksi sebagai security definer view dan harus diubah menjadi `security_invoker` atau dipindah ke schema private.
- Webhook Midtrans wajib memvalidasi `signature_key` sebelum memproses top-up.

## 4. Arsitektur Target

### 4.1 Tabel Akun

Gunakan `dompet_santri` sebagai tabel akun atau migrasikan ke nama lebih eksplisit seperti `wallet_accounts`.

Kolom minimum:

```sql
santri_nis text primary key references public.santri(nis)
saldo bigint not null default 0 check (saldo >= 0)
status text not null default 'active'
low_balance_threshold bigint not null default 10000
daily_spend_limit bigint null
single_transaction_limit bigint null
locked_reason text null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Catatan:

- `saldo` adalah cached balance untuk query cepat.
- Kebenaran saldo tetap dihitung dari ledger.
- Update saldo hanya boleh terjadi di RPC transaksi atomik.

### 4.2 Ledger Dompet

`transaksi_dompet` harus diperkuat menjadi ledger append-only. Kolom minimum:

```sql
id uuid primary key default gen_random_uuid()
santri_nis text not null references public.santri(nis)
direction text not null check (direction in ('credit', 'debit'))
category text not null
amount bigint not null check (amount > 0)
balance_before bigint not null check (balance_before >= 0)
balance_after bigint not null check (balance_after >= 0)
status text not null default 'posted'
actor_id uuid null references public.profiles(id)
actor_role text not null
counterparty_id uuid null
counterparty_role text null
payment_intent_id uuid null
idempotency_key text not null unique
nonce text null
signature text null
signature_public_key text null
prev_hash text null
entry_hash text not null unique
keterangan text null
created_at timestamptz not null default now()
posted_at timestamptz not null default now()
```

Aturan:

- Ledger tidak boleh di-update atau di-delete.
- Koreksi saldo harus dibuat sebagai transaksi baru `correction`, bukan mengubah baris lama.
- `entry_hash` dihitung dari data transaksi utama ditambah `prev_hash`.
- `idempotency_key` wajib untuk semua top-up, pembayaran kantin, koreksi, dan refund.

### 4.3 Payment Intent

Buat `wallet_payment_intents` untuk semua transaksi yang belum final.

Jenis intent:

- `midtrans_topup`
- `kantin_payment`
- `admin_correction`
- `refund`

Kolom minimum:

```sql
id uuid primary key default gen_random_uuid()
santri_nis text not null references public.santri(nis)
type text not null
status text not null default 'pending'
amount bigint not null check (amount > 0)
created_by uuid null references public.profiles(id)
created_by_role text not null
expires_at timestamptz not null
approved_at timestamptz null
posted_ledger_id uuid null
midtrans_order_id text null unique
midtrans_snap_token text null
provider_payload jsonb null
idempotency_key text not null unique
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### 4.4 QR dan Authorization Session

Jangan simpan credential rahasia di QR code. QR kartu santri hanya boleh berisi public identifier, misalnya:

```text
wallet_public_id
```

atau payload versi:

```json
{
  "v": 1,
  "type": "wallet_public_id",
  "id": "public-id-non-secret"
}
```

Buat `wallet_authorization_sessions`:

```sql
id uuid primary key default gen_random_uuid()
wallet_public_id text not null
santri_nis text not null references public.santri(nis)
kantin_user_id uuid null references public.profiles(id)
amount bigint not null check (amount > 0)
status text not null default 'pending'
challenge text not null unique
expires_at timestamptz not null
approved_by uuid null references public.profiles(id)
approved_device_id text null
approved_at timestamptz null
failed_attempts integer not null default 0
created_at timestamptz not null default now()
```

Aturan:

- Session QR maksimal 60-120 detik.
- Kantin tidak boleh melihat semua saldo setelah scan.
- Lebih aman tampilkan `cukup` atau `tidak_cukup`; jika saldo harus tampil, tampilkan hanya dalam session valid dan log aksesnya.
- PIN/password santri tidak boleh dikirim atau disimpan plaintext.

### 4.5 Device dan Keystore

Gunakan `crypto_keystores` hanya untuk public key dan encrypted backup, bukan private key utama. Private key utama harus dibuat dan disimpan di Android Keystore hardware-backed.

Tabel tambahan disarankan:

```sql
wallet_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  device_id text not null,
  device_name text null,
  public_key text not null,
  key_algorithm text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz null,
  revoked_at timestamptz null,
  unique(profile_id, device_id)
)
```

## 5. Kriptografi

Pahami pemisahan fungsi algoritma:

- Ed25519: tanda tangan digital. Dipakai untuk membuktikan instruksi transaksi berasal dari device/wali/santri yang sah.
- SHA-256: hash/digest. Dipakai untuk idempotency, hash chain, audit digest, dan payload fingerprint.
- AES-GCM atau XChaCha20-Poly1305: enkripsi data rahasia.
- PBKDF2/Argon2id: derivasi key dari PIN/password jika diperlukan.
- Android Keystore: penyimpanan private key utama di perangkat.

Jangan menyebut Ed25519 sebagai enkripsi. Ed25519 tidak mengenkripsi data.

Payload yang ditandatangani minimal:

```json
{
  "wallet_id": "...",
  "intent_id": "...",
  "amount": 15000,
  "currency": "IDR",
  "category": "pembayaran_kantin",
  "nonce": "...",
  "challenge": "...",
  "expires_at": "...",
  "device_id": "..."
}
```

Backend wajib memvalidasi:

- public key aktif dan belum revoked
- signature valid
- nonce belum pernah dipakai
- challenge cocok
- session belum expired
- amount sama dengan payment intent
- actor punya hak terhadap santri/dompet

## 6. Flow Utama

### 6.1 Registrasi Dompet oleh Wali Android

1. Wali login di aplikasi Android.
2. App mengambil daftar santri milik wali.
3. App membuat keypair di Android Keystore.
4. App mengirim public key dan metadata device.
5. Backend membuat wallet account jika belum ada.
6. Backend membuat `crypto_keystores` atau `wallet_devices`.
7. Backend menolak duplikasi device aktif yang mencurigakan.
8. Audit log dibuat.

Admin tidak boleh membuat private key dan tidak boleh melihat encrypted private key kecuali memang itu encrypted backup milik wali yang tidak bisa didekripsi admin.

Keputusan produk: pembuatan akun dompet santri hanya boleh dilakukan dari aplikasi Android/Kotlin wali santri. Admin panel tidak boleh menyediakan tombol atau API untuk membuat dompet santri karena membuka risiko pembuatan akun tanpa persetujuan wali. Admin panel hanya berfungsi untuk pemantauan, audit, lock/unlock darurat, cetak ulang QR, laporan, dan koreksi ledger yang terdokumentasi.

Flow provisioning Android yang wajib:

1. Wali login dan session divalidasi Supabase Auth.
2. App menampilkan santri yang benar-benar terhubung ke `wali_id = auth.uid()`.
3. Wali memilih santri dan menyetujui syarat penggunaan closed-loop wallet.
4. App membuat keypair Ed25519 di Android Keystore.
5. Private key tidak pernah keluar dari perangkat.
6. App mengirim public key, device id, device name, dan attestation metadata jika tersedia.
7. Backend `wallet-register` atau nama function sejenis memvalidasi wali, santri, status santri, idempotency, dan device.
8. Backend membuat `dompet_santri`, `wallet_devices`, `crypto_keystores` jika diperlukan, `wallet_card_qr_versions`, dan audit log.
9. Backend mengembalikan `wallet_public_id`, status akun, dan konfigurasi limit awal.
10. App menyimpan konfigurasi non-rahasia dan menampilkan bahwa dompet sudah aktif.

RPC `wallet_create_account` tetap boleh ada di database, tetapi hanya boleh dipanggil oleh Edge Function server-side khusus provisioning Android. Jangan expose RPC ini langsung ke admin panel, browser, atau client publik.

### 6.2 Top-Up Midtrans/QRIS

1. Wali memilih nominal top-up.
2. Backend membuat `wallet_payment_intents` status `pending`.
3. Backend membuat transaksi Midtrans Snap.
4. Midtrans mengirim webhook.
5. Webhook memvalidasi `signature_key`.
6. Webhook memverifikasi `order_id`, `gross_amount`, status, dan idempotency.
7. Backend mem-posting ledger credit melalui RPC atomik.
8. Saldo cached bertambah.
9. Notifikasi dikirim ke wali.

Validasi signature Midtrans:

```text
SHA512(order_id + status_code + gross_amount + ServerKey)
```

Nilai hasil hash harus sama dengan `signature_key` dari Midtrans.

### 6.3 Pembayaran Kantin dengan QR Kartu Santri

1. Petugas kantin login dengan role `kantin`.
2. Kantin scan QR kartu santri menggunakan aplikasi Android/Kotlin kantin.
3. App kantin membuat payment intent berisi nominal.
4. Backend membuat authorization session dan challenge.
5. Santri memasukkan PIN di perangkat kantin atau wali mengotorisasi dari Android.
6. PIN tidak dikirim plaintext; app menandatangani challenge atau mengirim proof sesuai desain auth.
7. Backend memvalidasi session, nonce, signature, limit, dan saldo.
8. RPC atomik membuat ledger debit.
9. Saldo cached berkurang.
10. Kantin hanya melihat status sukses/gagal dan struk transaksi miliknya.
11. Wali mendapat notifikasi.

Catatan penting: jika santri memasukkan PIN di HP/admin kantin, risiko shoulder surfing dan device compromise tinggi. Pilihan lebih aman adalah PIN pad transient dengan rate limit, masking, session pendek, dan audit gagal PIN. Untuk transaksi besar, wajib approval wali.

Keputusan implementasi: transaksi dompet santri hanya boleh berjalan di aplikasi Android/Kotlin. Admin panel tidak boleh memiliki halaman transaksi kantin, tombol debit, input PIN, atau endpoint browser untuk memproses pembayaran santri. Admin panel tetap terbatas untuk monitoring, audit, laporan, lock/unlock, reissue QR, dan koreksi ledger resmi.

Jika pesantren tetap memakai pola santri memasukkan PIN pada perangkat kantin Android, maka PIN tersebut tidak boleh menjadi data yang dipercaya langsung oleh backend dan tidak boleh dikirim plaintext. Perangkat kantin harus memperlakukan PIN sebagai input sementara untuk membuat bukti otorisasi yang aman. Syarat minimum:

- input PIN masked dan tidak tersimpan di log, memory jangka panjang, database, analytics, atau crash report
- session pembayaran sangat pendek, idealnya 1-5 menit
- rate limit lokal dan server-side untuk gagal PIN
- lock sementara setelah gagal berulang
- audit `failed_attempts` tanpa menyimpan PIN
- challenge dan nonce wajib unik per transaksi
- proof harus terikat ke `authorization_session_id`, `payment_intent_id`, `amount`, `santri_nis`, `challenge`, dan `nonce`
- transaksi nominal besar tetap memerlukan approval wali dari device wali
- perangkat kantin yang sudah di-root, emulator tidak sah, atau integrity check gagal harus ditolak pada mode produksi

Untuk standar zero trust yang lebih kuat, gunakan salah satu desain berikut sebelum PIN kantin dijadikan jalur final:

1. PIN hanya membuka private key/credential lokal milik santri pada perangkat/kartu yang sah, lalu app membuat signature Ed25519.
2. PIN diproses dengan protokol PAKE/OPAQUE atau proof setara sehingga backend tidak menerima PIN dan perangkat kantin tidak bisa memakai ulang rahasia.
3. PIN kantin hanya membuat `requires_parent_approval`, lalu wali menyetujui dari aplikasi Android wali.

Implementasi scan QR Android:

- Gunakan CameraX sebagai camera pipeline utama.
- Gunakan ML Kit Barcode Scanning atau ZXing untuk decoding QR.
- Scanner hanya menerima payload `type = santri_wallet_card` dan versi yang didukung.
- Scanner harus menolak QR yang tidak punya `wallet_public_id` valid.
- App kantin tidak boleh mempercayai data dari QR selain sebagai identifier publik.
- Setelah scan, app wajib memanggil backend untuk lookup akun aktif dan authorization session.
- QR scan harus punya debounce agar satu scan tidak membuat banyak intent.
- Setiap scan dan gagal scan yang mencapai backend dicatat di `wallet_audit_logs`.

Format payload QR fase awal:

```json
{
  "v": 1,
  "type": "santri_wallet_card",
  "wallet_public_id": "0f8c1c4f-7a02-4a0e-9a9e-0e0d5e6f9d11"
}
```

Fallback kompatibilitas: jika aplikasi menemukan QR lama yang hanya berisi UUID mentah, backend boleh menerima sementara sebagai `wallet_public_id`, tetapi kartu baru harus selalu memakai payload JSON versioned.

### 6.3.1 QR Code Cetak di Kartu Santri

QR code akan dicetak dan ditempel/terintegrasi pada kartu santri. Karena QR cetak bersifat permanen dan mudah difoto, QR tidak boleh dianggap rahasia.

Isi QR yang diperbolehkan:

- `wallet_public_id` acak/non-berurutan.
- versi payload QR.
- checksum publik opsional.

Isi QR yang dilarang:

- NIS mentah jika bisa dihindari.
- saldo.
- access token.
- refresh token.
- PIN/password.
- private key.
- encrypted private key.
- nonce aktif.
- payment session aktif.

Contoh payload QR cetak:

```json
{
  "v": 1,
  "type": "santri_wallet_card",
  "wallet_public_id": "0f8c1c4f-7a02-4a0e-9a9e-0e0d5e6f9d11"
}
```

Flow aman QR cetak:

1. Kantin scan QR dan hanya mendapat `wallet_public_id`.
2. Backend mencari akun aktif dari `wallet_public_id`.
3. Backend membuat authorization session baru yang singkat.
4. Kantin memasukkan nominal.
5. Santri/wali menyetujui dengan PIN/signature/session proof.
6. Backend memvalidasi semuanya sebelum debit.

Jika kartu hilang:

- dompet tidak otomatis harus dihapus.
- `wallet_public_id` lama ditandai revoked.
- generate `wallet_public_id` baru.
- cetak kartu/QR baru.
- semua scan QR lama ditolak.
- audit log mencatat pergantian kartu.

### 6.3.2 NFC/Tap-to-Pay Readiness

QR code adalah fase awal dan fallback wajib karena murah, mudah dicetak, dan kompatibel dengan hampir semua perangkat. Namun pondasi harus siap untuk NFC/tap-to-pay.

Prinsip NFC:

- NFC tidak mengganti authorization; NFC hanya mengganti media identifikasi dari QR ke tap.
- Payload NFC tetap memakai identifier publik seperti `wallet_public_id` atau token publik berumur panjang yang bisa di-revoke.
- Debit tetap memerlukan authorization session, nonce, signature/PIN proof, limit check, dan ledger RPC.
- Jika perangkat kantin atau wali tidak mendukung NFC, flow QR tetap berjalan penuh.
- Jika kartu NFC hilang, token NFC harus bisa di-revoke seperti QR.

Kolom/tabel yang disiapkan nanti:

- `wallet_card_tokens`: token QR/NFC per kartu, status `active/revoked/expired`, media `qr/nfc/both`.
- `wallet_card_qr_versions`: tetap dipakai untuk QR print.
- `wallet_audit_logs`: mencatat media scan `qr` atau `nfc`.

### 6.3.3 Model Pengelola Kantin dan Settlement

Kantin pesantren dapat punya beberapa model operasional. Pondasi database harus siap untuk semua model berikut tanpa mengubah ledger utama dompet.

Model A: kantin dikelola pesantren

- Semua pembayaran kantin dianggap pendapatan internal pesantren.
- Settlement masuk ke rekening utama pesantren.
- Midtrans dan QRIS memakai merchant/rekening pesantren.
- `counterparty_role = kantin`, `counterparty_id = akun kantin`, metadata menyimpan outlet.

Model B: kantin dikelola pengurus/dewan/orang lain

- Kantin tetap closed-loop di sisi santri, tetapi settlement internal perlu sub-ledger kantin.
- Buat entitas `wallet_merchants` atau `kantin_merchants`.
- Setiap merchant punya owner profile, rekening settlement, status KYC internal, dan aturan fee.
- Debit santri masuk ke ledger dompet sebagai `pembayaran_kantin`, lalu dicatat ke sub-ledger merchant untuk kewajiban bayar ke pengelola kantin.
- Rekening pengelola tidak menerima langsung dari dompet santri; pencairan dilakukan lewat proses settlement bendahara agar audit tetap rapi.

Model C: beberapa outlet kantin

- Satu role `kantin` bisa punya beberapa outlet.
- Tambahkan `merchant_id`/`outlet_id` pada `wallet_payment_intents`, `wallet_authorization_sessions`, dan `transaksi_dompet.metadata`.
- Role kantin hanya melihat transaksi outlet yang ditugaskan.

Rekomendasi fase awal: gunakan model A dahulu, yaitu kantin dikelola pesantren dan settlement ke rekening pesantren/Midtrans pesantren. Namun schema dan metadata transaksi harus tetap menyimpan `counterparty_id`, `counterparty_role`, dan `merchant_id` opsional supaya ekspansi ke model B/C tidak perlu migrasi besar.

### 6.3.5 Manajemen Akun Kantin

Akun kantin boleh dibuat dari admin panel oleh `super_admin`, `rois`, atau `bendahara`, tetapi akun saja tidak cukup untuk memproses transaksi.

Flow aman akun kantin:

1. Admin membuat akun role `kantin` dari admin panel.
2. Petugas kantin login ke aplikasi Android kantin.
3. Aplikasi Android membuat keypair Ed25519 khusus device kantin.
4. Public key, device id, dan fingerprint dikirim untuk registrasi device.
5. Admin melakukan review dan approve device kantin.
6. Setelah device status `active`, aplikasi kantin boleh membuat authorization session.
7. Setiap request transaksi wajib ditandatangani device kantin.
8. Jika akun kantin dinonaktifkan, semua device kantin direvoke dan assignment merchant dicabut.
9. Admin panel menolak login/session akun dengan `profiles.is_active = false`.

Prinsip penting:

- Jangan menghapus ledger ketika akun kantin dinonaktifkan.
- Tombol "hapus akun kantin" di admin panel harus berarti nonaktif/revoke, bukan menghapus histori.
- Delete permanen auth user hanya boleh untuk akun salah buat dan belum pernah transaksi.
- Akun kantin yang pernah memproses transaksi harus dipertahankan sebagai subject audit.
- Re-aktivasi akun tidak otomatis mengaktifkan device lama yang sudah direvoke.

Data manajemen kantin:

- `profiles` dengan `role = kantin`: identitas dan status akun.
- `kantin_devices`: device Android kantin yang diizinkan sebagai terminal transaksi.
- `wallet_merchants`: entitas kantin/merchant.
- `wallet_merchant_outlets`: outlet jika kantin punya banyak lokasi.
- `wallet_merchant_users`: assignment user kantin ke merchant/outlet.
- `view_kantin_transaction_history`: riwayat transaksi kantin berbasis ledger.

Riwayat transaksi kantin:

- Sumber utama tetap `transaksi_dompet`.
- View `view_kantin_transaction_history` dibuat untuk kebutuhan admin panel dan aplikasi Android kantin.
- View ini memakai `security_invoker`, sehingga RLS `transaksi_dompet` tetap berlaku.
- Role `kantin` hanya melihat transaksi miliknya sendiri.
- Auditor wallet seperti `super_admin`, `bendahara`, `rois`, dan `dewan` bisa melihat semua transaksi untuk audit.
- Aplikasi Android kantin dapat memakai view ini untuk halaman riwayat transaksi/struk.

### 6.3.4 Limit dan Kontrol Wali

Wali harus bisa mengatur batas penggunaan dompet anaknya dari aplikasi Android. Admin panel hanya boleh melihat ringkasan limit untuk audit, bukan mengubah limit atas nama wali kecuali prosedur recovery resmi.

Limit minimum yang diperlukan:

- `low_balance_threshold`: ambang notifikasi saldo rendah.
- `single_transaction_limit`: maksimal satu transaksi.
- `daily_spend_limit`: maksimal belanja harian.
- `monthly_spend_limit`: opsional untuk fase berikutnya.
- `large_transaction_threshold`: nominal yang membutuhkan approval tambahan wali.
- `allowed_merchant_categories`: opsional, misalnya kantin saja.
- `spending_schedule`: opsional, misalnya hanya jam istirahat.

Flow perubahan limit:

1. Wali login Android.
2. App menampilkan limit aktif.
3. Wali mengubah limit.
4. App menandatangani request perubahan limit dengan key aktif.
5. Backend memvalidasi wali, signature, nonce, dan batas minimum/maksimum sistem.
6. Backend menyimpan konfigurasi dan audit log.
7. Perubahan limit dipakai pada transaksi berikutnya.

Backend wajib menolak limit yang tidak masuk akal, misalnya limit per transaksi lebih besar dari batas sistem pesantren, atau daily limit lebih kecil dari minimum operasional jika pesantren menetapkan minimum.

### 6.4 Koreksi Bendahara

Koreksi hanya untuk role `bendahara` dan `super_admin`.

Aturan:

- Koreksi tidak boleh mengubah baris ledger lama.
- Koreksi membuat ledger baru kategori `correction`.
- Wajib alasan tertulis.
- Wajib masuk audit log.
- Untuk nominal besar, gunakan approval dua pihak: `bendahara` + `super_admin` atau `rois`.

### 6.5 Laporan Wali

Wali dapat melihat:

- saldo anaknya
- riwayat transaksi anaknya
- notifikasi saldo rendah
- notifikasi transaksi besar
- bukti top-up dan transaksi kantin

Wali tidak boleh melihat data santri lain atau data operasional kantin.

## 7. RPC Wajib

Semua mutasi saldo wajib lewat function private atau RPC ketat. Contoh nama:

- `wallet_create_account`
- `wallet_create_midtrans_topup_intent`
- `wallet_confirm_midtrans_topup`
- `wallet_create_kantin_payment_intent`
- `wallet_authorize_payment`
- `wallet_post_transaction`
- `wallet_reverse_transaction`
- `wallet_lock_account`
- `wallet_get_balance_summary`
- `wallet_rotate_device_key`
- `wallet_recover_access`
- `wallet_reissue_card_qr`

`wallet_post_transaction` harus:

- berjalan dalam transaksi database
- lock row akun dengan `FOR UPDATE`
- validasi status akun
- validasi idempotency key
- validasi amount > 0
- untuk debit, update hanya jika saldo cukup
- hitung `balance_before` dan `balance_after`
- tulis ledger
- update cached balance
- tulis audit log
- return hasil minimal

Pola debit aman:

```sql
update public.dompet_santri
set saldo = saldo - p_amount,
    updated_at = now()
where santri_nis = p_santri_nis
  and saldo >= p_amount
returning saldo;
```

Jika tidak ada row yang return, transaksi harus gagal.

## 7.1 Lupa Sandi, Rotate Key, dan Recovery Wali

Skenario lupa sandi/PIN wali atau pergantian perangkat harus dirancang tanpa membuka celah admin mengambil alih dompet.

Prinsip:

- Admin tidak boleh mengetahui PIN/password wali.
- Admin tidak boleh mendekripsi private key wali.
- Recovery tidak boleh mengubah ledger lama.
- Saldo tetap berada di ledger dan akun dompet, bukan di private key.
- Jika key hilang, akses diganti dengan key baru setelah verifikasi identitas.

Opsi recovery yang disarankan:

1. Rotate device key.
   - Wali melakukan verifikasi identitas ulang.
   - Device/key lama direvoke.
   - Device baru mendaftarkan public key baru.
   - Ledger dan saldo tetap di akun dompet yang sama.
   - Ini opsi utama untuk lupa sandi/perangkat hilang.

2. Lock sementara.
   - `bendahara` atau `super_admin` mengunci akun dompet.
   - Semua debit ditolak.
   - Top-up bisa ditahan atau tetap diterima sesuai kebijakan.
   - Digunakan saat kartu/HP hilang atau ada transaksi mencurigakan.

3. Reissue QR kartu.
   - Hanya mengganti `wallet_public_id`.
   - Saldo dan ledger tidak berubah.
   - QR lama masuk daftar revoked.

4. Migrasi akun dompet.
   - Dipakai hanya jika akun harus ditutup total.
   - Akun lama diberi status `closed`.
   - Saldo akhir dipindahkan melalui ledger `account_migration_out`.
   - Akun baru menerima ledger `account_migration_in`.
   - Kedua ledger saling mereferensikan `migration_id`.
   - Tidak boleh update/delete ledger lama.

5. Transfer ke ledger book pesantren.
   - Dipakai jika wali keluar, santri keluar, atau dana harus dikembalikan/manual.
   - Buat transaksi debit dompet kategori `settlement_to_pesantren_ledger`.
   - Buat referensi ke `transaksi_keuangan` atau tabel settlement khusus.
   - Harus ada alasan, bukti, dan approval.

Implementasi teknis recovery:

```sql
wallet_devices.status in ('active', 'revoked', 'lost', 'replaced')
dompet_santri.status in ('active', 'locked', 'closed')
wallet_key_rotation_logs(old_device_id, new_device_id, reason, approved_by, created_at)
wallet_card_qr_versions(wallet_public_id, santri_nis, status, issued_at, revoked_at)
```

Untuk reset PIN:

- Jika PIN hanya membuka private key lokal di Android, reset PIN berarti buat key baru dan revoke key lama.
- Jika ada encrypted backup, backup hanya boleh didekripsi oleh wali dengan recovery phrase/credential yang tidak diketahui admin.
- Jangan membuat endpoint "set PIN baru" yang melewati validasi device/key tanpa proses recovery.

## 8. RLS, Grants, dan Data API

Target akses:

- `anon`: tidak boleh punya akses ke tabel wallet.
- `authenticated`: akses sangat terbatas, idealnya hanya select milik sendiri lewat view/RPC.
- `service_role`: hanya dipakai Edge Function server-side, tidak pernah di client.
- Function sensitif sebaiknya berada di schema private seperti `app_private`, bukan `public`.

Rekomendasi awal:

```sql
revoke all on public.dompet_santri from anon;
revoke all on public.transaksi_dompet from anon;
revoke all on public.crypto_keystores from anon;
revoke all on public.wallet_nonces from anon;
revoke all on public.midtrans_webhook_logs from anon;
```

Untuk `authenticated`, jangan grant UPDATE/DELETE/TRUNCATE ke tabel ledger dan akun dompet. Berikan akses melalui RPC yang sudah memvalidasi semua aturan.

Policy role target:

- `wali`: select saldo/riwayat milik santri yang `wali_id = auth.uid()`.
- `bendahara`: baca laporan dan membuat intent/koreksi melalui RPC, bukan update saldo langsung.
- `kantin`: membuat payment intent dan melihat transaksi miliknya sendiri.
- `dewan`/`rois`: read-only audit summary sesuai kebutuhan.
- `super_admin`: admin sistem dan audit, tetap tidak boleh direct edit ledger/saldo.

## 9. Admin Panel

Status implementasi awal per 16 Mei 2026:

- Halaman admin awal: `src/pages/dompet-santri/list.tsx`.
- Resource frontend: `dompet_santri` dengan route `/dompet-santri`.
- Edge Function server-side: `wallet-admin` dengan `verify_jwt = true`.
- Role `kantin` sudah ditambahkan ke access control frontend.
- Operasi yang sudah boleh lewat `wallet-admin`: lookup QR, lock/unlock, reissue QR kartu, dan koreksi ledger oleh role pengelola.
- Pembuatan akun dompet tidak boleh tersedia di admin panel. Pembuatan akun harus lewat aplikasi Android/Kotlin wali santri dan Edge Function provisioning khusus wali.
- Role `kantin` pada tahap ini hanya boleh lookup QR dan melihat data minimum setelah scan. Debit kantin belum boleh diposting langsung sampai flow challenge, PIN/signature, nonce, dan authorization session selesai di Android/Kotlin atau aplikasi kantin.

Resource yang disarankan:

- `dompet_santri`: ringkasan saldo dan status akun.
- `transaksi_dompet`: ledger read-only.
- `wallet_payment_intents`: intent top-up/kantin/admin correction.
- `wallet_audit_logs`: audit aktivitas.
- `wallet_reports`: laporan cetak wali.

Access control frontend harus diperbarui:

- `bendahara`: boleh akses modul dompet, laporan, dan koreksi via action resmi.
- `kantin`: hanya halaman kantin.
- `dewan`: read-only.
- `rois`: read-only audit dan approval jika diperlukan.
- `super_admin`: konfigurasi dan audit.

Frontend access control hanya lapisan UI. Keamanan utama tetap di RLS/RPC/database.

Hal yang dilarang di admin panel:

- membuat akun dompet santri
- melihat atau mengubah private key/encrypted private key
- mengubah saldo langsung
- menghapus ledger
- memproses debit kantin tanpa authorization session
- mengubah limit wali tanpa prosedur recovery resmi

## 10. Android/Kotlin

Endpoint Edge Function yang sudah disiapkan untuk Android:

### 10.1 `wallet-register`

Dipakai aplikasi wali untuk membuat/mengaktifkan dompet santri. Endpoint ini wajib dipanggil dengan JWT wali yang sedang login.

Request:

```json
{
  "santri_nis": "001010100010",
  "device_id": "android-secure-device-id",
  "device_name": "Pixel 8 Wali",
  "public_key": "base64-or-encoded-ed25519-public-key",
  "key_algorithm": "Ed25519"
}
```

Validasi backend:

- caller harus role `wali`
- `santri.wali_id` harus sama dengan user wali
- santri harus `AKTIF`
- public key wajib Ed25519
- private key tidak pernah dikirim ke server
- backend membuat akun dompet, device aktif, QR/card token awal, dan audit log

Response berisi `wallet_public_id`, saldo, data santri minimum, dan status device.

### 10.2 `wallet-update-limits`

Dipakai aplikasi wali untuk mengubah batas penggunaan dompet anaknya. Endpoint ini wajib dipanggil dengan JWT wali.

Request:

```json
{
  "santri_nis": "001010100010",
  "low_balance_threshold": 10000,
  "single_transaction_limit": 25000,
  "daily_spend_limit": 50000,
  "monthly_spend_limit": 500000,
  "large_transaction_threshold": 30000,
  "allowed_merchant_categories": ["kantin"],
  "spending_schedule": {
    "timezone": "Asia/Jakarta",
    "allowed_days": [1, 2, 3, 4, 5, 6],
    "allowed_windows": [
      { "start": "08:00", "end": "17:00" }
    ]
  }
}
```

Validasi backend:

- caller harus role `wali`
- santri harus milik wali
- semua limit harus bilangan bulat non-negatif
- `allowed_merchant_categories` harus array
- `spending_schedule` harus object
- perubahan dicatat di `wallet_audit_logs`

Catatan implementasi Kotlin: perubahan limit idealnya ditandatangani memakai private key Android Keystore. Endpoint tahap awal sudah memvalidasi ownership wali; tahap berikutnya perlu menambahkan payload signature, nonce, dan device id untuk hardening penuh.

### 10.3 `wallet-kantin-authorize`

Dipakai aplikasi Android kantin setelah scan QR/NFC. Endpoint ini membuat `wallet_payment_intents` dan `wallet_authorization_sessions`, tetapi belum mendebit saldo. Debit hanya boleh terjadi setelah challenge disetujui dengan PIN/signature.

Request QR:

```json
{
  "media": "qr",
  "qr_payload": "{\"v\":1,\"type\":\"santri_wallet_card\",\"wallet_public_id\":\"0f8c1c4f-7a02-4a0e-9a9e-0e0d5e6f9d11\"}",
  "amount": 12000,
  "merchant_id": null,
  "outlet_id": null,
  "idempotency_key": "kantin-device-uuid-request-uuid"
}
```

Request NFC memakai bentuk yang sama, tetapi `media = "nfc"` dan payload dikirim lewat `nfc_payload`.

Response:

```json
{
  "status": "requires_authorization",
  "authorization_session_id": "uuid",
  "payment_intent_id": "uuid",
  "challenge": "hex-random-challenge",
  "nonce": "hex-random-nonce",
  "expires_at": "timestamp",
  "amount": 12000
}
```

Validasi backend:

- caller harus role `kantin`
- QR/NFC hanya dianggap identifier publik
- akun dompet harus aktif
- nominal harus valid
- limit per transaksi dicek
- jika `merchant_id` dikirim, user kantin harus terhubung ke merchant/outlet tersebut
- session pendek dan idempotent
- tidak ada debit saldo pada tahap ini

### 10.4 `wallet-kantin-confirm`

Dipakai aplikasi wali untuk menyetujui payment session kantin. Endpoint ini memverifikasi signature Ed25519 dari device wali yang aktif, lalu memanggil RPC atomik `wallet_confirm_kantin_payment`. Debit saldo hanya terjadi setelah endpoint ini sukses.

Request:

```json
{
  "authorization_session_id": "uuid",
  "device_id": "android-secure-device-id",
  "signature": "base64-ed25519-signature-64-byte",
  "signature_encoding": "base64",
  "public_key_encoding": "base64"
}
```

Canonical message yang wajib ditandatangani oleh aplikasi Kotlin:

```text
DOMPET_SANTRI_KANTIN_V1
{authorization_session_id}
{payment_intent_id}
{santri_nis}
{amount}
{challenge}
{nonce}
{expires_at}
```

Contoh Kotlin harus membangun string dengan newline `\n` persis seperti format di atas, tanpa spasi tambahan, lalu menandatangani bytes UTF-8 string tersebut memakai private key Ed25519 dari Android Keystore.

Validasi backend:

- caller harus role `wali`
- santri pada session harus milik wali
- device harus aktif di `wallet_devices`
- public key device harus cocok
- signature Ed25519 harus valid
- authorization session harus belum expired
- status session harus `requires_authorization` atau `authorized`
- limit per transaksi, harian, dan bulanan dicek di database
- saldo dicek di `wallet_post_transaction`
- nonce dipakai sebagai replay protection
- hasil akhir dicatat di `transaksi_dompet`, `wallet_payment_intents`, `wallet_authorization_sessions`, dan `wallet_audit_logs`

Response sukses:

```json
{
  "status": "posted",
  "authorization_session_id": "uuid",
  "payment_intent_id": "uuid",
  "ledger": {
    "status": "posted",
    "ledger_id": 123,
    "saldo": 37500,
    "balance_before": 50000,
    "balance_after": 37500,
    "entry_hash": "sha256-hash"
  }
}
```

Catatan penting: flow PIN yang dimasukkan di perangkat kantin boleh dipakai dalam aplikasi Android kantin, tetapi belum boleh menjadi jalur final debit sebelum ada desain PIN proof/PAKE atau hardware-backed proof yang tidak membocorkan rahasia ke perangkat kantin. Untuk fase bank-grade pertama, approval final harus berasal dari device wali/santri yang punya private key aktif. Jika keputusan produk mengharuskan santri memasukkan PIN di perangkat kantin, implementasikan endpoint terpisah seperti `wallet-kantin-pin-confirm` dengan proof kriptografis, rate limit, device integrity, dan audit gagal PIN. Jangan mengubah `wallet-kantin-confirm` menjadi penerima PIN plaintext.

Aturan permukaan aplikasi:

- Aplikasi Android wali: registrasi dompet, update limit, approval transaksi, notifikasi, riwayat.
- Aplikasi Android kantin: scan QR/NFC, input nominal, input PIN/proof bila desain proof sudah selesai, cetak/tampilkan struk.
- Admin panel web: monitoring dan audit saja, tanpa input PIN dan tanpa transaksi kantin.

Kewajiban aplikasi Android:

- Gunakan Android Keystore untuk private key.
- Jangan simpan PIN/password di SharedPreferences.
- Jangan menyimpan service role key.
- Gunakan Supabase anon/publishable key saja.
- Semua transaksi dikirim ke Edge Function/RPC, bukan update tabel langsung.
- Pembuatan akun dompet santri hanya dilakukan dari aplikasi wali.
- Implementasikan device registration.
- Implementasikan signature challenge untuk pembayaran.
- Implementasikan rate limit UI untuk PIN.
- Implementasikan notifikasi saldo rendah dan transaksi besar.
- Implementasikan pengaturan limit oleh wali: ambang saldo rendah, limit per transaksi, limit harian, dan threshold transaksi besar.

Library/komponen yang disarankan:

- Android Keystore untuk keypair.
- BiometricPrompt jika perangkat mendukung.
- CameraX untuk camera pipeline scan QR.
- ML Kit Barcode Scanning atau ZXing untuk decoding QR.
- Android NFC API untuk fase tap-to-pay jika perangkat mendukung.
- TLS certificate pinning wajib untuk aplikasi produksi, minimal untuk domain Supabase Edge Functions/API dan Midtrans.
- Secure storage hanya untuk token/session non-private-key.

Contoh konsep pinning di Kotlin/OkHttp:

```kotlin
val certificatePinner = CertificatePinner.Builder()
    .add("*.supabase.co", "sha256/BASE64_PUBLIC_KEY_HASH")
    .add("api.midtrans.com", "sha256/BASE64_PUBLIC_KEY_HASH")
    .build()

val client = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```

Catatan operasional: pinning harus punya prosedur rotasi certificate/public key pin. Jangan hardcode satu pin tanpa backup pin, karena rotasi sertifikat dapat membuat aplikasi gagal koneksi massal.

## 11. Midtrans

Edge Function Midtrans wajib:

- memvalidasi method dan payload
- memvalidasi `signature_key`
- memvalidasi `order_id` milik payment intent
- memvalidasi `gross_amount` sama dengan intent
- menggunakan idempotency key
- tidak memproses status selain final success sesuai aturan Midtrans
- mencatat raw webhook ke `midtrans_webhook_logs`
- tidak mencatat saldo jika validasi gagal

Webhook harus tahan replay. Jika `order_id` sudah diproses sukses, webhook berikutnya harus idempotent dan tidak menambah saldo lagi.

## 12. Audit dan Monitoring

Audit wajib untuk:

- pembuatan akun dompet
- registrasi/revoke device
- scan QR
- pembuatan payment intent
- approval transaksi
- transaksi sukses/gagal
- gagal PIN
- saldo rendah
- koreksi bendahara
- akses laporan
- lock/unlock dompet

Audit log harus menyimpan:

- actor id
- actor role
- target santri
- action
- resource
- IP/user agent jika tersedia
- request id
- timestamp
- metadata aman tanpa rahasia

Jangan simpan PIN, private key, token Midtrans sensitif, atau full secret payload di audit log.

## 13. Notifikasi

Notifikasi dompet adalah bagian dari kontrol keamanan, audit, dan operasional. Push FCM bukan sumber kebenaran; push hanya sinyal agar aplikasi Android mengambil ulang data dari RPC/view resmi.

Target channel:

- Push FCM: channel utama untuk wali, kantin, bendahara, rois, dewan, dan super_admin.
- SMS fallback: hanya untuk event kritis tertentu, terutama saldo kritis atau eskalasi keamanan. Saat ini database memberi flag `sms_fallback_required`; integrasi provider SMS masih harus dibuat di worker terpisah.
- Email digest: untuk bukti operasional berkala seperti hash-chain verification sukses mingguan.

Threshold default:

- saldo warning: `< Rp30.000`, event `wallet.balance.warning`, push ke wali.
- saldo kritis: `< Rp10.000`, event `wallet.balance.critical`, push ke wali dan flag SMS fallback.
- transaksi besar bendahara: `>= Rp100.000`.
- transaksi besar rois: `>= Rp500.000`.
- transaksi kritikal super_admin: `>= Rp1.000.000` atau minimal 3 transaksi besar dalam 1 jam dari santri yang sama.

### 13.1 Arsitektur Notifikasi Dompet

Status implementasi per 2026-05-16:

- `notification_queue` adalah antrean utama notifikasi.
- `user_devices` menyimpan FCM token Android per user.
- Edge Function `push-notifications` membaca antrean dan mengirim ke Firebase Cloud Messaging.
- Cron `wallet-push-notifications-every-minute` memanggil Edge Function setiap menit.
- Kolom `event_type`, `priority`, `channel`, `reference_id`, `read_at`, dan `scheduled_at` dipakai untuk klasifikasi dan audit notifikasi.
- Migration `20260516095108_wallet_notification_event_refinement.sql` memperluas event keamanan, SLA dispute, weekly digest, PIN failure, top-up gagal, dan maintenance broadcast.

Event otomatis:

| Event | Penerima | Priority | Source |
| --- | --- | --- | --- |
| Top-up berhasil | Wali | normal | `transaksi_dompet` |
| Top-up gagal | Wali | high | `wallet_payment_intents` |
| Pembayaran kantin berhasil | Wali dan akun kantin | normal/high | `transaksi_dompet` |
| Saldo warning `< Rp30.000` | Wali | high | `dompet_santri` |
| Saldo kritis `< Rp10.000` | Wali, SMS fallback flag | critical | `dompet_santri` |
| Transaksi besar bendahara `>= Rp100.000` | `bendahara` | high | `transaksi_dompet` |
| Transaksi besar rois `>= Rp500.000` | `rois` | critical | `transaksi_dompet` |
| Transaksi kritikal super_admin `>= Rp1.000.000` atau 3x besar/jam | `super_admin` | critical | `transaksi_dompet` |
| Koreksi/refund/migrasi ledger | Wali dan auditor | high | `transaksi_dompet` |
| Risk event low | Log saja | low | `wallet_risk_events` |
| Risk event medium | Auditor | normal | `wallet_risk_events` |
| Risk event high | Auditor dan wali, wallet lock | high | `wallet_risk_events` |
| Risk event critical | Auditor, wali, super_admin, wallet lock, SLA 15 menit | critical | `wallet_risk_events` |
| Rekonsiliasi gagal/settlement mismatch | Auditor | high/critical | `wallet_reconciliation_runs` |
| Hash-chain integrity failed | Auditor | critical | `wallet_ledger_integrity_runs` |
| Hash-chain integrity sukses | Auditor digest/email mingguan | low | `wallet_ledger_integrity_runs` |
| Dispute dibuka | `super_admin`, `bendahara`, `rois` | high | `wallet_disputes` |
| SLA dispute lewat 48 jam | `super_admin` | critical | `wallet_disputes` |
| Dispute selesai | Wali | normal | `wallet_disputes` |
| Device kantin pending | Auditor | high | `kantin_devices` |
| Device kantin active/suspended/revoked | Akun kantin | normal/high | `kantin_devices` |
| Login dari perangkat baru | Wali/kantin pemilik akun | critical | `user_devices` |
| PIN salah 3x dalam 15 menit | Wali, wallet lock sementara | high | `wallet_pin_attempts` |
| PIN salah >10x dalam 1 jam | Auditor | critical | `wallet_pin_attempts` |
| Freeze sistem dompet | Auditor dan broadcast kantin | critical | `wallet_system_controls` |
| Unfreeze sistem dompet | Auditor dan broadcast kantin | normal | `wallet_system_controls` |
| Weekly digest Minggu | Wali | low | `wallet_weekly_digest_runs` |
| Maintenance/downtime | Semua role aktif terkait dompet | high | `wallet_maintenance` |

Template pesan wajib:

- Wali saat pembayaran kantin berhasil: `[Nama anak] beli di Kantin [nama kantin], Rp [nominal], sisa saldo Rp [saldo]. Bukan kamu? Laporkan segera.`
- Kantin saat pembayaran diterima: `Pembayaran diterima Rp [nominal] - [nama santri] - [waktu]`
- Dispute valid: `Transaksi [ID] telah diverifikasi valid. Jika masih bermasalah hubungi pesantren.`
- Dispute reversed: `Transaksi [ID] telah dibalik. Saldo Rp [nominal] telah dikembalikan.`
- Login perangkat baru: `Login baru terdeteksi di akun kamu dari perangkat [nama device]. Bukan kamu? Kunci akun sekarang.`
- PIN salah 3x: `Ada 3 percobaan PIN salah di akun [nama anak]. Akun dikunci sementara 15 menit.`
- Maintenance: `Sistem dompet santri akan dalam pemeliharaan [tanggal] pukul [waktu] selama estimasi [durasi]. Kantin harap siapkan pencatatan manual sementara.`

Deep link wajib:

- Dispute transaksi: `alhasanah://wallet/dispute?ledger_id={ledger_id}`.
- Lock akun karena perangkat baru: `alhasanah://security/lock-account`.
- Detail notifikasi high/critical harus membuka layar detail yang fetch ulang dari backend.

Format data FCM:

- `notification_id`: UUID `notification_queue`.
- `user_id`: penerima.
- `source`: nama tabel/source.
- `event_type`: tipe event, misalnya `wallet.kantin.payment_posted`.
- `priority`: `low`, `normal`, `high`, atau `critical`.
- Metadata event lain disalin dari `notification_queue.data`.

Syarat Android:

- Aplikasi wali dan kantin wajib mendaftarkan FCM token ke `user_devices`.
- Token lama harus dihapus atau diganti saat logout/device reset.
- Android harus memvalidasi `user_id` pada payload notifikasi sama dengan user login.
- Untuk event high/critical, Android harus membuka layar detail yang melakukan fetch ulang ke backend, bukan percaya penuh pada payload notifikasi.
- Push notification hanya sinyal; sumber kebenaran tetap database/RPC.
- Aplikasi wali harus menyediakan form dispute yang bisa dibuka dari deep link notifikasi pembayaran kantin.
- Aplikasi kantin harus menampilkan riwayat transaksi dari `view_kantin_transaction_history`, bukan dari cache notifikasi.
- Aplikasi Android harus mendukung certificate pinning saat komunikasi ke Supabase Edge Functions dan Midtrans.
- Worker SMS fallback harus membaca `notification_queue.data->>'sms_fallback_required' = 'true'` atau event critical setara, lalu mengirim via provider SMS resmi.

Syarat environment produksi:

- Edge Function `push-notifications` membutuhkan secret `FIREBASE_SERVICE_ACCOUNT_KEY`.
- Jika secret ini belum diisi, antrean tetap terbentuk tetapi pengiriman FCM tidak akan terkirim sampai secret dikonfigurasi.
- Firebase project harus sama dengan aplikasi Android wali/kantin.
- Untuk hardening, gunakan certificate pinning di Android saat registrasi token dan fetch detail notifikasi.
- Untuk SMS fallback, tambahkan secret provider SMS dan worker pengirim SMS terpisah agar tidak mencampur kredensial SMS ke client Android.

## 14. Batasan Closed-Loop Pesantren

Sistem ini dirancang untuk uang jajan internal pesantren, dengan dana tersimpan di rekening pesantren dan nilai float diproyeksikan tidak mencapai Rp1.000.000.000. Namun tetap perlu review kepatuhan karena sistem menyimpan nilai uang dan memproses pembayaran closed-loop.

Aturan produk:

- tidak ada transfer antarwali bebas
- tidak ada cash-out publik
- tidak ada merchant luar pesantren
- tidak ada bunga, lending, atau investasi
- refund hanya melalui prosedur bendahara
- batas saldo dan transaksi harus bisa dikonfigurasi

## 15. Gap Banking-Grade yang Wajib Ditutup

Bagian ini adalah gap analysis terhadap pondasi yang sudah dibuat. Status saat ini: ledger append-only, cached balance guarded, hash chain, Ed25519 approval untuk `wallet-kantin-confirm`, role separation, dan Android-only transaction surface sudah ada/terdokumen. Namun sistem belum boleh dianggap production-grade sebelum gap berikut ditutup.

### 15.1 Automated Reconciliation

Status saat ini: belum ada.

Ini prioritas paling kritikal. Sistem harus punya rekonsiliasi otomatis berkala yang membandingkan tiga angka:

```text
sum(transaksi_dompet credit) - sum(transaksi_dompet debit)
  =
sum(dompet_santri.saldo untuk akun aktif)
  =
saldo rekening bank pesantren yang dicadangkan untuk dompet
```

Jika angka pertama dan kedua tidak cocok, sistem wajib:

- membuat incident log
- mengirim alert ke `super_admin`, `bendahara`, dan `rois`
- membekukan transaksi baru dompet sampai investigasi
- menandai hasil rekonsiliasi sebagai `failed`
- menyimpan detail selisih, waktu, dan query snapshot

Jika angka internal cocok tetapi tidak cocok dengan saldo rekening bank/Midtrans settlement, sistem wajib masuk status `settlement_mismatch`, bukan langsung freeze semua transaksi kecuali mismatch melebihi threshold risiko.

Pondasi tabel yang diperlukan:

```sql
wallet_reconciliation_runs (
  id uuid primary key,
  started_at timestamptz,
  finished_at timestamptz,
  status text, -- running/success/failed/settlement_mismatch
  ledger_net bigint,
  cached_balance_total bigint,
  reserved_bank_balance bigint,
  difference_internal bigint,
  difference_bank bigint,
  freeze_triggered boolean,
  details jsonb
)
```

Implementasi target:

- Scheduled Edge Function setiap 1 jam.
- Manual run dari admin panel hanya untuk role `super_admin`/`bendahara`.
- Reconciliation harian menghasilkan laporan PDF/CSV.
- Jika freeze aktif, `wallet_post_transaction` atau guard sebelum transaksi harus menolak debit/credit baru kecuali reversal/recovery resmi.

### 15.2 AI Anomaly Detection

Status saat ini: belum ada.

Sistem harus membangun baseline transaksi per santri, per kantin, per device, dan per waktu. Tujuannya bukan mengganti rule deterministik, tetapi menambah lapisan deteksi perilaku yang tidak biasa.

Rule deterministik minimum sebelum AI:

- Velocity santri: lebih dari 3 transaksi dalam 5 menit -> freeze sementara + alert.
- Amount: transaksi lebih dari 3x rata-rata harian santri -> require wali approval.
- Time: transaksi di luar jam operasional pesantren -> tolak otomatis.
- Device: device kantin belum terdaftar atau status bukan `active` -> blokir.
- Pattern kantin: satu device/outlet memproses lebih dari 30 transaksi dalam 10 menit -> flag dan rate limit.
- Location/session: login atau transaksi dari perangkat/IP yang tidak biasa -> require re-auth.

Pondasi data yang diperlukan:

```sql
wallet_risk_events (
  id uuid primary key,
  severity text, -- low/medium/high/critical
  status text, -- open/acknowledged/resolved/false_positive
  santri_nis text,
  actor_id uuid,
  device_id text,
  merchant_id uuid,
  rule_code text,
  score numeric,
  details jsonb,
  created_at timestamptz
)
```

AI anomaly detection target:

- Baseline nominal per santri.
- Baseline jam transaksi per santri.
- Baseline device kantin dan outlet.
- Baseline velocity per kantin.
- Model/rule engine menghasilkan risk score.
- Risk score tinggi dapat memicu hold/freeze, bukan hanya notifikasi.

### 15.3 TLS Certificate Pinning

Status saat ini: dokumen sudah diubah menjadi wajib.

TLS pinning wajib untuk aplikasi Android produksi:

- Supabase API/Edge Functions.
- Midtrans endpoint.
- Endpoint tambahan milik pesantren jika ada.

Pinning harus dilengkapi:

- primary pin dan backup pin
- prosedur rotasi
- kill-switch aman via remote config yang ditandatangani jika terjadi emergency certificate rotation
- monitoring crash/koneksi setelah rotasi

Tanpa pinning, HTTPS masih bisa terkena risiko MITM pada perangkat yang memasang root CA jahat, captive portal agresif, atau perangkat terkompromi.

### 15.4 Kantin Device Registration

Status saat ini: belum ada. Yang sudah ada baru `wallet_devices` untuk wali/santri.

Role `kantin` tidak cukup. Setiap perangkat kantin harus diperlakukan seperti terminal EDC: punya device id, public key, status, dan approval admin.

Tabel target:

```sql
kantin_devices (
  id uuid primary key default gen_random_uuid(),
  kantin_user_id uuid references public.profiles(id),
  device_id text not null unique,
  device_fingerprint text not null,
  public_key text not null,
  key_algorithm text not null default 'Ed25519',
  status text not null default 'pending', -- pending/active/revoked/suspended
  registered_by uuid references public.profiles(id),
  registered_at timestamptz default now(),
  approved_at timestamptz,
  last_transaction_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  unique(kantin_user_id, device_id)
)
```

Aturan wajib:

- `wallet-kantin-authorize` harus menolak request dari device kantin yang tidak `active`.
- Request kantin harus membawa `device_id`, signature, dan public key fingerprint.
- Device baru status awal `pending`.
- Approval device hanya oleh `super_admin`/`bendahara`.
- Revoke device langsung menghentikan transaksi baru dari perangkat tersebut.

### 15.5 Multi-Factor Approval untuk Transaksi Besar

Status saat ini: parsial. Kolom `large_transaction_threshold` sudah ada dan `wallet-kantin-confirm` sudah memakai approval wali, tetapi rule threshold dan push notification belum lengkap.

Target flow:

```text
Kantin scan QR/NFC dan input nominal
  -> backend cek amount > large_transaction_threshold
  -> status requires_parent_approval
  -> push notification ke aplikasi wali
  -> wali approve dengan biometric/PIN lokal
  -> app wali mengirim Ed25519 signed approval
  -> wallet-kantin-confirm posting ledger
  -> timeout 60 detik jika tidak direspons
```

Untuk transaksi kecil, pesantren boleh memilih:

- tetap wajib approval wali untuk semua transaksi, paling aman tapi friction tinggi
- PIN/proof santri pada perangkat kantin, hanya setelah desain proof aman selesai
- approval wali hanya untuk transaksi besar

### 15.6 Offline Transaction Queue Kantin

Status saat ini: belum ada.

Offline queue diperlukan untuk kondisi internet pesantren putus, tetapi harus dibatasi ketat karena saldo final hanya bisa diverifikasi server.

Aturan minimum:

- Offline transaction hanya membuat local pending intent, bukan saldo final.
- Maksimal 1 transaksi offline per santri per sesi offline.
- Maksimal nominal offline kecil, misalnya Rp10.000-Rp15.000.
- Expiry pendek, misalnya 5-10 menit.
- Saat online, sync memakai `idempotency_key` yang sama.
- Jika saldo tidak cukup saat sync, transaksi gagal dan struk harus menampilkan status gagal.
- Kantin wajib menandai transaksi offline sebagai risiko operasional.

Kotlin Room entity yang disarankan:

```kotlin
@Entity(tableName = "pending_transactions")
data class PendingTransaction(
    @PrimaryKey val idempotencyKey: String,
    val walletPublicId: String,
    val amount: Long,
    val createdAt: Long,
    val expiresAt: Long,
    val status: String = "pending_sync"
)
```

### 15.7 Formal Dispute Resolution

Status saat ini: belum ada.

Dispute wajib ada karena wali bisa melaporkan transaksi yang dianggap tidak sah. Ledger lama tidak boleh diedit; penyelesaian dilakukan dengan reversal ledger baru.

Tabel target:

```sql
wallet_disputes (
  id uuid primary key default gen_random_uuid(),
  ledger_id bigint references public.transaksi_dompet(id),
  reported_by uuid references public.profiles(id),
  status text default 'open',
  reason text not null,
  evidence jsonb default '{}'::jsonb,
  resolved_by uuid references public.profiles(id),
  resolution_note text,
  reversal_ledger_id bigint references public.transaksi_dompet(id),
  created_at timestamptz default now(),
  resolved_at timestamptz
)
```

Flow:

1. Wali membuka dispute dari aplikasi Android.
2. Bendahara menerima notifikasi.
3. Bendahara investigasi ledger, audit log, device, merchant, dan struk.
4. Jika valid, status `resolved_valid`.
5. Jika perlu pengembalian, buat transaksi `refund` atau `dispute_reversal`, bukan edit ledger lama.

### 15.8 Periodic Hash Chain Integrity Verification

Status saat ini: hash chain sudah ada, tetapi verifier berkala belum ada.

Hash chain hanya berguna jika dicek berkala. Target:

- Function `verify_wallet_ledger_integrity(p_santri_nis, p_from_date)`.
- Scheduled job harian untuk semua akun aktif.
- Incident jika `prev_hash` tidak cocok.
- Incident jika `entry_hash` hasil recompute tidak cocok.
- Freeze jika ada broken chain pada ledger terbaru.

Catatan teknis: recompute `entry_hash` harus memakai fungsi hash yang sama dengan `wallet_post_transaction`. Jika payload hash berubah di masa depan, simpan `hash_version`.

### 15.9 Biometric dan RASP Android

Status saat ini: biometric masih rekomendasi, belum wajib.

Untuk produksi:

- BiometricPrompt wajib untuk approval transaksi besar.
- Device credential fallback boleh jika biometric tidak tersedia.
- Root/jailbreak/emulator/debugger detection wajib untuk aplikasi kantin.
- App integrity check wajib dipertimbangkan untuk aplikasi wali dan kantin.
- Secret dan private key tidak boleh diekspor dari Android Keystore.

### 15.10 Ringkasan Status Gap

| Komponen | Status Sekarang | Target |
| --- | --- | --- |
| Ledger append-only | Ada | Pertahankan |
| Hash chain tamper-evident | Ada | Tambah verifier berkala |
| Ed25519 transaction signing | Ada untuk approval wali | Tambah proof PIN santri jika diperlukan |
| Automated reconciliation | Ada fondasi DB/RPC | Jadwalkan hourly + alert |
| AI anomaly detection | Ada fondasi risk event + rule deterministik awal | Tambah scoring AI |
| TLS certificate pinning | Wajib di dokumen | Implementasi Android |
| Kantin device registration | Ada fondasi DB/RPC + Edge signature check | Buat UI approval dan Android enrollment |
| Multi-factor transaksi besar | Parsial | Push approval + timeout |
| Offline queue kantin | Belum ada | Wajib untuk operasional, dengan hard limit |
| Dispute resolution formal | Ada fondasi DB/RPC | Buat UI dan Android flow |
| Hash chain verification job | Ada fondasi DB/RPC | Jadwalkan harian |
| Biometric Android | Belum wajib di kode | Wajib untuk approval besar |
| Time-based transaction rules | Ada rule DB awal | Buat konfigurasi admin |

Prioritas implementasi berikutnya:

1. Automated reconciliation dan freeze switch.
2. Kantin device registration + request signing.
3. Rule-based anomaly detection sebelum AI penuh.
4. Multi-factor approval transaksi besar dengan push notification.
5. Hash chain verifier.
6. Dispute workflow.
7. Offline queue kantin.

### 15.11 Status Implementasi Pondasi Banking-Grade

Status per 2026-05-16:

- Migration `20260516090110_wallet_banking_grade_controls.sql` menambah pondasi banking-grade untuk modul dompet.
- `wallet_system_controls` menjadi freeze switch global untuk transaksi dompet.
- `wallet_run_reconciliation` membandingkan ledger net, cached balance, dan saldo rekening cadangan opsional.
- Jika rekonsiliasi internal gagal, sistem otomatis mengaktifkan freeze switch.
- `wallet_post_transaction` sekarang menolak transaksi baru ketika freeze aktif, kecuali kategori recovery resmi seperti `correction`, `refund`, `account_migration_in`, `account_migration_out`, dan `settlement_to_pesantren_ledger`.
- `kantin_devices` menjadi registry perangkat kantin. Role `kantin` saja tidak cukup untuk memproses transaksi.
- `wallet-kantin-authorize` wajib menerima `device_id`, `device_nonce`, dan `device_signature`.
- Edge Function `wallet-kantin-authorize` memverifikasi signature Ed25519 perangkat kantin sebelum membuat authorization session.
- DB function `wallet_create_kantin_authorization_session` tetap memvalidasi device kantin aktif sebagai lapisan kedua.
- `wallet_risk_events` menyimpan event anomali seperti device tidak terdaftar, key mismatch, transaksi di luar jam operasional, velocity santri, velocity kantin, dan amount baseline.
- Rule time-based awal memakai konfigurasi default jam operasional 06.00-21.00 Asia/Jakarta.
- Rule velocity awal mengunci wallet jika santri melewati batas debit dalam 5 menit.
- `verify_wallet_ledger_integrity` memverifikasi `prev_hash` dan recompute `entry_hash`.
- `wallet_run_ledger_integrity_check` menjalankan verifikasi satu akun atau semua akun dan memicu freeze jika chain rusak.
- `wallet_disputes`, `wallet_open_dispute`, dan `wallet_resolve_dispute` menjadi fondasi dispute formal dengan reversal ledger baru, bukan edit ledger lama.
- Edge Function `wallet-admin` memiliki action operasional untuk registrasi/approval device kantin, rekonsiliasi manual, hash-chain integrity check, dan freeze/unfreeze.
- Migration `20260516091330_wallet_scheduled_safety_jobs.sql` mengaktifkan scheduled safety jobs.
- Cron `wallet-reconciliation-hourly` menjalankan rekonsiliasi internal setiap jam.
- Cron `wallet-ledger-integrity-daily` menjalankan hash-chain integrity check harian.
- Admin panel menampilkan kontrol banking-grade: freeze switch, rekonsiliasi manual, hash-chain check, daftar device kantin, risk events, reconciliation runs, dan integrity runs.
- Migration `20260516092318_wallet_kantin_management_and_history.sql` menambah view riwayat kantin dan RPC status akun kantin.
- Admin panel memiliki halaman `Manajemen Kantin` untuk audit akun, device, assignment merchant/outlet, dan riwayat transaksi.
- Menonaktifkan akun kantin dilakukan sebagai revoke/nonaktif aman, bukan delete ledger.
- Auth provider admin panel mengecek `profiles.is_active`; akun nonaktif akan sign out dan tidak boleh masuk UI.
- Migration `20260516093606_wallet_notifications_full.sql` menambah trigger notifikasi otomatis untuk event dompet.
- Edge Function `push-notifications` dideploy sebagai worker FCM.
- Migration `20260516093943_wallet_push_notification_cron.sql` menjadwalkan worker push setiap menit.
- Migration `20260516095108_wallet_notification_event_refinement.sql` memperluas event notifikasi sesuai kebutuhan operasional banking-grade: saldo dua threshold, top-up gagal, login device baru, PIN failure, gradasi transaksi besar per role, risk event severity, SLA dispute, weekly digest, dan maintenance broadcast.
- `wallet_pin_attempts` mencatat percobaan PIN gagal dan function `wallet_record_pin_failure` mengunci wallet sementara setelah 3 percobaan dalam 15 menit.
- `wallet_weekly_digest_runs` dan cron `wallet-weekly-digest-sunday` membuat ringkasan mingguan wali setiap Minggu.
- Cron `wallet-dispute-sla-hourly` mengeksekusi `wallet_escalate_overdue_disputes` untuk eskalasi dispute yang lewat SLA 48 jam.
- `wallet_broadcast_maintenance` menyiapkan broadcast downtime/maintenance ke wali, kantin, dan auditor aktif.
- Notifikasi pembayaran kantin sekarang membawa `dispute_deeplink` agar wali bisa langsung membuka form laporan transaksi.
- Saldo kritis membawa flag `sms_fallback_required`; implementasi pengirim SMS masih perlu worker/provider tambahan.

Canonical message untuk signature device kantin pada `wallet-kantin-authorize`:

```text
DOMPET_SANTRI_KANTIN_AUTHORIZE_V1
{wallet_public_id}
{amount}
{kantin_user_id}
{device_id}
{idempotency_key}
{media}
{merchant_id_or_empty}
{outlet_id_or_empty}
{device_nonce}
```

Field request Android kantin minimum:

- `wallet_public_id` atau `qr_payload` atau `nfc_payload`.
- `amount`.
- `media`: `qr` atau `nfc`.
- `idempotency_key`.
- `device_id`.
- `device_nonce`.
- `device_signature`.
- `signature_encoding`: `base64` atau `hex`.
- `public_key_encoding`: `base64` atau `hex`.

Catatan penting untuk Android: `device_signature` harus dibuat oleh private key Ed25519 yang tersimpan di Android Keystore atau mekanisme hardware-backed setara. Private key perangkat kantin tidak boleh bisa diekspor, tidak boleh dikirim ke server, dan tidak boleh dicatat di log.

Yang masih harus dikerjakan sebelum Kotlin:

- UI admin dispute resolution.
- UI admin detail/acknowledge risk event.
- Worker SMS fallback untuk saldo kritis dan event keamanan kritikal.
- Email/weekly silent digest untuk bukti hash-chain verification sukses.
- AI scoring di atas `wallet_risk_events`.

## 16. Checklist Implementasi Bertahap

Tahap 1 - Hardening dasar:

- Samakan role database dengan role aplikasi: `bendahara`, `kantin`, `super_admin`, `rois`, `dewan`, `wali`.
- Cabut grant `anon` dari tabel wallet.
- Tambah `updated_at`, `saldo not null default 0`, dan `check saldo >= 0`.
- Hapus policy `Kantin view all balances`.
- Ubah `view_admin_wallet_status` menjadi `security_invoker` atau pindahkan ke schema private.
- Fix Midtrans webhook signature.

Tahap 2 - Ledger aman:

- Tambah idempotency key.
- Tambah `balance_before` dan `balance_after`.
- Tambah `entry_hash` dan `prev_hash`.
- Jadikan ledger append-only.
- Buat RPC `wallet_post_transaction`.
- Ganti trigger lama dengan RPC atomik.

Tahap 3 - QR dan kantin:

- Buat `wallet_payment_intents`.
- Buat `wallet_authorization_sessions`.
- Buat role `kantin`.
- Buat flow scan QR dengan challenge expiry.
- Buat halaman/aplikasi kantin.

Tahap 4 - Android wallet security:

- Device registration.
- Android Keystore.
- Signature challenge.
- PIN/biometric approval.
- Push notification.

Tahap 5 - Audit dan laporan:

- Audit log lengkap.
- Laporan wali.
- Laporan bendahara.
- Export/cetak.
- Monitoring anomali.

Tahap 6 - Banking-grade controls:

- Automated reconciliation hourly.
- Freeze switch untuk mismatch/insiden kritikal.
- Kantin device registration.
- Rule-based anomaly detection.
- AI anomaly scoring.
- Multi-factor approval transaksi besar.
- TLS pinning Android.
- Hash chain verifier harian.
- Formal dispute workflow.
- Offline queue kantin dengan hard limit.

## 17. Aturan Untuk AI Agent

Saat agent AI bekerja di project ini:

- Jangan membuat fitur yang mengupdate `dompet_santri.saldo` langsung dari frontend.
- Jangan membuat insert `transaksi_dompet` yang otomatis memotong saldo tanpa RPC atomik.
- Jangan menambahkan policy `USING (true)` pada tabel wallet.
- Jangan memberi akses `anon` ke tabel wallet.
- Jangan menyimpan service role key di frontend atau Android.
- Jangan menyebut Ed25519 sebagai enkripsi.
- Jangan membuat QR berisi NIS mentah, saldo, token, private key, atau credential.
- Jangan membuat fitur kantin yang dapat melihat seluruh saldo santri.
- Jangan mengubah ledger lama untuk koreksi.
- Jangan mencampur ledger dompet dengan buku besar pesantren kecuali melalui reference id.
- Selalu jalankan Supabase advisor setelah DDL.
- Selalu verifikasi RLS, grants, dan function privileges setelah migration.

Jika agent perlu membuat migration:

1. Baca schema terkini lewat MCP Supabase.
2. Buat migration bertahap.
3. Gunakan private schema untuk function sensitif.
4. Terapkan least privilege grants.
5. Jalankan security dan performance advisor.
6. Uji transaksi debit bersamaan.
7. Uji webhook replay.
8. Uji user role `wali`, `bendahara`, `kantin`, `dewan`, `rois`, dan `super_admin`.

## 18. Acceptance Criteria

Fitur dompet baru boleh dianggap siap uji jika:

- saldo tidak bisa negatif dalam concurrent debit test
- webhook Midtrans replay tidak menggandakan saldo
- kantin tidak bisa melihat semua saldo
- wali hanya bisa melihat dompet anaknya
- admin tidak bisa membaca private key atau secret wallet
- ledger tidak bisa diupdate/delete oleh client
- semua mutasi punya audit log
- semua transaksi punya idempotency key
- semua debit punya authorization session atau signature valid
- Supabase advisor tidak menunjukkan error kritikal untuk tabel wallet
- laporan saldo cocok dengan agregasi ledger

## 18. Istilah

- Wallet account: akun dompet santri.
- Cached balance: saldo cepat di `dompet_santri`, bukan sumber kebenaran tunggal.
- Ledger: daftar transaksi append-only.
- Payment intent: niat transaksi yang belum final.
- Authorization session: sesi persetujuan singkat untuk QR/PIN/signature.
- Idempotency key: kunci unik agar request berulang tidak menggandakan transaksi.
- Nonce: angka/token sekali pakai untuk mencegah replay.
- Hash chain: rantai hash antar ledger untuk mendeteksi perubahan historis.
