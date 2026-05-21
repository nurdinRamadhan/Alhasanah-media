# PANDUAN PRODUK AL-HASANAH MEDIA
## Buku Panduan Operasional Admin Panel dan Aplikasi Android

**Versi dokumen:** 2.0  
**Tanggal pembaruan:** 20 Mei 2026  
**Minimum Android:** Android 10.0 (API 29)  
**Ditujukan untuk:** Admin panel non teknis, wali santri, alumni, kantin, bendahara, kesantrian, dewan, dan pengurus pesantren

---

## 1. Ringkasan Sistem

AL-HASANAH MEDIA adalah sistem digital terpadu untuk membantu pengelolaan Pondok Pesantren Al-Hasanah. Sistem ini terdiri dari dua sisi utama:

1. **Admin Panel** untuk pengurus pesantren. Admin panel dipakai untuk mengelola data santri, data EMIS, pembayaran, keuangan, tahfidz, hafalan kitab, perizinan, kesehatan, pelanggaran, alumni, forum, RAG Knowledge Base, notifikasi, inventaris, diklat, ulangan, audit log, dan operasional Dompet Santri.
2. **Aplikasi Android** untuk wali santri, alumni, dan kantin. Android bukan aplikasi admin. Untuk wali santri, fitur profil santri, hafalan, pelanggaran, perizinan, kesehatan, tagihan, dan berita bersifat baca/pantau. Aksi tulis Android hanya ada pada area tertentu: pembayaran/tagihan/donasi, Dompet Santri, transaksi kantin, notifikasi perangkat, dan fitur komunitas alumni.

Tujuan utama sistem adalah membuat administrasi pesantren lebih rapi, aman, transparan, dan mudah dipantau tanpa menghilangkan kontrol pengurus pesantren.

### 1.1 Batas Wewenang Android Berdasarkan Kode Saat Ini

Kode Android menunjukkan pemisahan yang jelas antara aplikasi wali/alumni/kantin dan Admin Panel:

- **Wali santri di Android membaca data santri.** Daftar santri dan detail santri diambil melalui RPC aman `list_wali_santri_secure` dan `get_wali_santri_detail_secure`. Tidak ada form Android untuk admin menginput data santri.
- **Aktivitas santri bersifat read-only.** Hafalan tahfidz, hafalan kitab, pelanggaran, perizinan, dan kesehatan di Android hanya memakai operasi baca dari tabel terkait lalu disimpan ke cache lokal.
- **Keuangan wali bersifat pantau dan bayar.** Wali melihat tagihan, membayar tagihan melalui Midtrans, dan dapat melakukan donasi. Pencatatan tagihan dan koreksi transaksi tetap urusan Admin Panel/backend.
- **Dompet Santri adalah pengecualian utama untuk wali.** Wali dapat aktivasi dompet, membuat PIN, top up, mengatur limit, approval transaksi besar, dan membuat dispute.
- **Kantin Android dipakai untuk transaksi merchant.** Role kantin dapat mendaftarkan perangkat, scan QR/NFC, membuat otorisasi pembayaran, konfirmasi PIN santri sesuai alur, melihat riwayat kantin, dan mengajukan settlement.
- **Alumni Android memang interaktif.** Alumni dapat registrasi, mengubah profil, follow, membuat posting forum, komentar, reaction, report, chat E2EE, backup/restore key, mute/archive/block, dan pengaturan profil.
- **Admin bekerja dari Admin Panel.** Input santri, EMIS, tahfidz, pelanggaran, perizinan, kesehatan, tagihan, berita, notifikasi, alumni verification, moderasi, audit, merchant setup, dan settlement admin dilakukan dari Admin Panel atau backend resmi, bukan dari Android wali.

---

## 2. Prinsip Keamanan yang Wajib Dipahami Admin

Bagian ini diletakkan di awal karena sistem sekarang menyimpan data pribadi, data keuangan, riwayat santri, dan transaksi dompet. Admin tidak perlu memahami seluruh istilah teknis, tetapi wajib memahami aturan operasionalnya.

### 2.1 Data Sensitif Tidak Boleh Disebar

Data berikut termasuk sensitif:

- Identitas santri, wali, alumni, dan pegawai.
- Nomor identitas, alamat, nomor telepon, email, data keluarga, dan data EMIS.
- Data kesehatan, pelanggaran, perizinan, nilai, tagihan, transaksi, dan saldo dompet.
- Bukti pembayaran, bukti pencairan kantin, laporan audit, dan data perangkat.
- Isi chat alumni. Khusus chat alumni, sistem dirancang agar admin tidak membaca isi chat biasa.

Aturan untuk admin:

1. Jangan mengunduh atau membagikan data santri/alumni ke pihak yang tidak berwenang.
2. Jangan mengambil screenshot data sensitif kecuali untuk keperluan resmi.
3. Jangan membagikan akun admin.
4. Jangan memakai akun super admin untuk pekerjaan harian jika role yang lebih terbatas sudah cukup.
5. Jika diminta membuka data sensitif, pastikan ada alasan operasional yang jelas.

### 2.2 Hak Akses Berdasarkan Role

Sistem memakai pembatasan akses berdasarkan role. Role yang umum digunakan:

- **super_admin:** akses pengelolaan penuh, termasuk konfigurasi, audit, dan tindakan darurat.
- **rois:** akses pengawasan dan operasional tingkat tinggi.
- **dewan:** akses pemantauan, terutama read-only. Dewan tidak digunakan untuk input/edit data harian.
- **kesantrian:** mengelola data santri, pelanggaran, perizinan, kesehatan, tahfidz, hafalan kitab, ulangan, alumni, berita, dan moderasi.
- **bendahara:** mengelola tagihan, transaksi, pengeluaran, dan laporan keuangan. Bendahara tidak mengubah data inti santri kecuali sesuai izin.
- **kantin:** akun merchant kantin di Android, bukan akun wali dan bukan akun alumni.
- **wali:** melihat data anaknya sendiri melalui Android.
- **alumni:** memakai forum, direktori, profil, dan chat alumni setelah diverifikasi.

### 2.3 RLS dan Audit Log

Backend memakai Supabase dengan Row Level Security (RLS). Artinya, walaupun data ada di database yang sama, user hanya boleh melihat data yang sesuai haknya.

Setiap tindakan penting harus tercatat di audit log, terutama:

- Membuat, mengubah, atau membuka data santri sensitif.
- Validasi dan ekspor EMIS.
- Mengubah status alumni.
- Moderasi forum.
- Membuat tagihan atau mencatat transaksi.
- Mengelola Dompet Santri, perangkat kantin, risiko, dispute, rekonsiliasi, dan settlement.
- Mengirim notifikasi massal.

Admin tidak boleh menghapus audit log.

### 2.4 Offline-First dan Cache Lokal

Aplikasi Android memakai pola offline-first pada beberapa fitur. Artinya, data tertentu bisa tetap terlihat ketika koneksi tidak stabil karena tersimpan sementara di perangkat.

Yang perlu diketahui admin:

- Detail santri sensitif di cache Android dilindungi dengan Android Keystore dan AES/GCM.
- Cache chat alumni disimpan terenkripsi dan tidak menyimpan isi chat dalam bentuk plaintext.
- Beberapa daftar ringkas dapat tersimpan di private storage aplikasi untuk kenyamanan akses.
- Jika perangkat hilang, akun harus segera diamankan melalui proses reset sesi/perangkat.

### 2.5 Enkripsi, E2EE, Ed25519, Argon2id, dan AES-256

Istilah penting yang sering muncul:

- **AES-256/AES-GCM:** enkripsi untuk melindungi data lokal atau data rahasia.
- **E2EE:** end-to-end encryption. Isi chat alumni dienkripsi di perangkat, bukan di server.
- **Ed25519:** tanda tangan digital untuk membuktikan bahwa instruksi tertentu benar berasal dari perangkat yang sah. Ed25519 bukan enkripsi.
- **Argon2id:** proses pengamanan PIN Dompet Santri agar PIN tidak disimpan sebagai teks biasa.
- **Nonce:** angka/kode unik sekali pakai agar transaksi tidak bisa diulang.
- **Signature:** bukti digital dari perangkat sah, dipakai terutama pada dompet dan kantin.

Aturan praktis:

1. PIN Dompet Santri tidak boleh diminta lewat chat, telepon, WhatsApp, atau dicatat manual.
2. QR/NFC kartu santri hanya berisi identifier publik, bukan saldo, PIN, NIS, nomor HP, atau data pribadi.
3. Admin tidak boleh mengubah saldo dompet langsung di database.
4. Mutasi saldo hanya sah jika melalui workflow resmi dan ledger.
5. Isi chat alumni tidak boleh dipaksa dibuka dari database karena sistem memang dirancang E2EE.

### 2.6 Catatan Validasi Backend Terakhir

Validasi Supabase pada 20 Mei 2026 menunjukkan sebagian besar tabel aplikasi sudah memakai RLS, termasuk tabel santri, keuangan, alumni, chat, forum, notifikasi, dan wallet. Catatan keamanan yang masih perlu dipantau oleh tim teknis:

- Tabel PostGIS `public.spatial_ref_sys` masih terdeteksi tanpa RLS oleh advisor Supabase.
- Extension PostGIS masih berada di schema public.
- Beberapa function `SECURITY DEFINER` masih terdeteksi dapat dieksekusi oleh role tertentu. Sebagian function memang dipakai untuk RPC aman, tetapi tetap perlu review berkala.
- Leaked password protection Supabase Auth masih terdeteksi belum aktif.

Catatan ini bukan langkah kerja harian admin non teknis, tetapi menjadi pengingat untuk audit keamanan berkala.

---

## 3. Login, Akun, dan Navigasi

### 3.1 Login Admin Panel

Admin masuk memakai email dan kata sandi yang sudah dibuat oleh super admin. Setelah masuk, menu yang terlihat akan mengikuti role masing-masing.

Cara kerja:

1. Buka alamat Admin Panel.
2. Masukkan email dan kata sandi.
3. Sistem memeriksa role akun.
4. Admin hanya melihat menu yang sesuai hak aksesnya.

Jika lupa kata sandi, hubungi super admin. Jangan membuat akun pengganti tanpa mencatat alasan operasional.

### 3.2 Login Android

Pengguna Android masuk sesuai jenis akun:

- Wali santri masuk untuk memantau data anak, tagihan, notifikasi, pembayaran, dan Dompet Santri. Wali tidak menginput data kesantrian atau data akademik.
- Alumni masuk untuk forum, direktori, profil, dan chat setelah status alumni aktif.
- Kantin masuk dengan role kantin untuk transaksi merchant.
- Pengguna umum dapat memakai fitur publik seperti Al-Quran, berita, dan Tanya AI publik jika tersedia.

### 3.3 Navigasi Utama Android

Menu Android mencakup:

- Beranda
- Tanya AI
- Al-Quran
- Berita
- Profil Santri
- Progres Hafalan
- Hafalan Kitab
- Catatan Kedisiplinan
- Rekam Medis
- Izin Santri
- Tagihan dan SPP
- Dompet Santri
- Kantin Merchant khusus role kantin
- Donasi
- Forum Alumni, Chat, Notifikasi, Profil, dan Direktori Alumni

---

## 4. Dashboard dan Profil Pesantren

### 4.1 Dashboard

Dashboard adalah halaman ringkasan untuk memantau kondisi umum pesantren. Informasi yang biasanya dipantau:

- Jumlah santri dan status aktif.
- Ringkasan tagihan dan transaksi.
- Aktivitas terbaru.
- Notifikasi atau pekerjaan yang perlu ditindaklanjuti.
- Akses cepat ke modul penting.

Admin sebaiknya membuka dashboard setiap awal hari kerja untuk melihat apakah ada data yang perlu ditangani.

### 4.2 Profil Pesantren

Menu Profil Pesantren berisi data instansi seperti nama lembaga, alamat, kontak, identitas resmi, dan informasi kelembagaan.

Aturan:

- Ubah hanya jika ada perubahan resmi.
- Pastikan data konsisten dengan dokumen legal pesantren.
- Jika digunakan untuk dokumen, kwitansi, atau laporan, cek kembali sebelum disimpan.

---

## 5. Manajemen Admin dan Hak Akses

Menu Manajemen Admin dipakai untuk membuat dan mengelola akun pengurus.

Workflow:

1. Super admin membuka **Manajemen Admin**.
2. Buat akun baru dengan email yang benar.
3. Pilih role sesuai tugas orang tersebut.
4. Simpan.
5. Berikan instruksi login kepada pemilik akun melalui jalur aman.

Aturan:

- Jangan memakai satu akun bersama.
- Jangan memberikan role super_admin jika tidak diperlukan.
- Saat petugas pindah tugas atau berhenti, akun harus dinonaktifkan atau role diturunkan.
- Aktivitas admin dapat ditelusuri melalui audit log.

---

## 6. Data Santri dan Kepatuhan EMIS

### 6.1 Fungsi Modul Data Santri

Modul Data Santri adalah pusat identitas resmi santri. Data ini dipakai oleh banyak modul lain: keuangan, pelanggaran, kesehatan, perizinan, hafalan, Dompet Santri, notifikasi wali, dan laporan EMIS.

Data santri harus rapi karena satu kesalahan bisa memengaruhi banyak laporan.

### 6.2 Data yang Perlu Dijaga

Admin perlu memastikan data berikut benar:

- NIS dan identitas santri.
- Nama lengkap sesuai dokumen resmi.
- Jenis kelamin sesuai standar EMIS: L atau P.
- Tempat dan tanggal lahir.
- Alamat lengkap.
- Data ayah, ibu, wali, pekerjaan, pendidikan, dan status keluarga.
- Kelas, jurusan, angkatan, status aktif, dan status mukim.
- Data kebutuhan EMIS seperti referensi pendidikan, pekerjaan, penghasilan, hubungan wali, dan data administratif lain.

### 6.3 Workflow Input Santri Baru

1. Buka **Data Santri**.
2. Pilih **Tambah**.
3. Isi identitas utama.
4. Isi data keluarga dan wali.
5. Isi data akademik/pesantren.
6. Periksa kolom yang wajib untuk EMIS.
7. Simpan.
8. Jika foto diperlukan, gunakan fitur upload foto santri.
9. Pastikan wali terhubung ke akun yang benar.

### 6.4 Validasi EMIS

Sistem memiliki fungsi validasi santri EMIS dan ekspor santri EMIS.

Workflow validasi:

1. Pilih santri atau filter status/tahun masuk.
2. Jalankan validasi EMIS.
3. Perbaiki data yang ditandai belum sesuai.
4. Jalankan ulang validasi sampai tidak ada kesalahan penting.
5. Ekspor data jika sudah siap.

Aturan:

- Jangan mengubah kode referensi EMIS sembarangan.
- Gunakan pilihan resmi yang sudah tersedia di sistem.
- Jika pilihan tidak ditemukan, catat dan eskalasikan ke tim teknis atau operator EMIS.
- Simpan bukti ekspor sesuai kebijakan pesantren.

### 6.5 Persebaran Santri

Menu Persebaran Santri membantu melihat asal wilayah santri. Modul ini memakai data alamat/geocoding.

Kegunaan:

- Membaca sebaran wilayah wali/santri.
- Membantu laporan internal.
- Membantu perencanaan komunikasi wilayah.

Pastikan alamat santri ditulis lengkap agar peta dan rekap lebih akurat.

---

## 7. Kesantrian: Pelanggaran, Perizinan, dan Kesehatan

### 7.1 Pelanggaran Santri

Modul Pelanggaran mencatat kejadian kedisiplinan.

Workflow:

1. Buka **Pelanggaran**.
2. Pilih santri.
3. Isi tanggal kejadian.
4. Isi jenis pelanggaran, poin, catatan, dan tindak lanjut.
5. Simpan.
6. Wali dapat menerima notifikasi jika kebijakan notifikasi aktif.

Aturan:

- Tulis fakta, bukan opini.
- Hindari bahasa yang merendahkan.
- Jika ada koreksi, edit sesuai prosedur dan biarkan audit log mencatat perubahan.

### 7.2 Perizinan Santri

Modul Perizinan mencatat izin keluar/masuk santri.

Workflow:

1. Buka **Perizinan**.
2. Pilih santri.
3. Isi tanggal keluar, tanggal kembali, tujuan, alasan, dan penanggung jawab.
4. Pilih status: menunggu, disetujui, ditolak, atau selesai sesuai alur.
5. Simpan.

Yang perlu dipantau:

- Santri yang belum kembali.
- Izin yang melewati waktu.
- Riwayat izin berulang.
- Persetujuan pengasuh atau pihak terkait.

### 7.3 Kesehatan (UKS)

Modul Kesehatan mencatat riwayat medis ringan, pemeriksaan, tindakan UKS, dan catatan perawatan.

Workflow:

1. Buka **Kesehatan (UKS)**.
2. Pilih santri.
3. Isi keluhan, tanggal, tindakan, obat bila ada, dan rekomendasi.
4. Simpan.
5. Jika perlu, wali dapat diberi notifikasi.

Aturan:

- Data kesehatan adalah data sensitif.
- Jangan membagikan catatan kesehatan tanpa alasan resmi.
- Jika kasus serius, gunakan jalur komunikasi resmi selain catatan sistem.

---

## 8. Tahfidz Quran dan Hafalan Kitab

### 8.1 Ziyadah atau Hafalan Baru

Modul Ziyadah mencatat setoran hafalan Al-Quran baru.

Workflow:

1. Buka **Tahfidz Quran > Ziyadah**.
2. Pilih santri.
3. Isi surah, ayat, juz, tanggal, pembimbing, dan nilai.
4. Tambahkan catatan jika diperlukan.
5. Simpan.

Data ini akan terlihat di Android wali sebagai progres hafalan.

Di Android wali, progres hafalan hanya ditampilkan untuk pemantauan. Wali tidak menginput, mengedit, atau menghapus data hafalan.

### 8.2 Murojaah atau Hafalan Ulang

Modul Murojaah mencatat pengulangan hafalan.

Workflow:

1. Buka **Tahfidz Quran > Murojaah**.
2. Pilih santri.
3. Isi bagian yang diulang, kualitas, tanggal, dan catatan.
4. Simpan.

Murojaah membantu wali dan pembimbing memahami kestabilan hafalan, bukan hanya jumlah hafalan baru.

Di Android wali, murojaah juga bersifat baca saja.

### 8.3 Hafalan Kitab

Modul Hafalan Kitab mencatat progres hafalan kitab pesantren.

Workflow:

1. Buka **Hafalan Kitab**.
2. Pilih santri.
3. Pilih kitab atau materi.
4. Isi bagian hafalan, tanggal, nilai, pembimbing, dan catatan.
5. Simpan.

Di Android wali, hafalan kitab hanya ditampilkan sebagai riwayat dan ringkasan progres.

---

## 9. Akademik, Ulangan Mingguan, dan Nilai

### 9.1 Laporan Nilai

Modul Akademik dipakai untuk melihat atau mengelola nilai santri sesuai struktur yang tersedia.

Admin perlu memastikan:

- Mata pelajaran benar.
- Santri benar.
- Nilai tidak tertukar.
- Periode penilaian jelas.

### 9.2 Ulangan Mingguan

Modul Ulangan Mingguan terdiri dari:

- Bank dan buat ulangan.
- Arsip dan nilai.

Workflow umum:

1. Buat bank soal atau materi ulangan.
2. Susun ulangan mingguan.
3. Setelah ulangan selesai, lihat arsip dan nilai.
4. Gunakan hasil untuk evaluasi pembelajaran.

---

## 10. Keuangan, SPP, dan Riwayat Transaksi

### 10.1 Keuangan dan SPP

Modul Keuangan digunakan untuk membuat, memantau, dan memperbarui tagihan santri.

Di Admin Panel, bendahara atau admin berwenang membuat dan memperbarui tagihan. Di Android wali, tagihan hanya ditampilkan untuk dipantau dan dibayar. Wali tidak membuat tagihan, mengedit nominal, atau mengubah status lunas secara manual.

Workflow membuat tagihan:

1. Buka **Keuangan & SPP**.
2. Pilih **Tambah Tagihan**.
3. Pilih santri atau kelompok santri.
4. Pilih jenis pembayaran.
5. Isi nominal, jatuh tempo, dan keterangan.
6. Simpan.
7. Wali dapat melihat tagihan di Android.

### 10.2 Pembayaran Digital

Aplikasi memakai Midtrans untuk pembayaran digital seperti SPP, tagihan, donasi, dan top up Dompet Santri.

Alur umum:

1. Wali memilih tagihan di Android.
2. Sistem membuat order pembayaran.
3. Wali membayar melalui kanal Midtrans.
4. Webhook Midtrans memverifikasi status pembayaran.
5. Sistem mencatat transaksi.
6. Status tagihan berubah sesuai hasil pembayaran.

Admin tidak perlu mengubah status pembayaran digital secara manual kecuali ada prosedur koreksi resmi.

Di Android, aksi wali pada modul ini terbatas pada membuka detail tagihan, memulai pembayaran Midtrans, memantau status pembayaran, dan melakukan donasi bila fitur donasi dibuka.

### 10.3 Riwayat Transaksi

Menu Riwayat Transaksi dipakai untuk memantau transaksi yang sudah tercatat.

Yang perlu dicek:

- Nominal.
- Tanggal.
- Santri terkait.
- Jenis pembayaran.
- Status transaksi.
- Nomor order atau referensi.

Jika ada pembayaran belum masuk, cek status Midtrans dan log sebelum membuat koreksi.

### 10.4 Pengeluaran

Modul Pengeluaran dipakai bendahara untuk mencatat biaya operasional.

Aturan:

- Isi kategori dan keterangan yang jelas.
- Simpan bukti sesuai kebijakan internal.
- Jangan mencampur pengeluaran pesantren, tagihan santri, dan saldo kantin tanpa pencatatan yang jelas.

---

## 11. Dompet Santri

Dompet Santri adalah sistem keuangan internal tertutup. Dompet ini bukan e-wallet umum dan tidak boleh diperlakukan seperti saldo bebas.

### 11.1 Prinsip Utama Dompet Santri

- Closed-loop: saldo hanya berlaku di ekosistem pesantren.
- Tidak ada transfer bebas antar pengguna.
- Tidak ada cash-out publik oleh santri atau wali.
- Admin tidak membuat dompet atas nama wali.
- Wali mengaktifkan dompet dari Android.
- Dompet adalah salah satu area Android wali yang bersifat aktif, bukan hanya baca.
- Semua perubahan saldo harus melalui ledger resmi.
- Saldo tidak boleh diedit langsung.
- Semua aksi penting masuk audit log.

### 11.2 Aktivasi Dompet oleh Wali

Workflow:

1. Wali membuka menu **Dompet Santri** di Android.
2. Jika dompet belum aktif, wali memilih **Aktifkan Dompet**.
3. Wali menyetujui syarat penggunaan.
4. Android membuat key dan data keamanan perangkat.
5. Wali membuat PIN santri.
6. PIN diproses dengan Argon2id dan tidak dikirim sebagai plaintext.
7. Backend membuat akun dompet, perangkat, dan QR/token kartu.
8. Dompet aktif dan siap menerima top up.

Admin hanya memantau dan membantu jika terjadi masalah. Admin tidak boleh membuat dompet langsung untuk wali.

Catatan batas fitur: walaupun wali dapat mengaktifkan dompet dan membuat PIN, wali tetap tidak dapat mengubah saldo langsung. Saldo hanya berubah dari top up berhasil, transaksi kantin, refund/koreksi resmi, atau proses ledger lain yang sah.

### 11.3 Top Up Dompet

Ada dua jalur top up:

1. **Top up wali dari Android.** Wali memilih nominal dan membayar melalui Midtrans.
2. **Top up titipan admin.** Bendahara/super admin membuat sesi pembayaran untuk penyetor pihak ketiga, misalnya keluarga lain.

Alur top up:

1. Sistem membuat payment intent.
2. Midtrans membuat transaksi.
3. Setelah pembayaran berhasil, webhook memverifikasi nominal dan status.
4. Ledger dompet mencatat kredit saldo.
5. Saldo cached di `dompet_santri` bertambah dari posting ledger resmi.

Admin tidak boleh menambah saldo dengan mengedit kolom saldo.

### 11.4 Limit Dompet

Wali dapat mengatur limit penggunaan dompet anak dari Android. Limit melindungi santri dari transaksi berlebihan.

Limit yang umum dipantau:

- Limit harian.
- Limit per transaksi.
- Transaksi besar yang membutuhkan approval wali.
- Status dompet: aktif, terkunci, ditahan, atau ditutup.

Admin boleh melihat ringkasan limit untuk audit. Perubahan limit atas nama wali hanya boleh melalui prosedur recovery resmi.

Limit adalah pengaturan dompet oleh wali. Ini berbeda dari data kesantrian yang tetap read-only di Android wali.

### 11.5 Pembayaran Kantin

Pembayaran kantin memakai QR/NFC kartu santri dan perangkat kantin Android.

Workflow:

1. Akun kantin login di Android dengan role kantin.
2. Perangkat kantin harus terdaftar dan aktif.
3. Kantin memasukkan nominal belanja.
4. Kantin scan QR/NFC kartu santri.
5. QR/NFC hanya berisi identifier publik.
6. Sistem membuat authorization session dengan nonce dan challenge.
7. Untuk nominal kecil, santri memasukkan PIN pada perangkat kantin sesuai kebijakan.
8. Untuk nominal besar, transaksi membutuhkan approval wali.
9. Backend memvalidasi perangkat, role, saldo, limit, nonce, signature, dan status akun.
10. Jika valid, ledger dompet mencatat debit santri dan ledger merchant mencatat kredit kantin.
11. Wali menerima notifikasi sesuai kebijakan.

Aturan:

- PIN harus ditutup/masked.
- PIN tidak boleh dicatat oleh petugas kantin.
- Perangkat kantin tidak boleh dipakai bersama tanpa kontrol akun.
- Jika perangkat hilang, segera revoke device.

### 11.6 Manajemen Kantin Merchant

Admin panel dan backend mendukung struktur merchant:

- Merchant kantin.
- Outlet kantin.
- User kantin.
- Perangkat kantin.
- Saldo merchant internal.
- Ledger merchant.
- Pengajuan pencairan.

Workflow menyiapkan kantin:

1. Buat akun user dengan role kantin.
2. Buat data merchant kantin.
3. Buat outlet jika diperlukan.
4. Assign user kantin ke merchant/outlet.
5. Kantin login di Android.
6. Kantin mendaftarkan perangkat.
7. Admin mengaktifkan perangkat.
8. Jika tersedia, admin menjalankan proses **Siapkan Otomatis** untuk memastikan merchant, outlet, user, dan device siap.

### 11.7 Pencairan Saldo Kantin

Saldo kantin adalah saldo internal hasil penjualan. Dana eksternal tetap masuk ke rekening pesantren/Midtrans utama, lalu pencairan ke kantin diproses oleh bendahara.

Workflow:

1. Kantin mengajukan pencairan dari Android.
2. Bendahara/super admin memeriksa pengajuan.
3. Bendahara memeriksa saldo merchant dan ledger.
4. Jika valid, bendahara melakukan transfer manual sesuai kebijakan.
5. Admin menandai settlement sebagai paid.
6. Bukti transfer diunggah/diarsipkan.
7. Semua langkah masuk audit log.

Jika pengajuan tidak valid, admin menolak atau meminta review dengan alasan yang jelas.

### 11.8 Dispute, Risiko, dan Rekonsiliasi

Dompet Santri memiliki pengamanan tambahan:

- Wallet audit logs.
- Risk events.
- Reconciliation runs.
- Ledger integrity runs.
- Dispute transaction.
- System freeze untuk kondisi darurat.
- AI security auditor untuk analisis keamanan wallet.

Workflow dispute:

1. Wali atau sistem menandai transaksi bermasalah.
2. Admin membuka data dispute.
3. Admin mulai investigasi.
4. Admin memeriksa ledger, merchant, perangkat, waktu, dan notifikasi.
5. Admin menyelesaikan dispute sesuai hasil pemeriksaan.
6. Jika ada koreksi, gunakan prosedur koreksi ledger resmi.

Aturan:

- Jangan menghapus transaksi dompet.
- Jangan mengubah ledger lama.
- Koreksi harus berbentuk transaksi baru yang menjelaskan alasan koreksi.
- Jika ada mismatch rekonsiliasi, sistem dapat dibekukan sampai masalah selesai.

---

## 12. Alumni, Forum, Direktori, dan Chat E2EE

### 12.1 Registrasi Alumni

Alumni dapat mendaftar dari Android. Data registrasi perlu diverifikasi oleh admin.

Berbeda dari fitur wali santri yang mayoritas baca saja, fitur alumni di Android memang dibuat interaktif setelah akun alumni diverifikasi.

Workflow:

1. Alumni mengisi form pendaftaran.
2. Admin membuka **Manajemen Alumni**.
3. Periksa nama, angkatan, kontak, dan informasi pendukung.
4. Setujui jika valid.
5. Setelah aktif, alumni dapat memakai forum, direktori, profil, follow, dan chat.

### 12.2 Direktori dan Profil Alumni

Direktori alumni membantu alumni menemukan teman, melihat profil, dan membangun jaringan.

Alumni dapat memperbarui profilnya sendiri dari Android sesuai field yang disediakan. Admin tetap bertugas memverifikasi status alumni dan menangani penyalahgunaan.

Admin perlu memastikan:

- Profil palsu tidak disetujui.
- Data yang tidak pantas dapat dimoderasi.
- Alumni nonaktif tidak mendapat akses komunitas.

### 12.3 Forum Alumni

Forum alumni adalah forum termoderasi, bukan E2EE. Artinya, konten thread dan komentar dapat dibaca dan dimoderasi oleh admin yang berwenang.

Fitur forum:

- Membuat thread.
- Memberi komentar.
- Love/reaction.
- Follow alumni.
- Rekomendasi alumni.
- Report konten.
- Moderasi thread/comment.
- Lock, pin, hide, atau tindakan lain sesuai hak admin.

Catatan: aksi membuat thread, komentar, reaction, follow, dan report dilakukan alumni dari Android. Aksi moderasi seperti lock, pin, hide, atau tindakan admin hanya untuk user yang memiliki hak forum admin sesuai RLS/role.

Workflow moderasi:

1. Buka **Moderasi Forum Alumni**.
2. Periksa laporan.
3. Buka thread/comment terkait.
4. Tentukan tindakan: abaikan, edit status, sembunyikan, kunci, atau tindak lanjuti.
5. Catat alasan jika diperlukan.

### 12.4 Chat Alumni E2EE

Chat alumni memakai E2EE. Admin tidak membaca isi chat dari database. Server hanya menyimpan metadata dan ciphertext.

Yang bisa dipantau admin:

- Metadata percakapan.
- Laporan penyalahgunaan.
- Status participant.
- Perangkat dan key publik.
- Blokir atau report.

Yang tidak boleh diharapkan:

- Membaca isi pesan biasa dari database.
- Mengambil plaintext dari Supabase.
- Meminta user memberikan private key.

Jika ada pelaporan chat, proses mengikuti bukti yang tersedia, metadata, dan laporan pengguna, bukan pembacaan isi chat dari server.

---

## 13. Berita, Informasi, dan Notifikasi

### 13.1 Informasi dan Berita

Modul Berita digunakan untuk mengirim informasi resmi pesantren ke aplikasi Android.

Workflow:

1. Buka **Informasi & Berita**.
2. Buat berita baru.
3. Isi judul, slug, isi, gambar jika ada, dan status publikasi.
4. Periksa ejaan dan informasi.
5. Publikasikan.

Aturan:

- Jangan memuat data pribadi santri tanpa izin.
- Gunakan judul yang jelas.
- Jika berita salah, edit dan catat koreksinya.

### 13.2 Notifikasi Push

Modul Notifikasi Push dipakai untuk mengirim pemberitahuan ke Android.

Jenis notifikasi:

- Tagihan.
- Pembayaran.
- Pelanggaran.
- Perizinan.
- Kesehatan.
- Forum report.
- Chat alumni.
- Wallet transaction.
- Wallet low balance.
- Wallet critical balance.
- Wallet large transaction.
- Wallet kantin payment.
- Wallet dispute.

Workflow:

1. Buka **Notifikasi Push**.
2. Pilih target jika tersedia.
3. Isi judul dan isi notifikasi.
4. Periksa kembali.
5. Kirim.

Aturan:

- Jangan memasukkan data terlalu sensitif di isi notifikasi.
- Untuk chat E2EE, notifikasi tidak boleh membocorkan plaintext isi pesan.
- Jangan mengirim notifikasi massal tanpa persetujuan pihak berwenang.

---

## 14. RAG Knowledge Base dan Tanya AI

### 14.1 Fungsi RAG Knowledge Base

RAG Knowledge Base adalah kumpulan dokumen pengetahuan yang digunakan fitur Tanya AI. Tujuannya agar jawaban AI lebih sesuai dengan informasi resmi pesantren.

Modul terkait:

- `rag_documents`
- `rag_document_chunks`
- `rag_query_logs`
- `rag_rate_limits`
- Edge Function RAG untuk public, wali, dan admin.

### 14.2 Workflow Mengelola Knowledge Base

1. Buka **RAG Knowledge Base**.
2. Tambahkan dokumen resmi.
3. Pastikan dokumen tidak berisi rahasia yang tidak boleh dijawab AI.
4. Jalankan ingest jika diperlukan.
5. Uji pertanyaan dari fitur Tanya AI.
6. Perbarui dokumen jika kebijakan berubah.

Aturan:

- Jangan memasukkan password, API key, PIN, token, atau data rahasia.
- Gunakan dokumen final, bukan draft yang belum disetujui.
- Cek log query untuk melihat pola pertanyaan dan potensi penyalahgunaan.

---

## 15. Donasi, Infaq, Wakaf, dan Pembayaran Publik

Fitur Donasi memungkinkan pengguna melakukan donasi/infaq/wakaf melalui aplikasi.

Workflow pengguna:

1. Buka menu **Donasi**.
2. Pilih jenis donasi.
3. Isi nominal.
4. Lanjutkan pembayaran via Midtrans.
5. Sistem mencatat status pembayaran.

Workflow admin:

1. Pantau transaksi donasi.
2. Cocokkan status pembayaran.
3. Rekap sesuai kategori donasi.
4. Gunakan laporan untuk pertanggungjawaban internal.

Aturan:

- Jangan mencampur rekap donasi dengan SPP atau wallet.
- Pastikan laporan donasi sesuai kategori.
- Jika pembayaran gagal, jangan dicatat sebagai pemasukan.

---

## 16. Diklat, Pasaran, Inventaris, dan Aset

### 16.1 Diklat dan Pasaran

Modul Diklat dipakai untuk mengelola peserta dan master data diklat/pasaran.

Workflow:

1. Buka **Diklat & Pasaran**.
2. Kelola master data diklat.
3. Tambahkan peserta.
4. Pantau daftar peserta dan statusnya.

### 16.2 Inventaris Aset

Modul Inventaris digunakan untuk mencatat aset pesantren.

Workflow:

1. Buka **Inventaris Aset**.
2. Tambah aset.
3. Isi kategori, lokasi, kondisi, penanggung jawab, dan keterangan.
4. Jika tersedia, gunakan QR/barcode untuk identifikasi aset.
5. Perbarui kondisi aset secara berkala.

### 16.3 Scan QR

Menu Scan QR dapat dipakai untuk workflow yang membutuhkan pemindaian kode, seperti aset atau kebutuhan internal lain.

Catatan penting:

- QR aset berbeda dengan QR/NFC Dompet Santri.
- QR Dompet Santri tidak boleh diperlakukan sebagai data identitas lengkap.

---

## 17. Al-Quran, Jadwal Sholat, dan Fitur Publik Android

### 17.1 Al-Quran Digital

Aplikasi Android menyediakan Al-Quran digital:

- Daftar surah.
- Daftar juz.
- Detail ayat.
- Terjemahan.
- Pencarian surah.
- Tampilan mengikuti tema terang/gelap.

### 17.2 Jadwal Sholat

Beranda Android menampilkan jadwal sholat berdasarkan lokasi perangkat. Jika lokasi tidak tersedia, aplikasi memakai fallback lokasi yang sudah ditentukan.

### 17.3 Beranda Android

Beranda menampilkan:

- Jadwal sholat.
- Informasi dan berita.
- Akses cepat ke Tanya AI.
- Akses cepat ke Al-Quran.
- Menu dan notifikasi.

---

## 18. Audit Log dan Pemeriksaan Berkala

Audit log adalah catatan permanen aktivitas penting. Admin perlu memahami bahwa audit log bukan tempat kerja harian, tetapi alat pemeriksaan saat ada masalah.

Gunakan audit log untuk:

- Menelusuri siapa mengubah data.
- Memeriksa tindakan admin.
- Memeriksa akses data sensitif.
- Melihat aktivitas dompet, wallet risk, dan wallet admin.
- Mendukung investigasi internal.

Pemeriksaan berkala yang disarankan:

1. Cek akun admin aktif.
2. Cek admin dengan role terlalu tinggi.
3. Cek transaksi keuangan dan dompet yang tidak biasa.
4. Cek pengajuan settlement kantin.
5. Cek forum report.
6. Cek validasi EMIS.
7. Cek advisor keamanan Supabase bersama tim teknis.

---

## 19. Alur Kerja Harian yang Disarankan

### 19.1 Super Admin atau Rois

1. Buka dashboard.
2. Cek notifikasi sistem dan audit penting.
3. Pastikan akun admin sesuai tugas.
4. Tindak lanjuti masalah lintas modul.
5. Review laporan keamanan secara berkala.

### 19.2 Kesantrian

Alur ini dilakukan di Admin Panel, bukan di aplikasi Android wali.

1. Input pelanggaran, izin, kesehatan, hafalan, dan kitab.
2. Periksa data santri yang perlu diperbarui.
3. Verifikasi alumni jika menjadi tanggung jawabnya.
4. Moderasi forum jika ada report.

### 19.3 Bendahara

Alur ini dilakukan di Admin Panel dan dashboard keuangan/backend terkait, bukan di aplikasi Android wali.

1. Cek tagihan dan transaksi.
2. Rekap pembayaran masuk.
3. Cek pengeluaran.
4. Pantau top up Dompet Santri.
5. Proses settlement kantin yang valid.
6. Simpan bukti pembayaran/pencairan.

### 19.4 Admin Alumni

Alur ini dilakukan di Admin Panel. Alumni menggunakan Android untuk registrasi, profil, forum, dan chat.

1. Cek pendaftaran alumni baru.
2. Verifikasi profil.
3. Pantau forum report.
4. Tindak konten yang melanggar.
5. Jangan mencoba membaca isi chat E2EE.

### 19.5 Kantin

1. Login Android dengan akun kantin.
2. Pastikan perangkat aktif.
3. Input nominal belanja.
4. Scan QR/NFC kartu santri.
5. Minta PIN santri hanya melalui layar resmi.
6. Tunggu status transaksi berhasil.
7. Ajukan pencairan saldo jika diperlukan.

---

## 20. Penanganan Masalah Umum

### 20.1 Wali Tidak Bisa Login

Langkah:

1. Pastikan email benar.
2. Pastikan akun wali aktif.
3. Pastikan wali terhubung ke santri yang benar.
4. Jika lupa kata sandi, lakukan reset sesuai prosedur.

### 20.2 Data Santri Tidak Muncul di Android Wali

Periksa:

- Wali sudah login dengan akun yang benar.
- Santri memiliki `wali_id` atau hubungan wali yang benar.
- Status santri aktif.
- RLS dan RPC secure tidak sedang bermasalah.
- Koneksi Android stabil.

### 20.3 Pembayaran Belum Lunas Setelah Transfer

Langkah:

1. Cek status transaksi Midtrans.
2. Cek riwayat transaksi.
3. Cek webhook/log jika perlu tim teknis.
4. Jangan langsung mengubah status manual tanpa bukti.

### 20.4 Dompet Terkunci

Penyebab umum:

- PIN salah berulang.
- Risiko transaksi terdeteksi.
- Rekonsiliasi menemukan ketidaksesuaian.
- Tindakan keamanan admin.

Langkah:

1. Cek status dompet.
2. Cek wallet risk event.
3. Cek ledger transaksi.
4. Jika valid, lakukan unlock/recovery sesuai prosedur resmi.

### 20.5 Perangkat Kantin Tidak Bisa Transaksi

Periksa:

- Akun role kantin.
- Device sudah terdaftar.
- Device sudah aktif, bukan pending/suspended/revoked.
- User kantin sudah di-assign ke merchant/outlet.
- Merchant dan outlet aktif.
- Koneksi internet tersedia.

### 20.6 Alumni Tidak Bisa Masuk Forum

Periksa:

- Akun sudah login.
- Data alumni sudah terdaftar.
- Status alumni sudah aktif/diverifikasi.
- Role bukan wali/kantin/admin biasa.

---

## 21. Batasan dan Hal yang Tidak Boleh Dilakukan

Admin tidak boleh:

- Mengedit saldo Dompet Santri langsung.
- Menghapus ledger dompet.
- Meminta PIN santri atau PIN wali.
- Menyimpan PIN di kertas, chat, atau catatan.
- Membagikan service role key, API key, token, atau password.
- Membaca atau meminta isi chat alumni E2EE dari database.
- Menonaktifkan RLS.
- Menghapus audit log.
- Membuat akun admin bersama.
- Menggunakan akun dewan untuk input data operasional.
- Mengirim notifikasi massal berisi data sensitif.
- Mengunggah dokumen rahasia ke RAG Knowledge Base.

---

## 22. Daftar Modul Saat Ini

Admin Panel:

- Dashboard
- Profil Pesantren
- Manajemen Admin
- Data Santri
- Persebaran Santri
- Informasi dan Berita
- Pelanggaran
- Perizinan
- Kesehatan (UKS)
- Ziyadah Tahfidz
- Murojaah Tahfidz
- Hafalan Kitab
- Manajemen Alumni
- Moderasi Forum Alumni
- Log Aktivitas Permanen
- RAG Knowledge Base
- Laporan Nilai
- Keuangan dan SPP
- Riwayat Transaksi
- Diklat dan Pasaran
- Pengeluaran
- Scan QR
- Inventaris Aset
- Ulangan Mingguan
- Notifikasi Push
- Workflow Dompet Santri, kantin, settlement, dispute, rekonsiliasi, dan audit wallet melalui backend/Edge Function terkait

Aplikasi Android:

- Login dan splash screen
- Beranda
- Tanya AI
- Al-Quran
- Berita
- Daftar/profil santri
- Hafalan Quran
- Hafalan kitab
- Pelanggaran
- Kesehatan
- Perizinan
- Keuangan dan SPP
- Dompet Santri
- Kantin Merchant
- Dispute wallet
- Donasi
- Payment result
- Notifikasi
- Forum alumni
- Direktori alumni
- Profil alumni
- Chat alumni E2EE
- Pengaturan alumni

Klasifikasi akses Android:

- **Read-only untuk wali:** daftar/profil santri, hafalan Quran, hafalan kitab, pelanggaran, kesehatan, perizinan, berita, riwayat notifikasi, dan daftar tagihan.
- **Aksi wali yang diperbolehkan:** login/logout, register/deactivate FCM device, membayar tagihan, donasi, aktivasi Dompet Santri, membuat PIN dompet, top up dompet, ubah limit dompet, approval transaksi besar, dan membuat dispute wallet.
- **Aksi kantin:** register device, scan/lookup kartu, membuat authorization transaksi, konfirmasi pembayaran dengan PIN santri sesuai alur, melihat riwayat, dan mengajukan settlement.
- **Aksi alumni:** registrasi alumni, edit profil/settings, follow, forum post/comment/reaction/report, chat E2EE, key backup/restore, mute/archive/block, dan report chat.

Catatan penting: menu seperti Profil Santri, Progres Hafalan, Hafalan Kitab, Catatan Kedisiplinan, Rekam Medis, Izin Santri, serta Tagihan dan SPP adalah menu pantauan untuk wali. Data tersebut dibuat dan diperbarui oleh pengurus melalui Admin Panel/backend, bukan oleh wali dari Android.

---

## 23. Penutup

Dokumen ini menjadi panduan operasional produk AL-HASANAH MEDIA setelah pembaruan besar pada data EMIS, keamanan, alumni, chat E2EE, offline-first, Dompet Santri, kantin merchant, settlement, dan audit.

Jika ada perbedaan antara dokumen ini dan kebijakan resmi pesantren, ikuti kebijakan resmi pesantren dan minta dokumen ini diperbarui. Jika ada perbedaan antara tampilan aplikasi dan dokumen ini, catat nama menu, tanggal kejadian, role akun, dan screenshot non-sensitif agar tim teknis dapat memperbarui panduan.
