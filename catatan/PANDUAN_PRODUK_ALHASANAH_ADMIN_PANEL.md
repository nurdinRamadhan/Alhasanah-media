# PANDUAN PRODUK AL-HASANAH ADMIN PANEL
## Buku Panduan Operasional untuk Admin Non-Teknis

**Versi:** 2.2  
**Tanggal pembaruan:** 20 Mei 2026  
**Dipersiapkan untuk:** Kepala Pesantren, Pengurus Yayasan, Rois, Bendahara, Kesantrian, Dewan, dan Operator Admin Panel

---

## Tentang Sistem Ini

AL-HASANAH Admin Panel adalah sistem manajemen pondok pesantren terpadu. Sistem ini dipakai untuk mengelola data santri, pelaporan EMIS, akademik, tahfidz, keuangan, tagihan, dompet santri, kantin, alumni, inventaris, berita, notifikasi, audit, dan bantuan AI dalam satu panel kerja.

Admin Panel sekarang bukan hanya tempat mencatat data. Sistem ini sudah memiliki alur keamanan berlapis, validasi data, pencatatan aktivitas, notifikasi ke aplikasi Android, serta modul Dompet Santri yang dirancang seperti sistem finansial internal pesantren.

Panduan ini memakai bahasa operasional. Istilah teknis hanya disebut jika penting untuk membantu admin memahami batasan keamanan dan tanggung jawab kerja.

## Sistem Keamanan yang Digunakan

Admin Panel Al-Hasanah menggunakan beberapa lapisan keamanan. Bagian ini penting dibaca sebelum memakai modul apa pun, karena hampir semua workflow sistem mengikuti prinsip: **login resmi, akses sesuai role, aksi penting lewat backend, dan semua kejadian penting tercatat**.

### Rujukan Wajib: SECURITY_PROTOCOL.md

Bagian keamanan panduan ini merujuk pada `catatan/SECURITY_PROTOCOL.md`. Dokumen tersebut adalah protokol utama untuk pengembangan, audit, dan pengecekan keamanan sistem. Jika ada perbedaan antara ringkasan panduan ini dan protokol teknis tersebut, maka `SECURITY_PROTOCOL.md` menjadi rujukan yang lebih ketat.

Protokol tersebut menegaskan beberapa aturan dasar:

- data sangat sensitif tidak boleh disimpan atau ditampilkan dalam bentuk plaintext;
- private key, token, password, dan secret tidak boleh masuk ke frontend, log, atau repository;
- tabel sensitif wajib memakai RLS;
- data sensitif tidak boleh dikirim ke AI tanpa sanitasi;
- endpoint penting wajib melakukan validasi, rate limiting, dan audit log;
- pesan terenkripsi end-to-end tidak boleh bisa dibaca oleh server atau admin;
- jika ditemukan data sensitif plaintext, key bocor, RLS hilang, atau endpoint penting tanpa proteksi, pekerjaan harus dihentikan dan dilaporkan sebagai masalah keamanan.

### Klasifikasi Data Merah, Kuning, dan Hijau

Sistem membagi data menjadi tiga tingkat keamanan:

- **Merah:** data sangat sensitif seperti NIK, NIK wali/orang tua, nomor KK, nomor rekening, private key, token, password, dan data keuangan rahasia. Data ini wajib dienkripsi field-level dan tidak boleh tampil polos di UI atau log.
- **Kuning:** data pribadi seperti nama lengkap, tanggal lahir, alamat, nomor telepon, email, dan informasi keluarga. Data ini wajib dibatasi dengan RLS, masking tampilan, dan akses sesuai role.
- **Hijau:** data operasional seperti ID internal, kelas, status tagihan, tanggal operasional, dan metadata umum. Data ini tetap dilindungi dengan RLS dan enkripsi at-rest dari Supabase.

Admin non-teknis perlu memahami bahwa tidak semua data boleh dibuka penuh. Jika sistem menampilkan data dalam bentuk tersamarkan, itu bagian dari desain keamanan.

### Enkripsi Field-Level dan Hash Lookup

Untuk data merah dan sebagian data kuning, protokol keamanan mewajibkan enkripsi pada level field menggunakan mekanisme database seperti `pgcrypto`, `encrypt_field`, `decrypt_field`, dan `hash_identifier`. Artinya, data seperti NIK, nomor KK, nomor rekening, dan identitas sensitif lain tidak boleh disimpan polos di tabel.

Jika sistem perlu mencari data sensitif, pencarian dilakukan melalui hash lookup, bukan dengan membuka semua data mentah. Dekripsi hanya dilakukan melalui jalur resmi yang memiliki alasan akses, role yang benar, dan pencatatan audit.

### Larangan Logging dan Penyimpanan Lokal Data Sensitif

Admin Panel tidak boleh menyimpan data sensitif di `localStorage`, `sessionStorage`, draft browser, console log, atau log error yang bisa dibaca bebas. Form sensitif harus dikirim melalui jalur HTTPS dan backend resmi.

Contoh data yang tidak boleh masuk log:

- NIK dan nomor KK;
- nomor rekening;
- nomor HP pribadi;
- alamat lengkap;
- tanggal lahir;
- nama lengkap jika konteksnya sensitif;
- nominal transaksi sensitif;
- token, password, secret, dan kunci API.

### Sanitasi Data Sebelum AI

Fitur AI hanya boleh menerima data yang sudah disaring. AI tidak boleh menerima NIK, nomor KK, nomor rekening, token, password, alamat lengkap, nomor HP, data gaji, nominal rahasia, atau identitas pribadi yang tidak diperlukan.

Karena itu, hasil analisis AI dipakai sebagai bantuan keputusan, bukan sebagai sumber kebenaran final. Keputusan final tetap berada pada admin berwenang dan workflow resmi sistem.

### Rate Limiting Endpoint Penting

Endpoint publik dan endpoint AI/RAG wajib dibatasi agar tidak bisa disalahgunakan. Protokol keamanan menetapkan pembatasan request untuk layanan seperti RAG publik, RAG wali, RAG admin, AI Agent, dan webhook eksternal.

Bagi admin, dampaknya sederhana: jika sistem menolak terlalu banyak request dalam waktu singkat, itu bukan error biasa, melainkan perlindungan dari penyalahgunaan.

### E2EE untuk Chat dan Komunikasi Sensitif

Untuk fitur chat atau komunikasi yang memakai end-to-end encryption, private key tidak boleh dikirim ke server. Private key disimpan di perangkat pengguna, misalnya Android Keystore. Server hanya menyimpan ciphertext dan metadata yang diperlukan.

Konsekuensinya:

- admin server tidak dapat membaca isi pesan terenkripsi;
- tidak ada master key untuk membuka semua pesan;
- log tidak boleh berisi isi pesan plaintext;
- pemulihan pesan mengikuti aturan kunci perangkat, bukan pembacaan manual oleh operator.

### 1. Login dan Sesi Supabase Auth

Setiap admin masuk memakai email dan password melalui Supabase Auth. Sistem menyimpan sesi login secara aman di browser dan melakukan refresh sesi otomatis selama sesi masih valid.

Saat login, sistem memeriksa profil pengguna di tabel `profiles`. Jika akun sudah dinonaktifkan, pengguna langsung ditolak dan sesi logout otomatis. Setelah login berhasil, halaman awal diarahkan sesuai role:

- Kesantrian diarahkan ke Data Santri.
- Bendahara diarahkan ke Tagihan.
- Kantin diarahkan ke Dompet Santri.
- Role lain diarahkan ke Dashboard.

### 2. Role-Based Access Control

Admin Panel memakai RBAC atau pembatasan akses berdasarkan role. Role utama adalah super admin, rois, dewan, bendahara, kesantrian, dan kantin.

Selain role, sebagian akun dapat dibatasi berdasarkan:

- akses gender;
- akses jurusan/takhasus.

Pembatasan ini membuat operator hanya bekerja pada data yang memang menjadi kewenangannya.

### 3. Row Level Security dan Policy Database

Sebagian besar tabel operasional dan tabel sensitif memakai Row Level Security atau RLS. RLS membatasi baris data yang boleh dibaca atau diubah oleh pengguna sesuai aturan backend.

Catatan audit Supabase per 20 Mei 2026 masih memberi peringatan bahwa beberapa tabel non-wallet seperti inventaris, kategori barang, lokasi aset, struktur organisasi, `spatial_ref_sys`, dan `kecamatan_polygons` perlu hardening RLS lanjutan. Artinya, secara operasional sistem sudah memiliki banyak lapisan keamanan, tetapi audit database tetap harus dijalankan berkala sampai semua advisor bersih.

### 4. Secure RPC untuk Data Sensitif

Data santri dan data wali yang sensitif tidak selalu dibaca langsung dari tabel biasa. Beberapa workflow memakai RPC aman, misalnya:

- `get_santri_detail_secure`;
- `update_santri_secure`;
- `export_santri_emis`;
- validasi dan ekspor EMIS.

RPC ini membantu memastikan akses tercatat, alasan akses dikirim, dan data sensitif tidak dibuka secara bebas.

### 5. Edge Function untuk Aksi Berisiko

Aksi penting dijalankan melalui Supabase Edge Function agar validasi terjadi di server, bukan hanya di browser. Contoh:

- membuat akun wali;
- upload foto santri;
- membuat akun admin;
- menghapus akun admin;
- membuat pembayaran Midtrans;
- proses webhook Midtrans;
- top up dompet;
- otorisasi dan konfirmasi kantin;
- audit keamanan dompet;
- pengiriman push notification;
- RAG dan AI Agent.

Frontend tidak menyimpan `service_role` dan tidak boleh melakukan aksi finansial sensitif secara langsung.

### 6. Audit Log dan Buku Besar Permanen

Aktivitas penting dicatat ke audit log atau buku besar sesuai modul. Contoh:

- pembuatan atau penghapusan admin;
- perubahan data santri;
- ekspor data EMIS;
- pencatatan pengeluaran;
- transaksi keuangan;
- aksi AI Agent yang disetujui atau ditolak;
- aksi Dompet Santri;
- audit keamanan.

Untuk keuangan, halaman Riwayat Transaksi berfungsi sebagai buku besar permanen. Untuk Dompet Santri, `transaksi_dompet` menjadi ledger append-only.

### 7. Keamanan Dompet Santri Banking-Grade

Dompet Santri memakai prinsip closed-loop, zero trust, dan ledger-first. Keamanan utama yang digunakan:

- saldo hanya berubah lewat RPC atau Edge Function resmi;
- ledger append-only, transaksi lama tidak diedit atau dihapus;
- idempotency key untuk mencegah transaksi ganda;
- nonce dan challenge untuk mencegah replay;
- hash-chain untuk memeriksa integritas ledger;
- QR hanya berisi `wallet_public_id`, bukan data rahasia;
- PIN memakai verifier, bukan plaintext;
- device kantin harus terdaftar dan aktif;
- private key utama berada di Android Keystore;
- Ed25519 dipakai untuk tanda tangan transaksi;
- limit transaksi per transaksi, harian, bulanan, dan threshold transaksi besar;
- freeze switch untuk membekukan transaksi saat ada risiko;
- rekonsiliasi dan integrity check berkala;
- risk event, dispute, dan SLA penanganan;
- audit keamanan manual dan analisis AI auditor.

### 8. Keamanan Pembayaran Midtrans

Pembayaran digital memakai Midtrans. Sistem tidak menganggap pembayaran sukses hanya karena ada bukti transfer atau screenshot. Status final mengikuti webhook dan validasi backend.

Untuk Dompet Santri, saldo baru bertambah setelah webhook Midtrans valid dan transaksi diposting ke ledger. Untuk buku besar keuangan, order ID Midtrans tampil sebagai referensi audit.

### 9. Keamanan Notifikasi dan Perangkat

Push notification memakai `notification_queue` dan token perangkat di `user_devices`. Token FCM dibuat single-owner agar token perangkat lama tidak terus menerima notifikasi akun lain setelah logout atau switch account.

Notifikasi hanya pemberitahuan. Notifikasi bukan sumber kebenaran transaksi. Admin tetap harus membuka modul terkait untuk memverifikasi data.

### 10. Keamanan AI dan RAG

AI tidak diberi kewenangan bebas untuk mengubah data. AI Consultant memiliki batasan:

- Analysis hanya memberi ringkasan.
- AI Agent wajib meminta konfirmasi admin sebelum aksi dijalankan.
- Aksi AI Agent dicatat di audit log.
- RAG Decision hanya untuk role tertentu.
- AI audit Dompet Santri hanya membaca hasil audit yang sudah disaring.
- AI tidak memegang saldo, tidak menghapus ledger, dan tidak memutuskan transaksi final.

## Prinsip Penggunaan

1. **Data santri adalah data induk.** Banyak modul lain memakai NIS dan profil santri sebagai rujukan.
2. **Perubahan penting harus dilakukan dari menu resmi.** Jangan meminta perubahan saldo, akun, atau data sensitif lewat cara manual di luar sistem.
3. **Setiap role memiliki batas akses.** Admin hanya melihat dan mengubah data sesuai tugasnya.
4. **Dompet Santri tidak boleh diedit seperti kas biasa.** Saldo berubah hanya lewat transaksi resmi yang tercatat di ledger.
5. **Notifikasi bukan bukti transaksi.** Jika ada pertanyaan saldo atau pembayaran, admin harus membuka riwayat transaksi di sistem.
6. **Audit log adalah bukti kerja.** Aktivitas penting dicatat untuk keamanan dan evaluasi.

## Role dan Hak Akses

### Super Admin
Memiliki akses penuh untuk pengaturan sistem, admin, audit, Dompet Santri, data santri, akademik, keuangan, dan tindakan darurat.

### Rois
Memiliki akses luas untuk pemantauan dan pengawasan operasional. Pada Dompet Santri, Rois dapat melihat dan menjalankan fungsi pengawasan sesuai kewenangan.

### Dewan
Berfungsi sebagai pemantau. Dewan pada prinsipnya bersifat read-only untuk data akademik, santri, dan laporan. Dewan dapat melihat informasi, tetapi tidak menjadi operator transaksi.

### Bendahara
Fokus pada tagihan, transaksi keuangan, pengeluaran, inventaris, Dompet Santri, operasional dompet, dan manajemen kantin. Bendahara dapat melihat data santri, tetapi tidak mengubah biodata santri.

### Kesantrian
Fokus pada data santri, pelanggaran, perizinan, kesehatan, tahfidz, murojaah, hafalan kitab, ulangan, berita, diklat, dan alumni.

### Kantin
Role khusus untuk operasional kantin. Aksesnya terbatas pada alur transaksi kantin dan informasi yang diperlukan. Kantin tidak boleh mengedit data santri atau saldo.

---

# Ringkasan Modul

1. **Dashboard:** ringkasan kondisi pesantren.
2. **Profil Pesantren:** identitas lembaga dan struktur organisasi.
3. **Manajemen Admin:** akun pengurus dan hak akses.
4. **Data Santri EMIS:** biodata santri, akun wali, validasi EMIS, geocode, QR, ekspor Excel.
5. **Persebaran Santri:** peta lokasi asal santri.
6. **Kesantrian:** pelanggaran, perizinan, dan kesehatan.
7. **Tahfidz Quran:** ziyadah, murojaah, dan hafalan kitab.
8. **Laporan Nilai:** nilai akademik dan rekap belajar.
9. **Ulangan Mingguan:** bank soal, pembuatan ulangan, arsip, dan nilai.
10. **Keuangan & SPP:** tagihan santri dan riwayat pembayaran.
11. **Pengeluaran:** kas keluar operasional pesantren.
12. **Dompet Santri:** akun saldo, ledger, limit, QR, top up, kantin, keamanan, dan audit.
13. **Diklat & Pasaran:** peserta program dan master data kegiatan.
14. **Informasi & Berita:** publikasi pengumuman dan berita.
15. **Manajemen Alumni:** data alumni, forum, laporan, dan monitoring chat.
16. **Inventaris Aset:** data barang, lokasi, dan kategori.
17. **Scan QR:** pemindaian identitas atau kartu.
18. **Notifikasi Push:** pesan ke aplikasi Android.
19. **Log Aktivitas:** riwayat tindakan admin.
20. **AI/RAG:** bantuan pencarian pengetahuan dan konsultasi internal.

---

# 1. Dashboard

## Fungsi
Dashboard adalah halaman pertama setelah login. Halaman ini menampilkan gambaran cepat kondisi pesantren: jumlah santri, keuangan, kegiatan, dan indikator lain yang perlu dipantau pimpinan.

## Digunakan Oleh
Super Admin, Rois, Dewan, Bendahara, dan pengurus lain sesuai hak akses.

## Yang Dilihat Admin

- Ringkasan jumlah santri dan statusnya.
- Ringkasan pemasukan, pengeluaran, dan kas.
- Grafik arus kas.
- Ringkasan kegiatan atau program yang sedang berjalan.
- Peringatan global jika ada kondisi kritis.

## Peringatan Global

Sistem memiliki peringatan global untuk kondisi yang perlu segera diperiksa. Contohnya:

- jumlah tunggakan SPP melewati batas tertentu;
- kasus kesehatan baru dalam minggu berjalan melewati batas tertentu.

Jika banner peringatan muncul, admin dapat menekan tombol **CEK** untuk langsung menuju modul terkait, misalnya Tagihan atau Kesehatan.

## Alur Kerja

1. Login ke Admin Panel.
2. Lihat indikator utama.
3. Jika ada banner kritis, tekan **CEK** dan selesaikan pemeriksaan.
4. Jika ada angka yang tidak wajar, buka modul terkait, misalnya Data Santri, Tagihan, Transaksi, atau Pengeluaran.

---

# 2. Profil Pesantren

## Fungsi
Modul ini menyimpan identitas resmi pesantren dan struktur organisasi. Data profil dipakai untuk kebutuhan tampilan, dokumen, dan administrasi internal.

## Fitur Utama

- Logo dan identitas lembaga.
- Alamat, kontak, dan informasi resmi.
- Tahun ajaran atau periode aktif.
- Struktur organisasi berbentuk bagan.
- Foto, nama, jabatan, dan urutan tampilan pengurus.

## Alur Kerja

1. Buka menu **Profil Pesantren**.
2. Perbarui identitas lembaga jika ada perubahan.
3. Tambah atau ubah jabatan dalam struktur organisasi.
4. Unggah foto pengurus jika diperlukan.

## Catatan
Pastikan data profil resmi dan tidak diisi sembarangan, karena bisa muncul pada laporan atau dokumen cetak.

---

# 3. Manajemen Admin

## Fungsi
Modul ini dipakai untuk membuat, mengatur, dan menonaktifkan akun pengurus.

## Fitur Utama

- Membuat akun admin baru.
- Menentukan role: super admin, rois, dewan, bendahara, kesantrian, atau kantin.
- Mengatur akses berdasarkan gender atau jurusan jika diperlukan.
- Melihat status aktif akun.
- Menghapus atau menonaktifkan akses pengurus yang tidak lagi bertugas.

## Alur Kerja Membuat Akun

1. Super Admin membuka **Manajemen Admin**.
2. Klik tambah admin.
3. Isi nama, email, nomor HP, role, dan batasan akses.
4. Simpan.
5. Informasikan akun kepada pengurus terkait.

## Catatan Keamanan

- Jangan memakai satu akun untuk banyak orang.
- Akun pengurus yang sudah tidak bertugas harus segera dinonaktifkan.
- Role kantin hanya dipakai untuk petugas atau perangkat operasional kantin.

---

# 4. Data Santri EMIS

## Fungsi
Data Santri adalah pusat data induk seluruh santri. Versi terbaru sudah disesuaikan dengan kebutuhan EMIS pesantren dan ekspor data resmi.

## Digunakan Oleh
Kesantrian dan Super Admin sebagai operator utama. Rois, Dewan, dan Bendahara dapat melihat data sesuai hak akses.

## Fitur Utama

### Registrasi Santri Baru EMIS
Formulir santri baru sekarang memuat data yang dibutuhkan untuk pelaporan EMIS, antara lain:

- NIS, NSP, NISN, NIK, nomor KK.
- Nama, tempat lahir, tanggal lahir, jenis kelamin, agama, kewarganegaraan.
- Status santri, status mukim, kelas, jurusan, pembimbing, dan tahun masuk.
- Alamat lengkap: RT, RW, desa/kelurahan, kecamatan, kabupaten/kota, provinsi, kode pos.
- Koordinat lokasi dan status geocode.
- Data ayah, ibu, atau wali lain.
- Pendidikan, pekerjaan, dan penghasilan orang tua/wali.
- PIP, KIP, beasiswa, kebutuhan khusus, dan data tambahan EMIS.
- Foto santri.
- Email dan password awal untuk akun wali Android.

### Pembuatan Akun Wali Otomatis
Saat santri baru disimpan, sistem dapat membuat akun wali sekaligus. Admin memilih penanggung jawab aplikasi: ayah, ibu, atau wali lain.

### Validasi EMIS
Sistem melakukan validasi awal agar data penting tidak kosong atau salah format. Contoh validasi:

- NIK harus 16 digit.
- Nomor KK harus sesuai format.
- Nama dan data keluarga harus terisi sesuai kebutuhan.
- Data tambahan EMIS seperti jenjang pesantren dan jenis pendaftaran harus dilengkapi.

### Geocode dan Peta
Alamat santri dapat diproses menjadi koordinat. Status geocode membantu admin melihat apakah lokasi sudah berhasil ditemukan, masih pending, gagal, atau diisi manual.

### Kesiapan EMIS
Di daftar santri terdapat indikator kesiapan EMIS dan status geocode. Admin dapat memperbaiki data yang masih ditandai perlu perbaikan.

### Ekspor Excel EMIS
Data santri dapat diekspor ke Excel dengan format yang disiapkan untuk kebutuhan pelaporan EMIS. Ekspor dilakukan lewat proses backend agar akses data sensitif tetap tercatat.

### Profil Santri
Halaman detail santri menampilkan biodata lengkap, riwayat akademik, data wali, QR, dan dokumen cetak.

### QR Identitas
Setiap santri dapat memiliki QR untuk kebutuhan identifikasi. QR membantu pemindaian cepat, tetapi bukan pengganti verifikasi admin.

## Alur Registrasi Santri

1. Buka **Data Santri** lalu pilih tambah santri.
2. Isi biodata utama dan data keluarga.
3. Isi alamat lengkap dan jalankan geocode jika alamat sudah siap.
4. Pilih penanggung jawab aplikasi wali.
5. Isi email dan password awal akun wali.
6. Upload foto jika tersedia.
7. Simpan.
8. Jika muncul pesan validasi EMIS, perbaiki kolom yang disebutkan.
9. Setelah berhasil, data santri dan akun wali tercatat.

## Alur Perbaikan Data EMIS

1. Buka daftar santri.
2. Lihat kolom kesiapan EMIS.
3. Klik edit pada santri yang perlu perbaikan.
4. Lengkapi data yang kurang.
5. Simpan ulang.
6. Ekspor Excel jika data sudah siap.

## Catatan Penting

- Jangan mengganti NIS tanpa alasan kuat karena NIS dipakai banyak modul.
- Data wali harus benar karena dipakai untuk aplikasi Android, notifikasi, dan Dompet Santri.
- Jika geocode gagal, admin dapat memperbaiki alamat atau mengisi koordinat manual.

---

# 5. Persebaran Santri

## Fungsi
Modul ini menampilkan peta persebaran santri berdasarkan alamat atau koordinat.

## Manfaat

- Melihat daerah asal santri.
- Membantu laporan wilayah.
- Membantu perencanaan komunikasi wali atau kegiatan daerah.

## Catatan
Peta akan lebih akurat jika data alamat dan geocode pada Data Santri sudah lengkap.

---

# 6. Kesantrian

## Fungsi
Modul Kesantrian mengelola aktivitas harian santri: pelanggaran, izin keluar, dan kesehatan.

## Pelanggaran

Fitur:

- Mencatat jenis pelanggaran.
- Memberi kategori ringan, sedang, atau berat.
- Mencatat poin dan tindakan pembinaan.
- Menampilkan riwayat kedisiplinan santri.

Alur:

1. Buka **Pelanggaran**.
2. Pilih santri.
3. Isi kategori, uraian pelanggaran, dan tindakan.
4. Simpan.

## Perizinan

Fitur:

- Mencatat izin keluar pesantren.
- Menentukan rencana kembali.
- Menandai status izin.
- Mencatat waktu kembali santri.

Alur:

1. Buka **Perizinan**.
2. Buat izin baru.
3. Isi alasan, tujuan, waktu keluar, dan rencana kembali.
4. Saat santri kembali, update status kepulangan.

## Kesehatan UKS

Fitur:

- Mencatat keluhan.
- Mencatat diagnosa atau tindakan.
- Mencatat obat atau penanganan.
- Menyimpan riwayat kesehatan santri.

Alur:

1. Buka **Kesehatan (UKS)**.
2. Pilih santri.
3. Isi keluhan dan tindakan.
4. Simpan.

---

# 7. Tahfidz Quran dan Hafalan Kitab

## Fungsi
Modul ini memantau perkembangan pendidikan santri, terutama ziyadah, murojaah, dan hafalan kitab.

## Ziyadah
Dipakai untuk mencatat setoran hafalan baru.

## Murojaah
Dipakai untuk mencatat pengulangan hafalan agar kualitas hafalan tetap terjaga.

## Hafalan Kitab
Dipakai untuk mencatat perkembangan hafalan atau capaian kitab.

## Alur Kerja Umum

1. Pilih menu sesuai jenis catatan.
2. Pilih santri.
3. Isi tanggal, capaian, pembimbing, dan catatan.
4. Simpan.
5. Gunakan halaman detail untuk melihat riwayat perkembangan.

---

# 8. Laporan Nilai

## Fungsi
Modul ini menampilkan dan mengelola nilai akademik santri.

## Manfaat

- Rekap nilai per santri.
- Pantauan perkembangan akademik.
- Bahan laporan untuk wali atau rapat internal.

## Catatan
Pastikan data mata pelajaran dan nilai diisi konsisten agar laporan mudah dibaca.

---

# 9. Ulangan Mingguan

## Fungsi
Modul Ulangan Mingguan mengelola bank soal, pembuatan ulangan, dan arsip nilai.

## Fitur Utama

- Bank soal.
- Pembuatan ulangan.
- Arsip ulangan.
- Rekap nilai.

## Alur Kerja

1. Buka **Bank & Buat Ulangan**.
2. Siapkan soal dan konfigurasi ulangan.
3. Setelah ulangan selesai, buka **Arsip & Nilai** untuk melihat hasil.

---

# 10. Keuangan & SPP

## Fungsi
Modul ini mengelola tagihan santri, pembayaran biaya pendidikan, buku besar transaksi, serta penerimaan dana umum seperti infaq, wakaf, shadaqah, dan donasi.

## Fitur Utama

- Membuat tagihan.
- Melihat status pembayaran.
- Mencatat transaksi pembayaran.
- Melihat **Buku Besar Keuangan** atau riwayat transaksi permanen.
- Menginput infaq, wakaf, shadaqah, dan donasi secara manual.
- Memisahkan transaksi masuk dan keluar.
- Melihat status sukses, pending, gagal, atau diproses.
- Memantau kas masuk sukses, kas keluar sukses, net saldo, tingkat sukses transaksi, transaksi pending, komposisi cash/digital, dan total infaq/wakaf.
- Integrasi pembayaran Midtrans untuk alur tertentu.
- Ekspor Excel laporan keuangan multi-sheet.

## Alur Membuat Tagihan

1. Buka **Keuangan & SPP**.
2. Klik tambah tagihan.
3. Pilih santri dan jenis tagihan.
4. Isi nominal dan periode.
5. Simpan.

## Alur Pembayaran Tagihan

Pembayaran tagihan dapat dicatat melalui dua jalur utama:

1. **Pembayaran manual:** bendahara mencatat pembayaran yang diterima langsung, lalu sistem memperbarui status tagihan dan riwayat transaksi.
2. **Pembayaran digital Midtrans:** sistem membuat pembayaran digital, lalu status final mengikuti callback/webhook Midtrans.

Untuk pembayaran manual, pastikan nominal, santri, tagihan, dan keterangan sudah benar sebelum disimpan. Untuk pembayaran digital, jangan mengubah status hanya berdasarkan screenshot; tunggu status sistem.

## Alur Melihat Pembayaran

1. Buka **Riwayat Transaksi**.
2. Cari nama santri, periode, atau status pembayaran.
3. Cocokkan transaksi dengan tagihan jika diperlukan.

## Buku Besar Keuangan

Halaman **Riwayat Transaksi** sekarang berfungsi sebagai buku besar keuangan. Di halaman ini admin dapat melihat transaksi yang dicatat oleh admin maupun transaksi digital dari sistem.

Data yang tampil antara lain:

- tanggal Masehi dan waktu transaksi;
- tanggal Hijriah;
- pencatat transaksi, baik admin maupun sistem otomatis;
- jenis transaksi: masuk atau keluar;
- subjek transaksi: santri, wali, donatur umum, atau masyarakat;
- uraian/keterangan;
- metode pembayaran;
- nominal;
- status transaksi;
- order ID Midtrans jika transaksi berasal dari pembayaran digital.

Halaman ini diberi label **Audit Locked** karena transaksi yang sudah tercatat menjadi bagian dari riwayat audit keuangan. Jika ada kekeliruan, admin harus membuat catatan koreksi sesuai prosedur, bukan menghapus riwayat lama secara sembarangan.

## Input Infaq, Wakaf, Shadaqah, dan Donasi

Tombol **Input Infaq / Wakaf** digunakan untuk mencatat penerimaan dana non-tagihan. Form input manual terdiri dari empat langkah:

1. Pilih kategori: **Infaq**, **Wakaf**, **Shadaqah**, atau **Donasi**.
2. Pilih identitas donatur: **Umum / Hamba Allah** atau **Dari Santri**.
3. Isi nominal, metode penerimaan, dan tanggal transaksi.
4. Tambahkan catatan peruntukan dana jika diperlukan.

Metode penerimaan yang tersedia:

- Tunai / Cash.
- Transfer Bank.
- Digital / QRIS.

Saat disimpan, transaksi dicatat sebagai kas masuk dengan status sukses dan masuk ke `transaksi_keuangan`. Admin pencatat ikut disimpan sehingga riwayatnya dapat ditelusuri.

## Infaq Digital dan Midtrans

Transaksi infaq atau donasi yang berasal dari pembayaran digital dapat memiliki order ID Midtrans. Order ID ini tampil di buku besar sebagai referensi audit.

Jika transaksi masih pending, admin tidak boleh menganggap dana sudah masuk. Gunakan status transaksi di sistem sebagai acuan, bukan screenshot dari pembayar.

## Export Excel Keuangan

Menu **Export Excel** pada buku besar menghasilkan laporan dengan beberapa bagian:

- Ringkasan eksekutif keuangan.
- Buku besar detail seluruh transaksi.
- Sheet khusus **Infaq & Wakaf** jika ada transaksi infaq/wakaf/shadaqah/sedekah pada periode tersebut.

Export ini membantu bendahara menyiapkan laporan kas, rekap transaksi digital, serta bukti penerimaan dana umum.

## Catatan
Pembayaran digital harus dicek berdasarkan status sistem, bukan hanya bukti tangkapan layar dari wali.

---

# 11. Pengeluaran

## Fungsi
Modul Pengeluaran mencatat kas keluar operasional pesantren.

## Fitur Utama

- Mencatat tanggal, kategori, nominal, dan keterangan pengeluaran.
- Melihat daftar pengeluaran.
- Membantu laporan kas dan evaluasi biaya.
- Mengunggah bukti pengeluaran jika tersedia.
- Membuat catatan kas keluar ke buku besar transaksi keuangan.

## Alur Kerja

1. Buka **Pengeluaran**.
2. Tambahkan pengeluaran baru.
3. Isi kategori, nominal, dan keterangan.
4. Upload bukti jika ada.
5. Simpan.
6. Sistem mencatat pengeluaran dan membuat transaksi kas keluar pada buku besar.

## Catatan
Jika pengeluaran salah input, perbaiki melalui menu resmi agar audit log tetap jelas. Bukti pengeluaran harus berupa dokumen atau gambar yang relevan dan tidak berisi data pribadi yang tidak diperlukan.

---

# 12. Dompet Santri

## Gambaran Umum
Dompet Santri adalah sistem uang jajan internal pesantren. Saldo hanya berlaku di lingkungan pesantren, terutama untuk transaksi kantin dan layanan internal yang disetujui.

Dompet Santri memakai prinsip closed-loop dan ledger-first. Artinya:

- Saldo tidak menjadi e-wallet umum.
- Tidak ada transfer bebas antar pengguna.
- Tidak ada cash-out publik untuk santri.
- Setiap perubahan saldo harus tercatat sebagai transaksi.
- Admin tidak boleh mengubah saldo langsung seperti mengedit angka.
- Jika ada koreksi, sistem membuat transaksi koreksi baru, bukan menghapus transaksi lama.

## Data Backend yang Sudah Divalidasi
Berdasarkan validasi backend, modul Dompet Santri memakai tabel dan proses seperti:

- `dompet_santri` untuk akun dan saldo cached.
- `transaksi_dompet` untuk ledger transaksi.
- `wallet_payment_intents` untuk top up dan proses pembayaran yang belum final.
- `wallet_authorization_sessions` untuk sesi otorisasi QR/kantin.
- `wallet_devices` dan `kantin_devices` untuk perangkat.
- `wallet_risk_events` untuk peringatan risiko.
- `wallet_disputes` untuk laporan wali.
- `wallet_reconciliation_runs` untuk cek saldo.
- `wallet_ledger_integrity_runs` untuk cek ledger.
- `wallet_security_audit_runs` dan `wallet_security_ai_analyses` untuk audit keamanan.
- `wallet_merchants`, `wallet_merchant_outlets`, `wallet_merchant_users`, `wallet_merchant_balances`, `wallet_merchant_ledger`, dan `wallet_merchant_settlement_requests` untuk manajemen kantin.

Edge Function aktif yang mendukung alur ini antara lain:

- `wallet-admin`
- `wallet-register`
- `wallet-update-limits`
- `wallet-topup-create`
- `wallet-admin-topup-create`
- `wallet-kantin-authorize`
- `wallet-kantin-confirm`
- `wallet-kantin-student-confirm`
- `wallet-kantin-register-device`
- `wallet-kantin-provision`
- `wallet-kantin-card-lookup`
- `wallet-merchant-settlement-request`
- `wallet-merchant-settlement-admin`
- `wallet-security-ai-auditor`
- `midtrans-payment`
- `push-notifications`

## 12.1 Akun & Saldo

### Fungsi
Halaman **Akun & Saldo** dipakai untuk melihat akun dompet setiap santri, saldo, status, limit, QR publik, dan ledger transaksi.

### Yang Dapat Dilakukan Admin

- Melihat total saldo seluruh dompet.
- Melihat jumlah dompet aktif, terkunci, dan saldo rendah.
- Melihat saldo per santri.
- Melihat limit per transaksi, harian, bulanan, transaksi besar, dan saldo rendah.
- Membuka ledger santri.
- Mencetak atau melihat QR publik.
- Mengunci atau membuka kunci dompet.
- Membuat koreksi saldo lewat transaksi resmi.
- Menjalankan rekonsiliasi dan cek hash-chain untuk role yang berwenang.

### Yang Tidak Boleh Dilakukan

- Mengedit angka saldo langsung.
- Menghapus transaksi ledger.
- Membuat transaksi di luar tombol resmi.
- Mencetak PIN, private key, nonce, ciphertext, atau data rahasia lain.

### Alur Koreksi Saldo

1. Buka **Dompet Santri > Akun & Saldo**.
2. Cari santri.
3. Klik **Koreksi**.
4. Pilih arah transaksi: tambah saldo atau kurangi saldo.
5. Isi nominal dan keterangan jelas.
6. Simpan.
7. Sistem membuat catatan ledger baru.

### Alur Kunci Dompet

1. Buka akun dompet santri.
2. Klik **Kunci** jika ada risiko atau permintaan resmi.
3. Isi alasan jika diminta.
4. Untuk membuka kembali, klik **Buka** setelah masalah selesai.

## 12.2 QR Kartu Santri

QR Dompet Santri hanya berisi `wallet_public_id`, yaitu identitas publik yang tidak bersifat rahasia.

QR tidak boleh berisi:

- NIS sebagai data utama yang mudah ditebak.
- Nama santri.
- PIN.
- Saldo.
- Nomor HP wali.
- Token rahasia.

Jika kartu hilang atau QR dicurigai bocor, admin berwenang dapat menerbitkan ulang QR. Setelah QR baru diterbitkan, QR lama tidak boleh dipakai lagi.

## 12.3 Top Up Dompet

Top up utama dilakukan dari aplikasi Android wali melalui Midtrans. Bendahara atau Super Admin juga dapat membuat top up titipan admin, tetapi tetap melalui alur Midtrans.

### Prinsip Top Up

- Saldo tidak langsung bertambah saat wali membuat top up.
- Saldo bertambah setelah webhook Midtrans menyatakan pembayaran sukses dan backend memposting transaksi ke ledger.
- Jika top up gagal atau expired, admin tidak boleh menambahkan saldo manual sebagai pengganti.

### Alur Top Up Wali

1. Wali membuka aplikasi Android.
2. Wali membuat top up.
3. Aplikasi membuka pembayaran Midtrans.
4. Setelah pembayaran berhasil, sistem menerima webhook.
5. Saldo bertambah melalui ledger `topup`.
6. Notifikasi dikirim ke wali.

### Alur Top Up Titipan Admin

1. Bendahara atau Super Admin membuka tab top up pada operasional dompet.
2. Pilih santri dan isi nominal.
3. Isi nama penyetor, hubungan penyetor, dan catatan.
4. Sistem membuat pembayaran Midtrans.
5. Saldo tetap bertambah hanya setelah pembayaran berhasil dan ledger terposting.

## 12.4 Operasional & Peringatan

Halaman **Operasional & Peringatan** adalah pusat pengawasan harian Dompet Santri.

### Tab Peringatan Keamanan
Menampilkan risiko seperti transaksi mencurigakan, percobaan PIN gagal, device bermasalah, atau event kritis.

Admin dapat:

- Menandai sedang ditangani.
- Memulai pemeriksaan.
- Melakukan eskalasi.
- Menyelesaikan kasus.
- Menandai false alarm jika memang bukan masalah.

### Tab Laporan Wali
Dipakai untuk menangani laporan wali, misalnya transaksi tidak dikenal.

Alur:

1. Buka laporan.
2. Klik periksa.
3. Cocokkan ledger, waktu, nominal, dan kantin.
4. Putuskan valid atau perlu refund.
5. Jika refund, sistem membuat ledger reversal baru.

### Tab Cek Saldo
Dipakai untuk rekonsiliasi. Sistem membandingkan saldo ledger, saldo cached, saldo santri, saldo merchant, pending settlement, dan data terkait.

Jika ada selisih:

- Jangan abaikan.
- Isi catatan review.
- Tindak lanjuti sampai status jelas.

### Tab Cek Ledger
Dipakai untuk memeriksa hash-chain ledger. Jika hasil gagal, transaksi dompet harus dianggap berisiko sampai diperiksa.

### Tab Top Up Midtrans
Menampilkan intent top up, status pembayaran, order ID, penyetor, dan ledger yang sudah terposting.

### Tab Notifikasi
Menampilkan antrean FCM dan notifikasi terkait dompet. Notifikasi critical yang belum direview akan menjadi perhatian audit keamanan.

### Maintenance Broadcast
Admin dapat membuat pemberitahuan pemeliharaan sistem dompet agar wali dan kantin mengetahui jadwal gangguan layanan.

## 12.5 Manajemen Kantin

Modul **Manajemen Kantin** mengelola akun kantin, merchant, outlet, saldo merchant, ledger merchant, dan pencairan.

### Konsep Kantin

- Kantin adalah role terpisah, bukan akun wali.
- Kantin dapat menjadi merchant internal pesantren.
- Setiap merchant dapat memiliki outlet.
- Petugas kantin harus di-assign ke merchant/outlet.
- Device kantin harus didaftarkan dan disetujui admin sebelum bisa transaksi.

### Tab Utama

- **Akun Kantin:** melihat akun role kantin dan status aktif.
- **Merchant:** membuat atau mengubah data merchant kantin.
- **Outlet:** membuat outlet atau titik kasir.
- **Assignment:** menghubungkan user kantin ke merchant/outlet.
- **Device:** mengaktifkan, suspend, atau revoke perangkat kantin.
- **Saldo Merchant:** melihat saldo tersedia, pending settlement, total penjualan, dan total pencairan.
- **Pencairan:** memproses pengajuan pencairan saldo kantin.
- **Ledger Merchant:** melihat riwayat saldo merchant.

### Alur Menyiapkan Kantin Baru

1. Buat akun admin dengan role **kantin**.
2. Buat merchant kantin.
3. Buat outlet jika diperlukan.
4. Assign user kantin ke merchant/outlet.
5. Kantin login di aplikasi dan mendaftarkan device.
6. Admin mengaktifkan device.
7. Kantin mulai menerima pembayaran.

### Alur Pembayaran Kantin

1. Kantin scan QR/NFC kartu santri.
2. Kantin memasukkan nominal.
3. Backend membuat sesi otorisasi.
4. Untuk nominal sampai Rp75.000, santri dapat konfirmasi dengan PIN di device kantin.
5. Untuk nominal di atas Rp75.000, transaksi membutuhkan persetujuan wali.
6. Jika sukses, saldo santri berkurang dan saldo merchant bertambah melalui ledger.
7. Wali dan kantin menerima notifikasi.

### Alur Pencairan Kantin

1. Kantin owner/manager mengajukan pencairan dari aplikasi.
2. Bendahara atau Super Admin membuka tab pencairan.
3. Periksa merchant, outlet, nominal, dan catatan.
4. Setujui atau tolak.
5. Jika sudah benar-benar dibayar dari rekening pesantren, tandai sebagai paid.
6. Simpan bukti sesuai prosedur lembaga.

### Catatan Penting

- Saldo merchant tidak boleh diedit langsung.
- Pencairan hanya boleh ditandai paid setelah dana benar-benar keluar.
- Device yang hilang atau tidak dipakai harus di-revoke.

## 12.6 Audit Keamanan Dompet

Halaman **Audit Keamanan** membantu admin menilai kesehatan sistem Dompet Santri.

### Fungsi

- Menjalankan audit keamanan satu klik.
- Menampilkan skor keamanan 0-100.
- Menampilkan status aman, perlu perhatian, berisiko, atau kritis.
- Menampilkan ringkasan lapisan Network, App, API, Database, dan Data.
- Menampilkan temuan dan rekomendasi.
- Menjalankan analisis AI dari hasil audit manual.
- Menyimpan riwayat analisis AI dan mengekspornya ke Excel.

### Hal yang Diperiksa

- Rekonsiliasi saldo.
- Hash-chain ledger.
- Freeze switch.
- Risk event terbuka.
- Dispute lewat SLA.
- Notifikasi kritis belum direview.
- Device kantin.
- Percobaan PIN gagal.
- RLS/grant database.
- QR opaque.
- Argon2id PIN.
- Cron dompet.

### Cara Menggunakan

1. Buka **Dompet Santri > Audit Keamanan**.
2. Klik jalankan audit.
3. Baca skor dan status.
4. Jika ada temuan, buka rekomendasi.
5. Jika perlu, jalankan analisis AI untuk membantu membaca prioritas risiko.
6. Tindak lanjuti temuan di halaman terkait.

### Analisis AI Auditor Dompet

Tombol **Analisis AI** hanya dapat digunakan setelah audit manual tersedia. AI tidak membaca saldo secara bebas dan tidak melakukan transaksi. AI membaca hasil audit yang sudah disaring, lalu membantu admin memahami:

- ringkasan eksekutif risiko;
- temuan kritis;
- gejala awal yang perlu diwaspadai;
- rekomendasi tindakan;
- blocker produksi;
- risiko Android;
- risiko database;
- catatan konsistensi;
- alasan jika AI menyarankan jangan lanjut produksi.

Hasil analisis disimpan di riwayat **Analisis AI Auditor** dan dapat diekspor ke Excel. Jika AI gagal, audit manual tetap menjadi sumber kebenaran.

### Catatan
Analisis AI hanya membantu membaca hasil audit. Keputusan akhir tetap berada pada admin/pengurus. AI tidak memegang saldo, tidak membuka kunci dompet, tidak mencairkan dana, dan tidak mengganti prosedur audit manual.

## 12.7 Notifikasi Dompet

Notifikasi Dompet Santri memakai antrean `notification_queue` dan token Android di `user_devices`.

Contoh notifikasi:

- Pembayaran kantin berhasil.
- Saldo rendah.
- Saldo kritis.
- Transaksi besar.
- Risk high atau critical.
- Dispute dibuka atau selesai.
- Top up gagal.
- Maintenance.
- Ringkasan mingguan.

SMS/email fallback belum diaktifkan. Untuk saat ini, peringatan kritis tampil di admin panel dan dikirim melalui FCM jika perangkat terdaftar.

---

# 13. Diklat & Pasaran

## Fungsi
Modul ini mengelola peserta program pendidikan khusus seperti diklat atau pasaran.

## Fitur Utama

- Daftar peserta.
- Master data diklat.
- Konfigurasi periode atau jenis program.
- Rekap peserta dan kebutuhan laporan.
- Pengaturan master kitab atau data pendukung program.
- Pencatatan pembayaran peserta ke transaksi keuangan jika program berbayar.

## Alur Kerja

1. Buka **Diklat & Pasaran**.
2. Siapkan master data diklat jika program baru.
3. Tambahkan peserta.
4. Isi identitas peserta, periode, dan data pembayaran jika ada.
5. Simpan peserta.
6. Gunakan daftar peserta untuk pemantauan dan laporan.

## Alur Master Data

1. Buka **Master Data Diklat**.
2. Atur konfigurasi program, periode, atau daftar kitab.
3. Simpan perubahan sebelum membuka pendaftaran atau input peserta baru.

## Catatan
Jika diklat memiliki biaya atau pembayaran, pastikan transaksi masuk tercatat konsisten dengan buku besar keuangan.

---

# 14. Informasi & Berita

## Fungsi
Modul ini dipakai untuk membuat pengumuman atau berita resmi pesantren.

## Fitur Utama

- Membuat berita.
- Mengedit berita.
- Mengelola status publikasi.
- Menyampaikan informasi kepada pengguna aplikasi.

## Catatan
Gunakan bahasa resmi dan pastikan informasi sudah disetujui sebelum dipublikasikan.

---

# 15. Manajemen Alumni

## Fungsi
Modul Alumni mengelola data alumni dan aktivitas komunitas alumni.

## Fitur Utama

- Data alumni.
- Pendataan kontak, tahun lulus, profesi, instansi, dan domisili.
- Upload atau pembaruan foto alumni jika tersedia.
- Fitur komunitas alumni seperti forum, laporan forum, moderasi, dan monitoring chat tersedia sebagai komponen pendukung dan mengikuti konfigurasi akses sistem.

## Alur Kerja

1. Buka **Manajemen Alumni**.
2. Cari alumni berdasarkan nama atau data lain.
3. Tambah atau perbarui data alumni.
4. Jika ada laporan forum/chat pada instalasi yang mengaktifkannya, tindak lanjuti melalui halaman moderasi yang tersedia.

## Catatan Keamanan
Fitur chat dan forum memiliki pengawasan. Laporan atau aktivitas bermasalah harus ditangani sesuai prosedur pesantren.

---

# 16. Inventaris Aset

## Fungsi
Modul Inventaris mencatat barang milik pesantren.

## Fitur Utama

- Daftar barang.
- Kategori barang.
- Lokasi aset.
- Detail aset.
- Pencatatan kondisi barang.

## Alur Kerja

1. Buka **Inventaris Aset**.
2. Tambahkan barang.
3. Isi kategori, lokasi, jumlah, dan kondisi.
4. Perbarui jika barang berpindah atau rusak.

---

# 17. Scan QR

## Fungsi
Modul ini dipakai untuk memindai QR yang digunakan sistem. Scanner mendukung beberapa mode: santri, peserta diklat, dan tagihan/invoice.

## Fitur Utama

- Scan QR dengan kamera.
- Input manual jika kamera tidak dapat membaca QR.
- Deteksi format QR dengan prefix seperti `SANTRI:`, `VALIDASI:`, `DIKLAT:`, dan `INV:`.
- Anti double-scan agar QR yang sama tidak terbaca berulang dalam waktu sangat dekat.
- Riwayat 10 scan terakhir.
- Statistik sesi: berhasil dan gagal.
- Mode fullscreen scanner.
- Feedback suara dan getar pada perangkat yang mendukung.

## Alur Scan Santri

1. Buka **Scan QR**.
2. Pilih mode santri atau biarkan sistem mendeteksi dari QR.
3. Scan QR santri.
4. Sistem mengambil detail santri melalui RPC aman dan menampilkan data serta ringkasan tagihan terbaru.

## Alur Scan Diklat

1. Pilih mode diklat atau scan QR dengan prefix diklat.
2. Sistem mencari peserta berdasarkan `qr_code_id`.
3. Jika ditemukan, data peserta ditampilkan.

## Alur Scan Tagihan

1. Pilih mode tagihan atau scan QR invoice dengan prefix `INV:`.
2. Sistem menampilkan detail tagihan dan data santri terkait.
3. Gunakan informasi ini untuk verifikasi, bukan sebagai bukti pembayaran final.

## Catatan
Hasil scan harus tetap diverifikasi. QR membantu mempercepat pencarian, bukan menggantikan keputusan admin.

---

# 18. Notifikasi Push

## Fungsi
Modul Notifikasi Push dipakai untuk membuat dan melihat antrean notifikasi ke aplikasi Android.

## Fitur Utama

- Membuat notifikasi.
- Melihat status terkirim atau gagal.
- Mengirim pesan ke penerima tertentu sesuai hak akses.
- Mendukung notifikasi operasional dan dompet.
- Broadcast notifikasi melalui RPC backend.
- Melihat daftar device/user tujuan sesuai data yang tersedia.

## Alur Membuat Notifikasi

1. Buka **Notifikasi Push**.
2. Klik tambah notifikasi.
3. Isi judul, isi pesan, target penerima, dan sumber/kategori.
4. Simpan atau kirim sesuai tombol yang tersedia.
5. Buka daftar notifikasi untuk memantau status.

## Alur Memeriksa Notifikasi Gagal

1. Buka daftar notifikasi.
2. Filter atau cari status gagal.
3. Periksa pesan error jika tersedia.
4. Pastikan perangkat pengguna masih aktif dan token FCM tidak kadaluarsa.

## Catatan
Jika notifikasi gagal, admin perlu memeriksa apakah perangkat pengguna masih aktif atau token FCM masih valid.

---

# 19. Log Aktivitas

## Fungsi
Log Aktivitas mencatat tindakan penting yang dilakukan admin.

## Manfaat

- Mengetahui siapa melakukan apa dan kapan.
- Membantu audit.
- Membantu menyelesaikan sengketa data.
- Menjaga akuntabilitas pengurus.

## Catatan
Jangan menganggap log sebagai gangguan. Log adalah bukti kerja dan perlindungan bagi admin.

---

# 20. AI/RAG dan Konsultan Internal

## Fungsi
Sistem memiliki **AI Intelligence Suite** melalui tombol mengambang **AI**. Fitur ini membantu admin membaca data, meminta analisis, menjalankan instruksi berbasis konfirmasi, mengambil keputusan berbasis RAG, dan membuat laporan.

File utama fitur ini adalah `GeminiConsultant.tsx`. Di dalamnya terdapat empat mode utama:

1. **Analysis**.
2. **AI Agent**.
3. **RAG Decision**.
4. **Laporan**.

Mode RAG Decision hanya tersedia untuk role tertentu: super admin, rois, dan dewan.

## RAG Knowledge Base

Selain tombol AI, sistem memiliki halaman knowledge base RAG untuk mengelola dokumen yang dipakai sebagai sumber jawaban.

Fitur RAG Knowledge Base:

- menyimpan dokumen publik, dokumen internal, dan referensi kitab;
- upload atau ekstraksi teks dari file;
- membuat chunk dokumen untuk pencarian;
- membuat draft metadata tanpa embedding;
- mengubah status dokumen: active, draft, atau archived;
- menjalankan query test untuk dokumen publik atau kitab;
- menjalankan admin decision query dengan konteks database;
- melihat log query dan statistik latency;
- melihat detail chunk;
- menghapus dokumen oleh super admin.

Alur mengelola dokumen:

1. Buka halaman RAG Knowledge Base jika role memiliki akses.
2. Pilih sumber dokumen: publik, kitab, atau internal.
3. Tambahkan dokumen atau upload file.
4. Pastikan status dokumen active jika ingin dipakai AI.
5. Jalankan query test untuk memastikan dokumen bisa ditemukan.

Catatan: RAG tidak mengganti data modul. RAG hanya memberi referensi tambahan dari dokumen yang sudah dimasukkan.

## 20.1 Mode Analysis

Mode Analysis dipakai untuk meminta analisis cepat berdasarkan data sistem yang sedang tersedia.

Topik analisis:

- **Analisa Kesehatan:** membaca data kesehatan/UKS minggu ini, melihat tren keluhan, dan memberi saran preventif.
- **Cek Kedisiplinan:** membaca data pelanggaran dan poin santri, lalu memberi saran pembinaan.
- **Audit Keuangan:** membaca pemasukan tagihan lunas, pengeluaran bulan berjalan, saldo bersih, dan kategori pengeluaran.
- **Aktivitas Admin:** membaca audit log terbaru untuk melihat pola aktivitas admin.
- **Hafalan Santri:** membaca data hafalan dan memberi ringkasan santri yang menonjol atau perlu dibimbing.
- **Konsultasi Bebas:** admin dapat menulis pertanyaan sendiri.

Mode ini memakai Edge Function `gemini-consultant`. Jawaban ditampilkan sebagai ringkasan markdown dan dapat dianalisis ulang.

## 20.2 Mode AI Agent

Mode AI Agent memungkinkan admin memberi instruksi dalam bahasa natural. Agent dapat menjawab pertanyaan atau mengusulkan aksi.

Contoh instruksi:

- "Siapa santri yang belum bayar SPP bulan ini?"
- "Buat tagihan SPP 500rb untuk semua santri aktif kelas 2."
- "Rekap pelanggaran tertinggi minggu ini."
- "Tampilkan progres hafalan terbaik santri tahfidz kelas 3."

Jika AI mengusulkan aksi, sistem menampilkan kartu **Konfirmasi Aksi AI**. Admin harus memilih **Setujui & Eksekusi** atau **Tolak**. Aksi tidak langsung dijalankan tanpa persetujuan admin.

Aksi yang didukung mencakup pembuatan tagihan, update status tagihan, update data santri, pencatatan pelanggaran, kesehatan, perizinan, prestasi, hafalan, pengeluaran, top up dompet, dan pengiriman notifikasi sesuai hak akses.

Catatan penting:

- Agent tidak dapat menghapus data.
- Semua aksi harus dikonfirmasi.
- Aksi yang disetujui atau ditolak dicatat di audit log.
- Hak akses tetap mengikuti role pengguna.

## 20.3 Mode RAG Decision

Mode RAG Decision menggabungkan data agregat database dengan dokumen internal atau referensi kitab yang sudah masuk knowledge base.

Admin dapat memilih:

- jenis konteks: operasional, keuangan, akademik, santri, atau kitab;
- kelas;
- bulan dan tahun;
- apakah memakai data database;
- apakah memakai dokumen internal;
- apakah memakai referensi kitab.

Mode ini memakai Edge Function `rag-query-admin`. Hasilnya menampilkan jawaban, sumber data yang digunakan, jumlah dokumen internal atau kitab yang dirujuk, serta catatan kepercayaan jawaban.

Contoh penggunaan:

- membandingkan kondisi keuangan bulan ini dengan dokumen rekap;
- menganalisis tren kedisiplinan berdasarkan SOP internal;
- mengevaluasi akademik dan hafalan berdasarkan data sistem dan dokumen rekap;
- meminta rekomendasi operasional mingguan.

## 20.4 Mode Laporan

Mode Laporan membantu membuat laporan Excel atau PDF dari data sistem. Mode ini memiliki parser lokal yang membaca permintaan admin, lalu mengisi parameter laporan seperti jenis laporan, format, kelas, jurusan, gender, dan rentang tanggal.

Jenis laporan yang tersedia antara lain:

- Database Santri.
- Tagihan Santri.
- Buku Besar Transaksi.
- Pengeluaran.
- Pelanggaran Santri.
- Kesehatan/UKS.
- Perizinan Santri.
- Ziyadah Tahfidz.
- Murojaah Tahfidz.
- Hafalan Kitab.
- Prestasi Santri.
- Inventaris Aset.
- Data Alumni.
- Audit Aktivitas.

Laporan dapat dibuat global atau personal per santri jika jenis laporan mendukung. Format yang tersedia adalah Excel dan PDF sesuai definisi tiap laporan.

## Contoh Penggunaan

- Mencari panduan tertentu.
- Menanyakan prosedur.
- Membantu membaca dokumen internal.
- Meminta analisis kesehatan, kedisiplinan, keuangan, aktivitas admin, dan tahfidz.
- Meminta AI Agent menyiapkan tindakan, lalu admin menyetujui atau menolak.
- Membandingkan dokumen RAG dengan data sistem.
- Membuat laporan Excel/PDF dari bahasa natural.
- Memberi ringkasan, tetapi tetap harus diverifikasi admin.

## Batasan

- AI tidak boleh dijadikan pemutus tunggal untuk transaksi, saldo, atau keputusan keamanan.
- Untuk data sensitif, ikuti hak akses dan kebijakan sistem.
- Jawaban AI harus dicek dengan data asli di modul terkait.
- AI Agent membutuhkan konfirmasi sebelum eksekusi.
- RAG Decision hanya tersedia untuk role yang diizinkan.
- AI audit Dompet Santri berada di halaman **Dompet Santri > Audit Keamanan**, terpisah dari AI Consultant umum.

---

# Prosedur Harian yang Disarankan

## Kesantrian

1. Periksa data santri baru atau perubahan data.
2. Lengkapi indikator EMIS yang belum siap.
3. Catat pelanggaran, izin, dan kesehatan pada hari yang sama.
4. Pastikan data wali aktif dan benar.

## Bendahara

1. Periksa tagihan dan transaksi masuk.
2. Periksa pengeluaran.
3. Buka **Dompet Santri > Operasional & Peringatan**.
4. Review top up, dispute, notifikasi kritis, dan rekonsiliasi.
5. Proses pencairan kantin hanya setelah bukti lengkap.

## Rois dan Pimpinan

1. Pantau Dashboard.
2. Lihat laporan keuangan, santri, dan Dompet Santri.
3. Tindak lanjuti event critical atau dispute yang dieskalasi.

## Super Admin

1. Pantau akun admin.
2. Cabut akses pengurus yang tidak lagi bertugas.
3. Jalankan audit keamanan Dompet Santri secara berkala.
4. Pastikan modul kritis tidak memiliki event terbuka terlalu lama.

---

# Daftar Hal yang Tidak Boleh Dilakukan

- Menggunakan satu akun admin untuk banyak orang.
- Mengubah saldo Dompet Santri langsung dari database atau luar menu resmi.
- Menghapus ledger transaksi.
- Menganggap screenshot pembayaran sebagai bukti final.
- Memberikan role super admin kepada operator biasa.
- Mencetak atau menyimpan PIN, private key, token, nonce, atau data rahasia lain.
- Mengaktifkan device kantin yang tidak jelas pemiliknya.
- Menandai pencairan kantin sebagai paid sebelum dana benar-benar keluar.
- Mengabaikan peringatan critical.
- Menggunakan AI untuk mengambil keputusan finansial tanpa verifikasi.

---

# Lampiran: Istilah Penting

**EMIS:** sistem pelaporan data pendidikan Islam dari Kementerian Agama.  
**Geocode:** proses mengubah alamat menjadi koordinat peta.  
**Ledger:** catatan transaksi yang tidak boleh diubah atau dihapus.  
**Cached balance:** saldo cepat tampil yang dihitung dan dijaga oleh sistem, bukan sumber kebenaran utama.  
**Closed-loop:** saldo hanya berlaku di lingkungan pesantren.  
**Wallet public ID:** identitas publik pada QR kartu dompet, bukan rahasia.  
**Dispute:** laporan wali atas transaksi yang dipermasalahkan.  
**Reversal/refund:** transaksi baru untuk mengembalikan saldo, bukan menghapus transaksi lama.  
**Rekonsiliasi:** proses mencocokkan saldo sistem dengan catatan terkait.  
**Hash-chain:** perlindungan agar perubahan tidak sah pada ledger bisa terdeteksi.  
**Freeze:** penghentian sementara transaksi dompet karena alasan keamanan.  
**FCM:** layanan pengiriman notifikasi ke aplikasi Android.  
**RLS:** pembatasan akses data di database berdasarkan aturan keamanan.

---

# Penutup

Admin Panel Al-Hasanah sekarang menjadi pusat operasional pesantren yang lebih lengkap dan lebih aman. Kunci penggunaan yang benar adalah memasukkan data dengan rapi, mengikuti alur resmi, menjaga akun masing-masing, dan tidak melewati prosedur keamanan terutama pada modul Dompet Santri.

Jika terjadi perbedaan antara catatan manual dan data sistem, gunakan data sistem sebagai acuan awal, lalu periksa ledger, audit log, riwayat transaksi, dan catatan admin sebelum mengambil keputusan.
