# QA Fitur Chat Alumni E2EE - Produksi

Tanggal dokumen: 2026-05-16

Dokumen ini dipakai untuk QA fitur chat alumni sebelum rilis produksi. Fokus utama QA adalah memastikan isi chat tidak tersimpan sebagai plaintext di Supabase, tidak tampil di notifikasi server, tetap dapat dipakai offline-first, dan fitur direct reply Android tetap melewati jalur E2EE.

## Ruang Lingkup

- Fitur chat alumni direct conversation.
- E2EE payload per perangkat.
- Backup, restore, dan revoke kunci perangkat chat.
- Direct reply Android melalui `NotificationCompat.MessagingStyle` dan `RemoteInput`.
- Offline outbox untuk direct reply saat jaringan gagal.
- Trigger Supabase untuk conversation metadata dan notification queue.
- Admin monitor dan report chat tanpa isi pesan.

## Kriteria Lulus Produksi

- Supabase tidak memiliki kolom plaintext isi chat di `public.chat_messages`.
- Insert pesan baru wajib memakai `encryption_scheme = 'e2ee_v1'` dan `e2ee_version = 1`.
- Isi pesan hanya ada sebagai ciphertext di `public.chat_message_device_ciphertexts`.
- Notifikasi chat hanya memakai body generik.
- Report chat tidak menyimpan catatan bebas yang dapat berisi salinan pesan.
- Admin/developer yang melihat database hanya melihat metadata, ciphertext, dan placeholder.
- Android dapat mengirim, menerima, mendekripsi, dan membalas via notifikasi tanpa mengirim plaintext ke Supabase.
- Jika direct reply gagal karena offline/network, pesan masuk outbox lokal terenkripsi dan retry saat jaringan tersedia.

## Verifikasi Database

Jalankan query berikut di Supabase SQL editor atau MCP.

### 1. Pastikan Kolom Plaintext Sudah Tidak Ada

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'chat_messages'
order by ordinal_position;
```

Ekspektasi kolom:

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

Tidak boleh ada kolom `content`.

### 2. Pastikan Policy Insert Wajib E2EE

```sql
select policyname, cmd, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'chat_messages'
  and cmd = 'INSERT';
```

Ekspektasi:

- Policy `Chat participants can send encrypted messages`.
- `with_check` berisi `encryption_scheme = 'e2ee_v1'`.
- `with_check` berisi `e2ee_version = 1`.
- Sender harus `auth.uid()`.
- User harus alumni aktif dan participant.
- Status harus `sent`.
- `deleted_at` harus `null`.
- Ada rate limit via `app_private.has_recent_chat_message`.
- Ada block check via `app_private.is_chat_blocked`.

### 3. Pastikan Ciphertext Hanya Bisa Dibaca Recipient

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'chat_message_device_ciphertexts'
order by policyname;
```

Ekspektasi:

- SELECT policy: `recipient_user_id = auth.uid()`.
- INSERT policy: pengirim dan recipient harus participant conversation via `app_private.is_chat_participant(...)`.

### 4. Pastikan Notification Queue Chat Tidak Menyimpan Plaintext

```sql
select count(*) filter (where source_table = 'chat_messages') as chat_queue_rows,
       count(*) filter (
         where source_table = 'chat_messages'
           and body not in ('Pesan terenkripsi baru', 'Pesan dihapus')
       ) as non_generic_chat_bodies,
       count(*) filter (
         where source_table = 'chat_messages'
           and (data ?| array['body','content','text','message','message_content'])
       ) as chat_queue_plaintext_keys
from public.notification_queue;
```

Ekspektasi:

- `non_generic_chat_bodies = 0`
- `chat_queue_plaintext_keys = 0`

### 5. Pastikan Report Chat Tidak Menyimpan Catatan Plaintext

```sql
select count(*) filter (where note is not null) as reports_with_note
from public.chat_message_reports;
```

Ekspektasi:

- `reports_with_note = 0`

### 6. Pastikan RPC Chat Sensitif Tidak Terekspos ke Client Biasa

```sql
select p.proname, coalesce(array_to_string(p.proacl, E'\n'), '') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_chat_admin_monitor','is_chat_participant')
order by p.proname;
```

Ekspektasi:

- ACL hanya `postgres` dan `service_role`.
- Tidak ada `anon=X/...`.
- Tidak ada `authenticated=X/...`.

### 7. Pastikan Trigger Sanitasi Ada

```sql
select trigger_schema, event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_name in ('sanitize_chat_notification_queue','sanitize_chat_message_report')
order by event_object_table, trigger_name, event_manipulation;
```

Ekspektasi:

- `sanitize_chat_notification_queue` aktif untuk INSERT dan UPDATE pada `notification_queue`.
- `sanitize_chat_message_report` aktif untuk INSERT dan UPDATE pada `chat_message_reports`.

## QA Android

### 1. Build Verification

```bash
./gradlew :app:compileDebugKotlin
```

Ekspektasi:

- Build sukses.
- Tidak ada error Kotlin.

### 2. Kirim Pesan Normal

Langkah:

1. Login sebagai alumni A.
2. Buka chat dengan alumni B.
3. Kirim pesan teks.
4. Login sebagai alumni B di perangkat lain.
5. Buka conversation yang sama.

Ekspektasi:

- Pesan terkirim dari A.
- B dapat membaca isi pesan setelah decrypt di client.
- Di Supabase, `chat_messages` tidak berisi isi pesan.
- Di Supabase, `chat_message_device_ciphertexts` berisi ciphertext untuk recipient devices.

### 3. Kirim Pesan Multi Device

Langkah:

1. Login akun alumni B di dua perangkat.
2. Pastikan kedua perangkat memiliki device key aktif.
3. Alumni A mengirim pesan ke B.
4. Buka chat di kedua perangkat B.

Ekspektasi:

- Kedua perangkat B dapat decrypt jika masing-masing punya ciphertext.
- Jika salah satu perangkat belum punya key saat pesan dikirim, perangkat tersebut tidak bisa membaca pesan lama sampai ada mekanisme re-encryption atau pesan baru.

### 4. Backup dan Restore Kunci

Langkah:

1. Pada perangkat lama, buat backup kunci dengan passphrase minimal 12 karakter.
2. Pada perangkat baru, login akun yang sama.
3. Restore backup dengan passphrase yang benar.
4. Buka chat lama.

Ekspektasi:

- Restore berhasil jika passphrase benar dan public key cocok.
- Chat lama dapat didekripsi oleh perangkat baru setelah restore.
- Restore gagal jika passphrase salah.

### 5. Revoke Device Key

Langkah:

1. Buka UI chat.
2. Revoke current device key.
3. Coba buka chat lama.
4. Buat key baru atau login ulang sesuai flow aplikasi.

Ekspektasi:

- Device key lama memiliki `revoked_at`.
- Identitas lokal dihapus dari Android Keystore/shared preferences.
- Device yang direvoke tidak dapat menggunakan key lama sebagai identitas aktif.

### 6. Direct Reply dari Notifikasi

Langkah:

1. Pastikan permission notification Android aktif.
2. Kirim pesan dari alumni A ke alumni B.
3. Pada perangkat B, balas langsung dari notifikasi.

Ekspektasi:

- Notifikasi memakai style pesan.
- Body notifikasi menampilkan `Pesan terenkripsi baru`, bukan isi pesan.
- Reply terkirim via `ChatDirectReplyReceiver`.
- Reply masuk ke Supabase sebagai metadata di `chat_messages` dan ciphertext di `chat_message_device_ciphertexts`.

### 7. Direct Reply Offline

Langkah:

1. Pada perangkat B, matikan jaringan.
2. Balas dari notifikasi.
3. Nyalakan jaringan.
4. Tunggu retry `ChatOutboxRetryService` atau trigger flush dari FCM/chat berikutnya.

Ekspektasi:

- Reply tidak hilang.
- Pesan masuk `ChatOutboxStore` lokal.
- Outbox lokal dienkripsi dengan Android Keystore AES/GCM.
- Saat jaringan tersedia dan session masih valid, pesan dikirim ulang lewat `chatRepository.sendMessage()`.

### 8. Admin Monitor

Langkah:

1. Jalankan fungsi monitor melalui service role/admin backend bila diperlukan.
2. Cek field `content_preview`.

Ekspektasi:

- Tidak ada plaintext isi chat.
- Field preview hanya `[encrypted]`, `[deleted]`, atau `[legacy-redacted]`.
- Client biasa tidak dapat menjalankan RPC `get_chat_admin_monitor`.

## QA Negatif

### Insert Plaintext ke `chat_messages`

Percobaan:

- Insert pesan dengan kolom `content`.

Ekspektasi:

- Gagal karena kolom `content` tidak ada.

### Insert Pesan Non-E2EE

Percobaan:

- Insert `chat_messages` dengan `encryption_scheme` selain `e2ee_v1`.

Ekspektasi:

- Ditolak oleh RLS policy.

### Baca Ciphertext User Lain

Percobaan:

- User A mencoba select ciphertext dengan `recipient_user_id = user B`.

Ekspektasi:

- Tidak ada row yang bisa dibaca karena policy SELECT hanya untuk recipient sendiri.

### Notification Queue dengan Body Plaintext

Percobaan:

- Insert/update `notification_queue` untuk `source_table = 'chat_messages'` dengan body bebas dan data berisi key `message`.

Ekspektasi:

- Trigger mengganti body menjadi generic.
- Key plaintext dihapus dari `data`.

### Report Chat dengan Note

Percobaan:

- Insert/update `chat_message_reports.note` dengan teks bebas.

Ekspektasi:

- Trigger mengubah `note` menjadi `null`.
- Constraint `chat_message_reports_no_plaintext_note` menjaga note tetap null.

## File Implementasi Utama

- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/ChatRepository.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/ChatE2eeCrypto.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/ChatOutboxStore.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/fcm/MyFirebaseMessagingService.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/fcm/ChatDirectReplyReceiver.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/fcm/ChatOutboxRetryService.kt`
- `app/src/main/AndroidManifest.xml`

## Migration Terkait

- `20260516044130_harden_alumni_chat_e2ee.sql`
- `20260516050903_drop_chat_message_plaintext_content.sql`
- `20260516051002_optimize_alumni_chat_e2ee_indexes.sql`
- `20260516051210_harden_chat_participant_rpc.sql`
- `20260516052233_enforce_chat_zero_plaintext_surfaces.sql`
- `20260516052411_privatize_chat_participant_policy_helper.sql`
- `20260516052509_restrict_chat_admin_monitor_rpc.sql`

## Risiko Residual

- E2EE melindungi isi chat dari database, admin query, dan backend storage. E2EE tidak dapat mencegah developer yang mengubah APK di masa depan untuk mencuri plaintext sebelum proses enkripsi di client.
- Perlindungan rilis harus memakai review kode, signing key resmi, release pipeline terkendali, dan distribusi APK dari sumber resmi.
- Jika session Supabase sudah expired saat direct reply offline akan dikirim ulang, retry menunggu session valid kembali.
