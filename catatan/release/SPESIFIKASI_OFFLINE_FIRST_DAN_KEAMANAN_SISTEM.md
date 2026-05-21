# Spesifikasi Offline-First dan Keamanan Sistem Aplikasi

Tanggal dokumen: 2026-05-16

Dokumen ini menjelaskan rancangan dan implementasi keamanan aplikasi Android Alhasanah Media berdasarkan kondisi aktual kode Android dan Supabase. Dokumen ini ditujukan sebagai catatan teknis untuk audit keamanan internal maupun lembaga resmi.

## Ringkasan Eksekutif

Aplikasi memakai Supabase sebagai backend utama dan Android Kotlin sebagai client. Akses data memakai Supabase Auth, PostgREST, Storage, dan Realtime. Beberapa fitur memakai pola offline-first dengan cache lokal Room/DataStore. Data sensitif tertentu dienkripsi di sisi Android menggunakan Android Keystore dan AES/GCM.

Untuk fitur chat alumni, isi pesan telah dipindahkan ke desain E2EE. Supabase tidak lagi menyimpan plaintext isi chat. Tabel `chat_messages` hanya menyimpan metadata pesan, sedangkan payload pesan disimpan sebagai ciphertext per perangkat di `chat_message_device_ciphertexts`. Admin dan developer yang mengakses database hanya dapat melihat metadata dan ciphertext, bukan isi pesan.

Fitur forum alumni bukan E2EE. Konten thread/comment forum memang disimpan sebagai plaintext karena secara desain merupakan konten sosial forum yang perlu dimoderasi admin. Aksesnya dibatasi dengan RLS untuk alumni aktif dan admin forum.

Fitur wali santri mengambil data melalui RPC secure dan cache lokal. Detail santri sensitif dienkripsi di cache lokal Android menggunakan Android Keystore. Sebagian daftar ringkas dan data aktivitas tersimpan sebagai JSON cache lokal tanpa E2EE, sehingga perlindungannya mengandalkan sandbox aplikasi Android, Room database private app, dan kebijakan cache.

## Arsitektur Backend Supabase

Komponen Supabase yang dipakai:

- Supabase Auth untuk login email/password.
- PostgREST untuk akses tabel dan RPC.
- Supabase Storage untuk attachment/media.
- Supabase Realtime untuk fitur realtime forum/chat.
- PostgreSQL RLS untuk pembatasan akses row.
- Private schema/function `app_private` untuk helper authorization dan trigger.

Konfigurasi Android:

- Client dibuat di `SupabaseModule.kt`.
- Plugin terpasang: `Auth`, `Postgrest`, `Storage`, `Realtime`.
- HTTP engine: Ktor CIO.
- Timeout request: 30 detik.
- Android memakai publishable/anon key dari `BuildConfig.SUPABASE_ANON_KEY`, bukan service role.

## Model Keamanan Auth dan Authorization

### Auth Android

Implementasi:

- `AuthRepositoryImpl.kt`
- Login memakai Supabase Auth provider `Email`.
- Session status dibaca dari `supabaseClient.auth.sessionStatus`.
- User aktif diambil dari authenticated session.

### Authorization Supabase

Authorization utama dilakukan di PostgreSQL RLS dan helper function:

- `auth.uid()` dipakai untuk mengikat row ke user login.
- Role dan status aktif disimpan di database, bukan dari input client.
- Fitur forum alumni memakai helper seperti `app_private.is_current_user_active_alumni()` dan `app_private.is_current_user_forum_admin()`.
- Fitur chat memakai helper participant dan alumni aktif di `app_private`.

Prinsip penting:

- Android client tidak diberi service role.
- Client biasa hanya menggunakan session user dan RLS.
- RPC sensitif chat `get_chat_admin_monitor(integer)` dan `is_chat_participant(uuid, uuid)` sudah direvoke dari `anon` dan `authenticated`, hanya tersisa untuk `postgres`/`service_role`.

## Fitur Chat Alumni E2EE

### Tujuan Keamanan

Tujuan utama chat alumni adalah memastikan isi pesan hanya bisa dibaca di perangkat participant yang memiliki private key. Supabase, admin, developer, notification worker, dan query monitor tidak menyimpan plaintext isi chat.

### Struktur Data Chat di Supabase

Tabel utama:

- `chat_conversations`: metadata conversation.
- `chat_participants`: participant conversation, read state, archive, mute.
- `chat_messages`: metadata pesan.
- `chat_message_device_ciphertexts`: ciphertext pesan per perangkat recipient.
- `chat_device_keys`: public key perangkat.
- `chat_key_backups`: backup private key terenkripsi passphrase.
- `chat_message_reports`: metadata report tanpa note plaintext.
- `chat_blocks`: block relation.
- `chat_user_presence`: status online/last seen.

`chat_messages` tidak memiliki kolom `content`. Kolom yang ada:

- `id`
- `conversation_id`
- `sender_id`
- `message_type`
- `status`
- `reply_to_message_id`
- `created_at`
- `edited_at`
- `deleted_at`
- `encryption_scheme`
- `e2ee_version`

Payload pesan disimpan di `chat_message_device_ciphertexts`:

- `message_id`
- `conversation_id`
- `recipient_user_id`
- `recipient_device_id`
- `sender_device_id`
- `ciphertext`
- `nonce`
- `encrypted_message_key`
- `key_algorithm`
- `key_version`
- `created_at`

Catatan: implementasi Android saat ini mengisi `ciphertext` dan `nonce`. Kolom `encrypted_message_key` tersedia di skema untuk evolusi desain key wrapping.

### Kriptografi Android

Implementasi utama:

- `ChatE2eeCrypto.kt`
- `ChatRepository.kt`

Algoritma yang digunakan:

- Key pair perangkat: EC `secp256r1`.
- Key agreement: ECDH.
- Derivasi shared secret: SHA-256 atas hasil ECDH.
- Enkripsi payload: AES/GCM/NoPadding.
- Nonce GCM: 12 byte random.
- GCM tag: 128 bit.
- AAD: kombinasi recipient user, recipient device, dan sender device.
- Verifikasi restore backup: signature `SHA256withECDSA`.

Private key lokal:

- Key pair E2EE dibuat di client.
- Public key disimpan di Supabase `chat_device_keys`.
- Private key lokal disimpan di SharedPreferences dalam bentuk terenkripsi.
- Wrapping key private key lokal dibuat di Android Keystore dengan AES/GCM.
- Alias wrapping key memakai hash user/device.

Backup key:

- Backup private key dibuat dari private key lokal.
- Passphrase minimal 12 karakter.
- KDF: `PBKDF2WithHmacSHA256`.
- Iterasi: 210.000.
- Enkripsi backup: AES/GCM.
- Supabase hanya menyimpan `encrypted_private_key`, `salt`, `nonce`, `kdf`, `kdf_iterations`, dan metadata.
- Restore memverifikasi private key cocok dengan public key server melalui challenge signature.

### Alur Kirim Pesan

1. Client memastikan device key aktif lewat `ensureDeviceKey(userId)`.
2. Client mengambil daftar participant conversation.
3. Client mengambil active device keys setiap participant.
4. Client insert metadata pesan ke `chat_messages` dengan:
   - `encryption_scheme = 'e2ee_v1'`
   - `e2ee_version = 1`
5. Client mengenkripsi isi pesan untuk setiap recipient device.
6. Client insert ciphertext ke `chat_message_device_ciphertexts`.

Supabase RLS memastikan:

- Sender harus `auth.uid()`.
- Sender harus alumni aktif.
- Sender harus participant conversation.
- Pesan baru wajib `e2ee_v1`.
- `e2ee_version` wajib 1.
- Status awal wajib `sent`.
- Tidak boleh insert deleted message.
- Ada rate limit.
- Ada block check.

### Alur Baca Pesan

1. Client mengambil metadata pesan dari `chat_messages`.
2. Client mengambil ciphertext hanya untuk:
   - `recipient_user_id = auth.uid()`
   - `recipient_device_id = deviceId aktif`.
3. Client mengambil public key sender.
4. Client decrypt lokal dengan private key perangkat.
5. Plaintext hanya hidup di memory/UI client.
6. Cache chat detail disimpan tanpa `decryptedContent`.

### Cache Chat Lokal

Implementasi:

- `AlumniLocalCacheStore.kt`
- `ChatRepository.kt`

Chat conversations dan chat detail disimpan terenkripsi di Room cache melalui `AlumniChatCacheCipher`:

- AES/GCM/NoPadding.
- Key di Android Keystore.
- Prefix data terenkripsi: `enc:v1:`.
- TTL chat cache: 24 jam.
- Saat menyimpan chat detail, `decryptedContent` dihapus melalui `withoutDecryptedPlaintext()`.

### Direct Reply dan Offline Outbox

Implementasi:

- `MyFirebaseMessagingService.kt`
- `ChatDirectReplyReceiver.kt`
- `ChatOutboxStore.kt`
- `ChatOutboxFlush.kt`
- `ChatOutboxRetryService.kt`

Direct reply:

- Android notification memakai `NotificationCompat.MessagingStyle`.
- Reply memakai `RemoteInput`.
- Reply diterima oleh `ChatDirectReplyReceiver`.
- Receiver memanggil `chatRepository.sendMessage()`, sehingga reply tetap melewati E2EE.

Offline-first:

- Jika kirim direct reply gagal, pesan disimpan di `ChatOutboxStore`.
- Outbox disimpan di SharedPreferences private app.
- Isi outbox dienkripsi dengan Android Keystore AES/GCM.
- Retry dilakukan oleh `ChatOutboxRetryService` memakai `JobScheduler` dengan requirement network.
- Flush juga dicoba saat FCM chat diterima.

Batasan:

- Jika session Supabase tidak valid saat retry, pesan tetap menunggu sampai session valid lagi.
- Outbox berada di perangkat pengirim; jika aplikasi dihapus, outbox lokal hilang.

### Notifikasi Chat

Backend:

- Trigger `app_private.enqueue_chat_message_notification()` membuat notifikasi chat generik.
- Trigger `app_private.sanitize_chat_notification_queue()` memaksa body chat menjadi:
  - `Pesan terenkripsi baru`
  - `Pesan dihapus`
- Trigger juga menghapus key plaintext dari `notification_queue.data`: `body`, `content`, `text`, `message`, `message_content`.

Android:

- `MyFirebaseMessagingService.kt` memaksa body chat menjadi `Pesan terenkripsi baru` untuk `type = alumni_chat_message`.
- Body FCM tidak dipercaya sebagai isi pesan chat.

### Admin Monitor dan Report Chat

Admin monitor:

- `public.get_chat_admin_monitor(integer)` tidak lagi executable oleh `anon`/`authenticated`.
- Fungsi tetap ada untuk service/backend.
- Output content preview hanya:
  - `[encrypted]`
  - `[deleted]`
  - `[legacy-redacted]`

Report chat:

- `chat_message_reports.note` dikunci null.
- Trigger `app_private.sanitize_chat_message_report()` selalu mengubah note menjadi null.
- Constraint `chat_message_reports_no_plaintext_note` memastikan note tidak menyimpan teks bebas.
- Tujuannya mencegah user/admin menyalin isi pesan terenkripsi ke field report.

### Threat Model Chat

Yang dilindungi:

- Admin Supabase membaca tabel.
- Developer membaca database production.
- Notification worker melihat queue.
- Admin monitor melihat conversation.
- User non-recipient membaca ciphertext user lain.

Yang tidak dapat dicegah oleh E2EE murni:

- Developer yang sengaja merilis APK berbahaya untuk membaca plaintext sebelum enkripsi.
- Perangkat user yang sudah kompromi/root/malware.
- Screenshot atau copy manual oleh participant sah.

Kontrol tambahan yang diperlukan:

- Release signing key resmi.
- Review kode sebelum build production.
- Distribusi APK hanya dari kanal resmi.
- Audit dependency dan pipeline build.

## Fitur Forum Alumni

### Model Data

Forum alumni menggunakan tabel:

- `forum_threads`
- `forum_comments`
- `forum_reports`
- `forum_reactions`
- `forum_attachments`

Konten forum:

- `forum_threads.content` disimpan plaintext.
- `forum_comments.content` disimpan plaintext.
- `forum_reports.note` dapat menyimpan catatan report forum.

Ini sesuai fungsi forum: konten sosial yang dibaca alumni aktif dan dapat dimoderasi admin. Forum bukan fitur E2EE.

### Authorization Forum

RLS forum membatasi:

- Alumni aktif dapat membuat thread sendiri.
- Alumni aktif dapat membuat comment pada thread published dan tidak locked.
- Author dapat update/delete konten sendiri sesuai policy.
- Admin forum dapat manage thread/comment/report.
- Member forum dapat membaca konten published.

Contoh policy faktual:

- `Active alumni can create own threads`
- `Forum members can read published threads`
- `Authors can update own unlocked threads`
- `Forum admins manage all threads`
- `Active alumni can create comments`
- `Forum members can read published comments`
- `Forum admins manage all comments`
- `Active alumni can report content`
- `Forum admins manage reports`

### Offline-First Forum

Implementasi:

- `ForumRepository.kt`
- `AlumniLocalCacheStore.kt`

Forum thread list:

- `getThreads(userId)` mengambil dari Supabase dan menyimpan cache ke `AlumniLocalCacheStore`.
- `getCachedThreads(userId)` membaca cache lokal.
- TTL forum cache: 45 menit.

Catatan keamanan:

- Forum thread cache disimpan sebagai JSON biasa di Room, bukan dienkripsi khusus.
- Karena konten forum bukan E2EE dan memang untuk dibaca alumni aktif, risiko utamanya adalah akses fisik/perangkat kompromi.
- Perlindungan lokal mengandalkan sandbox aplikasi Android dan storage private app.

Attachment:

- File forum di Supabase Storage.
- Repository membuat signed URL dengan cache memory `signedUrlCache`.
- Signed URL memiliki masa berlaku berdasarkan implementasi repository.

## Fitur Wali Santri

### Model Akses

Implementasi:

- `WaliSantriRepositoryImpl.kt`
- RPC Supabase:
  - `list_wali_santri_secure`
  - `get_wali_santri_detail_secure`

Alur:

- User login sebagai wali.
- Repository mengambil user id dari Supabase session.
- Daftar santri wali diambil dari RPC secure.
- Detail santri diambil dari RPC secure dengan parameter `p_nis` dan `p_reason = android_wali_detail`.

Tujuan desain:

- Client tidak query tabel sensitif wali/santri langsung.
- Akses detail santri melewati function secure yang dapat melakukan authorization dan audit.

### Offline-First Wali Santri

Implementasi:

- `OfflineFirstCacheStore.kt`
- `WaliSantriRepositoryImpl.kt`
- Room database `alhasanah_offline.db`.
- Entity cache `alumni_cache_entries`.

Pola:

- `getMySantriList()` mencoba network RPC terlebih dahulu.
- Jika network gagal, fallback ke cache `getSantriList(userId)`.
- `getSantriByNis(nis)` mencoba network RPC terlebih dahulu.
- Jika network gagal, fallback ke cache detail terenkripsi `getSantriDetail(userId, nis)`.
- `clearSensitiveCache()` menghapus domain `santri_sensitive_detail`.

### Keamanan Cache Wali Santri

Detail sensitif:

- `saveSantriDetail()` memakai `writeEncrypted`.
- Enkripsi lokal: AES/GCM/NoPadding.
- Key: Android Keystore.
- Prefix: `enc:v1:`.
- Cache key memakai SHA-256 dari kombinasi prefix dan id.

Daftar dan aktivitas:

- `saveSantriList()`, `saveHafalanTahfidz()`, `saveHafalanKitab()`, `savePelanggaran()`, `savePerizinan()`, `saveKesehatan()`, dan `saveTagihan()` memakai `writeList`.
- `writeList` menyimpan JSON biasa di Room.
- Data tersebut tetap berada di private app storage, tetapi tidak dienkripsi khusus oleh `OfflineFirstCacheStore`.

Implikasi audit:

- Detail santri utama sudah dienkripsi lokal.
- Daftar ringkas dan aktivitas masih perlu diklasifikasi ulang jika dianggap data sangat sensitif oleh auditor.
- Jika lembaga mensyaratkan semua data santri offline terenkripsi, implementasi berikutnya adalah mengubah semua `writeList/readList` di `OfflineFirstCacheStore` menjadi encrypted untuk domain santri.

## Storage Lokal Android

Komponen:

- Room database: `alhasanah_offline.db`.
- Tabel Room: `alumni_cache_entries`.
- DataStore Preferences:
  - `offline_first_cache`
  - `alumni_local_cache`
- SharedPreferences:
  - `alumni_chat_e2ee`
  - `alumni_chat_outbox`

Enkripsi lokal yang sudah ada:

- Detail santri: AES/GCM + Android Keystore.
- Chat conversations/detail cache: AES/GCM + Android Keystore.
- Chat E2EE private key: AES/GCM wrapping key di Android Keystore.
- Chat key backup: PBKDF2 passphrase + AES/GCM sebelum upload ke Supabase.
- Chat outbox direct reply: AES/GCM + Android Keystore.

Storage lokal yang belum dienkripsi khusus:

- Forum thread list cache.
- Alumni directory/recommendation/profile cache.
- Daftar santri ringkas dan beberapa list aktivitas/tagihan di `OfflineFirstCacheStore`.
- Data tersebut tetap berada dalam app-private storage Android.

## Notification Security

Notification queue di Supabase:

- User hanya dapat melihat notifikasi miliknya.
- Admin tertentu dapat melihat/insert queue sesuai policy.
- Untuk chat, trigger sanitasi mencegah plaintext.

Android FCM:

- Untuk general notification, body ditampilkan sesuai payload.
- Untuk chat notification, body dipaksa generic di client.
- Direct reply tidak mengirim plaintext ke notification queue; reply langsung masuk jalur E2EE.

## Realtime Security

Typing indicator chat:

- Realtime topic menggunakan pola private `alumni-chat-typing:<uuid>`.
- Policy `realtime.messages` membatasi send/receive hanya participant conversation.
- Event typing tidak berisi isi chat.

Forum/chat realtime:

- Aplikasi dapat subscribe perubahan tabel.
- Data yang bisa diterima tetap dibatasi RLS Supabase.

## Audit Trail dan Admin

Untuk chat:

- Admin monitor tidak membuka isi pesan.
- Admin monitor melakukan audit insert ke `audit_logs` saat dipanggil.
- RPC monitor tidak executable oleh client biasa.

Untuk wali/santri:

- RPC detail memakai parameter reason `android_wali_detail`.
- Function secure di Supabase dapat dipakai untuk audit akses detail.

Untuk forum:

- Admin dapat moderasi konten karena forum bukan E2EE.
- Report forum menyimpan reason/note sesuai kebutuhan moderasi.

## Verifikasi Terakhir yang Sudah Dilakukan

Verifikasi chat production hardening:

- `chat_messages.content` tidak ada.
- `notification_queue` chat:
  - `non_generic_chat_bodies = 0`
  - `chat_queue_plaintext_keys = 0`
- `chat_message_reports`:
  - `reports_with_note = 0`
- ACL `public.get_chat_admin_monitor(integer)`:
  - hanya `postgres` dan `service_role`.
- ACL `public.is_chat_participant(uuid, uuid)`:
  - hanya `postgres` dan `service_role`.
- Android compile:
  - `./gradlew :app:compileDebugKotlin` sukses.

## Risiko dan Rekomendasi Produksi

### Risiko Residual

- E2EE chat tidak melindungi dari client APK yang dimodifikasi secara jahat sebelum enkripsi.
- Perangkat user yang sudah kompromi dapat membaca plaintext di UI/memory.
- Forum dan sebagian cache wali/alumni bukan E2EE.
- Beberapa advisor security Supabase masih menunjukkan isu global di luar chat, misalnya RLS disabled pada beberapa tabel non-chat, public bucket listing, dan beberapa SECURITY DEFINER function non-chat.

### Rekomendasi Prioritas

1. Terapkan release signing dan kontrol distribusi APK resmi.
2. Aktifkan review kode untuk semua perubahan pada `ChatE2eeCrypto`, `ChatRepository`, FCM, dan migration chat.
3. Enkripsi semua domain `OfflineFirstCacheStore` yang berhubungan dengan data santri jika auditor mengklasifikasikan seluruh aktivitas/tagihan sebagai data sensitif.
4. Hardening Supabase global di luar chat:
   - RLS pada semua tabel public yang exposed.
   - Review SECURITY DEFINER function.
   - Review public bucket listing.
   - Aktifkan leaked password protection Supabase Auth.
5. Tambahkan automated security regression test untuk query QA chat:
   - tidak ada `chat_messages.content`.
   - notification queue chat generic.
   - report chat note null.
   - RPC chat sensitif tidak executable oleh `anon`/`authenticated`.

## Pernyataan Desain untuk Auditor

Fitur chat alumni dirancang sebagai E2EE: isi pesan dienkripsi di client Android dan hanya ciphertext yang disimpan di Supabase. Supabase menyimpan metadata minimum untuk routing, conversation state, report, dan notifikasi. Admin/developer database tidak memiliki kolom plaintext untuk isi chat. Notifikasi chat, report chat, dan admin monitor telah disanitasi agar tidak menjadi jalur kebocoran isi pesan.

Fitur forum alumni dirancang sebagai forum termoderasi, bukan E2EE. Konten forum disimpan plaintext untuk kebutuhan baca bersama dan moderasi.

Fitur wali santri memakai akses RPC secure dan offline cache. Detail santri sensitif di cache lokal sudah dienkripsi dengan Android Keystore, sedangkan beberapa cache list masih plaintext di private app storage dan perlu disesuaikan jika kebijakan lembaga mensyaratkan enkripsi lokal penuh untuk semua data wali/santri.
