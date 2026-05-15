# REFERENSI FORMAT DATA EMIS & DAPODIK
## Panduan Penyesuaian Database & Export Al-Hasanah

> **Sumber**: Formulir resmi EMIS 4.0 Kemenag & Dapodik 2026 Kemendikbud
> **Tujuan**: Menyesuaikan struktur database dan fitur export sistem Al-Hasanah
> agar kompatibel dengan standar pelaporan pemerintah
>
> ⚠️ **Catatan Penting**:
> - EMIS 4.0 dan Dapodik 2026 adalah sistem web-based (bukan API publik)
> - Integrasi yang dimaksud adalah **export data dari sistem Al-Hasanah ke format yang bisa di-import/diisi ke EMIS & Dapodik**
> - Format bisa berubah setiap semester — selalu cek `emis.kemenag.go.id` dan `dapo.kemdikbud.go.id` untuk update terbaru
> - Formulir cetak resmi bisa diunduh di: `dapo.kemdikbud.go.id/unduhan`

---

# BAGIAN A — EMIS 4.0 KEMENAG (Pondok Pesantren)

EMIS Pesantren terdiri dari 4 formulir utama:
1. **EMIS-PONTREN-LEMBAGA** — Data profil pesantren
2. **EMIS-PONTREN-SANTRI** — Data per santri
3. **EMIS-PONTREN-PTK** — Data ustadz/pengajar
4. **EMIS-PONTREN-KURIKULUM** — Data kurikulum & program

---

## A.1 EMIS PONTREN — DATA LEMBAGA

### Identitas Pesantren
| No | Field EMIS | Tipe | Keterangan | Field di DB Kamu |
|----|-----------|------|------------|-----------------|
| 1 | NSP | VARCHAR(12) | Nomor Statistik Pesantren (dari Kemenag) | `pesantren.nsp` |
| 2 | Nama Pondok Pesantren | VARCHAR(255) | Nama lengkap resmi | `pesantren.nama` |
| 3 | Nama Singkatan | VARCHAR(100) | Singkatan/alias | `pesantren.nama_singkat` |
| 4 | Status Lembaga | ENUM | Swasta / Pemerintah | `pesantren.status_lembaga` |
| 5 | SK Izin Operasional | VARCHAR(100) | Nomor SK dari Kemenag | `pesantren.sk_operasional` |
| 6 | Tanggal SK | DATE | Tanggal terbit SK | `pesantren.tgl_sk` |
| 7 | Tahun Berdiri | YEAR | Tahun pendirian pesantren | `pesantren.tahun_berdiri` |
| 8 | Nama Pimpinan/Kyai | VARCHAR(255) | Nama ketua/pengasuh | `pesantren.nama_pimpinan` |
| 9 | NIK Pimpinan | VARCHAR(16) | NIK KTP pimpinan | `pesantren.nik_pimpinan` |

### Lokasi & Kontak
| No | Field EMIS | Tipe | Keterangan | Field di DB Kamu |
|----|-----------|------|------------|-----------------|
| 10 | Alamat | TEXT | Alamat lengkap | `pesantren.alamat` |
| 11 | RT | VARCHAR(5) | Nomor RT | `pesantren.rt` |
| 12 | RW | VARCHAR(5) | Nomor RW | `pesantren.rw` |
| 13 | Desa/Kelurahan | VARCHAR(100) | Nama kelurahan | `pesantren.kelurahan` |
| 14 | Kecamatan | VARCHAR(100) | Nama kecamatan | `pesantren.kecamatan` |
| 15 | Kabupaten/Kota | VARCHAR(100) | Nama kab/kota | `pesantren.kab_kota` |
| 16 | Provinsi | VARCHAR(100) | Nama provinsi | `pesantren.provinsi` |
| 17 | Kode Pos | VARCHAR(10) | Kode pos area | `pesantren.kode_pos` |
| 18 | No. Telepon | VARCHAR(20) | Telp pesantren | `pesantren.no_telp` |
| 19 | Email | VARCHAR(100) | Email resmi | `pesantren.email` |
| 20 | Website | VARCHAR(200) | URL website | `pesantren.website` |
| 21 | Koordinat Lintang | DECIMAL(10,7) | Latitude GPS | `pesantren.latitude` |
| 22 | Koordinat Bujur | DECIMAL(10,7) | Longitude GPS | `pesantren.longitude` |

### Data Periodik Pesantren
| No | Field EMIS | Tipe | Keterangan | Field di DB Kamu |
|----|-----------|------|------------|-----------------|
| 23 | Jumlah Santri Mukim L | INTEGER | Santri laki mukim | (hitung dari tabel santri) |
| 24 | Jumlah Santri Mukim P | INTEGER | Santri perempuan mukim | (hitung dari tabel santri) |
| 25 | Jumlah Santri Non-Mukim L | INTEGER | Santri laki tidak mukim | (hitung dari tabel santri) |
| 26 | Jumlah Santri Non-Mukim P | INTEGER | Santri perempuan tidak mukim | (hitung dari tabel santri) |
| 27 | Jumlah Ustadz L | INTEGER | Pengajar laki-laki | (hitung dari tabel PTK) |
| 28 | Jumlah Ustadzah P | INTEGER | Pengajar perempuan | (hitung dari tabel PTK) |
| 29 | Luas Tanah (m²) | DECIMAL | Total luas tanah | `pesantren.luas_tanah` |
| 30 | Status Kepemilikan Tanah | ENUM | Milik Sendiri / Sewa / Pinjam | `pesantren.status_tanah` |

### Program & Jenis Pesantren
| No | Field EMIS | Tipe | Keterangan |
|----|-----------|------|------------|
| 31 | Jenis Pesantren | ENUM | Salafiyah / Khalafiyah / Kombinasi |
| 32 | Penyelenggara Tahfidz | BOOLEAN | Ya / Tidak |
| 33 | Penyelenggara Kitab Kuning | BOOLEAN | Ya / Tidak |
| 34 | Penyelenggara Madrasah Diniyah | BOOLEAN | Ya / Tidak |
| 35 | Penyelenggara Sekolah Formal | BOOLEAN | Ya / Tidak |
| 36 | Jenis Sekolah Formal | ENUM | MI/SD, MTs/SMP, MA/SMA, SMK (multi-pilih) |
| 37 | Status Akreditasi | ENUM | A / B / C / Belum Terakreditasi |
| 38 | Tahun Akreditasi | YEAR | Tahun terakhir akreditasi |

---

## A.2 EMIS PONTREN — DATA SANTRI

> 📌 Ini adalah formulir yang paling sering diisi dan paling penting untuk disamakan dengan database santri kamu.

### Identitas Santri (Kolom Wajib)
| No | Field EMIS | Tipe Data | Contoh Nilai | Keterangan |
|----|-----------|-----------|--------------|------------|
| 1 | NSP | VARCHAR(12) | 512630100001 | Nomor Statistik Pesantren |
| 2 | No. Induk Santri | VARCHAR(20) | 2024001 | NIS internal pesantren |
| 3 | Nama Lengkap | VARCHAR(255) | AHMAD FAUZI | **HURUF KAPITAL** |
| 4 | NIK | VARCHAR(16) | 3201234567890001 | 16 digit, tanpa spasi |
| 5 | Jenis Kelamin | ENUM | L / P | Laki-laki atau Perempuan |
| 6 | Tempat Lahir | VARCHAR(100) | BANDUNG | Kota/kabupaten lahir |
| 7 | Tanggal Lahir | DATE | 2008-05-14 | Format: YYYY-MM-DD |
| 8 | Agama | ENUM | Islam / Kristen / dll | Umumnya Islam |
| 9 | Kewarganegaraan | ENUM | WNI / WNA | |
| 10 | Status Mukim | ENUM | Mukim / Tidak Mukim | Tinggal di pesantren atau tidak |

### Asal & Domisili
| No | Field EMIS | Tipe Data | Keterangan |
|----|-----------|-----------|------------|
| 11 | Alamat Lengkap | TEXT | Alamat domisili santri |
| 12 | RT | VARCHAR(5) | |
| 13 | RW | VARCHAR(5) | |
| 14 | Desa/Kelurahan | VARCHAR(100) | |
| 15 | Kecamatan | VARCHAR(100) | |
| 16 | Kabupaten/Kota Asal | VARCHAR(100) | |
| 17 | Provinsi Asal | VARCHAR(100) | |
| 18 | Kode Pos | VARCHAR(10) | |
| 19 | Jarak dari Rumah (km) | DECIMAL | Jarak rumah ke pesantren |

### Data Keluarga
| No | Field EMIS | Tipe Data | Keterangan |
|----|-----------|-----------|------------|
| 20 | Nama Ayah | VARCHAR(255) | Huruf kapital |
| 21 | NIK Ayah | VARCHAR(16) | 16 digit |
| 22 | Pendidikan Terakhir Ayah | ENUM | SD/MI, SMP/MTs, SMA/MA, D3, S1, S2, S3 |
| 23 | Pekerjaan Ayah | ENUM | PNS, TNI/Polri, Swasta, Wiraswasta, Petani, Nelayan, Buruh, Tidak Bekerja, dll |
| 24 | Penghasilan Ayah (Rp/bulan) | ENUM | < 500rb, 500rb-1jt, 1-2jt, 2-3jt, 3-5jt, > 5jt |
| 25 | Nama Ibu | VARCHAR(255) | Huruf kapital |
| 26 | NIK Ibu | VARCHAR(16) | 16 digit |
| 27 | Pendidikan Terakhir Ibu | ENUM | SD/MI, SMP/MTs, SMA/MA, D3, S1, S2, S3 |
| 28 | Pekerjaan Ibu | ENUM | Sama seperti pekerjaan ayah |
| 29 | Penghasilan Ibu (Rp/bulan) | ENUM | Sama seperti rentang penghasilan ayah |
| 30 | Status Orang Tua | ENUM | Lengkap / Yatim / Piatu / Yatim Piatu |
| 31 | Nama Wali (jika bukan ortu) | VARCHAR(255) | |
| 32 | NIK Wali | VARCHAR(16) | |
| 33 | Hubungan Wali | ENUM | Paman, Kakak, Kakek, dll |

### Data Akademik & Program
| No | Field EMIS | Tipe Data | Keterangan |
|----|-----------|-----------|------------|
| 34 | Tahun Masuk | YEAR | Tahun mulai belajar |
| 35 | Tingkat/Kelas | VARCHAR(20) | Kelas 1, Kelas 2, Ibtida, Tsanawi, dll |
| 36 | Program yang Diikuti | ENUM | Tahfidz, Kitab Kuning, Formal, Kombinasi |
| 37 | Status Santri | ENUM | Aktif / Alumni / Pindah / Keluar |
| 38 | Tahun Lulus/Keluar | YEAR | Diisi jika sudah lulus/keluar |
| 39 | Penerima PIP | BOOLEAN | Ya / Tidak |
| 40 | No. KIP | VARCHAR(20) | Diisi jika penerima KIP |
| 41 | Penerima Beasiswa Lain | BOOLEAN | Ya / Tidak |
| 42 | Kebutuhan Khusus | ENUM | Tidak Ada / Tuna Rungu / Tuna Netra / dll |

---

## A.3 EMIS PONTREN — DATA PTK (Ustadz/Pengajar)

### Identitas PTK
| No | Field EMIS | Tipe Data | Keterangan |
|----|-----------|-----------|------------|
| 1 | NSP | VARCHAR(12) | Nomor Statistik Pesantren |
| 2 | NIK | VARCHAR(16) | 16 digit wajib |
| 3 | NUPTK | VARCHAR(16) | Jika sudah punya NUPTK |
| 4 | Nama Lengkap | VARCHAR(255) | Huruf kapital |
| 5 | Jenis Kelamin | ENUM | L / P |
| 6 | Tempat Lahir | VARCHAR(100) | |
| 7 | Tanggal Lahir | DATE | YYYY-MM-DD |
| 8 | Agama | ENUM | Islam / dll |
| 9 | Status Perkawinan | ENUM | Kawin / Belum Kawin / Janda / Duda |
| 10 | No. HP | VARCHAR(15) | |
| 11 | Email | VARCHAR(100) | |

### Domisili PTK
| No | Field EMIS | Tipe Data | Keterangan |
|----|-----------|-----------|------------|
| 12 | Alamat Lengkap | TEXT | |
| 13 | RT | VARCHAR(5) | |
| 14 | RW | VARCHAR(5) | |
| 15 | Kelurahan | VARCHAR(100) | |
| 16 | Kecamatan | VARCHAR(100) | |
| 17 | Kabupaten/Kota | VARCHAR(100) | |
| 18 | Provinsi | VARCHAR(100) | |
| 19 | Kode Pos | VARCHAR(10) | |

### Data Kepegawaian & Akademik PTK
| No | Field EMIS | Tipe Data | Keterangan |
|----|-----------|-----------|------------|
| 20 | Status Kepegawaian | ENUM | Tetap / Honorer / GTT |
| 21 | Jabatan | ENUM | Ustadz, Pengasuh, Wali Kelas, Kepsek, TU, dll |
| 22 | Tahun Mulai Bertugas | YEAR | TMT di pesantren ini |
| 23 | Pendidikan Terakhir | ENUM | SMA/MA, D3, S1, S2, S3 |
| 24 | Jurusan/Prodi | VARCHAR(100) | |
| 25 | Universitas/Sekolah | VARCHAR(255) | |
| 26 | Tahun Lulus | YEAR | |
| 27 | Mata Pelajaran/Kitab yang Diampu | VARCHAR(255) | |
| 28 | Jam Mengajar per Minggu | INTEGER | |
| 29 | Status Sertifikasi | ENUM | Sudah / Belum / Proses |
| 30 | Nomor Sertifikasi | VARCHAR(50) | Diisi jika sudah sertifikasi |

---

---

# BAGIAN B — DAPODIK 2026 KEMENDIKBUD (Sekolah Formal)

Dapodik terdiri dari 6 formulir utama:
1. **F-SEK** — Formulir Data Sekolah
2. **F-PD** — Formulir Peserta Didik
3. **F-GTK** — Formulir Guru & Tenaga Kependidikan
4. **F-SARPRAS** — Formulir Sarana & Prasarana
5. **F-ROMBEL** — Formulir Rombongan Belajar
6. **F-JADWAL** — Formulir Jadwal Pembelajaran

---

## B.1 DAPODIK — F-SEK (Formulir Sekolah)

### Identitas Sekolah
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 1 | NPSN | VARCHAR(8) | Nomor Pokok Sekolah Nasional (dari Kemendikbud) |
| 2 | Nama Sekolah | VARCHAR(255) | Nama lengkap resmi |
| 3 | Bentuk Pendidikan | ENUM | SD, MI, SMP, MTs, SMA, MA, SMK, SLB |
| 4 | Status Sekolah | ENUM | Negeri / Swasta |
| 5 | NPWP Sekolah | VARCHAR(20) | NPWP lembaga |
| 6 | No. SK Pendirian | VARCHAR(100) | |
| 7 | Tanggal SK Pendirian | DATE | |
| 8 | No. SK Operasional | VARCHAR(100) | |
| 9 | Tanggal SK Operasional | DATE | |
| 10 | Akreditasi | ENUM | A / B / C / Belum |
| 11 | Tahun Akreditasi | YEAR | |
| 12 | Kurikulum | ENUM | Kurikulum Merdeka / K13 |

### Lokasi Sekolah
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 13 | Alamat | TEXT | |
| 14 | RT | VARCHAR(5) | |
| 15 | RW | VARCHAR(5) | |
| 16 | Nama Dusun | VARCHAR(100) | |
| 17 | Desa/Kelurahan | VARCHAR(100) | |
| 18 | Kecamatan | VARCHAR(100) | Kode wilayah Kemendagri |
| 19 | Kabupaten/Kota | VARCHAR(100) | |
| 20 | Provinsi | VARCHAR(100) | |
| 21 | Kode Pos | VARCHAR(10) | |
| 22 | Lintang (Latitude) | DECIMAL(10,7) | |
| 23 | Bujur (Longitude) | DECIMAL(10,7) | |
| 24 | Kategori Wilayah | ENUM | Perkotaan / Perdesaan |
| 25 | Akses Internet | ENUM | Ada / Tidak Ada |
| 26 | Jenis Koneksi Internet | ENUM | Fiber Optik / DSL / Satelit / Selular |

### Data Administrasi & Kontak
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 27 | No. Telepon | VARCHAR(20) | |
| 28 | No. Fax | VARCHAR(20) | |
| 29 | Email | VARCHAR(100) | |
| 30 | Website | VARCHAR(200) | |
| 31 | Nama Yayasan | VARCHAR(255) | Untuk sekolah swasta |
| 32 | Nama Kepala Sekolah | VARCHAR(255) | |
| 33 | NIP/NIK Kepala Sekolah | VARCHAR(20) | |

### Data Periodik Sekolah
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 34 | Sumber Listrik | ENUM | PLN / Genset / Surya / Tidak Ada |
| 35 | Daya Listrik (Watt) | INTEGER | |
| 36 | BOS Diterima | BOOLEAN | Ya / Tidak |
| 37 | Jenis BOS | ENUM | BOS Reguler / BOS Kinerja |
| 38 | Penyelenggara Pondok Pesantren | BOOLEAN | Ya / Tidak (field khusus!) |

---

## B.2 DAPODIK — F-PD (Formulir Peserta Didik)

> 📌 Ini padanan dari EMIS Santri untuk sekolah formal (MTs, MA, SMK di dalam yayasan)

### Data Pribadi Peserta Didik
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 1 | NISN | VARCHAR(10) | Nomor Induk Siswa Nasional (dari Kemendikbud) |
| 2 | NIK | VARCHAR(16) | 16 digit wajib |
| 3 | Nama Lengkap | VARCHAR(255) | Sesuai akte lahir, huruf kapital |
| 4 | Jenis Kelamin | ENUM | L / P |
| 5 | Tempat Lahir | VARCHAR(100) | |
| 6 | Tanggal Lahir | DATE | YYYY-MM-DD |
| 7 | Agama | ENUM | Islam=1, Kristen=2, Katolik=3, Hindu=4, Buddha=5, Konghucu=6 |
| 8 | Kewarganegaraan | ENUM | WNI / WNA |
| 9 | Anak Ke | INTEGER | Urutan anak dalam keluarga |
| 10 | Jumlah Saudara Kandung | INTEGER | |
| 11 | Berat Badan (kg) | DECIMAL | |
| 12 | Tinggi Badan (cm) | DECIMAL | |
| 13 | Lingkar Kepala (cm) | DECIMAL | Untuk PAUD |
| 14 | Golongan Darah | ENUM | A / B / AB / O / Tidak Tahu |
| 15 | Kebutuhan Khusus | ENUM | Tidak Ada=0, Tuna Rungu=A, Tuna Netra=B, Tuna Daksa=C, Tuna Grahita=D, dll |

### Alamat Peserta Didik
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 16 | Alamat Tempat Tinggal | TEXT | |
| 17 | RT | VARCHAR(5) | |
| 18 | RW | VARCHAR(5) | |
| 19 | Nama Dusun | VARCHAR(100) | |
| 20 | Desa/Kelurahan | VARCHAR(100) | |
| 21 | Kecamatan | VARCHAR(100) | |
| 22 | Kabupaten/Kota | VARCHAR(100) | |
| 23 | Provinsi | VARCHAR(100) | |
| 24 | Kode Pos | VARCHAR(10) | |
| 25 | Jenis Tinggal | ENUM | Bersama Orang Tua=1, Wali=2, Kos=3, Asrama=4, Panti=5, Lainnya=6 |
| 26 | Alat Transportasi | ENUM | Jalan Kaki=1, Sepeda=2, Sepeda Motor=3, Mobil=4, Angkutan Umum=5, dll |
| 27 | Jarak Tempuh (km) | DECIMAL | |
| 28 | Waktu Tempuh (menit) | INTEGER | |

### Data Ayah Kandung
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 29 | Nama Ayah | VARCHAR(255) | |
| 30 | NIK Ayah | VARCHAR(16) | |
| 31 | Tahun Lahir Ayah | YEAR | |
| 32 | Pendidikan Terakhir Ayah | ENUM | Tidak Sekolah=0, SD=1, SMP=2, SMA=3, D1=4, D2=5, D3=6, D4/S1=7, S2=8, S3=9 |
| 33 | Pekerjaan Ayah | ENUM | Tidak Bekerja=0, PNS=1, TNI=2, POLRI=3, Swasta=4, Wiraswasta=5, Petani=6, Nelayan=7, Buruh=8, Pensiunan=9, dll |
| 34 | Penghasilan Ayah | ENUM | Tidak Berpenghasilan=0, < 500rb=1, 500rb-1jt=2, 1-2jt=3, 2-3jt=4, 3-5jt=5, 5-20jt=6, > 20jt=7 |

### Data Ibu Kandung
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 35 | Nama Ibu | VARCHAR(255) | |
| 36 | NIK Ibu | VARCHAR(16) | |
| 37 | Tahun Lahir Ibu | YEAR | |
| 38 | Pendidikan Terakhir Ibu | ENUM | Sama dengan skala Ayah |
| 39 | Pekerjaan Ibu | ENUM | Sama dengan skala Ayah |
| 40 | Penghasilan Ibu | ENUM | Sama dengan skala Ayah |

### Data Wali (Jika Bukan Orang Tua)
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 41 | Nama Wali | VARCHAR(255) | |
| 42 | NIK Wali | VARCHAR(16) | |
| 43 | Tahun Lahir Wali | YEAR | |
| 44 | Pendidikan Terakhir Wali | ENUM | |
| 45 | Pekerjaan Wali | ENUM | |
| 46 | Penghasilan Wali | ENUM | |

### Kontak
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 47 | No. Telepon Rumah | VARCHAR(20) | |
| 48 | No. HP Siswa | VARCHAR(15) | |
| 49 | Email Siswa | VARCHAR(100) | |

### Data Periodik Siswa
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 50 | Tahun Ajaran | VARCHAR(9) | Contoh: 2025/2026 |
| 51 | Semester | ENUM | Ganjil / Genap |
| 52 | Kelas | VARCHAR(10) | 1, 2, 3, VII, VIII, IX, X, XI, XII |
| 53 | Status Kehadiran | ENUM | Aktif / Cuti / Pindah / Lulus / DO |
| 54 | Penerima KIP | BOOLEAN | Ya / Tidak |
| 55 | No. KIP | VARCHAR(20) | |
| 56 | No. KKS (Keluarga Sejahtera) | VARCHAR(20) | |
| 57 | No. PKH | VARCHAR(20) | Program Keluarga Harapan |
| 58 | Tinggal di Asrama | BOOLEAN | Ya / Tidak (penting untuk pesantren!) |

### Prestasi Siswa
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 59 | Jenis Prestasi | VARCHAR(100) | Akademik / Non-Akademik |
| 60 | Tingkat Prestasi | ENUM | Kecamatan / Kabupaten / Provinsi / Nasional / Internasional |
| 61 | Nama Kejuaraan | VARCHAR(255) | |
| 62 | Peringkat | INTEGER | Juara 1, 2, 3, dll |
| 63 | Tahun Prestasi | YEAR | |

---

## B.3 DAPODIK — F-GTK (Formulir Guru & Tenaga Kependidikan)

### Identitas GTK
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 1 | NIK | VARCHAR(16) | Wajib |
| 2 | NUPTK | VARCHAR(16) | Nomor Unik PTK (dari Kemendikbud) |
| 3 | NIP | VARCHAR(20) | Untuk PNS |
| 4 | Nama Lengkap | VARCHAR(255) | |
| 5 | Jenis Kelamin | ENUM | L / P |
| 6 | Tempat Lahir | VARCHAR(100) | |
| 7 | Tanggal Lahir | DATE | |
| 8 | Agama | ENUM | |
| 9 | Status Perkawinan | ENUM | Belum Kawin / Kawin / Janda / Duda |
| 10 | No. HP | VARCHAR(15) | Wajib (validasi Dapodik 2026) |
| 11 | Email | VARCHAR(100) | |

### Alamat GTK
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 12 | Alamat | TEXT | |
| 13 | RT / RW | VARCHAR(5) | |
| 14 | Kelurahan | VARCHAR(100) | |
| 15 | Kecamatan | VARCHAR(100) | |
| 16 | Kabupaten/Kota | VARCHAR(100) | |
| 17 | Provinsi | VARCHAR(100) | |
| 18 | Kode Pos | VARCHAR(10) | |

### Data Kepegawaian
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 19 | Status Kepegawaian | ENUM | PNS / PPPK / GTY / PTY / Honorer / dll |
| 20 | Jenis PTK | ENUM | Guru / Kepala Sekolah / Wakil KS / TU / dll |
| 21 | Tugas Tambahan | VARCHAR(100) | Jabatan tambahan |
| 22 | Status Aktif | ENUM | Aktif / Pensiun / Meninggal / Pindah |
| 23 | TMT Pengangkatan | DATE | Tanggal Mulai Tugas |
| 24 | SK Pengangkatan | VARCHAR(100) | Nomor SK |
| 25 | Gaji Pokok | DECIMAL | |

### Data Akademik GTK
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 26 | Pendidikan Terakhir | ENUM | SMA=3, D2=5, D3=6, S1/D4=7, S2=8, S3=9 |
| 27 | Jurusan | VARCHAR(100) | |
| 28 | Universitas | VARCHAR(255) | |
| 29 | Tahun Lulus | YEAR | |
| 30 | Bidang Studi Sertifikasi | VARCHAR(100) | |
| 31 | No. Sertifikasi | VARCHAR(50) | |
| 32 | Tahun Sertifikasi | YEAR | |
| 33 | Mata Pelajaran Diampu | VARCHAR(255) | Sesuai kurikulum |
| 34 | JJM (Jam Mengajar/Minggu) | INTEGER | Total jam mengajar |

---

## B.4 DAPODIK — F-SARPRAS (Sarana & Prasarana)

### Data Tanah
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 1 | Status Kepemilikan Tanah | ENUM | Milik Sendiri / Sewa / Pinjam / Wakaf / Hak Guna Pakai |
| 2 | Luas Tanah (m²) | DECIMAL | |
| 3 | Luas Bangunan (m²) | DECIMAL | |
| 4 | NJOP (Rp) | DECIMAL | Nilai Jual Objek Pajak |

### Data Ruangan (Per Ruang)
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 5 | Jenis Ruang | ENUM | Ruang Kelas, Lab, Perpustakaan, Toilet, Gudang, dll |
| 6 | Nama Ruang | VARCHAR(100) | |
| 7 | Luas Ruang (m²) | DECIMAL | |
| 8 | Kondisi Ruang | ENUM | Baik / Rusak Ringan / Rusak Sedang / Rusak Berat |
| 9 | Tahun Dibangun | YEAR | |

### Data Sanitasi (Wajib di Dapodik 2021+)
| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 10 | Sumber Air Bersih | ENUM | Ledeng / Pompa / Sumur / Sungai / dll |
| 11 | Kualitas Air | ENUM | Layak / Tidak Layak |
| 12 | Jumlah Toilet Siswa L | INTEGER | |
| 13 | Jumlah Toilet Siswa P | INTEGER | |
| 14 | Kondisi Toilet | ENUM | Baik / Rusak Ringan / dll |

---

## B.5 DAPODIK — F-ROMBEL (Rombongan Belajar)

| No | Field Dapodik | Tipe | Keterangan |
|----|--------------|------|------------|
| 1 | Nama Rombel | VARCHAR(50) | Contoh: Kelas 7A, Kelas 8B |
| 2 | Tingkat/Kelas | ENUM | 7, 8, 9 (SMP) / 10, 11, 12 (SMA) |
| 3 | Kurikulum | ENUM | Kurikulum Merdeka / K13 |
| 4 | Nama Wali Kelas (NIK) | VARCHAR(16) | Referensi ke data GTK |
| 5 | Ruang Kelas | VARCHAR(50) | Referensi ke data Sarpras |
| 6 | Jumlah Siswa L | INTEGER | Dihitung otomatis dari anggota rombel |
| 7 | Jumlah Siswa P | INTEGER | |
| 8 | Tahun Ajaran | VARCHAR(9) | |
| 9 | Semester | ENUM | Ganjil / Genap |
| 10 | Program Inklusi | BOOLEAN | Ya / Tidak |

---

---

# BAGIAN C — MAPPING DATABASE AL-HASANAH → EMIS & DAPODIK

> Gunakan tabel ini untuk memastikan field di database kamu sudah menampung semua data yang dibutuhkan EMIS & Dapodik.

## C.1 Field yang WAJIB Ada di Database (Belum Tentu Ada di Sistem Lama)

### Untuk Modul Santri (kompatibel EMIS):
```sql
-- Field yang mungkin perlu ditambahkan ke tabel santri
ALTER TABLE santri ADD COLUMN IF NOT EXISTS nsp VARCHAR(12);           -- NSP pesantren
ALTER TABLE santri ADD COLUMN IF NOT EXISTS status_mukim ENUM('Mukim', 'Tidak Mukim');
ALTER TABLE santri ADD COLUMN IF NOT EXISTS nama_dusun VARCHAR(100);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS status_pip BOOLEAN DEFAULT FALSE;
ALTER TABLE santri ADD COLUMN IF NOT EXISTS no_kip VARCHAR(20);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS anak_ke INTEGER;
ALTER TABLE santri ADD COLUMN IF NOT EXISTS jml_saudara INTEGER;
ALTER TABLE santri ADD COLUMN IF NOT EXISTS pekerjaan_ayah VARCHAR(50);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS penghasilan_ayah VARCHAR(50);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS pekerjaan_ibu VARCHAR(50);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS penghasilan_ibu VARCHAR(50);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS status_ortu ENUM('Lengkap','Yatim','Piatu','Yatim Piatu');
ALTER TABLE santri ADD COLUMN IF NOT EXISTS jenis_kebutuhan_khusus VARCHAR(50) DEFAULT 'Tidak Ada';
ALTER TABLE santri ADD COLUMN IF NOT EXISTS program_diikuti VARCHAR(100);  -- Tahfidz/Kitab/Formal
```

### Untuk Modul Guru/Ustadz (kompatibel EMIS PTK & Dapodik GTK):
```sql
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS nuptk VARCHAR(16);
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS nip VARCHAR(20);
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS status_sertifikasi ENUM('Sudah','Belum','Proses');
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS no_sertifikasi VARCHAR(50);
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS bidang_studi_sertifikasi VARCHAR(100);
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS jam_mengajar_per_minggu INTEGER;
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS jurusan_pendidikan VARCHAR(100);
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS universitas VARCHAR(255);
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS tahun_lulus_pendidikan YEAR;
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS status_kepegawaian ENUM('Tetap','Honorer','GTT','PNS','PPPK');
```

### Untuk Modul Sekolah Formal (kompatibel Dapodik F-SEK):
```sql
ALTER TABLE lembaga ADD COLUMN IF NOT EXISTS npsn VARCHAR(8);           -- Nomor Pokok Sekolah Nasional
ALTER TABLE lembaga ADD COLUMN IF NOT EXISTS bentuk_pendidikan ENUM('MI','SD','MTs','SMP','MA','SMA','SMK');
ALTER TABLE lembaga ADD COLUMN IF NOT EXISTS status_akreditasi ENUM('A','B','C','Belum');
ALTER TABLE lembaga ADD COLUMN IF NOT EXISTS tahun_akreditasi YEAR;
ALTER TABLE lembaga ADD COLUMN IF NOT EXISTS no_sk_pendirian VARCHAR(100);
ALTER TABLE lembaga ADD COLUMN IF NOT EXISTS tgl_sk_pendirian DATE;
ALTER TABLE lembaga ADD COLUMN IF NOT EXISTS no_sk_operasional VARCHAR(100);
ALTER TABLE lembaga ADD COLUMN IF NOT EXISTS tgl_sk_operasional DATE;
ALTER TABLE lembaga ADD COLUMN IF NOT EXISTS kurikulum ENUM('Kurikulum Merdeka','K13');
ALTER TABLE lembaga ADD COLUMN IF NOT EXISTS sumber_listrik VARCHAR(50);
ALTER TABLE lembaga ADD COLUMN IF NOT EXISTS daya_listrik INTEGER;
```

---

## C.2 Format Export yang Perlu Dibuat di Admin Panel

Buat fitur export di admin panel dengan output berikut:

### Export EMIS Santri (Excel/CSV):
```
Kolom urutan: NSP | No.Induk | Nama | NIK | JK | Tempat Lahir | Tgl Lahir |
              Agama | Status Mukim | Alamat | RT | RW | Desa | Kecamatan |
              Kab/Kota | Provinsi | Kode Pos | Nama Ayah | NIK Ayah |
              Pend Ayah | Pekerjaan Ayah | Penghasilan Ayah |
              Nama Ibu | NIK Ibu | Pend Ibu | Pekerjaan Ibu | Penghasilan Ibu |
              Status Ortu | Tahun Masuk | Tingkat | Program | Status Santri |
              PIP | No KIP | Kebutuhan Khusus
```

### Export EMIS PTK (Excel/CSV):
```
Kolom urutan: NSP | NIK | NUPTK | Nama | JK | Tempat Lahir | Tgl Lahir |
              Agama | Status Kawin | Alamat | RT | RW | Desa | Kecamatan |
              Kab/Kota | Provinsi | Kode Pos | Status Kepegawaian | Jabatan |
              TMT | Pend Terakhir | Jurusan | Universitas | Tahun Lulus |
              Mapel Diampu | JJM | Status Sertifikasi | No Sertifikasi
```

### Export Dapodik F-PD (Excel/CSV):
```
Kolom urutan: NISN | NIK | Nama | JK | Tempat Lahir | Tgl Lahir | Agama |
              Kewarganegaraan | Anak Ke | Jml Saudara | Gol Darah | BB | TB |
              Kebutuhan Khusus | Alamat | RT | RW | Dusun | Desa | Kecamatan |
              Kab/Kota | Provinsi | Kode Pos | Jenis Tinggal | Transportasi |
              Jarak | Waktu Tempuh | Nama Ayah | NIK Ayah | Thn Lahir Ayah |
              Pend Ayah | Pekerjaan Ayah | Penghasilan Ayah |
              Nama Ibu | NIK Ibu | Thn Lahir Ibu | Pend Ibu | Pekerjaan Ibu |
              Penghasilan Ibu | Nama Wali | NIK Wali | No HP | Email |
              KIP | No KIP | Asrama
```

---

## C.3 Referensi Kode Enum yang Dipakai Dapodik

> Dapodik menggunakan kode numerik atau kode huruf tertentu — BUKAN teks bebas.
> Gunakan referensi ini untuk dropdown di form input data.

### Kode Pekerjaan (Dapodik):
```
0 = Tidak Bekerja/Belum Bekerja
1 = PNS
2 = TNI
3 = POLRI
4 = Karyawan Swasta
5 = Wiraswasta
6 = Petani
7 = Nelayan
8 = Buruh
9 = Pensiunan
10 = Dokter/Bidan/Perawat
11 = Pedagang
12 = Lainnya
```

### Kode Penghasilan (Dapodik):
```
0 = Tidak Berpenghasilan
1 = Kurang dari Rp. 500,000
2 = Rp. 500,000 - Rp. 999,999
3 = Rp. 1,000,000 - Rp. 1,999,999
4 = Rp. 2,000,000 - Rp. 4,999,999
5 = Rp. 5,000,000 - Rp. 20,000,000
6 = Lebih dari Rp. 20,000,000
```

### Kode Pendidikan Terakhir (Dapodik):
```
0 = Tidak Sekolah
1 = Paket A (SD)
2 = SD/MI
3 = SMP/MTs/Paket B
4 = SMA/MA/SMK/Paket C
5 = D1
6 = D2
7 = D3
8 = D4/S1
9 = S2
10 = S3
```

### Kode Jenis Tinggal (Dapodik):
```
1 = Bersama Orang Tua
2 = Wali
3 = Kos
4 = Asrama
5 = Panti Asuhan/Sosial
6 = Lainnya
```

### Kode Agama (EMIS & Dapodik):
```
1 = Islam
2 = Kristen
3 = Katolik
4 = Hindu
5 = Budha
6 = Konghucu
```

---

# BAGIAN D — CATATAN IMPLEMENTASI

## D.1 Perbedaan EMIS vs Dapodik

| Aspek | EMIS (Kemenag) | Dapodik (Kemendikbud) |
|-------|---------------|----------------------|
| Kelola | Kementerian Agama | Kemendikbud |
| Target | Pesantren, MDT, TPQ, Madrasah | SD, SMP, SMA, SMK, PAUD |
| Portal | emis.kemenag.go.id | dapo.kemdikbud.go.id |
| Update | Per semester | Per semester |
| Format Santri | NIS (internal) | NISN (nasional) |
| Identitas Lembaga | NSP | NPSN |

## D.2 Strategi Export di Sistem Al-Hasanah

Buat tombol **"Export EMIS"** dan **"Export Dapodik"** di modul yang relevan:

```
Admin Panel → Modul Santri → [Export EMIS Santri .xlsx]
Admin Panel → Modul Pegawai → [Export EMIS PTK .xlsx] | [Export GTK Dapodik .xlsx]
Admin Panel → Modul Lembaga → [Export Profil Dapodik .xlsx]
Admin Panel → Modul Akademik → [Export Rombel Dapodik .xlsx]
```

Setiap export harus:
1. Mengambil data dari database sesuai semester & tahun ajaran yang dipilih
2. Memetakan field database ke kolom EMIS/Dapodik
3. Mengkonversi nilai teks ke kode numerik yang dipakai pemerintah
4. Generate file `.xlsx` dengan format header yang sesuai
5. Memberikan peringatan jika ada field wajib yang masih kosong

## D.3 Field yang Belum Tentu Ada di Database Lama

Sebelum implementasi, jalankan query ini untuk cek kelengkapan data:

```sql
-- Cek santri yang NIK-nya kosong (wajib untuk EMIS)
SELECT COUNT(*) as tanpa_nik FROM santri WHERE nik IS NULL OR nik = '';

-- Cek santri yang data orang tuanya kosong
SELECT COUNT(*) as tanpa_data_ortu FROM santri
WHERE nama_ayah IS NULL OR nama_ibu IS NULL;

-- Cek pegawai yang NUPTK-nya kosong
SELECT COUNT(*) as tanpa_nuptk FROM pegawai
WHERE nuptk IS NULL OR nuptk = '';
```

---

> **⚠️ DISCLAIMER**:
> Format EMIS dan Dapodik dapat berubah setiap tahun ajaran baru.
> Dokumen ini disusun berdasarkan formulir EMIS 4.0 dan Dapodik 2026 yang berlaku.
> Selalu verifikasi dengan mengunduh formulir terbaru dari:
> - EMIS: https://emis.kemenag.go.id
> - Dapodik: https://dapo.kemdikbud.go.id/unduhan
> - Panduan Dapodik: https://cdn-dapodik.kemdikbud.go.id/panduan/Panduan_Lengkap_Aplikasi_Dapodik_versi_2026.pdf
