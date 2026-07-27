# Referensi Halaman Publik Download Aplikasi Al-Hasanah Media

**Tujuan dokumen:**  
Menjadi referensi awal untuk membangun halaman publik `/download` pada website admin panel, sekaligus sebagai arah pengembangan halaman publik lain di masa depan.

---

## 1. Latar Belakang

Halaman publik ini disiapkan agar wali santri dapat mengunduh APK Al-Hasanah Media tanpa harus masuk ke area admin.

Pendekatan yang dipilih:

- Website utama tetap menjadi **admin panel**
- Halaman publik dibuka hanya pada route tertentu, misalnya:
  - `/download`
  - `/changelog`
  - `/privacy`
  - `/terms`
  - `/faq`
- File APK disimpan di **GitHub Releases**
- Tombol unduh pada halaman publik mengarah ke file rilis terbaru

Dengan pola ini, pengguna tetap melihat satu domain yang sama, sementara akses login admin tetap terpisah.

---

## 2. Tujuan Halaman `/download`

Halaman ini tidak hanya berfungsi sebagai tombol unduh, tetapi sebagai **halaman rilis resmi**.

Fungsi utamanya:

- Menyediakan APK terbaru untuk wali santri
- Menampilkan versi aplikasi terbaru
- Menampilkan ringkasan perubahan
- Menjadi pusat informasi rilis
- Memberi kesan profesional dan terpercaya

---

## 3. Struktur Halaman yang Disarankan

### Bagian atas
- Logo / identitas Al-Hasanah Media
- Judul halaman
- Subjudul singkat
- Status versi terbaru

Contoh:

- **Al-Hasanah Media**
- *Aplikasi resmi layanan santri dan wali santri*
- Versi terbaru: **v1.0.5**

### Bagian tengah
- Ringkasan fitur terbaru
- Changelog singkat
- Informasi kompatibilitas Android
- Ukuran APK
- Tanggal rilis

### Bagian bawah
- Tombol unduh utama
- Tombol bantuan / panduan instalasi
- Tautan ke kebijakan privasi
- Tautan ke bantuan bila instalasi gagal

---

## 4. Konten yang Sebaiknya Ditampilkan

### Informasi rilis
- Versi aplikasi
- Tanggal rilis
- Nomor build
- Ukuran file APK
- Minimum Android yang didukung

### Changelog singkat
Contoh isi:
- Perbaikan duplikasi tagihan
- Penyempurnaan tampilan detail tagihan
- Optimisasi performa admin panel
- Perbaikan notifikasi
- Peningkatan stabilitas login

### Panduan instalasi singkat
- Aktifkan izin instalasi dari sumber luar jika diminta
- Unduh APK
- Buka file hasil unduhan
- Ikuti langkah instalasi
- Jika muncul peringatan, baca petunjuk yang tersedia

### Informasi teknis tambahan
- SHA-256 checksum untuk verifikasi file
- Catatan kompatibilitas device tertentu
- Catatan bug penting jika ada

---

## 5. Alur Distribusi yang Disarankan

```text
Developer push kode ke GitHub
        ↓
GitHub Actions membangun APK
        ↓
APK diunggah ke GitHub Releases
        ↓
Website admin panel memperbarui link download
        ↓
Wali santri membuka /download
        ↓
Wali santri mengunduh APK terbaru
```

Keuntungan alur ini:

- Tidak membebani Supabase Storage
- Tidak perlu menyebar file APK secara manual
- Pengguna tidak perlu berinteraksi langsung dengan GitHub
- Tombol unduh dapat selalu mengarah ke versi terbaru

---

## 6. Rekomendasi Desain Visual

Halaman `/download` sebaiknya terasa seperti halaman produk resmi, bukan sekadar halaman file.

### Nuansa visual
- Bersih
- Premium
- Rapi
- Banyak ruang kosong
- Fokus pada satu aksi utama: unduh aplikasi

### Elemen desain yang disarankan
- Hero section yang kuat
- Card versi terbaru
- Button CTA yang jelas
- Changelog box
- Badge status seperti:
  - `Latest`
  - `Stable`
  - `Recommended`
- Ikon Android / perangkat
- Tampilan responsif untuk HP

### Gaya penulisan
- Singkat
- Meyakinkan
- Ramah
- Tidak teknis berlebihan
- Mudah dipahami wali santri

---

## 7. Halaman Publik Lain yang Bisa Ditambahkan

Di masa depan, domain yang sama bisa dikembangkan menjadi pusat informasi publik Al-Hasanah Media.

### `/changelog`
Halaman daftar perubahan per versi.

Isi:
- versi
- tanggal rilis
- bug fix
- fitur baru
- perbaikan keamanan
- peningkatan performa

### `/privacy`
Halaman kebijakan privasi.

Isi:
- data apa yang dikumpulkan
- tujuan penggunaan data
- siapa yang dapat mengakses
- berapa lama data disimpan
- kontak jika ada pertanyaan

### `/terms`
Halaman syarat penggunaan.

Isi:
- aturan penggunaan aplikasi
- batasan akses
- kewajiban pengguna
- batasan tanggung jawab sistem

### `/faq`
Halaman pertanyaan yang sering diajukan.

Contoh pertanyaan:
- Cara instal aplikasi
- Kenapa aplikasi tidak bisa dipasang
- Kenapa notifikasi tidak masuk
- Cara update ke versi terbaru
- Apa yang harus dilakukan jika login gagal

### `/help`
Halaman bantuan teknis singkat.

Isi:
- langkah instalasi
- troubleshooting dasar
- cara membersihkan cache
- cara menghubungi developer

### `/status`
Halaman status layanan.

Isi:
- kondisi server
- kondisi notifikasi
- kondisi API
- kondisi maintenance

### `/contact`
Halaman kontak resmi.

Isi:
- WhatsApp developer
- email
- jam layanan
- kanal bantuan untuk pengurus

---

## 8. Ide yang Terasa Sangat Profesional

Berikut ide yang menurut saya akan membuat proyek ini terasa lebih matang dan kredibel.

### 8.1 Halaman versi publik otomatis
Halaman `/download` menampilkan versi terbaru secara otomatis dari data rilis.

Manfaat:
- tidak perlu edit manual setiap rilis
- lebih konsisten
- mengurangi human error

### 8.2 Tombol unduh permanen
Gunakan tautan permanen seperti:

- `/download/latest`
- `/download/app`

Lalu di belakang layar tautan tersebut diarahkan ke file rilis terbaru.

Manfaat:
- link tidak perlu berubah
- lebih mudah dibagikan
- cocok untuk poster, QR code, dan pesan WhatsApp

### 8.3 QR code resmi
Buat QR code yang mengarah ke halaman `/download`.

Manfaat:
- mudah dibagikan ke wali santri
- cocok ditempel di brosur, banner, atau grup
- terlihat profesional

### 8.4 Changelog ringkas yang mudah dibaca
Tampilkan hanya poin penting, jangan terlalu teknis.

Contoh:
- Perbaikan tampilan tagihan
- Notifikasi lebih stabil
- Login lebih cepat
- Detail santri lebih rapi

### 8.5 Badge versi stabil
Tambahkan label seperti:
- Stable
- Recommended
- Latest

Manfaat:
- membantu wali santri merasa aman saat mengunduh

### 8.6 Tombol bantuan instalasi
Jika install gagal, pengguna langsung tahu harus klik ke mana.

Contoh:
- Panduan instalasi
- Hubungi bantuan
- Lihat FAQ

### 8.7 Halaman “Riwayat Versi”
Halaman terpisah untuk arsip rilis lama.

Manfaat:
- berguna untuk debugging
- berguna jika user perlu downgrade
- bagus untuk dokumentasi historis

### 8.8 SHA-256 checksum
Tambahkan checksum file APK.

Manfaat:
- verifikasi integritas file
- terlihat sangat profesional
- bagus untuk audit internal

---

## 9. Struktur Route yang Disarankan

Contoh struktur route pada website admin panel:

```text
/
├── login
├── download
├── changelog
├── privacy
├── terms
├── faq
├── help
├── status
└── dashboard
```

### Public routes
- `/download`
- `/changelog`
- `/privacy`
- `/terms`
- `/faq`
- `/help`
- `/status`
- `/contact`

### Protected routes
- `/`
- `/dashboard`
- `/santri`
- `/tagihan`
- `/absensi`
- `/laporan`
- `/pengaturan`

---

## 10. Catatan Implementasi

### Frontend
- Gunakan desain yang ringan dan responsif
- Hindari tampilan yang terlalu ramai
- Pastikan tombol unduh mudah ditemukan di layar kecil

### Backend / Data
- Simpan metadata rilis terbaru di satu sumber data
- Link APK sebaiknya tidak hardcoded di banyak tempat
- Metadata rilis bisa diambil dari JSON atau tabel khusus

### Deployment
- GitHub Actions membangun APK
- GitHub Release menyimpan APK
- Website hanya menampilkan dan mengarahkan link

---

## 11. Prioritas Pengembangan

### Tahap 1
- Buat halaman `/download`
- Tambahkan tombol unduh ke GitHub Releases
- Tambahkan versi terbaru dan changelog singkat

### Tahap 2
- Tambahkan `/privacy`, `/terms`, `/faq`
- Tambahkan QR code download
- Tambahkan validasi link rilis

### Tahap 3
- Tambahkan `/status`
- Tambahkan riwayat versi
- Tambahkan checksum file
- Tambahkan sistem update otomatis dari metadata rilis

---

## 12. Prinsip Utama

Halaman publik ini harus:

- mudah dipahami
- terasa resmi
- tidak membingungkan pengguna
- aman
- tidak membebani storage inti
- mudah dirawat oleh developer

---

## 13. Kesimpulan

Pendekatan terbaik untuk Al-Hasanah Media adalah:

- satu domain utama untuk admin panel
- satu halaman publik `/download`
- file APK disimpan di GitHub Releases
- halaman publik lain ditambahkan bertahap sesuai kebutuhan

Dengan cara ini, sistem tetap sederhana, profesional, hemat biaya, dan siap dikembangkan ke arah yang lebih besar.
