# SPESIFIKASI FITUR: Ulangan Mingguan Santri
## Sistem Informasi Pondok Pesantren — Admin Panel
**Stack:** React 19 · Refine · Ant Design · Supabase (PostgreSQL)

---

## KONTEKS SISTEM

Ini adalah fitur tambahan pada admin panel pesantren yang sudah ada.
Pengguna sistem ada 3 role:
- `pengurus_kesantrian` — membuat soal, membuat ulangan, mencetak PDF, input nilai
- `ustadz` — melihat soal, melihat hasil & nilai santri (read-only)
- `admin` — akses penuh

Fitur ini **khusus untuk santri kelas 2** dengan materi:
- Nahwu Sharaf dari kitab **Alfiyah**, **Nadzmul Maqshud**, dan **Kailani**

Soal bersifat **essay / i'rob** — tidak ada pilihan ganda.
Santri mengerjakan soal di **kertas fisik** (bukan online).
PDF soal dicetak oleh pengurus langsung dari browser, tidak perlu software eksternal.
Pengerjaan bisa **individu** atau **kelompok/grup** tergantung kebijakan minggu itu.

---

## TUJUAN UTAMA FITUR

1. Pengurus dapat membuat dan menyimpan soal sebanyak-banyaknya ke bank soal
2. Pengurus memilih soal mana yang dijadikan ulangan minggu ini
3. Sistem otomatis generate PDF soal siap cetak
4. Soal yang sudah dipakai ditandai agar tidak dipakai ulang tanpa sengaja
5. Pengurus menginput nilai / catatan hasil koreksi kertas jawaban
6. Ustadz dapat melihat soal dan ringkasan hasil ulangan secara read-only
7. Semua arsip ulangan tersimpan lengkap beserta nilainya

---

## SKEMA DATABASE (Supabase / PostgreSQL)

### Tabel 1: `question_bank`
Bank soal utama. Soal bisa ditambah kapan saja tanpa terikat ulangan tertentu.

```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
kitab               text NOT NULL CHECK (kitab IN ('alfiyah', 'nadzmul_maqshud', 'kailani'))
bab                 text NOT NULL
sub_bab             text
konten_soal         text NOT NULL        -- teks soal, support Arab/Latin/campuran
tingkat_kesulitan   text CHECK (tingkat_kesulitan IN ('mudah', 'sedang', 'sulit'))
is_ever_used        boolean DEFAULT false
used_in_test_count  integer DEFAULT 0
last_used_test_id   uuid REFERENCES weekly_tests(id)
last_used_date      date
created_by          uuid REFERENCES auth.users(id)
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

### Tabel 2: `weekly_tests`
Data setiap ulangan yang dibuat pengurus.

```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
judul               text NOT NULL
minggu_ke           integer NOT NULL
tahun_ajaran        text NOT NULL        -- contoh: "2025/2026"
tanggal_pelaksanaan date
durasi_menit        integer DEFAULT 60
mode_pengerjaan     text CHECK (mode_pengerjaan IN ('individu', 'kelompok', 'campuran'))
jumlah_kelompok     integer              -- diisi jika mode kelompok/campuran
catatan_pengurus    text
status              text DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'selesai'))
pdf_url             text                 -- URL file PDF di Supabase Storage
created_by          uuid REFERENCES auth.users(id)
created_at          timestamptz DEFAULT now()
exported_at         timestamptz
```

### Tabel 3: `test_questions`
Soal mana saja yang dipilih untuk satu ulangan, beserta urutan nomornya.

```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_id             uuid NOT NULL REFERENCES weekly_tests(id) ON DELETE CASCADE
question_id         uuid NOT NULL REFERENCES question_bank(id)
nomor_urut          integer NOT NULL
created_at          timestamptz DEFAULT now()

UNIQUE(test_id, question_id)   -- satu soal tidak bisa masuk dua kali dalam satu ulangan
```

### Tabel 4: `test_submissions`
Hasil koreksi per santri (individu) atau per kelompok. Satu tabel, dua mode.

```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_id             uuid NOT NULL REFERENCES weekly_tests(id) ON DELETE CASCADE
mode                text NOT NULL CHECK (mode IN ('individu', 'kelompok'))
santri_id           uuid REFERENCES santri(id)       -- diisi jika mode individu
nama_kelompok       text                             -- diisi jika mode kelompok
santri_ids          uuid[]                           -- array anggota jika kelompok
nilai               numeric(5,2)
catatan_pengurus    text                             -- jawaban/catatan koreksi pengurus
status_kehadiran    text DEFAULT 'hadir' CHECK (status_kehadiran IN ('hadir', 'izin', 'alfa'))
dinilai_oleh        uuid REFERENCES auth.users(id)
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

## SUPABASE: PENGATURAN YANG DIPERLUKAN

### Row Level Security (RLS)

Aktifkan RLS pada semua tabel di atas. Policy yang dibuat:

**`question_bank`**
```sql
-- Semua user authenticated bisa SELECT
CREATE POLICY "read_all" ON question_bank FOR SELECT USING (auth.role() = 'authenticated');

-- Hanya pengurus yang bisa INSERT/UPDATE/DELETE
CREATE POLICY "pengurus_write" ON question_bank FOR ALL
  USING (auth.jwt() ->> 'role' = 'pengurus_kesantrian');
```

**`weekly_tests`**
```sql
CREATE POLICY "read_all" ON weekly_tests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "pengurus_write" ON weekly_tests FOR ALL
  USING (auth.jwt() ->> 'role' = 'pengurus_kesantrian');
```

**`test_submissions`**
```sql
-- Pengurus bisa semua, ustadz hanya SELECT
CREATE POLICY "read_all" ON test_submissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "pengurus_write" ON test_submissions FOR ALL
  USING (auth.jwt() ->> 'role' = 'pengurus_kesantrian');
```

### Supabase Storage

Buat bucket bernama `test-pdfs` dengan pengaturan:
- Visibility: **Private** (akses via signed URL)
- File size limit: 10MB
- Allowed MIME types: `application/pdf`

### PostgreSQL Function (Trigger)

Buat function untuk otomatis update flag soal saat ulangan difinalisasi:

```sql
CREATE OR REPLACE FUNCTION mark_questions_as_used()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'final' AND OLD.status = 'draft' THEN
    UPDATE question_bank
    SET
      is_ever_used = true,
      used_in_test_count = used_in_test_count + 1,
      last_used_test_id = NEW.id,
      last_used_date = NEW.tanggal_pelaksanaan,
      updated_at = now()
    WHERE id IN (
      SELECT question_id FROM test_questions WHERE test_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_test_finalized
  AFTER UPDATE ON weekly_tests
  FOR EACH ROW EXECUTE FUNCTION mark_questions_as_used();
```

---

## LIBRARY YANG DIPERLUKAN

### Core (sudah ada di stack)
```
react@19
@refinedev/core
@refinedev/antd
@refinedev/supabase
antd
@supabase/supabase-js
```

### Generate PDF (pilih salah satu, rekomendasi: @react-pdf/renderer)
```
@react-pdf/renderer        -- render PDF langsung di browser, support embed font Arab
```

Alternatif jika perlu HTML-to-PDF:
```
jspdf + html2canvas        -- lebih mudah styling tapi kurang kontrol font Arab
```

### Export Excel (untuk laporan nilai)
```
xlsx                       -- SheetJS, generate file .xlsx di sisi client
```

### Handle Teks Arab di Form
```
react-quill atau @uiw/react-md-editor   -- rich text input jika soal perlu format
```
Atau cukup `antd Input.TextArea` dengan CSS `direction: rtl` jika soal plain text.

### Drag & Drop urutan soal
```
@dnd-kit/core
@dnd-kit/sortable          -- untuk reorder nomor soal sebelum finalisasi
```

### Utilitas
```
dayjs                      -- format tanggal (sudah bundled dengan antd)
```

---

## PENANGANAN TEKS ARAB

### Rekomendasi Utama

Gunakan pendekatan **plain text dengan CSS RTL** — paling simpel dan cukup untuk kebutuhan ini.

**Di form input soal (Ant Design):**
```css
.arab-input {
  direction: rtl;
  font-family: 'Amiri', 'Scheherazade New', serif;
  font-size: 18px;
  line-height: 2;
}
```

**Font Arab yang direkomendasikan (free & support harakat):**
- `Amiri` — paling mirip teks kitab klasik, cocok untuk konten pesantren
- `Scheherazade New` — support harakat lengkap
- `Noto Naskh Arabic` — clean dan modern

Load via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
```

### Embed Font Arab ke PDF

`@react-pdf/renderer` memerlukan font di-embed manual ke dokumen PDF:

```javascript
import { Font } from '@react-pdf/renderer';

Font.register({
  family: 'Amiri',
  src: '/fonts/Amiri-Regular.ttf',  // simpan font di /public/fonts/
});
```

Download font `.ttf` dari Google Fonts atau fonts.google.com/specimen/Amiri,
lalu simpan di folder `public/fonts/` pada project React.

### Input Keyboard Arab

Pengurus perlu mengaktifkan keyboard Arab di device masing-masing, atau:
- Windows: Settings → Time & Language → Language → Add Arabic
- Android/iOS: Settings → General → Keyboard → Add Keyboard → Arabic

Sistem tidak perlu menyediakan virtual keyboard — ini urusan device pengurus.

---

## ARSITEKTUR HALAMAN

### Halaman 1: `/ulangan` — Bank Soal & Buat Ulangan

**Layout:** Ant Design Tabs dengan 2 tab

**Tab 1 — Bank Soal**
- Komponen: `useTable` dari `@refinedev/antd`
- Filter: kitab, bab, tingkat_kesulitan, status penggunaan (belum/sudah dipakai)
- Tabel kolom: Nomor · Kitab · Bab · Preview Soal · Kesulitan · Status Pakai · Aksi
- Soal yang `is_ever_used = true` diberi Ant Design `Tag` warna oranye + tooltip "Dipakai pada: [tanggal]"
- Tombol: "Tambah Soal" → buka Drawer dengan form input

**Form Tambah Soal (Drawer):**
- Select: Kitab
- Input: Bab, Sub Bab
- TextArea: Konten Soal (dengan CSS rtl + font Amiri)
- Select: Tingkat Kesulitan
- Tombol: Simpan

**Tab 2 — Buat Ulangan**
- Komponen: `useStepsForm` dari `@refinedev/antd` (3 langkah)

Step 1 — Info Ulangan:
  - Input: Judul, Minggu Ke, Tahun Ajaran, Tanggal, Durasi, Mode Pengerjaan
  - Jika mode kelompok/campuran: muncul field Jumlah Kelompok

Step 2 — Pilih Soal:
  - Tabel soal dengan checkbox selection
  - Default filter: `is_ever_used = false`
  - Toggle: "Tampilkan juga soal yang sudah pernah dipakai"
  - Panel kiri: tabel soal · Panel kanan: daftar soal terpilih (drag reorder)
  - Counter: "X soal dipilih"

Step 3 — Review & Finalisasi:
  - Preview tampilan soal seperti PDF
  - Tombol "Simpan Draft" atau "Finalisasi & Generate PDF"
  - Saat finalisasi: trigger update `question_bank` + generate PDF + upload ke Storage

---

### Halaman 2: `/ulangan/arsip` — Arsip & Penilaian

**Layout:** Ant Design Tabs dengan 2 tab

**Tab 1 — Daftar Arsip**
- Tabel: Minggu Ke · Judul · Tanggal · Mode · Jumlah Soal · Status Penilaian · Aksi
- Filter: tahun_ajaran, rentang tanggal, status
- Aksi per baris: Lihat Detail · Cetak Soal (PDF) · Export Nilai (Excel)

**Tab 2 — Input Nilai**
- Pilih ulangan dari dropdown (hanya yang status = 'final')
- Tabel inline-editable:
  - Mode individu: Nama Santri · Nilai · Hadir? · Catatan
  - Mode kelompok: form tambah kelompok + pilih anggota + nilai + catatan
  - Mode campuran: dua section dalam satu halaman
- Fitur: bulk fill nilai, toggle hadir/tidak hadir, indikator progress "X/Y terisi"
- Auto-save draft setiap 30 detik
- Tombol: "Simpan Semua" → update status test menjadi 'selesai'

---

### Halaman 3: `/ulangan/arsip/:id` — Detail Ulangan

Bisa diakses pengurus dan ustadz. Ustadz hanya read-only.

**Konten:**
- Header: Judul · Tanggal · Kelas · Mode · Durasi
- Section Soal: daftar soal lengkap dengan nomor urut dan asal kitab/bab
- Section Statistik: rata-rata · tertinggi · terendah · hadir/tidak hadir
- Section Hasil:
  - Jika individu: tabel Nama · Nilai · Status · Catatan
  - Jika kelompok: tabel Kelompok · Anggota · Nilai · Catatan
- Tombol (hanya pengurus): Edit Nilai · Export PDF · Export Excel

---

## ALUR KERJA LENGKAP (untuk dipahami AI)

```
[1] PERSIAPAN SOAL
    Pengurus buka /ulangan → Tab Bank Soal
    → Klik "Tambah Soal"
    → Isi form: kitab, bab, teks soal (bisa Arab)
    → Simpan ke tabel question_bank
    → Ulangi sampai soal cukup

[2] BUAT ULANGAN
    Pengurus buka /ulangan → Tab Buat Ulangan
    → Step 1: Isi info ulangan (judul, minggu ke, tanggal, mode)
    → Step 2: Pilih soal dari bank soal
              (default tampil soal is_ever_used = false)
              Atur urutan nomor soal
    → Step 3: Review → Klik "Finalisasi"
    → Sistem: trigger DB update flag soal + generate PDF + upload Storage
    → Pengurus download/buka PDF → Print → Bagikan ke santri

[3] PELAKSANAAN (offline)
    Santri mengerjakan soal di kertas
    Pengurus kumpulkan kertas jawaban

[4] INPUT NILAI
    Pengurus buka /ulangan/arsip → Tab Input Nilai
    → Pilih ulangan dari dropdown
    → Isi nilai dan catatan per santri / kelompok
    → Auto-save draft aktif selama pengisian
    → Klik "Simpan Semua"
    → Status ulangan berubah menjadi 'selesai'

[5] USTADZ LIHAT HASIL
    Ustadz buka /ulangan/arsip
    → Klik ulangan yang sudah selesai
    → Masuk halaman /ulangan/arsip/:id
    → Lihat soal + statistik + nilai santri (read-only)

[6] EXPORT & ARSIP
    Dari halaman arsip atau halaman detail:
    → "Cetak Soal" → generate PDF soal tanpa jawaban
    → "Export Nilai" → generate file .xlsx rekap nilai
    → Semua data tersimpan permanen di database
```

---

## STRUKTUR PDF SOAL (Print-Ready)

PDF yang di-generate harus memiliki layout sebagai berikut:

```
┌─────────────────────────────────────────────────────┐
│  [Logo Pesantren]                                   │
│  ULANGAN MINGGUAN — NAHWU SHARAF                    │
│  Kelas 2 | Minggu ke-X | Tanggal: DD/MM/YYYY        │
│  Waktu: XX menit                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. [Konten soal — font Amiri jika Arab]            │
│     _______________________________________________  │
│     _______________________________________________  │
│                                                     │
│  2. [Konten soal]                                   │
│     _______________________________________________  │
│     _______________________________________________  │
│  ... dst                                            │
├─────────────────────────────────────────────────────┤
│  Nama: ________________   Nilai: _______            │
│  TTD Pengurus: _________                            │
└─────────────────────────────────────────────────────┘
```

Implementasi dengan `@react-pdf/renderer`:
- Embed font Amiri dari file .ttf lokal
- Set `direction: 'rtl'` pada teks Arab
- Ukuran kertas: A4
- Margin: 2cm semua sisi
- Baris jawaban: garis horizontal dengan `borderBottom`

---

## STRUKTUR EXPORT EXCEL (Laporan Nilai)

File .xlsx yang di-generate menggunakan SheetJS berisi:

**Sheet 1 — Rekap Nilai**
```
Kolom: No | Nama Santri | Nilai | Status Kehadiran | Catatan Pengurus
Baris terakhir: Rata-rata | Nilai Tertinggi | Nilai Terendah
```

**Sheet 2 — Info Ulangan**
```
Judul Ulangan:    [judul]
Tanggal:          [tanggal]
Minggu Ke:        [minggu_ke]
Tahun Ajaran:     [tahun_ajaran]
Jumlah Soal:      [count]
Mode Pengerjaan:  [mode]
```

---

## CATATAN PENTING UNTUK IMPLEMENTASI

1. **Teks Arab di konten soal** — simpan sebagai plain text di PostgreSQL (tipe `text`).
   Tidak perlu encoding khusus, PostgreSQL mendukung Unicode penuh.

2. **Font PDF** — file `.ttf` font Amiri harus ada di folder `public/fonts/`
   sebelum fitur generate PDF bisa berfungsi.

3. **Refine resource** — daftarkan resource baru di `<Refine>` component:
   ```javascript
   resources={[
     { name: "question_bank", ... },
     { name: "weekly_tests", ... },
     { name: "test_questions", ... },
     { name: "test_submissions", ... },
   ]}
   ```

4. **Mode pengerjaan campuran** — saat input nilai, sistem harus memisahkan
   santri yang masuk kelompok dan yang mengerjakan individu.
   Query: ambil semua santri kelas 2, exclude santri yang sudah ada di `santri_ids`
   kelompok manapun dalam test yang sama.

5. **Auto-save draft** — implementasi dengan `useEffect` + `setTimeout` 30 detik,
   panggil `supabase.from('test_submissions').upsert()` dengan data saat itu.

6. **Access control Refine** — implementasikan `accessControlProvider` untuk
   membedakan akses pengurus dan ustadz, terutama di halaman detail arsip.

7. **PDF disimpan di Supabase Storage** — setelah generate, upload dengan
   `supabase.storage.from('test-pdfs').upload()` dan simpan URL-nya
   ke kolom `pdf_url` di tabel `weekly_tests`. Selanjutnya pengurus tinggal
   akses URL tersebut, tidak perlu generate ulang.
