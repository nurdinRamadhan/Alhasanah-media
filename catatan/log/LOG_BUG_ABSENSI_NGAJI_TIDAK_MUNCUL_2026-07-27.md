# Log Bug: Absensi Ngaji Tidak Muncul di Aplikasi Wali Santri

**Tanggal**: 27 Juli 2026  
**Otomasi**: 14 Agustus 2026 (update)  
**Modul Terdampak**: Absensi Tahfidz (Ziyadah & Murojaah)  
**Status**: FIXED

---

## Ringkasan Eksekutif

Data absensi ngaji santri tidak muncul di aplikasi wali santri karena fungsi konversi tanggal masehi ke hijriah (`gregorian_to_hijri_hday`) mengembalikan nilai yang salah. Akar masalahnya adalah **tabel referensi koreksi bulan hijriah hanya berisi 1 bulan**, sehingga untuk tanggal di luar bulan tersebut, fungsi jatuh ke fallback matematika yang tidak akurat.

---

## Arsitektur Sistem (Before Fix)

### Alur Konversi Tanggal

```
Input: Tanggal Masehi (27 Juli 2026)
        │
        ▼
┌─────────────────────────────────────┐
│ gregorian_to_hijri_hday('2026-07-27')│
│                                     │
│ 1. Cek tabel koreksi_bulan_hijriah   │
│    "Apakah tanggal ini masuk range   │
│     bulan hijriah yang diketahui?"   │
│                                     │
│ 2. Jika YA → hitung hari hijriah    │
│ 3. Jika TIDAK → fallback matematika  │
└─────────────────────────────────────┘
        │
        ▼
Output: Hari Hijriah (misal: 12)
        │
        ▼
JOIN dengan ngaji_absensi.hari_hijriah
        │
        ▼
Data absensi ngaji muncul di aplikasi
```

### Kondisi Database (Before Fix)

```sql
-- Tabel koreksi_bulan_hijriah HANYA punya 1 data:
┌──────┬───────┬─────────────────┬───────────┐
│ tahun│ bulan │ tanggal_awal    │ panjang   │
├──────┼───────┼─────────────────┼───────────┤
│ 1448 │   1   │ 2026-06-16      │ 30 hari   │  ← Muharram saja
└──────┴───────┴─────────────────┴───────────┘

-- Tabel ngaji_absensi punya data dengan hari_hijriah:
-- 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25
```

---

## Akar Masalah (Root Cause)

### Fungsi `gregorian_to_hijri_hday()`

```sql
-- Fungsi memiliki 2 jalur:
CREATE OR REPLACE FUNCTION gregorian_to_hijri_hday(p_date date)
RETURNS integer AS $$
DECLARE
  koreksi RECORD;
  v_month INTEGER;
BEGIN
  -- JALUR 1: Cek tabel koreksi
  SELECT INTO koreksi *
  FROM koreksi_bulan_hijriah
  WHERE p_date >= tanggal_awal_masehi
    AND p_date < tanggal_awal_masehi + panjang_bulan;
  
  IF FOUND THEN
    -- Hitung berdasarkan koreksi → AKURAT
    RETURN (p_date - koreksi.tanggal_awal_masehi)::INTEGER + 1;
  END IF;

  -- JALUR 2: Fallback matematika → TIDAK AKURAT
  -- ... rumus konversi ...  ← SELALU RETURN 1 untuk Juli 2026
  
  RETURN v_day;  -- ← SELALU = 1
END;
$$;
```

### Dampak ke Query

```sql
-- Sebelum fix:
public.gregorian_to_hijri_hday('2026-07-27') = 1   ← dari fallback
ngaji_absensi.hari_hijriah = 12                      ← data sebenarnya
1 ≠ 12 → JOIN GAGAL → 0 baris → Data ngaji HILANG

-- Sesudah fix:
public.gregorian_to_hijri_hday('2026-07-27') = 12  ← dari koreksi bulan 2
ngaji_absensi.hari_hijriah = 12
12 = 12 → JOIN BERHASIL → Data ngaji MUNCUL
```

---

## Kronologi Perbaikan

| Waktu | Aksi | Hasil |
|---|---|---|
| 27/07 10:00 | Investigasi RPC | Ditemukan JOIN ngaji gagal karena konversi salah |
| 27/07 10:15 | Cek `koreksi_bulan_hijriah` | Hanya ada bulan 1 (Muharram) |
| 27/07 10:20 | Insert bulan 2 & 3 | `gregorian_to_hijri_hday` mulai benar untuk Juli-Agustus |
| 27/07 10:25 | Verifikasi RPC simulasi | Data ngaji + mingguan muncul untuk 25-30 Juli |
| 27/07 10:30 | Deploy ke production | Data tampil di aplikasi wali santri |

---

## Fix yang Diterapkan

### 1. Database: Insert Koreksi Manual

```sql
-- Bulan 2 (Safar 1448)
INSERT INTO koreksi_bulan_hijriah (tahun_hijriah, bulan_hijriah_number, tanggal_awal_masehi, panjang_bulan, keterangan)
VALUES (1448, 2, '2026-07-16', 29, 'Manual fix 27 Juli 2026');

-- Bulan 3 (Rabiul Awal 1448)
INSERT INTO koreksi_bulan_hijriah (tahun_hijriah, bulan_hijriah_number, tanggal_awal_masehi, panjang_bulan, keterangan)
VALUES (1448, 3, '2026-08-14', 30, 'Manual fix 27 Juli 2026');
```

### 2. Database: Function Otomatis (Preventif)

```sql
-- Function untuk extend koreksi ke depan
SELECT extend_koreksi_hijriah(12);
-- → Menambah 12 bulan otomatis dari data terakhir
-- → Sekarang koreksi mencakup 1448/1 - 1449/3 (sampai Agustus 2027)

-- Function untuk cek kesehatan koreksi
SELECT * FROM cek_kesehatan_koreksi_hijriah();
-- → Menampilkan status setiap bulan: OK, GAP, OUTDATED, OVERLAP

-- Function untuk insert/update 1 bulan
SELECT upsert_koreksi_hijriah(1448, 4, '2026-09-13', 29, 'Koreksi manual');

-- Function auto-extend (otomatis via pg_cron)
SELECT * FROM auto_extend_koreksi_if_needed();
-- → Cek otomatis, extend jika perlu, log aktivitas

-- Function manual extend (dengan log)
SELECT * FROM manual_extend_koreksi_hijriah(6);
-- → Extend 6 bulan dengan catatan di tabel log
```

### 3. Otomasi pg_cron (Auto-Extend)

```sql
-- Jadwal: Setiap tanggal 1 bulan jam 00:00 UTC
SELECT cron.schedule(
  'auto-extend-koreksi-hijriah',
  '0 0 1 * *',
  $$ SELECT public.auto_extend_koreksi_if_needed(); $$
);

-- Job ID: 21
-- Status: Aktif
-- Log: Tersimpan di tabel koreksi_bulan_hijriah_log
```

### 3. Frontend: Status IZIN Ditambahkan

- 8 file di modul hafalan & murojaah diupdate
- Warna IZIN: `#2563EB` (biru)
- Warna SEKOLAH diubah dari `#2563EB` → `#6366F1` (indigo) agar tidak bentrok

---

## Pencegahan ke Depan

### Status Otomasi (Update: 27 Juli 2026)

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATUS OTOMASI                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✅ AUTO-EXTEND AKTIF                                           │
│  - pg_cron Job ID: 21                                           │
│  - Jadwal: Setiap tanggal 1, jam 00:00 UTC                     │
│  - Function: auto_extend_koreksi_if_needed()                    │
│  - Log: Tersimpan di koreksi_bulan_hijriah_log                  │
│                                                                  │
│  ✅ KOREKSI SAAT INI                                            │
│  - Total: 18 bulan (1448/1 - 1449/6)                            │
│  - Rentang: 16 Juni 2026 - 31 Oktober 2027                     │
│  - Sisa: ~475 hari dari sekarang                                │
│                                                                  │
│  ✅ MANUEL OVERRIDE                                              │
│  - Function: manual_extend_koreksi_hijriah(bulan)               │
│  - Berguna jika perlu extend sebelum jadwal                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Monitoring yang Disarankan

| Metode | Frekuensi | Aksi |
|---|---|---|
| Auto-extend | Setiap tanggal 1 | pg_cron jalankan otomatis |
| Cek log | Bulanan | `SELECT * FROM koreksi_bulan_hijriah_log ORDER BY extended_at DESC LIMIT 5;` |
| Cek kesehatan | Bulanan | `SELECT * FROM cek_kesehatan_koreksi_hijriah();` |
| Manual extend | Jika darurat | `SELECT * FROM manual_extend_koreksi_hijriah(6);` |

### Warning Signs (Tanda-Tanda Error Akan Terulang)

1. **Data ngaji hilang tiba-tiba** di aplikasi wali santri
2. **Summary absensi** menunjukkan angka lebih rendah dari biasanya
3. **Log error** di Supabase menunjukkan 0 baris dari query ngaji
4. **Tidak ada log extend** di `koreksi_bulan_hijriah_log` selama 2 bulan berturut-turut

---

## Tabel Referensi: 12 Bulan Hijriah

| No | Nama Bulan | Pola Panjang | Keterangan |
|----|-----------|--------------|------------|
| 1 | Muharram | 30 hari | Bulan ganjil |
| 2 | Safar | 29 hari | Bulan genap |
| 3 | Rabiul Awal | 30 hari | Bulan ganjil |
| 4 | Rabiul Akhir | 29 hari | Bulan genap |
| 5 | Jumadal Ula | 30 hari | Bulan ganjil |
| 6 | Jumadal Akhirah | 29 hari | Bulan genap |
| 7 | Rajab | 30 hari | Bulan ganjil |
| 8 | Sha'ban | 29 hari | Bulan genap |
| 9 | Ramadan | 30 hari | Bulan ganjil |
| 10 | Shawwal | 29 hari | Bulan genap |
| 11 | Dhul Qi'dah | 30 hari | Bulan ganjil |
| 12 | Dhul Hijjah | 29 hari | Bulan genap |

> **Catatan**: Pola di atas adalah default. Beberapa bulan bisa berbeda 1 hari tergantung pengamatan hilal. Untuk akurasi, gunakan tabel koreksi yang sudah di-verify.

---

## File Terkait

- `supabase/migrations/20260619000000_setup_tahfidz_absensi_integrasi.sql` - CHECK constraint awal
- `supabase/migrations/20260705000000_harden_weekly_attendance_summary_rpc.sql` - RPC `get_ringkasan_absensi_mingguan`
- `supabase/migrations/20260705120000_fix_ngaji_absensi_join.sql` - RPC dengan JOIN ngaji
- `supabase/migrations/20260727100000_add_izin_to_tahfidz_absensi.sql` - Tambah status IZIN
- `supabase/migrations/20260727100001_add_auto_koreksi_hijriah_functions.sql` - Function otomasi koreksi
- `supabase/migrations/20260727100002_add_auto_extend_koreksi_cron.sql` - Auto-extend + pg_cron

---

## CATATAN UNTUK AI AUDIT (Panduan Deteksi & Pencegahan)

> **Bagian ini khusus untuk AI assistant yang mungkin menangani masalah serupa di masa depan.**

### Pola Error yang Sama

```
GEJALA:
- Data absensi ngaji/ziyadah/murojaah TIDAK MUNCUL di aplikasi wali santri
- Data absensi lain (sholat, mingguan) muncul normal
- Ringkasan absensi menunjukkan angka lebih rendah dari yang diharapkan
- Tidak ada error di Supabase logs (query berhasil tapi 0 baris)

PENYEBAB:
- Tabel koreksi_bulan_hijriah kekurangan data untuk bulan hijriah tertentu
- Fungsi gregorian_to_hijri_hday() jatuh ke fallback matematika
- Fallback return 1 untuk SEMUA tanggal → JOIN ngaji_absensi gagal
```

### Langkah Deteksi (Urutan Wajib)

```sql
-- LANGKAH 1: Cek apakah koreksi lengkap
SELECT * FROM cek_kesehatan_koreksi_hijriah();
-- Cari status "OUTDATED" atau "GAP"

-- LANGKAH 2: Cek konversi untuk tanggal bermasalah
SELECT 
  '2026-07-27'::date AS tgl,
  public.gregorian_to_hijri_hday('2026-07-27') AS hari_hijriah;
-- Jika hasil = 1 dan seharusnya bukan hari 1 → koreksi kurang

-- LANGKAH 3: Cek data ngaji_absensi untuk tanggal tersebut
SELECT hari_hijriah, COUNT(*) 
FROM ngaji_absensi 
WHERE tanggal = '2026-07-27'
GROUP BY hari_hijriah;
-- Bandingkan dengan hasil konversi

-- LANGKAH 4: Jika koreksi kurang, extend
SELECT * FROM extend_koreksi_hijriah(6);

-- LANGKAH 5: Verifikasi
SELECT public.gregorian_to_hijri_hday('2026-07-27');
-- Harus = hasil dari langkah 3
```

### Aturan Penting untuk AI

```
1. JANGAN pernah menghapus data di koreksi_bulan_hijriah
2. JANGAN mengubah tanggal_awal_masehi yang sudah ada (kecuali ada bukti salah)
3. SELALU cek koreksi sebelum modify fungsi gregorian_to_hijri_hday
4. SELALU test dengan 3 tanggal sebelum dan sesudah fix
5. CATAT setiap perubahan ke tabel audit_log dengan keterangan jelas

---
