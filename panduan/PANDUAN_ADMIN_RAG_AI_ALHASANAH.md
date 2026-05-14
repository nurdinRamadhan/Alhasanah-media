# Panduan Admin RAG AI Al-Hasanah

Dokumen ini menjelaskan fitur RAG AI yang baru dibuat di Admin Panel Al-Hasanah. Tujuannya agar admin non-teknis memahami fungsi fitur, istilah penting, alur kerja harian, dan cara memakai AI untuk membantu analisis serta pengambilan keputusan.

---

## 1. Ringkasan Singkat

RAG AI adalah fitur yang membuat AI bisa menjawab pertanyaan berdasarkan dokumen yang admin upload dan data sistem yang sudah ada di database.

Contoh manfaat:

- Menjawab pertanyaan umum tentang pesantren dari dokumen profil, jadwal, FAQ, atau pengumuman.
- Menjawab pertanyaan agama atau kitab dari dokumen kitab/referensi yang sudah diupload.
- Membantu pengurus membandingkan dokumen rekap dengan data sistem.
- Membantu memberi rekomendasi keputusan berbasis data keuangan, kesantrian, akademik, hafalan, operasional, dan dokumen internal.
- Menyediakan log agar aktivitas AI dapat dipantau kembali.

Fitur ini bukan pengganti keputusan pengurus. AI hanya membantu menyusun ringkasan, membandingkan data, dan memberi rekomendasi awal. Keputusan akhir tetap berada pada pengurus pesantren.

---

## 2. Hak Akses

Menu RAG Knowledge Base dan fitur RAG Decision hanya tersedia untuk:

- `super_admin`
- `rois`
- `dewan`

Pembagian akses:

- `super_admin`: dapat melihat, menambah, mengubah status, menghapus dokumen RAG, melihat chunk, melihat log, dan menjalankan analisis keputusan.
- `rois`: dapat mengelola dokumen RAG dan menjalankan analisis keputusan.
- `dewan`: dapat melihat dokumen, melihat log, melihat chunk, dan menjalankan analisis keputusan. Untuk perubahan data umum, role dewan tetap dibatasi sesuai aturan akses sistem.

Role lain seperti `bendahara`, `kesantrian`, dan `alumni` tidak melihat sidebar RAG.

---

## 3. Istilah Penting

### RAG

RAG adalah singkatan dari Retrieval-Augmented Generation. Artinya AI tidak hanya menjawab dari pengetahuan umum, tetapi mencari dulu informasi relevan dari dokumen yang sudah diupload, lalu menyusun jawaban berdasarkan informasi tersebut.

### Knowledge Base

Knowledge Base adalah kumpulan dokumen yang menjadi sumber jawaban AI. Di fitur ini, dokumen dapat berupa:

- teks yang diketik manual
- file PDF
- file Word `.docx`
- file Excel `.xlsx`
- file CSV
- file TXT/Markdown

### Dokumen Publik

Dokumen yang boleh dipakai untuk chatbot publik, misalnya di website atau aplikasi Android tanpa login.

Contoh:

- profil pesantren
- sejarah pesantren
- jadwal kegiatan umum
- FAQ pendaftaran
- informasi program pendidikan
- pengumuman umum

### Kitab & Referensi

Dokumen untuk pertanyaan agama, kitab, fikih, akhlak, dan referensi keilmuan.

Contoh:

- terjemah kitab
- ringkasan bab fikih
- materi kajian
- referensi akhlak
- tanya jawab keagamaan yang sudah diverifikasi

### Dokumen Internal

Dokumen untuk kebutuhan pengurus dan analisis keputusan internal.

Contoh:

- SOP pesantren
- rekapitulasi keuangan
- rekapitulasi pelanggaran
- rekap hafalan
- laporan kesehatan
- laporan operasional
- kebijakan yayasan
- notulen rapat
- rencana kerja

Dokumen internal tidak dipakai untuk chatbot publik.

### Chunk

Chunk adalah potongan kecil dari dokumen. Dokumen panjang akan dipecah menjadi beberapa chunk agar AI dapat mencari bagian yang paling relevan.

Contoh:

- Dokumen 10 halaman bisa menjadi 20-60 chunk.
- Saat user bertanya, sistem mencari beberapa chunk yang paling mirip dengan pertanyaan.

### Embedding

Embedding adalah bentuk angka dari teks. Angka ini digunakan sistem untuk mencari kemiripan antara pertanyaan user dengan isi dokumen.

Admin tidak perlu memahami rumusnya. Yang penting: dokumen harus diproses embedding agar bisa dicari oleh AI.

### Similarity

Similarity adalah skor kemiripan antara pertanyaan dan potongan dokumen. Semakin tinggi skor, semakin relevan dokumen tersebut.

### Metadata

Metadata adalah keterangan tambahan tentang dokumen atau chunk.

Contoh metadata:

```json
{
  "periode": "Mei 2026",
  "modul": "keuangan",
  "jenis_laporan": "rekap_tagihan",
  "sumber": "export_admin_panel",
  "dibuat_oleh": "bendahara"
}
```

Metadata membantu admin menandai dokumen agar mudah dilacak, tetapi tidak wajib untuk dokumen sederhana.

### RAG Decision

RAG Decision adalah fitur di floating AI `GeminiConsultant` yang menggabungkan:

- data agregat dari database sistem
- dokumen internal RAG
- referensi kitab jika dipilih

Hasilnya adalah analisis dan rekomendasi untuk pengambilan keputusan.

---

## 4. Komponen Fitur yang Sudah Tersedia

### 4.1 Menu RAG Knowledge Base

Lokasi: sidebar admin panel, menu `RAG Knowledge Base`.

Di menu ini admin dapat:

- menambah dokumen
- upload file
- memproses embedding
- menyimpan draft metadata
- mengubah status dokumen
- melihat jumlah chunk
- melihat isi chunk
- melihat log query AI
- mencoba chatbot publik
- menjalankan admin decision support

### 4.2 Floating AI GeminiConsultant

Floating AI sekarang memiliki mode tambahan:

- `Analisis`: analisis modul lama berdasarkan data real-time ringkas.
- `AI Agent`: agent eksekusi dengan konfirmasi manusia.
- `RAG Decision`: analisis keputusan berbasis dokumen RAG dan database.
- `Laporan`: pembuatan laporan/export.

Untuk fitur baru ini, gunakan mode `RAG Decision`.

### 4.3 Edge Functions

Sistem memakai beberapa Edge Function:

- `rag-ingest`: memproses dokumen menjadi chunk dan embedding.
- `rag-query-public`: chatbot publik untuk dokumen publik atau kitab.
- `rag-query-admin`: analisis keputusan admin.
- `rag-query-wali`: chatbot wali santri untuk aplikasi Android login wali.

Admin panel saat ini terutama memakai:

- `rag-ingest`
- `rag-query-public`
- `rag-query-admin`

---

## 5. Alur Kerja Admin

### Langkah 1: Tentukan Jenis Dokumen

Sebelum upload, tentukan dokumen masuk kategori apa.

Gunakan `Dokumen Publik` jika isinya boleh diketahui masyarakat umum.

Contoh:

- profil pesantren
- jadwal pendaftaran
- biaya pendaftaran umum
- kegiatan pesantren

Gunakan `Kitab & Referensi` jika isinya untuk pertanyaan agama atau ilmu.

Contoh:

- materi fikih
- bab thaharah
- bab shalat
- akhlak santri

Gunakan `Dokumen Internal` jika isinya hanya untuk pengurus.

Contoh:

- rekap tagihan
- rekap pelanggaran
- laporan kesehatan
- SOP pengurus
- laporan bulanan

### Langkah 2: Buka Menu RAG Knowledge Base

Masuk ke sidebar:

`RAG Knowledge Base`

Pilih tab sesuai jenis dokumen:

- Dokumen Publik
- Kitab & Referensi
- Dokumen Internal

### Langkah 3: Klik Tambah Dokumen

Isi:

- `Judul`
- `Sumber`
- `Tipe`
- `Status`
- `Konten Dokumen`
- `Chunk Size`
- `Chunk Overlap`
- `Metadata JSON`

Jika memakai file, drag/upload file ke area upload. Sistem akan mencoba mengambil teks otomatis.

### Langkah 4: Periksa Teks Hasil Ekstraksi

Setelah upload file, lihat field `Konten Dokumen`.

Pastikan:

- teks terbaca cukup rapi
- tidak kosong
- tidak terlalu banyak karakter rusak
- tidak ada data rahasia yang tidak boleh dipakai AI

Jika file PDF hasil scan gambar, teks mungkin tidak terbaca. PDF seperti itu perlu OCR terlebih dahulu di luar sistem.

### Langkah 5: Isi Metadata

Metadata tidak wajib, tetapi sangat disarankan untuk dokumen rekap dan internal.

Contoh dokumen rekap tagihan:

```json
{
  "periode": "Mei 2026",
  "modul": "keuangan",
  "jenis_laporan": "rekap_tagihan",
  "kelas": "semua",
  "sumber": "export_admin_panel"
}
```

Contoh dokumen SOP:

```json
{
  "kategori": "sop",
  "bidang": "kedisiplinan",
  "versi": "2026.1",
  "berlaku_mulai": "2026-05-01"
}
```

Contoh dokumen kitab:

```json
{
  "kitab": "Fathul Qarib",
  "bab": "Thaharah",
  "bahasa": "indonesia",
  "sumber": "materi_internal"
}
```

### Langkah 6: Proses Embedding

Klik `Proses Embedding`.

Jika berhasil, sistem menampilkan jumlah chunk yang dibuat.

Jika gagal, cek:

- apakah konten kosong
- apakah akun punya akses
- apakah Gemini API key aktif
- apakah koneksi Edge Function normal
- apakah dokumen terlalu besar

### Langkah 7: Pastikan Status Aktif

Hanya dokumen `active` yang dipakai dalam pencarian RAG.

Status:

- `draft`: dokumen belum dipakai AI.
- `active`: dokumen dipakai AI.
- `archived`: dokumen disimpan tetapi tidak dipakai AI.

### Langkah 8: Cek Chunk

Klik tombol `Chunk` pada dokumen.

Gunanya:

- memastikan dokumen benar-benar terpecah
- melihat apakah isi chunk rapi
- mengecek metadata chunk
- memastikan dokumen siap dipakai AI

### Langkah 9: Uji dengan Test Chatbot

Masuk tab `Test Chatbot`.

Pilih:

- Dokumen Publik Pesantren
- Kitab & Referensi

Masukkan pertanyaan. Lihat jawaban dan sumber yang ditemukan.

### Langkah 10: Gunakan RAG Decision

Ada dua tempat:

1. Tab `Admin Decision` di halaman RAG.
2. Floating AI `GeminiConsultant`, mode `RAG Decision`.

Disarankan memakai floating `RAG Decision` untuk kebutuhan harian pengurus.

---

## 6. Cara Memakai RAG Decision

### 6.1 Pilih Konteks

Pilihan konteks:

- `Operasional`: untuk evaluasi umum pesantren.
- `Keuangan`: untuk tagihan, pengeluaran, dan kondisi finansial.
- `Akademik`: untuk hafalan, kitab, nilai, dan pembelajaran.
- `Kesantrian`: untuk santri, pelanggaran, kesehatan, perizinan, prestasi.
- `Kitab`: untuk analisis berbasis referensi kitab.

### 6.2 Pilih Filter

Filter yang tersedia:

- kelas
- bulan
- tahun

Gunakan filter agar jawaban lebih fokus.

Contoh:

- kelas 2, bulan Mei, tahun 2026
- semua kelas, bulan Mei, tahun 2026

### 6.3 Pilih Sumber Analisis

Sumber yang dapat digabung:

- `Data DB`: data agregat dari database sistem.
- `Dokumen Internal`: dokumen RAG internal yang diupload.
- `Kitab`: referensi kitab jika relevan.

Untuk keputusan manajemen, biasanya aktifkan:

- Data DB: aktif
- Dokumen Internal: aktif
- Kitab: opsional

### 6.4 Tulis Pertanyaan

Contoh pertanyaan yang baik:

- "Bandingkan kondisi tagihan bulan ini dengan dokumen rekap bendahara, lalu beri tiga prioritas tindakan."
- "Analisis apakah pelanggaran bulan ini meningkat dan sarankan langkah pembinaan berdasarkan SOP internal."
- "Evaluasi progres hafalan kelas 3 dan beri rekomendasi untuk santri yang perlu pendampingan."
- "Berdasarkan dokumen SOP dan data kesehatan, apa risiko operasional minggu ini?"
- "Buat ringkasan keputusan untuk rapat pengurus bulan ini berdasarkan data keuangan dan dokumen internal."

Contoh pertanyaan yang kurang baik:

- "Bagaimana pesantren?"
- "Apa yang harus dilakukan?"
- "Beri saran."

Pertanyaan yang baik menyebut topik, periode, tujuan, dan bentuk output yang diinginkan.

---

## 7. Penggunaan Dokumen Rekap untuk Perbandingan Data

Anda dapat upload dokumen rekap dari berbagai modul agar AI bisa membandingkan data.

Contoh dokumen yang cocok:

- rekap tagihan bulanan
- rekap pembayaran
- rekap pengeluaran
- rekap pelanggaran
- rekap kesehatan
- rekap perizinan
- rekap hafalan tahfidz
- rekap hafalan kitab
- rekap prestasi
- laporan rapat pengurus
- SOP penanganan masalah

Alur yang disarankan:

1. Export rekap dari modul terkait.
2. Simpan sebagai Excel/PDF/Word/TXT.
3. Upload ke `RAG Knowledge Base`.
4. Pilih `source_type = internal`.
5. Pilih `document_type = report` untuk rekap atau `sop` untuk SOP.
6. Isi metadata periode dan modul.
7. Proses embedding.
8. Buka floating AI.
9. Pilih `RAG Decision`.
10. Tanyakan perbandingan atau rekomendasi.

Contoh metadata untuk rekap:

```json
{
  "periode": "Mei 2026",
  "tahun": 2026,
  "bulan": "05",
  "modul": "pelanggaran",
  "jenis_laporan": "rekap_bulanan",
  "cakupan": "semua_kelas"
}
```

---

## 8. Rekomendasi Chunk Size dan Chunk Overlap

Default sistem:

- Chunk Size: `500`
- Chunk Overlap: `50`

Gunakan default untuk sebagian besar dokumen.

### Dokumen FAQ pendek

- Chunk Size: `300-450`
- Chunk Overlap: `30-50`

### Dokumen SOP

- Chunk Size: `450-650`
- Chunk Overlap: `50-80`

### Dokumen laporan/rekap

- Chunk Size: `500-700`
- Chunk Overlap: `50-80`

### Dokumen kitab/referensi

- Chunk Size: `400-600`
- Chunk Overlap: `60-100`

Jangan gunakan overlap terlalu besar karena dapat membuat potongan berulang dan biaya embedding lebih tinggi.

---

## 9. Keamanan Data

Fitur ini sudah dibuat dengan prinsip aman:

- AI admin memakai data agregat, bukan detail sensitif.
- Field seperti NIK, NIS, alamat lengkap, nomor HP, token, dan rekening disanitasi.
- Dokumen internal hanya untuk role pengurus.
- Query AI dicatat di log.
- Role wali memakai endpoint sendiri dan hanya membaca santri yang terhubung ke akun wali.
- Chatbot publik tidak membaca dokumen internal.

Namun admin tetap wajib berhati-hati:

- Jangan upload dokumen berisi password, token, rekening, atau rahasia sistem.
- Jangan menjadikan dokumen internal sebagai dokumen publik.
- Jangan upload data pribadi lengkap jika tidak diperlukan.
- Selalu cek hasil ekstraksi file sebelum embedding.

---

## 10. Cara Membaca Hasil AI

Saat AI menjawab, perhatikan:

- apakah AI memakai data DB
- apakah AI menemukan dokumen internal
- apakah AI memakai referensi kitab
- berapa sumber yang ditemukan
- apakah confidence note menyatakan data cukup atau terbatas

Jika jawaban terasa kurang tepat:

1. Cek apakah dokumen sudah `active`.
2. Cek jumlah chunk dokumen.
3. Cek apakah metadata dan judul dokumen jelas.
4. Coba pertanyaan yang lebih spesifik.
5. Upload dokumen pendukung yang lebih lengkap.
6. Pastikan konteks dan filter benar.

---

## 11. Contoh Skenario Lengkap

### Skenario 1: Evaluasi Keuangan Bulanan

1. Upload rekap tagihan bulan Mei 2026 sebagai dokumen internal.
2. Metadata:

```json
{
  "periode": "Mei 2026",
  "modul": "keuangan",
  "jenis_laporan": "rekap_tagihan"
}
```

3. Buka floating AI.
4. Pilih `RAG Decision`.
5. Konteks: `Keuangan`.
6. Aktifkan `Data DB` dan `Dokumen Internal`.
7. Tanyakan:

"Bandingkan data tagihan database bulan Mei 2026 dengan dokumen rekap tagihan, lalu beri prioritas penagihan dan risiko keuangan."

### Skenario 2: Evaluasi Kedisiplinan

1. Upload SOP penanganan pelanggaran.
2. Upload rekap pelanggaran bulan berjalan.
3. Pilih `RAG Decision`.
4. Konteks: `Kesantrian`.
5. Tanyakan:

"Analisis tren pelanggaran bulan ini dan cocokkan dengan SOP. Berikan rekomendasi pembinaan yang tidak hanya bersifat hukuman."

### Skenario 3: Evaluasi Hafalan

1. Upload rekap hafalan.
2. Pilih konteks `Akademik`.
3. Tanyakan:

"Evaluasi progres hafalan kelas 3 bulan ini. Siapa kelompok yang perlu perhatian dan strategi apa yang disarankan?"

### Skenario 4: Persiapan Rapat Pengurus

1. Upload beberapa rekap: keuangan, pelanggaran, kesehatan, hafalan.
2. Pilih konteks `Operasional`.
3. Tanyakan:

"Buat ringkasan untuk rapat pengurus minggu ini: temuan utama, risiko, dan tiga keputusan prioritas."

---

## 12. Batasan Fitur

Fitur ini kuat untuk ringkasan dan analisis, tetapi memiliki batas:

- AI tidak tahu dokumen yang belum diupload.
- AI tidak memakai dokumen berstatus draft/archived.
- AI bisa kurang tepat jika dokumen hasil ekstraksi berantakan.
- AI tidak boleh dipakai untuk keputusan sensitif tanpa validasi manusia.
- AI tidak otomatis mengubah data; untuk aksi database tetap butuh fitur agent dan konfirmasi manusia.

---

## 13. Checklist Admin

Sebelum memakai RAG Decision:

- Dokumen sudah diupload.
- Teks hasil ekstraksi sudah dicek.
- Metadata sudah cukup jelas.
- Dokumen berstatus `active`.
- Jumlah chunk lebih dari 0.
- Konteks/filter sudah benar.
- Pertanyaan sudah spesifik.

Setelah menerima jawaban:

- Periksa sumber yang digunakan.
- Cocokkan rekomendasi dengan keadaan lapangan.
- Gunakan sebagai bahan rapat, bukan keputusan otomatis.
- Jika perlu, upload dokumen tambahan lalu analisis ulang.

---

## 14. Status Implementasi Saat Ini

Admin panel sudah memiliki pondasi lengkap untuk:

- upload dokumen RAG
- ekstraksi file
- embedding dokumen
- chunk viewer
- log query
- test chatbot publik
- admin decision support
- floating RAG Decision di GeminiConsultant
- endpoint publik untuk Android/website
- endpoint wali untuk Android login wali

Tahap berikutnya setelah admin panel stabil adalah integrasi di project Android/Kotlin.

