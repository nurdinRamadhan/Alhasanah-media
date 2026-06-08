# Handoff Android: Tagihan, Cicilan, Master Pembayaran

Tanggal konteks: 2026-06-08.

Dokumen ini dibuat dari perubahan di Admin Panel `alhasanahAdmin` untuk membantu Codex CLI di project Android `/home/arch-din1/Project Android/Alhasanah/alhasanahMedia/`.

Catatan ini bukan sumber kebenaran tunggal. Saat implementasi Android, gunakan skill/MCP Supabase untuk verifikasi langsung ke database dan Edge Functions sebelum mengubah kode Kotlin.

## Ringkasan Perubahan Admin/Backend

Sistem tagihan sekarang mendukung cicilan untuk SPP, listrik, kas, dan jenis pembayaran lain dari master data.

Perubahan utama:
- `tagihan_santri` tetap menjadi tabel invoice/tagihan.
- `pembayaran_tagihan` menjadi ledger cicilan per pembayaran.
- `record_tagihan_payment(...)` menjadi RPC backend untuk mencatat pembayaran tagihan secara atomik.
- Trigger menyinkronkan `tagihan_santri.sisa_tagihan` dan `tagihan_santri.status`.
- Status tagihan yang valid untuk alur ini: `BELUM`, `CICILAN`, `LUNAS`.
- Admin Panel sekarang bisa mencatat pembayaran manual sebagian.
- Midtrans bisa memproses pembayaran sebagian selama nominal tidak melebihi sisa tagihan.
- Notifikasi pembayaran sukses dan cicilan sudah dibuat dari trigger `pembayaran_tagihan`.
- Pengingat jatuh tempo H-7 sampai jatuh tempo dan overdue masuk ke `notification_queue`.

## File Supabase Relevan

Verifikasi langsung ke Supabase MCP dan bandingkan dengan folder `supabase` yang disalin ke project Android.

Migrations penting:
- `supabase/migrations/20260608050000_tagihan_installment_payments.sql`
- `supabase/migrations/20260608051000_harden_tagihan_installment_payments.sql`
- `supabase/migrations/20260608054845_allow_rois_tagihan_installments.sql`
- `supabase/migrations/20260608055710_tagihan_payment_and_due_notifications.sql`

Edge Functions penting:
- `supabase/functions/tagihan-payment-record/index.ts`
- `supabase/functions/midtrans-snap/index.ts`
- `supabase/functions/midtrans-payment/index.ts`
- `supabase/functions/midtrans-core-charge/index.ts` jika Android tetap memakai Core API route.

## Kontrak Database yang Harus Dicek Android

Tabel `tagihan_santri`:
- `id`
- `santri_nis`
- `jenis_pembayaran_id`
- `deskripsi_tagihan`
- `nominal_tagihan`
- `sisa_tagihan`
- `tanggal_jatuh_tempo`
- `status`
- `created_at`
- `updated_at`

Tabel `pembayaran_tagihan`:
- `id`
- `tagihan_id`
- `transaksi_id`
- `santri_nis`
- `wali_id`
- `recorded_by`
- `amount`
- `metode_pembayaran`
- `source`: `admin_panel`, `midtrans`, `system`
- `status`: `pending`, `posted`, `failed`, `cancelled`
- `paid_at`
- `provider_order_id`
- `provider_payload`
- `idempotency_key`
- `keterangan`
- `created_at`
- `updated_at`

Relasi yang dibutuhkan Android:
- List tagihan wali: `tagihan_santri` join `ref_jenis_pembayaran`.
- Detail cicilan: `pembayaran_tagihan` filter `tagihan_id`, hanya row milik wali terkait.

Jika RLS belum memberi wali akses baca `pembayaran_tagihan`, buat policy yang aman. Jangan membuka semua row. Verifikasi via MCP.

## Kontrak RPC

RPC:

```sql
public.record_tagihan_payment(
  p_tagihan_id uuid,
  p_amount bigint,
  p_metode_pembayaran text default 'cash',
  p_source text default 'admin_panel',
  p_provider_order_id text default null,
  p_transaksi_id uuid default null,
  p_keterangan text default null,
  p_idempotency_key text default null,
  p_provider_payload jsonb default '{}'::jsonb,
  p_recorded_by uuid default null
)
```

RPC ini saat ini hanya boleh dieksekusi service role. Android tidak boleh memanggil RPC ini langsung dari client. Android harus membuat transaksi Midtrans lewat Edge Function. Webhook `midtrans-payment` yang akan memanggil RPC dengan service role setelah pembayaran sukses.

Validasi backend:
- `amount > 0`
- tagihan ada
- tagihan belum lunas
- nominal tidak boleh lebih besar dari sisa tagihan
- idempotent via `provider_order_id` atau `idempotency_key`
- setelah insert `pembayaran_tagihan`, trigger mengubah status:
  - belum ada pembayaran posted: `BELUM`
  - sudah dibayar sebagian: `CICILAN`
  - sisa 0: `LUNAS`

## Temuan Project Android Saat Ini

File yang sudah ada dan perlu disentuh:
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/model/KeuanganModels.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/model/TagihanModel.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/model/CorePaymentModels.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/KeuanganRepository.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/KeuanganRepositoryImpl.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/keuangan/KeuanganViewModel.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/keuangan/KeuanganScreen.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/navigation/AppNavHost.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/OfflineFirstCacheStore.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/notifikasi/NotificationScreen.kt`

Kondisi saat ini:
- `TagihanStatus` sudah punya `CICILAN`.
- `TagihanWithDetail` sudah punya `sisaTagihan`.
- UI card sudah menghitung `terbayar = nominalTagihan - sisaTagihan`.
- UI belum punya input nominal cicilan.
- `KeuanganViewModel.bayarTagihan(...)` selalu mengirim `grossAmount = tagihan.sisaTagihan`.
- `midtrans-core-charge` di project Android saat ini masih menimpa `amount = cleanAmount(tagihan.sisa_tagihan)`, sehingga selalu full payment dan belum mendukung cicilan.
- Monitoring status di Android menganggap sukses hanya ketika tagihan `LUNAS`; untuk cicilan harus tetap refresh dan tampilkan status `CICILAN`, bukan menunggu sukses penuh.
- `StatusBadge` di UI saat ini belum membedakan label `CICILAN`; selain lunas/overdue/urgent akan tampil sebagai `BELUM LUNAS`.

## Perubahan Android yang Disarankan

1. Tambahkan model riwayat cicilan.

Contoh Kotlin:

```kotlin
@Serializable
data class PembayaranTagihanDto(
    @SerialName("id") val id: String,
    @SerialName("tagihan_id") val tagihanId: String,
    @SerialName("transaksi_id") val transaksiId: String? = null,
    @SerialName("santri_nis") val santriNis: String,
    @SerialName("amount") val amount: Long,
    @SerialName("metode_pembayaran") val metodePembayaran: String,
    @SerialName("source") val source: String,
    @SerialName("status") val status: String,
    @SerialName("paid_at") val paidAt: String? = null,
    @SerialName("provider_order_id") val providerOrderId: String? = null,
    @SerialName("keterangan") val keterangan: String? = null
)
```

2. Tambahkan fungsi repository:
- `fun getTagihanByNis(nis: String): Flow<List<TagihanWithDetail>>` tetap ada.
- Tambahkan `suspend fun getPembayaranTagihan(tagihanId: String): List<PembayaranTagihanDto>`.
- Query `pembayaran_tagihan` harus order `paid_at desc, created_at desc`.
- Cache tagihan harus di-refresh setelah pembayaran/cicilan agar `sisaTagihan` dan `status` terbaru muncul.

3. Update UI list/detail:
- Tampilkan `CICILAN` sebagai status visual sendiri.
- Tampilkan total, sudah dibayar, sisa tagihan, dan progress.
- Pada detail sheet, tampilkan riwayat cicilan.
- Tambahkan pilihan nominal:
  - bayar penuh
  - bayar sebagian/cicilan
  - input nominal cicilan dengan validasi `1 <= amount <= sisaTagihan`
- Jika input melebihi sisa, UI boleh auto-set ke sisa tagihan seperti Admin Panel, tetapi backend tetap wajib validasi.

4. Update request payment:
- Tambahkan `grossAmount` dari input cicilan, bukan selalu `sisaTagihan`.
- `itemDetails.price` harus sama dengan nominal yang dibayar.
- Label item bisa `Cicilan <deskripsi>` jika amount < sisa.

5. Update Edge Function `midtrans-core-charge`.

Bagian tagihan jangan menimpa requested amount menjadi full sisa. Perilaku yang diharapkan:
- Ambil `requestedAmount = cleanAmount(body.gross_amount)`.
- Query tagihan dan wali.
- Pastikan wali login adalah wali santri pemilik tagihan.
- Pastikan status bukan `LUNAS`.
- Hitung `remaining = Number(tagihan.sisa_tagihan || 0)`.
- Jika `requestedAmount > remaining`, return 400 dengan pesan `Nominal pembayaran melebihi sisa tagihan.`
- Set `amount = requestedAmount`.
- `orderId = ${tagihan.id}_${Date.now()}`.
- Insert `transaksi_keuangan` pending dengan `jumlah = amount`, `kategori = tagihan`, `tagihan_id` jika kolom tersedia, dan `midtrans_order_id = orderId`.
- Webhook `midtrans-payment` harus mencatat cicilan melalui `record_tagihan_payment`.

6. Update monitoring status:
- Untuk pembayaran cicilan, status DB setelah settlement bisa menjadi `CICILAN`.
- Jangan anggap `CICILAN` sebagai gagal.
- Setelah user cek status dan transaksi `success`, refresh tagihan lalu tampilkan info:
  - jika status `CICILAN`: pembayaran cicilan berhasil, tampilkan sisa tagihan
  - jika status `LUNAS`: pembayaran lunas

7. Update notifikasi Android:
- Event baru dari backend:
  - `tagihan.payment_installment`
  - `tagihan.payment_success`
  - `tagihan.due_reminder`
  - `tagihan.overdue_reminder`
- Routing notifikasi tetap ke halaman keuangan/tagihan santri.
- Untuk `tagihan.payment_installment`, tampilkan sisa tagihan dari `data.remaining_amount`.

## Checklist QA Android

Gunakan data test yang aman, lalu verifikasi langsung di Supabase MCP.

Skenario minimum:
- Wali membuka list tagihan, status `BELUM`, `CICILAN`, `LUNAS` tampil benar.
- Wali membuka detail tagihan dan melihat total/sudah dibayar/sisa.
- Wali membayar sebagian via Midtrans Core API.
- Setelah webhook masuk, `pembayaran_tagihan` bertambah 1 row `posted`.
- `tagihan_santri.sisa_tagihan` berkurang.
- `tagihan_santri.status` berubah menjadi `CICILAN` jika sisa masih ada.
- Wali membayar sisa tagihan.
- Status berubah menjadi `LUNAS`.
- `transaksi_keuangan` dan `detail_transaksi` tercatat.
- Notifikasi cicilan/lunas masuk ke wali.
- Input nominal melebihi sisa ditolak backend dengan pesan informatif atau dikoreksi UI sebelum request.

## Catatan Implementasi

Jangan membuat Android memanggil `record_tagihan_payment` langsung dari client karena RPC tersebut service-role only. Gunakan Edge Function untuk membuat pembayaran dan webhook Midtrans untuk posting final.

Jangan mengandalkan file ini saja. Di awal sesi Codex CLI Android, lakukan:
- baca file ini
- gunakan MCP Supabase untuk cek tabel `tagihan_santri`, `pembayaran_tagihan`, `transaksi_keuangan`, `detail_transaksi`
- cek function signature `record_tagihan_payment`
- cek isi Edge Functions `midtrans-core-charge`, `midtrans-payment`, dan jika perlu `midtrans-snap`
- jalankan build Kotlin setelah perubahan

