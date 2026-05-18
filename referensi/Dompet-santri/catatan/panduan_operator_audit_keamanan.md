# Panduan Operator Audit Keamanan Dompet Santri

Dokumen ini ditujukan untuk bendahara, rois, dewan, super admin, atau operator lembaga lain yang menjalankan Dompet Santri tanpa harus memahami detail kode.

## Tujuan Halaman Audit Keamanan

Halaman `Dompet Santri -> Audit Keamanan` dipakai untuk memeriksa kesehatan sistem dompet sebelum masalah menjadi insiden besar. Halaman ini bukan tempat mengubah saldo dan bukan tempat membuat dompet.

Fungsi utamanya:

- memeriksa kondisi keamanan dengan satu klik;
- memberi skor keamanan 0-100;
- menampilkan status `Aman`, `Perlu perhatian`, `Berisiko`, atau `Kritis`;
- menunjukkan lapisan mana yang bermasalah;
- menjalankan analisis AI untuk membantu membaca temuan;
- menyimpan riwayat audit dan riwayat analisis AI.

Audit manual tetap menjadi sumber kebenaran. Analisis AI hanya membantu menjelaskan prioritas, gejala awal, risiko Android, risiko database, dan rekomendasi tindakan.

## Role Yang Boleh Mengakses

Role yang boleh membuka dan menjalankan audit:

- `super_admin`
- `bendahara`
- `rois`
- `dewan`

Role `kantin` tidak dipakai untuk audit keamanan sistem. Role `wali` hanya memakai aplikasi Android wali. Role lain ditolak.

## Istilah Yang Dipakai

`Skor keamanan`: nilai 0-100. Semakin tinggi semakin baik.

`Aman`: tidak ada temuan besar dari audit otomatis. Tetap lakukan pengawasan rutin.

`Perlu perhatian`: sistem masih bisa dipakai, tetapi ada bagian yang harus dicek operator.

`Berisiko`: ada masalah nyata yang harus ditangani sebelum operasional besar.

`Kritis`: jangan lanjutkan operasional besar sampai penyebab utama diselesaikan.

`Freeze switch`: tombol/flag pengaman global. Jika aktif, transaksi dompet baru harus ditahan.

`Rekonsiliasi`: pemeriksaan apakah total ledger sama dengan saldo cepat dompet. Ini memastikan saldo tidak menyimpang dari catatan resmi.

`Hash-chain ledger`: pemeriksaan integritas transaksi. Jika rusak, ada indikasi ledger tidak konsisten atau pernah disentuh tidak semestinya.

`Risk event`: peringatan keamanan dari aturan sistem, misalnya transaksi tidak wajar, device kantin tidak dikenal, atau pola transaksi mencurigakan.

`Dispute`: laporan wali bahwa transaksi bermasalah.

`Notifikasi kritis terbuka`: notifikasi penting yang gagal terkirim atau belum direview admin.

`Device kantin`: perangkat Android kantin yang didaftarkan dan disetujui. Device yang tidak aktif tidak boleh memproses pembayaran.

`QR opaque`: QR kartu santri hanya berisi ID acak. QR tidak boleh berisi nama, NIS, saldo, PIN, atau data pribadi.

`Argon2id`: metode hashing berat untuk PIN/verifier. Tujuannya memperlambat brute force jika data verifier bocor.

## Cara Menggunakan Halaman Audit

1. Buka menu `Dompet Santri -> Audit Keamanan`.
2. Tekan `Jalankan Audit Keamanan`.
3. Baca skor dan status utama.
4. Buka daftar temuan dan rekomendasi.
5. Jika butuh bantuan penjelasan, tekan `Analisis AI`.
6. Baca bagian `Temuan Kritis`, `Gejala Awal`, `Risiko Android`, `Risiko Database`, dan `Rekomendasi AI`.
7. Jika ada status `Kritis` atau `Berisiko`, buka juga `Dompet Santri -> Operasional & Peringatan`.
8. Tangani masalah sesuai tabel mitigasi di bawah.
9. Setelah tindakan selesai, jalankan audit ulang.
10. Simpan atau ekspor riwayat analisis bila diperlukan untuk laporan internal.

## Arti Tombol Di Halaman Audit

`Jalankan Audit Keamanan`: menjalankan pemeriksaan manual deterministik. Ini wajib dijalankan dulu.

`Analisis AI`: meminta AI membaca hasil audit manual yang sudah disanitasi. AI tidak menerima PIN, password, private key, token, ciphertext mentah, FCM token, NIS/NIK, nomor HP, alamat, atau data identitas lengkap.

`Detail`: membuka rincian lengkap satu hasil analisis AI.

`Ekspor Excel`: mengekspor riwayat analisis AI yang tampil di tabel untuk bahan rapat atau audit internal.

## Cara Membaca Lapisan Defense In Depth

`Network`: perlindungan luar seperti DDoS protection, WAF, dan konfigurasi provider hosting. Bagian ini perlu diverifikasi manual di provider.

`App`: rate limiting, idempotency, jadwal otomatis, antrean notifikasi, dan aturan operasional aplikasi.

`API`: otorisasi role, validasi device kantin, risk event, dan endpoint Edge Function.

`Database`: RLS, rekonsiliasi, freeze switch, audit log, dan larangan edit saldo langsung.

`Data`: enkripsi, hash-chain, Argon2id, QR opaque, dan integritas data sensitif.

## Mitigasi Berdasarkan Temuan

| Temuan | Arti | Tindakan Operator |
|---|---|---|
| Freeze switch aktif | Transaksi dompet sedang dikunci sistem | Jangan lanjutkan transaksi besar. Buka `Operasional & Peringatan`, cek alasan freeze, selesaikan penyebab, lalu unfreeze hanya oleh role berwenang. |
| Rekonsiliasi gagal | Saldo cepat dan ledger tidak sama | Jalankan `Cek Saldo`, baca selisih, jangan edit saldo langsung. Koreksi hanya lewat ledger resmi atau investigasi transaksi penyebab. |
| Hash-chain gagal | Integritas ledger bermasalah | Hentikan perubahan saldo, buka `Cek Ledger`, catat ledger yang rusak, eskalasi ke super admin/dewan. Jangan menghapus ledger. |
| Risk event tinggi/kritis terbuka | Ada anomali keamanan belum selesai | Buka `Peringatan Keamanan`, pilih `Tangani`, `Periksa`, `Eskalasi`, atau `Selesaikan` dengan catatan jelas. |
| Dispute lewat SLA | Laporan wali belum ditangani tepat waktu | Buka `Laporan Wali`, mulai pemeriksaan, putuskan valid/reversal/rejected. Jika reversal, sistem membuat ledger refund baru. |
| Notifikasi kritis terbuka | Event penting gagal terkirim atau belum direview | Buka tab `Notifikasi`, cek error. Jika data dummy, pilih `Data uji`; jika sudah ditangani, pilih `Selesai`; jika masih perlu dipantau, pilih `Sudah diperiksa`. |
| Device kantin tidak aktif | Ada device pending/suspended/revoked | Buka `Manajemen Kantin`, pastikan device yang boleh transaksi statusnya `active`. Cabut device yang hilang/tidak dipercaya. |
| Percobaan PIN gagal tinggi | Ada indikasi brute force atau salah input berulang | Kunci akun sementara bila perlu, hubungi wali, cek device dan waktu kejadian. |
| RLS/grant bermasalah | Ada risiko akses data lewat API publik | Jangan deploy produksi. Perbaiki policy/RLS sebelum dipakai lembaga lain. |
| QR policy tidak opaque | QR berpotensi membocorkan data | Jangan cetak kartu. Pastikan QR hanya berisi public ID acak. |
| Argon2id belum wajib | PIN/verifier belum cukup kuat | Jangan produksi. Android harus memakai Argon2id adaptif untuk verifier/PIN. |
| Cron tidak aktif | Pemeriksaan otomatis tidak berjalan | Aktifkan ulang jadwal rekonsiliasi, ledger integrity, push notification, dispute SLA, dan digest. |

## Panduan Operasional Harian

Setiap hari:

- buka `Audit Keamanan`;
- jalankan audit manual;
- jika status `Aman`, lanjutkan operasional normal;
- jika `Perlu perhatian`, buka temuan dan selesaikan yang ringan;
- jika `Berisiko` atau `Kritis`, hentikan operasional besar sampai penyebab utama diselesaikan;
- cek tab `Notifikasi` untuk event kritis terbuka;
- cek tab `Peringatan Keamanan` untuk risk event high/critical.

## Panduan Operasional Mingguan

Setiap minggu:

- ekspor riwayat analisis AI bila diperlukan;
- cek hasil hash-chain verification;
- cek hasil rekonsiliasi;
- review daftar device kantin aktif;
- cabut device yang tidak lagi digunakan;
- cek dispute yang selesai dan dispute yang masih terbuka;
- pastikan tidak ada notifikasi kritis lama yang belum direview.

## Aturan Saat Status Kritis

Jika status audit `Kritis`:

- jangan mengubah saldo langsung;
- jangan menghapus ledger;
- jangan membuat penyesuaian manual tanpa catatan;
- jangan mencetak QR baru sampai penyebab selesai bila temuan terkait QR;
- jangan memproses transaksi kantin besar sampai rekonsiliasi dan risk event selesai;
- eskalasi ke `super_admin`, `bendahara`, dan pengawas lembaga;
- setelah perbaikan, jalankan audit ulang.

## Aturan Analisis AI

AI hanya membaca data audit yang sudah disanitasi. AI tidak boleh:

- mengubah skor audit manual;
- membuka data sensitif;
- membuat transaksi;
- mengubah saldo;
- menyelesaikan dispute;
- mengaktifkan atau mencabut device kantin;
- menjadi satu-satunya dasar keputusan keuangan.

Jika saran AI bertentangan dengan hasil audit manual, gunakan audit manual sebagai sumber kebenaran dan eskalasi ke operator teknis.

## Kapan Boleh Lanjut Ke Android

Lanjut ke Android jika kondisi berikut terpenuhi:

- audit manual tidak `Kritis`;
- rekonsiliasi terakhir sukses;
- hash-chain terakhir valid;
- freeze switch tidak aktif;
- threshold persetujuan wali tetap `> Rp75.000`;
- QR policy tetap opaque;
- RLS tabel dompet aman;
- device kantin aktif sudah jelas;
- notifikasi kritis lama sudah direview;
- FCM token single-owner sudah dipakai di Android nanti melalui RPC `register_my_fcm_device`.

Jika ada notifikasi kritis gagal karena token dummy, tandai sebagai `Data uji` atau `Selesai` dengan catatan. Jangan menghapus riwayatnya.

## Manajemen Kantin Dan Pencairan

Kantin di sistem ini adalah merchant internal. Satu merchant bisa punya satu atau beberapa outlet, dan satu akun role `kantin` harus di-assign ke merchant/outlet sebelum memproses transaksi.

Urutan operasional:

1. Buat akun role `kantin`.
2. Buat `Merchant` dan `Outlet` di halaman `Manajemen Kantin`.
3. Assign akun kantin ke merchant/outlet.
4. Kantin login di Android dan mendaftarkan device.
5. Admin mengaktifkan device yang dipercaya.
6. Setelah transaksi berjalan, pantau `Saldo Merchant` dan `Ledger Merchant`.
7. Jika kantin mengajukan pencairan, bendahara/super admin memproses tab `Pencairan`.

Status pencairan:

- `Setujui untuk dibayar`: pengajuan valid dan menunggu pembayaran manual dari rekening pesantren.
- `Tandai sudah dibayar`: hanya ditekan setelah dana benar-benar dikeluarkan.
- `Tolak dan kembalikan saldo pending`: pengajuan batal dan saldo pending dikembalikan ke saldo available merchant lewat ledger baru.

Jangan mengubah saldo merchant langsung dari SQL, admin panel, atau Android. Jika ada selisih, jalankan rekonsiliasi dan catat tindak lanjut formal.

## Prosedur Darurat

Jika ada gejala transaksi kantin tidak wajar, device hilang, kasir tidak dikenal, saldo merchant tidak cocok, atau ada laporan wali yang serius:

1. Buka `Audit Keamanan` dan jalankan audit manual.
2. Jika temuan menyebut merchant/device kantin, buka `Manajemen Kantin`.
3. Tekan `Karantina` pada merchant yang dicurigai. Tulis catatan jelas.
4. Jika hanya satu perangkat bermasalah, buka audit akun kantin dan tekan `Suspend` atau `Revoke` pada device tersebut.
5. Jika ada mismatch saldo atau ledger, buka `Operasional Dompet` dan aktifkan freeze global sampai rekonsiliasi selesai.
6. Tahan semua pencairan merchant yang terkait sampai bendahara menyelesaikan investigasi.
7. Catat hasil investigasi pada risk event, rekonsiliasi, integrity check, atau dispute terkait.

Karantina merchant tidak menghapus data. Fitur ini hanya menghentikan transaksi baru dari merchant tersebut dengan men-suspend merchant, assignment akun kantin, dan device aktif terkait. Ledger, saldo, riwayat transaksi, dan bukti audit tetap tersimpan.

Perbaikan otomatis yang aman adalah pencegahan dampak lanjutan: freeze, suspend, revoke, risk event, dan notifikasi kritis. Perbaikan otomatis tidak boleh mengubah saldo atau menghapus ledger karena itu akan merusak audit keuangan.

## Catatan Untuk Lembaga Lain

Jika sistem dipakai oleh lembaga lain:

- ubah nama merchant/outlet kantin sesuai lembaga;
- daftarkan device kantin satu per satu;
- pastikan role pengguna sesuai struktur lembaga;
- lakukan simulasi top-up, pembayaran kantin, dispute, reversal, freeze, unfreeze, rekonsiliasi, dan notifikasi sebelum produksi;
- dokumentasikan siapa yang berwenang menekan tombol `Selesaikan`, `Eskalasi`, `Review`, dan `Unfreeze`;
- jangan izinkan operator umum punya akses SQL langsung ke tabel wallet.
