# Prompt Codex CLI: Migrasi Midtrans Core API Al-Hasanah Media

Gunakan dokumen ini sebagai konteks kerja saat melanjutkan perubahan pembayaran Midtrans di aplikasi Android Al-Hasanah Media dan Supabase Edge Functions.

## Tujuan

Aplikasi Android sudah dimigrasikan dari Midtrans Mobile SDK/UiKit ke Midtrans Core API melalui Supabase Edge Functions. Tujuan utama migrasi:

- Menghindari dependency Mobile SDK yang akan deprecated pada Juni 2026.
- Menampilkan instruksi pembayaran dengan UI internal bertema pesantren, bukan UI bawaan Midtrans.
- Menjaga server key Midtrans tetap di backend/Supabase, tidak pernah di Android.
- Tidak mengganggu admin panel dan alur admin yang sudah berjalan.

## Prinsip Penting

1. Jangan mengembalikan Midtrans Mobile SDK/UiKit ke Android.
2. Jangan menyimpan `MIDTRANS_SERVER_KEY` di Android.
3. `client_key`, base URL Midtrans Android, dan version catalog `midtrans = "2.5.0-SANDBOX"` memang sudah dihapus karena itu milik integrasi Mobile SDK/UiKit, bukan Core API.
4. Mode sandbox/production Core API dikontrol di Supabase Edge Function lewat environment variable:
   - `MIDTRANS_SERVER_KEY`
   - `MIDTRANS_IS_PRODUCTION=false` untuk sandbox
   - `MIDTRANS_IS_PRODUCTION=true` untuk production
5. Jangan ubah admin panel kecuali diminta eksplisit.
6. Jangan ubah Supabase function `wallet-admin-topup-create` kecuali diminta eksplisit.
7. Webhook Midtrans tetap memakai function `midtrans-payment` dan `verify_jwt=false`.

## Metode Pembayaran Yang Didukung

Android dan Supabase saat ini mendukung metode berikut:

- `qris`
- `gopay`
- `bca_va`
- `bni_va`
- `bri_va`
- `permata_va`
- `mandiri_bill`
- `alfamart`
- `indomaret`

Alfamart dan Indomaret memakai Midtrans Core API `payment_type: "cstore"`.

Catatan payload:

- Alfamart:
  - `cstore.store = "alfamart"`
  - boleh memakai `alfamart_free_text_1`, `alfamart_free_text_2`, `alfamart_free_text_3`
- Indomaret:
  - `cstore.store = "indomaret"`
  - kirim hanya field umum seperti `store` dan `message`
  - jangan kirim field khusus `alfamart_free_text_*`

## File Android Terkait

Model Core API:

- `app/src/main/java/com/alhasanah/alhasanahmedia/data/model/CorePaymentModels.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/model/WalletModels.kt`

UI pembayaran:

- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/payment/PaymentMethodSelector.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/payment/PaymentInstructionScreen.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/payment/PaymentResultScreen.kt`

Navigasi:

- `app/src/main/java/com/alhasanah/alhasanahmedia/navigation/AppNavHost.kt`

Fitur pembayaran:

- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/keuangan/KeuanganScreen.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/keuangan/KeuanganViewModel.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/donasi/DonasiScreen.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/wallet/WalletScreens.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/ui/wallet/WalletViewModels.kt`
- `app/src/main/java/com/alhasanah/alhasanahmedia/data/repository/WalletRepository.kt`

File yang memang sudah tidak boleh dipakai lagi:

- `app/src/main/java/com/alhasanah/alhasanahmedia/data/remote/midtrans/MidtransConfig.kt`
- dependency `libs.midtrans.uikit`
- version catalog `midtrans = "2.5.0-SANDBOX"`
- repository Maven Midtrans SDK di `settings.gradle.kts`

## Supabase Edge Functions

Function pembayaran umum tagihan/donasi:

- `supabase/functions/midtrans-core-charge/index.ts`
- Deployed sebagai `midtrans-core-charge`
- Current deployed version setelah migrasi cstore: `2`
- `verify_jwt=false`
- Alasan `verify_jwt=false`: donasi publik boleh dibuat tanpa login, tetapi transaksi `tagihan` tetap memvalidasi token user secara manual dan memastikan tagihan milik wali tersebut.

Function top up dompet wali:

- `supabase/functions/wallet-topup-create/index.ts`
- Deployed sebagai `wallet-topup-create`
- Current deployed version setelah migrasi cstore: `5`
- `verify_jwt=true`
- Wajib token user wali.

Function webhook Midtrans:

- `supabase/functions/midtrans-payment/index.ts`
- Deployed sebagai `midtrans-payment`
- Current known deployed version: `39`
- `verify_jwt=false`
- Jangan ubah kecuali sedang mengubah sinkronisasi status pembayaran.

Function admin yang jangan disentuh:

- `supabase/functions/wallet-admin-topup-create/index.ts`
- Deployed sebagai `wallet-admin-topup-create`
- Ini alur admin panel, bukan alur Android wali.

## Bentuk Response Core API Ke Android

Response normalisasi dari Supabase ke Android memakai field berikut:

- `order_id`
- `transaction_id`
- `payment_type`
- `method_code`
- `method_label`
- `amount`
- `status`
- `expires_at`
- `qr_url`
- `deeplink_url`
- `va_number`
- `bank`
- `biller_code`
- `bill_key`
- `permata_va_number`
- `payment_code`
- `store`

Untuk Alfamart/Indomaret, UI instruksi harus memakai:

- `payment_code` sebagai kode pembayaran di kasir
- `store` sebagai nama gerai
- `amount` sebagai nominal yang harus dibayar

## Verifikasi Yang Sudah Dilakukan

Perintah ini sudah sukses setelah perubahan Android:

```bash
./gradlew :app:compileDebugKotlin
```

Deploy Supabase CLI lokal pernah gagal di environment ini dengan `SIGILL`, jadi deploy dilakukan memakai MCP Supabase `deploy_edge_function`.

## Checklist Saat Melanjutkan

Sebelum mengubah pembayaran:

1. Cari referensi lama dengan `rg "Midtrans|UiKit|snap_token|midtrans_snap_token|client_key|2.5.0-SANDBOX"`.
2. Pastikan tidak mengembalikan SDK Mobile Midtrans.
3. Pastikan perubahan Android tetap compile dengan `./gradlew :app:compileDebugKotlin`.
4. Jika mengubah Edge Function, deploy ulang lewat MCP Supabase.
5. Setelah deploy, cek `list_edge_functions` untuk memastikan version aktif berubah.
6. Jangan ubah admin panel atau function admin topup kecuali diminta eksplisit.

## Catatan Implementasi UI

UI pembayaran internal harus tetap menampilkan instruksi yang jelas:

- QRIS: tampilkan QR dari `qr_url`.
- GoPay: tampilkan tombol/deeplink jika `deeplink_url` tersedia.
- VA: tampilkan nomor VA.
- Mandiri Bill: tampilkan `biller_code` dan `bill_key`.
- Alfamart/Indomaret: tampilkan `payment_code`, gerai, nominal, dan instruksi ke kasir.

Jangan membuka WebView/Snap UI untuk alur Core API ini.

