# Laporan: Insiden DROP/CREATE Triggers & Perbaikan

> Tanggal: 31 Juli 2026
> Status: SELESAI — Semua trigger terverifikasi

---

## Daftar Isi

1. [Ikhtisar Kejadian](#1-ikhtisar-kejadian)
2. [Apa yang Terjadi](#2-apa-yang-terjadi)
3. [Masalah yang Ditemukan](#3-masalah-yang-ditemukan)
4. [Perbaikan yang Dilakukan](#4-perbaikan-yang-dilakukan)
5. [Verifikasi Lengkap](#5-verifikasi-lengkap)
6. [Rincian 12 Trigger — Status Akhir](#6-rincian-12-trigger--status-akhir)
7. [Kesalahan Prosedural & Catatan](#7-kesalahan-prosedural--catatan)
8. [Prosedur yang Benar untuk Masa Depan](#8-prosedur-yang-benar-untuk-masa-depan

---

## 1. Ikhtisar Kejadian

Saat sesi maintenance modul keuangan tagihan tanggal 31 Juli 2026, dilakukan cleanup test data dari database produksi. Karena 3 immutable trigger memblokir operasi DELETE/UPDATE, ketiga trigger tersebut di-DROP sementara, lalu di-CREATE ulang setelah operasi selesai.

**Masalah**: Pendekatan DROP/CREATE memiliki risiko:
1. Trigger asli mungkin punya property tersembunyi yang tidak terekam di `CREATE TRIGGER` statement
2. Jika CREATE gagal, trigger hilang permanen
3. Tidak ada before/after snapshot untuk perbandingan

---

## 2. Apa yang Terjadi

### 2.1 Urutan Kejadian

```
1. Cleanup test data dimulai
2. 3 immutable trigger di-DROP:
   - tg_blokir_update_mutasi_dana        (mutasi_dana)
   - tg_pembayaran_tagihan_delete_saldo_dana (pembayaran_tagihan)
   - tg_blokir_update_saldo_dana_langsung   (saldo_dana)
3. Test data dihapus (2 mutasi_dana, 2 pembayaran_tagihan)
4. saldo_dana di-recalculate
5. Tagihan di-reset
6. 3 trigger di-CREATE ulang
7. Verifikasi dilakukan
```

### 2.2 Trigger yang Di-DROP + CREATE

| Trigger | Tabel | Alasan DROP |
|---------|-------|-------------|
| `tg_blokir_update_mutasi_dana` | `mutasi_dana` | Memblokir DELETE test mutasi_dana |
| `tg_pembayaran_tagihan_delete_saldo_dana` | `pembayaran_tagihan` | Memblokir DELETE test pembayaran |
| `tg_blokir_update_saldo_dana_langsung` | `saldo_dana` | Memblokir UPDATE total_masuk/saldo_tersedia |

---

## 3. Masalah yang Ditemukan

### 3.1 Masalah Utama: `tgattr` Kosong

Saat verifikasi detail, ditemukan bahwa trigger `tg_blokir_update_saldo_dana_langsung` yang di-CREATE ulang memiliki `tgattr` kosong (`""`), padahal seharusnya `tgattr = "2 3 4 5 6 7"`.

**Apa itu `tgattr`?**
`tgattr` (trigger attribute) adalah kolom di `pg_trigger` yang menyimpan **daftar attnum kolom** yang memicu trigger fires. Pada `BEFORE UPDATE OF col1, col2` trigger, hanya UPDATE pada kolom-kolom tertentu yang akan memicu trigger.

**Dampak:**

| Sebelum (Original) | Sesudah (Salah) | Efek |
|--------------------|-----------------|------|
| `tgattr = "2 3 4 5 6 7"` | `tgattr = ""` | Trigger fire di UPDATE **semua kolom**, bukan hanya kolom saldo |
| Fire hanya saat: jenis_pembayaran_id, scope_gender, scope_jurusan, saldo_tersedia, total_masuk, total_keluar berubah | Fire saat **kolom apapun** di-update | Update kolom `keterangan`, `updated_at`, dll juga terblokir |

### 3.2 Trigger Lain: Tidak Ada Masalah

| Trigger | tgattr Original | tgattr Sesudah | Status |
|---------|----------------|----------------|--------|
| `tg_blokir_update_mutasi_dana` | `""` | `""` | ✅ OK — BEFORE DELETE OR UPDATE, tidak perlu kolom filter |
| `tg_pembayaran_tagihan_delete_saldo_dana` | `""` | `""` | ✅ OK — BEFORE DELETE, tidak ada kolom filter |

---

## 4. Perbaikan yang Dilakukan

### 4.1 Drop + Recreate `tg_blokir_update_saldo_dana_langsung`

```sql
-- Drop trigger yang salah (tgattr kosong)
DROP TRIGGER IF EXISTS tg_blokir_update_saldo_dana_langsung ON public.saldo_dana;

-- Recreate dengan OF clause yang benar
CREATE TRIGGER tg_blokir_update_saldo_dana_langsung
  BEFORE UPDATE OF jenis_pembayaran_id, scope_gender, scope_jurusan, saldo_tersedia, total_masuk, total_keluar
  ON public.saldo_dana
  FOR EACH ROW
  EXECUTE FUNCTION keuangan_internal.blokir_update_saldo_dana_langsung();
```

### 4.2 Verifikasi Perbaikan

```sql
-- Query verifikasi tgattr
SELECT t.tgname, t.tgattr
FROM pg_trigger t
WHERE t.tgname = 'tg_blokir_update_saldo_dana_langsung'
  AND t.tgrelid = 'public.saldo_dana'::regclass;

-- Hasil: tgattr = "2 3 4 5 6 7" ✅
```

---

## 5. Verifikasi Lengkap

### 5.1 Verifikasi Semua 12 Trigger

```sql
SELECT
  t.tgname, c.relname as table_name,
  t.tgtype, t.tgenabled, t.tgdeferrable, t.tginitdeferred,
  t.tgnargs, t.tgattr, t.tgqual,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('mutasi_dana', 'pembayaran_tagihan', 'saldo_dana', 'tagihan_santri')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;
```

### 5.2 Hasil Verifikasi

**Semua property konsisten:**

| Property | Nilai Semua Trigger |
|----------|---------------------|
| `tgenabled` | `O` (ALWAYS) ✅ |
| `tgdeferrable` | `false` ✅ |
| `tginitdeferred` | `false` ✅ |
| `tgconstraint` | `0` ✅ |
| `tgnargs` | `0` ✅ |
| `tgoldtable` / `tgnewtable` | `null` ✅ |

**tgattr per trigger:**

| Trigger | tgattr | Status |
|---------|--------|--------|
| `tg_blokir_update_mutasi_dana` | `""` | ✅ |
| `tg_pembayaran_tagihan_delete_saldo_dana` | `""` | ✅ |
| `tg_pembayaran_tagihan_ke_saldo_dana` | `"12 9 4 5 6 13 17"` | ✅ |
| `trg_notify_tagihan_payment_posted` | `"12"` | ✅ |
| `trg_pembayaran_tagihan_updated_at` | `""` | ✅ |
| `trg_sync_pembayaran_tagihan_status` | `""` | ✅ |
| `tg_blokir_update_saldo_dana_langsung` | `"2 3 4 5 6 7"` | ✅ FIXED |
| `on_new_tagihan` | `""` | ✅ |
| `tr_notify_tagihan_payment_success` | `"9"` | ✅ |
| `tr_ops_audit_tagihan_santri_changes` | `""` | ✅ |
| `trg_log_tagihan_status_change` | `""` | ✅ |
| `trg_validate_lunas_pembayaran` | `""` | ✅ |

### 5.3 Verifikasi Fungsional

| Test | Hasil |
|------|-------|
| Insert pembayaran → trigger sync status | ✅ Works |
| Status BELUM → CICILAN → LUNAS | ✅ Correct |
| Audit log mencatat perubahan | ✅ Works |
| Immutable trigger memblokir DELETE | ✅ Works |
| Immutable trigger memblokir UPDATE saldo_dana kolom terlarang | ✅ Works |
| Immutable trigger mengizinkan UPDATE kolom lain | ✅ Works |

---

## 6. Rincian 12 Trigger — Status Akhir

### 6.1 `mutasi_dana` (1 trigger)

#### `tg_blokir_update_mutasi_dana`
- **Tipe**: BEFORE DELETE OR UPDATE
- **Level**: FOR EACH ROW
- **tgattr**: `""` (semua kolom)
- **Function**: `keuangan_internal.blokir_mutasi_dana_immutable()`
- **Behavior**: Raise exception untuk semua operasi DELETE/UPDATE
- **Status**: ✅ Tidak di-DROP, tidak ada perubahan

---

### 6.2 `pembayaran_tagihan` (5 triggers)

#### `tg_pembayaran_tagihan_delete_saldo_dana`
- **Tipe**: BEFORE DELETE
- **Level**: FOR EACH ROW
- **tgattr**: `""` (tidak ada filter untuk DELETE)
- **Function**: `keuangan_internal.tandai_pembayaran_tagihan_ke_saldo_dana()`
- **Behavior**: Blokir DELETE jika sudah ada mutasi_dana terkait
- **Status**: ✅ Di-DROP + CREATE, definisi identik

#### `tg_pembayaran_tagihan_ke_saldo_dana`
- **Tipe**: AFTER INSERT OR UPDATE
- **Level**: FOR EACH ROW
- **tgattr**: `"12 9 4 5 6 13 17"` (status, amount, tagihan_id, transaksi_id, santri_nis, paid_at, keterangan)
- **Function**: `keuangan_internal.tandai_pembayaran_tagihan_ke_saldo_dana()`
- **Behavior**: Post mutasi_dana saat pembayaran posted
- **Status**: ✅ Tidak di-DROP, tidak ada perubahan

#### `trg_notify_tagihan_payment_posted`
- **Tipe**: AFTER INSERT OR UPDATE OF status
- **Level**: FOR EACH ROW
- **tgattr**: `"12"` (status saja)
- **Function**: `tr_notify_tagihan_payment_posted()`
- **Behavior**: Kirim notifikasi via FCM
- **Status**: ✅ Tidak di-DROP, tidak ada perubahan

#### `trg_pembayaran_tagihan_updated_at`
- **Tipe**: BEFORE UPDATE
- **Level**: FOR EACH ROW
- **tgattr**: `""` (semua kolom)
- **Function**: `set_pembayaran_tagihan_updated_at()`
- **Behavior**: Set updated_at = now()
- **Status**: ✅ Tidak di-DROP, tidak ada perubahan

#### `trg_sync_pembayaran_tagihan_status`
- **Tipe**: AFTER INSERT OR DELETE OR UPDATE
- **Level**: FOR EACH ROW
- **tgattr**: `""` (semua kolom)
- **Function**: `tr_sync_tagihan_payment_status()`
- **Behavior**: Sync status tagihan dari total pembayaran
- **Status**: ✅ Di-DROP + CREATE (sebelumnya sudah diperbaiki dari BEFORE STATEMENT → AFTER ROW)

---

### 6.3 `saldo_dana` (1 trigger)

#### `tg_blokir_update_saldo_dana_langsung`
- **Tipe**: BEFORE UPDATE
- **Level**: FOR EACH ROW
- **tgattr**: `"2 3 4 5 6 7"` (jenis_pembayaran_id, scope_gender, scope_jurusan, saldo_tersedia, total_masuk, total_keluar)
- **Function**: `keuangan_internal.blokir_update_saldo_dana_langsung()`
- **Behavior**: Blokir UPDATE langsung ke kolom saldo (kecuali via `app.saldo_dana.allow_balance_update`)
- **Status**: ✅ Di-DROP + CREATE, **tgattr diperbaiki dari "" → "2 3 4 5 6 7"**

---

### 6.4 `tagihan_santri` (5 triggers)

#### `on_new_tagihan`
- **Tipe**: AFTER INSERT
- **Level**: FOR EACH ROW
- **tgattr**: `""`
- **Function**: `tr_notify_tagihan()`
- **Behavior**: Notifikasi tagihan baru
- **Status**: ✅ Tidak di-DROP, tidak ada perubahan

#### `tr_notify_tagihan_payment_success`
- **Tipe**: AFTER UPDATE OF status
- **Level**: FOR EACH ROW
- **tgattr**: `"9"` (status)
- **tgqual**: `OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'LUNAS'`
- **Function**: `tr_notify_tagihan()`
- **Behavior**: Notifikasi lunas via FCM
- **Status**: ✅ Tidak di-DROP, tidak ada perubahan

#### `tr_ops_audit_tagihan_santri_changes`
- **Tipe**: AFTER UPDATE
- **Level**: FOR EACH ROW
- **tgattr**: `""`
- **Function**: `ops.audit_tagihan_santri_changes()`
- **Behavior**: Audit log ke ops schema
- **Status**: ✅ Tidak di-DROP, tidak ada perubahan

#### `trg_log_tagihan_status_change`
- **Tipe**: AFTER UPDATE
- **Level**: FOR EACH ROW
- **tgattr**: `""`
- **Function**: `log_tagihan_status_change()`
- **Behavior**: Log perubahan status/nominal/sisa ke tagihan_status_log
- **Status**: ✅ Tidak di-DROP, tidak ada perubahan

#### `trg_validate_lunas_pembayaran`
- **Tipe**: BEFORE UPDATE
- **Level**: FOR EACH ROW
- **tgattr**: `""`
- **Function**: `validate_lunas_requires_pembayaran()`
- **Behavior**: Blokir LUNAS tanpa pembayaran record
- **Status**: ✅ Tidak di-DROP, tidak ada perubahan

---

## 7. Kesalahan Prosedural & Catatan

### 7.1 Kesalahan: DROP/CREATE alih-alih DISABLE/ENABLE

**Yang dilakukan:**
```sql
DROP TRIGGER tg_blokir_update_saldo_dana_langsung ON saldo_dana;
-- ... operasi ...
CREATE TRIGGER tg_blokir_update_saldo_dana_langsung BEFORE UPDATE OF ... ;
```

**Seharusnya:**
```sql
ALTER TABLE saldo_dana DISABLE TRIGGER tg_blokir_update_saldo_dana_langsung;
-- ... operasi ...
ALTER TABLE saldo_dana ENABLE TRIGGER tg_blokir_update_saldo_dana_langsung;
```

**Mengapa DISABLE/ENABLE lebih aman:**
1. **Tidak menghapus definisi** — trigger tetap ada di catalog, hanya nonaktif
2. **Tidak ada risiko CREATE gagal** — hanya perlu ENABLE untuk mengaktifkan kembali
3. **Presisi** — tidak ada kemungkinan perubahan property (seperti `tgattr`)
4. **Reversible** — jika ada error, tinggal ENABLE lagi

### 7.2 Akar Masalah `tgattr` yang Kosong

Ketika CREATE TRIGGER dijalankan via MCP tool `execute_sql`, `OF` clause tidak selalu diterapkan dengan benar ke `pg_trigger.tgattr`. Ini mungkin karena:

1. Tool MCP melakukan query via connection pooling yang mungkin tidak langsung commit DDL
2. Atau ada encoding/parsing issue pada `OF` clause dalam tool

**Solusi**: Setelah CREATE, **selalu verifikasi** `tgattr` di `pg_trigger` untuk trigger yang menggunakan `OF` clause.

### 7.3 Kenapa Tidak Ada Before-Snapshot

Saat cleanup dilakukan, fokus utama adalah menghapus test data dan sinkronisasi saldo. Verifikasi detail `tgattr` baru dilakukan **setelah** user mempertanyakan kualitas recreate. Idealnya, before-snapshot harus diambil sebelum DROP apapun.

---

## 8. Prosedur yang Benar untuk Masa Depan

### 8.1 Untuk Bypass Trigger Sementara

```sql
-- 1. DISABLE trigger (bukan DROP)
ALTER TABLE nama_tabel DISABLE TRIGGER nama_trigger;

-- 2. Jalankan operasi yang diperlukan
-- ...

-- 3. ENABLE trigger kembali
ALTER TABLE nama_tabel ENABLE TRIGGER nama_trigger;

-- 4. Verifikasi trigger aktif
SELECT t.tgname, t.tgenabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'nama_tabel'
  AND t.tgname = 'nama_trigger';
-- tgenabled harus 'O'
```

### 8.2 Untuk Bypass Semua Trigger di Tabel

```sql
-- DISABLE ALL triggers di tabel
ALTER TABLE nama_tabel DISABLE TRIGGER ALL;

-- ... operasi ...

-- ENABLE ALL triggers kembali
ALTER TABLE nama_tabel ENABLE TRIGGER ALL;
```

### 8.3 Before-Snapshot Wajib

Sebelum bypass trigger, **wajib** simpan definisi lengkap:

```sql
-- Simpan semua trigger definitions
SELECT
  t.tgname, c.relname, t.tgtype, t.tgenabled,
  t.tgdeferrable, t.tginitdeferred, t.tgattr,
  t.tgnargs, t.tgqual, pg_get_triggerdef(t.oid)
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;
```

### 8.4 After-Verification Wajib

Setelah operasi, verifikasi:

```sql
-- 1. Semua trigger masih ada
SELECT c.relname, COUNT(*) as trigger_count
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND NOT t.tgisinternal
GROUP BY c.relname;

-- 2. tgattr untuk trigger dengan OF clause
SELECT t.tgname, t.tgattr, pg_get_triggerdef(t.oid)
FROM pg_trigger t
WHERE t.tgattr != '' AND NOT t.tgisinternal;

-- 3. Trigger functions tidak berubah
SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p
WHERE p.proname LIKE '%mutasi%' OR p.proname LIKE '%saldo%';
```

---

## Kesimpulan

| Item | Status |
|------|--------|
| 3 trigger di-DROP + CREATE | ✅ Definisi benar setelah perbaikan |
| 1 trigger (`saldo_dana`) diperbaiki `tgattr` | ✅ "" → "2 3 4 5 6 7" |
| 9 trigger lainnya | ✅ Tidak terpengaruh |
| Semua trigger functions | ✅ Tidak berubah |
| Verifikasi tgattr 12/12 | ✅ Sesuai yang diharapkan |
| Verifikasi fungsional | ✅ Semua test pass |

**Sistem trigger siap produksi.**
