# Catatan Fitur Update - SMS dan Email Dompet Santri

Status: ditunda.

Alasan:

- SMS membutuhkan provider pihak ketiga dan hampir selalu berbayar.
- Email membutuhkan SMTP/provider email dan konfigurasi reputasi domain agar tidak masuk spam.
- FCM sudah berjalan dan cukup untuk fase awal karena gratis serta langsung masuk aplikasi Android.

Keputusan fase sekarang:

- Event kritis tetap dibuat di `notification_queue`.
- Event kritis tetap dikirim melalui FCM jika token perangkat tersedia.
- Event kritis ditampilkan jelas di admin panel `/dompet-operasional`, tab `Notifikasi`, dengan banner dan baris merah.
- Field seperti `sms_fallback_required` tetap disimpan sebagai penanda untuk implementasi SMS di masa depan, tetapi belum berarti SMS terkirim.

Jika nanti diaktifkan:

- Buat worker server-side khusus SMS.
- Buat worker server-side khusus email digest.
- Simpan API key provider hanya di Supabase secrets.
- Jangan menaruh kredensial SMS/email di Android atau admin panel.
- Batasi SMS hanya untuk event kritis agar biaya terkendali.
