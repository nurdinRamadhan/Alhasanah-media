# ANALISIS KOMPREHENSIF SISTEM ABSENSI & HAFALAN PESANTREN
### Dokumen Referensi Pengembangan Fitur Al-Hasanah v1.0
**Berdasarkan:** `ABSENSI_1_MUHARRAM_1448_H.xlsx` & `ABSENSI_RAJAB.xlsx`

---

## DAFTAR ISI

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Analisis File 1 — ABSENSI_1_MUHARRAM_1448_H.xlsx](#2-analisis-file-1)
3. [Analisis File 2 — ABSENSI_RAJAB.xlsx](#3-analisis-file-2)
4. [Perbandingan Antar Sheet & Antar File](#4-perbandingan)
5. [Analisis Status & Enum Lengkap](#5-analisis-status--enum)
6. [Analisis Otomasi — Lengkap Per Fitur](#6-analisis-otomasi)
7. [Rekomendasi Arsitektur Database](#7-arsitektur-database)
8. [Rekomendasi UI Admin Panel](#8-rekomendasi-ui)
9. [Risiko & Hal yang Perlu Dikonfirmasi ke Pengurus](#9-risiko--konfirmasi)

---

## 1. RINGKASAN EKSEKUTIF

Dari kedua file ditemukan **8 jenis pencatatan berbeda** yang saat ini dilakukan secara manual di Excel oleh pengurus pesantren. Masing-masing memiliki struktur, status, dan logika yang berbeda-beda.

| # | Nama Sheet | File | Jenis Data | Terikat Hafalan? |
|---|-----------|------|-----------|-----------------|
| 1 | DATA HAFALAN | File 1 | Peta juz yang dikuasai per santri | ✅ Turunan langsung |
| 2 | target | File 1 | Target hafalan per periode Diklat | ✅ Turunan + manual |
| 3 | Setoran | File 2 | Absensi + detail setoran harian | ✅ Inti kegiatan |
| 4 | Murojaah | File 2 | Absensi + detail murojaah harian | ✅ Inti kegiatan |
| 5 | NGAJI | File 2 | Absensi kegiatan ngaji harian | ❌ Independen |
| 6 | Mingguan | File 2 | Absensi kegiatan mingguan (4 event) | ❌ Independen |
| 7 | Kehadiran | File 2 | Kehadiran fisik santri di pesantren | ❌ Independen |
| 8 | Sholat Hifdzi | File 2 | Absensi sholat hifdzi mingguan | ❌ Independen |

**Kesimpulan utama:** Tidak semua absensi terikat pada hafalan. Dibutuhkan modul absensi terpisah yang bisa mengakomodasi berbagai jenis kegiatan, sementara absensi setoran dan murojaah tetap terintegrasi dengan fitur hafalan yang sudah ada.

---

## 2. ANALISIS FILE 1 — ABSENSI_1_MUHARRAM_1448_H.xlsx

### 2.1 Sheet: DATA HAFALAN

**Nama resmi:** *Peta Data Hafalan 1 Muharram 1448 H*

#### Struktur Data

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| NO | Integer | Nomor urut santri |
| NAMA | Text | Nama lengkap santri |
| JUMLAH | Integer (0–30) | Total juz yang telah dikuasai |
| Juz 1–30 | Boolean (TRUE/FALSE) | Apakah juz tersebut sudah dikuasai |

#### Data Aktual (22 Santri)

| No | Nama | Total Juz |
|----|------|-----------|
| 1 | AYI KOSIM HATIMI | 30 ✅ |
| 2 | ABRURRAHMAN AFANDI | 30 ✅ |
| 3 | CECEP ABDULATIF | 30 ✅ |
| 4 | DONI SUPRIATNA | 30 ✅ |
| 5 | ZAKY AZHARI | 30 ✅ |
| 6 | MUHAMMAD FAUZIL ADZIM | 30 ✅ |
| 7 | MUHAMMAD DZIKRI HUSAENI | 18 |
| 8 | ABDUL KHOLIQ | 14 |
| 9 | IYAN FARID | 13 |
| 10 | ZAENI NURIL HIKAM | 12 |
| 11 | LUCKY KURNIAWAN | 12 |
| 12 | MUHAMMAD RAFIK MUHARAM | 12 |
| 13 | UMAR ABDUL MALIK | 11 |
| 14 | AHMAD HAFIDZ ALHAWARI | 10 |
| 15 | MUHAMMAD FAUZAN | 10 |
| 16 | AKBAR RAMADAN | 9 |
| 17 | ABIDZAR ALGHIFARI | 8 |
| 18 | KAFY MUHAMMAD AZIZY | 7 |
| 19 | MUHAMMAD MUNAWWAR KHOLIL | 4 |
| 20 | ALWI | 3 |
| 21 | PIRMAN | 1 |
| 22 | MUHAMMAD DENMAR NABAWI | 1 |

#### Pola Penting
- Santri dengan 30 juz: juz dikuasai **berurutan dari juz 1** (semua TRUE dari 1–30)
- Santri dengan juz < 30: ada **celah (FALSE)** di tengah, lalu TRUE lagi di akhir
  - Contoh: M. Dzikri Husaeni (18 juz): TRUE juz 1–13, FALSE juz 14–25, TRUE juz 26–30
  - Ini menunjukkan santri menghafalkan dari awal DAN dari juz 30 ke belakang secara bersamaan (pola umum di pesantren tahfidz)

#### Catatan Kritis
Pola hafalan tidak selalu linier dari juz 1 ke 30. Santri bisa menghafal dari dua arah sekaligus. Kolom JUMLAH adalah **hitungan TRUE**, bukan urutan. Ini harus tercermin di sistem.

---

### 2.2 Sheet: TARGET

**Nama resmi:** *Target Pencapaian Sebelum Diklat Rabi'ul Awwal*

#### Struktur Data

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| NO | Integer | Nomor urut |
| NAMA | Text | Nama santri |
| TARGET | Text bebas | Deskripsi target (tidak terstruktur) |
| PENCAPAIAN | Integer / kosong | Total juz yang sudah tercapai |
| EVALUASI PENCAPAIAN | Text | TERCAPAI / BELUM TERCAPAI |

#### Dua Tipe Target yang Ditemukan

**Tipe 1 — Ziyadah (hafalan baru):**
- Format: `"ziyadah N Juz"`
- Contoh: `"ziyadah 18 Juz"` → target tambah hafalan baru sejumlah N juz
- Evaluasi: bandingkan PENCAPAIAN (angka) vs target N

**Tipe 2 — Sima'an (hafalan yang harus bisa disimak):**
- Format: `"sima'an N Juz (juz X - Y)"`
- Contoh: `"sima'an 15 Juz (juz 1 - 15)"`
- Evaluasi: apakah juz-juz dalam range tersebut semua TRUE di peta hafalan

**Tipe 3 — Tahap Tahsin:**
- Format: `"tahap tahsin"`
- Tidak ada angka target — evaluasi bersifat kualitatif
- Tidak bisa diotomasi penuh

#### Masalah Ditemukan di File Asli
- **5 baris #REF!** — formula Excel rusak karena referensi ke baris yang dihapus
- **Kolom PENCAPAIAN banyak kosong** — tidak diisi manual oleh pengurus
- **Evaluasi BELUM TERCAPAI** pada santri yang seharusnya sudah tercapai — karena PENCAPAIAN tidak diisi

---

## 3. ANALISIS FILE 2 — ABSENSI_RAJAB.xlsx

### 3.1 Sheet: Setoran

**Nama resmi:** *Absensi Setoran (Bulan Rajab)*

#### Struktur Data

| Elemen | Detail |
|--------|--------|
| Periode | Per minggu (Minggu ke-1, 2, 3, dst.) |
| Hari aktif | Rabu, Kamis, Sabtu, Ahad, Senin, Selasa (6 hari, tanpa Jumat) |
| Sesi per hari | **PAGI** dan **SIANG** |
| Data per sesi | Materi setoran (text), Status (kode), Nama Penyimak (text) |
| Ringkasan per minggu | Total H, I, TD, S, A per santri |

#### Status yang Digunakan

| Kode | Jumlah Kemunculan | Makna Terverifikasi |
|------|------------------|---------------------|
| H | 1.125 | Hadir — datang dan setoran DITERIMA |
| A | 680 | Alpha — tidak hadir tanpa keterangan apapun |
| I | 169 | Izin — tidak hadir dengan izin resmi |
| S | 78 | Sakit — tidak hadir karena sakit |
| TD | 63 | Tidak Diterima — hadir dan menyetor tapi **setoran ditolak ustadz** |
| TS | 19 | Tidak Setoran — hadir secara fisik tapi **tidak menyetor** |

> **⚠️ CATATAN PENTING TENTANG TD:**
> Berdasarkan analisis pola data, TD bukan "Tidak Datang" melainkan "Tidak Diterima." Bukti: TD selalu disertai **materi setoran** dan **nama penyimak** — artinya santri datang, menyetor, tapi ustadz menolak setorannya. Berbeda dengan A yang tidak memiliki materi apapun.

#### Contoh Pola TD vs A dari Data Asli

```
Lucky K | 2 ayat juz 6 | TD | Syakir | 4 ayat juz 6 | H | Syakir
```
→ Sesi PAGI: datang, setor 2 ayat, ditolak (TD). Sesi SIANG: setor 4 ayat, diterima (H).

```
M Hafidz A H | [kosong] | A | [kosong] | [kosong] | A | [kosong]
```
→ Tidak ada materi, tidak ada penyimak. Tidak datang sama sekali.

#### Data Penyimak yang Muncul
Dari data ditemukan nama-nama penyimak: A Rifqi, Syakir, Faliq, Ahmad, Anton. Ini adalah **ustadz/pengurus** yang bertugas menyimak setoran per sesi.

---

### 3.2 Sheet: Murojaah

**Status:** Sheet ada, tapi **data kosong** di file yang diterima.
**Kesimpulan:** Fitur murojaah secara konseptual ada dan direncanakan, tapi belum dipakai di bulan Rajab. Strukturnya kemungkinan sama dengan Setoran.

---

### 3.3 Sheet: NGAJI

**Nama resmi:** *Absensi Ngaji*

#### Struktur Data

| Elemen | Detail |
|--------|--------|
| Periode | Per minggu |
| Hari aktif | 6 hari (sama seperti Setoran) |
| Sesi per hari | **MALAM** dan **PAGI** *(berbeda dari Setoran yang PAGI/SIANG)* |
| Data per sesi | **Status saja** — tidak ada materi, tidak ada penyimak |
| Ringkasan | Total H, I, TD, S, A per minggu per santri |

#### Status yang Digunakan

| Kode | Makna |
|------|-------|
| H | Hadir |
| A | Alpha |
| I | Izin |
| S | Sakit |

> **Tidak ada TD dan TS di sheet NGAJI.** Logis, karena ngaji tidak ada konsep "ditolak" — santri hadir atau tidak.

#### Perbedaan Kritis dengan Setoran

| Aspek | Setoran | NGAJI |
|-------|---------|-------|
| Sesi | PAGI / SIANG | MALAM / PAGI |
| Ada materi? | ✅ Ya | ❌ Tidak |
| Ada penyimak? | ✅ Ya | ❌ Tidak |
| Ada status TD? | ✅ Ya | ❌ Tidak |
| Ada status TS? | ✅ Ya | ❌ Tidak |

---

### 3.4 Sheet: Mingguan

**Nama resmi:** *Absensi Mingguan*

#### Struktur Data

| Elemen | Detail |
|--------|--------|
| Periode | Per minggu (Minggu 1–4) |
| Kegiatan | **Istighosah**, **N. Aang** (Ngaji Aang?), **Tilawah**, **Marhaba** |
| Frekuensi | Satu kali per minggu per kegiatan |
| Data | Status per kegiatan per minggu |

#### Status yang Digunakan

| Kode | Makna |
|------|-------|
| H | Hadir |
| A | Alpha |
| I | Izin |

> Tidak ada S (Sakit), TD, atau TS. Kegiatan mingguan menggunakan subset status yang lebih sederhana.

#### Catatan Penting
Satu sheet menampung **4 kegiatan berbeda** sekaligus. Ini berarti setiap kegiatan mingguan adalah entitas terpisah di database, bukan satu entitas "mingguan."

---

### 3.5 Sheet: Kehadiran

**Nama resmi:** *Kehadiran (Bulanan)*

#### Struktur Data

| Elemen | Detail |
|--------|--------|
| Periode | **Per tanggal dalam satu bulan** (tanggal 1–31) |
| Granularitas | Per hari, bukan per sesi |
| Santri | 36 santri (lebih banyak dari sheet Setoran — 22 santri) |

#### Status yang Digunakan

| Kode | Makna |
|------|-------|
| HADIR | Santri secara fisik ada di pesantren |
| GHAIB | Santri tidak ada di pesantren |

> **⚠️ SANGAT BERBEDA dari status lain.** Kehadiran umum memakai kata penuh (HADIR/GHAIB), bukan kode huruf (H/A). Ini adalah **layer terpisah** — santri bisa HADIR di pesantren tapi A (Alpha) di sesi setoran.

#### Perbedaan Jumlah Santri
- Sheet Setoran: 22–25 santri
- Sheet Kehadiran: 36 santri

Ini mengindikasikan Kehadiran mencatat **semua santri pesantren**, sementara Setoran hanya mencatat santri yang aktif dalam program tahfidz tertentu.

---

### 3.6 Sheet: Sholat Hifdzi

**Nama resmi:** *Absensi Sholat Hifdzi*

#### Struktur Data

| Elemen | Detail |
|--------|--------|
| Periode | Per minggu (Minggu 1–4) |
| Sesi | Tidak ada pembagian sesi — satu status per minggu |
| Santri | 15 santri (subset dari keseluruhan) |

#### Status yang Digunakan
Hanya ditemukan `HADIR` — hampir semua sel kosong (belum diisi di periode Rajab).

#### Catatan
Sholat Hifdzi adalah kegiatan spesifik untuk santri tahfidz. Berbeda dari sholat jamaah umum. Kemungkinan besar ini adalah sholat berjamaah yang dipimpin oleh santri senior (hifdzi = yang hafal).

---

## 4. PERBANDINGAN

### 4.1 Perbandingan Antar Sheet dalam File 2

| Aspek | Setoran | Murojaah | NGAJI | Mingguan | Kehadiran | Sholat Hifdzi |
|-------|---------|----------|-------|----------|-----------|---------------|
| Frekuensi | Harian | Harian | Harian | Mingguan | Harian | Mingguan |
| Sesi | PAGI/SIANG | PAGI/SIANG* | MALAM/PAGI | Per event | Harian | Per minggu |
| Ada materi? | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ |
| Ada penyimak? | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ |
| Status H/A/I/S | ✅ | ✅* | ✅ | ✅ | ❌ | ❌ |
| Status TD | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ |
| Status TS | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ |
| Status HADIR/GHAIB | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Terikat hafalan? | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

*Diasumsikan sama dengan Setoran berdasarkan pola pesantren. Sheet Murojaah kosong di file yang diterima.

### 4.2 Perbandingan Antara File 1 dan File 2

| Aspek | File 1 (Muharram) | File 2 (Rajab) |
|-------|-------------------|----------------|
| Tujuan | Snapshot posisi hafalan + target per Diklat | Rekap operasional bulanan |
| Frekuensi update | Per periode Diklat | Harian/mingguan/bulanan |
| Dibuat oleh | Pengurus hafalan (sekali per periode) | Pengurus harian (terus-menerus) |
| Data yang ada | Peta 30 juz + target kualitatif | Absensi 6 jenis kegiatan |
| Masalah ditemukan | #REF! errors, PENCAPAIAN tidak diisi | Pola tidak konsisten (p, TS tidak terdokumentasi resmi) |

---

## 5. ANALISIS STATUS & ENUM

### 5.1 Inventaris Lengkap Semua Status

| Kode | Ditemukan Di | Makna Final | Perlu Keterangan? | Ada Materi? |
|------|-------------|-------------|-------------------|-------------|
| H | Setoran, NGAJI, Mingguan | Hadir + kegiatan diterima/dilakukan | ❌ | ✅ (Setoran saja) |
| A | Setoran, NGAJI, Mingguan | Alpha — absen tanpa keterangan | ❌ | ❌ |
| I | Setoran, NGAJI, Mingguan | Izin — absen resmi | ✅ (opsional) | ❌ |
| S | Setoran, NGAJI | Sakit | ✅ (opsional) | ❌ |
| TD | Setoran | Tidak Diterima — hadir tapi setoran ditolak | ✅ (wajib) | ✅ |
| TS | Setoran | Tidak Setoran — hadir tapi tidak menyetor | ✅ (opsional) | ❌ |
| HADIR | Kehadiran, Sholat Hifdzi | Hadir di pesantren (kehadiran umum) | ❌ | ❌ |
| GHAIB | Kehadiran | Tidak ada di pesantren | ✅ (opsional) | ❌ |
| p | Setoran (16x) | **TIDAK JELAS** — kemungkinan typo | — | — |

### 5.2 Rekomendasi Enum Database

```sql
-- Enum untuk absensi kegiatan (Setoran, Murojaah, NGAJI, Mingguan, Sholat Hifdzi)
CREATE TYPE status_absensi AS ENUM (
  'H',   -- Hadir + kegiatan dilakukan/diterima
  'A',   -- Alpha
  'I',   -- Izin
  'S',   -- Sakit
  'TD',  -- Tidak Diterima (khusus Setoran & Murojaah)
  'TS'   -- Tidak Setoran (khusus Setoran & Murojaah)
);

-- Enum terpisah untuk kehadiran umum harian
CREATE TYPE status_kehadiran_umum AS ENUM (
  'HADIR',
  'GHAIB'
);
```

### 5.3 Matriks Status per Jenis Kegiatan

| Status | Setoran | Murojaah | NGAJI | Mingguan | Kehadiran | Sholat Hifdzi |
|--------|---------|----------|-------|----------|-----------|---------------|
| H | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| A | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| I | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| S | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| TD | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| TS | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| HADIR | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| GHAIB | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## 6. ANALISIS OTOMASI

### 6.1 PETA HAFALAN (Sheet: DATA HAFALAN)

**Kesimpulan: ✅ FULLY OTOMATIS**

#### Logika Otomasi
Peta hafalan adalah turunan langsung dari data setoran yang sudah ada di sistem. Tidak perlu tabel terpisah — cukup query:

```sql
-- View: peta_hafalan
SELECT
  s.id AS santri_id,
  j.nomor AS juz_ke,
  EXISTS (
    SELECT 1 FROM setoran
    WHERE santri_id = s.id
    AND juz_ke = j.nomor
    AND status = 'H'
  ) AS sudah_hafal
FROM santri s
CROSS JOIN generate_series(1, 30) AS j(nomor)
ORDER BY s.id, j.nomor;
```

#### Yang Otomatis
- Grid TRUE/FALSE per juz → digenerate dari riwayat setoran
- Kolom JUMLAH → `COUNT(*) WHERE sudah_hafal = true`
- Update real-time saat ustadz input setoran baru

#### Yang TIDAK Bisa Otomatis
- **Tidak ada** — semua aspek peta hafalan bisa diotomasi penuh

#### Catatan Pola Non-Linier
Sistem harus mendukung santri yang menghafal dari dua arah (juz 1 ke depan + juz 30 ke belakang). Kolom JUMLAH bukan berarti "sampai juz N" tapi "total juz yang dikuasai di posisi manapun."

---

### 6.2 TARGET HAFALAN (Sheet: target)

**Kesimpulan: ⚡ SEBAGIAN OTOMATIS**

#### Yang Otomatis

| Kolom | Otomasi |
|-------|---------|
| PENCAPAIAN (angka) | ✅ Ambil dari `total_hafalan` santri |
| EVALUASI untuk Ziyadah | ✅ `pencapaian >= target_jumlah_juz` |
| EVALUASI untuk Sima'an | ✅ Cek apakah semua juz dalam range sudah TRUE |

#### Yang TIDAK Bisa Otomatis

| Kolom | Alasan |
|-------|--------|
| TARGET (text deskripsi) | Ditetapkan manual oleh pengurus per santri per Diklat |
| Tipe target (Ziyadah/Sima'an/Tahsin) | Keputusan kurikulum, bukan data sistem |
| EVALUASI untuk Tahap Tahsin | Bersifat kualitatif, tidak ada metrik angka |
| Periode Diklat | Ditentukan manual oleh pengurus |

#### Tabel yang Dibutuhkan

```sql
CREATE TABLE target_hafalan (
  id UUID PRIMARY KEY,
  santri_id UUID REFERENCES santri(id),
  periode VARCHAR(100),          -- e.g., "Diklat Rabi'ul Awwal 1448H"
  deadline DATE,
  tipe_target VARCHAR(20),       -- 'ziyadah' | 'simaan' | 'tahsin'
  target_jumlah_juz INT,         -- untuk ziyadah
  target_juz_dari INT,           -- untuk simaan (mulai juz ke-)
  target_juz_sampai INT,         -- untuk simaan (sampai juz ke-)
  catatan_target TEXT,           -- teks bebas seperti di Excel
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PENCAPAIAN dan EVALUASI dihitung otomatis via function/view
-- tidak disimpan sebagai kolom statis
```

---

### 6.3 ABSENSI SETORAN (Sheet: Setoran)

**Kesimpulan: ✅ OTOMATIS via Trigger dari Input Hafalan**

#### Mekanisme Otomasi

Saat ustadz membuka halaman input setoran, ia memilih status terlebih dahulu:

```
[H] [TD] [TS] [I] [S] [A]
```

**Jika H dipilih:**
- Form setoran aktif → ustadz input materi + sistem catat penyimak (dari akun login)
- Satu aksi → dua record: `setoran` (materi hafalan) + `absensi` (status H)
- `total_hafalan` dan peta hafalan diupdate otomatis

**Jika TD dipilih:**
- Form setoran tetap aktif → ustadz input materi + catatan alasan penolakan
- Satu aksi → dua record: `setoran` (dengan flag ditolak) + `absensi` (status TD)
- `total_hafalan` TIDAK diupdate

**Jika TS dipilih:**
- Form setoran nonaktif → hanya input keterangan opsional
- Satu aksi → satu record: `absensi` (status TS, tanpa data setoran)

**Jika I / S dipilih:**
- Form setoran nonaktif → input keterangan wajib
- Satu aksi → satu record: `absensi` (status I atau S + keterangan)

**Jika A dipilih:**
- Tidak ada form tambahan
- Satu aksi → satu record: `absensi` (status A)

#### Yang TIDAK Bisa Otomatis
- Siapa yang bertugas sebagai penyimak per sesi (harus diketahui/dipilih dari sistem, atau login sebagai penyimak)
- Keterangan alasan I/S (harus diinput manual)
- Alasan penolakan TD (harus diinput manual)

---

### 6.4 ABSENSI MUROJAAH (Sheet: Murojaah)

**Kesimpulan: ✅ IDENTIK dengan Setoran — mekanisme sama**

Sheet kosong di file yang diterima, tapi secara konsep murojaah memiliki:
- Sesi PAGI dan SIANG (sama)
- Ada materi (surat/juz yang dimurojaah)
- Ada penyimak
- Status yang sama (H, A, I, S, TD, TS)

Bedanya: status H di murojaah **tidak mengupdate total_hafalan** karena bukan hafalan baru.

---

### 6.5 ABSENSI NGAJI (Sheet: NGAJI)

**Kesimpulan: ❌ TIDAK BISA OTOMATIS — Input Manual Terpisah**

#### Alasan
- Tidak terkait dengan hafalan sama sekali
- Sesi berbeda (MALAM/PAGI, bukan PAGI/SIANG)
- Tidak ada materi, tidak ada penyimak
- Status lebih sederhana (H, A, I, S saja)

#### Mekanisme Input
Pengurus membuka halaman Absensi Ngaji, memilih tanggal dan sesi, lalu menandai status per santri. Bisa dibuat secepat mungkin dengan tampilan daftar santri + tap status.

---

### 6.6 ABSENSI MINGGUAN (Sheet: Mingguan)

**Kesimpulan: ❌ TIDAK BISA OTOMATIS — Input Manual Terpisah**

#### Alasan
- 4 kegiatan berbeda (Istighosah, N. Aang, Tilawah, Marhaba) dalam satu sheet
- Frekuensi mingguan, bukan harian
- Tidak ada korelasi dengan data lain di sistem

#### Hal yang Perlu Dikonfirmasi
- Apakah semua 4 kegiatan ini rutin setiap minggu atau bisa berubah?
- Siapa yang bertanggung jawab mencatat per kegiatan?
- Apakah ada kegiatan mingguan lain yang belum tercatat?

---

### 6.7 KEHADIRAN UMUM (Sheet: Kehadiran)

**Kesimpulan: ⚡ SEMI OTOMATIS — Default HADIR, Input GHAIB saja**

#### Alasan Tidak Bisa Fully Otomatis
- HADIR di kehadiran umum ≠ H di setoran
- Santri bisa HADIR di pesantren tapi A di semua sesi setoran hari itu
- Tidak ada cara sistem mengetahui apakah santri secara fisik ada di pesantren tanpa input manual

#### Strategi Optimal: Default HADIR

```
Logika:
- Default semua santri = HADIR setiap hari (tidak perlu input)
- Pengurus hanya input GHAIB ketika santri benar-benar tidak ada di pesantren
- Sistem menyimpan hanya record GHAIB
- Tampilan: jika tidak ada record GHAIB untuk santri X pada tanggal Y = HADIR
```

**Keuntungan:** Beban input turun drastis — dari 36 santri × 31 hari = 1.116 input/bulan menjadi hanya input pengecualian (rata-rata mungkin 20–50 record GHAIB per bulan).

---

### 6.8 ABSENSI SHOLAT HIFDZI (Sheet: Sholat Hifdzi)

**Kesimpulan: ❌ TIDAK BISA OTOMATIS — Input Manual Terpisah**

#### Alasan
- Kegiatan spesifik dengan kriteria kehadiran sendiri
- Frekuensi mingguan
- Tidak ada korelasi dengan data lain

---

### 6.9 RINGKASAN TABEL OTOMASI

| Fitur | Otomasi | Trigger | Catatan |
|-------|---------|---------|---------|
| Peta hafalan 30 juz | ✅ FULL | Input setoran H | Query/view real-time |
| Total hafalan | ✅ FULL | Input setoran H | Update kolom total_hafalan |
| Pencapaian target (angka) | ✅ FULL | Input setoran H | Ambil dari total_hafalan |
| Evaluasi target Ziyadah | ✅ FULL | Input setoran H | Bandingkan angka |
| Evaluasi target Sima'an | ✅ FULL | Input setoran H | Cek range juz di peta |
| Absensi dari input setoran | ✅ FULL | Input setoran | Trigger otomatis |
| Absensi dari input murojaah | ✅ FULL | Input murojaah | Trigger otomatis |
| Kehadiran umum (HADIR) | ⚡ SEMI | Default otomatis | Hanya input GHAIB |
| Rekap mingguan setoran | ✅ FULL | Aggregate query | Tidak perlu input |
| Export format Excel | ✅ FULL | Generate on demand | Harus cocok format asli |
| Target per periode Diklat | ❌ MANUAL | Input pengurus | Keputusan kurikulum |
| Absensi NGAJI | ❌ MANUAL | Input pengurus | Kegiatan independen |
| Absensi Mingguan (4 event) | ❌ MANUAL | Input pengurus | Kegiatan independen |
| Absensi Sholat Hifdzi | ❌ MANUAL | Input pengurus | Kegiatan independen |
| Evaluasi target Tahsin | ❌ MANUAL | Penilaian pengurus | Kualitatif |
| Keterangan I/S/TD/TS | ❌ MANUAL | Input pengurus | Kontekstual |

---

## 7. ARSITEKTUR DATABASE

### 7.1 Tabel Inti

```sql
-- Master jenis kegiatan (bisa ditambah pengurus)
CREATE TABLE jenis_kegiatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(100) NOT NULL,           -- 'Setoran', 'Murojaah', 'NGAJI', dll
  tipe_sesi VARCHAR(20),                -- 'PAGI_SIANG' | 'MALAM_PAGI' | 'MINGGUAN' | 'HARIAN'
  ada_materi BOOLEAN DEFAULT FALSE,
  ada_penyimak BOOLEAN DEFAULT FALSE,
  status_tersedia TEXT[],               -- array kode status yang berlaku
  aktif BOOLEAN DEFAULT TRUE
);

-- Kehadiran fisik umum harian
CREATE TABLE kehadiran_harian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id UUID REFERENCES santri(id),
  tanggal DATE NOT NULL,
  status status_kehadiran_umum DEFAULT 'HADIR',
  keterangan TEXT,
  dicatat_oleh UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(santri_id, tanggal)
);

-- Absensi semua kegiatan (satu tabel universal)
CREATE TABLE absensi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id UUID REFERENCES santri(id),
  kegiatan_id UUID REFERENCES jenis_kegiatan(id),
  tanggal DATE NOT NULL,
  sesi VARCHAR(10),                     -- 'PAGI' | 'SIANG' | 'MALAM' | NULL
  status status_absensi NOT NULL,
  keterangan TEXT,
  penyimak_id UUID REFERENCES profiles(id),
  setoran_id UUID REFERENCES setoran(id), -- nullable, link ke record setoran jika ada
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(santri_id, kegiatan_id, tanggal, sesi)
);

-- Target hafalan per periode Diklat
CREATE TABLE target_hafalan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id UUID REFERENCES santri(id),
  periode VARCHAR(100) NOT NULL,
  deadline DATE,
  tipe_target VARCHAR(20) NOT NULL,     -- 'ziyadah' | 'simaan' | 'tahsin'
  target_jumlah_juz INT,
  target_juz_dari INT,
  target_juz_sampai INT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.2 View Otomatis

```sql
-- Peta hafalan: tidak perlu tabel, cukup view
CREATE VIEW peta_hafalan AS
SELECT
  s.id AS santri_id,
  s.nama,
  j.nomor AS juz_ke,
  EXISTS (
    SELECT 1 FROM setoran st
    WHERE st.santri_id = s.id
    AND st.juz_ke = j.nomor
    AND st.status = 'H'
  ) AS sudah_hafal
FROM santri s
CROSS JOIN generate_series(1, 30) AS j(nomor);

-- Evaluasi target otomatis
CREATE VIEW evaluasi_target AS
SELECT
  t.*,
  s.total_hafalan AS pencapaian_ziyadah,
  CASE
    WHEN t.tipe_target = 'ziyadah'
      THEN s.total_hafalan >= t.target_jumlah_juz
    WHEN t.tipe_target = 'simaan'
      THEN NOT EXISTS (
        SELECT 1 FROM generate_series(t.target_juz_dari, t.target_juz_sampai) AS j(n)
        WHERE NOT EXISTS (
          SELECT 1 FROM setoran st
          WHERE st.santri_id = t.santri_id
          AND st.juz_ke = j.n AND st.status = 'H'
        )
      )
    ELSE NULL -- tahsin: evaluasi manual
  END AS tercapai
FROM target_hafalan t
JOIN santri s ON s.id = t.santri_id;
```

---

## 8. REKOMENDASI UI ADMIN PANEL

### 8.1 Halaman Input Setoran/Murojaah (Terintegrasi)

```
┌─────────────────────────────────┐
│  INPUT SETORAN — [Nama Santri]  │
├─────────────────────────────────┤
│  Tanggal: [auto: hari ini]      │
│  Sesi:    [● PAGI] [○ SIANG]    │
├─────────────────────────────────┤
│  STATUS KEHADIRAN:              │
│  [H] [TD] [TS] [I] [S] [A]     │
├─────────────────────────────────┤
│  (Aktif jika H atau TD)         │
│  Materi: [Juz ___] [Surat ___]  │
│  Ayat/Hal: [dari ___] [s/d ___] │
│  Catatan ustadz: [_________]    │
├─────────────────────────────────┤
│  Penyimak: [nama dari login]    │
│            [atau pilih manual]  │
└─────────────────────────────────┘
```

### 8.2 Halaman Absensi Kegiatan Terpisah

Satu halaman hub dengan tab atau card per kegiatan:
- Absensi Ngaji (MALAM/PAGI)
- Absensi Mingguan (pilih event: Istighosah/Tilawah/Marhaba/N.Aang)
- Absensi Sholat Hifdzi

### 8.3 Halaman Kehadiran Umum

List santri dengan status default HADIR. Pengurus hanya tap yang GHAIB. Ada tombol "Tandai Semua HADIR" untuk reset cepat.

### 8.4 Halaman Rekap & Export

- Filter: per santri / per kegiatan / per periode
- Tampilan visual: grid kalender dengan warna per status
- Export: tombol "Export Excel" yang menghasilkan format identik dengan file asli pengurus

---

## 9. RISIKO & KONFIRMASI KE PENGURUS

### 9.1 Hal yang WAJIB Dikonfirmasi Sebelum Deploy

| # | Pertanyaan | Dampak jika Salah Asumsi |
|---|-----------|--------------------------|
| 1 | Apakah TD = Tidak Diterima atau ada makna lain? | Salah kategorisasi ratusan record |
| 2 | Apakah "p" yang muncul 16x itu apa? Pulang? Typo? | Perlu atau tidak perlu jadi enum |
| 3 | Apakah S (Sakit) di Mingguan tidak dipakai karena kebijakan, atau terlewat? | Desain enum per kegiatan |
| 4 | Siapa yang berhak input setiap jenis absensi? | Role-based access control |
| 5 | Apakah kegiatan Mingguan (4 event) bisa berubah atau permanen? | Hardcode vs configurable |
| 6 | Berapa lama riwayat absensi disimpan? Per bulan, per tahun, atau selamanya? | Strategi storage |
| 7 | Apakah wali santri perlu melihat absensi ngaji? Atau hanya hafalan? | Scope fitur wali |

### 9.2 Risiko Teknis

| Risiko | Mitigasi |
|--------|---------|
| Santri yang menghafal non-linier (dua arah) membuat evaluasi Sima'an kompleks | Simpan setiap setoran per juz, bukan hanya total |
| Sheet Murojaah kosong — struktur belum pasti | Konfirmasi ke pengurus sebelum build |
| Pola absensi berbeda per bulan (Rajab ≠ Muharram) | Desain fleksibel, jangan hardcode nama bulan |
| Export Excel harus cocok persis dengan format asli | Build template export dari file asli ini |

---

*Dokumen ini dibuat berdasarkan analisis mendalam terhadap kedua file Excel yang diterima pada Juni 2026.*
*Versi: 1.0 — Perlu diupdate setelah konfirmasi ke pengurus.*
