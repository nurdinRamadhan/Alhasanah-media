# PANDUAN PRODUK AL-HASANAH MEDIA
## Sistem Manajemen Pondok Pesantren Digital

**Versi:** 1.0  
**Dipersiapkan untuk:** Kepala Pesantren & Pengurus Yayasan  

---

### Tentang Sistem Ini
AL-HASANAH MEDIA Admin Panel adalah platform manajemen terpadu yang dirancang khusus untuk memenuhi kebutuhan digitalisasi pondok pesantren modern. Sistem ini mengintegrasikan berbagai aspek operasional pesantren, mulai dari manajemen data santri, pemantauan kegiatan akademik dan tahfidz, hingga pengelolaan keuangan dan inventaris dalam satu pintu yang aman dan mudah diakses.

Dengan menggunakan teknologi terkini, sistem ini membantu pengurus pesantren untuk mengurangi ketergantungan pada pencatatan manual, meningkatkan akurasi data, dan memudahkan pelaporan real-time kepada pihak yayasan maupun wali santri. Fokus utama sistem ini adalah memberikan transparansi dan efisiensi dalam pengelolaan harian pesantren.

### Tentang Dokumen Ini
Dokumen ini adalah panduan lengkap Admin Panel AL-HASANAH MEDIA. Setiap modul dijelaskan secara rinci: apa fungsinya, siapa yang menggunakannya, dan bagaimana cara kerjanya. Panduan ini disusun untuk membantu pengurus pesantren memahami fitur-fitur yang tersedia tanpa memerlukan latar belakang teknis yang mendalam.

### Keunggulan Teknologi (Tech Stack)
Sistem AL-HASANAH MEDIA dibangun menggunakan kombinasi teknologi mutakhir tingkat dunia yang biasanya digunakan oleh perusahaan teknologi besar, namun dioptimalkan khusus untuk kebutuhan pesantren:
*   **Kecepatan Tinggi (Refine & React):** Menjamin sistem tetap responsif dan cepat saat diakses meskipun data santri dan transaksi keuangan berjumlah ribuan.
*   **Antarmuka Modern (Ant Design):** Menghadirkan tampilan yang bersih, profesional, dan intuitif sehingga pengurus pesantren dapat menguasai penggunaan sistem dalam waktu singkat.
*   **Keamanan Data Maksimal (Supabase Cloud):** Seluruh data disimpan dalam basis data terenkripsi di awan (*cloud*), menjamin data tidak hilang saat perangkat fisik rusak dan terlindungi dari akses pihak yang tidak berwenang.
*   **Sinkronisasi Real-Time:** Setiap perubahan data yang dilakukan oleh satu pengurus akan langsung terupdate di seluruh perangkat lain secara instan.

### Manfaat Utama Bagi Pesantren
Implementasi sistem ini bukan sekadar digitalisasi, melainkan transformasi manajemen lembaga:
1.  **Efisiensi Administrasi:** Menghilangkan ketergantungan pada buku besar manual yang berisiko rusak atau hilang, serta mempercepat proses pencatatan hingga 80%.
2.  **Transparansi Keuangan Mutlak:** Pimpinan dapat memantau saldo kas, total tunggakan SPP, dan rincian pengeluaran secara detik demi detik tanpa perlu menunggu laporan mingguan.
3.  **Kendali Akademik Terukur:** Memudahkan ustadz dalam mencatat progres hafalan dan nilai santri secara terpadu, sehingga target pendidikan pesantren dapat tercapai dengan lebih terencana.
4.  **Pelayanan Wali Santri Profesional:** Meningkatkan kepercayaan orang tua santri melalui laporan digital yang rapi dan notifikasi instan langsung ke ponsel mereka melalui aplikasi wali.
5.  **Aset Digital Jangka Panjang:** Membangun database alumni dan arsip kegiatan yang rapi sebagai modal berharga untuk pengembangan pesantren di masa depan.

### Daftar Modul
Berdasarkan analisis sistem, berikut adalah modul-modul yang tersedia dalam AL-HASANAH MEDIA:

1. **Dashboard (Halaman Utama):** Ringkasan informasi penting pesantren secara visual.
2. **Profil Pesantren:** Pengaturan informasi dasar dan identitas lembaga.
3. **Manajemen Admin:** Pengaturan akses pengguna bagi staf pengurus.
4. **Data Santri:** Pusat informasi identitas, status, dan persebaran lokasi santri.
5. **Kesantrian (Harian):** Pencatatan kedisiplinan (pelanggaran), perizinan keluar, dan rekam kesehatan santri.
6. **Akademik:** Pemantauan progres hafalan Al-Qur'an (ziyadah), pengulangan (murojaah), dan hafalan kitab.
7. **Ujian & Laporan Nilai:** Pengelolaan nilai raport, bank soal, dan pelaksanaan ulangan mingguan digital.
8. **Keuangan & SPP:** Manajemen tagihan santri dan pembayaran biaya pendidikan.
9. **Pengeluaran:** Pencatatan arus kas keluar untuk operasional pesantren.
10. **Diklat & Pasaran:** Pengelolaan program pendidikan khusus (diklat) dan peserta kursus singkat.
11. **Informasi & Berita:** Media komunikasi pengumuman resmi pesantren.
12. **Manajemen Alumni:** Basis data lulusan untuk menjaga silaturahmi dan jaringan.
13. **Inventaris Aset:** Pendataan barang milik pesantren untuk pemeliharaan yang lebih baik.
14. **Scan QR:** Alat operasional untuk verifikasi identitas atau absensi berbasis kode QR.
15. **Layanan Notifikasi:** Layanan pengiriman pesan instan ke aplikasi pengguna/wali.
16. **Log Aktivitas:** Rekam jejak permanen untuk audit keamanan sistem.

---

## 1. Dashboard (Halaman Utama)

### Gambaran Umum
Dashboard adalah halaman pertama yang dilihat oleh pengelola saat masuk ke sistem. Modul ini berfungsi sebagai "pusat kendali" yang menyajikan ringkasan data penting dari seluruh aktivitas pesantren secara visual. Tujuannya adalah memberikan gambaran cepat mengenai kondisi kesehatan keuangan, jumlah santri, dan efektivitas kegiatan pendidikan tanpa harus membuka laporan satu per satu.

### Siapa yang Menggunakan Modul Ini?
*   **Super Admin, Rois, & Dewan:** Untuk memantau arus kas dan statistik pertumbuhan santri secara keseluruhan.
*   **Bendahara & Kesantrian:** Untuk melihat pembaruan data harian dan efisiensi program yang sedang berjalan sesuai bidangnya.

### Fitur-Fitur Utama

#### Ringkasan Metrik Utama (KPI)
Menampilkan empat indikator utama dalam bentuk kartu informasi yang mudah dibaca:
*   **Santri Mukim Aktif:** Jumlah total santri yang saat ini sedang menempuh pendidikan di pesantren.
*   **Pemasukan Syahriah:** Total dana yang masuk dari iuran bulanan/pembayaran santri.
*   **Pengeluaran Operasional:** Total biaya yang telah dikeluarkan untuk kebutuhan pesantren.
*   **Sisa Kas Pesantren:** Saldo bersih (surplus/defisit) setelah dikurangi pengeluaran.

#### Analisis Arus Kas Tahunan
Grafik interaktif yang membandingkan pemasukan dan pengeluaran dari bulan ke bulan. Fitur ini membantu pengurus untuk melihat tren kapan pengeluaran melonjak dan kapan pemasukan paling optimal.

#### Komposisi Pengeluaran
Diagram lingkaran yang membagi pengeluaran berdasarkan kategori (misal: operasional, dapur, gaji, dll.). Hal ini memudahkan evaluasi pos pengeluaran mana yang paling besar menyerap dana.

#### Statistik Kegiatan Diklat & Pasaran
Bagian khusus yang memantau performa program pendidikan khusus (seperti Maulid, Syaban, Ramadhan, atau Dzulhijjah). Pengguna dapat melihat perbandingan jumlah peserta dan total dana yang terkumpul untuk setiap periode kegiatan dalam kalender Hijriah.

### Alur Kerja Tipikal
1.  **Membuka Dashboard:** Pengguna masuk ke sistem dan langsung melihat ringkasan data terbaru.
2.  **Filter Tahun:** Pengguna dapat mengubah filter tahun (Masehi atau Hijriah) di pojok kanan atas untuk melihat data masa lalu atau memantau progres tahun berjalan.
3.  **Evaluasi Visual:** Pengguna meninjau grafik untuk melihat apakah ada kejanggalan dalam arus kas atau penurunan jumlah peserta diklat.
4.  **Tindak Lanjut:** Jika ditemukan ketidaksesuaian data, pengguna akan menuju ke modul terkait (misal: Keuangan atau Data Santri) untuk memeriksa detailnya.

---

## 2. Profil Pesantren

### Gambaran Umum
Modul Profil Pesantren adalah tempat utama untuk mengelola identitas digital lembaga. Di sini, pengurus dapat mengatur informasi dasar seperti nama pesantren, kontak resmi, hingga struktur organisasi kepengurusan. Data yang diisi di sini akan menjadi referensi utama bagi sistem dalam mencetak surat, laporan, atau menampilkan identitas pada aplikasi wali santri.

### Siapa yang Menggunakan Modul Ini?
*   **Super Admin & Rois:** Untuk memperbarui profil lembaga dan menyusun struktur kepengurusan resmi.

### Fitur-Fitur Utama

#### Identitas Lembaga (Hero Section)
Menampilkan profil visual pesantren yang mencakup:
*   **Logo Resmi:** Menampilkan identitas visual lembaga.
*   **Informasi Kontak:** Alamat email dan nomor telepon resmi yang dapat dihubungi.
*   **Alamat Fisik:** Lokasi lengkap pesantren untuk referensi administratif.
*   **Tahun Ajaran Aktif:** Menandai periode pendidikan yang sedang berjalan di sistem.

#### Struktur Organisasi Interaktif
Fitur unggulan yang menampilkan hierarki kepengurusan pesantren dalam bentuk bagan pohon (tree chart) yang modern dan interaktif:
*   **Visualisasi Hierarki:** Memudahkan untuk melihat siapa pimpinan utama dan siapa bawahannya (misal: dari Pengasuh hingga Rois Bidang).
*   **Kartu Pejabat:** Setiap jabatan menampilkan foto, nama lengkap, dan nomor identitas (NIP/NIY).
*   **Kustomisasi Warna:** Pengguna dapat memberikan warna khusus pada setiap kartu jabatan untuk membedakan divisi atau tingkatan.
*   **Zoom & Pan:** Bagan dapat diperbesar atau diperkecil untuk memudahkan navigasi pada struktur yang besar.

#### Manajemen Kepengurusan
Pengguna dapat dengan mudah menambah, mengubah, atau menghapus posisi dalam struktur organisasi:
*   **Tambah Jabatan:** Menambahkan posisi baru di bawah atasan tertentu.
*   **Unggah Foto:** Fitur untuk mengunggah foto pengurus langsung ke dalam sistem.
*   **Urutan Tampilan:** Mengatur posisi kartu secara horizontal agar terlihat rapi dan sesuai prioritas.

### Alur Kerja Tipikal
1.  **Memperbarui Identitas:** Klik tombol edit pada profil utama untuk mengubah nomor telepon atau alamat jika ada perubahan.
2.  **Menyusun Struktur:** Pengguna mulai dengan menambahkan "Pimpinan Utama".
3.  **Menambah Bawahan:** Klik tombol "+" pada kartu pimpinan untuk menambahkan jabatan di bawahnya (misal: Bendahara, Rois Bidang).
4.  **Mengunggah Foto Pengurus:** Klik foto pada saat mengedit jabatan untuk memperbarui foto pejabat terkait.
5.  **Navigasi Bagan:** Gunakan fitur zoom jika struktur sudah mulai kompleks untuk memastikan semua bagian terlihat dengan jelas.

---

## 3. Manajemen Admin

### Gambaran Umum
Modul Manajemen Admin digunakan untuk mengelola akun para pengurus yang memiliki hak akses ke dalam sistem. Sistem ini menerapkan prinsip **RBAC (Role-Based Access Control)**, yang artinya setiap pengurus hanya dapat melihat dan mengelola data sesuai dengan jabatan dan wewenang yang diberikan. Hal ini sangat penting untuk menjaga kerahasiaan data santri dan akurasi laporan keuangan.

### Siapa yang Menggunakan Modul Ini?
*   **Super Admin:** Satu-satunya peran yang memiliki otoritas penuh untuk menambah, menghapus, atau mengubah hak akses akun lainnya.

### Fitur-Fitur Utama

#### Pengaturan Jabatan (Role)
Akun dapat dikelompokkan berdasarkan role yang tersedia di sistem:
*   **Super Admin:** Akses penuh ke seluruh sistem tanpa batasan.
*   **Rois:** Akses luas untuk pengawasan seluruh bidang operasional.
*   **Dewan:** Akses pemantauan (Read-Only) untuk data akademik dan hafalan santri.
*   **Bendahara:** Fokus pada pengelolaan tagihan, keuangan, pengeluaran, dan inventaris.
*   **Kesantrian:** Fokus pada data kedisiplinan, perizinan, kesehatan, akademik, dan alumni.

#### Pembatasan Akses (Data Filtering)
Sistem memungkinkan pengaturan akses yang lebih spesifik demi privasi dan efisiensi:
*   **Akses Gender:** Akun dapat dibatasi hanya untuk melihat data santri Putra saja, Putri saja, atau keduanya. Sangat berguna untuk pengurus asrama yang dipisah berdasarkan gender.
*   **Akses Akademik:** Pembatasan akses berdasarkan peminatan santri, misalnya akun yang hanya mengelola program Tahfidz atau program Kitab saja.

#### Registrasi Akun Baru
Proses pembuatan akun pengurus yang aman melalui formulir pendaftaran resmi yang mencakup email institusi, password awal, dan identitas lengkap beserta gelarnya.

#### Pemantauan Status & Audit
*   **Status Keaktifan:** Menampilkan apakah akun pengurus sedang aktif atau dinonaktifkan.
*   **Audit Log (Catatan Aktivitas):** Setiap tindakan pembuatan atau penghapusan akun akan dicatat secara otomatis untuk keperluan keamanan dan audit.

#### Penghapusan Akses Permanen
Fitur untuk mencabut seluruh hak akses pengurus yang sudah tidak bertugas lagi secara permanen dari sistem.

### Alur Kerja Tipikal
1.  **Menambah Pengurus Baru:** Super Admin membuka menu "Tambah Admin", mengisi identitas pengurus, menentukan role (Rois/Bendahara/dll), dan mengatur batasan aksesnya (Gender/Akademik).
2.  **Verifikasi Akun:** Pengurus baru menerima email dan password untuk login ke sistem.
3.  **Memantau Daftar Admin:** Super Admin meninjau daftar akun yang ada untuk memastikan status keaktifan dan role sudah sesuai.
4.  **Menghapus Akses:** Jika ada pengurus yang sudah tidak menjabat, Super Admin melakukan penghapusan akun untuk mencegah akses yang tidak sah.

---

## 4. Data Santri

### Gambaran Umum
Modul Data Santri adalah pusat penyimpanan data induk (database) seluruh santri yang menempuh pendidikan di pesantren. Modul ini tidak hanya menyimpan biodata dasar, tetapi juga mengintegrasikan informasi akademik, keluarga, hingga identitas digital. Setiap santri diberikan **Nomor Induk Santri (NIS)** yang unik sebagai identitas utama dalam sistem.

### Siapa yang Menggunakan Modul Ini?
*   **Kesantrian & Super Admin:** Untuk pendaftaran santri baru dan pembaruan data biodata.
*   **Rois, Dewan, & Bendahara:** Untuk melihat rekam jejak santri secara cepat dan akurat (Bendahara hanya memiliki akses baca).

### Fitur-Fitur Utama

#### Database Santri Terpadu
Tampilan tabel yang profesional untuk mengelola daftar santri dengan kemampuan:
*   **Pencarian Cepat:** Mencari santri berdasarkan nama atau NIS.
*   **Filter Canggih:** Menyaring daftar santri berdasarkan Gender (Putra/Putri), Status (Aktif/Lulus/Keluar), dan Jurusan/Takhasus.
*   **Informasi Status:** Menampilkan indikator visual apakah santri masih aktif, sudah lulus, atau menjadi alumni.

#### Profil Digital Santri (Show Page)
Halaman detail yang menyajikan profil lengkap santri secara visual, mencakup:
*   **Data Diri:** Biodata lengkap, NIK, tempat tanggal lahir, dan alamat.
*   **Data Akademik:** Informasi kelas, jurusan (Tahfidz/Kitab), pembimbing, dan tanggal masuk.
*   **Statistik Capaian:** Ringkasan jumlah juz hafalan Al-Qur'an dan daftar kitab yang telah diselesaikan.
*   **Data Wali:** Informasi ayah, ibu, dan akun wali santri yang terhubung dalam sistem.

#### Kartu Identitas Digital (QR Code)
Sistem secara otomatis menghasilkan kode QR unik untuk setiap santri. Kode ini berfungsi sebagai:
*   **Digital ID:** Identitas yang dapat dipindai untuk keperluan absensi, perizinan, atau akses layanan pesantren lainnya.
*   **Validasi Data:** Memudahkan verifikasi identitas secara cepat melalui perangkat seluler.

#### Cetak Biodata & Kartu ID
Pengguna dapat mencetak dokumen biodata santri secara profesional dalam format A4. Dokumen ini sudah dilengkapi dengan kop surat resmi pesantren, foto santri, kode QR validasi, dan kolom tanda tangan, sehingga siap digunakan untuk keperluan administrasi formal.

#### Ekspor Data ke Excel
Fitur untuk mengunduh seluruh database santri ke dalam format file Excel (.xlsx). File yang diunduh sudah diformat dengan rapi, memiliki kop lembaga, dan siap untuk digunakan dalam pelaporan eksternal atau keperluan kearsipan fisik.

### Alur Kerja Tipikal
1.  **Pendaftaran:** Pengguna mengisi formulir "Santri Baru" dengan data lengkap dan mengunggah foto santri.
2.  **Manajemen Data:** Jika ada perubahan alamat atau pembimbing, pengguna memperbarui data melalui menu "Edit".
3.  **Cetak Dokumen:** Setelah pendaftaran selesai, pengguna membuka profil santri dan mengklik "Cetak Kartu ID" untuk diberikan kepada santri.
4.  **Pelaporan:** Secara berkala, pengguna mengunduh laporan Excel untuk diberikan kepada Rois sebagai laporan bulanan jumlah santri aktif.

---

## 5. Kesantrian (Harian)

### Gambaran Umum
Modul Kesantrian adalah pusat pengelolaan aktivitas harian santri yang mencakup kedisiplinan, mobilitas (perizinan), dan kesehatan. Modul ini dirancang untuk memastikan lingkungan pesantren tetap aman, tertib, dan sehat bagi seluruh santri. Pengguna dapat memantau setiap kejadian penting secara real-time, mulai dari catatan pelanggaran hingga rekam medis santri di UKS.

### Siapa yang Menggunakan Modul Ini?
*   **Kesantrian:** Sebagai operator utama yang mencatat pelanggaran, perizinan, dan kesehatan.
*   **Super Admin & Rois:** Untuk memantau grafik kedisiplinan dan kesehatan santri secara umum.

### Fitur-Fitur Utama

#### Buku Kedisiplinan (Pelanggaran)
Sistem pencatatan pelanggaran yang transparan dan terukur:
*   **Klasifikasi Pelanggaran:** Membagi pelanggaran menjadi tiga kategori: Ringan, Sedang, dan Berat.
*   **Sistem Poin Otomatis:** Setiap kategori pelanggaran memiliki bobot poin tertentu yang akan terakumulasi otomatis pada profil santri.
*   **Manajemen Hukuman (Iqob):** Pencatatan bentuk pertanggungjawaban atau hukuman yang diberikan kepada santri.
*   **Reset Poin Tahunan:** Fitur untuk membersihkan riwayat poin pada setiap awal tahun ajaran baru.

#### Monitoring Perizinan
Sistem pengelolaan izin keluar pesantren yang ketat untuk keamanan santri:
*   **Status Approval:** Setiap pengajuan izin melalui tahap verifikasi (Menunggu, Disetujui, atau Ditolak).
*   **Rencana Kembali:** Sistem mencatat kapan santri seharusnya kembali ke pesantren dan memberikan peringatan visual jika terlambat.
*   **Input Kedatangan:** Fitur untuk mencatat waktu saat santri kembali ke pesantren guna menutup status izin.
*   **Laporan Riwayat Personal:** Fitur untuk mengunduh seluruh riwayat izin satu santri tertentu dalam format Excel.

#### Layanan Kesehatan (UKS)
Pencatatan medis sederhana namun komprehensif bagi santri:
*   **Rekam Medis (Diagnosa):** Mencatat keluhan atau gejala yang dirasakan santri saat berobat ke UKS.
*   **Tindakan & Pemberian Obat:** Mencatat tindakan medis yang dilakukan atau obat yang diberikan kepada santri.
*   **Laporan Bulanan UKS:** Fitur untuk mengekspor rekapitulasi kesehatan santri dalam periode tertentu untuk bahan evaluasi gizi atau kebersihan lingkungan.

### Alur Kerja Tipikal
1.  **Mencatat Pelanggaran:** Jika santri melanggar aturan, Kesantrian membuka menu Pelanggaran, memilih nama santri, kategori pelanggaran, dan sistem akan otomatis menambahkan poin kumulatif.
2.  **Proses Perizinan:** Santri mengajukan izin -> Kesantrian menginput data rencana kembali dan alasan -> Pimpinan memberikan persetujuan (Approved) melalui sistem -> Saat santri kembali, Kesantrian mengklik tombol "Kembali".
3.  **Penanganan Sakit:** Santri datang ke UKS -> Kesantrian mencatat keluhan dan tindakan medis -> Jika sering sakit yang sama, Kesantrian mengunduh "Rekam Medis Personal" untuk dikonsultasikan dengan orang tua.
4.  **Pelaporan Berkala:** Di akhir bulan, Kesantrian mengunduh "Rekap Pelanggaran" dan "Laporan UKS" untuk bahan rapat evaluasi kepengurusan.

---

## 6. Akademik

### Gambaran Umum
Modul Akademik adalah pusat pemantauan kemajuan pendidikan santri yang berfokus pada hafalan (tahfidz) Al-Qur'an dan penguasaan kitab-kitab keagamaan (takhasus). Modul ini memungkinkan dewan guru untuk mencatat setoran harian secara digital, memantau kualitas hafalan, dan menghasilkan laporan progres capaian secara otomatis untuk setiap santri.

### Siapa yang Menggunakan Modul Ini?
*   **Dewan & Kesantrian:** Untuk menginput setoran hafalan harian, setoran kitab, dan memberikan penilaian.
*   **Super Admin & Rois:** Untuk melihat rekapitulasi capaian pendidikan seluruh santri secara keseluruhan.

### Fitur-Fitur Utama

#### Monitoring Tahfidz (Ziyadah)
Sistem pencatatan setoran hafalan baru (ziyadah) Al-Qur'an yang detail:
*   **Input Setoran Per Surat:** Pengguna dapat memilih nama surat dan menentukan rentang ayat yang disetorkan.
*   **Manajemen Juz:** Mencatat posisi juz yang sedang dihafal dan total akumulasi juz yang sudah diselesaikan oleh santri.
*   **Kualitas Hafalan (Predikat):** Memberikan penilaian kualitas setoran (Mumtaz, Jayyid, atau Kurang) sebagai bahan evaluasi.

#### Pemantauan Murojaah (Pengulangan)
Memastikan hafalan yang sudah disetorkan tetap terjaga (mutqin):
*   **Metode Input Fleksibel:** Pengulangan dapat dicatat berdasarkan nama surat/ayat atau berdasarkan nomor halaman Al-Qur'an (1-604).
*   **Klasifikasi Sabaq & Manzil:** Membedakan antara pengulangan hafalan baru (Sabaq) dan pengulangan hafalan yang sudah lama (Manzil).
*   **Rapor Murojaah Personal:** Fitur untuk mengunduh riwayat pengulangan santri dalam periode tertentu untuk dipantau oleh wali santri.

#### Takhasus Hafalan Kitab
Pencatatan progres hafalan teks keagamaan (nadhom/natsar):
*   **Daftar Kitab Terstandar:** Mendukung berbagai kitab seperti Alfiyah, Imrity, Jurumiyah, dan lainnya.
*   **Sistem Bait & Halaman:** Jika kitab berbentuk syair (nadhom), progres dicatat per nomor bait. Jika berbentuk prosa (natsar), progres dicatat per nomor halaman.
*   **Monitoring Progress Terakhir:** Tampilan tabel yang cerdas untuk melihat posisi terakhir setiap santri dalam satu tampilan.

#### Laporan Capaian (Excel Export)
Fitur untuk menghasilkan laporan progres pendidikan yang rapi dalam format Excel. Laporan ini mencakup total juz, posisi hafalan terakhir, dan nama pembimbing, yang sangat berguna untuk bahan rapat kenaikan tingkat atau laporan periodik ke yayasan.

### Alur Kerja Tipikal
1.  **Setoran Harian:** Santri menyetorkan hafalan -> Dewan/Kesantrian membuka menu "Input Setoran" -> Memilih nama santri dan mengisi surat/ayat serta memberikan penilaian predikat.
2.  **Pembaruan Total Juz:** Setelah santri menyelesaikan satu juz, pengguna memperbarui kolom "Total Juz" pada profil santri agar data di dashboard tersinkronisasi.
3.  **Evaluasi Kelancaran:** Pengguna meninjau daftar "Murojaah" untuk melihat apakah santri rajin mengulang hafalan lamanya.
4.  **Ujian Kitab:** Saat santri menyelesaikan satu bab kitab, pengguna menginput data setoran kitab dengan status "Lulus" agar santri bisa lanjut ke bab berikutnya.

---

## 7. Ujian & Laporan Nilai

### Gambaran Umum
Modul ini adalah pusat evaluasi prestasi santri yang mencakup dua fungsi besar: **Sistem Ulangan Mingguan** untuk pelaksanaan ujian digital secara berkala, dan **Laporan Nilai Akademik** untuk rekapitulasi nilai akhir (Raport). Modul ini membantu pesantren bertransformasi dari sistem ujian berbasis kertas menjadi digital yang lebih efisien, sekaligus memudahkan pencetakan dokumen formal bagi wali santri.

### Siapa yang Menggunakan Modul Ini?
*   **Dewan & Kesantrian:** Untuk mengelola bank soal, menyusun rencana ulangan mingguan, dan menginput nilai harian/akhir santri.
*   **Super Admin & Rois:** Untuk meninjau rekapitulasi nilai secara keseluruhan sebelum dicetak.

### Fitur-Fitur Utama

#### Bank Soal Digital
Gudang penyimpanan soal-soal ujian yang dapat digunakan kembali:
*   **Dukungan Teks Arab:** Antarmuka khusus untuk menginput teks soal dalam bahasa Arab dengan rapi.
*   **Kategorisasi Kitab:** Soal dapat dikelompokkan berdasarkan nama kitab, bab, dan tingkat kesulitan.
*   **Riwayat Penggunaan:** Sistem menandai soal yang sudah pernah diujikan untuk menghindari pengulangan soal yang sama.

#### Sistem Pembuatan Ulangan (Wizard)
Fitur bertahap untuk menyusun rencana ujian baru:
1.  **Info Pelaksanaan:** Menentukan judul ulangan, tanggal, dan tahun ajaran.
2.  **Seleksi Soal:** Memilih soal-soal dari bank soal dengan fitur geser (transfer) yang mudah.
3.  **Finalisasi:** Meninjau draft sebelum disimpan sebagai rencana ulangan aktif.

#### Input Nilai & Raport
Pusat manajemen nilai akhir yang terintegrasi:
*   **Input Massal Per Kelas:** Dewan dapat menginput nilai seluruh santri dalam satu kelas untuk mata pelajaran tertentu dalam satu tampilan tabel.
*   **Manajemen KKM:** Memantau apakah nilai santri sudah memenuhi standar minimal (KKM). Nilai di bawah standar akan ditandai secara visual.
*   **Cetak Rapor Profesional:** Fitur untuk mencetak dokumen Rapor resmi dalam format A4, lengkap dengan kop lembaga, rincian nilai, predikat, dan kolom tanda tangan.

#### Arsip & Riwayat Nilai
Menyimpan riwayat ujian yang sudah selesai untuk keperluan audit akademik di masa mendatang atau sebagai bahan perbandingan perkembangan santri dari tahun ke tahun.

### Alur Kerja Tipikal
1.  **Persiapan Soal:** Dewan/Kesantrian menginput kumpulan soal ke dalam "Bank Soal".
2.  **Penyusunan Ujian:** Pengguna menggunakan fitur "Buat Ulangan Baru", mengisi jadwal, dan menarik beberapa soal dari bank soal yang sudah ada.
3.  **Pelaksanaan & Input Nilai:** Setelah ujian selesai, Dewan membuka menu "Input Nilai Akademik", memilih kelas dan mata pelajaran, lalu memasukkan nilai angka untuk setiap santri.
4.  **Cetak Rapor:** Di akhir periode (semester/tahunan), pengguna mencetak Rapor melalui menu "Cetak Rapor PDF" untuk diberikan kepada wali santri.

---

## 8. Keuangan & SPP

### Gambaran Umum
Modul Keuangan & SPP dirancang untuk mengelola seluruh aspek pendapatan pesantren yang bersumber dari santri. Modul ini memungkinkan pengurus untuk membuat tagihan biaya pendidikan (SPP/Syahriah), memantau tunggakan secara real-time, hingga memproses pembayaran baik secara tunai maupun otomatis melalui gerbang pembayaran digital (Payment Gateway).

### Siapa yang Menggunakan Modul Ini?
*   **Bendahara:** Sebagai operator utama untuk membuat tagihan, memverifikasi pembayaran tunai, dan mengunduh laporan keuangan.
*   **Super Admin:** Untuk pengawasan menyeluruh dan pengaturan integrasi sistem pembayaran digital.

### Fitur-Fitur Utama

#### Manajemen Tagihan Cerdas
*   **Generate Tagihan Massal:** Fitur efisiensi untuk membuat tagihan SPP bagi seluruh santri dalam satu kelas sekaligus tanpa harus menginput satu per satu.
*   **Tagihan Personal:** Digunakan untuk biaya khusus yang bersifat individu, seperti biaya seragam atau buku.
*   **Jatuh Tempo & Peringatan:** Sistem mencatat tanggal batas akhir pembayaran untuk membantu mengidentifikasi keterlambatan.

#### Pembayaran Multi-Metode
*   **Pembayaran Tunai (Cash):** Bendahara dapat menerima uang fisik dan mengonfirmasi pelunasan secara manual di sistem.
*   **Pembayaran Digital (QRIS & Transfer):** Wali santri membayar via bank transfer atau QRIS yang statusnya akan berubah menjadi "LUNAS" secara otomatis oleh sistem tanpa perlu verifikasi manual.

#### Bukti Bayar & Pelaporan
*   **Cetak Struk/Kwitansi Digital:** Menghasilkan bukti bayar resmi dalam format PDF yang rapi, lengkap dengan kode QR validasi untuk wali santri.
*   **Kartu Syahriah (Kartu SPP):** Fitur untuk mengunduh riwayat pembayaran santri selama satu tahun dalam satu lembar Excel.
*   **Export Rekapitulasi Global:** Laporan menyeluruh mengenai total pemasukan dalam rentang waktu tertentu untuk laporan keuangan bulanan.

#### Pemantauan Tunggakan (Aging)
Dasbor statistik yang menampilkan total nominal dana yang belum dibayarkan oleh santri, membantu perencanaan anggaran operasional.

### Alur Kerja Tipikal
1.  **Pembuatan Tagihan:** Bendahara menggunakan fitur "Generate Massal" di awal bulan untuk seluruh santri aktif.
2.  **Informasi Tagihan:** Wali santri melihat rincian tagihan di aplikasi mereka.
3.  **Pelunasan:** Santri membayar tunai ke Bendahara -> Bendahara mencari nama santri -> Mengklik tombol "Bayar" -> Memilih metode "Tunai" -> Sistem menandai sebagai Lunas.
4.  **Cetak Bukti:** Bendahara mencetak atau mengirimkan file PDF struk bukti bayar kepada wali santri.
5.  **Audit Bulanan:** Di akhir bulan, Bendahara mengunduh "Rekap Keuangan Global" untuk diserahkan kepada Rois.

---

## 9. Pengeluaran

### Gambaran Umum
Modul Pengeluaran digunakan untuk mencatat setiap dana yang keluar dari kas pesantren guna keperluan operasional dan pembangunan. Dengan modul ini, pengurus dapat memantau efisiensi anggaran, mengelompokkan pengeluaran berdasarkan kategori tertentu (seperti operasional, dapur, atau pembangunan), dan menyimpan bukti transaksi secara digital.

### Siapa yang Menggunakan Modul Ini?
*   **Bendahara:** Untuk mencatat transaksi pengeluaran harian dan mengunggah bukti nota belanja.
*   **Super Admin:** Untuk meninjau dan mengevaluasi total biaya operasional pesantren.

### Fitur-Fitur Utama

#### Pencatatan Transaksi Detail
Setiap pengeluaran dicatat dengan informasi lengkap yang mencakup:
*   **Judul Pengeluaran:** Nama transaksi (misal: "Beli Sayur Mingguan", "Listrik Januari").
*   **Kategori Biaya:** Pengelompokan pengeluaran (Operasional, Dapur, Pembangunan, dll.) untuk mempermudah analisis anggaran.
*   **Nominal & Tanggal:** Pencatatan jumlah uang dan waktu terjadinya pengeluaran.
*   **Keterangan Tambahan:** Detail tambahan mengenai peruntukan biaya tersebut.

#### Digitalisasi Bukti Transaksi (Upload Nota)
Bendahara dapat mengunggah foto nota atau kwitansi fisik langsung ke sistem untuk transparansi dan verifikasi cepat oleh pimpinan.

#### Statistik & Monitoring Visual
Dasbor mini yang menampilkan ringkasan pengeluaran secara real-time:
*   **Total Pengeluaran Bulan Ini:** Akumulasi biaya sejak awal bulan berjalan.
*   **Pengeluaran Hari Ini:** Transaksi yang baru saja terjadi hari ini.

#### Laporan Profesional (Excel & PDF)
Sistem dapat menghasilkan rekapitulasi Excel detail dan Voucher Pengeluaran PDF sebagai bukti kas keluar resmi lembaga.

### Alur Kerja Tipikal
1.  **Mencatat Transaksi:** Bendahara melakukan belanja operasional -> Membuka menu "Catat Pengeluaran" -> Mengisi detail judul, nominal, dan kategori.
2.  **Unggah Nota:** Bendahara memfoto nota belanja dan mengunggahnya ke dalam sistem.
3.  **Filter & Review:** Super Admin menggunakan fitur filter bulan untuk melihat rincian biaya yang keluar pada bulan sebelumnya.
4.  **Cetak Laporan:** Di akhir bulan, Bendahara mengunduh "Laporan Pengeluaran Excel" sebagai lampiran laporan pertanggungjawaban.

---

## 10. Diklat & Pasaran

### Gambaran Umum
Modul Diklat & Pasaran digunakan untuk mengelola program pendidikan khusus atau kursus singkat (seperti pengajian pasaran kitab kuning) yang diadakan di waktu-waktu tertentu dalam kalender Hijriah. Modul ini menangani seluruh proses mulai dari pengaturan biaya, pendaftaran peserta, hingga manajemen pembayaran administrasi dan koperasi kitab.

### Siapa yang Menggunakan Modul Ini?
*   **Bendahara:** Untuk mengelola master data biaya, daftar kitab, dan memverifikasi pembayaran pendaftaran.
*   **Kesantrian:** Untuk membantu proses pendaftaran peserta dan distribusi kitab.
*   **Super Admin:** Untuk pengawasan pendaftaran dan manajemen konfigurasi tahunan.

### Fitur-Fitur Utama

#### Manajemen Konfigurasi (Master Data)
Pusat pengaturan periode program:
*   **Pengaturan Biaya Administrasi:** Mengatur nominal pendaftaran, listrik, konsumsi, dan biaya perpisahan.
*   **Katalog Kitab Koperasi:** Daftar kitab yang akan dipelajari lengkap dengan harga jual untuk peserta.
*   **Status Periode Aktif:** Mengaktifkan satu periode tertentu agar sistem menggunakan tarif yang relevan.

#### Pendaftaran & Manajemen Peserta
*   **Database Peserta Terpadu:** Mencatat identitas peserta, asal pesantren, dan data wali.
*   **Kalkulasi Biaya Otomatis:** Menghitung total biaya pendaftaran ditambah dengan kitab-kitab yang dibeli.
*   **Status Pembayaran (LUNAS/PENDING):** Memantau penyelesaian administrasi setiap peserta.

#### Cetak Dokumen & Validasi Digital
*   **Formulir & Bukti Daftar (A4):** Dokumen cetak resmi berisi biodata dan rincian pembayaran.
*   **QR Code Validasi:** Kode QR unik untuk verifikasi digital oleh panitia di lapangan.

#### Pelaporan Rekapitulasi (Excel Export)
Fitur untuk mengunduh daftar seluruh peserta ke dalam format Excel untuk keperluan audit keuangan di akhir program.

### Alur Kerja Tipikal
1.  **Pengaturan Awal:** Bendahara/Super Admin masuk ke "Master Data", membuat konfigurasi tahun Hijriah baru, dan menentukan biaya operasional.
2.  **Pendaftaran Peserta:** Bendahara/Kesantrian mendaftarkan peserta baru, memilih kitab yang dibeli, dan sistem menghitung total biaya otomatis.
3.  **Verifikasi Bayar:** Peserta membayar tunai -> Bendahara mengklik "Konfirmasi Bayar" -> Status menjadi LUNAS.
4.  **Cetak Arsip:** Pengguna mencetak bukti pendaftaran untuk diberikan kepada peserta.

---

## 11. Informasi & Berita

### Gambaran Umum
Modul Informasi & Berita adalah pusat publikasi konten digital pesantren untuk menyampaikan kabar terbaru, prestasi santri, pengumuman resmi, hingga artikel kajian keagamaan. Konten akan muncul secara otomatis di aplikasi santri/wali.

### Siapa yang Menggunakan Modul Ini?
*   **Kesantrian:** Untuk menulis berita kegiatan dan prestasi santri.
*   **Super Admin:** Untuk menerbitkan pengumuman resmi yayasan dan mengelola konten Headline.
*   **Rois:** Untuk memberikan arahan konten atau meninjau informasi yang ditayangkan.

### Fitur-Fitur Utama

#### Manajemen Konten Berita
*   **Editor Artikel Lengkap:** Menulis konten dengan judul, ringkasan, dan isi berita detail.
*   **Kategorisasi Konten:** Pengumuman, Kegiatan Santri, Prestasi, atau Kajian.
*   **Headline Utama (Featured):** Menandai berita penting agar muncul di slider paling atas aplikasi.
*   **Manajemen Visibilitas:** Konten dapat disimpan sebagai Draft atau langsung Published.

#### Pengiriman Notifikasi Push
*   **Pesan Masal (Broadcast):** Mengirim pengumuman ke seluruh wali santri atau kelas tertentu.
*   **Monitoring Status:** Memantau apakah notifikasi berstatus Menunggu, Terkirim, atau Gagal.

#### URL Friendly (Slug)
Sistem otomatis menghasilkan link (URL) yang mudah dibaca berdasarkan judul berita untuk dibagikan ke WhatsApp.

### Alur Kerja Tipikal
1.  **Menulis Berita:** Kesantrian/Super Admin membuka menu "Tulis Berita", mengisi judul dan konten lengkap.
2.  **Menambahkan Media:** Mengunggah foto kegiatan sebagai gambar sampul.
3.  **Publikasi:** Setelah berita terbit, pengguna menuju menu "Kirim Notifikasi" untuk memberitahu wali santri.
4.  **Broadcast Masal:** Untuk informasi mendesak, admin menggunakan fitur Broadcast Masal berdasarkan target kelas.

---

## 12. Manajemen Alumni

### Gambaran Umum
Modul Manajemen Alumni berfungsi sebagai basis data digital bagi para lulusan pesantren untuk menjaga silaturahmi, memetakan persebaran alumni, serta memantau perkembangan karir mereka.

### Siapa yang Menggunakan Modul Ini?
*   **Kesantrian:** Untuk memverifikasi akun alumni baru dan mengelola database keanggotaan.
*   **Super Admin:** Untuk pengawasan data alumni secara keseluruhan.

### Fitur-Fitur Utama

#### Verifikasi Keanggotaan (Gatekeeping)
*   **Antrean Verifikasi:** Alumni yang mendaftar mandiri akan diperiksa datanya terlebih dahulu.
*   **Aktivasi & Suspend:** Kesantrian dapat mengaktifkan atau menonaktifkan akun alumni jika diperlukan.

#### Database Karir & Domisili
*   **Pemetaan Profesi:** Mencatat profesi saat ini dan instansi tempat mereka berkiprah.
*   **Pelacakan Domisili:** Mencatat alamat tinggal alumni saat ini untuk pemetaan jaringan daerah.

#### Ekspor Database ke Excel
Mengunduh seluruh data alumni ke Excel untuk keperluan administrasi yayasan atau bahan laporan profil lulusan.

### Alur Kerja Tipikal
1.  **Verifikasi Admin:** Kesantrian membuka daftar "Menunggu Verifikasi", meninjau profil pendaftar, dan mengklik "Verify".
2.  **Pencarian Data:** Pengguna mencari daftar alumni angkatan tertentu melalui fitur filter.
3.  **Pelaporan:** Kesantrian mengunduh laporan Excel tahunan untuk melihat perkembangan jumlah alumni.

---

## 13. Inventaris Aset

### Gambaran Umum
Modul Inventaris Aset dirancang untuk mencatat seluruh kekayaan fisik milik pesantren guna memantau nilai total aset, lokasi penempatan, serta kondisi terkini setiap aset.

### Siapa yang Menggunakan Modul Ini?
*   **Bendahara:** Sebagai penanggung jawab utama pendaftaran barang, lokasi, dan pencatatan kondisi kerusakan.
*   **Super Admin:** Untuk pemantauan valuasi aset sebagai bagian dari laporan kekayaan lembaga.

### Fitur-Fitur Utama

#### Manajemen Aset Terstruktur
*   **Identitas Unik (Kode Barang):** Memberikan kode inventaris khusus untuk setiap barang.
*   **Kategorisasi & Lokasi:** Memetakan barang ke lokasi ruangan spesifik (Asrama, Ruang Kelas, dll.).
*   **Sumber Dana:** Mencatat asal aset (Yayasan, BOS, Wakaf, dll.).

#### Monitoring Kondisi Barang
Indikator visual untuk status kelayakan: **BAIK**, **RUSAK RINGAN**, **RUSAK BERAT**, atau **HILANG**.

#### Labeling Digital (QR Code)
Menghasilkan label QR Code untuk ditempelkan pada barang fisik agar bisa dipindai untuk melihat spesifikasi barang secara instan.

### Alur Kerja Tipikal
1.  **Registrasi Aset:** Bendahara membuka menu "Tambah Aset", mengisi kode inventaris, harga beli, dan lokasi.
2.  **Audit Berkala:** Bendahara memeriksa kondisi barang di ruangan dan memperbarui status kondisi di sistem.
3.  **Pelaporan:** Di akhir tahun, Bendahara mengunduh "Laporan Aset Lengkap" untuk menghitung total kekayaan fisik pesantren.

---

## 14. Scan QR

### Gambaran Umum
Modul Scan QR adalah alat operasional untuk verifikasi data secara instan menggunakan kamera perangkat, menghubungkan identitas fisik (kartu ID) dengan database digital.

### Siapa yang Menggunakan Modul Ini?
*   **Kesantrian:** Untuk memverifikasi identitas santri yang keluar-masuk atau memeriksa izin pulang.
*   **Bendahara:** Untuk mengecek status tunggakan SPP/Syahriah secara cepat saat santri bertransaksi di kantor.
*   **Super Admin:** Untuk pengawasan operasional scanner di lapangan.

### Fitur-Fitur Utama
*   **Deteksi Cerdas:** Otomatis mendeteksi apakah yang dipindai adalah ID Santri atau Bukti Daftar Diklat.
*   **Mode Info Santri:** Menampilkan profil lengkap, foto, dan capaian hafalan.
*   **Mode Status Syahriah:** Menampilkan rincian tagihan terbaru dan status pelunasan.
*   **Mode Data Diklat:** Menampilkan detail pendaftaran program pasaran.

---

## 15. Layanan Notifikasi

### Gambaran Umum
Layanan Notifikasi mengelola pengiriman pesan instan (push notification) ke aplikasi ponsel wali santri secara terpadu dengan database pesantren.

### Siapa yang Menggunakan Modul Ini?
*   **Super Admin, Rois, Dewan, & Kesantrian:** Sesuai wewenangnya untuk mengirim pengumuman penting atau informasi akademik ke wali santri.

### Fitur-Fitur Utama
*   **Manajemen Antrean:** Memantau status pesan (Pending, Sent, Failed) dan waktu kirim presisi.
*   **Pesan Personal:** Mengirim notifikasi khusus ke satu wali santri berdasarkan nama santri.
*   **Broadcast Masal:** Mengirim siaran pesan ke seluruh wali atau per tingkatan kelas.

---

## 16. Log Aktivitas (Audit Trail)

### Gambaran Umum
Modul Log Aktivitas merekam setiap tindakan administratif demi menjamin transparansi dan keamanan data pesantren.

### Siapa yang Menggunakan Modul Ini?
*   **Super Admin:** Sebagai pemegang otoritas tertinggi untuk audit keamanan dan pelacakan aktivitas sistem.

### Fitur-Fitur Utama
*   **Audit Trail:** Mencatat Aktor (Role), Waktu Presisi, Jenis Aksi (CREATE/UPDATE/DELETE/LOGIN), dan Target Data secara real-time.
*   **Transparansi Data:** Menyimpan detail teknis perubahan sebagai bukti autentik jika terjadi perselisihan data.
